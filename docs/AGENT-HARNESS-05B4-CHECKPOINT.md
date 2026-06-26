# AGENT-HARNESS-05B4 Checkpoint

**Task ID:** AGENT-HARNESS-05B4
**Title:** Browser Sandbox Playwright Module Resolution Fix
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-25
**Nature:** DOCKER IMAGE / BROWSER RUNTIME FIX / TARGETED DEFECT REMEDIATION

---

## Triggering Defect and Root Cause

**Defect ID:** AGENT-HARNESS-05B3-DEFECT-01
**Severity:** Blocker for service-chain smoke
**Component:** `services/container-manager/Dockerfile.workspace-browser`

**Root cause:**
`Dockerfile.workspace-browser` installed Playwright via `npx playwright@1.60.0 install --with-deps chromium`. This command runs the Playwright CLI via the transient npx cache and installs the Chromium browser binary, but does **not** install the `playwright` npm package in any standard Node.js module resolution path. The resulting path (`/root/.npm/_npx/<hash>/node_modules/playwright`) is implementation-dependent, not deterministic across builds or npm versions, and not discoverable by `require('playwright')` in a running container process. `BrowserSmokeService` injects a Node script that calls `const { chromium } = require('playwright')`, which failed with `MODULE_NOT_FOUND` in every container process not explicitly given a `NODE_PATH` workaround.

---

## Architecture and Security Decision

**Strategy selected:** Install Playwright into a fixed, image-owned directory `/opt/browser-smoke` with a pinned prefix and configure `NODE_PATH=/opt/browser-smoke/node_modules` as a permanent environment variable in the image. Use the locally installed CLI at `/opt/browser-smoke/node_modules/.bin/playwright` (not npx) to install Chromium and system dependencies.

**Rationale:**
- The `/opt/browser-smoke` location is deterministic, image-owned, and not affected by workspace-local `node_modules` shadowing.
- `NODE_PATH=/opt/browser-smoke/node_modules` is set as an `ENV` instruction, making it persistent for all container processes without any per-command workaround.
- Using the local CLI instead of npx eliminates all transient npx-cache dependency at both build and runtime.
- Pinning the package to `playwright@1.60.0` (exact) at install ensures the Chromium browser binary installed by the local CLI matches the loaded Node package.
- This strategy meets the original non-goals: no workspace-local dependency, no live npm download at runtime, no `/root/.npm/_npx/...` dependency.

**Security notes:**
- `--no-sandbox` is preserved for Chromium launch inside the container (required for non-root container execution; the container itself is isolated).
- `--disable-dev-shm-usage` is preserved (required for shared memory management in constrained container environments).
- No secrets, credentials, or tokens are embedded in the image.
- The workspace user's `node_modules` cannot shadow `/opt/browser-smoke/node_modules` because `NODE_PATH` is not affected by workspace-local resolution order.

---

## Exact Files Changed

| File | Change |
|------|--------|
| `services/container-manager/Dockerfile.workspace-browser` | Replaced transient npx install with pinned fixed-prefix npm install + local CLI Chromium install + `NODE_PATH` env |
| `services/container-manager/src/browser-smoke/browser-smoke.service.ts` | Updated `require('playwright')` to `require('/opt/browser-smoke/node_modules/playwright')` (absolute path load) |
| `services/container-manager/src/browser-smoke/browser-smoke.service.spec.ts` | Added focused test for absolute image-owned path resolution |

No other source, runtime, test, package, Docker, frontend, or database files were changed.

---

## Dockerfile Remediation (Exact Change)

**Before (transient npx approach):**
```dockerfile
RUN npx playwright@1.60.0 install --with-deps chromium
```

**After (fixed-prefix + local CLI approach):**
```dockerfile
RUN npm install --prefix /opt/browser-smoke playwright@1.60.0
ENV NODE_PATH=/opt/browser-smoke/node_modules
RUN /opt/browser-smoke/node_modules/.bin/playwright install --with-deps chromium
```

