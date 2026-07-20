# AGENT-HARNESS-WRITE-CANARY-B — Step 2 Stage-Start / Runtime Canary Design / Safety Plan

**Task ID:** AGENT-HARNESS-WRITE-CANARY-B
**Step:** 2 — Stage-Start / Runtime Canary Design / Safety Plan
**Status:** COMPLETE — 2026-07-20
**Date:** 2026-07-20
**Nature:** Planning only — no source, test, translation, package, migration, entity, environment, or Docker files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-HARNESS-WRITE-CANARY-B |
| Title | Live E2E Write Canary Execution |
| Family | AGENT HARNESS / WRITE PATH / LIVE E2E CANARY / BETA READINESS |
| Risk | HIGH — 4-step loop |
| Step 1 | COMPLETE — Registration — 2026-07-20 |
| Step 2 | This document — Stage-Start / Runtime Canary Design / Safety Plan — 2026-07-20 |
| Step 3 | Pending — Implementation + Live Canary Execution |
| Step 4 | Pending — Consolidation / Checkpoint |
| Keith Approval | "go" — 2026-07-20 |

---

## 2. Parent / Child Status

| Field | Value |
|-------|-------|
| Parent Task | AGENT-HARNESS-WRITE-CANARY — Agent Harness Write Canary + Production Activation |
| Parent Status | ACTIVE — Step 1 COMPLETE — Step 2 COMPLETE — child A COMPLETE and LOCKED — child B ACTIVE |
| Sibling | AGENT-HARNESS-WRITE-CANARY-A — Write Stub + Unit Test Coverage Verification — COMPLETE and LOCKED — 2026-07-19 |
| Blocker Addressed | BETA-READY-00 blocker B1 (CRITICAL — write path not production-activated) |

---

## 3. Stage-Start Purpose

Define the exact runtime canary design, service topology, safety boundaries, kill-switch plan, and Step 3 implementation scope before any code change or service startup occurs.

This step answers 25 stage-start questions and produces a safety plan that governs Step 3 execution.

---

## 4. Files Inspected

### Governance Documents

| File | Purpose |
|------|---------|
| `TASKS.md` | Active task ledger — child B registration confirmed |
| `TASKS_BACKLOG_FULL.md` | Master backlog — task registration confirmed |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution priority/sequence — child B is current next action |
| `docs/AGENT-HARNESS-WRITE-CANARY-PREFLIGHT.md` | Parent Step 2 preflight/safety design — canary operation design basis |
| `docs/AGENT-HARNESS-WRITE-CANARY-A-CHECKPOINT.md` | Child A consolidation — G9 deferred to child B confirmed |
| `docs/AGENT-HARNESS-WRITE-CANARY-A-IMPLEMENTATION.md` | Child A implementation evidence — existing coverage map |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Full E2E read-only canary — service topology and canary script reference |

### Source Files

