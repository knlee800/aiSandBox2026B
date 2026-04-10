# PREV-01-01 CHECKPOINT

## Task Metadata

- Task ID: PREV-01-01
- Title: Diagnose Preview Unavailable For AI-Created Files
- Nature: BUG INVESTIGATION (PREVIEW PATH, CORE WORKSPACE USABILITY)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PREV-01-01-CHECKPOINT.md`

## Objective

Determine why preview remains unavailable after AI creates files, and isolate whether preview correctly requires a running dev server or is failing to detect/serve a valid previewable output.

## Exact Commands / Actions / Checks Run

1. Read required governance/task/checkpoint context:
   - `CLAUDE.md`
   - `TASKS.md` (PREV-01 section)
   - `TASKS_BACKLOG_FULL.md` (PREV-01-01 entry)
   - `docs/REL-01-02-CHECKPOINT.md`
   - `docs/ADV-03-01-CHECKPOINT.md`
   - `docs/AI-05-02-CHECKPOINT.md`
2. Inspected preview code paths:
   - Frontend:
     - `frontend/app/[locale]/app/page.tsx`
     - `frontend/components/workspace/workspace-preview.logic.ts`
     - `frontend/components/workspace/workspace-shell.tsx`
   - API gateway:
     - `services/api-gateway/src/preview/preview.controller.ts`
   - Container manager preview paths:
     - `services/container-manager/src/preview/preview.controller.ts`
     - `services/container-manager/src/preview/preview.service.ts`
     - `services/container-manager/src/sessions/sessions.module.ts`
     - `services/container-manager/src/previews/preview.service.ts`
     - `services/container-manager/src/previews/previews.controller.ts`
     - `services/container-manager/src/previews/preview-proxy.service.ts`
3. Verified live stack:
   - `Invoke-WebRequest http://localhost:4000/api/health`
4. Reproduced real scenario via normal API path:
   - Register/login user
   - `POST /api/sessions` (active session)
   - `POST /api/ai/execute` with file-create prompt for `index.html`
   - Poll `GET /api/ai/executions/:executionId` until completed
   - Apply resulting file action via existing write path:
     - `POST /api/sessions/:id/files/write`
   - Confirm file exists:
     - `POST /api/sessions/:id/files/read` (`index.html`)
   - Check preview:
     - `GET /api/preview/:sessionId/status`
     - `GET /api/preview/:sessionId/proxy`
5. Additional targeted checks for gating behavior:
   - Tried explicit preview start:
     - `POST /api/preview/:sessionId/start`
   - Started a dev server inside session container using existing exec path:
     - `POST /api/sessions/:id/exec` with `httpd -f -p 3000 -h /workspace`
   - Rechecked preview status/proxy after server start.
6. Minimal runtime filesystem evidence:
   - `docker exec sandbox-session-<sessionId> ls -la /workspace && cat /workspace/index.html`
   - `docker exec aisandbox-container-manager ls -la /workspaces/<sessionId>`

## Smallest Evidence Set

### A) AI-created previewable file exists, but preview remains unavailable

- AI execution completed with non-empty file action:
  - `{"action":"create","path":"index.html","content":"..."}`
- File write path applied successfully.
- File read confirms presence:
  - `POST /api/sessions/:id/files/read` returned `index.html` content.
- Preview status still:
  - `GET /api/preview/:sessionId/status` -> `{"running":false,"message":"No active preview for this session"}`
- Preview proxy still:
  - `GET /api/preview/:sessionId/proxy` -> HTTP `503`.

### B) Even starting a dev server in-session does not make preview available

- Exec succeeded:
  - `POST /api/sessions/:id/exec` with `httpd -f -p 3000 -h /workspace` -> `exitCode=0`.
- Preview status remained unchanged:
  - `{"running":false,"message":"No active preview for this session"}`
- Preview proxy remained HTTP `503`.

### C) Explicit preview start endpoint fails on static HTML scenario

- `POST /api/preview/:sessionId/start` returned HTTP `400` with:
  - `{"message":"No package.json or start command found. Cannot start preview.","error":"Bad Request","statusCode":400}`

### D) Filesystem mismatch evidence

- Session container contains `index.html`:
  - `/workspace/index.html` exists.
- Container-manager workspace directory used for preview auto-detection is empty:
  - `/workspaces/<sessionId>` has no `index.html`.

## Exact Preview Gating Condition Identified

Frontend marks preview as available only when:

1. `GET /api/preview/:sessionId/status` is HTTP 200, and
2. response has `running === true` (exact check in `isPreviewRunning()`).

In current backend path (`services/container-manager/src/preview/preview.controller.ts`):

- `running` is true only when `PreviewService.getPreviewStatus(sessionId)` finds an entry in `activePreviews`.
- `activePreviews` is populated only by `POST /api/preview/:sessionId/start` (startPreview path), not by AI file creation, file write operations, or in-session dev-server execution.

## Exact Failing Stage

The failing stage is **preview availability source/gating**, not AI file creation:

1. AI file creation path can create/apply `index.html`.
2. Preview status path ignores file presence and ignores in-session running servers.
3. Preview status depends on internal `activePreviews` process tracking.
4. Therefore UI correctly shows "Preview unavailable" for this backend contract, even when previewable files exist and even when a server is started in-session.

Additionally, explicit start can fail for static HTML because command detection reads container-manager workspace state, which did not reflect files written in the session container in this environment.

## Conclusion

Diagnosis is complete and bounded:

- The observed "Preview unavailable" scenario is caused by current preview gating contract (`running === true` from active preview process tracking), not by parser/frontend-state bugs in AI file creation.
- The issue is narrowed to one bounded follow-up task: align preview status source with actual session-preview source-of-truth (or explicitly confirm and document that preview requires a separate preview-start flow and cannot rely on in-session server/file presence).
