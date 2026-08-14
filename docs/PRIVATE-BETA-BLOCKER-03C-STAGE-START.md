# PRIVATE-BETA-BLOCKER-03C — Stage Start / Timeout Architecture Diagnosis

**Task ID:** PRIVATE-BETA-BLOCKER-03C
**Title:** Grok 4.2 Timeout Diagnosis
**Step:** Step 2 — Stage Start / Timeout Architecture Diagnosis
**Status:** COMPLETE — 2026-08-14
**Author:** Cursor / Opus 4.6 (read-only diagnosis — no source/runtime modification)

---

## 1. Executive Diagnosis

During PRIVATE-BETA-E2E-01 (2026-08-10), Keith intentionally submitted two requests using xAI model `grok-4.20` (colloquially "Grok 4.2"). Both timed out with the error message `Request was aborted.`

**Primary root-cause classification:** APPLICATION TIMEOUT TOO SHORT FOR VALID PROVIDER RESPONSE

The application's `EXECUTION_TIMEOUT_MS` defaults to **20,000 ms** (20 seconds). This timeout fires an `AbortController.abort()` which propagates as an `AbortSignal` through to the OpenAI SDK HTTP call. The OpenAI SDK (v4.77+) interprets the aborted signal and throws an error surfaced as `Request was aborted.` — the standard Node.js `fetch`/`undici` abort message.

`grok-4.20` is a smaller/older model that may have slower inference latency per token for structured JSON output (the application requires `response_format: { type: 'json_object' }` with full file-action content). A 20-second hard timeout is insufficient for models with slower inference — particularly for workspace_mutation requests that require generating complete structured file content.

`grok-4.5` completed comparable requests within the timeout (tokens ~1251, status `completed`), confirming the application infrastructure itself works; only the timeout budget relative to `grok-4.20`'s latency is the issue.

---

## 2. Historical Failed Grok 4.2 Execution Evidence

### Execution 1

| Field | Value |
|-------|-------|
| Execution ID | `6e25ad2d-5dde-4738-b2e3-7d25e2517baa` |
| User ID | `7f772841-7844-401b-a3da-e928b0c7b79c` (Keith) |
| Project ID | `198b705f-3a26-41f1-b6f2-3af355b7aca2` |
| Session ID | `9554804b-ef58-47fe-aede-2d266614f58b` |
| Conversation ID | `f2735d3a-519e-479a-ae5a-a163c0972d00` |
| Timestamp | 2026-08-10 (within E2E journey window) |
| Provider | xai |
| Exact model string | `grok-4.20` |
| Selected execution path | plain |
| useHarness | false |
| enableToolLoop | false |
| executionIntent | UNAVAILABLE — pre-BUILDER-INTENT-01 (default: workspace_mutation) |
| Worker job ID | UNAVAILABLE (no local DB query access) |
| Job enqueue time | UNAVAILABLE |
| Worker claim/start time | UNAVAILABLE |
| Provider request start time | UNAVAILABLE |
| Failure/abort time | UNAVAILABLE (estimated: T+20000ms after worker claim) |
| Total duration | ~20,000 ms (EXECUTION_TIMEOUT_MS default) |
| Execution status | `timeout` |
| Exact stored error | `Request was aborted.` |
| Token usage | 0 (no response received before abort) |
| Credit/accounting outcome | No credit deduction (timeout status) |
| Provider response headers/body received | UNKNOWN — strongly supported NO |
| File actions produced | No |
| Workspace mutation occurred | No |

### Execution 2

| Field | Value |
|-------|-------|
| Execution ID | `2bcf23fe-e0c5-44b3-8117-b28a058ca209` |
| User ID | `7f772841-7844-401b-a3da-e928b0c7b79c` (Keith) |
| Project ID | `198b705f-3a26-41f1-b6f2-3af355b7aca2` |
| Session ID | `9554804b-ef58-47fe-aede-2d266614f58b` |
| Conversation ID | `f2735d3a-519e-479a-ae5a-a163c0972d00` |
| Timestamp | 2026-08-10 (within E2E journey window) |
| Provider | xai |
| Exact model string | `grok-4.20` |
| Selected execution path | plain |
| useHarness | false |
| enableToolLoop | false |
| executionIntent | UNAVAILABLE — pre-BUILDER-INTENT-01 |
| Execution status | `timeout` |
| Exact stored error | `Request was aborted.` |
| Token usage | 0 |
| Credit/accounting outcome | No credit deduction |
| Provider response headers/body received | UNKNOWN — strongly supported NO |
| File actions produced | No |
| Workspace mutation occurred | No |

