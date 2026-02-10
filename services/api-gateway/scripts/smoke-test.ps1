# Release Candidate Smoke Test Script
# Phase 33A: Automated smoke pack execution
#
# PURPOSE: Run all smoke tests in sequence with clear pass/fail output
#
# USAGE:
#   .\scripts\smoke-test.ps1
#
# PREREQUISITES:
#   - PostgreSQL running on localhost:5432
#   - api-gateway running on localhost:4000
#   - ai-service running on localhost:4001
#   - Valid API key configured
#   - AI_PROVIDER environment variable set
#   - Provider API key configured

param(
    [string]$ApiKey = "valid-api-key",
    [string]$BaseUrl = "http://localhost:4000",
    [string]$PostgresPassword = "postgres"
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# ANSI color codes for output
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

$PassCount = 0
$FailCount = 0
$StartTime = Get-Date

function Write-TestHeader {
    param([string]$Message)
    Write-Host "`n${Blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
    Write-Host "${Blue}$Message${Reset}"
    Write-Host "${Blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    if ($Passed) {
        Write-Host "${Green}✓${Reset} $TestName"
        if ($Details) {
            Write-Host "  ${Details}"
        }
        $script:PassCount++
    } else {
        Write-Host "${Red}✗${Reset} $TestName"
        if ($Details) {
            Write-Host "  ${Red}${Details}${Reset}"
        }
        $script:FailCount++
    }
}

# Banner
Write-Host "${Blue}"
Write-Host "╔════════════════════════════════════════════════════════╗"
Write-Host "║   Release Candidate Smoke Pack — Phase 33A            ║"
Write-Host "║   AI Sandbox Platform — api-gateway                    ║"
Write-Host "╚════════════════════════════════════════════════════════╝"
Write-Host "${Reset}"

# Test 1: PostgreSQL Connectivity
Write-TestHeader "Test 1: PostgreSQL Connectivity"
try {
    $env:PGPASSWORD = $PostgresPassword
    $result = psql -h localhost -U postgres -d aisandbox -t -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -match "1") {
        Write-TestResult "PostgreSQL connection" $true "Database 'aisandbox' accessible"
    } else {
        Write-TestResult "PostgreSQL connection" $false "Connection failed or database not found"
    }
} catch {
    Write-TestResult "PostgreSQL connection" $false $_.Exception.Message
}

# Test 2: api-gateway Health
Write-TestHeader "Test 2: api-gateway Health Check"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -ErrorAction Stop
    if ($response.status -eq "ok" -and $response.service -eq "api-gateway") {
        Write-TestResult "Health endpoint" $true "Service: $($response.service), Version: $($response.version)"
    } else {
        Write-TestResult "Health endpoint" $false "Unexpected response"
    }
} catch {
    Write-TestResult "Health endpoint" $false $_.Exception.Message
}

# Test 3: api-gateway Readiness
Write-TestHeader "Test 3: api-gateway Readiness Check"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -Method Get -ErrorAction Stop
    if ($response.status -eq "ready") {
        $checksOk = ($response.checks.environment -eq "validated") -and 
                    ($response.checks.database -eq "connected") -and
                    ($response.checks.killSwitches -eq "loaded") -and
                    ($response.checks.safetyLimits -eq "loaded")
        
        if ($checksOk) {
            Write-TestResult "Readiness check" $true "All startup validators passed"
            Write-Host "  Environment: $($response.environment.launchState) / $($response.environment.abortMode)"
            Write-Host "  Kill Switches: $($response.killSwitches.enabled) enabled / $($response.killSwitches.total) total"
            Write-Host "  Safety Limits: $($response.safetyLimits.total) loaded"
        } else {
            Write-TestResult "Readiness check" $false "Some validators failed"
        }
    } else {
        Write-TestResult "Readiness check" $false "Service not ready"
    }
} catch {
    Write-TestResult "Readiness check" $false $_.Exception.Message
}

# Test 4: Database Connectivity
Write-TestHeader "Test 4: Database Connectivity (from api-gateway)"
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health/db" -Method Get -ErrorAction Stop
    if ($response.status -eq "ok" -and $response.database -eq "connected") {
        Write-TestResult "Database check" $true "Database connected from api-gateway"
    } else {
        Write-TestResult "Database check" $false "Database not connected"
    }
} catch {
    Write-TestResult "Database check" $false $_.Exception.Message
}

