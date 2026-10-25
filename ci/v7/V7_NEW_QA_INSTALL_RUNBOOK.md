# MAGASIN CUP V7 — Safe installation into Owner QA project

**Target (new empty standalone script):**
`https://script.google.com/d/1DKoSZ3YcLDYqGJ9HoRcZNz8El9cEXDO_IfwBhjKh_wx2BzloJhZafI1V/edit`

Google Drive metadata verified project title `MAGASIN CUP V7 QA` and project
type `application/vnd.google-apps.script` on 2026-10-25.
Private script source has not yet been retrieved by a Google Apps Script API.

## Workflow: manual-only, one-time

GitHub Actions workflow: `.github/workflows/v7-owner-qa-install.yml`.
The Owner's previously configured GitHub protected environment `cup-t015-qa`
supplies a clasp OAuth credential; **it never targets the T015 script**.
New target script ID is pinned both in the runner and the test suite.

**First execution — PRE-FLIGHT (NO WRITES):**
1. Open GitHub Actions > `MAGASIN CUP V7 new Owner QA read bridge`.
2. Run workflow on `main` with `mode=preflight`, leave `confirm` blank.
3. The runner checks that the exact target is a pristine standalone Apps Script.
4. Inspect for `V7_QA_PREFLIGHT_PASS_NO_SCRIPT_WRITES` in the job summary/log.
5. If the new blank script already contains custom files, preflight stops
   and installation must NOT proceed. Resolve the change intentionally.

**Second execution — INSTALL (SOURCE ONLY, no execute/deploy):**
1. Only after preflight PASS, run the same workflow on `main`.
2. Set `mode=install`, `confirm=INSTALL_V7_QA_READONLY`.
3. It repeats the pristine check, adds `V7_OwnerReadQA.js` only,
   pushes source to the exact new QA project, and pulls it back to verify.
4. It does NOT set Script Properties, execute Apps Script, create Web Apps,
   access transaction data or change production / T015 projects.
5. Confirm `V7_QA_BRIDGE_INSTALL_PASS_READBACK_VERIFIED` and
   `STOP_NO_RUN_NO_DEPLOY_NO_SCRIPT_PROPERTIES_NO_SHEET_WRITES`.

## After installation — protected Owner-only health check

Do not run until correct Owner identity and separate QA binding have been
verified. In *new V7 QA project's* Project Settings > Script Properties:
- `V7_QA_READ_MODE` = `OWNER_ONLY_READ`
- `V7_QA_READ_OWNER_EMAIL` = verified signed-in Google Owner email (do not share)
- `V7_QA_READ_BOOK_ID` = verified disposable QA workbook ID (not production)

Use the Apps Script editor and manually run `v7OwnerReadHealth`, not
`v7OwnerReadSnapshot`. The health function returns aggregate counts only.
Expected current inventory shape from read-only Sheet metadata:
130 products, 129 UNKNOWN stock, 126 prices pending review; these are
reference expectations, not authorization or proof of runtime readiness.

**Negative tests:** leave the read mode disabled or use an unauthorized
account in a separate **private** QA session; expect AUTH_REQUIRED or
FORBIDDEN without returning records. Do not publish a `doGet`/`doPost`,
deploy a Web App accessible to Anyone, or connect public Pages to QA data.

## Blocking conditions before V7 release

- Signed-in Owner read SUCCESS plus non-Owner read FORBIDDEN.
- Source check of authorization and read-only surface.
- Signed-in private UI E2E without public disclosure of customer data.
- Transaction writers (T015) Owner gate, lease, lock, idempotency and
  recovery accepted; rollback and backup practiced.
- V6.4 production untouched until every release gate is complete.