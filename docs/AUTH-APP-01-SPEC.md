# AUTH-APP-01 Implementation Spec — aiSandBox First-Party Authentication

**Date:** 2026-05-06
**Status:** APPROVED — gates AUTH-APP-01B through AUTH-APP-01Z implementation
**Task:** AUTH-APP-01A — Auth Architecture & Implementation Spec
**Scope:** aiSandBox platform authentication only. AUTH-MODULE-01 (generated app-auth for user-created apps) is a separate, later family.

---

## 1. Auth Stack Decision

### Decision: Extend the existing NestJS + Passport + JWT backend. Auth.js / NextAuth is NOT selected.

**Rationale:**

The API Gateway is a full NestJS backend. Auth.js is a Next.js framework-level auth solution. Using Auth.js would create two parallel auth systems:

- Auth.js would manage sessions server-side in the Next.js runtime
- The NestJS API Gateway already manages auth, issues JWTs, and guards resources

Running these in parallel would produce conflicting session models, duplicate user lookup paths, and irreconcilable token formats. Auth.js is not appropriate for this architecture.

**Existing auth capabilities confirmed in repo:**

| Component | Location | Status |
|---|---|---|
| `AuthService` — email+password validate/login/register | `src/auth/auth.service.ts` | Exists |
| `AuthController` — POST /auth/login, POST /auth/register, GET /auth/me | `src/auth/auth.controller.ts` | Exists |
| `JwtStrategy` — Bearer token extraction, 15-minute expiry | `src/auth/jwt.strategy.ts` | Exists |
| `JwtAuthGuard` — Passport JWT guard | `src/auth/jwt-auth.guard.ts` | Exists |
| `AuthorizationGuard` — API key scope-based authorization | `src/auth/authorization.guard.ts` | Exists |
| `ApiKeyAuthGuard` / `ApiKeyService` | `src/auth/` | Exists |
| `LoginDto` / `RegisterDto` (email + password ≥ 6 chars) | `src/auth/dto/auth.dto.ts` | Exists |
| `User` entity with `authProvider`, `oauthId`, `passwordHash` (nullable) | `src/entities/user.entity.ts` | Exists |
| `bcrypt`, `passport`, `passport-jwt`, `passport-local`, `@nestjs/jwt`, `@nestjs/passport` | `package.json` | Installed |

**Missing capabilities that AUTH-APP-01 must add:**

- Google OAuth handler (passport-google-oauth20)
- Apple OAuth handler (passport-apple or equivalent)
- Email verification flow
- Password reset flow
- Rate limiting on auth endpoints
- HTTP-only cookie session (currently localStorage Bearer only)
- Refresh token / session persistence with rotation
- Multi-provider account linking (oauth_accounts table)

**New backend dependencies required (install in AUTH-APP-01B or AUTH-APP-01D/E):**

- `passport-google-oauth20` + `@types/passport-google-oauth20`
- Apple OAuth library — TBD in AUTH-APP-01E (candidates: `passport-apple`, `apple-signin-auth`)
- Cookie parser: `cookie-parser` + `@types/cookie-parser` (if not already present)
- Email delivery: provider TBD — see Section 7

---

## 2. Current Critical Issues

These issues must be addressed in the earliest slices. No OAuth work should proceed until issues 1 and 4 are resolved.

### Issue 1 — password_hash schema/entity mismatch (BLOCKER for OAuth)

The initial migration (`InitSchema20260123`) creates `password_hash NOT NULL`:

```sql
"password_hash" character varying(255) NOT NULL
```

The `User` entity declares it nullable:

```typescript
@Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
passwordHash: string | null;
```

Inserting a Google or Apple OAuth user without a password would violate the `NOT NULL` constraint and fail at the database level. AUTH-APP-01B must issue a migration to make this column nullable.

### Issue 2 — localStorage JWT is XSS-vulnerable

`frontend/app/[locale]/login/page.tsx`:

```typescript
localStorage.setItem('access_token', response.data.access_token);
```

