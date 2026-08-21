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

---

# PRIVATE-BETA-E2E-LIVE-06 — Step 2 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-06  
**Step:** 2 — ONE authorized automated staging golden-path run  
**Date:** 2026-08-21  
**Primary classification:** AUTOMATION_ADAPTER_FAILURE  
**Failed phase:** WAIT_FOR_AUTO_APPLY  
**Last successful runner phase:** BUILD  
**Step 2 state:** LANE-DONE — FAIL/BLOCKED — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` **once**)  
**NPM_EXIT:** 1  
**Formatted verdict:** `verdict=FAIL`

Do not treat this document as a scheduler. LIVE-06 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F from this step. This is not a LIVE-05 rerun. Do not rerun LIVE-06.

---

## Verdict

Authorized current-HEAD staging deployment / parity succeeded. AUTH, SAFETY (AUTO-01B `inspectParity`), AUTO-01C post-gate gateway-ready wait, STARTING_BALANCE, ARM_LISTENERS, CREATE_SESSION (AUTO-01E/AUTO-01D), and BUILD **PASSED** in the runner.

Playwright LIVE was invoked **once**. It submitted exactly one Build. The formatted runner verdict was printed. CLEANUP ran inside `runGoldenPath` `finally`.

The runner then failed **WAIT_FOR_AUTO_APPLY** after 180000ms waiting for locator `[data-testid="workspace-file-node-e2e-auto.html"]` to be visible. The Playwright failure screenshot shows the **Preview** tab active (`DEFAULT_ACTIVE_TAB_ID = 'preview'`). That tab does not render the Code & Files file tree (`workspace-file-node-*` exists only when `activeTabId === 'codeFiles'`). The runner never switched tabs before waiting for the file node.

Post-failure host/DB evidence shows the product path **did** apply the file, create an automatic checkpoint, complete one xAI execution, trigger `confirm_build_apply.deduction_triggered`, and deduct credits 1:1. Those product facts do **not** convert this LIVE run to PASS: the automated golden-path runner verdict is FAIL, PREVIEW was not reached by the runner, and public-confirm HTTP 200 / `triggered=true` / `reason=completed` were not captured by the runner.

Failure class: **AUTOMATION_ADAPTER_FAILURE**

THIS WAS NOT A PRODUCT FAILURE of Build / AUTO_APPLY / file write.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY_FAILURE of the deployed tree.  
THIS WAS NOT a LIVE-05 rerun.

Do not patch the file-tree / Preview-tab adapter inside LIVE-06. Zero provider retries. Do not rerun LIVE-06.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `da56659d39a5d86d3ef994a7458a297169eeda42` |
| STAGING_HEAD_BEFORE | `3ee27663a97acdc0dbc75678007bcaa60ee0f7b9` (locked LIVE-05 staging HEAD) |
| Deployment performed | **YES** |
| STAGING_HEAD_AFTER | `da56659d39a5d86d3ef994a7458a297169eeda42` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| Rebuild / restart | **SKIPPED** — `frontend/` and `services/` unchanged vs pre-deploy HEAD (AUTO-01E/AUTO-01F/LIVE-06 commits are e2e/docs/governance only) |
| AUTO-01E on staging | **YES** (`PROJECT_CREATE_OBSERVATION_TIMEOUT_MS`, LIVE `actionTimeout`/`navigationTimeout`) |
| AUTO-01F on staging | **YES** (`SSH_EXECUTION_TIMEOUT_MS`, `restore-unconfirmed-timeout`, `SshExecutionTimeoutError`) |
| AUTO-01C / AUTO-01D on staging | **YES** |
| Local tree at capture | CLEAN / `main` |
| Staging tree after deploy | CLEAN |
| stash@{0} before | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot-2026-08-15`) |
| stash@{0} after | `0372cc1f47f82e1db060ed2dd756a938fe324803` — unchanged; not applied/dropped |

---

## Post-deploy / revalidated environment (actual)

