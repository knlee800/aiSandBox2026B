# PHASE 15 FINAL CHECKPOINT: AI Service Execution Contract & Policy Foundation

**Status:** COMPLETE AND FROZEN
**Nature:** Design-Only Phase / Policy Foundation
**Version:** v1.0
**Date:** 2026-02-05
**Sub-Phases:** 15A, 15B, 15C, 15D

---

## ULTRA-BRIEF SUMMARY

• **Execution contract frozen:** Service executes once synchronously, throws on failure, records tokens only on success—caller owns retries/idempotency/billing/quotas
• **Observability policy locked:** Service logs executionId, adapter, provider, tokens, duration, error types—never logs user prompts or AI responses
• **Failure taxonomy established:** validation (never retryable), provider (conditionally retryable), rate_limit (always retryable), timeout (always retryable), unknown (never retryable)—all failures produce zero tokens
• **Lifecycle model defined:** received → validating → routing → executing → recording_tokens → completed (tokens recorded) OR failed (zero tokens)—cancellation is best-effort signal, not a state
• **Architecture boundaries locked:** Service is stateless, synchronous, throw-only; adapters map provider errors; callers own orchestration, correlation, billing, content logging

---

## 1. Phase 15 Overview

### 1.1 Purpose

Phase 15 establishes the **foundational execution contract** between the AI Service, its adapters, providers, and callers. This phase defines **what the service guarantees**, **what it explicitly does not guarantee**, and **who owns what responsibilities** across the execution lifecycle.

Phase 15 is a **design-only phase**. It defines policies, contracts, and responsibilities without implementing them.

### 1.2 Phase 15 Structure

Phase 15 consists of four sub-phases:

**Phase 15A: Execution Boundaries & Invariants**
- Defines caller vs service responsibility boundaries
- Establishes stateless, synchronous, throw-only execution model
- Locks token-recording-only-on-success policy
- Establishes caller ownership of retries, idempotency, quotas, billing, timeouts

**Phase 15B: Execution Observability & Audit Policy**
- Defines what execution metadata is observable
- Establishes content privacy policy (never log prompts or responses)
- Defines audit trail requirements (executionId, adapter, provider, tokens, duration)
- Establishes caller responsibility for content logging decisions

**Phase 15C: Execution Failure Taxonomy & Caller Responsibility Policy**
- Defines canonical failure categories (validation, provider, rate_limit, timeout, unknown)
- Establishes failure ownership matrix (service vs adapter vs caller)
- Defines retry eligibility policy (which failures may be retried)
- Locks token eligibility policy (all failures produce zero tokens)

**Phase 15D: Execution Lifecycle & State Model**
- Defines logical execution states (received, validating, routing, executing, recording_tokens, completed, failed)
- Establishes state transition rules and ownership
- Defines cancellation semantics (best-effort signal, not a state)
- Aligns token eligibility and observability with prior sub-phases

### 1.3 What Phase 15 Defines

Phase 15 defines:

- **Execution guarantees** — What the service promises to do
- **Execution non-guarantees** — What the service explicitly does NOT do
- **Responsibility boundaries** — Service vs adapter vs provider vs caller ownership
- **Observability contract** — What is logged, what is never logged
- **Failure semantics** — Exception types, categories, retry eligibility
- **Token recording policy** — When tokens are recorded, when they are not
- **Billing eligibility policy** — Which executions may be billed to end users
- **Lifecycle model** — Logical execution states and transitions
- **Cancellation semantics** — Best-effort cancellation, not guaranteed

### 1.4 What Phase 15 Does NOT Implement

Phase 15 explicitly does NOT implement:

- Retry algorithms or backoff logic
- Timeout enforcement or cancellation logic
- Circuit breakers or failure rate tracking
- Rate limiting systems or quota enforcement
- Token recording implementation or billing calculation
- Logging implementation (libraries, formats, destinations)
- Metrics systems (Prometheus, OpenTelemetry, StatsD)
- Tracing SDKs (Jaeger, Zipkin, OpenTelemetry)
- Idempotency deduplication or caching
- State persistence or workflow orchestration
- Compensation or rollback logic
- Async execution or queueing systems

