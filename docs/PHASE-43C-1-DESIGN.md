# PHASE-43C-1-DESIGN.md
## Execution Observability & Integrity Telemetry — Design

**Phase:** PHASE-43C  
**Stage:** STAGE-43C-1  
**Nature:** DESIGN ONLY (no code changes)  
**Scope:** api-gateway ONLY  
**Date:** 2026-02-27  
**Source Task:** Active Task — Execution Observability & Integrity Telemetry Design

---

## ULTRA-BRIEF SUMMARY (≤5 bullets)

1. **Log-only first** — all telemetry is structured JSON logs (no new tables, no Prometheus, no migrations); zero breaking changes
2. **Seven event names, all stable** — `execution.intent_written`, `execution.ai_success`, `execution.ai_failure`, `execution.result_updated`, `execution.result_update_failed`, `idempotency.replay`, `idempotency.orphan_transitioned` — added as log lines to existing hook points
3. **Five alertable conditions** — orphan accumulation, pending age spike, result-update failures, replay-fallback placeholder responses, and ai-success-but-ledger-incomplete — detectable entirely from logs + SQL
4. **Instrument four files only** — `idempotency.guard.ts`, `ai-execution.controller.ts`, `usage-ledger.service.ts` (three methods), no other files touched
5. **Verification is single-shot PowerShell + SQL** — deterministic scripts exercise each event path; no loops, no manual intervention

---

## 1. What We Need to Observe (Definitions)

### 1.1 Execution Lifecycle Counts by Status

**Definition:** The count of `usage_records` rows grouped by `execution_status` at any point in time.

| Status | Meaning | Expected normal state |
|---|---|---|
| `pending` | Intent written; AI call not yet complete | Transient; should not accumulate |
| `completed` | Two-phase write succeeded; AI result recorded | Dominant stable state |
| `timeout` | Orphan transition applied (pending > 5 min) | Should be very low; spikes indicate crashes |
| `failed` | Reserved for explicit failure recording (future) | Zero in current implementation |

**Why:** Provides a baseline health signal. A growing `pending` count or a spike in `timeout` count indicates execution pipeline degradation without requiring any runtime instrumentation.

---

### 1.2 Orphan Rate

**Definition:** The rate at which `pending` records cross the 5-minute orphan threshold without being transitioned by normal completion.

**Operationally detected two ways:**
- **Proactive (SQL):** `COUNT(*) WHERE execution_status = 'pending' AND timestamp < NOW() - INTERVAL '5 minutes'`
- **Reactive (log):** Occurrence of event `idempotency.orphan_transitioned` in structured logs (emitted by `IdempotencyGuard` at lazy reconciliation time)

**Orphan threshold:** 5 minutes (300 seconds) — matches `ORPHAN_TIMEOUT_MS` in `idempotency.guard.ts` (line 177).

**Why:** Orphans indicate execution crashes or timeouts; a non-zero orphan count requires investigation.

---

### 1.3 Replay Rate (Idempotency-Key Replays Returning Cached Result)

**Definition:** The count of requests where `IdempotencyGuard` found a `completed` record and threw `IdempotentReplayException`, returning the cached result without invoking quota, AI provider, or ledger.

**Operationally detected:** Count of `idempotency.replay` log events (with `outcome: "cache_hit"`).

**Why:** High replay rate is expected under normal retry behavior. An unexpected spike may indicate a malfunctioning client or a stuck idempotency key. Abnormal replay with `outcome: "fallback_placeholder"` (metadata missing) is actionable.

---

### 1.4 Retry-After-Timeout Rate

**Definition:** The count of executions following this path: `pending` → orphan transition to `timeout` → `reuseExecutionIntent()` → new `pending` → `completed`. This is a "timeout-then-reuse" pattern.

**Operationally detected:** Log events pairing `idempotency.orphan_transitioned` with a subsequent `execution.intent_written` carrying `flow: "reuse"` for the same `requestId`.

**Why:** Distinguishes healthy client retry behavior (expected after crashes) from pathological retry loops (repeated orphan → timeout cycles for the same `requestId`).

---

### 1.5 Quota Bypass Replay Events (Informational)

