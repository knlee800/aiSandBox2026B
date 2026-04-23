# PROJ-03-C2c-cta-button CHECKPOINT

## Task Metadata

- Task ID: PROJ-03-C2c-cta-button
- Title: Add Named Save Button With Prompt To Project History Panel Behind Feature Flag
- Nature: FRONTEND / PHASE C NAMED SAVE — VISIBLE BUTTON UI
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PROJ-03-C2c-cta-button-CHECKPOINT.md`
- Source: `docs/PROJ-03-01-IMPLEMENTATION-PLAN.md` Phase C — C2c fourth slice: named-save visible CTA
- Depends on: PROJ-03-C2c-cta-handler-pre (COMPLETE and LOCKED)

## Objective

Behind `PROJECT_FIRST_UX`, render one "Save" button in the `ProjectHistoryPanel` header that triggers `window.prompt` for a snapshot name, then calls the locked `onSaveNamedProjectSnapshot` prop. This is the **first visible user-initiated named-save affordance** in the UI. Narrowly bounded to one button plus `window.prompt` — no modal, no new component, no history-row display change.

## Scope Statement

This is a **visible-button-only slice**. C2c-cta-button adds the Save button UI surface and the prompt-handling derived callback inside `WorkspaceShell`. No page handler, no named-save helper, and no history-row display was changed. The only modified source files were:

- `frontend/lib/recovery-copy.ts`
- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

`frontend/app/[locale]/app/page.tsx` and `frontend/lib/project-named-save.ts` are confirmed **unchanged** in this slice.

## Files Changed

| File | Change |
|---|---|
| `frontend/lib/recovery-copy.ts` | Additive only. Two new copy entries. |
| `frontend/components/workspace/workspace-shell.tsx` | Additive only. New derived callback, new optional prop on `ProjectHistoryPanel`, Save button rendered in header. |
| `frontend/components/workspace/workspace-shell.test.tsx` | Additive only. New `withPatchedWindowPrompt` helper and six focused tests. |

## Implementation Details

### `frontend/lib/recovery-copy.ts` — additive changes

**New copy entry `recoveryCopy.actions.saveNamedSnapshot`:**

```ts
saveNamedSnapshot: 'Save',
```

Added to the `actions` block (adjacent to `startNewProject`).

**New copy entry `recoveryCopy.workspace.saveNamedSnapshotPrompt`:**

```ts
saveNamedSnapshotPrompt: 'Name this saved version:',
```

Added to the `workspace` block (adjacent to `restoreSnapshotConfirm`).

### `frontend/components/workspace/workspace-shell.tsx` — additive changes

**New derived callback `handleSaveProjectHistorySnapshot` (inside `WorkspaceShell`, after the locked `handleRestoreProjectHistoryRow`):**

```ts
const handleSaveProjectHistorySnapshot =
  projectFirstUxEnabled &&
  props.selectedProjectId &&
  props.onSaveNamedProjectSnapshot
    ? (() => {
        const onSaveNamedProjectSnapshot = props.onSaveNamedProjectSnapshot;
        return () => {
          if (typeof window === 'undefined') {
            return;
          }
          const rawName = window.prompt(
            recoveryCopy.workspace.saveNamedSnapshotPrompt,
          );
          if (rawName === null) {
            return;
          }
          const trimmedName = rawName.trim();
          if (!trimmedName) {
            return;
          }
          void onSaveNamedProjectSnapshot(trimmedName);
        };
      })()
    : undefined;
```

**Gate conditions (all three must be truthy):**

1. `projectFirstUxEnabled` — `PROJECT_FIRST_UX` build constant; kill switch
2. `props.selectedProjectId` — no project selected → `undefined`
3. `props.onSaveNamedProjectSnapshot` — handler not provided → `undefined`

**Prompt / trim / cancel handling (strict order):**

1. SSR-safe guard: `typeof window === 'undefined'` → return
2. `window.prompt(recoveryCopy.workspace.saveNamedSnapshotPrompt)` — shows native dialog
3. Result `null` (user cancelled) → return, handler not called
4. `.trim()` the result string
5. Empty/whitespace-only trimmed result → return, handler not called
6. Otherwise: `void onSaveNamedProjectSnapshot(trimmedName)`

**Extended `ProjectHistoryPanel` props (one new optional prop):**

```ts
onSave?: () => void;
```

**Save button rendered in `ProjectHistoryPanel` header area:**

```tsx
<div className="flex items-center justify-between gap-2">
  <p className="text-xs font-semibold text-gray-700">Project History</p>
  {props.onSave ? (
    <button
      type="button"
      className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
      onClick={() => props.onSave?.()}
      data-testid="history-project-history-save"
    >
      {recoveryCopy.actions.saveNamedSnapshot}
    </button>
  ) : null}
