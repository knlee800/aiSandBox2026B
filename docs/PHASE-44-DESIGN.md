# PHASE-44 DESIGN — Async AI Execution Pipeline

---

## Status: DESIGN APPROVED

**Phase:** 44  
**Nature:** Architectural Design  
**Date:** 2026-03-04

---

## 1. Goals and Non-Goals

### Goals

1. **Non-blocking API** — API Gateway returns `202 Accepted` immediately after job submission
2. **Queue-based execution** — AI execution occurs asynchronously via queue workers
3. **Isolated container runtime** — Execution happens inside container-manager
4. **Deterministic accounting** — Preserve Phase-43 ledger guarantees (exactly one final ledger record per `(userId, requestId)`)
5. **Idempotent execution** — Duplicate queue deliveries must not cause double execution
6. **Status polling** — Clients can poll execution status via dedicated endpoint

### Non-Goals

1. **WebSocket notifications** — Clients must poll (no push notifications)
2. **Distributed queue** — Single-node Redis queue (no clustering)
3. **Priority queues** — FIFO only (no priority levels)
4. **Background cleanup workers** — Execution-driven only (no cron jobs)
5. **Multi-tenant isolation** — Single-tenant focus (multi-tenant deferred)
6. **Horizontal scaling** — Single worker process (scaling deferred)

---

## 2. System Architecture Overview

### 2.1 High-Level Flow

```
Client Request
    ↓
API Gateway (POST /ai/execute)
    ↓
[Guards: Auth, Safety, Quota, etc.]
    ↓
Write Intent to Ledger (status='pending')
    ↓
Submit Job to Redis Queue
    ↓
Return HTTP 202 Accepted { executionId, status: 'pending' }
    ↓
[Client polls GET /ai/executions/:executionId]

---

AI Service Worker (background)
    ↓
Consume Job from Redis Queue
    ↓
Call AI Provider (OpenAI, Anthropic, etc.)
    ↓
Send Result to Container Manager
    ↓
Container Manager Executes Code
    ↓
Container Manager Returns Result
    ↓
AI Service Worker Updates Ledger (status='completed')
```

### 2.2 Service Responsibilities

| Service | Responsibility |
|---------|----------------|
| **api-gateway** | Job submission, status polling, ledger writes |
| **redis** | Job queue storage |
| **ai-service** | Queue worker, AI provider calls, container orchestration |
| **container-manager** | Code execution inside isolated containers |
| **postgres** | Ledger storage (authoritative source) |

---

## 3. Component Responsibilities

### 3.1 API Gateway

**Owns:**
- Job submission endpoint (`POST /ai/execute`)
- Status polling endpoint (`GET /ai/executions/:executionId`)
- Ledger intent writes (before queue submission)
- Ledger result updates (via internal callback from ai-service)
- Guard execution (auth, quota, safety, idempotency)

**Does NOT own:**
- Queue consumption
- AI provider calls
- Container execution

**Key Invariants:**
- Intent MUST be written to ledger BEFORE queue submission
- Duplicate `requestId` MUST return existing execution status (idempotent submission)
- Status endpoint MUST return current ledger state (no queue inspection)

---

### 3.2 AI Service Worker

**Owns:**
- Queue consumption (Redis)
- AI provider HTTP calls
- Container-manager orchestration
- Ledger result updates (via api-gateway internal endpoint)
- Retry logic (on transient failures)
- Dead-letter queue handling (on permanent failures)

**Does NOT own:**
- Ledger writes (delegates to api-gateway)
- Client authentication
- Quota enforcement (already enforced at submission time)

**Key Invariants:**
- Worker MUST be idempotent (duplicate queue deliveries must not cause double execution)
- Worker MUST update ledger exactly once per job
- Worker MUST handle container-manager failures gracefully

---

### 3.3 Container Manager

**Owns:**
- Docker container lifecycle
- Code execution inside containers
- Resource limits (CPU, memory, PID)
- Execution output capture

**Does NOT own:**
- Queue management
- Ledger writes
- AI provider calls

**Key Invariants:**
- Execution MUST occur inside isolated container
- Execution MUST respect resource limits
- Execution MUST return deterministic output (stdout, stderr, exit code)

