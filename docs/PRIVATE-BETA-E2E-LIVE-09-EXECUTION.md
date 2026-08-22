# PRIVATE-BETA-E2E-LIVE-09 — Step 1 Execution Contract

**Task ID:** PRIVATE-BETA-E2E-LIVE-09  
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

Do not treat this document as a scheduler. Do not treat this document as Step 2 evidence. Do not store credentials here. Do not freeze Step 1 HEAD as the Step 2 deployment target. Do not rerun LIVE-08. Do not rewrite LIVE-08. Do not convert LIVE-08 to PASS. Do not rerun LIVE-07 / LIVE-06. Do not reopen AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I. Do not reopen PRIVATE-BETA-BLOCKER-03L. Do not weaken runner clean-tree SAFETY. Do not patch residual `page.goto()` / `selectOption` / `trace: 'off'` surfaces. Do not reintroduce `e2e-auto.html`. Do not register PRIVATE-BETA-INVITE-01.

If Step 2 later writes evidence into a successor section or a later revision of this file, that evidence must be actual observed runtime data. This Step 1 revision contains **no fabricated runtime evidence**.

LIVE-09 is a **NEW fresh LIVE run**. It is **NOT** a rerun of LIVE-08.

---

## Purpose

LIVE-09 is the first fresh provider-bearing automated Builder golden-path run after PRIVATE-BETA-BLOCKER-03L aligned the frozen fixture with the locked static Preview contract.

Frozen artifact:

```
index.html
```

Frozen marker:

```
PRIVATE-BETA-E2E-AUTO
```

Its relevant locked predecessors are:

- **AUTO-01G:** AUTO_APPLY persistence observed through early-captured `POST /api/sessions/:sessionId/files/write` 204. WAIT_FOR_AUTO_APPLY uses `FROZEN_ARTIFACT_PATH`, now `index.html`.
- **AUTO-01H:** BUILD captures the real `executionId` from bounded `POST /api/ai/execute` 202 JSON.
- **AUTO-01I:** canonical LIVE clean-execution sequencing frozen.
- **PRIVATE-BETA-BLOCKER-03L:** COMPLETE AND LOCKED — PASS — 2026-08-22 — RUNNER_FIXTURE_FIX — `FROZEN_ARTIFACT_PATH='index.html'`.

LIVE-08 remains historical:

COMPLETE AND LOCKED — FAIL/BLOCKED — PRODUCT_FAILURE — PREVIEW — 2026-08-22

Do not rewrite it. Do not convert it to PASS. Do not rerun it.

The purpose of LIVE-09 is to determine whether the **complete automated Builder golden path** now succeeds against real staging with the 03L-aligned `index.html` artifact, without repeating the LIVE-07 sequencing defect and without repeating the LIVE-08 Preview filename mismatch.

The run must test the full chain:

```
AUTH
→ SAFETY
→ STARTING_BALANCE
→ CREATE_SESSION
→ BUILD
→ AUTO_APPLY
→ PREVIEW
→ CHECKPOINT
→ PUBLIC_CONFIRM
→ DEDUCTION
→ BALANCE
→ CLEANUP
```

Its purpose is **not** to test AUTO-01G, AUTO-01H, AUTO-01I, or 03L individually.  
Its purpose is **not** to retry, reopen, or convert LIVE-08.

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

LIVE-09 prevents that class completely, the same way LIVE-08 Step 1 did.

Therefore Step 1 produces the **FULL** intended reservation state on the authoritative `TASKS.md` board.

Keith will commit/push this Step 1 state **BEFORE** Step 2.

Reservation ≠ authorization.

---

## Step 1 recorded HEAD (NOT frozen for Step 2)

```
branch = main
HEAD   = f9df707be4d330b851584d09e745e676e8017e67
status = CLEAN
```

AUTO-01G implementation commit `b9cba2480ea4e9c814d17342c0e6aed2b469ef69` is an ancestor of HEAD.  
AUTO-01H implementation commit `25c25bd79c205c52838b3d151c73a0bc4a4de13f` is an ancestor of HEAD.  
AUTO-01I is an ancestor of HEAD.  
03L fixture alignment commit `6a73b2ca95883be6f82fafc15ff533bc2be58224` is an ancestor of HEAD.  
03L lock commit `f9df707be4d330b851584d09e745e676e8017e67` is current HEAD.

Do **not** freeze `f9df707be4d330b851584d09e745e676e8017e67` as `AUTHORIZED_LOCAL_HEAD`.

Step 1 HEAD is informational only.

**Step 1 HEAD frozen for Step 2: NO**

After Keith commits this Step 1 reservation state, Step 2 MUST use the **then-current CLEAN committed HEAD**. Step 2 MUST NOT construct `AUTHORIZED_LOCAL_HEAD` from this pre-commit HEAD.

---

## Step 1 resource reservation (MUST remain owned)

Step 1 **does** reserve on `TASKS.md`:

| Resource | Owner after Step 1 |
|---|---|
| STAGING | PRIVATE-BETA-E2E-LIVE-09 |
| PROVIDER-LIVE | PRIVATE-BETA-E2E-LIVE-09 |
| CREDIT | PRIVATE-BETA-E2E-LIVE-09 |
| ENV | PRIVATE-BETA-E2E-LIVE-09 |

These reservations **MUST remain owned by LIVE-09 after Step 1 completes.**

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

---

## Future Step 2 execution-edge rule (mandatory)

The future Step 2 canonical ordering is mandatory:

1. explicit Keith LIVE authorization already obtained
2. verify STAGING / PROVIDER-LIVE / CREDIT / ENV ownership is already committed on `TASKS.md` for LIVE-09
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

No resource-acquisition writes are permitted there because LIVE-09 ownership must already be committed from Step 1.

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
- applicable execution/billing gate preconditions valid (`GLOBAL_EXECUTION_ENABLED=false` / `BILLING_CHARGES_ENABLED=false` before any runner-owned enablement)

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

After invocation #1, LIVE-09 is consumed even if:

- provider calls used = 0
- credits deducted = 0
- BUILD not reached
- PREVIEW fails
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

## 03L fixture contract

The frozen Builder artifact is now:

```
index.html
```

The BUILD prompt must request exactly one `index.html` with the frozen marker `PRIVATE-BETA-E2E-AUTO`.

No extra files.

Do **not** reintroduce `e2e-auto.html`.

AUTO_APPLY must therefore prove:

```
POST /api/sessions/:sessionId/files/write
sessionId = CREATE_SESSION session
path     = index.html
HTTP     = 204
```

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

WAIT_FOR_AUTO_APPLY uses `FROZEN_ARTIFACT_PATH`, which is now `index.html`.

WAIT_FOR_AUTO_APPLY must prove:

```
POST /api/sessions/:sessionId/files/write
sessionId = CREATE_SESSION session
path     = index.html
HTTP     = 204
```

The listener is armed during ARM_LISTENERS and retains early evidence.

Do **not** require the Code & Files rendered file node.  
Do **not** force a tab switch.  
Preview may remain the default tab.

This is the locked AUTO-01G observation plus the 03L path value. Do not reopen AUTO-01G. Do not revert to the LIVE-06 file-tree locator. Do not revert the path to `e2e-auto.html`.

---

## PREVIEW contract

PREVIEW must now exercise the legitimate locked static contract:

workspace root contains `index.html`.

Start Preview should launch the static project.

PASS requires **actual runner Preview PASS**.

Do **not** count presence of `index.html` alone as Preview success.

Require the actual preview URL / iframe / evidence defined by the runner.

---

## CHECKPOINT / PUBLIC_CONFIRM contract

Require the runner to reach and PASS:

1. CHECKPOINT
2. PUBLIC_CONFIRM

PUBLIC_CONFIRM requires captured HTTP evidence:

- HTTP 200
- `triggered=true`
- `reason=completed`

Product-side logs alone are not enough if runner phase evidence is absent.

---

## AUTO-01F cleanup semantics

Normal final target:

- `GLOBAL_EXECUTION_ENABLED=false`
- `BILLING_CHARGES_ENABLED=false`
- session stopped
- container removed
- LIVE env cleared
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

1. Verify required resource ownership is already committed on `TASKS.md` for LIVE-09.
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

AUTHORIZED_LOCAL_HEAD **must include** AUTO-01G, AUTO-01H, AUTO-01I, 03L `index.html` fixture alignment, and this committed LIVE-09 reservation. If it does not: **STOP** before deploy/provider.

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

LIVE-09 PASS requires **ALL** mandatory evidence:

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
- PREVIEW PASS (actual runner Preview PASS; file presence alone is not enough)
- CHECKPOINT PASS
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

They are not current blockers. Do not fix them in LIVE-09.

If one becomes the proven LIVE blocker: freeze evidence and handle it later in a separate lifecycle. No patching during LIVE execution.

If Step 2 exposes an actual product defect: STOP. Register a separate blocker later. Do not repair product source inside this live task.

Do not modify the runner in this task. Do not modify product code. Do not modify dependencies.

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

Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H / AUTO-01I runner or product source in this task.

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
STAGING owner        = PRIVATE-BETA-E2E-LIVE-09
PROVIDER-LIVE owner  = PRIVATE-BETA-E2E-LIVE-09
CREDIT owner         = PRIVATE-BETA-E2E-LIVE-09
ENV owner            = PRIVATE-BETA-E2E-LIVE-09
GOVERNANCE           = UNOWNED (released after Step 1 writes)
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
LIVE_09_STEP_1_HEAD_FROZEN_FOR_STEP_2=NO
AUTHORIZED_LOCAL_HEAD=NOT_CAPTURED
```

Do not release STAGING / PROVIDER-LIVE / CREDIT / ENV merely because Step 1 contains no runtime.

This is the committed mutex state that AUTO-01I requires.

---

## Blocker before Step 2

1. Keith must **commit/push this complete reservation state** so the committed HEAD contains LIVE-09 ownership of STAGING / PROVIDER-LIVE / CREDIT / ENV.
2. Explicit Keith LIVE authorization is required before any staging compare/deploy, SSH, LIVE flags, provider call, credit mutation, or `npm run e2e:builder:live`.
3. After that authorization, Step 2 must construct the execution edge on a **CLEAN** tree with **NO** further governance writes, using the then-current clean committed HEAD — not this Step 1 pre-commit HEAD.

If VPN must remain ON for the selected Cursor model: STOP before LIVE execution.

**PRIVATE-BETA-E2E-LIVE-09 STEP 1 COMPLETE — REGISTERED WITH STAGING / PROVIDER-LIVE / CREDIT / ENV RESERVED IN COMMITTABLE BOARD STATE, RUNTIME AUTHORIZATION FLAGS FALSE, AND FROZEN GOLDEN-PATH ARTIFACT INDEX.HTML — KEITH MUST COMMIT BEFORE STEP 2 EXECUTION EDGE — NO LIVE ACTIVITY**
