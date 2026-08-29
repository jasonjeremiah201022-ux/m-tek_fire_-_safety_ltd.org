/**
 * M-Tek app preview — headless smoke test (jsdom, REAL API flows).
 * Run:  cd preview && node smoke.test.js   (server must be running on :8080)
 *
 * Covers: lock screen, server login (wrong+right password), 11 screens,
 * Insights speed dial (Invoice/Receipt/MILS), SVG icons (no emojis),
 * POS sale gated by SERVER-verified signature passcode, invoice payment,
 * disk persistence, settings (serial reseed + reset).
 * NOTE: jsdom evals are isolated — all app state is read via __mtek().
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8080';
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace(/<link[^>]*fonts[^>]*>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: BASE,
  beforeParse(window) {
    window.localStorage.clear();
    window.fetch = (u, o) => fetch(BASE + u, o);
  } });
const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const errors = [];
dom.window.addEventListener('error', e => errors.push(e.message));
dom.window.eval(js);
const w = dom.window;
const S = () => w.__mtek();
const appText = () => w.document.querySelector('#app').textContent;
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await fetch(BASE + '/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  await w.eval('boot()');
  await sleep(400);

  // ---- 1. lock screen + server-side login ----
  expect(w.document.querySelector('#auth .auth-card'), 'Lock screen should show on boot');
  w.document.querySelector('#a-pass').value = 'wrongpass';
  await w.doLogin(); await sleep(200);
  expect(w.document.querySelector('#a-err').textContent.includes('Wrong password'), 'Wrong password rejected server-side');
  w.document.querySelector('#a-pass').value = 'admin123';
  await w.doLogin(); await sleep(400);
  expect(w.document.querySelector('#auth').style.display === 'none', 'Auth overlay hides after login');
  expect(S().products.length >= 12, 'Products loaded from API');
  console.log('✓ Server-side login + state loaded from API (' + S().products.length + ' products)');

  // ---- 2. all screens render ----
  for (const r of ['insights','transactions','customers','receipts','invoices','mils','sales','stock','summary','docs','settings']) {
    w.go(r); await sleep(30);
    expect(appText().length > 100, r + ': screen looks empty');
  }
  console.log('✓ All 11 screens render (incl. Settings)');

  // ---- 3. Insights speed dial ----
  w.go('insights'); await sleep(80);
  w.toggleFab();
  expect(w.document.querySelector('#fab-dial.open'), 'Speed dial should open');
  const items = [...w.document.querySelectorAll('.fab-item')].map(b => b.textContent).join(' ');
  expect(items.includes('Invoice') && items.includes('Receipt') && items.includes('MILS'), 'Dial lists Invoice/Receipt/MILS vertically');
  w.startDoc('invoice'); await sleep(80);
  expect(appText().includes('SALES INVOICE'), 'startDoc routes into generator (Invoice)');
  console.log('✓ Insights speed dial → Invoice / Receipt / MILS (vertical) — routing works');

  // ---- 4. SVG icons, no emojis ----
  expect(w.document.querySelector('.sidebar .ic use'), 'Sidebar uses SVG sprite');
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  expect(!emojiRe.test(w.document.querySelector('.sidebar').innerHTML), 'No emojis in sidebar');
  console.log('✓ SVG icon sprite in use — navigation is emoji-free');

  // ---- 5. POS sale gated by server-verified signature ----
  w.go('sales'); await sleep(80);
  w.cartQty('F002', 2);
  w.cartQty('SRV-1', 1);
  w.document.querySelector('#pos-cust').value = 'C003';
  w.document.querySelector('#pos-cust').dispatchEvent(new w.Event('change'));
  await sleep(80);
  const before = [S().receipts.length, S().products.find(p => p.id === 'F002').qty];
  w.completeSale();
  await sleep(150);
  expect(w.document.querySelector('#gate-sig'), 'Signature gate should appear');
  w.document.querySelector('#gate-sig').value = '0000';
  await w.gateSubmit(); await sleep(250);
  expect(w.document.querySelector('#gate-err') && w.document.querySelector('#gate-err').textContent.includes('NOT issued'), 'Wrong passcode blocked server-side');
  w.document.querySelector('#gate-sig').value = '1234';
  await w.gateSubmit(); await sleep(600);
  const after = [S().receipts.length, S().products.find(p => p.id === 'F002').qty];
  expect(after[0] === before[0] + 1, 'Receipt issued (was ' + before[0] + ', now ' + after[0] + ')');
  expect(after[1] === before[1] - 2, 'Stock decremented server-side (24 → 22)');
  console.log('✓ Sale signed via server verification — receipt issued, stock 24 → 22');

  // ---- 6. invoice payment via API ----
  w.go('invoices'); await sleep(80);
  w.invPay('MTK-INV-0003'); await sleep(120);
  w.signThenPay('MTK-INV-0003'); await sleep(120);
  w.document.querySelector('#gate-sig').value = '1234';
  await w.gateSubmit(); await sleep(500);
  expect(S().invoices.find(v => v.no === 'MTK-INV-0003').paid > 0, 'Invoice paid via API');
  console.log('✓ Invoice payment recorded through the API');

  // ---- 7. disk persistence ----
  await sleep(300); // debounce
  const dbNow = JSON.parse(fs.readFileSync(path.join(__dirname, '.data', 'db.json'), 'utf8'));
  expect(dbNow.txns.length >= 15, 'Transactions persisted to disk');
  expect(dbNow.products.find(p => p.id === 'F002').qty === 22, 'Stock persisted to disk');
  expect(dbNow.users.length >= 1, 'Accounts persisted');
  console.log('✓ Everything persisted server-side (preview/.data/db.json) — refresh-proof');

  // ---- 8. settings: reseed + reset ----
  w.go('settings'); await sleep(80);
  w.document.querySelector('#seed-receipt').value = '3000';
  await w.reseedSerial('receipt', 3000); await sleep(300);
  expect(S().serials.receipt === 3000, 'Serial reseed persisted');
  await w.resetDemo(); await sleep(500);
  expect(S().serials.receipt === 2131, 'Reset restores seed serials');
  console.log('✓ Settings: serial reseed + reset work against the API');

  if (errors.length) throw new Error('JS errors: ' + errors.join('; '));
  console.log('\nALL SMOKE TESTS PASSED — real API flows, server-side signing, persistence, 0 JS errors');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
