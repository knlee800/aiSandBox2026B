# PRIVATE-BETA-BLOCKER-03J — Stage-Start / Source-Path Investigation Plan (EVIDENCE RECONCILED)

**Task ID:** PRIVATE-BETA-BLOCKER-03J
**Title:** Investigate Missing confirm-build-apply Request After Successful Qualifying Workspace Apply
**Step:** Step 2 — Stage Start / Source-Path Investigation Plan
**Status:** COMPLETE — ROOT CAUSE PROVEN / LIVE PUBLIC ROUTING DEFECT CONFIRMED — 2026-08-18
**Reconciliation date:** 2026-08-18
**Author:** Cursor / Grok 4.6 (documentation / governance reconciliation only — no source/test/runtime modification)

---

## EVIDENCE RECONCILIATION NOTICE (2026-08-18)

The 2026-08-18 source-only correction that set:

```
ROOT_CAUSE_OF_CONFIRM_FAILURE = UNPROVEN
STEP_3_READINESS = BLOCKED_PENDING_EVIDENCE
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN = NO
```

is now superseded by completed authorized runtime evidence.

Authoritative Step 2 classification:

```
ROOT_CAUSE_OF_CONFIRM_FAILURE                      = PROVEN
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN      = YES
PUBLIC_CONFIRM_ROUTING_DEFECT_PROVEN               = YES
PUBLIC_CONFIRM_ROUTE_LIVE_TARGET                   = API_GATEWAY
PUBLIC_CONFIRM_ROUTE_BYPASSES_NEXTJS               = YES
INTERNAL_SERVICE_KEY_HYPOTHESIS                    = DISPROVEN
STEP_3_READINESS                                   = READY
ARCHITECTURE                                       = B
RETRY_REQUIRED_FOR_ROOT_CAUSE_FIX                  = NO
OBSERVABILITY_REQUIRED_FOR_ROOT_CAUSE_FIX          = NO
CHILD_SLICE_DECISION                               = NONE — one bounded implementation slice
```

Do not retain `INTERNAL_SERVICE_KEY` as root cause.

The earlier source-only findings remain valid as supporting analysis:

- confirmation failure observability defect remains proven
- confirmation resilience / swallowed-error defect remains proven
- those defects explain why a failed confirmation did not undo the already-successful workspace apply
- they are NOT the proven cause of `confirm_build_apply.request_received = 0`

03G remains COMPLETE AND LOCKED and is not reopened.

PRIVATE-BETA-E2E-03 remains COMPLETE AND LOCKED — FAIL / BLOCKED — 2026-08-17. This reconciliation does not convert E2E-03 into PASS.

---

## 1. Task Objective

Determine the exact root cause of the missing `confirm-build-apply` request observed during PRIVATE-BETA-E2E-03. The qualifying workspace apply succeeded, automatic checkpoint succeeded, but the expected deferred-deduction confirmation request was never observed at the API Gateway's `InternalAccountingController.confirmBuildApply`.

**Result:** Proven. The browser confirmation URL is a public `/api/*` path. Staging Caddy routes all `/api/*` to API Gateway `:4000`. The public confirmation endpoint exists only as a Next.js App Router handler on frontend `:3002`. Gateway has no matching public `POST /api/ai/executions/:executionId/confirm-build-apply`. Live Schannel diagnostic proves that exact public URL reaches Gateway Express/Nest, not Next.js. Therefore the confirmation request cannot reach the Next.js proxy under the deployed Caddy topology.

---

## 2. Locked E2E-03 Evidence

| Field | Value |
|-------|-------|
| Execution ID | `9192df3c-fbf7-4ced-b49a-50037793223c` |
| Provider / Model | xai / grok-4.5 |
| tokens_used | 1148 |
| executionIntent | workspace_mutation |
| fileActions | 1 |
| Workspace apply | SUCCESS |
| index.html content | correct |
| Preview | PASS |
| Automatic checkpoint | `2ade268bf4febd41044b26912a9aa8d9c96e3fa0` |
| Git/PG/SQLite reconciliation | PASS |
| `finalize_accounting.build_awaiting_apply` | observed at 2026-08-17T10:11:32.420Z |
| `confirm_build_apply.request_received` | **0** |
| `confirm_build_apply.deduction_triggered` | **0** |
| credit_deduction_records | 0 |
| Balance before / after | 30577 / 30577 |
| Expected if confirmation succeeded | 30577 → 29429 |
| Staging SHA at run | `54b5764d8645d80a44f5de1351ca8e7928c5c8f4` |

