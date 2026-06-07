# AI-CONTEXT-05A Checkpoint — Context Link Readiness Indicator

**Task ID:** AI-CONTEXT-05A
**Family:** AI-CONTEXT
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-07
**Depends on:** AI-CONTEXT-04C COMPLETE and LOCKED

---

## Problem solved

AI-CONTEXT-04C injects Repo Docs into the AI prompt by resolving `session.projectId`. This means Repo Docs are only injected when the active session is linked to the project that owns the Repo Docs. Before this task, the Active Context Indicator showed only Global and Project instruction states. There was no visible signal for Repo Docs readiness, and no warning when Repo Docs were configured for a project but the active session was not linked to that project — a silent trap where the UI looked ready but AI execution received no Repo Docs.

---

## Objective achieved

Extended the existing Active Context Indicator (introduced by AI-CONTEXT-03A) to include a Repo Docs readiness state. Users can now see in the chat panel whether Repo Docs are On, Off, or Unavailable for the current AI execution context. When Repo Docs are configured but unavailable due to a session/project mismatch, a clear multilingual message is displayed.

---

## Files changed

| File | Change |
|---|---|
| `frontend/components/workspace/workspace-shell.tsx` | Added Repo Docs context state logic, event listener, and indicator UI |
| `frontend/components/workspace/workspace-shell.test.tsx` | Added Repo Docs indicator tests and i18n key assertions |
| `frontend/messages/en.json` | Added 3 new i18n keys under `ai` section |
| `frontend/messages/zh-TW.json` | Added 3 new i18n keys under `ai` section |
| `frontend/messages/zh-CN.json` | Added 3 new i18n keys under `ai` section |

No backend files changed. No AI prompt assembly or Repo Docs injection files changed.

---

## Implementation summary

### State logic (`workspace-shell.tsx`)

Added a third state variable alongside the existing `isGlobalContextActive` and `isProjectContextActive`:

```
const [isRepoDocsConfigured, setIsRepoDocsConfigured] = React.useState(false);
```

Added a `useEffect` that:
- Calls `fetchProjectRepoDocsFromApi` when `selectedProjectId` changes to determine whether Repo Docs are configured.
- Listens for a new `workspace:project-repo-docs-updated` custom event (dispatched from `saveProjectRepoDocsToApi`) so the indicator updates immediately when the user saves or clears Repo Docs, without requiring a page reload.

Added a derived `repoDocsContextState` value:

```
const repoDocsContextState: 'on' | 'off' | 'unavailable' = !isRepoDocsConfigured
  ? 'off'
  : selectedSessionProjectId !== null &&
      selectedProjectIdForContext !== null &&
      selectedSessionProjectId === selectedProjectIdForContext
    ? 'on'
    : 'unavailable';
```

Where:
- `selectedProjectIdForContext` is the normalized `props.selectedProjectId`.
- `selectedSessionProjectId` is the `projectId` field from the currently selected session object (already present in `WorkspaceShellSession` via the sessions API response).

### Event dispatch (`saveProjectRepoDocsToApi`)

Added a `window.dispatchEvent` call in `saveProjectRepoDocsToApi` that fires `workspace:project-repo-docs-updated` with `{ projectId, hasDocs: docs.length > 0 }` after a successful save. The Repo Docs status `useEffect` listens for this event and updates `isRepoDocsConfigured` immediately for the matching project.

### UI rendering (`WorkspaceChatPanel`)

Added `repoDocsContextState` as a new prop to `WorkspaceChatPanel`. Extended the context indicator bar with a third dot-separated segment:

```
· Repo Docs On
· Repo Docs Off
· Repo Docs Unavailable  [amber warning message]
```

The amber warning message (`workspace-chat-context-repo-docs-unavailable-message`) is only rendered when `repoDocsContextState === 'unavailable'`.

### No backend change needed

`session.projectId` is already present in the sessions API response that powers the `sessions` prop of `WorkspaceShell`. The linkage check is purely a comparison of frontend state values — no new API call, no new backend endpoint.

---

## i18n keys added

All three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) updated under the `ai` section:

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `contextIndicatorRepoDocs` | `Repo Docs` | `Repo Docs` | `Repo Docs` |
| `contextIndicatorUnavailable` | `Unavailable` | `不可用` | `不可用` |
| `contextIndicatorRepoDocsUnavailableMessage` | `Repo Docs unavailable — open this project in the current session first.` | `Repo Docs 暫時不可用 — 請先在目前工作階段開啟此專案。` | `Repo Docs 暂时不可用 — 请先在当前会话中打开此项目。` |

