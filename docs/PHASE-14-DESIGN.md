# PHASE 14 - DESIGN DOCUMENT

**External API & Contract Design**

---

## STATUS

**DESIGN ONLY – NO IMPLEMENTATION**

Phase: 14
Design Date: 2026-02-05
Checkpoint Type: Phase Design Document

---

## PHASE CONTEXT

### Previous Phases (LOCKED)

**Phase 12B (Provider Architecture):**
- AIAdapter interface established (stateless, throw-only)
- Four adapter implementations (Stub, Anthropic, OpenAI, Groq)
- AIExecutionRequest and AIExecutionResult interfaces
- All contracts LOCKED

**Phase 13 (Execution, Cost, and Failure Policy):**
- Service orchestrates and records tokens post-success
- Adapters execute and extract tokens
- Callers handle retries, idempotency, quotas, timeouts
- Token recording only for successful executions
- All failures propagate as exceptions (throw-only)
- Execution outcome deterministic (exception XOR result)
- No service-level retries, quota enforcement, or conversation state
- All policy decisions LOCKED

### Phase 14 Purpose

Phase 14 defines the **external-facing contract** for interacting with the AI execution system. This phase establishes the binding interface contract between external callers (controllers, handlers, API gateways) and the AI Execution Service, specifying request/response shapes, error contracts, determinism guarantees, versioning strategy, and responsibility boundaries.

Phase 14 is a **design-only phase** that defines the public API contract without implementing any HTTP endpoints, GraphQL resolvers, or transport-specific logic. The contract established in Phase 14 is binding on all future implementation phases.

---

## PUBLIC API SURFACE

### Request Contract

**Policy:**

The public execution request contract is defined by the AIExecutionRequest interface (from Phase 12B):

**Required Fields:**
- `sessionId` (string): Identifies the container/sandbox session
- `conversationId` (string): Identifies the conversation thread within session
- `userId` (string): Identifies the user who initiated execution
- `prompt` (string): The input text to send to AI provider

**Optional Fields:**
- `metadata` (Record<string, unknown>): Arbitrary key-value metadata for tracking/debugging

**Contract Guarantees:**
- All required fields MUST be present and non-empty
- Field types MUST match specified types
- Request payload MUST NOT be modified by service before delegation to adapter
- Request structure is STABLE and LOCKED (from Phase 12B)

### Response Contract

**Policy:**

The public execution response contract is defined by the AIExecutionResult interface (from Phase 12B):

**Success Response Fields:**
- `output` (string): The AI-generated response text
- `tokensUsed` (number): Total token count for execution
- `model` (string): The AI model that processed the request

**Contract Guarantees:**
- Success response MUST contain all three fields
- `tokensUsed` MUST be non-negative
- `output` MAY be empty string (valid response)
- Response structure is STABLE and LOCKED (from Phase 12B)

**Failure Response:**
- Failures propagate as exceptions (no error fields in response)
- Exception structure defined in Error Contract section

### Execution Semantics

**Policy:**

Execution is **synchronous** and follows request/response model:

**Synchronous Execution:**
- Caller invokes execution and blocks until completion or failure
- Execution completes with either result or exception
- No callback-based or event-based result delivery
- No streaming responses (deferred to future phases)

**Single-Turn Model:**
- Each execution is independent (no conversation state in service)
- Service does NOT maintain conversation history
- Service does NOT inject prior messages into prompt
- Caller MUST construct prompt with conversation context if needed

**Execution Boundaries:**
- One request → one execution → one result or exception
- No batching of multiple prompts in single request
- No automatic retries (caller responsibility)
- No request queuing or throttling in service

**Contract Guarantees:**
- Execution always completes or fails (no indefinite blocking)
- Execution always returns exception OR result (never both, never neither)
- Same request structure always triggers same execution flow (deterministic orchestration)

---

## ERROR CONTRACT

### Error Types (Guaranteed)

**Policy:**

Callers MUST be prepared to handle the following error types:

**Authentication Errors:**
- `UnauthorizedException` (HTTP 401 equivalent)
- Indicates invalid or missing provider API key
- NOT RETRYABLE (configuration error)

**Validation Errors:**
- `BadRequestException` (HTTP 400 equivalent)
- Indicates invalid request structure or field values
- NOT RETRYABLE (caller error)

