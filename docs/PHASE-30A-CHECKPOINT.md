# PHASE 30A CHECKPOINT

**Phase:** 30  
**Stage:** 30A  
**Title:** Operational Runbook — Local Production-Style Execution (No UI)  
**Status:** COMPLETE and LOCKED  
**Date:** 2026-02-09  
**Previous Checkpoint:** PHASE-29B-CHECKPOINT.md

---

## Executive Summary

Phase 30A documents the **exact operational procedure** required to run the AI Sandbox Platform locally in a production-style configuration without a UI.

This phase converts proven runtime behavior (Phases 29A, 29B) into a repeatable runbook:
- Startup order and dependencies
- Environment variable configuration
- Canonical smoke test procedure
- Known failure modes and diagnostics

This phase explicitly does NOT:
- Change code
- Change architecture
- Introduce new features
- Relax safety, quota, or billing controls

---

## System Startup Order (LOCKED)

### Required Startup Sequence

**1. PostgreSQL (Docker, standalone container)**

Start first, before any application services.

```bash
docker run -d \
  --name postgres-aisandbox \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=aisandbox \
  -p 5432:5432 \
  postgres:15
```

**Why first:**
- api-gateway requires database connectivity at startup
- Startup guard validates schema presence
- ConfigurationValidator checks database connection

**Validation:**
```bash
psql -h localhost -U postgres -d aisandbox -c "SELECT 1;"
```

---

**2. api-gateway**

Start second, after PostgreSQL is ready.

```bash
cd services/api-gateway
npm run dev
```

**Why second:**
- Depends on PostgreSQL (DATABASE_URL)
- Does NOT depend on ai-service at startup
- Validates configuration and database schema on boot

**Startup checks performed:**
- Database connectivity verified
- Schema presence verified
- Environment variables validated (LAUNCH_STATE, ABORT_MODE)
- Configuration guards passed

**Expected output:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] ConfigModule dependencies initialized
[Nest] INFO [RoutesResolver] AIExecutionController {/api/ai}:
[Nest] INFO [RouterExplorer] Mapped {/api/ai/execute, POST} route
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Application listening on port 4000
```

**Failure modes at startup:**
- Database connection failure → exits immediately
- Missing environment variables → exits immediately
- Invalid LAUNCH_STATE or ABORT_MODE → exits immediately

---

**3. ai-service**

Start third, after api-gateway is ready.

```bash
cd services/ai-service
npm run dev
```

**Why third:**
- Does NOT depend on PostgreSQL
- Does NOT depend on api-gateway
- Can start independently, but api-gateway needs it for execution

**Startup checks performed:**
- ConfigService initialized
- AIExecutionService initialized
- Adapter registry available (no adapters instantiated at startup)

**Expected output:**
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] ConfigModule dependencies initialized
[Nest] INFO [InstanceLoader] AIExecutionModule dependencies initialized
[Nest] INFO [RoutesResolver] AIExecutionController {/ai}:
[Nest] INFO [RouterExplorer] Mapped {/ai/execute, POST} route
[Nest] INFO [NestApplication] Nest application successfully started
[Nest] INFO Application listening on port 4001
```

**Failure modes at startup:**
- None (provider API keys validated at execution time, not startup)

---

### Startup Order Summary

| Service | Port | Depends On | Startup Validation |
|---------|------|------------|-------------------|
| PostgreSQL | 5432 | None | Schema initialized |
| api-gateway | 4000 | PostgreSQL | Database + config validated |
| ai-service | 4001 | None | Module dependencies initialized |

**Critical invariant:** api-gateway MUST start after PostgreSQL. ai-service can start in any order relative to api-gateway, but both must be running for end-to-end execution.

---

## Environment Variables (LOCKED)

### api-gateway

**Required:**

