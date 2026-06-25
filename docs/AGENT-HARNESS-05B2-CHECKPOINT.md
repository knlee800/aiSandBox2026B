# AGENT-HARNESS-05B2 Checkpoint — Browser Smoke Handler Implementation

**Task ID:** AGENT-HARNESS-05B2
**Title:** Browser Smoke Handler Implementation
**Status:** COMPLETE and LOCKED
**Checkpoint Date:** 2026-06-23

---

## Scope Confirmation

Implementation was bounded to three services: container-manager, api-gateway, and ai-service.

No frontend, database schema, package/dependency, or Docker image build files were modified. No live browser automation was run. No Docker image build was run. No checkpoint existed before this consolidation step.

---

## Problem / Objective Summary

**Problem:** AGENT-HARNESS-05B1 prepared the browser-capable sandbox image strategy (`Dockerfile.workspace-browser`, `governance.config.ts`, `docker-runtime.service.ts`) without implementing the `browser_smoke` tool handler. The handler path — from ai-service through API Gateway to container-manager to the workspace container — remained unimplemented.

**Objective:** Implement the complete `browser_smoke` handler path with strict safety gates, mocked-only unit tests, URL restriction, output truncation, and no live browser execution. The tool must only be available when `enableToolLoop === true` AND `enableBrowserSmoke === true` and must not be treated as a mutating tool.

---

## Architecture / Security Review Summary

Before implementation the following was confirmed:

- **Preview resolution:** `PreviewProxyService.getProxyTarget(sessionId)` provides the internal container URL (`http://<IP>:<port>`). Browser smoke executes against this target, not via an external public URL.
- **Exec path:** `DockerRuntimeService.execInContainerBySessionId()` is the safe, existing mechanism to run scripts inside containers. Script content is passed via an environment variable (`SMOKE_SCRIPT`), not by writing temp files into the workspace.
- **URL restriction:** Only relative paths (starting with `/`) are accepted. Absolute URLs and any value containing `://` are rejected at both the handler level (ai-service) and service level (container-manager) before any HTTP call or exec is issued.
- **Service boundary:** ai-service → API Gateway → container-manager → workspace container. ai-service never calls container-manager directly.
- **No module isolation needed:** `BrowserSmokeService` is provided directly within `SessionsModule` to access both `DockerRuntimeService` (from `DockerModule`) and `PreviewProxyService` without circular dependencies.
- **Tool registry gating:** `enabled: true` and `implementationStatus: 'implemented'` in the registry are metadata. The operative gate is handler registration in `WorkerProcessor` which is conditional on `enableBrowserSmoke`.
- **Adapter exposure:** Tool definitions are not re-filtered to adapters per-request in the current loop design; the `WorkerProcessor` registration gate is sufficient to prevent `browser_smoke` from being dispatched when disabled.
- **Non-mutating:** `browser_smoke` does not modify workspace files, does not trigger pre-apply checkpoint, and is not added to `mutatingToolNames`.

---

## Implementation Summary

Implemented the complete `browser_smoke` handler path through:

```
ai-service (createBrowserSmokeHandler)
  → ApiGatewayHttpClient.runBrowserSmoke()
    → POST /api/internal/workspace/:sessionId/browser-smoke (API Gateway)
      → ContainerManagerHttpClient.runBrowserSmoke()
        → POST /api/internal/sessions/:id/browser-smoke (container-manager)
          → BrowserSmokeService.run()
            → DockerRuntimeService.execInContainerBySessionId()
              → Playwright headless chromium inside workspace container
```

Key implementation decisions:

- **Script injection via env var:** The Playwright smoke script (`SMOKE_SCRIPT`) is passed as an environment variable to `sh -c 'echo "$SMOKE_SCRIPT" | node'`. No temp files are written into the workspace.
- **URL defaults to `/`** when not provided or when an empty string is passed.
- **Output truncation:** consoleErrors max 10 entries / 500 chars each; consoleWarnings max 10 / 500; networkErrors max 10 / 300; visibleTextSnippet max 2000 chars.
- **No screenshots** in this slice. Deferred to a future approved slice.
- **Graceful failure:** If preview is missing, container is not browser-capable, exec fails, or JSON parsing fails, `BrowserSmokeService` returns a structured `BrowserSmokeResult` with `success: false` — it does not throw raw internals to callers.
- **`browser_smoke` is NOT in `mutatingToolNames`.**
- **Handler registered only inside double-gated harness branch:** `harnessVersion === 'v1'` AND `enableToolLoop === true` AND `enableBrowserSmoke === true`.

---

## Exact Files Changed

### Created

| File | Description |
|------|-------------|
| `services/container-manager/src/browser-smoke/browser-smoke.service.ts` | Core browser smoke service: URL validation, Playwright script env-var injection, exec, output truncation, structured result |
| `services/container-manager/src/browser-smoke/browser-smoke.service.spec.ts` | Unit tests: success, exec failure, missing preview, invalid URL, truncation, env-var injection |
| `services/ai-service/src/agent-harness/tools/handlers/browser-smoke-tool-handlers.ts` | `createBrowserSmokeHandler` factory: URL validation, delegates to `ApiGatewayHttpClient.runBrowserSmoke()` |
| `services/ai-service/src/agent-harness/tools/handlers/browser-smoke-tool-handlers.spec.ts` | Unit tests: success, default URL, absolute URL rejection, failure propagation, timeout propagation |

