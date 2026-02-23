# PHASE-42A-3: Create Test API Key
# PowerShell 5.x compatible
#
# Creates a deterministic test API key for token quota verification

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PHASE-42A-3: Test API Key Creation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "scripts/create-test-api-key.ts")) {
    Write-Host "Error: Must run from services/api-gateway directory" -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  cd services/api-gateway" -ForegroundColor Yellow
    Write-Host "  .\scripts\create-test-api-key.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Error: node_modules not found" -ForegroundColor Red
    Write-Host "Please run: npm install" -ForegroundColor Yellow
    exit 1
}

# Run the TypeScript script
Write-Host "Creating test API key..." -ForegroundColor Yellow
Write-Host ""

try {
    npx ts-node scripts/create-test-api-key.ts
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Error: Failed to create API key" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