Phase 15 is a **policy foundation**. Future phases will implement these policies.

---

## 2. Locked Guarantees

### 2.1 Execution Model Guarantees (Phase 15A)

**Stateless Execution:**
- Service maintains no state across requests
- Each execution is independent (no correlation, no aggregation)
- Service does not track retries, failures, or execution history

**Synchronous Execution:**
- Service returns response before processing next request
- No background processing or async callbacks
- Execution completes within single request/response cycle

**Throw-Only Error Semantics:**
- Service throws exceptions on failure (never returns error codes)
- Deterministic outcome: AIExecutionResult OR AIExecutionException (never both)
- No partial results (execution is atomic)

**Token Recording Only On Success:**
- Tokens recorded to token-usage table only when provider succeeds
- All failures produce zero tokens (never record partial tokens)
- Token recording is atomic (recorded before response returned)

**Caller Ownership Boundaries:**
- **Callers own:** Retries, idempotency, quotas, billing, timeouts, rate limiting, caching, deduplication
- **Service owns:** Single execution, adapter selection, provider invocation, token recording, exception throwing

### 2.2 Observability Guarantees (Phase 15B)

**Execution Metadata Observability:**
- Service logs executionId (unique per request), adapter, provider, model, tokens, duration, error type
- Entry log shows request received (executionId, timestamp, adapter, provider, model)
- Exit log shows outcome (success: tokensUsed, durationMs; failure: errorType, errorCategory, durationMs)

**Content Privacy by Default:**
- Service NEVER logs user prompts (messages[].content)
- Service NEVER logs AI responses (responseText)
- Service NEVER logs system prompts or conversation history
- Callers own content logging decisions (per privacy regulations, user consent)

**Correlation IDs:**
- Service generates executionId (UUID v4, unique per request)
- Callers may provide optional correlation IDs (sessionId, userId, conversationId)
- Service propagates caller IDs to logs without validation or storage

**Audit Trail Requirements:**
- Success: executionId, timestamp, adapter, provider, model, tokensUsed, durationMs, outcome=success
- Failure: executionId, timestamp, adapter, provider, model, errorType, errorCategory, durationMs, outcome=failure

**Redaction Rules:**
- Always redacted: user prompts, AI responses, system prompts, conversation history
- Never redacted: executionId, adapter, provider, model, tokens, duration, error types
- Conditionally redacted: exception messages (sanitized to remove PII, paths, API keys)

### 2.3 Failure Taxonomy Guarantees (Phase 15C)

**Canonical Failure Categories:**

1. **validation** — Request is malformed or invalid
   - Cause: Caller error (missing fields, wrong types, unsupported values)
   - Retry Eligibility: ❌ NEVER (same request will always fail)
   - Token Eligibility: ❌ ZERO (no provider invocation)
   - Exception: AIValidationException

2. **provider** — Provider API error or failure
   - Cause: Provider error (API error, outage, provider-side validation)
   - Retry Eligibility: ⚠️ CONDITIONAL (5xx retryable, auth never retryable)
   - Token Eligibility: ❌ ZERO (provider did not complete execution)
   - Exception: AIProviderException

3. **rate_limit** — Provider rate limiting or quota exhaustion
   - Cause: Caller error (too many requests, quota exceeded)
   - Retry Eligibility: ✅ ALWAYS (request valid, retry with backoff)
   - Token Eligibility: ❌ ZERO (provider rejected before execution)
   - Exception: AIRateLimitException

4. **timeout** — Execution exceeded caller timeout
   - Cause: Shared (provider slowness, caller timeout config)
   - Retry Eligibility: ✅ ALWAYS (may succeed with longer timeout)
   - Token Eligibility: ❌ ZERO (caller aborted before completion)
   - Exception: AITimeoutException

