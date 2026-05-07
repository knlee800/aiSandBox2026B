# AUTH-APP-01H1 Checkpoint — Security Hardening Inventory

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01H1 |
| Title | Security Hardening Inventory |
| Family | AUTH |
| Parent | AUTH-APP-01H (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | DOCUMENTATION / SPEC ONLY — no production source files changed |
| Date | 2026-05-07 |
| Depends on | AUTH-APP-01G4 (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` |

---

## Objective

Produce a read-only security hardening inventory and scope plan before any AUTH-APP-01H implementation work begins. Inspect the current state of CSRF protection, auth endpoint rate limiting, OAuth state parameter handling, redirect allowlist behavior, and secrets/env documentation. Formally catalogue all carry-forward items (events endpoints, preview proxy, test/tooling blockers). Define the exact implementation boundaries for AUTH-APP-01H2, H3, and H4.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` | **Created** — gap inventory + H2/H3/H4 scope spec |
| `docs/AUTH-APP-01H1-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-APP-01H1 COMPLETE and LOCKED; current stage advanced to AUTH-APP-01H2 |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-01H1 COMPLETE and LOCKED; checkpoint reference added |

**Production source files changed: None.**

---

## Spec Document

**Path:** `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md`

**Status:** APPROVED — gates AUTH-APP-01H2, AUTH-APP-01H3, AUTH-APP-01H4 implementation

### Sections confirmed

| # | Section | Status |
|---|---|---|
| 1 | Purpose and Scope | ✓ |
| 2 | Gap Inventory Summary Table | ✓ |
| 3 | CSRF Protection | ✓ |
| 4 | Auth Endpoint Rate Limiting | ✓ |
| 5 | OAuth State Parameter | ✓ |
| 6 | Redirect Allowlist | ✓ |
| 7 | Secrets/Env Documentation | ✓ |
| 8 | Events Endpoint Carry-Forward | ✓ |
| 9 | Preview Proxy Carry-Forward | ✓ |
| 10 | Test/Tooling Blockers | ✓ |
| 11 | H2/H3/H4 Boundary Definitions | ✓ |
| 12 | Risks and Open Questions | ✓ |

---

## Key Security Inventory Findings

### CSRF Protection — MISSING

No CSRF middleware, synchronizer token, or double-submit cookie exists. `SameSite=Lax` on the session cookie provides partial browser-level protection but does not satisfy spec Section 12.2. Implementation required in H2.

Critical note: `POST /api/auth/apple/callback` must be excluded from CSRF enforcement — Apple's POST callback is server-to-server and does not carry the user's browser CSRF cookie.

### Auth Endpoint Rate Limiting — MISSING

`@nestjs/throttler` is not installed. No throttling decorators or guards exist anywhere. No IP-based or user-based rate limiting on any auth endpoint. H2 must cover `POST /auth/login` (10/min/IP) and `POST /auth/register` (5/min/IP). Password-reset and resend limits remain blocked under AUTH-APP-01C2.

**Dependency approval required:** `@nestjs/throttler` is a new production dependency. Explicit user approval is required before H2 implementation begins. Recommended: in-memory throttler for H2 to avoid adding a Redis environment requirement.

### OAuth State Parameter — PARTIAL (functionally implemented, documentation gaps)

Both `GoogleStrategy` and `AppleStrategy` use `state: true`. The `aisandbox_oauth_state` cookie-session serves as the backing store. State generation and validation by Passport are functional and satisfy spec Section 12.3 at the implementation level.

Gap: `OAUTH_STATE_SECRET` and `SESSION_SECRET` are not documented in `api-gateway/.env.example`. The fallback chain in `main.ts` falls back to a hardcoded development string if none of `OAUTH_STATE_SECRET`, `SESSION_SECRET`, or `JWT_SECRET` are set. H2 must add these to `.env.example`.

### Redirect Allowlist — NO OPEN REDIRECT, NO FORMAL ALLOWLIST

OAuth callbacks redirect only to hardcoded `/${locale}/app` or `/${locale}/login?error=...`. Locale is validated against `SUPPORTED_LOCALES = new Set(['en', 'zh-TW', 'zh-CN'])`. No user-controlled redirect URL parameter exists. No open redirect vector found.

H2 must add an `ALLOWED_POST_OAUTH_REDIRECTS` formal allowlist constant to prevent future regressions if a `?redirect=` parameter is ever added.

### Secrets/Env Documentation — SIGNIFICANT GAP

Source code contains no real hardcoded credentials. All strategy constructors use placeholder fallback strings. The code is clean.

`api-gateway/.env.example` is missing: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`, `JWT_SECRET`, `SESSION_SECRET`, `OAUTH_STATE_SECRET`.

Root `.env.example` has `JWT_SECRET` and `INTERNAL_SERVICE_KEY` but lacks `SESSION_SECRET`, `OAUTH_STATE_SECRET`, and all OAuth provider vars.

H2 must update `api-gateway/.env.example`. H4 must run a secrets grep audit.

### Events Endpoints — UNGUARDED (carry-forward from AUTH-APP-01F)

All three endpoints in `EventsController` have no guard:
- `POST /api/events/file-changed` — `files.service.ts` calls via raw `HttpService`, no auth header
- `POST /api/events/checkpoint-created` — `git.service.ts` calls via raw `HttpService` despite `ApiGatewayHttpClient` being available
- `POST /api/events/token-updated` — no caller found in any service

H3 fix: extend `ApiGatewayHttpClient` with events methods; update `files.service.ts` (inject `ApiGatewayHttpClient`) and `git.service.ts` (use existing client); add `@UseGuards(InternalServiceAuthGuard)` class-level to `EventsController`. Confirm `token-updated` has no hidden caller before guarding.

### Preview Proxy — UNGUARDED, DEFERRED (carry-forward from AUTH-APP-01F)

`PreviewController` uses `@All('*')` with no guard. Container-manager's `ENABLE_PREVIEW_ACCESS_CONTROL=false` by default; existing mechanism uses JWT Bearer (incompatible with `SessionCookieGuard`). A product decision (public vs. session-owner-only preview) is required before any fix can be designed. H3 formally defers with risk documentation. Risk rating: MEDIUM.

### Test/Tooling Blockers — THREE PRE-EXISTING

| Blocker | Nature | H3 Action |
|---|---|---|
| Backend full `npm test` Redis | Environment constraint — `REDIS_URL` absent in test env | Document targeted-test strategy; no code fix needed |
| `ai-execution-guards` `QuotaService` | Missing mock provider in `TestingModule` | Add `QuotaService` mock to test module (one-file fix) |
| Backend ESLint config discovery | No `.eslintrc.*` in `services/api-gateway` | Add minimal `.eslintrc.js` (one-file addition) |

---

## H2/H3/H4 Boundary Definitions

### AUTH-APP-01H2 — CSRF + Rate Limiting + Redirect Allowlist + Env Documentation

**Pre-requisite (BLOCKING H2 START):** Explicit user approval for `@nestjs/throttler` new dependency.

Files in scope: `main.ts`, `auth.controller.ts`, `app.module.ts`, `session-cookie.guard.ts` or new CSRF middleware, `api-gateway/.env.example`, `package.json`.

Key decisions for H2 stage-start:
- CSRF: middleware vs. guard approach
- Throttler: in-memory storage recommended
- Redirect allowlist: private static constant in `auth.controller.ts`

### AUTH-APP-01H3 — Events Endpoint Guards + Tooling Triage + Preview Disposition

Files in scope: `api-gateway-http.client.ts`, `files.service.ts`, `git.service.ts`, `events.controller.ts`, new `.eslintrc.js`, `ai-execution-guards.integration.spec.ts`.

Preview: formal deferral document only — no preview auth implementation in H3.

### AUTH-APP-01H4 — Secrets Audit + Manual Smoke + Family Consolidation

Validation only. Secrets grep audit. Manual smoke checklists (F-family 22 items + G-family 12 items + H-specific 6 items). Family checkpoint `docs/AUTH-APP-01H-CHECKPOINT.md`. Governance updates.

---

## Dependency Approval Note

**AUTH-APP-01H2 cannot begin until the user explicitly approves `@nestjs/throttler` as a new production dependency.**

This is required by project governance (CLAUDE.md: "Always ask before adding new dependencies"). The recommended installation for H2:

```bash
npm install @nestjs/throttler
```

Recommendation: use in-memory storage (`ThrottlerStorageService`, the default) for H2. Redis-backed upgrade is a separate future decision and must not be entangled with H2.

If the user prefers a different rate-limiting approach (custom Redis counter using the existing `ioredis` dependency), H2 must be updated accordingly before implementation begins.

---

## Validation Performed

| Check | Result |
|---|---|
| `git status` — production source files changed | None — confirmed |
| New files created | `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` only |
| All 12 spec sections present | Confirmed via `Select-String` |
| No code tests run | Correct — docs-only slice |
| No dependency changes | Confirmed |
| No middleware/guard changes | Confirmed |
| No frontend/backend behavior changes | Confirmed |

---

## Non-Goals Confirmed

- No CSRF implementation
- No rate limiting configuration
- No guard additions to any controller
- No dependency installs
- No frontend changes
- No backend behavior changes
- No container-manager changes
- No email provider work (AUTH-APP-01C2 remains BLOCKED)
- No preview proxy auth implementation

---

## Risks and Open Questions (Summary)

| Risk | Severity | Resolution |
|---|---|---|
| CSRF vs Apple POST callback | CRITICAL | Apple callback must be excluded from CSRF enforcement — address in H2 |
| `@nestjs/throttler` dependency approval | MEDIUM | Required before H2 begins |
| In-memory vs Redis-backed throttler | MEDIUM | Use in-memory for H2; Redis upgrade is a separate future slice |
| CSRF implementation: middleware vs guard | MEDIUM | Decide at H2 stage-start (recommendation: middleware for token-setting, guard for validation) |
| Preview proxy product decision | MEDIUM | Public vs. session-owner-only — out of scope for H3 except formal deferral |
| `token-updated` unknown caller | LOW | Confirm with grep at H3 stage-start before guarding |
| ESLint config format for ESLint 8 | LOW | Use `.eslintrc.js` legacy format for ESLint 8 compatibility |

---

## Next Recommended Task

**AUTH-APP-01H2 — CSRF + Rate Limiting + Redirect Hardening (PLANNED)**

Pre-requisite before H2 can begin: explicit user approval for `@nestjs/throttler` dependency.

AUTH-APP-01C2 remains BLOCKED — transactional email provider not yet chosen. AUTH-APP-01H2 does not unblock AUTH-APP-01C2.

---

## Reference

- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` — governing spec for AUTH-APP-01H2, H3, H4
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions (CSRF: Sec 12.2; rate limiting: Sec 7.5; state: Sec 12.3; redirect: Sec 12.4; secrets: Sec 12.5)
- `docs/AUTH-APP-01F-CHECKPOINT.md` — events and preview carry-forwards
- `docs/AUTH-APP-01G-CHECKPOINT.md` — manual smoke carry-forward
- `TASKS.md` → AUTH-APP-01H1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H1
