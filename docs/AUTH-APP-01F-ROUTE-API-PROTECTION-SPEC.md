# AUTH-APP-01F — Route / API Protection Spec

**Date:** 2026-05-07
**Task:** AUTH-APP-01F1 — Route/API Protection Inventory + Spec
**Status:** APPROVED — gates AUTH-APP-01F2, AUTH-APP-01F3, AUTH-APP-01F4 implementation
**Nature:** INVENTORY AND SPEC DOCUMENT ONLY — no production code changes in F1
**Parent:** AUTH-APP-01F (Route / API Protection)
**Source:** Stage-start inspection of all frontend routes and backend controllers as of AUTH-APP-01E COMPLETE

---

## 1. Purpose and Scope

This document is the protection inventory and implementation spec for AUTH-APP-01F — Route / API Protection. It documents the current state of every frontend route and backend API controller, classifies each surface as public or authenticated, identifies protection gaps, and defines the exact implementation boundaries for child slices F2, F3, and F4.

**This document is produced in F1. No production code is changed in F1.**

### Slice responsibilities

| Slice | Scope |
|---|---|
| AUTH-APP-01F1 (this) | Inventory, classification, gap identification, implementation boundaries |
| AUTH-APP-01F2 | Backend API protection gaps only — no frontend changes |
| AUTH-APP-01F3 | Frontend protected-route behavior only — no backend changes |
| AUTH-APP-01F4 | Validation, testing, consolidation, carry-forward recording |

### What this spec does NOT cover

- AUTH-APP-01G — Auth UX Integration (OAuth buttons, profile page, polish)
- AUTH-APP-01H — Security Hardening and Validation Checklist
- AUTH-APP-01C2 — Email verification and password reset (blocked on email provider)
- AUTH-MODULE-01 — reusable generated app-auth for user-created apps (separate later family)
- DRIVER_API_KEY implementation changes (locked invariant — see Section 2)
- InternalServiceAuthGuard implementation changes (locked invariant — see Section 2)

---

## 2. Governing Invariants

The following are locked architectural decisions from AUTH-APP-01A and AUTH-APP-01C1A. They must not be changed in F2, F3, F4, or any downstream slice without explicit task authorization.

1. **`SessionCookieGuard` is the browser auth path.** The `aisandbox_session` HTTP-only cookie, validated against the `auth_sessions` table, is how browser clients authenticate. No other mechanism is acceptable for browser-facing endpoints.

2. **`ApiKeyAuthGuard` and `DRIVER_API_KEY` Bearer flows remain unchanged.** All endpoints currently using `ApiKeyAuthGuard` (including `Authorization: Bearer <api-key>` flows) must not have their guard configuration altered in F2 or F3. These serve programmatic API clients, not browser sessions.

3. **`InternalServiceAuthGuard` on `/api/internal/*` remains unchanged.** The global `APP_GUARD` registration of `InternalServiceAuthGuard` in `app.module.ts` is locked. All routes under `/api/internal/` are protected by the `X-Internal-Service-Key` header check. No changes to this mechanism in F2 or F3.

4. **No `Authorization: Bearer` session-token restoration.** The old pattern of storing a JWT `access_token` in `localStorage` and attaching it as a Bearer header is fully removed. No code may reintroduce it.

5. **No `localStorage` access_token restoration.** Any code path that reads `localStorage` for an `access_token` and uses it to authenticate API calls is prohibited. This was the pre-AUTH-APP-01C1A behavior and must not return.

6. **Public auth/login/register/OAuth routes remain public.** `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/auth/apple`, and `POST /api/auth/apple/callback` must never require a session cookie guard. They are the entry points for unauthenticated users.

---

## 3. Frontend Route Inventory

### 3.1 Public Routes (must stay public)

