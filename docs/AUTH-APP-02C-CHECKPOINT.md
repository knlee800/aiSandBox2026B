# AUTH-APP-02C Checkpoint — Session Ownership Check / Owner-only Preview Authorization

## Task Metadata

| Field | Value |
|---|---|
| Task ID | AUTH-APP-02C |
| Title | Session Ownership Check / Owner-only Preview Authorization |
| Family | AUTH |
| Parent | AUTH-APP-02 (VALIDATION COMPLETE — manual smoke deferred) |
| Status | COMPLETE and LOCKED |
| Nature | BACKEND IMPLEMENTATION |
| Date | 2026-05-10 |
| Depends on | AUTH-APP-02B (COMPLETE and LOCKED) + owner-only product decision |
| Spec | `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` Section 10 |

---

## Objective

Add `PreviewOwnershipGuard` at the `PreviewController` class level in api-gateway to block cross-user preview access. After `SessionCookieGuard` (AUTH-APP-02B) verifies the requesting user is authenticated, `PreviewOwnershipGuard` verifies the authenticated user owns the session being previewed. Closes threat T2 (cross-user session preview access) identified in AUTH-APP-02A.

---

## Owner-only Product Decision

**Decision: Owner-only previews.**

- Only the session owner may access `/api/preview/:sessionId/*`.
- No public/shareable preview links.
- No signed preview URLs.
- Public/shareable preview remains a deferred product feature.

**ID namespace confirmation (required before implementation):**

The `sessionId` in `/api/preview/:sessionId/*` is the api-gateway PostgreSQL `sessions.id` UUID. api-gateway generates this UUID via `@PrimaryGeneratedColumn('uuid')`, stores it, and passes the same UUID to container-manager via `POST /api/sessions/:id/start`. Container-manager stores the same UUID as its own session primary key (not a separately generated ID). Therefore api-gateway can safely enforce ownership by calling `SessionService.getSessionById(sessionId)` without any cross-service call.

---

## Files Changed

| File | Change |
|---|---|
| `services/api-gateway/src/preview/preview-ownership.guard.ts` | **Created** — `PreviewOwnershipGuard` |
| `services/api-gateway/src/preview/preview.controller.ts` | `PreviewOwnershipGuard` added to guard chain: `@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)` |
| `services/api-gateway/src/preview/preview.module.ts` | `SessionModule` added to imports; `PreviewOwnershipGuard` added to providers |
| `services/api-gateway/src/preview/__tests__/preview.ownership.guard.spec.ts` | **Created** — 9 ownership guard tests |

**Frontend files changed: None.**
**Container-manager files changed: None.**
**Governance/checkpoint files changed: None (consolidation step separate).**

---

## PreviewOwnershipGuard Summary

**File:** `services/api-gateway/src/preview/preview-ownership.guard.ts`

- `@Injectable()`, implements `CanActivate`
- Injects `SessionService` via `@Optional()` (allows test modules to compile without the full DI tree; fails closed when `SessionService` is absent)
- Reads `req.user?.userId` from `ExecutionContext` — populated by `SessionCookieGuard` earlier in the chain
- Extracts `sessionId` from `req.path.split('/')` at index 3 (path format: `['', 'api', 'preview', ':sessionId', ...]`)
- Returns **HTTP 403** for all failure conditions to prevent session ID enumeration:
  - Missing or empty `req.user.userId`
  - Missing or empty `sessionId` segment
  - `SessionService` not available
  - `SessionService.getSessionById()` throws (session not found or DB error)
  - `session.userId !== req.user.userId` (ownership mismatch)
- Returns `true` when `session.userId === req.user.userId`
- No session ID or user ID logged by the guard
- No call to container-manager

---

## PreviewController Guard-Chain Summary

**File:** `services/api-gateway/src/preview/preview.controller.ts`

Guard chain updated from AUTH-APP-02B state:

```diff
-@UseGuards(SessionCookieGuard)
+@UseGuards(SessionCookieGuard, PreviewOwnershipGuard)
```

Guard execution order:
1. `SessionCookieGuard` — validates `aisandbox_session` cookie, populates `req.user`
2. `PreviewOwnershipGuard` — validates `req.user.userId` owns the session in the path

All existing proxy behavior preserved unchanged: `@Controller('preview')`, `@All('*')`, axios proxy forwarding, streaming response for `/proxy` paths, header forwarding, error handler.

---

## PreviewModule Wiring Summary

**File:** `services/api-gateway/src/preview/preview.module.ts`

```diff
+import { SessionModule } from '../sessions/session.module';
+import { PreviewOwnershipGuard } from './preview-ownership.guard';

 @Module({
+  imports: [SessionModule],
   controllers: [PreviewController],
+  providers: [PreviewOwnershipGuard],
 })
```

`SessionModule` is imported to provide `SessionService` for `PreviewOwnershipGuard` DI. `SessionModule` exports `SessionService` and is already used by other modules in the same pattern.

Note: AUTH-APP-02B confirmed `AuthModule` was not needed in `PreviewModule` because `SessionCookieGuard` resolves from the `AppModule`-level DI context. AUTH-APP-02C requires `SessionModule` in `PreviewModule` imports because `PreviewOwnershipGuard` needs `SessionService` which is scoped to `SessionModule`.

