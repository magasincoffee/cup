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

## Versioned read-only snapshot boundary (T018 / T019 / T022 / T023 / T024)

The public UI validates a `magasin-cup.v7.read.v1` envelope before rendering.
It continues to use only `DEMO_PUBLIC` fixtures. No Apps Script URL or
Google API is called from public GitHub Pages.

The future Owner QA transport uses the operation `READ_SNAPSHOT_V1` and
returns an object containing `ok: true` and `envelope` with the fields:
`schema`, `source: OWNER_QA`, `readOnly: true`, `revision`, `issuedAt`,
and `payload: {products: [], orders: [], customers: []}`.

Product fields: `sku`, `name`, `pack`, `unit`, integer `priceVnd`,
boolean `openingConfirmed`, `onHand`, `held`. When not confirmed, both
stock quantities **must be null**, not zero. Orders: `id`, `customer`,
`brand`, `phase`, `payment`, nullable `total`, integer `received`,
`ship`, `date`. Customers: `id`, `name`, `brand`, optional `phone`,
nullable integer `debt`.

A **private** Apps Script bridge must authorize the Owner at the server,
reject a blank/missing identity, map only read APIs on a dedicated QA
workbook and return fresh data. It must not include write APIs.
An `OWNER_QA` string or `allowPrivateQa` flag in JavaScript is NOT
authentication. Never send this response into public GitHub Pages, logs,
screenshots or third-party analytics. Do not commit private identifiers.

The client intentionally rejects mismatched schema, stale QA data,
duplicates, invalid money, unknown stock incorrectly replaced by zero,
and AUTH_REQUIRED/FORBIDDEN responses. It never uses partial snapshots.

### QA handoff (not yet performed)

1. Review actual QA Apps Script read API signatures and deployment identity.
2. Build a private server-side bridge with strict Owner authorization.
3. Inject that read-only transport into an Owner-only QA HTML context.
4. Test signed-in read views, empty data, unauthorized access and privacy.
5. Keep public Pages in DEMO mode and all mutation buttons disabled.
6. Require additional write/fault/rollback gates before releasing V7.
