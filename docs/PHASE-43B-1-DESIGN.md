# PHASE-43B-1-DESIGN.md
## Cross-Service Consistency Audit — AI Execution vs Ledger vs Failure Semantics

**Phase:** PHASE-43B  
**Stage:** STAGE-43B-1  
**Nature:** DESIGN / AUDIT ONLY (NO CODE CHANGES)  
**Scope:** api-gateway ↔ ai-service execution boundary  
**Date:** 2026-02-25

---

## Executive Summary

This audit examines the cross-service consistency guarantees between api-gateway and ai-service for AI execution, focusing on the boundary where AI provider calls, ledger writes, and quota enforcement interact. The goal is to identify any condition that could cause financial inconsistency, non-deterministic behavior, or partial commit states.

### ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **SAFE: Idempotency prevents double-billing** — `(user_id, request_id)` UNIQUE constraint + IdempotencyGuard short-circuit ensures duplicate requests return cached result without ledger write or quota consumption
2. **SAFE: Token quota uses advisory locks** — `pg_advisory_xact_lock()` serializes quota checks per user (~50-100ms), prevents TOCTOU race, lock NOT held during AI execution (10-30s)
3. **CRITICAL RISK: Network failure after AI success** — If ai-service succeeds but network drops before response reaches api-gateway, ledger write never occurs → AI tokens consumed but not billed
4. **MEDIUM RISK: Ledger write failure after AI success** — If database INSERT fails after ai-service returns, client receives 500 error but AI execution completed → tokens consumed, no billing record
5. **LOW RISK: Timeout-induced corruption** — 30s timeout in AIServiceHttpClient may fire while AI provider still processing; client retries with Idempotency-Key prevent double-billing but original execution may complete untracked

---

## 1. End-to-End Execution Flow

### 1.1 Complete Runtime Path

```
Client Request (POST /api/ai/execute)
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ api-gateway: AIExecutionController.execute()                    │
├─────────────────────────────────────────────────────────────────┤
│ GUARD CHAIN (NestJS @UseGuards):                                │
│   1. ApiKeyAuthGuard                                             │
│      └─ Verify API key, attach ApiKeyIdentity to request        │
│   2. AuthorizationGuard                                          │
│      └─ Verify 'ai:execute' scope                               │
│   3. ExecutionSafetyGuard                                        │
│      └─ Check kill switches + global safety limits              │
│   4. LaunchGuard                                                 │
│      └─ Verify launch state                                     │
│   5. AbortGuard                                                  │
│      └─ Verify abort mode not active                            │
│   6. IdempotencyGuard (PHASE-43A-2C) ★ CRITICAL ★               │
│      ├─ Extract Idempotency-Key header                          │
│      ├─ Query: SELECT * FROM usage_records                      │
│      │         WHERE user_id = ? AND request_id = ?             │
│      ├─ If found: Reconstruct AIExecutionResult                 │
│      │           Attach to request.idempotentResult              │
│      │           SHORT-CIRCUIT (skip steps 7-9, return cached)  │
│      └─ If not found: Continue to step 7                        │
│   7. QuotaGuard (legacy, Phase 21B)                             │
│      └─ In-memory quota check (appears unused)                  │
│   8. TokenQuotaGuard (PHASE-42A-3) ★ CRITICAL ★                 │
│      ├─ BEGIN TRANSACTION                                       │
│      ├─ SELECT pg_advisory_xact_lock(hashtext('quota:token:' || userId)) │
│      ├─ SELECT COALESCE(SUM(tokens_used), 0)                    │
│      │   FROM usage_records                                     │
│      │   WHERE user_id = ? AND timestamp > NOW() - INTERVAL '24h' │
│      ├─ Estimate tokens for current request                     │
│      ├─ If (currentUsage + estimatedTokens) > MAX_TOKENS_PER_24H: │
│      │   ├─ ROLLBACK (releases lock)                            │
│      │   └─ Throw HTTP 429 Quota Exceeded                       │
│      ├─ COMMIT (releases lock)                                  │
│      └─ Lock released (~50-100ms total)                         │
│   9. RateLimitGuard                                              │
│      └─ In-memory rate limit check (20 req/min per IP)          │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONTROLLER BODY: AIExecutionController.execute()                │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check request.idempotentResult                                │
│    └─ If present: return immediately (replay)                   │
│ 2. Validate Idempotency-Key header (if provided)                │
│    ├─ Trim whitespace                                            │
│    ├─ Reject if empty (400)                                      │
│    └─ Reject if > 100 chars (400)                               │
│ 3. Start timing: startTime = Date.now()                         │
│ 4. Determine provider: process.env.AI_PROVIDER || 'stub'        │
│ 5. Replace userId with verified identity.userId                 │
│ 6. Inject apiKeyId into metadata                                │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ HTTP CALL: AIServiceHttpClient.execute()                        │
├─────────────────────────────────────────────────────────────────┤
│ axios.post('http://localhost:4001/api/execute', request, {      │
│   timeout: 30000, // 30 second timeout                          │
│   headers: { 'Content-Type': 'application/json' }               │
│ })                                                               │
│                                                                  │
│ ★ CROSS-SERVICE BOUNDARY ★                                      │
│ Network: api-gateway → ai-service                               │
│ Protocol: HTTP (no retry, no circuit breaker)                   │
│ Timeout: 30 seconds (hard cutoff)                               │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ ai-service: AIExecutionController.execute()                     │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/execute                                                │
│ └─ AIExecutionService.execute(request)                          │
│    ├─ Validate request.provider is present                      │
│    ├─ Get adapter: getAdapter(request.provider)                 │
│    ├─ Log execution entry signal                                │
│    └─ adapter.execute(request) ★ AI PROVIDER CALL ★             │
│       ├─ Transform request to provider format                   │
│       ├─ Call external AI API (Anthropic/OpenAI/etc)            │
│       │  └─ Network call to external provider (10-30s)          │
│       ├─ Transform response to AIExecutionResult                │
│       │  └─ { output, tokensUsed, model }                       │
│       └─ Return result                                           │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ HTTP RESPONSE: ai-service → api-gateway                         │
├─────────────────────────────────────────────────────────────────┤
│ ★ CROSS-SERVICE BOUNDARY ★                                      │
│ Network: ai-service → api-gateway                               │
│ Protocol: HTTP response                                          │
│ Body: AIExecutionResult { output, tokensUsed, model }           │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONTROLLER BODY: AIExecutionController.execute() (continued)    │
├─────────────────────────────────────────────────────────────────┤
│ 7. Calculate executionDurationMs = Date.now() - startTime       │
│ 8. Write usage record ★ CRITICAL COMMIT POINT ★                 │
│    └─ UsageLedgerService.writeRecord({                          │
│         apiKeyId, userId, sessionId, conversationId,            │
│         provider, adapter, model, tokensUsed,                   │
│         executionDurationMs, requestId                          │
│       })                                                         │
│       ├─ Generate executionId = uuidv4()                        │
│       ├─ INSERT INTO usage_records (...)                        │
│       ├─ If unique violation (23505) on (user_id, request_id):  │
│       │  └─ Fetch existing record, return (idempotent retry)    │
│       └─ If other error: throw (propagates to client)           │
│ 9. Record execution cost (in-memory only)                       │
│    └─ globalSafetyLimitService.recordExecutionCost(...)         │
│ 10. Return AIExecutionResult to client                          │
└─────────────────────────────────────────────────────────────────┘
  │
  ▼
Client receives response (HTTP 200 OK)
```

