# PRIVATE-BETA-BLOCKER-03J — Stage-Start / Source-Path Investigation Plan (CORRECTED)

**Task ID:** PRIVATE-BETA-BLOCKER-03J
**Title:** Investigate Missing confirm-build-apply Request After Successful Qualifying Workspace Apply
**Step:** Step 2 — Stage Start / Source-Path Investigation Plan
**Status:** COMPLETE — SOURCE PATH NARROWED / FAILURE-HANDLING DEFECT PROVEN — 2026-08-17
**Correction date:** 2026-08-18
**Author:** Cursor / Claude Opus 4.6 (investigation/documentation only — no source/test/runtime modification)

---

## CORRECTION NOTICE

This document has been corrected from its original 2026-08-17 version. The original over-classified the root cause as `ROOT_CAUSE_PROVEN=YES`. The corrected classification is:

```
ROOT_CAUSE_OF_CONFIRM_FAILURE = UNPROVEN
CONFIRMATION_FAILURE_OBSERVABILITY_DEFECT_PROVEN = YES
CONFIRMATION_RESILIENCE_DEFECT_PROVEN = YES
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN = NO
STEP_3_READINESS = BLOCKED_PENDING_EVIDENCE
```

The failure-handling defect is proven from source. The exact runtime cause of E2E-03's missing confirmation request is not proven and cannot be proven from available evidence.

---

## 1. Task Objective

Determine the exact root cause of the missing `confirm-build-apply` request observed during PRIVATE-BETA-E2E-03. The qualifying workspace apply succeeded, automatic checkpoint succeeded, but the expected deferred-deduction confirmation request was never observed at the API Gateway's `InternalAccountingController.confirmBuildApply`.

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

Criterion 10 PASS. Criteria 8/11/12 FAIL. Do not modify or reinterpret these conclusions.

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
| Checkpoint API call | `frontend\components\workspace\workspace-checkpoint-create.logic.ts` (line 35-44) | `createWorkspaceCheckpoint` | POST `/api/sessions/:id/checkpoints` — uses Next.js fallback rewrite (NOT the authenticated proxy) |

### 4.7 Confirm-Build-Apply Invocation (same function, after state update)

| Step | File | Function/Component | Notes |
|------|------|-------------------|-------|
| Invocation | page.tsx (line 5024-5031) | `await confirmBuildApplyIfQualifying(...)` | Called immediately after `setExecutionFileActionState` — no intervening code |
| Qualification check | workspace-ai-file-actions.logic.ts (line 323-350) | `qualifyBuildApplyConfirmation` | `applyStatus === 'applied'` AND `results.length > 0` AND all results `status === 'success'` |
| Invocation gate | workspace-ai-file-actions.logic.ts (line 352-376) | `confirmBuildApplyIfQualifying` | `payload !== null` AND `executionId` is truthy |
| Browser fetch | workspace-ai-file-actions.logic.ts (line 382-400) | `requestBuildApplyConfirmation` | POST to App Router route — default `credentials: 'same-origin'` |
| Next.js route handler | `frontend\app\api\ai\executions\[executionId]\confirm-build-apply\route.ts` | `POST` | Passes to `proxyConfirmBuildApply` |
| Server-side proxy | `frontend\lib\build-apply-confirm-proxy.server.ts` (line 131-236) | `proxyConfirmBuildApply` | Multi-step: validate → session → payload → env key → auth lookup → execution lookup → internal POST |

### 4.8 Critical Architectural Difference: Checkpoint vs Confirm

| Property | Checkpoint path | Confirm-build-apply path |
|----------|----------------|--------------------------|
| URL | `/api/sessions/:id/checkpoints` | `/api/ai/executions/:id/confirm-build-apply` |
| Routing | Next.js fallback rewrite → Gateway directly | Next.js App Router route → server-side proxy → Gateway internal route |
| Auth mechanism | Session cookie forwarded directly by rewrite | Proxy extracts session, does separate auth lookup, adds `INTERNAL_SERVICE_KEY` |
| Depends on `INTERNAL_SERVICE_KEY` | NO | YES |
| Depends on proxy auth lookup | NO | YES |
| Depends on execution ownership lookup | NO | YES |
| Failure observability | HTTP error propagates to caller | Caught by try/catch, logged to console.error only |
| Retry | No, but errors propagate | No, and errors are silently swallowed |

**This difference explains WHY the automatic checkpoint succeeded while the confirm could fail independently.**

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

