# BILLING-READY-04D — Regression Matrix Readiness / Validation Plan

**Task ID:** BILLING-READY-04D
**Step:** 2 of 4 (Regression Matrix Readiness / Validation Plan)
**Status:** COMPLETE
**Date:** 2026-07-13
**Nature:** Static planning/review only. No implementation. No tests. No runtime.
**Parent:** BILLING-READY-04 (ACTIVE — Step 3 IN PROGRESS — child-slice split)

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-04D ACTIVE — Step 1 COMPLETE (Registration) | CONFIRMED |
| Parent BILLING-READY-04 ACTIVE — Step 3 IN PROGRESS (child-slice split) | CONFIRMED |
| BILLING-READY-04A COMPLETE and LOCKED (2026-07-13) | CONFIRMED — `CreditBalanceGuard` implemented and wired. 24/24 unit, 68/68 controller, 30/30 integration, 31/31 guard integration, 3/3 public-api tests PASS. TypeScript clean. Checkpoint: `docs/BILLING-READY-04A-CHECKPOINT.md`. |
| BILLING-READY-04B COMPLETE and LOCKED (2026-07-13) | CONFIRMED — Validation-only. 13/13 execution-start integration tests PASS. All 8 Step 2 gaps closed. No production changes. Checkpoint: `docs/BILLING-READY-04B-CHECKPOINT.md`. |
| BILLING-READY-04C COMPLETE and LOCKED (2026-07-13) | CONFIRMED — Worker finalization/accounting bridge implemented. 56/56 usage-ledger, 6/6 internal-accounting, 25/25 api-gateway-http.client, 135/135 worker.processor PASS. TypeScript clean both services. Linter 0 errors. Checkpoint: `docs/BILLING-READY-04C-CHECKPOINT.md`. |
| BILLING-READY-03 COMPLETE and LOCKED (2026-07-07) | CONFIRMED — All 7 child slices (03A–03D3) COMPLETE and LOCKED. All 11 parent close criteria satisfied. Checkpoint: `docs/BILLING-READY-03D3-CHECKPOINT.md`. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED (2026-07-12) | CONFIRMED — All 3 child slices (07F1/07F2/07F3) COMPLETE and LOCKED. Checkpoint: `docs/AGENT-PLATFORM-07F-CHECKPOINT.md`. |
| AGENT-HARNESS-07 COMPLETE and LOCKED (2026-07-07) | CONFIRMED — All 3 child slices (07A/07B/07C) COMPLETE and LOCKED. Checkpoint: `docs/AGENT-HARNESS-07-CHECKPOINT.md`. |
| AGENT-HARNESS-06E COMPLETE and LOCKED (2026-07-09) | CONFIRMED — Full E2E canary PASS. Checkpoint: `docs/AGENT-HARNESS-06E-CHECKPOINT.md`. |
| One-active-task rule satisfied | CONFIRMED — only BILLING-READY-04/04D is ACTIVE. |

**Governance readiness: PASS.**

---

## 2. 04A / 04B / 04C Summary

### 04A — API Gateway Balance Gate Foundation (COMPLETE and LOCKED)

| Deliverable | Detail |
|-------------|--------|
| `CreditBalanceGuard` | `services/api-gateway/src/billing/credit-balance.guard.ts` — checks `balance > 0`, admin bypass via DB role lookup, HTTP 402 on exhaustion/missing. Read-only, non-locking. |
| `CreditBalanceGuardModule` | `services/api-gateway/src/billing/credit-balance-guard.module.ts` — imports `CreditPersistenceModule` + `TypeOrmModule.forFeature([User])`. |
| Guard wiring | `POST /api/ai/execute` and `POST /v1/ai/execute` — after `IdempotencyGuard`, before `QuotaGuard`. |
| Production files | 2 created, 4 modified. |
| Test files | 1 created (`credit-balance.guard.spec.ts` — 24 tests), 2 existing modified. |
| Safety | No migration, no frontend, no Stripe, no AGENT-HARNESS. |

### 04B — Execution-Start Gate Wiring Validation (COMPLETE and LOCKED)

