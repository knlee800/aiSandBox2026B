# AUTH-APP-01 Checkpoint — aiSandBox First-Party User Authentication (Family Summary)

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01 |
| Title | aiSandBox First-Party User Authentication |
| Family | AUTH |
| Status | VALIDATION COMPLETE — AUTH-APP-01C2 BLOCKED; manual smoke deferred; carry-forwards pending |
| Nature | FAMILY-LEVEL SUMMARY — references child checkpoints; does not duplicate their content |
| Date | 2026-05-08 |
| Spec | `docs/AUTH-APP-01-SPEC.md` |
| Child summary checkpoints | `docs/AUTH-APP-01F-CHECKPOINT.md` · `docs/AUTH-APP-01G-CHECKPOINT.md` · `docs/AUTH-APP-01H-CHECKPOINT.md` · `docs/AUTH-APP-01Z-CHECKPOINT.md` |

---

## Purpose

This document is the family-level summary checkpoint for AUTH-APP-01 — aiSandBox First-Party User Authentication. It provides a single navigable record of everything the implementation wave delivered, what remains blocked or deferred, production handoff requirements, and the path forward.

For implementation detail, validation commands, and code-level evidence, see the individual child checkpoints listed in Section 2.

The governing decisions for all AUTH-APP-01 work are in `docs/AUTH-APP-01-SPEC.md`. This checkpoint is the delivery record; the spec is the authority for architectural decisions.

---

## 1. What AUTH-APP-01 Accomplished

### Core authentication

| Capability | Delivered in | Detail |
|---|---|---|
| Password login and registration | AUTH-APP-01C1A | `POST /api/auth/login`, `POST /api/auth/register`; bcrypt password hashing; `auth_sessions` table |
| Server-side cookie session | AUTH-APP-01C1A | `aisandbox_session` cookie; HttpOnly, SameSite=Lax, Secure in production; `SessionCookieGuard` |
| Frontend localStorage/Bearer migration | AUTH-APP-01C1B | All frontend `localStorage` access_token usage removed; `SessionCookieGuard` is the exclusive browser auth path |
| Google OAuth | AUTH-APP-01D | `passport-google-oauth20`; state parameter; account linking (same verified email auto-links); `GET /api/auth/google` + callback |
| Apple OAuth | AUTH-APP-01E | `@nicokaiser/passport-apple`; POST callback; private relay email handling; Apple Developer checklist documented |
| Session revocation (logout) | AUTH-APP-01C1A | `POST /api/auth/logout`; deletes `auth_sessions` row; clears cookie |

### Route and API protection

| Surface | Delivered in | Detail |
|---|---|---|
| `/[locale]/keys` unauthenticated redirect | AUTH-APP-01F3 | `GET /api/auth/me` bootstrap on page load; redirects to `/${locale}/login` on 401 |
| `/[locale]/account` unauthenticated redirect | AUTH-APP-01F3 | Inherits keys behavior |
| `POST /api/ai/executions/:id/cancel` | AUTH-APP-01F2 | `ApiKeyAuthGuard` (DRIVER_API_KEY Bearer) |
| `GET /api/ai/executions/:id` | AUTH-APP-01F2 | `ApiKeyAuthGuard` |
| `GET /api/ai/executions/:id/stream` | AUTH-APP-01F2 | `ApiKeyAuthGuard` |
| `POST /api/chat-messages/add-by-session` | AUTH-APP-01F2 | `InternalServiceAuthGuard` (X-Internal-Service-Key) |
| `POST /api/token-usage/record` | AUTH-APP-01F2 | `InternalServiceAuthGuard` |
| `GET /api/runtime/metrics` | AUTH-APP-01F2 | `InternalServiceAuthGuard` |
| `POST /api/events/file-changed` | AUTH-APP-01H3 | `InternalServiceAuthGuard` — extended guard path; container-manager caller updated |
| `POST /api/events/checkpoint-created` | AUTH-APP-01H3 | `InternalServiceAuthGuard` — container-manager caller updated |
| `POST /api/events/token-updated` | AUTH-APP-01H3 | `InternalServiceAuthGuard` — guarded; no current caller |

### Auth UX

| Capability | Delivered in | Detail |
|---|---|---|
| OAuth error banner on login page | AUTH-APP-01G2 | Reads `?error` query param; provider-agnostic wording; `OAuthErrorBanner` inside `<Suspense>` |
| OAuth button interaction polish | AUTH-APP-01G2 | `transition`, `active:scale-[0.97]`, `focus-visible:ring` on all four OAuth links |
| Workspace header logout button | AUTH-APP-01G3 | `onLogout` prop on `WorkspaceShellProps`; both header variants; `data-testid="workspace-header-logout-button"` |
| `LogoutButton` component | AUTH-APP-01G3 | `'use client'`; fetches `/api/auth/me` on mount; displays user email; redirects on auth failure; calls logout on click |
| Account page auth section | AUTH-APP-01G3 | `PROJECT_FIRST_UX=true` path renders `<LogoutButton />` above API Keys |