---

### 3.4 Queue Infrastructure (Redis)

**Owns:**
- Job queue storage
- Job delivery guarantees
- Dead-letter queue storage

**Does NOT own:**
- Job execution logic
- Ledger state
- Retry policy (handled by worker)

**Key Invariants:**
- Jobs MUST be delivered at-least-once (duplicate deliveries possible)
- Jobs MUST be removed from queue after successful processing
- Failed jobs MUST be moved to dead-letter queue after max retries

---

### 3.5 Database Ledger (Postgres)

**Owns:**
- Execution intent records (status='pending')
- Execution result records (status='completed', 'failed', 'timeout')
- Unique constraint enforcement on `(userId, requestId)`

**Does NOT own:**
- Queue state
- Worker state

**Key Invariants:**
- Exactly ONE ledger record per `(userId, requestId)` (Phase-43 guarantee)
- Intent MUST be written BEFORE queue submission
- Result MUST be written AFTER execution completes

---

## 4. Async API Contract

### 4.1 Job Submission Endpoint

**Endpoint:** `POST /api/ai/execute`

**Request Headers:**
```
Authorization: Bearer <JWT>
Idempotency-Key: <requestId> (optional)
```

**Request Body:**
```json
{
  "sessionId": "uuid",
  "conversationId": "uuid",
  "provider": "openai" | "anthropic" | "groq",
  "prompt": "string",
  "model": "string (optional)"
}
```

**Response (202 Accepted):**
```json
{
  "executionId": "uuid",
  "requestId": "string",
  "status": "pending",
  "submittedAt": "ISO8601 timestamp"
}
```

**Idempotency Behavior:**
- If `Idempotency-Key` matches existing `requestId`:
  - If status='completed': Return `200 OK` with cached result (Phase-43 replay)
  - If status='pending': Return `202 Accepted` with existing executionId
  - If status='timeout' or 'failed': Allow retry (reuse existing row)

**Error Responses:**
- `401 Unauthorized` — Invalid JWT
- `403 Forbidden` — Insufficient quota
- `429 Too Many Requests` — Rate limit exceeded
- `410 Gone` — Session terminated

---

### 4.2 Status Polling Endpoint

**Endpoint:** `GET /api/ai/executions/:executionId`

**Request Headers:**
```
Authorization: Bearer <JWT>
```

**Response (200 OK) — Pending:**
```json
{
  "executionId": "uuid",
  "requestId": "string",
  "status": "pending",
  "submittedAt": "ISO8601 timestamp"
}
```

**Response (200 OK) — Completed:**
```json
{
  "executionId": "uuid",
  "requestId": "string",
  "status": "completed",
  "submittedAt": "ISO8601 timestamp",
  "completedAt": "ISO8601 timestamp",
  "result": {
    "output": "string",
    "tokensUsed": 123,
    "model": "gpt-4"
  }
}
```

**Response (200 OK) — Failed:**
```json
{
  "executionId": "uuid",
  "requestId": "string",
  "status": "failed",
  "submittedAt": "ISO8601 timestamp",
  "failedAt": "ISO8601 timestamp",
  "error": {
    "code": "PROVIDER_ERROR",
    "message": "AI provider returned 500"
  }
}
```

**Response (200 OK) — Timeout:**
```json
{
  "executionId": "uuid",
  "requestId": "string",
  "status": "timeout",
  "submittedAt": "ISO8601 timestamp",
  "timeoutAt": "ISO8601 timestamp"
}
```

**Error Responses:**
- `401 Unauthorized` — Invalid JWT
- `403 Forbidden` — Not owner of execution
- `404 Not Found` — Execution does not exist

---

## 5. Job Queue Schema

### 5.1 Queue Structure

**Queue Name:** `ai-execution-jobs`

**Job Payload:**
```json
{
  "executionId": "uuid",
  "userId": "string",
  "apiKeyId": "string",
  "sessionId": "uuid",
  "conversationId": "uuid",
  "provider": "openai" | "anthropic" | "groq",
  "adapter": "openai" | "anthropic" | "groq",
  "prompt": "string",
  "model": "string (optional)",
  "requestId": "string (optional)",
  "submittedAt": "ISO8601 timestamp"
}
```

