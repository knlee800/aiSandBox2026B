# PREV-02-02 CHECKPOINT

## Task Metadata

- Task ID: PREV-02-02
- Title: Fix Static HTML Preview Entry File Selection
- Nature: BUG FIX (PREVIEW PATH, STATIC HTML ENTRYPOINT)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/PREV-02-02-CHECKPOINT.md`

## Objective

Fix static HTML preview so sessions with an HTML file other than `index.html` do not start preview successfully and then fail with 500 when proxy tries to serve missing `index.html`.

## Root Cause (from PREV-02-01)

Static preview detection and root-path serving were inconsistent:

- Detection accepted any `*.html` file in `/workspace`
- Proxy root path `/` always mapped to `index.html`
- A `hello.html`-only workspace started preview as `running` but failed later at proxy with HTTP 500 (`index.html` missing)

## Fix Applied

Implemented the smallest consistent behavior in `PreviewService`:

1. Static HTML detection now requires `/workspace/index.html` at the workspace root.
2. If HTML files exist but `index.html` is missing, preview start now fails early with a clear HTTP 400 error message.
3. Existing `index.html` behavior is preserved.

### File changed

- `services/container-manager/src/preview/preview.service.ts`

### Exact behavior changes

- Added `hasIndexHtmlInSessionWorkspace()` using:
  - `[ -f /workspace/index.html ]`
- Updated `detectFramework()`:
  - Uses `hasIndexHtmlInSessionWorkspace()` for Static HTML eligibility
  - Falls back to `hasAnyHtmlInSessionWorkspace()` only to emit a missing-index marker (`framework: 'Static HTML (missing-index)'`)
- Updated `startPreview()`:
  - If `detectFramework()` returns no command with `framework === 'Static HTML (missing-index)'`, throws:
    - `BadRequestException('Static HTML preview requires /workspace/index.html at the workspace root.')`

No changes were made to routing, proxy model, path sanitization, or workspace architecture.

## Validation

### 1) Focused build/type-check

Command:

- `services/container-manager`: `npm run build`

Result:

- PASS (`tsc` completed with no errors)

### 2) Lint check on changed file

Action:

- `ReadLints` for `services/container-manager/src/preview/preview.service.ts`

Result:

- No linter errors

### 3) Runtime validation — `index.html` workspace (preserved behavior)

Flow:

- Register/login test user
- Create session
- Write `/workspace/index.html`
- `GET /api/preview/:sessionId/status`
- `POST /api/preview/:sessionId/start`
- `GET /api/preview/:sessionId/status`
- `GET /api/preview/:sessionId/proxy`

Observed:

- Status before start: `{"running":false,"message":"No active preview for this session"}`
- Start: `{"success":true,"status":"running","framework":"Static HTML",...}`
- Status after start: `running:true`
- Proxy: HTTP 200 with expected HTML body

### 4) Runtime validation — `hello.html`-only workspace (fixed behavior)

Flow:

- Register/login test user
- Create session
- Write `/workspace/hello.html` (no `index.html`)
- `GET /api/preview/:sessionId/status`
- `POST /api/preview/:sessionId/start`
- `GET /api/preview/:sessionId/status`

Observed:

- Status before start: `running:false`
- Start: HTTP 400 (no misleading success/running)
- Raw response body:
  - `{"message":"Static HTML preview requires /workspace/index.html at the workspace root.","error":"Bad Request","statusCode":400}`
- Status after start: still `running:false`

This confirms the previous misleading `start success + proxy 500` path no longer occurs for hello-only workspaces.

## Scope and Invariants Preserved

- Existing `index.html` static preview behavior preserved
- Existing preview status/proxy model preserved
- No preview redesign
- No routing redesign
- No workspace redesign
- No scope expansion
