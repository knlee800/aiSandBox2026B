# PRIVATE-BETA-BLOCKER-03A — Root-Cause Diagnosis + Evidence

**Task ID:** PRIVATE-BETA-BLOCKER-03A  
**Step:** Step 2 — Root-Cause Diagnosis + Evidence  
**Status:** DIAGNOSIS COMPLETE  
**Created:** 2026-08-10  
**Author:** Cursor / Claude (diagnosis-only; no source modification; no runtime mutation)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03A |
| Title | Empty File-Action Contract Diagnosis |
| Step | Step 2 — Root-Cause Diagnosis + Evidence |
| Priority | P0 — blocker preventing Builder-first private-beta GO |
| Risk | READ-ONLY DIAGNOSIS — no runtime or source changes |
| Safety state | `GLOBAL_EXECUTION_ENABLED=false` throughout |
| PRIVATE-BETA-INVITE-01 | untouched / unregistered |

---

## 2. Confirmed Blocker

A completed Builder plain-path execution (`2bc73157-973a-45ec-8b71-bca8c2f7941d`) returned assistant text but produced zero structured file actions, so the requested workspace mutation (`index.html`) never occurred.

| Evidence field | Value |
|----------------|-------|
| Execution ID | `2bc73157-973a-45ec-8b71-bca8c2f7941d` |
| Provider | xAI |
| Model | grok-4.5 |
| Path | plain |
| Status | completed |
| Tokens | 1251 (total = input + output) |
| Stored output | `Creating a single self-contained \`index.html\` with the checklist behavior and minimal styling.` |
| fileActions | `[]` |
| Workspace write | None |
| Server-side `/workspace` | Empty |

---

## 3. Scope and Exclusions

**In scope:**
- Empty file-action contract diagnosis for plain path
- Source-level end-to-end trace
- Provider/output contract classification
- Parser behavior audit
- Completion semantics audit
- Comparison with successful executions

**Explicitly out of scope:**
- Grok 4.2 timeout diagnosis (→ future 03C)
- Duplicate-submission investigation (no evidence supports one)
- Credit/accounting policy decision (→ future 03D)
- `token_usage` missing table fix (unless proven causal)
- Any source modification or fix implementation (→ 03B)
- Any runtime mutation

---

## 4. Source-Path Trace — Plain Builder Execution

### Frontend → API Gateway

1. Frontend: `POST /api/ai/execute` with `{ prompt, sessionId, conversationId, provider, model }`
2. API Gateway `AIExecutionController.submitExecution()`: guards run (session cookie, CSRF, GLOBAL_EXECUTION_ENABLED, CreditBalanceGuard, session ownership, idempotency)
3. API Gateway: INSERT `usage_records` (status='pending'), BullMQ enqueue → `ai-execution` queue
4. API Gateway: return 202 `{ executionId, status: 'queued' }`

### Worker Claims Job

5. `services/ai-service/src/worker/worker.processor.ts` — `WorkerProcessor` claims job from BullMQ
6. Worker: UPDATE `usage_records` status → 'running'
7. Worker: evaluates harness route → `harnessVersion=null`, `enableToolLoop=false` → `selectedPath='plain'`

### Prompt Assembly

8. Worker calls `buildExecutionPromptParts(userPrompt, workspaceContext, globalInstructions, projectInstructions)`
9. System prompt sections assembled:
   - `FILE_ACTION_OUTPUT_CONTRACT` (lines 69–77 of worker.processor.ts) — the output format instruction
   - globalInstructions (if any)
   - projectInstructions (if any)
10. User prompt sections assembled:
    - workspaceContext block (file paths, selected file, etc.)
    - `User request:\n${normalizedPrompt}`

### Provider Execution

11. Worker calls `this.aiExecutionService.execute(executionRequest)`
12. `services/ai-service/src/ai-execution/ai-execution.service.ts` — `AIExecutionService.execute()`:
    - Resolves provider/model selection
    - Instantiates `XAIAdapter`
    - Calls `adapter.execute(request)`
13. `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` — `XAIAdapter.execute()`:
    - Builds OpenAI-compatible Chat Completions request
    - **NO** `response_format` parameter
    - **NO** `tools` or `function_calling` parameter
    - **NO** JSON mode
    - Calls `this.client.chat.completions.create(xaiRequest)`
    - On success: `transformResponse()` returns `{ output: choices[0].message.content, tokensUsed: usage.total_tokens, model }`

