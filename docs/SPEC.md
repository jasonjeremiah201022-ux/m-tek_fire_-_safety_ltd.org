# M-Tek Fire & Safety Ltd — Inventory & Business App: Functional Spec

**Status:** Agreed in discussion — pending final go-ahead before scaffolding.
**One codebase (this repo) → three products:** Android app, Windows desktop app, PWA website.
**Owner: M-Tek Fire & Safety Ltd** (Kaduna, Nigeria · RC 1082534) · Currency: **₦ (NGN)**.

---

## 1. Platforms & Delivery

| Target | Artifact | Notes |
|---|---|---|
| Android (phone/tablet) | APK + AAB | Sales floor + field use |
| Windows (desktop) | exe (zipped) | Office/counter use |
| Web (PWA) | Static build served at **`https://mtekfiresafetyltd.github.io/m-tek_fire_safety_ltd.org/`** | The app IS the site root of the company Pages URL (marketing website remains under `/site/`). Installable to home screen, own manifest (name, icons, brand colors) + service worker; `base href=/m-tek_fire_safety_ltd.org/` |

One Flutter (Dart) codebase in `/app` produces all three. CI (see §11) rebuilds the
APK/AAB/PWA/EXE on every push to `main` and redeploys the PWA — progress on the
codebase automatically updates everything.

## 2. Repository Layout

```
/                 existing website (unchanged)
/app/             Flutter app — all 9 screens, one codebase
/backend/
  supabase/       SQL schema, RLS policies, auth config, storage buckets, edge functions
  api/            Node service for MongoDB (MILS)
  contracts/      shared API contracts
/docs/            this spec, data model, decisions
/seed/            products_seed.txt (awaiting owner edits: cost, qty/balance, reorder, unit)
```

## 3. Screens (9)

1. **Insights** (home/dashboard) — Revenue cards (today/week/month), **Avg. Transaction Value**, **Revenue Breakdown** (by category, product, payment method); trend charts. **Admin only.**
2. **Transactions** — unified ledger: sale payments, invoice payments, refunds. Filter by date/type/method/status; tap → full detail.
3. **Customers** — CRUD; individual vs corporate; phone/email/address; purchase history; outstanding credit balance.
4. **Receipts** — auto-numbered `MTK-REC-0001`; generated on every payment received; preview, print, share (WhatsApp/email).
5. **Invoice** — `MTK-INV-0001`; bill-now-pay-later for corporates; statuses Draft → Sent → Partial → Paid (+ Overdue); payment posts a Transaction + Receipt. Can originate from a Sale or a MILS job.
6. **MILS** (Maintenance Information Log Sheet) — per-equipment service records: equipment type/serial/brand/capacity, client, site location, action (install/refill/inspection/repair), findings, parts used, technician, **next-due date** with overdue alerts, photos. Stored as flexible documents (Mongo). Job → optional Invoice.
7. **Sales** (POS) — pick customer → add items from live stock → discount → payment method (cash/transfer/POS/credit) → complete. Auto: decrement stock, create Transaction + Receipt (or Invoice if credit).
8. **Stock** — products with qty on hand, cost/selling price, reorder levels, low-stock alerts; adjustments (restock/damage/correction) with full audit trail.
9. **Summary** — period reports (daily/weekly/monthly/custom): totals, profit estimate, top products, stock valuation, outstanding invoices; export/share. **Admin only.**

**Flow:** `Sale → Transaction → Receipt` · `Invoice → Payment → Transaction + Receipt` · `Stock feeds Sales` · `MILS job → Invoice`.

## 4. Data Model (core entities)

- **Product** — id (from seed, e.g. `F001`), name, category, unit, cost_price, selling_price, qty_on_hand, reorder_level, image_url, active
- **StockAdjustment** — product, ±qty, reason, reference, note, user, timestamp
- **Customer** — name, type, phone, email, address, credit_balance, notes
- **Sale** — customer, date, items[], subtotal, discount, VAT (if enabled), total, method, status (paid/credit/partial)
- **Invoice** — customer, issue/due dates, items[], subtotal, discount, VAT, total, amount_paid, status
- **Receipt** — number, date, amount, method, source (sale/invoice/MILS job), issued_by
- **Transaction** — date, type (sale_payment/invoice_payment/refund), amount, method, linked doc
- **MaintenanceLog (MILS)** — equipment, client, location, action, findings, parts, technician, dates, next_due, photos
- **StaffUser** — Supabase auth identity, role, name, phone
- **Settings** — VAT on/off + rate (configurable per doc), business info, numbering counters