**Provider Errors:**
- `ServiceUnavailableException` (HTTP 503 equivalent)
- Indicates provider timeout, network error, or 5xx provider error
- RETRYABLE (transient failure)

**Rate Limit Errors:**
- `ServiceUnavailableException` (HTTP 503 equivalent)
- Indicates provider rate limit exceeded (429)
- RETRYABLE with exponential backoff

**Internal Errors:**
- `InternalServerErrorException` (HTTP 500 equivalent)
- Indicates unexpected service or adapter error
- MAY BE RETRYABLE (depends on root cause)

### Error Structure

**Policy:**

All errors follow NestJS HttpException structure:

**Error Fields (Guaranteed):**
- Exception type/class (UnauthorizedException, BadRequestException, etc.)
- Error message (string)
- HTTP status code (if HTTP transport used)

**Error Message Guarantees:**
- Error message MUST NOT contain sensitive data (API keys, credentials)
- Error message MAY contain execution context (sessionId, conversationId)
- Error message MAY be generic or obscured (provider error details may be limited)

**Error Metadata:**
- Execution context (sessionId, conversationId, userId) MAY be added by service
- Provider-specific error details MAY be included if available
- No guarantee of detailed root cause information

### Error Stability Guarantees

**Policy:**

**Stable (Will Not Change):**
- Exception types for standard errors (401, 400, 503, 500)
- Throw-only semantics (no error fields in success response)
- Exception propagation without modification (from adapter through service)

**Unstable (May Change):**
- Error message text (may be improved or clarified)
- Error metadata fields (may be added)
- Provider-specific error details (depends on provider SDK)

**Contract Guarantees:**
- Exception type mapping is STABLE for standard HTTP error codes
- Callers MUST detect error type by exception class, NOT by message text
- Error messages are INFORMATIONAL ONLY (not for programmatic detection)

### What Is NOT Guaranteed

**Policy:**

The following are explicitly NOT guaranteed:

**Root Cause Clarity:**
- Error message may not fully explain root cause
- Provider error details may be obscured or generic
- Internal service state not exposed in errors

**Retry Success:**
- Retrying a failed execution may not succeed
- Transient vs permanent failures not always distinguishable
- Provider availability not guaranteed

**Error Timing:**
- No SLA on error detection time
- Errors may occur immediately or after delay (timeout)
- Timeout duration varies by provider and operation

---

## DETERMINISM & GUARANTEES

### What Callers Can Rely On

**Policy:**

Callers can rely on the following guarantees:

**1. Execution Outcome Determinism:**
- Every execution returns exactly one of: result OR exception
- Never both result and exception
- Never neither (execution always completes or fails)
- Outcome type is deterministic (success = result, failure = exception)

**2. Request Integrity:**
- Request payload NOT modified by service before delegation
- All required fields preserved exactly as provided
- Metadata preserved exactly as provided

**3. Exception Propagation:**
- All failures propagate as exceptions (no silent failures)
- Exception type preserved from adapter through service
- Exception message preserved from adapter through service

**4. Token Recording:**
- Successful executions (result returned) have tokens recorded (best effort)
- Failed executions (exception thrown) do NOT have tokens recorded
- No duplicate token recording within single execution

**5. Stateless Execution:**
- Service maintains no state between executions
- Each execution independent of prior executions
- No conversation history maintained by service

**6. Error Type Consistency:**
- Same provider error always maps to same exception type
- Exception mapping consistent across providers (where applicable)
- Retryable vs non-retryable errors distinguishable by exception type

### What Is Non-Deterministic

**Policy:**

The following are explicitly NON-DETERMINISTIC:

**1. Output Content:**
- Same prompt may produce different output between executions
- Provider models use sampling (temperature, randomness)
- Provider model updates may change output characteristics
- No guarantee of output consistency

**2. Token Count:**
- Same prompt may use different token count between executions
- Token count varies with output length
- Provider tokenization may change

**3. Execution Duration:**
- Same prompt may take different time to execute
- Duration varies with provider load, network latency, model complexity
- No SLA on execution time

**4. Provider Behavior:**
- Provider may be available or unavailable
- Provider may rate-limit or reject requests
- Provider infrastructure state affects behavior

**Exception: StubAIAdapter**
- StubAIAdapter is deterministic (always same output)
- Used for testing and development only
- NOT representative of real provider behavior

### Ordering and Duplication

**Policy:**

