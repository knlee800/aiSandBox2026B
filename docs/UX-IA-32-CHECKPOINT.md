# UX-IA-32 CHECKPOINT — Auto-Compact Sidebar When Entering Project Workspace

**Status:** COMPLETE and LOCKED
**Task ID:** UX-IA-32
**Family:** UX-IA
**Priority:** Medium
**Nature:** FRONTEND-ONLY / UX NAVIGATION BEHAVIOR
**Risk:** Low
**Depends on:** UX-IA-31 (COMPLETE and LOCKED — `docs/UX-IA-31-CHECKPOINT.md`), HOME-START-01 (COMPLETE and LOCKED)
**Checkpoint date:** 2026-06-02

---

## Problem

When a user opened or created a project and entered the Project Workspace view, the left sidebar remained expanded, consuming horizontal space needed by the chat panel and content area. Users had to manually compact it every time.

---

## Root Cause of First Implementation Gap

The initial implementation used `React.useState(props.initialCompact ?? false)` to initialise the compact state. This only applied on first mount. When `WorkspaceSidebar` was already mounted (e.g. user was on Home or Projects, then opened a project), the `useState` initialiser did not run again on re-render, so the sidebar stayed expanded despite `workspaceView` changing to `'project'`.

---

## Final Auto-Compact Behavior

- On first mount with `workspaceView === 'project'`: sidebar starts compact via `initialCompact` prop.
- On mounted view transition (non-project → project): a `useEffect` on `props.workspaceView` detects the transition using a `previousWorkspaceViewRef`, and calls `setIsCompact(true)` exactly once on entry.
- While staying in project view: subsequent same-view renders do not re-force compact; manual expansion is preserved.
- Re-entering project view after leaving: triggers auto-compact again.
- Home / Projects / Templates views: unaffected; sidebar remains expanded.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-sidebar.tsx` | Added `initialCompact?: boolean` prop; changed `useState` initialiser to `props.initialCompact ?? false`; added `previousWorkspaceViewRef` and `useEffect` on `props.workspaceView` to auto-compact on non-project → project transition |
| `frontend/components/workspace/workspace-shell.tsx` | Passes `initialCompact={resolvedWorkspaceView === 'project'}` to `WorkspaceSidebar` |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added and updated tests (see below) |

---

## Tests Updated

- Project view first mount initializes sidebar compact.
- Non-project views (home, projects) initialize sidebar expanded.
- Mounted transition `home → project` auto-compacts sidebar.
- Mounted transition `projects → project` auto-compacts sidebar.
- Manual expansion after auto-compact is not immediately re-forced while staying in project view.
- Switching from project back to home does not force compact mode.
- All prior compact/sidebar behavior tests continue to pass.
- Added `withPatchedReactHooksWithPersistentState` test helper to simulate mounted re-renders with persistent state and effect execution across calls.

---

## Validation Results

From `C:\Users\knlee\aiSandBox2026B\frontend`:

- `npx tsc --noEmit` — PASS
- `npm test` — PASS
- ReadLints on touched files — PASS
- Live browser test — PASS

---

## Non-Goals Confirmed

- No chat panel layout change.
- No Command Input relocation.
- No Build Targets relocation.
- No History drawer.
- No route, model, or entity changes.
- No broad sidebar redesign.
- No new icons.

---

## No-Change Confirmation

- No backend files changed.
- No i18n files (`frontend/messages/*.json`) changed.
- No route or entity files changed.
- No governance documents edited during implementation or revision steps.
- No checkpoint or docs files edited during implementation steps.

---

## Next Recommended Step

Begin the next UX-IA task or register a new slice if auto-compact follow-up behavior is needed (e.g. persisting compact preference across sessions).
