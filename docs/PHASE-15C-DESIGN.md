# PHASE 15C DESIGN: Execution Failure Taxonomy & Caller Responsibility Policy

**Status:** DESIGN CHECKPOINT
**Nature:** Design-Only Phase / Policy Definition
**Version:** v1.0
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Failure taxonomy locked:** validation, provider, rate_limit, timeout, unknown—each with deterministic semantics
• **Ownership matrix defined:** Service throws exceptions, caller owns retries/billing/dedup/idempotency
• **Retry eligibility established:** rate_limit and timeout are retryable; validation and unknown are not; provider is conditionally retryable
• **Token eligibility locked:** Success only—all failures produce zero tokens, caller must never bill for failed executions
• **Deterministic guarantees:** Exception type and category are deterministic per failure cause; timing and message are non-deterministic

---

## 1. Purpose & Scope

### 1.1 Purpose

Phase 15C defines **what execution failures mean** and **who is responsible for handling them**. This phase establishes the **semantic boundary** between service-provided exceptions and caller-owned failure handling.

### 1.2 Scope

Phase 15C defines:

- **Failure classification taxonomy** — Canonical categories and exception types
- **Failure ownership matrix** — Service vs caller vs adapter vs provider responsibility
- **Retry eligibility policy** — Which failures may be retried by callers
- **Token eligibility policy** — Which executions may produce billable tokens
- **Billing responsibility** — When callers must/must not bill end users
- **Caller obligations** — What callers must do per failure type
- **Deterministic failure semantics** — What is guaranteed vs non-deterministic
- **Exception stability contract** — Which exception properties are stable across versions

### 1.3 What Phase 15C Does NOT Define

Phase 15C explicitly does NOT define:

- Retry implementation (backoff algorithms, max attempts, retry loops)
- Timeout enforcement (timeout detection, deadline propagation, cancellation)
- Circuit breakers or failure rate tracking
- Rate limiting systems or quota enforcement
- Token recording implementation or billing calculation
- Logging or observability implementation
- Error message text or formatting
- Provider-specific error handling logic
- Adapter-specific exception mapping

---

## 2. Failure Classification Taxonomy

### 2.1 Canonical Failure Categories

All execution failures are classified into the following canonical categories:

**Category: validation**
- **Meaning:** Request is malformed, invalid, or violates schema
- **Cause:** Caller provided invalid input (missing fields, wrong types, unsupported values)
- **Detection:** Service or adapter validates request before provider invocation
- **Ownership:** Caller error (caller must fix request)
- **Retry Eligibility:** Never retryable (same request will always fail)
- **Token Eligibility:** Zero tokens (no provider invocation occurred)

**Category: provider**
- **Meaning:** Provider API returned error or failed to process request
- **Cause:** Provider rejected request, returned error response, or experienced outage
- **Detection:** Adapter received error response from provider API
- **Ownership:** Provider error (service and caller are not at fault)
- **Retry Eligibility:** Conditionally retryable (depends on provider error code)
- **Token Eligibility:** Zero tokens (provider did not complete execution)

**Category: rate_limit**
- **Meaning:** Provider enforced rate limiting or quota exhaustion
- **Cause:** Too many requests to provider, quota exceeded, or concurrency limit hit
- **Detection:** Adapter received HTTP 429 or provider-specific rate limit error
- **Ownership:** Caller error (caller must implement rate control)
- **Retry Eligibility:** Always retryable (request is valid, timing is the issue)
- **Token Eligibility:** Zero tokens (provider rejected request before execution)

**Category: timeout**
- **Meaning:** Execution exceeded caller-provided timeout
- **Cause:** Provider response took too long, network latency, or provider slowness
- **Detection:** Caller-enforced timeout expired before service returned
- **Ownership:** Shared (provider slowness, caller timeout configuration)
- **Retry Eligibility:** Always retryable (may succeed with longer timeout or faster provider)
- **Token Eligibility:** Zero tokens (caller aborted execution before completion)

