# BUILDER-INTENT-01 — Stage-Start: Ask/Discuss vs Build/Edit Execution Intent

**Task ID:** BUILDER-INTENT-01
**Step:** Step 2 — Intent Contract + UX Stage-Start
**Status:** STAGE-START COMPLETE
**Created:** 2026-08-11
**Author:** Cursor / Opus 4.6 (read-only design only; no source modification; no runtime mutation)

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | BUILDER-INTENT-01 |
| Title | Ask/Discuss vs Build/Edit Execution Intent |
| Step | Step 2 — Intent Contract + UX Stage-Start |
| Priority | P0 — beta product blocker |
| Risk | READ-ONLY DESIGN — no runtime or source changes in Step 2 |
| Safety state | `GLOBAL_EXECUTION_ENABLED=false` throughout |
| PRIVATE-BETA-INVITE-01 | untouched / unregistered |
| 03C / 03D | NOT REGISTERED |

---

## 2. Predecessor 03B State

**PRIVATE-BETA-BLOCKER-03B — COMPLETE AND LOCKED — 2026-08-11 — PASS**

03B established:

- xAI `response_format: { type: "json_object" }` for structural output reliability
- structured JSON response contract (`assistantText`, `fileActions`, advisory `workspaceMutationAttempted`)
- application-owned plain-path mutation rule: `!useHarness && safeFileActions.length === 0` → `failed` / `file_action_contract_failure`
- `workspaceMutationAttempted` is advisory/diagnostic only — not authoritative
- no content-repair retry
- Harness path unchanged

This is correct and must not be reverted or weakened.

The limitation exposed by 03B: a legitimate conversational question such as "Explain what HTML is" also fails because zero file actions are produced on the plain path.

---

## 3. Product Requirement

Keith explicitly requires Builder to support BOTH:

### Ask / Discuss
- conversational AI response
- zero file actions allowed
- no workspace mutation required
- normal completed response

### Build / Edit
- workspace mutation required
- at least one valid safe file action
- zero actions must remain `file_action_contract_failure`

The distinction must be APPLICATION-OWNED. The provider/model cannot authoritatively decide which mode the request belongs to.

---

## 4. Current Builder Product Semantics

### Is Builder intended as a general conversational coding assistant?

**YES — with constraints.** The PRD §C defines Builder's core loop as a workspace-mutation pipeline. However, Keith explicitly wants Ask/Discuss as a product capability. The current PRD describes the Build/Edit pipeline but does not prohibit conversational-only usage. Builder is the primary user interaction surface for the workspace, and users naturally need to ask questions, discuss architecture, and request explanations without modifying files.

### Can users naturally ask explain/discuss/suggest without modifying files?

**YES — this is the desired product behavior.** The 03B limitation that blocks this is intentional as a safety measure, not the desired final product state.

### Is Build/Edit currently distinguishable from Ask/Discuss through existing application state?

**NO.** There is no existing mechanism.

### Does the current UI contain submit modes, buttons, or intent discriminators?

**NO.** The current UI has:

- A single `<textarea>` for prompt input (`workspace-chat-prompt-input`)
- A single submit path (`handleSubmitChatPrompt` → `POST /api/ai/execute`)
- A model/provider selector dropdown
- An orchestration toggle (separate from intent)
- No Ask/Build toggle, mode selector, or intent discriminator

The request payload sent to `POST /api/ai/execute` contains:

```typescript
{
  prompt: string;
  provider: string;
  model: string;
  sessionId: string;
  conversationId: string;
  workspaceContext?: WorkspaceContext;
}
```

No `executionIntent`, `chatMode`, `executionMode`, or equivalent field exists anywhere in the current request path.

---

## 5. Current Execution Request End-to-End Trace

### Frontend → API Gateway → Queue → Worker → Provider → Completion

```
1. Frontend: handleSubmitChatPrompt()
   → POST /api/ai/execute with { prompt, provider, model, sessionId, conversationId, workspaceContext }
   File: frontend/app/[locale]/app/page.tsx (line ~4326)

2. API Gateway: AIExecutionController.execute()
   → guards: SessionOrApiKeyAuth, Authorization, ExecutionSafety, Launch, Abort,
     Idempotency, CreditBalance, Quota, TokenQuota, RateLimit
   → resolveProviderAndModel()
   → usageLedgerService.writeExecutionIntent() (status='pending')
   → queueService.enqueueExecution() (BullMQ job)
   → return { executionId, status: 'queued' }
   File: services/api-gateway/src/ai/ai-execution.controller.ts (line ~386)

3. BullMQ Job Payload (AiExecutionJob):
   { executionId, userId, apiKeyId, sessionId, conversationId,
     provider, adapter, prompt, workspaceContext, model,
     globalInstructions, projectInstructions, harnessVersion?, ... }
   File: services/ai-service/src/queue/job.types.ts

4. AI Service WorkerProcessor: claims job
   → UPDATE usage_records SET execution_status='running'
   → compute useHarness = job.data.harnessVersion === 'v1' && config.enableToolLoop
   → buildExecutionPromptParts() → { system, user } prompt
   → buildAIExecutionRequest()
   File: services/ai-service/src/worker/worker.processor.ts (line ~569)

5. AIExecutionService.execute():
   → resolveProviderModelOrThrow()
   → getAdapter() → XAIAdapter (or other)
   → adapter.execute(request)
   → extractFileActionsFromOutput(result.output)
   → return { output, tokensUsed, model, fileActions, parseMethod, workspaceMutationAttempted }
   File: services/ai-service/src/ai-execution/ai-execution.service.ts

6. XAIAdapter.execute():
   → append XAI_STRUCTURED_JSON_OUTPUT_CONTRACT to system prompt
   → client.chat.completions.create({ response_format: { type: 'json_object' }, ... })
   → transformResponse()
   File: services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts

7. extractFileActionsFromOutput():
   → try parseStructuredJsonPayload() first
   → fallback: fenced block regex
   → fallback: top-level file-actions JSON
   → else: parseMethod='none', fileActions=[]
   File: services/ai-service/src/ai-execution/file-actions.parser.ts

8. Back in WorkerProcessor:
   → safeFileActions = aiResult.fileActions || []
   → contractValidation = validatePlainPathFileActionContract({ useHarness, safeFileActionCount })
   → IF contractValidation.isContractFailure:
       → publishToken, publishFileActions, publishCompletion
       → UPDATE usage_records SET execution_status='failed'
       → return (no credit deduction)
   → ELSE:
       → publishToken, publishFileActions, publishCompletion
       → UPDATE usage_records SET execution_status='completed'
       → apiGatewayHttpClient.notifyExecutionComplete() (credit deduction)
   File: services/ai-service/src/worker/worker.processor.ts (line ~992)

9. Frontend:
   → SSE stream: GET /api/ai/executions/:id/stream
   → Poll: GET /api/ai/executions/:id
   → On completed + fileActions: apply workspace mutations
   → On failed: setChatRequestState('failed'), show error
   File: frontend/app/[locale]/app/page.tsx (line ~3851, ~4490)
```

### Existing Intent Signal Finding

**Answer: NO — no authoritative intent signal exists in the current request path.**

| Layer | Intent field? | Finding |
|-------|--------------|---------|
| Frontend submit | None | Sends prompt, provider, model, sessionId, workspaceContext. No intent. |
| API Gateway DTO (`AIExecutionRequest`) | None | No `executionIntent` or `chatMode` field |
| API Gateway controller | None | No intent validation or routing |
| BullMQ job payload (`AiExecutionJob`) | None | No intent field |
| WorkerProcessor | None | Determines path via `useHarness` only |
| AIExecutionService | None | Delegates to adapter + parser. No intent. |
| Parser | None | Returns `fileActions: []` identically for conversation and failed mutation |
| Completion logic | None | Contract validation is binary: `!useHarness && safeFileActions.length === 0` |

---

## 6. Existing Intent Signal Finding

**NO — no field currently exists that could authoritatively carry execution intent.**

The only existing path discriminator is `useHarness` (computed from `harnessVersion` + config), which distinguishes plain vs harness execution. It does not distinguish Ask vs Build within the plain path.

---

## 7. Candidate Mechanisms Evaluated

### Option A — Explicit Builder mode selected by user (Ask | Build)