**Definition:** A subset of the replay rate — specifically replays that short-circuited BEFORE `TokenQuotaGuard` ran, meaning zero quota was consumed for the response.

**Operationally detected:** All `idempotency.replay` events are quota-bypassing by definition (guard order is IdempotencyGuard → QuotaGuard → TokenQuotaGuard per `ai-execution.controller.ts` line 121). Log field `quota_bypassed: true` makes this explicit.

**Why:** Informational audit — confirms that replay semantics are preserving the quota-bypass invariant from PHASE-43B-2-HOTFIX. Not an alert; a monitoring counter.

---

### 1.6 Ledger Write Failures vs. AI-Service Failures

**Definition:** Two distinct failure classes:

| Class | What happened | Billing impact |
|---|---|---|
| **AI-service failure** | `aiServiceHttpClient.execute()` threw an error; `pending` record remains unupdated | No tokens consumed (AI provider never responded successfully) |
| **Ledger write failure** | AI-service succeeded but `updateExecutionResult()` threw | Tokens consumed; ledger NOT updated → revenue leakage risk |

**Operationally detected:**
- AI failure: `execution.ai_failure` log event; `pending` record left as-is (becomes orphan after 5 min)
- Ledger write failure: `execution.result_update_failed` log event; `completed` AI call with no matching `completed` record

**Why:** These two failure classes have opposite billing risk profiles. Distinguishing them is essential for incident triage.

---

## 2. Where to Instrument (Hook Points in api-gateway)

All instrumentation is **additive only** — structured log calls (`this.logger.log(JSON.stringify({...}))`) inserted at existing decision points. No new methods, no refactors, no new files.

---

### 2.1 `IdempotencyGuard.canActivate()`
**File:** `services/api-gateway/src/ai/idempotency.guard.ts`

| Hook Point | Line Reference | Event Name | Trigger |
|---|---|---|---|
| `completed` record found → throw `IdempotentReplayException` | ~line 173 | `idempotency.replay` | Emit before throw; log `outcome: "cache_hit"` or `outcome: "fallback_placeholder"` based on whether `metadata.aiExecutionResult` was present |
| `pending` record age > `ORPHAN_TIMEOUT_MS` → `transitionOrphanToTimeout()` call | ~line 181 | `idempotency.orphan_transitioned` | Emit after transition call; log `pendingAgeMs`, `executionId` |
| `pending` record age ≤ `ORPHAN_TIMEOUT_MS` → 409 thrown | ~line 191 | `idempotency.conflict_pending` | Emit before throw; log `pendingAgeMs`, `executionId` (informational) |
| `timeout` or `failed` record found → allow retry passthrough | ~line 206 | `idempotency.retry_allowed` | Emit when guard passes through on retryable status; log `priorStatus` |

---

### 2.2 `AIExecutionController.execute()`
**File:** `services/api-gateway/src/ai/ai-execution.controller.ts`

| Hook Point | Line Reference | Event Name | Trigger |
|---|---|---|---|
| After `writeExecutionIntent()` or `reuseExecutionIntent()` succeeds | ~line 191–223 | `execution.intent_written` | Log `executionId`, `flow` (`new` or `reuse`), `requestId` (if present) |
| After `aiServiceHttpClient.execute()` returns successfully | ~line 238 | `execution.ai_success` | Log `executionId`, `provider`, `model`, `tokensUsed`, `durationMs` |
| If `aiServiceHttpClient.execute()` throws (catch around line 238) | ~line 238 | `execution.ai_failure` | Log `executionId`, `errorClass`, `errorMessage`; record remains `pending` |
| After `updateExecutionResult()` succeeds | ~line 248–255 | `execution.result_updated` | Log `executionId`, `tokensUsed`, `model`, `durationMs`, `status: "completed"` |
| If `updateExecutionResult()` throws (catch around line 248) | ~line 248–255 | `execution.result_update_failed` | Log `executionId`, `errorMessage`; **CRITICAL** — AI succeeded but ledger incomplete |

> **Note on current controller structure:** The controller does not currently have a try/catch around the `aiServiceHttpClient.execute()` call or the `updateExecutionResult()` call. To instrument failure paths without changing behavior, a minimal try/catch/rethrow wrapper is acceptable (log + rethrow — zero semantic change). This is the only structural addition permitted.

