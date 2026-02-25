# PHASE-43B-3 SUMMARY
## Deterministic Replay Body Persistence

**Phase:** PHASE-43B  
**Stage:** STAGE-43B-3  
**Nature:** IMPLEMENTATION (Minimal Additive Hardening)  
**Scope:** api-gateway ONLY  
**Status:** ✅ COMPLETE  
**Date:** 2026-02-25

---

## ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **Deterministic replay restored**: Replay now returns EXACT original AIExecutionResult (not placeholder) → same (userId, requestId) → identical { output, tokensUsed, model } → deterministic invariant preserved

2. **Result stored in metadata**: Full AIExecutionResult persisted in existing `metadata` JSON column during `updateExecutionResult()` → no schema change, no migration → `metadata.aiExecutionResult = { output, tokensUsed, model }`

3. **No schema change**: Used existing `metadata` JSONB column → no new DB columns, no migrations, no downtime → backward compatible (fallback to placeholder for old records)

4. **Quota bypass preserved**: All PHASE-43B-2-HOTFIX invariants maintained → replay does NOT evaluate quota, does NOT call AI provider, does NOT write ledger → IdempotentReplayException still terminates guard pipeline

5. **Test coverage complete**: 7 integration tests prove (1) replay body === R1 (deep equality), (2) metadata contains aiExecutionResult, (3) multiple replays return identical output, (4) quota bypass preserved, (5) long output handled, (6) special characters handled, (7) backward compatibility for old records

---

## Problem Statement

### Before PHASE-43B-3

**Replay Behavior:**
- IdempotencyGuard detected completed execution
- Reconstructed placeholder result: `{ output: "[Duplicate request - original response not stored]", tokensUsed, model }`
- Threw IdempotentReplayException with placeholder
- Client received placeholder output (not original)

**Problem:**
- **Deterministic replay invariant VIOLATED**: Replay did NOT return exact original output
- Client could not distinguish replay from new execution
- Non-deterministic behavior: same input → different output on replay

---

### After PHASE-43B-3

**Replay Behavior:**
- IdempotencyGuard detects completed execution
- Reads full AIExecutionResult from `metadata.aiExecutionResult`
- Reconstructs EXACT original result: `{ output: <original>, tokensUsed, model }`
- Throws IdempotentReplayException with exact result
- Client receives EXACT original output

**Solution:**
- **Deterministic replay invariant PRESERVED**: Replay returns exact original output
- Client receives identical response on replay
- Deterministic behavior: same input → same output (always)

---

## Implementation Details

### Change 1: Store AIExecutionResult in Metadata

**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

**UpdateExecutionResultDto:**
```typescript
export interface UpdateExecutionResultDto {
  executionId: string;
  model: string;
  tokensUsed: number;
  executionDurationMs: number;
  executionStatus: string;
  output: string; // Phase 43B-3: Added for deterministic replay
}
```

**updateExecutionResult() method:**
```typescript
// Phase 43B-3: Store full AIExecutionResult in metadata for deterministic replay
record.metadata = {
  ...record.metadata,
  aiExecutionResult: {
    output: dto.output,
    tokensUsed: dto.tokensUsed,
    model: dto.model,
  },
};
```

---

### Change 2: Read from Metadata in IdempotencyGuard

**File:** `services/api-gateway/src/ai/idempotency.guard.ts`

**Logic:**
```typescript
if (status === 'completed') {
  let reconstructedResult: AIExecutionResult;
  
  if (existingRecord.metadata?.aiExecutionResult) {
    // Deterministic replay: return EXACT original response
    reconstructedResult = {
      output: existingRecord.metadata.aiExecutionResult.output,
      tokensUsed: existingRecord.metadata.aiExecutionResult.tokensUsed,
      model: existingRecord.metadata.aiExecutionResult.model,
    };
  } else {
    // Fallback for records created before Phase 43B-3
    reconstructedResult = {
      output: '[Duplicate request - original response not stored]',
      tokensUsed: existingRecord.tokensUsed!,
      model: existingRecord.model!,
    };
  }
  
  throw new IdempotentReplayException(reconstructedResult);
}
```

---

### Change 3: Pass Output to updateExecutionResult

**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`

**Controller:**
```typescript
await this.usageLedgerService.updateExecutionResult({
  executionId,
  model: result.model,
  tokensUsed: result.tokensUsed,
  executionDurationMs,
  executionStatus: 'completed',
  output: result.output, // Phase 43B-3: Store output for deterministic replay
});
```

---

## Test Coverage

### Integration Tests (7 tests)

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts`

1. **Exact output match on replay (deep equality)**
   - First call returns result R1 with unique output
   - Replay returns HTTP 200 with EXACT same output
   - Deep equality: `replayResponse.body === R1`

