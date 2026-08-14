# PRIVATE-BETA-BLOCKER-03D-B — Checkpoint

**Task ID:** PRIVATE-BETA-BLOCKER-03D-B
**Title:** Frontend Apply-Result Integration + Validation
**Status:** COMPLETE AND LOCKED — 2026-08-14
**Parent:** PRIVATE-BETA-BLOCKER-03D (Step 3, child slice B of 2)
**Step:** Step 3 — Consolidation / Checkpoint
**Author:** Cursor / Sonnet 4.6 (governance/consolidation only — no source modification)

---

## 1. Task / Status / Date

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-BLOCKER-03D-B |
| Title | Frontend Apply-Result Integration + Validation |
| Status | **COMPLETE AND LOCKED — 2026-08-14** |
| Workflow | HIGH-RISK 3-STEP CHILD LIFECYCLE |
| Step completed | Step 3 — Consolidation / Checkpoint |

---

## 2. Parent Relationship

**Parent task:** PRIVATE-BETA-BLOCKER-03D — No-Workspace-Result Credit Policy

03D-B is child slice B of 2 under parent 03D Step 3 (Bounded Implementation + Validation). It delivers the browser-to-accounting product path that completes the 03D-A backend gate:

- **03D-A** (COMPLETE AND LOCKED): intent-conditional deduction gate in `triggerDeductionForExecution()` + `POST /api/internal/executions/:executionId/confirm-build-apply` endpoint protected by `X-Internal-Service-Key`
- **03D-B** (this task): authenticated Next.js server proxy route + frontend apply-result integration so that the browser can safely trigger the internal endpoint after a qualifying full workspace apply

Both 03D-A and 03D-B together constitute parent 03D Step 3. With both COMPLETE AND LOCKED, parent Step 3 is COMPLETE and parent Step 4 (Final Consolidation / Combined Validation Decision) is PENDING.

---

## 3. Problem Addressed

Prior to 03D-B, the 03D-A `confirm-build-apply` endpoint was fully implemented but unreachable from the product: the browser cannot safely possess `X-Internal-Service-Key`, so the endpoint could only be called by trusted internal services. The full Build accounting flow was therefore broken end-to-end even with 03D-A in place.

03D-B closes this gap by:

1. Implementing a public-facing Next.js App Router API route (`POST /api/ai/executions/[executionId]/confirm-build-apply`) that the browser can call with its existing session cookie.
2. Implementing a server-side proxy (`build-apply-confirm-proxy.server.ts`) that authenticates the session, validates execution ownership, reads `INTERNAL_SERVICE_KEY` from the server environment only, and forwards the qualifying confirmation to the 03D-A internal endpoint.
3. Integrating `confirmBuildApplyIfQualifying()` into the frontend apply orchestration in `page.tsx` so that only a verified full-success apply result triggers a confirmation call.
4. Adding execution ownership enforcement in `ai-execution.controller.ts` `getExecution()` — own-user executions return normally; other-user/unknown executions return `404`, closing a pre-existing cross-user execution lookup surface.

---

## 4. Final Browser-to-Accounting Flow

```
AI execution completed
→ backend 03D-A: triggerDeductionForExecution() skips deduction (workspace_mutation intent)
→ frontend: receives fileActions via SSE/poll
→ acquireExecutionApplyGuard(executionId, appliedExecutionIds)   ← apply-once gate
→ applySequentialFileActions({sessionId, actions, writeFile, ...})
   → for each action: POST /api/sessions/:sessionId/files/write
   → each action: { status: 'success' | 'failed' | 'skipped', error? }
→ applyResult: { applyStatus, skipReason, results[] }
→ qualifyBuildApplyConfirmation(applyResult)
   → requires: applyStatus === 'applied', results.length > 0,
               every result.status === 'success',
               successCount === totalActions
→ [if qualifying]:
   browser POST /api/ai/executions/:executionId/confirm-build-apply
   → Next.js App Router route (confirm-build-apply/route.ts)
   → proxyConfirmBuildApply()
      → extract aisandbox_session from Cookie header
      → GET /api/auth/me  (session-cookie auth) → authenticatedUserId
      → GET /api/ai/executions/:executionId  (session-cookie auth) → ownership validated
      → read INTERNAL_SERVICE_KEY from process.env (server-only, never exposed to browser)
      → POST /api/internal/executions/:executionId/confirm-build-apply
         X-Internal-Service-Key: <server env key>
         { applyStatus, totalActions, successCount }
      → backend 03D-A: triggerBuildApplyDeduction()
         → validates persisted usage_records evidence
         → emitDeductionAttempt() → PersistentCreditDeductionGateway.applyDeduction()
         → sourceEventId = executionId UNIQUE → exactly-once deduction
→ maybeRunExecutionCoherence()  ← coherence unchanged, runs regardless of confirmation outcome
```

