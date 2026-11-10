# CM-AUTH-01 — Stage-start

**Task:** CM-AUTH-01 — Internal key on container-manager routes
**Status:** STAGE-START — APPROVED by the control plane on 2026-11-10 under Keith's instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start"). Drafted by an opus subagent. DECISIONs 1-5 and SCOPE 1 settled with the drafter's recommendations (all fail-closed and inside the admitted write set); the gateway preview traversal is fixed in this task (D5).
**Lane:** 2. **Mutexes:** CONTAINER-MANAGER, GATEWAY, AI-SERVICE. Lane 1 (BIZ-USER-01D) holds FRONTEND and I18N only, so nothing overlaps.
**Lifecycle:** 4-STEP (security). **Evidence class:** LOCAL-TESTS. The staging deploy is a separate task (section 9).
**Admitted:** 80b5887 (TASKS.md:701; TASKS_BACKLOG_FULL.md:87399; sidecar lane2 at `docs/control-plane/lane-saturation-state.json:29-40`).
**Drafted from:** `main` 80b5887, read-only. The container-manager baseline was rerun here at 80b5887: 12 suites, 224 passed.
**Implementer:** a Claude subagent on **opus** (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\CM-AUTH-01` on branch `lane/CM-AUTH-01`. Opus because the task adds a guard to internal routes, changes how the internal key is sent in three services, and closes a path-traversal hole in a key-bearing proxy (Model Routing).

## 1. Goal

Every container-manager route except `GET /api/health` needs `X-Internal-Service-Key`. Every caller sends the key from `INTERNAL_SERVICE_KEY`. The browser never sees the key, and a sandbox container never receives it. No browser request can steer a key-bearing gateway call to a different container-manager route.

## 2. What is true today

- **Prefix.** Container-manager sets the global prefix `api` (`services/container-manager/src/main.ts:27`). The bind is `127.0.0.1` (`main.ts:31-32`; staging confirmed in docs/STAGING-DEPLOY-SEC-01-CHECKPOINT.md, "Security checks").
- **Guard.** `InternalServiceAuthGuard` (`src/guards/internal-service-auth.guard.ts:43-69`):
  - it compares the key in constant time with `internalKeyMatches` (`:16-29`) and refuses with **403** `Forbidden` (`:63-65`);
  - its constructor throws when `INTERNAL_SERVICE_KEY` is unset (`:47-54`). Nest builds `@UseGuards` guards at bootstrap, so container-manager **refuses to start without the key** today.
- **Coverage.** Only the controllers whose path starts `internal` (or `api/internal`) carry `@UseGuards(InternalServiceAuthGuard)` at class level. There is no `APP_GUARD` (`src/app.module.ts:12-26`, `providers: []`).
- **CORS.** CORS is `origin: true, credentials: true` (`main.ts:13-16`). No browser caller exists (section 4).
- **Proxies forward every request header to the container.** The three `http-proxy-middleware` proxies set no header filter (`preview/preview.controller.ts:91-114`, `previews/previews.controller.ts:212-249`, `previews/internal-previews-proxy.controller.ts:43-73`). Once the gateway sends the key on preview traffic, **the sandbox's preview server would receive it** unless container-manager strips it.
- **WebSocket upgrades skip every guard.** Two proxies set `ws: true` (`preview.controller.ts:94`, `previews.controller.ts:215`). http-proxy-middleware 3.0.5 then subscribes to the HTTP server's `upgrade` event on the first proxied request, with the default path filter `/`. From then on, **any** upgrade request to 4002, on any path, is proxied to that session's container. Nest guards never run on `upgrade`. A new instance is made on every request, so listeners pile up (`node_modules/http-proxy-middleware/dist/http-proxy-middleware.js:48-60`). No legitimate caller uses WebSockets to 4002 (section 5).

## 3. Route table (64 routes; with prefix `api`)

G = guarded today (class-level `InternalServiceAuthGuard`, 403). — = no guard.

| Controller (file:line) | Routes | Today | Caller | After |
|---|---|---|---|---|
| `health/health.controller.ts:3,5` | `GET /api/health` | — | ops `ops-lib.sh:1705`; `t1-prepare.sh:122,192`; watchdog `ops-watchdog.js:54`; compose healthcheck `docker-compose.prod.yml:175` | **open** (`@InternalKeyExempt()`) |
| `executor/executor.controller.ts:4` | `POST :sessionId/execute` (:8), `GET commands` (:17) | — | none | key |
| `files/files.controller.ts:11` | `GET :id/list` (:15), `POST :id/read` (:23), `POST :id/write` (:31), `DELETE :id/delete` (:43), `POST :id/mkdir` (:51), `POST :id/search` (:59) | — | write: ai-service `messages.service.ts:327`; delete: ai-service `:337`; the other four have no caller | key |
| `git/git.controller.ts:4` | `POST :id/init` (:8), `POST :id/commit` (:16), `GET :id/history` (:33), `POST :id/revert` (:41), `GET :id/checkpoints` (:50), `GET :id/diff/:hash` (:58) | — | init: CM self-call `sessions.service.ts:180-184`; commit: gateway client `:740`, ai-service `:361`; revert: client `:682`; diff: client `:599`; history and checkpoints have no caller | key |
| `sessions/sessions.controller.ts:5` | `POST /` (:9), `POST :id/start` (:17), `GET :id` (:23), `GET user/:userId` (:28), `POST :id/stop` (:33), `DELETE :id` (:38), `GET /` (:43, a second health reply) | — | start: client `:88`; stop: client `:126`; delete: client `:170`; the other four have no caller | key (DECISION 2) |
| `preview/preview.controller.ts:6` | `POST :id/start` (:10), `POST :id/stop` (:24), `DELETE :id/stop` (:34), `GET :id/status` (:40), `GET :id/proxy*` (:58) | — | gateway preview proxy `api-gateway/src/preview/preview.controller.ts:44,73` (browser via Caddy) | key |
| `previews/previews.controller.ts:51` | `GET :id/health` (:109), `ALL :id/*` (:190) | — | none | key |
| `previews/internal-previews-proxy.controller.ts:15` | `ALL :id/*` (:32) | — | none | key |
| `sessions/internal-sessions.controller.ts:29-30` | 10 routes (:51, 80, 103, 144, 187, 217, 238, 280, 336, 366) | G | gateway client (section 4) | key |
| `previews/internal-previews.controller.ts:21-22` | `POST internal/sessions/:id/previews` (:50) | G | none | key |
| `git/internal-checkpoint-history.controller.ts:19-20` | save (:24), restore (:34) | G | client `:779,818` | key |
| `git/internal-worktree-diff.controller.ts:9-10` | `GET :id/worktree-diff/:hash` (:14) | G | client `:637` | key |
| `stats/internal-stats.controller.ts:18-19` | `GET /api/internal/stats` (:27) | G | client `:214` | key |
| `billing/billing-export.controller.ts:32-33` | 3 routes (:61, 172, 278) | G | client `:257` (path mismatch, F2) | key |
| `usage/internal-quota-visibility.controller.ts:30-31` | 3 routes (:50, 133, 184) | G | `admin/admin.service.ts:76-82` (path mismatch, F2) | key |
| `usage/internal-quota-evaluation.controller.ts:24-25` | 6 routes | G | none | key |
| `usage/internal-usage-aggregation.controller.ts:24-25` | 7 routes | G | none | key |

**Totals:**
- **Today:** 34 guarded, 30 not guarded (health included).
- **After:** 63 need the key, and only `GET /api/health` stays open.
- Ops and the watchdog use only `GET /api/health`, so they are unaffected. The watchdog's other probes go to 4000 and 4001 (`ops-watchdog.js:17,30`).

## 4. Callers and the key (25 call sites)

| Caller | Call sites | Sends the key today? | Change |
|---|---|---|---|
| Gateway `ContainerManagerHttpClient` | 18 calls: `container-manager-http.client.ts:88, 126, 170, 214, 257, 307, 347, 377, 408, 434, 460, 501, 599, 637, 682, 740, 779, 818` | **Yes, all 18**, in a per-call header (`:92-93`, `:133-134`, `:174-175`, ... `:822-823`). It refuses to start in production without the key, and in development it disables itself (`:53-72`). | No code change. Add a test that pins the header on all 18 methods (today 6 assertions, `container-manager-http.client.spec.ts`). See SCOPE 1. |
| Gateway `AdminService` | 1: `admin/admin.service.ts:76-82` | Yes (`:79-81`) | None |
| Gateway `PreviewController` | 2: stop `preview/preview.controller.ts:44-49`; catch-all `:73-81` | **No.** It strips a browser-sent key (`:7-27`, `x-internal-service-key` at `:12`) but adds none. | Add the key server-side, after sanitizing (D4). Add the path allowlist (D5, DECISION 4). |
| ai-service `MessagesService` (legacy chat) | 3: `messages/messages.service.ts:326-331` (write), `:336-338` (delete), `:360-367` (commit) | No | Add the header from `INTERNAL_SERVICE_KEY` on all three; leave it out when the key is unset. ai-service already requires the key at start (`clients/api-gateway-http.client.ts:26-31`). The path has no live caller: nothing calls ai-service `/api/messages/chat`. |
| Container-manager itself | 1: `sessions/sessions.service.ts:180-184` (`POST http://localhost:4002/api/git/:id/init`, inside `createSession`) | No | Add the header. Only reached from `POST /api/sessions`, which has no caller, but it would fail silently once guarded. |

**Not callers:** the frontend (no 4002 or container-manager reference, and `frontend/next.config.js:10-15` rewrites to the gateway only), Caddy (`/api/*` goes to 4000, `ops/clean-baseline/caddy/Caddyfile:11-13`), sandbox containers (none configured; docs/AI-SERVICE-AUTH-01-STAGE-START.md section 3), and the browser-smoke container (it loads `SMOKE_URL` inside its own container).

## 5. Proxies and streams

**How preview traffic flows today.**
1. Browser: `fetch('/api/preview/<sid>/start|status|stop')` (`frontend/app/[locale]/app/page.tsx:6131,6192`; `components/workspace/workspace-shell.tsx:4961`) and an iframe on `/api/preview/<sid>/proxy?refresh=...` (`components/workspace/workspace-preview.logic.ts:65`).
2. Caddy (basic_auth) sends it to the gateway on 4000.
3. Gateway `PreviewController`:
   - `SessionCookieGuard` and `PreviewOwnershipGuard` run (`:29`); ownership uses raw path segment 3 (`preview-ownership.guard.ts:31-32`);
   - axios goes to `CONTAINER_MANAGER_URL + req.path` (`:69`), with `responseType: 'stream'` for `/proxy` paths (`:79`), copying container-manager's response headers back (`:84-86`).
4. Container-manager `PreviewController` serves static HTML itself (`:73-86`) or proxies to `http://<containerIP>:<port>` (`:88-117`; target at `preview/preview.service.ts:273`).

**Browser-direct to 4002:** none. After the loopback bind it is impossible anyway. **WebSockets to 4002:** none. The gateway proxies with axios, which cannot upgrade, and the gateway's own socket.io gateway (`websocket/websocket.gateway.ts:100`) is unrelated. So preview HMR never worked through the gateway, and removing `ws: true` changes nothing a user sees.

**FINDING (today, before this task): the gateway preview proxy can be steered to any container-manager route.**
- Express 4.22.1 matches the raw path, so `/api/preview/<own-sid>/%2e%2e/%2e%2e/files/<other-sid>/list` hits `@All('*')`.
- Ownership checks segment 3, which is `<own-sid>`.
- axios then builds `new URL(...)` (`node_modules/axios/lib/adapters/http.js:413`), and URL parsing collapses `%2e%2e`. Checked here with Node: the request reaches `/api/files/<other-sid>/list`, and `/api/preview/sid/%2E%2E/%2e./executor/<x>/execute` reaches `/api/executor/<x>/execute`.
- Today that reaches the unguarded files, git and executor routes for any session.
- **If the gateway simply adds the key, the same trick reaches every `internal/*` route too** (exec, file write, container delete).
- It needs a logged-in owner of one session, and on staging it sits behind Caddy basic_auth.
- This is not live-tested (no servers started). It is shown from the code and the URL parse.

So D5 is a precondition for D4. They land together or not at all.

**Header leak to the container.** Once D4 is in, the gateway's request to container-manager carries the key. Container-manager must remove `x-internal-service-key` before any proxied request leaves for a container (D6).

## 6. Design

| # | Decision |
|---|---|
| D1 | **Global guard.** Register `{ provide: APP_GUARD, useClass: InternalServiceAuthGuard }` in `src/app.module.ts`. The guard takes `Reflector` (made with `new Reflector()` when none is injected, so the existing `new InternalServiceAuthGuard()` specs still work). It returns true only for a handler carrying `@InternalKeyExempt()` (new `src/guards/internal-key-exempt.decorator.ts`, same name as ai-service). The decision is per handler, never from the path text. Otherwise the guard behaves as today: `internalKeyMatches` and **403** `Forbidden`, and the constructor throws without the key (DECISION 1, DECISION 3). |
| D2 | **Exempt:** `HealthController.getHealth` only (`health/health.controller.ts:5`). Keep the existing class-level `@UseGuards(InternalServiceAuthGuard)` on the `internal*` controllers. Their specs assert that metadata (for example `git/internal-worktree-diff.controller.spec.ts:20-22`), and running the check twice costs nothing. |
| D3 | **Container-manager self-call.** `sessions.service.ts:180-184` sends the header from `process.env.INTERNAL_SERVICE_KEY`. |
| D4 | **Gateway preview proxy sends the key.** Read `INTERNAL_SERVICE_KEY` once at construction, beside `containerManagerUrl` (`preview.controller.ts:32`). Both axios calls send `{ ...sanitizeProxyHeaders(req.headers), 'X-Internal-Service-Key': key }` (catch-all) and `{ 'X-Internal-Service-Key': key }` (stop). Sanitizing comes first, so a browser-sent key is dropped and replaced, never forwarded. When the key is unset, leave the header out (container-manager then answers 403). Never log headers. `sanitizeProxyHeaders` and its denylist stay unchanged. |
| D5 | **Gateway preview path allowlist** (DECISION 4). Before any call, the catch-all parses `req.path` and accepts only these shapes: `/api/preview/<sid>/start`, `/stop`, `/status` exactly; `/api/preview/<sid>/proxy`; or `/api/preview/<sid>/proxy/<rest>`. The rules: `<sid>` matches `^[A-Za-z0-9_-]{1,128}$` (gateway ids are UUIDs, `entities/session.entity.ts:23`; the existing specs use `session-123`). `<sid>` must equal the segment the ownership guard checked. No segment is `.` or `..`, or decodes to either. There is no `%2f`, `%5c` or backslash. The method is allowed for the shape (start: POST; stop: POST and DELETE; status and proxy: GET and HEAD). Then build the URL from `encodeURIComponent(sid)` and the allowed suffix, and check that `new URL(url).pathname` still starts with `/api/preview/<sid>/`. Anything else gets 404 with no container-manager call. The stop handler uses the same `sid` check. |
| D6 | **Container-manager proxies strip the key.** All three `createProxyMiddleware` calls add `on.proxyReq: (proxyReq) => proxyReq.removeHeader('x-internal-service-key')`. The static-HTML branch forwards nothing, so it needs no change. |
| D7 | **Remove `ws: true`** from `preview.controller.ts:94` and `previews.controller.ts:215` (DECISION 5). No `upgrade` listener is ever registered, so nothing on 4002 is reachable without passing a guard. |
| D8 | **ai-service legacy path.** The three calls in `messages.service.ts` pass `{ headers: { 'X-Internal-Service-Key': key } }`, with the key read from `process.env.INTERNAL_SERVICE_KEY` and the header left out when it is unset. Nothing else in that file changes (the delete query-vs-body mismatch is F4). |
| D9 | **Unchanged:** the header name, the secret name, `internalKeyMatches`, the 403 status, the gateway client's 18 calls (unless SCOPE 1), `admin.service.ts`, env files and templates, ops, systemd, compose, monitoring, Caddy, the frontend, CORS (F5), and the four `HARNESS_ENTITLEMENT_PROOF_V1` files. |

**DECISION 1 (settled 2026-11-10: recommendation) — global guard (recommend: global `APP_GUARD` plus `@InternalKeyExempt()`).** It fails closed for any new route, and it matches ai-service. Alternative: add `@UseGuards` to the eight unguarded controllers. That works today, but a future controller that forgets it is open.

**DECISION 2 (settled 2026-11-10: recommendation) — `GET /api/sessions` (recommend: guard it).** It duplicates the health reply (`sessions.controller.ts:43-50`) and nothing calls it. Every probe uses `/api/health`. Alternative: exempt it too, which keeps two open routes for no caller.

**DECISION 3 (settled 2026-11-10: recommendation) — status code (recommend: keep 403).** This is the existing container-manager guard, its specs (`guards/internal-service-auth.guard.spec.ts`), and what the gateway already maps through `throwContainerManagerError` (`container-manager-http.client.ts:526-547`). Alternative: 401, like ai-service. That changes the existing guard's behavior for no gain.

**DECISION 4 (settled 2026-11-10: recommendation) — fix the preview traversal here (recommend: yes, D5).** Adding the key without D5 turns a hole that reaches the unguarded routes into one that reaches every route. The fix sits in `services/api-gateway/src/preview/`, inside the admitted write set and the GATEWAY mutex. Alternative: register it as a separate task and hold CM-AUTH-01's gateway change until it locks. That costs a second lifecycle and leaves today's hole open meanwhile.

**DECISION 5 (settled 2026-11-10: recommendation) — WebSocket proxying (recommend: remove `ws: true`).** No caller uses it (section 5), and upgrades bypass every guard. Alternative: keep it and check the key in a server `upgrade` handler. That is more code for a path nothing uses, and the gateway still could not carry it.

**SCOPE 1 — encode path parameters in the gateway client (recommend: include).** `container-manager-http.client.ts` puts `sessionId` and `commitHash` into paths raw (for example `:600`, `:683`), and only `:637` uses `encodeURIComponent`. Today the database lookups before each call (for example `checkpoints/checkpoints.service.ts:65-71`) stop a crafted value. Encoding every parameter makes a key-bearing call unsteerable by construction. It changes nothing for valid UUIDs and hex hashes. It is in `services/api-gateway/src/clients/`, already in the write set. Alternative: leave it, as today.

## 7. Files

| File | Change |
|---|---|
| `services/container-manager/src/guards/internal-service-auth.guard.ts` + spec | D1: `Reflector`, exempt check; compare, 403 and start-up throw unchanged |
| `services/container-manager/src/guards/internal-key-exempt.decorator.ts` (new) | `@InternalKeyExempt()` |
| `services/container-manager/src/app.module.ts` | `APP_GUARD` provider |
| `services/container-manager/src/health/health.controller.ts` | the decorator on `getHealth` |
| `services/container-manager/src/sessions/sessions.service.ts` | D3 |
| `services/container-manager/src/preview/preview.controller.ts`, `previews/previews.controller.ts`, `previews/internal-previews-proxy.controller.ts` | D6, D7 |
| `services/container-manager/src/__tests__/internal-key.http.spec.ts` (new), proxy spec (new) | section 8 |
| `services/api-gateway/src/preview/preview.controller.ts` + `preview/__tests__/` | D4, D5; update `preview.endpoint-contract.spec.ts:167`, which asserts that stop sends no headers |
| `services/api-gateway/src/clients/container-manager-http.client.ts` + spec | header test on all 18 methods; code only if SCOPE 1 |
| `services/ai-service/src/messages/messages.service.ts` + `messages/__tests__/messages.service.spec.ts` | D8 |

All of these are in the admitted write set. `admin.service.ts` needs no change.

## 8. Tests and gates

**New tests.**
- **Container-manager guard (unit):**
  - an exempt handler passes with no key;
  - a non-exempt handler gets 403 for no header, a wrong key, a wrong length or an array;
  - the right key passes;
  - the constructor still throws without the env key.
- **Container-manager HTTP.** A real Nest app built with `NestFactory.create` on a test module that holds the real controllers with mocked services and the `APP_GUARD`, `setGlobalPrefix('api')`, `listen(0, '127.0.0.1')`, and built-in `fetch`. `@nestjs/testing` and supertest are not declared in `services/container-manager/package.json`, and adding them needs PACKAGE.
  - every one of the 63 routes answers 403 with no key and with a wrong key, and its service mock is not called;
  - a sample from each controller reaches its handler with the right key;
  - `GET /api/health` returns 200 with no key;
  - changed-case paths and trailing slashes never reach a handler without the key.
- **Route inventory.** Walk `AppModule`'s imported modules and controllers through `MODULE_METADATA` and `PATH_METADATA`.
  - Assert that exactly one handler (`HealthController.getHealth`) carries the exempt metadata, and that `AppModule` provides `APP_GUARD`.
  - Print each route's full path, which also confirms F2.
- **Container-manager proxies:**
  - a local upstream server (loopback, ephemeral port) records the headers it receives;
  - a request through each proxy carrying `x-internal-service-key` arrives upstream without it;
  - after a proxied request, `server.listenerCount('upgrade')` is 0.
- **Container-manager self-call:** the `git init` post carries the header.
- **Gateway preview:**
  - both axios calls carry the server key; a browser-sent key is replaced, never forwarded;
  - with no env key, the header is absent;
  - allowed shapes still forward (the existing proxy-target and endpoint-contract specs, updated only at `:167`);
  - `..`, `%2e%2e`, `%2E.`, `%2f`, backslash, an unknown suffix (`/api/preview/<sid>/files`), a bad method and a bad sid each get 404 with axios **not called**.
- **Gateway client:** each of the 18 methods sends `X-Internal-Service-Key`. With SCOPE 1, also that `/`, `..` and `?` in parameters are encoded.
- **ai-service:** the three calls carry the header when the key is set, and leave it out when unset.

**Gates (compare with the known baselines).**

| Service | Commands | Baseline |
|---|---|---|
| container-manager | `npm test`; `npm run build` | 12 suites, 224 passed (rerun here at 80b5887) |
| api-gateway | `npx jest --maxWorkers=2`; `npm run build` | 3065 passed, 7 skipped; 14 failed, all in `smoke.integration.spec.ts` (BIZ-USER-01C lock 8fe430f) |
| ai-service | `npx jest --runInBand`; `npm run build` | 1308 passed, 1 skipped (AI-SERVICE-AUTH-01 checkpoint) |

No Docker, database or service is started. The only listeners are in-test ones on 127.0.0.1 with ephemeral ports.

**Checklists on the checkpoint:**
- EVERY 11.
- BACKEND 6:
  - item 1 is met by this task's explicit auth scope;
  - item 2: the internal routes keep their guard and stay unreachable from the frontend;
  - item 4: no frozen contract is touched;
  - item 5: n/a, no schema change.
- UI, FLOWS and MIGRATION: n/a.
- DEPLOY: applies to F1.

## 9. Shared contract and env

- **Contract.** The internal key header is not a registered frozen contract. The sidecar lists only `HARNESS_ENTITLEMENT_PROOF_V1` (`lane-saturation-state.json:6377`). CM-AUTH-01's `sharedContractIds` and `mutatesSharedContractIds` are `[]`.
  - The four frozen files are outside the write set and need no change. `ai/ai-execution.controller.ts` and `orchestration/orchestration.service.ts` use the client but are not edited.
  - Header and secret names stay. Lane 1 does not use the key.
  - So no freeze is needed. A needed change to any of these is a stop condition.
- **cm.env.**
  - Container-manager already needs `INTERNAL_SERVICE_KEY` to start (section 2). `cm.env.template:3` carries the name.
  - `aisandbox-prepare` copies or generates one value across gateway.env and ai.env (`ops/clean-baseline/bin/aisandbox-prepare:430`) and across gateway.env and cm.env (`:432`).
  - STAGING-DEPLOY-SEC-01 confirmed that gateway.env and ai.env match. It did not compare cm.env.
  - No env change is expected.
  - The deploy must confirm, by name and match only: `INTERNAL_SERVICE_KEY` is present and non-empty in cm.env, and its hash equals gateway.env's and ai.env's. It prints only "match" or "differ". A "differ" is a STOP, and the fix is an ENV task.

## 10. Follow-ups (named here, disposed at LOCK)

| # | Follow-up | Recommendation |
|---|---|---|
| F1 | **STAGING-DEPLOY-CMAUTH-01.** Deploy with runs off, tester window closed, STAGING held, and ENV only if cm.env fails the match. The host checks, from the staging host with the key read from env files and never printed:<br>- before the deploy, the cm.env key matches gateway.env and ai.env by hash;<br>- the standard deploy checks pass;<br>- `127.0.0.1:4002/api/health` returns 200 with no key;<br>- `GET /api/executor/commands`, `GET /api/sessions`, `GET /api/files/<x>/list` and `GET /api/preview/<x>/status` return 403 with no key and with a wrong key;<br>- `GET /api/executor/commands` returns 200 with the key;<br>- `/api/internal/stats` returns 403 without the key and 200 with it;<br>- through Caddy with the stored test key on an owned session: a workspace file list, preview status and the checkpoint list all work;<br>- `/api/preview/<own>/%2e%2e/%2e%2e/executor/commands` never returns 200;<br>- the startup journal is clean, and no output contains key text. | Register. Ready when CM-AUTH-01 is LOCKED. Keith decides. |
| F2 | **Double prefix.** `billing-export`, `quota-visibility`, `quota-evaluations` and `usage-aggregations` declare `api/internal/...` under the global prefix `api`, so they serve at `/api/api/internal/...`. The gateway calls `/api/internal/billing-export/...` (client `:258`) and `/api/internal/quota-visibility/...` (`admin.service.ts:77`), so those calls should 404 today: the admin ops summary falls back to UNKNOWN and the billing export to null. The route-inventory test confirms it. | Register NOT_READY (CONTAINER-MANAGER or GATEWAY), or Keith drops it. |
| F3 | **Orphaned routes.** `previews/*` and `internal-previews/proxy/*` have no caller, and their `pathRewrite` prefixes miss `/api` (`previews.controller.ts:218`, `internal-previews-proxy.controller.ts:48`). Executor, files list/read/mkdir/search, sessions create/get/list and git history/checkpoints also have no caller. All proxies make a new middleware per request, each adding a server `close` listener. | Register NOT_READY: remove or fix. Or Keith drops it. |
| F4 | **ai-service legacy chat path.** It has no caller, and its delete sends `?path=` while container-manager reads the body (`files.controller.ts:43-48`). | Register a removal NOT_READY, or Keith drops it. |
| F5 | **Container-manager CORS.** `origin: true, credentials: true` (`main.ts:13-16`), with no browser caller. | Register NOT_READY (turn it off), or Keith drops it. |

## 11. Stop conditions for the implementer

STOP and report if:
- a caller of container-manager is found that is not in section 4, or any caller is off the host or in a container;
- a route other than `GET /api/health` seems to need to stay open;
- an allowed preview shape that the frontend uses would be refused by D5;
- a `HARNESS_ENTITLEMENT_PROOF_V1` file, the header name, the secret name or the 403 status would change;
- a file outside section 7 needs a change, including env, ops, systemd, compose, monitoring, Caddy, the frontend or records;
- a new dependency seems needed (PACKAGE);
- the key would appear in a log, a response, or a request to a container;
- a gate fails outside the known failures.
