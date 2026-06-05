# AI-CONTEXT-01E CHECKPOINT — Align Browser AI Execution with Session User

**Status:** COMPLETE and LOCKED
**Task ID:** AI-CONTEXT-01E
**Family:** AI-CONTEXT (Global AI Instructions)
**Priority:** High
**Nature:** AUTH / AI EXECUTION / BROWSER IDENTITY ALIGNMENT
**Risk:** Medium-High
**Depends on:** AI-CONTEXT-01D (COMPLETE and LOCKED)
**Date:** 2026-06-05

---

## Problem

Global AI Instructions passed AI-CONTEXT-01D's system-message delivery test in unit tests, but
failed in live smoke because browser workspace AI execution authenticated with an API key from
localStorage (`driver_api_key`) belonging to `demo@aisandbox.com`, while Global Instructions
were saved under the logged-in session user `knlee802@gmail.com`.

Root cause chain:
- `GET /api/user/ai-instructions` and `PUT /api/user/ai-instructions` use `SessionCookieGuard`
  → `req.user.userId` = session user
- `POST /api/ai/execute` used `ApiKeyAuthGuard` → `identity.userId` = API key owner
- When the localStorage key belongs to a different user, `getByUserId(identity.userId)` returns
  null → `globalInstructions` absent in queue payload → system message omits the instruction

Confirmed evidence:
- `user_ai_instructions` row: `user_id` `4329e051-ce13-46b5-83ef-357faf749d90` / `knlee802@gmail.com`
- api-gateway log: `Global AI instructions absent for user 1f73d5b6-a2c9-4290-9f24-268db253abe7`
- `api_keys` row: `user_id` `1f73d5b6-a2c9-4290-9f24-268db253abe7` belongs to `demo@aisandbox.com`
- Frontend workspace page read API key from `localStorage` key `driver_api_key`

---

## Objective

Make browser AI execution authenticate as the logged-in session user, while preserving external
API-key client behavior.

---

## Files Changed

- `services/api-gateway/src/auth/session-or-api-key.guard.ts` (NEW)
- `services/api-gateway/src/auth/__tests__/session-or-api-key.guard.spec.ts` (NEW)
- `services/api-gateway/src/auth/auth.module.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `frontend/app/[locale]/app/page.tsx`
- `services/api-gateway/src/ai/__tests__/ai-execution.workspace-context.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts`
- `services/api-gateway/src/ai/ai-execution.controller.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-idempotency.integration.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts`
- `services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts`
- `services/api-gateway/src/safety/execution-safety.integration.spec.ts`

No ai-service, database migration, or unrelated governance docs were changed during implementation.

---

## Implementation Details

### SessionOrApiKeyAuthGuard (new)

Composite NestJS guard at `services/api-gateway/src/auth/session-or-api-key.guard.ts`:

1. If `Authorization: Bearer ...` header present → validate API key via existing `ApiKeyAuthGuard`
   logic (external client behavior fully preserved)
2. If no Authorization header present → validate session cookie via existing `SessionCookieGuard`
   logic → synthesize `req.apiKeyIdentity`:
   ```typescript
   req.apiKeyIdentity = {
     userId: session.user.id,
     apiKeyId: 'browser-session',
     scopes: ['ai:execute'],
     isInternal: true,
   }
   ```
3. If neither → throw `UnauthorizedException` (401)

All downstream guards (`AuthorizationGuard`, `QuotaGuard`, `TokenQuotaGuard`, `LaunchGuard`)
continue to read `req.apiKeyIdentity` unchanged — no downstream changes required.

### auth.module.ts

`SessionOrApiKeyAuthGuard` registered in providers and exports alongside existing guards.

### ai-execution.controller.ts

`@UseGuards(ApiKeyAuthGuard)` replaced with `@UseGuards(SessionOrApiKeyAuthGuard)` on all four
AI execution endpoints: `execute`, `cancelExecution`, `getExecution`, `streamExecution`.

### frontend/app/[locale]/app/page.tsx

Removed all `localStorage.getItem('driver_api_key')` reads and `Authorization: Bearer ${apiKey}`
header additions from browser workspace AI execution call sites:
- `handleSubmitChatPrompt`
- `refreshChatExecutionStatus`
- `submitOrchestratedChatPrompt`
- SSE stream creation

`DRIVER_API_KEY_STORAGE_KEY` constant preserved in the file. Driver page is separate and
unchanged — its API-key localStorage usage is unaffected.

---

## Acceptance Criteria

- [x] Browser workspace AI execution uses logged-in session user ID
- [x] Global Instructions are fetched for the logged-in user
- [x] External API-key clients still work (Authorization header path unaffected)
- [x] No-Authorization browser path uses session-cookie identity
- [x] SSE stream endpoint works via session cookie (no custom header required)
- [x] `driver_api_key` localStorage not used by normal workspace execution path
- [x] `SessionOrApiKeyAuthGuard` has unit tests covering both auth paths and missing-both failure
- [x] Existing AI execution controller tests pass
- [x] api-gateway build passes
- [x] Frontend `npx tsc --noEmit` passes if `page.tsx` changed
- [x] ReadLints on touched files
- [x] Live smoke test passes

---

## Validation Results

| Check | Result |
|---|---|
| api-gateway typecheck (`npx tsc --noEmit`) | PASS |
| frontend typecheck (`npx tsc --noEmit`) | PASS |
| Focused tests (5 suites) | PASS — 5 suites, 49 tests |
| ReadLints on touched files | PASS — no lint errors |
| Live smoke test | PASS (see below) |

### Live Smoke Test Evidence

- Global instruction set: `"For this test only, start your next response with GLOBAL-INSTRUCTION-TEST."`
- Prompt sent: `"Reply with one short sentence."`
- Response:
  ```
  GLOBAL-INSTRUCTION-TEST
  This is a short sentence.
  ```
- api-gateway log: `Global AI instructions present for user 4329e051-ce13-46b5-83ef-357faf749d90` ✓

The log entry confirms the session user ID (`knlee802@gmail.com`) was resolved correctly and
Global Instructions were fetched for that user rather than the old API-key owner.

---

## Non-goals Confirmed

- No database schema changes
- No prompt assembly changes
- No ai-service adapter changes
- No Global Instructions UI changes
- No driver page changes
- No frontend redesign
- No project instructions, repo docs, repo map, validation contract

---

## AI-CONTEXT Family Completion Note

AI-CONTEXT-01A through AI-CONTEXT-01E are now all COMPLETE and LOCKED. The complete Global AI
Instructions delivery chain is operational end-to-end:

| Slice | Scope | Status |
|---|---|---|
| AI-CONTEXT-01A | Backend DB/API foundation | COMPLETE and LOCKED |
| AI-CONTEXT-01B | Prompt assembly injection | COMPLETE and LOCKED |
| AI-CONTEXT-01C | Frontend settings UI | COMPLETE and LOCKED |
| AI-CONTEXT-01D | System message delivery (adapter split) | COMPLETE and LOCKED |
| AI-CONTEXT-01E | Browser identity alignment (session guard) | COMPLETE and LOCKED |
