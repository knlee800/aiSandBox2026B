param(
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string]$FrontendBaseUrl = "http://localhost:3002",
    [string]$Email = "",
    [string]$Password = "phase76c-validation-password-123",
    [string]$InternalServiceKey = $env:INTERNAL_SERVICE_KEY
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Message) Write-Host "🔷 $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Failure { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }

if ([string]::IsNullOrWhiteSpace($Email)) {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $Email = "phase76c-$timestamp@example.com"
}

Write-Host ""
Write-Host "PHASE-76C Validation Environment Readiness Check" -ForegroundColor Yellow
Write-Host "API: $ApiBaseUrl"
Write-Host "Frontend: $FrontendBaseUrl"
Write-Host "User: $Email"
Write-Host ""

Write-Step "1) Verify frontend reachability at /en/ and /en/app"
try {
    $null = Invoke-WebRequest -Uri "$FrontendBaseUrl/en/" -Method Get -MaximumRedirection 0 -ErrorAction Stop
} catch {
    if (-not $_.Exception.Response) {
        Write-Failure "Frontend route /en/ is not reachable at $FrontendBaseUrl"
        throw
    }
}
try {
    $null = Invoke-WebRequest -Uri "$FrontendBaseUrl/en/app" -Method Get -MaximumRedirection 0 -ErrorAction Stop
} catch {
    if (-not $_.Exception.Response) {
        Write-Failure "Frontend route /en/app is not reachable at $FrontendBaseUrl"
        throw
    }
}
Write-Success "Frontend is reachable at expected validation port"

Write-Step "2) Create/confirm a test user and obtain JWT"
$authBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/register" -Method Post -ContentType "application/json" -Body $authBody
} catch {
    # User may already exist; continue to login.
}

$loginResp = Invoke-RestMethod -Uri "$ApiBaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $authBody
$jwt = $loginResp.access_token
if ([string]::IsNullOrWhiteSpace($jwt)) {
    Write-Failure "JWT token was not returned by /api/auth/login"
    exit 1
}
Write-Success "JWT acquired successfully"

Write-Step "3) Verify authenticated endpoint positive-path (GET /api/sessions)"
$authHeaders = @{ Authorization = "Bearer $jwt" }
$sessionsResp = Invoke-RestMethod -Uri "$ApiBaseUrl/api/sessions" -Method Get -Headers $authHeaders
if ($null -eq $sessionsResp) {
    Write-Failure "Authenticated call returned no response body"
    exit 1
}
Write-Success "Authenticated API path succeeded"

Write-Step "4) Verify internal endpoint positive-path (GET /api/internal/admin/users)"
if ([string]::IsNullOrWhiteSpace($InternalServiceKey)) {
    Write-Failure "INTERNAL_SERVICE_KEY is not set. Set it in your shell or pass -InternalServiceKey."
    exit 1
}
$internalHeaders = @{ "X-Internal-Service-Key" = $InternalServiceKey }
$adminResp = Invoke-RestMethod -Uri "$ApiBaseUrl/api/internal/admin/users" -Method Get -Headers $internalHeaders
if ($null -eq $adminResp) {
    Write-Failure "Internal admin call returned no response body"
    exit 1
}
Write-Success "Internal admin API path succeeded"

Write-Host ""
Write-Success "PHASE-76C readiness checks passed."
Write-Host "JWT available for validation session (masked): $($jwt.Substring(0, [Math]::Min(16, $jwt.Length)))..."
Write-Host "Internal key source: parameter or INTERNAL_SERVICE_KEY environment variable"
Write-Host ""
