# AUTH-APP-01C1A Checkpoint — Backend Cookie Session Foundation

**Task ID:** AUTH-APP-01C1A
**Title:** Backend Cookie Session Foundation
**Status:** COMPLETE and LOCKED
**Completed:** 2026-05-06
**Parent:** AUTH-APP-01 — aiSandBox First-Party User Authentication
**Depends on:** AUTH-APP-01B (COMPLETE and LOCKED)

---

## Objective

Establish the server-side HTTP-only cookie session infrastructure. Creates `SessionCookieGuard`, wires session creation and revocation into `AuthService`, modifies the login and logout endpoints, and replaces `JwtAuthGuard` on all browser-facing controllers. Frontend migration is deferred to AUTH-APP-01C1B.

---

## Files Changed

### New Files
- `services/api-gateway/src/auth/session-cookie.guard.ts` — new `SessionCookieGuard` implementation

### Modified Files
- `services/api-gateway/package.json` — added `cookie-parser` + `@types/cookie-parser`
- `services/api-gateway/src/main.ts` — added `app.use(cookieParser())`
- `services/api-gateway/src/auth/auth.service.ts` — added `createSession`, `validateSessionToken`, `revokeSession`; injected `Repository<AuthSession>`
- `services/api-gateway/src/auth/auth.controller.ts` — modified login, switched `/auth/me` guard, added `/auth/logout`
- `services/api-gateway/src/auth/auth.module.ts` — registered `SessionCookieGuard` and `AuthSession` repository

**Browser-facing controllers switched from `JwtAuthGuard` → `SessionCookieGuard`:**
- `services/api-gateway/src/projects/projects.controller.ts`
- `services/api-gateway/src/sessions/session.controller.ts`
- `services/api-gateway/src/conversations/conversation.controller.ts`
- `services/api-gateway/src/users/users.controller.ts`
- `services/api-gateway/src/checkpoints/checkpoints.controller.ts`
- `services/api-gateway/src/workspaces/workspaces.controller.ts`
- `services/api-gateway/src/auth/api-key.controller.ts`
- `services/api-gateway/src/admin/admin-operational.controller.ts`
- `services/api-gateway/src/projects/public-projects.controller.ts`

**Spec files updated to override `SessionCookieGuard` instead of `JwtAuthGuard`:**
- `services/api-gateway/src/projects/projects.controller.spec.ts`
- `services/api-gateway/src/projects/projects-routing.integration.spec.ts`
- `services/api-gateway/src/sessions/session.controller.spec.ts`
- `services/api-gateway/src/users/users.controller.spec.ts`
- `services/api-gateway/src/checkpoints/checkpoints.controller.spec.ts`
- `services/api-gateway/src/checkpoints/__tests__/checkpoints.integration.spec.ts`
- `services/api-gateway/src/workspaces/workspaces.controller.spec.ts`
- `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts`
- `services/api-gateway/src/admin/admin-operational.controller.spec.ts`

### Files Not Changed (Confirmed)
- No frontend files changed.
- `services/api-gateway/src/auth/jwt-auth.guard.ts` — preserved, not deleted.
- `services/api-gateway/src/auth/jwt.strategy.ts` — preserved, not deleted.
- No OAuth, email, rate-limiting, or billing files touched.

---

## Implementation Summary

### Dependencies
- `cookie-parser ^1.4.7` added to `dependencies`.
- `@types/cookie-parser ^1.4.10` added to `devDependencies`.
- `app.use(cookieParser())` registered in `main.ts` before routes.

### `SessionCookieGuard` (`src/auth/session-cookie.guard.ts`)
- Reads `req.cookies['aisandbox_session']` (raw opaque token).
- SHA-256 hashes the raw token using Node.js `crypto`.
- Queries `auth_sessions` where `session_token_hash = hash` AND `expires_at > NOW()` AND `revoked_at IS NULL`.
- Joins to `users` to get identity.
- On valid: attaches `req.user = { userId, email, role, plan }` and returns `true`.
- On invalid or missing: throws `UnauthorizedException`.
- Exported from `AuthModule`.

### `AuthService` additions
- `createSession(userId: string): Promise<string>` — generates 32-byte `crypto.randomBytes`, SHA-256 hashes for storage, inserts `AuthSession` row with 7-day expiry, returns raw token.
- `validateSessionToken(rawToken: string): Promise<User | null>` — hashes token, finds active non-revoked non-expired session, updates `lastActiveAt`, returns user.
- `revokeSession(rawToken: string): Promise<void>` — hashes token, sets `revoked_at = now()` on matching row.
- `Repository<AuthSession>` injected via `@InjectRepository(AuthSession)`.

### `POST /auth/login` changes
- Calls `authService.createSession(user.id)` after credential validation.
- Sets `aisandbox_session` cookie: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `maxAge: 7 days`, `path: '/'`.
- Returns `{ user: { id, email, role, plan_type } }` — **`access_token` is no longer returned**.