---

## 5. Authentication Boundary

The browser call to the Next.js route requires the httpOnly session cookie `aisandbox_session`.

The proxy validates authentication by calling `GET /api/auth/me` on the API Gateway using the extracted session cookie. A missing or invalid session produces `401` before any internal endpoint is touched. No unauthenticated credit trigger exists.

| Condition | Proxy response |
|-----------|---------------|
| No session cookie | `401 unauthenticated` |
| Invalid/expired session (`/auth/me` 401/403) | `401 unauthenticated` |
| `/auth/me` non-401 error | `502 auth_lookup_failed` |
| Missing `INTERNAL_SERVICE_KEY` env | `500 confirmation_unavailable` |

---

## 6. Execution Ownership Validation

Before forwarding the internal confirmation, the proxy calls:

```
GET /api/ai/executions/:executionId
```

using the session cookie (i.e. as the authenticated user). The `getExecution()` handler in `ai-execution.controller.ts` now enforces:

```
execution.user_id !== identity.userId  →  throw NotFoundException('Execution not found')
```

This means execution lookup returns `404` for any execution that does not belong to the authenticated user. The proxy receives `404` and returns `{ status: 404, body: { error: 'execution_not_found' } }` to the browser. The internal confirmation endpoint is never reached.

---

## 7. Other-User Rejection Behavior

If the authenticated user submits a `confirm-build-apply` request for an execution belonging to a different user:

- `GET /api/ai/executions/:executionId` returns `404` (ownership mismatch, same response as not-found)
- Proxy returns `{ status: 404, body: { error: 'execution_not_found' } }`
- Internal endpoint is **never called**
- No deduction is triggered
- The 404 response does not reveal whether the execution exists for another user

This also closes a pre-existing cross-user execution lookup / IDOR surface on the `getExecution()` endpoint. The scope of the fix is limited to this endpoint only; no broader API Gateway authorization hardening was introduced.

---

## 8. Internal Service-Key Isolation

`X-Internal-Service-Key` is read exclusively from `process.env.INTERNAL_SERVICE_KEY` inside `proxyConfirmBuildApply()` on the Next.js server runtime.

It is **NOT**:
- prefixed `NEXT_PUBLIC_*`
- supplied by the browser request
- returned to the browser in any response
- logged
- bundled into client static JS

**Security evidence:** client static bundle search after `npm run build`:

```
INTERNAL_SERVICE_KEY  →  0 matches in .next/static client JS
```

The proxy explicitly ignores any `x-internal-service-key` header arriving from the browser (`void args.incomingInternalServiceKeyHeader`). Only the server-env key is forwarded to the internal endpoint.

---

## 9. Next.js Proxy Route

**Route:** `POST /api/ai/executions/[executionId]/confirm-build-apply`

**File:** `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts`

This is a Next.js App Router API route. It takes precedence over the generic `/api/:path*` rewrite in `next.config.js` because App Router API routes are resolved before rewrite rules.

The route:
- Awaits `context.params` (required for App Router dynamic segments in Next.js 15+)
- Reads the cookie header from the incoming request
- Reads and parses the JSON body
- Delegates entirely to `proxyConfirmBuildApply()`
- Returns `NextResponse.json(result.body, { status: result.status })`

The route itself contains no authentication, validation, or accounting logic — those are encapsulated in the proxy module.

---

## 10. Full-Success Qualification

`qualifyBuildApplyConfirmation(applyResult)` in `workspace-ai-file-actions.logic.ts` returns `BuildApplyConfirmationPayload | null`.

**Qualifying conditions** (all must be true):

| Check | Value |
|-------|-------|
| `applyResult.applyStatus` | `=== 'applied'` |
| `applyResult.results.length` | `> 0` |
| every `result.status` | `=== 'success'` |
| `successCount === totalActions` | all actions succeeded |

Counts are derived from the **actual `applySequentialFileActions()` return value**, not from the original provider `fileActions` input. Returns `null` (no confirmation) for any partial, failed, skipped, or zero-action result.

