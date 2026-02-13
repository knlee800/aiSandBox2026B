#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Phase 36A: Run Schema Alignment Migration
.DESCRIPTION
    Runs the AlignUsersSchema migration to add missing columns to users table.
    
    Prerequisites:
    - PostgreSQL must be running (docker-compose up -d postgres)
    - DATABASE_URL must be set
    
.EXAMPLE
    .\scripts\run-migration-36a.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host " Phase 36A: Schema Alignment Migration" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set DATABASE_URL environment variable:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aisandbox_dev"' -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green
Write-Host "   $env:DATABASE_URL" -ForegroundColor Gray
Write-Host ""

# Check if PostgreSQL is accessible
Write-Host "🔍 Checking PostgreSQL connection..." -ForegroundColor Cyan
try {
    # Try to connect using node pg module
    $testScript = @"
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
    .then(() => { console.log('OK'); client.end(); process.exit(0); })
    .catch(err => { console.error(err.message); process.exit(1); });
"@
    
    $result = $testScript | node -e "eval(require('fs').readFileSync(0, 'utf-8'))" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connection failed: $result"
    }
    Write-Host "✅ PostgreSQL is accessible" -ForegroundColor Green
}
catch {
    Write-Host "❌ Cannot connect to PostgreSQL" -ForegroundColor Red
    Write-Host "   $_" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Start PostgreSQL:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d postgres" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""

# Run migration
Write-Host "🚀 Running migration..." -ForegroundColor Cyan
Write-Host ""

try {
    npm run migration:run
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed with exit code $LASTEXITCODE"
    }
    Write-Host ""
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host " Migration Complete" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the API Gateway: npm run dev" -ForegroundColor Cyan
Write-Host "  2. Test login: POST /api/auth/login" -ForegroundColor Cyan
Write-Host ""
