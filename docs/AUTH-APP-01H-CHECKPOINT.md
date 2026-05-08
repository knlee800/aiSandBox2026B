# AUTH-APP-01H Checkpoint — Security Hardening (Family Summary)

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-01H |
| Title | Security Hardening + Validation Checklist |
| Family | AUTH |
| Parent | AUTH-APP-01 (ACTIVE) |
| Status | VALIDATION COMPLETE — manual smoke deferred |
| Nature | FAMILY-LEVEL SUMMARY — references child checkpoints; does not duplicate their content |
| Date | 2026-05-08 |
| Depends on | AUTH-APP-01G4 (COMPLETE and LOCKED) |
| Child slices | H1 (COMPLETE) · H2 (COMPLETE) · H3 (COMPLETE) · H4 (COMPLETE) |

---

## Purpose

This document is the family-level summary checkpoint for AUTH-APP-01H — Security Hardening. It provides a single navigable record of what the H1–H4 slices accomplished, the current security state of the platform, unresolved carry-forward items, and the recommendation for next work.

For implementation detail, validation commands, and code-level evidence, see the individual child checkpoints listed in Section 2.

---

## 1. What AUTH-APP-01H Accomplished

### Security gaps closed

| Area | Before AUTH-APP-01H | After AUTH-APP-01H |
|---|---|---|
| CSRF protection | None — no synchronizer token, no middleware | Double-submit cookie pattern (`aisandbox_csrf` non-HttpOnly cookie + `X-CSRF-Token` header validation on `POST /auth/logout`) |
| CSRF token middleware | Absent | Middleware in `main.ts` sets `aisandbox_csrf` on every response if absent |
| Auth endpoint rate limiting | None — `@nestjs/throttler` not installed | 10 req/60 s/IP on `POST /auth/login`; 5 req/60 s/IP on `POST /auth/register` (in-memory) |
| Redirect allowlist | No formal allowlist — hardcoded but informal | `ALLOWED_POST_OAUTH_REDIRECTS = new Set(['/app', '/login'])` in `AuthController`; `buildOAuthRedirectPath()` validates before redirect |
| `api-gateway/.env.example` secrets documentation | Missing 11 OAuth/session/key env vars | All 11 variables documented with placeholder values and comments |
| Events endpoints (3) | Unguarded — any caller could POST | `InternalServiceAuthGuard` now enforces `X-Internal-Service-Key` on all `/api/events/*` paths |
| container-manager events callers | Raw `HttpService.post()` with no auth header | `ApiGatewayHttpClient.notifyFileChanged()` and `notifyCheckpointCreated()` send `X-Internal-Service-Key` |
| Backend ESLint tooling | `npm run lint` failed at startup — no config file | `.eslintrc.js` created; `npm run lint` now runs; 353 pre-existing errors documented as repo-wide baseline |
| `ai-execution-guards` test blocker | `QuotaService` DI failure blocked full test suite | `useValue` mock added to `TestingModule`; 31/31 tests now pass; kill-switch tests corrected |
| Secrets audit | Not previously run for OAuth/session secrets | Audit run; clean after cleanup (see Section 4) |

### What was explicitly NOT changed

- `POST /api/auth/apple/callback` — correctly excluded from CSRF enforcement (Apple server-to-server POST carries no browser cookies)
- `POST /api/auth/login` and `POST /api/auth/register` — correctly excluded from `CsrfGuard` (public entry points with no session; rate-limited instead)
- OAuth state mechanism (`state: true` in both strategies) — already functional; unchanged
- Preview proxy (`/api/preview/*`) — formally deferred (product decision required; see carry-forwards)
- AUTH-APP-01C2 (email verification / password reset) — BLOCKED on email provider; unchanged

---

## 2. Child Checkpoint Index

| Slice | Status | Checkpoint | Key output |
|---|---|---|---|
| AUTH-APP-01H1 | COMPLETE and LOCKED | `docs/AUTH-APP-01H1-CHECKPOINT.md` | Security hardening inventory; H2/H3/H4 scope spec |
| AUTH-APP-01H2 | COMPLETE and LOCKED | `docs/AUTH-APP-01H2-CHECKPOINT.md` | CSRF middleware + guard; rate limiting; redirect allowlist; env docs; frontend logout header |
| AUTH-APP-01H3 | COMPLETE and LOCKED | `docs/AUTH-APP-01H3-CHECKPOINT.md` | Events endpoint guard; container-manager callers updated; ESLint config; QuotaService mock |
| AUTH-APP-01H4 | COMPLETE and LOCKED | `docs/AUTH-APP-01H4-CHECKPOINT.md` | Secrets audit (clean after cleanup); targeted validation PASS; 40-item smoke deferred |

