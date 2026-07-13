# BILLING-READY-04 — Enforcement Readiness / Source-Path Review

**Task ID:** BILLING-READY-04
**Step:** 2 of 4 (Source-Path Review)
**Status:** COMPLETE
**Date:** 2026-07-12
**Nature:** Static readiness/source-path review only. No implementation. No tests. No runtime.

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-04 ACTIVE | CONFIRMED — Step 1 COMPLETE (Registration 2026-07-12) |
| BILLING-READY-03 COMPLETE and LOCKED | CONFIRMED — All 7 child slices (03A-03D3) COMPLETE and LOCKED (2026-07-07) |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | CONFIRMED — All 3 child slices (07F1/07F2/07F3) COMPLETE and LOCKED (2026-07-12) |
| AGENT-PLATFORM-07F1/07F2/07F3 COMPLETE and LOCKED | CONFIRMED |
| AGENT-PLATFORM-07E/07D/07C family COMPLETE and LOCKED | CONFIRMED |
| AGENT-HARNESS-07/06E COMPLETE and LOCKED | CONFIRMED |
| One-active-task rule satisfied | CONFIRMED — only BILLING-READY-04 is ACTIVE |

**Governance readiness: PASS.**

---

## 2. BILLING-READY-03 Foundation Summary

### Completed

