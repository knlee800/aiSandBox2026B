# PRIVATE-BETA-STAGING-EXECUTION-04I3 — Email Verification Delivery Investigation

**Task ID:** PRIVATE-BETA-STAGING-EXECUTION-04I3  
**Title:** Email Verification Delivery Blocker  
**Status:** ACTIVE — Step 2 COMPLETE (Investigation — 2026-08-04)  
**Parent:** PRIVATE-BETA-STAGING-EXECUTION-04I  
**Date:** 2026-08-04  
**Step:** 2 — Safe Source/Config Investigation  
**Author:** Cursor / Sonnet 4.6 (local source analysis only, no runtime action)

---

## 1. Task ID / Title / Status

| Field | Value |
|---|---|
| Task ID | PRIVATE-BETA-STAGING-EXECUTION-04I3 |
| Title | Email Verification Delivery Blocker |
| Status | ACTIVE — Step 1 COMPLETE (Registration), Step 2 COMPLETE (Investigation) |
| Parent | PRIVATE-BETA-STAGING-EXECUTION-04I |
| Registered | 2026-08-04 |

---

## 2. Browser Smoke Evidence (from 04I)

| Path | Result | Notes |
|---|---|---|
| Path A | **PASS** | `https://staging.ainow.biz` → `https://staging.ainow.biz/en` — no localhost — HTTPS lock valid — `/en` loads |
| Path B | **PASS** | `https://staging.ainow.biz/en/login` — page loads — HTTPS lock valid — no localhost — no errors |
| Path C | **PASS** | `https://staging.ainow.biz/en/register` — page loads — HTTPS lock valid — no localhost — no errors |
| Path D | **BLOCKED** | Registration submitted with staging test email — URL after submit `https://staging.ainow.biz/en/register` — UI showed EMAIL VERIFICATION REQUIRED — redirected to authenticated area: NO — Google OAuth used: NO — verification email did not arrive |

---

## 3. Files Searched / Read

### Governance files (read targeted sections only)
- `TASKS.md` — 04I3 entry (grep by task ID)
- `docs/AINOW-EXECUTION-ROADMAP.md` — 04I3 entry (grep by task ID)

### Source files read
- `services/api-gateway/src/auth/auth.service.ts`
- `services/api-gateway/src/auth/auth.controller.ts`
- `services/api-gateway/src/email/email.module.ts`
- `services/api-gateway/src/email/email-provider.interface.ts`
- `services/api-gateway/src/email/resend-email.provider.ts`
- `services/api-gateway/src/email/stub-email.provider.ts`
- `services/api-gateway/src/email/__tests__/email.module.spec.ts`
- `services/api-gateway/src/entities/verification-token.entity.ts`
- `services/api-gateway/src/migrations/1771701000000-AddEmailVerificationColumns.ts`
- `services/api-gateway/.env.example`
- `frontend/app/[locale]/register/page.tsx`
- `frontend/app/[locale]/login/page.tsx`
- `frontend/messages/en.json` (targeted grep)
- `services/api-gateway/src/auth/authorization.guard.ts`
- `services/api-gateway/src/startup/startup-failfast.integration.spec.ts` (header only)

### Files excluded (per safe-search rules)
- All `.env*` files — not opened, not printed
- `node_modules/`, `.next/`, `.git/`, `coverage/`, `dist/`, `build/`

---

## 4. Registration / Auth Flow Map

