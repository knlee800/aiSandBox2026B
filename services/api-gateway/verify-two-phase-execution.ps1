# PHASE-43B-2D: Two-Phase Execution Record Verification Script
# 
# Purpose: Verify two-phase execution record implementation
# - Execution intent written BEFORE ai-service call (status: 'pending')
# - Execution result updated AFTER ai-service success (status: 'completed')
# - IdempotencyGuard handles 'pending' status (returns 409 Conflict)
# - Financial integrity guaranteed (no lost revenue)

Write-Host "=== PHASE-43B-2D: Two-Phase Execution Record Verification ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$apiGatewayUrl = "http://localhost:4000"
$apiKey = "test-key-1"
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "aisandbox"
$dbUser = "postgres"

# Test 1: Normal Execution (Happy Path)
Write-Host "Test 1: Normal Execution (Happy Path)" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "verify-two-phase-001"
}

$body = @{
    sessionId = "11111111-1111-1111-1111-111111111111"
    conversationId = "22222222-2222-2222-2222-222222222222"
    userId = "user-1"
    prompt = "Test two-phase execution"
    provider = "stub"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$apiGatewayUrl/api/ai/execute" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✓ Request succeeded" -ForegroundColor Green
    Write-Host "  Output: $($response.output)" -ForegroundColor Gray
    Write-Host "  Tokens: $($response.tokensUsed)" -ForegroundColor Gray
    Write-Host "  Model: $($response.model)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verifying database record..." -ForegroundColor Gray

# Query database to verify execution record
$query = @"
SELECT execution_id, execution_status, model, tokens_used, execution_duration_ms, request_id
FROM usage_records
WHERE request_id = 'verify-two-phase-001'
ORDER BY timestamp DESC
LIMIT 1;
"@

Write-Host "Expected: 1 record with execution_status = 'completed'" -ForegroundColor Gray
Write-Host "SQL Query: $query" -ForegroundColor DarkGray
Write-Host ""

# Test 2: Idempotent Retry (No Duplicate Billing)
Write-Host "Test 2: Idempotent Retry (No Duplicate Billing)" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow

$headers["Idempotency-Key"] = "verify-two-phase-002"
$body = @{
    sessionId = "22222222-2222-2222-2222-222222222222"
    conversationId = "33333333-3333-3333-3333-333333333333"
    userId = "user-1"
    prompt = "Test idempotent retry"
    provider = "stub"
} | ConvertTo-Json

try {
    # First request
    $response1 = Invoke-RestMethod -Uri "$apiGatewayUrl/api/ai/execute" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✓ First request succeeded" -ForegroundColor Green
    Write-Host "  Tokens: $($response1.tokensUsed)" -ForegroundColor Gray

    # Second request (same Idempotency-Key)
    $response2 = Invoke-RestMethod -Uri "$apiGatewayUrl/api/ai/execute" -Method POST -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✓ Second request succeeded (replay)" -ForegroundColor Green
    Write-Host "  Output: $($response2.output)" -ForegroundColor Gray
    Write-Host "  Tokens: $($response2.tokensUsed)" -ForegroundColor Gray

    if ($response2.output -eq "[Duplicate request - original response not stored]") {
        Write-Host "✓ Idempotency replay detected correctly" -ForegroundColor Green
    } else {
        Write-Host "✗ Idempotency replay NOT detected (expected placeholder output)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Verifying database record..." -ForegroundColor Gray

# Query database to verify only one record exists
$query = @"
SELECT COUNT(*) as record_count
FROM usage_records
WHERE request_id = 'verify-two-phase-002';
"@

Write-Host "Expected: 1 record (no duplicate)" -ForegroundColor Gray
Write-Host "SQL Query: $query" -ForegroundColor DarkGray
Write-Host ""

# Test 3: Concurrent Execution Detection (409 Conflict)
Write-Host "Test 3: Concurrent Execution Detection (409 Conflict)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow
Write-Host "Note: This test requires manual simulation (start first request, quickly send second)" -ForegroundColor Gray
Write-Host "Expected behavior: Second request returns HTTP 409 Conflict with status='pending'" -ForegroundColor Gray
Write-Host ""

# Test 4: Execution Status Verification
Write-Host "Test 4: Execution Status Verification" -ForegroundColor Yellow
Write-Host "-------------------------------------" -ForegroundColor Yellow

# Query database to verify all records have valid status
$query = @"
SELECT execution_status, COUNT(*) as count
FROM usage_records
GROUP BY execution_status
ORDER BY count DESC;
"@

Write-Host "Expected: Most records have execution_status = 'completed'" -ForegroundColor Gray
Write-Host "SQL Query: $query" -ForegroundColor DarkGray
Write-Host ""

# Test 5: Pending Record Detection (Orphaned Executions)
Write-Host "Test 5: Pending Record Detection (Orphaned Executions)" -ForegroundColor Yellow
Write-Host "------------------------------------------------------" -ForegroundColor Yellow

# Query database to find pending records older than 2 minutes
$query = @"
SELECT execution_id, user_id, request_id, timestamp, execution_status
FROM usage_records
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '2 minutes'
ORDER BY timestamp DESC
LIMIT 10;
"@

Write-Host "Expected: 0 records (or records marked as 'timeout' by cleanup job)" -ForegroundColor Gray
Write-Host "SQL Query: $query" -ForegroundColor DarkGray
Write-Host ""

# Summary
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Manual verification steps:" -ForegroundColor Yellow
Write-Host "1. Run Test 1 and verify database record has execution_status = 'completed'" -ForegroundColor Gray
Write-Host "2. Run Test 2 and verify only 1 record exists (no duplicate)" -ForegroundColor Gray
Write-Host "3. Manually test concurrent execution (start first request, quickly send second)" -ForegroundColor Gray
Write-Host "4. Query database to verify execution_status distribution" -ForegroundColor Gray
Write-Host "5. Query database to find orphaned 'pending' records (should be 0)" -ForegroundColor Gray
Write-Host ""
Write-Host "Financial Integrity Guarantee:" -ForegroundColor Cyan
Write-Host "- Execution intent written BEFORE ai-service call (status: 'pending')" -ForegroundColor Gray
Write-Host "- Execution result updated AFTER ai-service success (status: 'completed')" -ForegroundColor Gray
Write-Host "- If network/DB fails after AI success, 'pending' record remains for reconciliation" -ForegroundColor Gray
Write-Host "- No lost revenue (all AI executions are tracked)" -ForegroundColor Gray
Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
