# BILLING-READY-08 — Free-Plan Credit Balance Provisioning Implementation Plan

**Task ID:** BILLING-READY-08
**Type:** Free-Plan Credit Balance Provisioning
**Status:** ACTIVE — Step 1 COMPLETE — Step 2a COMPLETE AND LOCKED 2026-08-06 — **Step 2b COMPLETE AND LOCKED 2026-08-06** — **Step 2 COMPLETE** — Step 3 NOT STARTED (requires Keith approval)
**Author:** Cursor / Opus 4.6
**Date:** 2026-08-06
**Amended:** 2026-08-06 — Atomic transaction architecture correction
**Amended:** 2026-08-06 — Remove invalid 23505 catch inside transaction; add historical-user backfill migration; remove unnecessary CreditPersistenceModule import
**Keith approval:** Required and recorded 2026-08-06

---

## 1. Root Cause Summary

Current registration paths (`AuthService.register`, `AuthService.findOrCreateGoogleUser`, `AuthService.findOrCreateAppleUser`) create the `users` row but never create a corresponding `credit_balances` row.

`CreditBalanceGuard` rejects requests when `creditBalanceRepository.findByOwner(userId, 'user')` returns `null`. The guard correctly returns HTTP 402 with `credit_balance_not_provisioned`.

The credit-grant path (`CreditGrantService.processGrant`) requires a pre-existing balance row and fails with `BALANCE_NOT_FOUND` if none exists.

**Consequence:** All non-admin users — both future registrations and every existing historical user without a balance row — cannot execute AI.

---

## 2. Source Investigation Results

### 2.1 User-Creation Methods and Transaction Boundaries

Three user-creation paths exist in `services/api-gateway/src/auth/auth.service.ts`:

| Path | Method | Transaction? | Creates balance? |
|------|--------|-------------|-----------------|
| Email registration | `register()` (line 522) | No explicit transaction — sequential `userRepository.save` + `generateAndStoreVerificationToken` + `sendVerificationEmail` | **No** |
| Google OAuth | `findOrCreateGoogleUser()` (line 376) | No explicit transaction — sequential `userRepository.save` + `createGoogleOauthLink` | **No** |
| Apple OAuth | `findOrCreateAppleUser()` (line 428) | No explicit transaction — sequential `userRepository.save` + `createAppleOauthLink` (two branches: private relay + normal) | **No** |

All three paths use `userRepository.save` (TypeORM implicit per-statement transaction). None use a wrapping `DataSource.transaction()`.

### 2.2 DataSource Availability in AuthService

`AuthService` does **not** currently inject `DataSource`. However, `DataSource` is auto-provided by NestJS's TypeORM module — no module import change is required to inject it.

Established codebase pattern (used by `PersistentCreditDeductionGateway`, `CreditGrantService`, `TokenQuotaGuard`, `RuntimeService`, `HealthController`, `ExecutionResultService`, `StartupGuardService`):

```typescript
import { DataSource } from 'typeorm';
// ...
constructor(private readonly dataSource: DataSource) {}
```

### 2.3 EntityManager Transactional Pattern

The established pattern for atomic multi-table writes is `dataSource.transaction(async (manager) => { ... })`. Inside the callback, `manager.save(EntityClass, data)` and `manager.create(EntityClass, data)` operate on any registered entity through the transaction-bound connection.

Example from `PersistentCreditDeductionGateway` (line 63):
```typescript
return await this.dataSource.transaction(async (manager) => {
  const balance = await this.creditBalanceRepository.findByOwnerForUpdate(ownerId, 'user', manager);
  // ... manager-scoped operations ...
});
```

### 2.4 CreditPersistenceModule Import — NOT Required

`CreditPersistenceModule` registers `CreditBalance` and `CreditDeductionRecord` entities with TypeORM via `TypeOrmModule.forFeature([CreditBalance, CreditDeductionRecord])`. This module is already imported by `CreditDeductionModule`, `CreditBalanceGuardModule`, `AIModule`, `PublicApiModule`, and `BillingReadModule`. The `CreditBalance` entity is globally known to the `DataSource`.

