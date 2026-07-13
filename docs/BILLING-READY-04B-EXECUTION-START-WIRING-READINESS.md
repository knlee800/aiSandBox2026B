# BILLING-READY-04B — Execution-Start Wiring Readiness / Gap Review

**Task ID:** BILLING-READY-04B
**Step:** 2 of 4 (Execution-Start Wiring Readiness / Gap Review)
**Status:** COMPLETE
**Date:** 2026-07-13
**Nature:** Static readiness/gap review only. No implementation. No tests. No runtime.
**Parent:** BILLING-READY-04 (ACTIVE — Step 3 IN PROGRESS — child-slice split)

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-04B ACTIVE — Step 1 COMPLETE (Registration 2026-07-13) | CONFIRMED |
| BILLING-READY-04 ACTIVE — Step 3 IN PROGRESS (child-slice split) | CONFIRMED |
| BILLING-READY-04A COMPLETE and LOCKED (2026-07-13) | CONFIRMED |
| BILLING-READY-04C/04D planned only, not registered | CONFIRMED |
| BILLING-READY-03 COMPLETE and LOCKED (all 7 child slices) | CONFIRMED |
| AGENT-PLATFORM-07F COMPLETE and LOCKED (all 3 child slices) | CONFIRMED |
| AGENT-HARNESS-07 COMPLETE and LOCKED (all 3 child slices) | CONFIRMED |
| AGENT-HARNESS-06E COMPLETE and LOCKED | CONFIRMED |
| One-active-task rule satisfied (only BILLING-READY-04/04B ACTIVE) | CONFIRMED |

**Governance readiness: PASS.**

---

## 2. 04A Foundation Summary

### CreditBalanceGuard Behavior (Implemented in 04A)

| Behavior | Detail |
|----------|--------|
| Location | `services/api-gateway/src/billing/credit-balance.guard.ts` |
| Class | `CreditBalanceGuard implements CanActivate` |
| Dependencies | `CreditBalanceRepository` (via `CreditPersistenceModule`), `Repository<User>` (via `TypeOrmModule.forFeature([User])`) |
| Identity source | `request.apiKeyIdentity.userId` |
| Balance lookup | `CreditBalanceRepository.findByOwner(userId, 'user')` — non-locking read |
| Admin bypass | `user.role === UserRole.ADMIN` via `Repository<User>.findOne()` — `Promise.all` parallelizes both queries |
| Missing balance (null) | Rejects — HTTP 402, `error_code: credit_balance_not_provisioned` |
| Zero/negative balance | Rejects — HTTP 402, `error_code: credit_balance_exhausted`, includes `current_balance` |
| Positive balance | Allows — `return true` |
| Read-only | No deduction, no locking, no mutation |
| No external calls | No Stripe/payment/provider APIs |

### Module Wiring (Completed in 04A)

| Module | State |
|--------|-------|
| `CreditBalanceGuardModule` | Created — imports `CreditPersistenceModule` + `TypeOrmModule.forFeature([User])`, provides/exports `CreditBalanceGuard` |
| `AIModule` | Modified — imports `CreditBalanceGuardModule` |
| `PublicApiModule` | Modified — imports `CreditBalanceGuardModule` |

### Guard Wiring (Completed in 04A)

| Controller | Endpoint | Guard Position | Status |
|------------|----------|----------------|--------|
| `ai-execution.controller.ts` | `POST /api/ai/execute` | After `IdempotencyGuard`, before `QuotaGuard` | WIRED |
| `public-ai.controller.ts` | `POST /v1/ai/execute` | After `IdempotencyGuard`, before `QuotaGuard` | WIRED |

### 04A Validation Results

| Command | Result |
|---------|--------|
| Guard unit tests (`credit-balance.guard.spec.ts`) | 24/24 PASS |
| Controller unit tests (`ai-execution.controller.spec.ts`) | 68/68 PASS |
| Controller integration tests (`ai-execution.controller.integration.spec.ts`) | 30/30 PASS |
| Guard integration tests (`ai-execution-guards.integration.spec.ts`) | 31/31 PASS |
| Public API tests (`public-ai.controller.spec.ts`) | 3/3 PASS |
| TypeScript | PASS — exit 0 |

### Known Follow-Up Constraints from 04A