| Slice | Deliverable |
|-------|-------------|
| 03A | Schema/persistence design (governance doc) |
| 03B | `CreditBalance` entity, `CreditDeductionRecord` entity, TypeORM migration `1772100000000`, `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `CreditPersistenceModule` |
| 03C1 | `PersistentCreditDeductionGateway` (async, transactional, idempotent), not yet runtime-bound |
| 03C2 | Runtime binding swapped — `CreditDeductionModule` provides `PersistentCreditDeductionGateway`; `UsageLedgerService.emitDeductionAttempt()` awaits gateway; failure suppression preserved |
| 03D1 | Full `DataSource.transaction()` wrapping; `SELECT FOR UPDATE` balance lock; atomic record+balance write; 23505 race fallback |
| 03D2 | Live PostgreSQL integration validation: concurrency, idempotency, non-negative balance |
| 03D3 | Overflow semantics finalized (non-blocking deductions, `appliedCredits` capped, `creditsOverflow` tracked, `balanceAfter >= 0`) |

### Source Files / Tables / Contracts

| Type | Location |
|------|----------|
| Entity: `CreditBalance` | `services/api-gateway/src/entities/credit-balance.entity.ts` |
| Entity: `CreditDeductionRecord` | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` |
| Table: `credit_balances` | Columns: id, owner_id, owner_type, plan_id, balance, monthly_allocation, rollover_balance, status, period_start, period_end, reset_at, created_at, updated_at. CHECK: `balance >= 0`, `period_start < period_end`. Unique index: `(owner_id, owner_type)`. |
| Table: `credit_deduction_records` | Columns: id, owner_id, source_event_id, source_event_type, requested_credits, applied_credits, overflow_credits, balance_before, balance_after, line_items (JSONB), metadata (JSONB), status, created_at. Unique index: `source_event_id`. |
| Migration | `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` |
| Repository: `CreditBalanceRepository` | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` |
| Repository: `CreditDeductionRecordRepository` | `services/api-gateway/src/billing/credit-deduction/credit-deduction-record.repository.ts` |
| Module: `CreditPersistenceModule` | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` |
| Module: `CreditDeductionModule` | `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` |
| Gateway: `PersistentCreditDeductionGateway` | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` |
| Service: `CreditCalculationService` | `services/api-gateway/src/billing/credit-deduction/credit-calculation.service.ts` |
| Types: `CreditDeductionEvent`, `CreditDeductionResult` | `services/api-gateway/src/billing/credit-deduction/types.ts` |
| Credit Ledger Foundation | `services/api-gateway/src/credit-ledger/` — types, plan-definitions, credit-rates |

### Deferred to BILLING-READY-04+

- Entitlement enforcement (balance exhaustion does NOT restrict execution in BILLING-READY-03)
- Balance-based execution gating (pre-execution check)
- Stripe/payment provider integration
- Frontend billing UI
- Subscription lifecycle management
- Multi-builder usage attribution enforcement

---

## 3. Current Billing/Balance Source-Path Findings

### Balance/Credit Models

| Item | Source | Notes |
|------|--------|-------|
| `CreditBalance` entity | `services/api-gateway/src/entities/credit-balance.entity.ts` | Per-user; `balance >= 0`; plan_id, monthly_allocation, rollover_balance, period_start/end |
| `credit_balances` table | Migration `1772100000000` | Live in PostgreSQL; validated via 03D2 integration tests |
| Plan definitions | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | free=500, starter=5000, pro=25000, team=100000 monthly credits |
| Plan IDs | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | `'free' | 'starter' | 'pro' | 'team'` |
| Credit rates | `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` | model_tokens=1/1K, tool_call=2/call, workspace_runtime=1/min, etc. |

### Entitlement Models

| Item | Source | Notes |
|------|--------|-------|
| `UserEntitlement` | `services/api-gateway/src/credit-ledger/types/user-entitlement.ts` | Combines agent, tool, knowledge, collaboration access |
| `AgentAccessEntitlement` | Same file | `builder_only`, `builder_plus_one_future_specialist`, `all_current_and_future` |
| `ToolAccessEntitlement` | Same file | `core`, `standard`, `all` |
| `IncludedEntitlement` per plan | `plan-definitions.config.ts` | Each plan maps to agent/tool/knowledge/collaboration entitlements |

### Usage Ledger

| Item | Source | Notes |
|------|--------|-------|
| `UsageRecord` entity | `services/api-gateway/src/entities/usage-record.entity.ts` | execution_id (PK), user_id, provider, model, tokens_used, execution_status, metadata (JSONB) |
| `usage_records` table | `database/init/002_usage_records.sql` | Statuses: pending, running, completed, failed, timeout, cancel_requested, cancelled |
| `UsageLedgerService` | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Two-phase write: `writeExecutionIntent()` → `updateExecutionResult()` |
| Deduction wiring | `UsageLedgerService.emitDeductionAttempt()` | Called AFTER `updateExecutionResult()` succeeds; failure suppressed |

### Payment/Stripe/Provider Integration

| Item | Source | Notes |
|------|--------|-------|
| `PaymentProvider` interface | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Stub-only. `prepareInvoice()`, `validateConfiguration()`, `getProviderName()` |
| `StripePaymentProvider` | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | **100% stub** — returns placeholders, no Stripe SDK, no API calls, no secrets required |
| `stripe_customer_id` | `services/api-gateway/src/entities/user.entity.ts` | Column exists, nullable; currently unused |
| `subscriptions` table | `database/schema.sql` | Exists in schema; `stripe_subscription_id`, `plan_type`, `status`, `current_period_start/end` |
| `invoices` table | `database/schema.sql` + migration `1738900000000` | Exists; `stripe_invoice_id`, `amount_usd`, `status` |

**Finding: Stripe/payment is purely structural stub. No real API integration exists.**

### Test/Stub/Beta/Internal User Handling

| Item | Source | Notes |
|------|--------|-------|
| User roles | `user.entity.ts` | `enum UserRole { ADMIN = 'admin', USER = 'user', BETA = 'beta' }` |
| Plan type | `user.entity.ts` | `plan_type` column: `'free'`, `'pro'`, `'enterprise'` (DB schema) |
| `stub` provider | AI adapter system | Returns zero tokens; no provider API call; used for testing/canary |
| Test user | `database/schema.sql`, `database/init/003_add_demo_user.sql` | `test@aisandbox.com`, role=admin, plan=enterprise |
| No explicit beta/internal user bypass | Guards check `apiKeyIdentity` + quota — no plan-type or role-based exemption found |

---

## 4. Execution Entry-Point Review

### Browser/API → API Gateway

| Step | Source Path | Notes |
|------|-------------|-------|
| HTTP entry | `POST /api/ai/execute` | `services/api-gateway/src/ai/ai-execution.controller.ts` line 380 |
| Guards (order) | `SessionOrApiKeyAuthGuard` → `AuthorizationGuard` → `ExecutionSafetyGuard` → `LaunchGuard` → `AbortGuard` → `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard` → `RateLimitGuard` | Line 382 |
| Public API entry | `POST /api/public/ai/execute` | `services/api-gateway/src/public-api/public-ai.controller.ts` |

### API Gateway Execution Creation

| Step | Source Path | Notes |
|------|-------------|-------|
| Execution ID generation | `ai-execution.controller.ts` ~line 514 | `uuidv4()` |
| Ledger intent write | `usageLedgerService.writeExecutionIntent()` | `usage-ledger.service.ts` line 132 |
| Queue enqueue | `queueService.enqueueExecution(jobData)` | `services/api-gateway/src/queue/queue.service.ts` line 39 |
| Return 202 | `{ executionId, status: 'queued' }` | Immediate response |

### Queue Enqueue Path

| Step | Source Path | Notes |
|------|-------------|-------|
| BullMQ queue | `ai-execution` queue name | `queue.service.ts` line 23 |
| Job options | `attempts: 1`, `removeOnComplete: true`, `removeOnFail: false` | No BullMQ-level retries |
| Transport | Redis via `ioredis` | `REDIS_URL` env var |

### AI Service Worker Execution Path

| Step | Source Path | Notes |
|------|-------------|-------|
| Worker pickup | `services/ai-service/src/worker/worker.processor.ts` line 539 | BullMQ Worker on `ai-execution` |
| Claim (pending→running) | Line 550-558 | `UPDATE usage_records SET execution_status = 'running' WHERE ... AND execution_status = 'pending'` |
| Cancel check before start | Line 614-664 | Checks `cancel_requested` before AI call |
| AI execution | Line 890 (plain) or line 878 (harness) | `aiExecutionService.execute()` or `executeAgentHarnessLoop()` |
| In-worker retry | Lines 740-907 | Retries transient errors (timeout/429/503); max 3 attempts |

### Worker Finalization / Usage Recording

| Step | Source Path | Notes |
|------|-------------|-------|
| Post-completion cancel check | Line 915-959 | If `cancel_requested` during execution → set `cancelled` |
| Metadata assembly | Lines 978-1024 | Preserves existing metadata; adds aiExecutionResult + identity fields |
| Ledger finalization | Lines 1030-1038 | `UPDATE usage_records SET execution_status='completed', tokens_used=$2, metadata=$3 WHERE execution_id=$1` |
| Stream completion | Line 1041 | `publishCompletion(executionId)` |

### Cancellation/Failure Paths

| Step | Source Path | Notes |
|------|-------------|-------|
| Client cancel request | `ExecutionResultService.requestCancel()` | `services/api-gateway/src/ai/execution-result.service.ts` line 60 |
| Cancel SQL | `UPDATE usage_records SET execution_status='cancel_requested' WHERE execution_id=$1 AND execution_status='running'` | Validated live in 07F2 canary |
| Worker abort | Line 718-731 | Polls `cancel_requested` every 1s |
| Timeout handling | Lines 679-715 | Sets `execution_status='timeout'` after `EXECUTION_TIMEOUT_MS` |
| Failure handling | Lines 1060+ | AbortError → `cancelled`; other errors → `failed` |

### Stub/Test Execution Paths

| Item | Notes |
|------|-------|
| `stub` provider | Returns immediately with zero tokens; `StubAIAdapter` |
| `test-harness-stub` | `TestToolCapableStubAdapter` — deterministic tool calls, zero tokens |
| Both go through same ledger write → BullMQ → worker → finalization path | No shortcut; full execution lifecycle |

---

## 5. Enforcement Boundary Decision

### Options Evaluated

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | API Gateway only | Single enforcement point; fail-fast before queue; least latency impact | Worker can't verify balance independently; race window between check and deduction |
| B | AI Service Worker only | Enforcement at point of actual resource consumption | Wastes queue slot + worker startup; delayed rejection; poor UX |
| C | Both (dual) | Defense in depth | Complexity; double-check overhead; still needs single source of truth |
| D | **Phased: API Gateway pre-execution gate + Worker post-execution accounting** | Fail-fast rejection at API Gateway; worker handles accurate final accounting | Must tolerate race window for concurrent requests (acceptable with overflow semantics) |

### Recommendation: Option D — Phased Approach

**Balance enforcement gate at API Gateway (pre-execution).** This is where the existing guard chain runs. A new `CreditBalanceGuard` (or equivalent) inserted into the guard chain rejects executions when balance is exhausted.

**Worker finalization continues post-execution accounting** via existing `PersistentCreditDeductionGateway` → `emitDeductionAttempt()` flow. This records actual usage after execution.

**Rationale:**
1. The existing guard chain (`SessionOrApiKeyAuthGuard` → ... → `TokenQuotaGuard`) already enforces pre-execution checks. Adding balance enforcement here is architecturally consistent.
2. The existing deduction pathway (`UsageLedgerService.emitDeductionAttempt()`) already runs post-completion. Accounting remains accurate.
3. The BILLING-READY-03 overflow semantics (non-blocking, `appliedCredits` capped) provide safety for race windows — two concurrent requests that both pass the pre-check will still result in correct accounting with overflow, not data corruption.
4. The worker should NOT independently gate execution based on balance — that would create latency and complexity.

---

## 6. Source-of-Truth Decision

| Concern | Source of Truth | Justification |
|---------|-----------------|---------------|
| **Credit balance** | `credit_balances` table (via `CreditBalanceRepository`) | Single row per user; `SELECT FOR UPDATE` locking; `balance >= 0` CHECK constraint |
| **Entitlement** | `PLAN_DEFINITIONS` static config + `user.plan_type` column | Plan → entitlement mapping is static config; user's plan determines their entitlements |
| **Usage ledger** | `usage_records` table (via `UsageLedgerService`) | Authoritative execution history; tokens_used, execution_status, metadata |
| **Execution usage** | `usage_records` remains authoritative | No change needed; tokens_used + metadata.aiExecutionResult is the billing basis |
| **Deduction history** | `credit_deduction_records` table | Audit trail of all credit deductions with overflow/applied breakdown |

### New Table/Migration Required?

**No new migration required for BILLING-READY-04 core enforcement.**

The existing schema has all needed columns:
- `credit_balances.balance` — checked pre-execution
- `credit_balances.status` — can distinguish active/suspended accounts
- `credit_deduction_records` — records deductions post-execution
- `user.plan_type` — determines entitlement tier
- `user.role` — can distinguish admin/beta/user

If a future slice needs to track enforcement events (e.g., "execution denied due to insufficient balance"), that can use `metadata` JSONB on existing tables or a lightweight audit log — but this is NOT required for core enforcement.

---

## 7. User/Account Category Decision

| Category | Enforcement Behavior |
|----------|---------------------|
| **Normal paid users** (plan_type: starter/pro/team) | Full balance check. Execution blocked if `credit_balances.balance <= 0`. |
| **Free users** (plan_type: free) | Same balance check. Free plan has 500 monthly credits. Execution blocked if exhausted. |
| **Beta users** (role: beta) | Same enforcement as their plan_type. Role=beta does NOT exempt from balance checks. |
| **Admin/internal users** (role: admin) | **Exempt from balance enforcement.** Admin users bypass the balance gate. This is the simplest safe bypass for internal testing. |
| **Stub/test executions** (provider: stub) | **NOT exempt.** Stub executions still consume a balance check but produce `tokens_used=0`. Post-execution deduction calculates `0 × creditsPerUnit = 0` credits, so no balance reduction occurs. Balance gate still runs. |
| **Zero-token executions** | Gate allows (balance > 0). Post-deduction: `appliedCredits=0`, no balance change. |
| **Failed executions** (execution_status: failed) | No credit deduction. `emitDeductionAttempt()` is only called from `updateExecutionResult()` which only runs on success. Failed executions never reach deduction. |
| **Cancelled executions** (execution_status: cancelled) | No credit deduction. Same as failed — worker sets status to `cancelled` without calling `updateExecutionResult()`. |
| **Users without `credit_balances` row** | Balance gate should REJECT (no row = no provisioned balance). This prevents unprovisioned accounts from executing. Alternative: auto-provision row on first execution (deferred decision for implementation slice). |

---

## 8. Billing Provider Boundary Decision

### Recommendation: No Stripe/Payment Provider Calls in BILLING-READY-04

| Option | Included? | Reason |
|--------|-----------|--------|
| No Stripe/payment provider calls | **YES** | Stripe integration is 100% stub; no SDK, no API keys, no webhooks exist |
| Stripe/payment read-only config | NO | No need — plan_type is already on user entity |
| Stripe/payment webhook enforcement | NO | No webhook infrastructure exists |
| Payment provider integration deferred | **YES** | Deferred to BILLING-READY-05+ or later |

**Justification:** The existing `StripePaymentProvider` is explicitly documented as a stub with zero API calls. There is no Stripe SDK dependency, no API key validation, no webhook endpoint. BILLING-READY-04 can enforce balance gating entirely from the `credit_balances` table without any provider involvement.

---

## 9. Balance Enforcement Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| **Insufficient balance before execution starts** | API Gateway `CreditBalanceGuard` rejects with HTTP 402/403. Execution never reaches queue. No ledger intent written. |
| **Balance exhausted during/after execution** | Allowed. Worker completes execution. Post-execution deduction records overflow (`creditsOverflow > 0`). Balance goes to 0 (not negative). Next execution will be blocked by pre-check. |
| **Failed execution** | No deduction. Balance unchanged. |
| **Cancelled execution** | No deduction. Balance unchanged. |
| **Zero-token stub execution** | Gate passes (balance > 0). Deduction calculates `0 × rate = 0` credits. Balance unchanged. |
| **Retry/idempotency** | Idempotency guard runs BEFORE balance guard (existing order: `IdempotencyGuard` → `QuotaGuard` → `TokenQuotaGuard`). Replays short-circuit before balance check. New balance guard should sit between IdempotencyGuard and QuotaGuard. |
| **Concurrent requests** | Two requests may both pass balance check simultaneously. This is acceptable: BILLING-READY-03 overflow semantics handle under-balance deductions safely. Balance goes to 0 with overflow recorded. Next request is then blocked. |

### HTTP Status for Balance Rejection

Recommend **HTTP 402 Payment Required** or **HTTP 403 Forbidden** with a structured error body including `credit_balance_exhausted`, `current_balance`, and `required_credits` (estimated).

---

## 10. Entitlement Gating Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| **Model access** | Deferred. All models currently accessible via `SUPPORTED_AI_PROVIDERS` allow-list. Plan-based model restrictions are a future slice. |
| **Agent/tool access** | Deferred. `AgentAccessEntitlement` and `ToolAccessEntitlement` types exist in credit-ledger but are not enforced at any execution path. |
| **Project/session limits** | Deferred. `usage_quotas` table exists in schema but is not used in the execution guard chain. |
| **Multi-builder orchestration usage** | Orchestration metadata (`agentRole`, `builderProfileId`, `referralTraceId`, etc.) is RECORDED in `usage_records.metadata` but NOT enforced. Multi-builder credit attribution is deferred. |
| **Read-only coordinator canaries** | Not involved. AGENT-HARNESS write canary remains a separate track. |
| **Write tools** | Remain disabled unless `enableWriteTools` is true in builder profile config. This is a harness safety gate, not a billing gate. |

### BILLING-READY-04 Entitlement Scope

For this phase, entitlement enforcement is limited to:
1. **Balance > 0 check** — the primary enforcement gate.
2. **Admin bypass** — role=admin exempted.

Model access, agent access, tool access, and collaboration quotas are deferred to BILLING-READY-05+ or dedicated entitlement slices.

---

## 11. Implementation Boundary Recommendation

### API Gateway (pre-execution gate)

| File | Change Type | Description |
|------|-------------|-------------|
| `services/api-gateway/src/billing/credit-balance.guard.ts` | NEW | `CreditBalanceGuard` — checks `credit_balances.balance > 0` for user; exempts admin role |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | MODIFY | Add `CreditBalanceGuard` to guard chain (after IdempotencyGuard, before QuotaGuard) |
| `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` | MODIFY | Export `CreditBalanceRepository` for guard consumption |
| `services/api-gateway/src/usage-ledger/usage-ledger.module.ts` | MODIFY | Import/export needed for guard access to balance repository |

### AI Service (post-execution accounting guardrails)

| File | Change Type | Description |
|------|-------------|-------------|
| `services/ai-service/src/worker/worker.processor.ts` | MINOR MODIFY (optional) | Log when deduction produces overflow > 0 (observability only) |

### Database/Migration

| File | Change Type | Description |
|------|-------------|-------------|
| None | — | No migration needed. All required columns/tables exist. |

### Frontend/UI

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/messages/en.json` | MODIFY | Add `billing.balance_exhausted` error message key |
| `frontend/messages/zh-TW.json` | MODIFY | Same key in Traditional Chinese |
| `frontend/messages/zh-CN.json` | MODIFY | Same key in Simplified Chinese |
| Frontend error display | MINOR MODIFY | Handle 402/403 balance-exhausted response in execution error flow |

