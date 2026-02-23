# PHASE-43A-2B Verification: usage_records Idempotency

## Overview

This document provides manual verification commands for testing the idempotency feature implemented in PHASE-43A-2B.

**Objective:** Verify that duplicate requests with the same `Idempotency-Key` do NOT create duplicate `usage_records` rows.

---

## Prerequisites

1. **Services Running:**
   - api-gateway: `http://localhost:4000`
   - ai-service: `http://localhost:4001`
   - Database: PostgreSQL (connection configured)

2. **API Key Available:**
   - You need a valid API key with `ai:execute` scope
   - Example: `test-key-1` (from seed data)

3. **User ID:**
   - You need a valid user ID
   - Example: `user-1` (from seed data)

---

## Test 1: Duplicate Idempotency-Key Prevents Second Insert

### Step 1: First Request (Should Create Record)

```powershell
$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "test-idempotency-001"
}

$body = @{
    sessionId = "11111111-1111-1111-1111-111111111111"
    conversationId = "22222222-2222-2222-2222-222222222222"
    userId = "user-1"
    prompt = "Hello, this is a test"
    provider = "stub"
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "First Request Response:"
$response1 | ConvertTo-Json
```

### Step 2: Second Request (Same Idempotency-Key, Should Return Same Result)

```powershell
$response2 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "Second Request Response:"
$response2 | ConvertTo-Json
```

### Step 3: Verify Database (Should Have Only 1 Row)

```powershell
# Connect to PostgreSQL and run this query:
# Replace connection details as needed
```

**SQL Query:**

```sql
SELECT COUNT(*) as row_count, execution_id, request_id, user_id, tokens_used
FROM usage_records
WHERE user_id = 'user-1'
  AND request_id = 'test-idempotency-001'
GROUP BY execution_id, request_id, user_id, tokens_used;
```

**Expected Result:**
- `row_count` should be `1`
- Only one `execution_id` should exist for this `request_id`

---

## Test 2: NULL requestId Remains Non-Idempotent (Backward Compatibility)

### Step 1: First Request Without Idempotency-Key

```powershell
$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
}

$body = @{
    sessionId = "33333333-3333-3333-3333-333333333333"
    conversationId = "44444444-4444-4444-4444-444444444444"
    userId = "user-1"
    prompt = "Test without idempotency key"
    provider = "stub"
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "First Request (No Idempotency-Key):"
$response1 | ConvertTo-Json
```

### Step 2: Second Request Without Idempotency-Key (Should Create Second Row)

```powershell
$response2 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "Second Request (No Idempotency-Key):"
$response2 | ConvertTo-Json
```

### Step 3: Verify Database (Should Have 2 Rows)

**SQL Query:**

```sql
SELECT COUNT(*) as row_count
FROM usage_records
WHERE user_id = 'user-1'
  AND session_id = '33333333-3333-3333-3333-333333333333'
  AND request_id IS NULL;
```

**Expected Result:**
- `row_count` should be `2` (two separate records created)

---

## Test 3: Invalid Idempotency-Key Rejected (400 Bad Request)

### Test 3A: Empty Idempotency-Key

```powershell
$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
    "Idempotency-Key" = ""
}

$body = @{
    sessionId = "55555555-5555-5555-5555-555555555555"
    conversationId = "66666666-6666-6666-6666-666666666666"
    userId = "user-1"
    prompt = "Test with empty key"
    provider = "stub"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
} catch {
    Write-Host "Expected Error (400 Bad Request):"
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
```

**Expected Result:**
- HTTP 400 Bad Request
- Error message: "Idempotency-Key must not be empty"

### Test 3B: Idempotency-Key Too Long (>100 characters)

```powershell
$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
    "Idempotency-Key" = ("x" * 101)  # 101 characters
}

$body = @{
    sessionId = "77777777-7777-7777-7777-777777777777"
    conversationId = "88888888-8888-8888-8888-888888888888"
    userId = "user-1"
    prompt = "Test with long key"
    provider = "stub"
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers -Body $body
} catch {
    Write-Host "Expected Error (400 Bad Request):"
    $_.Exception.Response.StatusCode
    $_.ErrorDetails.Message
}
```

