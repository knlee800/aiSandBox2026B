# AUTH-APP-01C2 Email Auth Spec

**Task:** AUTH-APP-01C2A — Email Verification / Password Reset Spec + Provider Abstraction Plan
**Date:** 2026-05-08
**Status:** APPROVED — gates AUTH-APP-01C2B through AUTH-APP-01C2F implementation
**Parent:** AUTH-APP-01C2 (ACTIVE)
**Nature:** SPEC AND DOCUMENTATION ONLY — no production source files changed in this slice

---

## 1. Purpose and Scope

This document is the governing implementation spec for AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting. It defines all architectural decisions, data model requirements, API contracts, frontend UX plans, security rules, and child-slice boundaries required to fully implement email auth for the aiSandBox platform.

### Slice map

| Slice | Nature | Deliverable |
|---|---|---|
| **AUTH-APP-01C2A** | Spec / docs only | This document. No production source files. |
| **AUTH-APP-01C2B** | Backend — provider foundation | Install `resend`; `EmailProvider` interface; `ResendEmailProvider`; `StubEmailProvider`; `EmailModule`; env var additions to `.env.example` |
| **AUTH-APP-01C2C** | Backend — email verification | `email_verified` migration + entity; verification token service methods; `GET /api/auth/email/verify`; `POST /api/auth/email/verify/resend`; register triggers verification email; `/me` includes `emailVerified` |
| **AUTH-APP-01C2D** | Backend — password reset | Password reset service methods; `POST /api/auth/password-reset/request`; `POST /api/auth/password-reset/confirm`; rate limiting on new endpoints |
| **AUTH-APP-01C2E** | Frontend — email UX | Updated register success copy; forgot-password page; reset-password page; login forgot-password link; `?verified=1` and `?error=token_expired` banners; i18n keys in all 3 locales |
| **AUTH-APP-01C2F** | Validation + consolidation | `npx tsc --noEmit` PASS; targeted unit and integration tests; manual smoke checklist; checkpoint docs; governance update |

**AUTH-APP-01C2A produces no production code.** All code decisions in this spec are implemented starting in AUTH-APP-01C2B.

---

## 2. Current Repo / Auth State

This section records what is confirmed present and what is confirmed missing as of AUTH-APP-01C2A stage-start (2026-05-08). All statements are based on direct source inspection.

### Confirmed present

| Component | Location | Notes |
|---|---|---|
| `verification_tokens` table | `migrations/1771700000000-AddAuthSchemaFoundation.ts` | Columns: `id`, `user_id`, `token_hash`, `type`, `expires_at`, `used_at`, `created_at`. Indices: unique on `token_hash`; composite on `(user_id, type)`. Sufficient for email verify and password reset. |
| `VerificationToken` entity | `src/entities/verification-token.entity.ts` | TypeORM entity; `@ManyToOne` to `User`; `usedAt: Date \| null`. |
| `auth_sessions` table and entity | `migrations/...`, `src/entities/auth-session.entity.ts` | Session revocation via `revokedAt` column already in use. |
| `oauth_accounts` table and entity | `migrations/...`, `src/entities/oauth-account.entity.ts` | Multi-provider linking. |
| `users.password_hash` nullable | `migrations/1771700000000-AddAuthSchemaFoundation.ts` | `ALTER COLUMN "password_hash" DROP NOT NULL`. |
| `createHash` / `randomBytes` pattern | `src/auth/auth.service.ts` lines 5, 74–76 | `import { createHash, randomBytes } from 'crypto'`; SHA-256 used for session tokens; directly reusable for verification tokens. |
| `@nestjs/throttler@^6.5.0` | `package.json` | Installed and active. `@Throttle({ default: { limit: 10, ttl: 60000 } })` on `POST /auth/login`; `{ limit: 5, ttl: 60000 }` on `POST /auth/register`. |
| `cookie-parser`, `bcrypt`, `class-validator` | `package.json` | All present. |

### Confirmed missing — must be implemented in C2B–C2E

| Gap | Required in |
|---|---|
| `users.email_verified` column | C2C — migration + entity update |
| Optional `locale` column on `verification_tokens` | C2C — migration (for post-verification redirect locale) |
| Email provider module (`EmailModule`, `EmailProvider`, `ResendEmailProvider`, `StubEmailProvider`) | C2B |
| `resend` npm package | C2B |
| Email-related env vars in `.env.example` | C2B |
| `VerificationToken` repository injection into `AuthModule` | C2C |
| `AuthService` verification token methods | C2C |
| `AuthService` password reset methods | C2D |
| `AuthService.revokeAllUserSessions(userId)` | C2D |
| `GET /api/auth/email/verify` route | C2C |
| `POST /api/auth/email/verify/resend` route | C2C |
| `POST /api/auth/password-reset/request` route | C2D |
| `POST /api/auth/password-reset/confirm` route | C2D |
| Frontend `forgot-password/page.tsx` | C2E |
| Frontend `reset-password/page.tsx` | C2E |
| Login "Forgot password?" link | C2E |
| Login `?verified=1` success banner | C2E |
| Register success copy (verification email sent) | C2E |
| i18n keys for all email auth flows (en / zh-TW / zh-CN) | C2E |

---

## 3. Provider Abstraction Design

### 3.1 Principle

Auth business logic MUST depend only on the `EmailProvider` abstraction. No auth service method, controller, or module may import or reference the Resend SDK (`resend`) directly. The Resend SDK is used exclusively inside `ResendEmailProvider`. This ensures a future migration to SES or SendGrid is an adapter-only change — no auth business logic is touched.

### 3.2 `EmailProvider` interface

File: `src/email/email-provider.interface.ts`

```typescript
export interface EmailProvider {
  sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
```

`text` is optional plain-text fallback for email clients that do not render HTML. Included in the interface now to avoid a future breaking change.

### 3.3 `ResendEmailProvider` — v1 implementation

