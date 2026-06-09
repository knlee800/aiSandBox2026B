# PREVIEW-STRATEGY-01A Checkpoint — Preview Strategy Detection Refactor

**Task ID:** PREVIEW-STRATEGY-01A
**Family:** PREVIEW / RUNTIME / USER APP EXECUTION
**Status:** COMPLETE and LOCKED
**Checkpoint date:** 2026-06-09

---

## Problem

Live preview failed for valid static HTML projects created inside a subdirectory of `/workspace`. For example:

- `/workspace/WorkspaceA/index.html`
- `/workspace/WorkspaceA/page2.html`
- `/workspace/WorkspaceA/page3.html`
- `/workspace/WorkspaceA/page4.html`

The prior detection in `PreviewService.detectFramework` only checked:

- `/workspace/package.json`
- `/workspace/index.html`
- `/workspace/*.html`

It did not detect `/workspace/<subdir>/index.html`. aiSandBox incorrectly treated valid subdirectory static HTML sites as unpreviewable, surfacing "No package.json or start command found."

---

## Objective

Refactor preview detection into a testable `PreviewStrategyResolver` with an explicit `PreviewStrategy` type/interface while preserving all existing framework detection behavior. Add static HTML detection for immediate subdirectories of `/workspace` (`/workspace/*/index.html`).

---

## Files Changed

| File | Action |
|---|---|
| `services/container-manager/src/preview/preview-strategy.resolver.ts` | Created — `PreviewStrategy` interface + `PreviewStrategyResolver` injectable class |
| `services/container-manager/src/preview/preview-strategy.resolver.spec.ts` | Created — 10 focused resolver unit tests |
| `services/container-manager/src/preview/preview.service.ts` | Modified — integrated resolver, added `appRoot` to `PreviewProcess`, updated `readStaticPreviewContent` to serve files relative to detected `appRoot`, removed superseded private detection helpers (`detectFramework`, `readPackageJsonInSession`, `hasIndexHtmlInSessionWorkspace`, `hasAnyHtmlInSessionWorkspace`) |
| `services/container-manager/src/preview/preview.service.spec.ts` | Modified — added `PreviewStrategyResolver` mock as third constructor argument |
| `services/container-manager/src/preview/preview.module.ts` | Modified — registered `PreviewStrategyResolver` as NestJS provider |
| `services/container-manager/Dockerfile` | Modified — added Alpine native build prerequisites (`python3`, `make`, `g++`) before `npm install` in both builder and production stages (Docker build blocker fix — see below) |

---

## Implementation Summary

### PreviewStrategy interface

```typescript
export interface PreviewStrategy {
  type: 'static-html' | 'node-dev-server' | 'unknown';
  framework?: string;
  command?: string;
  port?: number;
  appRoot?: string;
  servingMode: 'direct-read' | 'process-proxy';
  diagnosticMessage?: string;
}
```

### Detection order (preserved and extended)

1. Provided command → `node-dev-server`, no shell calls
2. `package.json` present → framework detection (Next.js, CRA, Vite, Vue CLI, Vue, Express) + script override (`dev` → `start` → `serve`)
3. `/workspace/index.html` present → `static-html`, `appRoot: '/workspace'`
4. `/workspace/*/index.html` present (immediate subdirectory) → `static-html`, `appRoot: '/workspace/<subdir>'`
5. Any root `*.html` without `index.html` → `unknown`, framework `'Static HTML (missing-index)'`
6. Nothing found → `unknown`, diagnostic message

### PreviewService integration

- `PreviewStrategyResolver` injected as third constructor parameter.
- `startPreview` now calls `resolver.resolve(sessionId, command)` instead of `detectFramework`.
- `PreviewProcess` gained `appRoot?: string`.
- `readStaticPreviewContent` prepends the subdirectory when `appRoot` differs from `/workspace`, enabling correct static file serving for subdirectory HTML projects.
- Error messages preserved: `'Static HTML (missing-index)'` path still throws the existing `BadRequestException`.

### Preserved framework behavior

All existing framework detection logic migrated 1:1 to `PreviewStrategyResolver.resolveFromPackageJson`:

| Framework | Dependency key | Command |
|---|---|---|
| Next.js | `next` | `npm run dev` |
| Create React App | `react-scripts` | `npm start` |
| Vite | `vite` | `npm run dev` |
| Vue CLI | `@vue/cli-service` | `npm run serve` |
| Vue | `vue` | `npm run dev` |
| Express | `express` | `node server.js` |

Script override behavior (dev → start → serve) preserved exactly.

---

## Docker Build Blocker (pre-existing, fixed in this task)

### Root cause