---

### 2.3 `UsageLedgerService` — Three Methods
**File:** `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`

| Method | Hook Point | Event Name | Notes |
|---|---|---|---|
| `writeExecutionIntent()` | Existing `logger.log` at line 141 | Enhance with structured JSON | Add `event: "execution.intent_written"`, `executionId`, `userId`, `requestId`, `status: "pending"` |
| `reuseExecutionIntent()` | Existing `logger.log` at line 511 | Enhance with structured JSON | Add `event: "execution.intent_reused"`, `oldExecutionId`, `newExecutionId`, `previousStatus`, `requestId` |
| `updateExecutionResult()` | Existing `logger.log` at line 248 | Enhance with structured JSON | Add `event: "execution.result_updated"`, `executionId`, `model`, `tokensUsed`, `status` |
| `updateExecutionResult()` — failure branch | Existing `logger.error` at line 255 | Enhance with structured JSON | Add `event: "execution.result_update_failed"`, `executionId`, `error` |
| `transitionOrphanToTimeout()` — success branch | Existing `logger.log` at line 414 | Enhance with structured JSON | Add `event: "idempotency.orphan_transitioned"`, `executionId` |
| `transitionOrphanToTimeout()` — no-op branch | Existing `logger.warn` at line 410 | Enhance with structured JSON | Add `event: "idempotency.orphan_transition_noop"`, `executionId` |

> **Key principle:** All `UsageLedgerService` instrumentation is enhancement of **existing** `logger.log/error/warn` calls. No new log calls. The log format changes from free-text to structured JSON.

---

## 3. Telemetry Outputs (Minimal / Safest)

### 3.1 Primary Output: Structured JSON Logs

All events are emitted as structured JSON via the existing NestJS `Logger` instance (`this.logger`).

**Format:**
```json
{
  "event": "<stable_event_name>",
  "timestamp": "<ISO8601>",
  "userId": "<string>",
  "apiKeyId": "<string>",
  "requestId": "<string|null>",
  "executionId": "<uuid>",
  "status": "<pending|completed|timeout|failed>",
  "provider": "<string|null>",
  "model": "<string|null>",
  "tokensUsed": "<number|null>",
  "durationMs": "<number|null>",
  "outcome": "<string|null>",
  "errorClass": "<string|null>",
  "flow": "<new|reuse|null>"
}
```

This integrates with any log aggregator (Datadog, CloudWatch, Splunk, stdout) without code changes.

---

### 3.2 Optional DB-Backed Counters

**Condition for use:** Only if a counters table already exists in the schema. No new migrations permitted.

**Current assessment:** No generic counters table exists in the api-gateway schema (based on review of `services/api-gateway/src/migrations/`). Therefore: **log-only for now**.

If a counters table is introduced in a future phase, these events are the candidates:
- `execution_lifecycle_counts` (by status)
- `orphan_transition_count`
- `replay_count` (cache_hit vs. fallback_placeholder)
- `result_update_failure_count`

---

### 3.3 Prometheus-Style Metrics

**Condition for use:** Only if the platform already supports Prometheus scraping (e.g., `prom-client` is already a dependency).

**Current assessment:** The existing metrics endpoint (`/api/runtime/metrics` from PHASE-41A) returns custom JSON, not Prometheus-format counters. No `prom-client` dependency exists.

**Decision:** **Log-only.** No Prometheus instrumentation in this phase. Prometheus is a future phase concern.

---

## 4. Event Schema (Stable Fields)

The following fields form the stable contract for all telemetry events. Once published, field names MUST NOT be renamed or removed.

