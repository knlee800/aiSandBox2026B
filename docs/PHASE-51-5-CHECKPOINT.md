# PHASE-51-TASK-51.5 CHECKPOINT

**Project**: aiSandBox  
**Phase**: 51 — Production Hardening  
**Task**: 51.5 — Stuck Execution Detection  
**Date**: 2025-03-04

---

# Objective

Implement a watchdog scanner that detects executions stuck in the `running` state longer than the allowed execution timeout and safely recovers them. Final safety net for worker crashes, infrastructure failures, or queue inconsistencies.

---

# Implementation

## Detection Strategy

Execution is considered **stuck** when:

- `execution_status = 'running'`
- `timestamp < NOW() - stuck_threshold`
- `stuck_threshold = EXECUTION_TIMEOUT_MS * 2` (safety multiplier)

**Note**: `usage_records` uses `timestamp` (record creation time) as the age proxy. The threshold accounts for queue wait + running time. If the schema gains `updated_at` in future, the scanner could be updated for more precise detection.

## Scanner Logic

**File**: `services/ai-service/src/worker/worker.processor.ts`

1. **scanForStuckExecutions()** — periodic task:
   - Query: `SELECT execution_id, timestamp FROM usage_records WHERE execution_status = 'running' AND timestamp < NOW() - INTERVAL '1 second' * :stuck_threshold LIMIT 50`
   - For each row: atomic `UPDATE ... SET execution_status = 'failed' WHERE execution_id = $1 AND execution_status = 'running' RETURNING execution_id`
   - On successful update: `executionStreamPublisher.publishCompletion(executionId)`
   - Log: `Recovered stuck execution executionId=... workerId=... runtime_ms=...`

2. **Interval**: `setInterval(scanForStuckExecutions, intervalMs)`
   - Default: `EXECUTION_STUCK_SCAN_INTERVAL_MS = 30000` (30 seconds)
   - Override via environment variable

3. **Cleanup**: `clearInterval` in `onModuleDestroy`

## Recovery Flow

- Atomic UPDATE ensures only one worker can recover each execution
- No race conditions
- SSE completion published so open streams close
- Watchdog never triggers AI execution; only updates ledger when confirmed stuck

---

# Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| EXECUTION_TIMEOUT_MS | 20000 | Base timeout; stuck_threshold = 2x this |
| EXECUTION_STUCK_SCAN_INTERVAL_MS | 30000 | Scan interval (30 seconds) |

---

# Safety Requirements Preserved

- Deterministic replay protection
- Ledger write-before-call pattern
- Exactly-once execution semantics
- Idempotent request handling
- Cancellation behavior
- Timeout watchdog behavior
- Streaming response integrity

---

# Files Changed

**Modified:**

- `services/ai-service/src/worker/worker.processor.ts`
  - Added `stuckScanIntervalHandle` for cleanup
  - Added `scanForStuckExecutions()` method
  - Started periodic scan in `onModuleInit`
  - Cleared interval in `onModuleDestroy`

---

# Validation

1. Start ai-service
2. Submit an execution request
3. Simulate stuck execution (stop worker mid-run)
4. Restart worker
5. Wait for watchdog interval (~30s)

Expected: `execution_status` transitions to `failed`, log shows `Recovered stuck execution executionId=...`, SSE stream closes.

---

# Build

- `npm run build` passes for `services/ai-service`
