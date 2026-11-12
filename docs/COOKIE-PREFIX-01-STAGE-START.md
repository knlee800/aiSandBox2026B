# COOKIE-PREFIX-01 — Stage-start (Step 2 of 4)

**Task:** COOKIE-PREFIX-01 — Harden platform cookies against a sibling host (`__Host-` prefix)
**Date:** 2026-11-12. **Worker:** fable subagent (auth-sensitive stage-start across gateway cookie setters and readers and the frontend), worktree `lane/COOKIE-PREFIX-01`, cut from main at 2a84ca8.
**Status:** draft for Keith's approval. No code changed. Nothing was run.

Short names: GW = `services/api-gateway/src`, FE = `frontend`.

## 0. Summary

- The preview host `preview.staging.ainow.biz` can set cookies that the browser also sends to `staging.ainow.biz`. Confirmed in the code: the preview proxy forwards upstream `Set-Cookie` unchanged, and preview pages run script on a real origin.
- The gateway reads the **first** value for a cookie name, and a browser lists a longer-path cookie first. So a planted `aisandbox_session` with `Path=/api` wins over the real one on every API call.
- Recommended: in secure mode (https `APP_BASE_URL` or `NODE_ENV=production`) the three cookies get the `__Host-` prefix and the gateway reads only those names. Local http development and the test suites keep today's names, so most existing tests do not change.
- Migration: one forced sign-in. Only Keith is affected.
- `Set-Cookie`: dropped from every preview response on the platform host. This is required, not optional: on the platform host itself the prefix gives no protection. On the preview host, cookies stay (generated apps need them) but lines with a `Domain` attribute or a platform cookie name are dropped.
- One slice for Step 3: GATEWAY and FRONTEND, no visible text, opus.
- Found on the way: the OAuth state cookie probably cannot be set at all on staging today (section 1.4). OAuth is not activated, so nothing is broken for users. Registered as a follow-up, not fixed here.

## 1. Inventory

### 1.1 Attributes today

None of the three sets `Domain`, so all are host-only.

| Cookie | HttpOnly | Secure | SameSite | Path | Max-Age | Set at |
|---|---|---|---|---|---|---|
| `aisandbox_session` | yes | only when `NODE_ENV === 'production'` | Lax | `/` | 7 days | GW/auth/auth.controller.ts:93-101 |
| `aisandbox_csrf` | **no** (the page must read it) | only when `NODE_ENV === 'production'` | Lax | `/` | none (ends with the browser session) | GW/main.ts:47-55 |
| `aisandbox_oauth_state` (plus its signature cookie `aisandbox_oauth_state.sig`) | yes | only when `NODE_ENV === 'production'` | Lax | library default `/` | 10 minutes | GW/main.ts:36-45 |

Staging: the env template has `NODE_ENV=production` and `APP_BASE_URL=https://staging.ainow.biz` (ops/clean-baseline/env/gateway.env.template:1, 4), so the cookies are `Secure` there. Local: `NODE_ENV=development`, `APP_BASE_URL=http://localhost:3000` (.env.example:59, 62; services/api-gateway/.env.example:5, 73), so they are not `Secure`. Note: `NODE_ENV=staging` is a valid value (GW/startup/environment.validator.ts:10) and would give non-Secure cookies on https; the recommendation removes that trap.

### 1.2 Gateway: set, read, clear

| Cookie | Kind | Where | Note |
|---|---|---|---|
| session | set | GW/auth/auth.controller.ts:93-101 (`setSessionCookie`) | called at :147 (login), :290 (Google callback), :356 (Apple callback) |
| session | read | GW/auth/session-cookie.guard.ts:25 | `request.cookies` from cookie-parser |
| session | read | GW/auth/session-or-api-key.guard.ts:42 | after the Bearer branch |
| session | read (presence only) | GW/guards/same-origin-write.guard.ts:15, 33-45 | parsed cookies, then a hand parse of the raw header with `startsWith('aisandbox_session=')` |
| session | read | GW/websocket/websocket.gateway.ts:13, 60-98, 187-189 | Socket.IO handshake, its own parser, first match wins |
| session | read | GW/auth/auth.controller.ts:398 | logout revokes the token |
| session | clear | GW/auth/auth.controller.ts:399-401 | `clearCookie` with `path: '/'` only, no `secure` |
| csrf | set | GW/main.ts:48-55 | on every response whose request lacks the cookie, on every host, the preview host included |
| csrf | read | GW/main.ts:48 (presence), GW/auth/csrf.guard.ts:19 | double-submit: cookie must equal the `x-csrf-token` header |
| csrf | clear | none | |
| oauth_state | set, read, clear | GW/main.ts:36-45 (cookie-session) | the controller only touches `req.session`: writes :248-249, :312-313; reads :265, :278, :329, :342; clears through `clearOauthState` :103-105; strategies use `state: true` (GW/auth/google.strategy.ts:37, GW/auth/apple.strategy.ts:55) |