# Test 5: Authentication & Execution
Write-TestHeader "Test 5: End-to-End Execution (with real provider)"
try {
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        sessionId = "smoke-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        conversationId = "smoke-conv-$(Get-Date -Format 'yyyyMMddHHmmss')"
        userId = "smoke-user"
        prompt = "What is 2+2? Answer in one sentence."
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/ai/execute" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    $isStub = $response.output -match "\[STUB\]"
    $hasTokens = $response.tokensUsed -gt 0
    $hasModel = $response.model -and $response.model -ne "stub-model"
    
    if (-not $isStub -and $hasTokens -and $hasModel) {
        Write-TestResult "AI execution" $true "Provider: $($response.model), Tokens: $($response.tokensUsed)"
        Write-Host "  Output: $($response.output.Substring(0, [Math]::Min(80, $response.output.Length)))..."
    } else {
        if ($isStub) {
            Write-TestResult "AI execution" $false "Stub provider active (AI_PROVIDER not configured)"
        } else {
            Write-TestResult "AI execution" $false "Invalid response (tokens: $($response.tokensUsed), model: $($response.model))"
        }
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-TestResult "AI execution" $false "Authentication failed (401) - Check API key"
    } elseif ($statusCode -eq 403) {
        Write-TestResult "AI execution" $false "Authorization failed (403) - Check launch state or abort mode"
    } elseif ($statusCode -eq 429) {
        Write-TestResult "AI execution" $false "Quota exceeded (429)"
    } elseif ($statusCode -eq 503) {
        Write-TestResult "AI execution" $false "Service unavailable (503) - Check ai-service and provider API key"
    } else {
        Write-TestResult "AI execution" $false $_.Exception.Message
    }
}

# Test 6: Billing Visibility - Snapshots
Write-TestHeader "Test 6: Billing Visibility — List Snapshots"
try {
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/billing/snapshots" -Method Get -Headers $headers -ErrorAction Stop
    
    if ($response.PSObject.Properties.Name -contains "snapshots") {
        $snapshotCount = $response.snapshots.Count
        Write-TestResult "Billing snapshots" $true "Retrieved $snapshotCount snapshot(s)"
        
        if ($snapshotCount -gt 0) {
            $latest = $response.snapshots[0]
            Write-Host "  Latest: Period $($latest.periodStart) to $($latest.periodEnd), Cost: $($latest.totalCost)"
        }
    } else {
        Write-TestResult "Billing snapshots" $false "Invalid response structure"
    }
} catch {
    Write-TestResult "Billing snapshots" $false $_.Exception.Message
}

# Test 7: Billing Visibility - Summary
Write-TestHeader "Test 7: Billing Visibility — Time Window Summary"
try {
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
    }
    
    $periodStart = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $periodEnd = (Get-Date).ToString("yyyy-MM-dd")
    
    $uri = "$BaseUrl/api/billing/summary?periodStart=$periodStart&periodEnd=$periodEnd"
    $response = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -ErrorAction Stop
    
    if ($response.PSObject.Properties.Name -contains "totalCost") {
        Write-TestResult "Billing summary" $true "Cost: $($response.totalCost), Tokens: $($response.totalTokens), Snapshots: $($response.snapshotCount)"
    } else {
        Write-TestResult "Billing summary" $false "Invalid response structure"
    }
} catch {
    Write-TestResult "Billing summary" $false $_.Exception.Message
}

# Summary
$EndTime = Get-Date
$Duration = ($EndTime - $StartTime).TotalSeconds

Write-Host "`n${Blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"
Write-Host "${Blue}Smoke Pack Summary${Reset}"
Write-Host "${Blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${Reset}"

Write-Host "`n${Green}Passed:${Reset} $PassCount"
Write-Host "${Red}Failed:${Reset} $FailCount"
Write-Host "Duration: $([Math]::Round($Duration, 2)) seconds"

if ($FailCount -eq 0) {
    Write-Host "`n${Green}✓ All smoke tests passed!${Reset}"
    Write-Host "${Green}✓ System is ready for deployment.${Reset}`n"
    exit 0
} else {
    Write-Host "`n${Red}✗ Some smoke tests failed.${Reset}"
    Write-Host "${Red}✗ Review failures before deployment.${Reset}`n"
    exit 1
}
