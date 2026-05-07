# AUTH-APP-01E Checkpoint — Apple OAuth

**Task ID:** AUTH-APP-01E
**Title:** Apple OAuth
**Date:** 2026-05-07
**Status:** COMPLETE and LOCKED
**Parent:** AUTH-APP-01 — aiSandBox First-Party User Authentication
**Depends on:** AUTH-APP-01C1A (COMPLETE and LOCKED), AUTH-APP-01D (COMPLETE and LOCKED), AUTH-APP-01B (COMPLETE and LOCKED)

---

## Objective

Implement Apple OAuth sign-in using `@nicokaiser/passport-apple`, integrated with the existing `SessionCookieGuard` and `auth_sessions` cookie infrastructure established in AUTH-APP-01C1A, and the OAuth state cookie-session flow established in AUTH-APP-01D. On successful Apple callback the same server-side session mechanism as password login and Google login is used; no `access_token` is exposed to the browser. Multi-provider account linking follows the policy defined in spec Section 6 with Apple-specific private relay email handling. Frontend login/register pages receive minimal functional "Continue with Apple" links.

---

## Files Changed

### Backend — new files

- `services/api-gateway/src/auth/apple.strategy.ts`
- `services/api-gateway/src/auth/__tests__/apple.strategy.spec.ts`

### Backend — modified files

- `services/api-gateway/package.json` — added `@nicokaiser/passport-apple`
- `services/api-gateway/src/auth/auth.service.ts` — added `AppleProfileInput` interface, `findOrCreateAppleUser()`, `createAppleOauthLink()`, `isApplePrivateRelayEmail()`
- `services/api-gateway/src/auth/auth.controller.ts` — added `GET /auth/apple`, `POST /auth/apple/callback`, `getOauthErrorCode()` private helper
- `services/api-gateway/src/auth/auth.module.ts` — registered `AppleStrategy` as provider
- `services/api-gateway/src/auth/auth.service.spec.ts` — added Apple OAuth account-linking test suite (6 tests); Google OAuth tests restructured under nested `describe` block; no test cases removed

### Frontend — modified files

- `frontend/app/[locale]/login/page.tsx` — added "Continue with Apple" link
- `frontend/app/[locale]/register/page.tsx` — added "Continue with Apple" link
- `frontend/messages/en.json` — added `login.continueWithApple`, `register.continueWithApple`
- `frontend/messages/zh-TW.json` — added `login.continueWithApple`, `register.continueWithApple`
- `frontend/messages/zh-CN.json` — added `login.continueWithApple`, `register.continueWithApple`

### Docs — modified

- `services/api-gateway/docs/SMOKE-PACK-README.md` — added Apple OAuth env vars to prerequisites, with Services ID vs Bundle ID note, private key format note, and `OAUTH_STATE_SECRET` reuse note

### Files Not Changed (Confirmed)

- No migrations or entities changed.
- `services/api-gateway/src/auth/google.strategy.ts` — unchanged.
- `services/api-gateway/src/main.ts` — unchanged (Apple OAuth state reuses existing `aisandbox_oauth_state` cookie-session infrastructure).
- No workspace, Visual Edit Mode, or billing files touched.
- No AUTH-MODULE-01 files touched.
- `frontend/tsconfig.tsbuildinfo` — modified by build run; restored with `git restore`.

---

## Dependency Added

| Package | Type |
|---|---|
| `@nicokaiser/passport-apple` | production |

No `@types/...` package is needed — `@nicokaiser/passport-apple` ships its own declarations.

---

## Apple Strategy Summary

`AppleStrategy` (`src/auth/apple.strategy.ts`) uses `PassportStrategy(ApplePassportStrategy, 'apple')` where `ApplePassportStrategy` is `@nicokaiser/passport-apple`. This mirrors the exact pattern used by `GoogleStrategy`.

Configuration:

| Option | Source |
|---|---|
| `clientID` | `APPLE_CLIENT_ID` (must be Apple Services ID, not Bundle ID) |
| `teamID` | `APPLE_TEAM_ID` |
| `keyID` | `APPLE_KEY_ID` |
| `key` | `APPLE_PRIVATE_KEY` with `.replace(/\\n/g, '\n')` applied |
| `callbackURL` | `APPLE_CALLBACK_URL` |
| `scope` | `['name', 'email']` |
| `state` | `true` |

The library handles ES256 client secret JWT generation internally using `teamID`, `keyID`, and `key`. No manual JWT signing was implemented.