File: `src/email/resend-email.provider.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    this.client = new Resend(apiKey);
    const from = process.env.AUTH_EMAIL_FROM;
    if (!from) throw new Error('AUTH_EMAIL_FROM is required');
    this.from = from;
    this.replyTo = process.env.AUTH_EMAIL_REPLY_TO;
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text ? { text: options.text } : {}),
      ...(this.replyTo ? { reply_to: this.replyTo } : {}),
    });
  }
}
```

### 3.4 `StubEmailProvider` — for test environments

File: `src/email/stub-email.provider.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class StubEmailProvider implements EmailProvider {
  private readonly logger = new Logger(StubEmailProvider.name);

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    this.logger.debug(`[STUB] Email to ${options.to} — subject: "${options.subject}"`);
    // No-op: does not send any real email.
  }
}
```

Selected when `EMAIL_PROVIDER=stub`. This is the default for test environments and unblocks all Jest tests that would otherwise fail due to a missing `RESEND_API_KEY`.

### 3.5 `EmailModule` — provider factory

File: `src/email/email.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { ResendEmailProvider } from './resend-email.provider';
import { StubEmailProvider } from './stub-email.provider';

const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  useFactory: () => {
    const provider = process.env.EMAIL_PROVIDER ?? 'stub';
    switch (provider) {
      case 'resend':
        return new ResendEmailProvider();
      case 'stub':
        return new StubEmailProvider();
      default:
        throw new Error(`Unknown EMAIL_PROVIDER: "${provider}". Supported: resend, stub`);
    }
  },
};

@Module({
  providers: [emailProviderFactory],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
```

`AuthModule` imports `EmailModule` and injects:
```typescript
@Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider
```

### 3.6 Future adapter switch path

To add SES or SendGrid:
1. Create `src/email/ses-email.provider.ts` or `src/email/sendgrid-email.provider.ts` implementing `EmailProvider`
2. Add a `case 'ses':` or `case 'sendgrid':` branch to the `emailProviderFactory`
3. Add the required env vars to `.env.example`
4. Set `EMAIL_PROVIDER=ses` (or `sendgrid`) in the deployment environment

**No auth service, no controller, no business logic file changes.** The abstraction boundary is the injection token; all consumer code is already provider-agnostic.

---

## 4. Env Var Plan

### 4.1 Required variables

| Variable | Required | Example | Description |
|---|---|---|---|
| `EMAIL_PROVIDER` | Yes | `resend` | Selects email provider implementation. Values: `resend` \| `stub`. Default: `stub`. |
| `RESEND_API_KEY` | Yes when `EMAIL_PROVIDER=resend` | `re_...` | API key from resend.com dashboard. Never commit to git. |
| `AUTH_EMAIL_FROM` | Yes | `noreply@aisandbox.app` | From address for all platform auth emails. Must be a verified sender domain in Resend. |
| `APP_BASE_URL` | Yes | `https://aisandbox.app` | Base URL used to construct verification and reset links in emails. No trailing slash. |
| `AUTH_EMAIL_REPLY_TO` | Optional | `support@aisandbox.app` | Reply-to address for auth emails. If absent, no reply-to is set. |

### 4.2 Test environment

Tests must set `EMAIL_PROVIDER=stub` so no real email is sent and `RESEND_API_KEY` is not required. The `StubEmailProvider` is a no-op and safe for all Jest test suites.

`APP_BASE_URL` must also be set (or defaulted) in the test environment to prevent link-building code from failing at startup. Recommended test default: `http://localhost:4000`.

### 4.3 `.env.example` additions (C2B deliverable)

Add to `services/api-gateway/.env.example`:

```bash
# Transactional email (required for email verification and password reset)
# EMAIL_PROVIDER selects the provider: resend | stub
# Use 'stub' in development to disable real email sending.
EMAIL_PROVIDER=stub

# Required when EMAIL_PROVIDER=resend
# RESEND_API_KEY=re_...

# Required for all environments (used to construct links in auth emails)
# AUTH_EMAIL_FROM=noreply@aisandbox.app
# APP_BASE_URL=https://aisandbox.app

# Optional
# AUTH_EMAIL_REPLY_TO=support@aisandbox.app
```

### 4.4 Startup validation

`ResendEmailProvider` constructor (and any future provider constructor) throws immediately if required env vars are absent. This ensures the process fails at startup rather than silently at the first email send attempt.

`APP_BASE_URL` must be validated in `EmailModule` or `AuthModule` startup, even when using `StubEmailProvider`, to prevent link-building failures at runtime.

### 4.5 Security rules for secrets

- `RESEND_API_KEY` must never be committed to git
- Use `.env` (untracked) locally; use a secrets manager in staging/production
- `.env.example` contains only placeholder comments — never real keys
- The existing `.gitignore` already excludes `.env*` files (confirmed in H4 secrets audit)

---

## 5. DB / Entity Requirements

### 5.1 `verification_tokens` table — existing, sufficient

The table created in `1771700000000-AddAuthSchemaFoundation.ts` has all required columns:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK | Row identifier |
| `user_id` | uuid FK → users | Token owner |
| `token_hash` | varchar(255) UNIQUE | SHA-256 of raw token |
| `type` | varchar(50) | `'email_verify'` or `'password_reset'` |
| `expires_at` | TIMESTAMP | Token expiry |
| `used_at` | TIMESTAMP nullable | Set when token is consumed |
| `created_at` | TIMESTAMP | Created at |

**No structural changes needed** to the core token schema.

### 5.2 `locale` column on `verification_tokens` — add in C2C

To redirect the user to the correct locale login page after email verification, a `locale` column must be stored with the token at generation time.

Migration (C2C):
```sql
ALTER TABLE "verification_tokens"
ADD COLUMN IF NOT EXISTS "locale" character varying(10) NOT NULL DEFAULT 'en';
```

Entity update (C2C):
```typescript
@Column({ type: 'varchar', length: 10, default: 'en' })
locale: string;
```

`AuthController` passes the request locale (from `Accept-Language`) to the token generation method in `AuthService`. This locale is stored with the token and used to build the post-verification redirect URL.

