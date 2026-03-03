# PHASE-43C-UNIT-STABILIZATION-CHECKPOINT

**Date:** 2026-03-03
**Service:** api-gateway (NestJS)
**Phase:** 43C-1 Structured Telemetry Instrumentation — Unit Layer Stabilization
**Status:** LOCKED

---

## 1. Scope of Stabilization

### Context

This stabilization was triggered by a machine migration. On the new developer machine, Jest picked up a local `.env` file at module load time, causing environment variables (`GLOBAL_EXECUTION_ENABLED`, `AI_PROVIDER`) to contaminate the test process. This caused 78 test failures across 14 suites on first run.

No production code semantics were changed during this stabilization. All changes are confined to spec files.

### Areas Addressed

**Environment Isolation**
- `execution-safety.guard.spec.ts`: `GLOBAL_EXECUTION_EXECUTION_ENABLED` env var was being read as `false` from `.env` by the `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` static getter. Fixed by setting `process.env.GLOBAL_EXECUTION_ENABLED = 'true'` in `beforeEach` and restoring in `afterEach`.
- `jest.clearAllMocks()` replaced with `jest.restoreAllMocks()` to ensure getter spies set in individual tests do not bleed into subsequent tests.

**EnvironmentValidator Spec Alignment (Phase 43B-4)**
- `environment.validator.spec.ts`: The validator was updated in Phase 43B-4 to allow `NODE_ENV=test` during Jest execution (when `JEST_WORKER_ID` is set). The spec still contained a test asserting `NODE_ENV=test` should throw. Updated to reflect actual validator contract: two tests now cover (a) allowed during Jest, (b) rejected outside Jest.

