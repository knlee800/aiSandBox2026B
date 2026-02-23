# PHASE-42A-3: Token Quota Verification Script
# PowerShell 5.x compatible
# Verifies max tokens per rolling 24h enforcement

param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$TestApiKey,
    [string]$TestUserEmail = "demo@aisandbox.com",
    [string]$TestUserPassword = "demo123",
    [int]$TokensPerRequest = 1000,
    [int]$MaxRequests = 105
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PHASE-42A-3: Token Quota Verification"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $TestApiKey) {
    Write-Host "ERROR: -TestApiKey is required." -ForegroundColor Red
    exit 1
}

# -----------------------------
# Step 1: Login (JWT)
# -----------------------------
Write-Host "[Step 1] Logging in..." -ForegroundColor Yellow

try {
    $loginBody = @{
        email = $TestUserEmail
        password = $TestUserPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod `
        -Uri "$BaseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    $jwtToken = $loginResponse.access_token
    Write-Host "  ✓ JWT obtained" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Login failed: $_" -ForegroundColor Red
    exit 1
}

# -----------------------------
# Step 2: Create Session (JWT)
# -----------------------------
Write-Host "[Step 2] Creating session..." -ForegroundColor Yellow

$jwtHeaders = @{
    "Authorization" = "Bearer $jwtToken"
    "Content-Type"  = "application/json"
}

try {
    $sessionBody = @{ name = "TokenQuotaTest" } | ConvertTo-Json

    $sessionResponse = Invoke-RestMethod `
        -Uri "$BaseUrl/api/sessions" `
        -Method POST `
        -Headers $jwtHeaders `
        -Body $sessionBody `
        -ErrorAction Stop

    $sessionId = $sessionResponse.id
    Write-Host "  ✓ Session created: $sessionId" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Session creation failed: $_" -ForegroundColor Red
    exit 1
}

# -----------------------------
# Step 3: Execute AI (API Key)
# -----------------------------
Write-Host "[Step 3] Executing AI calls..." -ForegroundColor Yellow

$apiKeyHeaders = @{
    "Authorization" = "Bearer $TestApiKey"
    "Content-Type"  = "application/json"
}

$conversationId = [guid]::NewGuid().ToString()

$successCount = 0
$quotaExceeded = $false
$totalTokens = 0

for ($i = 1; $i -le $MaxRequests; $i++) {

    $executeBody = @{
        sessionId      = $sessionId
        conversationId = $conversationId
        provider       = "stub"
        prompt         = "Token quota test"
        max_tokens     = $TokensPerRequest
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod `
            -Uri "$BaseUrl/api/ai/execute" `
            -Method POST `
            -Headers $apiKeyHeaders `
            -Body $executeBody `
            -ErrorAction Stop

        $successCount++
        $totalTokens += $response.tokensUsed
        Write-Host "  ✓ Request $i succeeded (Total tokens: $totalTokens)" -ForegroundColor Green
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__

        if ($statusCode -eq 403) {
            Write-Host "  ✓ Quota exceeded at request $i" -ForegroundColor Yellow

            try {
                $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json
                Write-Host "    quota_type: $($errorBody.details.quota_type)"
                Write-Host "    limit:      $($errorBody.details.limit)"
                Write-Host "    used:       $($errorBody.details.used)"
                Write-Host "    reset_at:   $($errorBody.details.reset_at)"
            } catch {}

            $quotaExceeded = $true
            break
        }
        else {
            Write-Host "  ✗ Unexpected error (HTTP $statusCode)" -ForegroundColor Red
            break
        }
    }

    Start-Sleep -Milliseconds 3100
}

# -----------------------------
# Step 4: Cleanup (JWT)
# -----------------------------
Write-Host "[Step 4] Cleaning up session..." -ForegroundColor Yellow

try {
    Invoke-RestMethod `
        -Uri "$BaseUrl/api/sessions/$sessionId" `
        -Method DELETE `
        -Headers $jwtHeaders `
        -ErrorAction SilentlyContinue | Out-Null

    Write-Host "  ✓ Session deleted" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠ Cleanup failed (non-fatal)" -ForegroundColor Yellow
}

# -----------------------------
# Final Summary
# -----------------------------
Write-Host ""
Write-Host "========================================"
Write-Host "VERIFICATION SUMMARY"
Write-Host "========================================"

Write-Host "Successful executions: $successCount"
Write-Host "Total tokens used:     $totalTokens"
Write-Host "Quota exceeded hit:    $quotaExceeded"

if ($quotaExceeded -and $successCount -ge 50) {
    Write-Host "✓ TOKEN QUOTA ENFORCEMENT WORKING" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "✗ VERIFICATION FAILED" -ForegroundColor Red
    exit 1
}