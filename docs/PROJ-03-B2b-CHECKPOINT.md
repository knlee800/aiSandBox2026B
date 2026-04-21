# PROJ-03-B2b CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-B2b
- Title: Relax Open Project Precondition To Enable Fresh-Session Open Path Behind Feature Flag
- Nature: FRONTEND / PHASE B OPEN PROJECT PRECONDITION ACTIVATION
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-B2b-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase B — B2 Open Project wiring slice (split: B2a handler wiring, B2b precondition activation)
- Depends on: PROJ-03-B2a (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, relax `handleOpenWorkspaceProject`'s precondition so it no longer requires `selectedSessionId`, making the already-locked B2a fresh-session open path normally user-reachable from the existing Open Project button and the existing Reopen Project affordances.

## Scope Statement

This is **a single precondition block change in `frontend/app/[locale]/app/page.tsx`** — the activation slice that makes the already-wired B2a path user-reachable under the feature flag. The B2a flag-on branch body was not changed. The Open Project button JSX, the Reopen Project affordances, `handleOpenWorkspaceProject`'s signature, and the outer `try/catch/finally` structure were not changed. The B0 helper (`frontend/lib/open-project-in-fresh-session.ts`) was not changed. The B1 path (`handleCreateWorkspaceProject`) was not changed. Flag off preserves the original precondition and error wording exactly. No B3/B4 or later-phase work was performed.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Replaced the single joint precondition block with a flag-branched guard in `handleOpenWorkspaceProject`; added three non-null assertions on `selectedSessionId` in the preserved flag-off-only open/associate path for TypeScript narrowing. |

No other source files were modified.

## Flag-On Behavior Implemented

The original precondition block:

```ts
if (!selectedSessionId || !selectedProjectId) {
  setProjectActionState('error');
  setProjectActionMessage(null);
  setProjectActionError('Select both an active session and a project.');
  return;
}
```

was replaced with a flag-branched guard:

```ts
if (PROJECT_FIRST_UX) {
  if (!selectedProjectId) {
    setProjectActionState('error');
    setProjectActionMessage(null);
    setProjectActionError('Select a project to open.');
    return;
  }
} else if (!selectedSessionId || !selectedProjectId) {
  setProjectActionState('error');
  setProjectActionMessage(null);
  setProjectActionError('Select both an active session and a project.');
  return;
}
```

Under `PROJECT_FIRST_UX`:
- Only `selectedProjectId` is required; `selectedSessionId` may be `null`.
- Rejection message neutralized to `'Select a project to open.'` — the original wording referred to selecting a session, which is not user-reachable under the flag.
- When `selectedProjectId` is present, execution continues past the guard and enters the existing locked B2a flag-on branch directly below.

## Flag-Off Behavior Preserved

When `PROJECT_FIRST_UX` is false the `if (PROJECT_FIRST_UX)` block is skipped. Execution reaches the `else if` which is the exact original condition (`!selectedSessionId || !selectedProjectId`) and the exact original error wording (`'Select both an active session and a project.'`). The flag-off path is semantically and behaviorally identical to the pre-B2b state.

## Type-Safety-Only Change (No Runtime Behavior Change)

After the flag-branched guard, the existing legacy open path uses `selectedSessionId` in three places as a `string` argument. Before B2b, the original `if (!selectedSessionId || ...)` guard narrowed `selectedSessionId` to `string` for the rest of the function. After B2b, TypeScript can no longer infer that narrowing from the split guard structure. Three non-null assertions (`selectedSessionId!`) were added in the flag-off-only paths:

- `sessionId: selectedSessionId!` in the `openWorkspaceProject` call
- `sessionId: selectedSessionId!` in the `associateWorkspaceProjectSession` call
- `sessionId: selectedSessionId!` in the manual `openResult` construction

These are correct: the `else if` branch guarantees `selectedSessionId` is non-null when reached. **No runtime behavior changes.**

## B2a Branch Body Unchanged

The `if (PROJECT_FIRST_UX)` open path body starting immediately after the precondition guard (lines 1151–1175) was not modified. The B2a implementation — calling `openProjectInFreshSession`, the hydration follow-up sequence, and the success state — is locked and untouched.

## B0 Helper Unchanged

`frontend/lib/open-project-in-fresh-session.ts` was not modified.

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused tests (B0 helper + adjacent primitives + workspace shell)

```
frontend $ npx tsx --test lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 97 tests / 5 suites, 0 failures.
- `workspace-projects.logic` — 8/8 pass
- `workspace-shell component` — 72/72 pass
- `workspace-shell snapshot surface` — 3/3 pass
- `workspace-snapshots.logic` — 8/8 pass
- `open-project-in-fresh-session` — 6/6 pass

### 3. Targeted lint attempt

```
frontend $ npm run lint -- --file app/[locale]/app/page.tsx
```

Result: Known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by B2b. Same issue documented in A0/A1/A3/A2a/A2b/B0/B1/B2a checkpoints.

### 4. File-level lint check

`ReadLints` on `frontend/app/[locale]/app/page.tsx`: **no linter errors found**.

### 5. Coverage note (honest)

No focused page-handler seam test was added for "flag-on with null selectedSessionId proceeds / flag-off with null selectedSessionId rejects". Extracting that seam cleanly requires enough scaffolding to exceed this slice's boundary. The strongest surrounding verification performed was: typecheck + B0 helper tests + project/snapshot logic tests + workspace shell tests + file-level lint on the changed file.

### 6. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run and restored via `git restore` so the working-tree diff is limited to the single changed source file.

## Preserved Invariants

| Invariant | Status |
|---|---|
| `PROJECT_FIRST_UX` is kill switch | ✅ Flag off: `else if` branch is the exact original condition; behavior byte-equivalent |
| Flag off preserves exact original precondition and error wording | ✅ `else if (!selectedSessionId \|\| !selectedProjectId)` / `'Select both an active session and a project.'` unchanged |
| `selectedSessionId` null is allowed only under the flag | ✅ `else if` guard still requires `selectedSessionId` non-null when flag is off |
| B2a flag-on branch body unchanged | ✅ Lines 1151–1175 not touched |
| B0 helper contract preserved | ✅ `open-project-in-fresh-session.ts` not touched |
| Open Project button JSX, label, disabled expression unchanged | ✅ Not touched |
| Reopen Project affordances unchanged | ✅ Not touched |
| `handleOpenWorkspaceProject` signature unchanged | ✅ Not touched |
| Outer `try/catch/finally` structure unchanged | ✅ Not touched; `projectOpenInProgressRef` / `skipNextSessionEffectFileReloadRef` continue to clear via existing outer `finally` |
| `selectedSnapshotId` carryover behavior intact | ✅ Not touched in this slice |
| No change to B1 path | ✅ `handleCreateWorkspaceProject` not touched |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ `projectOpenInProgressRef` discipline governed by outer `finally`; not altered |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No B3/B4 or later-phase work | ✅ Single precondition block change only |