**Expected Result:**
- HTTP 400 Bad Request
- Error message: "Idempotency-Key must not exceed 100 characters"

---

## Test 4: Different Users Can Use Same Idempotency-Key

### Step 1: User 1 Request

```powershell
$headers1 = @{
    "Authorization" = "Bearer test-key-1"  # user-1
    "Content-Type" = "application/json"
    "Idempotency-Key" = "shared-key-123"
}

$body1 = @{
    sessionId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    conversationId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    userId = "user-1"
    prompt = "User 1 request"
    provider = "stub"
} | ConvertTo-Json

$response1 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers1 -Body $body1
Write-Host "User 1 Response:"
$response1 | ConvertTo-Json
```

### Step 2: User 2 Request (Same Idempotency-Key, Different User)

```powershell
$headers2 = @{
    "Authorization" = "Bearer test-key-2"  # user-2
    "Content-Type" = "application/json"
    "Idempotency-Key" = "shared-key-123"
}

$body2 = @{
    sessionId = "cccccccc-cccc-cccc-cccc-cccccccccccc"
    conversationId = "dddddddd-dddd-dddd-dddd-dddddddddddd"
    userId = "user-2"
    prompt = "User 2 request"
    provider = "stub"
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method POST -Headers $headers2 -Body $body2
Write-Host "User 2 Response:"
$response2 | ConvertTo-Json
```

### Step 3: Verify Database (Should Have 2 Rows)

**SQL Query:**

```sql
SELECT user_id, request_id, execution_id, tokens_used
FROM usage_records
WHERE request_id = 'shared-key-123'
ORDER BY user_id;
```

**Expected Result:**
- 2 rows returned
- One for `user-1`, one for `user-2`
- Different `execution_id` values
- Unique constraint is on `(user_id, request_id)`, so different users can use same key

---

## Test 5: Full Database Verification Query

Run this query to see all usage records created during testing:

```sql
SELECT
    execution_id,
    request_id,
    user_id,
    api_key_id,
    provider,
    model,
    tokens_used,
    execution_duration_ms,
    timestamp
FROM usage_records
WHERE user_id IN ('user-1', 'user-2')
ORDER BY timestamp DESC
LIMIT 20;
```

---

## Cleanup (Optional)

To clean up test data after verification:

```sql
-- Delete test records (adjust WHERE clause as needed)
DELETE FROM usage_records
WHERE request_id LIKE 'test-idempotency-%'
   OR request_id = 'shared-key-123';
```

---

## Success Criteria

✅ **Test 1:** Duplicate `Idempotency-Key` creates only 1 row  
✅ **Test 2:** No `Idempotency-Key` creates 2 rows (backward compatible)  
✅ **Test 3:** Invalid keys rejected with 400 Bad Request  
✅ **Test 4:** Different users can use same key (scoped by user_id)  
✅ **Test 5:** All records visible in database with correct fields  

---

## Notes

- **Idempotency Scope:** Per user (`user_id` + `request_id`)
- **Backward Compatible:** Requests without `Idempotency-Key` work as before
- **Validation:** Empty or >100 char keys rejected before AI service call
- **Database Constraint:** `UNIQUE INDEX (user_id, request_id) WHERE request_id IS NOT NULL`
- **Error Handling:** Unique violation returns existing record (no error thrown)

---

## Troubleshooting

**Issue:** "Idempotency-Key must not be empty"  
**Solution:** Ensure header value is not empty string or whitespace-only

**Issue:** Unique violation error thrown  
**Solution:** Check that `isUniqueViolation()` logic correctly detects Postgres error code 23505

**Issue:** Multiple rows with same `request_id` for same user  
**Solution:** Verify unique index exists: `idx_usage_records_user_request_id`

**Issue:** Tests fail with "Cannot connect to database"  
**Solution:** Ensure PostgreSQL is running and connection string is correct
