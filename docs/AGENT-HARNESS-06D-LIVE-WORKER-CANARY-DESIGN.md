# AGENT-HARNESS-06D — Live Worker/BullMQ Read-Only Canary — Execution-Path Design

**Task:** AGENT-HARNESS-06D — Live Worker/BullMQ Read-Only Canary Gap Closure
**Step:** 2 — Live Worker/BullMQ Readiness and Execution-Path Design
**Status:** COMPLETE (this document)
**Date:** 2026-07-08
**Nature:** Design/analysis only. No code changes. No runtime execution. No env changes.

---

## 1. Governance Readiness

| Requirement | Status | Evidence |
|-------------|--------|----------|
| AGENT-HARNESS-06D ACTIVE | **PASS** | `docs/AINOW-EXECUTION-ROADMAP.md` §3 row 11 and §4: "AGENT-HARNESS-06D — ACTIVE — Step 1 COMPLETE (Registration — 2026-07-08)" |
| AGENT-HARNESS-06C COMPLETE and LOCKED | **PASS** | `docs/AGENT-HARNESS-06C-CHECKPOINT.md` §1: "Status: COMPLETE and LOCKED — 2026-07-07" |
| AGENT-HARNESS-07 COMPLETE and LOCKED | **PASS** | `docs/AGENT-HARNESS-07-CHECKPOINT.md` §1: "Status: COMPLETE and LOCKED — 2026-07-07" |
| One-active-task rule satisfied | **PASS** | Only AGENT-HARNESS-06D is ACTIVE per `AINOW-EXECUTION-ROADMAP.md` §4 |
| Keith approval for 06D registration | **PASS** | Recorded 2026-07-08 per roadmap §3 row 11 |

**Governance readiness result: PASS**

---

## 2. 06C Gap Summary

### What 06C proved (Jest/mock-executor path)

- `executeAgentHarnessLoop` orchestrator logic — 57 tests PASS
- `ToolDispatcher` registration and dispatch isolation — 16 tests PASS
- `InMemoryHarnessAuditRecorder` event sequence — 5 tests PASS
- `createAgentHarnessConfigV1` env-flag gating — 23 tests PASS
- `resolveBuilderHarnessConfig` adapter resolution paths — 21 tests PASS
- All 231 agent-harness tests passed (13 suites, 0 failures)
- Read-only boundary enforcement (write/delete/validation/browser blocked)

### What 06C did NOT prove (live BullMQ gap)

| Gap | Why |
|-----|-----|
| Live BullMQ job submission with `harnessVersion: 'v1'` | Not attempted — Jest tests invoke `executeAgentHarnessLoop` directly |
| Live `agent_harness.route_evaluated` log from real worker process | Not observed — mock-only |
| Live `agent_harness.config_resolved` log from real worker process | Not observed — mock-only |
| Live `adapter.supportsToolUse && adapter.executeWithTools` gate activation | Not tested — `StubAIAdapter.supportsToolUse = false` |
| Live tool loop execution via BullMQ → Worker → Harness path | **BLOCKED** — stub adapter falls through to plain execution |
| End-to-end: API → BullMQ → Worker → Harness tool loop → AI provider → tool dispatch → result | Not tested |

### Root cause: `StubAIAdapter.supportsToolUse = false`

`services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` line 30:
```typescript
readonly supportsToolUse = false;
```

In `worker.processor.ts` line 789:
```typescript
if (adapter.supportsToolUse && adapter.executeWithTools) {
  // ... harness tool loop path
} else {
  aiResult = await this.aiExecutionService.execute(executionRequest);
}
```

With `supportsToolUse = false`, even when `useHarness = true` (harness gate passes), the worker falls through to the plain execution path. The harness tool loop, dispatcher, and audit recorder are never activated via a live BullMQ job with the stub provider.

---

## 3. Live Worker Path Analysis

### 3.1 WorkerProcessor Harness Gate (Exact)

**File:** `services/ai-service/src/worker/worker.processor.ts`
**Lines:** 754–756

