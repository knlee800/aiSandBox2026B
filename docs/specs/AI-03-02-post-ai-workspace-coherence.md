# Spec: AI-03-02 — Post-AI-Action Workspace Coherence

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | AI-03-02 |
| **Title** | Post-AI-Action Workspace Coherence |
| **Status** | Draft |
| **Master plan alignment** | Section 3 Principle 3 (Workspace truth), Section 7.2 AI-03, Phase 2 |
| **Related task IDs** | None yet registered |
| **Depends on** | AI-03-01 (AI file actions working) |
| **Enables** | Full AI-first workspace loop with auto-checkpoint and surface coherence |

---

## 2. Problem

After AI-03-01 enables AI to write files, the workspace surfaces (file tree, editor, preview, checkpoint history) may not automatically reflect those changes. The user must see a coherent workspace after every AI action.

---

## 3. Why This Matters

The master plan Principle 3 (Workspace truth) requires that editor, preview, checkpoints, chat, and workspace state describe the same reality. If AI changes files but the editor shows stale content or no checkpoint is created, the product feels broken.

---

## 4. Goal

After AI modifies workspace files, ensure all workspace surfaces update to reflect the new state, and auto-create a checkpoint for reversibility.

---

## 5. Non-Goals

- No real-time file watching or polling
- No websocket-based push updates
- No background workers
- No broad checkpoint redesign
- No multi-AI coordination
- No project persistence layer changes

---

## 6. Existing Relevant Completed Work to Preserve

- Phase 79A preview panel (status check, iframe refresh)
- Phase 79B file tree (list, select, content load)
- Phase 80A editor save states
- Phase 80B manual checkpoint creation via `POST /api/git/:sessionId/commit`
- Phase 80C manual revert
- Phase 78B post-exec surface refresh pattern (checkpoint list, session list, dashboard)
- Phase 84A–84G chat panel behavior

---

## 7. Scope

1. After AI file actions complete, trigger file tree refresh using existing `loadWorkspaceFilesForSession()` pattern
2. After AI file actions complete, if the currently selected file was affected, reload its content in the editor
3. After AI file actions complete, trigger preview refresh using existing `refreshPreviewForSession()` pattern
4. After AI file actions complete, auto-create a checkpoint using existing `POST /api/git/:sessionId/commit` endpoint
5. After checkpoint creation, refresh the checkpoint list using existing `loadCheckpoints()` pattern

---

## 8. Functional Requirements

1. Post-AI-action refresh must be request-driven only (triggered by completion of AI file actions, not by timers or watchers)
2. File tree refresh must show new/changed files (file deletion is not part of the AI-03-01 first slice; delete support may be added in a future AI-03 spec)
3. Editor must reload content if the active file was modified
4. Preview must refresh to pick up changed application code
5. Checkpoint must be auto-created with metadata indicating it was AI-triggered
6. Checkpoint list must update to show the new checkpoint
7. All refresh paths must reuse existing patterns from Phase 78B/79/80

---

## 9. UX Requirements

1. User sees file tree update after AI changes files
2. Editor shows updated content if AI modified the active file
3. Preview refreshes to reflect code changes
4. History surface shows a new checkpoint entry after AI action
5. No manual intervention required for coherence — it happens automatically after AI action completes

---

## 10. Backend Requirements

1. Existing `POST /api/git/:sessionId/commit` must accept AI-triggered checkpoint creation — no new endpoints
2. For the first slice, the existing `description` field on the commit request is sufficient to indicate AI-triggered source; no new metadata fields or schema changes
3. Reuse existing commit, file list, file read, preview status endpoints only

---

## 11. Frontend Requirements

1. After AI file-action results are received, trigger the post-action refresh sequence
2. Reuse existing `loadWorkspaceFilesForSession()`, `loadCheckpoints()`, `refreshPreviewForSession()` patterns from Phase 78B/79/80
3. Stale-request guards must apply to all refresh calls (existing pattern)
4. Editor content update must use existing `loadWorkspaceFileContent()` path

---

## 12. Data/State Expectations

- Auto-created checkpoint uses the same data model and endpoint as manual checkpoints (`POST /api/git/:sessionId/commit`)
- For the first slice, checkpoint description is a simple string indicating AI action context (e.g., "AI: created/modified files") passed via the existing `description` field — no new metadata fields or schema changes required
- Richer AI checkpoint metadata (model name, prompt summary, per-file change list) is deferred to a future enhancement and must not block this spec
- No new database entities required

---

## 13. Error Handling Requirements

1. If auto-checkpoint creation fails → log error, do not block file tree/editor/preview refresh
2. If file tree refresh fails → show existing error state, do not corrupt editor
3. If preview refresh fails → show existing unavailable/error state
4. Partial refresh success is acceptable — each surface refreshes independently

---

## 14. Acceptance Criteria

- [ ] After AI writes files, file tree shows the new/changed files without manual refresh
- [ ] After AI modifies the currently selected file, editor shows updated content
- [ ] After AI writes files, preview panel refreshes
- [ ] After AI writes files, a checkpoint is auto-created
- [ ] History surface shows the new AI-triggered checkpoint
- [ ] All refresh uses existing request-driven patterns
- [ ] No background workers, polling, or websocket behavior introduced
- [ ] Existing manual checkpoint, revert, and chat behavior preserved

---

## 15. Invariants to Preserve

- Request-driven behavior only (ARCHITECTURE Section 2)
- Session isolation
- Stale-request guards on all async refresh paths
- Existing checkpoint equality guard (`areCheckpointListsEqual`)
- Existing preview, file-tree, editor state machines

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| AI-03-01 | Planned | AI file actions that trigger coherence refresh |
| Phase 78B post-exec refresh pattern | Complete | Reusable refresh orchestration |
| Phase 79A preview refresh | Complete | Preview coherence |
| Phase 79B file tree load | Complete | File tree coherence |
| Phase 80B checkpoint creation | Complete | Auto-checkpoint |

---

## 17. Risks / Edge Cases

- Rapid successive AI actions may cause overlapping refresh sequences — stale-request guards should handle this
- Large file tree changes may cause noticeable refresh delay
- Auto-checkpoint on every AI action could create many checkpoints — may need a debounce or "only if files actually changed" guard

---

## 18. Suggested Implementation Slices

1. **Post-AI file tree + editor refresh** — Trigger existing file-tree and editor-content refresh after AI file actions complete.
2. **Post-AI preview refresh** — Trigger existing preview refresh after AI file actions complete.
3. **Post-AI auto-checkpoint** — Auto-create checkpoint after AI file actions and refresh checkpoint list.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Richer checkpoint metadata (AI model, prompt summary) — future enhancement
- Debounced checkpoint creation for rapid AI actions — future optimization
- File-level change annotations in history surface — future polish
