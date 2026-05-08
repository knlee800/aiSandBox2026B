# AUTH-APP-01C2B Checkpoint — Email Provider Foundation with Resend Adapter

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2B |
| Title | Email Provider Foundation with Resend Adapter |
| Family | AUTH |
| Parent | AUTH-APP-01C2 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND — email provider abstraction; Resend adapter; module wiring; no auth routes, no DB migration |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 12) |
| Depends on | AUTH-APP-01C2A (COMPLETE and LOCKED) |

---

## Objective

Install `resend` as the v1 transactional email dependency; create the `EmailProvider` abstraction layer, `StubEmailProvider` (no-op for local/test), and `ResendEmailProvider` (Resend SDK adapter); create `EmailModule` with a provider factory that validates required env vars at startup; wire `AuthModule` and `AuthService` to depend on the abstraction; document all email env vars in `.env.example`. No auth business logic, no new routes, no DB migration, no frontend changes.

---

## Files Changed

| File | Action |
|---|---|
| `services/api-gateway/package.json` | Modified — `resend` added to `dependencies` |
| `services/api-gateway/.env.example` | Modified — email env var block appended |
| `services/api-gateway/src/email/email-provider.interface.ts` | **Created** — `EmailProvider` interface + `EMAIL_PROVIDER` symbol |
| `services/api-gateway/src/email/stub-email.provider.ts` | **Created** — `StubEmailProvider` no-op implementation |
| `services/api-gateway/src/email/resend-email.provider.ts` | **Created** — `ResendEmailProvider` v1 Resend adapter |
| `services/api-gateway/src/email/email.module.ts` | **Created** — `EmailModule` with factory provider |
| `services/api-gateway/src/email/__tests__/email.module.spec.ts` | **Created** — factory and env validation unit tests |
| `services/api-gateway/src/email/__tests__/resend-email.provider.spec.ts` | **Created** — `ResendEmailProvider` unit tests with mocked SDK |
| `services/api-gateway/src/auth/auth.module.ts` | Modified — `EmailModule` added to `imports` |
| `services/api-gateway/src/auth/auth.service.ts` | Modified — `@Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider` added to constructor |
| `services/api-gateway/src/auth/auth.service.spec.ts` | Modified — minimal `EMAIL_PROVIDER` DI mock added (test-only; no behavior change) |

**Production source files with behavior changes:** `auth.module.ts` and `auth.service.ts` (wiring only — no auth business logic changed).

---

## Dependency Added

| Package | Version | Notes |
|---|---|---|
| `resend` | `^6.12.3` | Added to `dependencies` in `services/api-gateway/package.json`. Ships bundled TypeScript types; no `@types/resend` needed. CJS build used (project is `"module": "commonjs"`). Transitive: `postal-mime`, `svix`. |

**Lockfile note:** `services/api-gateway/package-lock.json` was generated locally and is git-ignored in this repo (monorepo root lockfile convention confirmed in `docs/AUTH-APP-01H2-CHECKPOINT.md`). Not part of the tracked change set.

---

## EmailProvider Abstraction Summary

**File:** `src/email/email-provider.interface.ts`

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

- `text` is an optional plain-text fallback field — included now to avoid a future breaking change.
- `EMAIL_PROVIDER` is a `Symbol`-based NestJS DI token. All consumer code depends only on this abstraction, never on the Resend SDK directly.
- Future provider switch (SES, SendGrid): add a new class implementing `EmailProvider` + a new branch in the factory — no auth service, controller, or route changes required.

---

## StubEmailProvider Summary

**File:** `src/email/stub-email.provider.ts`

- Implements `EmailProvider`.
- `sendEmail` is an intentional no-op: resolves without sending any email and without making any network calls.
- Does not log email body, HTML, text, or token URLs — only safe metadata would be logged if a logger were needed.
- Selected when `EMAIL_PROVIDER=stub` (or `EMAIL_PROVIDER` is not set — the factory defaults to `'stub'`).
- Used in all Jest test suites. Unblocks all tests that would otherwise require `RESEND_API_KEY`.

---

## ResendEmailProvider Summary

**File:** `src/email/resend-email.provider.ts`