```typescript
const useHarness =
  job.data.harnessVersion === 'v1' &&
  DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

**Two conditions must be true:**
1. `job.data.harnessVersion === 'v1'` — set on the BullMQ job payload
2. `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` — derived from `process.env.AGENT_HARNESS_ENABLE_TOOL_LOOP` at module load time

### 3.2 Tool-Use Adapter Gate (Exact)

**File:** `services/ai-service/src/worker/worker.processor.ts`
**Line:** 789

```typescript
if (adapter.supportsToolUse && adapter.executeWithTools) {
```

**Two conditions must be true:**
1. `adapter.supportsToolUse === true` — property on the adapter instance
2. `adapter.executeWithTools` exists — method on the adapter instance

### 3.3 BullMQ Job Fields Needed

From `services/ai-service/src/queue/job.types.ts` (`AiExecutionJob`):

| Field | Required for canary | Value |
|-------|---------------------|-------|
| `executionId` | Yes | UUID string |
| `userId` | Yes | Test user ID |
| `apiKeyId` | Yes | Test API key ID |
| `sessionId` | Yes | Controlled test session ID |
| `conversationId` | Yes | UUID string |
| `provider` | Yes | Must be a tool-capable provider: `'anthropic'` or `'openai'` |
| `adapter` | Yes | Same as provider |
| `prompt` | Yes | Read-only canary prompt |
| `harnessVersion` | **Critical** | Must be `'v1'` to activate harness gate |
| `model` | Optional | Cheapest model for the selected provider |
| `workspaceContext` | Optional | Can be empty/minimal |
| `submittedAt` | Yes | ISO timestamp |
| `agentRole` | Optional | `'builder'` (optional; fallback path handles absence) |
| `builderProfileId` | Optional | Not required; adapter uses `global-default-missing-profile` fallback |

### 3.4 Required Process-Scoped Env Flags

| Variable | Required Value | Effect |
|----------|---------------|--------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Activates the harness branch in WorkerProcessor |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | ABSENT or `false` | Keeps write/delete handlers unregistered |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | ABSENT or `false` | Keeps `run_validation` handler unregistered |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | N/A | Hardcoded `false` in config factory — cannot be overridden |
| `REDIS_URL` | Must be set | BullMQ/worker connection |
| `DATABASE_URL` | Must be set | TypeORM/PostgreSQL connection |
| Provider API key (e.g. `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) | Must be set | Adapter construction requires it |

**Critical safety:** `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` must be set ONLY as a process-scoped env var for the ai-service worker process. It must NOT be written to any `.env` file.

### 3.5 How Read-Only Tools Are Registered

Inside the `if (adapter.supportsToolUse && adapter.executeWithTools)` block (lines 790–847):

1. `ToolDispatcher` is created (line 790–793)
2. `read_file` handler is always registered (lines 794–800)
3. `list_files` handler is always registered (lines 802–807)
4. `write_file` and `delete_file` only registered if `resolvedConfig.enableWriteTools === true` (lines 809–825)
5. `run_validation` only registered if `resolvedConfig.enableValidationTools === true` (lines 826–837)
6. `browser_smoke` only registered if `resolvedConfig.enableBrowserSmoke === true` (lines 838–847)

With the proposed env settings (`enableWriteTools: false`, `enableValidationTools: false`, `enableBrowserSmoke: false`), only `read_file` and `list_files` will be registered. Write/delete/validation/browser handlers will NOT exist in the dispatcher.

### 3.6 Where Provider Adapter Must Support Tool Use

Only `AnthropicAdapter` and `OpenAIAdapter` have `supportsToolUse = true`:

| Adapter | `supportsToolUse` | `executeWithTools` method | Would activate tool loop |
|---------|-------------------|--------------------------|--------------------------|
| `StubAIAdapter` | `false` | exists (returns empty toolCalls) | **NO** — gate fails |
| `AnthropicAdapter` | `true` | exists (full implementation) | **YES** |
| `OpenAIAdapter` | `true` | exists (full implementation) | **YES** |
| `DeepSeekAdapter` | not declared | not declared | **NO** — property undefined = falsy |
| `GroqAdapter` | not declared | not declared | **NO** — property undefined = falsy |
| `XAIAdapter` | not declared | not declared | **NO** — property undefined = falsy |

---

## 4. Existing Safe Path Discovery

### 4.1 Does a tool-capable non-billing adapter already exist?

**NO.**

