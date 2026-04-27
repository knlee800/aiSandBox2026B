# PROJ-03-D0e-hotfix CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D0e-hotfix
- **Title:** Fix Draft Restore Match And One-Shot Consumption Behind Feature Flag
- **Nature:** FRONTEND / TAB-SCOPED DRAFT PERSISTENCE / BUG FIX
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D0e-hotfix-CHECKPOINT.md`
- **Source:** Post-D0e inspection: the D0e write path is correct but the restore path has two defects — the cold-mount draft ref is cleared unconditionally on the first `loadWorkspaceFileContent` call regardless of match outcome, and the `projectId` predicate compares against `selectedProjectId` which may still be `null` at the time of the first file load after refresh (project-list fetch races behind session/file hydration). Result: draft restore fails silently and the draft is permanently discarded on every normal refresh.
- **Depends on:** PROJ-03-D0e (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, fix the D0e restore-path bug so a tab-scoped unsaved editor draft is not discarded before a valid restore match occurs, and so project matching tolerates the bootstrap hydration race after refresh. Preserve the existing conservative per-tab draft model and explicit save flow.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Two surgical changes inside the existing `loadWorkspaceFileContent(...)` draft-restore block. |

**`frontend/app/[locale]/app/page.tsx` was the only production file changed.**

**No test files were added or modified in this step.**

**Task and checkpoint files already present in the working tree (from the registration step) were not edited during the implementation step.**

## Locked Scope Actually Implemented

This is a restore-path-only correction. The write path, the draft key, the `sessionStorage` value shape, the explicit save flow, the bootstrap draft-read, all handler semantics, all non-draft logic, and all locked Phase A–D paths are untouched.

### `frontend/app/[locale]/app/page.tsx`

Two targeted changes inside `loadWorkspaceFileContent(...)`, immediately after the staleness guard, in the existing D0e draft-restore block:

#### 1. Conditional ref clear (instead of unconditional)

**Before (D0e):**
```ts
const coldMountEditorDraft = PROJECT_FIRST_UX ? coldMountEditorDraftRef.current : null;
coldMountEditorDraftRef.current = null;   // unconditional — clears on first call regardless of match
```

**After (D0e-hotfix):**
```ts
const coldMountEditorDraft = PROJECT_FIRST_UX ? coldMountEditorDraftRef.current : null;
// ref clear moved to inside the shouldRestoreEditorDraft branch below
```

The ref is now cleared only when `shouldRestoreEditorDraft` is true:

```ts
if (shouldRestoreEditorDraft) {
  coldMountEditorDraftRef.current = null;
}
```

This allows a non-matching first `loadWorkspaceFileContent` call (e.g., triggered before `selectedProjectId` has hydrated) to leave the draft ref intact for a subsequent matching call.

#### 2. Hydration-tolerant `projectId` predicate

**Before (D0e):**
```ts
coldMountEditorDraft.projectId === selectedProjectId &&
```

When `selectedProjectId` is `null` (project-list fetch not yet resolved), this is always `string === null` → false → no restore.

**After (D0e-hotfix):**
```ts
const coldMountRestoreProjectId =
  selectedProjectId ?? sessionStorage.getItem(TAB_SELECTED_PROJECT_STORAGE_KEY);
// ...
coldMountEditorDraft.projectId === coldMountRestoreProjectId &&
```

`TAB_SELECTED_PROJECT_STORAGE_KEY` is the existing D0d tab-seed key already written to `sessionStorage` by the session-selection persistence effect. The fallback read is safe here because `loadWorkspaceFileContent` is called from effects and handlers, never at SSR time.

#### Complete hotfix block as implemented

```ts
const coldMountEditorDraft = PROJECT_FIRST_UX ? coldMountEditorDraftRef.current : null;
const coldMountRestoreProjectId =
  selectedProjectId ?? sessionStorage.getItem(TAB_SELECTED_PROJECT_STORAGE_KEY);
const shouldRestoreEditorDraft =
  !!coldMountEditorDraft &&
  coldMountEditorDraft.projectId === coldMountRestoreProjectId &&
  coldMountEditorDraft.sessionId === sessionId &&
  coldMountEditorDraft.filePath === fileResponse.path;