### Security hardening

| Capability | Delivered in | Detail |
|---|---|---|
| CSRF cookie middleware | AUTH-APP-01H2 | Sets `aisandbox_csrf` non-HttpOnly cookie on every response if absent; 32-byte random token |
| CSRF header validation on logout | AUTH-APP-01H2 | `CsrfGuard` on `POST /api/auth/logout`; double-submit cookie pattern; `X-CSRF-Token` header required |
| Frontend logout CSRF header | AUTH-APP-01H2 | Both `app/page.tsx` and `logout-button.tsx` send `X-CSRF-Token` from `aisandbox_csrf` cookie |
| Apple callback CSRF exclusion | AUTH-APP-01H2 | `POST /api/auth/apple/callback` correctly excluded; Apple server POST carries no browser cookies |
| Login rate limiting | AUTH-APP-01H2 | 10 req / 60 s / IP via `@nestjs/throttler` in-memory; `@Throttle({ default: { limit: 10, ttl: 60000 } })` |
| Register rate limiting | AUTH-APP-01H2 | 5 req / 60 s / IP via same throttler |
| OAuth redirect allowlist | AUTH-APP-01H2 | `ALLOWED_POST_OAUTH_REDIRECTS = new Set(['/app', '/login'])` in `AuthController`; `buildOAuthRedirectPath()` validates before every redirect |
| `api-gateway/.env.example` secrets documentation | AUTH-APP-01H2 | All 11 OAuth/session/key env vars documented with placeholder values and comments |
| Container-manager events callers authenticated | AUTH-APP-01H3 | `ApiGatewayHttpClient.notifyFileChanged()` and `notifyCheckpointCreated()` send `X-Internal-Service-Key` |
| ESLint tooling unblocked | AUTH-APP-01H3 | `services/api-gateway/.eslintrc.js` created; `npm run lint` now runs |
| Secrets audit | AUTH-APP-01H4 | All tracked source files confirmed clean of real credentials after local history cleanup |

### Database / infrastructure

| Capability | Delivered in | Detail |
|---|---|---|
| `users.password_hash` nullable | AUTH-APP-01B | Fixes schema/entity mismatch for OAuth-only users |
| `oauth_accounts` table | AUTH-APP-01B | Multi-provider linking; FK to `users`; unique constraint |
| `verification_tokens` table | AUTH-APP-01B | Email verify + password reset tokens; unique hash; composite index |
| `auth_sessions` table | AUTH-APP-01B | Session persistence and revocation; unique session_token_hash; expires_at index |

---

## 2. Child Slice Index

### Phase-level parents

| Parent | Status | Checkpoint |
|---|---|---|
| AUTH-APP-01F | VALIDATION COMPLETE — carry-forwards/manual smoke deferred | `docs/AUTH-APP-01F-CHECKPOINT.md` |
| AUTH-APP-01G | VALIDATION COMPLETE — manual smoke deferred | `docs/AUTH-APP-01G-CHECKPOINT.md` |
| AUTH-APP-01H | VALIDATION COMPLETE — manual smoke deferred | `docs/AUTH-APP-01H-CHECKPOINT.md` |

### All child slices

