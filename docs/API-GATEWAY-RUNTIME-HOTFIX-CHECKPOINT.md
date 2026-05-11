# API Gateway Runtime Hotfix Checkpoint

## Metadata

| Field | Value |
|---|---|
| Date | 2026-05-10 |
| Service | api-gateway |
| Nature | Emergency startup/runtime hotfix — no new feature work |
| Trigger | api-gateway container restarting immediately after recent auth/email/preview work |
| Final state | `aisandbox-api-gateway` Up (healthy), RestartCount=0 |

---

## Problem Summary

After the AUTH-APP-01C2 (email auth) and AUTH-APP-02 (preview proxy hardening) work, the
`aisandbox-api-gateway` Docker container entered a restart loop. Three distinct startup
blockers were identified and resolved in sequence. The errors had no dependency on each
other; each was exposed only after the prior one was resolved.

---

## Blocker 1 — Missing Docker Runtime Env for Email Auth

### Root Cause

`EmailModule.emailProviderFactory` calls `assertRequiredEnv('APP_BASE_URL')` at module
initialization. The local `.env` at the root had `APP_BASE_URL` and `EMAIL_PROVIDER`
defined, but the `api-gateway` service in `docker-compose.prod.yml` did not explicitly
pass these into the container's runtime environment.

`api-gateway` in `docker-compose.prod.yml` uses `env_file: ./.env` (to load the file) AND
an explicit `environment:` block. Docker Compose merges them, but only keys explicitly
listed in `environment:` are reliably surfaced as named overrides. Since `EMAIL_PROVIDER`
and `APP_BASE_URL` were present in `.env` but absent from the `environment:` block, the
factory did not receive them.

### Error observed

```
ERROR [ExceptionHandler] APP_BASE_URL is required for email auth
Error: APP_BASE_URL is required for email auth
    at assertRequiredEnv (.../email/email.module.js)
```

### Fix applied

Added two entries to `api-gateway.environment` in `docker-compose.prod.yml`, with safe
defaults for local/dev:

```yaml
EMAIL_PROVIDER: ${EMAIL_PROVIDER:-stub}
APP_BASE_URL: ${APP_BASE_URL:-http://localhost:3000}
```

The `:-` syntax ensures `stub` and `http://localhost:3000` are used as defaults if the
variable is not defined in `.env`. When `.env` defines the real values (e.g. production
Resend config), those take precedence.

### File changed

- `docker-compose.prod.yml` — `api-gateway.environment` block

---

## Blocker 2 — AppleStrategy Constructing Without Required Env

### Root Cause

`AppleStrategy` called `super(...)` with `||` fallback strings for every required Apple
OAuth env var (e.g. `'missing-apple-client-id'`). The `key` option received an empty
string when `APPLE_PRIVATE_KEY` was unset. The `@nicokaiser/passport-apple` library
validates the `key` option at construction time and throws:

```
AppleStrategy requires a key option
```

This crashed the NestJS `InstanceLoader` before the application could bootstrap.

### Error observed

```
ERROR [ExceptionHandler] AppleStrategy requires a key option
TypeError: AppleStrategy requires a key option
    at new AppleStrategy (.../passport-apple/lib/strategy.js:59:33)
```

### Fix applied

1. `apple.strategy.ts`:
   - Replaced all `||` fallback placeholders with `getRequiredAppleEnv()`, which throws a
     clear message (`Apple OAuth disabled: missing Apple env configuration`) instead of
     passing empty/placeholder values to the library.
   - Exported `hasAppleOAuthConfig()` — returns `true` only when all five required Apple
     env vars are non-empty (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
     `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`).

2. `auth.module.ts`:
   - Changed `AppleStrategy` from a direct class provider to a factory provider
     (`appleStrategyProvider`).
   - Factory calls `hasAppleOAuthConfig()` first. If Apple env is incomplete, it logs a
     warning and returns `null` — no Apple strategy is registered.
   - If Apple env is complete, the factory constructs and returns `new AppleStrategy(...)` as before.

3. `auth.controller.ts`:
   - Added `isPassportStrategyRegistered('apple')` check at the start of `appleAuth` and
     `appleCallback` route handlers.
   - When Apple strategy is not registered, routes redirect to `/login?error=oauth_failed`
     instead of throwing or forwarding to an unregistered Passport strategy.

### Warning now logged (when Apple env missing)

```
WARN [AuthModule] Apple OAuth disabled: missing Apple env configuration
```

### Files changed