5. **unknown** — Unexpected failure
   - Cause: Service error (network error, service crash, adapter bug)
   - Retry Eligibility: ❌ NEVER (may indicate persistent bug)
   - Token Eligibility: ❌ ZERO (execution did not complete)
   - Exception: AIUnknownException

**Failure Ownership Matrix:**
- **Detection:** Service or adapter detects failures before returning
- **Exception:** Service or adapter throws typed exception (throw-only semantics)
- **Recovery:** Caller decides whether to retry (per retry eligibility policy)
- **Billing:** Caller MUST NOT bill end users for any failure (zero tokens always)

**Token Eligibility Rules:**
- Success (AIExecutionResult): ✅ Tokens recorded, caller MUST bill end users
- All failures (AIExecutionException): ❌ Zero tokens, caller MUST NOT bill end users
- No partial billing: Execution is atomic (result OR exception)

**Deterministic Failure Guarantees:**
- Exception type is deterministic per failure cause
- Exception category is deterministic per exception type
- Token eligibility is deterministic (success = tokens, failure = zero)
- Retry eligibility is deterministic per exception type
- Exception timing and message text are non-deterministic

### 2.4 Lifecycle Model Guarantees (Phase 15D)

**Logical Execution States:**
```
received → validating → routing → executing → recording_tokens → completed (success)
                                                               ↘ failed (exception)
```

**State Definitions:**
- **received** — Service received request (entry log generated)
- **validating** — Service validating request structure (internal, not logged)
- **routing** — Service selecting adapter (internal, not logged)
- **executing** — Adapter invoking provider API (observable via logs)
- **recording_tokens** — Service recording tokens to database (internal, not logged)
- **completed** — Terminal state, success, tokens recorded (exit log: outcome=success)
- **failed** — Terminal state, exception thrown, zero tokens (exit log: outcome=failure)

**State Transition Rules:**
- Linear progression: received → validating → routing → executing → recording_tokens → completed
- Failure transitions: Any non-terminal state → failed (when error occurs)
- No backwards transitions (cannot go from executing → validating)
- No state skipping (cannot go from received → executing)
- Deterministic outcome: Exactly one terminal state (completed XOR failed)

**State Ownership:**
- **Service owns:** All state transitions, entry/exit logging, executionId generation
- **Adapter owns:** Execution within executing state (provider invocation)
- **Caller owns:** Request initiation, timeout enforcement, terminal state handling

**Cancellation Semantics:**
- Cancellation is a **signal**, not a state
- Best-effort only (no guaranteed cancellation)
- Cancellation may result in failed OR completed depending on timing
- If cancellation before executing → Transition to failed (no provider invocation)
- If cancellation during executing → May transition to failed OR completed (non-deterministic)
- If cancellation after executing → Ignored (execution already committed)

**Token Eligibility by Terminal State:**
- **completed:** ✅ Tokens recorded, billable
- **failed:** ❌ Zero tokens, not billable

**Observability Alignment:**
- Entry log at received state (executionId, timestamp, adapter, provider, model)
- Exit log at completed or failed state (outcome, tokens/error, duration)
- Internal states (validating, routing, recording_tokens) not logged separately
- executionId correlates entry log and exit log

---

## 3. Explicit Non-Goals

### 3.1 Service Non-Responsibilities

The service explicitly does NOT:

**Retry Logic:**
- Implement automatic retries (caller owns all retry logic)
- Track retry attempts (each execution is independent)
- Enforce retry limits (caller owns rate control)
- Provide retry libraries or SDKs

**Timeout Enforcement:**
- Enforce caller-provided timeouts (caller enforces via request cancellation)
- Provide timeout middleware or utilities
- Track timeout occurrences

**Rate Limiting:**
- Enforce service-level rate limits (only provider rate limits surfaced)
- Implement client-side rate limiting
- Track rate limit violations