| Deliverable | Detail |
|-------------|--------|
| Nature | Validation-only — zero production changes. |
| Test file | 1 created: `credit-balance-guard-execution-start.integration.spec.ts` — 13 tests. |
| Gaps closed | All 8 gaps identified in Step 2: guard order assertion, real guard exercise, enqueue/no-enqueue, public API parity, no provider calls. |
| Safety | No production source changes, no migration, no frontend, no Stripe, no AGENT-HARNESS. |

### 04C — Worker Finalization / Accounting Bridge (COMPLETE and LOCKED)

| Deliverable | Detail |
|-------------|--------|
| Critical finding | Credit deduction had **never fired** in the async BullMQ flow. Worker wrote `completed` via raw SQL, bypassing `UsageLedgerService` entirely. |
| Finalization bridge | Worker `notifyExecutionComplete` → `POST /api/internal/executions/:id/finalize-accounting` → `UsageLedgerService.triggerDeductionForExecution()`. |
| Production files | 5 modified/created across api-gateway and ai-service. |
| Test files | 4 modified/created. |
| Accounting matrix | Only `completed` deducts. Failed/cancelled/timeout/abort: no deduction. Zero-token/stub: deduction fires but applies 0 credits. Cancel-after-completion race: cancel wins, no deduction. |
| Idempotency | `sourceEventId = executionId`. No new guardrails needed — 03D1/03D2 protections sufficient. |
| Safety | No migration, no frontend, no Stripe, no AGENT-HARNESS. |

### Remaining Purpose of 04D

04D is the **regression matrix and parent consolidation** slice. Its purpose:

1. Run the full targeted regression command matrix across all 04A/04B/04C affected areas.
2. Confirm no cross-slice regressions.
3. Consolidate and lock parent BILLING-READY-04 if all regressions pass.
4. Record the next recommended roadmap item (not registered).

---

## 3. Regression Scope

The regression scope covers all test suites and typechecks touched or depended upon by 04A, 04B, and 04C:

### API Gateway — Billing Guard Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `credit-balance.guard.spec.ts` | 04A | 24+ (37 at 04B checkpoint — additional assertions added) |
| `credit-balance-guard-execution-start.integration.spec.ts` | 04B | 13 |

### API Gateway — Execution Controller Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `ai-execution.controller.spec.ts` | Pre-04A (modified in 04A) | 68 |
| `ai-execution.controller.integration.spec.ts` | Pre-04A (modified in 04A) | 30 |
| `public-ai.controller.spec.ts` | Pre-04A | 3 |

### API Gateway — Internal Accounting Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `internal-accounting.controller.spec.ts` | 04C | 6 |

### API Gateway — Usage Ledger Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `usage-ledger.service.spec.ts` | Pre-04C (modified in 04C) | 56 |

### AI Service — API Gateway Client Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `api-gateway-http.client.spec.ts` | Pre-04C (modified in 04C) | 25 |

### AI Service — Worker Processor Tests

| Suite | Introduced | Tests |
|-------|-----------|-------|
| `worker.processor.spec.ts` | Pre-04C (modified in 04C) | 135 |

### Service Typechecks

| Service | Check |
|---------|-------|
| API Gateway | `npx tsc --noEmit` |
| AI Service | `npx tsc --noEmit` |

### Whether Any Broader Suite Is Needed

**Decision: No broader suite required.**

Rationale:
1. 04A/04B/04C made no migration changes — no schema drift risk.
2. 04A/04B/04C made no frontend changes — no UI regression risk.
3. 04A/04B/04C made no package changes — no dependency drift risk.
4. 04A/04B/04C made no changes to `PersistentCreditDeductionGateway` internals — the deduction path was wired, not modified.
5. 04C added a new internal controller and wired a new HTTP call path, but all existing internal service patterns are preserved.
6. The targeted suites above cover all files created or modified in 04A/04B/04C.
7. Running the full `npm test` suite for both services is an option but is unnecessary for parent lock — the targeted matrix provides sufficient coverage of the change surface.

If any targeted suite reveals an unexpected failure, broader suite runs may be needed to triage — but this is handled as part of pass/fail criteria (Section 12).

