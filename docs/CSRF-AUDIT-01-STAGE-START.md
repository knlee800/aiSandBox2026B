# CSRF-AUDIT-01 — Stage-start (Step 2 of 4)

**Task:** CSRF-AUDIT-01 — Cookie-authenticated write routes without CsrfGuard
**Status:** draft for Keith's approval. No code changed. Read-only audit of the tree at 4266a58.
**Worker:** fable subagent (security audit and stage-start across every gateway controller).

Paths: `GW/` = `services/api-gateway/src/`, `FE/` = `frontend/`.

## 0. Summary

- The gateway has 58 write-method routes (POST, PUT, PATCH, DELETE) that accept the session cookie. **Only 2 have CsrfGuard** (logout and the admin entitlement PATCH). 56 do not.
- The gateway parses form-encoded bodies on every route, so a page on the preview host can send a working POST with a body and no preflight.
- 5 routes are high risk, 10 are medium (login included), the rest are low. PUT, PATCH and DELETE are low today only because CORS refuses their preflight.
- The frontend sends `X-CSRF-Token` at 17 write call sites and not at 38 others (18 files). Adding CsrfGuard everywhere needs all 38 changed first.
- **Recommendation:** one global gateway guard that refuses writes whose `Origin` is not the platform origin. 4 gateway files, no frontend change, GATEWAY mutex only. CsrfGuard stays untouched where it is. The alternative (CsrfGuard on every route plus the frontend) is open question 1.

## 1. Method

### 1.1 How a route is authenticated by cookie

| Fact | Reference |
|---|---|
| `SessionCookieGuard` reads `request.cookies.aisandbox_session` and validates it | GW/auth/session-cookie.guard.ts:25-34 |
| `SessionOrApiKeyAuthGuard`: a `Authorization: Bearer` header goes to the API-key check; otherwise the session cookie is used | GW/auth/session-or-api-key.guard.ts:36-51 |
| `ApiKeyAuthGuard` reads only the `Authorization` header (never a cookie), so `/api/v1/*` and `/api/billing/snapshots…` are not cookie routes | GW/auth/api-key-auth.guard.ts:55-65 |
| No other HTTP code reads the session cookie (search for `aisandbox_session` in non-test source: these two guards, the auth controller's set and clear, and the WebSocket handshake) | GW/auth/auth.controller.ts:94, 398-399; GW/websocket/websocket.gateway.ts:13, 187-197 |
| The Passport JWT strategy takes the token from the bearer header only, and no controller uses a JWT guard | GW/auth/jwt.strategy.ts:10; search for `AuthGuard(` and `JwtAuthGuard`: one comment only |
| The only global guard is `InternalServiceAuthGuard` | GW/app.module.ts:98-105 |
| Middleware in order: cookie-session for `aisandbox_oauth_state`, cookie-parser, the csrf-cookie setter. No session middleware for the auth session | GW/main.ts:36-58 |
| Session cookie: httpOnly, SameSite=Lax, path `/`, no Domain | GW/auth/auth.controller.ts:93-101 |

### 1.2 How CsrfGuard is applied

- Per handler only, in two places: `POST /api/auth/logout` (GW/auth/auth.controller.ts:394) and `PATCH /api/admin/users/:userId/entitlements` (GW/admin/admin-operational.controller.ts:92).
- Not global, and on no controller. Search for `CsrfGuard` in non-test source: these two uses, their imports and the class.
- The check is double-submit: cookie `aisandbox_csrf` must equal header `x-csrf-token` (GW/auth/csrf.guard.ts:19-31). The cookie is set on every response that lacks it, not httpOnly, SameSite=Lax, no Domain (GW/main.ts:47-58).

### 1.3 What CORS allows

| Fact | Reference |
|---|---|
| `enableCors({ origin: resolveHttpCorsOrigin, credentials: true })`; no methods or headers list, so the defaults of the `cors` package apply | GW/main.ts:24-27 |
| Only the exact origin of `APP_BASE_URL` is allowed; anything else, or `APP_BASE_URL` unset, gets no allow header. The request origin is never reflected | GW/cors/http-cors-origin.ts:3-8; GW/websocket/websocket.gateway.ts:26-58 |
| Staging: `APP_BASE_URL=https://staging.ainow.biz` | ops/clean-baseline/env/gateway.env.template:4 |

So the preview origin cannot send a credentialed **non-simple** request: the preflight gets no `Access-Control-Allow-Origin` and the browser stops. This covers PUT, PATCH, DELETE, a JSON content type and any custom header (`x-csrf-token`, `Authorization`, `Idempotency-Key`).

CORS does not stop **simple** requests: GET, HEAD, and POST with `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain`. They are sent with the cookie; only the answer is unreadable. CORS does not refuse anything on the server: the handler runs.

### 1.4 Body parsers: form bodies work on JSON routes

| Fact | Reference |
|---|---|
| Nest is created with `rawBody: true` and no custom parser | GW/main.ts:18-21 |
| Nest's Express adapter registers **both** `json` and `urlencoded({ extended: true })` by default | installed `@nestjs/platform-express` 10.4.22, `adapters/express-adapter.js:157-169` (read in the main checkout's node_modules) |
| `ValidationPipe({ whitelist: true, transform: true })`, no implicit conversion | GW/main.ts:64-69 |

