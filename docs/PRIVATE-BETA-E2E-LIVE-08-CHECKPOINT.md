# PRIVATE-BETA-E2E-LIVE-08 — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-LIVE-08  
**Title:** Fresh Automated Builder LIVE E2E After AUTO-01G / AUTO-01H / AUTO-01I With Step 1 Resource Reservation  
**Final Status:** COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22  
**Checkpoint Date:** 2026-08-22  
**Lifecycle:** 3-step HIGH-RISK  
**Workstream:** RELIABILITY  
**Evidence class:** PROVIDER-LIVE  
**Nature:** GOVERNANCE / CONSOLIDATION ONLY — no staging, Playwright LIVE, provider, credits, gate mutation, runner fix, product source, package, frozen golden artifact, or Git mutation in Step 3

**Step 2 execution evidence:** `docs/PRIVATE-BETA-E2E-LIVE-08-EXECUTION.md`  
**Canonical sequencing:** `docs/PRIVATE-BETA-E2E-LIVE-EXECUTION-SEQUENCING.md`

Do not treat this checkpoint as a scheduler. Do not store credentials in this file. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I from this lock. Do not rewrite LIVE-07 / LIVE-06 or earlier LIVE tasks. Do not rerun LIVE-08. Do not rerun LIVE-07. Do not convert LIVE-08, LIVE-07, or LIVE-06 to PASS. Do not reopen AUTO-01G / AUTO-01H / AUTO-01I. Do not weaken runner clean-tree SAFETY. Do not patch Preview. Do not modify the runner. Do not change the frozen golden artifact. Do not register PRIVATE-BETA-INVITE-01. Do not register the follow-up product task here. This is not a LIVE-07 rerun.

Step 3 pre-write observation (read-only):

- branch = `main`
- HEAD = `b7446f5c077e15db785e6e0173fb3eb5a495f647`
- `git status --short` = empty (CLEAN) before Step 3 writes

---

## Primary classification

```
FINAL_VERDICT=COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22
PRODUCT_FAILURE=YES
PROVIDER_FAILURE=NO
ENVIRONMENT/PARITY_FAILURE=NO
AUTOMATION_ADAPTER_FAILURE=NO
PLAYWRIGHT_LIVE_RUNNER_INVOKED=YES
RUNNER_INVOCATION_COUNT=1
NPM_EXIT=1
FORMATTED_RUNNER_VERDICT=FAIL
RETRIES=0
RERUN=NO
FAILED_PHASE=PREVIEW
LAST_SUCCESSFUL_PHASE=WAIT_FOR_AUTO_APPLY
PROVIDER_CALLS=1
SEND=1
POST_/api/ai/execute=1
CREDITS_DEDUCTED=1177
AUTO_01I_LIVE_VALIDATION=HELD
AUTO_01H_LIVE_VALIDATION=HELD
AUTO_01G_LIVE_VALIDATION=HELD
LIVE_08_CONSUMED=YES
```

Do **not** convert LIVE-08 to PASS.

THIS WAS A PRODUCT FAILURE AT PREVIEW.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY FAILURE.  
THIS WAS NOT AN AUTOMATION_ADAPTER_FAILURE of AUTO-01G / AUTO-01H / AUTO-01I.

The runner successfully reached and completed AUTH, SAFETY, STARTING_BALANCE, ARM_LISTENERS, CREATE_SESSION, BUILD, and WAIT_FOR_AUTO_APPLY. PREVIEW then failed because the product static-preview start path did not start for the persisted generated file `e2e-auto.html` under the current `index.html` entrypoint requirement.

Do not claim the precise product fix in this lock.

---

## 1. Lifecycle

1. Registration + committed resource reservation + exact LIVE execution contract freeze — COMPLETE — 2026-08-22 — contract: `docs/PRIVATE-BETA-E2E-LIVE-08-EXECUTION.md`
2. ONE authorized automated LIVE execution — COMPLETE — LANE-DONE — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22 — Evidence: `docs/PRIVATE-BETA-E2E-LIVE-08-EXECUTION.md`
3. Consolidation / checkpoint / lock — COMPLETE — 2026-08-22 — this document

