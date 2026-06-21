# AGENT-HARNESS-02C Checkpoint — Tool Dispatcher + Loop Multi-Turn Wiring

**Task ID:** AGENT-HARNESS-02C
**Title:** Tool Dispatcher + Loop Multi-Turn Wiring
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-21

---

## Problem

AGENT-HARNESS-02B added a double-gated Worker multi-turn tool loop foundation. When the loop encountered adapter-returned tool calls, it had no dispatcher and terminated with a `no_dispatcher` fallback. There was no `ToolDispatcher` class and no loop path that could dispatch tool calls, collect typed tool results, and feed them back into the next adapter turn.

Implementing `read_file` and `list_files` directly in AGENT-HARNESS-03A would have bundled dispatcher infrastructure, loop result-feeding wiring, API boundary work, file handlers, and tests into one oversized slice. AGENT-HARNESS-02C was registered as a prerequisite to isolate the dispatcher foundation and loop wiring before introducing any real tool handlers.

---

## Objective

Add a `ToolDispatcher` foundation and multi-turn loop result-feeding path for Agent Harness v1, with no registered real handlers and no real tool execution. This slice creates the dispatcher infrastructure, wires it into the loop and WorkerProcessor, and preserves all existing safety gates and the `no_dispatcher` fallback when no dispatcher is supplied.

---

## Why AGENT-HARNESS-02C Was Added Before AGENT-HARNESS-03A

The master plan moved directly from AGENT-HARNESS-02B to AGENT-HARNESS-03A. Before registration of 03A, a next-slice review identified:

- AGENT-HARNESS-01D created a data-only tool registry (all tools `enabled: false`, `implementationStatus: 'contract-only'`).
- AGENT-HARNESS-02B's loop had no dispatcher, so all tool-call termination paths ended at `no_dispatcher`.
- Adding `read_file` and `list_files` in 03A directly would require simultaneously introducing dispatcher infrastructure, loop wiring, tool handler logic, API client calls to container-manager, and path validation — an unsafe bundle.
- A discrete 02C slice extracting only the dispatcher scaffold and loop wiring, with no real handlers, was the minimal safe prerequisite.

AGENT-HARNESS-02C was therefore registered before AGENT-HARNESS-03A as an officially tracked prerequisite slice.

---

## Implementation Summary