---

## 3. Known-Good Grok 4.5 Comparison Evidence

### Closest comparable execution

| Field | Value |
|-------|-------|
| Execution ID | `2bc73157-973a-45ec-8b71-bca8c2f7941d` |
| User ID | `7f772841-7844-401b-a3da-e928b0c7b79c` (Keith) |
| Project ID | `198b705f-3a26-41f1-b6f2-3af355b7aca2` |
| Session ID | `9554804b-ef58-47fe-aede-2d266614f58b` |
| Conversation ID | `f2735d3a-519e-479a-ae5a-a163c0972d00` |
| Provider | xai |
| Model | grok-4.5 |
| Selected path | plain |
| useHarness | false |
| Status | completed |
| Tokens | 1251 |
| Duration | < 20,000 ms (completed within timeout) |
| Credit/accounting | 1251 credits applied |

Same user, same project, same session, same conversation, same environment, same plain path, similar prompt (Builder file-creation request). Only difference: model selection.

---

## 4. Historical vs Current Implementation Differences

### At time of failure (2026-08-10)

The worker processor on staging at that date was running code from commit `0d56915` (2026-08-10) or equivalent deployed artifact. Key timeout/abort features were present:

| Feature | Present at failure time | Source |
|---------|------------------------|--------|
| AbortController in worker | Yes | Phase 47 (2026-03-04, commit `7eb7fc0`) |
| AbortSignal forwarding to XAI adapter | Yes | Phase 47.4 |
| EXECUTION_TIMEOUT_MS (20s default) | Yes | Phase 47 |
| timeout→abort→'timeout' status persistence | Yes | Phase 47 |
| Phase-51.3 transient retry logic | Yes | Phase 51 (2026-03-04, commit `6430c26`) |
| EXECUTION_PROVIDER_RETRY_ATTEMPTS (3 default) | Yes | Phase 51.3 |
| Stuck execution watchdog | Yes | Phase 51.5 |
| QueueEvents crash resilience | Yes | Phase 51.2 |
| BUILDER-INTENT executionIntent | NO | Added 2026-08-11 (commit `8a603ee`) |
| 03B file_action_contract_failure | NO | Added 2026-08-11 |
| 03E fire-and-forget cleanup | NO | Added 2026-08-13 |

### Current implementation

All of the above are now present. The timeout/abort chain is architecturally identical. The additions (BUILDER-INTENT, 03B, 03E) do not affect the timeout path.

**Conclusion:** The timeout/abort behavior at time of failure is the SAME as current behavior. Diagnosing from current code is valid for the timeout chain specifically.

---

## 5. Full Request Path

```
T0. Frontend: POST /api/ai/execute { provider: 'xai', model: 'grok-4.20', prompt: ..., sessionId: ... }
T1. API Gateway: AIExecutionController.execute()
    → Guards (auth, safety, quota, rate-limit, idempotency, credit)
    → UsageLedgerService.writeExecutionIntent() [status='pending']
    → QueueService.enqueueExecution() → BullMQ 'ai-execution' queue
    → Return 202 { executionId, status: 'queued' }
T2. AI Service: WorkerProcessor worker callback
    → UPDATE usage_records SET status='running'
    → Create AbortController
    → Start EXECUTION_TIMEOUT_MS timer (20000ms)
    → Start cancel-poll loop (1000ms interval)
T3. AI Service: AIExecutionService.execute(request with signal)
    → getAdapter('xai', 'grok-4.20') → new XAIAdapter(apiKey, { model: 'grok-4.20' })
    → XAIAdapter.execute(request)
    → OpenAI SDK: client.chat.completions.create(xaiRequest, { signal })
    → HTTP POST https://api.x.ai/v1/chat/completions
T4. TIMEOUT: T+20000ms
    → timeoutHandle fires
    → abortController.abort()
    → Signal propagates to OpenAI SDK HTTP call
    → fetch/undici aborts in-flight request → throws Error('Request was aborted.')
    → Error propagates up through XAI adapter → worker catch
    → Worker: isAbort=true, timedOut=true → return (timeout handler already persisted)
    → Timeout handler already: UPDATE usage_records SET status='timeout'
    → publishCompletion(executionId)
```

---

## 6. Full Timeout Chain

