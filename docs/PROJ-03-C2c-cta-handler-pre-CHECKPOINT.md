# PROJ-03-C2c-cta-handler-pre CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2c-cta-handler-pre
- Title: Add Page-Level Named Project Save Handler Wired To Helper Behind Feature Flag
- Nature: FRONTEND / PHASE C NAMED SAVE — PAGE HANDLER WIRING (NO UI)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2c-cta-handler-pre-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c third slice: page-level handler pre-step
- Depends on: PROJ-03-C2c-handler (COMPLETE and LOCKED)

## Objective

Add one new `handleSaveNamedProjectSnapshot(name: string)` callback in `page.tsx` that calls the locked `attemptNamedProjectSave` helper, reloads the workspace snapshots list on success, and exposes the callback as a new optional `onSaveNamedProjectSnapshot` prop on `WorkspaceShell`. No visible UI in this slice.

## Scope Statement

This is **a handler-pre-only slice with no visible named-save UI**. C2c-cta-handler-pre introduces one new handler function in `page.tsx` and one new optional prop declaration in `workspace-shell.tsx`. No button, dialog, prompt, or any user-visible surface was added. No existing handler body was modified. No new effect, no new ref, and no layout change was introduced.

The repo already had task-file modifications from the earlier C2c-cta-handler-pre registration step (`TASKS.md`, `TASKS_BACKLOG_FULL.md`). The implementation step changed only:

- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.tsx`

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Additive only. New import for `attemptNamedProjectSave`; new `handleSaveNamedProjectSnapshot` handler; handler passed into `<WorkspaceShell>` as `onSaveNamedProjectSnapshot`. |
| `frontend/components/workspace/workspace-shell.tsx` | Additive only. One new optional prop `onSaveNamedProjectSnapshot?: (name: string) => Promise<void>` added to `WorkspaceShellProps`. Not consumed. |

No other source files were modified. `frontend/lib/project-named-save.ts`, `frontend/lib/project-autosave.ts`, `frontend/lib/recovery-copy.ts`, `frontend/lib/open-project-in-fresh-session.ts`, `frontend/lib/autosave-rate-limit.ts`, and `frontend/components/workspace/workspace-snapshots.logic.ts` are all unchanged.

## Implementation Details

### `frontend/app/[locale]/app/page.tsx` — additive changes

**New import (line 9):**

```ts
import { attemptNamedProjectSave } from '@/lib/project-named-save';
```

**New handler `handleSaveNamedProjectSnapshot` (inserted after `handleRestoreWorkspaceProjectFromSnapshotById`):**

```ts
async function handleSaveNamedProjectSnapshot(name: string): Promise<void> {
  if (!PROJECT_FIRST_UX) {
    return;
  }

  const token = localStorage.getItem('access_token');
  if (!token) {
    return;
  }

  if (!selectedProjectId) {
    return;
  }

  if (!selectedSessionId) {
    return;
  }

  if (projectOpenInProgressRef.current) {
    return;
  }

  const saveResult = await attemptNamedProjectSave({
    token,
    sessionId: selectedSessionId,
    projectId: selectedProjectId,
    name,
  });
  if (saveResult.status === 'failed') {
    console.error('Failed to save named project snapshot.');
    return;
  }

  void loadWorkspaceSnapshotsForUser(token);
}
```

**Guard order (required order, in sequence):**

1. `PROJECT_FIRST_UX` — kill switch; returns immediately when flag is off
2. `token` — missing token returns without side effects (no redirect, unlike open-project handlers — this is a save, not a navigation action)
3. `selectedProjectId` — no project selected; return without side effects
4. `selectedSessionId` — no session selected; return without side effects
5. `projectOpenInProgressRef.current` — project open in flight; return without side effects

**Active path:** Calls locked `attemptNamedProjectSave({ token, sessionId, projectId, name })` with state values captured at call time. On `{ status: 'failed' }`, logs to `console.error` and returns — no UI surface exposed, no re-throw. On `{ status: 'saved' }`, triggers `void loadWorkspaceSnapshotsForUser(token)` (best-effort; explained below).

**Prop wiring in `<WorkspaceShell>` JSX (line ~3896):**

```tsx
onSaveNamedProjectSnapshot={handleSaveNamedProjectSnapshot}
```

Added adjacent to the existing locked handler props (`onRestoreWorkspaceProjectFromSnapshotById`, `onResumeWorkspaceProjectById`).

### Design notes

- **No `projectOpenInProgressRef.current = true` in this handler.** This is a save operation, not a project-open sequence. The guard reads the ref but never writes it.
- **No rate-limit check.** Named saves are explicit user-initiated actions. Rate-limiting belongs on autosave only (`attemptProjectAutosave`).
- **Token guard does not redirect.** Unlike open-project handlers where a missing token triggers `router.push(/${locale}/login)`, the named-save handler simply returns. A silent no-op is appropriate here: the handler will be called from a future UI button that only renders in an authenticated context.

### `frontend/components/workspace/workspace-shell.tsx` — additive change

One new optional prop added to `WorkspaceShellProps` (after the existing `onRestoreWorkspaceProjectFromSnapshotById` declaration):

```ts
onSaveNamedProjectSnapshot?: (name: string) => Promise<void>;
```

The prop is **not consumed** anywhere inside `WorkspaceShell` in this slice. No derived callback, no rendered element, no conditional expression. This is the intentional C1b-pre / B4a handler-pre pattern: expose the seam now; wire the visible UI consumer in the follow-on C2c-cta-button slice.

## Best-Effort Snapshot Reload

`void loadWorkspaceSnapshotsForUser(token)` is used (not `await`) after a successful named save. This keeps the snapshot-list refresh best-effort so that a reload failure cannot delay or surface a new visible failure path after the named save itself has already been committed. The snapshot was already persisted to the backend at this point; the `void` only means the UI panel update is fire-and-forget, consistent with the autosave trigger design in C2b.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/recovery-copy.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| `WorkspaceShell` JSX, render logic, derived callbacks | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c-label-format/C2c-handler paths | Unchanged |

## No Visible UI

This slice introduced **no visible UI change**:

- No button
- No dialog or `window.prompt`
- No `recovery-copy.ts` change
- No new rendered element of any kind
- The only observable effect of the prop reaching `WorkspaceShell` is that TypeScript accepts the new prop shape — there is nothing yet to render because the prop is unconsumed inside the shell

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Full focused regression suite

```
frontend $ npx tsx --test lib/project-named-save.test.ts lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 137 tests / 6 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 88/88 pass
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 13/13 pass
- `autosave-rate-limit` — 9/9 pass
- `open-project-in-fresh-session` — 6/6 pass
- `project-autosave` — 6/6 pass (top-level)
- `project-named-save` — 4/4 pass (top-level)

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file app/[locale]/app/page.tsx --file components/workspace/workspace-shell.tsx
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by C2c-cta-handler-pre. Same issue documented in all prior Phase A, B, and C checkpoints.