| Variable | Purpose | Example | Validation |
|----------|---------|---------|------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/aisandbox` | Validated at startup |
| `AI_PROVIDER` | Provider selection (global) | `xai` | Used at execution time |
| `LAUNCH_STATE` | Launch state enforcement | `PUBLIC` | Validated at startup |
| `ABORT_MODE` | Abort mode enforcement | `NONE` | Validated at startup |

**Optional:**

| Variable | Purpose | Default | Notes |
|----------|---------|---------|-------|
| `NODE_ENV` | Environment mode | `development` | Does not affect behavior |
| `PORT` | HTTP port | `4000` | Configurable |
| `BILLING_CHARGES_ENABLED` | Billing flag | `false` | Disabled in dev |
| `AI_SERVICE_URL` | ai-service endpoint | `http://localhost:4001` | For HTTP client |

**Provider Selection Behavior:**

- `AI_PROVIDER` is read by api-gateway at execution time (line 105 in `ai-execution.controller.ts`)
- Default value: `'stub'` (if `AI_PROVIDER` not set)
- Valid values: `stub`, `anthropic`, `openai`, `groq`, `xai`, `deepseek`
- Provider value is injected into `AIExecutionRequest` sent to ai-service
- **Request body `provider` field is IGNORED by design** (api-gateway always overrides)

**Critical invariant:** Provider selection is **owned by api-gateway**, not by the caller or ai-service.

---

### ai-service

**Required (provider-specific):**

| Variable | Purpose | Required When | Validation |
|----------|---------|---------------|------------|
| `XAI_API_KEY` | xAI API key | `AI_PROVIDER=xai` | Validated at execution time |
| `ANTHROPIC_API_KEY` | Anthropic API key | `AI_PROVIDER=anthropic` | Validated at execution time |
| `OPENAI_API_KEY` | OpenAI API key | `AI_PROVIDER=openai` | Validated at execution time |
| `GROQ_API_KEY` | Groq API key | `AI_PROVIDER=groq` | Validated at execution time |
| `DEEPSEEK_API_KEY` | DeepSeek API key | `AI_PROVIDER=deepseek` | Validated at execution time |

**Optional (provider-specific):**

| Variable | Purpose | Default | Provider |
|----------|---------|---------|----------|
| `XAI_BASE_URL` | xAI base URL | `https://api.x.ai/v1` | xAI |
| `XAI_MODEL` | xAI model | `grok-beta` | xAI |
| `ANTHROPIC_MODEL` | Anthropic model | `claude-3-5-sonnet-20241022` | Anthropic |
| `OPENAI_MODEL` | OpenAI model | `gpt-4` | OpenAI |

**Provider API Key Behavior:**

- ai-service does NOT read `AI_PROVIDER` environment variable
- ai-service receives `provider` field in `AIExecutionRequest` from api-gateway
- Adapter instantiation occurs per-request (Phase 28)
- API key is read from ConfigService at execution time
- **If API key is missing, execution throws immediately** (fail-fast)
- No fallback to stub when provider is configured

**Critical invariant:** ai-service is **execution-only**. It does NOT guess or infer provider.

---

## Canonical Smoke Test (LOCKED)

### Test Procedure

**Endpoint:** `POST http://localhost:4000/api/ai/execute`

**Headers:**
```
Authorization: Bearer valid-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "sessionId": "test-session-123",
  "conversationId": "test-conv-456",
  "userId": "test-user-789",
  "prompt": "What is the capital of France?"
}
```

**Note:** The `provider` field is NOT included in the request body. Provider is determined by `AI_PROVIDER` environment variable in api-gateway.

---

### Expected Success Response

**HTTP Status:** `200 OK`

**Response Body:**
```json
{
  "output": "The capital of France is Paris.",
  "tokensUsed": 42,
  "model": "grok-3"
}
```

**Success Criteria:**

1. ✅ HTTP status is 200
2. ✅ `output` is NOT `"[STUB] AI execution not implemented yet"`
3. ✅ `tokensUsed` is greater than 0
4. ✅ `model` matches the configured provider's model (e.g., `grok-3` for xAI)
5. ✅ `output` contains natural-language text (not an error message)