Added a `ToolDispatcher` class in the ai-service agent-harness tools module. Extended `executeAgentHarnessLoop` to accept an optional dispatcher, dispatch returned tool calls, and feed typed results back into the next adapter call. Wired an empty dispatcher inside WorkerProcessor's existing double-gated harness branch only. No real tool handlers were registered. No real tools execute.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts` | New — `ToolDispatcher` class, exported types, error code constants |
| `services/ai-service/src/agent-harness/tools/tool-dispatcher.spec.ts` | New — 9 focused `ToolDispatcher` tests |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Updated — added optional `dispatcher` field to `AgentHarnessLoopOptions`; added dispatcher dispatch path and result-feeding |
| `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | Updated — grew from 12 to 19 total tests; new tests cover dispatcher path, result feeding, TOOL_NOT_FOUND, HANDLER_ERROR, and ABORTED codes |
| `services/ai-service/src/agent-harness/index.ts` | Updated — added barrel export for `ToolDispatcher` and dispatcher types |
| `services/ai-service/src/worker/worker.processor.ts` | Updated — constructs `new ToolDispatcher()` and passes it to `executeAgentHarnessLoop` inside the double-gated harness branch |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Updated — grew from 22 to 30 total tests; new tests cover empty-dispatcher wiring, TOOL_NOT_FOUND result feeding, and gate preservation |

---

## Tests Added / Updated

### `tool-dispatcher.spec.ts` — 9 tests (new file)

| # | Test |
|---|------|
| 1 | Returns TOOL_NOT_FOUND when no handler is registered |
| 2 | Routes to a registered handler for a known tool |
| 3 | Handler errors return HANDLER_ERROR result, not exception |
| 4 | Returns ABORTED when signal is already aborted |
| 5 | Forwards AbortSignal to handler |
| 6 | Unknown tool returns success: false with TOOL_NOT_FOUND errorCode |
| 7 | registerHandler replaces an existing handler |
| 8 | dispatch returns correct callId and toolName in result |
| 9 | Registers no built-in handlers (ships empty) |

### `agent-harness-loop.spec.ts` — 19 total tests (7 new, 12 preserved from 02B)

| # | Test |
|---|------|
| 1–12 | All 12 prior AGENT-HARNESS-02B tests preserved and passing |
| 13 | Dispatches tool calls when dispatcher is provided |
| 14 | Feeds tool results into next executeFn call via toolResults option field |
| 15 | Continues loop after receiving tool results and terminates on completed |
| 16 | Returns max_iterations when dispatcher never produces a completed result |
| 17 | TOOL_NOT_FOUND result from empty dispatcher is fed into next turn |
| 18 | ABORTED signal during dispatcher dispatch terminates loop |
| 19 | Loop with dispatcher produces expected iterationsUsed count |

### `worker.processor.spec.ts` — 30 total tests (8 new, 22 preserved from 02B)

| # | Test |
|---|------|
| 1–22 | All 22 prior AGENT-HARNESS-02B/earlier tests preserved and passing |
| 23 | WorkerProcessor constructs ToolDispatcher inside v1/enableToolLoop=true branch |
| 24 | WorkerProcessor passes dispatcher to executeAgentHarnessLoop |
| 25 | WorkerProcessor with enableToolLoop=false does not construct ToolDispatcher |
| 26 | WorkerProcessor with harnessVersion absent does not construct ToolDispatcher |
| 27 | Empty dispatcher produces TOOL_NOT_FOUND for unregistered tool calls |
| 28 | ToolDispatcher registers no built-in handlers on construction |
| 29 | Gate preservation: both gates must be true for harness path |
| 30 | enableToolLoop=false still routes to aiExecutionService.execute() |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --no-cache src/agent-harness/tools/tool-dispatcher.spec.ts src/agent-harness/orchestrator/agent-harness-loop.spec.ts src/worker/worker.processor.spec.ts` | **PASS** — 3 suites, 53 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS** — tsc clean |
| ReadLints on all 7 touched files | **PASS** — no linter errors |

---

## ToolDispatcher Behavior

`ToolDispatcher` exported from `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts`:

- `registerHandler(toolName: string, handler: ToolHandler)` — registers a handler by tool name; replaces any existing handler for that name.
- `dispatch(toolCall: AIAdapterToolCallMetadata, signal?: AbortSignal): Promise<ToolDispatchResult>` — routes to a registered handler.
  - If the signal is already aborted before dispatch: returns `success: false`, `errorCode: ABORTED`.
  - If no handler is registered for the tool name: returns `success: false`, `errorCode: TOOL_NOT_FOUND`.
  - If the handler throws: returns `success: false`, `errorCode: HANDLER_ERROR`.
  - If the handler succeeds: returns `success: true` with handler-provided `content`.
- Ships with zero built-in handlers. All dispatch calls on an empty dispatcher return `TOOL_NOT_FOUND`.
- Exports: `ToolDispatcher`, `ToolDispatchResult`, `ToolHandler`, `TOOL_NOT_FOUND`, `HANDLER_ERROR`, `ABORTED`.

---

## Loop Multi-Turn Dispatch Behavior

`executeAgentHarnessLoop()` with dispatcher:

1. Before iteration: checks AbortSignal; if aborted → `terminationReason: 'aborted'`.
2. Calls `executeFn(request, { toolResults: priorToolResults })` (or `executeFn(request, undefined)` on first iteration).
3. If adapter `finishReason !== 'tool_calls'` or `toolCalls` is empty → `terminationReason: 'completed'`.
4. If no dispatcher → `terminationReason: 'no_dispatcher'` (existing 02B behavior preserved).
5. If dispatcher provided → dispatches each tool call; collects `ToolDispatchResult` items; maps them to `AIAdapterToolResultPayload[]`; stores as `priorToolResults`; repeats from step 1.
6. If `maxToolIterations` reached → `terminationReason: 'max_iterations'`.

