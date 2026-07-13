# BILLING-READY-04A — Implementation Readiness / Exact File Boundary

**Task ID:** BILLING-READY-04A
**Step:** 2 of 4 (Implementation Readiness / Exact File Boundary)
**Status:** COMPLETE
**Date:** 2026-07-12
**Nature:** Static implementation-readiness/source-path review only. No implementation. No tests. No runtime.
**Parent:** BILLING-READY-04 (ACTIVE — Step 2 COMPLETE — split decision recorded)

---

## 1. Governance Readiness

| Criterion | Status |
|-----------|--------|
| BILLING-READY-04A ACTIVE — Step 1 COMPLETE (Registration 2026-07-12) | CONFIRMED |
| BILLING-READY-04 ACTIVE — Step 2 COMPLETE (split decision recorded) | CONFIRMED |
| BILLING-READY-04B/04C/04D planned only, not registered | CONFIRMED |
| BILLING-READY-03 COMPLETE and LOCKED (all 7 child slices) | CONFIRMED |
| AGENT-PLATFORM-07F COMPLETE and LOCKED (all 3 child slices) | CONFIRMED |
| AGENT-HARNESS-07 COMPLETE and LOCKED (all 3 child slices) | CONFIRMED |
| AGENT-HARNESS-06E COMPLETE and LOCKED | CONFIRMED |
| One-active-task rule satisfied (only BILLING-READY-04/04A ACTIVE) | CONFIRMED |

**Governance readiness: PASS.**

---

## 2. Source-Path Findings

### 2.1 Credit Balance Table/Entity/Repository

| Item | Path | Key Details |
|------|------|-------------|
| Entity | `services/api-gateway/src/entities/credit-balance.entity.ts` | `CreditBalance`: `id`, `ownerId`, `ownerType` (default `'user'`), `planId`, `balance` (integer, `>= 0` CHECK), `monthlyAllocation`, `rolloverBalance`, `status`, `periodStart`, `periodEnd`, `resetAt`. Unique index on `(owner_id, owner_type)`. |
| Table | `credit_balances` | Migration `1772100000000`. Live in PostgreSQL (validated 03D2). |
| Repository | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | `CreditBalanceRepository`. Key methods: `findByOwner(ownerId, ownerType='user')` → `CreditBalance | null`; `findByOwnerForUpdate(ownerId, ownerType, manager?)` → with `SELECT FOR UPDATE`; `deductBalance(id, newBalance, manager?)`. |
| Module | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` | `CreditPersistenceModule` — imports TypeORM entities, provides/exports `CreditBalanceRepository` and `CreditDeductionRecordRepository`. |

### 2.2 Deduction Gateway

| Item | Path | Key Details |
|------|------|-------------|
| Abstract gateway | `services/api-gateway/src/billing/credit-deduction/credit-deduction.gateway.ts` | `CreditDeductionGateway<T>` abstract base. |
| Persistent impl | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | `PersistentCreditDeductionGateway`. Transactional deduction with `DataSource.transaction()`, overflow semantics, `sourceEventId` idempotency. |
| Module | `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` | `CreditDeductionModule` — binds `CreditDeductionGateway` to `PersistentCreditDeductionGateway`. Imported by `UsageLedgerModule`. |
| Wiring point | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | `UsageLedgerService.emitDeductionAttempt()` — called AFTER `updateExecutionResult()`. Post-execution. |

### 2.3 AI Execution Controller Entry Point

| Item | Path | Key Details |
|------|------|-------------|
| Controller | `services/api-gateway/src/ai/ai-execution.controller.ts` | `@Post('execute')` at line 380. |
| Guard chain (line 382) | `@UseGuards(SessionOrApiKeyAuthGuard, AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, IdempotencyGuard, QuotaGuard, TokenQuotaGuard, RateLimitGuard)` | 9 guards in sequence. |
| Public API controller | `services/api-gateway/src/public-api/public-ai.controller.ts` | `@Post('execute')` with guard chain: `AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, IdempotencyGuard, QuotaGuard, TokenQuotaGuard`. Class-level: `ApiKeyAuthGuard, PublicApiRateLimitGuard`. |
| Module | `services/api-gateway/src/ai/ai.module.ts` | `AIModule` — imports `AuthModule`, `QuotaModule`, `UsageLedgerModule`, `SafetyModule`, `LaunchModule`, `AbortModule`, `QueueModule`, etc. |

### 2.4 Auth/User Context Shape

| Item | Path | Key Details |
|------|------|-------------|
| `ApiKeyIdentity` interface | `services/api-gateway/src/auth/api-key.config.ts` | `{ userId, apiKeyId, scopes, isInternal?, isEarlyAccess?, harnessEntitled? }`. **Does NOT include `role` or `UserRole`.** |
| `SessionOrApiKeyAuthGuard` | `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Attaches `request.apiKeyIdentity`. For session path: synthesizes `ApiKeyIdentity` with `{ userId: user.id, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true }`. **Does NOT attach `request.user`.** |
| `SessionCookieGuard` | `services/api-gateway/src/auth/session-cookie.guard.ts` | Attaches `request.user = { userId, email, role, plan }`. **Not used in AI execution path.** Used by non-AI controllers. |
| `@AuthenticatedUser()` decorator | `services/api-gateway/src/auth/authenticated-user.decorator.ts` | Returns `request.apiKeyIdentity`. |
| Static API key registry | `services/api-gateway/src/auth/api-key.config.ts` | 4 static keys. No `role` field on any key. |