What this means for a cross-site POST:

- **Form-encoded:** parsed into `req.body`. Every value is a string; nested objects and arrays are possible (`a[b]=c`, `a[]=c`). Any route whose required fields are strings accepts it. Routes that require a number or boolean without `@Type` answer 400.
- **multipart/form-data:** parsed where the route has a file interceptor (session import, knowledge upload).
- **text/plain:** not parsed; `req.body` is `{}`. Routes with no required body still run (stop, start, verify, cancel, fork).

Three more facts used below:

- The preview page knows its own session id: it is in its URL (`/api/preview/<sid>/proxy/…`, ARCHITECTURE.md section 6).
- Other ids (projects, runs, executions, snapshots, commit hashes) are UUIDs or hashes that the preview page cannot read, because CORS hides the list answers.
- The preview host is a subdomain of the platform host, so the two are same-site and SameSite=Lax does not hold the cookie back. Caddy's basic_auth is not a CSRF control: a browser that has the credentials sends them. **Uncertain** (browser behaviour), so nothing below relies on it.

### 1.5 How internal routes were excluded

`InternalServiceAuthGuard` requires the `X-Internal-Service-Key` header on five prefixes: `/api/internal/`, `/api/events/`, `/api/chat-messages/`, `/api/token-usage/`, `/api/runtime/` (GW/guards/internal-service-auth.guard.ts:11-17, 77-107). A browser cannot add that header cross-origin without a preflight, and these routes do not read the session cookie. Every controller under those prefixes is excluded: the three `internal/admin` controllers, `internal/invoices`, all `internal-*.controller.ts` files, `events`, `chat-messages`, `token-usage` and `runtime`.

Also excluded: `POST /api/billing/webhooks/stripe` (no cookie; signature check, GW/billing/webhook/webhook.controller.ts:37-57) and the `/api/v1/*` and `billing-visibility` controllers (API key header only).

## 2. Inventory

Risk is for a request sent by a page on the preview host with the user's session cookie.

- **High:** a simple POST, nothing unknown needed, direct damage or spend.
- **Medium:** a simple POST with a real but indirect or limited effect.
- **Low:** needs an id the page cannot learn, or only makes clutter, or the method needs a preflight that CORS refuses ("preflight").

"FE header" says whether the frontend call site already sends `X-CSRF-Token`.

### 2.1 SessionCookieGuard routes (40 unguarded, 2 guarded)

