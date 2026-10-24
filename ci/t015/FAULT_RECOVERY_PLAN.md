# T015 — Runtime fault-recovery acceptance plan (isolated QA)

**Status:** Design and deterministic simulation only. Not a successful live Apps Script fault-injection test. Current signed-in Owner-only QA @4 remains completed, read-only, and must not be reused for destructive drills.

## Grounded baseline (24/10/2026)

- Source-of-truth: [MAGASIN CUP V7 SOT](https://docs.google.com/document/d/1NcsY3LsTxj_UxLQRjknBTJizVyrfJmP1aS79rwfWw5s/edit).
- Owner QA @4: [Web App](https://script.google.com/macros/s/AKfycby4tctwid4mhhUTndqy_Mp2UpEAf3fwmZqE1FAJ8w0zCGmBo1JB7NM-ZB86-Zc6Qbk/exec).
- Only one TEST opening SKU `UKP95-700PP-C-T` = 10 thùng. TEST ledger after happy-path E2E: RECEIPT +3, ISSUE -1, one RELEASED reservation 2/2; computed 12 thùng on-hand and available.
- Prior QA @4: two signed-in read-only UI screens PASS; write gate closed, run COMPLETED. 129 SKUs have UNKNOWN opening stock.

## Simulation coverage

The Node tests `node --test ci/t015/fault-recovery.test.mjs` exercise a **synthetic in-memory implementation**, not the actual Apps Script source. Its desired recovery decisions are:

| Interruption | Recovery expectation | Read availability |
|---|---|---|
| Before journal PREPARED | No transaction; no duplicate state | Existing balances |
| After PREPARED, before business effects | Require Owner review; no automatic replay | Quarantine until resolved |
| After movement/hold side effects, before audit | Treat as partial/ambiguous; do not auto-commit or replay | Quarantine |
| After exact business state and audit, before COMMITTED flag | Exact after-image check plus Owner authorization | Quarantine until approval |
| Replay of already COMMITTED identical request | Same result, zero new movements | Existing balances |
| Same request ID, changed operation/hash/quantity | Reject; no silent second operation | Existing balances |
| Expired lease, Owner unauthorized, unknown opening | Fail closed before durable write | UNKNOWN or existing safe balances |

**Important:** This is a proposed contract. Any difference between actual Apps Script journal protocol and simulation must be reconciled against source before live testing. Never modify actual Apps Script to fit a synthetic PASS without examining business semantics.

## Required live QA setup — separate from the completed T015 @4

1. Make a **new disposable QA spreadsheet copy** of the T015 staging workbook (not production, not the immutable evidence snapshots). The copy must retain all 35+ tabs, formulas, identifiers and demo-only stock.
2. Create a **new separate Apps Script project** with its own script ID pointing only to the disposable workbook. Verify OAuth Owner and `webapp.access=MYSELF` / `USER_DEPLOYING` before any write.
3. Require isolated `T015_WRITES_ENABLED=FALSE` by default; add a short, one-operation lease and a deterministic injection hook enabled only in the disposable project. Never copy the Owner's OAuth secret, real customer records, or production Script Properties into a public repository.
4. Save pre-fault snapshot and record exactly one unique request ID, payload hash, document references and expected pre/post images. Verify opening/count state before starting.
5. For each fault, use a **fresh disposable copy** or a fully verified Owner reset, and stop on the first unexpected write. Do not try to force an ambiguous ledger back to a guessed balance.
6. Read back raw `V7_STOCK_MOVEMENTS`, `V7_STOCK_RESERVATIONS`, `V7_IDEMPOTENCY`, `V7_AUDIT_EVENTS` and computed V7 availability directly. Compare exact request IDs, movement count, audit state, and Owner recovery result. Do not rely only on an HTML success banner.
7. Acceptance requires no duplicate movement, no negative/unknown-as-zero available stock, no unauthorized Owner bypass, and permanently closed write gate after each run. Replay remains refused when unresolved.
8. Only after runtime tests PASS consider implementing return/adjustment and freight allocation in separately reviewed QA changes.

## Next gate

`T015_RUNTIME_FAULT_SOURCE_AUDIT`: read actual immutable @4 source via an authenticated, **manual read-only** GitHub Actions job; verify recovery/lock/journal guard locations and confirm the synthetic test cases match actual persisted columns/state transitions. Do **not** use the GitHub deployment workflow for this audit or run any one-shot stock operation.

`T015_RUNTIME_FAULT_ISOLATED_DRILL` stays BLOCKED until the disposable workbook and separate script project are proven isolated. Neither a simulated PASS nor a completed read-only source audit is production release approval.