### File-Action Extraction

14. `AIExecutionService.execute()` (line 108): `const parsed = extractFileActionsFromOutput(result.output ?? '')`
15. `services/ai-service/src/ai-execution/file-actions.parser.ts` — `extractFileActionsFromOutput()`:
    - Regex search for `` ```file-actions\n...\n``` `` blocks
    - If found: parse JSON inside blocks, validate each action
    - If NOT found: fallback to `parseTopLevelFileActionsObjectPayload()` — try to parse entire output as JSON with `"file-actions"` key
    - If BOTH fail: return `{ textOutput: rawOutput, fileActions: [] }` **silently**

### Result Persistence

16. Worker (line 962–1040): stores result in `usage_records.metadata.aiExecutionResult`:
    ```json
    { "output": <textOutput>, "tokensUsed": N, "model": "...", "provider": "xai", "fileActions": [] }
    ```
17. Worker: UPDATE `usage_records` SET `execution_status = 'completed'`
18. Worker: `executionStreamPublisher.publishFileActions(executionId, [])` → Redis Pub/Sub
19. Worker: `executionStreamPublisher.publishCompletion(executionId)` → Redis Pub/Sub

### Accounting

20. Worker: `apiGatewayHttpClient.notifyExecutionComplete(executionId)` → triggers credit deduction

### Frontend Apply

21. Frontend SSE receives `{ type: 'file_actions', actions: [] }` → `consumeExecutionFileActions()` with empty array
22. Frontend SSE receives `{ type: 'complete' }` → status poll
23. Status poll: `GET /api/ai/executions/:id` returns `{ fileActions: [], status: 'completed', output: "..." }`
24. `consumeExecutionFileActions()` → `maybeApplyExecutionFileActions()` → `applySequentialFileActions({ actions: [] })`
25. Zero iterations in apply loop → returns `{ applyStatus: 'applied', results: [] }` — vacuously "applied"

---

## 5. Plain Execution Architecture Summary

```
Frontend POST /api/ai/execute
  → API Gateway (guards, ledger intent, BullMQ enqueue)
  → AI Service WorkerProcessor (claim, status='running')
    → buildExecutionPromptParts() — assemble system + user prompt
    → AIExecutionService.execute()
      → XAIAdapter.execute() — OpenAI SDK Chat Completions (NO structured output)
        → Returns: { output: raw_text_content, tokensUsed, model }
    → extractFileActionsFromOutput(raw_text_content)
      → Returns: { textOutput, fileActions: [] or [...actions] }
    → publishFileActions(executionId, fileActions)
    → publishCompletion(executionId)
    → UPDATE usage_records (status='completed', metadata={...})
    → notifyExecutionComplete → credit deduction
  ← Frontend SSE receives file_actions + complete events
  → Frontend: consumeExecutionFileActions → applySequentialFileActions
```

---

## 6. FileActions Creation/Extraction Path

### Where is `fileActions` created?

**Function:** `extractFileActionsFromOutput()` in `services/ai-service/src/ai-execution/file-actions.parser.ts`

**Input:** Raw text output from provider adapter (`choices[0].message.content`)

### Accepted formats

1. **Primary:** Fenced code blocks tagged `` ```file-actions `` containing valid JSON array of actions
2. **Fallback:** Entire output is valid JSON object with a `"file-actions"` array key

### When parsing fails / finds nothing

- No `` ```file-actions `` block in output → regex returns no matches
- Fallback JSON parse fails (output is not JSON) → `try/catch` returns `[]`
- **Returns:** `{ textOutput: rawOutput.trim(), fileActions: [] }`
- **Does NOT throw**
- **Does NOT log a warning**
- **Does NOT emit a metric or diagnostic event**
- **Returns `[]` silently**

### Can normal prose legitimately yield `[]`?

**YES.** The system prompt states: "If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit `file-actions` blocks."

So `[]` is valid for conversational queries. The system cannot currently distinguish between:
- A: conversational response → `fileActions=[]` is correct
- B: model ignored file-action instruction → `fileActions=[]` is a defect

### Is `[]` treated as a valid successful result?

**YES.** The worker unconditionally marks the execution `completed` if the provider call succeeds. The file-action count has zero influence on completion semantics.

---

## 7. Provider/Output Contract Classification

### System Prompt (FILE_ACTION_OUTPUT_CONTRACT)

Lines 69–77 of `worker.processor.ts`:

