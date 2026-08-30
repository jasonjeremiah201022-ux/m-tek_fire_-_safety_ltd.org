# Supabase in M-TEK — AUTH + the data-api Edge Function

Owner decisions (2026-08-30): **no Render** (or any PaaS). Supabase hosts
authentication AND the data API as an **Edge Function**; **MongoDB stores
everything** (one cluster, one database per section).

- Auth: GoTrue accounts. The CEO account is locked to
  `mtekfiresafetyltd@gmail.com` (UID `d9c7fd50-0a60-4a16-b4ab-041cb568a49b`
  in `backend/.env`) — auto-confirmed, never registered.
- Data API: `supabase/functions/data-api/` — all routes, authority matrix,
  self-provisioning (serials start 000000001; catalogue seeded from the
  owner's real `seed/products_seed.txt`).

## Deploy (clicks only)
- **Option A — dashboard:** Edge Functions → Create → name `data-api` →
  paste the files from `supabase/functions/data-api/` → Deploy.
- **Option B — automatic:** add repo secrets `SUPABASE_ACCESS_TOKEN` +
  `SUPABASE_PROJECT_ID`, copy `docs/ci/deploy-edge.yml` into
  `.github/workflows/` — every push deploys it.
- Function secrets (dashboard → Edge Functions → Secrets): you only ADD three —
  `MONGODB_URI`, `MTEK_CEO_UID`, `MTEK_CEO_SIG`. The `SUPABASE_SECRET_KEY(S)`
  is already there as a Supabase default — leave it untouched; the function
  reads it under any of its names.

## App base URL
`MILS_API_BASE=https://kshuadjcflwlidupnqly.supabase.co/functions/v1/data-api`
