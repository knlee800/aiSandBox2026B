# AI-04-01 CHECKPOINT

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AI-04-01 |
| Title | Backend Chat Persistence Wiring |
| Family | AI-04 (Chat Persistence) |
| Status | COMPLETE and LOCKED |
| Nature | IMPLEMENTATION (CORE PRODUCT LOOP, CHAT PERSISTENCE) |
| Checkpoint file | `docs/AI-04-01-CHECKPOINT.md` |
| Depends on | Phase 84 (Complete and Locked); AI-03-02 (Complete and Locked) |

---

## Objective Completed

Wired the workspace chat panel to backend conversation/message persistence so session chat history is now server-side and durable. On session selection the frontend loads backend history first; user prompts and completed assistant responses are persisted to the backend incrementally. localStorage is retained as compatibility / fallback layer when backend calls fail.

---

## Exact Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | On session selection: imports and calls `loadSessionChatMessagesFromBackend()`; shows localStorage-backed thread immediately, then replaces with backend thread when load succeeds (stale-session guard applied); on prompt submit: calls `persistSessionChatMessageToBackend()` for `user` role with `.catch()` fallback; on `completed` path in `handleSubmitChatPrompt`, `refreshChatExecutionStatus`, and error catch paths: calls `persistSessionChatMessageToBackend()` for `assistant` role with `.catch()` fallback |
| `frontend/components/workspace/workspace-chat-persistence.logic.ts` | New — `loadSessionChatMessagesFromBackend()` (fetches `GET /api/sessions/:id/conversation` then `GET /api/conversations/:id/messages?limit=200&offset=0`; maps backend `ChatMessage` rows to `WorkspaceChatThreadMessage[]`; filters out `system` role messages; throws on HTTP failure so caller can catch and fall back); `persistSessionChatMessageToBackend()` (posts `POST /api/sessions/:id/messages`; throws on failure so caller can catch) |
| `frontend/components/workspace/workspace-chat-persistence.logic.test.ts` | New — 5 focused tests: loads session messages from backend path; returns empty array when no conversation exists; persists user message; throws on backend load failure (caller fallback test); throws on backend save failure (caller fallback test) |
| `services/api-gateway/src/conversations/conversation.controller.ts` | Added `POST /api/sessions/:id/messages` endpoint (`addMessageBySession`) with JWT ownership guard, `NotFoundException` on mismatched owner, delegates to existing `ChatMessageService.addMessageBySession()` |
| `services/api-gateway/src/conversations/dto/add-session-message.dto.ts` | New — `AddSessionMessageDto` with `role: ChatMessageRole` and `content: string` |
| `services/api-gateway/src/conversations/conversation.controller.spec.ts` | New — 6 focused tests: loads conversation for owned session; rejects unowned session for conversation; persists session-scoped message for owned session; rejects message persistence for unowned session; loads messages for owned conversation; rejects message loading for unowned conversation |

---

## Exact Tests Run and Results

| Command / check | Result |
|---|---|
| `services/api-gateway`: `npm test -- conversation.controller.spec.ts` | PASS — 1 suite, 6 tests |
| `frontend`: `npm test -- workspace-chat-persistence.logic.test.ts workspace-shell.test.tsx workspace-chat-thread.logic.test.ts workspace-ai-file-actions.logic.test.ts workspace-ai-coherence.logic.test.ts` | PASS — 125 tests, 15 suites, 0 failures |
| `frontend`: `npx tsc --noEmit` | PASS |
| Changed-file lints (all 6 files above) | No linter errors |

---

## No Migration Required

No database schema changes or migration files were created or modified. The implementation reuses existing `conversation` and `chat_message` entities and their existing persistence paths. The new backend endpoint (`POST /api/sessions/:id/messages`) uses the pre-existing `ChatMessageService.addMessageBySession()` service method and the existing `GET /api/sessions/:id/conversation` + `GET /api/conversations/:id/messages` read paths added previously.

---

## Scope Statement

Scope stayed fully within AI-04-01. No workspace coherence changes, no project persistence, no chat UI redesign, no quota/billing/auth redesign, no new agent behavior, no schema migration, no service boundary changes. Backend changes are confined to `ConversationController` in `api-gateway` only.

---

## Preserved Behaviors

- **Phase 84A–84G chat panel behavior** — submit, stream, thread rendering, session-switch reset, quota error clarity, auth gate — all unchanged. No chat UI modified.
- **Existing submit / stream / poll / cancel execution flow** — untouched. Persistence calls are fire-and-forget (`.catch()`) and do not block or alter the execution request pipeline.
- **Session-scoped isolation** — `selectedSessionIdRef` guard in the backend load path prevents stale session from overwriting thread after a session switch. Ownership enforcement in the new backend endpoint prevents cross-session access.
- **Existing thread rendering** — `WorkspaceChatThreadMessage` shape unchanged; `fileActionState` and `executionId` fields on messages are preserved and survive backend load (system role messages are filtered out, user/assistant messages map cleanly).
- **localStorage retained as fallback** — Phase 84E localStorage persistence (`localStorage.setItem` on `chatThreadMessages` change) remains active. Backend load failure silently falls back to localStorage-backed thread. Backend save failure silently falls back to localStorage-only persistence without disrupting UX.
- **AI-03-01 / AI-03-02 behavior** — file-action application, result surfacing, post-action workspace coherence — all unchanged. Persistence wiring is additive-only in `page.tsx`.
- **`WorkspaceChatThreadMessage` compatibility** — shape extended in AI-03-01C is preserved. `parseStoredChatThreadMessages` in `workspace-chat-thread.logic.ts` remains the localStorage round-trip layer.

---

## Delivered Capability

- **Session chat history loads from backend on session selection.** When a session is selected, the frontend loads prior messages from `GET /api/sessions/:id/conversation` + `GET /api/conversations/:id/messages`. The backend thread replaces the localStorage thread if it is non-empty or if localStorage was also empty.
- **User prompt messages persist to backend per session.** On `handleSubmitChatPrompt`, after pushing the user message to local state, `persistSessionChatMessageToBackend()` is fired for the `user` role (fire-and-forget with `.catch()`).
- **Assistant completed responses persist to backend per session.** On both the direct-complete path and the poll-complete path in `refreshChatExecutionStatus`, and on the error/failure path for failed executions, the final assistant message content is persisted to the backend via `persistSessionChatMessageToBackend()` for the `assistant` role (fire-and-forget with `.catch()`).
- **Session switching restores backend chat history.** `selectedSessionIdRef` staleness guard ensures that if the user switches session mid-load, the returned backend messages are discarded without overwriting the newly selected session's thread.
- **Graceful fallback to localStorage when backend load/save fails.** All `loadSessionChatMessagesFromBackend` and `persistSessionChatMessageToBackend` calls are wrapped in try/catch or `.catch()`. The chat UX continues uninterrupted on any backend failure.
- **No cross-session chat leakage.** Backend endpoint enforces JWT ownership (`session.userId !== userId → NotFoundException`). Frontend staleness guard prevents out-of-order loads from populating the wrong session thread.

---

## Follow-Up Boundary

The next natural follow-on work is **PR-01-01 (Project Save and Restore)** or other backlog items in the `PR` or `CO` families, as defined in `docs/specs/SPEC-BREAKDOWN-INDEX.md`. None of those tasks are started or registered here.

---

*Governance: CLAUDE.md → TASKS.md → TASKS_BACKLOG_FULL.md → CHECKPOINT*
