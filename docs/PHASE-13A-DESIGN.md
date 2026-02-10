# PHASE 13A - DESIGN DOCUMENT

**Execution Orchestration Policy**

---

## STATUS

**DESIGN ONLY – NO IMPLEMENTATION**

Phase: 13A
Design Date: 2026-02-05
Checkpoint Type: Stage Design Document

---

## PHASE CONTEXT

### Previous Phase (LOCKED)

Phase 12B established the provider adapter architecture with the following locked properties:
- AIAdapter interface (stateless, throw-only semantics)
- Four adapter implementations (Stub, Anthropic, OpenAI, Groq)
- Factory provider pattern for adapter selection
- ConfigService-based environment variable resolution
- Token extraction in adapters, recording in service
- Single-turn execution model

All Phase 12B contracts and patterns remain LOCKED and IMMUTABLE.

### Phase 13A Purpose

Phase 13A defines the **execution orchestration policy** that governs how AIExecutionService manages execution flow, error handling, and lifecycle management. This is a design-only phase that establishes boundaries and policy decisions without implementing new functionality.

---

## RESPONSIBILITY BOUNDARIES

### AIExecutionService Responsibilities

The AIExecutionService is the orchestration layer and is responsible for:

1. **Execution Routing:**
   - Accept AIExecutionRequest from callers
   - Resolve concrete AIAdapter via DI token (AI_ADAPTER)
   - Invoke adapter.execute(request)
   - Return AIExecutionResult to caller

2. **Token Recording:**
   - Record token usage after successful execution
   - Delegate to token recording system (not directly to database)
   - Associate tokens with session/conversation/user context
   - Handle token recording failures gracefully (log but do not fail execution)

3. **Error Propagation:**
   - Allow adapter exceptions to propagate without modification
   - Preserve exception type and message
   - Add execution context metadata if needed for observability

4. **Execution Lifecycle Management:**
   - Log execution start (session ID, conversation ID, provider selected)
   - Log execution completion (success or failure, duration, tokens)
   - Maintain audit trail for debugging and observability

### AIAdapter Responsibilities (Restated from Phase 12B)

Adapters are provider-specific execution units and are responsible for:

1. **Provider Integration:**
   - Transform AIExecutionRequest to provider-specific format
   - Execute request via provider SDK
   - Transform provider response to AIExecutionResult

2. **Token Extraction:**
   - Extract token usage from provider response
   - Return tokensUsed in AIExecutionResult
   - DO NOT persist or record tokens

3. **Error Mapping:**
   - Map provider errors to NestJS exception types
   - Throw exceptions (no error payloads in result)
   - Follow consistent exception mapping rules (401→UnauthorizedException, etc.)

4. **Stateless Execution:**
   - No conversation history management
   - No hidden state between calls
   - Deterministic behavior for same request

### Upstream Caller Responsibilities

Callers of AIExecutionService (controllers, handlers, other services) are responsible for:

1. **Request Construction:**
   - Provide valid AIExecutionRequest with required fields
   - Ensure sessionId, conversationId, userId are valid and authorized
   - Manage prompt construction and context injection (if needed)

2. **Error Handling:**
   - Catch exceptions from AIExecutionService
   - Transform exceptions to appropriate response format (HTTP, GraphQL, etc.)
   - Log errors at API boundary with appropriate detail level

3. **Retry Logic (If Implemented):**
   - Implement retry logic at caller level (not in service or adapters)
   - Respect idempotency constraints (see below)
   - Implement backoff strategies for transient failures

4. **Result Processing:**
   - Extract output from AIExecutionResult
   - Store conversation messages if needed
   - Update UI or downstream systems

---

## EXECUTION LIFECYCLE

### Execution Start

**Policy:**
- Execution begins when AIExecutionService.execute() is invoked
- Service logs execution start with metadata: timestamp, sessionId, conversationId, userId, provider
- Service resolves adapter via DI token (no dynamic selection logic)
- Service invokes adapter.execute() with unmodified request

**Guarantees:**
- Request payload is NOT modified by service before delegation
- Adapter receives exactly the AIExecutionRequest provided by caller

### Successful Execution