Lane 1 only during the task. Lane 2 EMPTY throughout. Lane 3 DISABLED.

LIVE-08 is consumed permanently. No rerun.

---

## 2. Committed reservation / AUTO-01I LIVE validation

AUTO-01I LIVE validation: **HELD**

Evidence:

- LIVE resources (STAGING / PROVIDER-LIVE / CREDIT / ENV) were already present in **committed** `TASKS.md` before `AUTHORIZED_LOCAL_HEAD` capture
- local tree CLEAN at AUTHORIZED_LOCAL_HEAD capture
- zero repo writes between capture and runner invocation
- staging exact HEAD parity
- final triple gate **PASS**
- runner SAFETY **PASS**

This proves the LIVE-07 procedural sequencing class did not recur.

```
AUTO_01I_LIVE_VALIDATION=HELD
AUTO_01I_SEQUENCING_HELD=YES
LIVE_07_SEQUENCING_CLASS_RECURRED=NO
```

AUTO-01I remains **COMPLETE AND LOCKED — PASS**. Do not reopen it. Do not weaken runner SAFETY.

---

## 3. One-run contract (terminal)

```
RUNNER_INVOCATION_COUNT=1
COMMAND=npm run e2e:builder:live
LIVE_RUNNER_INVOKE=1
NPM_EXIT=1
FORMATTED_VERDICT=FAIL
FAILED_PHASE=PREVIEW
LAST_SUCCESSFUL_PHASE=WAIT_FOR_AUTO_APPLY
RETRIES=0
RERUN=NO
PROVIDER_CALLS=1
SEND=1
POST_/api/ai/execute=1
CREDITS=1177
```

The one authorized invocation is frozen evidence. Do not rewrite this run. Do not invoke `npm run e2e:builder:live` again for LIVE-08.

Runner start: `2026-08-22T12:07:09.7120931+08:00`  
Runner end: `2026-08-22T12:08:28.4143226+08:00`  
Playwright duration: **1.2m** (not the 600000ms outer timeout)  
Human browser intervention: **NO**

Formatted runner output:

```
verdict=FAIL
phase=PREVIEW
error=locator.waitFor: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="workspace-preview-iframe"]').contentFrame().locator('h1') to be visible
projectId=b6072bf5-3e19-4756-a0a9-3afe67f29b85
sessionId=25d80ee1-ca1f-4b8e-9e5f-42156c1341c0
executionId=145e789a-7aa8-4f7a-80c6-d7a0a6156878
cleanup=session-stopped
executionGateFinal=restored-false
```

Runner phases completed: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION → BUILD → WAIT_FOR_AUTO_APPLY

Failed runner phase: **PREVIEW**

Runner phases **NOT REACHED:** CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE

Last successfully completed **runner** phase: **WAIT_FOR_AUTO_APPLY**

CLEANUP still ran (`session-stopped`).

---

## 4. Deployment / exact parity / stash / health

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` (`register LIVE-08 with reserved runtime resources`) |
| Local tree at HEAD capture | **CLEAN** / `main` |
| STAGING_HEAD_BEFORE | `6723c4699d9c2cea832f73356aa85960b230b3cf` (locked LIVE-07 staging HEAD) |
| Deployment performed | **YES** |
| STAGING_HEAD_AFTER | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard AUTHORIZED_LOCAL_HEAD` |
| `git pull` | **NO** |
| Rebuild / restart | **SKIPPED** — `frontend/` and `services/` unchanged vs pre-deploy HEAD |
| AUTO-01G on authorized HEAD | **YES** (ancestor `b9cba2480ea4e9c814d17342c0e6aed2b469ef69`) |
| AUTO-01H on authorized HEAD | **YES** (ancestor `25c25bd79c205c52838b3d151c73a0bc4a4de13f`) |
| AUTO-01I on authorized HEAD | **YES** (ancestor `9a52511db2d716746dcfaafdd097d3ec32575f68`) |
| Committed LIVE-08 reservation on authorized HEAD | **YES** |
| Repo writes between capture and invocation | **ZERO** |
| Staging tree after deploy | **CLEAN** |
| Retained `stash@{0}` | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) |
| Stash invariant | **PASS / untouched** — not applied, dropped, rewritten, or recreated |

