# AUTH-APP-01H Security Hardening Spec

**Date:** 2026-05-07
**Status:** APPROVED — gates AUTH-APP-01H2, AUTH-APP-01H3, AUTH-APP-01H4 implementation
**Task:** AUTH-APP-01H1 — Security Hardening Inventory
**Parent:** AUTH-APP-01H (ACTIVE)
**Spec type:** INVENTORY AND IMPLEMENTATION SCOPE — documentation only

---

## 1. Purpose and Scope

This document is the governing spec for the AUTH-APP-01H family. It records the current security hardening state discovered during the AUTH-APP-01H1 inventory, rates each gap, and defines the exact implementation scope for child slices H2, H3, and H4.

**AUTH-APP-01H1 (this slice):** Inventory and spec only. No production source files changed.

**AUTH-APP-01H2:** CSRF protection, auth endpoint rate limiting, redirect allowlist hardening, and `api-gateway/.env.example` documentation updates.

**AUTH-APP-01H3:** Events endpoint guard fix (container-manager callers + `EventsController`), test/tooling blocker triage (ESLint config, QuotaService mock, Redis blocker documentation), and preview proxy scope disposition.

**AUTH-APP-01H4:** Secrets grep audit, manual smoke checklist disposition (F-family 22 items + G-family 12 items), final AUTH-APP-01H checkpoint and parent status update.

### Out of scope for all H-family slices

- AUTH-APP-01C2 (email verification, password reset, rate limiting for reset/resend) — BLOCKED on email provider
- AUTH-MODULE-01 (generated app-auth for user-created apps)
- Workspace redesign, Visual Edit Mode
- Billing/subscription changes
- Admin dashboard

---

## 2. Gap Inventory Summary Table

| Area | Current State | Gap Rating | Target Slice |
|---|---|---|---|
| CSRF protection | No synchronizer token, no CSRF middleware | **MISSING** | AUTH-APP-01H2 |
| Auth endpoint rate limiting | `@nestjs/throttler` not installed; no decorators | **MISSING** | AUTH-APP-01H2 |
| OAuth state parameter | `state: true` functional; secret env vars undocumented | **PARTIAL** | AUTH-APP-01H2 (docs) |
| Redirect allowlist | Hardcoded targets; no formal allowlist constant | **NO OPEN REDIRECT — ADD FORMAL ALLOWLIST** | AUTH-APP-01H2 |
| Secrets/env documentation | All OAuth + session vars missing from `api-gateway/.env.example` | **SIGNIFICANT GAP** | AUTH-APP-01H2 (docs) + AUTH-APP-01H4 (audit) |
| Events endpoints (3) | Unguarded; callers send no auth headers | **UNGUARDED** | AUTH-APP-01H3 |
| Preview proxy (`/api/preview/*`) | Fully open proxy; incompatible auth model; product decision needed | **UNGUARDED — DEFER** | AUTH-APP-01H3 (disposition) |
| Backend full `npm test` Redis | `REDIS_URL` absent in test env; module init fails | **ENVIRONMENT BLOCKER** | AUTH-APP-01H3 (document strategy) |
| `ai-execution` `QuotaService` test | Unresolved dependency in test module | **TEST BLOCKER** | AUTH-APP-01H3 (targeted mock) |
| Backend ESLint config discovery | No `.eslintrc.*` file in `services/api-gateway` | **TOOLING BLOCKER** | AUTH-APP-01H3 (add config) |

---

## 3. CSRF Protection

### 3.1 Current state

No CSRF middleware exists in the application. `main.ts` registers:
- `cookieSession` — for OAuth state only (`aisandbox_oauth_state`, 10-minute TTL, HttpOnly, signed)
- `cookieParser` — parses the `aisandbox_session` cookie for `SessionCookieGuard`

`SessionCookieGuard` reads the session cookie and validates it against the `auth_sessions` table. There is no CSRF token check at any point in the request lifecycle.

### 3.2 Mitigating factor: SameSite=Lax

The session cookie in `auth.controller.ts` is set with `sameSite: 'lax'`. This prevents cross-site POST requests from modern browsers under the `SameSite=Lax` policy. This provides real partial CSRF protection.

