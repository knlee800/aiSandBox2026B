# BILLING-READY-08B — Checkpoint
## usage_records.created_at Schema Remediation

**Status:** COMPLETE AND LOCKED — 2026-08-07
**Task ID:** BILLING-READY-08B
**Parent:** BILLING-READY-08 (Free-Plan Credit Balance Provisioning)
**Checkpoint created:** 2026-08-07
**Implementation commit:** `fb63d87349bfa3891eb9f70be2feb9d00828c575`

---

## Summary

BILLING-READY-08B added a missing `created_at` column to the `usage_records` table via a TypeORM migration in the api-gateway migration chain. The column was required by `worker.processor.ts` in ai-service but was absent from the TypeORM migration chain, causing immediate BullMQ job failure (schema error) on every execution attempt before any provider call could be made.

The schema blocker is now remediated. Staging migration has been applied and verified. The path is clear for BILLING-READY-08 Step 4B controlled retry pending explicit Keith approval.

---

## Root Cause (Confirmed)

`services/ai-service/src/worker/worker.processor.ts` (line 616) executes:

```sql
SELECT execution_status, created_at
FROM usage_records
WHERE execution_id = $1
```

`1738843200000-CreateUsageRecordsTable.ts` (api-gateway) did not include `created_at`. No subsequent TypeORM migration added it. Standalone scripts `database/090_usage_records_created_at.sql` and `database/init/100_usage_records_created_at.sql` defined the column addition but were never applied to staging — staging is managed exclusively via the TypeORM migration chain.

**Worker failure sequence:**
- Worker received BullMQ job ✓
- Worker claimed job (status: running) ✓
- `SELECT created_at FROM usage_records` → `ERROR: column "created_at" does not exist` ✗
- BullMQ job immediately failed (no provider execution, no xAI API call, no tokens consumed) ✗

**Affected executions (historical evidence — not to be retried or altered):**
- `56f8c37a-7161-4df3-b379-8ab261fcfff4`
- `a9a3ba5f-5571-4209-880c-f42298e1e20f`

---

## Files Created

| File | Description |
|------|-------------|
| `services/api-gateway/src/migrations/1772800000000-AddCreatedAtToUsageRecords.ts` | TypeORM migration — adds `created_at` column to `usage_records` |
| `services/api-gateway/src/billing/credit-deduction/__tests__/add-created-at-usage-records-migration.spec.ts` | Migration spec — 9 tests covering all migration behaviors |

**Files NOT modified:**
- `services/ai-service/src/worker/worker.processor.ts` — no change required; `queueWaitMs` telemetry path (lines 624–627) already null-safe
- Any locked checkpoint or task document
- Any billing, credit, quota, auth, frontend, or provider file

---

## Migration Implementation

### `up()` — Four-step idempotent addition

1. `ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE` — idempotent; safe for environments that already have the column via standalone scripts
2. `UPDATE usage_records SET created_at = "timestamp" WHERE created_at IS NULL` — backfills all existing rows from the existing `timestamp` column; no data loss
3. `ALTER TABLE usage_records ALTER COLUMN created_at SET DEFAULT now()` — new rows auto-populate
4. `ALTER TABLE usage_records ALTER COLUMN created_at SET NOT NULL` — enforces non-null after backfill ensures zero NULLs

### `down()` — Reversible

```sql
ALTER TABLE usage_records DROP COLUMN IF EXISTS created_at
```

Restores pre-fix state (worker fails on schema error — known state). No data loss risk (column has no foreign key dependencies).

---

## Validation Results (Source)

| Check | Result |
|-------|--------|
| `npm test -- add-created-at-usage-records-migration` | **PASS** — 1 suite, 9/9 tests |
| `npx tsc --noEmit` (api-gateway) | **PASS** |
| `npm run build` (api-gateway) | **PASS** |

---

## Staging Migration Evidence

**Pre-migration state:**
- 27 migrations applied (TypeORM migration chain)
- Only pending migration: `AddCreatedAtToUsageRecords1772800000000`
- `ERROR: column "created_at" does not exist` confirmed on staging

**Migration execution:**
- Command: `npm run migration:run` (api-gateway on staging)
- Result: **SUCCESS** — migration committed transactionally

**Post-migration schema verification:**

