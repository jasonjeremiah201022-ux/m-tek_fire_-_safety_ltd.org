// ============================================================================
// M-TEK Node API — MongoDB sections (SEPARATE DATABASES, one cluster)
//   mtek_mils      → MILS service logs (+ photo metadata)      [section: service]
//   mtek_documents → issued-document archive (PDFs metadata)  [section: documents]
//   mtek_audit     → audit-trail events                       [section: audit]
// Why separate DBs: owner directive — "avoid database entanglement". Each
// section can be dumped, indexed, secured and scaled independently.
//
// Auth: every request must carry `Authorization: Bearer <supabase-jwt>`;
// the JWT is validated against Supabase /auth/v1/user and the caller's role
// is read from public.profiles. MILS writes: CEO/Admin. Reads: all staff.
//
// Run:  cd backend/api && npm install && npm start     (MONGODB_URI in ../.env)
// ============================================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const ENV_PATH = path.join(__dirname, '..', '.env');
const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, 'utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const PORT = process.env.PORT || 8090;
const SUPABASE_URL = env.SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SECRET = env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SECRET_KEY || '';

// ---- separate databases in the cluster (owner directive) -------------------
const DB_MILS = 'mtek_mils';
const DB_DOCS = 'mtek_documents';
const DB_AUDIT = 'mtek_audit';

let client;

async function dbs() {
  if (!client) client = new MongoClient(env.MONGODB_URI, { appName: 'mtek-api' });
  if (!client.topology || !client.topology.isConnected()) await client.connect();
  return {
    mils: client.db(DB_MILS).collection('logs'),
    docs: client.db(DB_DOCS).collection('archive'),
    audit: client.db(DB_AUDIT).collection('events'),
  };
}

// ---- Supabase JWT → profile ------------------------------------------------
async function auth(req) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) throw httpErr(401, 'Missing bearer token');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SECRET, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw httpErr(401, 'Invalid or expired token');
  const user = await res.json();
  const prof = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=full_name,role`,
    { headers: { apikey: SUPABASE_SECRET, Authorization: `Bearer ${SUPABASE_SECRET}` } },
  ).then(r => r.json());
  const p = Array.isArray(prof) ? prof[0] : null;
  return { uid: user.id, email: user.email, name: p?.full_name || '—', role: p?.role || 'sales' };
}

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const json = (res, status, data) => {
  const buf = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
  res.end(buf);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = `${req.method} ${url.pathname}`;
  try {
    if (route === 'GET /health') {
      const { mils, docs, audit } = await dbs();
      await Promise.all([mils.findOne(), docs.findOne(), audit.findOne()]); // creates DBs lazily
      return json(res, 200, { ok: true, databases: [DB_MILS, DB_DOCS, DB_AUDIT] });
    }

    const user = await auth(req);

    // ---------------- MILS (mtek_mils.logs) --------------------------------
    if (route === 'GET /api/mils') {
      const { mils } = await dbs();
      const q = {};
      for (const k of ['customer_id', 'customer_name', 'equipment']) {
        if (url.searchParams.get(k)) q[k] = url.searchParams.get(k);
      }
      const logs = await mils.find(q).sort({ entry_date: -1 }).limit(500).toArray();
      return json(res, 200, { logs });
    }
    if (route === 'POST /api/mils') {
      if (!['ceo', 'admin'].includes(user.role)) throw httpErr(403, 'Only CEO or Admin can record MILS jobs');
      const body = await readBody(req);
      const { mils } = await dbs();
      const doc = {
        ...body,
        mils_no: body.mils_no || `MILS-${Date.now()}`,
        recorded_by: user.uid, recorded_name: user.name,
        created_at: new Date().toISOString(),
      };
      const out = await mils.insertOne(doc);
      await dbs().then(d => d.audit.insertOne({
        section: 'mils', action: 'create', ref: String(out.insertedId), by: user.uid, at: new Date().toISOString(),
      }));
      return json(res, 201, { ok: true, id: String(out.insertedId), mils_no: doc.mils_no });
    }

    // ---------------- Document archive (mtek_documents.archive) ------------
    if (route === 'GET /api/documents') {
      const { docs } = await dbs();
      const q = {};
      if (url.searchParams.get('doc_type')) q.doc_type = url.searchParams.get('doc_type');
      const list = await docs.find(q).sort({ issued_at: -1 }).limit(500).toArray();
      return json(res, 200, { documents: list });
    }
    if (route === 'POST /api/documents') {
      const body = await readBody(req);
      const { docs } = await dbs();
      const out = await docs.insertOne({ ...body, issued_by: user.uid, issued_name: user.name, archived_at: new Date().toISOString() });
      return json(res, 201, { ok: true, id: String(out.insertedId) });
    }

    // ---------------- Audit trail (mtek_audit.events) ----------------------
    if (route === 'GET /api/audit') {
      if (user.role === 'sales') throw httpErr(403, 'Audit trail is management-only');
      const { audit } = await dbs();
      const events = await audit.find({}).sort({ at: -1 }).limit(1000).toArray();
      return json(res, 200, { events });
    }
    if (route === 'POST /api/audit') {
      const body = await readBody(req);
      const { audit } = await dbs();
      const out = await audit.insertOne({ ...body, by: user.uid, by_name: user.name, at: new Date().toISOString() });
      return json(res, 201, { ok: true, id: String(out.insertedId) });
    }

    json(res, 404, { error: 'Unknown API route' });
  } catch (e) {
    json(res, e.status || 500, { error: e.message });
  }
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 2e6) reject(httpErr(413, 'Payload too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(httpErr(400, 'Invalid JSON')); } });
    req.on('error', reject);
  });
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () =>
    console.log(`M-TEK Mongo API → :${PORT}  (databases: ${DB_MILS}, ${DB_DOCS}, ${DB_AUDIT})`));
}
module.exports = { server, dbs, DB_MILS, DB_DOCS, DB_AUDIT };