Final triple gate immediately before runner:

| Gate | Result |
|---|---|
| Local `git status --short` | EMPTY |
| Local HEAD | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` = AUTHORIZED_LOCAL_HEAD |
| Staging HEAD | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` = AUTHORIZED_LOCAL_HEAD |
| Staging tree | CLEAN |
| Retained stash | PASS |
| Gateway `/api/health/ready` | HTTP 200 |
| AI `/metrics` | HTTP 200 |
| Container-manager `/api/health` | HTTP 200 |
| Frontend `:3002` / public | HTTP 307 |
| Required PM2 processes | online |
| `GLOBAL_EXECUTION_ENABLED` before runner | false |
| `BILLING_CHARGES_ENABLED` before runner | false |
| FINAL_TRIPLE_GATE | **PASS** |

---

## 5. Disposable IDs

| ID | Value |
|---|---|
| projectId | `b6072bf5-3e19-4756-a0a9-3afe67f29b85` |
| sessionId | `25d80ee1-ca1f-4b8e-9e5f-42156c1341c0` |
| containerId | `5d1171052eb8e54b1774f7e962e3a6169e6be5893f523da444d0211f6c713633` |
| executionId | `145e789a-7aa8-4f7a-80c6-d7a0a6156878` |

---

## 6. AUTO-01H LIVE validation

AUTO-01H LIVE validation: **HELD**

Evidence:

```
POST /api/ai/execute = 1
HTTP = 202
executionId = 145e789a-7aa8-4f7a-80c6-d7a0a6156878
executionId source = real BUILD 202 JSON
Send count = 1
provider calls = 1
retries = 0
```

No null `executionId`. The real ID was available for the later deduction path and matched `usage_records` / `credit_deduction_records`.

AUTO-01H remains **COMPLETE AND LOCKED — PASS**. Do not reopen it.

---

## 7. AUTO-01G LIVE validation

AUTO-01G LIVE validation: **HELD**

WAIT_FOR_AUTO_APPLY: **PASS**

Matching write:

```
POST /api/sessions/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/files/write
path = e2e-auto.html
status = 204
```

Generated file existed:

```
/opt/aisandbox/workspaces/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/e2e-auto.html
size = 191 bytes
SHA-256 = ce230ea6f1b8bd090de79c3f4fe6e9bd0c6f10fd1a590370585120ce8227d9e7
marker = <h1>PRIVATE-BETA-E2E-AUTO</h1>
```

No Code & Files UI-node dependency blocked the run. Preview remained the default tab.

AUTO-01G remains **COMPLETE AND LOCKED — PASS**. Do not reopen it.

---

## 8. Provider / tokens

| Field | Value |
|---|---|
| Provider | xAI |
| Model | grok-4.5 |
| Provider calls | **1** |
| Retries | **0** |
| tokens_used | **1177** |
| Execute POST count | **1** |
| Send count | **1** |
| Fallback | NONE |

THIS WAS NOT A PROVIDER FAILURE.

---

## 9. PREVIEW failure / static-entrypoint mismatch

PREVIEW: **FAIL**

Observed:

- runner clicked Start Preview (`[data-testid="workspace-preview-start"]`)
- UI remained **Preview unavailable**
- expected iframe never mounted (`workspace-preview-iframe` / `previewUrl` never set)
- container-manager produced **no** `Starting preview` log for this LIVE-08 session
- generated workspace contained valid persisted `e2e-auto.html`
- product static HTML preview start path currently requires `index.html`