**Critical gap: `ApiKeyIdentity` does not carry user role. The `SessionOrApiKeyAuthGuard` does not attach `request.user`. The admin bypass cannot rely on the existing identity object — it must perform a DB lookup.**

### 2.5 Plan/Admin/Internal/Beta Markers

| Item | Source | Notes |
|------|--------|-------|
| `UserRole` enum | `services/api-gateway/src/entities/user-role.enum.ts` | `ADMIN = 'admin'`, `USER = 'user'`, `BETA = 'beta'` |
| `user.role` column | `services/api-gateway/src/entities/user.entity.ts` | TypeORM column, enum type, default `USER`. |
| `user.planType` column | Same file | varchar(50), default `'free'`. Values: `'free'`, `'pro'`, `'enterprise'`. |
| `user.planStatus` column | Same file | varchar(20), default `'active'`. |
| `AdminRoleGuard` | `services/api-gateway/src/guards/admin-role.guard.ts` | Checks `request.user?.role === UserRole.ADMIN`. Uses `request.user` (not `request.apiKeyIdentity`). Different auth path from AI execution. |
| `isInternal` flag | `ApiKeyIdentity.isInternal` | Present on test keys. Boolean. Does NOT map to user role or admin status. |
| `isEarlyAccess` flag | `ApiKeyIdentity.isEarlyAccess` | Present on one test key. Boolean. |
| No explicit beta bypass | Guards check `apiKeyIdentity` + quota — no plan-type or role-based exemption found anywhere in the guard chain. |

### 2.6 Existing Error/Exception Patterns

| Pattern | Source | HTTP Status |
|---------|--------|-------------|
| `HttpException('Quota exceeded', 429)` | `quota.guard.ts` | 429 |
| `HttpException({...details...}, 429)` | `token-quota.guard.ts` | 429 (structured body with `quota_type`, `limit`, `used`, `reset_at`) |
| `ForbiddenException()` | Multiple guards | 403 |
| `UnauthorizedException()` | Auth guards | 401 |
| `BadRequestException()` | Validation | 400 |
| No existing HTTP 402 usage | Codebase-wide search | None found |

### 2.7 Existing Test Patterns