| File | Purpose |
|------|---------|
| `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` | `TestToolCapableStubAdapter` — G9 target: must extend for write_file |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Harness loop — checkpoint-before-mutating-call behavior |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | 8 tool definitions — write_file enabled, riskLevel high |
| `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | `createWriteFileHandler`, `validateAndNormalizePath`, `createDeleteFileHandler` |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Config factory — `maxToolIterations: 3`, `enableWriteTools`, `enableToolLoop` |
| `services/ai-service/src/worker/worker.processor.ts` | Worker harness activation — conditional write/delete handler registration |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | HTTP client — `writeWorkspaceFile`, `createWorkspaceCheckpoint` |
| `services/ai-service/scripts/canary-06e-submit-job.ts` | 06E canary script — reference pattern for canary-B script |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | API Gateway write/checkpoint endpoints |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Container-manager write endpoint |
| `services/container-manager/src/docker/docker-runtime.service.ts` | `validateWorkspacePath`, `writeFileToContainer`, Docker exec |
| `services/container-manager/src/sessions/sessions.service.ts` | Session service — write with termination/quota checks |
| `docker-compose.yml` | Infrastructure — PostgreSQL :5432, Redis :6379 |

### Port Configuration

| File | Port |
|------|------|
| `services/api-gateway/src/main.ts` | `process.env.PORT \|\| 4000` |
| `services/ai-service/src/main.ts` | `process.env.PORT \|\| 4001` |
| `services/container-manager/src/main.ts` | `process.env.PORT \|\| 4002` |

---

## 5. Service Set Decision

### Required Services

| # | Service | Port | Reason |
|---|---------|------|--------|
| 1 | Docker Desktop | — | Container runtime for sandbox workspace containers |
| 2 | PostgreSQL (`aisandbox-postgres`) | 5432 | `usage_records` table for execution ledger |
| 3 | Redis (`aisandbox-redis`) | 6379 | BullMQ queue transport for `ai-execution` queue |
| 4 | container-manager | 4002 | Docker container lifecycle + file write execution |
| 5 | API Gateway | 4000 | Internal workspace endpoints (write, checkpoint, read) |
| 6 | AI Service Worker | 4001 | BullMQ worker process — harness loop + tool dispatch |

### Full E2E Write Path

```
Canary Script → PostgreSQL (usage_records insert) + BullMQ (job enqueue)
  → AI Service Worker picks up job
    → TestToolCapableStubAdapter.executeWithTools() returns write_file tool call
    → Harness loop creates pre-apply checkpoint (before first mutating tool)
      → ApiGatewayHttpClient.createWorkspaceCheckpoint()
        → API Gateway POST /api/internal/workspace/:sessionId/checkpoint
          → ContainerManagerHttpClient.createManualCheckpoint()
            → container-manager git commit inside Docker container
    → ToolDispatcher dispatches write_file
      → createWriteFileHandler → validateAndNormalizePath → size check
        → ApiGatewayHttpClient.writeWorkspaceFile()
          → API Gateway POST /api/internal/workspace/:sessionId/write
            → ContainerManagerHttpClient.writeSessionFile()
              → container-manager POST /api/internal/sessions/:id/files
                → SessionsService.writeFileToContainer()
                  → DockerRuntimeService.writeFileToContainer()
                    → validateWorkspacePath() → Docker exec printf > /workspace/canary-write-test.md
    → TestToolCapableStubAdapter.executeWithTools() returns read_file tool call
    → ToolDispatcher dispatches read_file
      → createReadFileHandler → validateAndNormalizePath
        → ApiGatewayHttpClient.readWorkspaceFile()
          → API Gateway GET /api/internal/workspace/:sessionId/read?path=canary-write-test.md
            → ContainerManagerHttpClient.readSessionFile()
              → container-manager GET /api/internal/sessions/:id/files?path=canary-write-test.md
                → SessionsService.readFileFromContainer()
                  → DockerRuntimeService.readFileFromContainer()
                    → validateWorkspacePath() → Docker exec cat /workspace/canary-write-test.md
    → TestToolCapableStubAdapter.executeWithTools() returns completed (no tool calls)
    → Harness loop completes with terminationReason: 'completed'
  → Worker finalizes: usage_records updated, preApplyCheckpointHash saved, accounting notified
```

---

## 6. Frontend Decision

**NOT REQUIRED.**

The canary uses a direct BullMQ job submission script (based on the 06E pattern: `canary-06e-submit-job.ts`). No browser, no frontend Next.js process, no UI interaction. Verification is done via database queries, worker logs, and container filesystem inspection.

---

## 7. Process-Scoped Flag Strategy

### Flags Applied to AI Service Worker Process Only

| Variable | Value | Scope | Purpose |
|----------|-------|-------|---------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Process-scoped PowerShell `$env:` | Activates harness tool loop path in worker |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `true` | Process-scoped PowerShell `$env:` | Registers `write_file` and `delete_file` handlers in dispatcher |
| `AGENT_HARNESS_STUB_WRITE_MODE` | `true` | Process-scoped PowerShell `$env:` | Switches `TestToolCapableStubAdapter` to write canary sequence (new — G9 resolution) |

### Application Method

```powershell
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP="true"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS="true"
$env:AGENT_HARNESS_STUB_WRITE_MODE="true"
```

Set in the PowerShell session before starting the AI Service Worker. These are NOT written to any `.env` file.

### Flag Lifecycle

- Set before AI Service Worker startup.
- Read once at module initialization by `createAgentHarnessConfigV1(process.env)` and `TestToolCapableStubAdapter` constructor.
- Effective only for the lifetime of that PowerShell session.
- Closing the terminal or starting a new session removes all flags.
- Default safe state is preserved: all three flags default to `false` when absent.

### Other Services

API Gateway, container-manager, and Docker containers do NOT receive these flags. They are irrelevant to those services — the flags only control ai-service harness behavior.

---

## 8. G9 / TestToolCapableStubAdapter Resolution Plan

### Gap

G9 from AGENT-HARNESS-WRITE-CANARY-A: "`TestToolCapableStubAdapter` does not emit `write_file` calls — deferred to child B."

### Current Adapter Behavior (default mode)

```
iteration 0 → list_files({ path: '.' })          → finishReason: 'tool_calls'
iteration 1 → read_file({ path: 'README.md' })   → finishReason: 'tool_calls'
iteration 2+ → no tool calls                     → finishReason: 'completed'
```

### Planned Write-Mode Behavior

When `process.env.AGENT_HARNESS_STUB_WRITE_MODE === 'true'`:

```
iteration 0 → write_file({ path: 'canary-write-test.md', content: '# Write Canary\nTimestamp: <ISO>\nAgent: test-harness-stub\n' })  → finishReason: 'tool_calls'
iteration 1 → read_file({ path: 'canary-write-test.md' })                                                                           → finishReason: 'tool_calls'
iteration 2+ → no tool calls                                                                                                         → finishReason: 'completed'
```

### Design Constraints

- `maxToolIterations: 3` (hardcoded in config factory) — the write-mode sequence uses exactly 3 iterations (0, 1, 2), which fits within the limit.
- The adapter determines mode at construction time via `process.env.AGENT_HARNESS_STUB_WRITE_MODE`.
- Default mode (no env var) is unchanged — existing read-only tests and canaries are not affected.
- Zero external API calls. Zero tokens. Zero billing. Pure deterministic tool-call sequence.

### Implementation

Modify `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts`:

1. Add a `private readonly writeMode: boolean` field initialized from `process.env.AGENT_HARNESS_STUB_WRITE_MODE === 'true'`.
2. In `executeWithTools()`, branch on `this.writeMode`:
   - **Write mode, iteration 0:** Return `write_file` tool call with deterministic canary content.
   - **Write mode, iteration 1:** Return `read_file` tool call for the written file (read-back verification).
   - **Write mode, iteration 2+:** Return completed.
   - **Default mode:** Existing behavior (list_files → read_file → completed).
3. No changes to `execute()` (non-tool path).

### Unit Tests Required

Add to `services/ai-service/src/ai-execution/adapters/__tests__/test-harness-stub-ai.adapter.spec.ts`:

1. `write mode: iteration 0 returns write_file tool call`
2. `write mode: iteration 1 returns read_file for canary file`
3. `write mode: iteration 2 returns completed`
4. `write mode: content includes timestamp and agent identifier`
5. `write mode: canary file path is canary-write-test.md`
6. `default mode: unchanged behavior when AGENT_HARNESS_STUB_WRITE_MODE is not set`

---

## 9. Canary Operation Design

### Canary File

| Property | Value |
|----------|-------|
| Filename | `canary-write-test.md` |
| Path inside container | `/workspace/canary-write-test.md` |
| Content | `# Write Canary\nTimestamp: <ISO timestamp>\nAgent: test-harness-stub\n` |
| Size | ~80 bytes (well under 131,072 byte max) |