1. Existing controller tests override `CreditBalanceGuard` with `{ canActivate: () => true }` — they do NOT prove real guard behavior at execution-start boundary.
2. Integration spec `ai-execution-guards.integration.spec.ts` tests `LaunchGuard`, `AbortGuard`, `ExecutionSafetyGuard`, `QuotaGuard` in isolation — does NOT test `CreditBalanceGuard`.
3. Public API controller test (`public-ai.controller.spec.ts`) instantiates controller directly, bypassing guard chain entirely.
4. No existing test proves that a 402 rejection from `CreditBalanceGuard` prevents `QueueService.enqueueExecution()` from being called.
5. No existing test proves the exact guard execution order includes `CreditBalanceGuard` in the correct position.

---

## 3. Execution-Start Entry-Point Coverage

### Confirmed Protected Paths

| # | Controller | File | Endpoint | Guard Chain Includes CreditBalanceGuard | Verified |
|---|------------|------|----------|----------------------------------------|----------|
| 1 | `AIExecutionController` | `services/api-gateway/src/ai/ai-execution.controller.ts` | `POST /api/ai/execute` | YES — position 7 of 10 (after `IdempotencyGuard`, before `QuotaGuard`) | Line 383 |
| 2 | `PublicAIController` | `services/api-gateway/src/public-api/public-ai.controller.ts` | `POST /v1/ai/execute` | YES — position 6 of 8 method-level (after `IdempotencyGuard`, before `QuotaGuard`); class-level `ApiKeyAuthGuard` + `PublicApiRateLimitGuard` run first | Lines 49, 75-84 |

### Other `enqueueExecution` Call Sites (Not Controller-Guarded)

| # | Caller | File | Guard Chain? | In 04B Scope? |
|---|--------|------|-------------|---------------|
| 3 | `OrchestrationService.startReferralExecution()` | `services/api-gateway/src/orchestration/orchestration.service.ts` | NO — service-level call, bypasses HTTP guard chain | NO — by design, referral executions are downstream of an already-gated initiating request. Balance enforcement for referral/collaboration runs is deferred to future orchestration billing slice. |

### Conclusion

All HTTP execution-start entry points are protected. The orchestration referral path bypasses the guard chain by design — it is a service-to-service call, not a new user-initiated request. No additional execution-start paths exist.

---

## 4. Guard-Chain Decision

### `ai-execution.controller.ts` — `POST /api/ai/execute` (line 383)

Exact current order (confirmed via source read):

```
1. SessionOrApiKeyAuthGuard   (class: at method-level @UseGuards)
2. AuthorizationGuard
3. ExecutionSafetyGuard
4. LaunchGuard
5. AbortGuard
6. IdempotencyGuard
7. CreditBalanceGuard          ← 04A insertion point
8. QuotaGuard
9. TokenQuotaGuard
10. RateLimitGuard
```

### `public-ai.controller.ts` — `POST /v1/ai/execute` (lines 49 + 75-84)

Class-level guards (line 49): `ApiKeyAuthGuard`, `PublicApiRateLimitGuard`
Method-level guards (lines 75-84):

```
1. [class] ApiKeyAuthGuard
2. [class] PublicApiRateLimitGuard
3. AuthorizationGuard
4. ExecutionSafetyGuard
5. LaunchGuard
6. AbortGuard
7. IdempotencyGuard
8. CreditBalanceGuard           ← 04A insertion point
9. QuotaGuard
10. TokenQuotaGuard
```

### Controller-Level/Class-Level Guard Interaction

- `AIExecutionController` has no class-level `@UseGuards()` — all guards are method-level on `execute()`.
- `PublicAIController` has class-level `@UseGuards(ApiKeyAuthGuard, PublicApiRateLimitGuard)` (line 49). NestJS executes class-level guards before method-level guards. This means `ApiKeyAuthGuard` and `PublicApiRateLimitGuard` run first, then the method-level chain starting with `AuthorizationGuard`.
- `CreditBalanceGuard` position is consistent: after `IdempotencyGuard`, before `QuotaGuard` in both controllers.

### Position Rationale (from 04A readiness review, confirmed)

- After `IdempotencyGuard`: Replays short-circuit before balance check — replays don't consume credits.
- Before `QuotaGuard`: Balance exhaustion should reject before quota accounting runs — prevents quota state mutation for rejected requests.
- Before `TokenQuotaGuard`: Same rationale — don't acquire advisory lock for a rejected request.

**Guard-chain decision: CONFIRMED. Order is correct. No changes needed.**

---

