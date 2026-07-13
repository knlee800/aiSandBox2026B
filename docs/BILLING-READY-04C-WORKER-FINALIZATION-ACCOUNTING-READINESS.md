# BILLING-READY-04C — Worker Finalization / Accounting Readiness Review

**Task ID:** BILLING-READY-04C
**Step:** 2 of 4 (Worker Finalization / Accounting Readiness Review)
**Status:** COMPLETE
**Date:** 2026-07-13
**Nature:** Static readiness/source-path review only. No implementation. No tests. No runtime.

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-04C ACTIVE | CONFIRMED — Step 1 COMPLETE (Registration 2026-07-13) |
| Parent BILLING-READY-04 ACTIVE, Step 3 IN PROGRESS (child-slice split) | CONFIRMED |
| BILLING-READY-04A COMPLETE and LOCKED | CONFIRMED — 2026-07-13. `CreditBalanceGuard` wired to both execution entry points. |
| BILLING-READY-04B COMPLETE and LOCKED | CONFIRMED — 2026-07-13. Validation-only. 13/13 integration tests PASS. All 8 Step 2 gaps closed. |
| BILLING-READY-04D planned only, not registered | CONFIRMED |
| BILLING-READY-03 COMPLETE and LOCKED | CONFIRMED — All 7 child slices complete. Overflow semantics finalized. |
| AGENT-PLATFORM-07F COMPLETE and LOCKED | CONFIRMED — All 3 child slices (07F1/07F2/07F3) complete. |
| AGENT-HARNESS-07 COMPLETE and LOCKED | CONFIRMED — All 3 child slices (07A/07B/07C) complete. |
| AGENT-HARNESS-06E COMPLETE and LOCKED | CONFIRMED — Full E2E canary PASS. |
| One-active-task rule satisfied | CONFIRMED — BILLING-READY-04C is the only ACTIVE task. |

**Governance readiness: PASS.**

---

## 2. BILLING-READY-04A and 04B Foundation Summary

### 04A Foundation (COMPLETE and LOCKED)

`CreditBalanceGuard` was created and wired into the execution entry-point guard chains:

| Controller | Endpoint | Guard Position |
|------------|----------|----------------|
| `ai-execution.controller.ts` | `POST /api/ai/execute` | After `IdempotencyGuard`, before `QuotaGuard` |
| `public-ai.controller.ts` | `POST /v1/ai/execute` | After `IdempotencyGuard`, before `QuotaGuard` |

Guard behavior confirmed:
- `balance > 0`: allows execution
- `balance <= 0` or missing row: HTTP 402
- `role === ADMIN`: bypasses
- Read-only: no deduction, no `FOR UPDATE` lock

### 04B Foundation (COMPLETE and LOCKED)

Validation-only: 13 integration tests confirmed:
- Guard runs before queue enqueue (`writeExecutionIntent` not called on 402)
- Admin bypass allows even with null balance
- Missing/zero/negative balance all block enqueue
- Public API parity confirmed
- No provider/deduction calls at execution-start

### What 04C Must Still Prove or Harden

04B confirmed the **pre-execution gate** at the API Gateway boundary. What remains unverified and unimplemented:

1. **Credit deduction at worker finalization is NOT wired** — the critical missing link (see Section 4).
2. **Failed/cancelled status accounting** — no deduction should occur; confirm no code path reaches the gateway.
3. **Zero-token/stub execution accounting** — deduction should fire but produce zero credits.
4. **Double-deduction protection under retry** — idempotency key is `executionId`; BullMQ retries disabled (`attempts: 1`); application retry creates new `executionId` — confirm safe.
5. **Concurrent finalization protection** — worker claim uses `WHERE AND execution_status = 'pending'`; only one worker can claim per execution.

---

## 3. Worker Finalization Source-Path Map

### Source Files

| File | Role |
|------|------|
| `services/ai-service/src/worker/worker.processor.ts` | BullMQ Worker processor — all finalization paths |
| `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` payload type |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | HTTP client for internal API Gateway calls |

### BullMQ Job Processing

- **Queue name:** `ai-execution`
- **Worker entry:** `worker.processor.ts` line 539 — `new Worker('ai-execution', async (job: Job) => {...})`
- **Concurrency:** env `WORKER_CONCURRENCY`, default 5
- **BullMQ retries:** `attempts: 1` in queue options — **NO automatic BullMQ retries**
- **Job removal:** `removeOnComplete: true`, `removeOnFail: false`

### Execution Claim (pending → running)

Lines 550–558:
```sql
UPDATE usage_records
SET execution_status = 'running'
WHERE execution_id = $1 AND execution_status = 'pending'
RETURNING execution_id
```
If claim fails (returns 0 rows), the worker inspects current status and handles accordingly (duplicate, stalled, or cancel_requested).

