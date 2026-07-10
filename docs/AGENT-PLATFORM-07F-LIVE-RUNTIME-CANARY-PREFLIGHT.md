# AGENT-PLATFORM-07F — Live Runtime Canary Readiness / Preflight Plan

**Task ID:** AGENT-PLATFORM-07F
**Step:** 2 — Live Runtime Canary Readiness / Preflight Plan
**Status:** Step 2 COMPLETE
**Date:** 2026-07-10
**Nature:** Static planning only — no implementation, no runtime execution, no service startup
**Author:** AI-assisted governance pass

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-07F ACTIVE | PASS — registered in TASKS.md and AINOW-EXECUTION-ROADMAP.md; Step 1 COMPLETE (Registration 2026-07-10); Keith approval recorded |
| AGENT-PLATFORM-07E COMPLETE and LOCKED | PASS — 2026-07-10; Unit/in-process canary; 16 canary tests + 40 regression tests; TypeScript clean |
| AGENT-PLATFORM-07D COMPLETE and LOCKED | PASS — 2026-07-10; Collaboration Audit Events; 40 tests; InMemoryOrchestrationAuditRecorder |
| AGENT-PLATFORM-07C COMPLETE and LOCKED | PASS — 2026-07-10; All 3 child slices (07C1/07C2/07C3) COMPLETE and LOCKED |
| AGENT-PLATFORM-07C1 COMPLETE and LOCKED | PASS — 2026-07-09; Orchestration Core Methods + In-Memory Store |
| AGENT-PLATFORM-07C2 COMPLETE and LOCKED | PASS — 2026-07-09; Referral Enqueue + Cancel + AiExecutionJob Extension |
| AGENT-PLATFORM-07C3 COMPLETE and LOCKED | PASS — 2026-07-10; Targeted Tests and Parent Consolidation |
| AGENT-PLATFORM-07B COMPLETE and LOCKED | PASS — 2026-07-09; API Gateway Orchestration Module Skeleton |
| AGENT-PLATFORM-07A COMPLETE and LOCKED | PASS — 2026-07-09; Coordinator Contracts / Schema |
| AGENT-PLATFORM-07 COMPLETE and LOCKED | PASS — 2026-07-09; Read-Only Orchestration Coordinator Planning |
| AGENT-PLATFORM-06 COMPLETE and LOCKED | PASS — 2026-07-09; Upstream Identity Propagation |
| AGENT-PLATFORM-05 COMPLETE and LOCKED | PASS — 2026-07-09; Multi-Builder Runtime Orchestration Plan |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | PASS — 2026-07-07; Multi-Builder Runtime Topology Plan |
| AGENT-HARNESS-07 COMPLETE and LOCKED | PASS — 2026-07-07; Per-Builder Harness Config Adapter |
| AGENT-HARNESS-06E COMPLETE and LOCKED | PASS — 2026-07-09; Full E2E Canary |
| One-active-task rule satisfied | PASS — only AGENT-PLATFORM-07F is ACTIVE |

**Governance readiness: PASS — all 16 criteria satisfied.**

---

## 2. Runtime Topology Decision

### 2.1 Options Evaluated

| Option | Description | Runtime Dependencies | Risk |
|--------|-------------|---------------------|------|
| A | API Gateway + real BullMQ/Redis + AI Service Worker + PostgreSQL cancel path — single bounded canary | Docker, PostgreSQL, Redis, API Gateway, AI Service Worker | HIGH — combines transport + metadata + cancel in one pass |
| B | API Gateway + real Redis queue transport only, with worker/provider constrained (test-harness-stub) — single bounded canary | Docker, PostgreSQL, Redis, API Gateway, AI Service Worker | MEDIUM-HIGH — same services but no cancel verification in this pass |
| C | Split into smaller child slices before live execution | Same, but phased | MEDIUM — each slice is independently verifiable |
| D | API Gateway + BullMQ + Worker with process-scoped env only (06E pattern) + cancel verification as separate slice | Same services, split execution | LOW-MEDIUM — safest: proven 06E topology + bounded cancel slice |

### 2.2 Analysis

| Factor | Assessment |
|--------|-----------|
| What 07F must prove beyond 07E | Real queue transport of orchestration metadata across BullMQ boundary; worker finalization preserves orchestration fields in `usage_records.metadata` JSONB; cancel signal works through real PostgreSQL |
| Precedent | AGENT-HARNESS-06E proved: full stack (Docker/PostgreSQL/Redis/API Gateway/Worker/container-manager) using `test-harness-stub` provider, process-scoped env, single controlled job submission, DB cleanup. Completed in 718ms. PASS. |
| Does 07F need container-manager? | NO — orchestration does not require a workspace container for metadata verification. Unlike 06E (which tested file tools requiring Docker containers), 07F tests queue transport and DB metadata only. |
| Does 07F need provider/API calls? | NO — `test-harness-stub` adapter produces deterministic tool-free completion. Zero billing. Zero external API calls. |
| Can cancel be tested safely? | PARTIALLY — `requestCancel()` requires `execution_status = 'running'` in `usage_records`. With `test-harness-stub`, execution completes in <1s, making timing-based cancel unreliable. A controlled test row insertion is safer than racing the worker. |
| Cancel timing risk | HIGH for race-based approach. Worker with `test-harness-stub` completes in ~33-718ms. Calling `requestCancel()` during that window is unreliable. Safer to verify cancel SQL correctness via controlled DB row. |
| DB mutation risk | MEDIUM — both the worker finalization (writes `usage_records` row) and cancel (`UPDATE usage_records`) mutate PostgreSQL. Cleanup is required. Precedent: 06E cleaned up via `DELETE FROM usage_records WHERE execution_id = '...'`. |

