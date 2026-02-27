# PHASE-43B-4-DESIGN.md
## Orphan Execution Cleanup & Reconciliation — Design

**Phase:** PHASE-43B  
**Stage:** STAGE-43B-4  
**Nature:** DESIGN → IMPLEMENTATION  
**Scope:** api-gateway ONLY  
**Date:** 2026-02-26

---

## Executive Summary

This design addresses "stuck/orphan" executions created by the two-phase execution record pattern where a `usage_records` row is written as `execution_status='pending'` but never transitions to a terminal state due to crashes, timeouts, or network failures.

### ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **Orphan definition**: `execution_status='pending'` AND `timestamp < NOW() - 5 minutes` → execution abandoned/crashed, never completed
2. **Reconciliation strategy**: Lazy reconciliation in IdempotencyGuard + explicit admin script (NO always-on background workers)
3. **Retry semantics**: `pending` (not orphan) → 409 Conflict; `pending` (orphan) → transition to `timeout`, allow retry; `timeout`/`failed` → allow retry
4. **Deterministic behavior**: Same `(user_id, request_id)` with orphaned `pending` → auto-transition to `timeout`, new execution permitted with SAME request_id (no UNIQUE violation)
5. **No quota leakage**: Orphan transition does NOT create new rows, does NOT affect quota calculation (pending records have `tokens_used=NULL`)

---

## 1. Problem Statement

### 1.1 Current Two-Phase Pattern (PHASE-43B-2)

**Flow:**
1. Write execution intent: `INSERT INTO usage_records (execution_status='pending', tokens_used=NULL, ...)`
2. Call ai-service (10-30s)
3. Update execution result: `UPDATE usage_records SET execution_status='completed', tokens_used=N, ...`

**Failure Modes:**
- **api-gateway crash** between step 1 and 3 → `pending` row never updated
- **Network timeout** (30s) → ai-service may still be processing, but api-gateway abandons request
- **Database failure** during step 3 → ai-service succeeded, but UPDATE fails
- **Client disconnect** after step 1 → request abandoned, but row remains `pending`

**Result:** Permanent `pending` rows that never transition to terminal state.

### 1.2 Current Behavior (PHASE-43B-2C)

**IdempotencyGuard logic:**
```typescript
if (existingRecord.executionStatus === 'pending') {
  // Execution in progress - return 409 Conflict
  throw new HttpException('Execution in progress', HttpStatus.CONFLICT);
}
```

**Problem:** If original execution crashed/timed out, `pending` row blocks ALL future retries with same `request_id` → **permanent 409 Conflict**.

---

## 2. Orphan Detection Policy

### 2.1 Orphan Definition

**Orphan:** `execution_status='pending'` AND `timestamp < NOW() - ORPHAN_TIMEOUT`

**ORPHAN_TIMEOUT:** 5 minutes (300 seconds)

**Rationale:**
- Typical AI execution: 10-30 seconds
- Network timeout: 30 seconds
- Safety margin: 5 minutes allows for slow executions, retries, network delays
- Conservative: Avoids false positives (marking active executions as orphans)

**Not Orphan:**
- `execution_status='pending'` AND `timestamp >= NOW() - 5 minutes` → execution still in progress

### 2.2 Terminal States

**Terminal states (no reconciliation needed):**
- `execution_status='completed'` → execution succeeded
- `execution_status='timeout'` → execution abandoned (orphan reconciliation already applied)
- `execution_status='failed'` → execution failed (reserved for future use)

**Non-terminal state (requires reconciliation):**
- `execution_status='pending'` (older than 5 minutes) → orphan

---

## 3. Reconciliation Strategy

### 3.1 Lazy Reconciliation (Primary)

**Where:** IdempotencyGuard.canActivate()

**When:** On every request with `Idempotency-Key` header