`validate()` extracts:
- `appleId` from `profile.id ?? profile.sub` — Apple's stable unique identifier for the user
- `email` normalized to lowercase, or `null` on repeat sign-ins where Apple omits it
- `emailVerified` from profile; defaults to `false` if absent
- `isPrivateEmail` from profile; defaults to `false` if absent
- `name` passed through if present (first sign-in only) but not stored — `User` entity has no name column

---

## Apple Route Summary

| Route | Method | Behavior |
|---|---|---|
| `GET /api/auth/apple` | GET | Accepts optional `?locale=en\|zh-TW\|zh-CN`; normalizes invalid/missing to `en`; stores locale in `aisandbox_oauth_state` session cookie (shared with Google OAuth state flow); initiates Apple redirect via `passport.authenticate('apple')` |
| `POST /api/auth/apple/callback` | POST | Receives Apple POST callback; on success calls `createSession(user.id)`, sets `aisandbox_session` cookie, clears OAuth state, redirects to `/${locale}/app`; on error redirects to `/${locale}/login?error=oauth_failed`; on explicit conflict redirects to `/${locale}/login?error=account_conflict` |

Both routes are public (no `SessionCookieGuard`). No `access_token` is returned at any point. The Apple callback is POST (not GET), per Apple's OAuth implementation.

The `getOauthErrorCode()` private helper on `AuthController` distinguishes `account_conflict` from generic `oauth_failed` by inspecting the `UnauthorizedException` message, using the same redirect allowlist enforced by `normalizeLocale()`.

---

## Account-Linking Behavior (`AuthService.findOrCreateAppleUser()`)

Applied in order:

1. **Match by provider account** — if `oauth_accounts` row exists for `provider='apple'` + `providerAccountId=appleId`, return the linked active user (touch `lastLoginAt`); throw `UnauthorizedException` if user is inactive
2. **Missing account id** — throw `UnauthorizedException` if `appleId` is blank/empty
3. **Missing email with no provider match** — throw `UnauthorizedException` if `normalizedEmail` is null (repeat sign-in where Apple omits email and no existing provider link exists)
4. **Private relay email** — if `isPrivateEmail` flag is true or email ends with `@privaterelay.appleid.com`, skip email-based lookup; create new `users` row (`passwordHash=null`, `authProvider='apple'`) and new `oauth_accounts` row; do not auto-link to any existing user by email
5. **Auto-link by real email** — if email is a real address and a `users` row exists with that email, create `oauth_accounts` link and return the existing user (touch `lastLoginAt`); throw if that existing user is inactive
6. **Create new user** — if no existing user found, create new `users` row (`passwordHash=null`, `authProvider='apple'`, `oauthId=appleId`) and new `oauth_accounts` row

Duplicate provider account creation is prevented by the `UNIQUE (provider, provider_account_id)` constraint on `oauth_accounts` (established in AUTH-APP-01B). `createAppleOauthLink()` is a private method that mirrors `createGoogleOauthLink()` exactly.

---

## Cookie / Session Behavior

After a successful Apple callback, `authService.createSession(user.id)` is called. This generates a 32-byte random token, hashes it with SHA-256, stores the hash in `auth_sessions` with a 7-day expiry, and returns the raw token. The raw token is placed in the `aisandbox_session` HttpOnly cookie using the same attributes as password login and Google login (HttpOnly, SameSite=Lax, Secure in production, 7-day maxAge, Path=/). The existing `SessionCookieGuard` on all browser-facing controllers validates this cookie without modification.

---

## Frontend / i18n Summary

**`login/page.tsx` and `register/page.tsx`:**
- A minimal `<a>` link pointing to `/api/auth/apple?locale=${locale}` was added below the existing Google link.
- Uses `mt-3 block w-full` spacing and the same border/surface design-token classes as the Google link.
- Full-page navigation (not `fetch`) — the browser follows the Apple redirect chain.
- No redesign of the email/password form.

**i18n keys added across en / zh-TW / zh-CN:**

| Key | en | zh-TW | zh-CN |
|---|---|---|---|
| `login.continueWithApple` | Continue with Apple | 以 Apple 繼續 | 使用 Apple 继续 |
| `register.continueWithApple` | Continue with Apple | 以 Apple 繼續 | 使用 Apple 继续 |

Full UX polish (Apple-branded button, error query param display, account page provider list) is deferred to AUTH-APP-01G.

---

## Environment Variables Required

| Variable | Notes |
|---|---|
| `APPLE_CLIENT_ID` | Apple Services ID (e.g. `com.example.web`) — NOT the app Bundle ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID (10-character alphanumeric) |
| `APPLE_KEY_ID` | Key identifier from Apple Developer Portal (10-character) |
| `APPLE_PRIVATE_KEY` | Full `.p8` PEM content with newlines serialized as `\n` in the env var |
| `APPLE_CALLBACK_URL` | Must exactly match the Return URL registered in Apple Developer Portal |
| `OAUTH_STATE_SECRET` | Reused from AUTH-APP-01D; falls back to `SESSION_SECRET` then `JWT_SECRET` |

