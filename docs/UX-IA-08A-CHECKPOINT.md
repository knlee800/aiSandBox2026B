# UX-IA-08A Checkpoint — Project Mode Layout Shell + Back Header

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-08A |
| Title | Project Mode Layout Shell + Back Header |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Parent | UX-IA-08 — Project Mode Shell |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-12 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-08 plan phase COMPLETE; UX-IA-07 (COMPLETE and LOCKED — `docs/UX-IA-07-CHECKPOINT.md`) |

---

## Objective

Restructure `projectWorkspaceContent` in `workspace-shell.tsx` from the existing 3-column grid into a project-mode layout: top header bar (project name + back button), left AI panel zone, right content zone. Chat, exec, build, and history/dashboard content move into the left AI panel zone. Editor and preview content move into the right content zone (stacked; no tabs yet — tabs are UX-IA-08B). Back button calls `onWorkspaceViewChange('projects')`. No new props added to `WorkspaceShellProps`. No `page.tsx` changes.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Add message imports for locale-aware back label; add `getProjectModeBackLabel` helper; compute `activeProject` / `activeProjectName` / `backLabel` inside component; extract `projectTrustNote`, `projectChatSection`, `projectEditorSection`, `projectPreviewSection` as local JSX variables; replace project view wrapper with new header + two-panel body; recompose `projectWorkspaceContent` from same extracted blocks to preserve non-project-first path |
| `frontend/components/workspace/workspace-shell.test.tsx` | Add 5 new focused tests for project mode header, back button, back button wiring, AI panel zone, and content panel zone |

**Not changed:** `frontend/app/[locale]/app/page.tsx`, `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json` (existing `common.back` key reused in all three locales — no new keys required), all backend files, all auth files.

---

## Implementation Summary

### Layout Structure (project-first path, `workspaceView === 'project'`)

```
<div data-testid="workspace-project-view" class="flex flex-1 min-h-0 flex-col">
  <header data-testid="workspace-project-mode-header">
    <button data-testid="workspace-project-back-button">← Back</button>
    <h2>{activeProjectName}</h2>
  </header>
  {projectTrustNote}
  <div class="flex flex-1 min-h-0">
    <aside data-testid="workspace-project-ai-panel" class="md:w-96 …">
      {projectChatSection}       ← chat / exec / build / shell-state
      {historyAndDashboardContent}
    </aside>
    <main data-testid="workspace-project-content-panel" class="flex-1 …">
      {projectEditorSection}
      {projectPreviewSection}
    </main>
  </div>
</div>
```

### Back Button

- `data-testid="workspace-project-back-button"`
- `onClick={() => props.onWorkspaceViewChange?.('projects')`
- Label: locale-aware `common.back` key via `getProjectModeBackLabel(locale)` (returns `"Back"` / `"返回"` / `"返回"`)
- No new i18n keys; `common.back` was already present in `en.json`, `zh-TW.json`, `zh-CN.json`

### Project Name

Derived inline: `workspaceProjects.find(p => p.id === props.selectedProjectId)?.name ?? ''`. No new prop.

### Extraction Pattern

`projectTrustNote`, `projectChatSection`, `projectEditorSection`, `projectPreviewSection` are local JSX `const` variables defined before both `projectWorkspaceContent` and the project-first return branch. The existing `projectWorkspaceContent` JSX variable (used by the non-project-first path) is recomposed from these extracted blocks — identical output, no behavioral change to the session-scoped/non-project-first layout.

### Preserved Invariants

- `WorkspaceChatPanel`, `WorkspaceExecPanel`, `WorkspaceBuildPanel` — all props unchanged
- `WorkspaceEditorPanel`, `WorkspacePreviewPanel` — all props unchanged
- `historyAndDashboardContent` — unchanged; now in left AI panel zone
- `workspace-project-view` testid wrapper preserved
- All sub-component testids (`chat-panel-shell`, `editor-panel-shell`, `preview-panel-shell`, `history-control-slice`, `dashboard-slice`) still render inside project view
- Home / Projects / Templates view branches untouched
- Non-project-first (session-scoped) path behavior unchanged
- Sidebar (`WorkspaceSidebar`) unchanged
- `WorkspaceAdvancedDrawer` unchanged
- Preview iframe — no wrapping or blocking introduced
- AI/file action flows unchanged
- PROJ-02-01 hydration chain unchanged
- All UX-IA-01 through UX-IA-07 invariants preserved