- `StubAIAdapter` has `supportsToolUse = false` — cannot activate tool loop
- `StubAIAdapter.executeWithTools()` exists but is never reached because `supportsToolUse = false` causes the gate at line 789 to fail
- `AnthropicAdapter` and `OpenAIAdapter` both have `supportsToolUse = true` but **both make real external API calls and incur billing**
- `DeepSeekAdapter`, `GroqAdapter`, `XAIAdapter` do not declare `supportsToolUse` — gate fails

**Conclusion:** No existing adapter can activate the harness tool loop without making external API calls.

### 4.2 Can an existing script/test submit a controlled BullMQ job?

**NO.**

- No `scripts/` directory exists in `services/ai-service/`
- No `canary`, `harness`, `test:harness`, or `test:queue` npm scripts exist in `package.json`
- The BullMQ job submission path is exclusively through the API Gateway's `QueueService.enqueueExecution()` method
- No standalone job-submission utility or test script exists

### 4.3 Would any existing provider path avoid external API/billing?

**NO.**

Every adapter with `supportsToolUse = true` (Anthropic, OpenAI) requires a valid API key and makes real HTTP calls to the provider's external API. There is no "mock mode", "dry-run mode", or "local-only mode" on these adapters.

### 4.4 Existing Safe Path Discovery Result

**NO SAFE EXISTING PATH EXISTS.**

A live BullMQ → Worker → Harness tool loop canary cannot be performed with the current codebase without:
- Either using a real billing provider (Anthropic/OpenAI), OR
- Creating a small test-only adapter that has `supportsToolUse = true` but does not make external API calls

---

## 5. Recommended Step 3 Path

### Selected: Option B — Create a small test-only tool-capable adapter/script first

**Rationale:**

| Option | Viability | Risk | Cost |
|--------|-----------|------|------|
| **A: Use existing tool-capable non-billing adapter** | **NOT VIABLE** — none exists | N/A | N/A |
| **B: Create a small test-only tool-capable adapter + job submission script** | **VIABLE** — smallest safe change to close the gap | Low — adapter is deterministic, returns fixed tool calls | Zero external API cost; ~50 lines of source change |
| **C: Blocked until new implementation slice** | Excessive — the needed change is small and bounded | N/A | N/A |

**Option B is recommended** because:
1. The change is minimal (~50 lines): a `TestToolCapableStubAdapter` with `supportsToolUse = true` that returns predetermined tool calls without any external API call
2. It closes the gap completely — enables the full live Worker → Harness → ToolDispatcher → read_file/list_files path
3. Zero billing risk — no external API calls
4. Deterministic — returns the same tool calls every time (e.g., one `list_files` call then one `read_file` call then `finishReason: 'completed'`)
5. The adapter can be gated behind a test-only flag or provider name (e.g., `provider: 'test-harness-stub'`) so it cannot be accidentally used in production

---

## 6. Safety Design

### 6.1 Environment Isolation

| Constraint | Enforcement |
|------------|-------------|
| Local dev only | Process started manually on Keith's local machine |
| Process-scoped env only | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` set via PowerShell `$env:` or inline; NOT written to `.env` files |
| No `.env` file modification | Verified pre/post with `Select-String` scan |
| Single controlled session | Hardcoded test `sessionId` in job payload |

### 6.2 Tool Registration Safety

| Tool | Registered? | Enforcement |
|------|-------------|-------------|
| `read_file` | YES | Always registered in harness branch |
| `list_files` | YES | Always registered in harness branch |
| `write_file` | **NO** | `enableWriteTools: false` (env absent) |
| `delete_file` | **NO** | `enableWriteTools: false` (env absent) |
| `run_validation` | **NO** | `enableValidationTools: false` (env absent) |
| `browser_smoke` | **NO** | `enableBrowserSmoke: false` (hardcoded) |

### 6.3 No Provider/API Billing

- Test adapter makes zero external HTTP calls
- No `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` needed for the test adapter
- Provider field will be a test-only value (e.g., `'test-harness-stub'`)
- Production adapters (Anthropic, OpenAI) will NOT be instantiated

### 6.4 Controlled Session/Workspace

- `sessionId` in job payload will be a fixed test value (e.g., `'canary-session-06d'`)
- The `read_file` and `list_files` handlers call `this.apiGatewayHttpClient` with the session ID
- For the canary to fully exercise tool handlers, the API Gateway must be running and the session must exist with workspace files
- Alternative: if API Gateway is not running, the tool dispatch will fail with a network error — this still exercises the harness path up to the tool handler HTTP call and proves the full code path activates

### 6.5 Stop Conditions

| # | Condition | Action |
|---|-----------|--------|
| 1 | Worker logs `agent_harness.route_evaluated` with `selectedPath: 'plain'` | FAIL — harness gate not activated; check env |
| 2 | Worker logs error about missing API key for Anthropic/OpenAI | FAIL — wrong provider used; must use test adapter |
| 3 | Job fails with unhandled exception | FAIL — check logs; abort canary |
| 4 | Tool loop executes `write_file` or `delete_file` | ABORT — safety boundary violated (should be impossible with config) |
| 5 | Any `.env` file modified | ABORT — safety boundary violated |
| 6 | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` found in any `.env` file post-run | ABORT — flag leaked to persistent env |
| 7 | External HTTP calls observed (to anthropic.com, openai.com, etc.) | ABORT — wrong adapter used |
| 8 | Job runs longer than 30 seconds | ABORT — test adapter should complete in <2 seconds |

