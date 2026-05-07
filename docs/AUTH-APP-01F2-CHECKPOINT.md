# AUTH-APP-01F2 Checkpoint — Backend API Protection Gaps

**Task ID:** AUTH-APP-01F2
**Date:** 2026-05-07
**Status:** COMPLETE and LOCKED
**Nature:** BACKEND IMPLEMENTATION — no frontend files changed, no new dependencies
**Parent:** AUTH-APP-01F (ACTIVE)
**Depends on:** AUTH-APP-01F1 (COMPLETE and LOCKED)
**Spec:** `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` (Sections 4.5, 6, 10)

---

## Objective

Implement the backend API protection gaps identified in AUTH-APP-01F1. Resolve the five confirmed dispositions from spec Section 6: AI execution cancel/get/stream guard, service-to-service write endpoints guard, runtime metrics guard, dead stale file cleanup, and recording of accepted exceptions for events endpoints and preview proxy.

No frontend files changed. No OAuth or email/password changes. No route path migrations. No new npm dependencies.

---

## Files Changed

### Modified

| File | Change |
|---|---|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Added method-level `@UseGuards(ApiKeyAuthGuard)` to `cancelExecution`, `getExecution`, and `streamExecution` handlers |
| `services/api-gateway/src/chat-messages/chat-message.controller.ts` | Added class-level `@UseGuards(InternalServiceAuthGuard)` and required `UseGuards` / `InternalServiceAuthGuard` imports |
| `services/api-gateway/src/token-usage/token-usage.controller.ts` | Added class-level `@UseGuards(InternalServiceAuthGuard)` and required `UseGuards` / `InternalServiceAuthGuard` imports |
| `services/api-gateway/src/runtime/runtime.controller.ts` | Added class-level `@UseGuards(InternalServiceAuthGuard)` and required `UseGuards` / `InternalServiceAuthGuard` imports |
| `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` | Added isolated top-level `describe('AIExecutionController guard metadata')` block with three new metadata tests for cancel/get/stream; no existing test structure was altered |

### Added

| File | Purpose |
|---|---|
| `services/api-gateway/src/chat-messages/chat-message.controller.spec.ts` | Guard metadata test — confirms `InternalServiceAuthGuard` is applied at class level |
| `services/api-gateway/src/token-usage/token-usage.controller.spec.ts` | Guard metadata test — confirms `InternalServiceAuthGuard` is applied at class level |
| `services/api-gateway/src/runtime/runtime.controller.spec.ts` | Guard metadata test — confirms `InternalServiceAuthGuard` is applied at class level |

### Deleted

| File | Reason |
|---|---|
| `services/api-gateway/src/auth/api-key.controllerXXXXX.ts` | Stale dead file — contained `@Controller('keys')` with `@UseGuards(JwtAuthGuard)` (old pre-migration pattern); never imported in `auth.module.ts`; not loaded at runtime; contained stale debug `console.log` statements |
| `services/api-gateway/src/auth/jwt-auth.guard.ts` | Stale dead file — only reference was an import in the dead controller above; `session-quota.guard.ts` referenced it in a comment only; safe to delete once dead controller was removed |

**Pre-deletion import scan confirmed:** `JwtAuthGuard` had zero active runtime imports outside `api-key.controllerXXXXX.ts`. Remaining reference in `session-quota.guard.ts` was comment-only.

---

## Guard Additions by Endpoint

### AI Execution Controller (`services/api-gateway/src/ai/ai-execution.controller.ts`)

| Endpoint | Guard added | Method |
|---|---|---|
| `POST /api/ai/executions/:executionId/cancel` | `@UseGuards(ApiKeyAuthGuard)` | method-level |
| `GET /api/ai/executions/:executionId` | `@UseGuards(ApiKeyAuthGuard)` | method-level |
| `GET /api/ai/executions/:executionId/stream` | `@UseGuards(ApiKeyAuthGuard)` | method-level |

`POST /api/ai/execute` guard stack was **not changed** — it retains the existing `@UseGuards(ApiKeyAuthGuard, AuthorizationGuard, ExecutionSafetyGuard, LaunchGuard, AbortGuard, IdempotencyGuard, QuotaGuard, TokenQuotaGuard, RateLimitGuard)` at method level.

Rationale: The cancel/get/stream endpoints share the same caller pattern as `execute` (DRIVER_API_KEY clients). `ApiKeyAuthGuard` is consistent with the execute endpoint and with spec Section 6.1.

