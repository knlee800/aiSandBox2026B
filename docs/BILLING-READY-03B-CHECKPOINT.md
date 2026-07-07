# BILLING-READY-03B Checkpoint — DB Schema, Migration, and Repository Foundation

**Task ID:** BILLING-READY-03B
**Parent:** BILLING-READY-03 (ACTIVE)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Checkpoint file:** docs/BILLING-READY-03B-CHECKPOINT.md

---

## Summary

Second child slice of BILLING-READY-03. Implemented the TypeORM entities, database migration, repository layer, and persistence module for credit balance persistence. Design authority: `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md`. No runtime gateway was swapped, no database commands were executed, no migration was run, no live billing activation occurred.

A UUID follow-up fix was included: the migration uses `gen_random_uuid()` (native PostgreSQL 13+), not `uuid_generate_v4()`. The `uuid-ossp` extension is not required.

---

## Files Changed (Implementation)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/entities/credit-balance.entity.ts` | Created | `CreditBalance` TypeORM entity — `credit_balances` table schema per design doc Section 2 |
| `services/api-gateway/src/entities/credit-deduction-record.entity.ts` | Created | `CreditDeductionRecord` TypeORM entity — `credit_deduction_records` table schema per design doc Section 3 |
| `services/api-gateway/src/entities/index.ts` | Modified | Added barrel exports for `CreditBalance` and `CreditDeductionRecord` |
| `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts` | Created | TypeORM migration — UP creates both tables + all indexes; DOWN drops cleanly |
| `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Created | `CreditBalanceRepository` — `findByOwner`, `findByOwnerForUpdate`, `create`, `deductBalance`, `resetForNewPeriod` |
| `services/api-gateway/src/billing/credit-deduction/credit-deduction-record.repository.ts` | Created | `CreditDeductionRecordRepository` — `findBySourceEventId`, `create`, `findByOwner`, `findBySession`, `findByExecution` |
| `services/api-gateway/src/billing/credit-deduction/credit-persistence.module.ts` | Created | `CreditPersistenceModule` — registers TypeORM feature entities and repository providers; exportable for 03C |
| `services/api-gateway/src/billing/credit-deduction/index.ts` | Modified | Added barrel exports for `CreditPersistenceModule`, `CreditBalanceRepository`, `CreditDeductionRecordRepository`, and new param types |

## Files Changed (Tests)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance.entity.spec.ts` | Created | Unit tests for `CreditBalance` entity field mapping and decorators |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction-record.entity.spec.ts` | Created | Unit tests for `CreditDeductionRecord` entity field mapping and decorators |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance.repository.spec.ts` | Created | Unit tests for `CreditBalanceRepository` — mocked TypeORM repository |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction-record.repository.spec.ts` | Created | Unit tests for `CreditDeductionRecordRepository` — mocked TypeORM repository |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-persistence.module.spec.ts` | Created | Unit tests verifying `CreditPersistenceModule` metadata and wiring |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance-migration.spec.ts` | Created | Migration validation tests — confirms `gen_random_uuid()` usage (not `uuid_generate_v4()`), UP/DOWN SQL structure |

**Total implementation: 8 source files (5 created, 3 modified) + 6 test files (all created).**

---

## Files NOT Changed (Confirmed)

- No files under `frontend/` changed
- No files under `database/` changed
- No `.env*` files changed
- No `docker*` files changed
- No `package*.json` files changed
- No `UsageLedgerService` changed
- No gateway binding changed (`CalculatingCreditDeductionGateway` remains runtime-bound)
- No `PersistentCreditDeductionGateway` created or wired (deferred to BILLING-READY-03C)
- No Stripe/payment code touched
- No entitlement enforcement added
- No balance enforcement added (execution not blocked by zero balance)
- No database migration executed
- No Docker or PostgreSQL commands run

---

## UUID Follow-Up Fix

The initial migration draft used `uuid_generate_v4()` which requires the `uuid-ossp` extension.
The fix replaced all UUID default expressions with `gen_random_uuid()`, which is built into PostgreSQL 13+ with no extension dependency.

Confirmed in migration source:
```sql
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()
```

The migration validation test (`credit-balance-migration.spec.ts`) asserts:
- `gen_random_uuid()` is present in the UP SQL
- `uuid_generate_v4` is absent from the entire migration file

---

## Key Design Decisions Implemented

1. **One balance row per user** — `idx_credit_balances_owner` unique index on `(owner_id, owner_type)`.
2. **Integer credits** — no floating point; all credit columns are `INTEGER`.
3. **`ownerType` discriminator** — `VARCHAR(20)`, default `'user'`; enables future org billing without schema change.
4. **`sourceEventId` unique constraint** — `idx_credit_deduction_records_source_event` unique index; database-enforced idempotency.
5. **`findByOwnerForUpdate`** — uses `createQueryBuilder().setLock('pessimistic_write')` for `SELECT ... FOR UPDATE` within a transaction.
6. **JSONB `lineItems`** — matches `BillingSnapshot.lineItems` pattern; no join table.
7. **Immutable deduction records** — `CreditDeductionRecordRepository` has no UPDATE method.
8. **`CreditPersistenceModule`** — standalone NestJS module; importable by `CreditDeductionModule` during BILLING-READY-03C without further refactoring.
9. **`gen_random_uuid()`** — no `uuid-ossp` extension dependency; PostgreSQL 13+ built-in.

---

## Acceptance Criteria — All Satisfied

- [x] `CreditBalance` TypeORM entity created at `services/api-gateway/src/entities/credit-balance.entity.ts`
- [x] `CreditDeductionRecord` TypeORM entity created at `services/api-gateway/src/entities/credit-deduction-record.entity.ts`
- [x] Entity field types, column names, constraints, and decorators match design doc Section 2 exactly
- [x] Entities registered in TypeORM module configuration (via `entities/index.ts` and `CreditPersistenceModule`)
- [x] Migration file created: `services/api-gateway/src/migrations/1772100000000-CreateCreditBalanceAndDeductionTables.ts`
- [x] Migration UP creates both tables with all columns, constraints, and indexes per design doc Section 6
- [x] Migration DOWN drops both tables and all indexes cleanly
- [x] `CreditBalanceRepository` implemented with all methods from design doc Section 5.1
- [x] `CreditDeductionRecordRepository` implemented with all methods from design doc Section 5.2
- [x] `findByOwnerForUpdate` correctly uses `SELECT ... FOR UPDATE` within a transaction context
- [x] Repositories use TypeORM patterns consistent with existing codebase
- [x] Repositories registered as NestJS providers in a dedicated persistence module (`CreditPersistenceModule`)
- [x] Module importable by `CreditDeductionModule` (preparation for 03C)
- [x] Repository and entity unit tests created and passing
- [x] No gateway swap (`CalculatingCreditDeductionGateway` remains bound)
- [x] No balance enforcement (no blocking of execution)
- [x] Existing tests continue to pass
- [x] TypeScript typecheck clean (`npx tsc --noEmit`)
- [x] Build clean (`npm run build`)
- [x] UUID fix: migration uses `gen_random_uuid()`, not `uuid_generate_v4()`

---

## Validation Evidence

### Test Suite
- **Command:** `npx jest --testPathPatterns="credit"` (run from `services/api-gateway/`)
- **Result:** 13 suites passed, 122 tests passed, 0 failures
- **Suites included:** All 6 new BILLING-READY-03B test files + pre-existing credit-deduction test files

### TypeScript
- **Command:** `npx tsc --noEmit` (from `services/api-gateway/`)
- **Result:** Clean — no type errors

### Build
- **Command:** `npm run build` (from `services/api-gateway/`)
- **Result:** Clean — no build errors

### UUID Migration Validation
- **Command:** `npx jest --testPathPatterns="credit-balance-migration"` (from `services/api-gateway/`)
- **Result:** Migration test passed — `gen_random_uuid()` confirmed present, `uuid_generate_v4` confirmed absent

### Not Executed (Intentional)
- No Docker commands
- No PostgreSQL commands
- No live database migration executed
- No `typeorm migration:run` executed
- No browser smoke
- No Stripe/payment provider calls
- No runtime gateway activation

---

## Governance Consistency

- [x] BILLING-READY-03B exists in TASKS.md as COMPLETE and LOCKED
- [x] BILLING-READY-03B exists in TASKS_BACKLOG_FULL.md as COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md row 7E-b updated to COMPLETE and LOCKED
- [x] BILLING-READY-03 remains ACTIVE (parent umbrella)
- [x] BILLING-READY-03C not registered (gateway swap deferred to next slice)
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future/not registered
- [x] One-active-task rule satisfied (BILLING-READY-03 is the sole ACTIVE task)

---

## Dependency Chain

```
BILLING-READY-00 (Audit/Planning) — COMPLETE and LOCKED
  └── BILLING-READY-01A (Architecture Review) — COMPLETE and LOCKED
        └── BILLING-READY-01 (Credit Ledger Foundation) — COMPLETE and LOCKED
              └── BILLING-READY-02A (Gateway Architecture) — COMPLETE and LOCKED
                    └── BILLING-READY-02B (Runtime Wiring) — COMPLETE and LOCKED
                          └── BILLING-READY-02C (Calculation Layer) — COMPLETE and LOCKED
                                └── BILLING-READY-02D (Simulation Validation) — COMPLETE and LOCKED
                                      └── BILLING-READY-03 (Registration) — ACTIVE
                                            └── BILLING-READY-03A (Schema Design) — COMPLETE and LOCKED
                                                  └── BILLING-READY-03B (DB Schema/Migration/Repos) — COMPLETE and LOCKED ← THIS
```

---

## Next Recommended Step

**BILLING-READY-03C — Persistent Deduction Gateway.**

Register and implement BILLING-READY-03C: swap `CalculatingCreditDeductionGateway` for `PersistentCreditDeductionGateway` in the runtime wiring point. Use `CreditBalanceRepository` and `CreditDeductionRecordRepository` (now available via `CreditPersistenceModule`) to implement the full atomic deduction flow: `SELECT ... FOR UPDATE` → idempotency check → calculate → insert record → update balance → commit. Design authority: `docs/BILLING-READY-03A-SCHEMA-PERSISTENCE-DESIGN.md` Sections 4 and 7.

Do not register BILLING-READY-03C until this consolidation step is confirmed complete.

---

## No Further Changes Needed

BILLING-READY-03B is fully complete. All entities, migration, repositories, persistence module, barrel exports, and unit tests are implemented and validated. The persistence foundation is ready for BILLING-READY-03C gateway integration. No implementation files were touched during this consolidation step.
