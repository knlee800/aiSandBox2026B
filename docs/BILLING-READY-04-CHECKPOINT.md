# BILLING-READY-04 — Parent Checkpoint

**Task ID:** BILLING-READY-04
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-13
**Scope:** Balance Enforcement / Entitlement Gating / Billing Foundation Phase 2

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-04 |
| Family | BILLING READY / BALANCE ENFORCEMENT / ENTITLEMENT GATING / PHASE 2 |
| Risk | HIGH — 4-step loop |
| Registered | 2026-07-12 |
| Completed | 2026-07-13 |
| Keith approval | Keith approved BILLING-READY-04 registration 2026-07-12 |

---

## 2. Parent Scope

**Balance Enforcement / Entitlement Gating / Billing Foundation Phase 2**

BILLING-READY-04 is the second major billing implementation phase, building on the credit balance persistence foundation established in BILLING-READY-03. This phase implemented balance enforcement at the execution-start boundary (API Gateway guard), validation of the guard wiring and enqueue/no-enqueue behavior, worker-side finalization accounting bridge connecting BullMQ job completion to credit deduction, and full regression matrix validation across all three enforcement surfaces.

---

## 3. Workflow Steps

| Step | Description | Status |
|------|-------------|--------|
| 1 | Registration | COMPLETE (2026-07-12) |
| 2 | Billing enforcement readiness / source-path review | COMPLETE (2026-07-12) — `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` — Split decision: 4 child slices (04A/04B/04C/04D) |
| 3 | Bounded implementation — child-slice split | COMPLETE (2026-07-13) — all 4 child slices COMPLETE and LOCKED |
| 4 | Consolidation / checkpoint | COMPLETE (2026-07-13) — this file |

---

## 4. Child Slices

| Slice | Name | Status |
|-------|------|--------|
| BILLING-READY-04A | API Gateway Balance Gate Foundation | **COMPLETE and LOCKED — 2026-07-13** |
| BILLING-READY-04B | Execution-Start Gate Wiring | **COMPLETE and LOCKED — 2026-07-13** |
| BILLING-READY-04C | Worker Finalization / Accounting Guardrails | **COMPLETE and LOCKED — 2026-07-13** |
| BILLING-READY-04D | Regression Matrix + Parent Consolidation | **COMPLETE and LOCKED — 2026-07-13** |

---

## 5. Child Slice Summaries

### 04A — API Gateway Balance Gate Foundation (COMPLETE and LOCKED — 2026-07-13)

**Checkpoint:** `docs/BILLING-READY-04A-CHECKPOINT.md`

| Deliverable | Detail |
|-------------|--------|
| `CreditBalanceGuard` | `services/api-gateway/src/billing/credit-balance.guard.ts` — enforces `balance > 0`, admin bypass via DB role lookup, HTTP 402 on exhaustion/missing. Read-only, non-locking. |
| `CreditBalanceGuardModule` | `services/api-gateway/src/billing/credit-balance-guard.module.ts` — imports `CreditPersistenceModule` + `TypeOrmModule.forFeature([User])`. |
| Guard wiring | `POST /api/ai/execute` and `POST /v1/ai/execute` — after `IdempotencyGuard`, before `QuotaGuard`. |
| Production files | 2 created, 4 modified. |
| Test files | 1 created (`credit-balance.guard.spec.ts` — 24 tests), 2 existing modified. |
| Validation | 24/24 unit tests PASS; 68/68 controller tests PASS; 30/30 integration tests PASS; 31/31 guard integration tests PASS; 3/3 public-api tests PASS; TypeScript clean. |
| Safety | No migration, no frontend, no Stripe, no AGENT-HARNESS. |

### 04B — Execution-Start Gate Wiring Validation (COMPLETE and LOCKED — 2026-07-13)

**Checkpoint:** `docs/BILLING-READY-04B-CHECKPOINT.md`