### 4. File-level lint check

`ReadLints` on both changed source files: **no linter errors found**.

### 5. Coverage note (consistent with C1b-pre / B4a precedent)

No page-handler seam test was added for `handleSaveNamedProjectSnapshot`. Extracting that seam cleanly in isolation would require mocking `localStorage`, `fetch`, `router`, and `useRef` at a page level, exceeding this slice's boundary. The strongest surrounding verification performed was: typecheck + full focused regression suite (137 tests) + file-level lint on both changed files. This is consistent with C1b-pre, B4a, B4b, and B2a — none of those handler-only slices added a focused page-handler test.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo` so the working-tree diff is limited to the two changed source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Handler-pre only; no visible named-save UI in this slice | ✅ No button/dialog/prompt; prop declared but unconsumed |
| Handler does not fire during project-open hydration | ✅ `projectOpenInProgressRef.current` guard present and required |
| `projectOpenInProgressRef` is read-only in this handler (save ≠ open) | ✅ Not set to `true`; not cleared in any `finally`; ref discipline preserved |
| Snapshot reload best-effort only | ✅ `void loadWorkspaceSnapshotsForUser(token)` — not `await` |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Flag off: first guard returns immediately; helper never called |
| No rate-limit gating | ✅ Named saves are user-initiated; rate-limit belongs on `attemptProjectAutosave` only |
| `attemptNamedProjectSave` not modified | ✅ Called as-is; no edits to `project-named-save.ts` |
| No consumer wiring inside `WorkspaceShell` | ✅ Prop declared; not consumed; no derived callback |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No consumer UI, no C2c-cta-button, no C2c-display, no C2d/C2e/C2f, no C3, no C4, and no later-phase work | ✅ |
