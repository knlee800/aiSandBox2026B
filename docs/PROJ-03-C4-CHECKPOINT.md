# PROJ-03-C4 CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C4
- Title: Replace User-Facing Snapshot Wording With History Vocabulary Behind Feature Flag
- Nature: FRONTEND / PHASE C UX VOCABULARY — USER-FACING WORDING ONLY
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C4-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C4: vocabulary swap
- Depends on: PROJ-03-C2f-file-save (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, replace user-facing strings that say "snapshot/snapshots" with the project-first "history/save" vocabulary already adopted in `ProjectHistoryPanel` and related project-first UI surfaces. Keep all internal TypeScript identifiers, helpers, DTOs, routes, and backend concepts unchanged.

## Scope Statement

C4 is a wording-only pass. Only string values in two files were changed. No internal identifiers, prop names, function names, test IDs, or logic were touched. `workspace-shell.tsx` was left entirely unchanged.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | One string value updated in `recoveryCopy.workspace`. |
| `frontend/app/[locale]/app/page.tsx` | One fallback error string made `PROJECT_FIRST_UX`-gated. |

`frontend/components/workspace/workspace-shell.tsx` — **unchanged**. Confirmed read-only during this task.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were dirty in the working tree from the prior registration step but were not modified during the implementation step.

## Wording Changes

### `frontend/lib/recovery-copy.ts`

`recoveryCopy.workspace.openProjectToInspectSnapshots` string value changed:

- Before: `'Open a project to inspect checkpoint snapshots.'`
- After: `'Open a project to inspect checkpoint history.'`

This key is consumed in `workspace-shell.tsx` at `HistorySnapshotStateMessage` (line 5255), which is rendered only when `props.projectFirstUxEnabled` is true:

```tsx
props.projectFirstUxEnabled
  ? recoveryCopy.workspace.openProjectToInspectSnapshots
  : 'Select an active session to inspect checkpoint snapshots.'
```

The legacy string on the false branch is untouched.

### `frontend/app/[locale]/app/page.tsx`

The shared snapshot-load fallback error inside `loadWorkspaceSnapshotsForUser` catch block is now flag-gated:

```ts
setSnapshotActionError(
  error instanceof Error && error.message.trim()
    ? error.message
    : PROJECT_FIRST_UX
      ? 'Failed to load project history.'
      : 'Failed to load workspace snapshots.',
);
```

- `PROJECT_FIRST_UX=true` → `'Failed to load project history.'`
- `PROJECT_FIRST_UX=false` → `'Failed to load workspace snapshots.'` (unchanged legacy wording)

## Intentionally Untouched Wording

All of the following strings belong to `HistorySnapshotPanel` in `workspace-shell.tsx`, which is the legacy / flag-off session-scoped snapshot surface. These were explicitly not changed:

- `'Project Snapshots'` (heading)
- `'Save/restore snapshots and import/export workspace archives for the active session.'` (sub-copy)
- `'Save Snapshot'` (button)
- `'Restore Snapshot'` (button)
- `'Loading snapshots...'` (list loading state)
- `'Failed to load snapshots.'` (list error state)
- `'Available snapshots'` (select label)
- `'Select a snapshot'` (select placeholder)

Additionally, `'Project created with initial snapshot.'` in `page.tsx` was left unchanged because it is only reachable in the `!PROJECT_FIRST_UX` branch of `handleCreateWorkspaceProject` (the `PROJECT_FIRST_UX` branch returns early before that string is reached).

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `HistorySnapshotPanel` strings | Unchanged |
| All internal TypeScript identifiers (e.g. `WorkspaceSnapshotSummary`, `loadWorkspaceSnapshotsForUser`, `saveWorkspaceSnapshot`) | Unchanged |
| Prop names, function names, test IDs | Unchanged |
| All autosave trigger logic (C2a/C2b/C2c/C2d-expiry-warn/C2e/C2f-file-save) | Unchanged |
| All locked Phase A/B/C1/C2 paths | Unchanged |
| Backend, DTOs, routes, schema | Unchanged |
| Label formats (`[project-id:...]` / `[project-id:...:name:...]`) | Unchanged |

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Full focused regression suite

```
frontend $ npx tsx --test lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-shell.test.tsx components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 146/146 tests, 0 failures. No regressions.

### 3. Lint

Targeted `npm run lint` attempt hit the known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. `ReadLints` on `frontend/app/[locale]/app/page.tsx` and `frontend/lib/recovery-copy.ts`: **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo`.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Cosmetic/user-facing wording only; no behavioral change | ✅ |
| No internal identifier renames | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ |
| Legacy `HistorySnapshotPanel` strings preserved on flag-off path | ✅ |
| `workspace-shell.tsx` left entirely unchanged | ✅ |
| No autosave trigger changes | ✅ |
| No C2d-unload | ✅ |
| No C3 / C4 follow-up / Phase D/E work | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