### 6.6 Post-Run Verification Checks

1. `Select-String` scan: no harness flags in `.env` files
2. `git diff --name-only`: no unexpected source changes
3. Worker logs show `agent_harness.route_evaluated` → `selectedPath: 'harness'`
4. Worker logs show `agent_harness.config_resolved` → `source: 'global-default-missing-profile'`
5. Worker logs show audit events (`harness.loop_started`, `harness.tool_dispatch_started`, etc.)
6. No external API calls in network/logs

---

## 7. Exact Step 3 Execution Design

### 7.1 Services That Must Be Running

| Service | Purpose | Required? |
|---------|---------|-----------|
| Docker Desktop | Container runtime | YES |
| `aisandbox-postgres` (PostgreSQL) | Worker's `DataSource` requires DB connection | YES |
| `aisandbox-redis` (Redis) | BullMQ queue backend | YES |
| AI Service (worker mode) | Processes BullMQ jobs | YES — started with process-scoped env |
| API Gateway | Tool handlers call API Gateway HTTP endpoints | OPTIONAL — see §7.8 for fallback |

### 7.2 Exact Process-Scoped Env Values

For the ai-service worker process:

```powershell
$env:AGENT_HARNESS_ENABLE_TOOL_LOOP = "true"
$env:AGENT_HARNESS_ENABLE_WRITE_TOOLS = ""   # absent/empty → false
$env:AGENT_HARNESS_ENABLE_VALIDATION_TOOLS = ""  # absent/empty → false
```

All other env vars from existing `.env` file (REDIS_URL, DATABASE_URL, etc.) remain unchanged.

### 7.3 Exact Provider/Model/Adapter

| Field | Value |
|-------|-------|
| Provider | `'test-harness-stub'` (new test-only provider) |
| Adapter | `TestToolCapableStubAdapter` (new, ~50 lines) |
| `supportsToolUse` | `true` |
| `executeWithTools` behavior | Iteration 1: returns `finishReason: 'tool_calls'` with `[{ toolName: 'list_files', arguments: { path: '.' } }]`; Iteration 2: returns `finishReason: 'tool_calls'` with `[{ toolName: 'read_file', arguments: { path: 'README.md' } }]`; Iteration 3: returns `finishReason: 'completed'` with output summary |
| External API calls | ZERO |
| Billing | ZERO |
| Tokens used | 0 (test stub) |
| Model label | `'test-harness-stub'` |

### 7.4 Exact Job Payload Shape

```typescript
const job: AiExecutionJob = {
  executionId: 'canary-06d-' + Date.now(),
  userId: 'canary-user-06d',
  apiKeyId: 'canary-apikey-06d',
  sessionId: 'canary-session-06d',
  conversationId: 'canary-conv-06d',
  provider: 'test-harness-stub',
  adapter: 'test-harness-stub',
  prompt: 'Read-only canary: list the files in the workspace and read README.md. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands.',
  harnessVersion: 'v1',
  model: 'test-harness-stub',
  submittedAt: new Date().toISOString(),
};
```