### ChatMessageController (`services/api-gateway/src/chat-messages/chat-message.controller.ts`)

| Endpoint | Guard added | Level |
|---|---|---|
| `POST /api/chat-messages/add-by-session` | `@UseGuards(InternalServiceAuthGuard)` | class-level |

Rationale: Option B (spec Section 6.2). The `ai-service` caller (`ApiGatewayHttpClient.addChatMessage`) already sends `X-Internal-Service-Key` on every call. Guard enforcement is additive; no ai-service change required.

### TokenUsageController (`services/api-gateway/src/token-usage/token-usage.controller.ts`)

| Endpoint | Guard added | Level |
|---|---|---|
| `POST /api/token-usage/record` | `@UseGuards(InternalServiceAuthGuard)` | class-level |

Rationale: Option B (spec Section 6.2). The `ai-service` caller (`ApiGatewayHttpClient.recordTokenUsage`) already sends `X-Internal-Service-Key` on every call.

### RuntimeController (`services/api-gateway/src/runtime/runtime.controller.ts`)

| Endpoint | Guard added | Level |
|---|---|---|
| `GET /api/runtime/metrics` | `@UseGuards(InternalServiceAuthGuard)` | class-level |

Rationale: Diagnostic endpoint with no external callers. `InternalServiceAuthGuard` restricts it to `X-Internal-Service-Key` callers only (spec Section 6.3).

---

## Accepted Exceptions and Carry-Forward Items

### Events endpoints — Option C accepted, carry-forward

**Endpoints:** `POST /api/events/file-changed`, `POST /api/events/checkpoint-created`, `POST /api/events/token-updated` (`services/api-gateway/src/websocket/events.controller.ts`)

**Status:** Intentionally not changed in F2.

**Reason:** The current callers in `container-manager` (`files.service.ts` and `git.service.ts`) call these endpoints via raw `httpService.post()` without the `X-Internal-Service-Key` header. Adding `InternalServiceAuthGuard` immediately would break both callers. The correct fix requires updating those two container-manager files to use the authenticated `ApiGatewayHttpClient` pattern. That is a container-manager change, which is outside F2's scope.

**Carry-forward:** Requires a separate child slice (AUTH-APP-01F2a) or can be absorbed into AUTH-APP-01H (Security Hardening). The fix involves:
1. Updating `container-manager/src/files/files.service.ts` to route the `file-changed` call through `ApiGatewayHttpClient` with `X-Internal-Service-Key`
2. Updating `container-manager/src/git/git.service.ts` to do the same for `checkpoint-created`
3. Adding `@UseGuards(InternalServiceAuthGuard)` at class level to `EventsController`

### Preview proxy — deferred child slice

**Endpoint:** `@All /api/preview/*` (`services/api-gateway/src/preview/preview.controller.ts`)

**Status:** Intentionally not changed in F2.

**Reason:** The api-gateway `PreviewController` blindly proxies requests to container-manager without forwarding any user identity or auth context. The container-manager has an optional JWT-based access control mechanism (`ENABLE_PREVIEW_ACCESS_CONTROL` flag, default off), but it uses the old JWT Bearer pattern — not `SessionCookieGuard`. Adding `SessionCookieGuard` at the api-gateway proxy level would not provide effective ownership validation unless container-manager also receives and validates user identity. This requires coordinated changes across both services and likely a new auth-forwarding mechanism.

**Carry-forward:** Requires a dedicated investigation slice before implementation. Must determine: (a) the deployment network topology and whether the preview proxy is reachable externally; (b) the correct auth-forwarding mechanism (e.g. forwarding session user ID as a trusted header from api-gateway to container-manager after validating the session cookie at api-gateway); (c) whether to enable container-manager's existing access control flag or replace it with a new pattern.

---

## Validation

### TypeScript typecheck

```
cd services/api-gateway && npx tsc --noEmit
Result: PASS
```

### Targeted Jest tests (guard metadata)

```
npx jest --testPathPatterns="chat-message.controller" --runInBand
Result: PASS — 1 test passed

npx jest --testPathPatterns="token-usage.controller" --runInBand
Result: PASS — 1 test passed

npx jest --testPathPatterns="runtime.controller" --runInBand
Result: PASS — 1 test passed

npx jest --testPathPatterns="ai-execution-guards" --testNamePattern="AIExecutionController guard metadata" --runInBand
Result: PASS — 3 tests passed (protects cancelExecution, getExecution, streamExecution)
```