| Pattern | Example File | Notes |
|---------|-------------|-------|
| Guard unit test with mock `ExecutionContext` | `services/api-gateway/src/quota/__tests__/quota.guard.spec.ts` | Mock `request.apiKeyIdentity`, mock services, test `canActivate()` return/throw. |
| Repository unit test with mock TypeORM repo | `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance.repository.spec.ts` | Mock `Repository<CreditBalance>`, test query parameters. |
| Gateway unit test with mock repos | `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` | Mock `CreditBalanceRepository`, `CreditDeductionRecordRepository`, `DataSource`. Uses `makeBalance()`, `makeEvent()`, `makeRecord()` factory functions. |
| Integration spec | `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Integration-level guard validation. |

---

## 3. Exact CreditBalanceGuard Boundary

### 3.1 File Path

```
services/api-gateway/src/billing/credit-balance.guard.ts
```

Rationale: The guard is a billing enforcement concern. It sits alongside the existing `billing/` directory structure. Single file, not a subdirectory, because it's one focused guard class.

### 3.2 Class Name

```typescript
CreditBalanceGuard implements CanActivate
```

### 3.3 Dependencies to Inject

| Dependency | Source | Purpose |
|------------|--------|---------|
| `CreditBalanceRepository` | `CreditPersistenceModule` (via `CreditBalanceGuardModule`) | Look up user's credit balance row |
| `Repository<User>` | `TypeOrmModule.forFeature([User])` (via `CreditBalanceGuardModule`) | Look up user's role for admin bypass |

The guard does NOT need:
- `DataSource` (no transaction needed — read-only check)
- `CreditDeductionGateway` (post-execution concern)
- `CreditCalculationService` (no credit calculation at gate)
- `UsersService` (too heavyweight; direct repo query is sufficient)
- `QuotaService` (separate concern)

### 3.4 Source of userId/ownerId

```typescript
const identity = request.apiKeyIdentity as ApiKeyIdentity;
const userId = identity.userId;
```

Same pattern as `QuotaGuard` (line 40-41) and `TokenQuotaGuard` (line 61-71).

`userId` is used as `ownerId` for the `CreditBalanceRepository.findByOwner()` call. This is consistent with how `PersistentCreditDeductionGateway` uses `event.ownerId` (which is `record.userId` from the usage ledger).

### 3.5 Source of Owner Type

Hardcoded `'user'` — same as `CreditBalanceRepository.findByOwner()` default and `PersistentCreditDeductionGateway` usage (line 67: `findByOwnerForUpdate(event.ownerId, 'user', manager)`).

Team/org owner types are a future feature; not in scope.

### 3.6 Source of Balance Lookup

```typescript
const balance = await this.creditBalanceRepository.findByOwner(userId, 'user');
```

Returns `CreditBalance | null`. The guard checks `balance?.balance` (the integer credits remaining).

### 3.7 Admin Bypass — Source of User Role

```typescript
const user = await this.userRepository.findOne({ where: { id: userId } });
if (user?.role === UserRole.ADMIN) {
  return true; // admin bypass
}
```

**Why DB lookup instead of extending `ApiKeyIdentity`:**
1. Extending `ApiKeyIdentity` would require modifying `SessionOrApiKeyAuthGuard` and `ApiKeyConfig` — wider blast radius outside 04A scope.
2. Direct repo query is a lightweight read (~1ms) with the primary key index.
3. `AdminRoleGuard` already uses the same pattern (`request.user?.role` checked against `UserRole.ADMIN`).
4. The role DB lookup and balance DB lookup can be parallelized with `Promise.all()` to minimize latency impact.

### 3.8 Module Placement

The guard belongs under the `billing/` namespace. **Not** under `ai/`, `credits/`, or `usage-ledger/`.

Rationale:
- It reads from `credit_balances` — a billing table.
- It enforces a billing policy (credit exhaustion).
- Existing guard modules follow the pattern of self-contained module + guard (e.g., `QuotaModule` + `QuotaGuard`).

### 3.9 Module Registration

New module file:

```
services/api-gateway/src/billing/credit-balance-guard.module.ts
```

```typescript
@Module({
  imports: [
    CreditPersistenceModule,        // CreditBalanceRepository
    TypeOrmModule.forFeature([User]) // User entity for role lookup
  ],
  providers: [CreditBalanceGuard],
  exports: [CreditBalanceGuard],
})
export class CreditBalanceGuardModule {}
```

Consumers:
- `AIModule` imports `CreditBalanceGuardModule`
- `PublicApiModule` imports `CreditBalanceGuardModule` (if public API also needs balance gate — see §4.4)

---

## 4. Exact Guard Wiring Boundary

### 4.1 Primary Controller/Method

**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`
**Method:** `execute()` — `@Post('execute')` at line 380

### 4.2 Exact UseGuards Order

Current (line 382):
```typescript
@UseGuards(
  SessionOrApiKeyAuthGuard,
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,
  AbortGuard,
  IdempotencyGuard,
  QuotaGuard,
  TokenQuotaGuard,
  RateLimitGuard
)
```

New:
```typescript
@UseGuards(
  SessionOrApiKeyAuthGuard,
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,
  AbortGuard,
  IdempotencyGuard,
  CreditBalanceGuard,    // ← NEW — after IdempotencyGuard, before QuotaGuard
  QuotaGuard,
  TokenQuotaGuard,
  RateLimitGuard
)
```

