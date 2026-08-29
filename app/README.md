# M-Tek Inventory — Flutter app

One Dart codebase → **Android app**, **Windows app**, and **PWA** (web), as agreed in [`docs/SPEC.md`](../docs/SPEC.md).

## Status: M1 skeleton + auth & digital signatures

- ✅ **Accounts with TWO secrets**: account password (signs in) + **Signature
  Passcode** (signs documents — SPEC §6.1). Signup enforces passcode ≠ password,
  minimum lengths, and optionally captures a drawn signature
- ✅ **Signature gate** before issuing: completing a sale, recording an invoice
  payment — wrong passcode = document NOT issued; receipts stamp
  `✓ Digitally signed by <name>` (+ drawn signature image)
- ✅ Navigation shell (rail on desktop, drawer on phones) — all 9 screens
- ✅ M-Tek brand theme (navy `#0a1220`, brand red `#c8102e`, gold `#f0a92e`)
- ✅ Working sample dataset (Aug 2026) that stays internally consistent:
  completing a **Sale** decrements stock and auto-issues a **Transaction +
  Receipt** (or an **Invoice** on credit)
- ✅ PWA manifest + themed boot screen
- M2 replaces `SampleStore` with a Drift (SQLite) repository + TXT importer
- M3 wires Supabase (money/inventory, salted passcode hashes, signature
  images in Storage, audit table) + MongoDB (MILS documents) behind the same
  repository API, with a sync queue for offline use

Demo account: `admin@mtek.demo` / password `admin123` / signature passcode `1234`.

## Where it lives

PWA: `https://mtekfiresafetyltd.github.io/m-tek_fire_safety_ltd.org/app/`
(activate via `docs/ci/build-app.yml` — see SPEC §11).

## Screens

| # | Screen | Highlights |
|---|--------|-----------|
| 1 | Insights | Revenue (day/week/month), avg. transaction value, breakdown by category & payment method (fl_chart) |
| 2 | Transactions | Unified ledger, filters, detail sheet |
| 3 | Customers | Search, corporate/individual, credit balance, purchase history |
| 4 | Receipts | Auto-numbered MTK-REC-####, branded preview, WhatsApp/email/print (M4 wires real PDFs) |
| 5 | Invoices | MTK-INV-####, progress bars, UNPAID/PARTIAL/PAID/OVERDUE, record payment |
| 6 | MILS | Maintenance Information Log Sheet — next-due tracking, overdue alerts |
| 7 | Sales | POS: cart → discount slot → payment method → complete |
| 8 | Stock | Quantities, cost/sell prices, low-stock alerts, adjustments with audit trail |
| 9 | Summary | Daily/weekly/monthly report: revenue, profit estimate, top products, stock value |

## Run locally (needs Flutter 3.24+)

```bash
cd app
flutter pub get
flutter run -d windows        # desktop
flutter run -d <android-id>   # phone
flutter run -d chrome         # web
```

## Build

```bash
# PWA (served at /app/ on the website)
flutter build web --release --base-href=/app/

# Android APK
flutter build apk --release

# Windows
flutter build windows --release
```

CI (`docs/ci/build-app.yml` (copy to `.github/workflows/build-app.yml` to activate)) builds the PWA on every push that
touches `app/**` and can deploy site + app together to GitHub Pages on
demand — no local Flutter install required.
