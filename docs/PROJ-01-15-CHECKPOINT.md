# PROJ-01-15 CHECKPOINT

## Task Metadata

- Task ID: PROJ-01-15
- Title: Fix Nested Project Export Path Construction
- Nature: BUG FIX (PROJECT DOWNLOAD, ARCHIVE PATHS)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-01-15-CHECKPOINT.md`

## Objective

Fix project export so nested directories are traversed using valid workspace-relative paths instead of invalid absolute paths like `/src` that are rejected by the workspace path guard.

## Root Cause

`WorkspaceArchiveService.collectFilePathsRecursively()` started recursion from `'/'` and constructed child directory paths as absolute (`/src`, `/src/...`).

These absolute nested paths were sent to container-manager `listSessionDirectory`, where the existing path guard correctly rejects absolute paths outside `/workspace` with:

- `400 Bad Request`
- `Absolute paths outside /workspace not allowed`

## Fix Applied (Smallest Safe Boundary)

Updated recursion path construction in `services/api-gateway/src/snapshots/workspace-archive.service.ts`:

- Start recursion with empty relative path (`''`) instead of `'/'`
- Use `listPath = '/'` only for root listing call
- Build child recursion paths as workspace-relative (`src`, `src/app.ts`, ...)
- Keep returned exported file paths unchanged as relative paths

No changes were made to container-manager path guard behavior.

## Files Changed

- `services/api-gateway/src/snapshots/workspace-archive.service.ts`
- `services/api-gateway/src/snapshots/workspace-archive.service.spec.ts`

## Validation Run

1) Focused archive tests:

- Command: `npm test -- workspace-archive.service.spec.ts`
- Result: **PASS**
  - 1 suite passed
  - 5 tests passed
  - includes:
    - root export success
    - nested export recursion uses `'src'` (relative) and exports `src/app.ts`

2) Build/type validation:

- Command: `npm run build`
- Result: **PASS**

3) Path guard behavior preserved:

- Existing behavior preserved by design (no guard changes in this task).
- Nested-recursion test proves fix avoids generating `/src`; guard contract remains intact.

## Scope and Invariants

- No export redesign
- No path-guard redesign
- No workspace redesign
- No scope expansion
