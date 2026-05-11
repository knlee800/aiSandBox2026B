# AUTH-APP-02 Family Checkpoint ??Preview Proxy Security

## Family Metadata

| Field | Value |
|---|---|
| Family ID | AUTH-APP-02 |
| Title | Preview Proxy Security |
| Parent | AUTH (carry-forward from AUTH-APP-01H) |
| Status | COMPLETE and LOCKED |
| Completed | 2026-05-10 |
| Live Smoke | PASS ¡X 2026-05-11 |
| Depends on | AUTH-APP-01Z (COMPLETE and LOCKED) |

---

## Objective

Investigate and resolve the security gap in the `/api/preview/*` proxy path. The api-gateway `PreviewController` proxied all preview requests to container-manager without any authentication or authorization guard. Container-manager had no auth or ownership enforcement on any preview route. A threat model, product decision, and phased implementation closed these gaps.

---

## Child Slices

| Slice | Title | Status | Checkpoint |
|---|---|---|---|
| AUTH-APP-02A | Preview Proxy Auth Investigation | COMPLETE and LOCKED | `docs/AUTH-APP-02A-CHECKPOINT.md` |
| AUTH-APP-02B | Add SessionCookieGuard to api-gateway PreviewController | COMPLETE and LOCKED | `docs/AUTH-APP-02B-CHECKPOINT.md` |
| AUTH-APP-02C | Session Ownership Check / Owner-only Preview Authorization | COMPLETE and LOCKED | `docs/AUTH-APP-02C-CHECKPOINT.md` |
| AUTH-APP-02D | Preview Proxy Header Sanitization | COMPLETE and LOCKED | `docs/AUTH-APP-02D-CHECKPOINT.md` |

---

## AUTH-APP-02A ??Investigation Summary

**Nature:** Investigation / spec only ??no production source files changed.

**Key findings:**
- `PreviewController` used `@All('*')` with no guard ??fully open to unauthenticated and cross-user requests
- Active container-manager module (`src/preview/`) had no auth or ownership check on any route
- Inactive module (`src/previews/`) contained optional JWT/Bearer access control but was not registered and had zero effect
- `ENABLE_PREVIEW_ACCESS_CONTROL` flag only read by inactive code ??not current protection
- No public/share preview UI found ??product behavior implied workspace-private preview
- Threat model: T1 unauthenticated access (MEDIUM), T2 cross-user access (MEDIUM), T5 infra bypass (MEDIUM), T3/T4/T6 (LOW)

**Recommendation produced:** AUTH-APP-02B (SessionCookieGuard at api-gateway) as smallest safe fix; AUTH-APP-02C (ownership check, owner-only model) as follow-on pending product decision.

**Spec:** `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md`

---

## AUTH-APP-02B ??SessionCookieGuard Summary

**Nature:** Backend implementation ??api-gateway only.

**Change:** Added `@UseGuards(SessionCookieGuard)` at `PreviewController` class level.

**Threats closed:** T1 (unauthenticated content access), T6 (unguarded start/stop resource abuse).

**Files changed:**
- `services/api-gateway/src/preview/preview.controller.ts` ??guard decorator added
- `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts` ??3 guard tests (new)

**`preview.module.ts` not changed** ??`SessionCookieGuard` resolves from `AppModule` DI context.

**Validation:** `npx tsc --noEmit` PASS; `preview.controller.guard.spec.ts` PASS (3/3).

---

## AUTH-APP-02C ??Owner-only Authorization Summary

**Nature:** Backend implementation ??api-gateway only.

**Product decision:** Owner-only previews. No public/share links. No signed URLs.

**ID namespace confirmed:** The `sessionId` in `/api/preview/:sessionId/*` is the api-gateway PostgreSQL `sessions.id` UUID. api-gateway generates and owns this UUID; container-manager stores the same UUID (passed via `POST /api/sessions/:id/start`). Ownership can be checked directly in api-gateway without any container-manager call.

**Change:** Added `PreviewOwnershipGuard` as second guard in the chain: `@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)`.

**Guard behavior:**
- Requires `req.user.userId` (from `SessionCookieGuard`)
- Extracts `sessionId` from path segment `segments[3]`
- Calls `SessionService.getSessionById(sessionId)`
- Returns 403 for: missing user, malformed path, session not found, ownership mismatch
- Returns `true` on match
- No container-manager call; no session/user logging

**Threats closed:** T2 (cross-user session preview access).

**Files changed:**
- `services/api-gateway/src/preview/preview-ownership.guard.ts` ??new guard (new)
- `services/api-gateway/src/preview/preview.controller.ts` ??guard chain updated
- `services/api-gateway/src/preview/preview.module.ts` ??`SessionModule` import + `PreviewOwnershipGuard` provider added
- `services/api-gateway/src/preview/__tests__/preview.ownership.guard.spec.ts` ??9 ownership tests (new)

**Validation:** `npx tsc --noEmit` PASS; `preview.ownership.guard.spec.ts` PASS (9/9); combined guard suites PASS (12/12).

---

## AUTH-APP-02D ??Header Sanitization Summary

**Nature:** Backend security hardening ??api-gateway only.