**Policy:**
- Adapter returns AIExecutionResult with output, tokensUsed, model
- Service records tokens via token recording system
- Service logs execution success with metadata: duration, tokensUsed, model
- Service returns AIExecutionResult to caller

**Token Recording Semantics:**
- Token recording occurs AFTER adapter returns successfully
- Token recording failure does NOT invalidate execution result
- Token recording failure is logged as warning (not error)
- Execution result is returned to caller even if token recording fails

**Rationale:** Token recording is an auditing/billing concern, not an execution concern. Execution success should not depend on recording system availability.

### Failed Execution

**Policy:**
- Adapter throws exception (any NestJS HttpException type)
- Exception propagates through service without modification
- Service logs execution failure with metadata: duration, exception type, error message
- NO token recording occurs for failed executions
- Exception propagates to caller

**Token Recording Semantics:**
- Failed executions do NOT generate token records
- Partial executions (timeouts, errors mid-stream) do NOT record tokens
- Only completed executions record tokens

**Rationale:** Prevents double-counting tokens in retry scenarios. Ensures billing accuracy by only charging for successful completions.

### Abort / Timeout

**Policy (Conceptual Only):**
- If orchestrator-level timeout is implemented in future, it would:
  - Throw ServiceUnavailableException
  - NOT record tokens
  - Log timeout event with duration and context
- Adapter-level timeouts (from provider SDKs) remain unchanged:
  - Adapter throws ServiceUnavailableException
  - No special handling in orchestrator

**Current State:**
- No orchestrator-level timeout enforcement
- Adapter SDK timeouts remain as implemented in Phase 12B
- Future phases MAY add orchestrator timeout following this policy

---

## RETRY POLICY

### Retry Location Decision

**Policy Decision: NO RETRIES AT SERVICE OR ADAPTER LEVEL**

Retry logic is explicitly FORBIDDEN in:
- ❌ AIExecutionService
- ❌ AIAdapter implementations
- ❌ Factory provider logic

Retry logic MAY be implemented in:
- ✓ Upstream callers (controllers, handlers, other services)
- ✓ Client-side code (frontend, CLI)
- ✓ API Gateway or proxy layer (if external to service)

### Rationale

1. **Token Recording Accuracy:**
   - Retries at service level risk duplicate token recording
   - Service cannot distinguish between first attempt and retry
   - Caller can manage retry state and prevent double-billing

2. **Single Responsibility:**
   - Service responsibility is execution orchestration, not reliability engineering
   - Retry logic is a reliability concern that varies by caller needs
   - Different callers may have different retry strategies

3. **Transparency:**
   - Callers have full visibility into failure reasons
   - Callers can decide which failures are retryable
   - Callers can implement backoff strategies appropriate to their use case

4. **Stateless Design:**
   - Service remains stateless (no retry state management)
   - Simplifies service implementation and testing
   - Maintains Phase 12B's stateless execution model

### Retry Guidance for Callers

**Retryable Error Types:**
- ServiceUnavailableException (5xx, timeout, network errors)
- Rate limit errors (429) with exponential backoff

**Non-Retryable Error Types:**
- UnauthorizedException (401) - configuration error
- BadRequestException (400) - invalid request
- InternalServerErrorException (500) - may indicate provider outage, retry with caution

**Retry Best Practices:**
- Implement exponential backoff (e.g., 1s, 2s, 4s, 8s)
- Limit retry attempts (e.g., max 3 retries)
- Add jitter to prevent thundering herd
- Log each retry attempt for observability

---

## TIMEOUT OWNERSHIP

### Adapter-Level Timeouts (Current State)

**Owner:** Provider SDKs

**Policy:**
- Anthropic SDK, OpenAI SDK, and Groq SDK have default timeout values
- Adapters do NOT override these defaults
- Timeout exceptions from SDKs are mapped to ServiceUnavailableException
- No custom timeout logic in adapters

**Behavior:**
- If provider SDK times out, adapter throws ServiceUnavailableException
- Exception propagates to caller
- No tokens recorded for timed-out executions

### Orchestrator-Level Timeouts (Future Consideration)

**Owner:** AIExecutionService (if implemented)