```
Execution output contract:
- If the user request requires creating, modifying, or deleting files, you MUST emit a fenced code block tagged `file-actions`.
- The `file-actions` block content MUST be valid JSON containing an array of actions.
- Each action MUST use action value "create", "write", "update", or "delete".
- "create", "write", and "update" actions MUST include string fields: "path" and "content".
- "delete" actions MUST include string field "path" and MUST NOT include or require "content".
- Do not claim that files were created, changed, or deleted unless matching `file-actions` entries are present.
- If the user request does not require file creation, modification, or deletion, respond normally in plain conversational text and do not emit `file-actions` blocks.
```

### What the adapter actually sends

The XAIAdapter sends a standard OpenAI Chat Completions request:
```
{
  model: "grok-4.5",
  max_tokens: 4096,
  temperature: 1.0,
  messages: [{ role: "system", content: ... }, { role: "user", content: ... }]
}
```

No `response_format`. No `tools`. No `function_calling`. No JSON mode. No schema enforcement.

### Classification

## **PROMPT-ONLY**

The model is merely instructed to emit a parseable format via system prompt text. There is zero structural enforcement by the API. The model is free to ignore the instruction.

---

## 8. xAI Provider Adapter Behavior

**File:** `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts`

| Aspect | Finding |
|--------|---------|
| API endpoint | `https://api.x.ai/v1` (OpenAI-compatible) |
| SDK | `openai` npm package with custom baseURL |
| Request format | Standard Chat Completions (messages array) |
| `response_format` | **NOT USED** |
| `tools` / `function_calling` | **NOT USED** |
| JSON mode | **NOT USED** |
| Response consumed | `choices[0].message.content` as plain text string |
| Tool calls in response | **NOT CHECKED** — adapter only reads `.message.content` |
| Structured output capability | **NOT UTILIZED** |
| Output returned | `{ output: content, tokensUsed: usage.total_tokens, model }` |
| Malformed structured output detection | **NONE** — adapter returns any non-empty content as success |

The adapter treats ANY non-empty text response as a successful execution. It has no concept of whether the content contains valid file-action blocks.

---

## 9. Raw-Response Evidence Availability

### What is preserved

| Evidence type | Preserved? | Location |
|---------------|-----------|----------|
| Raw provider content (full `choices[0].message.content`) | **PARTIALLY** — stored as `textOutput` (after file-action block removal) | `usage_records.metadata.aiExecutionResult.output` |
| File actions extracted | **YES** | `usage_records.metadata.aiExecutionResult.fileActions` |
| Token count | **YES** | `usage_records.tokens_used` |
| Model | **YES** | `usage_records.metadata.aiExecutionResult.model` |
| Provider | **YES** | `usage_records.metadata.aiExecutionResult.provider` |
| XAIAdapter debug log (char count) | **YES** | PM2 log: `xAI response: output=94 chars, tokens=1251, model=grok-4.5` |
| Raw un-parsed provider response | **NOT PRESERVED** |
| Parser warnings/errors | **NONE GENERATED** — parser is silent |
| System prompt sent | **NOT PRESERVED** per-execution |
| User prompt sent | **NOT PRESERVED** per-execution |

### Critical insight

For the **failed** execution, since `fileActions=[]` and the stored `output` is the same length as the raw adapter output (94 chars = 94 chars), we can conclude:
- Raw provider output = stored output = `"Creating a single self-contained \`index.html\` with the checklist behavior and minimal styling."`
- There was **NO** `` ```file-actions `` block in the raw response
- The model returned prose only

---

## 10. Successful Execution A Comparison

**Execution ID:** `24acd697-b55c-40d0-b2d5-32faf9b85709`

| Field | Evidence |
|-------|----------|
| Provider | xAI |
| Model | grok-4.5 |
| Path | plain |
| XAI raw output size | **180 chars** (adapter debug log) |
| Stored `output` | `""` (empty — entire response was inside the file-actions block) |
| Stored `fileActions` | `[{"path":"beta-activation-smoke-2026-08-10.txt","action":"create","content":"PRIVATE-BETA-EXEC-01 activation smoke PASS — 2026-08-10"}]` |
| Status | completed |
| Tokens | 1078 |
| Workspace mutation | Succeeded |
| Timestamp | 2026-08-10T08:47:11Z |

**Key difference from failed:** The model DID produce a `` ```file-actions `` block. The raw 180-char output was the fenced block; after stripping it, `textOutput` was empty. The request was a simple one-line file creation.

