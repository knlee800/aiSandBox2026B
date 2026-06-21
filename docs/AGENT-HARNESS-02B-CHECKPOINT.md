# AGENT-HARNESS-02B Checkpoint — Worker Multi-Turn Tool Loop

**Task ID:** AGENT-HARNESS-02B
**Title:** Worker Multi-Turn Tool Loop
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-21

---

## Problem

AGENT-HARNESS-02A added inert adapter-level tool-use metadata support (executeWithTools() on Anthropic, OpenAI, and Stub adapters). The next step was to prepare the WorkerProcessor for a bounded multi-turn tool loop so future Agent Harness slices can request tools, receive tool results, and continue model execution. This was high risk because WorkerProcessor controls live AI execution, status events, persistence, error handling, and user-visible behavior.

## Objective

Implement a bounded, double-gated Worker multi-turn tool loop foundation that:
- Is disabled by default (`enableToolLoop: false`).
- Is activated only when both `job.data.harnessVersion === 'v1'` AND `enableToolLoop === true`.
- Preserves existing single-shot execution behavior for all current jobs.
- Treats adapter tool calls as metadata only (no dispatcher, no execution).
- Enforces `maxToolIterations` as a hard ceiling.

---

## Architecture / Security Review Summary

A full architecture and security review was performed before implementation, covering:

- **WorkerProcessor execution flow:** single-shot, owns ledger updates, retry, timeout/cancel, SSE publishing, metrics.
- **AIExecutionService:** owns adapter selection and `execute()`. `getAdapter()` was `private`; needed to be non-private for the WorkerProcessor harness branch to reuse it without duplicating adapter construction logic.
- **Adapter contracts:** `executeWithTools()` is optional and implemented inertly in Anthropic, OpenAI, and Stub adapters (02A).
- **Agent Harness config:** `enableToolLoop: false` by default; `maxToolIterations: 3` by default.
- **Tool registry:** all tools `enabled: false`, `implementationStatus: 'contract-only'` or `'planned'` — no real tool implementations.
- **SSE publisher:** three event types (`token`, `file_actions`, `complete`); all published at end of execution. No mid-loop SSE events added in this slice.
- **Checkpoint/revert:** frontend-owned; ai-service does not touch it. WorkerProcessor only publishes file-actions via SSE.

**Review conclusion:** proceed with one bounded implementation prompt using an isolated pure helper function. WorkerProcessor diff kept to ~20 lines.

---

## Implementation Summary

Added a bounded multi-turn loop helper (`executeAgentHarnessLoop`) as a pure function in a new orchestrator module. Added a double-gated branch in WorkerProcessor (~20 lines) that routes to the loop helper only when both harness conditions are met. All other paths continue exactly as before.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | New — bounded multi-turn loop helper (`executeAgentHarnessLoop`) and exported types |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | New — 12 focused loop tests |
| `services/ai-service/src/agent-harness/index.ts` | Updated — added barrel export for orchestrator module |
| `services/ai-service/src/queue/job.types.ts` | Updated — added optional `harnessVersion?: string` to `AiExecutionJob` |
| `services/ai-service/src/worker/worker.processor.ts` | Updated — added 2 imports and ~20-line double-gated harness branch |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Updated — added 5 new tests; all 22 existing prompt-building tests preserved |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Updated — one-word visibility change: `getAdapter()` from `private` to public (non-private) |

---

## AIExecutionService getAdapter() Visibility Change

`AIExecutionService.getAdapter()` was changed from `private` to public (one word removed). This was a bounded, minimal change:

- **No AIExecutionService runtime execution behavior was changed.**
- **No tool execution was added to AIExecutionService.**
- The change allows WorkerProcessor's double-gated harness branch to reuse the existing adapter construction logic directly, without duplicating the adapter factory or the API key resolution logic.
- The method remains internal to the ai-service module boundary. No public HTTP endpoint or inter-service API exposes it.

---

## Loop Helper Behavior

`executeAgentHarnessLoop()` exported from `agent-harness/orchestrator/agent-harness-loop.ts`:

### Inputs
- `executeFn: AgentHarnessExecuteWithToolsFn` — wraps `adapter.executeWithTools()`, making the loop adapter-agnostic.
- `request: AIExecutionRequest` — standard execution request passed to the adapter.
- `config: Pick<AgentHarnessConfigV1, 'maxToolIterations'>` — only the iteration ceiling is needed from config.
- `signal?: AbortSignal` — cancellation support.