### Tests

| File | Change Type | Description |
|------|-------------|-------------|
| `services/api-gateway/src/billing/__tests__/credit-balance.guard.spec.ts` | NEW | Unit tests for the balance guard |
| `services/api-gateway/src/ai/__tests__/ai-execution-balance-enforcement.integration.spec.ts` | NEW | Integration test: sufficient balance allows, insufficient blocks |
| Existing credit deduction tests | VERIFY ONLY | Confirm no regressions |

---

## 12. Split Decision

### Recommendation: **B — Split BILLING-READY-04 into child slices**

**Rationale:**
1. Balance enforcement gate + accounting guardrails + tests + frontend error handling + consolidation is too much for a single implementation step.
2. The enforcement gate (guard) and the accounting guardrails (worker-side) are separable concerns.
3. CLAUDE.md prefers smaller bounded child slices for HIGH risk work.
4. Test coverage for billing enforcement is critical and benefits from a dedicated slice.

### Proposed Child Slices

| Slice | Name | Scope | Risk |
|-------|------|-------|------|
| **04A** | Balance/Entitlement Gate Contract + Guard Implementation | `CreditBalanceGuard` creation, guard chain wiring, admin bypass, unit tests | MEDIUM |
| **04B** | Execution-Start Gate Integration + Deduction Wiring Validation | Integration tests proving gate blocks/allows execution; verify existing deduction flow compatibility | MEDIUM |
| **04C** | Frontend Error Handling + i18n + UX Polish | Balance-exhausted error display, translation keys, Heroicons, error states | LOW-MEDIUM |
| **04D** | Regression Matrix + Consolidation Checkpoint | Full regression pass, parent close criteria, checkpoint | LOW |

