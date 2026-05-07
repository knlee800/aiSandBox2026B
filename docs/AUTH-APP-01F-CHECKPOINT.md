# AUTH-APP-01F Checkpoint — Route / API Protection (Family Summary)

**Family ID:** AUTH-APP-01F
**Date:** 2026-05-07
**Status:** VALIDATION COMPLETE — carry-forwards pending
**Nature:** FAMILY-LEVEL SUMMARY — references child checkpoints; does not duplicate their content
**Parent:** AUTH-APP-01 (ACTIVE)
**Child slices:** F1 (COMPLETE) · F2 (COMPLETE) · F3 (COMPLETE) · F4 (COMPLETE)

---

## Purpose

This document is the family-level summary checkpoint for AUTH-APP-01F — Route / API Protection. It provides a single navigable record of what the F1–F4 slices accomplished, the current protection state of the platform, unresolved carry-forward items, and the recommendation for next work.

For implementation detail, validation commands, and code-level evidence, see the individual child checkpoints listed in Section 2.

---

## 1. What AUTH-APP-01F Accomplished

### Protection gaps closed

| Surface | Before AUTH-APP-01F | After AUTH-APP-01F |
|---|---|---|
| `POST /api/ai/executions/:id/cancel` | Unguarded (HIGH risk) | `ApiKeyAuthGuard` — method level |
| `GET /api/ai/executions/:id` | Unguarded (MEDIUM risk) | `ApiKeyAuthGuard` — method level |
| `GET /api/ai/executions/:id/stream` | Unguarded (MEDIUM risk) | `ApiKeyAuthGuard` — method level |
| `POST /api/chat-messages/add-by-session` | Unguarded (MEDIUM risk) | `InternalServiceAuthGuard` — class level |
| `POST /api/token-usage/record` | Unguarded (MEDIUM risk) | `InternalServiceAuthGuard` — class level |
| `GET /api/runtime/metrics` | Unguarded (LOW-MEDIUM risk) | `InternalServiceAuthGuard` — class level |
| `/[locale]/keys` (unauthenticated) | Shows error overlay (no redirect) | Redirects to `/${locale}/login` |
| `/[locale]/account` (unauthenticated) | Inherits keys gap | Inherits keys fix |

### Dead files removed

| File | Reason |
|---|---|
| `services/api-gateway/src/auth/api-key.controllerXXXXX.ts` | Stale dead file; `@UseGuards(JwtAuthGuard)` pre-migration artifact; not loaded at runtime |
| `services/api-gateway/src/auth/jwt-auth.guard.ts` | Only reference was the dead controller above; safe to delete |

### Documentation produced

| Document | Purpose |
|---|---|
| `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` | Full route/API protection inventory and implementation spec |
| `docs/AUTH-APP-01F1-CHECKPOINT.md` | F1: inventory/spec checkpoint |
| `docs/AUTH-APP-01F2-CHECKPOINT.md` | F2: backend guard fixes checkpoint |
| `docs/AUTH-APP-01F3-CHECKPOINT.md` | F3: frontend protected route checkpoint |
| `docs/AUTH-APP-01F4-CHECKPOINT.md` | F4: validation + consolidation checkpoint |
| `docs/AUTH-APP-01F-CHECKPOINT.md` | This document — family summary |

### Governance locked

Eleven behavior decisions were formally locked in the spec and preserved across all four slices (see `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` Section 5):

1. Unauthenticated access to a protected frontend page redirects to `/[locale]/login`
2. Unauthenticated access to a protected backend API returns HTTP 401 or 403
3. Cookie-session (`SessionCookieGuard`) is the exclusive browser auth path
4. No `Authorization: Bearer <session-token>` path may be added or restored
5. No `localStorage` `access_token` read-and-use path may be added or restored
6. `DRIVER_API_KEY` Bearer flows remain unchanged
7. `InternalServiceAuthGuard` on `/api/internal/*` remains unchanged
8. OAuth entry and callback routes remain public
9. `/[locale]/share`, `/[locale]/share/[projectId]`, `/[locale]/gallery` remain public
10. `/[locale]/driver` is the intentionally separate DRIVER_API_KEY auth path
11. `/test` is a dev artifact; no auth enforcement added in this family

---

## 2. Child Checkpoint Index

| Slice | Status | Checkpoint | Key output |
|---|---|---|---|
| AUTH-APP-01F1 | COMPLETE and LOCKED | `docs/AUTH-APP-01F1-CHECKPOINT.md` | Route/API protection inventory and spec |
| AUTH-APP-01F2 | COMPLETE and LOCKED | `docs/AUTH-APP-01F2-CHECKPOINT.md` | 6 backend guard additions; 2 dead files deleted |
| AUTH-APP-01F3 | COMPLETE and LOCKED | `docs/AUTH-APP-01F3-CHECKPOINT.md` | `/keys` auth bootstrap; 3-test coverage |
| AUTH-APP-01F4 | COMPLETE and LOCKED | `docs/AUTH-APP-01F4-CHECKPOINT.md` | 9 targeted tests PASS; family consolidation |

---

## 3. Current Protection State

### Frontend routes

