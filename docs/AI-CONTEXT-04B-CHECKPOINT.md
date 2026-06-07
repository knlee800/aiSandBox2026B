# AI-CONTEXT-04B Checkpoint — Repo Docs Registry Frontend UI

**Task ID:** AI-CONTEXT-04B
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-07

---

## What Was Delivered

Frontend-only UI for selecting, viewing, saving, and clearing project-scoped repo doc paths. Users can manage which repo-relative documentation files the agent should read in future prompt-context slices.

No backend changes, no prompt injection, and no file-content reading were included in this slice.

AI-CONTEXT-04B1 (Repo Docs File Picker) subsequently extended this UI with a modal file explorer tree picker and is tracked separately.

---

## Files Changed

### Modified files

- `frontend/components/workspace/workspace-shell.tsx` — added Repo Docs panel, controls, API wiring, validation, and path-management logic inside `HistoryProjectPanel`
- `frontend/components/workspace/workspace-shell.test.tsx` — added tests for validation logic, API wiring, rendering, i18n keys, and placement
- `frontend/messages/en.json` — added `project` namespace keys for all Repo Docs visible text
- `frontend/messages/zh-TW.json` — added corresponding Traditional Chinese translations
- `frontend/messages/zh-CN.json` — added corresponding Simplified Chinese translations

---

## UI Surface

Repo Docs panel is placed inside `HistoryProjectPanel`, below Project AI Instructions, rendered at `data-testid="history-project-repo-docs-surface"`.

Controls:
- Registered doc paths list (`history-project-repo-docs-list`) with individual Remove buttons
- Manual repo-relative path input (`history-project-repo-docs-input`) with Add button
- Save button (`history-project-repo-docs-save`)
- Clear All button (`history-project-repo-docs-clear-all`)
- Loading, saving, saved, load-error, and save-error states

---

## API Wiring

### GET /api/projects/:projectId/repo-docs

Called when `selectedProjectId` changes. Populates the doc paths list.

Response shape: `{ docs: [{ path: string; mode: 'always' }] }`

Same-origin session-cookie fetch. No Authorization header added.

### PUT /api/projects/:projectId/repo-docs

Called on Save and Clear All. Sends the full current list using replace-all semantics.

Request body: `{ docs: [{ path: string; mode: 'always' }] }`

Clear All sends `{ docs: [] }`.

---

## Client-side Path Validation

Applied before Add and before Save:

- Reject empty or whitespace-only paths
- Reject paths starting with `/`
- Reject paths containing `\` (backslash)
- Reject paths matching drive-letter prefix (e.g. `C:`)
- Reject paths containing `..` segment
- Reject paths longer than 500 characters

Implemented in exported function `getRepoDocPathValidationError`.

---

## Deduplication

Implemented in exported function `dedupeRepoDocPaths`. Applied before Save. First occurrence wins.

---

## i18n Keys Added

All under `project` namespace in `en.json`, `zh-TW.json`, `zh-CN.json`:

| Key | Usage |
|---|---|
| `repoDocsTitle` | Panel title |
| `repoDocsDescription` | Panel description |
| `repoDocsInputPlaceholder` | Path input placeholder |
| `repoDocsAdd` | Add button |
| `repoDocsRemove` | Remove button per item |
| `repoDocsSave` | Save button |
| `repoDocsClearAll` | Clear All button |
| `repoDocsLoading` | Loading state message |
| `repoDocsSaving` | Saving state message |
| `repoDocsSaved` | Saved confirmation |
| `repoDocsLoadError` | Load failure message |
| `repoDocsSaveError` | Save failure message |
| `repoDocsEmpty` | Empty list placeholder |
| `repoDocsInvalidPath` | Validation error message |
| `repoDocsDuplicatePath` | Duplicate path error message |

---

## Tests

- `normalizeRepoDocPathForApi` — trims whitespace
- `getRepoDocPathValidationError` — rejects invalid paths, accepts valid paths
- `dedupeRepoDocPaths` — deduplicates and preserves first occurrence
- Repo docs API GET/PUT source assertions
- Repo docs panel and control rendering
- Repo docs placement below Project AI Instructions
- Repo docs locale keys presence in en / zh-TW / zh-CN
- Repo docs source-level validation and dedupe assertions

---

## Validation Results

- `npx tsc --noEmit` — PASS
- `npm test` — PASS
- `ReadLints` on all touched files — PASS (no linter errors)
- Live browser test — PASS
  - Added `README.md` — accepted
  - Added `docs/ARCHITECTURE.md` — accepted
  - Saved — persisted on reload
  - Removed one doc — persisted on reload
  - Invalid paths rejected with visible error
  - Saved empty docs array — persisted on reload

---

## Non-goals Confirmed

- No backend changes
- No ai-service changes
- No prompt assembly changes
- No repo doc content reading
- No repo map
- No validation contract
- No automatic doc discovery
- No file tree picker in this slice (added separately in AI-CONTEXT-04B1)
- No unrelated UI changes

---

## Invariants Preserved

- Project AI Instructions UI is unchanged
- Global AI Instructions UI is unchanged
- Active Context Indicator is unchanged
- Internal service auth guards and session cookie behavior are unchanged
- No backend endpoints, DTOs, or migration files were modified
