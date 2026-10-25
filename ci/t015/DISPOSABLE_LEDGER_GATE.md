# T015 — Disposable workbook fault-recovery integrity gate

**Last updated:** 25/10/2026. **Status:** read-only structural contract + synthetic unit tests. This is NOT a live fault-injection result or stock-write authorization.

## Verified source evidence

- Standalone disposable fault Script: `1Ywd72VfivnefEJMAZQ42ojw0QlfjyM1CUsbqlOJQnMkebamiZPAwvMM5`, Owner-only and separate from accepted QA @4.
- Private disposable workbook: `1nfJwdzTA99V9WSL6fdCLpMHCnYHqnUJXp505vOjYAsI`, 38/38 copied tabs.
- Manual read-only provenance [GitHub run 40175166520](https://github.com/magasincoffee/cup/actions/runs/40175166520): immutable QA @4 matches original QA HEAD, transformed new project hashes 12/12 and refers only to private disposable workbook; original one-shot lab disabled; no deployment or executions.
- Read-only baseline from clone: 15 `COMMITTED` requests, 19 audit rows, 2 `POSTED` stock movements, 1 `RELEASED` reservation. Test SKU `UKP95-700PP-C-T` opening=10 synthetic boxes, received=3, issued=1, onHand=12, held=0, available=12. Zero pending journal requests. 129 other SKUs have **unconfirmed opening inventory**; do not assume zero or positive sellable quantity.
- The 2 POSTED stock movements and 1 RELEASED hold have request IDs in both `V7_IDEMPOTENCY` and `V7_AUDIT_EVENTS`. This is evidence from this particular frozen snapshot, **not a claim of generalized Apps Script crash recovery**.

## Exact persisted columns (read directly from isolated Sheets)

`V7_IDEMPOTENCY`: request_id, operation, actor_id, body_hash_sha256, processing_state, entity_id, result_json, started_at_utc, finished_at_utc, error_code.

`V7_AUDIT_EVENTS`: audit_id, entity_type, entity_id, event_type, actor_id, before_json, after_json, request_id, source, created_at_utc.

`V7_STOCK_MOVEMENTS`: movement_id, sku, movement_type, quantity, unit, source_document_id, order_line_id, posting_status, approved_by_actor_id, posted_at_utc, request_id.

`V7_STOCK_RESERVATIONS`: reservation_id, order_line_id, sku, unit, reserved_qty, released_qty, status, revision, request_id.

## Automated offline snapshot gate

`node --test ci/t015/disposable-ledger-check.test.mjs` exercises a pure function `evaluateSnapshot(grids)`. Callers provide four arrays of tab values, header in row 1, keyed as `idempotency`, `audit`, `movements`, and `reservations`. The function returns only aggregate counts and blocker codes, never individual rows.

Fail closed on missing or drifted schemas, duplicate journal/audit/movement/reservation IDs, unfinished or unaudited COMMITTED requests, unresolved requests, stock movements not POSTED or missing journal/audit, invalid/negative quantities, unknown stock movement types requiring review, inconsistent RELEASED holds and orphan reservations. These are **intentionally conservative** integrity rules for a frozen snapshot and must be reconciled against the Apps Script operation protocol before using this in any ledger mutation workflow.

The evaluator has **no Google network access, Script Properties access, OAuth access or spreadsheet write operations**. It does not prove that a particular fault injected in Apps Script is handled safely.

## No-go criteria before runtime fault injection

1. Verify that no existing Owner QA @4 source, version, test run or production project changed. Never rerun original one-shot T015 E2E.
2. Verify the new disposable project is the *only* script connected to the new workbook.
3. Inspect Script Properties **inside the new standalone project**; ensure Owner identity matches and `T015_WRITES_ENABLED` remains false until a specifically approved fault-drill lease. Never copy Owner config from production.
4. Inspect actual Apps Script journal transition code and per-step side effects, not merely the presence of markers `PREPARED` and `COMMITTED`. Confirm which writes happen before and after auditing and lock release.
5. Require a **fresh** disposable workbook/script pair for each deliberate fault, with baseline captured, permitted request ID defined, one test SKU only and Owner acknowledgement of expected movement.
6. Never automatically replay ambiguous `PREPARED` requests, never fix ledger by editing `V7_STOCK_MOVEMENTS` or `V7_IDEMPOTENCY` manually.
7. If an invariant fails, stop the drill, close writes, leave the affected SKU quarantined, collect bounded audit evidence without secrets, and require Owner reconciliation before any resumption.

**NEXT GATE:** T015_RUNTIME_FAULT_DRILL_PROPERTIES_AND_SOURCE_REVIEW (read-only). Do not deploy a Web App or enable warehouse writes yet.
