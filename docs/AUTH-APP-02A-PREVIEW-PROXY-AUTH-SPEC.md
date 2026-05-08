# AUTH-APP-02A — Preview Proxy Auth Investigation Spec

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-02A |
| Title | Preview Proxy Auth Investigation |
| Family | AUTH |
| Parent | AUTH-APP-02 (PLANNED) |
| Status | PLANNED |
| Nature | INVESTIGATION / SPEC ONLY — no production source files changed |
| Date | 2026-05-08 |
| Depends on | AUTH-APP-01Z (COMPLETE and LOCKED) |
| Carry-forward source | AUTH-APP-01H (MEDIUM risk; preview proxy formally deferred in H3/H4/Z) |

---

## 1. Purpose and Scope

AUTH-APP-02A is an investigation and spec-only task. Its purpose is to document the current preview proxy architecture, identify auth gaps, define the threat model, enumerate product/security decision options, and recommend the smallest safe next implementation slice.

**What AUTH-APP-02A does:**
- Documents the current preview proxy request flow end-to-end
- Identifies active vs inactive code paths in container-manager
- Maps the access control gap at each layer
- Defines the threat model for unauthenticated/cross-user preview access
- Proposes implementation options with trade-offs
- Recommends AUTH-APP-02B (SessionCookieGuard at api-gateway) as the smallest safe fix
- Records AUTH-APP-02C (ownership check / product decision) as a conditional follow-on

**What AUTH-APP-02A does NOT do:**
- No production source files changed
- No guards added
- No frontend changes
- No container-manager changes
- No dependency changes
- No database migration
- No checkpoint document created (separate step)

---

## 2. Current Architecture

### Request flow

```
Browser iframe
  → GET /api/preview/:sessionId/proxy?refresh=N   (same-origin)
  → api-gateway PreviewController @All('*')        (no guard)
  → axios proxy to CONTAINER_MANAGER_URL + req.path
  → container-manager PreviewController @Get(':sessionId/proxy*')  (no guard)
  → http-proxy-middleware → container process / static file read
  → response piped back through api-gateway to browser
```

### api-gateway layer

**File:** `services/api-gateway/src/preview/preview.controller.ts`

- `@Controller('preview')` — routes under `/api/preview/*` (api-gateway has global prefix `api`)
- `@All('*')` — matches every HTTP method and every sub-path
- **No guard decorator.** No `@UseGuards(...)`, no middleware, no authentication
- Uses `axios` to forward to `${process.env.CONTAINER_MANAGER_URL || 'http://localhost:4001'}${req.path}`
- All request headers are forwarded, including `Cookie` (with only `host` removed)
- `responseType: 'stream'` for paths containing `/proxy`, `'json'` otherwise
- Registered in `app.module.ts` via `PreviewModule`

The `aisandbox_session` cookie is included in forwarded headers because it is `SameSite=Lax` and the request is same-origin navigation from the iframe. However, container-manager has no session cookie infrastructure and ignores it entirely.

### container-manager layer

Container-manager has global prefix `api` (set in `main.ts`). It has **two separate, disconnected preview module trees** — only one is active. See Section 3 for full detail.

The **active** module (`src/preview/`) handles all `/api/preview/*` routes with no authentication or ownership checks of any kind.

### Session cookie behavior through the proxy