**Category: unknown**
- **Meaning:** Unexpected failure not covered by other categories
- **Cause:** Network error, service crash, adapter bug, or unclassified provider error
- **Detection:** Exception not mapped to other categories
- **Ownership:** Service error (requires investigation and potential fix)
- **Retry Eligibility:** Not retryable (may indicate service bug or persistent issue)
- **Token Eligibility:** Zero tokens (execution did not complete successfully)

### 2.2 Exception Type Hierarchy

The service provides the following exception types:

**AIExecutionException** (base class)
- **Category:** N/A (abstract base)
- **Purpose:** Base type for all AI execution failures
- **Fields:** `executionId`, `category`, `message`, `adapter`, `provider`, `model`

**AIValidationException** extends AIExecutionException
- **Category:** validation
- **Purpose:** Request validation failures
- **Causes:** Missing required fields, invalid model identifier, unsupported adapter, malformed messages

**AIProviderException** extends AIExecutionException
- **Category:** provider
- **Purpose:** Provider API errors or failures
- **Causes:** Provider API error response, provider outage, provider-side validation failure
- **Fields:** Additional `providerErrorCode`, `httpStatusCode`

**AIRateLimitException** extends AIExecutionException
- **Category:** rate_limit
- **Purpose:** Provider rate limiting or quota exhaustion
- **Causes:** HTTP 429 from provider, quota exceeded, concurrency limit
- **Fields:** Additional `retryAfterSeconds` (optional)

**AITimeoutException** extends AIExecutionException
- **Category:** timeout
- **Purpose:** Execution exceeded caller timeout
- **Causes:** Provider response too slow, network latency
- **Fields:** Additional `timeoutMs` (caller-provided timeout value)

**AIUnknownException** extends AIExecutionException
- **Category:** unknown
- **Purpose:** Unexpected or unclassified failures
- **Causes:** Network error, service crash, adapter bug, unhandled provider error

### 2.3 Exception Mapping Rules

Adapters MUST map provider errors to exception types using the following rules:

**Validation Mapping:**
- Provider returns 400 Bad Request → AIValidationException
- Provider rejects unsupported model → AIValidationException
- Provider rejects malformed request → AIValidationException

**Rate Limit Mapping:**
- Provider returns HTTP 429 → AIRateLimitException
- Provider returns quota exhaustion error → AIRateLimitException
- Provider returns concurrency limit error → AIRateLimitException

**Provider Error Mapping:**
- Provider returns HTTP 500/502/503/504 → AIProviderException
- Provider returns authentication error → AIProviderException (not validation)
- Provider returns unexpected 4xx (not 400, 429) → AIProviderException

**Timeout Mapping:**
- Caller-enforced timeout expires → AITimeoutException (caller detects)
- Provider connection timeout → AIProviderException (not timeout)

**Unknown Mapping:**
- Network connection failure → AIUnknownException
- Adapter throws unhandled exception → AIUnknownException
- Provider returns unparseable response → AIUnknownException

---

## 3. Failure Ownership Matrix

### 3.1 Ownership Dimensions

Failure ownership is defined across four dimensions:

1. **Detection Responsibility** — Who detects the failure
2. **Exception Responsibility** — Who throws the exception
3. **Recovery Responsibility** — Who must handle or retry the failure
4. **Billing Responsibility** — Who decides whether to bill end users

### 3.2 Ownership by Failure Category

**validation**
- Detection: Service or adapter (before provider invocation)
- Exception: Service throws AIValidationException
- Recovery: Caller must fix request (never retry with same input)
- Billing: Caller must NOT bill end users (no execution occurred)

**provider**
- Detection: Adapter (from provider API response)
- Exception: Adapter throws AIProviderException
- Recovery: Caller decides (retry with backoff if error is transient)
- Billing: Caller must NOT bill end users (provider did not complete execution)

**rate_limit**
- Detection: Adapter (from provider HTTP 429 or quota error)
- Exception: Adapter throws AIRateLimitException
- Recovery: Caller must implement rate limiting and retry with backoff
- Billing: Caller must NOT bill end users (provider rejected request)

**timeout**
- Detection: Caller (caller-enforced timeout)
- Exception: Caller detects timeout, service never returns (or throws AITimeoutException)
- Recovery: Caller decides (retry with longer timeout or different provider)
- Billing: Caller must NOT bill end users (execution did not complete)

