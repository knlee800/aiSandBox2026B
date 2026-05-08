# AUTH-APP-01C2 Family Checkpoint — Email Verification / Password Reset / Rate Limiting

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2 |
| Title | Email Verification / Password Reset / Rate Limiting |
| Family | AUTH |
| Parent | AUTH-APP-01 (VALIDATION COMPLETE) |
| Status | VALIDATION COMPLETE — manual smoke deferred |
| Nature | Multi-slice family: spec → backend provider → backend verification → backend reset → frontend UX → validation |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 10.2, 12) |
| Provider decision | Resend selected as v1 transactional email provider (2026-05-08) |

---

## Slice Summary

| Slice | Title | Nature | Status | Checkpoint |
|---|---|---|---|---|
| AUTH-APP-01C2A | Spec + Provider Abstraction Plan | Spec / docs only | COMPLETE and LOCKED | `docs/AUTH-APP-01C2A-CHECKPOINT.md` |
| AUTH-APP-01C2B | Email Provider Foundation | Backend — provider module + Resend adapter | COMPLETE and LOCKED | `docs/AUTH-APP-01C2B-CHECKPOINT.md` |
| AUTH-APP-01C2C | Email Verification Backend | Backend — migration, entities, service, routes | COMPLETE and LOCKED | `docs/AUTH-APP-01C2C-CHECKPOINT.md` |
| AUTH-APP-01C2D | Password Reset Backend | Backend — service, routes, throttle | COMPLETE and LOCKED | `docs/AUTH-APP-01C2D-CHECKPOINT.md` |
| AUTH-APP-01C2E | Frontend Auth Email UX | Frontend — pages, banners, i18n, tests | COMPLETE and LOCKED | `docs/AUTH-APP-01C2E-CHECKPOINT.md` |
| AUTH-APP-01C2F | Validation + Consolidation | Validation / governance | COMPLETE and LOCKED | `docs/AUTH-APP-01C2F-CHECKPOINT.md` |

---

## Provider Abstraction Summary

**Design principle:** Auth business logic depends only on the `EmailProvider` abstraction. No auth service, controller, or module may import or reference the Resend SDK directly.

### `EmailProvider` interface

File: `services/api-gateway/src/email/email-provider.interface.ts`

- Interface: `sendEmail({ to, subject, html, text? }): Promise<void>`
- Injection token: `EMAIL_PROVIDER` (Symbol)

### `EmailModule` factory

File: `services/api-gateway/src/email/email.module.ts`

- Selects provider via `EMAIL_PROVIDER` env var at startup
- `EMAIL_PROVIDER=resend` → instantiates `ResendEmailProvider`
- `EMAIL_PROVIDER=stub` → instantiates `StubEmailProvider` (no-op)
- Unknown value → throws immediately at startup
- `AuthModule` imports `EmailModule`; `AuthService` injects via `@Inject(EMAIL_PROVIDER)`

### Future provider migration path

To add SES, SendGrid, or any other provider:
1. Create a new provider class implementing `EmailProvider`
2. Add a `case` branch to the `emailProviderFactory` in `EmailModule`
3. Add required env vars to `.env.example`
4. Set `EMAIL_PROVIDER=<new>` in deployment environment

No auth service, controller, or business logic file changes required.

---

## Resend v1 + StubEmailProvider Summary

### `ResendEmailProvider`

File: `services/api-gateway/src/email/resend-email.provider.ts`

- Wraps `resend@^6.12.3` (ships bundled TypeScript types; no `@types/resend` needed)
- Reads `RESEND_API_KEY` (required) and `AUTH_EMAIL_FROM` (required) at construction; throws if absent
- Reads `AUTH_EMAIL_REPLY_TO` (optional); sets `reply_to` if present
- `sendEmail()` calls `this.client.emails.send()` with `from`, `to`, `subject`, `html`, optional `text`, optional `reply_to`

### `StubEmailProvider`

File: `services/api-gateway/src/email/stub-email.provider.ts`

- No-op implementation; logs debug line only; never sends real email
- Used in all Jest test environments via `EMAIL_PROVIDER=stub`
- `RESEND_API_KEY` is not required when using stub

### Dependency

