# PRIVATE-BETA-E2E-LIVE-05 — Step 2 Execution Evidence

**Task ID:** PRIVATE-BETA-E2E-LIVE-05  
**Step:** 2 — Authorized compare-then-deploy + automated LIVE Builder E2E (fixed AUTO-01D runner)  
**Date:** 2026-08-21  
**Primary classification:** AUTOMATION_ADAPTER_FAILURE  
**Phase:** CREATE_SESSION  
**Step 2 state:** LANE-DONE — FAIL/BLOCKED — Step 3 PENDING  
**Runner invoked:** YES (`npm run e2e:builder:live` once)

Do not treat this document as a scheduler. LIVE-05 is not locked. Do not store credentials here. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D from this step. This is not a LIVE-04 rerun. Do not rerun LIVE-05.

---

## Verdict

Authorized current-HEAD staging deployment / parity succeeded. Post-deploy exact parity, service health, authentication, SAFETY (AUTO-01B labelled-sentinel `inspectParity`), AUTO-01C post-gate gateway-ready wait, and STARTING_BALANCE **PASSED**.

Playwright LIVE started, authenticated, passed SAFETY, enabled the execution gate, waited for gateway ready, captured starting balance, armed listeners, created a disposable project/session/container on the server, then hung in **CREATE_SESSION** until the Playwright **test timeout of 600000ms**. BUILD was never submitted. Provider was not called.

Playwright aborted the test from outside `runGoldenPath`, so the runner `finally` cleanup did **not** run. Step 2 recovery cleanup used the existing restore/stop commands afterward.

Failure class: **AUTOMATION_ADAPTER_FAILURE**

THIS WAS NOT A PRODUCT FAILURE of session create.  
THIS WAS NOT A PROVIDER FAILURE.  
THIS WAS NOT AN ENVIRONMENT/PARITY_FAILURE of the deployed tree.  
THIS WAS NOT a LIVE-04 rerun, and LIVE-04 is not converted to PASS.

Exact adapter mismatch: `createSession()` never returned before the outer Playwright timeout although the server-side project/session/container were created successfully. Playwright failure snapshot shows the workspace already open with Build selected, empty prompt, Send disabled, and Preview unavailable — the same terminal UI signature as locked LIVE-04. No `usage_records` exist for the disposable session. AUTO-01D CONTRACT 56 did not prevent the LIVE staging hang.

Do not repair AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D inside LIVE-05. Zero provider retries. Do not rerun LIVE-05.

---

## Deployment

| Field | Value |
|---|---|
| AUTHORIZED_LOCAL_HEAD | `3ee27663a97acdc0dbc75678007bcaa60ee0f7b9` |
| STAGING_HEAD_BEFORE | `5bd22736c2ad717b18cde74616326d015c8be7ff` (last locked LIVE-04 staging HEAD) |
| STAGING_HEAD_AFTER | `3ee27663a97acdc0dbc75678007bcaa60ee0f7b9` |
| `STAGING_HEAD == AUTHORIZED_LOCAL_HEAD` | **PASS** |
| Deploy method | `git fetch origin main` + `git reset --hard <AUTHORIZED_LOCAL_HEAD>` |
| Rebuild / restart | SKIPPED — `frontend/` and `services/` unchanged vs pre-deploy HEAD |
| AUTO-01D on staging | **YES** (`armSessionCreateListener` present in `network.ts` / `live-adapters.ts`) |
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
| AUTO-01B `inspectParity` | PASS (SAFETY reached STARTING_BALANCE) |
| AUTO-01C ready-wait | PASS (STARTING_BALANCE succeeded after gate-enable `pm2 restart`) |
| `GLOBAL_EXECUTION_ENABLED` before runner | false (.env + PM2) |
| `BILLING_CHARGES_ENABLED` | false (.env + PM2) |
| SSH executor | operational |

---

## LIVE run

- Command: `npm run e2e:builder:live` — **once**
- Flags: `E2E_MODE=live`, `E2E_LIVE_AUTHORIZED=true`, `E2E_ALLOW_STAGING_MUTATION=true`, `E2E_ALLOW_CREDIT_MUTATION=true`, `PROVIDER_CALL_BUDGET=1`
- Credentials: transient DPAPI `PSCredential` import; temp file deleted; process env cleared after runner (`ENV_CLEARED=YES`); never printed/committed
- Human browser intervention: **NO**
- Playwright duration: **10.0m** then test timeout (`timeout: 10 * 60 * 1000` in `playwright.live.config.ts`)
- Runner formatted summary: **not printed** (timeout aborted before `console.log(result.formatted)`)
- NPM exit: **1**