`confirmBuildApplyIfQualifying()` wraps `qualifyBuildApplyConfirmation()` with error isolation: a failing confirmation HTTP call is caught and reported via `onConfirmationError` without affecting workspace state or re-triggering file writes.

---

## 11. Confirmation Payload

The browser sends to the Next.js route:

```json
{
  "applyStatus": "applied",
  "totalActions": <actual count from apply result>,
  "successCount": <actual success count from apply result>
}
```

The proxy validates the payload via `parseBuildApplyConfirmationProxyPayload()` before forwarding. The internal endpoint receives the identical struct. The backend `triggerBuildApplyDeduction()` validates all fields against persisted `usage_records` evidence before triggering any deduction.

---

## 12. No-Confirmation Cases

Zero confirmation is sent for:

| Condition | Reason |
|-----------|--------|
| `applyStatus !== 'applied'` | `qualifyBuildApplyConfirmation()` returns null |
| `results.length === 0` (zero actions) | returns null |
| Any `result.status !== 'success'` | returns null |
| `successCount < totalActions` (partial apply) | returns null |
| First-action failure | apply result not fully applied |
| Skipped apply (`acquireExecutionApplyGuard()` prevented) | `applyStatus = 'skipped'` |
| Apply guard skip | `applyStatus = 'skipped'` |
| Contract failure / no actions | execution status `failed` already |
| Session-expired / HTTP 410 during apply | write fails → not all success |
| Workspace write / network failure | not all success |
| Browser/tab/network disappears | no HTTP request reaches server |
| Ask / conversation execution | `shouldApplyFileActionsForExecutionIntent` = false → no apply → no confirm call reached |

In all cases: **no confirmation → no deduction** (per 03D-A gate).

---

## 13. Ask Regression Behavior

Ask (`executionIntent=conversation`) executions are completely unaffected.

- Frontend `shouldApplyFileActionsForExecutionIntent('conversation')` = `false`
- No workspace apply runs
- `applyExecutionFileActions()` does not reach `confirmBuildApplyIfQualifying()`
- No `confirm-build-apply` request is ever sent
- Ask deduction continues through the unchanged immediate path: worker → `notifyExecutionComplete()` → `triggerDeductionForExecution()` (conversation intent) → `emitDeductionAttempt()` → `PersistentCreditDeductionGateway.applyDeduction()`

No delay, no fileActions required, no frontend call, no confirmation. Existing Ask accounting unchanged.

---

## 14. Confirmation Failure Behavior

If workspace apply fully succeeds but the `confirm-build-apply` HTTP request fails (network error, 5xx, gateway timeout):

- The successful workspace files **remain** — no rollback
- No second workspace apply is triggered
- No local credit deduction occurs in the browser
- The execution is **not** changed to failed
- No refund is issued
- No accounting success is fabricated
- `onConfirmationError` logs: `[BUILD_APPLY_CONFIRM_FAIL] <executionId> <error>`

Result: **workspace apply succeeded, accounting confirmation unproven → possible under-charge.** This is explicitly accepted private-beta policy.

---

## 15. Retry Policy

Exactly **one** confirmation attempt per apply result.

There is **no**:
- Retry timer
- Persistent confirmation queue
- Reconciliation worker
- Background auto-charge after confirmation failure
- Infinite retry loop
- File-action reapplication triggered by confirmation failure

---

## 16. Apply-Once Preservation

`acquireExecutionApplyGuard(executionId, appliedExecutionIds)` continues to gate file-action application before `applySequentialFileActions()` is called. The `confirmBuildApplyIfQualifying()` call is placed **after** the apply result is determined and after `setExecutionFileActionState()` records the result — confirmation failure cannot trigger a second apply.

---

## 17. Coherence Preservation

`maybeRunExecutionCoherence()` (file tree refresh, preview refresh, checkpoint creation) is driven by the existing execution file-action state flow. It runs after `setExecutionFileActionState()` records the apply result. The `confirmBuildApplyIfQualifying()` call occurs before `maybeRunExecutionCoherence()` but a confirmation failure does not block or roll back coherence. Accounting-confirmation failure does not invalidate successful workspace coherence.

---

## 18. Exact Production Files

