# Spec: PR-01-01 — Project Save and Restore

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | PR-01-01 |
| **Title** | Project Save and Restore |
| **Status** | Draft |
| **Master plan alignment** | Section 7.4 PR-01, Phase 4 |
| **Related task IDs** | None yet registered |
| **Depends on** | AI-03-01 (core product loop working), PF-04 (file system operational) |
| **Enables** | PR-02-01 (Import/Export), PR-03-01 (Project Identity — adds project entity on top of this files-only persistence) |

---

## 2. Problem

All workspace state is tied to ephemeral sessions. When a session expires or is terminated, all work is lost. Users have no way to persist their project beyond session lifetime.

---

## 3. Why This Matters

The master plan Phase 4 requires that "session expiry does not imply work loss." Without save/restore, the platform is unusable for any work that takes longer than a single session.

---

## 4. Goal

Allow users to save their workspace state as a persistent project that outlives session expiration and restore it into a new session later.

---

## 5. Non-Goals

- No project entity or project list — this spec is files-only persistence; the project entity is introduced later in PR-03-01
- No real-time sync between sessions
- No collaborative project access
- No complex version control UI beyond existing checkpoint model
- No public sharing or marketplace
- No cross-user project access

---

## 6. Existing Relevant Completed Work to Preserve

- Session lifecycle (create/stop/terminate)
- File tree, editor, preview behavior
- Checkpoint/git model
- Chat panel behavior
- Auth/quota behavior

---

## 7. Scope

1. Save: persist workspace files and git history from an active session to durable storage
2. Restore: load a saved project into a new session, populating workspace files and optionally git history
3. User can see their saved projects and choose one to restore
4. Save can be triggered manually by the user

---

## 8. Functional Requirements

1. Save operation captures workspace files from the session container
2. Save operation captures git history/checkpoints if feasible
3. Saved project is associated with the user
4. Restore operation creates or reuses a session and populates workspace from saved state
5. Restore must not corrupt the target session if it fails
6. Multiple saved projects per user must be supported

---

## 9. UX Requirements

1. "Save Project" action available in workspace when session is active
2. User can see a list of saved projects (in workspace or dashboard)
3. "Restore Project" action available when creating or selecting a session
4. Clear feedback on save/restore progress and success/failure

---

## 10. Backend Requirements

1. Persistent storage for saved projects (filesystem, object storage, or database blobs)
2. API endpoints: save project, list saved projects, restore project into session
3. Auth/ownership enforcement on all project endpoints
4. Save must work with container-manager to extract workspace contents

---

## 11. Frontend Requirements

1. Save Project button/action in workspace UI
2. Saved Projects list in workspace or dashboard
3. Restore action tied to session creation or selection flow
4. Save/restore state feedback (loading, success, error)

---

## 12. Data/State Expectations

- Saved project is a files-only workspace snapshot — no project entity or project ID required at this layer
- Saved snapshot includes: file tree snapshot, optional git history, metadata (user-provided label, timestamp, user ID)
- Storage format: archive (tar/zip) or equivalent
- Saved snapshot size limits should be reasonable for initial implementation
- The project entity (PR-03-01) will later wrap saved snapshots with a persistent identity; this spec must not assume it exists

---

## 13. Error Handling Requirements

1. Save failure → clear error message, no partial corrupt save
2. Restore failure → clear error message, session not corrupted
3. Storage full → appropriate user-facing error
4. Session terminated during save → graceful failure

---

## 14. Acceptance Criteria

- [ ] User can save workspace state from an active session
- [ ] Saved project persists after session expires
- [ ] User can create a new session and restore a saved project into it
- [ ] Restored workspace contains the saved files
- [ ] Multiple saved projects per user are supported
- [ ] Existing workspace, chat, checkpoint behavior is preserved

---

## 15. Invariants to Preserve

- Session isolation (save/restore does not affect other sessions)
- Auth/ownership enforcement
- Checkpoint/history model
- File tree/editor/preview behavior

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| AI-03-01/02 | Planned | Core product loop should work before persistence matters |
| Session lifecycle | Complete | Sessions to save from and restore into |
| File system endpoints | Complete | Extracting workspace contents |

---

## 17. Risks / Edge Cases

- Large workspaces may be slow to save/restore
- Git history preservation adds complexity — may defer to a simpler files-only save for first slice
- Concurrent save attempts on the same session should be handled
- Restoring into a non-empty session workspace needs clear semantics (overwrite vs merge)

---

## 18. Suggested Implementation Slices

1. **Backend: Save project endpoint** — Extract workspace files, store as archive, associate with user.
2. **Backend: List/restore project endpoints** — List saved projects, restore archive into session workspace.
3. **Frontend: Save/restore UI** — Save button, project list, restore action.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Automatic/periodic saves (auto-save projects)
- Project versioning (multiple save points per project)
- Shared/public projects
- Git-preserving restore (beyond basic file restore)
