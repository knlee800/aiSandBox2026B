# AUTH-APP-01C2A Checkpoint — Email Verification / Password Reset Spec + Provider Abstraction Plan

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2A |
| Title | Email Verification / Password Reset Spec + Provider Abstraction Plan |
| Family | AUTH |
| Parent | AUTH-APP-01C2 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | SPEC AND DOCUMENTATION ONLY — no production source files changed |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 12) |
| Depends on | AUTH-APP-01C2 unblocked (Resend chosen — DONE) |

---

## Objective

Define the complete design for AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting — before any implementation begins. This slice covers the EmailProvider abstraction, Resend v1 adapter boundary, future provider migration path, DB/token requirements, backend route plan, frontend UX plan, security rules, env vars, tests plan, and child-slice boundaries. No production source code is written or modified in this slice.

---

## Files Changed

| File | Action |
|---|---|
| `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` | **Created** — full implementation spec (13 sections) |
| `docs/AUTH-APP-01C2A-CHECKPOINT.md` | **Created** — this file |
| `TASKS.md` | Updated — AUTH-APP-01C2A COMPLETE and LOCKED; stage advanced to AUTH-APP-01C2B |
| `TASKS_BACKLOG_FULL.md` | Updated — same status changes; full backlog preserved |

**Production source files changed: None.**

---

## Spec Document

**`docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md`** — all 13 sections confirmed:

| Section | Title |
|---|---|
| 1 | Purpose and Scope |
| 2 | Current Repo / Auth State |
| 3 | Provider Abstraction Design |
| 4 | Env Var Plan |
| 5 | DB / Entity Requirements |
| 6 | Email Verification Flow |
| 7 | Password Reset Flow |
| 8 | Backend Route Plan |
| 9 | Frontend UX / i18n Plan |
| 10 | Security Rules |
| 11 | Child-Slice Boundary Plan |
| 12 | Tests / Validation Plan |
| 13 | Risks and Open Questions |

---

## Provider Abstraction Decisions

| Decision | Detail |
|---|---|
| `EmailProvider` interface | `sendEmail({ to, subject, html, text? }): Promise<void>` — `text` included for plain-text fallback |
| `EMAIL_PROVIDER` injection token | `Symbol('EMAIL_PROVIDER')` — NestJS DI token; auth service depends only on this abstraction |
| `ResendEmailProvider` | v1 implementation wrapping Resend SDK (`resend` npm); injected only here — never in auth business logic |
| `StubEmailProvider` | No-op provider for `EMAIL_PROVIDER=stub`; resolves without sending; used in all Jest tests |
| `EmailModule` factory | `useFactory` reads `EMAIL_PROVIDER` env var; throws on unknown provider; defaults to `stub` |
| Auth service dependency | `@Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider` — abstraction only |
| Future SES switch | Add `SesEmailProvider` class + branch in factory; no auth logic changes |
| Future SendGrid switch | Add `SendGridEmailProvider` class + branch in factory; no auth logic changes |

---

## Env Var Plan

| Variable | Required | Description |
|---|---|---|
| `EMAIL_PROVIDER` | Yes | `resend` for production; `stub` for tests/dev |
| `RESEND_API_KEY` | Yes when `EMAIL_PROVIDER=resend` | Resend API key; never committed to git |
| `AUTH_EMAIL_FROM` | Yes | From address; must be verified in Resend dashboard |
| `APP_BASE_URL` | Yes | Base URL for verification/reset links; no trailing slash |
| `AUTH_EMAIL_REPLY_TO` | Optional | Reply-to override for auth emails |

`.env.example` additions are a C2B deliverable. Startup validation: `ResendEmailProvider` constructor throws if `RESEND_API_KEY` or `AUTH_EMAIL_FROM` are absent.

---

## DB / Entity Requirements

| Item | Status |
|---|---|
| `verification_tokens` table | Exists — sufficient; no structural changes needed |
| `auth_sessions` table | Exists — `revokeAllUserSessions()` will use it in C2D |
| `users.email_verified` column | **Missing — add in C2C:** `email_verified BOOLEAN NOT NULL DEFAULT false` |
| `verification_tokens.locale` column | **Missing — add in C2C:** `locale varchar(10) NOT NULL DEFAULT 'en'` (for post-verification redirect locale) |
| OAuth user `emailVerified` default | C2C: `findOrCreateGoogleUser()` and `findOrCreateAppleUser()` set `emailVerified: true` at creation |
| Existing email/password users | Default `false` after migration; login still allowed per spec; banner UX deferred |