**Queue Options:**
- **Delivery:** At-least-once (duplicate deliveries possible)
- **Ordering:** FIFO (first-in, first-out)
- **Retention:** Remove after successful processing
- **Max Retries:** 3 attempts
- **Retry Delay:** Exponential backoff (1s, 2s, 4s)
- **Dead-Letter Queue:** `ai-execution-jobs-dlq`

---

### 5.2 Dead-Letter Queue

**Queue Name:** `ai-execution-jobs-dlq`

**Purpose:** Store jobs that failed after max retries

**Handling:**
- Jobs in DLQ are NOT automatically retried
- Admin script can inspect and manually retry
- Ledger status is set to `failed` when moved to DLQ

---

## 6. Ledger State Machine

### 6.1 Execution States

```
pending → completed
pending → failed
pending → timeout
timeout → pending (retry)
failed → pending (retry)
```

### 6.2 State Transitions

| From State | To State | Trigger | Actor |
|------------|----------|---------|-------|
| (none) | `pending` | Job submission | api-gateway |
| `pending` | `completed` | Execution success | ai-service worker |
| `pending` | `failed` | Execution failure (after retries) | ai-service worker |
| `pending` | `timeout` | Orphan detection (age > 5min) | api-gateway (on retry) |
| `timeout` | `pending` | Manual retry | api-gateway (on resubmit) |
| `failed` | `pending` | Manual retry | api-gateway (on resubmit) |

### 6.3 State Invariants

| Invariant | Description |
|-----------|-------------|
| **Single record** | Exactly ONE row per `(userId, requestId)` |
| **Intent before execution** | `pending` record MUST exist before queue submission |
| **Result after execution** | `completed`/`failed` record MUST exist after execution |
| **No resurrection** | `completed` records CANNOT transition to any other state |
| **Idempotent updates** | Multiple updates to same executionId MUST be safe |

---

## 7. Atomic State Transitions

### 7.1 Job Submission (api-gateway)

**Atomicity Guarantee:** Intent write + queue submission must be atomic

**Implementation:**
```typescript
// Step 1: Write intent to ledger (status='pending')
const executionId = await usageLedgerService.writeExecutionIntent({
  executionId: uuidv4(),
  userId,
  apiKeyId,
  sessionId,
  conversationId,
  provider,
  adapter: provider,
  requestId,
  metadata: { prompt, model },
});

// Step 2: Submit job to queue
await queueService.submitJob({
  executionId,
  userId,
  apiKeyId,
  sessionId,
  conversationId,
  provider,
  adapter: provider,
  prompt,
  model,
  requestId,
  submittedAt: new Date().toISOString(),
});

// Step 3: Return 202 Accepted
return { executionId, requestId, status: 'pending', submittedAt };
```

**Failure Handling:**
- If Step 1 fails: Return 500 (no queue submission)
- If Step 2 fails: Ledger record remains `pending` (orphan detection will handle)
- If Step 3 fails: Job is queued, client can poll status endpoint

---

### 7.2 Job Execution (ai-service worker)

**Atomicity Guarantee:** Execution + ledger update must be atomic

**Implementation:**
```typescript
// Step 1: Consume job from queue
const job = await queueService.consumeJob();

// Step 2: Check if already completed (idempotency)
const existingRecord = await apiGatewayClient.getExecutionStatus(job.executionId);
if (existingRecord.status === 'completed') {
  // Already processed (duplicate delivery)
  await queueService.ackJob(job.id);
  return;
}

// Step 3: Call AI provider
const aiResult = await aiProviderClient.execute({
  provider: job.provider,
  prompt: job.prompt,
  model: job.model,
});

// Step 4: Call container-manager
const containerResult = await containerManagerClient.execute({
  sessionId: job.sessionId,
  code: aiResult.output,
});

// Step 5: Update ledger (via api-gateway internal endpoint)
await apiGatewayClient.updateExecutionResult({
  executionId: job.executionId,
  status: 'completed',
  output: containerResult.output,
  tokensUsed: aiResult.tokensUsed,
  model: aiResult.model,
  executionDurationMs: Date.now() - job.submittedAt,
});

// Step 6: Acknowledge job (remove from queue)
await queueService.ackJob(job.id);
```

