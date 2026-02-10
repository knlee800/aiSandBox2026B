# PHASE 15A DESIGN: Caller Responsibility & Integration Policy

**Phase:** 15A
**Stage:** Design Only
**Status:** Draft
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Service is stateless:** Callers must implement retries, idempotency, quotas, timeouts
• **Token billing on success only:** Failures never bill; callers must guard double-billing on retry
• **Retries permitted but non-idempotent:** Identical requests may produce different results
• **Quota enforcement is caller responsibility:** Service has no per-user limits
• **Timeout ownership split:** Provider SDKs handle provider timeouts; callers enforce total execution timeouts

---

## 1. Phase Overview

### 1.1 Purpose of Phase 15A

Phase 15A establishes a **binding policy** that defines the integration contract between callers (API Gateway, future clients) and the AI Service. This policy clarifies:

- What callers **must** implement to safely use the AI Service
- What the AI Service **will never** provide
- How to avoid common integration failures (double-billing, retry storms, inconsistent state)

This is a **design-only** phase. No code is written. No implementation is prescribed. This document defines the **policy boundaries** that all future integration work must respect.

### 1.2 Relationship to Phases 13 and 14

- **Phase 13** defined internal orchestration policy (service-level execution semantics)
- **Phase 14** locked the external public API contract (what callers receive)
- **Phase 15A** defines caller responsibilities (what callers must do to integrate safely)

Phase 15A completes the contract by defining the **caller's obligations**. Together, Phases 13, 14, and 15A form a complete integration contract.

---

## 2. Caller Responsibility Matrix

The following table defines the complete responsibility boundary between the AI Service and its callers:

| Responsibility                          | Owner     | Notes                                                                                     |
|-----------------------------------------|-----------|-------------------------------------------------------------------------------------------|
| Execute AI requests                     | Service   | Service orchestrates adapter calls and token recording                                    |
| Return results or exceptions            | Service   | Service guarantees exactly one outcome per request                                        |
| Record tokens on success                | Service   | Service records tokens only after successful execution                                    |
| Implement retry logic                   | Caller    | Service never retries; callers must implement if desired                                  |
| Implement idempotency                   | Caller    | Service does not deduplicate requests; callers must track request identity                |
| Enforce request timeouts                | Caller    | Service relies on provider SDK timeouts; callers must enforce total execution limits      |
| Enforce per-user quotas                 | Caller    | Service has no quota enforcement; callers must track usage and reject over-quota requests |
| Bill users for token usage             | Caller    | Service records tokens; callers must translate token counts to billing charges            |
| Validate user input                     | Caller    | Service expects valid AIExecutionRequest; callers must validate before calling            |
| Provide conversation context            | Caller    | Service is stateless; callers must include full conversation history in each request      |
| Log and monitor requests                | Caller    | Service may log internally; callers must implement user-facing logging and monitoring     |
| Handle provider errors                  | Caller    | Service propagates exceptions; callers must interpret and present errors to users         |
| Manage user authentication              | Caller    | Service has no user identity; callers must authenticate users before calling              |
| Prevent abuse (rate limiting, spam)     | Caller    | Service has no abuse prevention; callers must implement rate limiting and spam detection  |

---

## 3. Retry Policy (Design Only)

### 3.1 Retry Ownership

- The AI Service **never retries** requests
- Callers **may** implement retry logic but must understand the risks

### 3.2 When Retries Are Allowed

Callers may retry requests that fail with:

- `AIProviderError` — Provider communication failures (e.g., network errors, 5xx responses)
- `AIRateLimitError` — Provider rate limit exceeded (with exponential backoff)

### 3.3 When Retries Are Forbidden

Callers **must not** retry requests that fail with:

- `AIInvalidRequestError` — Malformed request (will always fail)
- `AIContentFilterError` — Provider rejected content (will always fail)
- `AIModelNotFoundError` — Model unavailable (will always fail unless model becomes available)

### 3.4 Non-Idempotent Execution Warning

**CRITICAL:** The AI Service is **not idempotent**. Retrying identical requests may produce:

- Different AI-generated content
- Different token counts
- Different finish reasons

Callers must accept this non-determinism or implement idempotency guards (see Section 4).

### 3.5 Retry Strategy Recommendations

Callers implementing retries should:

- Use exponential backoff with jitter
- Limit total retry attempts (e.g., 3 attempts maximum)
- Respect provider rate limit backoff signals
- Log all retry attempts for debugging
- Alert on excessive retry rates (may indicate systemic issues)

---

## 4. Idempotency Strategy (Design Only)

### 4.1 Why the Service Is Not Idempotent

The AI Service does not enforce idempotency because:

- AI model outputs are non-deterministic by nature
- Provider APIs do not guarantee idempotent behavior
- Enforcing idempotency would require conversation state (violates Phase 14 statelessness guarantee)

### 4.2 How Callers Must Implement Idempotency

Callers requiring idempotent behavior must:

1. **Generate idempotency keys** — Assign a unique ID to each logical user request (e.g., UUIDv4)
2. **Cache successful responses** — Store AIExecutionResult by idempotency key for a fixed TTL (e.g., 24 hours)
3. **Check cache before calling service** — If idempotency key exists in cache, return cached result
4. **Cache only on success** — Failed requests (exceptions) are never cached
5. **Handle cache misses gracefully** — If cache expires, callers may re-execute (producing different results)

### 4.3 Idempotency Scope Recommendations

Idempotency should apply to:

- **User-initiated requests** — Button clicks, form submissions, explicit user actions
- **Automated retries** — Internal retry loops where duplicate execution is undesirable

Idempotency should **not** apply to:

- **Conversational interactions** — Follow-up messages are distinct logical requests
- **Streaming contexts** — Each chunk is a distinct execution event

### 4.4 Failure Scenarios Callers Must Guard Against

Without caller-side idempotency:

- **Accidental double-click** → User charged twice for identical request
- **Network retry after success** → Request executed twice, user charged twice
- **Frontend bug re-submitting request** → Duplicate execution, duplicate billing

Callers must implement idempotency to prevent these scenarios.

---

## 5. Timeout Ownership

### 5.1 Provider SDK Timeouts (Current)

Provider adapters rely on **provider SDK default timeouts**:

- Anthropic SDK: 600 seconds (10 minutes)
- OpenAI SDK: 600 seconds (10 minutes)
- Groq SDK: 600 seconds (10 minutes)

These timeouts apply to individual provider API calls. If the provider does not respond within this window, the SDK throws an exception.

### 5.2 Caller-Side Timeouts (Mandatory)

Callers **must** implement their own request timeouts to:

- Prevent indefinite blocking on long-running requests
- Protect against provider SDK timeout bugs or misconfigurations
- Enforce user-facing SLAs (e.g., "AI responses within 30 seconds")

**Recommended caller timeout:** 30–60 seconds for typical interactive use cases.

### 5.3 Why Orchestrator Timeouts Are Not Yet Implemented

The AI Service does not currently enforce execution timeouts because:

- Provider SDKs already provide timeout guarantees
- Orchestrator-level timeouts require careful design (future phase)
- Premature timeout enforcement could cause false negatives

Callers must not assume the service will enforce timeouts. Callers own timeout policy.

---

## 6. Quota & Cost Enforcement

### 6.1 Where Quotas MUST Be Enforced

Quota enforcement is the **caller's responsibility**. Callers must:

- Track per-user token usage (via recorded tokens from successful requests)
- Define per-user or per-account quota limits
- Reject requests that would exceed quotas **before calling the AI Service**
- Provide clear user feedback when quotas are exceeded

### 6.2 Why the Service Does Not Enforce Quotas

The AI Service is stateless and has no concept of:

- User identity
- Account balances
- Usage history
- Quota policies

Quota enforcement requires stateful tracking and business logic that belongs in the caller layer (API Gateway).

### 6.3 Recommended Caller Strategies

**Pre-Request Quota Check:**
1. Look up user's current token usage from database
2. Calculate available quota remaining
3. If insufficient quota, reject request immediately with clear error
4. If sufficient quota, proceed with AI Service call
5. On success, increment user's token usage by `result.tokensUsed`
6. On failure, do not increment usage (no tokens consumed)

**Post-Request Quota Enforcement:**
- Optionally enforce soft limits (warnings at 80% usage)
- Optionally enforce hard limits (block at 100% usage)
- Optionally support quota overages with billing implications

---

## 7. Billing Safety Rules

### 7.1 When Billing May Occur

