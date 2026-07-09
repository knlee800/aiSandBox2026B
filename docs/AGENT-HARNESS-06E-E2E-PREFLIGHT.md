# AGENT-HARNESS-06E — Full E2E Readiness / Service Topology Preflight

**Task:** AGENT-HARNESS-06E — Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary
**Step:** 2 — Service Topology Preflight
**Status:** PREFLIGHT COMPLETE
**Date:** 2026-07-08
**Nature:** Read-only analysis. No runtime. No commands. No services started. No source changes.

---

## 1. Governance Readiness

| Criterion | Result |
|-----------|--------|
| AGENT-HARNESS-06E | **ACTIVE** — Step 1 Registration COMPLETE (2026-07-08) |
| AGENT-HARNESS-06D | **COMPLETE and LOCKED** (2026-07-08) |
| AGENT-HARNESS-06D1 | **COMPLETE and LOCKED** (2026-07-08) |
| AGENT-HARNESS-07 | **COMPLETE and LOCKED** (2026-07-07) |
| One-active-task rule | **SATISFIED** — AGENT-HARNESS-06E is the only ACTIVE task |

**Governance readiness: PASS**

---

## 2. Why 06E Exists

AGENT-HARNESS-06D validated the live Worker/BullMQ harness route end-to-end:

- `agent_harness.route_evaluated` with `selectedPath: 'harness'` — **PASS**
- `agent_harness.config_resolved` with `source: 'builder-profile'` — **PASS**
- `ToolDispatcher` created; `list_files` and `read_file` dispatched — **PASS**
- `harness.loop_completed` with `terminationReason: 'completed'` — **PASS**

**However:** Both `list_files` and `read_file` returned `HANDLER_ERROR` because the API Gateway was not running during the 06D canary. The tool handlers in ai-service make HTTP calls to the API Gateway (`ApiGatewayHttpClient`), which were refused because no API Gateway process was listening.

**06E must validate:** Read-only file tools (`list_files`, `read_file`) return **actual file data** through the full E2E service path:

```
Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient
  → API Gateway InternalWorkspaceFilesController → ContainerManagerHttpClient
    → container-manager InternalSessionsController → SessionsService
      → DockerRuntimeService → Docker container filesystem
```

---

## 3. Service Topology

### 3.1 Required Services for Step 3

| # | Service | Port | Role |
|---|---------|------|------|
| 1 | **PostgreSQL** (`aisandbox-postgres`) | 5432 | Usage records (ai-service claims/finalizes execution rows) |
| 2 | **Redis** (`aisandbox-redis`) | 6379 | BullMQ queue (`ai-execution`) |
| 3 | **API Gateway** | 4000 (default) | Proxies `/api/internal/workspace/:sessionId/{read,list}` to container-manager |
| 4 | **container-manager** | 4002 (default) | Handles `/api/internal/sessions/:id/{files,dirs}` via Docker exec |
| 5 | **AI Service worker** | 4099 (canary port) | BullMQ worker; executes harness loop with `test-harness-stub` |
| 6 | **Docker Desktop** | — | Provides Docker daemon for container-manager workspace containers |

### 3.2 Environment Variables

| Variable | Value for Step 3 | Scope |
|----------|-------------------|-------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Process-scoped (`$env:`) — AI Service worker terminal ONLY |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | Process-scoped |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | Process-scoped |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | Process-scoped |
| `REDIS_URL` | `redis://:aisandboxredis123@localhost:6379` | Process-scoped (all 3 services) |
| `DATABASE_URL` | `postgres://aisandbox:<password>@localhost:5432/aisandbox` | Process-scoped (all 3 services) |
| `INTERNAL_SERVICE_KEY` | Must match across all 3 services (read from `.env`) | Process-scoped |
| `API_GATEWAY_URL` | `http://localhost:4000` | Default in `ApiGatewayHttpClient` constructor |
| `CONTAINER_MANAGER_URL` | `http://localhost:4002` | Default in `ContainerManagerHttpClient` constructor |
| `PORT` (API Gateway) | `4000` | Process-scoped |
| `PORT` (container-manager) | `4002` | Process-scoped |
| `PORT` (AI Service worker) | `4099` | Process-scoped (avoids conflict) |
| `AI_PROVIDER` | Not used — harness selects adapter from job payload (`test-harness-stub`) | — |