### 1.2 Transaction Boundaries

| Phase | Transaction Scope | Commit Point | Rollback Trigger |
|-------|-------------------|--------------|------------------|
| **TokenQuotaGuard** | PostgreSQL transaction | `COMMIT` after quota check passes | `ROLLBACK` if quota exceeded |
| **AI Execution** | No transaction | N/A (external API call) | N/A (no rollback) |
| **Ledger Write** | PostgreSQL transaction (implicit) | `INSERT` completes | Database error |

**CRITICAL OBSERVATION:** No distributed transaction spans ai-service call and ledger write. These are two independent operations with no atomic commit guarantee.

### 1.3 Advisory Lock Lifecycle

```
TokenQuotaGuard.canActivate():
  BEGIN TRANSACTION
    ├─ SELECT pg_advisory_xact_lock(hashtext('quota:token:' || userId))
    │  └─ BLOCKS if another transaction holds lock for same userId
    ├─ SELECT SUM(tokens_used) FROM usage_records WHERE ... (serialized)
    ├─ Estimate tokens for current request
    ├─ If quota exceeded:
    │  └─ ROLLBACK (auto-releases lock)
    └─ COMMIT (auto-releases lock)
  
  ★ Lock released BEFORE ai-service call ★
  
  ai-service.execute() (lock NOT held, 10-30s)
  
  UsageLedgerService.writeRecord() (lock NOT held)
```

**Lock Duration:** ~50-100ms (quota check only)  
**Lock NOT Held During:** AI execution (10-30s), ledger write (~10-50ms)

---

## 2. Success Path Analysis

### 2.1 Happy Path (First Request, No Idempotency-Key)

**Preconditions:**
- User has available quota
- ai-service is reachable
- Database is available
- No network failures

**Execution Sequence:**
1. Guards 1-5 pass (auth, safety, launch, abort)
2. IdempotencyGuard: No Idempotency-Key → continue
3. TokenQuotaGuard: Acquire lock, check quota, release lock → pass
4. RateLimitGuard: Check rate limit → pass
5. Controller: Call ai-service → success (HTTP 200, AIExecutionResult)
6. Controller: Write usage_records → success (INSERT)
7. Controller: Return AIExecutionResult to client → HTTP 200

**Guarantees:**
- ✅ AI execution completed
- ✅ Ledger record written
- ✅ Client receives response
- ✅ Tokens counted toward quota

**Financial Consistency:** SAFE (execution and billing aligned)

---

### 2.2 Happy Path (Idempotent Retry with Idempotency-Key)

**Preconditions:**
- Same user, same Idempotency-Key as prior successful request
- Prior request completed successfully (usage_records row exists)

**Execution Sequence:**
1. Guards 1-5 pass (auth, safety, launch, abort)
2. IdempotencyGuard:
   - Query: `SELECT * FROM usage_records WHERE user_id = ? AND request_id = ?`
   - Found existing record
   - Reconstruct AIExecutionResult from metadata
   - Attach to `request.idempotentResult`
   - **SHORT-CIRCUIT** (skip guards 7-9, skip controller body)
3. Controller: Detect `request.idempotentResult` → return immediately

**Guarantees:**
- ✅ No AI execution (replay)
- ✅ No ledger write (existing record returned)
- ✅ No quota evaluation (short-circuit before TokenQuotaGuard)
- ✅ Client receives cached response (HTTP 200)

**Financial Consistency:** SAFE (no double-billing, replay is free)

---

### 2.3 Happy Path (Concurrent Requests, Different Users)

**Preconditions:**
- User A and User B send requests simultaneously
- Both have available quota

**Execution Sequence:**
- User A: TokenQuotaGuard acquires lock for `quota:token:userA`
- User B: TokenQuotaGuard acquires lock for `quota:token:userB` (different lock)
- Both proceed independently (no blocking)

**Guarantees:**
- ✅ No cross-user interference
- ✅ Advisory locks are per-user (scoped by `userId`)
- ✅ Concurrent execution for different users

**Financial Consistency:** SAFE (independent quota enforcement)

---

### 2.4 Happy Path (Concurrent Requests, Same User)

**Preconditions:**
- Same user sends 2 requests simultaneously (no Idempotency-Key)

