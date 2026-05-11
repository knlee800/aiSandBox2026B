# UX-IA-04A Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-04A |
| Title | Sidebar Shell + View State Scaffolding |
| Parent | UX-IA-04 — Workspace Shell + Sidebar + Home View |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date | 2026-05-11 |
| Source | UX-IA-04 plan phase result (May 2026) |
| Depends on | UX-IA-04 plan phase (COMPLETE) |

---

## Objective

Add `WorkspaceView` state to `page.tsx`. Create `workspace-sidebar.tsx` as a presentation-only sidebar component. Restructure `workspace-shell.tsx` from the existing header+aside+main layout into a sidebar+right-content arrangement with view-based rendering. Wire nav items (Home / Projects / Templates). Render recent projects and compact usage. Home view shows a static placeholder only. Preserve all existing project/AI/preview/history behavior unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added `WorkspaceView` type; added `workspaceView` state defaulting to `'home'`; passed `workspaceView` and `onWorkspaceViewChange` into `WorkspaceShell`; added `setWorkspaceView('project')` to the success paths of `handleCreateWorkspaceProject`, `handleOpenWorkspaceProject`, `handleResumeWorkspaceProjectById`, `handleRestoreWorkspaceProjectFromSnapshotById` |
| `frontend/components/workspace/workspace-sidebar.tsx` | New file — presentation-only sidebar component |
| `frontend/components/workspace/workspace-shell.tsx` | Added `workspaceView` / `onWorkspaceViewChange` props; imported `WorkspaceSidebar`; computed `recentProjects` (top 5 by `updatedAt`); non-project-first path preserved as-is; project-first path now renders sidebar + view-based right content |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `workspaceView: 'project'` and `onWorkspaceViewChange` to default props; updated project-first nav test for sidebar; added two small new tests (home placeholder, project view) |

---

## Implementation Summary

### WorkspaceView type and state (`page.tsx`)

```typescript
type WorkspaceView = 'home' | 'projects' | 'templates' | 'project';
const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home');
```

Default is `'home'`. After existing project-open/create/resume/restore flows succeed (inside their existing safe success paths, after all hydration is complete), `setWorkspaceView('project')` transitions the shell into project mode. The hydration logic itself is unchanged.

The type and setter are threaded into `WorkspaceShell` as two new optional props: `workspaceView` and `onWorkspaceViewChange`.

### workspace-sidebar.tsx (new)

A presentation-only, `'use client'` component. Contains:

- App name + selected workspace header
- Workspace selector `<select>` (drives existing `onSelectWorkspaceId`)
- Nav buttons: Home / Projects / Templates (drives `onWorkspaceViewChange`)
- Recent projects section (up to 5 items; empty state when list is empty)
- Compact usage display (rendered only when `userSummary` + `usageSummary` + `quotaSummary` are all available)
- Disabled Upgrade placeholder button
- Logout button (rendered only when `onLogout` is provided)
- `footerContent` slot for `WorkspaceAdvancedDrawer`

i18n: the component does not call `useTranslations` (which requires `TranslationProvider` in context, which tests do not wrap). Instead it uses a module-local `getWorkspaceScaffoldMessages(locale?)` helper that reads directly from the imported locale JSON files. This keeps it fully server-render and test-render safe.

All string keys used are from existing namespaces already present in all three locale files: `common.appName`, `workspace.home`, `workspace.projects`, `workspace.templates`, `workspace.recentProjects`, `workspace.upgrade`, `workspace.noProjects`, `account.logout`, `tabs.comingSoon`.

### workspace-shell.tsx layout restructure

Non-project-first path: unchanged from prior implementation. Renders the original header + session sidebar + workspace content layout.

Project-first path: replaced with `WorkspaceSidebar` on the left + `<main>` on the right. The right content switches on `resolvedWorkspaceView`:

| View | Content |
|---|---|
| `home` | Static placeholder: "Build anything" heading + disabled textarea + disabled submit button |
| `projects` | Existing trust-note banner + history/project/snapshot panels + dashboard |
| `templates` | Static placeholder: heading + "Coming soon" |
| `project` | Existing full workspace content (chat/editor/preview/history/dashboard) wrapped in `data-testid="workspace-project-view"` |

`WorkspaceAdvancedDrawer` is passed as `footerContent` into `WorkspaceSidebar` so it remains reachable.

`computeRecentProjects` helper added at module level — sorts `workspaceProjects` by `updatedAt` desc, returns top 5 as `WorkspaceSidebarRecentProject[]`.

### Tests (`workspace-shell.test.tsx`)

- Default `buildWorkspaceShellProps` now includes `workspaceView: 'project'` and `onWorkspaceViewChange: () => {}` so all existing tests continue to render the project view (full workspace content), preserving all existing assertions.
- The old `renders project-first header nav behind feature flag` test was updated to `renders project-first sidebar nav behind feature flag` — now asserts sidebar `data-testid` attributes and translated nav labels instead of removed header link elements.
- Two new tests added:
  - `renders home placeholder when project-first home view is selected` — asserts `workspace-home-placeholder`, "Build anything", placeholder input/submit testids, and absence of "Chat Panel".
  - `renders existing workspace content when project view is selected` — asserts `workspace-project-view`, "Chat Panel", "Editor Panel", "Preview Panel", "History & Controls".

---

## Validation

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — no type errors |
| `npm test` | `frontend/` | PASS — all suites pass |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on all 4 touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed — build artifact restored |

---

## Non-Goals Confirmed

- No Home prompt-to-project flow implemented (UX-IA-04B)
- No `handleCreateProjectFromPrompt` added
- No sessionStorage pending prompt consumption
- No project mode redesign (UX-IA-08)
- No tab system (UX-IA-10/11)
- No account menu (UX-IA-07)
- No backend or API changes
- No auth changes
- No responsive/mobile work (UX-IA-13)
- No recoveryCopy migration beyond what the structural changes required
- No new i18n keys added — all string keys used already existed in all 3 locale files
- No breaking changes to AI-WS-01 through AI-WS-06 or hotfix behaviors
- No changes to AUTH-APP-01/02 session-cookie auth, CSRF guards, or preview security
- No changes to PROJ-02-01/02/03 project-open hydration chain
- No checkpoint/governance files edited beyond this consolidation pass

---

## Carry-Forwards to UX-IA-04B

| Item | Detail |
|---|---|
| Home chatbox submit behavior | `onCreateProjectFromPrompt` handler not yet implemented |
| `handleCreateProjectFromPrompt` | Belongs to UX-IA-04B in `page.tsx` |
| sessionStorage pending prompt | `aisandbox_pending_prompt` consumption belongs to UX-IA-04B |
| Templates view | Placeholder only; community/template content is UX-IA-06 |

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain is unchanged.
- AUTH-APP-01 `SessionCookieGuard`, CSRF guard, preview security guards are unchanged.
- All AI-WS file-action confirmation and coherence flows are unchanged.
- UX-IA-01 locale middleware, `TranslationProvider`, `useTranslations` hook, and locale JSON structure are unchanged.
- UX-IA-02 design token CSS variables are unchanged.

---

## Next Recommended Task

**UX-IA-04B — Home View Chatbox + Prompt-to-Project Flow**

Depends on UX-IA-04A (now COMPLETE and LOCKED). Implement `handleCreateProjectFromPrompt` in `page.tsx`, wire the Home view chatbox to trigger it, and consume the `aisandbox_pending_prompt` sessionStorage key written by the UX-IA-03 landing page.

Reference: `TASKS.md` → UX-IA-04B. Reference: `TASKS_BACKLOG_FULL.md` → UX-IA-04B.
