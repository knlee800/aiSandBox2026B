# Phase-48 Timeout Watchdog Validation
#
# Validates:
# 1. Timeout triggers AbortController
# 2. Ledger state becomes timeout
# 3. SSE stream ends with completion event
# 4. Worker exits cleanly
#
# PREREQUISITES:
#   - PostgreSQL, Redis running (docker compose up)
#   - api-gateway on localhost:4000
#   - ai-service on localhost:4001 with EXECUTION_TIMEOUT_MS=2000
#   - Valid API key, AI_PROVIDER=stub
#
# Before running, set timeout and restart ai-service:
#   $env:EXECUTION_TIMEOUT_MS=2000
#   # Restart ai-service (stop and start)
#
# Stub adapter delays 3s on "Count slowly" prompt; 2s timeout fires first.
#
# USAGE: .\scripts\phase-48-timeout-validation.ps1

param(
    [string]$ApiKey = "valid-api-key",
    [string]$BaseUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Message) Write-Host "  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "  $Message" -ForegroundColor Green }
function Write-Fail { param([string]$Message) Write-Host "  $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "  $Message" -ForegroundColor Yellow }

Write-Host "`n=== Phase-48 Timeout Validation ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl`n" -ForegroundColor Gray

# 1. Submit execution
Write-Host "`n1. Submitting execution (POST /api/ai/execute)..." -ForegroundColor Yellow
$sessionId = [guid]::NewGuid().ToString()
$conversationId = [guid]::NewGuid().ToString()
$body = @{
    sessionId = $sessionId
    conversationId = $conversationId
    userId = "phase48-user"
    prompt = "Count slowly from 1 to 100."
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

try {
    $executeResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/execute" -Method Post -Headers $headers -Body $body
} catch {
    Write-Fail "Execute request failed: $_"
    exit 1
}

$executionId = $executeResponse.executionId
$status = $executeResponse.status
Write-Success "executionId=$executionId, status=$status"

# 2. Open SSE stream and capture output
Write-Host "`n2. Opening stream (GET /api/ai/executions/$executionId/stream)..." -ForegroundColor Yellow
$streamUrl = "$BaseUrl/api/ai/executions/$executionId/stream"
$streamOutput = @()

$streamJob = Start-Job -ScriptBlock {
    param($url, $auth)
    $req = [System.Net.WebRequest]::Create($url)
    $req.Headers.Add("Authorization", "Bearer $auth")
    $req.Method = "GET"
    try {
        $resp = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $line = $reader.ReadLine()
        while ($null -ne $line) {
            $line
            $line = $reader.ReadLine()
        }
    } catch { $_ }
} -ArgumentList $streamUrl, $ApiKey

# Wait for timeout (2s) + buffer
Start-Sleep -Seconds 5
$streamResult = Receive-Job -Job $streamJob
Stop-Job -Job $streamJob
Remove-Job -Job $streamJob

Write-Host "`n3. SSE stream output:" -ForegroundColor Yellow
$streamResult | ForEach-Object { Write-Host "   $_" }

# 4. Check ledger via result endpoint
Write-Host "`n4. Ledger state (GET /api/ai/executions/$executionId)..." -ForegroundColor Yellow
try {
    $resultResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/executions/$executionId" -Method Get -Headers $headers
    Write-Success "executionId: $($resultResponse.executionId)" 
    Write-Success "status: $($resultResponse.status)"
    $ledgerStatus = $resultResponse.status
} catch {
    Write-Fail "Result request failed: $_"
    $ledgerStatus = "unknown"
}

# 5. Worker logs (user must check ai-service terminal)
Write-Host "`n5. Worker logs:" -ForegroundColor Yellow
Write-Info "Check ai-service terminal for: 'Execution timed out executionId=$executionId'"

# 6. Validation summary
Write-Host "`n=== Validation Summary ===" -ForegroundColor Cyan
$passed = $true
if ($ledgerStatus -ne "timeout") {
    Write-Fail "Ledger status expected 'timeout', got '$ledgerStatus'"
    $passed = $false
} else {
    Write-Success "Ledger status = timeout"
}
$hasComplete = ($streamResult | Where-Object { $_ -match 'complete' }).Count -gt 0
if (-not $hasComplete) {
    Write-Fail "SSE stream did not contain completion event"
    $passed = $false
} else {
    Write-Success "SSE stream ended with completion event"
}
Write-Info "Verify worker logs show: 'Execution timed out executionId=...'"

if ($passed) {
    Write-Host "`n=== Phase-48 Timeout Validation PASSED ===" -ForegroundColor Green
} else {
    Write-Host "`n=== Phase-48 Timeout Validation FAILED ===" -ForegroundColor Red
    exit 1
}
