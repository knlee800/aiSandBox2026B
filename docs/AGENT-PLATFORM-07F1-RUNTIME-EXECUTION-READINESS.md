# AGENT-PLATFORM-07F1 — Runtime Execution Readiness Plan

**Task ID:** AGENT-PLATFORM-07F1
**Step:** 2 — Runtime Execution Readiness / Keith Approval Gate
**Status:** Step 2 COMPLETE
**Date:** 2026-07-10
**Nature:** Static readiness/planning only — no implementation, no runtime execution, no service startup
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07F1 ACTIVE — Step 1 COMPLETE (Registration 2026-07-10), Keith approval recorded | PASS |
| Parent AGENT-PLATFORM-07F ACTIVE — Step 2 COMPLETE (Preflight Plan / Split Decision), Keith approval recorded | PASS |
| AGENT-PLATFORM-07F2 PLANNED ONLY — not registered | PASS |
| AGENT-PLATFORM-07F3 PLANNED ONLY — not registered | PASS |
| AGENT-PLATFORM-07E COMPLETE and LOCKED (2026-07-10) — Unit/in-process canary PASS, 16+40 tests, TypeScript clean | PASS |
| AGENT-PLATFORM-07D COMPLETE and LOCKED (2026-07-10) — Collaboration Audit Events, 40 tests | PASS |
| AGENT-PLATFORM-07C COMPLETE and LOCKED (2026-07-10) — All 3 child slices (07C1/07C2/07C3) | PASS |
| AGENT-PLATFORM-07B COMPLETE and LOCKED (2026-07-09) — Orchestration Module Skeleton | PASS |
| AGENT-PLATFORM-07A COMPLETE and LOCKED (2026-07-09) — Coordinator Contracts / Schema | PASS |
| AGENT-PLATFORM-07 COMPLETE and LOCKED (2026-07-09) — Coordinator Planning | PASS |
| AGENT-PLATFORM-06 COMPLETE and LOCKED (2026-07-09) — Upstream Identity Propagation | PASS |
| AGENT-HARNESS-07 COMPLETE and LOCKED (2026-07-07) — Per-Builder Harness Config Adapter | PASS |
| AGENT-HARNESS-06E COMPLETE and LOCKED (2026-07-09) — Full E2E Canary | PASS |
| One-active-task rule satisfied — only AGENT-PLATFORM-07F (with child 07F1) is ACTIVE | PASS |
| AGENT-HARNESS write canary not involved — separate track | PASS |

**Governance readiness: PASS — all 15 criteria satisfied.**

---

## 2. 06E Pattern Reuse Analysis

### 2.1 What Applies from AGENT-HARNESS-06E

| 06E Pattern Element | Applies to 07F1? | Notes |
|---------------------|-------------------|-------|
| Direct BullMQ job submission via canary script | **YES** | Same `Queue('ai-execution')` pattern |
| Direct PostgreSQL `usage_records` intent row insertion | **YES** | Same `INSERT ... status='pending'` pattern |
| `test-harness-stub` / `stub` provider — zero tokens, zero external calls | **YES** | 07F1 uses `stub` provider (plain path); same zero-cost guarantee |
| Process-scoped env variables (`$env:VAR = 'value'`) | **YES** | Same PowerShell pattern; no `.env` edits |
| Redis/BullMQ queue name: `ai-execution` | **YES** | Same queue |
| BullMQ job name: `execute-ai` | **YES** | Same job name |
| Cleanup via `DELETE FROM usage_records WHERE execution_id LIKE 'canary-...'` | **YES** | Same pattern with `canary-07f1-` prefix |
| Post-run queue inspection via `redis-cli LLEN/ZCARD` | **YES** | Same Redis commands |
| Script location: `services/ai-service/scripts/` | **YES** | Same directory; script uses ai-service's `node_modules` (`bullmq`, `ioredis`) |
| `.env` loaded for connection strings only (not modified) | **YES** | `dotenv.config()` reads `DATABASE_URL` and `REDIS_URL` |

### 2.2 Differences from 06E

| Aspect | 06E | 07F1 |
|--------|-----|------|
| Purpose | Full E2E file tool canary (`list_files`, `read_file` through API Gateway → container-manager → Docker) | Queue transport + metadata preservation canary (orchestration fields through BullMQ → worker → `usage_records.metadata` JSONB) |
| API Gateway | **REQUIRED** — file tool handlers call API Gateway HTTP endpoints | **NOT REQUIRED** — plain execution path does not call API Gateway |
| container-manager | **REQUIRED** — file tools route through container-manager to Docker workspace | **NOT REQUIRED** — no file tools, no workspace interaction |
| Docker workspace container | **REQUIRED** — real session with running container, README.md | **NOT REQUIRED** — no file system access needed |
| `harnessVersion` | `'v1'` — activates harness tool loop | **OMITTED** — plain execution path sufficient for metadata test |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` (process-scoped) — needed for tool dispatch | `false` (process-scoped) — metadata test only, no tool dispatch |
| Provider | `test-harness-stub` (harness path) | `stub` (plain path) — guaranteed to work without harness routing |
| Execution path | Harness path → `executeAgentHarnessLoop()` → tool dispatch → 718ms | Plain path → `aiExecutionService.execute()` → ~33ms |
| Service count | 6 (Docker, PostgreSQL, Redis, container-manager, API Gateway, AI Service Worker) | **3** (Docker, PostgreSQL+Redis containers, AI Service Worker) |
| Session ID | Real session from container-manager (`mrcuipo85sk7g6n6wv`) | Synthetic UUID — no real session needed |
| Key verification | Tool results contain actual file data | `usage_records.metadata` JSONB contains 9 orchestration fields |

### 2.3 Container-Manager Decision

**container-manager is NOT required for 07F1.**

Evidence:
- 07F1 tests metadata propagation through BullMQ → worker → `usage_records`, not file tool dispatch.
- The plain execution path (`stub` provider, no `harnessVersion`) does not invoke any file tool handlers.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` prevents the harness branch entirely.
- The `ApiGatewayHttpClient` injected into `WorkerProcessor` is never called on the plain path.
- No workspace container, session, or Docker filesystem interaction is needed.

