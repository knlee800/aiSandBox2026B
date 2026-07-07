# BILLING-READY-02D Checkpoint — Credit Deduction Pipeline Simulation-Only Validation

**Task ID:** BILLING-READY-02D
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / CREDIT DEDUCTION PIPELINE
**Checkpoint file:** docs/BILLING-READY-02D-CHECKPOINT.md

---

## Summary

Simulation-only validation of the complete credit deduction pipeline before database persistence is introduced. A single bounded test slice added to the existing `calculating-credit-deduction.gateway.spec.ts` test file, exercising the full `CreditDeductionEvent` → `applyDeduction` → `CreditDeductionResult` flow. No production source files changed. No persistence, no balance enforcement, no Stripe, no database changes, no frontend changes.

---

## Scope

**Nature:** VALIDATION — simulation-only pipeline test, no persistence, no DB  
**Risk:** Low (pure test/validation slice, no side effects, no DB access)

### What This Task Did

Added a `describe('BILLING-READY-02D: simulation-only pipeline validation', ...)` block to the existing `calculating-credit-deduction.gateway.spec.ts` spec file, containing two simulation validation tests:

1. **`simulates CreditDeductionEvent -> applyDeduction -> CreditDeductionResult with deterministic calculated credits`** — Validates the full pipeline end-to-end: multi-line-item event (model_tokens + tool_call + workspace_runtime) through `CalculatingCreditDeductionGateway.applyDeduction()`, verifying `sourceEventId` contract, deterministic credit calculation, `creditsApplied` semantics, zero overflow, and undefined `balanceAfter`.

2. **`pre-persistence behavior: duplicate sourceEventId is NOT deduplicated and produces two identical calculated results`** — Validates that before persistence is introduced, the gateway does not deduplicate by `sourceEventId`, and that two invocations with the same `sourceEventId` return identical deterministic results with `skippedDuplicate = false`.

---

## Exact Implementation File Changed

| File | Change |
|------|--------|
| `services/api-gateway/src/billing/credit-deduction/__tests__/calculating-credit-deduction.gateway.spec.ts` | Added `BILLING-READY-02D: simulation-only pipeline validation` describe block (2 new tests) |

**Total: 1 test file modified.**

---

## Scope Boundaries — Explicitly Confirmed NOT Implemented

- **No production source changes** — zero changes to any source file outside `__tests__/`
- **No persistence** — credit deduction results are calculated but not stored
- **No balance mutation or storage** — no database reads/writes for user credit balances
- **No balance enforcement** — `creditsOverflow` is always 0; no ceiling enforcement
- **No Stripe/payment behavior** — zero payment provider integration
- **No entitlement enforcement** — no subscription/plan checks, no quota gates
- **No billing activation** — the pipeline calculates but does not block or charge
- **No database migration** — no new tables, columns, or schema changes
- **No API endpoints** — no new HTTP routes
- **No frontend UI** — no frontend changes
- **No TypeORM entities** — no new entity classes
- **AGENT-HARNESS-06C** — remains deferred and not registered
- **BILLING-READY-03** — not registered

`balanceAfter` is always `undefined`. `creditsOverflow` is always `0`. The gateway assumes infinite balance and applies all credits without enforcement.

---

## Simulation Tests — Behavioral Coverage

### Pipeline Simulation Test (test 1)

**Input event:** `source: 'usage_ledger'`, `sourceEventId: 'sim-evt-unique-001'`, `ownerId: 'user-sim-001'`, 3 line items:
- `model_tokens` / `1K_tokens` / `unitCount: 8.5` → `8.5 credits`
- `tool_call` / `call` / `unitCount: 2` → `4 credits`
- `workspace_runtime` / `minute` / `unitCount: 1` → `1 credit`

**Validated assertions:**
- `result.sourceEventId === sourceEventId` ✓
- `result.totalCreditsApplied === expectedTotal` (calculated via `CreditCalculationService`) ✓
- `result.totalCreditsRequested === expectedTotal` ✓
- `result.totalCreditsOverflow === 0` ✓
- `result.balanceAfter === undefined` ✓
- per-line `creditsApplied` matches `calculateLineItemCredits(item)` ✓
- per-line `creditsOverflow === 0` ✓
- per-line `skippedDuplicate === false` ✓

### Duplicate Event Pre-Persistence Test (test 2)

**Validates:**
- `sourceEventId: 'sim-evt-duplicate-001'` is submitted twice to `applyDeduction`
- Both results are identical (`first` equals `second`)
- `skippedDuplicate === false` on all line items in both results
- No deduplication occurs without persistence (expected pre-persistence behavior; persistence layer will add idempotency in BILLING-READY-03)

---

## Validation Evidence