**Alternative simpler split (3 slices):**

| Slice | Name | Scope | Risk |
|-------|------|-------|------|
| **04A** | Balance Enforcement Gate (Guard + Integration Tests) | Guard implementation + wiring + unit + integration tests | MEDIUM-HIGH |
| **04B** | Frontend + i18n + Regression | Error handling UI, translation keys, regression matrix | LOW-MEDIUM |
| **04C** | Consolidation Checkpoint | Parent close, governance | LOW |

**Recommended: 4-slice split (first table).** The guard implementation and integration testing benefit from separation to keep each slice focused and reviewable.

---

## 13. Test Plan

### Required Tests

| # | Test Case | Type | Location |
|---|-----------|------|----------|
| 1 | Sufficient balance allows execution (returns 202) | Integration | `ai-execution-balance-enforcement.integration.spec.ts` |
| 2 | Insufficient balance blocks execution (returns 402/403) | Integration | Same |
| 3 | Zero balance blocks execution | Integration | Same |
| 4 | Admin role bypasses balance check | Unit + Integration | `credit-balance.guard.spec.ts` |
| 5 | User without `credit_balances` row is blocked | Unit | `credit-balance.guard.spec.ts` |
| 6 | Stub/zero-token execution: gate passes, deduction=0 | Integration | Same |
| 7 | Failed execution: no deduction recorded | Verify existing | `persistent-credit-deduction.gateway.spec.ts` + `usage-ledger.service.spec.ts` |
| 8 | Cancelled execution: no deduction recorded | Verify existing | Worker behavior (already tested) |
| 9 | Metadata/usage_records preservation after enforcement | Verify existing | `worker.processor.builder-config.spec.ts` |
| 10 | Multi-builder/referral metadata compatibility | Verify existing | Orchestration metadata fields unaffected |
| 11 | No Stripe/payment/provider API calls | Architectural | No Stripe SDK import in new files; no provider service injection |
| 12 | No AGENT-HARNESS write canary involvement | Architectural | Guard does not reference harness config or write tools |
| 13 | IdempotencyGuard replay still bypasses balance check | Integration | Idempotent replay does not re-check balance |
| 14 | Concurrent requests: both pass if balance sufficient; overflow handled correctly | Unit | Guard returns true for balance > 0; overflow semantics tested in 03D2 |

