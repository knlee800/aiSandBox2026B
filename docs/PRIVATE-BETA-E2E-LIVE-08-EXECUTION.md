# PRIVATE-BETA-E2E-LIVE-08 — Step 1 Execution Contract

**Task ID:** PRIVATE-BETA-E2E-LIVE-08  
**Step:** 1 — Registration + committed resource reservation + exact LIVE execution contract freeze  
**Date:** 2026-08-22  
**Nature:** CONTRACT / SETUP / RESOURCE RESERVATION ONLY  
**Runtime evidence:** NONE  
**LIVE run:** NO  
**SSH:** NO  
**Staging mutation:** NO  
**Provider call:** NO  
**Credit mutation:** NO  
**Gate mutation:** NO  
**Git mutation:** NO  
**Canonical sequencing:** `docs/PRIVATE-BETA-E2E-LIVE-EXECUTION-SEQUENCING.md`

Do not treat this document as a scheduler. Do not treat this document as Step 2 evidence. Do not store credentials here. Do not freeze Step 1 HEAD as the Step 2 deployment target. Do not rerun LIVE-07. Do not rewrite LIVE-07. Do not convert LIVE-07 to PASS. Do not rerun LIVE-06. Do not reopen AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I. Do not weaken runner clean-tree SAFETY. Do not patch residual `page.goto()` / `selectOption` / `trace: 'off'` surfaces. Do not register PRIVATE-BETA-INVITE-01.

If Step 2 later writes evidence into a successor section or a later revision of this file, that evidence must be actual observed runtime data. This Step 1 revision contains **no fabricated runtime evidence**.

LIVE-08 is **not** a rerun of LIVE-07.

---

## Purpose

LIVE-08 is the next fresh automated provider-bearing Builder golden-path run.

Its relevant locked predecessors are:

- **AUTO-01G:** AUTO_APPLY persistence now observed through early-captured `POST /api/sessions/:sessionId/files/write` 204.
- **AUTO-01H:** BUILD now captures the real `executionId` from bounded `POST /api/ai/execute` 202 JSON.
- **AUTO-01I:** canonical LIVE clean-execution sequencing frozen.

LIVE-07 remains historical:

COMPLETE AND LOCKED — FAIL/BLOCKED — ENVIRONMENT/PARITY_FAILURE — SAFETY

Do not rewrite it. Do not convert it to PASS. Do not rerun it.

The purpose of LIVE-08 is to determine whether the **complete automated Builder golden path** now succeeds against real staging **without** repeating the LIVE-07 sequencing defect (resource/control-plane writes after `AUTHORIZED_LOCAL_HEAD` capture).

Its purpose is **not** to test AUTO-01G, AUTO-01H, or AUTO-01I individually.  
Its purpose is **not** to retry, reopen, or convert LIVE-07.

---

## Why reservation happens in Step 1

AUTO-01I froze the canonical rule:

Required LIVE resource reservation must already be in the **COMMITTED HEAD** before the Step 2 execution edge is constructed.

LIVE-07 failed because:

```
clean HEAD capture
→ resource/governance writes
→ dirty tree
→ runner SAFETY failure
```

LIVE-08 prevents that class completely.

Therefore Step 1 produces the **FULL** intended reservation state on the authoritative `TASKS.md` board.

Keith will commit/push this Step 1 state **BEFORE** Step 2.

Reservation ≠ authorization.

---

## Step 1 recorded HEAD (NOT frozen for Step 2)

```
branch = main
HEAD   = 9a52511db2d716746dcfaafdd097d3ec32575f68
status = CLEAN
```

AUTO-01G implementation commit `b9cba2480ea4e9c814d17342c0e6aed2b469ef69` is an ancestor of HEAD.  
AUTO-01H implementation commit `25c25bd79c205c52838b3d151c73a0bc4a4de13f` is an ancestor of HEAD.  
AUTO-01I lock commit `9a52511db2d716746dcfaafdd097d3ec32575f68` is current HEAD.

Do **not** freeze `9a52511db2d716746dcfaafdd097d3ec32575f68` as `AUTHORIZED_LOCAL_HEAD`.

Step 1 HEAD is informational only.

After Keith commits this Step 1 reservation state, Step 2 will use the **then-current CLEAN committed HEAD**.

---

## Step 1 resource reservation (MUST remain owned)

Step 1 **does** reserve on `TASKS.md`:

