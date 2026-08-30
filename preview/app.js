/* M-Tek Inventory — design preview logic.
   Mirrors app/lib/data/sample_store.dart (same dataset, same derived math). */

// ---------- sample data (identical numbers to the Flutter store) ----------
const CATS = { Fire: 'Fire', Safety: 'Safety', Security: 'Security', Solar: 'Solar', Automation: 'Automation & Surveillance' };
const CAT_COLOR = { Fire: '#c8102e', Safety: '#f0a92e', Security: '#1a2a4a', Solar: '#15803d', Automation: '#ff5b66' };
const METHOD_META = { cash: ['cash', 'Cash'], transfer: ['bank', 'Transfer'], pos: ['pos', 'POS'], credit: ['credit', 'Credit'] };
const methodIc = m => icSvg((METHOD_META[m] || [])[0] || 'cash', 15);





// chronological payments (sale payments + invoice payments + refunds)

// receipts mirror txns 1:1 (same order)



// ---------- LIVE DATA (Phase B) — served by preview/server.js (persisted) ----------
let products = [], customers = [], sales = [], invoices = [], txns = [], mils = [],
    adjustments = [], receipts = [], docs = [];
let serials = { receipt: 2131, invoice: 4335, mils: 925 };
let settings = { vatEnabled: true, vatRate: 0.075, watermark: true };
let P = {}, C = {};
function rebuildMaps() {
  P = Object.fromEntries(products.map(p => [p.id, p]));
  C = Object.fromEntries(customers.map(c => [c.id, c]));
}
async function api(path, body) {
  const res = await fetch(path, body === undefined
    ? { headers: { 'Content-Type': 'application/json' } }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status));
  return data;
}
async function refreshState() {
  const s = await api('/api/state');
  products = s.products; customers = s.customers; sales = s.sales; invoices = s.invoices;
  txns = s.txns; mils = s.mils; adjustments = s.adjustments; receipts = s.receiptsIssue || [];
  docs = s.docs || []; serials = s.serials; settings = s.settings;
  rebuildMaps();
}

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

window.toggleFab = () => $('#fab-dial')?.classList.toggle('open');
window.startDoc = t => {
  $('#fab-dial')?.classList.remove('open');
  docsTab = t;
  go('docs');
};

// ---------- SETTINGS (real: VAT, watermark, serial reseed, reset) ----------
function settingsScreen() {
  const s = settings;
  return `
    <div class="grid cols-2" style="align-items:start">
      <div class="card form-card">
        <div class="fc-t">FINANCIAL</div>
        <label style="display:flex;gap:10px;align-items:center;font-size:13px;font-weight:600">
          <input type="checkbox" ${s.vatEnabled ? 'checked' : ''} onchange="setSetting('vatEnabled', this.checked)"> Apply 7.5% VAT on invoices &amp; MILS sheets
        </label>
        <div style="font-size:11.5px;color:var(--gray-500);margin-top:6px">Per-document override arrives with the PDF painter settings (M2+).</div>
      </div>
      <div class="card form-card">
        <div class="fc-t">APPEARANCE</div>
        <label style="display:flex;gap:10px;align-items:center;font-size:13px;font-weight:600">
          <input type="checkbox" ${s.watermark ? 'checked' : ''} onchange="setSetting('watermark', this.checked)"> Faint brand watermark on documents &amp; app UI
        </label>
      </div>
      <div class="card form-card">
        <div class="fc-t">DOCUMENT SERIALS — continue the paper books</div>
        ${[['receipt', 'Payment Receipt', 0], ['invoice', 'Sales Invoice', 0], ['mils', 'MILS Sheet', 0], ['waybill', 'Waybill', 0], ['deliverynote', 'Delivery Note', 0]].map(([k, label, seed]) => `
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <span style="flex:1;font-size:12.5px">${label}</span>
            <input class="f-in" style="max-width:110px;margin:0" id="seed-${k}" type="number" value="${serials[k]}">
            <button class="btn ghost sm" onclick="reseedSerial('${k}', ${seed})">Set</button>
          </div>`).join('')}
        <div style="font-size:11.5px;color:var(--gray-500)">Next issued: receipt <b>${serials.receipt + 1}</b> · invoice <b>${serials.invoice + 1}</b> · MILS <b>${serials.mils + 1}</b> · waybill <b>${serials.waybill + 1}</b> · delivery note <b>${serials.deliverynote + 1}</b></div>
      </div>
      <div class="card form-card">
        <div class="fc-t">DANGER ZONE</div>
        <button class="btn ghost" style="width:100%;justify-content:center" onclick="resetDemo()">${icSvg('reset', 15)} Reset preview data to seed</button>
        <div style="font-size:11.5px;color:var(--gray-500);margin-top:8px">Server database (preview/.data/db.json) is restored to the sample dataset.</div>
      </div>
    </div>`;
}
window.setSetting = async (k, v) => {
  try { const r = await api('/api/settings', { [k]: v, email: currentUser()?.email }); settings = r.settings; toast('Setting saved.', 'success'); } catch (e) { toast(e.message); }
};
window.reseedSerial = async (type, seedVal) => {
  const el = document.getElementById('seed-' + type);
  try {
    const r = await api('/api/settings', { reseed: { type, value: parseInt(el.value) || seedVal }, email: currentUser()?.email });
    serials = r.serials;
    toast('Serial counter updated — next ' + type + ' will be ' + (r.serials[type] + 1) + '.', 'success');
    render();
  } catch (e) { toast(e.message); }
};
window.resetDemo = async () => {
  await api('/api/reset', { email: currentUser()?.email });
  await refreshState();
  render();
  toast('Preview data reset to seed.', 'success');
};