User selects intent directly via a UI control adjacent to the composer.

| Criterion | Evaluation |
|-----------|------------|
| Clarity | HIGH — user explicitly chooses what they want |
| Reliability | HIGH — application-owned, deterministic |
| UX overhead | LOW — segmented control is one click; default reduces switching |
| Default state | Build (preserves 03B safety for existing/legacy callers) |
| Mobile behavior | Segmented control fits at 390px with short labels |
| Multilingual impact | Two translation keys per locale |
| Frequent switching | Moderate — users switching between questions and builds may need to toggle |
| Mode persistence | Sticky per session; resets to default on new session |

**Verdict: SELECTED — clearest, most reliable, smallest bounded UX.**

### Option B — Existing explicit application action

**NOT VIABLE.** No existing UI action distinguishes Ask from Build. The current interface has a single undifferentiated text input and submit action.

### Option C — Intent inferred from application context

Could infer from whether the user is in the code editor vs chat panel, or from workspace state. However, the current UI does not have an unambiguous context boundary that maps to intent. Users chat from the same composer regardless of whether they want to build or discuss.

**Verdict: REJECTED — no deterministic, application-owned context boundary exists.**

### Option D — Model/LLM intent classification

The provider/model classifies whether the prompt is a build request or a question.

**Verdict: REJECTED — 03B exists specifically because model self-declaration is not authoritative. Adding a separate classification model call adds cost, latency, and is probabilistic. The 03B authority correction explicitly prohibits this approach.**

### Option E — Keyword/regex classification

Classify prompts via keywords like "create", "build", "explain", "what is".

**Verdict: REJECTED — high false positive/negative risk. "Explain how to create a REST API" contains "create" but is a question. "Make this better" contains no file keywords but is a build request. Too brittle for a safety-critical contract.**

---

## 8. Selected Authoritative Intent Owner

**Option A — Explicit user-selected mode (Ask | Build) with application-owned contract.**

The user selects the mode. The application carries it through the entire request path. The provider/model cannot override it. The application validates the result against the declared intent.

This is the smallest reliable mechanism that:

1. Preserves 03B safety for Build/Edit (zero actions = failure)
2. Permits legitimate Ask/Discuss (zero actions = success)
3. Is application-owned (user selection, not model classification)
4. Does not require a secondary model call
5. Does not require keyword heuristics
6. Is deterministic and testable

---

## 9. Selected UX — Explicit Mode Control

### Control type: Segmented control

A two-segment control adjacent to the composer's submit area:

```
[ Ask ]  [ Build ]
```

### Label choice

After inspecting existing UI vocabulary:

- `en.json` uses "Ask" in `ai.prompt` ("Ask the assistant..."), `ai.chatInputPlaceholder` ("Ask the assistant for help..."), and `ai.askMeToCreate` ("Ask me to create files...")
- `en.json` uses "Build" in `landing.hero` ("Build anything"), `workspace.buildAnything`, `workspace.describeBuild`
- The existing vocabulary already uses "Ask" and "Build" as established product terms

**Selected labels: `Ask` | `Build`**

These are:
- Concise (3-5 characters — fits mobile at 390px)
- Already established in the product vocabulary
- Unambiguous in context
- Easily translatable to `zh-TW` and `zh-CN`

### Desktop behavior

- Segmented control positioned to the left of the submit button in the composer row (`workspace-chat-composer-row`)
- Two segments: Ask (left), Build (right)
- Selected segment has visual emphasis (filled background, distinct text color)
- Unselected segment is subdued but clearly interactive
- No tooltip required — labels are self-explanatory

### Mobile behavior (390px)

- Same segmented control; compact fit
- Labels "Ask" and "Build" are short enough for 390px
- No truncation needed

### Keyboard submit behavior

- Enter/Shift+Enter submits with the currently selected mode
- No keyboard shortcut to switch mode (avoid accidental switching)
- Mode switch is mouse/touch only

### Discoverability

- Always visible in the composer area
- No hidden dropdown or settings page
- Clear visual state indicating which mode is active

### Accidental wrong-mode risk

- Mitigated by sticky persistence: mode does not reset between messages
- Mitigated by clear visual emphasis on the active mode
- If user asks a question in Build mode: they get a contract failure and see the assistant's text — they can switch to Ask and retry
- If user builds in Ask mode: they get a completed response with the assistant's text but no file actions are applied (safe — no accidental mutation)

### Default mode

**Build** (see §11)

### Mode persistence

- **Sticky per session**: once the user switches mode, it persists for the remainder of that session's messages
- **Resets to default (Build) on new session**: each new project opening starts in Build mode
- **Per-message override**: the mode at the time of submit is what applies to that specific execution
- Mode is NOT persisted to the database; it is frontend-local session state

---

## 10. Selected Intent Contract

### Field name: `executionIntent`

After reviewing existing conventions:

- `harnessVersion` is the existing path discriminator in the job payload (string)
- `executionIntent` follows the same naming pattern: a typed discriminator field
- Alternatives considered: `chatMode`, `executionMode`, `builderMode`, `requestIntent`
- `executionIntent` is the most semantically precise: it describes the intent of this specific execution request

### TypeScript type

```typescript
export type ExecutionIntent = 'conversation' | 'workspace_mutation';
```

Values:
- `conversation` — Ask/Discuss mode: zero file actions are normal completion; workspace must not be mutated
- `workspace_mutation` — Build/Edit mode: at least one valid safe file action required; zero actions is contract failure

### Why these values (not "ask"/"build")

- `conversation` and `workspace_mutation` describe the execution contract semantics, not the UI labels
- UI labels can change (Ask→Discuss, Build→Generate) without changing the contract
- The contract layer should be semantically descriptive, not coupled to UI copy

### DTO representation

**API Gateway `AIExecutionRequest`** (in `services/api-gateway/src/clients/ai-service-http.client.ts`):

```typescript
export interface AIExecutionRequest {
  // ... existing fields ...
  executionIntent?: ExecutionIntent;
}
```

Optional with backward-compatible default when absent.

### Queue/job representation

**`AiExecutionJob`** (in `services/ai-service/src/queue/job.types.ts`):

```typescript
export interface AiExecutionJob {
  // ... existing fields ...
  executionIntent?: 'conversation' | 'workspace_mutation';
}
```

### AI Service representation

No new type needed — the job payload carries the field directly to WorkerProcessor.

### Default behavior when absent

**`workspace_mutation`** — see §11 for rationale.

### Persistence/metadata

The `executionIntent` value is recorded in `usage_records.metadata.executionIntent` for diagnostics and audit. No new database column or migration required.

---

## 11. Default Intent — Backward Compatibility

### Selected default: `workspace_mutation`

When `executionIntent` is absent from the request:

- Treat as `workspace_mutation`
- Apply the 03B mutation-required validation rule: `!useHarness && safeFileActions.length === 0` → `failed`

### Rationale

| Candidate | Pros | Cons | Verdict |
|-----------|------|------|---------|
| Default `workspace_mutation` | Preserves 03B safety for all existing callers; old frontend clients, tests, admin tools, and harness all behave identically to current proven behavior; no regression risk | Old conversational prompts still fail (but they already fail under 03B, so this is not a regression) | **SELECTED** |
| Default `conversation` | Questions stop failing without frontend update | Old Build/Edit requests silently stop requiring mutation — weakens 03B protection; a non-upgraded client could send build requests that complete with zero actions | REJECTED |
| Required field / reject missing | Strongest contract | Breaking change for all existing callers; requires coordinated frontend + backend deployment | REJECTED |

**The 03B safety guarantee is weighted heavily.** `workspace_mutation` as default means:

1. All existing callers (frontend, tests, admin, harness, public API) continue to work identically
2. 03B protection is preserved for any caller that does not explicitly opt into conversation mode
3. Only callers that explicitly send `executionIntent: 'conversation'` get the relaxed behavior
4. A stale frontend cannot accidentally bypass mutation validation

---

## 12. Conversation Completion Semantics

When `executionIntent === 'conversation'` (or resolved as conversation):

| Condition | Status | Actions applied? | Workspace mutates? |
|-----------|--------|-----------------|---------------------|
| Prose + zero file actions | `completed` | No | No |
| Structured text + zero file actions | `completed` | No | No |
| Provider transport failure | `failed` | No | No |

