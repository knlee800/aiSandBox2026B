# Spec: AI-03-01 — AI-to-Workspace File Actions

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | AI-03-01 |
| **Title** | AI-to-Workspace File Actions — Minimal Writable Workspace Slice |
| **Status** | Draft |
| **Master plan alignment** | Section 4.1 (Primary product loop), Section 7.2 AI-03, Phase 2 |
| **Related task IDs** | AI-03-01 (registered in TASKS.md / TASKS_BACKLOG_FULL.md) |
| **Depends on** | Phase 84 (chat panel, complete), AI execution pipeline (operational), PF-04 workspace file system (operational) |
| **Enables** | AI-03-02 (Post-AI-Action Workspace Coherence), full AI-first workspace loop |

---

## 2. Problem

The workspace chat panel (Phase 84) can send prompts to the AI and display text responses, but the AI cannot yet cause real file/code changes in the workspace. The core product loop — user asks AI, AI changes workspace, user sees result — is broken at the "AI changes workspace" step.

---

## 3. Why This Matters

This is the single most important unfinished product gap. The revised master plan (Section 2.3) defines the core promise as AI modifying the workspace, not just returning text. Without this, the platform is a chat window, not an AI coding workspace.

---

## 4. Goal

Implement the first minimal end-to-end slice where an AI prompt causes real workspace file/code changes in the active session and the user receives clear confirmation in the chat panel that files were changed or that the action failed. Broader workspace surface coherence (file tree refresh, editor reload, preview refresh, auto-checkpoint) is owned by AI-03-02.

---

## 5. Non-Goals

- No post-action workspace coherence orchestration — file tree refresh, editor reload, preview refresh, auto-checkpoint are all owned by AI-03-02
- No shell/exec-first solution — the product path is AI writing files, not AI running shell commands as a primary interaction
- No broad agent/tool framework
- No multi-step autonomous orchestration engine
- No autonomous command execution expansion
- No project save/restore
- No import/export
- No backend chat persistence redesign
- No multi-file transactional engine
- No broad checkpoint redesign
- No multi-AI features
- No conversational orchestrator
- No refactors unless strictly required for this bounded slice

---

## 6. Existing Relevant Completed Work to Preserve

| Phase | Capability | Must Preserve |
|-------|-----------|---------------|
| Phase 84A–84G | Chat panel prompt/response/thread/persistence/auth-gate | Yes |
| Phase 79A | Preview panel (loading/ready/unavailable/error, refresh) | Yes |
| Phase 79B | File tree, file selection, content display | Yes |
| Phase 80A | Editor save (clean/dirty/saving/saved/save-error) | Yes |
| Phase 80B | Manual checkpoint creation ("Save Point") | Yes |
| Phase 80C | Manual revert with confirmation | Yes |
| Phase 81–82 | History/control surface (diff, compare, timeline, etc.) | Yes |
| Phase 78 | Exec interaction panel | Yes (secondary surface) |

---

## 7. Scope

### First-slice file actions only:
1. **Create a file** — AI can create a new file in the workspace
2. **Write/overwrite a file** — AI can write content to a file (new or existing)
3. **Update existing file content** — AI can replace content in an existing file

### Wiring:
- AI execution flow produces structured file-action instructions (not just text)
- File actions are applied to the active session workspace via existing file write capabilities
- The frontend receives a structured result payload confirming which files were changed/created and which failed
- The chat panel surfaces this result so the user knows files were changed
- The result payload must be sufficient for downstream consumers (AI-03-02) to trigger workspace surface refresh — but AI-03-01 does NOT own file tree refresh, editor reload, preview refresh, or checkpoint creation

### Boundaries:
- Minimal backend changes strictly required for AI to produce file side-effects
- Minimal frontend changes to surface the result
- Deterministic failure handling when file actions fail
- Keep the slice as small as possible while being genuinely end-to-end

---

## 8. Functional Requirements

1. AI execution must be able to produce structured file-action output alongside or instead of pure text response
2. File actions must specify: action type (create/write/update), file path, file content
3. File actions must be applied to the workspace via existing container-manager file write capabilities
4. File actions must be scoped to the active session only
5. Results of file actions (success/failure per file) must be communicated back to the frontend
6. The chat panel must indicate when AI has changed files (not just returned text)

---

## 9. UX Requirements

1. User submits a prompt from the chat panel (existing flow)
2. AI responds with text and/or file changes
3. If files were changed, the chat panel shows a brief indication (e.g., "Files changed: path/to/file.ts")
4. If file actions failed, the chat panel shows clear per-file error information
5. File tree refresh, editor reload, and preview refresh after AI actions are owned by AI-03-02, not this spec

