# AGENT-HARNESS-05B5 Checkpoint

**Task ID:** AGENT-HARNESS-05B5
**Title:** Browser Smoke End-to-End Service-Chain Validation
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-26
**Nature:** LIVE VALIDATION / SERVICE-CHAIN SMOKE / BROWSER AUTOMATION / END-TO-END PASS

---

## Prior Blocker and Prerequisite Resolution

### Original Blocker (from AGENT-HARNESS-05B5 planning)

AGENT-HARNESS-05B5 planning produced a phase-by-phase live validation plan but identified a prerequisite blocker before any live command was run.

**Blocker:** `SessionsService.startSessionContainer()` called `DockerRuntimeService.createContainer()` without `{ browserCapable: true }`. The normal session start path always created a standard `node:20-alpine` container. No exposed API endpoint created a browser-capable container through the platform's own session boundary.

**Impact:** The real end-to-end `browser_smoke` service-chain validation could not prove the intended product/runtime flow because the platform could not create browser-capable sessions through its own internal session start path.

### Prerequisite Resolution — AGENT-HARNESS-05B5A (COMPLETE and LOCKED)

AGENT-HARNESS-05B5A resolved the blocker before AGENT-HARNESS-05B5 live execution began.

**Changes made by 05B5A:**
- `SessionsService.startSessionContainer()` extended with optional `options?: { browserCapable?: boolean }` third parameter. When `options?.browserCapable === true`, passes `{ browserCapable: true }` to `DockerRuntimeService.createContainer()`.
- New internal route `POST /api/internal/sessions/:id/start` added to `InternalSessionsController`, accepting `{ userId?: string, browserCapable?: boolean }`, protected by class-level `InternalServiceAuthGuard` (`X-Internal-Service-Key`).
- Public `SessionsController` not modified. No public route exposes `browserCapable`.
- Tests: 9/9 controller, 6/6 service, 28/28 docker-runtime regression, 90/90 full suite. TypeScript build clean.

**Checkpoint:** `docs/AGENT-HARNESS-05B5A-CHECKPOINT.md`

With the prerequisite resolved, AGENT-HARNESS-05B5 live validation proceeded using `POST /api/internal/sessions/:id/start` with `{ browserCapable: true }` as the session creation path.

---

## Validation Objective

Run a live end-to-end service-chain smoke test confirming:

- Platform services are reachable and healthy.
- The browser-capable workspace image (`aisandbox-workspace-browser:local`) exists in Docker.
- Playwright resolves via `NODE_PATH=/opt/browser-smoke/node_modules` (established by AGENT-HARNESS-05B4).
- A browser-capable session can be created through the platform's own internal session start path.
- A minimal preview app can be served inside that session container.
- `browser_smoke` can be invoked through the full service chain: API Gateway → container-manager → workspace container → Playwright Chromium → structured BrowserSmokeResult.
- The final structured result is returned with all expected fields correct.

---

## Validated Service-Chain Architecture

```
API Gateway (port 4000)
  → POST /api/internal/workspace/{sessionId}/browser-smoke
    → ContainerManagerHttpClient
      → container-manager (port 4002)
        → BrowserSmokeService
          → Docker exec into sandbox-session-{sessionId}
            → Node script: require('/opt/browser-smoke/node_modules/playwright')
              → Playwright Chromium (headless, --no-sandbox)
                → Preview target: http://{containerIP}:3000/
                  → BrowserSmokeResult { success, url, pageTitle, visibleTextSnippet, ... }
```

Session creation path (prerequisite, validated via AGENT-HARNESS-05B5A):
```
POST /api/internal/sessions/{sessionId}/start  { browserCapable: true }
  → InternalSessionsController (X-Internal-Service-Key required)
    → SessionsService.startSessionContainer(..., { browserCapable: true })
      → DockerRuntimeService.createContainer(..., { browserCapable: true })
        → Container image: aisandbox-workspace-browser:local
          → ENV: NODE_PATH=/opt/browser-smoke/node_modules
```

---

## Executed Phases and Results

### Phase 1 — Prerequisites

**Objective:** Confirm required platform components are present and reachable.

| Item | Result |
|------|--------|
| Docker daemon | Reachable — Docker version 29.2.1 |
| Browser image | `aisandbox-workspace-browser:local` exists — sha256:ddf44d... |
| Postgres (`aisandbox-postgres`) | Running |
| Redis (`aisandbox-redis`) | Running |
| Port 4000 (API Gateway) | Listening |
| Port 4002 (container-manager) | Listening |
| `INTERNAL_SERVICE_KEY` | Set |
| Pre-existing `sandbox-session-05b5-smoke-test` | None found |

