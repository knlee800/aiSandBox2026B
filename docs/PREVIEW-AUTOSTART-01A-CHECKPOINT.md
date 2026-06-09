# PREVIEW-AUTOSTART-01A Checkpoint — Restart Preview After AI File Creation

**Task ID:** PREVIEW-AUTOSTART-01A
**Family:** PREVIEW / RUNTIME / USER APP EXECUTION
**Status:** COMPLETE and LOCKED
**Checkpoint date:** 2026-06-09

---

## Problem

After AI file actions were approved and applied, preview often did not auto-start. Repeated manual smoke showed:

1. Apply file actions → preview did not auto-start
2. Start Preview blinked and did not show preview
3. Refresh finally showed preview

The user had to click Refresh even though the backend preview was already running.

---

## Root Cause

Multiple frontend lifecycle gaps compounded into the same symptom:

1. **Missing auto-start after AI coherence:** The AI execution `refreshPreview` callback called `refreshPreviewForSession(executionSessionId)` without `autoStart=true`, so post-apply coherence did not attempt `POST /start`.
2. **File-action payload overwrite:** `consumeExecutionFileActions` could replace previously captured non-empty file actions with `[]` when a later status payload omitted `fileActions`, causing Apply to write nothing and coherence to skip preview refresh.
3. **Terminal handling of transient POST /start 400:** Overlapping preview start requests can race with file creation and strategy detection. One request may return `400 Bad Request` while a concurrent or slightly later request still registers `activePreviews`. The frontend treated the first failed `POST /start` as terminal and settled into `unavailable`, even though a later `GET /status` returned `running: true`.

Server diagnostics confirmed:

- Some `POST /start` attempts threw `BadRequestException` when strategy detection ran before files were visible.
- A later attempt for the same session successfully started Static HTML preview and stored `activePreviews`.
- Subsequent starts early-returned the existing preview.
- Refresh worked because it only polled `GET /status` and set the iframe URL when `running: true`.

**Final runtime behavior change is frontend-only.** Backend/api-gateway/container-manager files were touched only to add and then remove temporary diagnostic logs.

---

## Objective

Ensure preview refresh after AI file creation attempts auto-start so newly-created previewable apps load without requiring the user to manually click Start Preview or Refresh.

---

## Files Changed

| File | Action |
|---|---|
| `frontend/app/[locale]/app/page.tsx` | Modified — preview lifecycle fixes, bounded status polling after failed start, diagnostic log removal |
| `frontend/components/workspace/workspace-shell.test.tsx` | Modified — source-assertion tests for auto-start, status polling recovery, diagnostic removal |
| `services/container-manager/src/preview/preview.service.ts` | Modified during investigation only — temporary `[PREVIEW-START-DIAG]` logs added then removed; no final runtime behavior change |
| `services/api-gateway/src/preview/preview.controller.ts` | Modified during investigation only — temporary `[PREVIEW-START-DIAG]` logs added then removed; no final runtime behavior change |

---

## Implementation Summary

### Frontend preview lifecycle fixes (`page.tsx`)

1. **AI execution coherence auto-start**
   - `refreshPreview` callback now calls `refreshPreviewForSession(executionSessionId, true)`.

2. **Manual Start Preview resilience**
   - `handleStartPreview` uses its own `startRequestId` stale-request guard.
   - On successful `POST /start`, sets `previewUrl` directly.
   - On failed `POST /start`, polls status before falling back to `unavailable` (not `error`).

3. **File-action preservation**
   - `consumeExecutionFileActions` preserves existing non-empty stored actions when a later payload is empty/missing, so Apply can still read the originally captured file actions.

4. **Bounded status polling after failed start**
   - Added `pollPreviewStatusUntilRunning(sessionId, requestId)`.
   - Constants:
     - `PREVIEW_START_STATUS_POLL_MAX_ATTEMPTS = 5`
     - `PREVIEW_START_STATUS_POLL_DELAY_MS = 800`
   - Used by:
     - `refreshPreviewForSession(..., autoStart=true)` after failed `POST /start`
     - `handleStartPreview` after failed `POST /start` or caught start error
   - Poll loop:
     - `GET /status`
     - if `running: true`, set `previewUrl` and return success
     - respect `previewRequestIdRef` stale cancellation
     - only after bounded polling fails does state settle to `unavailable`

### Diagnostic instrumentation (removed before lock)

Temporary logs were added for live diagnosis, then fully removed before checkpoint:

| Prefix | Location | Purpose |
|---|---|---|
| `[PREVIEW-DIAG]` | `frontend/app/[locale]/app/page.tsx` | Browser bundle marker, preview lifecycle tracing |
| `[PREVIEW-START-DIAG]` | `services/container-manager/src/preview/preview.service.ts` | Server-side start/status tracing |
| `[PREVIEW-START-DIAG]` | `services/api-gateway/src/preview/preview.controller.ts` | Upstream proxy response tracing |

Also removed:

- `readResponseBodyForDiagnostics` helper
- `BUNDLE MARKER` console log

**No diagnostic logs remain in production source.**

---

## Final Behavior

- After AI file actions are approved and applied, preview auto-starts without requiring browser/app Preview Refresh.
- If `POST /start` returns transient 400, frontend polls `GET /status` briefly.
- If status becomes `running: true`, frontend sets preview URL and iframe loads.
- If status never becomes running within the polling window, state falls back to `unavailable`.
- Manual Start Preview and Refresh behavior are preserved.
- No user-facing UX text changed.
- No `frontend/messages/*.json` changes.

---

## Validation Results

### Frontend typecheck

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
```

Result: **PASS**

### Frontend focused tests

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- --testPathPattern="workspace-shell"
```

Result: **PASS — 637/637**

### Frontend build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
```

Result: **PASS**

### Container-manager build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

Result: **PASS**

### API-gateway build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

Result: **PASS**

### ReadLints

Result: **PASS — no errors on touched files**

---

## Live Browser Smoke

**Result: PASS**

Smoke result:

| Check | Result |
|---|---|
| Auto-start after Apply | yes |
| Needed Refresh | no |
| Index loaded | yes |
| JS loaded | yes |
| Navigation works | yes |
| Back to index works | yes |
| Start Preview after auto-start | ok |
| Refresh works | yes |
| Visible error | none |

**CSS note:** One smoke run did not visibly show CSS styling, but a previous run did. This is not considered a PREVIEW-AUTOSTART failure because index loaded, JS loaded, navigation worked, and preview auto-started without Refresh. CSS visibility depends on generated file/link/style content and is better covered by PREVIEW-STATIC-01B / static asset routing if needed.

---

## Non-Goals Respected

- No backend preview behavior changes in final locked code
- No api-gateway behavior changes in final locked code
- No container-manager behavior changes in final locked code
- No static preview routing changes
- No broad preview redesign
- No new preview settings UI
- No database schema changes
- No AI-CONTEXT changes
- No user-facing UX text changes
- No `frontend/messages/*.json` changes
- No git commit/push steps

---

## Separate Issue Discovered (Out of Scope)

Browser-level refresh while inside a project may return to home. This is separate from preview auto-start and was not included in this task.

**Candidate future task:** `APP-ROUTE-RESTORE-01A` — Preserve Workspace Route/Session After Browser Reload.

---

## Rollback Guidance

To revert PREVIEW-AUTOSTART-01A frontend behavior:

1. In `frontend/app/[locale]/app/page.tsx`:
   - Remove `pollPreviewStatusUntilRunning`
   - Remove `PREVIEW_START_STATUS_POLL_MAX_ATTEMPTS` and `PREVIEW_START_STATUS_POLL_DELAY_MS`
   - Restore prior `refreshPreviewForSession` and `handleStartPreview` behavior that immediately set `unavailable` after failed `POST /start`
   - Optionally revert earlier slices if full rollback is required:
     - `refreshPreviewForSession(executionSessionId)` without `true`
     - `consumeExecutionFileActions` overwrite behavior
2. In `frontend/components/workspace/workspace-shell.test.tsx`:
   - Revert source-assertion tests added for status polling and diagnostic removal

No backend rollback is required for runtime behavior because final backend files match pre-diagnostic behavior.

---

## Next Recommended Slice

**PREVIEW-STATIC-01B** — Static Preview Subdirectory Proxy Routing

Return to PREVIEW-STATIC-01B consolidation/closure. PREVIEW-AUTOSTART-01A is complete; remaining PREVIEW family work should focus on static subdirectory asset/page routing and any outstanding smoke for CSS/asset loading.

Do not fold the separate browser refresh routing issue into PREVIEW-STATIC-01B unless explicitly registered.

---

**Reference:** See `TASKS.md` → PREVIEW-AUTOSTART-01A. See `TASKS_BACKLOG_FULL.md` → PREVIEW-AUTOSTART-01A.
