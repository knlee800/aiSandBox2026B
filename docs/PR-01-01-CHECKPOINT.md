# PR-01-01 CHECKPOINT — Project Save and Restore

## Task Metadata

| Field | Value |
|---|---|
| Task ID | PR-01-01 |
| Title | Project Save and Restore |
| Family | PR-01 (Project Persistence) |
| Nature | IMPLEMENTATION (PROJECT PERSISTENCE, FILES-ONLY SNAPSHOT FOUNDATION) |
| Status | COMPLETE and LOCKED |
| Checkpoint | `docs/PR-01-01-CHECKPOINT.md` |
| Dependencies | AI-04-01 (Complete and Locked); Phase 79/80 (Complete and Locked) |

---

## Objective Completed

Implemented the first project-persistence slice so a user can save the current workspace state from an active session and later restore that saved files-only snapshot into a session, without introducing a persistent project entity.

Backend: three new api-gateway endpoints backed by a new `SnapshotPersistenceService` that collects workspace files from the active session via the existing container-manager HTTP client, stores them durably as a JSON payload on the api-gateway host filesystem, and restores them by replaying writes back through the existing session file-write path. All three endpoints enforce JWT auth and session ownership.

Frontend: a new `workspace-snapshots.logic.ts` client module with `saveWorkspaceSnapshot`, `loadWorkspaceSnapshots`, and `restoreWorkspaceSnapshot` helpers; minimal snapshot state and handlers wired into `page.tsx`; a minimal `HistorySnapshotPanel` component rendered inside the existing History / Control section of `workspace-shell.tsx` with save/list/restore buttons, feedback states (loading / success / error), and snapshot selection.

---

## Exact Files Changed

### New files — api-gateway
- `services/api-gateway/src/snapshots/snapshot-persistence.service.ts`
- `services/api-gateway/src/snapshots/snapshot-persistence.service.spec.ts`
- `services/api-gateway/src/snapshots/snapshots.module.ts`
- `services/api-gateway/src/snapshots/dto/save-snapshot.dto.ts`
- `services/api-gateway/src/snapshots/dto/restore-snapshot.dto.ts`

### Modified files — api-gateway
- `services/api-gateway/src/sessions/session.controller.ts` — added `POST /api/sessions/:id/snapshot` and `POST /api/sessions/:id/restore`; injected `SnapshotPersistenceService`
- `services/api-gateway/src/sessions/session.module.ts` — imported `SnapshotsModule`
- `services/api-gateway/src/sessions/session.controller.spec.ts` — added PR-01-01 snapshot ownership/auth test suite; added `SnapshotPersistenceService` mock to all existing `beforeEach` blocks
- `services/api-gateway/src/users/users.controller.ts` — added `GET /api/users/me/snapshots`; injected `SnapshotPersistenceService`
- `services/api-gateway/src/users/users.module.ts` — imported `SnapshotsModule`
- `services/api-gateway/src/users/users.controller.spec.ts` — added snapshot list test; added `SnapshotPersistenceService` mock

### New files — frontend
- `frontend/components/workspace/workspace-snapshots.logic.ts`
- `frontend/components/workspace/workspace-snapshots.logic.test.ts`

### Modified files — frontend
- `frontend/app/[locale]/app/page.tsx` — imported snapshot logic; added `workspaceSnapshots`, `selectedSnapshotId`, `snapshotListState`, `snapshotActionState`, `snapshotActionMessage`, `snapshotActionError` state; added `loadWorkspaceSnapshotsForUser`, `handleSaveWorkspaceSnapshot`, `handleRestoreWorkspaceSnapshot`, `handleSnapshotSelection` handlers; wired all into `WorkspaceShell` props; calls `loadWorkspaceSnapshotsForUser` on session selection change
- `frontend/components/workspace/workspace-shell.tsx` — added optional snapshot props to `WorkspaceShellProps`; added `HistorySnapshotPanel` component; rendered `HistorySnapshotPanel` in History / Control section
- `frontend/components/workspace/workspace-shell.test.tsx` — added `workspace shell snapshot surface` test suite (2 tests)

---

## Exact Tests Run and Results