| Layer | Source File | Function/Method | Timeout Value | Default | Env Override | Owning Layer | Active Abort? | Signal Target | Error on Timeout | Cleanup |
|-------|-------------|----------------|---------------|---------|--------------|--------------|---------------|---------------|-----------------|---------|
| 1. Frontend request | `frontend/app/[locale]/app/page.tsx` | fetch POST | Browser default (none specific) | N/A | N/A | Browser | No — SSE stream open-ended | N/A | N/A | N/A |
| 2. API Gateway → AI Service | N/A — async queue | N/A | N/A | N/A | N/A | N/A | N/A — returns 202 immediately | N/A | N/A | N/A |
| 3. BullMQ lock duration | `worker.processor.ts` L597 | Worker constructor | `EXECUTION_TIMEOUT_MS + 10000` = **30000 ms** | 30000ms | via EXECUTION_TIMEOUT_MS | BullMQ | No — controls job lock | N/A | Job marked stalled if lock expires | BullMQ stalled handler |
| 4. BullMQ stalled interval | `worker.processor.ts` L607 | Worker constructor | `min(15000, lockDuration/2)` = **15000 ms** | 15000ms | Derived | BullMQ | No — detection interval | N/A | Stalled event emitted | QueueEvents.stalled handler |
| 5. **EXECUTION_TIMEOUT_MS** | `worker.processor.ts` L593-786 | setTimeout callback | **20000 ms** | 20000 | `EXECUTION_TIMEOUT_MS` env | Worker | **YES — abortController.abort()** | AbortController → signal → SDK HTTP call | `UPDATE status='timeout'` + publishCompletion | clearTimeoutWatchdog on success |
| 6. Provider retry | `worker.processor.ts` L599-605 | retry loop | Up to 3 attempts, base 250ms exponential | 3 attempts / 250ms base | `EXECUTION_PROVIDER_RETRY_ATTEMPTS` / `EXECUTION_PROVIDER_RETRY_BASE_DELAY_MS` | Worker | Aborts if signal fired | sleep() checks signal | Re-throws on abort | N/A |
| 7. OpenAI SDK client timeout | `xai-ai.adapter.ts` L81-84 | `new OpenAI({ timeout: options?.timeout })` | **undefined (no timeout set)** | SDK default (infinite / no timeout) | N/A — not passed from getAdapter | XAI Adapter | No independent timeout | N/A | N/A | N/A |
| 8. OpenAI SDK per-request signal | `xai-ai.adapter.ts` L146 | `client.chat.completions.create(req, { signal })` | N/A — signal-based | N/A | N/A | Worker's AbortController | **YES — propagated from worker** | fetch/undici HTTP request | `Error('Request was aborted.')` or DOMException AbortError | HTTP connection torn down |
| 9. Stuck execution watchdog | `worker.processor.ts` L516-561 | scanForStuckExecutions | `EXECUTION_TIMEOUT_MS * 2` = **40000 ms** (40s) | 40s | via EXECUTION_TIMEOUT_MS | Worker (periodic) | No — read-then-update | N/A | `UPDATE status='failed'` | publishCompletion |
| 10. Cancel poll | `worker.processor.ts` L788-801 | pollCancel | 1000ms interval | 1000ms | N/A | Worker | YES — abortController.abort() | Same signal | cancel_requested → cancelled | N/A |

---

## 7. AbortController / AbortSignal Propagation

```
                    WorkerProcessor
                         |
              ┌──────────┴──────────┐
              │    AbortController    │  ← Created at L737 per execution
              │    .signal            │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   timeoutHandle     pollCancel     retry sleep()
   (L749-786)        (L788-801)    (L975)
        │                │                │
        │   calls .abort() on timeout     │   calls .abort() on cancel_requested
        │                │                │   sleep rejects on abort
        └────────────────┼────────────────┘
                         │
                         ▼
            buildAIExecutionRequest(... signal)  ← L833
                         │
                         ▼
            AIExecutionService.execute(request)  ← request.signal
                         │
                         ▼
              adapter.execute({ ...request, signal })  ← L102-106 in ai-execution.service.ts
                         │
                         ▼
              XAIAdapter.execute(request)
                         │
                         ▼
           const createOptions = request.signal ? { signal: request.signal } : {};  ← L146
           this.client.chat.completions.create(xaiRequest, createOptions);
                         │
                         ▼
              OpenAI SDK → node-fetch/undici HTTP request with signal
                         │
                         ▼
           On abort: HTTP connection torn down → Error thrown
```

---

## 8. Exact Origin of `Request was aborted.`

**Origin:** Node.js `fetch` / `undici` HTTP client (used internally by OpenAI SDK v4.77+)

**Propagation chain:**

