# BILLING-READY-03C1 Checkpoint — Persistent Gateway Implementation (Not Runtime-Bound)

**Task ID:** BILLING-READY-03C1
**Parent:** BILLING-READY-03 (ACTIVE)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Checkpoint file:** docs/BILLING-READY-03C1-CHECKPOINT.md

---

## Summary

Third child slice of BILLING-READY-03. Implemented `PersistentCreditDeductionGateway` using the repository layer from BILLING-READY-03B. Updated `CreditDeductionGateway` abstract base class to support async implementations via a generic type parameter with a synchronous default. Wired `sourceEventId` idempotency (duplicate detection, no double deduction, race condition fallback), atomic deduction flow (`findByOwnerForUpdate` → calculate → insert record → `deductBalance`), `balanceAfter` population, overflow capping, and per-line-item breakdown. Added comprehensive unit tests (mocked repositories). Updated barrel exports.

A follow-up type-contract fix was included in this slice: `CreditDeductionGateway` was made generic (`<TResult extends CreditDeductionResult | Promise<CreditDeductionResult> = CreditDeductionResult>`) so the default sync return type is preserved for `NoOpCreditDeductionGateway` and `CalculatingCreditDeductionGateway`, while `PersistentCreditDeductionGateway` opts into `Promise<CreditDeductionResult>` via the type parameter. This approach avoids a breaking async change on existing synchronous implementations.

No runtime binding swap occurred. `CalculatingCreditDeductionGateway` remains the bound gateway in `CreditDeductionModule` throughout this slice. No database commands were executed. No migration was run. No live billing activation occurred.

---

## Files Changed (Implementation)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/credit-deduction.gateway.ts` | Modified | Made abstract class generic: `CreditDeductionGateway<TResult extends CreditDeductionResult \| Promise<CreditDeductionResult> = CreditDeductionResult>`. Default sync return type preserved. Async implementations opt in via type parameter. |
| `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | Created | `PersistentCreditDeductionGateway extends CreditDeductionGateway<Promise<CreditDeductionResult>>`. Implements `sourceEventId` idempotency, atomic deduction flow, overflow capping, `balanceAfter` population, race condition handling via unique constraint fallback to SELECT. |
| `services/api-gateway/src/billing/credit-deduction/index.ts` | Modified | Added barrel export for `PersistentCreditDeductionGateway`. |

## Files Changed (Tests)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` | Created | Comprehensive unit tests for `PersistentCreditDeductionGateway`. Mocked `CreditBalanceRepository`, `CreditDeductionRecordRepository`. Covers: class hierarchy, new deduction with sufficient balance, overflow, zero balance, duplicate `sourceEventId` idempotency, race condition fallback, balance not found error, repository failure propagation, runtime binding invariants. |

**Total implementation: 3 source files (2 created, 1 modified) + 1 test file (created).**

---

## Files NOT Changed (Confirmed)

- `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` — not changed; `CalculatingCreditDeductionGateway` remains runtime-bound
- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` — not changed; `UsageLedgerService` async update deferred to BILLING-READY-03C2
- No files under `frontend/` changed
- No files under `database/` changed
- No `.env*` files changed
- No `docker*` files changed
- No `package*.json` files changed
- No migration executed or modified
- No Stripe/payment code touched
- No entitlement enforcement added
- No balance enforcement added (execution not blocked by zero balance)
- No database migration executed
- No Docker or PostgreSQL commands run

---

## Type Contract Fix — Generic Base Class

The original `CreditDeductionGateway` abstract class declared `applyDeduction` returning `CreditDeductionResult` (synchronous). Making it unconditionally async (`Promise<CreditDeductionResult>`) would break `NoOpCreditDeductionGateway` and `CalculatingCreditDeductionGateway`, which are synchronous and used in non-async call sites.

The fix introduces a generic type parameter with a synchronous default:

```typescript
export abstract class CreditDeductionGateway<
  TResult extends CreditDeductionResult | Promise<CreditDeductionResult> = CreditDeductionResult,
> {
  abstract applyDeduction(event: CreditDeductionEvent): TResult;
}
```

`PersistentCreditDeductionGateway` opts in:
```typescript
export class PersistentCreditDeductionGateway
  extends CreditDeductionGateway<Promise<CreditDeductionResult>>