---

## 11. Successful Execution B Comparison

**Execution ID:** `83acc0e9-84de-4f94-9e41-294701e38393`

| Field | Evidence |
|-------|----------|
| Provider | xAI |
| Model | grok-4.5 |
| Path | plain |
| Stored `output` | `""` (empty) |
| Stored `fileActions` | `[{"path":"smoke-test.txt","action":"create","content":"FR-04 controlled xAI staging smoke passed."}]` |
| Status | completed |
| Tokens | 598 |
| Workspace mutation | Succeeded |
| Timestamp | 2026-08-07T05:03:03Z |

**Key difference from failed:** Same pattern as execution A — simple one-line file creation request. Model complied with system prompt and emitted the `` ```file-actions `` block.

---

## 12. Three-Execution Comparison Matrix

| Dimension | Execution A (SUCCESS) | Execution B (SUCCESS) | Target (FAIL) |
|-----------|----------------------|----------------------|---------------|
| Execution ID | `24acd697-b55c-40d0-b2d5-32faf9b85709` | `83acc0e9-84de-4f94-9e41-294701e38393` | `2bc73157-973a-45ec-8b71-bca8c2f7941d` |
| Requested operation | Simple 1-line txt file | Simple 1-line txt file | Complex HTML with JS/CSS checklist |
| Provider | xAI | xAI | xAI |
| Model | grok-4.5 | grok-4.5 | grok-4.5 |
| Execution path | plain | plain | plain |
| Prompt contract | FILE_ACTION_OUTPUT_CONTRACT (system prompt) | FILE_ACTION_OUTPUT_CONTRACT (system prompt) | FILE_ACTION_OUTPUT_CONTRACT (system prompt) |
| Raw response size | 180 chars | UNKNOWN (pre-log-rotation) | 94 chars |
| Normalized assistant text | `""` (empty) | `""` (empty) | `"Creating a single self-contained \`index.html\`..."` (94 chars) |
| Structured/action payload | Valid JSON array in `` ```file-actions `` block | Valid JSON array in `` ```file-actions `` block | **ABSENT** — no fenced block |
| Parser outcome | Extracted 1 action | Extracted 1 action | **Silent `[]`** |
| fileActions count | 1 | 1 | **0** |
| Execution status | completed | completed | completed |
| Workspace mutation | SUCCESS | SUCCESS | **NONE** |
| Accounting result | Credits deducted | Credits deducted | Credits deducted |

### Comparison Conclusion

The distinguishing factor is the **complexity of the requested output**. Simple 1-line text files were reliably produced as `` ```file-actions `` blocks. A complex HTML file with checklist behavior and styling was NOT produced as a file-actions block — the model returned only a description of what it would create. The system had no mechanism to detect or recover from this.

Additionally: execution `c3a920b3-ce40-47e6-9da3-9b19a995d5d5` (the other Grok 4.5 attempt in the same session, same complex prompt) also produced prose only:
- Stored output: `"Creating a single self-contained \`index.html\` for the Private Beta Launch Checklist."` (84 chars)
- fileActions: `[]`

This demonstrates the failure is **reproducible for complex requests** with Grok 4.5 on the current prompt-only contract.

---

## 13. Parser Behavior

When model output is prose such as:

> `Creating a single self-contained index.html with the checklist behavior and minimal styling.`

The parser/extractor does the following:

1. `FILE_ACTION_BLOCK_REGEX` (`/```file-actions\s*([\s\S]*?)```/gi`) — **no match** (no fenced block in prose)
2. `collectedActions` remains `[]` after regex pass
3. Falls through to `parseTopLevelFileActionsObjectPayload(rawOutput)`:
   - Attempts `JSON.parse()` on the raw output
   - Raw output is NOT valid JSON → `catch` block fires
   - Returns `[]`
4. Final return: `{ textOutput: "Creating a single self-contained...", fileActions: [] }`

**Behaviors confirmed:**
- ❌ Does NOT search for partial fenced JSON
- ❌ Does NOT search for action-like markers
- ❌ Does NOT regex extract paths/content from prose
- ❌ Does NOT log a warning
- ❌ Does NOT preserve parse failure metadata
- ❌ Does NOT emit any diagnostic signal
- ✅ Silently returns empty array
- ✅ Discards no content (prose preserved as textOutput)

