# T018/T019 — Owner QA read-only bridge (NOT DEPLOYED)

This file records a reviewed **draft** for an Owner-only Google Apps Script QA project.
No production deployment, Google Sheet write or access permission change has occurred.

## Source and data
- `ci/v7/private-owner-read-bridge.js`: standalone Apps Script V8 source for QA only.
- Reads existing disposable workbook tabs, with exact headers inspected from QA metadata:
  `DANH_MUC` (header row 4), `V7_STOCK_VIEW_QA`, `V7_ORDERS`,
  `V7_CUSTOMER_PROFILES`, `V7_CUSTOMER_BRANDS`, `V7_PAYMENT_LEDGER`.
- Mapping is **bounded** (max 2,000 sheet rows); extra/malformed headers fail closed.
- Snapshot schema: `magasin-cup.v7.read.v1`, operation `READ_SNAPSHOT_V1`.
- Price `GIÁ 1–9` is a **reference price**; it is NOT a managerial approval to sell.
- For unconfirmed stock, `onHand` and `held` remain `null`. Unknown ≠ zero.
- Customer phone is redacted in the generic snapshot. Real customer data must never
  be exposed through public Pages, logs, GitHub Issues or screenshots.
- Debt is `null` until verified customer-level ledger reconciliation is built;
  order receipts come only from confirmed ledger records and reversals.

## Server authorization and environment
The draft requires these Script Properties in a **separate protected private QA script**:
- `V7_QA_READ_MODE=OWNER_ONLY_READ`
- `V7_QA_READ_OWNER_EMAIL` is set to the verified Owner identity
- `V7_QA_READ_BOOK_ID` equals the known, isolated QA test workbook (not production)

Only a Google account that matches both `Session.getActiveUser().getEmail()`
and `Session.getEffectiveUser().getEmail()` can read. Blank ActiveUser is rejected,
rather than granting owner permissions through EffectiveUser alone.
The QA workbook ID and title must match both pinned values in the draft.
No `doGet`, `doPost`, `UrlFetchApp`, stock writers, or Web App deployment are included.
Do not loosen permissions, set access to ANYONE or deploy execute-as-Owner publicly.

## Read-only QA deployment checklist — OPEN
1. Manually compare code and exact V7 sheet headers in a non-production context.
2. Verify Apps Script identity semantics when the Owner is signed in.
3. Confirm that the isolated script reads only the pinned disposable workbook.
4. Install draft only after Owner authorization and verify private Project Settings.
5. Run a single manual `v7OwnerReadSnapshot({schema:'magasin-cup.v7.read.v1',operation:'READ_SNAPSHOT_V1'})`
   inside the Owner-only context; capture **aggregate results only**, no private records.
6. Verify blank/mismatched/non-Owner account returns AUTH_REQUIRED/FORBIDDEN and no data.
7. Confirm `loadReadOnlySnapshot` validation accepts the returned snapshot ONLY in a
   private authenticated UI, not on the public Github Pages demo.
8. Keep real write operations, stock changes, payment or V7 release gated under T015 #12.

## Known limitations
- Strict conversion of money/legacy catalog formats may deliberately yield READ_FAILED.
- Customer profile table in disposable QA can be empty; no customer PII should be synthesized.
- Data snapshots are not full business E2E, and this bridge has no authorization for Sales
  or Warehouse roles. Future RBAC must be checked server-side separately.
- Physical stock vs legacy column divergence must be reconciled before live use.
- No automatic execution, deployment, or retrospective PASS is claimed.