### 3.3 Startup Order

Must start in dependency order:

1. **Docker Desktop** — must already be running
2. **PostgreSQL** + **Redis** — `docker compose up -d postgres redis`
3. **container-manager** — `node dist/main.js` (needs Docker, SQLite, Postgres not directly but API Gateway does)
4. **API Gateway** — `node dist/main.js` (needs Postgres for TypeORM, Redis for BullMQ queue, INTERNAL_SERVICE_KEY)
5. **Controlled session/workspace** — must be created before submitting the job (see §5)
6. **Canary job submission** — `npx tsx scripts/canary-06e-submit-job.ts`
7. **AI Service worker** — `node dist/main.js` (last: picks up the BullMQ job)

### 3.4 Stop / Rollback Approach

1. Stop AI Service worker (Ctrl+C in terminal)
2. Stop API Gateway (Ctrl+C in terminal)
3. Stop container-manager (Ctrl+C in terminal)
4. Clean up canary DB row: `DELETE FROM usage_records WHERE execution_id = '<canary-id>'`
5. Clean up canary session: stop/delete the controlled session container
6. Verify: `Select-String -Path '.env*' -Pattern 'AGENT_HARNESS_ENABLE_TOOL_LOOP'` returns empty
7. Verify: `git diff --name-only` shows no unexpected source changes
8. Docker infrastructure (postgres, redis) can remain running

---

## 4. File Tool Call Path (Traced from Source)

### 4.1 Full Chain

```
TestToolCapableStubAdapter.executeWithTools()
  → iteration 0: toolName='list_files', arguments={ path: '.' }
  → iteration 1: toolName='read_file', arguments={ path: 'README.md' }

WorkerProcessor (worker.processor.ts ~L790-808)
  → dispatcher.registerHandler('list_files', createListFilesHandler({...}))
  → dispatcher.registerHandler('read_file', createReadFileHandler({...}))

createListFilesHandler (file-tool-handlers.ts L75-95)
  → validates path → deps.client.listWorkspaceDirectory(sessionId, normalizedPath)

createReadFileHandler (file-tool-handlers.ts L42-63)
  → validates path → deps.client.readWorkspaceFile(sessionId, normalizedPath)

ApiGatewayHttpClient (api-gateway-http.client.ts)
  → listWorkspaceDirectory: GET {API_GATEWAY_URL}/api/internal/workspace/{sessionId}/list?path=...
  → readWorkspaceFile:     GET {API_GATEWAY_URL}/api/internal/workspace/{sessionId}/read?path=...
  → Header: X-Internal-Service-Key: {INTERNAL_SERVICE_KEY}

API Gateway InternalWorkspaceFilesController (internal-workspace-files.controller.ts)
  → Protected by global InternalServiceAuthGuard (APP_GUARD)
  → listDirectory: containerManagerHttpClient.listSessionDirectory(sessionId, path)
  → readFile:      containerManagerHttpClient.readSessionFile(sessionId, path)

ContainerManagerHttpClient (container-manager-http.client.ts)
  → listSessionDirectory: GET {CONTAINER_MANAGER_URL}/api/internal/sessions/{sessionId}/dirs?path=...
  → readSessionFile:      GET {CONTAINER_MANAGER_URL}/api/internal/sessions/{sessionId}/files?path=...
  → Header: X-Internal-Service-Key: {INTERNAL_SERVICE_KEY}

container-manager InternalSessionsController (internal-sessions.controller.ts)
  → Protected by InternalServiceAuthGuard (UseGuards on controller class)
  → listDirectory: sessionsService.listDirectoryInContainer(sessionId, dirPath)
  → readFile:      sessionsService.readFileFromContainer(sessionId, filePath)

SessionsService (sessions.service.ts)
  → assertSessionUsableOrThrow(sessionId) — checks SQLite session exists and not terminated
  → checkAndEnforceMaxLifetime, checkAndEnforceIdleTimeout, checkAndEnforceQuota
  → dockerRuntimeService.listDirectoryInContainer(sessionId, dirPath)
  → dockerRuntimeService.readFileFromContainer(sessionId, filePath)

DockerRuntimeService
  → Docker exec inside session container to read files from /workspace
```

