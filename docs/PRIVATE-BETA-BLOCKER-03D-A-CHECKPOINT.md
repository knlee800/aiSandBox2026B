# PRIVATE-BETA-BLOCKER-03D-A — Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03D-A
**Title:** Backend Build Deduction Gate + Confirm-Apply Endpoint
**Status:** COMPLETE AND LOCKED — 2026-08-14
**Parent:** PRIVATE-BETA-BLOCKER-03D (Step 3, child slice A of 2)
**Step:** Step 3 — Consolidation / Checkpoint
**Author:** Cursor / Sonnet 4.6 (governance/consolidation only — no source modification)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03D-A |
| Title | Backend Build Deduction Gate + Confirm-Apply Endpoint |
| Status | **COMPLETE AND LOCKED — 2026-08-14** |
| Workflow | HIGH-RISK 3-STEP CHILD |
| Step completed | Step 3 — Consolidation / Checkpoint |

---

## 2. Parent Relationship

**Parent task:** PRIVATE-BETA-BLOCKER-03D — No-Workspace-Result Credit Policy

03D-A is child slice A of 2 under parent 03D Step 3 (Bounded Implementation + Validation). It represents the backend API Gateway portion of the 03D policy implementation. Parent Step 3 remains **IN PROGRESS** pending 03D-B (frontend apply-result integration).

03D-B is **NOT REGISTERED**. Do not register or implement 03D-B until the next authorized window.

---

## 3. Problem Addressed

Prior to 03D-A, `triggerDeductionForExecution()` applied immediate credit deduction for ALL completed executions — both Ask (`executionIntent=conversation`) and Build (`executionIntent=workspace_mutation`) — regardless of whether the workspace apply actually succeeded or occurred. This meant:

- A Build that completed AI execution but whose workspace apply failed, was partial, or never reached the frontend → was charged identically to a Build with a fully applied workspace.
- There was no server-side evidence gate between provider completion and deduction for Build executions.
- The backend had no endpoint to receive apply-result confirmation from the authenticated caller.

03D-A introduces an **intent-conditional deduction gate** and a **confirm-build-apply endpoint** to enforce: `Build deduction only after qualifying full workspace-apply confirmation`.

---

## 4. Final Accounting Policy

### Authoritative policy matrix

| Scenario | executionIntent | Charge? | Trigger |
|----------|----------------|---------|---------|
| Ask success | `conversation` | **CHARGE** — immediate at completion | `triggerDeductionForExecution()` unchanged path |
| Build full successful apply confirmed | `workspace_mutation` | **CHARGE** — only after qualifying confirm-apply | `POST confirm-build-apply` → `triggerBuildApplyDeduction()` |
| Build zero actions (contract failure) | `workspace_mutation` | NO CHARGE | execution_status=`failed` → existing gate skips |
| Build apply failure | `workspace_mutation` | NO CHARGE | No qualifying confirmation → no deduction |
| Build partial apply | `workspace_mutation` | NO CHARGE | successCount < totalActions → rejected |
| Timeout / provider failure | any | NO CHARGE | execution_status != `completed` → existing gate skips |
| Cancellation | any | NO CHARGE | execution_status != `completed` → existing gate skips |
| No apply confirmation received | `workspace_mutation` | NO CHARGE | Confirmation never arrives → no deduction |

**NO CONFIRMED FULL BUILD APPLY = NO DEDUCTION.**

No timeout fallback. No reconciliation auto-charge. No silence-based charge. No watchdog deduction.

---

## 5. Ask Behavior

Ask (`executionIntent=conversation`) deduction path is **completely unchanged**.

When worker writes `execution_status='completed'` and calls `notifyExecutionComplete(executionId)`:
- `InternalAccountingController.finalizeAccounting()` receives the HTTP call
- `triggerDeductionForExecution(executionId)` reads metadata
- `readPersistedExecutionIntent()` returns `'conversation'`
- Proceeds immediately to `emitDeductionAttempt(record)`
- `PersistentCreditDeductionGateway.applyDeduction()` runs the atomic deduction transaction
- `sourceEventId = executionId` ensures idempotency

