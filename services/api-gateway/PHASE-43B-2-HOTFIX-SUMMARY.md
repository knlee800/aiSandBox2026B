# PHASE-43B-2-HOTFIX SUMMARY
## Idempotent Replay Must Bypass Quota Guards

**Phase:** PHASE-43B  
**Stage:** STAGE-43B-2-HOTFIX  
**Nature:** CRITICAL FIX (Idempotency Invariant Violation)  
**Scope:** api-gateway ONLY (guards + filters)  
**Status:** ✅ COMPLETE  
**Date:** 2026-02-25

---

## ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **Problem identified**: IdempotencyGuard set `req.idempotentResult` and returned `true` → guard pipeline continued → QuotaGuard/TokenQuotaGuard ran → replay hit quota (429) → **INVARIANT VIOLATED** (replay must NOT evaluate quota)

2. **Solution implemented**: Created `IdempotentReplayException` thrown by IdempotencyGuard on replay → terminates guard pipeline immediately → QuotaGuard/TokenQuotaGuard NOT invoked → `IdempotentReplayExceptionFilter` catches and returns HTTP 200 with cached result

3. **Guard pipeline short-circuit**: Replay now throws exception BEFORE QuotaGuard/TokenQuotaGuard → preserves invariant (replay does NOT evaluate quota) → deterministic behavior (same input → same output, no quota consumed)

4. **Tests prove correctness**: 5 integration tests verify (1) replay returns 200 with same body, (2) TokenQuotaGuard NOT invoked on replay (spy verification), (3) replay succeeds even if quota exceeded after first execution, (4) DB row count remains 1, (5) all invariants preserved

5. **Minimal changes**: 4 new files (exception class, filter, tests, summary) + 3 modified files (IdempotencyGuard, AIExecutionController, AppModule) → no schema changes, no ai-service changes, no quota logic changes → deterministic, throw-only semantics preserved

---

## Problem Statement

### Before Hotfix (INVARIANT VIOLATED)

**Guard Order:**
```
ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → 
AbortGuard → IdempotencyGuard → QuotaGuard → TokenQuotaGuard → RateLimitGuard → Controller
```

**Execution Flow on Replay:**
1. IdempotencyGuard detects replay (existing record with status='completed')
2. IdempotencyGuard sets `req.idempotentResult` = cached result
3. IdempotencyGuard returns `true` (allows pipeline to continue)
4. **QuotaGuard runs** (evaluates quota)
5. **TokenQuotaGuard runs** (evaluates token quota)
6. RateLimitGuard runs
7. Controller checks `req.idempotentResult` and returns early

**Problem:**
- Replay evaluates quota (QuotaGuard/TokenQuotaGuard invoked)
- If quota exceeded after first execution, replay returns 429 (should return 200)
- **INVARIANT VIOLATED**: Replay must NOT evaluate quota

---

### After Hotfix (INVARIANT PRESERVED)

**Guard Order:** (unchanged)
```
ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → 
AbortGuard → IdempotencyGuard → QuotaGuard → TokenQuotaGuard → RateLimitGuard → Controller
```

**Execution Flow on Replay:**
1. IdempotencyGuard detects replay (existing record with status='completed')
2. IdempotencyGuard reconstructs cached result
3. **IdempotencyGuard throws IdempotentReplayException** (terminates pipeline)
4. **QuotaGuard NOT invoked** (pipeline terminated)
5. **TokenQuotaGuard NOT invoked** (pipeline terminated)
6. RateLimitGuard NOT invoked (pipeline terminated)
7. Controller NOT invoked (pipeline terminated)
8. **IdempotentReplayExceptionFilter catches exception**
9. Filter returns HTTP 200 with cached result

**Solution:**
- Replay does NOT evaluate quota (QuotaGuard/TokenQuotaGuard NOT invoked)
- Replay always returns 200 with cached result (deterministic)
- **INVARIANT PRESERVED**: Replay does NOT evaluate quota

---

## Implementation Details

### HOTFIX-1: Create IdempotentReplayException

**File:** `services/api-gateway/src/ai/idempotent-replay.exception.ts`

**Purpose:**
- Custom exception carrying cached AIExecutionResult
- Thrown by IdempotencyGuard to terminate guard pipeline
- Caught by IdempotentReplayExceptionFilter to return HTTP 200

**Code:**
```typescript
export class IdempotentReplayException extends Error {
  constructor(public readonly result: AIExecutionResult) {
    super('Idempotent replay');
    this.name = 'IdempotentReplayException';
  }
}
```

---

### HOTFIX-2: Update IdempotencyGuard

**File:** `services/api-gateway/src/ai/idempotency.guard.ts`

**Changes:**
- Import `IdempotentReplayException`
- Replace `request.idempotentResult = result; return true;` with `throw new IdempotentReplayException(result);`
- Remove controller check for `req.idempotentResult` (no longer needed)

**Before:**
```typescript
if (status === 'completed') {
  request.idempotentResult = reconstructedResult;
  return true; // Pipeline continues → QuotaGuard runs
}
```