`CsrfGuard` is used on two routes only: logout (GW/auth/auth.controller.ts:394) and the admin entitlements PATCH (GW/admin/admin-operational.controller.ts:92). Everything else relies on the global `SameOriginWriteGuard` (CSRF-AUDIT-01).

Cookie parsing: `cookie-parser` 1.4.7 with `cookie` 0.7.2 keeps the first value for a repeated name (main checkout, node_modules/cookie/index.js:134, read only). Names are compared case-sensitively.

Preview-host cookie, for contrast: `aisandbox_preview` is HttpOnly, Lax, host-only, `Path=/api/preview/<sid>/`, 12 hours (GW/preview/preview-entry.controller.ts:112-118), and its guard tries every value sent under that name (GW/preview/preview-access.guard.ts:27-31, 97-98). It is not part of this task.

### 1.3 Frontend

| Cookie | Kind | Where |
|---|---|---|
| csrf | read (`document.cookie`) | FE/app/[locale]/app/page.tsx:190-196 (used at :1401-1406) |
| csrf | read | FE/components/auth/logout-button.tsx:11-17 (used at :68-73) |
| csrf | read | FE/components/knowledge/knowledge-api.ts:41-49 (used at :56-58) |
| csrf | read | FE/lib/collaboration/api.ts:153-161 (used at :168-170; imported by FE/hooks/useUserAgents.ts:4, 356) |
| session | read, then re-sent to the gateway | FE/lib/build-apply-confirm-proxy.server.ts:1, 44-59 (read), 156-161 and 176-183 (GETs with `Cookie: aisandbox_session=...`); called from FE/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts:19 |

Four copies of the same CSRF reader. `FE/middleware.ts` does not touch cookies (no match for "cookie"). Local routing: Next rewrites `/api/*` to the gateway (FE/next.config.js:9-19), so cookies are set for `localhost:3000`.

The auth-module generator forbids platform names in generated apps by substring (`content.includes(token)`, FE/lib/auth-module/auth-module-generator.ts:12-20, 122-126). A prefixed name still contains the old one, so these lists need no change.

### 1.4 Finding: the OAuth state cookie on staging (likely, verify live)

`cookie-session` 2.1.1 builds its cookie writer without a `secure` hint (node_modules/cookie-session/index.js:61-63). The `cookies` 0.9.1 library then throws "Cannot send secure cookie over unencrypted connection" when the option is `secure: true` and the request is plain http (node_modules/cookies/index.js:119-127), and cookie-session swallows that error (index.js:120-132). The gateway sits behind Caddy on `127.0.0.1:4000` over http (ops/clean-baseline/caddy/Caddyfile:12) and never sets `trust proxy` (repository search: no match). So with `NODE_ENV=production` the state cookie is very likely never written on staging. Google OAuth is not activated (ARCHITECTURE.md:370), which is why nothing shows. Not verified at runtime. This matters here only because `__Host-` needs `Secure`: renaming the state cookie is safe, but it does not make OAuth work. See follow-up F2.

### 1.5 Tests, e2e, ops, docs that name the cookies

