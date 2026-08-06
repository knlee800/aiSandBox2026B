# BILLING-READY-08 Step 2a — Checkpoint

**Task ID:** BILLING-READY-08 Step 2a
**Status:** COMPLETE AND LOCKED — 2026-08-06
**Author:** Cursor / Sonnet 4.6
**Date:** 2026-08-06
**Parent task:** BILLING-READY-08 — Free-Plan Credit Balance Provisioning (ACTIVE)
**Implementation plan:** `docs/BILLING-READY-08-IMPLEMENTATION-PLAN.md`

---

## 1. Scope and Objective

Step 2a implements atomic free-plan credit-balance provisioning for all newly registered users.

**Objective:** Ensure every new-user creation path in `AuthService` atomically creates a `credit_balances` row alongside the `users` row. No newly created user may be returned or committed without a corresponding valid `credit_balances` row.

**Paths covered:**
- Email registration (`register()`)
- Google OAuth new-user creation (`findOrCreateGoogleUser()`)
- Apple OAuth new-user creation, both private-relay and normal branches (`findOrCreateAppleUser()`)

**Paths not covered by this step:**
- Historical users without a balance row — addressed by Step 2b (TypeORM migration).

---

## 2. Exact Source Files Changed

| File | Action |
|------|--------|
| `services/api-gateway/src/auth/auth.service.ts` | MODIFIED |
| `services/api-gateway/src/auth/auth.service.spec.ts` | MODIFIED |

No other source, test, migration, configuration, translation, governance, or dependency file was changed.

---

## 3. Final Atomic Architecture

All new-user creation paths use a single `DataSource.transaction()` callback:

```
dataSource.transaction(async (manager: EntityManager) => {
  1. manager.save(User, {...})           — insert user row
  2. createFreePlanBalanceRow(manager, userId)  — insert credit_balances row
  3. manager.save(<linked entity>, {...}) — insert OauthAccount or VerificationToken
})
```

The `DataSource` is injected into `AuthService` via constructor injection. This follows the established codebase pattern used by `PersistentCreditDeductionGateway`, `CreditGrantService`, `TokenQuotaGuard`, `RuntimeService`, `HealthController`, `ExecutionResultService`, and `StartupGuardService`.

`auth.module.ts` is **NOT** modified — `DataSource` is auto-provided by NestJS's TypeORM module; no module import change is required.

`CreditBalanceRepository` is **NOT** used — all balance operations go through the transaction-bound `EntityManager`.

---

## 4. Email Registration Behavior

**Method:** `register()`

```
Pre-transaction:
  - Check for existing user by email (reject if exists)
  - Hash password (CPU work, no DB)

Transaction (atomic commit-or-rollback):
  1. manager.save(User, {...})
  2. createFreePlanBalanceRow(manager, userId)
  3. manager.save(VerificationToken, {...})

Post-commit (only after successful transaction):
  4. sendVerificationEmail()   ← external side effect; never called on rollback

Concurrent race handler (outside rolled-back transaction):
  - UNIQUE violation on user email → throw UnauthorizedException('User already exists')
  - All other errors → propagate unchanged
```

**Key invariant:** Email verification is sent only after successful transaction commit. On any transaction failure, no email is sent and no user or balance row is committed.

---

## 5. Google OAuth Behavior

**Method:** `findOrCreateGoogleUser()`

**Existing-user branch:** Existing OAuth link found → return existing user. No transaction entered. No balance created.

**Email-matched branch:** Existing user by email found but no OAuth link → OAuth link created (existing path). No balance created.

**New-user branch:**

```
Transaction (atomic commit-or-rollback):
  1. manager.save(User, {...})
  2. createFreePlanBalanceRow(manager, userId)
  3. manager.save(OauthAccount, {...})   ← Google OAuth link

Concurrent race handler (outside rolled-back transaction):
  - UNIQUE violation → refetch OAuth link by provider+providerAccountId
  - Return committed winner only if found and active
  - Refetch failure or inactive user → propagate error
```

---

## 6. Apple OAuth Behavior

**Method:** `findOrCreateAppleUser()`

Two new-user branches — both covered:

**Private-relay branch** (Apple private email relay — no real email):

```
Transaction (atomic commit-or-rollback):
  1. manager.save(User, {...})
  2. createFreePlanBalanceRow(manager, userId)
  3. manager.save(OauthAccount, {...})   ← Apple OAuth link (private relay)

Concurrent race handler: same as Google.
```

**Normal-email branch** (real email from Apple):

```
Transaction (atomic commit-or-rollback):
  1. manager.save(User, {...})
  2. createFreePlanBalanceRow(manager, userId)
  3. manager.save(OauthAccount, {...})   ← Apple OAuth link (normal email)

Concurrent race handler: same as Google.
```

---

## 7. Existing-User Behavior (No New Balance)