The conversation mode represents a strict non-mutating contract:

- `assistantText` is allowed and displayed to the user
- `fileActions` must NOT be applied to the workspace, even if the model unexpectedly emits them (see §14)
- No `file_action_contract_failure` — zero actions is normal for conversation

---

## 13. Build/Edit Completion and Failure Semantics

When `executionIntent === 'workspace_mutation'` (or resolved as workspace_mutation / default):

| Condition | Status | Actions applied? | Error code |
|-----------|--------|-----------------|------------|
| Valid safe actions > 0 | `completed` | Yes | None |
| Zero valid safe actions | `failed` | No | `file_action_contract_failure` |
| Prose only / malformed output | `failed` | No | `file_action_contract_failure` |
| Unsafe actions filtered to zero | `failed` | No | `file_action_contract_failure` |
| Provider advisory `workspaceMutationAttempted=false` but zero actions | `failed` | No | `file_action_contract_failure` |
| Provider transport failure | `failed` | No | (existing error) |

**This is the exact 03B behavior, preserved without regression.**

---

## 14. Conversation Unexpected-Action Safety

### Chosen behavior: Discard actions and complete with text only

When `executionIntent === 'conversation'` but the provider unexpectedly returns valid file actions:

1. **Do NOT apply the file actions to the workspace**
2. **Set `fileActions` to `[]` in the published events and completion metadata**
3. **Complete with status `completed`**
4. **Display `assistantText` to the user**
5. **Log diagnostic**: `file_action.conversation_mode_actions_discarded` with `{ executionId, discardedActionCount, originalActionCount }`

### Rationale

A user selecting Ask/Discuss reasonably expects: **no files will change.**

If we allowed unexpected actions through, a model could mutate the workspace against the user's explicit intent selection. This violates the non-mutating contract.

If we failed with a contract error, the user would see a failure for what should be a simple question — poor UX.

Discarding and completing with text is the safest behavior:
- User gets their answer
- Workspace is not mutated
- The unexpected actions are logged for diagnostics
- No false success (for Build) or false failure (for Ask)

### Alternatives rejected

| Alternative | Why rejected |
|-------------|-------------|
| Allow/apply actions in Ask mode | Violates non-mutating contract; accidental workspace mutation |
| Terminal contract failure | User sees failure for a question; poor UX |
| Return actions but don't apply | Confusing frontend state; actions visible but not applied |

---

## 15. Provider/Prompt Contract

### Conversation mode

The AI Service should NOT modify the system prompt based on execution intent. The same structured JSON prompt is sent regardless of intent.

Rationale:
- The model should still be free to suggest file actions in its response — the application will discard them in conversation mode
- Changing the prompt per intent adds complexity and a new failure mode (what if the prompt change causes unexpected behavior?)
- The application owns the enforcement, not the prompt

The existing `XAI_STRUCTURED_JSON_OUTPUT_CONTRACT` and `FILE_ACTION_OUTPUT_CONTRACT` remain unchanged.

### Build/Edit mode

Preserve existing structured JSON/file-action contract from 03B.

### `response_format: { type: "json_object" }` compatibility

**Preserved.** Both conversation and workspace_mutation executions use the same structured JSON response format. The parser extracts `assistantText` and `fileActions` identically. The difference is in WorkerProcessor's validation/enforcement logic, not in the provider interaction.

---

## 16. Structured JSON Compatibility

The structured JSON response contract remains identical for both intents:

```json
{
  "assistantText": "...",
  "workspaceMutationAttempted": true|false,
  "fileActions": [...]
}
```

- `assistantText` is always used (displayed to user in both modes)
- `fileActions` is parsed in both modes; discarded in conversation mode
- `workspaceMutationAttempted` remains advisory/diagnostic only in both modes
- `parseMethod` reporting is unchanged
- Legacy fenced-block compatibility is unchanged

---

## 17. API Gateway Propagation

### Request DTO changes

Add optional `executionIntent` to `AIExecutionRequest` in `services/api-gateway/src/clients/ai-service-http.client.ts`:

```typescript
export interface AIExecutionRequest {
  // ... existing fields ...
  executionIntent?: 'conversation' | 'workspace_mutation';
}
```

### Controller validation

In `AIExecutionController.execute()`:

- Accept `executionIntent` from request body
- Validate: if present, must be one of `'conversation'` or `'workspace_mutation'`
- If absent or invalid: treat as `'workspace_mutation'` (default)
- Pass through to job payload

### Job enqueue serialization

In `queueService.enqueueExecution()` call, add:

```typescript
...(request.executionIntent !== undefined && { executionIntent: request.executionIntent }),
```

No structural change to the queue service itself — just an additional optional field in the job payload.

---

## 18. Queue/Job Propagation

### Job type field

Add to `AiExecutionJob`:

```typescript
executionIntent?: 'conversation' | 'workspace_mutation';
```

### Backward-compatible default

When `executionIntent` is absent from the job data (older queued jobs, legacy callers):

```typescript
const executionIntent = job.data.executionIntent ?? 'workspace_mutation';
```

Older queued jobs execute safely under the existing 03B validation rule.

### Type validation

WorkerProcessor validates at runtime:

```typescript
const validIntents = new Set(['conversation', 'workspace_mutation']);
const executionIntent = validIntents.has(job.data.executionIntent)
  ? job.data.executionIntent
  : 'workspace_mutation';
```

Invalid values fall back to `workspace_mutation` (safe default).

### No migration or queue architecture change required

The BullMQ job payload is JSON — additional optional fields are naturally backward-compatible.

---

## 19. AI Service Semantic Rule (WorkerProcessor)

### Corrected application-owned rule

Replace the current 03B validation:

```
IF !useHarness AND safeFileActions.length === 0:
  → failed / file_action_contract_failure
```

With the intent-aware validation:

```
Resolve executionIntent from job.data (default: 'workspace_mutation')

IF executionIntent === 'conversation':
  IF safeFileActions.length > 0:
    → Discard file actions (set safeFileActions = [])
    → Log diagnostic: file_action.conversation_mode_actions_discarded
  → completed (normal conversational response)

IF executionIntent === 'workspace_mutation' AND !useHarness:
  IF safeFileActions.length === 0:
    → failed / file_action_contract_failure
  ELSE:
    → completed (normal mutation success)

IF useHarness:
  → Harness-owned validation (unchanged)
```

### Key semantic boundaries

1. **Conversation mode**: zero actions = `completed`; unexpected actions = discarded and logged
2. **Workspace mutation mode**: zero actions = `failed` (03B preserved); valid actions = `completed`
3. **Harness path**: unchanged — plain-path validation does not apply
4. **Intent authority**: `executionIntent` from the job payload, not from the model

### `validatePlainPathFileActionContract` function update

Extend to accept execution intent:

```typescript
export function validatePlainPathFileActionContract(input: {
  useHarness: boolean;
  safeFileActionCount: number;
  executionIntent: 'conversation' | 'workspace_mutation';
}): FileActionContractValidationResult {
  if (input.executionIntent === 'conversation') {
    return {
      isContractFailure: false,
      finalContractResult: 'passed',
    };
  }
  if (!input.useHarness && input.safeFileActionCount === 0) {
    return {
      isContractFailure: true,
      finalContractResult: 'failed',
      errorCode: FILE_ACTION_CONTRACT_FAILURE_CODE,
      errorMessage: FILE_ACTION_CONTRACT_FAILURE_MESSAGE,
    };
  }
  return {
    isContractFailure: false,
    finalContractResult: 'passed',
  };
}
```

---

## 20. Frontend Rendering/Apply Behavior

### Conversation completed

- Status `completed`
- `output` (assistantText) displayed in chat thread
- `fileActions: []` — no workspace apply step
- No file tree refresh triggered
- No checkpoint creation triggered
- Normal completed UX (no error banner)

The existing frontend code at `page.tsx` line ~4490:

```typescript
if (nextStatus === 'failed' || nextStatus === 'cancelled' || nextStatus === 'timeout') {
  setChatRequestState('failed');
  ...
}
```

For conversation completed, `nextStatus === 'completed'` and `fileActions` is empty. The existing frontend code handles this correctly — it shows the output text and skips file action application when `fileActions` is empty. **No frontend rendering logic change required for this path.**