**Verdict: PASS**

---

### Phase 2 — Browser Image Readiness

**Objective:** Confirm the browser image Playwright installation is functional.

| Item | Result |
|------|--------|
| Playwright package version | 1.60.0 |
| Absolute require path | `require('/opt/browser-smoke/node_modules/playwright')` resolves |
| Chromium `data:` URL launch | `browser-smoke-ok` |

**Verdict: PASS**

---

### Phase 3 — Service Readiness

**Objective:** Confirm API Gateway and container-manager are healthy and Docker-connected.

| Item | Result |
|------|--------|
| api-gateway | Running on port 4000 |
| `GET /api/health` (api-gateway) | PASS |
| container-manager | Running on port 4002 |
| `GET /api/internal/stats` (container-manager) | PASS — `dockerConnectivity: true` |

**Note:** container-manager startup logs advertise `http://localhost:4002/api/health`, but that route does not exist and returns 404. The real readiness endpoint `/api/internal/stats` was used for validation. This is recorded as a follow-up recommendation (see section below). It did not block validation.

**ai-service:** Not started. Not in scope for this validation.

**Verdict: PASS**

---

### Phase 4 — Browser-Capable Session Creation

**Objective:** Create a browser-capable session via the platform's own internal session start path (established by AGENT-HARNESS-05B5A).

**Request:**
```
POST http://localhost:4002/api/internal/sessions/05b5-smoke-test/start
Body: { "browserCapable": true }
```

**Response:**
```json
{ "message": "Session container started successfully" }
```

**HTTP status:** 200

**Docker inspect confirmation:**
- Container running
- Image: `aisandbox-workspace-browser:local`
- ENV: `NODE_PATH=/opt/browser-smoke/node_modules`

**Note:** A pre-existing userId / SQLite FOREIGN KEY issue was encountered when using `userId: "validation-user"` in the request body. This issue predates 05B5 and is not a browser-smoke regression. The validation proceeded after handling the required DB state. This is recorded as a separate follow-up recommendation (see section below). No manual `docker run` or container replacement was used.

**Verdict: PASS** — Browser-capable session created through the platform's own service boundary.

---

### Phase 5 — Minimal Preview Target

**Objective:** Establish a minimal HTTP preview server inside the session container for Chromium to navigate to.

**Method:** `server.js` written through container-manager internal file-write endpoint.

**Response:** HTTP 204

**Server started:** Through container-manager internal exec endpoint.
- exec `exitCode`: 0
- `stdout`: `Preview server running on port 3000`

**In-container verification confirmed HTML:**
- `<title>05B5 Smoke</title>`
- `<body>Hello from 05B5</body>`

**Verdict: PASS**

---

### Phase 6 — Preview Registration

**Objective:** Register port 3000 as the session's preview target so BrowserSmokeService can resolve the container IP.

**Request:**
```
POST http://localhost:4002/api/internal/sessions/05b5-smoke-test/previews
Body: { "port": 3000 }
```

**Response:**
```json
{ "sessionId": "05b5-smoke-test", "port": 3000, "registered": true }
```

**Verdict: PASS**

---

### Phase 7 — browser_smoke Through API Gateway

**Objective:** Invoke the full service-chain browser smoke through the API Gateway internal proxy.

**Request:**
```
POST http://localhost:4000/api/internal/workspace/05b5-smoke-test/browser-smoke
Body: { "url": "/", "timeoutMs": 30000 }
```

**HTTP status:** 200

**Full BrowserSmokeResult:**
```json
{
  "success": true,
  "url": "http://172.17.0.2:3000/",
  "pageTitle": "05B5 Smoke",
  "consoleErrors": [],
  "consoleWarnings": [],
  "networkErrors": [],
  "visibleTextSnippet": "Hello from 05B5",
  "durationMs": 564,
  "truncated": false
}
```

**Verdict: PASS**

---

### Phase 8 — Not Executed

Phase 8 (BullMQ/provider/model/ai-service chain validation) was explicitly not run. It is outside the scope of this validation slice. The service-chain validation is complete at Phase 7.

---

## Service Status Summary

| Service | Status |
|---------|--------|
| Docker daemon | Running (v29.2.1) |
| aisandbox-workspace-browser:local | Exists — sha256:ddf44d... |
| aisandbox-postgres | Running |
| aisandbox-redis | Running |
| api-gateway (port 4000) | Running, healthy |
| container-manager (port 4002) | Running, healthy |
| ai-service | Not started (out of scope) |