### 2.3 Decision: Option D — Split into Child Slices (Phased 06E-pattern Runtime)

**Rationale:**
1. The queue transport + metadata preservation verification is one logical flow (submit → complete → check metadata). This follows the 06E pattern exactly.
2. The cancel signal path has a timing dependency that makes it risky to combine with transport verification in one pass — worker completes too fast with `test-harness-stub` for race-based cancel.
3. Splitting isolates failures: if transport works but cancel doesn't (or vice versa), we know exactly which domain failed.
4. CLAUDE.md governance: "Always prefer smaller bounded child slices over large mixed changes."
5. Each child slice is independently verifiable and independently safe.
6. The proven 06E topology (Docker + PostgreSQL + Redis + API Gateway + Worker with process-scoped env) is directly reusable for the transport slice.

---

## 3. Split Decision

### 3.1 Decision: B — Split 07F into Child Slices

### 3.2 Recommended Child Slices

| Child | Name | Nature | Risk |
|-------|------|--------|------|
| 07F1 | Queue Transport + Metadata Preservation Canary | Live runtime canary — API Gateway + BullMQ + Worker + PostgreSQL | HIGH |
| 07F2 | Cancel Signal Path Canary | Live runtime canary — PostgreSQL cancel verification | MEDIUM |
| 07F3 | Consolidation | Checkpoint / parent close | LOW |

### 3.3 Slice Details

#### 07F1 — Queue Transport + Metadata Preservation Canary

**Purpose:** Prove orchestration metadata survives the real BullMQ enqueue boundary and that the worker correctly writes orchestration fields to `usage_records.metadata` JSONB.

**Scope:**
- Start Docker/PostgreSQL/Redis/API Gateway/AI Service Worker (06E pattern)
- Submit one orchestration-enriched job via real `QueueService.enqueueExecution()` with `test-harness-stub` provider
- Wait for job completion
- Query `usage_records` and verify `metadata` JSONB contains: `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId`, `orchestrationPriority`, `referralId`, `isReferralExecution`
- Verify structured logs show worker received orchestration fields
- Clean up: `DELETE FROM usage_records WHERE execution_id = '<canary-id>'`
- Stop worker and API Gateway

**Not in scope:** Cancel path verification (deferred to 07F2).

#### 07F2 — Cancel Signal Path Canary

**Purpose:** Prove `ExecutionResultService.requestCancel(executionId)` correctly updates `execution_status` in real PostgreSQL.

**Scope (Option A — controlled row insertion):**
- Reuse running Docker/PostgreSQL/Redis (from 07F1 or independently started)
- Insert a controlled test row into `usage_records` with `execution_status = 'running'` and a known `execution_id`
- Call `requestCancel(executionId)` through a canary script (or via API Gateway if wired)
- Verify `execution_status` changed to `'cancel_requested'`
- Verify `requestCancel()` returns `false` for already-completed rows (cannot cancel completed execution)
- Clean up: `DELETE FROM usage_records WHERE execution_id IN ('<canary-ids>')`

**Scope (Option B — race-based, if adapter timing allows):**
- Submit a job and immediately call `requestCancel()` while status is `'running'`
- Verify status transition
- This option is riskier due to timing sensitivity

**Recommended:** Option A (controlled row insertion) — deterministic, no timing dependency.

#### 07F3 — Consolidation

**Purpose:** Close AGENT-PLATFORM-07F with parent checkpoint after all child slices pass.

### 3.4 Why Not a Single Bounded Step 3?

| Factor | Single slice risk | Split benefit |
|--------|-------------------|---------------|
| Cancel timing | Worker completes in <1s; cancel race unreliable | 07F2 uses controlled DB row — deterministic |
| Failure isolation | If either transport OR cancel fails, entire canary is FAIL | Independent slices provide precise failure attribution |
| DB mutation scope | Two different mutation types in one pass | Each slice has one clear mutation type and cleanup |
| Session complexity | Longer runtime session increases risk surface | Shorter focused sessions per slice |
| Governance alignment | CLAUDE.md prefers smaller bounded slices for HIGH risk | Each slice is independently bounded |

---

## 4. Exact Live Canary Scenarios

### 4.1 Slice 07F1 — Queue Transport + Metadata Preservation