### 5.3 `email_verified` column on `users` — add in C2C

**Not present in the current `user.entity.ts` or any migration.** Must be added.

Migration (C2C):
```sql
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
```

Entity update (C2C):
```typescript
@Column({ type: 'boolean', name: 'email_verified', default: false })
emailVerified: boolean;
```

**Default value for existing rows:** `false`. In this pre-production state, existing email/password users will appear unverified. Per spec Section 7.2, they may still sign in but will see a verification banner in a future UX slice. Verification emails can be resent via `POST /api/auth/email/verify/resend`.

### 5.4 OAuth users — created with `emailVerified = true`

Google and Apple providers verify user emails at the provider level before issuing credentials. New OAuth users must be created with `emailVerified: true` so they are never prompted to verify an email that the provider already verified.

Affected `AuthService` methods (update in C2C):
- `findOrCreateGoogleUser()` — set `emailVerified: true` when creating new user
- `findOrCreateAppleUser()` — set `emailVerified: true` when creating new user (applies to both relay and non-relay email addresses, since relay addresses cannot receive verification email)

Existing OAuth users created before C2C will have `email_verified = false` by default migration. A data patch may be applied (optional, out of scope for C2C) to backfill existing OAuth users to `true`. For pre-production, this is acceptable to leave as-is with a noted carry-forward.

### 5.5 `email_verified` in `/me` response

`AuthService.getUserById()` currently selects `['id', 'email', 'role', 'planType']`. After C2C, `emailVerified` must be included in the response so the frontend can display a verification banner. Exact UX for the banner is deferred beyond C2E.

---

## 6. Email Verification Flow

### 6.1 After `POST /api/auth/register`

Current behavior: user created, response returned, no email sent.

After C2C:

1. User is created with `emailVerified: false`
2. Generate `rawToken = randomBytes(32).toString('base64url')` (43-char URL-safe string)
3. `tokenHash = createHash('sha256').update(rawToken).digest('hex')`
4. Insert into `verification_tokens`:
   - `userId` = new user's ID
   - `tokenHash`
   - `type = 'email_verify'`
   - `expiresAt = now() + 24h`
   - `usedAt = null`
   - `locale` = from `Accept-Language` header (normalized to `'en'` | `'zh-TW'` | `'zh-CN'`)
5. Call `emailProvider.sendEmail()` with:
   - `to`: user's email
   - `subject`: "Verify your email address — AI Sandbox"
   - `html`: email body containing the verification link: `${APP_BASE_URL}/api/auth/email/verify?token=${rawToken}&locale=${locale}`
   - `text`: plain-text version of the same message
6. Return `201` response with existing shape — `{ id, email, role, plan_type }`

The register endpoint does NOT issue a session cookie. Login is a separate step.

**Token is NEVER included in any log output.** Log at most: `[AuthService] Verification email sent to userId=<uuid>`.

### 6.2 `GET /api/auth/email/verify?token=<raw>&locale=<locale>`

Public route. No session, no CSRF guard.

Processing:
1. Extract `token` and `locale` from query params
2. `tokenHash = createHash('sha256').update(token).digest('hex')`
3. Look up `verification_tokens WHERE token_hash = $1 AND type = 'email_verify' AND used_at IS NULL AND expires_at > NOW()`
4. If not found or expired:
   - Redirect to `/${safeLocale}/login?error=token_expired`
5. If found:
   - Confirm `user.isActive`; if inactive, treat as invalid
   - `UPDATE users SET email_verified = true WHERE id = $userId`
   - `UPDATE verification_tokens SET used_at = NOW() WHERE id = $tokenId`
   - Redirect to `/${safeLocale}/login?verified=1`
6. `safeLocale`: use the `locale` stored on the token record (not from the query param) to prevent open-redirect via locale manipulation. The `locale` query param may be used as a fallback only if the token's stored locale is absent.

### 6.3 `POST /api/auth/email/verify/resend`

Public route (unauthenticated). Body: `{ email: string }`.

Rationale for unauthenticated: Users who close their browser after registering cannot resend without logging in. Since unverified users can log in (per spec), they could theoretically use the session. However, unauthenticated resend is simpler and more user-friendly for all cases (e.g., tab was closed, email expired).

Processing:
1. Rate limited: 3 requests per hour per email address (custom throttle key — see Section 8)
2. Normalize email: `trim().toLowerCase()`
3. Look up user by email. **Regardless of result: always return `200`**:
   ```json
   { "message": "If that email is registered and unverified, a new verification link has been sent." }
   ```
4. If user found, active, and `emailVerified = false`:
   - Invalidate prior unused tokens: `UPDATE verification_tokens SET used_at = NOW() WHERE user_id = $userId AND type = 'email_verify' AND used_at IS NULL`
   - Generate new token (same flow as Section 6.1 steps 2–5)
   - Use `Accept-Language` header to determine locale for the new token
5. If user not found, already verified, or inactive: no action taken, still return `200`

### 6.4 Login behavior for unverified users

Per spec Section 7.2: "Unverified users may sign in but should see a verification banner; feature-gating of specific actions is deferred."

Login (`POST /api/auth/login`) does NOT block unverified users. Session is created normally. The `GET /api/auth/me` response must include `emailVerified: boolean` after C2C so that the frontend can show a verification banner in a future UX slice. The banner itself is deferred beyond C2E.

### 6.5 OAuth user behavior

OAuth users (Google, Apple) are created with `emailVerified = true` in `findOrCreateGoogleUser()` and `findOrCreateAppleUser()` (implemented in C2C). No verification email is sent to OAuth users. Apple private-relay addresses (`@privaterelay.appleid.com`) also get `emailVerified = true` since they are authenticated by Apple and cannot receive third-party verification emails.

---

## 7. Password Reset Flow

### 7.1 `POST /api/auth/password-reset/request`

Public route. Body: `{ email: string }`.