- `services/api-gateway`: `npm test -- session.controller.spec.ts users.controller.spec.ts snapshot-persistence.service.spec.ts` → **PASS** (3 suites, 30 tests)
- `frontend`: `npm test -- workspace-snapshots.logic.test.ts workspace-shell.test.tsx` → **PASS** (17 suites, 130 tests)
- `frontend`: `npx tsc --noEmit` → **PASS**
- Changed-file lints (all modified files) → no linter errors
- `frontend/tsconfig.tsbuildinfo` was reverted before final diff; it is a generated incremental build metadata file and is not intentionally tracked.

---

## No Migration Was Required

No database schema changes. No TypeORM entity changes. No new PostgreSQL tables. Snapshot storage uses the api-gateway host filesystem under a `snapshot-store/` directory organized by `userId`. No migration scripts were added or required.

---

## Scope Statement

Scope stayed fully within PR-01-01. No new product surfaces beyond the minimum save/list/restore snapshot path. No persistent project entity introduced. No project naming system. No import/export archive UX. No public sharing. No collaborative access. No real-time sync. No git/history redesign. No quota/billing/auth redesign. No background workers. No refactors beyond the strictly required service/module wiring.

---

## Preserved Behaviors

- **Phase 79B** — file tree / `loadWorkspaceFilesForSession()` / `loadWorkspaceFileContent()` patterns unchanged. After restore, `loadWorkspaceFilesForSession` is called normally to refresh the file tree.
- **Phase 80A–80C** — editor save, manual checkpoint, revert, existing `POST /api/git/:sessionId/commit` path unchanged. After restore, `loadCheckpoints` is called normally.
- **Phase 79A** — preview refresh (`refreshPreviewForSession`) unchanged. After restore, preview is refreshed normally.
- **AI-03-01 / AI-03-02** — AI file-action apply and workspace coherence flows unchanged.
- **AI-04-01** — backend chat persistence unchanged. Session chat thread state is not affected by snapshot operations.
- **Auth / ownership enforcement** — all three new endpoints (`POST /api/sessions/:id/snapshot`, `POST /api/sessions/:id/restore`, `GET /api/users/me/snapshots`) require JWT auth. Save and restore enforce session ownership via `sessionService.getSessionById` and `userId` comparison; restore also uses `userId` as the snapshot lookup key, preventing cross-user access.
- **Request-driven behavior** — all snapshot operations are request-driven only. No polling, no filesystem watchers, no background workers, no websocket push introduced.

---

## Delivered Capability

1. **Save** — `POST /api/sessions/:id/snapshot` (JWT required, session ownership enforced): collects all files in the active session workspace recursively via the existing `listSessionDirectory` / `readSessionFile` container-manager HTTP paths, stores them as a durable JSON payload keyed by `userId` on the api-gateway host filesystem, returns snapshot metadata (`id`, `userId`, `label`, `createdAt`, `fileCount`).

2. **List** — `GET /api/users/me/snapshots` (JWT required): returns all saved snapshot metadata for the current user, sorted descending by `createdAt`. Only the current user's snapshots are returned; no cross-user access.

3. **Restore** — `POST /api/sessions/:id/restore` (JWT required, session ownership enforced): loads the saved snapshot payload for the requesting user and snapshot ID, clears the target session workspace via a bounded `find ... -exec rm -rf` shell command through the existing exec path, then replays all snapshot files back via the existing `writeSessionFile` container-manager HTTP path. Fails clearly if snapshot not found or write fails.

4. **Frontend minimum path** — `HistorySnapshotPanel` inside History / Control section: Save Snapshot button (active only when a session is selected), Restore Snapshot button (active only when a session + snapshot are selected), snapshot selection dropdown, loading / success / error feedback states. On save: lists are refreshed and new snapshot auto-selected. On restore: file tree, preview, checkpoint list, and snapshot list are all refreshed via existing request-driven helpers.

5. **No persistent project entity** — snapshots are keyed only by `userId + snapshotId`. No project model, no project table, no project identity introduced.

---

## Follow-up Boundary

The next planned persistence work is **PR-02-01 (Project Import and Export)**, which extends durability to portable archive import/export for cross-environment and cross-user sharing. It must be registered and approved before implementation begins.

The existing container-manager `ProjectsService` (used in the legacy session create flow) is a separate older system and was not modified or depended on in PR-01-01.