**Policy (Conceptual):**
- Orchestrator MAY enforce maximum execution time (e.g., 60 seconds)
- Orchestrator timeout MUST be longer than provider SDK timeout
- If orchestrator timeout triggers, throw ServiceUnavailableException
- No token recording for timed-out executions

**Current State:**
- NOT IMPLEMENTED
- Orchestrator relies on provider SDK timeouts only
- Future phases may add orchestrator timeout following this policy

### Caller-Level Timeouts (Caller Responsibility)

**Owner:** Upstream callers

**Policy:**
- Callers MAY enforce their own timeouts (e.g., API request timeout)
- Caller timeout MUST be longer than orchestrator timeout (if implemented)
- Caller timeout should account for network latency and retries
- Timeout at caller level does NOT affect service behavior

---

## IDEMPOTENCY & DETERMINISM

### Execution Idempotency

**Policy: EXECUTIONS ARE NOT IDEMPOTENT**

Multiple calls to AIExecutionService.execute() with the same AIExecutionRequest will:
- Invoke the adapter multiple times
- Generate multiple provider API calls
- Produce potentially different results (non-deterministic responses from providers)
- Record tokens multiple times

**Rationale:**
- Provider APIs (Anthropic, OpenAI, Groq) are NOT idempotent
- Same prompt may produce different outputs due to model non-determinism
- Idempotency requires request deduplication logic (out of scope for Phase 13A)
- Retry scenarios require caller to manage duplicate prevention

**Caller Guidance:**
- If idempotency is required, callers must implement deduplication logic
- Use request IDs or correlation IDs to detect duplicates
- Store results and return cached response for duplicate requests
- DO NOT rely on service for idempotency guarantees

### Execution Determinism

**Policy: EXECUTIONS ARE NOT DETERMINISTIC**

Same AIExecutionRequest may produce different results due to:
- Provider model non-determinism (temperature, sampling)
- Provider model updates or version changes
- Provider infrastructure state (rate limits, regional routing)

**Guarantees:**
- Same request to same adapter will use same provider and model
- Adapter behavior is deterministic (same transformation logic)
- Service behavior is deterministic (same orchestration flow)

**Non-Guarantees:**
- Output content may vary between executions
- Token usage may vary slightly between executions
- Execution duration may vary between executions

**Exception: StubAIAdapter**
- StubAIAdapter IS deterministic (always returns same output)
- Used for testing and development only
- NOT representative of real provider behavior

---

## EXPLICIT NON-GOALS

Phase 13A explicitly does NOT define:

### External API Surface
- ❌ No HTTP controllers or REST endpoints
- ❌ No request validation middleware
- ❌ No authentication/authorization logic
- ❌ No API rate limiting
- ❌ No API documentation (OpenAPI/Swagger)

**Deferred To:** Phase 14 (External API Surface)

### Advanced Execution Features
- ❌ No streaming response support
- ❌ No function calling / tool use
- ❌ No multi-modal inputs (vision, audio)
- ❌ No conversation memory or history management
- ❌ No context window optimization

**Deferred To:** Phase 15 (Advanced Features)

### Reliability Patterns (Implementation)
- ❌ No retry logic implementation
- ❌ No circuit breaker implementation
- ❌ No rate limiting implementation
- ❌ No request queuing
- ❌ No load shedding

**Deferred To:** Phase 16 (Reliability Patterns) - if implemented at caller level

### Observability (Implementation)
- ❌ No metrics collection (Prometheus, StatsD)
- ❌ No distributed tracing (OpenTelemetry)
- ❌ No structured logging framework
- ❌ No performance monitoring dashboards

**Deferred To:** Infrastructure/Platform concerns (cross-cutting)

### Billing & Quotas
- ❌ No quota enforcement in service
- ❌ No cost calculation
- ❌ No usage limit checks
- ❌ No billing event publishing

**Deferred To:** Billing system (separate service/module)

### Provider Management
- ❌ No provider health checks
- ❌ No automatic failover between providers
- ❌ No provider load balancing
- ❌ No cost-based provider selection

**Deferred To:** Phase 16+ (Provider Management)

### Configuration Enhancements
- ❌ No dynamic provider configuration
- ❌ No runtime provider switching
- ❌ No configuration hot-reload
- ❌ No per-user provider selection