Processing:
1. Rate limited: 5 requests per hour per email AND 10 per hour per IP (see Section 8 for dual-key throttle strategy)
2. Normalize email: `trim().toLowerCase()`
3. **Always return `200`** regardless of whether the email exists:
   ```json
   { "message": "If that email is registered, a password reset link has been sent." }
   ```
4. Look up user by email. If user found and active:
   - Invalidate prior unused reset tokens: `UPDATE verification_tokens SET used_at = NOW() WHERE user_id = $userId AND type = 'password_reset' AND used_at IS NULL`
   - Generate `rawToken = randomBytes(32).toString('base64url')`
   - `tokenHash = createHash('sha256').update(rawToken).digest('hex')`
   - Insert into `verification_tokens`: `{ userId, tokenHash, type: 'password_reset', expiresAt: now() + 1h, locale }`
   - `locale` from `Accept-Language` header
   - Send reset email via `emailProvider.sendEmail()`:
     - Link: `${APP_BASE_URL}/api/auth/password-reset/confirm-page?token=${rawToken}&locale=${locale}` — or more practically, the frontend reset-password page: `${APP_BASE_URL}/${locale}/reset-password?token=${rawToken}`
5. If user not found or inactive: no action, still return `200`

**Raw token MUST NOT appear in any log output.**

### 7.2 `POST /api/auth/password-reset/confirm`

Public route. Body: `{ token: string, newPassword: string }`.

Processing:
1. No throttle beyond the inherent entropy of the 32-byte token (brute force is infeasible)
2. `tokenHash = createHash('sha256').update(token).digest('hex')`
3. Look up `verification_tokens WHERE token_hash = $1 AND type = 'password_reset' AND used_at IS NULL AND expires_at > NOW()`
4. If not found or expired:
   - Return `400 { message: 'Reset link is invalid or has expired. Please request a new one.' }`
5. Validate `newPassword`:
   - Minimum 6 characters (consistent with `RegisterDto` constraint)
   - If invalid: return `400 { message: 'Password must be at least 6 characters.' }`
6. `passwordHash = await bcrypt.hash(newPassword, 12)` (same cost factor as `AuthService.register()`)
7. `UPDATE users SET password_hash = $hash WHERE id = $userId`
8. `UPDATE verification_tokens SET used_at = NOW() WHERE id = $tokenId`
9. `await authService.revokeAllUserSessions(userId)` — revokes all active `auth_sessions` rows for the user
10. Return `200 { message: 'Password reset successfully. Please sign in with your new password.' }`

### 7.3 `AuthService.revokeAllUserSessions(userId)`

New method (C2D):
```typescript
async revokeAllUserSessions(userId: string): Promise<void> {
  await this.authSessionRepository.update(
    { userId, revokedAt: IsNull() },
    { revokedAt: new Date() },
  );
}
```

This uses the existing `IsNull` import from TypeORM already present in `auth.service.ts`.

---

## 8. Backend Route Plan

### 8.1 New routes summary

| Route | Method | Auth | CsrfGuard | Throttle | Body |
|---|---|---|---|---|---|
| `/api/auth/email/verify` | GET | Public | No | None (token entropy) | Query: `token`, `locale` |
| `/api/auth/email/verify/resend` | POST | Public | No | 3/hr per email | `{ email }` |
| `/api/auth/password-reset/request` | POST | Public | No | 5/hr/email + 10/hr/IP | `{ email }` |
| `/api/auth/password-reset/confirm` | POST | Public | No | None | `{ token, newPassword }` |

All four routes are public endpoints. No `SessionCookieGuard`, no `CsrfGuard`. This is consistent with the established public route list in spec Section 10.2.

**CSRF note:** CSRF protection applies only to cookie-authenticated state-mutating requests. These four routes carry no session cookie and therefore require no CSRF protection.

**Existing rate limits remain unchanged:** `POST /auth/login` (10/min/IP) and `POST /auth/register` (5/min/IP) are unaffected.

### 8.2 Rate limiting strategy for per-email limits

`@nestjs/throttler@^6.5.0` supports custom throttle key generation via a subclassed `ThrottlerGuard` that overrides `getTracker()`. The custom guard extracts the email from `request.body.email` as the throttle key for email-keyed endpoints.

**Decision for C2D:** Implement a `EmailThrottlerGuard` that extends `ThrottlerGuard` and overrides `getTracker()` to return `request.body.email ?? request.ip`. Apply different `@Throttle` configurations at the controller level:

- `POST /email/verify/resend`: `@Throttle({ default: { limit: 3, ttl: 3600000 } })` with `EmailThrottlerGuard` — key = email
- `POST /password-reset/request`: two-pass approach:
  - Apply IP-keyed throttle (default `ThrottlerGuard`, 10/hr/IP)
  - Apply email-keyed throttle (`EmailThrottlerGuard`, 5/hr/email)
  - If `@nestjs/throttler` does not cleanly support dual guards on the same route, implement email-keyed limit as an in-memory Map check inside `AuthService.requestPasswordReset()` as a fallback for v1

**Confirm at C2D stage-start** that `@nestjs/throttler@6.x` `getTracker()` override is the correct override point for custom key generation. Fallback strategy is in-service Map-based counting if the throttler API does not support it.

### 8.3 New AuthService methods

| Method | Scope |
|---|---|
| `generateAndStoreVerificationToken(userId, type, ttlMs, locale)` | Generates raw token, stores hash; returns raw token |
| `validateAndConsumeToken(rawToken, type)` | Validates hash/type/expiry/unused; marks `used_at`; returns `{ userId, locale }` |
| `sendVerificationEmail(email, rawToken, locale)` | Calls `emailProvider.sendEmail()` with verification link |
| `sendPasswordResetEmail(email, rawToken, locale)` | Calls `emailProvider.sendEmail()` with reset link |
| `resendEmailVerification(email, locale)` | Invalidates old tokens; generates new; sends |
| `requestPasswordReset(email, locale)` | Invalidates old tokens; generates new; sends |
| `confirmPasswordReset(rawToken, newPassword)` | Validates token; updates password; revokes sessions |
| `revokeAllUserSessions(userId)` | Revokes all active `auth_sessions` rows for user |