- Implements `EmailProvider`.
- Uses `import { Resend } from 'resend'` — the CJS build is resolved correctly by Node/ts-jest.
- Constructor performs startup validation:
  - Throws `'RESEND_API_KEY is required when EMAIL_PROVIDER=resend'` if `RESEND_API_KEY` is absent.
  - Throws `'AUTH_EMAIL_FROM is required when EMAIL_PROVIDER=resend'` if `AUTH_EMAIL_FROM` is absent.
  - Process fails at bootstrap rather than silently at first send attempt.
- `sendEmail` maps options to `this.client.emails.send(...)`:
  - `from`: `AUTH_EMAIL_FROM`
  - `to`, `subject`, `html` from options
  - `text` included only when provided
  - `replyTo` (camelCase) included only when `AUTH_EMAIL_REPLY_TO` is set — **note:** SDK v6 uses `replyTo`, not `reply_to`
- Throws `'Failed to send email via Resend: <message>'` when `result.error` is non-null.
- No secrets, token URLs, or email body content appear in any log output.
- Resend SDK is fully mocked in tests — no real network calls in any test suite.

---

## EmailModule Factory / Env Validation Summary

**File:** `src/email/email.module.ts`

- `EmailModule` exports `EMAIL_PROVIDER` token.
- Factory (`emailProviderFactory`) runs at NestJS bootstrap:
  1. Validates `APP_BASE_URL` is present for **all** provider modes. Throws `'APP_BASE_URL is required for email auth'` if absent. Required now so that link-building code added in C2C fails fast at startup rather than at send time.
  2. Reads `EMAIL_PROVIDER` env var (trims, lowercases, defaults to `'stub'`).
  3. `stub` → `new StubEmailProvider()`
  4. `resend` → `new ResendEmailProvider()` (constructor validates its own keys)
  5. Unknown value → throws `'Unknown EMAIL_PROVIDER: "<value>". Supported values: "stub" and "resend".'`
- No `ConfigModule` dependency; no TypeORM dependency. Leaf module — no circular dependency risk.
- `AppModule` does not need to import `EmailModule` directly; `AuthModule` handles the import chain.

---

## AuthModule / AuthService Wiring Summary

**`src/auth/auth.module.ts`:**
- Added `EmailModule` to `imports` array.
- `EMAIL_PROVIDER` token is now available to all providers declared inside `AuthModule`.

**`src/auth/auth.service.ts`:**
- Added `@Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider` as the fourth constructor parameter.
- Added `Inject` to the `@nestjs/common` import and added the import for `EMAIL_PROVIDER` / `EmailProvider` from `../email/email-provider.interface`.
- `emailProvider` field is declared but not yet called in any method — correct for C2B. C2C wires the first actual usage.
- TypeScript does not flag unused class properties; no lint errors.

**`src/auth/auth.service.spec.ts`:**
- Added `{ provide: EMAIL_PROVIDER, useValue: mockEmailProvider }` to `providers` in `Test.createTestingModule(...)`.
- `mockEmailProvider = { sendEmail: jest.fn().mockResolvedValue(undefined) }`.
- No test behavior was changed; this is the minimum DI fix required by the new constructor parameter.

---

## Env Documentation Summary

**`services/api-gateway/.env.example` additions (appended):**

```bash
# Email auth provider (AUTH-APP-01C2B)
# Set EMAIL_PROVIDER=resend in production.
# EMAIL_PROVIDER=stub is for local/test only and never sends real emails.
EMAIL_PROVIDER=stub

# Resend provider settings (required when EMAIL_PROVIDER=resend)
# AUTH_EMAIL_FROM must be a verified sender/domain in Resend for production.
# Never commit real API keys.
RESEND_API_KEY=
AUTH_EMAIL_FROM=
APP_BASE_URL=http://localhost:3000
AUTH_EMAIL_REPLY_TO=
```

**Operations prerequisite (not a code task):** `AUTH_EMAIL_FROM` (e.g. `noreply@aisandbox.app`) requires domain verification with DKIM/SPF/DMARC records configured in the Resend dashboard before production deployment.

---

## Tests Added / Updated

| File | Action | Tests |
|---|---|---|
| `src/email/__tests__/email.module.spec.ts` | **Created** | 6 tests — default stub, explicit stub, resend selection, unknown provider throw, missing `APP_BASE_URL` throw, `StubEmailProvider.sendEmail` resolves |
| `src/email/__tests__/resend-email.provider.spec.ts` | **Created** | 8 tests — missing `RESEND_API_KEY` throw, missing `AUTH_EMAIL_FROM` throw, valid construction, `emails.send` payload, optional `text`, `replyTo` present, `replyTo` absent, SDK error throw |
| `src/auth/auth.service.spec.ts` | Modified | No new behavior tests — minimal `EMAIL_PROVIDER` DI mock added to fix existing 10 tests broken by new constructor parameter |

