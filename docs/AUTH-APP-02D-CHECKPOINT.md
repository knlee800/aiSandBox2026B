# AUTH-APP-02D Checkpoint — Preview Proxy Header Sanitization

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-02D |
| Title | Preview Proxy Header Sanitization |
| Family | AUTH |
| Parent | AUTH-APP-02 (VALIDATION COMPLETE — manual smoke deferred) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND SECURITY HARDENING |
| Date | 2026-05-10 |
| Depends on | AUTH-APP-02C (COMPLETE and LOCKED) |

---

## Objective

Sanitize forwarded headers in the api-gateway `PreviewController` before proxying requests to container-manager. The proxy previously spread `req.headers` directly into the axios call, removing only `host`. This left sensitive auth/security headers — including `cookie`, `authorization`, `x-internal-service-key`, and `x-csrf-token` — forwarded to container-manager. Apply an explicit denylist via a `sanitizeProxyHeaders` helper to strip sensitive headers before the axios proxy call while preserving headers required for correct browser and preview rendering.

---

## Files Changed

| File | Change |
|---|---|
| `services/api-gateway/src/preview/preview.controller.ts` | Added `PROXY_HEADER_DENYLIST` constant and exported `sanitizeProxyHeaders` helper; replaced inline header spread with `sanitizeProxyHeaders(req.headers)` |
| `services/api-gateway/src/preview/__tests__/preview.header-sanitization.spec.ts` | **Created** — 23 direct unit tests |
| `docs/AUTH-APP-02D-CHECKPOINT.md` | **Created** — this document |
| `docs/AUTH-APP-02-CHECKPOINT.md` | Updated — AUTH-APP-02D summary appended |
| `TASKS.md` | Updated — AUTH-APP-02D COMPLETE and LOCKED; current stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-02D COMPLETE and LOCKED; acceptance checklist completed |

**Production source files changed: 1** (`preview.controller.ts`)
**New test files created: 1** (`preview.header-sanitization.spec.ts`)
**Frontend files changed: None.**
**Container-manager files changed: None.**

---

## Implementation Summary

### `PROXY_HEADER_DENYLIST` — module-scope constant

```typescript
const PROXY_HEADER_DENYLIST = new Set([
  'host',
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-internal-service-key',
  'x-csrf-token',
  'x-forwarded-user',
  'x-user-id',
  'x-session-id',
]);
```

Defined once at module scope. Not reconstructed per request. All entries are lowercase; Node.js/Express normalizes `req.headers` keys to lowercase so comparison is reliable.

### `sanitizeProxyHeaders` — named export

```typescript
export function sanitizeProxyHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([key]) => !PROXY_HEADER_DENYLIST.has(key.toLowerCase()),
    ),
  );
}
```

Exported as a named export to allow direct unit testing without NestJS module compilation. `.toLowerCase()` applied defensively — Express already lowercases header keys, but the helper is correctly safe against mixed-case input in tests and any future non-Express context.

Multi-value `string[]` header values pass through unchanged (filter operates on keys only). Safe `undefined` values pass through unchanged.

### `preview.controller.ts` — diff summary

```diff
-        headers: {
-          ...req.headers,
-          host: undefined, // Remove host header
-        },
+        headers: sanitizeProxyHeaders(req.headers),
```

`host` is now stripped by the denylist rather than the inline `host: undefined` override. All other proxy behavior is preserved unchanged.

### Strategy: denylist over allowlist

An allowlist would require enumerating every benign browser header (including `sec-fetch-*`, `sec-ch-ua-*`, HTTP/2 pseudo-headers, and future browser-introduced headers). Getting it wrong silently breaks preview rendering. The denylist precisely targets the known sensitive set while passing all benign browser and rendering headers through.

### `x-forwarded-for` decision

`x-forwarded-for` is intentionally **not** denied in this slice. It is a proxy infrastructure header, not an auth header, and is benign for a local container-manager. Whether to strip it for user IP privacy is a separate deferred decision.

---

## Headers Stripped (Denylist)

| Header | Reason |
|---|---|
| `host` | Previously stripped inline; now consolidated into denylist |
| `cookie` | Contains `aisandbox_session` and `aisandbox_csrf` — must not reach container-manager |
| `authorization` | Bearer tokens / Basic auth credentials |
| `proxy-authorization` | Proxy auth credentials |
| `x-internal-service-key` | Internal service auth header |
| `x-csrf-token` | CSRF defence token |
| `x-forwarded-user` | Auth-derived user identity |
| `x-user-id` | Auth-derived user ID |
| `x-session-id` | Auth-derived session ID |

---