### Tests NOT Required

- No Stripe webhook tests (no webhooks)
- No subscription lifecycle tests (no subscription management in scope)
- No model access entitlement tests (deferred)
- No multi-builder credit attribution tests (deferred)

---

## 14. Migration Decision

### Decision: **No migration needed.**

All required schema elements exist:
- `credit_balances` table with `balance`, `owner_id`, `status` columns
- `credit_deduction_records` table for deduction audit trail
- `usage_records` table with `execution_status`, `tokens_used`, `metadata`
- `users` table with `role`, `plan_type`, `plan_status`

No new columns, tables, indexes, or constraints are needed for balance enforcement gating.

---

## 15. Runtime/Provider Safety

| Constraint | Enforcement |
|-----------|-------------|
| Docker/Postgres/Redis readiness | Required for future **runtime validation** in Step 3 integration tests. Not required for Step 2 (this step). |
| No Stripe/payment/provider calls | No Stripe SDK, no payment API, no webhook calls without separate explicit approval |
| No browser smoke | Unless future UI work in 04C requires it |
| No AGENT-HARNESS write canary | Write tools remain disabled; guard does not reference harness |
| No `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` | Remains absent/false |

---

## 16. UX/UI Constraints

- No UI implementation in Step 2 (this step).
- Future UI text (in 04C or equivalent) must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Heroicons v2 Outline only for any new icons.
- Impeccable / Emil Kowalski advisory only — no broad redesigns.
- Expected new i18n keys: `billing.balance_exhausted`, `billing.insufficient_credits`, `billing.credits_remaining` (tentative).

