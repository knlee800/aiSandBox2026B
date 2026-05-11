# UX-IA-04B Checkpoint

## Task Metadata

| Field | Value |
|---|---|
| Task ID | UX-IA-04B |
| Title | Home View Chatbox + Prompt-to-Project Flow |
| Parent | UX-IA-04 — Workspace Shell + Sidebar + Home View |
| Family | UX-IA — Product & UX/UI Redesign (Evolutionary) |
| Status | COMPLETE and LOCKED |
| Date | 2026-05-11 |
| Source | UX-IA-04 plan phase result (May 2026) |
| Depends on | UX-IA-04A (COMPLETE and LOCKED — `docs/UX-IA-04A-CHECKPOINT.md`) |

---

## Objective

Replace the static Home view placeholder (added in UX-IA-04A) with a functional chatbox. Add `handleCreateProjectFromPrompt(prompt)` to `page.tsx`. Consume the `aisandbox_pending_prompt` sessionStorage key written by the UX-IA-03 landing page on workspace mount. Wire the Home textarea and Start button to trigger project creation through the existing PROJ-02 deterministic hydration flow.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Added `PENDING_HOME_PROMPT_STORAGE_KEY` constant; added `import { flushSync } from 'react-dom'`; added mount-time `useEffect` to read and clear `aisandbox_pending_prompt` and seed `chatPromptInput`; added `handleCreateProjectFromPrompt(prompt)` handler; passed `onCreateProjectFromPrompt={handleCreateProjectFromPrompt}` to `WorkspaceShell` |
| `frontend/components/workspace/workspace-shell.tsx` | Added `onCreateProjectFromPrompt?: (prompt: string) => Promise<void>` to `WorkspaceShellProps`; added `homePromptInput`, `trimmedHomePrompt`, `isCreatingProjectFromPrompt` derived values in component body; replaced static Home placeholder with controlled textarea + enabled Start button |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added `onCreateProjectFromPrompt: async () => {}` to `buildWorkspaceShellProps` defaults; updated Home view render test assertions for new testids; added two new interaction tests for prompt wiring and empty-submit guarding |

---

## Implementation Summary

### `handleCreateProjectFromPrompt` (`page.tsx`)

```typescript
async function handleCreateProjectFromPrompt(prompt: string): Promise<void> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return;
  }

  const autoProjectName =
    trimmedPrompt.replace(/\s+/g, ' ').slice(0, 40).trim() || 'New project';

  flushSync(() => {
    setProjectNameInput(autoProjectName);
    setChatPromptInput(trimmedPrompt);
  });

  await handleCreateWorkspaceProject();
  setChatPromptInput(trimmedPrompt);
}
```

- Empty prompt no-ops immediately.
- Auto project name: first 40 characters of normalized (single-space) prompt, fallback `'New project'`.
- `flushSync` ensures React flushes state before `handleCreateWorkspaceProject()` reads `projectNameInput` from its closure scope.
- Delegates to the existing `handleCreateWorkspaceProject()` path without modification — the PROJ-02 deterministic project-open, session-open, hydration, and preview-refresh chain runs unchanged.
- After `handleCreateWorkspaceProject()` resolves (which calls `setWorkspaceView('project')` on success), `setChatPromptInput(trimmedPrompt)` re-seeds the chat input so it survives the session-change effect that clears it.

### Pending prompt consumption (`page.tsx`)

A second mount-only `useEffect` (empty dependency array) reads `sessionStorage.getItem('aisandbox_pending_prompt')`, removes the key immediately, then calls `setChatPromptInput(trimmedValue)` if the value is non-empty. Guard for `typeof window === 'undefined'` (SSR safety). This ensures a prompt written by the UX-IA-03 landing page is picked up once and consumed on workspace mount.

### Home view chatbox (`workspace-shell.tsx`)

Three derived values in `WorkspaceShell` body:

```typescript
const homePromptInput = props.chatPromptInput ?? '';
const trimmedHomePrompt = homePromptInput.trim();
const isCreatingProjectFromPrompt = props.projectActionState === 'creating';
```

The Home `data-testid` was updated from `workspace-home-placeholder` to `workspace-home-view`.

The textarea:
- `value={homePromptInput}` — controlled by `chatPromptInput` / `onChatPromptInputChange` props.
- `disabled` when `isCreatingProjectFromPrompt` or when `onChatPromptInputChange` is not provided.
- `data-testid="workspace-home-input"`.

