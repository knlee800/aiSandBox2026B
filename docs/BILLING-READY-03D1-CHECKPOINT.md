# BILLING-READY-03D1 Checkpoint — Transaction Boundary and Repository Contract Hardening

**Task ID:** BILLING-READY-03D1
**Parent:** BILLING-READY-03 (ACTIVE)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Checkpoint file:** docs/BILLING-READY-03D1-CHECKPOINT.md

---

## Summary

Fifth child slice of BILLING-READY-03. First child slice of BILLING-READY-03D. Hardened atomic transaction semantics in `PersistentCreditDeductionGateway`: the balance read-lock, deduction record insert, and balance update now execute within a single TypeORM `DataSource.transaction()` call. The transactional `EntityManager` is passed into `CreditBalanceRepository.findByOwnerForUpdate()`, `CreditDeductionRecordRepository.create()`, and `CreditBalanceRepository.deductBalance()` — all three writes share the same transaction scope. A failure in any step rolls back the entire transaction, preventing partial writes.

`sourceEventId` pre-check remains outside the transaction (no lock contention for the common non-duplicate path). The 23505 unique-constraint race fallback occurs after transaction rollback, fetching the winning record and returning it as `skippedDuplicate = true`. Zero-balance overflow enforcement keeps `balanceAfter` non-negative: `appliedCredits = Math.min(totalRequestedCredits, availableBalance)`, `overflowCredits = Math.max(totalRequestedCredits - availableBalance, 0)`.

No `UsageLedgerService` changes. No `CreditDeductionModule` changes. No migration or entity changes. No entitlement blocking. No Stripe/payment. No frontend. No Agent Harness work.

---

## Files Changed (Implementation)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/persistent-credit-deduction.gateway.ts` | Modified | Wrapped new deduction flow in `this.dataSource.transaction(async (manager) => { ... })`. Transactional `EntityManager` passed to `findByOwnerForUpdate`, `create` (record), and `deductBalance`. `DataSource` injected via `@Inject(DataSource)` constructor param. |
| `services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts` | Modified | `findByOwnerForUpdate` accepts optional `manager?: EntityManager` — uses transactional query builder when provided. `deductBalance` accepts optional `manager?: EntityManager` — uses `manager.update` / `manager.findOne` when provided. |
| `services/api-gateway/src/billing/credit-deduction/credit-deduction-record.repository.ts` | Modified | `create` accepts optional `manager?: EntityManager` — uses `manager.create` / `manager.save` when provided. |

## Files Changed (Tests)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` | Modified | Tests updated for new `DataSource` dependency injection and transactional flow. Covers: happy-path deduction with transaction, zero-balance overflow, insufficient balance overflow cap, duplicate `sourceEventId` pre-check return, 23505 race fallback, missing balance error, transaction rollback on failure. 40 tests pass. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-balance.repository.spec.ts` | Modified | Tests updated to cover `findByOwnerForUpdate` with and without transactional `EntityManager`, and `deductBalance` with and without `EntityManager`. 11 tests pass. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction-record.repository.spec.ts` | Modified | Tests updated to cover `create` with and without transactional `EntityManager`. 9 tests pass. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction.gateway.spec.ts` | Modified | Additional compatibility update required by new `DataSource` dependency. Module binding invariant tests updated. |

**Total implementation: 3 source files modified + 4 test files modified.**

---

## Files NOT Changed (Confirmed)

- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` — not changed
- `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` — not changed
- No files under `frontend/` changed
- No files under `database/` changed
- No `.env*` files changed
- No `docker*` files changed
- No `package*.json` files changed
- No migration created, modified, or executed
- No entity files changed
- No Stripe/payment code touched
- No entitlement enforcement added
- No Agent Harness activation

---

## Scope Completed

1. **Atomic transaction boundary hardened** — `PersistentCreditDeductionGateway.applyDeduction()` wraps the new deduction path in `this.dataSource.transaction(async (manager) => { ... })`. The balance lock, record insert, and balance update share one transactional `EntityManager`.
2. **Balance read-lock passes transactional manager** — `findByOwnerForUpdate(ownerId, 'user', manager)` uses `manager.createQueryBuilder(CreditBalance, 'cb').setLock('pessimistic_write')` when a transactional manager is supplied.
3. **Deduction record insert passes transactional manager** — `deductionRecordRepository.create({...}, manager)` uses `manager.create` + `manager.save` within the transaction.
4. **Balance update passes transactional manager** — `creditBalanceRepository.deductBalance(balance.id, balanceAfter, manager)` uses `manager.update` + `manager.findOne` within the transaction.
5. **`sourceEventId` pre-check preserved outside transaction** — duplicate detection happens before `dataSource.transaction()` to avoid unnecessary lock contention on the common non-duplicate path.
6. **23505 race fallback preserved after transaction rollback** — if the transaction rolls back due to a unique constraint violation on `source_event_id`, the catch block fetches the existing record and returns `skippedDuplicate = true`.
7. **Zero-balance overflow enforced** — `appliedCredits = Math.min(totalRequestedCredits, availableBalance)` and `overflowCredits = Math.max(totalRequestedCredits - availableBalance, 0)` keep `balanceAfter` non-negative.
8. **`DataSource` injected** — `@Inject(DataSource) private readonly dataSource: DataSource` added to `PersistentCreditDeductionGateway` constructor.

---

## Non-Goals Confirmed

- No `UsageLedgerService` changes
- No `CreditDeductionModule` changes
- No migration or entity changes
- No DB/Docker/migration commands
- No entitlement blocking (execution is NOT blocked by zero balance)
- No Stripe/payment integration
- No frontend billing UI
- No Agent Harness activation (AGENT-HARNESS-06C remains deferred)
- No AGENT-PLATFORM-04 registration
- No BILLING-READY-03D2 or 03D3 work (remain future/not registered)
- No BILLING-READY-04+ registration
- No live concurrency stress test (deferred to BILLING-READY-03D2)

---

## Validation Evidence

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="persistent-credit-deduction.gateway"` | 1 suite passed, 40 tests passed, 0 failures |
| `npx jest --testPathPatterns="credit-balance.repository"` | 1 suite passed, 11 tests passed, 0 failures |
| `npx jest --testPathPatterns="credit-deduction-record.repository"` | 1 suite passed, 9 tests passed, 0 failures |
| `npx jest --testPathPatterns="credit-deduction"` | 11 suites passed, 151 tests passed, 0 failures |
| `npx jest --testPathPatterns="usage-ledger"` | 2 suites passed, 45 tests passed, 0 failures |
| `npx jest --testPathPatterns="credit"` | 14 suites passed, 167 tests passed, 0 failures |
| `npx tsc --noEmit` | Clean — no type errors |
| `npm run build` | Clean — no build errors |