**No Ordering Guarantees:**
- Concurrent executions may complete in any order
- Service does NOT guarantee FIFO execution order
- Caller MUST NOT assume ordering if issuing concurrent requests

**No Idempotency:**
- Same request submitted multiple times executes multiple times
- Each execution generates separate provider API call
- Each successful execution records tokens separately
- Caller MUST implement deduplication if idempotency required

**Retry Behavior:**
- Service does NOT retry failed executions
- Caller MUST implement retry logic if needed
- Retries generate new executions (separate token recording)

---

## VERSIONING & COMPATIBILITY

### Versioning Strategy

**Policy:**

The AI Execution API follows **semantic interface versioning**:

**Interface Version:**
- Current version: v1 (defined by Phase 12B contracts)
- Version tied to AIExecutionRequest and AIExecutionResult interfaces
- Version change requires new interface definitions

**Version Change Rules:**
- Adding optional fields = minor version (v1.1, v1.2)
- Adding required fields = major version (v2.0)
- Removing fields = major version (v2.0)
- Changing field types = major version (v2.0)
- Changing error semantics = major version (v2.0)

**Current Locked Interfaces (v1.0):**
- AIExecutionRequest (Phase 12B)
- AIExecutionResult (Phase 12B)
- Throw-only error semantics (Phase 13)

### Backward Compatibility Guarantees

**Policy:**

**Within Major Version (v1.x):**
- All v1.x releases are backward compatible with v1.0
- New optional fields may be added to request or response
- Existing required fields MUST NOT be removed
- Existing field types MUST NOT be changed
- Error semantics MUST NOT be changed (throw-only preserved)

**Across Major Versions (v1.x → v2.x):**
- Breaking changes allowed with major version increment
- Migration path MUST be documented
- Parallel support for both versions during transition period
- Deprecation notice provided before version removal

**Never Breaking (Permanently Stable):**
- Synchronous execution semantics
- Exception XOR result outcome model
- Throw-only error propagation
- Stateless execution model
- Single-turn execution model

### What Constitutes Breaking Changes

**Policy:**

The following changes are BREAKING and require major version increment:

**Request Contract Changes:**
- Adding required fields to AIExecutionRequest
- Removing fields from AIExecutionRequest
- Changing field types in AIExecutionRequest
- Changing field validation rules (stricter validation)

**Response Contract Changes:**
- Removing fields from AIExecutionResult
- Changing field types in AIExecutionResult
- Adding error fields to AIExecutionResult (violates throw-only)

**Error Contract Changes:**
- Changing exception propagation model (violates throw-only)
- Adding error payloads to success response
- Removing exception types
- Changing exception type mapping for standard errors

**Execution Semantics Changes:**
- Changing from synchronous to asynchronous
- Adding conversation state to service (violates stateless)
- Adding automatic retries (violates no-retry policy)
- Changing execution outcome model (violates exception XOR result)

**Non-Breaking Changes:**
- Adding optional fields to request or response
- Adding new exception types for new error cases
- Improving error messages (text only)
- Adding execution metadata
- Adding optional features that don't change core semantics

---

## RESPONSIBILITY BOUNDARIES

### Platform Guarantees (What Service Provides)

**Policy:**

The platform (AI Execution Service) guarantees the following:

**1. Execution Orchestration:**
- Service routes execution to appropriate adapter
- Service records tokens after successful execution
- Service logs execution events for observability
- Service propagates exceptions from adapter to caller

**2. Provider Integration:**
- Service integrates with multiple AI providers (Anthropic, OpenAI, Groq)
- Service handles provider-specific API differences
- Service maps provider errors to consistent exception types
- Service extracts token usage from provider responses

**3. Token Accounting:**
- Service records tokens for successful executions
- Service does NOT record tokens for failed executions
- Service includes model and provider metadata in token records
- Service handles token recording failures gracefully (logs, does not fail execution)

**4. Error Transparency:**
- Service propagates all exceptions without modification
- Service preserves exception type and message from adapter
- Service adds execution context to exceptions if needed
- Service does NOT swallow or hide errors

**5. Stateless Operation:**
- Service maintains no state between executions
- Service does NOT store conversation history
- Service does NOT cache execution results
- Each execution is independent

### Caller Responsibilities (What Service Does NOT Provide)

**Policy:**

Callers MUST handle the following:

**1. Retry Logic:**
- Caller MUST implement retry logic for transient failures
- Caller MUST implement exponential backoff for rate limits
- Caller MUST limit retry attempts to prevent infinite loops
- Caller MUST log retry attempts for observability

**2. Idempotency:**
- Caller MUST implement request deduplication if idempotency required
- Caller MUST use request IDs or correlation IDs to detect duplicates
- Caller MUST cache and return prior results for duplicate requests
- Service does NOT provide idempotency guarantees

**3. Timeout Enforcement:**
- Caller MUST enforce request-level timeouts
- Caller timeout MUST be longer than provider SDK timeout
- Caller MUST handle timeout by cancelling request (if cancellation supported)
- Caller MUST return appropriate timeout error to end user

**4. Quota Enforcement:**
- Caller MUST check user quota before invoking service
- Caller MUST block execution if quota exceeded
- Caller MUST return appropriate quota error to end user
- Service does NOT enforce quotas

**5. Error Response Transformation:**
- Caller MUST transform service exceptions to appropriate response format
- HTTP controllers transform to HTTP error responses
- GraphQL resolvers transform to GraphQL errors
- Caller MUST NOT expose sensitive error details to end users

**6. Conversation Management:**
- Caller MUST maintain conversation history if needed
- Caller MUST construct prompt with conversation context
- Caller MUST manage conversation state across executions
- Service does NOT provide conversation memory

**7. Request Validation:**
- Caller MUST validate request before invoking service
- Caller MUST ensure all required fields present and valid
- Caller MUST sanitize user input if needed
- Service provides basic validation only

**8. Result Validation:**
- Caller MUST validate execution result if needed
- Caller MUST check output format and content
- Caller MUST handle empty or unexpected output gracefully
- Service returns result as-is from adapter

### Boundary Enforcement

**Policy:**

The following boundaries are ENFORCED:

**Service Will Reject:**
- Requests with missing required fields
- Requests with invalid field types
- Requests that fail basic validation

**Service Will NOT:**
- Retry failed executions automatically
- Check user quota before execution
- Maintain conversation history
- Cache execution results
- Guarantee idempotent execution
- Enforce caller-level timeouts

**Callers Must NOT:**
- Assume service retries failed executions
- Assume service enforces quotas
- Assume service maintains conversation state
- Assume same request produces same output
- Rely on execution ordering for concurrent requests

---

## SECURITY & SAFETY BOUNDARIES

### Authentication Assumptions

**Policy:**

**Provider Authentication:**
- Service authenticates to AI providers using API keys
- Provider API keys configured via environment variables
- Provider authentication failures throw UnauthorizedException
- Service does NOT expose provider API keys in errors or logs

**Caller Authentication:**
- Caller authentication is OUT OF SCOPE for Phase 14
- Authentication assumed to be handled by upstream layer (API gateway, middleware)
- Service assumes caller is authenticated and authorized
- Service does NOT validate caller identity or permissions

**Future Consideration:**
- Caller authentication MAY be added in future phases
- API key authentication, JWT authentication, or OAuth may be used
- Service-level authentication is deferred to implementation phases

### Data Handling Guarantees

**Policy:**

**Request Data:**
- Service does NOT modify request payload before delegation
- Service does NOT log full prompt text (may contain sensitive data)
- Service logs execution metadata only (sessionId, conversationId, userId)
- Service passes prompt to provider exactly as provided

**Response Data:**
- Service returns output from provider exactly as-is
- Service does NOT filter or censor output content
- Service does NOT store output content (except in logs if configured)
- Service does NOT validate output content

**Token Records:**
- Service records token usage with metadata (user, session, conversation, model, provider)
- Service does NOT include full prompt or output in token records
- Token records used for billing and usage tracking only
- Token records stored securely (implementation-specific)

**Logging:**
- Service logs execution events (start, success, failure)
- Service does NOT log sensitive data (API keys, credentials, full prompts)
- Service logs execution metadata (sessionId, conversationId, userId, provider, model, duration)
- Log retention and access control is implementation-specific

### What Platform Does NOT Protect Against

**Policy:**

The following are explicitly OUT OF SCOPE for platform protection:

**Prompt Injection:**
- Service does NOT detect or prevent prompt injection attacks
- Service does NOT validate or sanitize prompt content
- Caller MUST implement prompt sanitization if needed
- Provider may have built-in safety features (not guaranteed)

