# UX-IA-06 Checkpoint — Templates / Community View

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-06 |
| Title | Templates / Community View |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-11 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-05 (COMPLETE and LOCKED — `docs/UX-IA-05-CHECKPOINT.md`) |

---

## Objective

Build the Templates view with public/community project browsing, search/filter, and fork action. Reuse existing `loadPublicWorkspaceProjects` data and public project state already flowing into `WorkspaceShell`. Add a new `WorkspaceTemplateCard` component (separate from `WorkspaceProjectCard` due to incompatible prop shapes). Add a direct-by-id fork handler in `page.tsx` that also opens project mode on success. Preserve all UX-IA-04 and UX-IA-05 sidebar/home/projects-view scaffolding.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-template-card.tsx` | **New** — presentational `WorkspaceTemplateCard` component for `WorkspacePublicProjectSummary` |
| `frontend/components/workspace/workspace-shell.tsx` | Add `onForkPublicWorkspaceProjectById?` to `WorkspaceShellProps`; add `templateSearch` local state and `filteredTemplateProjects` derived value; replace `templatesWorkspaceContent` placeholder with real templates surface |
| `frontend/components/workspace/workspace-sidebar.tsx` | Add `search`, `fork`, `forking`, `noTemplates` to `getWorkspaceScaffoldMessages` return object |
| `frontend/app/[locale]/app/page.tsx` | Add `handleForkPublicWorkspaceProjectById`; wire `onForkPublicWorkspaceProjectById` prop in `WorkspaceShell` JSX |
| `frontend/components/workspace/workspace-shell.test.tsx` | Add `templatesViewProjects` fixture; add 6 focused tests for templates view |
| `frontend/messages/en.json` | Add `workspace.fork`, `workspace.forking`, `workspace.noTemplates` |
| `frontend/messages/zh-TW.json` | Add `workspace.fork`, `workspace.forking`, `workspace.noTemplates` |
| `frontend/messages/zh-CN.json` | Add `workspace.fork`, `workspace.forking`, `workspace.noTemplates` |

**Not changed:** `frontend/components/workspace/workspace-project-card.tsx` — `WorkspaceProjectSummary` and `WorkspacePublicProjectSummary` have incompatible shapes (`userId`, `workspaceId` absent on public type); a separate card component was created instead.

---

## i18n Summary

Three new keys added under the `workspace` namespace in all three locale files:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `workspace.fork` | `"Fork"` | `"分叉"` | `"分叉"` |
| `workspace.forking` | `"Forking..."` | `"分叉中..."` | `"分叉中..."` |
| `workspace.noTemplates` | `"No templates available."` | `"目前沒有模板。"` | `"暂无模板。"` |

`getWorkspaceScaffoldMessages` in `workspace-sidebar.tsx` now additionally exposes:
- `search` via `read('common.search')` — reuses existing key
- `fork` via `read('workspace.fork')`
- `forking` via `read('workspace.forking')`
- `noTemplates` via `read('workspace.noTemplates')`

No new namespaces. All strings routed through the existing `useTranslations` scaffold pattern.

---

## Implementation Summary

### `WorkspaceTemplateCard` (`workspace-template-card.tsx` — new)

Presentational `'use client'` component. Props:

```typescript
interface WorkspaceTemplateCardProps {
  project: WorkspacePublicProjectSummary;
  onFork: (projectId: string) => void;
  isForking?: boolean;
  forkLabel?: string;
  forkingLabel?: string;
}
```

Renders:
- `data-testid="workspace-template-card-{project.id}"`
- Project name (`text-sm font-semibold`)
- Formatted `updatedAt` date via `toLocaleDateString()`
- Public visibility badge (emerald)
- Fork button: `data-testid="workspace-template-card-fork-{project.id}"`; calls `onFork(project.id)`; disabled when `isForking`

No business logic, no API calls, no project hydration.

### Templates view (`workspace-shell.tsx`)

New local state:

```typescript
const [templateSearch, setTemplateSearch] = React.useState('');
```

Derived filter:

```typescript
const filteredTemplateProjects = (props.publicWorkspaceProjects ?? []).filter((project) =>
  project.name.toLowerCase().includes(normalizedTemplateSearch),
);
```

New `templatesWorkspaceContent` structure within `data-testid="workspace-templates-view"`:

```
workspace-templates-view
  ├── header: scaffoldMessages.templates
  ├── workspace-templates-search  ← search input (local state)
  ├── filteredTemplateProjects.length > 0
  │     → workspace-templates-grid: WorkspaceTemplateCard × N
  └── filteredTemplateProjects.length === 0
        → workspace-templates-empty-state
