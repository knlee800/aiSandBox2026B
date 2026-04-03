# Spec: AI-04-01 — Backend Chat Persistence Wiring

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | AI-04-01 |
| **Title** | Backend Chat Persistence Wiring |
| **Status** | Draft |
| **Master plan alignment** | Section 5.1D (response persistence, session-scoped chat state), Section 7.2 AI-04 |
| **Related task IDs** | None yet registered |
| **Depends on** | Phase 84 (chat panel complete) |
| **Enables** | Durable chat history, cross-device session continuity |

---

## 2. Problem

Per-session chat is currently persisted in localStorage only (Phase 84E). This is fragile, device-bound, and clearable. The backend already has conversation and chat-message entities in the database, but they are not wired to the workspace chat panel.

---

## 3. Why This Matters

The master plan Section 5.1D requires "response persistence" and "session-scoped chat state." LocalStorage persistence is a temporary measure. Backend persistence ensures chat survives device switches and browser data clearing.

---

## 4. Goal

Wire the workspace chat panel to backend conversation/message persistence so chat history is session-scoped and stored server-side.

---

## 5. Non-Goals

- No cross-session conversation system
- No global chat history or search
- No conversation export
- No conversation branching
- No redesign of chat panel rendering
- No multi-AI conversation threading

---

## 6. Existing Relevant Completed Work to Preserve

- Phase 84A–84F chat panel prompt/response/thread/persistence/error behavior
- Phase 84G workspace auth gate
- Backend conversation and chat-message entities (exist in api-gateway)
- Backend ai-service conversations/messages modules (exist)

---

## 7. Scope

1. Save user prompt messages to backend per session
2. Save assistant response messages to backend per session
3. Load prior messages from backend when selecting a session
4. Maintain session-scoped isolation at backend level
5. Graceful fallback if backend persistence is temporarily unavailable

---

## 8. Functional Requirements

1. Each chat message (user or assistant) must be persisted to the backend tied to the session
2. On session selection, prior messages must be loaded from backend
3. Messages must be ordered by creation time
4. Session switching must load the correct session's messages
5. New messages during the session must be persisted incrementally

---

## 9. UX Requirements

1. Chat panel behavior remains unchanged from the user's perspective
2. Messages appear on session selection (loaded from backend)
3. No visible loading delay for typical message counts
4. If backend load fails, fall back to localStorage gracefully

---

## 10. Backend Requirements

1. API endpoint to save a chat message per session (may already exist via conversation/message controllers)
2. API endpoint to list chat messages for a session, ordered by time
3. Messages must include: role (user/assistant), content, timestamp, session ID
4. Session ownership enforced on all message endpoints

---

## 11. Frontend Requirements

1. On session selection, load messages from backend instead of (or in addition to) localStorage
2. On prompt submit, persist user message to backend
3. On assistant response complete, persist assistant message to backend
4. Remove or demote localStorage as primary persistence (keep as cache/fallback)
5. Existing chat thread rendering remains unchanged

---

## 12. Data/State Expectations

- Reuse existing `conversation` and `chat_message` entities where possible
- Messages are tied to session ID (not a separate conversation entity for this first slice, unless existing schema requires it)
- Message content is UTF-8 text
- File-action metadata from AI-03-01 may be included in assistant messages if AI-03-01 is complete; this is optional and must not block AI-04-01 implementation

---

## 13. Error Handling Requirements

1. If backend save fails → do not block chat UX; fall back to localStorage
2. If backend load fails → fall back to localStorage; show no error unless complete failure
3. If message ordering is inconsistent → use timestamp ordering

---

## 14. Acceptance Criteria

- [ ] Chat messages are persisted to backend per session
- [ ] Switching away and back to a session restores chat from backend
- [ ] Clearing localStorage does not lose chat history
- [ ] Session isolation is maintained (no cross-session message leakage)
- [ ] Existing chat panel UX behavior is preserved
- [ ] Auth/ownership enforcement applies to message endpoints

---

## 15. Invariants to Preserve

- Session-scoped chat isolation (Phase 84E/84F behavior)
- Chat panel prompt/response/thread rendering (Phase 84A–84D)
- Auth gating (Phase 84G)
- Request-driven behavior only

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| Phase 84 chat panel | Complete | Chat UX to wire persistence into |
| Backend conversation/message entities | Exist | Storage layer |
| AI-03-01 | Planned | File-action metadata in messages (optional, not a hard prerequisite — AI-04-01 can proceed in parallel with AI-03-01) |

---

## 17. Risks / Edge Cases

- Existing conversation/message schema may need minor adaptation to fit workspace chat model
- Migration from localStorage-primary to backend-primary must be non-destructive
- Large conversation histories may need pagination for load performance

---

## 18. Suggested Implementation Slices

1. **Backend: Message save endpoint wiring** — Ensure save-message endpoint works for session-scoped chat messages.
2. **Backend: Message list endpoint wiring** — Ensure list-messages-by-session endpoint works with correct ordering.
3. **Frontend: Load messages from backend on session select** — Replace or augment localStorage load with backend load.
4. **Frontend: Persist messages to backend on submit/response** — Save incrementally after each prompt and response.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Conversation search/filter
- Message editing or deletion
- Rich message types (images, attachments)
- Conversation export
- Cross-session conversation continuity