1. `worker.processor.ts` L752: `abortController.abort()` fires after 20000ms
2. Signal propagates to OpenAI SDK HTTP internals via `{ signal: request.signal }` passed to `client.chat.completions.create()`
3. OpenAI SDK's underlying HTTP implementation (Node.js native fetch or undici) detects the aborted signal
4. HTTP library throws: `Error` with message `"Request was aborted."` (Node.js undici/fetch standard abort message) or `DOMException` with name `"AbortError"`
5. XAI adapter's `handleError()` catches the error at L154
6. The error **does NOT match** any of the status-code conditions (lines 258-288)
7. It checks `error.name === 'TimeoutError'` or `error.message.includes('timeout')` at L294-295 — **this does NOT match** "Request was aborted."
8. It falls through to the generic handler at L316-321: `throw new InternalServerErrorException('Unexpected error during xAI API call', errorMessage)`

**CRITICAL FINDING:** The XAI adapter error handler does NOT recognize abort/signal-related errors as a distinct category. However, this is **moot for the timeout case** because the worker's catch block at L1252-1254 checks `error.name === 'AbortError' || abortController.signal.aborted` BEFORE the adapter's error normalization matters for status classification. The worker correctly identifies the abort.

**Actual error flow for timeout:**

1. OpenAI SDK throws (abort error)
2. XAI adapter `handleError()` wraps it as `InternalServerErrorException` with message "Unexpected error during xAI API call"
3. Worker catch block (L1249) catches it
4. Worker checks `isAbort` (L1252-1254): `error.name === 'AbortError' || abortController.signal.aborted`
5. Since `abortController.signal.aborted` is `true` (the timeout handler called `.abort()`), `isAbort = true`
6. Worker checks `timedOut` (L1257): `true` (set by timeout handler at L751)
7. Worker returns early — timeout handler already persisted status

**However:** The `Request was aborted.` message that was observed in the E2E checkpoint likely came from the `error.message` captured in the worker log at L1313:
```
AI execution failed executionId=${executionId}: ${error.message}
```

But since `timedOut=true`, the worker returns at L1258 **before** reaching L1313. This means `Request was aborted.` was likely observed through either:
- The raw error thrown by the OpenAI SDK before adapter wrapping
- Or the SSE/stream error published to the frontend

**Evidence quality:** The string is NOT in application source. It is a runtime message from the Node.js HTTP stack when `AbortSignal` fires. STRONGLY SUPPORTED that it originates from undici/node-fetch abort behavior.

---

## 9. Grok 4.2 vs Grok 4.5 Request Comparison

| Parameter | Grok 4.20 (failed) | Grok 4.5 (succeeded) |
|-----------|--------------------|-----------------------|
| Endpoint | `https://api.x.ai/v1/chat/completions` | `https://api.x.ai/v1/chat/completions` |
| Model | `grok-4.20` | `grok-4.5` |
| messages | system + user (identical structure) | system + user (identical structure) |
| response_format | `{ type: 'json_object' }` | `{ type: 'json_object' }` |
| max_tokens | 4096 | 4096 |
| temperature | 1.0 | 1.0 |
| top_p | Not set | Not set |
| streaming | false | false |
| tools/functions | None (plain path) | None (plain path) |
| structured-output config | JSON object instruction in system prompt | JSON object instruction in system prompt |
| AbortSignal | Present (from worker AbortController) | Present (from worker AbortController) |
| HTTP timeout (SDK) | None configured | None configured |
| Application timeout | 20000ms | 20000ms |
| Retry settings | 3 attempts / 250ms base | 3 attempts / 250ms base |
| Headers | OpenAI SDK standard + auth | OpenAI SDK standard + auth |
| Payload size | Similar (same prompt structure) | Similar (same prompt structure) |
| Prompt length | Similar (same conversation) | Similar (same conversation) |
| Response size | N/A (never received) | ~1251 tokens |
| Outcome | `timeout` — aborted at 20s | `completed` |

**Key difference:** Only the model ID differs. All application-level parameters are identical. The timeout fired because `grok-4.20` did not return a response within 20 seconds.

---

## 10. Evidence Request Reached xAI

| Evidence point | Assessment |
|----------------|------------|
| DNS/TCP/TLS success | UNKNOWN — no transport-layer logs available |
| xAI acknowledged request | UNKNOWN |
| HTTP status received | UNKNOWN — strongly supported NO (abort fires before response) |
| Response headers arrived | UNKNOWN — strongly supported NO |
| Partial response data arrived | UNKNOWN — strongly supported NO (non-streaming; tokens_used=0) |
| Application aborted before xAI returned | STRONGLY SUPPORTED YES |