| Field | Type | Description | Required |
|---|---|---|---|
| `event` | `string` | Stable event name (see table below) | Always |
| `timestamp` | `string` | ISO 8601 UTC timestamp | Always |
| `userId` | `string` | Verified user identifier (from `ApiKeyIdentity`) | Always |
| `apiKeyId` | `string` | API key identifier (from `ApiKeyIdentity`) | Always |
| `requestId` | `string \| null` | Client-provided `Idempotency-Key` value (null if not provided) | Always |
| `executionId` | `string` | UUID of the `usage_records` row | Always |
| `status` | `string` | `pending \| completed \| timeout \| failed` | Always |
| `provider` | `string \| null` | AI provider name (e.g., `stub`, `openai`) | When known |
| `model` | `string \| null` | AI model name (e.g., `gpt-4`) | After AI call |
| `tokensUsed` | `number \| null` | Actual tokens consumed | After AI call |
| `durationMs` | `number \| null` | Total execution wall-clock time (ms) | After AI call |
| `outcome` | `string \| null` | Sub-classification: `cache_hit`, `fallback_placeholder`, `new`, `reuse`, etc. | When applicable |
| `errorClass` | `string \| null` | Error constructor name (e.g., `HttpException`, `QueryFailedError`) | On failures |
| `flow` | `string \| null` | `new` (writeExecutionIntent) or `reuse` (reuseExecutionIntent) | On intent write |
| `pendingAgeMs` | `number \| null` | Age of `pending` record in ms at detection time | On orphan events |
| `priorStatus` | `string \| null` | Previous `execution_status` before transition | On transitions |

---

### 4.1 Stable Event Name Registry

| Event Name | Emitter | Description |
|---|---|---|
| `execution.intent_written` | `AIExecutionController` + `UsageLedgerService.writeExecutionIntent()` | Intent row written; status = `pending` |
| `execution.intent_reused` | `UsageLedgerService.reuseExecutionIntent()` | Existing `timeout`/`failed` row recycled as new `pending` |
| `execution.ai_success` | `AIExecutionController` (after `aiServiceHttpClient.execute()`) | AI provider returned result successfully |
| `execution.ai_failure` | `AIExecutionController` (catch around `aiServiceHttpClient.execute()`) | AI provider call threw or timed out |
| `execution.result_updated` | `UsageLedgerService.updateExecutionResult()` | Ledger row transitioned from `pending` → `completed` |
| `execution.result_update_failed` | `UsageLedgerService.updateExecutionResult()` error branch | Ledger UPDATE failed after AI success — **CRITICAL** |
| `idempotency.replay` | `IdempotencyGuard` | Completed record found; `IdempotentReplayException` thrown; quota bypassed |
| `idempotency.orphan_transitioned` | `UsageLedgerService.transitionOrphanToTimeout()` | Orphan `pending` → `timeout` transition applied |
| `idempotency.orphan_transition_noop` | `UsageLedgerService.transitionOrphanToTimeout()` | Transition attempted but record already transitioned |
| `idempotency.conflict_pending` | `IdempotencyGuard` | `pending` record < 5 min; 409 returned to client |
| `idempotency.retry_allowed` | `IdempotencyGuard` | `timeout`/`failed` record found; retry permitted |

---

### 4.2 Example Log Lines

**Successful execution (new, no idempotency key):**
```json
{"event":"execution.intent_written","timestamp":"2026-02-27T10:00:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","status":"pending","flow":"new","provider":"stub"}
{"event":"execution.ai_success","timestamp":"2026-02-27T10:00:02.150Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","provider":"stub","model":"stub-model","tokensUsed":42,"durationMs":2150}
{"event":"execution.result_updated","timestamp":"2026-02-27T10:00:02.200Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-001","status":"completed","model":"stub-model","tokensUsed":42,"durationMs":2200}
```

**Idempotency replay (cache hit):**
```json
{"event":"idempotency.replay","timestamp":"2026-02-27T10:01:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":"client-key-xyz","executionId":"exec-uuid-001","status":"completed","outcome":"cache_hit","quota_bypassed":true}
```

**Orphan detection and reconciliation:**
```json
{"event":"idempotency.orphan_transitioned","timestamp":"2026-02-27T10:15:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":"client-key-xyz","executionId":"exec-uuid-001","pendingAgeMs":360000,"priorStatus":"pending"}
{"event":"execution.intent_reused","timestamp":"2026-02-27T10:15:00.050Z","userId":"user-abc","apiKeyId":"key-123","requestId":"client-key-xyz","oldExecutionId":"exec-uuid-001","executionId":"exec-uuid-002","previousStatus":"timeout","flow":"reuse"}
```