---

## Browser-Capable Session Creation Summary

| Item | Value |
|------|-------|
| Session ID | `05b5-smoke-test` |
| Route | `POST /api/internal/sessions/05b5-smoke-test/start` |
| Body | `{ "browserCapable": true }` |
| Guard | `InternalServiceAuthGuard` (`X-Internal-Service-Key`) |
| HTTP status | 200 |
| Response | `{ "message": "Session container started successfully" }` |
| Container image (docker inspect) | `aisandbox-workspace-browser:local` |
| NODE_PATH (docker inspect) | `/opt/browser-smoke/node_modules` |
| Manual `docker run` used | No |

---

## Container Image and NODE_PATH Verification

The container created by the internal session start route was confirmed via `docker inspect` to use:
- Image: `aisandbox-workspace-browser:local` (fixed by AGENT-HARNESS-05B4)
- Environment: `NODE_PATH=/opt/browser-smoke/node_modules` (fixed by AGENT-HARNESS-05B4)

This confirms the full image-wiring path from AGENT-HARNESS-05B4's Dockerfile remediation through to a running session container created via the AGENT-HARNESS-05B5A internal session start route.

---

## Preview Target Setup and Verification

| Item | Value |
|------|-------|
| File | `server.js` |
| Write method | container-manager internal file-write endpoint |
| HTTP status for write | 204 |
| Start method | container-manager internal exec endpoint |
| exec exitCode | 0 |
| stdout | `Preview server running on port 3000` |
| In-container HTML title | `05B5 Smoke` |
| In-container HTML body | `Hello from 05B5` |
| Port | 3000 |

---

## Preview Registration Result

| Item | Value |
|------|-------|
| Route | `POST /api/internal/sessions/05b5-smoke-test/previews` |
| Body | `{ "port": 3000 }` |
| Response | `{ "sessionId": "05b5-smoke-test", "port": 3000, "registered": true }` |

---

## Full BrowserSmokeResult

```json
{
  "success": true,
  "url": "http://172.17.0.2:3000/",
  "pageTitle": "05B5 Smoke",
  "consoleErrors": [],
  "consoleWarnings": [],
  "networkErrors": [],
  "visibleTextSnippet": "Hello from 05B5",
  "durationMs": 564,
  "truncated": false
}
```

All fields verified:
- `success`: `true`
- `url`: resolved container IP and preview port — `http://172.17.0.2:3000/`
- `pageTitle`: `"05B5 Smoke"` — matches preview app `<title>`
- `consoleErrors`: empty array
- `consoleWarnings`: empty array
- `networkErrors`: empty array
- `visibleTextSnippet`: `"Hello from 05B5"` — matches preview app body text
- `durationMs`: 564 — sub-second, clean execution
- `truncated`: `false`

---

## Final Verdict

**PASS**

The full service chain — API Gateway → container-manager → browser-capable workspace container → preview target → Playwright Chromium → structured BrowserSmokeResult — is validated end-to-end. All seven executed phases passed. The browser smoke result is correct, complete, and untruncated.

---

## Cleanup Summary

| Action | Result |
|--------|--------|
| `sandbox-session-05b5-smoke-test` stopped and removed | Confirmed |
| Workspace path `C:\Users\knlee\aiSandBox2026B\workspaces\05b5-smoke-test` | Confirmed removed |
| SQLite: `validation-user` removed from `users` table | Confirmed |
| SQLite: `05b5-smoke-test` removed from `sessions` table | Confirmed |
| Dev services (api-gateway, container-manager, postgres, redis) | Left running per instruction |
| Docker images | Not removed |
| Docker volumes | Not removed |

---

## Confirmation: Phase 8 Not Run

Phase 8 was not executed during this validation. The ai-service BullMQ/provider/model chain was not started or tested. Phase 8 remains available as a future validation slice.

---

## Confirmation: No Source/Runtime/Test/Package/Docker/Frontend/Database Files Changed

No source, runtime, test, package, Docker, frontend, or database files were changed during the AGENT-HARNESS-05B5 validation or this consolidation.

All implementation changes that enabled this validation were made in AGENT-HARNESS-05B5A (COMPLETE and LOCKED) and AGENT-HARNESS-05B4 (COMPLETE and LOCKED).

---

## Follow-Up Recommendations

