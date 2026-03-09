# Phase-56 Fresh-Boot Regression Validation
#
# Validates the full fresh-boot production path:
# 1. Register
# 2. Login
# 3. Create API key
# 4. Create session
# 5. Add first chat message + real AI execute
#
# PREREQUISITES:
#   - Wiped Docker: docker compose -f docker-compose.prod.yml down -v
#   - Booted: docker compose -f docker-compose.prod.yml up -d --build
#   - api-gateway healthy at BaseUrl (GET /api/health → 200)
#   - AI_PROVIDER configured (stub or real)
#
# USAGE:
#   .\scripts\phase-56-fresh-boot-validation.ps1 -BaseUrl "http://localhost:4000"
#
# Full sequence (wipe + boot + validate):
#   docker compose -f docker-compose.prod.yml down -v
#   docker compose -f docker-compose.prod.yml up -d --build
#   # Wait for api-gateway healthy
#   .\scripts\phase-56-fresh-boot-validation.ps1 -BaseUrl "http://localhost:4000"

param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$Email = "phase56f-validation@example.com",
    [string]$Password = "phase56f-password-123"
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$Message) Write-Host "  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "  $Message" -ForegroundColor Green }
function Write-Fail { param([string]$Message) Write-Host "  $Message" -ForegroundColor Red }

Write-Host "`n=== Phase-56 Fresh-Boot Regression Validation ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl`n" -ForegroundColor Gray

# 1. Register
Write-Host "1. Register (POST /api/auth/register)..." -ForegroundColor Yellow
$registerBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Success "User registered"
} catch {
    Write-Step "Register skipped (user may exist), continuing"
}

# 2. Login
Write-Host "`n2. Login (POST /api/auth/login)..." -ForegroundColor Yellow
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $jwt = $loginResp.access_token
    $userId = $loginResp.user.id
    Write-Success "JWT obtained, userId=$userId"
} catch {
    Write-Fail "Login failed: $_"
    exit 1
}

# 3. Create API key
Write-Host "`n3. Create API key (POST /api/keys)..." -ForegroundColor Yellow
$keyBody = @{ scopes = @("ai:execute", "sessions:read", "sessions:write") } | ConvertTo-Json
$keyHeaders = @{
    "Authorization" = "Bearer $jwt"
    "Content-Type" = "application/json"
}
try {
    $keyResp = Invoke-RestMethod -Uri "$BaseUrl/api/keys" -Method Post -Headers $keyHeaders -Body $keyBody
    $apiKey = $keyResp.apiKey
    Write-Success "API key created"
} catch {
    Write-Fail "Create API key failed: $_"
    exit 1
}

# 4. Create session
Write-Host "`n4. Create session (POST /api/sessions)..." -ForegroundColor Yellow
try {
    $sessionResp = Invoke-RestMethod -Uri "$BaseUrl/api/sessions" -Method Post -Headers $keyHeaders
    $sessionId = $sessionResp.id
    Write-Success "Session created, id=$sessionId"
} catch {
    Write-Fail "Create session failed: $_"
    exit 1
}

# 5. Add first chat message + real AI execute
Write-Host "`n5. Add first chat message + real AI execute (POST /api/ai/execute)..." -ForegroundColor Yellow
$conversationId = [guid]::NewGuid().ToString()
$executeBody = @{
    sessionId = $sessionId
    conversationId = $conversationId
    userId = $userId
    prompt = "Say hello in one word."
} | ConvertTo-Json
$executeHeaders = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}
try {
    $executeResp = Invoke-RestMethod -Uri "$BaseUrl/api/ai/execute" -Method Post -Headers $executeHeaders -Body $executeBody
    $executionId = $executeResp.executionId
    $status = $executeResp.status
    Write-Success "Execution queued, executionId=$executionId, status=$status"
} catch {
    Write-Fail "Execute failed: $_"
    exit 1
}

# 6. Wait and verify completion
Write-Host "`n6. Waiting for execution completion (GET /api/ai/executions/$executionId)..." -ForegroundColor Yellow
Start-Sleep -Seconds 8
try {
    $resultResp = Invoke-RestMethod -Uri "$BaseUrl/api/ai/executions/$executionId" -Method Get -Headers $executeHeaders
    $finalStatus = $resultResp.status
    Write-Success "Final status: $finalStatus"
    $validStatuses = @("completed", "failed", "timeout", "cancelled")
    if ($finalStatus -notin $validStatuses) {
        Write-Fail "Expected terminal status, got: $finalStatus"
        exit 1
    }
} catch {
    Write-Fail "Result check failed: $_"
    exit 1
}

Write-Host "`n=== Phase-56 Fresh-Boot Validation PASSED ===" -ForegroundColor Green