No apply confirmation required. No frontend call. No delay. Existing path unchanged.

---

## 6. Build Completion Gate

When worker writes `execution_status='completed'` for a `workspace_mutation` execution and calls `notifyExecutionComplete(executionId)`:
- `triggerDeductionForExecution(executionId)` reads metadata
- `readPersistedExecutionIntent()` returns `'workspace_mutation'`
- Returns deterministic: `{ triggered: false, reason: 'build_awaiting_apply' }`
- **No deduction occurs at AI completion**

Deduction is deferred until a qualifying `POST confirm-build-apply` is received.

---

## 7. Confirm-Build-Apply Endpoint

**Route:** `POST /api/internal/executions/:executionId/confirm-build-apply`

**Controller:** `InternalAccountingController` (`services/api-gateway/src/ai/internal-accounting.controller.ts`)

**Service method:** `UsageLedgerService.triggerBuildApplyDeduction(executionId, confirmation)`

**Request body (ConfirmBuildApplyDto):**
```
{
  applyStatus: string        // must be 'applied' to qualify
  totalActions: number       // integer >= 0
  successCount: number       // integer >= 0
}
```

**Response body:**
```
{
  executionId: string
  triggered: boolean
  reason: string
}
```

The endpoint logs the inbound request (applyStatus, totalActions, successCount) at DEBUG level, delegates to `triggerBuildApplyDeduction()`, and returns the result. It does not make the deduction decision itself — all validation and deduction logic lives in `UsageLedgerService`.

---

## 8. Server-Side Validation Rules

`triggerBuildApplyDeduction()` applies the following validation chain. All checks are against **persisted usage_records evidence** — the frontend-supplied confirmation is an assertion, not a source of truth.

| # | Check | Rejection reason |
|---|-------|-----------------|
| 1 | execution record exists in `usage_records` | `record_not_found` |
| 2 | `executionStatus === 'completed'` | `status_<value>` |
| 3 | `metadata.aiExecutionResult` exists and is a non-null object | `missing_ai_execution_result` |
| 4 | `executionIntent === 'workspace_mutation'` | `intent_not_workspace_mutation` |
| 5 | `metadata.aiExecutionResult.fileActions` is an array | `missing_file_actions` |
| 6 | `fileActions.length > 0` | `zero_file_actions` |
| 7 | confirmation struct is valid (all fields present, correct types, integers >= 0) | `confirmation_invalid` |
| 8 | `confirmation.applyStatus === 'applied'` | `apply_status_not_applied` |
| 9 | `confirmation.totalActions === fileActions.length` (persisted count) | `total_actions_mismatch` |
| 10 | `confirmation.successCount === confirmation.totalActions` | `partial_apply` |

Any failed check returns `{ triggered: false, reason: '<value>' }` with no deduction.

Only after all 10 checks pass: `emitDeductionAttempt(record)` is called → `PersistentCreditDeductionGateway.applyDeduction()`.

---

## 9. Internal Authentication

The `confirm-build-apply` endpoint is protected by the **global `InternalServiceAuthGuard`**, the same guard protecting `finalize-accounting`. Authentication requires the `X-Internal-Service-Key` header. No change to internal auth behavior was introduced. No public or user-session auth path was added. The browser cannot safely call this endpoint because it cannot possess the `X-Internal-Service-Key`.

This is why the endpoint is classified as internal-only and why 03D-B (frontend proxy integration) is required for the complete product flow.

---

## 10. Idempotency

No new idempotency mechanism was introduced. The existing mechanism is reused:

- `credit_deduction_records.source_event_id = executionId` — UNIQUE constraint
- Whether deduction is triggered via Ask's `triggerDeductionForExecution()` or Build's `triggerBuildApplyDeduction()`, the `sourceEventId` is the same `executionId`
- Duplicate confirm-apply calls: `PersistentCreditDeductionGateway.applyDeduction()` returns `skippedDuplicate: true` — safe no-op
- Concurrent duplicate calls: `FOR UPDATE` pessimistic lock on `credit_balances` in `PersistentCreditDeductionGateway` serializes balance mutations; UNIQUE constraint catches any race

