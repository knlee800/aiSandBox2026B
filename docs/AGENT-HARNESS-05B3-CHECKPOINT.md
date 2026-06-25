# AGENT-HARNESS-05B3 Checkpoint

**Task ID:** AGENT-HARNESS-05B3
**Title:** Browser Smoke Live Validation / Docker Image Build Verification
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-25
**Nature:** VALIDATION / DOCKER IMAGE BUILD / LIVE BROWSER SMOKE

---

## Validation Scope

- Docker CLI and daemon availability check.
- Browser workspace image build (`Dockerfile.workspace-browser` → `aisandbox-workspace-browser:local`).
- Static image verification: Node.js, Playwright/Chromium module availability.
- Minimal Chromium launch smoke inside the built image.
- Phase 5 service-chain smoke: NOT RUN (requires Dockerfile fix first).

---

## Phases Executed

### Phase 1 — Docker Availability Check

**Command:**
```powershell
docker version
docker info
```

**Result:**
- Docker CLI: v29.2.1 windows/amd64
- Docker daemon: v29.2.1 linux/amd64, Docker Desktop 4.62.0
- Runtime: WSL2, overlayfs, seccomp + cgroupns
- Container runtime: runc 1.3.4 (standard)
- gVisor (runsc): NOT active
- Prior `aisandbox-workspace-browser:local` image: did not exist before build

**Verdict: PASS**

---

### Phase 2 — Browser Workspace Image Build

**Command:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"
docker build -f Dockerfile.workspace-browser -t aisandbox-workspace-browser:local .
```

**Result:**
- Exit code: 0
- Build time: ~162 seconds
- Image size: 1.94 GB
- Base image: node:20-slim (Debian bookworm)
- Node version in image: v20.20.2
- Chromium: Headless Shell 148.0.7778.96, Playwright chromium-headless-shell v1223
- Warnings: npm notice about newer npm (non-blocking)

**Verdict: PASS**

---

### Phase 3 — Static Image Verification

**Commands and results:**

```powershell
# Node version
docker run --rm aisandbox-workspace-browser:local node --version
# Result: v20.20.2 — PASS

# Playwright CLI via npx
docker run --rm aisandbox-workspace-browser:local npx playwright --version
# Result: reports 1.61.0 (npx fetched live) — PASS for CLI presence

# Playwright module resolution (standard path)
docker run --rm aisandbox-workspace-browser:local node -e "require('playwright'); console.log('playwright ok')"
# Result: MODULE_NOT_FOUND — FAIL