When an OAuth callback finds an existing user (by OAuth link or by email):
- Return the existing user without entering the creation transaction.
- Do NOT attempt to create a new balance row.
- The existing user's balance (if missing) is remediated by the historical backfill migration (Step 2b).

This is confirmed by tests (see §12, test 9 below).

---

## 8. Transaction Boundaries

| Registration path | Transaction contents | Post-commit side effects |
|------------------|---------------------|--------------------------|
| Email registration | User + CreditBalance + VerificationToken | `sendVerificationEmail()` |
| Google OAuth (new user) | User + CreditBalance + OauthAccount (Google) | None |
| Apple OAuth private-relay (new user) | User + CreditBalance + OauthAccount (Apple) | None |
| Apple OAuth normal-email (new user) | User + CreditBalance + OauthAccount (Apple) | None |
| Google/Apple existing user | No transaction — return existing user | None |

---

## 9. Allocation and Billing-Period Values

**Source of truth:** `services/api-gateway/src/credit-ledger/types/plan-definition.ts`

```typescript
MONTHLY_CREDIT_ALLOCATIONS.free = 500
```

| Field | Value |
|-------|-------|
| `ownerId` | `userId` (UUID — newly created user PK) |
| `ownerType` | `'user'` |
| `planId` | `'free'` |
| `balance` | `MONTHLY_CREDIT_ALLOCATIONS.free` (500) |
| `monthlyAllocation` | `MONTHLY_CREDIT_ALLOCATIONS.free` (500) |
| `rolloverBalance` | `0` |
| `status` | `'active'` |
| `periodStart` | `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))` — UTC start of current month |
| `periodEnd` | `new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))` — UTC start of next month |
| `resetAt` | `null` |

No values are hardcoded. `MONTHLY_CREDIT_ALLOCATIONS.free` is imported from its authoritative source.