### Cancel Before Start Path

Lines 614–663: After claiming `running`, the worker rechecks status. If `cancel_requested`:
```sql
UPDATE usage_records SET execution_status = 'cancelled' WHERE execution_id = $1
```
→ `publishCompletion(executionId)`, increments cancelled metric, **returns early with NO deduction call**.

### Timeout Watchdog Path

Lines 679–715: Timer set for `EXECUTION_TIMEOUT_MS`. On expiry:
```sql
UPDATE usage_records
SET execution_status = 'timeout'
WHERE execution_id = $1 AND execution_status = 'running'
RETURNING execution_id
```
→ `publishCompletion(executionId)`, **returns with NO deduction call**.

### Provider / Stub Execution Path

Lines 736–907: Retry loop (max `EXECUTION_PROVIDER_RETRY_ATTEMPTS`, default 3) for transient errors only (`isRetryableError`). Two branches:
- **Harness path** (lines 766–888): `executeAgentHarnessLoop()` when `harnessVersion === 'v1'` and `enableToolLoop === true`
- **Plain path** (lines 892–893): `aiExecutionService.execute()` for all other cases

Both paths return `aiResult` with `tokensUsed`, `model`, `output`, `fileActions`. Stub/test-harness-stub providers return `tokensUsed = 0`.

### Post-Completion Cancel Check

Lines 915–960: After AI returns successfully, re-reads status:
```sql
SELECT execution_status FROM usage_records WHERE execution_id = $1
```
If `cancel_requested`:
```sql
UPDATE usage_records SET execution_status = 'cancelled' WHERE execution_id = $1
```
→ `publishCompletion(executionId)`, **returns early with NO deduction call**.

### Success Finalization Path

Lines 978–1059:
1. **Metadata assembly** (lines 978–1028): Reads existing metadata, merges `aiExecutionResult`, AGENT-PLATFORM-06 identity fields, AGENT-PLATFORM-07C2 orchestration fields, harness checkpoint hash.
2. **Ledger write** (lines 1030–1038):
   ```sql
   UPDATE usage_records
   SET execution_status = 'completed',
       tokens_used = $2,
       metadata = $3::jsonb
   WHERE execution_id = $1
   ```
3. **Stream publish** (line 1041): `publishCompletion(executionId)`
4. **Metrics** (lines 1043–1057): completion metrics, latency observation, structured log.
5. **NO credit deduction call** — the worker does not call `UsageLedgerService`, `PersistentCreditDeductionGateway`, or any credit system.

### AbortError Catch Path

Lines 1063–1102: If `error.name === 'AbortError'` or signal is aborted (and not timed out):
```sql
UPDATE usage_records SET execution_status = 'cancelled' WHERE execution_id = $1
```
→ `publishCompletion(executionId)`, **returns with NO deduction call**.

### Generic Error Catch Path (failure)

Lines 1104–1136: All other errors:
```sql
UPDATE usage_records SET execution_status = 'failed' WHERE execution_id = $1
```
→ throws error (BullMQ marks job as failed), **NO deduction call**.

### Metadata Preservation

All AGENT-PLATFORM-06 and AGENT-PLATFORM-07C2 fields are preserved in the success finalization metadata:
- `agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`
- `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`
- `preApplyCheckpointHash` (harness)
- `aiExecutionResult.output`, `.tokensUsed`, `.model`, `.provider`, `.fileActions`

---

## 4. Credit Deduction Source-Path Map

### Abstract Gateway

| Type | File |
|------|------|
| `CreditDeductionGateway<T>` (abstract) | `services/api-gateway/src/billing/credit-deduction/credit-deduction.gateway.ts` |
| `PersistentCreditDeductionGateway` | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` |
| `CreditCalculationService` | `services/api-gateway/src/billing/credit-deduction/credit-calculation.service.ts` |
| `CreditBalanceRepository` | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` |
| `CreditDeductionRecordRepository` | `services/api-gateway/src/billing/credit-deduction/credit-deduction-record.repository.ts` |

### PersistentCreditDeductionGateway — applyDeduction() Flow

1. **Pre-transaction idempotency check**: `findBySourceEventId(event.sourceEventId)` — if record exists, returns early with duplicate result.
2. **Transaction boundary**: `DataSource.transaction(async (manager) => {...})`
3. **Balance lock**: `findByOwnerForUpdate(ownerId, 'user', manager)` — `SELECT ... FOR UPDATE` within transaction.
4. **Calculation**: `CreditCalculationService.calculateLineItemCredits(item)` = `unitCount × creditsPerUnit`
5. **Overflow**: `appliedCredits = Math.min(totalRequested, available)`, `overflow = Math.max(0, total - available)`, `balanceAfter = available - applied`
6. **Record insert**: `deductionRecordRepository.create(...)` with transactional manager
7. **Balance update**: `creditBalanceRepository.deductBalance(balance.id, balanceAfter, manager)`
8. **Race fallback**: If 23505 unique violation on `source_event_id` → fetch and return existing record.