**Failure Handling:**
- If Step 2 fails: Retry (transient failure)
- If Step 3 fails: Retry up to 3 times, then move to DLQ and set status='failed'
- If Step 4 fails: Retry up to 3 times, then move to DLQ and set status='failed'
- If Step 5 fails: Retry (critical - ledger update must succeed)
- If Step 6 fails: Job will be redelivered (idempotency check in Step 2 prevents double execution)

---

## 8. Execution Sequence Diagram

```
Client                API Gateway           Redis Queue         AI Service Worker    Container Manager    Postgres Ledger
  │                        │                      │                      │                     │                    │
  │  POST /ai/execute      │                      │                      │                     │                    │
  ├───────────────────────>│                      │                      │                     │                    │
  │                        │                      │                      │                     │                    │
  │                        │  Write Intent        │                      │                     │                    │
  │                        │  (status='pending')  │                      │                     │                    │
  │                        ├─────────────────────────────────────────────────────────────────────────────────────>│
  │                        │                      │                      │                     │                    │
  │                        │  Submit Job          │                      │                     │                    │
  │                        ├─────────────────────>│                      │                     │                    │
  │                        │                      │                      │                     │                    │
  │  202 Accepted          │                      │                      │                     │                    │
  │  { executionId }       │                      │                      │                     │                    │
  │<───────────────────────┤                      │                      │                     │                    │
  │                        │                      │                      │                     │                    │
  │                        │                      │  Consume Job         │                     │                    │
  │                        │                      ├─────────────────────>│                     │                    │
  │                        │                      │                      │                     │                    │
  │                        │                      │                      │  Check Status       │                    │
  │                        │                      │                      │  (idempotency)      │                    │
  │                        │<──────────────────────────────────────────────────────────────────────────────────────┤
  │                        │                      │                      │                     │                    │
  │                        │                      │                      │  Call AI Provider   │                    │
  │                        │                      │                      ├────────────────────>│                    │
  │                        │                      │                      │  (OpenAI, etc.)     │                    │
  │                        │                      │                      │<────────────────────┤                    │
  │                        │                      │                      │                     │                    │
  │                        │                      │                      │  Execute Code       │                    │
  │                        │                      │                      ├────────────────────────────────────────>│
  │                        │                      │                      │                     │                    │
  │                        │                      │                      │  Return Result      │                    │
  │                        │                      │                      │<────────────────────────────────────────┤
  │                        │                      │                      │                     │                    │
  │                        │  Update Result       │                      │                     │                    │
  │                        │  (status='completed')│                      │                     │                    │
  │                        │<──────────────────────────────────────────────────────────────────────────────────────┤
  │                        │                      │                      │                     │                    │
  │                        │                      │  Ack Job             │                     │                    │
  │                        │                      │<─────────────────────┤                     │                    │
  │                        │                      │                      │                     │                    │
  │  GET /ai/executions/:id│                      │                      │                     │                    │
  ├───────────────────────>│                      │                      │                     │                    │
  │                        │                      │                      │                     │                    │
  │                        │  Read Status         │                      │                     │                    │
  │                        ├─────────────────────────────────────────────────────────────────────────────────────>│
  │                        │                      │                      │                     │                    │
  │  200 OK                │                      │                      │                     │                    │
  │  { status: 'completed' }│                     │                      │                     │                    │
  │<───────────────────────┤                      │                      │                     │                    │
```

---

## 9. Container Execution Contract

### 9.1 Container Manager API

**Endpoint:** `POST /api/internal/containers/:sessionId/execute`

**Request Body:**
```json
{
  "code": "string",
  "language": "python" | "javascript" | "bash",
  "timeout": 30000
}
```

**Response (200 OK):**
```json
{
  "stdout": "string",
  "stderr": "string",
  "exitCode": 0,
  "executionTimeMs": 1234
}
```

**Error Responses:**
- `404 Not Found` — Session does not exist
- `410 Gone` — Session terminated
- `429 Too Many Requests` — Concurrency limit exceeded
- `500 Internal Server Error` — Container execution failed

