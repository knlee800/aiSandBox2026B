# OPS-LOCAL-AUTH-JWT ¡X Checkpoint

**Task:** OPS-LOCAL-AUTH-JWT
**Family:** OPS-LOCAL ¡X Local Testing Config
**Status:** COMPLETE AND LOCKED
**Date:** 2026-05-11

---

## Objective (as stated in TASKS_BACKLOG_FULL)

Override `JWT_EXPIRES_IN` for the local Docker `api-gateway` service to `30d` so local QA is not interrupted by frequent forced re-login. The task was created because browser auth issued a 15-minute JWT stored in `localStorage` with no refresh mechanism; a 401 response immediately wiped frontend state and redirected to `/login`.

---

## Why No Implementation Was Needed

The task objective is **pre-satisfied** for two independent reasons:

### Reason 1 ¡X Auth architecture replaced by AUTH-APP-02

The browser auth flow was migrated from JWT/localStorage to DB-backed cookie sessions as part of AUTH-APP-02. The current architecture:

- `AuthService.createSession()` generates a 32-byte random opaque token, stores its SHA-256 hash in the `auth_sessions` DB table, and returns the raw token.
- `SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000` (7 days, hardcoded constant in `auth.service.ts`).
- `AuthController.setSessionCookie()` sets an `aisandbox_session` httpOnly cookie with `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days).
- `SessionCookieGuard` reads the cookie, hashes the token, and validates it against the `auth_sessions` DB table (`expiresAt > now`, `revokedAt IS NULL`).
- `AuthService.login()` returns `{ sessionToken, user }` ¡X no JWT, no `access_token` field.
- Google OAuth and Apple OAuth callbacks also call `createSession()` and set the same cookie.
- `AuthService` does not inject or call `JwtService` anywhere. No JWT is issued to the browser.

The 15-minute forced-logout problem no longer exists. Browser sessions expire after 7 days.

### Reason 2 ¡X JWT_EXPIRES_IN already set in docker-compose.prod.yml

Even if the JWT flow were still active, the stated fix was already applied. The `api-gateway` environment block in `docker-compose.prod.yml` already contains:

```yaml
JWT_EXPIRES_IN: "30d"
```

This value was present before the OPS-LOCAL task family began.

### What JWT_EXPIRES_IN actually controls (current scope)

`JwtModule.register({ signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } })` in `auth.module.ts` configures JWT signing options. `JwtStrategy` validates Bearer tokens from `Authorization` headers. Neither of these code paths is exercised by normal browser auth. `JWT_EXPIRES_IN` currently has no practical effect on local QA session duration.

---

## Validation Results

| Check | Command | Result |
|---|---|---|
| docker compose config | `docker compose -f docker-compose.prod.yml config --quiet` | **PASS** ¡X exit 0 |
| TypeScript | `npx tsc --noEmit` (api-gateway) | **PASS** ¡X 0 errors |
| Auth tests | `npx jest --testPathPatterns="auth" --runInBand --no-coverage` | **PASS ¡X 117/117 tests, 16 suites** |

`docker compose config` rendered config confirms:
- `JWT_EXPIRES_IN: 30d` (api-gateway explicit env override)
- `MAX_ACTIVE_SESSIONS_PER_USER: 1000000` (from OPS-LOCAL-SESSION-LIMITS)
- `MAX_SESSIONS_PER_24H: 1000000` (from OPS-LOCAL-SESSION-LIMITS)

---

## Non-Goals Confirmed

- No refresh-token system implemented
- No `/auth/refresh` endpoint added
- No frontend silent-refresh or axios interceptor added
- No production policy change
- No auth architecture modification
- No extension of the hardcoded 7-day cookie session TTL (would require a code change; not in scope)

---

## Risk Note

If future work reintroduces browser JWT issuance (e.g., returning to `jwtService.sign()` in `AuthService.login()`), the presence of `JWT_EXPIRES_IN: "30d"` in `docker-compose.prod.yml` must be revisited. A 30-day access token would be an insecure default for production. Any such future task must explicitly address the docker-compose value or introduce a separate production env file.

---

## Files Changed

None. This task required no implementation.

## Files Confirmed Unchanged

| File | Status |
|---|---|
| `services/api-gateway/src/auth/*` | Untouched |
| `services/api-gateway/src/quota/*` | Untouched |
| `docker-compose.prod.yml` | Untouched (JWT_EXPIRES_IN was already present) |
| All test files | Untouched |

---

## OPS-LOCAL Family Completion

OPS-LOCAL-AUTH-JWT is the final task in the OPS-LOCAL family. With this closure, the OPS-LOCAL family is **COMPLETE**.
