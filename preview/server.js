// M-Tek Inventory — PREVIEW API SERVER (Phase B: real, persisted, no placeholders)
// ---------------------------------------------------------------------------------
// Static preview + a real REST API backed by a JSON database on disk
// (preview/.data/db.json, gitignored). Mirrors the contract the Flutter app
// uses against Supabase (money/inventory) and the Node API (MILS), so the
// preview exercises genuine create/read/persist flows:
//
//   GET  /api/state                       → whole dataset (products, customers, …)
//   POST /api/auth/signup                 → salted-hash account (password + SIGNATURE passcode)
//   POST /api/auth/login                  → session (safe user)
//   POST /api/auth/signature              → server-side Signature Passcode verification
//   POST /api/sales                       → complete sale: stock ↓, txn + receipt issued
//   POST /api/invoices/pay                → record payment: txn + receipt issued
//   POST /api/stock/adjust                → adjustment + audit trail
//   POST /api/customers                   → create customer
//   POST /api/docs/issue                  → document serial (continues paper books) + history record
//   GET  /api/docs/history                → issued documents ledger
//   POST /api/settings                    → VAT toggle / serial reseed / watermark
//   POST /api/reset                       → restore seed dataset (dev convenience)
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.txt': 'text/plain',
};

// ---------------------------------------------------------------- database
const seed = require('./seed-data.js');
let db;
let saveTimer = null;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return;
    }
  } catch (e) {
    console.error('db unreadable, reseeding:', e.message);
  }
  db = JSON.parse(JSON.stringify({
    products: seed.products, customers: seed.customers, sales: seed.sales,
    invoices: seed.invoices, txns: seed.txns, mils: seed.mils,
    adjustments: seed.adjustments, serials: { ...seed.DEFAULT_SERIALS },
    settings: { ...seed.DEFAULT_SETTINGS },
    users: [{
      name: 'Admin', email: 'admin@mtek.demo', role: 'admin',
      passwordHash: hash('admin123'), sigHash: hash('1234'), signaturePng: null,
    }],
    docs: [], // issued-document history (receipts/invoices/MILS generated)
  }));
  // Historical receipts derived from the seeded transactions (books started at 0001)
  const custName = ref => {
    if (ref.startsWith('MTK-INV')) {
      const inv = seed.invoices.find(v => v.no === ref);
      const c = inv && db.customers.find(x => x.id === inv.cust);
      return c ? c.name : '—';
    }
    if (ref.startsWith('Return')) return 'Alhaji Musa Ibrahim';
    const sale = seed.sales.find(s => s.id === ref);
    const c = sale && db.customers.find(x => x.id === sale.cust);
    return c ? c.name : '—';
  };
  db.receiptsIssue = db.txns.map((t, i) => ({
    no: 'MTK-REC-' + String(i + 1).padStart(4, '0'),
    d: t.d, amt: Math.abs(t.amt), m: t.m, signed: 'Admin', by: 'Admin',
    cust: custName(t.ref), for: t.ref,
  }));
  persistNow();
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 120);
}
function persistNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));
  } catch (e) {
    console.error('persist failed:', e.message);
  }
}

// ---------------------------------------------------------------- auth utils
function hash(input) {
  if (typeof input !== 'string' || input.length === 0) return '';
  const salt = 'mtek::v1::';
  return crypto.scryptSync(salt + input, 'mtek-static-salt', 16).toString('hex');
}
const safeUser = u => ({ name: u.name, email: u.email, role: u.role, signaturePng: u.signaturePng || null });
const findUser = email => db.users.find(u => u.email === String(email || '').trim().toLowerCase());

// ---------------------------------------------------------------- helpers
const nairaPart = n => Math.floor(Number(n) || 0);
const saleTotal = s => s.items.reduce((sum, [, id]) => sum + unitPrice(s, id), 0);
function product(id) { return db.products.find(p => p.id === id); }
function unitPrice(sale, id) {
  const p = product(id);
  if (!p) return 0;
  if (typeof sale.prices === 'object' && sale.prices && sale.prices[id] != null) return sale.prices[id];
  return p.price;
}
function saleTotalMoney(s) {
  return s.items.reduce((sum, [id, q]) => sum + unitPrice(s, id) * q, 0);
}
function invTotal(v) {
  return v.items.reduce((sum, [id, q]) => sum + (product(id) ? product(id).price * q : 0), 0);
}
function pushTxn(type, amt, m, ref) {
  const t = { id: 'TXN-' + String(db.txns.length + 1).padStart(4, '0'), d: 'now', type, amt, m, ref };
  db.txns.push(t);
  return t;
}
function pushReceipt(custName, amt, m, forDoc, signedBy) {
  const r = {
    no: 'MTK-REC-' + String(db.serials.receiptIssue = (db.serials.receiptIssue || 0) + 1).padStart(4, '0'),
    d: 'now', amt, m, cust: custName, for: forDoc, by: signedBy, signed: signedBy,
  };
  db.receiptsIssue = db.receiptsIssue || [];
  db.receiptsIssue.push(r);
  return r;
}