| # | Method and path (`/api` + …) | File:line | CsrfGuard | What it changes | Risk | FE call site | FE header |
|---|---|---|---|---|---|---|---|
| 1 | POST /sessions/:id/exec | GW/sessions/session.controller.ts:175 | no | runs a command in the user's container; body is one string | **High**: session id known, form body works | FE/components/workspace/workspace-exec.logic.ts:35 | no |
| 2 | POST /sessions/:id/files/write | session.controller.ts:266 | no | writes any workspace file | **High**: same | workspace-file-navigation.logic.ts:183 | no |
| 3 | POST /sessions/:id/import | session.controller.ts:453 | no | imports a zip into the workspace (multipart) | **High**: multipart is a simple request | workspace-snapshots.logic.ts:372 | no |
| 4 | POST /sessions | session.controller.ts:68 | no | creates a session and starts a container | Medium: resource use; 10 per minute and quota | FE/app/[locale]/app/page.tsx:2178; FE/lib/open-project-in-fresh-session.ts:45 | no |
| 5 | POST /sessions/:id/stop | session.controller.ts:140 | no | stops the session's container | Medium: interrupts work | page.tsx:2215 | no |
| 6 | POST /sessions/:id/messages | GW/conversations/conversation.controller.ts:106 | no | adds a chat message (role and content strings) | Medium: plants text in the session's history | workspace-chat-persistence.logic.ts:82 | no |
| 7 | POST /preview/:sid/start | GW/preview/preview.controller.ts:266 (`@All('*')`) | no | starts the preview | Medium: nuisance, known id | page.tsx:6311, 6390 | no |
| 8 | POST /preview/:sid/stop | preview.controller.ts:192 | no | stops the preview | Medium: nuisance, known id | workspace-shell.tsx:5101 | no |
| 9 | POST /admin/users/:userId/credits | GW/admin/admin-operational.controller.ts:71 | no | grants credits (admin) | Medium: today a form body fails only because `amount` is `@IsInt` without `@Type` (GW/admin/dto/admin-credit-grant.dto.ts:5-7); that is luck, not a control | FE/components/admin/admin-credit-grant-panel.tsx:255 | no |
| 10 | PATCH /admin/users/:userId/entitlements | admin-operational.controller.ts:90-92 | **yes** | sets entitlements | closed | none found in FE | — |
| 11 | DELETE /admin/sessions/:sessionId | admin-operational.controller.ts:129 | no | terminates a session | Low: preflight | admin-user-detail-client.tsx:355 | no |
| 12 | POST /keys | GW/auth/api-key.controller.ts:62 | no | creates an API key | Low: the key is in the unreadable answer | none found | — |
| 13 | DELETE /keys/:id | api-key.controller.ts:81 | no | revokes a key | Low: preflight | none found | — |
| 14 | POST /auth/logout | GW/auth/auth.controller.ts:394-395 | **yes** | ends the session | closed | page.tsx:1404; FE/components/auth/logout-button.tsx:71 | yes |
| 15 | POST /billing/checkout/subscription | GW/billing/checkout/checkout.controller.ts:44 | no | creates a checkout session | Low: no charge; the URL is unreadable | FE/components/billing/billing-page-client.tsx:90 | no |
| 16 | POST /billing/checkout/topup | checkout.controller.ts:64 | no | same | Low | billing-page-client.tsx:49 | no |
| 17 | POST /sessions/:id/checkpoints | GW/checkpoints/checkpoints.controller.ts:32 | no | creates a checkpoint | Low: clutter | workspace-checkpoint-create.logic.ts:36 | no |
| 18 | POST /sessions/:id/revert | checkpoints.controller.ts:129 | no | reverts the workspace | Low: needs a 40-character commit hash (GW/checkpoints/dto/revert-request.dto.ts:9-12) | workspace-checkpoint-revert.logic.ts:21 | no |
| 19 | POST /sessions/:id/snapshot | session.controller.ts:350 | no | saves a snapshot | Low: clutter | workspace-snapshots.logic.ts:264 | no |
| 20 | POST /sessions/:id/restore | session.controller.ts:373 | no | restores a snapshot | Low: needs a snapshot id | workspace-snapshots.logic.ts:311 | no |
| 21 | POST /sessions/:id/files/read | session.controller.ts:241 | no | nothing (a read) | Low: answer unreadable | workspace-file-navigation.logic.ts:162 | no |
| 22 | POST /sessions/:id/files/search | session.controller.ts:321 | no | nothing (a read) | Low | workspace-file-navigation.logic.ts:249 | no |
| 23 | DELETE /sessions/:id/files/delete | session.controller.ts:296 | no | deletes a file | Low: preflight | workspace-file-navigation.logic.ts:218 | no |
| 24 | DELETE /sessions/:id | session.controller.ts:504 | no | deletes the session | Low: preflight | none found | — |
| 25 | DELETE /preview/:sid/stop | preview.controller.ts:266 | no | stops the preview | Low: preflight | none found | — |
| 26 | POST /projects | GW/projects/projects.controller.ts:28 | no | creates a project | Low: clutter | workspace-projects.logic.ts:114 | no |
| 27 | PATCH /projects/:id | projects.controller.ts:55 | no | renames | Low: preflight | none found | — |
| 28 | PATCH /projects/:id/workspace | projects.controller.ts:65 | no | moves | Low: preflight | workspace-projects.logic.ts:138 | no |
| 29 | PATCH /projects/:id/visibility | projects.controller.ts:79 | no | makes a project public or private | Low: preflight (it would be high as a POST) | workspace-projects.logic.ts:159 | no |
| 30 | POST /projects/:id/sessions/:sessionId | projects.controller.ts:93 | no | links a session to a project | Low: project id unknown | workspace-projects.logic.ts:284 | no |
| 31 | POST /projects/:id/open | projects.controller.ts:107 | no | opens a project into a session | Low: project id unknown | workspace-projects.logic.ts:247 | no |
| 32 | POST /projects/public/:id/fork | GW/projects/public-projects.controller.ts:60 | no | copies a public project | Low: clutter | workspace-projects.logic.ts:212 | no |
| 33 | PUT /projects/:projectId/ai-context | GW/project-ai-context/project-ai-context.controller.ts:37 | no | sets project AI instructions | Low: preflight (high as a POST) | workspace-shell.tsx:405 | no |
| 34 | PUT /projects/:projectId/repo-docs | GW/project-repo-docs/project-repo-docs.controller.ts:37 | no | sets repo docs | Low: preflight | workspace-shell.tsx:454 | no |
| 35 | PUT /user/ai-instructions | GW/user-ai-instructions/user-ai-instructions.controller.ts:33 | no | sets the user's AI instructions | Low: preflight (high as a POST) | FE/components/workspace/workspace-account-menu.tsx:85 | no |
| 36 | POST /agents | GW/user-agent/user-agent.controller.ts:174 | no | creates an agent | Low: clutter | FE/hooks/useUserAgents.ts:356-365 | yes |
| 37 | POST /agents/from-template | user-agent.controller.ts:187 | no | creates an agent from a fixed template | Low | useUserAgents.ts:356-365 | yes |
| 38 | PATCH /agents/:id | user-agent.controller.ts:263 | no | edits an agent | Low: preflight | useUserAgents.ts:356-365 | yes |
| 39 | DELETE /agents/:id | user-agent.controller.ts:275 | no | deletes an agent | Low: preflight | useUserAgents.ts:335 | no |
| 40 | POST /workspaces | GW/workspaces/workspaces.controller.ts:25 | no | creates a workspace | Low: clutter | workspace-workspaces.logic.ts:80 | no |
| 41 | PATCH /workspaces/:id | workspaces.controller.ts:49 | no | renames | Low: preflight | workspace-workspaces.logic.ts:99 | no |
| 42 | DELETE /workspaces/:id | workspaces.controller.ts:59 | no | deletes | Low: preflight | workspace-workspaces.logic.ts:118 | no |