---

## 3. Exact Step 3 Runtime Topology

| Component | Required? | Purpose | Port |
|-----------|-----------|---------|------|
| Docker Desktop | YES | Hosts PostgreSQL and Redis containers via docker-compose | — |
| PostgreSQL (`aisandbox-postgres`) | YES | Worker claims/finalizes `usage_records`; canary script inserts intent row; verification queries metadata JSONB | 5432 |
| Redis (`aisandbox-redis`) | YES | BullMQ queue transport; queue name `ai-execution` | 6379 |
| AI Service Worker | YES | Processes BullMQ job; writes orchestration metadata to `usage_records` | 4099 |
| API Gateway | **NO** | Not needed — canary submits directly to BullMQ; plain execution path does not call API Gateway | (4000) |
| container-manager | **NO** | Not needed — no file tools, no workspace container | (4002) |
| Docker workspace container | **NO** | Not needed — no file system access | — |

### 3.1 Why API Gateway Is Not Required

The 06E canary required API Gateway because tool handlers (`list_files`, `read_file`) make HTTP calls to API Gateway's `InternalWorkspaceFilesController`. 07F1 does not use the harness tool loop (plain execution path), so no file tool handlers are invoked. The canary script submits directly to BullMQ (bypassing the API Gateway controller entirely), matching the 06E submission pattern.

### 3.2 Provider/API Calls Decision

**Blocked. No real provider/API calls.**

| Mechanism | Enforcement |
|-----------|-------------|
| Provider field | `provider: 'stub'` in job payload — NOT `openai`, `anthropic`, `groq`, `xai`, or `deepseek` |
| Adapter field | `adapter: 'stub'` in job payload |
| Plain execution path | `harnessVersion` omitted → `useHarness = false` → `aiExecutionService.execute()` with `stub` adapter |
| Billing | `stub` adapter returns `tokensUsed: 0` — zero billing |
| External HTTP | `stub` adapter makes zero outbound HTTP calls |
| Process env | No provider API keys needed or referenced by `stub` adapter |

---

## 4. Exact Service Startup Sequence

| # | Phase | Action | Prerequisite |
|---|-------|--------|-------------|
| 1 | **Preflight** | Verify Docker Desktop is running (`docker info`) | Keith approves Step 3 |
| 2 | **Preflight** | Verify PostgreSQL container healthy (`docker ps --filter "name=aisandbox-postgres"`) | Step 1 |
| 3 | **Preflight** | Verify Redis container healthy (`docker ps --filter "name=aisandbox-redis"`) | Step 1 |
| 4 | **Preflight** | Start containers if not running (`docker compose up -d postgres redis`) | Step 1 |
| 5 | **Preflight** | Wait for health checks (10s) | Step 4 |
| 6 | **Preflight** | Verify PostgreSQL accepts connections (`pg_isready`) | Step 5 |
| 7 | **Preflight** | Inspect BullMQ queue — must be empty (`LLEN`, `ZCARD`) | Step 6 |
| 8 | **Preflight** | Verify `usage_records` table exists and has expected schema | Step 6 |
| 9 | **Service startup** | Start AI Service Worker with process-scoped env (new terminal) | Steps 6-8 pass; **Keith runtime approval** |
| 10 | **Service startup** | Verify worker logs `Worker connected to ai-execution queue` | Step 9 |
| 11 | **Canary execution** | Run canary script — insert intent row + submit BullMQ job | Step 10 |
| 12 | **Verification** | Wait for worker to process job (observe `execution_completed` log) | Step 11 |
| 13 | **Verification** | Query `usage_records.metadata` JSONB — verify 9 orchestration fields | Step 12 |
| 14 | **Verification** | Verify `execution_status = 'completed'`, `tokens_used = 0` | Step 12 |
| 15 | **Verification** | Verify no `.env` files modified (pre/post scan) | Step 14 |
| 16 | **Verification** | Verify queue is clean (post-run `LLEN`, `ZCARD`) | Step 14 |
| 17 | **Cleanup** | `DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%'` | Step 14 |
| 18 | **Cleanup** | Verify canary row removed — `SELECT` returns 0 rows | Step 17 |
| 19 | **Shutdown** | Stop AI Service Worker (`Ctrl+C`) | Step 18 |
| 20 | **Report** | Create execution report doc | Step 19 |

---

## 5. Process-Scoped Env Overrides

### 5.1 AI Service Worker — Process-Scoped Only

| Variable | Value | Purpose |
|----------|-------|---------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | Prevents harness branch activation; ensures plain execution path |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | Safety: no write tool registration even if harness path were activated |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | Safety: no validation tool registration |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | Safety: no browser smoke tool registration |

### 5.2 What Is NOT Overridden

| Item | Reason |
|------|--------|
| `.env` files | NOT modified — all overrides are process-scoped via PowerShell `$env:` |
| `REDIS_URL` | Read from `.env` by `dotenv.config()` — not overridden |
| `DATABASE_URL` | Read from `.env` by `dotenv.config()` — not overridden |
| Provider API keys | Not needed — `stub` adapter makes zero external calls |
| `AI_PROVIDER` | Not overridden — job payload explicitly sets `provider: 'stub'` |