2. **Metadata contains aiExecutionResult**
   - Execute request
   - Query database
   - Verify `metadata.aiExecutionResult` contains { output, tokensUsed, model }

3. **Multiple replays return identical output**
   - First request returns unique output
   - Second request (replay) returns same output
   - Third request (replay) returns same output
   - All responses identical (deep equality)

4. **Quota bypass preserved with deterministic replay**
   - First request invokes TokenQuotaGuard
   - Replay does NOT invoke TokenQuotaGuard (spy verification)
   - Replay returns exact output

5. **Long output text handled correctly**
   - First request with 10KB output
   - Replay returns exact 10KB output
   - Deep equality verified

6. **Special characters handled correctly**
   - First request with special chars: `\n\t\r"'\\{}[]<>!@#$%^&*()`
   - Replay returns exact special chars
   - Deep equality verified

7. **Backward compatibility for old records**
   - Manually create record without `metadata.aiExecutionResult`
   - Replay falls back to placeholder output
   - No errors thrown

---

## Files Changed

### Modified Files (3)
1. `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
   - Added `output` to `UpdateExecutionResultDto`
   - Store `aiExecutionResult` in metadata during `updateExecutionResult()`

2. `services/api-gateway/src/ai/idempotency.guard.ts`
   - Read `aiExecutionResult` from metadata
   - Reconstruct exact original result
   - Fallback to placeholder for old records

3. `services/api-gateway/src/ai/ai-execution.controller.ts`
   - Pass `result.output` to `updateExecutionResult()`

### New Files (2)
1. `services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts`
   - 7 integration tests proving deterministic replay

2. `services/api-gateway/PHASE-43B-3-SUMMARY.md`
   - This summary document

---

## Invariants Preserved

✅ **Replay returns EXACT original output** (deterministic replay restored)  
✅ **Replay does NOT evaluate quota** (QuotaGuard/TokenQuotaGuard NOT invoked)  
✅ **Replay does NOT call AI provider** (executeSpy call count = 1)  
✅ **Replay does NOT write ledger** (DB row count = 1)  
✅ **UNIQUE (user_id, request_id) remains enforced** (database constraint)  
✅ **Advisory lock remains quota authority** (TokenQuotaGuard unchanged)  
✅ **Throw-only error semantics preserved** (IdempotentReplayException)  
✅ **Deterministic provider selection unchanged** (api-gateway owns provider selection)  
✅ **No changes to ai-service** (ai-service remains unchanged)  
✅ **No schema changes** (used existing metadata JSONB column)  
✅ **Backward compatible** (fallback to placeholder for old records)

---

## Metadata Structure

**Before Phase 43B-3:**
```json
{
  "metadata": {
    "apiKeyId": "test-key-1",
    ...
  }
}
```

**After Phase 43B-3:**
```json
{
  "metadata": {
    "apiKeyId": "test-key-1",
    "aiExecutionResult": {
      "output": "Original AI response text",
      "tokensUsed": 150,
      "model": "claude-3-5-sonnet-20241022"
    },
    ...
  }
}
```

---

## Verification Steps

1. **Run integration tests:**
   ```bash
   npm test -- ai-execution-deterministic-replay.integration.spec.ts
   ```

2. **Run HOTFIX tests (ensure no regressions):**
   ```bash
   npm test -- ai-execution-replay-quota-bypass.integration.spec.ts
   ```

3. **Manual verification:**
   - Send first request with Idempotency-Key → verify 200 response with output
   - Send replay with same Idempotency-Key → verify 200 response with EXACT same output
   - Query database to verify `metadata.aiExecutionResult` exists
   - Verify TokenQuotaGuard NOT invoked on replay (check logs)

---

## Rollback Plan

If Phase 43B-3 introduces regressions:

1. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Restore old behavior:**
   - IdempotencyGuard returns placeholder output
   - No `aiExecutionResult` stored in metadata
   - **Note:** Old behavior violates deterministic replay invariant

3. **No database cleanup needed:**
   - Metadata changes are additive only
   - Old records without `aiExecutionResult` still work (fallback)
   - New records will revert to old behavior

---

## Future Considerations

**None required.** This implementation is minimal, deterministic, and preserves all invariants.

**No follow-up work needed.**

**Privacy Note:** Output text is stored in metadata for replay purposes. If privacy policy requires output deletion, a cleanup job can be added to remove `metadata.aiExecutionResult` after a retention period (e.g., 24 hours). This is out of scope for Phase 43B-3.

---

**Document Status:** FINAL  
**Implementation Status:** ✅ COMPLETE  
**Verification Status:** ✅ TESTS PASSING  
**Approval Required:** No (minimal additive hardening)

---

**END OF SUMMARY**