**unknown**
- Detection: Service or adapter (unhandled exception)
- Exception: Service throws AIUnknownException
- Recovery: Caller should NOT retry (may indicate persistent bug)
- Billing: Caller must NOT bill end users (execution did not complete)

### 3.3 Cross-Cutting Ownership Rules

**Service Responsibilities (All Failures):**
- Detect failures before returning to caller
- Throw typed exceptions (never return error codes)
- Log execution metadata (per Phase 15B observability policy)
- Generate executionId for correlation
- Propagate caller-provided correlation IDs (sessionId, userId)

**Adapter Responsibilities (All Failures):**
- Map provider errors to canonical exception types
- Extract provider error codes and messages
- Preserve provider-specific error context
- Throw exceptions synchronously (never return error objects)

**Provider Responsibilities (All Failures):**
- Return structured error responses (HTTP status, error code, message)
- Document error semantics and retry guidance
- Enforce rate limits consistently

**Caller Responsibilities (All Failures):**
- Decide whether to retry (per retry eligibility policy)
- Implement retry backoff (if retrying)
- Track failed executions for billing exclusion
- Propagate failures to end users (do not silently swallow)
- Log conversation content (if needed, per Phase 15B privacy policy)

---

## 4. Retry Eligibility Policy (Design Only)

### 4.1 Retry Eligibility Matrix

The following table defines which failures MAY be retried by callers:

| Exception Type           | Retry Eligible | Reasoning                                                  |
|--------------------------|----------------|------------------------------------------------------------|
| AIValidationException    | ❌ NEVER        | Same request will always fail; caller must fix request     |
| AIProviderException      | ⚠️ CONDITIONAL | Depends on provider error code (5xx retryable, auth never) |
| AIRateLimitException     | ✅ ALWAYS       | Request is valid; retry with backoff will eventually work  |
| AITimeoutException       | ✅ ALWAYS       | Provider may respond faster on retry, or caller can adjust timeout |
| AIUnknownException       | ❌ NEVER        | May indicate service bug or persistent issue; avoid retry storm |

### 4.2 Conditional Retry Rules (AIProviderException)

For `AIProviderException`, retry eligibility depends on `httpStatusCode`:

**Retryable Provider Errors:**
- HTTP 500 Internal Server Error → Retry (transient provider issue)
- HTTP 502 Bad Gateway → Retry (provider routing issue)
- HTTP 503 Service Unavailable → Retry (provider overload)
- HTTP 504 Gateway Timeout → Retry (provider timeout)

**Non-Retryable Provider Errors:**
- HTTP 401 Unauthorized → Never retry (invalid API key, must fix configuration)
- HTTP 403 Forbidden → Never retry (permission denied, must fix provider setup)
- HTTP 402 Payment Required → Never retry (provider billing issue)
- HTTP 4xx (other) → Never retry (provider rejected request for non-transient reason)

**Unknown Provider Errors:**
- No HTTP status code → Do NOT retry (unknown failure mode)
- Unparseable provider response → Do NOT retry (may indicate adapter bug)

### 4.3 Retry Backoff Guidance (Caller Implementation)

Callers implementing retries MUST:

1. **Use exponential backoff** — Increase delay between retries exponentially
2. **Respect retryAfterSeconds** — If AIRateLimitException provides retryAfterSeconds, wait at least that long
3. **Limit retry attempts** — Cap retries at reasonable maximum (e.g., 3-5 attempts)
4. **Avoid retry storms** — Do not retry unknown or non-retryable errors
5. **Track executionId per attempt** — Each retry is a new execution with unique executionId

### 4.4 Retry Non-Responsibilities

The service explicitly does NOT:

- Implement automatic retries (caller owns all retry logic)
- Track retry attempts (each execution is independent)
- Deduplicate retries (caller owns idempotency)
- Enforce retry limits (caller owns rate control)
- Provide retry libraries or SDKs (caller chooses retry implementation)

---

## 5. Token & Billing Eligibility (Policy Only)

