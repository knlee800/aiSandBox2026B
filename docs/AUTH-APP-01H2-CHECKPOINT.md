# AUTH-APP-01H2 Checkpoint — CSRF + Rate Limiting + Redirect Hardening

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01H2 |
| Title | CSRF + Rate Limiting + Redirect Hardening |
| Family | AUTH |
| Parent | AUTH-APP-01H (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND + FRONTEND IMPLEMENTATION |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01H1 (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` |

---

## Objective

Implement CSRF protection (double-submit cookie pattern), auth endpoint rate limiting (in-memory, `@nestjs/throttler`), OAuth redirect allowlist hardening, and `api-gateway/.env.example` documentation for all missing auth/session/OAuth secrets.

---

## Dependency Added

| Package | Version | Storage | Approval |
|---|---|---|---|
| `@nestjs/throttler` | `^6.5.0` | In-memory only | Explicitly approved before implementation |

---

## Files Changed

| File | Change |
|---|---|
| `services/api-gateway/package.json` | Added `@nestjs/throttler@^6.5.0` to `dependencies` |
| `services/api-gateway/src/main.ts` | Added CSRF cookie-setting middleware after `cookieParser()` |
| `services/api-gateway/src/app.module.ts` | Registered `ThrottlerModule.forRoot(...)` |
| `services/api-gateway/src/auth/auth.controller.ts` | Added `@Throttle`/`ThrottlerGuard` on login/register; added `CsrfGuard` on logout; added redirect allowlist |
| `services/api-gateway/src/auth/csrf.guard.ts` | **Created** — double-submit CSRF header validation guard |
| `services/api-gateway/src/auth/__tests__/csrf.guard.spec.ts` | **Created** — 5 unit tests for `CsrfGuard` |
| `services/api-gateway/.env.example` | Added all missing auth/session/OAuth env var placeholders |
| `frontend/app/[locale]/app/page.tsx` | Updated `handleLogout` to send `X-CSRF-Token` header from cookie |
| `frontend/components/auth/logout-button.tsx` | Updated `handleLogout` to send `X-CSRF-Token` header from cookie |

**No `services/api-gateway/package-lock.json` was created or changed** (workspace-level `node_modules` used).

**Production source files changed: 7 (backend: 5, frontend: 2)**
**New files created: 2 (`csrf.guard.ts`, `csrf.guard.spec.ts`)**

---

## CSRF Middleware Summary

**Location:** `services/api-gateway/src/main.ts`

Registered as a functional Express middleware after `cookieParser()`. On every incoming request, if the `aisandbox_csrf` cookie is absent, generates a 32-byte cryptographically random token via `crypto.randomBytes(32).toString('hex')` and sets it in the response.

**Cookie attributes for `aisandbox_csrf`:**
```
httpOnly: false       — frontend JavaScript must be able to read this
sameSite: 'lax'
path: '/'
secure: true in production, false in development
```

The cookie is set only if absent. Existing `aisandbox_csrf` cookies are not overwritten.

---

## CsrfGuard Summary

**Location:** `services/api-gateway/src/auth/csrf.guard.ts`

Dependency-free `@Injectable()` guard implementing `CanActivate`. Reads:
- `req.cookies.aisandbox_csrf` — the CSRF cookie value
- `req.headers['x-csrf-token']` — the request header value (array-safe: uses first element if array)

Throws `ForbiddenException('Invalid CSRF token')` if any of:
- CSRF cookie is missing or empty
- `X-CSRF-Token` header is missing or empty
- Cookie and header values do not strictly match

Returns `true` on match.

**Applied only to `POST /auth/logout`** via `@UseGuards(SessionCookieGuard, CsrfGuard)`.

**Explicitly NOT applied to:**
- `POST /auth/login` — public entry point, no session yet
- `POST /auth/register` — public entry point, no session yet
- `POST /auth/apple/callback` — Apple server-to-server POST; does not carry browser cookies (CRITICAL exclusion)
- `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/apple` — GET routes
- `GET /auth/me` — GET route, not mutating

---

## Frontend Logout CSRF Header Summary

**Files:** `frontend/app/[locale]/app/page.tsx`, `frontend/components/auth/logout-button.tsx`

Both logout callers were updated with a module-local helper function `getCsrfTokenFromCookie()` that reads `document.cookie`, finds the `aisandbox_csrf=` entry, and returns the token value or `null`.

The `X-CSRF-Token` header is sent when the token is present:
```ts
headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
```

If the CSRF token is missing (e.g. first load before cookie is set), the logout `fetch` call is still attempted and the UX redirect/state clear proceeds as before. The client logout experience is never blocked by a missing CSRF token.

No `localStorage` access, no manual cookie clearing, and no shared utility was created across the two components.

---

## Rate Limiting Summary

**ThrottlerModule registration in `services/api-gateway/src/app.module.ts`:**
```ts
ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 10 }])
```

**Per-route throttle decorators in `auth.controller.ts`** (exact API syntax for `@nestjs/throttler@6.5.0`):

| Route | Decorator | Effective limit |
|---|---|---|
| `POST /auth/login` | `@Throttle({ default: { limit: 10, ttl: 60000 } })` | 10 req / 60 s / IP |
| `POST /auth/register` | `@Throttle({ default: { limit: 5, ttl: 60000 } })` | 5 req / 60 s / IP |

`ThrottlerGuard` is applied **per-route only** via `@UseGuards(ThrottlerGuard)` on the two routes above. It is **not** registered as a global `APP_GUARD` — this avoids applying throttling to `/api/internal/*`, OAuth callbacks, health endpoints, and all other app routes.

Storage: **in-memory only** (`ThrottlerStorageService`, the default). State resets on process restart. Not shared across multiple api-gateway instances. Redis-backed throttling is a separate future slice.

Exceeding a limit returns HTTP 429 via `ThrottlerException` (extends `HttpException`).

---

## Redirect Allowlist Summary

**Location:** `services/api-gateway/src/auth/auth.controller.ts`

Added a formal private static constant alongside the existing `SUPPORTED_LOCALES`:
```ts
private static readonly ALLOWED_POST_OAUTH_REDIRECTS = new Set(['/app', '/login']);
```

Added private method `buildOAuthRedirectPath(locale, path, errorCode?)` that validates the path segment against `ALLOWED_POST_OAUTH_REDIRECTS` before constructing the redirect URL. Any path not in the set falls back to `/login`.

All four OAuth redirect call sites in `googleCallback` and `appleCallback` now go through `buildOAuthRedirectPath`. Observable behavior is unchanged — the same paths are used. The allowlist is a structural regression guard against future open redirect risk if a `?redirect=` parameter is ever added to the OAuth flow.

---

## Env Documentation Summary

**File:** `services/api-gateway/.env.example`

Added placeholders and comments for all previously undocumented auth/session/OAuth variables:

| Variable | Section | Notes |
|---|---|---|
| `JWT_SECRET` | Auth/session secrets | Required in production; last-resort OAuth state signing fallback |
| `SESSION_SECRET` | Auth/session secrets | Required in production; OAuth state signing fallback |
| `OAUTH_STATE_SECRET` | Auth/session secrets | Required in production; preferred OAuth state signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth | Required when Google sign-in is enabled |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Required when Google sign-in is enabled |
| `GOOGLE_CALLBACK_URL` | Google OAuth | Required when Google sign-in is enabled |
| `APPLE_CLIENT_ID` | Apple OAuth | Apple Services ID — not the Bundle ID |
| `APPLE_TEAM_ID` | Apple OAuth | Required when Apple sign-in is enabled |
| `APPLE_KEY_ID` | Apple OAuth | Required when Apple sign-in is enabled |
| `APPLE_PRIVATE_KEY` | Apple OAuth | `.p8` PEM content with newlines as `\n`; must never be committed with real value |
| `APPLE_CALLBACK_URL` | Apple OAuth | Required when Apple sign-in is enabled |

No real secrets are present. All values are clearly labelled placeholders.

---

## Tests Added / Updated

**New file: `services/api-gateway/src/auth/__tests__/csrf.guard.spec.ts`**

5 unit tests — no DB, no network, no NestJS bootstrap required:

| Test | Result |
|---|---|
| Returns `true` when cookie and header match | PASS |
| Throws `ForbiddenException` when cookie is missing | PASS |
| Throws `ForbiddenException` when header is missing | PASS |
| Throws `ForbiddenException` when cookie and header do not match | PASS |
| Throws `ForbiddenException` when header is empty string | PASS |

No existing tests were modified.

---

## Validation Commands and Results

**Backend TypeScript:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```
Result: **PASS** (exit 0, no errors)

**Backend CSRF guard tests:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPatterns="csrf.guard" --runInBand
```
Result: **PASS** — 5/5 tests passed

**Follow-up env-doc TypeScript (re-run after `.env.example` update):**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit
```
Result: **PASS** (exit 0, no errors)

**Frontend build:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build
```
Result: **PASS** — all routes compiled successfully

**Frontend TypeScript:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npx tsc --noEmit
```
Result: **PASS** (exit 0, no errors)

**Frontend tests:**
```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\frontend"; npm test
```
Result: **PASS** — 256/256 tests passed

**Edited-file lints:**
Result: **PASS** — no linter errors found on any changed file

**`frontend/tsconfig.tsbuildinfo` restore:**
Modified by `npm run build` / `npx tsc --noEmit` validation; restored with:
```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```
Result: **Restored**

---

## Non-Goals Confirmed

- No CSRF enforcement on `POST /auth/apple/callback` — explicitly excluded
- No CSRF enforcement on `POST /auth/login` or `POST /auth/register`
- No CSRF enforcement across other session-protected controllers (sessions, conversations, checkpoints, etc.)
- No Redis-backed throttling — in-memory only
- No password reset / email verification rate limits (AUTH-APP-01C2 remains BLOCKED)
- No OAuth strategy changes
- No frontend redesign
- No container-manager changes
- No AUTH-APP-01C2 work

---

## Risks and Invariants Preserved

| Item | Status |
|---|---|
| Apple `POST /api/auth/apple/callback` excluded from CSRF — Apple server POST carries no browser cookies | Confirmed — guard not applied to this route |
| `InternalServiceAuthGuard` global `APP_GUARD` unaffected — `ThrottlerGuard` not registered globally | Confirmed |
| Existing session cookie (`aisandbox_session`) behavior unchanged | Confirmed |
| OAuth state parameter mechanism unchanged (`state: true` in both strategies) | Confirmed |
| Redirect behavior observable to users unchanged — same target paths | Confirmed |
| In-memory throttler resets on restart; single-instance limitation documented | Accepted for H2 |
| `@nestjs/throttler@6.5.0` decorator API: `@Throttle({ default: { limit, ttl } })` (v5+ object syntax) | Confirmed against installed types |

---

## Reference

- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` — governing spec (H2 scope: Section 11)
- `docs/AUTH-APP-01H1-CHECKPOINT.md` — H1 inventory checkpoint
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `TASKS.md` → AUTH-APP-01H2
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H2

---

## Next Recommended Task

**AUTH-APP-01H3 — Events Endpoint Guards + Test/Tooling Triage (PLANNED)**

Scope (per spec Section 11):
- Add `notifyFileChanged()` and `notifyCheckpointCreated()` to `ApiGatewayHttpClient` (container-manager)
- Update `files.service.ts` to use `ApiGatewayHttpClient` for the events call
- Update `git.service.ts` to replace raw `httpService.post` with `apiGatewayClient` method
- Add `@UseGuards(InternalServiceAuthGuard)` class-level to `EventsController`
- Confirm `token-updated` has no hidden caller before guarding (targeted grep at stage-start)
- Add minimal `.eslintrc.js` to `services/api-gateway`
- Add `QuotaService` mock provider to `ai-execution-guards.integration.spec.ts`
- Formally record preview proxy deferral in H3 checkpoint
