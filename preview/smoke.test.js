/**
 * M-Tek app preview — headless smoke test (jsdom, REAL API flows, REAL data).
 * Run:  cd preview && node smoke.test.js   (server must be running on :8080)
 *
 * Owner directive 2026-08-30: NO presets/demo data — the workspace boots with
 * the owner's REAL 358-product catalogue and EMPTY books (no sample customers,
 * sales, receipts, transactions). Every flow below creates its own real data.
 * Covers: lock screen, server login (wrong+right password), 11 screens,
 * Insights speed dial, SVG icons (no emojis), real catalogue count, customer
 * creation, stock adjust, cash sale (receipt + stock decrement), credit sale
 * (invoice) + payment, contact-mandatory documents, MILS logging, TXT import,
 * disk persistence, permission matrix, CEO hardcode + zero-start serials.
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
const api = async (u, body) => {
  const r = await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
  return d;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
// CEO credentials come from backend/.env (gitignored) — the real account values.
const dotEnv = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const CEO_EMAIL = 'mtekfiresafetyltd@gmail.com';
const CEO_PASS = dotEnv.MTEK_CEO_PASSWORD;
const CEO_SIG = dotEnv.MTEK_CEO_SIG;
if (!CEO_PASS || !CEO_SIG) throw new Error('backend/.env must define MTEK_CEO_PASSWORD and MTEK_CEO_SIG');
const apiExpect = async (status, u, body) => {
  const r = await fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(r.status === status, `expected HTTP ${status} for ${u}, got ${r.status}`);
  return r.json().catch(() => ({}));
};

(async () => {
  await fetch(BASE + '/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: CEO_EMAIL }) });
  await w.eval('boot()');
  await sleep(400);

  // ---- 1. lock screen + server-side login ----
  expect(w.document.querySelector('#auth .auth-card'), 'Lock screen should show on boot');
  w.document.querySelector('#a-email').value = CEO_EMAIL;
  w.document.querySelector('#a-pass').value = 'wrongpass';
  await w.doLogin(); await sleep(200);
  expect(w.document.querySelector('#a-err').textContent.includes('Wrong password'), 'Wrong password rejected server-side');
  w.document.querySelector('#a-pass').value = CEO_PASS;
  await w.doLogin(); await sleep(400);
  expect(w.document.querySelector('#auth').style.display === 'none', 'Auth overlay hides after login');
  expect(S().products.length === 358, 'REAL catalogue loaded from API (358 products), got ' + S().products.length);
  expect(S().customers.length === 0 && S().receipts.length === 0 && S().txns.length === 0,
    'Books start EMPTY — no preset/demo data');
  const serialsZero = Object.values(S().serials).every(v => v === 0);
  expect(serialsZero, 'All serial books start at zero (next issue = 000000001)');
  console.log('✓ Server-side login + REAL catalogue (358 products), empty books, zero-start serials');

  // ---- 2. all screens render ----
  for (const r of ['insights','transactions','customers','receipts','invoices','mils','sales','stock','summary','docs','settings']) {
    w.go(r); await sleep(30);
    expect(appText().length > 0, r + ': screen renders blank');
  }
  expect(w.document.querySelector('#nav').innerHTML.includes('Settings'), 'CEO sees Settings');
  console.log('✓ All 11 screens render for the CEO (incl. Settings)');

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

  // ---- 5. REAL data flows: customer → stock adjust → cash sale → receipt ----
  const cust = await api('/api/customers', { name: 'Kofar Rimi Farms', phone: '08033489452', email: CEO_EMAIL });
  expect(cust.customer && cust.customer.id, 'Customer created via real API flow');
  await api('/api/stock/adjust', { id: 'F002', delta: 10, reason: 'OPENING', email: CEO_EMAIL });
  await w.refreshState(); w.render(); await sleep(150); // UI picks up the new customer + stock
  w.go('sales'); await sleep(80);
  w.cartQty('F002', 2);
  w.document.querySelector('#pos-cust').value = cust.customer.id;
  w.document.querySelector('#pos-cust').dispatchEvent(new w.Event('change'));
  await sleep(80);
  const before = [S().receipts.length, S().products.find(p => p.id === 'F002').qty];
  w.completeSale();
  await sleep(150);
  expect(w.document.querySelector('#gate-sig'), 'Signature gate should appear');
  w.document.querySelector('#gate-sig').value = '0000';
  await w.gateSubmit(); await sleep(250);
  expect(w.document.querySelector('#gate-err') && w.document.querySelector('#gate-err').textContent.includes('NOT issued'), 'Wrong passcode blocked server-side');
  w.document.querySelector('#gate-sig').value = CEO_SIG;
  await w.gateSubmit(); await sleep(600);
  const after = [S().receipts.length, S().products.find(p => p.id === 'F002').qty];
  expect(after[0] === before[0] + 1, 'Receipt issued (was ' + before[0] + ', now ' + after[0] + ')');
  expect(after[1] === before[1] - 2, 'Stock decremented server-side (10 → 8)');
  expect(S().receipts[0].no === 'MTK-REC-000000001', 'First real receipt is 000000001');
  console.log('✓ Cash sale signed via server verification — receipt MTK-REC-000000001, stock 10 → 8');

  // ---- 6. credit sale → invoice → payment via API ----
  await api('/api/stock/adjust', { id: 'F002', delta: 6, reason: 'OPENING', email: CEO_EMAIL });
  await w.refreshState(); w.render(); await sleep(150);
  // credit sale through the real API (same endpoint the POS uses; the jsdom
  // harness cannot flip the credit chip because inline handlers can't reach
  // eval-scoped let bindings — this works in every real browser)
  await api('/api/sales', { customerId: cust.customer.id, method: 'credit', items: [['F002', 1]], signedBy: 'CEO', email: CEO_EMAIL });
  await w.refreshState(); await sleep(150);
  const inv = S().invoices.find(v => v.no === 'MTK-INV-000000001');
  expect(inv && inv.paid === 0, 'Credit sale issued invoice MTK-INV-000000001');
  w.go('invoices'); await sleep(80);
  w.invPay('MTK-INV-000000001'); await sleep(120);
  w.signThenPay('MTK-INV-000000001'); await sleep(120);
  w.document.querySelector('#gate-sig').value = CEO_SIG;
  await w.gateSubmit(); await sleep(500);
  expect(S().invoices.find(v => v.no === 'MTK-INV-000000001').paid > 0, 'Invoice paid via API');
  expect(S().receipts.length === 2, 'Payment receipt #2 issued from real payment');
  console.log('✓ Credit sale → invoice 000000001 → payment → receipt 000000002 (all real flows)');

  // ---- 7. documents REQUIRE customer contact (phone OR email) ----
  await apiExpect(400, '/api/docs/issue', { type: 'waybill', signedBy: 'CEO', customer: 'No Contact', contact: '', email: CEO_EMAIL });
  const wb = await api('/api/docs/issue', { type: 'waybill', signedBy: 'CEO', customer: 'Test Buyer', contact: '08033489452', total: 0, hash: 'wb1', email: CEO_EMAIL });
  expect(wb.serial === 1, 'Waybill issues 000000001 (books start at 1)');
  expect(wb.docs && wb.docs[0].customer_contact === '08033489452', 'Contact stored on the document record');
  console.log('✓ Documents reject missing contact; waybill issued with customer phone');

  // ---- 8. MILS logging + TXT import (real CEO/Admin actions) ----
  const ml = await api('/api/mils', { customer_name: 'Kofar Rimi Farms', customer_contact: '08033489452', equipment: '6kg DCP — Naffco', action: 'REFILL', signedBy: 'CEO', email: CEO_EMAIL });
  expect(ml.doc && ml.doc.id, 'MILS job logged via API');
  const imp = await api('/api/products/upsert', { email: CEO_EMAIL, products: [
    { id: 'F002', name: 'BOX FOR BREECHING INLET', qty_on_hand: 8 },
    { id: 'NEW-1', name: 'Smoke Detector — Real Import', category: 'Automation & Surveillance', selling_price: 25000, qty_on_hand: 5 },
  ] });
  await w.refreshState(); await sleep(150);
  expect(imp.upserted === 2 && S().products.length === 359, 'TXT import upserts + adds (358 → 359)');
  console.log('✓ MILS logging + TXT product import work end-to-end');

  // ---- 9. disk persistence ----
  await sleep(300); // debounce
  const dbNow = JSON.parse(fs.readFileSync(path.join(__dirname, '.data', 'db.json'), 'utf8'));
  expect(dbNow.txns.length >= 2, 'Transactions persisted to disk');
  expect(dbNow.products.length === 359, 'Imported catalogue persisted to disk');
  expect(dbNow.receiptsIssue.length === 2, 'Receipts persisted');
  expect(dbNow.mils.length === 1, 'MILS record persisted');
  console.log('✓ Everything persisted server-side (preview/.data/db.json) — refresh-proof');

  // ---- 10. permission matrix (server-enforced roles) ----
  // a Sales account (created through the real Sign Up flow) must not edit stock, seed, or issue freehand docs
  await api('/api/auth/signup', { name: 'Smoke Sales', email: 'sales@mtek.demo', password: 'sales123', signature: '4321', role: 'sales' });
  w.go('stock'); await sleep(60);
  await apiExpect(403, '/api/settings', { reseed: { type: 'receipt', value: 3000 }, email: 'sales@mtek.demo' });
  console.log('✓ Sales cannot seed — reseed rejected (CEO-only)');
  await apiExpect(403, '/api/stock/adjust', { id: 'F002', delta: -1, reason: 'CORRECTION', email: 'sales@mtek.demo' });
  await apiExpect(403, '/api/docs/issue', { type: 'invoice', signedBy: 'Smoke Sales', contact: '080@sales.ng', email: 'sales@mtek.demo' });
  await apiExpect(403, '/api/mils', { customer_name: 'X', equipment: 'Y', email: 'sales@mtek.demo' });
  console.log('✓ Sales blocked from stock edits + freehand documents + MILS (server-side)');
  await api('/api/settings', { reseed: { type: 'receipt', value: 3000 }, email: CEO_EMAIL });
  await w.refreshState(); await sleep(150);
  expect(S().serials.receipt === 3000, 'CEO serial reseed persisted');
  await api('/api/reset', { email: CEO_EMAIL }); await sleep(400);
  await w.refreshState(); await sleep(150);
  expect(S().serials.receipt === 0, 'CEO reset restores zero-start serials');
  console.log('✓ CEO seeds: reseed + reset work against the API');

  // ---- 11. CEO hardcode + signature + registrable lock ----
  const ceo = await api('/api/auth/login', { email: CEO_EMAIL, password: CEO_PASS });
  expect(ceo.user.role === 'ceo', 'CEO email signs in with role ceo');
  const sigOk = await api('/api/auth/signature', { email: CEO_EMAIL, passcode: CEO_SIG });
  expect(sigOk.ok === true, 'CEO signature passcode verified server-side');
  const regBlocked = await apiExpect(400, '/api/auth/signup',
    { name: 'Impostor', email: CEO_EMAIL, password: 'zzzzzz', signature: '9999' });
  expect((regBlocked.error || '').includes('pre-provisioned'), 'CEO email cannot be registered');
  w.go('docs'); await sleep(80);
  await w.setDocsTab('waybill'); await sleep(80);
  expect(w.document.body.innerHTML.includes('Waybill No:'), 'Waybill form renders');
  expect(w.document.body.innerHTML.includes('DELIVERY LOGISTICS'), 'Waybill logistics section renders');
  expect(w.document.body.innerHTML.includes('book starts at 000000001'), 'Waybill zero-start note shown');
  expect(w.document.body.innerHTML.includes('for sending the PDF'), 'Contact field present on document form');
  await w.setDocsTab('deliverynote'); await sleep(80);
  expect(w.document.body.innerHTML.includes('Delivery Note No:'), 'Delivery Note form renders');
  expect(w.document.body.innerHTML.includes('SHIPPING ADDRESS'), 'Delivery Note shipping section renders');
  await w.setDocsTab('receipt'); await sleep(80);
  console.log('✓ CEO hardcoded (mtekfiresafetyltd@gmail.com → role ceo) + contact capture on forms');

  if (errors.length) throw new Error('JS errors: ' + errors.join('; '));
  console.log('\nALL SMOKE TESTS PASSED — real catalogue, real flows, contact-mandatory documents, 0 JS errors');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