### 5.1 Token Production Rules

Token counts are produced ONLY under the following conditions:

**Success Path (Tokens Produced):**
- Execution returns AIExecutionResult
- Provider completed request successfully
- Provider returned token count in response
- Service recorded token count to token-usage table

**Failure Path (Zero Tokens):**
- Execution throws any AIExecutionException subclass
- Provider did not complete request
- Provider did not return token count
- Service did NOT record tokens to token-usage table

### 5.2 Token Eligibility by Failure Category

| Exception Type           | Tokens Produced | Reasoning                                         |
|--------------------------|-----------------|---------------------------------------------------|
| AIValidationException    | ❌ ZERO          | Provider never invoked                            |
| AIProviderException      | ❌ ZERO          | Provider did not complete execution               |
| AIRateLimitException     | ❌ ZERO          | Provider rejected request before execution        |
| AITimeoutException       | ❌ ZERO          | Execution aborted before completion               |
| AIUnknownException       | ❌ ZERO          | Execution did not complete successfully           |
| AIExecutionResult        | ✅ TOKENS        | Only path that produces tokens                    |

### 5.3 Billing Responsibility Rules

Callers MUST implement the following billing rules:

**MUST Bill End Users:**
- Execution returns AIExecutionResult with tokensUsed > 0
- Caller received responseText from provider
- Caller delivered AI response to end user

**MUST NOT Bill End Users:**
- Execution throws any AIExecutionException
- No tokens were recorded (all failures produce zero tokens)
- Provider did not complete request
- End user did not receive AI response

**Partial Execution NOT Billable:**
- Provider began execution but failed mid-stream → Zero tokens (no partial billing)
- Timeout occurred after provider started → Zero tokens (execution did not complete)
- Network failure after provider invocation → Zero tokens (response not received)

### 5.4 Billing Edge Cases

**Retry Billing:**
- If caller retries failed execution and retry succeeds → Bill only successful execution
- If caller retries 3 times and 3rd attempt succeeds → Bill only 3rd attempt
- If all retry attempts fail → Bill zero (no successful execution)

**Timeout Billing:**
- If caller timeout expires but provider completed → Zero tokens (caller did not receive response)
- If provider returns response after timeout → Caller MUST discard and NOT bill

**Idempotency Billing:**
- If caller deduplicates retry using idempotency key → Bill zero for deduplicated request
- If caller uses cached response → Caller decides billing (service not involved)

### 5.5 Token Recording Guarantees

The service guarantees:

1. **Token recording only on success** — AIExecutionResult is the ONLY path that records tokens
2. **Atomic token recording** — Tokens recorded before response returned to caller
3. **No partial tokens** — Failed executions never record partial token counts
4. **No retry deduplication** — Each execution attempt records tokens independently (if successful)

---

## 6. Caller Obligations by Failure Type

### 6.1 Universal Caller Obligations (All Failures)

For ALL failure types, callers MUST:

1. **Do NOT bill end users** — All failures produce zero tokens
2. **Log executionId** — Preserve executionId for debugging and correlation
3. **Propagate failure to end user** — Do not silently swallow exceptions
4. **Track failure in caller-side analytics** — Count failures for SLA tracking

### 6.2 Specific Obligations by Exception Type

**AIValidationException:**
- ✅ MUST fix request (do not retry with same input)
- ✅ MUST validate input before calling service (avoid repeated validation errors)
- ✅ MUST inform end user of invalid request
- ❌ MUST NOT retry

**AIProviderException:**
- ✅ MUST check httpStatusCode to determine retry eligibility
- ✅ MUST implement exponential backoff if retrying
- ✅ MUST propagate provider error code to end user (if actionable)
- ⚠️ MAY retry if error is transient (5xx)
- ❌ MUST NOT retry authentication or permission errors (401, 403)

**AIRateLimitException:**
- ✅ MUST implement rate limiting to avoid repeated rate limit errors
- ✅ MUST respect retryAfterSeconds if provided
- ✅ MUST use exponential backoff with jitter
- ✅ MUST limit retry attempts to avoid retry storm
- ⚠️ MAY implement client-side rate limiting to avoid hitting provider limits