### Outputs
`AgentHarnessLoopResult`:
- `result: AIExecutionResult` — compatible with the existing WorkerProcessor result-handling flow.
- `iterationsUsed: number` — iteration counter for auditing.
- `terminationReason: 'completed' | 'no_dispatcher' | 'max_iterations' | 'aborted'`.
- `toolCallsReceived: number` — total tool calls seen across all iterations.

### Termination paths
| Condition | Termination Reason | Output |
|-----------|-------------------|--------|
| AbortSignal aborted before loop starts | `aborted` | Empty result |
| Adapter `finishReason` ≠ `tool_calls` or `toolCalls` empty | `completed` | Adapter's output, tokensUsed, model, fileActions |
| Adapter returns tool calls, no dispatcher | `no_dispatcher` | Adapter output + safe fallback message appended |
| `maxToolIterations` reached without completing | `max_iterations` | Safe fallback output |

### Safety invariants
- `maxToolIterations` clamped to `Math.max(1, config.maxToolIterations)`.
- No filesystem, shell, validation, browser, or network tool executes.
- No tool results are generated (no dispatcher exists in this slice).
- AbortSignal is checked at the start of each iteration.
- `executeFn` errors propagate upward to WorkerProcessor's existing retry/error handling.
- All tool calls are treated as metadata only.

---

## WorkerProcessor Branch Behavior

Inside the existing retry loop, after `buildAIExecutionRequest()` and before the `execute()` call:

```typescript
if (
  job.data.harnessVersion === 'v1' &&
  DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop
) {
  const adapter = this.aiExecutionService.getAdapter(executionRequest.provider);
  if (adapter.supportsToolUse && adapter.executeWithTools) {
    const loopResult = await executeAgentHarnessLoop({ ... });
    aiResult = loopResult.result;
  } else {
    aiResult = await this.aiExecutionService.execute(executionRequest);
  }
} else {
  aiResult = await this.aiExecutionService.execute(executionRequest);
}
```

**Gate 1:** `job.data.harnessVersion === 'v1'` — absent for all current jobs.
**Gate 2:** `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` — defaults to `false`.

Since both gates must be true for the harness path to activate, and `enableToolLoop` defaults to `false`, no existing jobs enter the harness path. The existing single-shot `this.aiExecutionService.execute()` call is the effective path for all current executions.

Existing behavior after the result is obtained is completely unchanged:
- `publishToken` → `publishFileActions` → `publishCompletion` order preserved.
- Ledger updates (`usage_records`) unchanged.
- Cancellation, timeout, and retry wrapping unchanged.
- File-action parsing (via `extractFileActionsFromOutput` inside `AIExecutionService.execute()`) preserved for the legacy path; the harness loop path returns `fileActions` from the adapter's tool-use result directly.

---

## Queue Type Change

`AiExecutionJob` in `services/ai-service/src/queue/job.types.ts`:

```typescript
/** Agent Harness version gate. When set to 'v1', enables the harness execution path. */
harnessVersion?: string;
```

Non-breaking: optional field. No existing producer sets it. No existing consumer reads it except the new double-gated branch.

---

## Tests Added / Updated

### New: `agent-harness-loop.spec.ts` — 12 tests

| # | Test |
|---|------|
| 1 | Returns completed result when adapter returns no tool calls |
| 2 | Returns completed result when finishReason is 'stop' |
| 3 | Returns no_dispatcher fallback when adapter returns tool calls |
| 4 | Includes fallback message even when adapter output is empty |
| 5 | Enforces maxToolIterations as loop ceiling |
| 6 | Clamps maxToolIterations to at least 1 when config is 0 |
| 7 | Returns aborted result when signal is already aborted before loop starts |
| 8 | Returns AIExecutionResult-compatible shape with all required fields |
| 9 | Does not call any tool dispatcher or execution function |
| 10 | Treats tool calls as metadata only — no side effects |
| 11 | Preserves fileActions from adapter result |
| 12 | Propagates executeFn errors without catching them |

### Updated: `worker.processor.spec.ts` — 5 new tests