**Critical: AI success + ledger write failure:**
```json
{"event":"execution.ai_success","timestamp":"2026-02-27T10:05:00.000Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-003","provider":"stub","model":"stub-model","tokensUsed":100,"durationMs":1500}
{"event":"execution.result_update_failed","timestamp":"2026-02-27T10:05:00.100Z","userId":"user-abc","apiKeyId":"key-123","requestId":null,"executionId":"exec-uuid-003","errorClass":"QueryFailedError","errorMessage":"connection refused"}
```

---

## 5. Alertable Conditions (Detection Only — No Automation)

The following conditions are **detectable from logs or SQL** and should trigger human investigation. No automated remediation is designed here.

---

### ALERT-1: Orphan Count > 0

**Condition:** `COUNT(*) WHERE execution_status = 'pending' AND timestamp < NOW() - INTERVAL '5 minutes'` returns any rows.

**Signal source:** SQL query against `usage_records`

**Severity:** Warning

**Meaning:** An execution was abandoned (crash, timeout, network failure) and has not yet been lazily reconciled by a client retry.

**Action:** Investigate for api-gateway crashes or AI service outages during the window. If stale orphans accumulate without client retries, run `reconcile-orphans.ts` manually.

---

### ALERT-2: Max Pending Age > Threshold

**Condition:** `MAX(timestamp) WHERE execution_status = 'pending'` shows a record older than 10 minutes (2× orphan threshold).

**Signal source:** SQL query against `usage_records`

**Severity:** Warning → Critical if > 30 minutes

**Meaning:** A `pending` record is very old, suggesting a systemic failure (api-gateway stuck, orphan reconciliation not running, client never retrying).

**Action:** Cross-reference with `execution.ai_failure` logs for the `executionId`. Determine whether the AI call completed.

---

### ALERT-3: `update_result_failures` > 0

**Condition:** Any occurrence of `event: "execution.result_update_failed"` in logs.

**Signal source:** Structured log search

**Severity:** Critical

**Meaning:** AI provider completed the request and consumed tokens, but the ledger was NOT updated. This means:
- Tokens were consumed but not billed (revenue leakage)
- The client received HTTP 500 but AI actually ran
- The `pending` record will eventually become an orphan

**Action:** Immediate investigation. Identify the `executionId`, verify the AI call actually completed (cross-reference with `execution.ai_success` for same `executionId`), and manually UPDATE the `usage_records` row.

---

### ALERT-4: Replay Fallback Placeholder Count > 0

**Condition:** Any occurrence of `event: "idempotency.replay"` with `outcome: "fallback_placeholder"` in logs.

**Signal source:** Structured log search

**Severity:** Warning

**Meaning:** A replay was requested for a `completed` record, but `metadata.aiExecutionResult` was absent. The client received a synthetic placeholder response (`"[Duplicate request - original response not stored]"`) instead of the original AI output. This violates the deterministic replay invariant from PHASE-43B-3.

**Action:** Identify the affected `executionId` and `requestId`. Determine whether the record was created before PHASE-43B-3 (acceptable legacy) or after (regression).

---

### ALERT-5: AI-Success-But-Ledger-Incomplete Heuristic

**Condition (heuristic):** Within a 1-minute window, `execution.ai_success` log count exceeds `execution.result_updated` log count by more than N (suggested N=2).

**Signal source:** Log count comparison

**Severity:** Warning

**Meaning:** More AI executions completed successfully than ledger updates were recorded in the same window. The gap may indicate intermittent ledger write failures that are not individually triggering ALERT-3 (e.g., transient DB errors that succeed on controller-level retry in future phases).

**Note:** This is a heuristic — a legitimate gap can occur under high concurrency as log lines arrive out of order. The alert is informational and requires human correlation with `execution.result_update_failed` events.

**Action:** Compare `execution.ai_success` count with `execution.result_updated` count in the same time window. Identify any `executionId` values present in `ai_success` but absent from `result_updated`.

---

## 6. Verification Plan (Single-Shot — PowerShell + SQL)

Each script below is deterministic, single-shot, and requires no loops or human interaction. Scripts assume api-gateway is running locally on port 3000 with a valid test API key.

---

### 6.1 Verify Event: `execution.intent_written` Appears on New Execution

**Purpose:** Confirm that the `execution.intent_written` event is emitted for a new execution.