| # | Action | Verification |
|---|--------|-------------|
| 1 | Start Docker/PostgreSQL/Redis | Health checks pass; `docker ps` shows `aisandbox-postgres` and `aisandbox-redis` healthy |
| 2 | Start API Gateway (port 4000) | Listening; `/health` or startup log observable |
| 3 | Start AI Service Worker (port 4099, process-scoped env) | Listening; startup log observable |
| 4 | Submit orchestration-enriched job via canary script | Job payload includes: `collaborationRunId`, `referralTraceId`, `parentReferralTraceId`, `referringBuilderProfileId`, `referralId`, `isReferralExecution: true`, `orchestrationPriority`, `provider: 'test-harness-stub'`, `adapter: 'test-harness-stub'` |
| 5 | Wait for job completion | Worker logs `execution_completed`; `usage_records` row exists with `execution_status = 'completed'` |
| 6 | Verify metadata in usage_records | `SELECT metadata FROM usage_records WHERE execution_id = '<canary-id>'` → metadata JSONB contains all 7 orchestration fields |
| 7 | Verify read-only/no-write policy | No `write_file`, `delete_file`, `run_validation` tool dispatch in worker logs |
| 8 | Verify no AGENT-HARNESS write canary | `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`; no write tool dispatch |
| 9 | Verify no provider/API calls | `provider: test-harness-stub`; `tokens: 0`; no external HTTP calls |
| 10 | Clean up DB | `DELETE FROM usage_records WHERE execution_id = '<canary-id>'` |
| 11 | Stop API Gateway and Worker | Processes terminated cleanly |

### 4.2 Slice 07F2 — Cancel Signal Path

| # | Action | Verification |
|---|--------|-------------|
| 1 | Ensure Docker/PostgreSQL running | Health check pass |
| 2 | Insert controlled test row | `INSERT INTO usage_records (execution_id, user_id, execution_status, ...) VALUES ('<canary-cancel-id>', 'canary-user', 'running', ...)` |
| 3 | Execute requestCancel | Call `requestCancel('<canary-cancel-id>')` via canary script |
| 4 | Verify status transition | `SELECT execution_status FROM usage_records WHERE execution_id = '<canary-cancel-id>'` → `'cancel_requested'` |
| 5 | Test idempotency / already-completed | Insert second row with `execution_status = 'completed'`; call `requestCancel()` → returns `false` |
| 6 | Clean up DB | `DELETE FROM usage_records WHERE execution_id IN ('<canary-cancel-id>', '<canary-completed-id>')` |

### 4.3 What These Canaries Do NOT Do

- Do NOT activate `write_file`, `delete_file`, `run_validation` tools
- Do NOT start container-manager (no workspace container needed)
- Do NOT create real Docker sandbox containers
- Do NOT make provider/API calls (test-harness-stub only)
- Do NOT use browser smoke
- Do NOT run DB migrations
- Do NOT activate AGENT-HARNESS write canary
- Do NOT modify `.env*` files (process-scoped env only)
- Do NOT change production source files
- Do NOT touch shared workspaces

---

## 5. Runtime Dependency Decision

| Dependency | Required for 07F1? | Required for 07F2? | Justification |
|-----------|--------------------|--------------------|---------------|
| Docker Desktop | YES | YES | Hosts PostgreSQL and Redis containers via docker-compose |
| PostgreSQL | YES | YES | Worker writes `usage_records` metadata; cancel path updates `usage_records` |
| Redis | YES | NO (but needed if PostgreSQL via docker-compose) | BullMQ queue transport; queue name: `ai-execution` |
| API Gateway runtime | YES | OPTIONAL (canary script can call DB directly) | Hosts `OrchestrationService` with real `QueueService` |
| AI Service Worker | YES | NO | Processes BullMQ jobs; writes metadata to PostgreSQL |
| container-manager | NO | NO | Orchestration metadata verification does not require workspace containers |
| Existing workspace/container | NO | NO | `test-harness-stub` does not use file tools if `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` |
| Provider/API keys | NO | NO | `test-harness-stub` makes zero external calls |

### 5.1 Process-Scoped Env (AI Service Worker Only — 07F1)

| Variable | Value | Scope |
|----------|-------|-------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | Process-scoped only — not in `.env` |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | Process-scoped only |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | Process-scoped only |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | Process-scoped only |

**NOTE:** Unlike AGENT-HARNESS-06E (which needed `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` for file tools), 07F1 does NOT need the tool loop enabled. The canary only verifies metadata propagation, not tool dispatch. The `test-harness-stub` will complete without tool calls when `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`.

---

## 6. Provider/API Safety Decision

### 6.1 How Step 3 Prevents Real Provider/API Calls

| Mechanism | Enforcement |
|-----------|-------------|
| Provider field | `provider: 'test-harness-stub'` in job payload |
| Adapter field | `adapter: 'test-harness-stub'` in job payload |
| Billing | Zero tokens; `test-harness-stub` produces `tokens: 0` |
| External HTTP | `test-harness-stub` makes zero outbound HTTP calls to OpenAI/Anthropic/Groq/xAI/DeepSeek |
| Process env | No API keys needed or used |
| Canary script | Hardcodes `provider: 'test-harness-stub'` — cannot accidentally use real provider |