Documented in `services/api-gateway/docs/SMOKE-PACK-README.md`.

---

## Validation Results

### Backend (Step 1)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (api-gateway) | PASS |
| `npx jest src/auth/auth.service.spec.ts src/auth/__tests__/apple.strategy.spec.ts --runInBand` | PASS — 2 suites, 12 tests |

### Frontend (Step 2)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (frontend) | PASS |
| `npm test` (frontend) | PASS — 253 tests, 0 failures |
| `npm run build` (frontend) | PASS |

### `frontend/tsconfig.tsbuildinfo`

Modified by the `npm run build` run; restored with:
```powershell
git -C "C:\Users\knlee\aiSandBox2026B" restore -- frontend/tsconfig.tsbuildinfo
```

---

## Carry-Forward Blockers (Pre-Existing — Not Introduced by AUTH-APP-01E)

| Blocker | Source |
|---|---|
| `npm test` backend full suite fails — `REDIS_URL` not set in host test environment; Docker services are internal-only | Established from AUTH-APP-01C1A |
| `ai-execution.controller.spec.ts` — 4 pre-existing unit test failures (NestJS DI resolution) | Established from AUTH-APP-01C1A |
| `npm run lint` backend — ESLint config not discoverable in `services/api-gateway` | Established from AUTH-APP-01C1A |

Full backend `npm test` was not re-run in Step 1; targeted unit test commands were used to avoid known environment blockers. None of these failures were introduced by AUTH-APP-01E.

---

## Non-Goals Confirmed

- No Google OAuth behavior changes beyond shared pattern reuse (`normalizeLocale`, `setSessionCookie`, `clearOauthState`)
- No email verification or password reset (AUTH-APP-01C2 — BLOCKED on email provider)
- No rate limiting (AUTH-APP-01H)
- No frontend auth redesign beyond minimal Apple links (AUTH-APP-01G)
- No AUTH-MODULE-01
- No workspace UX changes
- No Visual Edit Mode
- No migrations or entity changes
- No unrelated refactors

---

## Risks / Invariants Preserved

- `JwtAuthGuard` and `JwtStrategy` remain intact (preserved from AUTH-APP-01C1A; not altered)
- `DRIVER_API_KEY_STORAGE_KEY` / `Authorization: Bearer ${apiKey}` AI execution flow is unchanged
- `auth_sessions` table and `SessionCookieGuard` behavior are unchanged
- `oauth_accounts` schema from AUTH-APP-01B is used as-is; no migration needed (`provider` column is generic `varchar(50)`)
- Google OAuth state cookie (`aisandbox_oauth_state`) and `aisandbox_session` remain fully separate
- Locale allowlist (`en`, `zh-TW`, `zh-CN`) enforced at both initiation and callback routes to prevent open redirect
- Apple `.p8` private key is read from environment variable only; never logged or committed
- No real Apple network calls in automated tests

---

## Manual Verification Checklist (Requires Apple Developer Account Credentials)

- [ ] `GET /api/auth/apple` initiates redirect to Apple authorization page
- [ ] Completing Apple authorization sets `aisandbox_session` cookie and redirects to `/en/app`
- [ ] Second sign-in with same Apple account authenticates as the same user (no duplicate `oauth_accounts` row)
- [ ] Private relay email creates new user without auto-linking to an existing real-email account
- [ ] Apple private key is confirmed as an environment variable and not in source
- [ ] `APPLE_CLIENT_ID` is the Services ID, not the Bundle ID
- [ ] `APPLE_CALLBACK_URL` matches the Return URL in Apple Developer Portal
- [ ] Missing or invalid OAuth state on callback returns error without creating a session

---

## Next Recommended Child Task

**AUTH-APP-01F — Route / API Protection**

Implement Next.js middleware session-cookie route guard for protected frontend routes (`/[locale]/app`, `/[locale]/projects`, `/[locale]/keys`, `/[locale]/account`) and audit all backend API Gateway controllers to confirm `SessionCookieGuard` enforcement. Depends on AUTH-APP-01C1A (complete) and does not require AUTH-APP-01C2 or full OAuth completion.

AUTH-APP-01C2 remains BLOCKED on transactional email provider selection.

AUTH-APP-01G (Auth UX Integration — Apple and Google button polish, error query param display, account page provider list) should follow after both AUTH-APP-01D and AUTH-APP-01E are complete.
