# UX-IA-05 Checkpoint — Projects Grid/List + Recent Projects

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-05 |
| Title | Projects Grid/List + Recent Projects |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-11 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-04 (COMPLETE and LOCKED — `docs/UX-IA-04-CHECKPOINT.md`) |

---

## Objective

Build the Projects view with project cards in grid/list form. Make sidebar recent projects clickable. Reuse existing `workspaceProjects`, `onOpenWorkspaceProject`, `onCreateWorkspaceProject`, `onResumeWorkspaceProjectById` handlers. Introduce a `WorkspaceProjectCard` component. Add grid/list toggle. Implement empty state for no projects. Preserve all UX-IA-04 sidebar, Home chatbox, and project-mode behavior unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-project-card.tsx` | **New** — presentational `WorkspaceProjectCard` component |
| `frontend/components/workspace/workspace-shell.tsx` | Add `projectsViewMode` local state; import and render `WorkspaceProjectCard`; replace `projectsWorkspaceContent` placeholder with card grid surface; add toggle buttons and New Project button; add `handleOpenProjectCard` |
| `frontend/components/workspace/workspace-sidebar.tsx` | Add `gridView` and `listView` to `getWorkspaceScaffoldMessages` return object |
| `frontend/components/workspace/workspace-shell.test.tsx` | Add 6 focused tests for projects view card rendering, empty state, card click wiring, grid/list toggles, and sidebar recent-project click wiring |
| `frontend/messages/en.json` | Add `workspace.gridView: "Grid view"`, `workspace.listView: "List view"` |
| `frontend/messages/zh-TW.json` | Add `workspace.gridView: "格狀顯示"`, `workspace.listView: "列表顯示"` |
| `frontend/messages/zh-CN.json` | Add `workspace.gridView: "网格视图"`, `workspace.listView: "列表视图"` |

**Not changed:** `frontend/app/[locale]/app/page.tsx` — no changes were needed. All required handlers and state were already wired from UX-IA-04.

---

## i18n Summary

Two new keys added under the `workspace` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.gridView` | `"Grid view"` | `"格狀顯示"` | `"网格视图"` |
| `workspace.listView` | `"List view"` | `"列表顯示"` | `"列表视图"` |

`getWorkspaceScaffoldMessages` in `workspace-sidebar.tsx` now exposes `gridView` and `listView` via `read('workspace.gridView')` and `read('workspace.listView')`.

All other new user-facing strings reuse pre-existing `workspace.*` namespace keys (`workspace.projects`, `workspace.newProject`, `workspace.noProjects`). No new i18n namespaces.

---

## Implementation Summary

### `WorkspaceProjectCard` (`workspace-project-card.tsx` — new)

Presentational `'use client'` component. Props:

```typescript
interface WorkspaceProjectCardProps {
  project: WorkspaceProjectSummary;
  viewMode: 'grid' | 'list';
  onOpen: (projectId: string) => void;
  openLabel?: string;
}
```

Renders:
- `data-testid="workspace-project-card-{project.id}"`
- Project name (`text-sm font-semibold`)
- Formatted `updatedAt` date via `toLocaleDateString()`
- Optional visibility badge (emerald for `public`, gray for `private`)
- Click on the whole card calls `onOpen(project.id)`
- Grid vs list visual variant via Tailwind classes (`flex-col` vs `items-center justify-between`)

No business logic, no API calls, no project hydration.

### Projects view (`workspace-shell.tsx`)

New local state:

```typescript
const [projectsViewMode, setProjectsViewMode] = React.useState<'grid' | 'list'>('grid');
```

New `projectsWorkspaceContent` structure within `data-testid="workspace-projects-view"`:

```
workspace-projects-view
  ├── trust note banner (preserved)
  ├── workspace-projects-surface  ← new card surface section
  │     ├── header: "Projects" title
  │     ├── grid/list toggle (workspace-projects-grid-toggle / workspace-projects-list-toggle)
  │     ├── New Project button (workspace-projects-new-project-button)
  │     ├── workspaceProjects.length > 0
  │     │     → grid (workspace-projects-grid): WorkspaceProjectCard × N
  │     │     → list (workspace-projects-list): WorkspaceProjectCard × N
  │     └── workspaceProjects.length === 0
  │           → workspace-projects-empty-state
  └── historyAndDashboardContent (preserved — HistoryProjectPanel, snapshots, dashboard)
```

New `handleOpenProjectCard` delegates through `handleOpenRecentProject`:

```typescript
const handleOpenProjectCard = (projectId: string) => {
  handleOpenRecentProject?.(projectId);
};
```

`handleOpenRecentProject` calls `onResumeWorkspaceProjectById` which in `page.tsx` executes the full PROJ-02-01 hydration chain and calls `setWorkspaceView('project')` on success. No new project-open race surface introduced.

