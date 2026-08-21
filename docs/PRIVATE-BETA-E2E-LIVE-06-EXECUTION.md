# PRIVATE-BETA-E2E-LIVE-06 — Step 1 Execution Contract

**Task ID:** PRIVATE-BETA-E2E-LIVE-06  
**Step:** 1 — Registration + exact LIVE execution contract freeze  
**Date:** 2026-08-21  
**Nature:** CONTRACT / SETUP ONLY  
**Runtime evidence:** NONE  
**LIVE run:** NO  
**SSH:** NO  
**Staging mutation:** NO  
**Provider call:** NO  
**Credit mutation:** NO

Do not treat this document as a scheduler. Do not treat this document as Step 2 evidence. Do not store credentials here. Do not freeze Step 1 HEAD as the Step 2 deployment target. Do not rerun LIVE-05. Do not rewrite LIVE-05. Do not patch residual `page.goto()` / `selectOption` / `trace: 'off'` surfaces.

If Step 2 later writes evidence into a successor section or a later revision of this file, that evidence must be actual observed runtime data. This Step 1 revision contains **no fabricated runtime evidence**.

---

## Purpose

LIVE-06 is the first fresh automated staging validation after:

- AUTO-01E: CREATE_SESSION project-response/body observation made fail-closed
- AUTO-01F: SSH subprocess execution used by cleanup/gate restoration made finitely bounded

The purpose of LIVE-06 is **not** to test those tooling changes individually.

Its purpose is to determine whether the **complete automated Builder golden path** now succeeds against real staging.

---

## Step 1 recorded HEAD (NOT frozen for Step 2)

```
branch = main
HEAD   = 42710013491f14fdc7fb9f80c4b7e3837ea98a3a
status = CLEAN
```

AUTO-01E implementation commit `c3c65d3289d089b4970e6551552775f9e540f1e0` is an ancestor of HEAD.  
AUTO-01F implementation commit `03614c72f93b05d485fda204f1220331c4d5b5f3` is an ancestor of HEAD.  
AUTO-01F lock commit `42710013491f14fdc7fb9f80c4b7e3837ea98a3a` is current HEAD.

Do **not** freeze `42710013491f14fdc7fb9f80c4b7e3837ea98a3a` as AUTHORIZED_LOCAL_HEAD.

Step 2 recaptures:

```
AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD
```

on a **clean** local tree at the Step 2 execution edge.

---

## One-run rule

Step 2 must invoke the existing runner **exactly once**:

```
npm run e2e:builder:live
```

No manual browser flow.  
No second automated run.  
No retry after any failure.

This remains true if:

- provider calls used = 0
- credits deducted = 0
- browser fails
- automation fails
- environment fails
- Cursor later disconnects
- Playwright timeout occurs
- formatted runner verdict is missing

A failed invocation is terminal evidence for LIVE-06.

After that invocation, only evidence collection and cleanup of the **same disposable run** are allowed.

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
- No model fallback
- No second provider call
- Provider call is permitted only if the runner naturally reaches BUILD
- If execution stops before BUILD: provider usage must remain 0

---

## Credit contract

Credit mutation is authorized in Step 2 only if the golden path naturally reaches the qualifying deduction stage.

Require:

- starting balance captured
- exactly one qualifying usage/deduction
- deduction equals provider `tokens_used` according to the existing 1:1 rule
- ending balance reconciles
- no duplicate deduction
- no Stripe charge

If the run stops before deduction: credits deducted must remain 0.  
No synthetic/manual deduction.

---

## Staging deployment contract

At the Step 2 execution edge:

1. Require local tree clean.
2. Capture `AUTHORIZED_LOCAL_HEAD = git rev-parse HEAD`.
3. Inspect staging HEAD / cleanliness / stash.
4. Preserve retained stash invariant:
   - `stash@{0}`
   - SHA `0372cc1f47f82e1db060ed2dd756a938fe324803`
   - historical name `pre-03F-deployment-snapshot-2026-08-15`
   - never modify, pop, drop, apply, rename, or recreate that stash
5. If staging is not at AUTHORIZED_LOCAL_HEAD, deploy **exactly** AUTHORIZED_LOCAL_HEAD using:
   - `git fetch origin main`
   - verify target commit exists
   - `git reset --hard <AUTHORIZED_LOCAL_HEAD>`
6. Do not `git pull`.
7. Do not deploy another SHA.
8. Do not blindly rebuild/restart everything.
9. Use conditional rebuild/restart according to actual diff, existing staging procedure, and authoritative docs.

After deployment require:

- exact HEAD parity
- clean staging tree
- retained stash intact
- required PM2 services healthy

---

## VPN / SSH

Step 1 does not SSH.

For Step 2: Keith should have VPN **OFF** for staging SSH because VPN routing can interfere with `aisandbox-staging`.

Do not change VPN during an active SSH command.

If the selected Cursor model itself requires VPN ON and therefore cannot operate staging reliably: **STOP before Step 2** and report the conflict. Do not improvise around it.

---

## Auth / LIVE flags

Use the existing regular-user credential mechanism only.

Required runner vars:

- `E2E_LOGIN_EMAIL`
- `E2E_LOGIN_PASSWORD`

Never print credentials. Never write plaintext credentials to repo files. Verify cleanup removes the transient credential artifact.

Step 2 fail-closed flags (do **not** set in Step 1):

- `E2E_MODE=live`
- `E2E_LIVE_AUTHORIZED=true`
- `E2E_ALLOW_STAGING_MUTATION=true`
- `E2E_ALLOW_CREDIT_MUTATION=true`
- `PROVIDER_CALL_BUDGET=1`

---

## Safety gates / AUTO-01E / AUTO-01F

Before the provider-bearing run require:

- AUTH
- exact staging parity
- clean local/staging state
- retained stash invariant
- required services healthy
- billing charging gate false
- execution-gate preconditions
- AUTO-01C post-restart gateway-ready wait

The runner may temporarily set `GLOBAL_EXECUTION_ENABLED=true` only as required by the existing LIVE procedure.

Final normal cleanup target:

- `GLOBAL_EXECUTION_ENABLED=false`
- `BILLING_CHARGES_ENABLED=false`

AUTO-01E relevance: CREATE_SESSION project-response/body observation is now fail-closed. Do not assume this guarantees PASS.

AUTO-01F cleanup semantics: if SSH gate restoration times out:

- `executionGateFinal = restore-unconfirmed-timeout`
- Do **not** report `restored-false` unless restoration was actually confirmed
- local cleanup must regain control
- terminal FAIL evidence should be produced
- operator verification/remediation required
- no automatic retry
- no second SSH attempt
- no second LIVE run

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

---

## Blocker before Step 2

Explicit Keith LIVE authorization is required before any staging compare/deploy, SSH, LIVE flags, provider call, credit mutation, or `npm run e2e:builder:live`.

**PRIVATE-BETA-E2E-LIVE-06 STEP 1 COMPLETE — REGISTERED FOR ONE FRESH AUTOMATED STAGING GOLDEN-PATH RUN — NO LIVE/SSH/PROVIDER/CREDIT ACTIVITY YET — STEP 2 REQUIRES EXPLICIT LIVE AUTHORIZATION**
