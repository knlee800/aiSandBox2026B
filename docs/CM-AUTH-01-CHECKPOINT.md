# CM-AUTH-01 — Checkpoint

**Task:** CM-AUTH-01 — Internal key on container-manager routes, and the gateway preview traversal fix
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; **not deployed** (STAGING-DEPLOY-CMAUTH-01).
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the AI-SERVICE-AUTH-01 LOCK (facfb9f). Admitted 2026-11-10 (80b5887) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with CONTAINER-MANAGER, GATEWAY and AI-SERVICE; write set fixed at admission | 80b5887 |
| 2. Stage-start | docs/CM-AUTH-01-STAGE-START.md, drafted by an opus subagent. The control plane settled DECISIONs 1-5 and SCOPE 1 with the drafter's fail-closed recommendations | 5e90553 |
| 3. Implementation | opus subagent in worktree lane/CM-AUTH-01 (6d9028a), cherry-picked onto main | 72f0e2a |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## The holes it closes

1. **Preview path traversal (live on staging before this).** The gateway preview proxy checked ownership of path segment 3 only. axios then built the URL with `new URL()`, which collapses `%2e%2e`. A logged-in user who owned one session could reach another session's files, git and executor routes, for example with `/api/preview/<own>/%2e%2e/%2e%2e/files/<other>/list`.
2. **Unguarded routes.** 30 of container-manager's 64 routes had no key check: executor, files, git, sessions, preview and previews. After STAGING-DEPLOY-SEC-01 only host processes could reach them.
3. **WebSocket upgrades bypassed the guards.** `ws: true` hooked the server's upgrade event, so any upgrade to 4002 reached a container without passing any guard.
4. **The key could reach a container.** Once the gateway sends the key on preview traffic, container-manager's preview proxies would have forwarded it to the user's preview server.

## Change (20 files in three services)

| Design | Now |
|---|---|
| D1/D2 | A global `APP_GUARD` in container-manager, using the same `internalKeyMatches` compare, the same 403, and the same refusal to start without the key. `@InternalKeyExempt()` is honored per handler only. A context with no handler counts as not exempt. Only `GET /api/health` is open. The class-level guards are kept. |
| D3 | `createSession`'s git-init self-call sends the key. |
| D4 | The gateway preview proxy sends the server's key, never the browser's: a key the browser sends is replaced. |
| D5 | `resolvePreviewForward` and `buildPreviewTargetUrl` form a strict allowlist: start (POST), stop (POST, DELETE), status (GET, HEAD), and proxy or proxy/<rest> (GET, HEAD). The sid must match `^[A-Za-z0-9_-]{1,128}$` and equal the segment the ownership guard checked. **Refused with 404:** any `.`/`..` raw or decoded, `%2f`, `%5c` or a backslash, empty segments, undecodable segments, and uppercase `/API/PREVIEW`. The URL is rebuilt from the encoded sid, and its origin and prefix are re-checked after `new URL`. |
| D6 | All three container-manager preview proxies strip `x-internal-service-key` before forwarding to a container. |
| D7 | `ws: true` removed. |
| D8 | ai-service's legacy chat path sends the key. |
| SCOPE 1 | All 19 path parameters in the gateway client's 18 calls go through `encodePathParam`, which also refuses `''`, `.` and `..`. |

Tests: 450 new. They include:
- **`preview.traversal.spec.ts` (97).** A real Nest app with the real ownership guard, given an owner mock that owns every sid (the worst case). The traversal URL and its variants (`%2E%2E`, `proxy/%2e%2e/...`, `..%2f`, `%5c`, backslash, `//`) get 404, with zero upstream requests. The allowed shapes reach the upstream only at `/api/preview/<sid>/<suffix>`, carrying the server key. The frontend's real preview URLs still pass. Removing the allowlist makes 19 cases fail.
- **`internal-key.http.spec.ts`.**
  - The route inventory: 17 controllers, 64 routes, 63 guarded, exactly `GET /api/health` open.
  - Every guarded route answers 403 without a key and with a wrong key, with no service call, and is served with the right key.
  - Removing APP_GUARD makes the suite fail.
- **`preview-proxies.http.spec.ts`.** The key is stripped, the upgrade listener count is 0, and a WebSocket upgrade without the key is never upgraded.
- **Client and self-call tests.** All 18 client calls send the header; the git-init call sends it without logging it.

## Gates (control-plane rerun on the branch)

| Service | Tests | Build | Baseline |
|---|---|---|---|
| container-manager | 15 suites, 481 passed | exit 0 | 224 + 257 new |
| api-gateway (`--maxWorkers=2`) | 3256 passed, 7 skipped; 14 failed, all in `smoke.integration.spec.ts` | exit 0 | 3065 + 191 new; the same 14 known smoke failures |
| ai-service | 1309 passed, 1 skipped, **1 failed**: `briefing-drift.spec.ts` | exit 0 | 1308 + 2 new; the failure is **pre-existing on main**, confirmed by running it on main |

**The ai-service failure is a control-plane miss, not part of this task.**
- BIZ-USER-01C (ccc25ab) changed the gateway's version material through `agentVersionFor`, and the eval's drift check still expects the old expressions.
- The BIZ-USER-01C lock reran only the gateway and frontend suites, although the drift spec reads gateway source.
- It is a source-shape check, so runtime is not affected.
- It is registered as DRIFT-FIX-01, next in line.

After the cherry-pick:
- `services/` on main is identical to the gated branch;
- the changed files are LF.

## Behavior changes to note

- Uppercase `/API/PREVIEW/...` now gets 404 at the gateway. The frontend uses lowercase.
- A frontend unit test feeds `session%2Fwith%20spaces` to the preview URL builder. That is not a real session id; the gateway would now refuse it, and the unit test itself is unaffected.

CHECKLIST: EVERY 10/11 (3: opus, passed explicitly; 7: one pre-existing ai-service failure reported, not caused by this task; 8: no runtime started), BACKEND 5/6 (1: exactly the stage-start's guard, key and proxy changes; 4: no frozen contract touched; 5: n/a, no schema change; 6: compared with the baselines)
FOLLOWUPS: 4 registered / 1 superseded / 0 dropped / 0 undisposed:
- **STAGING-DEPLOY-CMAUTH-01** (F1): the deploy. Its host checks include cm.env's key matching gateway.env's and ai.env's, by hash only, and the traversal URLs answering 404 through Caddy.
- **CM-PREFIX-01** (F2): four controllers serve at `/api/api/internal/...`, which the route inventory confirmed, so the admin ops summary and billing export get 404.
- **CM-CLEANUP-01:** F3, the orphaned routes and the per-request proxy listener leak; F4, the dead ai-service chat path; F5, container-manager's CORS that allows any origin; and the latent `transfer-encoding` copy in the gateway preview catch-all.
- **DRIFT-FIX-01:** the briefing drift check.
- **Superseded:** the stage-start's F4 recommendation is folded into CM-CLEANUP-01.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; CONTAINER-MANAGER, GATEWAY and AI-SERVICE released UNOWNED.