### Modified

| File | Change |
|------|--------|
| `services/container-manager/src/sessions/sessions.module.ts` | Added `BrowserSmokeService` to providers |
| `services/container-manager/src/sessions/internal-sessions.controller.ts` | Injected `BrowserSmokeService`; added `POST /api/internal/sessions/:id/browser-smoke` |
| `services/container-manager/src/sessions/internal-sessions.controller.spec.ts` | Added mock for `BrowserSmokeService`; added endpoint tests |
| `services/api-gateway/src/clients/container-manager-http.client.ts` | Added `runBrowserSmoke()` method and `BrowserSmokeResult` interface |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | Added `POST /api/internal/workspace/:sessionId/browser-smoke` delegating to client |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | Added `runBrowserSmoke()` method and `BrowserSmokeResult` interface |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | `browser_smoke`: `enabled: true`, `implementationStatus: 'implemented'`, `requiresApproval: false`, `inputSchema` uses `url?: string`, tags updated to `['browser', 'read-only']` |
| `services/ai-service/src/worker/worker.processor.ts` | Imported `createBrowserSmokeHandler`; conditional registration gated by `enableBrowserSmoke` |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Added tests for `enableBrowserSmoke` gate; confirmed `browser_smoke` not in `mutatingToolNames` |
| `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts` | Updated assertions for `browser_smoke` enabled/implemented/schema state |
| `services/ai-service/src/ai-execution/adapters/__tests__/adapter-tool-use.mapper.spec.ts` | Updated disabled/planned assertion to use `start_preview` (still planned) after `browser_smoke` became implemented |

---

## Container-Manager BrowserSmokeService Behavior

- Accepts `sessionId`, optional `url` (relative path only), optional `timeoutMs`.
- Rejects absolute URLs and any value containing `://` before proceeding.
- Resolves the internal preview target via `PreviewProxyService.getProxyTarget(sessionId)`.
- If no preview target is available, returns `{ success: false, error: 'No preview target available' }`.
- Builds a full URL: `<proxyTarget><url>`.
- Executes Playwright headless chromium inside the container via `DockerRuntimeService.execInContainerBySessionId()`.
- Script is passed entirely via the `SMOKE_SCRIPT` env var; `SMOKE_URL` and `SMOKE_TIMEOUT_MS` are separate env vars.
- Parses structured JSON from stdout.
- Applies truncation: consoleErrors (10 × 500), consoleWarnings (10 × 500), networkErrors (10 × 300), visibleTextSnippet (2000 chars).
- If exec fails, script produces non-JSON, or parsing fails: returns structured `{ success: false, error: ... }`.
- Does not throw raw internals to callers.

---

## API Gateway Proxy / Client Behavior

- `ContainerManagerHttpClient.runBrowserSmoke(sessionId, url?, timeoutMs?)`: POST to `POST /api/internal/sessions/:id/browser-smoke` on container-manager with `X-Internal-Service-Key`.
- `InternalWorkspaceFilesController`: `POST /api/internal/workspace/:sessionId/browser-smoke` — receives `{ url?, timeoutMs? }` body, delegates directly to `ContainerManagerHttpClient.runBrowserSmoke()`, returns `BrowserSmokeResult`.

---

## ai-service Client / Handler Behavior

- `ApiGatewayHttpClient.runBrowserSmoke(sessionId, url?, timeoutMs?)`: POST to `POST /api/internal/workspace/:sessionId/browser-smoke` with `X-Internal-Service-Key`.
- `createBrowserSmokeHandler({ client, sessionId, browserSmokeTimeoutMs })`:
  - Validates `url` arg: defaults to `/`, rejects absolute URLs and non-relative paths before making any HTTP call.
  - Calls `client.runBrowserSmoke(sessionId, url, browserSmokeTimeoutMs)`.
  - Returns structured result. Does not trigger checkpoint logic.

---

## Tool Registry Changes

`browser_smoke` in `AGENT_HARNESS_TOOL_DEFINITIONS_V1`:

| Field | Before | After |
|-------|--------|-------|
| `inputSchema` | `{ scenario: string }` | `{ url?: string }` |
| `enabled` | `false` | `true` |
| `implementationStatus` | `'planned'` | `'implemented'` |
| `requiresApproval` | `true` | `false` |
| `riskLevel` | `'high'` | `'high'` (unchanged) |
| `tags` | `['browser', 'planned', 'metadata-only']` | `['browser', 'read-only']` |

---

## WorkerProcessor Gating Behavior

```
if (harnessVersion === 'v1' && enableToolLoop) {
  // ... file/validation handlers always registered ...
  if (enableBrowserSmoke) {
    dispatcher.registerHandler('browser_smoke', createBrowserSmokeHandler(...));
  }
}
```