---

## Test Summary

5 new tests added to `frontend/components/workspace/workspace-shell.test.tsx`:

| Test | Coverage |
|---|---|
| `renders project mode header in project view` | `workspace-project-mode-header` present; project name (`Invoice Dashboard`) visible when `selectedProjectId` matches |
| `renders back button in project mode header` | `workspace-project-back-button` present; label contains `"Back"` |
| `clicking back button calls onWorkspaceViewChange with projects` | `onClick` on `workspace-project-back-button` calls handler with `'projects'` |
| `renders AI panel zone in project view` | `workspace-project-ai-panel` present |
| `renders content panel zone in project view` | `workspace-project-content-panel` present |

Pre-existing test `renders existing workspace content when project view is selected` continues to pass — `workspace-project-view`, `Chat Panel`, `Editor Panel`, `Preview Panel`, `History & Controls` all still render.

---

## Acceptance Checks

| Check | Result |
|---|---|
| Project header renders with back button when `workspaceView === 'project'` | PASS |
| Back button calls `onWorkspaceViewChange('projects')` | PASS |
| Left AI panel zone contains chat, exec, build, history content | PASS |
| Right content panel contains editor and preview panels | PASS |
| All existing sub-component testids still render inside project view | PASS |
| All user-facing strings use i18n keys | PASS — `common.back` used; no hardcoded strings |
| `workspace-project-view` testid preserved | PASS |
| `npx tsc --noEmit` | PASS |
| `npm test` (299 tests) | PASS — 299/299 |
| `npm run build` | PASS — Next.js production build successful |
| `ReadLints` on touched files | PASS — 0 linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed |
| No regressions to UX-IA-04 through UX-IA-07, AUTH-APP-01/02, PROJ-02 | PASS — 299/299 |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 299 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — 0 errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No tab bar
- No tab registry
- No AI panel collapse/expand
- No tab orientation toggle or localStorage preferences
- No new props on `WorkspaceShellProps`
- No `page.tsx` changes
- No backend, API, or auth changes
- No account menu changes
- No new i18n keys or message file changes
- No broad refactor outside the project-mode view branch
- All prior checkpoint invariants (UX-IA-01 through UX-IA-07, AUTH-APP-01, AUTH-APP-02, PROJ-02-01/02/03) preserved

---

## Carry-Forwards to UX-IA-08B

| Item | Target task |
|---|---|
| Tab registry (`TabDefinition` interface + `TAB_REGISTRY` array) | UX-IA-08B |
| `WorkspaceTabBar` presentational component | UX-IA-08B |
| Replace stacked editor+preview with tab bar + active tab content | UX-IA-08B |
| Preview tab wired to `WorkspacePreviewPanel` | UX-IA-08B |
| Code & Files tab wired to `WorkspaceEditorPanel` | UX-IA-08B |
| Placeholder tabs for remaining tab registry entries | UX-IA-08B |
| AI panel collapse/expand toggle | UX-IA-08B |
| `aiPanelCollapsed` localStorage preference (SSR-guarded) | UX-IA-08B |
| Tab orientation preference (horizontal/vertical) | UX-IA-08B |
| `tabOrientation` localStorage preference (SSR-guarded) | UX-IA-08B |

---

## Next Recommended Task

**UX-IA-08B — Tab Registry + Tab Bar + AI Panel Collapse**

Depends on UX-IA-08A (now COMPLETE and LOCKED). In the right content zone from UX-IA-08A, replace the stacked editor+preview with a tab bar at the top plus active-tab content area. Create `workspace-tab-registry.ts` and `workspace-tab-bar.tsx`. Wire Preview tab and Code & Files tab to existing panels. Add AI panel collapse/expand with localStorage persistence. Risk: Medium. Model: Opus 4.6.

Reference: `TASKS.md` → UX-IA-08B. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-08 section.
