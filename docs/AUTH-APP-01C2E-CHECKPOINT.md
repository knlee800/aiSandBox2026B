# AUTH-APP-01C2E Checkpoint — Frontend Auth Email UX

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01C2E |
| Title | Frontend Auth Email UX |
| Family | AUTH |
| Parent | AUTH-APP-01C2 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | FRONTEND — new pages, updated copy, new i18n keys, targeted unit tests |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` (Section 9 — frontend UX/i18n plan) |
| Governing spec | `docs/AUTH-APP-01-SPEC.md` (Sections 7, 10.2, 12) |
| Depends on | AUTH-APP-01C2C (COMPLETE and LOCKED) + AUTH-APP-01C2D (COMPLETE and LOCKED) |

---

## Objective

Implement all frontend-facing email auth UX surfaces:

- Updated login page with `?verified=1` success banner, `?error=token_expired` error banner, and forgot-password link
- Updated register page success state with verification-email copy and optional resend verification email button
- New `forgot-password` page — email input, `POST /api/auth/password-reset/request`, anti-enumeration success message
- New `reset-password` page — reads `?token=`, client-side validation, `POST /api/auth/password-reset/confirm`, success/error states
- i18n keys for all three locales (`en.json`, `zh-TW.json`, `zh-CN.json`)
- Targeted unit tests for all four page surfaces

No backend changes, no DB changes, no new dependencies, no broad redesign.

---

## Files Changed

| File | Action |
|---|---|
| `frontend/app/[locale]/login/page.tsx` | Modified — `AuthStatusBanner` replacing `OAuthErrorBanner`; forgot-password link; submit `active:scale-[0.97]` |
| `frontend/app/[locale]/register/page.tsx` | Modified — `registeredEmail` state; resend verification button in success state; submit `active:scale-[0.97]` |
| `frontend/app/[locale]/forgot-password/page.tsx` | **Created** — new forgot-password page |
| `frontend/app/[locale]/reset-password/page.tsx` | **Created** — new reset-password page |
| `frontend/messages/en.json` | Modified — new i18n keys |
| `frontend/messages/zh-TW.json` | Modified — same keys in Traditional Chinese |
| `frontend/messages/zh-CN.json` | Modified — same keys in Simplified Chinese |
| `frontend/components/public/login.test.tsx` | **Created** — 5 targeted tests |
| `frontend/components/public/register.test.tsx` | **Created** — 1 test covering full register + resend flow |
| `frontend/components/public/forgot-password.test.tsx` | **Created** — 2 targeted tests |
| `frontend/components/public/reset-password.test.tsx` | **Created** — 5 targeted tests |

**Production source files with no changes:** all backend/api-gateway files, all entities, all migrations, all email provider files, all OAuth strategy files, all non-auth frontend pages.

---

## UX/UI Advisory Note

Emil Kowalski design engineering skill was consulted as advisory-only, bounded to C2E surfaces. Accepted recommendations applied within scope:

- Added `active:scale-[0.97] transition-colors` to login and register submit buttons (consistent with existing OAuth button treatment in both pages)
- Added `active:scale-[0.97]` to forgot-password and reset-password submit buttons
- Status banners kept static (no entry animation) — correct because they appear from URL params on page load, not from user interaction
- No new dependencies, no Framer Motion, no new animation libraries

---

## Login Page Summary

**File:** `frontend/app/[locale]/login/page.tsx`

Renamed local `OAuthErrorBanner` component to `AuthStatusBanner`. Extended banner logic:

| Query | Renders |
|---|---|
| `?verified=1` | Green banner using `login.emailVerified` |
| `?error=token_expired` | Red banner using `errors.verificationExpired` |
| `?error=account_conflict` | Red banner using `errors.accountConflict` (preserved) |
| Any other `?error` | Red banner using `errors.oauthFailed` (preserved) |
| No query | Null (preserved) |

Added forgot-password link near password field (before `<Suspense>` block):
- `href={/${locale}/forgot-password}`
- text `t('login.forgotPassword')`

Preserved: existing `<Suspense fallback={null}>` wrapper, existing login submit logic, existing OAuth links, existing `mb-6` → `mb-3` + separate `mb-6 text-right` link row for spacing.

Added `active:scale-[0.97]` to login submit button.

---

## Register Page Summary

**File:** `frontend/app/[locale]/register/page.tsx`

Added `registeredEmail` state to retain submitted email after form clear. Added `resendStatus` state: `'idle' | 'sending' | 'sent' | 'error'`.

On successful registration:
1. `setRegisteredEmail(email)` — captured before clear
2. `setSuccessMessage(t('successMessage'))` — updated copy via i18n key
3. `setEmail('')` / `setPassword('')` — existing clear behavior preserved

After success, while `registeredEmail` is set:
- Shows resend button with `t('register.resendVerification')` text
- Resend calls `POST /api/auth/email/verify/resend` with `{ email: registeredEmail }` and `Accept-Language: locale` header
- On success: replaces button with `t('register.verificationResent')` message
- On failure: shows existing red error banner; does not reveal account existence

No auto-redirect. No broad redesign. Added `active:scale-[0.97]` to submit button.

---

## Forgot-Password Page Summary

**File:** `frontend/app/[locale]/forgot-password/page.tsx` (new)

Client component. Follows login/register card layout pattern exactly.

States:
1. **Initial** — email input + submit button (`t('forgotPassword.submitButton')`)
2. **Loading** — button disabled, label `t('forgotPassword.sending')`
3. **Sent** — generic success message `t('forgotPassword.sentMessage')` + back-to-login link

API: `POST /api/auth/password-reset/request` with `{ email }` and `Accept-Language: locale` header.

Response is always treated as success (anti-enumeration — endpoint always returns 200). Only network errors display `errors.network`. Back-to-login link (`t('forgotPassword.backToLogin')`) present in both form and sent states. No `useSearchParams` — no Suspense required.

---

## Reset-Password Page Summary

**File:** `frontend/app/[locale]/reset-password/page.tsx` (new)

Client component. `useSearchParams()` used inside inner `ResetPasswordForm` component, wrapped by `<Suspense fallback={null}>` in the page shell. Follows Next.js 15 pattern established in `login/page.tsx`.

Token read: `useSearchParams().get('token')?.trim() ?? ''`.

States:
1. **Missing token** — shows `errors.tokenExpired` + link to forgot-password. Displayed immediately on render, no request made.
2. **Initial form** — `newPassword` and `confirmPassword` inputs + submit button
3. **Loading** — button disabled, label `t('resetPassword.resetting')`
4. **Success** — `t('resetPassword.successMessage')` + sign-in link to `/${locale}/login`
5. **API error** — `status 400/401` → `errors.tokenExpired`; other failures → `t('resetPassword.resetFailed')`

Client validation (before any request):
- `newPassword.length < 6` → `t('resetPassword.passwordTooShort')`, no submit
- `newPassword !== confirmPassword` → `t('resetPassword.passwordMismatch')`, no submit

API: `POST /api/auth/password-reset/confirm` with `{ token, newPassword }` only. `confirmPassword` never sent to backend.

---

## i18n Summary

All three locale files updated with identical key structure. Untouched dead keys: `login.testCredentials`, `register.name`.

**`login` namespace additions:**

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `forgotPassword` | `"Forgot your password?"` | `"忘記密碼？"` | `"忘记密码？"` |
| `resetIt` | `"Reset it"` | `"重設"` | `"重置"` |
| `emailVerified` | `"Email verified. You can now sign in."` | `"電子郵件已驗證。您現在可以登入。"` | `"邮箱已验证。您现在可以登录。"` |

**`register` namespace updates:**

| Key | en (updated) | zh-TW (updated) | zh-CN (updated) |
|---|---|---|---|
| `successMessage` | `"Account created. We've sent a verification email — please check your inbox."` | `"帳號已建立。我們已發送驗證郵件，請查看您的收件匣。"` | `"账号已创建。我们已发送验证邮件，请查收您的收件箱。"` |
| `resendVerification` | `"Resend verification email"` | `"重新發送驗證郵件"` | `"重新发送验证邮件"` |
| `verificationResent` | `"Verification email resent."` | `"驗證郵件已重新發送。"` | `"验证邮件已重新发送。"` |

**New `forgotPassword` namespace:**

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `title` | `"Reset your password"` | `"重設密碼"` | `"重置密码"` |
| `email` | `"Email"` | `"電子郵件"` | `"电子邮件"` |
| `submitButton` | `"Send reset link"` | `"發送重設連結"` | `"发送重置链接"` |
| `sending` | `"Sending..."` | `"發送中..."` | `"发送中..."` |
| `sentMessage` | `"If that email is registered, a reset link has been sent. Please check your inbox."` | `"若該電子郵件已註冊，重設連結已發送。請查看您的收件匣。"` | `"若该邮箱已注册，重置链接已发送。请查收您的收件箱。"` |
| `backToLogin` | `"Back to sign in"` | `"返回登入"` | `"返回登录"` |

**New `resetPassword` namespace:**

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `title` | `"Choose a new password"` | `"設定新密碼"` | `"设置新密码"` |
| `newPassword` | `"New password"` | `"新密碼"` | `"新密码"` |
| `confirmPassword` | `"Confirm password"` | `"確認密碼"` | `"确认密码"` |
| `submitButton` | `"Reset password"` | `"重設密碼"` | `"重置密码"` |
| `resetting` | `"Resetting..."` | `"重設中..."` | `"重置中..."` |
| `successMessage` | `"Password reset successfully. Please sign in."` | `"密碼已成功重設。請登入。"` | `"密码已成功重置。请登录。"` |
| `signIn` | `"Sign in"` | `"登入"` | `"登录"` |
| `passwordMismatch` | `"Passwords do not match."` | `"密碼不一致。"` | `"两次密码不一致。"` |
| `passwordTooShort` | `"Password must be at least 6 characters."` | `"密碼至少須為 6 個字元。"` | `"密码至少需要6个字符。"` |
| `requestNew` | `"Request a new reset link"` | `"申請新的重設連結"` | `"申请新的重置链接"` |
| `resetFailed` | `"Reset failed. Please try again."` | `"重設失敗，請再試一次。"` | `"重置失败，请重试。"` |

**`errors` namespace additions:**

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `tokenExpired` | `"This link is invalid or has expired."` | `"此連結無效或已過期。"` | `"此链接无效或已过期。"` |
| `verificationExpired` | `"This verification link has expired. Request a new one from the register page."` | `"此驗證連結已過期。請從註冊頁面申請新的連結。"` | `"此验证链接已过期。请从注册页面申请新的链接。"` |

---

## Tests Added

All tests placed under `frontend/components/public/`. Test harness follows the project's existing `Module._load` + `renderToStaticMarkup` / `resolveTree` pattern established in `frontend/app/[locale]/login/page.test.tsx`.

### `login.test.tsx` — 5 tests
- `renders forgot password link`
- `renders success banner for verified=1`
- `renders verification expired banner for token_expired error`
- `preserves account conflict message for account_conflict error`
- `renders generic oauth failure for non-special error values`

### `register.test.tsx` — 1 test (covers full flow)
- `shows updated success copy and resend flow after registration succeeds` — verifies register API call, success copy, resend button, resend API call, sent confirmation

### `forgot-password.test.tsx` — 2 tests
- `renders email form, submits reset request, and shows success state`
- `handles rejected request gracefully`

### `reset-password.test.tsx` — 5 tests
- `shows invalid-or-expired state when token is missing`
- `blocks mismatched passwords on client side`
- `blocks short password on client side`
- `submits valid reset request and shows success state`
- `shows token-expired state for API 400/401 failures`

**Total new test count: 13 tests across 4 files.**

---

## Validation Commands and Results

All commands run from `C:\Users\knlee\aiSandBox2026B\frontend`:

| Command | Result |
|---|---|
| `npm run build` | **PASS** — zero errors; both new routes (`/[locale]/forgot-password`, `/[locale]/reset-password`) compiled and included in build output |
| `npx tsc --noEmit` (first run) | **FAIL** — 24 errors; `TS18046: 'node' is of type 'unknown'` in 3 test files due to strict `unknown` in helper functions |
| Fix applied | Test helper signatures changed from `unknown` to `any` in `resolveTree` and `findElement` in `register.test.tsx`, `forgot-password.test.tsx`, `reset-password.test.tsx` |
| `npx tsc --noEmit` (second run) | **PASS** — zero errors |
| `npm test` | **PASS** — 269 tests, 0 failed, 0 skipped |

### Build output (new routes confirmed)
```
├ ƒ /[locale]/forgot-password    1.66 kB   127 kB
├ ƒ /[locale]/reset-password      1.9 kB   127 kB
```

---

## `tsconfig.tsbuildinfo` Restore

`frontend/tsconfig.tsbuildinfo` was modified by `npm run build`. Restored with:
```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```
Final status: **restored — not left modified in working tree**.

---

## Non-Goals Confirmed

- No backend changes (no `services/api-gateway` files changed)
- No DB migrations, no entity changes
- No new npm dependencies (`package.json` unchanged)
- No broad auth page redesign (additive changes only)
- No manual smoke test run (deferred to AUTH-APP-01C2F)
- No checkpoint or governance changes made during implementation phase

---

## Risks / Carry-Forwards

| Item | Severity | Notes |
|---|---|---|
| **Live email flow / manual smoke** | DEFERRED | End-to-end path (register → verification email → click link → login with banner → forgot-password → email → reset link → reset page → login) requires live Docker + Resend/Stub environment. Deferred to AUTH-APP-01C2F. |
| **Backend 10/hr/IP secondary rate limit** | LOW | Carry-forward from C2D — `POST /api/auth/password-reset/request` only enforces 5/hr/email via `EmailThrottlerGuard`. Independent 10/hr/IP secondary limit not yet enforced. Requires named throttler config or Redis-backed throttler. Future hardening slice. |
| **Resend domain / DNS setup** | OPERATIONS | `AUTH_EMAIL_FROM` domain requires DKIM/SPF/DMARC configuration in Resend dashboard before production email delivery. Operations prerequisite, not a code task. Documented in C2B checkpoint. |
| **`login.testCredentials` and `register.name` dead keys** | LOW | Pre-existing dead i18n keys. Left untouched per spec. Future cleanup slice. |
| **No live email smoke until C2F** | INFORMATIONAL | All C2E surfaces tested with unit tests only. Real email delivery not verified in this slice. |

---

## AUTH-APP-01C2 Parent Status

**ACTIVE — AUTH-APP-01C2A COMPLETE and LOCKED; AUTH-APP-01C2B COMPLETE and LOCKED; AUTH-APP-01C2C COMPLETE and LOCKED; AUTH-APP-01C2D COMPLETE and LOCKED; AUTH-APP-01C2E COMPLETE and LOCKED; AUTH-APP-01C2F PLANNED (next stage)**

---

## Next Recommended Task

**AUTH-APP-01C2F — Email Auth Validation + Consolidation**

C2F prerequisites satisfied by C2A–C2E:
- All backend routes working (C2C + C2D)
- All frontend UX surfaces implemented (C2E)
- i18n complete in all three locales (C2E)
- Unit tests passing for all frontend surfaces (C2E)

C2F deliverables (from spec Section 11):
- `npx tsc --noEmit` PASS in `services/api-gateway`
- Targeted Jest tests PASS (all auth-related suites, including backend tests from C2C/C2D)
- `npm run build` + `npm test` PASS in `frontend` (already passing after C2E)
- Manual smoke checklist (requires live Docker/PostgreSQL/Resend environment)
- `docs/AUTH-APP-01C2F-CHECKPOINT.md`
- `docs/AUTH-APP-01C2-CHECKPOINT.md` (C2 family summary)
- `TASKS.md` and `TASKS_BACKLOG_FULL.md` updated: AUTH-APP-01C2 COMPLETE and LOCKED

---

## Reference

- `docs/AUTH-APP-01C2-EMAIL-AUTH-SPEC.md` — governing spec for C2 family (Section 9: frontend UX plan; Section 9.7: i18n keys)
- `docs/AUTH-APP-01C2A-CHECKPOINT.md` — C2A spec checkpoint
- `docs/AUTH-APP-01C2B-CHECKPOINT.md` — C2B email provider foundation checkpoint
- `docs/AUTH-APP-01C2C-CHECKPOINT.md` — C2C email verification backend checkpoint
- `docs/AUTH-APP-01C2D-CHECKPOINT.md` — C2D password reset backend checkpoint
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary
- `TASKS.md` → AUTH-APP-01C2 and AUTH-APP-01C2E
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01C2 and AUTH-APP-01C2E
