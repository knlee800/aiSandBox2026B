# BILLING-READY-08 Step 2b — Historical Credit-Balance Backfill Migration Checkpoint

**Task ID:** BILLING-READY-08 Step 2b
**Status:** COMPLETE AND LOCKED — 2026-08-06
**Author:** Cursor / Sonnet 4.6
**Date:** 2026-08-06
**Parent task:** BILLING-READY-08 — Free-Plan Credit Balance Provisioning (ACTIVE)
**Prior checkpoint:** `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md` (Step 2a — COMPLETE AND LOCKED)

---

## 1. Scope and Objective

Step 2b created the TypeORM historical-user backfill migration and its focused test suite.

**Objective:** Insert a `credit_balances` row for every eligible existing user who lacks one, using the authoritative plan-type allocation mapping, so that no active non-admin user is left with `credit_balance_not_provisioned` (HTTP 402) after the migration runs.

Step 2b is source-only. The migration has not been executed. No database, staging, runtime, provider, or environment action was taken.

---

## 2. Exact Files Created

| File | Action |
|------|--------|
| `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts` | CREATED — TypeORM migration implementing `MigrationInterface` |
| `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts` | CREATED — focused migration test suite (8 tests) |

No existing source files were modified during Step 2b.

---

## 3. Historical-User Defect Being Repaired

All three registration paths in `AuthService` (`register()`, `findOrCreateGoogleUser()`, `findOrCreateAppleUser()`) create the `users` row but never create a corresponding `credit_balances` row. This was true for all historical registrations before Step 2a.

`CreditBalanceGuard.canActivate()` calls `creditBalanceRepository.findByOwner(userId, 'user')` and returns HTTP 402 `credit_balance_not_provisioned` when no balance row exists.

**Consequence:** Every existing non-admin user registered before Step 2a deployment lacks a `credit_balances` row and cannot execute AI without a separate backfill.

Step 2a resolved future registrations atomically. Step 2b resolves historical users via migration.

---

## 4. Eligible-User Criteria

The migration `up()` inserts a balance only for users satisfying **all** of the following:

- `is_active = true`
- `role IN ('user', 'beta')`
- `plan_type IN ('free', 'starter', 'pro', 'team')`
- No existing `credit_balances` row where `owner_id = users.id::text` AND `owner_type = 'user'`

Users who fail any condition are excluded and receive no inserted row.

---

## 5. Role Filtering

The migration filters on `role IN ('user', 'beta')`.

- Admin users (`role = 'admin'`) are excluded — admin users are not subject to `CreditBalanceGuard` and do not require a balance row.
- Only standard users and beta users require balance provisioning.

---

## 6. Supported Plan Mapping

The migration contains a stable frozen allocation snapshot matching `MONTHLY_CREDIT_ALLOCATIONS` from `services/api-gateway/src/credit-ledger/types/plan-definition.ts`:

| `plan_type` | `balance` / `monthly_allocation` |
|-------------|----------------------------------|
| `free` | 500 |
| `starter` | 5000 |
| `pro` | 25000 |
| `team` | 100000 |

Only these four plan types are handled. All other values are excluded.

---

## 7. Frozen Migration Allocation Rationale

The migration uses a hardcoded CASE mapping (frozen snapshot) rather than a runtime reference to `MONTHLY_CREDIT_ALLOCATIONS`.

**Rationale:**
- Migrations must be deterministic and stable across time. A live reference to a TypeScript constant could produce different values if the constant changes after the migration runs.
- The CASE values are frozen to the allocations approved and authoritative at migration creation time (2026-08-06).
- If `MONTHLY_CREDIT_ALLOCATIONS` changes in future, historical backfill data is unaffected — it was provisioned under the contract in force at migration time.
- The test suite verifies that the frozen CASE values match the current `MONTHLY_CREDIT_ALLOCATIONS` contract, providing a cross-check at test time.

---

## 8. Inserted Balance Values

For each eligible user with a missing balance, the migration inserts:

| Field | Value |
|-------|-------|
| `id` | `gen_random_uuid()` |
| `owner_id` | `users.id::text` |
| `owner_type` | `'user'` |
| `plan_id` | `users.plan_type` (actual plan, not assumed `'free'`) |
| `balance` | Frozen CASE allocation for the user's `plan_type` |
| `monthly_allocation` | Same as `balance` |
| `rollover_balance` | `0` |
| `status` | `'active'` |
| `period_start` | UTC start of current calendar month |
| `period_end` | UTC start of next calendar month |
| `reset_at` | `NULL` |
| `created_at` | `now()` |
| `updated_at` | `now()` |

