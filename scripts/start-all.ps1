#!/usr/bin/env pwsh
<#
.SYNOPSIS
    AI Sandbox Platform - Single-Command Startup Orchestration
.DESCRIPTION
    Phase 35B-2: Startup Orchestration
    
    Starts all required services in the correct order:
    1. PostgreSQL (via Docker)
    2. API Gateway
    3. AI Service
    4. Frontend
    
    Performs readiness checks before declaring success.
.NOTES
    Scope: FRONTEND + LOCAL DEV TOOLING ONLY
    No backend code changes, no new API endpoints
#>

param(
    [int]$HealthCheckTimeout = 30,
    [int]$HealthCheckInterval = 2
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Step {
    param([string]$Message)
    Write-Host "🔷 $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Failure {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Yellow
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host " $Message" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host ""
}

# Check if a command exists
function Test-Command {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# Wait for health endpoint to be ready
function Wait-ForHealthEndpoint {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$Timeout = 30,
        [int]$Interval = 2
    )
    
    $elapsed = 0
    Write-Step "Waiting for $ServiceName to be ready..."
    
    while ($elapsed -lt $Timeout) {
        try {
            $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($response.status -eq "ok" -or $response.status -eq "ready") {
                Write-Success "$ServiceName is ready!"
                return $true
            }
        }
        catch {
            # Service not ready yet, continue waiting
        }
        
        Start-Sleep -Seconds $Interval
        $elapsed += $Interval
        Write-Host "." -NoNewline
    }
    
    Write-Host ""
    Write-Failure "$ServiceName did not become ready within $Timeout seconds"
    return $false
}

# Check if PostgreSQL is running
function Test-PostgreSQL {
    try {
        $result = docker ps --filter "name=aisandbox-postgres" --filter "status=running" --format "{{.Names}}"
        return $result -eq "aisandbox-postgres"
    }
    catch {
        return $false
    }
}

# Check if a port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Main orchestration
Write-Header "AI Sandbox Platform - Startup Orchestration"
Write-Info "Phase 35B-2: Single-Command Startup"
Write-Info "Health Check Timeout: $HealthCheckTimeout seconds"
Write-Host ""

# Step 0: Prerequisites check
Write-Step "Checking prerequisites..."

if (-not (Test-Command "docker")) {
    Write-Failure "Docker is not installed or not in PATH"
    Write-Info "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
}

if (-not (Test-Command "node")) {
    Write-Failure "Node.js is not installed or not in PATH"
    Write-Info "Install Node.js: https://nodejs.org/"
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-Failure "npm is not installed or not in PATH"
    Write-Info "npm should be included with Node.js"
    exit 1
}

Write-Success "All prerequisites are installed"

# Step 1: Start PostgreSQL
Write-Header "Step 1: Starting PostgreSQL"

if (Test-PostgreSQL) {
    Write-Success "PostgreSQL is already running"
}
else {
    Write-Step "Starting PostgreSQL container..."
    try {
        docker-compose up -d postgres
        if ($LASTEXITCODE -ne 0) {
            throw "docker-compose failed with exit code $LASTEXITCODE"
        }
        
        Write-Step "Waiting for PostgreSQL to be ready..."
        Start-Sleep -Seconds 5
        
        # Wait for PostgreSQL health check
        $maxWait = 30
        $waited = 0
        while ($waited -lt $maxWait) {
            $health = docker inspect --format='{{.State.Health.Status}}' aisandbox-postgres 2>$null
            if ($health -eq "healthy") {
                Write-Success "PostgreSQL is healthy"
                break
            }
            Start-Sleep -Seconds 2
            $waited += 2
            Write-Host "." -NoNewline
        }
        Write-Host ""
        
        if ($waited -ge $maxWait) {
            Write-Failure "PostgreSQL did not become healthy within $maxWait seconds"
            Write-Info "Check logs: docker logs aisandbox-postgres"
            exit 1
        }
    }
    catch {
        Write-Failure "Failed to start PostgreSQL: $_"
        Write-Info "Remediation:"
        Write-Info "  1. Check Docker is running: docker ps"
        Write-Info "  2. Check docker-compose.yml exists"
        Write-Info "  3. Check logs: docker logs aisandbox-postgres"
        exit 1
    }
}

# Step 2: Start API Gateway
Write-Header "Step 2: Starting API Gateway"

if (Test-Port 4000) {
    Write-Info "Port 4000 is already in use (API Gateway may already be running)"
}
else {
    Write-Step "Starting API Gateway..."
    
    # Check if api-gateway directory exists
    if (-not (Test-Path "services/api-gateway")) {
        Write-Failure "services/api-gateway directory not found"
        exit 1
    }
    
    # Start API Gateway in background
    try {
        $apiGatewayProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "services/api-gateway" -PassThru -WindowStyle Hidden
        Write-Info "API Gateway process started (PID: $($apiGatewayProcess.Id))"
        
        # Wait for API Gateway to be ready
        if (-not (Wait-ForHealthEndpoint -Url "http://localhost:4000/api/health" -ServiceName "API Gateway" -Timeout $HealthCheckTimeout -Interval $HealthCheckInterval)) {
            Write-Failure "API Gateway failed to start"
            Write-Info "Remediation:"
            Write-Info "  1. Check if port 4000 is available"
            Write-Info "  2. Check services/api-gateway/.env file exists"
            Write-Info "  3. Run manually: cd services/api-gateway && npm run dev"
            Stop-Process -Id $apiGatewayProcess.Id -Force -ErrorAction SilentlyContinue
            exit 1
        }
    }
    catch {
        Write-Failure "Failed to start API Gateway: $_"
        exit 1
    }
}

# Step 3: Check API Gateway readiness (full check)
Write-Header "Step 3: Verifying API Gateway Readiness"

Write-Step "Checking /api/health/ready endpoint..."
try {
    $readyResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/health/ready" -Method Get -TimeoutSec 5 -ErrorAction Stop
    
    if ($readyResponse.status -eq "ready") {
        Write-Success "API Gateway is fully ready"
        Write-Info "  Environment: $($readyResponse.checks.environment)"
        Write-Info "  Database: $($readyResponse.checks.database)"
        Write-Info "  Kill Switches: $($readyResponse.checks.killSwitches)"
        Write-Info "  Safety Limits: $($readyResponse.checks.safetyLimits)"
    }
    else {
        Write-Failure "API Gateway is not ready: $($readyResponse.status)"
        if ($readyResponse.error) {
            Write-Info "Error: $($readyResponse.error)"
        }
        Write-Info "Remediation:"
        Write-Info "  1. Check database connection"
        Write-Info "  2. Check environment variables in services/api-gateway/.env"
        Write-Info "  3. Check logs in API Gateway terminal"
        exit 1
    }
}
catch {
    Write-Failure "Failed to verify API Gateway readiness: $_"
    Write-Info "Remediation:"
    Write-Info "  1. Check if API Gateway is running: curl http://localhost:4000/api/health"
    Write-Info "  2. Check database is accessible"
    Write-Info "  3. Review API Gateway logs"
    exit 1
}

# Step 4: Start AI Service
Write-Header "Step 4: Starting AI Service"

if (Test-Port 4001) {
    Write-Info "Port 4001 is already in use (AI Service may already be running)"
}
else {
    Write-Step "Starting AI Service..."
    
    # Check if ai-service directory exists
    if (-not (Test-Path "services/ai-service")) {
        Write-Failure "services/ai-service directory not found"
        exit 1
    }
    
    # Start AI Service in background
    try {
        $aiServiceProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "services/ai-service" -PassThru -WindowStyle Hidden
        Write-Info "AI Service process started (PID: $($aiServiceProcess.Id))"
        
        # Wait for AI Service to be ready
        if (-not (Wait-ForHealthEndpoint -Url "http://localhost:4001/health" -ServiceName "AI Service" -Timeout $HealthCheckTimeout -Interval $HealthCheckInterval)) {
            Write-Failure "AI Service failed to start"
            Write-Info "Remediation:"
            Write-Info "  1. Check if port 4001 is available"
            Write-Info "  2. Check services/ai-service/.env file exists"
            Write-Info "  3. Check AI provider API keys are configured"
            Write-Info "  4. Run manually: cd services/ai-service && npm run dev"
            Stop-Process -Id $aiServiceProcess.Id -Force -ErrorAction SilentlyContinue
            exit 1
        }
    }
    catch {
        Write-Failure "Failed to start AI Service: $_"
        exit 1
    }
}

# Step 5: Start Frontend
Write-Header "Step 5: Starting Frontend"

if (Test-Port 3000) {
    Write-Info "Port 3000 is already in use (Frontend may already be running)"
    Write-Success "All services are running!"
}
else {
    Write-Step "Starting Frontend..."
    
    # Check if frontend directory exists
    if (-not (Test-Path "frontend")) {
        Write-Failure "frontend directory not found"
        exit 1
    }
    
    # Start Frontend in background
    try {
        $frontendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "frontend" -PassThru -WindowStyle Hidden
        Write-Info "Frontend process started (PID: $($frontendProcess.Id))"
        
        # Wait for Frontend to be ready
        Start-Sleep -Seconds 5
        
        if (Test-Port 3000) {
            Write-Success "Frontend is ready!"
        }
        else {
            Write-Failure "Frontend failed to start"
            Write-Info "Remediation:"
            Write-Info "  1. Check if port 3000 is available"
            Write-Info "  2. Run manually: cd frontend && npm run dev"
            Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
            exit 1
        }
    }
    catch {
        Write-Failure "Failed to start Frontend: $_"
        exit 1
    }
}

# Final success message
Write-Header "🎉 Startup Complete!"

Write-Success "All services are running:"
Write-Host ""
Write-Host "  🗄️  PostgreSQL:   " -NoNewline -ForegroundColor White
Write-Host "localhost:5432" -ForegroundColor Cyan
Write-Host "  🌐 API Gateway:  " -NoNewline -ForegroundColor White
Write-Host "http://localhost:4000" -ForegroundColor Cyan
Write-Host "  🤖 AI Service:   " -NoNewline -ForegroundColor White
Write-Host "http://localhost:4001" -ForegroundColor Cyan
Write-Host "  💻 Frontend:     " -NoNewline -ForegroundColor White
Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Info "Open your browser to http://localhost:3000 to start using the platform"
Write-Info "Press Ctrl+C in each terminal to stop services"
Write-Host ""
