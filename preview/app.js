/* M-Tek Inventory — design preview logic.
   Mirrors app/lib/data/sample_store.dart (same dataset, same derived math). */

// ---------- sample data (identical numbers to the Flutter store) ----------
const CATS = { Fire: 'Fire', Safety: 'Safety', Security: 'Security', Solar: 'Solar', Automation: 'Automation & Surveillance' };
const CAT_COLOR = { Fire: '#c8102e', Safety: '#f0a92e', Security: '#1a2a4a', Solar: '#15803d', Automation: '#ff5b66' };
const METHOD_META = { cash: ['💵', 'Cash'], transfer: ['🏦', 'Transfer'], pos: ['🏧', 'POS'], credit: ['🧾', 'Credit'] };

const products = [
  { id: 'F002', name: 'BOX FOR 6KG FIRE EXTINGUISHER', cat: 'Fire', cost: 38000, price: 55000, qty: 24, reorder: 10, unit: 'pcs' },
  { id: 'F003', name: 'BOX FOR 9KG FIRE EXTINGUISHER', cat: 'Fire', cost: 45000, price: 65000, qty: 12, reorder: 8, unit: 'pcs' },
  { id: 'F008', name: 'BREATHING APPARATUS', cat: 'Fire', cost: 260000, price: 350000, qty: 4, reorder: 2, unit: 'pcs' },
  { id: 'S003', name: 'BODY HARNESS', cat: 'Safety', cost: 34000, price: 50000, qty: 18, reorder: 6, unit: 'pcs' },
  { id: 'S005', name: 'CAUTION CONE (75CM)', cat: 'Safety', cost: 10000, price: 16000, qty: 40, reorder: 15, unit: 'pcs' },
  { id: 'S008', name: 'COMPLETE OVERALL', cat: 'Safety', cost: 15500, price: 23000, qty: 9, reorder: 12, unit: 'pcs' },
  { id: 'Q002', name: 'WALK-THROUGH METAL DETECTOR GATE', cat: 'Security', cost: 500000, price: 680000, qty: 2, reorder: 1, unit: 'unit' },
  { id: 'L011', name: '30AHS CHARGE CONTROLLER', cat: 'Solar', cost: 13500, price: 20000, qty: 14, reorder: 5, unit: 'pcs' },
  { id: 'L012', name: '30 WATTS LED SOLAR LIGHT', cat: 'Solar', cost: 17000, price: 25000, qty: 3, reorder: 8, unit: 'pcs' },
  { id: 'H001', name: 'BAOFENG TWO WAY RADIO BF-7775', cat: 'Automation', cost: 12000, price: 18000, qty: 30, reorder: 10, unit: 'pcs' },
  { id: 'H006', name: 'BELL (24 VDC CHLORIDE UK)', cat: 'Automation', cost: 9800, price: 15000, qty: 11, reorder: 5, unit: 'pcs' },
  { id: 'SRV-1', name: 'DCP 6KG REFILL SERVICE', cat: 'Fire', cost: 3000, price: 7500, qty: 0, reorder: 0, unit: 'job', service: true },
];
const P = Object.fromEntries(products.map(p => [p.id, p]));

const customers = [
  { id: 'C001', name: 'Nigerian Breweries — Kaduna Depot', corp: true, phone: '+234 803 415 2288', balance: 360000 },
  { id: 'C002', name: 'Kaduna Refining & Petrochemical Co.', corp: true, phone: '+234 803 552 0117', balance: 300000 },
  { id: 'C003', name: 'Alhaji Musa Ibrahim', corp: false, phone: '+234 806 113 4478', balance: 0 },
  { id: 'C004', name: 'Engr. Chuka Okafor', corp: false, phone: '+234 802 930 5561', balance: 0 },
  { id: 'C005', name: 'Mrs. Grace Adeyemi', corp: false, phone: '+234 805 780 2234', balance: 0 },
  { id: 'C006', name: 'Barr. Sani Bello', corp: false, phone: '+234 807 442 8890', balance: 396000 },
];
const C = Object.fromEntries(customers.map(c => [c.id, c]));

const sales = [
  { id: 'S001', day: 2, hour: 10, cust: 'C003', method: 'cash', items: [['F002', 2], ['SRV-1', 1]] },
  { id: 'S002', day: 5, hour: 11, cust: 'C001', method: 'transfer', items: [['S003', 4]] },
  { id: 'S003', day: 8, hour: 14, cust: 'C005', method: 'pos', items: [['L012', 1], ['L011', 1]] },
  { id: 'S005', day: 14, hour: 10, cust: 'C004', method: 'transfer', items: [['Q002', 1]] },
  { id: 'S006', day: 18, hour: 12, cust: 'C003', method: 'cash', items: [['S005', 6]] },
  { id: 'S007', day: 22, hour: 15, cust: 'C005', method: 'transfer', items: [['H001', 2], ['H006', 1]] },
  { id: 'S008', day: 26, hour: 11, cust: 'C001', method: 'pos', items: [['S005', 10], ['S003', 5]] },
  { id: 'S009', day: 28, hour: 13, cust: 'C004', method: 'cash', items: [['L011', 2], ['L012', 1]] },
  { id: 'S010', day: 29, hour: 10, cust: 'C003', method: 'transfer', items: [['F003', 1], ['F002', 2]] },
  { id: 'S011', day: 29, hour: 11, cust: 'C005', method: 'cash', items: [['H001', 3]] },
  { id: 'S012', day: 29, hour: 13, cust: 'C002', method: 'cash', items: [['SRV-1', 12]] },
];

const invoices = [
  { no: 'MTK-INV-0001', issued: 11, due: 25, cust: 'C002', items: [['F008', 3]], paid: 1050000 },
  { no: 'MTK-INV-0002', issued: 14, due: 28, cust: 'C001', items: [['Q002', 2]], paid: 1000000 },
  { no: 'MTK-INV-0003', issued: 19, due: '2 Sep 2026', cust: 'C002', items: [['SRV-1', 40]], paid: 0 },
  { no: 'MTK-INV-0004', issued: 5, due: 19, cust: 'C006', items: [['F008', 1], ['S008', 2]], paid: 0 },
];

// chronological payments (sale payments + invoice payments + refunds)
const txns = [
  { d: '2 Aug, 10:20', type: 'sale', amt: 117500, m: 'cash', ref: 'S001' },
  { d: '5 Aug, 11:05', type: 'sale', amt: 200000, m: 'transfer', ref: 'S002' },
  { d: '8 Aug, 14:12', type: 'sale', amt: 45000, m: 'pos', ref: 'S003' },
  { d: '14 Aug, 10:44', type: 'sale', amt: 680000, m: 'transfer', ref: 'S005' },
  { d: '18 Aug, 12:30', type: 'sale', amt: 96000, m: 'cash', ref: 'S006' },
  { d: '20 Aug, 09:15', type: 'invoice', amt: 1050000, m: 'transfer', ref: 'MTK-INV-0001' },
  { d: '22 Aug, 15:02', type: 'sale', amt: 51000, m: 'transfer', ref: 'S007' },
  { d: '24 Aug, 10:08', type: 'invoice', amt: 1000000, m: 'transfer', ref: 'MTK-INV-0002' },
  { d: '24 Aug, 16:40', type: 'refund', amt: -32000, m: 'cash', ref: 'Return — S006 (2× caution cone)' },
  { d: '26 Aug, 11:26', type: 'sale', amt: 410000, m: 'pos', ref: 'S008' },
  { d: '28 Aug, 13:51', type: 'sale', amt: 65000, m: 'cash', ref: 'S009' },
  { d: '29 Aug, 10:14', type: 'sale', amt: 175000, m: 'transfer', ref: 'S010' },
  { d: '29 Aug, 11:37', type: 'sale', amt: 54000, m: 'cash', ref: 'S011' },
  { d: '29 Aug, 13:09', type: 'sale', amt: 90000, m: 'cash', ref: 'S012' },
];
txns.forEach((t, i) => (t.id = 'TXN-' + String(i + 1).padStart(4, '0')));

// receipts mirror txns 1:1 (same order)
const receipts = txns.map((t, i) => ({
  no: 'MTK-REC-' + String(i + 1).padStart(4, '0'),
  d: t.d, amt: Math.abs(t.amt), m: t.m, signed: 'Admin',
  cust: t.ref.startsWith('MTK-INV')
    ? C[invoices.find(v => v.no === t.ref).cust].name
    : (t.type === 'refund' ? C.C003.name : C[sales.find(s => s.id === t.ref).cust].name),
  for: t.ref, by: 'Admin',
}));

const mils = [
  { id: 'MTK-MILS-0001', date: '6 Aug', equip: 'DCP 6kg Fire Extinguisher ×24', serial: 'DCP6-2026-118', client: 'Nigerian Breweries — Kaduna Depot', loc: 'Depot yard, stations 1–12', action: 'REFILL', tech: 'Ibrahim Kabeer', next: '6 Feb 2027', overdue: false, findings: '12 units at zero pressure, valves replaced' },
  { id: 'MTK-MILS-0002', date: '12 Aug', equip: 'Maxlogic 2-Zone Fire Alarm Panel', serial: 'FAP-ML2-0091', client: 'Kaduna Refining & Petrochemical Co.', loc: 'Control room, block B', action: 'INSPECTION', tech: 'Sunday Ademola', next: '12 Nov 2026', overdue: false, findings: 'Zone 2 detector sensitivity low; battery OK' },
  { id: 'MTK-MILS-0003', date: '15 Aug', equip: 'Flame Fighting Hose Reel + Cabinet', client: 'Barr. Sani Bello', loc: 'Residence, Barnawa', action: 'INSTALLATION', tech: 'Ibrahim Kabeer', next: '15 Aug 2027', overdue: false, findings: 'New install; pressure test passed' },
  { id: 'MTK-MILS-0004', date: '20 Aug', equip: 'CCTV (8ch DVR, 6 cameras)', serial: 'DVR8-5521', client: 'Mrs. Grace Adeyemi', loc: 'Shop plaza, Kawo', action: 'REPAIR', tech: 'Sunday Ademola', next: '20 Feb 2027', overdue: false, findings: 'Cam 3 lens condensation; replaced' },
  { id: 'MTK-MILS-0005', date: '25 Aug', equip: 'Walk-Through Metal Detector Gate', serial: 'WTMD-Q2-011', client: 'Nigerian Breweries — Kaduna Depot', loc: 'Main gate', action: 'CALIBRATION', tech: 'Musa Danjuma', next: '28 Aug 2026', overdue: true, findings: 'Sensitivity re-calibrated; zone 4 sensor drifting' },
  { id: 'MTK-MILS-0006', date: '29 Aug', equip: 'Solar Inverter 3kVA + 200Ah Battery', serial: 'INV3K-88412', client: 'Mrs. Grace Adeyemi', loc: 'Residence, Ungwan Rimi', action: 'INSPECTION', tech: 'Musa Danjuma', next: '29 Nov 2026', overdue: false, findings: 'Battery water topped up; panels cleaned' },
];

