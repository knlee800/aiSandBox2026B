# UX-PV-01 Checkpoint — Preview Auto-Start and First-Load Error Resilience

## Task metadata

| Field | Value |
|---|---|
| Task ID | UX-PV-01 |
| Family | UX-PV (Preview UX Reliability) |
| Status | COMPLETE and LOCKED |
| Priority | High |
| Nature | FRONTEND-ONLY / PREVIEW UX RELIABILITY |
| Risk | Medium |
| Depends on | UX-IA-39 (COMPLETE and LOCKED — `docs/UX-IA-39-CHECKPOINT.md`) |

## Problem addressed

1. When a project was opened, Preview did not auto-start. Users had to press Start Preview manually.
2. After pressing Start Preview, the first iframe load often showed a Preview error because the dev server was still booting.
3. Pressing Refresh usually worked because the dev server had finished booting by then.
4. This created a broken first-use Preview experience.

## Exact files changed

Production source files changed during implementation:

- `frontend/app/[locale]/app/page.tsx`
- `frontend/components/workspace/workspace-shell.test.tsx`

Files NOT changed:

- `frontend/components/workspace/workspace-shell.tsx`
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`
- All backend/service files
- All tab-registry, tab-bar, sidebar, Command Input, Build Targets files
- All Chat/History, file-tree, checkpoint/history logic files

## Auto-start implementation

`refreshPreviewForSession` signature updated to `refreshPreviewForSession(sessionId: string, autoStart = false)`.

Behavior when `autoStart = true`:
- `GET /api/preview/:sessionId/status` is called.
- If running: `previewUrl` is set (loading state remains until iframe `onLoad` sets ready). Retry counter resets.
- If not running: `POST /api/preview/:sessionId/start` is called.
  - If POST succeeds: status is re-checked once via `GET /status`.
  - If running after recheck: `previewUrl` is set.
  - If still not running or POST fails: `previewState('unavailable')` and `previewUrl(null)`.

Behavior when `autoStart = false` (manual Refresh path): unchanged — not running → `previewState('unavailable')`.

Call sites updated to `autoStart = true`:
- The `selectedSessionId`/`userId` effect that triggers on project/session open.
- `handleCreateWorkspaceProject` open path.
- `handleOpenWorkspaceProject` PROJECT_FIRST_UX path.
- `handleOpenWorkspaceProject` legacy path.
- `handleResumeWorkspaceProjectById` path.
- `handleRestoreWorkspaceProjectFromSnapshotById` path.

Manual fallbacks preserved:
- Manual Refresh: `handleRefreshPreview` calls `refreshPreviewForSession(selectedSessionId, false)`.
- Manual Start Preview: `handleStartPreview` unchanged as a post-stop restart path.

## Iframe first-load retry implementation

Added constants:
- `PREVIEW_FIRST_LOAD_ERROR_RETRY_MAX_ATTEMPTS = 3`
- `PREVIEW_FIRST_LOAD_ERROR_RETRY_DELAY_MS = 2000`

Added refs:
- `previewErrorRetryCountRef` — tracks retry count.
- `previewErrorRetryTimeoutRef` — tracks pending retry timeout handle.

Added helper `clearPreviewErrorRetryTimeout()` to cancel any pending retry timeout.

`handlePreviewError` updated:
- If `selectedSessionId` is absent: immediately sets `previewState('unavailable')` and clears retry state.
- If retries remain (`< 3`): increments counter, keeps `previewState('loading')`, schedules `refreshPreviewForSession(sessionId, false)` after 2s. Checks that `selectedSessionIdRef.current` still matches before retrying.
- If retries exhausted: resets counter, sets `previewState('error')` and `previewUrl(null)`.

Retry counter reset points:
- When `isPreviewRunning(statusData)` is true and `previewUrl` is set.
- When `!autoStart` and preview is unavailable.
- When `autoStart` and POST start fallback results in unavailable.
- On `selectedSessionId` change (`useEffect`).
- At the start of `handleStartPreview` for a new manual start attempt.

Timeout leak prevention:
- `clearPreviewErrorRetryTimeout()` called before each new retry schedule.
- Cleanup `useEffect` clears timeout on unmount.
- Session change `useEffect` clears timeout on session switch.

## i18n / no new copy

No new i18n keys were added. Existing preview loading copy was reused. `workspace-shell.tsx`, `en.json`, `zh-TW.json`, and `zh-CN.json` were not changed.

## Tests updated

`frontend/components/workspace/workspace-shell.test.tsx` — new source-assertion suite `workspace preview auto-start and retry wiring — UX-PV-01`:

1. `page source supports preview status auto-start fallback with recheck` — asserts `autoStart` parameter signature, POST start call, `recheckStatusData`, and `!autoStart` unavailable branch.
2. `selected session/project open paths refresh preview with autoStart enabled` — asserts `autoStart=true` at selected-session effect and open-session paths.
3. `preview iframe error handler retries before transitioning to error state` — asserts retry loop structure in `handlePreviewError`.
4. `preview retry counter is defined and reset on success, unavailable, session change, and start` — asserts all reset points for `previewErrorRetryCountRef`.

Existing preview render tests (loading state, ready state, error state, unavailable state, picker toggle, iframe) all preserved and still passing.

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 589 tests, 589 pass, 0 fail |
| ReadLints | PASS (page.tsx, workspace-shell.tsx, workspace-shell.test.tsx) |
| `tsconfig.tsbuildinfo` | Restored |
| Live browser test | PASS |

## Non-goals confirmed

- No backend/API changes.
- No Chat/History changes.
- No Build Targets changes.
- No Command Input changes.
- No sidebar changes.
- No tab-registry/tab-bar changes.
- No checkpoint/history/file-tree changes.

## Next recommended step

Live smoke the auto-start with a fresh project open to confirm the boot-to-preview transition is seamless across all normal network conditions, then continue to the next UX-PV or backlog task.