All commands run from `services/api-gateway/`.

---

## Acceptance Criteria — All Satisfied

### Registration (satisfied prior to implementation)

- [x] BILLING-READY-03D1 registered in TASKS.md
- [x] BILLING-READY-03D1 registered in TASKS_BACKLOG_FULL.md
- [x] AINOW-EXECUTION-ROADMAP.md points to BILLING-READY-03D1 as current ACTIVE child slice
- [x] BILLING-READY-03C2 confirmed COMPLETE and LOCKED before registration
- [x] 4-step workflow documented
- [x] Risk classification HIGH recorded
- [x] Split decision recorded (03D → 03D1/03D2/03D3)
- [x] BILLING-READY-03D2 and 03D3 noted as future, not registered
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future, not registered
- [x] One-active-task rule satisfied

### Implementation (satisfied)

- [x] Atomic transaction boundary defined and hardened in `PersistentCreditDeductionGateway`
- [x] Balance read-lock + update + record insert atomic (single DB transaction)
- [x] Transaction rolls back cleanly on failure — no partial writes
- [x] `balance` floor enforced: deduction does not produce negative `balance`
- [x] Insufficient balance: `creditsOverflow` captures over-deduction amount
- [x] Duplicate `sourceEventId` under retry returns existing result — no double deduction
- [x] `CreditDeductionGateway` preserved as single deduction entry point
- [x] `UsageLedgerService.updateExecutionResult()` preserved as single runtime trigger
- [x] Gateway errors inside `emitDeductionAttempt()` caught — do not propagate through `updateExecutionResult()`
- [x] Error log does not leak sensitive data (user PII, secrets, credentials)
- [x] All relevant unit tests pass (14 suites / 167 tests for `credit` scope)
- [x] TypeScript typecheck clean (`npx tsc --noEmit`)
- [x] Build clean (`npm run build`)
- [x] No entitlement blocking added
- [x] No Stripe/payment code added
- [x] No frontend billing UI added
- [x] No Agent Harness activation

---

## Governance Consistency

- [x] BILLING-READY-03D1 exists in TASKS.md as COMPLETE and LOCKED
- [x] BILLING-READY-03D1 exists in TASKS_BACKLOG_FULL.md as COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md row 7E-e updated to COMPLETE and LOCKED
- [x] BILLING-READY-03 remains ACTIVE (parent umbrella — 03D2/03D3 not yet complete)
- [x] BILLING-READY-03D2 not registered (concurrency integration deferred)
- [x] BILLING-READY-03D3 not registered (overflow finalization deferred)
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future/not registered
- [x] One-active-task rule satisfied (no child slice currently ACTIVE; BILLING-READY-03 is sole ACTIVE umbrella)

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
                                                        └── BILLING-READY-03C1 (Persistent Gateway) — COMPLETE and LOCKED
                                                              └── BILLING-READY-03C2 (Runtime Binding) — COMPLETE and LOCKED
                                                                    └── BILLING-READY-03D1 (Transaction Boundary) — COMPLETE and LOCKED ← THIS
```

---

## Next Recommended Step

**BILLING-READY-03D2 — Concurrency/Idempotency Integration Validation (not yet registered).**

If Keith approves, register BILLING-READY-03D2: DB-level concurrency validation of concurrent deductions against a live PostgreSQL instance, race condition detection, and concurrent `sourceEventId` retry correctness. Requires 03D1 to be stable (now satisfied).

Alternatively, if concurrency integration testing is deferred, BILLING-READY-03D3 (overflow semantics finalization and BILLING-READY-03 close checkpoint) may be the next registered slice.

Do not register BILLING-READY-03D2 or 03D3 until Keith explicitly approves the next step.

---

## No Further Changes Needed

BILLING-READY-03D1 is fully complete. `PersistentCreditDeductionGateway` wraps the deduction flow in a single TypeORM transaction, repositories accept and pass transactional `EntityManager`, overflow keeps `balanceAfter` non-negative, and the 23505 race fallback returns the winning record. No implementation files were touched during this consolidation step.
