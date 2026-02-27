# PHASE-43B-4 HOTFIX — Reuse Execution Row on Retry After Timeout

**Phase:** PHASE-43B-4  
**Nature:** Bug Fix / Hardening  
**Scope:** api-gateway ONLY  
**Status:** ✅ COMPLETE

---

## Problem

After orphan reconciliation transitions a `pending` execution to `timeout`:

- Retry with same `(user_id, request_id)` was allowed by design
- But controller still called `writeExecutionIntent()` (INSERT)
- UNIQUE constraint `idx_usage_records_user_request_id` blocked insert
- Result: **500 Internal Server Error**

This violated retry semantics and broke the user experience.

---

## Solution

**Reuse existing row instead of inserting new row.**

When retrying after `timeout` or `failed`:

1. Find existing row by `(userId, requestId)`
2. Generate new `executionId`
3. **UPDATE** existing row (not INSERT):
   - Set new `executionId`
   - Reset `execution_status` to `pending`
   - Clear execution result fields (`model`, `tokensUsed`, `executionDurationMs`)
   - Strip `aiExecutionResult` from metadata
   - Update `timestamp` to NOW()
4. Proceed with normal two-phase update flow

**Result:** No UNIQUE constraint violation, no duplicate rows, clean retry semantics.

---

## Changes

### 1. `UsageLedgerService.reuseExecutionIntent()` (NEW)

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

**Method signature:**
```typescript
async reuseExecutionIntent(params: {
  requestId: string;
  userId: string;
  apiKeyId: string;
  sessionId: string;
  conversationId: string;
  provider: string;
  adapter: string;
  metadata?: any;
}): Promise<string> // returns new executionId
```

**Behavior:**
- Finds existing row by `(userId, requestId)`
- Validates status is `timeout` or `failed` (retryable states)
- Generates new `executionId`
- **Updates** row using old `executionId` as WHERE clause
- Returns new `executionId` for controller to use

**Key implementation detail:**
```typescript
await this.usageRecordRepository.update(
  { executionId: oldExecutionId }, // WHERE clause
  {
    executionId: newExecutionId, // UPDATE primary key
    executionStatus: 'pending',
    timestamp: new Date(),
    // ... other fields
    model: null,
    tokensUsed: null,
    executionDurationMs: null,
  },
);
```

### 2. `AIExecutionController.execute()` (MODIFIED)

**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`

**Change:** Added retry detection logic before `writeExecutionIntent()`:

```typescript
// Phase 43B-4 HOTFIX: Check if retry after timeout/failed
let executionId: string;
if (requestId) {
  const existingRecord = await this.usageLedgerService.findByRequestId(
    identity.userId,
    requestId,
  );
  
  if (
    existingRecord &&
    (existingRecord.executionStatus === 'timeout' ||
      existingRecord.executionStatus === 'failed')
  ) {
    // Reuse existing row (UPDATE, not INSERT)
    executionId = await this.usageLedgerService.reuseExecutionIntent({...});
  } else {
    // Normal flow: create new execution intent
    executionId = uuidv4();
    await this.usageLedgerService.writeExecutionIntent({...});
  }
} else {
  // No requestId: normal flow
  executionId = uuidv4();
  await this.usageLedgerService.writeExecutionIntent({...});
}
```

**Execution flow:**
1. If `requestId` exists, check for existing record
2. If existing record is `timeout` or `failed`, call `reuseExecutionIntent()`
3. Otherwise, call `writeExecutionIntent()` (normal flow)

### 3. Integration Tests (UPDATED)

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts`

**Changes:**
- Removed manual `requestId` clearing workaround
- Updated Test 2 expectations: old `executionId` no longer exists (row reused)
- Updated Test 4 expectations: only 1 row exists (not 2)
- All 6 tests now pass without workarounds