**Total email tests:** 14 (2 suites). All tests use mocked/stub providers — no real network calls.

---

## Validation Commands and Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` (from `services/api-gateway`) | **PASS** — zero errors |
| `npx jest --testPathPatterns="email\.(module\|provider)" --runInBand` | **PASS** — 2 suites, 14 tests |
| `npx jest --testPathPatterns="auth\." --runInBand` (initial) | FAIL — `Symbol(EMAIL_PROVIDER)` not available in `RootTestModule` (expected; DI fix required) |
| Minimal DI mock applied to `auth.service.spec.ts` | — |
| `npx jest --testPathPatterns="auth\." --runInBand` (re-run) | **PASS** — 2 suites, 20 tests |
| `ReadLints` on all changed source paths | **PASS** — no linter errors |

---

## Non-Goals Confirmed

- No email verification routes (`GET /api/auth/email/verify`, `POST /api/auth/email/verify/resend`) — C2C
- No password reset routes (`POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm`) — C2D
- No DB migrations — C2C adds `email_verified` on `users` and `locale` on `verification_tokens`
- No entity changes — C2C
- No frontend changes — C2E
- No email templates (beyond payload shape tested in unit tests) — C2C/C2D
- No SES or SendGrid implementation — adapter-only future tasks
- No real email sent in any test

---

## Risks / Invariants Preserved

| Item | Status |
|---|---|
| `EmailProvider` abstraction boundary | PRESERVED — no auth service method references `Resend` SDK directly; all calls go through the token |
| No secrets in source | CONFIRMED — `.env.example` uses empty placeholder values; no keys hardcoded anywhere |
| `RESEND_API_KEY` git-exclusion | CONFIRMED — `.gitignore` excludes `.env*`; `.env.example` contains only empty placeholders |
| `replyTo` camelCase (SDK v6 correction) | APPLIED — spec code used `reply_to` (snake_case); implementation correctly uses `replyTo` |
| Existing auth tests unbroken | CONFIRMED — all 20 auth tests pass after minimal DI mock |
| `APP_BASE_URL` startup validation | CONFIRMED — factory throws at bootstrap if absent; prevents silent runtime failure when C2C link-building code is added |
| Lockfile convention | PRESERVED — `package-lock.json` is git-ignored at service level; consistent with `docs/AUTH-APP-01H2-CHECKPOINT.md` note |
| No circular module dependency | CONFIRMED — `EmailModule` is a leaf module with no upstream NestJS module dependencies |

---

## AUTH-APP-01C2 Parent Status

**ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B COMPLETE and LOCKED; AUTH-APP-01C2C PLANNED (next stage)**

---

## Next Recommended Task

**AUTH-APP-01C2C — Email Verification Backend Flow**

C2C prerequisites satisfied by C2B:
- `EmailModule` is wired and exports `EMAIL_PROVIDER`
- `AuthService` constructor accepts `emailProvider` — ready for first usage
- `StubEmailProvider` is in place — all C2C tests can run without `RESEND_API_KEY`
- `APP_BASE_URL` validation is enforced — startup will fail fast if link-building config is missing

C2C deliverables (from spec Section 11):
- Migration: `email_verified BOOLEAN NOT NULL DEFAULT false` on `users`
- Migration: `locale varchar(10) NOT NULL DEFAULT 'en'` on `verification_tokens`
- Entity updates: `user.entity.ts` and `verification-token.entity.ts`
- `AuthModule` adds `VerificationToken` to `TypeOrmModule.forFeature([...])`
- `AuthService` methods: `generateAndStoreVerificationToken`, `validateAndConsumeToken`, `sendVerificationEmail`, `resendEmailVerification`
- `register()` updated to generate token and send verification email
- `findOrCreateGoogleUser()` and `findOrCreateAppleUser()` updated to set `emailVerified: true`
- `getUserById()` updated to include `emailVerified` in response
- `GET /api/auth/email/verify` and `POST /api/auth/email/verify/resend` routes
- Unit tests for all new `AuthService` methods

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — governing spec for entire C2 family
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` — C2A spec-only checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2B
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2B