**Deferred To:** Future phases (if business need arises)

---

## SAFE RESUME POINT

### What Phase 13A Establishes

Phase 13A establishes the following design decisions:

1. **Responsibility Boundaries:**
   - Service owns orchestration and token recording
   - Adapters own provider execution and token extraction
   - Callers own retry logic and error handling

2. **Execution Lifecycle Policy:**
   - Token recording occurs post-success only
   - Failed executions do NOT record tokens
   - Exceptions propagate without modification

3. **Retry Policy:**
   - No retries at service or adapter level
   - Retries implemented at caller level
   - Clear guidance on retryable vs non-retryable errors

4. **Timeout Ownership:**
   - Provider SDKs own timeouts (current)
   - Orchestrator MAY add timeout layer (future)
   - Callers MAY add timeout layer (always)

5. **Idempotency Stance:**
   - Executions are NOT idempotent
   - Callers must implement deduplication if needed
   - Provider non-determinism is acknowledged

### What Phase 13B/13C May Build

**Token Recording Implementation (Phase 13B):**
- Implement actual token recording system integration
- Define token recording service interface
- Handle token recording failures gracefully
- Add token recording tests

**Execution Logging Implementation (Phase 13C):**
- Implement structured logging for execution lifecycle
- Add execution metrics (duration, success rate, error rate)
- Integrate with observability platform (if available)
- Add logging tests

**Orchestrator Timeout Implementation (Phase 13D):**
- Add configurable orchestrator-level timeout
- Implement timeout detection and exception throwing
- Ensure timeout is longer than provider SDK timeouts
- Add timeout tests

### What Must NOT Change Without Breaking This Design

**Locked Design Decisions:**
- ✓ No retries at service/adapter level (requires architectural review)
- ✓ Token recording only for successful executions (maintains billing accuracy)
- ✓ Exception propagation without modification (maintains error transparency)
- ✓ Stateless execution model (Phase 12B locked invariant)
- ✓ Throw-only error semantics (Phase 12B locked invariant)

**Modifiable Implementation Details:**
- Token recording system interface (not yet defined)
- Logging framework and format (not yet defined)
- Timeout values and configuration (not yet defined)
- Metrics collection approach (not yet defined)

---

## LOCKED INVARIANTS (RESTATED FROM PHASE 12B)

Phase 13A does NOT modify any Phase 12B contracts:

- AIExecutionRequest interface (LOCKED)
- AIExecutionResult interface (LOCKED)
- AIAdapter interface (LOCKED)
- AIProviderConfig interface (LOCKED)
- Factory provider pattern (LOCKED)
- Token extraction/recording boundary (LOCKED)
- Throw-only error semantics (LOCKED)
- Stateless execution model (LOCKED)

All Phase 12B adapter implementations remain unchanged:
- StubAIAdapter
- AnthropicAdapter
- OpenAIAdapter
- GroqAdapter

---

## ULTRA-BRIEF SUMMARY

- Service owns orchestration, adapters own execution, callers own retries
- Token recording occurs post-success only; failed executions record nothing
- No retry logic at service or adapter level; retries implemented at caller level
- Timeouts currently owned by provider SDKs; orchestrator timeout may be added later
- Executions are NOT idempotent; callers must implement deduplication if needed

---

## DOCUMENT METADATA

**Phase:** 13A
**Title:** Execution Orchestration Policy
**Status:** DESIGN ONLY (NOT IMPLEMENTED)
**Design Date:** 2026-02-05
**Checkpoint Type:** Stage Design Document

**Previous Phase:**
- Phase 12B: Provider Architecture (COMPLETE & FROZEN)
- Phase 13: Orchestration Design Overview (DESIGN ONLY)

**Next Phases (Potential):**
- Phase 13B: Token Recording Implementation
- Phase 13C: Execution Logging Implementation
- Phase 13D: Orchestrator Timeout Implementation

**Dependencies:**
- Builds on Phase 12B architecture (no modifications)
- Provides design guidance for Phase 13B+

---

**END OF PHASE 13A DESIGN DOCUMENT**

This is a design-only phase. No implementation is authorized. Future implementation phases must follow these policy decisions.