`AuthModule` must add `VerificationToken` to its `TypeOrmModule.forFeature([...])` import in C2C.

---

## 9. Frontend UX / i18n Plan

### 9.1 Register page — success state update

Current `register.successMessage`: `"Account created successfully. You can now sign in."`

After C2E:
```
"Account created. We've sent a verification email — please check your inbox."
```

An optional "Resend verification email" button appears in the success state. On click, it calls `POST /api/auth/email/verify/resend` with `{ email }` and replaces itself with a confirmation: "Verification email resent."

### 9.2 Login page — forgot-password link

Add a "Forgot your password?" link below the password field or below the error banner:

```tsx
<Link href={`/${locale}/forgot-password`} className="text-sm text-text-secondary hover:underline">
  {t('login.forgotPassword')}
</Link>
```

### 9.3 Login page — `?verified=1` and `?error=token_expired` banners

The login page currently handles `?error` via `OAuthErrorBanner` inside `<Suspense>`. Extend this pattern to handle:

- `?verified=1` → green banner: `t('login.emailVerified')` = "Email verified. You can now sign in."
- `?error=token_expired` → red banner: `t('errors.verificationExpired')` = "This verification link has expired. Request a new one from the register page."

The existing `OAuthErrorBanner` component should be extended or a new `AuthStatusBanner` component created to handle both `?error` and `?verified` query params.

### 9.4 Forgot-password page

New file: `frontend/app/[locale]/forgot-password/page.tsx`

States:
1. **Initial** — email input field + "Send reset link" button
2. **Submitted (loading)** — button disabled, "Sending..."
3. **Sent** — success message rendered in place of the form:
   > "If that email is registered, a reset link has been sent. Please check your inbox."

No redirect after submit. User can re-submit if needed (throttle handles abuse server-side). Back link to login page.

### 9.5 Reset-password page

New file: `frontend/app/[locale]/reset-password/page.tsx`

Reads `?token=` from `useSearchParams()` on mount.

States:
1. **Initial** — new password input + confirm password input + "Reset password" button
2. **Loading** — button disabled
3. **Success** — "Password reset. Please sign in." + Link to `/${locale}/login`
4. **Error (invalid/expired)** — "This link is invalid or has expired." + Link to `/${locale}/forgot-password`

Client-side validation: password must be ≥ 6 characters and both fields must match before submit. Do not send confirm-password to the server — only `{ token, newPassword }`.

### 9.6 No frontend `/verify-email` page needed

`GET /api/auth/email/verify` is a backend route. After token validation, the backend redirects to `/${locale}/login?verified=1` (success) or `/${locale}/login?error=token_expired` (failure). The login page handles both states. No dedicated frontend verify-email page is required.

### 9.7 i18n keys

Add the following to all three locale files (`en.json`, `zh-TW.json`, `zh-CN.json`) in C2E. English values shown; translations provided for zh-TW and zh-CN.

**`register` namespace additions:**
```json
"successMessage": "Account created. We've sent a verification email — please check your inbox.",
"resendVerification": "Resend verification email",
"verificationResent": "Verification email resent."
```

**`login` namespace additions:**
```json
"forgotPassword": "Forgot your password?",
"resetIt": "Reset it",
"emailVerified": "Email verified. You can now sign in."
```

**New `forgotPassword` namespace:**
```json
"forgotPassword": {
  "title": "Reset your password",
  "email": "Email",
  "submitButton": "Send reset link",
  "sending": "Sending...",
  "sentMessage": "If that email is registered, a reset link has been sent. Please check your inbox.",
  "backToLogin": "Back to sign in"
}
```

**New `resetPassword` namespace:**
```json
"resetPassword": {
  "title": "Choose a new password",
  "newPassword": "New password",
  "confirmPassword": "Confirm password",
  "submitButton": "Reset password",
  "resetting": "Resetting...",
  "successMessage": "Password reset successfully. Please sign in.",
  "signIn": "Sign in",
  "passwordMismatch": "Passwords do not match.",
  "passwordTooShort": "Password must be at least 6 characters.",
  "requestNew": "Request a new reset link",
  "resetFailed": "Reset failed. Please try again."
}
```

**`errors` namespace additions:**
```json
"tokenExpired": "This link is invalid or has expired.",
"verificationExpired": "This verification link has expired. Request a new one from the register page."
```

**Do not touch in C2E:** `login.testCredentials` and `register.name` are known dead keys (carry-forward from AUTH-APP-01Z). Leave them as-is.

---

## 10. Security Rules

| Rule | Specification |
|---|---|
| **Never store raw tokens** | Only SHA-256 hash stored in `verification_tokens.token_hash`. Raw token exists only in the email link. |
| **Never log raw tokens** | No raw token in any `Logger` call. Log only `userId` and token `type`. |
| **Token entropy** | `randomBytes(32).toString('base64url')` — 256 bits of entropy; 43-char URL-safe string. |
| **Email verification TTL** | 24 hours from generation. |
| **Password reset TTL** | 1 hour from generation. |
| **One-time use** | `used_at` is set on first consumption. Any subsequent use of the same token returns a generic invalid error. |
| **Token invalidation on resend / re-request** | All prior unused tokens for `(user_id, type)` are marked `used_at = NOW()` before a new token is generated. |
| **Anti-enumeration — resend** | `POST /api/auth/email/verify/resend` always returns `200` with a generic message. |
| **Anti-enumeration — password reset request** | `POST /api/auth/password-reset/request` always returns `200` with a generic message. |
| **Password reset revokes all sessions** | `revokeAllUserSessions(userId)` called after successful password confirmation. All active `auth_sessions` rows are revoked. |
| **Password minimum length** | ≥ 6 characters (consistent with existing `RegisterDto` constraint). Enforced in `AuthService.confirmPasswordReset()`. |
| **New password hashing** | `bcrypt.hash(newPassword, 12)` — same salt rounds as `AuthService.register()`. |
| **No CSRF on public token endpoints** | All four new routes are public. No session cookie is involved. `CsrfGuard` is not applied. |
| **No email/user enumeration** | No response distinguishes "email not found" from "email found". Error messages are generic. |
| **Rate limiting** | login: 10/min/IP; register: 5/min/IP; email/verify/resend: 3/hr/email; password-reset/request: 5/hr/email + 10/hr/IP. |
| **No real secrets in git** | `RESEND_API_KEY` and all provider keys stored only in local `.env` (untracked) or deployment secrets manager. `.env.example` contains only placeholder comments. |
| **OAuth users pre-verified** | `findOrCreateGoogleUser` and `findOrCreateAppleUser` set `emailVerified: true` at creation. No verification email sent. |
| **Unverified login allowed** | Email/password users may sign in before verifying. `emailVerified` is returned in `/me` for banner display. Feature-gating is deferred. |

