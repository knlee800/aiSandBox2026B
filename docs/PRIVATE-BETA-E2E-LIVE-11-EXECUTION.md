# PRIVATE-BETA-E2E-LIVE-11 — Step 1 Execution Contract

**Task ID:** PRIVATE-BETA-E2E-LIVE-11  
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

Do not treat this document as a scheduler. Do not treat this document as Step 2 evidence. Do not store credentials here. Do not freeze Step 1 HEAD as the Step 2 deployment target. Do not rerun LIVE-10. Do not rewrite LIVE-10. Do not convert LIVE-10 to PASS. Do not rerun LIVE-09 / LIVE-08 / LIVE-07 / LIVE-06. Do not reopen AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I / AUTO-01J / AUTO-01K. Do not reopen PRIVATE-BETA-BLOCKER-03L. Do not weaken runner clean-tree SAFETY. Do not patch residual `page.goto()` / `selectOption` / `trace: 'off'` surfaces. Do not reintroduce `e2e-auto.html`. Do not register PRIVATE-BETA-INVITE-01.

If Step 2 later writes evidence into a successor section or a later revision of this file, that evidence must be actual observed runtime data. This Step 1 revision contains **no fabricated runtime evidence**.

LIVE-11 is a **NEW fresh LIVE run**. It is **NOT** a rerun of LIVE-10.

---

## Purpose

LIVE-11 is the first provider-bearing automated Builder golden-path run after PRIVATE-BETA-E2E-AUTO-01K fixed DEDUCTION staging `DATABASE_URL` acquisition.

Frozen artifact:

```
index.html
```

Frozen marker:

```
PRIVATE-BETA-E2E-AUTO
```

Its relevant locked predecessors are:

- **PRIVATE-BETA-BLOCKER-03L:** COMPLETE AND LOCKED — PASS — 2026-08-22 — `index.html` Preview contract.
- **AUTO-01G:** COMPLETE AND LOCKED — PASS — 2026-08-21 — AUTO_APPLY files/write observation. LIVE-10 validation HELD.
- **AUTO-01H:** COMPLETE AND LOCKED — PASS — 2026-08-21 — real `/api/ai/execute` executionId observation. LIVE-10 validation HELD.
- **AUTO-01I:** COMPLETE AND LOCKED — PASS — 2026-08-22 — clean execution-edge sequencing. LIVE-10 validation HELD.
- **AUTO-01J:** COMPLETE AND LOCKED — PASS — 2026-08-22 — bounded same-session automatic checkpoint observation. LIVE-10 CHECKPOINT PASS HELD.
- **AUTO-01K:** COMPLETE AND LOCKED — PASS — 2026-08-22 — safe staging `DATABASE_URL` acquisition for DEDUCTION verification.

LIVE-10 remains historical:

COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — DEDUCTION — 2026-08-22

Do not rewrite it. Do not convert it to PASS. Do not rerun it.

LIVE-10 already proved PREVIEW PASS, CHECKPOINT PASS, and PUBLIC_CONFIRM PASS for `index.html`. LIVE-11 must prove those **fresh again**. LIVE-11 must also obtain **actual runner DEDUCTION PASS** via the AUTO-01K remote `DATABASE_URL` extract. Product/operator evidence after a runner DEDUCTION failure is **not** enough.

The purpose of LIVE-11 is to determine whether the **complete automated Builder golden path** now succeeds against real staging with AUTO-01K DEDUCTION connection acquisition, without repeating the LIVE-07 sequencing defect, without repeating the LIVE-08 Preview filename mismatch, without repeating the LIVE-09 one-shot empty-list CHECKPOINT failure, and without repeating the LIVE-10 empty-`DATABASE_URL` / role-`ubuntu` DEDUCTION failure.

The run must prove the full chain:

