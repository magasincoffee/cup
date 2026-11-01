# V7 Owner QA — read-only authentication acceptance

## Evidence observed 2026-11-01

- Manual GitHub preflight run #13 (41274357224) passed with `V7_QA_EXISTING_READ_SOURCE_HASH_PASS_NO_WRITES`.
- Owner manually ran `v7OwnerQaSelfCheck` in the isolated V7 QA Apps Script and provided a screenshot of `READ_ONLY_QA_SNAPSHOT_OK`.
- Aggregate read results: products 130; unknown opening stock 129; orders 6; customer profiles 0; approved reference prices 4; requiring review 126.
- This is an isolated QA snapshot, **not** production transactions or approval of the 126 reference prices.

## Still required: independent negative authorization evidence

- Use a separately authorized QA identity, without granting it editor rights to the Apps Script or production workbook.
- Test only through a privately authenticated server-side test surface, not a public endpoint and not a client-side identity override.
- An absent identity must produce `AUTH_REQUIRED`; a different active/effective identity must produce `FORBIDDEN`.
- Denial must happen before any workbook access, with no snapshot, rows, customer details or credentials returned.
- Avoid logging identity values or customer data. Record only PASS/FAIL and error category.
- Keep read-only until real negative-role tests pass. The existing mocked Node tests are not substitute for signed-in end-to-end QA.

## Do not do

- Do not invite non-Owner identities as Apps Script editors to simulate access.
- Do not deploy the standalone read bridge as a public Web App.
- Do not modify Script Properties, enable write leases or run T015 fault drills as part of this test.
- Do not touch V6.4 production.

Next gate: a private auth test interface or test harness with independent access boundary; afterward integrate a private UI read adapter, then validate mutations and recovery separately.
