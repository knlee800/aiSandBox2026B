# AI-SERVICE-AUTH-01 — Checkpoint

**Task:** AI-SERVICE-AUTH-01 — Internal services listen on loopback and check the internal key
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; **not deployed**. STAGING-DEPLOY-SEC-01 deploys it.
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the plan item 26 security review (docs/SECURITY-CHECK-26-REVIEW.md) and confirmed read-only on the staging host (C:/Users/knlee/aisb-preflight/SEC-26/sec26-ports.out). Admitted 2026-11-10 (ba0dbd1) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 2 with GATEWAY, AI-SERVICE and CONTAINER-MANAGER | 4a262ba, ba0dbd1 |
| 2. Stage-start | docs/AI-SERVICE-AUTH-01-STAGE-START.md, drafted by an opus subagent; DECISIONs 1-3 and SCOPE 1-2 settled by the control plane with the drafter's fail-closed recommendations | 7763266 |
| 3. Implementation | opus subagent in worktree lane/AI-SERVICE-AUTH-01 (959702b), cherry-picked onto main | a660062 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## The problem (stage-start section 2)

The gateway (4000), ai-service (4001) and container-manager (4002) listened on every interface on staging. ufw was inactive and iptables INPUT was ACCEPT. The Lightsail firewall keeps them off the internet, but **sandbox containers on Docker's default bridge could reach all three at 172.17.0.1** without passing through it.

- **ai-service** had no guard on any route.
- **Container-manager** has unguarded executor, files, git, sessions and preview routes, so a sandbox could read or write another session's files and run `node` in its container.
- **The gateway** could be reached without Caddy's basic_auth, though its own login checks still apply.

No container legitimately calls any of the three.

## Change (24 files in three services)

| Design | Now |
|---|---|
| D1/D2 Bind | Each service has `resolveListenHost(env)`: `LISTEN_HOST` trimmed, defaulting to `127.0.0.1` when unset or blank, with `HOST` ignored. `app.listen(port, host)` in all three `main.ts` files. All host callers already use 127.0.0.1, and the ops scripts' `ss` match accepts `127.0.0.1:port`. Staging needs no env change. |
| D3/D4 ai-service guard | A global `APP_GUARD` requires `X-Internal-Service-Key`. It answers 401 for a missing, empty, duplicated, array or wrong key, or an unset env key. `@InternalKeyExempt()` applies per handler only. Ten routes are guarded. Three stay open: `GET /metrics`, `GET /api/conversations` and `POST /api/messages/health`. A route-inventory test pins exactly that split. |
| D5 Compare | `internalKeyMatches` requires non-empty strings and equal UTF-8 byte lengths, then uses `crypto.timingSafeEqual`. It is used in the gateway guard (only the compare line changed; the stale "UNPROTECTED" warning text corrected) and the container-manager guard. The gateway accepts and refuses the same keys as before. The old guard also refused when the key was unset; only its warning text was wrong. |
| D6 Client | The gateway's leftover `AIServiceHttpClient` sends the key when it is set. |
| F5 | ai-service's `CONTAINER_MANAGER_URL` default is now port 4002 instead of 4001. |

Tests (115 new):
- ai-service HTTP tests run a real Nest app on 127.0.0.1 with built-in fetch, covering each guarded route without, with the wrong and with the right key, plus case and slash variants;
- compare edge cases in all three services, including a spy showing `timingSafeEqual` runs only on equal lengths;
- the client header;
- listen-host defaults in all three services.

Not touched: the frozen HARNESS_ENTITLEMENT_PROOF_V1 files, env, templates, compose, ops, the frontend, packages and records.

## Gates (control-plane rerun on the branch)

| Service | Tests | Build | Baseline |
|---|---|---|---|
| ai-service | 66 suites, 1308 passed, 1 skipped | exit 0 | 1231 + 77 new |
| container-manager | 12 suites, 224 passed | exit 0 | 206 + 18 new |
| api-gateway (`--maxWorkers=2`) | 3024 passed, 7 skipped; 14 failed, all in `smoke.integration.spec.ts` | exit 0 | 3004 + 20 new; the same 14 known smoke failures |

The worker's first full gateway run crashed on memory ("Fatal process out of memory: Zone"). That is environmental: its second run and the control-plane rerun, with two workers, passed as above.

After the cherry-pick:
- `services/` on main is identical to the gated branch;
- the changed files are LF.

## Limits

- **Not deployed.** Until STAGING-DEPLOY-SEC-01 runs, staging still listens on every interface.
- Container-manager's routes still have no key check. After the loopback bind, only host processes reach them (CM-AUTH-01).

CHECKLIST: EVERY 11/11 (3: opus, passed explicitly; 8: no runtime or server started; 9: no tracked artifact), BACKEND 5/6 (1: exactly the guard and key changes the stage-start lists; 4: frozen contract untouched; 5: n/a, no schema change; 6: compared with the latest baselines)
FOLLOWUPS: 3 registered / 1 superseded / 0 dropped / 0 undisposed:
- registered: STAGING-DEPLOY-SEC-01, the deploy with the host checks in its scope, done first;
- registered: CM-AUTH-01, the internal key on container-manager routes;
- registered: LOCAL-DEV-SYNC-01, covering `LISTEN_HOST=0.0.0.0` in docker-compose.prod.yml, the stale `localhost:4001/health` poll in scripts/start-all.sh, and an ai-service spec that leaves an empty `database/aisandbox.db`;
- superseded: F5, fixed in this task. F4 was not needed.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; GATEWAY, AI-SERVICE and CONTAINER-MANAGER released UNOWNED.