Criterion 10 PASS. Criteria 8/11/12 FAIL. Do not modify or reinterpret these conclusions. Do not convert E2E-03 into PASS.

---

## 3. Preserved Accounting Semantics (PRIVATE-BETA-BLOCKER-03D)

1. Ask accounting semantics unchanged.
2. Build completion alone must not deduct.
3. `workspace_mutation` completion waits at `build_awaiting_apply`.
4. Qualifying successful apply triggers confirmation.
5. Apply failure must not charge.
6. Zero actions must not charge.
7. Non-qualifying confirmation must not charge.
8. Qualifying success deducts exactly once.
9. Duplicate confirmation remains idempotent.
10. No manual credit mutation workaround.
11. No frontend fake accounting state.
12. Ownership/auth checks remain intact.

Step 3 must preserve all of the above. Do not modify accounting semantics unless necessary to expose the already-existing behavior through the correct public authenticated Gateway route.

---

## 4. Exact Source-Path Map

### 4.1 Build Send

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Build prompt submission | `frontend\app\[locale]\app\page.tsx` (line ~4345) | Chat execution handler | POST to `/api/ai/executions` (proxied to Gateway) |
| Execution response | same file (line ~4376) | `WorkspaceChatExecutionResponse` parse | Returns `{ executionId, status: 'queued' }` |
| Execution intent stored | same file (line 4398) | `executionIntentByExecutionIdRef.current[nextExecutionId] = requestExecutionIntent` | `workspace_mutation` |

### 4.2 AI Execution Response

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Stream setup | page.tsx (line 4416-4420) | `new EventSource(...)` | Subscribes to SSE stream |
| Stream handler | page.tsx (line 4421-4468) | `stream.onmessage` | Handles token/file_actions/complete |
| Status poll (interval) | page.tsx (line 1574) | `setInterval(refreshChatExecutionStatus, ...)` | Runs while state is queued/running |
| Status poll (immediate) | page.tsx (line 4567) | `await refreshChatExecutionStatus(nextExecutionId)` | Called immediately after submission |

### 4.3 File Actions Extraction

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Stream path | page.tsx (line 4452-4455) | `parsed.type === 'file_actions'` | `normalizeWorkspaceFileActions(parsed.actions)` |
| Status poll path | page.tsx (line 3817) | Status poll returns 'completed' | `normalizeWorkspaceFileActions(data.fileActions)` |
| Normalize | page.tsx (line 741-746) | `normalizeWorkspaceFileActions` | Returns `[]` if not array; filters via `isWorkspaceFileAction` |

### 4.4 Workspace Apply

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Consume file actions | page.tsx (line 5179-5243) | `consumeExecutionFileActions` | Checks intent, fires `void maybeApplyExecutionFileActions` |
| Apply gate checks | page.tsx (line 5034-5112) | `maybeApplyExecutionFileActions` | Checks cancellation, session, auth, risky batch |
| Sequential file write | `frontend\components\workspace\workspace-ai-file-actions.logic.ts` (line 258-315) | `applySequentialFileActions` | Writes files via container API; returns `{ applyStatus: 'applied', results }` |
| Apply guard | same file (line 176-185) | `acquireExecutionApplyGuard` | Prevents double-apply |

### 4.5 Apply Result Representation

`ApplySequentialFileActionsResult`:
- `applyStatus: 'applied'` (if initial session gate passes)
- `results: WorkspaceExecutionFileActionResult[]` (per-file success/failed/skipped)
- For E2E-03: `applyStatus: 'applied'`, `results: [{ action: 'create', path: 'index.html', status: 'success', error: null }]`