// ---------------------------------------------------------------- API
const routes = {
  'GET /api/state': () => ({
    products: db.products, customers: db.customers, sales: db.sales,
    invoices: db.invoices, txns: db.txns, mils: db.mils, adjustments: db.adjustments,
    serials: db.serials, settings: db.settings, docs: db.docs,
    receiptsIssue: db.receiptsIssue || [],
  }),

  'POST /api/auth/signup': body => {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const signature = String(body.signature || '');
    const role = body.role === 'sales' ? 'sales' : 'admin';
    if (name.length < 2) throw httpErr(400, 'Enter your full name');
    if (!email.includes('@')) throw httpErr(400, 'Enter a valid email');
    if (password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
    if (signature.length < 4) throw httpErr(400, 'Signature passcode must be at least 4 characters');
    if (signature === password) throw httpErr(400, 'Signature passcode must be different from your password');
    if (findUser(email)) throw httpErr(400, 'An account with that email already exists');
    const user = {
      name, email, role,
      passwordHash: hash(password), sigHash: hash(signature),
      signaturePng: typeof body.signaturePng === 'string' && body.signaturePng.startsWith('data:image')
        ? body.signaturePng.slice(0, 200000) : null,
    };
    db.users.push(user);
    persist();
    return { user: safeUser(user) };
  },

  'POST /api/auth/login': body => {
    const user = findUser(body.email);
    if (!user || user.passwordHash !== hash(String(body.password || ''))) {
      throw httpErr(401, user ? 'Wrong password' : 'No account with that email');
    }
    return { user: safeUser(user) };
  },

  'POST /api/auth/signature': body => {
    const user = findUser(body.email);
    if (!user || user.sigHash !== hash(String(body.passcode || ''))) {
      throw httpErr(401, 'Signature passcode does not match — document NOT issued');
    }
    return { ok: true, user: safeUser(user) };
  },

  'POST /api/sales': body => {
    const { customerId, method, items, signedBy } = body;
    const cust = db.customers.find(c => c.id === customerId);
    if (!cust) throw httpErr(400, 'Select a customer');
    if (!Array.isArray(items) || items.length === 0) throw httpErr(400, 'Cart is empty');
    if (!signedBy) throw httpErr(403, 'Not signed — sale not issued');
    for (const [id, q] of items) {
      const p = product(id);
      if (!p) throw httpErr(400, 'Unknown product ' + id);
      if (!p.service && q > p.qty) throw httpErr(400, `Only ${p.qty} ${p.unit} of ${p.name} in stock`);
    }
    const sale = {
      id: 'S' + (db.sales.length + 1), day: 29, hour: new Date().getHours(),
      cust: customerId, method: method === 'credit' ? 'credit' : method, items,
      prices: Object.fromEntries(items.map(([id]) => [id, product(id).price])),
    };
    db.sales.push(sale);
    for (const [id, q] of items) {
      const p = product(id);
      if (!p.service) p.qty -= q;
    }
    const total = saleTotalMoney(sale);
    let invoice = null, receipt = null, txn = null;
    if (method === 'credit') {
      invoice = {
        no: 'MTK-INV-' + String(++db.serials.invoice).padStart(4, '0'),
        issued: 29, due: '12 Sep 2026', cust: customerId, items: items.slice(), paid: 0,
      };
      db.invoices.unshift(invoice);
      cust.balance += total;
    } else {
      txn = pushTxn('sale', total, method, sale.id);
      receipt = pushReceipt(cust.name, total, method, sale.id, signedBy);
    }
    persist();
    return { sale, invoice, receipt, txn, total, products: db.products, customers: db.customers,
             invoices: db.invoices, txns: db.txns, serials: db.serials };
  },

  'POST /api/invoices/pay': body => {
    const inv = db.invoices.find(v => v.no === body.no);
    if (!inv) throw httpErr(404, 'Invoice not found');
    if (!body.signedBy) throw httpErr(403, 'Not signed — payment not recorded');
    const bal = invTotal(inv) - inv.paid;
    if (bal <= 0) throw httpErr(400, inv.no + ' is fully paid');
    inv.paid += bal;
    const cust = db.customers.find(c => c.id === inv.cust);
    if (cust) cust.balance = Math.max(0, cust.balance - bal);
    const txn = pushTxn('invoice', bal, 'transfer', inv.no);
    const receipt = pushReceipt(cust ? cust.name : '—', bal, 'transfer', inv.no, body.signedBy);
    persist();
    return { invoice: inv, txn, receipt, customers: db.customers, txns: db.txns };
  },

  'POST /api/stock/adjust': body => {
    const p = product(body.id);
    if (!p) throw httpErr(404, 'Product not found');
    const delta = Math.trunc(Number(body.delta) || 0);
    if (delta === 0) throw httpErr(400, 'Quantity change required');
    if (p.qty + delta < 0) throw httpErr(400, 'Adjustment would make stock negative');
    p.qty += delta;
    const adj = {
      id: 'ADJ-' + (db.adjustments.length + 1), d: 'now', pid: p.id, delta,
      reason: String(body.reason || 'CORRECTION'), note: String(body.note || 'Manual adjustment'),
      by: body.signedBy || 'Admin',
    };
    db.adjustments.unshift(adj);
    persist();
    return { product: p, adjustment: adj, adjustments: db.adjustments };
  },

  'POST /api/customers': body => {
    const name = String(body.name || '').trim();
    if (name.length < 2) throw httpErr(400, 'Customer name required');
    const corp = !!body.corp;
    const c = {
      id: 'C' + (db.customers.length + 1), name, corp,
      phone: String(body.phone || ''), balance: 0,
    };
    db.customers.push(c);
    persist();
    return { customer: c, customers: db.customers };
  },

  'POST /api/docs/issue': body => {
    const type = ['receipt', 'invoice', 'mils'].includes(body.type) ? body.type : null;
    if (!type) throw httpErr(400, 'Unknown document type');
    if (!body.signedBy) throw httpErr(403, 'Not signed — document NOT issued');
    const serial = ++db.serials[type];
    const record = {
      type, serial,
      customer: String(body.customer || '—').slice(0, 120),
      total: Number(body.total) || 0,
      signedBy: String(body.signedBy).slice(0, 80),
      verifyHash: String(body.hash || '').slice(0, 64),
      filename: `mtek_${type}_${serial}_${Date.now()}.pdf`,
      issuedAt: new Date().toISOString(),
    };
    db.docs.unshift(record);
    persist();
    return { serial, doc: record, serials: db.serials, docs: db.docs };
  },

  'GET /api/docs/history': () => ({ docs: db.docs }),

  'POST /api/settings': body => {
    const s = db.settings;
    if (typeof body.vatEnabled === 'boolean') s.vatEnabled = body.vatEnabled;
    if (typeof body.vatRate === 'number' && body.vatRate >= 0 && body.vatRate <= 0.5) s.vatRate = body.vatRate;
    if (typeof body.watermark === 'boolean') s.watermark = body.watermark;
    if (body.reseed && db.serials[body.reseed.type] != null) {
      const v = Math.trunc(Number(body.reseed.value));
      if (v > 0) db.serials[body.reseed.type] = v;
    }
    persist();
    return { settings: db.settings, serials: db.serials };
  },

  'POST /api/reset': () => {
    try { fs.unlinkSync(DB_FILE); } catch (e) { /* not present */ }
    loadDb();
    return { ok: true };
  },
};

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 2e6) { reject(httpErr(413, 'Payload too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(httpErr(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
  res.end(buf);
}

const server = http.createServer(async (req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400); return res.end();
  }

  // API routes
  const key = `${req.method} ${urlPath}`;
  if (routes[key]) {
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const result = routes[key](body);
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, e.status || 500, { error: e.message || 'Server error' });
    }
    return;
  }
  if (urlPath.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Unknown API route' });
    return;
  }

  // static files
  if (urlPath === '/') urlPath = '/index.html';
  const rel = urlPath.startsWith('/assets/') ? urlPath.slice(1) : path.join('preview', urlPath);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(buf);
  });
});

loadDb();
server.listen(PORT, '0.0.0.0', () => {
  console.log(`M-Tek app preview + API → http://0.0.0.0:${PORT}  (db: ${DB_FILE})`);
});
