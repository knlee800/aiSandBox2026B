# PRIVATE-BETA-BLOCKER-03L — Final Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03L  
**Title:** Builder Static Preview Entrypoint Contract Root-Cause Investigation + Bounded Fixture Alignment  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-22  
**Checkpoint Date:** 2026-08-22  
**Lifecycle:** 3-step NORMAL bounded task  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Lane:** Lane 1 (now released EMPTY)  
**Classification:** RUNNER_FIXTURE_FIX  
**Diagnosis:** `docs/PRIVATE-BETA-BLOCKER-03L-DIAGNOSIS.md`  
**Triggering locked evidence:** PRIVATE-BETA-E2E-LIVE-08 — COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22

Do not treat this checkpoint as a scheduler. Do not rewrite LIVE-08. Do not convert LIVE-08 to PASS. Do not rerun LIVE-08. Do not reopen AUTO-01G / AUTO-01H / AUTO-01I. Do not change product Preview. Do not register PRIVATE-BETA-E2E-LIVE-09 here. Do not register PRIVATE-BETA-INVITE-01.

Step 2 implementation is already on HEAD `6a73b2ca95883be6f82fafc15ff533bc2be58224` (`align golden-path artifact with static preview entrypoint`). Keith owns Git. This consolidation does not commit.

Step 3 pre-write observation (read-only):

- branch = `main`
- HEAD = `6a73b2ca95883be6f82fafc15ff533bc2be58224`
- `git status --short` = empty (CLEAN) before Step 3 writes

---

## Final verdict