### 4.2 Expected Success Shape

**list_files success:**
```json
{
  "path": "/",
  "entries": [
    { "name": "README.md", "type": "file", "size": 67, "modifiedAt": "2026-07-08T..." }
  ]
}
```

**read_file success:**
```json
{
  "path": "README.md",
  "content": "# Welcome to AI Sandbox!\n\nStart building your application here.\n"
}
```

The file-tool-handler transforms these before returning to the harness loop:

- `list_files` handler returns: `{ files: ["README.md"] }`
- `read_file` handler returns: `{ content: "# Welcome to AI Sandbox!...", truncated: false }`

### 4.3 Expected Harness Audit Events on Success

| Event | Data |
|-------|------|
| `harness.loop_started` | `maxToolIterations: 3` |
| `harness.model_invocation_completed` | iteration 0, `finishReason: 'tool_calls'`, `toolCallCount: 1` |
| `harness.tool_dispatch_started` | `toolName: 'list_files'` |
| `harness.tool_dispatch_completed` | `toolName: 'list_files'`, **success** (not HANDLER_ERROR) |
| `harness.model_invocation_completed` | iteration 1, `finishReason: 'tool_calls'`, `toolCallCount: 1` |
| `harness.tool_dispatch_started` | `toolName: 'read_file'` |
| `harness.tool_dispatch_completed` | `toolName: 'read_file'`, **success** (not HANDLER_ERROR) |
| `harness.model_invocation_completed` | iteration 2, `finishReason: 'completed'`, `toolCallCount: 0` |
| `harness.loop_completed` | `totalToolCalls: 2`, `terminationReason: 'completed'` |

---

## 5. Controlled Workspace / Session Plan

### 5.1 The Problem

The file tool handlers pass `sessionId` from the BullMQ job payload to the API Gateway, which passes it to container-manager. Container-manager's `SessionsService` does:

1. `assertSessionUsableOrThrow(sessionId)` — looks up session in SQLite DB
2. `checkAndEnforceMaxLifetime`, `checkAndEnforceIdleTimeout`, `checkAndEnforceQuota`
3. `dockerRuntimeService.readFileFromContainer(sessionId, filePath)` — finds Docker container by session ID

**This means a real session must exist in container-manager's SQLite DB with a running Docker container.**

### 5.2 Safest Session Setup Approach

**Option A (Recommended): Use container-manager's session creation API**

Call container-manager's `POST /api/sessions` endpoint to create a session, then `POST /api/sessions/:id/start` (or use the internal endpoint `POST /api/internal/sessions/:id/start`) to start the Docker container. This:

- Creates a SQLite session record with status `active`
- Creates workspace directory at `workspaces/<sessionId>/`
- Writes default `README.md`: `# Welcome to AI Sandbox!\n\nStart building your application here.\n`
- Starts a Docker container with the workspace mounted at `/workspace`
- Initializes git in the workspace

The canary job payload `sessionId` must match this session ID.

**Option B: Direct SQLite insert + Docker container creation**

Manually insert a session row into container-manager's SQLite DB and create a Docker container. More fragile and harder to clean up.

**Recommendation: Option A.** Use the HTTP API. This is exactly what the platform does in production.

### 5.3 Controlled Files Expected

After session creation, the workspace will contain:

| File | Content | Source |
|------|---------|--------|
| `README.md` | `# Welcome to AI Sandbox!\n\nStart building your application here.\n` | Written by `SessionsService.createSession()` |

Additional files may appear from git init (`.git/` directory), but `list_files` for `/` should show at least `README.md`.

### 5.4 Session Setup Timing

**Session creation is a runtime operation.** It requires container-manager to be running with Docker Desktop available. The session must be created **after** container-manager starts and **before** the BullMQ job is submitted.

This means session setup must happen during Step 3 execution, not during this preflight step.

### 5.5 Session Cleanup

After the canary, the controlled session should be stopped and deleted:

```
POST /api/sessions/<sessionId>/stop
DELETE /api/sessions/<sessionId>
```

Or via direct curl/PowerShell to container-manager at `http://localhost:4002`.

---

## 6. Existing Scripts / Path Discovery

### 6.1 Existing Canary Script

`services/ai-service/scripts/canary-06d-submit-job.ts` exists from the 06D canary. It:

- Loads `.env` with dotenv (read-only)
- Overrides Redis/Postgres hostnames to `localhost`
- Inserts a `usage_records` row with `execution_status = 'pending'`
- Submits one BullMQ job to the `ai-execution` queue
- Uses `npx tsx` runtime

### 6.2 Can canary-06d-submit-job.ts Be Reused?

**No — it should be copied and modified for 06E.** Key differences:

| Field | 06D Script | 06E Requirement |
|-------|-----------|-----------------|
| `executionId` | Random UUID | New random UUID |
| `sessionId` | Hardcoded synthetic UUID `00000000-06d0-...` | Must match a **real** session created in container-manager |
| `prompt` | 06D-specific text | 06E-specific text |
| Metadata | `{ canary: 'AGENT-HARNESS-06D', step: 3 }` | `{ canary: 'AGENT-HARNESS-06E', step: 3 }` |
| Session requirement | No real session needed (tool calls fail with HANDLER_ERROR) | **Real session with running container required** |

**A new `canary-06e-submit-job.ts` script is needed.** It should:

1. Accept or generate a session ID that matches the pre-created controlled session
2. Insert the `usage_records` row
3. Submit the BullMQ job with the correct session ID
4. The session ID can be passed as a CLI argument or read from a known constant

### 6.3 Session Creation Script

No existing script creates sessions for canary testing. Step 3 will need either:

- A simple curl/PowerShell command to call `POST /api/sessions` on container-manager
- A session creation step in the 06E submit script itself

**Recommendation:** Use PowerShell `Invoke-RestMethod` directly against `http://localhost:4002/api/sessions` to create the session, then pass the resulting session ID to the submit script.

### 6.4 Service Startup Scripts

No dedicated startup scripts exist for running services individually. Each service uses:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\<service>"; node dist/main.js
```

All three services must be built first with `npm run build`.

---

## 7. Exact Step 3 Design

### 7.1 Services to Start

| # | Service | Command |
|---|---------|---------|
| 1 | Docker Desktop | Must already be running |
| 2 | PostgreSQL + Redis | `docker compose up -d postgres redis` |
| 3 | container-manager | Build + start (see §7.2) |
| 4 | API Gateway | Build + start (see §7.2) |
| 5 | AI Service worker | Build + start with process-scoped env (see §7.2) |

### 7.2 Exact PowerShell Commands (Proposed)

**Step A — Infra verification:**

```powershell
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'
docker compose ps
docker compose up -d postgres redis
Select-String -Path 'C:\Users\knlee\aiSandBox2026B\.env*' -Pattern 'AGENT_HARNESS_ENABLE_TOOL_LOOP' -ErrorAction SilentlyContinue
```

**Step B — Build all three services (3 terminals):**

```powershell
# Terminal 1: container-manager
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\container-manager'
npm run build

# Terminal 2: API Gateway
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\api-gateway'
npm run build

# Terminal 3: AI Service
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'
npm run build
```

**Step C — Start container-manager (Terminal 1):**

```powershell
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:<password>@localhost:5432/aisandbox"
$env:INTERNAL_SERVICE_KEY = "<value from .env>"
$env:PORT = "4002"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\container-manager'
node dist/main.js
```

**Step D — Start API Gateway (Terminal 2):**

```powershell
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:<password>@localhost:5432/aisandbox"
$env:INTERNAL_SERVICE_KEY = "<value from .env>"
$env:CONTAINER_MANAGER_URL = "http://localhost:4002"
$env:PORT = "4000"
$env:LAUNCH_STATE = "INTERNAL"
$env:JWT_SECRET = "<value from .env>"
$env:ANTHROPIC_API_KEY = "dummy"
$env:OPENAI_API_KEY = "dummy"
$env:BILLING_CHARGES_ENABLED = "false"
$env:AI_PROVIDER = "stub"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\api-gateway'
node dist/main.js
```

**Step E — Create controlled session (after container-manager is running):**

```powershell
$cmUrl = "http://localhost:4002"
$internalKey = "<value from .env>"

# Create session (container-manager creates workspace + starts container)
$sessionResponse = Invoke-RestMethod -Uri "$cmUrl/api/sessions" -Method POST -ContentType 'application/json' -Body '{"userId":"canary-06e-user"}'
$sessionId = $sessionResponse.sessionId
Write-Host "Created session: $sessionId"

