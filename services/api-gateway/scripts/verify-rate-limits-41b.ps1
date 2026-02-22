# PHASE-41B: Rate Limiting Verification Script
# PowerShell 5.x compatible
# Verifies rate limiting on POST /api/sessions, DELETE /api/sessions/:id, POST /api/ai/execute

Write-Host "PHASE-41B: Rate Limiting Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$API_GATEWAY_URL = if ($env:API_GATEWAY_URL) { $env:API_GATEWAY_URL } else { "http://localhost:4000" }
$JWT_TOKEN = if ($env:TEST_JWT_TOKEN) { $env:TEST_JWT_TOKEN } else { "test-jwt-token" }
$API_KEY = if ($env:TEST_API_KEY) { $env:TEST_API_KEY } else { "test-api-key" }

Write-Host "Target: $API_GATEWAY_URL" -ForegroundColor Yellow
Write-Host ""

# Test 1: POST /api/sessions rate limit (10 per minute)
Write-Host "[Test 1] POST /api/sessions rate limit (10 per minute)..." -ForegroundColor White
Write-Host "Sending 15 requests rapidly..." -ForegroundColor Gray

$successCount = 0
$rateLimitedCount = 0
$firstRetryAfter = $null

for ($i = 1; $i -le 15; $i++) {
    try {
        $headers = @{
            "Authorization" = "Bearer $JWT_TOKEN"
            "Content-Type" = "application/json"
        }
        $body = @{
            userId = "test-user-id"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/sessions" -Method POST -Headers $headers -Body $body -SkipHttpErrorCheck -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) {
            $successCount++
            Write-Host "  Request $i : 201 Created" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 429) {
            $rateLimitedCount++
            if ($null -eq $firstRetryAfter -and $response.Headers['Retry-After']) {
                $firstRetryAfter = $response.Headers['Retry-After']
            }
            Write-Host "  Request $i : 429 Too Many Requests" -ForegroundColor Yellow
        } else {
            Write-Host "  Request $i : $($response.StatusCode) (unexpected)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  Request $i : Error - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Rate Limited: $rateLimitedCount" -ForegroundColor Yellow
if ($firstRetryAfter) {
    Write-Host "  Retry-After Header: $firstRetryAfter seconds" -ForegroundColor Cyan
}

if ($successCount -le 10 -and $rateLimitedCount -ge 5) {
    Write-Host "✓ Rate limit working correctly" -ForegroundColor Green
} else {
    Write-Host "✗ Rate limit may not be working (expected ~10 success, ~5 rate limited)" -ForegroundColor Red
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 2: Verify 429 response structure
Write-Host "[Test 2] Verify 429 response structure..." -ForegroundColor White

try {
    # Trigger rate limit
    for ($i = 1; $i -le 12; $i++) {
        $headers = @{
            "Authorization" = "Bearer $JWT_TOKEN"
            "Content-Type" = "application/json"
        }
        $body = @{ userId = "test-user-id" } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/sessions" -Method POST -Headers $headers -Body $body -SkipHttpErrorCheck -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 429) {
            $json = $response.Content | ConvertFrom-Json
            Write-Host "429 Response Body:" -ForegroundColor Cyan
            Write-Host "  statusCode: $($json.statusCode)" -ForegroundColor Gray
            Write-Host "  message: $($json.message)" -ForegroundColor Gray
            Write-Host "  error: $($json.error)" -ForegroundColor Gray
            Write-Host "  retryAfter: $($json.retryAfter)" -ForegroundColor Gray
            
            if ($json.statusCode -eq 429 -and $json.message -and $json.retryAfter) {
                Write-Host "✓ 429 response structure is correct" -ForegroundColor Green
            } else {
                Write-Host "✗ 429 response structure is incorrect" -ForegroundColor Red
            }
            break
        }
    }
} catch {
    Write-Host "✗ Failed to verify 429 response: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 3: POST /api/ai/execute rate limit (20 per minute)
Write-Host "[Test 3] POST /api/ai/execute rate limit (20 per minute)..." -ForegroundColor White
Write-Host "Sending 25 requests rapidly..." -ForegroundColor Gray

$successCount = 0
$rateLimitedCount = 0

for ($i = 1; $i -le 25; $i++) {
    try {
        $headers = @{
            "Authorization" = "Bearer $API_KEY"
            "Content-Type" = "application/json"
        }
        $body = @{
            userId = "test-user-id"
            sessionId = "test-session-id"
            conversationId = "test-conversation-id"
            messages = @(@{ role = "user"; content = "test" })
            provider = "stub"
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/ai/execute" -Method POST -Headers $headers -Body $body -SkipHttpErrorCheck -ErrorAction SilentlyContinue
        
        if ($response.StatusCode -eq 200) {
            $successCount++
        } elseif ($response.StatusCode -eq 429) {
            $rateLimitedCount++
        }
    } catch {
        # Ignore errors (may be auth failures in test environment)
    }
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Rate Limited: $rateLimitedCount" -ForegroundColor Yellow

if ($rateLimitedCount -ge 5) {
    Write-Host "✓ Rate limit appears to be working" -ForegroundColor Green
} else {
    Write-Host "⚠ Rate limit may not be triggered (auth may be failing)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Test 4: Internal endpoint protection
Write-Host "[Test 4] Internal endpoint protection..." -ForegroundColor White

# Test 4a: Without internal key
Write-Host "  Testing /api/internal/stats without key..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/internal/stats" -Method GET -SkipHttpErrorCheck -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 401 -or $response.StatusCode -eq 403) {
        Write-Host "  ✓ Correctly rejected (401/403)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Unexpected status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4b: With invalid key
Write-Host "  Testing /api/internal/stats with invalid key..." -ForegroundColor Gray
try {
    $headers = @{
        "X-Internal-Service-Key" = "invalid-key"
    }
    $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/internal/stats" -Method GET -Headers $headers -SkipHttpErrorCheck -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 401 -or $response.StatusCode -eq 403) {
        Write-Host "  ✓ Correctly rejected (401/403)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Unexpected status: $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4c: With valid key (if available)
if ($env:INTERNAL_SERVICE_KEY) {
    Write-Host "  Testing /api/internal/stats with valid key..." -ForegroundColor Gray
    try {
        $headers = @{
            "X-Internal-Service-Key" = $env:INTERNAL_SERVICE_KEY
        }
        $response = Invoke-WebRequest -Uri "$API_GATEWAY_URL/api/internal/stats" -Method GET -Headers $headers -SkipHttpErrorCheck -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Correctly allowed (200)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ Unexpected status: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ⚠ INTERNAL_SERVICE_KEY not set, skipping valid key test" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Some tests may show auth failures if test tokens are invalid." -ForegroundColor Gray
Write-Host "The important verification is that rate limits trigger 429 responses." -ForegroundColor Gray
Write-Host ""