```
AUTH
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

Its purpose is **not** to test AUTO-01G, AUTO-01H, AUTO-01I, AUTO-01J, AUTO-01K, or 03L individually.  
Its purpose is **not** to retry, reopen, or convert LIVE-10.

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

LIVE-11 prevents that class completely, the same way LIVE-08 / LIVE-09 / LIVE-10 Step 1 did.

Therefore Step 1 produces the **FULL** intended reservation state on the authoritative `TASKS.md` board.

Keith will commit/push this Step 1 state **BEFORE** Step 2.

Reservation ≠ authorization.

---

## Step 1 recorded HEAD (NOT frozen for Step 2)

```
branch = main
HEAD   = 87e2958067926244421981144224b0f842479246
status = CLEAN
STEP_1_HEAD_FROZEN_FOR_STEP_2 = NO
```

AUTO-01G implementation commit `b9cba2480ea4e9c814d17342c0e6aed2b469ef69` is an ancestor of HEAD.  
AUTO-01H implementation commit `25c25bd79c205c52838b3d151c73a0bc4a4de13f` is an ancestor of HEAD.  
AUTO-01I lock `59b92df28cf755549e88aae89ce8107321c430e6` is an ancestor of HEAD.  
03L fixture alignment commit `6a73b2ca95883be6f82fafc15ff533bc2be58224` is an ancestor of HEAD.  
AUTO-01J implementation commit `31cf87c966393e0f23460d88965d28b3c0ceb786` is an ancestor of HEAD.  
AUTO-01K implementation commit `449ab9b5fff89b570078c968c7d36f7f5a347657` is an ancestor of HEAD.  
AUTO-01K lock commit `87e2958067926244421981144224b0f842479246` is current HEAD.  
LIVE-10 AUTHORIZED_LOCAL_HEAD `c78dbad609677b7da86e3043629e042bcbcb8e9d` is a historical ancestor only.

Do **not** freeze `87e2958067926244421981144224b0f842479246` as `AUTHORIZED_LOCAL_HEAD`.

Step 1 HEAD is informational only.

**Step 1 HEAD frozen for Step 2: NO**

Future Step 2 `AUTHORIZED_LOCAL_HEAD` MUST be captured only after:

1. Keith commits this Step 1 reservation state
2. `git status --short` is EMPTY
3. separate LIVE authorization exists

After Keith commits this Step 1 reservation state, Step 2 MUST use the **then-current CLEAN committed HEAD**. Step 2 MUST NOT construct `AUTHORIZED_LOCAL_HEAD` from this pre-commit HEAD.

---

## Step 1 resource reservation (MUST remain owned)

Step 1 **does** reserve on `TASKS.md`:

| Resource | Owner after Step 1 |
|---|---|
| STAGING | PRIVATE-BETA-E2E-LIVE-11 |
| PROVIDER-LIVE | PRIVATE-BETA-E2E-LIVE-11 |
| CREDIT | PRIVATE-BETA-E2E-LIVE-11 |
| ENV | PRIVATE-BETA-E2E-LIVE-11 |

These reservations **MUST remain owned by LIVE-11 after Step 1 completes.**

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

Step 2 still requires a separate explicit Keith authorization.

Reservation ≠ authorization.

Do not confuse them.

Do not turn these flags on in Step 1.

---

## Future Step 2 execution-edge rule (mandatory)

The future Step 2 canonical ordering is mandatory:

1. explicit Keith LIVE authorization already obtained
2. verify STAGING / PROVIDER-LIVE / CREDIT / ENV ownership is already committed on `TASKS.md` for LIVE-11
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
capture HEAD → modify TASKS.md / backlog / docs → invoke runner
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

No resource-acquisition writes are permitted there because LIVE-11 ownership must already be committed from Step 1.

---

## Final triple gate

Future Step 2 immediately before runner invocation must verify:

1. `git status --short` = EMPTY
2. `git rev-parse HEAD` = `AUTHORIZED_LOCAL_HEAD`
3. staging HEAD = `AUTHORIZED_LOCAL_HEAD`

Also require:

- staging tree CLEAN
- retained stash invariant intact
- required PM2/services healthy
- `GLOBAL_EXECUTION_ENABLED=false` before runner-owned enablement
- `BILLING_CHARGES_ENABLED=false`

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

Once invocation #1 occurs, LIVE-11 is consumed even if:

- provider calls used = 0
- credits deducted = 0
- AUTH / SAFETY fails
- CREATE_SESSION fails
- BUILD fails
- AUTO_APPLY fails
- PREVIEW fails
- CHECKPOINT fails
- PUBLIC_CONFIRM fails
- DEDUCTION / BALANCE fails
- provider fails
- automation fails
- environment/parity fails
- timeout
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

## Frozen Builder artifact

The frozen Builder artifact is:

```
index.html
```

The BUILD prompt must request exactly one `index.html` with the frozen marker `PRIVATE-BETA-E2E-AUTO`.

No extra files.

Do **not** reintroduce `e2e-auto.html`.

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

## Credit / BALANCE contract

Future Step 2 may deduct credits only through the normal qualifying product path.

Capture:

- starting balance
- `tokens_used`
- deduction count
- credits deducted
- ending balance

Require, if reached:

- exactly one qualifying deduction
- credits deducted = `tokens_used`
- starting − deduction = ending
- no duplicate deduction
- no Stripe charge

BALANCE remains:

```
GET /api/billing/balance
```

Require **actual runner BALANCE PASS**. Do **not** assume BALANCE PASS from CONTRACT. AUTO-01K did not change BALANCE.

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

Listener armed during ARM_LISTENERS.

WAIT_FOR_AUTO_APPLY must prove:

```
POST /api/sessions/:sessionId/files/write
sessionId = CREATE_SESSION session
path     = index.html
HTTP     = 204
```

Do **not** require the Code & Files rendered file node.  
Do **not** force a tab switch.  
Preview may remain the default tab.

This is the locked AUTO-01G observation plus the 03L path value. Do not reopen AUTO-01G. Do not revert to the LIVE-06 file-tree locator. Do not revert the path to `e2e-auto.html`.

---

## PREVIEW contract

Require **actual PREVIEW PASS**.

`index.html` existence alone does not count.

Require runner evidence that:

- Preview starts
- preview becomes available
- iframe / proxy is reached
- `PRIVATE-BETA-E2E-AUTO` content is asserted

LIVE-09 and LIVE-10 already proved this path. LIVE-11 must prove it **fresh again**.

Do **not** count presence of `index.html` alone as Preview success.

---

## AUTO-01J CHECKPOINT contract

CHECKPOINT must use bounded same-session observation.

Expected constants:

```
CHECKPOINT_OBSERVATION_TIMEOUT_MS=30000
CHECKPOINT_POLL_INTERVAL_MS=250
CHECKPOINT_REQUEST_TIMEOUT_MS=10000
```

First GET: immediate.

Endpoint:

```
GET /api/sessions/:sessionId/checkpoints
```

using the CREATE_SESSION `sessionId`.

HTTP 200 JSON `[]`: valid pollable absence.

Ignore stale / non-matching rows.

PASS only when a row matches ALL:

- description includes `applied workspace file actions`
- `commitHash`: non-empty after trim
- `filesChanged`: >= 1

No `checkpoints[0]` fallback.  
No invented `executionId` correlation.

Malformed / non-array: fail closed immediately.  
HTTP non-2xx: fail closed immediately.  
Never appears before deadline: fail with `No automatic checkpoint was returned.`

LIVE-11 must obtain **actual runner CHECKPOINT PASS**.

A product row discovered afterward is **NOT** enough if the runner phase fails.

Do not reopen AUTO-01J. Do not modify the CHECKPOINT adapter inside LIVE-11.

---

## PUBLIC_CONFIRM contract

Only after CHECKPOINT PASS.

Require runner-observed response:

- HTTP 200
- `triggered=true`
- `reason=completed`

Product logs alone do not satisfy this phase.

---

## AUTO-01K DEDUCTION connection contract

DEDUCTION is the key newly repaired gate.

LIVE-11 must obtain **actual runner DEDUCTION PASS** using the locked AUTO-01K remote `DATABASE_URL` acquisition.

Remote verifier must obtain `DATABASE_URL` from:

```
/opt/aisandbox/.env
```

using extraction equivalent to:

```
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)"
```

If absent/empty:

```
AISB_DATABASE_URL_MISSING
```

and fail closed **before** `psql`.

Forbidden:

- `source /opt/aisandbox/.env`
- `. /opt/aisandbox/.env`
- PM2 env dump
- embedding the secret URI in local SSH argv
- printing / logging `DATABASE_URL`

Then execute the existing `psql` query. SQL must remain correlated by:

```
source_event_id = executionId
```

Require runner:

```
deductionCount === 1
```

Product/operator evidence after failure does **not** substitute for runner phase PASS.

Do not reopen AUTO-01K. Do not modify the DEDUCTION adapter inside LIVE-11. Do not change BALANCE to psql.

---

## AUTO-01F cleanup semantics

Normal final target:

- `GLOBAL_EXECUTION_ENABLED=false`
- `BILLING_CHARGES_ENABLED=false`
- LIVE-11 session stopped
- LIVE-11 container removed
- LIVE process env cleared
- DPAPI credential absent

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

If execution gate restoration is unconfirmed: do **not** claim PASS.

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

1. Verify required resource ownership is already committed on `TASKS.md` for LIVE-11.
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

AUTHORIZED_LOCAL_HEAD **must include** AUTO-01G, AUTO-01H, AUTO-01I, AUTO-01J bounded CHECKPOINT observation, AUTO-01K DEDUCTION `DATABASE_URL` acquisition, 03L `index.html` fixture alignment, and this committed LIVE-11 reservation. If it does not: **STOP** before deploy/provider.

Do not deploy LIVE-10 SHA `c78dbad609677b7da86e3043629e042bcbcb8e9d` as a substitute.  
Do not deploy LIVE-09 SHA `14130f6db70b08ff116d8a51ef5c96657c5c21f2` as a substitute.  
Do not deploy LIVE-08 SHA `f9efc0f6d2803adbc91689ce75670434a6e89cb5` as a substitute.  
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

LIVE-11 PASS requires **ALL** mandatory evidence:

- AUTH PASS
- SAFETY PASS
- STARTING_BALANCE captured
- ARM_LISTENERS PASS
- CREATE_SESSION PASS
- fresh project/session/container created
- BUILD submitted once
- `POST /api/ai/execute` once
- HTTP 202
- real non-empty `executionId`
- provider: xAI / grok-4.5
- provider calls: exactly 1
- retries: 0
- `tokens_used` captured
- AUTO_APPLY PASS
- `files/write` path = `index.html`
- `files/write` HTTP 204
- generated `index.html` confirmed
- `PRIVATE-BETA-E2E-AUTO` confirmed
- PREVIEW PASS (actual runner Preview PASS; file presence alone is not enough)
- CHECKPOINT PASS via AUTO-01J bounded observation
- PUBLIC_CONFIRM PASS
- PUBLIC_CONFIRM: HTTP 200; `triggered=true`; `reason=completed`
- DEDUCTION PASS using AUTO-01K DB acquisition
- exactly one qualifying deduction
- credits deducted = `tokens_used`
- BALANCE PASS (actual runner BALANCE PASS)
- starting − deduction = ending
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

If invoked and not PASS, classify exactly one primary class:

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
- deduction
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

They are not current blockers. Do not fix them in LIVE-11.

If one becomes the proven LIVE blocker: freeze evidence and handle it later in a separate lifecycle. No patching during LIVE execution.

If Step 2 exposes an actual product defect: STOP. Register a separate blocker later. Do not repair product source inside this live task.

Do not modify the runner in this task, including AUTO-01K DEDUCTION acquisition or AUTO-01J CHECKPOINT observation. Do not modify product code. Do not modify dependencies.

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

Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I / AUTO-01J / AUTO-01K runner or product source in this task.

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
frontend modifications = 0
backend/service modifications = 0
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
Lane 1             = PRIVATE-BETA-E2E-LIVE-11 ACTIVE
Lane 2             = EMPTY
Lane 3             = DISABLED
STAGING owner      = PRIVATE-BETA-E2E-LIVE-11
PROVIDER-LIVE owner= PRIVATE-BETA-E2E-LIVE-11
CREDIT owner       = PRIVATE-BETA-E2E-LIVE-11
ENV owner          = PRIVATE-BETA-E2E-LIVE-11
GOVERNANCE         = UNOWNED (released after Step 1 writes)
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
LIVE_11_STEP_1_HEAD_FROZEN_FOR_STEP_2=NO
AUTHORIZED_LOCAL_HEAD=NOT_CAPTURED
Step 2             = PENDING / NOT AUTHORIZED
Step 3             = PENDING
```

