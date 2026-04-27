# PROJ-03-D0e CHECKPOINT

## Task Metadata

- **Task ID:** PROJ-03-D0e
- **Title:** Restore Unsaved Editor Draft Per Tab Behind Feature Flag
- **Nature:** FRONTEND / TAB-SCOPED DRAFT PERSISTENCE
- **Status:** COMPLETE and LOCKED
- **Checkpoint:** `docs/PROJ-03-D0e-CHECKPOINT.md`
- **Source:** Post-D0d gap: manual editor typing that was never explicitly saved to disk lives only in frontend state and is lost on refresh/close. AI-created file loss was addressed by C2e-hotfix; this slice covers the remaining human-typed-but-unsaved buffer case using tab-scoped `sessionStorage` draft persistence.
- **Depends on:** PROJ-03-D0d (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, persist the current unsaved editor buffer in tab-scoped `sessionStorage` and restore it when the same tab returns to the same project/session/file context on cold mount. Do not autosave the workspace file to disk.

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | New constant; new ref; bootstrap effect extended; new write/remove effect; `loadWorkspaceFileContent` updated; `handleSaveWorkspaceFile` updated. |

**`frontend/app/[locale]/app/page.tsx` was the only production file changed.**

**No test files were added or modified in this step.**

## Locked Scope Actually Implemented

This is a tab-scoped draft persistence change only. All handler semantics, backend calls, autosave flows, explicit save flow, route structure, and legacy code paths are untouched.

### `frontend/app/[locale]/app/page.tsx`

Six localized additions/modifications were made:

#### 1. New `sessionStorage` key constant (alongside the D0d tab keys at line 122)

```ts
const TAB_EDITOR_DRAFT_STORAGE_KEY = 'workspace_tab_editor_draft';
```

#### 2. New cold-mount draft ref (alongside the D0d seed refs, after `coldMountSeededProjectIdRef`)

```ts
const coldMountEditorDraftRef = useRef<{
  projectId: string;
  sessionId: string;
  filePath: string;
  content: string;
} | null>(null);
```

#### 3. Bootstrap effect extended (inside existing `[locale, router]` effect, alongside the D0d seed reads)

When `PROJECT_FIRST_UX` is on: reads `TAB_EDITOR_DRAFT_STORAGE_KEY` from `sessionStorage`, parses and validates the JSON shape, and stores the result in `coldMountEditorDraftRef.current` (or `null` if missing, malformed, or structurally invalid). When `PROJECT_FIRST_UX` is off: sets ref to `null`. All `sessionStorage` access is synchronous in the bootstrap effect, before any async loads fire.

```ts
const storedEditorDraft = sessionStorage.getItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
if (!storedEditorDraft) {
  coldMountEditorDraftRef.current = null;
} else {
  try {
    const parsedDraft: unknown = JSON.parse(storedEditorDraft);
    const candidateDraft =
      parsedDraft && typeof parsedDraft === 'object'
        ? (parsedDraft as Record<string, unknown>)
        : null;
    if (
      candidateDraft &&
      typeof candidateDraft.projectId === 'string' &&
      typeof candidateDraft.sessionId === 'string' &&
      typeof candidateDraft.filePath === 'string' &&
      typeof candidateDraft.content === 'string'
    ) {
      coldMountEditorDraftRef.current = {
        projectId: candidateDraft.projectId,
        sessionId: candidateDraft.sessionId,
        filePath: candidateDraft.filePath,
        content: candidateDraft.content,
      };
    } else {
      coldMountEditorDraftRef.current = null;
    }
  } catch {
    coldMountEditorDraftRef.current = null;
  }
}
// else branch:
coldMountEditorDraftRef.current = null;
```

#### 4. New write/remove effect (added alongside the D0d write effects, lines 595–632)

```ts
useEffect(() => {
  if (!PROJECT_FIRST_UX) {
    return;
  }

  if (
    selectedProjectId &&
    selectedSessionId &&
    selectedFilePath &&
    selectedFileContent !== savedFileContent
  ) {
    sessionStorage.setItem(
      TAB_EDITOR_DRAFT_STORAGE_KEY,
      JSON.stringify({
        projectId: selectedProjectId,
        sessionId: selectedSessionId,
        filePath: selectedFilePath,
        content: selectedFileContent,
      }),
    );
    return;
  }

  sessionStorage.removeItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
}, [
  selectedFileContent,
  savedFileContent,
  selectedFilePath,
  selectedProjectId,
  selectedSessionId,
]);
```

Draft is written when buffer diverges from disk content and all context keys are present. Draft is removed otherwise (buffer is clean, context is incomplete, or any dependency changes). Uses actual buffer divergence (`selectedFileContent !== savedFileContent`) rather than only `fileSaveState === 'dirty'`, so drafts are not dropped during `saving` or `save-error` while still preserving explicit-save-only behavior.

#### 5. `loadWorkspaceFileContent(...)` updated (after staleness guard, before state setters)

Cold-mount draft is consumed (ref cleared) exactly once regardless of whether it matched. Restore only happens on exact match of all three context values.

```ts
const coldMountEditorDraft = PROJECT_FIRST_UX ? coldMountEditorDraftRef.current : null;
coldMountEditorDraftRef.current = null;
const shouldRestoreEditorDraft =
  !!coldMountEditorDraft &&
  coldMountEditorDraft.projectId === selectedProjectId &&
  coldMountEditorDraft.sessionId === sessionId &&
  coldMountEditorDraft.filePath === fileResponse.path;
const restoredFileContent = shouldRestoreEditorDraft
  ? coldMountEditorDraft.content
  : fileResponse.content;

setSelectedFilePath(fileResponse.path);
setSelectedFileContent(restoredFileContent);
setSavedFileContent(fileResponse.content);  // always disk content
setFileSaveState(restoredFileContent === fileResponse.content ? 'clean' : 'dirty');
```

`savedFileContent` always reflects the disk content. `selectedFileContent` is the restored draft when a match is found, otherwise the disk content. `fileSaveState` is correctly `'dirty'` when the draft was restored, `'clean'` otherwise.

#### 6. `handleSaveWorkspaceFile(...)` successful path updated (after `setFileSaveState('saved')`)

```ts
if (PROJECT_FIRST_UX) {
  sessionStorage.removeItem(TAB_EDITOR_DRAFT_STORAGE_KEY);
}
```

Removes the stored draft synchronously after a successful explicit save. The write/remove effect would also remove it on the next render (buffer converges to disk on save), but the explicit `removeItem` here ensures the draft cannot survive between the save completing and the next effect tick.

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
| All non-AI autosave flows (C2b, C2d-expiry-warn, C2e/C2e-hotfix, C2f-file-save) | Unchanged |
| All project-open hydration paths | Unchanged |
| `handleWorkspaceEditorContentChange(...)` | Unchanged |
| Named-save flow and label helpers | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c/C2d-expiry-warn/C2e/C2f-file-save/C4/D0/D0b/D0c/D0d/C2e-hotfix paths | Unchanged |

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

The draft restore path is intentionally conservative:

- Draft is stored only in tab-scoped `sessionStorage` — isolated per tab, discarded on tab close, no cross-tab sharing.
- Restored only once per cold mount. The `coldMountEditorDraftRef` is consumed (cleared) on first use regardless of whether it matched.
- Restored only when the same tab returns to the exact same project/session/file context (`projectId`, `sessionId`, and `filePath` must all match exactly). Any mismatch = silent discard.
- Does not write anything to disk, does not change backend state, and does not alter the current explicit save flow.
- `savedFileContent` always reflects the last disk-flushed content. `selectedFileContent` holds the restored draft only in memory.
- The write/remove effect uses actual buffer divergence (`selectedFileContent !== savedFileContent`) rather than only `fileSaveState === 'dirty'`, so drafts are not dropped while a save is in flight (`saving` state) or after a save error (`save-error` state), while still preserving explicit-save-only behavior.
- Tabs that have never typed anything (new tabs, first-ever visit to a file) get the same behavior as before D0e with no draft to restore.

## Preserved Invariants

| Invariant | Status |
|---|---|
| Draft persistence only, not disk persistence — no workspace files written | ✅ |
| Auth/identity/preferences remain in `localStorage`; draft only in `sessionStorage` | ✅ |
| Draft storage tab-scoped only | ✅ |
| All `sessionStorage` access inside effects/handlers (SSR-safe) | ✅ |
| `PROJECT_FIRST_UX` remains the kill-switch posture | ✅ Flag off: no write effect runs, no draft read runs; byte-identical to pre-D0e |
| Explicit save flow intact | ✅ No change to `handleSaveWorkspaceFile(...)` logic beyond draft removal |
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
| No later-phase work | ✅ Tab-scoped draft persistence only |