Browser JavaScript can read `localStorage`. Any XSS injection on any page exposes the token. AUTH-APP-01C must migrate to HTTP-only cookies.

### Issue 3 — 15-minute JWT expiry with no refresh

The JWT module is configured with `expiresIn: '15m'`. There is no refresh endpoint and no session persistence. Users are silently logged out every 15 minutes in production. This is unacceptable for a hosted app and must be resolved in AUTH-APP-01C alongside the cookie migration.

### Issue 4 — Single-provider User model blocks safe multi-provider linking

The `User` table has a single `authProvider` + `oauthId` per row. If `user@example.com` registers with email+password and later signs in with Google using the same email, the system currently cannot safely link these to one account. A separate `oauth_accounts` join table is required.

---

## 3. Token / Session Decision

### Decision: HTTP-only secure cookie sessions with server-side session/refresh persistence.

**Chosen approach:**

- On successful login (email+password or OAuth callback), the API Gateway sets an HTTP-only, Secure, SameSite=Lax cookie containing a session token (opaque or signed).
- The session maps server-side to a `auth_sessions` record containing user identity and expiry.
- Access tokens (short-lived JWTs) may still be issued internally for service-to-service calls, but are **never exposed to frontend JavaScript**.
- Frontend stops using `localStorage`. All auth state is implicit through the cookie.
- Sessions are refreshed automatically on activity (sliding window) or via a background refresh call to `/auth/session/refresh`.
- Sessions can be revoked server-side (logout, account disable, security event).

**Cookie attributes (production):**

```
Set-Cookie: aisandbox_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<7 days>
```

- `HttpOnly` — JavaScript cannot read the cookie
- `Secure` — only sent over HTTPS
- `SameSite=Lax` — prevents CSRF on cross-site navigations; upgrade to `Strict` if no cross-site redirects are needed after OAuth
- `Max-Age` — persistent session with server-side revocation

**CSRF protection:** Required for cookie-authenticated mutating requests (POST, PUT, PATCH, DELETE) from browser. Implementation strategy to be decided in AUTH-APP-01H — candidates: double-submit cookie, signed CSRF token header.

**Rejected alternatives:**

| Alternative | Reason rejected |
|---|---|
| Continue localStorage Bearer token | XSS risk — any script on any page can steal the token |
| Token in OAuth redirect query param | Tokens visible in browser history, referrer headers, and server logs |
| Pure Bearer token with /auth/refresh endpoint | Possible but not preferred for a browser-first hosted app where cookie isolation is simpler and safer |

---

## 4. OAuth Callback Flow

### Decision: Server-side session establishment with safe redirect.

**Flow for both Google and Apple:**

1. User clicks "Sign in with Google/Apple" on the login or register page
2. Browser is redirected to the provider authorization URL (with `state` parameter)
3. Provider redirects back to the API Gateway callback URL
4. API Gateway callback handler:
   - Validates `state` parameter (prevents CSRF)
   - Validates provider response / ID token
   - Looks up or creates user and links oauth_account record
   - Establishes server-side session
   - Sets HTTP-only session cookie
   - Redirects browser to an allowlisted frontend URL (e.g., `/en/app`)
5. Frontend loads with session cookie already present — no token in URL, no JavaScript token handling

**Rules:**
- The session token is NEVER placed in the redirect URL query string or hash
- Post-login redirect target must match an explicit allowlist (prevent open redirect)
- The OAuth `state` parameter must be validated before processing any callback

---

## 5. Data Model Changes (AUTH-APP-01B)

All changes are additive and backward-compatible with existing data.

### 5.1 Fix: Make `users.password_hash` nullable

```sql
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
```

This aligns the column with the existing entity declaration.

### 5.2 Add: `oauth_accounts` table

Links OAuth provider accounts to users. A user can have multiple provider accounts (email, Google, Apple).

