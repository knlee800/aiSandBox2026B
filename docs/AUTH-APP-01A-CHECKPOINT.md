# AUTH-APP-01A Checkpoint — Auth Architecture & Implementation Spec

**Task:** AUTH-APP-01A — Auth Architecture & Implementation Spec
**Status:** COMPLETE and LOCKED
**Date:** 2026-05-06
**Nature:** Documentation / spec only — no source code, dependencies, or migrations changed

---

## What Was Done

Created `docs/AUTH-APP-01-SPEC.md` — a decision-complete implementation spec for aiSandBox first-party authentication. This document gates all subsequent AUTH-APP-01B through AUTH-APP-01Z implementation slices.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AUTH-APP-01-SPEC.md` | Created — full auth architecture and implementation spec |
| `docs/AUTH-APP-01A-CHECKPOINT.md` | Created — this checkpoint |
| `TASKS.md` | AUTH-APP-01A marked COMPLETE and LOCKED; family status and current stage updated; child slice list revised and locked |
| `TASKS_BACKLOG_FULL.md` | AUTH-APP-01A marked COMPLETE and LOCKED; family status updated; key decisions recorded; AUTH-APP-01 child slice list confirmed |

**No source code changed. No package.json changed. No migrations created.**

---

## Key Decisions (from `docs/AUTH-APP-01-SPEC.md`)

### 1. Auth Stack
Extend existing NestJS + Passport + JWT backend. **Auth.js / NextAuth explicitly rejected** — would create two parallel auth systems alongside the existing NestJS API Gateway auth backend which already has email+password login, JwtStrategy, JwtAuthGuard, bcrypt, and passport-jwt.

### 2. Token / Session Storage
HTTP-only secure cookie session with server-side `auth_sessions` table persistence. Frontend `localStorage` access_token usage removed during AUTH-APP-01C. Cookie attributes: `HttpOnly`, `Secure` (production), `SameSite=Lax`, 7-day `Max-Age` with server-side revocation. CSRF protection required for mutating requests.

### 3. OAuth Callback Flow
Server-side session establishment on callback. No token in redirect URL. OAuth `state` parameter validated before processing any callback. Post-login redirects validated against an explicit allowlist.

### 4. Data Model Changes (AUTH-APP-01B)
- Make `users.password_hash` nullable (fixes critical schema/entity mismatch that blocks OAuth users)
- Add `oauth_accounts` table (multi-provider account linking)
- Add `verification_tokens` table (email verification + password reset one-time tokens stored as hashes)
- Add `auth_sessions` table (server-side session persistence and revocation)
- All changes additive and backward-compatible

### 5. Account Linking Policy
- Google same verified-email → auto-link to existing account
- Apple private relay email (`@privaterelay.appleid.com`) → never auto-link, create new user
- Unverified provider email → no auto-link, return safe conflict error
- Match by provider + providerAccountId always takes precedence over email match

### 6. Email Auth Strategy
Keep email + password (not magic link). Add email verification and password reset. Rate limiting on all auth endpoints. **Transactional email provider is unresolved — blocks AUTH-APP-01C email verification and password reset implementation. Must be selected and configured before AUTH-APP-01C stage-start.**

### 7. Google OAuth (AUTH-APP-01D)
`passport-google-oauth20`; GET /auth/google + GET /auth/google/callback routes; env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`; manual checklist in spec.

### 8. Apple OAuth (AUTH-APP-01E)
Library TBD at AUTH-APP-01E stage-start (candidates: `passport-apple`, `apple-signin-auth`); POST callback; private relay email handling per policy in spec; Apple Developer manual checklist in spec.

### 9. Route / API Protection
Frontend: Next.js middleware reads session cookie, redirects unauthenticated requests to `/[locale]/login`. Backend: all resource API endpoints require authenticated user context, return 401 if absent. Public routes explicitly listed in spec Section 10.

### 10. Confirmed Slice Order
```
AUTH-APP-01B — Database / Schema Migrations
AUTH-APP-01C — Token Storage & Email Auth Hardening  (may split into C1 + C2)
AUTH-APP-01D — Google OAuth
AUTH-APP-01E — Apple OAuth
AUTH-APP-01F — Route / API Protection
AUTH-APP-01G — Auth UX Integration
AUTH-APP-01H — Security Hardening + Validation Checklist
AUTH-APP-01Z — Final Consolidation
```

AUTH-APP-01C split decision deferred to AUTH-APP-01C stage-start: if HTTP-only session migration + email verification/password reset is too large, split into:
- **AUTH-APP-01C1** — HTTP-only Cookie / Session Migration
- **AUTH-APP-01C2** — Email Verification / Password Reset / Rate Limiting

---

## Current Critical Issues (to be addressed in earliest slices)

| Issue | Severity | Addressed in |
|---|---|---|
| `users.password_hash` is `NOT NULL` in migration but `nullable: true` in entity — blocks OAuth user creation | BLOCKER | AUTH-APP-01B |
| `localStorage` JWT is XSS-vulnerable | HIGH | AUTH-APP-01C |
| 15-minute JWT expiry with no refresh — poor production UX | HIGH | AUTH-APP-01C |
| No multi-provider account linking table | HIGH | AUTH-APP-01B |

---

## Unresolved Risks

| Risk | Severity | Required action |
|---|---|---|
| No transactional email provider configured | HIGH | Choose provider and add API key to env before AUTH-APP-01C stage-start |
| Apple `.p8` private key one-time download | HIGH | Store securely immediately when generated; never commit to source |
| `localStorage` usage may extend beyond `login/page.tsx` | MEDIUM | Audit all frontend files at AUTH-APP-01C stage-start |
| AUTH-APP-01C scope may be too large for one slice | MEDIUM | Decide split at AUTH-APP-01C stage-start |

---

## Next Slice

**AUTH-APP-01B — Database / Schema Migrations**

Must be registered before starting. Deliverables:
- Migration: make `users.password_hash` nullable
- Migration: add `oauth_accounts` table
- Migration: add `verification_tokens` table
- Migration: add `auth_sessions` table
- Update `User` entity to mark legacy `authProvider`/`oauthId` as deprecated

AUTH-APP-01B must complete before AUTH-APP-01C (schema prerequisites for session table).

---

## Invariants Preserved

- No source code changed
- No npm dependencies installed
- No database migrations created
- No OAuth provider configured
- No login/register behavior changed
- UX-IA-03 checkpoint remains intact and locked
- Governance loop: spec → checkpoint → TASKS update → next slice registration
