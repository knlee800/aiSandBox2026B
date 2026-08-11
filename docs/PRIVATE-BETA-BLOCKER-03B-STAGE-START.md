# PRIVATE-BETA-BLOCKER-03B — Stage-Start: File-Action Reliability Fix

**Task ID:** PRIVATE-BETA-BLOCKER-03B  
**Step:** Step 2 — Fix Design + Stage-Start  
**Status:** STAGE-START COMPLETE  
**Created:** 2026-08-11  
**Author:** Cursor / Claude (read-only design only; no source modification; no runtime mutation)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03B |
| Title | File-Action Reliability Fix |
| Step | Step 2 — Fix Design + Stage-Start |
| Priority | P0 — blocker preventing Builder-first private-beta GO |
| Risk | READ-ONLY DESIGN — no runtime or source changes in Step 2 |
| Safety state | `GLOBAL_EXECUTION_ENABLED=false` throughout |
| PRIVATE-BETA-INVITE-01 | untouched / unregistered |
| 03C / 03D | NOT REGISTERED |

---

## 2. Proven Predecessor Root Cause

**Source:** `docs/PRIVATE-BETA-BLOCKER-03A-DIAGNOSIS.md` — COMPLETE AND LOCKED — ROOT CAUSE PROVEN  
**Checkpoint:** `docs/PRIVATE-BETA-BLOCKER-03A-CHECKPOINT.md`  
**E2E evidence:** `docs/PRIVATE-BETA-E2E-01-CHECKPOINT.md`

**ROOT CAUSE:** The Builder plain execution path uses a **PROMPT-ONLY** structured file-action output contract with **no validation, no content repair/retry, and silent acceptance** of non-compliant model responses as valid completed executions.

**Proven failure mechanism:**

1. System prompt instructs model to emit fenced `file-actions` blocks for file-creation requests
2. xAI adapter does NOT use `response_format`, `tools`, `function_calling`, or JSON mode
3. Grok 4.5 responded with prose-only text for a complex file-creation request
4. Parser silently returned `fileActions: []`
5. Worker marked execution `completed` without validating whether expected file actions were produced
6. Credits were deducted; workspace remained empty; user saw text but no file

**Classification:** RESPONSE-FORM-SPECIFIC / MODEL-AGNOSTIC CONTRACT WEAKNESS

Do not reopen whether the root cause exists.

---

## 3. Existing Request/Execution Contract

### Frontend → API Gateway → BullMQ → Worker

**Frontend execute payload** (`POST /api/ai/execute`):

```typescript
{
  prompt: string;
  provider: string;        // e.g. 'xai'
  model: string;           // e.g. 'grok-4.5'
  sessionId: string;
  conversationId: string;
  workspaceContext?: {
    filePaths: string[];
    selectedFilePath?: string;
    selectedFileContent?: string;
    namedFileContents?: { path: string; content: string }[];
    repoDocContents?: { path: string; content: string }[];
    searchResults?: { query: string; results: [...]; truncated: boolean };
    projectName?: string;
    workspaceName?: string;
  };
}
```

**API Gateway** validates, writes ledger intent (`usage_records` → status `pending`), enqueues BullMQ job.

**BullMQ job payload** (`AiExecutionJob`):

```typescript
{
  executionId, userId, apiKeyId, sessionId, conversationId,
  provider, adapter, prompt, workspaceContext,
  model, globalInstructions, projectInstructions,
  harnessVersion?, agentRole?, builderProfileId?, ...
}
```

**WorkerProcessor**: Claims job → status `running` → builds system + user prompt → calls `AIExecutionService.execute()` → receives `AIExecutionResult` → publishes SSE events → writes status `completed` → notifies API Gateway for credit deduction.

**AIExecutionService.execute()**: Resolves adapter → calls `adapter.execute(request)` → calls `extractFileActionsFromOutput(result.output)` → returns enriched result with `fileActions`.

### Key observation: No field in the request contract encodes user intent or execution purpose

There is no:

- `workspaceMutationExpected`
- `executionMode` / `executionType`
- `chatOnly` flag
- mutation-intent classifier
- Builder-specific execution mode field
- action/mode/type discriminator

**The request contract is semantically flat.** Every Builder execution goes through the same endpoint with the same shape. The model is the sole arbiter of whether to produce file actions.

---

## 4. Builder Mutation vs Conversation Semantics

### Does the Builder intentionally support both conversational and mutation-producing responses?

**NO — not as a product requirement.** *(Corrected by Step 2A §2A.2.)*

The system prompt (`FILE_ACTION_OUTPUT_CONTRACT`, `worker.processor.ts` lines 69–76) does permit conversational zero-action responses as a model-level instruction. However, this is a prompt-contract convenience (Category B), not a required product feature (Category A).

The PRD defines Builder execution as a workspace-mutation pipeline:

- PRD §C: *"structured file actions are produced"* — stated as the universal output form
- PRD §D: *"AI responses in Builder produce structured file-action instructions rather than raw unstructured text"*
- PRD §9: *"AI-driven workspace change pipeline"*
- No product feature, UI element, or API contract surfaces conversational-only execution as a distinct supported mode
- The frontend has no Ask/Build toggle or mode discriminator

**Conclusion:** Conversational zero-action behavior is NOT a required current Builder beta product behavior on the plain execution path. The prior system-prompt allowance does not establish a product requirement. Current Builder plain-path executions may safely require at least one valid applicable file action.

If conversational support is later required, an explicit UI mode toggle (Ask/Build) and a corresponding `executionIntent` field through the request contract would be the correct mechanism (future scope, NOT 03B).

---

## 5. Existing Mutation-Intent Signal Finding

**Answer: NO — no authoritative mutation-required signal exists.**

| Layer | Intent awareness | Finding |
|-------|-----------------|---------|
| Frontend submit | None | Sends raw prompt; no intent/mode field |
| API Gateway DTO | None | `AIExecutionRequest` has no intent discriminator |
| BullMQ job payload | None | `AiExecutionJob` has no intent field |
| Worker processor | None | Does not inspect prompt to determine expected outcome |
| AIExecutionService | None | Delegates to adapter and parser; no outcome validation |
| Parser | None | Returns `[]` identically for conversational and failed file responses |
| Completion logic | None | Status `completed` set unconditionally after provider success |
| Existing intent classifier | None | No classifier exists in the codebase |
| Builder-specific execution mode | None | No distinction between "chat" and "build/edit" |

---

## 6. Candidate Intent Mechanisms

### Option 1 — Explicit request contract field

Concept: Add `workspaceMutationExpected: boolean` to the frontend → API Gateway → job payload → WorkerProcessor path.

**Evaluation:**

- Reliability: LOW — frontend cannot reliably classify user intent from prompt text alone. "Explain this code and fix the bug" is ambiguous. Moves classification problem to frontend without solving it.
- Source files affected: frontend page, API Gateway DTO/controller/service, job types, worker
- Compatibility: backwards-compatible if optional with `undefined` default
- Verdict: **REJECTED** — merely relocates the classification problem; adds cross-layer contract change for uncertain benefit

### Option 2 — Existing intent classification

No existing semantic classifier or execution-intent field exists in the codebase.

**Verdict: NOT VIABLE** — nothing to reuse

### Option 3 — Model-declared intent via structured output

Concept: Provider returns a structured JSON response including a `workspaceMutationAttempted: boolean` field alongside `assistantText` and `fileActions`. Combined with `response_format: { type: "json_object" }` on the adapter, the model's response is structurally constrained to JSON, and the system validates consistency between declared intent and actual file actions.

**Evaluation:**

- Structural enforcement (`json_object` mode) eliminates the prose-only failure mode — this is valuable as defense-in-depth for FORMAT reliability
- However, using `workspaceMutationAttempted` as the **authoritative** validation signal is flawed: the same model whose output-contract compliance failed in E2E-01 would be trusted to accurately self-declare whether mutation was attempted. A structurally valid response with `workspaceMutationAttempted: false` and empty `fileActions` would silently complete as a legitimate conversation, even for an explicit file-creation request. *(Flaw identified by Step 2A §2A.1.)*
- Verdict: **REJECTED as authority for mutation intent.** The `json_object` structural enforcement is retained as defense-in-depth. The `workspaceMutationAttempted` field is retained as advisory/diagnostic metadata only. It must NOT be used as the authoritative validation signal.

### Option 4 — Deterministic heuristic (prompt keyword/regex)

Concept: Classify user prompt via keyword matching ("create", "build", "make", etc.).

**Evaluation:**

- Reliability: LOW — high false positive/negative risk; ambiguous prompts are common
- Brittleness: keywords overlap with conversational uses ("explain how to create...")
- Verdict: **REJECTED** — unsafe under current contracts; too brittle for a blocker fix

### Option 5 — Builder plain-path execution semantics (application-owned intent)

Concept: All plain-path (non-harness) Builder executions through `POST /api/ai/execute` semantically represent workspace-mutation requests. The application (WorkerProcessor) determines mutation-required status from the execution path: `!useHarness` → mutation required.

**Evaluation:**

- Reliability: HIGH — the application owns the determination; it cannot be overridden by model output
- No new fields required in frontend, API Gateway, queue/job payload, or request DTO
- The `useHarness` variable is already computed in WorkerProcessor from `job.data.harnessVersion` and config
- PRD-aligned: the PRD defines Builder execution as a workspace-mutation pipeline (§C, §D, §9)
- Conversational zero-action behavior is NOT a current product requirement (see §4 corrected)
- Harness path is excluded; harness has its own tool-use validation
- Verdict: **SELECTED** — strongest invariant; application-owned; zero classification ambiguity *(Selected by Step 2A §2A.3.)*

---

## 7. Selected Intent Mechanism

**SELECTED: Option 5 — Builder plain-path execution semantics (application-owned intent)** *(Corrected by Step 2A §2A.3.)*

The application (WorkerProcessor) determines mutation-required status from the execution path. `useHarness` is already computed before execution from `job.data.harnessVersion` and `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`.

**Mutation authority:** `!useHarness` means workspace mutation is required. This is application-owned execution semantics inside WorkerProcessor. No new frontend field, API Gateway field, queue/job field, prompt keyword classifier, or secondary model classification is required.

**Semantic validation:** After parsing and action safety validation:

`!useHarness && safeFileActions.length === 0` → `failed` with `file_action_contract_failure`

| Execution path | `safeFileActions.length` | Outcome |
|----------------|------------------------|---------|
| Plain path (`!useHarness`) | `> 0` | `completed` — normal success |
| Plain path (`!useHarness`) | `0` | `failed` — contract failure (mutation required, no valid actions) |
| Harness path (`useHarness`) | any | Harness-owned validation; plain-path check NOT applied |

The model's `workspaceMutationAttempted` field, if present in the structured JSON response, is advisory/diagnostic metadata only. It cannot override the application-owned mutation requirement.

**Core invariant:**

> A Builder plain-path execution must not silently become an ordinary successful completion when no valid applicable file actions are produced. ✓ (enforced by `!useHarness && safeFileActions.length === 0 → failed`)

---

## 8. Provider Structural-Output Capability Finding

**xAI (`api.x.ai/v1`) structured output support — confirmed via official docs:**

| Capability | Supported? | Notes |
|-----------|-----------|-------|
| `response_format: { type: "json_object" }` | **YES** | Forces valid JSON output; structure guided by system prompt |
| `response_format: { type: "json_schema", json_schema: {...} }` | **YES** | Schema-enforced output with constrained decoding |
| `strict: true` mode | **YES** | Hard enforcement during token generation |
| `additionalProperties: false` on nested objects | **NO** | xAI rejects this on nested objects (unlike OpenAI) |
| `tools` / `function_calling` | YES (for supported models) | Not relevant for plain path |
| OpenAI SDK compatibility | YES | Uses `openai` npm package with custom `baseURL` |

**Current adapter status:** `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`

- Does NOT use `response_format`
- Does NOT use `tools` or `function_calling`
- Does NOT use JSON mode
- Sends standard Chat Completions with messages only

**Selected structural enforcement:** `response_format: { type: "json_object" }`

Rationale for `json_object` over `json_schema`:
- Simpler; avoids xAI's `additionalProperties: false` nested-object incompatibility
- System prompt provides structure guidance
- Parser validates actual structure
- Sufficient to eliminate the proven prose-only failure mode
- Future upgrade to `json_schema` with strict mode is straightforward if needed

**Important:** Provider structural enforcement solves FORMAT reliability but does NOT by itself guarantee SEMANTIC validity. A schema allowing `fileActions: []` still needs application-level validation for mutation-required requests. Semantic validation is application-owned (`!useHarness && safeFileActions.length === 0 → failed`). The `workspaceMutationAttempted` field in the structured response is advisory/diagnostic metadata only and is NOT the authority for this validation. *(Corrected by Step 2A §2A.8.)*

---

## 9. Selected Provider/Output Contract

### Canonical response shape (structured JSON)

When the xAI adapter uses `response_format: { type: "json_object" }`, the model returns:

```json
{
  "assistantText": "Conversational response text to show the user",
  "workspaceMutationAttempted": true,
  "fileActions": [
    {
      "action": "create",
      "path": "index.html",
      "content": "<!DOCTYPE html>..."
    }
  ]
}
```

Fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assistantText` | `string` | YES | Human-readable text for the user |
| `workspaceMutationAttempted` | `boolean` | Optional/advisory | Model's self-report of whether it attempted file mutation. **ADVISORY/DIAGNOSTIC ONLY** — not the authority for semantic validation. Cannot override application-owned mutation-required determination. *(Corrected by Step 2A §2A.5.)* |
| `fileActions` | `array` | YES | Array of file action objects; empty `[]` when model produces no file actions |

File action object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | YES | One of: `create`, `write`, `update`, `delete` |
| `path` | `string` | YES | Relative file path |
| `content` | `string` | YES for create/write/update; empty string for delete | File content |

### Adapter system prompt augmentation

The xAI adapter appends a structured-response instruction to the system prompt it receives:

```
IMPORTANT: Your entire response MUST be a single valid JSON object with exactly these fields:
- "assistantText": (string) Your conversational response to show the user.
- "workspaceMutationAttempted": (boolean) true if you are creating, modifying, or deleting files; false if this is a conversational response with no file changes.
- "fileActions": (array) File actions to apply to the workspace. Each action object must have "action" (one of "create", "write", "update", "delete"), "path" (relative file path), and "content" (file content string; required for create/write/update; use empty string "" for delete). Use an empty array [] if no files need to be created, modified, or deleted.

Do not include any text outside the JSON object. Do not use fenced code blocks. Include all file content directly in the fileActions array.
```

This instruction explicitly overrides the fenced-block instruction in `FILE_ACTION_OUTPUT_CONTRACT`. The adapter is the correct place for this provider-specific augmentation.

### Legacy fenced-block format (backward compatibility)

Existing valid fenced-block output remains supported. The parser tries structured JSON first, then falls back to fenced-block extraction. This ensures:

- Other providers without `json_object` mode continue to work
- Historical test data remains valid
- Transition is non-breaking

### Validation boundary

Parser validates JSON structure. If the response is valid JSON but doesn't contain `assistantText` or `fileActions`, it's treated as a structural contract failure and falls through to legacy parsing. If neither structured JSON nor fenced blocks produce actions, the parser returns `parseMethod: 'none'`.

---

## 10. Parser Responsibility

### Current parser: `extractFileActionsFromOutput()`

**After 03B, the parser should:**

1. **First:** Attempt to parse the raw output as a structured JSON response object with `assistantText`, `workspaceMutationAttempted`, and `fileActions` fields
2. **If structured JSON succeeds:** Extract all three fields; validate each file action individually (existing `parseActionCandidate` logic); return structured result
3. **If structured JSON fails:** Fall back to existing fenced-block regex extraction
4. **If fenced blocks found:** Extract actions from blocks (existing logic); return with `parseMethod: 'fenced_block'`
5. **If neither succeeds:** Return `{ textOutput: rawOutput, fileActions: [], parseMethod: 'none' }`

### Enriched return type

```typescript
export interface ParsedFileActionsOutput {
  textOutput: string;
  fileActions: FileAction[];
  parseMethod: 'structured_json' | 'fenced_block' | 'fallback_json' | 'none';
  workspaceMutationAttempted?: boolean;
}
```

### Parser does NOT:

- Own mutation-intent business logic (that's WorkerProcessor's responsibility)
- Throw on malformed content (returns `parseMethod: 'none'`)
- Log diagnostics about execution intent (WorkerProcessor does this)
- Determine whether zero actions is correct or incorrect

**Separation preserved:** Syntactic parsing (parser) remains distinct from semantic execution validation (WorkerProcessor).

---

## 11. Semantic Validation Boundary

*(Corrected by Step 2A §2A.11.)*

**Location:** `WorkerProcessor` in `services/ai-service/src/worker/worker.processor.ts`

**After `AIExecutionService.execute()` returns and before writing `completed` status:**

```
IF !useHarness AND safeFileActions.length === 0:
  → Contract failure
  → Set execution_status = 'failed'
  → Store error metadata: { errorCode: 'file_action_contract_failure',
      message: 'Builder execution produced no valid file actions',
      workspaceMutationAttempted: aiResult.workspaceMutationAttempted ?? null }
  → Publish token event (so user sees assistantText)
  → Publish file actions event (empty)
  → Publish completion event (so frontend is notified)
  → Do NOT call notifyExecutionComplete (no credit deduction)
  → Log diagnostic: file_action.contract_failure
  → Return (do not proceed to completed path)

ELSE:
  → Proceed with existing completed path