### 7.5 Exact Prompt

```
Read-only canary: list the files in the workspace and read README.md. Do not write, delete, rename, install packages, edit env files, run browser smoke, or run validation commands.
```

(Note: The prompt is cosmetic for the test adapter — the adapter returns predetermined tool calls regardless of prompt content. The prompt is included for audit/logging consistency.)

### 7.6 Expected Tool Calls

| Iteration | Adapter returns | Dispatcher dispatches | Expected result |
|-----------|-----------------|----------------------|-----------------|
| 1 | `toolCalls: [{ toolName: 'list_files', arguments: { path: '.' } }]` | `list_files` handler → HTTP call to API Gateway | Directory listing or network error (if no API Gateway) |
| 2 | `toolCalls: [{ toolName: 'read_file', arguments: { path: 'README.md' } }]` | `read_file` handler → HTTP call to API Gateway | File content or network error |
| 3 | `finishReason: 'completed'`, `toolCalls: []` | None — loop terminates | Final result returned |

### 7.7 Expected PASS/FAIL/BLOCKED Criteria

**PASS criteria (all must be true):**

| # | Criterion |
|---|-----------|
| 1 | Worker log contains `agent_harness.route_evaluated` with `selectedPath: 'harness'` |
| 2 | Worker log contains `agent_harness.config_resolved` with valid `source` |
| 3 | `adapter.supportsToolUse && adapter.executeWithTools` gate evaluates to `true` |
| 4 | `ToolDispatcher` is created and `read_file` + `list_files` are registered |
| 5 | `executeAgentHarnessLoop` is called (not the plain `execute` path) |
| 6 | Harness loop calls `executeFn` (adapter.executeWithTools) at least once |
| 7 | Adapter returns tool calls and dispatcher dispatches them |
| 8 | `harness.loop_started` audit event emitted |
| 9 | `harness.tool_dispatch_started` and `harness.tool_dispatch_completed` events emitted |
| 10 | `harness.loop_completed` event emitted |
| 11 | No `write_file`, `delete_file`, `run_validation`, or `browser_smoke` dispatched |
| 12 | No external API calls (anthropic.com, openai.com, etc.) |
| 13 | No `.env` files modified |
| 14 | `AGENT_HARNESS_ENABLE_TOOL_LOOP` not present in any `.env` file after run |
| 15 | Job completes (does not hang or crash) |

**FAIL criteria (any one triggers FAIL):**

| # | Criterion |
|---|-----------|
| 1 | Worker uses plain execution path (`selectedPath: 'plain'`) |
| 2 | `adapter.supportsToolUse` is `false` at runtime |
| 3 | `executeAgentHarnessLoop` is never called |
| 4 | Job throws unhandled exception before reaching harness path |
| 5 | External API calls detected |
| 6 | `.env` file modified |
| 7 | Write/delete tools dispatched |

**BLOCKED criteria:**

| # | Criterion |
|---|-----------|
| 1 | Docker Desktop not running (Redis/Postgres unavailable) |
| 2 | Keith does not approve test adapter implementation |
| 3 | Redis connection fails |
| 4 | PostgreSQL connection fails |

### 7.8 API Gateway Fallback

If the API Gateway is NOT running during the canary:
- Tool handler HTTP calls (`read_file`, `list_files`) will fail with connection refused / network error
- The `ToolDispatcher` will catch the error and return a typed error result (not an exception)
- The harness loop will feed the error result back to the adapter as `toolResults`
- The adapter (test stub) will proceed to `finishReason: 'completed'` on its next iteration regardless

**This still proves the live BullMQ → Worker → Harness → Dispatcher code path activates correctly**, even without successful tool execution results. The tool handler error path is itself a valid verification that the full code path is exercised.

If Keith prefers successful tool execution (proving the full end-to-end including tool handler HTTP → container workspace), then the API Gateway must also be running with a valid test session that has workspace files.

---

## 8. Implementation Need

### 8.1 Can Step 3 proceed without source changes?

**NO.** Source changes are required.

The fundamental blocker is that no existing adapter has `supportsToolUse = true` without making external API calls. The `StubAIAdapter` has `supportsToolUse = false`, which prevents the harness tool loop from activating via a live BullMQ job.

