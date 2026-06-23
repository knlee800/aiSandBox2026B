# AGENT-HARNESS-05B1 Checkpoint — Browser Smoke Sandbox Image Prerequisite

**Task ID:** AGENT-HARNESS-05B1
**Title:** Browser Smoke Sandbox Image Prerequisite
**Status:** COMPLETE and LOCKED
**Checkpoint Date:** 2026-06-23

---

## Scope Confirmation

This was an infrastructure/prerequisite slice. Implementation was bounded to container-manager only:
`Dockerfile.workspace-browser`, `governance.config.ts`, `docker-runtime.service.ts`, and its spec file.

No ai-service, api-gateway, or frontend files were modified. No package/dependency files were modified. No browser automation was run. No Docker image build was run. No checkpoint was created before this consolidation step.

---

## Problem / Objective Summary

**Problem:** AGENT-HARNESS-05A established that `browser_smoke` is feasible but the current workspace sandbox image (`node:20-alpine`) cannot safely run Chromium/Playwright without a custom image layer, adjusted resource limits (`/dev/shm`, memory, CPU, PIDs), and explicit runtime configuration. Combining image/runtime prerequisites with the production handler would widen blast radius and complicate rollback.

**Objective:** Create a bounded prerequisite slice that prepares the browser-capable sandbox image strategy and adjusts container-manager runtime config for browser-capable containers — without implementing the `browser_smoke` tool handler, without enabling browser_smoke in the tool registry, and without running any live browser automation.

---

## Architecture / Security Review Summary

Before implementation the following was confirmed:

- **Separate Dockerfile strategy adopted:** `Dockerfile.workspace-browser` was created as a new file, separate from the existing container-manager `Dockerfile`. The existing `Dockerfile` for the container-manager service image is unchanged.
- **Separate image constant:** `BROWSER_SANDBOX_IMAGE = 'aisandbox-workspace-browser:local'` was added in `docker-runtime.service.ts`. The default `node:20-alpine` sandbox image constant is unchanged.
- **Opt-in flag only:** `createContainer({ browserCapable: true })` activates the browser image and browser resource limits. All existing callers pass no flag; the default path remains `node:20-alpine` with standard limits.
- **No ShmSize on default path:** Non-browser containers retain their existing resource profile with no `ShmSize`.
- **Resource limits are separate:** Browser-specific limits are governed by new `governance.config.ts` fields (CPU, memory, PIDs, ShmSize) and are not applied to non-browser containers.
- **No auth/credential exposure:** The Dockerfile installs only system packages and Playwright. No platform auth tokens, cookies, or service keys are present.
- **No browser automation executed:** The Dockerfile was created for future image build use only; no `docker build` was run.
- **No secrets:** Dockerfile and config contain no hardcoded secrets, API keys, passwords, or tokens.
- **No persistent browser profiles:** The image design does not include persistent profile directories.
- **`browser_smoke` remains disabled:** `enableBrowserSmoke: false` in ai-service config is unchanged. `browser_smoke` is not registered with ToolDispatcher.
- **gVisor:** gVisor compatibility with headless Chrome is a known open risk, documented in AGENT-HARNESS-05A. It is not resolved in this slice and must be addressed before any live smoke run.

---

## Implementation Summary

### Dockerfile.workspace-browser

New file: `services/container-manager/Dockerfile.workspace-browser`

- Base image: `node:20-slim` (Debian-based, required for Chromium shared-library compatibility)
- Installs: `git`, `ca-certificates`, Chromium via Playwright 1.60.0 (`npx playwright@1.60.0 install --with-deps chromium`)
- Chromium pinned to Playwright 1.60.0 at build time
- No persistent browser profiles
- No platform auth references
- No hardcoded secrets or credentials
- No service tokens

This image is ready to be built and tagged as `aisandbox-workspace-browser:local` when a live smoke step is approved. No `docker build` was run during this slice.

### governance.config.ts

New fields added to `GovernanceConfig` and `GovernanceService`:

| Field | Default | Notes |
|---|---|---|
| `browserContainerCpuLimit` | `1.0` | CPU limit for browser-capable containers |
| `browserContainerMemoryLimitMb` | `768` | Memory limit in MB for browser-capable containers |
| `browserContainerPidsLimit` | `512` | PID limit for browser-capable containers |
| `browserContainerShmSizeMb` | `256` | `/dev/shm` size in MB required for Chromium stability |

New helper methods added to `GovernanceService`:
- `getBrowserContainerMemoryLimitBytes()` — returns `browserContainerMemoryLimitMb * 1024 * 1024`
- `getBrowserContainerShmSizeBytes()` — returns `browserContainerShmSizeMb * 1024 * 1024`

### docker-runtime.service.ts

Changes:

- Added `CreateContainerOptions` interface: `{ browserCapable?: boolean }`
- Added `BROWSER_SANDBOX_IMAGE = 'aisandbox-workspace-browser:local'` constant
- Updated `createContainer()` signature to accept optional `options?: CreateContainerOptions`
- Added `browserCapable` branch inside `createContainer()`:
  - Uses `aisandbox-workspace-browser:local` image
  - Applies `browserContainerCpuLimit`, `browserContainerMemoryLimitMb`, `browserContainerPidsLimit`
  - Sets `ShmSize` from `getBrowserContainerShmSizeBytes()`
- Default (non-browser) path is unchanged:
  - Uses `node:20-alpine`
  - Standard memory/CPU/PID limits from existing governance config
  - No `ShmSize`

No existing callers pass `browserCapable: true`. The default code path is fully backward-compatible.

---

## Exact Implementation Files Changed

| File | Change |
|---|---|
| `services/container-manager/Dockerfile.workspace-browser` | **Created** — new browser-capable workspace image definition |
| `services/container-manager/src/config/governance.config.ts` | **Modified** — added browser-specific governance config fields and helper methods |
| `services/container-manager/src/docker/docker-runtime.service.ts` | **Modified** — added `CreateContainerOptions`, `BROWSER_SANDBOX_IMAGE`, and `browserCapable` branch in `createContainer()` |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | **Modified** — added tests for `browserCapable: true` path and new governance config fields |

No other files were changed.

---

## Exact Tests Added / Updated

File: `services/container-manager/src/docker/docker-runtime.service.spec.ts`

Tests added/updated:
- `createContainer` — `browserCapable: true` uses `aisandbox-workspace-browser:local` image
- `createContainer` — `browserCapable: true` applies browser-specific memory, CPU, PID limits from governance config
- `createContainer` — `browserCapable: true` sets `ShmSize` from `getBrowserContainerShmSizeBytes()`
- `createContainer` — default (no options) still uses `node:20-alpine` with standard limits and no `ShmSize`
- `GovernanceConfig` — `browserContainerCpuLimit`, `browserContainerMemoryLimitMb`, `browserContainerPidsLimit`, `browserContainerShmSizeMb` fields present with correct defaults
- `GovernanceService` — `getBrowserContainerMemoryLimitBytes()` returns correct byte value
- `GovernanceService` — `getBrowserContainerShmSizeBytes()` returns correct byte value

---

## Exact Validation Commands and Results

### Test suite (spec file)

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx jest --no-cache src/docker/docker-runtime.service.spec.ts
```

**Result:** PASS — 28/28 tests

### TypeScript build

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```

**Result:** PASS — TypeScript clean, no errors