## 5. Backend

| Concern | Service |
|---|---|
| Money & inventory (products, stock, customers, sales, invoices, receipts, transactions) | **Supabase Postgres** (ACID, RLS) |
| MILS maintenance documents (+ photos) | **MongoDB Atlas** via Node API (`/backend/api`) |
| Auth & roles | **Supabase Auth** (email/OTP), role claims |
| Files (PDFs, product/MILS photos) | **Supabase Storage** |
| Offline resilience | Local Drift (SQLite) cache + sync queue — app works offline, syncs when online |

Extensible: "Supabase + Mongo and maybe more as needed."

## 6. Roles & Authentication

| Capability | Admin | Sales |
|---|---|---|
| Sell, create customers, invoices, receipts | ✅ | ✅ |
| View stock quantities | ✅ | ✅ |
| Stock cost prices, adjustments | ✅ | — |
| Insights & Summary (revenue/profit) | ✅ | — |
| MILS records | ✅ | — |
| Settings, VAT toggle, staff management | ✅ | — |

(One shared Sales login is acceptable at launch; technician self-service view is a future role.)

### 6.1 Digital Signature Passcode (no more paper signing)

Every user, **at account creation**, sets two separate secrets:

| Secret | Purpose |
|---|---|
| **Account password** | Signs in to the app |
| **Signature passcode** | Acts as the user's signature — required to *issue/authorise* any document |

Rules:

- The signature passcode is **never** the same field as the password and is hashed separately.
- Users also draw their signature once (optional but encouraged); it is stored and stamped
  onto documents next to the verified-passcode mark.
- Documents requiring a signature passcode before issue: **Receipts, Invoices,
  invoice payments, completed Sales, MILS service logs, refunds**.
- Signed documents carry: `✓ Digitally signed by <full name> · <date/time> · <signature image>` .
- Wrong signature passcode → document is **not** issued.
- M3: passcodes stored as salted hashes in Supabase (`staff.signature_passcode_hash`);
  signature images in Supabase Storage; every signature event written to an audit table.

## 7. Documents, Printing & Sharing

- Branded PDFs (M-Tek logo, ₦ formatting, sequential numbering).
- **Print** on all three platforms (Android print service / Windows dialog / browser print).
- **Share: WhatsApp + email only** (share sheet, `wa.me`, `mailto:`).
- VAT: configurable toggle (off by default; 7.5% NG rate when on; per-document override).

## 8. Seed Data Workflow

1. `seed/products_seed.txt` (358 products, tab-separated, Excel-ready) → owner fills **cost price, qty/opening balance, reorder level, unit**, sets the 38 "price on request" items.
2. Owner sends file back → importer loads it into Stock (local + Supabase) at first-run/migration.

## 9. Build Milestones

1. **M1 — Skeleton:** Flutter app, navigation shell, all 9 screens as themed placeholders, PWA manifest; runs in preview.
2. **M2 — Local data:** Drift schema + repositories; TXT importer; every screen fully functional offline with sample/seed data.
3. **M3 — Backend live:** Supabase schema/auth/RLS/storage; Mongo API + contracts; app talks to real backend with sync queue; admin/sales roles.
4. **M4 — Documents:** PDF generation, printing, WhatsApp/email sharing.
5. **M5 — Polish & ship:** charts/alerts/exports finalized; Android APK, Windows build, PWA live at the company Pages root.

## 10. Design

Matches the website's brand system (Sora/Poppins, brand color tokens from `styles.css`, M-Tek logo from assets). Material 3, mobile-first layouts that expand gracefully to desktop width.

## 11. CI/CD — "progress updates everything"

Workflow (sourced at `docs/ci/build-app.yml`; activate by copying to
`.github/workflows/build-app.yml` on the **company repo** `mtekfiresafetyltd/m-tek_fire_safety_ltd.org`,
with Settings → Pages → Source = **GitHub Actions**):

| Push to `main` (touches `app/**`) | Manual dispatch |
|---|---|
| Build **PWA** (`--base-href=/m-tek_fire_safety_ltd.org/`) → artifact | All of the left column, **plus** deploy to Pages (**app at the site root**, website under `/site/`) |
| Build **APK** + **AAB** → artifacts | Optionally cut a GitHub Release with APK/AAB/EXE attached |
| Build **Windows EXE** (zipped) → artifact | |

Live URLs after activation: **app `https://mtekfiresafetyltd.github.io/m-tek_fire_safety_ltd.org/`**
(the bare company URL opens the app), website `…/m-tek_fire_safety_ltd.org/site/`.