### 4.10 Proxy Failure Points (in order of execution)

| Step | Check | Failure return | What 03G proved | What E2E-03 proves |
|------|-------|---------------|-----------------|-------------------|
| 1 | `executionId.trim()` non-empty | 400 `invalid_execution_id` | N/A | N/A (source proves ID is valid) |
| 2 | `readSessionTokenFromCookieHeader` returns non-null | 401 `unauthenticated` | N/A | User was authenticated throughout |
| 3 | `parseBuildApplyConfirmationProxyPayload` returns non-null | 400 `malformed_payload` | N/A | Source proves payload is valid |
| 4 | `readInternalServiceKeyFromEnv()` returns non-null | 500 `confirmation_unavailable` | Claimed "key present" (PM2 env inspection) — but NOT exercised at runtime by authenticated confirm | **UNPROVEN** |
| 5 | `GET /api/auth/me` returns 200 with valid userId | 401/502 | NOT tested (03G's probe stopped at step 2) | **UNPROVEN** |
| 6 | `GET /api/ai/executions/:id` returns 200 | 401/404/502 | NOT tested | **UNPROVEN** |
| 7 | `POST /api/internal/executions/:id/confirm-build-apply` with key returns 200 | upstream error code | NOT tested | **UNPROVEN** (this is where `request_received` would be logged) |

---

## 5. Section A — Was Confirmation Invocation Proven at Runtime?

### E2E03_CONFIRM_QUALIFICATION_RUNTIME_PROVEN = NO

**Evidence and reasoning:**

The checkpoint success proves `applyExecutionFileActions` executed past line 5014 (the `setExecutionFileActionState` call that triggers coherence via useEffect). Line 5024 (`await confirmBuildApplyIfQualifying(...)`) is the NEXT statement after line 5014 with NO intervening code, returns, throws, or conditional branching.

In JavaScript, if line 5014 completes without exception and the page remains active, line 5024 WILL execute. The page was active (coherence/checkpoint ran after the state update).

This provides extremely strong INFERENCE (near-certainty from source ordering + checkpoint evidence) that `confirmBuildApplyIfQualifying` was reached. However, there is NO direct runtime observation (no server-side log, no network trace, no client-side telemetry) proving it was actually invoked.

**Evidence limitation:** No runtime instrumentation exists at this code point. The only observable outputs of this function are: (a) a successful confirmation reaching the API Gateway (`request_received` counter), or (b) `console.error` on the client browser (not captured by any server-side logging).

### E2E03_BROWSER_CONFIRM_FETCH_RUNTIME_PROVEN = NO

**Evidence and reasoning:**

For `requestBuildApplyConfirmation` to be invoked, `qualifyBuildApplyConfirmation` must return non-null. For E2E-03's specific parameters (1 action, 1 success, `applyStatus: 'applied'`), the qualification predicate PASSES from source analysis.

Combined with the above, this is a STRONG SOURCE INFERENCE that the browser fetch was initiated. But no runtime observation exists proving the fetch actually fired.

**Evidence limitation:** Same as above — no server-side or network-layer log captures the browser fetch attempt. The only proof would be `request_received > 0` at the Gateway (which is 0) or an observed client-side console.error (which was not captured).

---

## 6. Section B — Narrowest Proven Runtime Stop Boundary

### Proven facts:

1. Workspace apply = SUCCESS (file exists with correct content)
2. `setExecutionFileActionState` was called with `applyStatus: 'applied'` and successful results (proven by: coherence useEffect fired → checkpoint succeeded)
3. Automatic checkpoint = SUCCESS at `2ade268bf4febd41044b26912a9aa8d9c96e3fa0`
4. `confirm_build_apply.request_received` at API Gateway = 0

### Narrowest justified boundary:

```
PROVEN: workspace apply succeeded
PROVEN: setExecutionFileActionState called (line 5014)
STRONGLY INFERRED (not runtime-observed): confirmBuildApplyIfQualifying reached (line 5024)
STRONGLY INFERRED (not runtime-observed): qualifyBuildApplyConfirmation returned non-null
STRONGLY INFERRED (not runtime-observed): requestBuildApplyConfirmation invoked
STRONGLY INFERRED (not runtime-observed): browser fetch() initiated
UNKNOWN: fetch outcome (success/failure/timeout)
UNKNOWN: if Next.js route handler received the request
UNKNOWN: if proxyConfirmBuildApply was invoked
UNKNOWN: which proxy step (4/5/6/7) failed, if proxy was reached
PROVEN: API Gateway InternalAccountingController.confirmBuildApply was NOT reached
```

### Narrowing note:

The stop boundary is somewhere between "browser `fetch()` initiated" and "API Gateway `confirmBuildApply` handler". The exact point of failure within this range is **not determinable** from available evidence.

---

## 7. Section C — Defect vs Root Cause Separation

### CONFIRMATION_FAILURE_OBSERVABILITY_DEFECT_PROVEN = YES

**Evidence:**
- `onConfirmationError` in `confirmBuildApplyIfQualifying` (line 372-374) only calls the provided callback
- The callback at invocation site (page.tsx line 5028-5029) only calls `console.error`
- `console.error` is client-side only — no server-side telemetry, no durable log, no alert
- The proxy (`proxyConfirmBuildApply`) returns structured error responses but these are surfaced only as a thrown Error in `requestBuildApplyConfirmation` (line 397-398) which is then caught and discarded
- There is no way to determine what went wrong after the fact without browser DevTools access at the time of failure

### CONFIRMATION_RESILIENCE_DEFECT_PROVEN = YES

**Evidence:**
- `requestBuildApplyConfirmation` makes exactly ONE fetch attempt (line 386)
- No retry logic exists anywhere in the call chain
- `confirmBuildApplyIfQualifying` catches the error and returns `'confirmation-failed'` (line 374)
- The return value is discarded (caller uses `await` but the parent `applyExecutionFileActions` doesn't use the return value, and the parent is invoked with `void`)
- Any single transient or persistent failure permanently prevents the deduction for that execution

### E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN = NO

**Evidence limitation:**
- No server-side log shows what happened to the confirmation request
- No network trace was captured during E2E-03
- No client-side console output was captured during E2E-03
- The API Gateway counter `request_received = 0` proves the request did NOT arrive, but does NOT identify WHERE it was stopped
- Multiple failure points exist between "browser fetch" and "Gateway handler" (proxy steps 4-7, network, Next.js server error, etc.)
- Without runtime evidence, we cannot distinguish between: transient network error, `INTERNAL_SERVICE_KEY` env var missing after PM2 restart, auth lookup failure, execution lookup failure, or any other proxy failure

---

## 8. Section D — Deterministic Source Bug Re-Inspection

### Candidate-Cause Matrix

| # | Candidate | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Wrong execution ID at confirmation time | **DISPROVEN** | Direct string propagation from `consumeExecutionFileActions` through to `requestBuildApplyConfirmation` — no transformation, no lookup, no async gap. Same ID that successfully applied files. |
| 2 | Stale closure/state capturing wrong value | **DISPROVEN** | `executionId` is a function parameter of `applyExecutionFileActions`, not a closure over mutable state. `requestBuildApplyConfirmation` is a module-level pure function. |
| 3 | Qualification predicate mismatch for E2E-03 | **DISPROVEN** | E2E-03: 1 action, 1 success, `applyStatus: 'applied'`. `qualifyBuildApplyConfirmation` returns `{ applyStatus: 'applied', totalActions: 1, successCount: 1 }` — non-null. Gate passes. |
| 4 | Incorrect successCount / totalActions shape | **DISPROVEN** | Computed directly from `applyResult.results.filter(r => r.status === 'success').length` and `applyResult.results.length`. For 1-element array with 1 success: `successCount=1, totalActions=1`. |
| 5 | Apply result consumed/mutated before confirmation | **DISPROVEN** | `applyResult` is a `const` local variable. `setExecutionFileActionState` receives a new object literal (spread values), does not mutate `applyResult`. |
| 6 | Asynchronous race / timing | **UNPROVEN** | The fire-and-forget `void maybeApplyExecutionFileActions(...)` means the async function runs without supervision. However, the page remained active (checkpoint succeeded). No AbortController exists. No evidence of page navigation between apply and confirm. Timing race is theoretically possible but unlikely given the synchronous progression from line 5014 to 5024. |
| 7 | Cancellation/unmount | **DISPROVEN** | The coherence useEffect fires AFTER the state update and runs the checkpoint successfully, proving the component was still mounted. The confirm runs as a continuation of the same async function, not in a useEffect. No cleanup function could cancel it. |
| 8 | Request URL error | **DISPROVEN** | `buildConfirmBuildApplyRequestUrl` produces `/api/ai/executions/${encodeURIComponent(executionId)}/confirm-build-apply` — tested, correct relative URL. |
| 9 | Wrong HTTP method | **DISPROVEN** | `method: 'POST'` is hardcoded in `requestBuildApplyConfirmation`. Route handler exports `POST`. |
| 10 | Frontend Next.js route mismatch | **DISPROVEN** | 03G fixed the fallback-rewrite interception. Route file exists at `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts`. `fallback` rewrites only apply AFTER filesystem/App Router routes are checked. |
| 11 | Missing auth cookie propagation (browser → Next.js) | **DISPROVEN** | `requestBuildApplyConfirmation` uses `fetch()` without explicit `credentials` option. Browser default for same-origin is `credentials: 'same-origin'`, which includes cookies. The `aisandbox_session` cookie would be included. |
| 12 | Server-side session/auth lookup failure (proxy step 5) | **UNPROVEN** | Proxy calls `GET /api/auth/me` with extracted session cookie. Could fail if: session expired between apply and confirm (unlikely, seconds apart), Redis session store unavailable, Gateway auth endpoint temporarily unavailable. Cannot be proven or disproven from source alone. |
| 13 | Execution ownership lookup failure (proxy step 6) | **UNPROVEN** | Proxy calls `GET /api/ai/executions/:id` with session cookie. Could fail if: execution not yet visible in DB (unlikely — apply already used it), Gateway temporarily unavailable. Cannot be proven or disproven from source alone. |
| 14 | INTERNAL_SERVICE_KEY missing/incorrect in PM2 env (proxy step 4) | **UNPROVEN** | `readInternalServiceKeyFromEnv()` reads `process.env.INTERNAL_SERVICE_KEY`. 03G checkpoint claims "key present in staging env (PM2)" but this was verified at 03G time (2026-08-16). Between 03G and E2E-03, PM2 restarts occurred for 03H/03I deployments. If the restart method did not preserve env vars (e.g., `pm2 restart` without `--update-env` when key is only in ecosystem config), the variable could be absent. **This is the strongest unproven environmental candidate.** |
| 15 | Swallowed exception before fetch is called | **DISPROVEN** | Between `qualifyBuildApplyConfirmation` (pure, cannot throw) and `await args.confirmBuildApply(...)`, there is no code that could throw. The `try` block wraps the entire `confirmBuildApply` call. |
| 16 | useEffect/coherence sequencing causing path divergence | **DISPROVEN** | Coherence runs in a SEPARATE async path (useEffect → `maybeRunExecutionCoherence`). The confirm runs in the SAME async function (`applyExecutionFileActions`). They are independent — coherence cannot prevent, cancel, or interfere with confirm. |

### Summary of unproven candidates:

- **#6 (async race):** Theoretically possible but evidence strongly suggests no — page was active, no abort mechanism exists.
- **#12 (auth lookup failure):** Plausible transient failure but no evidence for or against.
- **#13 (execution ownership lookup failure):** Plausible transient failure but no evidence for or against.
- **#14 (INTERNAL_SERVICE_KEY missing after PM2 restart):** Strongest candidate — environmental, not provable from source, not exercised by 03G's unauthenticated probe.

---

## 9. Section E — 03G Authenticated-Path Limitation

### What 03G actually proved:

03G deployed the `next.config.js` fallback-rewrite fix and performed a runtime probe:

```
POST /api/ai/executions/test-probe-03g/confirm-build-apply
(unauthenticated — no session cookie)
→ HTTP 401 from Next.js route handler
```

This proves:
- The App Router route file IS resolved (not intercepted by fallback rewrite)
- The route handler IS invoked
- `proxyConfirmBuildApply` IS called
- `readSessionTokenFromCookieHeader` correctly returns null for missing cookie
- Proxy correctly returns 401 at step 2

### What 03G did NOT prove:

The unauthenticated probe stops at proxy step 2 (session cookie check). It does NOT exercise:

| Proxy step | Description | 03G tested? | Unit tested? |
|------------|-------------|-------------|--------------|
| 4 | `readInternalServiceKeyFromEnv()` returns non-null | NO (stopped at step 2) | YES (mock) |
| 5 | `GET /api/auth/me` succeeds with valid session | NO | YES (mock) |
| 6 | `GET /api/ai/executions/:id` succeeds | NO | YES (mock) |
| 7 | `POST /api/internal/.../confirm-build-apply` with real key | NO | YES (mock) |

### Integration proof status:

**Individual unit tests exist for every proxy step** (`build-apply-confirm-proxy.server.test.ts` — 11 tests). Each test uses mocked `fetchImpl` to verify the proxy's branching logic.

**No integration test exists** that proves the ASSEMBLED path works with:
- A real `INTERNAL_SERVICE_KEY` from the PM2 environment
- A real authenticated session cookie
- A real Gateway `/api/auth/me` response
- A real Gateway `/api/ai/executions/:id` response
- A real Gateway `/api/internal/.../confirm-build-apply` handler

**03G's probe is the closest thing to an integration test**, but it only proved steps 1-2 of the proxy, not 4-7.

---

## 10. Section F — Reassessed Implementation Proposal

### Previous proposal (RETRACTED):

"Add retry to `confirmBuildApplyIfQualifying`" — this was proposed as the sole fix based on `ROOT_CAUSE_PROVEN=YES`. This is retracted because:

1. Retry does NOT fix deterministic failures (missing env var, wrong key, persistent auth failure).
2. Without knowing whether E2E-03's failure was transient or persistent, proposing retry as the complete fix is not justified.
3. Even if retry IS eventually needed, it should not be the FIRST step when the exact failure is unknown.

### Correct minimal next step:

**Option 1 (RECOMMENDED): Bounded observability instrumentation + diagnostic validation**

Add server-side logging to the proxy so that future failures are diagnosable, then perform a controlled authenticated non-provider diagnostic to verify the full proxy chain works:

1. **Observability instrumentation (source change):**
   - Add structured `console.log` (or existing logger) at the ENTRY and EXIT points of `proxyConfirmBuildApply` — logging the result status (not secrets, not session tokens)
   - This makes the proxy step that fails identifiable in PM2 logs

2. **Diagnostic validation (runtime, requires Keith authorization):**
   - A targeted authenticated `POST` to `/api/ai/executions/<existing-execution-id>/confirm-build-apply` using a real session cookie and verifying `request_received` increments
   - This does NOT require a provider call (no AI execution, no credits consumed by the provider)
   - It DOES trigger the deduction path — but can use an already-completed execution that is already in `build_awaiting_apply` state, OR a purpose-built diagnostic with `PersistentCreditDeductionGateway` idempotency protecting against double-deduction
   - If this succeeds: the proxy chain is functional and E2E-03's failure was transient → retry is the correct fix
   - If this fails: the proxy chain has a persistent defect → the failure point is now identifiable from the new logs

**Option 2 (ALTERNATIVE): Source-only deterministic bug proof**

If a deterministic source bug can be identified without runtime evidence, no diagnostic is needed. The candidate matrix (section 8) shows NO deterministic source bug is PROVEN. All strong candidates (#12, #13, #14) are environmental/runtime.

**Option 3 (FALLBACK): Add retry + observability together**

If Keith authorizes implementation without diagnostic validation, the safest combined approach is:
- Add retry (covers transient failures)
- Add server-side observability (makes persistent failures diagnosable)
- Deploy and run a fresh E2E

This is less rigorous than Option 1 because it does not first prove whether the failure is transient or persistent, but it is pragmatically viable.

### Whether retry alone is sufficient:

**NO.** Retry alone is sufficient ONLY if the E2E-03 failure was proven transient. Since it is UNPROVEN, retry might not fix the underlying issue. Retry + observability is the minimum viable combination.

### Whether runtime evidence is required:

**YES** — to prove the exact E2E-03 root cause.

**NO** — if Keith authorizes a pragmatic fix (retry + observability) without full root-cause proof.

### What runtime evidence would prove:

1. **Authenticated confirm-build-apply diagnostic** (non-provider):
   - Must observe: the request reaches `InternalAccountingController.confirmBuildApply` (`request_received` increments)
   - If fails: PM2 logs (with new observability) identify which proxy step failed
   - Does NOT require provider/AI execution: uses an existing completed execution ID
   - DOES potentially trigger a credit deduction (must use idempotent replay of already-confirmed execution, or accept the deduction)
   - Keith authorization required: explicit approval to run a non-provider diagnostic that touches the confirm path on staging

2. **Alternatively: PM2 env var inspection** (read-only):
   - Verify `INTERNAL_SERVICE_KEY` is present and matches between frontend and api-gateway PM2 processes
   - This alone cannot prove the FULL chain works but can confirm/eliminate the strongest environmental candidate (#14)

### Whether provider replay is required:

**NO.** A provider replay (full AI Build execution) is not required to diagnose the confirmation path. The confirm-build-apply endpoint can be tested independently with an existing execution ID.

---

## 11. Child-Slice Reassessment

### Previous decision (RETRACTED):

"Single bounded implementation slice — add retry" — retracted because the exact root cause is unproven.

### Corrected assessment:

If Keith authorizes the pragmatic combined approach (Option 3):
- **Single slice** is viable: add retry + add server-side proxy observability in one bounded change
- No child-slice split is strictly required

If Keith requires full root-cause proof first (Option 1):
- **Two sequential slices** are natural:
  - Slice A: Add proxy observability instrumentation + perform diagnostic validation
  - Slice B: Fix the identified root cause (which may or may not be "add retry")
- These should NOT be pre-registered as formal child tasks until Keith decides the approach

### Decision:

**Child-slice registration: DEFERRED pending Keith's decision on approach (Option 1 vs Option 3).**

---

## 12. Hypotheses Tested (CORRECTED)

| ID | Hypothesis | Result | Evidence |
|----|-----------|--------|----------|
| A | confirm-build-apply invocation is in the exact UI flow used by E2E-03 | **CONFIRMED from source** | `confirmBuildApplyIfQualifying` is called inside `applyExecutionFileActions` (page.tsx line 5024) — same function that writes files |
| B | invocation depends on a result/status shape that E2E-03 may not have produced | **DISPROVEN** | qualification uses `applyResult` directly from `applySequentialFileActions`, not execution status; E2E-03's 1/1 success passes |
| C | invocation is in a different code path than automatic checkpoint | **CONFIRMED from source** | confirm is in `applyExecutionFileActions` (fire-and-forget); checkpoint is in `maybeRunExecutionCoherence` (React useEffect) — completely different routing and auth mechanisms |
| D | automatic checkpoint can succeed even if confirm-build-apply is skipped/fails | **CONFIRMED from source** | checkpoint uses fallback rewrite (no INTERNAL_SERVICE_KEY, no proxy); confirm uses App Router + multi-step proxy |
| E | execution ID can be lost/stale/undefined between Build completion and apply confirmation | **DISPROVEN** | direct string propagation through synchronous call chain |
| F | a frontend early return can bypass confirmation after successful apply | **DISPROVEN** | no code between `setExecutionFileActionState` and `confirmBuildApplyIfQualifying` in `applyExecutionFileActions` |
| G | confirmation errors are swallowed before request transmission | **CONFIRMED (DEFECT) but NOT root cause** | `onConfirmationError` only calls `console.error` (client-side). No retry. No server-side trace. This is a proven DEFECT but does not identify WHY the error occurred. |
| H | frontend deployment/source mismatch could explain request count 0 | **DISPROVEN** | git diff shows zero differences for all confirm-path files |
| I | API route/path/method mismatch remains possible despite 03G | **DISPROVEN** | 03G proved route reachability; no source change occurred since |
| J | another deterministic source condition explains the missing request | **UNPROVEN** | No deterministic source bug found. Remaining candidates are environmental (#14 INTERNAL_SERVICE_KEY) or transient (#12, #13). |

---

## 13. Root-Cause Conclusion (CORRECTED)

**ROOT_CAUSE_OF_CONFIRM_FAILURE = UNPROVEN**

**What IS proven:**

1. A failure-handling DEFECT exists: the confirmation path has zero retry, zero server-side observability, and fire-and-forget invocation. Any single failure (transient OR persistent) permanently prevents the deduction.
2. The checkpoint succeeds independently because it uses a fundamentally different path (fallback rewrite, no proxy, no INTERNAL_SERVICE_KEY).
3. No deterministic source BUG has been identified that would always prevent confirmation.
4. The source logic IS correct for E2E-03's specific parameters.

**What is NOT proven:**

The exact runtime failure that caused E2E-03's `request_received = 0`. The evidence establishes that the request was stopped somewhere between "browser fetch initiated" and "API Gateway handler", but the specific proxy step (or pre-proxy failure) that failed cannot be identified from available evidence.

**Why the original ROOT_CAUSE_PROVEN=YES was incorrect:**

The proof standard requires explaining WHY `confirm-build-apply` did not reach the API Gateway (condition #3). The defect explains WHAT HAPPENS when the request fails (it's silently lost), but does not explain WHAT CAUSED the request to fail. "Any of five proxy failure points could have triggered" is a failure-mode enumeration, not a proven causal chain.

---

## 14. Step 3 Readiness Decision (CORRECTED)

**STEP_3_READINESS = BLOCKED_PENDING_EVIDENCE**

Step 3 (implementation) cannot be authorized to merely "add retry" because:
1. The exact failure may be persistent/deterministic (e.g., missing INTERNAL_SERVICE_KEY), in which case retry does not fix it
2. Without observability, even after adding retry, future failures would remain invisible
3. The correct implementation depends on whether the failure is transient or persistent

Step 3 becomes READY when ONE of:
- Keith authorizes the pragmatic combined fix (retry + observability) without full root-cause proof
- A diagnostic validation identifies the exact failure point, enabling a targeted fix
- A deterministic source bug is found that explains E2E-03

---

## 15. Files Expected to Change (REVISED)

Depends on the approach Keith authorizes. If Option 3 (retry + observability):

| File | Change |
|------|--------|
| `frontend\components\workspace\workspace-ai-file-actions.logic.ts` | Add retry to `confirmBuildApplyIfQualifying` or `requestBuildApplyConfirmation` |
| `frontend\lib\build-apply-confirm-proxy.server.ts` | Add structured server-side logging at proxy entry/exit points |

If Option 1 (observability first, then targeted fix):

| File | Change (Slice A) |
|------|--------|
| `frontend\lib\build-apply-confirm-proxy.server.ts` | Add structured server-side logging |

Slice B depends on diagnostic results.

---

## 16. Files Explicitly Out of Scope

| File | Why |
|------|-----|
| `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` | Route handler is correct |
| `frontend/next.config.js` | 03G fix is active, no regression |
| `services/api-gateway/src/ai/internal-accounting.controller.ts` | Controller is correct |
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | Deduction logic is correct |
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` | Guard logic is correct |
| `frontend/messages/*.json` | No user-facing text change anticipated |

---

## 17. Runtime Validation Requirements

After any implementation:
1. `npm test` — all existing + new tests pass
2. `npx tsc --noEmit` — typecheck passes
3. `npm run build` — production build succeeds
4. Verify `tsconfig.tsbuildinfo` not unexpectedly modified

A fresh post-fix E2E validation (separate task) is REQUIRED before Builder private-beta readiness can return to GO.

---

## 18. PRIVATE-BETA-INVITE-01 Prohibition

**PRIVATE-BETA-INVITE-01:** UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED

---

## 19. Step 2 Summary Fields

```
STEP_2_STATUS                                      = COMPLETE — SOURCE PATH NARROWED / FAILURE-HANDLING DEFECT PROVEN
ROOT_CAUSE_OF_CONFIRM_FAILURE                      = UNPROVEN
CONFIRMATION_FAILURE_OBSERVABILITY_DEFECT_PROVEN   = YES
CONFIRMATION_RESILIENCE_DEFECT_PROVEN              = YES
E2E03_EXACT_CONFIRM_FAILURE_ROOT_CAUSE_PROVEN      = NO
E2E03_CONFIRM_QUALIFICATION_RUNTIME_PROVEN         = NO (strongly inferred from source + checkpoint, not directly observed)
E2E03_BROWSER_CONFIRM_FETCH_RUNTIME_PROVEN         = NO (strongly inferred, not directly observed)
NARROWEST_PROVEN_STOP_BOUNDARY                     = between "setExecutionFileActionState completed" and "API Gateway handler"
DETERMINISTIC_SOURCE_BUG_FOUND                     = NO
STRONGEST_UNPROVEN_CANDIDATE                       = INTERNAL_SERVICE_KEY env var availability after PM2 restart (#14)
03G_AUTHENTICATED_PATH_PROVEN                      = NO (03G only proved unauthenticated probe to step 2)
RETRY_ALONE_SUFFICIENT                             = NO (not proven — failure may be persistent)
PROVIDER_REPLAY_REQUIRED                           = NO
RUNTIME_EVIDENCE_REQUIRED_FOR_PROOF                = YES
CHILD_SLICE_DECISION                               = DEFERRED pending Keith approach decision
STEP_3_READINESS                                   = BLOCKED_PENDING_EVIDENCE
```

---

*Stage-start document corrected: 2026-08-18 — PRIVATE-BETA-BLOCKER-03J Step 2 — investigation/documentation only — no source/test/runtime/provider/balance/deployment mutation.*
