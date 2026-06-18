# APP-ROUTE-RESTORE-01A CHECKPOINT

**Task ID:** APP-ROUTE-RESTORE-01A
**Title:** Preserve Workspace Route/Session After Browser Reload
**Family:** APP ROUTING / WORKSPACE STATE / SESSION RESTORE
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-18

---

## Problem Fixed

While testing preview behavior, Keith found that pressing the browser refresh button inside a project/workspace returned the app to Home instead of restoring the current workspace/project/session view.

This was confusing because the selected project and session context had already been persisted to `sessionStorage` (behind `PROJECT_FIRST_UX`), but the `workspaceView` state — which controls whether Home or the project workspace is displayed — was not persisted or restored.

---

## Root Cause

`workspaceView` is plain React state initialized to `'home'` (line 957, `page.tsx`):

```typescript
const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home');
```

The cold-mount `useEffect` already read three sessionStorage keys on reload (when `PROJECT_FIRST_UX` is enabled):
- `workspace_tab_selected_session_id` → seeds `coldMountSeededSessionIdRef`
- `workspace_tab_selected_project_id` → seeds `coldMountSeededProjectIdRef`
- `workspace_tab_selected_workspace_id` → seeds `coldMountSeededWorkspaceIdRef`

These IDs are consumed during `loadSessions()` and `loadWorkspaceProjectsForUser()` to restore `selectedSessionId` and `selectedProjectId` — so after reload, the project/session context was correctly restored in the background.

But `workspaceView` was never written to sessionStorage and never read back. Result: after reload, the restored `selectedProjectId` and `selectedSessionId` were live but invisible, because `workspaceView` remained `'home'` and Home rendered instead of the project workspace view.

---

## Implementation

All changes are frontend-only, in `page.tsx`. No backend, container-manager, api-gateway, schema, route, or i18n changes.

### 1. New storage key constant

Added near existing `TAB_SELECTED_*` constants:

```typescript
const TAB_SELECTED_VIEW_STORAGE_KEY = 'workspace_tab_view';
```

### 2. New cold-mount seed ref

Added near existing `coldMountSeeded*` refs:

```typescript
const coldMountSeededViewRef = useRef<'project' | null>(null);
```

### 3. Cold-mount read (in the existing cold-mount `useEffect`)

Inside the `PROJECT_FIRST_UX` branch, added:

```typescript
coldMountSeededViewRef.current =
  sessionStorage.getItem(TAB_SELECTED_VIEW_STORAGE_KEY) === 'project' ? 'project' : null;
```

In the non-`PROJECT_FIRST_UX` else branch, added:

```typescript
coldMountSeededViewRef.current = null;
```

### 4. `workspaceView` persistence effect

Added after the existing `selectedProjectId` persistence effect:

```typescript
useEffect(() => {
  if (!PROJECT_FIRST_UX) {
    return;
  }

  if (workspaceView === 'project') {
    sessionStorage.setItem(TAB_SELECTED_VIEW_STORAGE_KEY, 'project');
    return;
  }

  sessionStorage.removeItem(TAB_SELECTED_VIEW_STORAGE_KEY);
}, [workspaceView]);
```

Only `'project'` is persisted. `'home'`, `'projects'`, and `'templates'` are not stored — they are safe defaults on reload.

### 5. Cold-mount restore effect

Added after the persistence effect:

```typescript
useEffect(() => {
  if (!PROJECT_FIRST_UX) {
    return;
  }

  if (coldMountSeededViewRef.current !== 'project') {
    return;
  }

  if (!selectedProjectId || !selectedSessionId) {
    return;
  }

  const selectedSession = sessions.find((candidate) => candidate.id === selectedSessionId);
  if (!selectedSession) {
    if (sessions.length > 0) {
      coldMountSeededViewRef.current = null;
    }
    return;
  }

  if (!isUsableSession(selectedSession)) {
    coldMountSeededViewRef.current = null;
    return;
  }

  coldMountSeededViewRef.current = null;
  setWorkspaceView('project');
}, [selectedProjectId, selectedSessionId, sessions]);
```

Fallback behavior: if the session is terminated, expired, or missing after reload, `coldMountSeededViewRef` is cleared and `workspaceView` stays `'home'` — a safe graceful fallback.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added storage key, cold-mount ref, cold-mount read, persistence effect, restore effect |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added source-assertion test block for all new logic |

**Files NOT changed:**
- No backend/services files
- No api-gateway files
- No container-manager files
- No middleware.ts
- No i18n message files (`en.json`, `zh-TW.json`, `zh-CN.json`)
- No other frontend files

---

## Tests Added

New source-assertion test block added to `workspace-shell.test.tsx` under describe `'workspace view reload restore wiring — APP-ROUTE-RESTORE-01A'`:

| Test | Asserts |
|---|---|
| `page source defines view storage key and cold-mount seeded ref` | `TAB_SELECTED_VIEW_STORAGE_KEY` constant exists; `coldMountSeededViewRef` exists initialized to `null` |
| `page source reads and persists project workspace view via sessionStorage` | Cold-mount reads `TAB_SELECTED_VIEW_STORAGE_KEY`; persist effect writes/removes the key |
| `page source restores project workspace view only with valid selected context` | Restore effect guards on `PROJECT_FIRST_UX`, seeded view, `selectedProjectId`, `selectedSessionId`, session lookup, `isUsableSession`; clears ref before `setWorkspaceView('project')` |

---

## Validation Results

| Validation | Command | Result |
|---|---|---|
| Focused tests | `npm test -- --testPathPattern="workspace-shell"` | PASS — 640 passed, 0 failed |
| TypeScript typecheck | `npx tsc --noEmit` | PASS |
| Production build | `npm run build` | PASS |
| ReadLints — `page.tsx` | ReadLints | PASS — no linter errors |
| ReadLints — `workspace-shell.test.tsx` | ReadLints | PASS — no linter errors |

`frontend/tsconfig.tsbuildinfo` was restored after build.

---

## Manual Browser Smoke

| Check | Result |
|---|---|
| Before refresh: project view visible | Yes |
| After browser refresh (F5 / Ctrl+R): returned to project view | Yes |
| Returned to Home instead | No |
| Same project restored | Yes |
| Same session/chat restored | Yes |
| Editor/file area visible | Yes |
| Preview area normal | Yes |
| Any visible error | None |

---

## Non-Goals Confirmed Respected

- No preview-system changes
- No container-manager changes
- No api-gateway changes
- No backend schema changes
- No route/URL changes
- No new visible UX text
- No i18n message changes
- No new dependencies
- No navigation redesign

---

## Rollback Guidance

To revert this fix if needed:

1. In `frontend/app/[locale]/app/page.tsx`, remove:
   - `TAB_SELECTED_VIEW_STORAGE_KEY` constant
   - `coldMountSeededViewRef` ref declaration
   - Cold-mount read of `TAB_SELECTED_VIEW_STORAGE_KEY`
   - Cold-mount `coldMountSeededViewRef.current = null` in the else branch
   - `workspaceView` persistence effect
   - Cold-mount restore effect

2. In `frontend/components/workspace/workspace-shell.test.tsx`, remove the `'workspace view reload restore wiring — APP-ROUTE-RESTORE-01A'` describe block.

3. Run `npx tsc --noEmit` and `npm test` to confirm clean revert.

---

**Reference:** See `TASKS.md` → APP-ROUTE-RESTORE-01A.
**Reference:** See `TASKS_BACKLOG_FULL.md` → APP-ROUTE-RESTORE-01A.
