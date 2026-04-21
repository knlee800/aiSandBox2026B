# PROJ-03-B3a CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B3a
- Title: Confirm And Lock Existing Reopen Project Affordances Route Through Fresh-Session Path Behind Feature Flag
- Nature: FRONTEND / PHASE B VERIFICATION AND AUDIT
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B3a-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B3 Reopen Project wiring (split: B3a verification/audit, B3b new affordances)
- Depends on: PROJ-03-B2b (COMPLETE and LOCKED)

## Objective

Lock the post-B2b reality that the existing A3 Reopen Project affordances now route through the fresh-session open path under `PROJECT_FIRST_UX`, by adding focused verification tests and documenting remaining uncovered recovery surfaces for a later slice.

## Scope Statement

This is a **verification and documentation slice only**. No production source file was changed. No new behavior was introduced. No new Reopen affordances were added to any surface. The only change is the addition of three focused tests and supporting local test helpers in the existing `workspace-shell.test.tsx` test file.

`TASKS.md` and `TASKS_BACKLOG_FULL.md` were already dirty from the prior B3a registration step and were not edited during the implementation step; they are updated only in this consolidation.

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.test.tsx` | Modified. Three new flag-gated tests added; supporting local test helpers added within the test file. |

No production source files were modified. `frontend/app/[locale]/app/page.tsx`, `frontend/components/workspace/workspace-shell.tsx`, `frontend/lib/recovery-copy.ts`, and `frontend/lib/open-project-in-fresh-session.ts` were not changed.

## Tests Added

### New local test helpers (test file only, no production source change)

`buildWorkspaceShellProps` — extracted from the existing `renderWorkspaceShell` factory to produce raw props without immediately rendering. Allows the same prop shapes to be used for both static-markup assertions and element-tree walking.

`withPatchedReactHooks` — temporarily replaces React hooks with minimal shims (`useState` → initial value, `useMemo` → factory result, `useEffect` → no-op, `useCallback` → identity) so the component function can be called directly outside a React runtime environment. Restores originals in `finally`.

`findElementByTestId` — recursively walks a React element tree (calling function components as plain functions) to locate the element whose `data-testid` prop matches a given string. Returns the element so its `onClick` prop can be inspected and invoked.

`renderWorkspaceShellElementByTestId` — composes `withPatchedReactHooks`, `WorkspaceShell(props)`, and `findElementByTestId` to locate a named button element without a DOM environment.

### New tests

**`renders and wires reopen project action for exec 404 with null selectedSessionId behind feature flag`**
- Renders with `projectFirstUxEnabled: true`, `selectedProjectId: 'project-1'`, `selectedSessionId: null`, `onOpenWorkspaceProject` mock, `execState: { status: 'http-404', result: null }`
- Asserts: `workspace-exec-reopen-project` testid present in markup; `>Reopen project<` present in markup
- Asserts: `onClick` is a function; invoking it increments a call counter; counter equals 1 after one click

**`renders and wires reopen project action for exec 410 with null selectedSessionId behind feature flag`**
- Same shape as 404 test; `execState: { status: 'http-410', result: null }`
- Same assertions, including call counter equals 1

**`renders and wires reopen project action for shell error with null selectedSessionId behind feature flag`**
- Same null-session flag-on shape; additionally sets `sessionError`, `userId: null`, `checkpoints: []`, `historyError`, `userSummary: null`, `usageSummary: null`, `quotaSummary: null`, `dashboardError`, `fileSurfaceState: 'error'`, `fileSurfaceError` to trigger the shell error state
- Asserts: `workspace-shell-reopen-project` testid present; `>Reopen project<` present; `onClick` is a function; call counter equals 1 after one click

## What the Tests Prove

Under `PROJECT_FIRST_UX` with `selectedProjectId` present and `selectedSessionId` null (the post-B2b normal state when the sessions list is hidden), the existing A3 Reopen Project affordances:

1. still render on exec 404, exec 410, and shell error surfaces — confirming that `canReopenProject = projectFirstUxEnabled && Boolean(selectedProjectId) && Boolean(onOpenWorkspaceProject)` does not require `selectedSessionId` to be non-null.
2. still call `onOpenWorkspaceProject` exactly once when the button is clicked — confirming the existing callback seam is correctly wired.

This locks the transitive behavior from A3 + B2a + B2b: A3 added the affordances; B2a made the handler call `openProjectInFreshSession` under the flag; B2b relaxed the precondition so `selectedSessionId: null` is a valid entry shape.

## Honest Scope Note

B3a verifies the **workspace-shell component seam** only. Specifically, it verifies that:
- the Reopen button renders under the correct conditions, and
- the button's `onClick` prop resolves to a callable that forwards to `onOpenWorkspaceProject`.

B3a does **not** directly test the page-level `handleOpenWorkspaceProject` internals or the fresh-session helper (`openProjectInFreshSession`) end-to-end under the `selectedSessionId: null` entry shape. That verification remains outside B3a's locked scope. The B2b checkpoint documented this gap honestly; B3a closes the component-seam portion only.

## Audit: Recovery Surfaces vs Reopen Primary Action

The table below audits `workspace-shell.tsx` for surfaces that show a `StateMessage` (or equivalent error/empty state visible to the user) and whether they carry a `primaryActionLabel` / Reopen button under `PROJECT_FIRST_UX`.

| Surface | Condition | Has Reopen Primary Action | testid | Covered by Tests |
|---|---|---|---|---|
| Exec panel — 404 | `execState.status === 'http-404'` + `canReopenProject` | ✅ Yes | `workspace-exec-reopen-project` | ✅ B3a (new), A3 (prior) |
| Exec panel — 410 | `execState.status === 'http-410'` + `canReopenProject` | ✅ Yes | `workspace-exec-reopen-project` | ✅ B3a (new), A3 (prior) |
| Shell error state | `shellState === 'error'` + `canReopenProject` | ✅ Yes | `workspace-shell-reopen-project` | ✅ B3a (new) |
| Shell state — empty (no session/project) | `shellState === 'empty'` | ❌ No Reopen button | — | — |
| Editor surface — empty (no files) | `fileSurfaceState === 'empty'` | ❌ No Reopen button (copy only) | — | — |
| Editor surface — error | `fileSurfaceState === 'error'` | ❌ No Reopen button (copy only) | — | — |
| Shell state — loading error | `sessionError` on loading path | ❌ No Reopen button | — | — |

**Candidate surfaces for B3b:** The three uncovered surfaces above (shell empty, editor empty, editor error) display project-first copy from the A3 bundle that references opening/reopening a project, but none currently exposes a `primaryAction` Reopen button. These are candidates for B3b — no implementation is proposed here.

## Validation

### 1. Component tests

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 78 tests / 2 suites, 0 failures.
- `workspace shell component` — 75/75 pass (includes the 3 new B3a tests)
- `workspace shell snapshot surface` — 3/3 pass

### 2. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file components/workspace/workspace-shell.test.tsx
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B3a. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a/B2b checkpoints.

### 4. File-level lint check

`ReadLints` run on `frontend/components/workspace/workspace-shell.test.tsx`: **No linter errors found.**

### 5. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the single changed test file.

## Preserved Invariants

| Invariant | Status |
|---|---|
| No production source behavior change | ✅ Only test file modified; zero runtime change |
| `PROJECT_FIRST_UX` is the kill switch | ✅ All three new tests are gated on `projectFirstUxEnabled: true`; flag-off path untouched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No new Reopen affordances on additional surfaces | ✅ B3b scope; not touched here |
| No change to `handleOpenWorkspaceProject`, B0 helper, B1/B2a/B2b paths | ✅ Not touched |
| No B3b/B4 or Phase C/D/E work | ✅ Verification and audit slice only |