---

## 4. Exact Command Matrix

All commands use full absolute paths with `Set-Location` per CLAUDE.md conventions.

### Block A — API Gateway Billing Guard Regression

```powershell
# A1: CreditBalanceGuard unit tests (04A)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance.guard"

# A2: CreditBalanceGuard execution-start integration tests (04B)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "credit-balance-guard-execution-start.integration"
```

### Block B — API Gateway Execution Controller Regression

```powershell
# B1: AI Execution Controller unit tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "ai-execution.controller.spec"

# B2: AI Execution Controller integration tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "ai-execution.controller.integration"

# B3: Public AI Controller tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "public-ai.controller"
```

### Block C — API Gateway Internal Accounting Regression (04C)

```powershell
# C1: Internal accounting controller tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "internal-accounting"
```

### Block D — API Gateway Usage Ledger Regression (04C)

```powershell
# D1: Usage ledger service tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --runInBand "usage-ledger.service"
```

### Block E — API Gateway TypeScript Typecheck

```powershell
# E1: API Gateway typecheck
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```

### Block F — AI Service Client Regression (04C)

```powershell
# F1: API Gateway HTTP client tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --runInBand "api-gateway-http.client"
```

### Block G — AI Service Worker Regression (04C)

```powershell
# G1: Worker processor tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --runInBand "worker.processor"
```

### Block H — AI Service TypeScript Typecheck

```powershell
# H1: AI Service typecheck
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsc --noEmit
```

### Command Matrix Summary

| ID | Service | Command | Expected Tests | Source Slice |
|----|---------|---------|---------------|-------------|
| A1 | api-gateway | `npx jest --runInBand "credit-balance.guard"` | 37 | 04A |
| A2 | api-gateway | `npx jest --runInBand "credit-balance-guard-execution-start.integration"` | 13 | 04B |
| B1 | api-gateway | `npx jest --runInBand "ai-execution.controller.spec"` | 68 | 04A (modified) |
| B2 | api-gateway | `npx jest --runInBand "ai-execution.controller.integration"` | 30 | 04A (modified) |
| B3 | api-gateway | `npx jest --runInBand "public-ai.controller"` | 3 | 04A (wired) |
| C1 | api-gateway | `npx jest --runInBand "internal-accounting"` | 6 | 04C |
| D1 | api-gateway | `npx jest --runInBand "usage-ledger.service"` | 56 | 04C (modified) |
| E1 | api-gateway | `npx tsc --noEmit` | — (exit 0) | 04A/04C |
| F1 | ai-service | `npx jest --runInBand "api-gateway-http.client"` | 25 | 04C (modified) |
| G1 | ai-service | `npx jest --runInBand "worker.processor"` | 135 | 04C (modified) |
| H1 | ai-service | `npx tsc --noEmit` | — (exit 0) | 04C |

**Total: 11 commands. 10 targeted jest suites + 2 typechecks across 2 services.**

---

## 5. Runtime Validation Decision

### Docker / PostgreSQL / Redis

**Decision: NOT REQUIRED for Step 3.**

Rationale:
1. All 04A/04B/04C test suites use mocked repositories, mocked services, and mock execution contexts. No test requires a live database connection.
2. The live PostgreSQL integration tests from BILLING-READY-03D2 (concurrency/idempotency validation) are guarded by `RUN_CREDIT_DB_INTEGRATION=true` and are skipped by default. These were validated at 03D2 and remain locked.
3. 04C's finalization bridge (`notifyExecutionComplete`) uses `ApiGatewayHttpClient` which is fully mocked in worker tests. No live HTTP call is required.
4. The `InternalAccountingController` tests mock `UsageLedgerService` — no live database needed.

### Live API Gateway / AI Service / Worker

**Decision: NOT REQUIRED for Step 3.**

Rationale:
1. All affected behavior is covered by mocked unit and integration tests.
2. Live runtime validation (starting Docker + PostgreSQL + Redis + both services + BullMQ worker) would prove the end-to-end deduction flow fires in production — but this is a separate, higher-risk validation that should not block parent lock.
3. If live runtime validation is desired, it must be handled as a **separate explicitly approved runtime step** under a dedicated task (e.g., BILLING-READY-05 or a future runtime validation slice) and must not happen in Step 3 without Keith guidance.

