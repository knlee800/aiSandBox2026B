# PREV-01-02 CHECKPOINT

## Task Metadata

- Task ID: PREV-01-02
- Title: Fix Preview Start Source Of Truth For Session Workspace
- Nature: BUG FIX (PREVIEW PATH, WORKSPACE SOURCE-OF-TRUTH)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PREV-01-02-CHECKPOINT.md`

## Objective

Fix the preview start/status path so preview availability is determined from the actual session workspace/runtime source of truth, instead of failing when AI-created files exist in the session but preview start checks the wrong workspace source.

## Exact Files Changed

- `services/container-manager/src/preview/preview.service.ts`
- `services/container-manager/src/preview/preview.controller.ts`
- `services/container-manager/src/preview/preview.module.ts`

## Exact Cause

PREV-01-01 showed a source mismatch:

- AI-created `index.html` existed in the real session runtime (`/workspace` in the session container).
- Preview start detection in `services/container-manager/src/preview/preview.service.ts` read from container-manager-local filesystem path, which did not represent the real session runtime source used by file read/write flows.
- Result: `/api/preview/:sessionId/start` could fail with "No package.json or start command found" even when previewable files existed in the session runtime.

## Exact Resolution

Bounded fix in container-manager preview start/status path:

1. **Aligned preview detection source to session runtime**
   - `detectFramework(...)` now inspects session runtime via Docker exec (`/workspace` in the session container), not container-manager-local workspace files.

2. **Aligned preview start execution to session runtime**
   - Preview command launch path uses session-container exec for non-static frameworks.

3. **Kept existing preview status/proxy model endpoints**
   - Preserved `/api/preview/:sessionId/start`, `/status`, and `/proxy` behavior contract.

4. **Added tightly scoped static-HTML proxy fallback**
   - For `framework === "Static HTML"`, start now marks preview running and `/proxy` serves static content directly from session runtime files.
   - This is bounded to static preview availability detection/use and does not redesign frontend or broader preview architecture.

## Validation Run / Evidence

### Build / lint checks

1. `services/container-manager`:
   - `npm run build` -> PASS
2. Changed-file lint diagnostics:
   - `ReadLints` on changed preview files -> no linter errors

### Runtime deploy

1. Rebuilt/restarted container-manager on live stack:
   - `docker compose -f "docker-compose.prod.yml" up -d --build container-manager`

### Reproduced formerly failing PREV-01-01 scenario and revalidated

Flow executed:

1. Create auth/session/api key.
2. Submit AI file-create prompt for `index.html` via `POST /api/ai/execute`.
3. Poll execution status via `GET /api/ai/executions/:executionId`.
4. Apply returned file action via existing write path `POST /api/sessions/:id/files/write`.
5. Verify file exists via `POST /api/sessions/:id/files/read`.
6. Check preview before start: `GET /api/preview/:sessionId/status`.
7. Start preview: `POST /api/preview/:sessionId/start`.
8. Check preview after start: `GET /api/preview/:sessionId/status`.
9. Verify proxy usability: `GET /api/preview/:sessionId/proxy`.

Observed results:

- `AI_STATUS=completed`
- `AI_FILE_ACTIONS_COUNT=1`
- `AI_ACTION_APPLIED=True`
- `INDEX_READ_BODY={"path":"index.html","content":"<!doctype html><html><body><h1>PREV-01-02</h1></body></html>"}`
- `PREVIEW_STATUS_BEFORE={"running":false,"message":"No active preview for this session"}`
- `PREVIEW_START_HTTP=200`
- `PREVIEW_START_BODY={"success":true,"port":3001,"status":"running","framework":"Static HTML","previewUrl":"/api/preview/<sessionId>/proxy"}`
- `PREVIEW_STATUS_AFTER={"running":true,"port":3001,"status":"running","framework":"Static HTML","uptime":2,"previewUrl":"/api/preview/<sessionId>/proxy"}`
- `PREVIEW_PROXY_HTTP=200`
- `PREVIEW_PROXY_BODY=<!doctype html><html><body><h1>PREV-01-02</h1></body></html>`

## Scope Compliance

- In scope only: preview start/status source-of-truth alignment and bounded availability fix.
- Preserved existing preview status/proxy endpoint model.
- No frontend changes.
- No broad preview/workspace redesign.
- No scope expansion.

## Conclusion

PREV-01-02 objective is met: preview start/status now use the correct session runtime source for detection, and the previously failing AI-created `index.html` scenario can start preview coherently and render via `/api/preview/:sessionId/proxy`.
