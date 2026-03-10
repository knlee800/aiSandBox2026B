# PHASE-43A-2C Verification Script

## Idempotency Short-Circuit BEFORE Quota (Retry-Safe)

This document provides PowerShell commands to verify that the idempotency short-circuit works correctly and prevents quota blocking on retries.

---

## Prerequisites

1. API Gateway running on `http://localhost:3000`
2. Valid API key (replace `YOUR_API_KEY` in commands below)
3. PostgreSQL database accessible

---

## Test 1: First Request (No Existing Record)

### Command

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "test-req-$(Get-Date -Format 'yyyyMMddHHmmss')"
}

$body = @{
    sessionId = "session-test-123"
    conversationId = "conv-test-456"
    userId = "user-test"
    prompt = "Hello, this is a test prompt"
    provider = "stub"
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body

Write-Host "First Request Response:"
$response1 | ConvertTo-Json -Depth 10
```

### Expected Result

- HTTP 200 OK
- Response contains `output`, `tokensUsed`, `model` fields
- Database `usage_records` table has 1 new row with the `request_id` matching the `Idempotency-Key`

---

## Test 2: Retry with Same Idempotency-Key (Should Return Cached Response)

### Command

```powershell
# Use the SAME Idempotency-Key from Test 1
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "test-req-XXXXXX"  # Replace with the key from Test 1
}

$body = @{
    sessionId = "session-test-123"
    conversationId = "conv-test-456"
    userId = "user-test"
    prompt = "Hello, this is a test prompt"
    provider = "stub"
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body

Write-Host "Second Request Response (Retry):"
$response2 | ConvertTo-Json -Depth 10
```

### Expected Result

- HTTP 200 OK
- Response contains:
  - `output`: `"[Duplicate request - original response not stored]"`
  - `tokensUsed`: Same as first request
  - `model`: Same as first request
- Database `usage_records` table still has only 1 row (no duplicate write)

---

## Test 3: Verify Database State (Single Row for Request ID)

### SQL Query

```sql
SELECT COUNT(*) AS row_count
FROM usage_records
WHERE request_id = 'test-req-XXXXXX';  -- Replace with your Idempotency-Key
```

### Expected Result

```
row_count
---------
1
```

Only ONE row should exist, proving no duplicate ledger write occurred.

---

## Test 4: Retry After User Exceeds Quota (Should Still Succeed)

### Setup: Exhaust User's Token Quota

First, make multiple requests to exhaust the user's token quota (default: 100,000 tokens per 24h).

```powershell
# Make requests until quota is exhausted
for ($i = 1; $i -le 10; $i++) {
    $headers = @{
        "Authorization" = "Bearer YOUR_API_KEY"
        "Content-Type" = "application/json"
        "Idempotency-Key" = "exhaust-quota-$i"
    }

    $body = @{
        sessionId = "session-exhaust-$i"
        conversationId = "conv-exhaust-$i"
        userId = "user-test"
        prompt = "Generate a large response to consume tokens" * 100
        provider = "stub"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body
        Write-Host "Request $i succeeded"
    } catch {
        Write-Host "Request $i failed: $_"
        break
    }
}
```

### Retry Original Request (Should Succeed Despite Quota Exceeded)

```powershell
# Retry the ORIGINAL request from Test 1 (same Idempotency-Key)
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "test-req-XXXXXX"  # Replace with the key from Test 1
}

$body = @{
    sessionId = "session-test-123"
    conversationId = "conv-test-456"
    userId = "user-test"
    prompt = "Hello, this is a test prompt"
    provider = "stub"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body
    Write-Host "SUCCESS: Retry succeeded despite quota exceeded"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "FAILURE: Retry was blocked by quota (BUG!)"
    Write-Host "Error: $_"
}
```

### Expected Result

- HTTP 200 OK (NOT 429 Quota Exceeded)
- Response contains the cached result from the original request
- Proves that idempotency short-circuit runs BEFORE quota guard

---

## Test 5: Different User with Same Idempotency-Key (Should Execute Normally)

### Command

```powershell
# Use a DIFFERENT API key (different user)
$headers = @{
    "Authorization" = "Bearer DIFFERENT_API_KEY"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "test-req-XXXXXX"  # Same key as Test 1
}