**Logic:**
```typescript
if (existingRecord.executionStatus === 'pending') {
  const age = Date.now() - existingRecord.timestamp.getTime();
  const ORPHAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  if (age > ORPHAN_TIMEOUT_MS) {
    // Orphan detected: transition to 'timeout'
    await this.usageLedgerService.transitionOrphanToTimeout(existingRecord.executionId);
    
    // Allow retry (new execution with same request_id)
    return true;
  } else {
    // Execution still in progress: return 409 Conflict
    throw new HttpException('Execution in progress', HttpStatus.CONFLICT);
  }
}
```

**Pros:**
- No background workers (aligns with architecture principles)
- Reconciliation happens on-demand (when client retries)
- Deterministic (same input → same output)
- Minimal overhead (only when `pending` record found)

**Cons:**
- Orphans remain until client retries (acceptable: orphans don't affect quota)
- No proactive cleanup (acceptable: orphans are rare)

### 3.2 Explicit Admin Script (Secondary)

**Where:** `services/api-gateway/scripts/reconcile-orphans.ts`

**When:** Manually invoked by admin (or scheduled externally if needed)

**Logic:**
```sql
UPDATE usage_records
SET execution_status = 'timeout'
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '5 minutes';
```

**Pros:**
- Proactive cleanup (can run periodically via cron if needed)
- No code changes to IdempotencyGuard (separation of concerns)
- Auditable (admin can see how many orphans were cleaned up)

**Cons:**
- Requires manual invocation (or external scheduler)
- Not automatic (orphans may accumulate if script not run)

**Verdict:** Implement both (lazy + script) for maximum flexibility.

---

## 4. Retry Semantics

### 4.1 Retry Decision Matrix

| Existing Status | Age | Action | HTTP Response | New Execution? |
|----------------|-----|--------|---------------|----------------|
| (no record) | N/A | Allow | 200 OK (new execution) | Yes |
| `completed` | Any | Replay | 200 OK (cached result) | No |
| `pending` | < 5 min | Block | 409 Conflict | No |
| `pending` | >= 5 min | Transition to `timeout`, Allow | 200 OK (new execution) | Yes |
| `timeout` | Any | Allow | 200 OK (new execution) | Yes |
| `failed` | Any | Allow | 200 OK (new execution) | Yes |

### 4.2 Idempotency Semantics After Orphan Transition

**Question:** After transitioning `pending` → `timeout`, can client retry with SAME `request_id`?

**Answer:** Yes, but with special handling.

**Problem:** UNIQUE constraint `(user_id, request_id)` prevents duplicate rows.

**Solution:** Do NOT create new row. Instead:
1. Transition orphan to `timeout` (UPDATE existing row)
2. Allow new execution to proceed
3. New execution writes NEW intent row with SAME `request_id` → **UNIQUE VIOLATION**
4. Handle violation: Fetch existing record, check status:
   - If `timeout`: Overwrite with new intent (UPDATE existing row)
   - If `completed`: Return cached result (idempotent replay)
   - If `pending`: Return 409 Conflict (concurrent execution)

**Alternative (Simpler):** After orphan transition, DELETE old row, allow new INSERT.

**Verdict:** Use UPDATE strategy (preserve audit trail, no deletions).

### 4.3 Retry with Same request_id (Detailed Flow)

**Scenario:** First request times out, client retries with same `Idempotency-Key`.

**Flow:**
```
1. First request: Write intent (status='pending', timestamp=T0)
2. First request: Call ai-service (timeout at 30s)
3. First request: Client receives timeout error
4. [5 minutes pass]
5. Client retries with same Idempotency-Key
6. IdempotencyGuard: Find existing record (status='pending', age=5min)
7. IdempotencyGuard: Detect orphan (age > 5min)
8. IdempotencyGuard: Transition to 'timeout' (UPDATE existing row)
9. IdempotencyGuard: Allow retry (return true)
10. Controller: Write new intent → UNIQUE VIOLATION (user_id, request_id)
11. UsageLedgerService: Catch violation, fetch existing record
12. UsageLedgerService: Check status='timeout' → Overwrite with new intent
13. Controller: Call ai-service (new execution)
14. Controller: Update result (status='completed')
```

**Key Insight:** Orphan transition + retry reuses existing row (no new row created).

---

## 5. Implementation Plan

### 5.1 Changes to IdempotencyGuard

**File:** `services/api-gateway/src/ai/idempotency.guard.ts`

**Change:**
```typescript
// BEFORE (Phase 43B-2C):
if (status === 'pending') {
  throw new HttpException('Execution in progress', HttpStatus.CONFLICT);
}

// AFTER (Phase 43B-4):
if (status === 'pending') {
  const age = Date.now() - existingRecord.timestamp.getTime();
  const ORPHAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  if (age > ORPHAN_TIMEOUT_MS) {
    // Orphan detected: transition to 'timeout'
    await this.usageLedgerService.transitionOrphanToTimeout(existingRecord.executionId);
    
    // Allow retry (new execution with same request_id)
    return true;
  } else {
    // Execution still in progress: return 409 Conflict
    throw new HttpException('Execution in progress', HttpStatus.CONFLICT);
  }
}
```

### 5.2 New Method in UsageLedgerService

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

**New method:**
```typescript
/**
 * Transition orphaned 'pending' execution to 'timeout'
 *
 * Phase 43B-4: Orphan Execution Cleanup & Reconciliation
 *
 * @param executionId - UUID of the orphaned execution
 * @returns Promise<void>
 * @throws Error if update fails
 *
 * Semantics:
 * - Updates execution_status from 'pending' to 'timeout'
 * - Does NOT change tokens_used (remains NULL)
 * - Does NOT change model, executionDurationMs (remain NULL)
 * - Idempotent: If already 'timeout', no-op
 * - Deterministic: Same executionId → same outcome
 */
async transitionOrphanToTimeout(executionId: string): Promise<void> {
  const result = await this.usageRecordRepository.update(
    { executionId, executionStatus: 'pending' },
    { executionStatus: 'timeout' },
  );
  
  if (result.affected === 0) {
    // Already transitioned (idempotent) or not found
    this.logger.warn(
      `Orphan transition failed: executionId=${executionId} (already transitioned or not found)`,
    );
  } else {
    this.logger.log(
      `Orphan transitioned to timeout: executionId=${executionId}`,
    );
  }
}
```

### 5.3 Handle Retry After Orphan Transition

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

**Change in `writeExecutionIntent()`:**
```typescript
// BEFORE (Phase 43B-2B):
if (dto.requestId && this.isUniqueViolation(error)) {
  // Fetch existing record, return
  const existingRecord = await this.findByRequestId(dto.userId, dto.requestId);
  return existingRecord;
}

// AFTER (Phase 43B-4):
if (dto.requestId && this.isUniqueViolation(error)) {
  // Fetch existing record
  const existingRecord = await this.findByRequestId(dto.userId, dto.requestId);
  
  if (existingRecord.executionStatus === 'timeout' || existingRecord.executionStatus === 'failed') {
    // Orphan or failed execution: overwrite with new intent
    await this.usageRecordRepository.update(
      { executionId: existingRecord.executionId },
      {
        provider: dto.provider,
        adapter: dto.adapter,
        sessionId: dto.sessionId,
        conversationId: dto.conversationId,
        metadata: dto.metadata,
        executionStatus: 'pending',
        timestamp: new Date(), // Reset timestamp
      },
    );
    
    // Return updated record
    return await this.usageRecordRepository.findOne({
      where: { executionId: existingRecord.executionId },
    });
  } else {
    // Completed or pending (concurrent): return existing record
    return existingRecord;
  }
}
```

### 5.4 Admin Reconciliation Script

**File:** `services/api-gateway/scripts/reconcile-orphans.ts`

**Content:**
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsageLedgerService } from '../src/usage-ledger/usage-ledger.service';
import { DataSource } from 'typeorm';

