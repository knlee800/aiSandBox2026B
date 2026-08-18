# PRIVATE-BETA-BLOCKER-03J — Checkpoint

**Status:** COMPLETE AND LOCKED — PASS — 2026-08-18
**Task:** Investigate Missing confirm-build-apply Request After Successful Qualifying Workspace Apply
**Family:** PRIVATE-BETA-BLOCKER-03 / BUILDER EXECUTION RELIABILITY / DEFERRED BUILD ACCOUNTING HANDOFF

---

## 1. Task Purpose

Add a public authenticated API Gateway route for `POST /api/ai/executions/:executionId/confirm-build-apply` to resolve E2E-03 confirm-build-apply reachability failure on the public staging topology.

## 2. E2E-03 Failure Origin

PRIVATE-BETA-E2E-03 (2026-08-17) proved a qualifying Builder workspace-mutation execution on staging (execution `b5afe30b-e3f2-4f72-be13-1aace6fc2bb4`) completed with `fileActions` and workspace apply succeeded. The expected confirm-build-apply request was never observed (`request_received=0`). Balance remained 30577→30577. Criteria 8/11/12 FAIL.

## 3. Source Investigation History

- Step 1 (Registration): 2026-08-17 — Keith-authorized investigation into E2E-03 confirm failure
- Step 2 (Stage Start / Investigation): 2026-08-18 — systematically traced public staging topology: Caddy, API Gateway, Next.js proxy, frontend confirm URL, internal accounting route

## 4. Initially Unproven Root Cause

Initial hypothesis: the `confirm-build-apply` frontend call was failing silently — reason unknown. Multiple potential causes under consideration: auth failure, CORS, network, internal service key requirement, route absence.

## 5. INTERNAL_SERVICE_KEY Hypothesis and Disproof

Hypothesis: the browser confirm request might require `X-Internal-Service-Key` that the frontend doesn't supply. Disproof: the frontend URL is `POST /api/ai/executions/:executionId/confirm-build-apply` — a public `/api/ai/` path, not `/api/internal/`. InternalServiceAuthGuard only applies to `/api/internal/*` paths. Schannel diagnostic confirmed the public URL reaches API Gateway Express/Nest (not Next.js) without internal key requirement.

## 6. Caddy Topology Evidence

Public staging Caddy routes all browser `/api/*` traffic to API Gateway `:4000`. The frontend confirm URL `POST /api/ai/executions/:executionId/confirm-build-apply` is a public `/api/*` request. Caddy delivers it to Gateway, not to Next.js `:3002`.

## 7. Python Diagnostic TLS Failure

Initial Python diagnostic attempt using `requests` library against staging HTTPS failed due to TLS/certificate resolution issues on the Windows staging environment.

## 8. Replacement Schannel Diagnostic

Switched to native Windows `curl.exe` (Schannel TLS backend). One authorized diagnostic request to a dummy UUID on the public confirm URL returned:
- HTTP 400
- `Via: 1.1 Caddy`
- `X-Powered-By: Express`
- Nest/Express JSON parse failure body

This proves the public confirm URL reaches API Gateway Express/Nest rather than Next.js. Next.js would have returned HTTP 401 `{ "error": "unauthenticated" }` before attempting body parse.

## 9. Proven Public Routing Defect

The public confirm URL `POST /api/ai/executions/:executionId/confirm-build-apply` exists ONLY as a Next.js App Router endpoint on `:3002`. API Gateway had no matching public route — only the internal route `POST /api/internal/executions/:executionId/confirm-build-apply` (INTERNAL_SERVICE_KEY protected). Since Caddy routes `/api/*` to Gateway, the browser's confirm request reaches Gateway (which has no handler for it) instead of Next.js (which does).

## 10. Exact Root-Cause Causal Chain

1. Build execution completes with `fileActions` and workspace apply succeeds
2. Frontend posts `POST /api/ai/executions/:executionId/confirm-build-apply`
3. Browser makes same-origin `/api/*` request
4. Caddy reverse-proxies `/api/*` to API Gateway `:4000`
5. API Gateway has no matching route at that path (only internal route exists)
6. Gateway returns error (no handler / 404 equivalent)
7. Frontend silently swallows the failure (no retry, no blocking)
8. Deduction never occurs; balance unchanged

## 11. 03G Distinction