```

All existing synchronous implementations remain type-safe and unmodified.

---

## Key Design Decisions Implemented

1. **`sourceEventId` idempotency** — First lookup via `findBySourceEventId` before any balance mutation. Duplicate returns existing result with all `skippedDuplicate: true` line items. No new record created, no balance touched.
2. **Race condition fallback** — If `INSERT` hits a unique constraint violation (PostgreSQL code `23505`), falls back to a second `SELECT` to retrieve the record inserted by the concurrent winner. Safe idempotency under concurrency.
3. **`findByOwnerForUpdate`** — Row-level lock on balance to prevent concurrent over-spend during the deduction window.
4. **Overflow capping** — `appliedCredits = min(requestedCredits, availableBalance)`, `overflowCredits = max(0, requestedCredits - availableBalance)`. Balance never goes negative.
5. **Sequential line-item budget allocation** — Remaining budget consumed in line-item order; later items overflow first when budget is exhausted.
6. **`balanceAfter` from pre-deduction math** — `balanceAfter = availableBalance - appliedCredits`. Stored with the record and returned in the result.
7. **Error propagation** — Unexpected repository errors throw and propagate; `UsageLedgerService` wraps the deduction call and suppresses non-breaking failures (unchanged from prior behavior).
8. **No runtime binding swap** — `CreditDeductionModule` still binds `CalculatingCreditDeductionGateway`. Confirmed by the invariant test: `CreditDeductionModule still binds CalculatingCreditDeductionGateway`.

---

## Acceptance Criteria — All Satisfied

### Registration (satisfied prior to this consolidation)
- [x] BILLING-READY-03C1 registered in TASKS.md
- [x] BILLING-READY-03C1 registered in TASKS_BACKLOG_FULL.md
- [x] AINOW-EXECUTION-ROADMAP.md points to BILLING-READY-03C1 as current ACTIVE child slice
- [x] Split rationale (03C1/03C2) documented
- [x] BILLING-READY-03C2 noted as future, not registered
- [x] BILLING-READY-03D noted as future, not registered
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future, not registered
- [x] One-active-task rule satisfied

### Implementation (satisfied by implementation + follow-up fix)
- [x] `PersistentCreditDeductionGateway` class implemented at `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts`
- [x] `CreditDeductionGateway` abstract class made generic with default sync return type; `PersistentCreditDeductionGateway` opts into `Promise<CreditDeductionResult>`
- [x] `sourceEventId` idempotency: duplicate `sourceEventId` returns existing result, no new row, no balance mutation
- [x] Atomic deduction flow: `findByOwnerForUpdate` → calculate → insert record → `deductBalance` → return result
- [x] `balanceAfter` correctly populated from post-deduction stored balance
- [x] `overflowCredits` correctly calculated: `max(0, requestedCredits - availableBalance)`
- [x] `appliedCredits` correctly capped at available balance: `min(requestedCredits, availableBalance)`
- [x] Unique constraint race condition handled: concurrent duplicate `sourceEventId` falls back to SELECT
- [x] Gateway error propagates as thrown exception (caught non-breakingly by `UsageLedgerService`)
- [x] `PersistentCreditDeductionGateway` barrel-exported from `index.ts`
- [x] Unit tests pass: idempotency path, new deduction path, overflow path, zero-balance path, balance-not-found error path, race condition path, repository failure propagation
- [x] `CalculatingCreditDeductionGateway` remains the bound runtime gateway (no swap)
- [x] `NoOpCreditDeductionGateway` compiles cleanly after base class generic change
- [x] `CalculatingCreditDeductionGateway` compiles cleanly after base class generic change
- [x] Existing tests continue to pass
- [x] TypeScript typecheck clean (`npx tsc --noEmit`)
- [x] Build clean (`npm run build`)

---

## Validation Evidence

### Test Suite (credit-deduction pattern)
- **Command:** `npx jest --testPathPatterns="credit-deduction"` (from `services/api-gateway/`)
- **Result:** 11 suites passed, 136 tests passed, 0 failures

### Test Suite (credit pattern — broader)
- **Command:** `npx jest --testPathPatterns="credit"` (from `services/api-gateway/`)
- **Result:** 14 suites passed, 152 tests passed, 0 failures

### TypeScript
- **Command:** `npx tsc --noEmit` (from `services/api-gateway/`)
- **Result:** Clean — no type errors

### Build
- **Command:** `npm run build` (from `services/api-gateway/`)
- **Result:** Clean — no build errors

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

- [x] BILLING-READY-03C1 exists in TASKS.md as COMPLETE and LOCKED
- [x] BILLING-READY-03C1 exists in TASKS_BACKLOG_FULL.md as COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md row 7E-c updated to COMPLETE and LOCKED
- [x] BILLING-READY-03 remains ACTIVE (parent umbrella — 03C2, 03D not yet complete)
- [x] BILLING-READY-03C2 not registered (runtime binding deferred to next slice)
- [x] BILLING-READY-03D not registered (overflow/concurrency semantics deferred)
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future/not registered
- [x] One-active-task rule satisfied (BILLING-READY-03 is the sole ACTIVE umbrella; no child slice is currently ACTIVE)

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
                                                  └── BILLING-READY-03B (DB Schema/Migration/Repos) — COMPLETE and LOCKED
                                                        └── BILLING-READY-03C1 (Persistent Gateway) — COMPLETE and LOCKED ← THIS
```

---

## Next Recommended Step

**BILLING-READY-03C2 — Controlled Runtime Binding and Async Integration.**

Register BILLING-READY-03C2: swap `CreditDeductionModule` to bind `PersistentCreditDeductionGateway`, update `UsageLedgerService.emitDeductionAttempt()` to `await` the gateway call, and validate the full pipeline against local PostgreSQL. This is the first slice where the live execution pipeline writes to the DB. High risk — keep bounded.

Do not register BILLING-READY-03C2 until this consolidation step is confirmed complete and BILLING-READY-03C1 is LOCKED.

---

## No Further Changes Needed

BILLING-READY-03C1 is fully complete. `PersistentCreditDeductionGateway` is implemented, tested, and validated. The gateway class, base class generic update, barrel export, and unit tests are all in place. No implementation files were touched during this consolidation step.