## 5. Queue Enqueue / No-Enqueue Assertion Plan

### Required Assertions

| # | Scenario | Expected Behavior | Assertion |
|---|----------|-------------------|-----------|
| 1 | Sufficient balance (balance > 0) | Guard allows → controller calls `QueueService.enqueueExecution()` | `enqueueExecution` called exactly 1 time; response status `'queued'` |
| 2 | Admin bypass (role=ADMIN, any/no balance) | Guard allows → controller calls `QueueService.enqueueExecution()` | `enqueueExecution` called exactly 1 time; response status `'queued'` |
| 3 | Missing balance (null row) | Guard throws 402 → controller never reached → `QueueService.enqueueExecution()` NOT called | `enqueueExecution` NOT called; HTTP 402; `error_code: credit_balance_not_provisioned` |
| 4 | Zero balance (balance === 0) | Guard throws 402 → `enqueueExecution()` NOT called | `enqueueExecution` NOT called; HTTP 402; `error_code: credit_balance_exhausted` |
| 5 | Negative balance (balance < 0) | Guard throws 402 → `enqueueExecution()` NOT called | `enqueueExecution` NOT called; HTTP 402; `error_code: credit_balance_exhausted` |
| 6 | 402 occurs before queue submission | Guard rejects pre-enqueue; no ledger intent written | `writeExecutionIntent` NOT called; `enqueueExecution` NOT called |

### Key Insight

Currently, NO existing test proves assertions 3-6. All existing controller tests override `CreditBalanceGuard` with `{ canActivate: () => true }`, so the real guard never rejects and `enqueueExecution` is always called. This is the primary gap 04B must close.

---

## 6. Existing Test Gap Review

### What 04A Already Covers

| Coverage Area | Test File | What It Proves |
|---------------|-----------|----------------|
| Guard unit logic — all balance states | `credit-balance.guard.spec.ts` (24 tests) | `canActivate()` returns/throws correctly for: positive balance, zero balance, negative balance, missing balance, admin bypass, beta non-bypass, missing identity, structured 402 body, read-only repository pattern |
| Guard does not lock or mutate | Same file | `findByOwnerForUpdate` NOT called, `deductBalance` NOT called |
| Guard uses correct identity shape | Same file | `apiKeyIdentity.userId` extracted, passed to `findByOwner(userId, 'user')` |
| Controller unit tests pass with mocked guard | `ai-execution.controller.spec.ts` (68 tests) | Controller business logic correct when guard is bypassed — identity injection, queue enqueue, metadata propagation, idempotency, harness entitlement, session ownership |
| Controller integration tests pass with mocked guard | `ai-execution.controller.integration.spec.ts` (30 tests) | Integration-level controller behavior — intent-before-enqueue ordering, quota backward compatibility |
| Guard metadata on non-execute methods | `ai-execution-guards.integration.spec.ts` (31 tests) | `cancelExecution`, `getExecution`, `streamExecution` have `SessionOrApiKeyAuthGuard`. Launch/abort/safety guard behavior in isolation. |
| Public API controller basic path | `public-ai.controller.spec.ts` (3 tests) | Public controller queues execution, returns execution result, enforces user isolation — guard chain bypassed (direct instantiation) |

### What 04B Must Still Cover (Gaps)

| # | Gap | Why It Matters | Required Test Type |
|---|-----|---------------|--------------------|
| G1 | **Guard order assertion** — no test verifies `CreditBalanceGuard` is in the `@UseGuards()` decorator at the correct position | If someone removes or reorders the guard, no test catches it | Reflector metadata assertion (unit-level, no runtime) |
| G2 | **Real CreditBalanceGuard at execution-start boundary** — all controller tests override the guard | Does not prove the guard actually blocks execution and prevents enqueue | Integration test with real `CreditBalanceGuard`, mocked repository dependencies |
| G3 | **Sufficient balance reaches enqueue** | Proves the happy path through a real guard, not a mocked one | Integration test: real guard + mocked repos → `enqueueExecution` called |
| G4 | **Admin bypass reaches enqueue** | Proves admin bypass works end-to-end through the real guard | Integration test: admin role in mock user repo → `enqueueExecution` called |
| G5 | **Missing balance prevents enqueue** | Proves 402 rejection actually prevents queue submission | Integration test: `findByOwner` returns null → `enqueueExecution` NOT called, HTTP 402 |
| G6 | **Zero balance prevents enqueue** | Proves zero balance blocks | Integration test: balance=0 → `enqueueExecution` NOT called, HTTP 402 |
| G7 | **Negative balance prevents enqueue** | Proves negative balance blocks (defense in depth — DB CHECK should prevent, but guard also checks) | Integration test: balance=-5 → `enqueueExecution` NOT called, HTTP 402 |
| G8 | **Public API execution path parity** | Proves public API has the same guard behavior as main API | Guard metadata assertion on `PublicAIController.execute` |