Since the implementation uses `DataSource.transaction()` + `manager.save(CreditBalance, {...})` directly — NOT `CreditBalanceRepository` — importing `CreditPersistenceModule` into `AuthModule` is unnecessary. The `DataSource` can access any entity registered anywhere in the TypeORM connection. The `CreditBalance` class import is a TypeScript-level import only.

`AuthModule` does NOT need modification.

### 2.5 Authoritative Free-Plan Allocation Source

```
services/api-gateway/src/credit-ledger/types/plan-definition.ts
```

```typescript
export const PLAN_IDS = ['free', 'starter', 'pro', 'team'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const MONTHLY_CREDIT_ALLOCATIONS: Readonly<Record<PlanId, number>> = {
  free: 500,
  starter: 5000,
  pro: 25000,
  team: 100000,
} as const;
```

All four plan types have defined allocations. `PLAN_IDS` is the authoritative list of valid plan identifiers.

### 2.6 Exact Initial Values for Free-Plan Balance Row

| Field | Value | Source |
|-------|-------|--------|
| `ownerId` | `savedUser.id` (UUID from user creation) | User entity PK |
| `ownerType` | `'user'` | Default in entity/repository |
| `planId` | `'free'` | Matches `user.planType = 'free'` |
| `balance` | `MONTHLY_CREDIT_ALLOCATIONS.free` (500) | Authoritative constant |
| `monthlyAllocation` | `MONTHLY_CREDIT_ALLOCATIONS.free` (500) | Authoritative constant |
| `rolloverBalance` | `0` | New account — no rollover |
| `status` | `'active'` | Default |
| `periodStart` | Start of current UTC month | See §2.7 |
| `periodEnd` | Start of next UTC month | See §2.7 |
| `resetAt` | `null` | New account — no reset scheduled |

### 2.7 Billing Period Calculation

No shared period-boundary utility exists in the codebase. The subscription entity uses Stripe-provided period boundaries. For free-plan initial provisioning, UTC calendar-month boundaries:

```typescript
const now = new Date();
const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
```

### 2.8 Side Effects in Registration

**Email registration** has two side effects after user creation:
1. `generateAndStoreVerificationToken()` — DB write (must be inside transaction)
2. `sendVerificationEmail()` — external side effect (must be AFTER transaction commit)

**Google/Apple OAuth** have no external side effects after user creation. The OAuth link is a DB write (inside transaction).

### 2.9 Historical User Evidence

All registration paths hardcode `planType: 'free'` (lines 418, 467, 497, 542 in `auth.service.ts`). The `plan_type` column defaults to `'free'` and the `AddPlansFoundation` migration backfills existing rows to `'free'`. However, subscription upgrades via Stripe webhooks can change a user's `plan_type` to `'starter'`, `'pro'`, or `'team'`.

Source evidence:
- `users.plan_type` is `varchar(50)` with default `'free'`
- Valid values enforced by `subscriptions` CHECK: `('free', 'starter', 'pro', 'team')`
- `MONTHLY_CREDIT_ALLOCATIONS` defines mappings for all four plan IDs

**Conclusion:** The backfill must NOT assume all historical users are `free`. It must derive allocation from each user's actual `plan_type` and validate it against `PLAN_IDS`.

### 2.10 Migration Convention

The repository uses TypeORM migrations in `services/api-gateway/src/migrations/` with timestamp-based filenames. Migrations implement `MigrationInterface` with `up(queryRunner)` and `down(queryRunner)` methods using raw SQL. Existing migrations use destructive `down()` methods (DROP TABLE, DROP COLUMN). No existing migration uses an irreversible/no-op `down()` — this backfill migration will be the first.

Migration CLI scripts in `package.json`:
- `migration:run` — `typeorm-ts-node-commonjs migration:run -d data-source.ts`
- `migration:revert` — `typeorm-ts-node-commonjs migration:revert -d data-source.ts`
- `migration:show` — `typeorm-ts-node-commonjs migration:show -d data-source.ts`

Migration tests follow the pattern in `credit-balance-migration.spec.ts`: instantiate the migration class, mock `queryRunner.query`, capture SQL strings, and verify content/structure.

---

## 3. Architecture Decision — AMENDED (v3)

