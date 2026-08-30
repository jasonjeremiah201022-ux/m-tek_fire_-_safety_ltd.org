# Supabase in M-TEK — AUTH ONLY

Owner decision (2026-08-30): **MongoDB stores everything** (one cluster,
one database per section — see `backend/api/README.md`). Supabase is used
ONLY for authentication:

- GoTrue accounts (email + password) — the CEO account is created manually
  in the Supabase dashboard and hardcoded to UID `d9c7fd50-0a60-4a16-b4ab-
  041cb568a49b` in `backend/.env`.
- JWTs issued by Supabase Auth are validated by the M-TEK data API
  (`backend/api`); roles live in `mtek_people.profiles` (MongoDB), never in
  Supabase, so no business table and no RLS exists here.

There are intentionally NO migrations, tables or edge functions in this
project. `backend/.env` holds the keys:
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