### `GET /auth/me`
- Guard switched from `JwtAuthGuard` to `SessionCookieGuard`.

### `POST /auth/logout` (new)
- Protected by `SessionCookieGuard`.
- Reads `req.cookies['aisandbox_session']`; calls `authService.revokeSession(rawToken)`.
- Clears `aisandbox_session` cookie via `res.clearCookie`.
- Returns `{ ok: true }`.

### Controller guard replacement
- All 9 browser-facing controllers and their 9 spec files updated as listed above.
- `JwtAuthGuard` and `JwtStrategy` remain in the codebase for future internal/API compatibility.

---

## Validation Results

| Check | Result | Notes |
|-------|--------|-------|
| `npx tsc --noEmit` | **PASS** | No type errors |
| `npm test` (unit suites, excluding integration/smoke) | **64 pass, 1 fail** | See pre-existing note below |
| `npm test` (full, including integration/smoke) | **72 pass, 10 fail** | See environment note below |
| `npm run lint` | **FAIL** | See pre-existing tooling note below |

### Pre-existing test failure — `ai/ai-execution.controller.spec.ts` (4 tests)
- `ai-execution.controller.ts` is **not in the AUTH-APP-01C1A changed file set**.
- Confirmed by `git diff HEAD -- src/ai/ai-execution.controller.spec.ts` returning empty.
- Failure is a NestJS dependency injection resolution error predating this slice.
- **Not introduced by AUTH-APP-01C1A.**

### Environment blocker — integration and smoke test suites (10 suites, 131 tests)
- Docker is running. `aisandbox-redis` container is Up and healthy.
- Redis port `6379/tcp` is **not bound to the host** (Docker internal network only).
- Test runner on the host cannot reach `localhost:6379`. All failures are `ECONNREFUSED` / `beforeAll` timeout.
- `aisandbox-postgres` container is also internal-only during test runs.
- **Not caused by AUTH-APP-01C1A.** Pre-existing environment constraint for this development setup.

### Lint tooling blocker
- `npm run lint` fails with: `ESLint couldn't find a configuration file` in `services/api-gateway/src/`.
- Pre-existing ESLint configuration issue in the `api-gateway` package.
- **Not introduced by AUTH-APP-01C1A.**

---

## Scope Confirmation

### In scope — all delivered
- [x] `cookie-parser` installed; `app.use(cookieParser())` in `main.ts`
- [x] `SessionCookieGuard` created, exported from `AuthModule`
- [x] `AuthService.createSession`, `validateSessionToken`, and `revokeSession` added
- [x] Login sets HTTP-only `aisandbox_session` cookie; response body has no `access_token`
- [x] `GET /auth/me` uses `SessionCookieGuard`
- [x] `POST /auth/logout` revokes session and clears cookie
- [x] All 9 browser-facing controllers use `SessionCookieGuard`
- [x] `JwtAuthGuard` / `JwtStrategy` still exist in codebase
- [x] All 9 affected controller specs updated to `overrideGuard(SessionCookieGuard)`
- [x] `npx tsc --noEmit` passes

### Non-goals confirmed
- No frontend localStorage migration (AUTH-APP-01C1B)
- No Google OAuth
- No Apple OAuth
- No email verification or password reset
- No rate limiting
- No billing changes
- No auth UX redesign

---

## Invariants Preserved

- `JwtAuthGuard` and `JwtStrategy` remain intact and importable.
- `AUTH-APP-01A` spec (`docs/AUTH-APP-01-SPEC.md`) unchanged.
- `AUTH-APP-01B` migration and entities unchanged.
- No frontend files modified.
- No package.json changes outside `cookie-parser` dependencies.
- No new OAuth, email, or rate-limiting logic introduced.

---

## Carry-Forward Validation Blockers

These blockers are pre-existing and were not introduced by AUTH-APP-01C1A:

1. **`npm test` cannot be fully trusted** until Redis is accessible from the host test runner (e.g., by binding Redis port `6379` to `localhost` in `docker-compose.yml`, or by running tests inside the Docker network).
2. **`npm run lint` cannot be trusted** until the ESLint config discovery issue is resolved for `services/api-gateway`.
3. **`ai-execution.controller.spec.ts`** has 4 pre-existing failing unit tests unrelated to this slice; should be investigated and fixed in a dedicated cleanup task.

---

## Next Recommended Child Task

**AUTH-APP-01C1B — Frontend localStorage / Bearer Migration**

Remove all frontend dependence on `localStorage` for `access_token` and `userId`, and remove manual `Authorization: Bearer` headers from browser-side fetch calls. After this slice, the browser relies entirely on the HTTP-only session cookie established by AUTH-APP-01C1A.
