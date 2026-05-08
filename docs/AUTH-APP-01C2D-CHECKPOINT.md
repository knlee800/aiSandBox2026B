# AUTH-APP-01C2D Checkpoint — Password Reset Backend Flow

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2D |
| Title | Password Reset Backend Flow |
| Family | AUTH |
| Parent | AUTH-APP-01C2 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND — AuthService password reset methods, controller routes, DTOs, targeted unit tests |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 10.2, 12) |
| Depends on | AUTH-APP-01C2C (COMPLETE and LOCKED) |

---

## Objective

Implement the full password reset backend flow, including:

- `AuthService.requestPasswordReset()` — invalidates prior tokens, generates 1-hour token, sends reset email
- `AuthService.confirmPasswordReset()` — validates token, hashes new password, updates `users.password_hash`, revokes all active sessions
- `AuthService.revokeAllUserSessions()` — bulk revocation of `auth_sessions` rows by `userId`
- Private `AuthService.sendPasswordResetEmail()` — builds reset URL, calls `EmailProvider`
- `POST /api/auth/password-reset/request` — public, email-throttled, generic anti-enumeration response
- `POST /api/auth/password-reset/confirm` — public, unthrottled, returns success or 400
- `PasswordResetRequestDto` and `PasswordResetConfirmDto`
- Targeted unit tests for all new service and controller behavior

No frontend work, no DB migration, no entity changes, no email verification logic changes.

---

## Files Changed

| File | Action |
|---|---|
| `services/api-gateway/src/auth/auth.service.ts` | Modified — added 4 new methods |
| `services/api-gateway/src/auth/auth.controller.ts` | Modified — added 2 new routes + BadRequestException import |
| `services/api-gateway/src/auth/dto/auth.dto.ts` | Modified — added 2 new DTOs |
| `services/api-gateway/src/auth/__tests__/auth.service.reset.spec.ts` | **Created** — 7 targeted service tests |
| `services/api-gateway/src/auth/auth.controller.spec.ts` | Modified — 4 new controller tests added |

**Production source files with no changes:** all entities, all migrations, all email provider files, all OAuth strategy files, all frontend files.

---

## AuthService Password Reset Summary

**Constructor:** No changes. `verificationTokenRepository`, `authSessionRepository`, and `emailProvider` were all already injected from C2C.

**New private method:**

| Method | Behavior |
|---|---|
| `sendPasswordResetEmail(email, rawToken, locale)` | Builds `${APP_BASE_URL}/${locale}/reset-password?token=...`; calls `emailProvider.sendEmail()` with subject `Reset your password — AI Sandbox` and minimal HTML/text content. Throws if `APP_BASE_URL` absent. Raw token and URL never logged. |

**New public methods:**

| Method | Behavior |
|---|---|
| `requestPasswordReset(email, locale)` | Normalizes email (trim/lowercase); returns silently if empty/user not found/inactive; invalidates unused `password_reset` tokens via `verificationTokenRepository.update({ userId, type, usedAt: IsNull() }, { usedAt: now })`; generates 1h token via `generateAndStoreVerificationToken(..., 'password_reset', 3600000, locale)`; sends email via `sendPasswordResetEmail()`. Never throws for unknown/inactive users — anti-enumeration preserved. |
| `confirmPasswordReset(rawToken, newPassword)` | Throws `BadRequestException` if `newPassword.length < 6` before any DB access; delegates to `validateAndConsumeToken(rawToken, 'password_reset')` (which marks token used and throws `UnauthorizedException` if invalid/expired/used/inactive); hashes new password with `bcrypt.hash(newPassword, 12)`; updates `userRepository` with new `passwordHash`; calls `revokeAllUserSessions(userId)`. |
| `revokeAllUserSessions(userId)` | `authSessionRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() })` — revokes all active sessions for the user. |

**Security invariants preserved:**

- Raw tokens never stored (only SHA-256 hash in `verification_tokens.token_hash`)
- Raw tokens never logged
- Anti-enumeration: `requestPasswordReset` always returns void (controller always returns generic 200)
- Token consumption: `validateAndConsumeToken` marks `usedAt` before returning. If password update subsequently fails, token is already consumed; user must request a new reset link. Accepted as per spec.
- Password hashing cost factor: `bcrypt` rounds = 12, consistent with `AuthService.register()`
- Session revocation: all active `auth_sessions` rows for the user are revoked immediately after password update

---

## AuthController Route Summary

**`POST /auth/password-reset/request`**

| Property | Value |
|---|---|
| Path | `POST /auth/password-reset/request` |
| Auth | Public — no `SessionCookieGuard`, no `CsrfGuard` |
| Guard | `@UseGuards(EmailThrottlerGuard)` |
| Throttle | `@Throttle({ default: { limit: 5, ttl: 3600000 } })` — 5/hr keyed by email |
| Locale | From `Accept-Language` header via `getLanguageFromHeader()` |
| Response | Always `200`: `{ message: 'If that email is registered, a password reset link has been sent.' }` |

**`POST /auth/password-reset/confirm`**

| Property | Value |
|---|---|
| Path | `POST /auth/password-reset/confirm` |
| Auth | Public — no guards |
| Throttle | None (token entropy sufficient per spec Section 7.2) |
| Success | `200`: `{ message: 'Password reset successfully. Please sign in with your new password.' }` |
| Invalid/expired token | `UnauthorizedException` from service is caught and rethrown as `BadRequestException`: `Reset link is invalid or has expired. Please request a new one.` |
| Short password | `BadRequestException` from service propagates directly as `400` |

---

## DTO Summary

Added to `services/api-gateway/src/auth/dto/auth.dto.ts`:

```typescript
export class PasswordResetRequestDto {
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
```

`MinLength(6)` on `newPassword` mirrors `RegisterDto.password` constraint exactly.

---

## Tests Added / Updated

### New — `src/auth/__tests__/auth.service.reset.spec.ts` (7 tests)

- `requestPasswordReset` unknown email → silent return, no email sent
- `requestPasswordReset` inactive user → silent return, no email sent
- `requestPasswordReset` valid active user → invalidates prior `password_reset` tokens; calls `generateAndStoreVerificationToken` with correct args; calls `emailProvider.sendEmail` with correct subject, to, and reset URL in html/text
- `confirmPasswordReset` valid token → token consumed via `validateAndConsumeToken`; `userRepository.update` called with hashed password (bcrypt-verifiable); `authSessionRepository.update` called with `revokedAt`
- `confirmPasswordReset` invalid/expired token → throws `UnauthorizedException`; no user or session update
- `confirmPasswordReset` password shorter than 6 → throws `BadRequestException` before token lookup (`verificationTokenRepository.findOne` not called)
- `revokeAllUserSessions` → `authSessionRepository.update` called with `{ userId }` and `{ revokedAt: Date }`

### Updated — `src/auth/auth.controller.spec.ts` (4 tests added, 4 existing preserved)

- `POST password-reset/request` returns generic message and calls `requestPasswordReset(email, locale)` with correct locale from `Accept-Language`
- `POST password-reset/request` preserves generic 200 behavior when service no-ops (unknown email path)
- `POST password-reset/confirm` valid → returns success message
- `POST password-reset/confirm` `UnauthorizedException` from service → rethrown as `BadRequestException` with correct message

---

## Validation Commands and Results

All commands run from `C:\Users\knlee\aiSandBox2026B\services\api-gateway`:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** — zero errors |
| `npx jest --testPathPatterns="auth\.service\.reset" --runInBand` | **PASS** — 1 suite, 7 tests |
| `npx jest --testPathPatterns="auth\.service\.verify\|auth\.service\.spec\|auth\.controller" --runInBand` | **PASS** — 3 suites, 31 tests |
| `npx jest --testPathPatterns="auth\.service\.(reset\|verify\|spec)\|auth\.controller" --runInBand` | **PASS** — 4 suites, 38 tests |

**Total: 4 suites, 38 tests — all passing.**

C2C regression confirmed: all 13 verify-spec tests and 10 main service-spec tests continue to pass.

---

## Non-Goals Confirmed

- No frontend changes (deferred to AUTH-APP-01C2E)
- No DB migration (all required columns added in C2C: `verification_tokens.locale`, `users.email_verified`, `auth_sessions.revokedAt` was pre-existing)
- No entity changes
- No email verification logic changes
- No SES/SendGrid implementation
- No Redis-backed throttler
- No manual smoke test run (deferred to AUTH-APP-01C2F)
- No governance/checkpoint work in the implementation phase

---

## Carry-Forwards / Open Items

| Item | Severity | Notes |
|---|---|---|
| Independent `10/hr/IP` secondary limit for password-reset/request | LOW | Not independently enforced in C2D v1. Current `EmailThrottlerGuard` enforces 5/hr keyed by email; when no email is present, falls back to IP at 5/hr. The spec's full dual-key requirement (5/hr/email **and** 10/hr/IP independently) requires named throttler config or Redis-backed throttler. Carry-forward for a future rate-limit hardening slice. |
| Frontend forgot-password/reset-password pages | DEFERRED | AUTH-APP-01C2E. Reset email links (`/${locale}/reset-password?token=...`) are valid but the pages do not exist until C2E. |
| Manual smoke checklist | DEFERRED | AUTH-APP-01C2F. Requires live Docker/PostgreSQL/Resend environment. |
| OAuth-only user password reset side-effect | INFORMATIONAL | `requestPasswordReset` will generate a token for any active user regardless of `authProvider`. `confirmPasswordReset` sets `passwordHash` on an OAuth-only account, effectively adding email/password sign-in to that account. No spec restriction on this. Documented for awareness. |

---

## AUTH-APP-01C2 Parent Status

**ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B COMPLETE and LOCKED; AUTH-APP-01C2C COMPLETE and LOCKED; AUTH-APP-01C2D COMPLETE and LOCKED; AUTH-APP-01C2E PLANNED (next stage)**

---

## Next Recommended Task

**AUTH-APP-01C2E — Frontend Auth Email UX**

C2E prerequisites satisfied by C2C + C2D:
- `GET /api/auth/email/verify` route working (C2C)
- `POST /api/auth/email/verify/resend` route working (C2C)
- `POST /api/auth/password-reset/request` route working (C2D)
- `POST /api/auth/password-reset/confirm` route working (C2D)
- Login redirects to `?verified=1` and `?error=token_expired` working (C2C)

C2E deliverables (from spec Section 11):
- `frontend/app/[locale]/forgot-password/page.tsx` — new page
- `frontend/app/[locale]/reset-password/page.tsx` — new page
- Login page: "Forgot your password?" link + `?verified=1` success banner + `?error=token_expired` banner
- Register page: updated success copy + optional resend verification button
- i18n keys for all three locales (`en.json`, `zh-TW.json`, `zh-CN.json`)

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — governing spec for C2 family (Section 7: password reset flow; Section 8: route plan; Section 10: security rules; Section 12.4: C2D tests)
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` — C2A spec checkpoint
- `docs/AUTH-APP-01C2B-CHECKPOINT.md` — C2B email provider foundation checkpoint
- `docs/AUTH-APP-01C2C-CHECKPOINT.md` — C2C email verification checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2D
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2D
