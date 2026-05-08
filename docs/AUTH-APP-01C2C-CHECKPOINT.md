# AUTH-APP-01C2C Checkpoint — Email Verification Backend Flow

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2C |
| Title | Email Verification Backend Flow |
| Family | AUTH |
| Parent | AUTH-APP-01C2 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND — DB migration, entity updates, AuthService logic, controller routes, DTO, throttle guard, unit tests |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 10.2, 12) |
| Depends on | AUTH-APP-01C2B (COMPLETE and LOCKED) |

---

## Objective

Implement the full email verification backend flow, including:
- Database columns and migration for `users.email_verified` and `verification_tokens.locale`
- Entity updates reflecting both new columns
- AuthService token generation, validation, consumption, resend, and mark-verified logic
- Registration updated to send verification email
- OAuth user creation updated to set `emailVerified = true`
- `/me` endpoint updated to return `emailVerified`
- `GET /api/auth/email/verify` and `POST /api/auth/email/verify/resend` controller routes
- Per-email throttle guard for the resend route
- Targeted unit tests for all new logic

No frontend work, no password reset, no C2D scope included.

---

## Implementation Slices

| Slice | Nature | Deliverable |
|---|---|---|
| **C2C1** | DB foundation | Migration + entity field additions |
| **C2C2** | Service logic | All `AuthService` email verification methods + test file |
| **C2C3** | Routes + throttle | Controller routes, DTO, `EmailThrottlerGuard`, module wiring, controller tests |

---

## Files Changed

| File | Action |
|---|---|
| `services/api-gateway/src/migrations/1771701000000-AddEmailVerificationColumns.ts` | **Created** — migration |
| `services/api-gateway/src/entities/user.entity.ts` | Modified — `emailVerified: boolean` added |
| `services/api-gateway/src/entities/verification-token.entity.ts` | Modified — `locale: string` added |
| `services/api-gateway/src/auth/auth.service.ts` | Modified — VerificationToken repo injection + 6 new methods + 3 updated methods |
| `services/api-gateway/src/auth/auth.service.spec.ts` | Modified — VerificationToken repo mock added; Google/Apple `create` expectations updated |
| `services/api-gateway/src/auth/auth.module.ts` | Modified — `EmailThrottlerGuard` added to providers |
| `services/api-gateway/src/auth/auth.controller.ts` | Modified — register locale, `GET /email/verify`, `POST /email/verify/resend` |
| `services/api-gateway/src/auth/dto/auth.dto.ts` | Modified — `ResendVerificationDto` added |
| `services/api-gateway/src/auth/email-throttler.guard.ts` | **Created** — `EmailThrottlerGuard` |
| `services/api-gateway/src/auth/__tests__/auth.service.verify.spec.ts` | **Created** — 13 targeted service tests |
| `services/api-gateway/src/auth/auth.controller.spec.ts` | **Created** — 4 targeted controller tests |

**Production source files with no changes:** all entities/migrations from prior slices, frontend, email module files.

---

## Migration / Entity Summary

### Migration — `1771701000000-AddEmailVerificationColumns.ts`

Class: `AddEmailVerificationColumns1771701000000`

`up()`:
```sql
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "verification_tokens"
ADD COLUMN IF NOT EXISTS "locale" character varying(10) NOT NULL DEFAULT 'en';
```

`down()`:
```sql
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified";
ALTER TABLE "verification_tokens" DROP COLUMN IF EXISTS "locale";
```

### Entity — `user.entity.ts`

Added after `isActive`:
```typescript
@Column({ type: 'boolean', name: 'email_verified', default: false })
emailVerified: boolean;
```

### Entity — `verification-token.entity.ts`

Added after `usedAt`:
```typescript
@Column({ type: 'varchar', length: 10, default: 'en' })
locale: string;
```

**Default for existing rows:** `email_verified = false` for all existing users. Existing OAuth users (`auth_provider IN ('google', 'apple')`) will show `false` until optionally backfilled. Pre-production; carry-forward noted.

---

## AuthService Logic Summary

**Constructor:** Added `@InjectRepository(VerificationToken)` — fifth parameter, before `emailProvider`.

**New private helper:**
- `hashToken(raw)` — SHA-256 hex digest; used by token generation and session token hashing

**New public methods:**