### Canary Sequence

| Phase | Action | Service Path | Expected Result |
|-------|--------|--------------|-----------------|
| 1 | Stub emits `write_file` | adapter → loop → dispatcher → handler → API GW → CM → Docker | File created at `/workspace/canary-write-test.md` |
| 2 | Pre-apply checkpoint | loop → API GW → CM → git commit inside container | `preApplyCheckpointHash` non-null |
| 3 | Stub emits `read_file` | adapter → loop → dispatcher → handler → API GW → CM → Docker | Content matches written content |
| 4 | Stub emits completed | adapter → loop returns | `terminationReason: 'completed'` |

**Note:** Phase 2 (checkpoint) occurs BEFORE phase 1 (write dispatch) in the harness loop. The loop detects that `write_file` is in `mutatingToolNames` and creates the checkpoint before dispatching the tool. The sequence in the loop is: detect mutating call → create checkpoint → dispatch tools.

### Canary Job Payload

Based on `canary-06e-submit-job.ts` pattern:

| Field | Value |
|-------|-------|
| `executionId` | Random UUID (generated by canary script) |
| `userId` | `'canary-write-b-user'` |
| `apiKeyId` | `'canary-write-b-apikey'` |
| `sessionId` | Real session ID from `POST /api/sessions` (CLI argument) |
| `conversationId` | Fixed UUID |
| `provider` | `'test-harness-stub'` |
| `adapter` | `'test-harness-stub'` |
| `model` | `'test-harness-stub'` |
| `harnessVersion` | `'v1'` |
| `agentRole` | `'builder'` |
| `builderProfileId` | `'builder-default'` |
| `prompt` | Canary instruction text |

---

## 10. Disposable Workspace / Session / Container Strategy

### Session Creation

Use real session creation via `POST /api/sessions` (through API Gateway). This creates:
- A session record in container-manager's SQLite DB.
- A workspace directory on host at `workspaces/<sessionId>/`.
- A Docker container (`sandbox-session-<sessionId>`) running `node:20-alpine`.
- A bind mount: `workspaces/<sessionId>/ → /workspace/` inside the container.
- A `README.md` file at `/workspace/README.md` with default content.

### Disposal

After the canary:
1. Stop the session container: `POST /api/sessions/<sessionId>/stop`.
2. Delete the canary `usage_records` row from PostgreSQL.
3. The session workspace directory on host can be left (harmless) or manually removed.

No persistent data is created outside the disposable session.

---

## 11. Read-Back Verification Plan

### Primary Verification (In-Band)

The stub adapter's iteration 1 emits `read_file({ path: 'canary-write-test.md' })`. The harness loop dispatches this through the full E2E read path:

```
ToolDispatcher → createReadFileHandler → ApiGatewayHttpClient.readWorkspaceFile()
  → API Gateway → ContainerManagerHttpClient → container-manager
    → DockerRuntimeService.readFileFromContainer() → Docker exec cat
```

The `harness.tool_dispatch_completed` audit event for `read_file` will contain `resultBytes` and `success: true`. The file content is returned in the tool result.

### Verification Criteria

| Check | Method | Expected |
|-------|--------|----------|
| Read-file dispatch succeeds | Worker log: `harness.tool_dispatch_completed` with `toolName: 'read_file'`, `success: true` | Not HANDLER_ERROR |
| Content matches write | Worker log: tool result content contains `# Write Canary` | Content matches |
| Result bytes non-zero | Worker log: `resultBytes > 0` | Positive integer |

### Secondary Verification (Out-of-Band)

After the canary job completes, manually verify by running:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/internal/workspace/<sessionId>/read?path=canary-write-test.md" -Headers @{"X-Internal-Service-Key"=$env:INTERNAL_SERVICE_KEY}
```

This confirms the file persists in the container after the harness job.

---

## 12. Checkpoint Verification Plan

### In-Band Verification

The harness loop creates a pre-apply checkpoint before the first mutating tool dispatch. This checkpoint hash is stored in the `AgentHarnessLoopResult.preApplyCheckpointHash` field and persisted to `usage_records.metadata` as `preApplyCheckpointHash`.

### Verification

After canary job completes, query PostgreSQL:

```sql
SELECT metadata->'preApplyCheckpointHash' AS checkpoint_hash
FROM usage_records
WHERE execution_id = '<canary-execution-id>';
```

| Check | Expected |
|-------|----------|
| `preApplyCheckpointHash` is non-null | A git commit hash string |
| `preApplyCheckpointHash` is a valid hex string | 40-character hex (SHA-1) |

### Audit Event Confirmation

Worker logs should contain checkpoint-related flow before the first `harness.tool_dispatch_started` event for `write_file`.

---

## 13. Audit-Event Verification Plan

### Required Events in Worker Logs

| # | Event Type | Key Fields | Expected |
|---|-----------|------------|----------|
| 1 | `agent_harness.route_evaluated` | `selectedPath: 'harness'` | Harness path selected |
| 2 | `agent_harness.config_resolved` | `source: 'builder-profile'` | Config resolved from builder profile |
| 3 | `harness.loop_started` | `maxToolIterations: 3` | Loop started |
| 4 | `harness.model_invocation_started` | `iteration: 0` | First model call |
| 5 | `harness.model_invocation_completed` | `iteration: 0`, `toolCallCount: 1`, `finishReason: 'tool_calls'` | write_file tool call received |
| 6 | `harness.tool_dispatch_started` | `toolName: 'write_file'`, `iteration: 0` | Write dispatch initiated |
| 7 | `harness.tool_dispatch_completed` | `toolName: 'write_file'`, `success: true` | Write dispatch succeeded |
| 8 | `harness.model_invocation_started` | `iteration: 1` | Second model call |
| 9 | `harness.model_invocation_completed` | `iteration: 1`, `toolCallCount: 1`, `finishReason: 'tool_calls'` | read_file tool call received |
| 10 | `harness.tool_dispatch_started` | `toolName: 'read_file'`, `iteration: 1` | Read dispatch initiated |
| 11 | `harness.tool_dispatch_completed` | `toolName: 'read_file'`, `success: true` | Read dispatch succeeded — content matches |
| 12 | `harness.model_invocation_started` | `iteration: 2` | Third model call |
| 13 | `harness.model_invocation_completed` | `iteration: 2`, `toolCallCount: 0`, `finishReason: 'completed'` | Stub signals completion |
| 14 | `harness.loop_completed` | `totalToolCalls: 2`, `terminationReason: 'completed'` | Loop ended normally |
| 15 | `execution_completed` | `tokens: 0`, `execution_status: 'completed'` | Worker finalized |

### Failure Events (Should NOT Appear)

- `harness.tool_dispatch_failed` — any tool dispatch failure is a canary FAIL.
- `harness.model_invocation_failed` — any adapter error is a canary FAIL.
- `harness.loop_aborted` — abort signal is a canary FAIL.
- `harness.loop_max_turns` — hitting max iterations without completion is a canary FAIL.

---

## 14. Sandbox / Host Filesystem Safety Plan

### Docker Container Isolation

All write operations execute inside a Docker container (`sandbox-session-<sessionId>` running `node:20-alpine`). The workspace is bind-mounted from `workspaces/<sessionId>/` on the host.

### Path Containment — 4 Layers

| Layer | Component | Validation |
|-------|-----------|------------|
| 1 | ai-service `validateAndNormalizePath()` | Rejects empty, `..` traversal (regex), strips leading `/` |
| 2 | ai-service `createDeleteFileHandler` (not used) | Rejects root/directory/glob (not applicable for write) |
| 3 | container-manager `validateWorkspacePath()` | Rejects empty, `..` segments, absolute paths outside `/workspace` |
| 4 | Docker exec | All ops scoped to `/workspace/{path}` inside container |

### Host Filesystem Verification

After the canary, run:

```powershell
git -C "C:\Users\knlee\aiSandBox2026B" diff
git -C "C:\Users\knlee\aiSandBox2026B" status
```

Expected: No modifications to any repository source files. The write happened inside a Docker container in a session-specific workspace directory, not in the repo.

### Canary File Location

The file `canary-write-test.md` exists ONLY at:
- Container path: `/workspace/canary-write-test.md`
- Host path: `workspaces/<sessionId>/canary-write-test.md` (session workspace bind mount)

It does NOT exist in:
- The repository source tree (`C:\Users\knlee\aiSandBox2026B\`)
- Any other session workspace
- The host filesystem outside the workspace bind mount

---

## 15. Provider / Payment Inactivity Plan

### Provider Safety

| Check | Expected |
|-------|----------|
| Provider | `test-harness-stub` — zero external API calls |
| Tokens | `tokensUsed: 0` — no billing |
| Model | `test-harness-stub` — not a real provider model |
| API calls to Anthropic/OpenAI/Groq/xAI | ZERO |

### Payment Safety

| Check | Expected |
|-------|----------|
| Stripe API calls | ZERO — no Stripe SDK loaded, no Stripe CLI used |
| `BILLING_CHARGES_ENABLED` | Not set or `false` — charges disabled |
| Webhook activity | ZERO — no webhook endpoints called |
| Customer portal activity | ZERO — no portal endpoints called |
| Credit deduction | Accounting notification fires but credit balance is not at risk (test user with no real balance; deduction is safe no-op or suppressed failure) |

### Verification

After canary, verify worker logs contain no provider-related entries beyond `provider: 'test-harness-stub'`. Verify no outbound HTTPS calls to `api.anthropic.com`, `api.openai.com`, `api.groq.com`, or `api.x.ai`.

---

## 16. Allowed Step 3 Commands

### Code Changes (Sub-Phase 3a)

```powershell
# Edit TestToolCapableStubAdapter (write mode extension)
# Edit test-harness-stub-ai.adapter.spec.ts (write mode tests)
# Create canary submission script (based on 06E pattern)