```powershell
# VERIFY-01: Intent Written Event
# Prerequisites: api-gateway running; $ApiKey is a valid test key

$ApiKey = "test-api-key-here"
$Headers = @{ "Authorization" = "Bearer $ApiKey" }
$Body = @{
    sessionId      = "sess-verify-01"
    conversationId = "conv-verify-01"
    prompt         = "Hello, observability test"
} | ConvertTo-Json

Write-Host "=== VERIFY-01: Intent Written ===" -ForegroundColor Cyan

$response = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/ai/execute" `
    -Method POST `
    -Body $Body `
    -ContentType "application/json" `
    -Headers $Headers

Write-Host "[OK] Execution returned: tokensUsed=$($response.tokensUsed), model=$($response.model)" -ForegroundColor Green
Write-Host "     Check logs for: event=execution.intent_written" -ForegroundColor Gray
Write-Host "     Check logs for: event=execution.ai_success" -ForegroundColor Gray
Write-Host "     Check logs for: event=execution.result_updated" -ForegroundColor Gray
```

**Expected log events (in order):** `execution.intent_written` → `execution.ai_success` → `execution.result_updated`

---

### 6.2 Verify Event: `idempotency.replay` Appears on Duplicate Request

**Purpose:** Confirm replay event fires with `outcome: "cache_hit"` on second request with same `Idempotency-Key`.

```powershell
# VERIFY-02: Idempotency Replay Event
$ApiKey   = "test-api-key-here"
$IdempKey = "verify-replay-$(Get-Date -Format 'yyyyMMddHHmmss')"
$Headers  = @{ "Authorization" = "Bearer $ApiKey"; "Idempotency-Key" = $IdempKey }
$Body = @{
    sessionId      = "sess-verify-02"
    conversationId = "conv-verify-02"
    prompt         = "Replay test prompt"
} | ConvertTo-Json

Write-Host "=== VERIFY-02: Idempotency Replay ===" -ForegroundColor Cyan

# First request (new execution)
$resp1 = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/ai/execute" `
    -Method POST -Body $Body -ContentType "application/json" -Headers $Headers
Write-Host "[OK] First request: tokensUsed=$($resp1.tokensUsed)" -ForegroundColor Green

# Second request (replay — same Idempotency-Key)
$resp2 = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/ai/execute" `
    -Method POST -Body $Body -ContentType "application/json" -Headers $Headers
Write-Host "[OK] Second request (replay): tokensUsed=$($resp2.tokensUsed)" -ForegroundColor Green

# Verify outputs match
if ($resp1.output -eq $resp2.output) {
    Write-Host "[OK] Outputs match (deterministic replay confirmed)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Outputs differ — replay non-deterministic" -ForegroundColor Red
}
Write-Host "     Check logs for: event=idempotency.replay, outcome=cache_hit" -ForegroundColor Gray
```

**Expected log events:** First request: `execution.intent_written`, `execution.ai_success`, `execution.result_updated`. Second request: `idempotency.replay` (outcome=`cache_hit`, `quota_bypassed=true`).

---

### 6.3 Verify Event: `idempotency.orphan_transitioned` via SQL Injection + Retry

**Purpose:** Confirm orphan detection fires when a `pending` record older than 5 minutes is encountered on retry.

```sql
-- VERIFY-03-A: Inject an artificial orphan (SQL — run against PostgreSQL)
-- Insert a pending record with a timestamp 10 minutes in the past
INSERT INTO usage_records (
    execution_id, api_key_id, user_id, session_id, conversation_id,
    provider, adapter, request_id, execution_status, timestamp, metadata
) VALUES (
    gen_random_uuid(),
    'test-api-key-here',
    'test-user-id-here',
    'sess-orphan-verify',
    'conv-orphan-verify',
    'stub', 'stub',
    'verify-orphan-key-001',
    'pending',
    NOW() - INTERVAL '10 minutes',
    '{}'
);
```

```powershell
# VERIFY-03-B: Retry with the orphan's Idempotency-Key (triggers lazy reconciliation)
$ApiKey   = "test-api-key-here"
$IdempKey = "verify-orphan-key-001"
$Headers  = @{ "Authorization" = "Bearer $ApiKey"; "Idempotency-Key" = $IdempKey }
$Body = @{
    sessionId      = "sess-orphan-verify"
    conversationId = "conv-orphan-verify"
    prompt         = "Orphan reconciliation test"
} | ConvertTo-Json