| Method | Behavior |
|---|---|
| `generateAndStoreVerificationToken(userId, type, ttlMs, locale)` | Generates `randomBytes(32).toString('base64url')` raw token; stores SHA-256 hash + metadata; returns raw token only. Raw token never stored. |
| `sendVerificationEmail(email, rawToken, locale)` | Builds `${APP_BASE_URL}/api/auth/email/verify?token=...&locale=...`; calls `emailProvider.sendEmail()` with subject/html/text. No token logging. |
| `validateAndConsumeToken(rawToken, type)` | Hashes token; queries WHERE `token_hash, type, used_at IS NULL, expires_at > NOW()`; loads `user` relation; throws `UnauthorizedException` if not found/inactive; sets `usedAt = new Date()`; returns `{ userId, locale }`. |
| `markEmailVerified(userId)` | Updates `users.email_verified = true`. |
| `resendEmailVerification(email, locale)` | Normalizes email; returns silently if user not found, already verified, or inactive; invalidates prior unused tokens; generates new 24h token; sends email. |

**Updated existing methods:**

| Method | Change |
|---|---|
| `register(email, password, locale = 'en')` | Added `locale` param; after save: generates 24h token and sends verification email. Return shape unchanged. |
| `getUserById(id)` | Added `'emailVerified'` to `select`; added `emailVerified` to return object. |
| `findOrCreateGoogleUser()` | New user `create` call includes `emailVerified: true`. |
| `findOrCreateAppleUser()` | Both new user paths (private relay + normal) include `emailVerified: true`. |

**Security compliance:**
- Raw tokens never stored (only SHA-256 hash)
- Raw tokens never logged
- `resendEmailVerification` never throws for unknown/verified/inactive — no user enumeration
- Token entropy: 256-bit (`randomBytes(32)`)
- TTL: 24h for `email_verify`

---

## AuthController / DTO / Throttle Summary

### DTO — `ResendVerificationDto`

```typescript
export class ResendVerificationDto {
  @IsEmail()
  email: string;
}
```

### EmailThrottlerGuard — `email-throttler.guard.ts`

- Extends `ThrottlerGuard` from `@nestjs/throttler`
- Overrides `getTracker(req: Request): Promise<string>`
- Tracker: `req.body.email?.trim().toLowerCase()` when present; falls back to `req.ip || 'unknown'`
- No Redis; uses existing in-memory throttle store

### Updated route — `POST /auth/register`

- Now reads `Accept-Language` header
- Derives locale via `getLanguageFromHeader()`
- Passes locale to `authService.register(email, password, locale)`

### New route — `GET /auth/email/verify`

| Property | Value |
|---|---|
| Path | `GET /auth/email/verify` |
| Auth | Public — no `SessionCookieGuard`, no `CsrfGuard` |
| Query params | `token: string`, `locale?: string` |
| Success | `validateAndConsumeToken` → `markEmailVerified` → redirect `/${result.locale}/login?verified=1` |
| Invalid/expired/used | Redirect `/${normalizeLocale(locale ?? 'en')}/login?error=token_expired` |
| Missing token | Redirect to same error path |
| Token logging | None |

### New route — `POST /auth/email/verify/resend`

| Property | Value |
|---|---|
| Path | `POST /auth/email/verify/resend` |
| Auth | Public — no `SessionCookieGuard`, no `CsrfGuard` |
| Guard | `@UseGuards(EmailThrottlerGuard)` |
| Throttle | `@Throttle({ default: { limit: 3, ttl: 3600000 } })` — 3/hr per email |
| Body | `ResendVerificationDto { email }` |
| Response | Always `200` with generic message regardless of email existence |
| Anti-enumeration | Confirmed — never reveals user existence |

### AuthModule

`EmailThrottlerGuard` added to `providers` for NestJS DI resolution at the route.

---

## Tests Added / Updated

### New — `src/auth/__tests__/auth.service.verify.spec.ts` (13 tests)

- `generateAndStoreVerificationToken` stores hash (not raw); returns 43-char base64url token
- `validateAndConsumeToken` valid → returns `{ userId, locale }` and consumes token (sets `usedAt`)
- `validateAndConsumeToken` invalid/expired/used → throws `UnauthorizedException`
- `validateAndConsumeToken` inactive user → throws `UnauthorizedException`
- `resendEmailVerification` unknown email → silent return, no email
- `resendEmailVerification` already verified → silent return, no email
- `resendEmailVerification` inactive user → silent return, no email
- `resendEmailVerification` known unverified → invalidates old token, generates new, sends email
- `register` → generates token and sends email with correct locale
- `findOrCreateGoogleUser` new user → `emailVerified: true`
- `findOrCreateAppleUser` new normal user → `emailVerified: true`
- `findOrCreateAppleUser` relay user → `emailVerified: true`
- `getUserById` → response includes `emailVerified`

