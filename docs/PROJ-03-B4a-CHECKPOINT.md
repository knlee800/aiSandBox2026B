# PROJ-03-B4a CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B4a
- Title: Add Open Project By Id In Fresh Session Handler Behind Feature Flag
- Nature: FRONTEND / PHASE B HANDLER WIRING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B4a-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B4 Resume Latest Project CTA (split: B4a handler wiring, B4b CTA UI)
- Depends on: PROJ-03-B3a (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, add a parameterized handler (`handleResumeWorkspaceProjectById(projectId: string)`) in `frontend/app/[locale]/app/page.tsx` that opens a caller-supplied `projectId` in a freshly created session by directly invoking the locked B0 helper, mirroring the B1/B2a hydration follow-up sequence, and expose it as a new optional callback prop on `WorkspaceShell`. No UI consumer in this slice.

## Scope Statement

This is a **handler-only preparatory slice with no visible UI change**. No user-facing affordance (CTA, button, banner) was added. No existing handler body was modified. The only production changes are:

1. A new async handler function in `frontend/app/[locale]/app/page.tsx`.
2. One new optional prop declaration in `WorkspaceShellProps` in `frontend/components/workspace/workspace-shell.tsx`.
3. The new handler passed as that prop in the `<WorkspaceShell>` JSX in `page.tsx`.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty from the prior B4a registration step and were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | New `handleResumeWorkspaceProjectById` handler added; `onResumeWorkspaceProjectById={handleResumeWorkspaceProjectById}` prop passed to `WorkspaceShell`. |
| `frontend/components/workspace/workspace-shell.tsx` | One new optional prop `onResumeWorkspaceProjectById?: (projectId: string) => Promise<void>` added to `WorkspaceShellProps` interface. No JSX or render logic changed. |

No other source files were modified. `frontend/lib/open-project-in-fresh-session.ts` unchanged.

## Handler Implemented

### `handleResumeWorkspaceProjectById(projectId: string)` — `frontend/app/[locale]/app/page.tsx` (lines 1247–1306)

**Early-return guards (in order):**

1. `if (!PROJECT_FIRST_UX) return;` — kill-switch. Flag off: function returns immediately without setting `projectOpenInProgressRef` or calling any API.
2. `const normalizedProjectId = projectId.trim(); if (!normalizedProjectId) return;` — empty/invalid `projectId` guard. Returns without side effects.
3. Token guard: `localStorage.getItem('access_token')` — missing token redirects to login and returns without setting `projectOpenInProgressRef`.

**Active path (flag on + valid `projectId` + token present):**

- `setProjectActionState('opening')`, `setProjectActionMessage(null)`, `setProjectActionError(null)`.
- `projectOpenInProgressRef.current = true` — set before the `try` block so the `finally` always clears it.
- `const openResult = await openProjectInFreshSession({ token, projectId: normalizedProjectId })` — B0 helper called directly with the parameterized `projectId`. No React state read.
- Hydration follow-up sequence (all 10 steps, mirroring B1/B2a exactly):
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

### Key design decision

The handler accepts `projectId` as a parameter and normalizes it locally. It does **not** read `selectedProjectId` from React state. This is the reason B4a exists as a separate slice rather than reusing `handleOpenWorkspaceProject`: `handleOpenWorkspaceProject` reads `selectedProjectId` at call time (race-prone), whereas a future "Resume Latest" CTA must supply the project ID deterministically at call time.

## Prop Surface Change

`WorkspaceShellProps` in `frontend/components/workspace/workspace-shell.tsx` (line 86):

```ts
onResumeWorkspaceProjectById?: (projectId: string) => Promise<void>;
```

Added after the existing `onOpenWorkspaceProject?: () => Promise<void>` line. No JSX, no render logic, no `canReopenProject`-style gate, no test-id. The prop is declared and passed through but not consumed by any `WorkspaceShell` internal code in this slice. This is intentional; the UI consumer belongs to B4b.

## Unchanged Code

| Area | Status |
|---|---|
| `handleOpenWorkspaceProject` | Unchanged |
| `handleCreateWorkspaceProject` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| `WorkspaceShell` JSX and render logic | Unchanged |
| A3 recovery copy bundle | Unchanged |
| B2a/B2b locked paths | Unchanged |
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

Result: **PASS** — 100 tests / 5 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 75/75 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file app/[locale]/app/page.tsx --file components/workspace/workspace-shell.tsx
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B4a. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a/B2b/B3a checkpoints.

### 4. File-level lint check

`ReadLints` run on:

- `frontend/app/[locale]/app/page.tsx` — no linter errors
- `frontend/components/workspace/workspace-shell.tsx` — no linter errors

### 5. Coverage note (honest)

No focused page-handler seam test was added for `handleResumeWorkspaceProjectById`. Extracting that seam cleanly would require mocking `localStorage`, `fetch`, `router`, and `useRef` at a page level, which exceeds this slice's boundary. This limitation is consistent with B1/B2a/B2b — none of those handler slices added a focused page-handler test either. The strongest surrounding verification performed was: typecheck + B0 helper tests + project/snapshot logic tests + workspace shell tests + file-level lint on both changed files.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the two changed source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| No visible UI change in this slice | ✅ Handler-only; unused prop; no JSX/copy change |
| `PROJECT_FIRST_UX` is the kill switch | ✅ Flag off: first guard fires; function returns immediately; `projectOpenInProgressRef` never set |
| Hydration follow-up sequence mirrors B1/B2a exactly | ✅ All 10 steps reproduced in the same order |
| `projectOpenInProgressRef` set before helper call, cleared in `finally` | ✅ Set at line 1266; `finally` fires on all exit paths |
| `skipNextSessionEffectFileReloadRef` cleared in `finally` | ✅ Paired cleanup in same `finally` |
| Handler receives `projectId` as a parameter; does not read `selectedProjectId` from state | ✅ Design intent preserved |
| Unused optional prop is intentional and acceptable in this slice | ✅ B4b CTA will consume it |
| B0 helper contract preserved | ✅ Called as-is; no edits |
| No change to `handleOpenWorkspaceProject` or `handleCreateWorkspaceProject` | ✅ Not touched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `projectOpenInProgressRef` discipline followed exactly |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No B4b or Phase C/D/E work | ✅ Handler-only preparatory slice only |
