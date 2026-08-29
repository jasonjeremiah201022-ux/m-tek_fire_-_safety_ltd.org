# M-Tek Inventory — M1 Design Preview

A pixel-faithful, browser-runnable **preview of the Flutter app's M1 skeleton**
(`../app`). It exists so the screens can be reviewed and steered *before* the
real Dart UI is compiled — **it is not the app itself.** The Flutter code under
`/app` is the deliverable; this preview mirrors its theme tokens, sample data
and derived math (same ₦ figures, verified by `smoke.test.js`).

## What's interactive

- **Lock screen** — sign in (`admin@mtek.demo` / `admin123`) or create an account
  with a **Signature Passcode** (separate from the password) + optional drawn signature
- **Signature gate** — completing a sale or recording an invoice payment asks for the
  Signature Passcode; wrong passcode = document NOT issued; receipts stamp
  "✓ Digitally signed by …" with the drawn signature
- All **9 screens** via the sidebar (drawer on narrow widths)
- **Sales (POS)**: add items → pick customer → payment method → *Complete sale*
  → stock decrements, Transaction + Receipt issued (credit → Invoice)
- **Invoices**: tap an unpaid invoice → record payment → receipt issued
- **Stock**: search, category filter, adjustments → audit trail updates
- **Receipts**: branded preview with WhatsApp/email/print actions (PDF in M4)
- **MILS**: overdue highlighting, job detail, "invoice this job" hook

## Run

```bash
node preview/server.js     # → http://localhost:8080
```

## Test (headless)

```bash
cd preview && npm i jsdom && node smoke.test.js
```

## Screen ↔ code map

| Preview | Flutter source |
|---|---|
| `app.js` (data + screens) | `app/lib/data/sample_store.dart` + `app/lib/ui/screens/*` |
| `app.css` (`:root` tokens) | `app/lib/core/theme.dart` |