## Headers Preserved (Examples)

`accept`, `accept-language`, `user-agent`, `content-type`, `range`, `if-none-match`, `if-modified-since`, `cache-control`, `x-forwarded-for`, and all other browser/rendering headers not in the denylist.

`range` and `if-none-match` / `if-modified-since` are specifically important for partial content and caching of static assets served via the `/proxy` path.

---

## Unchanged Proxy Behavior

- `@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)` — guard chain unchanged
- `@Controller('preview')`, `@All('*')` — routing unchanged
- URL construction from `req.path` — unchanged
- `data: req.body` — body forwarding unchanged
- `params: req.query` — query forwarding unchanged
- `responseType: req.path.includes('/proxy') ? 'stream' : 'json'` — stream/JSON detection unchanged
- `validateStatus: () => true` — unchanged
- `response.data.pipe(res)` — streaming response path unchanged
- Error handler with HTTP 502 — unchanged

---

## Test Summary

**File:** `services/api-gateway/src/preview/__tests__/preview.header-sanitization.spec.ts`

23 direct unit tests against the exported `sanitizeProxyHeaders` helper. No NestJS module compilation, no supertest, no axios mock, no DB, no Redis.

| # | Test description |
|---|---|
| 1–9 | `it.each` over full 9-item denylist — each sensitive header is absent in output; `accept` bystander is preserved |
| 10–17 | `it.each` over 8 useful headers — each preserved header survives with correct value |
| 18 | Mixed input: `cookie`, `authorization`, `x-csrf-token` stripped; `accept`, `content-type`, `range`, `x-forwarded-for` preserved |
| 19 | All-denied input (`host` + all 8 denylist entries) → `{}` |
| 20 | All-safe input → returned object equals input exactly |
| 21 | Mixed-case `Cookie` and `Authorization` are stripped; `Accept` (mixed-case) is preserved |
| 22 | Multi-value `string[]` header preserved unchanged |
| 23 | `undefined` value on a safe header (`if-none-match`) is preserved (key present, value `undefined`) |

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `services/api-gateway` | **PASS** |
| `npx jest --testPathPatterns="preview.header-sanitization" --runInBand` | `services/api-gateway` | **PASS — 1 suite, 23 tests** |
| `npx jest --testPathPatterns="preview" --runInBand` | `services/api-gateway` | **PASS — 3 suites, 35 tests** |
| `npx eslint "src/preview/**/*.ts"` | `services/api-gateway` | **PASS** |
| IDE lint diagnostics on touched files | — | **PASS — no linter errors** |

Combined preview test count after AUTH-APP-02D: **35 tests across 3 suites** (up from 12 across 2 suites after AUTH-APP-02C).

---

## Non-Goals Confirmed

- No frontend files changed
- No container-manager files changed
- No ownership logic changes
- No `SessionCookieGuard` or `PreviewOwnershipGuard` changes
- No public/share preview behavior
- No signed preview URLs
- No new external dependencies
- No DB/migration changes
- No manual smoke run

---

## Manual Smoke Status

Manual smoke deferred to live environment (aligned with AUTH-APP-02 family policy). Live smoke requires Docker, PostgreSQL, Redis, running api-gateway and container-manager.

| # | Check | Status |
|---|---|---|
| 1 | Unauthenticated request → HTTP 401 | NOT RUN — deferred |
| 2 | Authenticated owner → proxy proceeds; sensitive headers absent from container-manager request | NOT RUN — deferred |
| 3 | Authenticated non-owner → HTTP 403 | NOT RUN — deferred |
| 4 | Owner preview start/status/proxy all work | NOT RUN — deferred |

---

## Carry-Forwards

| Item | Risk | Detail | Next action |
|---|---|---|---|
| Manual smoke — 4 items | — | Live environment required | User action |
| `x-forwarded-for` privacy decision | LOW | Currently forwarded to container-manager; may leak client IP | Separate deferred decision |
| Container-manager direct access (T5) | MEDIUM | If port 4002 is externally reachable, api-gateway guards and sanitization are bypassable | Network isolation (infrastructure concern) |
| Public/share/signed preview | N/A (product) | Deferred product feature | Requires explicit product decision |
| Inactive `src/previews/` module in container-manager | LOW | Dead code of unknown quality | Future decision: delete, activate, or archive |

---

## Reference

- `docs/AUTH-APP-02-CHECKPOINT.md` — family checkpoint (updated)
- `docs/AUTH-APP-02C-CHECKPOINT.md` — ownership guard checkpoint (parent slice)
- `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` — original threat model and spec
- `TASKS.md` → AUTH-APP-02D
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-02D
