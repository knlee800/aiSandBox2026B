# AUTH-APP-01D Checkpoint

**Task ID:** AUTH-APP-01D
**Title:** Google OAuth
**Date:** 2026-05-07
**Status:** COMPLETE and LOCKED

---

## Objective

Implement Google OAuth sign-in using `passport-google-oauth20`, integrated with the existing `SessionCookieGuard` and `auth_sessions` cookie infrastructure established in AUTH-APP-01C1A. On successful Google callback the same server-side session mechanism as password login is used; no `access_token` is exposed to the browser. Multi-provider account linking follows the policy defined in spec Section 6. Frontend login/register pages receive minimal functional "Continue with Google" links.

---

## Files Changed

### Backend — new files

- `services/api-gateway/src/auth/google.strategy.ts`
- `services/api-gateway/src/auth/__tests__/google.strategy.spec.ts`
- `services/api-gateway/src/auth/auth.service.spec.ts`

### Backend — modified files

- `services/api-gateway/package.json` — added `passport-google-oauth20`, `cookie-session`, `@types/passport-google-oauth20`, `@types/cookie-session`
- `services/api-gateway/src/main.ts` — added `cookieSession` middleware before `cookieParser`
- `services/api-gateway/src/auth/auth.service.ts` — added `findOrCreateGoogleUser()`, injected `OauthAccountRepository`
- `services/api-gateway/src/auth/auth.controller.ts` — added `GET /auth/google` and `GET /auth/google/callback` routes
- `services/api-gateway/src/auth/auth.module.ts` — registered `GoogleStrategy` provider

### Frontend — modified files

- `frontend/app/[locale]/login/page.tsx` — added minimal "Continue with Google" link
- `frontend/app/[locale]/register/page.tsx` — added minimal "Continue with Google" link
- `frontend/messages/en.json` — added i18n keys
- `frontend/messages/zh-TW.json` — added i18n keys
- `frontend/messages/zh-CN.json` — added i18n keys

### Docs — modified (follow-up)

- `services/api-gateway/docs/SMOKE-PACK-README.md` — added Google OAuth env vars to prerequisites list

---

## Dependencies Added

| Package | Type |
|---|---|
| `passport-google-oauth20` | production |
| `cookie-session` | production |
| `@types/passport-google-oauth20` | devDependency |
| `@types/cookie-session` | devDependency |

---

## OAuth State Handling Summary

`cookie-session` is used solely to persist the short-lived OAuth state across the two-leg Google redirect flow. This cookie is entirely separate from `aisandbox_session`.

- Cookie name: `aisandbox_oauth_state`
- `maxAge`: 10 minutes
- `httpOnly`: true, `sameSite`: lax, `secure` in production
- Secret preference order: `OAUTH_STATE_SECRET` → `SESSION_SECRET` → `JWT_SECRET`
- The `cookie-session` middleware is registered in `main.ts` before `cookieParser()`

---

## Google Route Summary

| Route | Behavior |
|---|---|
| `GET /api/auth/google` | Accepts optional `?locale=en\|zh-TW\|zh-CN`; normalizes invalid/missing locale to `en`; stores locale in OAuth state cookie; initiates Google redirect via `passport.authenticate('google')` |
| `GET /api/auth/google/callback` | Validates Google token via `GoogleStrategy`; on success calls `createSession(user.id)`, sets `aisandbox_session` cookie with same C1A attributes (HttpOnly, SameSite=Lax, Secure in production, 7-day maxAge), clears OAuth state cookie, redirects to `/${locale}/app`; on error redirects to `/${locale}/login?error=oauth_failed` |

Both routes are public (no `SessionCookieGuard`). No `access_token` is returned at any point.

---

## Account-Linking Behavior Summary

`AuthService.findOrCreateGoogleUser()` implements spec Section 6 linking order:

1. **Match by provider + providerAccountId** — if an `oauth_accounts` row exists for `provider='google'` and the Google profile id, sign in the linked user (touch `lastLoginAt`)
2. **Auto-link by verified email** — if no provider account exists and Google reports the email as verified, find an existing `users` row by email; if found, create an `oauth_accounts` record and return the existing user
3. **Reject unverified email link** — if a matching user exists but Google email is not verified, throw `UnauthorizedException` (no link created)
4. **Create new user** — if no existing user matches, create a new `users` row (`passwordHash = null`, `authProvider = 'google'`) and a new `oauth_accounts` record; return the new user

Duplicate provider account creation is prevented by the `UNIQUE (provider, provider_account_id)` constraint on `oauth_accounts` (established in AUTH-APP-01B).

---

## Cookie / Session Behavior Summary

After a successful Google callback the controller calls `authService.createSession(user.id)`, which generates a 32-byte random token, hashes it with SHA-256, stores the hash in `auth_sessions` with a 7-day expiry, and returns the raw token. The raw token is placed in the `aisandbox_session` HttpOnly cookie using the same attributes as password login. The existing `SessionCookieGuard` on all browser-facing controllers validates this cookie without modification.

