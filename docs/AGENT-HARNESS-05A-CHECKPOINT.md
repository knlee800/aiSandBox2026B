# AGENT-HARNESS-05A Checkpoint — Browser Smoke Tool Investigation

**Task ID:** AGENT-HARNESS-05A
**Title:** Browser Smoke Tool Investigation
**Status:** COMPLETE and LOCKED
**Checkpoint Date:** 2026-06-23

---

## Scope Confirmation

This was an investigation-only task. No source files, runtime files, test files, package files, or dependency files were modified. No dependencies were installed. No browser automation was executed. No checkpoint was created until this consolidation step.

---

## Problem / Objective Summary

**Problem:** Agent Harness now has file tools, mutation checkpoint safety, and allow-listed validation. The master plan next defines a `browser_smoke` tool so the agent can verify generated apps in a real browser. Browser automation is high risk — it may require Playwright/Puppeteer, Docker/gVisor compatibility, elevated resource controls, network isolation decisions, and careful separation between image/runtime prerequisites and production handler implementation.

**Objective:** Investigate feasibility of programmatic browser testing inside the current sandbox environment. Produce findings, a recommended service boundary, a recommended future slice split, and a security model. No production browser_smoke handler to be implemented in this slice.

---

## Files and Areas Inspected

### ai-service

| File | Purpose |
|---|---|
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | browser_smoke registry entry, enabled/config state |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | enableBrowserSmoke and browserSmokeTimeoutMs config keys |
| `services/ai-service/src/agent-harness/contracts/agent-harness-contracts.v1.ts` | BrowserSmokeResultV1 contract shape |
| `services/ai-service/src/worker/worker.processor.ts` | browser_smoke handler wiring (absence confirmed) |
| `services/ai-service/package.json` | dependency check for Playwright/Puppeteer |

### container-manager

| File | Purpose |
|---|---|
| `services/container-manager/src/docker/docker-runtime.service.ts` | container lifecycle, image, resource limits |
| `services/container-manager/src/docker/governance/docker-governance.service.ts` | Docker governance/security model |
| `services/container-manager/src/sessions/preview-port.service.ts` | preview port registration |
| `services/container-manager/src/sessions/sessions.service.ts` | session lifecycle and sandbox image |
| `services/container-manager/package.json` | dependency check for browser automation |

### api-gateway

| File | Purpose |
|---|---|
| `services/api-gateway/src/preview/preview-proxy.service.ts` | PreviewProxyService, container IP+port resolution |
| `services/api-gateway/src/preview/preview.controller.ts` | preview proxy controller |
| `services/api-gateway/package.json` | dependency check for browser automation |

### Docker and compose

| File | Purpose |
|---|---|
| `docker-compose.yml` | service definitions, gVisor runtime config |
| `services/container-manager/Dockerfile` | container-manager image |
| `services/ai-service/Dockerfile` | ai-service image |

### Existing smoke/integration tests

| File | Purpose |
|---|---|
| `services/ai-service/src/worker/smoke.integration.spec.ts` | confirmed HTTP-level smoke only, not browser |

### grep scans (no-match confirming browser libraries absent)

- Pattern `playwright` — no matches across all services
- Pattern `puppeteer` — no matches across all services
- Pattern `chromium` — no matches across all services (non-binary context)
- Pattern `cypress` — no matches across all services
- Pattern `selenium` — no matches across all services
- Pattern `webdriver` — no matches across all services

### Master plan

| File | Purpose |
|---|---|
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | browser_smoke master plan context |

---

## Existing browser_smoke Registry State (Unchanged)

From `tool-registry.ts`:

```
browser_smoke:
  enabled: false
  implementationStatus: planned
  riskLevel: high
  requiresApproval: true
```

From `agent-harness.config.ts`:

```
enableBrowserSmoke: false
browserSmokeTimeoutMs: 120_000
```

No `browser_smoke` handler is wired in `WorkerProcessor`. The tool is declared in the registry for planning purposes only.

---

## Existing Preview Architecture Summary

The preview flow already exists and is stable:

1. The workspace container runs the user's generated app or dev server on a dynamic port.
2. `container-manager` registers the preview port via `PreviewPortService`.
3. `PreviewProxyService` in api-gateway resolves the container IP and port for a given session.
4. API Gateway proxies browser preview traffic to the container.

This existing flow means a browser smoke tool can target a stable preview URL through the API Gateway — no need to expose container IPs directly.

---

## Docker / Runtime / Sandbox Findings

- Current workspace sandbox image: `node:20-alpine`.
- `node:20-alpine` does not include Chromium, required shared libraries, or `/dev/shm` support sufficient for headless browser launch.
- Docker/gVisor isolation is referenced in `docker-compose.yml` but gVisor is not confirmed active in the current dev/local environment.
- No existing service launches a browser.
- Chromium inside a container requires: a custom image layer with Chromium and Playwright/Puppeteer, `/dev/shm` size increase (typically 256MB+), `--no-sandbox` flag (acceptable inside a container), and elevated memory/CPU limits.
- These are non-trivial image and runtime changes that must be done deliberately and must not be combined with the production handler implementation.