### Build/Edit completed with actions

Existing behavior preserved: status `completed`, file actions applied to workspace, file tree/editor/preview refreshed, checkpoint created.

### Build/Edit failure (contract failure)

Existing behavior preserved: status `failed`, error message shown, no workspace mutation.

### Frontend mode control

New: segmented control component in workspace-shell composer area. Details in §9. Frontend local state, not persisted.

---

## 21. Harness Separation

Harness path (`useHarness === true`) remains unchanged.

The `executionIntent` field:
- Is present in the job payload but does NOT change harness behavior
- Harness path bypasses the plain-path file-action contract validation entirely (existing `useHarness` check)
- If the harness is activated via `harnessVersion: 'v1'`, the `executionIntent` field has no effect on the harness tool-use loop

**03B Harness separation remains intact.**

---

## 22. Multilingual/UI Requirements

### New translation keys required

**`en.json`:**
```json
{
  "ai": {
    "intentAsk": "Ask",
    "intentBuild": "Build",
    "intentAskTooltip": "Get answers without changing files",
    "intentBuildTooltip": "Create or modify workspace files"
  }
}
```

**`zh-TW.json`:**
```json
{
  "ai": {
    "intentAsk": "提問",
    "intentBuild": "建構",
    "intentAskTooltip": "不修改檔案，直接取得回答",
    "intentBuildTooltip": "建立或修改工作區檔案"
  }
}
```

**`zh-CN.json`:**
```json
{
  "ai": {
    "intentAsk": "提问",
    "intentBuild": "构建",
    "intentAskTooltip": "不修改文件，直接获取回答",
    "intentBuildTooltip": "创建或修改工作区文件"
  }
}
```

### Tooltip decision

Tooltips are included for discoverability. They explain what each mode does in a single sentence. They must be translated.

### Icons

No additional icons required. The segmented control uses text labels only. "Ask" and "Build" are short, clear, and unambiguous without icons.

---

## 23. Exact Behavioral Matrix

### Conversation intent (`executionIntent === 'conversation'`)

| # | Case | Expected status | Actions applied? | Workspace mutates? | Error code |
|---|------|----------------|-----------------|---------------------|------------|
| 1 | Prose + zero actions | `completed` | No | No | None |
| 2 | Structured text + zero actions | `completed` | No | No | None |
| 3 | Model unexpectedly emits one valid action | `completed` | **No — discarded** | No | None (logged) |
| 4 | Model emits malformed actions | `completed` | No (parser rejects) | No | None |
| 5 | Provider transport failure | `failed` | No | No | (transport error) |

### Workspace mutation intent (`executionIntent === 'workspace_mutation'`)

| # | Case | Expected status | Actions applied? | Workspace mutates? | Error code |
|---|------|----------------|-----------------|---------------------|------------|
| 6 | One valid action | `completed` | Yes | Yes | None |
| 7 | Multiple valid actions | `completed` | Yes | Yes | None |
| 8 | Zero actions | `failed` | No | No | `file_action_contract_failure` |
| 9 | Prose only | `failed` | No | No | `file_action_contract_failure` |
| 10 | Malformed response | `failed` | No | No | `file_action_contract_failure` |
| 11 | Unsafe actions filtered to zero | `failed` | No | No | `file_action_contract_failure` |
| 12 | Provider advisory `workspaceMutationAttempted=false` but zero actions | `failed` | No | No | `file_action_contract_failure` |

### Missing intent (legacy/existing callers)

| # | Case | Expected status | Behavior |
|---|------|----------------|----------|
| 13 | Existing/legacy caller omits `executionIntent` | Treated as `workspace_mutation` | 03B behavior preserved exactly |

### Harness

| # | Case | Expected status | Behavior |
|---|------|----------------|----------|
| 14 | Harness execution (any intent value) | Harness-owned | Plain-path validation NOT applied; intent field ignored |

---

## 24. Accounting Interaction

### Conversation completed

Normal completed execution: `notifyExecutionComplete()` is called. Credit deduction proceeds via existing `triggerDeductionForExecution()`. Status is `completed` → deduction triggered.

This is consistent with current behavior: the user consumed AI tokens and received value (an answer). The execution is legitimately completed.

### Build/Edit completed

Normal completed deduction. No change from current behavior.

### Build/Edit contract failure

Current 03B failure path: status `failed` → `notifyExecutionComplete()` NOT called → credits NOT deducted via `skipped_non_completed` logic.

**No change from current 03B behavior.** 03D remains the authoritative future policy task for failed execution accounting.

### Summary

| Outcome | Status | Deduction triggered? |
|---------|--------|---------------------|
| Ask/Discuss completed | `completed` | YES |
| Build/Edit completed with actions | `completed` | YES |
| Build/Edit contract failure | `failed` | NO |
| Transport/provider failure | `failed` | NO |
| Timeout | `timeout` | NO |
| Cancelled | `cancelled` | NO |

---

## 25. Exact Step 3 Source Files

### REQUIRED (source)

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-shell.tsx` | Add segmented Ask/Build control in composer area; add `executionIntent` prop threading |
| `frontend/app/[locale]/app/page.tsx` | Add `executionIntent` state; pass to execution request payload; thread through workspace-shell props |
| `frontend/messages/en.json` | Add `ai.intentAsk`, `ai.intentBuild`, `ai.intentAskTooltip`, `ai.intentBuildTooltip` |
| `frontend/messages/zh-TW.json` | Same keys, Traditional Chinese |
| `frontend/messages/zh-CN.json` | Same keys, Simplified Chinese |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Add `executionIntent?` to `AIExecutionRequest` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Accept, validate, and propagate `executionIntent` to job payload |
| `services/ai-service/src/queue/job.types.ts` | Add `executionIntent?` to `AiExecutionJob` |
| `services/ai-service/src/worker/worker.processor.ts` | Resolve `executionIntent`; update `validatePlainPathFileActionContract` to accept intent; implement conversation-mode action discarding + diagnostics |

### TEST ONLY

| File | Change |
|------|--------|
| `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts` | Add intent-aware validation tests (conversation pass, workspace_mutation fail, default behavior, action discarding) |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Add validation test for `executionIntent` field acceptance and propagation |

### NOT EXPECTED

| File | Reason |
|------|--------|
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | No change — intent is handled in WorkerProcessor, not in AIExecutionService |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | No change — parser is intent-unaware |
| `services/ai-service/src/ai-execution/types.ts` | No change — `AIExecutionResult` does not carry intent |
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | No change — adapter does not vary by intent |
| `services/container-manager/` | Not in the execution path for this change |
| Database schema/migration | No new columns — intent stored in existing `metadata` jsonb |

---

## 26. Exact Step 3 Test Matrix

| # | Test case | Expected |
|---|-----------|----------|
| 1 | Ask/Discuss + prose + zero actions → completed | `completed`, no error |
| 2 | Ask/Discuss → no workspace mutation (verify fileActions published as []) | No actions published, workspace unchanged |
| 3 | Ask/Discuss + provider emits file action → action NOT applied (discarded) | `completed`, `fileActions: []` in published events |
| 4 | Build/Edit + valid action → completed | `completed`, actions extracted |
| 5 | Build/Edit + zero actions → failed | `failed`, `file_action_contract_failure` |
| 6 | Build/Edit + malformed output → failed | `failed`, `file_action_contract_failure` |
| 7 | Build/Edit + unsafe-only actions → failed | `failed`, `file_action_contract_failure` |
| 8 | Provider cannot override application intent | `workspaceMutationAttempted` does not affect validation outcome |
| 9 | Intent propagates frontend → API Gateway → job → AI Service | `executionIntent` present in job data and metadata |
| 10 | Safe behavior when intent omitted (defaults to workspace_mutation) | Same as current 03B behavior |
| 11 | 03B structured JSON preserved | `parseMethod: 'structured_json'` for JSON responses |
| 12 | Legacy fenced action support preserved | `parseMethod: 'fenced_block'` for legacy format |
| 13 | Frontend renders conversation response correctly | `completed` with text, no file apply |
| 14 | Frontend applies Build/Edit actions correctly | Actions applied on `completed` with non-empty `fileActions` |
| 15 | Build/Edit failure does not falsely show success | `failed` status shown correctly |
| 16 | Multilingual UI keys exist for Ask/Build control | Keys present in en.json, zh-TW.json, zh-CN.json |
| 17 | Keyboard submit respects selected intent | Enter submits with current mode |
| 18 | Harness unaffected | Harness path ignores `executionIntent` |

### Sticky mode tests

| # | Test case | Expected |
|---|-----------|----------|
| 19 | Mode persists between messages in same session | State retained |
| 20 | Mode resets to Build on new session | Default restored |

---

## 27. Local Offline-Validation Plan

### AI Service targeted tests (offline-safe)

```powershell
# Targeted worker mutation validation tests (BUILDER-INTENT-01 core)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="worker-mutation-validation" --verbose

