# Security concerns check (plan item 26)

Independent review, Opus 5.5, 2026-11-10. Read-only. Source at `main` b477e49 (main checkout `C:\Users\knlee\aiSandBox2026B`). Staging runs fbbf41d (TASKS.md:640); AUTH-GUARD-01 (0498cbe), AUTH-OWNER-01 (8fb5b63), ACCESS-01A (e477085) and COLLAB-CANCEL-01 (e4f9fb4) are all ancestors of fbbf41d (`git merge-base --is-ancestor`), and none of the guard, execution, public-api, streaming, websocket, chat-messages or collaboration controller files changed between fbbf41d and HEAD (`git diff --stat` empty). So what is below is what staging runs.

Paths are relative to `services/api-gateway/src/` unless stated.

Tests rerun (Node v22.14.0, `npx jest` in services/api-gateway): 9 suites, 164 of 164 passed:
`ai/__tests__/ai-execution.ownership.http.spec.ts`, `public-api/public-ai.controller.spec.ts`, `streaming/execution-stream.service.spec.ts`, `guards/internal-service-auth.guard.spec.ts`, `guards/internal-service-auth.guard.http.spec.ts`, `websocket/__tests__/*` (2), `orchestration/collaboration.controller.spec.ts`, `ai/__tests__/ai-execution-guards.integration.spec.ts`.

## Summary

| # | Concern | Verdict | Evidence |
|---|---|---|---|
| 1 | Execution streaming and cancellation authorization | COVERED | Owner check before cancel and before the stream opens: `ai/ai-execution.controller.ts:1040-1048`, `:1223-1231`. Collaboration cancel owner-checked twice: `orchestration/collaboration.controller.ts:406-408`, `orchestration/orchestration.service.ts:1307-1311`. HTTP tests with a second user: `ai/__tests__/ai-execution.ownership.http.spec.ts:137,189`; `orchestration/collaboration.controller.spec.ts:452,538` |
| 2 | `/api/chat-messages/add-by-session` | COVERED (gateway route). See adjacent finding A | Prefix in the global guard `guards/internal-service-auth.guard.ts:13`, plus controller guard `chat-messages/chat-message.controller.ts:13`. HTTP test without key, wrong key, changed case: `guards/internal-service-auth.guard.http.spec.ts:221` |
| 3 | Socket.IO rooms | COVERED | Handshake cookie auth `websocket/websocket.gateway.ts:185-210`; owner check on join `:127-159`. Tests `websocket/__tests__/websocket.gateway.spec.ts:62,73,152,166`; live disconnect of an unauthenticated client on staging (docs/ACCESS-LIVE-01-CHECKPOINT.md:32) |
| 4 | Stream subscription cleanup | COVERED | One Redis listener, per-viewer callbacks, channel dropped after the last viewer: `streaming/execution-stream.service.ts:19-32,40-71`; teardown `ai/ai-execution.controller.ts:1242-1244`. Tests `streaming/execution-stream.service.spec.ts:79,94,110`; `ai/__tests__/ai-execution.ownership.http.spec.ts:220` |
| 5 | Guard case-matching | COVERED | `path.toLowerCase().startsWith(prefix)` `guards/internal-service-auth.guard.ts:56-58`; global `app.module.ts:101-104`. Tests `guards/internal-service-auth.guard.spec.ts:28-39,94,121`; `guards/internal-service-auth.guard.http.spec.ts:153,167,221` |
| 6 | Public v1 execute ownership | COVERED | UUID check and session owner check before ledger write and enqueue: `public-api/public-ai.controller.ts:114-124`. Tests `public-api/public-ai.controller.spec.ts:74,99,121,180` |

No PARTIAL or NOT COVERED verdict. OFFICE-07's readiness condition ("the cancellation-authorization concern is confirmed covered", TASKS_BACKLOG_FULL.md:87244) is met on the evidence. Two adjacent findings outside the six are listed at the end for Keith's decision.

## 1. Execution streaming and cancellation authorization