```sql
CREATE TABLE "oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "provider" varchar(50) NOT NULL,          -- 'google' | 'apple'
  "provider_account_id" varchar(255) NOT NULL,
  "provider_email" varchar(255),
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE ("provider", "provider_account_id"),
  CONSTRAINT "fk_oauth_account_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_oauth_account_user_id" ON "oauth_accounts" ("user_id");
```

### 5.3 Add: `verification_tokens` table

Used for email verification and password reset one-time tokens.

```sql
CREATE TABLE "verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "token_hash" varchar(255) NOT NULL UNIQUE,
  "type" varchar(50) NOT NULL,              -- 'email_verify' | 'password_reset'
  "expires_at" TIMESTAMP NOT NULL,
  "used_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_verification_token_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_verification_token_hash" ON "verification_tokens" ("token_hash");
CREATE INDEX "idx_verification_token_user_type" ON "verification_tokens" ("user_id", "type");
```

Tokens are stored as hashes (SHA-256 of the raw token). Raw tokens are sent to the user; hashes are stored in the database.

### 5.4 Add: `auth_sessions` table

Server-side session persistence for the HTTP-only cookie approach.

```sql
CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "session_token_hash" varchar(255) NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "last_active_at" TIMESTAMP NOT NULL DEFAULT now(),
  "revoked_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_auth_session_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_auth_session_token_hash" ON "auth_sessions" ("session_token_hash");
CREATE INDEX "idx_auth_session_user_id" ON "auth_sessions" ("user_id");
CREATE INDEX "idx_auth_session_expires_at" ON "auth_sessions" ("expires_at");
```

Session tokens are opaque random strings (e.g., 32-byte `crypto.randomBytes`). Hashes (SHA-256) are stored. The raw token is placed in the HTTP-only cookie.

### 5.5 User entity alignment

The `User` entity fields `authProvider` and `oauthId` become legacy/deprecated once the `oauth_accounts` table is in place. They must not be removed immediately (backward compatibility) but should be marked as deprecated in code comments during AUTH-APP-01B. Future cleanup is out of scope for AUTH-APP-01.

---

## 6. Multi-Provider Account Linking Policy

### Definitive rules (applied in order):

1. **Match by provider + providerAccountId first.** If an `oauth_accounts` record exists for this provider and ID, sign in the linked user. No further checks needed.

2. **Match by verified email.** If no provider account record exists and the OAuth provider confirms the email is verified, look for an existing `users` row with the same email. If found, auto-link: create an `oauth_accounts` record and sign in the existing user.

3. **Apple private relay email — no auto-link.** Apple may issue `xyz@privaterelay.appleid.com` instead of the user's real email. A relay email must NOT be used to auto-link to an existing real-email account. If the email is a relay address and no provider account record already exists, create a new user with the relay email.

4. **Unverified email — no auto-link.** If the provider does not mark the email as verified (rare for Google, not applicable for Apple), do not auto-link. Return a safe conflict error and prompt the user to sign in with their existing method.

5. **Email conflict with different provider account.** If an `oauth_accounts` record exists for a different provider (but same email), prompt the user to sign in with the previously used provider. Do not silently merge accounts from different providers without explicit user confirmation.

6. **Duplicate email+password + OAuth.** If the user already has an email+password account and successfully signs in via OAuth with the same verified email, auto-link applies (rule 2). The email+password account is preserved; the OAuth provider is added as an additional sign-in method.

---

## 7. Email Authentication Strategy

### 7.1 Auth method: email + password (keep current, not magic link)

The existing email+password flow is preserved. Magic link is not selected — it adds email dependency to every sign-in and complicates offline or email-delayed scenarios.

### 7.2 Email verification

- After registration, send a time-limited verification email with a one-time token
- Store token hash in `verification_tokens` table (`type = 'email_verify'`, expiry 24h)
- User clicks link → API validates token hash, marks user `emailVerified = true`, marks token `used_at`
- Unverified users may sign in but should see a verification banner; feature-gating of specific actions is deferred
- Token resend: rate-limited to 3 per hour per user

### 7.3 Password reset