### 6.2 Provider Call Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Canary script accidentally uses real provider | LOW | Script hardcodes `test-harness-stub`; canary review verifies before execution |
| Worker routes to real adapter | NONE | `test-harness-stub` is a distinct adapter; routing is provider-based |
| Model field triggers real inference | NONE | `test-harness-stub` ignores model field |

**No provider call risk exists.** No split or stop required for this reason.

---

## 7. Database Safety Decision

### 7.1 Does Step 3 Touch PostgreSQL?

**YES** — both 07F1 and 07F2 interact with PostgreSQL.

### 7.2 Exact Tables Touched

| Table | Slice | Operation | Purpose |
|-------|-------|-----------|---------|
| `usage_records` | 07F1 | INSERT (by worker) | Worker finalization writes execution result + metadata JSONB |
| `usage_records` | 07F1 | SELECT (by canary verification) | Verify metadata contains orchestration fields |
| `usage_records` | 07F1 | DELETE (cleanup) | Remove canary row |
| `usage_records` | 07F2 | INSERT (by canary script) | Create controlled test row with `execution_status = 'running'` |
| `usage_records` | 07F2 | UPDATE (by `requestCancel`) | Set `execution_status = 'cancel_requested'` |
| `usage_records` | 07F2 | SELECT (verification) | Confirm status transition |
| `usage_records` | 07F2 | DELETE (cleanup) | Remove canary rows |

### 7.3 Expected Test Data

**07F1:**
```sql
-- Worker inserts (automatic via WorkerProcessor finalization):
-- execution_id: '<uuid-generated-by-canary-script>'
-- user_id: 'canary-07f1-user'
-- execution_status: 'completed'
-- metadata JSONB includes orchestration fields
```

**07F2:**
```sql
-- Manual insertion for cancel test:
INSERT INTO usage_records (execution_id, user_id, execution_status, provider, model, tokens_used, metadata)
VALUES ('<canary-cancel-07f2-uuid>', 'canary-07f2-user', 'running', 'test-harness-stub', 'stub', 0, '{}');
```

### 7.4 Cleanup Requirements

```sql
-- 07F1 cleanup:
DELETE FROM usage_records WHERE execution_id = '<canary-07f1-execution-id>';

-- 07F2 cleanup:
DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f2-%';
```

### 7.5 Rollback Commands

```powershell
# If cleanup script fails, manual cleanup via psql:
docker exec aisandbox-postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB -c "DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f%';"
```

### 7.6 Keith DB Approval

**YES — Keith must approve DB use before execution of both 07F1 and 07F2.**

The worker writes to `usage_records` and the cancel canary mutates `usage_records`. Both require explicit Keith approval for:
1. Confirming PostgreSQL is running and accessible
2. Confirming canary data will not collide with real execution data
3. Confirming cleanup commands will be run after the canary

---

## 8. Redis/BullMQ Safety Decision

### 8.1 Queue Configuration

| Field | Value |
|-------|-------|
| Queue name | `ai-execution` |
| Connection | `REDIS_URL` environment variable (points to `aisandbox-redis` container) |
| Job name | `execute-ai` |
| Job options | `attempts: 1`, `removeOnComplete: true`, `removeOnFail: false` |

### 8.2 Expected Jobs

| Slice | Job Count | Purpose |
|-------|-----------|---------|
| 07F1 | 1 | Single orchestration-enriched canary job |
| 07F2 | 0 | Cancel path does not use BullMQ — direct PostgreSQL only |

### 8.3 Cleanup Requirements

| Item | Action |
|------|--------|
| Successful job | Auto-removed by BullMQ (`removeOnComplete: true`) |
| Failed job | If job fails: `removeOnFail: false` means it stays in failed set. Manual cleanup: `redis-cli -a $REDIS_PASSWORD FLUSHDB` (ONLY on aisandbox-redis, NOT production) |
| Stale jobs | Pre-canary: inspect queue to ensure no unrelated pending jobs |

### 8.4 Avoiding Processing Unrelated Jobs

| Precaution | How |
|-----------|-----|
| Pre-check queue depth | Before submitting: `redis-cli -a $REDIS_PASSWORD LLEN bull:ai-execution:wait` should be 0 |
| Worker started fresh | Worker started only for canary; no prior unprocessed jobs should exist |
| Unique execution ID | Canary script generates a UUID prefixed with `canary-07f1-` for traceability |
| Post-check | After canary: verify no unexpected jobs remain in queue |

### 8.5 Queue State Inspection (Before/After)

```powershell
# Before canary:
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:active"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"

# After canary:
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:active"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"
```

---

## 9. Cancel Path Decision

### 9.1 Decision: Deferred to Separate Child Slice (07F2)