**Billing & Quotas:**
- Calculate billing amounts (caller uses token counts for billing)
- Enforce user quotas (caller tracks usage and enforces limits)
- Track per-user usage (service has no user identity)
- Aggregate token usage across requests

**Idempotency & Deduplication:**
- Deduplicate retry requests (caller implements idempotency keys)
- Implement idempotency cache or store
- Correlate retries (each retry is new execution with new executionId)

**State Persistence:**
- Store execution state in database or cache
- Provide state query or mutation APIs
- Track state across retries or requests
- Implement workflow orchestration or state machine

**Content Logging:**
- Log user prompts or AI responses (privacy by design)
- Implement content logging opt-in (caller owns content logging)
- Track conversation history (caller owns conversation state)

**Failure Analysis:**
- Aggregate failure rates (caller queries logs for analytics)
- Detect failure patterns (caller implements monitoring)
- Alert on high failure rates (caller implements alerting)
- Provide failure dashboards (caller implements dashboards)

**Cancellation Guarantees:**
- Guarantee cancellation succeeds (best-effort only)
- Refund tokens if cancellation too late (tokens recorded if provider completed)
- Track cancellation attempts

### 3.2 Adapter Non-Responsibilities

Adapters explicitly do NOT:

**Error Recovery:**
- Retry provider API calls (violates stateless execution model)
- Implement fallback providers (service does not support multi-provider failover)
- Transform failures into successes

**State Management:**
- Transition to terminal states (service does this after adapter returns)
- Record tokens (service does this after adapter returns)
- Log state transitions (service does this)

**Validation:**
- Validate requests beyond provider requirements (service validates before adapter)
- Enforce service-level validation rules
- Perform schema validation (service does this before routing)

### 3.3 Caller Non-Responsibilities

Callers are NOT responsible for:

**Service Operation:**
- Detecting service bugs (service owns observability)
- Reporting adapter failures (service logs failures)
- Implementing provider fallback (service does not expose multiple providers per request)

**Token Recording:**
- Recording tokens manually (service records automatically on success)
- Validating token counts (service trusts provider)
- Aggregating tokens across retries (each execution records independently if successful)

**State Tracking:**
- Query execution state (no state query API exists)
- Mutate execution state (no state mutation API exists)
- Track state across retries (each retry is new execution with new executionId)

---

## 4. Architecture Snapshot

### 4.1 Service Responsibilities

The AI Service owns:

**Execution Orchestration:**
- Receive execution request from caller
- Validate request structure and parameters
- Select adapter based on request
- Invoke adapter with validated request
- Record tokens to token-usage table (on success only)
- Return AIExecutionResult (success) OR throw AIExecutionException (failure)

**State Transitions:**
- Progress execution through lifecycle states (received → validating → routing → executing → recording_tokens → completed/failed)
- Detect failures and transition to failed state
- Generate executionId at request entry

**Observability:**
- Log entry event (executionId, timestamp, adapter, provider, model)
- Log exit event (outcome, tokens/error, duration)
- Propagate caller-provided correlation IDs (sessionId, userId, conversationId)
- Redact content (never log user prompts or AI responses)

**Exception Handling:**
- Throw typed exceptions (AIValidationException, AIProviderException, etc.)
- Populate exception metadata (executionId, category, adapter, provider, model)
- Sanitize exception messages (remove PII, paths, API keys)

### 4.2 Adapter Responsibilities

Adapters own:

**Provider Invocation:**
- Invoke provider API (Anthropic, OpenAI, Google)
- Map request to provider-specific format
- Parse provider response into AIExecutionResult

**Error Mapping:**
- Map provider errors to canonical exception types (AIProviderException, AIRateLimitException)
- Extract provider error codes and HTTP status codes
- Preserve provider-specific error context

**Token Extraction:**
- Extract token counts from provider response
- Return token counts to service for recording

### 4.3 Caller Responsibilities

Callers own:

**Request Orchestration:**
- Construct AIExecutionRequest with valid parameters
- Provide optional correlation IDs (sessionId, userId, conversationId)
- Invoke service and handle response (AIExecutionResult or AIExecutionException)