```

This validation is **central** (in WorkerProcessor, not in any adapter) and **application-owned**. The validation condition (`!useHarness && safeFileActions.length === 0`) does NOT reference `workspaceMutationAttempted`. The model's self-report is logged as diagnostic metadata but cannot override the application's mutation-required determination.

---

## 12. Completion/Error Semantics

### Status for contract failure

**Status:** `failed` (existing status — no new status value)

**Error metadata** (stored in `usage_records.metadata`):

```json
{
  "aiExecutionResult": {
    "output": "<assistantText>",
    "tokensUsed": N,
    "model": "grok-4.5",
    "provider": "xai",
    "fileActions": []
  },
  "executionError": {
    "code": "file_action_contract_failure",
    "message": "Builder execution produced no valid file actions"
  }
}
```

### SSE/event consequence

- `publishToken(executionId, assistantText)` — user sees the assistant's text
- `publishFileActions(executionId, [])` — empty actions published
- `publishCompletion(executionId)` — completion event fires
- Status poll returns `{ status: 'failed', output: '...', fileActions: [] }`

### Frontend expected behavior

Existing frontend handling for `failed` status (`page.tsx` line 3851):

```typescript
if (nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'timeout') {
  setChatRequestState('failed');
  setChatStatusMessage(null);
  const failureMessage = toChatAssistantFailureMessage({
    rawMessage: nextOutput,
    fallbackMessage: `Execution ended with status: ${nextStatus}.`,
  });
}
```

**No frontend source changes required.** The existing failed-execution UI handles the new failure correctly: the user sees the assistant text plus a failure indicator, instead of a false successful completion with no workspace changes.

### Accounting consequence

`triggerDeductionForExecution()` checks `record.executionStatus !== 'completed'` → skips non-completed → **credits are NOT deducted for contract failures**. This is the natural consequence of using existing `failed` status.

---

## 13. Retry/Repair Decision

### SELECTED: No automatic retry

**Rationale:**

1. **Structural enforcement eliminates the proven failure mode.** With `json_object` mode, the model cannot return prose-only text. It must return valid JSON. The prose-only failure that caused the E2E blocker is structurally prevented.

2. **The remaining edge case (empty `fileActions` on the plain path) is caught and failed.** The user sees an explicit failure instead of a false success. They can retry manually.

3. **No hidden extra cost.** An automatic repair retry would consume additional tokens, add latency, and create accounting complexity — all for uncertain benefit (the same model might produce the same result).

4. **Simplest implementation.** No retry loop, no repair prompt construction, no timeout budget splitting, no interaction with 03D accounting policy.

5. **Testable locally.** No need for live provider calls to verify retry logic.

### Rejected alternatives

| Alternative | Why rejected |
|-------------|-------------|
| One bounded repair retry | Adds complexity (repair prompt, extra provider call, token accounting, timeout budget); uncertain reliability gain; the structural enforcement already addresses the proven failure mode |
| Structural enforcement + repair retry | Overengineered for 03B; if structured enforcement works (and it should for the proven failure), retry is unnecessary |
| No structural enforcement, retry only | Does not prevent the prose-only failure; retry might get the same prose response |

### Future consideration

If post-03B diagnostics show that empty `fileActions` on the plain path remains a frequent failure with structured output, a bounded repair retry can be added in a follow-up task. This is explicitly NOT required for 03B.

---

## 14. Provider-Agnostic vs xAI-Specific Boundary

### Central semantic validation (provider-agnostic)

*(Corrected by Step 2A §2A.8.)*

The plain-path mutation-required validation in WorkerProcessor is **central and provider-agnostic**:

- Lives in `worker.processor.ts` (not in any adapter)
- Condition: `!useHarness && safeFileActions.length === 0 → failed`
- Does NOT reference `workspaceMutationAttempted` or any provider-specific field
- Applies to ALL plain-path executions regardless of provider, parse method, or response format

### Structural enforcement (xAI adapter-specific)

The `response_format: { type: "json_object" }` and system prompt augmentation live in the xAI adapter only:

- `xai-ai.adapter.ts` adds `response_format` to the Chat Completions request
- `xai-ai.adapter.ts` appends structured JSON instructions to the system prompt

### Future providers

When other providers are activated, they can independently:
1. Add `response_format` in their adapters (if supported)
2. The central validation will automatically work with their structured responses
3. No WorkerProcessor change needed per provider

This is the correct boundary: **central semantic validation + provider-specific structural enforcement**.

---

## 15. Backward Compatibility

### Existing valid file-action outputs

Execution A (`24acd697...`) and Execution B (`83acc0e9...`) produced valid fenced `file-actions` blocks. These outputs would not be encountered again after the adapter change (new requests will use `json_object` mode). However, the parser's backward-compatible fenced-block fallback ensures any legacy-format response still works.

### Parser compatibility

```
JSON structured response → primary path (new)
Fenced ```file-actions``` blocks → fallback path (preserved)
Top-level JSON with "file-actions" key → second fallback (preserved)
Plain prose → parseMethod: 'none' (preserved behavior)
```

### No breaking changes

- Frontend: no changes; continues to receive `fileActions` array and `status` field
- API Gateway: no changes; passes through status and file actions
- Container Manager: no changes; receives workspace write requests as before
- Other adapters: no changes; continue to use fenced-block format

---

## 16. Zero-Action Behavior on Plain Path

*(Corrected by Step 2A §2A.2, §2A.7, §2A.10.)*

### Plain-path zero-action behavior: NOT supported in beta

Conversational zero-action behavior is NOT a required current Builder beta product behavior on the plain execution path. The prior system-prompt allowance does not establish a product requirement (see §4 corrected).

**For all plain-path Builder executions:** zero valid file actions → `failed` with `file_action_contract_failure`, regardless of the model's `workspaceMutationAttempted` value.

### Future relaxation

If conversational support is later required, an explicit UI mode toggle (Ask/Build) and a corresponding `executionIntent` field through the request contract would be the correct mechanism. This is future scope, NOT 03B scope.

---

## 17. Malformed-Output Behavior Matrix

*(Corrected by Step 2A §2A.14.)*

| Case | Parser behavior | WorkerProcessor behavior (plain path) | Status |
|------|----------------|--------------------------------------|--------|
| Valid structured JSON with non-empty `fileActions` | `parseMethod: 'structured_json'`; extracts actions | Normal completion path | `completed` |
| Valid structured JSON with empty `fileActions` (any `workspaceMutationAttempted` value) | `parseMethod: 'structured_json'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Valid JSON but missing expected fields (e.g. `{"reply": "..."}`) | Falls through to fenced-block fallback → no blocks → `parseMethod: 'none'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Invalid JSON (should not occur with `json_object` mode) | Falls through to fenced-block fallback → `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Empty response | `textOutput: ''`, `fileActions: []`, `parseMethod: 'none'` | **Plain-path contract failure** | **`failed`** |
| Prose only (cannot occur with `json_object` on xAI; possible for other providers) | `parseMethod: 'none'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Valid fenced `file-actions` block with actions (legacy format) | `parseMethod: 'fenced_block'`; extracts actions | Normal completion path if actions > 0 | `completed` |
| Malformed/empty fenced `file-actions` block | `parseMethod: 'fenced_block'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Syntactically valid JSON actions but all invalid (bad paths, missing content) | Actions individually rejected; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Multiple valid file actions | All validated individually; all valid ones included | Normal completion | `completed` |

**All plain-path executions with zero valid file actions fail, regardless of `workspaceMutationAttempted`, `parseMethod`, or response format.**

### Distinction preserved

- **Parser failure:** malformed JSON, missing expected fields → `parseMethod: 'none'`
- **Semantic contract failure:** plain-path execution with zero valid `fileActions` → WorkerProcessor fails
- **Workspace action validation failure:** individual actions rejected by path/content validation → parser-level

---

## 18. Diagnostics

### Minimal non-secret diagnostic logging

The following diagnostics are emitted by WorkerProcessor:

| Diagnostic | When | Content |
|------------|------|---------|
| `file_action.contract_failure` | `!useHarness` AND `safeFileActions.length === 0` | `{ event, executionId, provider, model, parseMethod, workspaceMutationAttempted, fileActionCount: 0 }` |
| `file_action.parse_result` | After every extraction | `{ event, executionId, parseMethod, fileActionCount, workspaceMutationAttempted }` |
| `file_action.structured_json_parsed` | When JSON response successfully parsed | `{ event, executionId, assistantTextLength, fileActionCount, workspaceMutationAttempted }` |

### NOT logged

- API keys
- Full prompt content
- Full assistant text (length only)
- Sensitive workspace content
- Secret environment values
- Full raw provider response (textOutput length only)

### Raw provider output persistence

Raw provider output is NOT persisted separately. The existing `usage_records.metadata.aiExecutionResult.output` stores the `textOutput` (assistantText). This is sufficient for diagnostics.

Full raw JSON response persistence is NOT added in 03B unless clearly needed post-validation.

---

## 19. Accounting Interaction

### 03D owns final policy. 03B defines execution semantics for accounting boundary.

**Existing accounting behavior:**

`triggerDeductionForExecution()` in `usage-ledger.service.ts` checks:

```typescript
if (record.executionStatus !== 'completed') {
  // skipped_non_completed → no deduction
  return { triggered: false, reason: `status_${record.executionStatus}` };
}
```

**03B consequence:**

| Execution outcome | Status | Deduction triggered? |
|-------------------|--------|---------------------|
| Successful workspace mutation | `completed` | YES |
| Contract failure (plain-path, no valid actions) | `failed` | **NO** — naturally skipped |
| Provider/transport failure | `failed` | NO — existing behavior |
| Timeout | `timeout` | NO — existing behavior |
| Cancelled | `cancelled` | NO — existing behavior |

**No accounting code changes needed.** The existing `skipped_non_completed` logic naturally handles the new `failed` status for contract failures.

**Token usage from the failed execution:** Tokens were consumed at the provider level. The `usage_records.tokens_used` field is still populated. 03D can decide whether to display or reconcile provider-consumed tokens for failed executions. 03B does not set charging policy for historical or future contract-failure executions.

---

## 20. Exact Step 3 Files

### REQUIRED

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | Add `response_format: { type: "json_object" }`; append structured JSON instruction to system prompt |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | Add structured JSON response parsing path; enrich `ParsedFileActionsOutput` with `parseMethod` and `workspaceMutationAttempted` |
| `services/ai-service/src/ai-execution/types.ts` | Add `parseMethod?` and `workspaceMutationAttempted?` to `AIExecutionResult` |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Pass through `parseMethod` and `workspaceMutationAttempted` from parser to result |
| `services/ai-service/src/worker/worker.processor.ts` | Add semantic validation: `!useHarness && safeFileActions.length === 0` → `failed`; hoist `useHarness` for scope access at validation point; add diagnostic logging with `workspaceMutationAttempted` as advisory metadata |

### TEST ONLY

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts` | Add structured JSON parsing tests; preserve all existing fenced-block tests |
| `services/ai-service/src/ai-execution/adapters/__tests__/xai-ai.adapter.spec.ts` | Verify `response_format` is included in request; verify system prompt augmentation |
| New: `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts` OR inline in existing worker tests | Semantic validation tests for the mutation/contract-failure logic |

### NOT EXPECTED

| File | Reason |
|------|--------|
| Frontend (`frontend/`) | Existing `failed` status UI handles it; no new intent signal |
| API Gateway (`services/api-gateway/`) | No new request contract field; status mapping already handles `failed` |
| Container Manager (`services/container-manager/`) | Not in the execution path |
| `worker.processor.ts` `FILE_ACTION_OUTPUT_CONTRACT` constant | Kept as-is; adapter appends override instruction |
| Queue/job types (`services/ai-service/src/queue/job.types.ts`) | No new fields in job payload |

---

## 21. Exact Step 3 Test Matrix

*(Corrected by Step 2A §2A.13.)*

### Core semantic validation tests

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Plain-path + valid `fileActions` (≥1) | `completed`; actions extracted; no validation failure |
| 2 | Plain-path + valid JSON + empty `fileActions` | `failed` with `file_action_contract_failure` |
| 3 | Plain-path + prose only (no JSON, no fenced blocks) + no actions | `failed` with `file_action_contract_failure` |
| 4 | Plain-path + malformed action output (all actions rejected by validation) | `failed` with `file_action_contract_failure` |
| 5 | Plain-path + model `workspaceMutationAttempted: false` + zero actions | **`failed`** — model self-report cannot override application intent |
| 6 | Provider `workspaceMutationAttempted` value does NOT affect validation outcome | `failed` regardless of `true`/`false`/`undefined` when actions empty on plain path |
| 7 | Legacy valid fenced `file-actions` block with actions | `completed`; actions extracted |
| 8 | Contract failure: no workspace action attempted after failure | `notifyExecutionComplete` NOT called; no credit deduction |
| 9 | Contract failure: `failed` status/event surfaced rather than false success | `publishCompletion` called; status = `failed` |
| 10 | Harness path + empty `fileActions` | Harness-owned validation; plain-path check NOT applied; behavior unchanged |

### Parser tests

| # | Test case | Expected |
|---|-----------|----------|
| 11 | Valid JSON response with `assistantText` + `fileActions` + `workspaceMutationAttempted` | `parseMethod: 'structured_json'`; all fields extracted |
| 12 | Valid fenced `file-actions` block (existing format) | `parseMethod: 'fenced_block'`; actions extracted; `workspaceMutationAttempted: undefined` |
| 13 | Top-level JSON with `"file-actions"` key (existing fallback) | `parseMethod: 'fallback_json'`; actions extracted |
| 14 | Plain prose (no JSON, no fenced blocks) | `parseMethod: 'none'`; `fileActions: []`; prose preserved as `textOutput` |
| 15 | Empty output | `parseMethod: 'none'`; `fileActions: []`; `textOutput: ''` |
| 16 | Valid structured JSON + fenced blocks present → structured JSON takes precedence | `parseMethod: 'structured_json'` |

### Backward compatibility tests

| # | Test case | Expected |
|---|-----------|----------|
| 17 | Existing fenced-block test cases continue to pass unchanged | All existing `file-actions.parser.spec.ts` tests green |
| 18 | Legacy prose-only response on plain path | `parseMethod: 'none'`; `fileActions: []`; **`failed`** on plain-path |

### Adapter tests

| # | Test case | Expected |
|---|-----------|----------|
| 19 | xAI adapter includes `response_format: { type: "json_object" }` in Chat Completions request | Verified in adapter spec |
| 20 | xAI adapter appends structured JSON instruction to system prompt | Verified system prompt content includes JSON instruction |

---

## 22. Local Validation Plan

### Commands

```powershell
# Parser + types + service unit tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test