The Start button:
- `disabled` when `isCreatingProjectFromPrompt`, `onCreateProjectFromPrompt` is not provided, or `trimmedHomePrompt` is empty.
- `onClick` calls `onCreateProjectFromPrompt(trimmedHomePrompt)` after the same guard checks.
- `data-testid="workspace-home-submit"`.

All i18n strings use existing locale keys (`workspace.buildAnything`, `workspace.describeBuild`, `workspace.start`, `workspace.home`) already present in all three locale files — no new keys added.

The project view content (`data-testid="workspace-project-view"`) is unchanged.

### Tests (`workspace-shell.test.tsx`)

- `buildWorkspaceShellProps` default props now include `onCreateProjectFromPrompt: async () => {}`.
- `renders home chatbox when project-first home view is selected` — asserts `workspace-home-view`, "Build anything", `workspace-home-input`, `workspace-home-submit`, absence of "Chat Panel".
- `wires home prompt input and submit in project-first home view` — uses `renderWorkspaceShellElementByTestId` to assert textarea `onChange` wiring and button `onClick` calls handler with correct prompt value.
- `does not submit an empty home prompt` — asserts button is `disabled` and `onClick` does not invoke the handler when prompt is whitespace.

---

## Validation

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `frontend/` | PASS — no type errors |
| `npm test` | `frontend/` | PASS — all suites pass |
| `npm run build` | `frontend/` | PASS — Next.js production build successful |
| `ReadLints` on all 3 touched files | — | PASS — no linter errors |
| `git restore -- frontend/tsconfig.tsbuildinfo` | repo root | Completed |

---

## Non-Goals Confirmed

- No new backend API calls introduced
- No change to `handleCreateWorkspaceProject` internals
- No change to PROJ-02-01 hydration flow or `projectOpenInProgressRef` guard
- No new project-open race surface
- No project mode redesign (UX-IA-08)
- No tab system (UX-IA-10/11)
- No account menu (UX-IA-07)
- No auth changes
- No responsive/mobile work (UX-IA-13)
- No new i18n keys — all string keys used already existed in all 3 locale files
- No changes to AUTH-APP-01/02 session-cookie auth, CSRF guards, or preview security
- No changes to existing chat panel in project view
- No backend or billing changes
- Templates view remains placeholder-only
- No checkpoint/governance files edited beyond this consolidation pass

---

## Invariants Preserved

- All prior checkpoint invariants (UX-IA-01, UX-IA-02, UX-IA-03, AUTH-APP-01, AUTH-APP-02, PROJ-02-01, PROJ-02-02, PROJ-02-03, UX-IA-04A) remain intact.
- PROJ-02-01 `hydrateWorkspaceForProjectOpen` and `projectOpenInProgressRef` guard chain is unchanged.
- AUTH-APP-01 `SessionCookieGuard`, CSRF guard, preview security guards are unchanged.
- All AI-WS file-action confirmation and coherence flows are unchanged.
- UX-IA-01 locale middleware, `TranslationProvider`, `useTranslations` hook, and locale JSON structure are unchanged.
- UX-IA-02 design token CSS variables are unchanged.
- UX-IA-04A sidebar, workspace selector, nav items, recent projects, and project-view layout are unchanged.

---

## Carry-Forwards to UX-IA-04C

| Item | Detail |
|---|---|
| Final test + consolidation pass | `workspace-shell.test.tsx` extended coverage for the full UX-IA-04 surface area |
| UX-IA-04 family checkpoint | `docs/UX-IA-04-CHECKPOINT.md` not yet written |
| TASKS.md / TASKS_BACKLOG_FULL.md closure | UX-IA-04 parent status not yet updated to COMPLETE and LOCKED |
| Templates view | Still placeholder only; community/template content is UX-IA-06 |
| No project mode redesign yet | UX-IA-08 |
| No tab system yet | UX-IA-10/11 |

---

## Next Recommended Task

**UX-IA-04C — Tests + Validation + Consolidation**

Depends on UX-IA-04B (now COMPLETE and LOCKED). Extend `workspace-shell.test.tsx` with comprehensive coverage for the new layout, sidebar, view state, and Home chatbox. Run the full validation suite. Write `docs/UX-IA-04-CHECKPOINT.md` and close the UX-IA-04 family.

Reference: `TASKS.md` → UX-IA-04C. Reference: `TASKS_BACKLOG_FULL.md` → UX-IA-04C.