| Slice | Title | Status | Checkpoint |
|---|---|---|---|
| AUTH-APP-01A | Auth Architecture & Implementation Spec | COMPLETE and LOCKED | `docs/AUTH-APP-01A-CHECKPOINT.md` |
| AUTH-APP-01B | Database / Schema Migrations | COMPLETE and LOCKED | `docs/AUTH-APP-01B-CHECKPOINT.md` |
| AUTH-APP-01C1A | Backend Cookie Session Foundation | COMPLETE and LOCKED | `docs/AUTH-APP-01C1A-CHECKPOINT.md` |
| AUTH-APP-01C1B | Frontend localStorage/Bearer Migration | COMPLETE and LOCKED | `docs/AUTH-APP-01C1B-CHECKPOINT.md` |
| AUTH-APP-01C2 | Email Verification / Password Reset / Rate Limiting | **BLOCKED — email provider not chosen** | Not created |
| AUTH-APP-01D | Google OAuth | COMPLETE and LOCKED | `docs/AUTH-APP-01D-CHECKPOINT.md` |
| AUTH-APP-01E | Apple OAuth | COMPLETE and LOCKED | `docs/AUTH-APP-01E-CHECKPOINT.md` |
| AUTH-APP-01F1 | Route/API Protection Inventory + Spec | COMPLETE and LOCKED | `docs/AUTH-APP-01F1-CHECKPOINT.md` |
| AUTH-APP-01F2 | Backend API Protection Gaps | COMPLETE and LOCKED | `docs/AUTH-APP-01F2-CHECKPOINT.md` |
| AUTH-APP-01F3 | Frontend Protected Route Behavior | COMPLETE and LOCKED | `docs/AUTH-APP-01F3-CHECKPOINT.md` |
| AUTH-APP-01F4 | Protection Validation + Consolidation | COMPLETE and LOCKED | `docs/AUTH-APP-01F4-CHECKPOINT.md` |
| AUTH-APP-01G1 | Auth UX Inventory + Scope | COMPLETE and LOCKED | `docs/AUTH-APP-01G1-CHECKPOINT.md` |
| AUTH-APP-01G2 | Login/Register OAuth Error + Button Polish | COMPLETE and LOCKED | `docs/AUTH-APP-01G2-CHECKPOINT.md` |
| AUTH-APP-01G3 | Logout + Basic Account Surface | COMPLETE and LOCKED | `docs/AUTH-APP-01G3-CHECKPOINT.md` |
| AUTH-APP-01G4 | Auth UX Validation + Checkpoint | COMPLETE and LOCKED | `docs/AUTH-APP-01G4-CHECKPOINT.md` |
| AUTH-APP-01H1 | Security Hardening Inventory | COMPLETE and LOCKED | `docs/AUTH-APP-01H1-CHECKPOINT.md` |
| AUTH-APP-01H2 | CSRF + Rate Limiting + Redirect Hardening | COMPLETE and LOCKED | `docs/AUTH-APP-01H2-CHECKPOINT.md` |
| AUTH-APP-01H3 | Events Endpoint Guards + Test/Tooling Triage | COMPLETE and LOCKED | `docs/AUTH-APP-01H3-CHECKPOINT.md` |
| AUTH-APP-01H4 | Manual Smoke + Secrets Audit + Final Consolidation | COMPLETE and LOCKED | `docs/AUTH-APP-01H4-CHECKPOINT.md` |
| AUTH-APP-01Z | Final AUTH-APP-01 Consolidation | COMPLETE and LOCKED | `docs/AUTH-APP-01Z-CHECKPOINT.md` |

---

## 3. What Is Not Implemented (BLOCKED)

### AUTH-APP-01C2 — Email Verification / Password Reset / Rate Limiting

**Status: BLOCKED — transactional email provider not chosen.**

The following capabilities are absent from the platform:
- Email verification on registration (no `POST /api/auth/email/verify` endpoint)
- Password reset flow (no `POST /api/auth/password-reset/request`, no `POST /api/auth/password-reset/confirm`)
- Resend rate limiting (`3/hr/user` for resend)
- Password reset rate limiting (`5/hr/email`, `10/hr/IP`)
- Transactional email sending infrastructure

**Unblock prerequisite:** Choose and configure a transactional email provider. Candidates from `docs/AUTH-APP-01-SPEC.md`: Resend, SendGrid, Amazon SES. Add the provider API key to the deployment environment before AUTH-APP-01C2 stage-start.

---

## 4. Deferred / Carry-Forward Items

### Manual smoke checklist — 40 items NOT RUN

Deferred continuously from F4 → G4 → H4 → Z. All require a live Docker/PostgreSQL/Redis/api-gateway/frontend/browser environment.

| Family | Items | Deferred since |
|---|---|---|
| F-family | 22 items | AUTH-APP-01F4 |
| G-family | 12 items | AUTH-APP-01G4 |
| H-specific | 6 items | AUTH-APP-01H4 |

The H-specific checklist is recorded in `docs/AUTH-APP-01H4-CHECKPOINT.md`. The G-family checklist is in `docs/AUTH-APP-01G-CHECKPOINT.md`. The F-family checklist is in `docs/AUTH-APP-01F4-CHECKPOINT.md`.

AUTH-APP-01F, G, and H cannot be promoted to COMPLETE and LOCKED until the user runs these items against a live environment.

### Preview proxy `/api/preview/*` — open, investigation deferred

`PreviewController` (`services/api-gateway/src/preview/preview.controller.ts`) uses `@All('*')` with no guard. Any unauthenticated HTTP request can trigger container-manager preview operations.

**Risk rating: MEDIUM.** Blocked on a product/security decision: are preview URLs public/shareable, or session-owner-only? Container-manager's existing access control uses JWT Bearer (incompatible with `SessionCookieGuard`). A dedicated investigation slice is required after the product decision is made.

### Other carry-forwards

| Item | Detail |
|---|---|
| api-gateway lint baseline — 353 pre-existing errors | `.eslintrc.js` added in H3; `npm run lint` runs; errors are pre-existing across unrelated files |
| Backend full `npm test` Redis constraint | `REDIS_URL` absent in test environment; targeted test strategy is the established workaround |
| Keys page raw Tailwind classes | `keys/page.tsx` uses zero UX-IA-02 tokens; future UX task |
| `login.testCredentials` dead i18n key | Present in all three locales; never rendered |
| `register.name` dead i18n key | Present in all three locales; no name field in register page |

