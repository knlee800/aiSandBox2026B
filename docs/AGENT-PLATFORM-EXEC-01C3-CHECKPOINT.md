# AGENT-PLATFORM-EXEC-01C3 — Independent Consolidation Checkpoint

**Task:** AGENT-PLATFORM-EXEC-01C3 — OpenAI and Anthropic native tool-call/tool-result transcripts
**Date:** 2026-09-03
**Lifecycle:** 3-STEP
**Step:** 3 — Independent Consolidation / Checkpoint / Final Lock
**Verdict:** COMPLETE AND LOCKED — PASS

---

## 1. Final verdict

AGENT-PLATFORM-EXEC-01C3 COMPLETE AND LOCKED — PASS

OpenAI and Anthropic native tool-call/tool-result transcripts are complete and locked. The adapters now build full provider-native transcript messages from execution-scoped canonical turn history. The loop accumulates assistant tool-call turns and correlated tool-result turns, passes deep-copied transcripts on every `executeFn` invocation, and preserves backward-compatible `toolResults` for last-turn callers. Malformed arguments produce typed correlated errors without dispatch. Missing-ID calls are excluded from both dispatch and transcript replay. Max-iteration failure throws a dedicated typed non-retryable error. Adapters remain stateless. Ordinary non-Harness execution is unchanged. The global Harness flag remains false. Product-visible Harness remains FUTURE/gated.

Lane 1 and AI-SERVICE ownership are released. The post-epoch IMPLEMENTATION candidate is retained with `status=LOCKED`.

---

## 2. Frozen scope

### Base and implementation commits

| Field | Value |
|---|---|
| Branch | `main` |
| Registration SHA | `26ce6fa80017e69e7682463b39398c995e456720` |
| Implementation SHA (HEAD) | `7840103013e4d550eece960d462ba9157ff95169` |
| `origin/main` | `7840103013e4d550eece960d462ba9157ff95169` |
| Working tree at consolidation open | Clean |
| `git diff --check` | Clean |
| Commits in range | 1 (`7840103 feat: implement native Harness provider transcripts`) |

### Exact nine implementation files