**Change:** Added `PROXY_HEADER_DENYLIST` constant and exported `sanitizeProxyHeaders` helper to `preview.controller.ts`. Replaced the inline `{ ...req.headers, host: undefined }` spread with `sanitizeProxyHeaders(req.headers)`.

**Headers stripped:** `host`, `cookie`, `authorization`, `proxy-authorization`, `x-internal-service-key`, `x-csrf-token`, `x-forwarded-user`, `x-user-id`, `x-session-id`.

**Headers preserved (examples):** `accept`, `accept-language`, `user-agent`, `content-type`, `range`, `if-none-match`, `if-modified-since`, `cache-control`. `x-forwarded-for` intentionally not denied in this slice.

**Strategy:** Explicit denylist. An allowlist would risk silently breaking preview rendering if any benign browser header is omitted. The denylist precisely targets known sensitive headers.

**Guard chain unchanged:** `@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)` ??no guard modifications.

**Streaming path unchanged:** `responseType: 'stream'` and `response.data.pipe(res)` behavior unaffected. Sanitization applies only to outbound request headers.

**Files changed:**
- `services/api-gateway/src/preview/preview.controller.ts` ??`PROXY_HEADER_DENYLIST` and `sanitizeProxyHeaders` added; axios headers replaced
- `services/api-gateway/src/preview/__tests__/preview.header-sanitization.spec.ts` ??23 direct unit tests (new)

**Validation:** `npx tsc --noEmit` PASS; `preview.header-sanitization.spec.ts` PASS (23/23); all preview suites PASS (35/35).

---

## Final Protection State

After AUTH-APP-02A + AUTH-APP-02B + AUTH-APP-02C + AUTH-APP-02D:

| Scenario | Response | Enforced by |
|---|---|---|
| Unauthenticated request to any `/api/preview/*` | HTTP 401 | `SessionCookieGuard` |
| Authenticated request to another user's preview | HTTP 403 | `PreviewOwnershipGuard` |
| Authenticated owner request | Proxied to container-manager | Both guards pass |
| Preview start/stop/status/proxy ??all protected | 401 or 403 or proxy | Guard chain on all routes via `@All('*')` |
| Sensitive inbound auth/security headers | Stripped before reaching container-manager | `sanitizeProxyHeaders` in `PreviewController` |
| Useful browser/rendering headers | Forwarded to container-manager | Pass through denylist unchanged |

---

## Validation Summary

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `services/api-gateway` | PASS |
| `npx jest --testPathPatterns="preview.controller.guard" --runInBand` | `services/api-gateway` | PASS ??3/3 |
| `npx jest --testPathPatterns="preview.ownership" --runInBand` | `services/api-gateway` | PASS ??9/9 |
| `npx jest --testPathPatterns="preview.controller.guard\|preview.ownership" --runInBand` | `services/api-gateway` | PASS ??12/12 |
| `npx jest --testPathPatterns="preview.header-sanitization" --runInBand` | `services/api-gateway` | PASS ??23/23 |
| `npx jest --testPathPatterns="preview" --runInBand` | `services/api-gateway` | PASS ??35/35 (3 suites) |
| Lint on all touched preview files | `services/api-gateway` | PASS ??no errors |

---

## Manual Smoke Status

Live smoke completed 2026-05-11 against commit `f92bd3e`.

| # | Check | Status |
|---|---|---|
| 1 | Unauthenticated request to `/api/preview/<sessionId>/status` ¡X HTTP 401 | **PASS** |
| 2 | Authenticated owner ¡X proxy proceeds; preview loads in workspace | **PASS** |
| 3 | Authenticated non-owner ¡X HTTP 403 `Preview access forbidden` | **PASS** |
| 4 | Owner preview start/status/proxy/hello.html all work | **PASS** |

Container stack at smoke time: api-gateway healthy ¡P frontend Up ¡P postgres healthy ¡P redis healthy ¡P container-manager Up.

---

## Carry-Forwards

| Item | Risk | Detail | Next action |
|---|---|---|---|
| `x-forwarded-for` privacy decision | LOW | Currently forwarded to container-manager; may leak client IP | Separate deferred decision |
| Container-manager direct access (T5) | MEDIUM | If port 4002 is externally reachable, api-gateway guards and sanitization are bypassable | Network isolation (infrastructure) |
| Public/share/signed preview | N/A (product) | Deferred product feature | Requires explicit product decision and separate feature design |
| Inactive `src/previews/` module in container-manager | LOW | Dead code of unknown quality | Future decision: delete, activate, or archive |

---

## Reference

- `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` ??investigation and options spec
- `docs/AUTH-APP-02A-CHECKPOINT.md` ??investigation checkpoint
- `docs/AUTH-APP-02B-CHECKPOINT.md` ??SessionCookieGuard checkpoint
- `docs/AUTH-APP-02C-CHECKPOINT.md` ??ownership guard checkpoint
- `docs/AUTH-APP-02D-CHECKPOINT.md` ??header sanitization checkpoint
- `docs/AUTH-APP-01H-CHECKPOINT.md` ??original carry-forward source (MEDIUM risk)
- `docs/AUTH-APP-01Z-CHECKPOINT.md` ??carry-forward: approved preview proxy investigation
- `TASKS.md` ??AUTH-APP-02
- `TASKS_BACKLOG_FULL.md` ??AUTH-APP-02