**Output Validation:**
- Service does NOT validate output content for safety or appropriateness
- Service does NOT filter harmful, biased, or inappropriate content
- Caller MUST implement output validation if needed
- Provider may have built-in safety features (not guaranteed)

**Rate Limiting (User-Level):**
- Service does NOT enforce per-user rate limits
- Service does NOT throttle requests based on usage patterns
- Caller MUST implement rate limiting at API layer
- Provider rate limits enforced by provider (may cause failures)

**Abuse Prevention:**
- Service does NOT detect or prevent abuse patterns
- Service does NOT block malicious users
- Caller MUST implement abuse detection and prevention
- Billing system may detect abuse via usage anomalies

**Data Privacy:**
- Service sends prompts to external AI providers (Anthropic, OpenAI, Groq)
- Provider privacy policies apply to prompts and outputs
- Service does NOT encrypt prompts before sending to providers
- Caller MUST inform users that data is sent to external providers

**Compliance:**
- Service does NOT enforce compliance with regulations (GDPR, HIPAA, etc.)
- Service does NOT implement data residency requirements
- Service does NOT implement audit logging for compliance
- Caller MUST implement compliance features at API layer

---

## EXPLICIT NON-GOALS

Phase 14 explicitly does NOT define or implement:

### Transport-Specific Implementation
- ❌ HTTP controllers or REST endpoints
- ❌ GraphQL resolvers or schema
- ❌ WebSocket handlers or gRPC services
- ❌ Request/response serialization formats
- ❌ Transport-specific authentication

**Deferred To:** Implementation phases (Phase 14A+)

### Advanced Execution Features
- ❌ Streaming responses
- ❌ Function calling / tool use
- ❌ Multi-modal inputs (vision, audio)
- ❌ Conversation history management
- ❌ Context window optimization

**Deferred To:** Phase 15+ (Advanced Features)

### Service-Level Features (Explicitly Forbidden by Phase 13)
- ❌ Retry logic in service
- ❌ Circuit breaker in service
- ❌ Rate limiting in service
- ❌ Request queuing in service
- ❌ Quota enforcement in service
- ❌ Conversation state in service
- ❌ Result caching in service

**Reason:** Violates Phase 13 locked invariants

### Authentication & Authorization
- ❌ API key authentication
- ❌ JWT authentication
- ❌ OAuth integration
- ❌ Role-based access control (RBAC)
- ❌ Permission checking

**Deferred To:** API implementation phases

### Observability Implementation
- ❌ Metrics collection (Prometheus, StatsD)
- ❌ Distributed tracing (OpenTelemetry)
- ❌ Structured logging framework
- ❌ Performance monitoring dashboards
- ❌ Alerting rules

**Deferred To:** Infrastructure/platform concerns

### Billing & Quotas Implementation
- ❌ Cost calculation formulas
- ❌ Quota enforcement mechanism
- ❌ Usage reporting dashboards
- ❌ Invoice generation
- ❌ Payment processing

**Deferred To:** Billing system (separate phase)

### Safety & Compliance
- ❌ Prompt injection detection
- ❌ Output content filtering
- ❌ Abuse detection
- ❌ Data privacy controls
- ❌ Compliance features (GDPR, HIPAA)

**Deferred To:** Caller responsibility (API layer)

---

## SAFE RESUME POINT

### What Phase 14 Establishes

Phase 14 establishes the following contract guarantees:

1. **Public API Contract:**
   - Request contract (AIExecutionRequest)
   - Response contract (AIExecutionResult)
   - Synchronous execution semantics
   - Single-turn execution model

2. **Error Contract:**
   - Error types (401, 400, 503, 500)
   - Throw-only error propagation
   - Error structure and stability

3. **Determinism Guarantees:**
   - Outcome determinism (exception XOR result)
   - Output non-determinism (same prompt may vary)
   - No ordering or idempotency guarantees

4. **Versioning Strategy:**
   - Semantic interface versioning (v1.0 current)
   - Backward compatibility within major version
   - Breaking change definition

5. **Responsibility Boundaries:**
   - Platform guarantees (orchestration, token recording, error propagation)
   - Caller responsibilities (retry, idempotency, quota, timeout, conversation)

6. **Security Boundaries:**
   - Authentication assumptions
   - Data handling guarantees
   - What platform does NOT protect against