### 3.1 Atomic Transaction Design

**Selected:** Wrap all new-user creation paths in a single `DataSource.transaction()` that commits User + CreditBalance (+ OauthAccount + VerificationToken where applicable) atomically.

**Invariant:** No registration path may return a newly created user without a valid `credit_balances` row. If any insert fails, the entire transaction rolls back.

### 3.2 No Balance-Conflict Catching Inside Transaction

**Previous plan (REJECTED):** Catch PostgreSQL `23505` on `CreditBalance` insert inside the transaction and continue.

**Why rejected:**
1. In PostgreSQL, a failed statement leaves the transaction in an aborted state. Merely catching the JavaScript exception does NOT make the transaction safely committable. Subsequent writes within the same transaction will fail with `current transaction is aborted`.
2. For a genuinely new user UUID (just created within the same transaction), an existing `(owner_id, owner_type)` balance row is impossible. A balance UNIQUE conflict for a transaction-local UUID is an invariant violation, not a valid idempotency case.
3. Hiding UNIQUE violations risks masking unrelated database errors.

**Required behavior:** Any `CreditBalance` insert failure — including UNIQUE violations — rolls back the entire transaction. No manual savepoints.

### 3.3 Concurrent-Registration Race Handling

Concurrent registration races (two OAuth callbacks for the same user, or two email registrations with the same address) are handled OUTSIDE the failed transaction:

```
1. Pre-transaction lookups find no existing user/link
2. Transaction attempts atomic create (User + Balance + Link)
3. Transaction fails on UNIQUE constraint (user email or OAuth provider+id)
4. Catch UNIQUE violation OUTSIDE the transaction
5. Refetch the committed winner by OAuth identity or email
6. Return the winning user ONLY if it exists and is active
7. Non-UNIQUE errors and refetch failures propagate to the caller
```

This design:
- Never continues inside an aborted PostgreSQL transaction
- Never returns a user without a committed balance row
- Never hides unrelated database errors
- Handles the only plausible concurrent race (duplicate OAuth callbacks or email registrations)

### 3.4 Transaction Boundaries by Registration Path

**Email registration (`register()`):**
```
Pre-transaction:
  - Check for existing user (reject if exists)
  - Hash password (CPU work — no DB)

Transaction (atomic commit-or-rollback):
  1. manager.save(User, {...})              — insert user
  2. manager.save(CreditBalance, {...})     — insert free-plan balance
  3. manager.save(VerificationToken, {...}) — insert email verification token

Post-commit (only if transaction succeeded):
  4. sendVerificationEmail()               — external side effect

Concurrent race handler (outside transaction):
  - UNIQUE violation on user email → throw UnauthorizedException('User already exists')
  - All other errors → propagate
```

**Google OAuth (`findOrCreateGoogleUser()` — new user branch only):**
```
Pre-transaction:
  - Lookup existing OAuth link → return existing user if found
  - Lookup existing user by email → link + return if found

Transaction (atomic commit-or-rollback — new user only):
  1. manager.save(User, {...})          — insert user
  2. manager.save(CreditBalance, {...}) — insert free-plan balance
  3. manager.save(OauthAccount, {...})  — insert OAuth link

Concurrent race handler (outside transaction):
  - UNIQUE violation → refetch OAuth link → return committed winner if active
  - Refetch failure or inactive user → propagate error
```

**Apple OAuth (`findOrCreateAppleUser()` — new user branches only):**
```
Same pattern as Google, covering both private-relay and normal-email branches.
```

### 3.5 Failure and Rollback Semantics

| Failure scenario | Behavior |
|-----------------|----------|
| CreditBalance insert fails (any error) | Transaction rolls back. User row not committed. Error handled by concurrent-race handler or propagated. No email sent. No orphaned user. |
| User insert fails (duplicate email) | Transaction rolls back. No balance attempted. Concurrent-race handler catches and returns appropriate error or refetched user. |
| OauthAccount insert fails (duplicate link) | Transaction rolls back. User + balance rolled back. Concurrent-race handler refetches committed winner. |
| VerificationToken insert fails | Transaction rolls back. User + balance rolled back. No email sent. |
| External email sending fails | Transaction already committed successfully. User + balance + token persist correctly. User can request resend later. Existing acceptable behavior. |