// ---------- tiny framework ----------
const $ = sel => document.querySelector(sel);

// SVG icon sprite helper (owner: no emojis anywhere — assets/icons)
const icSvg = (name, size = 16, style = '') =>
  `<svg class="ic" style="width:${size}px;height:${size}px;${style}" aria-hidden="true"><use href="/icons.svg#${name}"/></svg>`;
const app = $('#app');
let route = 'insights';

const NAV = [
  ['insights', 'chart', 'Insights'], ['transactions', 'swap', 'Transactions'], ['customers', 'people', 'Customers'],
  ['receipts', 'doc', 'Receipts'], ['invoices', 'quote', 'Invoices'], ['mils', 'wrench', 'MILS'],
  ['sales', 'cart', 'Sales'], ['stock', 'box', 'Stock'], ['summary', 'report', 'Summary'],
  ['docs', 'pen', 'Documents'], ['settings', 'cog', 'Settings'],
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
  docs: 'Write up a Receipt, Invoice, MILS sheet, Waybill or Delivery Note — PDF mirrors your paper books',
  settings: 'Company profile, VAT, watermark & document serial counters',
};

function render() {
  const screens = {
    insights, transactions, customers: customersScreen, receipts: receiptsScreen,
    invoices: invoicesScreen, mils: milsScreen, sales: salesScreen,
    stock: stockScreen, summary: summaryScreen, docs: docsScreen, settings: settingsScreen,
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
  if (route === 'stock') return (sessionUser && ['ceo', 'admin'].includes(sessionUser.role))
    ? `<button class="btn ghost" onclick="toast('Opens the products_seed.txt importer in M2')">Import TXT</button>` : '';
  if (route === 'summary') return `<button class="btn ghost" onclick="toast('PDF export & share — Milestone M4')">Export PDF</button>`;
  if (route === 'docs') return `<button class="btn ghost" onclick="toast('Serial counters are CEO-seedable in Settings — every book starts at 000000001')">Serials</button>`;
  return '';
}

// ---------- screens ----------
function statCards() {
  return `<div class="grid cols-3">
    ${stat(icSvg('calendar', 15), 'Revenue — today', naira(revToday()), TODAY.label, '#c8102e')}
    ${stat(icSvg('calendar', 15), 'Revenue — this week', naira(revWeek()), 'Mon – Sat this week', '#1a2a4a')}
    ${stat(icSvg('calendar', 15), 'Revenue — this month', naira(revAll()), 'Net of refunds', '#f0a92e')}
    ${stat(icSvg('trend', 15), 'Avg. transaction value', naira(atv()), 'Net revenue ÷ paying txns', '#15803d')}
    ${stat(icSvg('hourglass', 15), 'Outstanding invoices', naira(outstanding()), 'Credit to collect', '#b45309')}
    ${stat(icSvg('box', 15), 'Stock value (cost)', naira(stockValue()), `${products.filter(p => !p.service).length} physical items`, '#1a2a4a')}
    ${stat(icSvg('cash', 15), 'Documents issued', String((docs || []).length), 'Receipts + invoices + MILS', '#c8102e')}
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
    <div class="fab-dial" id="fab-dial">
      <div class="fab-menu" id="fab-menu">
        <button class="fab-item" style="--i:3" onclick="startDoc('invoice')">${icSvg('quote', 16)} New Invoice <b>₦</b></button>
        <button class="fab-item" style="--i:2" onclick="startDoc('receipt')">${icSvg('doc', 16)} New Receipt</button>
        <button class="fab-item" style="--i:1" onclick="startDoc('mils')">${icSvg('wrench', 16)} New MILS Sheet</button>
      </div>
      <button class="fab-main" onclick="toggleFab()" title="Start a transaction">${icSvg('plus', 22)}</button>
    </div>
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
                <span>${methodIc(m)}</span><b>${METHOD_META[m][1]}</b>
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
window.newCustomer = () => {
  modal('New customer', `
    <input class="search" id="nc-name" placeholder="Name / Company *">
    <input class="search" id="nc-phone" placeholder="Phone (WhatsApp)" style="margin-top:6px">
    <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--gray-600);margin-top:4px"><input type="checkbox" id="nc-corp"> Corporate customer</label>
    <button class="btn primary" style="width:100%;justify-content:center;margin-top:12px" onclick="saveCustomer()">Save customer</button>`);
};
window.saveCustomer = async () => {
  try {
    await api('/api/customers', { name: $('#nc-name').value, phone: $('#nc-phone').value, corp: $('#nc-corp').checked, email: currentUser()?.email });
    closeModal();
    await refreshState();
    render();
    toast('Customer saved.', 'success');
  } catch (e) { toast(e.message); }
};

function receiptsScreen() {
  return `<div class="card list">
    ${receipts.slice().reverse().map(r => `
      <div class="item" onclick="receiptPreview('${r.no}')">
        <div class="avatar" style="background:var(--success-tint);color:var(--success)">${icSvg('doc', 16)}</div>
        <div class="grow">
          <div class="t">${r.no} — ${r.cust}</div>
          <div class="s">${r.d} · ${METHOD_META[r.m][1]} · for ${r.for} · by ${r.by}</div>
        </div>
        <div class="money">${naira(r.amt)}</div>
        <button class="btn ghost sm" onclick="event.stopPropagation();receiptPreview('${r.no}')">Preview</button>
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
      <button class="btn ghost sm" style="flex:1" onclick="toast('Sharing via wa.me — wired in M4')">WhatsApp</button>
      <button class="btn ghost sm" style="flex:1" onclick="toast('mailto: share — wired in M4')">Email</button>
      <button class="btn primary sm" style="flex:1" onclick="toast('Print dialog — wired in M4')">Print</button>
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
        <div class="avatar" style="background:var(--brand-tint);color:var(--brand-600)">${icSvg('quote', 16)}</div>
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
    <button class="btn primary" style="width:100%" onclick="signThenPay('${no}')">Continue — sign &amp; record payment</button>`);
};
window.signThenPay = no => {
  const v = invoices.find(x => x.no === no);
  const bal = invTotal(v) - v.paid;
  signGate(`Payment of ${naira(bal)} on ${no} (${C[v.cust].name})`, () => doInvPay(no));
};
window.doInvPay = async no => {
  const signer = currentUser().name;
  try {
    const r = await api('/api/invoices/pay', { no, signedBy: signer, email: currentUser()?.email });
    if (r.receipt) receipts.push(r.receipt);
    await refreshState();
    render();
    toast(`Payment recorded — receipt ${r.receipt.no} issued, signed by ${signer}.`, 'success');
  } catch (e) { toast(e.message); }
};

const ACTION_IC = { REFILL: 'fire', INSTALLATION: 'wrench', INSPECTION: 'check', REPAIR: 'wrench', CALIBRATION: 'trend' };
const actionIc = a => icSvg(ACTION_IC[a] || 'wrench', 15);
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
          <div class="avatar" style="background:${l.overdue ? 'var(--danger-tint);color:var(--danger)' : '#e8edf5;color:var(--navy-700)'}">${actionIc(l.action)}</div>
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
    <div class="kv"><b>Next due</b><span>${l.next} ${l.overdue ? '— OVERDUE' : ''}</span></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn ghost sm" onclick="closeModal();route='invoices';render();toast('Link a MILS job to an invoice — M2')">${icSvg('quote', 14)} Invoice this job</button>
      <button class="btn ghost sm" onclick="toast('Site photos stored in Mongo/GridFS — M3')">Photos (M3)</button>
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
      <div class="ttl" onclick="toggleCart(event)">${icSvg('cart', 15)} CURRENT SALE <span class="badge-count">${Object.keys(cart).length}</span>
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
        ${Object.keys(METHOD_META).map(m => `<button class="fchip ${posMethod === m ? 'active' : ''}" onclick="posMethod='${m}';render()">${methodIc(m)} ${METHOD_META[m][1]}</button>`).join('')}
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
window.doCompleteSale = async () => {
  const signer = currentUser().name;
  const items = Object.values(cart).map(l => [l.p.id, l.qty]);
  try {
    const r = await api('/api/sales', { customerId: posCust, method: posMethod, items, signedBy: signer, email: currentUser()?.email });
    if (r.receipt) receipts.push(r.receipt);
    cart = {}; posCust = null; cartOpen = false;
    await refreshState();
    render();
    toast(r.invoice
      ? `Invoice ${r.invoice.no} created & signed by ${signer} — payable later. Stock deducted.`
      : `Sale complete — ${naira(r.total)}. Receipt ${r.receipt.no} signed by ${signer}, stock updated.`, 'success');
  } catch (e) { toast(e.message); }
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
          <div class="avatar" style="border-radius:12px;background:${out ? 'var(--danger-tint);color:var(--danger)' : isLow ? 'var(--warn-tint);color:var(--warn)' : 'var(--brand-tint);color:var(--brand-600)'}">${p.service ? icSvg('wrench', 14) : p.qty}</div>
          <div class="grow">
            <div class="t">${p.name}</div>
            <div class="s">${p.id} · ${p.cat.toUpperCase()} · cost ${naira(p.cost)} · reorder @ ${p.reorder}</div>
          </div>
          ${out ? '<span class="chip bad">OUT</span>' : isLow ? '<span class="chip pending">LOW</span>' : ''}
          <div class="money">${naira(p.price)}</div>
          ${!p.service && sessionUser && ['ceo', 'admin'].includes(sessionUser.role) ? `<button class="btn ghost sm" onclick="adjustStock('${p.id}')">Adjust</button>` : ''}
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
window.doAdjust = async pid => {
  const delta = parseInt($('#adj-q').value) || 0;
  if (delta !== 0) {
    try {
      await api('/api/stock/adjust', { id: pid, delta, reason: $('#adj-r').value, note: 'Manual adjustment', signedBy: currentUser().name, email: currentUser()?.email });
      await refreshState();
      toast(`Stock adjusted (${delta >= 0 ? '+' : ''}${delta}) — logged in audit trail.`, 'success');
    } catch (e) { toast(e.message); }
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
      ${stat(icSvg('cash', 15), 'Revenue (net)', naira(rev), '', '#c8102e')}
      ${stat(icSvg('trend', 15), 'Profit estimate', naira(profit), 'Sales − item cost', '#15803d')}
      ${stat(icSvg('box', 15), 'Stock value (cost)', naira(stockValue()), '', '#1a2a4a')}
      ${stat(icSvg('hourglass', 15), 'Outstanding invoices', naira(outstanding()), '', '#b45309')}
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
              <div>${p.qty <= 0 ? 'Out' : 'Low'}</div>
              <div class="grow"><div class="t" style="font-size:12.5px">${p.name}</div><div class="s">${p.qty} left · reorder level ${p.reorder}</div></div>
              <span class="chip ${p.qty <= 0 ? 'bad' : 'pending'}">${p.qty <= 0 ? 'OUT' : 'LOW'}</span>
            </div>`).join('')}
          ${invoices.filter(v => invTotal(v) - v.paid > 0).map(v => `
            <div class="item" style="padding:9px 0">
              <div>${icSvg('quote', 15)}</div>
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

function navForRole() {
  const role = sessionUser ? sessionUser.role : 'sales';
  // CEO: everything. Admin: management set minus Settings (seeding is CEO-only).
  // Sales: operational set.
  if (role === 'ceo') return NAV;
  if (role === 'admin') return NAV.filter(([id]) => id !== 'settings');
  return NAV.filter(([id]) => ['insights', 'sales', 'stock', 'customers', 'receipts', 'invoices', 'docs'].includes(id));
}
function buildNav() {
  const visible = navForRole();
  const html = visible.map(([id, icon, label]) =>
    `<button class="${route === id ? 'active' : ''}" onclick="go('${id}')"><span class="ic">${icSvg(icon, 17)}</span>${label}</button>`).join('');
  $('#nav').innerHTML = html;
  $('#m-nav').innerHTML = html;
  if (!visible.some(n => n[0] === route)) route = visible[0][0];
  $('#pagetitle').textContent = visible.find(n => n[0] === route)[2];
}

window.addEventListener('hashchange', () => {
  const r = location.hash.replace('#/', '');
  if (NAV.some(n => n[0] === r) && r !== route) { route = r; render(); buildNav(); }
});

// =====================================================================
// AUTH — server-side accounts (salted scrypt hashes) + SIGNATURE PASSCODE
// verified by the API before any document is issued (SPEC §6.1).
// =====================================================================
const LS_SESSION = 'mtek_session_v1';
let sessionUser = null;
const currentUser = () => sessionUser;
const sessionEmail = () => { try { return localStorage.getItem(LS_SESSION); } catch (e) { return null; } };

function renderAuth(mode = 'login') {
  const auth = $('#auth');
  auth.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-card">
        <div class="lg"><svg class="ic" style="width:30px;height:30px"><use href="/icons.svg#mround"/></svg></div>
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
            <div class="gt"><svg class="ic" style="width:15px;height:15px"><use href="/icons.svg#sign"/></svg> SIGNATURE PASSCODE</div>
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
  cv.addEventListener('pointerup', () => { try { drawnSig = cv.toDataURL('image/png'); const s = $('#sig-saved'); if (s) s.textContent = drawnSig ? 'Signature saved ✓' : ''; } catch (e) {} });
}
window.clearSig = () => {
  const cv = $('#sig-canvas'); if (!cv) return;
  const ctx = cv.getContext && cv.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  drawnSig = null; const s = $('#sig-saved'); if (s) s.textContent = '';
};

window.doLogin = async () => {
  const err = m => { $('#a-err').textContent = m; };
  try {
    const r = await api('/api/auth/login', { email: $('#a-email').value, password: $('#a-pass').value });
    sessionUser = r.user;
    try { localStorage.setItem(LS_SESSION, r.user.email); } catch (e) {}
    enterApp();
  } catch (e) { err(e.message); }
};

window.doSignup = async () => {
  const err = m => { $('#a-err').textContent = m; };
  const pass = $('#a-pass').value, sig = $('#a-sig').value, sig2 = $('#a-sig2').value;
  try {
    const r = await api('/api/auth/signup', {
      name: $('#a-name').value, email: $('#a-email').value,
      password: pass, signature: sig, role: pickedRole, signaturePng: drawnSig,
    });
    if (sig !== sig2) { // client-side UX nicety; server enforces the rest
      err('Signature passcodes do not match'); return;
    }
    sessionUser = r.user;
    try { localStorage.setItem(LS_SESSION, r.user.email); } catch (e) {}
    enterApp();
  } catch (e) {
    err(e.message.includes('match') ? e.message : e.message);
  }
};

window.signOut = () => {
  sessionUser = null;
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

// ---------- SIGNATURE GATE (server-verified) ----------
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
      <button class="btn primary" style="flex:1;justify-content:center" onclick="gateSubmit('${what.replace(/'/g, '')}')"><svg class="ic" style="width:15px;height:15px"><use href="/icons.svg#sign"/></svg>&nbsp;Sign &amp; issue</button>
    </div>
    <div style="font-size:11px;color:var(--gray-400);margin-top:10px">Signing: ${what} · verified server-side</div>`);
  window._gateCb = onSigned;
};
window.gateSubmit = async () => {
  const u = currentUser();
  if (!u) return;
  try {
    const r = await api('/api/auth/signature', { email: u.email, passcode: $('#gate-sig').value });
    const cb = window._gateCb; window._gateCb = null;
    closeModal();
    cb(r.user);
  } catch (e) {
    $('#gate-err').textContent = e.message;
  }
};


// =====================================================================
// DOCS GENERATOR — serials continue the paper books, counted server-side
// (persisted; Admin reseedable in Settings)
// =====================================================================
window.nextSerial = async type => {
  const r = await api('/api/docs/issue', {
    type, signedBy: currentUser().name, email: currentUser()?.email,
    customer: docsTab === 'receipt' ? docState.receipt.name
      : docsTab === 'invoice' ? docState.invoice.name
      : docsTab === 'mils' ? docState.mils.name
      : docsTab === 'waybill' ? docState.waybill.name
      : docState.deliverynote.name,
    total: docsTab === 'receipt' ? docState.receipt.amount
      : docsTab === 'invoice' ? invGrand()
      : docsTab === 'mils' ? milsSub() * 1.075
      : 0,
    hash: (Date.now() ^ Math.floor(Math.random() * 1e9)).toString(16),
  });
  serials = r.serials; docs = r.docs;
  return r.serial;
};
window.peekSerial = type => (serials[type] || 0) + 1;
const nairaWords = n => {
  const nw = Math.floor(n), kb = Math.round((n - nw) * 100);
  return (nw.toLocaleString('en-NG')) + ' naira' + (kb ? ` ${kb} kobo` : '') + ' (in words — full text on PDF)';
};

// form state (persists per type in-session, like the Flutter generators)
const docState = {
  receipt: { irn: '', name: '', addr: '', phone: '', forWhat: '', amount: 0, method: 'Cash' },
  invoice: { variant: 'SALES INVOICE', name: '', addr: '', phone: '', lpo: '', milsRef: false, recRef: false, milsNo: '', recNo: '', advance: 0, vatOn: true, rows: [{ d: '', q: 1, r: 0 }] },
  mils: { name: '', addr: '', phone: '', lpo: '', inv: '', rec: '', weights: {}, comps: {}, compsRate: {}, advance: 0 },
  waybill: { milsNo: '', recNo: '', invNo: '', lpoNo: '', name: '', addr: '', phone: '',
             from: 'HEAD OFFICE: YY12, Kazaure Road, By Lagos Street Round About, Kaduna',
             dest: '', driver: '', driverPhone: '', vehicle: '', plate: '', colour: '',
             receiver: '', receiverPhone: '', rows: [{ d: '', spec: '', brand: '', q: '' }] },
  deliverynote: { name: '', institution: '', addr: '', phone: '', loc: '', receiver: '',
                  receiverNo: '', orderDate: '', proforma: '', custId: '', dispatch: '',
                  dmethod: '', acctNo: '', acctName: '', banker: '', summary: '',
                  rows: [{ d: '', ordered: '', delivered: '', outstanding: '' }] },
};
let docsTab = 'receipt';
window.setDocsTab = t => { docsTab = t; render(); };
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
      ${[['receipt', icSvg('doc', 14) + ' Receipt'], ['invoice', icSvg('quote', 14) + ' Invoice'], ['mils', icSvg('wrench', 14) + ' MILS'], ['waybill', icSvg('truck', 14) + ' Waybill'], ['deliverynote', icSvg('box', 14) + ' Delivery Note']]
        .map(([k, l]) => `<button class="${docsTab === k ? 'active' : ''}" onclick="setDocsTab('${k}')">${l}</button>`).join('')}
    </div>
    ${docsTab === 'receipt' ? docsReceipt() : docsTab === 'invoice' ? docsInvoice() : docsTab === 'mils' ? docsMils() : docsTab === 'waybill' ? docsWaybill() : docsDeliveryNote()}
    <div class="card" style="padding:14px;margin-top:14px">
      <button class="btn primary" style="width:100%;justify-content:center" onclick="generateDoc()">Sign &amp; generate PDF</button>
      <div style="font-size:11px;color:var(--gray-500);text-align:center;margin-top:8px">
        Requires your Signature Passcode · PDF gets the dual-office header, watermark, signature stamp &amp; verification QR · shared straight to WhatsApp/email
      </div>
    </div>`;
}

function docsReceipt() {
  const d = docState.receipt;
  return `
    <div class="serial-banner">Receipt No: <b>${String(peekSerial('receipt')).padStart(9, '0')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">book starts at 000000001</span></div>
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
    <div class="serial-banner">Invoice No: <b>${String(peekSerial('invoice')).padStart(9, '0')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">book starts at 000000001</span></div>
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
          <td>${d.rows.length > 1 ? `<button style="color:var(--danger)" onclick="docState.invoice.rows.splice(${i},1);render()">×</button>` : ''}</td>
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
    <div class="serial-banner">MILS No: <b>${String(peekSerial('mils')).padStart(9, '0')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">book starts at 000000001</span></div>
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

function docsWaybill() {
  const d = docState.waybill;
  return `
    <div class="serial-banner">Waybill No: <b>${String(peekSerial('waybill')).padStart(9, '0')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">book starts at 000000001</span></div>
    <div class="card form-card">
      <div class="fc-t">REFERENCES</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input class="f-in" style="flex:1;min-width:100px" placeholder="MILS NO" value="${d.milsNo}" oninput="docState.waybill.milsNo=this.value">
        <input class="f-in" style="flex:1;min-width:100px" placeholder="RECEIPT NO" value="${d.recNo}" oninput="docState.waybill.recNo=this.value">
        <input class="f-in" style="flex:1;min-width:100px" placeholder="INVOICE NO" value="${d.invNo}" oninput="docState.waybill.invNo=this.value">
        <input class="f-in" style="flex:1;min-width:100px" placeholder="LPO NO" value="${d.lpoNo}" oninput="docState.waybill.lpoNo=this.value">
      </div>
    </div>
    <div class="card form-card">
      <div class="fc-t">BUYER</div>
      <input class="f-in" placeholder="Buyer's name *" value="${d.name}" oninput="docState.waybill.name=this.value">
      <input class="f-in" placeholder="Phone no." value="${d.phone}" oninput="docState.waybill.phone=this.value">
      <input class="f-in" placeholder="Address" value="${d.addr}" oninput="docState.waybill.addr=this.value">
    </div>
    <div class="card form-card">
      <div class="fc-t">ITEMS — SNO / PRODUCTS / TECH. SPEC / BRAND / QTY</div>
      ${d.rows.map((r, i) => `
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input class="f-in" style="flex:3" placeholder="Product" value="${r.d}" oninput="docState.waybill.rows[${i}].d=this.value">
          <input class="f-in" style="flex:2" placeholder="Tech. spec" value="${r.spec}" oninput="docState.waybill.rows[${i}].spec=this.value">
          <input class="f-in" style="flex:1.5" placeholder="Brand" value="${r.brand}" oninput="docState.waybill.rows[${i}].brand=this.value">
          <input class="f-in" style="flex:1;max-width:70px" type="number" placeholder="Qty" value="${r.q}" oninput="docState.waybill.rows[${i}].q=this.value">
          ${d.rows.length > 1 ? `<button class="btn ghost sm" style="color:var(--danger)" onclick="docState.waybill.rows.splice(${i},1);render()">×</button>` : ''}
        </div>`).join('')}
      <button class="btn ghost sm" onclick="docState.waybill.rows.push({d:'',spec:'',brand:'',q:''});render()">Add row</button>
    </div>
    <div class="card form-card">
      <div class="fc-t">DELIVERY LOGISTICS</div>
      <input class="f-in" placeholder="Originating from" value="${d.from}" oninput="docState.waybill.from=this.value">
      <input class="f-in" placeholder="Destination *" value="${d.dest}" oninput="docState.waybill.dest=this.value">
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" placeholder="Driver's name" value="${d.driver}" oninput="docState.waybill.driver=this.value">
        <input class="f-in" style="flex:1" placeholder="Phone no." value="${d.driverPhone}" oninput="docState.waybill.driverPhone=this.value">
      </div>
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" placeholder="Vehicle's brand" value="${d.vehicle}" oninput="docState.waybill.vehicle=this.value">
        <input class="f-in" style="flex:1" placeholder="Plate no." value="${d.plate}" oninput="docState.waybill.plate=this.value">
        <input class="f-in" style="flex:1" placeholder="Colour" value="${d.colour}" oninput="docState.waybill.colour=this.value">
      </div>
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" placeholder="Receiver's name" value="${d.receiver}" oninput="docState.waybill.receiver=this.value">
        <input class="f-in" style="flex:1" placeholder="Phone no." value="${d.receiverPhone}" oninput="docState.waybill.receiverPhone=this.value">
      </div>
      <input class="f-in" placeholder="Approved by" value="CEO — mtekfiresafetyltd@gmail.com" readonly style="color:var(--gray-500)">
    </div>`;
}

function docsDeliveryNote() {
  const d = docState.deliverynote;
  return `
    <div class="serial-banner">Delivery Note No: <b>${String(peekSerial('deliverynote')).padStart(9, '0')}</b><span style="flex:1"></span><span style="font-weight:400;color:var(--gray-500)">book starts at 000000001</span></div>
    <div class="card form-card">
      <div class="fc-t">INVOICE ADDRESS</div>
      <input class="f-in" placeholder="Customer's name *" value="${d.name}" oninput="docState.deliverynote.name=this.value">
      <input class="f-in" placeholder="Institution" value="${d.institution}" oninput="docState.deliverynote.institution=this.value">
      <input class="f-in" placeholder="Address" value="${d.addr}" oninput="docState.deliverynote.addr=this.value">
      <input class="f-in" placeholder="Phone no." value="${d.phone}" oninput="docState.deliverynote.phone=this.value">
    </div>
    <div class="card form-card">
      <div class="fc-t">SHIPPING ADDRESS</div>
      <input class="f-in" placeholder="Location" value="${d.loc}" oninput="docState.deliverynote.loc=this.value">
      <input class="f-in" placeholder="Receiver" value="${d.receiver}" oninput="docState.deliverynote.receiver=this.value">
      <input class="f-in" placeholder="Receiver's no." value="${d.receiverNo}" oninput="docState.deliverynote.receiverNo=this.value">
    </div>
    <div class="card form-card">
      <div class="fc-t">DELIVERY DETAILS</div>
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" type="date" value="${d.orderDate}" onchange="docState.deliverynote.orderDate=this.value">
        <input class="f-in" style="flex:1" placeholder="Proforma Invoice ID" value="${d.proforma}" oninput="docState.deliverynote.proforma=this.value">
      </div>
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" placeholder="Customer's ID" value="${d.custId}" oninput="docState.deliverynote.custId=this.value">
        <input class="f-in" style="flex:1" placeholder="Dispatch" value="${d.dispatch}" oninput="docState.deliverynote.dispatch=this.value">
      </div>
      <input class="f-in" placeholder="Delivery Method" value="${d.dmethod}" oninput="docState.deliverynote.dmethod=this.value">
      <div style="display:flex;gap:8px">
        <input class="f-in" style="flex:1" placeholder="Account No." value="${d.acctNo}" oninput="docState.deliverynote.acctNo=this.value">
        <input class="f-in" style="flex:1" placeholder="Account Name" value="${d.acctName}" oninput="docState.deliverynote.acctName=this.value">
      </div>
      <input class="f-in" placeholder="Banker" value="${d.banker}" oninput="docState.deliverynote.banker=this.value">
    </div>
    <div class="card form-card">
      <div class="fc-t">ITEMS — S/NO / DESCRIPTION / ORDERED / DELIVERED / OUTSTANDING</div>
      ${d.rows.map((r, i) => `
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input class="f-in" style="flex:3" placeholder="Description" value="${r.d}" oninput="docState.deliverynote.rows[${i}].d=this.value">
          <input class="f-in" style="flex:1;max-width:80px" placeholder="Ord." type="number" value="${r.ordered}" oninput="docState.deliverynote.rows[${i}].ordered=this.value">
          <input class="f-in" style="flex:1;max-width:80px" placeholder="Deli." type="number" value="${r.delivered}" oninput="docState.deliverynote.rows[${i}].delivered=this.value">
          <input class="f-in" style="flex:1;max-width:90px" placeholder="Outst." type="number" value="${r.outstanding}" oninput="docState.deliverynote.rows[${i}].outstanding=this.value">
          ${d.rows.length > 1 ? `<button class="btn ghost sm" style="color:var(--danger)" onclick="docState.deliverynote.rows.splice(${i},1);render()">×</button>` : ''}
        </div>`).join('')}
      <button class="btn ghost sm" onclick="docState.deliverynote.rows.push({d:'',ordered:'',delivered:'',outstanding:''});render()">Add row</button>
      <input class="f-in" placeholder="Summary" value="${d.summary}" oninput="docState.deliverynote.summary=this.value">
    </div>`;
}

window.generateDoc = () => {
  const t = docsTab;
  const d = docState[t];
  if (t === 'receipt' && (!d.name || !d.amount)) return toast('Fill customer name and amount first');
  if (t === 'invoice' && (!d.name || !d.rows.some(r => r.d && r.r))) return toast('Fill customer name and at least one line item');
  if (t === 'mils' && (!d.name || (!Object.values(d.weights).some(q => q > 0) && !Object.values(d.comps).some(q => q > 0)))) return toast("Fill customer's name and at least one weight entry or component");
  if (t === 'waybill' && (!d.name || !d.dest || !d.rows.some(r => r.d))) return toast('Fill buyer name, destination and at least one product');
  if (t === 'deliverynote' && (!d.name || !d.rows.some(r => r.d))) return toast("Fill customer's name and at least one item description");
  signGate(`${t.charAt(0).toUpperCase() + t.slice(1)} — ${d.name}`, () => showDocPreview(t));
};

async function showDocPreview(t) {
  const u = currentUser();
  let serial;
  try { serial = await nextSerial(t); } catch (e) { return toast(e.message); }
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
        ${['Cash','Cheque','Transfer','POS'].map(m => `<span class="fchip ${d.method === m ? 'active' : ''}">${m}${d.method === m ? ' — ₦' + d.amount.toLocaleString() : ''}</span>`).join('')}
      </div>
      <div class="ds-field"><b>For: M-TEK FIRE & SAFETY LTD</b>${u ? u.name : ''}</div>
      <div class="ds-field"><b>For: CUSTOMER'S/CLIENT</b></div>
      <div class="ds-note">No guarantee cover on tested goods and services. Purchased tested goods and services cannot be returned. We bear no liability on part paid and abandoned goods. This document is invalid without stamp and seal of this company.</div>`;
  } else if (t === 'invoice') {
    const d = docState.invoice;
    body = `
      <div class="frow" style="margin-bottom:6px">
        <span class="fchip ${d.milsRef ? 'active' : ''}">MILS No: ${d.milsNo || ''}</span>
        <span class="fchip ${d.recRef ? 'active' : ''}">RECEIPT NO: ${d.recNo || ''}</span>
        ${['WAY BILL','PRO-FORMER','SERVICE INVOICE','SALES INVOICE'].map(v => `<span class="fchip ${d.variant === v ? 'active' : ''}">${v}</span>`).join('')}
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
  } else if (t === 'waybill') {
    const d = docState.waybill;
    body = `
      <div class="banner">WAYBILL</div>
      <div class="frow" style="margin-bottom:6px">
        <span class="fchip ${d.milsNo ? 'active' : ''}">MILS NO: ${d.milsNo || '—'}</span>
        <span class="fchip ${d.recNo ? 'active' : ''}">RECEIPT NO: ${d.recNo || '—'}</span>
        <span class="fchip ${d.invNo ? 'active' : ''}">INVOICE NO: ${d.invNo || '—'}</span>
        <span class="fchip ${d.lpoNo ? 'active' : ''}">LPO NO: ${d.lpoNo || '—'}</span>
      </div>
      <div class="ds-field"><b>No:</b>${String(serial).padStart(9, '0')} · <b>Date:</b>${new Date().toLocaleDateString('en-GB')}</div>
      <div class="ds-field"><b>Buyer's name:</b>${d.name} · <b>Phone:</b>${d.phone || '—'}</div>
      <div class="ds-field"><b>Address:</b>${d.addr || '—'}</div>
      <table class="ledg"><thead><tr><th>SNO</th><th>PRODUCTS</th><th>TECH. SPEC</th><th>BRAND</th><th>QTY</th></tr></thead><tbody>
      ${d.rows.filter(r => r.d).map((r, i) => `<tr><td>${i + 1}</td><td>${r.d}</td><td>${r.spec || '—'}</td><td>${r.brand || '—'}</td><td>${r.q || ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="ds-field"><b>Originating from:</b>${d.from}</div>
      <div class="ds-field"><b>Destination:</b>${d.dest}</div>
      <div class="ds-field"><b>Driver:</b>${d.driver || '—'} · <b>Phone:</b>${d.driverPhone || '—'} · <b>Vehicle:</b>${d.vehicle || '—'} · <b>Plate:</b>${d.plate || '—'} · <b>Colour:</b>${d.colour || '—'}</div>
      <div class="ds-field"><b>Receiver:</b>${d.receiver || '—'} · <b>Phone:</b>${d.receiverPhone || '—'}</div>
      <div class="ds-field"><b>Prepared by:</b>${u ? u.name : ''} · <b>Approved by:</b>CEO</div>
      <div class="ds-note"><b style="color:var(--danger)">Caution!</b> Once contact is established between the buyer or his agent with the waybill company, it is only the responsibility of the customer to do goods on transit insurance cover and tracking, until his/her goods are secured. Therefore, we bear no liability on goods lost on transit or damaged.</div>`;
  } else if (t === 'deliverynote') {
    const d = docState.deliverynote;
    body = `
      <div class="banner">DELIVERY NOTE</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px">
        <div style="flex:1;min-width:220px">
          <div class="fc-t">Invoice Address:</div>
          <div class="ds-field"><b>Customer's name:</b>${d.name}</div>
          <div class="ds-field"><b>Institution:</b>${d.institution || '—'}</div>
          <div class="ds-field"><b>Address:</b>${d.addr || '—'}</div>
          <div class="ds-field"><b>Phone no.:</b>${d.phone || '—'}</div>
        </div>
        <div style="flex:1;min-width:220px">
          <div class="fc-t">Shipping Address:</div>
          <div class="ds-field"><b>Location:</b>${d.loc || '—'}</div>
          <div class="ds-field"><b>Receiver:</b>${d.receiver || '—'}</div>
          <div class="ds-field"><b>Receiver's no.:</b>${d.receiverNo || '—'}</div>
        </div>
      </div>
      <div class="ds-field"><b>Delivery Note No:</b>${serial} · <b>Date of Order:</b>${d.orderDate || new Date().toLocaleDateString('en-GB')}</div>
      <div class="ds-field"><b>Proforma Invoice ID:</b>${d.proforma || '—'} · <b>Customer's ID:</b>${d.custId || '—'}</div>
      <div class="ds-field"><b>Dispatch:</b>${d.dispatch || '—'} · <b>Delivery Method:</b>${d.dmethod || '—'}</div>
      <div class="ds-field"><b>Account No.:</b>${d.acctNo || '—'} · <b>Account Name:</b>${d.acctName || '—'} · <b>Banker:</b>${d.banker || '—'}</div>
      <table class="ledg"><thead><tr><th>S/NO</th><th>DESCRIPTION</th><th>ORDERED</th><th>DELIVERED</th><th>OUTSTANDING</th></tr></thead><tbody>
      ${d.rows.filter(r => r.d).map((r, i) => `<tr><td>${i + 1}</td><td>${r.d}</td><td>${r.ordered || ''}</td><td>${r.delivered || ''}</td><td>${r.outstanding || ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="ds-field"><b>Summary:</b>${d.summary || '—'}</div>
      <div class="ds-note">Goods must be checked before signing as signature and or Stamp confirms correct quantity and satisfactory condition. Only payment made into the company's designated account are recognized.</div>
      <div class="ds-field"><b>Prepared by:</b>${u ? u.name : ''} · <b>Approved by:</b>__ · <b>Client:</b>__ <span style="color:var(--gray-500)">(acknowledges receipt of the goods described above)</span></div>
      <div class="ds-field" style="text-align:center;font-style:italic"><b>Motto:</b> We are not competing, we are setting standards</div>`;
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
      <button class="btn ghost sm" style="flex:1" onclick="toast('Pre-formatted message + PDF → WhatsApp (native share sheet in the app)')">WhatsApp</button>
      <button class="btn ghost sm" style="flex:1" onclick="toast('Pre-formatted message + PDF → Email (native share sheet in the app)')">Email</button>
      <button class="btn primary sm" style="flex:1" onclick="toast('Saved as mtek_${t}_${serial}_[timestamp].pdf · share sheet opens (real file in the app/PWA)')">⤓ PDF + Share</button>
    </div>`);
  toast(`Document No: ${serial} signed & issued — serial continues the paper book.`, 'success');
}

function enterApp() {
  $('#auth').style.display = 'none';
  updateUserChip();
  route = location.hash.replace('#/', '') || 'insights';
  if (!NAV.some(n => n[0] === route)) route = 'insights';
  render();
  buildNav();
}

async function boot() {
  try { await refreshState(); } catch (e) { console.error('state load failed', e); }
  const email = sessionEmail();
  if (email && !sessionUser) {
    try {
      const r = await api('/api/auth/login', { email, password: '__session_resume__' });
      sessionUser = r.user;
    } catch (e) { /* needs explicit login */ }
  }
  if (sessionUser) enterApp(); else renderAuth('login');
}

// debug/console handle (also used by smoke.test.js)
window.__mtek = () => ({ products, customers, sales, receipts, txns, invoices, mils, adjustments, currentUser, serials, docs });
window.__docsState = docState;              // live form state (same object reference)
window.__setDocsTab = t => { docsTab = t; render(); };

// boot
boot();