---

### 9.2 Container Isolation

**Resource Limits:**
- CPU: 1 core (configurable)
- Memory: 512MB (configurable)
- PID: 100 processes (configurable)
- Disk: 1GB (configurable)

**Network Isolation:**
- No outbound internet access (default)
- Configurable allow-list for external APIs

**Filesystem Isolation:**
- Only `/workspace` is writable
- No host mounts
- Ephemeral storage (destroyed after session ends)

---

## 10. Failure Handling

### 10.1 Transient Failures

**Definition:** Temporary failures that may succeed on retry

**Examples:**
- AI provider rate limit (429)
- Container manager timeout (504)
- Network errors (ECONNRESET)

**Handling:**
- Retry up to 3 times with exponential backoff
- If all retries fail, move to DLQ and set status='failed'

---

### 10.2 Permanent Failures

**Definition:** Failures that will not succeed on retry

**Examples:**
- AI provider authentication failure (401)
- Invalid prompt format (400)
- Session terminated (410)

**Handling:**
- Do NOT retry
- Move to DLQ immediately
- Set status='failed' with error details

---

### 10.3 Orphan Detection

**Definition:** Jobs stuck in `pending` state due to worker crash

**Detection:**
- Phase-43 orphan detection (age > 5 minutes)
- Transition to `timeout` state
- Allow manual retry via resubmission

**Prevention:**
- Worker heartbeat logging (not enforced)
- Idempotency checks prevent double execution

---

### 10.4 Dead-Letter Queue Handling

**Purpose:** Store jobs that failed after max retries

**Admin Script:**
```bash
npm run admin:inspect-dlq
npm run admin:retry-dlq-job <jobId>
npm run admin:purge-dlq
```

**Monitoring:**
- Alert if DLQ size > 10 jobs
- Alert if DLQ growth rate > 5 jobs/hour

---

## 11. Security and Isolation Rules

### 11.1 Queue Security

**Authentication:**
- Redis connection requires password (configured via env)
- No public access to Redis port

**Authorization:**
- Workers authenticate via internal API key (not implemented in Phase-44)
- API Gateway does NOT expose queue endpoints

---

### 11.2 Container Security

**Isolation:**
- Each session runs in isolated Docker container
- No shared state between sessions
- No access to host filesystem

**Resource Limits:**
- CPU, memory, PID limits enforced via cgroups
- Execution timeout enforced (default 30s)

**Network Security:**
- No outbound internet access (default)
- Allow-list for external APIs (configurable)

---

### 11.3 Ledger Security

**Access Control:**
- Only api-gateway can write to ledger
- Workers update ledger via internal api-gateway endpoint
- Clients can only read their own execution status

**Data Integrity:**
- Unique constraint on `(userId, requestId)` prevents duplicates
- Immutable `completed` records (no updates after completion)

---

## 12. Explicit System Invariants

### 12.1 Phase-43 Guarantees (LOCKED)

These invariants from Phase-43 MUST be preserved:

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| **Deterministic replay** | Same `requestId` → same response | Idempotency check before queue submission |
| **Financial safety** | No double billing | Single ledger record per `(userId, requestId)` |
| **Idempotent execution** | Duplicate deliveries → no double execution | Worker checks ledger before execution |
| **Ledger integrity** | Exactly one final record per request | Unique constraint + atomic updates |

---

### 12.2 Phase-44 Guarantees (NEW)

These invariants are introduced in Phase-44:

| Invariant | Description | Enforcement |
|-----------|-------------|-------------|
| **Non-blocking API** | API returns within 100ms | Queue submission is fast |
| **At-least-once delivery** | Jobs are delivered at least once | Redis queue guarantees |
| **Idempotent worker** | Duplicate deliveries are safe | Worker checks ledger before execution |
| **Status consistency** | Status endpoint reflects ledger state | Read from ledger (not queue) |
| **Orphan reconciliation** | Stuck jobs transition to `timeout` | Phase-43 orphan detection (age > 5min) |
| **DLQ isolation** | Failed jobs do not block queue | Separate DLQ for failed jobs |

---

## 13. Implementation Notes

### 13.1 Queue Library