---

## 17. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | **Balance correctness** — guard reads stale balance if concurrent deduction completes between read and enqueue | MEDIUM | Acceptable: overflow semantics handle this. Next request sees updated balance. |
| 2 | **Double-charge** — same execution deducted twice | LOW | Already mitigated by `sourceEventId` idempotency in `PersistentCreditDeductionGateway` (validated in 03D2) |
| 3 | **Under-charge** — execution runs but deduction fails silently | LOW | `emitDeductionAttempt()` failure is suppressed (design decision from 03C2). Overflow is recorded but execution is not reverted. Acceptable for now. |
| 4 | **Race/concurrency** — two requests pass gate simultaneously | MEDIUM | Acceptable: BILLING-READY-03 overflow semantics ensure balance never goes negative. Both executions proceed; one will create overflow. |
| 5 | **Failed/cancelled accounting** — tokens consumed but no deduction | LOW | Worker only calls deduction on `completed` status. Failed/cancelled never reach deduction. Correct by design. |
| 6 | **Provider/payment coupling** — guard accidentally calls Stripe | NEGLIGIBLE | Stripe is 100% stub. Guard reads `credit_balances` only. No payment module imported. |
| 7 | **Beta/internal user bypass** — admin bypass exploited | LOW | Only role=admin bypasses. Beta users still get balance checks. Admin accounts are internal-only. |
| 8 | **Multi-builder/referral usage attribution** — credits deducted from wrong user | LOW | `ownerId` in deduction event is always `record.userId` (the authenticated user who initiated). Referral metadata is informational only. |
| 9 | **Migration risk** | NONE | No migration needed. |
| 10 | **Test fragility** — balance state leaks between tests | LOW | Use test-specific `CreditBalance` rows with cleanup. Pattern established in 03D2 integration tests. |
| 11 | **User without provisioned balance** — no `credit_balances` row | MEDIUM | Guard must handle `null` result from `findByOwner()`. Decision: reject (no row = no access). Auto-provisioning is a future slice. |