### 5.3 No .env File Edits

All env overrides are applied via PowerShell process-scoped variables before starting the worker:

```powershell
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "false"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_BROWSER_SMOKE = "false"
```

These variables exist only in the terminal session where the worker is started. They do not persist after the terminal is closed.

---

## 6. Canary Script / Report File Decision

### 6.1 Files That MAY Be Created During Step 3

| # | Action | Absolute Path | Purpose |
|---|--------|---------------|---------|
| 1 | CREATE | `C:\Users\knlee\aiSandBox2026B\services\ai-service\scripts\canary-07f1-submit-job.ts` | Temporary canary script for BullMQ job submission with orchestration fields |
| 2 | CREATE | `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md` | Canary execution report documenting results |

### 6.2 Why a Script Is Required

Existing commands cannot directly enqueue a BullMQ job with the precise orchestration field structure. The canary script must:
1. Connect to PostgreSQL and insert a `usage_records` intent row with `execution_status = 'pending'`
2. Connect to Redis and submit a BullMQ job to `ai-execution` queue with the exact orchestration fields
3. Exit after submission

This follows the proven 06E canary script pattern (`services/ai-service/scripts/canary-06e-submit-job.ts`).

### 6.3 Script Placement

Located at `services/ai-service/scripts/` (not repo root `scripts/`) because:
- Dependencies (`bullmq`, `ioredis`, `pg`) are available in ai-service's `node_modules`
- `.env` loading via `dotenv.config()` follows the ai-service pattern
- Consistent with the 06D and 06E canary script locations

### 6.4 Script Execution Method

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsx scripts/canary-07f1-submit-job.ts
```

Uses `npx tsx` (same as 06E) — TypeScript execution without compilation.

### 6.5 Files That Must NOT Be Changed

- All production source files (`services/**/*.ts` outside the canary script)
- `orchestration.contracts.ts`, `orchestration.service.ts`, `queue.service.ts`
- `worker.processor.ts`, `job.types.ts`, `execution-result.service.ts`
- All test files
- Frontend files
- Database/migration files
- `.env*` files
- `docker*` files
- `package.json` / `package-lock.json`
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`

---

## 7. Exact Canary Job Payload

### 7.1 Job Payload Structure

The canary script constructs a job payload that mirrors what `OrchestrationService.startReferralExecution()` would produce (lines 637-661 of `orchestration.service.ts`), but submitted directly to BullMQ.

```typescript
const EXECUTION_ID = `canary-07f1-${randomUUID()}`;

const jobPayload = {
  // Core execution fields (required by worker)
  executionId: EXECUTION_ID,
  userId: 'canary-07f1-user',
  apiKeyId: 'canary-07f1-apikey',
  sessionId: '00000000-07f1-4000-a000-000c07f10001',   // synthetic UUID
  conversationId: '00000000-07f1-4000-a000-000c07f10002',
  provider: 'stub',
  adapter: 'stub',
  prompt: 'Canary 07F1: metadata preservation test. Return immediately.',
  model: 'stub',
  submittedAt: new Date().toISOString(),

  // AGENT-PLATFORM-06: Upstream identity fields
  agentRole: 'builder',
  builderProfileId: 'builder-canary-07f1',

  // AGENT-PLATFORM-06: Collaboration identity
  collaborationRunId: 'collab_canary-07f1-run',
  referralTraceId: 'trace_canary-07f1-trace',

  // AGENT-PLATFORM-07C2: Orchestration referral metadata
  parentReferralTraceId: 'trace_canary-07f1-parent',
  referringBuilderProfileId: 'builder-canary-07f1-source',
  orchestrationPriority: 5,
  referralId: 'ref_canary-07f1-referral',
  isReferralExecution: true,
};
```

### 7.2 Field-by-Field Rationale

| # | Field | Value | Source Evidence |
|---|-------|-------|----------------|
| 1 | `agentRole` | `'builder'` | Worker preserves at `worker.processor.ts` line 1014; `AiExecutionJob` type includes optional `agentRole` |
| 2 | `builderProfileId` | `'builder-canary-07f1'` | Worker preserves at line 1015; distinct canary value for traceability |
| 3 | `collaborationRunId` | `'collab_canary-07f1-run'` | Worker preserves at line 1016; prefixed for identification |
| 4 | `referralTraceId` | `'trace_canary-07f1-trace'` | Worker preserves at line 1017; matches `OrchestrationService` trace pattern |
| 5 | `parentReferralTraceId` | `'trace_canary-07f1-parent'` | Worker preserves at line 1020; non-null to prove field survives transport |
| 6 | `referringBuilderProfileId` | `'builder-canary-07f1-source'` | Worker preserves at line 1021; mimics the source builder identity |
| 7 | `orchestrationPriority` | `5` | Worker preserves at line 1022; numeric value survives BullMQ serialization |
| 8 | `referralId` | `'ref_canary-07f1-referral'` | Worker preserves at line 1023; prefixed for identification |
| 9 | `isReferralExecution` | `true` | Worker preserves at line 1024; boolean value survives BullMQ serialization |
| 10 | `provider` | `'stub'` | Plain execution path; `AiExecutionJob` union includes `'stub'`; zero billing |
| 11 | `adapter` | `'stub'` | Matches provider; `AiExecutionJob` union includes `'stub'` |
| 12 | `executionId` | `canary-07f1-<uuid>` | Prefixed for cleanup targeting; prevents collision with real data |

### 7.3 Harness Fields Intentionally Omitted