async function reconcileOrphans() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  
  const ORPHAN_TIMEOUT_MINUTES = 5;
  
  const result = await dataSource.query(
    `UPDATE usage_records
     SET execution_status = 'timeout'
     WHERE execution_status = 'pending'
       AND timestamp < NOW() - INTERVAL '${ORPHAN_TIMEOUT_MINUTES} minutes'
     RETURNING execution_id, user_id, request_id, timestamp`,
  );
  
  console.log(`Reconciled ${result.length} orphaned executions:`);
  result.forEach((row: any) => {
    console.log(`  - executionId=${row.execution_id}, userId=${row.user_id}, requestId=${row.request_id || 'N/A'}, age=${Math.floor((Date.now() - new Date(row.timestamp).getTime()) / 60000)}min`);
  });
  
  await app.close();
}

reconcileOrphans().catch((error) => {
  console.error('Reconciliation failed:', error);
  process.exit(1);
});
```

**Usage:**
```bash
cd services/api-gateway
npx ts-node scripts/reconcile-orphans.ts
```

---

## 6. Financial / Safety Guarantees

### 6.1 No Double Billing

**Guarantee:** Orphan transition does NOT create duplicate ledger rows.

**Enforcement:**
- Orphan transition is UPDATE (not INSERT)
- Retry after orphan transition reuses existing row (UNIQUE constraint)
- No new row created for same `(user_id, request_id)`

**Verification:**
```sql
SELECT COUNT(*) FROM usage_records 
WHERE user_id = 'user-1' AND request_id = 'test-key-001';
-- Expected: 1 (always)
```

### 6.2 No Quota Leakage

**Guarantee:** Orphaned `pending` records do NOT affect quota calculation.

**Enforcement:**
- `pending` records have `tokens_used=NULL`
- TokenQuotaGuard queries: `SUM(tokens_used) WHERE tokens_used IS NOT NULL`
- NULL values excluded from SUM (SQL standard)

**Verification:**
```sql
-- Verify orphaned records have NULL tokens
SELECT execution_id, execution_status, tokens_used
FROM usage_records
WHERE execution_status = 'pending' OR execution_status = 'timeout';
-- Expected: tokens_used = NULL for all rows
```

### 6.3 Replay Bypasses Quota (Preserved)

**Guarantee:** Replay of `completed` execution still bypasses quota.

**Enforcement:**
- IdempotencyGuard runs BEFORE TokenQuotaGuard (guard order unchanged)
- `completed` status triggers IdempotentReplayException (guard pipeline terminated)
- TokenQuotaGuard NOT invoked on replay

**Verification:**
- Existing PHASE-43B-2-HOTFIX tests still pass
- No changes to replay logic

### 6.4 Deterministic Retry Behavior

**Guarantee:** Same `(user_id, request_id)` with orphaned `pending` → deterministic outcome.

**Enforcement:**
- Orphan detection is time-based (age > 5 minutes)
- Transition is idempotent (UPDATE with WHERE clause)
- Retry logic is deterministic (same input → same output)

**Verification:**
- Integration tests prove deterministic behavior
- Multiple retries with same `request_id` produce same outcome

---

## 7. Test Strategy

### 7.1 Unit Tests

**File:** `services/api-gateway/src/ai/__tests__/idempotency-orphan.unit.spec.ts`

**Tests:**
1. `transitionOrphanToTimeout()` updates status correctly
2. `transitionOrphanToTimeout()` is idempotent (multiple calls → same outcome)
3. `transitionOrphanToTimeout()` handles non-existent executionId gracefully
4. Orphan detection logic (age > 5 minutes)

### 7.2 Integration Tests

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts`