**Concern.** "Authorization of execution streaming" and "Authorization of execution cancellation" (docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md:50-51). Before AUTH-OWNER-01 both routes were login-only with no owner check (docs/AUTH-OWNER-01-STAGE-START.md:11-12).

**Who can cancel what, today.** There are exactly two user cancel routes in the gateway (search for `@Post(...cancel...)` across api-gateway, ai-service and container-manager returns only these two):

| Route | Guards | Owner check | Refusals |
|---|---|---|---|
| `POST /api/ai/executions/:executionId/cancel` (`ai/ai-execution.controller.ts:1034-1060`) | `SessionOrApiKeyAuthGuard` (`:1035`): browser cookie or Bearer API key (`auth/session-or-api-key.guard.ts:34-67`); plus the global `InternalServiceAuthGuard`, which lets this path through | Loads the execution, then `execution.user_id !== identity.userId` is 404 (`:1040-1048`), before `requestCancel` (`:1050`) | unknown or another user's: 404 "Execution not found"; owner but not `running`: 409 (`ai/execution-result.service.ts:75-87` only updates `running` rows) |
| `POST /api/collaboration/runs/:id/cancel` (`orchestration/collaboration.controller.ts:399-425`) | `SessionOrApiKeyAuthGuard` on the controller (`:152`); harness entitlement required (`assertEntitled`, `:427-435`, 403 otherwise) | `requireOwnedRun` (`:407`, `:508-517`): 404 unless `run.userId === caller.userId`; the service checks again (`orchestration/orchestration.service.ts:1307-1311`), and again per referral (`:1376-1380`) before it cancels the referral's execution (`:1394`) | unknown or another user's: 404; not active: 409 (`:408`); unentitled: 403 |

So: only the execution's owner can cancel an execution, and only the run's owner (with harness access) can cancel a collaboration run. `requestCancel` itself takes no user id (`ai/execution-result.service.ts:75`); every caller checks ownership first (the two controllers above and the orchestration service after its own owner check). There is no public `v1` cancel or stream route (`public-api/public-ai.controller.ts` has only `execute` and `executions/:id`), and no internal cancel route (`orchestration/internal-collaboration.controller.ts` has none).

**Streaming.** `GET /api/ai/executions/:executionId/stream` (`ai/ai-execution.controller.ts:1217-1246`): same guard, same owner check, done before the Observable is returned, so a refusal is a plain JSON 404 and no Redis subscription is made (`:1223-1231`).

**Tests** (all real HTTP through Nest with supertest, two cookie identities):
- `ai/__tests__/ai-execution.ownership.http.spec.ts:137` another user cancelling gets 404 and `requestCancel` is not called; `:149` unknown id 404; `:161` owner gets `cancel_requested` and the lookup runs before the cancel; `:177` owner 409.
- `:189` another user streaming gets JSON 404, not `text/event-stream`, and `subscribe` is not called; `:206` unknown id the same.
- `ai/__tests__/ai-execution-guards.integration.spec.ts:573` the cancel route carries `SessionOrApiKeyAuthGuard`.
- `orchestration/collaboration.controller.spec.ts:452` another user on get, approve, reject and cancel: all 404, run stays active; `:538` another user's cancel does not call `cancelCollaboration`; `:521` 409 on a finished run; `:552` 403 for an unentitled owner; `:479` owner cancels and the referral ends cancelled.
- Service: `orchestration/__tests__/orchestration.service.spec.ts:843-933` cascade to active referral executions.

