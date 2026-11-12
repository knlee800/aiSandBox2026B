# BROWSER-SMOKE-02 — Checkpoint

**Task:** BROWSER-SMOKE-02 — Browser smoke for static previews, and preview clean-up when a session ends
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the BROWSER-SMOKE-01 LOCK. Keith approved the start, with the route removal ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1 with CONTAINER-MANAGER; plan by the control plane; exact write set of 13 files, one deleted | f1d3929 |
| 2. Implementation | opus subagent (Opus 5.5: an internal route removal, a hook across the sessions and preview modules, and the browser-smoke exec script) in worktree lane/BROWSER-SMOKE-02; fast-forwarded | 300440c |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**1. Browser smoke for static HTML previews.** A static preview has nothing listening on its port.
- **Registry** (`previews/preview.service.ts`):
  - It also holds a static preview's app root, through `registerStaticPreview`, `getStaticRoot` and `unregisterStaticPreview`.
  - It keeps the same checks as a port registration: the session must be usable and the container running.
  - The root must be `/workspace` or a plain path under it, with no `.`, `..` or empty segment, no backslash and no NUL. Anything else is a 400.
  - `unregisterPreviewPort` now clears both the port and the root, so every existing stop path covers static previews.
- **Preview service:** registers the root when a static preview starts. A refusal is logged, and the preview keeps running. A stop during registration clears only the root.
- **BrowserSmokeService:**
  - A registered port wins, with the same environment as before.
  - With no port and a registered root, it runs in static mode. The browser opens `http://static-preview.invalid`, a reserved name that never resolves.
  - `page.route` for that origin only serves files from the root with `route.fulfill({ path })`. A directory serves its `index.html`.
  - A path outside the root, lexically or through a symlink, answers 403. A missing file answers 404, and an undecodable path 400.
  - Other origins are not routed.
  - With neither registered, the failure text is unchanged.
- **The script** holds no backslash, because it is piped through `echo` in sh. The path check is one source string embedded in the script, and the tests evaluate that same string.

**2. Preview clean-up when a session ends.**
- `SessionsService.onSessionEnded(listener)` is called best-effort: thrown or rejected errors are logged and never change the operation. It is called on:
  - stop and delete;
  - container removal through the internal route;
  - container lost;
  - idle timeout and max lifetime, each before its 410.
- The removal body moved to a private `removeContainerForSession`, so stop and delete notify only once.
- `preview/PreviewService` subscribes in `onModuleInit`. On a session end it drops the entry, returns the port to the pool and clears the registry, without running anything in the container.
- Order, notifications, return values and errors are otherwise unchanged. Before this, an ended session kept its preview entry and its port.

**3. Route removal.**
- `POST /api/internal/sessions/:id/previews` and its controller are removed.
  - No service called the route: the worker's searches of api-gateway, ai-service and the frontend found none, and the control plane confirmed this.
  - It now answers 404 with and without the key.
  - The inventory is 48 routes, 47 guarded, with 12 controllers and 27 session-id routes.
- No guard or key handling changed. The other internal routes keep their guard tests.

**Tests:** 973 passed, against a baseline of 903.
- The registry: static roots and root validation.
- The preview service:
  - a static preview registers its root, and stop clears it;
  - a refused registration still leaves the preview running;
  - a session end frees the port, and a new preview can take it;
  - an unknown session is a no-op.
- BrowserSmokeService:
  - a port wins over a root; static mode's environment and URL; the unchanged failure text;
  - the resolver: 200, 403 (traversal and symlink), 404 and 400;
  - the whole script with a stand-in chromium: the route predicate, fulfils, an unrouted CDN request, and no route in port mode.
- SessionsService: the listeners on every end path, and a throwing listener.
- internal-key: the removed route answers 404.

## Gates (control-plane rerun on the branch; main fast-forwarded to the same commit)

| Gate | Result |
|---|---|
| container-manager `npm test` | 22 suites, 973 passed, 3 skipped, 0 failed (baseline 903) |
| container-manager `npm run build` | exit 0 |
| line endings | all 12 changed files are LF |
| tree after the gates | clean |

## Limits

- **Not deployed, and not checked live.** The deploy is STAGING-DEPLOY-SMOKE-02. The live check of static mode with real Playwright is part of BROWSER-SMOKE-LIVE-01.
- **Unchanged from before:** the registry and preview entries are in memory, so a container-manager restart forgets them. This is PREVIEW-STATE-01.
- **Another uncalled route:** the internal route `DELETE /api/internal/sessions/:id/container` is also uncalled. It is CM-CLEANUP-02.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: the 13 files of the write set, no new dependency; 7: gates rerun by the control plane; 8: no runtime; 9: no build artifact changed; 10: worker committed only on its branch, fast-forwarded by the control plane with autocrlf=false), BACKEND 6/6 (1: one uncalled internal route removed on Keith's yes, no guard or key change; 2: remaining internal routes keep their guard tests; 3: n/a, no template; 4: no frozen contract; 5: no schema change; 6: no new failures)
FOLLOWUPS: 3 registered (STAGING-DEPLOY-SMOKE-02; CM-CLEANUP-02; PREVIEW-STATE-01) / 1 superseded (a static-preview case, by BROWSER-SMOKE-LIVE-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