---

## Frontend Button / i18n Summary

**login/page.tsx and register/page.tsx:**
- A divider (`orContinueWith`) and an `<a>` link pointing to `/api/auth/google?locale=${locale}` were added below the existing submit button.
- Full-page navigation (not `fetch`) — the browser follows the redirect chain through Google and back.
- Uses existing UX-IA design tokens (`border-border`, `bg-surface-base`, `text-text-primary`, `bg-surface-raised`).
- No redesign of the email/password form.

**i18n keys added across en / zh-TW / zh-CN:**
- `login.orContinueWith`
- `login.continueWithGoogle`
- `register.orContinueWith`
- `register.continueWithGoogle`
- `errors.oauthFailed`
- `errors.accountConflict`

Full UX polish (Google-branded button, error query param display, account page provider list) is deferred to AUTH-APP-01G.

---

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | Registered callback URL (e.g. `http://localhost:3000/api/auth/google/callback` in dev) |
| `OAUTH_STATE_SECRET` | Secret for signing the OAuth state cookie (falls back to `SESSION_SECRET` then `JWT_SECRET`) |

---

## Environment Documentation Note

`services/api-gateway/.env.example` exists and the OS-level write probe confirmed it writable, but the direct file-edit tool returned `Permission denied` on that dotfile path. Therefore OAuth env vars were documented in the existing env documentation file instead:

- `services/api-gateway/docs/SMOKE-PACK-README.md` updated — Google OAuth env vars added to the prerequisites list

No duplicate `.env.example` was created.

---

## Validation Results

| Command | Result |
|---|---|
| `npx tsc --noEmit` (api-gateway) | PASS |
| `npx jest src/auth/auth.service.spec.ts src/auth/__tests__/google.strategy.spec.ts --runInBand` | PASS — 2 suites, 6 tests |
| `npm test` (api-gateway full suite) | FAIL — carry-forward blockers only (see below) |
| `npm run lint` (api-gateway) | FAIL — carry-forward blocker only (see below) |
| `npx tsc --noEmit` (frontend) | PASS |
| `npm test` (frontend) | PASS — 253 tests |
| `npm run build` (frontend) | PASS |
| `frontend/tsconfig.tsbuildinfo` | Modified by build; restored via `git restore` |

---

## Carry-Forward Blockers (all pre-existing, not introduced by AUTH-APP-01D)

- `npm test` backend: `src/ai/ai-execution.controller.spec.ts` — 4 pre-existing unit test failures (NestJS DI resolution, not in AUTH-APP-01D changeset)
- `npm test` backend: integration/smoke suites fail during bootstrap — `REDIS_URL environment variable is not set`; Redis is Docker-internal only and not host-port-bound in this environment
- `npm run lint` backend: ESLint config not discoverable in `services/api-gateway` — pre-existing tooling issue

---

## Non-Goals Confirmed

- No Apple OAuth (AUTH-APP-01E)
- No email verification or password reset (AUTH-APP-01C2 — BLOCKED on email provider)
- No rate limiting (AUTH-APP-01H)
- No frontend auth redesign beyond minimal Google button (AUTH-APP-01G)
- No AUTH-MODULE-01
- No workspace UX changes
- No Visual Edit Mode
- No unrelated refactors

---

## Risks / Invariants Preserved

- `JwtAuthGuard` and `JwtStrategy` remain in codebase (preserved from AUTH-APP-01C1A; not altered here)
- `DRIVER_API_KEY_STORAGE_KEY` / `Authorization: Bearer ${apiKey}` AI execution flow is unchanged
- `auth_sessions` table and `SessionCookieGuard` behavior are unchanged
- `oauth_accounts` schema from AUTH-APP-01B is used as-is; no migration needed
- Google OAuth state cookie (`aisandbox_oauth_state`) is fully separate from the user auth cookie (`aisandbox_session`)
- Locale allowlist is enforced at callback (`en`, `zh-TW`, `zh-CN` only) to prevent open redirect
- No real Google network calls in automated tests

---

## Manual Verification Checklist (requires Google Cloud Console credentials)

- [ ] `GET /api/auth/google` initiates redirect to Google consent screen
- [ ] Completing consent sets `aisandbox_session` cookie and redirects to `/en/app`
- [ ] Second sign-in with same Google account authenticates as the same user (no duplicate `oauth_accounts` row)
- [ ] Google email matching existing email+password user auto-links accounts
- [ ] Missing or invalid `state` parameter on callback returns error without creating a session
- [ ] Google Cloud Console project has authorized redirect URI set to `GOOGLE_CALLBACK_URL`

---

## Next Recommended Child Task

**AUTH-APP-01E — Apple OAuth** is the next unblocked slice. It depends on AUTH-APP-01C1A and AUTH-APP-01D.

AUTH-APP-01C2 remains BLOCKED on transactional email provider selection.

AUTH-APP-01G (Auth UX Integration — Google button polish, error states, account page) should follow after both AUTH-APP-01D and AUTH-APP-01E are complete.