**This is the central defect boundary.** The parser's silent `[]` return is the point where a model compliance failure becomes invisible to the system.

---

## 14. Completion-Status Semantics

### What marks an execution `completed`?

Worker processor line 1031–1040:
```sql
UPDATE usage_records
SET execution_status = 'completed',
    tokens_used = $2,
    metadata = $3::jsonb
WHERE execution_id = $1
```

This runs unconditionally after:
1. Provider call succeeds (no exception thrown)
2. Post-execution cancel check passes

### Is file-action validity part of completion?

**NO.** There is no validation of `fileActions` before marking `completed`. An execution with `fileActions: []` is treated identically to one with valid actions.

### Is there any concept of structured-output failure?

| Concept | Exists? |
|---------|---------|
| `completed_with_no_actions` | **NO** |
| `invalid_output` | **NO** |
| `structured_output_failure` | **NO** |
| `repair/retry-required` | **NO** |
| `partially_successful` | **NO** |

### Why a parsing failure becomes a successful execution

Because:
1. Provider HTTP call succeeded → no exception
2. Adapter returned a non-empty `output` → no error
3. Parser returned `fileActions: []` silently → no validation check
4. Worker proceeds unconditionally to completion

The system has a **single binary outcome model**: provider call succeeded OR failed. There is no intermediate state for "provider succeeded but output doesn't satisfy the contract."

---

## 15. Mutation-Intent Awareness

### Does the system know a workspace mutation was expected?

**NO.** There is no intent classification at any layer:

| Layer | Intent awareness | Finding |
|-------|-----------------|---------|
| Frontend submit | None | Sends raw prompt; no `expectsFileAction` flag |
| API Gateway enqueue | None | Job payload has prompt + workspace context; no intent field |
| Worker processor | None | Does not inspect prompt to determine expected outcome |
| AIExecutionService | None | Delegates to adapter and parser; no outcome validation |
| Parser | None | Returns `[]` for both valid conversational and failed file responses |
| Completion logic | None | No conditional logic based on prompt content |

### Consequence

The system cannot currently distinguish:

**A.** "What is TypeScript?" → `fileActions=[]` → correct (conversational)

**B.** "Create an index.html with a checklist" → `fileActions=[]` → **defect** (model ignored instruction)

Both yield the same completed/successful execution state.

---

## 16. Retry/Repair Mechanisms

### Current plain path retry/repair capabilities

| Mechanism | Classification |
|-----------|---------------|
| Transient HTTP error retry (timeout, 429, 503) | **IMPLEMENTED** — `isRetryableError()` with exponential backoff |
| Structured-output retry | **NOT IMPLEMENTED** |
| Parser repair | **NOT IMPLEMENTED** |
| Malformed JSON repair | **NOT IMPLEMENTED** |
| "Please return valid actions" retry | **NOT IMPLEMENTED** |
| Fallback extraction (fuzzy parsing) | **NOT IMPLEMENTED** |
| Output validation retry | **NOT IMPLEMENTED** |
| Secondary model call | **NOT IMPLEMENTED** |
| Local deterministic recovery | **NOT IMPLEMENTED** |

The only retry mechanism is for transport-level failures. There is zero content-level validation or retry.

---

## 17. Frontend Apply Boundary

### Confirmation: frontend is NOT implicated

| Check | Finding |
|-------|---------|
| SSE `file_actions` event received | Yes — with `actions: []` |
| Status poll fileActions | `[]` |
| Frontend normalize | `normalizeWorkspaceFileActions([])` → `[]` |
| consumeExecutionFileActions | Called with `[]`; no prior stream actions to preserve |
| applySequentialFileActions | Called with `actions: []`; zero-iteration loop; returns `{ applyStatus: 'applied', results: [] }` |
| Hidden lost payload? | **NO** — there was never a payload to lose |

**Verdict:** Frontend correctly processed the empty file-action array. No frontend bug contributed to this incident.

---

## 18. Accounting-Finalization Boundary

### Accounting sequence (from worker.processor.ts)

```
1. Provider call completes → aiResult returned
2. fileActions extracted (may be [])
3. publishFileActions() ← file actions published (even if empty)
4. publishCompletion() ← completion event published
5. UPDATE usage_records SET execution_status = 'completed' ← ledger finalized
6. notifyExecutionComplete() → API Gateway → triggerDeductionForExecution()
   → checks execution_status === 'completed' → emitDeductionAttempt() → credit deducted
```

### Key insight