Reconstructed runner outcome:

```
verdict=FAIL
phase=CREATE_SESSION
error=Test timeout of 600000ms exceeded.
projectId=3802c452-852a-4b2d-87d7-f48007cac887
sessionId=d9c0cffd-3a87-432a-bf9c-078e647ac075
executionId=null
cleanup=runner-finally-skipped-playwright-timeout; operator existing restore+session-stop afterward
executionGateFinal=restored-false (operator; runner finally did not run)
```

Phases reached: PREPARE_BROWSER → AUTH → SAFETY → STARTING_BALANCE → ARM_LISTENERS → CREATE_SESSION  
Phases **NOT REACHED:** BUILD / WAIT_FOR_AUTO_APPLY / PREVIEW / CHECKPOINT / PUBLIC_CONFIRM / DEDUCTION / BALANCE / runner CLEANUP

Last successfully completed phase: **ARM_LISTENERS**

CREATE_SESSION server result: **product create succeeded** (project/session/container exist); **automation result FAIL** (`createSession()` never returned before outer timeout)

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
| projectId | `3802c452-852a-4b2d-87d7-f48007cac887` (`E2E-AUTO-Disposable-2026-08-21T08-49-52-397Z`) |
| sessionId | `d9c0cffd-3a87-432a-bf9c-078e647ac075` |
| executionId | n/a |

```
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
RUNNER_INVOKED=YES
RETRIES=0
```

---

## Playwright failure artifacts

| Artifact | Path |
|---|---|
| Screenshot | `e2e/builder-golden-path/test-results/live-LIVE-Builder-golden-path-live-only-live/test-failed-1.png` |
| Error context | `e2e/builder-golden-path/test-results/live-LIVE-Builder-golden-path-live-only-live/error-context.md` |
| Last run status | `e2e/builder-golden-path/test-results/.last-run.json` |

Snapshot at timeout: disposable project workspace open; Build selected; empty prompt; Send disabled; Preview unavailable; no chat/build messages.

---

## Cleanup / final gates

Playwright test timeout skipped `runGoldenPath` `finally`. Post-timeout Step 2 recovery cleanup used existing commands only (no runner/product patch):

- Gate restore: `GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env`
- Gateway ready after restore: HTTP 200
- Session stop: `POST http://127.0.0.1:4002/api/sessions/d9c0cffd-3a87-432a-bf9c-078e647ac075/stop` → HTTP 201
- Session final: **stopped**
- Container final: docker `sandbox-session-d9c0cffd-3a87-432a-bf9c-078e647ac075` **removed**
- Gateway PM2 restarts: 244 (LIVE-04 final) → **245** (this run enable) → **246** (restore)
- `GLOBAL_EXECUTION_ENABLED` final: **false** (.env + PM2)
- `BILLING_CHARGES_ENABLED` final: **false**
- Credential / LIVE process env: cleared (`ENV_CLEARED=YES`)
- DPAPI temp file: absent

```
GLOBAL_EXECUTION_ENABLED_FINAL=false
BILLING_CHARGES_ENABLED_FINAL=false
```

---

## AUTO-01D LIVE observation (not a LIVE-04 conversion)

AUTO-01D locked PASS (CONTRACT 56) resolved the CREATE_SESSION response-observation race in CONTRACT mode. LIVE-05 using the AUTO-01D-inclusive runner still **FAIL/BLOCKED** at CREATE_SESSION on staging with zero provider usage. Do not convert LIVE-04 to PASS. Do not claim LIVE staging golden-path validation. Do not rerun LIVE-04.

---

## Step 3 note

LIVE-05 remains **ACTIVE** and unlocked. Step 3 consolidation is required.

Do not retry the provider. Do not rerun LIVE-05. Do not modify AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D inside this live task. Do not return to manual browser testing. Do not register PRIVATE-BETA-INVITE-01.

Follow-up adapter fix for the remaining LIVE CREATE_SESSION hang is **not registered** in Step 2.