| Field | Why Omitted |
|-------|-------------|
| `harnessVersion` | Not set → `useHarness = false` → plain execution path (simplest, safest) |
| `harnessProfileId` | Not needed — plain path does not call `resolveBuilderHarnessConfig()` |
| `modelProfileId` | Not needed — plain path |
| `toolPermissionProfileId` | Not needed — plain path |

### 7.4 Usage Records Intent Row

Before submitting the BullMQ job, the canary script inserts an intent row into `usage_records`:

```sql
INSERT INTO usage_records
  (execution_id, api_key_id, user_id, session_id, conversation_id,
   provider, adapter, model, execution_status, metadata)
VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8, 'pending', $9::jsonb)
```

With values:
- `execution_id`: same `EXECUTION_ID` as BullMQ job
- `api_key_id`: `'canary-07f1-apikey'`
- `user_id`: `'canary-07f1-user'`
- `session_id`: `'00000000-07f1-4000-a000-000c07f10001'` (UUID format)
- `conversation_id`: `'00000000-07f1-4000-a000-000c07f10002'`
- `provider`: `'stub'`
- `adapter`: `'stub'`
- `model`: `'stub'`
- `execution_status`: `'pending'`
- `metadata`: `{ "canary": "AGENT-PLATFORM-07F1", "step": 3 }`

---

## 8. usage_records Verification Method

### 8.1 Verification Query

After the worker logs `execution_completed` for the canary execution ID:

```sql
SELECT
  execution_id,
  execution_status,
  tokens_used,
  metadata
FROM usage_records
WHERE execution_id LIKE 'canary-07f1-%';
```

### 8.2 Expected Results

| Field | Expected Value |
|-------|---------------|
| `execution_status` | `'completed'` |
| `tokens_used` | `0` |
| `metadata->'agentRole'` | `'"builder"'` |
| `metadata->'builderProfileId'` | `'"builder-canary-07f1"'` |
| `metadata->'collaborationRunId'` | `'"collab_canary-07f1-run"'` |
| `metadata->'referralTraceId'` | `'"trace_canary-07f1-trace"'` |
| `metadata->'parentReferralTraceId'` | `'"trace_canary-07f1-parent"'` |
| `metadata->'referringBuilderProfileId'` | `'"builder-canary-07f1-source"'` |
| `metadata->'orchestrationPriority'` | `5` |
| `metadata->'referralId'` | `'"ref_canary-07f1-referral"'` |
| `metadata->'isReferralExecution'` | `true` |
| `metadata->'aiExecutionResult'->'provider'` | `'"stub"'` |
| `metadata->'aiExecutionResult'->'tokensUsed'` | `0` |

### 8.3 Detailed Metadata JSONB Verification

```sql
-- Verify all 9 orchestration fields in one query:
SELECT
  execution_id,
  execution_status,
  tokens_used,
  metadata->>'agentRole' AS agent_role,
  metadata->>'builderProfileId' AS builder_profile_id,
  metadata->>'collaborationRunId' AS collaboration_run_id,
  metadata->>'referralTraceId' AS referral_trace_id,
  metadata->>'parentReferralTraceId' AS parent_referral_trace_id,
  metadata->>'referringBuilderProfileId' AS referring_builder_profile_id,
  (metadata->>'orchestrationPriority')::int AS orchestration_priority,
  metadata->>'referralId' AS referral_id,
  (metadata->>'isReferralExecution')::boolean AS is_referral_execution
FROM usage_records
WHERE execution_id LIKE 'canary-07f1-%';
```

### 8.4 Verification Method

| Method | Approach |
|--------|----------|
| Primary | `docker exec aisandbox-postgres psql` with the query above |
| Alternative | Canary script could include a post-wait verification step (optional enhancement) |
| Timestamp correlation | `metadata->>'aiExecutionResult'` timestamp matches canary submission window |
| Execution ID | Prefixed `canary-07f1-` for unambiguous identification |

---

## 9. Cleanup Method

### 9.1 Database Cleanup

```sql
-- Remove canary row from usage_records:
DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';
```

### 9.2 Queue Cleanup

Successful jobs are auto-removed by BullMQ (`removeOnComplete: true` in `QueueService.enqueueExecution()`). No manual queue cleanup needed for successful execution.

If the job fails, `removeOnFail: false` means it stays in the failed set. Manual cleanup:

```powershell
# Only if job failed — remove from failed set:
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"
# If count > 0, investigate before cleaning
```

### 9.3 Temporary Files

| File | Cleanup |
|------|---------|
| `services/ai-service/scripts/canary-07f1-submit-job.ts` | May be deleted after canary passes, or retained for reference |
| `docs/AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md` | Retained — governance record |

### 9.4 Logs

Worker logs are in the terminal where the AI Service was started. No log file cleanup needed — logs exist only in the terminal session.

### 9.5 How to Handle Failed Jobs

| Scenario | Action |
|----------|--------|
| Job completes successfully | Auto-removed from queue; cleanup `usage_records` row only |
| Job fails (worker error) | Inspect worker error log; job remains in BullMQ failed set; clean `usage_records` row; investigate failure before re-running |
| Job hangs (no completion within 30s) | STOP — investigate worker state; do not submit additional jobs; check if worker is stuck |
| Multiple canary rows exist | `DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%'` removes all |

### 9.6 Avoiding Unrelated Data Deletion