const adjustments = [
  { id: 'ADJ-1', d: '10 Aug', pid: 'F002', delta: 24, reason: 'RESTOCK', note: 'PO-2214 — Bajik supply' },
  { id: 'ADJ-2', d: '16 Aug', pid: 'S005', delta: -2, reason: 'DAMAGE', note: 'Crushed in storage' },
  { id: 'ADJ-3', d: '21 Aug', pid: 'S003', delta: 6, reason: 'RESTOCK', note: 'PO-2220' },
  { id: 'ADJ-4', d: '25 Aug', pid: 'H006', delta: -1, reason: 'CORRECTION', note: 'Shelf count correction' },
];

// ---------- derived math (same as SampleStore) ----------
const naira = n => '₦' + Math.round(n).toLocaleString('en-NG');
const nairaC = n => n >= 1e6 ? `₦${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `₦${Math.round(n / 1e3)}K` : `₦${n}`;
const TODAY = { label: '29 Aug 2026', day: 29 };
const isToday = d => d.startsWith('29 Aug');
const isThisWeek = d => /^(24|25|26|27|28|29) Aug/.test(d);

const revAll = () => txns.reduce((s, t) => s + t.amt, 0);
const revToday = () => txns.filter(t => isToday(t.d)).reduce((s, t) => s + t.amt, 0);
const revWeek = () => txns.filter(t => isThisWeek(t.d)).reduce((s, t) => s + t.amt, 0);
const atv = () => Math.round(revAll() / txns.filter(t => t.type !== 'refund').length);
const saleTotal = s => s.items.reduce((sum, [pid, q]) => sum + P[pid].price * q, 0);
const invTotal = v => v.items.reduce((sum, [pid, q]) => sum + P[pid].price * q, 0);
const outstanding = () => invoices.reduce((s, v) => s + (invTotal(v) - v.paid), 0);
const stockValue = () => products.reduce((s, p) => s + (p.service ? 0 : p.cost * p.qty), 0);
const profitAll = () => sales.filter(s => s.method !== 'credit').reduce((sum, s) => sum + s.items.reduce((x, [pid, q]) => x + (P[pid].price - P[pid].cost) * q, 0), 0);
const profitSince = day => sales.filter(s => s.method !== 'credit' && s.day >= day).reduce((sum, s) => sum + s.items.reduce((x, [pid, q]) => x + (P[pid].price - P[pid].cost) * q, 0), 0);
const revSince = day => txns.filter(t => parseInt(t.d) >= day).reduce((s, t) => s + t.amt, 0);

function revByCat() {
  const paidRefs = new Set(txns.filter(t => t.type !== 'refund').map(t => t.ref));
  const out = {};
  sales.forEach(s => {
    const paid = paidRefs.has(s.id);
    s.items.forEach(([pid, q]) => {
      const p = P[pid];
      out[p.cat] = (out[p.cat] || 0) + (paid ? p.price * q : 0);
    });
  });
  invoices.forEach(v => {
    const paidPart = v.paid, total = invTotal(v);
    if (paidPart > 0) {
      const share = paidPart / total;
      v.items.forEach(([pid, q]) => {
        out[P[pid].cat] = (out[P[pid].cat] || 0) + Math.round(P[pid].price * q * share);
      });
    }
  });
  return out;
}
function revByMethod() {
  const out = {};
  txns.filter(t => t.type !== 'refund').forEach(t => (out[t.m] = (out[t.m] || 0) + t.amt));
  return out;
}
function topProducts(limit = 5) {
  const out = {};
  const qty = {};
  sales.forEach(s => s.items.forEach(([pid, q]) => {
    out[P[pid].name] = (out[P[pid].name] || 0) + P[pid].price * q;
    qty[P[pid].name] = (qty[P[pid].name] || 0) + q;
  }));
  return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([name, v]) => [`${name} ×${qty[name]}`, v]);
}

// ---------- tiny framework ----------
const $ = sel => document.querySelector(sel);
const app = $('#app');
let route = 'insights';

const NAV = [
  ['insights', '📊', 'Insights'], ['transactions', '🔁', 'Transactions'], ['customers', '👥', 'Customers'],
  ['receipts', '🧾', 'Receipts'], ['invoices', '📑', 'Invoices'], ['mils', '🛠️', 'MILS'],
  ['sales', '🛒', 'Sales'], ['stock', '📦', 'Stock'], ['summary', '📈', 'Summary'],
  ['docs', '📝', 'Documents'],
];
const SUBTITLES = {
  insights: 'Money in — today, this week, this month',
  transactions: 'Every naira in and out — one ledger',
  customers: 'Individuals & corporate clients, credit at a glance',
  receipts: 'Auto-issued when money is received',
  invoices: 'Bill now, pay later — corporate clients',
  mils: 'Maintenance Information Log Sheet — next-due tracking',
  sales: 'Pick items — stock & receipts update automatically',
  stock: 'Quantities, prices, low-stock alerts, audit trail',
  summary: 'Business report — export or share as PDF (M4)',
  docs: 'Write up a Receipt, Invoice or MILS sheet — PDF mirrors your paper books',
};

function render() {
  const screens = {
    insights, transactions, customers: customersScreen, receipts: receiptsScreen,
    invoices: invoicesScreen, mils: milsScreen, sales: salesScreen,
    stock: stockScreen, summary: summaryScreen, docs: docsScreen,
  };
  const body = screens[route]();
  app.innerHTML = `
    <div class="pagehead">
      <div><h1>${NAV.find(n => n[0] === route)[2]}</h1><p>${SUBTITLES[route]}</p></div>
      <div class="actions">${routeButtons()}</div>
    </div>
    ${body}`;
  app.classList.toggle('has-pos', route === 'sales');
  if (route === 'sales') bindPos();
  if (route === 'stock') bindStockSearch();
  if (route === 'customers') bindCustSearch();
}

function routeButtons() {
  if (route === 'customers') return `<button class="btn primary" onclick="newCustomer()">＋ New customer</button>`;
  if (route === 'invoices') return `<button class="btn primary" onclick="toast('New invoice — full builder arrives in M2')">＋ New invoice</button>`;
  if (route === 'mils') return `<button class="btn primary" onclick="toast('MILS entry form — M2 (stored as Mongo documents in M3)')">＋ Log service</button>`;
  if (route === 'stock') return `<button class="btn ghost" onclick="toast('Opens the products_seed.txt importer in M2')">⬆ Import TXT</button>`;
  if (route === 'summary') return `<button class="btn ghost" onclick="toast('PDF export & share — Milestone M4')">⤓ Export PDF</button>`;
  if (route === 'docs') return `<button class="btn ghost" onclick="toast('Serial counters are Admin-seedable in Settings (M2) — continuing paper books: 2131 / 925 / 4335')">#️⃣ Serials</button>`;
  return '';
}

// ---------- screens ----------
function statCards() {
  return `<div class="grid cols-3">
    ${stat('📅', 'Revenue — today', naira(revToday()), TODAY.label, '#c8102e')}
    ${stat('🗓️', 'Revenue — this week', naira(revWeek()), 'Mon 24 – Sat 29 Aug', '#1a2a4a')}
    ${stat('📆', 'Revenue — this month', naira(revAll()), 'Net of refunds', '#f0a92e')}
    ${stat('📈', 'Avg. transaction value', naira(atv()), 'Net revenue ÷ paying txns', '#15803d')}
    ${stat('⏳', 'Outstanding invoices', naira(outstanding()), 'Credit to collect', '#b45309')}
    ${stat('📦', 'Stock value (cost)', naira(stockValue()), `${products.filter(p => !p.service).length} physical items`, '#1a2a4a')}
  </div>`;
}
const stat = (ic, lbl, val, hint, color) => `
  <div class="card stat">
    <div class="row"><div class="ic" style="background:${color}18;color:${color}">${ic}</div><div class="lbl">${lbl}</div></div>
    <div class="val">${val}</div>${hint ? `<div class="hint">${hint}</div>` : ''}
  </div>`;

function donut(data) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  let a0 = -90;
  const segs = Object.entries(data).map(([k, v]) => {
    const ang = (v / total) * 360;
    const a1 = a0 + ang;
    const large = ang > 180 ? 1 : 0;
    const r = 70, cx = 90, cy = 90;
    const x0 = cx + r * Math.cos((a0 * Math.PI) / 180), y0 = cy + r * Math.sin((a0 * Math.PI) / 180);
    const x1 = cx + r * Math.cos(((a1 - 0.6) * Math.PI) / 180), y1 = cy + r * Math.sin(((a1 - 0.6) * Math.PI) / 180);
    const seg = `<path d="M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}" stroke="${CAT_COLOR[k]}" stroke-width="26" fill="none"/>`;
    a0 = a1;
    return seg;
  }).join('');
  return `<svg viewBox="0 0 180 180" width="185" height="185">${segs}
    <text x="90" y="86" text-anchor="middle" class="donut-center">${nairaC(total)}</text>
    <text x="90" y="102" text-anchor="middle" class="donut-sub">total revenue</text>
  </svg>`;
}