### emitDeductionAttempt() — Current Wiring

In `UsageLedgerService.emitDeductionAttempt()` (lines 734–805):
- **sourceEventId**: `record.executionId`
- **ownerId**: `record.userId`
- **lineItems**: `[{ category: 'model_tokens', unit: 'token', unitCount: record.tokensUsed ?? 0, creditsRequested: 0 }]`
- **creditsRequested is always 0** — gateway recalculates from `unitCount × creditsPerUnit`
- **Error suppression**: gateway errors are caught and logged; do NOT break usage ledger write

Call chain: `UsageLedgerService.updateExecutionResult()` (line 293) → `emitDeductionAttempt()`

### CRITICAL FINDING: Missing Link Between Worker Finalization and Credit Deduction

**`emitDeductionAttempt()` is called only from `updateExecutionResult()`. `updateExecutionResult()` is NOT called in the current async BullMQ execution flow.**

Evidence:
1. The worker (`worker.processor.ts`) does NOT import `UsageLedgerService`.
2. The worker writes `execution_status = 'completed'` via direct raw SQL (`dataSource.query()`) — it bypasses `UsageLedgerService` entirely.
3. No API Gateway callback path exists from worker completion to `updateExecutionResult()`.
4. Grep of `updateExecutionResult` across all non-test production files confirms it is defined in `usage-ledger.service.ts` but has NO production caller in the async execution path. The callers in test files (`ai-execution.controller.spec.ts`, `execution-safety.integration.spec.ts`) and phase summary docs reference the old synchronous execution architecture (pre-BullMQ).

**Consequence: Credit deduction has not fired for any async BullMQ execution in production.**

### What Exists and Is Correct

- `PersistentCreditDeductionGateway` implementation: complete, transactional, idempotent (03D1/03D2 validated).
- `emitDeductionAttempt()` in `UsageLedgerService`: correct logic, suppresses errors.
- `sourceEventId = executionId`: correct idempotency key.
- `ApiGatewayHttpClient`: established HTTP client in ai-service for calling API Gateway internal endpoints. Already calls `POST /api/internal/workspace/:sessionId/*` and similar patterns.

### Missing Piece

A trigger path from worker completion → `emitDeductionAttempt()`.

Implementation option (recommended): **Worker calls a new internal API Gateway endpoint post-completion.** The pattern matches existing `ApiGatewayHttpClient` usage (all internal calls use `X-Internal-Service-Key`).

Proposed endpoint: `POST /api/internal/executions/:executionId/finalize-accounting`
- Guard: `InternalServiceGuard` (existing pattern)
- Action: reads completed `UsageRecord` by `executionId`, calls `emitDeductionAttempt(record)`
- Error: suppressed (does not affect completion)
- Idempotency: `PersistentCreditDeductionGateway` deduplicates by `sourceEventId`

---

## 5. Execution Status Accounting Decision

| Status | Should Deduct? | Rationale |
|--------|---------------|-----------|
| `completed` | **YES** — once, based on `tokens_used` | Successful execution; `tokens_used` is written by worker at completion. Deduction fires via new trigger. |
| `failed` | **NO** | Worker sets `failed` without writing `tokens_used`. No execution result. |
| `cancelled` | **NO** | Worker aborted before/during execution; no tokens billed. |
| `cancel_requested` → `cancelled` | **NO** | Transitions to `cancelled`; same as above. |
| `timeout` | **NO** | Watchdog fires before AI completes; no result. |
| Provider error (non-retryable) | **NO** | Error thrown → `failed` path. No deduction. |
| Validation/tool error | **NO** | Tool errors within harness loop: if the loop still completes, it is `completed`. If it throws, it is `failed`. Follow `completed`/`failed` rule respectively. |
| Stub/test execution (`stub`, `test-harness-stub`) | **YES** — but 0 credits | `completed` with `tokens_used = 0`. `calculateCredits('model_tokens', 0) = 0`. Deduction fires but produces 0 applied credits. Correct by design. |

---

## 6. Token Accounting Decision

