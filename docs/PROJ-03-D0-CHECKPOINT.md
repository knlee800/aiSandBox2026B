# PROJ-03-D0 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-D0
- Title: Project-First Entry Shell Wiring Behind Feature Flag
- Nature: FRONTEND / PHASE D ENTRY-SHELL WIRING
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-D0-CHECKPOINT.md`
- Source: Diagnostic gap identified post-PROJ-03-C4; closes the session-first visible entry shell
- Depends on: PROJ-03-C4 (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, make the visible entry shell behave consistently with the already-locked project-first handlers. The "New Session" button was rendered unconditionally and Create/Open Project buttons were gated by `selectedSessionId`, making the entry shell session-first even when the flag was on. The underlying `page.tsx` handlers already provision fresh sessions automatically. This slice wires the entry-shell surface to match handler semantics without building a new landing page UI.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | New Session block gated by `!projectFirstUxEnabled`; `projectFirstUxEnabled` threaded into `HistoryProjectPanel`; `HistoryProjectPanel` `canMutate` made flag-aware. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Four focused D0 tests added; `projectPanelRenderOverrides` fixture constant added. |

No other source files were modified.

**`frontend/app/[locale]/app/page.tsx` — unchanged.**
**`frontend/app/[locale]/projects/page.tsx` — unchanged.**

## Locked Scope Actually Implemented

This is an entry-shell wiring change only. All handler semantics, backend calls, route structure, and legacy code paths are untouched.

### `frontend/components/workspace/workspace-shell.tsx`

**1. New Session sidebar block gated**

The existing `<div className="p-3 border-b border-gray-100">` block containing the `New Session` button, the quota count line, and both error `<p>` elements was wrapped in `{!projectFirstUxEnabled ? (...) : null}`. When `projectFirstUxEnabled` is `true`, the entire block is suppressed. The existing sessions-list gating (the `.map()` suppression introduced in A2b) was not touched.

**2. `projectFirstUxEnabled` threaded into `HistoryProjectPanel`**

Added `projectFirstUxEnabled={projectFirstUxEnabled}` at the existing `<HistoryProjectPanel>` mount site. Added `projectFirstUxEnabled?: boolean` to the panel's props interface.

**3. `HistoryProjectPanel` `canMutate` made flag-aware**

Changed:
```ts
const canMutate = Boolean(props.selectedSessionId);
```
to:
```ts
const canMutate = Boolean(props.projectFirstUxEnabled || props.selectedSessionId);
```

When the flag is on, `canMutate` is `true` regardless of `selectedSessionId`. The existing `selectedProjectId` requirement on the Open Project button's `disabled` expression was **not** changed — Open Project still requires a project to be selected.

**`HistorySnapshotPanel` was not touched.** Its own independent `canMutate` (line ~1107) correctly remains session-gated.

### `frontend/components/workspace/workspace-shell.test.tsx`

Added a shared `projectPanelRenderOverrides` fixture constant at module level (mirrors the props required to mount `HistoryProjectPanel` with all optional-but-required handlers present — the same prop set used by the existing `workspace shell snapshot surface` suite tests).

Four focused tests added inside the existing `workspace shell component` suite:

| Test | What it proves |
|---|---|
| `does not render the New Session block behind feature flag` | Flag on + `selectedSessionId: null` → `>New Session<` and `Active sessions:` absent in rendered HTML |
| `allows creating a project without selectedSessionId behind feature flag` | Flag on + `selectedSessionId: null` → `history-project-create-button` has `disabled: false` |
| `allows opening a project without selectedSessionId behind feature flag` | Flag on + `selectedSessionId: null` + `selectedProjectId: 'project-1'` → `history-project-open-button` has `disabled: false` |
| `keeps create and open project buttons disabled without selectedSessionId when feature flag is off` | Flag off + `selectedSessionId: null` → both `history-project-create-button` and `history-project-open-button` have `disabled: true` (flag-off regression) |

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `frontend/app/[locale]/projects/page.tsx` | Unchanged |
| `frontend/lib/feature-flags.ts` | Unchanged |
| All project-first handlers (`handleCreateWorkspaceProject`, `handleOpenWorkspaceProject`, `handleResumeWorkspaceProjectById`, `handleRestoreWorkspaceProjectFromSnapshotById`, etc.) | Unchanged |
| `HistorySnapshotPanel` `canMutate` | Unchanged |
| Sessions-list `.map()` gating from A2b | Unchanged |
| Advanced drawer mounting from A2b | Unchanged |
| All locked Phase A/B/C paths | Unchanged |
| No handler semantics changed | ✅ |
| No backend/API/schema work | ✅ |
| No route redesign or landing-page work | ✅ |

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused workspace-shell component suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — `104/104` tests, 0 failures. Includes all 4 new D0 tests. No regressions.

### 3. Full focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — `150/150` tests, 0 failures. No regressions across all seven suites.

### 4. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file components/workspace/workspace-shell.tsx --file components/workspace/workspace-shell.test.tsx
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by D0. Same issue documented in A0/A1/A2a/A2b/B0/B1/B2a/B2b/B3a/B4a/B4b/C1a/C1b-pre/C1b-cta/C2a-rate-limit/C2b-trigger-preview/C2c-label-format/C2c-handler/C2c-cta-handler-pre/C2c-cta-button/C2c-display/C2d-expiry-warn/C2e/C2f-file-save/C4 checkpoints.

Fallback: `ReadLints` on both changed source files — **no linter errors found**.

### 5. Cleanup

`frontend/tsconfig.tsbuildinfo` regenerated by the typecheck run and restored via `git restore -- "tsconfig.tsbuildinfo"` so the working-tree diff is limited to the two changed source files.

## Entry-Shell Changes — Honest Note

The two flag-on entry-shell changes are now in place:

- When `PROJECT_FIRST_UX` is on, the **New Session** button block no longer renders. Users are no longer presented with a session-creation affordance on the primary surface.
- When `PROJECT_FIRST_UX` is on, **Create Project** and **Open Project** controls in `HistoryProjectPanel` are no longer disabled because `selectedSessionId` is null. The underlying `page.tsx` handlers already provision fresh sessions automatically, so this change closes the gap between handler semantics and button visibility.
- When `PROJECT_FIRST_UX` is off, the entry shell is **byte-equivalent** to its pre-D0 state.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Entry-shell wiring only; no new landing page | ✅ |
| No underlying handler semantic change | ✅ All project-first handlers in `page.tsx` untouched |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: New Session block renders; Create/Open remain session-gated |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| `HistorySnapshotPanel` `canMutate` unchanged | ✅ Legacy snapshot panel remains session-gated |
| No D1 work | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No later-phase work | ✅ Entry-shell wiring only |