function insights() {
  const byCat = revByCat(), byMethod = revByMethod();
  const mTotal = Object.values(byMethod).reduce((a, b) => a + b, 0) || 1;
  return `
    ${statCards()}
    <div class="section-lbl">REVENUE BREAKDOWN</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;align-items:start">
      <div class="card" style="padding:18px">
        <b>By category</b>
        <div class="donut-wrap" style="margin-top:14px">
          ${donut(byCat)}
          <div class="legend">
            ${Object.entries(byCat).map(([k, v]) =>
              `<div class="li"><span class="dot" style="background:${CAT_COLOR[k]}"></span>${CATS[k]} — <b>&nbsp;${nairaC(v)}</b></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card" style="padding:18px">
        <b>By payment method</b>
        <div style="margin-top:16px">
          ${Object.entries(byMethod).map(([m, v]) => `
            <div class="bar-row">
              <div style="display:flex;align-items:center;gap:8px;font-size:13px">
                <span>${METHOD_META[m][0]}</span><b>${METHOD_META[m][1]}</b>
                <span style="flex:1"></span><span class="money" style="font-size:13px">${naira(v)}</span>
                <span style="color:var(--gray-500);font-size:11.5px">${Math.round(v / mTotal * 100)}%</span>
              </div>
              <div class="progress"><i style="width:${(v / mTotal * 100).toFixed(1)}%"></i></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

let txnFilter = 'all';
function transactions() {
  const rows = txns.slice().reverse().filter(t => txnFilter === 'all' ||
    (txnFilter === 'sales' && t.type === 'sale') ||
    (txnFilter === 'invoices' && t.type === 'invoice') ||
    (txnFilter === 'refunds' && t.type === 'refund'));
  return `
    <div class="chiprow" style="margin-bottom:10px">
      ${[['all', 'All'], ['sales', 'Sale payments'], ['invoices', 'Invoice payments'], ['refunds', 'Refunds']]
        .map(([k, l]) => `<button class="fchip ${txnFilter === k ? 'active' : ''}" onclick="txnFilter='${k}';render()">${l}</button>`).join('')}
    </div>
    <div class="card list">
      ${rows.map(t => `
        <div class="item" onclick="txnDetail('${t.id}')">
          <div class="avatar" style="background:${t.type === 'refund' ? 'var(--danger-tint);color:var(--danger)' : 'var(--brand-tint);color:var(--brand-600)'}">${t.type === 'refund' ? '↩' : '↓'}</div>
          <div class="grow">
            <div class="t">${t.type === 'refund' ? 'Refund' : t.type === 'sale' ? 'Sale payment — ' + t.ref : 'Invoice payment — ' + t.ref}</div>
            <div class="s">${t.d} · ${METHOD_META[t.m][1]} · ${t.id}</div>
          </div>
          <div class="money ${t.amt < 0 ? 'neg' : 'pos'}">${naira(t.amt)}</div>
        </div>`).join('')}
    </div>`;
}
window.txnDetail = id => {
  const t = txns.find(x => x.id === id);
  modal(`${t.id}`, `
    <div class="kv"><b>Type</b><span>${t.type === 'refund' ? 'Refund' : t.type === 'sale' ? 'Sale payment' : 'Invoice payment'}</span></div>
    <div class="kv"><b>Amount</b><span>${naira(t.amt)}</span></div>
    <div class="kv"><b>Method</b><span>${METHOD_META[t.m][1]}</span></div>
    <div class="kv"><b>Date</b><span>${t.d} · 2026</span></div>
    <div class="kv"><b>Reference</b><span>${t.ref}</span></div>
    <div class="kv"><b>Ledger</b><span>Mirrors to Supabase <code>transactions</code> in M3</span></div>`);
};

let custQuery = '';
function customersScreen() {
  const rows = customers.filter(c => c.name.toLowerCase().includes(custQuery.toLowerCase()));
  return `
    <input class="search" id="custq" placeholder="Search customers…" value="${custQuery}">
    <div class="card list">
      ${rows.map(c => `
        <div class="item" onclick="custDetail('${c.id}')">
          <div class="avatar" style="background:${c.corp ? 'var(--navy-800)' : 'var(--brand-600)'}">${initials(c.name)}</div>
          <div class="grow">
            <div class="t">${c.name}</div>
            <div class="s">${c.corp ? 'Corporate' : 'Individual'} · ${c.phone}</div>
          </div>
          ${c.balance > 0 ? `<span class="chip bad">Credit ${nairaC(c.balance)}</span>` : `<span class="chip">No dues</span>`}
        </div>`).join('')}
    </div>`;
}
const initials = n => n.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
window.custDetail = id => {
  const c = C[id];
  const hist = sales.filter(s => s.cust === id);
  modal(c.name, `
    <div class="kv"><b>Type</b><span>${c.corp ? 'Corporate' : 'Individual'}</span></div>
    <div class="kv"><b>Phone</b><span>${c.phone}</span></div>
    <div class="kv"><b>Credit balance</b><span>${naira(c.balance)}</span></div>
    <div class="section-lbl" style="margin-top:10px">PURCHASE HISTORY (${hist.length})</div>
    ${hist.length ? hist.map(s => `
      <div class="kv"><b>${s.day} Aug</b><span style="flex:1">${s.items.map(([pid, q]) => `${P[pid].name} ×${q}`).join(', ')}</span><span class="money" style="font-size:12.5px">${naira(saleTotal(s))}</span></div>`).join('')
      : '<div class="empty">No purchases yet</div>'}`);
};
function bindCustSearch() {
  const el = $('#custq');
  if (el) el.addEventListener('input', e => { custQuery = e.target.value; const pos = el.selectionStart; render(); const n = $('#custq'); n.focus(); n.setSelectionRange(pos, pos); });
}
window.newCustomer = () => toast('New customer form — fully editable in M2 (Supabase `customers` in M3)');

function receiptsScreen() {
  return `<div class="card list">
    ${receipts.slice().reverse().map(r => `
      <div class="item" onclick="receiptPreview('${r.no}')">
        <div class="avatar" style="background:var(--success-tint);color:var(--success)">🧾</div>
        <div class="grow">
          <div class="t">${r.no} — ${r.cust}</div>
          <div class="s">${r.d} · ${METHOD_META[r.m][1]} · for ${r.for} · by ${r.by}</div>
        </div>
        <div class="money">${naira(r.amt)}</div>
        <button class="btn ghost sm" onclick="event.stopPropagation();receiptPreview('${r.no}')">👁 Preview</button>
      </div>`).join('')}
  </div>`;
}
window.receiptPreview = no => {
  const r = receipts.find(x => x.no === no);
  modal('OFFICIAL RECEIPT', `
    <div class="receipt-head">
      <div class="lg">M</div>
      <div><b style="font-size:13.5px">M-TEK FIRE & SAFETY LTD</b><div style="font-size:11px;color:var(--gray-500)">Kaduna, Nigeria · RC 1082534</div></div>
    </div>
    <div style="font-size:11px;letter-spacing:2px;color:var(--brand-600);font-weight:700">OFFICIAL RECEIPT</div>
    <div style="font-weight:800;font-size:20px">${r.no}</div>
    <div class="kv" style="margin-top:10px"><b>Received from</b><span>${r.cust}</span></div>
    <div class="kv"><b>Date</b><span>${r.d} · 2026</span></div>
    <div class="kv"><b>Being payment for</b><span>${r.for}</span></div>
    <div class="kv"><b>Method</b><span>${METHOD_META[r.m][1]}</span></div>
    <div class="receipt-amt">TOTAL: ${naira(r.amt)}</div>
    <div class="stamp">✓ Digitally signed by ${r.signed || r.by} — ${r.d} · 2026
    </div>
    ${(users.find(u => u.name === (r.signed || r.by)) || {}).signaturePng ? `<img class="stamp" src="${users.find(u => u.name === (r.signed || r.by)).signaturePng}" style="margin:4px 0 8px">` : ''}
    <div style="font-size:11px;color:var(--gray-500)">Issued by: ${r.by} — thank you for your business. VAT configurable per document (M2 setting).</div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn ghost sm" style="flex:1" onclick="toast('Sharing via wa.me — wired in M4')">💬 WhatsApp</button>
      <button class="btn ghost sm" style="flex:1" onclick="toast('mailto: share — wired in M4')">✉ Email</button>
      <button class="btn primary sm" style="flex:1" onclick="toast('Print dialog — wired in M4')">🖨 Print</button>
    </div>`);
};

let invFilter = 'all';
function invoicesScreen() {
  const now = 29;
  return `<div class="card list">
    ${invoices.slice().reverse().map(v => {
      const total = invTotal(v), bal = total - v.paid;
      const overdue = bal > 0 && typeof v.due === 'number' && v.due < now;
      const status = bal <= 0 ? ['PAID', 'paid'] : overdue ? ['OVERDUE', 'bad'] : v.paid > 0 ? ['PARTIAL', 'pending'] : ['UNPAID', ''];
      return `
      <div class="item" onclick="invPay('${v.no}')">
        <div class="avatar" style="background:var(--brand-tint);color:var(--brand-600)">📑</div>
        <div class="grow">
          <div class="t">${v.no} — ${C[v.cust].name}</div>
          <div class="s">Issued ${v.issued} Aug · Due ${typeof v.due === 'number' ? v.due + ' Aug' : v.due}</div>
          <div class="progress"><i style="width:${(v.paid / total * 100).toFixed(0)}%;background:${bal <= 0 ? 'var(--success)' : 'var(--brand-600)'}"></i></div>
        </div>
        <div style="text-align:right">
          <span class="chip ${status[1]}">${status[0]}</span>
          <div class="money" style="margin-top:5px;font-size:13px">${naira(total)}</div>
          ${bal > 0 ? `<div style="font-size:11px;color:var(--danger)">Balance ${nairaC(bal)}</div>` : ''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}
window.invPay = no => {
  const v = invoices.find(x => x.no === no);
  const bal = invTotal(v) - v.paid;
  if (bal <= 0) return toast(`${no} is fully paid — receipt already issued.`);
  modal(`Record payment — ${no}`, `
    <div class="kv"><b>Customer</b><span>${C[v.cust].name}</span></div>
    <div class="kv"><b>Invoice total</b><span>${naira(invTotal(v))}</span></div>
    <div class="kv"><b>Balance</b><span>${naira(bal)}</span></div>
    <p style="font-size:12.5px;color:var(--gray-500);margin:10px 0 16px">Recording a payment posts a <b>Transaction</b>, issues a <b>Receipt</b> (MTK-REC-…) and clears credit on the customer — automatically.</p>
    <button class="btn primary" style="width:100%" onclick="signThenPay('${no}')">✍️ Continue — sign &amp; record payment</button>`);
};
window.signThenPay = no => {
  const v = invoices.find(x => x.no === no);
  const bal = invTotal(v) - v.paid;
  signGate(`Payment of ${naira(bal)} on ${no} (${C[v.cust].name})`, () => doInvPay(no));
};
window.doInvPay = no => {
  const signer = currentUser().name;
  const v = invoices.find(x => x.no === no);
  const bal = invTotal(v) - v.paid;
  v.paid += bal;
  const cust = customers.find(c => c.id === v.cust);
  cust.balance -= bal;
  txns.push({ id: 'TXN-' + String(txns.length + 1).padStart(4, '0'), d: '29 Aug, 14:0' + txns.length, type: 'invoice', amt: bal, m: 'transfer', ref: no });
  receipts.push({ no: 'MTK-REC-' + String(receipts.length + 1).padStart(4, '0'), d: '29 Aug, 14:0' + (txns.length - 1), amt: bal, m: 'transfer', cust: cust.name, for: no, by: signer, signed: signer });
  closeModal();
  toast(`Payment recorded — receipt issued to ${cust.name}, signed by ${signer}.`, 'success');
  render();
};

const ACTION_IC = { REFILL: '🔥', INSTALLATION: '🔧', INSPECTION: '✅', REPAIR: '🛠', CALIBRATION: '🎯' };
let milsFilter = 'all';
function milsScreen() {
  const rows = mils.filter(l => milsFilter === 'all' ||
    (milsFilter === 'overdue' && l.overdue) || (milsFilter === 'upcoming' && !l.overdue));
  const overdueCount = mils.filter(l => l.overdue).length;
  return `
    <div class="chiprow" style="margin-bottom:10px">
      ${[['all', `All (${mils.length})`], ['overdue', `Overdue (${overdueCount})`], ['upcoming', 'Upcoming']]
        .map(([k, l]) => `<button class="fchip ${milsFilter === k ? 'active' : ''}" onclick="milsFilter='${k}';render()">${l}</button>`).join('')}
    </div>
    <div class="card list">
      ${rows.map(l => `
        <div class="item" onclick="milsDetail('${l.id}')">
          <div class="avatar" style="background:${l.overdue ? 'var(--danger-tint);color:var(--danger)' : '#e8edf5;color:var(--navy-700)'}">${ACTION_IC[l.action]}</div>
          <div class="grow">
            <div class="t">${l.equip}</div>
            <div class="s">${l.client} · ${l.loc}<br>${l.action} ${l.date} — ${l.tech}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11.5px;font-weight:600;color:${l.overdue ? 'var(--danger)' : 'var(--gray-600)'}">Next due ${l.next}</div>
            <div style="margin-top:6px">${l.overdue ? '<span class="chip bad">OVERDUE</span>' : '<span class="chip paid">ON SCHEDULE</span>'}</div>
          </div>
        </div>`).join('')}
    </div>`;
}
window.milsDetail = id => {
  const l = mils.find(x => x.id === id);
  modal(l.id, `
    <h3 style="margin-bottom:12px">${l.equip}</h3>
    <div class="kv"><b>Client</b><span>${l.client} — ${l.loc}</span></div>
    <div class="kv"><b>Action</b><span>${l.action}</span></div>
    ${l.serial ? `<div class="kv"><b>Serial</b><span>${l.serial}</span></div>` : ''}
    <div class="kv"><b>Serviced</b><span>${l.date} 2026</span></div>
    <div class="kv"><b>Technician</b><span>${l.tech}</span></div>
    <div class="kv"><b>Findings</b><span>${l.findings}</span></div>
    <div class="kv"><b>Next due</b><span>${l.next} ${l.overdue ? '⚠ OVERDUE' : ''}</span></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost sm" onclick="closeModal();route='invoices';render();toast('Link a MILS job to an invoice — M2')">📑 Invoice this job</button>
      <button class="btn ghost sm" onclick="toast('Site photos stored in Mongo/GridFS — M3')">📷 Photos (M3)</button>
    </div>`);
};

// ---------- POS ----------
let cart = {}, posCust = null, posMethod = 'cash', cartOpen = false;
window.toggleCart = e => {
  if (e) e.stopPropagation();
  if (window.innerWidth >= 900) return;
  cartOpen = !cartOpen;
  $('#cart-box')?.classList.toggle('open', cartOpen);
};
function salesScreen() {
  return `<div class="pos-wrap">
    <div class="card list" id="cat-list">
      ${products.map(p => `
        <div class="item">
          <div class="avatar" style="border-radius:10px;background:var(--brand-tint);color:var(--brand-600)">${p.name[0]}</div>
          <div class="grow">
            <div class="t">${p.name}</div>
            <div class="s">${p.id} · ${p.service ? 'service' : `<b style="color:${p.qty <= p.reorder ? 'var(--warn)' : 'inherit'}">${p.qty} ${p.unit} in stock</b>`} · ${naira(p.price)}</div>
          </div>
          <div class="qtyctrl">
            ${cart[p.id] ? `<button onclick="cartQty('${p.id}',-1)">−</button><b>${cart[p.id].qty}</b>` : ''}
            <button class="add" ${!p.service && p.qty <= 0 ? 'disabled' : ''} onclick="cartQty('${p.id}',1)">＋</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="card cart-box ${cartOpen ? 'open' : ''}" id="cart-box">
      <div class="ttl" onclick="toggleCart(event)">🛒 CURRENT SALE <span class="badge-count">${Object.keys(cart).length}</span>
        ${Object.keys(cart).length ? `<span class="grand">· ${naira(cartTotal())}</span>` : ''}
        <span style="flex:1"></span>
        ${Object.keys(cart).length ? `<button style="color:var(--brand-600);font-size:12px;font-weight:600" onclick="event.stopPropagation();cart={};cartOpen=false;render()">Clear</button>` : ''}
        <button class="cart-chevron" onclick="toggleCart(event)">${cartOpen ? '▼' : '▲'}</button>
      </div>
      <select id="pos-cust">
        <option value="" disabled ${posCust ? '' : 'selected'}>Select customer…</option>
        ${customers.map(c => `<option value="${c.id}" ${posCust === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      ${Object.keys(cart).map(pid => {
        const l = cart[pid];
        return `<div class="cart-line"><span class="n">${l.p.name} ×${l.qty}</span><span class="money" style="font-size:12.5px;font-weight:500">${naira(l.qty * l.p.price)}</span></div>`;
      }).join('') || '<div class="empty">Tap ＋ on items to start a sale</div>'}
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--gray-100);margin-top:10px;padding-top:12px">
        <span style="color:var(--gray-500)">Subtotal</span><span class="money">${naira(cartTotal())}</span>
      </div>
      <div class="mchips">
        ${Object.keys(METHOD_META).map(m => `<button class="fchip ${posMethod === m ? 'active' : ''}" onclick="posMethod='${m}';render()">${METHOD_META[m][0]} ${METHOD_META[m][1]}</button>`).join('')}
      </div>
      <button class="btn primary" style="width:100%;margin-top:14px;justify-content:center" ${!Object.keys(cart).length || !posCust ? 'disabled' : ''} onclick="completeSale()">
        ${posMethod === 'credit' ? 'Complete — bill on invoice' : 'Complete sale — ' + naira(cartTotal())}
      </button>
    </div>
  </div>`;
}
function cartTotal() { return Object.values(cart).reduce((s, l) => s + l.qty * l.p.price, 0); }
window.cartQty = (pid, d) => {
  const p = P[pid];
  if (!cart[pid]) cart[pid] = { p, qty: 0 };
  cart[pid].qty += d;
  if (window.innerWidth < 900 && Object.keys(cart).length === 1 && d > 0) cartOpen = true;
  if (cart[pid].qty <= 0) delete cart[pid];
  else if (!p.service && cart[pid].qty > p.qty) { cart[pid].qty = p.qty; toast(`Only ${p.qty} ${p.unit} of ${p.name} in stock`); }
  render();
};
function bindPos() {
  $('#pos-cust')?.addEventListener('change', e => { posCust = e.target.value || null; render(); });
}
window.completeSale = () => {
  if (!Object.keys(cart).length || !posCust) return;
  signGate(`Sale of ${naira(cartTotal())} to ${C[posCust].name}`, () => doCompleteSale());
};
window.doCompleteSale = () => {
  const signer = currentUser().name;
  const items = Object.values(cart).map(l => [l.p.id, l.qty]);
  // decrement stock
  items.forEach(([pid, q]) => { if (!P[pid].service) P[pid].qty -= q; });
  if (posMethod === 'credit') {
    invoices.unshift({ no: 'MTK-INV-' + String(invoices.length + 1).padStart(4, '0'), issued: 29, due: '12 Sep 2026', cust: posCust, items, paid: 0 });
    C[posCust].balance += items.reduce((s, [pid, q]) => s + P[pid].price * q, 0);
    toast(`Invoice created & signed by ${signer} — payable later. Stock deducted.`, 'success');
  } else {
    txns.push({ id: 'TXN-' + String(txns.length + 1).padStart(4, '0'), d: '29 Aug, now', type: 'sale', amt: cartTotal(), m: posMethod, ref: 'S' + (sales.length + 1) });
    sales.push({ id: 'S' + (sales.length + 1), day: 29, hour: 14, cust: posCust, method: posMethod, items });
    receipts.push({ no: 'MTK-REC-' + String(receipts.length + 1).padStart(4, '0'), d: '29 Aug, now', amt: cartTotal(), m: posMethod, cust: C[posCust].name, for: 'S' + sales.length, by: signer, signed: signer });
    toast(`Sale complete — ${naira(cartTotal())}. Receipt signed by ${signer}, stock updated.`, 'success');
  }
  cart = {}; posCust = null; cartOpen = false;
  render();
};

// ---------- stock ----------
let stockQ = '', stockCat = '';
function stockScreen() {
  const rows = products.filter(p =>
    (!stockCat || p.cat === stockCat) &&
    (p.name.toLowerCase().includes(stockQ.toLowerCase()) || p.id.toLowerCase().includes(stockQ.toLowerCase())));
  const low = products.filter(p => !p.service && p.qty <= p.reorder).length;
  return `
    <div class="section-lbl" style="margin-top:0">${products.length} items · ${low} low/out · ${naira(stockValue())} at cost</div>
    <input class="search" id="stockq" placeholder="Search by name or ID…" value="${stockQ}">
    <div class="chiprow" style="margin-bottom:10px">
      <button class="fchip ${!stockCat ? 'active' : ''}" onclick="stockCat='';render()">ALL</button>
      ${Object.keys(CATS).map(c => `<button class="fchip ${stockCat === c ? 'active' : ''}" onclick="stockCat='${c}';render()">${c.toUpperCase()}</button>`).join('')}
    </div>
    <div class="card list">
      ${rows.map(p => {
        const out = !p.service && p.qty <= 0, isLow = !p.service && p.qty <= p.reorder;
        return `
        <div class="item">
          <div class="avatar" style="border-radius:12px;background:${out ? 'var(--danger-tint);color:var(--danger)' : isLow ? 'var(--warn-tint);color:var(--warn)' : 'var(--brand-tint);color:var(--brand-600)'}">${p.service ? '🛠' : p.qty}</div>
          <div class="grow">
            <div class="t">${p.name}</div>
            <div class="s">${p.id} · ${p.cat.toUpperCase()} · cost ${naira(p.cost)} · reorder @ ${p.reorder}</div>
          </div>
          ${out ? '<span class="chip bad">OUT</span>' : isLow ? '<span class="chip pending">LOW</span>' : ''}
          <div class="money">${naira(p.price)}</div>
          ${!p.service ? `<button class="btn ghost sm" onclick="adjustStock('${p.id}')">Adjust</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="section-lbl">RECENT ADJUSTMENTS (AUDIT TRAIL)</div>
    <div class="card list">
      ${adjustments.map(a => `
        <div class="item" style="cursor:default">
          <div class="avatar" style="border-radius:10px;background:var(--gray-100);color:var(--gray-600)">${a.delta > 0 ? '＋' : '−'}</div>
          <div class="grow">
            <div class="t">${P[a.pid].name} — <b style="color:${a.delta > 0 ? 'var(--success)' : 'var(--danger)'}">${a.delta > 0 ? '+' : ''}${a.delta}</b></div>
            <div class="s">${a.d} · ${a.reason} · ${a.note} · by Admin</div>
          </div>
        </div>`).join('')}
    </div>`;
}
function bindStockSearch() {
  const el = $('#stockq');
  if (el) el.addEventListener('input', e => { stockQ = e.target.value; const pos = el.selectionStart; render(); const n = $('#stockq'); n.focus(); n.setSelectionRange(pos, pos); });
}
window.adjustStock = pid => {
  const p = P[pid];
  modal(`Adjust — ${p.name}`, `
    <div class="kv"><b>Current</b><span>${p.qty} ${p.unit}</span></div>
    <input class="search" id="adj-q" placeholder="Quantity change (use − for out)" style="margin-top:6px">
    <select class="search" id="adj-r" style="margin-top:0">
      ${['RESTOCK', 'DAMAGE', 'CORRECTION', 'RETURN TO SUPPLIER'].map(r => `<option>${r}</option>`).join('')}
    </select>
    <button class="btn primary" style="width:100%;margin-top:10px;justify-content:center" onclick="doAdjust('${pid}')">Apply — log to audit trail</button>`);
};
window.doAdjust = pid => {
  const p = P[pid];
  const delta = parseInt($('#adj-q').value) || 0;
  if (delta !== 0) {
    p.qty += delta;
    adjustments.unshift({ id: 'ADJ-' + (adjustments.length + 1), d: '29 Aug', pid, delta, reason: $('#adj-r').value, note: 'Manual adjustment' });
    toast(`Stock adjusted (${delta >= 0 ? '+' : ''}${delta}) — logged in audit trail.`, 'success');
  }
  closeModal();
  render();
};

// ---------- summary ----------
let sumPeriod = 'month';
function summaryScreen() {
  const day = sumPeriod === 'today' ? 29 : sumPeriod === 'week' ? 24 : 1;
  const rev = sumPeriod === 'today' ? revToday() : sumPeriod === 'week' ? revWeek() : revAll();
  const profit = profitSince(day);
  return `
    <div class="chiprow" style="margin-bottom:14px">
      ${[['today', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']]
        .map(([k, l]) => `<button class="fchip ${sumPeriod === k ? 'active' : ''}" onclick="sumPeriod='${k}';render()">${l}</button>`).join('')}
    </div>
    <div class="grid cols-4">
      ${stat('💰', 'Revenue (net)', naira(rev), '', '#c8102e')}
      ${stat('📈', 'Profit estimate', naira(profit), 'Sales − item cost', '#15803d')}
      ${stat('📦', 'Stock value (cost)', naira(stockValue()), '', '#1a2a4a')}
      ${stat('⏳', 'Outstanding invoices', naira(outstanding()), '', '#b45309')}
    </div>
    <div class="grid two-col" style="grid-template-columns:1fr 1fr;margin-top:16px;align-items:start">
      <div class="card" style="padding:18px">
        <b>Top products (all-time)</b>
        <div style="margin-top:14px">
          ${topProducts().map(([name, v], i) => `
            <div class="bar-row">
              <div style="display:flex;font-size:12.5px"><b>#${i + 1} ${name}</b><span style="flex:1"></span><span class="money" style="font-size:12.5px">${naira(v)}</span></div>
              <div class="progress"><i style="width:${(v / topProducts()[0][1] * 100).toFixed(0)}%;background:var(--gold-500)"></i></div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card" style="padding:18px">
        <b>Attention needed</b>
        <div style="margin-top:8px">
          ${products.filter(p => !p.service && p.qty <= p.reorder).map(p => `
            <div class="item" style="padding:9px 0;border-top:none">
              <div>${p.qty <= 0 ? '⛔' : '⚠️'}</div>
              <div class="grow"><div class="t" style="font-size:12.5px">${p.name}</div><div class="s">${p.qty} left · reorder level ${p.reorder}</div></div>
              <span class="chip ${p.qty <= 0 ? 'bad' : 'pending'}">${p.qty <= 0 ? 'OUT' : 'LOW'}</span>
            </div>`).join('')}
          ${invoices.filter(v => invTotal(v) - v.paid > 0).map(v => `
            <div class="item" style="padding:9px 0">
              <div>📑</div>
              <div class="grow"><div class="t" style="font-size:12.5px">${v.no} — ${C[v.cust].name}</div><div class="s">Due ${typeof v.due === 'number' ? v.due + ' Aug' : v.due}</div></div>
              <div class="money neg" style="font-size:12.5px">${naira(invTotal(v) - v.paid)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ---------- modal / toast ----------
window.modal = (title, html) => {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.onclick = e => { if (e.target === back) closeModal(); };
  back.innerHTML = `<div class="modal"><h3>${title}</h3>${html}</div>`;
  back.id = 'modal';
  document.body.appendChild(back);
};
window.closeModal = () => $('#modal')?.remove();
window.toast = (msg, kind = '') => {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3200);
};

// ---------- navigation ----------
window.go = r => { route = r; location.hash = '#/' + r; closeDrawer(); render(); };
window.openDrawer = () => { $('#m-drawer').classList.add('open'); $('#drawer-back').classList.add('open'); };
window.closeDrawer = () => { $('#m-drawer')?.classList.remove('open'); $('#drawer-back')?.classList.remove('open'); };

function buildNav() {
  const html = NAV.map(([id, ic, label]) =>
    `<button class="${route === id ? 'active' : ''}" onclick="go('${id}')"><span class="ic">${ic}</span>${label}</button>`).join('');
  $('#nav').innerHTML = html;
  $('#m-nav').innerHTML = html;
  $('#pagetitle').textContent = NAV.find(n => n[0] === route)[2];
}

window.addEventListener('hashchange', () => {
  const r = location.hash.replace('#/', '');
  if (NAV.some(n => n[0] === r) && r !== route) { route = r; render(); buildNav(); }
});

// =====================================================================
// AUTH — account password + separate SIGNATURE PASSCODE (SPEC §6.1)
// Preview mirrors app/lib/data/auth_store.dart. Demo hashing only;
// M3 moves verification to Supabase Auth with salted hashes.
// =====================================================================
const djb2 = s => { let h = 5381; for (const c of 'mtek::' + s) { h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; } return h.toString(16); };
const LS_USERS = 'mtek_users_v1', LS_SESSION = 'mtek_session_v1';

function loadUsers() {
  try { const raw = localStorage.getItem(LS_USERS); if (raw) return JSON.parse(raw); } catch (e) { /* fresh */ }
  const seed = [{ name: 'Admin', email: 'admin@mtek.demo', role: 'admin',
    passwordHash: djb2('admin123'), sigHash: djb2('1234'), signaturePng: null }];
  try { localStorage.setItem(LS_USERS, JSON.stringify(seed)); } catch (e) {}
  return seed;
}
let users = loadUsers();
const saveUsers = () => { try { localStorage.setItem(LS_USERS, JSON.stringify(users)); } catch (e) {} };
const currentUser = () => {
  const email = (() => { try { return localStorage.getItem(LS_SESSION); } catch (e) { return null; } })();
  return users.find(u => u.email === email) || null;
};

// ---------- login / signup UI ----------
function renderAuth(mode = 'login') {
  const auth = $('#auth');
  auth.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-card">
        <div class="lg">M</div>
        <div class="co">M-TEK FIRE &amp; SAFETY LTD</div>
        <div class="sub">${mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</div>
        ${mode === 'login' ? `
          <label>Email</label><input id="a-email" type="email" placeholder="you@mtek…" value="admin@mtek.demo">
          <label>Password</label><input id="a-pass" type="password" placeholder="••••••••">
          <button class="btn primary" style="width:100%;justify-content:center;margin-top:18px" onclick="doLogin()">Sign in</button>
          <button class="linkbtn" onclick="renderAuth('signup')">Create an account →</button>
          <div class="auth-demo">Demo: admin@mtek.demo · admin123</div>
        ` : `
          <label>Full name</label><input id="a-name" placeholder="e.g. Ibrahim Kabeer">
          <label>Email</label><input id="a-email" type="email" placeholder="you@mtek…">
          <label>Account password (min 6)</label><input id="a-pass" type="password">
          <div class="goldbox">
            <div class="gt">✍️ SIGNATURE PASSCODE</div>
            <div class="gd">Used to digitally sign receipts, invoices &amp; MILS logs — no more signing on paper. Must differ from your password.</div>
            <label>Signature passcode (min 4)</label><input id="a-sig" type="password">
            <label>Repeat signature passcode</label><input id="a-sig2" type="password">
            <div class="sig-block">
              <div class="sig-hint">Draw your signature (optional — the passcode is what authorises documents):</div>
              <canvas id="sig-canvas"></canvas>
              <div class="sig-row">
                <button class="btn ghost sm" onclick="clearSig()">Clear</button>
                <span style="flex:1"></span>
                <span id="sig-saved" style="font-size:11px;color:var(--success);font-weight:700"></span>
              </div>
            </div>
          </div>
          <div class="rolechips">Role
            <button class="fchip active" id="role-admin" onclick="pickRole('admin')">Admin</button>
            <button class="fchip" id="role-sales" onclick="pickRole('sales')">Sales</button>
          </div>
          <button class="btn primary" style="width:100%;justify-content:center;margin-top:18px" onclick="doSignup()">Create account</button>
          <button class="linkbtn" onclick="renderAuth('login')">← Back to sign in</button>
        `}
        <div class="auth-err" id="a-err"></div>
      </div>
    </div>`;
  auth.style.display = 'block';
  if (mode === 'signup') setTimeout(initSigCanvas, 0);
  updateUserChip();
}

let pickedRole = 'admin', drawnSig = null;
window.pickRole = r => {
  pickedRole = r;
  $('#role-admin').classList.toggle('active', r === 'admin');
  $('#role-sales').classList.toggle('active', r === 'sales');
};

function initSigCanvas() {
  const cv = $('#sig-canvas'); if (!cv) return;
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return; // headless test env — drawing is optional
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1220';
  let drawing = false;
  const pos = e => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)];
  };
  cv.onpointerdown = e => { drawing = true; ctx.beginPath(); ctx.moveTo(...pos(e)); };
  cv.onpointermove = e => { if (drawing) { ctx.lineTo(...pos(e)); ctx.stroke(); } };
  cv.onpointerup = cv.onpointerleave = () => { drawing = false; };
  cv._onUp = () => { try { drawnSig = cv.toDataURL('image/png'); $('#sig-saved').textContent = drawnSig ? 'Signature saved ✓' : ''; } catch (e) {} };
  cv.addEventListener('pointerup', cv._onUp);
}
window.clearSig = () => {
  const cv = $('#sig-canvas'); if (!cv) return;
  const ctx = cv.getContext && cv.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  drawnSig = null; const s = $('#sig-saved'); if (s) s.textContent = '';
};

window.doLogin = () => {
  const email = $('#a-email').value.trim().toLowerCase();
  const user = users.find(u => u.email === email);
  const err = m => { $('#a-err').textContent = m; };
  if (!user) return err('No account with that email');
  if (user.passwordHash !== djb2($('#a-pass').value)) return err('Wrong password');
  try { localStorage.setItem(LS_SESSION, user.email); } catch (e) {}
  enterApp();
};

window.doSignup = () => {
  const err = m => { $('#a-err').textContent = m; };
  const name = $('#a-name').value.trim(), email = $('#a-email').value.trim().toLowerCase();
  const pass = $('#a-pass').value, sig = $('#a-sig').value, sig2 = $('#a-sig2').value;
  if (!name) return err('Enter your full name');
  if (!email.includes('@')) return err('Enter a valid email');
  if (pass.length < 6) return err('Password must be at least 6 characters');
  if (sig.length < 4) return err('Signature passcode must be at least 4 characters');
  if (sig === pass) return err('Signature passcode must be different from your password');
  if (sig !== sig2) return err('Signature passcodes do not match');
  if (users.some(u => u.email === email)) return err('An account with that email already exists');
  users.push({ name, email, role: pickedRole, passwordHash: djb2(pass), sigHash: djb2(sig), signaturePng: drawnSig });
  saveUsers();
  try { localStorage.setItem(LS_SESSION, email); } catch (e) {}
  enterApp();
};

window.signOut = () => {
  try { localStorage.removeItem(LS_SESSION); } catch (e) {}
  updateUserChip();
  renderAuth('login');
};

function updateUserChip() {
  const u = currentUser();
  $('#uname').textContent = u ? u.name : '';
  $('#urole').textContent = u ? u.role.toUpperCase() : '';
  $('#logoutbtn').style.display = u ? '' : 'none';
}

// ---------- SIGNATURE GATE (issues documents) ----------
window.signGate = (what, onSigned) => {
  const u = currentUser();
  if (!u) return;
  modal('Sign to issue', `
    <p style="font-size:12.5px;color:var(--gray-500);margin-bottom:12px">This document will be digitally signed by <b style="color:var(--gray-800)">${u.name}</b>.</p>
    ${u.signaturePng ? `<img src="${u.signaturePng}" class="stamp" style="height:44px;border:1px solid var(--gray-200);border-radius:8px">` : ''}
    <label style="display:block;font-size:11.5px;font-weight:600;color:var(--gray-600);margin:8px 0 4px">Signature passcode</label>
    <input type="password" id="gate-sig" style="width:100%;padding:11px 13px;border:1px solid var(--gray-200);border-radius:12px" autofocus>
    <div class="auth-err" id="gate-err"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost" style="flex:1;justify-content:center" onclick="closeModal()">Cancel</button>
      <button class="btn primary" style="flex:1;justify-content:center" onclick="gateSubmit('${what.replace(/'/g, '')}')">✍️ Sign &amp; issue</button>
    </div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:10px">Signing: ${what}</div>`);
  window._gateCb = onSigned;
};
window.gateSubmit = () => {
  const u = currentUser();
  if (u && djb2($('#gate-sig').value) === u.sigHash) {
    const cb = window._gateCb; window._gateCb = null;
    closeModal();
    cb(u);
  } else {
    $('#gate-err').textContent = 'Signature passcode does not match — document NOT issued';
  }
};

function enterApp() {
  $('#auth').style.display = 'none';
  updateUserChip();
  route = location.hash.replace('#/', '') || 'insights';
  if (!NAV.some(n => n[0] === route)) route = 'insights';
  render();
  buildNav();
  toast(`Signed in as ${currentUser().name} — documents require your Signature Passcode.`);
}

// =====================================================================
// DOCS GENERATOR (Phase A) — serials continue the paper books
// =====================================================================
const LS_SERIALS = 'mtek_serials_v1';
const SERIAL_SEEDS = { receipt: 2131, invoice: 4335, mils: 925 };
function serials() {
  try { const raw = localStorage.getItem(LS_SERIALS); if (raw) return JSON.parse(raw); } catch (e) {}
  try { localStorage.setItem(LS_SERIALS, JSON.stringify(SERIAL_SEEDS)); } catch (e) {}
  return { ...SERIAL_SEEDS };
}
window.nextSerial = type => {
  const s = serials();
  s[type] = (s[type] || 0) + 1;
  try { localStorage.setItem(LS_SERIALS, JSON.stringify(s)); } catch (e) {}
  return s[type];
};
window.peekSerial = type => (serials()[type] || 0) + 1;
const nairaWords = n => {
  const nw = Math.floor(n), kb = Math.round((n - nw) * 100);
  return (nw.toLocaleString('en-NG')) + ' naira' + (kb ? ` ${kb} kobo` : '') + ' (in words — full text on PDF)';
};

// form state (persists per type in-session, like the Flutter generators)
const docState = {
  receipt: { irn: '', name: '', addr: '', phone: '', forWhat: '', amount: 0, method: 'Cash' },
  invoice: { variant: 'SALES INVOICE', name: '', addr: '', phone: '', lpo: '', milsRef: false, recRef: false, milsNo: '', recNo: '', advance: 0, vatOn: true, rows: [{ d: '', q: 1, r: 0 }] },
  mils: { name: '', addr: '', phone: '', lpo: '', inv: '', rec: '', weights: {}, comps: {}, compsRate: {}, advance: 0 },
};
let docsTab = 'receipt';
const W_KEYS = ['1kg','2kg','3kg','5kg','6kg','9kg','12kg','25kg','50kg','75kg'];
const C_KEYS = ['Nipple','Horn','Hose','Manometre','Valve','Strap','Label','Lever','Seal','Powder','Pull Pin','Cartridge'];
const invSub = () => docState.invoice.rows.reduce((s, r) => s + (r.q * (r.r || 0)), 0);
const invVat = () => docState.invoice.vatOn ? invSub() * 0.075 : 0;
const invGrand = () => invSub() + invVat();
const milsSub = () => {
  let s = 0;
  Object.entries(docState.mils.weights).forEach(([k, q]) => (s += (q || 0) * (docState.mils.weights[k + '_r'] || 0)));
  Object.entries(docState.mils.comps).forEach(([c, q]) => (s += (q || 0) * (docState.mils.compsRate[c] || 0)));
  return s;
};

function docsScreen() {
  return `
    <div class="seg">
      ${[['receipt', '🧾 Payment Receipt'], ['invoice', '📑 Sales Invoice'], ['mils', '🛠️ MILS Sheet']]
        .map(([k, l]) => `<button class="${docsTab === k ? 'active' : ''}" onclick="docsTab='${k}';render()">${l}</button>`).join('')}
    </div>
    ${docsTab === 'receipt' ? docsReceipt() : docsTab === 'invoice' ? docsInvoice() : docsMils()}
    <div class="card" style="padding:14px;margin-top:14px">
      <button class="btn primary" style="width:100%;justify-content:center" onclick="generateDoc()">✍️ Sign &amp; generate PDF</button>
      <div style="font-size:11px;color:var(--gray-500);text-align:center;margin-top:8px">
        Requires your Signature Passcode · PDF gets the dual-office header, watermark, signature stamp &amp; verification QR · shared straight to WhatsApp/email
      </div>
    </div>`;
}

function docsReceipt() {
  const d = docState.receipt;
  return `
    <div class="serial-banner">🏷️ Receipt No: <b>${peekSerial('receipt')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">continues book numbering (last printed: 2131)</span></div>
    <div class="card form-card">
      <div class="fc-t">CUSTOMER & PAYMENT</div>
      <input class="f-in" placeholder="IRN (Invoice Reference Number)" value="${d.irn}" oninput="docState.receipt.irn=this.value">
      <input class="f-in" placeholder="Customer name *" value="${d.name}" oninput="docState.receipt.name=this.value">
      <input class="f-in" placeholder="Address" value="${d.addr}" oninput="docState.receipt.addr=this.value">
      <input class="f-in" placeholder="Phone No." value="${d.phone}" oninput="docState.receipt.phone=this.value">
      <input class="f-in" placeholder="Being Payment for" value="${d.forWhat}" oninput="docState.receipt.forWhat=this.value">
      <input class="f-in" placeholder="The Sum of (₦) *" type="number" value="${d.amount || ''}" oninput="docState.receipt.amount=parseFloat(this.value)||0;this.closest('.card').querySelector('.sumwords').textContent=docState.receipt.amount?'₦'+docState.receipt.amount.toLocaleString()+' — '+nairaWords(docState.receipt.amount):'—'">
      <div class="frow" style="margin-top:4px">
        ${['Cash','Cheque','Transfer','POS'].map(m => `<button class="fchip ${d.method === m ? 'active' : ''}" onclick="docState.receipt.method='${m}';render()">${m}</button>`).join('')}
      </div>
      <div class="summary-tile grand" style="margin-top:10px"><span class="l">The Sum of (words)</span><span class="v sumwords">${d.amount ? '₦' + d.amount.toLocaleString() + ' — ' + nairaWords(d.amount) : '—'}</span></div>
    </div>`;
}

function docsInvoice() {
  const d = docState.invoice;
  return `
    <div class="serial-banner">🏷️ Invoice No: <b>${peekSerial('invoice')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">continues book numbering (last printed: 4335)</span></div>
    <div class="card form-card">
      <div class="fc-t">DOCUMENT TYPE</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['WAY BILL','PRO-FORMER','SERVICE INVOICE','SALES INVOICE'].map(v => `<button class="fchip ${d.variant === v ? 'active' : ''}" onclick="docState.invoice.variant='${v}';render()">${v}</button>`).join('')}
        <button class="fchip ${d.milsRef ? 'active' : ''}" onclick="docState.invoice.milsRef=!docState.invoice.milsRef;render()">MILS No ref.</button>
        <button class="fchip ${d.recRef ? 'active' : ''}" onclick="docState.invoice.recRef=!docState.invoice.recRef;render()">Receipt No ref.</button>
      </div>
    </div>
    <div class="card form-card">
      <div class="fc-t">CROSS-REFERENCES & CUSTOMER</div>
      ${d.milsRef ? `<input class="f-in" placeholder="MILS No" value="${d.milsNo}" oninput="docState.invoice.milsNo=this.value">` : ''}
      ${d.recRef ? `<input class="f-in" placeholder="Receipt No" value="${d.recNo}" oninput="docState.invoice.recNo=this.value">` : ''}
      <input class="f-in" placeholder="L.P.O. No" value="${d.lpo}" oninput="docState.invoice.lpo=this.value">
      <input class="f-in" placeholder="Customer name *" value="${d.name}" oninput="docState.invoice.name=this.value">
      <input class="f-in" placeholder="Address" value="${d.addr}" oninput="docState.invoice.addr=this.value">
      <input class="f-in" placeholder="Phone No." value="${d.phone}" oninput="docState.invoice.phone=this.value">
    </div>
    <div class="card form-card">
      <div class="fc-t">ITEMISED LEDGER</div>
      <table class="ledg"><thead><tr><th style="width:28px">S/NO</th><th>DESCRIPTION</th><th style="width:64px">QTY</th><th style="width:96px">RATE (₦)</th><th style="width:96px">AMOUNT (₦)</th><th style="width:30px"></th></tr></thead>
      <tbody>
        ${d.rows.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><input placeholder="Item / service" value="${r.d}" oninput="docState.invoice.rows[${i}].d=this.value;updateInvTotals()"></td>
          <td><input type="number" value="${r.q}" oninput="docState.invoice.rows[${i}].q=parseFloat(this.value)||0;updateInvTotals()"></td>
          <td><input type="number" value="${r.r || ''}" oninput="docState.invoice.rows[${i}].r=parseFloat(this.value)||0;updateInvTotals()"></td>
          <td class="amt" style="font-weight:700">₦${(r.q * (r.r || 0)).toLocaleString()}</td>
          <td>${d.rows.length > 1 ? `<button style="color:var(--danger)" onclick="docState.invoice.rows.splice(${i},1);render()">✕</button>` : ''}</td>
        </tr>`).join('')}
      </tbody></table>
      <button class="btn ghost sm" onclick="docState.invoice.rows.push({d:'',q:1,r:0});render()">＋ Add row</button>
      <div style="margin-top:10px">
        <div class="summary-tile"><span class="l">Subtotal</span><span class="v" id="inv-sub">₦${invSub().toLocaleString()}</span></div>
        <div class="summary-tile"><span class="l">7.5% VAT</span><span class="v" id="inv-vat">₦${invVat().toLocaleString()}</span></div>
        <div class="summary-tile grand"><span class="l">GRAND TOTAL</span><span class="v" id="inv-grand">₦${invGrand().toLocaleString()}</span></div>
      </div>
    </div>
    <div class="card form-card">
      <div class="fc-t">PAYMENTS</div>
      <input class="f-in" placeholder="Advance Payment (₦)" type="number" value="${d.advance || ''}" oninput="docState.invoice.advance=parseFloat(this.value)||0;updateInvTotals()">
      <div class="summary-tile"><span class="l">Balance Payment</span><span class="v" id="inv-bal" style="color:var(--danger)">₦${(invGrand() - d.advance).toLocaleString()}</span></div>
    </div>`;
}
window.updateInvTotals = () => {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = '₦' + v.toLocaleString(); };
  set('inv-sub', invSub()); set('inv-vat', invVat()); set('inv-grand', invGrand()); set('inv-bal', invGrand() - docState.invoice.advance);
  if (route === 'docs') { const amts = document.querySelectorAll('.ledg .amt'); docState.invoice.rows.forEach((r, i) => { if (amts[i]) amts[i].textContent = '₦' + (r.q * (r.r || 0)).toLocaleString(); }); }
};

function docsMils() {
  const d = docState.mils;
  return `
    <div class="serial-banner">🏷️ MILS No: <b>${peekSerial('mils')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">continues book numbering (last printed: 925)</span></div>
    <div class="card form-card">
      <div class="fc-t">DATES & REFERENCES</div>
      <div class="frow">
        <input class="f-in" placeholder="Entry Date" type="date" value="${new Date().toISOString().slice(0,10)}">
        <input class="f-in" placeholder="Collection Date" type="date">
        <input class="f-in" placeholder="Next Service Date" type="date">
      </div>
      <div class="frow">
        <input class="f-in" placeholder="Invoice No." value="${d.inv}" oninput="docState.mils.inv=this.value">
        <input class="f-in" placeholder="Receipt No." value="${d.rec}" oninput="docState.mils.rec=this.value">
        <input class="f-in" placeholder="LPO No." value="${d.lpo}" oninput="docState.mils.lpo=this.value">
      </div>
    </div>
    <div class="card form-card">
      <div class="fc-t">A — DESCRIPTION (EXTINGUISHERS BY WEIGHT)</div>
      <div class="wgrid">
        ${W_KEYS.map(k => `<div class="wcell"><b>${k}</b><input type="number" min="0" placeholder="0" value="${d.weights[k] || ''}" oninput="docState.mils.weights[k]=parseFloat(this.value)||0"></div>`).join('')}
      </div>
    </div>
    <div class="card form-card">
      <div class="fc-t">B — REPLACEMENT (COMPONENTS)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${C_KEYS.map(c => `<button class="fchip ${(d.comps[c] || 0) > 0 ? 'active' : ''}" onclick="docState.mils.comps[c]=((docState.mils.comps[c]||0)>0)?0:1;render()">${c}</button>`).join('')}
      </div>
      ${C_KEYS.filter(c => (d.comps[c] || 0) > 0).map(c => `
        <div class="frow" style="margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:200px"><b style="font-size:12.5px">${c}</b></div>
          <input class="f-in" style="max-width:110px;margin:0" type="number" placeholder="Qty" value="${d.comps[c] || ''}" oninput="docState.mils.comps[c]=parseFloat(this.value)||0">
          <input class="f-in" style="max-width:130px;margin:0" type="number" placeholder="Rate (₦)" value="${d.compsRate[c] || ''}" oninput="docState.mils.compsRate[c]=parseFloat(this.value)||0">
        </div>`).join('')}
    </div>
    <div class="card form-card">
      <div class="fc-t">CUSTOMER & BILL</div>
      <input class="f-in" placeholder="Customer's Name *" value="${d.name}" oninput="docState.mils.name=this.value">
      <input class="f-in" placeholder="Address" value="${d.addr}" oninput="docState.mils.addr=this.value">
      <input class="f-in" placeholder="Phone Number" value="${d.phone}" oninput="docState.mils.phone=this.value">
      <input class="f-in" placeholder="Advance Payment (₦) — min 50% by policy" type="number" value="${d.advance || ''}" oninput="docState.mils.advance=parseFloat(this.value)||0;updateMilsTotals()">
      <div class="summary-tile"><span class="l">Subtotal</span><span class="v" id="mils-sub">₦${milsSub().toLocaleString()}</span></div>
      <div class="summary-tile"><span class="l">VAT</span><span class="v" id="mils-vat">₦${(milsSub() * 0.075).toLocaleString()}</span></div>
      <div class="summary-tile grand"><span class="l">GRAND TOTAL</span><span class="v" id="mils-grand">₦${(milsSub() * 1.075).toLocaleString()}</span></div>
    </div>`;
}
window.updateMilsTotals = () => {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = '₦' + v.toLocaleString(); };
  set('mils-sub', milsSub()); set('mils-vat', milsSub() * 0.075); set('mils-grand', milsSub() * 1.075);
};

window.generateDoc = () => {
  const t = docsTab;
  const d = docState[t];
  if (t === 'receipt' && (!d.name || !d.amount)) return toast('Fill customer name and amount first');
  if (t === 'invoice' && (!d.name || !d.rows.some(r => r.d && r.r))) return toast('Fill customer name and at least one line item');
  if (t === 'mils' && (!d.name || (!Object.values(d.weights).some(q => q > 0) && !Object.values(d.comps).some(q => q > 0)))) return toast("Fill customer's name and at least one weight entry or component");
  signGate(`${t.charAt(0).toUpperCase() + t.slice(1)} — ${d.name}`, () => showDocPreview(t));
};

function showDocPreview(t) {
  const serial = nextSerial(t);
  const u = currentUser();
  const sigImg = (u && u.signaturePng) ? `<img src="${u.signaturePng}">` : '';
  let body = '';
  if (t === 'receipt') {
    const d = docState.receipt;
    body = `
      <div class="mbox">IRN: ${d.irn || '—'}</div>
      <div class="banner">PAYMENT RECEIPT</div>
      <div class="ds-field"><b>No:</b>${serial}</div>
      <div class="ds-field"><b>Date:</b>${new Date().toLocaleDateString('en-GB')}</div>
      <div class="ds-field"><b>Name:</b>${d.name}</div>
      <div class="ds-field"><b>Address:</b>${d.addr || '—'}</div>
      <div class="ds-field"><b>Phone No.</b>${d.phone || '—'}</div>
      <div class="ds-field"><b>The Sum of</b>${nairaWords(d.amount)}</div>
      <div class="ds-field"><b>Being Payment for</b>${d.forWhat || '—'}</div>
      <div class="frow" style="margin:8px 0">
        ${['Cash','Cheque','Transfer','POS'].map(m => `<span class="fchip ${d.method === m ? 'active' : ''}">${d.method === m ? '☑' : '☐'} ${m}${d.method === m ? ' — ₦' + d.amount.toLocaleString() : ''}</span>`).join('')}
      </div>
      <div class="ds-field"><b>For: M-TEK FIRE & SAFETY LTD</b>${u ? u.name : ''}</div>
      <div class="ds-field"><b>For: CUSTOMER'S/CLIENT</b></div>
      <div class="ds-note">No guarantee cover on tested goods and services. Purchased tested goods and services cannot be returned. We bear no liability on part paid and abandoned goods. This document is invalid without stamp and seal of this company.</div>`;
  } else if (t === 'invoice') {
    const d = docState.invoice;
    body = `
      <div class="frow" style="margin-bottom:6px">
        <span class="fchip ${d.milsRef ? 'active' : ''}">☐ MILS No: ${d.milsNo || ''}</span>
        <span class="fchip ${d.recRef ? 'active' : ''}">☐ RECEIPT NO: ${d.recNo || ''}</span>
        ${['WAY BILL','PRO-FORMER','SERVICE INVOICE','SALES INVOICE'].map(v => `<span class="fchip ${d.variant === v ? 'active' : ''}">${d.variant === v ? '☑' : '☐'} ${v}</span>`).join('')}
      </div>
      <div class="ds-field"><b>No:</b>${serial} · <b>LPO:</b>${d.lpo || '—'} · <b>Date:</b>${new Date().toLocaleDateString('en-GB')}</div>
      <div class="ds-field"><b>Name:</b>${d.name} · <b>Phone:</b>${d.phone || '—'}</div>
      <table class="ledg"><thead><tr><th>S/NO</th><th>DESCRIPTION</th><th>QTY</th><th>RATE ₦</th><th>AMOUNT ₦</th></tr></thead><tbody>
      ${d.rows.filter(r => r.d).map((r, i) => `<tr><td>${i + 1}</td><td>${r.d}</td><td>${r.q}</td><td>${(r.r || 0).toLocaleString()}</td><td>${(r.q * r.r).toLocaleString()}</td></tr>`).join('')}
      </tbody></table>
      <div class="summary-tile"><span class="l">7.5% VAT</span><span class="v">₦${invVat().toLocaleString()}</span></div>
      <div class="summary-tile grand"><span class="l">TOTAL</span><span class="v">₦${invGrand().toLocaleString()}</span></div>
      <div class="summary-tile"><span class="l">Advance Payment</span><span class="v">₦${d.advance.toLocaleString()}</span></div>
      <div class="summary-tile"><span class="l">Balance Payment</span><span class="v" style="color:var(--danger)">₦${(invGrand() - d.advance).toLocaleString()}</span></div>
      <div class="ds-field" style="margin-top:6px"><b>Amount in words:</b>${nairaWords(invGrand())} ONLY</div>
      <div class="ds-note">No guarantee cover on tested goods and services. We bear no liability on part paid and abandoned goods. This document is invalid without stamp and seal of this company.</div>`;
  } else {
    const d = docState.mils;
    const wRows = W_KEYS.filter(k => (d.weights[k] || 0) > 0).map(k => `<tr><td>${k}</td><td>${d.weights[k]}</td><td>${(d.weights[k + '_r'] || 0).toLocaleString()}</td><td>${(d.weights[k] * (d.weights[k + '_r'] || 0)).toLocaleString()}</td></tr>`).join('');
    const cRows = C_KEYS.filter(c => (d.comps[c] || 0) > 0).map(c => `<tr><td>${c}</td><td>${d.comps[c]}</td><td>${(d.compsRate[c] || 0).toLocaleString()}</td><td>${(d.comps[c] * (d.compsRate[c] || 0)).toLocaleString()}</td></tr>`).join('');
    body = `
      <div class="banner">MAINTENANCE INFORMATION LOG SHEET · MILS No: ${serial}</div>
      <div class="ds-field"><b>Entry:</b>${new Date().toLocaleDateString('en-GB')} · <b>LPO:</b>${d.lpo || '—'} · <b>Inv:</b>${d.inv || '—'} · <b>Rec:</b>${d.rec || '—'}</div>
      <div class="fc-t" style="margin-top:6px">DESCRIPTION:</div>
      <table class="ledg"><thead><tr><th>Desc</th><th>Qty</th><th>Rate ₦</th><th>Amount ₦</th></tr></thead><tbody>${wRows || '<tr><td colspan=4>—</td></tr>'}</tbody></table>
      <div class="fc-t" style="color:var(--brand-700)">REPLACEMENT:</div>
      <table class="ledg"><thead><tr><th>Component</th><th>Qty</th><th>Rate ₦</th><th>Amount ₦</th></tr></thead><tbody>${cRows || '<tr><td colspan=4>—</td></tr>'}</tbody></table>
      <div class="summary-tile grand"><span class="l">GRAND TOTAL (incl. VAT)</span><span class="v">₦${(milsSub() * 1.075).toLocaleString()}</span></div>
      <div class="ds-field"><b>Customer:</b>${d.name} · ${d.phone || ''}</div>
      <div class="ds-field"><b>Bill in words:</b>${nairaWords(milsSub() * 1.075)}</div>
      <div class="ds-field"><b>Prepared by:</b>${u ? u.name : ''} · <b>APPROVED:</b>__ · <b>Customer's Assent:</b>__ · <b>Collector's Assent:</b>__</div>
      <div class="ds-note">Caution: Payment can only commence upon the payment of at least 50% value of the maintenance charges. No equipment is collected for repair before payment. Expired/Unserviceable old equipment should be exchanged with new ones after the expiration of the collection date. Goods left 3 months after will be considered as abandoned goods and the company shall bear no liability on any abandoned equipment.</div>`;
  }
  modal('Document generated — ' + serial, `
    <div class="doc-sheet">
      <div class="corp">M-TEK FIRE &amp; SAFETY LTD.</div>
      <div class="corp-serv">*Sales *Supplies *Installations *Refilling *Maintenance *Training *Consultancy · RC 1082534<br>HEAD OFFICE: YY12, Kazaure Road, By Lagos Street Round About, Kaduna. Tel: 08033489452 · BRANCH OFFICE: Plot 45, Sir Patrick Ibrahim Yakowa Way By Milton School, Kamazou Kaduna. 08170577595</div>
      ${body}
      <div class="ds-signed">✓ Digitally signed by ${u ? u.name : ''} · ${new Date().toLocaleString('en-GB')} ${sigImg}<span style="margin-left:auto;font-size:9px;color:var(--gray-500)">QR verification hash on PDF</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost sm" style="flex:1" onclick="toast('Pre-formatted message + PDF → WhatsApp (native share sheet in the app)')">💬 WhatsApp</button>
      <button class="btn ghost sm" style="flex:1" onclick="toast('Pre-formatted message + PDF → Email (native share sheet in the app)')">✉ Email</button>
      <button class="btn primary sm" style="flex:1" onclick="toast('Saved as mtek_${t}_${serial}_[timestamp].pdf · share sheet opens (real file in the app/PWA)')">⤓ PDF + Share</button>
    </div>`);
  toast(`Document No: ${serial} signed & issued — serial continues the paper book.`, 'success');
}

// debug/console handle (also used by smoke.test.js)
window.__mtek = () => ({ products, customers, sales, receipts, txns, invoices, mils, adjustments, currentUser });
window.__docsState = docState;              // live form state (same object reference)
window.__setDocsTab = t => { docsTab = t; render(); };

// boot
if (currentUser()) enterApp(); else renderAuth('login');