### What Future Phases May Build

**Phase 14A+ (Implementation Phases):**
- Implement HTTP REST API endpoints
- Implement request/response DTOs
- Implement API authentication (API key, JWT, OAuth)
- Implement API documentation (OpenAPI/Swagger)
- Implement rate limiting at API layer
- Implement retry logic at API layer
- Implement quota enforcement at API layer

**Phase 15+ (Advanced Features):**
- Implement streaming responses (requires new interface)
- Implement function calling (requires new interface)
- Implement multi-modal inputs (requires new interface)
- Implement conversation management (caller-level feature)

**Phase 16+ (Provider Management):**
- Implement provider health checks
- Implement automatic failover (optional)
- Implement cost-based provider selection

**Billing System (Separate Phase):**
- Implement quota storage and enforcement
- Implement cost calculation
- Implement usage reporting

### What Must NOT Change Without Reopening Phase 14

**Locked Contract Decisions:**
- ✓ Synchronous execution semantics (no callbacks or events)
- ✓ Exception XOR result outcome model (no error fields in result)
- ✓ Throw-only error propagation (no error payloads in success response)
- ✓ Stateless execution model (no conversation state in service)
- ✓ Single-turn execution model (no multi-turn state)
- ✓ No service-level retries (caller responsibility)
- ✓ No service-level quota enforcement (caller responsibility)
- ✓ Request/response interface structure (v1.0 locked)

**Modifiable Implementation Details:**
- Transport implementation (HTTP, GraphQL, gRPC)
- Authentication mechanism (API key, JWT, OAuth)
- Serialization format (JSON, Protocol Buffers)
- API versioning scheme (URL path, header, media type)
- Rate limiting implementation (token bucket, leaky bucket)

---

## LOCKED INVARIANTS (RESTATED FROM PREVIOUS PHASES)

Phase 14 does NOT modify any prior phase contracts:

**From Phase 12B:**
- AIExecutionRequest interface (LOCKED)
- AIExecutionResult interface (LOCKED)
- AIAdapter interface (LOCKED)
- Throw-only error semantics (LOCKED)

**From Phase 13:**
- Service owns orchestration and token recording (LOCKED)
- Callers own retry, idempotency, quota, timeout (LOCKED)
- Token recording post-success only (LOCKED)
- Exception propagation without modification (LOCKED)
- Stateless execution model (LOCKED)
- No service-level retries (LOCKED)
- No service-level quota enforcement (LOCKED)
- Synchronous token recording (LOCKED)
- Best-effort cancellation (LOCKED)
- Execution outcome determinism (exception XOR result) (LOCKED)

All prior architectural decisions remain unchanged.

---

## ULTRA-BRIEF SUMMARY

- Public API contract is synchronous request/response with AIExecutionRequest input and AIExecutionResult output or exception (never both)
- All errors propagate as typed exceptions (401/400/503/500); error messages are informational only and not stable for programmatic detection
- Execution outcome is deterministic (exception or result) but output content, token count, and duration are non-deterministic across retries
- API follows semantic versioning (v1.0 current); adding required fields, removing fields, or changing error semantics are breaking changes requiring v2.0
- Callers must implement retry logic, idempotency, quota enforcement, timeout enforcement, and conversation management; service provides orchestration only

---

## DOCUMENT METADATA

**Phase:** 14
**Title:** External API & Contract Design
**Status:** DESIGN ONLY (NOT IMPLEMENTED)
**Design Date:** 2026-02-05
**Checkpoint Type:** Phase Design Document

**Previous Phases:**
- Phase 12B: Provider Architecture (COMPLETE & FROZEN)
- Phase 13: Execution, Cost, and Failure Policy (COMPLETE & FROZEN)

**Next Phases (Potential):**
- Phase 14A: HTTP REST API Implementation
- Phase 14B: Authentication & Authorization Implementation
- Phase 14C: API Documentation (OpenAPI/Swagger)
- Phase 15+: Advanced Features (Streaming, Function Calling)

**Dependencies:**
- Builds on Phase 12B adapter architecture (no modifications)
- Builds on Phase 13 policy framework (no modifications)
- Provides binding contract for all API implementations

---

**END OF PHASE 14 DESIGN DOCUMENT**

This is a design-only phase. No implementation is authorized. Future implementation phases must follow this contract.