| # | Path | Type |
|---|---|---|
| 1 | `services/ai-service/src/ai-execution/adapters/adapter-tool-use.contracts.ts` | Production |
| 2 | `services/ai-service/src/ai-execution/adapters/adapter-tool-use.mapper.ts` | Production |
| 3 | `services/ai-service/src/ai-execution/adapters/openai-ai.adapter.ts` | Production |
| 4 | `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | Production |
| 5 | `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts` | Production |
| 6 | `services/ai-service/src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts` | Test |
| 7 | `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` | Test |
| 8 | `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts` | Test |
| 9 | `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts` | Test |

No implementation outside the admitted nine-path write set.

---

## 3. Canonical transcript types

### Contract types added to `adapter-tool-use.contracts.ts`

| Type | Purpose |
|---|---|
| `AIAdapterCanonicalValidToolCall` | Valid call: `status='valid'`, `callId`, `toolName`, parsed `arguments`, `rawArguments`, `providerKind` |
| `AIAdapterCanonicalMalformedToolCall` | Malformed arguments: `status='malformed_arguments'`, `callId` present, `rawArguments` preserved, `errorMessage` |
| `AIAdapterCanonicalMissingIdToolCall` | Missing ID: `status='missing_id'`, no `callId`, `toolName`, `rawArguments`, `providerKind` |
| `AIAdapterCanonicalToolCall` | Discriminated union of the above three |
| `AIAdapterCanonicalAssistantToolTurn` | `kind='assistant_tool_turn'`, assistant `content`, array of `AIAdapterCanonicalToolCall` |
| `AIAdapterCanonicalToolResultTurn` | `kind='tool_result_turn'`, array of `AIAdapterToolResultPayload` |
| `AIAdapterCanonicalTranscriptTurn` | Union of assistant and tool-result turns |
| `AIAdapterToolUseRequestOptions.transcript` | Optional `readonly AIAdapterCanonicalTranscriptTurn[]` on the options interface |
| `AIAdapterToolUseResult.canonicalToolCalls` | Optional canonical tool calls on the result |

### Argument parsing

`parseToolArgumentsToObject` returns `{ ok: true, value }` for valid JSON objects and `{ ok: false, errorMessage }` for anything else (invalid JSON, arrays, primitives, empty strings). Invalid arguments are never coerced to `{}`. `tryParseToolArgumentsToObject` wraps this for backward compatibility, returning `undefined` on failure.

---

## 4. OpenAI native transcript evidence

### First request body (turn 0)

System and initial user content occur exactly once. Advertised tools are present via `options.tools`. No transcript messages are appended (no prior turns).

### Subsequent request bodies (turn 1+)

`mapCanonicalTranscriptToOpenAIMessages` produces:
- `role: 'assistant'` with `tool_calls` array containing `{ id, type: 'function', function: { name, arguments } }` — exact provider call IDs, exact raw argument strings
- `role: 'tool'` messages with `tool_call_id` matching the original call ID and serialized result content
- Missing-ID calls are excluded from the `tool_calls` array via `correlatableToolCalls` filter
- Malformed-argument calls retain their original ID and raw argument string in the assistant `tool_calls` block; their correlated tool result appears as a `role: 'tool'` message with the error

Initial system + user messages are prepended once; transcript messages are appended. No duplication of user prompt or tool results.

Tests prove:
- System, user, and tools on first body (line 700–750 of openai spec)
- Assistant `tool_calls` + `role: 'tool'` on second body (line 752–863)
- No transcript leak across sequential calls (line 864–932)
- Exact IDs, no invented IDs (line 934–1020)
- User message appears exactly once in multi-turn body (line 856)

---

## 5. Anthropic native transcript evidence

### First request body (turn 0)

System instructions in the `system` field (not in messages). Initial user content in messages array. Advertised tools via `tools`. No transcript messages.

### Subsequent request bodies (turn 1+)

`mapCanonicalTranscriptToAnthropicMessages` produces:
- `role: 'assistant'` with content blocks: `{ type: 'text', text }` then `{ type: 'tool_use', id, name, input }` — exact call IDs
- `role: 'user'` with content blocks: `{ type: 'tool_result', tool_use_id, content }` with optional `is_error: true` for failures
- Missing-ID calls excluded from `tool_use` blocks
- Malformed calls retain ID and raw input; error result has `is_error: true`

Tests prove:
- System in field, user in messages, tools advertised on first body (line 786–826 of anthropic spec)
- Assistant `tool_use` + user `tool_result` on second body (line 828–940)
- No transcript leak across sequential calls (line 941–996)
- Exact IDs, no invented IDs (line 998–1068)
- String user content appears exactly once (line 936–938)

---

## 6. Malformed and missing-ID safety proof

### Malformed arguments

- `parseToolArgumentsToObject('{not-json')` → `{ ok: false, errorMessage: 'MALFORMED_TOOL_ARGUMENTS: ...' }`
- Adapter `extractToolCalls` produces `status: 'malformed_arguments'` with the original `callId` and `rawArguments`
- Loop `isDispatchableToolCall` returns `false` for `status !== 'valid'` — no dispatch
- Loop produces a typed error result: `{ callId, toolName, success: false, errorMessage }` — preserved in transcript
- No `arguments: {}` coercion anywhere in the pipeline
- Tests: adapter spec line 934–1020 (OpenAI), 998–1068 (Anthropic); mapper spec line 311–322; loop spec line 1672–1726

### Missing-ID calls

- Adapter `extractToolCalls`: if `call.id` is empty/undefined → `status: 'missing_id'`, no `callId` field
- Legacy `function_call` (OpenAI): always `missing_id` (line 420–430 of openai adapter)
- Loop: `continue` in the dispatch iteration for `missing_id` — no dispatch, no result, no invented ID
- `correlatableToolCalls` filter: excludes `missing_id` from native transcript `tool_calls` / `tool_use` blocks
- Therefore missing-ID calls do not appear in follow-up provider messages — no invalid transcript
- Tests: loop spec line 1728–1784 (dispatch never called, no invented ID); adapter spec line 656–668 (no fallback ID in canonicalToolCalls); mapper spec line 388, 502 (missing_id absent from native messages)

### Provider-native validity

When a missing-ID call appears alone: `correlatableToolCalls` returns empty → the assistant message has no `tool_calls`/`tool_use` blocks and is serialized as pure text content → valid provider message. When mixed with valid calls: only valid calls appear in `tool_calls`/`tool_use` → valid provider message.

No path sends an invalid native transcript or continues ambiguously. INVALID_NATIVE_TRANSCRIPT_PATHS = 0. INVENTED_CALL_IDS = 0.

---

## 7. Unknown tools and multiple calls

- Unknown tool names reach the existing dispatcher → `TOOL_NOT_FOUND` result with the original `callId`
- No handler is invented; `dispatcher.hasHandler('search_workspace')` returns `false`
- All calls in a multi-call turn are processed (subject to existing limits) and all results appended
- Tests: loop spec line 1786–1825 (TOOL_NOT_FOUND on original ID, no invented handler)
- Multi-call loop spec line 1397–1478 (two calls dispatched, both results in toolResults and transcript)

---

## 8. Transcript ownership and isolation proof

### Loop-owned execution-scoped state

- `transcript: AIAdapterCanonicalTranscriptTurn[]` is declared as a local variable inside `executeAgentHarnessLoop` (line 226)
- `priorToolResults` is a local variable (line 223)
- No module-level, static, singleton, cache, or adapter-instance transcript state exists
- Each call to `executeAgentHarnessLoop` creates fresh local arrays

### Adapter statelessness

- OpenAI and Anthropic adapters have no instance fields for transcript state
- `executeWithTools` is a pure function of `(request, options)` — it maps `options.transcript` to native messages, builds the request, calls the SDK, and returns
- No mutation of adapter state between calls

### Deep-copy isolation

- `copyTranscript()` (line 144–157 of loop) shallow-copies each turn and `.slice()`s the inner arrays before passing to `executeFn`
- `buildExecuteOptions` (line 159–174) copies `priorToolResults` with `.slice()` and transcript with `copyTranscript`
- Test line 1625–1668: executeFn mutates the passed transcript (pushes `{ kind: 'injected' }`); third call's transcript does not contain the injected element

### Caller-owned options not mutated

- Mapper test line 505–513: caller-owned transcript snapshot is unchanged after mapping to both OpenAI and Anthropic native messages
- Options are readonly-typed throughout

### Concurrent isolation

- Test line 1558–1622: two concurrent loop executions (A and B via `Promise.all`) each see only their own call IDs in transcript; a sequential third execution receives no transcript

### Backward-compatible first-turn callers

- Test line 510–521: first `executeFn` call receives `undefined` options (no toolResults, no transcript)
- `buildExecuteOptions` returns `undefined` when both transcript and toolResults are empty
- `mapCanonicalTranscriptToOpenAIMessages(undefined)` → `[]`; `mapCanonicalTranscriptToAnthropicMessages(undefined)` → `[]`

---

## 9. Loop and max-iteration behavior

### Transcript passed on every turn

- Turn 0: `buildExecuteOptions([], undefined)` → `undefined` (no transcript yet)
- Turn 1+: `buildExecuteOptions(transcript, priorToolResults)` → `{ toolResults, transcript }` — transcript accumulates all prior assistant and tool-result turns
- Tests: line 1397–1555 (multi-turn accumulation with exact turn shapes)

### Last-turn `toolResults` compatibility

- `priorToolResults` is reassigned each iteration to the current turn's results only
- `toolResults` in the options contains last-turn results (line 454–459, 870–874)
- This preserves backward compatibility with callers that only inspect `toolResults`

### Completion before ceiling

- Test line 1873–1896: model finishes after 1 tool turn → `completed`, not `max_iterations`

### Max-iteration typed failure

- `HarnessMaxIterationsError` extends `Error` with `terminationReason='max_iterations'`, `iterationsUsed`, `toolCallsReceived`, `tokensUsed`
- Thrown after the loop body completes all `maxToolIterations` iterations (line 527–532)
- Audit event `harness.loop_max_turns` emitted before throw (line 516–526)
- Error name `HarnessMaxIterationsError` and message contain no retryable patterns (`timeout|timed out|ECONNRESET|429|503|overloaded`)
- Test line 1828–1872: regex-proven non-retryable; worker's existing error classifier will mark the job failed
- No extra model invocation after termination: `executeFn` called exactly `maxToolIterations` times (line 1862)
- Cumulative tokens correct on the error (line 1860)
- No canned completed response — the loop throws, never returns a result

### Model call ceiling

- Loop: `for (let iteration = 0; iteration < maxIterations; iteration++)` — exactly `maxIterations` calls maximum
- `maxIterations = Math.max(1, config.maxToolIterations)` — clamped to at least 1
- Test line 147–158: `maxToolIterations: 0` → 1 call; line 133–145: `maxToolIterations: 1` → 1 call

---

## 10. Unsupported-provider boundary

- xAI/Grok: no `supportsToolUse`, no `executeWithTools` — unchanged (confirmed by reading adapter source)
- Groq: no tool-use fields — unchanged
- DeepSeek: no tool-use fields — unchanged
- Stub: `supportsToolUse = false` — unchanged
- EXEC-01C1 fail-closed routing: worker rejects Harness with `harnessVersion='v1'` when `enableToolLoop=false` or adapter lacks `supportsToolUse` — tests in coupled suite confirm (`selectedPath: 'fail_closed'`)
- No product or frontend activation occurred

---

## 11. Test quality

Tests would fail if:

| Invariant | How tested |
|---|---|
| Transcript state stored on adapter instance | Sequential isolation tests (openai line 864–932, anthropic line 941–996): second call has no prior transcript |
| Transcript array mutated across turns | Copy-mutation test (loop line 1625–1668): injected element not present in next turn |
| Initial prompts duplicated | User message count assertions (openai line 856, anthropic line 936–938) |
| Advertised tools disappear after turn 0 | Tools array asserted on both first and second request bodies (openai line 858, anthropic line 939) |
| Call IDs changed | Exact ID assertions throughout (openai line 830–853, anthropic line 899–930, mapper line 351–388) |
| Multiple results reordered or lost | Multi-call transcript assertions with ordered `callId` checks (mapper line 346–388) |
| Malformed JSON dispatched as `{}` | Handler spy not called (loop line 1710–1711); result does not contain `content: {}` (loop line 1723–1725) |
| Missing ID synthesized | `JSON.stringify` assertions (loop line 1782–1783, adapter lines 1018, 1065); dispatch spy called only for valid calls (loop line 1775) |
| Missing-ID transcript produces invalid provider messages | `correlatableToolCalls` excludes `missing_id` → no `tool_calls`/`tool_use` block without an ID; mapper tests confirm absence (mapper line 388, 502) |
| Unknown tools lost original IDs | `dispatchSpy.mock.calls[0][0].callId === 'call_unknown'` (loop line 1817–1818) |
| Max iterations returned successful output | `rejects.toBeInstanceOf(HarnessMaxIterationsError)` (loop line 498–506, 1133–1134, 1853–1854) |
| Loop made one extra model call | `executeFn.toHaveBeenCalledTimes(maxToolIterations)` (loop line 507, 840, 1862) |
| Concurrent loops leaked transcript state | `Promise.all` test with cross-contamination assertions (loop line 1558–1622) |

---

## 12. Verification results

| Check | Result |
|---|---|
| Targeted Jest (4 suites) | 4 passed, 165 tests passed |
| Coupled Jest (11 suites) | 11 passed, 345 tests passed |
| Full AI-Service Jest (38 suites) | 38 passed, 834 passed, 1 skipped (pre-existing) |
| AI-Service build (`tsc`) | PASS (exit 0) |
| AI-Service lint | UNAVAILABLE — no `.eslintrc` configuration file exists in the committed tree; ESLint devDependencies present but no config. Pre-existing condition. No config added. |
| `git diff --check` | Clean |
| Lane-capacity validator | PASS — `idleCode=NO_PAIRWISE_ADMISSIBLE_CANDIDATE` — `headSha=7840103013e4d550eece960d462ba9157ff95169` |

---

## 13. FUTURE/gated boundaries

- Product-visible Harness: FUTURE / gated / disabled / unavailable to users
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains `false`
- Gateway `agentId` + `harnessVersion` combination rejection: UNCHANGED
- Frontend: does not send `harnessVersion`
- Harness flags: UNCHANGED
- xAI tool protocol: UNCHANGED (no `executeWithTools`)
- No runtime, Docker, database, staging, browser, provider-live, or credit activity
- No migration
- EXEC-01C4 remains unregistered

---

## 14. Lifecycle / control-plane end state

| Item | End state |
|---|---|
| EXEC-01C3 | COMPLETE AND LOCKED — PASS — 2026-09-03 |
| Lane 1 | EMPTY — released |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| AI-SERVICE | UNOWNED — released |
| GOVERNANCE | UNOWNED (acquired transiently then released) |
| Candidate `status` | `LOCKED` |
| `lockedTaskIds` | includes `AGENT-PLATFORM-EXEC-01C3` |
| Parent umbrella EXEC-01C | REGISTERED / READY / NOT ADMITTED / PROVISIONAL / `admissionUncertain=true` |
| EXEC-01C1 | COMPLETE AND LOCKED |
| EXEC-01C2 | COMPLETE AND LOCKED |
| EXEC-01C4..01C9 | NOT REGISTERED |
| Runtime authorization | all `false` |

---

*Checkpoint created: 2026-09-03 — AGENT-PLATFORM-EXEC-01C3 — Independent Consolidation — PASS — no runtime/provider/staging/browser/credit/migration/Git activity.*