```
Browser: POST /api/auth/register
    ↓
Caddy reverse proxy (staging.ainow.biz/api/* → 127.0.0.1:4000)
    ↓
AuthController.register()          [auth.controller.ts:150-162]
  - Rate-limited: 5 req / 60s (ThrottlerGuard)
  - Reads Accept-Language header → locale
    ↓
AuthService.register(email, password, locale)   [auth.service.ts:521-560]
  1. Check for existing user (throws 401 if exists)
  2. bcrypt.hash(password, 12) → passwordHash
  3. userRepository.create({email, passwordHash, authProvider:'email',
       role:'user', planType:'free', isActive:true})
       NOTE: emailVerified is NOT set → defaults to false
  4. userRepository.save(user)
  5. generateAndStoreVerificationToken(userId, 'email_verify', 24h, locale)
  6. sendVerificationEmail(email, rawToken, locale)
  7. return {id, email, role, plan_type}
    ↓
AuthController: HTTP 201 (no session cookie set)
    ↓
Frontend register page:
  - setSuccessMessage("Account created. We've sent a verification email — please check your inbox.")
  - setRegisteredEmail(email)
  - Page stays at /en/register (NOT redirected to /app)
  - "Resend verification email" button appears
```

---

## 5. Email Verification Flow Map

```
AuthService.generateAndStoreVerificationToken()    [auth.service.ts:88-110]
  - randomBytes(32).toString('base64url') → rawToken
  - SHA-256 hash → tokenHash (only hash stored in DB)
  - verificationTokenRepository.create({userId, tokenHash, type:'email_verify',
      expiresAt: now+24h, locale, usedAt: null})
  - verificationTokenRepository.save()
  - returns rawToken (never stored, only sent in email)

AuthService.sendVerificationEmail()               [auth.service.ts:112-129]
  - reads process.env.APP_BASE_URL
  - if !APP_BASE_URL → throws Error('APP_BASE_URL is required for email verification')
  - builds verifyUrl: ${APP_BASE_URL}/api/auth/email/verify?token=${rawToken}&locale=${locale}
  - calls emailProvider.sendEmail({to, subject, html, text})

EmailModule resolution                            [email.module.ts:14-33]
  - reads process.env.EMAIL_PROVIDER ?? 'stub'
  - if EMAIL_PROVIDER = 'stub'  → StubEmailProvider  (NO-OP, never sends)
  - if EMAIL_PROVIDER = 'resend' → ResendEmailProvider (requires RESEND_API_KEY, AUTH_EMAIL_FROM)
  - else throws unknown provider error

Verification click (user clicks link in email):
  GET /api/auth/email/verify?token=...&locale=...
    ↓
  AuthController.verifyEmail()                    [auth.controller.ts:163-184]
    - validateAndConsumeToken(token, 'email_verify')
    - markEmailVerified(userId)
    - redirect to /${locale}/login?verified=1

Login page shows: "Email verified. You can now sign in."
```

---

## 6. Email Provider / Library Identified

| Item | Value |
|---|---|
| Provider abstraction | `EmailProvider` interface (`email-provider.interface.ts`) |
| Production provider | `ResendEmailProvider` — uses **Resend** npm package (`resend`) |
| Stub/no-op provider | `StubEmailProvider` — intentional no-op for local/test |
| Selection mechanism | `process.env.EMAIL_PROVIDER ?? 'stub'` — defaults to stub |
| Resend SDK usage | `new Resend(apiKey).emails.send({from, to, subject, html, ...})` |

---

## 7. Required Environment Variable Names (names only — no values)

| Variable | Required When | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | Always | Must be `resend` for real delivery; defaults to `stub` (no-op) |
| `RESEND_API_KEY` | `EMAIL_PROVIDER=resend` | Resend API authentication key |
| `AUTH_EMAIL_FROM` | `EMAIL_PROVIDER=resend` | Verified sender address/domain in Resend |
| `AUTH_EMAIL_REPLY_TO` | Optional, `EMAIL_PROVIDER=resend` | Reply-to address |
| `APP_BASE_URL` | Always (required at startup) | Base URL for verification link construction |

**Note:** `APP_BASE_URL` must be `https://staging.ainow.biz` in staging for verification links to be externally accessible.

---

## 8. Email Sending: Configured / Disabled / Mocked / Conditional?

### Source evidence

**`email.module.ts` line 19:**
```typescript
const configuredProvider = (process.env.EMAIL_PROVIDER ?? 'stub').trim().toLowerCase();
```