# Start container for the session
Invoke-RestMethod -Uri "$cmUrl/api/internal/sessions/$sessionId/start" -Method POST -ContentType 'application/json' -Headers @{ 'X-Internal-Service-Key' = $internalKey } -Body "{`"userId`":`"canary-06e-user`"}"
Write-Host "Container started for session: $sessionId"

# Verify workspace file exists
$files = Invoke-RestMethod -Uri "$cmUrl/api/internal/sessions/$sessionId/dirs?path=/" -Method GET -Headers @{ 'X-Internal-Service-Key' = $internalKey }
Write-Host "Workspace files: $($files | ConvertTo-Json)"
```

**Step F — Submit canary job (new terminal):**

```powershell
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:<password>@localhost:5432/aisandbox"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'
npx tsx scripts/canary-06e-submit-job.ts --sessionId <sessionId-from-step-E>
```

**Step G — Start AI Service worker with harness enabled (Terminal 3):**

```powershell
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "true"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_BROWSER_SMOKE = "false"
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:<password>@localhost:5432/aisandbox"
$env:INTERNAL_SERVICE_KEY = "<value from .env>"
$env:API_GATEWAY_URL = "http://localhost:4000"
$env:PORT = "4099"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'
node dist/main.js
```

**Step H — Post-run safety verification:**

```powershell
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'
git diff --name-only
Select-String -Path 'C:\Users\knlee\aiSandBox2026B\.env*' -Pattern 'AGENT_HARNESS_ENABLE_TOOL_LOOP|AGENT_HARNESS_ENABLE_WRITE_TOOLS|AGENT_HARNESS_ENABLE_VALIDATION_TOOLS|AGENT_HARNESS_ENABLE_BROWSER_SMOKE' -ErrorAction SilentlyContinue
```

### 7.3 Process-Scoped Env Values

| Variable | Value | Applied To |
|----------|-------|------------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | AI Service worker only |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | AI Service worker only |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | AI Service worker only |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | AI Service worker only |
| `REDIS_URL` | `redis://:aisandboxredis123@localhost:6379` | All services |
| `DATABASE_URL` | `postgres://aisandbox:<pw>@localhost:5432/aisandbox` | All services |
| `INTERNAL_SERVICE_KEY` | Read from `.env` (not hardcoded here) | All services |
| `API_GATEWAY_URL` | `http://localhost:4000` | AI Service worker |
| `CONTAINER_MANAGER_URL` | `http://localhost:4002` | API Gateway |

### 7.4 Provider

**`test-harness-stub`** — deterministic, zero external API calls, zero billing, zero tokens.

### 7.5 Job Payload (Proposed)

```json
{
  "executionId": "<random UUID>",
  "userId": "canary-06e-user",
  "apiKeyId": "canary-06e-apikey",
  "sessionId": "<real session ID from Step E>",
  "conversationId": "<random UUID>",
  "provider": "test-harness-stub",
  "adapter": "test-harness-stub",
  "prompt": "Full E2E read-only canary: list files in the controlled workspace and read README.md. Expect actual file data from container workspace. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands.",
  "harnessVersion": "v1",
  "model": "test-harness-stub",
  "agentRole": "builder",
  "builderProfileId": "builder-default",
  "submittedAt": "<ISO timestamp>"
}
```

### 7.6 Expected Logs / Evidence

Worker logs should show:

1. `agent_harness.route_evaluated` → `selectedPath: 'harness'`
2. `agent_harness.config_resolved` → `source: 'builder-profile'`
3. `harness.loop_started` → `maxToolIterations: 3`
4. Iteration 0: `harness.tool_dispatch_started` (list_files) → `harness.tool_dispatch_completed` (list_files) — **SUCCESS, not HANDLER_ERROR**
5. Iteration 1: `harness.tool_dispatch_started` (read_file) → `harness.tool_dispatch_completed` (read_file) — **SUCCESS, not HANDLER_ERROR**
6. Iteration 2: `finishReason: 'completed'`
7. `harness.loop_completed` → `totalToolCalls: 2`, `terminationReason: 'completed'`
8. `execution_completed` → `tokens: 0`, `execution_status: 'completed'`