However, `SameSite=Lax` alone does not satisfy the spec requirement (Section 12.2). Mitigations:
- Does not protect against same-origin subdomains if the deployment uses subdomains
- Does not protect against browser bugs or legacy browser behaviour
- Does not provide an auditable, verifiable CSRF enforcement mechanism

### 3.3 Spec requirement (Section 12.2)

> Required for all cookie-authenticated state-mutating requests. Recommended: synchronizer token pattern using a separate non-HttpOnly CSRF cookie that the frontend reads and sends as a request header.

**Required approach for H2:**
1. On authentication (session creation) or on the first request, generate a cryptographically random CSRF token
2. Set a **non-HttpOnly** cookie (e.g., `aisandbox_csrf`) containing the raw CSRF token — the frontend JavaScript must be able to read this
3. On all `POST`, `PUT`, `PATCH`, `DELETE` requests to cookie-authenticated routes, require a matching `X-CSRF-Token` header
4. The CSRF validation compares the header value against the cookie value (double-submit cookie pattern) or validates against a server-side store (synchronizer token pattern)

### 3.4 Implementation approach for H2

**Recommended pattern:** Double-submit cookie (simpler, no server-side state required for the CSRF token itself).

- A NestJS middleware (not a guard) sets the non-HttpOnly CSRF cookie on every response if not already present
- A guard or middleware validates the `X-CSRF-Token` header against the cookie value on all mutating routes protected by `SessionCookieGuard`
- The frontend reads `aisandbox_csrf` cookie and sends it as `X-CSRF-Token` header on all `fetch`/`axios` mutating calls

**Cookie attributes for `aisandbox_csrf`:**
```
Set-Cookie: aisandbox_csrf=<token>; SameSite=Lax; Path=/
```
Note: NOT HttpOnly — the frontend must be able to read this cookie.

### 3.5 Apple POST callback exclusion (CRITICAL)

`POST /api/auth/apple/callback` must be **excluded from CSRF enforcement**. This endpoint is called by Apple's servers directly as an HTTP POST — Apple does not carry the `aisandbox_csrf` browser cookie. Applying CSRF validation to this route would break Apple OAuth entirely.

The CSRF middleware/guard must explicitly exclude:
- `POST /api/auth/apple/callback`
- All `GET` OAuth initiation routes (`GET /api/auth/google`, `GET /api/auth/apple`)
- All public auth entry points (`POST /api/auth/login`, `POST /api/auth/register`)

Only cookie-session-protected mutating routes require CSRF enforcement.

### 3.6 CORS interaction

`main.ts` configures `app.enableCors({ origin: true, credentials: true })`. The `origin: true` setting reflects all request origins. This should be tightened to an explicit allowlist in production but is out of scope for AUTH-APP-01H (no change to CORS for this family).

---

## 4. Auth Endpoint Rate Limiting

### 4.1 Current state

`package.json` (`services/api-gateway`) does not include `@nestjs/throttler` in either `dependencies` or `devDependencies`. No throttling decorators (`@Throttle()`), no `ThrottlerGuard`, and no `ThrottlerModule` configuration exist anywhere in the api-gateway codebase. There is no IP-based or user-based rate limiting on any auth endpoint.

### 4.2 Endpoints in scope for H2

Only endpoints that exist today are in scope:

| Endpoint | Required limit (Spec Section 7.5) |
|---|---|
| `POST /api/auth/login` | 10 requests per minute per IP |
| `POST /api/auth/register` | 5 requests per minute per IP |

Out of scope (AUTH-APP-01C2 BLOCKED — endpoint does not exist):
- `POST /api/auth/password-reset/request` — 5/hr/email, 10/hr/IP
- `POST /api/auth/email/verify/resend` — 3/hr/user

### 4.3 Dependency requirement

`@nestjs/throttler` must be installed before H2 implementation can begin.

**This is a new production dependency. Explicit user approval is required before H2 begins** (per `CLAUDE.md` governance rule: "Always ask before adding new dependencies").

### 4.4 In-memory vs Redis-backed throttler recommendation

**Recommendation: In-memory throttler for H2.**

`@nestjs/throttler` supports both in-memory storage (`ThrottlerStorageService`, default) and Redis-backed storage. Using in-memory storage for H2:
- Does not add a Redis environment requirement to this slice
- Avoids entangling H2 with the pre-existing `REDIS_URL` test blocker
- Is sufficient for single-instance deployments
- Can be migrated to Redis-backed storage in a later slice if horizontal scaling is needed