---

## 10. Backend Requirements

1. AI service must support producing structured file-action output from AI execution
2. A mechanism must exist to apply file actions to the workspace after AI execution completes
3. File write must use existing container-manager file endpoints or equivalent internal paths
4. File actions must respect session lifecycle (no writes to terminated sessions)
5. File action results must be available to the frontend

---

## 11. Frontend Requirements

1. Chat panel must handle AI responses that include file-action results
2. Chat thread must indicate file changes occurred (per-file success/failure)
3. File-action result payload must be structured and available for downstream consumers (AI-03-02 will use it to trigger workspace surface refresh)
4. Existing chat submit/response/thread/persistence flow must remain intact
5. File tree refresh and editor reload are NOT this spec's responsibility — they are owned by AI-03-02

---

## 12. Data/State Expectations

- File actions are ephemeral per-execution — no new persistent entity required for this first slice
- File paths in actions are relative to session workspace root (`/workspace`)
- File content is UTF-8 text for this first slice (no binary)
- Session ID scoping is mandatory for all file operations

---

## 13. Error Handling Requirements

1. If AI produces a file action targeting a terminated session → fail gracefully, show error in chat
2. If file write fails (permission, path error, container issue) → fail gracefully per file, show error in chat
3. If AI execution succeeds but file action fails → partial success must be visible (text response still shown, file error noted)
4. Network/timeout errors during file write → standard error state, no silent failures

---

## 14. Acceptance Criteria

- [ ] User submits an AI prompt from the workspace chat surface
- [ ] AI execution can cause at least one real file/code change in the active workspace
- [ ] Chat panel indicates which files were changed or created (structured result payload)
- [ ] Chat panel indicates per-file errors when file actions fail
- [ ] Result payload is structured and sufficient for AI-03-02 to consume for workspace surface refresh
- [ ] Behavior is bounded to file actions only for this first slice
- [ ] Current workspace UX (chat, editor, preview, checkpoint, history) remains stable
- [ ] Current auth/quota/session behavior remains preserved
- [ ] No scope expansion into shell-first or agent-platform work
- [ ] Failures are handled gracefully without breaking the workspace
- [ ] This spec does NOT include file tree refresh, editor reload, preview refresh, or auto-checkpoint (those are AI-03-02)

---

## 15. Invariants to Preserve

- Request-driven behavior (no background workers, no polling for file changes)
- Session isolation (file actions only affect the active session)
- Auth/ownership enforcement on all file operations
- Chat panel thread behavior preserved
- Checkpoint/history surface unaffected (auto-checkpoint is AI-03-02, not this spec)
- File tree refresh and editor content reload patterns are not consumed by this spec — they are reused by AI-03-02

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| AI execution pipeline (ai-service) | Operational | Producing file-action instructions |
| File write endpoint (container-manager) | Operational | Applying file changes |
| Chat panel (Phase 84) | Complete | Submitting prompts, showing results |
| File tree/editor (Phase 79/80) | Complete | Displaying changed files |

---

## 17. Risks / Edge Cases

- AI model output format: the AI must produce structured file actions in a parseable format. This may require prompt engineering or a function-calling/tool-use pattern depending on the AI provider.
- Large file writes: first slice should handle reasonable file sizes; very large files are an edge case for later.
- Concurrent file actions: if AI produces multiple file actions, they should be applied sequentially for this first slice.
- File path safety: AI-suggested file paths must be validated to prevent path traversal outside workspace.

---

## 18. Suggested Implementation Slices

1. **Backend: AI execution file-action output format** — Define and implement the structured output format for file actions from AI execution. Minimal change to ai-service execution/worker flow.
2. **Backend: File-action application wiring** — After AI execution produces file actions, apply them to the workspace via existing file write capabilities. Minimal new endpoint or internal path.
3. **Frontend: Chat panel file-action result surfacing** — Update chat panel to detect and display file-action results alongside text responses. Ensure result payload is structured for downstream consumers (AI-03-02).

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Auto-checkpoint after AI file actions (→ AI-03-02)
- Preview auto-refresh after AI file actions (→ AI-03-02)
- Backend chat/conversation persistence of file-action history (→ AI-04-01)
- Multi-file transactional guarantees
- File deletion by AI
- Directory creation by AI
- Binary file handling
- AI running shell commands as part of file actions
