# AGENT-HARNESS-06D — Live Worker/BullMQ Read-Only Canary Execution

**Task:** AGENT-HARNESS-06D — Live Worker/BullMQ Read-Only Canary Gap Closure
**Step:** 3 — Live Worker/BullMQ Read-Only Canary Execution
**Status:** PASS
**Date:** 2026-07-08
**Nature:** Live runtime canary execution. Process-scoped env only. No production activation. No paid provider calls.

---

## 1. Infra Status

| Service | Status | Detail |
|---------|--------|--------|
| Docker Desktop | Running | v29.2.1 |
| `aisandbox-postgres` | Healthy | postgres:15-alpine, port 5432 |
| `aisandbox-redis` | Healthy | redis:7-alpine, port 6379 |
| AI Service (worker) | Started manually | node dist/main.js on port 4099 |
| API Gateway | NOT running | Expected — tool dispatch HTTP calls fail with HANDLER_ERROR (documented acceptable per §7.8 of design doc) |

---

## 2. Exact Commands Run

### Step A — Infra verification

```powershell
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; docker compose ps
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; Select-String -Path 'C:\Users\knlee\aiSandBox2026B\.env*' -Pattern 'AGENT_HARNESS_ENABLE_TOOL_LOOP|AGENT_HARNESS_ENABLE_WRITE_TOOLS|AGENT_HARNESS_ENABLE_VALIDATION_TOOLS|AGENT_HARNESS_ENABLE_BROWSER_SMOKE' -ErrorAction SilentlyContinue
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; docker compose up -d postgres redis
```

### Step B — Build

```powershell
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'; npx tsc --noEmit
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'; npm run build
```

### Step C — Job submission

```powershell
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:***@localhost:5432/aisandbox"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'
npx tsx scripts/canary-06d-submit-job.ts
```

### Step D — Worker with process-scoped env

```powershell
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "true"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = "false"
$env:AGENT_HARNESS_ENABLE_BROWSER_SMOKE = "false"
$env:REDIS_URL = "redis://:aisandboxredis123@localhost:6379"
$env:DATABASE_URL = "postgres://aisandbox:***@localhost:5432/aisandbox"
$env:PORT = "4099"
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B\services\ai-service'
node dist/main.js
```

### Step F — Post-run safety

```powershell
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; git diff --name-only
Set-Location -LiteralPath 'C:\Users\knlee\aiSandBox2026B'; Select-String -Path 'C:\Users\knlee\aiSandBox2026B\.env*' -Pattern 'AGENT_HARNESS_ENABLE_TOOL_LOOP|AGENT_HARNESS_ENABLE_WRITE_TOOLS|AGENT_HARNESS_ENABLE_VALIDATION_TOOLS|AGENT_HARNESS_ENABLE_BROWSER_SMOKE' -ErrorAction SilentlyContinue
docker exec aisandbox-postgres psql -U aisandbox -d aisandbox -c "SELECT execution_id, execution_status, provider, adapter, model, tokens_used FROM usage_records WHERE execution_id = 'c6ec939a-6039-42ab-baa1-aa29aceb4c3d'"
```

---

## 3. Process-Scoped Env Used

| Variable | Value | Scope |
|----------|-------|-------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Process-scoped only (PowerShell `$env:`) |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | Process-scoped only |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | Process-scoped only |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | Process-scoped only |
| `REDIS_URL` | `redis://:***@localhost:6379` | Process-scoped (overrides Docker-internal hostname) |
| `DATABASE_URL` | `postgres://aisandbox:***@localhost:5432/aisandbox` | Process-scoped (overrides Docker-internal hostname) |
| `PORT` | `4099` | Process-scoped (avoids conflict with any running service) |

**Confirmed:** No `.env` files were modified before, during, or after the canary run.

---

## 4. Script Used

**Created:** `services/ai-service/scripts/canary-06d-submit-job.ts`

