# M-TEK Mongo API — separate databases per section

One cluster, THREE databases (owner directive: "avoid database entanglement"):

| Database          | Section                 | Collections |
|-------------------|-------------------------|-------------|
| `mtek_mils`       | MILS service records    | `logs`      |
| `mtek_documents`  | issued-document archive | `archive`   |
| `mtek_audit`      | audit trail             | `events`    |

## Run
```
cd backend/api && npm install && npm start     # :8090
```
`MONGODB_URI` + Supabase keys come from `backend/.env` (gitignored).

## Auth
Every route (except `GET /health`) requires `Authorization: Bearer <supabase-jwt>`;
the JWT is validated against Supabase and the caller's role comes from
`public.profiles`. MILS writes + audit reads: CEO/Admin only.

## Routes
- `GET  /health`
- `GET|POST /api/mils` — service logs (`?customer_id=&equipment=`)
- `GET|POST /api/documents` — document archive (`?doc_type=`)
- `GET|POST /api/audit` — audit events (management-only read)