**Execution Sequence:**
- Request 1: TokenQuotaGuard acquires lock for `quota:token:userX`
- Request 2: TokenQuotaGuard **BLOCKS** waiting for lock
- Request 1: Quota check passes, COMMIT (releases lock)
- Request 2: Acquires lock, quota check (includes Request 1's estimated tokens)
- Request 2: Quota check passes, COMMIT (releases lock)
- Both proceed to ai-service call (lock NOT held)

**Guarantees:**
- ✅ Quota checks are serialized per user
- ✅ No TOCTOU race (advisory lock prevents)
- ✅ Both requests may succeed if total tokens < limit

**Financial Consistency:** SAFE (serialized quota enforcement)

---

## 3. Failure Matrix (MANDATORY)

### 3.1 AI Timeout (30s Exceeded)

**Scenario:** ai-service call takes > 30 seconds, axios timeout fires

**Execution Sequence:**
1. Guards 1-9 pass
2. Controller: `AIServiceHttpClient.execute()` called
3. ai-service receives request, begins AI provider call
4. AI provider is slow (> 30s)
5. axios timeout fires (30s)
6. `AIServiceHttpClient.execute()` throws timeout error
7. Controller: Error propagates, ledger write **NEVER OCCURS**
8. Client receives HTTP 500 or timeout error

**Current Behavior:**
- ❌ ai-service may still be processing (timeout is client-side only)
- ❌ If AI provider completes after timeout, result is lost
- ❌ No ledger record written (timeout before ledger write)
- ❌ Client sees failure, but AI execution may have succeeded

**Financial Risk:** **MEDIUM**
- If AI provider completes after timeout, tokens consumed but not billed
- Client may retry with Idempotency-Key → second execution → potential double-billing if first execution completes

**Consistency Risk:** **HIGH**
- Non-deterministic: timeout may fire while AI still processing
- Client cannot distinguish "AI failed" from "timeout before completion"

**Determinism Impact:** **HIGH**
- Same request may succeed or timeout depending on AI provider latency
- Retry behavior is non-deterministic if first request is still processing

**Recommended Mitigation:**
- Add server-side timeout enforcement in ai-service (kill long-running requests)
- Add execution tracking table in ai-service to detect orphaned executions
- Consider idempotent execution tracking (write execution intent before calling provider)

---

### 3.2 AI 5xx Response

**Scenario:** ai-service returns HTTP 500 (adapter error, provider error, etc.)

**Execution Sequence:**
1. Guards 1-9 pass
2. Controller: `AIServiceHttpClient.execute()` called
3. ai-service receives request, calls AI provider
4. AI provider returns error (e.g., 500, 503, rate limit)
5. ai-service adapter throws exception
6. ai-service returns HTTP 500 to api-gateway
7. `AIServiceHttpClient.execute()` throws error
8. Controller: Error propagates, ledger write **NEVER OCCURS**
9. Client receives HTTP 500

**Current Behavior:**
- ✅ AI execution failed (provider error)
- ✅ No ledger record written (success-only recording)
- ✅ Client sees failure (HTTP 500)
- ✅ No quota consumed (estimated tokens only, not actual)

**Financial Risk:** **NONE**
- No tokens consumed (AI provider failed)
- No ledger record (success-only policy)

**Consistency Risk:** **NONE**
- Deterministic failure (AI provider error)
- Client can retry safely

**Determinism Impact:** **LOW**
- Same request may succeed on retry if provider error is transient

**Recommended Mitigation:** None (current behavior is correct)

---

### 3.3 Network Drop After AI Success, Before Ledger Write

**Scenario:** ai-service succeeds, but network connection drops before response reaches api-gateway

**Execution Sequence:**
1. Guards 1-9 pass
2. Controller: `AIServiceHttpClient.execute()` called
3. ai-service receives request, calls AI provider
4. AI provider succeeds, returns result
5. ai-service returns HTTP 200 with AIExecutionResult
6. **Network connection drops** (connection reset, router failure, etc.)
7. api-gateway never receives response
8. `AIServiceHttpClient.execute()` throws network error
9. Controller: Error propagates, ledger write **NEVER OCCURS**
10. Client receives HTTP 500 or network error

**Current Behavior:**
- ❌ AI execution succeeded (tokens consumed at provider)
- ❌ No ledger record written (network failure before write)
- ❌ Client sees failure, but AI execution completed
- ❌ Tokens consumed but not billed

**Financial Risk:** **CRITICAL**
- AI provider charged for tokens, but no billing record
- Lost revenue (tokens consumed, not billed)
- If client retries with Idempotency-Key, second execution creates ledger record for second attempt only

**Consistency Risk:** **CRITICAL**
- Execution succeeded but not recorded
- Client cannot distinguish "AI failed" from "network failure after success"

**Determinism Impact:** **CRITICAL**
- Non-deterministic: network failure timing is unpredictable
- Retry with Idempotency-Key creates new execution (original lost)

**Recommended Mitigation:**
- **Two-Phase Execution Record:**
  1. Write execution intent BEFORE ai-service call (status: 'pending')
  2. Update execution record AFTER ai-service success (status: 'completed')
  3. Periodic cleanup of abandoned 'pending' records
- **Idempotent Execution Tracking in ai-service:**
  - ai-service writes execution result to database before returning
  - api-gateway queries ai-service for execution status on retry
- **Execution Status API:**
  - Add `GET /api/ai/executions/:executionId` to query execution state
  - Client can poll for completion if network fails

---

### 3.4 Ledger Write DB Failure After AI Success

**Scenario:** ai-service succeeds, but `usage_records` INSERT fails (DB connection lost, disk full, constraint violation, etc.)

**Execution Sequence:**
1. Guards 1-9 pass
2. Controller: `AIServiceHttpClient.execute()` called
3. ai-service succeeds, returns AIExecutionResult
4. Controller: `UsageLedgerService.writeRecord()` called
5. Database INSERT fails (connection error, disk full, etc.)
6. `writeRecord()` throws error
7. Controller: Error propagates to client
8. Client receives HTTP 500

**Current Behavior:**
- ❌ AI execution succeeded (tokens consumed)
- ❌ No ledger record written (DB failure)
- ❌ Client sees failure (HTTP 500)
- ❌ Tokens consumed but not billed

**Financial Risk:** **CRITICAL**
- AI provider charged for tokens, but no billing record
- Lost revenue (tokens consumed, not billed)

**Consistency Risk:** **CRITICAL**
- Execution succeeded but not recorded
- Client sees 500 error, may not retry (assumes failure)

**Determinism Impact:** **MEDIUM**
- DB failures are typically transient (connection pool exhausted, etc.)
- Retry may succeed if DB recovers

**Recommended Mitigation:**
- **Write-Ahead Logging (WAL):**
  - Write execution result to durable queue (e.g., Redis, file) before returning
  - Background worker flushes to database
- **Retry Logic in Ledger Write:**
  - Retry INSERT 3 times with exponential backoff
  - If all retries fail, log to error queue for manual reconciliation
- **Execution Result Caching:**
  - Cache AIExecutionResult in Redis with TTL (e.g., 1 hour)
  - If ledger write fails, client can retry with Idempotency-Key
  - api-gateway queries cache before calling ai-service again

---

### 3.5 api-gateway Crash After AI Success, Before Ledger Write

**Scenario:** api-gateway process crashes (OOM, segfault, SIGKILL) after ai-service returns but before ledger write

**Execution Sequence:**
1. Guards 1-9 pass
2. Controller: `AIServiceHttpClient.execute()` called
3. ai-service succeeds, returns AIExecutionResult
4. **api-gateway process crashes** (OOM, SIGKILL, etc.)
5. Ledger write never occurs
6. Client connection drops (no response)

**Current Behavior:**
- ❌ AI execution succeeded (tokens consumed)
- ❌ No ledger record written (crash before write)
- ❌ Client connection dropped (no response)
- ❌ Tokens consumed but not billed

**Financial Risk:** **CRITICAL**
- AI provider charged for tokens, but no billing record
- Lost revenue (tokens consumed, not billed)

**Consistency Risk:** **CRITICAL**
- Execution succeeded but not recorded
- Client sees connection drop, may retry

**Determinism Impact:** **LOW**
- Crashes are rare (but possible under high load, memory pressure)

**Recommended Mitigation:**
- Same as 3.4 (Write-Ahead Logging, Execution Result Caching)
- **Health Monitoring:**
  - Monitor api-gateway memory usage, restart before OOM
  - Graceful shutdown: drain in-flight requests before restart

---

### 3.6 Client Retry After Timeout (No Idempotency-Key)

**Scenario:** Client sends request, times out (30s), retries without Idempotency-Key

**Execution Sequence:**
1. First request: Timeout at 30s (ai-service may still be processing)
2. Client retries immediately (no Idempotency-Key)
3. Second request: Guards 1-9 pass (no IdempotencyGuard short-circuit)
4. Second request: ai-service call succeeds
5. Second request: Ledger write succeeds
6. **First request may complete after timeout** (orphaned execution)

**Current Behavior:**
- ❌ Two AI executions (first may complete after timeout)
- ✅ One ledger record (second request only)
- ❌ If first request completes, tokens consumed but not billed

**Financial Risk:** **MEDIUM**
- First execution tokens consumed but not billed (if completes)
- Second execution billed correctly

**Consistency Risk:** **MEDIUM**
- Non-deterministic: depends on first request completion timing

**Determinism Impact:** **MEDIUM**
- Client cannot predict if first request will complete

**Recommended Mitigation:**
- **Client-side:** Always use Idempotency-Key for retries
- **Server-side:** Track execution intent (see 3.3)

---

### 3.7 Duplicate Request Under Concurrency (Same User, Same Idempotency-Key)

**Scenario:** Client sends two requests with same Idempotency-Key simultaneously

**Execution Sequence:**
1. Request 1: IdempotencyGuard queries usage_records → not found
2. Request 2: IdempotencyGuard queries usage_records → not found (Request 1 hasn't written yet)
3. Request 1: ai-service succeeds, writes usage_records → INSERT succeeds
4. Request 2: ai-service succeeds, writes usage_records → **UNIQUE VIOLATION (23505)**
5. Request 2: `writeRecord()` catches unique violation, fetches existing record, returns

**Current Behavior:**
- ✅ One AI execution billed (Request 1)
- ✅ Request 2 returns existing record (idempotent retry)
- ❌ Two AI executions occurred (Request 2 called ai-service unnecessarily)

**Financial Risk:** **LOW**
- Only one ledger record (correct billing)
- Second AI execution wasted (tokens consumed at provider, not billed)

**Consistency Risk:** **LOW**
- Both requests return valid results
- Second request returns cached metadata (not original output)

**Determinism Impact:** **LOW**
- Rare scenario (requires exact timing)

**Recommended Mitigation:**
- **Distributed Lock on Idempotency-Key:**
  - Acquire lock on `(user_id, request_id)` before ai-service call
  - Second request blocks until first completes
  - Requires Redis or PostgreSQL advisory lock on composite key

---

### 3.8 Replay When Prior Attempt Partially Failed

**Scenario:** First request times out, client retries with Idempotency-Key, first request completed after timeout

**Execution Sequence:**
1. First request: ai-service call times out (30s)
2. First request: Ledger write never occurs (timeout before write)
3. Client retries with same Idempotency-Key
4. Second request: IdempotencyGuard queries usage_records → not found (first request didn't write)
5. Second request: ai-service call succeeds
6. Second request: Ledger write succeeds
7. **First request may have completed after timeout** (orphaned execution)

**Current Behavior:**
- ❌ Two AI executions (first completed after timeout, second succeeded)
- ✅ One ledger record (second request only)
- ❌ First execution tokens consumed but not billed

**Financial Risk:** **MEDIUM**
- First execution tokens consumed but not billed

**Consistency Risk:** **MEDIUM**
- Idempotency-Key did not prevent double execution (first attempt didn't write record)

**Determinism Impact:** **MEDIUM**
- Client cannot predict if first request completed

**Recommended Mitigation:**
- **Execution Intent Tracking:**
  - Write execution intent BEFORE ai-service call (status: 'pending')
  - IdempotencyGuard checks for 'pending' or 'completed' records
  - If 'pending' found, poll ai-service for result or return 409 Conflict

---

## 4. Transaction Boundary Mapping

### 4.1 Database Transactions

| Operation | Transaction Scope | Isolation Level | Lock Type | Lock Duration |
|-----------|-------------------|-----------------|-----------|---------------|
| **TokenQuotaGuard** | Explicit (`BEGIN...COMMIT`) | Read Committed (default) | Advisory lock (`pg_advisory_xact_lock`) | ~50-100ms |
| **IdempotencyGuard** | Implicit (single SELECT) | Read Committed (default) | None | ~10-20ms |
| **Ledger Write** | Implicit (single INSERT) | Read Committed (default) | Row-level lock (INSERT) | ~10-50ms |

### 4.2 Commit Points

```
Timeline of Commit Points:

T0: Client sends request
  │
T1: TokenQuotaGuard BEGIN
T2: TokenQuotaGuard acquires advisory lock
T3: TokenQuotaGuard queries usage_records (SUM tokens)
T4: TokenQuotaGuard COMMIT ★ COMMIT POINT 1 ★
  │  (Advisory lock released)
  │
T5: ai-service call begins (no transaction)
  │  ... (10-30 seconds) ...
T6: ai-service returns result (no commit, external API)
  │
T7: Ledger write BEGIN (implicit)
T8: Ledger write INSERT INTO usage_records
T9: Ledger write COMMIT ★ COMMIT POINT 2 ★
  │
T10: Client receives response
```

**CRITICAL GAP:** Between T4 (quota commit) and T9 (ledger commit), there is NO transaction. If failure occurs in this window, quota is consumed but ledger is not written.

### 4.3 TOCTOU Exposure

**Time-of-Check to Time-of-Use (TOCTOU) Windows:**

| Window | Check (TOC) | Use (TOU) | Risk | Mitigation |
|--------|-------------|-----------|------|------------|
| **Quota Check → AI Call** | T3: Query SUM(tokens_used) | T5: ai-service call | Another request may write usage_records between T3 and T9 | Advisory lock serializes checks (SAFE) |
| **Idempotency Check → Ledger Write** | IdempotencyGuard SELECT | T8: INSERT | Another request may write same request_id | UNIQUE constraint prevents duplicates (SAFE) |
| **AI Call → Ledger Write** | T6: ai-service returns | T8: INSERT | Failure between T6 and T8 loses execution | NO MITIGATION (CRITICAL RISK) |

**Verdict:**
- ✅ Quota enforcement is TOCTOU-safe (advisory lock)
- ✅ Idempotency is TOCTOU-safe (UNIQUE constraint)
- ❌ AI execution → ledger write is NOT atomic (CRITICAL RISK)

---

## 5. Idempotency Across Services

### 5.1 Idempotency Guarantees (PHASE-43A-2C)

**Scope:** Per user (`user_id` + `request_id`)

**Guarantee:** Same `(userId, requestId)` → same response, no duplicate billing

**Implementation:**
1. IdempotencyGuard queries `usage_records` for existing `(user_id, request_id)`
2. If found: Reconstruct AIExecutionResult from metadata, return immediately
3. If not found: Proceed to ai-service call, write ledger with `request_id`

**Database Constraint:**
```sql
CREATE UNIQUE INDEX idx_usage_records_user_request_id 
ON usage_records (user_id, request_id) 
WHERE request_id IS NOT NULL;
```

### 5.2 Idempotency Failure Modes

**Scenario 1: First Call Times Out, Ledger Never Written**

- Client sends request with `Idempotency-Key: abc-123`
- ai-service times out (30s)
- Ledger write never occurs
- Client retries with `Idempotency-Key: abc-123`
- IdempotencyGuard queries usage_records → **NOT FOUND** (first attempt didn't write)
- Second request proceeds to ai-service call (NEW EXECUTION)

**Verdict:** Idempotency does NOT prevent double execution if first attempt fails before ledger write.

---

**Scenario 2: First Call Succeeds, Ledger Write Fails**

- Client sends request with `Idempotency-Key: abc-123`
- ai-service succeeds
- Ledger write fails (DB error)
- Client receives HTTP 500
- Client retries with `Idempotency-Key: abc-123`
- IdempotencyGuard queries usage_records → **NOT FOUND** (first attempt didn't write)
- Second request proceeds to ai-service call (NEW EXECUTION)

**Verdict:** Idempotency does NOT prevent double execution if first attempt fails at ledger write.

---

**Scenario 3: Concurrent Requests, Same Idempotency-Key**

- Client sends two requests with `Idempotency-Key: abc-123` simultaneously
- Request 1: IdempotencyGuard queries → not found, proceeds
- Request 2: IdempotencyGuard queries → not found (Request 1 hasn't written yet), proceeds
- Request 1: ai-service succeeds, writes ledger → INSERT succeeds
- Request 2: ai-service succeeds, writes ledger → **UNIQUE VIOLATION**
- Request 2: Catches violation, fetches existing record, returns

**Verdict:** Idempotency prevents double billing (only one ledger record), but does NOT prevent double execution (both requests called ai-service).

---

### 5.3 Replay Guarantees

**What Replay Guarantees:**
- ✅ No duplicate ledger write (UNIQUE constraint)
- ✅ No quota consumption (IdempotencyGuard short-circuits before TokenQuotaGuard)
- ✅ Deterministic response (reconstructed from usage_records metadata)

**What Replay Does NOT Guarantee:**
- ❌ Original AI output text (not stored in usage_records, privacy policy)
- ❌ Prevention of double execution if first attempt failed before ledger write
- ❌ Prevention of double execution under concurrent requests (both may call ai-service)

---

### 5.4 Can Replay Mask Corruption?

**Question:** Can idempotent replay return a "success" response when the original execution actually failed?

**Answer:** No. Replay only occurs if a `usage_records` row exists. A row only exists if:
1. ai-service returned success (AIExecutionResult)
2. Ledger write succeeded (INSERT)

If either step fails, no row exists, replay does not occur.

**Verdict:** Replay cannot mask corruption. If replay occurs, original execution succeeded.

---

## 6. Financial Risk Assessment

### 6.1 Risk Classification

| Risk | Severity | Scenario | Financial Impact | Likelihood |
|------|----------|----------|------------------|------------|
| **Network failure after AI success** | CRITICAL | ai-service succeeds, network drops before api-gateway receives response | Tokens consumed, not billed (lost revenue) | Low (network failures rare) |
| **Ledger write failure after AI success** | CRITICAL | ai-service succeeds, database INSERT fails | Tokens consumed, not billed (lost revenue) | Low (DB failures rare) |
| **api-gateway crash after AI success** | CRITICAL | Process crashes after ai-service returns, before ledger write | Tokens consumed, not billed (lost revenue) | Very Low (crashes rare) |
| **Timeout-induced orphaned execution** | MEDIUM | Client timeout fires, ai-service still processing, completes after timeout | Tokens consumed, not billed (if ledger never written) | Medium (depends on AI provider latency) |
| **Concurrent duplicate execution** | LOW | Two requests with same Idempotency-Key call ai-service simultaneously | Second execution wasted (tokens consumed at provider, not billed) | Very Low (requires exact timing) |
| **Idempotency failure (no ledger write)** | MEDIUM | First attempt fails before ledger write, retry creates new execution | Two executions, one billed (first execution tokens lost) | Medium (depends on failure timing) |

### 6.2 Ledger Drift Scenarios

**Ledger Drift:** Mismatch between actual AI provider token consumption and billed tokens in usage_records.

**Causes:**
1. **Undercharging (Lost Revenue):**
   - ai-service succeeds, ledger write fails → tokens consumed, not billed
   - Network failure after AI success → tokens consumed, not billed
   - Timeout-induced orphaned execution → tokens consumed, not billed

2. **Overcharging (Customer Dispute):**
   - None identified (idempotency prevents duplicate billing)

**Verdict:** All identified risks result in undercharging (lost revenue), not overcharging.

### 6.3 Visibility Mismatch

**Visibility Mismatch:** Client sees failure, but execution succeeded (or vice versa).

**Scenarios:**
- Client receives timeout error, but ai-service completed after timeout
- Client receives 500 error (ledger write failed), but ai-service succeeded

**Impact:**
- Client may retry unnecessarily (duplicate execution)
- Client may not retry when they should (lost request)

**Mitigation:**
- Add execution status API (`GET /api/ai/executions/:executionId`)
- Return execution ID in error responses for client to poll

---

## 7. Minimal Safe Fix Patterns

### 7.1 Two-Phase Execution Record (Recommended)

**Problem:** AI execution succeeds but ledger write fails → tokens consumed, not billed.

**Solution:** Write execution intent BEFORE ai-service call, update AFTER success.

**Implementation:**

**Step 1: Add `execution_status` column to `usage_records`**

```sql
ALTER TABLE usage_records 
ADD COLUMN execution_status VARCHAR(20) DEFAULT 'completed';

-- Values: 'pending', 'completed', 'failed', 'timeout'
```

**Step 2: Write execution intent BEFORE ai-service call**

```typescript
// AIExecutionController.execute()

// Write execution intent (status: 'pending')
const executionId = uuidv4();
await this.usageLedgerService.writeExecutionIntent({
  executionId,
  apiKeyId: identity.apiKeyId,
  userId: identity.userId,
  sessionId: request.sessionId,
  conversationId: request.conversationId,
  provider,
  requestId, // Idempotency-Key
  executionStatus: 'pending',
  timestamp: new Date(),
});

// Call ai-service (may fail)
const result = await this.aiServiceHttpClient.execute(verifiedRequest);

// Update execution record (status: 'completed')
await this.usageLedgerService.updateExecutionResult({
  executionId,
  model: result.model,
  tokensUsed: result.tokensUsed,
  executionDurationMs,
  executionStatus: 'completed',
});
```

**Step 3: IdempotencyGuard checks for 'pending' or 'completed' records**

```typescript
// IdempotencyGuard.canActivate()

const existingRecord = await this.usageLedgerService.findByRequestId(
  identity.userId,
  normalized,
);

if (existingRecord) {
  if (existingRecord.executionStatus === 'completed') {
    // Replay: return cached result
    request.idempotentResult = reconstructResult(existingRecord);
    return true;
  } else if (existingRecord.executionStatus === 'pending') {
    // Execution in progress: return 409 Conflict or poll
    throw new HttpException(
      'Execution in progress, retry later',
      HttpStatus.CONFLICT,
    );
  }
}
```

**Step 4: Periodic cleanup of abandoned 'pending' records**

```typescript
// Cron job (every 5 minutes)
// Mark 'pending' records older than 2 minutes as 'timeout'

UPDATE usage_records
SET execution_status = 'timeout'
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '2 minutes';
```

**Pros:**
- ✅ Captures execution intent even if ai-service fails
- ✅ Prevents duplicate execution under concurrent requests (409 Conflict)
- ✅ Enables execution status polling
- ✅ Minimal schema change (one column)

**Cons:**
- ❌ Requires two database writes per execution (intent + result)
- ❌ Requires periodic cleanup of abandoned records

**Verdict:** **RECOMMENDED** for production deployment.

---

### 7.2 Write-Ahead Logging (WAL) for Ledger Writes

**Problem:** Ledger write fails after ai-service success → tokens consumed, not billed.

**Solution:** Write execution result to durable queue (Redis, file) before returning, background worker flushes to database.

**Implementation:**

**Step 1: Write to Redis before returning to client**

```typescript
// AIExecutionController.execute()

const result = await this.aiServiceHttpClient.execute(verifiedRequest);

// Write to Redis (durable queue)
await this.redis.lpush('ledger:pending', JSON.stringify({
  executionId,
  apiKeyId: identity.apiKeyId,
  userId: identity.userId,
  sessionId: request.sessionId,
  conversationId: request.conversationId,
  provider,
  model: result.model,
  tokensUsed: result.tokensUsed,
  executionDurationMs,
  requestId,
  timestamp: new Date(),
}));

// Return result to client (ledger write deferred)
return result;
```

**Step 2: Background worker flushes to database**

```typescript
// Background worker (separate process)

while (true) {
  const record = await this.redis.brpop('ledger:pending', 0);
  const data = JSON.parse(record);
  
  try {
    await this.usageLedgerService.writeRecord(data);
    // Success: record written
  } catch (error) {
    // Retry 3 times, then move to dead-letter queue
    await this.redis.lpush('ledger:failed', JSON.stringify(data));
  }
}
```

**Pros:**
- ✅ Client receives response immediately (no blocking on DB write)
- ✅ Durable queue survives api-gateway crashes
- ✅ Retry logic handles transient DB failures

**Cons:**
- ❌ Adds Redis dependency
- ❌ Eventual consistency (ledger write delayed)
- ❌ Requires background worker process

**Verdict:** **OPTIONAL** for high-throughput deployments.

---

### 7.3 Execution Result Caching (Idempotency Enhancement)

**Problem:** First attempt times out, ledger never written, retry creates new execution.

**Solution:** Cache AIExecutionResult in Redis with TTL, IdempotencyGuard checks cache before calling ai-service.

**Implementation:**

**Step 1: Write to Redis after ai-service success**

```typescript
// AIExecutionController.execute()

const result = await this.aiServiceHttpClient.execute(verifiedRequest);

// Cache result in Redis (TTL: 1 hour)
if (requestId) {
  await this.redis.setex(
    `execution:${identity.userId}:${requestId}`,
    3600, // 1 hour TTL
    JSON.stringify(result),
  );
}

// Write ledger (may fail)
await this.usageLedgerService.writeRecord({ ... });
```

**Step 2: IdempotencyGuard checks cache before database**

```typescript
// IdempotencyGuard.canActivate()

// Check Redis cache first
const cachedResult = await this.redis.get(
  `execution:${identity.userId}:${normalized}`,
);

if (cachedResult) {
  // Replay from cache (even if ledger write failed)
  request.idempotentResult = JSON.parse(cachedResult);
  return true;
}

// Check database (existing logic)
const existingRecord = await this.usageLedgerService.findByRequestId(...);
```

**Pros:**
- ✅ Prevents duplicate execution if first attempt succeeded but ledger write failed
- ✅ Fast replay (Redis lookup faster than database)
- ✅ No schema changes

**Cons:**
- ❌ Adds Redis dependency
- ❌ Cache may expire before ledger write succeeds (TTL management)
- ❌ Cache and database may diverge

**Verdict:** **RECOMMENDED** for retry-heavy workloads.

---

### 7.4 Distributed Lock on Idempotency-Key

**Problem:** Concurrent requests with same Idempotency-Key both call ai-service (wasted execution).

**Solution:** Acquire distributed lock on `(user_id, request_id)` before ai-service call.

**Implementation:**

**Step 1: Acquire lock in IdempotencyGuard**

```typescript
// IdempotencyGuard.canActivate()

const lockKey = `lock:execution:${identity.userId}:${normalized}`;

// Try to acquire lock (NX = only if not exists, EX = TTL)
const acquired = await this.redis.set(lockKey, 'locked', 'NX', 'EX', 60);

if (!acquired) {
  // Another request is processing, return 409 Conflict
  throw new HttpException(
    'Execution in progress, retry later',
    HttpStatus.CONFLICT,
  );
}

// Lock acquired, proceed to ai-service call
```

**Step 2: Release lock after ledger write**

```typescript
// AIExecutionController.execute()

try {
  const result = await this.aiServiceHttpClient.execute(verifiedRequest);
  await this.usageLedgerService.writeRecord({ ... });
  return result;
} finally {
  // Release lock
  await this.redis.del(`lock:execution:${identity.userId}:${requestId}`);
}
```

**Pros:**
- ✅ Prevents concurrent duplicate execution
- ✅ Second request waits or returns 409 Conflict (deterministic)

**Cons:**
- ❌ Adds Redis dependency
- ❌ Lock must be released even on failure (requires `finally` block)
- ❌ Lock TTL must be > max execution time (60s)

**Verdict:** **OPTIONAL** for strict idempotency enforcement.

---

### 7.5 NO FIX REQUIRED?

**Question:** Are the identified risks acceptable for current deployment?

**Analysis:**

**CRITICAL Risks (Network/DB failure after AI success):**
- **Likelihood:** Low (network and DB failures are rare)
- **Impact:** Lost revenue (tokens consumed, not billed)
- **Mitigation:** Two-Phase Execution Record (7.1) or WAL (7.2)

**MEDIUM Risks (Timeout-induced orphaned execution):**
- **Likelihood:** Medium (depends on AI provider latency)
- **Impact:** Lost revenue (first execution tokens not billed)
- **Mitigation:** Execution Result Caching (7.3) or Two-Phase Execution Record (7.1)

**LOW Risks (Concurrent duplicate execution):**
- **Likelihood:** Very Low (requires exact timing)
- **Impact:** Wasted execution (second execution not billed)
- **Mitigation:** Distributed Lock (7.4)

**Verdict:** **FIX REQUIRED** for CRITICAL and MEDIUM risks. Recommend implementing:
1. **Two-Phase Execution Record (7.1)** — Captures execution intent, prevents lost revenue
2. **Execution Result Caching (7.3)** — Prevents duplicate execution on retry after timeout

---

## 8. Verification Plan

### 8.1 Single-Shot PowerShell Tests

#### Test 1: Normal Execution (Happy Path)

```powershell
# Test: Normal execution writes ledger record

$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "verify-normal-001"
}
$body = @{
    sessionId = "11111111-1111-1111-1111-111111111111"
    conversationId = "22222222-2222-2222-2222-222222222222"
    userId = "user-1"
    prompt = "Test normal execution"
    provider = "stub"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method POST -Headers $headers -Body $body

Write-Host "Response: $($response.output)"
Write-Host "Tokens: $($response.tokensUsed)"

# Verify ledger record exists
# Expected: 1 row in usage_records with request_id = 'verify-normal-001'
```

**Expected Result:**
- HTTP 200 OK
- Response contains `output`, `tokensUsed`, `model`
- Database: 1 row in `usage_records` with `request_id = 'verify-normal-001'`

---

#### Test 2: Idempotent Retry (No Duplicate Billing)

```powershell
# Test: Retry with same Idempotency-Key returns cached result, no duplicate ledger write

$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
    "Idempotency-Key" = "verify-idempotent-001"
}
$body = @{
    sessionId = "33333333-3333-3333-3333-333333333333"
    conversationId = "44444444-4444-4444-4444-444444444444"
    userId = "user-1"
    prompt = "Test idempotency"
    provider = "stub"
} | ConvertTo-Json

# First request
$response1 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "First request tokens: $($response1.tokensUsed)"

# Second request (same Idempotency-Key)
$response2 = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/execute" -Method POST -Headers $headers -Body $body
Write-Host "Second request tokens: $($response2.tokensUsed)"
Write-Host "Second request output: $($response2.output)"

# Verify only 1 ledger record exists
# Expected: 1 row in usage_records with request_id = 'verify-idempotent-001'
```

**Expected Result:**
- First request: HTTP 200 OK, normal response
- Second request: HTTP 200 OK, output = "[Duplicate request - original response not stored]"
- Database: 1 row in `usage_records` with `request_id = 'verify-idempotent-001'`

---

#### Test 3: Quota Enforcement (Serialized Per User)

```powershell
# Test: Concurrent requests for same user are serialized by advisory lock

$headers = @{
    "Authorization" = "Bearer test-key-1"
    "Content-Type" = "application/json"
}
$body = @{
    sessionId = "55555555-5555-5555-5555-555555555555"
    conversationId = "66666666-6666-6666-6666-666666666666"
    userId = "user-1"
    prompt = "Test quota serialization"
    provider = "stub"
} | ConvertTo-Json

# Start two requests in parallel
$job1 = Start-Job -ScriptBlock {
    param($uri, $headers, $body)
    Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
} -ArgumentList "http://localhost:3000/api/ai/execute", $headers, $body

$job2 = Start-Job -ScriptBlock {
    param($uri, $headers, $body)
    Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
} -ArgumentList "http://localhost:3000/api/ai/execute", $headers, $body

# Wait for both to complete
$result1 = Receive-Job -Job $job1 -Wait
$result2 = Receive-Job -Job $job2 -Wait

Write-Host "Request 1 tokens: $($result1.tokensUsed)"
Write-Host "Request 2 tokens: $($result2.tokensUsed)"

# Verify both requests succeeded (serialized by advisory lock)
# Expected: 2 rows in usage_records (different execution_id, no request_id)
```

**Expected Result:**
- Both requests: HTTP 200 OK
- Database: 2 rows in `usage_records` (no `request_id`, different `execution_id`)
- Execution times show serialization (second request starts after first completes quota check)

---

### 8.2 Single-Shot SQL Queries

#### Query 1: Verify No Duplicate Execution IDs

```sql
-- Check for duplicate execution_id (should be 0)
SELECT execution_id, COUNT(*) as count
FROM usage_records
GROUP BY execution_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows
```

---

#### Query 2: Verify Idempotency Constraint

```sql
-- Check for duplicate (user_id, request_id) pairs (should be 0)
SELECT user_id, request_id, COUNT(*) as count
FROM usage_records
WHERE request_id IS NOT NULL
GROUP BY user_id, request_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows
```

---

#### Query 3: Verify Advisory Lock Serialization

```sql
-- Run in two concurrent psql sessions to verify advisory lock blocks

-- Session 1:
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:token:user-1'));
SELECT pg_sleep(10); -- Hold lock for 10 seconds
SELECT SUM(tokens_used) FROM usage_records WHERE user_id = 'user-1';
COMMIT;

-- Session 2 (start immediately after Session 1):
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:token:user-1')); -- BLOCKS until Session 1 commits
SELECT SUM(tokens_used) FROM usage_records WHERE user_id = 'user-1';
COMMIT;

-- Expected: Session 2 blocks at pg_advisory_xact_lock() until Session 1 commits
```

---

#### Query 4: Check for Orphaned Executions (If Two-Phase Implemented)

```sql
-- Check for 'pending' executions older than 2 minutes (potential orphans)
SELECT execution_id, user_id, request_id, timestamp, execution_status
FROM usage_records
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '2 minutes'
ORDER BY timestamp DESC
LIMIT 10;

-- Expected: 0 rows (or rows marked as 'timeout' by cleanup job)
```

---

### 8.3 Deterministic Steps (No Loops)

**Verification Checklist:**

1. ✅ Run Test 1 (Normal Execution) → Verify 1 ledger record created
2. ✅ Run Test 2 (Idempotent Retry) → Verify only 1 ledger record (no duplicate)
3. ✅ Run Test 3 (Quota Serialization) → Verify 2 ledger records (concurrent requests serialized)
4. ✅ Run Query 1 → Verify no duplicate `execution_id`
5. ✅ Run Query 2 → Verify no duplicate `(user_id, request_id)` pairs
6. ✅ Run Query 3 → Verify advisory lock blocks concurrent requests for same user
7. ✅ (If Two-Phase implemented) Run Query 4 → Verify no orphaned 'pending' executions

**All steps are single-shot, no loops, deterministic outcomes.**

---

## 9. Conclusion

### 9.1 Current State Summary

**SAFE Components:**
- ✅ Idempotency prevents double-billing (UNIQUE constraint + IdempotencyGuard)
- ✅ Token quota enforcement is TOCTOU-safe (advisory locks)
- ✅ Replay is quota-safe (IdempotencyGuard runs before TokenQuotaGuard)
- ✅ Concurrent requests for same user are serialized (advisory lock per user)

**CRITICAL RISKS:**
- ❌ Network failure after AI success → tokens consumed, not billed (lost revenue)
- ❌ Ledger write failure after AI success → tokens consumed, not billed (lost revenue)
- ❌ api-gateway crash after AI success → tokens consumed, not billed (lost revenue)

**MEDIUM RISKS:**
- ⚠️ Timeout-induced orphaned execution → first execution tokens not billed
- ⚠️ Idempotency failure (no ledger write) → retry creates new execution

**LOW RISKS:**
- ⚠️ Concurrent duplicate execution → second execution wasted (not billed)

### 9.2 Recommended Actions

**Priority 1: CRITICAL (Immediate Action Required)**

**Issue:** AI execution succeeds but ledger write fails → tokens consumed, not billed.

**Action:** Implement **Two-Phase Execution Record** (Section 7.1)
1. Add `execution_status` column to `usage_records` (values: 'pending', 'completed', 'failed', 'timeout')
2. Write execution intent BEFORE ai-service call (status: 'pending')
3. Update execution record AFTER ai-service success (status: 'completed')
4. IdempotencyGuard checks for 'pending' or 'completed' records
5. Periodic cleanup of abandoned 'pending' records (mark as 'timeout')

**Timeline:** PHASE-43B-2 (implementation)

---

**Priority 2: MEDIUM (Recommended)**

**Issue:** Timeout-induced orphaned execution → first execution tokens not billed.

**Action:** Implement **Execution Result Caching** (Section 7.3)
1. Cache AIExecutionResult in Redis after ai-service success (TTL: 1 hour)
2. IdempotencyGuard checks Redis cache before database
3. If cached result found, return immediately (even if ledger write failed)

**Timeline:** PHASE-43B-3 (optional enhancement)

---

**Priority 3: LOW (Optional)**

**Issue:** Concurrent requests with same Idempotency-Key both call ai-service (wasted execution).

**Action:** Implement **Distributed Lock on Idempotency-Key** (Section 7.4)
1. Acquire Redis lock on `(user_id, request_id)` before ai-service call
2. Second request returns 409 Conflict or waits
3. Release lock after ledger write (in `finally` block)

**Timeline:** PHASE-43B-4 (optional optimization)

---

### 9.3 Financial Risk Summary

**Current Exposure:**
- **Lost Revenue Risk:** CRITICAL (network/DB failure after AI success)
- **Double-Billing Risk:** NONE (idempotency prevents)
- **Overcharging Risk:** NONE (success-only recording)

**Mitigation Impact:**
- Two-Phase Execution Record → Reduces lost revenue risk to NEAR-ZERO
- Execution Result Caching → Reduces duplicate execution risk to LOW
- Distributed Lock → Eliminates concurrent duplicate execution

**Verdict:** Implement Priority 1 (Two-Phase Execution Record) before production deployment.

---

**Document Status:** FINAL  
**Next Stage:** PHASE-43B-2 (Implementation of Two-Phase Execution Record)  
**Approval Required:** Yes (before proceeding to implementation)

---

**END OF DOCUMENT**