$body = @{
    sessionId = "session-other-user-123"
    conversationId = "conv-other-user-456"
    userId = "other-user"
    prompt = "Hello from another user"
    provider = "stub"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body

Write-Host "Different User Response:"
$response | ConvertTo-Json -Depth 10
```

### Expected Result

- HTTP 200 OK
- Response contains NEW execution result (not cached)
- Database `usage_records` table has a NEW row with the same `request_id` but different `user_id`
- Proves that idempotency is scoped per user

---

## Test 6: No Idempotency-Key (Backward Compatibility)

### Command

```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
    # NO Idempotency-Key header
}

$body = @{
    sessionId = "session-no-key-123"
    conversationId = "conv-no-key-456"
    userId = "user-test"
    prompt = "Test without idempotency key"
    provider = "stub"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method Post -Headers $headers -Body $body

Write-Host "Response without Idempotency-Key:"
$response | ConvertTo-Json -Depth 10
```

### Expected Result

- HTTP 200 OK
- Response contains normal execution result
- Database `usage_records` table has a new row with `request_id = NULL`
- Proves backward compatibility (idempotency is optional)

---

## Verification SQL Queries

### Query 1: Check Idempotent Requests

```sql
SELECT 
    execution_id,
    request_id,
    user_id,
    tokens_used,
    model,
    timestamp
FROM usage_records
WHERE request_id IS NOT NULL
ORDER BY timestamp DESC
LIMIT 10;
```

### Query 2: Count Duplicate Request IDs (Should Be 0)

```sql
SELECT 
    user_id,
    request_id,
    COUNT(*) AS duplicate_count
FROM usage_records
WHERE request_id IS NOT NULL
GROUP BY user_id, request_id
HAVING COUNT(*) > 1;
```

**Expected Result:** No rows (no duplicates)

### Query 3: Verify Unique Constraint

```sql
SELECT 
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conname = 'idx_usage_records_user_request_id';
```

**Expected Result:** Constraint exists with type `u` (unique)

---

## Success Criteria

✅ **Test 1:** First request succeeds and writes to `usage_records`  
✅ **Test 2:** Retry returns cached response (deterministic placeholder)  
✅ **Test 3:** Only 1 row in database for the request ID  
✅ **Test 4:** Retry succeeds even when user is over quota  
✅ **Test 5:** Different user with same key executes normally  
✅ **Test 6:** Backward compatibility without Idempotency-Key  

---

## Cleanup

```sql
-- Clean up test data
DELETE FROM usage_records
WHERE request_id LIKE 'test-req-%' OR request_id LIKE 'exhaust-quota-%';
```

---

## Notes

1. **Response Reconstruction:** Since `usage_records` does NOT store the AI output text, retries return a deterministic placeholder: `"[Duplicate request - original response not stored]"`. This is by design (Phase 43A-2C constraint: no schema changes).

2. **Future Enhancement:** If full response caching is needed, a future phase can add a response cache table or extend `usage_records` to store output text.

3. **Quota Bypass:** The key behavior verified here is that retries with the same `Idempotency-Key` do NOT consume quota and do NOT fail with 429 Quota Exceeded, even if the user is over quota.

---

## Troubleshooting

### Issue: Second request returns 429 Quota Exceeded

**Cause:** IdempotencyGuard is not running before TokenQuotaGuard.

**Fix:** Verify guard order in `ai-execution.controller.ts`:

```typescript
@UseGuards(
  ApiKeyAuthGuard,
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,
  AbortGuard,
  IdempotencyGuard,  // MUST be before TokenQuotaGuard
  QuotaGuard,
  TokenQuotaGuard,
  RateLimitGuard
)
```

### Issue: Database shows duplicate rows for same request_id

**Cause:** Unique constraint not enforced or idempotency logic broken.

**Fix:** Verify unique index exists:

```sql
CREATE UNIQUE INDEX idx_usage_records_user_request_id 
ON usage_records (user_id, request_id) 
WHERE request_id IS NOT NULL;
```

---

**Phase:** PHASE-43A-2C  
**Stage:** STAGE-43A-2C  
**Status:** VERIFICATION READY  
**Date:** 2026-02-24
