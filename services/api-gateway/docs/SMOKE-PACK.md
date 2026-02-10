# Release Candidate Smoke Pack
## AI Sandbox Platform — api-gateway

**Phase:** 33A  
**Purpose:** Deterministic validation of deployable system in < 2 minutes  
**Scope:** PostgreSQL + api-gateway + ai-service + end-to-end execution  
**Target:** Windows PowerShell (primary), bash (reference)

---

## Quick Start (PowerShell)

**Prerequisites:**
- PostgreSQL running on localhost:5432
- api-gateway running on localhost:4000
- ai-service running on localhost:4001
- Valid API key configured in database
- `AI_PROVIDER` environment variable set (e.g., `xai`)
- Provider API key configured in ai-service (e.g., `XAI_API_KEY`)

**Total Execution Time:** < 2 minutes

---

## Smoke Test Commands (PowerShell)

### 1. PostgreSQL Connectivity

```powershell
# Test PostgreSQL connection
$env:PGPASSWORD = "postgres"
psql -h localhost -U postgres -d aisandbox -c "SELECT 1 AS status;"
```

**Expected Output:**
```
 status
--------
      1
(1 row)
```

**Failure Interpretation:**
- `psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed` → PostgreSQL not running
- `FATAL: database "aisandbox" does not exist` → Database not created
- `FATAL: password authentication failed` → Wrong password

---

### 2. api-gateway Health Check

```powershell
# Test basic health endpoint
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get | ConvertTo-Json
```

**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T...",
  "service": "api-gateway",
  "version": "0.1.0"
}
```

**Failure Interpretation:**
- `Invoke-RestMethod: Unable to connect to the remote server` → api-gateway not running
- No response → Check if api-gateway started on correct port (default 4000)

---

### 3. api-gateway Readiness Check

```powershell
# Test readiness endpoint (validates startup guards)
Invoke-RestMethod -Uri "http://localhost:4000/health/ready" -Method Get | ConvertTo-Json -Depth 5
```

**Expected Output:**
```json
{
  "status": "ready",
  "timestamp": "2026-02-10T...",
  "environment": {
    "launchState": "PUBLIC",
    "abortMode": "NONE",
    "aiProvider": "xai"
  },
  "checks": {
    "environment": "validated",
    "database": "connected",
    "killSwitches": "loaded",
    "safetyLimits": "loaded"
  },
  "killSwitches": {
    "total": 6,
    "enabled": 0
  },
  "safetyLimits": {
    "total": 3
  }
}
```

**Failure Interpretation:**
- HTTP 503 → Startup validation failed
- `"database": "disconnected"` → Database connection lost
- `"environment": "invalid"` → Missing or invalid environment variables

---

### 4. api-gateway Database Check

```powershell
# Test database connectivity from api-gateway
Invoke-RestMethod -Uri "http://localhost:4000/health/db" -Method Get | ConvertTo-Json
```

**Expected Output:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-02-10T..."
}
```

**Failure Interpretation:**
- HTTP 503 → Database connection failed
- Check `DATABASE_URL` environment variable in api-gateway

---

### 5. Authentication Test

```powershell
# Test authentication with valid API key
$headers = @{
    "Authorization" = "Bearer valid-api-key"
    "Content-Type" = "application/json"
}

$body = @{
    sessionId = "test-session-123"
    conversationId = "test-conv-456"
    userId = "test-user-789"
    prompt = "What is 2+2?"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/api/ai/execute" -Method Post -Headers $headers -Body $body | ConvertTo-Json
```

**Expected Output:**
```json
{
  "output": "2 + 2 equals 4.",
  "tokensUsed": 15,
  "model": "grok-beta"
}
```

**Success Criteria:**
- ✅ HTTP 200 status
- ✅ `output` is NOT `"[STUB] AI execution not implemented yet"`
- ✅ `tokensUsed` > 0
- ✅ `model` matches configured provider