# TypeScript compilation check
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build

# Targeted parser tests only (fast iteration)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="file-actions.parser" --verbose

# Targeted adapter tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="xai-ai.adapter" --verbose

# Targeted worker validation tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="worker-mutation-validation|worker.processor" --verbose
```

### Requirements

- No Docker/Postgres/Redis required (unit tests use mocks)
- No provider API calls (adapter tests mock the OpenAI SDK client)
- No `.env` changes
- No PM2/SSH required

### Acceptance

- All existing tests pass (no regressions)
- All new tests pass
- `npm run build` succeeds
- No new lint errors introduced

---

## 23. Step 4 Staging-Validation Plan

**Do NOT execute now. Define for later.**

### Controlled staging validation procedure

1. **Deploy only approved 03B code** to staging (git push + PM2 restart)
2. **Keep `GLOBAL_EXECUTION_ENABLED=false`** before and after deploy
3. **Health/watchdog pre-flight:**
   - All five PM2 processes online
   - API Gateway `/api/health/ready` → HTTP 200
   - AI Service `/metrics` → HTTP 200
   - Container Manager `/api/health` → HTTP 200
   - Frontend `https://staging.ainow.biz` → healthy redirect
   - Watchdog probes healthy
4. **Temporarily enable gate** using the corrected procedure (§24)
5. **Perform exactly ONE controlled real-provider mutation request:**
   - Use a request materially representative of the failed E2E case
   - NOT merely a one-line txt file
   - Suggested prompt: same "Private Beta Launch Checklist" `index.html` prompt that failed in E2E-01
   - Use Grok 4.5 (same model as the proven failure)
6. **Verify:**
   - Non-empty valid `fileActions` in execution result
   - `execution_status = 'completed'`
   - `workspaceMutationAttempted: true` in response metadata
   - Actual server-side workspace write (file exists in container)
   - Frontend file tree shows the created file
   - Preview renders the HTML content
   - Credit deduction occurred
7. **Verify Harness remains off:**
   - `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`
   - `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`
8. **Verify watchdog health** post-execution
9. **Return gate to `false`** using the corrected procedure (§24)
10. **Do NOT perform full E2E rerun in 03B** — that is a separate validation

### Additional validation: zero-action contract failure

*(Corrected by Step 2A — conversational zero-action completion is NOT supported on the beta plain path.)*

After the mutation test:
- Submit ONE conversational prompt (e.g. "What is TypeScript?")
- Verify `failed` status with `file_action_contract_failure` (zero valid file actions on plain path)
- Verify `fileActions: []`
- Verify no workspace mutation
- Verify credits NOT deducted (contract failure → `failed` → skipped by accounting)

---

## 24. Deterministic Gate Activation/Rollback Plan

**Based on E2E-01 §21 PM2 env-propagation evidence.**

### Activation (enable gate)

```bash
# 1. Edit .env
sudo nano /opt/aisandbox/.env
# Set: GLOBAL_EXECUTION_ENABLED=true

# 2. Source .env into current shell to force export
set -a && source /opt/aisandbox/.env && set +a

# 3. Verify env is in current shell
echo $GLOBAL_EXECUTION_ENABLED  # must show: true

# 4. Stop API Gateway
pm2 stop aisandbox-api-gateway

# 5. Restart with --update-env (picks up exported env)
pm2 start aisandbox-api-gateway --update-env

# 6. Wait for health
sleep 5
curl -s http://localhost:3001/api/health/ready  # must return HTTP 200

# 7. Verify runtime gate value
pm2 env $(pm2 id aisandbox-api-gateway | head -1) 2>/dev/null | grep GLOBAL_EXECUTION_ENABLED
# Must show: GLOBAL_EXECUTION_ENABLED=true

# 8. If step 7 shows wrong value, escalate: delete + re-add from ecosystem
# pm2 delete aisandbox-api-gateway
# cd /opt/aisandbox/services/api-gateway && pm2 start ecosystem.config.js --only aisandbox-api-gateway
# Repeat steps 6-7
```

### Rollback (disable gate)

```bash
# 1. Edit .env
sudo nano /opt/aisandbox/.env
# Set: GLOBAL_EXECUTION_ENABLED=false

# 2. Source .env
set -a && source /opt/aisandbox/.env && set +a

# 3. Verify env
echo $GLOBAL_EXECUTION_ENABLED  # must show: false

# 4. Stop + restart with --update-env
pm2 stop aisandbox-api-gateway
pm2 start aisandbox-api-gateway --update-env

# 5. Wait + verify
sleep 5
curl -s http://localhost:3001/api/health/ready
pm2 env $(pm2 id aisandbox-api-gateway | head -1) 2>/dev/null | grep GLOBAL_EXECUTION_ENABLED
# Must show: GLOBAL_EXECUTION_ENABLED=false
```

### Key principle

**Do NOT rely on `.env` edit + single `pm2 restart --update-env` without verification.** E2E-01 proved this is insufficient. Always verify the runtime gate value after restart.

---

## 25. Code/Runtime Rollback

### Code rollback

If staging validation fails:

```bash
# Revert only 03B commits
git revert <03B-commit-hash>
git push origin main

# Redeploy to staging
ssh staging
cd /opt/aisandbox && git pull
pm2 restart all --update-env
```

Or if multiple commits:

```bash
git log --oneline  # identify 03B commit range
git revert --no-commit <oldest-03B-commit>..<latest-03B-commit>
git commit -m "Revert 03B changes: staging validation failed"
```

### Runtime rollback

Restore `GLOBAL_EXECUTION_ENABLED=false` using the deterministic procedure in §24 (Rollback section).

### Verification after rollback

- All five PM2 processes online
- API Gateway health ready
- `GLOBAL_EXECUTION_ENABLED=false` in runtime
- Frontend accessible
- No DB rollback needed (no schema changes in 03B)

---

## 26. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Conversational prompts produce `failed` instead of `completed`** | EXPECTED | LOW | By design: all plain-path executions require valid file actions (see §4, §16 corrected). Conversational zero-action behavior is not a current product requirement. For 1–3 trusted beta users, Builder is a building tool. Future conversational support requires an explicit UI mode toggle (separate task). |
| **Increasing provider costs** | NEGLIGIBLE | LOW | No retry. JSON mode does not increase token costs vs text mode for the same content. Minor overhead from JSON structure tokens. |
| **Duplicate provider calls** | NONE | — | No retry mechanism. Single provider call per execution. |
| **Provider-specific lock-in** | LOW | LOW | Structural enforcement is xAI-adapter-only. Central validation is provider-agnostic. Other adapters can independently add `json_object` mode when activated. |
| **Model returns wrong JSON structure** | LOW | LOW | Parser falls back to fenced-block extraction. If neither works, `parseMethod: 'none'` → zero actions → `failed` on plain path. Not a regression vs current state (current state silently completes). |
| **Accidental Harness impact** | NONE | — | Harness path uses tool-use loop, not plain file-action extraction. Validation only applies to plain-path result. Harness route evaluated explicitly. |
| **Frontend incompatibility** | NONE | — | No frontend changes. Frontend already handles `failed` status with error message display. |
| **Accounting ambiguity** | LOW | LOW | Failed executions naturally skip credit deduction via existing `skipped_non_completed` logic. 03D owns policy decisions. |
| **Timeout regressions** | LOW | LOW | JSON mode may slightly increase response size (JSON structure overhead), but within existing timeout budget. No new timeout logic. |
| **`json_object` mode truncation** | LOW | MEDIUM | If response exceeds `max_tokens`, JSON may be truncated mid-generation. xAI's `json_object` mode should handle gracefully (model learns to fit within budget). Monitor in diagnostics. |
| **Model returns unexpected JSON structure** | LOW | LOW | Parser falls back to fenced-block extraction. If neither works, zero actions → `failed` on plain path. Detectable via diagnostics. |

---

## 27. Explicit Exclusions

03B Step 3 must NOT:

- Register 03C (Grok 4.2 timeout diagnosis)
- Register 03D (no-workspace-result credit policy)
- Register another blocker
- Register PRIVATE-BETA-INVITE-01
- Modify TASKS.md or TASKS_BACKLOG_FULL.md
- Modify ARCHITECTURE.md or PRD.md
- Change `.env` or `GLOBAL_EXECUTION_ENABLED`
- Make provider API calls
- Retry Builder
- SSH unless narrowly necessary for read-only evidence
- Restart PM2 or deploy
- Run Docker/Postgres/Redis
- Mutate DB/Redis
- Modify frontend source
- Modify API Gateway source
- Modify container-manager source
- Add new npm dependencies
- Change execution timeout values
- Add unbounded retry loops
- Create a new execution status value
- Redesign the entire provider layer
- Change other adapter implementations (openai, anthropic, groq, deepseek)
- Change queue/job types
- Change the BullMQ queue configuration