| Deliverable | Detail |
|-------------|--------|
| Nature | Validation-only — zero production changes. |
| Test file | 1 created: `credit-balance-guard-execution-start.integration.spec.ts` — 13 tests. |
| Guard order proved | `IdempotencyGuard → CreditBalanceGuard → QuotaGuard` in both main and public controllers. |
| Enqueue/no-enqueue proved | Sufficient/admin balance queues; missing/zero/negative balance blocks before enqueue. |
| Public API parity | `POST /v1/ai/execute` protected at same position as `POST /api/ai/execute`. |
| No provider calls | Confirmed — no Stripe/payment/provider module imported or called. |
| Gaps closed | All 8 gaps identified in Step 2 closed by integration tests. |
| Safety | No production source changes, no migration, no frontend, no Stripe, no AGENT-HARNESS. |

### 04C — Worker Finalization / Accounting Bridge (COMPLETE and LOCKED — 2026-07-13)

**Checkpoint:** `docs/BILLING-READY-04C-CHECKPOINT.md`

| Deliverable | Detail |
|-------------|--------|
| Critical finding | Credit deduction had **never fired** in the async BullMQ flow. Worker wrote `completed` via raw SQL, bypassing `UsageLedgerService` entirely. |
| Finalization bridge | Worker `notifyExecutionComplete` → `POST /api/internal/executions/:executionId/finalize-accounting` → `UsageLedgerService.triggerDeductionForExecution()`. |
| `triggerDeductionForExecution` | New method on `UsageLedgerService` — reads execution record, routes to existing `emitDeductionAttempt` path only for `completed` status. |
| `InternalAccountingController` | New NestJS controller at `POST /api/internal/executions/:executionId/finalize-accounting` — guarded by `InternalServiceAuthGuard`, routes to `triggerDeductionForExecution`. |
| `notifyExecutionComplete` | New method on `ApiGatewayHttpClient` in ai-service — posts to accounting endpoint, suppresses errors, does not fail the BullMQ job. |
| Worker success path | `worker.processor.ts` calls `notifyExecutionComplete` only after post-completion cancel check, only for `completed` status. |
| Accounting matrix | Only `completed` deducts. Failed/cancelled/timeout/cancel_requested/abort: no deduction. Zero-token/stub completed: deduction fires but applies 0 credits. Cancel-after-completion race: cancel wins, no deduction. |
| Idempotency | `sourceEventId = executionId` — existing 03D1/03D2 protections sufficient. |
| Production files | 5 modified/created across api-gateway and ai-service. |
| Test files | 4 modified/created. |
| Validation | 56/56 usage-ledger PASS; 6/6 internal-accounting PASS; 25/25 api-gateway-http.client PASS; 135/135 worker.processor PASS; TypeScript clean in both services; linter 0 errors. |
| Safety | No migration, no frontend, no Stripe, no AGENT-HARNESS. |

### 04D — Regression Matrix + Parent Consolidation (COMPLETE and LOCKED — 2026-07-13)

**Checkpoint:** `docs/BILLING-READY-04D-CHECKPOINT.md`

| Deliverable | Detail |
|-------------|--------|
| Nature | Validation-only — no implementation in 04D. |
| Readiness doc | `docs/BILLING-READY-04D-REGRESSION-MATRIX-READINESS.md` — targeted regression matrix, no runtime/browser/provider required. |
| Validation report | `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md` — PASS. |
| Regression matrix | 12 commands PASS — all 04A/04B/04C test suites + both service typechecks. |
| Parent lock readiness | All 12 parent close criteria satisfied. |

---

## 6. Regression Matrix PASS

| ID | Suite | Result | Tests |
|----|-------|--------|-------|
| A1 | credit-balance.guard | **PASS** | 37/37 |
| A2 | credit-balance-guard-execution-start.integration | **PASS** | 13/13 |
| B1 | ai-execution.controller.spec | **PASS** | 38/38 |
| B2 | ai-execution.controller.integration | **PASS** | 30/30 |
| B3 | public-ai.controller | **PASS** | 3/3 |
| C1 | internal-accounting | **PASS** | 6/6 |
| D1 | usage-ledger.service | **PASS** | 56/56 |
| E1 | api-gateway tsc --noEmit | **PASS** | exit 0 |
| F1 | api-gateway-http.client | **PASS** | 25/25 |
| G1 | worker.processor | **PASS** | 135/135 |
| H1 | ai-service tsc --noEmit | **PASS** | exit 0 |
| X1 | ai-execution-guards.integration | **PASS** | 31/31 |