### New — `src/auth/auth.controller.spec.ts` (4 tests)

- `register` passes locale into `authService.register`
- `GET /email/verify` success → redirects to `/en/login?verified=1`
- `GET /email/verify` invalid → redirects to `/en/login?error=token_expired`
- `POST /email/verify/resend` → generic message; calls `resendEmailVerification(email, locale)`

### Updated — `src/auth/auth.service.spec.ts`

- Added `VerificationToken` repository mock (`create`, `save`, `findOne`, `update`)
- Updated Google new-user `create` assertion to include `emailVerified: true`
- Updated Apple relay new-user `create` assertion to include `emailVerified: true`
- Updated Apple normal new-user `create` assertion to include `emailVerified: true`
- All 10 existing tests preserved and passing

---

## Final Validation Results

All commands run from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** — zero errors |
| `npx jest --testPathPatterns="auth\.service\.verify\|auth\.service\.spec\|auth\.controller" --runInBand` | **PASS** — 3 suites, 27 tests |
| `npx jest --testPathPatterns="email\.(module\|provider)" --runInBand` | **PASS** — 2 suites, 14 tests |

**Total: 5 suites, 41 tests — all passing.**

---

## Non-Goals Confirmed

- No frontend changes (deferred to AUTH-APP-01C2E)
- No password reset backend (deferred to AUTH-APP-01C2D)
- No C2D or C2E scope included
- No SES/SendGrid implementation
- No manual smoke test run
- No email template work beyond minimal verification body
- No Redis-backed throttler
- No governance/checkpoint update performed mid-slice

---

## Risks / Carry-Forwards

| Item | Severity | Notes |
|---|---|---|
| Existing OAuth users have `email_verified = false` post-migration | LOW | Pre-production; acceptable. Optional backfill: `UPDATE users SET email_verified = true WHERE auth_provider IN ('google', 'apple')`. Recommend at migration execution time; out of scope for C2C. |
| DB migration not executed against live DB | INFORMATIONAL | `npx typeorm migration:run` must be executed explicitly in the target environment. Not a code issue. |
| Resend/verification UX (frontend banners, register success copy) | DEFERRED | Planned for AUTH-APP-01C2E. `emailVerified` is now returned in `/me` for future banner use. |
| Password reset flow | DEFERRED | AUTH-APP-01C2D. `resendEmailVerification` and `validateAndConsumeToken` are designed to be reused by C2D for `password_reset` type. |
| `EmailThrottlerGuard` v6 `getTracker` signature verified | LOW | Implemented as `protected async getTracker(req: Request): Promise<string>` — confirmed compatible by `npx tsc --noEmit` PASS. |
| Manual smoke checklist | DEFERRED | Awaits live Docker/PostgreSQL/Resend environment. Part of AUTH-APP-01C2F consolidation. |

---

## AUTH-APP-01C2 Parent Status

**ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B COMPLETE and LOCKED; AUTH-APP-01C2C COMPLETE and LOCKED; AUTH-APP-01C2D PLANNED (next stage)**

---

## Next Recommended Task

**AUTH-APP-01C2D — Password Reset Backend Flow**

C2D prerequisites satisfied by C2C:
- `validateAndConsumeToken(rawToken, type)` reusable for `'password_reset'` type
- `VerificationToken` repository already injected in `AuthService`
- `EmailProvider` wired and working
- `EmailThrottlerGuard` already created — reusable for password reset request route
- `verification_tokens.locale` column supports post-reset redirect locale

C2D deliverables (from spec Section 11):
- `AuthService.sendPasswordResetEmail(email, rawToken, locale)`
- `AuthService.requestPasswordReset(email, locale)`
- `AuthService.confirmPasswordReset(rawToken, newPassword)`
- `AuthService.revokeAllUserSessions(userId)`
- `POST /api/auth/password-reset/request` with dual throttle (email + IP)
- `POST /api/auth/password-reset/confirm`
- Unit tests for all new `AuthService` methods
- Controller integration tests

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — governing spec for entire C2 family
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` — C2A spec-only checkpoint
- `docs/AUTH-APP-01C2B-CHECKPOINT.md` — C2B email provider foundation checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2C
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2C