`hasProjectActionInFlight` derived value added to the `WorkspaceShell` component body (was previously only local to `HistoryProjectPanel`; now also used to disable the New Project button in the card surface).

---

## Test Summary

Six focused tests added to `workspace-shell.test.tsx`. New fixture constant `projectsViewProjects` (2 projects: `projects-view-1` and `projects-view-2`).

| Test | What it asserts |
|---|---|
| `renders project cards in projects view when workspaceProjects exist` | `workspace-projects-grid`, `workspace-project-card-projects-view-1`, `workspace-project-card-projects-view-2` present |
| `renders project names in project cards` | `Invoice Dashboard`, `Support Portal` visible in HTML |
| `renders empty state in projects view when no projects exist` | `workspace-projects-empty-state`, `>No projects yet.<` present |
| `clicking project card calls onResumeWorkspaceProjectById with project id` | `resumeCalls === 1`, `resumedProjectId === 'projects-view-2'` |
| `renders grid and list toggle buttons in projects view` | `workspace-projects-grid-toggle`, `workspace-projects-list-toggle`, `>Grid view<`, `>List view<` present |
| `clicking sidebar recent project calls onResumeWorkspaceProjectById with project id` | `resumeCalls === 1`, `resumedProjectId === 'projects-view-1'` |

---

## Acceptance Checks

| Check | Result |
|---|---|
| UX-IA-05 registered in TASKS.md and TASKS_BACKLOG_FULL.md | PASS |
| Projects view shows `WorkspaceProjectCard` grid for selected workspace projects | PASS — `workspace-projects-grid` renders `workspace-project-card-{id}` per project |
| Grid/list toggle works | PASS — `workspace-projects-grid-toggle` and `workspace-projects-list-toggle` rendered and wired |
| Clicking a project card calls existing open/resume handler | PASS — tested; calls `onResumeWorkspaceProjectById` with correct id |
| Sidebar recent projects (up to 5) are clickable and open project mode | PASS — tested; click calls `onResumeWorkspaceProjectById` with correct id |
| Empty state shown when no projects exist | PASS — `workspace-projects-empty-state` renders `workspace.noProjects` text |
| All new user-facing strings use i18n keys | PASS — `gridView`, `listView` added to all 3 locale files; other strings reuse pre-existing keys |
| `npx tsc --noEmit` | PASS |
| `npm test` (280 tests) | PASS — 280/280 |
| `npm run build` | PASS — Next.js production build successful |
| `ReadLints` on all touched files | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed |
| No regressions to UX-IA-04 sidebar, Home view, or project-mode behavior | PASS — 280/280; all prior tests passing |
| No regressions to AUTH-APP-01/02 or PROJ-02 hydration chain | PASS — no changes to auth, hydration, or page.tsx |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 280 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No Templates/Community view implementation (UX-IA-06)
- No account menu (UX-IA-07)
- No project mode shell or tab system (UX-IA-08/10/11)
- No backend or API changes
- No auth changes
- No route cleanup (UX-IA-14)
- No responsive/mobile work (UX-IA-13)
- No broad refactor of AI-WS, preview, or file logic
- No new i18n namespaces
- No changes to `frontend/app/[locale]/app/page.tsx`
- No changes to PROJ-02-01 `hydrateWorkspaceForProjectOpen` or `projectOpenInProgressRef` guard chain
- No changes to AUTH-APP-01/02 session-cookie auth, CSRF guards, or preview security guards
- No changes to UX-IA-01 locale middleware, `TranslationProvider`, `useTranslations` hook, or locale JSON structure

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, UX-IA-04, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain is unchanged; project card click routes through the existing `onResumeWorkspaceProjectById` path.
- `HistoryProjectPanel` and snapshot panel behavior preserved; both remain rendered below the new card surface in the Projects view.
- UX-IA-04 sidebar, Home view, Templates placeholder, project view, and advanced drawer behavior preserved.
- `WorkspaceView` state and `workspaceView` prop interface unchanged.

---

## Carry-Forwards

| Item | Target task |
|---|---|
| Templates / community view | UX-IA-06 — Templates / Community View |
| Account menu, settings, language/theme switcher | UX-IA-07 — Account Menu + Settings + Language/Theme |
| Project mode shell redesign | UX-IA-08 — Project Mode Shell |
| Project AI + history panel | UX-IA-09 — Project AI + History Panel |
| Grid/list toggle persistence (sessionStorage) | Deferred — not required in this slice |
| Responsive / mobile polish for project cards | Deferred to UX-IA-13 |
| Upgrade flow polish | UX-IA-12 |

---

## Next Recommended Task

**UX-IA-06 — Templates / Community View**

Depends on UX-IA-05 (now COMPLETE and LOCKED). Implement the Templates view with public/community project browsing, search/filter, and fork action. The Templates nav item already exists in the sidebar (currently shows a "Coming soon" placeholder).

Reference: `TASKS.md` → UX-IA-06. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-06 section.
