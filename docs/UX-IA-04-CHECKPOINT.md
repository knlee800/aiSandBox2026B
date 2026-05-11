# UX-IA-04 Checkpoint — Workspace Shell + Sidebar + Home View

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-04 |
| Title | Workspace Shell + Sidebar + Home View |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date closed | 2026-05-11 |
| Master spec | `docs/UX-IA-00-MASTER-PLAN.md` |
| Depends on | UX-IA-03, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03 (all COMPLETE and LOCKED) |

---

## Child Slice Summary

| Slice | Title | Status | Checkpoint |
|---|---|---|---|
| UX-IA-04A | Sidebar shell + view state scaffolding | COMPLETE and LOCKED | `docs/UX-IA-04A-CHECKPOINT.md` |
| UX-IA-04B | Home view chatbox + prompt-to-project flow | COMPLETE and LOCKED | `docs/UX-IA-04B-CHECKPOINT.md` |
| UX-IA-04C | Tests + validation + consolidation | COMPLETE and LOCKED | `docs/UX-IA-04-CHECKPOINT.md` (this file) |

---

## Objective

Evolve `WorkspaceShell` from a single-column session-scoped workspace into a sidebar + right-content layout with view-based routing. Add a `WorkspaceView` state (`home | projects | templates | project`). Implement a fully functional authenticated Home view with a "Build anything" chatbox. Submitting a prompt from Home auto-names and creates a project, then opens project mode using the existing deterministic PROJ-02 hydration chain. Extract a `WorkspaceSidebar` component. Reuse existing workspace/project state and handlers from `page.tsx`. Preserve all existing workspace/project/AI/file/preview/history behavior unchanged.

---

## Final Files Changed Across UX-IA-04

| File | Introduced in | Change |
|---|---|---|
| `frontend/components/workspace/workspace-sidebar.tsx` | UX-IA-04A | New — presentation-only sidebar component |
| `frontend/components/workspace/workspace-shell.tsx` | UX-IA-04A + 04B | Props: `workspaceView`, `onWorkspaceViewChange`, `onCreateProjectFromPrompt`; layout restructure for project-first mode; view-based right content; Home chatbox |
| `frontend/app/[locale]/app/page.tsx` | UX-IA-04A + 04B | `WorkspaceView` type; `workspaceView` state; `setWorkspaceView('project')` in project-open success paths; `handleCreateProjectFromPrompt`; pending prompt sessionStorage consumption; `flushSync` import |
| `frontend/components/workspace/workspace-shell.test.tsx` | UX-IA-04A + 04C | Default props updated; sidebar nav test; Home chatbox tests; prompt wiring tests; empty-submit guard test; recent-projects sidebar test; project-view preservation test |

---

## Implementation Summary

### WorkspaceView state (`page.tsx` — UX-IA-04A)

```typescript
type WorkspaceView = 'home' | 'projects' | 'templates' | 'project';
const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('home');
```

Default is `'home'`. After each of `handleCreateWorkspaceProject`, `handleOpenWorkspaceProject`, `handleResumeWorkspaceProjectById`, `handleRestoreWorkspaceProjectFromSnapshotById` succeeds (after full PROJ-02 hydration), `setWorkspaceView('project')` transitions to project mode.

### WorkspaceSidebar (`workspace-sidebar.tsx` — UX-IA-04A)

Presentation-only `'use client'` component. Contains:

- App name + selected workspace header
- Workspace selector `<select>` (drives `onSelectWorkspaceId`)
- Nav buttons: Home / Projects / Templates (drives `onWorkspaceViewChange`)
- Recent projects section (up to 5 items sorted by `updatedAt` desc; empty state when none)
- Compact usage display (when `userSummary` + `usageSummary` + `quotaSummary` available)
- Disabled Upgrade placeholder button
- Logout button (when `onLogout` provided)
- `footerContent` slot used to host `WorkspaceAdvancedDrawer`

i18n: uses a module-local `getWorkspaceScaffoldMessages(locale?)` helper that reads directly from the imported locale JSON files (SSR/test safe). All string keys were pre-existing in all three locale files.

### WorkspaceShell layout restructure (`workspace-shell.tsx` — UX-IA-04A)

Non-project-first path: unchanged (original header + session sidebar + workspace content).

Project-first path: `WorkspaceSidebar` on the left + `<main>` on the right. Right content switches on `resolvedWorkspaceView`:

| View | Content |
|---|---|
| `home` | Home chatbox (UX-IA-04B) |
| `projects` | Trust-note banner + existing history/project/snapshot panels + dashboard |
| `templates` | "Coming soon" placeholder |
| `project` | Full workspace content (chat/editor/preview/history/dashboard) — unchanged |

### Home view chatbox (`workspace-shell.tsx` — UX-IA-04B)

Derived values in component body:
```typescript
const homePromptInput = props.chatPromptInput ?? '';
const trimmedHomePrompt = homePromptInput.trim();
const isCreatingProjectFromPrompt = props.projectActionState === 'creating';
```