**Private helper:**

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
```

---

## 10. Error and Rollback Semantics

| Failure scenario | Behavior |
|-----------------|----------|
| `CreditBalance` insert fails (any error including UNIQUE violations) | Transaction rolls back. User row not committed. No email sent. No orphaned user. Error handled by concurrent-race handler or propagated. |
| `User` insert fails (duplicate email) | Transaction rolls back. No balance attempted. Concurrent-race handler catches and returns appropriate error or refetched user. |
| `OauthAccount` insert fails (duplicate OAuth link) | Transaction rolls back. User + balance rolled back. Concurrent-race handler refetches committed winner. |
| `VerificationToken` insert fails | Transaction rolls back. User + balance rolled back. No email sent. |
| External email sending fails | Transaction already committed. User + balance + token persist. User can request resend. Existing acceptable behavior. |

**Key guarantee:** A newly created user row is never committed without a corresponding `credit_balances` row.

**No in-transaction 23505 catch.** Catching a PostgreSQL `23505` inside a transaction does not make the transaction safely committable. Any insert failure rolls back all writes. This design was explicitly reviewed and approved in the BILLING-READY-08 implementation plan (§3.2).

---

## 11. Concurrent-Race Handling

Concurrent registration races (two OAuth callbacks for the same user, or two email registrations with the same address) are handled **outside** the failed transaction:

```
1. Pre-transaction lookups find no existing user or OAuth link
2. Transaction attempts atomic create (User + Balance + Link/Token)
3. Transaction fails on UNIQUE constraint (user email or OAuth provider+id)
4. Catch UNIQUE violation OUTSIDE the rolled-back transaction
5. Refetch the committed winner by OAuth identity or email
6. Return the winning user ONLY if it exists and is active
7. Non-UNIQUE errors and refetch failures propagate to the caller
```

This design:
- Never continues inside an aborted PostgreSQL transaction
- Never returns a user without a committed balance row
- Never hides unrelated database errors
- Handles the only plausible concurrent race (duplicate OAuth callbacks or email registrations)

The private `isUniqueConstraintViolation(error)` helper classifies errors by PostgreSQL code `23505` or message fragments (`'duplicate key'`, `'unique constraint'`).

---

## 12. Tests Added or Updated

**File:** `services/api-gateway/src/auth/auth.service.spec.ts`

22 tests pass in 1 suite. The following tests were added for Step 2a:

| # | Test description |
|---|-----------------|
| 1 | Email user, balance, and verification token commit atomically — `register()` calls `dataSource.transaction`; `manager.save` called for User, CreditBalance, and VerificationToken within the same transaction callback |
| 2 | Google user, OAuth account, and balance commit atomically — `findOrCreateGoogleUser()` new-user branch calls `dataSource.transaction`; `manager.save` called for User, CreditBalance, and OauthAccount |
| 3 | Apple user, OAuth account, and balance commit atomically — `findOrCreateAppleUser()` new-user branches (both private relay and normal) call `dataSource.transaction`; `manager.save` called for User, CreditBalance, and OauthAccount |
| 4 | Any balance insert error rolls back all writes — mock `manager.save` to succeed for User but throw for CreditBalance; `register()` rejects |
| 5 | No verification email sent after rollback — same scenario as test 4; email provider mock never called |
| 6 | Concurrent user/OAuth uniqueness race rolls back, refetches, and returns the committed winner safely — mock `dataSource.transaction` to throw UNIQUE violation; mock refetch to return active committed user; committed user returned without error |
| 7 | Unrelated 23505 errors propagate — mock `dataSource.transaction` to throw UNIQUE violation; mock refetch returns `null`; error propagates |
| 8 | No new-user path returns without a balance — User and CreditBalance saves are both inside the same `dataSource.transaction` callback for all new-user paths |
| 9 | Existing-user paths do not create duplicate balances — existing OAuth link found → user returned → `dataSource.transaction` never called |
| 10 | Free-plan allocation and period values correct — `manager.create(CreditBalance, ...)` called with `balance: 500`, `monthlyAllocation: 500`, `planId: 'free'`, `ownerType: 'user'`, and correct UTC month boundaries |

---

## 13. Exact Validation Commands and Results

All validation run from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Command | Result |
|---------|--------|
| `npm test -- auth.service.spec` | **PASS** — 1 suite, 22 tests |
| `npx tsc --noEmit` | **PASS** — no type errors |
| `npm run build` | **PASS** |
| Edited-file lint diagnostics | **PASS** — no errors |

---

## 14. Confirmed Non-Goals and Untouched Surfaces

The following were explicitly confirmed as out of scope for Step 2a:

- ❌ No migration created
- ❌ No governance documents modified during implementation (only this consolidation step modifies them)
- ❌ No `auth.module.ts` changes
- ❌ No `CreditBalanceRepository` or billing entity changes
- ❌ No package or dependency changes
- ❌ No translation or frontend changes
- ❌ No staging, Docker, PostgreSQL, Redis, PM2, provider, or environment operations
- ❌ No database query or write
- ❌ No Git commit or push
- ❌ No `CreditPersistenceModule` import into `AuthModule`
- ❌ No in-transaction 23505 catch
- ❌ No weakening of `CreditBalanceGuard`
- ❌ No per-request or guard-level auto-provisioning
- ❌ No locked predecessor checkpoints modified

---

## 15. Remaining Historical-User Defect — Addressed by Step 2b

Step 2a provisions balance rows only for **newly created users** going forward.

**Remaining defect:** Every existing historical user without a `credit_balances` row continues to receive HTTP 402 `credit_balance_not_provisioned` from `CreditBalanceGuard`. This affects all non-admin users registered before this fix was deployed.

**Resolution:** Step 2b — historical backfill TypeORM migration:
- File: `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts`
- Spec: `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts`
- Inserts balance rows for all active users with `plan_type IN ('free', 'starter', 'pro', 'team')` who lack a `credit_balances` row
- Derives allocation from actual `plan_type` via CASE mapping matching `MONTHLY_CREDIT_ALLOCATIONS`
- Unknown plan types excluded — require manual review
- Idempotent: `NOT EXISTS` subquery + UNIQUE constraint prevent duplicates
- `down()` is a documented no-op — irreversible by design

---

## 16. Runtime and Staging Work Still Unauthorized

- `GLOBAL_EXECUTION_ENABLED` must remain `false` until BILLING-READY-08 implementation, deployment, and migration are all complete.
- `AI_PROVIDER=xai` may remain configured.
- `PROVIDER_XAI_ENABLED=true` may remain configured.
- No inference request is authorized.
- No database query or write is authorized.
- No staging deployment is authorized at this step.
- No migration execution (`migration:run`) is authorized at this step.
- No private-beta user invitations are authorized.
- PRIVATE-BETA-INVITE-01 NOT REGISTERED.
- Staging verification of `GLOBAL_EXECUTION_ENABLED=false` must be confirmed before any Step 3/4 work.

Staging deployment (Step 3) and runtime smoke (Step 4) each require separate explicit Keith approval.

---

## 17. FR-04 Remains Blocked

FR-04 Step 3c (controlled xAI execution smoke) remains **BLOCKED** pending:
1. BILLING-READY-08 Step 2b (historical backfill migration + tests) — NOT STARTED
2. BILLING-READY-08 Step 3 (staging deployment + migration:run) — requires Keith approval
3. BILLING-READY-08 Step 4 (runtime smoke + consolidation) — requires Keith approval

FR-04 parent task remains ACTIVE.

---

## 18. Next Action: BILLING-READY-08 Step 2b

**Step 2b — Historical Backfill Migration + Tests** (same or new window):

1. Create `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts`
2. Create `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts`
3. Run:
   - `npm test -- backfill-credit-balances-migration` — PASS
   - `npx tsc --noEmit` — PASS
   - `npm run build` — PASS
4. Report exact files changed and validation results.

No runtime, staging, database, provider, environment, Git, or invitation action in Step 2b.
