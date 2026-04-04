# Checkpoint: ADV-01-01 — Multi-AI Collaboration

## 1. Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | ADV-01-01 |
| **Title** | Multi-AI Collaboration |
| **Family** | ADV-01 (Advanced Product Expansion) |
| **Status** | COMPLETE and LOCKED |
| **Nature** | IMPLEMENTATION (ADVANCED PRODUCT, MULTI-MODEL WORKSPACE SUPPORT) |
| **Checkpoint file** | `docs/ADV-01-01-CHECKPOINT.md` |
| **Spec** | `docs/specs/ADV-01-01-multi-ai-collaboration.md` |
| **Dependencies** | CO-03-01 (Complete and Locked) |

---

## 2. Objective Completed

Implemented the first bounded multi-AI slice: a user can choose between supported AI models/providers in the workspace chat panel, executions are routed to the chosen model via the existing adapter system, and model/provider attribution is persisted and surfaced per response in the chat thread — without introducing orchestrated multi-agent workflows.

---

## 3. Exact Files Changed

### Frontend

- `frontend/app/[locale]/app/page.tsx`
  - Added `CHAT_MODEL_OPTIONS` constant defining the bounded supported provider/model list (xAI grok-3, Anthropic claude-3-5-sonnet, OpenAI gpt-4o, Groq mixtral, DeepSeek deepseek-chat)
  - Added `DEFAULT_CHAT_MODEL_OPTION` constant (`xai:grok-3`)
  - Added `parseSelectedChatModelOption` helper to resolve chosen provider/model from selector value
  - Added `selectedChatModelOption` state and `setSelectedChatModelOption` setter
  - Added `applyAssistantAttributionToExecutionMessage` helper to write provider/model onto thread messages from poll responses
  - Wired `provider` and `model` fields into `/api/ai/execute` request body from selector state instead of hardcoded `'xai'`
  - Applied provider/model attribution to assistant thread messages on submit, on poll completion, and on failure
  - Forwarded `selectedModelOption`, `onSelectedModelOptionChange`, `availableModelOptions` to `WorkspaceShell`

- `frontend/components/workspace/workspace-shell.tsx`
  - Added `selectedModelOption`, `onSelectedModelOptionChange`, `availableModelOptions` props to `WorkspaceShellProps` and `WorkspaceChatPanel`
  - Added `provider` and `model` fields to thread message shape in props
  - Added model/provider `<select>` element (data-testid: `workspace-chat-model-selector`) inside the chat panel form, between textarea and submit row
  - Added per-message model attribution line (data-testid: `workspace-chat-message-attribution-{id}`) for assistant messages that carry provider/model

- `frontend/components/workspace/workspace-chat-thread.logic.ts`
  - Added `provider?: string` and `model?: string` to `WorkspaceChatThreadMessage`
  - Extended `parseStoredChatThreadMessages` to round-trip `provider` and `model` fields

- `frontend/components/workspace/workspace-chat-thread.logic.test.ts`
  - Added test: parses persisted assistant message with provider/model attribution

- `frontend/components/workspace/workspace-shell.test.tsx`
  - Added `selectedModelOption`, `onSelectedModelOptionChange`, `availableModelOptions` to `renderWorkspaceShell` default props
  - Added assertion that `Model Provider` label renders in main test
  - Added test: renders assistant model attribution when provider/model available

### Backend — api-gateway

- `services/api-gateway/src/clients/ai-service-http.client.ts`
  - Added optional `provider` field to `AIExecutionRequest` (allows request-level provider selection)
  - Added optional `model` field to `AIExecutionRequest`
  - Added optional `provider` field to `AIExecutionResult`

- `services/api-gateway/src/ai/ai-execution.controller.ts`
  - Added `SUPPORTED_AI_PROVIDERS` bounded allow-list and `SupportedAiProvider` type
  - Added `resolveProvider` private helper: prefers request-level provider when valid, falls back to `AI_PROVIDER` env, then `'stub'`; throws `BadRequestException` for unknown providers
  - Added `requestedModel` extraction from request body
  - Replaced hardcoded `AI_PROVIDER` env read with `resolveProvider(request.provider)` call
  - Forwarded `model` field to `enqueueExecution` job
  - Stored `requestedProvider` and `requestedModel` in execution intent metadata for auditability
  - Extended `parseExecutionResultMetadata` to extract `model` and `provider` from stored `aiExecutionResult` metadata
  - Populated `response.model` and `response.provider` on execution status response from metadata or record columns

- `services/api-gateway/src/ai/dto/execution-result.dto.ts`
  - Added `provider?: string` and `model?: string` to `ExecutionResultDto`

- `services/api-gateway/src/ai/execution-result.service.ts`
  - Added `provider` and `model` to the `SELECT` query so they are returned with execution status rows

- `services/api-gateway/src/ai/idempotency.guard.ts`
  - Added `provider?: string` to the metadata `aiExecutionResult` type
  - Populated `provider` on reconstructed `AIExecutionResult` for idempotent replay path (from metadata or record column fallback)

- `services/api-gateway/src/ai/__tests__/ai-execution.provider-selection.spec.ts` (new)
  - Tests: request-selected provider/model routes through execution (intent + enqueue); default single-model behavior preserved when provider omitted

- `services/api-gateway/src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts`
  - Updated fixture and expected result to include `provider` and `model` fields in metadata and response

### Backend — ai-service

- `services/ai-service/src/ai-execution/types.ts`
  - Added optional `model?: string` to `AIExecutionRequest`
  - Added optional `provider?: string` to `AIExecutionResult`