| Check | Result |
|---|---|
| STAGING_HEAD == AUTHORIZED_LOCAL_HEAD | PASS |
| Staging worktree CLEAN | PASS |
| Local worktree CLEAN before runner | PASS |
| Retained stash exact SHA | PASS |
| Gateway `http://127.0.0.1:4000/api/health/ready` | HTTP 200 (before runner; after restore) |
| AI service `http://127.0.0.1:4001/metrics` | HTTP 200 |
| Container manager `http://127.0.0.1:4002/api/health` | HTTP 200 |
| Frontend `http://127.0.0.1:3002` | HTTP 307 |
| PM2 (gateway / ai-service / container-manager / frontend / ops-watchdog) | online |
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) — not unexpectedly true |
| `BILLING_CHARGES_ENABLED` before runner | false (.env + PM2) |
| AUTO-01B `inspectParity` | PASS (SAFETY reached STARTING_BALANCE / BUILD) |
| AUTO-01C ready-wait | PASS (STARTING_BALANCE / BUILD succeeded after gate-enable `pm2 restart`) |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once** (`LIVE_RUNNER_INVOKE=1`)
- Start: `2026-08-21T20:20:25.8869609+08:00`
- End: `2026-08-21T20:26:25.7334626+08:00`
- Playwright duration: **5.9m** (not the 600000ms outer timeout)
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1`
- Credentials: transient DPAPI `PSCredential` import; temp file deleted immediately; process env cleared after runner (`ENV_CLEARED=YES`); never printed/committed
- Human browser intervention: **NO**
- NPM_EXIT: **1**

Formatted runner output:

```
verdict=FAIL
phase=WAIT_FOR_AUTO_APPLY
error=locator.waitFor: Timeout 180000ms exceeded.
Call log:
  - waiting for locator('[data-testid="workspace-file-node-e2e-auto.html"]') to be visible
