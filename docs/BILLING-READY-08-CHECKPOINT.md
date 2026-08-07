# BILLING-READY-08 — Final Consolidation Checkpoint
## Authenticated Billing Readiness + Controlled xAI Smoke

**Status:** COMPLETE AND LOCKED — 2026-08-07
**Task ID:** BILLING-READY-08
**Title:** Free-Plan Credit Balance Provisioning
**Family:** BILLING READY / CREDIT BALANCE / USER REGISTRATION / PROVISIONING
**Checkpoint created:** 2026-08-07
**Nature:** Governance-only consolidation — no implementation, database, runtime, provider, or Git action occurred during this step

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BILLING-READY-08 |
| Name | Free-Plan Credit Balance Provisioning |
| Family | BILLING READY / CREDIT BALANCE / USER REGISTRATION / PROVISIONING |
| Risk | HIGH — 4-step loop |
| Step 1 Status | COMPLETE — Registration + Implementation Plan — 2026-08-06 |
| Step 2a Status | COMPLETE AND LOCKED — New-User Provisioning Source + Tests — 2026-08-06 |
| Step 2b Status | COMPLETE AND LOCKED — Historical Backfill Migration + Tests — 2026-08-06 |
| Step 3 Status | COMPLETE AND LOCKED — Staging Deployment + Migration — 2026-08-07 |
| Step 4A (08A) Status | COMPLETE AND LOCKED — QuotaGuard Browser-Session Bypass — 2026-08-07 |
| Step 4B (08B) Status | COMPLETE AND LOCKED — usage_records.created_at Schema Remediation — 2026-08-07 |
| Step 4B Smoke Status | **PASS** — Execution ID `83acc0e9-84de-4f94-9e41-294701e38393` |
| Overall Status | **COMPLETE AND LOCKED — 2026-08-07** |
| Keith Approval | Required and recorded 2026-08-06 (Steps 1–3); Step 4B approved for controlled retry |

---

## 2. Final Status

**COMPLETE AND LOCKED — 2026-08-07**

All four parent steps complete. All predecessor sub-fixes (BILLING-READY-08A, BILLING-READY-08B) COMPLETE AND LOCKED. Controlled xAI smoke PASS. Credit deduction recorded. File action confirmed. Persistence after refresh confirmed. `GLOBAL_EXECUTION_ENABLED` returned to `false` and verified in both `.env` and PM2. No unresolved blocker remains for BILLING-READY-08.

---

## 3. Controlled xAI Smoke Evidence (Step 4B)

### Execution Identity

| Field | Value |
|-------|-------|
| Execution ID | `83acc0e9-84de-4f94-9e41-294701e38393` |
| Provider | xai |
| Selected browser model | grok-4.5 |
| Execution status | completed |
| tokens_used | 598 |

### Browser Outcome

| Check | Result |
|-------|--------|
| Execution completed successfully | ✓ PASS |
| No assistant response text returned | Acceptable — file-action-only smoke |
| File action: create `smoke-test.txt` | ✓ success |
| File created | ✓ YES |
| File content | `FR-04 controlled xAI staging smoke passed.` |
| Content correct | ✓ YES |
| Persists after refresh | ✓ YES |
| Any other file changed | ✓ NO |

### usage_records Evidence

| Field | Value |
|-------|-------|
| execution_id | `83acc0e9-84de-4f94-9e41-294701e38393` |
| execution_status | `completed` |
| provider | `xai` |
| tokens_used | `598` |

### Credit Deduction Evidence

| Field | Value |
|-------|-------|
| source_event_id | `83acc0e9-84de-4f94-9e41-294701e38393` |
| source_event_type | `usage_ledger` |
| requested_credits | 598 |
| applied_credits | 500 |
| overflow_credits | 98 |
| balance_before | 500 |
| balance_after | 0 |
| status | applied |

### Post-Execution Credit Balance

| Field | Value |
|-------|-------|
| balance | 0 |
| monthly_allocation | 500 |
| status | active |

---

## 4. Overflow Accounting — ACCEPTED BY DESIGN

**Final accounting investigation verdict: ACCEPTED BY DESIGN**

| Item | Status |
|------|--------|
| CreditBalanceGuard checks `balance > 0` only | ✓ CONFIRMED — intentional |
| Actual cost calculated post-execution | ✓ CONFIRMED — intentional |
| `appliedCredits = min(requestedCredits, availableBalance)` | ✓ CONFIRMED |
| `overflowCredits = max(requestedCredits - availableBalance, 0)` | ✓ CONFIRMED |
| `balanceAfter = availableBalance - appliedCredits` | ✓ CONFIRMED |
| Balance never becomes negative | ✓ CONFIRMED |
| Once balance reaches 0, subsequent executions blocked | ✓ CONFIRMED |
| Overflow is accounting observation / accepted platform loss in private-beta | ✓ CONFIRMED |
| BILLING-READY-03/04 architecture and tests explicitly accept this behavior | ✓ CONFIRMED |
| No fix required | ✓ CONFIRMED |
| overflow_credits = 98 | ACCEPTED BY DESIGN |
| balance correctly reached 0 | ✓ CONFIRMED |