No refund records, no second accounting ledger, no new idempotency table, no new balance mechanism introduced.

---

## 11. Legacy / Missing executionIntent Behavior

`triggerDeductionForExecution()` deliberately preserves backward compatibility for historical records:

- `executionIntent === 'conversation'` → immediate deduction (standard Ask path)
- `executionIntent === 'workspace_mutation'` → deferred (`build_awaiting_apply`)
- `executionIntent` **missing, absent, or unknown** (legacy records before BUILDER-INTENT-01) → **proceeds to `emitDeductionAttempt()`** (immediate deduction)

The safe default for legacy/missing intent is **charge** (conservative). This prevents silent billing gaps for pre-existing completed records whose intent was not explicitly recorded. These records are NOT silently treated as `workspace_mutation`.

This behavior is implemented in `readPersistedExecutionIntent()` which returns `undefined` when the field is absent — and in `triggerDeductionForExecution()` which only gate-skips when the returned value is `'workspace_mutation'`.

---

## 12. No-Confirmation Policy

If the `POST confirm-build-apply` endpoint is never called for a completed Build execution:
- **No deduction occurs**
- There is no timeout after which a deduction fires
- There is no reconciliation auto-charge
- There is no silence-based watchdog deduction

This means: if the browser closes, the network drops, or the apply-result call never arrives — the Build is **not charged**.

This is intentional under 03D policy. The possible under-charge is preferable to charging an unproven or failed Build.

---

## 13. No Reconciliation / Refund / Migration

03D-A explicitly excludes:

- Reconciliation auto-deduction (originally contemplated in Stage Start Section 19 — excluded from 03D final policy)
- Refund/reversal mechanism (no refund records, no reversal code)
- Database schema migration (no new columns, no new tables — `executionIntent` and `fileActions[]` already durably present in `usage_records.metadata.aiExecutionResult` JSONB from worker completion write)
- New idempotency persistence
- New accounting ledger

These exclusions are intentional and are not gaps — they are the selected policy.

---

## 14. Exact Production Files

| File | Change |
|------|--------|
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Added `BuildApplyConfirmation` interface; added `triggerBuildApplyDeduction()` method; added `readAiExecutionResult()`, `readPersistedExecutionIntent()`, `isStructurallyValidConfirmation()` private helpers; modified `triggerDeductionForExecution()` to include intent-conditional gate |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` | Added `POST :executionId/confirm-build-apply` endpoint calling `triggerBuildApplyDeduction()`; updated class JSDoc |
| `services/api-gateway/src/ai/dto/confirm-build-apply.dto.ts` | New file — `ConfirmBuildApplyDto` with class-validator decorators (`IsString`, `IsNotEmpty`, `IsInt`, `Min`, `Type`) |

**No frontend production changes.**
**No AI Service / Worker production changes.**
**No schema migration.**

---

## 15. Test Files

| File | Change |
|------|--------|
| `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | Added tests for intent gate, Build awaiting-apply, confirm-apply deduction trigger, all rejection reasons, duplicate/concurrent idempotency |
| `services/api-gateway/src/ai/__tests__/internal-accounting.controller.spec.ts` | Added tests for confirm-build-apply endpoint: valid confirmation, invalid key, wrong intent, missing result, zero actions, partial apply, malformed DTO |
| `services/api-gateway/src/ai/dto/confirm-build-apply.dto.spec.ts` | New file — DTO validation tests |

---

## 16. Validation Results

### Targeted: 03D-A direct suites

**3 suites PASS — 107 tests PASS**

Coverage includes:

- Ask immediate deduction (`conversation` intent → `emitDeductionAttempt()` called)
- Build awaiting apply (`workspace_mutation` intent → `{ triggered: false, reason: 'build_awaiting_apply' }`)
- Full-success confirmation → deduction triggered
- Wrong intent (`conversation` sent to confirm-apply → rejected)
- Missing `aiExecutionResult` → rejected
- Zero file actions → rejected
- Malformed / non-array `fileActions` → rejected
- Total action count mismatch (frontend `totalActions` ≠ persisted `fileActions.length`) → rejected
- `successCount < totalActions` (partial apply) → rejected
- `applyStatus = 'skipped'` / `'failed'` → rejected
- `executionStatus` failed / timeout / cancelled → rejected
- Missing / legacy / unknown `executionIntent` → charge (safe default)
- Duplicate / concurrent `sourceEventId` → exactly-once deduction
- Internal auth (`X-Internal-Service-Key`) validation
- DTO validation (missing fields, wrong types)