**Key guarantee:** A newly created user row is never committed without a corresponding `credit_balances` row.

### 3.6 Idempotency Strategy

Two layers (NOT three — the previous in-transaction 23505 catch is removed):

1. **Pre-transaction checks:** Existing OAuth link lookup → existing user email lookup → skips transaction entirely for existing users. Handles repeated OAuth callbacks for known users.
2. **UNIQUE constraints at DB level:** `users.email`, `oauth_accounts.(provider, provider_account_id)`, `credit_balances.(owner_id, owner_type)` — prevent duplicates under concurrent execution. The transaction rolls back on violation; the concurrent-race handler outside the transaction resolves the race.

### 3.7 Existing-User Paths (No New Balance)

When an OAuth callback finds an existing user (by OAuth link or by email):
- Return the existing user without entering the creation transaction.
- Do NOT attempt to create a new balance row.
- The existing user's balance (if missing) is remediated by the historical backfill migration (§4).

### 3.8 Module Scope Reassessment

**`AuthModule` does NOT need to import `CreditPersistenceModule`.**

Rationale:
- `DataSource` is auto-provided by NestJS's TypeORM module — no module-level import needed.
- `manager.save(CreditBalance, {...})` and `manager.create(CreditBalance, {...})` operate on any entity registered in the TypeORM connection, regardless of which module registered it.
- `CreditBalance` is already registered globally via `CreditPersistenceModule` imported elsewhere.
- The TypeScript `import { CreditBalance } from '...'` is a class reference, not a NestJS module dependency.
- `CreditBalanceRepository` is NOT used — all balance operations go through the transaction-bound `EntityManager`.

**`auth.module.ts` is NOT modified.**

### 3.9 Private Helper Methods

```typescript
private async createFreePlanBalanceRow(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const balance = manager.create(CreditBalance, {
    ownerId: userId,
    ownerType: 'user',
    planId: 'free',
    balance: MONTHLY_CREDIT_ALLOCATIONS.free,
    monthlyAllocation: MONTHLY_CREDIT_ALLOCATIONS.free,
    rolloverBalance: 0,
    status: 'active',
    periodStart,
    periodEnd,
    resetAt: null,
  });
  await manager.save(balance);
  // No try/catch — any failure rolls back the entire transaction
}

private isUniqueConstraintViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const pgCode = (error as Error & { code?: string }).code;
  if (pgCode === '23505') return true;
  const msg = error.message ?? '';
  return msg.includes('duplicate key') || msg.includes('unique constraint');
}
```

---

## 4. Historical-User Backfill Migration

### 4.1 Problem

Provisioning only future users does not repair the defect for existing users. Every existing non-admin user without a `credit_balances` row will continue receiving `credit_balance_not_provisioned` (HTTP 402).

### 4.2 Selected Mechanism: TypeORM Data Migration

A TypeORM migration following the existing repository convention (`src/migrations/` with timestamp-based filenames, `MigrationInterface`, raw SQL, `up()`/`down()`). This is the same mechanism used by `AddProjectSlug1772600000000` for data backfill.

**Why a migration (not a maintenance script or ad-hoc SQL):**
- Migrations are tracked by TypeORM's `migrations` table — auditable and non-repeatable.
- Migrations run via `npm run migration:run` — the existing deployment tool.
- The single-user staging SQL insert from the previous plan is superseded — the migration handles all eligible users consistently.

**Irreversible data migration:** This migration uses a no-op `down()`. After deployment, backfilled balance rows may receive credit grants, deductions, plan changes, or cross billing periods — becoming indistinguishable from normally provisioned rows. Without persistent provenance, `down()` cannot safely determine which rows to delete. If backfill data is incorrect, correction must use a separately reviewed, approval-gated data-fix procedure based on read-only evidence (see §4.7).

### 4.3 Migration File

**Filename:** `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts`

### 4.4 Dry-Run / Inventory Query (executed manually before migration approval)