---

## Tests Added

**File:** `services/api-gateway/src/preview/__tests__/preview.ownership.guard.spec.ts`

No DB, no Redis, no axios, no live container-manager. `SessionService` fully mocked.

| # | Test | Assertion |
|---|---|---|
| 1 | Guard metadata — both guards present | `Reflect.getMetadata('__guards__', PreviewController)` contains both `SessionCookieGuard` and `PreviewOwnershipGuard` |
| 2 | Guard order — `SessionCookieGuard` before `PreviewOwnershipGuard` | Index of `SessionCookieGuard` < index of `PreviewOwnershipGuard` in metadata array |
| 3 | Owner match | `session.userId === req.user.userId` → resolves `true` |
| 4 | Owner mismatch | `session.userId !== req.user.userId` → throws `ForbiddenException` |
| 5 | Session lookup failure | `getSessionById` rejects → throws `ForbiddenException` |
| 6 | Missing `req.user` | No user on request → throws `ForbiddenException`; `getSessionById` not called |
| 7 | Malformed path `/api/preview` | No sessionId segment → throws `ForbiddenException`; `getSessionById` not called |
| 8 | Malformed path `/api/preview/` | Empty sessionId segment → throws `ForbiddenException`; `getSessionById` not called |
| 9 | sessionId extraction from proxy path | `/api/preview/session-123/proxy/assets/main.js` → calls `getSessionById('session-123')` |

---

## Validation Commands and Results

All commands run from `services/api-gateway`.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** |
| `npx jest --testPathPatterns="preview.ownership" --runInBand` | **PASS — 1 suite, 9 tests** |
| `npx jest --testPathPatterns="preview.controller.guard\|preview.ownership" --runInBand` | **PASS — 2 suites, 12 tests** |
| Lint on all 4 touched files | **PASS — no lint errors** |

---

## Non-Goals Confirmed

- No session ownership check in container-manager
- No container-manager files changed
- No frontend files changed
- No activation of inactive `services/container-manager/src/previews/` module
- No signed preview URLs
- No public/share preview design or behavior
- No header sanitization (forwarded headers to container-manager unchanged)
- No new external dependencies
- No DB migration

---

## Manual Smoke Checklist (deferred to live environment)

| # | Check | Status |
|---|---|---|
| 1 | Unauthenticated request to `/api/preview/any-session/status` → HTTP 401 | NOT RUN — deferred |
| 2 | Authenticated owner requests own preview → HTTP 200, proxy proceeds normally | NOT RUN — deferred |
| 3 | Authenticated non-owner substitutes foreign sessionId → HTTP 403 | NOT RUN — deferred |
| 4 | Authenticated owner preview start/status/proxy all work normally | NOT RUN — deferred |

Manual smoke requires a live Docker/PostgreSQL/Redis/api-gateway/browser environment. Dev servers are user-controlled.

---

## Carry-Forwards

| Item | Risk | Detail | Next action |
|---|---|---|---|
| Header sanitization | LOW | `aisandbox_session`, `aisandbox_csrf`, and other cookies still forwarded to container-manager; container-manager ignores them | Future hardening slice |
| Container-manager direct access (T5) | MEDIUM | If port 4002 is externally reachable, api-gateway guards can be bypassed | Network isolation (infrastructure concern; not addressable in code) |
| Public/share/signed preview | N/A (product) | No public preview exists; if added, AUTH-APP-02B+02C guards would block external access | Requires explicit product design and separate feature task |
| Manual smoke — 4 items | — | Live environment required | User action |

---

## Threat Closure Summary

| ID | Threat | Severity | Status after AUTH-APP-02C |
|---|---|---|---|
| T1 | Unauthenticated preview content access | MEDIUM | **CLOSED** — `SessionCookieGuard` (AUTH-APP-02B) |
| T2 | Cross-user session preview access | MEDIUM | **CLOSED** — `PreviewOwnershipGuard` (AUTH-APP-02C) |
| T3 | sessionId exposure in URLs/logs | LOW | Accepted — UUID entropy, no change |
| T4 | Forwarded sensitive headers | LOW | Deferred — future hardening slice |
| T5 | Container-manager direct access bypass | MEDIUM | Infrastructure concern — network isolation required |
| T6 | Unguarded start/stop resource abuse | LOW–MEDIUM | **CLOSED** — `SessionCookieGuard` + `PreviewOwnershipGuard` (both guards apply to all routes) |

---

## Next Recommended Work

1. Run 4-item manual smoke checklist in live environment
2. Header sanitization hardening (strip sensitive forwarded headers to container-manager) — future slice
3. Network isolation confirmation for container-manager port 4002 — infrastructure action
4. Public/share preview — requires explicit product decision and separate feature design

---

## Reference

- `docs/AUTH-APP-02A-PREVIEW-PROXY-AUTH-SPEC.md` — governing spec (Section 10: AUTH-APP-02C scope)
- `docs/AUTH-APP-02A-CHECKPOINT.md` — investigation checkpoint
- `docs/AUTH-APP-02B-CHECKPOINT.md` — SessionCookieGuard checkpoint
- `docs/AUTH-APP-02-CHECKPOINT.md` — family checkpoint
- `TASKS.md` → AUTH-APP-02C
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-02C