If Redis-backed throttling is required, it must be treated as a separate scoped change after H3 resolves the Redis blocker.

### 4.5 Implementation approach for H2

1. Install `@nestjs/throttler` (after user approval)
2. Register `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` in `AppModule` as the default
3. Add `APP_GUARD` for `ThrottlerGuard` globally, or apply per-controller/per-route with `@Throttle()`
4. Override on `POST /auth/login`: 10 per 60 seconds per IP
5. Override on `POST /auth/register`: 5 per 60 seconds per IP
6. Ensure all other auth routes (OAuth initiation, callbacks, logout, me) are excluded or have appropriate limits

---

## 5. OAuth State Parameter

### 5.1 Current state — functionally implemented

Both OAuth strategies use `state: true`:

```typescript
// google.strategy.ts
super({ state: true, ... });

// apple.strategy.ts
super({ state: true, ... });
```

With `state: true`, `passport-google-oauth20` and `@nicokaiser/passport-apple`:
- Generate a cryptographically random state value per OAuth initiation
- Store the state in the configured session backend
- Validate the state parameter on callback before invoking `validate()`
- Reject callbacks with missing or mismatched state

The `cookieSession` middleware (`aisandbox_oauth_state`, signed, 10-min TTL, HttpOnly, SameSite=Lax) in `main.ts` serves as the session backend for state storage.

**The state mechanism satisfies the spec requirement (Section 12.3) at the implementation level.**

### 5.2 Secret fallback chain risk

`main.ts` derives the OAuth state cookie signing key as:

```typescript
const oauthStateSecret =
  process.env.OAUTH_STATE_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  'change_this_in_production_use_a_long_random_string';
```

If none of the first three environment variables are configured, the session signing falls back to a hardcoded development string. If `JWT_SECRET` is set (as it is in the root `.env.example`) and used in production, the OAuth state cookie is signed with the same key as JWTs — not ideal but functional. The hardcoded fallback is only reached if all three are absent.

**Risk rating: LOW in practice** (root `.env.example` documents `JWT_SECRET`). However, deployers who copy `api-gateway/.env.example` only (rather than root `.env.example`) will not see `JWT_SECRET` and may run without it. See Section 7.

### 5.3 Action for H2 and H4

- **H2:** Add `OAUTH_STATE_SECRET`, `SESSION_SECRET`, and `JWT_SECRET` to `api-gateway/.env.example` with clear comments
- **H4:** Verify that no production deployment relies on the hardcoded fallback string

---

## 6. Redirect Allowlist

### 6.1 Current state — functionally safe, no formal allowlist

OAuth callbacks in `auth.controller.ts` redirect to hardcoded paths only:

```typescript
// Success
response.redirect(`/${locale}/app`);

// Error
response.redirect(`/${locale}/login?error=oauth_failed`);
response.redirect(`/${locale}/login?error=account_conflict`);
```

The `locale` value is sourced from `req.session?.oauthLocale`, which is set at OAuth initiation from a validated query parameter:

```typescript
private normalizeLocale(locale?: string): string {
  if (!locale || !AuthController.SUPPORTED_LOCALES.has(locale)) {
    return 'en';
  }
  return locale;
}

private static readonly SUPPORTED_LOCALES = new Set(['en', 'zh-TW', 'zh-CN']);
```

**No user-controlled redirect URL parameter exists. No open redirect vulnerability is present in the current code.**

### 6.2 Formal allowlist requirement for H2

The spec (Section 12.4) requires:
> "Post-login and post-OAuth redirect targets must match an explicit allowlist."

Even though the current implementation is safe, a formal allowlist provides a structural guarantee: if a future developer adds a `?redirect=` parameter to the OAuth flow, the allowlist prevents the result from becoming an open redirect vulnerability.

**H2 should add:**

```typescript
private static readonly ALLOWED_POST_OAUTH_REDIRECTS = new Set([
  '/app',
  '/login',
]);
```

And a validation method that constructs the final redirect URL from `locale` + a validated path, rejecting anything not in the allowlist. The locale validation already in place remains unchanged.

### 6.3 Scope

