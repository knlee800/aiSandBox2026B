# AGENT-HARNESS-05B5A Checkpoint

**Task ID:** AGENT-HARNESS-05B5A
**Title:** Browser-Capable Session Creation Wiring
**Status:** COMPLETE and LOCKED
**Checkpoint created:** 2026-06-25
**Nature:** BACKEND WIRING / INTERNAL SESSION CONTROL / PREREQUISITE FIX / NO LIVE BROWSER SMOKE

---

## Original Blocker from AGENT-HARNESS-05B5 Planning

AGENT-HARNESS-05B5 planning produced a phase-by-phase live validation plan but identified a prerequisite blocker before any live command was run.

**Blocker:** `SessionsService.startSessionContainer()` in `services/container-manager/src/sessions/sessions.service.ts` called `DockerRuntimeService.createContainer(sessionId, workspacePath)` without passing `{ browserCapable: true }`. The normal session start path always created a standard `node:20-alpine` container, never `aisandbox-workspace-browser:local`. No exposed API endpoint or service method created a browser-capable container through the platform's own session boundary.

**Impact:** The real end-to-end `browser_smoke` service-chain validation could not prove the intended product/runtime flow because the platform could not create browser-capable sessions through its own internal session start path.

**Manual workaround rejected:** Manually running `docker run` with a container named `sandbox-session-{sessionId}` was evaluated and rejected as the official 05B5 validation method because it bypasses the real session creation path and does not validate the intended service boundary.

---

## Architecture and Security Decision

**Design option selected:** Internal-only opt-in endpoint (Candidate option 1 from the 05B5A registration).

**Decision rationale:**
- Adds a new internal-only route `POST /api/internal/sessions/:id/start` on `InternalSessionsController`.
- The route accepts `{ userId?: string, browserCapable?: boolean }` in the request body.
- The route normalizes only `browserCapable === true` (strict equality) into `{ browserCapable: true }` passed to `SessionsService`.
- Omitted, falsy, or any other value is treated identically to the default non-browser path.
- The internal controller is protected at the class level by `InternalServiceAuthGuard`, which validates `X-Internal-Service-Key`. The new route inherits this protection automatically.
- Public `SessionsController` was not modified. No public user-facing route exposes a browser-capable session flag.
- Browser-capable containers (`aisandbox-workspace-browser:local`) are heavier; they must remain internal-only and must not be available to end users as a product feature unless separately designed and approved.

**Security invariants confirmed:**
- No public route exposes `browserCapable`.
- The browser-capable opt-in is gated behind `X-Internal-Service-Key` on an internal-only route.
- Default session creation behavior is unchanged.
- No credentials, cookies, or tokens are injected into containers.
- No external URL navigation was introduced.
- No public product feature was added.

---

## Exact Files Changed

**Implementation files:**

1. `services/container-manager/src/sessions/sessions.service.ts`
   - `startSessionContainer()` extended with optional third parameter: `options?: { browserCapable?: boolean }`
   - When `options?.browserCapable === true`, passes `{ browserCapable: true }` to `DockerRuntimeService.createContainer()`.
   - All other cases (omitted, false, undefined) preserve existing non-browser behavior with no change to `createContainer()` call signature.

2. `services/container-manager/src/sessions/internal-sessions.controller.ts`
   - New internal route added: `POST /api/internal/sessions/:id/start`
   - Accepts `{ userId?: string, browserCapable?: boolean }` in request body.
   - Normalizes `browserCapable === true` strictly; any other value results in no browser-capable option being passed.
   - Protected by existing class-level `InternalServiceAuthGuard`.

**Test files:**

3. `services/container-manager/src/sessions/internal-sessions.controller.spec.ts`
   - New spec file for the internal sessions controller.
   - 9 tests covering: route protection, default non-browser behavior, explicit browser-capable opt-in, userId forwarding, invalid/missing body handling.

4. `services/container-manager/src/sessions/sessions.service.spec.ts`
   - Updated to cover: default non-browser behavior unchanged, browser-capable opt-in passes correct options to `DockerRuntimeService`.
   - 6 tests pass.

**No other files were changed.**

---

## Exact SessionsService Behavior

**Method signature extended:**
```typescript
async startSessionContainer(
  sessionId: string,
  workspacePath: string,
  options?: { browserCapable?: boolean }
): Promise<void>
```

**Behavior:**
- `options` omitted → `DockerRuntimeService.createContainer(sessionId, workspacePath)` called with no third argument. Container uses `node:20-alpine` (standard image). Identical to pre-05B5A behavior.
- `options.browserCapable === true` (strict) → `DockerRuntimeService.createContainer(sessionId, workspacePath, { browserCapable: true })` called. Container uses `aisandbox-workspace-browser:local`.
- `options.browserCapable === false` or `undefined` → same as omitted; non-browser path.

---

## Exact InternalSessionsController Route Behavior

**Route:** `POST /api/internal/sessions/:id/start`

**Guard:** Class-level `InternalServiceAuthGuard` (validates `X-Internal-Service-Key`). New route inherits this guard automatically.

**Request body:** `{ userId?: string, browserCapable?: boolean }`

**Normalization logic:**
- `browserCapable === true` → calls `SessionsService.startSessionContainer(id, workspacePath, { browserCapable: true })`
- Any other value (false, undefined, omitted) → calls `SessionsService.startSessionContainer(id, workspacePath)` — standard non-browser behavior