# Parser tests (unchanged — regression check)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="file-actions.parser" --verbose

# xAI adapter tests (unchanged — regression check)
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="xai-ai.adapter" --verbose
```

### AI Service offline-safe regression (excluding known provider-calling suites)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathIgnorePatterns="ai-execution.phase30c" --verbose
```

The suite `ai-execution.phase30c.spec.ts` contains pre-existing live provider auth/network calls. It must be excluded from offline validation. This is the recorded 03B validation-process lesson.

### API Gateway targeted test

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPattern="ai-execution.controller" --verbose
```

### Build verification

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

### Frontend verification

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

### Requirements

- No Docker/Postgres/Redis required for AI Service/API Gateway unit tests (mocks)
- No provider API calls
- No `.env` changes
- No PM2/SSH required
- Frontend build requires no runtime dependencies

---

## 28. Step 4 Staging Validation Plan

**Do NOT execute now. Define for later.**

### A. Ask/Discuss validation

One request in Ask mode:

> In one short sentence, explain what HTML is.

Expected:
- `executionIntent: 'conversation'` in job payload/metadata
- Status: `completed`
- Visible answer (assistantText) displayed
- `fileActions: []`
- No workspace mutation
- No `file_action_contract_failure`
- Credit deduction triggered (completed execution)

### B. Build/Edit validation

One representative mutation request in Build mode:

> Create a single file named index.html with a simple "Hello World" page.

Expected:
- `executionIntent: 'workspace_mutation'` in job payload/metadata
- Status: `completed`
- Non-empty valid `fileActions`
- Real workspace mutation (`index.html` created)
- Credit deduction triggered

### C. Build/Edit failure protection

Validate original 03B protection without relying on uncontrolled model misbehavior.

**Preferred method:** Deterministic validation through implementation + test evidence from Step 3. The `worker-mutation-validation.spec.ts` tests prove that `executionIntent === 'workspace_mutation'` with zero safe actions produces `failed` / `file_action_contract_failure`.

If a third provider call is needed for live validation, use a prompt that explicitly instructs zero file actions while in Build mode:

> Do not create any files. Simply respond with the text "test".

Expected:
- `executionIntent: 'workspace_mutation'`
- Provider returns zero file actions
- Status: `failed`
- Error code: `file_action_contract_failure`
- No workspace mutation
- No credit deduction

**Keep provider-call count minimal: exactly 2 mandatory (A, B), 1 optional (C).**

### Final gate

`GLOBAL_EXECUTION_ENABLED=false` — restored after validation.

---

## 29. Rollback

### Code rollback

If staging validation fails:

```bash
git revert <BUILDER-INTENT-01-commit-hash>
```

Or for multiple commits:

```bash
git revert --no-commit <oldest-commit>..<latest-commit>
git commit -m "Revert BUILDER-INTENT-01: staging validation failed"
```

### Frontend rollback

The segmented control is a pure frontend addition. Reverting the frontend source removes it. No stale state — the `executionIntent` field is optional and absent callers fall back to `workspace_mutation`.

### Runtime gate rollback

Use the deterministic procedure from 03B (stop API Gateway → edit .env → restart with --update-env → verify runtime value).

### No DB migration rollback expected

No schema changes. `executionIntent` is stored in the existing `metadata` jsonb column.

---

## 30. Risks and Mitigations

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| User selects wrong mode (Ask when they meant Build) | MODERATE | LOW | No workspace mutation occurs — user sees answer text, can retry in Build mode; no data loss |
| User selects wrong mode (Build when they meant Ask) | LOW | LOW | If model returns actions, they apply (intended Build behavior); if model returns zero actions, user gets contract failure and can switch to Ask |
| Ask mode accidentally modifying files | NONE | — | Actions are explicitly discarded in conversation mode before reaching any workspace write path |
| Build mode failing normal questions | EXPECTED (by design) | LOW | This is the 03B contract — user should switch to Ask mode; discoverable via segmented control |
| Intent lost between frontend and worker | LOW | MEDIUM | End-to-end test verifies propagation; intent recorded in metadata for audit |
| Unsafe backward-compatible default | NONE | — | Default is `workspace_mutation` — the safe choice that preserves 03B |
| Existing callers omitted (tests, public API, admin) | LOW | LOW | Default `workspace_mutation` ensures all omitted callers behave identically to current 03B |
| Stale client behavior | LOW | LOW | Stale frontend without the control sends no `executionIntent` → defaults to `workspace_mutation` → safe |
| Provider ignoring Ask constraint | LOW | LOW | Application discards unexpected actions in Ask mode — provider behavior is irrelevant to safety |
| UX clutter | LOW | LOW | Segmented control is minimal (two short labels); no redesign of the composer |
| Mobile layout | LOW | LOW | "Ask" and "Build" are 3-5 characters; fits 390px easily |
| Translation drift | LOW | LOW | Four keys per locale; bounded scope |
| Harness side effects | NONE | — | Harness path explicitly bypasses intent-aware validation; `executionIntent` is ignored for harness |
| Regression of 03B false-success protection | NONE | — | `workspace_mutation` intent preserves exact 03B rule; `conversation` intent is additive, not modifying |

---

## 31. `workspaceMutationAttempted` — Retained Advisory

03B retained `workspaceMutationAttempted` as advisory metadata only.

BUILDER-INTENT-01 does NOT change its role:
- Still extracted by parser
- Still logged in diagnostics
- Still recorded in metadata
- Still NOT authoritative for validation
- Still cannot override application-owned intent

Removing it would cause unnecessary churn in the parser, types, and existing test assertions. Retaining it adds zero risk and preserves diagnostic value.

---

## 32. Explicit Exclusions

BUILDER-INTENT-01 Step 3 must NOT:

- Revert or weaken 03B
- Register 03C / 03D
- Register PRIVATE-BETA-INVITE-01
- Modify TASKS.md or TASKS_BACKLOG_FULL.md
- Modify ARCHITECTURE.md or PRD.md
- Modify CLAUDE.md
- Change `.env` or `GLOBAL_EXECUTION_ENABLED`
- Make provider API calls
- SSH / deploy / restart PM2
- Run Docker/Postgres/Redis
- Mutate DB/Redis
- Add new npm dependencies
- Change execution timeout values
- Add content-repair retry
- Create new execution status values
- Redesign the entire composer/workspace UI
- Change the provider prompt based on intent
- Change other adapter implementations
- Change queue architecture
- Activate Harness
- Change accounting/credit policy (03D scope)
- Add keyword/regex classification
- Add model-based intent classification

---

## 33. Step 3 Acceptance Criteria

| Criterion | Requirement |
|-----------|-------------|
| Ask/Build segmented control added to composer | Visible, interactive, with correct labels |
| Multilingual keys present | `ai.intentAsk`, `ai.intentBuild`, tooltips in en/zh-TW/zh-CN |
| `executionIntent` field in API Gateway DTO | Optional, validated, defaults to `workspace_mutation` |
| `executionIntent` propagated to job payload | Present in `AiExecutionJob` when sent by frontend |
| WorkerProcessor resolves intent | Defaults to `workspace_mutation` when absent |
| Conversation mode: zero actions = completed | No `file_action_contract_failure` |
| Conversation mode: unexpected actions discarded | Actions not applied; diagnostic logged |
| Build mode: zero actions = failed | 03B preservation — `file_action_contract_failure` |
| Build mode: valid actions = completed | Normal success path unchanged |
| Default (absent intent) = workspace_mutation | Backward compatible with all existing callers |
| Intent does not affect Harness path | Harness executions unchanged |
| `workspaceMutationAttempted` remains advisory | Not used in validation condition |
| All AI Service tests pass (offline-safe) | Excluding `ai-execution.phase30c` |
| All API Gateway tests pass | `npm test` |
| Frontend TypeScript compilation clean | `npx tsc --noEmit` |
| Frontend build clean | `npm run build` |
| AI Service build clean | `npm run build` |
| API Gateway build clean | `npm run build` |
| No new lint errors | No regressions |

---

## 34. Final Design Verdict

### **READY FOR BOUNDED IMPLEMENTATION**

### Chosen UX

Segmented control: `Ask` | `Build`, positioned in the workspace chat composer row. Default: **Build**. Sticky per session. No icons.

### Chosen application contract

Field: `executionIntent`
Type: `'conversation' | 'workspace_mutation'`
Default when absent: `'workspace_mutation'`
Location: frontend state → request body → API Gateway → job payload → WorkerProcessor

### Chosen conversation safety rule

Model-emitted actions in Ask mode are **discarded** (not applied, not failed). Execution completes normally with text only. Discarded actions are logged for diagnostics.

### Chosen Build/Edit rule

Exact preservation of 03B:
`executionIntent === 'workspace_mutation' && !useHarness && safeFileActions.length === 0` → `failed` / `file_action_contract_failure`

### Exact end-to-end data path

```
Frontend (segmented control state)
  → executionIntent in POST /api/ai/execute body
  → API Gateway validates + propagates to job payload
  → BullMQ job: executionIntent field
  → WorkerProcessor: resolves intent (default: 'workspace_mutation')
  → validatePlainPathFileActionContract({ useHarness, safeFileActionCount, executionIntent })
  → conversation: complete normally; workspace_mutation: 03B rule
