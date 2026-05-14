# UX-IA-09 Checkpoint — Project AI + History Panel

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-09 |
| Title | Project AI + History Panel |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-14 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-08 (COMPLETE and LOCKED — `docs/UX-IA-08-CHECKPOINT.md`) |
| Risk | Medium |
| Loop | 3-step (implement — verify tests — consolidate) |
| Model | Sonnet 4.6 |

---

## Objective

Wire AI chat into the project mode left panel via a chat/history toggle. Add a history view toggle exposing the existing `historyAndDashboardContent` (including `ProjectHistoryPanel`). Add an inline restore confirmation bar in the history view that replaces the previous `window.confirm()` behavior for project-mode restores. Preserve all UX-IA-08 invariants, existing AI-WS file action flows, non-project-mode restore behavior, PROJ-02 hydration, and AUTH/session behavior.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added `getCommonMessages`; added `aiPanelView` and `pendingRestoreSnapshotId` state; added `commonMessages` memo; modified `handleRestoreProjectHistoryRow`; added `handleConfirmRestore` and `handleCancelRestore`; replaced project-mode AI panel left content with toggle + conditional chat/history views + inline restore confirm bar |
| `frontend/components/workspace/workspace-shell.test.tsx` | Updated 1 existing test; added 5 new tests |

**Not changed:** `frontend/messages/*.json`, `frontend/components/workspace/workspace-tab-registry.ts`, `frontend/components/workspace/workspace-tab-bar.tsx`, `frontend/app/[locale]/app/page.tsx`, all backend files, all auth files, `WorkspaceShellProps` interface.

---

## Implementation Summary

### New helper function

Added `getCommonMessages(locale)` after `getProjectPanelMessages`, following the identical pattern:

```typescript
function getCommonMessages(locale: string): typeof enMessages.common {
  if (locale === 'zh-TW') return zhTwMessages.common;
  if (locale === 'zh-CN') return zhCnMessages.common;
  return enMessages.common;
}
```

`commonMessages` is memoized in the component body alongside `projectPanelMessages`.

### New local state

```typescript
const [aiPanelView, setAiPanelView] = React.useState<'chat' | 'history'>('chat');
const [pendingRestoreSnapshotId, setPendingRestoreSnapshotId] = React.useState<string | null>(null);
```

- `aiPanelView` defaults to `'chat'`. No localStorage persistence.
- `pendingRestoreSnapshotId` holds the snapshot awaiting inline confirmation, or `null`.

### Chat / History toggle

A sticky toggle bar (`workspace-ai-panel-toggle`) at the top of the left AI panel (`workspace-project-ai-panel`) with:
- Chat button (`workspace-ai-panel-view-chat`) — label `projectPanelMessages.chat`
- History button (`workspace-ai-panel-view-history`) — label `projectPanelMessages.history`

Active tab uses `border-b-2 border-gray-900 text-gray-900` styling. Switching to Chat clears `pendingRestoreSnapshotId`.

Both tab content zones are rendered into the DOM simultaneously using `className={aiPanelView === 'chat' ? '' : 'hidden'}` / `className={aiPanelView === 'history' ? '' : 'hidden'}`, preserving testid presence in static renders.

### AI chat panel wiring

`projectChatSection` renders inside `workspace-ai-panel-chat-content`, unchanged in structure and props. All `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel`, and `ShellStateMessage` props are passed through identically. All AI-WS file action flows (`onConfirmExecutionFileActions`, `onCancelExecutionFileActions`) remain unaffected.

### History view and inline restore confirmation

`historyAndDashboardContent` (containing `HistoryProjectPanel` and `ProjectHistoryPanel`) renders inside `workspace-ai-panel-history-content`.

When `pendingRestoreSnapshotId` is set, an inline confirm bar appears at the top of the history view:
- Container: `workspace-restore-confirm-bar` (`section`, amber border/bg)
- Message: `projectPanelMessages.restoreConfirm` (i18n — already existed in all 3 locales)
- Confirm button: `workspace-restore-confirm-button` — label `projectPanelMessages.restore`
- Cancel button: `workspace-restore-cancel-button` — label `commonMessages.cancel`

### Modified restore handler

`handleRestoreProjectHistoryRow` is context-aware:
- In `project` view: sets `pendingRestoreSnapshotId(snapshotId)` only — no `window.confirm`, no immediate restore call.
- In non-project views (home, projects, templates): preserves the existing `window.confirm(recoveryCopy.workspace.restoreSnapshotConfirm)` flow exactly as before.

`handleConfirmRestore()`: clears pending ID, then calls `onRestoreWorkspaceProjectFromSnapshotById(projectId, snapshotId)`.

`handleCancelRestore()`: clears pending ID only.

### i18n

Zero new keys added. All keys used (`project.chat`, `project.history`, `project.restore`, `project.restoreConfirm`, `common.cancel`) already existed in all three locales (`en.json`, `zh-TW.json`, `zh-CN.json`) prior to this slice.

### No props changes

