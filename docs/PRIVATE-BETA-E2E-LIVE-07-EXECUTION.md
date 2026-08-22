# PRIVATE-BETA-E2E-LIVE-07 — Step 1 Execution Contract

**Task ID:** PRIVATE-BETA-E2E-LIVE-07  
**Step:** 1 — Registration + exact LIVE execution contract freeze  
**Date:** 2026-08-21  
**Nature:** CONTRACT / SETUP ONLY  
**Runtime evidence:** NONE  
**LIVE run:** NO  
**SSH:** NO  
**Staging mutation:** NO  
**Provider call:** NO  
**Credit mutation:** NO  
**Gate mutation:** NO  
**Git mutation:** NO

Do not treat this document as a scheduler. Do not treat this document as Step 2 evidence. Do not store credentials here. Do not freeze Step 1 HEAD as the Step 2 deployment target. Do not rerun LIVE-06. Do not rewrite LIVE-06. Do not convert LIVE-06 to PASS. Do not reopen AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H. Do not patch residual `page.goto()` / `selectOption` / `trace: 'off'` surfaces. Do not register PRIVATE-BETA-INVITE-01.

If Step 2 later writes evidence into a successor section or a later revision of this file, that evidence must be actual observed runtime data. This Step 1 revision contains **no fabricated runtime evidence**.

LIVE-07 is **not** a rerun of LIVE-06.

---

## Purpose

LIVE-07 is the first fresh provider-bearing automated staging run after the latest two proven LIVE blockers were corrected:

- **AUTO-01G:** `WAIT_FOR_AUTO_APPLY` now proves persisted workspace file write from the existing `POST /api/sessions/:sessionId/files/write` 204 signal.
- **AUTO-01H:** `BUILD` now captures the real `executionId` from bounded `POST /api/ai/execute` 202 JSON and propagates it to `DEDUCTION`.

The purpose of LIVE-07 is to determine whether the **complete automated Builder golden path** now succeeds against real staging.

Its purpose is **not** to test AUTO-01G or AUTO-01H individually.  
Its purpose is **not** to retry, reopen, or convert LIVE-06.

---

## Step 1 recorded HEAD (NOT frozen for Step 2)

```
branch = main
HEAD   = 21d28dd50c742dce2eaa0f9bb35470d6ce35fa9c
status = CLEAN
```

AUTO-01G implementation commit `b9cba2480ea4e9c814d17342c0e6aed2b469ef69` is an ancestor of HEAD.  
AUTO-01H implementation commit `25c25bd79c205c52838b3d151c73a0bc4a4de13f` is an ancestor of HEAD.  
AUTO-01H lock commit `21d28dd50c742dce2eaa0f9bb35470d6ce35fa9c` is current HEAD.

Do **not** freeze `21d28dd50c742dce2eaa0f9bb35470d6ce35fa9c` as AUTHORIZED_LOCAL_HEAD.

Step 1 HEAD is informational only.

At the future Step 2 execution edge:

```
AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD
```

on a **clean** local `main` tree. Only that exact SHA may be deployed.

---

## One-run rule

Future Step 2 may invoke the existing runner **exactly once**:

```
npm run e2e:builder:live
```

No manual browser flow.  
No second automated run.  
No retry after any failure.

A failed invocation consumes LIVE-07 even if:

- provider calls used = 0
- credits deducted = 0
- BUILD not reached
- automation failure
- environment failure
- provider failure
- Cursor later disconnects
- Playwright outer timeout occurs
- formatted runner verdict is missing

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
- Provider call is permitted only if the runner naturally reaches BUILD
- If execution stops before BUILD: provider usage must remain 0

---

## Credit contract

Future Step 2 may intentionally deduct E2E credits only if the golden path naturally reaches the qualifying deduction path.

Require, if reached:

- starting balance captured
- provider `tokens_used` captured
- exactly one qualifying deduction
- deduction = `tokens_used` under the existing 1:1 rule
- ending balance reconciles exactly (`BALANCE_AFTER = BALANCE_BEFORE - creditsDeducted`)
- no duplicate deduction
- no Stripe charge

If the run stops before deduction: credits deducted = 0.  
No synthetic/manual deduction.

---

## AUTO-01G expectation (WAIT_FOR_AUTO_APPLY)

WAIT_FOR_AUTO_APPLY now requires a successful persisted workspace file write:

```
POST /api/sessions/:sessionId/files/write
sessionId = CREATE_SESSION session
path     = e2e-auto.html
HTTP     = 204
```