**Recommended:** BullMQ (Redis-based queue for Node.js)

**Rationale:**
- Native TypeScript support
- Built-in retry logic
- Dead-letter queue support
- Active maintenance

**Alternative:** Bull (older, but stable)

---

### 13.2 Redis Deployment

**Development:** Docker container (via docker-compose.yml)

**Production:** Managed Redis (AWS ElastiCache, Redis Cloud, etc.)

**Configuration:**
```yaml
redis:
  image: redis:7-alpine
  container_name: aisandbox-redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --requirepass ${REDIS_PASSWORD}
  networks:
    - aisandbox-network
```

---

### 13.3 Worker Deployment

**Development:** Single worker process (via `npm run worker`)

**Production:** Multiple worker processes (via PM2, Kubernetes, etc.)

**Scaling:** Horizontal (add more worker processes)

---

### 13.4 Monitoring

**Metrics:**
- Queue depth (jobs pending)
- Job processing rate (jobs/second)
- Job failure rate (failures/total)
- DLQ size (jobs in DLQ)
- Execution duration (p50, p95, p99)

**Alerts:**
- Queue depth > 100 jobs
- DLQ size > 10 jobs
- Job failure rate > 5%
- Execution duration p99 > 60s

---

## 14. Migration Path

### 14.1 Backward Compatibility

**Sync Endpoint (Phase-43):** `POST /api/ai/execute` (synchronous)

**Async Endpoint (Phase-44):** `POST /api/ai/execute` (asynchronous)

**Migration Strategy:**
- Phase-44 replaces synchronous execution with async
- Clients MUST update to poll status endpoint
- No backward compatibility for synchronous behavior

**Deprecation Notice:**
- Phase-43 synchronous execution is DEPRECATED
- Clients MUST migrate to async pattern by Phase-45

---

### 14.2 Rollback Plan

If Phase-44 deployment fails:

1. Disable worker process
2. Revert api-gateway to Phase-43 synchronous execution
3. Drain Redis queue (process remaining jobs)
4. Investigate root cause

**Rollback Risk:** LOW (ledger state is preserved)

---

## 15. Testing Strategy

### 15.1 Unit Tests

**Coverage:**
- Queue service (submit, consume, ack, nack)
- Worker idempotency logic
- Ledger state transitions
- Status endpoint logic

---

### 15.2 Integration Tests

**Coverage:**
- End-to-end job submission → execution → status polling
- Idempotency (duplicate submissions)
- Retry logic (transient failures)
- DLQ handling (permanent failures)
- Orphan detection (stuck jobs)

---

### 15.3 Load Tests

**Scenarios:**
- 100 concurrent job submissions
- 1000 jobs in queue
- Worker crash during execution
- Redis restart during execution

---

## 16. Governance Trace

- **PRD:** Section 3E (AI Integration), Section 5 (Governance Model)
- **ARCHITECTURE:** Section 2 (Determinism, Idempotency), Section 3 (Service Architecture)
- **CLAUDE.md:** Governance Loop, Internal API Rules
- **Phase-43:** Deterministic replay, two-phase ledger, orphan reconciliation (LOCKED)
- **Phase-44:** Async execution pipeline (this document)

---

## 17. Summary

Phase-44 introduces an **async AI execution pipeline** that:

1. Returns `202 Accepted` immediately (non-blocking API)
2. Queues jobs in Redis for background processing
3. Executes AI calls and container code asynchronously
4. Preserves Phase-43 ledger guarantees (deterministic replay, financial safety)
5. Provides status polling endpoint for clients
6. Handles failures gracefully (retries, DLQ, orphan detection)

**Key Design Principles:**
- **Idempotency:** Duplicate submissions and deliveries are safe
- **Atomicity:** Intent write + queue submission are atomic
- **Determinism:** Same `requestId` → same response (Phase-43 guarantee)
- **Isolation:** Execution occurs in isolated containers (Phase-43 guarantee)

**Next Steps:** Implement tasks in PHASE-44-TASKS.md

---

**PHASE-44 DESIGN COMPLETE**

**Date:** 2026-03-04  
**Status:** APPROVED FOR IMPLEMENTATION