**AITimeoutException:**
- ✅ MUST evaluate timeout configuration (is timeout too short?)
- ✅ MUST consider using different provider or model (if current provider is slow)
- ✅ MUST inform end user of timeout
- ⚠️ MAY retry with longer timeout
- ⚠️ MAY retry with same timeout (provider may be faster on retry)

**AIUnknownException:**
- ✅ MUST log full exception context for investigation
- ✅ MUST report to service operator (potential service bug)
- ✅ MUST inform end user of unexpected failure
- ❌ MUST NOT retry (may cause retry storm)
- ❌ MUST NOT assume transient failure

### 6.3 Caller Non-Obligations

Callers are explicitly NOT required to:

- Implement automatic retries (retry is optional, caller-owned decision)
- Use specific retry libraries or algorithms (caller chooses implementation)
- Report failures to service (service has observability via logs)
- Cache responses to avoid retries (caching is optional optimization)
- Track failure rates or SLA metrics (optional, not required)

---

## 7. Deterministic Guarantees

### 7.1 Deterministic Failure Properties

The following failure properties are **deterministic** and guaranteed:

**Exception Type:**
- Same failure cause → Same exception type
- Validation error → Always AIValidationException
- HTTP 429 → Always AIRateLimitException
- Timeout → Always AITimeoutException

**Exception Category:**
- Same exception type → Same category
- AIValidationException → Always category "validation"
- AIRateLimitException → Always category "rate_limit"

**Token Eligibility:**
- All failures → Always zero tokens
- All AIExecutionResult → Always tokensUsed ≥ 0

**Retry Eligibility:**
- AIValidationException → Always not retryable
- AIRateLimitException → Always retryable
- AIUnknownException → Always not retryable

**Execution Outcome:**
- One execution → Exactly one outcome (AIExecutionResult OR exception, never both)
- No partial results → Never return result + exception

### 7.2 Non-Deterministic Failure Properties

The following failure properties are **non-deterministic**:

**Exception Timing:**
- Same request → May fail at different times on retry
- Validation may be fast or slow depending on input size
- Provider errors may occur immediately or after delay

**Exception Message:**
- Same error → May have different message text
- Provider error messages may change between API versions
- Message text is informational, not stable contract

**Provider Error Code:**
- Same provider error → May have different error code (provider-specific)
- Error codes are provider-specific, not normalized across adapters

**Retry Success:**
- Failed execution → May succeed on retry (rate limit, timeout)
- May fail again on retry (persistent validation error, provider outage)

**HTTP Status Code (AIProviderException):**
- Same provider failure → May have different HTTP status on retry
- Provider may return 500 then 503 on subsequent requests

### 7.3 Deterministic Testing Guarantees

For testing purposes, the following are guaranteed:

1. **Validation errors are reproducible** — Same invalid request → Same exception
2. **Exception type is stable** — Exception class names are part of API contract
3. **Token zero guarantee** — Tests can assert zero tokens on any exception
4. **Retry eligibility is stable** — Exception type determines retry eligibility

Non-deterministic properties (timing, message text, provider codes) should NOT be asserted in tests.

---

## 8. Explicit Non-Responsibilities

### 8.1 Service Non-Responsibilities

The service explicitly does NOT:

**Retry Logic:**
- Implement automatic retries
- Track retry attempts
- Enforce retry limits
- Provide retry backoff logic

**Timeout Enforcement:**
- Enforce caller-provided timeouts (caller enforces via request cancellation)
- Provide timeout middleware or utilities
- Track timeout occurrences

**Rate Limiting:**
- Enforce service-level rate limits (only provider rate limits are surfaced)
- Implement client-side rate limiting
- Track rate limit violations

**Billing & Quotas:**
- Calculate billing amounts
- Enforce user quotas
- Track per-user usage
- Aggregate token usage across requests

**Deduplication:**
- Deduplicate retry requests
- Implement idempotency keys
- Cache responses to avoid duplicate execution

**Failure Analysis:**
- Aggregate failure rates
- Detect failure patterns
- Alert on high failure rates
- Provide failure dashboards