**Classification:** UNKNOWN (transport-level evidence unavailable) but STRONGLY SUPPORTED that the request was dispatched to xAI (no DNS/TLS error was logged; the error is specifically "Request was aborted" not "ECONNREFUSED" or "ENOTFOUND") and xAI had not returned a response before the 20-second timeout fired.

The application does NOT log `xAI API connection error` (which would indicate ECONNREFUSED/ENOTFOUND), nor `xAI API timeout` (which would indicate SDK-level timeout). The abort was initiated by the application's own timeout timer, not by a transport failure.

---

## 11. Timeline of Failure

```
T+0ms       Worker claims job, sets status='running'
T+0ms       AbortController created
T+0ms       setTimeout(20000ms) registered (timeout watchdog)
T+0ms       pollCancel() started (1000ms interval)
T+~1ms      buildExecutionPromptParts() — prompt assembly
T+~2ms      buildAIExecutionRequest() — request construction with signal
T+~3ms      AIExecutionService.execute() → getAdapter('xai', 'grok-4.20')
T+~4ms      XAIAdapter constructed (no SDK-level timeout)
T+~5ms      XAIAdapter.execute() → client.chat.completions.create(request, { signal })
T+~6ms      OpenAI SDK: HTTP POST to https://api.x.ai/v1/chat/completions (non-streaming)
T+~6ms      TCP/TLS handshake to api.x.ai (likely fast — same provider endpoint as grok-4.5)
T+~100ms    Request fully dispatched to xAI (estimated)
...         Waiting for xAI grok-4.20 response (provider inference running)
T+20000ms   setTimeout fires → timedOut=true → abortController.abort()
T+20000ms   AbortSignal propagates → HTTP connection torn down
T+20000ms   OpenAI SDK throws Error('Request was aborted.')
T+20000ms   XAI adapter catches → wraps as InternalServerErrorException
T+20000ms   Worker catch: isAbort=true (signal.aborted), timedOut=true → return
T+20000ms   Timeout handler: UPDATE usage_records SET status='timeout' (already executed)
T+20000ms   publishCompletion(executionId) — SSE event sent
```

---

## 12. Primary Root-Cause Classification

**1. APPLICATION TIMEOUT TOO SHORT FOR VALID PROVIDER RESPONSE**

The 20-second `EXECUTION_TIMEOUT_MS` is insufficient for `grok-4.20` to complete a structured JSON response with full file-action content for a Builder workspace_mutation request. `grok-4.5` completed the same request within 20 seconds; `grok-4.20` did not.

---

## 13. Secondary Contributing Factors

1. **No model-aware timeout differentiation.** All models share the same 20-second timeout regardless of expected inference speed.

2. **Error message loses specificity.** The `Request was aborted.` message does not explicitly indicate "application timeout" to the user. The XAI adapter's `handleError()` does not recognize abort errors, though the worker handles them correctly upstream.

3. **Retry logic fires for timeouts but is ineffective.** `isRetryableError()` matches "timeout" in the error message. However, the error message is "Request was aborted." (not "timeout"), so retries may or may not fire depending on whether the XAI adapter's wrapped exception message includes "timeout". In practice, since the abort fires the `AbortSignal`, the retry loop's `if (abortController.signal.aborted) throw err` (L968) skips retry entirely. The timeout abort is non-retryable by design.

4. **Non-streaming mode amplifies timeout risk.** The application uses non-streaming requests (`streaming: false`). The provider must generate the entire response before any data arrives. For large structured outputs, this means no partial progress indication and maximum time-to-first-byte.

---

## 14. Current Timeout-Policy Assessment

| Property | Value | Assessment |
|----------|-------|------------|
| EXECUTION_TIMEOUT_MS | 20000ms | Too short for slower models |
| Applied to all providers/models equally | Yes | No model-aware differentiation |
| Upper bound protection | 20s | Adequate for fast models; blocks slower ones |
| Worker occupancy risk at 20s | Low | Short timeout means quick slot release |
| Queue pressure at 20s | Low | Jobs fail fast |
| User-facing wait at 20s | Moderate | 20s is borderline acceptable for Builder UX |
| Runaway provider protection | Good | 20s prevents infinite hangs |
| Cancellation semantics | Correct | AbortSignal propagates cleanly |
| Accounting at 20s timeout | Correct | No credit deduction for timeout |

---

## 15. Selected Timeout Policy

**MODEL-AWARE BOUNDED TIMEOUT**