| Scenario | Behavior | Decision |
|----------|----------|----------|
| `tokens_used > 0` | `calculateCredits('model_tokens', tokensUsed)` = `tokensUsed × 1` (placeholder rate) | Normal deduction. |
| `tokens_used = 0` | `calculateCredits('model_tokens', 0) = 0` → `appliedCredits = 0`, `balanceAfter = unchanged` | Deduction fires, 0 credits. Correct. |
| `tokens_used = null` | Worker writes `aiResult.tokensUsed ?? 0` to DB. NULL → 0 in `tokens_used` column. | Same as 0 case. |
| Stub provider | Returns `tokensUsed = 0` by design. DB gets 0. | 0 credits deducted. Correct. |
| Harness loop | Accumulates tokens across iterations. `tokensUsed` = total from loop result. | Normal deduction based on final total. |
| `creditsRequested = 0` in event | `CreditCalculationService` ignores `creditsRequested`, recalculates from `unitCount`. | Advisory field; calculation is always `unitCount × creditsPerUnit`. |
| Current rate | `model_tokens`: `creditsPerUnit = 1` (placeholder). 1 token = 1 credit. | Rate is labeled "placeholder" and noted for future tuning. Rate tuning is deferred. |
| **04C enforcement**: zero-token/stub deduction | **Should proceed** (fires but applies 0 credits). No special guard against zero-token deduction is required; idempotency record is still written with `appliedCredits=0`. | Do NOT add a `if tokens_used === 0, skip deduction` guard. Records provide audit trail. |

---

## 7. Failed/Cancelled Behavior Decision

| Scenario | Worker Path | Status Written | Deduction? |
|----------|-------------|----------------|------------|
| Cancel before start (pre-execution cancel check) | Lines 633–663 | `cancelled` | **NO** — returns before success path |
| Cancel during execution (cancel poll detects `cancel_requested`) | `abortController.abort()` → throws `AbortError` | `cancelled` | **NO** — AbortError catch path |
| Cancel after completion (post-completion cancel check) | Lines 924–959 | `cancelled` | **NO** — returns before DB write of `completed` |
| Timeout watchdog fires | Lines 679–715 | `timeout` | **NO** — separate early return |
| Non-retryable provider error | Error catch lines 1104+ | `failed` | **NO** — generic error path |
| Retryable error, all retries exhausted | Error rethrown after last attempt | `failed` | **NO** — same error catch |
| AbortError (any other abort) | Lines 1067–1102 | `cancelled` | **NO** |
| Partial execution (abort mid-harness) | AbortError propagates from loop | `cancelled` | **NO** |
| `cancel_requested` but worker hasn't seen it yet | Worker polls every 1s; eventually aborts | `cancelled` | **NO** — abort detected before or after completion check |
| **If cancel arrives after completion SQL written** | Cancel check at lines 915–959 catches it | `cancelled` — overwrites `completed` | **NO** — this is the "completed but cancelled" race. Current behavior: cancel wins. No deduction fires because return happens before deduction trigger. Implementation must ensure deduction trigger is called BEFORE this return point or ONLY if status is still `completed`. |

**Important race condition identified**: If a cancel arrives exactly after the completion SQL is written but before the deduction trigger fires, the cancel will overwrite `completed` with `cancelled`. The deduction trigger should be called **after** the post-completion cancel check returns (i.e., only when execution is still `completed` and not cancelled). This requires the deduction trigger to be placed after the status confirmation, not just after the DB write.

---

## 8. Idempotency and Double-Deduction Decision

| Question | Finding | Decision |
|----------|---------|----------|
| Idempotency key | `sourceEventId = record.executionId` (UUID v4 per execution) | Sufficient. Each execution has a unique ID. |
| `executionId` sufficient as key? | Yes. `execution_id` is the PK of `usage_records`. One deduction record per `sourceEventId`. Unique index on `credit_deduction_records.source_event_id`. | Confirmed sufficient. |
| BullMQ retry double-deduction | `attempts: 1` in `queue.service.ts`. No BullMQ-level retry. | **SAFE.** |
| Application-level retry (`reuseExecutionIntent`) | Creates new `executionId` (new UUID). New `sourceEventId`. | **SAFE.** New deduction record for new execution. No duplication. |
| Concurrent finalization double-deduction | Worker claim uses `WHERE AND execution_status = 'pending'`. Two workers cannot both claim the same job. Only one reaches success finalization path. | **SAFE.** |
| Deduction call called twice (e.g., deploy restart mid-execution) | Pre-transaction idempotency check in `PersistentCreditDeductionGateway` detects existing record via `findBySourceEventId`. Returns early with duplicate result. | **SAFE.** Validated in 03D2. |
| Race condition: two concurrent `applyDeduction` calls with same `sourceEventId` | 23505 unique constraint violation caught; fetches existing record. | **SAFE.** Validated in 03D2. |
| Does Step 3 need new idempotency guardrails? | **No new idempotency work needed.** Existing `sourceEventId` deduplication is complete and validated. | Deduction trigger may fire at most once per execution by design (worker claims once, completes once, triggers once). |
| Cancel-after-completion race (see Section 7) | New trigger must be placed after cancel check passes. If execution is cancelled, no trigger fires. | Implementation must respect placement in worker flow. |

