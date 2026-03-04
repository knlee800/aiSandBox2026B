# PHASE-51-TASK-51.1 CHECKPOINT

**Project**: aiSandBox  
**Phase**: 51 — Production Hardening  
**Task**: 51.1 — Stalled Job Recovery  
**Date**: 2025-03-04

---

# Objective

Detect jobs that remain in `running` state after a worker crash and implement a recovery mechanism that safely marks them as failed without violating the write-before-call ledger guarantee.

---

# Implementation

## Behavior

1. **BullMQ stalled detection**: Worker options `stalledInterval`, `lockDuration`, and `maxStalledCount` enable BullMQ to detect jobs whose worker has crashed or lost its lock. Stalled jobs are automatically moved back to the waiting queue.

2. **Recovery on claim failure**: When a worker picks up a job and the ledger claim fails (no row updated from `pending` → `running`), the worker checks the current ledger status:
   - If `execution_status = 'running'`: the job was stalled (original worker crashed after claiming). The worker atomically updates the ledger to `failed` and publishes completion.
   - Otherwise: duplicate/race (e.g. already completed). The worker skips and returns.

3. **Ledger guarantee**: Recovery only updates the ledger when `execution_status = 'running'`. The atomic `UPDATE ... WHERE execution_status = 'running' RETURNING` ensures exactly-once terminal state transition. No AI provider call occurs during recovery.

## Configuration

- `lockDuration`: `max(EXECUTION_TIMEOUT_MS + 10000, 30000)` — ensures lock outlives the execution timeout.
- `stalledInterval`: `min(15000, lockDuration / 2)` — per BullMQ guidance.
- `maxStalledCount`: 1 — job is requeued once; recovery handles it on first requeue.

---

# Files Changed

**Modified files:**

- `services/ai-service/src/worker/worker.processor.ts`

**Changes:**

- Added stalled job recovery logic when claim fails and ledger status is `running`.
- Added Worker options: `lockDuration`, `stalledInterval`, `maxStalledCount`.
- Moved `EXECUTION_TIMEOUT_MS` to module scope for reuse in lock duration calculation.

---

# Preserved Invariants

- Deterministic replay protection
- Ledger write-before-call pattern
- Idempotent request handling
- Atomic worker claim logic
- Cancellation behavior
- Timeout watchdog behavior
- Streaming response integrity

---

# Validation

- Build: `npm run build` succeeds.
- No schema changes.
- No new dependencies.