```
FINAL_VERDICT=COMPLETE AND LOCKED — PASS — 2026-08-22
CLASSIFICATION=RUNNER_FIXTURE_FIX
ROOT_CAUSE_PROVEN=YES
FROZEN_ARTIFACT_PATH=index.html
FROZEN_HTML_MARKER=PRIVATE-BETA-E2E-AUTO
BUILDER_PROMPT_ARTIFACT=index.html
AUTO_01G_FILES_WRITE_PATH=index.html
AUTO_01H_CHANGED=NO
PRODUCT_PREVIEW_CHANGED=NO
FRONTEND_CHANGED=NO
SERVICES_CHANGED=NO
DEPENDENCIES_CHANGED=NO
LIVE_08_UNCHANGED=COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22
LIVE_RUNS=0
SSH=0
STAGING=0
PROVIDER=0
CREDITS=0
GATE_MUTATION=0
PROJECT_SESSION_CONTAINER=0
PRODUCT_CHANGES=0
FRONTEND_CHANGES=0
BACKEND_SERVICE_CHANGES=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
FOCUSED_GREEN=PASS
CONTRACT=100 passed / 0 failed
TYPESCRIPT=PASS
GIT_DIFF_CHECK=PASS
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

---

## 1. Task identity

PRIVATE-BETA-BLOCKER-03L investigated why LIVE-08 correctly persisted the golden-path HTML file and then refused static Start Preview, then applied the smallest evidence-supported correction: align the frozen golden-path artifact with the locked static Preview entrypoint.

Nature:

- Step 1: product-contract / root-cause diagnosis only
- Step 2: bounded TDD RUNNER_FIXTURE_FIX
- Step 3: fresh local verification + checkpoint / consolidation / lock

Not a Preview redesign. Not a Builder path-rewrite. Not a LIVE run. Not a product Preview/Builder source change.

---

## 2. LIVE-08 linkage

LIVE-08 remains:

```
COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22
```

Checkpoint: `docs/PRIVATE-BETA-E2E-LIVE-08-CHECKPOINT.md`  
Evidence: `docs/PRIVATE-BETA-E2E-LIVE-08-EXECUTION.md`

03L does **not** rewrite LIVE-08. 03L does **not** convert LIVE-08 to PASS. 03L does **not** rerun LIVE-08.

Frozen LIVE-08 facts used as evidence, not as the fix:

- AUTO-01I / AUTO-01H / AUTO-01G LIVE validation HELD
- BUILD `POST /api/ai/execute` 202 `executionId=145e789a-7aa8-4f7a-80c6-d7a0a6156878`
- WAIT_FOR_AUTO_APPLY PASS: `POST /api/sessions/.../files/write` path=`e2e-auto.html` HTTP 204
- generated file `/opt/aisandbox/workspaces/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/e2e-auto.html`
- marker `<h1>PRIVATE-BETA-E2E-AUTO</h1>`
- PREVIEW FAIL: Start Preview clicked; UI remained “Preview unavailable”; iframe never mounted; current static-preview prerequisite is `index.html`

LIVE-08’s historical classification remains PRODUCT_FAILURE regardless of this lock.

---

## 3. Precise runner-fixture root cause

Two independently correct contracts were never aligned in AUTO-01:

1. **Static Preview (locked HOW, PREV-02-02 / PREVIEW-STRATEGY-01A):** Start Preview starts a project-root static site. Eligibility and `/` serving require `index.html` at workspace root or one immediate subdirectory.
2. **Builder apply (locked HOW):** persist the model’s `path` exactly. The golden-path prompt named `e2e-auto.html` and forbade creating any other file, so `index.html` could not appear.

LIVE-08 therefore:

- correctly persisted `e2e-auto.html`
- correctly refused to start static Preview
- correctly left the UI in “Preview unavailable” with no iframe

The non-index filename was not required by the purpose of the golden path. Unique page identity is the heading `PRIVATE-BETA-E2E-AUTO`, not the filename. Historical E2E-02 Preview PASS used `index.html`.

This is **not** a Preview implementation regression vs PREV-02-02.  
This is **not** a Builder apply bug.  
This is **not** an AUTO-01G/H/I observation bug.

---

## 4. Legitimate `index.html` static Preview contract

Locked product HOW (PREV-02-02, preserved by PREVIEW-STRATEGY-01A):

- static Start Preview requires `/workspace/index.html` or `/workspace/<immediate-subdir>/index.html`
- HTML other than `index.html` (for example `hello.html` / `e2e-auto.html`) is a valid workspace file and is **not** a valid static-preview entrypoint
- Start Preview previews the project, not the currently selected editor file
- no HTML entrypoint field exists on the preview start request

03L does not change that product contract.

---

## 5. Classification

```
RUNNER_FIXTURE_FIX
```

Why not the others:

- **PRODUCT_IMPLEMENTATION_FIX** — would reverse PREV-02-02 / change static serving of `/`. That is a Preview redesign.
- **BUILDER_CONTRACT_FIX** — would make Builder rewrite a user-requested path to `index.html`, breaking file-action path fidelity.
- **PRODUCT_SPEC_DECISION_REQUIRED** — Start Preview behavior for static sites is already decided by PREV-02-02.

Renaming the fixture to `index.html` does **not** hide a Preview implementation bug for the golden-path class.

---

## 6. RED evidence from Step 2

Faithful TDD RED was recorded in Step 2 before GREEN. Step 3 did not destructively recreate RED.

```
Expected: index.html
Received: e2e-auto.html
```

Regression:

`e2e/builder-golden-path/tests/evidence.spec.ts`  
`uses index.html as the frozen artifact so static Preview has a valid entrypoint`

---

## 7. Implementation

Canonical constant:

```
FROZEN_ARTIFACT_PATH = 'index.html'
```

File: `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\constants.ts`

Unique frozen HTML marker **preserved**:

```
PRIVATE-BETA-E2E-AUTO
```

`FROZEN_HTML` still contains `<h1>PRIVATE-BETA-E2E-AUTO</h1>`. `PREVIEW_HEADING` remains `PRIVATE-BETA-E2E-AUTO`.

BUILD prompt construction still interpolates `FROZEN_ARTIFACT_PATH` and therefore now requests exactly `index.html`, retaining the existing single-file deterministic contract:

```
Create a single file named `index.html` in this workspace.
...
Do not create or modify any other file.
```

Committed Step 2 runner implementation scope (`6a73b2c`):

- `e2e/builder-golden-path/lib/constants.ts` (one-line path change)
- `e2e/builder-golden-path/tests/evidence.spec.ts` (regression assertion)

plus prior governance state in `TASKS.md` / `TASKS_BACKLOG_FULL.md`.

No product implementation change.

---

## 8. AUTO-01G compatibility

WAIT_FOR_AUTO_APPLY architecture is **unchanged**. It still observes:

```
POST /api/sessions/:sessionId/files/write
correct session
path = FROZEN_ARTIFACT_PATH
HTTP 204
```

Because `FROZEN_ARTIFACT_PATH` is now `index.html`, AUTO-01G therefore expects:

```
path = index.html
```

Still required:

- correct session
- POST files/write
- HTTP 204

No file-tree UI dependency (`waitForAutoApply` does not wait for `SELECTORS.autoFileNode`).  
No forced tab switch (`workspace-tab-codeFiles` remains absent from `live-adapters.ts`).  
AUTO-01G architecture was not changed.

---

## 9. AUTO-01H unchanged

AUTO-01H implementation was **not** in the Step 2 commit and remains:

- BUILD observes `POST /api/ai/execute`
- HTTP 202
- non-empty `executionId`
- bounded response/body
- same `executionId` propagated downstream

```
AUTO_01H_CHANGED=NO
```

---

## 10. Product / frontend / services / dependencies unchanged

```
PRODUCT_PREVIEW_CHANGED=NO
FRONTEND_CHANGED=NO
SERVICES_CHANGED=NO
DEPENDENCIES_CHANGED=NO
```

Fresh Step 3 diffs:

- `git diff -- frontend services` = empty
- `git diff -- package.json package-lock.json` = empty

Committed Step 2 `git show --name-only 6a73b2c -- frontend services package.json package-lock.json` = empty.

---

## 11. Fresh focused GREEN evidence

Command (from `C:\Users\knlee\aiSandBox2026B`):

```
npx playwright test --config e2e/builder-golden-path/playwright.config.ts tests/evidence.spec.ts --grep "uses index.html as the frozen artifact so static Preview has a valid entrypoint"
```

Result:

```
Running 1 test using 1 worker
ok 1 [contract] › e2e\builder-golden-path\tests\evidence.spec.ts:68:7 › evidence and preview helpers › uses index.html as the frozen artifact so static Preview has a valid entrypoint (6ms)
1 passed (625ms)
exit 0
```

---

## 12. Fresh full CONTRACT evidence

Command:

```
Set-Location "C:\Users\knlee\aiSandBox2026B"; npm run e2e:builder:contract
```

Result:

```
Running 100 tests using 10 workers
100 passed (8.9s)
0 failed
exit 0
project/suite: [contract] Playwright golden-path CONTRACT
```

Fresh Step 3 count matches the Step 2 expected count (100 passed / 0 failed). No investigation of a count drift was required.

---

## 13. Fresh TypeScript evidence

Command:

```
Set-Location "C:\Users\knlee\aiSandBox2026B"; npx tsc --noEmit --project "C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\tsconfig.json"
```

Result: PASS (exit 0, no diagnostics).

---

## 14. Fresh diff / static evidence

```
git diff --check = PASS (empty, exit 0)
git diff -- frontend services = empty
git diff -- package.json package-lock.json = empty
git status --short before Step 3 writes = empty (CLEAN)
```

Active runner search under `e2e/builder-golden-path` for `e2e-auto.html`: **no matches**. No active runtime/fixture dependency remains.

Historical locked docs outside the runner retain the old path (LIVE-08 / LIVE-06 / AUTO-01G evidence and frozen board prose). Those documents were **not** rewritten.

---

## 15. No LIVE activity

03L Step 3 was local verification + governance only.

```
LIVE runs = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gate mutations = 0
project/session/container = 0
product changes = 0
frontend changes = 0
backend/service changes = 0
dependency changes = 0
Git mutations = 0
```

Did **not** run `npm run e2e:builder:live`. Did **not** SSH staging. Did **not** deploy. Did **not** call a provider. Did **not** mutate credits. Did **not** enable gates.

---

## 16. Readiness consequence

03L is local/CONTRACT validation only.

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Do **not** declare Builder private-beta ready from 03L.

---

## 17. Next gate

Next gate is a **NEW** fresh automated provider-bearing Builder LIVE E2E.

Likely identifier: `PRIVATE-BETA-E2E-LIVE-09` (verify unused at future registration).

**Do not register LIVE-09 in this lock.**

The future LIVE task must follow the frozen AUTO-01I sequencing contract:

1. register + reserve STAGING / PROVIDER-LIVE / CREDIT / ENV; runtime mutation flags remain NO; Keith commits that reservation state
2. separate explicit Keith LIVE authorization
3. clean tree → capture fresh `AUTHORIZED_LOCAL_HEAD` → zero repo writes → exact staging parity → final triple gate → exactly one runner invocation → evidence/governance writes only after runner returns

The future LIVE golden-path artifact should now be:

```
index.html
```

with marker:

```
PRIVATE-BETA-E2E-AUTO
```

---

## 18. Lifecycle

1. Registration + product-contract / root-cause diagnosis — COMPLETE — 2026-08-22 — Diagnosis: `docs/PRIVATE-BETA-BLOCKER-03L-DIAGNOSIS.md`
2. Smallest evidence-supported TDD implementation + tests — COMPLETE — 2026-08-22 — `FROZEN_ARTIFACT_PATH='index.html'`; CONTRACT 100 passed
3. Fresh verification / checkpoint / consolidation / lock — COMPLETE — 2026-08-22 — this document

Lane 1 only during the task. Lane 2 EMPTY throughout. Lane 3 DISABLED.

Lane 1 released EMPTY at this lock. HOTFILE leases for `e2e/builder-golden-path/lib/constants.ts` and `e2e/builder-golden-path/tests/evidence.spec.ts` released. GOVERNANCE UNOWNED after these final governance writes.

---

## 19. Final resource state

```
Lane 1: EMPTY
Lane 2: EMPTY
Lane 3: DISABLED
GOVERNANCE: UNOWNED
STAGING: UNOWNED
PROVIDER-LIVE: UNOWNED
CREDIT: UNOWNED
ENV: UNOWNED
PACKAGE: UNOWNED
all HOTFILE leases: UNOWNED
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```
