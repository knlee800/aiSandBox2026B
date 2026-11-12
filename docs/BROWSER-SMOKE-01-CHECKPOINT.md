# BROWSER-SMOKE-01 — Checkpoint

**Task:** BROWSER-SMOKE-01 — Browser smoke never finds a preview target
**Status:** COMPLETE AND LOCKED — 2026-11-12.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 by the CODE-TIDY-01 LOCK. Keith approved the fix ("Yes, fix it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and activation | Lane 1 with CONTAINER-MANAGER; cause found by the control plane; exact write set | 0be39ca |
| — | Write set widened by `preview/preview.controller.spec.ts`. It is test-only: its module needed the new provider, and the worker stopped on that as required | 5df302c |
| 2. Implementation | opus subagent (Opus 5.5: module wiring and the browser-smoke exec path) in worktree lane/BROWSER-SMOKE-01 as 4943098; main had moved, so the control plane cherry-picked it | 9a2243c |
| 3. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Cause

BrowserSmokeService resolved its target through `previews/PreviewProxyService`. That reads the in-memory registry in `previews/preview.service.ts`, which only the uncalled internal route `POST /api/internal/sessions/:id/previews` ever filled. `preview/PreviewService`, which actually starts previews, never registered a port. So every browser-smoke run answered "Preview target not available: No preview port registered".

## Change

- **Wiring:** `SessionsModule` now also exports the registry (`previews/` PreviewService). `PreviewModule` already imports `SessionsModule`, so there is no cycle and the registry stays a single instance. `preview/PreviewService` injects it under the alias `PreviewPortRegistry`.
- **Register:** this happens in `registerBrowserSmokeTarget`, after a dev-server preview (Vite) is reachable and running.
  - The registry's own checks are kept: the session must be usable, the port must be 1024–65535, and the container must be running.
  - A refusal is logged, and the preview keeps working.
  - If the preview is stopped while registration is in progress, no stale port is left.
  - A restart replaces the registered port.
  - Static HTML previews are not registered, because nothing listens on their port.
- **Unregister:** in `stopPreview`, including when the kill fails; when the server never becomes reachable; and for each preview in `onModuleDestroy`.
- **Unchanged:** the internal register route and its guard.

**Tests:** 17 new, and 1 new suite.
- `preview.service.spec`, 9 tests:
  - register only once the server is reachable;
  - unregister on stop, including when the kill fails;
  - a restart updates the port;
  - nothing is registered for an unreachable server;
  - module destroy unregisters every preview;
  - a static preview is not registered;
  - a refused registration still leaves the preview running;
  - a stop during registration leaves no port.
- The new `previews/preview-proxy.service.spec.ts`:
  - `getProxyTarget` with and without a registered port;
  - a module test that compiles the real `PreviewModule` with `SessionsModule`. It shows one shared registry, and runs start, then browser smoke, then stop: the target is `http://172.18.0.10:3001/about` while the preview runs, and "Preview target not available" after the stop. Removing the export makes it fail.
- `browser-smoke.service.spec`: the real proxy and registry, with and without a port.
- `preview.controller.spec`: provides a stand-in registry.

## Gates

| Gate | Branch (control-plane rerun) | main after the cherry-pick |
|---|---|---|
| container-manager `npm test` | 22 suites, 903 passed (886 + 17), 3 skipped | preview, previews and browser-smoke suites: 5 suites, 120 passed |
| container-manager `npm run build` | exit 0 | exit 0 |
| line endings | the 7 files are LF | 7 of 7 LF |

## Limits

- **Not deployed, and not checked live.** The deploy is STAGING-DEPLOY-SMOKE-01.
  - A full live check needs runs on, and a session on the browser-capable image with Playwright at `/opt/browser-smoke`. In it, an Agent-mode run calls browser smoke on a started Vite preview and should get a result for `http://<container ip>:<port>/`, then "Preview target not available" after the stop.
  - The control plane notes that the browser image cannot be started from the UI today. Keith decides whether to run that check, or to accept the module test.
- **Still open,** registered as one optional task, BROWSER-SMOKE-02:
  - static HTML previews still give "Preview target not available";
  - ending a session keeps the preview entry (as before this task);
  - the internal register route is now redundant.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: write set widened by the control plane for one test file, recorded; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false), BACKEND 6/6 (1 and 2: no guard, key or route change; 3: no template; 4: no frozen contract; 5: no schema change; 6: no new failures)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-SMOKE-01; BROWSER-SMOKE-02) / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- CONTAINER-MANAGER released UNOWNED;
- not deployed.