Callers may bill users for token usage **only when**:

- AI Service returns a successful `AIExecutionResult`
- `result.tokensUsed > 0`
- No exception was thrown

### 7.2 When Billing MUST NOT Occur

Callers **must never** bill users when:

- AI Service throws an exception (any exception type)
- Request times out before receiving a response
- Request is rejected by caller-side validation (never reached service)
- Request is deduplicated by caller-side idempotency cache

### 7.3 Relationship to Token Recording Guarantees

Phase 14 guarantees:

- Tokens are recorded **only on successful execution**
- Failed requests **never record tokens**

Callers must align billing logic with this guarantee:

- **Billing source of truth:** `result.tokensUsed` from successful requests
- **Never infer token usage from failures** — Assume zero tokens consumed on exception

### 7.4 Double-Billing Prevention

Callers must guard against double-billing scenarios:

| Scenario                                      | Risk                                      | Caller Mitigation                                          |
|-----------------------------------------------|-------------------------------------------|------------------------------------------------------------|
| User clicks submit twice                      | Two requests, two billing events          | Implement idempotency (Section 4)                          |
| Network failure after service success         | Retry succeeds again, second billing      | Cache successful results by idempotency key                |
| Frontend bug re-submits request               | Duplicate execution, duplicate billing    | Frontend deduplication + backend idempotency               |
| Caller retries transient provider error       | Second attempt succeeds, second billing   | Track request identity, deduplicate billing                |

---

## 8. Explicit Non-Goals

Phase 15A **does not** define or change:

- **Service-level retry logic** — Service will never retry (locked by Phase 13)
- **Service-level idempotency** — Service will never deduplicate (locked by Phase 14)
- **Service-level quota enforcement** — Service will never enforce quotas (locked by Phase 14)
- **Service-level timeout enforcement** — Not yet implemented (future phase)
- **Caller implementation details** — How callers implement retries, idempotency, quotas (caller's choice)
- **Billing calculation logic** — How callers translate tokens to currency (business logic)
- **User authentication mechanisms** — How callers identify users (infrastructure concern)
- **Conversation state management** — How callers store chat history (application logic)

Phase 15A defines **policy boundaries only**. Implementation is deferred to caller services.

---

## 9. Locked Guarantees

### 9.1 Guarantees Callers Can Rely On

From Phase 14, callers can rely on:

- **Synchronous execution:** Request → Result or Exception
- **Token recording on success only:** Failures never record tokens
- **Typed exceptions:** Error types are stable, messages are informational
- **Stateless service:** No conversation history retained between requests
- **No automatic retries:** Each request executed exactly once
- **No idempotency enforcement:** Identical requests may produce different results

### 9.2 Guarantees Callers Must NOT Assume

Callers must **not** assume:

- **Output determinism:** Identical requests may produce different content
- **Token count determinism:** Token counts may vary for identical inputs
- **Execution duration guarantees:** No SLA on response time
- **Provider availability:** Providers may be unavailable or rate-limited
- **Model availability:** Specific models may become unavailable
- **Service-level timeouts:** Callers must enforce their own timeouts
- **Service-level quotas:** Callers must enforce their own quotas

---

## 10. Safe Resume Point

### 10.1 What Future Phases May Build On

Future phases may:

- Define recommended caller-side implementations (reference architectures)
- Provide caller-side libraries or SDKs for common patterns (retries, idempotency, quotas)
- Add service-level timeout enforcement (Phase 16+)
- Add service-level observability hooks (Phase 17+)
- Introduce streaming execution as a separate contract (Phase 18+)

### 10.2 What Must Never Be Retroactively Changed

The following are **immutable** for all v1.x versions:

- Caller owns retries, idempotency, timeouts, quotas, billing
- Service is stateless
- Token recording only on success
- No service-level retries
- No service-level idempotency enforcement
- No service-level quota enforcement

Changing any of these requires reopening Phase 14 and bumping to v2.0.

---

## Declaration of Finality

Phase 15A defines the **caller responsibility policy** for AI Service v1.0. This policy is binding for all integrations and future development.

**This policy completes the integration contract established by Phases 13 and 14.**

No code implementation is required for Phase 15A. This is a design-only phase that establishes enforceable policy boundaries.

---

**END OF PHASE 15A DESIGN**