**`.env.example` comment:**
```
# EMAIL_PROVIDER=stub is for local/test only and never sends real emails.
# Set EMAIL_PROVIDER=resend in production.
EMAIL_PROVIDER=stub
```

**`stub-email.provider.ts`:**
```typescript
async sendEmail(_: {...}): Promise<void> {
  // Intentionally no-op in stub mode to prevent network calls in local/test environments.
}
```

### Assessment

- **Default behavior is stub (no-op).** If `EMAIL_PROVIDER` is not explicitly set in staging `.env`, the system silently discards all verification emails.
- The stub always succeeds (returns `void` immediately), so registration completes without error even when no email is sent.
- There is **no startup validation** for email configuration — `EMAIL_PROVIDER` misconfiguration is NOT caught at startup. The startup fail-fast validators do not check email provider variables.
- If `EMAIL_PROVIDER=resend` but `RESEND_API_KEY` or `AUTH_EMAIL_FROM` are missing, the `ResendEmailProvider` constructor throws — this would prevent the API Gateway module from starting. Since the staging API is known to be healthy (health checks pass), this scenario would only apply if the key was present but wrong.

---

## 9. Error Handling / Logging Behavior

| Scenario | Behavior |
|---|---|
| `EMAIL_PROVIDER=stub` | `sendEmail()` is a no-op. No error, no log, no email. Registration succeeds silently. |
| `EMAIL_PROVIDER=resend`, Resend API error | `ResendEmailProvider.sendEmail()` throws `Error('Failed to send email via Resend: ...')`. Propagates up through `sendVerificationEmail()` → `register()` → NestJS global exception filter → HTTP 500. Frontend shows `registerFailed`. |
| `APP_BASE_URL` missing | `sendVerificationEmail()` throws immediately. Registration returns 500. Frontend shows `registerFailed`. |
| `RESEND_API_KEY` or `AUTH_EMAIL_FROM` missing | `ResendEmailProvider` constructor throws at module initialization → API Gateway fails to start entirely. |
| No logging | `auth.service.ts` contains **no Logger calls** around email send. No structured logging of email attempts, successes, or failures. |

### Critical gap
There is no structured logging around email send in `AuthService`. If `EMAIL_PROVIDER=resend` and Resend fails silently (e.g., rate limit, delivery failure at SMTP layer), only Resend's own dashboard would reveal it.

---

## 10. User-Visible Behavior

| State | What User Sees |
|---|---|
| Registration API returns 2xx | Success message: "Account created. We've sent a verification email — please check your inbox." Page stays at `/en/register`. Resend button appears. |
| Registration API returns 5xx | Error message: `t('registerFailed')` = "Registration failed". |
| Email not received (stub or delivery failure) | No additional UI feedback. User sees success message but email never arrives. |
| User tries to resend | `POST /api/auth/email/verify/resend` — same email provider path — same problem recurs if provider is stub. |
| User clicks verification link | `GET /api/auth/email/verify?token=...` → redirect to `/en/login?verified=1` → "Email verified. You can now sign in." |

### Observation from Path D
The URL remaining at `/en/register` after submit and "EMAIL VERIFICATION REQUIRED" state is **correct expected behavior** (not a bug). Registration succeeded; the UI correctly shows the pending-verification state. The problem is that the email was silently discarded.

---

## 11. Findings

1. **Email provider is configurable via `EMAIL_PROVIDER` env var.** Default is `stub`.
2. **`StubEmailProvider` is a guaranteed no-op.** Intentionally designed to never send emails in local/test. Silently succeeds.
3. **No startup guard validates email configuration.** If `EMAIL_PROVIDER` is unset or set to `stub` in staging, the system starts normally and registration flows succeed — but no emails are ever sent.
4. **Token IS generated and stored before email send.** `generateAndStoreVerificationToken()` completes and commits to DB before `sendVerificationEmail()` is called. The verification token exists in the DB even if email is never sent.
5. **No logging around email send.** There is no structured logging in `AuthService.sendVerificationEmail()` or `register()` to record email send attempts or outcomes.
6. **`APP_BASE_URL` must be set correctly.** If not set, `sendVerificationEmail` throws → register returns 500 → user sees `registerFailed`. Since Path D showed success message (not error), `APP_BASE_URL` was either set, or `EMAIL_PROVIDER=stub` ran before the base URL check.
7. **Registration succeeded.** The user saw the success/verification-pending UI state, which means the `POST /api/auth/register` returned 2xx. This proves the email provider did not throw.
8. **Email provider did not throw.** Either `EMAIL_PROVIDER=stub` (no-op) or `EMAIL_PROVIDER=resend` with a successful Resend API call that did not result in delivery.