The script:
- Loads `.env` with dotenv (read-only; does not modify)
- Overrides Redis/Postgres hostnames to `localhost` for local execution
- Inserts a `usage_records` row with `execution_status = 'pending'` (required by worker)
- Submits exactly one BullMQ job to the `ai-execution` queue
- Prints job ID and exits
- Uses `tsx` runtime (ts-node unavailable; tsx v4.22.3 available)

---

## 5. Exact Job Payload

```json
{
  "executionId": "c6ec939a-6039-42ab-baa1-aa29aceb4c3d",
  "userId": "canary-06d-user",
  "apiKeyId": "canary-06d-apikey",
  "sessionId": "00000000-06d0-4000-a000-000c060d0001",
  "conversationId": "00000000-06d0-4000-a000-000c060d0002",
  "provider": "test-harness-stub",
  "adapter": "test-harness-stub",
  "prompt": "Read-only live worker canary: list files in the controlled workspace and read README.md. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. Return only what files were listed/read.",
  "harnessVersion": "v1",
  "model": "test-harness-stub",
  "agentRole": "builder",
  "builderProfileId": "builder-default",
  "submittedAt": "2026-07-08T10:16:22.169Z"
}
```

BullMQ job ID: `326`

---

## 6. Exact Prompt

```
Read-only live worker canary: list files in the controlled workspace and read README.md. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands. Return only what files were listed/read.
```

---

## 7. Logs / Evidence

### 7.1 Worker Startup

```
[WorkerProcessor] Worker connected to ai-execution queue
[NestApplication] Nest application successfully started
AI Service started!
Listening on: http://localhost:4099
```

### 7.2 Job Received and Claimed

```
[WorkerProcessor] Worker received job 326 executionId=c6ec939a-6039-42ab-baa1-aa29aceb4c3d workerId=23772
[WorkerProcessor] Worker claimed executionId=c6ec939a-6039-42ab-baa1-aa29aceb4c3d workerId=23772
```

### 7.3 Route Evaluation — PASS

```json
{
  "event": "agent_harness.route_evaluated",
  "executionId": "c6ec939a-6039-42ab-baa1-aa29aceb4c3d",
  "harnessVersion": "v1",
  "enableToolLoop": true,
  "selectedPath": "harness"
}
```

### 7.4 Config Resolution — PASS

```json
{
  "event": "agent_harness.config_resolved",
  "executionId": "c6ec939a-6039-42ab-baa1-aa29aceb4c3d",
  "source": "builder-profile",
  "builderProfileId": "builder-default",
  "harnessProfileId": null,
  "fieldsOverridden": [],
  "warnings": []
}
```

### 7.5 Harness Loop Started — PASS

```json
{
  "eventType": "harness.loop_started",
  "maxToolIterations": 3,
  "maxToolResultBytes": 262144,
  "toolTimeoutMs": 30000
}
```

### 7.6 Iteration 0 — list_files Dispatched — PASS

```json
{"eventType": "harness.model_invocation_completed", "iteration": 0, "finishReason": "tool_calls", "toolCallCount": 1, "tokensUsed": 0}
{"eventType": "harness.tool_dispatch_started", "callId": "test-harness-call-0", "toolName": "list_files"}
{"eventType": "harness.tool_dispatch_failed", "callId": "test-harness-call-0", "toolName": "list_files", "errorCode": "HANDLER_ERROR"}
```

Tool handler failed with HANDLER_ERROR — **expected and acceptable**: API Gateway not running, HTTP call to list workspace files fails with connection refused. Per design doc §7.8, this still proves the full code path activates.

### 7.7 Iteration 1 — read_file Dispatched — PASS

```json
{"eventType": "harness.model_invocation_completed", "iteration": 1, "finishReason": "tool_calls", "toolCallCount": 1, "tokensUsed": 0}
{"eventType": "harness.tool_dispatch_started", "callId": "test-harness-call-1", "toolName": "read_file"}
{"eventType": "harness.tool_dispatch_failed", "callId": "test-harness-call-1", "toolName": "read_file", "errorCode": "HANDLER_ERROR"}
```

Same expected behavior — API Gateway not running.

### 7.8 Iteration 2 — Completed — PASS