### BullMQ Live Job

**Decision: NOT REQUIRED for Step 3.**

Same rationale as above — BullMQ worker behavior is tested via mocked job processing. Live BullMQ job validation is a runtime concern.

### DB Mutation

**Decision: NOT REQUIRED for Step 3.**

No database mutation of any kind. All tests use mocked repositories. No live `credit_balances`, `credit_deduction_records`, or `usage_records` rows are created, modified, or queried.

### Sufficiency of Current Coverage for Parent Lock

**Decision: SUFFICIENT.**

The mocked unit/integration test coverage across 04A/04B/04C proves:
1. Guard correctly blocks at execution-start boundary (04A unit + 04B integration).
2. Guard is wired at the correct position in both controllers (04B metadata reflection).
3. Enqueue is prevented on 402 rejection (04B integration).
4. Worker calls `notifyExecutionComplete` only for `completed` status (04C worker tests).
5. Failed/cancelled/timeout/abort paths do NOT trigger deduction (04C worker tests).
6. `InternalAccountingController` correctly routes to `triggerDeductionForExecution` (04C controller tests).
7. `triggerDeductionForExecution` correctly reads record and calls `emitDeductionAttempt` (04C usage-ledger tests).
8. `ApiGatewayHttpClient.notifyExecutionComplete` uses correct endpoint and suppresses errors (04C client tests).
9. TypeScript compiles clean in both services.

The remaining risk (live runtime proof) is acceptable for parent lock because the deduction gateway itself was validated live in BILLING-READY-03D2 with real PostgreSQL.

### Runtime Validation Recommendation

If runtime validation is recommended in the future, it must:
- Be registered as a separate task.
- Require Docker + PostgreSQL + Redis + both services running.
- Use `stub` provider (zero tokens, zero cost).
- Verify `credit_deduction_records` row is created after a completed execution.
- Verify balance is deducted correctly.
- Require Keith explicit approval.
- NOT happen in BILLING-READY-04D Step 3 without explicit approval.

---

## 6. Browser / UI Smoke Decision

### Browser Smoke

**Decision: NOT NEEDED.**

Rationale:
1. 04A/04B/04C made zero frontend changes.
2. No new user-facing UI text was added.
3. No new i18n keys were added.
4. The HTTP 402 response from `CreditBalanceGuard` is handled by the frontend's existing generic error path.
5. No CSS, layout, routing, or component changes.

### Frontend / i18n

**Decision: NOT NEEDED for Step 3.**

Rationale:
1. No frontend files were created or modified in 04A/04B/04C.
2. No i18n keys (`frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json`) were added.
3. The 04 parent readiness review (Section 16) identified potential future i18n keys (`billing.creditBalanceExhausted`, `billing.creditBalanceNotProvisioned`) — but these were explicitly deferred. The original 04 plan proposed frontend error handling in "04C" — but the actual 04C addressed the critical accounting bridge gap instead. Frontend billing UX is deferred to a future task.

### User-Facing UX Text

**Decision: No new user-facing UX text was added in 04A/04B/04C.**

The only new user-facing content is the HTTP 402 JSON error body, which is API-level (not rendered UI). Dedicated frontend error display with translated copy is a future task.

### Multilingual File Update Requirement

**Decision: NOT required in Step 3 or Step 4.**

When a future task adds user-facing billing error display, the following files must be updated per CLAUDE.md multilingual-first rule:
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
- `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`

---

## 7. Stripe / Payment / Provider Boundary

| Constraint | Status |
|------------|--------|
| No Stripe API calls required in Step 3 | **CONFIRMED** |
| No Stripe SDK imported in any 04A/04B/04C file | **CONFIRMED** |
| No payment provider module referenced in guard, controller, or worker changes | **CONFIRMED** |
| `StripePaymentProvider` remains 100% stub | **CONFIRMED** — no real API calls, no SDK, no API keys, no webhooks |
| Stripe/payment provider integration remains out of scope for BILLING-READY-04 | **CONFIRMED** — deferred to BILLING-READY-05+ or later |
| Validation must prove or record no provider calls | **CONFIRMED** — all test suites use mocked services; no payment module imported; architectural review in 04A/04B/04C readiness docs confirms zero provider references |