---

## 12. Most Likely Root Cause Candidates

### Candidate 1 — `EMAIL_PROVIDER=stub` in staging (HIGH CONFIDENCE — most likely)

The default value of `EMAIL_PROVIDER` is `stub`. The `.env.example` explicitly sets it to `stub`. If the staging `.env` was created from `.env.example` or if `EMAIL_PROVIDER` was never explicitly set to `resend`, the system runs with `StubEmailProvider` which silently discards all emails.

**Evidence for:** Registration succeeded (no 500), email never arrived, stub is the default, `.env.example` ships with `stub`.  
**Evidence against:** None from source alone.  
**Risk to rule out:** Low — runtime log check will immediately confirm.

---

### Candidate 2 — `EMAIL_PROVIDER=resend` but `APP_BASE_URL` not set or set to `localhost` (MEDIUM CONFIDENCE)

If `APP_BASE_URL` is missing, `sendVerificationEmail` throws and registration returns 500 (user would see `registerFailed`). However, if `APP_BASE_URL` is set to `http://localhost:3000` (as per `.env.example` default), the verification URL in the email would point to `localhost:3000` — the email would technically be sent, but the link would be unreachable from outside the server.

**Evidence for:** `.env.example` ships with `APP_BASE_URL=http://localhost:3000`. If this default was carried into staging, sent emails (if any) would have broken links.  
**Evidence against:** Registration succeeded → if APP_BASE_URL was missing, would have thrown. If APP_BASE_URL is localhost and provider is resend, email may have been sent but link is broken.  
**Relevance:** Secondary; most important if Candidate 1 is ruled out.

---

### Candidate 3 — `EMAIL_PROVIDER=resend` with valid keys but Resend delivery failure (LOW-MEDIUM CONFIDENCE)

