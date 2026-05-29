# UX-IA-30 Checkpoint — Fix Focused Project Action Panel Stale Success Clear

**Task ID:** UX-IA-30
**Family:** UX-IA
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-29
**Depends on:** UX-IA-29 (COMPLETE and LOCKED), UX-IA-28 (COMPLETE and LOCKED)

---

## Root Cause

On the Projects page, clicking a project card "..." menu action (Move to workspace, Sharing / visibility) failed to show the focused panel immediately.

`focusedProjectAction` was set correctly on click, but a `WorkspaceShell` `useEffect` immediately cleared it whenever `props.projectActionState === 'success'`. After any prior successful action (open, create, move, visibility), `projectActionState` stays at `'success'`. The new click would set `focusedProjectAction` and the effect would fire and clear it in the same render cycle, before the panel could appear. A full page refresh reset `projectActionState` to `'idle'`, which is why the panel appeared after refresh.

---

## Files Changed

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

---

## Fix Summary

**`frontend/components/workspace/workspace-shell.tsx`**

- Added type alias `ProjectActionState` derived from `WorkspaceShellProps['projectActionState']`.
- Added exported helper `shouldCloseFocusedProjectActionOnProjectSuccessTransition(args)` — pure, testable, no side-effects.
- Normalized `projectActionState` once with `'idle'` fallback.
- Added `previousProjectActionStateRef` to track the previous value across renders.
- Replaced the unconditional `props.projectActionState === 'success'` guard with a transition guard: clear only when state **transitions from non-success into success** while a focused action is active.
- Effect dependency list updated to use the normalized `projectActionState` local.

**Before:**
```ts
React.useEffect(() => {
  if (props.projectActionState === 'success') {
    setShowNewProjectRow(false);
    if (focusedProjectAction) {
      setFocusedProjectAction(null);
      props.onWorkspaceViewChange?.('projects');
    }
  }
}, [focusedProjectAction, props.onWorkspaceViewChange, props.projectActionState]);
```

**After:**
```ts
React.useEffect(() => {
  const previousProjectActionState = previousProjectActionStateRef.current;
  const shouldCloseFocusedProjectAction =
    shouldCloseFocusedProjectActionOnProjectSuccessTransition({
      previousProjectActionState,
      nextProjectActionState: projectActionState,
      hasFocusedProjectAction: focusedProjectAction !== null,
    });
  if (shouldCloseFocusedProjectAction) {
    setShowNewProjectRow(false);
    setFocusedProjectAction(null);
    props.onWorkspaceViewChange?.('projects');
  }
  previousProjectActionStateRef.current = projectActionState;
}, [focusedProjectAction, props.onWorkspaceViewChange, projectActionState]);
```

---

## Tests Updated

**`frontend/components/workspace/workspace-shell.test.tsx`**

- Move action test: renamed + updated to explicitly pass `projectActionState: 'success'` and assert focused move state is still set after click.
- Visibility action test: renamed + updated to explicitly pass `projectActionState: 'success'` and assert focused visibility state is still set after click.
- Added `shouldCloseFocusedProjectActionOnProjectSuccessTransition` import.
- Added unit test `'focused action close guard only closes on transition into success'`:
  - `success -> success` with focused action: returns `false` (guard does not close)
  - `idle -> success` with focused action: returns `true` (guard closes)
  - `opening -> success` with no focused action: returns `false` (guard does not close)

Existing tests still cover:
- Normal project card click opens project
- Legacy My Projects admin panel absent from Projects page
- Focused panel cancel clears action and keeps projects view
- Focused panel close after actual successful action

---

## Validation Results

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit  → PASS
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test           → PASS
ReadLints on touched files                                                        → PASS
frontend/tsconfig.tsbuildinfo restored after validation
```

---

## Non-Goals Confirmed

- No backend changes
- No route or entity changes
- No card redesign
- No legacy My Projects admin panel restored
- No i18n / message file changes
- No new user-facing visible text

---

## Next Live-Test Step

Open the platform in a browser. On the Projects page:
1. Open any project (this sets `projectActionState` to `'success'`).
2. Navigate back to the Projects page.
3. Click the "..." menu on any project card.
4. Click "Move to workspace" — the focused Move panel should appear immediately without a page refresh.
5. Cancel. Click "..." again, click "Sharing / visibility" — the focused Visibility panel should appear immediately without a page refresh.
