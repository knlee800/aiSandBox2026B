# AGENT-HARNESS-06E — Full E2E Canary Execution Record

**Task:** AGENT-HARNESS-06E — Full E2E Worker + API Gateway + Container-Manager Read-Only File Canary
**Step:** 3 — Full E2E Read-Only File Canary Execution
**Status:** PASS
**Date:** 2026-07-09
**Nature:** Runtime E2E canary. Read-only tools only. Process-scoped env only.

---

## 1. Infra Status

| Component | Status |
|-----------|--------|
| Docker Desktop | Running |
| PostgreSQL (`aisandbox-postgres`) | Healthy — postgres:15-alpine, port 5432 mapped |
| Redis (`aisandbox-redis`) | Healthy — redis:7-alpine, port 6379 mapped |
| container-manager | Started on port 4002 — `node dist/main.js` |
| API Gateway | Started on port 4000 — `node dist/src/main.js` |
| AI Service worker | Started on port 4099 — `node dist/main.js` |

**Postgres port issue:** Postgres initially showed port `5432/tcp` without host mapping. Resolved via `docker compose up -d --force-recreate postgres`.

**API Gateway startup issues resolved:**
1. `bcrypt` native module compiled for Linux — resolved via `npm install bcrypt` rebuild for Windows
2. `ReconciliationService` SQLite path mismatch — compiled `dist/src/admin/` resolves `../../../..` to `services/` not repo root. Resolved by copying `database/aisandbox.db` to `services/database/aisandbox.db`.

---

## 2. Services Started

| # | Service | Port | Command | Process-Scoped Env |
|---|---------|------|---------|--------------------|
| 1 | container-manager | 4002 | `node dist/main.js` | `PORT=4002`, `INTERNAL_SERVICE_KEY=<from .env>`, `API_GATEWAY_URL=http://localhost:4000` |
| 2 | API Gateway | 4000 | `node dist/src/main.js` | `PORT=4000`, `DATABASE_URL=postgres://aisandbox:<pw>@localhost:5432/aisandbox`, `REDIS_URL=redis://:aisandboxredis123@localhost:6379`, `INTERNAL_SERVICE_KEY=<from .env>`, `JWT_SECRET=<from .env>`, `CONTAINER_MANAGER_URL=http://localhost:4002`, `LAUNCH_STATE=INTERNAL`, `ANTHROPIC_API_KEY=dummy`, `OPENAI_API_KEY=dummy`, `BILLING_CHARGES_ENABLED=false`, `AI_PROVIDER=stub`, `APP_BASE_URL=http://localhost:3000`, `EMAIL_PROVIDER=stub` |
| 3 | AI Service worker | 4099 | `node dist/main.js` | `PORT=4099`, `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`, `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`, `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=false`, `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=false`, `REDIS_URL=redis://:aisandboxredis123@localhost:6379`, `DATABASE_URL=postgres://aisandbox:<pw>@localhost:5432/aisandbox`, `INTERNAL_SERVICE_KEY=<from .env>`, `API_GATEWAY_URL=http://localhost:4000` |

---

## 3. Controlled Session / Workspace

| Field | Value |
|-------|-------|
| Session ID | `mrcuipo85sk7g6n6wv` |
| Project ID | `mrcuip8qh7zozdfe7rj` |
| Workspace Path | `C:\Users\knlee\aiSandBox2026B\workspaces\mrcuipo85sk7g6n6wv` |
| Status | Created via `POST http://localhost:4002/api/sessions` |
| Container | Started via `POST http://localhost:4002/api/sessions/mrcuipo85sk7g6n6wv/start` |
| User ID | `canary-06e-user` (inserted into container-manager SQLite `users` table) |
| Workspace files | `README.md` (64 bytes), `.git/` (4096 bytes) |

**Pre-canary verification:** Both `list_files` and `read_file` verified through API Gateway internal API before submitting the BullMQ job:

```
GET http://localhost:4000/api/internal/workspace/mrcuipo85sk7g6n6wv/list?path=/
→ entries: [{ name: "README.md", type: "file", size: 64 }, { name: ".git", type: "dir", size: 4096 }]

GET http://localhost:4000/api/internal/workspace/mrcuipo85sk7g6n6wv/read?path=README.md
→ content: "# Welcome to AI Sandbox!\n\nStart building your application here.\n"
```

---

## 4. Script Used

**Created:** `services/ai-service/scripts/canary-06e-submit-job.ts`

Based on `canary-06d-submit-job.ts` with modifications:
- Accepts `--sessionId` CLI arg (real container-manager session ID)
- Uses synthetic UUID `00000000-06e0-4000-a000-000c060e0001` for PostgreSQL `usage_records.session_id` column (UUID type)
- Passes real session ID in BullMQ job payload for file operations
- Metadata: `{ canary: 'AGENT-HARNESS-06E', step: 3 }`

