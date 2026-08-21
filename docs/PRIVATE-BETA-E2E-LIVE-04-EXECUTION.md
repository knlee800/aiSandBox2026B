# PRIVATE-BETA-E2E-LIVE-04 — Step 2 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-04  
**Step:** 2 — Authorized compare-then-deploy + automated LIVE Builder E2E (fixed AUTO-01C runner)  
**Date:** 2026-08-21  
**Primary classification:** AUTOMATION_ADAPTER_FAILURE  
**Phase:** CREATE_SESSION  
**Step 2 state:** COMPLETE — FAIL/BLOCKED — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` once)

Do not treat this document as a scheduler. LIVE-04 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C from this step. This is not a LIVE-03 retry.

---

## Verdict

Authorized current-HEAD staging deployment succeeded. Post-deploy exact parity, service health, authentication, SAFETY (AUTO-01B labelled-sentinel `inspectParity`), and AUTO-01C post-gate gateway-ready wait **PASSED**. STARTING_BALANCE **PASSED** (the LIVE-03 HTTP 502 did not recur).

Playwright LIVE started, authenticated, passed SAFETY, enabled the execution gate, waited for gateway ready, captured starting balance, armed listeners, created a disposable project/session/container, then hung in CREATE_SESSION until the Playwright **test timeout of 600000ms**. BUILD was never submitted. Provider was not called.

Playwright aborted the test from outside `runGoldenPath`, so the runner `finally` cleanup did **not** run. Operator cleanup used the existing restore/stop commands afterward.

Failure class: **B. AUTOMATION_ADAPTER_FAILURE**

THIS WAS NOT A PRODUCT FAILURE of session create.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY_FAILURE of the deployed tree.  
THIS WAS NOT a LIVE-03 retry, and LIVE-03 is not converted to PASS.

Exact adapter mismatch: `createSession()` registers `page.waitForResponse` for `POST /api/sessions` only after the project-create response is parsed, then clicks the project card. Staging logs show the session was created and started at **13:33:15** (`Internal route access granted: /api/internal/sessions/<id>/start`; CM `Session started`). The adapter then waited the remaining ~10 minutes until Playwright timeout. The workspace UI was already open with an empty prompt (Build selected, Send disabled). No second session POST occurred.

Do not repair AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C inside LIVE-04. Zero provider retries. Do not rerun LIVE.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `5bd22736c2ad717b18cde74616326d015c8be7ff` |
| STAGING_HEAD_BEFORE | `16c0bf863d40c6890d6fa9951b38efe7aa987a77` |
| STAGING_HEAD_AFTER | `5bd22736c2ad717b18cde74616326d015c8be7ff` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| Rebuild / restart | SKIPPED — `frontend/` and `services/` unchanged vs pre-deploy HEAD |
| AUTO-01C on staging | **YES** (`waitForGatewayReady` / `GatewayNotReadyError` present) |
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
| AUTO-01C ready-wait | PASS (STARTING_BALANCE succeeded after gate-enable `pm2 restart`) |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once**
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1`
- Credentials: transient DPAPI `PSCredential` import; temp file deleted immediately; process env cleared after runner; never printed/committed
- Human browser intervention: **NO**
- Playwright duration: **10.0m** then test timeout (`timeout: 10 * 60 * 1000` in `playwright.live.config.ts`)
- Runner formatted summary: **not printed** (timeout aborted before `console.log(result.formatted)`)

Reconstructed runner outcome:

```
verdict=FAIL
phase=CREATE_SESSION
error=Test timeout of 600000ms exceeded.
projectId=818f9baa-98b2-40e9-bbf6-15b60824b989
sessionId=d0e12d9f-8110-4cf3-b153-2e87de2bb721
executionId=null
cleanup=runner-finally-skipped-playwright-timeout; operator existing restore+session-stop afterward
executionGateFinal=restored-false (operator; runner finally did not run)
```

Phases reached: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION  
Phases **NOT REACHED:** BUILD / WAIT_FOR_AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE / runner CLEANUP

AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE: **NOT REACHED**

---

## Provider / accounting / golden-path

| Fact | Result |
|---|---|
| Provider / model authorized | xAI / grok-4.5 |
| Provider-call budget | 1 |
| Provider calls used | **0** |
| Retries used | **0** |
| tokens_used | n/a (no `usage_records` for this session) |
| AUTO_APPLY | NOT REACHED |
| Preview | NOT REACHED (workspace showed Preview unavailable / no preview running) |
| Checkpoint | NOT REACHED |
| Public confirm | NOT REACHED |
| Deduction count | **0** |
| Credits deducted | **0** |
| Balance before | captured by runner during STARTING_BALANCE; in-memory value lost on Playwright timeout |
| Balance after (DB, no deduction this session) | **29399** |
| Reconciliation | n/a (no deduction) |
| Stripe / payment | **NO** |
| projectId | `818f9baa-98b2-40e9-bbf6-15b60824b989` (`E2E-AUTO-Disposable-2026-08-21T05-33-13-043Z`) |
| sessionId | `d0e12d9f-8110-4cf3-b153-2e87de2bb721` |
| executionId | n/a |

```
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
RUNNER_INVOKED=YES
RETRIES=0
```

---

## Cleanup / final gates

Playwright test timeout skipped `runGoldenPath` `finally`. Post-timeout operator cleanup used existing commands only (no runner/product patch):

- Gate restore: `GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env`
- Gateway ready after restore: HTTP 200
- Session stop: `POST http://127.0.0.1:4002/api/sessions/d0e12d9f-8110-4cf3-b153-2e87de2bb721/stop` → HTTP 201 `{ "message": "Session stopped successfully" }`
- Session final: **stopped**
- Container final: docker `sandbox-session-d0e12d9f-8110-4cf3-b153-2e87de2bb721` removed
- Gateway PM2 restarts: 242 (LIVE-03 final) → **243** (this run enable) → **244** (this restore)
- `GLOBAL_EXECUTION_ENABLED` final: **false** (.env + PM2)
- `BILLING_CHARGES_ENABLED` final: **false**
- Credential / LIVE process env: cleared
- DPAPI temp file: deleted

```
GLOBAL_EXECUTION_ENABLED_FINAL=false
BILLING_CHARGES_ENABLED_FINAL=false
```

---

## AUTO-01C LIVE observation (not a LIVE-03 conversion)

LIVE-03 failed at STARTING_BALANCE (HTTP 502, no post-gate ready-wait). LIVE-04 using the AUTO-01C runner **passed STARTING_BALANCE** after gate-enable `pm2 restart` and created a disposable project/session. That specific LIVE-03 adapter gap did **not** recur.

LIVE-04 still **FAIL/BLOCKED** at CREATE_SESSION. Do not convert LIVE-03 to PASS. Do not claim LIVE staging golden-path validation.

---

## Step 3 note

LIVE-04 remains **ACTIVE** and unlocked. Step 3 consolidation is required.

Do not retry the provider. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C inside this live task. Do not return to manual browser testing. Do not register PRIVATE-BETA-INVITE-01.

Follow-up adapter fix (CREATE_SESSION `waitForResponse` race / unbounded wait vs already-completed `POST /api/sessions`) is **not registered** in Step 2.