### Whether Current Tests Only Override the Guard

**YES — confirmed.** All controller test files override `CreditBalanceGuard`:

- `ai-execution.controller.spec.ts`: 5 `describe` blocks, each uses `.overrideGuard(CreditBalanceGuard).useValue(mockGuard)` where `mockGuard = { canActivate: () => true }`.
- `ai-execution.controller.integration.spec.ts`: `.overrideGuard(CreditBalanceGuard).useValue(mockGuardValue)` where `mockGuardValue = { canActivate: () => true }`.
- `public-ai.controller.spec.ts`: Direct instantiation — no NestJS test module, no guard chain at all.

**This means NO existing test proves that `CreditBalanceGuard` rejection prevents `enqueueExecution()` from being called at the execution-start boundary.**

### Whether New Integration Tests Should Use Real CreditBalanceGuard

**YES.** New 04B integration tests should:
1. Use a real `CreditBalanceGuard` instance (not overridden).
2. Mock `CreditBalanceRepository` and `Repository<User>` with controlled return values.
3. Mock `QueueService` and `UsageLedgerService` to verify call/no-call.
4. Override all OTHER guards with `{ canActivate: () => true }` to isolate the CreditBalanceGuard behavior.

This pattern proves the guard is actually in the chain and its rejection prevents downstream effects.

---

## 7. Implementation vs Validation-Only Decision

### Decision: A — 04B is validation-only (add targeted tests only)

**Rationale:**

1. **All production wiring is complete.** 04A created `CreditBalanceGuard`, `CreditBalanceGuardModule`, and wired the guard into both controllers and both modules. No production source changes are needed.

2. **The gap is test coverage, not implementation.** The missing piece is integration tests that prove the real guard blocks enqueue. This is pure test work.

3. **No new production files need creation.** The guard, module, and controller wiring are all complete and validated by TypeScript, unit tests, and existing integration tests (with mocked guard).

4. **No migration, no frontend, no Stripe, no worker changes.** Same constraints as 04A.

5. **Guard metadata reflection tests are test-only.** Asserting `CreditBalanceGuard` is in the `@UseGuards()` metadata for both controllers is a test concern, not a production change.

**04B scope is: targeted integration tests that exercise real `CreditBalanceGuard` at the execution-start boundary with mocked repository dependencies.**

---

## 8. Exact Step 3 File Boundary

### Files to Create (Step 3)

| # | File | Type | Description |
|---|------|------|-------------|
| 1 | `services/api-gateway/src/billing/__tests__/credit-balance-guard-execution-start.integration.spec.ts` | Test | Integration tests: real CreditBalanceGuard at execution-start boundary, mocked repos, enqueue/no-enqueue assertions, guard order metadata assertions |

### Files to Modify (Step 3)

None. No production files, no existing test files.

### Files NOT Changed

- No production source files (`*.ts` outside `__tests__`)
- No `credit-balance.guard.ts`
- No `credit-balance-guard.module.ts`
- No `ai-execution.controller.ts`
- No `public-ai.controller.ts`
- No module files
- No migration files
- No entity files
- No frontend files
- No `.env` files
- No `docker-compose.yml`
- No `package.json`
- No existing test files

---

## 9. Test Plan

### Test File

```
services/api-gateway/src/billing/__tests__/credit-balance-guard-execution-start.integration.spec.ts
```

### Test Cases