---

## 11. Child-Slice Boundary Plan

### AUTH-APP-01C2B — Email Provider Foundation

**Nature:** Backend — no auth business logic, no DB migration, no new auth routes.

**Deliverables:**
- Install `resend` npm package (and `@types/resend` if needed)
- `src/email/email-provider.interface.ts` — `EmailProvider` interface + `EMAIL_PROVIDER` symbol
- `src/email/resend-email.provider.ts` — `ResendEmailProvider`
- `src/email/stub-email.provider.ts` — `StubEmailProvider`
- `src/email/email.module.ts` — `EmailModule` with factory
- `AuthModule` imports `EmailModule`; injects `EmailProvider`
- `.env.example` — add all email env vars (see Section 4.3)
- Startup validation for required env vars
- Unit tests for `EmailModule` factory (provider selection) and `StubEmailProvider`

**Files changed (expected):**
- `services/api-gateway/package.json` (dependency addition)
- `services/api-gateway/src/email/` (new directory + 4 files)
- `services/api-gateway/src/auth/auth.module.ts` (import EmailModule)
- `services/api-gateway/src/auth/auth.service.ts` (inject EmailProvider)
- `services/api-gateway/.env.example`

**Does NOT include:** any route changes, any auth service methods that send email, any migration.

---

### AUTH-APP-01C2C — Email Verification Backend

**Nature:** Backend — DB migration, entity update, service methods, two new routes.

**Dependencies:** AUTH-APP-01C2B complete (EmailProvider wired).

**Deliverables:**
- Migration: add `email_verified BOOLEAN NOT NULL DEFAULT false` to `users`
- Migration: add `locale varchar(10) NOT NULL DEFAULT 'en'` to `verification_tokens`
- `user.entity.ts` — add `emailVerified: boolean`
- `verification-token.entity.ts` — add `locale: string`
- `AuthModule` — add `VerificationToken` to `TypeOrmModule.forFeature([...])`
- `AuthService`:
  - `generateAndStoreVerificationToken(userId, type, ttlMs, locale)`
  - `validateAndConsumeToken(rawToken, type)` → `{ userId, locale }`
  - `sendVerificationEmail(email, rawToken, locale)`
  - `resendEmailVerification(email, locale)`
  - `register()` updated to generate token and send verification email
  - `findOrCreateGoogleUser()` and `findOrCreateAppleUser()` updated to set `emailVerified: true`
  - `getUserById()` updated to include `emailVerified` in response
- `AuthController`:
  - `GET /api/auth/email/verify`
  - `POST /api/auth/email/verify/resend` with `EmailThrottlerGuard`
- Unit tests for all new `AuthService` methods
- Controller integration tests

**Files changed (expected):**
- New migration file
- `src/entities/user.entity.ts`
- `src/entities/verification-token.entity.ts`
- `src/auth/auth.module.ts`
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- New test files

---

### AUTH-APP-01C2D — Password Reset Backend

**Nature:** Backend — service methods, two new routes, rate limiting extensions.

**Dependencies:** AUTH-APP-01C2B complete. AUTH-APP-01C2C independent (may be done in parallel, but serial is safer).

**Deliverables:**
- `AuthService`:
  - `sendPasswordResetEmail(email, rawToken, locale)`
  - `requestPasswordReset(email, locale)`
  - `confirmPasswordReset(rawToken, newPassword)`
  - `revokeAllUserSessions(userId)`
- `AuthController`:
  - `POST /api/auth/password-reset/request` with dual throttle (email + IP)
  - `POST /api/auth/password-reset/confirm`
- `EmailThrottlerGuard` — custom `ThrottlerGuard` subclass with `getTracker()` override for email-keyed limits
- Unit tests for all new `AuthService` methods
- Controller integration tests

**Files changed (expected):**
- `src/auth/auth.service.ts`
- `src/auth/auth.controller.ts`
- New `src/auth/email-throttler.guard.ts`
- New test files

---

### AUTH-APP-01C2E — Frontend Email UX

**Nature:** Frontend — new pages, updated copy, new i18n keys.

**Dependencies:** AUTH-APP-01C2C and AUTH-APP-01C2D (endpoints must exist for integration).

**Deliverables:**
- `frontend/messages/en.json` — new keys (see Section 9.7)
- `frontend/messages/zh-TW.json` — same keys, Traditional Chinese
- `frontend/messages/zh-CN.json` — same keys, Simplified Chinese
- `frontend/app/[locale]/forgot-password/page.tsx` — new page
- `frontend/app/[locale]/reset-password/page.tsx` — new page
- `frontend/app/[locale]/login/page.tsx`:
  - "Forgot your password?" link
  - `?verified=1` success banner
  - `?error=token_expired` error banner (extend or replace `OAuthErrorBanner`)
- `frontend/app/[locale]/register/page.tsx`:
  - Updated `register.successMessage` copy
  - Optional "Resend verification email" button in success state
- Do NOT change: `login.testCredentials`, `register.name` dead keys