This is a low-complexity hardening step — one private constant and one validation method call. It does not change any observable behavior of the current implementation.

---

## 7. Secrets/Env Documentation

### 7.1 Current state — source code clean, documentation gaps

No real credentials were found hardcoded in any inspected source file during H1. All strategy constructors use the `process.env.X || 'missing-x-placeholder'` pattern with clearly labeled placeholder strings. The code is clean.

### 7.2 Missing entries in `services/api-gateway/.env.example`

The following environment variables are used by the api-gateway at runtime but are not documented in `services/api-gateway/.env.example`:

| Variable | Used in | Required for |
|---|---|---|
| `JWT_SECRET` | `main.ts` (OAUTH_STATE_SECRET fallback) | OAuth state cookie signing fallback |
| `SESSION_SECRET` | `main.ts` (OAUTH_STATE_SECRET fallback) | OAuth state cookie signing fallback |
| `OAUTH_STATE_SECRET` | `main.ts` | OAuth state cookie signing (preferred) |
| `GOOGLE_CLIENT_ID` | `google.strategy.ts` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | `google.strategy.ts` | Google OAuth |
| `GOOGLE_CALLBACK_URL` | `google.strategy.ts` | Google OAuth callback |
| `APPLE_CLIENT_ID` | `apple.strategy.ts` | Apple OAuth (Services ID) |
| `APPLE_TEAM_ID` | `apple.strategy.ts` | Apple OAuth |
| `APPLE_KEY_ID` | `apple.strategy.ts` | Apple OAuth |
| `APPLE_PRIVATE_KEY` | `apple.strategy.ts` | Apple OAuth (.p8 key as PEM string) |
| `APPLE_CALLBACK_URL` | `apple.strategy.ts` | Apple OAuth callback |

### 7.3 Root `.env.example` status

| Variable | Status |
|---|---|
| `JWT_SECRET` | Present ✓ |
| `INTERNAL_SERVICE_KEY` | Present ✓ |
| `REDIS_URL` | Present ✓ |
| `SESSION_SECRET` | Missing |
| `OAUTH_STATE_SECRET` | Missing |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | Missing |
| `APPLE_*` | Missing |

### 7.4 Apple `.p8` private key note

`APPLE_PRIVATE_KEY` is a PEM-formatted string derived from the `.p8` file downloaded from the Apple Developer Portal. **This key can only be downloaded once.** It must be stored securely (environment variable, secrets manager) and must never be committed to source control. The `.gitignore` must exclude any file that might contain it.

### 7.5 H2 action

Update `services/api-gateway/.env.example` to document all variables in the table above, with appropriate comments distinguishing required-in-production from optional-in-dev.

### 7.6 H4 action