**All 12 commands PASS. Zero failures. Zero errors.**

---

## 7. Parent Close Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | BILLING-READY-04A COMPLETE and LOCKED | **CONFIRMED** — `docs/BILLING-READY-04A-CHECKPOINT.md` |
| 2 | BILLING-READY-04B COMPLETE and LOCKED | **CONFIRMED** — `docs/BILLING-READY-04B-CHECKPOINT.md` |
| 3 | BILLING-READY-04C COMPLETE and LOCKED | **CONFIRMED** — `docs/BILLING-READY-04C-CHECKPOINT.md` |
| 4 | BILLING-READY-04D COMPLETE and LOCKED | **CONFIRMED** — `docs/BILLING-READY-04D-CHECKPOINT.md` |
| 5 | All 12 targeted regression commands PASS | **CONFIRMED** — `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md` |
| 6 | No unresolved regressions | **CONFIRMED** — zero failures in regression matrix |
| 7 | No source/test changes in Step 3 (validation-only) | **CONFIRMED** |
| 8 | TypeScript clean in both services | **CONFIRMED** — E1 + H1 both exit 0 |
| 9 | No Stripe/payment/provider calls | **CONFIRMED** |
| 10 | No AGENT-HARNESS write canary involvement | **CONFIRMED** — remains separate track |
| 11 | No migration | **CONFIRMED** — all schema existed before 04A |
| 12 | No frontend changes | **CONFIRMED** — zero frontend/i18n files touched |

---

## 8. Locked Invariants

After BILLING-READY-04 is COMPLETE and LOCKED, the following invariants are established and must not be altered without an explicitly registered task:

| Invariant | Description |
|-----------|-------------|
| Execution-start balance gate ACTIVE | `CreditBalanceGuard` enforces `balance > 0` at `POST /api/ai/execute` and `POST /v1/ai/execute`. |
| Guard position LOCKED | `IdempotencyGuard → CreditBalanceGuard → QuotaGuard` order in both main and public AI execution controllers. |
| Worker completion accounting bridge ACTIVE | `worker.processor.ts` calls `notifyExecutionComplete` → `/api/internal/executions/:id/finalize-accounting` → `triggerDeductionForExecution` for `completed` executions only. |
| Failed/cancelled/timeout paths do NOT deduct | Accounting bridge is never called for non-completed execution paths. |
| Zero-token/stub completed executions produce 0-credit audit path | `emitDeductionAttempt` fires with 0 credits — no balance impact, audit record created. |
| Idempotency via `sourceEventId = executionId` | Existing 03D1/03D2 double-deduction protection applies. |
| No Stripe/payment/provider calls | No provider module imported or called in any 04A/04B/04C file. |
| No migration | All schema (`credit_balances`, `credit_deduction_records`) established in BILLING-READY-03B. |
| No frontend/i18n changes | No user-facing UI text added. Frontend billing UX is deferred. |
| No AGENT-HARNESS write canary | Remains a separate track — not registered, not part of BILLING-READY-04. |

---

## 9. Deferred Items

| Item | Status |
|------|--------|
| Stripe/payment provider integration | Deferred — out of scope for BILLING-READY-04. |
| Subscription lifecycle / credit top-up | Deferred. |
| Frontend billing error UX | Deferred — `HTTP 402` JSON body is API-level only; user-facing display with i18n requires a future frontend billing UX task. |
| Live runtime validation | Deferred — mocked unit/integration coverage sufficient for parent lock. Live E2E proof (Docker + PostgreSQL + Redis + BullMQ + both services) should be a dedicated runtime validation task. |
| Browser/UI smoke | Deferred — no frontend changes in 04A/04B/04C/04D. |
| AGENT-HARNESS write canary | Remains separate — not registered. |
| Auto-provisioning of credit balances | Deferred — users without a provisioned balance row will be blocked by the guard. Auto-provision is a future task. |
| Entitlement gating beyond balance gate | Deferred — model/tool/agent access enforcement by plan type is a future task. |

---

## 10. Next Recommended Roadmap Item

**Recorded — NOT REGISTERED. Requires Keith approval before registration.**

The next natural candidate after BILLING-READY-04 is:

**BILLING-READY-05 — Stripe / Payment Provider Integration, Subscription Lifecycle, and Credit Top-Up**

This would include:
- Real Stripe API integration (webhooks, subscription events, credit grant on payment)
- Subscription lifecycle management (plan changes, cancellations, renewals)
- Credit top-up flows
- Auto-provisioning of `credit_balances` row on first user provisioning event

Alternative or preceding candidates:
- **Frontend billing error UX** — Display HTTP 402 balance-exhausted/not-provisioned errors with i18n support. Would require `frontend/messages/{en,zh-TW,zh-CN}.json` updates per CLAUDE.md multilingual-first rule.
- **Live runtime validation** — Full Docker + PostgreSQL + Redis + BullMQ runtime proof of end-to-end deduction (separate from BILLING-READY-04D which was test-only).
- **Auto-provisioning** — Create `credit_balances` row on first execution for users without provisioned balance.

The choice among these is Keith's decision. BILLING-READY-04 does not register any of them.

---

## 11. Related Documents

| Document | Purpose |
|----------|---------|
| `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | Parent 04 source-path review and split decision |
| `docs/BILLING-READY-04A-CHECKPOINT.md` | 04A completion record — CreditBalanceGuard foundation |
| `docs/BILLING-READY-04B-CHECKPOINT.md` | 04B completion record — execution-start wiring validation |
| `docs/BILLING-READY-04C-CHECKPOINT.md` | 04C completion record — worker finalization bridge |
| `docs/BILLING-READY-04D-REGRESSION-MATRIX-READINESS.md` | 04D Step 2 — targeted regression matrix plan |
| `docs/BILLING-READY-04D-REGRESSION-VALIDATION-REPORT.md` | 04D Step 3 — regression validation results (PASS) |
| `docs/BILLING-READY-04D-CHECKPOINT.md` | 04D completion record — regression matrix PASS, parent consolidation |
| `docs/BILLING-READY-03D3-CHECKPOINT.md` | BILLING-READY-03 parent close record (predecessor) |

---

## 12. AGENT-HARNESS Boundary

| Constraint | Status |
|-----------|--------|
| AGENT-HARNESS write canary remains separate | CONFIRMED |
| No write tool enablement in any 04A/04B/04C/04D slice | CONFIRMED |
| No harness config changes | CONFIRMED |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains absent/false | CONFIRMED |
| Worker processor changes (04C) preserve harness behavior | CONFIRMED — G1 builder-config tests PASS |

---

## 13. Predecessor Foundation

| Task | Status |
|------|--------|
| BILLING-READY-03 | COMPLETE and LOCKED (2026-07-07) — Credit Balance Persistence Foundation |
| BILLING-READY-03D3 | COMPLETE and LOCKED (2026-07-07) — Overflow semantics finalized; entitlement enforcement deferred to 04+ |
| AGENT-PLATFORM-07F | COMPLETE and LOCKED (2026-07-12) — Live Runtime Orchestration Integration Canary |
| AGENT-HARNESS-07 | COMPLETE and LOCKED (2026-07-07) — Per-Builder Harness Config Adapter |
| AGENT-HARNESS-06E | COMPLETE and LOCKED (2026-07-09) — Full E2E Worker + API Gateway + Container-Manager Read-Only Canary |

---

## 14. Status Summary

**BILLING-READY-04: COMPLETE and LOCKED — 2026-07-13**

All 4 steps complete:
1. Registration — COMPLETE (2026-07-12)
2. Billing enforcement readiness / source-path review — COMPLETE (2026-07-12)
3. Bounded implementation (child-slice split) — COMPLETE (2026-07-13) — all 4 child slices COMPLETE and LOCKED
4. Consolidation / checkpoint — COMPLETE (2026-07-13)

All child slices: 04A COMPLETE and LOCKED, 04B COMPLETE and LOCKED, 04C COMPLETE and LOCKED, 04D COMPLETE and LOCKED.
Regression matrix: PASS — 12/12 commands, zero failures, zero errors.
No Stripe/payment/provider. No migration. No frontend. No AGENT-HARNESS write canary.
AGENT-HARNESS write canary remains a separate track — not registered.