- `enableBrowserSmoke` defaults to `false` in `DEFAULT_AGENT_HARNESS_CONFIG_V1`.
- `browser_smoke` is **not** in `mutatingToolNames` — it does not trigger pre-apply checkpoint.
- Existing file tools and validation runner behavior is unchanged.

---

## Tests Added / Updated

### container-manager

| Spec | Tests | Result |
|------|-------|--------|
| `browser-smoke.service.spec.ts` | success parses JSON; exec failure returns structured failure; missing preview returns structured failure; absolute URL rejected; truncation enforced; env-var injection verified | PASS |
| `internal-sessions.controller.spec.ts` | added: `runBrowserSmoke` delegation; invalid URL handling | PASS |

### api-gateway

| Spec | Tests | Result |
|------|-------|--------|
| `internal-workspace-files.controller.spec.ts` | 24 existing tests (delegation, validation) | PASS |

### ai-service

| Spec | Tests | Result |
|------|-------|--------|
| `browser-smoke-tool-handlers.spec.ts` | success; default URL; absolute URL rejection; failure propagation; timeout propagation | PASS |
| `tool-registry.spec.ts` | updated: `browser_smoke` enabled/implemented/schema/read-only assertions | PASS |
| `worker.processor.spec.ts` | added: `enableBrowserSmoke` gate test; `browser_smoke` not in `mutatingToolNames`; not registered when disabled | PASS |
| `adapter-tool-use.mapper.spec.ts` | updated: disabled/planned assertion now uses `start_preview` (still planned) | PASS |

---

## Validation Commands and Results

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
# Result: PASS

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test
# Result: PASS — all tests

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
# Result: PASS

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test
# Result: PASS all relevant unit tests
# Note: 12 pre-existing integration test failures (DB-dependent, require live PostgreSQL)
#       These failures existed before AGENT-HARNESS-05B2 and are NOT introduced by this task.

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
# Result: PASS

Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test
# Result: PASS all relevant unit tests
# Note: 1 pre-existing app.module.spec failure (requires live PostgreSQL)
#       This failure existed before AGENT-HARNESS-05B2 and is NOT introduced by this task.
```

**Touched spec results (all PASS):**

| Spec | Tests |
|------|-------|
| `browser-smoke.service.spec.ts` | PASS |
| `internal-sessions.controller.spec.ts` | PASS |
| `internal-workspace-files.controller.spec.ts` | PASS — 24 tests |
| `browser-smoke-tool-handlers.spec.ts` | PASS |
| `tool-registry.spec.ts` | PASS |
| `worker.processor.spec.ts` | PASS |
| `adapter-tool-use.mapper.spec.ts` | PASS |

---

## Explicit Confirmations

- [x] No live browser automation was run.
- [x] No Docker image build was run.
- [x] No package/dependency files were changed.
- [x] No frontend or UI files were changed.
- [x] No database schema changes were made.
- [x] `browser_smoke` is **not** in `mutatingToolNames`.
- [x] `browser_smoke` handler is registered **only** when `enableToolLoop === true` AND `enableBrowserSmoke === true`.
- [x] `enableBrowserSmoke` default remains `false`.
- [x] No checkpoint document existed before this consolidation step.
- [x] TASKS.md and TASKS_BACKLOG_FULL.md were not modified during implementation.

---

## Known Limitations and Deferred Work

- **Live browser smoke not validated.** The handler path is fully implemented and unit-tested with mocks, but no end-to-end execution against a real running container has been verified. This is intentional — live browser smoke requires Keith's explicit approval.
- **Docker image build not run.** `Dockerfile.workspace-browser` exists (from 05B1) but the image has not been built or pushed. Playwright/Chromium runtime availability inside containers remains unvalidated.
- **gVisor/Chromium compatibility.** The compatibility of Playwright headless Chromium with gVisor (runsc) has not been tested. Sandbox flags (`--no-sandbox`, `--disable-setuid-sandbox`) are included in the smoke script but real-world gVisor behavior is unknown until live execution is approved.
- **Screenshots deferred.** No screenshot capture was implemented in this slice.

---

## Next Recommended Task

**AGENT-HARNESS-05B3** (or equivalent): Live browser smoke validation and Docker image build verification.

- Registration only first. Do not implement until registered and explicitly approved by Keith.
- Scope should include: Docker image build for `aisandbox-workspace-browser:local`, live end-to-end smoke test against a real session, gVisor/Chromium compatibility verification, and screenshot capture if approved.

---

## Locked Invariants

The following behaviors established by this checkpoint must be preserved by all future tasks:

- `browser_smoke` is non-mutating and must never be added to `mutatingToolNames`.
- `browser_smoke` handler registration is gated by `enableBrowserSmoke`; default remains `false`.
- Browser execution happens only through container-manager; ai-service must never call container-manager directly.
- Only relative URL paths (`/...`) are accepted; absolute URLs are rejected at every layer.
- Script content is injected via env var only — no temp-file writes into the workspace.
- Output artifacts (consoleErrors, consoleWarnings, networkErrors, visibleTextSnippet) are always truncated before being returned to the model.