- `services/api-gateway/src/auth/apple.strategy.ts`
- `services/api-gateway/src/auth/auth.module.ts`
- `services/api-gateway/src/auth/auth.controller.ts`
- `services/api-gateway/src/auth/__tests__/apple.strategy.spec.ts` (tests extended)
- `services/api-gateway/src/auth/__tests__/auth.controller.apple.spec.ts` (new)
- `services/api-gateway/src/auth/__tests__/auth.module.apple.spec.ts` (new)

---

## Blocker 3 — SessionCookieGuard DI Resolution Failure

### Root Cause

`SessionCookieGuard` injects `AuthService` in its constructor. NestJS resolves guard
dependencies within the module context where the guard is registered. When a controller
in a feature module uses `@UseGuards(SessionCookieGuard)`, NestJS attempts to resolve
`SessionCookieGuard` (and therefore `AuthService`) within that feature module's DI context.

Feature modules whose controllers use `SessionCookieGuard` did not import `AuthModule`,
so `AuthService` was unavailable in those DI contexts. `AuthModule` already exported
`SessionCookieGuard`, so the fix was to import `AuthModule` into each affected feature
module — no duplication of `AuthService`.

### Error observed

```
ERROR [ExceptionHandler] Nest can't resolve dependencies of the SessionCookieGuard (?).
Please make sure that the argument AuthService at index [0] is available in the
WorkspacesModule context.
```

### Feature modules that required the fix

| Module file | Controller(s) using SessionCookieGuard |
|---|---|
| `workspaces/workspaces.module.ts` | `WorkspacesController` |
| `projects/projects.module.ts` | `ProjectsController`, `PublicProjectsController` |
| `users/users.module.ts` | `UsersController` |
| `checkpoints/checkpoints.module.ts` | `CheckpointsController` |
| `sessions/session.module.ts` | `SessionController` |
| `conversations/conversation.module.ts` | `ConversationController` |
| `admin/admin.module.ts` | `AdminOperationalController` |
| `preview/preview.module.ts` | `PreviewController` |

### Fix applied

Added `AuthModule` to the `imports` array of each affected feature module. No `AuthService`
duplication; `AuthModule` re-exports `SessionCookieGuard`, which re-exposes `AuthService`
to the module's DI context transitively through the import.

### Files changed

- `services/api-gateway/src/workspaces/workspaces.module.ts`
- `services/api-gateway/src/projects/projects.module.ts`
- `services/api-gateway/src/users/users.module.ts`
- `services/api-gateway/src/checkpoints/checkpoints.module.ts`
- `services/api-gateway/src/sessions/session.module.ts`
- `services/api-gateway/src/conversations/conversation.module.ts`
- `services/api-gateway/src/admin/admin.module.ts`
- `services/api-gateway/src/preview/preview.module.ts`

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `services/api-gateway` | **PASS** |
| `npx jest --testPathPatterns="apple.strategy\|auth.module\|auth" --runInBand` | `services/api-gateway` | **PASS** — 14 suites, 104 tests |
| `npx jest --testPathPatterns="auth\|workspace\|preview" --runInBand` | `services/api-gateway` | **PASS** — 21 suites, 155 tests |
| Lint on all touched files | `services/api-gateway` | **PASS** |
| `docker compose -f docker-compose.prod.yml up -d --build --force-recreate api-gateway` | repo root | **PASS** |

### Final Docker state

```
NAMES                   STATUS          PORTS
aisandbox-api-gateway   Up (healthy)    0.0.0.0:4000->4000/tcp
```

```
Status=running  Restarting=false  RestartCount=0  Health=healthy  ExitCode=0
```

Final log lines confirm clean startup:
```
Nest application successfully started
API Gateway started!
Listening on: http://localhost:4000
```

---

## Safety Notes

- **No secrets were added.** No real Apple private key, no real Resend API key, no
  production credentials of any kind were added to any file.
