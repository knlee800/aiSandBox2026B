# Checkpoint: ADV-02-01 — Conversational Orchestrator

## 1. Task Metadata

| Field | Value |
|-------|-------|
| **Task ID** | ADV-02-01 |
| **Title** | Conversational Orchestrator |
| **Family** | ADV-01 (Advanced Product Expansion) |
| **Status** | COMPLETE and LOCKED |
| **Nature** | IMPLEMENTATION (ADVANCED PRODUCT, SINGLE-MODEL MULTI-STEP ORCHESTRATION) |
| **Checkpoint file** | `docs/ADV-02-01-CHECKPOINT.md` |
| **Spec** | `docs/specs/ADV-02-01-conversational-orchestrator.md` |
| **Dependencies** | ADV-01-01 (Complete and Locked) |

---

## 2. Objective Completed

Implemented the first bounded conversational orchestrator slice: a user can opt into a multi-step AI execution mode inside the existing workspace chat panel. When enabled, a deterministic step plan (max 3 steps, hard ceiling) is built from the user prompt, each step is executed sequentially via the existing `/api/ai/execute` → poll loop, plan progress is surfaced in the assistant chat thread message, and a clear bounded stop occurs on any step failure. Single-turn remains the default; orchestration is strictly opt-in per prompt.

---

## 3. Exact Files Changed

### Frontend

- `frontend/components/workspace/workspace-chat-orchestration.logic.ts` (new)
  - `CHAT_ORCHESTRATION_MAX_STEPS = 3` — explicit hard deterministic ceiling
  - `buildWorkspaceChatOrchestrationPlan(prompt, maxSteps)` — pure plan builder: decomposes prompt into ≤3 steps by line split → sentence split → fallback 3-instruction plan
  - `formatWorkspaceChatOrchestrationProgress(steps, progress)` — pure formatter renders plan + step status lines for chat-thread display
  - Types: `WorkspaceChatOrchestrationStep`, `WorkspaceChatOrchestrationStepProgress`, `WorkspaceChatOrchestrationStepStatus`

- `frontend/components/workspace/workspace-chat-orchestration.logic.test.ts` (new)
  - 3 focused tests: bounded plan from multi-line prompt; fallback 3-step plan for single-sentence prompt; progress formatter output

- `frontend/components/workspace/workspace-shell.tsx`
  - Added `orchestrationEnabled?: boolean` and `onOrchestrationEnabledChange?: (enabled: boolean) => void` props to `WorkspaceShellProps` and forwarded to `WorkspaceChatPanel`
  - Added `orchestrationEnabled` and `onOrchestrationEnabledChange` props to `WorkspaceChatPanel`
  - Added opt-in checkbox (`data-testid: workspace-chat-orchestration-toggle`, label: "Enable bounded orchestration (up to 3 sequential steps)") to `WorkspaceChatPanel` form, below model selector; disabled when no session, no handler, or during active execution

- `frontend/components/workspace/workspace-shell.test.tsx`
  - Added `orchestrationEnabled: false` and `onOrchestrationEnabledChange: () => {}` to `renderWorkspaceShell` default props
  - Added assertion that "Enable bounded orchestration (up to 3 sequential steps)" renders in main layout test