### 7.7 Expected Tool Calls

| Iteration | Tool | Arguments | Expected Result |
|-----------|------|-----------|-----------------|
| 0 | `list_files` | `{ path: '.' }` | Success: files array containing `README.md` |
| 1 | `read_file` | `{ path: 'README.md' }` | Success: content = `# Welcome to AI Sandbox!\n\nStart building your application here.\n` |
| 2 | (none) | — | `finishReason: 'completed'` |

### 7.8 PASS / FAIL / BLOCKED Criteria

**PASS — ALL of the following must hold:**

1. `agent_harness.route_evaluated` with `selectedPath: 'harness'`
2. `agent_harness.config_resolved` with valid `source`
3. `adapter.supportsToolUse && adapter.executeWithTools` gate evaluates `true`
4. `ToolDispatcher` created; `read_file` + `list_files` registered
5. `executeAgentHarnessLoop` called (not plain `execute`)
6. Harness loop calls `executeFn` at least once
7. `list_files` tool dispatch **completes successfully** (not HANDLER_ERROR)
8. `read_file` tool dispatch **completes successfully** (not HANDLER_ERROR)
9. `list_files` result contains actual file entries (at least `README.md`)
10. `read_file` result contains actual file content (non-empty)
11. `harness.loop_completed` with `terminationReason: 'completed'`
12. No `write_file`, `delete_file`, `run_validation`, `browser_smoke` dispatched
13. No external API calls (provider: `test-harness-stub`, tokens: 0)
14. No `.env` files modified
15. `AGENT_HARNESS_ENABLE_TOOL_LOOP` not in any `.env` file after run
16. Job completes without hanging or crashing

**FAIL — Any of the following:**

- Tool dispatch returns HANDLER_ERROR on `list_files` or `read_file`
- File data is empty or missing
- Unexpected tool calls (write, delete, validation, browser)
- External API calls or non-zero billing
- `.env` file modification
- Job hangs or crashes

**BLOCKED — Any of the following:**

- Docker Desktop not running
- PostgreSQL or Redis not healthy
- container-manager fails to start
- API Gateway fails to start
- Session creation fails
- Docker container fails to start for session
- INTERNAL_SERVICE_KEY mismatch between services
- Missing database migration preventing API Gateway startup

---

## 8. Safety Boundaries

| Boundary | Enforcement |
|----------|-------------|
| Local dev only | All services run on localhost with process-scoped env |
| Process-scoped env only | PowerShell `$env:` — dies with terminal; never persisted to `.env` files |
| No `.env` edits | Pre/post scan with `Select-String` confirms no harness flags in `.env*` |
| Read-only tools only | `enableWriteTools: false`, `enableValidationTools: false`, `enableBrowserSmoke: false` |
| Browser smoke disabled | `enableBrowserSmoke: false` (hardcoded in config when env is `false`) |
| Write/delete tools disabled | Not registered in `ToolDispatcher` when `enableWriteTools: false` |
| No paid providers | Provider: `test-harness-stub` — zero API calls, zero tokens, zero billing |
| No production activation | `AGENT_HARNESS_ENABLE_TOOL_LOOP` only in the worker process; .env remains `false` |
| Post-run git diff | Verify no unexpected source changes |
| Post-run env scan | Verify no harness flags leaked to `.env` files |
| Canary DB row cleanup | DELETE canary `usage_records` row after verification |
| Controlled session cleanup | Stop and delete the canary session after verification |

---

## 9. Blockers / Risks

### 9.1 Session / Container Requirements (RISK: MEDIUM)

The file tool path requires a **real session with a running Docker container** in container-manager. This was not needed for 06D (where HANDLER_ERROR was acceptable). For 06E:

- container-manager must be running
- Docker Desktop must be running
- A controlled session must be created via API
- The session's Docker container must be started
- The workspace must contain `README.md`

**Mitigation:** Session creation via `POST /api/sessions` automatically creates workspace with `README.md` and initializes git. Container startup via `POST /api/internal/sessions/:id/start` starts the Docker container.

### 9.2 INTERNAL_SERVICE_KEY Consistency (RISK: LOW)

All three services must use the same `INTERNAL_SERVICE_KEY` value. The value from `.env` must be passed to each process via `$env:INTERNAL_SERVICE_KEY`.

