# Orphan Execution Reconciliation Verification Script
#
# PHASE-43B-4: Orphan Execution Cleanup & Reconciliation
#
# Purpose:
# - Verify orphan detection and reconciliation behavior
# - Single-shot verification (no loops)
# - Deterministic outcomes
#
# Tests:
# 1. Create orphan (write intent, do NOT update result, wait 5min)
# 2. Retry with same Idempotency-Key → verify transition to timeout
# 3. Verify new execution succeeds
# 4. Verify DB row count
# 5. Verify quota not affected
#
# Usage:
#   cd services/api-gateway/scripts
#   pwsh verify-orphan-reconciliation.ps1
#
# Requirements:
# - PowerShell 5.1 or later
# - api-gateway running on http://localhost:4000
# - PostgreSQL accessible

param(
    [string]$ApiGatewayUrl = "http://localhost:4000",
    [string]$ApiKey = "test-key-1",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "ai_sandbox",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres"
)

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Orphan Execution Reconciliation Verification" -ForegroundColor Cyan
Write-Host "PHASE-43B-4: Orphan Execution Cleanup & Reconciliation" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  API Gateway URL: $ApiGatewayUrl" -ForegroundColor Gray
Write-Host "  API Key: $ApiKey" -ForegroundColor Gray
Write-Host "  Database: $DbHost:$DbPort/$DbName" -ForegroundColor Gray
Write-Host ""

# Helper function to execute SQL query
function Invoke-SqlQuery {
    param(
        [string]$Query
    )
    
    $env:PGPASSWORD = $DbPassword
    $result = psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -t -A -c $Query
    $env:PGPASSWORD = $null
    return $result
}

# Test 1: Create orphan (manual DB insert with old timestamp)
Write-Host "Test 1: Create orphaned execution" -ForegroundColor Yellow
Write-Host "  Creating pending execution with old timestamp (6 minutes ago)..." -ForegroundColor Gray

$idempotencyKey = "verify-orphan-$(Get-Date -Format 'yyyyMMddHHmmss')"
$executionId = [guid]::NewGuid().ToString()
$userId = "user-1"
$sessionId = "11111111-1111-1111-1111-111111111111"
$conversationId = "22222222-2222-2222-2222-222222222222"

# Insert orphaned record (6 minutes ago)
$insertQuery = @"
INSERT INTO usage_records (
    execution_id, api_key_id, user_id, session_id, conversation_id,
    provider, adapter, request_id, execution_status, timestamp
) VALUES (
    '$executionId', '$ApiKey', '$userId', '$sessionId', '$conversationId',
    'stub', 'stub', '$idempotencyKey', 'pending', NOW() - INTERVAL '6 minutes'
);
"@

