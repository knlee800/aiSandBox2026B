# AUTH-APP-02B Checkpoint — Add SessionCookieGuard to api-gateway PreviewController

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-02B |
| Title | Add SessionCookieGuard to api-gateway PreviewController |
| Family | AUTH |
| Parent | AUTH-APP-02 (ACTIVE) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND IMPLEMENTATION |
| Date | 2026-05-08 |
| Depends on | AUTH-APP-02A (COMPLETE and LOCKED) |
| Spec | `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` Section 9 |

---

## Objective

Add `SessionCookieGuard` at the `PreviewController` class level in api-gateway to block unauthenticated access to all `/api/preview/*` routes (start, stop, status, proxy). Smallest safe fix for the MEDIUM-risk preview proxy auth gap identified in AUTH-APP-02A. Closes threats T1 (unauthenticated content access) and T6 (unguarded start/stop resource abuse).

---

## Files Changed

| File | Change |
|---|---|
| `services/api-gateway/src/preview/preview.controller.ts` | `UseGuards` added to `@nestjs/common` import; `SessionCookieGuard` imported from `../auth/session-cookie.guard`; `@UseGuards(SessionCookieGuard)` applied at controller class level |
| `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts` | **Created** — 3 guard tests |
| `docs/AUTH-APP-02B-CHECKPOINT.md` | **Created** — this document |
| `TASKS.md` | Updated — AUTH-APP-02B COMPLETE and LOCKED; AUTH-APP-02 parent updated; current stage updated |
| `TASKS_BACKLOG_FULL.md` | Updated — AUTH-APP-02B acceptance checklist completed; status COMPLETE and LOCKED |

**`services/api-gateway/src/preview/preview.module.ts`** — Not changed. `AuthModule` import is not required; `SessionCookieGuard` resolves from the `AppModule`-level DI context (same pattern as `SessionModule`, `CheckpointsModule`, `WorkspacesModule`).

**Production source files changed: 1** (`preview.controller.ts`)  
**New test files created: 1** (`preview.controller.guard.spec.ts`)  
**Frontend files changed: None.**  
**Container-manager files changed: None.**

---

## Implementation Summary

### `preview.controller.ts` — diff summary

```diff
-import { All, Controller, Req, Res } from '@nestjs/common';
+import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
 import { Request, Response } from 'express';
 import axios from 'axios';
+import { SessionCookieGuard } from '../auth/session-cookie.guard';

+@UseGuards(SessionCookieGuard)
 @Controller('preview')
 export class PreviewController {
```

Everything else in the controller is preserved without change: `@All('*')` handler, axios proxy call, header forwarding, streaming response path (`response.data.pipe(res)`), error handler, and `responseType` logic.

### Guard resolution — why no `AuthModule` import in `PreviewModule`

`AppModule` imports `AuthModule`. `AuthModule` explicitly exports `SessionCookieGuard`. NestJS resolves the guard from the `AppModule`-level DI context for all child modules. Confirmed by the same pattern in `SessionModule`, `CheckpointsModule`, and `WorkspacesModule` — none import `AuthModule` locally, all use `SessionCookieGuard` successfully.

### Effect on request flow

| Condition | Behaviour before 02B | Behaviour after 02B |
|---|---|---|
| No `aisandbox_session` cookie | Request proxied to container-manager | `SessionCookieGuard` throws `UnauthorizedException` → HTTP 401 |
| Expired / invalid session token | Request proxied to container-manager | `SessionCookieGuard` throws `UnauthorizedException` → HTTP 401 |
| Valid session cookie | Request proxied to container-manager | Guard populates `req.user`; request proxied to container-manager (unchanged) |

`req.user` is populated after the guard passes but is not read by the proxy handler. Ownership enforcement is deferred to AUTH-APP-02C.

---

## Test Summary

**File:** `services/api-gateway/src/preview/__tests__/preview.controller.guard.spec.ts`