| Route | File | Current behavior | Classification |
|---|---|---|---|
| `/[locale]` | `frontend/app/[locale]/page.tsx` | Renders `PublicLandingSlice`; no auth check | **PUBLIC** |
| `/[locale]/login` | `frontend/app/[locale]/login/page.tsx` | Auth form; `POST /api/auth/login`; redirects to `/[locale]/app` on success | **PUBLIC** |
| `/[locale]/register` | `frontend/app/[locale]/register/page.tsx` | Auth form; `POST /api/auth/register` | **PUBLIC** |
| `/[locale]/share` | `frontend/app/[locale]/share/page.tsx` | Loads `GET /api/projects/public`; no auth required | **PUBLIC** |
| `/[locale]/share/[projectId]` | `frontend/app/[locale]/share/[projectId]/page.tsx` | Loads `GET /api/projects/public/:id`; fork action calls `POST /api/projects/public/:id/fork` which requires `SessionCookieGuard` on the backend | **PUBLIC read; backend-enforced auth for fork** |
| `/[locale]/gallery` | `frontend/app/[locale]/gallery/page.tsx` | Feature-flagged: if `PROJECT_FIRST_UX=false` → `redirect(/share)`; otherwise renders `PublicShareBrowsePage` | **PUBLIC** |

### 3.2 Authenticated Frontend Routes

These routes require a valid `aisandbox_session` cookie. Access without a valid session must redirect to `/[locale]/login`.

| Route | File | Current auth behavior | Gap |
|---|---|---|---|
| `/[locale]/app` | `frontend/app/[locale]/app/page.tsx` | `GET /api/auth/me` on mount; redirects to `/[locale]/login` on failure (404/401/exception). `handleWorkspaceUnauthorizedAccess()` catches downstream 401s. | **No gap — reactive bootstrap present** |
| `/[locale]/keys` | `frontend/app/[locale]/keys/page.tsx` | Calls `GET /api/keys` (backend: `SessionCookieGuard`); shows `ErrorRemediation` UI on 401; does **not** redirect to login | **GAP — no login redirect on unauthenticated access** |
| `/[locale]/account` | `frontend/app/[locale]/account/page.tsx` | Feature-flagged: if `PROJECT_FIRST_UX=false` → `redirect(/keys)`; otherwise renders `ApiKeysPage` directly | **GAP — inherits `/keys` gap** |
| `/[locale]/projects` | `frontend/app/[locale]/projects/page.tsx` | Feature-flagged: if `PROJECT_FIRST_UX=false` → `redirect(/app)`; otherwise renders `AppPage` | **Inherits `/app` bootstrap via delegation** |

### 3.3 Ambiguous / Special-Case Routes

| Route | File | Current behavior | Classification |
|---|---|---|---|
| `/[locale]/driver` | `frontend/app/[locale]/driver/page.tsx` | Uses `DRIVER_API_KEY` Bearer token pattern; state persisted in `localStorage` under `driver_last_execution_state`; sends `Authorization: Bearer <DRIVER_API_KEY>` to `/api/ai/execute` | **Intentionally separate DRIVER_API_KEY auth path — do not apply cookie-session auth** |
| `/test` | `frontend/app/test/page.tsx` | Renders `<div>Test Page - No i18n</div>`; no locale prefix; no auth check; no i18n | **Dev artifact — unprotected by design; no auth added** |

### 3.4 Layout and Middleware

- `frontend/app/layout.tsx` — Root layout; returns `children` only; no auth logic.
- `frontend/app/[locale]/layout.tsx` — Locale layout; validates locale; renders `TranslationProvider` and `SystemReadiness`; no auth logic.
- **No `middleware.ts` exists.** There is no Next.js request-level middleware file anywhere in the `frontend/` tree. All current frontend auth enforcement is client-side and reactive. This is a gap addressed in F3.

---

## 4. Backend Controller / API Inventory

### 4.1 SessionCookieGuard-Covered Controllers

These are correctly guarded. No changes required in F2.