```json
{"eventType": "harness.model_invocation_completed", "iteration": 2, "finishReason": "completed", "toolCallCount": 0, "tokensUsed": 0}
```

### 7.9 Harness Loop Completed — PASS

```json
{
  "eventType": "harness.loop_completed",
  "iteration": 3,
  "totalToolCalls": 2,
  "cumulativeTokensUsed": 0,
  "terminationReason": "completed",
  "durationMs": 33
}
```

### 7.10 Execution Completed — PASS

```
[WorkerProcessor] AI execution completed executionId=c6ec939a-6039-42ab-baa1-aa29aceb4c3d tokens=0
```

```json
{
  "event": "execution_completed",
  "executionId": "c6ec939a-6039-42ab-baa1-aa29aceb4c3d",
  "provider": "test-harness-stub",
  "workerId": 23772,
  "duration_ms": 60,
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

### 7.11 Ledger Finalized — PASS

```
[WorkerProcessor] Ledger finalized executionId=c6ec939a-6039-42ab-baa1-aa29aceb4c3d
QueueEvent: job completed executionId=c6ec939a-6039-42ab-baa1-aa29aceb4c3d jobId=326
```

### 7.12 Database Ledger Row (Post-Run)

```
 execution_id                         | execution_status | provider          | adapter           | model             | tokens_used
--------------------------------------+------------------+-------------------+-------------------+-------------------+-------------
 c6ec939a-6039-42ab-baa1-aa29aceb4c3d | completed        | test-harness-stub | test-harness-stub | test-harness-stub |           0
```

Canary row cleaned up after verification (DELETE 1).

---

## 8. PASS / FAIL / BLOCKED Result

### **Result: PASS**

All 15 PASS criteria from the design doc (§7.7) are satisfied:

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `agent_harness.route_evaluated` with `selectedPath: 'harness'` | **PASS** |
| 2 | `agent_harness.config_resolved` with valid `source` | **PASS** (`source: 'builder-profile'`) |
| 3 | `adapter.supportsToolUse && adapter.executeWithTools` gate evaluates `true` | **PASS** (harness path taken) |
| 4 | `ToolDispatcher` created; `read_file` + `list_files` registered | **PASS** (both dispatched) |
| 5 | `executeAgentHarnessLoop` called (not plain `execute`) | **PASS** (`harness.loop_started` emitted) |
| 6 | Harness loop calls `executeFn` at least once | **PASS** (called 3 times: iterations 0, 1, 2) |
| 7 | Adapter returns tool calls; dispatcher dispatches them | **PASS** (list_files + read_file dispatched) |
| 8 | `harness.loop_started` audit event | **PASS** |
| 9 | `harness.tool_dispatch_started` / `harness.tool_dispatch_failed` events | **PASS** (2 pairs) |
| 10 | `harness.loop_completed` event | **PASS** (`terminationReason: 'completed'`, `durationMs: 33`) |
| 11 | No `write_file`, `delete_file`, `run_validation`, `browser_smoke` dispatched | **PASS** (only `list_files` + `read_file`) |
| 12 | No external API calls | **PASS** (provider: test-harness-stub, tokens: 0) |
| 13 | No `.env` files modified | **PASS** (pre/post scan clean) |
| 14 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` not in any `.env` after run | **PASS** (post-scan empty) |
| 15 | Job completes without hanging or crashing | **PASS** (60ms total, status: completed) |

---

## 9. Tool Calls Observed

| Iteration | Tool Called | Dispatch Result | Expected? |
|-----------|------------|----------------|-----------|
| 0 | `list_files` | `HANDLER_ERROR` (API Gateway not running) | Yes |
| 1 | `read_file` | `HANDLER_ERROR` (API Gateway not running) | Yes |
| 2 | (none — `finishReason: 'completed'`) | Loop terminated | Yes |

**Total tool calls:** 2 (list_files + read_file)
**Blocked tools not called:** write_file, delete_file, run_validation, browser_smoke — confirmed NOT registered and NOT dispatched.

---

## 10. Read-Only Boundary Result