### 2.2 SessionOrApiKeyAuthGuard routes, cookie path (16 unguarded)

A bearer caller (for example `/driver`, FE/app/[locale]/driver/page.tsx:251) has no csrf cookie, so plain CsrfGuard on these routes would break it.

| # | Method and path | File:line | What it changes | Risk | FE call site | FE header |
|---|---|---|---|---|---|---|
| 43 | POST /ai/execute | GW/ai/ai-execution.controller.ts:721 | starts an AI run on a session: spends credits, can change files | **High**: session id known; the body type is an interface, so nothing validates it (GW/clients/ai-service-http.client.ts:44-65); the idempotency header is optional (GW/ai/idempotency.guard.ts:98-102). Only while runs are on (`GLOBAL_EXECUTION_ENABLED`) | page.tsx:4622, 5013 | no |
| 44 | POST /collaboration/runs | GW/orchestration/collaboration.controller.ts:264 | starts a team run: spends credits | **High**: string fields only; needs the harness entitlement, which Keith has | FE/components/collaboration/collaboration-page.tsx:792 | yes |
| 45 | POST /connectors/imap | GW/connectors/connectors.controller.ts:50 | saves a mail connection | Medium: an attacker's mailbox becomes the user's mail source | FE/components/connections/connections-api.ts:196 | yes |
| 46 | POST /connectors/ical | connectors.controller.ts:61 | saves a calendar URL | Medium: same, for calendar text | connections-api.ts:221 | yes |
| 47 | POST /knowledge/documents | GW/knowledge/knowledge.controller.ts:97 | saves a knowledge document (form or multipart) | Medium: plants text the agents read later | FE/components/knowledge/knowledge-screen.tsx:660 | yes |
| 48 | POST /ai/executions/:id/cancel | ai-execution.controller.ts:1034 | cancels a run | Low: id unknown | workspace-run-cancel.logic.ts:13 | no |
| 49 | POST /ai/executions/:id/confirm-build-apply | ai-execution.controller.ts:1172 | confirms a build apply | Low: id unknown | workspace-ai-file-actions.logic.ts:386 | no |
| 50 | POST /connectors/:kind/verify | connectors.controller.ts:81 | re-checks a connection | Low | connections-api.ts:243 | yes |
| 51 | DELETE /connectors/:kind | connectors.controller.ts:115 | removes a connection | Low: preflight | connections-api.ts:262 | yes |
| 52 | DELETE /knowledge/documents/:id | knowledge.controller.ts:133 | deletes a document | Low: preflight | knowledge-screen.tsx:696 | yes |
| 53 | POST /results/:runId/seen | GW/orchestration/collaboration-results.controller.ts:175 | marks a result seen | Low | FE/components/results/results-api.ts:203 | yes |
| 54 | PUT /collaboration/roster | GW/orchestration/collaboration-roster.controller.ts:40 | saves the roster | Low: preflight | FE/components/collaboration/collaboration-roster.ts:373 | yes |
| 55 | POST /collaboration/runs/:id/referrals/:rid/approve | collaboration.controller.ts:423 | approves a hand-off | Low: ids unknown | collaboration-page.tsx:942 | yes |
| 56 | POST …/referrals/:rid/reject | collaboration.controller.ts:463 | rejects a hand-off | Low: ids unknown | collaboration-page.tsx:1002 | yes |
| 57 | POST …/referrals/:rid/prompt | collaboration.controller.ts:502 | edits a hand-off prompt | Low: ids unknown | collaboration-page.tsx:1036 | yes |
| 58 | POST /collaboration/runs/:id/cancel | collaboration.controller.ts:541 | cancels a run | Low: id unknown | collaboration-page.tsx:1064; FE/lib/office/office-cancel.ts:54 | yes |

