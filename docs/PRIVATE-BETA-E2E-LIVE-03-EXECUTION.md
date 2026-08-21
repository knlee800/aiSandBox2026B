# PRIVATE-BETA-E2E-LIVE-03 — Step 2 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-03  
**Step:** 2 — Authorized compare-then-deploy + automated LIVE Builder E2E  
**Date:** 2026-08-21  
**Primary classification:** AUTOMATION_ADAPTER_FAILURE  
**Phase:** STARTING_BALANCE  
**Step 2 state:** LANE-DONE — FAIL/BLOCKED  
**Runner invoked:** YES (`npm run e2e:builder:live` once)

Do not treat this document as a scheduler. LIVE-03 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B from this step.

---

## Verdict

Authorized current-HEAD staging deployment succeeded. Post-deploy exact parity, service health, authentication, and SAFETY (AUTO-01B labelled-sentinel `inspectParity`) **PASSED**.

Playwright LIVE started, authenticated, passed SAFETY, enabled then restored the execution gate, then fail-closed at STARTING_BALANCE before session create / BUILD / provider.

Failure class: **B. AUTOMATION_ADAPTER_FAILURE**

THIS WAS NOT A PRODUCT FAILURE.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY_FAILURE of the deployed tree.

Exact adapter mismatch: `runSafetyChecks()` calls `enableExecutionGate()` (`pm2 restart aisandbox-api-gateway --update-env`) and immediately proceeds to `captureStartingBalance()` `GET /api/billing/balance`. There is no post-restart gateway-ready wait. The balance call returned HTTP 502 while the gateway was restarting. Gateway `restarts` increased 240 → 242 (enable + restore). After restore, gateway health is HTTP 200 and `GLOBAL_EXECUTION_ENABLED=false`.

Authenticated Home UI was visible. No session was created. Provider budget unused.

Do not repair AUTO-01 / AUTO-01A / AUTO-01B inside LIVE-03. Zero provider retries. Do not rerun LIVE.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `16c0bf863d40c6890d6fa9951b38efe7aa987a77` |
| STAGING_HEAD_BEFORE | `1f6f83ec80892e6d105323cae91c0d302a7d5866` |
| STAGING_HEAD_AFTER | `16c0bf863d40c6890d6fa9951b38efe7aa987a77` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| Rebuild / restart | SKIPPED — `frontend/` and `services/` unchanged vs pre-deploy HEAD |
| Local tree at capture | CLEAN / `main` |
| Staging tree after deploy | CLEAN |
| stash@{0} before | `0372cc1f47f82e1db060ed2dd756a938fe324803` (`pre-03F-deployment-snapshot`) |
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
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` | false (.env + PM2) |
| SSH executor | operational |
| AUTO-01B `inspectParity` | PASS (SAFETY reached STARTING_BALANCE) |

---

## LIVE run

- Command: `npm run e2e:builder:live` — once
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1`
- Credentials: transient DPAPI `PSCredential` import; temp file deleted immediately; process env cleared after runner; never printed/committed
- Human browser intervention: **NO**
- Playwright duration: ~5.6s then fail-closed

Runner summary:

```
verdict=FAIL
phase=STARTING_BALANCE
error=Authoritative balance API HTTP 502
projectId=null
sessionId=null
executionId=null
cleanup=session-stop-not-attempted
executionGateFinal=restored-false
```

Phases reached: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → CLEANUP  
Phases **NOT REACHED:** ARM_LISTENERS / CREATE_SESSION / BUILD / WAIT_FOR_AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE

AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE: **NOT REACHED**

---

## Provider / accounting / golden-path

| Fact | Result |
|---|---|
| Provider / model authorized | xAI / grok-4.5 |
| Provider-call budget | 1 |
| Provider calls used | **0** |
| Retries used | **0** |
| tokens_used | n/a |
| AUTO_APPLY | NOT REACHED |
| Preview | NOT REACHED |
| Checkpoint | NOT REACHED |
| Public confirm | NOT REACHED |
| Deduction count | **0** |
| Credits deducted | **0** |
| Balance before / after | n/a (STARTING_BALANCE 502) |
| Stripe / payment | **NO** |
| projectId / sessionId / executionId | n/a |
| Disposable session / container created | **NO** |

```
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
RUNNER_INVOKED=YES
RETRIES=0
```

---

## Cleanup / final gates

- Disposable session/container: none created
- Runner cleanup: `session-stop-not-attempted` (no session)
- Gate enable: attempted by runner during SAFETY; restored in CLEANUP
- Gateway PM2 restarts: 240 → 242 (enable + restore)
- `GLOBAL_EXECUTION_ENABLED` final: **false** (.env + PM2)
- `BILLING_CHARGES_ENABLED` final: **false**
- Credential / LIVE process env: cleared
- DPAPI temp file: deleted

```
GLOBAL_EXECUTION_ENABLED_FINAL=false
BILLING_CHARGES_ENABLED_FINAL=false
```

---

## Step 3 note

LIVE-03 remains unlocked. Step 3 consolidation is required.

Do not retry the provider. Do not modify AUTO-01 / AUTO-01A / AUTO-01B inside this live task. Do not return to manual browser testing.

Follow-up adapter fix (post-`pm2 restart` gateway-ready wait before STARTING_BALANCE) is **not registered** in Step 2.