| File | Change |
|------|--------|
| `frontend/app/[locale]/app/page.tsx` | Added `confirmBuildApplyIfQualifying`, `requestBuildApplyConfirmation` imports; added `confirmBuildApplyIfQualifying()` call after `setExecutionFileActionState()` in `applyExecutionFileActions()` |
| `frontend/components/workspace/workspace-ai-file-actions.logic.ts` | Added `BuildApplyConfirmationPayload`, `qualifyBuildApplyConfirmation()`, `confirmBuildApplyIfQualifying()`, `buildConfirmBuildApplyRequestUrl()`, `requestBuildApplyConfirmation()` |
| `frontend/lib/build-apply-confirm-proxy.server.ts` | New file — server-only proxy: session extraction, auth/me validation, execution ownership validation, env-key read, internal endpoint forward; `proxyConfirmBuildApply()` and all helpers |
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | New file — Next.js App Router POST handler delegating to `proxyConfirmBuildApply()` |
| `frontend/package.json` | Minor dependency update (no new accounting-related deps) |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Added user ownership check in `getExecution()`: `execution.user_id !== identity.userId → throw NotFoundException` |

**No AI Service / Worker production changes.**
**No additional API Gateway accounting semantics changed.**
**No schema migration.**

---

## 19. Exact Test Files

| File | Change |
|------|--------|
| `frontend/components/workspace/workspace-ai-file-actions.logic.test.ts` | Added tests for `qualifyBuildApplyConfirmation()`, `confirmBuildApplyIfQualifying()`, `requestBuildApplyConfirmation()` |
| `frontend/lib/build-apply-confirm-proxy.server.test.ts` | New file — 11 tests covering proxy authentication, execution ownership, internal-key isolation, payload validation, upstream forwarding, error handling |
| `services/api-gateway/src/ai/__tests__/ai-execution.get-execution-file-actions.spec.ts` | Updated tests to cover execution ownership enforcement in `getExecution()` (own-user access, other-user 404) |

---

## 20. Targeted Validation

| Suite | Result |
|-------|--------|
| File-action / confirmation helper tests (`workspace-ai-file-actions.logic.test.ts`) | **PASS** |
| Proxy tests (`build-apply-confirm-proxy.server.test.ts`) | **11 / 11 PASS** |
| Execution ownership / getExecution tests (`ai-execution.get-execution-file-actions.spec.ts`) | **6 / 6 PASS** |

---

## 21. Frontend Regression Validation

| Suite | Result |
|-------|--------|
| Coherence | **PASS** |
| Execution intent | **PASS** |
| Chat-thread | **PASS** |
| workspace-shell | **438 / 438 PASS** |

---

## 22. Typecheck / Build Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** |
| `npm run build` | **PASS** |

Built route included in build output:

```
/api/ai/executions/[executionId]/confirm-build-apply
```

---

## 23. Security / Bundle Check

Client static bundle search after `npm run build`:

```
rg INTERNAL_SERVICE_KEY .next/static/  →  0 matches
```

`INTERNAL_SERVICE_KEY` does not appear in any client-bundled JavaScript. It is only read server-side by `proxyConfirmBuildApply()` from `process.env`.

No stronger secret-scanning guarantee is claimed beyond this actual check.

---

## 24. No UX / Translation Changes

No visible UI change was introduced.

| Resource | Status |
|----------|--------|
| `frontend/messages/en.json` | **untouched** |
| `frontend/messages/zh-TW.json` | **untouched** |
| `frontend/messages/zh-CN.json` | **untouched** |

No new icons. No new visible user-facing copy.

---

## 25. Runtime Environment Dependency

**Prominent requirement:** The Next.js server runtime now requires two environment variables for the confirmation proxy to function:

| Variable | Purpose | If missing |
|----------|---------|------------|
| `INTERNAL_SERVICE_KEY` | Server-side key added to internal confirm-build-apply call | `500 confirmation_unavailable` — confirmation fails closed, no deduction |
| `API_GATEWAY_URL` | Base URL for API Gateway calls from Next.js server | Falls back to `http://localhost:4000` |

If `INTERNAL_SERVICE_KEY` is absent or empty: the proxy returns `500 confirmation_unavailable` to the browser. No deduction occurs. The workspace apply result stands unchanged.

**These environment variables must be confirmed present before combined staging validation.**

Do NOT modify `.env` during this consolidation step.

---

## 26. Provider / Accounting Safety