| Route | Auth behavior | Status |
|---|---|---|
| `/[locale]` | Public | Correct — no change needed |
| `/[locale]/login` | Public | Correct — no change needed |
| `/[locale]/register` | Public | Correct — no change needed |
| `/[locale]/share` | Public | Correct — no change needed |
| `/[locale]/share/[projectId]` | Public read; backend-enforced auth for fork | Correct — no change needed |
| `/[locale]/gallery` | Public | Correct — no change needed |
| `/[locale]/app` | `GET /api/auth/me` bootstrap → redirect on 401 | Correct — pre-existing behavior; verified |
| `/[locale]/keys` | `GET /api/auth/me` bootstrap → redirect on 401 | **Fixed in F3** |
| `/[locale]/account` | Inherits `/keys` behavior | **Fixed in F3 (inherited)** |
| `/[locale]/projects` | Delegates to `/app` | Correct — inherits protection |
| `/[locale]/driver` | DRIVER_API_KEY Bearer; intentionally separate | Locked — no change |
| `/test` | Dev artifact; unprotected | Locked — no change |

### Backend API endpoints (selected — protected surfaces added in F2)

| Endpoint | Guard | Auth path |
|---|---|---|
| `POST /api/ai/execute` | `ApiKeyAuthGuard` + chain | DRIVER_API_KEY Bearer |
| `POST /api/ai/executions/:id/cancel` | `ApiKeyAuthGuard` (added F2) | DRIVER_API_KEY Bearer |
| `GET /api/ai/executions/:id` | `ApiKeyAuthGuard` (added F2) | DRIVER_API_KEY Bearer |
| `GET /api/ai/executions/:id/stream` | `ApiKeyAuthGuard` (added F2) | DRIVER_API_KEY Bearer |
| `POST /api/chat-messages/add-by-session` | `InternalServiceAuthGuard` (added F2) | X-Internal-Service-Key |
| `POST /api/token-usage/record` | `InternalServiceAuthGuard` (added F2) | X-Internal-Service-Key |
| `GET /api/runtime/metrics` | `InternalServiceAuthGuard` (added F2) | X-Internal-Service-Key |
| All `/api/keys`, `/api/sessions`, `/api/projects`, `/api/users/me` etc. | `SessionCookieGuard` (pre-existing) | aisandbox_session cookie |
| All `/api/internal/*` | `InternalServiceAuthGuard` (pre-existing APP_GUARD) | X-Internal-Service-Key |

### Endpoints with accepted carry-forward (still unguarded after F4)

| Endpoint | Reason | Target |
|---|---|---|
| `POST /api/events/file-changed` | container-manager callers don't send X-Internal-Service-Key | AUTH-APP-01F2a or AUTH-APP-01H |
| `POST /api/events/checkpoint-created` | Same | AUTH-APP-01F2a or AUTH-APP-01H |
| `POST /api/events/token-updated` | Same | AUTH-APP-01F2a or AUTH-APP-01H |
| `@All /api/preview/*` | Cross-service coordination; auth-forwarding not designed | Dedicated investigation slice |

---

## 4. Unresolved Carry-Forward Items

### Unguarded endpoints (require future slices)

| Item | Detail | Target |
|---|---|---|
| Events endpoints (3) | Container-manager `files.service.ts` and `git.service.ts` call these via raw `httpService.post()` without `X-Internal-Service-Key`. Fix requires updating those two container-manager callers to use `ApiGatewayHttpClient` pattern, then adding `@UseGuards(InternalServiceAuthGuard)` to `EventsController`. | AUTH-APP-01F2a or AUTH-APP-01H |
| Preview proxy | `PreviewController` blindly proxies all methods to container-manager without forwarding user identity. Container-manager's existing access control flag (`ENABLE_PREVIEW_ACCESS_CONTROL`) uses the old JWT Bearer pattern — incompatible with `SessionCookieGuard`. Requires a new auth-forwarding design across both services. | Dedicated investigation slice |

### Manual smoke checklist not run

| Item | Reason | Target |
|---|---|---|
| Full 22-item manual smoke checklist (spec Section 8.3) | No live environment available (Docker/PostgreSQL/Redis not running) | AUTH-APP-01H |

### Pre-existing test/tooling blockers

| Blocker | Source | Target |
|---|---|---|
| Backend full `npm test` — `REDIS_URL` not set | Pre-existing since AUTH-APP-01B | AUTH-APP-01H or infra fix |
| `ai-execution-guards.integration.spec.ts` full suite — `QuotaService` unresolved dependency | Pre-existing before AUTH-APP-01F1 | AUTH-APP-01H or dedicated fix |
| `npm run lint` in `services/api-gateway` — ESLint config not discoverable | Pre-existing since AUTH-APP-01B | AUTH-APP-01H or infra fix |

---

## 5. Recommendation for Next Work

**AUTH-APP-01G (Auth UX Integration) may begin.**

AUTH-APP-01G covers OAuth buttons, profile page, and auth UX polish. It does not depend on the events or preview carry-forward items being resolved. Those carry-forwards are tracked explicitly in this checkpoint and in AUTH-APP-01F4-CHECKPOINT.md.

**AUTH-APP-01H (Security Hardening + Validation Checklist)** should include:
- The full manual smoke checklist (22 items, listed in AUTH-APP-01F4-CHECKPOINT.md)
- Events endpoint guard completion (AUTH-APP-01F2a scope absorbed or tracked separately)
- Preview proxy investigation and resolution

**AUTH-APP-01F parent status:** VALIDATION COMPLETE — carry-forwards pending. The parent task remains active in TASKS.md because two confirmed protection gaps (events, preview) are unresolved. It may not be declared fully COMPLETE until those gaps are closed.

---

## Reference

- `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` — the governing spec for this family
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `SessionCookieGuard` implementation
- `docs/AUTH-APP-01C1B-CHECKPOINT.md` — frontend localStorage/Bearer migration
- `docs/AUTH-APP-01D-CHECKPOINT.md` — Google OAuth
- `docs/AUTH-APP-01E-CHECKPOINT.md` — Apple OAuth
- `TASKS.md` → AUTH-APP-01F
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01F