Do not release STAGING / PROVIDER-LIVE / CREDIT / ENV merely because Step 1 contains no runtime.

This is the committed mutex state that AUTO-01I requires.

---

## Blocker before Step 2

1. Keith must **commit/push this complete reservation state** so the committed HEAD contains LIVE-11 ownership of STAGING / PROVIDER-LIVE / CREDIT / ENV.
2. Explicit Keith LIVE authorization is required before any staging compare/deploy, SSH, LIVE flags, provider call, credit mutation, or `npm run e2e:builder:live`.
3. After that authorization, Step 2 must construct the execution edge on a **CLEAN** tree with **NO** further governance writes, using the then-current clean committed HEAD — not this Step 1 pre-commit HEAD.

If VPN must remain ON for the selected Cursor model: STOP before LIVE execution.

**PRIVATE-BETA-E2E-LIVE-11 STEP 1 COMPLETE — REGISTERED WITH STAGING / PROVIDER-LIVE / CREDIT / ENV RESERVED IN COMMITTABLE BOARD STATE, ALL RUNTIME AUTHORIZATION FLAGS FALSE, AND AUTO-01K DEDUCTION DATABASE-CONNECTION CONTRACT FROZEN — KEITH MUST COMMIT BEFORE STEP 2 EXECUTION EDGE — NO LIVE ACTIVITY**