</div>
```

- Button is conditional on `props.onSave`; renders only when the prop is present
- Label sourced from `recoveryCopy.actions.saveNamedSnapshot` (`'Save'`)
- Deterministic test id: `history-project-history-save`
- Existing `{props.rows.length === 0 ? ... }` empty-state and per-row render blocks are **unchanged**

**Mount site passes derived callback:**

```tsx
onSave={handleSaveProjectHistorySnapshot}
```

Passed into `<ProjectHistoryPanel>` at the existing mount site alongside `onRestore`.

### `frontend/components/workspace/workspace-shell.test.tsx` — additive changes

**New test helper `withPatchedWindowPrompt`:**

```ts
function withPatchedWindowPrompt<T>(
  promptImpl: (message?: string, defaultValue?: string) => string | null,
  run: () => T,
): T {
  const globalObject = globalThis as typeof globalThis & { window?: unknown };
  const originalWindow = globalObject.window;
  (globalObject as { window?: unknown }).window = { prompt: promptImpl };

  try {
    return run();
  } finally {
    if (originalWindow === undefined) {
      delete (globalObject as { window?: unknown }).window;
    } else {
      (globalObject as { window?: unknown }).window = originalWindow;
    }
  }
}
```

**Six new focused tests (all pass):**

1. `does not render project history save button when feature flag is off` — flag off → `history-project-history-save` absent
2. `renders project history save button behind feature flag` — flag on + project + handler → `history-project-history-save` present
3. `does not render project history save button without save handler` — flag on + project, handler absent → `history-project-history-save` absent
4. `does not call named save handler when project history save prompt is cancelled` — prompt returns `null` → `saveCalls === 0`; verifies prompt message is `'Name this saved version:'`
5. `does not call named save handler when project history save prompt is blank` — prompt returns `'   '` → `saveCalls === 0`
6. `calls named save handler with trimmed prompt text from project history save button` — prompt returns `'  Working draft  '` → `saveCalls === 1`, `savedName === 'Working draft'`

## Unchanged Code

| Area | Status |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Unchanged (C2c-cta-handler-pre work already present) |
| `frontend/lib/project-named-save.ts` | Unchanged |
| `frontend/lib/project-autosave.ts` | Unchanged |
| `frontend/lib/autosave-rate-limit.ts` | Unchanged |
| `frontend/lib/open-project-in-fresh-session.ts` | Unchanged |
| `frontend/components/workspace/workspace-snapshots.logic.ts` | Unchanged |
| History row rendering, timestamps, empty-state, Restore buttons | Unchanged |
| All locked Phase A/B/C1/C2a/C2b/C2c-label-format/C2c-handler/C2c-cta-handler-pre paths | Unchanged |

## Prompt / Trim / Cancel Note

- `window.prompt(...) === null` is treated as cancel / do-nothing; handler is not called
- Prompt result is `.trim()`-ed before handoff
- Empty or whitespace-only trimmed input is treated as cancel / do-nothing; handler not called
- Only non-empty trimmed name is passed to `onSaveNamedProjectSnapshot(trimmedName)`
- **No visible failure UI** was introduced in this slice

## Validation

### 1. TypeScript typecheck

```
frontend $ npx tsc --noEmit -p tsconfig.json
```

Result: **PASS** — exit code 0, no type errors.

### 2. Focused component suite

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx
```

Result: **PASS** — 97/97 tests, 0 failures.

### 3. Full focused regression suite

```
frontend $ npx tsx --test components/workspace/workspace-shell.test.tsx lib/project-named-save.test.ts lib/project-autosave.test.ts lib/autosave-rate-limit.test.ts lib/open-project-in-fresh-session.test.ts components/workspace/workspace-projects.logic.test.ts components/workspace/workspace-snapshots.logic.test.ts
```

Result: **PASS** — 143/143 tests, 0 failures. No regressions.

### 4. Lint

Targeted `npm run lint` attempt encountered the known pre-existing `next lint` script-path issue (`Couldn't find any pages or app directory`). Not introduced by this task. `ReadLints` on all three changed source files: **no linter errors found**.

### 5. Cleanup

`frontend/tsconfig.tsbuildinfo` regenerated by the typecheck run and restored via `git restore -- frontend/tsconfig.tsbuildinfo`.

## Preserved Invariants

| Invariant | Status |
|---|---|
| First visible named-save UI; narrowly bounded to one Save button + `window.prompt` | ✅ No modal, no new component, no dialog |
| `window.prompt` is SSR-guarded (`typeof window === 'undefined'` check) | ✅ Present as first guard in derived callback |
| Empty/blank input treated as cancel / do-nothing; handler not called | ✅ Trim + empty check before handoff |
| No visible failure UI introduced in this slice | ✅ |
| `PROJECT_FIRST_UX` remains the kill switch | ✅ Gate condition 1 |
| No `page.tsx` change | ✅ `handleSaveNamedProjectSnapshot` from C2c-cta-handler-pre already present; not modified |
| No `project-named-save.ts` change | ✅ |
| No history row display change (reserved for C2c-display) | ✅ Row rendering, timestamps, and Restore buttons unchanged |
| No new effect, ref, or layout restructuring | ✅ |
| No regression to project-open hydration / restore discipline (PROJ-02-01) | ✅ Not touched |
| No regression to snapshot-store persistence (PROJ-01-21) | ✅ Not touched |
| No regression to `.git/` exclusion from snapshots/restores (PROJ-02-03) | ✅ Not touched |
| No regression to static preview `/workspace/index.html` rule (PREV-02-02) | ✅ Not touched |
| No regression to stop-session cleanup behavior (OPS-01-04) | ✅ Not touched |
| No C2c-display, C2d/C2e/C2f, C3, C4, or later-phase work | ✅ |