`WorkspaceShellProps` interface is unchanged. All new state is local to `WorkspaceShell`. No prop threading through `page.tsx`.

---

## Test Summary

| Change | Description |
|---|---|
| Updated 1 existing test | `'renders existing workspace content when project view is selected'` — removed `History & Controls` assertion (no longer in default chat view DOM); added assertions for `workspace-ai-panel-toggle`, `workspace-ai-panel-view-chat`, `workspace-ai-panel-view-history` |
| New test | `'renders chat and history toggle buttons in project mode'` — verifies toggle, both button testids, and "Chat"/"History" labels render |
| New test | `'renders chat panel by default in project mode'` — verifies `chat-panel-shell` and `workspace-ai-panel-view-chat` present |
| New test | `'does not render restore confirm bar without pending restore'` — verifies `workspace-restore-confirm-bar` absent in default state |
| New test | `'project history panel still renders in non-project views'` — verifies `historyAndDashboardContent` unaffected outside project mode (uses `workspaceView: 'projects'`) |
| New test | `'restore-related buttons and handlers remain wired where statically testable'` — verifies restore button `onClick` fires handler correctly in non-project view where `window.confirm` path is active |

Pre-existing restore confirm tests (`'confirms before restoring...'`, `'does not call restore handler when confirmation is declined'`) updated to use `workspaceView: 'projects'` to target the non-project `window.confirm` path; logic and assertions unchanged.

All tests use the existing `renderToStaticMarkup` / `renderWorkspaceShellElementByTestId` harness. No `fireEvent` rewrites.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npm test` | `frontend/` | PASS — 313 tests, 313 passed, 0 failed |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `npx tsc --noEmit` | `frontend/` | PASS |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

Prior baseline before UX-IA-09: 308 tests. Net new from UX-IA-09: 5 new tests = 313 total.

---

## Non-Goals Confirmed

- No backend or API changes
- No auth changes
- No route cleanup
- No Visual Edit Mode work (deferred to UX-IA-15+)
- No new tab registry work beyond UX-IA-08
- No full Preview + Code layout refinement (deferred to UX-IA-10)
- No broad refactor of AI-WS, preview, or file logic
- No new AI capabilities or history backend features
- No `page.tsx` changes
- No new props on `WorkspaceShellProps`
- No new i18n keys

---

## Preserved Invariants

- `WorkspaceShellProps` interface — no new props
- `page.tsx` — not changed
- `WorkspaceSidebar` — unchanged
- `WorkspaceAdvancedDrawer` — unchanged
- `WorkspaceChatPanel` — all props unchanged; all AI-WS chat, file action, file confirmation, and execution polling flows unaffected
- `WorkspaceExecPanel`, `WorkspaceBuildPanel`, `ShellStateMessage` — all props unchanged
- `WorkspaceEditorPanel`, `WorkspacePreviewPanel` — all props unchanged; wired behind Code & Files and Preview tabs respectively (UX-IA-08B invariant)
- `historyAndDashboardContent` — unchanged in structure; rendered in project mode history view and in all non-project views exactly as before
- `handleRestoreProjectHistoryRow` non-project path — `window.confirm(...)` behavior preserved verbatim
- UX-IA-08 testids (`workspace-project-view`, `workspace-project-mode-header`, `workspace-project-back-button`, `workspace-project-ai-panel`, `workspace-project-content-panel`) — all preserved
- UX-IA-08B testids (`workspace-tab-bar`, `workspace-ai-panel-collapse-toggle`, `workspace-tab-content`) — all preserved
- Sub-component testids (`chat-panel-shell`, `editor-panel-shell`, `preview-panel-shell`, `history-control-slice`, `dashboard-slice`) — all still render
- Preview iframe pointer-event path — unaffected (UX-IA-15 constraint preserved)
- PROJ-02-01 hydration chain — unchanged
- AUTH-APP-01/02 invariants — preserved
- All UX-IA-04 through UX-IA-08 invariants — preserved

---

## Carry-Forwards

| Item | Target |
|---|---|
| Full-height panel sizing; panels fill available height | UX-IA-10 |
| File tree as left section of Code & Files tab | UX-IA-10 |
| Preview tab full-height iframe sizing | UX-IA-10 |
| Remaining 11 placeholder tabs with visibility/pinning settings | UX-IA-11 |
| Upgrade Flow + Dashboard Polish | UX-IA-12 |
| Responsive / Mobile Polish | UX-IA-13 |
| Route Cleanup / Redirects | UX-IA-14 |
| Visual Edit Mode Foundation | UX-IA-15 (requires UX-IA-08 + UX-IA-10 COMPLETE) |
| Tab bar visual polish (icons, design tokens, styled empty states) | future polish pass |

---

## Next Recommended Task

**UX-IA-10 — Preview + Code & Files Tabs**

Wire Preview and Code & Files tabs to full-height content panels. Add file tree as left section of Code & Files tab. Ensure panels fill available height in right content zone. Risk: Medium. Model: Sonnet 4.6.

Reference: `TASKS.md` → UX-IA-10. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-10 section.
