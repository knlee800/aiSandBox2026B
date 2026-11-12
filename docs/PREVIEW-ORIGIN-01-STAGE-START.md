# PREVIEW-ORIGIN-01 — Stage-start (Step 2 of 4)

Date: 2026-11-12. Author: fable subagent (stage-start draft; security and architecture). Status: DRAFT for Keith's approval. No code was changed and nothing was run; every fact below comes from a file that was opened (file:line). Browser behaviour that the repository cannot prove is marked **uncertain**.

Short names: FE = `frontend/`, GW = `services/api-gateway/src/`, CM = `services/container-manager/src/`.

## 0. Summary

- The risk is real: a generated app's script runs as the platform origin and can act as the signed-in user.
- The cheap fix (a `sandbox` attribute or a `Content-Security-Policy: sandbox` header alone) very likely breaks every preview that has more than one file, because the browser stops sending the session cookie for the app's own CSS, JS and images. It also makes `localStorage` throw inside generated apps.
- Recommended first slice: serve previews from a **separate preview host name**, entered through a short-lived signed ticket, with the CSP sandbox header as the fail-safe when the preview host is not configured. Code is LOCAL-TESTS (FRONTEND + GATEWAY); the host name, Caddy and env go in a separate deploy task.
- The "Select Element" picker depends on same-origin access and stops working under any real fix. The slice hides it; a follow-up rebuilds it.
- The `/driver` API key moves to memory only.

## 1. Confirmed risk

### 1.1 Request path today

| Step | Fact | Reference |
|---|---|---|
| iframe | `<iframe ref src={props.previewUrl} onLoad onError className>`; no `sandbox`, no `allow`, no `referrerPolicy` | FE/components/workspace/workspace-shell.tsx:5186-5194 |
| URL | `/api/preview/<sessionId>/proxy?refresh=<n>`, relative, so it is the platform origin | FE/components/workspace/workspace-preview.logic.ts:64-66 |
| URL set at | four call sites after status or start succeeds | FE/app/[locale]/app/page.tsx:6262, 6299, 6321, 6400 |
| Staging routing | one Caddy site `staging.ainow.biz` with `basic_auth`; `/api/*` goes to the gateway on 127.0.0.1:4000, everything else to Next on 127.0.0.1:3002 | ops/clean-baseline/caddy/Caddyfile:1-17 |
| Local routing | Next fallback rewrite `/api/:path*` to `API_GATEWAY_URL` | FE/next.config.js:9-19 |
| Gateway guards | `SessionCookieGuard` then `PreviewOwnershipGuard` on the whole controller | GW/preview/preview.controller.ts:163-165 |
| Session cookie check | reads `aisandbox_session` from the request cookies | GW/auth/session-cookie.guard.ts:25-34 |
| Ownership | path segment 3 is the session id; `session.userId` must equal the caller | GW/preview/preview-ownership.guard.ts:31-45 |
| Allowed shapes | `start` POST; `stop` POST, DELETE; `status` GET, HEAD; `proxy` and `proxy/<rest>` GET, HEAD only | GW/preview/preview.controller.ts:36-41, 71-131 |
| Upstream request | `cookie`, `authorization`, `x-csrf-token` and the internal key header are removed before the call to container-manager | GW/preview/preview.controller.ts:8-18, 246 |
| Response headers | every upstream header is copied except hop-by-hop ones. Nothing is added: no CSP, no `X-Frame-Options`, no `nosniff`. Upstream `Set-Cookie` is passed through | GW/preview/preview-response-headers.ts:9-24, 44-50; GW/preview/preview.controller.ts:255-258 |
| Static preview | container-manager reads the file and sends it with only a `Content-Type` | CM/preview/preview.controller.ts:124-139 |
| Base tag | static HTML gets `<base href="/api/preview/<sid>/proxy/">` (an absolute path, no host) | CM/preview/preview.service.ts:612-623 |
| Dev-server preview | proxied to the container; no WebSocket (`ws: true` was removed on purpose) | CM/preview/preview.controller.ts:26-38, 141-144 |
| Other headers | no helmet or CSP anywhere in services, frontend or ops (repository search: no match) | — |

Cookies (all host-only: no `domain` is set):