The listener is armed during ARM_LISTENERS and retains early evidence.

Do **not** require the Code & Files rendered file node.  
Preview may remain the default tab.

This is the locked AUTO-01G observation. Do not reopen AUTO-01G. Do not revert to the LIVE-06 file-tree locator.

---

## AUTO-01H expectation (BUILD executionId)

BUILD now observes:

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

---

## Staging deployment contract

SSH alias: `aisandbox-staging`  
Repo: `/opt/aisandbox`

Retained stash invariant:

- `stash@{0}`
- SHA `0372cc1f47f82e1db060ed2dd756a938fe324803`
- historical name `pre-03F-deployment-snapshot-2026-08-15`
- never modify, pop, apply, drop, rename, or recreate it

At Step 2:

1. Require local tree clean.
2. Capture `AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD`.
3. Compare staging HEAD with that dynamic AUTHORIZED_LOCAL_HEAD.
4. If different:
   - `git fetch origin main`
   - verify target exists
   - `git reset --hard <AUTHORIZED_LOCAL_HEAD>`
5. Never `git pull`.
6. Never deploy another SHA.
7. Conditional rebuild/restart only according to actual changed files and the authoritative deployment procedure (E2E-04 Phase E / 03F).

Afterward require:

- exact HEAD parity
- clean staging tree
- stash invariant intact
- required PM2 services healthy

AUTHORIZED_LOCAL_HEAD **must include** AUTO-01G and AUTO-01H. If it does not: **STOP** before deploy/provider.

Do not deploy LIVE-06 SHA `da56659d39a5d86d3ef994a7458a297169eeda42` as a substitute.

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

LIVE-07 PASS requires **ALL** mandatory evidence:

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

They are not current blockers. Do not fix them in LIVE-07.

If one becomes the proven LIVE blocker: freeze evidence and handle it later in a separate lifecycle. No patching during LIVE execution.

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

## Step 1 activity ledger

```
LIVE runs = 0
SSH connections = 0
staging mutations = 0
provider calls = 0
credit mutations = 0
gate mutations = 0
project/session creation = 0
production-source modifications = 0
automation implementation modifications = 0
Git mutations = 0
```

---

## Readiness (unchanged by registration)

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Registration alone does not change readiness.

---

## Planned Step 2 resources (not acquired in Step 1)

- STAGING
- PROVIDER-LIVE
- CREDIT
- ENV

GOVERNANCE was acquired for this Step 1 board/registry/contract write, then released.

---

## Blocker before Step 2

Explicit Keith LIVE authorization is required before any staging compare/deploy, SSH, LIVE flags, provider call, credit mutation, or `npm run e2e:builder:live`.

If VPN must remain ON for the selected Cursor model: STOP before LIVE execution.

**PRIVATE-BETA-E2E-LIVE-07 STEP 1 COMPLETE — REGISTERED FOR ONE FRESH AUTOMATED STAGING GOLDEN-PATH RUN AFTER AUTO-01G/H — NO LIVE/SSH/PROVIDER/CREDIT ACTIVITY — STEP 2 REQUIRES EXPLICIT LIVE AUTHORIZATION**

---

