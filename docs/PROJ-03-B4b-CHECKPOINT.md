# PROJ-03-B4b CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B4b
- Title: Add Resume Latest Project CTA In Shell Empty State Behind Feature Flag
- Nature: FRONTEND / PHASE B CTA UI
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B4b-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B4 Resume Latest Project CTA (split: B4a handler wiring, B4b CTA UI)
- Depends on: PROJ-03-B4a (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, add a single "Resume latest project" primary-action button to the existing `shellState === 'empty'` `StateMessage` in `WorkspaceShell`. The CTA computes the latest project from the existing `workspaceProjects` prop and calls the locked B4a `onResumeWorkspaceProjectById` callback. No route or IA change.

## Scope Statement

This is a **visible CTA UI slice only**. B4b adds exactly one button — the "Resume latest project" primary action in the shell-empty state — behind `PROJECT_FIRST_UX`. No new routes, no new handlers, no new data fetches, and no changes to existing handler internals or recovery affordances were made. No Phase C or later-phase work was performed.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty from the prior B4b registration step and were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | Added one new additive copy entry: `actions.resumeLatestProject = 'Resume latest project'`. |
| `frontend/components/workspace/workspace-shell.tsx` | Added local `computeLatestProject` helper; derived `handleResumeLatestProject` in `WorkspaceShell`; extended `ShellStateMessage` props with `onResumeLatestProject`; mounted CTA in shell-empty `StateMessage`. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added four focused B4b tests. |

No other source files were modified. `frontend/app/[locale]/app/page.tsx` and `frontend/lib/open-project-in-fresh-session.ts` were unchanged.

## Implementation Details

### `recovery-copy.ts`

One new additive entry under `actions`:

```ts
resumeLatestProject: 'Resume latest project',
```

No existing entries changed.

### `workspace-shell.tsx` — `computeLatestProject` helper

New pure local function placed above `ShellStateMessage`:

```ts
function computeLatestProject(
  projects: WorkspaceProjectSummary[],
): WorkspaceProjectSummary | null {
  if (projects.length === 0) {
    return null;
  }
  const [latestProject] = [...projects].sort((left, right) => {
    const updatedAtComparison = right.updatedAt.localeCompare(left.updatedAt);
    if (updatedAtComparison !== 0) {
      return updatedAtComparison;
    }
    return left.id.localeCompare(right.id);
  });
  return latestProject ?? null;
}
```

- Uses `workspaceProjects` only; never touches public projects.
- Sorts by `updatedAt` descending (ISO 8601 strings sort lexicographically; this is correct).
- Tie-break by `id` ascending (deterministic).

### `workspace-shell.tsx` — derivations inside `WorkspaceShell`

Two new local derivations added after the existing `canReopenProject` derivation:

```ts
const latestProject = projectFirstUxEnabled
  ? computeLatestProject(props.workspaceProjects ?? [])
  : null;

const handleResumeLatestProject =
  latestProject && props.onResumeWorkspaceProjectById
    ? (() => {
        const onResumeWorkspaceProjectById = props.onResumeWorkspaceProjectById;
        return () => {
          void onResumeWorkspaceProjectById(latestProject.id);
        };
      })()
    : undefined;
```

- Uses the local `projectFirstUxEnabled` derived value (not the raw constant) so test overrides work consistently.
- The IIFE captures `onResumeWorkspaceProjectById` locally to satisfy TypeScript's possibly-undefined narrowing; no runtime behavior difference.
- The inner function is `() => void`, matching the `onPrimaryAction` type on `StateMessage`.

### `workspace-shell.tsx` — `ShellStateMessage` props extension

One new optional prop added to `ShellStateMessage`:

```ts
onResumeLatestProject?: () => void;
```

Destructured alongside the existing props in the function body. No other changes to `ShellStateMessage`'s interface.

### `workspace-shell.tsx` — CTA in shell-empty `StateMessage`

The three primary-action props added to the `state === 'empty'` `StateMessage` return only:

```tsx
primaryActionLabel={
  projectFirstUxEnabled && onResumeLatestProject
    ? recoveryCopy.actions.resumeLatestProject
    : undefined
}
onPrimaryAction={projectFirstUxEnabled ? onResumeLatestProject : undefined}
primaryActionTestId={
  projectFirstUxEnabled && onResumeLatestProject
    ? 'workspace-shell-resume-latest-project'
    : undefined
}
```

Mount location: the `state === 'empty'` branch of `ShellStateMessage` only. All other shell states (`loading`, `error`, `ready`) were not changed.

`ShellStateMessage` is called from one site in `WorkspaceShell`, where `onResumeLatestProject={handleResumeLatestProject}` was added.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged |
| `handleResumeWorkspaceProjectById` handler (B4a) | Unchanged |
| `onResumeWorkspaceProjectById` prop on `WorkspaceShellProps` (B4a) | Unchanged |
| `handleOpenWorkspaceProject`, `handleCreateWorkspaceProject` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` (B0 helper) | Unchanged |
| Existing `recoveryCopy` entries | Unchanged |
| Existing `ShellStateMessage` states (loading, error, ready) | Unchanged |
| Reopen Project affordances (exec 404/410, shell error) | Unchanged |
| B0/B1/B2a/B2b/B3a paths | Unchanged |

## Test Coverage

Four focused tests added to `workspace-shell.test.tsx`:

| Test | What it proves |
|---|---|
| `does not render resume latest project action in shell empty state when feature flag is off` | Flag off: CTA absent even with `workspaceProjects` and handler present |
| `renders and wires resume latest project action in shell empty state behind feature flag` | Flag on + projects + handler: CTA renders; click calls `onResumeWorkspaceProjectById` exactly once with resolved latest project id (`project-a`, which wins the deterministic tie-break over `project-b` at the same `updatedAt`) |
| `does not render resume latest project action in shell empty state with no workspace projects` | Flag on + empty `workspaceProjects`: CTA absent |
| `does not render resume latest project action in shell empty state without handler` | Flag on + handler absent: CTA absent |

Supporting test fixture `resumeLatestProjects` added at module level in the test file (three projects: `project-b` and `project-a` share the same `updatedAt`, `project-c` is older). Tie-break by id ascending resolves to `project-a`.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors. (Note: one intermediate `TS2722` error appeared during development due to a possibly-undefined narrowing on the async callback wrapper; resolved by capturing the prop in a local const inside an IIFE before wrapping.)

### 2. Focused tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 104 tests / 5 suites, 0 failures.

- `workspace-projects.logic` — 8/8 pass
- `workspace shell component` — 79/79 pass (includes all 4 new B4b tests)
- `workspace shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.tsx --file components/workspace/workspace-shell.test.tsx --file lib/recovery-copy.ts
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B4b. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a/B2b/B3a/B4a checkpoints.

### 4. File-level lint check

`ReadLints` run on all three changed source files:

- `frontend/lib/recovery-copy.ts` — no linter errors
- `frontend/components/workspace/workspace-shell.tsx` — no linter errors
- `frontend/components/workspace/workspace-shell.test.tsx` — no linter errors

### 5. Coverage note (honest)

B4b verifies the `WorkspaceShell` component seam: that the CTA renders under the correct conditions and that `onClick` correctly calls `onResumeWorkspaceProjectById` with the resolved latest project id.

B4b does **not** add a browser/manual E2E flow, and does **not** add a page-level handler seam test for `handleResumeWorkspaceProjectById` itself. That handler's internals are covered by B4a's locked scope. This limitation is consistent with B1/B2a/B2b/B4a — none of those handler slices added page-level seam tests.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the three changed source files.

## Preserved Invariants

| Invariant | Status |
|---|---|
| This slice adds one visible CTA only, in the shell-empty state | ✅ No other state messages or affordances changed |
| `PROJECT_FIRST_UX` is the kill switch | ✅ Flag off: `computeLatestProject` not called; `handleResumeLatestProject` is `undefined`; CTA absent |
| Latest-project computation uses `workspaceProjects` only, not public projects | ✅ `computeLatestProject` receives `props.workspaceProjects ?? []` only |
| `updatedAt` is a non-optional ISO string on `WorkspaceProjectSummary` | ✅ Confirmed during stage-start; lexicographic compare is correct for ISO 8601 |
| `onPrimaryAction` handler is `() => void`; no async function passed directly | ✅ Async callback wrapped; inner function is synchronous `() => void` |
| No route or IA change | ✅ Not touched |
| No change to existing Open Project button | ✅ Not touched |
| No change to Reopen Project affordances | ✅ Not touched |
| No change to B4a handler internals | ✅ `handleResumeWorkspaceProjectById` and `onResumeWorkspaceProjectById` unchanged |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No Phase C/D/E work | ✅ CTA UI slice only; no Phase C work started |