### 8.2 Exact Proposed Files and Smallest Safe Change

| # | File | Change | Lines (est.) |
|---|------|--------|-------------|
| 1 | `services/ai-service/src/ai-execution/adapters/test-harness-stub-ai.adapter.ts` | **CREATE** — new test-only adapter with `supportsToolUse = true`, deterministic tool call responses, zero external calls | ~60 |
| 2 | `services/ai-service/src/ai-execution/ai-execution.service.ts` | **MODIFY** — add `case 'test-harness-stub':` to `getAdapter()` switch, returning new adapter instance | ~5 |
| 3 | `services/ai-service/src/queue/job.types.ts` | **MODIFY** — add `'test-harness-stub'` to provider/adapter union types | ~2 |
| 4 | `services/ai-service/src/ai-execution/adapters/__tests__/test-harness-stub-ai.adapter.spec.ts` | **CREATE** — unit tests for the new adapter | ~40 |
| 5 | `scripts/canary-06d-submit-job.ts` (or inline in Step 3 doc) | **CREATE** — small script to submit a single BullMQ job with the canary payload | ~30 |

**Total estimated change:** ~137 lines across 5 files (3 new, 2 modified).

### 8.3 New Implementation Slice Needed?

**YES — a small bounded implementation child slice is needed before Step 3 can execute.**

Recommended: Register **AGENT-HARNESS-06D-IMPL** (or incorporate as Step 3a within 06D) to:
1. Create the `TestToolCapableStubAdapter`
2. Wire it into `getAdapter()` and job type unions
3. Create the job submission script
4. Run tests to verify no regressions

This is a 2-step tiny implementation (implementation + validation) per CLAUDE.md task workflow rules. It can be done in the same task family (06D) as a sub-step or as a named child slice — Keith's decision.

---

## 9. Readiness Conclusion

### Verdict: **NEEDS IMPLEMENTATION SLICE**

The live BullMQ canary CANNOT proceed with the current codebase. A small implementation slice (~137 lines, 5 files) is required to create a test-only tool-capable adapter that:
- Has `supportsToolUse = true`
- Returns deterministic tool calls (list_files, read_file)
- Makes zero external API calls
- Incurs zero billing

### Remaining Keith Approvals Needed

| # | Approval Item | Status |
|---|---------------|--------|
| 1 | Approve creation of `TestToolCapableStubAdapter` (test-only, zero billing) | **PENDING** |
| 2 | Approve adding `'test-harness-stub'` provider to job type union | **PENDING** |
| 3 | Approve Step 3 execution window (after implementation) | **PENDING** |
| 4 | Approve process-scoped `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` for canary run | **PENDING** |
| 5 | Docker/Redis/Postgres may be started | **PENDING** |
| 6 | Whether API Gateway must also be running (full end-to-end) or network-error fallback is acceptable | **PENDING** |
| 7 | Provider for canary: `test-harness-stub` (recommended) | **PENDING** |
| 8 | Whether job submission uses standalone script or inline manual Redis command | **PENDING** |

---

## 10. Risks and Blockers

| # | Risk/Blocker | Severity | Mitigation |
|---|-------------|----------|------------|
| 1 | `TestToolCapableStubAdapter` accidentally used in production | Low | Provider name `'test-harness-stub'` is unusual; can add env guard to prevent instantiation when `NODE_ENV=production` |
| 2 | `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` leaked to `.env` file | Medium | Process-scoped only; pre/post scan verification; stop condition #6 |
| 3 | Docker Desktop not running at Step 3 time | Blocking | Keith must start Docker before Step 3 |
| 4 | Redis/Postgres unhealthy | Blocking | Verified via `docker compose ps` before canary |
| 5 | Worker process crashes on startup (missing deps, bad config) | Low | Verified by successful `npm run dev` or `npm start` in prior validation |
| 6 | Test adapter returns unexpected tool calls (write/delete) | Very Low | Adapter is deterministic — returns only list_files and read_file; verified by unit tests |
| 7 | API Gateway not running and Keith requires full end-to-end success | Low | Tool dispatch errors still prove the code path activates; Keith can choose whether full success is required |

---