if (shouldRestoreEditorDraft) {
  coldMountEditorDraftRef.current = null;
}
const restoredFileContent = shouldRestoreEditorDraft
  ? coldMountEditorDraft.content
  : fileResponse.content;
```

Unchanged from D0e:
- exact `sessionId` match
- exact `filePath` match
- all state setters (`setSelectedFilePath`, `setSelectedFileContent`, `setSavedFileContent`, `setFileSaveState`)
- draft write/remove effect (lines 598–628)
- `handleSaveWorkspaceFile(...)` explicit save flow
- all non-draft logic in `loadWorkspaceFileContent`

## No Backend / API / Schema Changes

No backend/API/schema changes were made. No new UI surface was introduced. No true autosave-to-disk was implemented. The explicit save flow remains intact.

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| D0e write/remove effect | Unchanged |
| D0e bootstrap draft read | Unchanged |
| D0e `handleSaveWorkspaceFile` draft clear | Unchanged |
| All non-AI autosave flows (C2b, C2d-expiry-warn, C2e/C2e-hotfix, C2f-file-save) | Unchanged |
| All project-open hydration paths | Unchanged |
| `handleWorkspaceEditorContentChange(...)` | Unchanged |
| Named-save flow and label helpers | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn/C2e/C2f-file-save/C4/D0/D0b/D0c/D0d/C2e-hotfix/D0e paths | Unchanged |

No tests were added. No helper or logic modules were changed.

## Validation

### 1. TypeScript typecheck

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused regression suite

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-autosave.test.ts lib/project-named-save.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 150/150 tests passing, 0 failures. No regressions across all seven suites.

### 3. Targeted lint attempt

```
cd C:\Users\knlee\aiSandBox2026B\frontend
npm run lint -- --file "app/[locale]/app/page.tsx"
```

Result: Same known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. Same issue documented in all prior PROJ-03 checkpoints from A0 onward.

Fallback: `ReadLints` on `frontend/app/[locale]/app/page.tsx` — **no linter errors found**.

### 4. Cleanup

`frontend/tsconfig.tsbuildinfo` was regenerated by the typecheck run. Restored via `git restore -- "frontend/tsconfig.tsbuildinfo"` so the working-tree diff is limited to the single changed production file.

## Honest Note

This hotfix corrects only the two restore-path defects:

- **One-shot consumption defect:** the ref was cleared on the first `loadWorkspaceFileContent` call unconditionally, so any non-matching first load (e.g., triggered before `selectedProjectId` had hydrated) permanently discarded the draft. Now the ref is only cleared on a successful match.
- **Hydration-race defect:** `selectedProjectId` is typically `null` at the time of the first file load after refresh because the project-list API response races behind the session/file-load chain. The `projectId` predicate now falls back to the D0d tab-seed from `sessionStorage` when `selectedProjectId` is `null`, ensuring the match succeeds even during the bootstrap hydration window.

Behavior remains conservative and context-matched:
- Restore is still tab-scoped, still behind `PROJECT_FIRST_UX`, and still requires exact `sessionId` and `filePath` matches.
- The draft ref is still consumed at most once per cold mount (on first successful match).
- Does not autosave to disk, does not change backend state, and does not alter the current explicit save flow.
- Tabs that have never typed anything (new tabs, first-ever visit to a file) get the same behavior as before D0e with no draft to restore.

## Preserved Invariants

| Invariant | Status |
|---|---|
| D0e restore-path correction only | ✅ |
| Draft persistence only, not disk persistence — no workspace files written | ✅ |
| Auth/identity/preferences remain in `localStorage`; draft only in `sessionStorage` | ✅ |
| Draft storage tab-scoped only | ✅ |
| All `sessionStorage` access inside effects/handlers (SSR-safe) | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: byte-identical to pre-D0e |
| Explicit save flow intact | ✅ No change to `handleSaveWorkspaceFile(...)` |
| `handleWorkspaceEditorContentChange(...)` unchanged | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No D1 work | ✅ Not implemented |
| No C3 work | ✅ Not implemented |
| No C2d-unload work | ✅ Not implemented |
| No true editor autosave-to-disk | ✅ Not implemented |
| No unload handling | ✅ Not implemented |
| No later-phase work | ✅ Restore-path correction only |
