# PHASE-44 DESIGN PATCH — Fix Ledger Ownership + Exactly-Once Worker Claim + Container Role

Applies to: docs/PHASE-44-DESIGN.md  
Date: 2026-03-04  
Status: REQUIRED PATCH BEFORE IMPLEMENTATION

This patch corrects 3 blocking issues:

1) Ledger writes via api-gateway (incorrect ownership / failure coupling)  
2) Worker idempotency relies on "check then act" (race condition)  
3) Container execution role is ambiguous (must be explicitly Model A or Model B)

---

## PATCH 1 — Ledger ownership: Worker writes ledger directly (api-gateway read-only)

### Problem (current design)
The AI service worker updates the ledger by calling an internal api-gateway endpoint. This adds a fragile network hop and couples correctness to api-gateway availability.

### Required change
- **api-gateway**: write intent (pending) + read status/result
- **ai-service worker**: write **running/completed/failed/timeout** directly to Postgres ledger
- api-gateway must NOT be the write-path for worker finalization

### Replace / update these statements in PHASE-44-DESIGN.md
- Remove: "Ledger result updates (via api-gateway internal endpoint)" from ai-service worker responsibilities
- Remove any requirement that workers "delegate ledger writes to api-gateway"
- Replace with:

**AI Service Worker OWNS**
- queue consumption
- atomic job-claim transition (pending → running)
- provider call (if applicable)
- container-manager orchestration (if applicable)
- **direct ledger finalization writes** (completed/failed/timeout)
- ack job after successful finalization

**API Gateway OWNS**
- submit endpoint (intent write + enqueue)
- status polling endpoint (read-only from ledger)

---

## PATCH 2 — Exactly-once executor: Atomic job-claim transition (no check-then-execute)

### Problem (current design)
"Read status; if pending then execute" can race under duplicate delivery / multiple workers:
- Worker A reads pending
- Worker B reads pending
- Both execute

### Required change
Worker MUST "claim" the job via a single atomic UPDATE.

### New canonical worker algorithm

1) Dequeue job
2) Atomically claim:

```sql
UPDATE usage_ledger
SET status = 'running',
    started_at = now()
WHERE execution_id = $1
  AND status = 'pending'
RETURNING execution_id;

If 1 row returned: this worker owns execution

If 0 rows: duplicate delivery OR already finished → ACK job and exit

Execute the work (provider call and/or container execution)

Finalize ledger (completed/failed/timeout) with atomic guard:

UPDATE usage_ledger
SET status = 'completed',
    completed_at = now(),
    metadata = jsonb_set(coalesce(metadata,'{}'::jsonb), '{aiExecutionResult}', $2::jsonb, true)
WHERE execution_id = $1
  AND status = 'running';

ACK job only after finalization succeeds

Notes / invariants

Never execute unless you successfully transitioned pending → running.

Never finalize unless status is running.

Never allow completed → anything else.

PATCH 3 — Clarify container role: choose Model A or Model B (default: Model A)

Your current flow implies:
"Call AI Provider → Send Result to Container Manager → Container executes code"

But container-manager is for isolated code execution, not general AI response processing.
This must be explicit.

Two allowed models
Model A (DEFAULT for Phase-44): Provider-only execution

Worker calls AI provider

Worker persists output + tokensUsed

No container execution occurs in Phase-44 baseline

Flow:
pending → running → completed (with AI output)

Model B (OPTIONAL extension): AI generates code, then container executes it

Worker calls AI provider to produce code artifact

Worker sends code artifact to container-manager

Container executes and returns stdout/stderr/exitCode

Worker persists container output as the execution result

Flow:
pending → running → completed (with container output + AI metadata)

Required update in PHASE-44-DESIGN.md

Add a section:

"Execution Modes"

Phase-44 baseline = Model A

Model B is allowed only when the request includes an explicit executionMode: "container" (or equivalent)

Status/result payload must clearly indicate what output is returned (AI output vs container stdout)

PATCHED API CONTRACT (minimal change)
Submit endpoint stays async

POST /api/ai/execute returns 202 with { executionId, requestId, status }

Status endpoint stays read-only

GET /api/ai/executions/:executionId reads ledger only

Optional: expose executionMode

If Model B is supported later:

Request body adds:

{
  "executionMode": "provider" | "container"
}

Default if omitted: "provider".

PATCHED SERVICE RESPONSIBILITIES (final)
api-gateway

Auth/Quota/Safety/Idempotency on submit

Write intent (pending)

Enqueue job

Read-only status/result endpoint

ai-service worker

Consume queue job

Atomic claim (pending → running)

Execute work

Direct ledger finalization write (completed/failed/timeout)

ACK job after finalization

container-manager

Only executes code when executionMode requires it

Enforces isolation + resource limits

Returns bounded stdout/stderr/exit

Acceptance criteria for Phase-44 implementation (must pass)

Duplicate submissions with same (userId, requestId) never create 2 ledger rows

Duplicate queue deliveries never execute twice (atomic claim proves it)

Worker crash after claim but before finalize does not double-execute; a retry must not run unless status is pending

ACK happens only after ledger finalization succeeds

api-gateway never becomes a critical dependency for worker finalization correctness

END PATCH