| # | Test |
|---|------|
| 1 | `enableToolLoop` defaults to false in DEFAULT_AGENT_HARNESS_CONFIG_V1 |
| 2 | `maxToolIterations` defaults to a small positive number |
| 3 | WorkerProcessor does not hardcode tool definitions from the registry |
| 4 | WorkerProcessor does not import filesystem/write/delete/validation/browser tool modules |
| (all 22) | Existing prompt-building tests remain passing |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- src/agent-harness/orchestrator/agent-harness-loop.spec.ts src/worker/worker.processor.spec.ts` | **PASS** — 2 suites, 34 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS** — tsc clean |
| ReadLints on all 7 touched files | **PASS** — no linter errors |

---

## Invariants Confirmed

- **Existing single-shot execution path fully preserved.** When `harnessVersion` is absent or `enableToolLoop` is `false`, WorkerProcessor calls `this.aiExecutionService.execute()` exactly as before.
- **Loop is double-gated.** Both `harnessVersion === 'v1'` AND `enableToolLoop === true` must be present.
- **`enableToolLoop` defaults to `false`.** Current executions are unaffected.
- **No runtime tool execution was implemented.** Tool calls are metadata only.
- **No tool dispatcher was implemented.** `no_dispatcher` fallback is the only response to tool call metadata.
- **No filesystem/write/delete/validation/browser execution was implemented.** Tests verify no such tool modules are imported in WorkerProcessor.
- **No AIExecutionService runtime tool execution was implemented.** Only the `getAdapter()` visibility was broadened (one word removed).
- **No frontend/UI files were changed.**
- **No database schema changes.**
- **No queue architecture changes.** One optional field added to job shape.
- **No package/dependency changes.**
- **No checkpoint was created before this consolidation step.** The implementation step did not create a checkpoint, per governance rules.

---

## Risks and Mitigations (from Architecture/Security Review)

| Risk | Severity | Mitigation |
|------|----------|------------|
| WorkerProcessor is a monolithic ~1000-line file; any edit risks regression | High | WorkerProcessor diff kept to ~20 lines (one guarded branch). All loop logic isolated in new file. |
| `executeWithTools()` could fail with unexpected provider errors inside the loop | Medium | Loop helper propagates errors upward to WorkerProcessor's existing retry/timeout/cancel handling. |
| `AiExecutionJob` shape change could break API Gateway job enqueue | Low | Field is optional. No existing producer sets it. Non-breaking. |
| Loop helper could accidentally call a real provider API multiple times | Medium | No dispatcher exists; loop returns after first call in all current termination paths. Tests prove single-call invariant. |
| File-action parsing skipped for harness path | Medium | Harness path returns `fileActions` directly from adapter's `AIAdapterToolUseResult` (which extends `AIExecutionResult`). Legacy path unchanged. |

---

## Dependency Chain

| Predecessor | Status |
|-------------|--------|
| AGENT-HARNESS-00 | COMPLETE and LOCKED |
| AGENT-HARNESS-01A | COMPLETE and LOCKED |
| AGENT-HARNESS-01B | COMPLETE and LOCKED |
| AGENT-HARNESS-01C | COMPLETE and LOCKED |
| AGENT-HARNESS-01D | COMPLETE and LOCKED |
| AGENT-HARNESS-01E | COMPLETE and LOCKED |
| AGENT-HARNESS-02A | COMPLETE and LOCKED |
| **AGENT-HARNESS-02B** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

Per the master plan (section `AGENT-HARNESS-02B` → `AGENT-HARNESS-03A`):

**AGENT-HARNESS-03A — Read-File and List-Files Tools**

Implement the first concrete tool handlers (`read_file` and `list_files`). These are read-only tools that operate through container-manager's existing file CRUD pipeline. They are the safest first real tool implementations because they carry no write/delete risk.

Per master plan section 12.1, this slice should:
- Register both tools in the tool registry (currently `implementationStatus: 'contract-only'`).
- Implement tool handlers that read files from the container workspace via container-manager API.
- Enforce policy limits (max read bytes, path validation reusing `normalizeAndValidatePath()`).
- Add focused tests proving path traversal is rejected and file size limit is enforced.

**Before registering AGENT-HARNESS-03A**, review:
- The master plan section 12.1 and section 9.7 safety boundaries.
- The container-manager file CRUD API (how WorkerProcessor or the loop helper would call it).
- Whether a tool dispatcher foundation needs to be registered first (AGENT-HARNESS-02C) or whether 03A can introduce both the handler and the minimal dispatcher scaffold.

The master plan does not define an explicit AGENT-HARNESS-02C. Pause to review the master plan before registering the next slice.
