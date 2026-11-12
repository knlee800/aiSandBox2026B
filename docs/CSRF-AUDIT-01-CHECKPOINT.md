# CSRF-AUDIT-01 — Checkpoint

**Task:** CSRF-AUDIT-01 — Cookie-authenticated write routes without CsrfGuard
**Status:** COMPLETE AND LOCKED — 2026-11-12. Not deployed.
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PREVIEW-ORIGIN-01 LOCK. Keith started it ("Yes, start it") and approved the stage-start ("Yes, approve both").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | at the PREVIEW-ORIGIN-01 LOCK | 01587b7 |
| 2. Stage-start | Lane 1, no mutex. `docs/CSRF-AUDIT-01-STAGE-START.md`, an audit of every cookie-authenticated gateway write route, by a fable subagent (d6fb8c5, fast-forwarded). Admission 4266a58; record d356c1e | d6fb8c5 |
| 3. Implementation | Keith approved; GATEWAY acquired with 4 files (eafa029). The opus subagent stopped as required on a legitimate caller (the live e2e harness cleanup), so the control plane widened the write set by the harness and its spec (f55af8d). The worker resumed and finished as b4d1068, cherry-picked | c3625f5 |
| 4. Consolidation and LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md, canonical validator | this record |

## Audit result (Step 2)

`CsrfGuard` covered only `POST /api/auth/logout` and `PATCH /api/admin/users/:userId/entitlements`. That left 56 of 58 cookie-authenticated write routes unguarded:
- **High (5):** session exec, file write, import, AI execute (only while runs are on), collaboration runs.
- **Medium (10):** session create and stop, session messages, preview start and stop, admin credit grant, the IMAP and iCal connectors, knowledge documents, login CSRF.
- **Low (42).**

The gateway parses form bodies, so a page on any same-site host could trigger these routes with simple POSTs. The preview host is one such host. CORS allows only the `APP_BASE_URL` origin, so it stops everything except simple POSTs.

## Keith's decisions (2026-11-12)

1. One global same-origin write guard, instead of `CsrfGuard` on every route. The latter would have needed 38 frontend call sites changed.
2. A request that carries the session cookie but no `Origin` is refused.

## Change

**`services/api-gateway/src/guards/same-origin-write.guard.ts`** (new) defines `SameOriginWriteGuard`. It is registered in `app.module.ts` as a second `APP_GUARD`, after `InternalServiceAuthGuard`.

For HTTP only:
- GET, HEAD and OPTIONS pass.
- The exact path `/api/auth/apple/callback` passes.
- An `Origin` header must be the `APP_BASE_URL` origin, decided by the existing `resolveHttpCorsOrigin`. Anything else is 403 "Cross-origin request refused". That includes `null`, an empty or comma-joined value, and any `Origin` when `APP_BASE_URL` is unset.
- No `Origin` plus the `aisandbox_session` cookie, in either the parsed cookies or the raw header, is 403.
- No `Origin` and no session cookie passes. This covers the internal key, API keys, webhooks and curl.
- It never logs.

**`e2e/builder-golden-path/lib/live-adapters.ts`:** the live harness's session-stop cleanup now sends `Origin: new URL(baseURL).origin`, as a browser does. Its contract spec asserts the header is sent.

**Unchanged:** `CsrfGuard`, `SessionCookieGuard`, the cookies, `main.ts`, internal routes, the frontend, and the message files.

**Legitimate callers checked by the worker:**
- The Next confirm-build-apply route makes only GETs with the cookie, plus an internal POST that carries the key and no cookie.
- There are no server actions.
- All browser writes use relative `/api` URLs, so they carry the platform `Origin`.
- ai-service and container-manager use the internal key without a cookie.
- The canary scripts use bearer keys.
- `ops/` and `scripts/` never use the session cookie.
- The local Next rewrite keeps the browser's `Origin`, `http://localhost:3000`, which matches `APP_BASE_URL` in both `.env.example` files.

**Tests:** 41 new across two specs: unit tests and HTTP tests with the real `SessionCookieGuard`, showing the 403 comes before the session check and that form-encoded and text/plain foreign POSTs never reach the handler. One new harness contract test.

**Mutation checks by the worker:**
- Turning off the no-Origin rule makes 11 tests fail.
- Removing the harness header makes the contract test fail.

## Control-plane review

- I read the guard: 88 lines, and the rule matches Keith's decisions exactly. I also read the `app.module.ts` registration and the harness diff.
- CORS reuse: `resolveHttpCorsOrigin` is called unchanged.
- The Socket.IO handshake is outside Nest guards. That is noted as follow-up CSRF-AUDIT-02.
- The worker's attempt to delete the ignored Playwright folder `e2e/builder-golden-path/test-results` was refused. So the control plane kept the worktree `C:\Users\knlee\aisb-worktrees\CSRF-AUDIT-01` and its branch `lane/CSRF-AUDIT-01` (merged as c3625f5) in place for Keith to decide; they are listed in plan row 80b.

## Gates (control-plane rerun on the branch; main has the same tree for these files)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 4073 passed (4032 + 41), 7 skipped, plus the 14 known `smoke.integration` failures (they need a database), 243 suites passed |
| gateway `npm run build` | exit 0 |
| harness contract suite (worker) | 114 of 114 in 4 of 5 runs. One run under load had timing failures in AUTO-01H and AUTO-01J, which are unrelated to this change; registered as E2E-FLAKY-01 |
| line endings | the 6 files are LF |

## Records

**ARCHITECTURE.md:** the request-flow line (110), the auth section (after 363) and the session-auth line (683) now state the actual protection:
- the global same-origin write guard;
- `CsrfGuard` only on logout and the admin PATCH;
- the `APP_BASE_URL` local-development note.

## Limits

- **Not deployed.** The deploy is STAGING-DEPLOY-CSRF-01. Its curl checks from the host need no sign-in, followed by Keith's short browser pass.
- **Optional follow-ups:** CSRF-AUDIT-02 (WebSocket handshake and the Next route), CSRF-LAYER-02 (a second layer), APPLE-STATE-01 (Apple callback state) and E2E-FLAKY-01.
- **Still recommended before any other user:** COOKIE-PREFIX-01 and PREVIEW-PICKER-01.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: write set widened by the control plane for the test harness, recorded; 7: gates rerun by the control plane; 8: no runtime; 9: no tracked artifact changed, the ignored test-results folder kept; 10: worker committed only on its branch, cherry-picked by the control plane with autocrlf=false; 11: follow-ups disposed below), BACKEND 6/6 (1: the approved global guard added, existing guards unchanged; 2: internal routes keep InternalServiceAuthGuard, tested; 3: no template; 4: no frozen contract; 5: no schema change; 6: only the known smoke failures)
FOLLOWUPS: 5 registered (STAGING-DEPLOY-CSRF-01; CSRF-AUDIT-02; CSRF-LAYER-02; APPLE-STATE-01; E2E-FLAKY-01) / 2 superseded (the ARCHITECTURE.md CSRF wording and the local-dev APP_BASE_URL note, by this LOCK's ARCHITECTURE.md edit) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- not deployed.