**Controller DI Guard Coverage**
- `ai-execution.controller.spec.ts`: `TokenQuotaGuard` was added to the controller's guard stack after the spec was written. The spec did not override it, causing `Nest can't resolve dependencies of the TokenQuotaGuard (DataSource at index [0])`. Fixed by adding `.overrideGuard(TokenQuotaGuard).useValue(mockGuard)`.

**UsageLedgerService Mock Contract (Two-Phase Execution)**
- `ai-execution.controller.spec.ts`: The controller was updated to the two-phase execution pattern (`writeExecutionIntent`, `updateExecutionResult`, `findByRequestId`, `reuseExecutionIntent`). The spec mock still reflected the old single-phase contract (`writeRecord`, `validateUsageRecord`). Mock updated to match current service interface.

**QuotaService Constructor DI**
- `quota.service.spec.ts` and `quota.guard.spec.ts`: `QuotaService` constructor was updated to require two `@InjectRepository` arguments (`sessionRepository`, `usageRecordRepository`). Both specs instantiated `new QuotaService()` with no arguments. Fixed by providing both mock repositories.

**UsageRecord Entity Evolution**
- `idempotency.guard.spec.ts`: `UsageRecord` entity gained a required `executionStatus: string` field. The test fixture was missing this field, causing a TypeScript compile error. Fixed by adding `executionStatus: 'completed'` to the fixture object.

**IdempotencyGuard Exception Semantics**
- `idempotency.guard.spec.ts`: The guard intentionally throws `IdempotentReplayException` (not returns `true`) when a duplicate request is detected. The spec expected `canActivate()` to return `true`. Updated to `await expect(guard.canActivate(context)).rejects.toThrow(IdempotentReplayException)`. Import added.

**QuotaGuard Deterministic Behavior**
- `quota.guard.spec.ts`: The test `should produce same result for same quota state` assumed two consecutive `canActivate()` calls on `key-1` would both succeed. The guard records token usage on each call; `key-1` has `tokensPerDay: 10000` and `estimateTokens()` returns 8000, so the second call correctly throws. Expectation updated to assert the second call throws `HttpException`.

---

## 2. Root Causes Identified

| # | Root Cause | Affected Spec(s) |
|---|---|---|
| 1 | `GLOBAL_EXECUTION_ENABLED=false` loaded from `.env` by Jest process; `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED` is a live getter, not a cached value; getter spies not torn down between tests (`clearAllMocks` vs `restoreAllMocks`) | `execution-safety.guard.spec.ts` |
| 2 | `EnvironmentValidator` updated in Phase 43B-4 to permit `NODE_ENV=test` under Jest; spec not updated to match | `environment.validator.spec.ts` |
| 3 | `TokenQuotaGuard` added to controller guard stack after spec was written; spec did not override it; NestJS DI attempted to resolve `DataSource` | `ai-execution.controller.spec.ts` |
| 4 | Controller migrated to two-phase execution pattern; spec mock reflected old single-phase `UsageLedgerService` interface | `ai-execution.controller.spec.ts` |
| 5 | `QuotaService` constructor gained two `@InjectRepository` parameters; specs called `new QuotaService()` with zero arguments | `quota.service.spec.ts`, `quota.guard.spec.ts` |
| 6 | `UsageRecord` entity gained required `executionStatus` field; test fixture did not include it; TypeScript compile error at test boundary | `idempotency.guard.spec.ts` |
| 7 | `IdempotencyGuard` throws `IdempotentReplayException` on replay (intentional guard pipeline termination); spec expected `return true` | `idempotency.guard.spec.ts` |
| 8 | `QuotaGuard` records token usage on every `canActivate()` call; test assumed stateless behavior across two consecutive calls | `quota.guard.spec.ts` |

---

## 3. What Was NOT Changed

- No production source files were modified
- No business logic was altered
- No guard execution order was changed
- No exception types were changed
- No entity schemas were changed
- No NestJS module configuration was changed
- No architectural patterns were modified
- No telemetry instrumentation added in Phase 43C-1 was removed or altered
- No integration test files were modified

---

## 4. Final Verified State

```
Test Suites: 35 passed, 35 total
Tests:       559 passed, 559 total
Snapshots:   0 total
```

**Integration tier excluded intentionally.** Integration specs (`*.integration.spec.ts`, `smoke.integration.spec.ts`) require live PostgreSQL and a configured AI provider. They are not part of the unit layer and are not included in this count.

**Logger noise confirmed non-blocking.** Structured JSON telemetry output from `IdempotencyGuard`, `AIExecutionController`, and `UsageLedgerService` appears in test stdout as expected. This is correct behavior — telemetry is emitted to the NestJS logger, not to test assertions. No tests assert on log output.

---

## 5. Locked Guarantees After This Checkpoint

| Guarantee | Detail |
|---|---|
| Unit isolation restored | No test relies on `.env` file values; all kill switch env vars are explicitly set in `beforeEach` and restored in `afterEach` |
| Guard ordering deterministic | `ExecutionSafetyGuard` check order (global kill switch → provider kill switch → safety limits → record) is verified by dedicated ordering tests, all passing |
| Two-phase execution fully test-aligned | Controller spec mock matches current `UsageLedgerService` interface: `findByRequestId`, `reuseExecutionIntent`, `writeExecutionIntent`, `updateExecutionResult` |
| `NODE_ENV=test` allowed under Jest only | `EnvironmentValidator` spec covers both branches: allowed when `JEST_WORKER_ID` is set, rejected when it is not |
| All DI contracts reflected in specs | `TokenQuotaGuard`, `QuotaService(sessionRepo, usageRecordRepo)`, and `UsageLedgerService` interfaces are all correctly represented in their respective specs |
| `IdempotentReplayException` semantics locked | Replay path throws `IdempotentReplayException`; spec asserts `rejects.toThrow(IdempotentReplayException)`; filter layer handles HTTP 200 response |
| `QuotaGuard` stateful behavior documented | Guard records usage on every `canActivate()` call; deterministic behavior test reflects this correctly |

---

## Files Modified During Stabilization

| File | Change Type |
|---|---|
| `src/safety/execution-safety.guard.spec.ts` | Env isolation (`beforeEach`/`afterEach`), `restoreAllMocks` |
| `src/startup/environment.validator.spec.ts` | Phase 43B-4 contract alignment (two new tests) |
| `src/ai/ai-execution.controller.spec.ts` | `TokenQuotaGuard` override, `UsageLedgerService` mock update |
| `src/quota/__tests__/quota.service.spec.ts` | `QuotaService` constructor arguments |
| `src/quota/__tests__/quota.guard.spec.ts` | `QuotaService` constructor arguments, deterministic behavior assertion |
| `src/ai/idempotency.guard.spec.ts` | `executionStatus` fixture field, `IdempotentReplayException` import and assertion |

**Total production files modified: 0**

---

*Phase 43C unit layer is considered locked as of this checkpoint.*