```

Fork buttons delegate via:

```typescript
onFork={(projectId) => {
  void props.onForkPublicWorkspaceProjectById?.(projectId);
}}
isForking={props.publicProjectActionState === 'forking'}
```

New optional `WorkspaceShellProps` entry:

```typescript
onForkPublicWorkspaceProjectById?: (projectId: string) => Promise<void>;
```

### `handleForkPublicWorkspaceProjectById` (`page.tsx` — new handler)

Added alongside the existing zero-arg `handleForkPublicWorkspaceProject` (which was not changed).

```typescript
async function handleForkPublicWorkspaceProjectById(projectId: string): Promise<void> {
  if (!userId) return;
  // ... normalizes id, sets forking state
  const forked = await forkPublicWorkspaceProject({ projectId: normalizedProjectId });
  await loadWorkspaceProjectsForUser();
  await loadPublicWorkspaceProjectsList();
  setPublicProjectActionState('success');
  await handleResumeWorkspaceProjectById(forked.id); // opens project mode
  // ... catch sets error state
}
```

Routes through the existing `handleResumeWorkspaceProjectById` path, which executes the full PROJ-02-01 `hydrateWorkspaceForProjectOpen` + `projectOpenInProgressRef` guard chain and calls `setWorkspaceView('project')` on success. No new project-open race surface introduced.

---

## Test Summary

Six focused tests added to `workspace-shell.test.tsx`. New fixture constant `templatesViewProjects` (2 projects: `template-view-1` "Starter CRM" and `template-view-2` "Marketplace Clone").

| Test | What it asserts |
|---|---|
| `renders template cards in templates view when public projects exist` | `workspace-templates-view`, `workspace-templates-grid`, `workspace-template-card-template-view-1`, `workspace-template-card-template-view-2` present |
| `renders template project names in template cards` | `Starter CRM`, `Marketplace Clone` visible in HTML |
| `renders empty state in templates view when no public projects exist` | `workspace-templates-empty-state`, `>No templates available.<` present |
| `renders search input in templates view` | `workspace-templates-search`, `placeholder="Search"` present |
| `clicking fork on a template card calls onForkPublicWorkspaceProjectById with project id` | `forkCalls === 1`, `forkedProjectId === 'template-view-2'` |
| `search filter hides non-matching template cards if testable` | Filtering by `"market"` shows `template-view-2` (Marketplace Clone) and not `template-view-1` (Starter CRM) |

Total tests: 286 (280 pre-existing + 6 new). All pass.

---

## Acceptance Checks

| Check | Result |
|---|---|
| UX-IA-06 registered in TASKS.md and TASKS_BACKLOG_FULL.md | PASS |
| Templates view shows `WorkspaceTemplateCard` grid for public projects | PASS — `workspace-templates-grid` renders `workspace-template-card-{id}` per project |
| Fork button calls `onForkPublicWorkspaceProjectById`; forked project opens in project mode | PASS — tested; `handleForkPublicWorkspaceProjectById` routes through `handleResumeWorkspaceProjectById` |
| Search/filter input present and filters by project name | PASS — `workspace-templates-search` present; search state filters `filteredTemplateProjects` |
| Empty state shown when no public projects are available | PASS — `workspace-templates-empty-state` renders `workspace.noTemplates` text |
| All new user-facing strings use i18n keys | PASS — `fork`, `forking`, `noTemplates` added to all 3 locale files; `search` reuses `common.search` |
| `npx tsc --noEmit` | PASS |
| `npm test` (286 tests) | PASS — 286/286 |
| `npm run build` | PASS — Next.js production build successful |
| `ReadLints` on all touched files | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | Completed |
| No regressions to UX-IA-04 sidebar, Home view, or project-mode behavior | PASS — 286/286; all prior tests passing |
| No regressions to UX-IA-05 Projects view | PASS — 286/286 |
| No regressions to AUTH-APP-01/02 or PROJ-02 hydration chain | PASS — no changes to auth, hydration guard chain, or PROJ-02 session logic |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 286 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No template creation system
- No curation or admin system
- No account menu (UX-IA-07)
- No project mode shell or tab system (UX-IA-08/10/11)
- No backend or API changes
- No auth changes
- No route cleanup (UX-IA-14)
- No responsive/mobile work (UX-IA-13)
- No broad refactor of AI-WS, preview, or file logic
- No new i18n namespaces
- No changes to `frontend/components/workspace/workspace-project-card.tsx`
- No changes to PROJ-02-01 `hydrateWorkspaceForProjectOpen` or `projectOpenInProgressRef` guard chain
- No changes to AUTH-APP-01/02 session-cookie auth, CSRF guards, or preview security guards
- No changes to UX-IA-01 locale middleware, `TranslationProvider`, `useTranslations` hook, or locale JSON structure
- Existing zero-arg `handleForkPublicWorkspaceProject` and its `HistoryProjectPanel` wiring unchanged

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, UX-IA-04, UX-IA-05, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain is unchanged; fork-from-template card routes through `handleResumeWorkspaceProjectById`, which executes the same PROJ-02-01 chain.
- `HistoryProjectPanel` and its zero-arg `onForkPublicProject` wiring are preserved; both remain rendered under Projects view as before.
- UX-IA-04 sidebar, Home view, and project-mode behavior preserved.
- UX-IA-05 Projects view (`workspace-projects-view`, `WorkspaceProjectCard`, grid/list toggle, recent projects) preserved.
- `WorkspaceView` state and `workspaceView` prop interface unchanged.

---

## Carry-Forwards

| Item | Target task |
|---|---|
| Account menu, settings, language/theme switcher | UX-IA-07 — Account Menu + Settings + Language/Theme |
| Project mode shell redesign | UX-IA-08 — Project Mode Shell |
| Project AI + history panel | UX-IA-09 — Project AI + History Panel |
| Responsive / mobile polish for template cards | Deferred to UX-IA-13 |
| Upgrade flow polish | UX-IA-12 |
| View (read-only) action for public template cards | Not implemented in this slice; no spec requirement identified |

---

## Next Recommended Task

**UX-IA-07 — Account Menu + Settings + Language/Theme**

Depends on UX-IA-06 (now COMPLETE and LOCKED). Add account avatar in sidebar that opens a popup menu. Wire language switching into the account menu. Add theme toggle placeholder (light only for v1, dark as placeholder).

Reference: `TASKS.md` → UX-IA-07. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-07 section.