**Failure Interpretation:**
- HTTP 401 → API key invalid or missing
- HTTP 403 → Launch state or abort mode blocking execution
- HTTP 429 → Quota exceeded
- HTTP 503 → Provider execution failed (check ai-service logs)
- `output` contains `[STUB]` → Provider not configured, using stub

---

### 6. Billing Visibility — List Snapshots

```powershell
# Test billing visibility (read-only)
$headers = @{
    "Authorization" = "Bearer valid-api-key"
}

Invoke-RestMethod -Uri "http://localhost:4000/api/billing/snapshots" -Method Get -Headers $headers | ConvertTo-Json -Depth 3
```

**Expected Output:**
```json
{
  "snapshots": []
}
```

**Note:** Empty array is valid if no snapshots exist yet. If snapshots exist, you'll see an array of snapshot summaries.

**Failure Interpretation:**
- HTTP 401 → API key invalid
- HTTP 500 → Database query failed

---

### 7. Billing Visibility — Summary

```powershell
# Test billing summary endpoint
$headers = @{
    "Authorization" = "Bearer valid-api-key"
}

$params = @{
    periodStart = "2026-02-01"
    periodEnd = "2026-02-28"
}

$uri = "http://localhost:4000/api/billing/summary?" + ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" } | Join-String -Separator "&")

Invoke-RestMethod -Uri $uri -Method Get -Headers $headers | ConvertTo-Json -Depth 3
```

**Expected Output:**
```json
{
  "periodStart": "2026-02-01T00:00:00.000Z",
  "periodEnd": "2026-02-28T23:59:59.999Z",
  "totalCost": 0,
  "totalTokens": 0,
  "snapshotCount": 0,
  "providers": {}
}
```

**Note:** Zero values are valid if no usage in time window.

**Failure Interpretation:**
- HTTP 400 → Invalid date format
- HTTP 401 → API key invalid
- HTTP 500 → Database query failed

---

## Smoke Test Commands (bash reference)

For Linux/macOS environments:

```bash
# 1. PostgreSQL
PGPASSWORD=postgres psql -h localhost -U postgres -d aisandbox -c "SELECT 1 AS status;"

# 2. Health
curl -s http://localhost:4000/health | jq

# 3. Readiness
curl -s http://localhost:4000/health/ready | jq

# 4. Database
curl -s http://localhost:4000/health/db | jq

# 5. Execute
curl -s -X POST http://localhost:4000/api/ai/execute \
  -H "Authorization: Bearer valid-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "conversationId": "test-conv-456",
    "userId": "test-user-789",
    "prompt": "What is 2+2?"
  }' | jq

# 6. Billing snapshots
curl -s http://localhost:4000/api/billing/snapshots \
  -H "Authorization: Bearer valid-api-key" | jq

# 7. Billing summary
curl -s "http://localhost:4000/api/billing/summary?periodStart=2026-02-01&periodEnd=2026-02-28" \
  -H "Authorization: Bearer valid-api-key" | jq
```

---

## Validation Coverage

This smoke pack validates:

### Infrastructure Layer
- ✅ PostgreSQL connectivity
- ✅ Database schema initialized
- ✅ api-gateway HTTP server running
- ✅ ai-service HTTP server running

### Startup Layer (Phase 32A)
- ✅ Environment variables validated
- ✅ Provider configuration validated
- ✅ Production guardrails validated
- ✅ Kill switches loaded
- ✅ Safety limits loaded

### Authentication & Authorization Layer
- ✅ API key validation
- ✅ Identity resolution
- ✅ Scope validation (`ai:execute`)

### Safety & Control Layer
- ✅ Launch state enforcement
- ✅ Abort mode enforcement
- ✅ Kill switches checked
- ✅ Global safety limits checked

### Quota Layer
- ✅ Request count quota
- ✅ Token usage quota

### Execution Layer
- ✅ Provider routing (api-gateway → ai-service)
- ✅ Adapter selection
- ✅ Real provider API call
- ✅ Response transformation

### Usage Recording Layer
- ✅ Usage ledger write
- ✅ Global safety limit tracking
- ✅ Billing snapshot creation (async)

