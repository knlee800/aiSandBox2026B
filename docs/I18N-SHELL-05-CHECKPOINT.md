# I18N-SHELL-05 Checkpoint — recoveryCopy.ts Locale Migration

**Status:** COMPLETE and LOCKED
**Task ID:** I18N-SHELL-05
**Family:** I18N
**Completed:** 2026-05-24
**Checkpoint doc:** `docs/I18N-SHELL-05-CHECKPOINT.md`
**Depends on:** I18N-SHELL-04 (COMPLETE and LOCKED)

---

## Objective

Convert `frontend/lib/recovery-copy.ts` from an English-only plain constant into a locale-backed recovery copy provider, following the established manual locale-switch pattern. Add the recovery copy keys to all three locale files and update `workspace-shell.tsx` render paths to use locale-selected recovery copy. This extends the I18N family pattern established by I18N-SHELL-01 through I18N-SHELL-04 to cover the remaining critical workspace recovery UX copy.

`recoveryCopy` was consumed 47 times in `workspace-shell.tsx` and drove loading/error states, recovery prompts, history labels, snapshot restore confirmation dialogs, named snapshot save prompts, and auto-version labels — all previously English-only.

---

## Exact Files Changed

### Production source files

- `frontend/lib/recovery-copy.ts` — converted from English-only plain-object constant to a locale-backed provider; imports all 3 locale JSON files; exports `getRecoveryCopy(locale: string)` using the manual locale-switch pattern; retains compatibility `export const recoveryCopy = enMessages.recovery` for non-locale consumers
- `frontend/components/workspace/workspace-shell.tsx` — imports `getRecoveryCopy`; adds `React.useMemo(() => getRecoveryCopy(locale), [locale])` to derive locale-backed recovery messages; routes targeted `recoveryCopy.*` render paths through locale-backed recovery messages; `window.confirm` and `window.prompt` native dialog call sites now use locale-backed copy
- `frontend/messages/en.json` — `recovery` namespace added with all keys under `recovery.actions.*`, `recovery.status.*`, `recovery.detail.*`, `recovery.workspace.*`, and `recovery.workspace.automaticVersionLabels.*`; English values match previous `recoveryCopy` constant values
- `frontend/messages/zh-TW.json` — same `recovery` namespace added with Traditional Chinese values
- `frontend/messages/zh-CN.json` — same `recovery` namespace added with Simplified Chinese values

### Test files

- `frontend/components/workspace/workspace-shell.test.tsx` — new `describe` block added for I18N-SHELL-05 with source-assertion tests (see Tests section below)

---

## Recovery Namespace Structure and Keys

All three locale files received the following `recovery` namespace structure:

### `recovery.actions` namespace

| Key | en |
|---|---|
| `recovery.actions.revertToSnapshot` | "Revert to Snapshot" |
| `recovery.actions.viewSnapshot` | "View Snapshot" |
| `recovery.actions.saveSnapshot` | "Save Snapshot" |
| `recovery.actions.restoreToThisVersion` | "Restore to This Version" |
| `recovery.actions.deleteSnapshot` | "Delete Snapshot" |

### `recovery.status` namespace

| Key | en |
|---|---|
| `recovery.status.loading` | "Loading recovery history..." |
| `recovery.status.error` | "Failed to load recovery history" |
| `recovery.status.empty` | "No recovery history found" |
| `recovery.status.saving` | "Saving snapshot..." |
| `recovery.status.restoring` | "Restoring snapshot..." |
| `recovery.status.deleting` | "Deleting snapshot..." |

### `recovery.detail` namespace

| Key | en |
|---|---|
| `recovery.detail.snapshotLabel` | "Snapshot" |
| `recovery.detail.autoSaveLabel` | "Auto-save" |
| `recovery.detail.recoveryPointLabel` | "Recovery Point" |
| `recovery.detail.currentVersionLabel` | "Current Version" |

### `recovery.workspace` namespace

| Key | en |
|---|---|
| `recovery.workspace.restoreSnapshotConfirm` | (restore confirmation dialog string) |
| `recovery.workspace.saveNamedSnapshotPrompt` | (named snapshot save prompt string) |

### `recovery.workspace.automaticVersionLabels` namespace

Automatic version label keys corresponding to previous `recoveryCopy.workspace.automaticVersionLabels.*` entries (exact keys match prior constant structure).

zh-TW and zh-CN values are fully localized counterparts of the English strings.

---

## recovery-copy.ts Provider Summary

`frontend/lib/recovery-copy.ts` now follows the same manual locale-switch pattern as `getWorkspaceMessages`, `getPreviewMessages`, and `getCommonMessages`:

```ts
export function getRecoveryCopy(locale: string): typeof enMessages.recovery {
  switch (locale) {
    case 'zh-TW': return zhTwMessages.recovery;
    case 'zh-CN': return zhCnMessages.recovery;
    default: return enMessages.recovery;
  }
}

// Compatibility export for non-locale consumers
export const recoveryCopy = enMessages.recovery;
```

---

## workspace-shell.tsx Wiring Summary

`workspace-shell.tsx` was updated to:

1. Import `getRecoveryCopy` from `frontend/lib/recovery-copy.ts` (replacing direct `recoveryCopy` import as primary render path).
2. Derive locale-backed recovery messages via `React.useMemo`:
   ```ts
   const recovery = React.useMemo(() => getRecoveryCopy(locale), [locale]);
   ```
3. Route all targeted `recoveryCopy.*` render references through `recovery.*` (the locale-backed value).
4. Route native dialog call sites through locale-backed copy:
   - `window.confirm(recovery.workspace.restoreSnapshotConfirm)`
   - `window.prompt(recovery.workspace.saveNamedSnapshotPrompt, ...)`

Layout, classNames, behavior, and all `data-testid` values were fully preserved.

---

## Tests Added / Updated

**File:** `frontend/components/workspace/workspace-shell.test.tsx`

### New `describe` block: I18N-SHELL-05 source assertions

Tests added:

1. **`recovery keys exist in all 3 locale files`** — reads all 3 locale JSON files and asserts each required `recovery.*` key is a non-empty string across en, zh-TW, and zh-CN.

2. **`recovery-copy.ts imports all 3 locale files`** — reads `recovery-copy.ts` source and asserts `match` for imports of `en.json`, `zh-TW.json`, and `zh-CN.json`.

3. **`getRecoveryCopy(locale) exists and returns locale-specific recovery copy`** — reads `recovery-copy.ts` source and asserts `match` for `getRecoveryCopy` export and locale-switch branch presence.

4. **`workspace-shell.tsx imports getRecoveryCopy, not direct English recoveryCopy as the primary path`** — reads `workspace-shell.tsx` source and asserts `match` for `getRecoveryCopy` import and `doesNotMatch` for direct primary-path `recoveryCopy` render usage.

5. **`locale-backed recovery wiring is present in workspace-shell.tsx`** — reads `workspace-shell.tsx` source and asserts `match` for `useMemo` + `getRecoveryCopy(locale)` wiring pattern and targeted `recovery.*` render references.

6. **`window.confirm and window.prompt use locale-backed recovery messages`** — reads `workspace-shell.tsx` source and asserts `match` for locale-backed strings in both native dialog call sites.

---

## Validation Results

All validation run from `C:\Users\knlee\aiSandBox2026B\frontend`.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 465 tests, 0 failed |
| ReadLints on touched files | PASS — no linter errors |
| `npm run build` | ENVIRONMENTAL FAILURE — Google Fonts TLS/cert issue (see below) |
| `frontend/tsconfig.tsbuildinfo` | Restored via `git restore` |

### Known build environment caveat

`npm run build` fails with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` when `next/font` attempts to fetch `Inter` from Google Fonts. This is a recurring TLS/certificate environment limitation, identical to the caveat recorded in I18N-SHELL-01, I18N-PAGE-01, I18N-SHELL-02, I18N-SHELL-03, and I18N-SHELL-04 checkpoints. It is not caused by any code change in this task. The build artifact `frontend/tsconfig.tsbuildinfo` was restored after the attempt.

---

## Non-Goals Confirmed

The following were explicitly out of scope and were not touched:

- Status panel `StateMessage` heading/body/action strings beyond those already supplied by `recoveryCopy` — not modified
- `frontend/app/[locale]/app/page.tsx` action feedback/error strings — not modified
- Stop/build/exec button labels — not modified
- Auth-module strings — not modified
- Checkpoint description translation — not modified
- Backend services — not modified
- Route changes — not implemented
- UI redesign or layout changes — not introduced
- New npm dependencies — not added
- TASK-73C-1 work — not performed

---

## Invariants Preserved

- `getRecoveryCopy` follows the same locale-switch pattern as all prior I18N family helpers (`getWorkspaceMessages`, `getPreviewMessages`, `getCommonMessages`, `getProjectPanelMessages`)
- Compatibility `export const recoveryCopy = enMessages.recovery` preserved for any non-locale consumers
- All `data-testid` values in `workspace-shell.tsx` preserved
- All classNames and layout structure preserved
- Existing tests from I18N-SHELL-01 through I18N-SHELL-04 continue to pass (465 total, 0 failed)
- No locked tasks modified
- No production source files were modified during this consolidation step

---

## Next Recommended Task

The I18N family is now substantially complete for the core workspace shell. Any remaining hardcoded English UX copy (status panel labels outside `recoveryCopy` scope, other minor panel strings) should be identified via a read-only audit, registered as a new bounded task, and scoped before implementation begins.
