# AGENT-HARNESS-02A Checkpoint — Adapter Tool-Use Support

**Task ID:** AGENT-HARNESS-02A
**Title:** Adapter Tool-Use Support
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-21

---

## Problem

The 01x Agent Harness foundation series (AGENT-HARNESS-01A through 01E) created contracts, config, model profiles, tool registry contracts, and prompt template registry contracts. The next stage needed adapter-level tool-use support so model providers can express tool calls and tool results through a shared Agent Harness contract. This preparation was required before runtime tool execution could be enabled in a future slice.

## Objective

Add adapter-level tool-use support contracts and metadata mapping for Agent Harness v1. This slice prepares provider adapter request/response shapes for tool-use metadata only. It does not execute tools, start tool loops, or change WorkerProcessor runtime behavior. All new `executeWithTools()` paths remain dormant/inert until AGENT-HARNESS-02B wires them into the tool loop.

---

## Implementation Summary

Added shared adapter-level tool-use typed contracts and pure mapping helpers under `services/ai-service/src/ai-execution/adapters/`, and extended the Anthropic, OpenAI, and Stub adapters with an optional, inert `executeWithTools()` method.

### New contracts file (`adapter-tool-use.contracts.ts`)

Defines all shared types for tool-use metadata at the adapter boundary:
- `AIAdapterToolCallProviderKind` — discriminates Anthropic vs OpenAI tool-call origins
- `AIAdapterToolUseFinishReason` — typed finish-reason enum (`completed | tool_calls | max_tokens | stop | unknown`)
- `AIAdapterToolDeclaration` — shared adapter-level tool declaration (maps from Agent Harness tool registry)
- `AIAdapterToolCallMetadata` — typed metadata for a single parsed tool call (no execution)
- `AIAdapterToolResultPayload` — typed shape for a tool result to be fed back in a future multi-turn loop
- `AIAdapterToolUseRequestOptions` — optional request-side tool list and prior tool results
- `AIAdapterToolUseResult` — extends `AIExecutionResult` with `finishReason` and `toolCalls`

### New mapper file (`adapter-tool-use.mapper.ts`)

Pure, side-effect-free mapping utilities:
- `mapAgentHarnessToolDefinitionToAdapterToolDeclaration()` — single-definition mapping
- `mapAgentHarnessToolDefinitionsToAdapterToolDeclarations()` — batch mapping; safe on empty/missing input
- `mapAdapterToolDeclarationsToAnthropicTools()` — produces Anthropic `{name, description, input_schema}` shapes
- `mapAgentHarnessToolDefinitionsToAnthropicTools()` — convenience: definition → Anthropic shape in one step
- `mapAdapterToolDeclarationsToOpenAITools()` — produces OpenAI `{type:'function', function:{...}}` shapes
- `mapAgentHarnessToolDefinitionsToOpenAITools()` — convenience: definition → OpenAI shape in one step
- `tryParseToolArgumentsToObject()` — safe JSON/object argument coercion (returns `{}` on failure)

### AIAdapter interface (`ai-adapter.interface.ts`)

Extended with two new optional members:
- `supportsToolUse?: boolean` — capability flag; Anthropic/OpenAI set `true`, Stub sets `false`
- `executeWithTools?(request, options?)` — optional tool-use execution method; existing `execute()` is unchanged

### Anthropic adapter (`anthropic-ai.adapter.ts`)

- Added `supportsToolUse = true`
- Added `executeWithTools()`:
  - Maps Agent Harness tool definitions to Anthropic `tools` declaration format via mapper
  - Passes tool declarations to provider API request only when tools are present
  - Parses `tool_use` content blocks from provider response into typed `AIAdapterToolCallMetadata[]`
  - Returns `AIAdapterToolUseResult` with `finishReason`, `toolCalls`, `output`, `tokensUsed`, `model`
  - Reuses existing `handleError()` error path
  - No tool execution occurs

### OpenAI adapter (`openai-ai.adapter.ts`)

- Added `supportsToolUse = true`
- Added `executeWithTools()`:
  - Maps Agent Harness tool definitions to OpenAI `tools` declaration format via mapper
  - Sets `tool_choice: 'auto'` only when tools are provided
  - Parses `tool_calls` array (modern OpenAI format) and legacy `function_call` into typed `AIAdapterToolCallMetadata[]`
  - Returns `AIAdapterToolUseResult` with `finishReason`, `toolCalls`, `output`, `tokensUsed`, `model`
  - Reuses existing `handleError()` error path
  - No tool execution occurs

### Stub adapter (`stub-ai.adapter.ts`)

- Added `supportsToolUse = false`
- Added `executeWithTools()`:
  - Delegates to existing `execute()` for deterministic output
  - Returns `finishReason: 'completed'` and `toolCalls: []`
  - Completely inert; suitable for testing without provider API calls

### Adapters barrel (`index.ts`)