**Tests:**
1. **Orphan detection:** `pending` < 5min → 409 Conflict
2. **Orphan transition:** `pending` > 5min → transition to `timeout`, allow retry
3. **Retry after orphan:** Retry with same `request_id` → new execution succeeds
4. **No double billing:** DB row count = 1 after orphan transition + retry
5. **Quota bypass preserved:** Replay of `completed` still bypasses quota
6. **Multiple retries:** Multiple retries with same `request_id` → deterministic outcome

### 7.3 PowerShell Verification

**File:** `services/api-gateway/scripts/verify-orphan-reconciliation.ps1`

**Tests:**
1. Create orphan (write intent, do NOT update result, wait 5min)
2. Retry with same `Idempotency-Key` → verify transition to `timeout`
3. Verify new execution succeeds
4. Verify DB row count = 1
5. Verify quota not affected

---

## 8. Rollback Policy

### 8.1 If Phase 43B-4 Must Be Reverted

**Revert code changes:**
```bash
git revert <commit-hash>
```

**Behavior after rollback:**
- Orphaned `pending` records remain stuck (original Phase 43B-2C behavior)
- Client retries return 409 Conflict (permanent block)
- Admin must manually UPDATE orphaned records to `timeout`

**No database cleanup needed:**
- No schema changes in Phase 43B-4
- Orphan transition is UPDATE (no new tables/columns)
- Existing `timeout` records remain (no data loss)