```sql
-- 1. Eligible users missing balance (these will be backfilled)
SELECT u.id, u.email, u.plan_type, u.is_active, u.created_at
FROM users u
WHERE u.is_active = true
  AND u.plan_type IN ('free', 'starter', 'pro', 'team')
  AND NOT EXISTS (
    SELECT 1 FROM credit_balances cb
    WHERE cb.owner_id = u.id::text AND cb.owner_type = 'user'
  )
ORDER BY u.created_at;

-- 2. Users with UNSUPPORTED plan_type (these are NOT backfilled — require manual review)
SELECT u.id, u.email, u.plan_type, u.is_active, u.created_at
FROM users u
WHERE u.is_active = true
  AND u.plan_type NOT IN ('free', 'starter', 'pro', 'team')
  AND NOT EXISTS (
    SELECT 1 FROM credit_balances cb
    WHERE cb.owner_id = u.id::text AND cb.owner_type = 'user'
  )
ORDER BY u.created_at;

-- 3. Existing balances (these remain unchanged)
SELECT cb.owner_id, cb.plan_id, cb.balance, cb.monthly_allocation, cb.status
FROM credit_balances cb
WHERE cb.owner_type = 'user';
```

If query 2 returns any rows, those users have unsupported `plan_type` values and must be resolved manually before the migration. The migration does NOT invent allocations for unknown plan types.

### 4.5 Migration `up()` Logic (SQL)

```sql
INSERT INTO credit_balances (
  id, owner_id, owner_type, plan_id,
  balance, monthly_allocation, rollover_balance,
  status, period_start, period_end, reset_at,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id::text,
  'user',
  u.plan_type,
  CASE u.plan_type
    WHEN 'free'    THEN 500
    WHEN 'starter' THEN 5000
    WHEN 'pro'     THEN 25000
    WHEN 'team'    THEN 100000
  END,
  CASE u.plan_type
    WHEN 'free'    THEN 500
    WHEN 'starter' THEN 5000
    WHEN 'pro'     THEN 25000
    WHEN 'team'    THEN 100000
  END,
  0,
  'active',
  date_trunc('month', now() AT TIME ZONE 'UTC'),
  date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month',
  NULL,
  now(),
  now()
FROM users u
WHERE u.is_active = true
  AND u.plan_type IN ('free', 'starter', 'pro', 'team')
  AND NOT EXISTS (
    SELECT 1 FROM credit_balances cb
    WHERE cb.owner_id = u.id::text AND cb.owner_type = 'user'
  );
```

Properties:
- **Derives allocation from actual `plan_type`** — does NOT assume all users are free.
- **Excludes users with existing balance** — `NOT EXISTS` subquery.
- **Excludes unsupported plan types** — `IN ('free', 'starter', 'pro', 'team')` filter.
- **Idempotent** — safe to run multiple times; `NOT EXISTS` + UNIQUE constraint prevent duplicates.
- **Uses CASE mapping** — hardcoded values match `MONTHLY_CREDIT_ALLOCATIONS` exactly (verified against `plan-definition.ts`).
- **Reports affected rows** — `queryRunner.query()` return value includes `rowCount`.

### 4.6 Migration `down()` — Documented No-Op

```typescript
public async down(): Promise<void> {
  // Irreversible data migration — no-op.
  //
  // Backfilled credit_balances rows cannot be safely identified or deleted
  // after deployment. They may have received credit grants, deductions,
  // plan changes, or crossed billing periods — becoming indistinguishable
  // from normally provisioned production rows.
  //
  // If backfill data is incorrect, use a separately reviewed,
  // approval-gated data-fix procedure based on read-only evidence.
  // See BILLING-READY-08 implementation plan §4.7.
}
```

**Why no-op (not throwing):** Existing migrations all implement `down()` — none throw. A no-op is the safest first-of-kind irreversible pattern: `migration:revert` succeeds without deleting data, and TypeORM removes the migration record from its tracking table. A future re-run of `migration:run` would re-execute `up()`, which is idempotent (no duplicates due to `NOT EXISTS` + UNIQUE constraint).

### 4.7 Operational Correction Procedure (if backfill data is incorrect)

If the backfill inserts incorrect data (wrong allocation, wrong plan mapping, wrong period boundaries), correction must follow this procedure:

1. **Read-only evidence:** Run diagnostic queries to identify affected rows and quantify the discrepancy.
2. **Correction plan:** Draft a targeted UPDATE or DELETE statement scoped to the specific affected rows, with exact WHERE clauses based on evidence.
3. **Keith approval:** Correction plan requires separate explicit approval before staging execution.
4. **Transaction:** Execute correction in a SQL transaction.
5. **Post-correction verification:** Read-only SELECT to confirm corrected state.
6. **No automatic rollback:** `migration:revert` does NOT correct data — it only removes the migration tracking record.
7. **No provenance column:** This task does not add a provenance column or audit table to distinguish backfilled rows from normally provisioned rows.

### 4.8 Unknown Plan-Type Safety

If a user has a `plan_type` value not in `('free', 'starter', 'pro', 'team')`:
- The migration `up()` skips them (filtered by `IN` clause).
- The dry-run query (§4.4 query 2) identifies them.
- They must be resolved manually before private beta.
- The migration does NOT invent an allocation for unknown plan types.

### 4.9 Migration Test Convention

A spec file following the existing `credit-balance-migration.spec.ts` pattern:

**Filename:** `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts`

Tests verify:
- `up()` SQL contains the correct INSERT...SELECT structure
- `up()` SQL filters by `is_active = true`
- `up()` SQL filters by `plan_type IN ('free', 'starter', 'pro', 'team')`
- `up()` SQL uses `NOT EXISTS` to skip users with existing balance
- `up()` SQL uses correct CASE mapping for all four plan types
- `up()` SQL uses `gen_random_uuid()` for IDs
- `up()` SQL uses UTC month boundaries for period
- `down()` performs no destructive database operation (no DELETE, DROP, UPDATE, or ALTER)
- `down()` does not call `queryRunner.query()` with any data-modifying SQL

---

## 5. Implementation Scope

### 5.1 Files to Create or Modify

| File | Action | Purpose |
|------|--------|---------|
| `services/api-gateway/src/auth/auth.service.ts` | MODIFY | Add `DataSource` injection, `Logger`, `CreditBalance` + `MONTHLY_CREDIT_ALLOCATIONS` imports. Add `createFreePlanBalanceRow(manager, userId)` + `isUniqueConstraintViolation()` helpers. Restructure `register()`, `findOrCreateGoogleUser()`, `findOrCreateAppleUser()` new-user branches with `dataSource.transaction()`. Add concurrent-race handler outside transaction. Move `sendVerificationEmail` after commit. |
| `services/api-gateway/src/auth/auth.service.spec.ts` | MODIFY | Add `DataSource` mock with transaction callback. Add 14 test cases per §6. |
| `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts` | CREATE | Historical-user backfill migration. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts` | CREATE | Migration spec following existing convention. |

### 5.2 Files NOT Modified

| File | Reason |
|------|--------|
| `services/api-gateway/src/auth/auth.module.ts` | `DataSource` is auto-provided; `CreditPersistenceModule` import not needed. |
| `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Not used — balance creation goes through transaction-bound `EntityManager`. |
| `services/api-gateway/src/auth/__tests__/auth.module.google.spec.ts` | Tests strategy provider factory only — not AuthService methods. |
| `services/api-gateway/src/auth/__tests__/auth.module.apple.spec.ts` | Tests strategy provider factory only — not AuthService methods. |

---

## 6. Tests Required

### 6.1 AuthService Tests (`auth.service.spec.ts`)

1. **Email user and balance commit atomically** — `register()` calls `dataSource.transaction`; `manager.save` is called for User, CreditBalance, and VerificationToken within the same transaction callback.

2. **Google user, OAuth account and balance commit atomically** — `findOrCreateGoogleUser()` new-user branch calls `dataSource.transaction`; `manager.save` is called for User, CreditBalance, and OauthAccount.

3. **Apple user, OAuth account and balance commit atomically** — `findOrCreateAppleUser()` new-user branches (both private relay and normal) call `dataSource.transaction`; `manager.save` is called for User, CreditBalance, and OauthAccount.