- The `aisandbox_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production) is set by api-gateway
- Same-origin iframe navigation includes this cookie in requests to `/api/preview/*`
- api-gateway's preview proxy forwards the cookie header to container-manager
- Container-manager does not parse, validate, or use `aisandbox_session`
- No `req.user` is populated at any point in the preview request chain

---

## 3. Active vs Inactive Container-Manager Preview Trees

### Active: `services/container-manager/src/preview/` (no trailing `s`)

**Registered in:** `services/container-manager/src/app.module.ts` → `PreviewModule`

**Controller:** `@Controller('preview')` → routes under `/api/preview/*`

| Route | Method | Auth | Ownership | Notes |
|---|---|---|---|---|
| `/api/preview/:sessionId/start` | POST | None | None | Starts preview server in container; calls `assertSessionUsable()` (termination check only) |
| `/api/preview/:sessionId/stop` | DELETE | None | None | Kills preview process; calls `assertSessionUsable()` |
| `/api/preview/:sessionId/status` | GET | None | None | Returns preview running state |
| `/api/preview/:sessionId/proxy*` | GET | None | None | Proxies HTTP to container process via `http-proxy-middleware`; supports WebSocket (`ws: true`) |

`assertSessionUsable(sessionId)` checks that the session is not terminated — it does **not** check user identity or ownership.

### Inactive: `services/container-manager/src/previews/` (with trailing `s`)

**NOT registered in `app.module.ts`.** This code is dead — it has no effect on any live request.

This module contains a more complete implementation from Tasks 7.3A–7.4C:

| File | Controller / Route | Notes |
|---|---|---|
| `previews.controller.ts` | `@Controller('previews')` → `/api/previews/:sessionId/*` | Has `ENABLE_PREVIEW_ACCESS_CONTROL` JWT check, health endpoint, WebSocket upgrade support |
| `internal-previews.controller.ts` | `@Controller('internal/sessions')` → `/api/internal/sessions/:id/previews` | Guarded by `InternalServiceAuthGuard`; preview port registration |
| `internal-previews-proxy.controller.ts` | `@Controller('internal-previews/proxy')` → `/api/internal-previews/proxy/:sessionId/*` | Internal-only proxy, no auth |
| `preview-proxy.service.ts` | Service | Target resolution: sessionId → container IP + registered port |
| `preview.service.ts` | Service | Port registry and preview lifecycle (separate from active `src/preview/preview.service.ts`) |

**`ENABLE_PREVIEW_ACCESS_CONTROL`** is read only in `src/previews/previews.controller.ts` (inactive). It defaults to `false` in `.env.example`. It has **zero effect** on the currently active request path. It must not be treated as current protection.

### Implication

The entire live preview surface has no access control at any layer. The inactive module's JWT-based protection exists as dead code and cannot be relied upon.

---

## 4. Frontend Usage

### Preview URL construction

`frontend/components/workspace/workspace-preview.logic.ts`:

```typescript
export function buildPreviewProxyUrl(sessionId: string, refreshToken: number): string {
  return `/api/preview/${encodeURIComponent(sessionId)}/proxy?refresh=${refreshToken}`;
}
```

### iframe rendering

`frontend/components/workspace/workspace-shell.tsx` renders an iframe:

```typescript
<iframe
  data-testid="workspace-preview-iframe"
  src={props.previewUrl}
```

### Preview lifecycle in `app/page.tsx`

- Status check: `fetch(/api/preview/${sessionId}/status, { credentials: 'include' })`
- Start: `fetch(/api/preview/${selectedSessionId}/start, { method: 'POST', credentials: 'include' })`
- Both use `credentials: 'include'` — session cookies are sent

### Origin model

Preview URLs are strictly **same-origin** — relative paths starting with `/api/`. The iframe loads from the same origin as the workspace page.

### Public/share preview

**No public or shareable preview UI exists.** There is no "share preview link" button, no copy-to-clipboard for preview URLs, no standalone preview page, and no preview routing outside the workspace shell. The current product behavior implies that preview is a workspace-private feature.

---

## 5. Access Control Gap Table

| Layer | Path | Guard | Ownership check | Auth model | Status |
|---|---|---|---|---|---|
| api-gateway | `@All /api/preview/*` | **None** | **None** | No auth | **GAP** |
| container-manager (active `src/preview/`) | `GET /api/preview/:sessionId/proxy*` | **None** | **None** | No auth; `assertSessionUsable()` checks termination only | **GAP** |
| container-manager (active `src/preview/`) | `POST /api/preview/:sessionId/start` | **None** | **None** | No auth | **GAP** |
| container-manager (active `src/preview/`) | `DELETE /api/preview/:sessionId/stop` | **None** | **None** | No auth | **GAP** |
| container-manager (active `src/preview/`) | `GET /api/preview/:sessionId/status` | **None** | **None** | No auth | **GAP** |
| container-manager (inactive `src/previews/`) | `@All /api/previews/:sessionId/*` | JWT Bearer (optional via `ENABLE_PREVIEW_ACCESS_CONTROL`) | `user_id == JWT sub` (when enabled) | Dead code — not registered | **INACTIVE** |
| container-manager (inactive) | `POST /api/internal/sessions/:id/previews` | `InternalServiceAuthGuard` | N/A (internal) | Dead code — not registered | **INACTIVE** |
| Frontend | Workspace route `/[locale]/app` | Behind workspace page (`/api/auth/me` bootstrap redirect) | N/A — frontend auth is advisory only | Frontend redirects unauthenticated users to login, but backend route is independently open | Advisory only |

---

## 6. Threat Model

### T1 — Unauthenticated preview content access

**Severity: MEDIUM**

Any HTTP client with a known `sessionId` can `GET /api/preview/:sessionId/proxy` and reach the container's running web application or static HTML content. No cookie, no token, no authentication of any kind is required. This exposes actual user code output.

### T2 — Cross-user session preview access

**Severity: MEDIUM**

An authenticated user (with a valid `aisandbox_session` cookie) can access any other user's preview by substituting a different sessionId in the URL. The proxy does not check that the requesting user owns the session being proxied.

### T3 — sessionId exposure in URLs/logs

**Severity: LOW**

Preview URLs contain the sessionId in the path. They appear in browser history, referrer headers, server access logs, and error pages. UUID entropy makes guessing hard, but a sessionId is not a secret — it appears throughout the application. Accepted risk.

### T4 — Forwarded sensitive headers

**Severity: LOW**

The api-gateway proxy forwards all request headers to container-manager, including `Cookie` and potentially `X-Internal-Service-Key` if a malicious client supplies it. The preview proxy resolves only to `/api/preview/*` paths on container-manager, which are not guarded by `InternalServiceAuthGuard`, so this does not provide a privilege escalation path in the current architecture. However, forwarding cookies and other sensitive headers to container-manager is unnecessary and should be sanitized.

### T5 — Container-manager direct access bypass

**Severity: MEDIUM (infrastructure risk)**

If container-manager port (4002) is externally reachable, the `/api/preview/*` path is directly accessible without passing through api-gateway. Any guard added at api-gateway would be bypassable. Mitigation requires network isolation (Docker internal networking) — this is an infrastructure concern, not a code concern.

### T6 — Unguarded preview start/stop resource abuse

**Severity: LOW–MEDIUM**

`POST /api/preview/:sessionId/start` is unguarded. Any caller with a valid sessionId can start a preview server process inside another user's container, consuming resources. `DELETE /api/preview/:sessionId/stop` can terminate another user's preview.

### Threat summary

| ID | Threat | Severity | Current mitigation | Required mitigation |
|---|---|---|---|---|
| T1 | Unauthenticated content access | MEDIUM | None | SessionCookieGuard at api-gateway (AUTH-APP-02B) |
| T2 | Cross-user session access | MEDIUM | None | Ownership check (AUTH-APP-02C, pending product decision) |
| T3 | sessionId in URLs/logs | LOW | UUID entropy | Accepted |
| T4 | Forwarded sensitive headers | LOW | None | Header sanitization (future hardening) |
| T5 | Container-manager direct access | MEDIUM | Assumed internal network | Network isolation (infrastructure) |
| T6 | Unguarded start/stop | LOW–MEDIUM | None | SessionCookieGuard at api-gateway (AUTH-APP-02B) |

---

## 7. Product/Security Decision Options

| Option | Description | Frontend impact | Backend impact | Complexity | Pros | Cons |
|---|---|---|---|---|---|---|
| **A — SessionCookieGuard only** | Require authenticated session to access any `/api/preview/*`; no ownership check | None — preview already behind workspace | One decorator + module import in one file | Minimal | Closes T1 and T6; aligns with existing cookie-session auth; zero frontend change | Leaves T2 (cross-user) unresolved |
| **B — SessionCookieGuard + ownership at api-gateway** | Guard + verify `req.user.userId` owns `sessionId` | None | api-gateway needs session ownership lookup (DB query or internal API call to container-manager) | Moderate | Closes T1, T2, and T6 completely | Requires cross-service data access; increases coupling |
| **C — Activate inactive `previews/` module with JWT/Bearer** | Register `PreviewsModule` in `app.module.ts`; set `ENABLE_PREVIEW_ACCESS_CONTROL=true`; update api-gateway proxy target | URL change (`/api/previews/*`); frontend `buildPreviewProxyUrl` must be updated | Register module; activate JWT check; large change surface across both services | High | Uses existing code; JWT supports shareable tokens | JWT Bearer is inconsistent with platform cookie-session auth; large regression surface; dead code quality is unknown |
| **D — Signed short-lived preview tokens** | Issue per-session signed tokens; embed in preview URL or header | Frontend must fetch token before constructing preview URL | New token service + validation middleware | High | Supports shareable previews; time-limited access | Significant new infrastructure; over-engineered for current single-user product |
| **E — Accept risk (formal deferral)** | Document MEDIUM risk; defer implementation until product decision | None | None | None | Zero change; no regression risk | Risk accepted indefinitely; gaps persist |

---

## 8. Recommended Implementation Path

### AUTH-APP-02B — Add SessionCookieGuard to api-gateway PreviewController

**Rationale:**
- Smallest safe fix that closes the most important gaps (T1 unauthenticated access, T6 unguarded start/stop)
- Protects all preview routes at the api-gateway entry point: start, stop, status, and proxy
- Aligns with the current cookie-session authentication architecture established in AUTH-APP-01C1A
- Requires no frontend changes (iframe requests already include `aisandbox_session` via `credentials: 'include'`)
- Requires no container-manager changes
- Does not require a product decision on public vs. private previews
- One controller change, one module import, one test file

**What AUTH-APP-02B does NOT solve:**
- Cross-user session access (T2) — an authenticated user can still access another user's preview by knowing their sessionId
- Container-manager direct access bypass (T5) — infrastructure concern
- Header forwarding sanitization (T4) — separate hardening slice

These are deferred to AUTH-APP-02C (ownership check / product decision).

### AUTH-APP-02C — Session Ownership Check / Product Decision (conditional)

**This slice should not be implemented until the following product decision is made:**

Should previews be:
1. **Owner-only** — only the session owner can view previews → add ownership check at api-gateway
2. **Public/shareable** — anyone with a link can view → ownership check is wrong; signed tokens may be appropriate
3. **Signed-link shareable** — preview requires a time-limited signed URL → new token infrastructure
4. **Mixed model** — owner-only by default, with explicit share toggle → most complex

**If owner-only is chosen:**
- api-gateway must look up which user owns the session being previewed
- api-gateway does not currently have access to container session ownership data
- Either: (a) replicate ownership data in api-gateway's DB, or (b) add an internal endpoint on container-manager: `GET /api/internal/sessions/:id/owner` returning `{ userId }`
- After guard validates `req.user.userId === session.userId`, access is granted

**If shareable is chosen:**
- SessionCookieGuard (AUTH-APP-02B) may need to be relaxed or replaced with a signed-token model
- Significant additional design work required

**Recommendation:** Implement AUTH-APP-02B (SessionCookieGuard) first. It is correct regardless of which product model is chosen — even shareable previews would require the owner to be authenticated when accessing their own preview through the workspace. The product decision for AUTH-APP-02C can be made later.

---

## 9. AUTH-APP-02B Proposed Scope

### Files in scope

| File | Change |
|---|---|
| `services/api-gateway/src/preview/preview.controller.ts` | Add `@UseGuards(SessionCookieGuard)` at controller class level |
| `services/api-gateway/src/preview/preview.module.ts` | Add `AuthModule` to module imports (to provide `SessionCookieGuard` and its `AuthService` dependency) |
| `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts` | New — guard unit tests for preview controller |

### Implementation detail

1. Import `SessionCookieGuard` from `../auth/session-cookie.guard`
2. Add `@UseGuards(SessionCookieGuard)` to the `PreviewController` class (applies to all routes)
3. Add `AuthModule` to `PreviewModule` imports so that `SessionCookieGuard` can inject `AuthService`
4. Write guard unit tests:
   - Request without `aisandbox_session` cookie → 401 Unauthorized
   - Request with valid session cookie → proxy proceeds normally
   - Request with expired/invalid session cookie → 401 Unauthorized

### Non-goals for AUTH-APP-02B

- No ownership check (deferred to AUTH-APP-02C)
- No container-manager changes
- No frontend changes
- No activation of inactive `src/previews/` module
- No signed preview URLs
- No public/share preview design
- No header sanitization
- No WebSocket-specific guard changes (guard applies before upgrade; `ws: true` should still work)

### Validation for AUTH-APP-02B

- `npx tsc --noEmit` in `services/api-gateway`: must PASS
- Targeted tests: `preview.controller.guard.spec.ts` — all tests PASS
- Manual smoke checklist:
  1. Logged-in user loads workspace → preview iframe still loads normally
  2. `curl -X GET http://localhost:4000/api/preview/test-session/status` (no cookie) → 401
  3. `curl -X POST http://localhost:4000/api/preview/test-session/start` (no cookie) → 401
  4. `curl -X GET http://localhost:4000/api/preview/test-session/proxy` (no cookie) → 401

---

## 10. AUTH-APP-02C Proposed Scope (Conditional / Future)

### Prerequisite: Product decision

The product owner must decide the preview sharing model before AUTH-APP-02C can be scoped:

| Model | Description | AUTH-APP-02C scope |
|---|---|---|
| Owner-only | Only session creator can view | Add ownership check at api-gateway; resolve session ownership data access |
| Public/shareable | Anyone with link can view | May relax or bypass SessionCookieGuard for shared links; add signed-token validation |
| Signed-link | Time-limited signed URLs | New token minting and validation infrastructure |
| Mixed | Owner-only default + explicit share toggle | Combined ownership check + share token system |

### If owner-only is chosen

1. Determine how api-gateway resolves session ownership:
   - **Option A:** api-gateway queries its own DB for a sessions table that includes `user_id` (if such a table exists or is created)
   - **Option B:** api-gateway calls container-manager's internal API: `GET /api/internal/sessions/:id/owner` → `{ userId }` (new endpoint needed)
2. After `SessionCookieGuard` populates `req.user`, compare `req.user.userId === session.userId`
3. Return 403 Forbidden if ownership does not match

### No implementation until product decision is made

AUTH-APP-02C is recorded as a conditional future slice. It depends on an explicit product decision that is outside the scope of AUTH-APP-02A and AUTH-APP-02B.

---

## 11. Open Questions

| # | Question | Relevant to | Status |
|---|---|---|---|
| 1 | Does api-gateway have reliable access to container session ownership data (user_id → sessionId)? | AUTH-APP-02C | Unresolved — api-gateway's DB schema includes a `sessions` table from the project lifecycle module, but it is unclear whether it contains the same sessions used by container-manager's preview system |
| 2 | Should previews be owner-only or shareable? | AUTH-APP-02C | Unresolved — product decision required |
| 3 | Should the inactive `src/previews/` module be deleted, activated, or left as-is? | Future cleanup | Unresolved — activation would require significant validation; deletion is safe but loses existing JWT access-control code |
| 4 | Is container-manager port (4002) externally reachable in any deployment configuration? | T5 (infrastructure) | Unresolved — expected to be Docker-internal only, but not confirmed |
| 5 | How should WebSocket upgrades be handled under `SessionCookieGuard`? | AUTH-APP-02B | Expected to work — guard runs before the HTTP upgrade; `ws: true` in `http-proxy-middleware` handles the upgrade after guard passes. Must be smoke-tested. |
| 6 | Should forwarded headers be sanitized (strip `Cookie`, `Authorization`, `X-Internal-Service-Key`)? | Future hardening | Unresolved — low risk in current architecture but good hygiene |

---

## 12. Risks and Carry-Forwards

| Item | Risk | Detail | Mitigation |
|---|---|---|---|
| Option A (SessionCookieGuard only) leaves cross-user access unresolved | MEDIUM | An authenticated user can still access another user's preview by knowing their sessionId | AUTH-APP-02C ownership check after product decision |
| Container-manager direct access bypass | MEDIUM | If port 4002 is externally reachable, api-gateway guard is bypassable | Network isolation (Docker internal networking); infrastructure concern |
| Header forwarding includes sensitive cookies | LOW | `aisandbox_session`, `aisandbox_csrf`, and any other cookies are forwarded to container-manager | Header sanitization in future hardening slice |
| WebSocket preview path under guard | LOW | `SessionCookieGuard` should not block WebSocket upgrades (guard runs before upgrade), but this is untested | Manual smoke test during AUTH-APP-02B validation |
| Public preview/share feature | N/A (product) | No public preview exists today; if added, AUTH-APP-02B guard would block external access | Requires explicit product design and AUTH-APP-02C or separate feature task |
| Inactive `src/previews/` module | LOW | Dead code of unknown quality; may confuse future developers | Decision needed: delete, activate, or document as archived |

---

## Reference

- `docs/AUTH-APP-01H-CHECKPOINT.md` — carry-forward source (preview proxy MEDIUM risk)
- `docs/AUTH-APP-01H3-CHECKPOINT.md` — preview proxy formally deferred
- `docs/AUTH-APP-01H4-CHECKPOINT.md` — MEDIUM risk carry-forward recorded
- `docs/AUTH-APP-01Z-CHECKPOINT.md` — carry-forward item 4: approve preview proxy investigation slice
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary; Section 4 carry-forward
- `TASKS.md` → AUTH-APP-02A
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-02A

### Source files inspected (read-only)

| File | Layer |
|---|---|
| `services/api-gateway/src/preview/preview.controller.ts` | api-gateway preview proxy |
| `services/api-gateway/src/preview/preview.module.ts` | api-gateway preview module |
| `services/api-gateway/src/auth/session-cookie.guard.ts` | SessionCookieGuard implementation |
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` | InternalServiceAuthGuard (for comparison) |
| `services/api-gateway/src/main.ts` | Global prefix, cookie middleware |
| `services/api-gateway/.env.example` | Env documentation |
| `services/container-manager/src/preview/preview.controller.ts` | Active preview controller |
| `services/container-manager/src/preview/preview.service.ts` | Active preview service |
| `services/container-manager/src/preview/preview.module.ts` | Active preview module |
| `services/container-manager/src/previews/previews.controller.ts` | Inactive preview controller (JWT access control) |
| `services/container-manager/src/previews/internal-previews.controller.ts` | Inactive internal previews |
| `services/container-manager/src/previews/internal-previews-proxy.controller.ts` | Inactive internal proxy |
| `services/container-manager/src/previews/preview-proxy.service.ts` | Inactive proxy service |
| `services/container-manager/src/app.module.ts` | Module registration (confirms which preview module is active) |
| `services/container-manager/src/main.ts` | Global prefix |
| `services/container-manager/.env.example` | `ENABLE_PREVIEW_ACCESS_CONTROL` documentation |
| `frontend/components/workspace/workspace-preview.logic.ts` | Preview URL construction |
| `frontend/components/workspace/workspace-shell.tsx` | Preview iframe rendering |
| `frontend/app/[locale]/app/page.tsx` | Preview lifecycle (status/start calls) |