Key properties of the remediation:
- `npm install --prefix /opt/browser-smoke playwright@1.60.0` installs the Playwright Node package at the deterministic path `/opt/browser-smoke/node_modules/playwright`.
- `ENV NODE_PATH=/opt/browser-smoke/node_modules` is a Dockerfile `ENV` instruction — permanent for all container processes.
- `/opt/browser-smoke/node_modules/.bin/playwright install --with-deps chromium` uses the locally installed CLI (pinned to 1.60.0) to install the Chromium browser binary and all system dependencies. No npx invocation. No network download of the package at runtime.
- The npx cache is not used at any point.

---

## BrowserSmokeService Absolute-Path Change

`BrowserSmokeService` was updated to load Playwright via an absolute path that matches the image-owned location:

**Before:**
```typescript
const { chromium } = require('playwright');
```

**After:**
```typescript
const { chromium } = require('/opt/browser-smoke/node_modules/playwright');
```

This change eliminates any reliance on Node module resolution order and makes the service robust to any workspace-local `node_modules` that could otherwise shadow the package.

---

## Workspace Shadowing Prevention

Without the absolute-path change, if a user workspace installs a different version of `playwright` in its local `node_modules`, Node module resolution could resolve to the workspace copy instead of the image-owned copy. By requiring the absolute path `/opt/browser-smoke/node_modules/playwright`, `BrowserSmokeService` always loads the image-pinned package regardless of workspace state. This is an important isolation guarantee for the browser smoke harness.

---

## Tests Added

**File:** `services/container-manager/src/browser-smoke/browser-smoke.service.spec.ts`

**Test added:** Focused test verifying that the injected browser script uses the absolute image-owned path `/opt/browser-smoke/node_modules/playwright` rather than a bare `require('playwright')` call. This test ensures that future refactors cannot accidentally reintroduce the workspace-shadowing vulnerability.

---

## Non-Docker Validation Results

**BrowserSmokeService spec:**
- Command: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test -- --testPathPattern=browser-smoke`
- Result: PASS — 12/12 tests

**Container-manager build:**
- Command: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build`
- Result: PASS — Exit code 0

**Container-manager full test suite:**
- Command: `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test`
- Result: PASS — 81/81 tests across 7 suites

---

## Docker Validation Results

### Validation 1 — Image Build

| Item | Result |
|------|--------|
| Command | `docker build -f Dockerfile.workspace-browser -t aisandbox-workspace-browser:local .` |
| Exit code | 0 |
| Build time | ~125 seconds |
| Image size | 1.93 GB |
| npx installation or transient cache path | None |

**Verdict: PASS**

---

### Validation 2 — Node Version

| Item | Result |
|------|--------|
| Command | `docker run --rm aisandbox-workspace-browser:local node --version` |
| Output | v20.20.2 |

**Verdict: PASS**

---

### Validation 3 — Pinned Playwright Package

| Item | Result |
|------|--------|
| Command | `docker run --rm aisandbox-workspace-browser:local node -e "console.log(require('/opt/browser-smoke/node_modules/playwright/package.json').version)"` |
| Output | 1.60.0 |

**Verdict: PASS** — Package is pinned to exactly 1.60.0. No live npm download performed.

---

### Validation 4 — Normal Module Resolution

| Item | Result |
|------|--------|
| Command | `docker run --rm aisandbox-workspace-browser:local node -e "require('playwright'); console.log('playwright ok')"` |
| Output | playwright ok |
| NODE_PATH workaround required | No |

**Verdict: PASS** — `require('playwright')` resolves through `NODE_PATH=/opt/browser-smoke/node_modules` without any per-command environment injection.

---

### Validation 5 — Fixed Local CLI

| Item | Result |
|------|--------|
| Command | `docker run --rm aisandbox-workspace-browser:local /opt/browser-smoke/node_modules/.bin/playwright --version` |
| Output | Version 1.60.0 |

**Verdict: PASS** — Local CLI is present and pinned.

---

### Validation 6 — Deterministic Package Location

| Item | Result |
|------|--------|
| Command | `docker run --rm aisandbox-workspace-browser:local test -f /opt/browser-smoke/node_modules/playwright/package.json` |
| Exit code | 0 |
| Path verified | `/opt/browser-smoke/node_modules/playwright/package.json` |

**Verdict: PASS** — Package is at the exact expected deterministic path.

---

### Validation 7 — Minimal Chromium Launch

