# PROJ-03-A2b CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-A2b
- Title: Hide Sessions List And Relocate Stop-Session To Advanced Drawer
- Nature: FRONTEND UX / PHASE A SESSION DEMOTION
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-A2b-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase A / Slice A.2 (second half)
- Depends on: PROJ-03-A2a (COMPLETE and LOCKED)

## Objective

Hide the sessions list from the primary workspace surface and relocate the stop-session control into the Advanced drawer built in A2a, both behind `PROJECT_FIRST_UX`. The stop-session handler and all underlying session lifecycle logic are unchanged.

## Scope Statement

This is **render-location and visibility change only**. The stop-session handler, API call path, and session lifecycle logic did not change. The stop-session JSX was reused from the existing sessions list and mounted inside the A2a drawer without modification to its semantics. Flag off preserves the current sessions list and stop/remove placement exactly — every existing `session-stop-*` and `session-remove-*` test id continues to render in its current location when the flag is off. No New/Open runtime, history, persistence, backend, or auth behavior changed.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added three optional props to `WorkspaceAdvancedDrawer` (`canStopSession`, `isStoppingSession`, `onStopSession`); added `showStopSession` derivation and stop button inside the drawer content; added `canStopSelectedSession`, `isStoppingSelectedSession`, and `handleStopSelectedSession` inside `WorkspaceShell`; wrapped sessions list `.map()` in `{projectFirstUxEnabled ? null : ...}`. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added three new flag-gated tests. |

No other source files were modified.

## Sessions List Behavior Under the Flag

### Flag off

Sessions list renders exactly as before. The existing per-session stop/remove buttons at `data-testid="session-stop-{id}"` and `data-testid="session-remove-{id}"` are present and functional. No structural change.

### Flag on

The scrollable sessions list `<div>` container remains mounted (preserving sidebar flex geometry). The `.map()` output is suppressed by a ternary: `{projectFirstUxEnabled ? null : props.sessions.map(...)}`. Session card labels, stop buttons, and remove buttons do not render in the primary surface.

## Advanced Drawer Behavior Under the Flag

The A2a drawer shell is reused without modification to its structural props. Three optional props were added:

| Prop | Type | Purpose |
|---|---|---|
| `canStopSession` | `boolean?` | Gate for rendering the stop button — true only when selected session is usable |
| `isStoppingSession` | `boolean?` | Disables the button and shows "Stopping..." when true |
| `onStopSession` | `() => void?` | Click handler; only passed when `canStopSelectedSession` is true |

The stop button renders inside the expanded `workspace-advanced-drawer-content` under a "Session controls" label. `data-testid="workspace-advanced-stop-session"`.

The drawer continues to show session ID + status from A2a. The stop button is an additive section below the existing status badge.

## Internal Wiring in WorkspaceShell

No changes to `WorkspaceShellProps`. All data was already available on existing props. Three local derivations added inside `WorkspaceShell`:

```ts
const canStopSelectedSession = Boolean(selectedSession && isUsableSession(selectedSession));
const isStoppingSelectedSession =
  Boolean(props.selectedSessionId) && props.stoppingSessionId === props.selectedSessionId;
const handleStopSelectedSession = () => {
  if (!props.selectedSessionId) { return; }
  runStopSessionWithConfirmation({
    sessionId: props.selectedSessionId,
    confirmStop: () => typeof window === 'undefined' ? true : window.confirm('...'),
    onStopSession: props.onStopSession,
  });
};
```

`handleStopSelectedSession` reuses the existing exported `runStopSessionWithConfirmation(...)` and the existing `props.onStopSession` callback — identical confirm text and stop path as the flag-off sessions list.

## Known Limitation (Intentional)

Under `PROJECT_FIRST_UX` in A2b, stop-session is available for the **selected session only**. Users with multiple sessions in the list can only stop the selected one from the Advanced drawer. This is intentional for the current project-first transition state: the approved design (Section 3.2) removes stop-session from the primary surface entirely, and Phase B will establish the always-fresh-session model where there is effectively one active session per open project. The selected-session-only scope is the correct A2b boundary.

## Test Coverage

Three new tests added to `workspace-shell.test.tsx`:

**`hides primary sessions list behind feature flag`**
- Renders with `projectFirstUxEnabled: true`, two sessions
- Asserts: `Session 12345678`, `terminated`, `session-stop-12345678-test-session`, `session-remove-87654321-term-session` all absent
- Asserts: `workspace-advanced-drawer` present

**`renders advanced drawer stop-session control for selected usable session`**
- Renders `WorkspaceAdvancedDrawer` directly with `isOpen: true`, `canStopSession: true`, `onStopSession`
- Asserts: `workspace-advanced-stop-session`, `Session controls`, `Stop` present

**`does not render advanced drawer stop-session control without stoppable selected session`**
- Renders `WorkspaceAdvancedDrawer` with `isOpen: true`, `sessionId: null`, no `canStopSession`
- Asserts: `workspace-advanced-stop-session`, `Session controls` absent

Existing flag-off stop/remove assertions (test `renders Stop for usable sessions and Remove for unusable sessions`) pass unchanged.

All 72 prior tests pass unchanged (75 total, 3 new A2b tests).

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no errors.

### 2. Component tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 75 tests / 2 suites, 0 failures. Includes all three new A2b tests and all 72 prior tests.

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.tsx --file components/workspace/workspace-shell.test.tsx
```

Result: Known repo issue — `next lint` throws `Couldn't find any pages or app directory` when run from the workspace root (same issue documented in PROJ-03-A0, A1, A3, A2a checkpoints; not introduced by A2b).

### 4. File-level lint check

`ReadLints` run on:
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

Result: **No linter errors found.**

## Preserved Invariants

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` is a kill-switch to today's behavior | ✅ Flag off: sessions map renders as before; drawer absent |
| Flag off preserves current sessions list and stop/remove placement exactly | ✅ Ternary passes map output through unchanged when flag is off |
| No change to stop-session handler, API call, or session lifecycle | ✅ `runStopSessionWithConfirmation` and `props.onStopSession` called, not replaced |
| No regression to project-open hydration discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Stop-session flow path unchanged |
| No New/Open runtime behavior change | ✅ No handler logic modified |
| No backend, auth, schema, or operator console changes | ✅ Frontend only |
| No Phase B or later-phase work | ✅ Render-location / visibility change only |