---

## 17. Broader Unrelated Failures (Pre-Existing)

### Directly relevant regression: 7 suites PASS — 134 tests PASS

Includes: credit gateway unit, orphan worker, AI controller, provider-model catalogue.

### Broader safe/offline API Gateway: 155 suites PASS — 6 suites FAIL

**1987 / 2048 tests passed.**

The 6 failing suites were assessed as pre-existing and unrelated to 03D-A:

| Failing suite | Nature |
|---------------|--------|
| `CreditBalanceGuard` DI | Pre-existing DI test setup issue |
| `Users/PlanRepository` DI | Pre-existing DI test setup issue |
| `AuthService DataSource` DI | Pre-existing DI test setup issue |
| `ai-execution.get-execution-file-actions.spec.ts` | Stale `AIExecutionController` constructor arity — pre-existing |
| Other affected suites from above arity mismatch | Cascade from above |

**None of these failures are 03D-A regressions.** They were present before 03D-A implementation and are not caused by any 03D-A change.

These failures must NOT be repaired during 03D-A consolidation. They should be recorded for separate triage.

---

## 18. Intentionally Skipped Integration Tests

The following integration/concurrency tests require live infrastructure (Docker, PostgreSQL, Redis) that was not started for this implementation window. They were not run and their results are not claimed:

| Test file | Infrastructure requirement |
|-----------|--------------------------|
| `smoke.integration.spec.ts` | Postgres + Redis |
| `ai-execution-two-phase.integration.spec.ts` | Postgres + Redis |
| `ai-execution-deterministic-replay.integration.spec.ts` | Postgres + Redis |
| `ai-execution-orphan-reconciliation.integration.spec.ts` | Postgres + Redis |
| `ai-execution-replay-quota-bypass.integration.spec.ts` | Postgres + Redis |
| `credit-deduction-concurrency.integration.spec.ts` | Live Postgres + `RUN_CREDIT_DB_INTEGRATION=true` |

The concurrency integration test specifically requires `RUN_CREDIT_DB_INTEGRATION=true` and a live Postgres database. It was not run and its results are not claimed.

---

## 19. API Gateway Build

**API Gateway `npm run build`: PASS**

Build verified clean after implementation. No TypeScript compilation errors. No new type errors introduced.

---

## 20. Provider / Balance Safety

| Safety item | Value |
|-------------|-------|
| Provider calls | **0** |
| Real balance mutations | **0** |
| Credits granted | **0** |
| Credits refunded | **0** |
| Migration run | NO |
| Staging / runtime work | NO |
| PM2 restarted | NO |
| `.env` modified | NO |
| Docker / Postgres / Redis started | NO |
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |

All tests used mocked `CreditDeductionGateway`. No live database connections. No live provider calls.

---

## 21. Intermediate-State Limitation

**03D-A ALONE IS NOT THE COMPLETED PRODUCT FLOW.**

The `confirm-build-apply` endpoint is protected by `X-Internal-Service-Key`. The browser cannot safely possess this key. Therefore:

- **Ask accounting**: fully functional (unchanged immediate deduction)
- **Build AI completion**: correctly gated (no deduction at completion)
- **Normal product Build**: does not yet send a `confirm-build-apply` confirmation
- **Result**: Build deduction remains pending/no-charge until 03D-B is implemented

**03D-A must NOT be treated as a deployable final private-beta accounting solution by itself.**

03D-B must provide the authenticated frontend/proxy integration that calls this endpoint after a successful full workspace apply. Only after both 03D-A and 03D-B are complete does the full Build accounting flow function end-to-end.

---

## 22. Dormant Legacy Path Assessment

### `updateExecutionResult()` — assessed as DORMANT / NON-LIVE