| Package | Version | Notes |
|---|---|---|
| `resend` | `^6.12.3` | In `services/api-gateway/package.json`. `services/api-gateway/package-lock.json` is git-ignored per monorepo convention. |

---

## Email Verification Backend Summary (C2C)

### New DB objects

| Object | Details |
|---|---|
| Migration | `1771701000000-AddEmailVerificationColumns.ts` |
| `users.email_verified` | `BOOLEAN NOT NULL DEFAULT false` — `false` for new email/password users; `true` for OAuth users at creation |
| `verification_tokens.locale` | `varchar(10) NOT NULL DEFAULT 'en'` — stored at token generation time for post-verification redirect |

### New `AuthService` methods

| Method | Behavior |
|---|---|
| `generateAndStoreVerificationToken(userId, type, ttlMs, locale)` | Generates `randomBytes(32).toString('base64url')` raw token; stores SHA-256 hash in `verification_tokens`; returns raw token |
| `validateAndConsumeToken(rawToken, type)` | Validates hash, type, expiry, `used_at IS NULL`, user active; marks `used_at = NOW()`; returns `{ userId, locale }` |
| `sendVerificationEmail(email, rawToken, locale)` | Calls `emailProvider.sendEmail()` with verification link: `${APP_BASE_URL}/api/auth/email/verify?token=...&locale=...` |
| `resendEmailVerification(email, locale)` | Normalizes email; invalidates prior unused tokens; generates new; sends; no-op for unknown/verified/inactive users |
| `register()` updated | Now generates verification token and sends email after user creation; does not issue session |
| `findOrCreateGoogleUser()` updated | Sets `emailVerified: true` at creation |
| `findOrCreateAppleUser()` updated | Sets `emailVerified: true` at creation (including private-relay addresses) |
| `getUserById()` updated | Returns `emailVerified` in `/me` response |

### New controller routes

| Route | Auth | Throttle | Behavior |
|---|---|---|---|
| `GET /api/auth/email/verify` | Public | None (token entropy) | Validates token; redirects to `/${locale}/login?verified=1` or `/${locale}/login?error=token_expired` |
| `POST /api/auth/email/verify/resend` | Public | `EmailThrottlerGuard` 3/hr/email | Calls `resendEmailVerification`; always returns `200` generic message |

### `EmailThrottlerGuard`

File: `services/api-gateway/src/auth/email-throttler.guard.ts`

Extends `ThrottlerGuard`; overrides `getTracker()` to return `request.body.email ?? request.ip`. Enables per-email rate limiting without Redis.

---

## Password Reset Backend Summary (C2D)

### New `AuthService` methods

| Method | Behavior |
|---|---|
| `sendPasswordResetEmail(email, rawToken, locale)` | Builds `${APP_BASE_URL}/${locale}/reset-password?token=...`; calls `emailProvider.sendEmail()`. Raw token never logged. |
| `requestPasswordReset(email, locale)` | Normalizes email; invalidates prior `password_reset` tokens; generates 1h token; sends email. Silent for unknown/inactive users (anti-enumeration). |
| `confirmPasswordReset(rawToken, newPassword)` | Validates `newPassword.length >= 6`; calls `validateAndConsumeToken`; hashes with `bcrypt` rounds=12; updates `users.password_hash`; calls `revokeAllUserSessions`. |
| `revokeAllUserSessions(userId)` | `authSessionRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() })` — revokes all active sessions. |

### New controller routes

| Route | Auth | Throttle | Behavior |
|---|---|---|---|
| `POST /api/auth/password-reset/request` | Public | `EmailThrottlerGuard` 5/hr/email | Calls `requestPasswordReset`; always returns `200` generic message |
| `POST /api/auth/password-reset/confirm` | Public | None | Calls `confirmPasswordReset`; returns `200` on success; `400` on invalid/expired/short-password |

### New DTOs

- `PasswordResetRequestDto` — `@IsEmail() email: string`
- `PasswordResetConfirmDto` — `@IsString() token: string`; `@IsString() @MinLength(6) newPassword: string`

---

## Frontend Email UX Summary (C2E)

### New pages