**Retry Logic:**
- Decide whether to retry based on exception type (per Phase 15C retry eligibility)
- Implement exponential backoff with jitter
- Respect retryAfterSeconds (for AIRateLimitException)
- Limit retry attempts to avoid retry storms

**Idempotency:**
- Implement idempotency keys to deduplicate retries
- Cache responses to avoid duplicate execution (optional optimization)

**Timeout Enforcement:**
- Enforce timeouts via request cancellation (HTTP abort, timeout signal)
- Handle timeout gracefully (may result in failed OR completed depending on timing)

**Billing & Quotas:**
- Track successful executions (AIExecutionResult with tokensUsed > 0)
- Bill end users based on token counts (only for successful executions)
- Enforce per-user quotas (track usage, reject requests when quota exceeded)
- NEVER bill for failed executions (all failures produce zero tokens)

**Rate Limiting:**
- Implement client-side rate limiting to avoid provider rate limits
- Backoff when receiving AIRateLimitException
- Track rate limit errors and adjust request rate

**Content Logging:**
- Decide whether to log conversation content (user prompts, AI responses)
- Implement user consent for content logging
- Comply with privacy regulations (GDPR, CCPA)
- Redact sensitive user data before calling service (if required by policy)

**Observability:**
- Correlate executions via sessionId, userId, conversationId
- Query logs for analytics (failure rates, duration histograms, token usage)
- Implement dashboards and alerting (optional)

### 4.4 Provider Responsibilities

Providers (external AI APIs: Anthropic, OpenAI, Google) own:

**AI Execution:**
- Process AI request and generate response
- Return structured response with token counts
- Return structured errors with error codes and HTTP status

**Rate Limiting:**
- Enforce rate limits and quotas
- Return HTTP 429 with retryAfterSeconds (if applicable)

**Documentation:**
- Document error semantics and retry guidance
- Document token counting methodology

---

## 5. Safe Resume Point

### 5.1 What Future Phases May Build On

Future phases (Phase 16+) may implement the policies defined in Phase 15:

**Phase 16+: Exception Implementation**
- Define TypeScript/NestJS exception classes (AIExecutionException, AIValidationException, etc.)
- Populate exception metadata (executionId, category, adapter, provider, model)
- Implement exception sanitization (remove PII, paths, API keys)

**Phase 17+: Observability Implementation**
- Implement structured logging (JSON-formatted logs)
- Add distributed tracing (OpenTelemetry spans)
- Implement metrics (Prometheus counters, histograms)
- Log entry/exit events per Phase 15B policy

**Phase 18+: Adapter Error Mapping**
- Map Anthropic errors to canonical exceptions
- Map OpenAI errors to canonical exceptions
- Map Google errors to canonical exceptions
- Extract provider error codes and HTTP status codes

**Phase 19+: Token Recording Implementation**
- Implement token recording logic (database insert to token-usage table)
- Ensure atomic token recording (recorded before response returned)
- Handle token recording failures (transition to failed state)

**Phase 20+: Caller-Side Utilities**
- Provide optional retry libraries (exponential backoff, jitter)
- Provide optional timeout utilities (request cancellation)
- Provide optional idempotency utilities (caching, deduplication)

**Phase 21+: Advanced Observability**
- Add debug logging (verbose logs for internal states)
- Implement log aggregation (caller-side analytics)
- Add content logging opt-in (callers explicitly enable conversation logging)

### 5.2 What Future Phases Must NOT Change

The following Phase 15 policies are **immutable** for all v1.x versions:

**Execution Model Invariants:**
- ✅ Service is stateless (no cross-request state tracking)
- ✅ Service is synchronous (no async execution or callbacks)
- ✅ Throw-only error semantics (never return error codes)
- ✅ Token recording only on success (all failures produce zero tokens)
- ✅ Deterministic outcome (result OR exception, never both)