---

## Feasibility Assessment

**Browser smoke is feasible but is not safe to implement directly in the current `node:20-alpine` sandbox.**

Prerequisites that must be addressed first:

| Prerequisite | Owner |
|---|---|
| Custom sandbox image or layer with Chromium + Playwright | container-manager / infra |
| `/dev/shm` volume configuration | container-manager / docker-compose |
| Resource limits (memory, CPU) for browser-enabled sessions | container-manager |
| gVisor compatibility confirmation for headless Chrome | container-manager / infra |

Only after the image/runtime prerequisites are complete should the production `browser_smoke` handler be implemented.

---

## Recommended Service Owner

**container-manager** should own browser automation execution.

Rationale:
- container-manager already manages the workspace sandbox lifecycle, Docker runtime, preview port registration, and internal exec.
- Browser smoke execution requires knowledge of container network, image capabilities, and resource controls — all owned by container-manager.
- ai-service should not launch browsers directly; it should call through the established service boundary.

---

## Recommended Service Boundary

```
ai-service (browser_smoke handler)
  → ApiGatewayHttpClient.runBrowserSmoke()
  → API Gateway: POST /api/internal/workspace/:sessionId/browser-smoke
    (InternalServiceAuthGuard)
  → container-manager: BrowserSmokeService
    → resolves preview URL (PreviewProxyService or internal port lookup)
    → launches Playwright (chromium, headless, no-sandbox) inside workspace container
    → navigates to preview URL
    → captures: status, page title, console errors, screenshot (base64), network errors
    → enforces timeout and artifact size limits
    → returns BrowserSmokeResultV1
  → returns to ai-service handler
  → ai-service returns result to ToolDispatcher / agent loop
```

A separate browser-worker service is **not recommended** at this stage. container-manager already owns the container lifecycle and has the necessary context. Adding a dedicated browser-worker service would introduce another service boundary, inter-service communication overhead, and deployment complexity for a feature that is tightly coupled to container lifecycle. This recommendation should be revisited only if browser smoke execution proves to require sustained concurrency at scale.

---

## Recommended Future browser_smoke Input Contract

```typescript
interface BrowserSmokeInput {
  url?: string;           // optional override; defaults to session preview URL
  timeoutMs?: number;     // capped at browserSmokeTimeoutMs from config
  waitForSelector?: string; // optional CSS selector to wait for before capture
}
```

---

## Recommended Timeout / Resource / Artifact Limits

| Limit | Recommended Value | Notes |
|---|---|---|
| Browser launch timeout | 30,000ms | fail fast if image not ready |
| Page navigation timeout | `browserSmokeTimeoutMs` (default 120,000ms) | forwarded from config |
| Screenshot max size | 512KB (base64) | truncate and flag if larger |
| Console error max entries | 50 | truncate and flag |
| Network error max entries | 50 | truncate and flag |
| `/dev/shm` size | 256MB minimum | required for Chromium stability |
| Memory limit per browser session | 512MB recommended | enforced at Docker level |

---

## Recommended Security Model

- **No persistent browser profiles.** Use incognito/temp profile per run; discard after smoke completes.
- **No credential exposure.** Never pass platform cookies, session tokens, or OAuth state to the browser smoke runner. `browser_smoke` is isolated from platform auth.
- **`--no-sandbox` is acceptable inside an isolated container** but must not be used outside one.
- **Network isolation.** Browser smoke runs against the session's preview URL only; no external internet access from the browser runner unless explicitly designed and approved.
- **Timeout enforcement is mandatory.** Hard kill the browser process if timeout elapses.
- **Artifact size limits are mandatory.** Screenshots and console logs must be truncated before returning to the agent.
- **Live browser smoke requires Keith's explicit approval** before any smoke run is executed in a real environment.
- **`browser_smoke` must not be registered until `enableBrowserSmoke: true` is set in config and 05B1 and 05B2 are both complete.**

---

## Decision: Separate Browser-Worker Service

**Decision: Not recommended for initial implementation.**

container-manager already has:
- Docker runtime access
- Container network knowledge
- Preview port registration
- Internal exec precedent

A `BrowserSmokeService` inside container-manager is the lowest-risk, lowest-complexity path. Revisit if sustained browser concurrency or multi-tenant isolation requires it.

---

## Recommended Future Slice Split

### AGENT-HARNESS-05B1 — Browser Smoke Sandbox Image Prerequisite

**Scope:**
- Create or document a custom sandbox image or image layer that includes Chromium and Playwright
- Configure `/dev/shm` support and resource limits in docker-compose or container runtime config
- Confirm gVisor compatibility (or document known incompatibility)
- Validate that a headless browser can launch successfully inside the sandbox
- Do not implement a production `browser_smoke` handler in this slice
- No ai-service changes
- No tool registry enablement

**Why separate:** Image and runtime changes carry independent risk. They must be validated before any handler code is written. Combining them would make rollback harder and make the blast radius of a failure larger.

### AGENT-HARNESS-05B2 — Browser Smoke Handler Implementation