---

## Email Verification Flow Decisions

| Decision | Detail |
|---|---|
| Token generation | `randomBytes(32).toString('base64url')` — 43-char, 256-bit entropy |
| Token storage | SHA-256 hash stored in `verification_tokens.token_hash`; raw token only in email |
| Token type | `'email_verify'` |
| Token TTL | 24 hours |
| One-time use | `used_at` set on consumption; reuse returns generic error |
| Old token invalidation | All prior unused tokens for `(userId, 'email_verify')` marked `used_at = NOW()` before new token |
| Register behavior | No session issued on register; verification email sent via `emailProvider.sendEmail()` |
| Verification endpoint | `GET /api/auth/email/verify?token=<raw>` — public; marks `email_verified=true`; sets `used_at`; redirects to `/${locale}/login?verified=1` |
| Invalid/expired token | Redirects to `/${locale}/login?error=token_expired` |
| Locale preservation | Stored in `verification_tokens.locale` at generation time (from `Accept-Language` header) |
| Resend endpoint | `POST /api/auth/email/verify/resend` — **unauthenticated**; body `{ email }`; always `200` (anti-enumeration); 3/hr per email |
| Login for unverified | Allowed; `emailVerified` returned in `GET /api/auth/me`; feature-gating deferred |
| OAuth users | `emailVerified = true` at creation; no verification email sent |

---

## Password Reset Flow Decisions

| Decision | Detail |
|---|---|
| Request endpoint | `POST /api/auth/password-reset/request` — public; body `{ email }`; always `200` (anti-enumeration) |
| Token type | `'password_reset'` |
| Token TTL | 1 hour |
| Old token invalidation | All prior unused `password_reset` tokens for user invalidated before new token |
| Reset link | `${APP_BASE_URL}/${locale}/reset-password?token=${rawToken}` |
| Confirm endpoint | `POST /api/auth/password-reset/confirm` — body `{ token, newPassword }` |
| Confirm processing | Validate hash/type/expiry/unused → `bcrypt.hash(newPassword, 12)` → update `password_hash` → mark `used_at` → revoke all sessions |
| Session revocation | `AuthService.revokeAllUserSessions(userId)` — new method; revokes all active `auth_sessions` rows |
| Password validation | ≥ 6 characters; consistent with `RegisterDto` constraint |
| Anti-enumeration | Request endpoint: always `200` regardless of email existence |

---

## Backend Route Plan

| Route | Method | Auth | CsrfGuard | Throttle |
|---|---|---|---|---|
| `/api/auth/email/verify` | GET | Public | No | None (token entropy) |
| `/api/auth/email/verify/resend` | POST | Public | No | 3/hr per email (custom key) |
| `/api/auth/password-reset/request` | POST | Public | No | 5/hr/email + 10/hr/IP (dual-key) |
| `/api/auth/password-reset/confirm` | POST | Public | No | None |

**CSRF note:** All four routes are public (no session cookie). `CsrfGuard` does not apply. This matches the existing public endpoint list in `docs/AUTH-APP-01-SPEC.md` Section 10.2.

**Rate limiting strategy:** Custom `EmailThrottlerGuard` extending `@nestjs/throttler`'s `ThrottlerGuard` with `getTracker()` override to extract email from `request.body.email`. Fallback: in-service Map-based counter if throttler API does not cleanly support custom keys. Confirm at C2D stage-start.

---

## Frontend / i18n Plan

**New pages:** `frontend/app/[locale]/forgot-password/page.tsx`, `frontend/app/[locale]/reset-password/page.tsx`

**Updated pages:** `login/page.tsx` (forgot-password link, `?verified=1` banner, `?error=token_expired` banner), `register/page.tsx` (updated success copy, optional resend verification button)

**No new `/verify-email` frontend page needed.** Backend `GET /api/auth/email/verify` redirects to login with query params.