| Controller | Route prefix | Guard scope | Methods |
|---|---|---|---|
| `AdminOperationalController` | `GET /api/admin/users`, `GET /api/admin/users/:id`, `GET /api/admin/sessions`, `DELETE /api/admin/sessions/:id` | class-level `SessionCookieGuard` + `AdminRoleGuard` | All methods |
| `ApiKeyController` | `GET /api/keys`, `POST /api/keys`, `DELETE /api/keys/:id` | class-level `SessionCookieGuard` | All methods |
| `CheckpointsController` | `POST/GET /api/sessions/:id/checkpoints`, `GET /api/sessions/:id/checkpoints/:hash/diff`, `POST /api/sessions/:id/revert` | class-level `SessionCookieGuard` | All methods |
| `ConversationController` | `GET /api/sessions/:id/conversation`, `GET /api/conversations/:id/messages`, `POST /api/sessions/:id/messages` | class-level `SessionCookieGuard` | All methods |
| `ProjectsController` | `POST/GET/PATCH /api/projects`, `PATCH /api/projects/:id/workspace`, `PATCH /api/projects/:id/visibility`, `POST /api/projects/:id/sessions/:sessionId`, `POST /api/projects/:id/open` | class-level `SessionCookieGuard` | All methods |
| `SessionController` | `POST/GET/DELETE /api/sessions`, `POST /api/sessions/:id/stop`, `POST /api/sessions/:id/exec`, file ops, snapshot ops, export/import | class-level `SessionCookieGuard` (additional `RateLimitGuard`/`SessionQuotaGuard` on some methods) | All methods |
| `UsersController` | `GET /api/users/me`, `GET /api/users/me/usage`, `GET /api/users/me/quotas`, `GET /api/users/me/snapshots` | class-level `SessionCookieGuard` | All methods |
| `WorkspacesController` | `POST/GET/PATCH/DELETE /api/workspaces`, `GET/PATCH/DELETE /api/workspaces/:id` | class-level `SessionCookieGuard` | All methods |
| `AuthController` (partial) | `GET /api/auth/me`, `POST /api/auth/logout` | method-level `SessionCookieGuard` | Those two endpoints only |
| `PublicProjectsController` (partial) | `POST /api/projects/public/:id/fork` | method-level `SessionCookieGuard` | Fork only; list/get are public |

### 4.2 ApiKeyAuthGuard / DRIVER_API_KEY Endpoints (do not change)

These use `Authorization: Bearer <api-key>` and are the programmatic/driver API surface. They must not be modified in F2 or F3.

| Controller | Route prefix | Guard | Notes |
|---|---|---|---|
| `BillingVisibilityController` | `GET /api/billing/snapshots`, `/snapshots/:id`, `/summary`, etc. | class-level `ApiKeyAuthGuard` + `AuthorizationGuard` | Internal billing visibility |
| `PublicAiController` | `POST /api/v1/ai/execute`, `GET /api/v1/ai/executions/:id` | class-level `ApiKeyAuthGuard` + `PublicApiRateLimitGuard` | Public API surface |
| `PublicFilesController` | `POST /api/v1/files/list`, `/read`, `/write` | class-level `ApiKeyAuthGuard` + `PublicApiRateLimitGuard` | Public API surface |
| `PublicProjectsController` | `GET/POST /api/v1/projects` | class-level `ApiKeyAuthGuard` + `PublicApiRateLimitGuard` | Public API surface (distinct from `projects/public` controller) |
| `PublicSessionsController` | `POST/GET /api/v1/sessions` | class-level `ApiKeyAuthGuard` + `PublicApiRateLimitGuard` | Public API surface |
| `AiExecutionController` (partial) | `POST /api/ai/execute` | method-level `ApiKeyAuthGuard` + chain guards | DRIVER_API_KEY flow — do not change this method's guards |

### 4.3 Internal-Only Endpoints (InternalServiceAuthGuard — do not change)

Protected globally via `APP_GUARD` in `app.module.ts`. The guard activates only for paths starting with `/api/internal/`. All routes below fall under that prefix and require `X-Internal-Service-Key` header.

| Controller | Route prefix | Notes |
|---|---|---|
| `AdminDashboardController` | `GET /api/internal/admin/users`, `GET /api/internal/admin/sessions` | Admin visibility |
| `AdminController` | `GET /api/internal/admin/users/:id/summary`, `GET /api/internal/admin/invoices`, etc. | Admin billing + user summary |
| `ReconciliationController` | `GET /api/internal/admin/reconciliation/invoices/:id`, `/users/:id/period`, `/ready-to-charge` | Billing reconciliation |
| `InternalGitCheckpointController` | `POST /api/internal/git-checkpoints` | container-manager → api-gateway |
| `InternalSessionController` | `POST /api/internal/sessions/:id/start`, `/stop`, `/error` | container-manager → api-gateway |
| `InternalTokenUsageController` | `GET /api/internal/token-usage/sessions/:sessionId/total` | Token usage lookup |
| `InvoicesController` | `POST /api/internal/invoices/draft`, `GET /api/internal/invoices/:id`, `GET /api/internal/invoices/by-key/:key` | Billing invoices |

### 4.4 Intentionally Public Endpoints

These must never be guarded.