### 2.3 Auth routes without a session

| Route | File:line | Treatment |
|---|---|---|
| POST /auth/login | auth.controller.ts:136 | **Medium (login CSRF):** a form POST with the attacker's email and password sets the attacker's session in the victim's browser; later work lands in the attacker's account. Throttled, not origin-checked. Covered by the recommended guard. Called by axios without a header (FE/app/[locale]/login/page.tsx:99) |
| POST /auth/register | auth.controller.ts:153 | Low: anyone can call it directly; sets no cookie; throttled |
| POST /auth/email/verify/resend, /auth/password-reset/request | auth.controller.ts:190, 205 | Low: same; throttled per email |
| POST /auth/password-reset/confirm | auth.controller.ts:220 | Low: needs the emailed token |
| POST /auth/logout | auth.controller.ts:394 | Already guarded |
| GET /auth/google, /auth/apple | auth.controller.ts:241, 305 | Sets the OAuth state cookie and redirects. Leave |
| GET /auth/google/callback | auth.controller.ts:263 | Sets the session. Protected by OAuth `state: true` (GW/auth/google.strategy.ts:37). Leave |
| POST /auth/apple/callback | auth.controller.ts:327 | Apple posts a form from its own origin by design; protected by `state: true` (GW/auth/apple.strategy.ts:55). Must be exempt from any origin check. See follow-up F3 |
| GET /auth/email/verify | auth.controller.ts:168 | Changes state (marks the email verified) but only with the emailed token. Leave |