Accounting finalizes **AFTER** `execution_status = 'completed'` but **WITHOUT** checking `fileActions.length`. The accounting trigger condition is:

```
record.executionStatus === 'completed'
```

Credits are deducted for ANY completed execution, regardless of whether workspace mutation occurred.

---

## 19. `token_usage` Causality Finding

### Question: Does the missing `token_usage` table participate in the file-action code path?

**Answer: NOT CAUSAL TO 03A**

| Factor | Finding |
|--------|---------|
| `token_usage` table location | `services/container-manager/src/usage/usage-aggregation.service.ts` — a legacy SQLite-based read-only aggregation service |
| Does it participate in AI execution? | **NO** — AI execution is entirely in `ai-service` using PostgreSQL |
| Does it participate in file-action extraction? | **NO** — file-actions parser is in `ai-service` |
| Does it participate in workspace writes? | **NO** — workspace writes go through container-manager file endpoints, not SQLite usage tables |
| Fail-open behavior | The `token_usage` error fails open; it does not block any workspace operation |
| Same code path? | Completely separate services, separate databases, separate concerns |

**Verdict:** `NOT CAUSAL TO 03A`. The `token_usage` missing table is in container-manager's legacy SQLite usage aggregation. It has no connection to the AI execution, file-action parsing, or workspace write pipeline.

---

## 20. Proven Failure Boundary

**Expected contract:**

When a user submits a Builder prompt requesting file creation (e.g., "Create an index.html with a checklist"), the system should produce a structured file-action that creates the requested file in the workspace.

**Actual observed behavior:**

The model returned prose describing what it would do ("Creating a single self-contained index.html...") without including the required `` ```file-actions `` block. The system accepted this as a valid completed execution, charged credits, and surfaced the text without any workspace mutation.

**Exact component/function where invalid/empty action output becomes accepted:**

`services/ai-service/src/ai-execution/file-actions.parser.ts` — `extractFileActionsFromOutput()` returns `{ fileActions: [] }` silently when no fenced block or JSON object is found.

Combined with:

`services/ai-service/src/worker/worker.processor.ts` — lines 1031–1040: UPDATE to `completed` status unconditionally after provider success, with no file-action validation.

**Why execution still becomes `completed`:**

The completion condition is provider HTTP success only. There is no validation that checks:
- Whether the prompt requested file actions
- Whether the parser found any actions
- Whether `fileActions.length > 0` when expected

**Why no downstream workspace mutation occurs:**

`fileActions: []` → `publishFileActions(id, [])` → frontend receives `[]` → `applySequentialFileActions({ actions: [] })` → zero-iteration loop → nothing written.

---

## 21. Root-Cause Verdict

### ROOT CAUSE PROVEN

**Root cause:** The Builder plain execution path uses a **PROMPT-ONLY** structured-output contract with **no validation, no retry, and silent acceptance** of non-compliant model responses as valid completed executions.

**Mechanism:**

1. The system prompt instructs the model to emit `` ```file-actions `` blocks for file-creation requests
2. The xAI adapter does NOT use structured output enforcement (`response_format`, `tools`, JSON mode)
3. When Grok 4.5 responds with prose-only text for a complex file-creation request, the parser silently returns `fileActions: []`
4. The worker marks the execution `completed` without validating whether the expected file actions were produced
5. Credits are deducted; workspace remains empty; user sees text but no file

**Contributing factor (NOT the root cause itself):**

The model's tendency to respond with a description rather than the structured block increases with request complexity. Simple one-line file requests succeeded; complex HTML generation requests triggered the prose-only response.

**Model-specificity verdict:** `RESPONSE-FORM-SPECIFIC`

This is NOT proven to be Grok-4.5-specific. Any model on the prompt-only contract can produce the same failure by returning prose instead of the structured block. The contract weakness is model-agnostic; the manifestation is response-form-specific (complex requests are more likely to trigger non-compliance).

---

## 22. Smallest 03B Fix Boundary

The minimal fix is a **combination of (B) + (D)**:

### (B) Output validation that rejects empty actions for likely mutation intent

Add post-extraction validation that can detect when:
- The user prompt clearly requests file creation/modification/deletion
- The model response mentions file intent ("Creating...", "index.html", etc.)
- But `fileActions === []`

And either:
- Retry with a more explicit prompt ("You must emit the file-actions block")
- Mark execution with a distinct status (e.g., `completed_no_actions`) instead of unconditional `completed`