| Area | Files (count of mentions) |
|---|---|
| Gateway specs, session | ai/__tests__/ai-execution.confirm-build-apply.http.spec.ts (13), ai-execution.ownership.http.spec.ts (7), ai-execution.run-status.http.spec.ts (3), auth/__tests__/session-or-api-key.guard.spec.ts (5), guards/same-origin-write.guard.spec.ts (5), guards/same-origin-write.guard.http.spec.ts (1), websocket/__tests__/websocket.gateway.spec.ts (8), preview/__tests__/preview.access.guard.spec.ts (1), preview.entry.spec.ts (2), preview.isolation.spec.ts (1) |
| Gateway specs, csrf | auth/__tests__/csrf.guard.spec.ts (1), admin/admin-operational.controller.spec.ts (2), guards/same-origin-write.guard.spec.ts (4) |
| Gateway specs, cookie attributes | none: no spec asserts the attributes of the session or CSRF cookie today |
| Frontend tests | lib/build-apply-confirm-proxy.server.test.ts (12 session, 2 csrf); lib/auth-module/*.test.ts (forbidden lists) |
| e2e harness | e2e/builder-golden-path/lib/auth.ts:72, 78 (a contract literal, not used by any test); lib/local-fixture.ts:453-454, 626-627 (a local http fixture sets both cookies) |
| ops, scripts | no mention (search over `ops/` and `scripts/`); agrees with docs/CSRF-AUDIT-01-CHECKPOINT.md:53 |
| Living docs | ARCHITECTURE.md:363, 364, 369, 371; CLAUDE.md:811-813 (rules, still true by substring) |
| Locked docs | 64 files under `docs/` mention the names; evidence, not edited |

Counts per cookie (production code): session 1 set (3 callers), 6 read (5 gateway, 1 Next server), 1 clear. CSRF 1 set, 6 read (2 gateway, 4 frontend), 0 clear. OAuth state: 1 middleware does all three.

## 2. Threat check

### 2.1 Can the preview host plant a cookie for the platform host? Yes.

| Way | Fact |
|---|---|
| Response header | The preview-host proxy forwards every upstream header except hop-by-hop ones, `Set-Cookie` included (GW/preview/preview-response-headers.ts:44-50; GW/preview/preview.controller.ts:130-134; called with `failSafe: false` at GW/preview/preview-entry.controller.ts:152-159). A dev-server preview can answer `Set-Cookie: aisandbox_session=X; Domain=staging.ainow.biz; Path=/api`. |
| Script | Preview-host pages have no CSP sandbox (it is added only off the preview host), so `document.cookie = 'aisandbox_csrf=X; Domain=staging.ainow.biz; Path=/api'` works. Script cannot set HttpOnly, but HttpOnly is not needed to shadow. |
| Scope | `preview.staging.ainow.biz` may set `Domain=staging.ainow.biz` or `Domain=ainow.biz`; neither is a public suffix. Both reach `staging.ainow.biz`. |
| Order | Browsers send longer-path cookies first; the gateway keeps the first value (1.2). A planted `Path=/api` cookie therefore wins on `/api/*`. |

Who can do this: code running in a preview, for example generated code steered by injected text. Today only Keith uses staging.

### 2.2 Per cookie

| Cookie | Today | With `__Host-` |
|---|---|---|
| session | Planted value wins on `/api/*`. A junk value locks the user out of the API until cookies are cleared. An attacker's own valid token makes the victim work inside the attacker's account (API keys, connector credentials and knowledge would be saved there). The attacker needs an account; today sign-up is closed behind basic_auth, so the practical risk now is the lock-out. | A browser refuses any `__Host-` cookie that has `Domain`, a path other than `/`, or no `Secure`. The preview host can set one only for itself; it never reaches the platform. One value at most arrives. |
| csrf | Planted value makes logout and the admin PATCH fail with 403 (the page reads the `Path=/` cookie, the server sees the planted one first). Forging a write is already blocked by `SameOriginWriteGuard`, so this is denial of service plus loss of the second layer. | Same protection. Double-submit becomes sound again as a second layer. |
| oauth_state | The cookie is signed, so it cannot be forged, but an attacker could plant their own valid pair to log the victim into the attacker's account (login CSRF). Only matters once OAuth is activated, and see 1.4. | Cannot be planted. |

### 2.3 What the prefix does not fix (marked where uncertain)

- **Fail-safe mode on the platform host.** With `PREVIEW_BASE_URL` unset, proxy responses are served on the platform host with the CSP sandbox, and upstream `Set-Cookie` still passes (GW/preview/preview.controller.ts:296-303). A sandbox does not stop the browser storing a response cookie. Being the platform host itself, it could set even a `__Host-` cookie. Section 5 closes this.
- **Eviction.** A sibling host can fill the cookie jar until the browser drops older cookies, which signs the user out. It cannot then install a replacement. Nuisance only. Not fixed here.
- **`Clear-Site-Data`.** A preview response with `Clear-Site-Data: "cookies"` may clear cookies for the whole registrable domain. Uncertain: browser behaviour differs. Sign-out only. Section 5 proposes dropping the header.
- **Old names during a dual-accept window** would keep the hole open for that window (section 4).
- A separate registrable domain for previews (PREVIEW-ORIGIN-02, registered) would remove this whole class. The prefix is the cheap fix now.

## 3. Options

| | (a) Rename to `__Host-` | (b) Keep names, refuse duplicates | (c) Both |
|---|---|---|---|
| Fixes | Planting from a sibling host, for all three cookies | A request with two values for one name is refused | (a), plus refusal in non-secure mode |
| Does not fix | Section 2.3 | Evict-then-replace (a single planted value is accepted); and a planted duplicate turns into a lock-out the user cannot clear without deleting cookies | Same as (a) |
| Breaks | Existing sign-ins end once. Local http needs a rule (below) | Nothing at deploy | As (a) |
| Effort | Small to medium: one helper, about 8 gateway files, 6 frontend files, new specs | Small: one middleware on the raw `Cookie` header | (a) plus (b) |
| Verdict | **Recommended** | Weaker, and adds a lock-out path | Not worth the extra code: in secure mode duplicates cannot exist, and local http has no sibling host |

Plan for local http under (a): one rule decides the mode, the same shape as the preview cookie's rule (GW/preview/preview-host.ts:108-110):

- **Secure mode** = `APP_BASE_URL` is https, or `NODE_ENV === 'production'`. Names are `__Host-aisandbox_session`, `__Host-aisandbox_csrf`, `__Host-aisandbox_oauth_state`; `Secure` always; `Path=/`; never `Domain`. The gateway reads only these names; the old names are ignored.
- **Otherwise** (local http, Jest): today's names and attributes, unchanged.

Why not `__Host-` everywhere: it needs `Secure`, and Secure cookies over `http://localhost` work in Chrome and Firefox but not reliably in Safari (uncertain for current versions); and the existing specs and the e2e local fixture (about 60 mentions) would all need edits for no security gain, since local has no sibling host. The cost of two modes is that secure mode must have its own tests; section 6 lists them.

## 4. Migration

| Choice | Effect |
|---|---|
| **One forced sign-in (recommended)** | After the deploy the gateway ignores `aisandbox_session`. Keith is signed out once and signs in again. The CSRF cookie re-issues itself on the next response. |
| Accept both names for a window | No sign-out, but the old name stays plantable for the whole window, and the code needs a second deploy to remove it. |

Why forced sign-in: only Keith uses staging, one sign-in is cheap, and it leaves no window and no clean-up deploy.

Details for the worker:

- Login and logout in secure mode also send a clearing `Set-Cookie` for the old `aisandbox_session` (`Path=/`), so the stale cookie goes at once instead of after up to 7 days.
- The old server-side session row stays valid until it expires; nothing presents it. Acceptable.
- Clearing a `__Host-` cookie needs `Secure` and `Path=/` on the clearing header, or the browser ignores it. Today's `clearCookie` passes only `path` (GW/auth/auth.controller.ts:399-401); it must use the same options as the setter.
- `SameOriginWriteGuard` rule 3 (session cookie without `Origin` is refused) must treat **either** name as "has a session cookie". Its raw-header check uses `startsWith('aisandbox_session=')` (GW/guards/same-origin-write.guard.ts:42-44), which does not match the prefixed name, so the rule would silently stop working if only the constant changed.

## 5. Set-Cookie on the preview proxy

Rule, applied in `forwardPreviewRequest` after `filterProxyResponseHeaders` (GW/preview/preview.controller.ts:130-131):

| Where the response is served | Rule |
|---|---|
| Platform host: every route through `forwardPreviewRequest` from `PreviewController` (proxy in fail-safe mode, and start, stop, status) | Drop every upstream `Set-Cookie`. Nothing on the platform host needs a cookie from a preview or from container-manager. |
| Preview host (`PreviewEntryController`, GW/preview/preview-entry.controller.ts:152-159) | Keep `Set-Cookie`, so a generated app's own sign-in works in the preview. Drop a line when it has a `Domain` attribute, or when its name contains `aisandbox_` (any case). Host-only app cookies pass. |
| Both | Drop upstream `Clear-Site-Data` (section 2.3; see question 3). |

The preview-host part is tidiness, not the defence: script there can still write `Domain` cookies with `document.cookie`. The prefix is what stops those from mattering.

Files: `GW/preview/preview-response-headers.ts` (one new exported function), `GW/preview/preview.controller.ts` (`forwardPreviewRequest` gains a flag saying which host it serves; `failSafe` stays as it is, because start, stop and status pass `failSafe: false` on the platform host), `GW/preview/preview-entry.controller.ts` (passes the flag).

Tests: `GW/preview/__tests__/preview.response-headers.spec.ts` (unit: array and single-string `set-cookie`, mixed-case header name, `Domain` in any case, reserved names, host-only cookie kept, `Clear-Site-Data` dropped); `GW/preview/__tests__/preview.isolation.spec.ts` (HTTP: platform host with `PREVIEW_BASE_URL` unset gives no `Set-Cookie`; preview host keeps a host-only cookie and drops a `Domain` one; the gateway's own `aisandbox_preview` cookie on the enter route is unaffected).

## 6. Recommendation for Step 3

Option (a) with the two-mode rule, forced sign-in, and the section 5 rule. One slice; it must deploy as one, because the gateway rename needs the frontend CSRF reader. (The frontend change alone is backward compatible: it reads the prefixed name first, then the old one.) If Keith wants it smaller, the section 5 rule can go first as its own slice; it is independent.

### 6.1 Write set

Gateway, code:

| File | Change |
|---|---|
| `services/api-gateway/src/auth/platform-cookies.ts` (new) | The mode rule; the three names for the current mode; option builders for set and clear; the CSRF cookie middleware and the cookie-session options, moved out of `main.ts` so they can be tested; a helper that says whether a request carries a session cookie under either name |
| `services/api-gateway/src/main.ts` | Uses the helper for the cookie-session options and the CSRF middleware; no other change |
| `services/api-gateway/src/auth/auth.controller.ts` | `setSessionCookie`, logout read and clear, clearing of the old name in secure mode |
| `services/api-gateway/src/auth/session-cookie.guard.ts` | reads the current name |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | reads the current name |
| `services/api-gateway/src/auth/csrf.guard.ts` | reads the current name |
| `services/api-gateway/src/guards/same-origin-write.guard.ts` | rule 3 for either name, exact-name match on the raw header |
| `services/api-gateway/src/websocket/websocket.gateway.ts` | handshake reads the current name |
| `services/api-gateway/src/preview/preview-response-headers.ts`, `preview.controller.ts`, `preview-entry.controller.ts` | section 5 |

Gateway, specs: `auth/__tests__/platform-cookies.spec.ts` (new), `auth/__tests__/platform-cookies.http.spec.ts` (new), `auth/__tests__/csrf.guard.spec.ts`, `auth/__tests__/session-or-api-key.guard.spec.ts`, `auth/auth.controller.spec.ts`, `guards/same-origin-write.guard.spec.ts`, `websocket/__tests__/websocket.gateway.spec.ts`, `preview/__tests__/preview.response-headers.spec.ts`, `preview/__tests__/preview.isolation.spec.ts` (all under `services/api-gateway/src/`).

Frontend:

| File | Change |
|---|---|
| `frontend/lib/csrf-cookie.ts` (new), `frontend/lib/csrf-cookie.test.ts` (new; covered by the `lib/*.test.ts` glob in frontend/package.json:10) | One reader: `__Host-aisandbox_csrf` first, then `aisandbox_csrf`; exact-name match |
| `frontend/app/[locale]/app/page.tsx`, `frontend/components/auth/logout-button.tsx`, `frontend/components/knowledge/knowledge-api.ts`, `frontend/lib/collaboration/api.ts` | The four local readers call the shared one; `readCsrfToken` stays exported from `collaboration/api.ts` |
| `frontend/lib/build-apply-confirm-proxy.server.ts`, `frontend/lib/build-apply-confirm-proxy.server.test.ts` | Reads the prefixed session name first, then the old one, and re-sends under the name it found |

e2e: `e2e/builder-golden-path/lib/auth.ts` (the contract literal at :72 and :78 lists both spellings). `local-fixture.ts` is unchanged (local mode).

Control plane at LOCK, not the worker: `ARCHITECTURE.md` (the Cookies line and the two lines that name `aisandbox_session`), the board, the backlog, the sidecar, the checkpoint. `CLAUDE.md` needs no change.

Not in the write set: every existing spec that sends `aisandbox_session=` (they run in non-secure mode and must pass unchanged), message files, `package.json`, migrations, ops files.

### 6.2 Mutexes

GATEWAY and FRONTEND. No I18N (no visible text). No PACKAGE (no new dependency). No HOTFILE: `page.tsx` is covered by FRONTEND. The e2e file is outside both, as in CSRF-AUDIT-01.

### 6.3 Tests to add

1. Mode rule: https `APP_BASE_URL` gives secure mode; `NODE_ENV=production` with no `APP_BASE_URL` gives secure mode; `http://localhost:3000` with `development` or `test` does not; `NODE_ENV=staging` with an https URL does.
2. Secure mode, HTTP level with the real cookie-parser, middleware and guards: the CSRF `Set-Cookie` is `__Host-aisandbox_csrf` with `Secure`, `Path=/`, `SameSite=Lax`, no `Domain`, no `HttpOnly`; it is issued when only the old name is present and not when the new one is.
3. Secure mode: login sets `__Host-aisandbox_session` with `HttpOnly`, `Secure`, `Path=/`, `SameSite=Lax`, 7 days, no `Domain`, and clears the old name; logout clears the new name with `Secure` and `Path=/`.
4. Secure mode: a request carrying only `aisandbox_session` is 401 on `SessionCookieGuard` and `SessionOrApiKeyAuthGuard`; the same token under the new name passes. With both present and different, only the new one is used.
5. Secure mode: `CsrfGuard` compares the header with the new cookie only; a planted old-name cookie equal to the header is refused.
6. `SameOriginWriteGuard`: a write without `Origin` is refused when either name is present, in the parsed cookies or in the raw header; `x__Host-aisandbox_session` is not treated as the session cookie.
7. Socket.IO handshake in secure mode: new name accepted, old name refused.
8. cookie-session options in secure mode: the name is `__Host-aisandbox_oauth_state`, `secure` true, no `domain`, path `/`.
9. Non-secure mode: names and attributes exactly as today (pins local development).
10. Frontend reader: prefixed wins over old; old used when alone; `x__Host-aisandbox_csrf` ignored; no cookie gives null. Confirm proxy: prefixed first, re-sent under the same name.
11. Section 5 tests.

### 6.4 Gates

- Gateway: `npm test` (expected: all pass except the 14 known `smoke.integration` failures) and `npm run build`.
- Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`, then restore `frontend/tsconfig.tsbuildinfo`.
- e2e: only if the harness has a type check or contract suite the worker can run without a server; otherwise state it was not run.

### 6.5 Model, lifecycle, stop conditions

- Model: **opus** (auth, guards, CSRF). Subagent in a worktree. Evidence class LOCAL-TESTS. Not deployed by this task.
- Stop and report, without working round it, when:
  1. an existing spec outside the write set fails and would need editing;
  2. `cookie-session` or `cookie-parser` rejects or mangles a `__Host-` name;
  3. the change would need `trust proxy`, a new dependency, a migration, or a change to `SessionCookieGuard`'s session validation, internal routes or the preview ticket;
  4. any other reader of a platform cookie turns up that is not in section 1;
  5. visible text would have to change.

## 7. Acceptance criteria

1. In secure mode the gateway sets only `__Host-aisandbox_session`, `__Host-aisandbox_csrf` and `__Host-aisandbox_oauth_state`, each with `Secure`, `Path=/` and no `Domain`; HttpOnly, SameSite and Max-Age are as in section 1.1.
2. In secure mode no gateway code path authenticates, or passes the CSRF check, from an old-name cookie.
3. Outside secure mode names and attributes are exactly today's, and every existing gateway and frontend test passes unedited (apart from the specs listed in 6.1, which only gain tests).
4. Logout clears the session cookie in both modes; in secure mode login and logout also clear the old name.
5. `SameOriginWriteGuard` refuses a write without `Origin` when a session cookie is present under either name.
6. The Socket.IO handshake and the Next confirm-build-apply route work with the prefixed session cookie.
7. The frontend sends `X-CSRF-Token` from `__Host-aisandbox_csrf` when present, else from `aisandbox_csrf`; there is one reader, used by all four call sites.
8. Preview responses on the platform host carry no upstream `Set-Cookie`. On the preview host, host-only app cookies pass; lines with `Domain` or a name containing `aisandbox_` do not. The `aisandbox_preview` cookie is unchanged.
9. No visible text, dependency, migration, env variable or ops file changes. `trust proxy` is not set.
10. The tests in 6.3 exist and pass; gates in 6.4 are reported with exact results.
11. The checkpoint carries the CHECKLIST line (EVERY, BACKEND; UI and FLOWS not applicable with the reason) and the FOLLOWUPS line.

## 8. Deploy and live check (a later task, STAGING-DEPLOY-COOKIE-01)

Needs STAGING and ENV. Runs stay off. No migration. Keith is told first that he will be signed out once.

Host checks with curl against `http://127.0.0.1:4000` (no sign-in needed):

| Check | Expect |
|---|---|
| `GET /api/health` with no cookie, headers only | `Set-Cookie: __Host-aisandbox_csrf=...; Path=/; Secure; SameSite=Lax`; no `Domain`, no `HttpOnly`; no `aisandbox_csrf=` line |
| Same with `Cookie: aisandbox_csrf=x` | the prefixed cookie is still issued |
| Same with `Cookie: __Host-aisandbox_csrf=x` | no CSRF `Set-Cookie` |
| `POST /api/auth/logout` with app `Origin`, `Cookie: aisandbox_csrf=t` and `X-CSRF-Token: t` | 401 or 403, never 200 |
| `GET /api/auth/google` | report whether any `Set-Cookie` for the state cookie appears (expected none, section 1.4); not a pass or fail |
| CSRF-AUDIT-01 guard checks | unchanged results (foreign Origin 403, and so on) |
| Config | `gateway.env` and the Caddyfile at their baseline hashes |

Session cookie with curl: no test account for password sign-in was found in the repository, and the stored staging test key is an API key, which sets no cookie. So the session cookie's attributes are proven by the Step 3 tests, and live by Keith's pass. Preview `Set-Cookie`: also proven by tests; a live curl would need a running preview and a preview cookie.

Keith's pass (about two minutes):

1. Open the app: he is signed out. Sign in.
2. Reload: still signed in.
3. Open a project and its preview: the preview loads.
4. Log out: it works (this proves the CSRF cookie). Sign in again.

## 9. Open questions for Keith

1. **Two modes or one?** Recommended: `__Host-` names in secure mode only, today's names on local http. Alternative: `__Host-` everywhere, which means editing about 60 test mentions and the e2e fixture, and local sign-in may fail in Safari.
2. **Migration.** Recommended: one forced sign-in. Alternative: accept both names for a short window, with a second deploy to remove the old one.
3. **Preview-host cookies.** Recommended: keep host-only app cookies on the preview host, drop lines with `Domain` or a platform name, and drop `Clear-Site-Data`. Alternative: strip every `Set-Cookie` everywhere, which is simpler but breaks sign-in inside a previewed app.
4. **OAuth state cookie.** Recommended: rename it now with the others (one line) and leave the proxy problem of section 1.4 to follow-up F2, to be done before OAuth is activated. Alternative: leave that cookie alone in this task.

## 10. Follow-ups named here

| ID (proposed) | What | Ready when |
|---|---|---|
| F1 STAGING-DEPLOY-COOKIE-01 | Deploy and live check, section 8 | COOKIE-PREFIX-01 LOCKED |
| F2 OAUTH-STATE-PROXY-01 | Confirm on staging that the OAuth state cookie cannot be set behind Caddy (section 1.4) and fix it (a scoped proxy-trust setting or another state store). Pairs with APPLE-STATE-01 | Keith decides; before Google or Apple sign-in is activated |
| F3 (note for PREVIEW-ORIGIN-02, already registered) | Cookie-jar eviction and `Clear-Site-Data` from a sibling host can sign the user out; only a separate registrable domain removes this | no new task; add the note to PREVIEW-ORIGIN-02 if Keith agrees |

## 11. Checklist (Step 2)

CHECKLIST: EVERY 11/11 (1: admitted on the board, Lane 1, write set this one document; 2: 4-step, this is Step 2; 3: fable, named with the reason; 4: self-contained brief, boot sequence followed, no further subagents; 5: only this file written, no dependency; 6: not applicable, a document; 7: not applicable, no code; 8: no runtime started; 9: no build artifacts; 10: one commit on `lane/COOKIE-PREFIX-01` only, no push, merge or branch change; 11: follow-ups in section 10).

Not verified in this step: anything at runtime (section 1.4 and the browser behaviours marked uncertain in sections 2.3 and 3).