4. **Any balance insert error rolls back all writes** — mock `manager.save` to succeed for User but throw for CreditBalance. Verify `register()` rejects. Verify `sendVerificationEmail` was NOT called.

5. **No verification email sent after rollback** — same scenario as test 4. Verify the email provider mock was never called.

6. **Concurrent user/OAuth uniqueness race rolls back, refetches and returns the committed winner safely** — mock `dataSource.transaction` to throw a UNIQUE violation. Mock refetch by OAuth identity to return an active committed user. Verify the committed user is returned without error.

7. **Unrelated 23505 errors propagate** — mock `dataSource.transaction` to throw a UNIQUE violation. Mock refetch to return `null` (no committed winner found). Verify the error propagates.

8. **No new-user path returns without a balance** — verify that in all new-user paths, User and CreditBalance saves are both inside the same `dataSource.transaction` callback.

9. **Existing-user paths do not create duplicate balances** — existing OAuth link found → user returned → `dataSource.transaction` never called. Existing email user → OAuth link created → no balance attempt.

10. **Free-plan allocation and period values correct** — verify `manager.create(CreditBalance, ...)` is called with `balance: 500`, `monthlyAllocation: 500`, `planId: 'free'`, `ownerType: 'user'`, and correct UTC month boundaries.

### 6.2 Migration Tests (`backfill-credit-balances-migration.spec.ts`)

11. **Historical backfill inserts only missing eligible rows** — `up()` SQL uses `NOT EXISTS` to exclude users with existing balances and `IN (...)` to limit to known plan types.

12. **Historical backfill is idempotent** — `NOT EXISTS` subquery + UNIQUE constraint prevent duplicate inserts on repeated runs.

13. **Existing balances remain unchanged** — `up()` SQL does not UPDATE existing `credit_balances` rows.

14. **Allocation follows authoritative plan mapping** — `up()` SQL CASE expression maps `free→500`, `starter→5000`, `pro→25000`, `team→100000`. No other values are generated. Users with plan types outside this set are excluded.

15. **`down()` performs no destructive database operation** — `down()` does not call `queryRunner.query()` with any data-modifying statement (no DELETE, DROP, UPDATE, or ALTER). Verify it is a no-op.

### 6.3 Validation Commands

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- auth.service.spec
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- backfill-credit-balances-migration
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test -- credit-balance.guard.spec
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

---

## 7. Child-Slice Structure

### Slice 1 — New-User Provisioning Source + Tests (Step 2a) — COMPLETE AND LOCKED 2026-08-06
- Modified `auth.service.ts`, `auth.service.spec.ts`.
- Validation: `npm test -- auth.service.spec` PASS (1 suite, 22 tests); `npx tsc --noEmit` PASS; `npm run build` PASS; lint PASS.
- Checkpoint: `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md`
- **Boundary:** source only — no runtime, staging, database, provider, or invitation action.

### Slice 2 — Historical Backfill Migration + Tests (Step 2b) — COMPLETE AND LOCKED 2026-08-06
- Created `src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts`.
- Created `src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts` (8 tests).
- `npm test -- backfill-credit-balances-migration` — PASS (1 suite, 8 tests). `npx tsc --noEmit` — PASS. `npm run build` — PASS. Lint — PASS.
- Checkpoint: `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md`
- **Boundary:** source only — migration is not executed until staging deployment (Step 3, requires Keith approval).

### Slice 3 — Staging Deployment + Migration (Step 3)
- Push to main → pull on VPS → rebuild api-gateway.
- Run dry-run inventory queries (§4.4) to verify eligible users and identify any unsupported plan types.
- Execute `npm run migration:run` — this runs both the backfill migration and any other pending migrations.
- Verify affected-row count matches dry-run inventory.
- Verify via read-only SELECT that all eligible users now have correct balance rows.
- Restart PM2. Verify api-gateway health.
- **Requires:** separate Keith approval.
- **Boundary:** deployment + data migration only — no AI execution enablement.

### Slice 4 — Runtime Smoke + Consolidation (Step 4)
- Resume FR-04 Step 3c with `GLOBAL_EXECUTION_ENABLED=true` (requires Keith approval).
- Controlled xAI execution smoke.
- Verify HTTP 200 (not 402) on authenticated AI execute.
- Rollback `GLOBAL_EXECUTION_ENABLED=false` after smoke.
- Consolidation checkpoint.

