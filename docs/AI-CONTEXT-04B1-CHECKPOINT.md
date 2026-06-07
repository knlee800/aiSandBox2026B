# AI-CONTEXT-04B1 Checkpoint — Repo Docs File Picker

**Task ID:** AI-CONTEXT-04B1
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-07

---

## What Was Delivered

A modal file explorer picker inside the Repo Docs panel, allowing users to browse and click existing workspace files to add them as repo-relative doc paths.

Extends AI-CONTEXT-04B (Repo Docs Registry Frontend UI). No backend changes were made.

### Implementation path

The implementation went through several revisions before reaching the final design:

1. Initial: inline collapsible panel with flat path list — rejected (not browseable)
2. Revision 1: modal overlay with flat path list + search — rejected (still not a file explorer)
3. Revision 2: modal overlay with flat path list + improved empty state — rejected (still no folder hierarchy)
4. Final: modal overlay with recursive expandable folder tree (`RepoDocsPickerTreeNode`) — accepted and live-tested

---

## Files Changed

### Modified files

- `frontend/components/workspace/workspace-shell.tsx` — added `RepoDocsPickerTreeNode` recursive component, `repoDocsPickerExpandedFolders` state, `handleTogglePickerFolder` handler, modal overlay replacing inline panel, Heroicons imports, no-session empty state differentiation
- `frontend/components/workspace/workspace-shell.test.tsx` — updated Heroicons import assertion, updated source assertions for tree component, folder/file button test-ids, expanded-folder state
- `frontend/messages/en.json` — added picker i18n keys under `project` namespace
- `frontend/messages/zh-TW.json` — added corresponding Traditional Chinese translations
- `frontend/messages/zh-CN.json` — added corresponding Simplified Chinese translations

---

## UX Design

### Trigger

A "Pick from files" button (`data-testid="history-project-repo-docs-picker-toggle"`) in the Repo Docs panel. Clicking opens the modal.

### Modal overlay

- Backdrop: `fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50`
- Click backdrop to close
- Panel: `max-w-lg max-h-[80vh] flex flex-col rounded-lg bg-white shadow-xl`
- Header: title + X close button (`XMarkIcon`)
- Body: subtitle instruction + recursive file tree

### File tree (`RepoDocsPickerTreeNode`)

Renders each `WorkspaceFileNode` recursively:

**Directory rows** (`data-testid="history-project-repo-docs-picker-folder-button"`):
- `ChevronRightIcon` (collapsed) or `ChevronDownIcon` (expanded)
- `FolderIcon` (collapsed) or `FolderOpenIcon` (expanded)
- Folder name with `/` suffix
- Click toggles folder in `repoDocsPickerExpandedFolders` Set
- All folders start collapsed; user expands what they need

**File rows** (`data-testid="history-project-repo-docs-picker-file-button"`):
- `DocumentTextIcon`
- File name
- Emerald selected state + "Already selected" label if path is in `repoDocsPaths`
- Click calls `handleAddRepoDocFromPicker(node.path)`
- Duplicate click shows feedback message

### Empty state

When `workspaceFileTree` is empty (no active session):
- Shows "Start or open a session to browse workspace files." (`repoDocsPickerNoSession`) in amber
- `data-testid="history-project-repo-docs-picker-no-session"`

### Manual input fallback

Manual repo-relative path input and Add button remain outside the modal and are unaffected.

---

## State Added

```typescript
const [repoDocsPickerExpandedFolders, setRepoDocsPickerExpandedFolders] =
  React.useState<Set<string>>(new Set());
```

Reset on project change alongside other picker state.

---

## Heroicons Used

All from `@heroicons/react/24/outline`:

| Icon | Usage |
|---|---|
| `XMarkIcon` | Modal close button |
| `FolderIcon` | Collapsed directory |
| `FolderOpenIcon` | Expanded directory |
| `DocumentTextIcon` | File row |
| `ChevronRightIcon` | Collapsed directory chevron |
| `ChevronDownIcon` | Expanded directory chevron |

---

## i18n Keys Added

All under `project` namespace in `en.json`, `zh-TW.json`, `zh-CN.json`:

| Key | Usage |
|---|---|
| `repoDocsOpenPicker` | Trigger button (picker closed) |
| `repoDocsClosePicker` | Trigger button (picker open) |
| `repoDocsPickerChooseFile` | Modal title |
| `repoDocsPickerClickToAdd` | Modal subtitle |
| `repoDocsPickerSelected` | Already-selected badge in file row |
| `repoDocsPickerNoFiles` | Empty state when tree has files but filter yields nothing |
| `repoDocsPickerNoSession` | Empty state when `workspaceFileTree` is empty |
| `repoDocsPickerAlreadyAdded` | Feedback message on duplicate file click |
| `repoDocsPickFromFiles` | (present, unused in final render) |
| `repoDocsPickerTitle` | (present, unused in final render) |
| `repoDocsPickerEmpty` | (present, unused in final render) |
| `repoDocsPickerSearchPlaceholder` | (present, unused in final render) |
| `repoDocsPickerAddSelected` | (present, unused in final render) |

---

## Tests

- Heroicons import assertion updated to include all 6 new icons
- Source assertions for `RepoDocsPickerTreeNode` component
- Source assertions for `repoDocsPickerExpandedFolders` state
- Source assertions for `history-project-repo-docs-picker-folder-button`
- Source assertions for `handleTogglePickerFolder`
- Source assertions for `onSelectFile={handleAddRepoDocFromPicker}`
- Source assertions for modal: `history-project-repo-docs-picker-modal`, `fixed inset-0 z-50`, `history-project-repo-docs-picker-close`
- Rendering test: picker toggle button present
- Rendering test: no-session message when `workspaceFileTree` is `[]`
- i18n locale key coverage for all picker keys
- Candidate ordering logic preserved (exported `buildRepoDocPickerCandidates` unchanged)
- Manual input fallback present

---

## Validation Results

- `npx tsc --noEmit` — PASS
- `npm test` — PASS (627/627)
- `ReadLints` — PASS (no linter errors)
- Live browser test — PASS
  - "Pick from files" opens modal popup
  - Folders visible with chevrons
  - Folders expand and collapse on click
  - File clicked with mouse; repo-relative path added to list
  - Saved; reopened and confirmed persistence
  - Duplicate handling confirmed (feedback shown)

---

## Non-goals Confirmed

- No backend changes
- No ai-service changes
- No prompt assembly changes
- No repo docs content reading
- No repo map
- No validation contract
- No broad file-tree redesign

---

## Invariants Preserved

- Existing Repo Docs GET/PUT save/remove/clear behavior unchanged
- Project AI Instructions UI unchanged
- Global AI Instructions UI unchanged
- Active Context Indicator unchanged
- Internal service auth guards and session cookie behavior unchanged
- `buildRepoDocPickerCandidates`, `REPO_DOC_PICKER_MAX_CANDIDATES`, and related helpers remain exported and tested