---

## 28. Step 3 Acceptance Criteria

*(Corrected by Step 2A §2A.15.)*

| Criterion | Requirement |
|-----------|-------------|
| Parser handles structured JSON response | `parseMethod: 'structured_json'` returned for valid JSON with expected fields |
| Parser backward compatibility | All existing fenced-block tests pass unchanged |
| xAI adapter uses `json_object` mode | `response_format: { type: "json_object" }` present in Chat Completions request |
| xAI adapter augments system prompt | Structured JSON instruction appended to system prompt |
| Semantic validation implemented | `!useHarness AND safeFileActions.length === 0` → `failed` (application-owned, not model-declared) |
| Validation does not reference `workspaceMutationAttempted` | `workspaceMutationAttempted` is logged as diagnostic metadata only; not used in the validation condition |
| Zero actions always fails on plain path | `workspaceMutationAttempted: false` + empty actions on plain path → `failed` (model cannot override) |
| Existing completed behavior preserved | Valid actions → `completed` with no change |
| Failed status used correctly | Contract failure uses existing `failed` status with error metadata |
| No credit deduction on contract failure | `notifyExecutionComplete` not called for `failed` status |
| Diagnostic logging | `file_action.contract_failure` and `file_action.parse_result` events emitted; `workspaceMutationAttempted` included as advisory |
| No prompt/secret leakage in logs | Only lengths, counts, and classification fields logged |
| Harness path unaffected | Harness route evaluation unchanged; plain-path validation NOT applied to harness path |
| All AI Service tests pass | `npm test` in `services/ai-service` succeeds |
| TypeScript compilation clean | `npm run build` in `services/ai-service` succeeds |
| No new lint errors | No regressions |

---

## 29. Final Design Verdict

*(Corrected by Step 2A §2A.16.)*

### **READY FOR BOUNDED IMPLEMENTATION**

**Chosen design:** Structured JSON output enforcement via `response_format: { type: "json_object" }` on the xAI adapter (defense-in-depth for FORMAT reliability) + **application-owned mutation-required determination** via plain-path execution semantics (`!useHarness`) + central semantic validation in WorkerProcessor (`!useHarness && safeFileActions.length === 0 → failed`) + enriched parser with backward-compatible fallback + `workspaceMutationAttempted` retained as advisory/diagnostic metadata only.

**Why this is the smallest robust fix:**

1. Eliminates the proven prose-only failure mode at the API level (model cannot return non-JSON with `json_object` mode)
2. Mutation-required is application-owned (`!useHarness`), not model-declared — cannot be overridden by any model response
3. Uses existing `failed` status — no new execution status values
4. Uses existing frontend failure handling — no frontend changes
5. Uses existing accounting skip logic — no accounting changes
6. Contained to AI Service (5 source files + tests)
7. No new dependencies, no new services, no schema migrations
8. No new frontend, API Gateway, or job contract fields
9. Backward compatible with legacy fenced-block format
10. Provider-agnostic semantic validation with provider-specific structural enforcement

**Exact source boundary:** See §20

**Exact behavioral semantics:** See §11, §12, §17

**Exact tests:** See §21

---

## Safety Confirmation (Step 2)

| Safety item | Status |
|-------------|--------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| Source files modified | NONE |
| Tests modified | NONE |
| `.env` modified | NONE |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| TASKS.md modified | NO |
| TASKS_BACKLOG_FULL.md modified | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| 03C / 03D registered | NO |
| PRIVATE-BETA-INVITE-01 touched | NO |

---

*Stage-start document created: 2026-08-11 — PRIVATE-BETA-BLOCKER-03B Step 2 — read-only design only — no source/runtime mutation.*

---

# Step 2A — Mutation-Intent Authority Correction

**Step:** Step 2A — Mutation-Intent Authority Correction  
**Status:** DESIGN CORRECTION — no source/runtime modification  
**Created:** 2026-08-11  
**Author:** Cursor / Claude (design correction only; no source modification; no runtime mutation)  
**Supersedes:** Step 2 §7 (Selected Intent Mechanism), §11 (Semantic Validation Boundary), §12 (Completion/Error Semantics partially), §16 (Legitimate Zero-Action Behavior), §17 (Malformed-Output Behavior Matrix partially), §20 (Exact Step 3 Files partially), §21 (Exact Step 3 Test Matrix partially), §28 (Step 3 Acceptance Criteria partially), §29 (Final Design Verdict)

---

## 2A.1 — Design Flaw Identification

Step 2 selected **Option 3 — Model-declared intent via structured output** as the authoritative mechanism for determining whether a Builder execution was mutation-producing.

The validation rule was:

```
workspaceMutationAttempted === true AND fileActions.length === 0 → failed
workspaceMutationAttempted === false AND fileActions.length === 0 → completed (conversation)
```

### Critical flaw

**The same provider/model whose output-contract compliance failed in E2E-01 is being trusted to accurately self-declare whether mutation was attempted.**

For the exact failed E2E request — `"Create a single file named index.html..."` — a structurally valid `json_object` response of:

```json
{
  "assistantText": "I will create the requested page.",
  "workspaceMutationAttempted": false,
  "fileActions": []
}
```

would pass Step 2 validation and be marked `completed`, because the model declared `workspaceMutationAttempted: false`.

The user explicitly requested workspace mutation. The model failed to produce file actions AND mis-classified its own behavior. Under Step 2, this silently completes successfully.

**This is the same class of failure as E2E-01 — the model's output is the sole authority, and when the model fails, no application-level invariant catches it.**

`json_object` mode fixes the SYNTACTIC form of the response (no more prose-only). It does NOT fix the SEMANTIC authority problem. A structurally valid JSON response with `workspaceMutationAttempted: false` and empty `fileActions` is syntactically correct but semantically wrong for a mutation request.

The deciding signal for mutation-required status must not come from the model's self-report.

---

## 2A.2 — Conversational Zero-Action Behavior: Product Requirement Analysis

### Step 2 claim

Step 2 §4 stated: *"Does the Builder intentionally support both conversational and mutation-producing responses? YES."* — citing the system prompt instruction:

> "If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit `file-actions` blocks."

### Re-evaluation from authoritative sources

**PRD.md §C — AI Execution (Builder Agent):**

> "AI execution is the primary product feature of Builder. A user expresses what they want to build or change; Builder executes an AI request; structured file actions are produced; the platform applies those changes to the workspace; and the file tree, editor, and preview reflect the result."

**PRD.md §C — Current Builder Core Loop:**

```
User describes what they want to build or change
→ Builder executes an AI request (single-shot path)
→ Structured file actions are produced (file writes, deletions)
→ Platform applies file actions to the workspace
→ File tree, editor, and preview reflect the changes
→ A git checkpoint is created for recovery
→ Project state persists durably across sessions
```

**PRD.md §D — Structured File Actions and Workspace Coherence:**

> "AI responses in Builder produce structured file-action instructions rather than raw unstructured text."

**PRD.md §9 — Summary:**

> "An AI-driven workspace change pipeline: user request → AI file-action output → workspace application → preview → git checkpoint"

### Findings

| Source | Conversational-only as product feature? | Evidence |
|--------|----------------------------------------|----------|
| PRD §C core loop | **NO** | Loop explicitly starts "User describes what they want to build or change" and ends with "structured file actions are produced". No zero-action path is described. |
| PRD §D structured file actions | **NO** | "AI responses in Builder produce structured file-action instructions" — stated as the universal output form. |
| PRD §9 summary | **NO** | "AI-driven workspace change pipeline" — the product summary doesn't mention conversational-only execution. |
| PRD §10 product status reference | **NO** | Lists "Structured AI file-action pipeline (parse → apply → coherence)" — no mention of zero-action conversational mode. |
| `FILE_ACTION_OUTPUT_CONTRACT` system prompt | **YES (prompt instruction only)** | The system prompt allows conversational responses. But this is a model instruction, not a product requirement. |
| Frontend UI | **NO** | Single chat input with no Ask/Build toggle, no mode selector, no intent discriminator. |
| API Gateway request DTO | **NO** | No `executionMode`, `chatOnly`, or intent field. |
| Job payload | **NO** | `AiExecutionJob` has no intent/mode field. |

### Conclusion

**Conversational zero-action Builder behavior is NOT a current product requirement.**

It is something the system prompt happens to allow — a model-level instruction for graceful handling of non-mutation prompts. This is **Category B**: something permitted by the current prompt contract, NOT **Category A**: a genuine supported product requirement.

The PRD defines Builder execution as a workspace-mutation pipeline. The core loop assumes file actions are produced. No product feature, UI element, or API contract surfaces "conversational-only execution" as a distinct supported mode.

**For the private beta with 1–3 trusted users**, Builder is explicitly a building/coding agent. Users who need conversational AI advice outside the workspace-mutation pipeline should use a different channel (future scope).

---

## 2A.3 — Authoritative Intent Owner

### Evaluation of all options

**Option A — Builder execution endpoint semantics:**

`POST /api/ai/execute` from the Builder workspace semantically represents an AI-to-workspace execution request. The PRD confirms this is the workspace-mutation pipeline.

The application already knows whether this is a plain-path (non-harness) Builder execution. In `worker.processor.ts`, the variable `useHarness` is computed before execution:

```typescript
const useHarness =
  job.data.harnessVersion === 'v1' &&
  DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop;
```

When `useHarness === false`, the execution follows the plain path: `AIExecutionService.execute()` → parser → file actions. This is the Builder single-shot mutation pipeline.

**Verdict: SELECTED.** The application-owned determination of execution path (`!useHarness`) is the authoritative mutation-intent signal. No new field required. No model self-report required.

**Option B — Explicit application request field (`executionIntent`):**

Concept: `executionIntent: "workspace_mutation" | "conversation"` in the request payload.

Problem: Who sets it? The frontend has no Ask/Build toggle. The frontend cannot reliably classify user intent from prompt text. This moves the classification problem to the frontend without solving it.

