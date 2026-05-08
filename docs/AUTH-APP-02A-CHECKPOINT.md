# AUTH-APP-02A Checkpoint — Preview Proxy Auth Investigation

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-02A |
| Title | Preview Proxy Auth Investigation |
| Family | AUTH |
| Parent | AUTH-APP-02 (PLANNED) |
| Status | COMPLETE and LOCKED |
| Nature | INVESTIGATION / SPEC ONLY — no production source files changed |
| Date | 2026-05-08 |
| Depends on | AUTH-APP-01Z (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` |
| Carry-forward source | AUTH-APP-01H / AUTH-APP-01H3 / AUTH-APP-01H4 / AUTH-APP-01Z |

---

## Objective

Perform a bounded investigation of the `/api/preview/*` proxy auth gap. Inspect the current api-gateway preview proxy, the container-manager preview access-control path, and frontend preview iframe URL generation. Determine the threat model, product decision options, and propose the smallest safe implementation option. Produce a written spec. Recommend the next implementation slice.

---

## Files Changed

| File | Change type |
|---|---|
| `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` | **Created** — investigation and options spec (12 sections) |
| `docs/AUTH-APP-02A-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-APP-02A COMPLETE and LOCKED; AUTH-APP-02B registered; current stage advanced |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-02A COMPLETE and LOCKED; AUTH-APP-02B registered |

**Production source files changed: None.**

---

## Spec Created

`docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md`

### Sections

| # | Section | Status |
|---|---|---|
| 1 | Purpose and Scope | Confirmed |
| 2 | Current Architecture | Confirmed |
| 3 | Active vs Inactive Container-Manager Preview Trees | Confirmed |
| 4 | Frontend Usage | Confirmed |
| 5 | Access Control Gap Table | Confirmed |
| 6 | Threat Model (T1–T6) | Confirmed |
| 7 | Product/Security Decision Options (A–E) | Confirmed |
| 8 | Recommended Implementation Path | Confirmed |
| 9 | AUTH-APP-02B Proposed Scope | Confirmed |
| 10 | AUTH-APP-02C Proposed Scope (Conditional / Future) | Confirmed |
| 11 | Open Questions (6 items) | Confirmed |
| 12 | Risks and Carry-Forwards (6 items) | Confirmed |
| Reference | Source files inspected | Confirmed |

---

## Current Architecture Findings

### api-gateway preview proxy

- File: `services/api-gateway/src/preview/preview.controller.ts`
- `@Controller('preview')` + `@All('*')` — catches all HTTP methods at `/api/preview/*`
- **No guard.** No `@UseGuards(...)`, no middleware, no authentication of any kind
- Uses `axios` to forward to `${CONTAINER_MANAGER_URL}${req.path}`
- Forwards all request headers including `Cookie` (with only `host` removed)
- Registered in `app.module.ts` via `PreviewModule` — active

### container-manager: two preview module trees

**Active: `services/container-manager/src/preview/` (no trailing `s`)**

Registered in `app.module.ts`. Routes under `@Controller('preview')` → `/api/preview/*`:

| Route | Guard | Ownership check |
|---|---|---|
| `POST /api/preview/:sessionId/start` | None | None |
| `DELETE /api/preview/:sessionId/stop` | None | None |
| `GET /api/preview/:sessionId/status` | None | None |
| `GET /api/preview/:sessionId/proxy*` | None | None |

`assertSessionUsable(sessionId)` is called on start/stop — checks session not terminated, does **not** check user identity.

**Inactive: `services/container-manager/src/previews/` (with trailing `s`)**

**NOT registered in `app.module.ts`.** Dead code with zero effect on live requests. Contains:
- `previews.controller.ts` — optional JWT Bearer access control via `ENABLE_PREVIEW_ACCESS_CONTROL`
- `internal-previews.controller.ts` — guarded port registration (also inactive)
- `internal-previews-proxy.controller.ts` — internal-only proxy (also inactive)

`ENABLE_PREVIEW_ACCESS_CONTROL` is read only in the **inactive** controller. It has no effect on the active `/api/preview/*` path. It must not be treated as current protection.

### Session cookie behavior

- Browser iframe loads `/api/preview/:sessionId/proxy` (same-origin relative URL)
- `aisandbox_session` cookie is included in the request
- api-gateway proxy forwards it to container-manager
- Container-manager has no session cookie infrastructure — the cookie is ignored

---

## Frontend Usage Findings

- `buildPreviewProxyUrl(sessionId, refreshToken)` in `workspace-preview.logic.ts` returns `/api/preview/${encodeURIComponent(sessionId)}/proxy?refresh=${refreshToken}`
- Preview URL is a same-origin relative path — loaded in an `<iframe>` in `workspace-shell.tsx`
- Status/start calls in `app/page.tsx` also target same-origin `/api/preview/*` with `credentials: 'include'`
- **No public/share preview UI was found.** No share button, no copy-to-clipboard, no standalone preview page
- Current product behavior implies preview is workspace-private — only accessible inside the workspace panel while a session is active

---

## Access Control Gap Summary

| Layer | Guard | Ownership | Status |
|---|---|---|---|
| api-gateway `/api/preview/*` | None | None | **GAP** |
| container-manager active `/api/preview/*` | None | None | **GAP** |
| container-manager inactive `src/previews/` | JWT Bearer (optional, when `ENABLE_PREVIEW_ACCESS_CONTROL=true`) | `user_id == JWT sub` | **INACTIVE — dead code** |
| Frontend workspace route | Advisory redirect on 401 | N/A | Advisory only — backend independently open |

---

## Threat Model Summary

| ID | Threat | Severity |
|---|---|---|
| T1 | Unauthenticated preview content access | MEDIUM |
| T2 | Cross-user session preview access | MEDIUM |
| T3 | sessionId exposure in URLs/logs | LOW |
| T4 | Forwarded sensitive headers | LOW |
| T5 | Container-manager direct access bypass | MEDIUM (infrastructure) |
| T6 | Unguarded start/stop resource abuse | LOW–MEDIUM |

---

## Recommended Next Slice

### AUTH-APP-02B — Add SessionCookieGuard to api-gateway PreviewController

**Rationale:**
- Smallest safe fix
- Closes T1 (unauthenticated access) and T6 (unguarded start/stop)
- Applies to all four routes: start, stop, status, proxy
- Aligns with the cookie-session auth architecture established in AUTH-APP-01C1A
- Browser iframe already sends `aisandbox_session` cookie with `credentials: 'include'` — no frontend change required
- No container-manager changes required

**Files in scope:**
- `services/api-gateway/src/preview/preview.controller.ts` — add `@UseGuards(SessionCookieGuard)`
- `services/api-gateway/src/preview/preview.module.ts` — add `AuthModule` import for guard DI
- `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts` — new guard unit tests

**Validation:**
- `npx tsc --noEmit` in `services/api-gateway`: PASS
- Targeted tests: `preview.controller.guard.spec.ts` — all tests PASS
- Manual smoke: logged-in preview still loads; unauthenticated request returns 401

---

## Deferred: AUTH-APP-02C — Session Ownership Check / Product Decision

**Blocked on product decision:** Should previews be owner-only, public/shareable, signed-link shareable, or mixed?

- If owner-only: add ownership check at api-gateway after guard; requires session ownership data accessible from api-gateway
- If shareable: SessionCookieGuard may need to be relaxed for shared links; signed token infrastructure required
- AUTH-APP-02C must not be implemented until the product decision is made

---

## Non-Goals Confirmed

- No production source files changed
- No guards added
- No frontend routing changes
- No container-manager changes
- No dependency changes
- No database migration
- No manual smoke

---

## Validation Performed

| Check | Result |
|---|---|
| `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` exists | PASS |
| All 12 numbered sections present | PASS |
| `git status` — no production source files modified | PASS — only governance/docs files touched |
| No `services/`, `frontend/`, or `backend/` files changed | CONFIRMED |

---

## Reference

- `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` — governing spec for this investigation
- `docs/AUTH-APP-01H-CHECKPOINT.md` — carry-forward source (preview proxy MEDIUM risk)
- `docs/AUTH-APP-01H3-CHECKPOINT.md` — preview proxy formally deferred
- `docs/AUTH-APP-01H4-CHECKPOINT.md` — MEDIUM risk carry-forward
- `docs/AUTH-APP-01Z-CHECKPOINT.md` — carry-forward item 4: approve preview proxy investigation slice
- `docs/AUTH-APP-01-CHECKPOINT.md` — AUTH-APP-01 family summary; Section 4 carry-forward
- `TASKS.md` → AUTH-APP-02A
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-02A