**Test coverage:**
1. ✅ Orphan detection: `pending` < 5min → 409 Conflict
2. ✅ Orphan transition: `pending` > 5min → transition to `timeout`, allow retry
3. ✅ Retry after orphan: Retry with same `request_id` → new execution succeeds
4. ✅ No double billing: DB row count = 1 after orphan transition + retry
5. ✅ Quota bypass preserved: Replay of completed still bypasses quota
6. ✅ Multiple retries: Multiple retries with same `request_id` → deterministic outcome

---

## Verification

### Test Results
```
PASS src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts
  AI Execution - Orphan Reconciliation (Integration)
    Test 1: Orphan detection - pending < 5min → 409 Conflict
      ✓ should return 409 Conflict for pending execution younger than 5 minutes (73 ms)
    Test 2: Orphan transition - pending > 5min → transition to timeout, allow retry
      ✓ should transition orphaned pending execution to timeout and allow retry (57 ms)
    Test 3: Retry after orphan - Retry with same request_id → new execution succeeds
      ✓ should allow retry with same request_id after orphan transition (46 ms)
    Test 4: No double billing - DB row count after orphan transition + retry
      ✓ should not create duplicate ledger rows after orphan transition and retry (47 ms)
    Test 5: Quota bypass preserved - Replay of completed still bypasses quota
      ✓ should bypass quota guards on replay after orphan transition (45 ms)
    Test 6: Multiple retries - Multiple retries with same request_id → deterministic outcome
      ✓ should produce deterministic outcome on multiple retries after orphan transition (49 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

### Linter Status
✅ No linter errors

---

## Invariants Preserved

✅ **UNIQUE constraint preserved:** No changes to schema  
✅ **No duplicate rows:** Row is reused, not duplicated  
✅ **Idempotency preserved:** Same `requestId` → same outcome  
✅ **Quota bypass preserved:** Replay still bypasses quota guards  
✅ **Deterministic replay:** Completed executions still replay exact original response  
✅ **Two-phase write intact:** Normal flow unchanged  
✅ **No schema changes:** Entity unchanged  
✅ **No ai-service changes:** api-gateway only

---

## Behavioral Changes

### Before Hotfix
```
1. Execution orphaned (pending → timeout)
2. Retry with same requestId
3. Controller calls writeExecutionIntent() (INSERT)
4. UNIQUE constraint violation
5. 500 Internal Server Error ❌
```

### After Hotfix
```
1. Execution orphaned (pending → timeout)
2. Retry with same requestId
3. Controller detects timeout/failed status
4. Controller calls reuseExecutionIntent() (UPDATE)
5. Row reused with new executionId
6. Execution succeeds
7. 200 OK ✅
```

---

## Impact

### User Experience
- **Before:** Retry after orphan → 500 error (broken)
- **After:** Retry after orphan → 200 success (works)

### Database
- **Before:** UNIQUE constraint violation, potential duplicate rows
- **After:** Single row reused, no duplicates, clean audit trail

### Financial Integrity
- **Before:** Risk of double billing if constraint bypassed
- **After:** Single row = single billing record (safe)

---

## Files Modified

1. `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
   - Added `reuseExecutionIntent()` method

2. `services/api-gateway/src/ai/ai-execution.controller.ts`
   - Modified `execute()` to detect and handle retry after timeout/failed

3. `services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts`
   - Removed workarounds
   - Updated test expectations
   - All tests pass

---

## Completion Checklist

✅ Retry after orphan no longer returns 500  
✅ No duplicate rows created  
✅ UNIQUE constraint preserved  
✅ All existing tests pass  
✅ New retry tests pass  
✅ No linter errors  
✅ No schema changes  
✅ No ai-service changes  
✅ Minimal patch only  

---

## Summary

**ULTRA-BRIEF SUMMARY**
• Retry reuses existing row (UPDATE not INSERT)
• UNIQUE constraint preserved
• No 500 on timeout retry
• No duplicate ledger rows
• Test coverage: 6/6 passing

**Status:** ✅ COMPLETE
