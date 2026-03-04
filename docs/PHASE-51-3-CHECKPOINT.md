# PHASE-51-TASK-51.3 CHECKPOINT

**Project**: aiSandBox  
**Phase**: 51 — Production Hardening  
**Task**: 51.3 — Retry Policy (Transient Failure Handling)  
**Date**: 2025-03-04

---

# Objective

Introduce a safe retry policy for transient execution failures without violating:
- Phase-43 deterministic replay / idempotency
- Ledger write-before-call
- Exactly-once execution semantics
- Financial safety

Retries are bounded, observable, and do not double-execute.

---

# Implementation

## A) Queue Job Options (api-gateway)

**File**: `services/api-gateway/src/queue/queue.service.ts`

- **attempts**: 1 (no BullMQ retries)
- **Reason**: BullMQ retries would re-run the job after ledger claim, risking duplicate execution or ledger inconsistency. In-worker retry keeps exactly-once semantics and ledger as source of truth.
- **removeOnComplete**: true
- **removeOnFail**: false

## B) In-Worker Transient Retry Loop (ai-service)

**File**: `services/ai-service/src/worker/worker.processor.ts`

### Retry Mechanism

- **Location**: Inside the worker, after ledger claim and before finalizing ledger.
- **Scope**: Wraps only the provider execution call (`aiExecutionService.execute`).
- **Max attempts**: 3 total tries (configurable via `EXECUTION_PROVIDER_RETRY_ATTEMPTS`, default 3).
- **Backoff**: Exponential, base 250ms (configurable via `EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS`).
  - Delays: 250ms, 500ms between retries.
- **AbortSignal**: Respects cancellation during backoff; no retry if aborted.

### Transient Error Classifier

```ts
function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /timeout|timed out|ECONNRESET|ENOTFOUND|429|503|overloaded/i.test(msg);
}
```

**Retryable**: timeout, connection reset, 429, 503, overloaded.  
**Non-retryable**: 400 validation, auth, quota, prompt errors.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| EXECUTION_PROVIDER_RETRY_ATTEMPTS | 3 | Total tries (max 10, min 1) |
| EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS | 250 | Base delay for exponential backoff (50–10000 ms) |

### Logging

For each retry: `Transient retry attempt X/Y for executionId=..., delay=...ms`

## C) Claim-Fail Handling (Phase-51.3)

When ledger claim fails (job is a retry or duplicate):
- **running**: Stalled recovery path (mark failed, publish completion)
- **cancel_requested**: Set cancelled, publish completion, skip
- **completed, cancelled, timeout, failed**: Log and skip (do not change ledger)
- **Otherwise**: Log and skip

## D) Preserved Invariants

- Deterministic replay protection
- Ledger write-before-call pattern
- Idempotent request handling
- Atomic worker claim logic
- Cancellation and timeout abort immediately (no retry)
- Streaming response integrity

---

# Files Changed

**Modified files:**

- `services/api-gateway/src/queue/queue.service.ts`
  - Set attempts=1, added documentation for Phase-51.3
  - removeOnComplete: true, removeOnFail: false

- `services/ai-service/src/worker/worker.processor.ts`
  - Added `isRetryableError()` helper
  - Added `sleep(ms, signal)` helper with AbortSignal support
  - Added retry config (EXECUTION_PROVIDER_RETRY_ATTEMPTS, EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS)
  - Wrapped provider execution in bounded retry loop

**Created files:**

- `scripts/phase-51-retry-validation.ps1` — validation script with manual steps
- `docs/PHASE-51-3-CHECKPOINT.md` — this document

---

# Validation

## Manual Steps

1. **Force retryable failure** (choose one):
   - Temporarily modify stub adapter to throw "timeout" on first call for a specific prompt.
   - Use real provider with invalid URL to get ECONNRESET.
   - Network simulation: briefly block outbound traffic.

2. **Submit execution** via POST /api/ai/execute.

3. **Confirm worker logs** show:
   - `Transient retry attempt 1/3 for executionId=..., delay=250ms`
   - `Transient retry attempt 2/3 for executionId=..., delay=500ms` (if needed)
   - `AI execution completed` or `AI execution failed`
   - `Ledger finalized executionId=...`

4. **Confirm ledger** final status is `completed` or `failed`.

5. **Confirm SSE stream** ends with completion event.

## Script

```powershell
.\scripts\phase-51-retry-validation.ps1
```

Without a transient failure, the script validates normal flow.

---

# Build

- `npm run build` passes for `services/api-gateway`
- `npm run build` passes for `services/ai-service`
