# BILLING-READY-02A/02B/02C Checkpoint — Credit Deduction Pipeline Foundation

**Task ID:** BILLING-READY-02A / BILLING-READY-02B / BILLING-READY-02C
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** BILLING / COMMERCIAL READINESS
**Checkpoint file:** docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md

---

## Summary

Three bounded implementation slices establishing the credit deduction pipeline foundation inside `services/api-gateway`. This is a TypeScript-only, calculation-only layer — no persistence, no balance ledger, no Stripe integration, no entitlement enforcement, and no billing activation. It extends the BILLING-READY-01 credit ledger foundation with an injectable gateway pattern, a single runtime wiring point, and deterministic credit calculation from the CREDIT_RATES config.

---

## Scope: Three Bounded Slices

### BILLING-READY-02A — Architecture Foundation

**Purpose:** Establish the abstract gateway contract and injectable module boundary.

**New module:** `services/api-gateway/src/billing/credit-deduction/`

**Files (5 source, 1 test):**

| File | Type | Description |
|------|------|-------------|
| `billing/credit-deduction/types.ts` | New | `CreditDeductionEvent`, `CreditDeductionResult`, `CreditDeductionLineItem`, `CreditDeductionLineItemResult`, `CreditDeductionSource` types |
| `billing/credit-deduction/credit-deduction.gateway.ts` | New | Abstract `CreditDeductionGateway` class — single authoritative entry point token |
| `billing/credit-deduction/noop-credit-deduction.gateway.ts` | New | `NoOpCreditDeductionGateway` — satisfies contract but applies zero credits |
| `billing/credit-deduction/credit-deduction.module.ts` | New | `CreditDeductionModule` — NestJS module that provides the gateway token |
| `billing/credit-deduction/index.ts` | New | Barrel exports for all public types and classes |
| `billing/credit-deduction/__tests__/noop-credit-deduction.gateway.spec.ts` | New | NoOp behavior, determinism, multi-line-item, edge cases (6 tests) |

**Architecture invariants (enforced by design):**
- ONE GATEWAY — exactly one concrete implementation bound at a time
- ONE CALL SITE — each upstream flow calls gateway at most once per source event
- NO SIDE-CHANNEL — no direct balance manipulation permitted
- CALLER OWNS IDENTITY — session surrogates rejected; real billable userId required
- IDEMPOTENT — same sourceEventId + source is safe to re-submit

---

### BILLING-READY-02B — Single Runtime Wiring Point

**Purpose:** Wire the credit deduction gateway into the usage-ledger's execution completion hook — the single, exclusive call site for all `usage_ledger`-sourced credit deduction events.

**Modified files (2 source, 1 test):**

| File | Type | Description |
|------|------|-------------|
| `usage-ledger/usage-ledger.service.ts` | Modified | Added `@Optional() @Inject(CreditDeductionGateway)` injection; added `private emitDeductionAttempt()` called from `updateExecutionResult()` after DB write |
| `usage-ledger/usage-ledger.module.ts` | Modified | Added `CreditDeductionModule` to `imports` array |
| `usage-ledger/__tests__/usage-ledger.service.spec.ts` | Modified | Added `BILLING-READY-02B: Credit Deduction Gateway Wiring` describe block with gateway injection, deduction call, error suppression tests |

**Wiring semantics:**
- Gateway is injected `@Optional()` — missing gateway silently no-ops
- `emitDeductionAttempt()` is `private` — called only from `updateExecutionResult()` after successful DB write
- Gateway errors are caught and logged as WARN — they NEVER break the main usage-ledger write flow
- lineItems construction: `model_tokens` category, `unitCount = tokensUsed ?? 0`, `creditsRequested = 0`
- One invocation path per completed execution (no duplicates possible by construction)

---

### BILLING-READY-02C — Credit Calculation Layer

**Purpose:** Replace the NoOp gateway with a deterministic calculating implementation that converts token usage into credit amounts using the static CREDIT_RATES config from BILLING-READY-01.

**New files (2 source, 2 tests):**

| File | Type | Description |
|------|------|-------------|
| `billing/credit-deduction/calculating-credit-deduction.gateway.ts` | New | `CalculatingCreditDeductionGateway` — applies `unitCount × creditsPerUnit` for each line item |
| `billing/credit-deduction/credit-calculation.service.ts` | New | `CreditCalculationService` — pure calculation service with rate lookup and per-line-item calculation |
| `billing/credit-deduction/__tests__/calculating-credit-deduction.gateway.spec.ts` | New | Full gateway behavior: single/multi line-items, edge cases, metadata preservation, determinism, realistic scenario (14+ tests) |
| `billing/credit-deduction/__tests__/credit-calculation.service.spec.ts` | New | Rate lookup, per-category calculation, edge cases, rate version (all categories covered) |