| # | Test | Method | Result |
|---|---|---|---|
| 1 | `applies SessionCookieGuard at controller level` | `Reflect.getMetadata('__guards__', PreviewController)` contains `SessionCookieGuard` | PASS |
| 2 | `compiles testing module when SessionCookieGuard is overridden to allow` | `Test.createTestingModule` + `overrideGuard` → `module.get(PreviewController)` defined | PASS |
| 3 | `blocks request when SessionCookieGuard is overridden to deny` | `createNestApplication` + `supertest GET /preview/test-session/status` with `canActivate: false` → HTTP 403 | PASS |

**Note on 401 vs 403:** `canActivate: () => false` causes NestJS to return HTTP 403. In production, `SessionCookieGuard` always throws `UnauthorizedException` (never returns `false`) so real unauthenticated requests receive HTTP 401. Both block access. Manual smoke verifies the real 401 path.

No DB, no Redis, no real `AuthService`, no axios network calls required.

---

## Validation Results

| Command | Working directory | Result |
|---|---|---|
| `npx tsc --noEmit` | `services/api-gateway` | **PASS** |
| `npx jest --testPathPatterns="preview.controller.guard" --runInBand` | `services/api-gateway` | **PASS — 1 suite, 3 tests, 0 failures** |

---

## Non-Goals Confirmed

- No session ownership check added (deferred to AUTH-APP-02C)
- No container-manager files changed
- No frontend files changed
- No activation of inactive `services/container-manager/src/previews/` module
- No signed preview URLs
- No public/share preview design
- No header sanitization (forwarded headers to container-manager unchanged)
- No new dependencies added

---

## Manual Smoke Checklist (deferred to live environment)

| # | Check | Status |
|---|---|---|
| 1 | Logged-in user loads workspace → preview iframe loads normally (HTTP 200) | NOT RUN — deferred |
| 2 | `curl http://localhost:4000/api/preview/any-session/status` (no cookie) → HTTP 401 | NOT RUN — deferred |
| 3 | `curl -X POST http://localhost:4000/api/preview/any-session/start` (no cookie) → HTTP 401 | NOT RUN — deferred |
| 4 | `curl http://localhost:4000/api/preview/any-session/proxy` (no cookie) → HTTP 401 | NOT RUN — deferred |

Manual smoke requires a live Docker/PostgreSQL/Redis/api-gateway/browser environment. Dev servers are user-controlled.

---

## Carry-Forwards

| Item | Risk | Detail | Next action |
|---|---|---|---|
| Cross-user session access (T2) | MEDIUM | Authenticated user can still access another user's preview by knowing their sessionId; no ownership check | AUTH-APP-02C — blocked on product decision (owner-only vs. shareable) |
| Header sanitization | LOW | `aisandbox_session`, `aisandbox_csrf`, and other cookies still forwarded to container-manager; container-manager ignores them | Future hardening slice |
| Container-manager direct access (T5) | MEDIUM | If port 4002 is externally reachable, api-gateway guard can be bypassed | Network isolation (infrastructure concern; not addressable in code) |
| Manual smoke — 4 items | — | Live environment required | User action |

---

## Reference

- `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` — governing spec (Section 9: AUTH-APP-02B scope)
- `docs/AUTH-APP-02A-CHECKPOINT.md` — investigation checkpoint; carry-forward source
- `docs/AUTH-APP-01H-CHECKPOINT.md` — original MEDIUM-risk carry-forward
- `TASKS.md` → AUTH-APP-02B
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-02B

---

## Next Recommended Task

**AUTH-APP-02C — Session Ownership Check / Product Decision**

STATUS: CONDITIONAL — blocked on explicit product decision.

Required before AUTH-APP-02C can be staged: decide whether previews should be owner-only, public/shareable, signed-link shareable, or a mixed model.

**Independent parallel path:** Run 4-item manual smoke checklist in live environment to confirm guard behavior in production.