**Rationale:**
1. The `requestCancel()` SQL requires `execution_status = 'running'`. With `test-harness-stub`, the worker completes in <1s. Racing the cancel against completion is non-deterministic and may produce false-negatives.
2. A controlled DB row insertion (setting `execution_status = 'running'` directly) provides a deterministic, repeatable cancel verification.
3. Isolating cancel from transport verification ensures clear failure attribution.
4. The cancel SQL itself is simple (`UPDATE ... SET execution_status = 'cancel_requested' WHERE ... AND execution_status = 'running'`). A focused slice verifies it correctly.

### 9.2 07F2 Cancel PASS/FAIL Criteria

| # | Criterion | PASS |
|---|-----------|------|
| 1 | Controlled row with `execution_status = 'running'` inserted | Row exists in `usage_records` |
| 2 | `requestCancel(executionId)` returns `true` | SQL UPDATE affected 1 row |
| 3 | Status changed to `cancel_requested` | SELECT confirms new status |
| 4 | `requestCancel()` on completed row returns `false` | SQL UPDATE affected 0 rows |
| 5 | Cleanup successful | `DELETE` removes all canary rows |

---

## 10. Exact Allowed Step 3 Files

### 10.1 Files That MAY Be Created

| # | Action | Absolute Path | Purpose | Slice |
|---|--------|---------------|---------|-------|
| 1 | CREATE | `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-EXECUTION-REPORT.md` | Canary execution report (transport + metadata) | 07F1 |
| 2 | CREATE | `C:\Users\knlee\aiSandBox2026B\docs\AGENT-PLATFORM-07F2-CANCEL-CANARY-EXECUTION-REPORT.md` | Cancel canary execution report | 07F2 |
| 3 | CREATE | `C:\Users\knlee\aiSandBox2026B\scripts\canary-07f1-submit-job.ts` | Temporary canary script for job submission (may be deleted after canary) | 07F1 |
| 4 | CREATE | `C:\Users\knlee\aiSandBox2026B\scripts\canary-07f2-cancel-test.ts` | Temporary canary script for cancel verification (may be deleted after canary) | 07F2 |

### 10.2 Files That Must NOT Be Changed

- All production source files (`services/**/*.ts` outside temporary canary scripts)
- `orchestration.contracts.ts`
- `orchestration.service.ts`
- `orchestration.module.ts`
- `orchestration-audit.recorder.ts`
- All worker/queue source files
- Frontend files
- Database/migration files
- `.env*` files
- `docker*` files
- `package.json` / `package-lock.json`
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/AINOW-EXECUTION-ROADMAP.md`
- Any existing test files

### 10.3 Source Changes Policy

**No source changes at all.** The canary verifies existing runtime behavior. If source changes are needed for the canary to pass, STOP and escalate — that indicates a bug or gap that must be separately registered.

---

## 11. Exact Step 3 Commands

### 11.1 Preflight Checks (Before Execution)

```powershell
# [PREFLIGHT] Verify Docker Desktop is running
docker info

# [PREFLIGHT] Verify PostgreSQL container is healthy
docker ps --filter "name=aisandbox-postgres" --format "{{.Status}}"

# [PREFLIGHT] Verify Redis container is healthy
docker ps --filter "name=aisandbox-redis" --format "{{.Status}}"

# [PREFLIGHT] Check BullMQ queue is empty (no stale jobs)
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:active"

# [PREFLIGHT] Verify PostgreSQL accepts connections
docker exec aisandbox-postgres pg_isready -U $env:POSTGRES_USER -d $env:POSTGRES_DB
```

### 11.2 Service Startup (REQUIRES KEITH APPROVAL)

```powershell
# [SERVICE STARTUP] Start Docker containers if not already running
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# [SERVICE STARTUP] Wait for health checks
Start-Sleep -Seconds 10

# [SERVICE STARTUP] Start API Gateway (background, new terminal)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run start:dev

# [SERVICE STARTUP] Start AI Service Worker (background, new terminal, process-scoped env)
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "false"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_BROWSER_SMOKE = "false"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run start:dev
```

### 11.3 Canary Execution — 07F1 (REQUIRES KEITH APPROVAL)

```powershell
# [CANARY EXECUTION] Run transport + metadata canary script
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; npx ts-node "scripts/canary-07f1-submit-job.ts"

# [CANARY EXECUTION] Verify metadata in PostgreSQL (manual verification)
docker exec aisandbox-postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB -c "SELECT execution_id, execution_status, metadata FROM usage_records WHERE execution_id LIKE 'canary-07f1-%';"
```

### 11.4 Canary Execution — 07F2 (REQUIRES KEITH APPROVAL)

```powershell
# [CANARY EXECUTION] Run cancel signal path canary script
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; npx ts-node "scripts/canary-07f2-cancel-test.ts"

# [CANARY EXECUTION] Verify cancel status in PostgreSQL (manual verification)
docker exec aisandbox-postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB -c "SELECT execution_id, execution_status FROM usage_records WHERE execution_id LIKE 'canary-07f2-%';"
```

### 11.5 Log Collection

```powershell
# [LOG COLLECTION] Capture worker structured logs (look for orchestration fields)
# Worker logs are in the terminal where AI Service was started.
# Look for: collaborationRunId, referralTraceId, isReferralExecution, execution_completed
```

### 11.6 Cleanup (REQUIRED AFTER CANARY)

```powershell
# [CLEANUP] Remove canary rows from PostgreSQL
docker exec aisandbox-postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB -c "DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f%';"