---

## 18. Step 3 Readiness Conclusion

| Criterion | Result |
|-----------|--------|
| Governance readiness | PASS |
| Source-of-truth identified | PASS |
| Execution entry-points mapped | PASS |
| Enforcement boundary decided | PASS (Option D: phased) |
| Provider/payment boundary decided | PASS (no calls) |
| User category handling decided | PASS |
| Migration decision | PASS (none needed) |
| Test plan complete | PASS |
| Risks identified and mitigated | PASS |
| Child-slice registration required first | **YES** |

### Final Decision

**BILLING-READY-04 is READY for Step 3 — but child-slice registration is required first.**

Before Step 3 implementation:
1. Register child slices (04A/04B/04C/04D) in TASKS.md and TASKS_BACKLOG_FULL.md.
2. Keith approval for the split and child-slice scope.
3. First implementation slice: **04A — Balance Enforcement Gate (Guard + Unit Tests)**.

### Recommended Model for Step 3 (04A)

- **GPT-5.3 Codex** — bounded implementation with clear spec, NestJS guard pattern, unit tests.
- Escalate to **GPT-5.3 Codex High** if the guard needs complex DataSource transaction integration (similar to `TokenQuotaGuard`).

### Exact Next Prompt Type

Registration step: Register 04A/04B/04C/04D child slices in governance docs (Sonnet 4.6 appropriate).