| Item | Result |
|------|--------|
| Command | `docker run --rm --shm-size=256m aisandbox-workspace-browser:local node -e "..."` |
| URL navigated | `data:` URL only |
| Output | `browser-smoke-ok` |
| Exit code | 0 |
| Chromium flags | `--no-sandbox`, `--disable-dev-shm-usage` |
| Shared memory | 256 MB |
| Crash | None |

**Verdict: PASS** — Chromium launches, navigates to a `data:` URL, and exits cleanly. No external website navigation. No platform services started.

---

## Overall Result

**PASS**

All seven Docker validation checks passed. All non-Docker validation checks passed. Defect AGENT-HARNESS-05B3-DEFECT-01 is resolved.

---

## Image Versions and Size

| Item | Value |
|------|-------|
| Image name | `aisandbox-workspace-browser:local` |
| Image size | 1.93 GB |
| Base image | node:20-slim (Debian bookworm) |
| Node version | v20.20.2 |
| Playwright package version | 1.60.0 (pinned, image-owned) |
| Playwright CLI version | 1.60.0 (local, `/opt/browser-smoke/node_modules/.bin/playwright`) |
| Chromium | Headless Shell installed via local CLI |

---

## Confirmations

- [x] No transient npx-cache dependency remains. The image no longer uses `npx playwright@...` at any stage.
- [x] Playwright is pinned to exactly 1.60.0 in the image.
- [x] Chromium launches successfully under runc with `--no-sandbox` and `--disable-dev-shm-usage`.
- [x] Normal non-browser containers remain unchanged. Only `Dockerfile.workspace-browser` and the `browser-smoke` module were modified.
- [x] Phase 5 service-chain smoke was not run. It is outside AGENT-HARNESS-05B4 scope and remains separately gated.
- [x] No source, runtime, test, package, frontend, or database files were changed during consolidation.
- [x] No commands, browser automation, Docker builds, or Playwright processes were rerun during consolidation.

---

## Remaining gVisor Validation Risk

gVisor (runsc) was not active during this validation. Standard runc 1.3.4 was used. Chromium launches successfully under runc with `--no-sandbox` and `--disable-dev-shm-usage`. If production workspace containers run under gVisor/runsc, Chromium compatibility under gVisor remains unvalidated and must be explicitly tested in a future task. This risk is inherited from AGENT-HARNESS-05B3 and is not introduced by this fix.

---

## Locked Invariants

The following invariants are locked by this checkpoint and must not be changed without explicit task authorization and a new checkpoint:

1. Playwright Node package is installed at `/opt/browser-smoke/node_modules/playwright` in the browser workspace image.
2. `NODE_PATH=/opt/browser-smoke/node_modules` is set as an `ENV` instruction in `Dockerfile.workspace-browser`.
3. Playwright is pinned to version `1.60.0`.
4. Chromium is installed via `/opt/browser-smoke/node_modules/.bin/playwright install --with-deps chromium` (local CLI, not npx).
5. `BrowserSmokeService` loads Playwright via the absolute path `require('/opt/browser-smoke/node_modules/playwright')`.
6. The transient npx cache (`/root/.npm/_npx/...`) is not used at any stage.
7. Normal non-browser containers are unaffected by this change.

---

## Dependency Chain

```
AGENT-HARNESS-05B3-DEFECT-01 (resolved)
  → AGENT-HARNESS-05B4 (COMPLETE and LOCKED)
      → AGENT-HARNESS-05B5 (not yet registered)
          Browser Smoke End-to-End Service-Chain Validation
```

---

## Next Recommended Task

**Register (do not implement yet):** `AGENT-HARNESS-05B5`

**Title:** Browser Smoke End-to-End Service-Chain Validation

**Scope:**
- Run Phase 5 service-chain browser smoke against the fixed `aisandbox-workspace-browser:local` image.
- Validate that `BrowserSmokeService` successfully launches Chromium inside a deployed workspace container via the full service chain (API Gateway → container-manager → workspace container).
- Record exact validation results and any remaining issues.

**Gate:** Requires explicit registration and Keith's approval before implementation begins.

---

*This checkpoint is COMPLETE and LOCKED. Do not modify.*
