# PR-03-01 CHECKPOINT — Project Identity

## Task Metadata

| Field | Value |
|---|---|
| Task ID | PR-03-01 |
| Title | Project Identity |
| Family | PR-01 (Project Persistence) |
| Nature | IMPLEMENTATION (PROJECT PERSISTENCE, PERSISTENT PROJECT ENTITY) |
| Status | COMPLETE and LOCKED |
| Checkpoint | `docs/PR-03-01-CHECKPOINT.md` |
| Dependencies | PR-01-01 (Complete and Locked), PR-02-01 (Complete and Locked) |

---

## Objective Completed

Introduced a persistent `Project` entity on top of the completed files-only save/restore (PR-01-01) and import/export portability (PR-02-01) foundations, giving users a stable named project handle distinct from ephemeral sessions.

Backend: new `Project` entity (id, name, user_id, created_at, updated_at) with a `ProjectsModule` / `ProjectsService` / `ProjectsController` and DTOs for create, rename, and open. Session entity received a nullable `project_id` FK for backward-compatible association. A TypeORM migration creates the `projects` table and the nullable `sessions.project_id` column and FK with `ON DELETE SET NULL`. The open-project endpoint reuses the existing PR-01-01 `SnapshotPersistenceService.restoreSnapshot` path, keeping no new persistence mechanism. All endpoints enforce JWT auth and user-scoped ownership.

Frontend: a new `workspace-projects.logic.ts` client module with `loadWorkspaceProjects`, `createWorkspaceProject`, and `openWorkspaceProject` helpers. Project state and handlers wired additively into `page.tsx`. A minimal `HistoryProjectPanel` component added to `workspace-shell.tsx` with project name input, Create Project button, project select dropdown, and Open Project button. All changes are additive to the existing History / Control section; snapshot and archive surfaces are unchanged.

---

## Exact Files Changed

### New files — api-gateway
- `services/api-gateway/src/entities/project.entity.ts`
- `services/api-gateway/src/migrations/1771587000000-AddProjectsAndSessionProjectId.ts`
- `services/api-gateway/src/projects/projects.module.ts`
- `services/api-gateway/src/projects/projects.service.ts`
- `services/api-gateway/src/projects/projects.controller.ts`
- `services/api-gateway/src/projects/dto/create-project.dto.ts`
- `services/api-gateway/src/projects/dto/rename-project.dto.ts`
- `services/api-gateway/src/projects/dto/open-project.dto.ts`
- `services/api-gateway/src/projects/projects.service.spec.ts`
- `services/api-gateway/src/projects/projects.controller.spec.ts`

### Modified files — api-gateway
- `services/api-gateway/src/app.module.ts` — imported and registered `ProjectsModule`
- `services/api-gateway/src/entities/user.entity.ts` — added `OneToMany(() => Project, ...)` relation
- `services/api-gateway/src/entities/session.entity.ts` — added nullable `project` / `projectId` FK fields
- `services/api-gateway/src/sessions/session.controller.spec.ts` — added `project: null, projectId: null` to all existing `mockActiveSession` / `mockTerminatedSession` fixtures to satisfy updated `Session` type

### New files — frontend
- `frontend/components/workspace/workspace-projects.logic.ts`
- `frontend/components/workspace/workspace-projects.logic.test.ts`

### Modified files — frontend
- `frontend/app/[locale]/app/page.tsx` — imported project logic; added `workspaceProjects`, `selectedProjectId`, `projectNameInput`, `projectListState`, `projectActionState`, `projectActionMessage`, `projectActionError` state; added `loadWorkspaceProjectsForUser`, `handleProjectNameInputChange`, `handleProjectSelection`, `handleCreateWorkspaceProject`, `handleOpenWorkspaceProject` handlers; wired all into `WorkspaceShell` props; calls `loadWorkspaceProjectsForUser` on session selection change
- `frontend/components/workspace/workspace-shell.tsx` — imported `WorkspaceProjectSummary`; added project props to `WorkspaceShellProps`; added `HistoryProjectPanel` component; rendered `HistoryProjectPanel` in History / Control section above existing `HistorySnapshotPanel`
- `frontend/components/workspace/workspace-shell.test.tsx` — added `renders project create/list/open surface` test in the `workspace shell snapshot surface` suite

---

## Exact Tests Run and Results

- `services/api-gateway`: `npm test -- projects.controller.spec.ts projects.service.spec.ts session.controller.spec.ts users.controller.spec.ts` → **PASS** (4 suites, 42 tests)
- `services/api-gateway`: `npm run build` → **PASS**
- `frontend`: `npm test -- workspace-projects.logic.test.ts workspace-snapshots.logic.test.ts workspace-shell.test.tsx` → **PASS** (18 suites, 136 tests)
- `frontend`: `npx tsc --noEmit` → **PASS**
- Changed-file lints (all modified files, backend + frontend) → no linter errors
- `frontend/tsconfig.tsbuildinfo` was reverted before final diff; it is a generated incremental build metadata file and is not intentionally tracked.

---

## Migration Was Required

A TypeORM migration was added and is required before production deployment:

**File:** `services/api-gateway/src/migrations/1771587000000-AddProjectsAndSessionProjectId.ts`

**What it adds:**
- `projects` table: `id` (uuid PK), `name` (varchar 120), `user_id` (uuid FK → `users.id` ON DELETE CASCADE), `created_at`, `updated_at`; indexes on `user_id` and `updated_at`
- `sessions.project_id` column: nullable uuid; index `idx_sessions_project_id`; FK constraint → `projects.id` ON DELETE SET NULL (idempotent `DO $$ BEGIN IF NOT EXISTS ... END $$`)
- `down()` drops the FK, index, column, and table in reverse order

---

## Scope Statement

Scope stayed fully within PR-03-01. No changes to PR-01-01 snapshot persistence logic. No changes to PR-02-01 archive service. No new service boundaries beyond `ProjectsModule`. No new session lifecycle semantics. No public sharing, no team access, no GitHub/GitLab integration, no quota/billing/auth redesign, no background workers, no broad workspace redesign. No refactors beyond the minimal required for entity FK update and existing test fixture extension.

---

## Preserved Behaviors

- **PR-01-01 snapshot save/restore foundation** — `SnapshotPersistenceService`, save/restore/list endpoints, and `HistorySnapshotPanel` snapshot controls are entirely unchanged. The open-project flow reuses `restoreSnapshot` additively.
- **PR-02-01 import/export archive** — `WorkspaceArchiveService`, export/import endpoints, and archive panel controls are entirely unchanged.
- **Phase 79B** — `loadWorkspaceFilesForSession()` / `loadWorkspaceFileContent()` patterns unchanged. `handleOpenWorkspaceProject` calls `loadWorkspaceFilesForSession` after open via existing path.
- **Phase 80A–80C** — editor save, manual checkpoint, revert, `POST /api/git/:sessionId/commit` path unchanged. `handleOpenWorkspaceProject` calls `loadCheckpoints` normally.
- **Phase 79A** — preview refresh (`refreshPreviewForSession`) unchanged. `handleOpenWorkspaceProject` calls `refreshPreviewForSession` normally.
- **AI-03-01 / AI-03-02** — AI file-action apply and workspace coherence flows unchanged.
- **AI-04-01** — backend chat persistence unchanged. Session chat thread state is unaffected by project operations.
- **Existing session lifecycle** — CREATED → ACTIVE → TERMINATED semantics unchanged. Sessions without a `project_id` (legacy) continue to work without modification. Terminated sessions are rejected from `associateSessionWithProject` with `GoneException`.
- **JWT auth / ownership enforcement** — all new endpoints (`POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `POST /api/projects/:id/sessions/:sessionId`, `POST /api/projects/:id/open`) require `JwtAuthGuard`. All service operations scope by `userId`, preventing cross-user leakage.
- **Request-driven behavior** — all project operations are request-driven only. No polling, no filesystem watchers, no background workers, no websocket push introduced.

---

## Delivered Capability

1. **Project entity** — `id`, `name`, `user_id`, `created_at`, `updated_at`. Stored in new `projects` table. User-owned (FK ON DELETE CASCADE). No project description, no project settings, no team access in this slice.

2. **Session association** — `sessions.project_id` nullable FK (ON DELETE SET NULL). Backward-compatible: existing sessions without a project continue to function normally.

3. **Create project** — `POST /api/projects` (JWT required): accepts `{ name }` (max 120 chars), creates `Project` record for current user, returns project metadata.

4. **List user projects** — `GET /api/projects` (JWT required): returns current user's projects ordered by `updatedAt DESC`. No cross-user leakage.

5. **Get project** — `GET /api/projects/:id` (JWT required, user scoped): returns single project or 404 if not owned.

6. **Rename project** — `PATCH /api/projects/:id` (JWT required, user scoped): accepts `{ name }`, updates project name.

7. **Associate session with project** — `POST /api/projects/:id/sessions/:sessionId` (JWT required, user and session ownership enforced): links a non-terminated session to a project via `sessions.project_id`.

8. **Open project into session** — `POST /api/projects/:id/open` (JWT required, user and session ownership enforced): associates the session with the project and, if `snapshotId` is provided, restores that snapshot into the session workspace via the existing `SnapshotPersistenceService.restoreSnapshot` path. Returns `{ projectId, sessionId, restoredSnapshotId }`.

9. **Frontend minimum path** — `HistoryProjectPanel` in the History / Control section: project name input + Create Project button, project dropdown + Open Project button (optionally using the selected snapshot from the existing `HistorySnapshotPanel`). Loading / success / error feedback states. After open: sessions, file tree, preview, and checkpoint list refresh via existing request-driven helpers.

10. **Legacy session compatibility** — sessions created before this migration have no `project_id` and continue to work across all existing flows without modification.

---

## Follow-up Boundary

The persistence family has now delivered: save/restore (PR-01-01), import/export (PR-02-01), and project identity (PR-03-01). Any future work building on projects — such as project-level naming in snapshots, project deletion with cascade, project settings, public sharing, or team access — falls outside the current PR-03-01 scope. No next task has been registered yet.