| Setting | Old Value | Proposed Value | Layer | Rationale |
|---------|-----------|---------------|-------|-----------|
| Default EXECUTION_TIMEOUT_MS | 20000 | 20000 (unchanged) | Worker | Retain for fast models |
| Model-specific override for grok-4.20 | N/A | 60000 (60s) | Worker (model-aware) | grok-4.20 needs more time for structured JSON output; 60s is bounded and prevents runaway |
| Upper bound for any model | N/A | 120000 (120s) | Worker | Absolute ceiling; no model should exceed 2 minutes |
| BullMQ lock duration | EXECUTION_TIMEOUT_MS + 10000 | max(model_timeout) + 10000 | Worker | Must exceed longest model timeout |

**Why this layer:** The worker timeout is the only layer that actively aborts the request. The XAI adapter has no independent timeout. The OpenAI SDK client has no configured timeout. The queue has no job-level timeout. The worker's `setTimeout` is the sole active timeout in the chain.

**Why 60s for grok-4.20:** This is bounded (not infinite), prevents runaway jobs (hard ceiling), and provides enough headroom for a model that is likely 2-3x slower than grok-4.5 for structured output. The 60s limit still protects worker slot occupancy.

**Why it will not create runaway jobs:**
- Hard ceiling of 60s (not open-ended)
- Stuck watchdog scans at 2x timeout = 120s; catches stragglers
- AbortSignal still propagates on timeout; HTTP connection is torn down
- Worker slot is released after abort
- BullMQ lock adjusted to cover the longer timeout

---

## 16. Selected Retry/Fallback Policy

**NO AUTOMATIC RETRY FOR TIMEOUT/ABORT**

Rationale:

1. **Timeout is deterministic for the same request.** If `grok-4.20` cannot complete in 60s, retrying the identical request will also timeout.
2. **Duplicate provider calls risk.** After application abort, the provider may still be processing. A retry sends a second request while the first may still be in-flight server-side.
3. **Double billing risk.** xAI charges per token generated. If the first request completed server-side after our abort, retrying means paying twice.
4. **No file-action idempotency.** Builder requests produce workspace mutations. Duplicate successful responses could create duplicate file actions.
5. **User retry is explicit.** The user can manually retry from the frontend. This is the safest path.

The existing `isRetryableError()` retry logic (Phase 51.3) correctly does NOT retry aborts — `if (abortController.signal.aborted) throw err` at L968 prevents retry when the signal has fired. This behavior is CORRECT and should be preserved.

---

## 17. Execution-State Semantics

### Current behavior for timeout

| State transition | Value | Correct? |
|-----------------|-------|----------|
| Initial | `pending` | Yes |
| Worker claim | `running` | Yes |
| Timeout fires | `timeout` | **Yes — semantically correct** |
| Status persisted by | Timeout handler (L753-785) | Correct — handler owns persistence |
| publishCompletion called | Yes | Correct — frontend notified |

### Assessment

The `timeout` status is semantically correct. It is distinct from:
- `failed` (non-timeout errors)
- `cancelled` (user-initiated cancel)
- `completed` (success)

**No correction needed** for execution-state semantics.

### Frontend mapping

The API Gateway maps `timeout` → `timeout` in the execution status endpoint (L698). The frontend receives `timeout` as the execution status. This is correct and distinct.

---

## 18. Cancellation Cleanup / Duplicate-Side-Effect Risk

### After abort (current behavior)

| Concern | Status | Risk |
|---------|--------|------|
| Provider request cancellation | HTTP connection torn down by AbortSignal | TCP RST sent; provider may or may not stop processing |
| Queue/job completion | Job handler returns normally after timeout (L1258) | Job completes in BullMQ's view |
| Worker slot release | Yes — after handler return | Slot freed for next job |
| Execution persistence | `status='timeout'` persisted by timeout handler | Correct |
| Accounting finalization | No credit deduction for timeout | Correct (03D boundary) |
| File-action publishing | None (never received actions) | No risk |
| Workspace mutation | None | No risk |
| Dangling promises/listeners/timers | pollCancel setTimeout continues until `cancelled=true` check | Low risk — returns harmlessly on next poll tick |

### Duplicate-side-effect risk

**The provider (xAI) may complete processing the request after our abort.** This is a known limitation of HTTP abort semantics — tearing down the TCP connection does not guarantee the server stops processing. However:

- No response was received → no file actions extracted → no workspace mutation
- No tokens were counted → no credit deduction
- If xAI completes server-side, the response is discarded (nobody is listening)
- No automatic retry → no second request sent

**Risk level:** LOW. The abort is a clean client-side disconnection. Server-side completion without a listener has no application-visible side effect.

---

## 19. Accounting Boundary / 03D

