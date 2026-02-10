# PHASE 15A CHECKPOINT: Caller Responsibility & Integration Policy

**Status:** COMPLETE and LOCKED
**Nature:** Design-Only Phase / Policy Definition
**Version:** v1.0
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Caller ownership locked:** Retries, idempotency, timeouts, quotas, billing are caller responsibilities
• **Service statelessness preserved:** No conversation state, no request deduplication, no quota tracking
• **Billing safety enforced:** Bill only on success, never on exception, guard against double-billing
• **Non-idempotent execution acknowledged:** Identical requests produce different results, callers must handle
• **Integration contract complete:** Phases 13, 14, and 15A form the complete v1.0 integration boundary

---

## 1. Phase Declaration

### 1.1 Status

**Phase 15A is COMPLETE and LOCKED as of 2026-02-05.**

### 1.2 Design-Only Confirmation

Phase 15A is a **design-only phase**. No code was written. No implementation was prescribed. This phase defines **policy boundaries** that govern how callers integrate with the AI Service.

Phase 15A establishes the binding integration contract between callers and the AI Service, completing the contract foundation started in Phases 13 and 14.

---

## 2. Scope Summary

### 2.1 What Phase 15A Defines

Phase 15A defines:

- **Caller responsibilities** — What callers must implement to safely use the AI Service
- **Service non-responsibilities** — What the AI Service will never provide
- **Retry policy** — When retries are permitted, forbidden, and risky
- **Idempotency policy** — Why the service is not idempotent and how callers must compensate
- **Timeout ownership** — Provider SDK timeouts vs caller-enforced timeouts
- **Quota enforcement policy** — Why quotas belong in the caller layer
- **Billing safety rules** — When billing may and must not occur
- **Integration hazards** — Double-billing, retry storms, inconsistent state scenarios

### 2.2 What Phase 15A Does NOT Define

Phase 15A explicitly does NOT define:

- Service-level retry logic (locked as non-existent by Phase 13)
- Service-level idempotency enforcement (locked as non-existent by Phase 14)
- Service-level quota enforcement (locked as non-existent by Phase 14)
- Service-level timeout enforcement (deferred to future phases)
- Caller implementation details (how callers implement policies)
- Billing calculation logic (business logic, not service concern)
- User authentication mechanisms (infrastructure concern)
- Conversation state management (application logic)

---

## 3. Locked Caller Responsibilities

The following responsibilities are **permanently assigned to callers** for all v1.x versions:

### 3.1 Retry Ownership

- **Callers own retry logic**
- Service never retries requests (locked by Phase 13)
- Callers may retry transient failures (AIProviderError, AIRateLimitError)
- Callers must not retry non-retryable failures (AIInvalidRequestError, AIContentFilterError, AIModelNotFoundError)
- Callers must accept non-idempotent execution when retrying

### 3.2 Idempotency Ownership

- **Callers own idempotency enforcement**
- Service does not deduplicate requests (locked by Phase 14)
- Callers must generate idempotency keys for user-initiated requests
- Callers must cache successful results to prevent duplicate execution
- Callers must cache only successful results, never failures
- Callers must handle cache expiration gracefully

### 3.3 Timeout Ownership

- **Callers own total execution timeout enforcement**
- Provider SDKs enforce provider-level timeouts (600 seconds default)
- Service does not enforce orchestrator-level timeouts (deferred to future phases)
- Callers must implement request timeouts to protect against indefinite blocking
- Recommended caller timeout: 30–60 seconds for interactive use cases

### 3.4 Quota Enforcement Ownership

- **Callers own per-user quota enforcement**
- Service is stateless and has no concept of user identity, usage history, or quota policies
- Callers must track per-user token usage
- Callers must reject requests that would exceed quotas before calling the service
- Callers must increment usage only on successful execution (result.tokensUsed)

### 3.5 Billing Safety Ownership

- **Callers own billing logic and safety**
- Callers may bill only when service returns AIExecutionResult
- Callers must never bill on exceptions, timeouts, or validation rejections
- Callers must guard against double-billing via idempotency
- Billing source of truth: result.tokensUsed from successful requests only

### 3.6 Additional Caller Responsibilities

- **Input validation** — Callers must validate user input before calling service
- **Conversation context** — Callers must provide full conversation history (service is stateless)
- **Error handling** — Callers must interpret and present exceptions to users
- **User authentication** — Callers must authenticate users before calling service
- **Abuse prevention** — Callers must implement rate limiting and spam detection
- **Logging and monitoring** — Callers must implement user-facing observability

---

## 4. Locked Service Guarantees

The following service guarantees are **locked and immutable** for all v1.x versions:

### 4.1 Deterministic Execution Outcome