---

# PRIVATE-BETA-E2E-LIVE-11 — Step 2 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-11  
**Step:** 2 — ONE authorized automated staging golden-path run  
**Date:** 2026-08-23  
**Primary classification:** PASS  
**Failed phase:** none  
**Last successful runner phase:** CLEANUP  
**Step 2 state:** LANE-DONE — PASS — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` **once**)  
**LIVE_RUNNER_INVOKE:** 1  
**NPM_EXIT:** 0  
**Formatted verdict:** `verdict=PASS`  
**Playwright duration:** 1.1m

Do not treat this document as a scheduler. LIVE-11 is **not** locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I / AUTO-01J / AUTO-01K / 03L from this step. This is not a LIVE-10 rerun. Do not rerun LIVE-11. No patching during this task. Do not register PRIVATE-BETA-INVITE-01.

---

## Verdict

Keith authorized Step 2. Committed Step 1 reservation of STAGING / PROVIDER-LIVE / CREDIT / ENV was already present on `TASKS.md`. Local `main` was CLEAN at AUTHORIZED_LOCAL_HEAD capture `e5e41aa9c3237cafdb241ba9c5bb732c675d0632` (`register LIVE-11 with reserved runtime resources`). AUTO-01G `b9cba2480ea4e9c814d17342c0e6aed2b469ef69`, AUTO-01H `25c25bd79c205c52838b3d151c73a0bc4a4de13f`, AUTO-01I lock `59b92df28cf755549e88aae89ce8107321c430e6`, 03L fixture `6a73b2ca95883be6f82fafc15ff533bc2be58224`, AUTO-01J implementation `31cf87c966393e0f23460d88965d28b3c0ceb786`, AUTO-01K implementation `449ab9b5fff89b570078c968c7d36f7f5a347657`, and AUTO-01K lock `87e2958067926244421981144224b0f842479246` are ancestors. Named consumer VPNs were disconnected. Repo writes between HEAD capture and runner return = **ZERO**. Staging compare-then-deploy of AUTHORIZED_LOCAL_HEAD succeeded. Product `frontend/` / `services/` / `package.json` / lockfile were unchanged vs pre-deploy staging HEAD `c78dbad609677b7da86e3043629e042bcbcb8e9d`, so rebuild/restart was skipped. AUTO-01K read-only DB preflight PASS (`SELECT 1` → `1`; URI never printed). Final triple gate PASS. Playwright LIVE was invoked **exactly once**.

Runner phases that completed: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION → BUILD → WAIT_FOR_AUTO_APPLY → PREVIEW → CHECKPOINT → PUBLIC_CONFIRM → DEDUCTION → BALANCE → CLEANUP.

Formatted verdict **PASS**. AUTO-01K DEDUCTION runner **PASS**. AUTO-01J CHECKPOINT runner **PASS**. BALANCE runner **PASS**. 1:1 credit reconciliation **PASS** (`24719 − 1159 = 23560`).

Do not invoke `npm run e2e:builder:live` again. Do not lock LIVE-11 in Step 2.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `e5e41aa9c3237cafdb241ba9c5bb732c675d0632` (`register LIVE-11 with reserved runtime resources`) |
| Local tree at HEAD capture | CLEAN / `main` |
| STAGING_HEAD_BEFORE | `c78dbad609677b7da86e3043629e042bcbcb8e9d` (locked LIVE-10 staging HEAD) |
| Deployment performed | **YES** |
| STAGING_HEAD_AFTER | `e5e41aa9c3237cafdb241ba9c5bb732c675d0632` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** (scalar `-eq` after normalizing SSH output to one 40-character SHA) |
| Deploy method | `git fetch origin main` + `git reset --hard AUTHORIZED_LOCAL_HEAD` |
| `git pull` | **NOT USED** |
| Rebuild / restart | **SKIPPED** — `frontend/` / `services/` / `package.json` / lockfile unchanged vs pre-deploy HEAD (AUTO-01K runner + LIVE-10/LIVE-11 docs/governance only) |
| Staging tree after deploy | CLEAN |
| stash@{0} before | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) |
| stash@{0} after | `0372cc1f47f82e1db060ed2dd756a938fe324803` — unchanged; not applied/dropped/renamed |
| Repo writes between HEAD capture and runner invocation | **ZERO** |
| AUTO01K_DB_PREFLIGHT | **PASS** — extract-only `DATABASE_URL` from `/opt/aisandbox/.env`; `psql "$DATABASE_URL" -Atqc "SELECT 1;"` returned `1`; URI never printed |

---

## Final triple gate (immediately before runner)

SSH HEAD was normalized to one scalar SHA and compared with `-eq`. Array-valued `-match` / `-notmatch` was not used as the gate boolean. A first HEAD probe that piped a CRLF script produced `HEAD\r` and was discarded **before** invocation (`LIVE_RUNNER_INVOKE=0` on that attempt). The subsequent scalar `git rev-parse HEAD` over SSH produced one 40-character SHA.

| Gate | Result |
|---|---|
| Local `git status --short` | EMPTY |
| Local HEAD | `e5e41aa9c3237cafdb241ba9c5bb732c675d0632` = AUTHORIZED_LOCAL_HEAD |
| Staging HEAD | `e5e41aa9c3237cafdb241ba9c5bb732c675d0632` = AUTHORIZED_LOCAL_HEAD |
| Staging tree | CLEAN |
| Retained stash | PASS |
| Gateway `/api/health/ready` | HTTP 200 |
| AI `/metrics` | HTTP 200 |
| Container-manager `/api/health` | HTTP 200 |
| Frontend `:3002` / public | HTTP 307 |
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` before runner | false (.env + PM2) |
| Required PM2 processes | online (`aisandbox-api-gateway`, `aisandbox-frontend`, `aisandbox-ai-service`, `aisandbox-container-manager`) |
| AUTO01K_DB_PREFLIGHT | PASS |
| DPAPI `$env:TEMP\aisandbox-e2e-live-11-cred.xml` | existed before import |
| FINAL_TRIPLE_GATE | **PASS** |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once** (`LIVE_RUNNER_INVOKE=1`)
- Start: `2026-08-23T11:15:33.9195757+08:00`
- End: `2026-08-23T11:16:42.8156561+08:00`
- Playwright duration: **1.1m**
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1` (process-only; never written to repo)
- Credentials: transient DPAPI `PSCredential` import from `$env:TEMP\aisandbox-e2e-live-11-cred.xml`; process env cleared after runner (`ENV_CLEARED=YES`); DPAPI file deleted after invocation; never printed/committed
- Human browser intervention: **NO**
- NPM_EXIT: **0**

Formatted runner output:

```
verdict=PASS
projectId=5d2f58f0-1275-408f-94d0-26c2c3527b02
sessionId=04ebc946-fb3d-4f94-be94-cef65d2bb6b4
executionId=e570cdc5-ee53-4102-8137-be54b4900ffa
provider=xai
model=grok-4.5
tokensUsed=1159
autoApply=YES
preview=PASS
checkpointHash=b6facadbeb798eaef30ff4eb9a354f590a2e20f7
confirmStatus=200
confirmTriggered=true
deductionCount=1
creditsDeducted=1159
balanceBefore=24719
balanceAfter=23560
cleanup=session-stopped
executionGateFinal=restored-false
```

---

## IDs / provider / accounting (observed)

| Fact | Runner | Post-run staging evidence |
|---|---|---|
| projectId | `5d2f58f0-1275-408f-94d0-26c2c3527b02` | `E2E-AUTO-Disposable-2026-08-23T03-15-44-572Z` |
| sessionId | `04ebc946-fb3d-4f94-be94-cef65d2bb6b4` | status=`stopped`; `container_id` null |
| containerId | not in formatted verdict | created `4f5e531da2d2d1c6546ec480ca958d3a3c24ef5c08495ccdca7c3aed8a3e9745` (`sandbox-session-04ebc946-…`); removed (`docker ps -a` match count 0) |
| executionId | `e570cdc5-ee53-4102-8137-be54b4900ffa` | same ID in deduction `source_event_id` |
| executionId source | BUILD `POST /api/ai/execute` 202 (AUTO-01H) | same |
| Provider / model | xAI / grok-4.5 | formatted `provider=xai` `model=grok-4.5` |
| Provider-call budget | 1 | used **1** |
| Provider calls used | **1** | **1** |
| Retries used | **0** | **0** |
| tokens_used | **1159** | **1159** (`requested_credits=1159`, `applied_credits=1159`) |
| execute POST count | **1** | one executionId |
| Send click count | **1** | one provider result |
| AUTO_APPLY | **PASS** | file persisted |
| files/write 204 | matching write observed (`waitForMatchingWrite` requires path `index.html` + HTTP 204) | `/opt/aisandbox/workspaces/04ebc946-fb3d-4f94-be94-cef65d2bb6b4/index.html` exists |
| Generated file | confirmed by AUTO_APPLY + disk | 191 bytes; marker `PRIVATE-BETA-E2E-AUTO` count=1 |
| Preview | **PASS** (iframe heading/paragraph asserted) | frozen marker present on disk |
| Checkpoint | runner **PASS** (AUTO-01J bounded observation) | product row `b3e1ae97-fbb5-4c16-9275-dc2a282d683f` / `b6facadbeb798eaef30ff4eb9a354f590a2e20f7` (`AI: applied workspace file actions`, `files_changed=1`) at 11:16:34 |
| Public confirm | runner **PASS** (`validateLiveConfirmResponse`: HTTP 200, `triggered=true`, `reason=completed`) | `confirmStatus=200` `confirmTriggered=true` |
| Deduction count | runner **PASS** (AUTO-01K) | **1** |
| Credits deducted | **1159** | **1159** (`overflow_credits=0`, status=`applied`) |
| Starting balance | **24719** | product `balance_before=24719` |
| Ending balance | **23560** | product `balance_after=23560` |
| Reconciliation | runner **PASS** | 24719 − 1159 = 23560 |
| Duplicate deduction | **NO** | COUNT=1 |
| Stripe | no charge expected (`BILLING_CHARGES_ENABLED=false`) | no `stripe`/`charge`/`payment` tables in public schema; no Stripe charge observed |
| AUTO-01K connection acquisition held | **YES** | preflight `SELECT 1` → `1`; runner DEDUCTION PASS (not role `ubuntu`) |

---

## CHECKPOINT evidence (actual runner PASS)

CHECKPOINT used locked AUTO-01J bounded same-session observation. Matching product row:

```
id          = b3e1ae97-fbb5-4c16-9275-dc2a282d683f
commit_hash = b6facadbeb798eaef30ff4eb9a354f590a2e20f7
files_changed = 1
description = AI: applied workspace file actions
created_at  = 2026-08-23 11:16:34.732149
```

---

## DEDUCTION evidence (actual runner PASS — AUTO-01K)

Runner `verifyDeduction()` obtained `tokens_used` from `GET /api/ai/executions/:executionId`, then `staging.queryDeduction()` ran the AUTO-01K remote extract-only `DATABASE_URL` prefix plus existing `psql "$DATABASE_URL"` SELECT correlated by `source_event_id = executionId`.

```
source_event_id   = e570cdc5-ee53-4102-8137-be54b4900ffa
requested_credits = 1159
applied_credits   = 1159
overflow_credits  = 0
balance_before    = 24719
balance_after     = 23560
status            = applied
deductionCount    = 1
```

This is **actual runner DEDUCTION PASS**. It is not a product-side retrofit. LIVE-10's role-`ubuntu` failure did not recur.

---

## CLEANUP

| Field | Result |
|---|---|
| `cleanup` | `session-stopped` |
| `executionGateFinal` | `restored-false` |
| `GLOBAL_EXECUTION_ENABLED` final | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` final | false (.env + PM2) |
| Session | stopped; `container_id` null |
| Container | removed (`docker ps -a` match 0) |
| Process env | cleared (`E2E_LOGIN_*` / LIVE flags absent) |
| DPAPI `$env:TEMP\aisandbox-e2e-live-11-cred.xml` | **absent** |
| Retained stash | unchanged |
| Unrelated sessions/containers | not touched |