# Validate changes
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
```

### Infrastructure Startup (Sub-Phase 3b)

```powershell
# Start Docker infrastructure
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose up -d postgres redis

# Verify health
docker exec aisandbox-postgres pg_isready -U aisandbox
docker exec aisandbox-redis redis-cli -a aisandboxredis123 ping

# Start container-manager
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run start:dev

# Start API Gateway
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run start:dev

# Start AI Service Worker with process-scoped flags
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP="true"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS="true"
$env:AGENT_HARNESS_STUB_WRITE_MODE="true"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run start:dev
```

### Session and Canary (Sub-Phase 3b continued)

```powershell
# Create test session
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/sessions" -ContentType "application/json" -Body '{"userId":"canary-write-b-user"}'

# Start session container
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/sessions/<sessionId>/start" -ContentType "application/json" -Headers @{"X-Internal-Service-Key"=$env:INTERNAL_SERVICE_KEY}

# Verify API Gateway health
Invoke-RestMethod -Uri "http://localhost:4000/api/health"

# Submit canary job
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx tsx scripts/canary-write-b-submit-job.ts --sessionId <sessionId>

# Read-back verification (out-of-band)
Invoke-RestMethod -Uri "http://localhost:4000/api/internal/workspace/<sessionId>/read?path=canary-write-test.md" -Headers @{"X-Internal-Service-Key"=$env:INTERNAL_SERVICE_KEY}

# Checkpoint verification
# (SQL query against PostgreSQL)

# Post-canary safety checks
git -C "C:\Users\knlee\aiSandBox2026B" diff
git -C "C:\Users\knlee\aiSandBox2026B" status
```

### Cleanup

```powershell
# Stop session
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/sessions/<sessionId>/stop"

# Delete canary usage_records row
# (SQL delete via psql or pgAdmin)