| File | Behavior |
|---|---|
| `frontend/app/[locale]/forgot-password/page.tsx` | Email form → `POST /api/auth/password-reset/request` → generic success state. Anti-enumeration: all responses treated as success. |
| `frontend/app/[locale]/reset-password/page.tsx` | Reads `?token=` via `useSearchParams()`; client-side validation (length ≥ 6, passwords match); `POST /api/auth/password-reset/confirm`; success / error states. Token never in log. |

### Updated pages

| File | Changes |
|---|---|
| `frontend/app/[locale]/login/page.tsx` | `OAuthErrorBanner` renamed to `AuthStatusBanner`; handles `?verified=1` (green), `?error=token_expired` (red), existing `?error=account_conflict` and generic OAuth errors; forgot-password link added |
| `frontend/app/[locale]/register/page.tsx` | Updated success copy; `registeredEmail` state captured; resend verification button calls `POST /api/auth/email/verify/resend`; shows "Verification email resent." on success |

### i18n

All keys added to all three locale files: `en.json`, `zh-TW.json`, `zh-CN.json`.

New namespaces: `forgotPassword`, `resetPassword`
Updated namespaces: `login` (3 keys), `register` (3 keys), `errors` (2 keys)

Untouched dead keys: `login.testCredentials`, `register.name` (pre-existing carry-forwards from AUTH-APP-01Z).

### Tests added (C2E)

| File | Tests |
|---|---|
| `frontend/components/public/login.test.tsx` | 5 tests |
| `frontend/components/public/register.test.tsx` | 1 test (full flow) |
| `frontend/components/public/forgot-password.test.tsx` | 2 tests |
| `frontend/components/public/reset-password.test.tsx` | 5 tests |
| **Total new** | **13 tests** |

---

## Security Invariants

| Invariant | Implementation |
|---|---|
| **Raw tokens never stored** | Only SHA-256 hash stored in `verification_tokens.token_hash`. Raw token exists only in the email link. |
| **Raw tokens never logged** | No `Logger` call includes a raw token. Only `userId` and token `type` are logged. |
| **SHA-256 token hashes** | `createHash('sha256').update(rawToken).digest('hex')` — 256-bit entropy; 43-char base64url raw token. |
| **One-time use via `used_at`** | `used_at` is set on first consumption. Any subsequent use returns a generic invalid error. |
| **Token invalidation on resend / re-request** | All prior unused tokens for `(user_id, type)` marked `used_at = NOW()` before new token is generated. |
| **Email verification TTL: 24h** | `expiresAt = now() + 24h`. Expired tokens produce `token_expired` redirect. |
| **Password reset TTL: 1h** | `expiresAt = now() + 1h`. Expired tokens produce `400` error. |
| **Anti-enumeration — generic responses** | `POST /email/verify/resend` always returns `200`. `POST /password-reset/request` always returns `200`. Response does not reveal whether email exists or is verified. |
| **Sessions revoked after password reset** | `revokeAllUserSessions(userId)` called immediately after `confirmPasswordReset` succeeds. All active `auth_sessions` rows revoked. |
| **Password hashing** | `bcrypt.hash(newPassword, 12)` — same cost factor as `AuthService.register()`. |
| **OAuth users pre-verified** | `findOrCreateGoogleUser` and `findOrCreateAppleUser` set `emailVerified: true` at creation. No verification email sent. |
| **Apple private relay** | `@privaterelay.appleid.com` addresses set `emailVerified: true`; no third-party email sent. |
| **Unverified login allowed** | Email/password users may sign in without verifying. `emailVerified` returned in `/me` for future banner display. Feature-gating deferred. |
| **No CSRF on public token endpoints** | All four new routes are public (no session cookie). `CsrfGuard` not applied per spec. |
| **RESEND_API_KEY not committed** | Empty in `.env.example`; gitignored `.env` file for real values. |

---

## Validation Summary (C2F)

### Backend

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** — zero errors |
| email.module + resend-email.provider (2 suites) | **PASS** — 14 tests |
| auth.service.verify (1 suite) | **PASS** — 13 tests |
| auth.service.reset (1 suite) | **PASS** — 7 tests |
| auth.service.spec (1 suite) | **PASS** — 10 tests |
| auth.controller (1 suite) | **PASS** — 8 tests |
| **Total targeted backend** | **6 suites, 52 tests — all PASS** |
| Full `npm test` (Redis blocker) | NOT RUN |
| Migration runtime validation | NOT RUN (requires live PostgreSQL) |