- User requests reset → API creates verification token (`type = 'password_reset'`, expiry 1h)
- Token sent to registered email
- User submits new password with token → API validates, hashes new password, marks token used, revokes all active auth sessions for the user
- Rate-limited: 5 requests per hour per email, 10 per hour per IP

### 7.4 Transactional email provider

**No email provider is currently configured in the project.** Provider selection is a required prerequisite before AUTH-APP-01C can implement email verification or password reset. Candidates:

- Resend (simple API, generous free tier)
- SendGrid
- Amazon SES

**Action required before AUTH-APP-01C stage-start:** Choose and configure a transactional email provider. Add the API key to environment variables. This is not resolved in this spec.

### 7.5 Rate limiting on auth endpoints

Apply rate limiting in AUTH-APP-01C:

| Endpoint | Limit |
|---|---|
| POST /auth/login | 10 per minute per IP |
| POST /auth/register | 5 per minute per IP |
| POST /auth/password-reset/request | 5 per hour per email, 10 per hour per IP |
| POST /auth/email/verify/resend | 3 per hour per user |

Implementation: `@nestjs/throttler` or Redis-backed rate limiter. Exact strategy to be decided in AUTH-APP-01H.

---

## 8. Google OAuth Slice Requirements (AUTH-APP-01D)

### 8.1 Dependency

Install in AUTH-APP-01D:

```bash
npm install passport-google-oauth20
npm install --save-dev @types/passport-google-oauth20
```

### 8.2 Strategy

Create `GoogleStrategy` using `passport-google-oauth20`. Request scopes: `email`, `profile`. Set `accessType: 'offline'` only if refresh tokens from Google are needed (not required for first implementation).

### 8.3 Controller routes

```
GET /auth/google              — initiates OAuth redirect
GET /auth/google/callback     — handles provider callback
```

### 8.4 Environment variables required

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://<host>/api/auth/google/callback
```

### 8.5 Manual setup checklist (to be verified per deployment)

- [ ] Google Cloud Console project created
- [ ] OAuth 2.0 credentials created (type: Web Application)
- [ ] Authorized redirect URI set to `GOOGLE_CALLBACK_URL`
- [ ] OAuth consent screen configured (app name, support email, scopes: email, profile)
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` added to environment
- [ ] Test with a Google account that is not the developer account

---

## 9. Apple OAuth Slice Requirements (AUTH-APP-01E)

### 9.1 Dependency

Library selection TBD in AUTH-APP-01E stage-start. Candidates:

- `passport-apple` — Passport strategy wrapper; check compatibility with current passport version
- `apple-signin-auth` — standalone JWT validation library, more manual but well-maintained

### 9.2 Apple-specific characteristics

- Apple callback uses `POST` (not `GET`) — the NestJS controller must handle a POST route for the callback
- Apple issues an ID token (JWT) on first sign-in. Subsequent sign-ins may not re-send user info (name, email). Store on first sign-in.
- Apple private relay emails (`@privaterelay.appleid.com`) — see Section 6, rule 3

### 9.3 Environment variables required

```
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_CLIENT_ID=          # Services ID (format: com.example.app)
APPLE_CALLBACK_URL=https://<host>/api/auth/apple/callback
APPLE_PRIVATE_KEY=        # PEM string of the .p8 key downloaded from Apple Developer
```

**Critical:** The `.p8` private key can only be downloaded once from the Apple Developer Portal. It must be stored securely and never committed to source control.

### 9.4 Manual setup checklist (to be verified per deployment)

- [ ] Apple Developer account with paid membership active
- [ ] App ID created with "Sign in with Apple" capability enabled
- [ ] Services ID created (used as `APPLE_CLIENT_ID`)
- [ ] Key created under "Keys" in Apple Developer Portal with "Sign in with Apple" enabled
- [ ] `.p8` private key downloaded and stored as `APPLE_PRIVATE_KEY` in environment (not in source)
- [ ] `APPLE_CALLBACK_URL` registered as Return URL on the Services ID
- [ ] Test with a real Apple ID (Sandbox testing recommended)
- [ ] Verify private relay email handling works per policy in Section 6