- **No fake Apple private key was added** to compose, env files, or source code.
- **Google OAuth uses same graceful-disable pattern as Apple.** `GoogleStrategy` is now conditionally registered — disabled with a safe warning when env vars are missing, operational when all three required env vars are present.
- **Apple OAuth is disabled only when Apple env vars are missing.** When all five required
  Apple env vars (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`,
  `APPLE_CALLBACK_URL`) are present in the environment, `AppleStrategy` is constructed and
  registered normally — production behavior is preserved.
- **No frontend files were changed.**
- **No container-manager files were changed.**
- **No DB migrations were added.**
- **No new external dependencies were added.**
- **`AuthService` was not duplicated** in any feature module.
- **`SessionCookieGuard` behavior is unchanged.** Only module wiring was corrected.

---

## All Files Changed in This Hotfix

| File | Category | Change |
|---|---|---|
| `docker-compose.prod.yml` | Runtime config | Added `EMAIL_PROVIDER` and `APP_BASE_URL` to `api-gateway.environment` |
| `src/auth/apple.strategy.ts` | Backend | Guard env check; `hasAppleOAuthConfig()` export; fail-fast constructor |
| `src/auth/auth.module.ts` | Backend | Apple strategy factory provider; conditional registration |
| `src/auth/auth.controller.ts` | Backend | Apple route fallback when strategy not registered |
| `src/auth/__tests__/apple.strategy.spec.ts` | Test | Extended with env-missing and env-present guard tests |
| `src/auth/__tests__/auth.controller.apple.spec.ts` | Test | New — Apple route fallback tests |
| `src/auth/__tests__/auth.module.apple.spec.ts` | Test | New — factory provider registration tests |
| `src/auth/google.strategy.ts` | Backend | `hasGoogleOAuthConfig()` export; fail-fast constructor; removed placeholder fallbacks |
| `src/auth/__tests__/google.strategy.spec.ts` | Test | Extended — `hasGoogleOAuthConfig()` and constructor tests |
| `src/auth/__tests__/auth.controller.google.spec.ts` | Test | New — Google route fallback tests |
| `src/auth/__tests__/auth.module.google.spec.ts` | Test | New — `googleStrategyProvider` factory tests |
| `src/workspaces/workspaces.module.ts` | Backend | `AuthModule` import added |
| `src/projects/projects.module.ts` | Backend | `AuthModule` import added |
| `src/users/users.module.ts` | Backend | `AuthModule` import added |
| `src/checkpoints/checkpoints.module.ts` | Backend | `AuthModule` import added |
| `src/sessions/session.module.ts` | Backend | `AuthModule` import added |
| `src/conversations/conversation.module.ts` | Backend | `AuthModule` import added |
| `src/admin/admin.module.ts` | Backend | `AuthModule` import added |
| `src/preview/preview.module.ts` | Backend | `AuthModule` import added |

---

## Follow-up: Google OAuth 500 Graceful Degradation Fix

**Date:** 2026-05-11

### Problem

During manual testing after the original three-blocker hotfix, Google sign-in returned:

```json
{"statusCode":500,"message":"Internal server error"}
```

The container itself was healthy and not restarting; this was a per-request runtime error, not a startup crash.

### Root Causes

Three distinct issues combined to produce the 500:

**1. CJS/ESM interop — `import * as passport`**

`auth.controller.ts` imported passport as:

```typescript
import * as passport from 'passport';
```

With `esModuleInterop: true`, TypeScript compiles this to `__importStar(require("passport"))`, which wraps the passport CJS module in a namespace object. The real passport instance (with `authenticate`, `_strategy`) ended up under `.default` in the compiled output. At runtime, `passport.authenticate` and `passport._strategy` were `undefined` — calling them threw immediately.

**2. `isPassportStrategyRegistered` called without `this` context**

The helper extracted passport's `_strategy` method into a local variable and called it standalone:

```typescript
const strategyGetter = passport._strategy;  // extracts method
return ... Boolean(strategyGetter(name));     // calls without 'this'
```

Inside passport's `_strategy`, it accesses `this._strategies`. Called without context, `this` was `undefined`, producing: `Cannot read properties of undefined (reading 'google')`.

**3. Google OAuth env vars absent — missing graceful-disable**

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` were absent from both the root `.env` and `docker-compose.prod.yml`. Unlike Apple (which had already been given conditional registration), `GoogleStrategy` used `||` fallback placeholder strings. After fixing issues 1 and 2, the strategy would have attempted to redirect to Google with invalid credentials rather than failing gracefully.

### Fix Applied

**`auth.controller.ts`:**
- Changed `import * as passport from 'passport'` → `import passport from 'passport'` — compiles to `__importDefault(require("passport"))`, which correctly exposes the passport instance directly.
- Changed `isPassportStrategyRegistered` to call `instance._strategy(name)` on the passport object directly (preserving `this` context) rather than extracting the method into a variable.
- Added `isPassportStrategyRegistered('google')` guard at the start of both `googleAuth` and `googleCallback` route handlers — mirrors the Apple pattern.

**`google.strategy.ts`:**
- Added exported `hasGoogleOAuthConfig()` — returns `true` only when all three required Google env vars are non-empty (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`).
- Added `getRequiredGoogleEnv()` helper — throws `'Google OAuth disabled: missing Google env configuration'` if any required var is absent.
- Constructor now calls `getRequiredGoogleEnv()` for all three vars instead of using `||` placeholder strings.

**`auth.module.ts`:**
- Added `googleStrategyProvider` factory (mirrors `appleStrategyProvider`) — calls `hasGoogleOAuthConfig()` at instantiation time; returns `null` with a logged warning when env is incomplete; constructs `new GoogleStrategy(...)` when env is present.
- Replaced direct `GoogleStrategy` class provider with `googleStrategyProvider`.

### Warning Logged When Google Env Missing

```
WARN [AuthModule] Google OAuth disabled: missing Google env configuration
```

### Files Changed

| File | Change |
|---|---|
| `services/api-gateway/src/auth/auth.controller.ts` | Fixed passport import; fixed `isPassportStrategyRegistered` context; added Google route guards |
| `services/api-gateway/src/auth/google.strategy.ts` | Added `hasGoogleOAuthConfig()`; fail-fast constructor; removed placeholder fallbacks |
| `services/api-gateway/src/auth/auth.module.ts` | Added `googleStrategyProvider` factory; conditional Google strategy registration |
| `services/api-gateway/src/auth/__tests__/google.strategy.spec.ts` | Extended: 5 tests for `hasGoogleOAuthConfig()`, constructor fail-fast, and constructor success |
| `services/api-gateway/src/auth/__tests__/auth.controller.apple.spec.ts` | Updated passport mock to match default import pattern |
| `services/api-gateway/src/auth/__tests__/auth.controller.google.spec.ts` | New — 3 tests for Google route graceful fallback when strategy not registered |
| `services/api-gateway/src/auth/__tests__/auth.module.google.spec.ts` | New — 2 tests for `googleStrategyProvider` factory (missing env → null + warning; present env → strategy) |

### Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `services/api-gateway` | **PASS** |
| `npx jest --testPathPatterns="auth" --runInBand` | `services/api-gateway` | **PASS** — 16 suites, 117 tests |
| Lint on all touched files | `services/api-gateway` | **PASS** |
| `docker compose -f docker-compose.prod.yml up -d --build --force-recreate api-gateway` | repo root | **PASS** |
| `GET /api/auth/google` (container internal) | — | **302** → `/en/login?error=oauth_failed` (was 500) |

### Safety Notes

- No secrets or fake secrets were added.
- No real Google OAuth credentials were added to any file.
- No placeholder/fake credentials were used.
- Apple behavior is unchanged.
- No frontend files were changed.
- No container-manager files were changed.

### Current Behavior (Google Env Missing)

- Startup: `WARN [AuthModule] Google OAuth disabled: missing Google env configuration`
- `GET /api/auth/google`: `302 /en/login?error=oauth_failed`
- `GET /api/auth/google/callback`: `302 /en/login?error=oauth_failed`
- No 500; no crash.

### Production Behavior (Google Env Present)

When `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` are all set in the environment, `GoogleStrategy` is constructed and registered normally. The `/api/auth/google` and `/api/auth/google/callback` routes operate as before.

---

## Carry-Forwards

| Item | Detail | Next action |
|---|---|---|
| Google OAuth production config | Real `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` must be set in production `.env` and passed through `docker-compose.prod.yml` before Google OAuth is enabled | User/operator action before enabling Google sign-in |
| Apple OAuth production config | Real `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL` must be set in production `.env` and passed through `docker-compose.prod.yml` before Apple OAuth is enabled | User/operator action before enabling Apple sign-in |
| Email production config | Real `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `APP_BASE_URL` (production domain), `AUTH_EMAIL_REPLY_TO` must be configured and a verified sender/domain set up in Resend | User/operator action before production email |
| AUTH-APP-02 manual smoke | 4-item live environment smoke checklist deferred — requires Docker, PostgreSQL, Redis, running api-gateway and container-manager | User action |
| AUTH-APP-01C2 manual smoke | Email auth live environment smoke checklist deferred | User action |
| `x-forwarded-for` privacy decision | Whether to strip client IP from headers forwarded to container-manager — deferred per AUTH-APP-02D | Separate deferred decision |

---

## Reference

- `docs/AUTH-APP-02-CHECKPOINT.md` — preview proxy security family checkpoint
- `docs/AUTH-APP-02D-CHECKPOINT.md` — header sanitization checkpoint
- `docs/AUTH-APP-02C-CHECKPOINT.md` — ownership guard checkpoint
- `TASKS.md` → AUTH-APP-02D (COMPLETE and LOCKED)
- `TASKS.md` → AUTH-APP-02 (VALIDATION COMPLETE — manual smoke deferred)