### 2.4 GET routes with side effects

- `GET /preview/:sid/proxy…` on the platform host issues a single-use ticket and redirects (preview.controller.ts:241-263). Owner-checked, harmless. Leave.
- The auth GETs are in 2.3.
- All other cookie GETs call list, get, export or stream methods (checked by handler and service-method name in each controller; **uncertain** in the strict sense, because I did not trace every service body). No GET was found that writes, so no GET needs to become a POST.

### 2.5 Count

| Risk | Count | Routes |
|---|---|---|
| High | 5 | 1 exec, 2 files/write, 3 import, 43 ai/execute, 44 collaboration/runs |
| Medium | 10 | 4, 5, 6, 7, 8, 9, 45, 46, 47, and login |
| Low | 42 | 24 simple POSTs and 18 PUT/PATCH/DELETE |
| Already guarded | 2 | 10, 14 |

Who is exposed today: only Keith, and only to code that an agent generated for him. The risk grows with a second user or public projects (a fork runs someone else's code in the victim's preview).

## 3. Decision per route

Codes: (a) add CsrfGuard; (b) leave; (c) other fix.

| Routes | Decision | Reason |
|---|---|---|
| 1-9, 11-13, 15-58 (all 56 unguarded) and login | **(c) one global origin check** (section 4). No per-route edit | One rule closes every high and medium route, covers the 18 preflight-only routes if CORS ever loosens, and covers routes added later. No frontend change |
| 10, 14 | (b) keep CsrfGuard as it is | Already closed; the frontend already sends the header for logout |
| register, resend, reset request, reset confirm | (c) covered by the same check when a browser sends them | No cookie involved; the check costs nothing |
| GET google, apple, google/callback, email/verify, preview proxy | (b) leave | OAuth state, emailed token, or harmless |
| POST /auth/apple/callback | (b) leave, and exempt it from the origin check | Cross-site by design; OAuth state |

If Keith prefers (a) instead (open question 1), the "FE header" columns are the work list:

- **Frontend must change first** at 38 call sites in 18 files: page.tsx (6), open-project-in-fresh-session.ts, workspace-exec.logic.ts, workspace-file-navigation.logic.ts (4), workspace-snapshots.logic.ts (3), workspace-run-cancel.logic.ts, workspace-ai-file-actions.logic.ts, workspace-shell.tsx (3), workspace-checkpoint-create.logic.ts, workspace-checkpoint-revert.logic.ts, workspace-chat-persistence.logic.ts, workspace-projects.logic.ts (6), workspace-workspaces.logic.ts (3), workspace-account-menu.tsx, admin-credit-grant-panel.tsx, admin-user-detail-client.tsx, billing-page-client.tsx (2), useUserAgents.ts:335. Adding the guard before that breaks each feature with a 403.
- **Already sending the header** (17 call sites): collaboration (6), roster, results, connectors (4), knowledge (2), agents create and edit (one helper), logout (2). The gateway ignores it today on all but logout.
- Routes 43-58 need a new guard that skips the check for bearer callers; plain CsrfGuard would break `/driver`.
- Login needs the frontend forms changed too (axios, 4 files).

## 4. Recommendation for Step 3

**One global guard, gateway only.** Refuse a write when the browser says it comes from another origin.

Rule, for every request whose method is not GET, HEAD or OPTIONS:

1. Path is `/api/auth/apple/callback`: allow (section 2.3).
2. `Origin` header present: it must equal the `APP_BASE_URL` origin, decided by the existing `resolveHttpCorsOrigin` (no new parsing). Otherwise 403.
3. `Origin` absent and the `aisandbox_session` cookie present: 403 (open question 2).
4. `Origin` absent and no session cookie: allow. These are non-browser callers: internal services with the key, Stripe, API-key clients, curl.

Why this works: browsers set `Origin` on every POST, PUT, PATCH and DELETE, pages cannot change it, and the preview host's value is `https://preview.staging.ainow.biz`. The check does not depend on SameSite, on CORS, on the body type, or on the csrf cookie (which a subdomain can shadow until COOKIE-PREFIX-01).

