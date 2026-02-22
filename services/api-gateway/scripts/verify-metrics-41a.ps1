# PHASE-41A: Runtime Metrics Verification Script
# PowerShell 5.x compatible
# Verifies /api/runtime/metrics endpoint returns deterministic JSON

Write-Host "PHASE-41A: Runtime Metrics Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_GATEWAY_URL = if ($env:API_GATEWAY_URL) { $env:API_GATEWAY_URL } else { "http://localhost:4000" }
$METRICS_ENDPOINT = "$API_GATEWAY_URL/api/runtime/metrics"

Write-Host "Target: $METRICS_ENDPOINT" -ForegroundColor Yellow
Write-Host ""

# Test 1: Endpoint is reachable
Write-Host "[Test 1] Endpoint reachability..." -ForegroundColor White
try {
    $response = Invoke-RestMethod -Uri $METRICS_ENDPOINT -Method Get -ErrorAction Stop
    Write-Host "✓ Endpoint is reachable" -ForegroundColor Green
} catch {
    Write-Host "✗ Endpoint is not reachable: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Response structure validation
Write-Host "[Test 2] Response structure validation..." -ForegroundColor White

$requiredFields = @(
    "activeSessionCount",
    "runningContainerCount",
    "terminatedSessionCount",
    "terminationReasons",
    "serviceUptimeSeconds",
    "dockerConnectivity",
    "databaseConnectivity",
    "timestamp"
)

$allFieldsPresent = $true
foreach ($field in $requiredFields) {
    if ($null -eq $response.$field) {
        Write-Host "✗ Missing required field: $field" -ForegroundColor Red
        $allFieldsPresent = $false
    }
}

if ($allFieldsPresent) {
    Write-Host "✓ All required fields present" -ForegroundColor Green
} else {
    exit 1
}

Write-Host ""

# Test 3: Data type validation
Write-Host "[Test 3] Data type validation..." -ForegroundColor White

$typeErrors = @()

if ($response.activeSessionCount -isnot [int] -and $response.activeSessionCount -isnot [long]) {
    $typeErrors += "activeSessionCount must be a number"
}

if ($response.runningContainerCount -isnot [int] -and $response.runningContainerCount -isnot [long]) {
    $typeErrors += "runningContainerCount must be a number"
}

if ($response.terminatedSessionCount -isnot [int] -and $response.terminatedSessionCount -isnot [long]) {
    $typeErrors += "terminatedSessionCount must be a number"
}

if ($response.terminationReasons -isnot [array]) {
    $typeErrors += "terminationReasons must be an array"
}

if ($response.serviceUptimeSeconds -isnot [int] -and $response.serviceUptimeSeconds -isnot [long]) {
    $typeErrors += "serviceUptimeSeconds must be a number"
}

if ($response.dockerConnectivity -isnot [bool]) {
    $typeErrors += "dockerConnectivity must be a boolean"
}

if ($response.databaseConnectivity -isnot [bool]) {
    $typeErrors += "databaseConnectivity must be a boolean"
}

if ($response.timestamp -isnot [string]) {
    $typeErrors += "timestamp must be a string"
}

if ($typeErrors.Count -gt 0) {
    foreach ($error in $typeErrors) {
        Write-Host "✗ $error" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "✓ All data types are correct" -ForegroundColor Green
}

Write-Host ""

# Test 4: Display metrics
Write-Host "[Test 4] Current metrics:" -ForegroundColor White
Write-Host "  Active Sessions: $($response.activeSessionCount)" -ForegroundColor Cyan
Write-Host "  Running Containers: $($response.runningContainerCount)" -ForegroundColor Cyan
Write-Host "  Terminated Sessions: $($response.terminatedSessionCount)" -ForegroundColor Cyan
Write-Host "  Termination Reasons: $($response.terminationReasons.Count) unique" -ForegroundColor Cyan
Write-Host "  Service Uptime: $($response.serviceUptimeSeconds)s" -ForegroundColor Cyan
Write-Host "  Docker Connectivity: $($response.dockerConnectivity)" -ForegroundColor Cyan
Write-Host "  Database Connectivity: $($response.databaseConnectivity)" -ForegroundColor Cyan
Write-Host "  Timestamp: $($response.timestamp)" -ForegroundColor Cyan

Write-Host ""

# Test 5: Termination reasons structure
Write-Host "[Test 5] Termination reasons structure..." -ForegroundColor White
if ($response.terminationReasons.Count -gt 0) {
    $validStructure = $true
    foreach ($reason in $response.terminationReasons) {
        if ($null -eq $reason.reason -or $null -eq $reason.count) {
            Write-Host "✗ Invalid termination reason structure" -ForegroundColor Red
            $validStructure = $false
            break
        }
    }
    if ($validStructure) {
        Write-Host "✓ Termination reasons structure is valid" -ForegroundColor Green
        foreach ($reason in $response.terminationReasons) {
            Write-Host "    - $($reason.reason): $($reason.count)" -ForegroundColor Gray
        }
    } else {
        exit 1
    }
} else {
    Write-Host "✓ No terminated sessions (empty array is valid)" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All tests passed!" -ForegroundColor Green
Write-Host ""
