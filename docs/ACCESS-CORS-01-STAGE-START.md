# ACCESS-CORS-01 — Stage-start (frozen design)

Date: 2026-11-06. Approved by Keith in chat on 2026-11-06 ("Approve, admit"). Task body: TASKS_BACKLOG_FULL.md, ACCESS-CORS-01.

## Problem

services/api-gateway/src/main.ts calls app.enableCors({ origin: true, credentials: true }). Any website can send credentialed requests to the gateway and read the replies.

## Why the change is safe

- The browser calls /api on the app's own origin and Next forwards it to the gateway (frontend/next.config.js rewrites). The app does not depend on cross-origin calls.
- Container-manager, the AI service, Next's server-side calls and curl from the host send no Origin header. CORS only adds or omits response headers, so they are unaffected.

## Design

1. New file services/api-gateway/src/cors/http-cors-origin.ts exports resolveHttpCorsOrigin(requestOrigin, callback). It calls resolveSocketCorsOrigin from services/api-gateway/src/websocket/websocket.gateway.ts and passes the result through unchanged, so HTTP and the socket share one rule.
2. main.ts passes origin: resolveHttpCorsOrigin and keeps credentials: true. Nothing else in main.ts changes.
3. websocket.gateway.ts is not changed.

The rule: with APP_BASE_URL set, only its exact origin (scheme, host, port) is allowed and echoed. Any other origin, a missing Origin, or APP_BASE_URL unset, blank or not a URL: callback(null, false), so no allow header. Never true, never the request origin reflected.

## Tests (services/api-gateway/src/cors/)

- allowed origin echoed; another host refused; same host with another port or scheme refused; no Origin refused; APP_BASE_URL unset, blank and invalid refused; APP_BASE_URL restored after each test
- a source test reads src/main.ts and checks it contains resolveHttpCorsOrigin and credentials: true and does not contain origin: true

## Gates

Gateway npm test (only the 14 known runtime-only smoke.integration failures) and npm run build.

## Out of scope

Socket code, guards, CSRF, cookies, frontend, env files, deploy (STAGING-DEPLOY-09 after LOCK).