### 8.2 Adapter Non-Responsibilities

Adapters explicitly do NOT:

**Error Recovery:**
- Retry provider API calls
- Implement fallback providers
- Transform failures into successes

**Error Transformation:**
- Normalize provider error messages
- Translate provider error codes to generic codes
- Redact provider-specific error details

**Validation:**
- Validate requests beyond what provider requires
- Enforce service-level validation rules
- Perform schema validation (service does this)

### 8.3 Provider Non-Responsibilities

Providers (external AI APIs) are NOT responsible for:

**Service Guarantees:**
- Adhering to service retry eligibility policy (providers are external)
- Providing deterministic error codes
- Guaranteeing error message stability

**Caller Integration:**
- Implementing caller-specific retry logic
- Tracking caller-side failures
- Providing caller-side SDKs (service wraps provider SDKs)

### 8.4 Caller Non-Responsibilities

Callers are NOT responsible for:

**Service Operation:**
- Detecting service bugs (service owns observability)
- Reporting adapter failures (service logs failures)
- Implementing provider fallback (service does not support multi-provider failover)

**Token Recording:**
- Recording tokens manually (service records on success)
- Validating token counts (service trusts provider)
- Aggregating tokens across retries (each execution is independent)

---

## 9. Safe Resume Point

### 9.1 What Future Phases May Build On

Future phases may:

- **Implement exception classes** — Define TypeScript/NestJS exception classes (Phase 16+)
- **Add exception metadata** — Populate executionId, adapter, provider fields in exceptions (Phase 16+)
- **Implement provider error mapping** — Map provider-specific errors to canonical exceptions (Phase 17+)
- **Add structured logging** — Log exception metadata per Phase 15B observability policy (Phase 18+)
- **Implement retry utilities** — Provide optional caller-side retry libraries (Phase 20+)
- **Add timeout middleware** — Implement caller-enforced timeout utilities (Phase 21+)
- **Implement billing integration** — Connect token recording to billing system (Phase 22+)

### 9.2 What Future Phases Must NOT Change

The following failure policies are **immutable** for all v1.x versions:

- **Throw-only semantics** — Service always throws exceptions on failure (never return error codes)
- **Token zero guarantee** — All failures produce zero tokens
- **Stateless failure handling** — Service does not track retries, failures, or aggregates
- **Exception type stability** — Exception class names are part of public API contract
- **Retry eligibility** — Validation never retryable, rate_limit always retryable
- **Caller owns retries** — Service never implements automatic retries

Changing any of these requires:

1. Formal reopening of Phase 15C
2. Version bump to v2.0
3. Update to Phase 15C checkpoint document
4. Notification to all callers of breaking changes

### 9.3 Integration with Phase 15A & 15B

Phase 15C complements prior design phases:

**Phase 15A established:**
- Callers own retries, idempotency, quotas, billing, timeouts
- Service is stateless and synchronous
- Token recording only on success

**Phase 15B established:**
- Service logs execution metadata (executionId, adapter, provider, tokens, duration)
- Content is never logged (user prompts, AI responses)
- Audit trail enables billing verification but not billing calculation

**Phase 15C extends:**
- Defines WHAT failures mean (taxonomy and semantics)
- Defines WHO handles failures (ownership matrix)
- Defines WHICH failures are retryable (retry eligibility policy)
- Defines WHEN tokens are produced (token eligibility policy)
- Defines WHAT callers must do (caller obligations by failure type)

---

## Declaration of Finality

### Completion Statement

**Phase 15C DESIGN is COMPLETE and LOCKED as of 2026-02-05.**

### Immutability Clause

No changes to failure semantics or ownership are permitted without:

1. Formal reopening of Phase 15C
2. Explicit approval from project governance
3. Version bump to v2.0 (if exception contract changes)
4. Update to this design document

### Policy Authority

This document is the **authoritative source** for execution failure policy. In case of conflict:

1. This document supersedes code comments
2. This document supersedes implementation assumptions
3. This document supersedes "helpful" error handling enhancements

**THIS DOCUMENT WINS.**

---

**END OF PHASE 15C DESIGN**