# Stop services (Ctrl+C in each terminal)
# Stop Docker infrastructure
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose stop
```

---

## 17. Prohibited Step 3 Commands

| Category | Prohibited |
|----------|-----------|
| Docker | `docker compose down -v` (destroys volumes) |
| Docker | `docker system prune` |
| Docker | `docker volume rm` |
| Environment | Writing to any `.env` or `.env.local` file |
| Git | `git commit`, `git push`, `git reset --hard` |
| Stripe | `stripe` CLI commands |
| Provider | Any real AI provider API calls |
| Frontend | `npm run dev` in frontend |
| Migrations | `npm run migration:run` (unnecessary — migrations already applied in BILLING-READY-06A) |
| Production | Any production deployment command |
| Global config | Modifying `DEFAULT_AGENT_HARNESS_CONFIG_V1` defaults |
| Other | Opening `.env`, `.env.local` or any secret-bearing file |

---

## 18. Startup Order

| # | Component | Command | Verification |
|---|-----------|---------|--------------|
| 1 | Docker Desktop | Already running (manual prerequisite) | `docker info` returns without error |
| 2 | PostgreSQL + Redis | `docker compose up -d postgres redis` | `pg_isready` returns 0; `redis-cli ping` returns PONG |
| 3 | container-manager | `npm run start:dev` (port 4002) | Console shows "Nest application successfully started" |
| 4 | API Gateway | `npm run start:dev` (port 4000) | `GET http://localhost:4000/api/health` returns 200 |
| 5 | AI Service Worker | `npm run start:dev` with process-scoped flags (port 4001) | Console shows "Worker connected to ai-execution queue" |
| 6 | Test session | `POST /api/sessions` + `POST /api/sessions/:id/start` | Session ID returned; container running |
| 7 | Pre-canary health check | Verify all services respond | All ports responsive |

---

## 19. Cleanup Order

| # | Action | Command | Verification |
|---|--------|---------|--------------|
| 1 | Stop AI Service Worker | Ctrl+C in terminal | Process exited |
| 2 | Stop API Gateway | Ctrl+C in terminal | Process exited |
| 3 | Stop test session | `POST /api/sessions/<sessionId>/stop` | Container stopped |
| 4 | Stop container-manager | Ctrl+C in terminal | Process exited |
| 5 | Delete canary DB row | `DELETE FROM usage_records WHERE execution_id = '<id>'` | 1 row deleted, 0 remaining for canary |
| 6 | Stop Docker infrastructure | `docker compose stop` | Containers stopped; volumes preserved |
| 7 | Remove process-scoped env | Close PowerShell session or `Remove-Item Env:AGENT_HARNESS_*` | Flags no longer set |
| 8 | Post-cleanup port verification | Check ports 4000, 4001, 4002 are not listening | No listeners |

---

## 20. Stop Conditions

**Abort Step 3 immediately if any of the following occur:**

| # | Condition | Severity | Action |
|---|-----------|----------|--------|
| 1 | Any file written outside `/workspace/` in Docker container | CRITICAL | Kill worker, stop all services, investigate |
| 2 | Host filesystem modification detected (repo source files changed by canary) | CRITICAL | Kill worker, stop all services, `git checkout .` |
| 3 | Path traversal bypass detected | CRITICAL | Kill worker, stop all services, investigate |
| 4 | Paid provider API call made (tokens > 0) | CRITICAL | Kill worker, stop all services, investigate adapter routing |
| 5 | Stripe/payment/webhook activity detected | CRITICAL | Kill worker, stop all services, investigate |
| 6 | Docker Desktop unreachable | BLOCKING | Stop services, restart Docker, reassess |
| 7 | PostgreSQL or Redis unhealthy | BLOCKING | Stop services, check containers, restart |
| 8 | Any service crash during canary | BLOCKING | Capture logs, investigate, decide whether to retry |
| 9 | `harness.tool_dispatch_failed` for `write_file` | FAIL | Capture logs, investigate root cause, do not retry blindly |
| 10 | `harness.loop_aborted` or `harness.loop_max_turns` | FAIL | Capture logs, investigate |
| 11 | Keith revokes approval | IMMEDIATE | Stop everything, do not proceed |
| 12 | TypeScript errors after G9 stub modification | BLOCKING | Fix errors before runtime canary |
| 13 | Unit test failures after G9 stub modification | BLOCKING | Fix tests before runtime canary |

---

## 21. Rollback / Kill-Switch Plan

### Immediate Kill Switch

| Level | Action | Effect |
|-------|--------|--------|
| Process | Ctrl+C the AI Service Worker terminal | Worker stops; no new jobs processed; in-flight job may complete or fail |
| Container | `docker stop sandbox-session-<sessionId>` | Sandbox container stops; file operations fail with container-not-running error |
| Flag | Remove `$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS` and restart worker | New jobs will not have write_file registered |
| Infrastructure | `docker compose stop` | All Docker services stop |

### Rollback After Canary

If the canary fails or produces unexpected side effects:
1. Delete the canary `usage_records` row.
2. Stop the test session (container is destroyed on stop).
3. Verify `git status` shows clean repo (no unexpected changes).
4. Revert any G9 source changes with `git checkout .` if needed (only if the changes are defective).

### Flag Defaults

All flags default to `false`. Removing the process-scoped env vars (or closing the terminal) returns the system to its safe default state. No persistent configuration change is needed to disable write tools.

---

## 22. Evidence Capture Checklist

### Must Capture