| # | Test Case | Type | Expected Outcome |
|---|-----------|------|------------------|
| T1 | **Guard order — main controller** — `CreditBalanceGuard` present in `AIExecutionController.execute` `@UseGuards` metadata at correct position (after `IdempotencyGuard`, before `QuotaGuard`) | Metadata reflection | `GUARDS_METADATA` array contains `CreditBalanceGuard` at index 6 (0-based), preceded by `IdempotencyGuard` and followed by `QuotaGuard` |
| T2 | **Guard order — public controller** — `CreditBalanceGuard` present in `PublicAIController.execute` `@UseGuards` metadata at correct position | Metadata reflection | Method-level `GUARDS_METADATA` array contains `CreditBalanceGuard` after `IdempotencyGuard` and before `QuotaGuard` |
| T3 | **Sufficient balance queues** — real `CreditBalanceGuard` with mocked `findByOwner` returning balance=100, mocked `findOne` returning normal user → controller proceeds → `enqueueExecution()` called | Integration | `canActivate` returns true; `enqueueExecution` called 1 time; response `{ executionId, status: 'queued' }` |
| T4 | **Admin bypass queues** — real `CreditBalanceGuard` with mocked `findOne` returning admin user, `findByOwner` returning null → controller proceeds → `enqueueExecution()` called | Integration | `canActivate` returns true; `enqueueExecution` called 1 time |
| T5 | **Missing balance blocks and does not queue** — real `CreditBalanceGuard` with mocked `findByOwner` returning null, mocked `findOne` returning normal user → guard throws 402 → `enqueueExecution()` NOT called | Integration | `enqueueExecution` NOT called; `writeExecutionIntent` NOT called; HTTP 402; `error_code: credit_balance_not_provisioned` |
| T6 | **Zero balance blocks and does not queue** — real `CreditBalanceGuard` with mocked `findByOwner` returning balance=0 → guard throws 402 → `enqueueExecution()` NOT called | Integration | `enqueueExecution` NOT called; HTTP 402; `error_code: credit_balance_exhausted`; `current_balance: 0` |
| T7 | **Negative balance blocks and does not queue** — real `CreditBalanceGuard` with mocked `findByOwner` returning balance=-5 → guard throws 402 → `enqueueExecution()` NOT called | Integration | `enqueueExecution` NOT called; HTTP 402; `error_code: credit_balance_exhausted` |
| T8 | **Public API guard parity** — `PublicAIController.execute` method-level guard metadata includes same relative CreditBalanceGuard position as main controller | Metadata reflection | CreditBalanceGuard present after IdempotencyGuard, before QuotaGuard |
| T9 | **No Stripe/payment/provider calls in guard execution** — real guard execution only calls `creditBalanceRepository.findByOwner` and `userRepository.findOne` | Integration | No other mock service calls; verify mock call counts |

### Test Architecture

```
NestJS TestingModule:
  - AIExecutionController (real)
  - CreditBalanceGuard (REAL — NOT overridden)
  - CreditBalanceRepository (MOCKED — controlled return values)
  - Repository<User> (MOCKED — controlled return values)
  - QueueService (MOCKED — verify call/no-call)
  - UsageLedgerService (MOCKED — verify call/no-call)
  - All OTHER guards (OVERRIDDEN with { canActivate: () => true })
  - All other services (MOCKED)
```

This architecture:
- Proves real `CreditBalanceGuard` participates in the guard chain.
- Proves rejection by `CreditBalanceGuard` prevents downstream controller execution.
- Isolates `CreditBalanceGuard` from all other guards.
- Does NOT require Docker, PostgreSQL, Redis, or any runtime services.

### Tests NOT Included

- No Stripe/payment/provider calls
- No worker/finalization changes
- No browser smoke
- No frontend/i18n tests
- No migration tests
- No BullMQ job tests
- No live database tests
- No AGENT-HARNESS write canary tests

---

## 10. HTTP Behavior Decision

### 402 Response Body from Guard — Acceptable at Execution-Start Boundary

**Confirmed acceptable.** The `CreditBalanceGuard` HTTP 402 response body is suitable for the execution-start boundary:

**Missing balance:**
```json
{
  "statusCode": 402,
  "error": "Payment Required",
  "message": "Credit balance not provisioned",
  "details": {
    "error_code": "credit_balance_not_provisioned"
  }
}
```

**Exhausted balance:**
```json
{
  "statusCode": 402,
  "error": "Payment Required",
  "message": "Insufficient credit balance",
  "details": {
    "error_code": "credit_balance_exhausted",
    "current_balance": 0
  }
}
```

### Frontend/i18n Status