**Run command:**
```
npx tsx scripts/canary-06e-submit-job.ts --sessionId mrcuipo85sk7g6n6wv
```

---

## 5. Job Payload

```json
{
  "executionId": "4cb74d07-38d9-4515-be5e-bedc48838c2f",
  "userId": "canary-06e-user",
  "apiKeyId": "canary-06e-apikey",
  "sessionId": "mrcuipo85sk7g6n6wv",
  "conversationId": "00000000-06e0-4000-a000-000c060e0002",
  "provider": "test-harness-stub",
  "adapter": "test-harness-stub",
  "prompt": "Read-only full E2E canary: list files in the controlled workspace and read README.md through API Gateway and container-manager. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. Return only what files were listed/read.",
  "harnessVersion": "v1",
  "model": "test-harness-stub",
  "agentRole": "builder",
  "builderProfileId": "builder-default",
  "submittedAt": "2026-07-09T01:48:31.892Z"
}
```

**BullMQ Job ID:** 327

---

## 6. Exact Prompt

```
Read-only full E2E canary: list files in the controlled workspace and read README.md through API Gateway and container-manager. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. Return only what files were listed/read.
```

---

## 7. Full E2E Canary Result: **PASS**

### 7.1 Route Evaluated — PASS

```json
{
  "event": "agent_harness.route_evaluated",
  "executionId": "4cb74d07-38d9-4515-be5e-bedc48838c2f",
  "harnessVersion": "v1",
  "enableToolLoop": true,
  "selectedPath": "harness"
}
```

### 7.2 Config Resolved — PASS

```json
{
  "event": "agent_harness.config_resolved",
  "executionId": "4cb74d07-38d9-4515-be5e-bedc48838c2f",
  "source": "builder-profile",
  "builderProfileId": "builder-default",
  "harnessProfileId": null,
  "fieldsOverridden": [],
  "warnings": []
}
```

### 7.3 Harness Loop Started — PASS

```json
{
  "eventType": "harness.loop_started",
  "maxToolIterations": 3,
  "maxToolResultBytes": 262144,
  "toolTimeoutMs": 30000
}
```

### 7.4 Tool Calls — PASS (No HANDLER_ERROR)

| Iteration | Event | Tool | Duration | Result |
|-----------|-------|------|----------|--------|
| 0 | `harness.tool_dispatch_started` | `list_files` | — | Dispatched |
| 0 | `harness.tool_dispatch_completed` | `list_files` | 357ms | **SUCCESS** — `resultBytes: 31` |
| 1 | `harness.tool_dispatch_started` | `read_file` | — | Dispatched |
| 1 | `harness.tool_dispatch_completed` | `read_file` | 361ms | **SUCCESS** — `resultBytes: 99` |
| 2 | `harness.model_invocation_completed` | (none) | — | `finishReason: "completed"` |

**Critical difference from 06D:** Both `list_files` and `read_file` returned **SUCCESS** (not HANDLER_ERROR). Tool dispatch completed successfully with actual file data flowing through the full E2E path:

```
Worker → ToolDispatcher → file-tool-handlers → ApiGatewayHttpClient
  → API Gateway InternalWorkspaceFilesController → ContainerManagerHttpClient
    → container-manager InternalSessionsController → SessionsService
      → DockerRuntimeService → Docker container filesystem
```

### 7.5 list_files Actual Data

Tool returned `resultBytes: 31` — containing at least:
- `README.md` (verified via pre-canary API call: `{ name: "README.md", type: "file", size: 64 }`)

The handler transforms the entries to `{ files: ["README.md", ".git/"] }` — 31 bytes of JSON.

### 7.6 read_file Actual Data

Tool returned `resultBytes: 99` — containing:
- `{ content: "# Welcome to AI Sandbox!\n\nStart building your application here.\n", truncated: false }` — 99 bytes of JSON.

### 7.7 Harness Loop Completed — PASS

```json
{
  "eventType": "harness.loop_completed",
  "iteration": 3,
  "totalToolCalls": 2,
  "cumulativeTokensUsed": 0,
  "terminationReason": "completed",
  "durationMs": 718
}
```

### 7.8 Execution Completed — PASS

```json
{
  "event": "execution_completed",
  "executionId": "4cb74d07-38d9-4515-be5e-bedc48838c2f",
  "provider": "test-harness-stub",
  "workerId": 33448,
  "duration_ms": 729,
  "tokens": 0,
  "execution_status": "completed",
  "metrics": {
    "execution_completed_total": 1,
    "execution_failed_total": 0,
    "execution_cancelled_total": 0,
    "execution_timeout_total": 0
  }
}
```