- `frontend/app/[locale]/app/page.tsx`
  - Added import for `buildWorkspaceChatOrchestrationPlan`, `CHAT_ORCHESTRATION_MAX_STEPS`, `formatWorkspaceChatOrchestrationProgress`, `WorkspaceChatOrchestrationStepProgress`
  - Added `isChatOrchestrationEnabled` state (default `false`)
  - Added `sleepMs` helper (wraps `window.setTimeout` for bounded step polling)
  - Added `updateAssistantMessageContent` helper (updates a specific assistant message ID in `chatThreadMessages`)
  - Added `submitOrchestratedChatPrompt(input)` function:
    - Builds orchestration plan from user prompt
    - Initialises progress display in the assistant thread message
    - Iterates over steps (bounded by `CHAT_ORCHESTRATION_MAX_STEPS`):
      - Sets step status to `running`, updates thread message
      - Submits step-specific prompt (step 1 = raw instruction; steps 2+ = contextualised with prior step outputs) to `POST /api/ai/execute` with same provider/model as selected
      - Polls `GET /api/ai/executions/:id` at `CHAT_EXECUTION_POLL_INTERVAL_MS` until terminal status
      - Tracks per-execution ID in `executionSessionIdByExecutionIdRef` and `executionAssistantMessageIdByExecutionIdRef`
      - Calls `applyAssistantAttributionToExecutionMessage` and `consumeExecutionFileActions` per step — preserving file action and attribution paths
      - On any step failure: writes `failed` progress, sets `chatRequestState` to `'failed'`, persists final content to backend, returns (clear bounded stop)
      - On step completion: accumulates output in `combinedStepOutput`
    - On full plan completion: writes final progress + combined output to assistant thread message, sets `chatRequestState` to `'completed'`, persists to backend, refreshes dashboard
  - `handleSubmitChatPrompt`: when `isChatOrchestrationEnabled` is true, sets `pendingAssistantMessageIdRef.current = null` (so the existing single-turn poll path is skipped) and delegates to `submitOrchestratedChatPrompt`; existing single-turn code path is entirely unchanged otherwise
  - Forwarded `orchestrationEnabled={isChatOrchestrationEnabled}` and `onOrchestrationEnabledChange={setIsChatOrchestrationEnabled}` to `WorkspaceShell`

---

## 4. Tests Run and Results

| Suite / Command | Result | Details |
|---|---|---|
| `frontend`: `npm test -- workspace-chat-orchestration.logic.test.ts workspace-shell.test.tsx workspace-chat-thread.logic.test.ts` | **PASS** | 20 suites, 147 tests |
| `frontend`: `npx tsc --noEmit` | **PASS** | No type errors |
| `services/api-gateway`: `npm test -- src/ai/__tests__/ai-execution.provider-selection.spec.ts src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts` | **PASS** | 2 suites, 4 tests |
| `services/api-gateway`: `npm run build` | **PASS** | TypeScript compilation clean |
| Changed-file lints (ReadLints on all touched files) | **PASS** | No linter errors |

`frontend/tsconfig.tsbuildinfo` was incidentally modified by the `npx tsc --noEmit` run; it was reverted via `git checkout -- frontend/tsconfig.tsbuildinfo` and is not part of this task diff.

---

## 5. Migration

**No migration was required.** No new database entities, schema changes, or backend files were introduced. All orchestration logic is frontend-only. Each orchestrated step uses the existing `/api/ai/execute` + `/api/ai/executions/:id` endpoints and the existing `usage_records` persistence path without modification.

---

## 6. Scope Adherence

**Scope stayed fully within ADV-02-01.** Only the bounded opt-in multi-step orchestration slice was implemented:

- No autonomous agents introduced
- No long-running background orchestration introduced
- No provider marketplace introduced
- No debate/planning swarm introduced
- No billing/quota redesign
- No broad chat/workspace redesign
- No background workers introduced (polling uses the same `CHAT_EXECUTION_POLL_INTERVAL_MS` constant already used by the single-turn path, called synchronously inside `submitOrchestratedChatPrompt` — not a new timer)
- No refactors beyond the minimum required to wire the opt-in flag and orchestration function
- No new database entities
- No backend files changed

---

## 7. Preserved Behaviors