`better-sqlite3` (a container-manager dependency) has no prebuilt binary for the `node:20-alpine` musl target. It falls back to `node-gyp` source compilation, which fails because Alpine lacks Python and the C++ compiler toolchain. This is the same root cause as DEVOPS-DOCKER-01 (ai-service). The container-manager Dockerfile was missing the same fix.

**This blocker was not caused by PREVIEW-STRATEGY-01A.** It was a pre-existing condition on every Docker build of container-manager.

### Fix applied

Added `RUN apk add --no-cache python3 make g++` before each `npm install` stage in `services/container-manager/Dockerfile`, matching the proven DEVOPS-DOCKER-01 pattern.

---

## Resolver Tests (10 cases)

| # | Test case |
|---|---|
| 1 | Provided command returns `node-dev-server` without shell calls |
| 2 | Next.js detected from `package.json` dependencies |
| 3 | Vite detected from `package.json` devDependencies |
| 4 | Generic `dev` script (no known framework) returns `node-dev-server` |
| 5 | Static HTML at workspace root (`/workspace/index.html`) |
| 6 | Static HTML in immediate subdirectory (`/workspace/WorkspaceA/index.html`) |
| 7 | Unknown with `missing-index` when HTML exists but no `index.html` |
| 8 | Unknown when no previewable content found |
| 9 | Unknown when `package.json` exists but has no scripts |
| 10 | Root `index.html` preferred over subdirectory `index.html` |

---

## Validation Results

### Container-manager preview tests

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test -- --testPathPattern="preview"
```

Result: **PASS — 48/48, 0 failed** (38 existing + 10 new resolver tests)

### Container-manager local build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

Result: **PASS — 0 errors**

### Docker build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B"; docker compose -f docker-compose.prod.yml build container-manager --no-cache --progress=plain
```

Result: **PASS — `aisandbox2026b-container-manager Built`**

### ReadLints

Result: **PASS — no linter errors on any touched file**

---

## Live Browser Smoke

**Result: PASS**

Scenario tested:

1. Asked AI to create a 4-page static HTML website with buttons linking between pages.
2. Files were created under a subdirectory: `WorkspaceA/index.html`, `WorkspaceA/page2.html`, `WorkspaceA/page3.html`, `WorkspaceA/page4.html`.
3. Opened Live Preview.
4. Confirmed index page loaded correctly.
5. Confirmed navigation to page2, page3, page4 worked via buttons.
6. No preview error surfaced.

Browser smoke was required because runtime behavior changed (subdirectory static HTML now serves correctly where it previously failed).

---

## Non-Goals Respected

- No frontend files changed
- No api-gateway files changed
- No AI service files changed
- No AI prompt assembly changes
- No AI-CONTEXT changes
- No database schema changes
- No project preview settings UI
- No `.aisandbox/preview.json`
- No Python/Flask/FastAPI detection
- No SPA routing overhaul
- No public/share preview
- No external hosting/deployment
- No broad preview rewrite
- No git commit/push steps

---

## Rollback Guidance

To revert PREVIEW-STRATEGY-01A:

1. Delete `services/container-manager/src/preview/preview-strategy.resolver.ts`
2. Delete `services/container-manager/src/preview/preview-strategy.resolver.spec.ts`
3. Restore `preview.service.ts` to re-inline `detectFramework`, `readPackageJsonInSession`, `hasIndexHtmlInSessionWorkspace`, `hasAnyHtmlInSessionWorkspace`; remove `appRoot` from `PreviewProcess`; remove resolver constructor parameter; restore original `readStaticPreviewContent` without `appRoot` prefix logic
4. Restore `preview.service.spec.ts` to pass only two constructor arguments
5. Restore `preview.module.ts` to remove `PreviewStrategyResolver` provider
6. Restore `Dockerfile` to remove the `python3 make g++` apk lines (note: this re-introduces the Docker build blocker)

---

## Next Recommended Slice

**PREVIEW-STATIC-01B** — Static Preview Subdirectory Proxy Routing

The `appRoot` is now detected and stored, but the proxy controller (`preview.controller.ts`) still serves all static files relative to `/workspace` regardless of `appRoot`. A follow-up slice should:

- Pass `appRoot` through to the proxy/static serving layer in the controller.
- Ensure all linked assets (CSS, JS, images) for subdirectory HTML projects resolve correctly relative to `appRoot`.
- Add integration-level coverage for the full static serving path.

This is a separate bounded slice — do not include in PREVIEW-STRATEGY-01A.

---

**Reference:** See `TASKS.md` → PREVIEW-STRATEGY-01A. See `TASKS_BACKLOG_FULL.md` → PREVIEW-STRATEGY-01A.