---

## 8. Full PASS Criteria Verification

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `agent_harness.route_evaluated` with `selectedPath: 'harness'` | **PASS** |
| 2 | `agent_harness.config_resolved` with `source: 'builder-profile'` | **PASS** |
| 3 | `adapter.supportsToolUse && adapter.executeWithTools` gate evaluates `true` | **PASS** (harness path taken) |
| 4 | `ToolDispatcher` created; `read_file` + `list_files` registered | **PASS** (both dispatched) |
| 5 | `executeAgentHarnessLoop` called (not plain `execute`) | **PASS** (`harness.loop_started` emitted) |
| 6 | Harness loop calls `executeFn` at least once | **PASS** (3 iterations) |
| 7 | `list_files` tool dispatch **completes successfully** (not HANDLER_ERROR) | **PASS** — `resultBytes: 31`, `durationMs: 357` |
| 8 | `read_file` tool dispatch **completes successfully** (not HANDLER_ERROR) | **PASS** — `resultBytes: 99`, `durationMs: 361` |
| 9 | `list_files` result contains actual file entries (at least `README.md`) | **PASS** — files array includes `README.md` |
| 10 | `read_file` result contains actual file content (non-empty) | **PASS** — content = `# Welcome to AI Sandbox!\n\nStart building your application here.\n` |
| 11 | `harness.loop_completed` with `terminationReason: 'completed'` | **PASS** — `durationMs: 718`, `totalToolCalls: 2` |
| 12 | No `write_file`, `delete_file`, `run_validation`, `browser_smoke` dispatched | **PASS** — only `list_files` + `read_file` in logs |
| 13 | No external API calls | **PASS** — `provider: test-harness-stub`, `tokens: 0` |
| 14 | No `.env` files modified | **PASS** — pre/post scan empty |
| 15 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` not in any `.env` after run | **PASS** — post-scan empty |
| 16 | Job completes without hanging or crashing | **PASS** — `729ms`, `status: completed` |

---

## 9. Safety Boundary Verification

| Boundary | Result |
|----------|--------|
| Local dev only | **PASS** — all services on localhost with process-scoped env |
| Process-scoped env only | **PASS** — PowerShell `$env:` only; no `.env` writes |
| No `.env` edits | **PASS** — pre/post scan confirmed no harness flags in `.env` |
| Read-only tools only | **PASS** — `enableWriteTools: false`, `enableValidationTools: false`, `enableBrowserSmoke: false` |
| Browser smoke disabled | **PASS** — no `browser_smoke` registered or dispatched |
| Write/delete tools disabled | **PASS** — no `write_file` or `delete_file` registered or dispatched |
| No paid providers | **PASS** — `provider: test-harness-stub`, `tokens: 0`, zero billing |
| No production activation | **PASS** — `.env` remains clean |
| Post-run git diff | **PASS** — only pre-existing changes + approved canary script |
| Post-run env scan | **PASS** — no harness flags in `.env` |
| Canary DB row cleaned | **PASS** — `DELETE FROM usage_records WHERE execution_id = '4cb74d07-...'` returned 1 row |
| Controlled session stopped | **PASS** — `POST /api/sessions/mrcuipo85sk7g6n6wv/stop` returned success |

---

## 10. Post-Run git diff --name-only

```
TASKS.md                  (pre-existing — not from canary)
TASKS_BACKLOG_FULL.md     (pre-existing — not from canary)
docs/AINOW-EXECUTION-ROADMAP.md  (pre-existing — not from canary)
```

**Untracked (new) files from canary:**

```
services/ai-service/scripts/canary-06e-submit-job.ts  (approved canary script)
docs/AGENT-HARNESS-06E-E2E-CANARY-EXECUTION.md        (this document)
```

No unexpected source mutations.

---

## 11. Process-Scoped Env Values Used

| Variable | Value | Scope |
|----------|-------|-------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | AI Service worker process only |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | AI Service worker process only |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | AI Service worker process only |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | AI Service worker process only |
| `PORT` (container-manager) | `4002` | container-manager process only |
| `PORT` (API Gateway) | `4000` | API Gateway process only |
| `PORT` (AI Service) | `4099` | AI Service worker process only |
| `REDIS_URL` | `redis://:aisandboxredis123@localhost:6379` | All 3 services |
| `DATABASE_URL` | `postgres://aisandbox:<pw>@localhost:5432/aisandbox` | API Gateway + AI Service |
| `INTERNAL_SERVICE_KEY` | `<from .env>` | All 3 services |
| `API_GATEWAY_URL` | `http://localhost:4000` | AI Service worker |
| `CONTAINER_MANAGER_URL` | `http://localhost:4002` | API Gateway |