| Controller | Endpoint | Rationale |
|---|---|---|
| `AuthController` | `POST /api/auth/login` | Auth entry point |
| `AuthController` | `POST /api/auth/register` | Auth entry point |
| `AuthController` | `GET /api/auth/google` | OAuth entry |
| `AuthController` | `GET /api/auth/google/callback` | OAuth callback |
| `AuthController` | `GET /api/auth/apple` | OAuth entry |
| `AuthController` | `POST /api/auth/apple/callback` | OAuth callback (POST per Apple spec) |
| `HealthController` | `GET /api/health`, `GET /api/health/db`, `GET /api/health/ready` | Health/readiness checks |
| `PublicProjectsController` | `GET /api/projects/public`, `GET /api/projects/public/:id` | Public project browsing |
| `PublicDocsController` | `GET /api/v1/docs` | Public API documentation |

### 4.5 Protection Gaps — Identified for F2

The following endpoints currently have no authentication guard and their classification is either a confirmed gap or requires an explicit disposition decision in F2.

#### 4.5.1 High risk — confirmed gap

| Endpoint | Controller | Current guards | Risk | F2 action |
|---|---|---|---|---|
| `POST /api/ai/executions/:executionId/cancel` | `AiExecutionController` | None | HIGH — any unauthenticated caller can cancel any execution by ID | Add `ApiKeyAuthGuard` if compatible with caller; verify DRIVER_API_KEY flow covers this path |
| `GET /api/ai/executions/:executionId` | `AiExecutionController` | None | MEDIUM — exposes execution status to unauthenticated callers | Add `ApiKeyAuthGuard` if compatible; else document rationale for public access |

Note: `POST /api/ai/execute` on the same controller has `@UseGuards(ApiKeyAuthGuard, ...)` at method-level. The cancel and status endpoints sit on the same controller but lack that guard — this appears to be an omission.

#### 4.5.2 Medium risk — service-to-service endpoints not under `/api/internal/`

These endpoints are consumed by internal services (ai-service, container-manager) but are not under the `/api/internal/` path prefix and therefore do not receive `InternalServiceAuthGuard` protection. Any external caller can reach them.

| Endpoint | Controller | Current guards | Risk | F2 decision options |
|---|---|---|---|---|
| `POST /api/chat-messages/add-by-session` | `ChatMessageController` | None | MEDIUM — any caller can insert chat messages | (a) Move to `/api/internal/` path, (b) add explicit `InternalServiceAuthGuard`, (c) document as accepted risk |
| `POST /api/token-usage/record` | `TokenUsageController` | None | MEDIUM — any caller can inject token usage records | Same options as above |
| `POST /api/events/file-changed`, `POST /api/events/checkpoint-created`, `POST /api/events/token-updated` | `EventsController` | None | MEDIUM — any caller can inject WebSocket events to any session | Same options as above |

#### 4.5.3 Lower risk — diagnostic / proxy surfaces

| Endpoint | Controller | Current guards | Risk | F2 decision |
|---|---|---|---|---|
| `GET /api/runtime/metrics` | `RuntimeController` | None | LOW-MEDIUM — exposes container count, session stats, uptime | Add guard or explicitly document as intentionally public diagnostic |
| `@All /api/preview/*` | `PreviewController` | None | NEEDS DECISION — proxies all methods to container-manager; may proxy arbitrary requests | Determine if session ownership is validated by container-manager; add guard if not |

#### 4.5.4 Dead file — stale artifact

| File | Issue | F2 action |
|---|---|---|
| `services/api-gateway/src/auth/api-key.controllerXXXXX.ts` | Contains `@Controller('keys')` with `@UseGuards(JwtAuthGuard)` — the old pre-migration guard. This file is **not imported** in `auth.module.ts` and is never loaded at runtime. However it is misleading and contains a reference to the now-unused `JwtAuthGuard` pattern. | Delete file in F2 cleanup pass |

---

## 5. Required Behavior Decisions

The following decisions are locked for the F2–F4 implementation. They must not be reversed without an explicit task amendment.