**`credit_deduction_records.execution_id` is NULL — NOT A BLOCKER:**
- `source_event_id` contains the execution UUID — authoritative correlation/idempotency key
- `execution_id` is currently optional denormalized propagation
- Correctness, idempotency, and audit traceability remain intact

---

## 5. GLOBAL_EXECUTION_ENABLED Posture

| Location | Value | Confirmed |
|----------|-------|-----------|
| `/opt/aisandbox/.env` | `false` | ✓ |
| PM2 environment | `false` | ✓ |

`GLOBAL_EXECUTION_ENABLED` was enabled only for the controlled Step 4B smoke window and returned to `false` immediately after. Confirmed `false` in both `.env` and PM2. No further runtime action required for BILLING-READY-08.

---

## 6. Historical Blockers Resolved During BILLING-READY-08

| Blocker | Resolution |
|---------|-----------|
| Missing credit balances for existing/new users | Resolved via atomic provisioning for new users (`auth.service.ts`) + historical backfill migration (`1772700000000-BackfillCreditBalancesForExistingUsers.ts`) |
| Browser sessions incorrectly sharing legacy API-key quota | Resolved by BILLING-READY-08A — `QuotaGuard.canActivate()` early-returns `true` for `apiKeyId === 'browser-session'` |
| `usage_records.created_at` missing from TypeORM schema | Resolved by BILLING-READY-08B — `1772800000000-AddCreatedAtToUsageRecords.ts` staging migration applied |

---

## 7. Previous Failed Executions — Historical Evidence Only

| Execution ID | Nature |
|-------------|--------|
| `4a723c58-b00d-4700-a165-cb0fe3b93723` | Historical — HTTP 402 `credit_balance_not_provisioned` before credit balance backfill |
| `56f8c37a-7161-4df3-b379-8ab261fcfff4` | Historical — BullMQ schema error (`created_at` missing) before BILLING-READY-08B |
| `a9a3ba5f-5571-4209-880c-f42298e1e20f` | Historical — BullMQ schema error (`created_at` missing) before BILLING-READY-08B |

These are historical evidence only. They are not retried and must not be altered.

---

## 8. Predecessor Sub-Fix Checkpoints (Locked — Not Modified)

| Checkpoint | Status |
|-----------|--------|
| `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md` | COMPLETE AND LOCKED — 2026-08-06 |
| `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md` | COMPLETE AND LOCKED — 2026-08-06 |
| `docs/BILLING-READY-08-STEP-3-CHECKPOINT.md` | COMPLETE AND LOCKED — 2026-08-07 |
| `docs/BILLING-READY-08A-CHECKPOINT.md` | COMPLETE AND LOCKED — 2026-08-07 |
| `docs/BILLING-READY-08B-CHECKPOINT.md` | COMPLETE AND LOCKED — 2026-08-07 |

---

## 9. BILLING-READY-08A Summary (Predecessor — Locked)

**Status:** COMPLETE AND LOCKED — 2026-08-07

Root cause: `QuotaGuard` applied legacy Phase 21B API-key quota to `browser-session` sentinel identity, causing execution pipeline failure for browser users.

Fix: `QuotaGuard.canActivate()` returns `true` early for `apiKeyId === 'browser-session'`. Genuine API-key behavior unchanged. Guard ordering unchanged.

Files changed: `quota.guard.ts`, `quota.guard.spec.ts`, `ai-execution-guards.integration.spec.ts`

Validation: 2 suites, 52 tests PASS; `npx tsc --noEmit` PASS; `npm run build` PASS; lint PASS.

Checkpoint: `docs/BILLING-READY-08A-CHECKPOINT.md`

---

## 10. BILLING-READY-08B Summary (Predecessor — Locked)

**Status:** COMPLETE AND LOCKED — 2026-08-07

Root cause: `worker.processor.ts` selects `created_at` from `usage_records` but the TypeORM migration chain never added this column. All BullMQ jobs failed immediately with a schema error before any provider call.

Fix: TypeORM migration `1772800000000-AddCreatedAtToUsageRecords.ts` — `ADD COLUMN IF NOT EXISTS`, backfill from `timestamp`, `SET DEFAULT now()`, `SET NOT NULL`. Applied to staging transactionally. 0 NULL rows post-backfill.

Implementation commit: `fb63d87349bfa3891eb9f70be2feb9d00828c575`

Staging migration name: `AddCreatedAtToUsageRecords1772800000000`

