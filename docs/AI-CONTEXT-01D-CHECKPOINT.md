# AI-CONTEXT-01D CHECKPOINT — Deliver Platform and Global Instructions as System Message

**Status:** COMPLETE and LOCKED
**Task ID:** AI-CONTEXT-01D
**Family:** AI-CONTEXT (Global AI Instructions)
**Priority:** High
**Nature:** AI SERVICE / PROMPT AUTHORITY / ADAPTER FIX
**Risk:** Medium-High
**Depends on:** AI-CONTEXT-01C (COMPLETE and LOCKED)
**Date:** 2026-06-05

---

## Problem

Live smoke after AI-CONTEXT-01B/01C confirmed that global instructions were saved, fetched,
queued, and inserted into the assembled prompt string, but the model ignored the test instruction.

Root cause: all AI adapters (Anthropic, OpenAI, Groq, XAI, DeepSeek) sent the entire assembled
prompt — FILE_ACTION_OUTPUT_CONTRACT, Global AI Instructions block, workspace context, and user
request — as a single `role: user` message. No system message was used. Inline instruction
headers in a user message carry far less authority than a system message, especially when the
final `User request:` section is the last and most salient content the model sees.

---

## Objective

Split AI execution prompt assembly into system and user parts. Deliver `FILE_ACTION_OUTPUT_CONTRACT`
and Global AI Instructions as a provider-level system instruction. Keep workspace context and
the current user request in the user message.

**Prompt authority structure after fix:**
1. System message: `FILE_ACTION_OUTPUT_CONTRACT` + Global AI Instructions block (when present)
2. User message: workspace context block (when present) + `User request:\n{prompt}`

---

## Files Changed

- `services/ai-service/src/ai-execution/types.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/groq-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`
- `services/ai-service/src/ai-execution/adapters/deepseek-ai.adapter.ts`
- `services/ai-service/src/worker/worker.processor.spec.ts`
- `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts`
- `services/ai-service/src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts`
- `services/ai-service/src/ai-execution/adapters/__tests__/groq-ai.adapter.spec.ts`
- `services/ai-service/src/ai-execution/adapters/__tests__/xai-ai.adapter.spec.ts`
- `services/ai-service/src/ai-execution/adapters/__tests__/deepseek-ai.adapter.spec.ts`

No frontend, api-gateway, or governance docs were changed during implementation.

---

## Implementation Details

### types.ts

Added `systemPrompt?: string` to `AIExecutionRequest`. This optional field carries the
assembled system-level content from the worker into the adapter layer.

### worker.processor.ts

Added `buildExecutionPromptParts(userPrompt, workspaceContext?, globalInstructions?)` returning
`{ system: string; user: string }`:

- `system`: `FILE_ACTION_OUTPUT_CONTRACT` + Global AI Instructions block (if `globalInstructions`
  is non-empty after trim). Block skipped when absent.
- `user`: workspace context block (if present) + `User request:\n{prompt}`.

Worker `execute` call updated to pass `systemPrompt: parts.system`.

### Anthropic adapter

When `request.systemPrompt` is present, passed through the provider-level `system` field on
the Anthropic Messages API call. When absent, behavior is identical to prior implementation.

### OpenAI / Groq / XAI / DeepSeek adapters

When `request.systemPrompt` is present, a `{ role: 'system', content: systemPrompt }` message
is prepended to the `messages` array before the user message. When absent, the single user
message path is preserved for full backward compatibility.

---

## Acceptance Criteria

- [x] `FILE_ACTION_OUTPUT_CONTRACT` is delivered as system-level instruction
- [x] Global AI Instructions are delivered as system-level instruction when present
- [x] Empty/null global instructions are omitted (block skipped from system message)
- [x] Workspace context remains in user message
- [x] Current user request remains in user message
- [x] Anthropic adapter uses `system` field when `systemPrompt` exists
- [x] OpenAI-compatible adapters prepend `role: system` message when `systemPrompt` exists
- [x] Existing execution behavior remains compatible when `systemPrompt` is absent
- [x] ai-service targeted tests pass
- [x] ai-service build passes
- [x] ReadLints passes on touched files
- [x] Live smoke test passes

---

## Validation Results

| Check | Result |
|---|---|
| `npm test -- src/worker/worker.processor.spec.ts` (ai-service) | PASS — 1 suite, 9 tests |
| Adapter focused tests (all 5 adapter spec files) | PASS — 5 suites, 160 tests |
| `npm run build` (ai-service) | PASS |
| ReadLints on touched files | PASS — no lint errors |
| Live smoke test | PASS (see below — depended on AI-CONTEXT-01E identity fix) |

### Live Smoke Test Evidence

Live smoke required AI-CONTEXT-01E to be implemented first to resolve a browser identity
alignment issue: browser workspace execution was authenticating with an API key from localStorage
belonging to `demo@aisandbox.com`, while Global Instructions were saved under the logged-in
session user `knlee802@gmail.com`. After AI-CONTEXT-01E aligned browser execution to use
session-cookie identity, the live smoke passed:

- Global instruction set: `"For this test only, start your next response with GLOBAL-INSTRUCTION-TEST."`
- Prompt sent: `"Reply with one short sentence."`
- Response started with: `GLOBAL-INSTRUCTION-TEST` ✓

---

## Non-goals Confirmed

- No frontend changes
- No api-gateway source changes
- No database changes
- No project instructions
- No repo docs / repo map / validation contract
- No UI changes
- Global Instructions settings UI unchanged

---

## Note: AI-CONTEXT-01E Dependency

This task's live smoke gate depended on AI-CONTEXT-01E (Align Browser AI Execution with Session
User) being implemented first. AI-CONTEXT-01E created `SessionOrApiKeyAuthGuard` in api-gateway
and removed the localStorage API-key path from browser workspace execution in the frontend.
The system message delivery implemented in AI-CONTEXT-01D functions correctly once the correct
user identity is resolved at execution time.