---

## 10. Route / API Protection

### 10.1 Frontend protected routes

The following frontend routes require an authenticated session. Unauthenticated requests receive a redirect to `/[locale]/login`:

| Route | Protection |
|---|---|
| `/[locale]/app` | Session required |
| `/[locale]/projects` | Session required |
| `/[locale]/keys` | Session required |
| `/[locale]/account` | Session required |

Implementation: Next.js middleware (`frontend/middleware.ts`) reads the session cookie and redirects if absent. This is a frontend-layer check — API endpoints enforce auth independently.

### 10.2 Backend API protected endpoints

All API Gateway endpoints that operate on user-owned resources (`/api/sessions`, `/api/projects`, `/api/workspaces`, `/api/users`, `/api/ai`, `/api/checkpoints`, `/api/conversations`, `/api/keys`) require authentication. Unauthenticated requests receive `401 Unauthorized`.

**Explicitly public API routes (no auth required):**

| Route | Reason |
|---|---|
| `POST /api/auth/login` | Authentication entry point |
| `POST /api/auth/register` | Registration entry point |
| `GET /api/auth/google` | OAuth initiation |
| `GET /api/auth/google/callback` | OAuth callback |
| `POST /api/auth/apple/callback` | OAuth callback |
| `POST /api/auth/password-reset/request` | Password reset initiation |
| `POST /api/auth/password-reset/confirm` | Password reset completion |
| `GET /api/auth/email/verify` | Email verification link handler |
| `GET /api/health` | Health check |
| `GET /api/public/*` | Public project viewing |

Internal service endpoints (`/api/internal/*`) continue to use `InternalServiceAuthGuard` as currently implemented.

### 10.3 Authenticated user context propagation

After the session cookie middleware validates the session, the resolved `userId` and `user` object are attached to `request.user`. All NestJS controllers access user identity via the existing `@AuthenticatedUser()` decorator pattern.

### 10.4 Auth middleware for session cookie validation

A new `SessionAuthMiddleware` (or updated `JwtAuthGuard`) must validate the session cookie against the `auth_sessions` table rather than parsing a Bearer JWT. The existing `JwtStrategy` continues to work for internal service tokens. The session cookie path is the new primary authentication path for browser clients.

---

## 11. UX Integration (AUTH-APP-01G)

### 11.1 Login page changes

The existing UX-IA-03 login page (email+password form with design tokens and i18n) is the base. AUTH-APP-01G adds:

- Google sign-in button (below the email/password form, with divider)
- Apple sign-in button (below Google button)
- Both buttons redirect to the respective `/api/auth/[provider]` initiation URL

Layout rule: OAuth buttons must not displace or restructure the email/password form.

### 11.2 Register page changes

Same pattern: Google and Apple sign-in/sign-up buttons added to the register page. The UX copy for OAuth buttons on the register page should be "Continue with Google / Apple" to cover both sign-in and sign-up.

### 11.3 Logout

- Client calls `POST /api/auth/logout`
- API Gateway revokes the session record (`auth_sessions.revoked_at = now()`)
- API Gateway clears the session cookie (set `Max-Age=0`)
- Client is redirected to `/[locale]` (public landing)
- Frontend must not retain any user identity state after logout

### 11.4 Basic account page

The existing `/[locale]/account` page (currently wired to `/[locale]/keys`) will eventually show:

- Email address
- Auth provider(s) linked (email, Google, Apple)
- Plan and usage summary (already implemented via `UsersService`)
- Change password option (if email+password account)
- Logout button

Full account page redesign is within AUTH-APP-01G scope only for the auth provider display. Deeper account management is deferred.

### 11.5 Error states