| Safety item | Value |
|-------------|-------|
| Provider calls | **0** |
| Real balance mutations | **0** |
| Credits granted | **0** |
| Credits refunded | **0** |
| Migration run | NO |
| Staging / runtime work | NO |
| PM2 restarted | NO |
| `.env` modified | NO |
| Docker / Postgres / Redis started | NO |
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |
| Stripe / payment-provider changes | NONE |

All tests used mocked fetch implementations. No live database connections. No live provider calls.

---

## 27. Remaining Under-Charge Limitation

If:
- workspace apply succeeds, AND
- the browser/tab/network disappears before the `confirm-build-apply` request reaches the Next.js server

→ no confirmation → no deduction.

This is an **intentional possible under-charge** accepted by 03D private-beta policy. No reconciliation auto-charge is authorized. No timeout-based silent deduction exists.

Additionally: the current implementation does NOT persist the frontend apply result to `usage_records.metadata`. The backend deduction decision is based solely on whether `confirm-build-apply` was received with a qualifying payload and validated against persisted `fileActions`. A more precise reconciliation scan (that could distinguish apply success from apply failure) would require persisting the apply result — this is deferred and not in 03D scope.

---

## 28. Relationship to 03D-A

03D-B is the frontend complement to 03D-A:

- 03D-A provides: the intent-conditional gate preventing premature Build deduction, and the `POST /api/internal/executions/:executionId/confirm-build-apply` internal endpoint protected by `X-Internal-Service-Key`
- 03D-B provides: the authenticated proxy so the browser can safely reach that endpoint after a qualifying full workspace apply; the frontend helper that determines qualification from actual apply results

Neither 03D-A nor 03D-B is deployable as a standalone end-to-end accounting solution. Together they form the complete Build credit deduction path.

---

## 29. Combined 03D Implementation State

With both 03D-A and 03D-B complete:

| Scenario | Charge? | Implementation |
|----------|---------|---------------|
| Ask success | **YES** — immediate at completion | 03D-A intent gate unchanged path |
| Build full successful apply | **YES** — after qualifying confirm-apply | 03D-A gate + 03D-B proxy + 03D-B frontend helper |
| Build zero actions (contract failure) | **NO** | execution_status=`failed` → existing gate skips |
| Build apply failure | **NO** | no qualifying confirmation → no deduction |
| Build partial apply | **NO** | `successCount < totalActions` → not qualifying |
| Timeout / provider failure | **NO** | execution_status != `completed` → existing gate |
| Cancellation | **NO** | execution_status != `completed` → existing gate |
| Tab close before confirmation | **NO** — under-charge per policy | no request arrives → no deduction |

---

## 30. Next Parent Step

**PRIVATE-BETA-BLOCKER-03D Step 4 — Final Consolidation / Combined Validation Decision**

Step 4 must:
- Review the combined 03D-A + 03D-B result
- Assess remaining limitations (under-charge policy, `INTERNAL_SERVICE_KEY` env requirement, dormant `updateExecutionResult()` legacy path)
- Confirm environment readiness (`INTERNAL_SERVICE_KEY`, `API_GATEWAY_URL`) for any combined staging validation
- Determine whether any provider-free combined staging validation is required before parent 03D closure
- Create `docs/PRIVATE-BETA-BLOCKER-03D-CHECKPOINT.md`
- Lock parent 03D

Step 4 must NOT be performed during this consolidation.

---

## Safety Confirmation

| Safety item | Value |
|-------------|-------|
| Source files modified (production) | NONE during consolidation |
| Tests modified | NONE during consolidation |
| `.env` modified | NO |
| PM2 restarted | NO |
| Services stopped/started | NO |
| Provider calls made | NONE |
| Builder retried | NO |
| PostgreSQL mutated | NO |
| Redis mutated | NO |
| Docker/container mutated | NO |
| Dependencies added | NO |
| Git commit/push | NO |
| ARCHITECTURE.md modified | NO |
| PRD.md modified | NO |
| CLAUDE.md modified | NO |
| 03C changes | NO |
| 03D-A source/semantic changes | NO |
| Balance mutation | NO |
| Credits granted/refunded | NO |
| Migration run | NO |
| Stripe/payment work | NO |
| `GLOBAL_EXECUTION_ENABLED` | `false` — preserved |
| `BILLING_CHARGES_ENABLED` | `false` — preserved |

---

*Checkpoint created: 2026-08-14 — PRIVATE-BETA-BLOCKER-03D-B Step 3 — governance/consolidation only — no source/runtime mutation.*