If a UI mode toggle were added (future scope), this would be viable. But adding a UI toggle adds scope beyond 03B.

**Verdict: REJECTED for 03B.** Valid future mechanism if conversational support is added via an explicit UI mode toggle. Not needed for beta.

**Option C — Existing UI mode/action:**

No existing mode distinction found. The frontend has a single chat input (`chatPromptInput`) that submits to `handleSubmitChatPrompt()` with no mode discriminator. No Ask/Build toggle, no mode selector.

**Verdict: NOT VIABLE.** No existing distinction to reuse.

**Option D — Separate deterministic classification:**

A second model call or heuristic classifier adds cost, latency, and is itself probabilistic. Unnecessary when the application already knows this is a Builder mutation pipeline.

**Verdict: REJECTED.** Overengineered given Option A is available.

**Option E — Model self-declaration (`workspaceMutationAttempted`):**

This is the Step 2 selection. The flaw is identified in §2A.1. The model whose compliance failed is trusted to declare whether compliance was required.

**Verdict: REJECTED as authority.** Retained as diagnostic metadata only (see §2A.5).

### Selected intent mechanism

**Option A — Builder plain-path execution semantics.**

The application (WorkerProcessor) determines mutation-required status from the execution path:
- `!useHarness` (plain-path Builder execution) → `mutationRequired = true`
- `useHarness` (harness execution) → harness has its own validation; plain-path validation does not apply

This requires **zero new fields** in the request, job payload, or API contract. The application already computes `useHarness`. The mutation-required determination is implicit from the execution path, not from the model's self-report.

### Why this is authoritative

1. **Application-owned:** The determination is made by WorkerProcessor, not by the provider/model.
2. **Deterministic:** `useHarness` is computed from `job.data.harnessVersion` and a config flag — no classification ambiguity.
3. **Reliable:** Cannot be overridden by a model response. The model's `workspaceMutationAttempted` value is irrelevant to the validation decision.
4. **PRD-aligned:** The PRD defines Builder execution as a workspace-mutation pipeline. Plain-path execution IS the mutation pipeline.
5. **Scope-minimal:** No frontend, API Gateway, queue/job type, or request DTO changes.

---

## 2A.4 — Concrete Answer for the Failed E2E Request

**Request:** `"Create a single file named index.html with a Private Beta Launch Checklist..."`

**Question:** What application-owned signal would cause WorkerProcessor to know, BEFORE interpreting the provider response, that this execution must yield one or more valid workspace actions?

**Answer:** The execution is a plain-path Builder execution (`useHarness === false`). WorkerProcessor computes `useHarness` before calling `AIExecutionService.execute()`. When `useHarness === false`, the application knows this is a Builder single-shot mutation pipeline execution. Mutation is required.

**Verification:** The failed E2E execution was:
- Provider: xAI (Grok 4.5)
- Harness version: not set / not `v1`
- Harness tool loop: disabled
- Path: plain-path (`useHarness === false`)

WorkerProcessor knows, before interpreting the response, that `mutationRequired === true`. After execution, if `safeFileActions.length === 0`, the validation fires:

```
plainPath execution + zero valid file actions → failed (file_action_contract_failure)
```

This catches the exact failed E2E case regardless of:
- Whether the model returned `workspaceMutationAttempted: true` or `false`
- Whether the model returned prose or JSON
- Whether the model claimed it would create the file but didn't

**The model's self-report cannot override the application's mutation requirement.**

---

## 2A.5 — Corrected Structured JSON Design

### `json_object` mode: retained

Structured JSON output via `response_format: { type: "json_object" }` on the xAI adapter remains selected. It provides defense-in-depth by eliminating the prose-only structural failure mode. But its role is clarified:

**Structured output is defense-in-depth for response FORMAT reliability. It is NOT the authority for mutation intent or execution success.**

### Response schema: corrected role

The response schema remains:

```json
{
  "assistantText": "Conversational response text to show the user",
  "workspaceMutationAttempted": true,
  "fileActions": [
    {
      "action": "create",
      "path": "index.html",
      "content": "<!DOCTYPE html>..."
    }
  ]
}
```

**Correction:** `workspaceMutationAttempted` is now **ADVISORY/DIAGNOSTIC metadata only**. It is:

- Extracted by the parser and passed through to the result
- Logged for diagnostic purposes (helps post-mortem analysis of why the model did or didn't produce actions)
- **NOT used as the authority for semantic validation**
- **NOT used to determine whether zero actions is a success or failure**

The semantic validation rule is application-owned and does not reference `workspaceMutationAttempted`.

### Adapter system prompt augmentation: adjusted

The xAI adapter's system prompt augmentation remains structurally the same (instructing JSON response format). The `workspaceMutationAttempted` field instruction is kept for diagnostic value but is clearly not the validation authority:

```
IMPORTANT: Your entire response MUST be a single valid JSON object with exactly these fields:
- "assistantText": (string) Your conversational response to show the user.
- "workspaceMutationAttempted": (boolean) true if you attempted to create, modify, or delete files; false otherwise.
- "fileActions": (array) File actions to apply to the workspace. Each action object must have "action" (one of "create", "write", "update", "delete"), "path" (relative file path), and "content" (file content string; required for create/write/update; use empty string "" for delete). Use an empty array [] if no files need to be created, modified, or deleted.

Do not include any text outside the JSON object. Do not use fenced code blocks. Include all file content directly in the fileActions array.
```

### Parser responsibility: unchanged from Step 2

The parser extracts `assistantText`, `workspaceMutationAttempted`, and `fileActions` from structured JSON. `workspaceMutationAttempted` is passed through in the enriched return type for diagnostic logging. The parser does NOT own mutation-intent business logic.

---

## 2A.6 — Frontend / API Gateway / Job Contract Changes

**NONE REQUIRED.**

| Layer | Change required? | Reason |
|-------|-----------------|--------|
| Frontend (`frontend/`) | NO | No new request field; existing `failed` status UI handles contract failure |
| API Gateway DTO | NO | No new request field |
| Queue/job payload (`AiExecutionJob`) | NO | No new field; mutation-required is inferred from execution path |
| API Gateway controller | NO | No new validation |
| API Gateway service | NO | No contract change |

The mutation-required determination is entirely internal to WorkerProcessor. It is inferred from `useHarness` (already computed from `job.data.harnessVersion` and config). No cross-layer contract change is needed.

**Before adding a field, determine what sets it.** Under the corrected design, nothing needs to set an explicit intent field because the intent is implicit from the execution path. This is the simplest possible contract.

**If conversational support is genuinely needed in the future**, an explicit `executionIntent: "workspace_mutation" | "conversation"` field can be added to the request/job payload, set by a UI mode toggle (Ask vs Build). This is future scope, not 03B scope.

---

## 2A.7 — Beta-Scope Simplification

### Evaluation

The safest bounded rule for the private beta is:

> **Current Builder plain-path execution requests are workspace mutation requests. Zero-action conversational behavior is outside the beta execution contract.**

### Verification against product intent

| Check | Result |
|-------|--------|
| PRD §C core loop describes Builder as mutation pipeline | YES — "structured file actions are produced" |
| PRD §D says "AI responses in Builder produce structured file-action instructions" | YES — universal statement |
| PRD §9 summary describes "AI-driven workspace change pipeline" | YES — no conversational exception |
| PRD §10 lists "Structured AI file-action pipeline" as current capability | YES — no zero-action mode listed |
| Frontend has Ask/Build mode toggle | NO — single undifferentiated chat input |
| Private beta is Builder-first for 1–3 trusted users | YES — PRD §9 confirms |
| Trusted beta users can be informed Builder is for building | YES — reasonable for 1–3 users |
| Conversational-only AI advice is NOT a registered product feature | CONFIRMED — §2A.2 analysis |

### Decision

**CONFIRMED.** The beta-scope simplification is not merely convenient — it matches the current PRD, product direction, and execution architecture. Builder IS the workspace-mutation pipeline. Zero-action completion for plain-path execution is a contract failure, not a legitimate outcome.

This eliminates unnecessary classification complexity without sacrificing any current product requirement.

### Future relaxation path

If conversational support is later required:
1. Add an explicit UI mode toggle (Ask / Build) in the frontend
2. Pass `executionIntent: "workspace_mutation" | "conversation"` through the request → API Gateway → job payload → WorkerProcessor
3. Apply mutation-required validation only when `executionIntent === "workspace_mutation"`
4. This is a separate task, NOT 03B scope

---

## 2A.8 — Provider Structural Enforcement: Clarified Role

**Preserved finding from Step 2:** xAI `json_object` mode improves syntactic reliability by eliminating the prose-only failure mode.

**Clarified role after correction:**

> **Structured output is defense-in-depth, not the authority for mutation intent.**

| Concern | Authority |
|---------|-----------|
| Response FORMAT (JSON vs prose) | Provider structural enforcement (`json_object` mode) |
| Mutation INTENT (was mutation expected?) | Application execution path (`!useHarness`) |
| Mutation RESULT (did the model produce valid actions?) | Application semantic validation (`safeFileActions.length`) |
| Diagnostic metadata (did the model think it attempted mutation?) | Model self-report (`workspaceMutationAttempted`) — advisory only |

`json_object` mode remains selected for xAI. It prevents the structural prose-only failure. But even with perfect JSON structure, an empty-actions response for a mutation-required execution is a contract failure caught by application semantic validation.

---

## 2A.9 — Retry Decision (Re-evaluation)

**After correcting intent authority, reassessment:**

With the corrected design:
1. `json_object` mode prevents prose-only structural failures (defense-in-depth)
2. Application-owned mutation-required validation catches zero-action responses (authoritative)
3. `failed` status with `file_action_contract_failure` gives the user an explicit failure signal
4. The user can manually retry

**No automatic retry added.** The reasoning from Step 2 §13 remains valid:
- Structural enforcement eliminates the proven failure mode
- The remaining edge case (valid JSON but empty actions) is caught and failed
- No hidden extra cost
- Simplest implementation
- Testable locally

Retry is not added to compensate for the intent issue. The intent issue is resolved by application-owned validation, not by retrying with the same model.

---

## 2A.10 — Corrected Completion/Error Semantics

### Mutation-required request (all plain-path Builder executions)

| Condition | Outcome | Status |
|-----------|---------|--------|
| Valid file actions > 0 | Completed | `completed` |
| Zero valid file actions (regardless of `workspaceMutationAttempted` value) | Contract failure | `failed` with `file_action_contract_failure` |
| Zero valid file actions + model says `workspaceMutationAttempted: false` | **Contract failure** | `failed` — model self-report does NOT override application intent |
| Zero valid file actions + model says `workspaceMutationAttempted: true` | Contract failure | `failed` — consistent |
| Zero valid file actions + `workspaceMutationAttempted` missing/undefined | Contract failure | `failed` — application intent is authoritative regardless |
| Prose-only response (cannot occur with `json_object` on xAI) | Would be caught by zero-actions validation | `failed` |
| Provider/transport error | Exception handling | `failed` (existing) |

### Legitimate non-mutating request (NOT supported in beta plain-path)

For the private beta, **all plain-path Builder executions are mutation-required**. There is no legitimate zero-action completion path for plain-path execution.

If conversational support is added in the future (via explicit `executionIntent` field — see §2A.7), the semantics would be:

| Condition | Outcome | Status |
|-----------|---------|--------|
| `executionIntent === "conversation"` + zero actions | Legitimate conversation | `completed` |
| `executionIntent === "conversation"` + non-empty actions | Actions used (unexpected but harmless) | `completed` |

This future path is NOT implemented in 03B.

### Harness execution

Unchanged. Harness path (`useHarness === true`) has its own tool-use validation. Plain-path mutation-required validation does NOT apply to harness executions.

---

## 2A.11 — Corrected Semantic Validation Boundary

**Location:** `WorkerProcessor` in `services/ai-service/src/worker/worker.processor.ts`

**Corrected validation logic (replaces Step 2 §11):**

After `AIExecutionService.execute()` returns and before writing `completed` status, WorkerProcessor applies:

```
IF !useHarness AND safeFileActions.length === 0:
  → Contract failure
  → Set execution_status = 'failed'
  → Store error metadata: { errorCode: 'file_action_contract_failure',
      message: 'Builder execution produced no valid file actions',
      workspaceMutationAttempted: aiResult.workspaceMutationAttempted ?? null }
  → Publish token event (so user sees assistantText)
  → Publish file actions event (empty)
  → Publish completion event (so frontend is notified)
  → Do NOT call notifyExecutionComplete (no credit deduction)
  → Log diagnostic: file_action.contract_failure
  → Return (do not proceed to completed path)

ELSE:
  → Proceed with existing completed path
```

**Key differences from Step 2 §11:**

| Aspect | Step 2 | Step 2A (corrected) |
|--------|--------|---------------------|
| Validation trigger | `workspaceMutationAttempted === true AND fileActions.length === 0` | `!useHarness AND safeFileActions.length === 0` |
| Authority | Model self-declaration | Application execution path |
| Can model override? | YES — model sets `false` to bypass | NO — model `workspaceMutationAttempted` is ignored for validation |
| Zero actions + model says `false` | `completed` (silent success) | `failed` (contract failure) |
| New request field required? | No | No |
| `workspaceMutationAttempted` role | Authoritative validation signal | Advisory diagnostic metadata |

---

## 2A.12 — Corrected Exact Step 3 Files

### REQUIRED (source)

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | Add `response_format: { type: "json_object" }`; append structured JSON instruction to system prompt |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | Add structured JSON response parsing path; enrich `ParsedFileActionsOutput` with `parseMethod` and `workspaceMutationAttempted` (diagnostic) |
| `services/ai-service/src/ai-execution/types.ts` | Add `parseMethod?` and `workspaceMutationAttempted?` to `AIExecutionResult` (both diagnostic/pass-through) |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Pass through `parseMethod` and `workspaceMutationAttempted` from parser to result |
| `services/ai-service/src/worker/worker.processor.ts` | Add semantic validation: `!useHarness AND safeFileActions.length === 0` → `failed`; hoist `useHarness` for scope access at validation point; add diagnostic logging with `workspaceMutationAttempted` as advisory metadata |

### TEST ONLY

| File | Change |
|------|--------|
| `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts` | Add structured JSON parsing tests; preserve all existing fenced-block tests |
| `services/ai-service/src/ai-execution/adapters/__tests__/xai-ai.adapter.spec.ts` | Verify `response_format` is included in request; verify system prompt augmentation |
| New: `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts` | Semantic validation tests for the corrected mutation-required contract |

### NOT EXPECTED

| File | Reason |
|------|--------|
| Frontend (`frontend/`) | No new intent signal; existing `failed` status UI handles contract failure |
| API Gateway (`services/api-gateway/`) | No new request contract field |
| Container Manager (`services/container-manager/`) | Not in the execution path |
| Queue/job types (`services/ai-service/src/queue/job.types.ts`) | No new fields in job payload |
| `FILE_ACTION_OUTPUT_CONTRACT` constant in `worker.processor.ts` | Kept as-is; adapter appends structured override instruction |

---

## 2A.13 — Corrected Step 3 Test Matrix

### Core semantic validation tests (CORRECTED from Step 2 §21)

| # | Test case | Expected | Step 2A difference |
|---|-----------|----------|-------------------|
| 1 | Plain-path + structured JSON: valid `fileActions` (≥1) | `completed`; actions extracted; no validation failure | Same as Step 2 |
| 2 | Plain-path + structured JSON: empty `fileActions` + `workspaceMutationAttempted: true` | `failed` with `file_action_contract_failure` | Same outcome, different trigger |
| 3 | Plain-path + structured JSON: empty `fileActions` + `workspaceMutationAttempted: false` | **`failed`** with `file_action_contract_failure` | **CHANGED from Step 2** — Step 2 would mark `completed`; Step 2A fails because application mutation-required overrides model self-report |
| 4 | Plain-path + structured JSON: empty `fileActions` + `workspaceMutationAttempted: undefined/missing` | `failed` with `file_action_contract_failure` | **CHANGED from Step 2** — Step 2 would skip validation (legacy); Step 2A fails because application owns the intent |
| 5 | Plain-path + structured JSON: zero surviving valid actions (all rejected by path validation) + `workspaceMutationAttempted: true` | `failed` with `file_action_contract_failure` | Same as Step 2 |
| 6 | Plain-path + structured JSON: zero surviving valid actions + `workspaceMutationAttempted: false` | **`failed`** with `file_action_contract_failure` | **CHANGED** — model override cannot bypass |
| 7 | Plain-path + prose/non-JSON fallback: no actions | `failed` with `file_action_contract_failure` | **CHANGED** — Step 2 would preserve legacy `completed`; Step 2A fails |
| 8 | Harness path + empty `fileActions` | Harness validation; plain-path validation NOT applied | Same — harness path unchanged |

### Additional regression tests required by Step 2A

| # | Test case | Expected | Rationale |
|---|-----------|----------|-----------|
| R1 | Plain-path + model `workspaceMutationAttempted: false` + zero actions → MUST FAIL | `failed` | Proves model self-report cannot override application intent |
| R2 | Plain-path + syntactically valid JSON + empty `fileActions` → MUST FAIL | `failed` | Proves structural JSON validity alone is insufficient |
| R3 | Plain-path + prose fallback (non-JSON) + no actions → MUST FAIL | `failed` | Proves non-xAI/legacy path also enforces mutation-required |
| R4 | Plain-path + valid file actions → MUST PASS | `completed` | Proves normal success path works |
| R5 | `workspaceMutationAttempted` value does NOT affect validation outcome | `failed` regardless of `true`/`false`/`undefined` when actions empty | Proves application authority over model self-report |
| R6 | Harness path + zero actions → plain-path validation NOT applied | Harness-owned behavior; no `file_action_contract_failure` | Proves plain-path validation is scoped correctly |
| R7 | Contract failure: `notifyExecutionComplete` NOT called (no credit deduction) | `notifyExecutionComplete` not invoked | Proves accounting boundary |
| R8 | Contract failure: diagnostic log contains `workspaceMutationAttempted` as metadata | Log includes advisory field | Proves diagnostic value is preserved |
| R9 | Contract failure: user sees `assistantText` via published token event | `publishToken` called before failure | Proves user feedback is preserved |

### Parser tests (unchanged from Step 2 §21 #9–#14)

Preserved as-is. Parser responsibility is syntactic extraction, unchanged by the intent authority correction.

### Backward compatibility tests (unchanged from Step 2 §21 #15–#16 except #16)

| # | Test case | Expected | Step 2A note |
|---|-----------|----------|-------------|
| 15 | Existing fenced-block test cases continue to pass unchanged | All existing `file-actions.parser.spec.ts` tests green | Unchanged |
| 16 | Legacy prose-only response (non-xAI provider, no `json_object` mode) | `parseMethod: 'none'`; `fileActions: []`; **`failed`** on plain-path | **CHANGED** — Step 2 said `completed` (legacy); Step 2A says `failed` because plain-path is mutation-required regardless of provider/parse-method |

### Adapter tests (unchanged from Step 2 §21 #17–#18)

Preserved as-is.

---

## 2A.14 — Corrected Malformed-Output Behavior Matrix

Replaces relevant rows in Step 2 §17 where the outcome has changed:

| Case | Parser behavior | WorkerProcessor behavior | Status |
|------|----------------|-------------------------|--------|
| Valid structured JSON with non-empty `fileActions` | `parseMethod: 'structured_json'`; extracts actions | Normal completion path | `completed` |
| Valid structured JSON with empty `fileActions` and `workspaceMutationAttempted: false` | `parseMethod: 'structured_json'`; `fileActions: []` | **Plain-path contract failure** (model self-report does NOT override) | **`failed`** |
| Valid structured JSON with empty `fileActions` and `workspaceMutationAttempted: true` | `parseMethod: 'structured_json'`; `fileActions: []` | Plain-path contract failure | `failed` |
| Valid structured JSON with empty `fileActions` and `workspaceMutationAttempted: undefined` | `parseMethod: 'structured_json'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Valid JSON but missing expected fields (e.g. `{"reply": "..."}`) | Falls through to fenced-block fallback → no blocks → `parseMethod: 'none'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Invalid JSON (should not occur with `json_object` mode) | Falls through to fenced-block fallback → `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Empty response | `textOutput: ''`, `fileActions: []`, `parseMethod: 'none'` | **Plain-path contract failure** | **`failed`** |
| Prose only (cannot occur with `json_object` on xAI; possible for other providers) | `parseMethod: 'none'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Valid fenced `file-actions` block with actions (legacy format) | `parseMethod: 'fenced_block'`; extracts actions | Normal completion path if actions > 0 | `completed` |
| Malformed fenced JSON inside block / valid fenced block with empty array | `parseMethod: 'fenced_block'`; `fileActions: []` | **Plain-path contract failure** | **`failed`** |
| Valid structured JSON with non-empty `fileActions` (harness path) | Parser extracts actions | Harness validation; plain-path check NOT applied | Harness-owned |
| Empty `fileActions` (harness path) | `fileActions: []` | Harness validation; plain-path check NOT applied | Harness-owned |

**All plain-path executions with zero valid file actions now fail, regardless of `workspaceMutationAttempted`, `parseMethod`, or response format.**

---

## 2A.15 — Corrected Step 3 Acceptance Criteria

Replaces Step 2 §28 where criteria differ:

| Criterion | Requirement | Step 2A change |
|-----------|-------------|---------------|
| Parser handles structured JSON response | `parseMethod: 'structured_json'` returned for valid JSON with expected fields | Unchanged |
| Parser backward compatibility | All existing fenced-block tests pass unchanged | Unchanged |
| xAI adapter uses `json_object` mode | `response_format: { type: "json_object" }` present in Chat Completions request | Unchanged |
| xAI adapter augments system prompt | Structured JSON instruction appended to system prompt | Unchanged |
| **Semantic validation implemented** | **`!useHarness AND safeFileActions.length === 0` → `failed`** | **CHANGED — application-owned, not model-declared** |
| **Validation does not reference `workspaceMutationAttempted`** | **`workspaceMutationAttempted` is logged as diagnostic metadata only; not used in validation condition** | **NEW** |
| **Zero actions always fails on plain path** | **`workspaceMutationAttempted: false` + empty actions on plain path → `failed`** | **NEW — proves model cannot override** |
| Existing completed behavior preserved | Valid actions → `completed` with no change | Unchanged |
| Failed status used correctly | Contract failure uses existing `failed` status with error metadata | Unchanged |
| No credit deduction on contract failure | `notifyExecutionComplete` not called for `failed` status | Unchanged |
| Diagnostic logging | `file_action.contract_failure` and `file_action.parse_result` events emitted; `workspaceMutationAttempted` included as advisory | Unchanged scope, corrected role |
| No prompt/secret leakage in logs | Only lengths, counts, and classification fields logged | Unchanged |
| Harness path unaffected | Harness route evaluation unchanged; plain-path validation NOT applied to harness path | Unchanged |
| All AI Service tests pass | `npm test` in `services/ai-service` succeeds | Unchanged |
| TypeScript compilation clean | `npm run build` in `services/ai-service` succeeds | Unchanged |
| No new lint errors | No regressions | Unchanged |

---

## 2A.16 — Corrected Final Design Verdict

### **READY FOR BOUNDED IMPLEMENTATION**

**Corrected design:** Structured JSON output enforcement via `response_format: { type: "json_object" }` on the xAI adapter (defense-in-depth for response FORMAT) + **application-owned mutation-required determination** via plain-path execution semantics (`!useHarness`) + central semantic validation in WorkerProcessor (`!useHarness && safeFileActions.length === 0 → failed`) + enriched parser with backward-compatible fallback + `workspaceMutationAttempted` retained as diagnostic metadata only.

**Why model self-declaration alone is insufficient (Step 2 flaw):**

The model whose output-contract compliance failed in E2E-01 is the same entity trusted to declare `workspaceMutationAttempted`. A model that fails to produce file actions for a file-creation request can also incorrectly declare `workspaceMutationAttempted: false`, causing the system to accept the response as a legitimate conversation. This is the same class of failure as E2E-01: the model's output is the sole authority, and when the model fails, no application-level invariant catches it. Structural JSON mode (`json_object`) fixes the FORMAT of the model's self-report but does not make the self-report reliable or authoritative.

**Why the corrected design resolves this:**

1. Mutation-required status is determined by the application from the execution path (`!useHarness`), not from the model's self-report
2. A model that returns `workspaceMutationAttempted: false` with empty `fileActions` on the plain path STILL FAILS
3. The application invariant cannot be bypassed by any model response
4. `json_object` mode prevents the prose-only structural failure as defense-in-depth
5. `workspaceMutationAttempted` remains useful for diagnostics but is not the validation authority

---

## 2A.17 — Final Report

### 1. Whether conversational zero-action Builder behavior is a true current product requirement

**NO.** The PRD defines Builder execution as a workspace-mutation pipeline. The core loop assumes "structured file actions are produced." Conversational-only execution is not listed as a product feature, UI capability, or API contract. The system prompt's allowance for conversational responses is a model-level instruction (Category B: permitted by prompt contract), not a product requirement (Category A: supported product feature). See §2A.2.

### 2. Authoritative mutation-intent owner

**Application (WorkerProcessor)**, via execution path determination (`!useHarness`). See §2A.3.

### 3. Selected intent mechanism

**Option A — Builder plain-path execution semantics.** All plain-path (non-harness) Builder executions are mutation-required. No new request fields, no model self-report dependency, no classification. See §2A.3.

### 4. Why model self-declaration alone is insufficient

The model whose output-contract compliance failed in E2E-01 is trusted to declare `workspaceMutationAttempted`. A structurally valid `json_object` response with `workspaceMutationAttempted: false` and empty `fileActions` would bypass Step 2 validation. The model's format compliance does not guarantee the model's semantic accuracy about its own intent. See §2A.1.

### 5. Exact behavior for the failed E2E-style request

`"Create a single file named index.html..."` → plain-path execution (`useHarness === false`) → model returns zero valid file actions → WorkerProcessor validation: `!useHarness && safeFileActions.length === 0` → `failed` with `file_action_contract_failure`. Model's `workspaceMutationAttempted` value is irrelevant to the decision. See §2A.4.

### 6. Whether structured JSON remains selected

**YES.** `response_format: { type: "json_object" }` on the xAI adapter is retained as defense-in-depth for response FORMAT reliability. It is not the authority for mutation intent. See §2A.5, §2A.8.

### 7. Role of `workspaceMutationAttempted`, if retained

**Retained as ADVISORY/DIAGNOSTIC metadata only.** Extracted by parser, passed through in `AIExecutionResult`, logged in diagnostic events. NOT used in the semantic validation condition. Cannot override application-owned mutation-required determination. See §2A.5.

### 8. Corrected semantic validation rule

```
IF !useHarness AND safeFileActions.length === 0 → failed (file_action_contract_failure)
```

This replaces Step 2's:

```
IF workspaceMutationAttempted === true AND fileActions.length === 0 → failed
```

See §2A.11.

### 9. Corrected completion/error semantics

All plain-path executions with zero valid file actions → `failed` with `file_action_contract_failure`, regardless of `workspaceMutationAttempted` value. See §2A.10.

### 10. Whether frontend/API Gateway/job contract changes are required

**NO.** No new fields in frontend request, API Gateway DTO, or job payload. Mutation-required status is inferred from the execution path, internal to WorkerProcessor. See §2A.6.

### 11. Exact Step 3 source files

1. `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`
2. `services/ai-service/src/ai-execution/file-actions.parser.ts`
3. `services/ai-service/src/ai-execution/types.ts`
4. `services/ai-service/src/ai-execution/ai-execution.service.ts`
5. `services/ai-service/src/worker/worker.processor.ts`

See §2A.12.

### 12. Exact Step 3 test files

1. `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts`
2. `services/ai-service/src/ai-execution/adapters/__tests__/xai-ai.adapter.spec.ts`
3. New: `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts`

See §2A.12.

### 13. Additional regression tests

9 additional regression tests (R1–R9) covering: model self-report override prevention, structural JSON with empty actions, prose fallback, valid actions pass, `workspaceMutationAttempted` non-authority proof, harness path isolation, credit deduction prevention, diagnostic metadata, and user feedback preservation. See §2A.13.

### 14. Retry decision

**No automatic retry.** Unchanged from Step 2 §13. The corrected intent authority resolves the flaw; retry would not compensate for an intent-authority gap that no longer exists. See §2A.9.

### 15. Compatibility impact

**No breaking changes.** Existing frontend, API Gateway, container-manager, and other adapters are unaffected. The parser's backward-compatible fallback is preserved. The only behavioral change is: plain-path executions with zero valid file actions now fail instead of silently completing. This is the intended fix, not a regression. See §2A.14.

### 16. Confirmation no implementation/runtime/provider action occurred

No source files modified. No tests modified. No `.env` modified. No PM2 restarted. No services stopped/started. No provider calls made. No Builder retried. No PostgreSQL/Redis/Docker mutated. No dependencies added. No git commit/push. No TASKS.md modified. No TASKS_BACKLOG_FULL.md modified.

### 17. Confirmation GLOBAL_EXECUTION_ENABLED=false

`GLOBAL_EXECUTION_ENABLED=false` — preserved. No runtime gate change.

### 18. Final corrected design verdict

**READY FOR BOUNDED IMPLEMENTATION**

### 19. Exact next step if READY

**PRIVATE-BETA-BLOCKER-03B Step 3 — Bounded Implementation + Local Validation**

Scope: Implement the 5 source files and 3 test files specified in §2A.12, following the corrected validation rule from §2A.11, test matrix from §2A.13, and acceptance criteria from §2A.15. Validate locally with `npm test` and `npm run build` in `services/ai-service`.

---

## Safety Confirmation (Step 2A)

| Safety item | Status |
|-------------|--------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| Source files modified | NONE |
| Tests modified | NONE |
| `.env` modified | NONE |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| TASKS.md modified | NO |
| TASKS_BACKLOG_FULL.md modified | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| 03C / 03D registered | NO |
| PRIVATE-BETA-INVITE-01 touched | NO |

---

*Step 2A correction appended: 2026-08-11 — PRIVATE-BETA-BLOCKER-03B Step 2A — Mutation-Intent Authority Correction — design correction only — no source/runtime mutation.*