| Property | Value |
|----------|-------|
| `data_type` | `timestamp without time zone` |
| `column_default` | `now()` |
| `is_nullable` | `NO` |

**Backfill verification:**
```sql
SELECT COUNT(*) FROM usage_records WHERE created_at IS NULL;
-- Result: 0
```

**GLOBAL_EXECUTION_ENABLED posture throughout 08B:** `false` — preserved at all times. No inference request. No provider call. No xAI API call.

---

## Safety and Invariants

| Invariant | Status |
|-----------|--------|
| `GLOBAL_EXECUTION_ENABLED=false` preserved | ✓ Confirmed |
| No xAI provider call during 08B | ✓ Confirmed |
| No execution retry of affected executions | ✓ Not retried |
| No staging data loss | ✓ Confirmed (0 NULL rows post-backfill) |
| Migration idempotent (`ADD COLUMN IF NOT EXISTS`) | ✓ Confirmed |
| No billing/credit/quota/auth/frontend changes | ✓ Confirmed |
| BILLING-READY-08A COMPLETE AND LOCKED — not modified | ✓ Confirmed |
| All locked predecessor checkpoints intact | ✓ Confirmed |

---

## Acceptance Criteria — Final Status

| Criterion | Status |
|-----------|--------|
| `1772800000000-AddCreatedAtToUsageRecords.ts` created with correct `up()` and reversible `down()` | ✓ PASS |
| Migration spec — covers `IF NOT EXISTS`, backfill, `NOT NULL`+`DEFAULT`, `down()` reversibility, no data destruction | ✓ PASS |
| `npx tsc --noEmit` PASS (api-gateway) | ✓ PASS |
| `npm run build` PASS (api-gateway) | ✓ PASS |
| Migration spec PASS (1 suite, 9/9 tests) | ✓ PASS |
| Staging: `npm run migration:run` applies cleanly | ✓ PASS |
| Post-migration: `created_at` column present with correct type, default, not-null | ✓ PASS |
| `SELECT COUNT(*) FROM usage_records WHERE created_at IS NULL` = 0 | ✓ PASS |
| `GLOBAL_EXECUTION_ENABLED=false` preserved throughout | ✓ PASS |
| No xAI provider call during 08B implementation or staging migration | ✓ PASS |

**All acceptance criteria satisfied.**

---

## Parent / FR-04 Dependency State

| Task | Status |
|------|--------|
| BILLING-READY-08B | **COMPLETE AND LOCKED — 2026-08-07** |
| BILLING-READY-08A | COMPLETE AND LOCKED — 2026-08-07 (not modified by 08B) |
| BILLING-READY-08 (parent) | **ACTIVE** — schema blocker remediated — Step 4B may now resume — parent is NOT yet complete until Step 4B succeeds and its evidence is consolidated |
| FR-04 Step 3c | **BLOCKED** — remains blocked until BILLING-READY-08 parent completes (Step 4B success + consolidation) |

---

## What 08B Does and Does Not Establish

**08B establishes:**
- The confirmed `usage_records.created_at` schema blocker is remediated
- Staging migration is applied and verified
- Source, tsc, build, and migration spec are all PASS
- The path to BILLING-READY-08 Step 4B is now clear from the 08B blocker

**08B does NOT establish:**
- xAI execution success — no provider call occurred during 08B
- BILLING-READY-08 parent completion — Step 4B controlled retry has not yet run
- FR-04 unblocked — FR-04 Step 3c remains blocked until BILLING-READY-08 completes

---

## Next Exact Step

**BILLING-READY-08 Step 4B** — controlled xAI execution retry on staging.

Requires:
1. Explicit Keith approval for Step 4B controlled retry
2. New window (consolidation complete)
3. Confirm `GLOBAL_EXECUTION_ENABLED=false` → enable → trigger execution → verify end-to-end worker success → disable → consolidate BILLING-READY-08 parent final checkpoint

This is a separate action. 08B consolidation does not authorize it.

---

## Locked Predecessors (Not Modified)

- `docs/BILLING-READY-08-STEP-2A-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06
- `docs/BILLING-READY-08-STEP-2B-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-06
- `docs/BILLING-READY-08-STEP-3-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-07
- `docs/BILLING-READY-08A-CHECKPOINT.md` — COMPLETE AND LOCKED 2026-08-07
