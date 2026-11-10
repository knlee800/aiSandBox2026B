# CM-CLEANUP-01 — Checkpoint

**Task:** CM-CLEANUP-01 — Container-manager and preview proxy cleanups (container-manager and ai-service part)
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the CM-AUTH-01 LOCK (7615c7b), findings F3, F4 and F5. Split and admitted 2026-11-10 (c1b037c) under Keith's instruction to keep starting the next tasks. The gateway hop-by-hop header item is CM-CLEANUP-01B.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Split and admission | Lane 2 with CONTAINER-MANAGER and AI-SERVICE | c1b037c |
| 1a. Write set widened | the worker stopped on F4: the ai-service internal-key HTTP spec imports the legacy chat module, and main.ts logs its URL | 828c98d |
| 2. Implementation | opus subagent (Opus 5.5: two services, route removals) in worktree lane/CM-CLEANUP-01 (86870859, 0b7efc3b), cherry-picked onto main | 5914d4a, 7f2be0d |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**F3, orphaned proxies, removed.**
- `previews/*` (previews.controller.ts) and `internal-previews/proxy/*` (internal-previews-proxy.controller.ts) had no caller, and their pathRewrite missed `/api`.
- previews.controller.ts also carried an unused JWT check with a hard-coded default secret.

**F3, the proxy listener leak, fixed.**
- `PreviewController` now builds one proxy for its lifetime. `router` and `pathRewrite` read each request's session and target from a `WeakMap`, which `proxyRequest` fills.
- The internal key is still stripped before a request reaches a container, and there is still no `ws: true`.
- A test sends 30 requests across two sessions. Against the old code it failed with 37 extra `close` listeners; now growth is at most 1.

**F3, no-caller routes.** Callers were checked across the gateway, ai-service, connectors-mcp, the frontend, scripts, e2e, ops and container-manager itself.

| Route | Callers | Decision |
|---|---|---|
| ALL /api/previews/:sessionId/*, GET /api/previews/:sessionId/health | none | Removed (above) |
| ALL /api/internal-previews/proxy/:sessionId/* | none | Removed (above) |
| POST /api/executor/:sessionId/execute, GET /api/executor/commands | none (only traversal test URLs in the gateway spec) | **Removed.** The allowlist checked only the first word, then ran the whole string under `sh -lc`, so `ls; anything` passed. It also duplicated the guarded internal exec route that the gateway uses. |
| GET /api/sessions | none (probes use /api/health) | Removed: a second health reply |
| POST /api/sessions; GET /api/sessions/:id and /user/:userId | none | Kept: guarded. Its git-init self-call sends the key (CM-AUTH-01 D3), and getSession is used by git.service.ts |
| files list, read, mkdir, search; after F4 also write and delete | none | Kept: guarded and scoped to the workspace |
| git init (CM self-call), commit (gateway client), history, checkpoints | as listed | Kept: guarded |
| /api/internal/quota-evaluations/* (6), /api/internal/usage-aggregations/* (7) | none | Kept: guarded and read-only. Their services back billing-export, which has a gateway caller |
| GET /api/preview/:sessionId/proxy* | gateway preview catch-all | Kept, with the listener fix |

The route inventory now covers 14 controllers and 58 routes: 57 guarded, plus `GET /api/health` open. With the right key, each of the 8 removed routes answers Express route-not-found and calls no service.

**F5, CORS off.**
- `main.ts` no longer calls `enableCors`. The validation pipe and the `api` prefix moved to `configureApp()` in `app-setup.ts`.
- `cors.http.spec.ts` sends a preflight from a foreign origin to health, stats and internal exec, and gets no `Access-Control-*` headers.
- A positive control with the old setting shows the test detects the difference.

**F4, ai-service legacy chat path removed.**
- `services/ai-service/src/messages/` is removed: controller, service, module and spec. So are its app.module.ts wiring and the startup log line that printed its URL.
- No live code imported it.
- The internal-key HTTP spec drops the messages cases, and now asserts that `POST /api/messages/chat` is route-not-found with the key. Every other guard assertion is unchanged.

## Gates (control-plane rerun on the branch; builds rechecked on main)

| Gate | Result |
|---|---|
| container-manager `npm test` | 16 suites, 470 passed, 0 failed |
| container-manager `npm run build` | exit 0 (on main) |
| ai-service `npx jest --runInBand` | 65 suites, 1296 passed, 1 skipped, 0 failed |
| ai-service `npm run build` | exit 0 (on main) |

**Test counts against the baselines:**

- **container-manager, 481 → 470:**
  - Removed: 24 per-route guard tests of the 6 removed routes, and 3 per-controller "right key reaches its handlers" tests.
  - Added: 8 removed-route tests; a net +2 in preview-proxies.http.spec.ts (bare path, per-session target, 502, close listeners); 6 CORS tests.
- **ai-service, 1310 → 1296:**
  - Removed: messages.service.spec.ts (6 tests) and 9 tests in internal-key.http.spec.ts (the 4 guard cases for each of the 2 chat routes, plus the open health test).
  - Added: 1 route-not-found test.

The gateway was not changed. Its traversal spec only sends executor-shaped URLs and asserts that none answers 200.

The cherry-picked working files were normalised to LF in this checkout. The committed blobs were already LF, and `git diff` stays empty.

## Limits

- Not deployed. STAGING-DEPLOY-WF-01 deploys main, so it carries this task.
- STAGING-DEPLOY-CMAUTH-01's host checks probed `/api/executor/commands` and `/api/sessions`. Both now answer 404, so the next deploy checks other guarded routes instead (acceptance line added to STAGING-DEPLOY-WF-01).
- tsc does not clean `dist/`, so a build over an old `dist/` keeps stale files for the removed modules. Nothing imports them, so they never load. The deploy's 404 checks prove that.

CHECKLIST: EVERY 11/11 (7: the worker stopped on F4 and finished after the widening), BACKEND 6/6 (1: guard, header, key compare and 401/403 unchanged; only routes removed and CORS off; 5: n/a, no entity or schema change; 6: no new failure; every removed test accounted for)
FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- Registered: CODE-TIDY-01 (NOT_READY), which holds:
  - the stale comment naming `/api/messages/health` in ai-service guards/internal-key-exempt.decorator.ts;
  - container-manager's unused `jsonwebtoken` and `@types/jsonwebtoken`;
  - the unused `frontend/components/Timeline.tsx`, which calls a gateway route that does not exist;
  - a keep-or-remove review of the uncalled `POST /api/internal/sessions/:id/previews` (it feeds the browser-smoke proxy target) and of files write and delete.
- Superseded: stale dist files and the old-path host checks, by an acceptance line in STAGING-DEPLOY-WF-01.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 is released EMPTY, and CONTAINER-MANAGER and AI-SERVICE are released UNOWNED.