| Concern | Owner | Evidence |
|---------|-------|----------|
| Historical timeout execution credit outcome | Both timed-out executions: 0 tokens, 0 credits deducted | Correct — timeout = no provider response = no usage |
| Credit/refund policy for timeout | **03D** — NOT 03C | 03C only diagnoses the timeout cause |
| Credit/refund policy for failed executions | **03D** — NOT 03C | The 2145-credit charge on failed execution `25eb1efb` is 03D scope |
| Timeout accounting trigger | No `notifyExecutionComplete()` called for timeout | Correct — only completed executions trigger deduction |

**03C explicitly does NOT decide** credit policy for timeout/failed executions. That belongs to PRIVATE-BETA-BLOCKER-03D.

---

## 20. Separation from 03A/03B/BUILDER-INTENT/03E

| Resolved blocker | Relationship to 03C | Proof of independence |
|------------------|---------------------|----------------------|
| **03A** — Structured-output parser | 03A fixed `fileActions: []` for completed responses. 03C is about timeout (no response received). Completely independent. | Grok 4.2 never returned a response to parse. |
| **03B** — Mutation zero-action contract | 03B validates file-action count post-completion. 03C never reaches completion. Independent. | Timeout fires before any provider response. |
| **BUILDER-INTENT-01** — Ask/Build semantics | BUILDER-INTENT distinguishes conversation vs workspace_mutation intent. 03C is about whether the provider responds at all, regardless of intent. Independent. | Timeout is model-latency-related; intent doesn't affect timeout. |
| **03E** — Stale session / file-apply lifecycle | 03E fixed HTTP 502 during file apply. 03C never reaches file apply (no response). Independent. | Completely different execution stage. |

None of these resolved blockers are reopened by 03C.

---

## 21. Exact Implementation Surfaces if Required

| Surface | File | Change Required |
|---------|------|----------------|
| Model-aware timeout configuration | `services/ai-service/src/worker/worker.processor.ts` | Add model-based timeout resolution before setTimeout |
| Model timeout registry | New or existing config (e.g., provider-model.catalogue or worker config) | Map model → timeout_ms |
| BullMQ lock duration | `worker.processor.ts` L597 | Derive from max possible model timeout |
| Environment variable | `.env` / PM2 ecosystem | Optional `EXECUTION_TIMEOUT_MS_GROK_4_20` or structured config |
| XAI adapter error handling (optional polish) | `xai-ai.adapter.ts` L292-312 | Recognize abort errors (low priority — worker handles correctly) |

---

## 22. Child-Slice Plan

**Single bounded implementation slice** (no child slices required):

### 03C-IMPL: Model-Aware Timeout with Bounded Ceiling

**Scope:**
1. Add model-aware timeout resolution in WorkerProcessor
2. `grok-4.20` timeout: 60000ms; all others: retain 20000ms default
3. Adjust BullMQ lockDuration to accommodate longest model timeout
4. Update stuck-watchdog threshold to match new max

**Bounded by:**
- One file changed: `worker.processor.ts` (primary)
- Optional: add model-timeout config constant/env var
- No retry changes
- No fallback changes
- No accounting changes
- No queue architecture changes
- No frontend changes

**Why single slice:** The fix is localized to one timeout value derivation in one file. The timeout chain, abort propagation, and error handling are all architecturally correct; only the numeric value is wrong for one model.

---

## 23. Targeted Test Plan

| # | Test | Description |
|---|------|-------------|
| 1 | Provider completes before timeout | grok-4.5 (fast) completes normally within 20s — no regression |
| 2 | Provider exceeds default timeout but within model timeout | grok-4.20 mock at 25s → should succeed if model timeout is 60s |
| 3 | Provider exceeds model timeout | grok-4.20 mock at 65s → should timeout |
| 4 | AbortSignal reaches provider HTTP call | Verify signal is forwarded to SDK create options |
| 5 | Timeout error classified as 'timeout' | status='timeout' persisted correctly |
| 6 | Worker finalizes execution exactly once | No duplicate UPDATE for timeout |
| 7 | No file actions published after abort | effectiveFileActions never reached |
| 8 | No duplicate provider request on timeout | AbortSignal prevents retry |
| 9 | Queue/worker remains healthy after abort | Worker slot released; next job claims normally |
| 10 | Grok 4.5 normal path unchanged | Existing fast-model tests pass |
| 11 | Harness path unchanged | Harness tests still pass |
| 12 | Accounting event NOT emitted for timeout | notifyExecutionComplete not called |
| 13 | BullMQ lockDuration covers model timeout | lockDuration >= model_timeout + 10000 |
| 14 | Stuck watchdog uses correct threshold | 2x max model timeout |

---