# [CLEANUP] Verify queue is clean
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD LLEN "bull:ai-execution:wait"
docker exec aisandbox-redis redis-cli -a $env:REDIS_PASSWORD ZCARD "bull:ai-execution:failed"

# [CLEANUP] Stop API Gateway and AI Service Worker (Ctrl+C in respective terminals)

# [CLEANUP] Optionally stop Docker containers (or leave running for future work)
# Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose down
```

### 11.7 Command Category Summary

| Category | Commands | Keith Approval Required |
|----------|----------|------------------------|
| Preflight checks | §11.1 | NO — read-only inspection |
| Service startup | §11.2 | **YES** |
| Canary execution | §11.3, §11.4 | **YES** |
| Log collection | §11.5 | NO — read-only |
| Cleanup | §11.6 | NO — expected post-canary hygiene |

---

## 12. Keith Approval Gate

### 12.1 Explicit Approval Required

**Step 3 (07F1 and 07F2) requires explicit Keith approval before ANY runtime execution.**

Do not proceed from Step 2 to Step 3 automatically.

### 12.2 What Keith Must Approve

| # | Approval Item |
|---|---------------|
| 1 | Docker Desktop running and PostgreSQL/Redis containers healthy |
| 2 | API Gateway startup on port 4000 |
| 3 | AI Service Worker startup on port 4099 with process-scoped env |
| 4 | BullMQ job submission (1 canary job for 07F1) |
| 5 | PostgreSQL `usage_records` row creation (by worker finalization) and canary verification queries |
| 6 | PostgreSQL `usage_records` controlled row insertion (for 07F2 cancel test) |
| 7 | PostgreSQL cleanup (`DELETE FROM usage_records WHERE execution_id LIKE 'canary-07f%'`) |
| 8 | Approval of child-slice registration (07F1/07F2/07F3) before execution begins |

### 12.3 When Keith Approval Is NOT Required

- Running preflight checks (§11.1) — read-only Docker/Redis status inspection
- Reading worker/API Gateway logs — read-only observation
- Creating canary scripts in `scripts/` — file creation only
- Creating execution report docs — documentation only
- Running cleanup after successful canary — expected hygiene

### 12.4 Approval Flow

```
Keith approves child-slice registration (07F1/07F2/07F3)
  → Keith approves 07F1 runtime execution
    → 07F1 executes, reports result
      → Keith approves 07F2 runtime execution (if 07F1 PASS)
        → 07F2 executes, reports result
          → 07F3 consolidation (no additional approval needed)