---

## 9. Implementation vs Validation-Only Decision

**Decision: Option B — 04C needs small implementation guardrails.**

Rationale:

The missing link between worker finalization and credit deduction is a production gap: credit deduction has **never fired** in the async execution flow. This cannot be closed by tests alone. An implementation change is required.

The required implementation is bounded:
1. **New internal API Gateway endpoint**: `POST /api/internal/executions/:executionId/finalize-accounting` — reads completed `UsageRecord`, calls `emitDeductionAttempt()`.
2. **New method on `ApiGatewayHttpClient`**: `notifyExecutionComplete(executionId, userId, tokensUsed)` — follows existing `X-Internal-Service-Key` pattern.
3. **One call in worker success path**: after post-completion cancel check confirms execution is still `completed`, call `apiGatewayHttpClient.notifyExecutionComplete(...)`. Error must be suppressed.

This is a single logical change across three files. No schema migration. No frontend. No Stripe. No AGENT-HARNESS involvement.

**No further split of 04C is required.**

---

## 10. Exact Step 3 File Boundary

### Production Files

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | MODIFY | Expose `triggerDeductionForExecution(executionId: string): Promise<void>` public method — reads record by `executionId`, calls `emitDeductionAttempt()`. |
| 2 | `services/api-gateway/src/ai/internal-accounting.controller.ts` (NEW) | CREATE | `POST /api/internal/executions/:executionId/finalize-accounting` endpoint; guarded by `InternalServiceGuard`; calls `usageLedgerService.triggerDeductionForExecution(executionId)`. |
| 3 | `services/api-gateway/src/ai/ai.module.ts` (or appropriate module) | MODIFY | Import new controller. |
| 4 | `services/ai-service/src/clients/api-gateway-http.client.ts` | MODIFY | Add `notifyExecutionComplete(executionId: string, userId: string, tokensUsed: number): Promise<void>` — `POST /api/internal/executions/:executionId/finalize-accounting` with `X-Internal-Service-Key`. Errors are caught and suppressed (logged only). |
| 5 | `services/ai-service/src/worker/worker.processor.ts` | MODIFY | After post-completion cancel check at line ~959, if execution is still `completed`: call `await this.apiGatewayHttpClient.notifyExecutionComplete(executionId, userId, tokensUsed)` with error suppression. |

**Note**: The exact new controller file name and module placement must be confirmed in Step 3 planning based on the existing internal controller pattern. An alternative is to add the endpoint to an existing internal routing controller.

### Test Files

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 6 | `services/ai-service/src/worker/worker.processor.spec.ts` | MODIFY | Add tests: completed execution calls `notifyExecutionComplete`; failed/cancelled/timeout do NOT call it; zero-token stub calls it; duplicate call is safe. |
| 7 | `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | MODIFY (if needed) | Add test for new public `triggerDeductionForExecution()` method if not covered by existing suite. |
| 8 | `services/api-gateway/src/billing/__tests__/credit-deduction-finalize-accounting.integration.spec.ts` (NEW) | CREATE | Integration tests for `POST /api/internal/executions/:executionId/finalize-accounting`: completed execution triggers deduction; missing record handled safely; error suppression; no duplicate deduction. |

### Docs / Checkpoint Files (Step 4 only)

- `docs/BILLING-READY-04C-CHECKPOINT.md` — created in Step 4 consolidation.
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md` — updated in Step 4.

### Explicitly Excluded

- No frontend / i18n changes (no user-visible text added in Step 3).
- No database migration (all schema exists).
- No changes to `credit-balance.guard.ts`, `CreditBalanceGuardModule`, or any 04A/04B files.
- No changes to `PersistentCreditDeductionGateway` internals.
- No changes to `CreditBalance` or `CreditDeductionRecord` entities.

---

## 11. Test Plan