**Observability Invariants:**
- ✅ Content is never logged by service (user prompts, AI responses always redacted)
- ✅ executionId is unique per request (never reused)
- ✅ Audit trail is synchronous (logs emitted before response returned)
- ✅ Callers own content visibility (service does not enforce content logging policies)

**Failure Invariants:**
- ✅ Exception types are stable (class names are part of public API contract)
- ✅ Token zero guarantee (all failures produce zero tokens)
- ✅ Retry eligibility is stable (validation never retryable, rate_limit always retryable)
- ✅ Callers own retries (service never implements automatic retries)

**Lifecycle Invariants:**
- ✅ States are logical, not persisted (no state storage or query APIs)
- ✅ Linear state progression (no backwards or skipped transitions)
- ✅ Cancellation is best-effort (no guaranteed cancellation)
- ✅ Token recording only in completed state (failed state always zero tokens)

**Responsibility Invariants:**
- ✅ Callers own retries, idempotency, quotas, billing, timeouts
- ✅ Service owns single execution, adapter selection, token recording
- ✅ Adapters own provider invocation and error mapping

### 5.3 Breaking Changes Requiring Phase 15 Reopening

Changing any of the following requires formal reopening of Phase 15:

1. **Introduce service-level retries** (violates stateless execution model)
2. **Record tokens on failure** (violates token-only-on-success policy)
3. **Return error codes instead of exceptions** (violates throw-only semantics)
4. **Log user prompts or AI responses** (violates content privacy policy)
5. **Persist execution state** (violates stateless model)
6. **Implement async execution** (violates synchronous model)
7. **Guarantee cancellation** (violates best-effort cancellation policy)
8. **Change exception class names** (breaks public API contract)
9. **Make validation errors retryable** (violates retry eligibility policy)
10. **Implement service-level billing or quotas** (violates caller responsibility policy)

If any breaking change is required:
1. Reopen Phase 15 formally via governance process
2. Update Phase 15 checkpoint documents (15A, 15B, 15C, 15D, final)
3. Bump version to v2.0
4. Notify all callers of breaking changes
5. Provide migration guide

---

## 6. Rollback Guidance

### 6.1 Detecting Phase 15 Violations

Future phases may inadvertently violate Phase 15 policies. Watch for:

**Execution Model Violations:**
- ❌ Service tracks retries or aggregates executions → Violates stateless model
- ❌ Service queues requests or executes async → Violates synchronous model
- ❌ Service returns error objects instead of throwing → Violates throw-only semantics
- ❌ Service records partial tokens on failure → Violates token-only-on-success policy

**Observability Violations:**
- ❌ Service logs user prompts or AI responses → Violates content privacy policy
- ❌ Service reuses executionId across retries → Violates unique executionId policy
- ❌ Service queues logs or batches audit events → Violates synchronous logging policy

**Failure Violations:**
- ❌ Service retries provider calls automatically → Violates stateless model
- ❌ Service changes exception class names → Breaks public API contract
- ❌ Service bills for failed executions → Violates token zero guarantee

**Lifecycle Violations:**
- ❌ Service persists execution state to database → Violates stateless model
- ❌ Service provides state query API → Violates stateless model
- ❌ Service guarantees cancellation succeeds → Violates best-effort policy

**Responsibility Violations:**
- ❌ Service implements billing calculation → Violates caller responsibility
- ❌ Service enforces quotas → Violates caller responsibility
- ❌ Service implements idempotency → Violates caller responsibility

### 6.2 Rollback Procedure

If Phase 15 violation is detected in future phases:

**Step 1: Identify Violation**
- Determine which Phase 15 policy is violated
- Reference Phase 15 checkpoint documents (15A, 15B, 15C, 15D, final)
- Confirm violation with project governance

**Step 2: Assess Impact**
- Determine if violation is in policy (design docs) or implementation (code)
- Identify which components are affected (service, adapters, callers)
- Assess whether violation is breaking change (affects public API contract)