PRIVATE-BETA-BLOCKER-03G (2026-08-16) fixed a separate issue: Next.js `next.config.js` API rewrite precedence was blocking the confirm route from reaching the Next.js App Router handler. After 03G, the Next.js handler is reachable via Next.js. However, public `/api/*` traffic never reaches Next.js under the Caddy topology — it goes directly to Gateway. 03G and 03J are independent defects on different layers.

## 12. Locked Architecture B

Architecture B selected and locked: Add an authenticated PUBLIC Gateway route matching the frontend URL. Do not change Caddy or the frontend URL. Retain Next.js proxy temporarily.

## 13. Exact Implementation

New route added to `AIExecutionController`:

```
POST /api/ai/executions/:executionId/confirm-build-apply
```

Controller path: `services/api-gateway/src/ai/ai-execution.controller.ts`

Method: `confirmBuildApply`

Decorator: `@Post('executions/:executionId/confirm-build-apply')`

Response code: `@HttpCode(HttpStatus.OK)` — 200

## 14. Authentication Mechanism

`@UseGuards(SessionOrApiKeyAuthGuard)` — same guard used by neighboring `getExecution`, `cancelExecution`, and `streamExecution` routes.

- Browser session: validates `aisandbox_session` cookie via `AuthService.validateSessionToken`, synthesizes `ApiKeyIdentity` with `userId: user.id`
- API key: validates `Authorization: Bearer` header via `ApiKeyAuthGuard`, resolves concrete `ApiKeyIdentity` with `userId`

Both paths populate `request.apiKeyIdentity` which is extracted by `@AuthenticatedUser()` decorator.

## 15. Ownership Protection

```typescript
if (!identity?.userId || execution.user_id !== identity.userId) {
  throw new NotFoundException('Execution not found');
}
```

Same not-found convention as `getExecution`. Does not reveal whether the execution exists to non-owners. Ownership check occurs BEFORE `triggerBuildApplyDeduction`. No browser-supplied userId can override authenticated identity.

## 16. Existing DTO Reuse

`ConfirmBuildApplyDto` from `services/api-gateway/src/ai/dto/confirm-build-apply.dto.ts` — created in PRIVATE-BETA-BLOCKER-03D-A. Validates `applyStatus` (string, not empty), `totalActions` (int ≥ 0), `successCount` (int ≥ 0). Applied via `ValidationPipe` with `whitelist: true, transform: true`.

## 17. Existing Deferred Accounting Reuse

`UsageLedgerService.triggerBuildApplyDeduction(executionId, confirmation)` — same method called by `InternalAccountingController.confirmBuildApply`. All qualification logic (build_awaiting_apply check, applyStatus validation, zero-action rejection, partial-apply rejection, exactly-once sourceEventId deduplication) remains in the accounting service layer. The public controller is a thin authenticated pass-through.

## 18. Preservation of 03D Semantics

- Build completion sets `build_awaiting_apply` — unchanged
- Public confirmation calls existing `triggerBuildApplyDeduction` — unchanged
- Qualification logic remains in accounting layer — unchanged
- `applyStatus != 'applied'` does not deduct — verified by test
- Zero actions does not deduct — verified by test
- Partial apply does not deduct — verified by test
- Qualifying apply deducts under existing rules — verified by test
- Source-event/idempotency: duplicates forwarded to same service method — unchanged
- Ask accounting: untouched (separate `triggerDeductionForExecution` path)
- Token-to-credit: `triggerBuildApplyDeduction` reused unchanged

## 19. Internal Endpoint Preservation

`POST /api/internal/executions/:executionId/confirm-build-apply` remains on `InternalAccountingController` under `@Controller('internal/executions')`. Protected by global `InternalServiceAuthGuard` (requires `X-Internal-Service-Key` header). HTTP test verifies internal route remains INTERNAL_SERVICE_KEY protected.

## 20. Frontend/Caddy Unchanged

- No changes to any `frontend/` file (verified: `git diff --name-only -- frontend/` empty)
- No Caddyfile exists in repository / no Caddy configuration change
- Frontend confirm URL remains `POST /api/ai/executions/:executionId/confirm-build-apply`

## 21. Next.js Proxy Retained

Next.js App Router handler for confirm-build-apply was NOT deleted. The proxy remains temporarily. Architecture B adds a parallel Gateway route; it does not remove the Next.js handler. Proxy removal is a future cleanup task.

## 22. Retry/Observability Explicitly Excluded

- No retry logic added to the controller
- No observability hardening (e.g., structured logging beyond existing patterns, metrics, tracing) added
- These were explicitly out of scope for 03J root-cause fix