### 4.6 Post-Apply State Update and Coherence (Automatic Checkpoint)

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| State update | page.tsx (line 5014-5022) | `setExecutionFileActionState` | Synchronous React setState + message attachment |
| State update triggers useEffect | page.tsx (line 5245-5258) | `useEffect` on `chatExecutionFileActionStates` | Fires after re-render |
| Coherence execution | `frontend\components\workspace\workspace-ai-coherence.logic.ts` (line 47-117) | `runAiActionCoherence` | refreshFileTree → reloadEditor → refreshPreview → createCheckpoint |
| Checkpoint API call | `frontend\components\workspace\workspace-checkpoint-create.logic.ts` (line 35-44) | `createWorkspaceCheckpoint` | POST `/api/sessions/:id/checkpoints` |

Under the deployed Caddy topology, browser `/api/sessions/:id/checkpoints` is also sent to API Gateway. Gateway has a matching authenticated checkpoint route, which is why automatic checkpoint succeeded independently of confirm-build-apply.

### 4.7 Confirm-Build-Apply Invocation (same function, after state update)

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Invocation | page.tsx (line 5024-5031) | `await confirmBuildApplyIfQualifying(...)` | Called immediately after `setExecutionFileActionState` — no intervening code |
| Qualification check | workspace-ai-file-actions.logic.ts (line 323-350) | `qualifyBuildApplyConfirmation` | `applyStatus === 'applied'` AND `results.length > 0` AND all results `status === 'success'` |
| Invocation gate | workspace-ai-file-actions.logic.ts (line 352-376) | `confirmBuildApplyIfQualifying` | `payload !== null` AND `executionId` is truthy |
| Browser fetch | workspace-ai-file-actions.logic.ts (line 382-400) | `requestBuildApplyConfirmation` | POST relative URL `/api/ai/executions/:executionId/confirm-build-apply` |
| Next.js route handler | `frontend\app\api\ai\executions\[executionId]\confirm-build-apply\route.ts` | `POST` | Passes to `proxyConfirmBuildApply` — **not reached on public staging `/api/*`** |
| Server-side proxy | `frontend\lib\build-apply-confirm-proxy.server.ts` (line 131-236) | `proxyConfirmBuildApply` | Next.js-only authenticated proxy to Gateway internal route — **bypassed by Caddy** |

### 4.8 Critical Architectural Difference: Checkpoint vs Confirm (RECONCILED)

| Property | Checkpoint path | Confirm-build-apply path |
|----------|----------------|--------------------------|
| Browser URL | `/api/sessions/:id/checkpoints` | `/api/ai/executions/:id/confirm-build-apply` |
| Public staging routing | Caddy `handle /api/*` → Gateway `:4000` | Caddy `handle /api/*` → Gateway `:4000` |
| Public endpoint existence | YES — Gateway has matching authenticated checkpoint route | NO — public confirm exists only on Next.js `:3002` |
| Gateway internal accounting route | N/A | `POST /api/internal/executions/:id/confirm-build-apply` (INTERNAL_SERVICE_KEY) |
| Why E2E-03 checkpoint succeeded | Public `/api/sessions/*` is a real Gateway route | Public `/api/ai/executions/:id/confirm-build-apply` is not a Gateway route |
| Failure observability | HTTP error propagates to caller | Caught by try/catch, logged to `console.error` only; does not undo apply |
| Retry | No, but errors propagate | No, and errors are silently swallowed |

**This topology difference, now live-proven, explains WHY the automatic checkpoint succeeded while confirm-build-apply never reached `InternalAccountingController.confirmBuildApply`.**

### 4.9 Execution ID Propagation

Direct string propagation through call chain:

```
consumeExecutionFileActions(executionId, source, fileActions)
→ maybeApplyExecutionFileActions(executionId, source)
→ applyExecutionFileActions(executionId, source, executionSessionId, actions)
→ confirmBuildApplyIfQualifying({ executionId, ... })
→ requestBuildApplyConfirmation({ executionId, payload })
```

No intermediate transformation, no lookup, no async boundary where ID could be lost.

### 4.10 Next.js Proxy Failure Points — Status After Evidence

The Next.js proxy chain remains real code, but it is **not the E2E-03 public-path stop point**. Under staging Caddy, the browser request never reaches Next.js, so proxy steps 4–7 were not exercised by E2E-03's public confirmation URL.