- **Single-turn AI execution pipeline remains the default**: `isChatOrchestrationEnabled` defaults to `false`. When the checkbox is not checked, `handleSubmitChatPrompt` follows the existing single-turn path unchanged. The orchestration flag does not affect any state, ref, or handler outside the orchestrated branch.
- **AI-to-workspace file action semantics and sequential application preserved**: Each orchestrated step calls `consumeExecutionFileActions(executionId, 'status', terminalFileActions)` via the existing path established in AI-03-01B/C. `applySequentialFileActions`, session guards, and once-only apply guard are all reused without modification.
- **Chat panel thread, persistence, and session isolation preserved**: Thread messages are extended additively; `updateAssistantMessageContent` updates only the specific assistant message ID. `persistSessionChatMessageToBackend` is called for final orchestration content with `.catch()` fallback, matching the existing single-turn path. Session stale-guard in `executionSessionIdByExecutionIdRef` is tracked per-execution-ID exactly as in single-turn.
- **Model/provider attribution behavior from ADV-01-01 preserved**: `applyAssistantAttributionToExecutionMessage(executionId, { provider, model })` is called per step, maintaining per-execution attribution on the same assistant message. `executionAssistantMessageIdByExecutionIdRef` is populated per step execution ID.
- **JWT auth, quota enforcement, token-usage tracking, and session lifecycle preserved**: Orchestrated steps use the same `Authorization: Bearer ${apiKey}` header on all fetch calls. Quota enforcement is applied by the existing `TokenQuotaGuard` / `SessionQuotaGuard` per execution request. Each step produces a `usage_records` row via the unchanged worker path.
- **All workspace/project/checkpoint/revert behavior preserved**: `consumeExecutionFileActions` triggers the existing `maybeApplyExecutionFileActions` → `runAiActionCoherence` path (file tree refresh, editor reload, preview refresh, auto-checkpoint) per step execution, unchanged.
- **CO-01/02/03 quota/plan/admin surfaces preserved**: `loadDashboardSlice` is called after orchestration completes, matching the single-turn behavior. No quota, plan, or admin controllers/services were modified.
- **Request-driven behavior preserved**: `submitOrchestratedChatPrompt` is an async function called only from `handleSubmitChatPrompt` on explicit user submit. The step polling loop inside it is synchronous awaiting (no `setInterval`, no `useEffect` timer, no background worker).
- **No background workers / polling introduced**: The existing `setInterval` timer in the `chatExecutionId`/`chatRequestState` `useEffect` is not triggered by the orchestrated path because `isChatOrchestrationEnabled` leaves `pendingAssistantMessageIdRef.current` as `null` and does not set `chatRequestState` to `'queued'` or `'running'` during the synchronous step loop.

---

## 8. Delivered Capability

- **Bounded multi-step orchestration added inside existing workspace execution loop**: `submitOrchestratedChatPrompt` decomposes the user prompt into ≤3 sequential steps (hard ceiling: `CHAT_ORCHESTRATION_MAX_STEPS = 3`), submits each step to the existing execution endpoint, and polls for completion before proceeding to the next.
- **Orchestration is opt-in; single-turn remains default**: A checkbox "Enable bounded orchestration (up to 3 sequential steps)" (`data-testid: workspace-chat-orchestration-toggle`) appears in the chat panel. It is unchecked by default, disabled during active execution, and requires an active session. Unchecking it at any time restores the single-turn path for the next submit.
- **Orchestration plan and step progress surfaced on existing chat/workspace surfaces**: The assistant thread message for the orchestrated turn continuously displays the step plan and per-step status (`pending`, `running`, `completed`, `failed`) via `formatWorkspaceChatOrchestrationProgress`. Final combined output is appended below the progress block on completion.
- **Orchestration remains single-request and request-driven only**: The entire orchestration runs inside a single `handleSubmitChatPrompt` invocation. No background timers, watchers, or autonomous continuations are introduced.
- **Existing execute/queue/worker path reused coherently**: Each step uses `POST /api/ai/execute` → `GET /api/ai/executions/:id` with the same provider/model from the selector. File actions, attribution, usage tracking, and coherence behavior follow the unchanged per-execution paths.
- **Failure state is bounded and stops clearly**: If any step fails (HTTP error, missing execution ID, non-`completed` terminal status), `chatRequestState` is set to `'failed'`, `chatError` is set with the failure message, the thread message shows the final progress state with the failed step marked, and `submitOrchestratedChatPrompt` returns immediately. No partial continuation occurs.

---

## 9. Next Follow-up Boundary

The current slice delivers single-model bounded sequential step orchestration within a single user request. The spec describes additional features — user pause/resume/cancel between steps, step-level checkpoints per-step, parallel step execution, and full multi-model orchestration — that are explicitly out of scope here. Any of these would constitute a follow-up task (e.g. `ADV-02-02` or a `ADV-03` family) and must not be started until explicitly authorized.