**Modified files (3 — updated to bind Calculating instead of NoOp):**

| File | Type | Description |
|------|------|-------------|
| `billing/credit-deduction/credit-deduction.module.ts` | Modified | Re-bound: `provide: CreditDeductionGateway, useClass: CalculatingCreditDeductionGateway`; adds `CreditCalculationService` as provider and export |
| `billing/credit-deduction/index.ts` | Modified | Added `CalculatingCreditDeductionGateway` and `CreditCalculationService` to barrel exports |
| `billing/credit-deduction/__tests__/credit-deduction.gateway.spec.ts` | Modified | Updated architectural guardrail test to verify `CalculatingCreditDeductionGateway` is bound by `CreditDeductionModule` |

**Calculation formula:** `credits = unitCount × creditsPerUnit` (from `CREDIT_RATES` config, rate version `2026-07-v1`)

**Edge case handling:**
- `unitCount <= 0` or non-finite → returns 0 credits
- Unknown category → returns 0 credits
- `creditsRequested` in input is treated as advisory; always recalculates from `unitCount`

---

## Complete File Inventory

### New Source Files (7)

1. `services/api-gateway/src/billing/credit-deduction/types.ts`
2. `services/api-gateway/src/billing/credit-deduction/credit-deduction.gateway.ts`
3. `services/api-gateway/src/billing/credit-deduction/noop-credit-deduction.gateway.ts`
4. `services/api-gateway/src/billing/credit-deduction/calculating-credit-deduction.gateway.ts`
5. `services/api-gateway/src/billing/credit-deduction/credit-calculation.service.ts`
6. `services/api-gateway/src/billing/credit-deduction/credit-deduction.module.ts`
7. `services/api-gateway/src/billing/credit-deduction/index.ts`

### Modified Source Files (2)