## 23. Exact Test Coverage

**Focused HTTP proof test:** `services/api-gateway/src/ai/__tests__/ai-execution.confirm-build-apply.http.spec.ts`
- 16 tests covering: authenticated owner success, unauthenticated 401, invalid session 401, INTERNAL_SERVICE_KEY-as-public-auth rejection, other-user 404, nonexistent execution 404, failed apply forwarding, zero-action forwarding, partial-apply forwarding, qualifying deduction handoff, duplicate idempotency, existing GET route preserved, existing cancel route preserved, internal route INTERNAL_SERVICE_KEY protection, no Stripe/payment/retry/checkpoint scope creep

**Guard metadata test:** `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts`
- New test: `protects public confirmBuildApply with SessionOrApiKeyAuthGuard only` — verifies decorator metadata

**Broader affected suites (all PASS):**
- `ai-execution.controller.spec.ts`
- `ai-execution.controller.integration.spec.ts`
- `internal-accounting.controller.spec.ts`
- `usage-ledger.service.spec.ts`
- `confirm-build-apply.dto.spec.ts`
- `ai-execution-guards.integration.spec.ts`
- `ai-execution.get-execution-file-actions.spec.ts`
- `ai-execution.confirm-build-apply.http.spec.ts`

Total: 8 suites, 241/241 PASS

## 24. Independent Validation Results

Step 4 independent validation (not relying on Step 3 report):

| Check | Result |
|-------|--------|
| Focused HTTP test (16 tests) | PASS |
| Broader affected suites (8 suites, 241 tests) | PASS |
| TypeScript typecheck (`npx tsc --noEmit`) | PASS |
| Production build (`npm run build`) | PASS |
| Docker/Postgres/Redis | NOT USED |
| Staging/provider/credit mutation | NONE |

## 25. Acceptance-Criteria Reconciliation

All acceptance criteria satisfied for 03J local implementation scope. Two criteria explicitly note "live E2E still required" — these are runtime behaviors requiring the separate fresh E2E task (not registered in 03J). One criterion ("Final checkpoint created") is satisfied by this Step 4. No governance conflict prevents 03J closure.

## 26. No Runtime/Provider/Credit Mutation During Implementation

- No provider API calls made
- No credit deductions triggered
- No database mutations
- No staging deployment
- No PM2/Caddy restart
- `GLOBAL_EXECUTION_ENABLED=false` unchanged
- `BILLING_CHARGES_ENABLED=false` unchanged

## 27. Fresh Post-Fix E2E Requirement

**FRESH_POST_FIX_E2E_REQUIRED=YES**

A fresh controlled E2E is REQUIRED before Builder private-beta readiness can return to GO. The E2E task is NOT registered in 03J. It requires separate Keith authorization.

## 28. E2E-03 Remains Locked FAIL/BLOCKED

PRIVATE-BETA-E2E-03: COMPLETE AND LOCKED — FAIL / BLOCKED — 2026-08-17. Not retroactively converted to PASS. Not reopened.

## 29. Builder Private-Beta Remains NO-GO Pending Fresh E2E

**BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_E2E**

03J completion proves the route defect is fixed locally. Live proof requires fresh E2E.

## 30. PRIVATE-BETA-INVITE-01 Prohibition

PRIVATE-BETA-INVITE-01 remains: UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED

## 31. Retained Staging Stash

Previous staging stash from 03I/E2E-03 work remains. No stash pop or deployment occurred during 03J.

## 32. Final Conclusion

PRIVATE-BETA-BLOCKER-03J is COMPLETE AND LOCKED — PASS — 2026-08-18.

The public routing defect that caused E2E-03 confirm-build-apply failure is remediated locally. The fix adds a public authenticated Gateway route that matches the frontend confirm URL, using existing auth/ownership/accounting patterns without duplicating logic. Implementation is minimal, reversible, and independently validated.

Builder private-beta readiness remains NO-GO pending a fresh controlled E2E that exercises the fix on staging with a live provider call.

---

**Implementation files:**
- `services/api-gateway/src/ai/ai-execution.controller.ts` (modified — new `confirmBuildApply` method)
- `services/api-gateway/src/ai/__tests__/ai-execution.confirm-build-apply.http.spec.ts` (new — focused HTTP regression test)
- `services/api-gateway/src/ai/__tests__/ai-execution-guards.integration.spec.ts` (modified — guard metadata test)

**Governance files updated:**
- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`

**No other files modified.**