Controlled textarea (`data-testid="workspace-home-input"`) wired to `chatPromptInput`/`onChatPromptInputChange`. Start button (`data-testid="workspace-home-submit"`) disabled when prompt is blank or creating. On click calls `onCreateProjectFromPrompt(trimmedHomePrompt)`.

### handleCreateProjectFromPrompt (`page.tsx` — UX-IA-04B)

```typescript
async function handleCreateProjectFromPrompt(prompt: string): Promise<void> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return;
  const autoProjectName =
    trimmedPrompt.replace(/\s+/g, ' ').slice(0, 40).trim() || 'New project';
  flushSync(() => {
    setProjectNameInput(autoProjectName);
    setChatPromptInput(trimmedPrompt);
  });
  await handleCreateWorkspaceProject();
  setChatPromptInput(trimmedPrompt); // re-seed after session-change clear
}
```

Empty prompt no-ops. Auto name is first 40 chars of normalized prompt. `flushSync` ensures state is flushed before `handleCreateWorkspaceProject()` reads `projectNameInput`. Delegates entirely to the existing PROJ-02 flow.

### Pending prompt consumption (`page.tsx` — UX-IA-04B)

Mount-only `useEffect` reads `sessionStorage.getItem('aisandbox_pending_prompt')`, clears the key immediately, and seeds `chatPromptInput` if non-empty. SSR-guarded with `typeof window === 'undefined'` check.

---

## Acceptance Checks

| Check | Result |
|---|---|
| UX-IA-04 registered in TASKS.md and TASKS_BACKLOG_FULL.md | PASS |
| Sidebar renders with workspace selector + Home/Projects/Templates nav | PASS — tested (`workspace-sidebar-nav-home/projects/templates`, `workspace-sidebar-workspace-select`) |
| Home view shows "Build anything" chatbox | PASS — tested (`workspace-home-view`, `>Build anything<`, `workspace-home-input`, `workspace-home-submit`) |
| Prompt submission from Home calls onCreateProjectFromPrompt | PASS — tested (wires home prompt input and submit) |
| Empty prompt does not submit | PASS — tested (button disabled; onClick does not invoke handler) |
| Recent projects render in sidebar | PASS — tested (`workspace-sidebar-recent-project-{id}`, project names visible) |
| All user-facing strings use i18n keys | PASS — locale test uses `zh-TW`; sidebar uses `getWorkspaceScaffoldMessages`; no hardcoded English in new components |
| Existing workspace/project/AI/file/preview/history behavior preserved | PASS — project view test; all 274 test cases pass |
| `npx tsc --noEmit` | PASS |
| `npm test` (274 tests) | PASS |
| `npm run build` | PASS |
| No regressions to AUTH-APP-01/02, PROJ-02, UX-IA-01/02/03 | PASS — 274/274; no changes to auth, PROJ-02 hydration, i18n infrastructure |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS |
| `npm test` | `frontend/` | PASS — 274 tests, 0 failures |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No project mode redesign (UX-IA-08)
- No tab system (UX-IA-10/11)
- No account menu (UX-IA-07)
- No template/community view implementation (UX-IA-06)
- No route cleanup (UX-IA-14)
- No backend or API changes
- No auth changes
- No responsive/mobile work (UX-IA-13)
- No new i18n keys — all string keys used already existed in all three locale files
- No changes to AUTH-APP-01/02 session-cookie auth, CSRF guards, or preview security
- No changes to PROJ-02-01/02/03 project-open hydration chain
- No changes to AI-WS file-action confirmation/coherence flows
- No visual edit mode

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain is unchanged.
- AUTH-APP-01 `SessionCookieGuard`, CSRF guard, preview security guards are unchanged.
- UX-IA-01 locale middleware, `TranslationProvider`, `useTranslations` hook, and locale JSON structure are unchanged.
- UX-IA-02 design token CSS variables are unchanged.
- Non-project-first (`PROJECT_FIRST_UX = false`) path is entirely unchanged.

---

## Carry-Forwards

| Item | Target task |
|---|---|
| Projects grid/list improvements | UX-IA-05 — Projects Grid/List + Recent Projects |
| Templates / community view | UX-IA-06 — Templates / Community View |
| Account menu, settings, language/theme switcher | UX-IA-07 — Account Menu + Settings + Language/Theme |
| Project mode shell redesign | UX-IA-08 — Project Mode Shell |
| Project AI + history panel | UX-IA-09 — Project AI + History Panel |
| Templates view is placeholder only | Deferred to UX-IA-06 |
| No tab system yet | Deferred to UX-IA-10/11 |
| Upgrade flow polish | UX-IA-12 |
| Responsive / mobile polish | UX-IA-13 |

---

## Next Recommended Task

**UX-IA-05 — Projects Grid/List + Recent Projects**

Depends on UX-IA-04 (now COMPLETE and LOCKED). Implement a proper projects grid/list for the Projects view (currently uses raw `HistoryProjectPanel`), with filtering, sorting, and an improved recent-projects surface.

Reference: `TASKS.md` → UX-IA-05. Reference: `docs/UX-IA-00-MASTER-PLAN.md` → UX-IA-05 section.
