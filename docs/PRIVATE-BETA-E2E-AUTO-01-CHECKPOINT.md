# PRIVATE-BETA-E2E-AUTO-01 — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01  
**Title:** Automated Builder Golden-Path Validation  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-20  
**Checkpoint Date:** 2026-08-20  
**Lifecycle:** 3-step NORMAL  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Nature:** GOVERNANCE / CONSOLIDATION ONLY — no implementation, package, staging, provider, credit, env, Docker, or Git mutation in Step 3

```
AUTOMATED_BUILDER_GOLDEN_PATH_RUNNER_READY=YES
IMPLEMENTED_AND_CONTRACT_VALIDATED=YES
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=PROHIBITED
```

Step 2 implementation commit (runner + `@playwright/test` only): `7b42fef1a312e655329946f04f94bd5f0bdfc6ab`

Do not treat this checkpoint as a scheduler. Do not freeze a staging deployment SHA here.

---

## 1. Purpose

Replace the long manual Builder E2E operator procedure with one deterministic automated Playwright golden-path runner that Claude/Cursor can execute quickly and repeatedly.

AUTO-01 built and contract-validated that runner. It did **not** consume a live provider call, mutate staging, or mutate credits.

---

## 2. Lifecycle

1. Registration + Minimal Automation Contract — COMPLETE — 2026-08-20 — Keith approved Playwright + PACKAGE reservation
2. Implement Real Automated Golden-Path Runner + Non-Live Validation — COMPLETE — 2026-08-20
3. Consolidation + Automation-Ready Verdict — COMPLETE — 2026-08-20 — this checkpoint

Lane 1 only. Lane 2 EMPTY throughout. Lane 3 DISABLED.

---

## 3. Playwright approval and package

Keith explicitly approved adding Playwright for Step 2.

- Package: `@playwright/test@1.62.1` (`^1.62.1` in root `package.json`)
- Scope: root `devDependency` only
- Lockfile: root `package-lock.json` (npm, lockfileVersion 3)
- Not added to `frontend/package.json` or `services/*/package.json`
- Chromium local tooling installation succeeded (not committed)
- Production frontend/backend source: **not modified**

One-command invocations:

- CONTRACT/DRY: `npm run e2e:builder:contract`
- LIVE (fail-closed unless fully authorized): `npm run e2e:builder:live`

---

## 4. Implementation surface

`C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\`

Runner modes:

- CONTRACT/DRY = default
- LIVE = fail-closed

Credentials are environment variables only. No committed secrets or cookies. Fresh browser context every run. No dependency on Keith's Chrome session.

---

## 5. Frozen critical phase order

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

AUTO_APPLY is the supported golden path. There is **no** manual Apply phase. Preview occurs immediately after AUTO_APPLY and before slow evidence work. No artificial keepalive. Provider retry is prohibited.

---

## 6. Implemented live-capable checks

Preserved in the runner (contract-validated; **not** staging-proven):

- fresh browser context / navigation
- environment-based authentication
- one-call provider-budget guard
- session timing / headroom guard
- AUTO_APPLY file detection
- immediate preview assertion
- public confirm-build-apply network observation
- automatic checkpoint evidence
- exactly-one deduction evidence
- 1:1 tokens/credits expectation
- authoritative balance arithmetic
- deterministic billing-page verification
- finally-style session cleanup
- execution-gate restoration only when changed by the runner
- concise PASS evidence
- targeted FAIL diagnostics

LIVE requires **all** of:

- `E2E_MODE=live`
- `E2E_LIVE_AUTHORIZED=true`
- `E2E_ALLOW_STAGING_MUTATION=true`
- `E2E_ALLOW_CREDIT_MUTATION=true`
- `PROVIDER_CALL_BUDGET=1`

---

## 7. Non-live validation (Step 2)

| Check | Result |
|---|---|
| `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json` | PASS |
| `npm run e2e:builder:contract` | **21 passed** — ~3.7s — PASS |
| Local Chromium | PASS — launch, fresh context, navigation, network observation helper, deterministic preview assertion |
| `npm run e2e:builder:live` without LIVE authorization | PASS — fail-closed `LiveAuthorizationError`; no browser / staging / provider / credit execution |

Step 2 did **not**: SSH to staging, log in to staging, create a staging project/session, enable `GLOBAL_EXECUTION_ENABLED`, call xAI, deduct credits, execute staging confirm-build-apply, or modify production frontend/backend source.

---

## 8. Remaining live boundary

`LIVE_STAGING_VALIDATED=NO`

The first controlled LIVE automated run must still prove actual staging compatibility of:

- current UI selectors
- login behavior
- preview interaction
- public confirm listener
- checkpoint evidence API
- deduction evidence helper
- balance verification helper
- staging gate / parity orchestration

Small selector/timeout adaptation may be needed if staging UI differs from implemented assumptions. That is **not** a defect of AUTO-01. Do not freeze an obsolete staging deployment SHA in this checkpoint. The future live-run lifecycle must determine the authoritative staging deployment / parity expectation at that time.

---

## 9. Product readiness

AUTO-01 PASS means the automated Builder golden-path **runner** is ready.

It does **not** mean Builder private beta is GO.

- `AUTOMATED_BUILDER_GOLDEN_PATH_RUNNER_READY=YES`
- `BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E`
- `PRIVATE-BETA-INVITE-01` remains UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED

---

## 10. Next recommended lifecycle (NOT REGISTERED / NOT ADMITTED)

First controlled LIVE execution of the AUTO-01 Playwright golden-path runner.

Keep that future lifecycle short. Use a 3-step controlled workflow:

1. Register / freeze current staging parity + one-call authorization
2. Run the automated E2E
3. Consolidate the verdict

Do not return to the old manual evidence marathon. Human/browser intervention only if the automated runner reports an actual blocker that cannot be diagnosed automatically. Do not assume the next task identifier.

---

## 11. Step 3 consolidation writes

- `docs/PRIVATE-BETA-E2E-AUTO-01-CHECKPOINT.md` — this document
- `TASKS.md` CURRENT EXECUTION BOARD only — AUTO-01 released; PACKAGE released
- `TASKS_BACKLOG_FULL.md` — AUTO-01 final status / current recommendation only

No implementation changes in Step 3.