### Full container-manager test suite

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test
```

**Result:** PASS — 67/67 tests across 6 suites

---

## Dockerfile.workspace-browser Behavior

| Property | Value |
|---|---|
| Base image | `node:20-slim` (Debian-based) |
| Installed system packages | `git`, `ca-certificates`, Playwright Chromium dependencies |
| Chromium install method | `npx playwright@1.60.0 install --with-deps chromium` |
| Playwright version | Pinned to `1.60.0` |
| Persistent browser profiles | None |
| Platform auth references | None |
| Hardcoded secrets or tokens | None |
| Build status | Not built — file created for future `docker build` when approved |
| Intended image tag | `aisandbox-workspace-browser:local` |

---

## Governance Config Changes

New fields in `GovernanceConfig` (with defaults from environment or fallback):

| Config key | Default | Purpose |
|---|---|---|
| `BROWSER_CONTAINER_CPU_LIMIT` | `1.0` | CPU limit for browser-capable containers |
| `BROWSER_CONTAINER_MEMORY_LIMIT_MB` | `768` | Memory limit (MB) for browser-capable containers |
| `BROWSER_CONTAINER_PIDS_LIMIT` | `512` | PID limit for browser-capable containers |
| `BROWSER_CONTAINER_SHM_SIZE_MB` | `256` | `/dev/shm` size (MB) for Chromium stability |

New helper methods:

| Method | Returns |
|---|---|
| `getBrowserContainerMemoryLimitBytes()` | `browserContainerMemoryLimitMb * 1024 * 1024` |
| `getBrowserContainerShmSizeBytes()` | `browserContainerShmSizeMb * 1024 * 1024` |

---

## DockerRuntimeService browserCapable Behavior

| Scenario | Image | Memory | CPU | PIDs | ShmSize |
|---|---|---|---|---|---|
| `createContainer()` (default) | `node:20-alpine` | standard governance limit | standard governance limit | standard governance limit | none |
| `createContainer({ browserCapable: true })` | `aisandbox-workspace-browser:local` | `browserContainerMemoryLimitMb` | `browserContainerCpuLimit` | `browserContainerPidsLimit` | `browserContainerShmSizeMb` |

No existing callers pass `browserCapable: true`. The default path is fully backward-compatible and unchanged.

---

## Invariant Confirmations

- **Normal non-browser containers remain unchanged.** The default `createContainer()` path uses `node:20-alpine` and the existing standard resource limits with no `ShmSize`. No behavior change for any existing caller.
- **`browser_smoke` was not implemented.** No `BrowserSmokeService`, no browser-smoke endpoint, no `runBrowserSmoke()` client method, no `browser-smoke-tool-handlers.ts`.
- **`browser_smoke` was not enabled.** `enableBrowserSmoke: false` in `agent-harness.config.ts` is unchanged.
- **`browser_smoke` was not registered with ToolDispatcher.** `worker.processor.ts` is unchanged.
- **No browser automation was run.** No Playwright or Puppeteer execution occurred.
- **No Docker image build was run.** `Dockerfile.workspace-browser` was created but not built.
- **No package.json changes.** No new dependencies were added to any service.
- **No ai-service changes.** `ai-service` source files are unchanged.
- **No api-gateway changes.** `api-gateway` source files are unchanged.
- **No frontend changes.** `frontend` source files are unchanged.
- **TASKS.md and TASKS_BACKLOG_FULL.md were not changed during implementation.** Governance docs updated only in this consolidation step.
- **No checkpoint document was created before this consolidation.** This is the first and only checkpoint for AGENT-HARNESS-05B1.

---

## Open Risk: gVisor Compatibility

gVisor compatibility with headless Chromium is a known open risk documented in AGENT-HARNESS-05A. This slice does not resolve it. Before any live browser smoke is executed:

- gVisor compatibility must be confirmed (or documented as incompatible with a plain-Docker fallback).
- Keith's explicit approval for a live browser smoke step must be obtained.

---

## Next Recommended Task

**AGENT-HARNESS-05B2 — Browser Smoke Handler Implementation**

Registration only. Do not implement until AGENT-HARNESS-05B2 is registered and approved.

Scope (registration only, not implementation):
- `BrowserSmokeService` in container-manager
- Internal endpoint: `POST /api/internal/workspace/:sessionId/browser-smoke` in API Gateway
- `ApiGatewayHttpClient.runBrowserSmoke()` in ai-service
- `browser_smoke` tool handler in ai-service (`browser-smoke-tool-handlers.ts`)
- `ToolDispatcher` registration (double-gated, harness v1 only)
- Tool registry: `enabled: true`, `implementationStatus: 'implemented'`
- Tests for handler, client, endpoint, and dispatcher registration
- Live browser smoke only after Keith's explicit approval and gVisor compatibility confirmation

Do not register AGENT-HARNESS-05B3 until AGENT-HARNESS-05B2 is COMPLETE and LOCKED.
