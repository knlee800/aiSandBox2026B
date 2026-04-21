# PROJ-03-B2a CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B2a
- Title: Wire Open Project Handler To Open Project In Fresh Session Behind Feature Flag
- Nature: FRONTEND / PHASE B OPEN PROJECT HANDLER WIRING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B2a-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B2 Open Project wiring slice (split: B2a handler wiring, B2b UI gating)
- Depends on: PROJ-03-B1 (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, change `handleOpenWorkspaceProject` so a successful open goes through the locked B0 helper (`openProjectInFreshSession`) instead of opening into the currently selected session, while keeping the existing Open Project UI affordance and enablement gating unchanged in this slice.

## Scope Statement

This is a **single handler-branch change in `frontend/app/[locale]/app/page.tsx`**. The B0 helper (`frontend/lib/open-project-in-fresh-session.ts`) was called as-is; its internals were not modified. The Open Project button enablement, label, and visibility were not changed. The `selectedSessionId` precondition gate was not relaxed — that is B2b's scope. Because the gate remains unchanged, the flag-on path is still not normally user-reachable in this slice. Flag off preserves the legacy `handleOpenWorkspaceProject` path byte-for-byte. No B2b/B3/B4 or later-phase work was performed.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added `PROJECT_FIRST_UX`-guarded branch inside the `try` block of `handleOpenWorkspaceProject`. |

No other source files were modified. `frontend/lib/open-project-in-fresh-session.ts` unchanged.

## Flag-On Behavior Implemented

Inside `handleOpenWorkspaceProject`, immediately after `projectOpenInProgressRef.current = true` and inside the existing `try` block, the following block runs **only when `PROJECT_FIRST_UX` is true**:

1. `const selectedSnapshotIdToOpen = selectedSnapshotId?.trim() || undefined` — trimmed snapshot ID, or `undefined` if not set.
2. `const openResult = await openProjectInFreshSession({ token, projectId: selectedProjectId, snapshotId: selectedSnapshotIdToOpen })` — B0 helper invoked, fully awaited. `snapshotId` is passed only when `selectedSnapshotId` is explicitly set and non-empty; otherwise omitted so B0 resolves the latest project-scoped snapshot itself.
3. Hydration follow-up sequence (mirrors existing `handleOpenWorkspaceProject` legacy path exactly):
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
4. `setProjectActionState('success')`, `setProjectActionMessage('Project opened.')`, `setProjectActionError(null)`, `return`.

The success message was neutralized from `'Project opened in selected session.'` to `'Project opened.'` because the flag-on path opens into a freshly created session, not the currently selected one, making the original wording inaccurate.

The `selectedSessionId` variable is intentionally ignored inside the flag-on branch — the B0 helper creates a fresh session. However, the precondition check at lines 1131–1136 (requiring both `selectedSessionId` and `selectedProjectId`) was not relaxed in this slice, so the flag-on path remains unreachable via the normal UI until B2b relaxes that gate.

## Flag-Off Behavior

When `PROJECT_FIRST_UX` is false the `if (PROJECT_FIRST_UX)` block is not entered. The handler falls through to the existing legacy path with one internal rename: `snapshotIdToOpen` is now initialized from `selectedSnapshotIdToOpen` rather than re-trimming `selectedSnapshotId` inline. The behavior is byte-equivalent — the value is identical.

## ref Discipline

- `projectOpenInProgressRef.current = true` is set at line 1141, **before** the `try` block.
- The existing outer `finally` block (lines 1226–1229) clears both `projectOpenInProgressRef` and `skipNextSessionEffectFileReloadRef` on every exit path — success, error, and the new flag-on `return`.
- No nested `try/finally` was required; the existing outer finally handles all paths.

## Important Constraints

- Open Project button enablement, label, and visibility were not changed.
- `selectedSessionId` gating was not relaxed; path is not normally user-reachable.
- B0 helper was called as-is; no edits were made to `open-project-in-fresh-session.ts`.
- `handleOpenWorkspaceProject` signature and external interface were not changed.
- B1 path (`handleCreateWorkspaceProject`) was not touched.

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

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B2a. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1 checkpoints.

### 4. File-level lint check

`ReadLints` on `frontend/app/[locale]/app/page.tsx`: **no linter errors found**.

### 5. Coverage note (honest)

No focused page-handler seam test was added for "flag-on calls helper once / flag-off does not / ref discipline on success/failure". Extracting that seam cleanly (mocking `localStorage`, `fetch`, `router`, `useRef`) would require enough scaffolding to exceed this slice's boundary. The strongest surrounding verification performed was: typecheck + B0 helper tests + project/snapshot logic tests + workspace shell tests + file-level lint on the changed file.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the single changed source file.

## Preserved Invariants

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` is kill switch | ✅ Flag off: guard block never entered; legacy handler path unchanged |
| Flag off preserves existing `handleOpenWorkspaceProject` behavior exactly | ✅ No structural change to the flag-off path |
| `projectOpenInProgressRef` set before helper call, cleared in outer `finally` | ✅ Set at line 1141; outer `finally` fires on all exit paths including the new `return` |
| `skipNextSessionEffectFileReloadRef` cleared in outer `finally` | ✅ Paired cleanup in same outer `finally` |
| Hydration follow-up parity with existing open-project path | ✅ All 10 steps reproduced in the same order |
| B0 helper contract preserved | ✅ Helper called as-is; no edits to `open-project-in-fresh-session.ts` |
| Open Project button enablement, label, visibility unchanged | ✅ Not touched — deferred to B2b |
| `selectedSessionId` gating unchanged | ✅ Precondition check unmodified; flag-on path not normally user-reachable in this slice |
| Explicit `selectedSnapshotId` behavior intact | ✅ Passed to B0 helper when trimmed-non-empty; omitted otherwise |
| No change to `handleOpenWorkspaceProject` signature or interface | ✅ Not touched |
| No change to B1 path | ✅ `handleCreateWorkspaceProject` not touched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `projectOpenInProgressRef` discipline followed exactly |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No B2b/B3/B4 or later-phase work | ✅ Single handler-branch change only |