```

---

## 13. PASS/FAIL Criteria

### 13.1 PASS Criteria — 07F1 (ALL must be satisfied)

| # | Criterion | Objective Measure |
|---|-----------|-------------------|
| 1 | Docker/PostgreSQL/Redis healthy | `docker ps` shows healthy containers |
| 2 | API Gateway starts | Startup log confirms listening on port 4000 |
| 3 | AI Service Worker starts | Startup log confirms listening; `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` confirmed in logs |
| 4 | BullMQ queue initially empty | `LLEN bull:ai-execution:wait` = 0 before submission |
| 5 | Canary job submitted | Script exits successfully; job ID returned |
| 6 | Worker processes job | Worker log shows `execution_completed` for canary execution ID |
| 7 | `usage_records` row created | `SELECT` returns 1 row with canary execution ID |
| 8 | `execution_status = 'completed'` | Row status is `completed` |
| 9 | Metadata contains `collaborationRunId` | JSONB field present and non-null |
| 10 | Metadata contains `referralTraceId` | JSONB field present and non-null |
| 11 | Metadata contains `parentReferralTraceId` | JSONB field present (may be null/undefined) |
| 12 | Metadata contains `referringBuilderProfileId` | JSONB field present and non-null |
| 13 | Metadata contains `orchestrationPriority` | JSONB field present |
| 14 | Metadata contains `referralId` | JSONB field present and non-null |
| 15 | Metadata contains `isReferralExecution` | JSONB field = `true` |
| 16 | No write tool dispatch | Worker logs show no `write_file`/`delete_file`/`run_validation` |
| 17 | Provider = `test-harness-stub` | Worker logs confirm `test-harness-stub`; `tokens: 0` |
| 18 | No `.env` changes | Pre/post scan shows no harness flags in `.env*` |
| 19 | Cleanup successful | `DELETE` removes canary row; no residue |
| 20 | Queue clean after canary | `LLEN` and `ZCARD` = 0 |

### 13.2 PASS Criteria — 07F2 (ALL must be satisfied)

| # | Criterion | Objective Measure |
|---|-----------|-------------------|
| 1 | Controlled row inserted | `INSERT` succeeds; row with `execution_status = 'running'` exists |
| 2 | `requestCancel()` returns `true` | Cancel SQL affects 1 row |
| 3 | Status = `cancel_requested` | `SELECT` confirms status change |
| 4 | Cancel on completed row returns `false` | Cancel SQL affects 0 rows |
| 5 | Cleanup successful | `DELETE` removes all canary rows |

### 13.3 FAIL Criteria (ANY triggers FAIL)

| # | Criterion | Trigger |
|---|-----------|---------|
| 1 | Docker/PostgreSQL/Redis unavailable | Service health check fails |
| 2 | API Gateway fails to start | Startup error |
| 3 | Worker fails to start | Startup error |
| 4 | Job not processed | Worker does not log completion within 30s |
| 5 | Metadata missing orchestration fields | Any of criteria 9-15 in §13.1 fail |
| 6 | Write tool dispatched | Any write-capable tool appears in worker logs |
| 7 | Real provider call detected | Non-stub provider/adapter in logs; non-zero tokens |
| 8 | `.env` file modified | Pre/post diff shows changes |
| 9 | Source file modified | Any `services/**` production file changed |
| 10 | Cancel SQL fails | `requestCancel()` throws or returns unexpected result |
| 11 | Queue contains unexpected jobs | Pre/post queue inspection shows stale or unrelated jobs |
| 12 | Cleanup fails | Canary rows remain after DELETE |

---

## 14. Stop Conditions

If ANY of the following occur, **STOP immediately** and escalate to Keith:

| # | Stop Condition | Action |
|---|---------------|--------|
| 1 | Unexpected source changes needed for canary to pass | STOP — register bug/gap as separate task |
| 2 | Migration needed | STOP — canary must not require schema changes |
| 3 | Provider/API call risk detected | STOP — review canary script for non-stub provider references |
| 4 | Write tool activation risk | STOP — verify `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` |
| 5 | Shared workspace write risk | STOP — canary does not use file tools |
| 6 | Docker/PostgreSQL/Redis unavailable after Keith approval | STOP — cannot proceed without infrastructure |
| 7 | Queue contains unsafe/unrelated jobs | STOP — inspect and clean queue before proceeding |
| 8 | Cancel path cannot be isolated safely | STOP — defer 07F2 |
| 9 | Worker processes unexpected additional jobs | STOP — investigate queue state |
| 10 | AGENT-HARNESS write canary accidentally activated | STOP — verify env flags |
| 11 | Worker crashes or hangs | STOP — investigate; do not retry without understanding cause |
| 12 | Canary script requires imports from production source that change behavior | STOP — canary must be observation-only |

---

## 15. Risks / Blockers

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| 1 | Runtime dependency risk | MEDIUM | Full local stack required (Docker/PostgreSQL/Redis/API Gateway/Worker). Mitigated by proven 06E pattern. Keith must confirm services available. |
| 2 | DB side-effect risk | MEDIUM | Worker writes `usage_records`; cancel mutates `usage_records`. Mitigated by: unique canary execution IDs (`canary-07f%` prefix); explicit DELETE cleanup; Keith approval gate. |
| 3 | Redis/BullMQ cleanup risk | LOW | Successful jobs auto-removed (`removeOnComplete: true`). Failed jobs in failed set — manual cleanup documented. Pre/post queue inspection required. |
| 4 | Provider/API call risk | NONE | `test-harness-stub` hardcoded in canary script. Zero tokens. Zero external calls. |
| 5 | Worker coupling risk | LOW | Worker processes any job in `ai-execution` queue. Mitigated by: queue pre-check (must be empty); fresh worker start; unique execution ID. |
| 6 | Workspace write risk | NONE | `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` for 07F1; no file tools registered/dispatched. 07F2 does not involve worker at all. |
| 7 | Log observability risk | LOW | Worker structured logs include orchestration fields (proven by 07C2 tests). If logs are insufficient, metadata query is the authoritative verification. |
| 8 | AGENT-HARNESS write canary confusion risk | LOW | Process-scoped `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`. No write tool IDs registered. Canary script does not reference harness write functionality. Explicit stop condition if accidentally activated. |
| 9 | Cancel timing risk | LOW (mitigated by split) | 07F2 uses controlled DB row insertion (deterministic) instead of racing the worker. No timing dependency. |
| 10 | Stale data collision risk | LOW | Canary uses UUID-prefixed execution IDs (`canary-07f1-<uuid>`, `canary-07f2-<uuid>`). No collision with real execution data possible. |
| 11 | Docker container state drift | LOW | If containers were used by prior tasks, state should be clean. PostgreSQL data persists across restarts but canary uses unique IDs. |

**Blockers identified: NONE** — all risks have documented mitigations. Keith approval is the primary safety gate.

---

## 16. UX/UI Constraints

- No UI expected in AGENT-PLATFORM-07F.
- If future UI text is added for orchestration/canary visibility, update:
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\en.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-TW.json`
  - `C:\Users\knlee\aiSandBox2026B\frontend\messages\zh-CN.json`
- Use existing translation hooks (`useTranslations` / `next-intl`).
- Do NOT add hardcoded English UI copy.
- Icons: **Heroicons v2 Outline only**.
- Impeccable / Emil Kowalski design engineering: **advisory only** — must not override governance, scope, architecture, or tests.

---

## 17. Step 3 Readiness Conclusion

### 17.1 Ready / Not Ready

**READY — but child-slice registration required first.**

AGENT-PLATFORM-07F Step 3 execution is ready contingent on:
1. Keith approves child-slice registration (07F1/07F2/07F3)
2. Keith approves runtime execution before service startup

### 17.2 Recommended Model

- **07F1 (queue transport canary):** GPT-5.3 Codex High — runtime-sensitive, backend/PostgreSQL interaction, higher-risk live canary
- **07F2 (cancel signal canary):** GPT-5.3 Codex — bounded PostgreSQL verification, lower risk than 07F1
- **07F3 (consolidation):** Sonnet 4.6 — governance/checkpoint documentation

### 17.3 Exact Next Prompt Type

**Registration prompt** — register child slices 07F1/07F2/07F3 in TASKS.md before any live execution.

Required actions before Step 3:
1. Register AGENT-PLATFORM-07F1 as child slice (queue transport + metadata canary)
2. Register AGENT-PLATFORM-07F2 as child slice (cancel signal path canary)
3. Register AGENT-PLATFORM-07F3 as child slice (consolidation)
4. Obtain Keith approval for the child-slice structure
5. Then proceed to 07F1 execution with separate Keith runtime approval

### 17.4 Whether Child-Slice Registration Is Required First

**YES — child-slice registration is required before any live execution.**

Governance requires task registration before implementation. The split decision (§3) recommends 3 child slices. These must be registered in TASKS.md before Step 3 execution can begin.

---

## 18. Files Inspected (Read-Only)

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance — 07F ACTIVE confirmation, step structure, acceptance criteria |
| 2 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence — 07F position §3 item 21 |
| 3 | `docs/AGENT-PLATFORM-07E-CHECKPOINT.md` | 07E completion — 16 canary tests, Option A selected |
| 4 | `docs/AGENT-PLATFORM-07E-CANARY-EXECUTION-REPORT.md` | 07E execution — full scenario coverage, mock verification |
| 5 | `docs/AGENT-PLATFORM-07E-CANARY-READINESS-PREFLIGHT.md` | 07E preflight — template/pattern for this document |
| 6 | `docs/AGENT-PLATFORM-07D-CHECKPOINT.md` | 07D completion — audit events, 40 tests |
| 7 | `docs/AGENT-PLATFORM-07C-CHECKPOINT.md` | 07C completion — 3 child slices, referral enqueue + cancel |
| 8 | `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | 06E precedent — full E2E live runtime topology, 06E pattern |
| 9 | `docs/AGENT-HARNESS-07-CHECKPOINT.md` | AGENT-HARNESS-07 — per-builder config adapter |
| 10 | `services/api-gateway/src/orchestration/orchestration.service.ts` | OrchestrationService — full lifecycle, QueueService/ExecutionResultService DI |
| 11 | `services/api-gateway/src/orchestration/orchestration.module.ts` | Module — QueueModule import, provider declarations |
| 12 | `services/api-gateway/src/queue/queue.service.ts` | QueueService — Redis/BullMQ constructor, `enqueueExecution()`, queue name `ai-execution` |
| 13 | `services/api-gateway/src/ai/execution-result.service.ts` | ExecutionResultService — `requestCancel()` SQL, TypeORM DataSource |
| 14 | `services/api-gateway/src/orchestration/__tests__/orchestration.canary.spec.ts` | 07E canary test — mocking pattern reference |
| 15 | `services/ai-service/src/queue/job.types.ts` | AiExecutionJob — 5 orchestration fields (07C2), full job shape |
| 16 | `services/ai-service/src/worker/worker.processor.ts` | Worker — metadata preservation (lines 1013-1024), `test-harness-stub` routing |
| 17 | `docker-compose.yml` | Docker services — PostgreSQL (5432), Redis (6379), queue name, volumes |

---

## 19. Confirmation Checklist

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | Exact file created: `docs/AGENT-PLATFORM-07F-LIVE-RUNTIME-CANARY-PREFLIGHT.md` | CONFIRMED |
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
| 12 | No Docker/Postgres/Redis/API Gateway/container-manager/AI Service started | CONFIRMED |
| 13 | No BullMQ jobs submitted | CONFIRMED |
| 14 | No provider/API calls | CONFIRMED |
| 15 | No browser smoke | CONFIRMED |
| 16 | No child slices registered (planning only — registration is next step) | CONFIRMED |
| 17 | AGENT-HARNESS write canary not touched | CONFIRMED |
| 18 | AGENT-PLATFORM-07F ready for Step 3 (contingent on child-slice registration + Keith approval) | CONFIRMED |

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07F Step 2 — Live Runtime Canary Readiness / Preflight Plan
- **Status:** Step 2 COMPLETE
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