### Recommendation 1 — container-manager health log / route mismatch

**Observation:** The container-manager startup log advertises `http://localhost:4002/api/health`, but that route does not exist. The endpoint returns HTTP 404. The real readiness endpoint is `GET /api/internal/stats`.

**Impact:** Misleading startup message; operational readiness checks based on the advertised URL will fail silently or require workarounds.

**Recommendation:** Register a small targeted task to either:
- Add `GET /api/health` to container-manager as a real readiness endpoint, or
- Update the startup log to advertise the correct endpoint (`/api/internal/stats` or another existing route).

**Classification:** Not a 05B5 regression. Pre-existing logging discrepancy. Low urgency but increases operational clarity.

---

### Recommendation 2 — InternalSessionsController `userId` / SQLite FOREIGN KEY behavior

**Observation:** When `userId: "validation-user"` was included in the `POST /api/internal/sessions/:id/start` body, a SQLite FOREIGN KEY constraint failure was triggered because the user did not exist in the `users` table. The internal start route's downstream session insert requires a valid user row.

**Impact:** Internal callers that supply a `userId` must ensure the user exists in the database first, or the session creation will fail with a FOREIGN KEY error. If `userId` is omitted, this path is not triggered.

**Recommendation:** Register a targeted investigation or fix task to clarify/resolve the intended behavior:
- Require callers to ensure the user exists first (document as explicit caller contract), or
- Make the internal route avoid session insert responsibility when used for harness/validation purposes, or
- Make the user lookup/association behavior explicit and validated with a targeted test.

**Classification:** Not a browser-smoke regression. Exposed during 05B5 validation. Follow-up required before productizing the internal session start route for callers that supply `userId`.

---

## Locked Invariants

The following invariants are locked by this checkpoint and must not be changed without explicit task authorization and a new checkpoint:

1. The full service-chain path API Gateway → container-manager → browser-capable workspace container → Playwright Chromium → BrowserSmokeResult is validated end-to-end and confirmed working.
2. Browser-capable sessions are created via `POST /api/internal/sessions/:id/start` with `{ browserCapable: true }` and a valid `X-Internal-Service-Key` header (locked by AGENT-HARNESS-05B5A).
3. Playwright Node package is installed at `/opt/browser-smoke/node_modules/playwright` in `aisandbox-workspace-browser:local` and resolves correctly at runtime (locked by AGENT-HARNESS-05B4).
4. `NODE_PATH=/opt/browser-smoke/node_modules` is set as a permanent ENV in the browser workspace image (locked by AGENT-HARNESS-05B4).
5. `BrowserSmokeService` loads Playwright via absolute path `require('/opt/browser-smoke/node_modules/playwright')` (locked by AGENT-HARNESS-05B4).
6. The `browserCapable` opt-in is internal-only and protected by `InternalServiceAuthGuard` (`X-Internal-Service-Key`). No public route exposes it (locked by AGENT-HARNESS-05B5A).
7. Default session creation (without `browserCapable: true`) uses `node:20-alpine` and is unchanged (locked by AGENT-HARNESS-05B5A).
8. Phase 8 (ai-service BullMQ/provider/model chain) was not run and remains available as a future validation slice.

---

## Dependency Chain

```
AGENT-HARNESS-05B3-DEFECT-01 (resolved)
  → AGENT-HARNESS-05B4 (COMPLETE and LOCKED)
      → AGENT-HARNESS-05B5A (COMPLETE and LOCKED)
          → AGENT-HARNESS-05B5 (COMPLETE and LOCKED)
              → Follow-up: container-manager health route/log mismatch
              → Follow-up: userId/SQLite FK behavior on internal start route
```

---

## Next Recommended Task Options

1. **Register a small fix task for the container-manager health log/route mismatch** — Add `GET /api/health` or update the startup log to point to a real readiness endpoint. Small, low-risk, operational clarity improvement.

2. **Register a targeted investigation/fix task for the userId/SQLite FK behavior** on `POST /api/internal/sessions/:id/start` — Clarify the caller contract or adjust the route to avoid FK constraint failures in validation contexts.

3. **Register Phase 8 validation** — BullMQ/provider/model/ai-service chain validation for the full AI-driven browser smoke path. Requires explicit scoping, approval, and a separate task.

Do not register any follow-up task until the next explicit consolidation step.

---

**Lock notice:** AGENT-HARNESS-05B5 is COMPLETE and LOCKED. Do not modify this checkpoint. Do not reopen or re-implement without explicit approval.