**Note:** The previous single-user staging SQL insert (Step 3b from prior plan) is superseded by Slice 3. The migration handles all eligible users consistently. If the general migration cannot be safely completed first, the single-user insert may remain as an emergency smoke-only alternative, but the preferred sequence is the migration.

---

## 8. Runtime Safety Record

At registration time:
- `GLOBAL_EXECUTION_ENABLED` must remain `false` (operator-reported posture).
- `AI_PROVIDER=xai` may remain configured.
- `PROVIDER_XAI_ENABLED=true` may remain configured.
- No inference retry is authorized.
- FR-04 Step 3c remains BLOCKED pending BILLING-READY-08.
- No private-beta users may be invited.
- PRIVATE-BETA-INVITE-01 NOT REGISTERED.

The kill-switch state is operator-reported at registration time. Staging verification of `GLOBAL_EXECUTION_ENABLED=false` must be confirmed before any Step 3/4 work.

---

## 9. Existing User Migration Decision — AMENDED

**Previous plan:** Only one staging test user requires manual SQL backfill.

**Amended plan:** All eligible existing users require backfill via a TypeORM migration (§4). This ensures:
- No production or staging user is left without a balance row before private beta.
- The backfill is auditable (tracked in TypeORM's `migrations` table).
- The backfill is idempotent — safe to re-run after `migration:revert` (which only removes the tracking record; does not delete data).
- Plan-type mapping uses authoritative allocations — not an assumption that all users are free.
- Operational correction of incorrect backfill data requires a separately reviewed, approval-gated procedure (§4.7).

---

## 10. Things This Plan Does NOT Do

- Does not disable or weaken `CreditBalanceGuard`.
- Does not auto-provision inside `CreditBalanceGuard`.
- Does not provision on every execution request.
- Does not change any staging user to admin.
- Does not add a staging-only user bypass.
- Does not introduce provider-specific billing behavior.
- Does not hardcode `500` — uses `MONTHLY_CREDIT_ALLOCATIONS.free` (source) and CASE mapping (migration SQL).
- Does not modify locked BILLING-READY-03/04/05 checkpoints.
- Does not enable AI execution.
- Does not call any provider API.
- Does not invite users.
- Does not catch and continue after a balance insert failure inside a transaction.
- Does not introduce manual savepoints.
- Does not return a newly created user without a valid balance row.
- Does not invent allocations for unknown plan types.
- Does not modify `auth.module.ts`.
- Does not implement a destructive migration `down()` — backfill is irreversible by design.
- Does not add a provenance column or audit table to track backfilled rows.
- Does not broaden migration scope beyond inserting missing balance rows.

---

## 11. Exact Next Bounded Action

**Step 2a — New-User Provisioning Source + Tests — COMPLETE AND LOCKED 2026-08-06**
- Modified `auth.service.ts` — `DataSource` injection, `Logger`, `CreditBalance` + `MONTHLY_CREDIT_ALLOCATIONS` imports, `createFreePlanBalanceRow()` and `isUniqueConstraintViolation()` helpers, restructured new-user branches with `dataSource.transaction()`, concurrent-race handler, `sendVerificationEmail` moved after commit.
- Modified `auth.service.spec.ts` — `DataSource` mock with transaction callback, 10 atomic-transaction test cases added.
- `npm test -- auth.service.spec` — PASS (1 suite, 22 tests). `npx tsc --noEmit` — PASS. `npm run build` — PASS. Lint — PASS.
- Checkpoint: `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md`

**Step 2b — Historical Backfill Migration + Tests — COMPLETE AND LOCKED 2026-08-06:**
- Created `src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts`.
- Created `src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts` (8 tests).
- `npm test -- backfill-credit-balances-migration` PASS; `npx tsc --noEmit` PASS; `npm run build` PASS; lint PASS.
- Checkpoint: `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md`.

**Step 2 COMPLETE — both 2a and 2b locked.**

**Step 3 — Staging Deployment + Migration — NOT STARTED — requires Keith approval.**