The attack described (another user's execution id or run id) is tested directly for both routes.

**Limits (not gaps).** The ownership HTTP spec uses cookie identities; the API-key path is mocked (`ai-execution.ownership.http.spec.ts:73`). The owner check compares `identity.userId` regardless of how it was set, so this does not weaken the result. Cancel uses the session cookie without the CSRF guard; the cookie is `sameSite: 'lax'` (`main.ts:41`, `auth/auth.controller.ts:97`), so a cross-site POST does not carry it, and ids are UUIDs.

**For OFFICE-07.** The condition is met. One design note for its brief: a Team run's hand-off executions belong to the run owner, so the owner could also cancel them one by one through the execution route. The office should cancel Team runs through `POST /api/collaboration/runs/:id/cancel` so the run and its hand-offs end consistently, and Builder runs through the execution route.

**Verdict: COVERED.**

## 2. `/api/chat-messages/add-by-session`

**Concern.** "Authorization of `/api/chat-messages/add-by-session`" (review record :52). Before AUTH-GUARD-01 it answered 201 with no key (docs/AUTH-GUARD-01-CHECKPOINT.md:27).

**Code.** `/api/chat-messages/` is a protected prefix of the global guard (`guards/internal-service-auth.guard.ts:10-16`, registered as `APP_GUARD` at `app.module.ts:101-104`), and the controller also carries the guard (`chat-messages/chat-message.controller.ts:13`). The only route is `POST add-by-session` (`:24-37`). The only caller is ai-service, which sends `X-Internal-Service-Key` (`services/ai-service/src/clients/api-gateway-http.client.ts:44-67`). The browser's own message write is a different, owner-checked route: `POST /api/sessions/:id/messages` with `SessionCookieGuard` and a session owner check (`conversations/conversation.controller.ts:29,106-116`).

**Tests.** `guards/internal-service-auth.guard.http.spec.ts:221` (no key, wrong key, `/API/CHAT-MESSAGES/add-by-session`: all 401, handler not called); `:270` reaches the handler with the key; unit `guards/internal-service-auth.guard.spec.ts:20-26,94`. A user can no longer reach the route at all, so "add-by-session on another user's session" from a browser or API key is refused.

**Verdict: COVERED** for the gateway route. The same write can still be reached through ai-service if port 4001 is reachable: see adjacent finding A.

## 3. Socket.IO rooms

**Concern.** "Unguarded Socket.IO room access; deployed exposure unverified" (review record :53).

**Code.** `websocket/websocket.gateway.ts`:
- Connection: the `aisandbox_session` cookie from the handshake is validated with `AuthService.validateSessionToken`; missing, blank, invalid or throwing disconnects the client (`:117-121`, `:185-210`).
- `join-session` waits for that check (`:129-132`), refuses with no user (`:134-137`), a blank id (`:138-140`), an unknown session (`:143-150`) or another user's session (`:152-154`); only then `client.join` (`:156`).
- Socket CORS allows only the `APP_BASE_URL` origin, never reflects (`:26-58`, `:100-105`).
- Emitters only write to `session:<id>` rooms (`:170-183`). The HTTP side that triggers them, `POST /api/events/*`, needs the internal key (guard prefix `:12`).

**Tests.** `websocket/__tests__/websocket.gateway.spec.ts:62` no cookie, `:73` invalid cookie, `:91` validation throws (all disconnect); `:152` another user's session refused and not joined; `:166` unknown session; `:182` no user attached; `:193` lookup error does not join; `:227,246` CORS. `websocket/__tests__/events.controller.guard.spec.ts:25,97` event routes refuse no key and a wrong key. Live on staging: an unauthenticated client was disconnected by the server (docs/ACCESS-LIVE-01-CHECKPOINT.md:32); port 4000 is not open in the Lightsail firewall (`:33`).

**Limits.** The gateway tests use a mocked socket, not a real Socket.IO client, and a second user joining Keith's room was not tried live (docs/ACCESS-LIVE-01-CHECKPOINT.md:68). An open socket is not re-checked after logout (only at connect). `leave-session` has no owner check, which is harmless. No frontend code opens a socket today (docs/ACCESS-01A-CHECKPOINT.md:45). None of these lets one user join another's room.

**Verdict: COVERED.**

## 4. Stream subscription cleanup

**Concern.** "Stream subscription cleanup" (review record :57). Defined in docs/AUTH-OWNER-01-STAGE-START.md:14: every `subscribe` added a Redis `message` listener that was never removed, and `unsubscribe` dropped the channel while another viewer was still connected.

**Code.** `streaming/execution-stream.service.ts`: one `message` listener registered in the constructor (`:19-32`); a map of channel to callback sets (`:8`); Redis subscribe only for the first viewer (`:40-55`); a viewer's callback removed on unsubscribe and the channel dropped only when the set is empty (`:57-71`); one throwing viewer does not stop the others (`:25-31`). The SSE handler passes its own callback and removes the same one on teardown (`ai/ai-execution.controller.ts:1233-1245`).

**Tests.** `streaming/execution-stream.service.spec.ts:51` every viewer gets the message; `:67` no cross-channel delivery; `:79` the remaining viewer stays subscribed when one leaves; `:94` Redis unsubscribed after the last; `:110` exactly one `message` listener for three subscriptions; `:124` a throwing callback. Over HTTP: `ai/__tests__/ai-execution.ownership.http.spec.ts:220` the owner's stream closes and `unsubscribe` is called once with the same callback.

**"Stream left open after cancel."** A cancelled run ends with a `complete` event: the worker publishes it on cancel (`services/ai-service/src/worker/worker.processor.ts:2151-2167`) and the browser closes its `EventSource` on `complete` (`frontend/app/[locale]/app/page.tsx:4138-4140`), which runs the teardown above. The gateway itself never completes the Observable, so a non-browser client that ignores `complete` keeps its one Redis callback until it disconnects. That is a resource matter for that client's own execution, not an authorization gap or a leak across users. Not proposed as a task.

**Verdict: COVERED.**

## 5. Guard case-matching

**Concern.** "Guard case-matching" (review record :62), an unverified hypothesis. It was real: `GET /API/INTERNAL/workspace/s1/read` returned 200 without a key (docs/AUTH-GUARD-01-CHECKPOINT.md:25-26).

**Code.** `guards/internal-service-auth.guard.ts:56-58` lowercases `request.path` before the prefix test, for all five prefixes (`:10-16`); refuses with no configured key (`:64-69`), a missing header (`:74-77`) or a wrong key (`:79-82`). Global via `APP_GUARD` (`app.module.ts:101-104`). The other path-based guard, `preview/preview-ownership.guard.ts:31-49`, takes the session id from the path and owner-checks it whatever the case, so case does not help there.

**Other spellings, checked locally.** With the repo's Express 4.22.1 and a route `/api/internal/x` (scratch script, no repo change): `/API/INTERNAL/x` and `/api/internal/x/` reach the route (the guard lowercases and still matches); `/api/%69nternal/x`, `/api/%49nternal/x`, `//api/internal/x`, `/api/./internal/x` and `/api/internal%2Fx` get 404 from Express and never reach a handler. Every controller under the five prefixes has sub-paths (for example `runtime/runtime.controller.ts:32`, `token-usage/token-usage.controller.ts:24`, `websocket/events.controller.ts:8-22`), so the trailing slash in the prefixes leaves no exact-prefix route open.

**Tests.** Unit `guards/internal-service-auth.guard.spec.ts:28-39` (ten changed-case paths), `:94` refused without key, `:104` accepted with key, `:121` lookalikes such as `/api/internalx/a` not treated as internal, `:128` key unset. HTTP `guards/internal-service-auth.guard.http.spec.ts:153` (workspace read, three cases, client not called), `:167` (collaboration internal routes in mixed case, service not called), `:221` (chat-messages, token-usage, runtime in changed case).

**Limits.** The key is compared with `!==`, not a constant-time compare, and the startup warning text is stale (docs/AUTH-GUARD-01-CHECKPOINT.md:55). Neither is case-matching.

**Verdict: COVERED.**

## 6. Public v1 execute ownership

**Concern.** "Public v1 execute ownership" (review record :63), an unverified hypothesis. It was real: the handler wrote the ledger and enqueued with an unchecked `sessionId` (docs/AUTH-OWNER-01-STAGE-START.md:13).

**Code.** `public-api/public-ai.controller.ts:114-124`: non-UUID `sessionId` is 400; then `sessionService.getSessionById` and 404 when `session.userId !== identity.userId`; both before `writeExecutionIntent` (`:145`) and `enqueueExecution` (`:162`). `identity` comes from `ApiKeyAuthGuard` on the controller (`:46`). `GET /api/v1/ai/executions/:id` is owner-checked too (`:195-201`). `conversationId` is not owner-checked, but ai-service only logs it (for example `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts:140`), so it gives no access. The other v1 routes are owner-scoped as well: files check session ownership (`public-api/public-files.controller.ts:47,82,108`); sessions and projects act on `identity.userId` (`public-api/public-sessions.controller.ts:33,46`, `public-api/public-projects.controller.ts:29,39`).

**Tests.** `public-api/public-ai.controller.spec.ts:74` another user's session: 404, no ledger write, no enqueue; `:99` non-UUID: 400, no lookup, no write; `:121` missing session: 404, no write; `:180` another user's execution not exposed. These call the controller directly with the guard bypassed, which is right for this check: the guard only sets the identity.

**Verdict: COVERED.**

## Proposed tasks

None for the six concerns: all are COVERED.

## Adjacent findings (outside the six, for Keith's decision)

These were found while tracing concern 2. They are not among the review record's six and do not change any verdict above.

**A. ai-service has no application authentication.** ai-service registers no guard at all (no `APP_GUARD` or `UseGuards` anywhere in `services/ai-service/src`) and listens on all interfaces (`services/ai-service/src/main.ts:83-84`, PORT 4001 in `ops/clean-baseline/env/ai.env.template:2`). Its routes include `POST /api/execute` (`services/ai-service/src/ai-execution/ai-execution.controller.ts:15-19`), `POST /api/messages/chat` which takes `sessionId` and `userId` from the body and writes chat messages through the gateway with the internal key (`services/ai-service/src/messages/messages.controller.ts:9-17`, `services/ai-service/src/messages/messages.service.ts:50,111`), and `GET` and `DELETE /api/conversations/:sessionId...` (`services/ai-service/src/conversations/conversations.controller.ts:12-45`). Anyone who can reach port 4001 can therefore add messages to, read or clear any session's conversation, and start provider runs, without going through the gateway. On staging only the network stops this: Caddy proxies only 4000 and 3002 (`ops/clean-baseline/caddy/Caddyfile:12,15`), and the Lightsail firewall was checked for port 4000 only (docs/ACCESS-LIVE-01-CHECKPOINT.md:33); port 4001 was not recorded.

Ready to register if Keith wants it:

> **AI-SERVICE-AUTH-01 — Internal key on ai-service routes.** Workstream RELIABILITY, 4-STEP (internal routes, security), evidence LOCAL-TESTS, AI-SERVICE mutex. Files likely touched: a new `services/ai-service/src/guards/internal-service-auth.guard.ts` and spec, `services/ai-service/src/app.module.ts` (global guard), and the gateway's `services/api-gateway/src/clients/ai-service-http.client.ts`, which sends no `X-Internal-Service-Key` today (a search of that file finds none), plus any other direct caller of ai-service found at stage-start. Acceptance: every ai-service route except `/api/health` and `/metrics` refuses a missing or wrong `X-Internal-Service-Key` with 401, matching path case-insensitively; refused when the key is unset; the gateway's calls to ai-service still pass; tests over HTTP for `/api/execute`, `/api/messages/chat`, `/api/conversations/:sessionId/messages` and `DELETE /api/conversations/:sessionId`; ai-service and api-gateway tests and builds pass against the known failures. Before admission, a one-line host check that port 4001 is closed on the Lightsail firewall (if it is open, that is urgent and comes first).

Cheaper alternative: bind ai-service to 127.0.0.1 (one line in `main.ts` or a HOST env), which removes the network exposure but not the missing check.

**B. Internal key compared with `!==`.** `services/api-gateway/src/guards/internal-service-auth.guard.ts:79`. Already recorded as out of scope in docs/AUTH-GUARD-01-CHECKPOINT.md:55. Low risk behind Caddy and the firewall; a constant-time compare would fit into task A if it is registered.
