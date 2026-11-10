# AI-SERVICE-AUTH-01 — Stage-start

**Task:** AI-SERVICE-AUTH-01 — Internal services listen on loopback and check the internal key
**Status:** STAGE-START — APPROVED by the control plane on 2026-11-10 under Keith's instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start"). Drafted by an opus subagent. DECISIONs 1-3 and SCOPE 1-2 settled with the drafter's recommendations (all fail-closed and inside the task's mutexes); F5 is fixed in this task instead of dropped.
**Lane:** 2. **Mutexes:** GATEWAY, AI-SERVICE, CONTAINER-MANAGER. Lane 1 (BIZ-USER-01B) holds FRONTEND and I18N only: no overlap.
**Lifecycle:** 4-STEP (security). **Evidence class:** LOCAL-TESTS. The staging deploy is a separate task (section 8).
**Admitted:** ba0dbd1 (TASKS.md:681-684; TASKS_BACKLOG_FULL.md:87284).
**Drafted from:** `main` ba0dbd1, read-only. Staging host evidence: `C:\Users\knlee\aisb-preflight\SEC-26\sec26-ports.out` (2026-11-10).
**Implementer:** a Claude subagent on **opus** (Opus 5.5), in worktree `C:\Users\knlee\aisb-worktrees\AI-SERVICE-AUTH-01` on branch `lane/AI-SERVICE-AUTH-01`. Opus because the task changes guards, the internal service key and internal routes across three services (Model Routing).

## 1. Goal

ai-service, container-manager and the gateway accept connections only from the host itself. Every ai-service route except health and metrics needs `X-Internal-Service-Key`. The gateway's key compare is constant-time. No caller breaks.

## 2. What is true today

**Listeners (staging, sec26-ports.out).** `*:4000`, `*:4001`, `*:4002` (all interfaces); Caddy `*:80`, `*:443`; next-server `127.0.0.1:3002`; postgres and redis on loopback. ufw inactive, iptables `-P INPUT ACCEPT`. ai.env sets `PORT` and no host key. The Lightsail firewall is recorded as 80, 443 and SSH from Keith's address only.

**Binds in code.**
- ai-service: `app.listen(port)` with no host (`services/ai-service/src/main.ts:83-84`).
- container-manager: same (`services/container-manager/src/main.ts:28-29`).
- gateway: same (`services/api-gateway/src/main.ts:74-75`).
- frontend already binds loopback: `next start -p 3002 -H 127.0.0.1` (`ops/clean-baseline/systemd/aisandbox-frontend.service:16`).

**Sandbox containers can reach all three today.** Containers are created on Docker's default bridge: no `NetworkMode`, no `PortBindings`, no `ExtraHosts`, no platform URL in their env (`services/container-manager/src/docker/docker-runtime.service.ts:97-120`). Nothing in a container is configured to call the platform. But with `*:` binds and `INPUT ACCEPT`, code in any sandbox can open `172.17.0.1:4000/4001/4002` (the bridge gateway). The Lightsail firewall does not see that traffic. That is the real exposure, more than the internet:
- 4001: no guard at all (no `APP_GUARD`, `UseGuards` or `CanActivate` in `services/ai-service/src`).
- 4002: many container-manager routes have no guard: `executor` (`executor/executor.controller.ts:4,8`; `node` is on the allowlist, `executor/executor.service.ts:18`), `files` (`files/files.controller.ts:11`), `git` (`git/git.controller.ts:4`), `sessions` (`sessions/sessions.controller.ts:5`), `preview` (`preview/preview.controller.ts:6`), `previews` (`previews/previews.controller.ts:51`), `internal-previews/proxy` (`previews/internal-previews-proxy.controller.ts:15`). Only the `internal/*` controllers carry `InternalServiceAuthGuard`. So a sandbox that knows another session's id can read and write its files and run `node` in its container.
- 4000: reachable without Caddy, so without staging's `basic_auth` (`ops/clean-baseline/caddy/Caddyfile:2-4`). Its own auth still applies.

Loopback binds close all three from the bridge, because a container's 127.0.0.1 is its own.

**Shared key.** Header `X-Internal-Service-Key`, secret `INTERNAL_SERVICE_KEY`.
- Gateway guard compares with `!==` (`services/api-gateway/src/guards/internal-service-auth.guard.ts:72-82`, compare at `:79`). Its warning says endpoints are "UNPROTECTED" when the key is unset, although they are refused (`:45-49`; recorded in docs/AUTH-GUARD-01-CHECKPOINT.md:55).
- container-manager guard also uses `!==` (`services/container-manager/src/guards/internal-service-auth.guard.ts:40`).
- ai-service already holds the key and fails to start without it (`services/ai-service/src/clients/api-gateway-http.client.ts:26-31`). It uses it only outbound today.

**Frozen contracts.** The sidecar has one: `HARNESS_ENTITLEMENT_PROOF_V1` (`docs/control-plane/lane-saturation-state.json:6221`). It covers `api-gateway/src/ai/ai-execution.controller.ts`, `ai-service/src/queue/job.types.ts`, `ai-service/src/worker/worker.processor.ts` and `api-gateway/src/orchestration/orchestration.service.ts`. This task's `sharedContractIds` is empty, and none of those four files needs to change.

## 3. Callers, by port

### Port 4000 (gateway)

| Caller | Target | Where |
|---|---|---|
| Caddy | `127.0.0.1:4000` | `ops/clean-baseline/caddy/Caddyfile:12` |
| Frontend server (rewrites) | `API_GATEWAY_URL` = `http://127.0.0.1:4000` | `frontend/next.config.js:10,15`; `ops/clean-baseline/env/frontend.env.template:2` |
| ai-service | `API_GATEWAY_URL` = `http://127.0.0.1:4000` | `services/ai-service/src/clients/api-gateway-http.client.ts:23`; `ai.env.template:8` |
| container-manager | `API_GATEWAY_URL` = `http://127.0.0.1:4000` | `services/container-manager/src/clients/api-gateway-http.client.ts:18`; `cm.env.template:6` |
| Deploy health check | `127.0.0.1:4000/api/health/ready` | `ops/clean-baseline/lib/ops-lib.sh:1700` |
| Watchdog (installed disabled, AUTH-W) | `127.0.0.1:4000` | `monitoring/watchdog/ops-watchdog.js:18`; `systemd/aisandbox-watchdog.service:2` |
| connectors-mcp | none: a gateway child on stdio | `services/api-gateway/src/connectors/connector-child.ts:57-60` |
| Sandbox containers | none configured | section 2 |

**Bind:** 127.0.0.1. Every caller is on the host and uses the literal 127.0.0.1.

### Port 4001 (ai-service)

| Caller | Target | Where |
|---|---|---|
| Gateway `AIServiceHttpClient` | `AI_SERVICE_URL` `POST /api/execute` | `services/api-gateway/src/clients/ai-service-http.client.ts:100,122-125`. Provided in `ai/ai.module.ts:63,69`, but no production class injects it (only specs do). ARCHITECTURE.md:285 calls it a leftover, not the execute path. **No live call.** |
| Gateway to worker (real path) | BullMQ over Redis, not HTTP | `services/api-gateway/src/queue/queue.service.ts:40`; ai-service `WorkerModule` |
| Watchdog (disabled) | `127.0.0.1:4001/metrics`, no key | `monitoring/watchdog/ops-watchdog.js:30` |
| Local Prometheus (compose) | `ai-service:4001/metrics` | `monitoring/prometheus/prometheus.yml:17`. That compose hostname does not exist locally (ARCHITECTURE.md:339). |
| Deploy health check | not checked | `ops-lib.sh:1695-1712` checks 4000, 4002 and 3002 only |
| Sandbox containers | none configured | section 2 |

**Bind:** 127.0.0.1. Nothing on staging calls it over HTTP today.

### Port 4002 (container-manager)

| Caller | Target | Where |
|---|---|---|
| Gateway client | `CONTAINER_MANAGER_URL` = `http://127.0.0.1:4002` | `services/api-gateway/src/clients/container-manager-http.client.ts:35`; `gateway.env.template:11` |
| Gateway admin | same | `services/api-gateway/src/admin/admin.service.ts:46` |
| Gateway preview proxy | same | `services/api-gateway/src/preview/preview.controller.ts:32` |
| ai-service (legacy chat path) | `CONTAINER_MANAGER_URL` = `http://127.0.0.1:4002` | `services/ai-service/src/messages/messages.service.ts:15,327,337,361`; `ai.env.template:9` |
| Deploy health check | `127.0.0.1:4002/api/health` | `ops-lib.sh:1705` |
| Watchdog (disabled) | `127.0.0.1:4002/api/health` | `ops-watchdog.js:54` |
| Sandbox containers | none. Previews flow the other way: container-manager dials the container's bridge IP. | `previews/preview-proxy.service.ts:70-90` |

**Bind:** 127.0.0.1.

**No bridge IP bind is needed.** No container calls the platform. Binding `172.17.0.1` would keep the exposure this task removes.

## 4. Design

| # | Decision |
|---|---|
| D1 | **Bind host.** Each service reads `LISTEN_HOST`. Blank or unset means `127.0.0.1`. The call is `app.listen(port, host)`. One small helper per service, `resolveListenHost(env)`, unit-tested. The startup log prints the real host and port. `HOST` is not used, because some shells set it to the machine name. See DECISION 1. |
| D2 | **All three services bind loopback**, the gateway included: section 3 shows only host-local callers. |
| D3 | **ai-service guard.** A global `APP_GUARD` (`services/ai-service/src/guards/internal-service-auth.guard.ts`, registered in `app.module.ts`). It refuses by default with 401 `Unauthorized`. A handler is open only if it carries an `@InternalKeyExempt()` decorator, read with `Reflector`. Deciding by handler, not by path text, means case changes, trailing slashes and new routes cannot open anything. The guard also refuses when the env key is unset, when the header is missing, when the header is not a single string (sent twice), or when it is wrong. |
| D4 | **ai-service routes.** Routes that need the key: `POST /api/execute` (`ai-execution/ai-execution.controller.ts:15`); `POST /api/messages/chat` and SSE `chat/stream` (`messages/messages.controller.ts:9,19`); `GET /api/conversations/:sessionId`, `.../messages`, `.../usage`, `.../quota-status` and `DELETE /api/conversations/:sessionId` (`conversations/conversations.controller.ts:12,17,28,33,40`); `GET /api/internal/metrics` (`metrics/metrics.controller.ts:8`); `GET /api/internal/queue/stats` (`internal/queue.controller.ts:15`). Open routes: `GET /api/conversations` (health, `conversations.controller.ts:47`), `POST /api/messages/health` (`messages.controller.ts:46`) and `GET /metrics` (Prometheus counters with no labels, `observability/metrics.controller.ts:14`). There is no `/api/health` route on ai-service, although `main.ts:90` logs one; fix that log line. See DECISION 2. |
| D5 | **Constant-time compare.** A small helper `internalKeyMatches(provided, expected)`: false unless both are non-empty strings, `Buffer.from(..., 'utf8')` for each, false if the lengths differ, else `crypto.timingSafeEqual`. Used by the gateway guard (replaces `:79`) and by the new ai-service guard (a copy per service, since there is no shared package). The gateway's accept and refuse results stay exactly the same. Fix the stale "UNPROTECTED" warning text in the same file (`:45-49`). |
| D6 | **Gateway client.** `AIServiceHttpClient` sends `X-Internal-Service-Key` from `INTERNAL_SERVICE_KEY`, and leaves the header out when the key is unset. It is the only gateway call site for ai-service, and it is dead today (section 3). See DECISION 3. Update the exact-config assertion at `clients/ai-service-http.client.spec.ts:36-42`. |
| D7 | **Unchanged:** the header name, the secret name, the gateway's protected prefixes, the worker and queue path (Redis, no HTTP), the four frozen-contract files, CORS, ports, env templates, systemd units, compose files, ops scripts and monitoring. |

**DECISION 1 — bind default (settled 2026-11-10: default 127.0.0.1).** Recommend a default of `127.0.0.1`, so the code fails closed and staging needs no env change. Alternative: default `0.0.0.0`, with staging setting `LISTEN_HOST=127.0.0.1`. That needs ENV in the deploy and fails open if the line is forgotten. The cost of the recommended default: `docker-compose.prod.yml` reaches the services by compose name (`:85,132-133,168,192`), so it would need `LISTEN_HOST=0.0.0.0`. ARCHITECTURE.md:150 calls it "Alternate / future", not current (follow-up F3). Local development is unaffected: services run on the host, `docker-compose.yml` runs infrastructure only (ARCHITECTURE.md:149), and local URLs use `localhost`, which Node 22 resolves to both ::1 and 127.0.0.1.

**DECISION 2 — `/metrics` open (settled 2026-11-10: open, loopback-only).** Recommend leaving it open. It is loopback-only after D1, it holds aggregate counters only, and the watchdog and Prometheus send no key. Alternative: guard it too, and later give the watchdog the key (monitoring is not in this write scope).

**DECISION 3 — leftover gateway client (settled 2026-11-10: add the header).** Recommend adding the header: two lines, it stays correct if the client is ever used again, and it meets the registry's wording. Alternative: delete the client. Several specs import its types, so that is a refactor outside this task.

## 5. Files

| File | Change |
|---|---|
| `services/ai-service/src/main.ts` | `LISTEN_HOST` bind; fix the log lines (`:88-91`) |
| `services/ai-service/src/config/listen-host.ts` (new) + spec | `resolveListenHost` |
| `services/ai-service/src/guards/internal-service-auth.guard.ts` (new) + spec | D3, D5 |
| `services/ai-service/src/guards/internal-key-exempt.decorator.ts` (new) | `@InternalKeyExempt()` |
| `services/ai-service/src/app.module.ts` | `APP_GUARD` provider |
| `services/ai-service/src/conversations/conversations.controller.ts`, `messages/messages.controller.ts`, `observability/metrics.controller.ts` | the decorator on the three open handlers only |
| `services/ai-service/src/__tests__/internal-key.http.spec.ts` (new) | HTTP tests (section 6) |
| `services/api-gateway/src/main.ts` | `LISTEN_HOST` bind; log line |
| `services/api-gateway/src/startup/listen-host.ts` (new) + spec | `resolveListenHost` |
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` + both existing specs | D5 |
| `services/api-gateway/src/clients/ai-service-http.client.ts` + spec | D6 |
| `services/container-manager/src/main.ts` | `LISTEN_HOST` bind; log line |
| `services/container-manager/src/listen-host.ts` (new) + spec | added to the write set (SCOPE 1, settled 2026-11-10) |

**SCOPE 1 (settled 2026-11-10: added).** The admitted container-manager write set is `src/main.ts` only. A test of the bind default needs a spec file. Testing `main.ts` directly is awkward, because importing it starts `bootstrap()`. Recommend widening the write set to `services/container-manager/src/listen-host.ts` and its spec. CONTAINER-MANAGER is already held, so nothing else changes.

**SCOPE 2 (settled 2026-11-10: added; services/container-manager/src/guards/internal-service-auth.guard.ts and its spec).** The container-manager guard has the same `!==` compare (`guards/internal-service-auth.guard.ts:40`). Recommend adding that file and its spec to the write set, so all three services compare keys the same way (same mutex, a two-file change). Alternative: follow-up F4.

**Out of scope:** guards on container-manager's unguarded routes (F2), env files, systemd, Caddy, compose, ops, monitoring, the frontend, records, the deploy.

## 6. Tests and gates

**New tests.**
- ai-service guard (unit): no header, wrong key, wrong length, header sent twice and env key unset are all 401; the right key passes; an exempt handler passes with no key.
- ai-service HTTP (real Nest app on `listen(0, '127.0.0.1')`, global `fetch`, mocked services; supertest is not a declared dependency of ai-service, and adding one needs PACKAGE):
  - every D4 guarded route returns 401 with no key and with a wrong key, and its service is not called;
  - with the key, each reaches its handler;
  - a changed-case path such as `/API/EXECUTE` never reaches a handler without the key;
  - the three open routes return 200 with no key.
- Route inventory: every route in `AppModule` is either guarded or one of exactly the three open handlers, so a new route cannot be open by accident.
- Compare (gateway and ai-service): equal key true; same-length wrong key false; different length false; empty, undefined and array false; `crypto.timingSafeEqual` is called for equal lengths (spy).
- Gateway guard: the existing specs still pass unchanged (`guards/internal-service-auth.guard.spec.ts`, `guards/internal-service-auth.guard.http.spec.ts`).
- Gateway client: the header is sent when the key is set, and left out when it is not.
- `resolveListenHost` (three services): unset gives `127.0.0.1`, blank gives `127.0.0.1`, `0.0.0.0` is kept, the value is trimmed. Plus a source check that each `main.ts` calls `app.listen(port, host)` with the helper.

**Gates (compare with the known baselines).**

| Service | Commands | Baseline |
|---|---|---|
| ai-service | `npx jest --runInBand`; `npm run build` | 1231 passed, 1 skipped |
| api-gateway | `npx jest`; `npm run build` | 3004 passed, 7 skipped, 14 failed, all in `smoke.integration.spec.ts` |
| container-manager | `npm test`; `npm run build` | 10 suites, 206 passed (HARNESS-FIXES-01A checkpoint:31; rerun at ba0dbd1 on 2026-11-10: 206 of 206) |

No local runtime is started (LOCAL-TESTS).

**Checklists on the checkpoint:**
- EVERY 11.
- BACKEND 6. Item 1 is met by this task's explicit auth scope. Item 4: no frozen contract is touched.
- UI and FLOWS: not applicable (no frontend, checkpoint or file-action change).
- DEPLOY: applies to F1, not here.

## 7. Shared contract

The internal key header is not a registered frozen contract. The sidecar lists only `HARNESS_ENTITLEMENT_PROOF_V1`, and this task's `sharedContractIds` is `[]`. The task keeps the header and secret names. It changes the gateway compare without changing what it accepts, and it adds one new checker (ai-service) using the same header. Lane 1 does not use it. So no freeze or change protocol is needed. If the implementer finds the header name, the secret name or any frozen-contract file must change, that is a stop condition.

## 8. Deploy (named, not done here): STAGING-DEPLOY-SEC-01

- **Mutexes:** STAGING; ENV only if a key name is missing. Evidence STAGING-RUNTIME. Runs stay off (GLOBAL_EXECUTION_ENABLED false). The tester window is closed.
- **Env:** with DECISION 1 as recommended, no env change for the binds. ai.env must hold `INTERNAL_SERVICE_KEY`. That is expected: it is in `ai.env.template:6`, and ai-service cannot start without it (`api-gateway-http.client.ts:26-31`), yet it is listening on staging. The host check confirms it by name only, and confirms that the ai.env and gateway.env values match by comparing hashes, printing only "match" or "differ".
- **After the deploy:**
  - `ss -ltnp` shows 4000, 4001 and 4002 on `127.0.0.1` only, with 80 and 443 unchanged.
  - The existing health checks pass (`ops-lib.sh:1695-1712`).
  - `127.0.0.1:4001/api/internal/queue/stats` returns 401 with no key, and 200 with the key (the script reads the key from ai.env and never prints it).
  - `127.0.0.1:4001/metrics` and `/api/conversations` return 200 with no key.
  - From a throwaway container on the default bridge (`node:24-alpine`, already on the host), `172.17.0.1:4000`, `:4001` and `:4002` all refuse the connection.
  - An owner request through Caddy that reaches container-manager still works (for example a workspace file list with the stored test key).

## 9. Follow-ups (named here, disposed at LOCK)

| # | Follow-up | Recommendation |
|---|---|---|
| F1 | STAGING-DEPLOY-SEC-01 (section 8) | Register. Ready when AI-SERVICE-AUTH-01 is LOCKED. Keith decides. |
| F2 | CM-AUTH-01: internal key on container-manager's unguarded routes (section 2), with the gateway (`container-manager-http.client.ts:89,127,171,600,683,741`) and ai-service (`messages.service.ts:327,337,361`) sending it | Register NOT_READY, 4-STEP. After the loopback binds it is defence in depth (host-local only). |
| F3 | `LISTEN_HOST=0.0.0.0` for the three services in `docker-compose.prod.yml` (COMPOSE) | Register NOT_READY, or Keith drops it, since the topology is alternate / future |
| F4 | container-manager constant-time compare | Only if SCOPE 2 is declined |
| F5 | `messages.service.ts:15` defaults `CONTAINER_MANAGER_URL` to port 4001 | Fixed in this task (settled 2026-11-10): the default becomes 4002; ai-service src is in the write set. |

## 10. Stop conditions for the implementer

STOP and report if:
- any caller of 4000, 4001 or 4002 from off the host, or from a container, is found;
- a route beyond the three in D4 seems to need to stay open;
- one of the four `HARNESS_ENTITLEMENT_PROOF_V1` files, the header name or the secret name would change;
- a file outside section 5 (as approved) needs a change, including env, systemd, compose, ops, monitoring or the frontend;
- a new dependency seems needed;
- a gate fails outside the known failures.