Write-Host "=== VERIFY-03: Orphan Transition ===" -ForegroundColor Cyan

$response = Invoke-RestMethod `
    -Uri "http://localhost:3000/api/ai/execute" `
    -Method POST -Body $Body -ContentType "application/json" -Headers $Headers
Write-Host "[OK] Retry after orphan succeeded: tokensUsed=$($response.tokensUsed)" -ForegroundColor Green
Write-Host "     Check logs for: event=idempotency.orphan_transitioned" -ForegroundColor Gray
```

```sql
-- VERIFY-03-C: Confirm the original pending row is now 'timeout'
SELECT execution_id, execution_status, request_id, timestamp
FROM usage_records
WHERE request_id = 'verify-orphan-key-001'
ORDER BY timestamp DESC;
-- Expected: original row has execution_status = 'timeout'
--           a new row has execution_status = 'completed'
```

**Expected log events:** `idempotency.orphan_transitioned` → `execution.intent_reused` (flow=`reuse`) → `execution.ai_success` → `execution.result_updated`

---

### 6.4 Verify SQL: Orphan Count Query (ALERT-1)

**Purpose:** Confirm the ALERT-1 detection query returns 0 orphans under normal conditions.

```sql
-- VERIFY-04: Orphan count (ALERT-1 detection)
SELECT
    COUNT(*) AS orphan_count,
    MAX(NOW() - timestamp) AS max_orphan_age
FROM usage_records
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '5 minutes';

-- Expected under normal conditions: orphan_count = 0
-- Alert threshold: orphan_count > 0
```

---

### 6.5 Verify SQL: Lifecycle Status Distribution

**Purpose:** Confirm execution lifecycle counts by status are queryable (basis for ALERT-2).

```sql
-- VERIFY-05: Lifecycle status distribution
SELECT
    execution_status,
    COUNT(*)                              AS count,
    MIN(timestamp)                        AS oldest,
    MAX(timestamp)                        AS newest,
    MAX(NOW() - timestamp)                AS max_age
FROM usage_records
GROUP BY execution_status
ORDER BY execution_status;

-- Expected normal state:
--   completed  → majority of rows
--   pending    → 0 or very few (active executions only)
--   timeout    → small number (crashed/retried executions)
--   failed     → 0 (not yet implemented)
```

---

### 6.6 Verify SQL: AI-Success-But-Ledger-Incomplete Heuristic (ALERT-5)

**Purpose:** Provide a SQL-level proxy for the heuristic — identify `pending` records where AI may have completed (based on age and system logs).

```sql
-- VERIFY-06: Pending records that may have had AI success but no ledger update
-- (These are candidates for the ai_success_but_ledger_incomplete heuristic)
SELECT
    execution_id,
    user_id,
    api_key_id,
    request_id,
    timestamp,
    EXTRACT(EPOCH FROM (NOW() - timestamp)) AS age_seconds
FROM usage_records
WHERE execution_status = 'pending'
  AND timestamp < NOW() - INTERVAL '2 minutes'  -- Past normal AI timeout (30s + margin)
ORDER BY timestamp ASC;

-- Expected: 0 rows under normal conditions
-- Any rows here should be cross-referenced against execution.ai_success log events
-- for the same execution_id to determine if revenue leakage occurred
```

---

### 6.7 Verify: Replay Fallback Placeholder Detection (ALERT-4)

```sql
-- VERIFY-07: Find completed records missing aiExecutionResult in metadata
-- (These will produce fallback_placeholder replays)
SELECT
    execution_id,
    user_id,
    request_id,
    timestamp,
    metadata
FROM usage_records
WHERE execution_status = 'completed'
  AND (metadata IS NULL
       OR metadata->>'aiExecutionResult' IS NULL
       OR metadata->'aiExecutionResult'->>'output' IS NULL)
ORDER BY timestamp DESC
LIMIT 20;