---

### What This Test Validates

**Authentication Layer:**
- ✅ API key validation (ApiKeyAuthGuard)
- ✅ Identity resolution (userId, apiKeyId)

**Authorization Layer:**
- ✅ Scope validation (AuthorizationGuard)
- ✅ `ai:execute` scope present

**Safety & Control Layers:**
- ✅ Kill switches and global safety limits (ExecutionSafetyGuard)
- ✅ Launch state enforcement (LaunchGuard)
- ✅ Abort mode enforcement (AbortGuard)

**Quota Layer:**
- ✅ Request count quota (QuotaGuard)
- ✅ Token usage quota (QuotaGuard)

**Provider Routing:**
- ✅ Provider selection from `AI_PROVIDER` env var
- ✅ Provider value injected into request
- ✅ Request forwarded to ai-service

**Execution Layer:**
- ✅ Adapter selection based on provider
- ✅ API key resolution from ConfigService
- ✅ Real HTTP request to provider API
- ✅ Response transformation to AIExecutionResult

**Usage Recording:**
- ✅ Usage ledger write (UsageLedgerService)
- ✅ Global safety limit tracking (GlobalSafetyLimitService)

**Single test validates the entire stack.**

---

### Test Execution (curl)

```bash
curl -X POST http://localhost:4000/api/ai/execute \
  -H "Authorization: Bearer valid-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "conversationId": "test-conv-456",
    "userId": "test-user-789",
    "prompt": "What is the capital of France?"
  }'
```

**Expected output:**
```json
{"output":"The capital of France is Paris.","tokensUsed":42,"model":"grok-3"}
```

---

## Known Failure Modes (LOCKED)

### 401 Unauthorized

**HTTP Status:** `401 Unauthorized`

**Response Body:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Causes:**
1. Missing `Authorization` header
2. Invalid API key (not in `ApiKeyConfig.API_KEYS` map)
3. Malformed `Authorization` header (not `Bearer <key>`)

**Layer:** api-gateway → ApiKeyAuthGuard

**Resolution:**
- Verify `Authorization: Bearer valid-api-key` header is present
- Verify API key exists in `services/api-gateway/src/auth/api-key.config.ts`

**Deterministic:** Same invalid key → always 401

---

### 403 Forbidden

**HTTP Status:** `403 Forbidden`

**Response Body (scope failure):**
```json
{
  "statusCode": 403,
  "message": "Forbidden: insufficient scopes"
}
```

**Response Body (launch state failure):**
```json
{
  "statusCode": 403,
  "message": "Access denied: launch state is PUBLIC, key requires INTERNAL access"
}
```

**Causes:**
1. API key missing required scope (`ai:execute`)
2. Launch state restriction (PUBLIC vs INTERNAL/EARLY_ACCESS)

**Layer:** api-gateway → AuthorizationGuard or LaunchGuard

**Resolution:**
- Verify API key has `ai:execute` scope in `api-key.config.ts`
- Verify `LAUNCH_STATE` matches API key flags (`isInternal`, `isEarlyAccess`)

**Deterministic:** Same key + same launch state → always 403

---

### 429 Too Many Requests (Quota Exceeded)

**HTTP Status:** `429 Too Many Requests`

**Response Body:**
```json
{
  "statusCode": 429,
  "message": "Quota exceeded"
}
```

**Causes:**
1. Request count quota exceeded (requests per minute)
2. Token usage quota exceeded (tokens per day)

**Layer:** api-gateway → QuotaGuard

**Resolution:**
- Wait for quota window to reset (1 minute for requests, 1 day for tokens)
- OR increase quota for API key in `services/api-gateway/src/quota/quota.config.ts`
- OR restart api-gateway (clears in-memory quota state)

**Deterministic:** Same key + same window → always 429 if quota exceeded