| # | Test Case | Type | Target File(s) |
|---|-----------|------|----------------|
| T1 | Completed execution with `tokens_used > 0` triggers `notifyExecutionComplete` once | Unit | `worker.processor.spec.ts` |
| T2 | Completed execution with `tokens_used = 0` (stub) still triggers `notifyExecutionComplete` once | Unit | `worker.processor.spec.ts` |
| T3 | Failed execution does NOT trigger `notifyExecutionComplete` | Unit | `worker.processor.spec.ts` |
| T4 | Cancelled execution (cancel before start) does NOT trigger | Unit | `worker.processor.spec.ts` |
| T5 | Cancelled execution (cancel during run — AbortError) does NOT trigger | Unit | `worker.processor.spec.ts` |
| T6 | Post-completion cancel detected → sets `cancelled` → does NOT trigger | Unit | `worker.processor.spec.ts` |
| T7 | Timeout path does NOT trigger | Unit | `worker.processor.spec.ts` |
| T8 | `notifyExecutionComplete` error is suppressed — does not propagate | Unit | `worker.processor.spec.ts` |
| T9 | `triggerDeductionForExecution()` reads record and calls `emitDeductionAttempt()` | Unit | `usage-ledger.service.spec.ts` |
| T10 | `triggerDeductionForExecution()` safely handles missing record (executionId not found) | Unit | `usage-ledger.service.spec.ts` |
| T11 | `POST /api/internal/executions/:id/finalize-accounting`: rejects without `X-Internal-Service-Key` | Integration | `credit-deduction-finalize-accounting.integration.spec.ts` |
| T12 | `POST /api/internal/executions/:id/finalize-accounting`: completed execution with balance → deduction record created, balance reduced | Integration | Same |
| T13 | `POST /api/internal/executions/:id/finalize-accounting`: zero-token execution → deduction record created, `appliedCredits = 0`, balance unchanged | Integration | Same |
| T14 | `POST /api/internal/executions/:id/finalize-accounting`: duplicate call with same `executionId` → idempotent, returns 200, no second deduction | Integration | Same |
| T15 | `POST /api/internal/executions/:id/finalize-accounting`: no `credit_balances` row → error suppressed, endpoint returns 200 | Integration | Same |
| T16 | 04A `CreditBalanceGuard` behavior unaffected by 04C changes — existing guard tests still pass | Regression | `credit-balance.guard.spec.ts` (existing, run only) |
| T17 | 04B integration tests unaffected — guard-to-enqueue path unchanged | Regression | `credit-balance-guard-execution-start.integration.spec.ts` (existing, run only) |
| T18 | Worker metadata/orchestration fields (AGENT-PLATFORM-06/07C2) preserved in completion path | Regression | `worker.processor.builder-config.spec.ts` (existing, run only) |
| T19 | No Stripe/payment/provider API calls in any new or modified file | Architectural | Import/ref check during code review |
| T20 | No AGENT-HARNESS write canary references in any new or modified file | Architectural | Import/ref check during code review |

**Tests NOT required in Step 3:**
- No Stripe webhook tests
- No subscription tests
- No multi-builder credit attribution tests (deferred to future slice)
- No browser smoke
- No live DB integration tests (DB integration for idempotency validated in 03D2; new integration tests use mocked repos or test DB)

---

## 12. Migration Decision

**Decision: No migration needed.**

All required schema exists:
- `usage_records`: `execution_id`, `user_id`, `tokens_used`, `execution_status`, `metadata` — all present.
- `credit_balances`: `balance`, `owner_id`, `owner_type` — all present.
- `credit_deduction_records`: `source_event_id` (unique), `owner_id`, `applied_credits`, `overflow_credits`, `balance_before`, `balance_after` — all present.

No new columns, tables, indexes, or constraints are needed for 04C.

---

## 13. Runtime / Provider Safety Notes

| Constraint | Status |
|-----------|--------|
| No Docker/PostgreSQL/Redis runtime commands in Step 2 | CONFIRMED — static review only |
| No Stripe/payment/provider API calls | CONFIRMED — no Stripe SDK; no payment module touched |
| No browser smoke | CONFIRMED — no UI work in Step 3 |
| No AGENT-HARNESS write canary | CONFIRMED — not referenced in any 04C scope |
| Future runtime validation (Step 3 integration tests) | Will require Docker + PostgreSQL if live DB integration tests are added; acceptable per 04C scope planning |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | Remains absent/false — not touched |

---

## 14. UX/UI Constraints

- No UI implementation in Step 2 (this review step).
- No UI implementation in Step 3 (accounting/backend only).
- If future user-facing copy is added for balance accounting (e.g., deduction confirmation banner), update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing `useTranslations` / `next-intl` hook pattern.
- Heroicons v2 Outline only for any new icons.
- Impeccable / Emil Kowalski advisory only.

---