**Response:** Standard internal session start response (session state updated).

---

## Public Route Unchanged Confirmation

`SessionsController` (public-facing) was not modified. No public route exposes a `browserCapable` flag. Public session start continues to use the standard non-browser path with no change.

---

## Internal Service-Key Protection Confirmation

`InternalSessionsController` is decorated at the class level with `@UseGuards(InternalServiceAuthGuard)`. The new `POST /api/internal/sessions/:id/start` route is a method on this class and inherits the guard without any additional configuration. Requests without a valid `X-Internal-Service-Key` header are rejected before the handler executes.

---

## Default Non-Browser Behavior Confirmation

All existing session creation paths (public `SessionsController`, existing `InternalSessionsController` routes, all callers that do not pass `options`) invoke `startSessionContainer()` without the third parameter. This is identical to the pre-05B5A call signature. `DockerRuntimeService.createContainer()` is called without `{ browserCapable: true }`, producing a standard `node:20-alpine` container. No regression to default session behavior.

---

## Browser-Capable Explicit Opt-In Behavior Confirmation

Browser-capable session creation requires:
1. A request to `POST /api/internal/sessions/:id/start` with a valid `X-Internal-Service-Key` header.
2. Request body containing `{ browserCapable: true }` (strict boolean true).

Only under these exact conditions does `DockerRuntimeService.createContainer()` receive `{ browserCapable: true }` and select `aisandbox-workspace-browser:local`.

---

## Tests Added / Updated

### New: `internal-sessions.controller.spec.ts`
- 9 tests total
- Covers: guard protection, userId handling, default non-browser behavior, browser-capable opt-in normalization, falsy browserCapable treated as non-browser, missing body fields, error propagation

### Updated: `sessions.service.spec.ts`
- 6 tests total
- Covers: default `startSessionContainer` passes no options to `DockerRuntimeService`, `startSessionContainer` with `{ browserCapable: true }` passes correct options, regression for existing service behavior

---

## Exact Validation Commands and Results

**1. Targeted internal controller spec:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx jest --no-cache src/sessions/internal-sessions.controller.spec.ts
```
Result: **PASS — 9/9 tests**

**2. Targeted sessions service spec:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx jest --no-cache src/sessions/sessions.service.spec.ts
```
Result: **PASS — 6/6 tests**

**3. Docker runtime regression spec:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx jest --no-cache src/docker/docker-runtime.service.spec.ts
```
Result: **PASS — 28/28 tests**

**4. TypeScript build:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm run build
```
Result: **PASS — TypeScript clean, exit code 0**

**5. Full container-manager test suite:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test
```
Result: **PASS — 90/90 tests across 8 suites**

---

## Security Invariants

- `browserCapable` flag is not exposed on any public route.
- Internal route requires valid `X-Internal-Service-Key` via `InternalServiceAuthGuard`.
- `browserCapable === true` strict normalization prevents accidental truthy escalation.
- Default session behavior (standard `node:20-alpine` container) is preserved for all paths that do not explicitly opt in.
- No credentials, cookies, platform tokens, or service keys are injected into containers.
- No external URL navigation introduced.
- No new npm dependencies added.
- No Dockerfile, docker-compose, database schema, or API Gateway/ai-service/frontend files changed.

---

## Regression Confirmations

- Docker runtime service spec: 28/28 PASS — `DockerRuntimeService` behavior unchanged.
- Sessions service spec: 6/6 PASS — existing session creation behavior unchanged.
- Full container-manager suite: 90/90 PASS — no regressions in any other module.
- TypeScript build: clean — no type errors introduced.

---

## Scope Confirmations

- **No Docker commands run** during this task.
- **No service startup** performed.
- **No live sessions created.**
- **No browser automation run.**
- **No browser_smoke executed.**
- **No Phase 5 service-chain smoke run.**
- **No API Gateway files changed.**
- **No ai-service files changed.**
- **No frontend files changed.**
- **No database schema files changed.**
- **No Dockerfile files changed.**
- **No package.json / package-lock.json / npm files changed.**
- **No docker-compose files changed.**
- **No governance config files changed** (this checkpoint and TASKS.md / TASKS_BACKLOG_FULL.md updates are the only governance changes, made during consolidation only).

---

## Remaining Status of AGENT-HARNESS-05B5

**Status: ACTIVE**

The blocking prerequisite (browser-capable session creation wiring) has been resolved by this task. However, AGENT-HARNESS-05B5's blocked status can only be formally lifted after the 05B5 validation plan is refreshed to use the new internal start route (`POST /api/internal/sessions/:id/start` with `{ browserCapable: true }`).

AGENT-HARNESS-05B5 must not begin live execution until:
1. The validation plan is refreshed to reference the new internal route.
2. Keith explicitly approves the refreshed plan.

---

## Next Recommended Step

Resume AGENT-HARNESS-05B5 with a refreshed validation plan and approval gate. The plan must be updated to use `POST /api/internal/sessions/:id/start` with `{ browserCapable: true, userId: ... }` and a valid `X-Internal-Service-Key` to create a browser-capable session through the platform's own session boundary. After Keith approves the refreshed plan, live Phase 5 service-chain validation may proceed.

Do not begin live execution of AGENT-HARNESS-05B5 before the plan refresh and explicit approval.

---

**Lock notice:** AGENT-HARNESS-05B5A is COMPLETE and LOCKED. Do not modify this checkpoint. Do not reopen or re-implement without explicit approval.