| Resource | Owner after Step 1 |
|---|---|
| STAGING | PRIVATE-BETA-E2E-LIVE-08 |
| PROVIDER-LIVE | PRIVATE-BETA-E2E-LIVE-08 |
| CREDIT | PRIVATE-BETA-E2E-LIVE-08 |
| ENV | PRIVATE-BETA-E2E-LIVE-08 |

These reservations **MUST remain owned by LIVE-08 after Step 1 completes.**

Do **not** release them at the end of Step 1.

They remain reservations / mutex ownership only.

They do **NOT** authorize runtime mutation.

GOVERNANCE may be acquired transiently for Step 1 writes, then released.

---

## Runtime authorization flags (remain NO)

Despite the reservations, all runtime authorization flags remain:

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

Step 2 still requires explicit Keith authorization.

Reservation ≠ authorization.

Do not confuse them.

---

## Future Step 2 execution-edge rule (mandatory)

The future Step 2 canonical ordering is mandatory:

1. explicit Keith LIVE authorization already obtained
2. verify STAGING / PROVIDER-LIVE / CREDIT / ENV ownership is already committed on `TASKS.md` for LIVE-08
3. perform **NO** governance writes
4. require `git status --short` EMPTY
5. set `AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD`
6. start **NO-CONTROL-PLANE-WRITE WINDOW**
7. inspect/deploy staging to exact `AUTHORIZED_LOCAL_HEAD` if required
8. import process-only credentials / LIVE flags
9. perform final triple gate
10. invoke `npm run e2e:builder:live` exactly once
11. only AFTER runner returns may repo evidence/governance writes resume

Never:

```
capture HEAD → modify TASKS.md → run
```

That is the LIVE-07 failure sequence.

---

## NO-CONTROL-PLANE-WRITE WINDOW

Future Step 2:

Starts immediately after final clean-tree `AUTHORIZED_LOCAL_HEAD` capture.

Ends when the ONE runner invocation returns, or it is conclusively established the runner was never invoked.

During that window:

**ZERO** tracked or untracked repository writes.

Including:

- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/*`
- runner files
- product files
- evidence files
- all other repo paths

No resource-acquisition writes are permitted there because LIVE-08 ownership must already be committed from Step 1.

---

## Final triple gate

Future Step 2 immediately before runner invocation must verify:

1. `git status --short` = EMPTY
2. `git rev-parse HEAD` = `AUTHORIZED_LOCAL_HEAD`
3. staging HEAD = `AUTHORIZED_LOCAL_HEAD`

Also require:

- staging tree clean
- retained stash invariant intact
- required PM2/services healthy
- applicable execution/billing gate preconditions valid (`GLOBAL_EXECUTION_ENABLED=false` / `BILLING_CHARGES_ENABLED=false` before any runner authorization phase)

Any mismatch:

**STOP BEFORE RUNNER.**

Do not stash / restore / reset to manufacture cleanliness.

---

## One-run rule

Future Step 2 may invoke the existing runner **exactly once**:

```
npm run e2e:builder:live
```

No manual browser flow.  
No second automated run.  
No retry after any failure.

A failed invocation consumes LIVE-08 even if:

- provider calls used = 0
- credits deducted = 0
- BUILD not reached
- environment/parity failure
- automation failure
- provider failure
- outer timeout
- Cursor disconnect
- formatted verdict missing

After invocation #1: evidence + cleanup of the **same disposable run** only.

---

## Frozen golden-path order

```
PREPARE_BROWSER
→ AUTH
→ SAFETY
→ STARTING_BALANCE
→ ARM_LISTENERS
→ CREATE_SESSION
→ BUILD
→ WAIT_FOR_AUTO_APPLY
→ PREVIEW
→ CHECKPOINT
→ PUBLIC_CONFIRM
→ DEDUCTION
→ BALANCE
→ CLEANUP
```

Do not change phase order.

---

## Provider contract

- Provider: xAI
- Model: grok-4.5
- Provider-call budget: 1
- Retries: 0
- Fallback: NONE
- No second provider call
- One Send
- One `POST /api/ai/execute`
- One provider authorization
- Provider call is permitted only if the runner naturally reaches BUILD
- If BUILD is not reached: provider usage = 0

---

## Credit contract

Future Step 2 may deduct credits only through the normal qualifying product path.

Require, if reached:

- starting balance captured
- `tokens_used` captured
- exactly one qualifying deduction
- credits deducted = `tokens_used`
- starting − deduction = ending
- no duplicate deduction
- no Stripe charge

If the run stops before deduction: credits deducted = 0.  
No synthetic/manual deduction.

---

## AUTO-01H BUILD contract

BUILD must observe:

```
POST /api/ai/execute
HTTP 202 JSON:
{
  executionId,
  status: "queued"
}
```

Required:

- `executionId` non-empty
- response observation bounded (`BUILD_EXECUTION_RESPONSE_TIMEOUT_MS=30000`)
- response body read bounded (`BUILD_EXECUTION_BODY_TIMEOUT_MS=30000`)
- BUILD fails closed if execution identity is unavailable
- the same `executionId` must later reach DEDUCTION verification

There must be:

- one Send
- one `POST /api/ai/execute`
- one provider authorization
- zero fake collection `POST /api/ai/executions` dependency

This is the locked AUTO-01H observation. Do not reopen AUTO-01H.

---

## AUTO-01G AUTO_APPLY contract

WAIT_FOR_AUTO_APPLY must prove:

```
POST /api/sessions/:sessionId/files/write
sessionId = CREATE_SESSION session
path     = e2e-auto.html
HTTP     = 204
```

The listener is armed during ARM_LISTENERS and retains early evidence.

Do **not** require the Code & Files rendered file node.  
Do **not** force a tab switch.  
Preview may remain the default tab.

This is the locked AUTO-01G observation. Do not reopen AUTO-01G. Do not revert to the LIVE-06 file-tree locator.

---

## AUTO-01F cleanup semantics

Normal final target:

- `GLOBAL_EXECUTION_ENABLED=false`
- `BILLING_CHARGES_ENABLED=false`

If SSH restore times out:

- `executionGateFinal = restore-unconfirmed-timeout`
- NEVER falsely report `restored-false`

In that case future Step 2 must:

- regain local cleanup control
- produce terminal failure evidence
- not retry SSH
- not rerun LIVE
- require operator verification/remediation
- retain relevant protection until gate state is verified

No second SSH restoration attempt.

---

## Staging contract

SSH alias: `aisandbox-staging`  
Repo: `/opt/aisandbox`

Retained stash invariant:

- `stash@{0}`
- SHA `0372cc1f47f82e1db060ed2dd756a938fe324803`
- historical name `pre-03F-deployment-snapshot-2026-08-15`
- never modify, pop, apply, drop, rename, or recreate it

At Step 2, **after** Keith commit of this reservation state and **after** explicit Keith LIVE authorization, **and only after** the no-control-plane-write window has started:

1. Verify required resource ownership is already committed on `TASKS.md` for LIVE-08.
2. Require local tree clean.
3. Capture `AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD`.
4. Compare staging HEAD with that dynamic AUTHORIZED_LOCAL_HEAD.
5. If different:
   - `git fetch origin main`
   - verify target exists
   - `git reset --hard AUTHORIZED_LOCAL_HEAD`
6. Never `git pull`.
7. Never deploy another SHA.
8. Conditional rebuild/restart only according to actual changed files and the authoritative deployment procedure (E2E-04 Phase E / 03F). Governance-only commits may skip product rebuild when `frontend/` and `services/` are unchanged, but still require exact HEAD match.

Afterward require:

- exact HEAD parity
- clean staging tree
- stash invariant intact
- required PM2 services healthy

AUTHORIZED_LOCAL_HEAD **must include** AUTO-01G, AUTO-01H, AUTO-01I, and this committed LIVE-08 reservation. If it does not: **STOP** before deploy/provider.

Do not deploy LIVE-07 SHA `6723c4699d9c2cea832f73356aa85960b230b3cf` as a substitute.  
Do not deploy LIVE-06 SHA `da56659d39a5d86d3ef994a7458a297169eeda42` as a substitute.  
Do not freeze this Step 1 HEAD as the deploy target.

If origin lacks the object: STOP for Keith push. Do not repair local Git.

Import transient credentials and process-only LIVE flags **after** parity and **only in process env**. Never write them to the repository.

---

## VPN / SSH

Step 1: VPN may remain ON. Step 1 does not SSH.

Future Step 2: VPN should be OFF for reliable `aisandbox-staging` SSH.

Do not change VPN during an active SSH command.

If the selected Cursor model cannot operate with VPN OFF: **STOP BEFORE LIVE execution**. Do not improvise.

---

## Auth / LIVE flags

Future Step 2 uses the existing transient DPAPI regular-user credential mechanism.

Never print credentials. Never write plaintext credentials to repo files.

Required LIVE flags only at execution time (do **not** set them in Step 1):

- `E2E_MODE=live`
- `E2E_LIVE_AUTHORIZED=true`
- `E2E_ALLOW_STAGING_MUTATION=true`
- `E2E_ALLOW_CREDIT_MUTATION=true`
- `PROVIDER_CALL_BUDGET=1`

---

## PASS contract

LIVE-08 PASS requires **ALL** mandatory evidence:

- AUTH PASS
- SAFETY PASS
- STARTING_BALANCE captured
- CREATE_SESSION PASS
- fresh project/session/container created
- BUILD submitted once
- real `executionId` captured from `/api/ai/execute` 202
- provider: xAI / grok-4.5
- provider calls: 1
- retries: 0
- `tokens_used` captured
- WAIT_FOR_AUTO_APPLY PASS from matching persisted `files/write` 204
- generated file confirmed
- PREVIEW PASS
- automatic CHECKPOINT PASS
- PUBLIC_CONFIRM: HTTP 200; `triggered=true`; `reason=completed`
- DEDUCTION: exactly one; credits = `tokens_used`
- BALANCE: starting − deduction = ending
- Stripe: no charge
- CLEANUP PASS
- `GLOBAL_EXECUTION_ENABLED` final = false
- `BILLING_CHARGES_ENABLED` final = false
- session stopped
- container removed
- LIVE env cleared
- DPAPI file absent
- formatted runner verdict: PASS

Missing mandatory evidence means do **not** classify PASS.

---

## Failure taxonomy

If not PASS, classify exactly one:

- **PRODUCT_FAILURE**
- **AUTOMATION_ADAPTER_FAILURE**
- **ENVIRONMENT/PARITY_FAILURE**
- **PROVIDER_FAILURE**

Record:

- exact failed phase
- last successful phase
- IDs
- provider usage
- token usage
- AUTO_APPLY
- Preview
- checkpoint
- public confirm
- credits/balance
- gate state
- session/container state

Do not guess.

---

## No patching during LIVE

Known residual items remain:

- unrelated `page.goto()`
- provider/model `selectOption` fallback hardening
- `trace = off`

They are not current blockers. Do not fix them in LIVE-08.

If one becomes the proven LIVE blocker: freeze evidence and handle it later in a separate lifecycle. No patching during LIVE execution.

If Step 2 exposes an actual product defect: STOP. Register a separate blocker later. Do not repair product source inside this live task.

---

## Outer-timeout recovery

If Playwright's outer 600000ms timeout occurs:

DO NOT RERUN.

Immediately switch to POST-FAILURE EVIDENCE + CLEANUP.

Determine:

- last successful phase
- exact hanging/failed phase
- IDs
- provider usage
- tokens
- deduction state
- execution-gate state
- session/container state

Then perform authorized cleanup of the **same disposable run only**.

---

## Authoritative runner (do not modify in this task)

Path: `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\`

Root `package.json` script:

```
"e2e:builder:live": "playwright test --config e2e/builder-golden-path/playwright.live.config.ts"
```

Expected command: `npm run e2e:builder:live`

Run exactly **ONCE**.

Playwright live config already sets `retries: 0`, `workers: 1`, Chromium, default `baseURL` `https://staging.ainow.biz`, `timeout: 600000`, `actionTimeout: LIVE_ACTION_TIMEOUT_MS` (30000), `navigationTimeout: LIVE_NAVIGATION_TIMEOUT_MS` (60000), `trace: 'off'`.

Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H runner or product source in this task.

---

## Step 1 activity ledger

```
LIVE runs = 0
SSH connections = 0
staging mutations = 0
provider calls = 0
credit mutations = 0
gate mutations = 0
project/session/container creation = 0
runner modifications = 0
production-source modifications = 0
dependency changes = 0
Git mutations = 0
```

---

## Readiness (unchanged by reservation)

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Resource reservation does not change readiness.

---

## Step 1 terminal reservation state

```
STAGING owner        = PRIVATE-BETA-E2E-LIVE-08
PROVIDER-LIVE owner  = PRIVATE-BETA-E2E-LIVE-08
CREDIT owner         = PRIVATE-BETA-E2E-LIVE-08
ENV owner            = PRIVATE-BETA-E2E-LIVE-08
GOVERNANCE           = UNOWNED (released after Step 1 writes)
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
LIVE_08_STEP_1_HEAD_FROZEN_FOR_STEP_2=NO
AUTHORIZED_LOCAL_HEAD=NOT_CAPTURED
```

Do not release STAGING / PROVIDER-LIVE / CREDIT / ENV merely because Step 1 contains no runtime.

This is the committed mutex state that AUTO-01I requires.

---

## Blocker before Step 2

1. Keith must **commit/push this complete reservation state** so the committed HEAD contains LIVE-08 ownership of STAGING / PROVIDER-LIVE / CREDIT / ENV.
2. Explicit Keith LIVE authorization is required before any staging compare/deploy, SSH, LIVE flags, provider call, credit mutation, or `npm run e2e:builder:live`.
3. After that authorization, Step 2 must construct the execution edge on a **CLEAN** tree with **NO** further governance writes.

If VPN must remain ON for the selected Cursor model: STOP before LIVE execution.

**PRIVATE-BETA-E2E-LIVE-08 STEP 1 COMPLETE — REGISTERED WITH STAGING / PROVIDER-LIVE / CREDIT / ENV RESERVED IN THE BOARD BUT ALL RUNTIME AUTHORIZATION FLAGS FALSE — KEITH MUST COMMIT THIS COMPLETE RESERVATION STATE BEFORE STEP 2 EXECUTION EDGE — NO LIVE ACTIVITY**

---

# PRIVATE-BETA-E2E-LIVE-08 — Step 2 Runtime Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-08  
**Step:** 2 — ONE authorized automated staging golden-path run  
**Date:** 2026-08-22  
**Primary classification:** PRODUCT_FAILURE  
**Failed phase:** PREVIEW  
**Last successful runner phase:** WAIT_FOR_AUTO_APPLY  
**Step 2 state:** LANE-DONE — FAIL/BLOCKED — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` **once**)  
**LIVE_RUNNER_INVOKE:** 1  
**NPM_EXIT:** 1  
**Formatted verdict:** `verdict=FAIL`  
**Playwright duration:** 1.2m (not the 600000ms outer timeout)

Do not treat this document as a scheduler. LIVE-08 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I from this step. This is not a LIVE-07 rerun. Do not rerun LIVE-08. No patching during this task. Do not register PRIVATE-BETA-INVITE-01.

---

## Verdict

Keith authorized Step 2. Committed Step 1 reservation of STAGING / PROVIDER-LIVE / CREDIT / ENV was already present on `TASKS.md`. Local `main` was CLEAN at AUTHORIZED_LOCAL_HEAD capture. AUTO-01G `b9cba2480ea4e9c814d17342c0e6aed2b469ef69`, AUTO-01H `25c25bd79c205c52838b3d151c73a0bc4a4de13f`, and AUTO-01I lock `9a52511db2d716746dcfaafdd097d3ec32575f68` are ancestors. VPN was OFF. Repo writes between HEAD capture and runner return = **ZERO**. Staging compare-then-deploy of AUTHORIZED_LOCAL_HEAD succeeded. Product `frontend/` and `services/` were unchanged vs pre-deploy staging HEAD, so rebuild/restart was skipped. Final triple gate PASS. Playwright LIVE was invoked **exactly once**.

Runner phases that completed: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION → BUILD → WAIT_FOR_AUTO_APPLY.

PREVIEW failed:

```
locator.waitFor: Timeout 15000ms exceeded.
waiting for locator('[data-testid="workspace-preview-iframe"]').contentFrame().locator('h1') to be visible
```

Failure class: **PRODUCT_FAILURE** at **PREVIEW**.

THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY FAILURE.  
THIS WAS NOT AN AUTOMATION SELECTOR/ADAPTER MISMATCH of AUTO-01G / AUTO-01H.  
AUTO-01G WAIT_FOR_AUTO_APPLY files/write 204 **HELD**.  
AUTO-01H BUILD `POST /api/ai/execute` 202 `executionId` **HELD**.  
AUTO-01I clean-execution sequencing **HELD** (clean tree at SAFETY; no post-capture board write).

Do not patch preview strategy or the runner inside LIVE-08. Zero provider retries. Do not invoke `npm run e2e:builder:live` again.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` (`register LIVE-08 with reserved runtime resources`) |
| Local tree at HEAD capture | CLEAN / `main` |
| STAGING_HEAD_BEFORE | `6723c4699d9c2cea832f73356aa85960b230b3cf` (locked LIVE-07 staging HEAD) |
| Deployment performed | **YES** |
| STAGING_HEAD_AFTER | `f9efc0f6d2803adbc91689ce75670434a6e89cb5` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| `git pull` | **NOT USED** |
| Rebuild / restart | **SKIPPED** — `frontend/` and `services/` unchanged vs pre-deploy HEAD (AUTO-01I / LIVE-07 lock / LIVE-08 reservation are docs/governance only; package/lockfiles unchanged) |
| Staging tree after deploy | CLEAN |
| stash@{0} before | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) |
| stash@{0} after | `0372cc1f47f82e1db060ed2dd756a938fe324803` — unchanged; not applied/dropped/renamed |
| Repo writes between HEAD capture and runner invocation | **ZERO** |

---

## Final triple gate (immediately before runner)

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
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` before runner | false (.env + PM2) |
| FINAL_TRIPLE_GATE | **PASS** |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once** (`LIVE_RUNNER_INVOKE=1`)
- Start: `2026-08-22T12:07:09.7120931+08:00`
- End: `2026-08-22T12:08:28.4143226+08:00`
- Playwright duration: **1.2m**
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1` (process-only; never written to repo)
- Credentials: transient DPAPI `PSCredential` import from `$env:TEMP\aisandbox-e2e-live-08-cred.xml`; temp file deleted in `finally`; process env cleared after runner (`ENV_CLEARED=YES`); never printed/committed
- Human browser intervention: **NO**
- NPM_EXIT: **1**

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

Runner phases **NOT REACHED:** CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE (product-side checkpoint, confirm-build-apply, and deduction still occurred; recorded below as product evidence, not runner PASS)

---

## IDs / provider / accounting (observed)

| Fact | Runner | Post-failure staging evidence |
|---|---|---|
| projectId | `b6072bf5-3e19-4756-a0a9-3afe67f29b85` | `E2E-AUTO-Disposable-2026-08-22T04-07-20-963Z` |
| sessionId | `25d80ee1-ca1f-4b8e-9e5f-42156c1341c0` | status=`stopped`; `terminated_at` null |
| containerId | not in formatted verdict | created `5d1171052eb8e54b1774f7e962e3a6169e6be5893f523da444d0211f6c713633`; removed (`docker ps -a` match count 0; session `container_id` null) |
| executionId | `145e789a-7aa8-4f7a-80c6-d7a0a6156878` | same ID in usage_records + credit_deduction_records |
| executionId source | BUILD `POST /api/ai/execute` 202 (AUTO-01H) | gateway `execution.intent_written` at 12:08:01 with this ID **before** provider completion |
| Provider / model | xAI / grok-4.5 (authorized) | usage_records: provider=`xai`; metadata `requestedModel`/`aiExecutionResult.model`=`grok-4.5`; screenshot Model `grok-4.5 (xAI)` |
| Provider-call budget | 1 | used **1** |
| Provider calls used | **1** | **1** |
| Retries used | **0** | **0** |
| tokens_used | not in fail summary (DEDUCTION phase not reached) | **1177** (`usage_records.tokens_used` and `aiExecutionResult.tokensUsed`) |
| execute POST count | **1** (BUILD reached with real executionId) | intent_written once for this executionId |
| Send click count | **1** | one provider result |
| AUTO_APPLY | **PASS** (WAIT_FOR_AUTO_APPLY completed) | file persisted |
| files/write 204 | matching write observed (phase completed; `waitForMatchingWrite` requires path `e2e-auto.html` + HTTP 204) | `/opt/aisandbox/workspaces/25d80ee1-ca1f-4b8e-9e5f-42156c1341c0/e2e-auto.html` exists |
| Generated file | confirmed by AUTO_APPLY + disk | 191 bytes; SHA-256 `ce230ea6f1b8bd090de79c3f4fe6e9bd0c6f10fd1a590370585120ce8227d9e7`; exact frozen HTML including `<h1>PRIVATE-BETA-E2E-AUTO</h1>` |
| Preview | **FAIL** | UI remained “Preview unavailable”; iframe never mounted (`previewUrl` null); CM did **not** log `Starting preview for session 25d80ee1-…` |
| Checkpoint | runner NOT REACHED | product created `65c921ecf261d9bab418a5d2095dcad4db3cff4a` (`AI: applied workspace file actions`) at 12:08:13 |
| Public confirm | runner NOT REACHED | product `confirm_build_apply.deduction_triggered` at 12:08:05; `tokensUsed=1177`; `persistedFileActionCount=1` |
| Deduction count | runner NOT REACHED | **1** (`credit_deduction_records` for this executionId) |
| Credits deducted | runner NOT REACHED | **1177** (`requested_credits=1177`, `applied_credits=1177`, `overflow_credits=0`, status=`applied`) |
| Starting balance | STARTING_BALANCE phase completed; numeric value not in fail summary | product `balance_before=28219` |
| Ending balance | runner NOT REACHED | **27042** (DB `credit_balances` and deduction `balance_after`) |
| Reconciliation | runner NOT REACHED | 28219 − 1177 = 27042 |
| Stripe | no charge expected (`BILLING_CHARGES_ENABLED=false`) | no `stripe`/`charge`/`payment` tables in public schema; no Stripe charge observed |

---

## PREVIEW failure evidence (product)

Runner `verifyPreview()` clicked `[data-testid="workspace-preview-start"]` then waited 15000ms for the preview iframe `h1`. Failure screenshot still showed Preview tab active, File Action Results `create e2e-auto.html`, and:

> Preview unavailable. No preview is running for this workspace yet.

`workspace-preview-iframe` is rendered only when `previewUrl` is set. It was not set.

Gateway proxied `POST /api/preview/<sessionId>/start` and repeated `GET …/status` for this session. Container-manager never emitted `Starting preview for session 25d80ee1-ca1f-4b8e-9e5f-42156c1341c0`. That log is emitted only after strategy resolution succeeds (`preview.service.ts` after the unknown-strategy throw).

Authoritative product start rule (`services/container-manager/src/preview/preview-strategy.resolver.ts` + `preview.service.ts`):

- static HTML preview starts only for `/workspace/index.html` (or an immediate subdirectory `index.html`)
- `ls /workspace/*.html` with **no** `index.html` returns type `unknown`, framework `Static HTML (missing-index)`
- `startPreview` then throws `BadRequestException`: static HTML preview requires `index.html`

The frozen golden-path artifact is **`e2e-auto.html`**, not `index.html`. The generated file is the only HTML at workspace root. That is the product refusal path. The runner Start Preview click occurred; the product did not start a preview process.

Do not patch this inside LIVE-08.

---

## CLEANUP / gates (confirmed)

| Check | Result |
|---|---|
| Runner cleanup | `session-stopped` |
| `executionGateFinal` | `restored-false` (confirmed; not `restore-unconfirmed-timeout`) |
| Session final | `stopped` |
| Container final | removed |
| `GLOBAL_EXECUTION_ENABLED` final | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` final | false (.env + PM2) |
| Gateway PM2 restarts | 248 before runner → **250** after (enable + restore) |
| LIVE process env | cleared |
| DPAPI `$env:TEMP\aisandbox-e2e-live-08-cred.xml` | **absent** |
| Unrelated sessions/containers | not touched |
| Local tree after runner | CLEAN (`test-results/` gitignored) |

---

## Classification (exactly one)

```
PRIMARY_CLASS=PRODUCT_FAILURE
FAILED_PHASE=PREVIEW
LAST_SUCCESSFUL_RUNNER_PHASE=WAIT_FOR_AUTO_APPLY
PRODUCT_FAILURE=YES
PROVIDER_FAILURE=NO
ENVIRONMENT/PARITY_FAILURE=NO
AUTOMATION_ADAPTER_FAILURE=NO
AUTO_01G_LIVE_08_VALIDATION=HELD
AUTO_01H_LIVE_08_VALIDATION=HELD
AUTO_01I_SEQUENCING_HELD=YES
LIVE_08_CONSUMED=YES
RERUN=NO
```

---

## Readiness (unchanged by this FAIL)

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Step 2 does not make the final readiness decision. Step 3 consolidation uses this frozen evidence. Do not register PRIVATE-BETA-INVITE-01.

**PRIVATE-BETA-E2E-LIVE-08 STEP 2 COMPLETE — FAIL/BLOCKED — PRODUCT_FAILURE AT PREVIEW — DO NOT RERUN LIVE-08**
