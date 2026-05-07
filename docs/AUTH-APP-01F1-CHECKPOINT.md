# AUTH-APP-01F1 Checkpoint — Route/API Protection Inventory + Spec

**Task ID:** AUTH-APP-01F1
**Date:** 2026-05-07
**Status:** COMPLETE and LOCKED
**Nature:** DOCUMENTATION / SPEC ONLY — no production source files changed
**Parent:** AUTH-APP-01F (ACTIVE)
**Depends on:** AUTH-APP-01E (COMPLETE and LOCKED)
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`

---

## Objective

Produce a concrete protection inventory and implementation spec before changing any route/API protection code. Inspect all frontend routes and backend controllers, classify each surface as public or authenticated, identify current guard coverage, identify protection gaps, and define the exact implementation boundaries for AUTH-APP-01F2, AUTH-APP-01F3, and AUTH-APP-01F4.

---

## Files Changed

| File | Change |
|---|---|
| `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` | **Created** — full route/API protection spec |
| `docs/AUTH-APP-01F1-CHECKPOINT.md` | **Created** — this checkpoint |
| `TASKS.md` | Updated: F1 COMPLETE and LOCKED; current stage advanced to F2 |
| `TASKS_BACKLOG_FULL.md` | Updated: F1 COMPLETE and LOCKED; acceptance checks marked |

**No production source files were changed.** No guards, controllers, frontend pages, configuration files, or npm dependencies were modified or installed. No database migrations were run.

---

## Spec Document Summary

**Path:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`

The spec covers 10 sections:

| Section | Summary |
|---|---|
| 1. Purpose and Scope | F1 is inventory/spec only. F2 = backend gaps. F3 = frontend routes. F4 = validation. |
| 2. Governing Invariants | 6 locked decisions: SessionCookieGuard is browser auth path; ApiKeyAuthGuard/DRIVER_API_KEY unchanged; InternalServiceAuthGuard unchanged; no Bearer session restoration; no localStorage access_token restoration; OAuth routes stay public. |
| 3. Frontend Route Inventory | 6 public routes, 4 authenticated routes (with gaps noted), 2 special-case routes (driver, test). No `middleware.ts` exists — all auth is reactive/client-side. |
| 4. Backend Controller Inventory | SessionCookieGuard: 10 controllers/surfaces. ApiKeyAuthGuard (do not change): 5 controllers. Internal-only (InternalServiceAuthGuard): 7 controllers. Intentionally public: 9 endpoints. Protection gaps: 8 items documented. |
| 5. Required Behavior Decisions | 11 locked decisions covering redirect behavior, auth path, Bearer/localStorage prohibition, DRIVER_API_KEY preservation, internal guard preservation, and public route classifications. |
| 6. F2 Boundaries | Backend-only. 5 items: AI execution cancel/get guards, service-to-service disposition (3 options), runtime metrics, preview proxy, dead file cleanup. |
| 7. F3 Boundaries | Frontend-only. 4 items: /keys and /account redirect fix (per-page bootstrap default), /driver documented, /test documented. |
| 8. F4 Boundaries | Validation + consolidation: backend unit tests, frontend redirect tests, manual smoke list of 13 routes. |
| 9. Carry-Forward Blockers | 3 pre-existing blockers from prior slices (Redis env, ai-execution.controller.spec.ts, ESLint). Not introduced by F1. |
| 10. Risks / Open Questions | 8 items: middleware.ts decision, preview proxy ownership, service-to-service exposure, driver auth model, test dev artifact, dead file, jwt-auth.guard.ts artifact, page flash. |

---

## Key F2 Implementation Boundaries (Backend Only)

1. **`POST /api/ai/executions/:executionId/cancel`** — no guard (HIGH risk). Add `ApiKeyAuthGuard` after verifying DRIVER_API_KEY caller compatibility.
2. **`GET /api/ai/executions/:executionId`** — no guard (MEDIUM risk). Add `ApiKeyAuthGuard` or document as intentionally public.
3. **`POST /api/chat-messages/add-by-session`**, **`POST /api/token-usage/record`**, **`POST /api/events/*`** — service-to-service without `/api/internal/` prefix (MEDIUM risk). Choose: (a) move to `/api/internal/` path, (b) add explicit `InternalServiceAuthGuard`, or (c) document as accepted exception.
4. **`GET /api/runtime/metrics`** — unguarded diagnostic surface. Add guard or explicitly document public.
5. **`@All /api/preview/*`** — proxy with no guard. Investigate container-manager session ownership validation before deciding.
6. **`services/api-gateway/src/auth/api-key.controllerXXXXX.ts`** — dead file with stale `JwtAuthGuard`. Delete in F2 cleanup. Also decide disposition of `jwt-auth.guard.ts` (unused but still on disk).