- `services/ai-service/src/ai-execution/ai-execution.service.ts`
  - Added `provider` field to `normalizedResult` so it propagates through to the result and into metadata

- `services/ai-service/src/queue/job.types.ts`
  - Widened `provider` and `adapter` types from `'openai' | 'anthropic' | 'groq'` to include all supported providers (`xai`, `deepseek`, `stub`)

- `services/ai-service/src/worker/worker.processor.ts`
  - Added `provider: job.data.provider` to the `aiExecutionResult` metadata written on completion, so provider attribution is persisted alongside model

---

## 4. Tests Run and Results

| Suite / Command | Result | Details |
|---|---|---|
| `services/api-gateway`: `npm test -- src/ai/__tests__/ai-execution.provider-selection.spec.ts src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts` | **PASS** | 2 suites, 4 tests |
| `frontend`: `npm test -- workspace-shell.test.tsx workspace-chat-thread.logic.test.ts` | **PASS** | 19 suites, 144 tests |
| `services/api-gateway`: `npm run build` | **PASS** | TypeScript compilation clean |
| `frontend`: `npx tsc --noEmit` | **PASS** | No type errors |
| Changed-file lints (ReadLints on all touched files) | **PASS** | No linter errors |

---

## 5. Migration

**No migration was required.** No new database entities or schema changes were introduced. All provider/model fields were already nullable on the existing `usage_records` table (`model`, `provider`, `adapter` columns). Attribution data flows through the existing metadata JSONB column and existing record columns without schema changes.

---

## 6. Scope Adherence

**Scope stayed fully within ADV-01-01.** Only the bounded multi-model choice/routing/attribution slice was implemented:

- No autonomous multi-agent orchestration introduced
- No conversational orchestrator introduced
- No agent debate/planning system introduced
- No provider marketplace introduced
- No billing/provider-cost optimization redesign
- No quota/billing/auth redesign
- No broad chat/workspace redesign
- No background workers introduced
- No refactors beyond what was absolutely required to wire provider selection
- No new database entities

---

## 7. Preserved Behaviors

- **Single-AI execution pipeline remains the default**: When no provider is specified in the request, the existing `AI_PROVIDER` env fallback (defaulting to `'stub'`) is used unchanged; `DEFAULT_CHAT_MODEL_OPTION` (`xai:grok-3`) provides a sensible pre-selection in the UI without forcing multi-model use.
- **Chat panel thread, persistence, and session isolation preserved**: Thread message structure is additive — `provider` and `model` are optional new fields; existing serialization/deserialization in `workspace-chat-thread.logic.ts` and `workspace-chat-persistence.logic.ts` unchanged.
- **AI-to-workspace file action semantics and sequential application preserved**: File actions continue to be parsed, applied, and cohered through the identical path established in AI-03-01/02. No changes to `workspace-ai-file-actions.logic.ts` or `workspace-ai-coherence.logic.ts`.
- **JWT auth, quota enforcement, token-usage tracking, and session lifecycle preserved**: No guards were modified. Provider selection operates purely within the execute endpoint before the queue submission. Usage records continue to track tokens, model, and provider as before.
- **CO-01/02/03 quota/plan/admin surfaces preserved**: No changes to quota, plan, or admin controllers/services.
- **All workspace/project/checkpoint behavior preserved**: No changes to checkpoint, project, snapshot, file-navigation, exec, or preview logic.
- **Request-driven behavior preserved**: Provider selection is per-request, resolved synchronously during execution intent write and queue submission.
- **No polling/background workers introduced**: The selector is a stateless UI control; attribution is applied on existing poll/stream response paths.

---

## 8. Delivered Capability

- **Model/provider selector added to existing workspace AI surface**: A bounded `<select>` element (`data-testid: workspace-chat-model-selector`) appears in the chat panel above the submit controls. It lists the five currently supported providers/models. It is disabled during active execution and when no session is selected.
- **Execution routed through chosen model/provider on existing execution path**: `handleSubmitChatPrompt` in `page.tsx` resolves `provider` and `model` from the selector and sends them in the `/api/ai/execute` request body. `AIExecutionController.resolveProvider` validates the value against the bounded allow-list and falls back to the env default, then routes through the unchanged queue/worker path.
- **Model attribution persisted/displayed per response where relevant**: `provider` and `model` are stored in the `aiExecutionResult` metadata JSONB on completion by the worker. They are returned on `GET /api/ai/executions/:id` and applied to the assistant thread message in the frontend. The chat thread renders a compact attribution line (`Model: {model} ({provider})`) for assistant messages that carry this data.
- **Token/usage tracking remains coherent per selected model/provider**: Token usage continues to be recorded in `usage_records.tokens_used` and `usage_records.model` per execution. The `provider` column is now populated from the job, making per-provider usage reporting accurate.
- **Single-model default remains intact**: The default option is `xai:grok-3`, matching the previous hardcoded `'xai'` provider. Existing sessions and chat history that lack attribution fields are handled gracefully (attribution line is suppressed when `model` and `provider` are absent).

---

## 9. Next Follow-up Boundary

The spec describes a later slice enabling parallel multi-model execution (multiple models responding to the same prompt simultaneously). The current implementation delivers bounded sequential single-model-per-prompt choice. A follow-up task (`ADV-01-02` or similar) could address parallel multi-model responses, conflict resolution for file actions from multiple models, and per-model cost/quota attribution — but must not be started until explicitly authorized.
