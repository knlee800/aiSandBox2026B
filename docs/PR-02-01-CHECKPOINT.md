# PR-02-01 CHECKPOINT — Project Import and Export

## Task Metadata

| Field | Value |
|---|---|
| Task ID | PR-02-01 |
| Title | Project Import and Export |
| Family | PR-01 (Project Persistence) |
| Nature | IMPLEMENTATION (PROJECT PORTABILITY, ARCHIVE IMPORT/EXPORT) |
| Status | COMPLETE and LOCKED |
| Checkpoint | `docs/PR-02-01-CHECKPOINT.md` |
| Dependencies | PR-01-01 (Complete and Locked) |

---

## Objective Completed

Implemented the project-portability slice so a user can download the current workspace as a zip archive and upload/import a zip archive into a session workspace, using bounded files-only behavior built on the existing PR-01-01 snapshot/session-write foundation.

Backend: new `WorkspaceArchiveService` in the existing `SnapshotsModule` with pure-Node.js zip encode/decode (using Node's built-in `zlib`, no new external dependencies). Two new session controller endpoints: `GET /api/sessions/:id/export` streams a zip archive; `POST /api/sessions/:id/import` accepts a `multipart/form-data` file upload, validates, and applies the archive into the session workspace. Both enforce JWT auth and session ownership, and reuse existing container-manager list/read/write paths.

Frontend: `exportWorkspaceArchive` and `importWorkspaceArchive` helpers added to the existing `workspace-snapshots.logic.ts` module; state type and handlers (`handleExportWorkspaceArchive`, `handleImportWorkspaceArchive`) wired additively into `page.tsx`; `HistorySnapshotPanel` in `workspace-shell.tsx` extended with Download Project button and Import Project file-upload label. All changes are additive to the PR-01-01 snapshot surface.

---

## Exact Files Changed

### New files — api-gateway
- `services/api-gateway/src/snapshots/workspace-archive.service.ts`
- `services/api-gateway/src/snapshots/workspace-archive.service.spec.ts`

### Modified files — api-gateway
- `services/api-gateway/src/sessions/session.controller.ts` — added `GET /api/sessions/:id/export` (StreamableFile) and `POST /api/sessions/:id/import` (FileInterceptor multipart upload); injected `WorkspaceArchiveService`; added `WorkspaceArchiveService` mock to all existing `beforeEach` blocks; added PR-02-01 import/export controller test suite
- `services/api-gateway/src/sessions/session.controller.spec.ts` — added `WorkspaceArchiveService` mock provider to all existing test suites; added `describe('SessionController (PR-02-01 import/export)')` with 4 tests
- `services/api-gateway/src/snapshots/snapshots.module.ts` — added `WorkspaceArchiveService` to providers and exports

### Modified files — frontend
- `frontend/app/[locale]/app/page.tsx` — imported `exportWorkspaceArchive` and `importWorkspaceArchive`; extended `snapshotActionState` type with `'exporting' | 'importing'`; added `handleExportWorkspaceArchive` and `handleImportWorkspaceArchive` handlers; passed `onExportWorkspaceArchive` and `onImportWorkspaceArchive` props to `WorkspaceShell`
- `frontend/components/workspace/workspace-shell.tsx` — extended `WorkspaceShellProps` and `HistorySnapshotPanel` with export/import props and state types; added Download Project button and Import Project file-upload label to `HistorySnapshotPanel`
- `frontend/components/workspace/workspace-shell.test.tsx` — added `onExportWorkspaceArchive` and `onImportWorkspaceArchive` to snapshot surface test props; added assertions for "Download Project" and "Import Project" labels
- `frontend/components/workspace/workspace-snapshots.logic.ts` — added `exportWorkspaceArchive` and `importWorkspaceArchive` client helpers
- `frontend/components/workspace/workspace-snapshots.logic.test.ts` — added 2 new tests for export/import client helpers

---

## Exact Tests Run and Results

- `services/api-gateway`: `npm test -- session.controller.spec.ts snapshot-persistence.service.spec.ts workspace-archive.service.spec.ts users.controller.spec.ts` → **PASS** (4 suites, 38 tests)
- `services/api-gateway`: `npm run build` → **PASS**
- `frontend`: `npm test -- workspace-snapshots.logic.test.ts workspace-shell.test.tsx` → **PASS** (17 suites, 132 tests)
- `frontend`: `npx tsc --noEmit` → **PASS**
- Changed-file lints (all modified files) → no linter errors
- `frontend/tsconfig.tsbuildinfo` was reverted before final diff; it is a generated incremental build metadata file and is not intentionally tracked.

---

## No Migration Was Required

No database schema changes. No TypeORM entity changes. No new PostgreSQL tables. No new external npm dependencies. Zip encode/decode uses Node.js built-in `zlib` only. No migration scripts were added or required.

---

## Scope Statement

Scope stayed fully within PR-02-01. No new service boundaries. No persistent project entity introduced. No GitHub/GitLab integration. No partial/selective import. No public sharing. No collaborative access. No real-time sync. No quota/billing/auth redesign. No background workers. No refactors beyond the minimum required for `WorkspaceArchiveService` injection. No changes to existing PR-01-01 snapshot save/restore behavior.

---

## Preserved Behaviors

- **Phase 79B** — file tree / `loadWorkspaceFilesForSession()` / `loadWorkspaceFileContent()` patterns unchanged. After import, `loadWorkspaceFilesForSession` is called normally to refresh the file tree.
- **Phase 80A–80C** — editor save, manual checkpoint, revert, existing `POST /api/git/:sessionId/commit` path unchanged. After import, `loadCheckpoints` is called normally.
- **Phase 79A** — preview refresh (`refreshPreviewForSession`) unchanged. After import, preview is refreshed normally.
- **AI-03-01 / AI-03-02** — AI file-action apply and workspace coherence flows unchanged.
- **AI-04-01** — backend chat persistence unchanged. Session chat thread state is not affected by import/export operations.
- **PR-01-01 snapshot foundation** — `SnapshotPersistenceService`, save/restore/list endpoints, and `HistorySnapshotPanel` snapshot controls are entirely unchanged. PR-02-01 adds to the same panel and module additively.
- **Auth / ownership enforcement** — both new endpoints (`GET /api/sessions/:id/export`, `POST /api/sessions/:id/import`) require JWT auth and enforce session ownership via `sessionService.getSessionById` + `userId` comparison, matching the existing pattern.
- **Request-driven behavior** — all import/export operations are request-driven only. No polling, no filesystem watchers, no background workers, no websocket push introduced.

---

## Delivered Capability

1. **Export** — `GET /api/sessions/:id/export` (JWT required, session ownership enforced): collects all workspace files recursively via existing `listSessionDirectory` / `readSessionFile` container-manager HTTP paths, encodes them as a Deflate-compressed zip archive using Node.js built-in `zlib`, and streams it as a `StreamableFile` with `Content-Type: application/zip` and a `Content-Disposition` filename. No external dependencies added.

2. **Import** — `POST /api/sessions/:id/import` (JWT required, session ownership enforced, `multipart/form-data`): accepts a `.zip` file upload (max 5 MB), validates it (EOCD + local header signatures, path traversal rejection, unsupported compression rejection, per-file size limit 512 KB, total extracted size limit 20 MB, max 500 files), clears the target session workspace via the existing bounded exec path, then replays all decoded files via the existing `writeSessionFile` container-manager HTTP path. Fails clearly on any validation failure without leaving ambiguous partial state.

3. **Archive validation** — rejects: malformed archives (missing EOCD/local headers), path traversal attempts (`..`, absolute paths, null bytes), unsupported compression methods (only stored=0 and deflate=8 accepted), oversized archives (upload limit 5 MB, extracted limit 20 MB), non-UTF8 file content.

4. **Frontend minimum path** — Download Project button (triggers `GET /api/sessions/:id/export`, triggers browser download via `URL.createObjectURL`) and Import Project file-upload label (triggers `POST /api/sessions/:id/import` with selected `.zip` file) in the existing `HistorySnapshotPanel`. After import: file tree, preview, and checkpoint list refresh via existing request-driven helpers. Loading / success / error feedback states for both actions.

5. **No persistent project entity** — export/import is session-scoped only. No project model, no project table, no project identity introduced.

---

## Follow-up Boundary

The next planned persistence work is **PR-03-01 (Project Identity)**, which introduces a persistent project entity, project names, and a project list surface. It must be registered and approved before implementation begins. PR-03-01 would allow snapshots and archives to be associated with named projects rather than raw session IDs.