If `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are all correctly set, but:
- The sender domain/address in `AUTH_EMAIL_FROM` is not verified in Resend → Resend API returns error → throws → 500 (would show `registerFailed`)
- The sender is verified but Resend silently dropped delivery (bounced, spam-filtered at recipient) → would appear in Resend dashboard as delivered or bounced
- The test email used is a disposable/blocked domain → Resend may reject or silently drop

**Evidence for:** Email delivery failures at SMTP layer are not surfaced in source.  
**Evidence against:** If Resend API error was thrown, registration would have returned 500, not success. Since success was shown, Resend API call either succeeded or was never made.

---

### Candidate 4 — `RESEND_API_KEY` or `AUTH_EMAIL_FROM` missing with `EMAIL_PROVIDER=resend` (VERY LOW CONFIDENCE)

If missing, `ResendEmailProvider` constructor throws at module startup — API Gateway would refuse to start entirely. Since health checks pass, this is ruled out if `EMAIL_PROVIDER=resend`.

---

## 13. Safe Runtime Evidence Needed Next (Approval-Gated)

All of the following require Keith approval and safe SSH access. No action should be taken until approved.

| Evidence | Command (safe, read-only) | What It Rules In/Out |
|---|---|---|
| **1. API Gateway PM2 log — email startup** | `pm2 logs aisandbox-api --lines 200 --nostream` (filter for `EMAIL_PROVIDER`, `EmailModule`, `stub`, `resend`) | Confirms which provider was loaded at startup |
| **2. API Gateway PM2 log — registration event** | Search logs for the timestamp when Path D registration was submitted | Confirms 201 response and any email errors |
| **3. Staging `.env` email variable names only** | `grep -E "^(EMAIL_PROVIDER\|RESEND_API_KEY\|AUTH_EMAIL_FROM\|APP_BASE_URL\|AUTH_EMAIL_REPLY_TO)=" /opt/aisandbox/.env` (names + set/unset status only, no values) | Definitively confirms which provider and whether vars are set |
| **4. Resend dashboard check** | Manual browser check of Resend dashboard → sent/failed emails for staging test address | Confirms if email reached Resend or was never sent |
| **5. DB verification token row** | `SELECT id, user_id, type, expires_at, used_at, locale FROM verification_tokens ORDER BY created_at DESC LIMIT 5;` (no token_hash column) | Confirms token was stored; rules out DB write failure |

---

## 14. Stop Conditions

The following must NOT proceed until email delivery is confirmed working end-to-end:

| Blocked Work | Reason |
|---|---|
| Path D completion (registration → verification → login → /app) | Requires verified email delivery |
| 04I COMPLETE and LOCKED | Blocked by Path D |
| PRIVATE-BETA-DEPLOYMENT-READINESS COMPLETE | Blocked by 04I |
| Any user-facing registration enablement for private beta | Email verification is required for account activation |

---

## 15. Recommended Next Step

**Step 3 — Approval-gated safe runtime/log/env diagnosis**

1. Keith reviews this investigation report.
2. Keith approves targeted safe SSH read-only commands (runtime evidence items 1–3 above).
3. Execute safe runtime checks to determine whether `EMAIL_PROVIDER=stub` or `EMAIL_PROVIDER=resend`.
4. If `EMAIL_PROVIDER=stub`: register a fix sub-task (e.g., 04I3A) to update staging `.env` to `EMAIL_PROVIDER=resend` with correct variables, then re-test Path D.
5. If `EMAIL_PROVIDER=resend` and email was sent per Resend dashboard: check `APP_BASE_URL` value for correctness, check Resend delivery status for test address.
6. Do NOT edit staging `.env` or source until the root cause is confirmed.

---

## Summary

| Question | Answer |
|---|---|
| Registration route | `POST /api/auth/register` → `AuthController.register()` → `AuthService.register()` |
| "EMAIL VERIFICATION REQUIRED" code path | Registration success → `setSuccessMessage(t('successMessage'))` in `frontend/app/[locale]/register/page.tsx` — this is the expected pending-verification UI state |
| Email send code path | `AuthService.sendVerificationEmail()` → `EmailProvider.sendEmail()` — provider resolved by `EmailModule` from `EMAIL_PROVIDER` env var |
| Email provider/library | Resend SDK (`resend` npm package) via `ResendEmailProvider`; fallback stub via `StubEmailProvider` |
| Required env var names | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `APP_BASE_URL`, `AUTH_EMAIL_REPLY_TO` (optional) |
| Is email disabled/mocked? | YES — default is `EMAIL_PROVIDER=stub` (no-op). Unless explicitly set to `resend` in staging `.env`, no emails are sent |
| Token generated before send? | YES — token is stored in DB before `sendVerificationEmail()` is called |
| Email send failure logging? | NO — no structured logging in `AuthService` around email send |
| User sees email failure? | NO — if stub, registration returns 200 and shows success message. Only a Resend API error would cause a visible 500 |
| Most likely root cause | `EMAIL_PROVIDER` not set to `resend` in staging `.env` (defaulting to `stub`) |
| Safe next evidence | PM2 logs + `grep EMAIL_PROVIDER` from staging env (names only) + Resend dashboard |
| What stays blocked | Path D, 04I completion, deployment readiness |

---

## Confirmations

- ✅ No source code changed
- ✅ No `.env*` files opened or printed
- ✅ No env values read or printed
- ✅ No runtime/server action taken
- ✅ No email sent by this investigation
- ✅ No account/login/data action taken
- ✅ No Docker/PostgreSQL/Redis action taken
- ✅ No git commit or push
- ✅ No subagents used