**Files changed (expected):**
- `frontend/messages/en.json`
- `frontend/messages/zh-TW.json`
- `frontend/messages/zh-CN.json`
- `frontend/app/[locale]/forgot-password/page.tsx` (new)
- `frontend/app/[locale]/reset-password/page.tsx` (new)
- `frontend/app/[locale]/login/page.tsx`
- `frontend/app/[locale]/register/page.tsx`

---

### AUTH-APP-01C2F — Email Auth Validation + Consolidation

**Nature:** Validation + governance.

**Dependencies:** AUTH-APP-01C2E complete (full stack available).

**Deliverables:**
- `npx tsc --noEmit` PASS in `services/api-gateway`
- Targeted Jest tests PASS (all auth-related suites)
- `npm run build` PASS in `frontend`
- Manual smoke checklist (see Section 12.4)
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` through `docs/AUTH-APP-01C2F-CHECKPOINT.md`
- `docs/AUTH-APP-01C2-CHECKPOINT.md` (C2 family summary)
- `TASKS.md` and `TASKS_BACKLOG_FULL.md` updated: AUTH-APP-01C2 COMPLETE and LOCKED

---

## 12. Tests / Validation Plan

### 12.1 Provider abstraction unit tests (C2B)

File: `src/email/__tests__/email.module.spec.ts`

```
- EMAIL_PROVIDER=stub → factory returns StubEmailProvider
- EMAIL_PROVIDER=resend → factory calls ResendEmailProvider constructor
  (mock process.env.RESEND_API_KEY and AUTH_EMAIL_FROM)
- Unknown EMAIL_PROVIDER → factory throws Error
- StubEmailProvider.sendEmail() → resolves without error, does not throw
```

### 12.2 ResendEmailProvider unit tests (C2B)

File: `src/email/__tests__/resend-email.provider.spec.ts`

```
- Mock the Resend SDK client.emails.send()
- sendEmail() calls client.emails.send() with correct from/to/subject/html
- sendEmail() includes reply_to when AUTH_EMAIL_REPLY_TO is set
- sendEmail() excludes reply_to when AUTH_EMAIL_REPLY_TO is absent
- RESEND_API_KEY absent → constructor throws
- AUTH_EMAIL_FROM absent → constructor throws
```

### 12.3 AuthService verification token tests (C2C)

File: `src/auth/__tests__/auth.service.verify.spec.ts`

```
- generateAndStoreVerificationToken() → stores hash (not raw) in DB; returns raw token
- validateAndConsumeToken() with valid token → returns userId; sets used_at
- validateAndConsumeToken() with expired token → throws / returns null
- validateAndConsumeToken() with already-used token → throws / returns null
- validateAndConsumeToken() with wrong type → throws / returns null
- resendEmailVerification() → invalidates old tokens; generates new; calls emailProvider.sendEmail()
- resendEmailVerification() with unknown email → does not throw; does not call sendEmail()
- findOrCreateGoogleUser() → new user created with emailVerified=true
- findOrCreateAppleUser() → new user created with emailVerified=true
- register() → generates token; calls emailProvider.sendEmail(); does not log raw token
```

### 12.4 AuthService password reset tests (C2D)

File: `src/auth/__tests__/auth.service.reset.spec.ts`

```
- requestPasswordReset() with valid email → generates token; calls emailProvider.sendEmail()
- requestPasswordReset() with unknown email → does not throw; does not call sendEmail()
- confirmPasswordReset() with valid token → updates password_hash; marks used_at; revokes all sessions
- confirmPasswordReset() with expired token → throws / returns 400
- confirmPasswordReset() with used token → throws / returns 400
- confirmPasswordReset() with password < 6 chars → throws / returns 400
- revokeAllUserSessions() → sets revoked_at on all active sessions for userId
```

### 12.5 Controller integration tests (C2C, C2D)

```
- GET /api/auth/email/verify?token=<valid> → redirects to /${locale}/login?verified=1
- GET /api/auth/email/verify?token=<expired> → redirects to /${locale}/login?error=token_expired
- GET /api/auth/email/verify?token=<used> → redirects to /${locale}/login?error=token_expired
- POST /api/auth/email/verify/resend { email: 'known@...' } → 200 generic message
- POST /api/auth/email/verify/resend { email: 'unknown@...' } → 200 generic message
- POST /api/auth/password-reset/request { email: 'known@...' } → 200 generic message
- POST /api/auth/password-reset/request { email: 'unknown@...' } → 200 generic message
- POST /api/auth/password-reset/confirm { token: valid, newPassword: 'newpass' } → 200
- POST /api/auth/password-reset/confirm { token: expired } → 400
- POST /api/auth/password-reset/confirm { token: valid, newPassword: '12345' } → 400 (too short)
```

### 12.6 Frontend tests (C2E)

Frontend test framework: existing Jest + React Testing Library (256 tests passing per AUTH-APP-01H4).

```
- forgot-password page: renders email form; on submit calls /api/auth/password-reset/request; shows sent message
- forgot-password page: handles 429 throttle response gracefully
- reset-password page: reads ?token from URL; on submit calls /api/auth/password-reset/confirm
- reset-password page: shows success state on 200 response
- reset-password page: shows error state on 400 response
- reset-password page: client-side validation rejects mismatched passwords
- login page: renders forgot-password link
- login page: renders ?verified=1 success banner
- login page: renders ?error=token_expired error banner
- register page: successMessage copy updated
- register page: resend verification button calls /api/auth/email/verify/resend
```

### 12.7 Manual smoke checklist (C2F)

Requires live Docker/PostgreSQL/Redis/api-gateway/frontend/browser environment.

```
Email verification:
- [ ] Register new email/password account → verification email received
- [ ] Verification email contains correct link (APP_BASE_URL + token)
- [ ] Click verification link → redirected to login with ?verified=1 banner
- [ ] Login after verification → session created, emailVerified=true in /me response
- [ ] Use expired verification link (TTL elapsed) → redirected with ?error=token_expired
- [ ] Use already-used verification link → redirected with ?error=token_expired
- [ ] Resend verification email (register success button) → new email received
- [ ] Original link after resend → rejected (old token invalidated)
- [ ] Resend more than 3 times in an hour → 429 response (rate limited)
- [ ] Register via Google → emailVerified=true in /me without verification email

