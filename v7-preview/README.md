# MAGASIN CUP POS V7 — UI preview (T017/T018, partial T019–T025)

**Status: public, read-only, synthetic frontend preview. NOT a POS release.**
This directory is deliberately separate from the Google Apps Script project,
V6.4 production, QA @4 and the isolated T015 fault lab.

## Scope delivered
- One responsive app shell: sidebar, header, desktop/mobile navigation.
- Dashboard, sales quote/cart, order list/details, customers/brands, stock,
  payments/debt, reports, and settings/role reference.
- Price negotiation per order line; four shipping policies
  (INCLUDED, FREE, SEPARATE, PENDING); printing fee and discount.
- PENDING shipping yields no authoritative official total.
- Inventory opening not confirmed => UNKNOWN/null, never silently 0.
- Confirmed receipt and reversal accounting is separate from order status.
- Example SKU/order/customer records are explicitly synthetic.
- Navigation and quote editor have working client-only interactions.
- Save, confirm, payment, stock entry/issue and export are intentionally disabled.

## Not delivered / not attested
- No Apps Script connector or logged-in Owner QA. No production records.
- No authentication or backend RBAC, durable draft, release, real receipts,
  real stock movements, customer file, or browser E2E.
- No real-time sales or financial dashboard. Data are fixture placeholders.
- T015 Issue #12 G1/G2/G3 remain blocked independently.

## Local inspection
Open index.html using a basic local static HTTP server, or a Pages preview
only after verifying the deployed URL. ES module imports need HTTP(S).

## Validate
Run Node.js 22:
    node --test v7-preview/logic.test.mjs
    node --check v7-preview/app.js

## Next implementation gate
1. Review desktop 1440 px and mobile 390 px; correct spacing, scrolling,
   menu/bottom-nav accessibility and action labels.
2. Create a read-only Apps Script *adapter contract* using versioned typed
   response schemas for list/read operations and errors; do not hardcode
   credentials or URLs and do not wire write APIs.
3. Validate authenticated Owner read-only against a safe QA deployment.
4. Complete backend authorization, idempotency, revision, transaction
   guard and reconciliation gates before enabling any mutations.
5. Full production V7 release requires cross-module signed-in E2E plus
   rollback plan. Never cut over production based on UI preview CI alone.