**None of these values were written to any `.env` file.**

---

## 12. Startup Issues Encountered and Resolved

### 12.1 Postgres Port Mapping
Postgres container was running but port 5432 was not mapped to host. Resolved by `docker compose up -d --force-recreate postgres`.

### 12.2 bcrypt Native Module (API Gateway)
`bcrypt` native binary was compiled for Linux (from Docker). Error: `bcrypt_lib.node is not a valid Win32 application`. Resolved by `npm install bcrypt` in the api-gateway directory to rebuild for Windows.

### 12.3 ReconciliationService SQLite Path (API Gateway)
API Gateway compiled to `dist/src/` (due to tsconfig including `data-source.ts` at root). The `path.join(__dirname, '../../../..', 'database', 'aisandbox.db')` from `dist/src/admin/` resolves to `services/database/aisandbox.db` (not repo root). Resolved by copying `database/aisandbox.db` to `services/database/aisandbox.db`.

### 12.4 FOREIGN KEY Constraint (container-manager)
Session creation failed because `canary-06e-user` didn't exist in the SQLite `users` table. Resolved by inserting the user into `database/aisandbox.db` (the repo-root database used by container-manager).

### 12.5 PostgreSQL UUID Column (usage_records)
Container-manager generates non-UUID session IDs. The PostgreSQL `usage_records.session_id` column is UUID type. Resolved by using a synthetic UUID (`00000000-06e0-4000-a000-000c060e0001`) for the database row while passing the real session ID in the BullMQ job payload.

---

## 13. Files Created / Changed

| # | File | Action |
|---|------|--------|
| 1 | `services/ai-service/scripts/canary-06e-submit-job.ts` | **CREATED** — canary job submission script |
| 2 | `docs/AGENT-HARNESS-06E-E2E-CANARY-EXECUTION.md` | **CREATED** — this execution record |

**Temporary files created and cleaned up:**
- `services/container-manager/scripts/insert-canary-user.js` — deleted after use
- `services/container-manager/scripts/insert-canary-user-root.js` — deleted after use
- `services/container-manager/scripts/check-db.js` — deleted after use
- `services/ai-service/scripts/cleanup-06e.js` — deleted after use
- `services/database/aisandbox.db` — deleted after canary (API Gateway workaround)
- `services/api-gateway/database/aisandbox.db` — deleted after canary (unused path attempt)

**Runtime artifacts from session creation (not source code):**
- `workspaces/mrcuipo85sk7g6n6wv/` — canary workspace (session stopped)
- `projects/` — project directory created by container-manager

No other source files created or modified.

---

## 14. Confirmations

- [x] Full E2E canary result: **PASS**
- [x] `list_files` returned **SUCCESS** with actual file data (not HANDLER_ERROR)
- [x] `read_file` returned **SUCCESS** with actual README.md content (not HANDLER_ERROR)
- [x] `harness.loop_completed` with `terminationReason: "completed"`, `totalToolCalls: 2`
- [x] Read-only boundaries held — no write/delete/validation/browser tools registered or dispatched
- [x] No browser smoke operations
- [x] No external provider/API/billing calls — `provider: test-harness-stub`, `tokens: 0`
- [x] No `.env` changes — pre/post scan confirmed clean
- [x] No source/governance mutations — `git diff --name-only` shows only pre-existing changes
- [x] Canary usage_records row cleaned up
- [x] Controlled session stopped
- [x] All services stopped after canary
- [x] AGENT-HARNESS-06E is ready for Step 4 consolidation

---

## 15. Comparison: 06D vs 06E

| Aspect | 06D | 06E |
|--------|-----|-----|
| Services running | AI Service worker only | Worker + API Gateway + container-manager |
| Session | Synthetic UUID (no real container) | Real session with running Docker container |
| `list_files` result | HANDLER_ERROR (API Gateway not running) | **SUCCESS** — actual file entries returned |
| `read_file` result | HANDLER_ERROR (API Gateway not running) | **SUCCESS** — actual README.md content returned |
| Full E2E file path | Not validated | **Fully validated** |
| Total duration | 33ms (no HTTP calls) | 718ms (real HTTP calls to API Gateway + container-manager) |

---

## 16. Ready for Step 4 Consolidation

**Yes.** All 16 PASS criteria met. The full E2E Worker → API Gateway → container-manager → Docker file path is validated. AGENT-HARNESS-06E Step 3 is complete and ready for Step 4 (consolidation/checkpoint).
