# AGENT-HARNESS-01A Checkpoint

**Task ID:** AGENT-HARNESS-01A
**Title:** Per-Request Model Selection Fix
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Depends on:** AGENT-HARNESS-00 COMPLETE and LOCKED
**Date completed:** 2026-06-19

---

## Problem Summary

Frontend and API Gateway accept a per-request model field and store it in the execution ledger/BullMQ job payload. However, the selected model was never actually applied at the ai-service adapter layer. `WorkerProcessor` did not include the job's `model` field when constructing the `AIExecutionRequest` passed to `AIExecutionService`, and every provider adapter used its own constructor default model regardless of what the request specified.

This meant user-selected model could appear accepted in the API response, but actual LLM provider calls always used the adapter's hard-wired default model.

---

## Implementation Summary

The fix followed a single clean contract path with no hardcoded model names:

1. **`WorkerProcessor`** — Extracted AI execution request construction into an exported pure function `buildAIExecutionRequest(jobData, promptParts, signal)`. The function explicitly includes `model: jobData.model` so the BullMQ job payload's model field is forwarded into the `AIExecutionRequest`.

2. **`AIExecutionService.execute()`** — Added `requestedModel` normalization (trim + undefined-if-blank). Replaced three locations where `adapter.model` was used in observability/debug log with `requestedModel ?? adapter.model`. Passed `model: requestedModel` into the spread object passed to `adapter.execute(...)`.

3. **All six provider adapters** — Each adapter's `execute()` method now derives `executionModel = request.model (trimmed) ?? this.model` and passes `executionModel` into the provider API call. `transformResponse()` signature updated to accept `fallbackModel` instead of closing over `this.model`. Adapter constructor defaults remain unchanged as fallback.

Provider adapters changed: `StubAIAdapter`, `OpenAIAdapter`, `AnthropicAdapter`, `GroqAdapter`, `XAIAdapter`, `DeepSeekAdapter`.

The `AIExecutionRequest` type already had `model?: string` — no type changes were required.

---

## Requested Model Flow (After Fix)

```
frontend/API request model field
  → API Gateway execution job (BullMQ payload model field)
    → WorkerProcessor: buildAIExecutionRequest(job.data, promptParts, signal)
        → AIExecutionService.execute(request) [request.model trimmed and forwarded]
            → adapter.execute({ ...request, model: requestedModel })
                → provider API call uses executionModel (request.model ?? this.model)
```

When no model is requested: `executionModel` falls back to `this.model` (constructor default), behavior unchanged.

---

## Exact Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/worker/worker.processor.ts` | Exported `buildAIExecutionRequest()`; uses it in worker job handler to include `model` from job payload |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Added `requestedModel` normalization; passes `model: requestedModel` to adapter; updated observability logs |
| `services/ai-service/src/ai-execution/adapters/stub-ai.adapter.ts` | Uses `request.model ?? this.model` as `executionModel` |
| `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | Uses `request.model ?? this.model`; updated `transformResponse(fallbackModel)` |
| `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | Uses `request.model ?? this.model`; updated `transformResponse(fallbackModel)` |
| `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts` | Uses `request.model ?? this.model`; updated `transformResponse(fallbackModel)` |
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | Uses `request.model ?? this.model`; updated `transformResponse(fallbackModel)` |
| `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts` | Uses `request.model ?? this.model`; updated `transformResponse(fallbackModel)` |

---

## Exact Tests Added/Updated

| File | Tests added/changed |
|------|---------------------|
| `services/ai-service/src/worker/worker.processor.spec.ts` | Added `describe('buildAIExecutionRequest')` with 2 tests: (1) passes `model` from job payload; (2) leaves `model` undefined when absent |
| `services/ai-service/src/ai-execution/__tests__/ai-execution-phase16.spec.ts` | Added: service forwards requested model to adapter; service trims requested model before forwarding; file-action extraction behavior preserved. Updated: brittle `toBe(adapterResult)` identity test corrected to match actual normalized service output (provider + fileActions fields) |
| `services/ai-service/src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts` | Added: uses requested model in provider call; requested model used as fallback when response model is undefined |
| `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` | Added: uses requested model in provider call; requested model used as fallback when response model is empty |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- src/worker/worker.processor.spec.ts src/ai-execution/__tests__/ai-execution-phase16.spec.ts src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/groq-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/xai-ai.adapter.spec.ts src/ai-execution/adapters/__tests__/deepseek-ai.adapter.spec.ts` | PASS — 7 suites, 207 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | PASS — tsc clean |
| ReadLints on all touched ai-service files | PASS — no linter errors |

---

## Invariants Confirmed

- **Requested model flows correctly:** `frontend/API model → BullMQ job model → WorkerProcessor → AIExecutionService → provider adapter → provider call`. Verified by test.
- **Provider default fallback unchanged:** When `request.model` is absent or blank, all adapters fall back to `this.model` (constructor default). Verified by existing and new tests.
- **Prompt assembly ordering unchanged:** `buildExecutionPromptParts` was not modified. All prompt assembly tests pass.
- **File-action extraction unchanged:** `extractFileActionsFromOutput` was not modified. File-action parsing tests pass.
- **Queue/SSE/status behavior unchanged:** `WorkerProcessor` job lifecycle, ledger updates, SSE publish paths not modified.
- **No frontend/UI files changed:** Confirmed. `git diff --name-only -- frontend` returned empty.
- **No database schema changes:** No migration or entity files touched.
- **No queue architecture rewrite:** BullMQ configuration, job shape, and queue names unchanged.
- **No tool protocol implemented:** No tool registry, tool interface, or tool dispatch code added.
- **No model profile registry implemented:** No registry, lookup table, or model validation added in this slice.
- **No tool registry or prompt template registry implemented.**
- **No dependency changes:** No `package.json` files modified.
- **No checkpoint was created before this consolidation step:** Confirmed. `AGENT-HARNESS-01A-CHECKPOINT.md` is the first checkpoint for this task, created during consolidation only.

---

## Non-goals (confirmed not done)

- No tool protocol implementation
- No tool registry
- No model profile registry
- No prompt template registry
- No streaming changes
- No function-calling/tool-use changes
- No repo indexing/search changes
- No patch/apply engine changes
- No validation runner
- No browser smoke tool
- No UI changes
- No database schema changes
- No queue architecture rewrite
- No provider migration
- No dependency changes
- No broad refactor
- No changes to Global Instructions, Project Instructions, Repo Docs, or workspace context ordering

---

## Next Recommended Task

**AGENT-HARNESS-01B — Agent Harness v1 Contracts + Config Shape**

Register the next bounded slice to define the formal tool protocol interface contracts and config shape that the Agent Harness v1 will use, without implementing tool execution. This creates the typed foundation that later slices (repo indexing, patch engine, validation runner) will depend on.
