# AUTH-APP-01H3 Checkpoint — Events Endpoint Guards + Test/Tooling Triage

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01H3 |
| Title | Events Endpoint Guards + Test/Tooling Triage |
| Family | AUTH |
| Parent | AUTH-APP-01H (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND IMPLEMENTATION + TEST/TOOLING FIXES |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01H2 (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` |

---

## Objective

Guard all three events endpoints (`POST /api/events/file-changed`, `POST /api/events/checkpoint-created`, `POST /api/events/token-updated`) with `InternalServiceAuthGuard` by extending the guard's path check and updating all container-manager callers to send `X-Internal-Service-Key`. Triage the three pre-existing test/tooling blockers (ESLint config, QuotaService DI, Redis/full-test). Formally defer the preview proxy to a dedicated investigation slice.

---

## Files Changed

| File | Change |
|---|---|
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` | Extended path check to protect `/api/events/*` in addition to `/api/internal/*` |
| `services/api-gateway/.eslintrc.js` | **Created** — minimal ESLint 8 legacy config with TypeScript ESLint recommended preset |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Replaced real `QuotaService` with `useValue` mock; corrected kill-switch test setup; cleaned local lint violations |
| `services/api-gateway/src/websocket/__tests__/events.controller.guard.spec.ts` | **Created** — 4 unit tests for events path guard protection |
| `services/container-manager/src/clients/api-gateway-http.client.ts` | Added `notifyFileChanged()` and `notifyCheckpointCreated()` methods |
| `services/container-manager/src/git/git.service.ts` | Replaced raw `httpService.post()` in `emitCheckpointCreated()` with `apiGatewayClient.notifyCheckpointCreated()` |
| `services/container-manager/src/files/files.module.ts` | Added `ClientsModule` to `imports` to make `ApiGatewayHttpClient` available to `FilesService` |
| `services/container-manager/src/files/files.service.ts` | Injected `ApiGatewayHttpClient`; replaced raw `httpService.post()` in `emitFileChange()` with `apiGatewayClient.notifyFileChanged()` |
| `services/container-manager/src/files/files.service.spec.ts` | Updated `FilesService` test constructor call to pass `apiGatewayClient` mock argument |

**Production source files changed: 5 (api-gateway: 1, container-manager: 4)**
**New files created: 2 (`.eslintrc.js`, `events.controller.guard.spec.ts`)**
**Test/tooling files changed: 3**

---

## Events Guard Implementation Summary

### Problem

`InternalServiceAuthGuard` was registered as a global `APP_GUARD` but contained a hard path bypass:

```typescript
if (!path.startsWith('/api/internal/')) {
  return true; // Bypass for non-internal routes
}
```

This meant adding `@UseGuards(InternalServiceAuthGuard)` to `EventsController` via decorator would have no effect — the guard would still return `true` for `/api/events/*` paths. All three events endpoints were effectively unguarded.

### Fix

Modified the path check to also protect the `/api/events/` path family:

```typescript
const isInternalRoute = path.startsWith('/api/internal/');
const isEventsRoute = path.startsWith('/api/events/');
if (!isInternalRoute && !isEventsRoute) {
  return true; // Bypass for public routes
}
```

The global `APP_GUARD` registration now enforces `X-Internal-Service-Key` header validation on both `/api/internal/*` and `/api/events/*`. All other paths continue to bypass as before.

### Protected endpoints after H3

- `POST /api/events/file-changed` — now guarded
- `POST /api/events/checkpoint-created` — now guarded
- `POST /api/events/token-updated` — now guarded (no caller; guard is a no-op until a caller exists)

### token-updated caller

Confirmed by targeted grep: no external caller exists in container-manager, ai-service, or api-gateway for `POST /api/events/token-updated`. The guard applies to this endpoint but causes no breakage.

### EventsController not modified

`EventsController` itself was not changed. The global guard path extension is sufficient.

---

## Container-Manager Caller Update Summary

### ApiGatewayHttpClient — new methods

Added two methods following the exact existing pattern (same `X-Internal-Service-Key` header, `${this.baseUrl}`, fail-fast logging):

| Method | Endpoint |
|---|---|
| `notifyFileChanged(sessionId, file)` | `POST ${baseUrl}/api/events/file-changed` |
| `notifyCheckpointCreated(sessionId, checkpoint)` | `POST ${baseUrl}/api/events/checkpoint-created` |

Both log success, log error + rethrow on failure (fail fast, consistent with existing client methods).

### GitService

`emitCheckpointCreated()` previously called `httpService.post('http://localhost:4000/api/events/checkpoint-created', ...)` directly with no auth header. `ApiGatewayHttpClient` was already injected in `GitService`. Replaced the raw call with `apiGatewayClient.notifyCheckpointCreated(sessionId, checkpoint)`.

### FilesService

`emitFileChange()` previously called `httpService.post('http://localhost:4000/api/events/file-changed', ...)` directly with no auth header. `ApiGatewayHttpClient` was not injected and `FilesModule` did not import `ClientsModule`.

DI fix: `ClientsModule` (which provides and exports `ApiGatewayHttpClient`) was added to `FilesModule`'s `imports`. `ApiGatewayHttpClient` was then injected into `FilesService`. The raw call was replaced with `apiGatewayClient.notifyFileChanged(sessionId, { path, action, timestamp })`.

`HttpService` injection was preserved in both services (not removed) to avoid widening scope.

---

## ESLint Config Summary

**File created:** `services/api-gateway/.eslintrc.js`

The `npm run lint` script (`eslint "{src,test}/**/*.ts"`) was previously failing immediately at ESLint startup because no config file existed. The new config uses ESLint 8 legacy format (not flat config) to match the installed `eslint@^8.56.0` and `@typescript-eslint/eslint-plugin@^6.19.0` versions:

```javascript
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true, jest: true },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
};
```

After config creation, `npm run lint` now runs and reports a repo-wide baseline of pre-existing lint errors. The H3-touched file `ai-execution-guards.integration.spec.ts` had its local violations cleaned and no longer appears in lint output.

**Repo-wide lint baseline status:** 353 pre-existing errors remain across many unrelated files. This is not a H3 regression.

---

## QuotaService Test Mock Summary

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts`

**Root cause of prior blocker:** `QuotaService` constructor uses `@InjectRepository(Session)` and `@InjectRepository(UsageRecord)` — TypeORM repository injections. The `TestingModule` in this spec did not include `TypeOrmModule` or the entity repository providers, so NestJS DI failed to resolve `QuotaService` at module compile time.

**Fix:** Replaced `QuotaService` (the real class) in `TestingModule.providers` with:

```typescript
{
  provide: QuotaService,
  useValue: {
    getCurrentUsage: jest.fn().mockReturnValue({ requests: 0, tokens: 0 }),
    clearAll: jest.fn(),
    checkRequestQuota: jest.fn().mockReturnValue(true),
    checkTokenQuota: jest.fn().mockReturnValue(true),
    recordRequest: jest.fn(),
    recordTokens: jest.fn(),
  },
}
```

No production `QuotaService` changes.

---

## ai-execution Kill-Switch Test Correction Summary

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts`

**Root cause:** `ExecutionSafetyGuard` reads provider from `process.env.AI_PROVIDER`, not `request.body.provider`. Two tests were setting `mockRequest.body.provider` and expecting provider kill-switch behavior — this had no effect on guard behavior.

**Corrections made:**

| Test | Old setup (broken) | New setup (correct) |
|---|---|---|
| `should block when PROVIDER_XAI_ENABLED=false` | Set `mockRequest.body.provider = 'unknown-provider-for-test'` | Set `process.env.AI_PROVIDER = 'xai'`; spy `KillSwitchConfig.isProviderEnabled()` to return `false` |
| `should block unknown provider by default` | Set `mockRequest.body.provider = 'unknown-provider'` | Set `process.env.AI_PROVIDER = 'unknown-provider'` |

**Additional lifecycle fixes:**

- `beforeEach` now sets `process.env.AI_PROVIDER = 'stub'` to establish a clean baseline.
- `afterEach` restores `AI_PROVIDER` safely (delete when originally undefined).
- `jest.restoreAllMocks()` added to `afterEach` to clean up spies after each test.

**Production behavior confirmed correct.** This was a stale test setup issue, not a production regression.

---

## Local Lint Cleanup Summary

**File:** `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts`

Cleaned only violations local to this H3-touched file:

| Violation | Fix |
|---|---|
| `LaunchState` imported but never used | Removed import |
| `AbortMode` imported but never used | Removed import |
| `quotaGuard` assigned but never used | Removed variable |
| `globalSafetyLimitService` assigned but never used | Removed variable |
| `mockRequest: any` — explicit any | Replaced with typed `MockRequest` interface |
| `as any` cast on `mockContext` | Replaced with `as unknown as ExecutionContext` |

No behavior changes. 31/31 tests still pass after cleanup.

---

## Preview Proxy Deferred Statement

`PreviewController` (`services/api-gateway/src/preview/preview.controller.ts`) remains fully open (`@All('*')` with no guard). No changes were made to the preview proxy in H3.

**Formal deferral reason:** Preview auth requires resolving:
1. **Product/security decision outstanding:** Public/shareable previews vs. session-owner-only previews.
2. **Incompatible auth model:** Container-manager's existing `ENABLE_PREVIEW_ACCESS_CONTROL` flag uses JWT Bearer token, incompatible with `SessionCookieGuard`.
3. **Cross-service auth-forwarding design:** No mechanism exists to forward session identity from api-gateway to container-manager.
4. **SameSite cookie behavior in iframes:** Browser iframes may not send `SameSite=Lax` cookies depending on embedding origin — session cookie auth at the proxy level may not be reliable for preview frames.

**Risk rating:** MEDIUM — `/api/preview/*` is fully open; unauthenticated requests can trigger container-manager preview operations.

The deferral remains tracked as a carry-forward for a dedicated future investigation slice.

---

## Validation Commands and Results

### Api-gateway

| Command | Result |
|---|---|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit` | PASS |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPatterns="events.controller.guard" --runInBand` | PASS — 4/4 |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPatterns="ai-execution-guards" --runInBand` | PASS — 31/31 |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run lint` | FAIL — 353 repo-wide baseline errors (H3-touched file `ai-execution-guards.integration.spec.ts` no longer appears in output) |

### Container-manager

| Command | Result |
|---|---|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npx tsc --noEmit` | PASS |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\container-manager"; npm test -- files` | PASS — 2/2 |

---

## Non-Goals Confirmed

- No preview proxy auth implementation
- No full `npm test` suite run (Redis environment constraint — environment-dependent, not a H3 regression)
- No auth endpoint changes
- No frontend changes
- No dependency additions
- No AUTH-APP-01C2 work
- No container-manager broad refactor
- No removal of `HttpService` injections from `FilesService` or `GitService`
- No repo-wide lint cleanup

---

## Risks and Invariants Preserved

| Item | Status |
|---|---|
| `InternalServiceAuthGuard` global `APP_GUARD` registration unchanged | Confirmed — only path check extended |
| All existing `/api/internal/*` protection behavior unchanged | Confirmed — path check is additive |
| `EventsController` not modified | Confirmed |
| `HttpService` injections in `FilesService` and `GitService` preserved | Confirmed — not removed; safe to clean in future slice |
| Apple `POST /api/auth/apple/callback` CSRF exclusion unaffected | Confirmed — guard path check bypass unchanged for auth routes |
| Container-manager `ApiGatewayHttpClient` fail-fast behavior preserved | Confirmed — new methods follow same throw-on-error pattern |
| `FilesService` and `GitService` event emission remains best-effort (errors caught and logged, not re-thrown) | Confirmed — `emitFileChange()` and `emitCheckpointCreated()` still catch errors from the client |
| Preview proxy risk rating: MEDIUM | Formally recorded and deferred |
| Redis blocker — full `npm test` not required for H3 | Confirmed — targeted test strategy only |

---

## Carry-Forward Blockers

| Item | Nature | Resolution |
|---|---|---|
| Preview proxy `/api/preview/*` fully open | Product/security decision + cross-service auth-forwarding design required | Dedicated future investigation slice |
| api-gateway lint baseline (353 errors) | Pre-existing repo-wide debt | Out of H3 scope; separate lint cleanup slice needed |
| Backend full `npm test` with Redis | Environment constraint — `REDIS_URL` absent in test env | Targeted test strategy; no code fix required |

---

## Reference

- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` — governing spec (H3 scope: Section 11)
- `docs/AUTH-APP-01H1-CHECKPOINT.md` — H1 inventory checkpoint
- `docs/AUTH-APP-01H2-CHECKPOINT.md` — H2 CSRF + rate limiting checkpoint
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `TASKS.md` → AUTH-APP-01H3
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H3

---

## Next Recommended Task

**AUTH-APP-01H4 — Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation (PLANNED)**

Scope (per spec Section 11):
- Secrets grep audit: confirm no hardcoded OAuth credentials, `.p8` keys, or real secret values in tracked source files
- Manual smoke checklist disposition: F-family (22 items), G-family (12 items), H-specific items — run against live environment or record NOT RUN with reason
- H-specific smoke items include: CSRF cookie presence, CSRF rejection without header, rate limiting triggers, events endpoint 401 without key
- Family checkpoint `docs/AUTH-APP-01H-CHECKPOINT.md`
- `TASKS.md` and `TASKS_BACKLOG_FULL.md` update for AUTH-APP-01H parent status