Confirmed-safe cleanup: **YES**. STAGING / PROVIDER-LIVE / CREDIT / ENV released after this verification.

---

## Classification

**PASS.** No failure class. Failed phase: none. Last successful phase: CLEANUP.

LIVE-10 remains COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — DEDUCTION and is not rewritten. LIVE-11 is a new fresh run.

---

## Step 2 terminal state

```
Lane 1             = PRIVATE-BETA-E2E-LIVE-11 LANE-DONE — PASS
Lane 2             = EMPTY
Lane 3             = DISABLED
STAGING owner      = UNOWNED (released after confirmed-safe cleanup)
PROVIDER-LIVE owner= UNOWNED (released after confirmed-safe cleanup)
CREDIT owner       = UNOWNED (released after confirmed-safe cleanup)
ENV owner          = UNOWNED (released after confirmed-safe cleanup)
GOVERNANCE         = UNOWNED (acquired transiently for post-run writes then released)
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
AUTHORIZED_LOCAL_HEAD=e5e41aa9c3237cafdb241ba9c5bb732c675d0632
LIVE_11_STEP_2=COMPLETE — LANE-DONE — PASS
LIVE_11_STEP_3=PENDING
LIVE_STAGING_VALIDATED=NO (Step 3 lock pending; actual runner PASS obtained)
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

---

## Blocker before Step 3

1. Keith owns Git. Commit this Step 2 evidence / board / registry update when ready.
2. Step 3 is consolidation / checkpoint / lock only. Do **not** rerun LIVE-11.
3. Do **not** register PRIVATE-BETA-INVITE-01 in Step 3 unless a later separate lifecycle is explicitly authorized.

**PRIVATE-BETA-E2E-LIVE-11 STEP 2 COMPLETE — PASS — ONE AUTOMATED GOLDEN-PATH RUN COMPLETED AUTH THROUGH BALANCE AND CLEANUP, INCLUDING AUTO-01J CHECKPOINT, AUTO-01K DEDUCTION DATABASE VERIFICATION, AND 1:1 CREDIT RECONCILIATION — READY FOR STEP 3**