---

## Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status |
| 2 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence |
| 3 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | BILLING-READY-03 close record |
| 4 | `docs/AGENT-PLATFORM-07F-CHECKPOINT.md` | 07F close record |
| 5 | `docs/AGENT-PLATFORM-07F1-CHECKPOINT.md` | 07F1 canary evidence |
| 6 | `docs/AGENT-PLATFORM-07F2-CHECKPOINT.md` | 07F2 cancel signal evidence |
| 7 | `services/api-gateway/src/billing/credit-deduction/credit-deduction.gateway.ts` | Abstract gateway contract |
| 8 | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | Persistent implementation |
| 9 | `services/api-gateway/src/billing/credit-deduction/credit-calculation.service.ts` | Rate calculation |
| 10 | `services/api-gateway/src/billing/credit-deduction/types.ts` | Deduction event/result types |
| 11 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Balance data access |
| 12 | `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` | Module wiring |
| 13 | `services/api-gateway/src/billing/billing.module.ts` | Billing snapshot module |
| 14 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Two-phase write + deduction wiring |
| 15 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution endpoint + guard chain |
| 16 | `services/api-gateway/src/queue/queue.service.ts` | BullMQ enqueue |
| 17 | `services/api-gateway/src/ai/execution-result.service.ts` | Cancel request path |
| 18 | `services/api-gateway/src/entities/usage-record.entity.ts` | Usage record schema |
| 19 | `services/api-gateway/src/entities/credit-balance.entity.ts` | Balance entity |
| 20 | `services/api-gateway/src/credit-ledger/types/plan-definition.ts` | Plan IDs + monthly allocations |
| 21 | `services/api-gateway/src/credit-ledger/types/user-entitlement.ts` | Entitlement models |
| 22 | `services/api-gateway/src/credit-ledger/config/plan-definitions.config.ts` | Plan → entitlement config |
| 23 | `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` | Credit rates |
| 24 | `services/api-gateway/src/quota/quota.guard.ts` | Existing quota pattern |
| 25 | `services/api-gateway/src/quota/token-quota.guard.ts` | Existing token quota pattern |
| 26 | `services/api-gateway/src/payments/interfaces/payment-provider.interface.ts` | Payment stub interface |
| 27 | `services/api-gateway/src/payments/providers/stripe-payment.provider.ts` | Stripe stub |
| 28 | `services/ai-service/src/worker/worker.processor.ts` | Worker execution lifecycle |
| 29 | `database/init/002_usage_records.sql` | usage_records DDL |
| 30 | `database/schema.sql` | Full schema (subscriptions, invoices, quotas) |

---

## Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | File created: `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | CONFIRMED |
| 2 | Files inspected (30 files, read-only) | CONFIRMED |
| 3 | Governance readiness: PASS | CONFIRMED |
| 4 | Billing foundation/source-path findings documented | CONFIRMED |
| 5 | Execution entry-point findings documented | CONFIRMED |
| 6 | Enforcement boundary recommendation: Option D (phased) | CONFIRMED |
| 7 | Source-of-truth recommendation documented | CONFIRMED |
| 8 | User/account category recommendation documented | CONFIRMED |
| 9 | Billing provider boundary: no calls | CONFIRMED |
| 10 | Balance enforcement behavior documented | CONFIRMED |
| 11 | Entitlement gating behavior documented (limited scope) | CONFIRMED |
| 12 | Implementation boundary recommendation documented | CONFIRMED |
| 13 | Split decision: 4 child slices recommended | CONFIRMED |
| 14 | Test plan: 14 test cases | CONFIRMED |
| 15 | Migration decision: none needed | CONFIRMED |
| 16 | Runtime/provider safety notes documented | CONFIRMED |
| 17 | Risks/blockers: 11 identified with mitigations | CONFIRMED |
| 18 | No source/governance/env files changed except this readiness doc | CONFIRMED |
| 19 | No tests/builds/runtime/provider calls executed | CONFIRMED |
| 20 | BILLING-READY-04 ready for Step 3 with child-slice registration first | CONFIRMED |