**i18n keys added to all 3 locales** (`en.json`, `zh-TW.json`, `zh-CN.json`):
- `register.successMessage` (updated)
- `register.resendVerification`
- `register.verificationResent`
- `login.forgotPassword`, `login.resetIt`, `login.emailVerified`
- `forgotPassword.*` (new namespace)
- `resetPassword.*` (new namespace)
- `errors.tokenExpired`, `errors.verificationExpired`

**Dead keys not touched:** `login.testCredentials`, `register.name` — pre-existing carry-forwards.

---

## Security Rules (summary)

- Raw tokens never stored; SHA-256 hash only
- Raw tokens never logged; log userId and type only
- Token entropy: 32 bytes (`randomBytes(32)`) = 256 bits
- TTLs: email_verify 24h; password_reset 1h
- One-time use via `used_at`; old tokens invalidated on resend/re-request
- Anti-enumeration on resend and password reset request (always 200)
- Password reset revokes all active sessions
- Password min length: 6 chars; bcrypt cost: 12
- No CSRF on the four new public routes
- No real secrets in git; `.env.example` has placeholders only

---

## Child-Slice Boundary Summary

| Slice | Nature | Key dependency |
|---|---|---|
| **C2B** | Backend — provider foundation | No DB change; no auth routes |
| **C2C** | Backend — email verification | Depends on C2B |
| **C2D** | Backend — password reset | Depends on C2B; C2C independent |
| **C2E** | Frontend — email UX | Depends on C2C + C2D endpoints |
| **C2F** | Validation + consolidation | Depends on C2B–C2E complete |

---

## Validation

| Check | Result |
|---|---|
| `git status` — no production source files changed | PASS — only `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` (new), `TASKS.md` and `TASKS_BACKLOG_FULL.md` (governance) |
| All 13 required spec sections present | PASS — confirmed via `Select-String` pattern match |
| No code tests run | Correct — this is docs-only; no source code to test |
| No production source files changed | CONFIRMED |
| No checkpoint pre-existed | Confirmed — this file is created during consolidation |

---

## Non-Goals Confirmed

- No Resend npm dependency installed
- No backend implementation written
- No frontend implementation written
- No DB migration created
- No email templates created
- No SES/SendGrid implementation
- No manual smoke test run
- No AUTH-APP-01Z rewrite

---

## Risks / Open Questions

| Risk | Severity | Resolution |
|---|---|---|
| `@nestjs/throttler` custom per-email key API | MEDIUM | Verify `getTracker()` override at C2D stage-start; fallback is in-service Map counter |
| `APP_BASE_URL` absent in test environment | LOW | `EMAIL_PROVIDER=stub` default; add startup default of `http://localhost:4000` for stub mode |
| `email_verified` default false for existing users | LOW | Pre-production; acceptable; backfill OAuth users optional at C2C deploy time |
| Resend SDK TypeScript compatibility | LOW | Verify at C2B install; local `as any` fallback if type conflicts |
| Unauthenticated resend endpoint | DESIGN | Decided — body `{ email }`, 3/hr/email; see Section 6.3 of spec |
| Register user-exists enumeration | LOW | Carry-forward; out of C2A–C2F scope; flag in C2F checkpoint |
| Email domain / DNS setup | MEDIUM | Operations prerequisite; document in C2B checkpoint |
| Apple private relay + verification | LOW | Resolved — OAuth users created with `emailVerified=true`; no email sent |

---

## AUTH-APP-01C2 Parent Status

**ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B PLANNED (next stage)**

---

## Next Recommended Task

**AUTH-APP-01C2B — Email Provider Foundation with Resend Adapter**

Stage-start: read this checkpoint and `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` Section 3 before beginning.

C2B deliverables:
- Install `resend` npm package
- `src/email/email-provider.interface.ts`
- `src/email/resend-email.provider.ts`
- `src/email/stub-email.provider.ts`
- `src/email/email.module.ts`
- `AuthModule` imports `EmailModule`; `AuthService` injects `EmailProvider`
- `services/api-gateway/.env.example` email env vars added
- Startup validation for `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `APP_BASE_URL`
- Unit tests for `EmailModule` factory and `StubEmailProvider`

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — governing spec for entire C2 family
- `docs/AUTH-APP-01-SPEC.md` — master auth spec; Sections 7 and 12 govern this slice
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary; AUTH-APP-01C2 gate documented
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2A
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2A