Added `export * from './adapter-tool-use.contracts'` and `export * from './adapter-tool-use.mapper'` so all new types and pure helpers are available from the adapters barrel.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/adapters/adapter-tool-use.contracts.ts` | New — all v1 adapter tool-use typed contracts |
| `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` | New — pure mapping utilities for Anthropic/OpenAI tool declarations and safe argument parsing |
| `services/ai-service/src/ai-execution/adapters/ai-adapter.interface.ts` | Updated — added `supportsToolUse?` and optional `executeWithTools()` |
| `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | Updated — added `supportsToolUse`, `executeWithTools()`, `transformToolUseResponse()`, `extractToolCalls()`, `mapFinishReason()` |
| `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | Updated — added `supportsToolUse`, `executeWithTools()`, `transformToolUseResponse()`, `extractToolCalls()`, `mapFinishReason()` |
| `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` | Updated — added `supportsToolUse = false` and deterministic inert `executeWithTools()` |
| `services/ai-service/src/ai-execution/adapters/index.ts` | Updated — added barrel exports for new contracts and mapper |

---

## Tests Added / Updated

| File | Change | Tests |
|------|--------|-------|
| `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts` | New | 5 focused mapping tests |
| `services/ai-service/src/ai-execution/adapters/__tests__/stub-ai.adapter.spec.ts` | New | 2 focused stub tool-use tests |
| `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` | Updated — added `executeWithTools()` suite | 3 new tests (all pre-existing tests preserved) |
| `services/ai-service/src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts` | Updated — added `executeWithTools()` suite | 4 new tests (all pre-existing tests preserved) |

### Mapper spec tests (`adapter-tool-use.mapper.spec.ts`)

| # | Test |
|---|------|
| 1 | Agent Harness tool definitions convert to adapter tool declarations |
| 2 | Converted declarations produce correct Anthropic and OpenAI provider declaration shapes |
| 3 | Disabled/planned metadata is preserved without implying execution enablement |
| 4 | Missing or empty tool definitions are handled safely (no throws, returns `[]`) |
| 5 | Tool argument JSON and object inputs are parsed safely (`{}` on failure) |

### Stub adapter spec tests (`stub-ai.adapter.spec.ts`)

| # | Test |
|---|------|
| 1 | `supportsToolUse` is `false` |
| 2 | `executeWithTools()` returns deterministic inert result (`finishReason: completed`, `toolCalls: []`) |

### Anthropic adapter `executeWithTools()` tests

| # | Test |
|---|------|
| 1 | Maps Agent Harness tool definitions to Anthropic tool declarations in API request |
| 2 | Parses `tool_use` blocks into typed `toolCalls` metadata without executing tools |
| 3 | Safely handles missing tool definitions (no `tools` key sent, `toolCalls: []`) |

### OpenAI adapter `executeWithTools()` tests

| # | Test |
|---|------|
| 1 | Maps Agent Harness tool definitions to OpenAI tool declarations in API request |
| 2 | Parses `tool_calls` array into typed `toolCalls` metadata without executing tools |
| 3 | Parses legacy `function_call` metadata into typed `toolCalls` |
| 4 | Safely handles missing tool definitions (no `tools` key sent, `toolCalls: []`) |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts src/ai-execution/adapters/__tests__/stub-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts` | **PASS** — 4 suites, 82 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS** — tsc clean |
| ReadLints on all touched adapter source and test files | **PASS** — no linter errors |

---

## Invariants Confirmed

- **Inert metadata mapping/parsing only.** `executeWithTools()` maps declarations and parses response metadata. No tool function is invoked.
- **No runtime tool execution was implemented.**
- **No tool dispatcher was implemented.**
- **No WorkerProcessor tool loop was implemented.**
- **No AIExecutionService runtime tool execution was implemented.**
- **Legacy `execute()` behavior is fully preserved and unchanged.**
- **No frontend/UI files were changed.**
- **No database schema changes.**
- **No queue architecture changes.**
- **No prompt assembly behavior changes.**
- **No provider streaming changes.**
- **No model routing changes.**
- **No dependency changes.**
- **No checkpoint was created before this consolidation step** — the implementation step did not create a checkpoint, per governance rules.

---

## Adapter Interface/Type Additions

| Symbol | Location | Description |
|--------|----------|-------------|
| `AIAdapterToolCallProviderKind` | `adapter-tool-use.contracts.ts` | `'anthropic-tool_use' \| 'openai-tool_calls' \| 'openai-function_call' \| 'stub'` |
| `AIAdapterToolUseFinishReason` | `adapter-tool-use.contracts.ts` | `'completed' \| 'tool_calls' \| 'max_tokens' \| 'stop' \| 'unknown'` |
| `AIAdapterToolDeclaration` | `adapter-tool-use.contracts.ts` | Shared adapter-level tool declaration with implementation-status metadata |
| `AIAdapterToolCallMetadata` | `adapter-tool-use.contracts.ts` | Typed parsed tool-call metadata (no execution) |
| `AIAdapterToolResultPayload` | `adapter-tool-use.contracts.ts` | Typed tool result shape for future multi-turn loop |
| `AIAdapterToolUseRequestOptions` | `adapter-tool-use.contracts.ts` | Optional tool list + prior tool results for `executeWithTools()` request |
| `AIAdapterToolUseResult` | `adapter-tool-use.contracts.ts` | Extends `AIExecutionResult` with `finishReason` and `toolCalls` |

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
| **AGENT-HARNESS-02A** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-02B — Worker Multi-Turn Tool Loop**

Per the master plan (section `AGENT-HARNESS-02B`), the next task after adapter tool-use support is implementing the multi-turn tool loop in WorkerProcessor for Agent Harness executions. This is the highest-risk implementation slice in the 02x series.

Registration of AGENT-HARNESS-02B is the next step. Implementation must not begin until AGENT-HARNESS-02B is formally registered as ACTIVE in `TASKS.md` and `TASKS_BACKLOG_FULL.md`. Review the master plan section for AGENT-HARNESS-02B carefully before registering, as it is marked as requiring architecture and security review.