**Step 3: Revert or Reopen**
- **If implementation violates policy:** Revert implementation to align with Phase 15 policy
- **If policy requires change:** Formally reopen Phase 15 via governance process

**Step 4: Restore Phase 15 Compliance**
- Remove code that violates Phase 15 policies
- Restore original behavior per Phase 15 checkpoint
- Update documentation if necessary
- Notify affected callers if public API changed

**Step 5: Prevent Future Violations**
- Add tests that enforce Phase 15 policies (e.g., assert zero tokens on exception)
- Document Phase 15 invariants in code comments
- Review future phases against Phase 15 checkpoint before implementation

### 6.3 Rollback Decision Matrix

| Violation Type | Rollback Action | Version Impact |
|----------------|-----------------|----------------|
| Implementation violates policy (execution model) | Revert code to Phase 15 compliance | Patch (v1.x.y+1) |
| Implementation violates policy (observability) | Revert code to Phase 15 compliance | Patch (v1.x.y+1) |
| Implementation violates policy (failure handling) | Revert code to Phase 15 compliance | Patch (v1.x.y+1) |
| Policy requires change (non-breaking) | Reopen Phase 15, update design | Minor (v1.x+1.0) |
| Policy requires change (breaking API) | Reopen Phase 15, update design | Major (v2.0.0) |
| Exception class names changed | Revert immediately (breaks contract) | Major (v2.0.0) if released |
| Content logging added to service | Revert immediately (privacy violation) | Patch (v1.x.y+1) |
| Service-level retries added | Revert or reopen Phase 15 | Major (v2.0.0) if required |

---

## Declaration of Finality

### Completion Statement

**Phase 15 is COMPLETE and FROZEN as of 2026-02-05.**

Phase 15 consists of:
- Phase 15A: Execution Boundaries & Invariants (COMPLETE)
- Phase 15B: Execution Observability & Audit Policy (COMPLETE)
- Phase 15C: Execution Failure Taxonomy & Caller Responsibility Policy (COMPLETE)
- Phase 15D: Execution Lifecycle & State Model (COMPLETE)

All four sub-phases are locked and immutable for v1.x versions.

### Immutability Clause

No changes to Phase 15 policies are permitted without:

1. Formal reopening of Phase 15 via project governance
2. Explicit approval from project authority (per CLAUDE.md governance loop)
3. Version bump to v2.0 (if changes are breaking)
4. Update to all Phase 15 checkpoint documents (15A, 15B, 15C, 15D, final)
5. Notification to all callers of breaking changes
6. Migration guide for affected components

### Policy Authority

Phase 15 checkpoint documents are the **authoritative source** for AI Service execution contracts. In case of conflict:

1. Phase 15 checkpoints supersede code comments
2. Phase 15 checkpoints supersede implementation assumptions
3. Phase 15 checkpoints supersede "helpful" feature additions
4. Phase 15 checkpoints supersede convenience refactors

**PHASE 15 WINS.**

### Integration with Prior Phases

Phase 15 builds on and extends prior phases:

**Phase 13 (Token Recording):**
- Phase 15A locks token-recording-only-on-success policy from Phase 13
- Phase 15D integrates token recording into lifecycle (recording_tokens state)

**Phase 14 (Execution Flow):**
- Phase 15A extends Phase 14 execution flow with caller responsibility boundaries
- Phase 15D formalizes Phase 14 execution flow as lifecycle state model

**Phase 1-12:**
- All prior phases remain complete and locked
- Phase 15 does not modify prior phase contracts

### Next Phase

**Phase 16** (and beyond) will implement Phase 15 policies:
- Exception classes (Phase 15C implementation)
- Observability logging (Phase 15B implementation)
- Adapter error mapping (Phase 15C implementation)
- Token recording logic (Phase 15A implementation)

Phase 16+ must adhere to all Phase 15 policies without exception.

---

**END OF PHASE 15 FINAL CHECKPOINT**