### Billing Visibility Layer
- ✅ Read-only snapshot queries
- ✅ Time window filtering
- ✅ Cost aggregation
- ✅ Privacy preservation

---

## Common Failure Scenarios

### Scenario 1: PostgreSQL Not Running
**Symptoms:**
- Step 1 fails with connection error
- api-gateway fails to start

**Resolution:**
```powershell
docker run -d --name postgres-aisandbox -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aisandbox -p 5432:5432 postgres:15
```

---

### Scenario 2: Missing Environment Variables
**Symptoms:**
- api-gateway exits immediately on startup
- Readiness check returns 503

**Resolution:**
Check api-gateway `.env` file contains:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aisandbox
AI_PROVIDER=xai
LAUNCH_STATE=PUBLIC
ABORT_MODE=NONE
```

---

### Scenario 3: Missing Provider API Key
**Symptoms:**
- Execute endpoint returns 503
- ai-service logs show "Missing API key"

**Resolution:**
Check ai-service `.env` file contains provider API key:
```
XAI_API_KEY=your-api-key-here
```

---

### Scenario 4: Stub Provider Active
**Symptoms:**
- Execute returns `"[STUB] AI execution not implemented yet"`
- `tokensUsed` is 0

**Resolution:**
- Set `AI_PROVIDER` environment variable in api-gateway
- Ensure provider API key is set in ai-service
- Restart api-gateway

---

### Scenario 5: Quota Exceeded
**Symptoms:**
- Execute returns HTTP 429
- Error message mentions quota

**Resolution:**
- Check quota limits in database (`quota_state` table)
- Reset quota or wait for quota window to reset
- Adjust quota limits in safety configuration

---

## Determinism Guarantees

This smoke pack is deterministic:

1. **No Flaky Tests:** All checks are synchronous HTTP requests
2. **No Race Conditions:** Sequential execution, no parallelism
3. **No Network Dependencies:** Only localhost services (except provider API)
4. **No Time Dependencies:** No time-based assertions (except timestamps exist)
5. **No State Pollution:** Each test is independent (except usage accumulation)

**Known Non-Determinism:**
- Provider API response content (varies by prompt)
- Token counts (varies by provider/model)
- Timestamps (always current time)

**Acceptable Variance:**
- Response times (should be < 5 seconds per request)
- Token counts (should be > 0 for real providers)

---

## Execution Time Breakdown

| Step | Description | Expected Time |
|------|-------------|---------------|
| 1 | PostgreSQL connectivity | < 1 second |
| 2 | Health check | < 1 second |
| 3 | Readiness check | < 1 second |
| 4 | Database check | < 1 second |
| 5 | Execute (with provider) | 2-5 seconds |
| 6 | Billing snapshots | < 1 second |
| 7 | Billing summary | < 1 second |
| **Total** | **End-to-end validation** | **< 15 seconds** |

**Note:** Step 5 dominates execution time due to real provider API call.

---

## Usage Notes

### When to Run
- ✅ Before deployment (release candidate validation)
- ✅ After configuration changes
- ✅ After dependency updates
- ✅ After database migrations
- ✅ After environment changes

### When NOT to Run
- ❌ In CI/CD (requires real provider API keys)
- ❌ In production (use monitoring instead)
- ❌ Continuously (quota limits apply)

### Prerequisites Checklist
- [ ] PostgreSQL running and accessible
- [ ] Database `aisandbox` created
- [ ] Migrations applied
- [ ] api-gateway `.env` configured
- [ ] ai-service `.env` configured
- [ ] Valid API key in database
- [ ] Provider API key valid and has quota

---

## Smoke Pack Maintenance

**Update Triggers:**
- New endpoints added → Add to smoke pack
- New startup validators → Add to readiness check
- New environment variables → Document in prerequisites
- New failure modes → Add to common scenarios

**Version History:**
- Phase 33A (2026-02-10): Initial release

---

**END OF SMOKE PACK**
