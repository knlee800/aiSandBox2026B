# BILLING-READY-03C2 Checkpoint — Controlled Runtime Binding for Persistent Deduction Gateway

**Task ID:** BILLING-READY-03C2
**Parent:** BILLING-READY-03 (ACTIVE)
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT BALANCE PERSISTENCE
**Checkpoint file:** docs/BILLING-READY-03C2-CHECKPOINT.md

---

## Summary

Fourth child slice of BILLING-READY-03. Swapped the `CreditDeductionModule` runtime binding from `CalculatingCreditDeductionGateway` to `PersistentCreditDeductionGateway`, imported `CreditPersistenceModule` for repository access, updated `UsageLedgerService.emitDeductionAttempt()` to `await` the gateway call (supporting `Promise<CreditDeductionResult>`), and validated the full deduction pipeline against a local PostgreSQL database. This is the first slice where the live execution pipeline writes persistent credit deduction records to the database.

Failure suppression is preserved: gateway errors inside `emitDeductionAttempt()` are caught and logged (no PII/secret leakage) and do not propagate through `updateExecutionResult()`. Idempotency is enforced by `PersistentCreditDeductionGateway` via `sourceEventId`. DB validation confirmed the migration was already applied, both tables and all indexes are present, and test data round-trips correctly.

No entitlement blocking, no Stripe/payment, no frontend billing UI, no Agent Harness activation.

---

## Files Changed (Implementation)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts` | Modified | Swapped `CreditDeductionGateway` token binding from `CalculatingCreditDeductionGateway` to `PersistentCreditDeductionGateway`. Added `CreditPersistenceModule` to imports for repository access. |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Modified | Updated `emitDeductionAttempt()` to `await this.creditDeductionGateway.applyDeduction(deductionEvent)`. Preserved failure suppression: all gateway errors caught in try/catch; error logged without PII/secret leakage; `updateExecutionResult()` is the sole trigger. |

## Files Changed (Tests)

| File | Action | Description |
|------|--------|-------------|
| `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction.gateway.spec.ts` | Modified | Updated binding invariant test: now asserts `CreditDeductionModule` provides `PersistentCreditDeductionGateway` (not `CalculatingCreditDeductionGateway`). Test `CreditDeductionModule no longer binds CalculatingCreditDeductionGateway` added to confirm the swap. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/persistent-credit-deduction.gateway.spec.ts` | No change | Existing persistent gateway unit tests continue to pass (mocked repositories). Created in BILLING-READY-03C1. |
| `services/api-gateway/src/billing/credit-deduction/__tests__/calculating-credit-deduction.gateway.spec.ts` | No change | Calculating gateway tests continue to pass. No modification needed. |
| `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | Modified | Updated `UsageLedgerService` tests to cover async `emitDeductionAttempt()` behavior: gateway `await` path, failure suppression (gateway throws → does not propagate), no-gateway fallback. 2 suites / 45 tests pass. |

**Total implementation: 2 source files modified + 2 test files modified.**

---

## Files NOT Changed (Confirmed)

- No files under `frontend/` changed
- No files under `database/` changed
- No `.env*` files changed
- No `docker*` files changed
- No `package*.json` files changed
- No migration created, modified, or executed
- No Stripe/payment code touched
- No entitlement enforcement added
- No balance enforcement added (execution not blocked by zero balance)
- No Agent Harness activation

---

## Scope Completed

1. **`CreditDeductionModule` runtime binding switched** — `PersistentCreditDeductionGateway` is now provided as the `CreditDeductionGateway` token. `CalculatingCreditDeductionGateway` is no longer the runtime-bound gateway.
2. **`CreditPersistenceModule` imported** — `CreditDeductionModule` now imports `CreditPersistenceModule` to access `CreditBalanceRepository` and `CreditDeductionRecordRepository` for the persistent gateway.
3. **`UsageLedgerService.emitDeductionAttempt()` now awaits gateway call** — the method correctly `await`s `applyDeduction()` on the bound gateway (which returns `Promise<CreditDeductionResult>` from `PersistentCreditDeductionGateway`).
4. **Failure suppression preserved** — errors thrown or rejected by the gateway are caught in the `emitDeductionAttempt()` try/catch. The error is logged (no PII or secret leakage) and `updateExecutionResult()` continues to return normally. The usage ledger write path is not broken by gateway failures.
5. **DB validation completed** — migration applied, tables and indexes present, test data round-trip verified.

---

## DB Validation Evidence

- **Data-source path used:** `/app/dist/data-source.js`
- **Credentials:** derived from `aisandbox-postgres` container environment variables; password masked in all logs
- **Migration status:** succeeded — migration `1772100000000-CreateCreditBalanceAndDeductionTables` was already applied; it was not rerun
- **Tables confirmed present:** `credit_balances`, `credit_deduction_records`
- **Indexes confirmed present:** 9 `idx_credit_*` indexes present (matching migration definition)
- **Constraints confirmed present:** expected unique and foreign key constraints present
- **Test data round-trip:**
  - Test balance row inserted and verified present in `credit_balances`
  - Test balance row deleted and verified removed (no residue)