- **Frontend currently shows generic error for non-200 AI execution responses.** HTTP 402 triggers the same generic error path.
- **No dedicated frontend handling in 04B.** Deferred to BILLING-READY-04C.
- **No i18n keys required in 04B.** When 04C adds user-facing error display, it must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`

---

## 11. Split Decision

### Decision: A — Proceed with one bounded Step 3

**Rationale:**

1. 04B is validation-only — one new test file, no production changes.
2. Total test case count: 9 tests in 1 file (~150-200 lines).
3. No migration, no frontend, no worker, no module changes.
4. All required mock patterns already established in existing test files.
5. Guard metadata reflection pattern already demonstrated in `ai-execution-guards.integration.spec.ts`.
6. No further split needed — this is the smallest meaningful unit of work.

**No child slices proposed.**

---

## 12. Runtime/Provider Safety

| Constraint | Status |
|-----------|--------|
| No Docker/Postgres/Redis required for Step 3 tests | CONFIRMED — all tests use mocked repositories, no real DB |
| No Stripe/payment/provider calls | CONFIRMED — guard reads mocked repos only |
| No AGENT-HARNESS write canary | CONFIRMED — unrelated |
| No browser smoke | CONFIRMED — no UI changes |
| No BullMQ jobs | CONFIRMED — QueueService is mocked |
| No worker/finalization changes | CONFIRMED — no ai-service changes |
| No `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` | CONFIRMED — unrelated |

---

## 13. UX/UI Constraints

- No UI implementation in 04B.
- No frontend translation file changes in 04B.
- When 04C adds user-facing error display, it must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Heroicons v2 Outline only for any future billing icons.
- Impeccable / Emil Kowalski advisory only — no broad redesigns.

---

## 14. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | **False confidence from mocked guard overrides** — all existing tests override `CreditBalanceGuard` so they pass regardless of guard correctness | HIGH (the gap 04B closes) | 04B integration tests use real `CreditBalanceGuard` to close this gap |
| 2 | **Guard order assertion fragility** — if NestJS changes how `@UseGuards()` metadata is stored, reflection-based tests break | LOW | NestJS `GUARDS_METADATA` constant is stable and widely used in the ecosystem. Test uses the same pattern as existing `ai-execution-guards.integration.spec.ts`. |
| 3 | **Public API parity risk** — public API guard chain could diverge from main API | MEDIUM | 04B test T2/T8 verify public API has `CreditBalanceGuard` in the same relative position. Any future divergence will break the test. |
| 4 | **Queue enqueue assertion brittleness** — mocked `QueueService.enqueueExecution` might not accurately represent real BullMQ behavior | LOW | The assertion is about whether `enqueueExecution` is called at all, not about BullMQ behavior. This is the standard test pattern used across the codebase (see all controller specs). |
| 5 | **Over-blocking admin/stub/test flows** — real guard in integration test may block flows that existing mocked tests allow | LOW | Tests explicitly set up admin bypass and positive balance scenarios. Both allow and block paths are tested. |
| 6 | **Future 04C accounting mismatch** — frontend might handle 402 differently than expected | LOW | 402 response body shape is stable and documented. Frontend handling is 04C scope and will reference the 04A/04B documented error codes. |
| 7 | **NestJS guard chain execution order** — class-level vs method-level guard ordering affects `PublicAIController` | LOW | NestJS documentation confirms class-level guards run before method-level guards. `CreditBalanceGuard` is method-level in both controllers. Test T2 verifies the method-level chain. |
| 8 | **Orchestration referral path not gated** — `OrchestrationService.startReferralExecution()` calls `enqueueExecution()` without `CreditBalanceGuard` | LOW (accepted by design) | Referral executions are downstream of an already-gated initiating request. Balance enforcement for referral/collaboration runs is deferred to future orchestration billing slice. Documented in §3 above. |

---

## 15. Step 3 Readiness Conclusion

| Criterion | Result |
|-----------|--------|
| Governance readiness | PASS |
| 04A foundation summary complete | PASS |
| Execution-start entry-point coverage confirmed | PASS — 2 HTTP paths protected, 1 service-level path excluded by design |
| Guard-chain decision confirmed | PASS — correct order in both controllers |
| Queue enqueue/no-enqueue assertion plan defined | PASS — 6 scenarios |
| Existing test gap review complete | PASS — 8 gaps identified, all closeable by integration tests |
| Implementation vs validation-only decision | PASS — validation-only (test-only, no production changes) |
| Exact Step 3 file boundary defined | PASS — 1 new test file, 0 production files |
| Test plan defined | PASS — 9 test cases in 1 file |
| HTTP behavior confirmed | PASS — 402 response body acceptable |
| Split decision | PASS — no further split; one bounded Step 3 |
| Runtime/provider safety confirmed | PASS — no Docker/Postgres/Redis/Stripe required |
| Risks identified and mitigated | PASS — 8 risks with mitigations |

### Final Decision

**BILLING-READY-04B is READY for Step 3 — bounded validation (test-only implementation).**

No further split required. Proceed directly to Step 3.

### Recommended Model for Step 3

**GPT-5.3 Codex** — bounded test-only implementation with clear spec, established NestJS testing patterns, mocked repositories, guard metadata reflection. No production changes. No complex transaction logic.

### Exact Next Prompt Type

Implementation step: Create `credit-balance-guard-execution-start.integration.spec.ts` with 9 test cases. Validation-only. 3-step task loop (registration already done).

---

## Files Inspected (Read-Only, Not Modified)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status verification |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance status verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence, 04A/04B status |
| 4 | `docs/BILLING-READY-04A-CHECKPOINT.md` | 04A completion record, guard behavior, wiring |
| 5 | `docs/BILLING-READY-04A-IMPLEMENTATION-READINESS-REVIEW.md` | 04A source-path review, guard design decisions |
| 6 | `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | Parent 04 readiness review |
| 7 | `services/api-gateway/src/billing/credit-balance.guard.ts` | Guard implementation (99 lines) |
| 8 | `services/api-gateway/src/billing/credit-balance-guard.module.ts` | Guard module (25 lines) |
| 9 | `services/api-gateway/src/billing/__tests__/credit-balance.guard.spec.ts` | Guard unit tests (405 lines, 24 tests) |
| 10 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller, guard chain at line 383 |
| 11 | `services/api-gateway/src/ai/ai.module.ts` | AIModule imports CreditBalanceGuardModule |
| 12 | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Controller unit tests — all override CreditBalanceGuard (68 tests) |
| 13 | `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts` | Controller integration tests — overrides CreditBalanceGuard (30 tests) |
| 14 | `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Guard integration tests — tests other guards, not CreditBalanceGuard (31 tests) |
| 15 | `services/api-gateway/src/public-api/public-ai.controller.ts` | Public API controller, guard chain at lines 49 + 75-84 |
| 16 | `services/api-gateway/src/public-api/public-api.module.ts` | PublicApiModule imports CreditBalanceGuardModule |
| 17 | `services/api-gateway/src/public-api/public-ai.controller.spec.ts` | Public API tests — direct instantiation, no guard chain (3 tests) |
| 18 | `services/api-gateway/src/queue/queue.service.ts` | QueueService.enqueueExecution() implementation |
| 19 | `services/api-gateway/src/orchestration/orchestration.service.ts` | Orchestration referral enqueue path (not HTTP-guarded) |
| 20 | All guard files under `services/api-gateway/src/**/*guard*.ts` | 40 files — guard inventory via glob |

---

## Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | File created: `docs/BILLING-READY-04B-EXECUTION-START-WIRING-READINESS.md` | CONFIRMED |
| 2 | Files inspected (20 sources + governance docs, read-only) | CONFIRMED |
| 3 | Governance readiness: PASS | CONFIRMED |
| 4 | 04A foundation summary complete | CONFIRMED |
| 5 | Execution-start entry-point coverage: 2 HTTP paths + 1 service path documented | CONFIRMED |
| 6 | Guard-chain decision: correct order confirmed in both controllers | CONFIRMED |
| 7 | Queue enqueue/no-enqueue assertion plan: 6 scenarios | CONFIRMED |
| 8 | Existing test gap review: 8 gaps identified | CONFIRMED |
| 9 | Implementation vs validation-only decision: A — validation-only | CONFIRMED |
| 10 | Exact Step 3 file boundary: 1 new test file, 0 production files | CONFIRMED |
| 11 | Test plan: 9 test cases in 1 file | CONFIRMED |
| 12 | HTTP behavior: 402 response body acceptable | CONFIRMED |
| 13 | Split decision: A — no further split | CONFIRMED |
| 14 | Runtime/provider safety notes documented | CONFIRMED |
| 15 | Risks/blockers: 8 identified with mitigations | CONFIRMED |
| 16 | No source/governance/env files changed except readiness doc | CONFIRMED |
| 17 | No tests/builds/runtime/provider calls executed | CONFIRMED |
| 18 | BILLING-READY-04B is ready for Step 3 | CONFIRMED |