# Playwright module resolution (with NODE_PATH workaround)
docker run --rm -e NODE_PATH=/root/.npm/_npx/... aisandbox-workspace-browser:local node -e "require('playwright'); console.log('playwright ok')"
# Result: playwright ok — PASS (workaround only)
```

**Root cause:**
`Dockerfile.workspace-browser` uses `npx playwright@1.60.0 install --with-deps chromium` during build.
This command installs the Chromium browser binary and its system dependencies, but it leaves the `playwright` npm package only inside the transient npx cache (`/root/.npm/_npx/...`).
The package is **not** installed in any standard Node.js module resolution path (`node_modules` in the workspace root, a global `npm install -g`, or a fixed project directory).
Therefore `require('playwright')` fails with `MODULE_NOT_FOUND` in a fresh container process.

**Verdict: PARTIAL PASS — Dockerfile fix required**

---

### Phase 4 — Minimal Chromium Launch Check

**Command (using NODE_PATH workaround):**
```powershell
docker run --rm --shm-size=256m -e NODE_PATH=/root/.npm/_npx/... aisandbox-workspace-browser:local \
  node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await browser.close();
  console.log('browser-smoke-ok');
})();
"
```

**Result:**
- Exit code: 0
- Output: `browser-smoke-ok`
- Duration: ~1.4 seconds
- Chromium flags: `--no-sandbox`, `--disable-dev-shm-usage`
- Missing shared libraries: none
- Crash: none
- gVisor: not active (runc 1.3.4 used)

**Verdict: PASS**

---

### Phase 5 — Service-Chain Smoke

**Status: NOT RUN**

Phase 5 was not executed. The Playwright module resolution defect (Phase 3) must be fixed in `Dockerfile.workspace-browser` before the `BrowserSmokeService` can resolve `require('playwright')` inside a deployed workspace container. Service-chain smoke will be re-run in a follow-up task after the fix is applied and a new image is built.

---

## Phase Verdict Table

| Phase | Description                          | Verdict       |
|-------|--------------------------------------|---------------|
| 1     | Docker Availability Check            | PASS          |
| 2     | Browser Workspace Image Build        | PASS          |
| 3     | Static Image Verification            | PARTIAL PASS  |
| 4     | Minimal Chromium Launch Check        | PASS          |
| 5     | Service-Chain Smoke                  | NOT RUN       |

**Overall result: PARTIAL PASS**

---

## Defect Found

**ID:** AGENT-HARNESS-05B3-DEFECT-01
**Severity:** Blocker for service-chain smoke
**Component:** `services/container-manager/Dockerfile.workspace-browser`

**Description:**
`BrowserSmokeService` injects and executes a script that calls:
```javascript
const { chromium } = require('playwright');
```
This `require('playwright')` call fails inside the built image with `MODULE_NOT_FOUND` because the Playwright npm package is not installed in any standard resolvable location on the Node.js module path.

**Root cause:**
The Dockerfile uses `npx playwright@1.60.0 install --with-deps chromium`, which downloads and runs the playwright CLI via the npx cache to install the browser binary and system dependencies. However, this does NOT install the `playwright` package in a location that is discoverable by `require()` in a running Node.js process. The npx cache path (`/root/.npm/_npx/...`) is implementation-dependent and not a stable resolution path.

---

## Recommended Fix

**Preferred approach: Dockerfile fix — install playwright in a stable resolvable location.**

Replace the current npx-based install approach with one of the following, in order of preference:

**Option A (recommended): Global npm install**
```dockerfile
RUN npm install -g playwright@1.60.0 && npx playwright install --with-deps chromium
```
This installs the `playwright` package globally (discoverable via `require('playwright')`) and then installs the browser binary.

**Option B: Fixed project directory with NODE_PATH**
```dockerfile
RUN mkdir -p /opt/playwright && cd /opt/playwright && npm install playwright@1.60.0
ENV NODE_PATH=/opt/playwright/node_modules
RUN node -e "require('playwright/install').install(['chromium'])" || npx playwright install --with-deps chromium
```

**Do NOT choose the runtime workaround as the long-term fix:**
Passing `NODE_PATH=/root/.npm/_npx/...` at container runtime is brittle because the exact cache path is implementation-dependent, not guaranteed across Docker/npm versions, and not stable.

---

## gVisor / Runtime Status

- gVisor (runsc) is NOT active in this development/validation environment.
- Standard runc 1.3.4 is used.
- Chromium launches successfully under runc with `--no-sandbox` and `--disable-dev-shm-usage`.
- **Open risk:** If production deploys workspace containers with gVisor/runsc, Chromium compatibility under gVisor remains unvalidated and must be explicitly tested and recorded in a future task.

---

## Confirmations

- [x] No source files modified during validation.
- [x] No TASKS.md or TASKS_BACKLOG_FULL.md edits during validation execution.
- [x] No platform services started.
- [x] No sessions created.
- [x] No git commands run during validation.
- [x] No checkpoint created before consolidation.
- [x] Phase 5 service-chain smoke was not run.
- [x] AGENT-HARNESS-05B3 completed as validation-only with a follow-up Dockerfile fix required.
- [x] No runtime/test/package/Docker/frontend/database files changed during consolidation.

---

## Next Recommended Task

**Register:** `AGENT-HARNESS-05B4` (or equivalent fix slice)

**Title:** Dockerfile.workspace-browser — Fix Playwright Module Resolution

**Scope:**
- Update `services/container-manager/Dockerfile.workspace-browser` to install the `playwright` npm package in a standard resolvable location (global npm install or fixed project directory with `NODE_PATH`).
- Rebuild `aisandbox-workspace-browser:local` and re-run Phase 3 static verification to confirm `require('playwright')` resolves.
- Re-run Phase 4 Chromium launch check without the NODE_PATH workaround.
- Re-run Phase 5 service-chain smoke after fix is confirmed.

**Do not start implementation until registered and explicitly approved.**

---

*This checkpoint is COMPLETE and LOCKED. Do not modify.*