| # | Evidence | Method |
|---|----------|--------|
| 1 | Infrastructure health (Docker, PostgreSQL, Redis) | Console output / docker health checks |
| 2 | container-manager startup confirmation | Console: "Nest application successfully started" on port 4002 |
| 3 | API Gateway startup + health | Console + `GET /api/health` 200 |
| 4 | AI Service Worker startup with flags | Console: "Worker connected to ai-execution queue" + logged env values |
| 5 | Test session creation response | Session ID and container status |
| 6 | Canary job submission output | Script console output with execution ID and job ID |
| 7 | Worker job pickup log | `Worker received job ... executionId=...` |
| 8 | `agent_harness.route_evaluated` log | `selectedPath: 'harness'` |
| 9 | `agent_harness.config_resolved` log | `source: 'builder-profile'`, `enableWriteTools: true` |
| 10 | `harness.loop_started` log | `maxToolIterations: 3` |
| 11 | `harness.tool_dispatch_started` for `write_file` | `toolName: 'write_file'`, iteration 0 |
| 12 | `harness.tool_dispatch_completed` for `write_file` | `success: true`, `resultBytes > 0`, `durationMs` |
| 13 | `harness.tool_dispatch_started` for `read_file` | `toolName: 'read_file'`, iteration 1 |
| 14 | `harness.tool_dispatch_completed` for `read_file` | `success: true`, `resultBytes > 0`, content contains `# Write Canary` |
| 15 | `harness.loop_completed` | `totalToolCalls: 2`, `terminationReason: 'completed'` |
| 16 | `execution_completed` | `tokens: 0`, `execution_status: 'completed'` |
| 17 | `preApplyCheckpointHash` from usage_records | Non-null hex string |
| 18 | Out-of-band read-back verification | `GET /api/internal/workspace/:sessionId/read?path=canary-write-test.md` returns canary content |
| 19 | Post-canary `git diff` | Empty (no repo changes) |
| 20 | Post-canary `git status` | Clean working tree (no unexpected changes) |
| 21 | Post-canary `.env` scan | No harness flags in any `.env` file |
| 22 | Cleanup confirmation | Session stopped, DB row deleted, services stopped, ports closed |

---

## 23. Delete-Canary Decision

**EXCLUDED.**

The delete canary is not included in AGENT-HARNESS-WRITE-CANARY-B. Rationale:

1. The primary beta use case is file creation/editing, not deletion.
2. The write canary is the critical path for BETA-READY-00 blocker B1.
3. Delete handler safety is already unit-tested (root rejection, directory rejection, glob rejection, traversal rejection).
4. Including delete would expand the canary scope and risk without addressing the primary blocker.
5. A separate delete canary can be registered as a future task if needed.

The `delete_file` handler IS registered in the dispatcher when `enableWriteTools=true` (it shares the same gate as `write_file`), but no delete tool call will be emitted by the stub adapter in write mode.

---

## 24. Split Decision

**NO SPLIT NEEDED.** Child B Step 3 is safe as a single step with two sub-phases:

### Sub-Phase 3a: G9 Stub Extension + Unit Tests

- Modify `TestToolCapableStubAdapter` to add write mode.
- Add unit tests for write mode.
- Run `npm test` and `npx tsc --noEmit` to validate.
- This is a small, bounded code change (one adapter file + one test file).

### Sub-Phase 3b: Live E2E Runtime Canary

- Start infrastructure.
- Create test session.
- Submit canary job.
- Verify results.
- Capture evidence.
- Clean up.

### Why No Split

1. Sub-phase 3a is small (one file + tests) and directly enables sub-phase 3b.
2. Sub-phase 3a cannot be validated in isolation without sub-phase 3b (the whole point of the stub extension is to drive the live canary).
3. Splitting into two child tasks would add governance overhead disproportionate to the work.
4. The 06D/06E canaries followed the same pattern (code change + runtime canary in a single step).

---

## 25. Exact Step 3 Scope Proposal

### Must Implement (Sub-Phase 3a)

| # | Change | File | Nature |
|---|--------|------|--------|
| 1 | Add `writeMode` flag to `TestToolCapableStubAdapter` | `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` | Production adapter (test-only adapter, not a real provider) |
| 2 | Add write-mode branch in `executeWithTools()` | Same file | Write-file → read-file → completed sequence |
| 3 | Add write-mode unit tests | `services/ai-service/src/ai-execution/adapters/__tests__/test-harness-stub-ai.adapter.spec.ts` | Test file |
| 4 | Create canary submission script | `services/ai-service/scripts/canary-write-b-submit-job.ts` | Canary script (based on 06E pattern) |

### Must Validate Before Runtime (Sub-Phase 3a validation)

| # | Command | Expected |
|---|---------|----------|
| 1 | `npx tsc --noEmit` (ai-service) | Exit 0 — no TypeScript errors |
| 2 | `npm test` (ai-service) | All suites pass — including new write-mode tests |
| 3 | `npm run build` (ai-service) | Exit 0 — build clean |