projectId=15475946-ba5e-44e4-89b6-13b355d8e423
sessionId=a8bb5a4d-a6bb-487d-a100-bc95330ce7b3
executionId=null
cleanup=session-stopped
executionGateFinal=restored-false
```

Runner phases reached: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION → BUILD → WAIT_FOR_AUTO_APPLY → CLEANUP  

Runner phases **NOT REACHED:** PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE

Last successfully completed **runner** phase: **BUILD**

---

## IDs / provider / accounting (observed)

| Fact | Runner | Post-failure staging evidence |
|---|---|---|
| projectId | `15475946-ba5e-44e4-89b6-13b355d8e423` | same; name `E2E-AUTO-Disposable-2026-08-21T12-20-36-699Z` |
| sessionId | `a8bb5a4d-a6bb-487d-a100-bc95330ce7b3` | same |
| executionId | `null` (submitBuild JSON capture miss) | `1a995035-6b1c-431b-acc2-8dd1e51a53da` |
| Provider / model authorized | xAI / grok-4.5 | UI screenshot: **grok-4.5 (xAI)**; `usage_records.provider=xai`; `usage_records.model=null` |
| Provider-call budget | 1 | 1 row in `usage_records` for this session |
| Provider calls used | not printed | **1** |
| Retries used | 0 | **0** |
| tokens_used | not captured by runner | **1180** (`execution_status=completed`) |
| AUTO_APPLY | FAIL (file-node wait) | file present on host; chat showed `create e2e-auto.html` |
| Generated file | not observed by runner | `/opt/aisandbox/workspaces/<sessionId>/e2e-auto.html` (191 bytes) with exact frozen HTML |
| Preview | NOT REACHED | screenshot: Preview tab active, **Preview unavailable**, no preview running |
| Checkpoint | NOT REACHED by runner | `git_checkpoints` commit `b85c33915aea6af4dd8052dba096d1c996260c92` — `AI: applied workspace file actions` — `files_changed=1` |
| Public confirm | NOT REACHED by runner | gateway log `confirm_build_apply.deduction_triggered` at 20:21:18 with `persistedFileActionCount=1` — HTTP 200 / `triggered=true` / `reason=completed` **not captured** |
| Deduction count | NOT REACHED by runner | **1** (`credit_deduction_records.source_event_id` = executionId; `status=applied`) |
| Credits deducted | NOT REACHED by runner | **1180** (`requested_credits=1180`, `applied_credits=1180`, `overflow_credits=0`) |
| Starting balance | captured by STARTING_BALANCE (in-memory) | deduction `balance_before=29399` |
| Ending balance | NOT REACHED by runner | deduction `balance_after=28219`; `credit_balances.balance=28219` |
| Reconciliation | n/a in runner | **29399 − 1180 = 28219** and **credits deducted = tokens_used** |
| Stripe / payment | n/a in runner | `BILLING_CHARGES_ENABLED=false`; no Stripe charge observed |

```
PROVIDER_CALL_USED=1
CREDITS_DEDUCTED=1180
RUNNER_INVOKED=YES
RETRIES=0
```

---

## Adapter mismatch (proven)

`waitForAutoApply()` waits for `SELECTORS.autoFileNode` = `[data-testid="workspace-file-node-e2e-auto.html"]`.

That test id is rendered only inside `WorkspaceEditorPanel` when `activeTabId === 'codeFiles'`.

`DEFAULT_ACTIVE_TAB_ID = 'preview'`. The LIVE runner does not click Code & Files before the AUTO_APPLY wait. The failure screenshot is on Preview.

The generated file was already on disk at 20:21, ~3 minutes before the 180s locator timeout ended.

This is a **new** LIVE adapter blocker. It is **not** the residual `page.goto()` / `submitBuild()` `selectOption` / `trace: 'off'` surfaces. Do **not** patch it inside LIVE-06.

AUTO-01E held: CREATE_SESSION completed inside `runGoldenPath` (no 600s hang).  
AUTO-01F held: CLEANUP returned `executionGateFinal=restored-false` (not `restore-unconfirmed-timeout`).

---

## Playwright failure artifacts

| Artifact | Path |
|---|---|
| Screenshot | `e2e/builder-golden-path/test-results/live-LIVE-Builder-golden-path-live-only-live/test-failed-1.png` (gitignored) |
| Error context | `e2e/builder-golden-path/test-results/live-LIVE-Builder-golden-path-live-only-live/error-context.md` (gitignored) |
| Last run status | `e2e/builder-golden-path/test-results/.last-run.json` (gitignored) |

Snapshot at timeout: disposable workspace open; chat shows grok-4.5 (xAI) created `e2e-auto.html`; file-action result `create e2e-auto.html`; Build selected; Preview tab active; Preview unavailable.

---

## Cleanup / final gates

Runner `finally` ran. No second LIVE run. No second SSH restore attempt.

- Gate restore: `executionGateFinal=restored-false`
- Gateway PM2 restarts: 246 (pre-run) → **247** (enable ~20:20:38) → **248** (restore ~20:26:29)
- `GLOBAL_EXECUTION_ENABLED` final: **false** (.env + PM2)
- `BILLING_CHARGES_ENABLED` final: **false** (.env + PM2)
- Session final: **stopped** (`terminated_at` null in this row; `container_id` null)
- Container final: docker `sandbox-session-a8bb5a4d-a6bb-487d-a100-bc95330ce7b3` **absent** (match count 0)
- Credential / LIVE process env: cleared (`ENV_CLEARED=YES`)
- DPAPI temp file `$env:TEMP\aisandbox-e2e-live-06-cred.xml`: **absent**
- Staging HEAD after run: still `da56659d39a5d86d3ef994a7458a297169eeda42`
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

LIVE-06 remains **ACTIVE** and unlocked. Step 3 consolidation is required.

Do not retry the provider. Do not rerun LIVE-06. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / AUTO-01F inside this live task. Do not return to manual browser testing. Do not register PRIVATE-BETA-INVITE-01.

Follow-up adapter fix for WAIT_FOR_AUTO_APPLY (Preview-tab vs Code & Files file-tree locator) is **not registered** in Step 2.

**PRIVATE-BETA-E2E-LIVE-06 STEP 2 COMPLETE — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE AT WAIT_FOR_AUTO_APPLY — DO NOT RERUN LIVE-06**