Note: The requested validation commands used `--testPathPattern` (singular); the current Jest version in this repository requires `--testPathPatterns` (plural). The equivalent commands with the correct flag were used.

### Pre-existing failures (not introduced by F2)

The full `ai-execution-guards.integration.spec.ts` suite still fails due to a pre-existing Nest test-module setup problem: `QuotaService` has unresolved dependencies (`SessionRepository` / `UsageRecordRepository` missing from the test module). This failure was already present before F2 and cascades into `afterEach` → `TypeError: Cannot read properties of undefined (reading 'clearAll')`. The new guard metadata tests were added as an isolated top-level `describe` block that does not depend on the Nest test module — they pass independently.

---

## Carry-Forward Blockers

All blockers below are pre-existing and were not introduced by F2.

| Blocker | Source | Status |
|---|---|---|
| `npm test` backend full suite fails — `REDIS_URL` not set in test bootstrap environment | Pre-existing since AUTH-APP-01B | Carry-forward |
| `ai-execution.controller.spec.ts` pre-existing test failures | Pre-existing before AUTH-APP-01F1 | Carry-forward |
| `ai-execution-guards.integration.spec.ts` full suite — `QuotaService` unresolved dependencies | Pre-existing before AUTH-APP-01F1 | Carry-forward |
| `npm run lint` in `services/api-gateway` — ESLint config not discoverable by package lint script | Pre-existing since AUTH-APP-01B | Carry-forward |
| Events endpoints (`file-changed`, `checkpoint-created`, `token-updated`) still unguarded | Container-manager callers don't send key yet | AUTH-APP-01F2a or AUTH-APP-01H |
| Preview proxy (`@All /api/preview/*`) unguarded | Cross-service coordination needed | Dedicated investigation slice |

---

## Non-Goals Confirmed

- No frontend files changed
- No OAuth or email/password changes
- No workspace UX changes
- No preview proxy fix in this slice
- No events endpoint fix in this slice
- No container-manager changes
- No ai-service changes
- No route path migrations
- No new npm dependencies
- No broad refactor

---

## Governing Invariants Preserved

All invariants from AUTH-APP-01A and AUTH-APP-01C1A remain intact:

1. `SessionCookieGuard` is the browser auth path — not altered
2. `ApiKeyAuthGuard` / `DRIVER_API_KEY` Bearer flows — `POST /api/ai/execute` guard stack unchanged
3. `InternalServiceAuthGuard` on `/api/internal/*` — global `APP_GUARD` registration unchanged
4. No `Authorization: Bearer` session-token restoration — not introduced
5. No `localStorage` `access_token` restoration — not introduced
6. OAuth entry/callback routes remain public — not altered

---

## Acceptance Gate (spec Section 6.6)

- [x] `POST /api/ai/executions/:executionId/cancel` — `ApiKeyAuthGuard` added
- [x] `GET /api/ai/executions/:executionId` — `ApiKeyAuthGuard` added
- [x] `GET /api/ai/executions/:executionId/stream` — `ApiKeyAuthGuard` added
- [x] `POST /api/chat-messages/add-by-session` — `InternalServiceAuthGuard` added (Option B)
- [x] `POST /api/token-usage/record` — `InternalServiceAuthGuard` added (Option B)
- [x] `GET /api/runtime/metrics` — `InternalServiceAuthGuard` added
- [x] Events endpoints — disposition recorded (Option C: accepted carry-forward)
- [x] Preview proxy — disposition recorded (deferred child slice)
- [x] `api-key.controllerXXXXX.ts` — deleted; import scan confirmed safe
- [x] `jwt-auth.guard.ts` — deleted; import scan confirmed safe
- [x] `npx tsc --noEmit` passes in `services/api-gateway`
- [x] Targeted guard metadata tests pass for all newly guarded endpoints
- [x] No frontend files changed

---

## Reference

- `docs/AUTH-APP-01F-ROUTE-API-PROTECTION-SPEC.md` — sections 4.5, 6, 10 (the governing spec for this task)
- `docs/AUTH-APP-01F1-CHECKPOINT.md` — prior inventory/spec checkpoint
- `docs/AUTH-APP-01C1A-CHECKPOINT.md` — `SessionCookieGuard` implementation
- `TASKS.md` → AUTH-APP-01F2
- `TASKS_BACKLOG_FULL.md` → AUTH-APP-01F2