| Error condition | User-facing behavior |
|---|---|
| OAuth provider error / user denied | Redirect to login with `?error=oauth_failed` query param; show i18n error message |
| Account linking conflict (different provider, same email) | Redirect to login with `?error=account_conflict`; show "Sign in with your original method" message |
| Unverified email conflict during linking | Redirect with `?error=email_unverified`; show "Verify your email first" message |
| Expired verification token | Show "Link expired. Request a new verification email." |
| Expired password reset token | Show "Link expired. Request a new password reset." |

All error messages must use i18n keys (extend `errors` namespace in the message files).

---

## 12. Security Requirements

### 12.1 Cookie attributes

```
HttpOnly: always
Secure: always (enforce HTTPS in production; allow HTTP in development only)
SameSite: Lax (default); evaluate Strict after OAuth redirect flow is tested
Path: /
Max-Age: 7 days (604800 seconds)
Domain: set to production domain in production environment
```

### 12.2 CSRF protection

Required for all cookie-authenticated state-mutating requests. Strategy to be implemented in AUTH-APP-01H. Recommended: synchronizer token pattern using a separate non-HttpOnly CSRF cookie that the frontend reads and sends as a request header.

### 12.3 OAuth state parameter

The `state` parameter must be generated as a cryptographically random value, stored in a short-lived server-side record or signed cookie, and validated on callback before processing any OAuth response. Failure to validate `state` must result in immediate rejection.

### 12.4 Safe redirect allowlist

Post-login and post-OAuth redirect targets must match an explicit allowlist. Redirects to external domains or unrecognized paths must be rejected. Default redirect: `/[locale]/app`.

### 12.5 Secrets management

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — environment variables only; never in source
- `APPLE_PRIVATE_KEY`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID` — environment variables only; never in source
- `JWT_SECRET`, `SESSION_SECRET` — environment variables only
- The Apple `.p8` key must never be committed to git

### 12.6 Duplicate account prevention

The `UNIQUE ("provider", "provider_account_id")` constraint on `oauth_accounts` prevents duplicate provider account links at the database level. The service layer must also check for existing email users before creating new users for OAuth sign-in.

### 12.7 Session revocation

`auth_sessions` records include a `revoked_at` column. Session lookup must filter `WHERE revoked_at IS NULL AND expires_at > NOW()`. All active sessions for a user must be revocable (e.g., on password change, account disable, security event).

### 12.8 Rate limiting scope

See Section 7.5 for endpoint-specific limits. Implementation in AUTH-APP-01H.

---

## 13. Testing & Verification

### 13.1 Unit tests (per slice)

Each slice must include unit tests for new service methods:

- `AuthService`: account-linking logic, session creation/validation/revocation, token hashing
- `GoogleStrategy`: mock provider response, account lookup and link behavior
- `AppleStrategy`: mock provider response, private relay email handling
- Session middleware: valid session → pass, expired session → 401, revoked session → 401

Test framework: existing Jest setup in `api-gateway`.

### 13.2 Integration tests (per slice)

Where the existing smoke/integration test infrastructure supports it:

- `POST /auth/login` → 200 with session cookie set
- `POST /auth/login` with wrong credentials → 401
- Authenticated request with valid session cookie → 200
- Authenticated request with expired/revoked session cookie → 401
- `POST /auth/register` with existing email → 409 Conflict
- `POST /auth/logout` → session revoked, cookie cleared

### 13.3 Manual Google OAuth checklist (AUTH-APP-01D)

- [ ] GET /api/auth/google initiates redirect to Google consent screen
- [ ] Google callback sets session cookie and redirects to `/[locale]/app`
- [ ] Second sign-in with same Google account signs in to same user
- [ ] Signing in with a Google account whose email matches an existing email+password user links the accounts
- [ ] Invalid or missing `state` parameter on callback returns 400 without creating a session

### 13.4 Manual Apple OAuth checklist (AUTH-APP-01E)

- [ ] Apple sign-in initiates redirect to Apple authorization
- [ ] Apple callback (POST) sets session cookie and redirects to `/[locale]/app`
- [ ] Private relay email creates new user without auto-linking
- [ ] Second sign-in with same Apple account signs in to same user
- [ ] Apple private key is confirmed as an environment variable and not in source

### 13.5 Per-slice validation commands (backend)

```powershell
# Typecheck
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit

# Tests
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm test

# Lint
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run lint
```

Frontend validation commands remain as established in UX-IA-01 through UX-IA-03 checkpoints.

---

## 14. Confirmed Child Slice Breakdown

The following order is confirmed. Each slice must be registered, stage-started, implemented, and consolidated before the next begins.

| Slice | Title | Key deliverable |
|---|---|---|
| AUTH-APP-01B | Database / Schema Migrations | Fix password_hash nullability; add oauth_accounts, verification_tokens, auth_sessions tables; update User entity |
| AUTH-APP-01C | Token Storage & Email Auth Hardening | HTTP-only cookie session (replace localStorage); session middleware; refresh/revocation; email verification; password reset; rate limiting groundwork |
| AUTH-APP-01D | Google OAuth | passport-google-oauth20 strategy; account linking; callback flow; manual checklist |
| AUTH-APP-01E | Apple OAuth | Apple strategy; POST callback; private relay handling; Apple Developer checklist |
| AUTH-APP-01F | Route / API Protection | Frontend session-cookie middleware route guard; backend API auth enforcement audit; 401/redirect behavior |
| AUTH-APP-01G | Auth UX Integration | OAuth buttons on login/register; logout endpoint + frontend; basic account page auth section; OAuth error state i18n |
| AUTH-APP-01H | Security Hardening + Validation Checklist | CSRF protection; rate limiting implementation; state parameter audit; redirect allowlist; secrets env audit; full manual verification |
| AUTH-APP-01Z | Final Consolidation | Checkpoint, TASKS.md/TASKS_BACKLOG_FULL.md update, summary |

**Sequencing notes:**

- AUTH-APP-01B must complete before AUTH-APP-01C (schema changes are prerequisites for session table)
- AUTH-APP-01C must complete before AUTH-APP-01D and AUTH-APP-01E (cookie session must be in place before OAuth callbacks set cookies)
- AUTH-APP-01D and AUTH-APP-01E may be done in parallel if two development streams are available, but serial is safer
- AUTH-APP-01F may begin after AUTH-APP-01C (session middleware exists) without waiting for full OAuth
- AUTH-APP-01G requires AUTH-APP-01D/E to be complete (OAuth buttons need live endpoints)
- AUTH-APP-01H is the final hardening pass before AUTH-APP-01Z

**Potential AUTH-APP-01C split:** If token storage migration (localStorage → cookie) and email verification/password reset prove too large for one slice, AUTH-APP-01C may be split into:
- AUTH-APP-01C1 — Session Cookie Migration (localStorage removal, session table, middleware)
- AUTH-APP-01C2 — Email Auth Hardening (verification, password reset, rate limits)

This split decision should be made at AUTH-APP-01C stage-start after inspecting the frontend localStorage surface.

---

## Open Implementation Risks

| Risk | Severity | Resolution |
|---|---|---|
| No transactional email provider configured | HIGH — blocks email verification and password reset | Must be resolved before AUTH-APP-01C stage-start. Choose Resend, SendGrid, or SES and add API key to env. |
| Apple `.p8` key one-time download | HIGH — cannot be recovered if lost | Document and securely store immediately when generated. Use a secrets manager in production. |
| Apple private relay email edge cases | MEDIUM | Follow rule in Section 6. Document behavior clearly in error messages. |
| `localStorage` used in other frontend files beyond login | MEDIUM | Before AUTH-APP-01C, audit all frontend files that read `localStorage.getItem('access_token')`. Scope of removal may be larger than expected. |
| AUTH-APP-01C scope creep | MEDIUM | Be prepared to split into C1 + C2 at stage-start. |
| `state` parameter storage for short-lived OAuth flow | LOW | Use a signed short-lived cookie or an in-memory/Redis store. Confirm approach at AUTH-APP-01D stage-start. |