# PRIVATE-BETA-E2E-LIVE-07 — Step 2 Runtime Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-07  
**Step:** 2 — ONE authorized automated staging golden-path run  
**Date:** 2026-08-21  
**Primary classification:** ENVIRONMENT/PARITY_FAILURE  
**Failed phase:** SAFETY  
**Last successful runner phase:** AUTH  
**Step 2 state:** LANE-DONE — FAIL/BLOCKED — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` **once**)  
**LIVE_RUNNER_INVOKE:** 1  
**NPM_EXIT:** 1  
**Formatted verdict:** `verdict=FAIL`  
**Playwright duration:** 1.5s (not the 600000ms outer timeout)

Do not treat this document as a scheduler. LIVE-07 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H from this step. This is not a LIVE-06 rerun. Do not rerun LIVE-07. No patching during this task.

---

## Verdict

Keith authorized Step 2. Local `main` was CLEAN at AUTHORIZED_LOCAL_HEAD capture. AUTO-01G `b9cba2480ea4e9c814d17342c0e6aed2b469ef69` and AUTO-01H `25c25bd79c205c52838b3d151c73a0bc4a4de13f` are ancestors. VPN was OFF. Staging compare-then-deploy of AUTHORIZED_LOCAL_HEAD succeeded. Product `frontend/` and `services/` were unchanged vs pre-deploy staging HEAD, so rebuild/restart was skipped. Post-deploy HEAD parity, stash invariant, PM2 health, and pre-runner gates (`GLOBAL_EXECUTION_ENABLED=false`, `BILLING_CHARGES_ENABLED=false`) passed.

Playwright LIVE was invoked **exactly once**. AUTH completed. SAFETY fail-closed immediately:

```
Local worktree is dirty. LIVE execution-edge parity requires a clean tree. No automatic deploy.
```

The dirty local files were the Step 2 control-plane writes to `TASKS.md` and `TASKS_BACKLOG_FULL.md` (resource acquisition) after AUTHORIZED_LOCAL_HEAD was captured. `readAuthorizedLocalHead()` requires `git status --short` empty before inspectParity / gate enable. inspectParity was never reached. The execution gate was never enabled. BUILD was never reached. Provider usage remained 0. Credits deducted remained 0.

Failure class: **ENVIRONMENT/PARITY_FAILURE** at **SAFETY**.

THIS WAS NOT A PRODUCT FAILURE.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN AUTOMATION SELECTOR/ADAPTER MISMATCH of AUTO-01G/AUTO-01H.  
THIS WAS NOT a LIVE-06 rerun.

Do not patch the dirty-tree gate inside LIVE-07. Zero provider retries. Do not invoke `npm run e2e:builder:live` again.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `6723c4699d9c2cea832f73356aa85960b230b3cf` |
| STAGING_HEAD_BEFORE | `da56659d39a5d86d3ef994a7458a297169eeda42` (locked LIVE-06 staging HEAD) |
| Deployment performed | **YES** |
| STAGING_HEAD_AFTER | `6723c4699d9c2cea832f73356aa85960b230b3cf` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| `git pull` | **NOT USED** |
| Rebuild / restart | **SKIPPED** — `frontend/` and `services/` unchanged vs pre-deploy HEAD (AUTO-01G/AUTO-01H/LIVE-07 commits are e2e/docs/governance only; package/lockfiles unchanged) |
| AUTO-01G on authorized HEAD | **YES** (ancestor `b9cba2480ea4e9c814d17342c0e6aed2b469ef69`) |
| AUTO-01H on authorized HEAD | **YES** (ancestor `25c25bd79c205c52838b3d151c73a0bc4a4de13f`) |
| AUTO-01E / AUTO-01F / AUTO-01C / AUTO-01D | **YES** (ancestors) |
| Local tree at HEAD capture | CLEAN / `main` |
| Staging tree after deploy | CLEAN |
| stash@{0} before | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) |
| stash@{0} after | `0372cc1f47f82e1db060ed2dd756a938fe324803` — unchanged; not applied/dropped/renamed |

---

## Post-deploy / revalidated environment (actual)

| Check | Result |
|---|---|
| STAGING_HEAD == AUTHORIZED_LOCAL_HEAD | PASS |
| Staging worktree CLEAN | PASS |
| Local worktree CLEAN at HEAD capture | PASS |
| Local worktree CLEAN at runner invocation | **FAIL** — `TASKS.md` and `TASKS_BACKLOG_FULL.md` modified for Step 2 resource acquisition |
| Retained stash exact SHA | PASS |
| Gateway `http://127.0.0.1:4000/api/health/ready` | HTTP 200 (before runner; after runner) |
| AI service `http://127.0.0.1:4001/metrics` | HTTP 200 |
| Container manager `http://127.0.0.1:4002/api/health` | HTTP 200 |
| Frontend `http://127.0.0.1:3002` | HTTP 307 |
| PM2 (gateway / ai-service / container-manager / frontend / ops-watchdog) | online |
| Gateway PM2 restarts | 248 before runner; **248 after runner** (gate never enabled) |
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) — not unexpectedly true |
| `BILLING_CHARGES_ENABLED` before runner | false (.env + PM2) |
| AUTO-01B `inspectParity` | **NOT REACHED** (local dirty-tree check threw first) |
| AUTO-01C ready-wait | **NOT REACHED** |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once** (`LIVE_RUNNER_INVOKE=1`)
- Start: `2026-08-21T23:06:35.9625068+08:00`
- End: `2026-08-21T23:06:41.4600274+08:00`
- Playwright duration: **1.5s** (not the 600000ms outer timeout)
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1` (process-only; never written to repo)
- Credentials: transient DPAPI `PSCredential` import from `$env:TEMP\aisandbox-e2e-live-07-cred.xml`; temp file deleted in `finally`; process env cleared after runner (`ENV_CLEARED=YES`); never printed/committed
- Human browser intervention: **NO**
- NPM_EXIT: **1**

Formatted runner output:

```
verdict=FAIL
phase=SAFETY
error=Local worktree is dirty. LIVE execution-edge parity requires a clean tree. No automatic deploy.
projectId=null
sessionId=null
executionId=null
cleanup=session-stop-not-attempted
executionGateFinal=not-attempted-no-authority
```

Runner phases reached: PREPARE_BROWSER → AUTH → SAFETY → CLEANUP  

Runner phases **NOT REACHED:** STARTING_BALANCE / ARM_LISTENERS / CREATE_SESSION / BUILD / WAIT_FOR_AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE

Last successfully completed **runner** phase: **AUTH**

---

## IDs / provider / accounting (observed)

| Fact | Runner | Post-failure staging evidence |
|---|---|---|
| projectId | `null` | no LIVE-07 disposable project created |
| sessionId | `null` | no LIVE-07 disposable session created |
| containerId | unknown / not created | no LIVE-07 disposable container created |
| executionId | `null` | BUILD not reached |
| executionId source | n/a | BUILD `/api/ai/execute` not observed |
| Provider / model authorized | xAI / grok-4.5 | unused |
| Provider-call budget | 1 | unused |
| Provider calls used | **0** | **0** |
| Retries used | **0** | **0** |
| tokens_used | not captured | n/a |
| execute POST count | **0** | BUILD not reached |
| Send click count | **0** | BUILD not reached |
| AUTO_APPLY | NOT REACHED | n/a |
| files/write 204 | NOT REACHED | n/a |
| Generated file | NOT REACHED | n/a |
| Preview | NOT REACHED | n/a |
| Checkpoint | NOT REACHED | n/a |
| Public confirm | NOT REACHED | n/a |
| Deduction count | NOT REACHED | **0** |
| Credits deducted | NOT REACHED | **0** |
| Starting balance | NOT REACHED | n/a |
| Ending balance | NOT REACHED | n/a |
| Reconciliation | n/a | n/a |
| Stripe / payment | n/a | `BILLING_CHARGES_ENABLED=false`; no Stripe charge observed |

```
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
RUNNER_INVOKED=YES
RETRIES=0
```

---

## Cleanup / final gates

Runner `finally` ran. No second LIVE run. No second SSH restore attempt. Gate restore was not required because the runner never acquired execution-gate authority.

- Gate restore: `executionGateFinal=not-attempted-no-authority`
- Gateway PM2 restarts: **248** before and after (no enable, no restore)
- `GLOBAL_EXECUTION_ENABLED` final: **false** (.env + PM2) — confirmed by post-failure SSH
- `BILLING_CHARGES_ENABLED` final: **false** (.env + PM2) — confirmed by post-failure SSH
- Session final: **not created**
- Container final: **not created**
- Credential / LIVE process env: cleared (`ENV_CLEARED=YES`)
- DPAPI temp file `$env:TEMP\aisandbox-e2e-live-07-cred.xml`: **absent**
- Staging HEAD after run: still `6723c4699d9c2cea832f73356aa85960b230b3cf`
- Retained stash after run: still `0372cc1f47f82e1db060ed2dd756a938fe324803`
- Staging worktree after run: CLEAN

```
GLOBAL_EXECUTION_ENABLED_FINAL=false
BILLING_CHARGES_ENABLED_FINAL=false
OPERATOR_REMEDIATION_REQUIRED=NO
```

---

## Readiness (unchanged by Step 2)

```
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
LIVE_STAGING_VALIDATED=NO
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
```

Step 3 consolidation must decide readiness. Step 2 does not declare GO and does not register PRIVATE-BETA-INVITE-01.

---

## Step 3 note

LIVE-07 remains **ACTIVE** and unlocked. Step 3 consolidation is required in a **NEW** Cursor window.

Do not retry the provider. Do not rerun LIVE-07. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F / AUTO-01G / AUTO-01H inside this live task. Do not return to manual browser testing. Do not register PRIVATE-BETA-INVITE-01. Do not patch the local dirty-tree SAFETY gate inside LIVE-07.

**PRIVATE-BETA-E2E-LIVE-07 STEP 2 COMPLETE — FAIL/BLOCKED — ENVIRONMENT/PARITY_FAILURE AT SAFETY — DO NOT RERUN LIVE-07**