**Mitigation:** Read the value once from `.env` and apply to all three process terminals.

### 9.3 API Gateway Startup Dependencies (RISK: LOW-MEDIUM)

API Gateway requires:

- PostgreSQL (TypeORM connection)
- Valid `LAUNCH_STATE` (must be `INTERNAL` or another valid value)
- Valid `JWT_SECRET`
- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` must be non-empty (startup validator requirement, even though not used for `test-harness-stub`)

**Mitigation:** Pass `ANTHROPIC_API_KEY=dummy` and `OPENAI_API_KEY=dummy` to satisfy startup validator. Set `AI_PROVIDER=stub` for API Gateway (it doesn't execute AI — that's the worker's job).

### 9.4 Container-Manager SQLite vs Docker Runtime (RISK: LOW)

Container-manager uses SQLite for session state and Dockerode for container operations. The `getWorkspacePath` method returns `workspaces/<sessionId>` relative to the container-manager root. File reads go through Docker exec, not direct filesystem access.

**Mitigation:** Using the HTTP API for session creation handles all this correctly.

### 9.5 Database Migration (RISK: LOW)

API Gateway uses TypeORM with PostgreSQL. If migrations have not been run, it may fail to start.

**Mitigation:** Run `npm run migration:run` in api-gateway if needed. (This was already done for prior canaries.)

### 9.6 Port Conflicts (RISK: LOW)

If other services are already running on ports 4000, 4002, or 4099, startup will fail.

**Mitigation:** Verify ports are free before starting. Use process-scoped `$env:PORT` to avoid conflicts.

### 9.7 New Script Required (RISK: LOW)

A new `canary-06e-submit-job.ts` script must be created in Step 3. The 06D script cannot be reused as-is because 06E requires a real session ID.

**Mitigation:** Copy `canary-06d-submit-job.ts`, modify session ID to be configurable (CLI arg or env var), update metadata to reference 06E.

### 9.8 Source Mutation Risk (RISK: NONE)

Step 3 implementation slice will need to create exactly one new file:

- `services/ai-service/scripts/canary-06e-submit-job.ts` — canary job submission script

No existing source files need modification. No `.env` files need modification.

### 9.9 Container-Manager `createSession` Also Calls API Gateway (RISK: LOW)

The `SessionsService.createSession()` method calls `this.apiGatewayClient.notifySessionStarted(sessionId)`. If API Gateway is not yet running when the session is created, this notification will fail (but is caught and non-blocking — `console.error` only).

**Mitigation:** Start API Gateway before creating the session, OR accept the non-blocking notification failure (session creation still succeeds).

---

## 10. Readiness Conclusion

### Status: READY — Pending Keith Approval + One Implementation Slice

**What is ready:**

- [x] Governance: 06E ACTIVE, all prerequisites COMPLETE and LOCKED
- [x] Service topology: fully mapped; all ports, env vars, startup order identified
- [x] File tool call path: fully traced from adapter through all 4 services to Docker exec
- [x] Expected success shape: documented for both `list_files` and `read_file`
- [x] PASS/FAIL/BLOCKED criteria: defined (16 PASS criteria)
- [x] Safety boundaries: defined (12 boundaries)
- [x] Controlled workspace plan: use `POST /api/sessions` → runtime session with `README.md`
- [x] Existing script discovery: 06D script identified; 06E script needed (copy+modify)
- [x] Risks identified: 9 risks, all LOW or LOW-MEDIUM with clear mitigations

**What is needed before Step 3 can execute:**

1. **Keith explicit approval** to proceed to Step 3 (runtime execution with 3 services)
2. **One small implementation slice** within Step 3:
   - Create `services/ai-service/scripts/canary-06e-submit-job.ts` (copy of 06D script with configurable session ID)
   - No other source changes needed

**No blocking implementation work is required before Step 3.** The submit script creation is trivial and can be done at the start of Step 3 itself.

### Exact Keith Approvals Required

1. **Approve Step 3 runtime execution** — starting Docker Desktop, PostgreSQL, Redis, container-manager, API Gateway, and AI Service worker for the full E2E canary
2. **Approve controlled session creation** — creating a real session in container-manager with a running Docker container
3. **Approve new canary script** — creating `canary-06e-submit-job.ts` (copy of 06D with configurable session ID)
4. **Approve process-scoped `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`** on the AI Service worker process only (same safety model as 06D)

---

## 11. Files Created / Changed

| # | File | Action |
|---|------|--------|
| 1 | `docs/AGENT-HARNESS-06E-E2E-PREFLIGHT.md` | **CREATED** — this preflight document |

No other files created or changed.

---

## 12. Files Inspected

| # | File | Purpose |
|---|------|---------|
| 1 | `TASKS.md` | Governance status verification |
| 2 | `TASKS_BACKLOG_FULL.md` | Governance status verification |
| 3 | `docs/AINOW-EXECUTION-ROADMAP.md` | Execution sequence and current next task |
| 4 | `docs/AGENT-HARNESS-06D-CHECKPOINT.md` | 06D completion evidence and known limitation |
| 5 | `docs/AGENT-HARNESS-06D-LIVE-CANARY-EXECUTION.md` | 06D exact commands and evidence |
| 6 | `docs/AGENT-HARNESS-06D1-CHECKPOINT.md` | TestToolCapableStubAdapter details |
| 7 | `services/ai-service/scripts/canary-06d-submit-job.ts` | Existing canary script for reuse analysis |
| 8 | `services/ai-service/src/worker/worker.processor.ts` | Harness route and dispatcher wiring |
| 9 | `services/ai-service/src/queue/job.types.ts` | Job payload type definition |
| 10 | `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` | Adapter deterministic sequence |
| 11 | `services/ai-service/src/agent-harness/tools/handlers/file-tool-handlers.ts` | File tool handler implementation |
| 12 | `services/ai-service/src/clients/api-gateway-http.client.ts` | AI service → API Gateway HTTP calls |
| 13 | `services/ai-service/package.json` | Dependencies and scripts |
| 14 | `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | API Gateway workspace proxy endpoints |
| 15 | `services/api-gateway/src/clients/container-manager-http.client.ts` | API Gateway → container-manager HTTP calls |
| 16 | `services/api-gateway/src/guards/internal-service-auth.guard.ts` | Internal route authentication |
| 17 | `services/api-gateway/src/app.module.ts` | Global guard registration |
| 18 | `services/api-gateway/package.json` | Dependencies and scripts |
| 19 | `services/container-manager/src/sessions/internal-sessions.controller.ts` | Container-manager internal file endpoints |
| 20 | `services/container-manager/src/sessions/sessions.service.ts` | Session lifecycle and file operations |
| 21 | `services/container-manager/src/sessions/sessions.controller.ts` | Public session endpoints |
| 22 | `services/container-manager/src/files/files.controller.ts` | Container-manager files controller (non-internal) |
| 23 | `services/container-manager/src/files/files.service.ts` | Container-manager files service (non-internal) |
| 24 | `services/container-manager/src/files/dto/files.dto.ts` | File DTOs |
| 25 | `services/container-manager/package.json` | Dependencies and scripts |
| 26 | `docker-compose.yml` | Infrastructure service definitions |
| 27 | `.env.example` | Environment variable template |
| 28 | `.env` | Actual environment values (read-only inspection) |
| 29 | `services/api-gateway/src/main.ts` | API Gateway port configuration |
| 30 | `services/container-manager/src/main.ts` | Container-manager port configuration |

---

## 13. Confirmations

- [x] AGENT-HARNESS-06E Step 2 — Service Topology Preflight — **COMPLETE**
- [x] No source files changed (only `docs/AGENT-HARNESS-06E-E2E-PREFLIGHT.md` created)
- [x] No governance files changed (TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md unchanged)
- [x] No `.env` files changed
- [x] No Docker services started
- [x] No API Gateway started
- [x] No container-manager started
- [x] No AI Service worker started
- [x] No BullMQ jobs submitted
- [x] No `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` set anywhere
- [x] No tests run
- [x] No builds run
- [x] No database commands run
- [x] No migrations run
- [x] No runtime commands executed
- [x] No browser smoke
- [x] No provider/API calls
- [x] No sessions/workspaces/containers created
- [x] No git commits or pushes
- [x] AGENT-HARNESS-06E can proceed to Step 3 with Keith approval + trivial script creation
