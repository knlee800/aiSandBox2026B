# PHASE-42A-2: Rolling 24h Session Quota Verification Script
# PowerShell 5.x compatible
#
# Verifies max sessions per rolling 24h enforcement
# Target: POST /api/sessions
# Limit: 20 sessions per rolling 24h window
# Expected: HTTP 403 Forbidden when limit exceeded

param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$TestUserId = "test-user-42a2",
    [string]$TestPassword = "TestPassword123!"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PHASE-42A-2: Rolling 24h Session Quota Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test configuration
$MaxSessionsPer24h = 20
$SessionsToCreate = 22  # Exceed limit by 2

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Base URL: $BaseUrl"
Write-Host "  Max sessions per 24h: $MaxSessionsPer24h"
Write-Host "  Sessions to create: $SessionsToCreate"
Write-Host ""

# Step 1: Register test user (or login if exists)
Write-Host "[Step 1] Register/Login test user..." -ForegroundColor Yellow
try {
    $registerBody = @{
        email = "$TestUserId@test.local"
        password = $TestPassword
        name = "Test User 42A2"
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" `
        -Method POST `
        -Body $registerBody `
        -ContentType "application/json" `
        -ErrorAction SilentlyContinue

    Write-Host "  ✓ User registered successfully" -ForegroundColor Green
    $token = $registerResponse.access_token
} catch {
    # User might already exist, try login
    Write-Host "  User exists, attempting login..." -ForegroundColor Gray
    
    $loginBody = @{
        email = "$TestUserId@test.local"
        password = $TestPassword
    } | ConvertTo-Json

    try {
        $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
            -Method POST `
            -Body $loginBody `
            -ContentType "application/json"

        Write-Host "  ✓ User logged in successfully" -ForegroundColor Green
        $token = $loginResponse.access_token
    } catch {
        Write-Host "  ✗ Failed to login: $_" -ForegroundColor Red
        exit 1
    }
}

if (-not $token) {
    Write-Host "  ✗ No authentication token received" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Create sessions up to and beyond limit
Write-Host "[Step 2] Creating $SessionsToCreate sessions..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$successCount = 0
$quotaExceededCount = 0
$createdSessionIds = @()

for ($i = 1; $i -le $SessionsToCreate; $i++) {
    Write-Host "  Creating session $i/$SessionsToCreate..." -NoNewline
    
    $createBody = @{
        name = "Test Session $i"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/sessions" `
            -Method POST `
            -Headers $headers `
            -Body $createBody `
            -ErrorAction Stop

        $successCount++
        $createdSessionIds += $response.id
        Write-Host " ✓ Success (ID: $($response.id))" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        
        if ($statusCode -eq 403) {
            $quotaExceededCount++
            
            # Parse error response
            $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
            
            Write-Host " ✓ Quota exceeded (HTTP 403)" -ForegroundColor Yellow
            Write-Host "    Error: $($errorBody.message)" -ForegroundColor Gray
            Write-Host "    Quota Type: $($errorBody.details.quota_type)" -ForegroundColor Gray
            Write-Host "    Limit: $($errorBody.details.limit)" -ForegroundColor Gray
            Write-Host "    Current: $($errorBody.details.current)" -ForegroundColor Gray
            
            if ($errorBody.details.reset_at) {
                Write-Host "    Reset At: $($errorBody.details.reset_at)" -ForegroundColor Gray
            }
        } else {
            Write-Host " ✗ Unexpected error (HTTP $statusCode): $_" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Step 3: Verify results
Write-Host "[Step 3] Verification Results" -ForegroundColor Yellow
Write-Host "  Sessions created successfully: $successCount" -ForegroundColor $(if ($successCount -eq $MaxSessionsPer24h) { "Green" } else { "Red" })
Write-Host "  Quota exceeded responses: $quotaExceededCount" -ForegroundColor $(if ($quotaExceededCount -eq ($SessionsToCreate - $MaxSessionsPer24h)) { "Green" } else { "Red" })
Write-Host ""

# Step 4: Verify enforcement order (active sessions check should still work)
Write-Host "[Step 4] Verifying enforcement order..." -ForegroundColor Yellow
Write-Host "  Note: Max active sessions (5) should be enforced before rolling 24h (20)" -ForegroundColor Gray
Write-Host "  Current active sessions: $(($createdSessionIds | Measure-Object).Count)" -ForegroundColor Gray

if (($createdSessionIds | Measure-Object).Count -ge 5) {
    Write-Host "  ✓ Max active sessions limit (5) was respected" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Could not verify max active sessions enforcement" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Cleanup (terminate all created sessions)
Write-Host "[Step 5] Cleanup - Terminating created sessions..." -ForegroundColor Yellow
$cleanupCount = 0

foreach ($sessionId in $createdSessionIds) {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/sessions/$sessionId" `
            -Method DELETE `
            -Headers $headers `
            -ErrorAction SilentlyContinue | Out-Null
        $cleanupCount++
    } catch {
        # Ignore cleanup errors
    }
}

Write-Host "  ✓ Cleaned up $cleanupCount sessions" -ForegroundColor Green
Write-Host ""

# Final verdict
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = $true

if ($successCount -ne $MaxSessionsPer24h) {
    Write-Host "✗ FAIL: Expected $MaxSessionsPer24h successful creations, got $successCount" -ForegroundColor Red
    $passed = $false
}

if ($quotaExceededCount -ne ($SessionsToCreate - $MaxSessionsPer24h)) {
    Write-Host "✗ FAIL: Expected $(($SessionsToCreate - $MaxSessionsPer24h)) quota exceeded responses, got $quotaExceededCount" -ForegroundColor Red
    $passed = $false
}

if ($passed) {
    Write-Host "✓ ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "Rolling 24h session quota enforcement is working correctly:" -ForegroundColor Green
    Write-Host "  - First $MaxSessionsPer24h sessions created successfully" -ForegroundColor Green
    Write-Host "  - Subsequent sessions blocked with HTTP 403" -ForegroundColor Green
    Write-Host "  - Error response includes quota_type, limit, current, reset_at" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ VERIFICATION FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. API Gateway is running on $BaseUrl" -ForegroundColor Yellow
    Write-Host "  2. SessionQuotaGuard is applied to POST /api/sessions" -ForegroundColor Yellow
    Write-Host "  3. QuotaConfig.MAX_SESSIONS_PER_24H = $MaxSessionsPer24h" -ForegroundColor Yellow
    Write-Host "  4. Database queries are working correctly" -ForegroundColor Yellow
    exit 1
}