### Frontend

| Check | Result |
|---|---|
| `npm run build` | **PASS** — zero errors; both new routes compiled |
| `npx tsc --noEmit` | **PASS** — zero errors |
| `npm test` | **PASS** — 269 tests, 26 suites, 0 failed, 0 skipped |
| `tsconfig.tsbuildinfo` | Already clean; restore confirmed |

---

## Manual Smoke Status

**NOT RUN — deferred to live environment.**

Requires: Docker + PostgreSQL + Redis + api-gateway (with `1771701000000-AddEmailVerificationColumns.ts` migration applied) + frontend dev server + Resend account with a verified sender domain for `AUTH_EMAIL_FROM`.

26-item checklist documented in `docs/AUTH-APP-01C2F-CHECKPOINT.md`. AUTH-APP-01C2 will be promoted to COMPLETE and LOCKED when all 26 items pass.

---

## Operational Prerequisites for Production

| Prerequisite | Owner | Notes |
|---|---|---|
| Resend account with verified sender domain | Operations | `AUTH_EMAIL_FROM` domain requires DKIM/SPF/DMARC DNS records configured in Resend dashboard. Without this, transactional emails will not deliver. |
| Live environment for manual smoke | Engineering / Operations | Docker + PostgreSQL + Redis + api-gateway + frontend + Resend configured. Run 26-item checklist before any user-facing deployment. |
| `RESEND_API_KEY` in production secrets | Operations | Never commit. Use environment secrets manager or deployment-time injection. |
| `APP_BASE_URL` set to production domain | Operations | Used to construct all verification and reset links. Must match the deployed frontend URL. |
| DB migration applied at deployment | Engineering | `1771701000000-AddEmailVerificationColumns.ts` must run before api-gateway starts. |
| Backfill for pre-C2 OAuth users (optional) | Engineering | `UPDATE users SET email_verified = true WHERE auth_provider IN ('google', 'apple')` — prevents existing OAuth users from seeing unverified state. Low priority for pre-production. |

---

## Carry-Forwards

| Item | Severity | Notes |
|---|---|---|
| **Manual smoke deferred** | MEDIUM | 26-item checklist. Operational prerequisite for production. |
| **Independent 10/hr/IP rate limit for password-reset/request** | LOW | Only 5/hr/email enforced (via `EmailThrottlerGuard`). Independent IP-keyed limit not implemented. Future hardening slice. |
| **Resend domain/DNS setup** | OPERATIONS | Required before production email delivery. |
| **package-lock.json gitignored** | INFORMATIONAL | `services/api-gateway/package-lock.json` git-ignored per monorepo root lockfile convention. |
| **api-gateway lint baseline** | LOW | 353 pre-existing errors in `services/api-gateway`. Not from C2. Separate cleanup slice. |
| **Full backend `npm test` Redis blocker** | LOW | Targeted suite approach required. Full suite not run. |
| **Preview proxy `/api/preview/*`** | MEDIUM | Auth-forwarding investigation required. Separate from C2. Carry-forward from AUTH-APP-01H. |
| **`email_verified` backfill for pre-C2 OAuth users** | LOW | `email_verified = false` for existing OAuth users after migration. Optional backfill. |
| **Dead i18n keys** | LOW | `login.testCredentials`, `register.name` — pre-existing from AUTH-APP-01Z. Leave untouched per spec. |
| **Register endpoint user-exists enumeration** | LOW | `AuthService.register()` returns `401` "User already exists". Minor enumeration risk. Future hardening slice. |

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — full governing spec for C2 family
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` — spec/docs checkpoint
- `docs/AUTH-APP-01C2B-CHECKPOINT.md` — email provider foundation checkpoint
- `docs/AUTH-APP-01C2C-CHECKPOINT.md` — email verification backend checkpoint
- `docs/AUTH-APP-01C2D-CHECKPOINT.md` — password reset backend checkpoint
- `docs/AUTH-APP-01C2E-CHECKPOINT.md` — frontend email UX checkpoint
- `docs/AUTH-APP-01C2F-CHECKPOINT.md` — validation + consolidation checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` → AUTH-APP-01C2
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2
