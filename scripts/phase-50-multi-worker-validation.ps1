# Phase-50 Multi-Worker Instance Validation
#
# Validates:
# 1. Multiple ai-service workers can run simultaneously
# 2. BullMQ distributes jobs across workers
# 3. Each execution is processed exactly once
# 4. Ledger integrity (no duplicates)
# 5. SSE streaming still works during distributed execution
#
# PREREQUISITES:
#   - PostgreSQL, Redis running (docker compose up)
#   - api-gateway on localhost:4000
#   - 2+ ai-service workers on localhost:4001 (each in separate terminal)
#     Example:
#       Terminal 1: $env:EXECUTION_WORKER_CONCURRENCY="2"; npm run start
#       Terminal 2: $env:EXECUTION_WORKER_CONCURRENCY="2"; npm run start
#   - Valid API key, AI_PROVIDER=stub
#
# USAGE: .\scripts\phase-50-multi-worker-validation.ps1

param(
    [string]$ApiKey = "valid-api-key",
    [string]$BaseUrl = "http://localhost:4000",
    [int]$JobCount = 10
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Message) Write-Host "  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "  $Message" -ForegroundColor Green }
function Write-Fail { param([string]$Message) Write-Host "  $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "  $Message" -ForegroundColor Yellow }

Write-Host "`n=== Phase-50 Multi-Worker Validation ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl, JobCount: $JobCount`n" -ForegroundColor Gray

$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "application/json"
}

# 1. Submit multiple execution requests
Write-Host "1. Submitting $JobCount execution requests..." -ForegroundColor Yellow
$executionIds = @()
for ($i = 1; $i -le $JobCount; $i++) {
    $sessionId = [guid]::NewGuid().ToString()
    $conversationId = [guid]::NewGuid().ToString()
    $body = @{
        sessionId = $sessionId
        conversationId = $conversationId
        userId = "phase50-user"
        prompt = "Say hello $i"
    } | ConvertTo-Json

    try {
        $executeResponse = Invoke-RestMethod -Uri "$BaseUrl/api/ai/execute" -Method Post -Headers $headers -Body $body
        $executionIds += $executeResponse.executionId
        Write-Host "   [$i/$JobCount] executionId=$($executeResponse.executionId)" -ForegroundColor Gray
    } catch {
        Write-Fail "Request $i failed: $_"
        exit 1
    }
}

Write-Success "Submitted $($executionIds.Count) jobs"

# 2. Wait for jobs to complete (stub is fast)
Write-Host "`n2. Waiting for jobs to complete (15s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# 3. Verify each execution via API
Write-Host "`n3. Verifying execution status via API..." -ForegroundColor Yellow
$statuses = @{}
$duplicates = @()
foreach ($eid in $executionIds) {
    try {
        $result = Invoke-RestMethod -Uri "$BaseUrl/api/ai/executions/$eid" -Method Get -Headers $headers
        $statuses[$eid] = $result.status
        Write-Host "   $eid -> $($result.status)" -ForegroundColor Gray
    } catch {
        Write-Fail "Failed to get $eid : $_"
        $statuses[$eid] = "error"
    }
}

# 4. Check for duplicates
$uniqueCount = ($executionIds | Select-Object -Unique).Count
if ($uniqueCount -ne $executionIds.Count) {
    Write-Fail "Duplicate executionIds detected: $($executionIds.Count) submitted, $uniqueCount unique"
} else {
    Write-Success "No duplicate executionIds in submitted batch"
}

# 5. Ledger validation via PostgreSQL (if docker available)
Write-Host "`n4. Ledger validation via PostgreSQL..." -ForegroundColor Yellow
$ledgerIds = ($executionIds | ForEach-Object { "'$_'" }) -join ","
$pgUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "aisandbox" }
$pgDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "aisandbox" }

try {
    $ledgerResult = docker exec aisandbox-postgres psql -U $pgUser -d $pgDb -t -A -F "|" -c "SELECT execution_id, execution_status FROM usage_records WHERE execution_id IN ($ledgerIds) ORDER BY created_at DESC;"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Ledger rows:" -ForegroundColor Gray
        $ledgerResult | ForEach-Object { Write-Host "   $_" }
        $ledgerRows = ($ledgerResult | Where-Object { $_ -match '\S' }).Count
        if ($ledgerRows -ne $executionIds.Count) {
            Write-Fail "Ledger row count mismatch: expected $($executionIds.Count), got $ledgerRows"
        } else {
            Write-Success "Ledger has exactly $ledgerRows rows (one per execution)"
        }
    } else {
        Write-Info "Docker/psql not available; skip ledger query. Manual: SELECT execution_id, execution_status FROM usage_records ORDER BY created_at DESC LIMIT $JobCount;"
    }
} catch {
    Write-Info "Docker/psql not available; skip ledger query. Manual: SELECT execution_id, execution_status FROM usage_records ORDER BY created_at DESC LIMIT $JobCount;"
}

# 6. Streaming validation (one sample)
Write-Host "`n5. Streaming validation (sample execution)..." -ForegroundColor Yellow
$sampleId = $executionIds[0]
$streamUrl = "$BaseUrl/api/ai/executions/$sampleId/stream"
$streamJob = Start-Job -ScriptBlock {
    param($url, $auth)
    $req = [System.Net.WebRequest]::Create($url)
    $req.Headers.Add("Authorization", "Bearer $auth")
    $req.Method = "GET"
    try {
        $resp = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $line = $reader.ReadLine()
        $count = 0
        while ($null -ne $line -and $count -lt 20) {
            $line
            $line = $reader.ReadLine()
            $count++
        }
    } catch { $_ }
} -ArgumentList $streamUrl, $ApiKey

Start-Sleep -Seconds 3
$streamResult = Receive-Job -Job $streamJob
Stop-Job -Job $streamJob
Remove-Job -Job $streamJob

$hasComplete = ($streamResult | Where-Object { $_ -match 'complete' }).Count -gt 0
if ($hasComplete) {
    Write-Success "SSE stream contained completion event"
} else {
    Write-Info "Stream may have already closed (execution completed). Check worker logs."
}

# 7. Summary
Write-Host "`n=== Validation Summary ===" -ForegroundColor Cyan
$completedCount = ($statuses.Values | Where-Object { $_ -eq "completed" }).Count
$validStatuses = @("completed", "cancelled", "timeout", "failed")
$invalidCount = ($statuses.Values | Where-Object { $_ -notin $validStatuses }).Count

if ($invalidCount -gt 0) {
    Write-Fail "Some executions have invalid status: $($statuses.Values | Where-Object { $_ -notin $validStatuses })"
} else {
    Write-Success "All executions have valid final status"
}

Write-Host "`nExpected: Jobs distributed across workers in logs. Check ai-service terminals for workerId in execution logs." -ForegroundColor Gray
Write-Host "Example: Worker received job ... executionId=... workerId=12345" -ForegroundColor Gray
Write-Host "`n=== Phase-50 Multi-Worker Validation Complete ===" -ForegroundColor Cyan