| Step | Check | Status after 2026-08-18 evidence |
|------|-------|----------------------------------|
| 1–7 Next.js proxy steps | Auth, payload, INTERNAL_SERVICE_KEY, ownership, internal POST | Not the proven public-path root cause. INTERNAL_SERVICE_KEY hypothesis DISPROVEN. Proxy retained temporarily; not deleted in Step 3. |

---

## 5. Authorized Runtime Evidence Sequence

### Evidence 1 — INTERNAL_SERVICE_KEY hypothesis: DISPROVEN

The exact same frontend OS process that handled E2E-03 was still alive:

| Field | Value |
|-------|-------|
| PM2 frontend PID | 357023 |
| next-server child | 357043 |
| Process start | 2026-08-16T04:41:38.921Z |

It predates E2E-03 and never restarted.

`INTERNAL_SERVICE_KEY` was PRESENT and non-empty in:

- frontend PM2 environment
- frontend OS process
- next-server child
- root `.env`
- Gateway process

Frontend and Gateway key values matched.

```
INTERNAL_SERVICE_KEY_HYPOTHESIS = DISPROVEN
```

Do not retain this as root cause.

### Evidence 2 — Historical reverse-proxy inspection

Caddy terminates `https://staging.ainow.biz`.

Caddy config:

```
handle /api/* {
    reverse_proxy 127.0.0.1:4000
}

handle {
    reverse_proxy 127.0.0.1:3002
}
```

Caddy config predates E2E-03.

Therefore browser `/api/*` traffic is architecturally sent to API Gateway rather than Next.js.

Historical access logs were unavailable at inspection time, so routing was then a strong but not yet live-proven candidate.

### Evidence 3 — First authorized diagnostic POST: INCONCLUSIVE TRANSPORT ATTEMPT

One Python diagnostic POST was authorized.

It failed locally during TLS verification before HTTP.

No staging request occurred.

No retry occurred.

It produced no application mutation and did not prove routing.

Record as an inconclusive transport attempt, not application evidence.

### Evidence 4 — Replacement Schannel diagnostic: LIVE ROUTING PROOF

Keith separately authorized exactly one replacement unauthenticated public confirm-route diagnostic using:

`C:\Windows\System32\curl.exe`

Target:

```
https://staging.ainow.biz/api/ai/executions/ffffffff-ffff-4fff-8fff-ffffffffffff/confirm-build-apply
```

Constraints honored:

- dummy UUID only
- no cookies
- no auth
- no `INTERNAL_SERVICE_KEY`
- no real execution
- no provider
- no credit mutation
- no retry

The request reached staging.

Response:

- HTTP 400
- Headers included `Via: 1.1 Caddy`
- Headers included `X-Powered-By: Express`
- Body was Nest/Express JSON parse failure:

```json
{
  "message": "Expected property name or '}' in JSON at position 1",
  "error": "Bad Request",
  "statusCode": 400
}
```

PowerShell/curl quoting mangled the diagnostic JSON body.

The intended unmatched-route 404 discriminator was not reached because Nest body parsing rejected the body first.

This does **not** weaken the process-routing proof.

```
PUBLIC_CONFIRM_ROUTE_LIVE_TARGET           = API_GATEWAY
PUBLIC_CONFIRM_ROUTE_BYPASSES_NEXTJS       = YES
PUBLIC_CONFIRM_ROUTING_DEFECT_PROVEN       = YES
```

The Next.js route would have checked authentication before parsing this body and returned:

```
HTTP 401
{ "error": "unauthenticated" }
```

It cannot produce the observed Express/Nest parser response.

No second diagnostic request was sent.

---

## 6. Mutation Verification After Diagnostic

| Check | Result |
|-------|--------|
| dummy execution | does not exist |
| dummy credit deductions | 0 |
| dummy projects | 0 |
| dummy sessions | 0 |
| dummy checkpoints | 0 |
| provider calls | 0 |
| runtime/config/source/test mutation | none |

Safety remained:

- `GLOBAL_EXECUTION_ENABLED=false`
- `BILLING_CHARGES_ENABLED=false`
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`

PIDs unchanged:

- Frontend PID: 357023
- Gateway PID: 385202
- Caddy PID: 542

---

## 7. Final Proven Causal Chain

```
ROOT_CAUSE_OF_CONFIRM_FAILURE                 = PROVEN
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN = YES
PUBLIC_CONFIRM_ROUTING_DEFECT_PROVEN          = YES
```

Exact proven root cause:

Public staging Caddy routes all browser `/api/*` to API Gateway. The frontend confirmation call uses `/api/ai/executions/:executionId/confirm-build-apply`, which exists only as a Next.js App Router endpoint. Gateway has no matching public route (its accounting endpoint is internal and service-key protected). The live Schannel diagnostic proves that exact public URL reaches Gateway Express/Nest rather than Next.js. Therefore the browser confirmation request cannot reach the Next.js proxy, Gateway `confirm_build_apply.request_received` stays 0, deferred deduction never runs, and the already-successful workspace apply is not undone because the frontend confirmation path catches/discards non-success.

Causal chain:

1. Successful E2E-03 Build produced one qualifying file action.
2. Workspace apply succeeded.
3. Source path after successful qualifying apply calls `confirmBuildApplyIfQualifying`, which constructs the relative browser URL `/api/ai/executions/:executionId/confirm-build-apply`.
4. Browser requests to staging use `https://staging.ainow.biz/api/...`.
5. Caddy configuration, present before E2E-03, routes ALL `/api/*` to `127.0.0.1:4000` (API Gateway).
6. The public confirmation endpoint exists only as a Next.js App Router endpoint on frontend `:3002`.
7. API Gateway has no matching public `POST /api/ai/executions/:executionId/confirm-build-apply`. Its accounting endpoint is instead internal: `POST /api/internal/executions/:executionId/confirm-build-apply`.
8. The live Schannel diagnostic proves the exact public confirmation URL reaches Gateway Express/Nest rather than Next.js.
9. Therefore the browser confirmation request cannot reach the Next.js proxy under the deployed Caddy topology.
10. A non-success confirmation result is caught/discarded by the frontend confirmation path and does not undo the already-successful workspace apply.
11. E2E-03 consequently showed:
    - workspace apply: SUCCESS
    - automatic checkpoint: SUCCESS
    - `finalize_accounting.build_awaiting_apply`: OBSERVED
    - `confirm_build_apply.request_received`: 0
    - credit deduction: 0
    - balance: 30577 → 30577

This explains all required causal elements.

Narrowest proven stop boundary:

```
PROVEN: qualifying workspace apply succeeded
PROVEN: automatic checkpoint succeeded via public /api/sessions/* on Gateway
PROVEN: frontend constructs POST /api/ai/executions/:executionId/confirm-build-apply
PROVEN: staging Caddy sends all /api/* to API Gateway :4000
PROVEN: that public confirm URL live-reaches Gateway Express/Nest, not Next.js
PROVEN: Gateway has no matching public confirm-build-apply route
PROVEN: API Gateway InternalAccountingController.confirmBuildApply was NOT reached
PROVEN: swallowed confirmation failure cannot undo the already-successful apply
```

---

## 8. 03G Reconciliation

03G remains valid and locked.

03G proved the Next.js confirm route works when addressed directly at `localhost:3002`.

That bypasses Caddy.

03G therefore proved route implementation/rewrite reachability **inside Next.js**, but did not prove the public staging `/api/*` route reaches Next.js.

```
03G_LOCAL_NEXTJS_ROUTE_REACHABILITY_PROVEN     = YES (locked)
03G_PUBLIC_STAGING_API_REACHES_NEXTJS_PROVEN   = NO — and now disproven by 03J live evidence
```

03J exposes the separate public reverse-proxy topology defect. Do not reopen or weaken 03G.

---

## 9. Defect vs Root Cause Separation (UPDATED)

### CONFIRMATION_FAILURE_OBSERVABILITY_DEFECT_PROVEN = YES

Still proven from source. Not the E2E-03 root cause. Must not be bundled into Step 3.

### CONFIRMATION_RESILIENCE_DEFECT_PROVEN = YES

Still proven from source (single fetch, catch/discard, fire-and-forget). Not the E2E-03 root cause. Must not be bundled into Step 3.

### E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN = YES

Proven cause: public reverse-proxy topology sends the frontend's existing `/api/ai/executions/:executionId/confirm-build-apply` URL to API Gateway, which has no matching public route.

### INTERNAL_SERVICE_KEY_HYPOTHESIS = DISPROVEN

Same live frontend process as E2E-03; key present and matching in frontend PM2/OS/next-server, root `.env`, and Gateway.

---

## 10. Candidate-Cause Matrix (UPDATED)

| # | Candidate | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Wrong execution ID at confirmation time | **DISPROVEN** | Direct string propagation from `consumeExecutionFileActions` through to `requestBuildApplyConfirmation`. |
| 2 | Stale closure/state capturing wrong value | **DISPROVEN** | `executionId` is a function parameter; `requestBuildApplyConfirmation` is module-level. |
| 3 | Qualification predicate mismatch for E2E-03 | **DISPROVEN** | E2E-03 1/1 success with `applyStatus: 'applied'` qualifies. |
| 4 | Incorrect successCount / totalActions shape | **DISPROVEN** | Computed directly from apply results. |
| 5 | Apply result consumed/mutated before confirmation | **DISPROVEN** | `applyResult` is a `const` local. |
| 6 | Asynchronous race / timing | **DISPROVEN as root cause** | Page remained active; checkpoint succeeded; routing defect explains missing Gateway internal receive independently of timing. |
| 7 | Cancellation/unmount | **DISPROVEN** | Coherence/checkpoint ran after the same state update. |
| 8 | Request URL error | **DISPROVEN as construction bug** | Relative URL is correct. The URL is the problem only because public `/api/*` is Gateway-terminated. |
| 9 | Wrong HTTP method | **DISPROVEN** | POST is hardcoded; Next.js exports POST; diagnostic also used POST. |
| 10 | Frontend Next.js route mismatch / 03G regression | **DISPROVEN** | 03G proved Next.js local reachability. 03J proves the public path never reaches that Next.js route. |
| 11 | Missing auth cookie propagation (browser → Next.js) | **DISPROVEN as root cause** | Public request never reaches Next.js. |
| 12 | Server-side session/auth lookup failure (proxy step 5) | **DISPROVEN as root cause** | Proxy not reached on public staging `/api/*`. |
| 13 | Execution ownership lookup failure (proxy step 6) | **DISPROVEN as root cause** | Proxy not reached on public staging `/api/*`. |
| 14 | INTERNAL_SERVICE_KEY missing/incorrect in PM2 env (proxy step 4) | **DISPROVEN** | Evidence 1: key present and matching; frontend process predates E2E-03 and never restarted. |
| 15 | Swallowed exception before fetch is called | **DISPROVEN** | No throw site between qualification and `confirmBuildApply`. Swallowed-error remains a post-failure defect, not the routing cause. |
| 16 | useEffect/coherence sequencing causing path divergence | **DISPROVEN** | Confirm and checkpoint are independent paths. |
| 17 | Public Caddy `/api/*` → Gateway topology; no public Gateway confirm route | **PROVEN** | Evidence 2 (Caddy config predating E2E-03) + Evidence 4 (live Schannel POST returned Caddy Via + Express/Nest JSON parser 400, which Next.js cannot produce). |

---

## 11. Root-Cause Fix Architecture (LOCKED)

```
ARCHITECTURE = B
```

Add an authenticated PUBLIC API Gateway endpoint matching the URL already called by the frontend:

```
POST /api/ai/executions/:executionId/confirm-build-apply
```

This route must:

1. use the existing browser/session authentication convention;
2. identify the authenticated user;
3. retrieve/validate the execution;
4. enforce execution ownership before accounting;
5. accept/reuse the existing confirm-build-apply DTO;
6. reuse `UsageLedgerService.triggerBuildApplyDeduction`;
7. preserve all PRIVATE-BETA-BLOCKER-03D semantics;
8. preserve idempotency / exactly-once deduction;
9. leave `POST /api/internal/executions/:id/confirm-build-apply` protected by `INTERNAL_SERVICE_KEY`;
10. not expose `INTERNAL_SERVICE_KEY` to the browser.

### Why Architecture B is correct

The established public convention is `browser /api/* → API Gateway`. The frontend already calls that URL. The live defect is that Gateway lacks the matching public authenticated route. Adding that route restores the handoff without changing Caddy, without moving the frontend URL off `/api`, and without exposing the internal service key to the browser.

### Explicitly rejected root-cause fixes

Do NOT use:

- **A.** Caddy special-case routing to Next.js
- **C.** moving confirmation to a non-`/api` frontend path
- retry as the routing fix
- manual credit mutation
- frontend fake accounting state
- direct browser access to internal accounting
- weakening authentication/ownership checks

### Caddy

```
CADDY_CHANGE_REQUIRED = NO
```

No Caddy configuration change is required for the chosen architecture.

Established convention remains:

```
browser /api/* → API Gateway
```

### Frontend

```
FRONTEND_URL_CHANGE_REQUIRED = NO
```

The existing frontend request URL should remain unchanged:

```
/api/ai/executions/:executionId/confirm-build-apply
```

No user-facing UX change is required.

### Next.js proxy

Retain temporarily during 03J.

Do NOT delete it in the root-cause implementation slice.

Its retirement/simplification may be handled separately after the public Gateway route is proven.

Do not broaden 03J Step 3.

### Retry / observability

```
RETRY_REQUIRED_FOR_ROOT_CAUSE_FIX           = NO
OBSERVABILITY_REQUIRED_FOR_ROOT_CAUSE_FIX   = NO
```

Retry and improved confirmation error observability may be valuable resilience hardening later.

They are NOT part of the proven routing root-cause fix and must not be bundled into Step 3.

The previous recommendation to treat retry + observability as the Step 3 fix is **retracted**.

---

## 12. Step 3 Implementation Boundary

One bounded implementation slice.

No child tasks required.

Do not register child tasks.

Do not register a fresh E2E task here.

Do not register PRIVATE-BETA-INVITE-01.

### Expected primary production file

- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\ai-execution.controller.ts`

### Reuse existing

- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\dto\confirm-build-apply.dto.ts`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\usage-ledger\usage-ledger.service.ts`
- existing session/auth/ownership mechanisms already used by public AI execution routes (`SessionOrApiKeyAuthGuard`, authenticated user identity, execution ownership check as in `getExecution`)

Do not modify accounting semantics unless necessary to expose the already-existing behavior through the correct public authenticated route.

### Expected test files (existing architecture; no new harness family)

Extend / reuse:

- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\ai-execution.controller.spec.ts`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\__tests__\ai-execution.controller.integration.spec.ts`
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\__tests__\internal-accounting.controller.spec.ts` — internal confirm remains service-key protected
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\usage-ledger\__tests__\usage-ledger.service.spec.ts` — 03D accounting-semantics regression surface
- `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\dto\confirm-build-apply.dto.spec.ts` — reuse existing DTO tests; do not reinvent DTO validation

A focused HTTP spec under `C:\Users\knlee\aiSandBox2026B\services\api-gateway\src\ai\__tests__\` may be added only if the existing controller specs cannot cleanly host the required cases. If added, it must use the same Nest testing-module + supertest pattern already used by `internal-accounting.controller.spec.ts`. Do not invent a broad new harness.

### Required Step 3 tests (minimum)

1. unauthenticated request rejected
2. authenticated owner may reach public confirm handler
3. execution belonging to another user is not confirmable
4. nonexistent execution does not deduct
5. `applyStatus != applied` does not deduct
6. zero actions does not deduct
7. successCount mismatch/non-qualifying confirmation does not deduct
8. qualifying success calls the existing deferred deduction path
9. qualifying execution deducts exactly once
10. duplicate confirmation remains idempotent/no double deduction
11. build completion still remains `build_awaiting_apply` before apply confirmation
12. Ask semantics unchanged
13. internal confirm endpoint remains service-key protected
14. existing public AI execution routes do not regress
15. automatic post-apply checkpoint semantics remain unchanged
16. no Stripe/payment charge

### Files explicitly out of Step 3 scope

| File / surface | Why |
|----------------|-----|
| Caddy configuration | Architecture B requires no Caddy change |
| `frontend` confirm request URL | Remain `/api/ai/executions/:executionId/confirm-build-apply` |
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | Retain temporarily; do not delete |
| `frontend/lib/build-apply-confirm-proxy.server.ts` | Retain temporarily; do not delete |
| `frontend/next.config.js` | 03G remains locked; no Caddy-bypass rewrite change |
| `frontend/messages/*.json` | No user-facing UX change |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` | Internal route remains INTERNAL_SERVICE_KEY protected |
| Stripe / payment code | No charge path |
| Retry / observability frontend changes | Not part of the routing root-cause fix |

---

## 13. Step 3 Runtime Boundary

Implementation + local automated tests may proceed after this governance lock.

Do NOT treat Step 3 implementation PASS as private-beta readiness.

After the fix:

- a fresh controlled E2E validation is still REQUIRED
- that fresh E2E task is NOT registered here
- provider/runtime E2E execution will require separate explicit Keith authorization
- do not invoke confirm-build-apply as a product workaround
- do not mutate credits manually
- do not convert E2E-03 into PASS

Safety defaults remain:

- `GLOBAL_EXECUTION_ENABLED=false` by default and outside any explicitly authorized runtime window
- `BILLING_CHARGES_ENABLED=false`
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false`

---

## 14. PRIVATE-BETA-INVITE-01 Prohibition

**PRIVATE-BETA-INVITE-01:** UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED

Do not register it.

---

## 15. Files Expected To Change In This Reconciliation Step

Documentation / governance only:

- `C:\Users\knlee\aiSandBox2026B\docs\PRIVATE-BETA-BLOCKER-03J-STAGE-START.md`
- `C:\Users\knlee\aiSandBox2026B\TASKS.md`
- `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md`

No source/test/runtime mutation in Step 2 reconciliation.

---

## 16. Step 2 Summary Fields

```
STEP_2_STATUS                                      = COMPLETE — ROOT CAUSE PROVEN / LIVE PUBLIC ROUTING DEFECT CONFIRMED — 2026-08-18
ROOT_CAUSE_OF_CONFIRM_FAILURE                      = PROVEN
PUBLIC_CONFIRM_ROUTING_DEFECT_PROVEN               = YES
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN      = YES
PUBLIC_CONFIRM_ROUTE_LIVE_TARGET                   = API_GATEWAY
PUBLIC_CONFIRM_ROUTE_BYPASSES_NEXTJS               = YES
INTERNAL_SERVICE_KEY_HYPOTHESIS                    = DISPROVEN
CONFIRMATION_FAILURE_OBSERVABILITY_DEFECT_PROVEN   = YES (not the root-cause fix)
CONFIRMATION_RESILIENCE_DEFECT_PROVEN              = YES (not the root-cause fix)
03G_STATUS                                         = COMPLETE AND LOCKED — local Next.js reachability only
ARCHITECTURE                                       = B
CADDY_CHANGE_REQUIRED                              = NO
FRONTEND_URL_CHANGE_REQUIRED                       = NO
NEXTJS_PROXY_DISPOSITION                           = RETAIN TEMPORARILY — do not delete in Step 3
RETRY_REQUIRED_FOR_ROOT_CAUSE_FIX                  = NO
OBSERVABILITY_REQUIRED_FOR_ROOT_CAUSE_FIX          = NO
CHILD_SLICE_DECISION                               = NONE — one bounded implementation slice
FRESH_E2E_REQUIRED_AFTER_FIX                       = YES — not registered here
RUNTIME_E2E_AUTHORIZATION_REQUIRED                 = YES — separate explicit Keith authorization
PRIVATE_BETA_INVITE_01                             = UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
STEP_3_READINESS                                   = READY
STEP_3_STATUS                                      = READY — NOT YET IMPLEMENTED
```

---

*Stage-start document evidence-reconciled: 2026-08-18 — PRIVATE-BETA-BLOCKER-03J Step 2 — documentation/governance only — no source/test/runtime/provider/balance/deployment/git mutation.*
