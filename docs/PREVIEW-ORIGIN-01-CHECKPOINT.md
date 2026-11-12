# PREVIEW-ORIGIN-01 — Checkpoint

**Task:** PREVIEW-ORIGIN-01 — Generated-app previews run on the platform origin: isolate them
**Status:** COMPLETE AND LOCKED — 2026-11-12. Not deployed.
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PRIVACY-INVENTORY-01 LOCK. Keith started it ("Yes, start it") and approved the stage-start with all five recommendations ("Yes, all five").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | at the PRIVACY-INVENTORY-01 LOCK | c233c5d |
| 2. Stage-start | Lane 1, no mutex. docs/PREVIEW-ORIGIN-01-STAGE-START.md, drafted by a fable subagent as ab078f5, fast-forwarded. The control plane checked its cookie, CSRF, picker and header claims against the code. Admission 0c71494; record 72f0971 | ab078f5 |
| 3. Implementation | Keith approved the stage-start. FRONTEND and GATEWAY acquired, with a write set of 21 files (27b0239). An opus subagent (Opus 5.5: guards, cookies and auth) worked in worktree lane/PREVIEW-ORIGIN-01 and changed 17 of the 21 files; the work was fast-forwarded | d0738ee |
| 4. Consolidation and LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Risk closed (from the stage-start)

The preview iframe loaded `/api/preview/<session>/proxy` from the platform's own origin, with no sandbox and no CSP. A generated app's script could therefore:
- call any platform API with the user's session cookie, admin routes included for Keith;
- pass CSRF, because `aisandbox_csrf` is readable by page scripts and the check is double-submit;
- read localStorage, which held the `/driver` API key and saved chat threads;
- read `parent.document` and navigate the top window.

## Change

**Host detection** (`preview-host.ts`) is fail-closed:
- A request counts as on the preview host only when the Host header and every X-Forwarded-Host value equal the `PREVIEW_BASE_URL` host.
- Caddy passes Host through. The local Next rewrite counts as the platform host.
- `PREVIEW_BASE_URL` that is unset, not http(s), carries credentials, or equals `APP_BASE_URL` is treated as unset.

**Platform host:**
- `PreviewController` keeps `SessionCookieGuard` and `PreviewOwnershipGuard`.
- A proxy GET or HEAD answers 302 with a ticket to `<preview host>/api/preview/<sid>/enter`, with no-store and no-referrer. Container-manager is not called.
- start, stop and status are unchanged.

**Ticket** (`preview-ticket.ts`):
- An HMAC-SHA256 over the session, user, expiry, nonce and target.
- It lives 60 s and is single use.
- The key is 32 random bytes made at gateway start, so no new secret.
- Verification uses a constant-time compare.
- It is never logged; a test checks this.

**Preview host** (`preview-entry.controller.ts`, `preview-access.guard.ts`):
- `enter` checks the ticket and ownership, then sets `aisandbox_preview`: HttpOnly, SameSite=Lax, `Path=/api/preview/<sid>/`, no Domain, 12 h, and Secure on https or in production. It then redirects to the same-host proxy path.
- Proxy GET and HEAD need a valid preview cookie for that session, and the user must still own it.
- The session cookie is never read there.
- A route filter in `PreviewModule` answers 404 on the preview host for every other route. It does nothing off the preview host.

**Fail-safe:**
- Every proxy response off the preview host carries `Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals allow-popups`, with no `allow-same-origin`.
- This includes the 302, the guard errors and when `PREVIEW_BASE_URL` is unset.
- An upstream CSP is kept beside it.

**Frontend:**
- The iframe has `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"`, with no `allow-top-navigation`. The preview's origin is now the preview host, not the platform.
- The Select Element toggle is hidden; the picker code and its keys stay.
- `/driver` keeps its API key in memory only, and removes the stored `driver_api_key`.

**Unchanged:**
- `aisandbox_session`, `aisandbox_csrf`, `SessionCookieGuard` and `CsrfGuard`;
- internal routes and the internal key, including the container-manager request (same path, stripped cookie and authorization, the internal key);
- container-manager, the message files, env files, Caddy and `main.ts`.

**Tests:** 162 new gateway preview tests (the preview specs went from 160 to 322), including 17 host-detection cases, and 10 new frontend tests.

## Control-plane review

- **The diff:** I read host detection, the module, the access guard and the entry controller. Off the preview host, the entry controller calls `next()`, so the unchanged `PreviewController` and its guards handle the request.
- **The redirect target** comes from the signed ticket and is checked again with `resolvePreviewForward`.
- **The global guard:** the only `APP_GUARD` is `InternalServiceAuthGuard`, on `/api/internal/*`.
- **The route filter** is a design addition beyond the stage-start's wording. It enforces Keith's decision 1 in the gateway as well. It was reviewed and accepted.
- **Write set:** 17 of the 21 files changed; four specs passed unchanged. `preview.ownership.guard.spec.ts`, which is outside the write set, still passes.

## Gates (control-plane rerun on the branch; main fast-forwarded to the same commit)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 4032 passed (3870 + 162), 7 skipped, plus the 14 known `smoke.integration` failures (they need a database), 241 suites passed |
| gateway `npm run build` | exit 0 |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1822 of 1822 passed (1812 + 10) |
| frontend `npm run build` | exit 0; `tsconfig.tsbuildinfo` restored |
| line endings | all 17 files are LF |

## Limits

- **Not deployed.** It must not be deployed before the preview host exists: without `PREVIEW_BASE_URL`, multi-file previews degrade to the fail-safe mode by design.
- **The deploy is PREVIEW-ORIGIN-DEPLOY-01.** It needs:
  - Keith's DNS A record for `preview.staging.ainow.biz`;
  - a Caddy site with basic_auth that passes Host through;
  - `PREVIEW_BASE_URL` in the gateway env;
  - host checks with curl;
  - Keith's browser check.
- **Recommended before any user other than Keith:** CSRF-AUDIT-01, COOKIE-PREFIX-01 and PREVIEW-PICKER-01.

CHECKLIST: EVERY 11/11 (3: opus named with the reason; 4: self-contained brief, no further subagents; 5: 17 files of the 21-file write set, no new dependency; 7: gates rerun by the control plane; 8: no runtime; 9: tsbuildinfo restored; 10: worker committed only on its branch, fast-forwarded by the control plane with autocrlf=false), UI 8/9 (2: n/a, no message file edited; 1: no visible text changed, picker keys kept; 4: both skills read, applied as restraint; 8: workspace-preview-picker-toggle not rendered while hidden; 9: live check in PREVIEW-ORIGIN-DEPLOY-01), BACKEND 6/6 (1: only the approved preview cookie and guard added, platform auth unchanged; 2: internal routes unchanged; 3: no template; 4: no frozen contract; 5: no schema change; 6: only the known smoke failures)
FOLLOWUPS: 6 registered (PREVIEW-ORIGIN-DEPLOY-01; PREVIEW-PICKER-01; CSRF-AUDIT-01; COOKIE-PREFIX-01; PREVIEW-ORIGIN-02; DRIVER-PAGE-01) / 1 superseded (the ARCHITECTURE.md preview-path update, by PREVIEW-ORIGIN-DEPLOY-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- FRONTEND and GATEWAY released UNOWNED;
- not deployed.