### Test Runs (reported by implementor)

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="credit-deduction"` | **4 suites passed, 53 tests passed** |
| `npx jest --testPathPatterns="usage-ledger"` | **2 suites passed, 43 tests passed** |
| `npx tsc --noEmit` | **Passed — no TypeScript errors** |
| Edited-file lint | **Passed** |

### Credit Deduction Test Suite Breakdown (53 tests, 4 suites)

| Suite | Tests |
|-------|-------|
| `noop-credit-deduction.gateway.spec.ts` | NoOp behavior, metadata preservation, multi-item, edge cases |
| `credit-deduction.gateway.spec.ts` | Gateway hierarchy, module binding, implementation swap |
| `calculating-credit-deduction.gateway.spec.ts` | Class hierarchy, single/multi line items, edge cases, metadata, no balance, determinism, idempotency, **02D simulation block**, realistic scenario |
| `credit-calculation.service.spec.ts` | Rate lookup, per-category calculation, edge cases, rate version |

### Usage Ledger Test Suite (43 tests, 2 suites)

| Suite | Tests |
|-------|-------|
| `usage-ledger.service.spec.ts` | Core service behavior + BILLING-READY-02B gateway wiring block |
| `usage-ledger.controller.spec.ts` (or equivalent) | Controller/integration behavior |

---

## Acceptance Criteria — All Satisfied

- [x] Simulation validates `CreditDeductionEvent` → `CreditDeductionResult` end-to-end
- [x] `sourceEventId` contract verified before persistence layer is introduced
- [x] Duplicate event behavior validated without DB persistence
- [x] Gateway failure handling confirmed non-breaking (covered by existing `calculating-credit-deduction.gateway.spec.ts` and `usage-ledger.service.spec.ts` tests from 02C/02B)
- [x] `creditsApplied` / `creditsOverflow` / `balanceAfter` semantics confirmed correct
- [x] All simulation tests pass
- [x] No new database tables, migrations, or TypeORM entities introduced
- [x] No Stripe/payment behavior introduced
- [x] No entitlement enforcement introduced
- [x] Acceptance criteria for BILLING-READY-03 documented (see below)

---

## BILLING-READY-03 Acceptance Criteria (Pre-conditions, NOT Registered)

The following pre-persistence behavior has been confirmed by BILLING-READY-02D simulation, and defines the acceptance target for BILLING-READY-03:

1. **Persistence layer must store `CreditDeductionResult`** — the calculated result object (at minimum `sourceEventId`, `ownerId`, `occurredAt`, `totalCreditsApplied`, line items) must be persisted atomically.
2. **Idempotency via `sourceEventId` + `source`** — second submission with same `sourceEventId` + `source` must return the first stored result with `skippedDuplicate = true` on all line items; no new row created.
3. **`balanceAfter` must be populated** — after persistence, `balanceAfter` must reflect actual stored credit balance post-deduction.
4. **`creditsOverflow` must be enforced** — if `totalCreditsApplied` would exceed available balance, excess must flow to `creditsOverflow` with actual `creditsApplied` capped at available balance.
5. **Atomic deduction** — balance deduction and result persistence must occur in one database transaction.
6. **Gateway error must remain non-breaking** — persistence errors must be caught/logged as WARN and must never break the parent `usage-ledger` write flow.
7. **No Stripe/payment behavior** — BILLING-READY-03 is persistence-only; payment integration remains future scope.

---

## Dependency Chain

```
BILLING-READY-00 (Audit/Planning) — COMPLETE and LOCKED
  └── BILLING-READY-01A (Architecture Review) — COMPLETE and LOCKED
        └── BILLING-READY-01 (Credit Ledger Foundation) — COMPLETE and LOCKED
              └── BILLING-READY-02A (Gateway Architecture) — COMPLETE and LOCKED
                    └── BILLING-READY-02B (Runtime Wiring) — COMPLETE and LOCKED
                          └── BILLING-READY-02C (Calculation Layer) — COMPLETE and LOCKED
                                └── BILLING-READY-02D (Simulation-Only Validation) — COMPLETE and LOCKED
```

---

## Governance Updates Made

1. `TASKS.md` — BILLING-READY-02D marked COMPLETE and LOCKED; acceptance criteria checked
2. `TASKS_BACKLOG_FULL.md` — mirrored from TASKS.md
3. `docs/AINOW-EXECUTION-ROADMAP.md` — row 7D and Current Next Task section updated
4. `docs/BILLING-READY-02D-CHECKPOINT.md` — this file created

---

## Not Yet Registered

**BILLING-READY-03** — not registered. Requires explicit Keith decision.

Candidates for future consideration (not registered, not proposed as active):
- BILLING-READY-03: Balance persistence (real DB-backed credit balance storage and idempotent deduction)
- BILLING-READY-04: Balance enforcement (quota gates, overflow detection)
- BILLING-READY-05: Stripe/payment integration

**AGENT-HARNESS-06C** — remains deferred and not registered.

---

## No Further Changes Needed

BILLING-READY-02D is fully complete. The simulation validation test block has been added, all tests pass, TypeScript is clean, and the pre-persistence acceptance criteria for BILLING-READY-03 are now documented. No production source files were changed.