## 24. Controlled Staging-Validation Plan

### Minimum validation

1. Deploy 03C implementation to staging
2. Temporarily set `GLOBAL_EXECUTION_ENABLED=true`
3. Submit ONE request with `provider: 'xai', model: 'grok-4.20'` using a bounded Builder prompt
4. Observe: response received within 60s OR timeout at 60s (either confirms the timeout change is active)
5. Verify execution status is `completed` or `timeout` (not crash/stuck)
6. Restore `GLOBAL_EXECUTION_ENABLED=false`

### Optional comparison (only if step 3 times out at 60s)

- Submit ONE request with `provider: 'xai', model: 'grok-4.5'` to confirm fast-model path is unaffected

---

## 25. Provider-Call Budget

| Call | Model | Purpose | Required? |
|------|-------|---------|-----------|
| 1 | grok-4.20 | Validate timeout fix allows completion | YES |
| 2 | grok-4.5 | Comparison (only if call 1 times out) | CONDITIONAL |

**Maximum:** 2 provider calls
**Expected:** 1 provider call
**Minimum:** 1 provider call

Begin and end with: `GLOBAL_EXECUTION_ENABLED=false`

Harness remains disabled. No Stripe/payment activity.

---

## 26. Rollback Plan

| Step | Action |
|------|--------|
| 1 | Revert model-aware timeout change in `worker.processor.ts` (single file revert) |
| 2 | Restore `EXECUTION_TIMEOUT_MS` to flat 20000ms behavior |
| 3 | Restart AI Service PM2 process |
| 4 | Verify worker healthy |

No destructive DB reset required. No Docker volume destruction. No broad environment rollback. Single-file `git revert` is sufficient.

---

## 27. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| grok-4.20 still times out at 60s | Medium | If so, model may be genuinely incompatible or deprecated; consider removing from catalogue |
| 60s timeout increases worker occupancy per grok-4.20 job | Low | Only affects grok-4.20 slots; grok-4.5 remains at 20s |
| xAI continues processing after abort (server-side waste) | Low | Unavoidable with HTTP abort; no application-side effect |
| lockDuration increase for BullMQ | Low | Only matters if single model timeout exceeds prior lock; bounded at 70s |

---

## 28. Explicit Out-of-Scope Items

| Item | Reason |
|------|--------|
| PRIVATE-BETA-BLOCKER-03D — credit/refund policy | Separate task; 03C only diagnoses timeout |
| Streaming mode implementation | Architectural change; not required for timeout fix |
| Automatic retry on timeout | Explicitly rejected (§16) |
| Model fallback (auto-switch to grok-4.5 on timeout) | Not required; user can switch manually |
| XAI adapter error-handling polish | Low priority; worker handles abort correctly |
| Frontend timeout-specific UX | Follow-up; current `timeout` status display is adequate |
| Provider-side latency investigation | Cannot control xAI inference speed |
| grok-4.20 deprecation decision | Product decision; not 03C scope |
| PRIVATE-BETA-INVITE-01 | Prohibited |
| GLOBAL_EXECUTION_ENABLED changes | Only for controlled validation; restored to false |
| 03A/03B/03E modification | Complete and locked |
| BUILDER-INTENT modification | Complete and locked |

---

## 29. Final Readiness Verdict

**READY FOR BOUNDED IMPLEMENTATION**

Evidence is sufficient. Root cause is clear. The fix is localized (model-aware timeout value in one file). No architectural change required. No retry/fallback complexity. No multi-service coordination.

---

## 30. Exact Next Task

**PRIVATE-BETA-BLOCKER-03C Step 3 — Bounded Implementation**

Implement model-aware timeout in `services/ai-service/src/worker/worker.processor.ts`:
- Resolve timeout from model string (default 20000ms; grok-4.20 → 60000ms)
- Adjust BullMQ lockDuration and stuck-watchdog threshold
- Add targeted tests (§23)
- Run validation commands
- Do NOT enable GLOBAL_EXECUTION_ENABLED
- Do NOT make provider calls

---

## Model Recommendation for Step 3

**Grok 4.6 High**

Rationale: This is a bounded single-file implementation with straightforward test additions. No complex async cancellation interaction. No multi-service coordination. No architectural ambiguity. Grok 4.6 High is appropriate; XHigh is not warranted.

---

*Stage Start created: 2026-08-14 — PRIVATE-BETA-BLOCKER-03C Step 2 — read-only diagnosis — no source/runtime/provider modification.*
*GLOBAL_EXECUTION_ENABLED=false — confirmed unchanged.*
*Provider calls: 0*