| # | Decision | Status |
|---|---|---|
| 1 | Unauthenticated access to a protected frontend page redirects the user to `/[locale]/login` | LOCKED |
| 2 | Unauthenticated access to a protected backend API endpoint returns HTTP 401 or 403 consistently | LOCKED |
| 3 | Cookie-session (`aisandbox_session` + `SessionCookieGuard`) is the exclusive browser auth path | LOCKED |
| 4 | No `Authorization: Bearer <session-token>` path may be added or restored for browser clients | LOCKED |
| 5 | No `localStorage` `access_token` read-and-use path may be added or restored | LOCKED |
| 6 | `DRIVER_API_KEY` Bearer flows remain unchanged | LOCKED |
| 7 | `InternalServiceAuthGuard` on `/api/internal/*` remains unchanged | LOCKED |
| 8 | OAuth entry and callback routes remain public (no guard) | LOCKED |
| 9 | `/[locale]/share`, `/[locale]/share/[projectId]` (read), `/[locale]/gallery` remain public | LOCKED |
| 10 | `/[locale]/driver` is classified as intentionally outside cookie-session auth | LOCKED |
| 11 | `/test` is classified as a dev artifact; no auth enforcement is added in this family | LOCKED |

---

## 6. F2 Implementation Boundaries — Backend API Protection Gaps

**F2 is backend-only. No frontend files may be changed in F2.**

### 6.1 AI execution cancel and status endpoints

File: `services/api-gateway/src/ai/ai-execution.controller.ts`

- Verify whether `POST /api/ai/executions/:executionId/cancel` and `GET /api/ai/executions/:executionId` are called by DRIVER_API_KEY clients, browser clients, or internal services.
- If DRIVER_API_KEY callers are the only consumers: add `@UseGuards(ApiKeyAuthGuard)` at method level to both.
- If browser clients also call these: add `@UseGuards(SessionCookieGuard)` or a composite guard.
- If the decision is to leave them intentionally public (e.g. read-only status is non-sensitive): document rationale explicitly in the F2 checkpoint.

### 6.2 Service-to-service endpoints without `/api/internal/` prefix

Files: `src/chat-messages/chat-message.controller.ts`, `src/token-usage/token-usage.controller.ts`, `src/websocket/events.controller.ts`

Three disposition options — F2 must choose one for each:

**Option A (recommended for chat-messages and token-usage):** Move to `/api/internal/` path prefix. Rename `@Controller('chat-messages')` to `@Controller('internal/chat-messages')` and `@Controller('token-usage')` to `@Controller('internal/token-usage')`. Update any ai-service callers. This gives automatic `InternalServiceAuthGuard` protection.

**Option B:** Keep current paths but add an explicit `@UseGuards(InternalServiceAuthGuard)` at class level. No path change required but callers must send `X-Internal-Service-Key`.

**Option C:** Document as an accepted, intentional public endpoint with rationale (e.g. "only reachable within the private container network"). Record in F2 checkpoint. This is the lowest-effort option but requires a security decision.

F2 must record which option was chosen for each controller. The choice must be consistent with how `ai-service` and `container-manager` call these endpoints.

### 6.3 Runtime metrics endpoint

File: `services/api-gateway/src/runtime/runtime.controller.ts`

`GET /api/runtime/metrics` exposes container count, session count, termination reasons, and uptime. F2 must choose one:

- Add `@UseGuards(InternalServiceAuthGuard)` — most secure; restrict to internal callers only.
- Add `@UseGuards(SessionCookieGuard)` — makes it admin-browser-accessible.
- Explicitly document as public diagnostic endpoint — acceptable if data is considered non-sensitive.

### 6.4 Preview proxy endpoint

File: `services/api-gateway/src/preview/preview.controller.ts`

`@All /api/preview/*` proxies all HTTP methods to `container-manager`. F2 must determine:

- Does `container-manager` independently validate that the requesting session owns the preview? If yes, the proxy can remain unguarded at the API gateway level (the ownership check is delegated).
- If container-manager does not validate session ownership: add `@UseGuards(SessionCookieGuard)` to the proxy handler.

This requires reading the container-manager codebase and is a prerequisite investigation for F2.

### 6.5 Dead file cleanup

File: `services/api-gateway/src/auth/api-key.controllerXXXXX.ts`

Delete this file in F2. It is not imported or loaded. It contains a stale `@UseGuards(JwtAuthGuard)` reference that is misleading. Verify it is absent from `auth.module.ts` imports before deleting.

### 6.6 F2 acceptance gate

F2 is complete when:
- All five items above have a recorded disposition (either a code change or an explicit accepted-exception decision)
- `npx tsc --noEmit` passes in `services/api-gateway`
- Affected unit tests pass
- No frontend files were changed

---