Run a secrets grep audit to confirm:
- No `GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, or real credential values appear in any tracked source file
- No `.p8` file is committed
- All confirmed secrets are environment-variable-only

---

## 8. Events Endpoint Carry-Forward

### 8.1 Current state — three unguarded endpoints

`EventsController` (`services/api-gateway/src/websocket/events.controller.ts`):

```typescript
@Controller('events')
export class EventsController {
  @Post('file-changed')    // NO GUARD
  @Post('checkpoint-created')  // NO GUARD
  @Post('token-updated')   // NO GUARD
}
```

Any caller can POST to these endpoints without authentication.

### 8.2 `file-changed` caller

`services/container-manager/src/files/files.service.ts` calls this endpoint via raw `HttpService.post` with no `X-Internal-Service-Key` header:

```typescript
await firstValueFrom(
  this.httpService.post('http://localhost:4000/api/events/file-changed', {
    sessionId,
    file: { path: filePath, action, timestamp: new Date().toISOString() },
  }),
  // no headers — unauthenticated call
);
```

`files.service.ts` injects only `HttpService` (and `SessionsService`). It does **not** inject `ApiGatewayHttpClient`.

### 8.3 `checkpoint-created` caller

`services/container-manager/src/git/git.service.ts` calls this endpoint via raw `HttpService.post` with no authentication header:

```typescript
await firstValueFrom(
  this.httpService.post('http://localhost:4000/api/events/checkpoint-created', {
    sessionId,
    checkpoint,
  }),
  // no headers — unauthenticated call
);
```

`git.service.ts` already injects `ApiGatewayHttpClient` (used correctly for `/api/internal/*` routes). The events call bypasses it and uses `httpService` directly.

### 8.4 `token-updated` caller

No caller was found in any service during H1 inspection. The endpoint is defined in `EventsController` and `emitTokenUpdate()` exists in `EventsGateway`, but no HTTP POST to `POST /api/events/token-updated` was found in `container-manager`, `ai-service`, or `api-gateway` source. It is effectively unused as an HTTP endpoint today.

This should be confirmed with a targeted grep at H3 stage-start before adding the guard. If a caller is found (e.g., from ai-service), it must be updated before the guard is added.

### 8.5 Fix design for H3

**Step 1 — Extend `ApiGatewayHttpClient` with events methods (container-manager):**

Add two new methods to `services/container-manager/src/clients/api-gateway-http.client.ts`:
- `notifyFileChanged(sessionId, file)` — POSTs to `/api/events/file-changed` with `X-Internal-Service-Key` header
- `notifyCheckpointCreated(sessionId, checkpoint)` — POSTs to `/api/events/checkpoint-created` with `X-Internal-Service-Key` header

**Step 2 — Update `files.service.ts`:**
- Inject `ApiGatewayHttpClient` alongside the existing `HttpService`
- Replace the raw `httpService.post(...)` events call with `apiGatewayClient.notifyFileChanged(...)`

**Step 3 — Update `git.service.ts`:**
- `ApiGatewayHttpClient` is already injected
- Replace the raw `httpService.post(...)` events call with `apiGatewayClient.notifyCheckpointCreated(...)`

**Step 4 — Add guard to `EventsController`:**
- Add `@UseGuards(InternalServiceAuthGuard)` at the class level

**Step 5 — Confirm `token-updated` has no external caller:**
- If no caller found: add guard, no caller update needed
- If caller found: update that caller first, then add guard

### 8.6 Files in scope for H3 (events fix)

| File | Change |
|---|---|
| `services/container-manager/src/clients/api-gateway-http.client.ts` | Add `notifyFileChanged()` and `notifyCheckpointCreated()` methods |
| `services/container-manager/src/files/files.service.ts` | Inject `ApiGatewayHttpClient`; replace raw HTTP call |
| `services/container-manager/src/git/git.service.ts` | Replace raw HTTP call with client method |
| `services/api-gateway/src/websocket/events.controller.ts` | Add `@UseGuards(InternalServiceAuthGuard)` class-level |

---

## 9. Preview Proxy Carry-Forward

### 9.1 Current state — fully open proxy

`PreviewController` (`services/api-gateway/src/preview/preview.controller.ts`):

```typescript
@Controller('preview')
export class PreviewController {
  @All('*')
  async proxyToContainerManager(@Req() req: Request, @Res() res: Response) {
    // No guard. Blindly proxies all methods to container-manager.
  }
}
```

No `@UseGuards(...)` at any level. Any unauthenticated HTTP request reaching the api-gateway on any method and path matching `/api/preview/*` is forwarded to container-manager.

### 9.2 Container-manager access control state

`services/container-manager/.env.example`:
```
ENABLE_PREVIEW_ACCESS_CONTROL=false
JWT_SECRET=change_this_in_production_use_a_long_random_string
```

The container-manager has an existing access control flag using `JWT_SECRET` for JWT Bearer validation. This mechanism is:
- **Disabled by default** (`ENABLE_PREVIEW_ACCESS_CONTROL=false`)
- **Incompatible with `SessionCookieGuard`** — it validates a JWT Bearer token, not the `aisandbox_session` cookie

### 9.3 Why this cannot be addressed in H3 without a dedicated design

Fixing preview auth requires resolving a product/security decision that has not been made:

1. **Public/shareable previews:** Preview URLs may be intentionally accessible by anyone (e.g., to share a running app without login). Adding `SessionCookieGuard` would break this use case.
2. **Session-owner-only previews:** Preview URLs may be restricted to the authenticated session owner. This requires forwarding session identity from the api-gateway to container-manager — a cross-service auth-forwarding design that does not currently exist.
3. **SameSite cookie behavior in iframes:** Browser iframes may not send `SameSite=Lax` cookies depending on the embedding origin — session cookie auth at the proxy level may not be reliable for preview frames.

Implementing preview auth in H3 without an approved design would either break preview functionality or introduce an incomplete/insecure auth solution.

### 9.4 H3 action

H3 should formally record the preview proxy as a deferred carry-forward with:
- Current state documented (this section)
- Risk rating: **MEDIUM** — `/api/preview/*` is fully open; an authenticated session is not required to trigger container-manager preview operations
- Explicit decision recorded: preview auth requires a separate dedicated investigation slice
- The carry-forward remains tracked in the AUTH-APP-01H3 checkpoint and does not block AUTH-APP-01H closure

### 9.5 What a dedicated preview fix slice would require

- Product decision: public vs. session-owner-only preview
- Design for session identity forwarding from api-gateway to container-manager
- Replacement of container-manager's JWT Bearer access control with a SessionCookie-compatible approach
- Testing preview in browser iframe context with SameSite cookie behavior verified

---

## 10. Test/Tooling Blockers

### 10.1 Backend full `npm test` — Redis/bootstrap blocker

**Nature:** Environment constraint, not a code defect.

`services/api-gateway/package.json` has `ioredis` and `bullmq` as production dependencies. Modules that initialize BullMQ queues attempt a Redis connection at module init time. Without `REDIS_URL` set in the test environment, these module initializations fail and cascade into test suite failures.

`api-gateway/.env.example` lists `REDIS_URL` as commented-out optional. The root `.env.example` lists `REDIS_URL=redis://:your_redis_password_here@localhost:6379`.

**Established workaround:** Run targeted tests by spec file path rather than full `npm test`. This pattern is used consistently across AUTH-APP-01B through AUTH-APP-01G.

**H3 action:** Document the targeted-test strategy explicitly in the H3 checkpoint. No code change is required for this blocker — it is an environment constraint. The api-gateway's full `npm test` is not expected to pass without a running Redis instance.

### 10.2 `ai-execution-guards.integration.spec.ts` — QuotaService test blocker

**Nature:** Test configuration defect — missing mock provider.

The full integration spec for `ai-execution` guards cannot be loaded because `QuotaService` cannot be resolved in the `TestingModule`. This prevents the full test suite for this file from running.

This is not a production code defect — the `QuotaService` is correctly used in production. The test module was not updated to include a mock or stub provider.

**H3 action:** Add a `QuotaService` mock provider to the `TestingModule` in the affected spec file. This is a bounded fix: one test file, one additional `{ provide: QuotaService, useValue: { ... } }` entry. No production code changes.

### 10.3 Backend ESLint config discovery — tooling blocker

**Nature:** Missing configuration file.

`services/api-gateway/package.json` `lint` script:
```json
"lint": "eslint \"{src,test}/**/*.ts\""
```

ESLint 8.x requires a config file (`.eslintrc.js`, `.eslintrc.json`, `.eslintrc.ts`, or `eslint.config.js`). No such file exists in `services/api-gateway/`. All required packages are present in devDependencies:
- `eslint: ^8.56.0`
- `@typescript-eslint/eslint-plugin: ^6.19.0`
- `@typescript-eslint/parser: ^6.19.0`

**H3 action:** Create a minimal `.eslintrc.js` (or `.eslintrc.json`) in `services/api-gateway/` with the TypeScript ESLint recommended preset. This is a single configuration file addition. No production code changes. Lint errors or warnings surfaced after config creation should be recorded but only fixed if they are within H3's scope (do not trigger unrelated refactors).

---

## 11. H2/H3/H4 Boundary Definitions

### AUTH-APP-01H2 — CSRF + Rate Limiting + Redirect Allowlist + Env Documentation

**Nature:** Backend implementation + documentation

**Files in scope:**

| File | Change |
|---|---|
| `services/api-gateway/src/main.ts` | Add CSRF middleware registration |
| `services/api-gateway/src/auth/auth.controller.ts` | Add `@Throttle()` on login/register; add redirect allowlist check |
| `services/api-gateway/src/app.module.ts` | Register `ThrottlerModule` |
| `services/api-gateway/src/auth/session-cookie.guard.ts` | Add CSRF header validation (if guard-level approach selected) |
| `services/api-gateway/.env.example` | Add all missing OAuth + session env vars with comments |
| `services/api-gateway/package.json` | Add `@nestjs/throttler` (after user approval) |
| New: CSRF utility/middleware file | CSRF token generation and double-submit validation |

**Pre-H2 prerequisite:** Explicit user approval for `@nestjs/throttler` dependency.

**Validation commands for H2:**
```powershell
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx tsc --noEmit
npm test -- --testPathPattern="auth" --runInBand
```

**H2 non-goals:**
- No changes to OAuth strategies
- No changes to session creation or revocation
- No frontend changes
- No container-manager changes
- No rate limiting for password-reset or resend (blocked — endpoints don't exist)
- No Redis-backed throttler (in-memory only for H2)

---

### AUTH-APP-01H3 — Events Endpoint Guards + Tooling Triage + Preview Disposition

**Nature:** Backend implementation (events fix) + test/tooling fixes + documentation (preview)

**Files in scope — events fix:**

| File | Change |
|---|---|
| `services/container-manager/src/clients/api-gateway-http.client.ts` | Add `notifyFileChanged()` and `notifyCheckpointCreated()` methods |
| `services/container-manager/src/files/files.service.ts` | Inject `ApiGatewayHttpClient`; replace raw events call |
| `services/container-manager/src/git/git.service.ts` | Replace raw events call with `apiGatewayClient` method |
| `services/api-gateway/src/websocket/events.controller.ts` | Add `@UseGuards(InternalServiceAuthGuard)` class-level |

**Files in scope — tooling:**

| File | Change |
|---|---|
| New: `services/api-gateway/.eslintrc.js` | Minimal TypeScript ESLint config |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Add `QuotaService` mock provider to `TestingModule` |

**Documentation:**
- Preview proxy: formal deferral record (see Section 9.4) in the H3 checkpoint

**H3 validation commands:**
```powershell
# api-gateway
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx tsc --noEmit
npm run lint
npm test -- --testPathPattern="events|ai-execution-guards" --runInBand