**Scope (only after 05B1 is COMPLETE and LOCKED):**
- `BrowserSmokeService` in container-manager
- Internal endpoint: `POST /api/internal/workspace/:sessionId/browser-smoke` in API Gateway
- `ApiGatewayHttpClient.runBrowserSmoke()` in ai-service
- `browser_smoke` tool handler in ai-service (`browser-smoke-tool-handlers.ts`)
- `ToolDispatcher` registration (double-gated, harness v1 only)
- Tool registry: `enabled: true`, `implementationStatus: 'implemented'`
- Tests for handler, client, endpoint, and dispatcher registration
- Live browser smoke only after Keith's explicit approval

**Why separate:** Handler implementation is a distinct risk surface that depends on the image/runtime work being stable. Separating allows each slice to be reviewed and locked independently.

---

## Proposed Future Files to Change (05B1)

| File | Change |
|---|---|
| `services/container-manager/Dockerfile` (or new `Dockerfile.sandbox`) | add Chromium + Playwright layer |
| `docker-compose.yml` | `/dev/shm`, memory/cpu limits for browser-enabled sessions |
| `docs/AGENT-HARNESS-05B1-CHECKPOINT.md` | new checkpoint |
| `TASKS.md` | register and close 05B1 |
| `TASKS_BACKLOG_FULL.md` | mirror |

## Proposed Future Files to Change (05B2)

| File | Change |
|---|---|
| `services/container-manager/src/browser-smoke/browser-smoke.service.ts` | new: BrowserSmokeService |
| `services/container-manager/src/browser-smoke/browser-smoke.service.spec.ts` | new: tests |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.ts` | add POST `:sessionId/browser-smoke` endpoint |
| `services/api-gateway/src/sessions/internal-workspace-files.controller.spec.ts` | add tests |
| `services/ai-service/src/clients/api-gateway-http.client.ts` | add `runBrowserSmoke()` |
| `services/ai-service/src/clients/api-gateway-http.client.spec.ts` | add tests |
| `services/ai-service/src/agent-harness/tools/handlers/browser-smoke-tool-handlers.ts` | new: handler |
| `services/ai-service/src/agent-harness/tools/handlers/browser-smoke-tool-handlers.spec.ts` | new: tests |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | enable browser_smoke |
| `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts` | update enabled count, split test |
| `services/ai-service/src/worker/worker.processor.ts` | register browser_smoke handler |
| `services/ai-service/src/worker/worker.processor.spec.ts` | add/update tests |
| `docs/AGENT-HARNESS-05B2-CHECKPOINT.md` | new checkpoint |
| `TASKS.md` | register and close 05B2 |
| `TASKS_BACKLOG_FULL.md` | mirror |

---

## Proposed Future Tests / Validation (05B2)

- Unit: `BrowserSmokeService` — success path, timeout, screenshot truncation, console error truncation, cleanup
- Unit: `browser-smoke-tool-handlers.spec.ts` — success, timeout, artifact limits, missing sessionId
- Unit: `api-gateway-http.client.spec.ts` — runBrowserSmoke correct endpoint + headers + body
- Unit: `internal-workspace-files.controller.spec.ts` — 400 on missing body, delegates to BrowserSmokeService, returns result
- Unit: `tool-registry.spec.ts` — browser_smoke enabled, implemented
- Unit: `worker.processor.spec.ts` — browser_smoke registered in double-gated harness branch
- Integration/smoke: live browser smoke run against a simple generated app preview — **requires Keith's explicit approval before execution**

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| gVisor incompatibility with headless Chrome | Confirm in 05B1; fallback to plain Docker isolation if needed |
| `/dev/shm` insufficient by default | Configure in 05B1 via docker-compose shm_size or tmpfs |
| Browser process not killed on timeout | Hard kill (SIGKILL) with process group cleanup in BrowserSmokeService |
| Screenshot too large for agent context | Enforce 512KB limit; truncate and flag |
| Platform auth cookie leakage into browser | Never pass platform cookies to browser runner; use isolated profile only |
| Untrusted JS in generated app triggering host | gVisor + network isolation + no-sandbox inside container is the defense layer |
| 05B2 implemented without stable 05B1 image | Sequential lock enforcement: 05B2 must not be registered until 05B1 is COMPLETE and LOCKED |

---

## Governance Confirmations

- **No source/runtime/test/package files were changed during investigation.**
- **No dependencies were installed during investigation.**
- **No browser automation was executed.**
- **`browser_smoke` remains `enabled: false` and unregistered in WorkerProcessor.**
- **No tool registry enabled-state changes were made.**
- **No source/runtime/test/package files were changed during this consolidation.**
- **Only governance/docs files changed in this consolidation: this checkpoint, TASKS.md, TASKS_BACKLOG_FULL.md.**

---

## Next Recommended Task

**AGENT-HARNESS-05B1 — Browser Smoke Sandbox Image Prerequisite**

Registration only. Do not implement until 05B1 is registered and approved.
Do not register AGENT-HARNESS-05B2 until AGENT-HARNESS-05B1 is COMPLETE and LOCKED.