- Service executes each request exactly once
- Service returns exactly one of: AIExecutionResult (success) or typed exception (failure)
- Never both, never neither

### 4.2 Token Recording Rules

- Service records tokens only on successful execution
- Service never records tokens on failure (any exception type)
- Service never records partial token usage
- Token counts reflect actual provider-reported usage

### 4.3 Exception Propagation Rules

- Service propagates errors via typed exceptions only
- No silent failures
- No error codes in success responses
- Exception types are stable, exception messages are informational only

### 4.4 Stateless Behavior

- Service maintains no conversation history
- Service maintains no user identity or session state
- Service maintains no usage history or quota tracking
- Each request is independent and self-contained

### 4.5 No Service-Level Retries

- Service never retries failed requests
- Each request is executed exactly once
- Callers must implement retry logic if desired

### 4.6 No Service-Level Idempotency

- Service does not deduplicate requests
- Identical requests may produce different results
- Callers must implement idempotency if desired

### 4.7 No Service-Level Quotas

- Service does not enforce per-user quotas
- Service does not track usage history
- Callers must implement quota enforcement

---

## 5. Explicit Non-Guarantees

Callers **must never assume** the following guarantees:

### 5.1 Output Determinism

- Identical requests may produce different AI-generated content
- AI model behavior is non-deterministic by nature
- Temperature, sampling, and model updates affect results

### 5.2 Token Count Determinism

- Token counts may vary for identical inputs
- Provider tokenization logic may change
- Different models tokenize differently

### 5.3 Execution Duration Determinism

- Response time is not guaranteed
- Execution duration depends on model, load, and provider performance
- No SLA on latency

### 5.4 Provider Stability

- Provider availability is not guaranteed
- Provider API changes may affect behavior
- Provider errors are propagated to callers

### 5.5 Model Availability

- Specific models may become unavailable
- Model identifiers may change over time
- Deprecated models may be removed by providers

### 5.6 Service-Level Timeouts

- Service does not currently enforce orchestrator-level timeouts
- Callers must enforce their own timeouts
- Provider SDK timeouts are the only timeout layer

### 5.7 Service-Level Quotas

- Service does not enforce per-user quotas
- Service does not track usage history
- Callers must enforce quotas before calling service

---

## 6. Architecture Boundary Snapshot

### 6.1 Responsibility Separation Narrative

The AI Service architecture establishes a clear boundary between service responsibilities and caller responsibilities:

**Service Layer (AI Service):**
- Accepts valid AIExecutionRequest objects
- Routes requests to appropriate provider adapters
- Orchestrates adapter execution
- Records tokens on successful execution only
- Returns AIExecutionResult or throws typed exception
- Maintains stateless operation

**Caller Layer (API Gateway, Future Clients):**
- Authenticates users and validates permissions
- Validates user input before calling service
- Provides complete conversation context (no state assumed)
- Implements retry logic for transient failures
- Implements idempotency to prevent duplicate execution
- Enforces request timeouts to prevent indefinite blocking
- Tracks per-user token usage and enforces quotas
- Bills users only for successful executions
- Interprets and presents errors to users
- Implements rate limiting and abuse prevention
- Implements user-facing logging and monitoring

**Boundary Rule:**
The service provides deterministic execution semantics (one request → one result or exception) but no operational policies (retries, idempotency, quotas, timeouts). Callers own all operational policies and user-facing concerns.

### 6.2 Why This Boundary Exists

This separation exists to:

- **Preserve statelessness** — Service has no user identity, session state, or usage history
- **Enable flexibility** — Callers can implement custom retry, idempotency, and quota policies
- **Simplify service logic** — Service focuses on execution orchestration, not policy enforcement
- **Support multiple caller types** — Different callers may have different operational requirements
- **Align with Phase 14 contract** — Service guarantees synchronous execution, callers own everything else

---

## 7. Invariant Enforcement

### 7.1 Cross-Reference to Phase 13

Phase 13 established internal orchestration policy:

- Service executes requests synchronously
- Service orchestrates adapter calls
- Service records tokens on success only
- Service never retries failed requests
- Service propagates exceptions synchronously

**Phase 15A preserves all Phase 13 invariants.** No Phase 13 guarantees were altered.

### 7.2 Cross-Reference to Phase 14

Phase 14 locked the external public API contract:

- Synchronous request/response model
- Deterministic outcome semantics (result or exception, never both)
- Token recording only on success
- Typed exception propagation
- Stateless operation
- No service-level retries, idempotency, or quotas

**Phase 15A preserves all Phase 14 invariants.** No Phase 14 guarantees were altered.

### 7.3 Phase 15A Contribution

Phase 15A completes the integration contract by defining:

- Caller responsibilities (what callers must implement)
- Service non-responsibilities (what service will never provide)
- Integration policies (retry, idempotency, timeout, quota, billing)

**Phase 15A adds no new service guarantees.** Phase 15A only clarifies caller obligations.

---

## 8. Safe Resume Point

### 8.1 What Future Phases May Build On

Future phases may:

- **Define reference architectures** — Recommended caller-side implementation patterns
- **Provide caller-side libraries** — SDKs for common patterns (retry, idempotency, quota enforcement)
- **Add service-level timeout enforcement** — Orchestrator-level timeouts (Phase 16+)
- **Add service-level observability hooks** — Tracing, metrics, logging enhancements (Phase 17+)
- **Introduce streaming execution** — Separate contract for streaming responses (Phase 18+)
- **Add new provider adapters** — Support for additional AI providers (Cohere, Mistral, etc.)
- **Optimize internal execution** — Caching, batching, performance improvements (transparent to callers)

### 8.2 What Future Phases Must NOT Change

The following are **immutable** for all v1.x versions:

- **Caller owns retries** — Service will never retry
- **Caller owns idempotency** — Service will never deduplicate
- **Caller owns quotas** — Service will never enforce quotas
- **Caller owns billing safety** — Service will never track billing or prevent double-billing
- **Service is stateless** — Service will never maintain conversation history or user state
- **Token recording on success only** — Service will never record tokens on failure
- **Synchronous execution** — Service will never introduce async callbacks or polling (for v1.0 contract)

Changing any of these requires:

1. Formal reopening of Phase 14
2. Version bump to v2.0
3. Update to Phase 14 checkpoint document
4. Notification to all callers of breaking changes

---

## 9. Rollback & Audit Guidance

### 9.1 Rollback Trigger

If any future work violates Phase 15A caller responsibility boundaries, rollback is required.

**Violation examples:**

- Service implements automatic retry logic
- Service implements request deduplication
- Service enforces per-user quotas
- Service maintains conversation state
- Service implements billing logic
- Service records tokens on failure

### 9.2 Rollback Procedure

1. **Identify the violation** — Document which Phase 15A policy was broken
2. **Revert the offending changes** — Roll back code to last Phase 15A-compliant state
3. **Notify stakeholders** — Alert all callers and downstream consumers
4. **Verify invariants** — Confirm Phases 13, 14, and 15A guarantees are restored
5. **Choose path forward:**
   - **Option A:** Redesign to maintain Phase 15A boundaries
   - **Option B:** Formally reopen Phase 14 and 15A, bump to v2.0, redefine contract

### 9.3 Why Rollback Is Safe

Rollback is safe because:

- Phase 15A is design-only (no code to revert)
- Phase 15A adds no new service code (only clarifies existing behavior)
- Phase 15A caller responsibilities are enforced by callers (not service)
- Git checkpoints enable safe rollback to Phase 15A completion state
- Integration tests verify Phase 13 and 14 guarantees remain intact

### 9.4 Audit Checklist

To verify Phase 15A compliance, audit:

- **Service code does not retry requests** — No retry loops in AIExecutionService
- **Service code does not deduplicate requests** — No request ID tracking or caching
- **Service code does not enforce quotas** — No usage tracking or limit checks
- **Service code does not maintain state** — No conversation history storage
- **Service code records tokens only on success** — Token recording only in success path
- **Caller code implements retries** — Callers handle transient failures
- **Caller code implements idempotency** — Callers deduplicate user requests
- **Caller code enforces quotas** — Callers track usage and reject over-quota requests
- **Caller code enforces timeouts** — Callers implement request timeout logic
- **Caller code implements billing safety** — Callers bill only on success, guard against double-billing

---

## Declaration of Finality

### Completion Statement

**Phase 15A is COMPLETE and LOCKED as of 2026-02-05.**

### Immutability Clause

No changes to caller responsibility boundaries are permitted without:

1. Formal reopening of Phase 15A
2. Explicit approval from project governance
3. Version bump to v2.0 (if service responsibilities change)
4. Update to this checkpoint document

### Contract Authority

This document is the **authoritative source** for caller responsibility policy. In case of conflict:

1. This document supersedes code comments
2. This document supersedes implementation assumptions
3. This document supersedes "helpful" refactors

**THIS DOCUMENT WINS.**

### Integration Contract Completion

Phase 15A completes the v1.0 integration contract:

- **Phase 13:** Internal orchestration policy
- **Phase 14:** External public API contract
- **Phase 15A:** Caller responsibility policy

Together, these three phases define the complete, immutable integration boundary for AI Service v1.0.

---

**END OF PHASE 15A CHECKPOINT**
