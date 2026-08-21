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