**PASS** — Only `list_files` and `read_file` were dispatched. No `write_file`, `delete_file`, `run_validation`, or `browser_smoke` tool calls were observed. The harness config correctly resolved `enableWriteTools: false`, `enableValidationTools: false`, `enableBrowserSmoke: false` (hardcoded), so write/delete/validation/browser handlers were never registered in the ToolDispatcher.

---

## 11. External Provider/Billing Result

**PASS — Zero external API calls. Zero billing.**

- Provider: `test-harness-stub` (deterministic test adapter)
- Tokens used: `0` (all 3 iterations)
- No Anthropic, OpenAI, Groq, xAI, or DeepSeek API calls
- No API keys needed or used for the test adapter
- Ledger row: `tokens_used = 0`

---

## 12. Env/Source/Governance Diff Result

### `.env` files — PASS (no changes)

Post-run `Select-String` scan for harness flags in `.env*` files returned empty — no harness flags leaked to persistent env.

### `git diff --name-only` — PASS (no unexpected changes)

Tracked file changes are exclusively from the prior 06D1 implementation slice (already committed/staged before this canary):

```
TASKS.md
TASKS_BACKLOG_FULL.md
docs/AINOW-EXECUTION-ROADMAP.md
services/ai-service/src/ai-execution/adapters/index.ts
services/ai-service/src/ai-execution/ai-execution.service.ts
services/ai-service/src/ai-execution/types.ts
services/ai-service/src/queue/job.types.ts
```

New untracked files from this canary step:

```
services/ai-service/scripts/canary-06d-submit-job.ts (new — canary script)
docs/AGENT-HARNESS-06D-LIVE-CANARY-EXECUTION.md (new — this document)
```

No production source files were modified during this canary execution.

---

## 13. Ready for 06D Step 4 Consolidation

**YES** — AGENT-HARNESS-06D is ready for Step 4 consolidation.

All acceptance criteria for the live Worker/BullMQ read-only canary have been met:

- [x] Live BullMQ job submitted with `harnessVersion: 'v1'`
- [x] Live `agent_harness.route_evaluated` with `selectedPath: 'harness'`
- [x] Live `agent_harness.config_resolved` with `source: 'builder-profile'`
- [x] `adapter.supportsToolUse && adapter.executeWithTools` gate activated at runtime
- [x] `ToolDispatcher` created with `read_file` + `list_files` registered
- [x] `executeAgentHarnessLoop` called (not plain `execute`)
- [x] Harness loop ran 3 iterations (2 tool calls, 1 completion)
- [x] Audit events emitted for full lifecycle
- [x] No write/delete/validation/browser tools registered or dispatched
- [x] Zero external API calls, zero billing, zero tokens
- [x] No `.env` files modified
- [x] No production activation
- [x] Job completed in 60ms, status: completed

---

## 14. Files Created/Changed During This Step

| # | File | Change |
|---|------|--------|
| 1 | `services/ai-service/scripts/canary-06d-submit-job.ts` | **CREATED** — canary job submission script |
| 2 | `docs/AGENT-HARNESS-06D-LIVE-CANARY-EXECUTION.md` | **CREATED** — this execution document |

No other files created or modified.

---

## 15. Confirmations

- [x] AGENT-HARNESS-06D Step 3 — Live Worker/BullMQ Read-Only Canary — **PASS**
- [x] Provider: `test-harness-stub` (zero billing, zero external calls)
- [x] `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` was process-scoped only — NOT in any `.env` file
- [x] Write tools: disabled (`enableWriteTools: false`)
- [x] Validation tools: disabled (`enableValidationTools: false`)
- [x] Browser smoke: disabled (`enableBrowserSmoke: false`, hardcoded)
- [x] No Anthropic/OpenAI/Groq/xAI/DeepSeek API calls
- [x] No `.env` file modifications
- [x] No production runtime code changed
- [x] No frontend, api-gateway, container-manager, database, or migration changes
- [x] No git commits or pushes
- [x] Canary database row cleaned up after verification
- [x] Worker process stopped after canary
- [x] Ready for Step 4 consolidation