## 15. Risks and Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | **Double-deduction via concurrent deduction trigger** — if two workers somehow call `notifyExecutionComplete` for the same execution | LOW | Prevented by `sourceEventId` idempotency in `PersistentCreditDeductionGateway` (pre-check + 23505 fallback). Validated in 03D2. |
| R2 | **Under-deduction** — `notifyExecutionComplete` call fails (network error, API Gateway down) | MEDIUM | Error must be suppressed in worker (does not affect completion). Execution is still `completed` in DB. Credit deduction is not retried. Accepted risk: same as current `emitDeductionAttempt()` suppression behavior. |
| R3 | **Failed/cancelled accounting ambiguity** — accidental deduction path for failed executions | LOW | Worker code analysis confirms no deduction path reaches success finalization for failed/cancelled. New trigger is placed only in success path, after post-completion cancel check. Must verify placement. |
| R4 | **Zero-token/stub ambiguity** — stub executions call deduction unnecessarily | LOW | Acceptable. Zero tokens → zero credits. Deduction record created with `appliedCredits = 0`. Provides audit trail. No balance impact. |
| R5 | **Cancel-after-completion race** — cancel arrives after `completed` SQL write but before trigger fires | MEDIUM | Worker performs post-completion cancel check (lines 915–959). If cancel wins, execution becomes `cancelled` and returns early. Trigger must NOT be placed before this check. Placement must be: after cancel check passes (execution confirmed still `completed`). |
| R6 | **Worker retry risk** — application-level retry via `reuseExecutionIntent()` | LOW | New `executionId` issued for retry. New `sourceEventId`. No double-deduction. |
| R7 | **Transaction/idempotency race** — two concurrent `applyDeduction` calls for same `executionId` | LOW | Already handled by `PersistentCreditDeductionGateway` (23505 race fallback). Validated in 03D2. |
| R8 | **Missing `credit_balances` row** — user has no provisioned balance when deduction fires | LOW | `PersistentCreditDeductionGateway` throws; `emitDeductionAttempt()` catches and suppresses. This is the same case as admin users (who pass the guard but have no balance row). Acceptable suppression. |
| R9 | **Mismatch between API Gateway gate and worker accounting** — user passes balance check, executes, deduction fires at completion | DESIGN INTENT | This is the correct phased behavior (Option D from 04 review). Gate prevents new executions; accounting deducts after completion. No mismatch. |
| R10 | **Multi-builder/referral metadata attribution** — credits deducted from wrong user | LOW | `emitDeductionAttempt()` always uses `record.userId` (the authenticated initiator). Referral metadata in `usage_records.metadata` is informational only. Multi-builder credit attribution (e.g., splitting between referrer/referee) is deferred. |
| R11 | **Test fragility** — worker.processor.spec.ts currently does not mock `ApiGatewayHttpClient` for this new call | MEDIUM | New test cases must add `apiGatewayHttpClient.notifyExecutionComplete` as a mock. Existing tests must be updated to handle the new mock presence without breaking. |
| R12 | **Internal controller guard gap** — new `POST /api/internal/executions/:id/finalize-accounting` endpoint must be protected by `InternalServiceGuard` (existing pattern). If guard is missed, this endpoint becomes unauthenticated. | HIGH | Verify guard wiring in Step 3 code review. Internal endpoint pattern is established (see CLAUDE.md §Internal API Endpoints). |

---

## 16. Step 3 Readiness Conclusion

| Criterion | Result |
|-----------|--------|
| Governance readiness | PASS |
| Worker finalization path fully mapped | PASS |
| Credit deduction path fully mapped | PASS |
| **CRITICAL FINDING: Missing link identified** | IDENTIFIED — deduction not wired in async flow |
| Failed/cancelled status accounting decided | PASS — no deduction for any non-completed status |
| Token accounting decided | PASS — zero tokens → zero credits; no special guard needed |
| Idempotency/double-deduction decided | PASS — `sourceEventId` sufficient; no new guardrails needed |
| Migration decision | PASS — none needed |
| Implementation vs validation-only decided | PASS — small implementation required |
| Step 3 file boundary defined | PASS — 5 production files, 3 test files |
| Test plan complete | PASS — 20 test cases |
| Risks identified | PASS — 12 risks with mitigations |
| Further split required? | **NO** — bounded implementation, single logical change |

**BILLING-READY-04C is READY for Step 3.**

The only meaningful prerequisite for Step 3 is confirming the exact module placement for the new internal controller (to match existing routing patterns). This can be determined at the start of Step 3 implementation by reading `ai.module.ts` and the existing internal route structure.

### Recommended Model for Step 3

**GPT-5.3 Codex** — bounded NestJS implementation with clear spec, HTTP client extension, worker integration.

Escalate to **GPT-5.3 Codex High** if the internal guard wiring or module integration introduces unexpected complications.

### Exact Next Prompt Type

Step 3 is an implementation step. Prompt type:
- Implementation step (4-step loop): register as Step 3, implement 5 production files + 3 test files, run validation commands, proceed to Step 4 consolidation.
- Prerequisite: Keith approval for Step 3 registration.

---