Why not CsrfGuard everywhere: it is the same protection for 38 frontend edits in 18 files (two of them the largest files in the frontend), a new bearer-aware guard anyway, both mutexes, and a browser check of every feature. It can still be added later as a second layer (follow-up F1).

### 4.1 Write set (exact)

| File | Change |
|---|---|
| `services/api-gateway/src/guards/same-origin-write.guard.ts` | new: the rule above; `ForbiddenException('Cross-origin request refused')`; no logging of cookies or headers |
| `services/api-gateway/src/guards/same-origin-write.guard.spec.ts` | new: unit tests |
| `services/api-gateway/src/guards/same-origin-write.guard.http.spec.ts` | new: HTTP tests on a small Nest app with cookie-parser, the guard as `APP_GUARD`, and stub routes |
| `services/api-gateway/src/app.module.ts` | register the guard as a second `APP_GUARD` beside `InternalServiceAuthGuard` (lines 98-105) |

No frontend file. No message file. No `main.ts`, no cookie attribute, no `CsrfGuard`, no `SessionCookieGuard`, no internal route, no entity, no dependency.

**Mutexes:** GATEWAY. No FRONTEND, no I18N (no visible text), no HOTFILE.

### 4.2 Tests to add

1. POST with `Origin` = the app origin: allowed.
2. POST with `Origin: https://preview.staging.ainow.biz` (with `APP_BASE_URL=https://staging.ainow.biz`): 403, with and without a session cookie.
3. POST with `Origin: null`: 403.
4. POST without `Origin`, with a session cookie: 403. Without a cookie: allowed.
5. PUT, PATCH and DELETE: same as POST.
6. GET, HEAD and OPTIONS with a foreign `Origin`: allowed (the guard does not look).
7. `APP_BASE_URL` unset or not a URL, with any `Origin`: 403 (fail closed, as CORS does).
8. `POST /api/auth/apple/callback` with `Origin: https://appleid.apple.com`: allowed. A near-miss path (`/api/auth/apple/callbackx`, upper case, trailing segment) is not exempt.
9. An internal-prefix POST with the key and no `Origin`: reaches `InternalServiceAuthGuard` unchanged. A bearer POST without `Origin`: allowed.
10. HTTP spec: the 403 comes before the session check (a foreign-origin POST to a `SessionCookieGuard` stub answers 403, not 401), and a form-encoded POST from a foreign origin never reaches the handler.
11. Source test: `app.module.ts` registers the guard as `APP_GUARD`.

### 4.3 Gates

- `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test` (in the worktree path during the run): no new failure beyond the 14 known `smoke.integration` failures (docs/PREVIEW-ORIGIN-01-CHECKPOINT.md, Gates).
- `npm run build`: exit 0.
- Frontend gates not needed (no frontend file changes).

### 4.4 Model, loop, stop conditions

- **Model:** opus subagent (guards and auth; CLAUDE.md Model Routing). Worktree `lane/CSRF-AUDIT-01`.
- **Loop:** 4-step; this is Step 2. Evidence class LOCAL-TESTS.
- **Checklists for the brief:** EVERY, BACKEND.
- **Stop and report if:**
  - any existing gateway spec fails because of the new guard;
  - a legitimate caller is found that sends a cookie-authenticated write without `Origin`, or from another origin;
  - the work would need a change to `CsrfGuard`, `SessionCookieGuard`, `main.ts`, a cookie, an internal route, a frontend file or a dependency;
  - `resolveHttpCorsOrigin` cannot be reused as it is.

## 5. Acceptance criteria

1. A write request (POST, PUT, PATCH, DELETE) with an `Origin` other than the `APP_BASE_URL` origin gets 403 on every gateway route except `POST /api/auth/apple/callback`, before any session or ownership check.
2. A write request with the app origin behaves exactly as before on every route.
3. A write request with the session cookie and no `Origin` gets 403 (unless Keith answers question 2 the other way).
4. Requests without `Origin` and without the session cookie behave as before: internal routes with the key, the Stripe webhook, bearer callers.
5. GET, HEAD and OPTIONS are unchanged.
6. `CsrfGuard`, `SessionCookieGuard`, cookie attributes, `main.ts` and internal routes are unchanged; `git diff` shows only the four files of 4.1.
7. The tests of 4.2 exist and pass; gateway `npm test` shows no new failure; `npm run build` exits 0.
8. No frontend file and no message file changes.
9. The checkpoint carries `CHECKLIST: EVERY …, BACKEND …`, the model used, and the FOLLOWUPS line.

