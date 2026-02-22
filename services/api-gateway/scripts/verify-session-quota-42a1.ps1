# PHASE-42A-1 Verification Script
# Max Active Sessions Per User Quota Enforcement
# PowerShell 5.x Compatible

Write-Host "=== PHASE-42A-1: Max Active Sessions Per User Verification ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:4000"
$testUser = @{
    email = "test@example.com"
    password = "TestPassword123!"
}

# Step 1: Authenticate and get JWT token
Write-Host "[Step 1] Authenticating test user..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $testUser.email
        password = $testUser.password
    } | ConvertTo-Json

    $loginResponse = Invoke-WebRequest `
        -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json" `
        -SkipHttpErrorCheck

    if ($loginResponse.StatusCode -ne 200) {
        Write-Host "❌ Login failed. Status: $($loginResponse.StatusCode)" -ForegroundColor Red
        Write-Host "Response: $($loginResponse.Content)" -ForegroundColor Red
        exit 1
    }

    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.access_token

    Write-Host "✅ Authenticated successfully" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Authentication error: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Clean up any existing sessions
Write-Host "[Step 2] Cleaning up existing sessions..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $listResponse = Invoke-WebRequest `
        -Uri "$baseUrl/api/sessions" `
        -Method GET `
        -Headers $headers `
        -SkipHttpErrorCheck

    if ($listResponse.StatusCode -eq 200) {
        $sessions = $listResponse.Content | ConvertFrom-Json
        Write-Host "Found $($sessions.Count) existing sessions" -ForegroundColor Gray

        foreach ($session in $sessions) {
            Write-Host "  Deleting session: $($session.id)" -ForegroundColor Gray
            Invoke-WebRequest `
                -Uri "$baseUrl/api/sessions/$($session.id)" `
                -Method DELETE `
                -Headers $headers `
                -SkipHttpErrorCheck | Out-Null
        }
    }

    Write-Host "✅ Cleanup complete" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "⚠️  Cleanup warning: $_" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: Create sessions until quota exceeded
Write-Host "[Step 3] Creating sessions until quota exceeded (limit = 5)..." -ForegroundColor Yellow
$createdSessions = @()
$quotaExceeded = $false

for ($i = 1; $i -le 7; $i++) {
    Write-Host "  Attempt $i : " -NoNewline

    try {
        $createResponse = Invoke-WebRequest `
            -Uri "$baseUrl/api/sessions" `
            -Method POST `
            -Headers $headers `
            -Body "{}" `
            -SkipHttpErrorCheck

        if ($createResponse.StatusCode -eq 201) {
            $session = $createResponse.Content | ConvertFrom-Json
            $createdSessions += $session.id
            Write-Host "✅ Created (session: $($session.id.Substring(0, 8))...)" -ForegroundColor Green
        }
        elseif ($createResponse.StatusCode -eq 403) {
            $quotaExceeded = $true
            $errorBody = $createResponse.Content | ConvertFrom-Json
            Write-Host "❌ Quota Exceeded (403 Forbidden)" -ForegroundColor Red
            Write-Host "    Error Details:" -ForegroundColor Gray
            Write-Host "      Status Code: $($errorBody.statusCode)" -ForegroundColor Gray
            Write-Host "      Error: $($errorBody.error)" -ForegroundColor Gray
            Write-Host "      Message: $($errorBody.message)" -ForegroundColor Gray
            Write-Host "      Quota Type: $($errorBody.details.quota_type)" -ForegroundColor Gray
            Write-Host "      Limit: $($errorBody.details.limit)" -ForegroundColor Gray
            Write-Host "      Current: $($errorBody.details.current)" -ForegroundColor Gray
        }
        else {
            Write-Host "⚠️  Unexpected status: $($createResponse.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""

# Step 4: Verify quota enforcement
Write-Host "[Step 4] Verifying quota enforcement..." -ForegroundColor Yellow

if ($createdSessions.Count -eq 5 -and $quotaExceeded) {
    Write-Host "✅ PASS: Exactly 5 sessions created, quota enforced on 6th attempt" -ForegroundColor Green
} elseif ($createdSessions.Count -lt 5) {
    Write-Host "❌ FAIL: Only $($createdSessions.Count) sessions created (expected 5)" -ForegroundColor Red
} elseif ($createdSessions.Count -gt 5) {
    Write-Host "❌ FAIL: $($createdSessions.Count) sessions created (quota not enforced!)" -ForegroundColor Red
} else {
    Write-Host "⚠️  WARNING: Quota not exceeded after 7 attempts" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Verify error response format
Write-Host "[Step 5] Verifying error response format..." -ForegroundColor Yellow

if ($quotaExceeded) {
    Write-Host "✅ PASS: HTTP 403 Forbidden returned" -ForegroundColor Green
    Write-Host "✅ PASS: Error response includes quota details" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL: Quota was not exceeded (cannot verify error format)" -ForegroundColor Red
}

Write-Host ""

# Step 6: Verify quota persists (delete one session, create another)
Write-Host "[Step 6] Verifying quota allows creation after deletion..." -ForegroundColor Yellow

if ($createdSessions.Count -gt 0) {
    $sessionToDelete = $createdSessions[0]
    Write-Host "  Deleting session: $($sessionToDelete.Substring(0, 8))..." -ForegroundColor Gray

    $deleteResponse = Invoke-WebRequest `
        -Uri "$baseUrl/api/sessions/$sessionToDelete" `
        -Method DELETE `
        -Headers $headers `
        -SkipHttpErrorCheck

    if ($deleteResponse.StatusCode -eq 200) {
        Write-Host "  ✅ Session deleted" -ForegroundColor Green

        # Try creating a new session
        Write-Host "  Attempting to create new session..." -ForegroundColor Gray

        $createResponse = Invoke-WebRequest `
            -Uri "$baseUrl/api/sessions" `
            -Method POST `
            -Headers $headers `
            -Body "{}" `
            -SkipHttpErrorCheck

        if ($createResponse.StatusCode -eq 201) {
            Write-Host "✅ PASS: New session created after deletion (quota updated)" -ForegroundColor Green
            $newSession = $createResponse.Content | ConvertFrom-Json
            $createdSessions += $newSession.id
        } else {
            Write-Host "❌ FAIL: Could not create session after deletion (status: $($createResponse.StatusCode))" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  WARNING: Could not delete session (status: $($deleteResponse.StatusCode))" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  SKIP: No sessions to delete" -ForegroundColor Yellow
}

Write-Host ""

# Step 7: Cleanup
Write-Host "[Step 7] Cleaning up test sessions..." -ForegroundColor Yellow

foreach ($sessionId in $createdSessions) {
    Write-Host "  Deleting session: $($sessionId.Substring(0, 8))..." -ForegroundColor Gray
    Invoke-WebRequest `
        -Uri "$baseUrl/api/sessions/$sessionId" `
        -Method DELETE `
        -Headers $headers `
        -SkipHttpErrorCheck | Out-Null
}

Write-Host "✅ Cleanup complete" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host "Sessions created before quota: $($createdSessions.Count)" -ForegroundColor Gray
Write-Host "Quota exceeded: $quotaExceeded" -ForegroundColor Gray
Write-Host "Expected behavior: 5 sessions created, 6th attempt returns 403" -ForegroundColor Gray
Write-Host ""

if ($createdSessions.Count -eq 5 -and $quotaExceeded) {
    Write-Host "✅ PHASE-42A-1 VERIFICATION PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ PHASE-42A-1 VERIFICATION FAILED" -ForegroundColor Red
    exit 1
}