**Note:** Quota is per `apiKeyId`, not per user or session.

---

### 503 Service Unavailable

**HTTP Status:** `503 Service Unavailable`

**Response Body (kill switch):**
```json
{
  "statusCode": 503,
  "message": "AI execution is currently disabled"
}
```

**Response Body (abort mode):**
```json
{
  "statusCode": 503,
  "message": "AI execution is currently paused (abort mode: SOFT)"
}
```

**Response Body (provider failure):**
```json
{
  "statusCode": 503,
  "message": "xAI API timeout"
}
```

**Causes:**
1. Kill switch disabled (ExecutionSafetyGuard)
2. Global safety limit reached (ExecutionSafetyGuard)
3. Abort mode active (AbortGuard)
4. Provider API timeout or connection error
5. Provider API rate limit (429 from provider)

**Layer:** api-gateway → ExecutionSafetyGuard, AbortGuard, or provider adapter

**Resolution:**
- Verify kill switches are enabled (if applicable)
- Verify `ABORT_MODE=NONE`
- Verify provider API is reachable
- Verify provider API key is valid
- Check provider API status page

**Deterministic:** Same configuration → always 503 if guard fails

---

### 500 Internal Server Error

**HTTP Status:** `500 Internal Server Error`

**Response Body:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

**Causes:**
1. Missing provider API key (e.g., `XAI_API_KEY` not set when `AI_PROVIDER=xai`)
2. Malformed provider response
3. Database write failure (usage ledger)
4. Unexpected exception in execution flow

**Layer:** api-gateway or ai-service (varies by cause)

**Resolution:**
- Check api-gateway logs for stack traces
- Check ai-service logs for stack traces
- Verify provider API key is set in ai-service `.env`
- Verify database connectivity

**Deterministic:** Same missing config → always 500

---

### Failure Mode Summary Table

| Status | Message | Layer | Cause | Resolution |
|--------|---------|-------|-------|------------|
| 401 | Unauthorized | ApiKeyAuthGuard | Invalid API key | Fix Authorization header |
| 403 | Forbidden | AuthorizationGuard / LaunchGuard | Missing scope or launch restriction | Fix API key config |
| 429 | Quota exceeded | QuotaGuard | Quota limit reached | Wait or increase quota |
| 503 | Service unavailable | ExecutionSafetyGuard / AbortGuard / Provider | Kill switch, abort mode, or provider failure | Fix configuration or wait |
| 500 | Internal server error | Various | Missing config or unexpected error | Check logs and config |

**All failure modes are deterministic and expected behaviors.**

---

## Operational Guarantees (LOCKED)

The following operational invariants are **explicitly locked** as of Phase 30A:

### Provider Selection

1. ✅ **Deterministic provider selection** - `AI_PROVIDER` env var controls routing
2. ✅ **No provider guessing** - ai-service does not infer provider
3. ✅ **Fail-fast on missing API key** - execution throws if provider API key missing
4. ✅ **No fallback to stub** - if provider configured, stub is NOT used as fallback

### Dependency Management

1. ✅ **No UI dependency** - services run headless via HTTP
2. ✅ **No mock databases** - real PostgreSQL required
3. ✅ **No in-memory fallbacks** - all state persisted to database or managed in-memory with explicit semantics

### Guard Enforcement

1. ✅ **Quota enforcement always active** - QuotaGuard cannot be bypassed
2. ✅ **Auth/authz always active** - ApiKeyAuthGuard and AuthorizationGuard cannot be bypassed
3. ✅ **Launch state always enforced** - LaunchGuard cannot be bypassed
4. ✅ **Abort mode always enforced** - AbortGuard cannot be bypassed

### Billing & Safety

1. ✅ **Billing charges disabled in dev** - `BILLING_CHARGES_ENABLED=false`
2. ✅ **Real provider execution under guards** - no test-only behavior
3. ✅ **Usage ledger always written** - usage recorded after successful execution
4. ✅ **Global safety limits tracked** - daily spend limit monitored