## 6. Live check after the deploy (a deploy task, not this one)

From the staging host with curl, straight to the gateway on 127.0.0.1:4000, with no user session and no secret:

| Request | Expected |
|---|---|
| `POST /api/sessions` with `Origin: https://preview.staging.ainow.biz` | 403 |
| `POST /api/sessions/<any uuid>/exec`, form-encoded, same foreign origin | 403 |
| `POST /api/auth/login`, form-encoded, same foreign origin | 403 |
| `POST /api/sessions` with `Origin: https://staging.ainow.biz` | 401 (the session check, as before) |
| `POST /api/sessions` with no `Origin` and no cookie | 401 |
| `GET /api/health` with the foreign origin | 200 |
| `POST /api/internal/…` without the key | 401 (unchanged) |

The 403 arrives before the session check because global guards run before controller guards. The same requests can be repeated through Caddy with the host's stored test API key where a bearer check is wanted.

Needs Keith (a few minutes, in the browser): sign in, open a project, send one chat message, save a file, start and stop the preview, and open Team, Knowledge and Connections once. All must work as before. Nothing else needs him.

## 7. Open questions for Keith

1. **Which fix?**
   - **Recommended: the global origin guard** (section 4): 4 gateway files, GATEWAY only, closes all 5 high and 10 medium routes and login, nothing changes in the frontend.
   - Alternative: CsrfGuard on every route. Same protection; adds 38 frontend call sites in 18 files, a bearer-aware guard for routes 43-58, the FRONTEND mutex, and two or three slices.
2. **A write with the session cookie but no `Origin` header:** refuse (recommended; every current browser sends it, and no script in `ops/` or `scripts/` uses the session cookie) or allow (softer; keeps very old browsers and cookie-based curl checks working).

## 8. Follow-ups named by this audit

| # | Follow-up | Note |
|---|---|---|
| F1 | CsrfGuard on every cookie write route plus one shared frontend fetch helper, as a second layer | Only if Keith wants it after question 1; needs FRONTEND |
| F2 | WebSocket handshake has no origin check | The socket authenticates by the session cookie (GW/websocket/websocket.gateway.ts:185-204); engine.io 6.6.5 applies `cors` as headers only, so an upgrade from another origin is not refused. A read risk, not a write. Not reachable on staging today: Caddy sends only `/api/*` to the gateway (ops/clean-baseline/caddy/Caddyfile:11-16) and the frontend has no socket client in use. **Uncertain** |
| F3 | Apple sign-in callback and the SameSite=Lax state cookie | Apple's cross-site form POST will not carry `aisandbox_oauth_state` (GW/main.ts:36-45), so the state check may always fail. **Uncertain**; not tested; outside this task |
| F4 | The Next route `FE/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` accepts the session cookie for a write and has no origin check | Local topology only: on staging Caddy sends `/api/*` to the gateway. Needs an origin check if a deployment ever routes it to Next |
| F5 | ARCHITECTURE.md lines 110, 213 and 683 describe CSRF protection more broadly than the code has | Update with the Step 4 record (control plane) |
| F6 | Deploy of the Step 3 change, with the live check of section 6 | A STAGING-RUNTIME task |
| — | COOKIE-PREFIX-01 (already registered) | Unchanged. The recommended guard does not depend on it |

## 9. Checklist (Step 2)

EVERY: 1 met (admitted, board line `lane1.taskId=CSRF-AUDIT-01`); 2 met (4-step, Step 2); 3 met (fable, named in the brief with the reason); 4 met (self-contained brief, boot sequence followed, no subagent started); 5 met (this file only, no dependency); 6 n/a (a document); 7 n/a (no code); 8 met (nothing started); 9 met (no build ran); 10 met (one commit on `lane/CSRF-AUDIT-01` only); 11 met (section 8).
