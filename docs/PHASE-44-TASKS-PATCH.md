PHASE-44-TASKS-PATCH.md
# PHASE-44 TASK PATCH

Applies to:
docs/PHASE-44-TASKS.md

Purpose:
Align implementation tasks with the corrected Phase-44 architecture.

---

# PATCH 1 — Remove API Gateway client from worker

REMOVE completely:

services/ai-service/src/api-gateway-client/
ApiGatewayClientService

REMOVE tasks:

TASK-44.7 (Idempotency check via API gateway)
TASK-44.10 (Ledger update via API gateway)

Workers must **never call api-gateway**.

Workers interact with:

- Postgres ledger
- AI providers
- container-manager (optional)

---

# PATCH 2 — Add atomic job claim task

Insert new task after TASK-44.6.

---

## TASK-44.7 — Implement Atomic Job Claim

Objective:
Ensure exactly one worker executes each job.

Files affected:

services/ai-service/src/worker/worker.processor.ts  
services/ai-service/src/ledger/ledger.service.ts

Implementation:

Worker must claim job using atomic SQL:


UPDATE usage_ledger
SET execution_status = 'running',
started_at = NOW()
WHERE execution_id = $1
AND execution_status = 'pending'
RETURNING execution_id;


Logic:

- if row returned → worker owns job
- if no row returned → duplicate delivery → ACK job and exit

Validation:

- duplicate deliveries never execute twice
- only one worker can claim execution

---

# PATCH 3 — Worker writes ledger directly

Replace all logic that calls api-gateway.

Worker must update ledger directly.

Example:


UPDATE usage_ledger
SET execution_status = 'completed',
tokens_used = $tokens,
metadata = jsonb_set(metadata,'{aiExecutionResult}', $json)
WHERE execution_id = $id
AND execution_status = 'running'


---

# PATCH 4 — Container execution optional

Modify TASK-44.9.

Container manager should only run if executionMode requires it.

Default:


executionMode = "provider"


Worker pipeline:


AI provider
→ ledger completed


Optional container execution:


AI provider
→ generated code
→ container manager
→ ledger completed


---

# PATCH 5 — Worker finalization order

Worker must finalize ledger before acknowledging job.

Correct order:


atomic claim
execute work
write ledger result
ack queue job


Never ACK before ledger update.

---

# PATCH 6 — Remove internal API endpoints

Delete:


GET /api/internal/executions/:executionId
POST /api/internal/executions/:executionId/result


These endpoints are no longer needed.

Workers communicate with DB directly.

---

# Resulting Correct Task Flow

1 Add Redis  
2 Install BullMQ  
3 Create queue types  
4 Queue submission in API gateway  
5 Status polling endpoint  
6 Worker process  
7 Atomic job claim  
8 AI provider call  
9 Optional container execution  
10 Ledger finalization  
11 Retry logic  
12 Dead letter queue  
13 Integration tests  
14 Documentation  
15 Admin scripts

---

END PATCH