## 7. F3 Implementation Boundaries — Frontend Protected Route Behavior

**F3 is frontend-only. No backend files may be changed in F3.**

### 7.1 `/keys` and `/account` login redirect gap

File: `frontend/app/[locale]/keys/page.tsx`

Currently `GET /api/keys` returns 401 if the session cookie is absent or invalid. The page handles this via `ErrorRemediation` component — showing an error UI — but does not redirect to `/[locale]/login`. This is inconsistent with the workspace (`/app`) behavior.

F3 must add a login redirect triggered on 401 from `GET /api/keys`. The approach:

- **Default approach (per-page `GET /api/auth/me` bootstrap):** Add a `useEffect` on mount that calls `GET /api/auth/me`. If the response is not OK, call `router.push(/${locale}/login)`. This is consistent with how `/app` works and requires no new infrastructure. This is the default approach unless `middleware.ts` is explicitly approved (see Section 10).

`/account` delegates to `ApiKeysPage` so it inherits the fix automatically once `/keys` is updated.

### 7.2 Auth bootstrap approach decision

Two approaches are available for F3. The default is per-page bootstrap. Middleware requires explicit separate approval.

**Per-page `GET /api/auth/me` bootstrap (default):**
- Each protected page adds a `useEffect` that calls `GET /api/auth/me` on mount.
- On failure: `router.push(/${locale}/login)`.
- Pros: consistent with existing `/app` behavior; no new infrastructure; low risk.
- Cons: brief flash of page content before redirect fires; every new protected page must remember to add the check.

**Next.js `middleware.ts` (requires explicit approval, not in F3 scope by default):**
- A `middleware.ts` at `frontend/middleware.ts` intercepts all requests server-side before page rendering.
- On unauthenticated request to a protected path: redirect to `/[locale]/login` before the page renders.
- Pros: no flash; centralized; new protected pages are covered automatically.
- Cons: Next.js middleware runs in the Edge runtime — no Node.js APIs, limited cookie inspection; requires a server-side session validation mechanism compatible with the Edge runtime or a lightweight cookie-presence check only.
- **Not in F3 scope unless explicitly approved in a separate task amendment.**

### 7.3 `/driver` — intentionally separate auth path

File: `frontend/app/[locale]/driver/page.tsx`

The driver page uses `DRIVER_API_KEY` Bearer token authentication. It reads `DRIVER_LAST_EXECUTION_STATE_KEY` from `localStorage`. This is an intentionally separate auth model for programmatic/driver clients and must not be changed to use cookie-session auth. F3 adds no auth changes to this page. Document in the F3 checkpoint.

### 7.4 `/test` — dev artifact

File: `frontend/app/test/page.tsx`

This page is a dev artifact — no locale prefix, no auth, no i18n. F3 adds no auth changes. Document in the F3 checkpoint as a known dev artifact. If it needs to be removed or gated, that is out of scope for AUTH-APP-01F.

### 7.5 F3 acceptance gate

F3 is complete when:
- `/keys` redirects to `/[locale]/login` on unauthenticated access
- `/account` inherits the redirect via delegation
- `npx tsc --noEmit` passes in `frontend`
- `npm test` passes in `frontend`
- `npm run build` passes in `frontend`
- No backend files were changed

---

## 8. F4 Validation / Consolidation Boundaries

F4 runs after both F2 and F3 are complete. It validates, consolidates, and records any remaining carry-forwards before closing AUTH-APP-01F.

### 8.1 Backend guard and controller unit tests (targeted)

- `SessionCookieGuard` unit test: confirm it returns 401 when cookie is absent, when session is expired, and when session is revoked.
- Affected controllers (F2 additions): confirm the newly guarded endpoints reject unauthenticated requests.
- `InternalServiceAuthGuard` unit test: confirm it passes non-internal routes and blocks internal routes without a valid key.
- `api-key.controllerXXXXX.ts` deletion confirmed — file no longer present.

### 8.2 Frontend redirect tests

Where feasible:
- Unit test for `/keys` page: mock `GET /api/auth/me` returning 401; assert `router.push` was called with `/${locale}/login`.
- Regression test for `/app` page bootstrap: existing auth bootstrap behavior must remain intact.

### 8.3 Manual smoke list

The following must be verified manually against a running environment with no `aisandbox_session` cookie:

| Route | Expected behavior |
|---|---|
| `GET /[locale]/app` | Redirects to `/[locale]/login` |
| `GET /[locale]/keys` | Redirects to `/[locale]/login` |
| `GET /[locale]/account` | Redirects to `/[locale]/login` |
| `GET /api/keys` (no cookie) | 401 Unauthorized |
| `GET /api/users/me` (no cookie) | 401 Unauthorized |
| `GET /api/sessions` (no cookie) | 401 Unauthorized |
| `GET /api/projects` (no cookie) | 401 Unauthorized |
| `POST /api/ai/executions/:id/cancel` (no auth) | 401 or 403 (after F2) |
| `GET /api/auth/me` (no cookie) | 401 Unauthorized |
| `POST /api/auth/login` (no cookie) | 200/400 (public, no cookie required) |
| `GET /api/health` | 200 OK (public) |
| `GET /api/projects/public` | 200 OK (public) |

### 8.4 Carry-forward blocker recording

F4 must record any issues that remain unresolved at AUTH-APP-01F completion so they can be tracked into AUTH-APP-01G, AUTH-APP-01H, or AUTH-APP-01Z.

---

## 9. Carry-Forward Blockers

The following are pre-existing issues, not introduced by AUTH-APP-01F1 or the F2/F3/F4 slices.

| Blocker | Source | Status |
|---|---|---|
| `npm test` backend full suite fails: `REDIS_URL` not set in test bootstrap environment | Pre-existing since AUTH-APP-01B | Carry-forward — not introduced by F1 |
| `ai-execution.controller.spec.ts` pre-existing test failures | Pre-existing before F1 | Carry-forward — not introduced by F1 |
| `npm run lint` in `services/api-gateway`: ESLint config not discoverable by package lint script | Pre-existing since AUTH-APP-01B | Carry-forward — not introduced by F1 |

These blockers must not block F2, F3, or F4 completion provided the targeted tests for those slices pass.

---

## 10. Risks and Open Questions

| # | Item | Risk level | Resolution path |
|---|---|---|---|
| 1 | **`middleware.ts` vs per-page bootstrap** | Medium | Per-page bootstrap is the default for F3. If middleware is preferred later, it requires a separate task amendment — the Edge runtime compatibility with the session cookie check must be validated. |
| 2 | **`/api/preview/*` proxy — session ownership validation** | Medium | Unclear whether `container-manager` independently validates session ownership on preview requests. F2 must investigate before making a disposition decision. If validation is absent, the proxy is an unauthenticated access path to container file systems. |
| 3 | **Service-to-service endpoints not under `/api/internal/`** (`chat-messages`, `token-usage`, `events`) | Medium | These are called by `ai-service` internally. If the private network boundary provides sufficient isolation, Option C (document as accepted) may be appropriate. If the service runs on a publicly reachable host, Option A or B is required. F2 must decide based on deployment topology. |
| 4 | **`/driver` page auth model** | Low | Classified as intentionally separate DRIVER_API_KEY auth. No action required. Locked in Section 5. |
| 5 | **`/test` page — dev artifact** | Low | Unprotected by design. No auth will be added in this family. Explicitly documented. |
| 6 | **Dead `api-key.controllerXXXXX.ts` stale file** | Low | Not loaded at runtime. Confirmed absent from `auth.module.ts` imports. Cleanup in F2. |
| 7 | **`JwtAuthGuard` class still on disk** | Low | `src/auth/jwt-auth.guard.ts` still exists (4 lines, just extends `AuthGuard('jwt')`). It is no longer used in any active controller. It may be deleted in F2 cleanup or left as a harmless artifact — F2 must record a disposition. |
| 8 | **Flash of protected page content before redirect** | Low | Per-page bootstrap means the page JS must mount and fire before the redirect. This is a UX concern addressed by a future `middleware.ts` but is not a security gap (all data APIs return 401 before any sensitive data is served). |

---

## Reference

- `docs/AUTH-APP-01-SPEC.md` — master auth architecture spec (Section 9: Route/API protection)
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `SessionCookieGuard` implementation
- `docs/AUTH-APP-01C1B-CHECKPOINT.md` — frontend localStorage/Bearer migration
- `docs/AUTH-APP-01D-CHECKPOINT.md` — Google OAuth
- `docs/AUTH-APP-01E-CHECKPOINT.md` — Apple OAuth
- `TASKS.md` → AUTH-APP-01F1
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01F1