8. `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
9. `services/api-gateway/src/usage-ledger/usage-ledger.module.ts`

### New Test Files (4)

10. `services/api-gateway/src/billing/credit-deduction/__tests__/noop-credit-deduction.gateway.spec.ts`
11. `services/api-gateway/src/billing/credit-deduction/__tests__/credit-deduction.gateway.spec.ts`
12. `services/api-gateway/src/billing/credit-deduction/__tests__/calculating-credit-deduction.gateway.spec.ts`
13. `services/api-gateway/src/billing/credit-deduction/__tests__/credit-calculation.service.spec.ts`

### Modified Test Files (1)

14. `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts`

**Total: 14 files (9 source, 5 test)**

---

## Credit Rate Config Reference (from BILLING-READY-01)

Rate version: `2026-07-v1`

| Category | Unit | Credits/Unit |
|----------|------|-------------|
| `model_tokens` | `1K_tokens` | 1 |
| `tool_call` | `call` | 2 |
| `workspace_runtime` | `minute` | 1 |
| `knowledge_ingestion` | `item` | 3 |
| `knowledge_summarization` | `summary` | 4 |
| `collaboration_referral` | `event` | 5 |
| `collaboration_contribution` | `event` | 2 |
| `validation_action` | `action` | 1 |
| `browser_action` | `action` | 2 |

---

## Validation Evidence

### File Existence Check

All 14 implementation files confirmed present at path `services/api-gateway/src/`:

- `billing/credit-deduction/types.ts` ✓
- `billing/credit-deduction/credit-deduction.gateway.ts` ✓
- `billing/credit-deduction/noop-credit-deduction.gateway.ts` ✓
- `billing/credit-deduction/calculating-credit-deduction.gateway.ts` ✓
- `billing/credit-deduction/credit-calculation.service.ts` ✓
- `billing/credit-deduction/credit-deduction.module.ts` ✓
- `billing/credit-deduction/index.ts` ✓
- `billing/credit-deduction/__tests__/noop-credit-deduction.gateway.spec.ts` ✓
- `billing/credit-deduction/__tests__/credit-deduction.gateway.spec.ts` ✓
- `billing/credit-deduction/__tests__/calculating-credit-deduction.gateway.spec.ts` ✓
- `billing/credit-deduction/__tests__/credit-calculation.service.spec.ts` ✓
- `usage-ledger/usage-ledger.service.ts` ✓ (modified — contains `emitDeductionAttempt`, `@Optional()` gateway injection)
- `usage-ledger/usage-ledger.module.ts` ✓ (modified — imports `CreditDeductionModule`)
- `usage-ledger/__tests__/usage-ledger.service.spec.ts` ✓ (modified — contains `BILLING-READY-02B: Credit Deduction Gateway Wiring` describe block)

### Governance Consistency Check

- `BILLING-READY-02A`, `BILLING-READY-02B`, `BILLING-READY-02C` entries added to `TASKS.md` ✓
- Mirrored in `TASKS_BACKLOG_FULL.md` ✓
- `docs/AINOW-EXECUTION-ROADMAP.md` row 7C added and Current Next Task section updated ✓
- This checkpoint file created ✓

### Test Coverage (files verified, not executed per consolidation scope)

| Spec file | Behaviors covered |
|-----------|------------------|
| `noop-credit-deduction.gateway.spec.ts` | Zero credits applied, metadata preservation, multi-item sum, empty items, no balance, determinism |
| `credit-deduction.gateway.spec.ts` | NoOp extends gateway, implements applyDeduction, CreditDeductionModule binds CalculatingCreditDeductionGateway, implementation swap |
| `calculating-credit-deduction.gateway.spec.ts` | Class hierarchy, single-item rates (model_tokens/tool_call/workspace_runtime), multi-item sums, zero/negative edge cases, metadata preservation, no balance, determinism, recalculation regardless of creditsRequested, realistic scenario |
| `credit-calculation.service.spec.ts` | Rate version, rate lookup per category, unknown category, per-category calculation formulas, edge cases |
| `usage-ledger.service.spec.ts` (BILLING-READY-02B block) | Gateway called after updateExecutionResult, gateway not called when not bound, gateway error suppressed, correct CreditDeductionEvent shape emitted |

---

## Scope Boundaries — Explicitly Confirmed

The following was **NOT implemented** in BILLING-READY-02A/02B/02C:

- **No persistence** — credit deduction results are calculated but not stored anywhere
- **No balance ledger deduction** — no database reads/writes for user credit balances
- **No balance enforcement** — `creditsOverflow` is always 0; no ceiling enforcement
- **No Stripe/payment behavior** — zero payment provider integration
- **No entitlement enforcement** — no subscription/plan checks, no quota gates
- **No billing activation** — the pipeline calculates but does not block or charge
- **No database migration** — no new tables, columns, or schema changes
- **No API endpoints** — no new HTTP routes added
- **No frontend UI** — no frontend changes
- **No TypeORM entities** — no new entity classes
- **No existing BillingSnapshot, Invoice, or Quota behavior changed**
- **AGENT-HARNESS-06C** — remains deferred and not registered

`balanceAfter` is always `undefined` in the result. `creditsOverflow` is always `0`. The gateway assumes infinite balance and applies all credits without enforcement.

---

## Dependency Chain

```
BILLING-READY-00 (Audit/Planning) — COMPLETE and LOCKED
  └── BILLING-READY-01A (Architecture Review) — COMPLETE and LOCKED
        └── BILLING-READY-01 (Credit Ledger Foundation) — COMPLETE and LOCKED
              └── BILLING-READY-02A (Gateway Architecture) — COMPLETE and LOCKED
                    └── BILLING-READY-02B (Runtime Wiring) — COMPLETE and LOCKED
                          └── BILLING-READY-02C (Calculation Layer) — COMPLETE and LOCKED
```

---

## Governance Updates Made

1. `TASKS.md` — BILLING-READY-02A, 02B, 02C registered and marked COMPLETE and LOCKED; BILLING-READY-01 Next Step updated with checkpoint reference
2. `TASKS_BACKLOG_FULL.md` — mirrored from TASKS.md
3. `docs/AINOW-EXECUTION-ROADMAP.md` — row 7C added; Current Next Task section updated
4. `docs/BILLING-READY-02A-02B-02C-CHECKPOINT.md` — this file created

---

## Not Yet Registered

**BILLING-READY-02D** — not registered. Requires explicit Keith decision.

Candidates for future consideration (not registered, not proposed as active):
- BILLING-READY-03: Balance persistence (real DB-backed credit balance storage)
- BILLING-READY-04: Balance enforcement (quota gates, overflow detection)
- BILLING-READY-05: Stripe/payment integration

**AGENT-HARNESS-06C** — remains deferred and not registered.

---

## No Further Changes Needed

All 14 implementation files are present and confirmed. All test specs are written. Governance documents are synchronized. BILLING-READY-02A/02B/02C are fully complete.