---

## 8. AGENT-HARNESS Boundary

| Constraint | Status |
|------------|--------|
| AGENT-HARNESS write canary remains separate | **CONFIRMED** |
| 04D does not enable write tools | **CONFIRMED** — `enableWriteTools` is controlled by builder profile config, not by billing enforcement |
| 04D does not change harness config | **CONFIRMED** — no harness config files touched in 04A/04B/04C/04D |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains absent/false | **CONFIRMED** — not set in any `.env` file |
| Any AGENT-HARNESS runtime/write validation remains a separate task | **CONFIRMED** — AGENT-HARNESS write canary is a separate track, not registered, not part of BILLING-READY-04 |
| Worker processor changes (04C) preserve harness behavior | **CONFIRMED** — 04C's `notifyExecutionComplete` is placed after harness metadata preservation; harness checkpoint hash and all orchestration fields are preserved as-is |

---

## 9. Parent Consolidation Readiness (Step 4 Requirements)

### Required Artifacts for Step 4

| # | Artifact | Action |
|---|----------|--------|
| 1 | `docs/BILLING-READY-04D-CHECKPOINT.md` | CREATE — records Step 3 regression results, pass/fail status, and consolidation |
| 2 | `docs/BILLING-READY-04-CHECKPOINT.md` | CREATE — parent close checkpoint recording all 4 child slices complete and all parent close criteria satisfied |
| 3 | BILLING-READY-04D in `TASKS.md` | MARK COMPLETE and LOCKED |
| 4 | BILLING-READY-04D in `TASKS_BACKLOG_FULL.md` | MARK COMPLETE and LOCKED (mirror) |
| 5 | Parent BILLING-READY-04 in `TASKS.md` | MARK COMPLETE and LOCKED — only if Step 3 regression matrix passes |
| 6 | Parent BILLING-READY-04 in `TASKS_BACKLOG_FULL.md` | MARK COMPLETE and LOCKED (mirror) |
| 7 | `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATE — 04D and parent 04 COMPLETE and LOCKED |

### Parent Close Criteria for BILLING-READY-04

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | BILLING-READY-04A COMPLETE and LOCKED | `docs/BILLING-READY-04A-CHECKPOINT.md` |
| 2 | BILLING-READY-04B COMPLETE and LOCKED | `docs/BILLING-READY-04B-CHECKPOINT.md` |
| 3 | BILLING-READY-04C COMPLETE and LOCKED | `docs/BILLING-READY-04C-CHECKPOINT.md` |
| 4 | BILLING-READY-04D COMPLETE and LOCKED | `docs/BILLING-READY-04D-CHECKPOINT.md` (Step 4) |
| 5 | All 11 targeted regression commands PASS | Step 3 report |
| 6 | No unresolved regressions | Step 3 triage |
| 7 | No source/test changes in Step 3 (validation-only) | Step 3 confirmation |
| 8 | TypeScript clean in both services | E1 + H1 |
| 9 | No Stripe/payment/provider calls | Confirmed in Section 7 |
| 10 | No AGENT-HARNESS write canary involvement | Confirmed in Section 8 |
| 11 | No migration | Confirmed in 04A/04B/04C checkpoints |
| 12 | No frontend changes | Confirmed in Section 6 |

### Next Recommended Roadmap Item

**To be recorded in Step 4 — NOT REGISTERED.**

Candidates (for Keith decision):
- **Frontend billing error UX** — Display HTTP 402 balance-exhausted/not-provisioned errors with i18n support. Would require `frontend/messages/{en,zh-TW,zh-CN}.json` updates.
- **Live runtime validation** — Full Docker + PostgreSQL + Redis + BullMQ runtime proof of end-to-end deduction.
- **BILLING-READY-05** — Stripe/payment provider integration, subscription lifecycle, or credit top-up.
- **Auto-provisioning** — Create `credit_balances` row on first execution for users without provisioned balance.
- **Entitlement gating** — Model/tool/agent access enforcement based on plan type.

The choice among these is Keith's decision. 04D must NOT register any of them.

---

## 10. Step 3 Implementation / Validation Decision

**Decision: A — Step 3 is validation-only.**

Rationale:
1. All implementation was completed in 04A, 04B, and 04C.
2. 04D exists solely to run the targeted regression command matrix and produce a validation report.
3. No source files, test files, governance files, or production code need modification.
4. No new tests need to be written — all required test coverage was delivered by 04A/04B/04C.
5. The only artifact produced by Step 3 is the regression validation report document.

Step 3 will:
- Run all 11 commands from the exact command matrix (Section 4).
- Record exact pass/fail results for each command.
- Triage any failures (pre-existing unrelated vs. regression).
- Create `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md` with full results.

Step 3 will NOT:
- Modify any source files.
- Modify any test files.
- Create new tests.
- Run Docker/PostgreSQL/Redis/live services.
- Call Stripe/payment/provider APIs.
- Start browser smoke.
- Touch AGENT-HARNESS.
- Modify governance files (governance updates happen in Step 4).

---

## 11. Exact Step 3 File Boundary

### Files Created in Step 3

| # | File | Type | Description |
|---|------|------|-------------|
| 1 | `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md` | Doc | Regression validation report with all 11 command results, pass/fail, triage notes |

### Files Modified in Step 3

None. Zero source, test, governance, or configuration files modified.

### Files NOT Changed

- No `services/**/*.ts` production or test files
- No `frontend/**` files
- No `database/**` files
- No `.env*` files
- No `docker*` files
- No `package*.json` files
- No migration files
- No `TASKS.md` (governance updates in Step 4 only)
- No `TASKS_BACKLOG_FULL.md` (governance updates in Step 4 only)
- No `docs/AINOW-EXECUTION-ROADMAP.md` (governance updates in Step 4 only)

### Justification

Validation-only. The regression matrix runs existing tests against existing code. No code changes are needed because all implementation was completed in 04A/04B/04C and individually validated at checkpoint time. 04D confirms no cross-slice regressions exist.

---

## 12. Pass / Fail Criteria

### Mandatory Pass Criteria

| # | Criterion | Required |
|---|-----------|----------|
| 1 | All 11 commands from Section 4 must execute successfully | YES |
| 2 | All jest suites must report 0 failures, 0 errors | YES |
| 3 | Both `npx tsc --noEmit` commands must exit with code 0 | YES |
| 4 | Test counts must match or exceed expected counts from child-slice checkpoints | YES |
| 5 | No new test failures compared to individual child-slice checkpoint results | YES |

### Pre-Existing Unrelated Failure Handling

| # | Criterion | Required |
|---|-----------|----------|
| 6 | Any pre-existing unrelated failure must be identified and documented | YES |
| 7 | Pre-existing failures must be triaged: is it a real regression from 04A/04B/04C, or was it already failing before? | YES |
| 8 | If a failure is confirmed as a regression from 04A/04B/04C, it must be resolved before parent lock | YES |
| 9 | If a failure is confirmed as pre-existing/unrelated, it must be documented but does not block parent lock | YES |

### Safety Criteria

| # | Criterion | Required |
|---|-----------|----------|
| 10 | No provider/runtime calls during validation | YES |
| 11 | No DB mutation during validation | YES |
| 12 | No source changes during Step 3 | YES — if source changes are needed, Step 3 must pause and reassess |
| 13 | Parent BILLING-READY-04 cannot lock if any required regression fails | YES |

---

## 13. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | **False confidence from mocked tests** — all 04A/04B/04C tests use mocked repositories, so they prove logic but not live database behavior | MEDIUM | Accepted. Live DB behavior was validated in 03D2 (PostgreSQL integration). The deduction gateway itself is unchanged. Live runtime validation is a separate future task. |
| R2 | **Missing live runtime proof** — no test proves the full end-to-end path: HTTP request → guard allows → BullMQ enqueue → worker completes → `notifyExecutionComplete` → API Gateway `finalize-accounting` → `emitDeductionAttempt` → `PersistentCreditDeductionGateway.applyDeduction()` → `credit_deduction_records` row created → `credit_balances.balance` decremented | MEDIUM | Accepted for parent lock. Each link in the chain is tested individually. Live E2E proof should be a dedicated runtime validation task. |
| R3 | **Worker/accounting bridge regression risk** — 04C modified `worker.processor.ts` to add `notifyExecutionComplete`. If the placement or error handling is wrong, completed executions may fail to trigger deduction, or errors may propagate and fail the BullMQ job. | MEDIUM | 04C tests (135/135 PASS) cover: notify called for completed, NOT called for failed/cancelled/timeout, error suppressed, zero-token/stub handled. Regression matrix (G1) re-validates. |
| R4 | **API Gateway / AI Service contract mismatch risk** — 04C introduced `POST /api/internal/executions/:id/finalize-accounting` on the API Gateway and `notifyExecutionComplete` on the AI Service client. If the route or payload shape diverges, the bridge fails silently (error suppressed by design). | LOW | Both sides were implemented and tested in the same slice (04C). Route path and `X-Internal-Service-Key` header are consistent with existing internal endpoint patterns. TypeScript typechecks catch shape mismatches. |
| R5 | **Double deduction risk** — two `notifyExecutionComplete` calls for the same `executionId` could create two `credit_deduction_records` rows and deduct balance twice. | LOW | `sourceEventId = executionId` idempotency in `PersistentCreditDeductionGateway` prevents this. Pre-transaction check + 23505 unique constraint fallback. Validated in 03D2 with concurrent stress tests. |
| R6 | **Under deduction risk** — `notifyExecutionComplete` call fails (network error, API Gateway down), and error is suppressed. Execution is `completed` but no deduction record exists. | MEDIUM | Accepted by design (same suppression behavior as existing `emitDeductionAttempt()`). The execution is still `completed` in `usage_records`. A future reconciliation or retry mechanism could close this gap, but it is not in scope for BILLING-READY-04. |
| R7 | **Failed/cancelled accounting regression risk** — a code change accidentally routes a failed or cancelled execution through the deduction trigger path. | LOW | 04C worker tests explicitly assert: failed does NOT call `notifyExecutionComplete`, cancelled (all paths) does NOT call it, timeout does NOT call it, AbortError does NOT call it. Regression matrix (G1) re-validates. |
| R8 | **Zero-token/stub accounting regression risk** — stub executions produce `tokens_used = 0`. Deduction should fire but apply 0 credits with balance unchanged. | LOW | 04C worker tests explicitly assert: zero-token completed execution calls `notifyExecutionComplete`. `emitDeductionAttempt` with `unitCount = 0` → `creditsRequested = 0` → `appliedCredits = 0`. No balance change. Audit record created. |
| R9 | **Provider/payment boundary risk** — any 04A/04B/04C code accidentally imports or calls a Stripe/payment module. | NEGLIGIBLE | Architectural review in all three readiness docs confirms zero Stripe/payment references. No `StripePaymentProvider`, no payment module imported. TypeScript typechecks would surface any unexpected import. |
| R10 | **Parent lock risk** — locking BILLING-READY-04 prematurely without sufficient evidence of correctness. | MEDIUM | Mitigated by: (a) 11-command regression matrix covering all affected suites; (b) each child slice individually validated at checkpoint; (c) explicit pass/fail criteria; (d) any failure blocks parent lock. |

---

## 14. Step 3 Readiness Conclusion

| Criterion | Result |
|-----------|--------|
| Governance readiness | PASS |
| 04A/04B/04C summary complete | PASS |
| Regression scope decided | PASS — targeted, not broad |
| Exact command matrix defined | PASS — 11 commands, full paths |
| Runtime validation decision | PASS — NOT REQUIRED; deferred to separate task |
| Browser/UI smoke decision | PASS — NOT NEEDED; no frontend changes |
| Stripe/payment/provider boundary | PASS — no calls required or permitted |
| AGENT-HARNESS boundary | PASS — write canary remains separate |
| Parent consolidation readiness | PASS — exact Step 4 requirements defined |
| Step 3 implementation/validation decision | PASS — **A: validation-only** |
| Exact Step 3 file boundary | PASS — 1 doc file created, 0 source/test files changed |
| Pass/fail criteria defined | PASS — 13 criteria |
| Risks/blockers identified | PASS — 10 risks with mitigations |
| Further split required? | **NO** — one bounded Step 3 (run commands, create report) |

### Final Decision

**BILLING-READY-04D is READY for Step 3 — validation-only regression matrix execution.**

### Recommended Model for Step 3

**GPT-5.3 Codex** — bounded validation-only step. Run 11 commands, record results, create report. No implementation complexity.

### Exact Next Prompt Type

Step 3 implementation/validation prompt:
- Run the 11 commands from the exact command matrix (Section 4).
- Record pass/fail results for each.
- Create `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md`.
- Do NOT modify source/test/governance files.
- If all pass, proceed to Step 4 consolidation in a new window.
- If any fail, triage and report before proceeding.

---

## Files Inspected (Read-Only, Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status — partial read (file exceeds 100K chars) |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance status — partial read (file exceeds 100K chars) |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence, task status, completed foundation |
| 4 | `docs/BILLING-READY-04A-CHECKPOINT.md` | 04A completion record |
| 5 | `docs/BILLING-READY-04A-IMPLEMENTATION-READINESS-REVIEW.md` | 04A source-path review and decisions |
| 6 | `docs/BILLING-READY-04B-CHECKPOINT.md` | 04B completion record |
| 7 | `docs/BILLING-READY-04B-EXECUTION-START-WIRING-READINESS.md` | 04B gap review and decisions |
| 8 | `docs/BILLING-READY-04C-CHECKPOINT.md` | 04C completion record |
| 9 | `docs/BILLING-READY-04C-WORKER-FINALIZATION-ACCOUNTING-READINESS.md` | 04C source-path review, critical finding, decisions |
| 10 | `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | Parent 04 readiness/source-path review |
| 11 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | BILLING-READY-03 parent close record |
| 12 | `services/api-gateway/src/billing/__tests__/*.spec.ts` | Billing test file inventory (5 files) |
| 13 | `services/api-gateway/src/ai/__tests__/*.spec.ts` | AI test file inventory (12 files) |
| 14 | `services/api-gateway/src/usage-ledger/__tests__/*.spec.ts` | Usage-ledger test file inventory (3 files) |

---

## Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | File created: `docs/BILLING-READY-04D-REGRESSION-MATRIX-READINESS.md` | CONFIRMED |
| 2 | Files inspected (14 sources + governance docs, read-only) | CONFIRMED |
| 3 | Governance readiness: PASS | CONFIRMED |
| 4 | 04A/04B/04C summary complete | CONFIRMED |
| 5 | Regression scope decided: targeted (11 commands) | CONFIRMED |
| 6 | Exact command matrix defined with full absolute paths | CONFIRMED |
| 7 | Runtime validation decision: NOT REQUIRED, deferred | CONFIRMED |
| 8 | Browser/UI smoke decision: NOT NEEDED | CONFIRMED |
| 9 | Stripe/payment/provider boundary: no calls required | CONFIRMED |
| 10 | AGENT-HARNESS boundary: write canary separate | CONFIRMED |
| 11 | Parent consolidation readiness: exact Step 4 requirements defined | CONFIRMED |
| 12 | Step 3 decision: A — validation-only | CONFIRMED |
| 13 | Exact Step 3 file boundary: 1 doc file created, 0 source/test files | CONFIRMED |
| 14 | Pass/fail criteria: 13 criteria defined | CONFIRMED |
| 15 | Risks/blockers: 10 risks identified with mitigations | CONFIRMED |
| 16 | No source/governance/env files changed except this readiness doc | CONFIRMED |
| 17 | No tests/builds/runtime/provider calls executed | CONFIRMED |
| 18 | BILLING-READY-04D is ready for Step 3 | CONFIRMED |