## 17. Final Report

### 1. Exact File Created/Changed

| File | Action |
|------|--------|
| `docs/BILLING-READY-04C-WORKER-FINALIZATION-ACCOUNTING-READINESS.md` | **CREATED** — this file |

### 2. Files Inspected (Read-Only, Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status (partial read — file exceeds 100K chars) |
| 2 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence and task status |
| 3 | `docs/BILLING-READY-04B-CHECKPOINT.md` | 04B completion record |
| 4 | `docs/BILLING-READY-04A-CHECKPOINT.md` | 04A completion record |
| 5 | `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | 04 source-path review |
| 6 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | 03 parent close record |
| 7 | `services/ai-service/src/worker/worker.processor.ts` | Worker BullMQ processor — all finalization paths |
| 8 | `services/ai-service/src/queue/job.types.ts` | AiExecutionJob type definition |
| 9 | `services/ai-service/src/clients/api-gateway-http.client.ts` | HTTP client for internal API Gateway calls |
| 10 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | UsageLedgerService — `updateExecutionResult`, `emitDeductionAttempt` |
| 11 | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | Gateway implementation |
| 12 | `services/api-gateway/src/billing/credit-deduction/types.ts` | CreditDeductionEvent, CreditDeductionResult |
| 13 | `services/api-gateway/src/billing/credit-deduction/credit-calculation.service.ts` | Credit rate calculation |
| 14 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Balance data access |
| 15 | `services/api-gateway/src/entities/usage-record.entity.ts` | UsageRecord entity |
| 16 | `services/api-gateway/src/entities/credit-balance.entity.ts` | CreditBalance entity |
| 17 | `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | CreditDeductionRecord entity |
| 18 | `services/api-gateway/src/credit-ledger/config/credit-rates.config.ts` | Credit rates config |
| 19 | `database/init/002_usage_records.sql` | usage_records DDL — status enum confirmed |

### 3. Governance Readiness

PASS. See Section 1.

### 4. 04A/04B Foundation Summary

CONFIRMED. See Section 2.

### 5. Worker Finalization Source-Path Map

Fully mapped. See Section 3. Critical finding: worker writes completion via direct SQL, does not call `UsageLedgerService`.

### 6. Credit Deduction Source-Path Map

Fully mapped. See Section 4. Critical finding: `emitDeductionAttempt()` is unreachable in current async execution flow.

### 7. Execution Status Accounting Decision

DECIDED. See Section 5. Only `completed` deducts. All other statuses: no deduction.

### 8. Token Accounting Decision

DECIDED. See Section 6. Zero/null tokens → zero credits. Stub: zero credits. Rate: placeholder `1 credit/token`.

### 9. Failed/Cancelled Behavior Decision

DECIDED. See Section 7. No deduction for failed/cancelled/timeout. Cancel-after-completion race: cancel wins, no deduction.

### 10. Idempotency/Double-Deduction Decision

DECIDED. See Section 8. `executionId` as `sourceEventId` is sufficient. No new guardrails needed. All protection already implemented in 03D1/03D2.

### 11. Implementation vs Validation-Only Decision

**Option B: Small implementation required.** See Section 9. New internal endpoint + new client method + worker call.

### 12. Exact Step 3 File Boundary

5 production files + 3 test files. See Section 10.

### 13. Test Plan

20 test cases. See Section 11.

### 14. Migration Decision

None needed. See Section 12.

### 15. Runtime / Provider Safety Notes

See Section 13. No runtime commands. No Stripe. No AGENT-HARNESS write canary.

### 16. Risks / Blockers

12 risks identified with mitigations. R5 (cancel-after-completion race) and R12 (internal guard wiring) are highest priority in Step 3. See Section 15.

### 17. Confirmation: No Source/Governance/Env Files Changed

**CONFIRMED.** Only `docs/BILLING-READY-04C-WORKER-FINALIZATION-ACCOUNTING-READINESS.md` was created. No production source files, test files, governance files (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md), `.env*` files, docker files, package files, migrations, or entities were modified.

### 18. Confirmation: No Tests/Builds/Runtime/Provider Calls

**CONFIRMED.** No tests run. No builds executed. No Docker/PostgreSQL/Redis/BullMQ/Worker started. No API Gateway started. No Stripe/payment/provider API calls made. No browser smoke. No AGENT-HARNESS write canary involved.

### 19. BILLING-READY-04C Ready for Step 3

**YES — BILLING-READY-04C is ready for Step 3.**

The readiness review has identified all source paths, decisions, risks, and file boundaries. The missing link between worker finalization and credit deduction has been located. A bounded, low-risk implementation is defined. No further split is required. Keith approval for Step 3 registration is the only prerequisite.