Password reset:
- [ ] Click forgot password → forgot-password page renders
- [ ] Submit known email → sent message displayed; reset email received
- [ ] Reset email contains correct link (/${locale}/reset-password?token=...)
- [ ] Click reset link → reset-password page renders with token in URL
- [ ] Submit new password → success message; redirect to login
- [ ] Login with new password → success
- [ ] Login with old password → 401 (old sessions revoked)
- [ ] Click expired reset link → error state displayed
- [ ] Click already-used reset link → error state displayed
- [ ] Submit unknown email → same generic sent message (no enumeration)
- [ ] Request reset more than 5 times in an hour (same email) → 429

Rate limiting:
- [ ] login: 11th request in 60s from same IP → 429
- [ ] register: 6th request in 60s from same IP → 429
- [ ] email/verify/resend: 4th request in 1h from same email → 429
- [ ] password-reset/request: 6th request in 1h from same email → 429

Security:
- [ ] Raw token never appears in api-gateway logs
- [ ] /me response includes emailVerified field after verification
- [ ] Logout after password reset → 401 (session already revoked)
```

### 12.8 Targeted validation commands (C2F)

```powershell
# TypeScript check
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit

# Targeted auth tests
Set-Location "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPattern="auth.service|email.module|email.provider|auth.controller" --runInBand

# Frontend build
Set-Location "C:\Users\knlee\aiSandBox2026B\frontend"; npm run build

# Frontend tests
Set-Location "C:\Users\knlee\aiSandBox2026B\frontend"; npm test -- --testPathPattern="forgot-password|reset-password|login|register"
```

---

## 13. Risks and Open Questions

| Item | Severity | Status | Resolution |
|---|---|---|---|
| **`@nestjs/throttler` custom per-email key API** | MEDIUM | Open | Verify `getTracker()` override is the correct extension point in v6. If not supported, implement email-keyed rate limiting as a simple in-memory `Map<email, {count, windowStart}>` within the service method as a v1 fallback. Redis-backed throttler can upgrade this later. Confirm at C2D stage-start. |
| **`APP_BASE_URL` absent in test environment** | LOW | Resolved in spec | `EMAIL_PROVIDER=stub` is used in tests. Link-building code must handle missing `APP_BASE_URL` gracefully in stub mode (can log a warning or use a default of `http://localhost:4000`). Add startup check. |
| **`StubEmailProvider` for tests** | LOW | Resolved in spec | Defined in Section 3.4. Selected via `EMAIL_PROVIDER=stub`. All Jest tests must set this. |
| **`email_verified` default false for existing users** | LOW | Acceptable (pre-production) | All existing email/password users will appear unverified after C2C migration. They can still log in (per spec). Optional backfill out of scope. Document as carry-forward in C2C checkpoint. |
| **`email_verified` backfill for existing OAuth users** | LOW | Out of scope | Existing Google/Apple users will have `email_verified = false` after migration. Optional backfill: `UPDATE users SET email_verified = true WHERE auth_provider IN ('google', 'apple')`. Recommend at C2C deployment time; out of scope for the slice itself. |
| **Resend SDK install compatibility** | LOW | Open | Resend v4+ ships its own TypeScript types. Verify compatibility with NestJS 10 / TypeScript 5.3 at C2B install. If type conflicts arise, use `as any` casts locally in `ResendEmailProvider` only. |
| **Unauthenticated resend endpoint design** | DESIGN | Decided | `POST /api/auth/email/verify/resend` is unauthenticated with `{ email }` body. Rationale: more user-friendly (works after tab close). Rate-limited per email (3/hr). Documented in Section 6.3. |
| **Register endpoint user-exists enumeration risk** | LOW | Future hardening | `AuthService.register()` currently returns 401 "User already exists" when email is taken. This is a mild enumeration risk. Out of scope for C2A–C2F. Flag as a future hardening item in C2F checkpoint. |
| **Transactional email domain / DNS setup** | MEDIUM | Operations prerequisite | `AUTH_EMAIL_FROM` (e.g. `noreply@aisandbox.app`) requires domain verification and DKIM/SPF/DMARC DNS records configured in the Resend dashboard. This is an operations task, not a code task. Must be completed before production deployment. Document in C2B checkpoint. |
| **Apple private relay email and verification** | LOW | Resolved in spec | Apple private-relay addresses (`@privaterelay.appleid.com`) are set to `emailVerified = true` at creation. No verification email is ever sent to a relay address. Documented in Section 5.4 and Section 6.5. |
| **Password reset locale selection** | LOW | Resolved in spec | Locale is stored in `verification_tokens.locale` at token generation time (from `Accept-Language` header). The backend uses this stored locale to build the redirect URL in the reset email. See Section 5.2 (locale column). |
| **`authService.register()` does not issue session** | DESIGN | Confirmed | By design: register does not set `aisandbox_session` cookie. User must log in after verifying (or without verifying, since unverified login is allowed). No change to this behavior in C2C. |

---

## Reference

- `docs/AUTH-APP-01-SPEC.md` — governing decisions; Sections 7, 10.2, 12 directly govern this spec
- `docs/AUTH-APP-01-CHECKPOINT.md` — family summary; AUTH-APP-01C2 gate documented in Section 3
- `docs/AUTH-APP-01H-CHECKPOINT.md` — security hardening context; rate limiting and CSRF patterns established here
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2A
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2A
- `services/api-gateway/src/auth/auth.service.ts` — existing SHA-256/randomBytes pattern
- `services/api-gateway/src/auth/auth.controller.ts` — existing throttle/guard patterns
- `services/api-gateway/src/entities/verification-token.entity.ts` — existing token entity
- `services/api-gateway/src/entities/user.entity.ts` — entity to be extended with `emailVerified`
- `services/api-gateway/.env.example` — to be extended in C2B
