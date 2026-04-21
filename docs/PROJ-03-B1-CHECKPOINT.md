# PROJ-03-B1 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B1
- Title: Auto-Create Fresh Session On New Project Behind Feature Flag
- Nature: FRONTEND / PHASE B NEW PROJECT WIRING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B1-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B1 New Project wiring slice
- Depends on: PROJ-03-B0 (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, after a successful New Project creation, invoke the locked B0 helper (`openProjectInFreshSession`) so the user lands in the workspace with the new project opened in a freshly created session, with no intermediate session-selection step.

## Scope Statement

This is a **single call-site wiring change in `frontend/app/[locale]/app/page.tsx`**. The B0 helper (`frontend/lib/open-project-in-fresh-session.ts`) was imported and called as-is; its internals were not modified. The New Project UI affordance was not changed. `handleOpenWorkspaceProject` was not changed. Flag off preserves the legacy New Project flow byte-for-byte. No B2/B3/B4 or later-phase work was performed.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added `openProjectInFreshSession` import; added `PROJECT_FIRST_UX`-guarded block inside `handleCreateWorkspaceProject`. |

No other source files were modified. `frontend/lib/open-project-in-fresh-session.ts` unchanged.

## Flag-On Behavior Implemented

Inside `handleCreateWorkspaceProject`, immediately after `createWorkspaceProject(...)` succeeds, the following block runs **only when `PROJECT_FIRST_UX` is true**:

1. `setSelectedProjectId(createdProject.id)` and `setSelectedProjectVisibility(...)` — set project state before opening.
2. `projectOpenInProgressRef.current = true` — guard set before helper call.
3. `await openProjectInFreshSession({ token, projectId: createdProject.id })` — B0 helper invoked, fully awaited.
4. Hydration follow-up sequence (mirrors `handleOpenWorkspaceProject` exactly):
   - `skipNextSessionEffectFileReloadRef.current = openSessionId !== selectedSessionIdRef.current`
   - `setSelectedSessionId(openSessionId)`
   - `await hydrateWorkspaceForProjectOpen(token, openSessionId, expectsRestoredFiles)`
   - `await refreshPreviewForSession(token, openSessionId)`
   - `await loadCheckpoints(token, openSessionId)`
   - `await loadSessions(token)`
   - `setSelectedSessionId((current) => current ?? openSessionId)`
   - `await loadWorkspaceSnapshotsForUser(token)`
   - `await loadWorkspaceProjectsForUser(token)`
   - `await loadPublicWorkspaceProjectsList()`
   - `await loadDashboardSlice(token)`
5. `setProjectNameInput('')`, `setProjectActionState('success')`, `setProjectActionMessage('Project created.')`, `setProjectActionError(null)`, `return`.
6. **`finally` block** (always fires): `projectOpenInProgressRef.current = false` and `skipNextSessionEffectFileReloadRef.current = false`.

The legacy initial-snapshot step (lines 1060–1078 of the updated file) is **skipped in the flag-on path** because it falls after the `return` inside the guarded block. Newly created projects have no prior snapshot; B0's no-snapshot `associateWorkspaceProjectSession` fallback handles this correctly, leaving `restoredSnapshotId: null` and `expectsRestoredFiles: false`.

## Flag-Off Behavior

When `PROJECT_FIRST_UX` is false the `if (PROJECT_FIRST_UX)` block is not entered and the function falls through to the existing legacy New Project flow unchanged.

## Important Constraints

- `projectOpenInProgressRef` is set before the helper call and cleared in `finally` on every exit path, preserving the PROJ-02-01 anti-race discipline.
- `skipNextSessionEffectFileReloadRef` is also cleared in the same `finally`, mirroring the paired cleanup in `handleOpenWorkspaceProject`.
- `handleOpenWorkspaceProject` internals were not changed.
- New Project UI affordance was not changed.
- B0 helper was imported and called as-is; no edits were made to it.
- Newly created projects may have no snapshot; B0's `associateWorkspaceProjectSession` fallback semantics remain intact.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused tests (helper + adjacent primitives + workspace shell)

```
frontend $ npx tsx --test lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 97 tests / 5 suites, 0 failures.
- `workspace-projects.logic` — 8/8 pass
- `workspace-shell component` — 72/72 pass
- `workspace-shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file app/[locale]/app/page.tsx
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B1. Same issue documented in A0/A1/A3/A2a/A2b/B0 checkpoints.

### 4. File-level lint check

`ReadLints` on `frontend/app/[locale]/app/page.tsx`: **no linter errors found**.

### 5. Coverage note (honest)

No focused page-handler seam test was added for "flag-on calls helper once / flag-off does not / ref discipline on success/failure". Extracting that seam cleanly (mocking `localStorage`, `fetch`, `router`, `useRef`) would require enough scaffolding to exceed this slice's boundary. The strongest surrounding verification performed was: typecheck + B0 helper tests + project/snapshot logic tests + workspace shell tests + file-level lint on the changed file.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the single changed source file.

## Preserved Invariants

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` is kill switch | ✅ Flag off: guard block never entered; legacy flow unchanged |
| Flag off preserves current New Project flow exactly | ✅ No structural change to the flag-off path |
| `projectOpenInProgressRef` set before helper call, cleared in `finally` | ✅ Nested `try/finally` wraps the helper call; `finally` fires on both success and error exit paths |
| `skipNextSessionEffectFileReloadRef` cleared in `finally` | ✅ Paired with `projectOpenInProgressRef` in same `finally` |
| Hydration follow-up parity with `handleOpenWorkspaceProject` | ✅ All 10 steps reproduced in the same order |
| B0 helper contract preserved | ✅ Helper called as-is; no edits to `open-project-in-fresh-session.ts` |
| No change to `handleOpenWorkspaceProject` internals | ✅ Not touched |
| No change to New Project UI affordance | ✅ Not touched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `projectOpenInProgressRef` discipline followed exactly |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No B2/B3/B4 or later-phase work | ✅ Single call-site wiring only |