No frontend changes in F2.

---

## Key F3 Implementation Boundaries (Frontend Only)

1. **`/[locale]/keys`** (`frontend/app/[locale]/keys/page.tsx`) — GAP: shows error UI on 401, no login redirect. Add `GET /api/auth/me` bootstrap on mount; on failure call `router.push(/${locale}/login)`. Default approach: per-page bootstrap (matches workspace behavior).
2. **`/[locale]/account`** — inherits fix automatically once `/keys` is updated.
3. **`/[locale]/driver`** — document as intentionally separate DRIVER_API_KEY auth path. No cookie-session enforcement.
4. **`/test`** — document as dev artifact. No auth enforcement in this family.
5. **`middleware.ts`** — not in F3 scope by default. Requires explicit task amendment if preferred over per-page bootstrap.

No backend changes in F3.

---

## Acceptance Checks

- [x] Spec document created: `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md`
- [x] Public route inventory complete (6 public frontend routes documented)
- [x] Authenticated frontend route inventory complete (4 authenticated routes + gap classification)
- [x] Backend controller guard coverage documented for all 30 controllers
- [x] `DRIVER_API_KEY` endpoints explicitly identified and marked do-not-change
- [x] Internal-only endpoints explicitly identified (7 controllers under `/api/internal/`)
- [x] `JwtAuthGuard` confirmed removed from all active controllers — zero remaining usages
- [x] AUTH-APP-01F2 and AUTH-APP-01F3 implementation boundaries explicitly defined
- [x] Carry-forward blockers recorded
- [x] No production source files changed
- [x] No npm dependencies installed
- [x] No database migrations run
- [x] Checkpoint created: `docs/AUTH-APP-01F1-CHECKPOINT.md` (this file)

---

## Validation

Because this is a documentation-only task, no code compilation or test runs were required or performed. All source code is unchanged.

- `git status` confirmed: only `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (new), `TASKS.md` (modified — governance), `TASKS_BACKLOG_FULL.md` (modified — governance). No source files modified.
- Running `npx tsc --noEmit` or `npm test` against unchanged source would produce identical results to AUTH-APP-01E and is not meaningful validation for a docs-only slice.

---

## Non-Goals Confirmed

- No route guard implementation (AUTH-APP-01F2)
- No frontend middleware or redirect implementation (AUTH-APP-01F3)
- No OAuth or email/password changes
- No AUTH-MODULE-01 work
- No workspace UX changes
- No Visual Edit Mode
- No production source files changed

---

## Governing Invariants Preserved

All invariants from AUTH-APP-01A and AUTH-APP-01C1A are preserved and documented in the spec (Section 2):

1. `SessionCookieGuard` is the browser auth path
2. `ApiKeyAuthGuard` / `DRIVER_API_KEY` Bearer flows unchanged
3. `InternalServiceAuthGuard` on `/api/internal/*` unchanged
4. No `Authorization: Bearer` session-token restoration
5. No `localStorage` `access_token` restoration
6. OAuth entry/callback routes remain public

---

## Carry-Forward Blockers (Pre-existing — Not Introduced by F1)

| Blocker | Source |
|---|---|
| `npm test` backend full suite fails — `REDIS_URL` not set in test bootstrap environment | Pre-existing since AUTH-APP-01B |
| `ai-execution.controller.spec.ts` pre-existing test failures | Pre-existing before F1 |
| `npm run lint` in `services/api-gateway` — ESLint config not discoverable by package lint script | Pre-existing since AUTH-APP-01B |

These do not block F2, F3, or F4 provided targeted tests for those slices pass.

---

## Next Recommended Task

**AUTH-APP-01F2 — Backend API Protection Gaps**

Scope: backend-only. Implement the protection decisions for all items recorded in spec Section 4.5 and F2 boundaries above. No frontend changes.

Prerequisites before F2 stage-start:
- Read `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` Sections 4.5 and 6 in full
- Investigate `container-manager` preview session ownership validation (spec Section 6.4)
- Confirm `ai-service` and `container-manager` calling patterns for `chat-messages`, `token-usage`, and `events` endpoints (spec Section 6.2)

---

## Reference

- `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` — the spec produced by this task
- `docs/AUTH-APP-01-SPEC.md` Section 9 — route/API protection architecture decision
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `SessionCookieGuard` implementation
- `docs/AUTH-APP-01C1B-CHECKPOINT.md` — frontend localStorage/Bearer migration
- `docs/AUTH-APP-01D-CHECKPOINT.md` — Google OAuth
- `docs/AUTH-APP-01E-CHECKPOINT.md` — Apple OAuth
- `TASKS.md` → AUTH-APP-01F1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01F1