**Evidence:**

1. `updateExecutionResult()` is defined in `usage-ledger.service.ts` and marked `@deprecated` with the note: "Use two-phase write pattern: `writeExecutionIntent()` + `updateExecutionResult()`"
2. `updateExecutionResult()` is **NOT called from any production source file** in the API Gateway. The only callers found were: test files (`usage-ledger.service.spec.ts`, `ai-execution-two-phase.integration.spec.ts`) calling it directly or spying on it; and a comment in `credit-deduction.module.ts`.
3. The live Worker path is: `notifyExecutionComplete(executionId)` → `POST /api/internal/executions/:id/finalize-accounting` → `InternalAccountingController.finalizeAccounting()` → `triggerDeductionForExecution()`. This path does NOT invoke `updateExecutionResult()`.
4. `ai-execution.controller.ts` (production) calls only `writeExecutionIntent()`, `reuseExecutionIntent()`, and `findByRequestId()` — not `updateExecutionResult()`.

**Conclusion:** `updateExecutionResult()` has historical immediate-charge behavior (line 305: `await this.emitDeductionAttempt(updatedRecord)`) but this code is unreachable in the current production execution path. It is a **dormant legacy method** — non-live, not on the hot path, not a blocker.

**Action:** None required during 03D-A consolidation. Do NOT modify `updateExecutionResult()`. Record as a known dormant legacy cleanup concern for a future task.

---

## 23. Remaining Risks

| Risk | Severity | Status |
|------|----------|--------|
| Browser tab close / network loss after apply but before confirm-build-apply | LOW-MEDIUM | Intentional under-charge per 03D policy — no reconciliation authorized |
| `updateExecutionResult()` dormant legacy path with immediate-charge behavior | LOW | Dormant — not reachable in live path. Future cleanup concern. |
| 6 pre-existing unrelated test suite failures | LOW | Pre-existing; not 03D-A regressions; require separate triage |
| `credit-deduction-concurrency.integration.spec.ts` not run | LOW | Requires live Postgres; not applicable in offline test run |
| 03D-B not yet implemented | MEDIUM | Browser Build charging remains pending until 03D-B |
| `GLOBAL_EXECUTION_ENABLED=false` — harness not live | N/A | Preserved; no live execution during this window |

---

## 24. Dependency on 03D-B

03D-B (Frontend Apply-Result Integration + Validation) depends on 03D-A being complete and consolidated. 03D-B will:

- After a successful `applySequentialFileActions()` returning `applyStatus: 'applied'` with full success
- Call `POST /api/internal/executions/:executionId/confirm-build-apply` (via an authenticated proxy, NOT directly from the browser with the internal service key)
- Pass `{ applyStatus, totalActions, successCount }` derived from the apply result

Only after 03D-B is registered and implemented will the full Build accounting flow be functional end-to-end in the product.

---

## 25. Next Recommended Task

**PRIVATE-BETA-BLOCKER-03D-B — Frontend Apply-Result Integration + Validation**

Scope: Frontend + integration validation
Dependencies: 03D-A COMPLETE AND LOCKED (this checkpoint)
Changes required: Confirm-apply call after successful `applySequentialFileActions()`, authenticated proxy integration (so the browser does not directly use `X-Internal-Service-Key`), helper utility, integration-level tests
Risk: LOW — one additional call after existing apply flow

**03D-B remains NOT REGISTERED.** Registration occurs at the next authorized window.

After 03D-B is completed and locked, parent PRIVATE-BETA-BLOCKER-03D can proceed toward final Step 4 consolidation/checkpoint.

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Source files modified (production) | NONE during consolidation |
| Tests modified | NONE during consolidation |
| `.env` modified | NO |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| CLAUDE.md modified | NO |
| 03C changes | NO |
| 03D-B registered | NO |
| Balance mutation | NO |
| Credits granted/refunded | NO |
| Migration run | NO |
| Stripe/payment work | NO |
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |

---

*Checkpoint created: 2026-08-14 — PRIVATE-BETA-BLOCKER-03D-A Step 3 — governance/consolidation only — no source/runtime mutation.*