Validation: 1 suite, 9/9 tests PASS; tsc PASS; build PASS; staging migration PASS.

Checkpoint: `docs/BILLING-READY-08B-CHECKPOINT.md`

---

## 11. Complete Implementation Record

### Step 2a — New-User Provisioning Source + Tests

| File | Change |
|------|--------|
| `services/api-gateway/src/auth/auth.service.ts` | `DataSource` injection; `createFreePlanBalanceRow(manager, userId)` + `isUniqueConstraintViolation()` helpers; atomic `dataSource.transaction()` in all three new-user paths; concurrent-race handler; `sendVerificationEmail` moved post-commit |
| `services/api-gateway/src/auth/auth.service.spec.ts` | `DataSource` mock with transaction callback; 10 atomic-transaction test cases added |

Validation: `npm test -- auth.service.spec` PASS (1 suite, 22 tests); `npx tsc --noEmit` PASS; `npm run build` PASS; lint PASS.

### Step 2b — Historical Backfill Migration + Tests

| File | Change |
|------|--------|
| `services/api-gateway/src/migrations/1772700000000-BackfillCreditBalancesForExistingUsers.ts` | Created — TypeORM migration; inserts balance rows for all eligible existing users deriving allocation from `plan_type`; idempotent; no-op `down()` |
| `services/api-gateway/src/billing/credit-deduction/__tests__/backfill-credit-balances-migration.spec.ts` | Created — 8 tests covering: missing-balance insertion, plan mappings, existing-balance preservation, idempotency, period boundaries, `down()` no-op |

Validation: `npm test -- backfill-credit-balances-migration` PASS (1 suite, 8 tests); `npx tsc --noEmit` PASS; `npm run build` PASS; lint PASS.

### Step 3 — Staging Deployment + Migration

- Pre-deployment staging HEAD: `df9a9ff582321a1c54e3b3566322ed70da175c19`
- Deployed HEAD: `96fe52749df2f9599bf7faa3a5dca5f594fa232b`
- Backup: `/opt/aisandbox-backups/billing-ready-08-step3a-20260806T133718Z`
- Migration `BackfillCreditBalancesForExistingUsers1772700000000`: 2 rows inserted; 0 missing post-migration
- `GLOBAL_EXECUTION_ENABLED=false` preserved throughout

### Step 4A — QuotaGuard Browser-Session Bypass (BILLING-READY-08A)

See §9 above and `docs/BILLING-READY-08A-CHECKPOINT.md`.

### Step 4B — usage_records.created_at Schema Remediation (BILLING-READY-08B)

See §10 above and `docs/BILLING-READY-08B-CHECKPOINT.md`.

---

## 12. Acceptance Criteria — Final Status

| Criterion | Status |
|-----------|--------|
| New-user provisioning atomic transaction in `AuthService` (all 3 paths) | ✓ PASS |
| `auth.service.spec.ts` — DataSource mock, 10 atomic-transaction tests | ✓ PASS |
| `npm test -- auth.service.spec` PASS (22 tests) | ✓ PASS |
| Historical backfill migration `1772700000000-BackfillCreditBalancesForExistingUsers.ts` created | ✓ PASS |
| Backfill migration spec (8 tests) PASS | ✓ PASS |
| `usage_records.created_at` migration `1772800000000-AddCreatedAtToUsageRecords.ts` created | ✓ PASS |
| Migration spec (9 tests) PASS | ✓ PASS |
| `npx tsc --noEmit` PASS (api-gateway) | ✓ PASS |
| `npm run build` PASS (api-gateway) | ✓ PASS |
| Staging deployed HEAD `96fe52749df2f9599bf7faa3a5dca5f594fa232b` | ✓ PASS |
| `BackfillCreditBalancesForExistingUsers1772700000000` executed; 2 rows inserted; 0 missing | ✓ PASS |
| `AddCreatedAtToUsageRecords1772800000000` applied; 0 NULL rows; correct type/default/not-null | ✓ PASS |
| `QuotaGuard` browser-session bypass deployed and verified (BILLING-READY-08A) | ✓ PASS |
| Controlled xAI smoke PASS — execution ID `83acc0e9-84de-4f94-9e41-294701e38393` | ✓ PASS |
| `smoke-test.txt` created with correct content | ✓ PASS |
| `smoke-test.txt` persists after refresh | ✓ PASS |
| No unrelated file changed | ✓ PASS |
| usage_records: tokens_used = 598, execution_status = completed, provider = xai | ✓ PASS |
| Credit deduction: applied_credits = 500, overflow = 98, balance_after = 0, status = applied | ✓ PASS |
| source_event_id provides authoritative execution correlation | ✓ PASS |
| overflow_credits = 98 ACCEPTED BY DESIGN — no fix required | ✓ ACCEPTED |
| `credit_deduction_records.execution_id` NULL — NOT A BLOCKER | ✓ ACCEPTED |
| `GLOBAL_EXECUTION_ENABLED=false` returned and verified in .env and PM2 | ✓ PASS |
| No further BILLING-READY-08 runtime action required | ✓ CONFIRMED |

