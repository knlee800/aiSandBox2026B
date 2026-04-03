# Spec: PR-03-01 — Project Identity

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | PR-03-01 |
| **Title** | Project Identity |
| **Status** | Draft |
| **Master plan alignment** | Section 7.4 PR-03, Phase 4 |
| **Related task IDs** | None yet registered |
| **Depends on** | PR-01-01 (Project Save/Restore — files-only persistence must exist first) |
| **Enables** | Stable project-level access, project list/dashboard, future sharing, named save-point association |

---

## 2. Problem

There is no project entity distinct from sessions. PR-01-01 provides files-only save/restore, but saved snapshots have no persistent project identity, no project list, and no stable handle. Users have no named, persistent identity for their work beyond individual saved snapshots.

---

## 3. Why This Matters

The master plan Section 7.4 requires "stable project-level access distinct from session-level runtime." Projects are the user's persistent work unit; sessions are temporary execution environments.

---

## 4. Goal

Introduce a persistent project entity that links to sessions and saved project state, giving users a stable handle for their work.

---

## 5. Non-Goals

- No public slugs/permalinks (future)
- No team/shared project access
- No project templates or marketplace
- No project-level settings beyond name/metadata

---

## 6. Existing Relevant Completed Work to Preserve

- Session lifecycle
- PR-01-01 save/restore (dependency)
- Workspace UI

---

## 7. Scope

1. Project entity in database: id, name, user_id, created_at, updated_at
2. Project-session association: sessions can belong to a project
3. Project list in UI (dashboard or workspace sidebar)
4. Create project, rename project
5. Open project → create/restore session from project

---

## 8. Functional Requirements

1. User can create a named project
2. Sessions are optionally associated with a project
3. User can see a list of their projects
4. User can open a project (creates new session or restores saved state)
5. Project persists after session ends
6. Auth/ownership enforced on all project operations

---

## 9. UX Requirements

1. Project list visible in dashboard or workspace entry
2. "New Project" action
3. Project name displayed in workspace when active
4. Session creation can be project-scoped

---

## 10. Backend Requirements

1. Project entity and database migration
2. CRUD endpoints for projects (create, list, get, update name)
3. Session-project association (optional FK on session table or join table)
4. Auth/ownership on all project endpoints

---

## 11. Frontend Requirements

1. Project list component
2. Create project flow
3. Project context in workspace UI
4. Session creation wired to project context

---

## 12. Data/State Expectations

- Project entity: `id`, `name`, `user_id`, `created_at`, `updated_at`
- Session table gets optional `project_id` field
- Saved project archives (PR-01-01) link to project ID

---

## 13. Error Handling Requirements

1. Duplicate project name → clear error or auto-suffix
2. Project not found → 404
3. Unauthorized access → 403/401

---

## 14. Acceptance Criteria

- [ ] User can create a named project
- [ ] User can see their project list
- [ ] Creating a session can be associated with a project
- [ ] Project persists after session ends
- [ ] Project can be reopened with new session
- [ ] Auth/ownership enforced

---

## 15. Invariants to Preserve

- Session isolation (project association does not break isolation)
- Existing session lifecycle
- Existing workspace behavior

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| PR-01-01 | Planned | Saved state linked to project |
| Session lifecycle | Complete | Sessions to associate with projects |

---

## 17. Risks / Edge Cases

- Migration adding `project_id` to sessions must be backward-compatible (nullable)
- Orphan sessions (no project) should continue working

---

## 18. Suggested Implementation Slices

1. **Backend: Project entity and CRUD** — Database migration, endpoints.
2. **Backend: Session-project association** — Optional FK, wiring.
3. **Frontend: Project list and create flow** — UI components.
4. **Frontend: Workspace project context** — Display project name, wire session creation.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Project slugs/permalinks
- Public project access
- Project deletion with cascade
- Project-level settings/configuration