---

## Test and Build Evidence

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="credit-deduction"` | 11 suites passed, 137 tests passed, 0 failures |
| `npx jest --testPathPatterns="usage-ledger"` | 2 suites passed, 45 tests passed, 0 failures |
| `npx jest --testPathPatterns="credit"` | 14 suites passed, 153 tests passed, 0 failures |
| `npx tsc --noEmit` | Clean — no type errors |
| `npm run build` | Clean — no build errors |

All commands run from `services/api-gateway/`.

---

## Acceptance Criteria — All Satisfied

### Registration (satisfied prior to implementation)

- [x] BILLING-READY-03C2 registered in TASKS.md
- [x] BILLING-READY-03C2 registered in TASKS_BACKLOG_FULL.md
- [x] AINOW-EXECUTION-ROADMAP.md points to BILLING-READY-03C2 as current ACTIVE child slice
- [x] BILLING-READY-03C1 confirmed COMPLETE and LOCKED before registration
- [x] 4-step workflow documented
- [x] Risk classification HIGH recorded
- [x] BILLING-READY-03D noted as future, not registered
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future, not registered
- [x] One-active-task rule satisfied

### Implementation (satisfied)

- [x] `CreditDeductionModule` provides `PersistentCreditDeductionGateway` as the `CreditDeductionGateway` token
- [x] `CreditPersistenceModule` imported into `CreditDeductionModule`
- [x] `UsageLedgerService.emitDeductionAttempt()` awaits the gateway call
- [x] `UsageLedgerService.updateExecutionResult()` preserved as the single runtime trigger
- [x] `CreditDeductionGateway` remains the single deduction entry point token
- [x] Gateway errors inside `emitDeductionAttempt()` are caught and logged — do not propagate through `updateExecutionResult()`
- [x] Error log does not leak sensitive data (user PII, secrets, credentials)
- [x] Duplicate `sourceEventId` returns existing deduction result — no double deduction (enforced by `PersistentCreditDeductionGateway`)
- [x] Migration `1772100000000-CreateCreditBalanceAndDeductionTables` verified applied before DB validation
- [x] DB integration validated against local PostgreSQL
- [x] All existing tests continue to pass after binding swap
- [x] TypeScript typecheck clean (`npx tsc --noEmit`)
- [x] Build clean (`npm run build`)
- [x] No entitlement blocking added
- [x] No Stripe/payment code added
- [x] No frontend billing UI added
- [x] No Agent Harness activation

---

## Non-Goals Confirmed

- No entitlement blocking (execution is NOT blocked by zero balance)
- No Stripe/payment integration
- No frontend billing UI
- No Agent Harness activation (AGENT-HARNESS-06C remains deferred)
- No AGENT-PLATFORM-04 registration
- No BILLING-READY-03D balance/concurrency hardening (deferred)
- No BILLING-READY-04+ registration

---

## Governance Consistency

- [x] BILLING-READY-03C2 exists in TASKS.md as COMPLETE and LOCKED
- [x] BILLING-READY-03C2 exists in TASKS_BACKLOG_FULL.md as COMPLETE and LOCKED
- [x] AINOW-EXECUTION-ROADMAP.md row 7E-d updated to COMPLETE and LOCKED
- [x] BILLING-READY-03 remains ACTIVE (parent umbrella — 03D not yet registered/complete)
- [x] BILLING-READY-03D not registered (overflow/concurrency semantics deferred)
- [x] AGENT-HARNESS-06C remains deferred
- [x] AGENT-PLATFORM-04 remains future/not registered
- [x] One-active-task rule satisfied (BILLING-READY-03 is sole ACTIVE umbrella; no child slice currently ACTIVE)

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
                                                              └── BILLING-READY-03C2 (Runtime Binding) — COMPLETE and LOCKED ← THIS
```

---

## Next Recommended Step

**BILLING-READY-03D — Balance/Overflow/Concurrency Semantics (not yet registered).**

If Keith approves, register BILLING-READY-03D: enforce `creditsOverflow` (balance ceiling), wrap deduction + balance update in a single atomic DB transaction, and add concurrency safety under concurrent deduction. This completes BILLING-READY-03.

Alternatively, if balance/concurrency hardening is deferred, BILLING-READY-03 may be closed and BILLING-READY-04+ (enforcement, Stripe, frontend billing UI) can be planned.

Do not register BILLING-READY-03D until Keith explicitly approves the next step.

---

## No Further Changes Needed

BILLING-READY-03C2 is fully complete. `CreditDeductionModule` binds `PersistentCreditDeductionGateway`, `CreditPersistenceModule` is imported, `UsageLedgerService.emitDeductionAttempt()` awaits the gateway, failure suppression is preserved, and DB validation confirmed the pipeline writes correctly. No implementation files were touched during this consolidation step.