Frozen mismatch:

```
frozen generated artifact = e2e-auto.html
current static preview startup requirement = index.html
```

Therefore the product preview path could not start the generated frozen artifact under its current static-entrypoint contract.

Do **not** broaden this into a general claim that Preview is broken for all projects.  
Do **not** claim the eventual product correction in this lock.

This lock does **not** decide whether the eventual fix is:

- A. Preview must support arbitrary/generated HTML entrypoints such as `e2e-auto.html`
- B. Builder must produce/copy `index.html`
- C. Preview launch must target a selected HTML file
- D. some other existing intended product contract

That belongs to a later bounded product root-cause lifecycle. Do not change either contract in this Step 3.

---

## 10. Checkpoint / public-confirm distinction

Runner CHECKPOINT: **NOT REACHED**

Product created automatic checkpoint:

```
65c921ecf261d9bab418a5d2095dcad4db3cff4a
```

Preserve distinction:

- product checkpoint existed
- runner CHECKPOINT phase not reached

Runner PUBLIC_CONFIRM: **NOT REACHED**

Product produced:

```
confirm_build_apply.deduction_triggered
tokensUsed = 1177
persistedFileActionCount = 1
```

Do not promote this into missing runner PUBLIC_CONFIRM HTTP evidence.

HTTP 200 / `triggered=true` / `reason=completed`: **NOT captured by runner in LIVE-08**.

---

## 11. Credit evidence

| Field | Value |
|---|---|
| Starting balance | **28219** |
| tokens_used | **1177** |
| Deduction count | **1** |
| Credits deducted | **1177** |
| Ending balance | **27042** |
| Reconciliation | 28219 − 1177 = 27042 |
| Result | **1:1 product credit behavior proven** |
| Stripe | **NO CHARGE** |
| `BILLING_CHARGES_ENABLED` | false |

Runner DEDUCTION / BALANCE phases themselves: **NOT REACHED** because PREVIEW failed earlier.

Preserve the distinction between product-side evidence and runner phase completion.

---

## 12. Cleanup / final gates

CLEANUP: **PASS**

| Field | Value |
|---|---|
| cleanup | `session-stopped` |
| `executionGateFinal` | `restored-false` (confirmed; not `restore-unconfirmed-timeout`) |
| `GLOBAL_EXECUTION_ENABLED` final | **false** |
| `BILLING_CHARGES_ENABLED` final | **false** |
| session final | **stopped** |
| container final | **removed** |
| credential / LIVE environment | cleared |
| DPAPI credential | absent |
| execution gate restoration | confirmed safe / restored-false according to frozen Step 2 evidence |
| Unrelated sessions/containers | not touched |

LIVE-08 no longer owns runtime resources after confirmed-safe cleanup.

---

## 13. Step 3 activity / tree at consolidation

```
PRE_STEP3_BRANCH=main
PRE_STEP3_HEAD=b7446f5c077e15db785e6e0173fb3eb5a495f647
PRE_STEP3_GIT_STATUS=CLEAN
```

Step 3 proceeded because the tree was CLEAN on `main` before these writes. Keith owns Git. This consolidation does not commit.

Step 3 did **not**:

- rerun LIVE-08
- run `npm run e2e:builder:live`
- SSH staging
- deploy
- call a provider
- mutate credits
- enable execution gates
- create project/session/container
- patch Preview
- modify the runner
- modify product source
- change the frozen golden artifact
- rewrite prior LIVE tasks
- register PRIVATE-BETA-INVITE-01
- register the follow-up product task
- perform Git mutation

GOVERNANCE was acquired for this atomic board/registry/checkpoint write, then released.

---

## 14. Readiness (unchanged)