### (D) Execution-status semantics improvement

Distinguish between:
- `completed` — provider succeeded AND expected actions were produced
- `completed_no_actions` — provider succeeded but no file actions when they were expected (or simply: retry before marking complete)

### Also strongly recommended: (A) Structured output enforcement

The most robust long-term fix is to use xAI's structured output capability (`response_format: { type: "json_schema", ... }` or tool/function calling) to **enforce** the file-action format at the API level, removing the dependency on prompt compliance.

### Recommended minimum viable fix for 03B

1. **Detection:** After `extractFileActionsFromOutput()` returns, check if output text contains file-creation-intent signals (mentions creating/writing files by name) but `fileActions === []`
2. **Retry:** Issue one follow-up provider call with a repair prompt: "Your previous response described file creation but did not include the required `` ```file-actions `` block. Please return the structured file-action block now."
3. **Status:** If retry also fails to produce actions, mark execution with appropriate warning metadata rather than silent success
4. **Logging:** Add a diagnostic log/metric when parser returns `[]` but output contains file-intent language

---

## 23. Files Likely Affected by 03B

| File | Expected change |
|------|-----------------|
| `services/ai-service/src/worker/worker.processor.ts` | Add post-extraction validation + retry logic |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | Add output-intent detection helper (optional) |
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | Possibly no change if retry is worker-level |
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | (Optional) add `response_format` support for structured output |
| `services/ai-service/src/ai-execution/__tests__/file-actions.parser.spec.ts` | Add intent-detection tests |
| New test file: `services/ai-service/src/worker/__tests__/worker-file-action-validation.spec.ts` | New tests for retry/validation |

---

## 24. Tests Required for 03B

| Test scenario | Type |
|---------------|------|
| Explicit create-file request + prose-only model response → retry triggered | Unit + integration |
| Explicit create-file request + empty action payload after retry → appropriate status/warning | Unit + integration |
| Malformed `` ```file-actions `` block (invalid JSON) → parser returns `[]`, retry triggered | Unit |
| Valid `` ```file-actions `` block → no retry, normal completion | Unit (regression) |
| Legitimate conversational response with zero actions → no retry | Unit |
| Completion status semantics: `completed` only when actions match intent | Integration |
| No workspace write when validation fails + retry exhausted | Integration |
| No false success surfaced to frontend when actions missing | Integration |
| Credits deduction behavior with failed-action-extraction (policy deferred but test boundaries) | Integration |
| Parser intent-detection helper for file-creation language | Unit |

---

## 25. Explicit Non-Goals

- 03A does NOT implement any fix
- 03A does NOT modify source code
- 03A does NOT register 03B/03C/03D
- 03A does NOT register PRIVATE-BETA-INVITE-01
- 03A does NOT modify TASKS.md or TASKS_BACKLOG_FULL.md
- 03A does NOT determine credit refund policy (→ 03D)
- 03A does NOT diagnose Grok 4.2 timeouts (→ 03C)
- 03A does NOT investigate duplicate submission (no evidence supports one)

---

## 26. Safety Confirmation

| Safety item | Status |
|-------------|--------|
| `GLOBAL_EXECUTION_ENABLED` | `false` — verified via staging `.env` |
| Source files modified | NONE |
| Tests modified | NONE |
| `.env` modified | NONE |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| Browser execution run | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Migrations run | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| TASKS.md modified | NO |
| TASKS_BACKLOG_FULL.md modified | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| 03B/03C/03D registered | NO |
| PRIVATE-BETA-INVITE-01 touched | NO |

---

## 27. Exact Next Recommendation

**Next step:**

`PRIVATE-BETA-BLOCKER-03A Step 3 — Consolidation / Checkpoint`

This consolidation should:
1. Lock the diagnosis findings
2. Confirm root-cause-proven status
3. Record the exact failure boundary and 03B fix scope
4. Prepare handoff to 03B implementation

After 03A Step 3 consolidation:
- Register and execute `PRIVATE-BETA-BLOCKER-03B — File-Action Reliability Fix`
- Do NOT re-enable `GLOBAL_EXECUTION_ENABLED` until 03B is proven
- Do NOT register PRIVATE-BETA-INVITE-01
- Do NOT declare Builder-first private-beta GO

---

*Diagnosis document created: 2026-08-10 — PRIVATE-BETA-BLOCKER-03A Step 2 — read-only diagnosis only — no source/runtime mutation.*