All new text uses the existing translation hook/pattern. No hardcoded English user-facing copy was added.

---

## Project/session linkage clarification

The linkage check `selectedSession.projectId === selectedProjectId` is the correct source-of-truth for whether AI execution will receive Repo Docs:

- **`PROJECT_FIRST_UX = true` (production):** Opening or creating a project calls `openProjectInFreshSession`, which always associates the session with the project via `POST /api/projects/:id/sessions/:sessionId`. After open, `session.projectId === selectedProjectId` is guaranteed. Repo Docs indicator will show **On** if docs are configured.
- **`PROJECT_FIRST_UX = false` (local dev):** Session and project selections are independent. A user can select Project B in the UI while the active session is still linked to Project A (from a prior Open Project action). The Repo Docs indicator will show **Unavailable** in this state, which is correct because AI execution will read Repo Docs for the session's project (A), not the UI-selected project (B).

The Unavailable state is reachable in normal UI and is a valid, meaningful signal in both flag states.

---

## Validation results

| Check | Result |
|---|---|
| `npm test -- workspace-shell.test.tsx` (frontend) | PASS — 629/629, 0 failed |
| `npx tsc --noEmit` (frontend) | PASS — 0 errors |
| `npm run build` (frontend) | PASS — compiled successfully, all routes generated |
| `ReadLints` on touched files | PASS — no linter errors |
| Live browser smoke | PASS — all 4 scenarios confirmed |

**Build note:** `npm run build` required `NODE_TLS_REJECT_UNAUTHORIZED=0` workaround for a local network certificate issue that affects `next/font` Inter fetch. This is a pre-existing environment issue unrelated to AI-CONTEXT-05A. The env var was removed immediately after the build. `tsconfig.tsbuildinfo` was restored with `git restore` after the build.

---

## Live browser smoke results

| Scenario | Result |
|---|---|
| Repo Docs configured + session linked to selected project | PASS — indicator shows `Repo Docs On` |
| Repo Docs configured + session not linked to selected project | PASS — indicator shows `Repo Docs Unavailable` + amber message |
| No Repo Docs configured | PASS — indicator shows `Repo Docs Off` |
| Global and Project indicators unaffected | PASS — both remain correct in all states |

---

## Non-goals respected

- No AI prompt assembly changes.
- No Repo Docs injection changes.
- No database schema changes.
- No Repo Docs picker redesign.
- No broad workspace redesign.
- No project/session architecture refactor.
- No new context system.
- No backend write endpoints.
- No changes to AI providers.
- No unrelated UI polish.
- No new third-party dependencies.

---

## Rollback guidance

To revert AI-CONTEXT-05A:

1. In `frontend/components/workspace/workspace-shell.tsx`:
   - Remove the `PROJECT_REPO_DOCS_UPDATED_EVENT` export constant.
   - Remove the `window.dispatchEvent` block from `saveProjectRepoDocsToApi`.
   - Remove the `isRepoDocsConfigured` state and its `useEffect`.
   - Remove `selectedProjectIdForContext`, `selectedSessionProjectId`, and `repoDocsContextState` derived values.
   - Remove `repoDocsContextState` prop from `WorkspaceChatPanel` call site and definition.
   - Remove the Repo Docs indicator segment and unavailable message from `WorkspaceChatPanel` render.

2. In `frontend/components/workspace/workspace-shell.test.tsx`:
   - Remove the Repo Docs indicator assertions added to existing tests.
   - Remove the two new Repo Docs indicator tests.
   - Remove `contextIndicatorRepoDocs`, `contextIndicatorUnavailable`, and `contextIndicatorRepoDocsUnavailableMessage` from the i18n key assertions.

3. In `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json`:
   - Remove keys `contextIndicatorRepoDocs`, `contextIndicatorUnavailable`, `contextIndicatorRepoDocsUnavailableMessage` from the `ai` section.

No backend changes are required for rollback.

---

## Prior checkpoint reference

See `docs/AI-CONTEXT-04C-CHECKPOINT.md` for the Repo Docs injection task this indicator builds upon.