## 11. Files Inspected (Read-Only)

| File | Purpose |
|------|---------|
| `TASKS.md` | Governance status |
| `TASKS_BACKLOG_FULL.md` | Governance cross-reference |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Active task and sequence verification |
| `docs/AGENT-HARNESS-06C-CHECKPOINT.md` | 06C completion verification and gap documentation |
| `docs/AGENT-HARNESS-06C-CANARY-EXECUTION.md` | 06C canary path selection and limitation documentation |
| `docs/AGENT-HARNESS-06C-PREFLIGHT.md` | 06C preflight state |
| `docs/AGENT-HARNESS-07-CHECKPOINT.md` | 07 locked status and invariants |
| `services/ai-service/src/worker/worker.processor.ts` | Harness gate, adapter gate, tool registration |
| `services/ai-service/src/queue/job.types.ts` | Job payload shape and provider union |
| `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` | Stub adapter — `supportsToolUse = false` confirmation |
| `services/ai-service/src/ai-execution/adapters/ai-adapter.interface.ts` | Adapter interface contract |
| `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | `supportsToolUse = true` confirmation |
| `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | `supportsToolUse = true` confirmation |
| `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts` | No `supportsToolUse` — not tool-capable |
| `services/ai-service/src/ai-execution/adapters/adapter-tool-use.contracts.ts` | Tool use request/result contracts |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | `getAdapter()` switch — provider routing |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Config factory and env flag parsing |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | V1 contract shapes |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Loop options, execution flow |
| `services/ai-service/src/queue/queue.service.ts` | AI-service side queue creation |
| `services/api-gateway/src/queue/queue.service.ts` | API-gateway side job enqueue |
| `services/ai-service/src/internal/queue.controller.ts` | Queue stats endpoint |
| `services/ai-service/src/worker/worker.module.ts` | Worker module wiring |
| `services/ai-service/package.json` | Dependencies and scripts |
| `docker-compose.yml` | Infrastructure services |

---

## 12. Confirmations

- [x] No source files were created or modified (except this design document)
- [x] No `.env` files were modified
- [x] No governance files (`TASKS.md`, `TASKS_BACKLOG_FULL.md`, `AINOW-EXECUTION-ROADMAP.md`) were modified
- [x] No tests, builds, or runtime commands were run
- [x] No Docker services were started or stopped
- [x] No Redis, PostgreSQL, or BullMQ commands were executed
- [x] No worker jobs were submitted
- [x] No provider/API calls were made
- [x] No browser smoke was performed
- [x] No `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` was set anywhere
- [x] No git commits or pushes were performed
- [x] No migrations were run

---

## 13. Summary

| # | Item | Result |
|---|------|--------|
| 1 | File created | `docs/AGENT-HARNESS-06D-LIVE-WORKER-CANARY-DESIGN.md` (this document) |
| 2 | Files inspected | 25 source/governance files (see §11) |
| 3 | Governance readiness | **PASS** — 06D ACTIVE, 06C LOCKED, 07 LOCKED, one-task rule satisfied |
| 4 | 06C gap summary | Jest/mock path only; `StubAIAdapter.supportsToolUse = false` prevented live tool loop |
| 5 | Existing safe path discovery | **NO SAFE PATH EXISTS** — no tool-capable non-billing adapter |
| 6 | Recommended Step 3 path | **Option B** — create `TestToolCapableStubAdapter` (~137 lines, 5 files) |
| 7 | Source changes needed? | **YES** — small bounded implementation slice required |
| 8 | Step 3 execution design | Detailed in §7 (services, env, adapter, payload, criteria) |
| 9 | Risks/blockers | Docker not running, Keith approvals pending, implementation slice needed |
| 10 | Source/governance/env files changed | **NONE** (only this design doc created) |
| 11 | Commands/tests/runtime/provider calls | **NONE** |
| 12 | Can Step 3 proceed without implementation? | **NO** — needs implementation slice first |

---

**AGENT-HARNESS-06D Step 2 — Live Worker/BullMQ Readiness and Execution-Path Design — COMPLETE. Verdict: NEEDS IMPLEMENTATION SLICE. Step 3 cannot proceed until TestToolCapableStubAdapter is created and Keith provides remaining approvals.**