### Must Execute at Runtime (Sub-Phase 3b)

| # | Action | Expected |
|---|--------|----------|
| 1 | Start Docker + PostgreSQL + Redis | Healthy |
| 2 | Start container-manager | Port 4002 listening |
| 3 | Start API Gateway | Port 4000 listening; health 200 |
| 4 | Start AI Service Worker with process-scoped flags | "Worker connected to ai-execution queue" |
| 5 | Create + start test session | Session ID returned; container running |
| 6 | Submit canary job | Job submitted; worker picks up |
| 7 | Verify `write_file` dispatch succeeds | `harness.tool_dispatch_completed` for `write_file` with `success: true` |
| 8 | Verify pre-apply checkpoint created | `preApplyCheckpointHash` non-null in metadata |
| 9 | Verify `read_file` read-back succeeds | `harness.tool_dispatch_completed` for `read_file` with content matching written content |
| 10 | Verify loop completes | `harness.loop_completed` with `terminationReason: 'completed'` |
| 11 | Verify out-of-band read-back | Direct API call returns canary file content |
| 12 | Verify execution status | `execution_status: 'completed'`, `tokens: 0` |
| 13 | Verify host filesystem safety | `git diff` empty; `git status` clean |
| 14 | Verify no `.env` changes | Scan shows no harness flags in `.env*` files |
| 15 | Clean up | Session stopped, DB row deleted, services stopped |

### Must Capture

All 22 items from the Evidence Capture Checklist (Section 22).

### Must NOT Include

| # | Excluded Item |
|---|---------------|
| 1 | `delete_file` canary |
| 2 | `run_validation` activation |
| 3 | `browser_smoke` activation |
| 4 | Frontend changes or startup |
| 5 | Translation changes |
| 6 | Database migration changes |
| 7 | Package/dependency changes |
| 8 | Real AI provider calls |
| 9 | Stripe/payment/customer-portal/webhook work |
| 10 | Production `.env` file changes |
| 11 | Production deployment |
| 12 | Broad refactors |
| 13 | Auth/session/guard changes |
| 14 | Billing/credit code changes |
| 15 | Docker/Compose configuration changes |
| 16 | `docker compose down -v` |
| 17 | Git commit or push |
| 18 | Subagents |

---

## 26. Safety Confirmations

| # | Confirmation | Status |
|---|-------------|--------|
| 1 | No source/test/translation/package/migration/entity/environment/Docker files changed in Step 2 | CONFIRMED |
| 2 | No runtime, Docker, DB, browser, API, test, build, provider, payment, Stripe CLI, webhook, git commit, or git push occurred in Step 2 | CONFIRMED |
| 3 | No secret-bearing environment file opened in Step 2 | CONFIRMED |
| 4 | No live write/delete canary performed in Step 2 | CONFIRMED |
| 5 | No subagents used in Step 2 | CONFIRMED |
| 6 | All feature flags default to `false` — safe production state preserved | CONFIRMED |
| 7 | Write path is sandboxed to Docker container `/workspace/` — host protected | CONFIRMED |
| 8 | Path traversal blocked at 2 layers (ai-service regex + container-manager segment check) | CONFIRMED |
| 9 | Pre-apply checkpoint blocks writes if checkpoint fails | CONFIRMED |
| 10 | Kill switch available (process-scoped flags; Ctrl+C; docker stop) | CONFIRMED |
| 11 | Delete canary excluded | CONFIRMED |
| 12 | No split needed — single Step 3 with two sub-phases | CONFIRMED |
| 13 | Provider is `test-harness-stub` — zero billing, zero external API calls | CONFIRMED |
| 14 | File size (~80 bytes) well under 131,072 byte limit | CONFIRMED |
| 15 | `maxToolIterations: 3` accommodates the 3-iteration write sequence | CONFIRMED |
| 16 | TASKS.md not modified | CONFIRMED |
| 17 | TASKS_BACKLOG_FULL.md not modified | CONFIRMED |
| 18 | AINOW-EXECUTION-ROADMAP.md not modified | CONFIRMED |

---

## 27. Exact Next Action

**AGENT-HARNESS-WRITE-CANARY-B Step 3 — Implementation + Live Canary Execution.**

Execute in order:

1. **Sub-Phase 3a:** Implement G9 stub extension + unit tests. Validate with `npx tsc --noEmit`, `npm test`, `npm run build`.
2. **Sub-Phase 3b:** Start infrastructure, create session, submit canary job, verify all 22 evidence items, clean up.
3. **Document:** Create `docs/AGENT-HARNESS-WRITE-CANARY-B-EXECUTION.md` with full evidence.

Keith approval is already recorded ("go" — 2026-07-20). Step 3 may proceed.

Requires: Docker Desktop running. Do not start Docker in this step — this is planning only.