---

## 9. UTC Billing-Period Boundaries

```sql
period_start = date_trunc('month', now() AT TIME ZONE 'UTC')
period_end   = date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month'
```

- `period_start` is the first instant of the current UTC calendar month.
- `period_end` is the first instant of the following UTC calendar month.
- Both values are computed at migration execution time using the database's `now()`.
- These boundaries match the pattern used by the forward provisioning path in `AuthService.createFreePlanBalanceRow()`.

---

## 10. Existing-Row Preservation

The migration **only inserts**. It never updates or replaces existing `credit_balances` rows.

- The `NOT EXISTS` subquery excludes any user who already has a balance row.
- If a user has an existing balance (from any source), that row is left exactly as-is.
- Grants, deductions, and plan history on existing rows are not touched.

---

## 11. Idempotency and Conflict Protection

Two layers of protection prevent duplicate rows:

1. **`NOT EXISTS` subquery:** The `SELECT` that feeds the `INSERT` filters out users who already have a `credit_balances` row. A repeated run selects zero eligible rows for users who were backfilled in a prior run.
2. **`ON CONFLICT ("owner_id", "owner_type") DO NOTHING`:** The exact conflict target matches the UNIQUE constraint on `credit_balances.(owner_id, owner_type)`. Even if a row is inserted between the `NOT EXISTS` check and the INSERT (race condition), the conflict clause silently skips the duplicate.

Repeated migration execution is safe and produces no duplicate rows.

---

## 12. Unsupported-Plan Behavior

Users with a `plan_type` value not in `('free', 'starter', 'pro', 'team')`:

- Are **excluded** from the migration (filtered by `plan_type IN (...)` clause).
- Receive no inserted balance row.
- Must be identified by the pre-migration dry-run inventory query (§4.4 of the implementation plan) before the migration is approved for execution.
- Must be resolved manually before private beta.

The migration does not invent an allocation for unknown plan types.

---

## 13. Final Irreversible `down()` Behavior

`down()` is a **documented no-op**. It performs no SQL query and no destructive operation:

- No `DELETE`
- No `UPDATE`
- No `DROP`
- No `ALTER`
- No credit reversal
- No grant reversal
- No deduction reversal

**Rationale:** After the migration runs, backfilled balance rows may receive credit grants, deductions, plan changes, or cross billing periods — making them indistinguishable from normally provisioned rows. No persistent provenance column exists to identify which rows were created by this migration. Destructive rollback cannot be performed safely.

Running `migration:revert` removes the migration tracking record from the TypeORM `migrations` table without deleting any data. A subsequent `migration:run` would re-execute `up()`, which is idempotent.

---

## 14. Operational Correction Procedure

If the backfill inserts incorrect data (wrong allocation, wrong plan mapping, wrong period), correction must follow this procedure:

1. **Read-only evidence:** Run diagnostic queries to identify affected rows and quantify the discrepancy.
2. **Correction plan:** Draft a targeted UPDATE or DELETE scoped to specific affected rows with exact WHERE clauses based on evidence.
3. **Keith approval:** Correction plan requires separate explicit approval before staging execution.
4. **Transaction:** Execute correction in a SQL transaction.
5. **Post-correction verification:** Read-only SELECT to confirm corrected state.
6. **Do not use `migration:revert`:** It does not delete data — it only removes the migration tracking record.
7. **No provenance column:** This task does not add a provenance column. Affected rows are identified by read-only evidence only.

---

## 15. Tests Created

**File:** `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts`

Eight focused tests:

1. **Missing-balance-only insertion** — `up()` SQL uses `NOT EXISTS` to skip users with existing balances; `IN (...)` limits to known plan types.
2. **Supported frozen plan mappings** — CASE expression maps `free→500`, `starter→5000`, `pro→25000`, `team→100000`; no other values generated; verifies frozen values match current `MONTHLY_CREDIT_ALLOCATIONS` contract.
3. **Existing-balance preservation** — `up()` SQL does not contain UPDATE or replace logic for existing rows.
4. **Unsupported-plan and ineligible-user exclusion** — SQL filters by `is_active = true`, `role IN ('user', 'beta')`, and `plan_type IN (...)`.
5. **Idempotency** — SQL uses `NOT EXISTS` and `ON CONFLICT ("owner_id", "owner_type") DO NOTHING`.
6. **UTC current-month and next-month boundaries** — SQL uses `date_trunc('month', now() AT TIME ZONE 'UTC')` and `+ interval '1 month'`.
7. **No destructive mutation** — `up()` SQL does not contain DELETE, UPDATE, DROP, or ALTER targeting users, balances, grants, or deductions.
8. **`down()` performs no query or destructive operation** — `queryRunner.query` mock is not called by `down()`; no data-modifying SQL is passed.