### 8.2 Manual Cleanup (If Needed)

**SQL:**
```sql
-- Manually transition orphaned records to 'timeout'
UPDATE usage_records
SET execution_status = 'timeout'
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '5 minutes';
```

---

## 9. Locked Invariants (DO NOT BREAK)

### 9.1 Idempotency Runs BEFORE Quota (Phase 43A/43B)

**Invariant:** IdempotencyGuard runs BEFORE TokenQuotaGuard.

**Enforcement:** Guard order in `@UseGuards()` unchanged.

**Verification:** Existing PHASE-43B-2-HOTFIX tests still pass.

### 9.2 Replay Bypasses Quota/Provider/Ledger (Phase 43B-2-HOTFIX)

**Invariant:** Replay of `completed` execution does NOT invoke quota, provider, or ledger.

**Enforcement:** IdempotentReplayException terminates guard pipeline.

**Verification:** Existing PHASE-43B-2-HOTFIX tests still pass.

### 9.3 Two-Phase Record Remains Authoritative (Phase 43B-2)

**Invariant:** Execution intent written BEFORE ai-service call.

**Enforcement:** `writeExecutionIntent()` called before `AIServiceHttpClient.execute()`.

**Verification:** Existing PHASE-43B-2 tests still pass.

### 9.4 Deterministic Replay from Metadata (Phase 43B-3)

**Invariant:** Replay returns EXACT original `AIExecutionResult` from `metadata.aiExecutionResult`.

**Enforcement:** IdempotencyGuard reads from `metadata.aiExecutionResult`.

**Verification:** Existing PHASE-43B-3 tests still pass.

---

## 10. Approval Checklist

**Before proceeding to implementation:**

- [ ] Orphan timeout (5 minutes) is acceptable
- [ ] Lazy reconciliation strategy (IdempotencyGuard) is acceptable
- [ ] Admin script approach (no background workers) is acceptable
- [ ] Retry semantics (reuse existing row) are acceptable
- [ ] No schema changes required (confirmed)
- [ ] All locked invariants preserved (confirmed)
- [ ] Test strategy is sufficient (confirmed)

---

## 11. Next Steps

**STAGE-43B-4B: Implementation**
1. Implement `transitionOrphanToTimeout()` in UsageLedgerService
2. Update IdempotencyGuard to detect orphans
3. Update `writeExecutionIntent()` to handle retry after orphan transition
4. Create admin reconciliation script

**STAGE-43B-4C: Verification**
1. Write unit tests
2. Write integration tests
3. Create PowerShell verification script
4. Run all tests
5. Write PHASE-43B-4-CHECKPOINT.md

---

**Document Status:** DESIGN COMPLETE  
**Next Stage:** STAGE-43B-4B (Implementation)  
**Approval Required:** Yes (before proceeding to implementation)

---

**END OF DESIGN**