### Startup & Configuration

1. ✅ **Startup order enforced** - PostgreSQL → api-gateway → ai-service
2. ✅ **Configuration validated at startup** - api-gateway validates env vars
3. ✅ **Schema validated at startup** - api-gateway checks database schema
4. ✅ **Services fail fast on misconfiguration** - no silent fallbacks

---

## Runbook Checklist

### Pre-Startup Checklist

- [ ] PostgreSQL container running on port 5432
- [ ] Database `aisandbox` exists
- [ ] Migrations applied (schema present)
- [ ] api-gateway `.env` file configured:
  - [ ] `DATABASE_URL` set
  - [ ] `AI_PROVIDER` set (e.g., `xai`)
  - [ ] `LAUNCH_STATE` set (e.g., `PUBLIC`)
  - [ ] `ABORT_MODE` set (e.g., `NONE`)
- [ ] ai-service `.env` file configured:
  - [ ] Provider API key set (e.g., `XAI_API_KEY`)

### Startup Checklist

- [ ] Start PostgreSQL container
- [ ] Verify PostgreSQL connectivity (`psql` or `SELECT 1`)
- [ ] Start api-gateway (`npm run dev` in `services/api-gateway`)
- [ ] Verify api-gateway startup logs (no errors)
- [ ] Start ai-service (`npm run dev` in `services/ai-service`)
- [ ] Verify ai-service startup logs (no errors)

### Smoke Test Checklist

- [ ] Execute canonical smoke test (curl or HTTP client)
- [ ] Verify HTTP 200 response
- [ ] Verify `output` is NOT stub response
- [ ] Verify `tokensUsed > 0`
- [ ] Verify `model` matches provider

### Post-Test Checklist

- [ ] Check api-gateway logs for execution signals
- [ ] Check ai-service logs for adapter execution
- [ ] Verify usage ledger entry in database (optional)
- [ ] Verify quota state incremented (optional)

---

## Safe Resume Point

### Phase 30A Status

**COMPLETE and LOCKED**

- Operational runbook documented
- Startup order defined
- Environment variables enumerated
- Canonical smoke test specified
- Known failure modes cataloged
- Operational guarantees locked

### Canonical Reference

This runbook is the **canonical reference** for local operation of the AI Sandbox Platform in production-style configuration without a UI.

**Usage:**
- Developers use this runbook for local testing
- CI/CD pipelines may reference this runbook for integration testing
- Future phases may build on this without modifying it

### Next Allowable Phase

**Phase 31** (to be defined separately)

Potential scope for Phase 31 (not yet approved):
- Container orchestration (Docker Compose)
- Automated startup scripts
- Health check endpoints
- Graceful shutdown procedures
- Log aggregation and monitoring

### Modification Policy

Phase 30A must **not be modified** without:
1. Formal reopening request
2. Explicit user approval
3. Documentation of why reopening is necessary
4. Verification that changes reflect actual system behavior

---

## ULTRA-BRIEF SUMMARY

1. **Startup Order Locked:** PostgreSQL → api-gateway → ai-service; dependencies and validation steps documented for repeatable local production-style execution.

2. **Environment Variables Defined:** api-gateway owns provider selection via `AI_PROVIDER`; ai-service requires provider-specific API keys; all required and optional variables enumerated.

3. **Canonical Smoke Test:** Single POST to `/api/ai/execute` validates entire stack (auth, authz, quota, provider routing, execution, usage recording) in one request.

4. **Failure Modes Cataloged:** 401 (auth), 403 (authz/launch), 429 (quota), 503 (guards/provider), 500 (config/error) documented with causes, layers, and resolutions.

5. **Operational Guarantees Locked:** Deterministic provider selection, no UI dependency, quota always enforced, billing disabled in dev, fail-fast on misconfiguration; runbook is canonical reference.

---

**END OF PHASE 30A CHECKPOINT**