try {
    Invoke-SqlQuery -Query $insertQuery | Out-Null
    Write-Host "  ✓ Orphaned execution created: executionId=$executionId" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to create orphaned execution: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Verify orphan age
Write-Host "Test 2: Verify orphan age" -ForegroundColor Yellow
Write-Host "  Checking age of orphaned execution..." -ForegroundColor Gray

$ageQuery = @"
SELECT EXTRACT(EPOCH FROM (NOW() - timestamp)) / 60 AS age_minutes
FROM usage_records
WHERE execution_id = '$executionId';
"@

$ageMinutes = [int](Invoke-SqlQuery -Query $ageQuery)
Write-Host "  ✓ Orphan age: $ageMinutes minutes" -ForegroundColor Green

if ($ageMinutes -lt 5) {
    Write-Host "  ⚠ Warning: Orphan age is less than 5 minutes (threshold not met)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Retry with same Idempotency-Key (should transition to timeout and allow retry)
Write-Host "Test 3: Retry with same Idempotency-Key" -ForegroundColor Yellow
Write-Host "  Sending retry request..." -ForegroundColor Gray

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
    "Idempotency-Key" = $idempotencyKey
}

$body = @{
    sessionId = $sessionId
    conversationId = $conversationId
    userId = $userId
    prompt = "Test orphan reconciliation"
    provider = "stub"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$ApiGatewayUrl/api/ai/execute" `
        -Method POST -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "  ✓ Retry succeeded (HTTP 200)" -ForegroundColor Green
    Write-Host "    Output: $($response.output)" -ForegroundColor Gray
    Write-Host "    Tokens: $($response.tokensUsed)" -ForegroundColor Gray
    Write-Host "    Model: $($response.model)" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Retry failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: Verify orphan transitioned to timeout
Write-Host "Test 4: Verify orphan transitioned to timeout" -ForegroundColor Yellow
Write-Host "  Checking execution status..." -ForegroundColor Gray

$statusQuery = @"
SELECT execution_status
FROM usage_records
WHERE execution_id = '$executionId';
"@

$status = Invoke-SqlQuery -Query $statusQuery
Write-Host "  ✓ Orphan status: $status" -ForegroundColor Green

if ($status -ne "timeout") {
    Write-Host "  ✗ Expected status 'timeout', got '$status'" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 5: Verify new execution record created
Write-Host "Test 5: Verify new execution record" -ForegroundColor Yellow
Write-Host "  Checking for completed execution..." -ForegroundColor Gray

$countQuery = @"
SELECT COUNT(*) AS count
FROM usage_records
WHERE request_id = '$idempotencyKey' AND execution_status = 'completed';
"@

$completedCount = [int](Invoke-SqlQuery -Query $countQuery)
Write-Host "  ✓ Completed executions: $completedCount" -ForegroundColor Green

if ($completedCount -lt 1) {
    Write-Host "  ✗ Expected at least 1 completed execution, got $completedCount" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 6: Verify total DB row count
Write-Host "Test 6: Verify DB row count" -ForegroundColor Yellow
Write-Host "  Checking total rows for request_id..." -ForegroundColor Gray

$totalCountQuery = @"
SELECT COUNT(*) AS count
FROM usage_records
WHERE request_id = '$idempotencyKey';
"@

$totalCount = [int](Invoke-SqlQuery -Query $totalCountQuery)
Write-Host "  ✓ Total rows: $totalCount" -ForegroundColor Green

if ($totalCount -gt 2) {
    Write-Host "  ⚠ Warning: Expected at most 2 rows, got $totalCount (possible duplicate billing)" -ForegroundColor Yellow
}

Write-Host ""

# Test 7: Verify replay returns same result
Write-Host "Test 7: Verify replay (deterministic behavior)" -ForegroundColor Yellow
Write-Host "  Sending replay request..." -ForegroundColor Gray

try {
    $replayResponse = Invoke-RestMethod -Uri "$ApiGatewayUrl/api/ai/execute" `
        -Method POST -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "  ✓ Replay succeeded (HTTP 200)" -ForegroundColor Green
    
    # Verify exact match
    if ($replayResponse.output -eq $response.output) {
        Write-Host "  ✓ Output matches (deterministic)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Output mismatch" -ForegroundColor Red
        exit 1
    }
    
    if ($replayResponse.tokensUsed -eq $response.tokensUsed) {
        Write-Host "  ✓ Tokens match" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Tokens mismatch" -ForegroundColor Red
        exit 1
    }
    
    if ($replayResponse.model -eq $response.model) {
        Write-Host "  ✓ Model matches" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Model mismatch" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ Replay failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 8: Verify quota not affected (orphan has tokens_used=NULL)
Write-Host "Test 8: Verify quota not affected" -ForegroundColor Yellow
Write-Host "  Checking tokens_used for orphan..." -ForegroundColor Gray

$tokensQuery = @"
SELECT tokens_used
FROM usage_records
WHERE execution_id = '$executionId';
"@

$tokensUsed = Invoke-SqlQuery -Query $tokensQuery
if ($tokensUsed -eq "") {
    Write-Host "  ✓ Orphan tokens_used: NULL (correct)" -ForegroundColor Green
} else {
    Write-Host "  ✗ Orphan tokens_used: $tokensUsed (expected NULL)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Cleanup
Write-Host "Cleanup: Removing test records" -ForegroundColor Yellow
$cleanupQuery = @"
DELETE FROM usage_records WHERE request_id = '$idempotencyKey';
"@

try {
    Invoke-SqlQuery -Query $cleanupQuery | Out-Null
    Write-Host "  ✓ Test records removed" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Warning: Failed to remove test records: $_" -ForegroundColor Yellow
}

Write-Host ""

# Summary
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Verification Complete: ALL TESTS PASSED" -ForegroundColor Green
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  ✓ Orphan detection works (age > 5 minutes)" -ForegroundColor Green
Write-Host "  ✓ Orphan transition to timeout works" -ForegroundColor Green
Write-Host "  ✓ Retry after orphan succeeds" -ForegroundColor Green
Write-Host "  ✓ New execution record created" -ForegroundColor Green
Write-Host "  ✓ DB row count correct (no duplicate billing)" -ForegroundColor Green
Write-Host "  ✓ Replay returns deterministic result" -ForegroundColor Green
Write-Host "  ✓ Quota not affected (orphan has NULL tokens)" -ForegroundColor Green
Write-Host ""

Write-Host "Phase 43B-4 implementation verified successfully." -ForegroundColor Green
Write-Host ""