```

### Why rejected alternatives are inferior

| Alternative | Why inferior |
|-------------|-------------|
| Model/LLM classification (Option D) | Same class of failure as E2E-01 — model is not authoritative; adds cost and latency |
| Keyword/regex (Option E) | Brittle, high false positive/negative, not application-owned |
| Inferred from context (Option C) | No deterministic context boundary exists in current UI |
| Default `conversation` | Weakens 03B protection for existing callers |
| Required field / reject missing | Breaking change for all existing callers |
| Fail on unexpected actions in Ask mode | Poor UX — user sees error for a question |
| Allow actions in Ask mode | Violates non-mutating contract |
| Prompt modification by intent | Adds complexity; application should own enforcement, not prompt |

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
| CLAUDE.md modified | NO |
| 03C / 03D registered | NO |
| BUILDER-INTENT-01 implementation started | NO |
| PRIVATE-BETA-INVITE-01 touched | NO |

---

*Stage-start document created: 2026-08-11 — BUILDER-INTENT-01 Step 2 — read-only design only — no source/runtime mutation.*

---

# Step 2A — Frontend Test + Session-State Scope Correction

**Step:** Step 2A — Frontend Test + Session-State Scope Correction
**Status:** DESIGN CORRECTION — no source/runtime modification
**Created:** 2026-08-11
**Author:** Cursor / Opus 4.6 (design correction only; no source modification; no runtime mutation)
**Supersedes:** Step 2 §9 (mode persistence semantics), §25 (Step 3 files — TEST ONLY section), §26 (Step 3 test matrix — incompleteness)

---

## 2A.1 — Exact "Sticky Per Session" Semantics

### State-storage mechanism

**Selected: React `useState` in `page.tsx`, scoped to component mount lifetime.**

Evidence for this choice:

- The existing `isChatOrchestrationEnabled` toggle (`page.tsx` line 975) uses `useState(false)` with no persistence — same UX category as the Ask/Build mode selector
- The `selectedChatModelId` and `selectedChatProviderId` use `useState` with no sessionStorage persistence
- `sessionStorage` is used in the current codebase only for cross-refresh tab state that must survive full page reload: `TAB_SELECTED_SESSION_STORAGE_KEY`, `TAB_SELECTED_PROJECT_STORAGE_KEY`, `TAB_SELECTED_VIEW_STORAGE_KEY`
- The Ask/Build mode does NOT need to survive page refresh — it is a per-interaction preference, not a durable user choice
- Adding `sessionStorage` persistence would add complexity (key management, cleanup, session-ID scoping) without product need

### Implementation

```typescript
const [executionIntent, setExecutionIntent] = useState<'conversation' | 'workspace_mutation'>('workspace_mutation');
```

This is the simplest possible implementation — a single `useState` with the safe default.

### Exact behavioral semantics

| Scenario | Behavior | Rationale |
|----------|----------|-----------|
| New page mount (fresh navigation to Builder) | `workspace_mutation` (Build) | Safe default; preserves 03B behavior |
| User switches Ask → Build | `executionIntent` updates to `workspace_mutation`; next submit uses it | Immediate; no debounce |
| User switches Build → Ask | `executionIntent` updates to `conversation`; next submit uses it | Immediate; no debounce |
| Submitting multiple messages without switching | Each message uses the current `executionIntent` value | Sticky within mount |
| Page refresh (F5 / browser reload) | Resets to `workspace_mutation` (Build) | React state is lost on unmount; this is the safe default |
| Switching to another session (within same page mount) | `executionIntent` is NOT reset | State belongs to the component, not the session; no session-scoping needed |
| Returning to the original session | Same `executionIntent` value as before switching | Component is still mounted; state persists |
| Opening a different project (triggers remount) | Resets to `workspace_mutation` (Build) | Component unmounts and remounts |

### Persistence across browser refresh is NOT required

The mode selector is a lightweight per-interaction preference, like the orchestration toggle. The safe default (`workspace_mutation` / Build) ensures that after any state loss, the user is in the 03B-safe mode. Users must explicitly select Ask if they want conversational mode.

### Step 2 §9 correction

Step 2 stated: "Sticky per session: once the user switches mode, it persists for the remainder of that session's messages. Resets to default (Build) on new session."

**Corrected:** The mode persists for the remainder of the component mount lifetime. It is NOT scoped to a specific session ID. It resets to Build on page refresh or component remount. Switching sessions within the same mount does NOT reset the mode. This matches the existing pattern for `isChatOrchestrationEnabled` and `selectedChatModelId`.

---

## 2A.2 — Current Frontend Testing Pattern

### Established project convention

The frontend uses:

- **Test runner:** Node.js built-in `node:test` via `tsx --test`
- **Assertions:** `node:assert/strict`
- **No external test framework:** No Jest, no Vitest, no Mocha
- **No component-testing library:** No React Testing Library, no Enzyme
- **Pattern:** Pure logic extracted into `*.logic.ts` files, tested in `*.logic.test.ts` files
- **React SSR tests:** `workspace-shell.test.tsx` uses `renderToStaticMarkup` from `react-dom/server` for markup assertions — NOT client-side rendering
- **i18n key validation:** `workspace-shell.test.tsx` reads locale JSON files directly with `readFileSync` and asserts key existence

### Test command

```
npm test → tsx --test components/workspace/*.test.ts* components/public/*.test.ts* lib/auth-module/*.test.ts
```

Tests in `components/workspace/` are automatically included by the glob pattern.

### Existing logic test files (representative examples)

| File | Pattern |
|------|---------|
| `workspace-exec.logic.ts` + `.test.ts` | Pure async function; fetch mock; state assertions |
| `workspace-ai-file-actions.logic.ts` + `.test.ts` | Pure functions; no React; state machine testing |
| `workspace-chat-orchestration.logic.ts` + `.test.ts` | Pure plan builder + formatter; deterministic |
| `workspace-shell.logic.ts` + `.test.ts` | Pure state computation; session/checkpoint logic |

### Smallest testable boundary for BUILDER-INTENT-01

Extract a small pure logic module:

`frontend/components/workspace/workspace-execution-intent.logic.ts`

containing:

1. `ExecutionIntent` type definition and constants
2. `resolveExecutionIntent()` — validates/normalizes a raw intent value to the typed enum
3. `buildExecutionRequestPayload()` — given prompt, provider, model, sessionId, conversationId, executionIntent → returns the request body for `POST /api/ai/execute`
4. `shouldApplyFileActions()` — given executionIntent and fileActions array → returns boolean (false for conversation mode)

These are pure functions — no React, no DOM, no browser APIs. They are testable with `node:test` + `node:assert/strict` using the established convention.

The React state (`useState`) and segmented control rendering remain in `workspace-shell.tsx` and `page.tsx`. They are NOT tested with logic tests — they follow the existing pattern where React rendering is covered by `workspace-shell.test.tsx` SSR assertions.

---

## 2A.3 — Exact Frontend Source/Helper Files Required

### New logic module

**`frontend/components/workspace/workspace-execution-intent.logic.ts`**

Contents:

```typescript
export type ExecutionIntent = 'conversation' | 'workspace_mutation';
export const DEFAULT_EXECUTION_INTENT: ExecutionIntent = 'workspace_mutation';
export const VALID_EXECUTION_INTENTS: ReadonlySet<string> = new Set(['conversation', 'workspace_mutation']);

export function resolveExecutionIntent(raw: unknown): ExecutionIntent {
  if (typeof raw === 'string' && VALID_EXECUTION_INTENTS.has(raw)) {
    return raw as ExecutionIntent;
  }
  return DEFAULT_EXECUTION_INTENT;
}

export function shouldApplyFileActions(
  executionIntent: ExecutionIntent,
  fileActions: unknown[],
): boolean {
  if (executionIntent === 'conversation') {
    return false;
  }
  return fileActions.length > 0;
}

export function buildExecutionPayloadIntent(
  executionIntent: ExecutionIntent,
): { executionIntent: ExecutionIntent } | Record<string, never> {
  return { executionIntent };
}
```

This module:

- Is purely typed — no React, no DOM, no side effects
- Extracts the intent contract into a single importable location
- Is testable with `node:test`
- Follows the existing `*.logic.ts` convention
- Is imported by both `page.tsx` (for request construction) and `workspace-shell.tsx` (for the segmented control)

---

## 2A.4 — Exact Frontend Test Files Required

### New logic test

**`frontend/components/workspace/workspace-execution-intent.logic.test.ts`**

Using `node:test` + `node:assert/strict` (project convention).

Test cases:

| # | Test | Expected |
|---|------|----------|
| 1 | `DEFAULT_EXECUTION_INTENT` is `'workspace_mutation'` | Constant equals `'workspace_mutation'` |
| 2 | `resolveExecutionIntent('conversation')` returns `'conversation'` | Valid value passes through |
| 3 | `resolveExecutionIntent('workspace_mutation')` returns `'workspace_mutation'` | Valid value passes through |
| 4 | `resolveExecutionIntent(undefined)` returns `'workspace_mutation'` | Missing defaults to safe value |
| 5 | `resolveExecutionIntent('invalid')` returns `'workspace_mutation'` | Invalid defaults to safe value |
| 6 | `resolveExecutionIntent(null)` returns `'workspace_mutation'` | Null defaults to safe value |
| 7 | `shouldApplyFileActions('conversation', [{...}])` returns `false` | Ask mode suppresses actions |
| 8 | `shouldApplyFileActions('conversation', [])` returns `false` | Ask mode with no actions is also false |
| 9 | `shouldApplyFileActions('workspace_mutation', [{...}])` returns `true` | Build mode with actions applies |
| 10 | `shouldApplyFileActions('workspace_mutation', [])` returns `false` | Build mode with no actions: nothing to apply |
| 11 | `buildExecutionPayloadIntent('conversation')` returns `{ executionIntent: 'conversation' }` | Correct payload construction |
| 12 | `buildExecutionPayloadIntent('workspace_mutation')` returns `{ executionIntent: 'workspace_mutation' }` | Correct payload construction |

### Existing test file — translation key validation

**`frontend/components/workspace/workspace-shell.test.tsx`** — ADD a new test block

Using the established pattern (lines 1860-1863 in the existing file):

```typescript
test('locale files define required ai keys for execution intent control', () => {
  const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8'));
  const zhTw = JSON.parse(readFileSync(new URL('../../messages/zh-TW.json', import.meta.url), 'utf8'));
  const zhCn = JSON.parse(readFileSync(new URL('../../messages/zh-CN.json', import.meta.url), 'utf8'));
  const requiredKeys = ['intentAsk', 'intentBuild', 'intentAskTooltip', 'intentBuildTooltip'];
  for (const key of requiredKeys) {
    assert.ok(typeof en.ai?.[key] === 'string' && en.ai[key].length > 0, `en.ai.${key} missing or empty`);
    assert.ok(typeof zhTw.ai?.[key] === 'string' && zhTw.ai[key].length > 0, `zh-TW.ai.${key} missing or empty`);
    assert.ok(typeof zhCn.ai?.[key] === 'string' && zhCn.ai[key].length > 0, `zh-CN.ai.${key} missing or empty`);
  }
});
```

This follows the exact established pattern used for global AI instructions, repo docs, build targets, visual-edit, and chat input keys.

---

## 2A.5 — Translation Validation Method

Step 3 validates translation key presence using the established `workspace-shell.test.tsx` pattern:

1. Read `en.json`, `zh-TW.json`, `zh-CN.json` with `readFileSync`
2. Assert each required key exists and is a non-empty string
3. This test runs as part of `npm test` in the frontend (the glob `components/workspace/*.test.ts*` includes `workspace-shell.test.tsx`)

**No new dependencies required.** The existing `readFileSync` + `node:assert/strict` approach is the project standard for i18n validation.

---

## 2A.6 — Keyboard-Submit Test Boundary

### Finding

Keyboard Enter and button submit both go through the same code path:

```
handleKeyDown (Enter, no Shift)
  → submitPromptAndRefocus()
    → props.onSubmitPrompt()   ← same as button click
```

`props.onSubmitPrompt` is `handleSubmitChatPrompt` from `page.tsx`, which reads the current `executionIntent` state and includes it in the `POST /api/ai/execute` body.

### Test strategy

There is no need for a separate keyboard-submit test. The shared boundary is `handleSubmitChatPrompt()`, which:

1. Reads `executionIntent` from React state
2. Includes it in the request payload

This is proven by:

- **Logic test:** `buildExecutionPayloadIntent()` returns the correct field for each intent value (test #11, #12 in §2A.4)
- **AI Service test:** `worker-mutation-validation.spec.ts` proves the WorkerProcessor correctly handles each intent value
- **API Gateway test:** Controller spec validates that `executionIntent` is accepted and propagated

The keyboard-vs-button distinction is a React rendering concern. Both call the same function. If the function includes the correct intent, both paths include it. The existing `workspace-shell.tsx` `handleKeyDown` → `submitPromptAndRefocus` → `onSubmitPrompt` chain is trivially inspectable and does not branch.

**No dedicated keyboard-submit test is required.** The shared submit function is the testable boundary.

---

## 2A.7 — Conversation Action-Discard Boundary — Owner Clarification

### Owner: WorkerProcessor (server-side)

The action discard for conversation mode is owned by WorkerProcessor, NOT the frontend.

### Exact rule

In `worker.processor.ts`, after `AIExecutionService.execute()` returns and before publishing events:

```
IF executionIntent === 'conversation' AND safeFileActions.length > 0:
  → Log diagnostic: file_action.conversation_mode_actions_discarded
    { executionId, discardedActionCount: safeFileActions.length }
  → Set safeFileActions = []
  → Proceed with normal conversation completion (status='completed', fileActions=[])
```

This means:

1. **WorkerProcessor** strips unexpected actions BEFORE publishing to Redis Pub/Sub
2. **The `publishFileActions(executionId, [])` call** sends empty actions to the frontend
3. **The frontend never receives the model's unexpected file actions** in conversation mode
4. **The frontend does not need a separate defensive discard** — it receives `fileActions: []` and the status `completed`

### Why server-side is correct

- Malicious/noncompliant model output never reaches the frontend
- The frontend's existing code path for `completed + fileActions=[]` is already correct: it shows the text and skips file-action application
- No additional frontend logic is needed to suppress actions — the server has already done it
- The `shouldApplyFileActions()` function in the frontend logic module provides defense-in-depth but is NOT the primary safety gate

### Frontend defense-in-depth

The `shouldApplyFileActions('conversation', actions)` function returns `false` regardless of action count. This is a secondary safety check. The primary guarantee is server-side.

---

## 2A.8 — Corrected Complete Step 3 Source Files

### REQUIRED SOURCE

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-execution-intent.logic.ts` | **NEW** — `ExecutionIntent` type, `DEFAULT_EXECUTION_INTENT`, `resolveExecutionIntent()`, `shouldApplyFileActions()`, `buildExecutionPayloadIntent()` |
| `frontend/components/workspace/workspace-shell.tsx` | Add segmented Ask/Build control in composer area; import `ExecutionIntent` type; accept `executionIntent` + `onExecutionIntentChange` props |
| `frontend/app/[locale]/app/page.tsx` | Add `useState<ExecutionIntent>('workspace_mutation')`; pass to workspace-shell; include in `POST /api/ai/execute` body |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Add `executionIntent?` to `AIExecutionRequest` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Accept, validate, and propagate `executionIntent` to job payload |
| `services/ai-service/src/queue/job.types.ts` | Add `executionIntent?` to `AiExecutionJob` |
| `services/ai-service/src/worker/worker.processor.ts` | Resolve `executionIntent`; update `validatePlainPathFileActionContract` to accept intent; implement conversation-mode action discarding + diagnostics |

### REQUIRED TRANSLATIONS

| File | Change |
|------|--------|
| `frontend/messages/en.json` | Add `ai.intentAsk`, `ai.intentBuild`, `ai.intentAskTooltip`, `ai.intentBuildTooltip` |
| `frontend/messages/zh-TW.json` | Same keys, Traditional Chinese |
| `frontend/messages/zh-CN.json` | Same keys, Simplified Chinese |

### TEST ONLY

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-execution-intent.logic.test.ts` | **NEW** — 12 tests covering default, resolution, `shouldApplyFileActions`, payload construction |
| `frontend/components/workspace/workspace-shell.test.tsx` | **APPEND** — i18n key validation block for `intentAsk`, `intentBuild`, `intentAskTooltip`, `intentBuildTooltip` in en/zh-TW/zh-CN |
| `services/ai-service/src/worker/__tests__/worker-mutation-validation.spec.ts` | Add intent-aware validation tests (conversation pass, workspace_mutation fail, default behavior, action discarding) |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Add validation test for `executionIntent` field acceptance and propagation |

### NOT EXPECTED

| File | Reason |
|------|--------|
| `services/ai-service/src/ai-execution/ai-execution.service.ts` | No change — intent handled in WorkerProcessor |
| `services/ai-service/src/ai-execution/file-actions.parser.ts` | No change — parser is intent-unaware |
| `services/ai-service/src/ai-execution/types.ts` | No change — `AIExecutionResult` does not carry intent |
| `services/ai-service/src/ai-execution/adapters/xai-ai.adapter.ts` | No change — adapter does not vary by intent |
| `services/container-manager/` | Not in execution path |
| Database schema/migration | No new columns |
| `package.json` (any service) | No new dependencies |

---

## 2A.9 — Corrected Complete Test Matrix

Every regression requirement now maps to an exact test location.

| # | Requirement | Test location | Test method |
|---|-------------|---------------|-------------|
| 1 | Default is Build (`workspace_mutation`) | `workspace-execution-intent.logic.test.ts` #1 | Assert `DEFAULT_EXECUTION_INTENT === 'workspace_mutation'` |
| 2 | Ask selection resolves correctly | `workspace-execution-intent.logic.test.ts` #2 | Assert `resolveExecutionIntent('conversation')` |
| 3 | Build selection resolves correctly | `workspace-execution-intent.logic.test.ts` #3 | Assert `resolveExecutionIntent('workspace_mutation')` |
| 4 | Request payload receives selected intent | `workspace-execution-intent.logic.test.ts` #11-12 | Assert `buildExecutionPayloadIntent()` output |
| 5 | Omitted/invalid intent defaults to workspace_mutation | `workspace-execution-intent.logic.test.ts` #4-6 | Assert `resolveExecutionIntent(undefined/null/'invalid')` |
| 6 | Keyboard submit uses same submit function as button | **Structural proof** (code inspection) | `handleKeyDown` → `submitPromptAndRefocus` → `onSubmitPrompt` — shared path; no branch |
| 7 | Session stickiness (mode persists within mount) | **Structural proof** (React `useState` semantics) | `useState` value persists across re-renders within same mount; no reset on session change |
| 8 | Conversation zero-action completion | `worker-mutation-validation.spec.ts` | `executionIntent='conversation'` + zero actions → `completed` (not `failed`) |
| 9 | Conversation unexpected-actions suppressed (server-side) | `worker-mutation-validation.spec.ts` | `executionIntent='conversation'` + non-empty actions → actions discarded to `[]`, status `completed` |
| 10 | Conversation mode does not apply returned file actions (frontend defense) | `workspace-execution-intent.logic.test.ts` #7-8 | `shouldApplyFileActions('conversation', [...])` returns `false` |
| 11 | Build valid actions success | `worker-mutation-validation.spec.ts` | `executionIntent='workspace_mutation'` + actions > 0 → `completed` |
| 12 | Build zero actions failure | `worker-mutation-validation.spec.ts` | `executionIntent='workspace_mutation'` + zero actions → `failed` / `file_action_contract_failure` |
| 13 | 03B regression protection | `worker-mutation-validation.spec.ts` | Default intent (absent) + zero actions on plain path → `failed` |
| 14 | Harness isolation | `worker-mutation-validation.spec.ts` | `useHarness=true` + any intent → plain-path validation NOT applied |
| 15 | Translations present in all locales | `workspace-shell.test.tsx` (appended block) | `readFileSync` + assert `ai.intentAsk/intentBuild/intentAskTooltip/intentBuildTooltip` in en/zh-TW/zh-CN |
| 16 | Invalid intent defaults safely (API Gateway) | `ai-execution.controller.spec.ts` | Missing/invalid `executionIntent` → defaults to `workspace_mutation` in job payload |
| 17 | Intent propagated to job payload (API Gateway) | `ai-execution.controller.spec.ts` | Valid `executionIntent` present in enqueued job data |

**Every requirement now maps to an actual test file and method that Step 3 can implement and execute offline.**

---

## 2A.10 — Local Validation Plan (Corrected)

### Frontend tests (includes new intent logic tests + i18n validation)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```

This runs `tsx --test components/workspace/*.test.ts*` which includes:
- `workspace-execution-intent.logic.test.ts` (new — 12 tests)
- `workspace-shell.test.tsx` (appended i18n block)

### AI Service targeted tests

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathPattern="worker-mutation-validation" --verbose
```

### AI Service offline-safe regression

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npx jest --testPathIgnorePatterns="ai-execution.phase30c" --verbose
```

### API Gateway targeted test

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPattern="ai-execution.controller" --verbose
```

### Build verification

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

---

## 2A.11 — Safety Confirmation (Step 2A)

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
| CLAUDE.md modified | NO |
| 03C / 03D registered | NO |
| PRIVATE-BETA-INVITE-01 touched | NO |

---

## 2A.12 — Final Corrected Design Verdict

### **READY FOR BOUNDED IMPLEMENTATION**

All previously undefined frontend semantics are now defined:

1. State storage: `useState` in `page.tsx` — no persistence
2. Default: `workspace_mutation` (Build)
3. Refresh behavior: resets to Build (safe default)
4. Session-switch behavior: mode is NOT reset (matches orchestration toggle pattern)
5. Frontend logic module: `workspace-execution-intent.logic.ts` — pure functions, testable with `node:test`
6. Frontend logic tests: `workspace-execution-intent.logic.test.ts` — 12 tests
7. Translation validation: `workspace-shell.test.tsx` appended block — established `readFileSync` pattern
8. Keyboard-submit: shared submit path (structural proof) — no separate test needed
9. Ask-mode action suppression: owned by WorkerProcessor server-side; frontend defense-in-depth via `shouldApplyFileActions()`
10. Every regression matrix requirement maps to an actual test

---

*Step 2A correction appended: 2026-08-11 — BUILDER-INTENT-01 Step 2A — Frontend Test + Session-State Scope Correction — documentation correction only — no source/runtime mutation.*
