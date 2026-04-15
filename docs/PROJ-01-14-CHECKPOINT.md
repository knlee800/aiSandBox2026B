# PROJ-01-14 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-14
- Title: Diagnose Project Download Absolute Path Failure
- Nature: BUG INVESTIGATION (PROJECT DOWNLOAD, PATH GUARD)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-14-CHECKPOINT.md`

## Objective

Determine why Download Project fails with "Absolute paths outside /workspace not allowed" and isolate the exact failing stage in the export/download flow.

## Reproduction (Real Flow)

Using the actual export endpoint used by the UI (`GET /api/sessions/:id/export`):

1. Create a session.
2. Write a root-only file (`README.md`) and export -> succeeds.
3. Add a nested file (`src/app.ts`) and export again -> fails with `400`.

Observed response:

- `HTTP/1.1 400 Bad Request`
- `{"statusCode":400,"message":"Absolute paths outside /workspace not allowed"}`

## Exact Flow Chain

Frontend:

- `handleExportWorkspaceArchive()` in `frontend/app/[locale]/app/page.tsx`
- calls `exportWorkspaceArchive()` in `frontend/components/workspace/workspace-snapshots.logic.ts`
- calls `GET /api/sessions/:id/export`

Backend:

- `SessionController.exportSessionWorkspace()` in `services/api-gateway/src/sessions/session.controller.ts`
- calls `WorkspaceArchiveService.exportWorkspaceArchive()`
- calls `collectWorkspaceFiles()`
- calls `collectFilePathsRecursively(sessionId, '/')`

## Exact Failing Stage

Failure occurs in `WorkspaceArchiveService.collectFilePathsRecursively()` path construction for nested directories:

- Root list (`path='/'`) returns directory entry `src` (works).
- Code constructs `nextPath` as `'/src'` when recursing from root.
- That value is passed to container-manager `listSessionDirectory(sessionId, '/src')`.
- Container-manager path guard rejects absolute paths that are not under `/workspace` and returns:
  - `400 Bad Request`
  - `Absolute paths outside /workspace not allowed`

Guard source:

- `services/container-manager/src/docker/docker-runtime.service.ts`
- `validateWorkspacePath(filePath)`
- rejects `filePath.startsWith('/') && !filePath.startsWith('/workspace')`

## Why It Fails

`WorkspaceArchiveService` recursion starts with `'/'` and produces absolute child paths (`'/src'`, `'/src/components'`, etc.).

But the container-manager internal file APIs require paths relative to workspace (or exactly `'/'` for root listing). Therefore, nested directory traversal in export uses the wrong path form and is rejected by the guard.

## Evidence (Minimal)

Internal API probe from api-gateway container to container-manager:

- `GET /api/internal/sessions/:id/dirs?path=/` -> `200`, returns entries including `src`
- `GET /api/internal/sessions/:id/dirs?path=/src` -> `400`, message `Absolute paths outside /workspace not allowed`

This confirms the failure is deterministic and specific to absolute nested path recursion during export.

## Diagnosis Conclusion

The issue is clearly diagnosed and narrowed to one bounded fix task:

- adjust export recursion path generation in `WorkspaceArchiveService` to keep nested paths workspace-relative when calling `listSessionDirectory` / `readSessionFile` (matching snapshot persistence behavior).

No redesign is required.