| Cookie | httpOnly | SameSite | Reference |
|---|---|---|---|
| `aisandbox_session` | yes | lax | GW/auth/auth.controller.ts:93-101 |
| `aisandbox_csrf` | **no** | lax | GW/main.ts:47-55 |
| `aisandbox_oauth_state` | yes | lax | GW/main.ts:36-45 |

CSRF is a double-submit check: the `x-csrf-token` header must equal the `aisandbox_csrf` cookie (GW/auth/csrf.guard.ts:19-31).

### 1.2 What a preview script can do today

The preview document has the same origin as the platform page, so:

| Action | Today | Why |
|---|---|---|
| `fetch('/api/...')` with the user's session | **Yes** | same origin; the browser attaches `aisandbox_session` |
| Pass the CSRF check on writes | **Yes** | it reads `aisandbox_csrf` from `document.cookie` (not httpOnly) and sends it as `x-csrf-token` |
| Read `aisandbox_session` itself | No | httpOnly. Not needed: the script can already call any API as the user |
| Read or change the platform page (`parent.document`, `parent.fetch`) | **Yes** | same origin, no sandbox |
| Read platform `localStorage` and `sessionStorage` | **Yes** | same origin. Holds the `/driver` API key (FE/app/[locale]/driver/page.tsx:74, 288), saved chat threads (FE/app/[locale]/app/page.tsx:1917, 1960) and pending runs (page.tsx:966-974) |
| Navigate the top window | **Yes** | same origin, no sandbox |
| Set cookies on the platform host | **Yes** | `document.cookie`, or `Set-Cookie` from a dev-server preview (passed through, see 1.1) |
| Reach other users' data | Only through the user's own rights | Keith is an admin; the admin entitlement PATCH needs only the session, the admin role and the CSRF header (GW/admin/admin-operational.controller.ts:46-47, 90-92) |

Examples of what this reaches: list and create API keys (`/api/keys`, GW/auth/api-key.controller.ts:33-34), connectors and mail (GW/connectors/connectors.controller.ts:42-43), admin routes. The same holds if the proxy URL is opened directly in a tab.

Who is exposed today: only Keith (staging is behind basic_auth and there are no other users). The path is still real: generated code can follow instructions injected through search results, mail or knowledge text.

### 1.3 What the platform relies on in the iframe

| Use | Needs same origin? | Reference |
|---|---|---|
| `onLoad` sets the preview state to ready | No, the load event fires for any origin | FE/app/[locale]/app/page.tsx:6452-6459; workspace-shell.tsx:1490-1495 |
| `onError` retry | No | page.tsx:6461 onward |
| Refresh | No, it only changes `?refresh=` in the URL | workspace-preview.logic.ts:64-66 |
| **Select Element picker: inject** | **Yes**: reads `iframe.contentDocument` and appends a script to its body | workspace-shell.tsx:1394-1414 |
| **Picker: remove** | **Yes** (`contentDocument`) | workspace-shell.tsx:1416-1437 |
| **Picker: result message** | **Yes**: accepts the message only when `event.origin === window.location.origin` | workspace-shell.tsx:1462-1481; workspace-preview.logic.ts:97-109 |
| Picker script posts to the parent with target `'*'` | — | workspace-preview.logic.ts:298 |
| Base tag | No, it is a path without a host | CM/preview/preview.service.ts:617 |
| Hot reload over WebSocket | Not present today | CM/preview/preview.controller.ts:29-30; CM/__tests__/preview-proxies.http.spec.ts:198 |
| Tests | Rendered-HTML and source tests for the iframe and the picker toggle | FE/components/workspace/workspace-shell.test.tsx:5372, 5375-5476, 7061-7078, 7201-7299 |

So the only platform feature that breaks is the picker. It fails silently: both functions catch the error and return (workspace-shell.tsx:1411-1413, 1434-1436). The picker is not named in PRD.md (search for "picker" and "visual edit": no match).

### 1.4 The finding that decides the options

A document sandboxed without `allow-same-origin` (by the attribute or by the CSP header) gets an opaque origin. Then:

1. Requests it makes for its own CSS, JS, images and links count as cross-site, so the `SameSite=Lax` session cookie is not sent, and `SessionCookieGuard` answers 401 for every asset. Only a single-file `index.html` would still render. **Uncertain** in the strict sense (browser behaviour; standard in Chrome, Firefox and Safari as far as I know), so Step 3 proves it first.
2. `<script type="module">` and fonts need CORS from an opaque origin; the gateway allows only `APP_BASE_URL` (GW/cors/http-cors-origin.ts:3-8; GW/websocket/websocket.gateway.ts:26-57), so they fail too.
3. `localStorage`, `sessionStorage`, cookies and IndexedDB throw inside the generated app. Many generated apps use `localStorage`.

So a sandbox alone is not a small fix: it needs a second way to authorize asset requests, and it still changes how generated apps behave.

## 2. Options

| Option | Fixes | Breaks | Effort | Files |
|---|---|---|---|---|
| (a) iframe `sandbox` without `allow-same-origin` | Everything in 1.2 for the embedded preview | Multi-file previews (1.4), app storage, the picker. Does not cover opening the proxy URL in a tab | Attribute: tiny. To make previews work again: a token in the URL path, CORS headers and a base-tag change in container-manager: large, three services | workspace-shell.tsx; then GW/preview/*, CM/preview/preview.service.ts |
| (b) `Content-Security-Policy: sandbox ...` on every proxy response | Same as (a), and also the direct-tab case | Same as (a) | Header: tiny. Working previews: same large work as (a) | GW/preview/preview-response-headers.ts, preview.controller.ts |
| (c) separate preview host | Everything in 1.2, embedded or in a tab. The app keeps a normal origin, so storage, modules and fonts work | The picker. Needs a DNS record, a Caddy site, TLS (Caddy issues it per host name), a decision on basic_auth, one env variable. Needs its own sign-in for the preview host, because the session cookie is host-only and must stay that way | Medium: gateway and a small frontend change, plus a host change | GW/preview/*, workspace-shell.tsx; later ops/clean-baseline/caddy/Caddyfile, gateway env |
| (d1) (a)+(b) | As (b) | As (a) | As (a) | — |
| (d2) **(c) + (b) as fail-safe + a limited iframe `sandbox`** | As (c); when the preview host is not configured, the header still stops same-origin script (previews degrade to single-file instead of running as the platform) ; the attribute blocks top-window navigation | The picker | Medium | as (c) |

Notes on (c):

- Staging and DNS: a sibling name such as `preview.staging.ainow.biz` (Keith adds one A record; where DNS is managed is not in the repository). The host Caddyfile is installed only by `aisandbox-prepare` (ops/clean-baseline/bin/aisandbox-prepare; `aisandbox-deploy` has no Caddy step), so the running host needs an approved manual edit, `caddy validate` and a reload, and the template plus its static test (ops/clean-baseline/tests/static/t-caddy-site.sh) are updated to match.
- The preview site block forwards only `/api/preview/*` to the gateway and answers 404 for everything else.
- basic_auth: keeping it on the preview host means the browser asks once more, inside the iframe, per browser session (**uncertain**: some browsers may not show the prompt in a cross-origin frame; opening the preview host once in a tab works around it). Dropping it there leaves the ticket and the preview cookie as the only gate on that host.
- A sibling name is the same site as the platform. That keeps the preview cookie first-party (it would be blocked as a third-party cookie under a different domain in several browsers), but `SameSite=Lax` does not stop requests from the preview host to the platform: only CORS (reads) and `CsrfGuard` (writes) do. Routes that take the session cookie and write without `CsrfGuard`, for example preview `start` and `stop` (GW/preview/preview.controller.ts:163, 182), stay callable blind. A preview script can also set a cookie for the parent domain. Both are deferred items in section 3.
- Rejected: widening `aisandbox_session` with a `Domain` so it reaches the preview host. One Caddy mistake would then expose every API to preview script.

### The /driver API key

`/driver` is an unlinked developer page ("AI Driver (Phase 37C)", hardcoded English, FE/app/[locale]/driver/page.tsx:314): it sends a prompt to `/api/ai/execute` with a typed API key as a Bearer token (page.tsx:62, 143, 251) and keeps the key in `localStorage` "for convenience" (page.tsx:72-77, 287-288). No other frontend file links to it (search for `/driver`: no match outside the page).

| Choice | Effect |
|---|---|
| `sessionStorage` | Still readable by a same-origin frame in the same tab; little gain |
| **Memory only (recommended)** | Remove the read and the write, and delete any stored `driver_api_key` on load. The key is typed again after a reload. No visible text changes |
| Drop the page | Cleanest, but removes a tool; a separate decision |

## 3. Recommendation

First slice: **(d2)** plus the `/driver` change.

1. On the platform host, the gateway never serves preview content with platform-origin rights. With `PREVIEW_BASE_URL` set, `GET /api/preview/<sid>/proxy[...]` (session cookie and ownership checked as today) answers **302** to `<preview host>/api/preview/<sid>/enter?ticket=...` and keeps the rest of the path and the query. The frontend URL code does not change.
2. `GET /api/preview/<sid>/enter` works only on the preview host. It checks the ticket (HMAC, bound to session id and user id, about 60 seconds), sets `aisandbox_preview` (httpOnly, Secure in production, SameSite=Lax, host-only, `Path=/api/preview/<sid>/`, about 12 hours) and redirects to the proxy path. `Referrer-Policy: no-referrer` on that answer.
3. On the preview host, only `enter` and proxy GET/HEAD exist. Proxy requests need a valid `aisandbox_preview` for that session, and the session must still belong to that user. Everything else is 404. The session cookie is never accepted there.
4. Fail-safe: any proxy response served on a host that is not the preview host (including when `PREVIEW_BASE_URL` is unset) carries `Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals allow-popups`.
5. Signing key: 32 random bytes made at gateway start, kept in memory. No new secret and no env change for it; a gateway restart only means the next Refresh issues a new ticket. The gateway is one node process (ops/clean-baseline/systemd/aisandbox-gateway.service:16).
6. iframe: `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"`. Here `allow-same-origin` only lets the app keep its own preview origin; the missing `allow-top-navigation` stops the app from redirecting the whole tab.
7. Picker: hide the "Select Element" toggle (no new text); the picker code stays for the follow-up.
8. `/driver`: key in memory only; stored key removed on load.

Deferred, with suggested follow-ups (each needs registration by the control plane):

| Follow-up | What |
|---|---|
| PREVIEW-ORIGIN-DEPLOY-01 | DNS record (Keith), Caddy preview site, `PREVIEW_BASE_URL` in the gateway env and its template, deploy, live check. Evidence STAGING-RUNTIME; mutexes STAGING, ENV. Until it lands, the new code must not be deployed, or multi-file previews degrade (fail-safe mode) |
| PREVIEW-PICKER-01 | Rebuild Select Element over `postMessage` with a small script served inside the preview and an origin check against the preview host |
| CSRF-AUDIT-01 | List every cookie-authenticated write route without `CsrfGuard` (starting with preview start and stop) and fix them |
| COOKIE-PREFIX-01 | Rename platform cookies with the `__Host-` prefix so a sibling host cannot overwrite them; decide whether to drop upstream `Set-Cookie` with a `Domain` |
| PREVIEW-ORIGIN-02 | One origin per session (wildcard host) or a separate registrable domain, so previews of different sessions do not share storage; would also let dev-server previews with root-absolute paths work (**uncertain** whether those work today) |
| DRIVER-PAGE-01 | Keep or delete `/driver` |
| ARCHITECTURE.md section 6 | Update the Preview Proxy Path after the deploy (GOVERNANCE) |

## 4. Implementation plan (Step 3)

### 4.1 Write set

Gateway:

- `services/api-gateway/src/preview/preview.controller.ts` (redirect on the platform host; fail-safe header; guard wiring)
- `services/api-gateway/src/preview/preview-response-headers.ts` (the fail-safe header helper)
- `services/api-gateway/src/preview/preview.module.ts`
- new `services/api-gateway/src/preview/preview-ticket.ts` (sign and verify ticket and cookie value; constant-time compare)
- new `services/api-gateway/src/preview/preview-host.ts` (read `PREVIEW_BASE_URL`; is this request on the preview host)
- new `services/api-gateway/src/preview/preview-access.guard.ts` (platform host: session cookie and ownership as today; preview host: preview cookie and ownership)
- new `services/api-gateway/src/preview/preview-entry.controller.ts` (`GET :sessionId/enter`)
- specs, new: `__tests__/preview.ticket.spec.ts`, `__tests__/preview.access.guard.spec.ts`, `__tests__/preview.entry.spec.ts`, `__tests__/preview.isolation.spec.ts`
- specs, updated as needed: `__tests__/preview.controller.guard.spec.ts`, `__tests__/preview.endpoint-contract.spec.ts`, `__tests__/preview.response-headers.spec.ts`, `__tests__/preview.header-sanitization.spec.ts`, `__tests__/preview.proxy-target.spec.ts`, `__tests__/preview.traversal.spec.ts`

Frontend:

- `frontend/components/workspace/workspace-shell.tsx` (iframe `sandbox`; hide the picker toggle)
- `frontend/components/workspace/workspace-shell.test.tsx` (picker toggle tests at 5375-5476 change; new attribute test)
- new `frontend/components/workspace/preview-isolation.source.test.ts` (source test; sits in a folder the test script already globs, frontend/package.json:10)
- `frontend/app/[locale]/driver/page.tsx`

Not in the write set: container-manager (the base tag is a host-less path and still resolves on the preview host), `frontend/app/[locale]/app/page.tsx`, `workspace-preview.logic.ts`, message files, env files, Caddy files, `main.ts`, the auth guards, any migration or package file.

### 4.2 Mutexes and text

- Mutexes: **FRONTEND, GATEWAY**. No CONTAINER-MANAGER, I18N, COMPOSE, ENV, PACKAGE or HOTFILE lease (the code only reads a new variable; env files change in the deploy task).
- User-visible text: none added or changed. One control (the picker toggle) is hidden; its keys `selectElement`, `deselectElement`, `pickerActive` stay in en, zh-TW and zh-CN (FE/messages/en.json:260-263).
- Auth: this adds a platform cookie and a guard for preview routes. `aisandbox_session`, `aisandbox_csrf`, `CsrfGuard`, `SessionCookieGuard`, internal routes and the internal key are not changed. Approval of this stage-start is the explicit authorization CLAUDE.md "Auth and Security Rules" asks for.
- Checklists for the brief: EVERY, UI, BACKEND (copied from docs/control-plane/task-checklists.md). UI skills (impeccable, emil-design-eng) are named in the brief; the only UI change is one hidden control.

### 4.3 Tests to add

Gateway (jest):

1. Ticket: round trip; wrong session id, wrong user, expired, altered and malformed tickets are refused.
2. Platform host, `PREVIEW_BASE_URL` set: proxy GET with a valid session answers 302 to the preview host `enter` URL with path and query kept; container-manager is not called; no session cookie means 401 as today.
3. `enter`: on the preview host a valid ticket sets `aisandbox_preview` with httpOnly, SameSite=Lax, the session path and no Domain, then redirects; a bad ticket is refused; on the platform host it is 404.
4. Preview host: proxy GET with a valid preview cookie is forwarded and the body is streamed (the preview still loads); no cookie, another session's cookie, or a session that changed owner is refused; a session cookie alone is refused; `start`, `stop`, `status` and any other path are 404; the outgoing request still drops `cookie` and `authorization` and adds the internal key.
5. Fail-safe: with `PREVIEW_BASE_URL` unset, every proxy response (stream and non-stream) carries the CSP sandbox header without `allow-same-origin`; `start`, `stop` and `status` behave as today.
6. The existing traversal, endpoint-contract and header-sanitization specs still pass.

Frontend (tsx --test):

7. The rendered iframe has the `sandbox` attribute with the exact token list and no `allow-top-navigation`.
8. The picker toggle is not rendered; Start, Stop and Refresh still are.
9. Source test: `driver/page.tsx` has no `localStorage.setItem('driver_api_key'` and no `getItem('driver_api_key'`, and removes the old value.

### 4.4 Gates

- Frontend: `npx tsc --noEmit`, `npm test`, `npm run build`, then restore `frontend/tsconfig.tsbuildinfo`.
- Gateway: `npm test`, `npm run build`.
- Container-manager: none (no change).

### 4.5 Deploy and live check (in PREVIEW-ORIGIN-DEPLOY-01, not this slice)

From the staging host with curl, using a stored test session:

1. Platform proxy URL with the session cookie: 302, `Location` on the preview host.
2. That `enter` URL: 302 and `Set-Cookie: aisandbox_preview` with HttpOnly, the session path and no Domain.
3. Preview host proxy URL with that cookie: 200 with the app's HTML; an asset path: 200; without the cookie: refused.
4. Preview host with only the session cookie: refused. Preview host `/en` and `/api/keys`: 404.
5. Platform host never answers 200 with preview HTML.

Keith in the browser (a few minutes): the preview of a multi-file app renders with its CSS and JS; Refresh works; an app that uses `localStorage` works; the address of the iframe is the preview host; the basic_auth prompt behaviour is noted.

### 4.6 Model, stop conditions, lifecycle

- Model: **opus** subagent (security: guards, cookies, auth; GOV-ROUTING-01), in worktree `lane/PREVIEW-ORIGIN-01`.
- First action in Step 3: the worker states how it tells the preview host from the platform host behind Caddy and behind the local Next rewrite (which header carries the browser's host), with a test. If that cannot be made reliable, STOP.
- Stop conditions: a file outside the write set must change; a new dependency is needed; `aisandbox_session`, `CsrfGuard`, `SessionCookieGuard` or an internal route would have to change; the `enter` route cannot be reached because the controller's catch-all takes it; an existing preview spec must be weakened rather than adapted; any gate fails for a reason outside the write set.
- Lifecycle: 4-step. Step 1 registration (done), Step 2 this stage-start, Step 3 implementation after Keith approves the write set and mutexes, Step 4 consolidation and LOCK with a checkpoint. Evidence class stays LOCAL-TESTS; the control plane reads the diff and reruns the gates. The task locks as "not deployed"; the deploy task carries the live proof.

## 5. Acceptance criteria

1. With `PREVIEW_BASE_URL` set, no response from the platform host carries preview content: proxy requests there answer 302 to the preview host or are refused.
2. With `PREVIEW_BASE_URL` unset, every proxy response carries `Content-Security-Policy: sandbox` without `allow-same-origin`.
3. `enter` accepts only a valid, unexpired ticket for that session, only on the preview host, and sets an httpOnly, host-only, path-scoped preview cookie.
4. On the preview host, a proxy request is served only with a valid preview cookie for that session and a session still owned by that user; the session cookie alone is not accepted; all other routes are 404.
5. Tickets and preview cookies are signed, time-limited and bound to session and user; altered or expired ones are refused; no secret or ticket is logged.
6. The request to container-manager is unchanged: same path, same stripped headers, same internal key.
7. The iframe carries the agreed `sandbox` list without `allow-top-navigation`.
8. The picker toggle is hidden and no hardcoded text is added; the three message files are unchanged.
9. `/driver` neither reads nor writes the API key in browser storage and removes a previously stored one.
10. All gates in 4.4 pass; existing preview specs pass, adapted but not weakened.
11. The checkpoint carries the CHECKLIST line (EVERY, UI, BACKEND), the model used and the FOLLOWUPS line covering the table in section 3.

## 6. Open questions for Keith

1. **Approach.** Recommended: the separate preview host (d2), which needs one DNS record and a Caddy change on staging in a follow-up deploy task. Alternative: sandbox plus a token in the URL path, with no DNS or Caddy work, but generated apps lose `localStorage` and cookies, and the change spans three services.
2. **Host name.** Recommended: `preview.staging.ainow.biz` (a sibling name; you add the A record). Alternative: a different domain, which isolates more but needs URL tokens instead of a cookie; suggested later as PREVIEW-ORIGIN-02.
3. **basic_auth on the preview host.** Recommended: keep it, and accept one more prompt per browser session. Alternative: none on that host, with the ticket and preview cookie as the only gate.
4. **Picker.** Recommended: hide "Select Element" now and rebuild it in PREVIEW-PICKER-01. Alternative: rebuild it inside this slice (adds container-manager or gateway HTML injection, and time).
5. **/driver.** Recommended: key in memory only. Alternative: delete the page.

## 7. Checklist (Step 2)

CHECKLIST: EVERY 11/11 — 1 met (admitted on the board, Lane 1, write set this file); 2 met (4-step, Step 2); 3 met (Fable, named in the brief with the reason); 4 met (self-contained brief, boot sequence followed, no subagent started); 5 met (one file, no dependency); 6 n/a (a document, no behaviour change); 7 n/a (no code, no gates); 8 met (nothing started); 9 met (no build ran); 10 met (one commit on the lane branch only; no push, merge or branch change); 11 met (follow-ups listed in section 3 for the control plane to dispose).