**All acceptance criteria satisfied.**

---

## 13. FR-04 Resulting Status

| Field | Value |
|-------|-------|
| FR-04 BILLING-READY-08 blocking dependency | **RESOLVED** |
| FR-04 Step 3c | **PASS** — completed as BILLING-READY-08 Step 4B controlled smoke |
| FR-04 Step 4 | **NOT STARTED** — next required FR-04 lifecycle action |
| FR-04 overall | **ACTIVE** — Step 3c PASS — Step 4 NOT STARTED |

**BILLING-READY-08 is no longer blocking FR-04.**

FR-04 is NOT marked complete. Its own remaining acceptance criteria have not been independently satisfied at the FR-04 task level.

**Exact next FR-04 lifecycle step per the authoritative readiness plan (`docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md`):**

> **FR-04 Step 4 — Rollback + Evidence Consolidation + Checkpoint**
>
> This step must formally record the Step 3c smoke evidence into the FR-04 task record, confirm `GLOBAL_EXECUTION_ENABLED` rollback, and produce the FR-04 parent completion checkpoint. Requires Keith approval. New window. Separate task step.

---

## 14. Governance Files Updated

| File | Change |
|------|--------|
| `docs/BILLING-READY-08-CHECKPOINT.md` | Created — this document |
| `TASKS.md` | BILLING-READY-08 status → COMPLETE AND LOCKED; FR-04 task item updated; program status updated |
| `TASKS_BACKLOG_FULL.md` | BILLING-READY-08 status → COMPLETE AND LOCKED; mirrored changes |
| `docs/AINOW-EXECUTION-ROADMAP.md` | BILLING-READY-08 row and section 4 updated; FR-04 row updated |
| `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-READINESS-PLAN.md` | Section 6A updated — BILLING-READY-08 dependency resolved |

No implementation, test, translation, migration, environment, or Docker file was modified during this consolidation step.

---

## 15. Safety Confirmations

| # | Constraint | Status |
|---|-----------|--------|
| 1 | No implementation code modified in this consolidation step | CONFIRMED |
| 2 | No test files modified | CONFIRMED |
| 3 | No translation files modified | CONFIRMED |
| 4 | No migration files modified or run | CONFIRMED |
| 5 | No database modified | CONFIRMED |
| 6 | No staging/.env/runtime action | CONFIRMED |
| 7 | No services restarted | CONFIRMED |
| 8 | GLOBAL_EXECUTION_ENABLED not enabled during consolidation | CONFIRMED |
| 9 | No provider calls during consolidation | CONFIRMED |
| 10 | No additional smoke performed during consolidation | CONFIRMED |
| 11 | No Git commit or push | CONFIRMED |
| 12 | No subagents used | CONFIRMED |
| 13 | overflow_credits behavior not registered as new work | CONFIRMED |
| 14 | NULL credit_deduction_records.execution_id not registered as new work | CONFIRMED |
| 15 | All locked predecessor checkpoints preserved — not modified | CONFIRMED |
| 16 | FR-04 not marked complete (Step 4 not yet run) | CONFIRMED |
| 17 | Only approved governance files modified | CONFIRMED |

---

## 16. Locked-State Instruction

This task is **COMPLETE AND LOCKED — 2026-08-07**.

Do not modify this entry after locking except by an explicitly approved follow-up task.

The overflow_credits = 98 behavior is accepted by design. Do not register new implementation work for it.

The NULL `credit_deduction_records.execution_id` is a non-blocking accounting observation. Do not register new implementation work for it.

---

## 17. Recommended Next Action

**FR-04 Step 4 — Rollback + Evidence Consolidation + Checkpoint** (requires Keith explicit approval — new window).

This step records the Step 3c smoke evidence into the FR-04 task record, confirms `GLOBAL_EXECUTION_ENABLED=false` rollback posture, and produces the FR-04 parent completion checkpoint.

---

**BILLING-READY-08 Overall Status: COMPLETE AND LOCKED — 2026-08-07**
**BILLING-READY-08A: COMPLETE AND LOCKED — 2026-08-07**
**BILLING-READY-08B: COMPLETE AND LOCKED — 2026-08-07**
**Controlled xAI smoke: PASS — Execution ID `83acc0e9-84de-4f94-9e41-294701e38393`**
**FR-04 BILLING-READY-08 blocking dependency: RESOLVED**
**FR-04 Step 3c: PASS**
**FR-04 next step: Step 4 — Consolidation/Checkpoint (NOT STARTED)**
**Do not modify this entry after locking except by explicitly approved follow-up task.**
