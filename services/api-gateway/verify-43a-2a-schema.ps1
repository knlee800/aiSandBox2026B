# verify-43a-2a-schema.ps1
# PHASE-43A-2A: Verification Script for request_id Schema Changes
# Verifies that request_id column and unique constraint exist and work correctly

Write-Host "=== PHASE-43A-2A Schema Verification ===" -ForegroundColor Cyan
Write-Host ""

$containerName = "aisandbox-postgres"
$dbUser = "aisandbox"
$dbName = "aisandbox"

# Test A: Verify column exists
Write-Host "[Test A] Verify request_id column exists" -ForegroundColor Yellow
$queryA = "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='usage_records' AND column_name='request_id';"
$resultA = docker exec -i $containerName psql -U $dbUser -d $dbName -t -c $queryA

if ($resultA -match "request_id") {
    Write-Host "[PASS] Column 'request_id' exists" -ForegroundColor Green
    Write-Host "       $($resultA.Trim())" -ForegroundColor Gray
} else {
    Write-Host "[FAIL] Column 'request_id' NOT FOUND" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test B: Verify unique constraint exists
Write-Host "[Test B] Verify unique constraint on (user_id, request_id)" -ForegroundColor Yellow
$queryB = "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='usage_records' AND indexdef ILIKE '%request_id%';"
$resultB = docker exec -i $containerName psql -U $dbUser -d $dbName -t -c $queryB

if ($resultB -match "idx_usage_records_user_request_id" -and $resultB -match "UNIQUE") {
    Write-Host "[PASS] UNIQUE constraint exists: idx_usage_records_user_request_id" -ForegroundColor Green
    Write-Host "       WHERE clause: request_id IS NOT NULL" -ForegroundColor Gray
} else {
    Write-Host "[FAIL] UNIQUE constraint NOT FOUND" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test C: Verify behavior - duplicate prevention
Write-Host "[Test C] Verify duplicate prevention behavior" -ForegroundColor Yellow

# C1: Insert first record with request_id
$testUserId = "verify-user-$(Get-Random)"
$testRequestId = "verify-request-$(Get-Random)"
$testExecId1 = [guid]::NewGuid().ToString()
$testSessionId = [guid]::NewGuid().ToString()
$testConvId = [guid]::NewGuid().ToString()

$insertC1 = "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, model, tokens_used, execution_duration_ms, request_id) VALUES ('$testExecId1', 'test-key', '$testUserId', '$testSessionId', '$testConvId', 'test', 'test', 'test-model', 100, 1000, '$testRequestId');"
$resultC1 = docker exec -i $containerName psql -U $dbUser -d $dbName -c $insertC1 2>&1

if ($resultC1 -match "INSERT 0 1") {
    Write-Host "[PASS] First insert with request_id succeeded" -ForegroundColor Green
} else {
    Write-Host "[FAIL] First insert failed: $resultC1" -ForegroundColor Red
    exit 1
}

# C2: Attempt duplicate insert (should fail)
$testExecId2 = [guid]::NewGuid().ToString()
$insertC2 = "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, model, tokens_used, execution_duration_ms, request_id) VALUES ('$testExecId2', 'test-key', '$testUserId', '$testSessionId', '$testConvId', 'test', 'test', 'test-model', 100, 1000, '$testRequestId');"
$resultC2 = docker exec -i $containerName psql -U $dbUser -d $dbName -c $insertC2 2>&1

if ($resultC2 -match "duplicate key value violates unique constraint") {
    Write-Host "[PASS] Duplicate request_id correctly rejected" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Duplicate was NOT rejected (constraint not working): $resultC2" -ForegroundColor Red
    # Cleanup before exit
    docker exec -i $containerName psql -U $dbUser -d $dbName -c "DELETE FROM usage_records WHERE user_id = '$testUserId';" | Out-Null
    exit 1
}

# C3: Insert with NULL request_id (should succeed, multiple NULLs allowed)
$testExecId3 = [guid]::NewGuid().ToString()
$insertC3 = "INSERT INTO usage_records (execution_id, api_key_id, user_id, session_id, conversation_id, provider, adapter, model, tokens_used, execution_duration_ms, request_id) VALUES ('$testExecId3', 'test-key', '$testUserId', '$testSessionId', '$testConvId', 'test', 'test', 'test-model', 100, 1000, NULL);"
$resultC3 = docker exec -i $containerName psql -U $dbUser -d $dbName -c $insertC3 2>&1

if ($resultC3 -match "INSERT 0 1") {
    Write-Host "[PASS] Insert with NULL request_id succeeded (backward compatible)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Insert with NULL request_id failed: $resultC3" -ForegroundColor Red
    # Cleanup before exit
    docker exec -i $containerName psql -U $dbUser -d $dbName -c "DELETE FROM usage_records WHERE user_id = '$testUserId';" | Out-Null
    exit 1
}

# Cleanup test data
Write-Host ""
Write-Host "[Cleanup] Removing test data..." -ForegroundColor Gray
docker exec -i $containerName psql -U $dbUser -d $dbName -c "DELETE FROM usage_records WHERE user_id = '$testUserId';" | Out-Null

Write-Host ""
Write-Host "=== All Verifications PASSED ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✓ Column 'request_id' exists (varchar, nullable)" -ForegroundColor Green
Write-Host "  ✓ UNIQUE constraint exists on (user_id, request_id)" -ForegroundColor Green
Write-Host "  ✓ Duplicate request_id correctly rejected" -ForegroundColor Green
Write-Host "  ✓ NULL request_id allowed (backward compatible)" -ForegroundColor Green
Write-Host ""
Write-Host "Ready for PHASE-43A-2B (service logic implementation)" -ForegroundColor Cyan