**Position rationale:**
- After `IdempotencyGuard`: Idempotent replays should short-circuit before balance check (replays don't consume credits).
- Before `QuotaGuard`: Balance exhaustion should reject before quota accounting runs (prevents quota state mutation for rejected requests).
- Before `TokenQuotaGuard`: Same rationale — don't acquire advisory lock for a request that will be rejected.

### 4.3 Scope of Guard Application

The guard applies to **`POST /api/ai/execute` only** (the single AI execution entry point in the main controller).

It does NOT apply to:
- `GET /api/ai/executions/:id/result` (result polling — no resource consumption)
- `POST /api/ai/executions/:id/cancel` (cancel — no resource consumption)
- `GET /api/ai/executions/:id/stream` (SSE stream — no new execution)
- Admin endpoints
- Session/project/workspace endpoints
- Health check
- Internal service endpoints

### 4.4 Public API Execution Path

**File:** `services/api-gateway/src/public-api/public-ai.controller.ts`
**Method:** `execute()` — `@Post('execute')` at line 72

Current guard chain (line 74-82):
```typescript
@UseGuards(
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,
  AbortGuard,
  IdempotencyGuard,
  QuotaGuard,
  TokenQuotaGuard
)
```

**Decision: YES — the public API execute endpoint also needs `CreditBalanceGuard`.**

New:
```typescript
@UseGuards(
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,
  AbortGuard,
  IdempotencyGuard,
  CreditBalanceGuard,    // ← NEW
  QuotaGuard,
  TokenQuotaGuard
)
```

Same position rationale applies.

Rationale for including public API:
- Public API key users also consume credits.
- Without balance gating on public API, users could bypass credit enforcement via API keys.
- Both paths share the same `apiKeyIdentity` context pattern.

### 4.5 Orchestration/Referral Execution Paths

**Decision: NOT directly affected in 04A.**

Orchestration referral executions go through `OrchestrationService.startReferralExecution()` → `QueueService.enqueueExecution()`. They bypass the controller guard chain entirely. The referral jobs are enqueued by the coordinator, not by an HTTP request.

Balance enforcement on referral executions is deferred. The initiating user's balance is checked on the initial `POST /api/ai/execute`, which gates the entry point. Referral executions within a collaboration run are downstream of an already-gated request.

### 4.6 Stub/Test Execution Path

**Decision: Guard runs for stub executions.** No bypass.

- Stub executions still check `balance > 0`.
- Stub executions produce `tokens_used = 0` → deduction calculates `0 × creditsPerUnit = 0` credits → balance unchanged.
- A user with a provisioned balance (balance > 0) can run unlimited stub executions with zero credit impact.
- A user with no provisioned balance (null row or balance = 0) is still blocked from stub execution.
- This is correct: the balance gate verifies the user is provisioned, not that the specific execution will be expensive.

---

## 5. Credit Balance Lookup Decision

### 5.1 Exact Repository/Service Method

```typescript
CreditBalanceRepository.findByOwner(ownerId: string, ownerType: string = 'user'): Promise<CreditBalance | null>
```

This is a non-locking read (no `FOR UPDATE`). The guard only needs to check the current balance; it does not mutate balance. Locking is the post-execution gateway's concern.

### 5.2 Expected Owner Key

```
ownerId = identity.userId    (from request.apiKeyIdentity)
ownerType = 'user'           (hardcoded default)
```

### 5.3 Balance Field Semantics

- `balance` is an integer (credit units).
- `balance >= 0` is enforced by DB CHECK constraint.
- `balance` is mutated only by `CreditBalanceRepository.deductBalance()` inside the `PersistentCreditDeductionGateway` transaction and by `resetForNewPeriod()`.

### 5.4 Missing Balance Behavior (null result)

**Decision: REJECT (HTTP 402).**

`findByOwner()` returning `null` means no `credit_balances` row exists for this user. This means the user has not been provisioned (no credit balance created).

Guard behavior: throw HTTP 402 with `error_code: 'credit_balance_not_provisioned'`.

Auto-provisioning (creating a balance row on first execution) is a future feature — deferred beyond 04A.

### 5.5 Zero Balance Behavior

**Decision: REJECT (HTTP 402).**

`balance === 0` means the user has exhausted all credits. Execution is blocked until credits are replenished (via period reset, top-up, or admin action).

Guard behavior: throw HTTP 402 with `error_code: 'credit_balance_exhausted'` and `current_balance: 0`.

### 5.6 Positive Balance Behavior

**Decision: ALLOW.**

`balance > 0` means the user has credits available. Guard returns `true`.

The guard does NOT estimate credits for the upcoming execution and does NOT pre-deduct. The overflow semantics from BILLING-READY-03 handle the case where actual usage exceeds the remaining balance.

---

## 6. Admin/Internal/Beta/Stub Behavior

### 6.1 Admin Bypass

**Decision: YES — admin users bypass balance check.**

Source of truth: `User.role === UserRole.ADMIN` (from `user-role.enum.ts`).

Implementation: Guard performs `userRepository.findOne({ where: { id: identity.userId } })`, checks `user.role === UserRole.ADMIN`. If admin, `return true` immediately (no balance lookup).

Rationale: Admin accounts are internal-only (confirmed in 04 readiness doc §7). Exempting them from balance checks avoids blocking internal testing/development when credit balances are not provisioned.

### 6.2 Internal Key Bypass

**Decision: NO — `isInternal` flag does NOT bypass balance check.**

`isInternal` on `ApiKeyIdentity` is a launch-state flag (Phase 28B-1), not a billing exemption. Internal keys belong to non-admin test users and should still be subject to balance checks.

If a test user needs to execute without balance provisioning, they should be given `role: admin` or have a balance row created.

### 6.3 Beta User Behavior

**Decision: Same as normal users — no bypass.**

`UserRole.BETA` users are subject to the same balance check as `UserRole.USER`. Beta does not imply unlimited credits.

### 6.4 Stub/Zero-Token Behavior

**Decision: Guard runs — no bypass for stub provider.**

The guard does not inspect the execution provider. It only checks balance. Stub executions that produce 0 tokens will have 0 credit deduction post-execution, leaving balance unchanged.

### 6.5 Test User Behavior

**Decision: Test users are subject to balance check unless role is admin.**

The demo test user (`test@aisandbox.com`, `role=admin`, `plan=enterprise`) will bypass via admin exemption. Other test users need provisioned balance rows in fixtures.

### 6.6 Deferred to Later Slices

| Item | Deferred To |
|------|-------------|
| Entitlement gating (model/tool/agent access) | BILLING-READY-05+ |
| Plan-based credit tiers (free=500, starter=5000, etc.) | Future provisioning slice |
| Auto-provisioning of balance row on first execution | Future provisioning slice |
| `isInternal` billing exemption | Future explicit decision |
| Multi-builder/referral credit attribution | Future orchestration billing slice |
| Credit top-up / Stripe recharge | BILLING-READY-05+ |

---

## 7. Insufficient Balance HTTP Behavior

### 7.1 HTTP Status Code

**Decision: HTTP 402 Payment Required.**

Rationale:
- HTTP 402 is semantically correct: "The request cannot be processed until the client makes a payment" (credit replenishment).
- HTTP 403 (Forbidden) implies authorization failure — misleading for a billing/credits issue.
- HTTP 429 (Too Many Requests) implies rate-limiting — not applicable for balance exhaustion.
- No existing 402 usage in the codebase — no collision risk.
- The 04 readiness doc identified 402 as the recommended status.

### 7.2 Exact Exception Class

```typescript
throw new HttpException(
  {
    statusCode: 402,
    error: 'Payment Required',
    message: 'Insufficient credit balance',
    details: {
      error_code: 'credit_balance_exhausted',
      current_balance: balance?.balance ?? null,
    },
  },
  HttpStatus.PAYMENT_REQUIRED,
);
```

For missing balance (no row):
```typescript
throw new HttpException(
  {
    statusCode: 402,
    error: 'Payment Required',
    message: 'Credit balance not provisioned',
    details: {
      error_code: 'credit_balance_not_provisioned',
    },
  },
  HttpStatus.PAYMENT_REQUIRED,
);
```

Uses `HttpException` directly (same pattern as `TokenQuotaGuard` line 132-146) — not a custom exception class. Custom exception classes are unnecessary at this stage.

### 7.3 Response Body Shape

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

The `details` object follows the `TokenQuotaGuard` structured error pattern.

`current_balance` is included for client-side display but does NOT leak sensitive billing information (it's the user's own balance).

### 7.4 Frontend/i18n Copy

**Decision: DEFERRED to 04C (Frontend Error Handling + i18n + UX Polish).**

For 04A:
- The API returns a structured JSON error body.
- The frontend may show a generic error message for any non-200 AI execution response.
- No new i18n keys are required in 04A.
- Dedicated error display with proper i18n keys is 04C scope.

### 7.5 API-Only Error Code

**Decision: YES — API-only error code is sufficient for 04A.**

The `error_code` field (`credit_balance_exhausted` / `credit_balance_not_provisioned`) is machine-readable and sufficient for API consumers (including future frontend handling in 04C).

---

## 8. Implementation File Boundary

### 8.1 Files to Create (Step 3)

| # | File | Type | Description |
|---|------|------|-------------|
| 1 | `services/api-gateway/src/billing/credit-balance.guard.ts` | Production | `CreditBalanceGuard` — checks `balance > 0`, admin bypass, 402 on exhaustion/missing |
| 2 | `services/api-gateway/src/billing/credit-balance-guard.module.ts` | Production | `CreditBalanceGuardModule` — imports `CreditPersistenceModule` + `TypeOrmModule.forFeature([User])`, provides/exports `CreditBalanceGuard` |
| 3 | `services/api-gateway/src/billing/__tests__/credit-balance.guard.spec.ts` | Test | Unit tests for `CreditBalanceGuard` |

### 8.2 Files to Modify (Step 3)

| # | File | Type | Change |
|---|------|------|--------|
| 4 | `services/api-gateway/src/ai/ai-execution.controller.ts` | Production | Add `CreditBalanceGuard` to `@UseGuards()` chain (after `IdempotencyGuard`, before `QuotaGuard`). Add import. |
| 5 | `services/api-gateway/src/ai/ai.module.ts` | Production | Import `CreditBalanceGuardModule`. |
| 6 | `services/api-gateway/src/public-api/public-ai.controller.ts` | Production | Add `CreditBalanceGuard` to `@UseGuards()` chain (after `IdempotencyGuard`, before `QuotaGuard`). Add import. |

### 8.3 Files to Verify/Inspect Only (Step 3)

| # | File | Purpose |
|---|------|---------|
| 7 | Existing `ai-execution.controller.spec.ts` | Verify existing tests still pass with new guard |
| 8 | Existing `ai-execution-guards.integration.spec.ts` | Verify existing guard integration tests are compatible |
| 9 | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` | Verify exports `CreditBalanceRepository` (confirmed — already does) |

### 8.4 Files NOT Changed

- No migration files
- No entity files
- No `CreditBalanceRepository` changes (read-only usage)
- No `PersistentCreditDeductionGateway` changes
- No `UsageLedgerService` changes
- No `CreditDeductionModule` changes
- No frontend translation files (deferred to 04C)
- No worker/ai-service changes
- No `.env` files
- No `docker-compose.yml`
- No `package.json` / dependencies

### 8.5 Public API Module Check

The `PublicApiModule` (`services/api-gateway/src/public-api/public-api.module.ts`) will also need to import `CreditBalanceGuardModule` if it does not already transitively import it. This should be verified during Step 3.

---

## 9. Test Plan

### 9.1 Test File

```
services/api-gateway/src/billing/__tests__/credit-balance.guard.spec.ts
```

### 9.2 Test Cases

| # | Test Case | Type | Expected Outcome |
|---|-----------|------|------------------|
| 1 | Sufficient balance (balance > 0) allows execution | Unit | `canActivate()` returns `true` |
| 2 | Insufficient balance (balance === 0) blocks execution | Unit | Throws `HttpException` with status 402 and `error_code: 'credit_balance_exhausted'` |
| 3 | Missing balance (no `credit_balances` row) blocks execution | Unit | Throws `HttpException` with status 402 and `error_code: 'credit_balance_not_provisioned'` |
| 4 | Admin role bypasses balance check — no balance lookup performed | Unit | `canActivate()` returns `true`; `findByOwner` NOT called |
| 5 | Beta role does NOT bypass balance check | Unit | `findByOwner` IS called; standard behavior |
| 6 | Normal user role subject to full balance check | Unit | `findByOwner` IS called; standard behavior |
| 7 | Missing identity throws 500 (internal server error) | Unit | Throws `HttpException` with status 500 |
| 8 | Missing userId in identity throws 500 | Unit | Throws `HttpException` with status 500 |
| 9 | User not found in DB (invalid userId) — treated as non-admin | Unit | `findByOwner` IS called; no admin bypass |
| 10 | Error response body includes `details.error_code` and `details.current_balance` | Unit | Structured error body matches expected shape |
| 11 | Guard does not call `findByOwnerForUpdate` (no locking) | Unit | Only `findByOwner` called (read-only) |
| 12 | Guard does not call `deductBalance` (no mutation) | Unit | `deductBalance` NOT called |
| 13 | Guard does not import or call Stripe/payment/provider APIs | Architectural | No payment module imports in guard file |

### 9.3 Existing Test Compatibility

| # | Existing Test File | Expected Impact |
|---|-------------------|-----------------|
| 1 | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | May need mock `CreditBalanceGuard` added to test module providers |
| 2 | `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | May need mock `CreditBalanceGuard` — verify |
| 3 | `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts` | May need mock `CreditBalanceGuard` — verify |
| 4 | `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` | No impact (guard is separate from gateway) |
| 5 | `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance.repository.spec.ts` | No impact (guard does not modify repository) |

---

## 10. Migration Decision

**Decision: No migration needed.**

All required schema elements exist:
- `credit_balances` table with `balance`, `owner_id`, `owner_type`, `status` columns
- `users` table with `role` column (for admin bypass)
- No new columns, tables, indexes, or constraints required

The guard performs read-only queries against existing tables. No DDL changes.

---

## 11. Split Decision

**Decision: A — Proceed with one bounded Step 3 implementation.**

Rationale:
1. The guard is a single focused file (~60-80 lines of production code).
2. The module registration is a single focused file (~15 lines).
3. The controller wiring is 2 changes (one import + one guard addition) per controller.
4. The test file is bounded (~13 test cases, ~200 lines).
5. Total production file count: 3 new + 3 modified = 6 files.
6. No migration, no frontend, no worker changes.
7. This is well within the "normal bounded feature" scope from CLAUDE.md.

Further splitting 04A into sub-slices (e.g., guard creation vs. wiring vs. tests) would add governance overhead without proportional risk reduction.

---

## 12. Runtime/Provider Safety

| Constraint | Status |
|-----------|--------|
| No Stripe/payment/provider API calls | CONFIRMED — guard reads `credit_balances` and `users` tables only |
| No Docker/Postgres/Redis required for Step 3 unit tests | CONFIRMED — unit tests use mock repos and mock execution context |
| Integration tests (if any) may need Docker/Postgres | DEFERRED to 04B — no integration tests in 04A |
| No AGENT-HARNESS write canary | CONFIRMED — guard does not reference harness config or write tools |
| No browser smoke | CONFIRMED — no UI changes in 04A |
| No BullMQ jobs | CONFIRMED — guard is pre-enqueue |
| No `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` | CONFIRMED — unrelated |

---

## 13. UX/UI Constraints

- No UI implementation in 04A.
- No frontend translation file changes in 04A.
- When 04C adds user-facing error display, it must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Expected future i18n keys (04C scope, not 04A):
  - `billing.creditBalanceExhausted` — "Your credits have been exhausted. Please upgrade your plan or wait for your next billing cycle."
  - `billing.creditBalanceNotProvisioned` — "Your account has not been set up for credit-based billing."
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Heroicons v2 Outline only for any future billing icons.
- Impeccable / Emil Kowalski advisory only — no broad redesigns.

---

## 14. Risks/Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | **Admin bypass via DB lookup adds latency** — user role query on every non-admin request | LOW | Primary key lookup is ~1ms. `Promise.all([roleQuery, balanceQuery])` parallelizes both. Caching is a future optimization. |
| 2 | **Wrong owner mapping** — `identity.userId` doesn't match `credit_balances.owner_id` | MEDIUM | Both use the same user UUID from `users.id`. `PersistentCreditDeductionGateway` also uses `event.ownerId` which comes from `record.userId`. Consistent. Unit test verifies correct `ownerId` passed. |
| 3 | **Admin bypass exploited** — non-admin escalates to admin | LOW | `UserRole.ADMIN` is set in the `users` table, protected by normal DB access controls. No self-service role change API exists. |
| 4 | **Beta/free user policy ambiguity** — beta users expect free execution | LOW | Documented decision: beta users are subject to same balance check. Policy can be changed later by adding beta bypass. |
| 5 | **Insufficient-balance response compatibility** — frontend may not handle 402 | LOW | Frontend currently shows generic error for non-200 AI responses. 402 will trigger the same generic path. Dedicated handling is 04C scope. |
| 6 | **Test fixture fragility** — existing tests break because `CreditBalanceGuard` requires additional mocks | MEDIUM | Existing test modules will need `CreditBalanceGuard` mocked/provided. Pattern is established (QuotaGuard mocking in existing tests). |
| 7 | **Over-blocking stub/test execution** — test users without balance rows can't run stubs | MEDIUM | Admin test users bypass via role. Non-admin test users need balance fixture rows. Test setup patterns from 03D2 can be adapted. |
| 8 | **Race window** — balance checked at gate, deducted post-execution | MEDIUM (accepted) | BILLING-READY-03 overflow semantics handle this. Two concurrent requests may both pass gate; deduction produces overflow, not corruption. Next request sees updated balance. |
| 9 | **Public API guard chain ordering** — `CreditBalanceGuard` position in public API differs from main API | LOW | Same relative position (after `IdempotencyGuard`, before `QuotaGuard`) in both controllers. Consistent behavior. |
| 10 | **`ApiKeyIdentity` lacks `role`** — admin bypass requires extra DB query | LOW (accepted) | Extending `ApiKeyIdentity` would have wider blast radius. Direct repo query is simple and bounded. Future optimization: add `role` to `ApiKeyIdentity` in auth module enhancement. |
| 11 | **Future worker-side accounting mismatch** — worker doesn't verify balance | LOW | By design. Worker handles post-execution accounting only. Balance gate is pre-execution only. No double-check intended. |

---

## 15. Step 3 Readiness Conclusion

| Criterion | Result |
|-----------|--------|
| Governance readiness | PASS |
| Source-path findings documented | PASS |
| Exact guard file path decided | PASS — `services/api-gateway/src/billing/credit-balance.guard.ts` |
| Exact guard class/dependencies decided | PASS — `CreditBalanceGuard`, injects `CreditBalanceRepository` + `Repository<User>` |
| Exact guard wiring position decided | PASS — after `IdempotencyGuard`, before `QuotaGuard` |
| Credit balance lookup method decided | PASS — `findByOwner(userId, 'user')`, read-only |
| Admin/internal/beta/stub behavior decided | PASS — admin bypass via DB role lookup; all others standard |
| HTTP behavior decided | PASS — 402 Payment Required with structured error body |
| Implementation file boundary documented | PASS — 3 new files, 3 modified files, 0 migrations |
| Test plan documented | PASS — 13 test cases in 1 new spec file |
| Migration decision | PASS — none needed |
| Split decision | PASS — no further split; one bounded Step 3 |
| Runtime/provider safety | PASS — no external calls, no Docker for unit tests |
| Risks identified and mitigated | PASS — 11 risks with mitigations |

### Final Decision

**BILLING-READY-04A is READY for Step 3 — bounded implementation.**

No further split required. Proceed directly to Step 3.

### Recommended Model for Step 3

**GPT-5.3 Codex** — bounded NestJS guard implementation with clear spec, unit tests, established patterns. No complex transaction logic (read-only). No migration. No frontend.

### Exact Next Prompt Type

Implementation step: Create `CreditBalanceGuard` + `CreditBalanceGuardModule`, wire into controllers, write unit tests. 3-step task loop (registration already done).

---

## Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status verification |
| 2 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence and 04A status |
| 3 | `docs/BILLING-READY-04-ENFORCEMENT-READINESS-REVIEW.md` | Parent 04 readiness doc |
| 4 | `docs/BILLING-READY-03D3-CHECKPOINT.md` | BILLING-READY-03 close record |
| 5 | `services/api-gateway/src/ai/ai-execution.controller.ts` (lines 370-450) | Execution endpoint, guard chain, identity usage |
| 6 | `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | `findByOwner()` signature, `findByOwnerForUpdate()`, `deductBalance()` |
| 7 | `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` | Module wiring, exports |
| 8 | `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` | Exports `CreditBalanceRepository` |
| 9 | `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | `ownerId` usage, `findByOwnerForUpdate()` call pattern |
| 10 | `services/api-gateway/src/billing/billing.module.ts` | Existing billing module (snapshot-only, separate concern) |
| 11 | `services/api-gateway/src/entities/credit-balance.entity.ts` | Entity shape, columns, constraints |
| 12 | `services/api-gateway/src/entities/user.entity.ts` | `role` column, `planType`, `planStatus` |
| 13 | `services/api-gateway/src/entities/user-role.enum.ts` | `ADMIN`, `USER`, `BETA` |
| 14 | `services/api-gateway/src/auth/api-key.config.ts` | `ApiKeyIdentity` interface (no `role` field) |
| 15 | `services/api-gateway/src/auth/authenticated-user.decorator.ts` | Returns `request.apiKeyIdentity` |
| 16 | `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Synthesizes `ApiKeyIdentity` for session path (no `role`) |
| 17 | `services/api-gateway/src/auth/session-cookie.guard.ts` | Attaches `request.user.role` (not used in AI path) |
| 18 | `services/api-gateway/src/auth/auth.service.ts` (lines 1-80, 292-307) | `validateSessionToken()` returns `User` entity |
| 19 | `services/api-gateway/src/guards/admin-role.guard.ts` | Existing admin guard pattern: `request.user?.role` |
| 20 | `services/api-gateway/src/quota/quota.guard.ts` | Guard pattern reference: `request.apiKeyIdentity`, error handling |
| 21 | `services/api-gateway/src/quota/token-quota.guard.ts` | Guard pattern reference: DB query, structured error, advisory lock |
| 22 | `services/api-gateway/src/quota/quota.module.ts` | Module pattern reference |
| 23 | `services/api-gateway/src/quota/__tests__/quota.guard.spec.ts` | Test pattern reference: mock context, mock services |
| 24 | `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` (lines 1-80) | Test pattern reference: `makeBalance()`, `makeRecord()` factories |
| 25 | `services/api-gateway/src/public-api/public-ai.controller.ts` (lines 1-104) | Public API guard chain |
| 26 | `services/api-gateway/src/ai/ai.module.ts` | AIModule imports |
| 27 | `services/api-gateway/src/app.module.ts` | Global module registration |
| 28 | `services/api-gateway/src/users/users.service.ts` (lines 1-50) | User repo access pattern |
| 29 | `services/api-gateway/src/users/users.module.ts` | UsersModule structure |
| 30 | `services/api-gateway/src/usage-ledger/usage-ledger.module.ts` | UsageLedgerModule imports |
| 31 | `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` (lines 1-30) | Deduction gateway wiring point |
| 32 | `frontend/messages/en.json` (billing-related keys) | Existing i18n key search |

---

## Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | File created: `docs/BILLING-READY-04A-IMPLEMENTATION-READINESS-REVIEW.md` | CONFIRMED |
| 2 | Files inspected (32 files, read-only) | CONFIRMED |
| 3 | Governance readiness: PASS | CONFIRMED |
| 4 | Source-path findings documented | CONFIRMED |
| 5 | Exact CreditBalanceGuard boundary decided | CONFIRMED |
| 6 | Exact guard wiring boundary decided | CONFIRMED |
| 7 | Credit balance lookup decision documented | CONFIRMED |
| 8 | Admin/internal/beta/stub behavior decided | CONFIRMED |
| 9 | Insufficient balance HTTP behavior decided (402) | CONFIRMED |
| 10 | Implementation file boundary documented (3 new, 3 modified) | CONFIRMED |
| 11 | Test plan documented (13 test cases) | CONFIRMED |
| 12 | Migration decision: none needed | CONFIRMED |
| 13 | Split decision: proceed with one bounded Step 3 | CONFIRMED |
| 14 | Runtime/provider safety notes documented | CONFIRMED |
| 15 | Risks/blockers: 11 identified with mitigations | CONFIRMED |
| 16 | No source/governance/env files changed except readiness doc | CONFIRMED |
| 17 | No tests/builds/runtime/provider calls executed | CONFIRMED |
| 18 | BILLING-READY-04A ready for Step 3 | CONFIRMED |