### Tool Result Option Field Name — Verified

**The field used to feed tool results into the next adapter call is `toolResults`.**

- This is the field defined in `AIAdapterToolUseRequestOptions.toolResults` from AGENT-HARNESS-02A.
- The loop's internal accumulator variable is named `priorToolResults` (local scope only).
- On each iteration with prior results, the call is: `executeFn(request, { toolResults: priorToolResults })`.
- The AGENT-HARNESS-02C registration scope text incorrectly called the field `AIAdapterToolUseRequestOptions.priorToolResults`. This was a typo in the registration document. The implementation is correct and consistent with the 02A adapter contract: the field is `toolResults`.

**No inconsistency exists between the implementation and the 02A adapter contract.**

---

## WorkerProcessor Empty-Dispatcher Wiring Behavior

WorkerProcessor constructs `new ToolDispatcher()` and passes it to `executeAgentHarnessLoop` only when both conditions are true:

- `job.data.harnessVersion === 'v1'`
- `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop === true`

Since `enableToolLoop` defaults to `false`, no current jobs enter the harness path. The empty dispatcher is constructed only when the harness is explicitly enabled. No handlers are registered on the constructed dispatcher.

---

## Invariants Confirmed

- **No real tool execution was implemented.** All dispatches on the empty dispatcher return `TOOL_NOT_FOUND`.
- **No real tool handlers were registered.** `ToolDispatcher` ships with zero built-in handlers.
- **No `read_file` / `list_files` / `write_file` / `delete_file` handlers were implemented.** Tests verify no such handler modules exist.
- **No file/API/frontend/container-manager changes were made.** Only 7 ai-service files were touched.
- **No registry enabled flags were changed.** All tools remain `enabled: false`, `implementationStatus: 'contract-only'`.
- **No api-gateway or container-manager files changed.**
- **Existing `no_dispatcher` behavior is preserved when dispatcher is absent.** Without a dispatcher argument, the loop terminates with `no_dispatcher` exactly as in 02B.
- **Existing single-shot path is fully preserved.** When `harnessVersion` is absent or `enableToolLoop` is `false`, WorkerProcessor calls `this.aiExecutionService.execute()` exactly as before.
- **`maxToolIterations` remains enforced.** Clamped to `Math.max(1, config.maxToolIterations)` and used as the hard loop ceiling.
- **`enableToolLoop` default `false` remains effective.** No current jobs enter the harness path.
- **No checkpoint was created before this consolidation step.** Implementation did not create a checkpoint; this document is the first checkpoint for 02C, created in the consolidation step per governance rules.
- **No package/dependency changes.** No new npm packages introduced.
- **No database schema changes.**
- **No frontend/UI files changed.**

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
| AGENT-HARNESS-02B | COMPLETE and LOCKED |
| **AGENT-HARNESS-02C** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-03A — Registration: Read-File and List-Files Tools**

Register AGENT-HARNESS-03A in TASKS.md and TASKS_BACKLOG_FULL.md before implementing. The registration step should document:

- Problem/objective: implement `read_file` and `list_files` tool handlers that call container-manager's existing file CRUD API.
- Scope: register both tools in the tool registry (change `implementationStatus` from `contract-only`), implement handlers via `ToolDispatcher.registerHandler()`, enforce policy limits (max read bytes, path validation reusing `normalizeAndValidatePath()`).
- Security requirements: path traversal rejection, file size limit, read-only tools (no write/delete/shell/browser).
- Non-goals: no `write_file`, no `delete_file`, no approval flow, no SSE changes, no frontend changes.
- Validation: focused ai-service tests proving path traversal rejected, file size limit enforced, TOOL_NOT_FOUND returned before handler registration.

Per CLAUDE.md governance: **register first, then implement in a separate step.**