| Safeguard | Mechanism |
|-----------|-----------|
| Execution ID prefix | All canary execution IDs start with `canary-07f1-`; `DELETE WHERE execution_id LIKE 'canary-07f1-%'` cannot match real execution UUIDs |
| User ID prefix | `canary-07f1-user` cannot collide with real user IDs |
| Pre-cleanup count check | Run `SELECT COUNT(*) FROM usage_records WHERE execution_id LIKE 'canary-07f1-%'` before DELETE to confirm expected row count (should be exactly 1) |

---

## 10. Queue Safety

### 10.1 Pre-Run Queue Inspection

Before submitting the canary job, verify the queue is empty:

```powershell
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
# Expected: 0

docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:active"
# Expected: 0

docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"
# Expected: 0
```

**STOP condition:** If any of these return non-zero, investigate before proceeding. Do not submit the canary job if unrelated jobs are present.

### 10.2 Job Submission

- Exactly **one job** submitted per canary run
- Queue name: `ai-execution`
- Job name: `execute-ai` (same as `QueueService.enqueueExecution()`)
- Job options: `attempts: 1, removeOnComplete: true, removeOnFail: false`

### 10.3 Post-Run Queue Inspection

After canary completion:

```powershell
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
# Expected: 0

docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:active"
# Expected: 0

docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"
# Expected: 0 (success) or 1 (if job failed — investigate)
```

### 10.4 Failed Job Cleanup

If the canary job fails and remains in the BullMQ failed set:

```powershell
# Inspect the failed job:
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZRANGE "bull:ai-execution:failed" 0 -1

# If safe to remove (only canary job):
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD DEL "bull:ai-execution:failed"
```

**Do NOT use `FLUSHDB`** unless Keith explicitly approves — it removes all Redis data, not just BullMQ jobs.

---

## 11. Database Safety

### 11.1 Exact Tables Touched

| Table | Operation | Actor | Purpose |
|-------|-----------|-------|---------|
| `usage_records` | INSERT | Canary script | Intent row with `execution_status = 'pending'` |
| `usage_records` | UPDATE (pending → running) | Worker | Claim execution |
| `usage_records` | SELECT | Worker | Cancel check, metadata read |
| `usage_records` | UPDATE (running → completed) | Worker | Finalization with metadata JSONB |
| `usage_records` | SELECT | Verification query | Verify orchestration fields in metadata |
| `usage_records` | DELETE | Cleanup | Remove canary row |

### 11.2 Expected Operations Summary

| Operation | Count | Details |
|-----------|-------|---------|
| INSERT | 1 | Canary intent row |
| UPDATE | 2 | pending→running (claim), running→completed (finalization) |
| SELECT | ~4 | Cancel check, metadata read, verification, cleanup count check |
| DELETE | 1 | Cleanup |

### 11.3 No Migration

No database migration is required. The `usage_records` table already exists and has the `metadata JSONB` column. The canary uses standard INSERT/UPDATE/SELECT/DELETE on existing columns.

### 11.4 Cleanup Criteria

```sql
-- Cleanup targets only canary rows:
DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';

-- Verify cleanup:
SELECT COUNT(*) FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';
-- Expected: 0
```

### 11.5 Schema Verification (Preflight)