**After:**
```typescript
if (status === 'completed') {
  throw new IdempotentReplayException(reconstructedResult); // Pipeline terminates
}
```

---

### HOTFIX-3: Add Global Exception Filter

**File:** `services/api-gateway/src/filters/idempotent-replay-exception.filter.ts`

**Purpose:**
- Catch `IdempotentReplayException` globally
- Return HTTP 200 with embedded AIExecutionResult
- Do NOT wrap or alter response shape

**Code:**
```typescript
@Catch(IdempotentReplayException)
export class IdempotentReplayExceptionFilter implements ExceptionFilter {
  catch(exception: IdempotentReplayException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    response.status(HttpStatus.OK).json(exception.result);
  }
}
```

**Registration:** `services/api-gateway/src/app.module.ts`
```typescript
{
  provide: APP_FILTER,
  useClass: IdempotentReplayExceptionFilter,
}
```

---

### HOTFIX-4: Add Integration Tests

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts`

**Test Coverage:**
1. **Replay returns 200 with same body AND does NOT invoke TokenQuotaGuard**
   - Spy on `TokenQuotaGuard.canActivate()`
   - Verify spy called once on first request
   - Verify spy NOT called on replay

2. **Replay succeeds even if quota exceeded after first execution**
   - First request succeeds
   - Mock TokenQuotaGuard to return false (quota exceeded)
   - Replay still succeeds (returns 200)

3. **DB row count remains 1 for (user_id, request_id)**
   - First request creates 1 record
   - Multiple replays do NOT create duplicate records
   - Verify count = 1 after 3 requests

4. **TokenQuotaGuard invoked on first request but NOT on replay**
   - Clear spy before each request
   - Verify spy called on first request
   - Verify spy NOT called on replay

5. **All invariants preserved after hotfix**
   - Replay returns 200 (not 429)
   - Replay returns cached result (deterministic)
   - No duplicate ledger write (DB row count = 1)
   - No quota consumed on replay (TokenQuotaGuard NOT invoked)
   - No AI provider call on replay (executeSpy call count = 1)

---

## Files Changed

### New Files (4)
1. `services/api-gateway/src/ai/idempotent-replay.exception.ts` — Exception class
2. `services/api-gateway/src/filters/idempotent-replay-exception.filter.ts` — Global filter
3. `services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts` — Tests
4. `services/api-gateway/PHASE-43B-2-HOTFIX-SUMMARY.md` — This document

### Modified Files (3)
1. `services/api-gateway/src/ai/idempotency.guard.ts` — Throw exception instead of setting request property
2. `services/api-gateway/src/ai/ai-execution.controller.ts` — Remove check for `req.idempotentResult`
3. `services/api-gateway/src/app.module.ts` — Register global exception filter

---

## Invariants Preserved

✅ **Replay does NOT evaluate quota** (QuotaGuard/TokenQuotaGuard NOT invoked)  
✅ **Replay does NOT call AI provider** (executeSpy call count = 1)  
✅ **Replay does NOT write ledger** (DB row count = 1)  
✅ **Replay returns cached result deterministically** (same input → same output)  
✅ **UNIQUE (user_id, request_id) remains enforced** (database constraint)  
✅ **Advisory lock remains quota authority** (TokenQuotaGuard unchanged)  
✅ **Throw-only error semantics preserved** (exception-based short-circuit)  
✅ **Deterministic provider selection unchanged** (api-gateway owns provider selection)  
✅ **No changes to ai-service** (ai-service remains unchanged)

---

## Verification Steps

1. **Run integration tests:**
   ```bash
   npm test -- ai-execution-replay-quota-bypass.integration.spec.ts
   ```

2. **Manual verification:**
   - Send first request with Idempotency-Key → verify 200 response
   - Send second request with same Idempotency-Key → verify 200 response (not 429)
   - Check logs to verify TokenQuotaGuard NOT invoked on replay
   - Query database to verify only 1 record exists

3. **Quota exceeded scenario:**
   - Send first request → succeeds
   - Consume quota (send many requests without Idempotency-Key)
   - Send replay with original Idempotency-Key → should still succeed (200)

---

## Rollback Plan

If hotfix introduces regressions:

1. **Revert code changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Remove new files:**
   ```bash
   rm services/api-gateway/src/ai/idempotent-replay.exception.ts
   rm services/api-gateway/src/filters/idempotent-replay-exception.filter.ts
   rm services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts
   ```

3. **Restore old behavior:**
   - IdempotencyGuard sets `req.idempotentResult` and returns `true`
   - Controller checks `req.idempotentResult` and returns early
   - **Note:** Old behavior violates invariant (replay evaluates quota)

---

## Future Considerations

**None required.** This hotfix is minimal, deterministic, and preserves all invariants.

**No follow-up work needed.**

---

**Document Status:** FINAL  
**Implementation Status:** ✅ COMPLETE  
**Verification Status:** ✅ TESTS PASSING  
**Approval Required:** No (hotfix for critical invariant violation)

---

**END OF SUMMARY**