---

## 3. Files Changed Across H1–H4

| File | Slice | Change |
|---|---|---|
| `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` | H1 | **Created** — gap inventory + H2/H3/H4 scope |
| `services/api-gateway/src/main.ts` | H2 | CSRF cookie-setting middleware added |
| `services/api-gateway/src/app.module.ts` | H2 | `ThrottlerModule.forRoot(...)` registered |
| `services/api-gateway/src/auth/auth.controller.ts` | H2 | `@Throttle` on login/register; `CsrfGuard` on logout; `buildOAuthRedirectPath()` + `ALLOWED_POST_OAUTH_REDIRECTS` |
| `services/api-gateway/src/auth/csrf.guard.ts` | H2 | **Created** — double-submit CSRF validation guard |
| `services/api-gateway/src/auth/__tests__/csrf.guard.spec.ts` | H2 | **Created** — 5 unit tests |
| `services/api-gateway/.env.example` | H2 | All 11 missing auth/session/OAuth env vars added with placeholders |
| `services/api-gateway/package.json` | H2 | `@nestjs/throttler@^6.5.0` added |
| `frontend/app/[locale]/app/page.tsx` | H2 | `handleLogout` sends `X-CSRF-Token` from cookie |
| `frontend/components/auth/logout-button.tsx` | H2 | Same — `getCsrfTokenFromCookie()` helper added |
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` | H3 | Path check extended to protect `/api/events/*` |
| `services/api-gateway/.eslintrc.js` | H3 | **Created** — minimal ESLint 8 legacy config |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | H3 | `QuotaService` mock; kill-switch test corrections; local lint cleanup |
| `services/api-gateway/src/websocket/__tests__/events.controller.guard.spec.ts` | H3 | **Created** — 4 guard unit tests |
| `services/container-manager/src/clients/api-gateway-http.client.ts` | H3 | `notifyFileChanged()` + `notifyCheckpointCreated()` methods added |
| `services/container-manager/src/git/git.service.ts` | H3 | Raw `httpService.post()` replaced with `apiGatewayClient.notifyCheckpointCreated()` |
| `services/container-manager/src/files/files.module.ts` | H3 | `ClientsModule` added to imports |
| `services/container-manager/src/files/files.service.ts` | H3 | `ApiGatewayHttpClient` injected; raw `httpService.post()` replaced with `apiGatewayClient.notifyFileChanged()` |
| `services/container-manager/src/files/files.service.spec.ts` | H3 | Test constructor updated with `apiGatewayClient` mock |
| `docs/AUTH-APP-01H4-CHECKPOINT.md` | H4 | **Created** — this session |
| `docs/AUTH-APP-01H-CHECKPOINT.md` | H4 | **Created** — this document |

**Total production source files changed across H2+H3: 14**
**Total new files created across H1–H4: 8 (spec + checkpoints + csrf.guard + spec tests + eslintrc + events spec)**
**H4 production source files changed: None**

---

## 4. Secrets Audit Summary

Run: 2026-05-08 (H4)

**Initial audit finding:** Two tracked files (`.envxxx`, `.env.prod`) containing real API credentials were found — a real Anthropic API key in both files and a real XAI API key in `.env.prod`. H4 was paused immediately.

**Post-cleanup status:** Both files removed from git tracking. `git ls-files` returns no tracked env files. Working tree clean. All remaining `sk-ant-` and PEM header hits are placeholder/test/doc values only.

**Mandatory action (outside H4 scope):** The previously committed Anthropic and XAI provider keys must be rotated before any future push or deployment. The dev Redis password (`aisandboxredis123`) should be rotated if the instance is network-accessible.

**Audit verdict (post-cleanup):** CLEAN — no real secrets in any tracked source file.

---

## 5. Final Automated Validation Results (from H4)

All commands run 2026-05-08.

| Command | Result |
|---|---|
| `npx tsc --noEmit` — `services/api-gateway` | PASS |
| `npx jest --testPathPatterns="csrf.guard\|events.controller.guard\|ai-execution-guards" --runInBand` | PASS — 40/40 (5 + 4 + 31) |
| `npx tsc --noEmit` — `services/container-manager` | PASS |
| `npm test -- files --runInBand` — `services/container-manager` | PASS — 2/2 |

**Cumulative H-family test record:**

| Slice | Tests run | Result |
|---|---|---|
| H2 | `csrf.guard.spec.ts` — 5 tests | PASS |
| H2 | Frontend `npm test` — 256 tests | PASS |
| H2 | Frontend `npm run build` | PASS |
| H3 | `events.controller.guard.spec.ts` — 4 tests | PASS |
| H3 | `ai-execution-guards.integration.spec.ts` — 31 tests | PASS |
| H3 | `files.service.spec.ts` — 2 tests | PASS |
| H4 | All three suites above reconfirmed — 40 tests | PASS |
| H4 | Both typechecks reconfirmed | PASS |

---

## 6. Manual Smoke Checklist

**Status: NOT RUN — deferred to user live environment.**

40 total items deferred across three families:
- F-family: 22 items (deferred since AUTH-APP-01F4)
- G-family: 12 items (deferred since AUTH-APP-01G4)
- H-specific: 6 items (deferred at H4)

All require a live Docker/PostgreSQL/Redis/api-gateway/frontend/browser environment. Dev servers are user-controlled.

The H-specific checklist is recorded in full in `docs/AUTH-APP-01H4-CHECKPOINT.md`.

---

## 7. Carry-Forward Items

### Requires a future dedicated investigation slice

| Item | Risk | Detail |
|---|---|---|
| Preview proxy `/api/preview/*` fully open | MEDIUM | Product/security decision outstanding: public vs. session-owner-only. Cross-service auth-forwarding design not yet specified. `ENABLE_PREVIEW_ACCESS_CONTROL=false` by default. |

### Requires environment action (user)

| Item | Severity | Action |
|---|---|---|
| Anthropic + XAI provider keys committed in prior git history | CRITICAL | Rotate at provider console before any push or deployment |
| Dev Redis password `aisandboxredis123` in prior git history | MEDIUM | Rotate if instance is network-accessible |

### Existing technical debt

| Item | Detail |
|---|---|
| api-gateway lint baseline — 353 pre-existing errors | Separate future lint cleanup slice; does not block H or Z |
| Backend full `npm test` — Redis environment constraint | Targeted test strategy is the established workaround; not a code defect |
| 40 manual smoke items deferred | Pending user running live environment |

---

## 8. Parent Family Status Notes

**AUTH-APP-01F:** VALIDATION COMPLETE — carry-forwards pending. Events endpoint carry-forwards absorbed and resolved in H3. Preview proxy carry-forward remains open (dedicated future slice). Manual smoke (22 items) remains deferred.

**AUTH-APP-01G:** VALIDATION COMPLETE — manual smoke deferred. All 12 G-family smoke items remain deferred to user live environment.

Neither AUTH-APP-01F nor AUTH-APP-01G can be promoted to COMPLETE and LOCKED until manual smoke is actually run and passes in a live environment.

---

## 9. AUTH-APP-01H Parent Status

**VALIDATION COMPLETE — manual smoke deferred.**

All automated validation passes. Secrets audit clean (post-cleanup). Manual smoke (40 items) deferred to user live environment. AUTH-APP-01H may be promoted to COMPLETE and LOCKED once the user runs the 40-item checklist against a live environment and confirms all items pass.

---

## Reference

- `docs/AUTH-APP-01H-SECURITY-HARDENING-SPEC.md` — governing spec for this family
- `docs/AUTH-APP-01H1-CHECKPOINT.md` — H1: inventory checkpoint
- `docs/AUTH-APP-01H2-CHECKPOINT.md` — H2: CSRF + rate limiting checkpoint
- `docs/AUTH-APP-01H3-CHECKPOINT.md` — H3: events guards + tooling checkpoint
- `docs/AUTH-APP-01H4-CHECKPOINT.md` — H4: secrets audit + validation + smoke disposition
- `docs/AUTH-APP-01F-CHECKPOINT.md` — F-family summary (carry-forwards)
- `docs/AUTH-APP-01G-CHECKPOINT.md` — G-family summary (carry-forwards)
- `docs/AUTH-APP-01-SPEC.md` — auth architecture decisions
- `TASKS.md` → AUTH-APP-01H
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01H

---

## Next Recommended Task

**AUTH-APP-01Z — Final AUTH-APP-01 Consolidation (PLANNED — next)**

AUTH-APP-01C2 remains BLOCKED pending transactional email provider selection. AUTH-APP-01Z does not depend on AUTH-APP-01C2. It should produce a full AUTH-APP-01 family summary and prepare the auth system for production handoff documentation.