```
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

Do not use PASS. Do not use PASS WITH LIMITATIONS. Do not declare Builder private-beta readiness GO.

Reason: the automated golden path still did not complete PREVIEW → CHECKPOINT → PUBLIC_CONFIRM → DEDUCTION → BALANCE.

LIVE-08 proved AUTH through WAIT_FOR_AUTO_APPLY, AUTO-01I/H/G in LIVE, generated-file persistence, and 1:1 product credit behavior. It did **not** prove Preview, runner CHECKPOINT, runner PUBLIC_CONFIRM, or runner DEDUCTION/BALANCE.

Builder remains **NO_GO**.

PRIVATE-BETA-INVITE-01 remains UNREGISTERED / UNAUTHORIZED / PROHIBITED.

---

## 15. Next recommended lifecycle (NOT REGISTERED IN THIS STEP)

**LIVE-08 rerun registered in Step 3:** NO  
**LIVE-07 rerun registered in Step 3:** NO  
**Another provider-bearing LIVE run registered in Step 3:** NO  
**AUTO-01G / AUTO-01H / AUTO-01I reopened in Step 3:** NO  
**PRIVATE-BETA-INVITE-01 registered in Step 3:** NO  
**Follow-up product task registered in Step 3:** NO

Recommend **ONE** bounded PRODUCT root-cause lifecycle before another LIVE run.

Likely identifier if later registered: **PRIVATE-BETA-BLOCKER-03L** (must be verified unused at future registration; repo search at this lock found **zero** occurrences).

Working title: **Builder Static Preview Entrypoint Contract**

The **FIRST** question must be:

Why does the Builder golden path correctly persist `e2e-auto.html` while the product static-preview start path refuses to start unless `index.html` exists?

Do **not** assume the fix.

Investigate at least:

1. What is the authoritative product contract for a static HTML workspace?
2. Is `index.html` intentionally mandatory?
3. How does the normal Builder decide file names for newly generated HTML?
4. Can a valid Builder workspace contain arbitrary `*.html` files without `index.html`?
5. Does Preview have an intended selected-file / explicit-entrypoint mechanism?
6. Does frontend Start Preview send an entrypoint/path to container-manager?
7. Where exactly is the `index.html` requirement enforced?
8. Is the requirement in frontend, gateway, container-manager, preview script, static server, or other?
9. What did earlier successful Preview flows contain?
10. Would changing the frozen E2E artifact to `index.html` merely hide a real product limitation?
11. Is the product requirement actually that AI-generated first-page content should be `index.html`?
12. Which correction best matches the intended customer experience?
13. Can the fix be bounded without changing the golden-path semantics?

Do not change product or runner until root cause / product contract is proven.

This is no longer an automation observation issue based on LIVE-08 evidence.

Do **not** register that investigation here.

PRIVATE-BETA-INVITE-01 remains prohibited.

---

## 16. Control-plane end state after Step 3

```
Lane 1=EMPTY
Lane 2=EMPTY
Lane 3=DISABLED
STAGING=UNOWNED
PROVIDER-LIVE=UNOWNED
CREDIT=UNOWNED
ENV=UNOWNED
GOVERNANCE=UNOWNED
PACKAGE=UNOWNED
All HOTFILE leases=UNOWNED
All other resources=UNOWNED
```

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

---

*Checkpoint created 2026-08-22 — PRIVATE-BETA-E2E-LIVE-08 Step 3 control-plane consolidation only — COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE AT PREVIEW — AUTO-01I/H/G HELD IN LIVE, GENERATED FILE AND 1:1 CREDIT PATH PROVEN — STATIC PREVIEW DID NOT START FOR E2E-AUTO.HTML BECAUSE CURRENT PRODUCT ENTRYPOINT CONTRACT REQUIRES INDEX.HTML — NEXT: BOUNDED PRODUCT PREVIEW-ENTRYPOINT ROOT-CAUSE INVESTIGATION — Builder remains NO_GO — no application source/test/runtime mutation — no staging/provider/credit activity in Step 3 — no Git mutation.*
