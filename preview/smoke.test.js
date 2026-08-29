/**
 * M-Tek app preview — headless smoke test (jsdom).
 * Run:  cd preview && npm i jsdom && node smoke.test.js
 *
 * Covers: lock screen, login (wrong + correct password), 9 screens,
 * Insights figures, POS sale gated by SIGNATURE PASSCODE (wrong passcode
 * rejected, correct issues + signs receipt + decrements stock), account
 * signup with separate Signature Passcode, invoice payment signing.
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  .replace(/<link[^>]*fonts[^>]*>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/',
  beforeParse(window) { window.localStorage.clear(); } });
const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const errors = [];
dom.window.addEventListener('error', e => errors.push(e.message));
dom.window.eval(js);
const w = dom.window;
const appText = () => w.document.querySelector('#app').textContent;
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---- 1. lock screen ----
expect(w.document.querySelector('#auth .auth-card'), 'Lock screen should show on boot');
console.log('✓ Lock screen: app is gated behind sign-in');

// wrong password rejected
w.document.querySelector('#a-pass').value = 'wrongpass';
w.doLogin();
expect(w.document.querySelector('#a-err').textContent.includes('Wrong password'), 'Wrong password should be rejected');
console.log('✓ Wrong account password rejected');

// correct login
w.document.querySelector('#a-pass').value = 'admin123';
w.doLogin();
expect(w.document.querySelector('#auth').style.display === 'none', 'Auth overlay should hide after login');
expect(appText().length > 100, 'App should render after login');
console.log('✓ Signed in as admin — app shell renders');

// ---- 2. all 9 screens ----
for (const r of ['insights','transactions','customers','receipts','invoices','mils','sales','stock','summary','docs']) {
  w.go(r);
  expect(appText().length > 100, r + ': screen looks empty');
}
console.log('✓ All 9 screens render');

// ---- 3. Insights figures ----
w.go('insights');
for (const e of ['₦319,000', '₦1,762,000', '₦4,001,500', '₦307,808', '₦1,056,000']) {
  expect(appText().includes(e), 'Expected ' + e + ' on Insights');
}
console.log('✓ Insights figures verified (day/week/month/ATV/outstanding)');

// ---- 4. POS sale gated by Signature Passcode ----
w.go('sales');
w.cartQty('F002', 2);
w.cartQty('SRV-1', 1);
w.document.querySelector('#pos-cust').value = 'C003';
w.document.querySelector('#pos-cust').dispatchEvent(new w.Event('change'));
const receiptsBefore = w.eval('__mtek().receipts.length');
const txnsBefore = w.eval('__mtek().txns.length');
w.completeSale();
expect(w.document.querySelector('#gate-sig'), 'Signature gate should appear before issuing sale');
// wrong signature passcode → NOT issued
w.document.querySelector('#gate-sig').value = '0000';
w.gateSubmit();
expect(w.document.querySelector('#gate-err').textContent.includes('NOT issued'), 'Wrong signature passcode must block the document');
expect(w.eval('__mtek().receipts.length') === receiptsBefore, 'No receipt should be issued on failed signature');
console.log('✓ Wrong SIGNATURE PASSCODE rejected — sale not issued');
// correct passcode → issued + signed
w.document.querySelector('#gate-sig').value = '1234';
w.gateSubmit();
expect(w.eval('__mtek().receipts.length') === receiptsBefore + 1, 'Receipt should be issued after signing');
expect(w.eval('__mtek().txns.length') === txnsBefore + 1, 'Transaction should post after signing');
expect(w.eval('__mtek().receipts.slice(-1)[0].signed') === 'Admin', 'Receipt should carry digital signature');
expect(w.eval("__mtek().products.find(p => p.id === 'F002').qty") === 22, 'Stock should decrement 24 → 22');
console.log('✓ Sale signed by Admin — receipt issued, stock 24 → 22');

// receipt preview shows the signature stamp
w.go('receipts');
w.receiptPreview(w.eval('__mtek().receipts.slice(-1)[0].no'));
expect(w.document.querySelector('#modal .stamp').textContent.includes('Digitally signed by Admin'), 'Receipt should show digital signature stamp');
console.log('✓ Receipt preview shows “Digitally signed by …” stamp');

// ---- 5. signup creates account with SEPARATE signature passcode ----
w.signOut();
expect(w.document.querySelector('#auth .auth-card'), 'Lock screen should return after sign-out');
w.renderAuth('signup');
w.document.querySelector('#a-name').value = 'Ibrahim Kabeer';
w.document.querySelector('#a-email').value = 'ibrahim@mtek.demo';
w.document.querySelector('#a-pass').value = 'field123';
w.document.querySelector('#a-sig').value = 'field123'; // same as password — must be rejected
w.document.querySelector('#a-sig2').value = 'field123';
w.doSignup();
expect(w.document.querySelector('#a-err').textContent.includes('must be different'), 'Signature passcode equal to password must be rejected');
w.document.querySelector('#a-sig').value = '9999';
w.document.querySelector('#a-sig2').value = '9999';
w.doSignup();
expect(w.eval('__mtek().currentUser().name') === 'Ibrahim Kabeer', 'Signup should sign the new user in');
expect(w.eval('__mtek().currentUser().role') === 'admin', 'Role picker should apply (admin default)');
console.log('✓ Signup enforces Signature Passcode ≠ password; account created');

// new user signs with HIS OWN passcode
w.go('sales');
w.cartQty('H001', 1);
w.document.querySelector('#pos-cust').value = 'C004';
w.document.querySelector('#pos-cust').dispatchEvent(new w.Event('change'));
w.completeSale();
w.document.querySelector('#gate-sig').value = '1234'; // admin's passcode — must fail for this user
w.gateSubmit();
expect(w.document.querySelector('#gate-err').textContent.includes('NOT issued'), "Another user's passcode must not sign");
w.document.querySelector('#gate-sig').value = '9999';
w.gateSubmit();
expect(w.eval('__mtek().receipts.slice(-1)[0].signed') === 'Ibrahim Kabeer', 'Receipt should be signed by the new user');
console.log('✓ Per-user signature passcodes verified — Ibrahim signed with his own');

// ---- 6. invoice payment is gated too ----
w.go('invoices');
w.invPay('MTK-INV-0003');
w.signThenPay('MTK-INV-0003');
expect(w.document.querySelector('#gate-sig'), 'Invoice payment should require signature');
w.document.querySelector('#gate-sig').value = '9999';
w.gateSubmit();
expect(w.eval('__mtek().invoices.find(v => v.no === "MTK-INV-0003").paid') > 0, 'Invoice should record payment after signing');
expect(w.eval('__mtek().receipts.slice(-1)[0].for') === 'MTK-INV-0003', 'Payment receipt should reference the invoice');
console.log('✓ Invoice payment signed — transaction + receipt posted');

// ---- 7. Document generator (Phase A) ----
w.go('docs');
expect(appText().includes('Payment Receipt'), 'Docs screen should render');
const DS = w.__docsState; // live reference to the generator form state
const before = w.eval('peekSerial("receipt")');
DS.receipt.name = 'Test Client';
DS.receipt.amount = 45000;
w.generateDoc();
expect(w.document.querySelector('#gate-sig'), 'Generation should require signature');
w.document.querySelector('#gate-sig').value = '9999'; // Ibrahim's passcode (he is signed in)
w.gateSubmit();
expect(w.document.querySelector('.doc-sheet').textContent.includes('No:' + before),
    'Issued serial should be the next paper-book number (' + before + ')');
const after = w.eval('peekSerial("receipt")');
expect(after === before + 1, 'Serial counter should have advanced by exactly 1');
expect(w.document.querySelector('.doc-sheet'), 'Watermarked paper preview should render');
expect(w.document.querySelector('.doc-sheet .banner').textContent.includes('PAYMENT RECEIPT'), 'Receipt banner should mirror the book');
expect(w.document.querySelector('.ds-signed').textContent.includes('Digitally signed by'), 'Signature stamp should appear');
expect(w.document.querySelector('.doc-sheet .corp-serv').textContent.includes('BRANCH OFFICE'), 'Dual-office header should be present');
console.log('✓ Generator: gated PDF flow, serial ' + after + ' continues book 2131, watermarked preview + dual-office header');

// wrong passcode blocks invoice generation
DS.invoice.name = 'Test Co';
DS.invoice.rows = [{ d: 'DCP 6kg', q: 2, r: 55000 }];
w.__setDocsTab('invoice');
w.generateDoc();
w.document.querySelector('#gate-sig').value = '0000';
w.gateSubmit();
expect(w.document.querySelector('#gate-err').textContent.includes('NOT issued'), 'Wrong passcode must block invoice generation');
console.log('✓ Wrong passcode blocks invoice generation');

if (errors.length) throw new Error('JS errors: ' + errors.join('; '));
console.log('\nALL SMOKE TESTS PASSED — auth + signature passcode + 9 screens + document flows, 0 JS errors');
