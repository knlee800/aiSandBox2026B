# PROJ-03-D0d CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D0d
- **Title:** Add Tab-Scoped Project And Session Selection Seed Behind Feature Flag
- **Nature:** FRONTEND / TAB ISOLATION
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D0d-CHECKPOINT.md`
- **Source:** Post-D0c diagnostic: `selectedProjectId` and `selectedSessionId` are React-only state; on refresh they reset to null; bootstrap reload + default-selection logic picks the first project/session from backend lists (ordered `updatedAt DESC`); two tabs independently converge onto the same most-recent project after refresh, giving the appearance of shared state
- **Depends on:** PROJ-03-D0c (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, persist `selectedProjectId` and `selectedSessionId` in tab-scoped `sessionStorage` and seed them back into the initial project/session selection flow on cold mount, so each browser tab/window can retain its own project/session after refresh without changing backend behavior or routing.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Two new `sessionStorage` key constants; two new cold-mount seed refs; bootstrap effect updated to read seeds; `loadSessions` selector updated to honor valid seed; `loadWorkspaceProjectsForUser` selector updated to honor valid seed; two new write effects to persist/clear selections |

**`frontend/app/[locale]/app/page.tsx` was the only production file changed.**

**No test files were added or modified in this step.**

**Note on working tree:** At the time of this checkpoint, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, and `docs/PROJ-03-D0c-CHECKPOINT.md` had pre-existing/pending non-code changes from earlier turns in this session. The D0d implementation itself only changed `frontend/app/[locale]/app/page.tsx`.

## Locked Scope Actually Implemented

This is a tab-scoped selection-seeding change only. All handler semantics, backend calls, route structure, session-keyed effect, and legacy code paths are untouched.

### `frontend/app/[locale]/app/page.tsx`

**1. Two new `sessionStorage` key constants** (added near existing storage key constants at module scope, lines 120–121):

```ts
const TAB_SELECTED_SESSION_STORAGE_KEY = 'workspace_tab_selected_session_id';
const TAB_SELECTED_PROJECT_STORAGE_KEY = 'workspace_tab_selected_project_id';
```

**2. Two new cold-mount seed refs** (added after `projectOpenInProgressRef`, lines 382–383):

```ts
const coldMountSeededSessionIdRef = useRef<string | null>(null);
const coldMountSeededProjectIdRef = useRef<string | null>(null);
```

**3. Bootstrap effect updated** (inside existing `[locale, router]` effect, after `setAuthLoading(false)`, before the `void loadSessions(token)` calls, lines 469–477):

```ts
if (PROJECT_FIRST_UX) {
  coldMountSeededSessionIdRef.current =
    sessionStorage.getItem(TAB_SELECTED_SESSION_STORAGE_KEY) || null;
  coldMountSeededProjectIdRef.current =
    sessionStorage.getItem(TAB_SELECTED_PROJECT_STORAGE_KEY) || null;
} else {
  coldMountSeededSessionIdRef.current = null;
  coldMountSeededProjectIdRef.current = null;
}
```

Reading happens synchronously in the bootstrap effect before the async loads fire. The seeds are captured into refs so they are available when the async loaders resolve.

**4. `loadSessions(...)` default-selection logic updated** (inside `setSelectedSessionId` functional updater, lines 886–893):

```ts
const seededSessionId = PROJECT_FIRST_UX ? coldMountSeededSessionIdRef.current : null;
coldMountSeededSessionIdRef.current = null;
if (seededSessionId) {
  const seededSession = data.find((session) => session.id === seededSessionId);
  if (seededSession && isUsableSession(seededSession)) {
    return seededSessionId;
  }
}
```

The seed is consumed (ref cleared) on first use. If the seeded session no longer exists in the loaded list or is not usable, fall-through to the existing `fallbackSession` default.

**5. `loadWorkspaceProjectsForUser(...)` default-selection logic updated** (inside `setSelectedProjectId` functional updater, lines 1070–1074):

```ts
const seededProjectId = PROJECT_FIRST_UX ? coldMountSeededProjectIdRef.current : null;
coldMountSeededProjectIdRef.current = null;
if (seededProjectId && projects.some((project) => project.id === seededProjectId)) {
  return seededProjectId;
}
```

Same pattern: seed consumed on first use; invalid or missing seed falls through to `projects[0].id` default.

**6. Two new write effects** (added after the existing `selectedSessionIdRef` sync effect, lines 536–561):

Session write effect:
```ts
useEffect(() => {
  if (!PROJECT_FIRST_UX) { return; }
  if (selectedSessionId) {
    sessionStorage.setItem(TAB_SELECTED_SESSION_STORAGE_KEY, selectedSessionId);
    return;
  }
  sessionStorage.removeItem(TAB_SELECTED_SESSION_STORAGE_KEY);
}, [selectedSessionId]);
```

Project write effect:
```ts
useEffect(() => {
  if (!PROJECT_FIRST_UX) { return; }
  if (selectedProjectId) {
    sessionStorage.setItem(TAB_SELECTED_PROJECT_STORAGE_KEY, selectedProjectId);
    return;
  }
  sessionStorage.removeItem(TAB_SELECTED_PROJECT_STORAGE_KEY);
}, [selectedProjectId]);
```

`removeItem` (not `setItem('null')`) is used on null to prevent a stale string `"null"` seed from persisting. All `sessionStorage` access is inside `useEffect` (client-only), satisfying Next.js SSR constraints.

## Unchanged Code

| Area | Status |
|---|---|
| `[selectedSessionId]` effect (reset and reload on session change) | Unchanged |
| All project-first handlers (`handleCreateWorkspaceProject`, `handleOpenWorkspaceProject`, etc.) | Unchanged |
| `projectOpenInProgressRef` guard behavior | Unchanged |
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| All locked Phase A/B/C/D0/D0b/D0c paths | Unchanged |
| No tests added or modified | ✅ |
| No backend/API/schema changes | ✅ |
| No new UI surface | ✅ |
| No route changes | ✅ |
| No handler redesign | ✅ |

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — `150/150` tests passing, 0 failures. No regressions across all seven suites.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "app/[locale]/app/page.tsx"
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by D0d. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on `frontend/app/[locale]/app/page.tsx` — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "tsconfig.tsbuildinfo"` so the working-tree diff is limited to the single changed production file.

## Honest Note

The seed path is intentionally narrow:

- `sessionStorage` is only read once per cold mount, inside the existing `[locale, router]` bootstrap effect, before any async load fires.
- The seeded IDs only win when they still match the freshly loaded project/session lists returned from the backend on that same mount.
- If the current React selection is already valid (non-null and present in the loaded list), it still wins — the seed is not applied.
- If a seed is missing, empty, or references an ID no longer present/usable in the loaded list, behavior falls back exactly to the existing first-item default-selection logic. No error is thrown; the invalid seed is silently discarded (ref cleared).
- Tabs that have never written a selection (new tabs, first-ever visit) get the same default-to-`projects[0]` / first-usable-session behavior as before D0d.
- The write effects use `removeItem` when a selection is set to null, preventing a string `"null"` from surviving as a spurious seed.
- The `[selectedSessionId]` effect (lines 527–591) that resets and reloads project/snapshot/session state on every session change is entirely untouched.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Tab-scoped selection seeding only; auth/identity/preferences remain in `localStorage` | ✅ |
| No backend behavior or project/session ordering changes | ✅ |
| All `sessionStorage` access inside `useEffect` (SSR-safe) | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: neither write effects nor seed reads execute; behavior byte-identical to pre-D0d |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No D1 work | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No later-phase work | ✅ Tab-scoped selection seeding only |
