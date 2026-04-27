# PROJ-03-D1d-hotfix CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D1d-hotfix
- **Title:** Refresh Sessions Before Same-Project Reuse Check Behind Feature Flag
- **Nature:** FRONTEND / CORRECTIVE HOTFIX FOR D1d STALE-STATE REUSE BUG
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D1d-hotfix-CHECKPOINT.md`
- **Source:** Post-D1d bug: the D1d reuse check in `openProjectInFreshSession` consults the in-memory `sessions` React state, which can be stale. A session terminated server-side by idle_timeout after the last `loadSessions()` call will still show `terminatedAt: null` in memory, pass `isUsableSession`, be selected for reuse, and cause the backend to return 410 Gone ("Session has been terminated (reason: idle_timeout)"). The D1d reuse logic itself is correct against the data it has; the data is stale.
- **Depends on:** PROJ-03-D1d (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, eliminate stale same-project session reuse by refreshing the sessions list immediately before the reuse decision in normal project-open/resume flows, so reuse only ever consults current server state. Preserve explicit snapshot restore as always-fresh and leave all other D1d behavior intact.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | `loadSessions` return type changed from `Promise<void>` to `Promise<WorkspaceShellSession[]>`. All early-return failure paths return `[]`. Normal success path returns `data` after state updates. Two call sites updated: `handleOpenWorkspaceProject` (PROJECT_FIRST_UX branch) and `handleResumeWorkspaceProjectById` now each call `const refreshedSessions = await loadSessions(token)` and pass `existingSessions: refreshedSessions` into `openProjectInFreshSession(...)`. |

**Only one production file changed.** No backend files, no helper files, no test files, no governance files were changed during the implementation step.

## Implementation Summary

### 1. `loadSessions` return type (`page.tsx`)

```typescript
// Before
async function loadSessions(token: string): Promise<void> {

// After
async function loadSessions(token: string): Promise<WorkspaceShellSession[]> {
```

All early-return failure paths (`fetchError`, `!response.ok`, `parseError`, outer `catch`) now `return []` instead of `return`. The success path adds `return data;` after `setIsLoadingSessions(false)`. All existing state updates (`setSessions`, `setSelectedSessionId`, `setHiddenSessionIds`, `setIsLoadingSessions`, `setSessionError`) are fully preserved and continue to run exactly as before.

### 2. `handleOpenWorkspaceProject` — PROJECT_FIRST_UX branch (`page.tsx`)

```typescript
// Before
const openResult = await openProjectInFreshSession({
  token,
  projectId: selectedProjectId,
  existingSessions: sessions,       // stale React state
  snapshotId: selectedSnapshotIdToOpen,
});

// After
const refreshedSessions = await loadSessions(token);
const openResult = await openProjectInFreshSession({
  token,
  projectId: selectedProjectId,
  existingSessions: refreshedSessions,   // freshly fetched
  snapshotId: selectedSnapshotIdToOpen,
});
```

`projectOpenInProgressRef.current = true` is already set before this call; the refresh happens while the guard is held, preventing concurrent opens.

### 3. `handleResumeWorkspaceProjectById` (`page.tsx`)

```typescript
// Before
const openResult = await openProjectInFreshSession({
  token,
  projectId: normalizedProjectId,
  existingSessions: sessions,       // stale React state
});

// After
const refreshedSessions = await loadSessions(token);
const openResult = await openProjectInFreshSession({
  token,
  projectId: normalizedProjectId,
  existingSessions: refreshedSessions,   // freshly fetched
});
```

Same `projectOpenInProgressRef` guard applies.

### 4. Unchanged surfaces

- `handleRestoreWorkspaceProjectFromSnapshotById` — not touched; passes no `existingSessions`, always-fresh behavior preserved exactly.
- `handleCreateWorkspaceProject` — not touched; new projects cannot have a matching existing session, always-fresh behavior preserved.
- `open-project-in-fresh-session.ts` — reuse logic unchanged.

## Explicit Statements

- No backend files were changed.
- No test files were changed.
- No new props, routes, or UI were added.

## Why `refreshedSessions` Was Necessary Instead of `sessions`

`await loadSessions(token)` schedules React state updates via `setSessions(data)` etc., but React batches state updates. The `sessions` closure variable captured in the handler body is bound to the value from the render that created the handler, and it does not change synchronously on the next line after `await loadSessions(token)` completes. Passing `existingSessions: sessions` after the await would still pass pre-refresh data from the previous render.

Returning the fetched array directly from `loadSessions` and binding it to `refreshedSessions` bypasses React's state scheduling entirely. The reuse helper receives the exact array just fetched from the backend, with no render-cycle timing uncertainty.

## Validation

| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `cd frontend && npx tsc --noEmit -p tsconfig.json` | ✅ Clean (exit 0) |
| D1d helper regression suite | `cd frontend && npx tsx --test lib/open-project-in-fresh-session.test.ts` | ✅ 8/8 pass |
| Lint diagnostics | `ReadLints` on `frontend/app/[locale]/app/page.tsx` | ✅ No linter errors found |
| Build artifact cleanup | `git restore -- frontend/tsconfig.tsbuildinfo` | ✅ Restored |

## Preserved Invariants

| Invariant | Status |
|---|---|
| Stale-state correction only — no retry-on-410 recovery logic | ✅ |
| Explicit restore remains always-fresh | ✅ `handleRestoreWorkspaceProjectFromSnapshotById` unchanged |
| Hydration/open flow after reuse remains intact | ✅ `hydrateWorkspaceForProjectOpen` always runs |
| Tab-isolated selection behavior from D0d | ✅ `sessionStorage` keys and seed logic untouched |
| `projectOpenInProgressRef` guard and open/restore invariants | ✅ Refresh happens while guard is held |
| `.git` exclusion, autosave timing, stop-session cleanup semantics | ✅ No change to any of these surfaces |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: `handleOpenWorkspaceProject` does not enter PROJECT_FIRST_UX branch; `handleResumeWorkspaceProjectById` returns immediately; behavior byte-identical to pre-D1d |
| No broader D1 redesign | ✅ |
| No C3 / C2d-unload work | ✅ |
| No true editor autosave-to-disk | ✅ |
| No unload handling | ✅ |
| No retry-on-410 recovery | ✅ |
| No later-phase work | ✅ |
