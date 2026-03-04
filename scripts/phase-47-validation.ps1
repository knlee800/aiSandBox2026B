# Phase-47 Cancellation Pipeline Validation
#
# Validates:
# 1. Cancellation endpoint works
# 2. Worker detects cancel_requested
# 3. AbortController aborts provider execution
# 4. Ledger transitions to cancelled
# 5. SSE stream closes correctly
#
# PREREQUISITES:
#   - PostgreSQL, Redis running (docker compose up)
#   - api-gateway on localhost:4000
#   - ai-service on localhost:4001
#   - Valid API key, AI_PROVIDER=stub
#
# USAGE: .\scripts\phase-47-validation.ps1

param(
    [string]$ApiKey = "valid-api-key",
    [string]$BaseUrl = "http://localhost:4000"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Phase-47 Cancellation Validation ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl`n" -ForegroundColor Gray

# 1. Submit execution
Write-Host "1. Submitting execution (POST /api/ai/execute)..." -ForegroundColor Yellow
$sessionId = [guid]::NewGuid().ToString()
$conversationId = [guid]::NewGuid().ToString()
$body = @{
    sessionId = $sessionId
    conversationId = $conversationId
    userId = "phase47-user"
    prompt = "Count slowly from 1 to 100."
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

try {
    $executeResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/execute" -Method Post -Headers $headers -Body $body
} catch {
    Write-Host "FAIL: Execute request failed: $_" -ForegroundColor Red
    exit 1
}

$executionId = $executeResponse.executionId
$status = $executeResponse.status

Write-Host "   Response: executionId=$executionId, status=$status" -ForegroundColor Green
if ($status -ne "queued") {
    Write-Host "   WARN: Expected status=queued, got $status" -ForegroundColor Yellow
}

# 2. Open SSE stream in background, then cancel
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

Start-Sleep -Seconds 1

# 3. Cancel execution
Write-Host "3. Cancelling (POST /api/ai/executions/$executionId/cancel)..." -ForegroundColor Yellow
try {
    $cancelResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/executions/$executionId/cancel" -Method Post -Headers $headers
    Write-Host "   Response: executionId=$($cancelResponse.executionId), status=$($cancelResponse.status)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "   Cancel response: $statusCode - $($_.Exception.Message)" -ForegroundColor $(if ($statusCode -eq 409) { "Yellow" } else { "Red" })
}

# Wait for stream to close
Start-Sleep -Seconds 3
$streamResult = Receive-Job -Job $streamJob
Stop-Job -Job $streamJob
Remove-Job -Job $streamJob

Write-Host "`n4. SSE stream output:" -ForegroundColor Yellow
$streamResult | ForEach-Object { Write-Host "   $_" }

# 5. Check ledger via result endpoint
Write-Host "`n5. Checking result (GET /api/ai/executions/$executionId)..." -ForegroundColor Yellow
try {
    $resultResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/executions/$executionId" -Method Get -Headers $headers
    Write-Host "   executionId: $($resultResponse.executionId)" -ForegroundColor Gray
    Write-Host "   status: $($resultResponse.status)" -ForegroundColor $(if ($resultResponse.status -eq "cancelled") { "Green" } else { "Yellow" })
} catch {
    Write-Host "   FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Validation Complete ===" -ForegroundColor Cyan
Write-Host "Expected: execution_status=cancelled, stream ends with complete event" -ForegroundColor Gray
Write-Host "Check worker logs for: 'Execution aborted executionId=$executionId'" -ForegroundColor Gray