Before submitting the canary job, verify the `usage_records` table has the expected columns:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'usage_records'
AND column_name IN ('execution_id', 'execution_status', 'metadata', 'tokens_used', 'provider', 'model')
ORDER BY column_name;
```

**STOP condition:** If schema does not match expected columns (especially `metadata` as `jsonb`), do not proceed.

---

## 12. Provider/API Safety

### 12.1 Provider Safety Summary

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Canary script accidentally uses real provider | **NONE** | Script hardcodes `provider: 'stub'`; value is a string literal, not configurable |
| Worker routes to real adapter | **NONE** | `stub` adapter is a deterministic in-memory adapter; does not make HTTP calls |
| Model field triggers real inference | **NONE** | `stub` adapter ignores the `model` field |
| API key required for provider | **NONE** | `stub` adapter does not require any API key |
| Billing triggered | **NONE** | `stub` adapter returns `tokensUsed: 0` |

### 12.2 How Test Is Guaranteed Safe

1. Job payload sets `provider: 'stub'` as a hardcoded string literal in the canary script
2. The `stub` adapter is a built-in deterministic adapter — zero external HTTP calls, zero tokens
3. `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` ensures no tool dispatch (no API Gateway calls)
4. No API key environment variables are referenced by the `stub` adapter
5. `harnessVersion` is omitted → plain execution path → no harness adapter selection

**STOP condition:** If the worker log shows any non-`stub` provider or non-zero `tokens`, STOP immediately.

---

## 13. PASS/FAIL Criteria

### 13.1 PASS Criteria — ALL Must Be Satisfied

| # | Criterion | Objective Measure |
|---|-----------|-------------------|
| 1 | Docker/PostgreSQL/Redis healthy | `docker ps` shows healthy containers; `pg_isready` passes |
| 2 | BullMQ queue initially empty | `LLEN bull:ai-execution:wait` = 0 before submission |
| 3 | AI Service Worker starts | Worker log shows `Worker connected to ai-execution queue` |
| 4 | Canary intent row inserted | Script logs `Inserted usage_records row: execution_id=canary-07f1-..., status=pending` |
| 5 | BullMQ job submitted | Script logs `BullMQ job submitted: jobId=...` |
| 6 | Worker processes job | Worker log shows `Worker received job ... executionId=canary-07f1-...` |
| 7 | Worker claims execution | Worker log shows `Worker claimed executionId=canary-07f1-...` |
| 8 | Worker completes execution | Worker log shows `execution_completed` with `execution_status: 'completed'` |
| 9 | `usage_records` row exists | `SELECT` returns 1 row for `canary-07f1-%` |
| 10 | `execution_status = 'completed'` | Row status is `completed` |
| 11 | `tokens_used = 0` | Zero tokens |
| 12 | `metadata.agentRole` = `'builder'` | JSONB field present and matches |
| 13 | `metadata.builderProfileId` = `'builder-canary-07f1'` | JSONB field present and matches |
| 14 | `metadata.collaborationRunId` = `'collab_canary-07f1-run'` | JSONB field present and matches |
| 15 | `metadata.referralTraceId` = `'trace_canary-07f1-trace'` | JSONB field present and matches |
| 16 | `metadata.parentReferralTraceId` = `'trace_canary-07f1-parent'` | JSONB field present and matches |
| 17 | `metadata.referringBuilderProfileId` = `'builder-canary-07f1-source'` | JSONB field present and matches |
| 18 | `metadata.orchestrationPriority` = `5` | JSONB field present and numeric value matches |
| 19 | `metadata.referralId` = `'ref_canary-07f1-referral'` | JSONB field present and matches |
| 20 | `metadata.isReferralExecution` = `true` | JSONB field present and boolean value matches |
| 21 | Provider = `stub` | Worker logs confirm `stub`; metadata `aiExecutionResult.provider` = `'stub'` |
| 22 | No `.env` changes | Pre/post scan shows no harness flags in `.env*` |
| 23 | No source changes | `git diff --stat` shows no changes under `services/` (except canary script) |
| 24 | Cleanup successful | `DELETE` removes canary row; `SELECT COUNT(*)` returns 0 |
| 25 | Queue clean after canary | `LLEN` and `ZCARD` = 0 |
| 26 | No AGENT-HARNESS write canary | No write tool dispatch in worker logs |
| 27 | Execution path = plain | Worker logs `selectedPath: 'plain'` (or no harness route evaluation if `harnessVersion` omitted) |

### 13.2 FAIL Criteria — ANY Triggers FAIL

| # | Criterion | Trigger |
|---|-----------|---------|
| 1 | Docker/PostgreSQL/Redis unavailable | Service health check fails |
| 2 | Worker fails to start | Startup error in terminal |
| 3 | Job not processed within 30s | Worker does not log completion |
| 4 | Metadata missing any of 9 orchestration fields | Criteria 12-20 in §13.1 fail |
| 5 | Metadata field value mismatch | Any orchestration field value differs from expected |
| 6 | Non-zero tokens | `tokens_used > 0` or metadata `tokensUsed > 0` |
| 7 | Non-stub provider detected | Worker logs show non-`stub` provider |
| 8 | Write tool dispatched | `write_file`, `delete_file`, `run_validation`, or `browser_smoke` in logs |
| 9 | `.env` file modified | Pre/post diff shows changes |
| 10 | Source file modified | Any `services/**` production file changed (canary script excluded) |
| 11 | Queue unsafe state | Pre/post queue inspection shows stale or unrelated jobs |
| 12 | Cleanup fails | Canary rows remain after DELETE |
| 13 | AGENT-HARNESS write canary activated | Any write harness flag or dispatch detected |

---

## 14. Stop Conditions

If ANY of the following occur, **STOP immediately** and escalate to Keith:

| # | Stop Condition | Action |
|---|---------------|--------|
| 1 | Docker/PostgreSQL/Redis unavailable after Keith approval | STOP — infrastructure prerequisite not met |
| 2 | AI Service Worker fails to start | STOP — cannot process canary job |
| 3 | BullMQ queue contains unrelated jobs before submission | STOP — investigate queue state before proceeding |
| 4 | DB schema differs from expected (`usage_records` missing columns) | STOP — canary cannot proceed without correct schema |
| 5 | Canary intent row insertion fails | STOP — investigate PostgreSQL error |
| 6 | Worker routes to non-`stub` provider | STOP — provider safety violated |
| 7 | Worker dispatches write tools (`write_file`, `delete_file`) | STOP — safety boundary violated |
| 8 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` found in `.env` after run | STOP — env safety violated |
| 9 | Worker hangs (no completion within 30s) | STOP — investigate; do not submit additional jobs |
| 10 | Worker processes unexpected additional jobs | STOP — queue isolation compromised |
| 11 | Source changes needed for canary to pass | STOP — register bug/gap as separate task |
| 12 | Database migration needed | STOP — canary must not require schema changes |
| 13 | AGENT-HARNESS write canary accidentally activated | STOP — verify env flags |
| 14 | Cleanup cannot be guaranteed (DELETE fails or affects wrong rows) | STOP — investigate before continuing |
| 15 | Non-zero tokens detected | STOP — billing safety check failed |

---

## 15. Exact Step 3 Commands

### 15.1 Preflight Checks (May Run After Keith Approves Step 3)

```powershell
# [PREFLIGHT-1] Verify Docker Desktop is running
docker info

# [PREFLIGHT-2] Verify PostgreSQL container is healthy
docker ps --filter "name=aisandbox-postgres" --format "{{.Status}}"

# [PREFLIGHT-3] Verify Redis container is healthy
docker ps --filter "name=aisandbox-redis" --format "{{.Status}}"

# [PREFLIGHT-4] Start containers if not running
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# [PREFLIGHT-5] Wait for health checks
Start-Sleep -Seconds 10

# [PREFLIGHT-6] Verify PostgreSQL accepts connections
docker exec aisandbox-postgres pg_isready -U aisandbox -d aisandbox

# [PREFLIGHT-7] Verify usage_records table schema
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usage_records' AND column_name IN ('execution_id', 'execution_status', 'metadata', 'tokens_used', 'provider', 'model') ORDER BY column_name;"

# [PREFLIGHT-8] Inspect BullMQ queue — must be empty
docker exec aisandbox-redis redis-cli -a aisandboxredis123 LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a aisandboxredis123 LLEN "bull:ai-execution:active"
docker exec aisandbox-redis redis-cli -a aisandboxredis123 ZCARD "bull:ai-execution:failed"

# [PREFLIGHT-9] Verify no pre-existing canary rows
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"
```

### 15.2 Service Startup (REQUIRES EXPLICIT KEITH RUNTIME APPROVAL)

```powershell
# [SERVICE-1] Start AI Service Worker (new terminal, process-scoped env)
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "false"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_BROWSER_SMOKE = "false"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run dev

# [SERVICE-2] Verify worker started — look for log line:
# "Worker connected to ai-execution queue"
```

**Note:** API Gateway and container-manager are NOT started for 07F1.

### 15.3 Canary Script Execution (REQUIRES EXPLICIT KEITH RUNTIME APPROVAL)

```powershell
# [CANARY-1] Run canary job submission script (separate terminal from worker)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsx scripts/canary-07f1-submit-job.ts

# [CANARY-2] Observe worker terminal for completion log:
# "execution_completed" with executionId=canary-07f1-...
# Wait up to 30 seconds. If no completion, STOP.
```

### 15.4 Verification (After Worker Completes Job)

```powershell
# [VERIFY-1] Query usage_records for canary row
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT execution_id, execution_status, tokens_used FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"

# [VERIFY-2] Query metadata JSONB for all 9 orchestration fields
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT execution_id, metadata->>'agentRole' AS agent_role, metadata->>'builderProfileId' AS builder_profile_id, metadata->>'collaborationRunId' AS collab_run_id, metadata->>'referralTraceId' AS referral_trace_id, metadata->>'parentReferralTraceId' AS parent_trace_id, metadata->>'referringBuilderProfileId' AS referring_builder_id, (metadata->>'orchestrationPriority')::int AS orch_priority, metadata->>'referralId' AS referral_id, (metadata->>'isReferralExecution')::boolean AS is_referral FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"

# [VERIFY-3] Verify queue is clean
docker exec aisandbox-redis redis-cli -a aisandboxredis123 LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a aisandboxredis123 LLEN "bull:ai-execution:active"
docker exec aisandbox-redis redis-cli -a aisandboxredis123 ZCARD "bull:ai-execution:failed"

# [VERIFY-4] Verify no .env files were modified
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; git diff --name-only -- "*.env*"

# [VERIFY-5] Verify no production source changes
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; git diff --stat -- services/
```

### 15.5 Cleanup (REQUIRED After Canary)

```powershell
# [CLEANUP-1] Remove canary row from usage_records
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"

# [CLEANUP-2] Verify canary row removed
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"

# [CLEANUP-3] Verify queue final state
docker exec aisandbox-redis redis-cli -a aisandboxredis123 LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a aisandboxredis123 ZCARD "bull:ai-execution:failed"

# [CLEANUP-4] Stop AI Service Worker (Ctrl+C in worker terminal)
```

### 15.6 Rollback (If Cleanup Script Fails)

```powershell
# Manual cleanup via psql:
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT COUNT(*) FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"
```

### 15.7 Command Category Summary

| Category | Section | Keith Approval Required |
|----------|---------|------------------------|
| Preflight checks | §15.1 | NO — read-only inspection (may run after Keith approves Step 3 in general) |
| Service startup | §15.2 | **YES — explicit Keith runtime approval** |
| Canary execution | §15.3 | **YES — explicit Keith runtime approval** |
| Verification | §15.4 | NO — read-only queries |
| Cleanup | §15.5 | NO — expected post-canary hygiene |
| Rollback | §15.6 | NO — safety recovery |

---

## 16. Keith Approval Gate

### 16.1 Exact Approval Wording

Keith must approve the following before Step 3 runtime execution begins:

> **"Approve AGENT-PLATFORM-07F1 Step 3 runtime canary execution: Docker/PostgreSQL/Redis preflight checks, AI Service Worker startup (process-scoped env, `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`), one BullMQ `ai-execution` canary job with `stub` provider (zero tokens, zero provider/API calls), `usage_records` metadata verification for 9 orchestration fields, `usage_records` cleanup, and no API Gateway/container-manager/browser/write-tool/AGENT-HARNESS-write-canary execution."**

### 16.2 What Keith Approves

| # | Approval Item |
|---|---------------|
| 1 | Docker Desktop running and PostgreSQL/Redis containers healthy |
| 2 | AI Service Worker startup on port 4099 with process-scoped env (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`) |
| 3 | BullMQ job submission (1 canary job with `stub` provider, zero tokens) |
| 4 | PostgreSQL `usage_records` intent row creation (by canary script) |
| 5 | PostgreSQL `usage_records` metadata verification queries (by verification step) |
| 6 | PostgreSQL cleanup (`DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f1-%'`) |
| 7 | Creation of canary script (`services/ai-service/scripts/canary-07f1-submit-job.ts`) |
| 8 | Creation of execution report doc (`docs/AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md`) |

### 16.3 What Keith Approval Does NOT Cover

| Item | Reason |
|------|--------|
| API Gateway startup | Not required for 07F1 |
| container-manager startup | Not required for 07F1 |
| Browser smoke | Not applicable |
| Write tool activation | Explicitly blocked by `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` |
| Provider/API calls | Blocked — `stub` provider only |
| `.env` file edits | Not permitted — process-scoped only |
| Production source changes | Not permitted |
| AGENT-HARNESS write canary | Separate track — not involved |
| 07F2 or 07F3 registration | Planned only — not registered in this step |

### 16.4 Approval Flow

```
Keith approves 07F1 Step 3 runtime execution (this gate)
  → Preflight checks run (§15.1)
    → Keith confirms preflight PASS
      → Service startup + canary execution (§15.2, §15.3)
        → Verification (§15.4)
          → Cleanup (§15.5)
            → Execution report created
              → 07F1 Step 4 (consolidation) — separate step/window
```

---

## 17. 07F1 Step 3 Readiness Conclusion

### 17.1 Ready / Not Ready

**READY for Step 3 execution, contingent on Keith approval.**

All governance prerequisites are satisfied. The runtime topology is simpler than 06E (3 services vs 6). The canary payload, verification method, cleanup, PASS/FAIL criteria, stop conditions, and exact commands are fully specified.

### 17.2 Whether Further Split Is Required

**No further split required.** 07F1 is a single bounded canary: one job, one verification, one cleanup. The runtime scope is smaller than 06E. Splitting further would add governance overhead without reducing risk.

### 17.3 Recommended Model

**GPT-5.3 Codex High** — runtime-sensitive backend work with BullMQ + PostgreSQL interaction. Process-scoped env. Single controlled canary with DB cleanup. Higher risk than pure governance but bounded by stop conditions.

### 17.4 Exact Next Prompt Type

**Runtime execution prompt** — implement the canary script and execute Step 3 after Keith approves.

Required actions:
1. Keith approves Step 3 using the wording in §16.1
2. Run preflight checks (§15.1)
3. Start AI Service Worker (§15.2)
4. Create and run canary script (§15.3)
5. Run verification queries (§15.4)
6. Run cleanup (§15.5)
7. Create execution report
8. Proceed to Step 4 (consolidation) in a separate window

---

## 18. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — 07F1 ACTIVE, Step 1 COMPLETE, parent 07F ACTIVE |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance mirror — 07F1/07F2/07F3 status |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07F position, one-active-task rule |
| 4 | `docs/AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-PREFLIGHT.md` | Parent preflight — split decision, topology options, safety decisions |
| 5 | `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | 06E precedent — full E2E topology, canary pattern, cleanup |
| 6 | `docs/AGENT-HARNESS-07-CHECKPOINT.md` | AGENT-HARNESS-07 — per-builder config, locked invariants |
| 7 | `docs/AGENT-PLATFORM-07E-CHECKPOINT.md` | 07E completion — in-process canary, mock verification pattern |
| 8 | `services/api-gateway/package.json` | Script names (`dev`, `build`, `test`) |
| 9 | `services/api-gateway/src/queue/queue.service.ts` | `QueueService` — `enqueueExecution()`, queue name `ai-execution`, BullMQ options |
| 10 | `services/api-gateway/src/orchestration/orchestration.service.ts` | `OrchestrationService.startReferralExecution()` — job payload shape (lines 637-661), metadata fields |
| 11 | `services/api-gateway/src/orchestration/orchestration.contracts.ts` | Orchestration contracts — `OrchestrationJobMetadata`, ID aliases, read-only indicators |
| 12 | `services/api-gateway/src/ai/ai-execution.controller.ts` | API Gateway controller — enqueue flow, provider validation, ledger intent write |
| 13 | `services/api-gateway/src/ai/execution-result.service.ts` | `ExecutionResultService.requestCancel()` — SQL pattern for cancel (07F2 reference) |
| 14 | `services/ai-service/package.json` | Script names (`dev`, `build`, `test`) |
| 15 | `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` — all 5 orchestration fields (07C2), provider union type |
| 16 | `services/ai-service/src/worker/worker.processor.ts` | Worker — metadata preservation (lines 1013-1024), harness route evaluation, plain path, finalization |
| 17 | `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | 07B tests — job identity field tests, worker integration tests |
| 18 | `services/ai-service/scripts/canary-06e-submit-job.ts` | 06E canary script — pattern for direct BullMQ + PostgreSQL submission |
| 19 | `services/ai-service/scripts/canary-06d-submit-job.ts` | 06D canary script — earlier pattern reference |

---

## 19. Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Exact file created: `docs/AGENT-PLATFORM-07F1-RUNTIME-EXECUTION-READINESS.md` | CONFIRMED |
| 2 | No source/service files changed | CONFIRMED |
| 3 | No frontend files changed | CONFIRMED |
| 4 | No database/migration files changed | CONFIRMED |
| 5 | No `.env` files changed | CONFIRMED |
| 6 | No `docker*` files changed | CONFIRMED |
| 7 | No package files changed | CONFIRMED |
| 8 | No test files changed | CONFIRMED |
| 9 | No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md) | CONFIRMED |
| 10 | No git commits/pushes | CONFIRMED |
| 11 | No tests/builds run | CONFIRMED |
| 12 | No Docker/Postgres/Redis started | CONFIRMED |
| 13 | No API Gateway/AI Service/Worker started | CONFIRMED |
| 14 | No BullMQ jobs submitted | CONFIRMED |
| 15 | No PostgreSQL queries or mutations | CONFIRMED |
| 16 | No provider/API calls | CONFIRMED |
| 17 | No browser smoke | CONFIRMED |
| 18 | AGENT-PLATFORM-07F2/07F3 not registered | CONFIRMED |
| 19 | AGENT-HARNESS write canary not touched | CONFIRMED |
| 20 | AGENT-PLATFORM-07F1 ready for Step 3 (contingent on Keith approval) | CONFIRMED |

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07F1 Step 2 — Runtime Execution Readiness / Keith Approval Gate
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