-- Expected after PHASE-43B-3: 0 rows (all completed records have aiExecutionResult)
-- Any rows here are pre-PHASE-43B-3 legacy or a regression
```

---

## 7. Minimal Rollout Plan

### Phase 1: Log-Only (This Phase — PHASE-43C-1 Implementation)

**Approach:** Add structured JSON formatting to existing `logger.log/error/warn` calls in the four files identified in Section 2. No new files, no new dependencies, no migrations.

**Steps:**
1. Enhance `UsageLedgerService` logger calls to emit stable event names + all schema fields
2. Add minimal try/catch/rethrow wrappers in `AIExecutionController.execute()` around the `aiServiceHttpClient.execute()` call and the `updateExecutionResult()` call (log event + rethrow — zero semantic change)
3. Enhance `IdempotencyGuard.canActivate()` to emit replay, orphan, conflict, and retry-allowed events

**Safety guarantees:**
- All existing catch blocks remain; only log format changes
- All rethrows preserve original error propagation
- No new HTTP status codes
- No new guard ordering changes
- No new database queries
- No new dependencies
- Backward compatible: existing log consumers see richer JSON but no removed fields

**Rollback:** Revert the four files. Zero database impact. Zero migration required.

---

### Phase 2: Counter Aggregation (Future — Not This Phase)

If a counters table is introduced (future phase), the structured log events defined here provide the exact event vocabulary to populate it. The event names and field names in Section 4 are designed to be stable across both log-only and DB-backed counter modes.

---

### Phase 3: Prometheus Metrics (Future — Not This Phase)

If `prom-client` is introduced (future phase), the event names map 1:1 to Prometheus counter names:
- `execution_intent_written_total`
- `execution_ai_success_total`
- `execution_ai_failure_total`
- `execution_result_updated_total`
- `execution_result_update_failed_total`
- `idempotency_replay_total` (label: `outcome`)
- `idempotency_orphan_transitioned_total`

No renaming required.

---

### Safe Defaults

| Default | Value | Rationale |
|---|---|---|
| Orphan timeout | 5 minutes | Matches existing `ORPHAN_TIMEOUT_MS` in `idempotency.guard.ts` — no change |
| Alert threshold for orphan count | > 0 | Any orphan is anomalous |
| Alert threshold for max pending age | > 10 minutes | 2× orphan timeout; accounts for lazy reconciliation lag |
| Alert threshold for result_update_failures | > 0 | Any failure is critical (revenue leakage risk) |
| Replay fallback placeholder threshold | > 0 | Indicates metadata regression post-PHASE-43B-3 |
| AI-success/ledger-complete gap threshold | > 2 in 1 min | Heuristic; adjust based on observed noise |

---

## 8. Scope Boundaries

### In Scope (this document only)
- Structured log event definitions for api-gateway execution lifecycle
- Hook point identification (four files, existing functions only)
- Event schema definition (stable contract)
- Alertable condition definitions
- Verification queries and scripts
- Rollout approach

### Out of Scope (explicitly excluded)
- Code changes (DESIGN ONLY — no implementation in this document)
- Database migrations
- New tables or columns
- Prometheus / Grafana integration
- Background workers or schedulers
- Changes to ai-service, container-manager, or any other service
- Changes to business logic, guard ordering, or error semantics
- Authentication, authorization, or security changes

---

## 9. Cross-Reference to Prior Phases

| Prior Phase | Relevance |
|---|---|
| PHASE-43A-1 | Identified `usage_records` idempotency risk; established two-write pattern requirement |
| PHASE-43A-2B/C | Introduced `requestId` / `IdempotencyGuard`; defines replay short-circuit semantics |
| PHASE-43B-2 | Implemented two-phase write (`writeExecutionIntent` + `updateExecutionResult`) |
| PHASE-43B-3 | Stored `aiExecutionResult` in `metadata` for deterministic replay |
| PHASE-43B-4 | Implemented orphan reconciliation (`transitionOrphanToTimeout`, `reuseExecutionIntent`) |
| PHASE-42A-3 | Token quota guard; advisory lock; `pending` records excluded from quota SUM |
| PHASE-41A | Runtime metrics endpoint; confirms no existing Prometheus infrastructure |

---

**Document Status:** DESIGN COMPLETE  
**Next Stage:** STAGE-43C-1B (Implementation — log instrumentation only)  
**Approval Required:** Yes (before proceeding to implementation)

---

**END OF DESIGN**