# container-manager
Set-Location "C:\Users\knlee\aiSandBox2026B\services\container-manager"
npx tsc --noEmit
```

**H3 non-goals:**
- No preview proxy auth implementation
- No full `npm test` suite run (Redis environment constraint)
- No auth endpoint changes
- No frontend changes

---

### AUTH-APP-01H4 — Manual Smoke + Secrets Audit + Final AUTH-APP-01H Consolidation

**Nature:** Validation, documentation, and governance updates only — no production source files changed

**Actions:**

1. **Secrets grep audit:**
   - Grep all tracked source files for known credential patterns (e.g., `sk-ant-`, `sk-`, real `GOOGLE_CLIENT_SECRET` values, `.p8` content patterns)
   - Confirm Apple `.p8` key is not in any tracked file
   - Confirm all OAuth provider values are environment-variable-only
   - Record results in checkpoint

2. **Manual smoke checklist:**
   - F-family: 22-item manual smoke checklist from `docs/AUTH-APP-01F4-CHECKPOINT.md` — run against live environment if available; record NOT RUN with reason if no live environment
   - G-family: 12-item manual smoke checklist from `docs/AUTH-APP-01G4-CHECKPOINT.md` — same disposition
   - Auth-APP-01H-specific smoke items (CSRF token present in browser, rate limiting triggers on login):
     - [ ] After login, `aisandbox_csrf` cookie is present and non-HttpOnly (readable by JS)
     - [ ] POST to `/api/auth/login` without `X-CSRF-Token` header returns 403 (if CSRF fully implemented)
     - [ ] POST to `/api/auth/login` with 11 rapid requests returns 429 on the 11th request
     - [ ] POST to `/api/auth/register` with 6 rapid requests returns 429 on the 6th request
     - [ ] `POST /api/auth/apple/callback` succeeds without `X-CSRF-Token` (CSRF exclusion confirmed)
     - [ ] `POST /api/events/file-changed` without `X-Internal-Service-Key` returns 403

3. **Governance updates:**
   - `docs/AUTH-APP-01H4-CHECKPOINT.md`
   - `docs/AUTH-APP-01H-CHECKPOINT.md` (family summary)
   - `TASKS.md` and `TASKS_BACKLOG_FULL.md` updates for AUTH-APP-01H parent status

---

## 12. Risks and Open Questions

### 12.1 CSRF vs Apple POST callback (CRITICAL)

Apple's OAuth callback is a browser-initiated form POST from Apple's servers to `POST /api/auth/apple/callback`. Apple does not carry the user's browser session cookie during this server-to-server POST. Any CSRF middleware that validates `X-CSRF-Token` on this route will break Apple OAuth completely.

**Resolution:** The CSRF middleware or guard must explicitly exclude `/api/auth/apple/callback` and all other OAuth entry/callback routes. This exclusion must be tested at H2.

### 12.2 `@nestjs/throttler` dependency approval

`@nestjs/throttler` is not currently installed. Per governance rules, new production dependencies require explicit user approval. H2 cannot begin without this approval.

If the user prefers a different rate-limiting approach (e.g., a custom IP-keyed Redis counter using the existing `ioredis` dependency), H2 should use that instead. The spec recommendation is `@nestjs/throttler` with in-memory storage.

### 12.3 In-memory vs Redis-backed throttler

In-memory throttling (default `ThrottlerStorageService`) resets on process restart and does not share state across multiple api-gateway instances. For a single-instance deployment, this is acceptable. For a horizontally-scaled deployment, a Redis-backed throttler is required.

**H2 decision:** Use in-memory throttler. Redis-backed upgrade is a separate future slice.

### 12.4 CSRF implementation location — middleware vs guard

Two valid options for H2:

| Option | Pros | Cons |
|---|---|---|
| NestJS middleware | Runs before routing; simple exclusion logic | Cannot access NestJS DI cleanly |
| Guard added to `SessionCookieGuard` chain | Full DI access; integrated with auth flow | Must be explicitly applied everywhere `SessionCookieGuard` is used |

**Recommendation:** Middleware for the CSRF cookie-setting step (runs on every response); extend `SessionCookieGuard` or a new `CsrfGuard` for the header validation step on protected routes. This separates concerns cleanly.

### 12.5 Redirect allowlist implementation location

The `ALLOWED_POST_OAUTH_REDIRECTS` constant can live in:
- `auth.controller.ts` as a private static — simplest, local to use site
- A separate `auth.constants.ts` — more testable, reusable if other controllers ever need it

**Recommendation:** Private static constant in `auth.controller.ts` for H2 (consistent with `SUPPORTED_LOCALES` already there). Move to a constants file if a second consumer appears.

### 12.6 Preview proxy — product decision pending

The fundamental unresolved question is whether preview URLs are **public/shareable** or **session-owner-only**. This cannot be resolved in AUTH-APP-01H without an explicit product decision. H3 documents the deferral. The actual fix belongs in a later dedicated slice.

**Risk rating:** MEDIUM — the unguarded proxy allows any caller to trigger container-manager preview operations. In a production environment with ENABLE_PREVIEW_ACCESS_CONTROL=false (the default), this is the active state.

### 12.7 `token-updated` unknown caller

No caller was found in container-manager, ai-service, or api-gateway source for `POST /api/events/token-updated`. However, a targeted grep should be run at H3 stage-start before adding the guard to confirm no hidden caller exists (e.g., a future ai-service feature or a dynamically constructed URL). Adding the guard when no caller sends the auth header would be safe (no callers = no breakage).

### 12.8 ESLint config format for ESLint 8

ESLint 8 uses the legacy config format (`.eslintrc.js`, `.eslintrc.json`, etc.) by default. The `eslint.config.js` flat config format is available in ESLint 8 as opt-in but is not the default. The minimal config for H3 should use the legacy format (`.eslintrc.js`) to match the installed ESLint 8 version. This avoids compatibility issues with the existing `@typescript-eslint/eslint-plugin: ^6.x` plugin.

---

## Reference

- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions (CSRF: Section 12.2; rate limiting: Section 7.5; state param: Section 12.3; redirect: Section 12.4; secrets: Section 12.5)
- `docs/AUTH-APP-01F-CHECKPOINT.md` — route/API protection family summary (carry-forwards)
- `docs/AUTH-APP-01G-CHECKPOINT.md` — auth UX integration family summary (manual smoke carry-forward)
- `docs/AUTH-APP-01H1-CHECKPOINT.md` — H1 checkpoint (to be created after spec validation)
- `TASKS.md` → AUTH-APP-01H1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H1
