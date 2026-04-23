# PROJ-03-C1b-pre CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C1b-pre
- Title: Add Restore Project From Snapshot Handler Behind Feature Flag
- Nature: FRONTEND / PHASE C RESTORE HANDLER (PREPARATORY)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C1b-pre-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C1b split: C1b-pre handler-only slice
- Depends on: PROJ-03-C1a (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, add a parameterized handler (`handleRestoreWorkspaceProjectFromSnapshotById(projectId: string, snapshotId: string)`) in `frontend/app/[locale]/app/page.tsx` that opens a caller-supplied project at a caller-supplied snapshot via the locked B0 helper in a freshly created session, mirroring the locked B4a hydration sequence exactly, and expose it as a new optional callback prop on `WorkspaceShell`. No UI consumer in this slice.

## Scope Statement

This is a **handler-only preparatory slice with no visible UI change**. No user-facing affordance (Restore button, banner, row action) was added. No existing handler body was modified. The only production changes are:

1. A new async handler function in `frontend/app/[locale]/app/page.tsx`.
2. One new optional prop declaration in `WorkspaceShellProps` in `frontend/components/workspace/workspace-shell.tsx`.
3. The new handler passed as that prop in the `<WorkspaceShell>` JSX in `page.tsx`.

The visible Restore-button UI belongs to the follow-on `PROJ-03-C1b-cta` slice, which is not yet registered or started.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | New `handleRestoreWorkspaceProjectFromSnapshotById` handler added; `onRestoreWorkspaceProjectFromSnapshotById={handleRestoreWorkspaceProjectFromSnapshotById}` prop passed to `WorkspaceShell`. |
| `frontend/components/workspace/workspace-shell.tsx` | One new optional prop `onRestoreWorkspaceProjectFromSnapshotById?: (projectId: string, snapshotId: string) => Promise<void>` added to `WorkspaceShellProps` interface. No JSX or render logic changed. |

No other source files were modified. `frontend/lib/open-project-in-fresh-session.ts` unchanged.

## Handler Implemented

### `handleRestoreWorkspaceProjectFromSnapshotById(projectId: string, snapshotId: string)` — `frontend/app/[locale]/app/page.tsx` (lines 1308–1376)

**Early-return guards (in order):**

1. `if (!PROJECT_FIRST_UX) return;` — kill-switch. Flag off: function returns immediately without setting `projectOpenInProgressRef` or calling any API.
2. `const normalizedProjectId = projectId.trim(); if (!normalizedProjectId) return;` — empty/invalid `projectId` guard. Returns without side effects.
3. `const normalizedSnapshotId = snapshotId.trim(); if (!normalizedSnapshotId) return;` — empty/invalid `snapshotId` guard. Returns without side effects. Placed before the token guard, matching the principle that parameter validation precedes I/O.
4. Token guard: `localStorage.getItem('access_token')` — missing token redirects to login and returns without setting `projectOpenInProgressRef`.

**Active path (flag on + valid `projectId` + valid `snapshotId` + token present):**

- `setProjectActionState('opening')`, `setProjectActionMessage(null)`, `setProjectActionError(null)`.
- `projectOpenInProgressRef.current = true` — set before the `try` block so the `finally` always clears it.
- `const openResult = await openProjectInFreshSession({ token, projectId: normalizedProjectId, snapshotId: normalizedSnapshotId })` — B0 helper called with both the parameterized `projectId` and `snapshotId`. No React state read for either ID.
- Hydration follow-up sequence (all 11 steps, mirroring B4a exactly):
  1. `skipNextSessionEffectFileReloadRef.current = openSessionId !== selectedSessionIdRef.current`
  2. `setSelectedSessionId(openSessionId)`
  3. `await hydrateWorkspaceForProjectOpen(token, openSessionId, expectsRestoredFiles)`
  4. `await refreshPreviewForSession(token, openSessionId)`
  5. `await loadCheckpoints(token, openSessionId)`
  6. `await loadSessions(token)`
  7. `setSelectedSessionId((current) => current ?? openSessionId)`
  8. `await loadWorkspaceSnapshotsForUser(token)`
  9. `await loadWorkspaceProjectsForUser(token)`
  10. `await loadPublicWorkspaceProjectsList()`
  11. `await loadDashboardSlice(token)`
- Success outcome: `setProjectActionState('success')`, `setProjectActionMessage('Project opened.')`, `setProjectActionError(null)`.
- Catch: sets `projectActionState('error')` with the error message or fallback `'Failed to open project.'`.
- **`finally` block** (always fires): `projectOpenInProgressRef.current = false` and `skipNextSessionEffectFileReloadRef.current = false`.

### Key design decisions

- The handler accepts both `projectId` and `snapshotId` as parameters and normalizes them locally. It does **not** read `selectedProjectId` or `selectedSnapshotId` from React state. This is the same pattern as B4a; caller-supplied IDs are deterministic and race-free.
- The `snapshotId` guard is placed before the token guard to match the principle that cheap parameter validation precedes I/O side effects.
- The handler is otherwise byte-equivalent to `handleResumeWorkspaceProjectById` except for the signature, the added `snapshotId` guard, and passing `snapshotId` to the B0 helper call.

## Prop Surface Change

`WorkspaceShellProps` in `frontend/components/workspace/workspace-shell.tsx` (lines 87–90):

```ts
onRestoreWorkspaceProjectFromSnapshotById?: (
  projectId: string,
  snapshotId: string,
) => Promise<void>;
```

Added after the existing `onResumeWorkspaceProjectById` line. No JSX, no render logic, no consumer code. The prop is declared and passed through but not consumed by any `WorkspaceShell` internal code in this slice. This is intentional; the UI consumer belongs to `C1b-cta`.

## Unchanged Code

| Area | Status |
|---|---|
| `handleResumeWorkspaceProjectById` | Unchanged |
| `handleOpenWorkspaceProject` | Unchanged |
| `handleCreateWorkspaceProject` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| `WorkspaceShell` JSX and render logic | Unchanged |
| C1a `ProjectHistoryPanel` JSX | Unchanged |
| A3 recovery copy bundle | Unchanged |
| B0/B1/B2a/B2b/B3a/B4a/B4b locked paths | Unchanged |
| B3a test file | Unchanged |

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused tests (B0 helper + adjacent primitives + workspace shell)

```
frontend $ npx tsx --test lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 108 tests / 5 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 83/83 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file app/[locale]/app/page.tsx --file components/workspace/workspace-shell.tsx
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C1b-pre. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a/B2b/B3a/B4a/B4b/C1a checkpoints.

### 4. File-level lint check

`ReadLints` run on:

- `frontend/app/[locale]/app/page.tsx` — no linter errors
- `frontend/components/workspace/workspace-shell.tsx` — no linter errors

### 5. Coverage note (honest)

No focused page-handler seam test was added for `handleRestoreWorkspaceProjectFromSnapshotById`. Extracting that seam cleanly would require mocking `localStorage`, `fetch`, `router`, and `useRef` at a page level, which exceeds this slice's boundary. This limitation is consistent with B1/B2a/B2b/B4a — none of those handler slices added a focused page-handler test either. The strongest surrounding verification performed was: typecheck + B0 helper tests + project/snapshot logic tests + workspace shell tests + file-level lint on both changed files.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the two changed source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| No visible UI change in this slice | ✅ Handler-only; unused prop; no JSX/copy change |
| `PROJECT_FIRST_UX` is the kill switch | ✅ Flag off: first guard fires; function returns immediately; `projectOpenInProgressRef` never set |
| Hydration follow-up sequence mirrors B4a exactly | ✅ All 11 steps reproduced in the same order |
| `projectOpenInProgressRef` set before helper call, cleared in `finally` | ✅ Set at line 1335; `finally` fires on all exit paths |
| `skipNextSessionEffectFileReloadRef` cleared in `finally` | ✅ Paired cleanup in same `finally` |
| Handler receives both IDs as parameters; reads neither `selectedProjectId` nor `selectedSnapshotId` from state | ✅ Design intent preserved |
| `snapshotId` guard placed before token guard (cheap validation before I/O) | ✅ Guard order correct |
| Unused optional prop is intentional and acceptable in this slice | ✅ C1b-cta UI slice will consume it |
| B0 helper contract preserved | ✅ Called as-is; `snapshotId` is an existing optional arg; no edits to helper |
| No change to `handleResumeWorkspaceProjectById`, `handleOpenWorkspaceProject`, or `handleCreateWorkspaceProject` | ✅ Not touched |
| No change to C1a `ProjectHistoryPanel` JSX | ✅ Not touched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `projectOpenInProgressRef` discipline followed exactly |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No visible Restore-button UI | ✅ Handler-only preparatory slice only |
| No C1b-cta, C1c, C2, C3, C4, or Phase D/E work | ✅ Handler-only preparatory slice only |
