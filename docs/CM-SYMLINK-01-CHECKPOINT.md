# CM-SYMLINK-01 — Checkpoint

**Task:** CM-SYMLINK-01 — Container-manager host file routes follow symlinks
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY (security). **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CM-PATH-01 LOCK. Admitted 2026-11-10 (5d5bcdc) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with CONTAINER-MANAGER | 5d5bcdc |
| 2. Implementation | opus subagent (Opus 5.5: a security fix removing routes and changing parameter handling) in worktree lane/CM-SYMLINK-01, fast-forwarded onto main | b6f06c5 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**The host-side file routes are removed.**
- All six `/api/files/:sessionId/*` routes (list, read, write, delete, mkdir, search) are gone, along with `FilesService`, `FilesModule`, the DTO and `ApiGatewayHttpClient.notifyFileChanged` (FilesService was its only caller).
- They ran on the host and followed symlinks, which a sandbox could create in its bind-mounted workspace.
- Callers were re-verified across the gateway, ai-service, connectors-mcp, frontend, e2e, scripts, ops, monitoring, the root scripts, compose and container-manager itself. There were none.
- Every gateway file call goes to the container-side `/api/internal/sessions/:id/{files,dirs,files/search}` (container-manager-http.client.ts:362, 392, 423, 448, 475), which runs inside the container through docker exec. Only two stale scripts named the removed routes.
- Nothing was kept, so no realpath hardening was needed.

**The session id is checked at the controller layer.**
- A new `SessionIdPipe` uses `isSinglePathSegment` and refuses a bad id with 400 "Invalid session id" before any service call.
- It is on all 30 remaining routes with a session-id parameter, across the sessions, internal sessions, internal previews, git, checkpoint-history, worktree-diff, preview and usage-aggregation controllers.
- Pipes run after the guard, so a request without the key still gets 403 first.
- Real ids (UUIDs from the gateway, base36 from `generateId`) all pass.

**Route inventory.** 52 routes on 13 controllers: 51 guarded, plus `GET /api/health` open.

**Tests.**
- **Removed (26):** the 7 FilesService tests; 18 guard tests (3 for each of the 6 removed routes); and the per-controller FilesController test.
- **Added (109):**
  - 6 tests that each removed route is route-not-found with the key;
  - 1 test that no controller serves under `/api/files`;
  - 1 test that the 30 session-id routes are all covered;
  - 90 per-route tests over raw `node:http`. A bad id (`%2E%2E`, `..`, `a%2Fb`, `a%5Cb`, `a%00b`) gets 400 and calls no service; a bad id without the key still gets 403; a UUID and a base36 id are accepted;
  - 11 pipe unit tests.
- **Mutation check:** with the pipe taken off one route, a test failed.
- 491 − 26 + 109 = 574.

Files: deleted `files/files.controller.ts`, `files.service.ts`, `files.module.ts`, `files.service.spec.ts` and `dto/files.dto.ts`; added `pipes/session-id.pipe.ts` and its spec; modified `app.module.ts`, `clients/api-gateway-http.client.ts`, the HTTP inventory spec and the 8 controllers. `files/path-containment.ts` is kept, because `isSinglePathSegment` is used by the sessions service and the pipe.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| container-manager `npm test` | 18 suites, 574 passed, 0 failed |
| container-manager `npm run build` | exit 0 |
| leftover references to FilesService, FilesModule or notifyFileChanged | none, apart from the explanatory comment in app.module.ts |
| line endings | the added and changed files are LF |

## Limits

Not deployed. It goes out with the next deploy, together with CM-PATH-01. That deploy should confirm:
- the removed routes answer 404 with the key;
- a `%2E%2E` session id answers 400 with the key.

`tsc` does not clean `dist/`, so stale `dist/files/*` files may stay on the host. Nothing imports them, and the 404 checks prove they are not loaded.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (1: the guard, the internal key and 401/403 unchanged; routes only removed and a parameter pipe added; 4: no frozen contract; 5: n/a, no schema change; 6: no new failures)

FOLLOWUPS: 1 registered / 3 superseded / 0 dropped / 0 undisposed.

**Registered: CM-GIT-HOST-01, NOT_READY (security).**
- `git.service.ts` `initializeGit` (git init, add and commit) and `getHistory` (git log) run simple-git **on the host** inside the bind-mounted workspace. The sandbox can write `.git/config` (for example `core.fsmonitor`) or `.git/hooks/*`, so a host-side git command could run commands of the sandbox's choosing on the host.
- The control plane confirmed the callers:
  - `initializeGit` through `POST /api/git/:id/init` (key holders) and container-manager's own call from `POST /api/sessions` create (sessions.service.ts:187), which has no other caller. At creation the workspace is new.
  - `getHistory` through `GET /api/git/:id/history`, which has no caller.
- Commit, revert and diff already run inside the container.
- Recommended: remove the uncalled host-side git routes and the self-call path, or run them inside the container.

**Superseded, folded into CM-DEPS-01** (container-manager and gateway leftovers):
- the gateway's `POST /api/events/file-changed` (events.controller.ts:8), which now has no container-manager caller;
- the stale `services/container-manager/test-container.sh`, which calls the removed routes on the wrong port without the key;
- `isPathInside`, which has no production user now.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY, and CONTAINER-MANAGER is released UNOWNED.
