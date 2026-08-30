// ============================================================================
// Supabase Edge Function — issue-document
// Server-side document issuance: verifies the caller's JWT, checks their
// Signature Passcode through the RPC (bcrypt in Postgres), assigns the next
// paper-book serial atomically and writes the document_issues ledger row.
//
// Deploy:
//   supabase functions deploy issue-document --project-ref <ref>
// Call (from the app):
//   POST https://<ref>.functions.supabase.co/issue-document
//   Headers: Authorization: Bearer <user access token>, apikey: <anon>
//   Body: { "type": "receipt"|"invoice"|"mils"|"waybill"|"deliverynote",
//           "customer": "...", "total": 0, "verifyHash": "..." ,
//           "passcode": "<signature passcode>" }
// ============================================================================
import { createClient as sbClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const jwt = auth.replace(/^Bearer\s+/i, '')
    if (!jwt) throw new Error('Missing bearer token')

    const body = await req.json()
    const { type, customer, total, verifyHash, passcode } = body ?? {}
    if (!type || !passcode) throw new Error('type and passcode are required')

    // Client bound to the CALLER's JWT so auth.uid() is correct inside RPCs.
    const asUser = sbClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
    )

    const { data, error } = await asUser.rpc('mtek_issue_document', {
      p_type: String(type),
      p_customer: String(customer ?? '—'),
      p_total: Number(total) || 0,
      p_verify_hash: String(verifyHash ?? ''),
      p_passcode: String(passcode),
    })
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ ok: true, ...data }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