---

## 16. Exact Validation Commands and Results

All commands run from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`.

| Command | Result |
|---------|--------|
| `npm test -- backfill-credit-balances-migration` | **PASS** — 1 suite, 8 tests |
| `npx tsc --noEmit` | **PASS** — no errors |
| `npm run build` | **PASS** — no errors |
| Edited-file lint diagnostics | **PASS** — no errors |

---

## 17. Confirmed Non-Goals and Untouched Surfaces

- Step 2a files (`auth.service.ts`, `auth.service.spec.ts`) were not modified.
- No existing source file was modified.
- No migration was executed.
- No database inventory, query, or write occurred.
- No governance documentation was modified during Step 2b implementation.
- No staging, SSH, PM2, Docker, PostgreSQL, or Redis operation occurred.
- No environment variable changed.
- `GLOBAL_EXECUTION_ENABLED` was not enabled.
- No provider API or inference request occurred.
- No frontend, translation, dependency, or package change occurred.
- No Git commit or push occurred.
- `auth.module.ts` was not modified.
- No migration was added to `data-source.ts` or any registration array manually; TypeORM discovers migrations by glob.
- No locked predecessor checkpoints were modified.

---

## 18. Migration Execution Remains Unauthorized

**The migration has not been executed and must not be executed until Step 3 is explicitly authorized by Keith.**

Required before Step 3 can begin:
- Keith's explicit approval for staging deployment and migration execution.
- Pre-migration dry-run inventory queries (§4.4 of implementation plan) must be reviewed.
- Any users with unsupported `plan_type` must be resolved before migration approval.
- `GLOBAL_EXECUTION_ENABLED` must remain `false` during Step 3 (deployment + migration only).

`npm run migration:run` must not be invoked without Step 3 authorization.

---

## 19. FR-04 Remains Blocked

FR-04 Step 3c (`GLOBAL_EXECUTION_ENABLED=true` xAI controlled execution smoke) remains **BLOCKED**.

FR-04 Step 3c cannot resume until all of the following are complete:

1. ~~BILLING-READY-08 Step 2a~~ — **COMPLETE AND LOCKED 2026-08-06**
2. ~~BILLING-READY-08 Step 2b~~ — **COMPLETE AND LOCKED 2026-08-06**
3. BILLING-READY-08 Step 3 — staging deployment + `migration:run` — **NOT STARTED — requires Keith approval**
4. BILLING-READY-08 Step 4 — runtime smoke + consolidation — **NOT STARTED — requires Keith approval**

No private-beta users may be invited. `PRIVATE-BETA-INVITE-01` is NOT REGISTERED.

---

## 20. Next Action

**BILLING-READY-08 Step 3 — Staging Deployment and Migration**

Requires **explicit Keith approval** before any action.

Step 3 actions (approval-gated):
1. Push to `main` / pull on VPS / rebuild `api-gateway`.
2. Run dry-run inventory queries (§4.4 of implementation plan) — identify eligible users and any unsupported plan types.
3. Execute `npm run migration:run` — runs all pending migrations including the backfill.
4. Verify affected-row count matches dry-run inventory.
5. Verify via read-only SELECT that all eligible users now have correct balance rows.
6. Restart PM2. Verify api-gateway health.

**Step 3 must not begin without Keith's approval.**

---

## Step 2 Overall Status

| Slice | Status |
|-------|--------|
| Step 2a — New-user provisioning source + tests | **COMPLETE AND LOCKED — 2026-08-06** |
| Step 2b — Historical backfill migration + tests | **COMPLETE AND LOCKED — 2026-08-06** |
| **Step 2 overall** | **COMPLETE** |

---

## BILLING-READY-08 Parent Status

**ACTIVE** — Step 1 COMPLETE — Step 2 COMPLETE (2a and 2b both LOCKED) — Step 3 NOT STARTED (requires Keith approval) — Step 4 NOT STARTED (requires Keith approval).

BILLING-READY-08 is not complete. Steps 3 and 4 remain pending.
