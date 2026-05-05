# UX-FILETREE-hotfix Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-FILETREE-hotfix |
| Family | UX-FILETREE — Workspace File Tree UX |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND FILE-TREE DISPLAY/FILTER HOTFIX |
| Date | 2026-05-05 |
| Source | User observation — `.git/` contents (hooks, objects, logs, refs, HEAD, index, config) visible in user-facing Files panel after create/delete operations |

---

## Objective

Ensure `.git/` and all files/directories under `.git/` are excluded from the user-facing Files panel consistently across all file-tree load and refresh paths, without changing any on-disk files or internal git/checkpoint behavior.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-file-navigation.logic.ts` | Added `normalizeWorkspaceTreePath()` and `isInternalGitTreeEntry()` helpers; applied filter in `loadWorkspaceFileTree()` before sort and recursion |
| `frontend/components/workspace/workspace-file-navigation.logic.test.ts` | Added focused `.git` filtering regression test; 10 tests total, all pass |

`frontend/app/[locale]/app/page.tsx` — **not changed**. All filtering is in the shared logic module, so every call site benefits automatically.

---

## Implementation Summary

Two private helpers were added to `workspace-file-navigation.logic.ts`:

```typescript
function normalizeWorkspaceTreePath(path: string): string {
  return path.trim().replace(/^\/+/, '');
}

function isInternalGitTreeEntry(entry: Pick<WorkspaceFileEntry, 'name' | 'path'>): boolean {
  const normalizedPath = normalizeWorkspaceTreePath(entry.path);
  return entry.name === '.git' || normalizedPath === '.git' || normalizedPath.startsWith('.git/');
}
```

Inside `loadWorkspaceFileTree()`, the `entries` array is filtered before sorting and before recursing into subdirectories:

```typescript
const sortedEntries = entries.filter((entry) => !isInternalGitTreeEntry(entry)).sort(...)
```

Because `.git` itself is filtered before recursion, the builder never calls `listWorkspaceDirectory` for `.git/hooks`, `.git/objects`, etc. — the entire subtree is dropped at the root level.

The filter applies automatically on:
- initial file-tree load
- create file refresh
- delete file refresh
- manual/session refresh

All paths that rebuild `workspaceFileTree` call `loadWorkspaceFileTree()`, so no additional change is needed in `page.tsx`.

Normal files remain visible: `index.html`, `style.css`, `page2.html`, `hello-ai-test.txt`, nested directories and their children.

---

## Validation

Run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | Passed — no type errors |
| `npx tsx --test components/workspace/workspace-file-navigation.logic.test.ts` | Passed — 10 tests, 0 failures |
| ReadLints on touched files | No lint errors |
| `frontend/tsconfig.tsbuildinfo` | Restored after typecheck |

New focused test asserts:
- `.git` and `.git/index` entries from root listing are excluded from rendered tree
- `.git/` subtree is never fetched (no list call with `path=.git`)
- `components`, `hello-ai-test.txt`, `index.html`, `page2.html`, `style.css` remain visible
- Nested directories (`components/nested`) and their files (`keep-me.ts`) remain visible

---

## Scope Confirmation

| Area | Changed? |
|---|---|
| Git/checkpoint behavior | No |
| File create/write/delete behavior | No |
| AI file-action behavior | No |
| Backend behavior | No |
| Unrelated UI | No |
| Other dotfiles hidden | No — only `.git/` is filtered |
| Files deleted from disk | No |

---

## Invariants Preserved

- Internal `.git/` data is untouched on disk; only display/filtering changed.
- No backend route, container-manager, or API gateway code was modified.
- All prior checkpoint invariants remain intact.