---

## 5. Production Handoff Notes

These requirements must be satisfied before AUTH-APP-01 can be declared production-ready:

### Secret and credential requirements

| Requirement | Detail |
|---|---|
| **Rotate old Anthropic API key** | Key found in prior git commits (`sk-ant-api03-...`); MUST be rotated at [console.anthropic.com](https://console.anthropic.com) before any push or deployment |
| **Rotate old XAI API key** | Key found in prior git commits (`xai-...`); MUST be rotated at XAI console before any push or deployment |
| **Rotate dev Redis password** | `aisandboxredis123` found in prior git history; rotate if Redis instance is network-accessible |
| **Never commit `.env` files** | `.envxxx` and `.env.prod` were previously tracked; both removed; ensure they remain in `.gitignore` and are never recommitted |
| **Store provider keys in secrets manager** | `GOOGLE_CLIENT_SECRET`, `APPLE_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, and all other provider keys must be stored only in local `.env` (untracked) or a deployment secrets manager |
| **Set `OAUTH_STATE_SECRET`** | A separate, unique random string distinct from `JWT_SECRET` and `SESSION_SECRET` |
| **Set production cookie flags** | `api-gateway/.env.example` documents all required variables; ensure `NODE_ENV=production` for `Secure` cookie flag to activate |

### Live environment smoke

Run all 40 deferred smoke items from `docs/AUTH-APP-01F4-CHECKPOINT.md`, `docs/AUTH-APP-01G-CHECKPOINT.md`, and `docs/AUTH-APP-01H4-CHECKPOINT.md` against a live stack before declaring the auth system production-ready.

### AUTH-APP-01C2 gate

Email verification and password reset are **not implemented**. Users who register with email/password will not receive a verification email. Password recovery is not possible. This is a known gap — do not deploy to real users with this limitation without explicit acknowledgment.

---

## 6. Final Automated Validation Reference

All validation run on 2026-05-08 as part of AUTH-APP-01H4. AUTH-APP-01Z is governance-only and references these results.

| Service | Command | Result |
|---|---|---|
| api-gateway | `npx tsc --noEmit` | PASS |
| api-gateway | `npx jest` (csrf.guard + events.controller.guard + ai-execution-guards) | PASS — 40/40 |
| api-gateway | `npm run build` (frontend, from H2) | PASS |
| frontend | `npm test` (from H2) | PASS — 256 tests |
| container-manager | `npx tsc --noEmit` | PASS |
| container-manager | `npm test -- files` | PASS — 2/2 |
| Secrets audit (`git grep`) | All tracked files | CLEAN |
| Manual smoke | All 40 items | NOT RUN — deferred |
| AUTH-APP-01Z lightweight reconfirmation | `npx tsc --noEmit` api-gateway | PASS |

---

## 7. Family Status

**VALIDATION COMPLETE — AUTH-APP-01C2 BLOCKED; manual smoke deferred; carry-forwards pending.**

AUTH-APP-01 may be promoted to COMPLETE and LOCKED only after:
1. AUTH-APP-01C2 is unblocked (email provider chosen), implemented, validated, and its checkpoint is created.
2. 40-item manual smoke checklist is run against a live environment and all items pass.
3. Preview proxy investigation slice is completed.
4. Old provider keys are confirmed rotated.

---

## 8. Next Recommended Work (independent paths)

1. **Choose transactional email provider** → unblocks AUTH-APP-01C2 (email verification, password reset, reset rate limiting).
2. **Run 40-item manual smoke checklist** in live Docker/PostgreSQL/Redis/api-gateway/browser environment → promotes AUTH-APP-01F, G, H to COMPLETE and LOCKED.
3. **Rotate old Anthropic and XAI keys** → prerequisite for any push/deployment.
4. **Approve preview proxy investigation slice** → resolves the remaining MEDIUM-risk open endpoint.
5. **Address api-gateway lint baseline** → 353 pre-existing errors; separate lint cleanup slice.

---

## Reference

- `docs/AUTH-APP-01-SPEC.md` — governing decisions spec (auth stack, data model, slice order, open risks)
- `docs/AUTH-APP-01F-CHECKPOINT.md` — Route/API Protection family summary
- `docs/AUTH-APP-01G-CHECKPOINT.md` — Auth UX Integration family summary
- `docs/AUTH-APP-01H-CHECKPOINT.md` — Security Hardening family summary; final validation record
- `docs/AUTH-APP-01H4-CHECKPOINT.md` — H4 secrets audit results; H-specific smoke checklist
- `docs/AUTH-APP-01Z-CHECKPOINT.md` — Z task checkpoint (this session)
- `TASKS.md` → AUTH-APP-01
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01
