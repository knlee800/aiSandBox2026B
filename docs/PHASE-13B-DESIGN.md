# PHASE 13B - DESIGN DOCUMENT

**Token, Cost & Quota Policy**

---

## STATUS

**DESIGN ONLY – NO IMPLEMENTATION**

Phase: 13B
Design Date: 2026-02-05
Checkpoint Type: Stage Design Document

---

## PHASE CONTEXT

### Previous Phases (LOCKED)

**Phase 12B (Provider Architecture):**
- AIAdapter interface established (stateless, throw-only)
- Adapters extract token usage from provider responses
- Token count returned in AIExecutionResult.tokensUsed
- Four adapters: Stub, Anthropic, OpenAI, Groq
- All contracts and patterns LOCKED

**Phase 13A (Execution Orchestration Policy):**
- Service owns orchestration and token recording
- Adapters own provider execution and token extraction
- Token recording occurs post-success only
- Failed executions do NOT record tokens
- No retries at service or adapter level
- All policy decisions LOCKED

### Phase 13B Purpose

Phase 13B defines the **token, cost, and quota policy** that governs how token usage is recorded, attributed, and constrained. This is a design-only phase that establishes policy rules without implementing any token recording system, cost calculation system, or quota enforcement system.

---

## TOKEN RECORDING POLICY

### When Tokens Are Recorded

**Policy:**

Tokens are recorded if and only if ALL of the following conditions are met:

1. **Execution Completed Successfully:**
   - Adapter returned AIExecutionResult (did not throw exception)
   - AIExecutionResult.tokensUsed is present and non-negative
   - AIExecutionResult.output is present (non-empty or empty string)

2. **Token Recording System Available:**
   - Token recording system is reachable
   - Token recording call does not throw exception
   - Recording failure is logged but does NOT invalidate execution

3. **Inline Recording:**
   - Token recording occurs synchronously before returning result to caller
   - Token recording happens in same transaction/flow as execution
   - No asynchronous background recording for execution tokens

**Guarantees to Caller:**
- If execution succeeds, tokens will be recorded (best effort)
- If token recording fails, execution result is still returned
- Token recording failure does NOT cause execution to fail

### When Tokens Are NOT Recorded

**Policy:**

Tokens are NOT recorded in the following scenarios:

1. **Execution Failure:**
   - Adapter threw exception (any HttpException type)
   - No AIExecutionResult returned
   - No partial token accounting

2. **Invalid Token Count:**
   - AIExecutionResult.tokensUsed is negative
   - AIExecutionResult.tokensUsed is missing or undefined
   - Adapter returned malformed result

3. **Pre-Execution Failure:**
   - Request validation failed before adapter invocation
   - Adapter resolution failed (configuration error)
   - Service-level error before execution started

**Rationale:**
- Only successful completions are billable
- Prevents double-counting in retry scenarios
- Maintains billing accuracy and audit trail integrity

### Token Recording Failure Handling

**Policy:**

If token recording system fails after successful execution:

1. **Execution Result Preserved:**
   - AIExecutionResult returned to caller unchanged
   - Execution is considered successful
   - User receives output

2. **Failure Logged:**
   - Token recording failure logged as WARNING (not ERROR)
   - Log includes: sessionId, conversationId, userId, tokensUsed, error details
   - Alert triggered for monitoring/operations team

3. **No Retry:**
   - Token recording is NOT retried automatically
   - Manual reconciliation process may recover lost records
   - Billing system must handle missing token records gracefully

**Rationale:**
- Token recording is auditing/billing concern, not execution concern
- Execution success should not depend on recording system availability
- User experience (receiving output) takes priority over billing accuracy

---

## COST ATTRIBUTION POLICY

### Attribution Dimensions

**Policy:**

Token usage is attributed using the following dimensions:

1. **User ID (Required):**
   - Extracted from AIExecutionRequest.userId
   - Represents the user who initiated the execution
   - Primary billing entity

2. **Session ID (Required):**
   - Extracted from AIExecutionRequest.sessionId
   - Represents the container/sandbox session
   - Used for session-level usage tracking and debugging

3. **Conversation ID (Required):**
   - Extracted from AIExecutionRequest.conversationId
   - Represents the conversation thread within a session
   - Used for conversation-level usage tracking

4. **Model (Required):**
   - Extracted from AIExecutionResult.model
   - Identifies the AI model used (e.g., "claude-3-5-sonnet-20241022")
   - Required for cost calculation (different models have different rates)

5. **Provider (Required):**
   - Derived from adapter type or configuration
   - Identifies the AI provider (anthropic, openai, groq)
   - Required for cost calculation (different providers have different rates)

6. **Timestamp (Required):**
   - Recorded at time of token recording
   - Used for billing period calculation and audit trail

**Metadata Included in Token Record:**
- All fields from AIExecutionRequest (sessionId, conversationId, userId, metadata)
- All fields from AIExecutionResult (output excluded for storage efficiency, tokensUsed, model)
- Provider identifier
- Timestamp

### Cost Calculation

**Policy: COST CALCULATION IS OUT OF SCOPE FOR PHASE 13B**

Phase 13B establishes attribution policy only. Cost calculation is deferred to billing system.

**Attribution Policy States:**
- Token records MUST include model and provider for future cost calculation
- Token records MUST include userId for billing entity identification
- Token records MUST include timestamp for billing period calculation

**What Phase 13B Does NOT Define:**
- ❌ Cost per token by model/provider
- ❌ Cost calculation formulas
- ❌ Currency or pricing tiers
- ❌ Discounts or promotions
- ❌ Invoice generation

**Deferred To:** Billing system design (separate phase)

### Multi-Tenant Attribution

**Policy:**

Token usage is attributed to individual users, not accounts/organizations.

**Rationale:**
- AIExecutionRequest.userId is the primary identifier
- Account/organization relationship is managed by user management system
- Token recording system does NOT resolve user-to-account relationships
- Billing system aggregates user token usage to account level

**What Phase 13B Does NOT Define:**
- ❌ Account/organization data model
- ❌ User-to-account relationships
- ❌ Account-level quota enforcement
- ❌ Account-level billing

**Deferred To:** Billing system and user management system design

---

## QUOTA POLICY

### Quota Types (Conceptual)

**Policy:**

Two types of quotas are conceptually recognized:

1. **Hard Quotas (Pre-Execution Enforcement):**
   - Enforced BEFORE execution begins
   - If quota exceeded, execution is blocked
   - Throws exception before adapter invocation
   - No token usage occurs

2. **Soft Quotas (Post-Execution Warning):**
   - Checked AFTER execution completes
   - Execution is NOT blocked
   - Warning logged if quota threshold exceeded
   - User may be notified asynchronously

**Current State:**
- NO QUOTA ENFORCEMENT IMPLEMENTED
- Phase 13B defines policy only
- Future phases may implement enforcement following this policy

### Enforcement Boundaries

**Policy:**

Quota enforcement is NOT the responsibility of AIExecutionService.

**Enforcement Ownership:**

1. **Pre-Execution (Hard Quotas):**
   - Enforced by upstream caller (controller, middleware, guard)
   - Caller checks quota before invoking AIExecutionService
   - Caller throws exception if quota exceeded
   - AIExecutionService never invoked if quota exceeded

2. **Post-Execution (Soft Quotas):**
   - Checked by billing system after token recording
   - Billing system monitors aggregate usage
   - Billing system triggers alerts/notifications
   - AIExecutionService has no awareness of soft quotas

**What AIExecutionService Does NOT Do:**
- ❌ Check user quota before execution
- ❌ Block execution based on usage limits
- ❌ Query billing system for quota status
- ❌ Enforce rate limits per user

**Rationale:**
- Quota enforcement is a cross-cutting concern (affects multiple services)
- Service-level quota checks create tight coupling to billing system
- Upstream enforcement (guards, middleware) is more flexible and testable
- Service remains stateless and focused on orchestration

### Quota Dimensions (Conceptual)

**Policy:**

Quotas may be defined on the following dimensions (if implemented):

1. **User-Level Quotas:**
   - Total tokens per user per billing period
   - Tokens per model/provider per user
   - Executions per user per time window

2. **Session-Level Quotas:**
   - Total tokens per session
   - Maximum execution duration per session

3. **Conversation-Level Quotas:**
   - Total tokens per conversation
   - Maximum turns per conversation

**Current State:**
- NO QUOTA DIMENSIONS IMPLEMENTED
- Phase 13B defines possible dimensions only
- Actual quota schema deferred to billing system design

---

## FAILURE SEMANTICS

### Execution Failure (Adapter Exception)

**Policy:**

When adapter throws exception during execution:

1. **No Token Recording:**
   - Token recording does NOT occur
   - No token record created
   - No billable event generated

2. **Exception Propagation:**
   - Exception propagates to caller unchanged
   - Caller receives original exception type and message
   - Execution context preserved in exception (if added by service)

3. **Audit Trail:**
   - Execution failure logged with metadata
   - Log includes: sessionId, conversationId, userId, provider, exception type, error message
   - No token count in log (no tokens consumed)

**Guarantees:**
- Failed executions are NOT billed
- Caller can distinguish failure from success
- Retry scenarios do not double-count tokens

### Partial Execution Failure

**Policy:**

"Partial execution" scenarios are treated as full failures:

1. **Adapter Timeout:**
   - Adapter throws ServiceUnavailableException
   - No token recording (execution incomplete)
   - Provider may have consumed tokens (not recorded)

2. **Malformed Response:**
   - Adapter throws InternalServerErrorException
   - No token recording (execution result invalid)
   - Provider may have consumed tokens (not recorded)

3. **Network Interruption:**
   - Adapter throws ServiceUnavailableException
   - No token recording (execution incomplete)
   - Provider may have consumed tokens (not recorded)

**Implications:**
- Platform may under-count tokens in failure scenarios
- Provider bills platform, but platform does not bill user
- This is acceptable (better than over-billing users)

**Rationale:**
- Billing accuracy favors user (conservative approach)
- Partial execution does not produce usable output
- Provider costs absorbed by platform in failure scenarios

### Token Recording Failure (Post-Success)

**Policy (Restated from Phase 13A):**

When token recording fails after successful execution:

1. **Execution Considered Successful:**
   - AIExecutionResult returned to caller
   - User receives output
   - No exception thrown

2. **Token Record Lost:**
   - Token usage not recorded in system
   - User not billed for this execution
   - Platform absorbs provider cost

3. **Monitoring Alert:**
   - Token recording failure triggers alert
   - Operations team notified
   - Manual reconciliation may be performed

**Rationale:**
- User experience (receiving output) prioritized over billing accuracy
- Recording failures should be rare (system reliability issue)
- Platform absorbs cost in failure scenarios

---

## SYNC VS ASYNC RESPONSIBILITIES

### Synchronous (Inline) Operations

**Policy:**

The following operations MUST occur synchronously during execution flow:

1. **Token Extraction:**
   - Adapter extracts tokens from provider response
   - Happens inline during adapter.execute()
   - Returned in AIExecutionResult.tokensUsed

2. **Token Recording:**
   - Service records tokens after successful execution
   - Happens inline before returning result to caller
   - Blocks execution flow (but failures do not block result)

3. **Execution Logging:**
   - Execution start/success/failure logged inline
   - Provides immediate observability
   - Low-latency logging required

**Rationale:**
- Token recording must happen before caller receives result (audit accuracy)
- Inline recording ensures strong consistency
- Caller can assume tokens are recorded (or recording was attempted) when result received

### Asynchronous (Deferred) Operations

**Policy:**

The following operations MAY occur asynchronously after execution completes:

1. **Soft Quota Checks:**
   - Billing system checks aggregate usage in background
   - Triggers alerts/notifications asynchronously
   - Does not block execution

2. **Cost Calculation:**
   - Billing system calculates costs in batch
   - Aggregates token records by billing period
   - Generates invoices on schedule

3. **Usage Analytics:**
   - Analytics system processes token records
   - Generates usage reports and dashboards
   - Does not affect execution flow

4. **Token Record Reconciliation:**
   - Manual or automated reconciliation of lost token records
   - Compares provider bills to recorded usage
   - Recovers missed records if possible

**Rationale:**
- These operations do not affect execution correctness
- Async processing reduces execution latency
- Billing/analytics can tolerate eventual consistency

### What Must NEVER Be Async

**Policy:**

The following operations MUST NEVER be deferred or made asynchronous:

1. **Adapter Execution:**
   - Adapter.execute() must be synchronous (awaited)
   - Service must wait for result before proceeding
   - No background execution of AI requests

2. **Exception Handling:**
   - Exceptions must propagate immediately
   - No deferred error reporting
   - Caller must receive exceptions synchronously

3. **Result Return:**
   - AIExecutionResult must be returned synchronously to caller
   - No callback or event-based result delivery
   - Caller blocks until execution completes

**Rationale:**
- Maintains request/response model
- Simplifies error handling
- Prevents timeout and state management complexity

---

## EXPLICIT NON-GOALS

Phase 13B explicitly does NOT define or implement:

### Token Recording System Implementation
- ❌ No token recording service interface
- ❌ No database schema for token records
- ❌ No token recording API
- ❌ No token record storage mechanism

**Deferred To:** Phase 13C (Token Recording Implementation)

### Cost Calculation System
- ❌ No cost-per-token rates by model/provider
- ❌ No cost calculation formulas
- ❌ No pricing tiers or discounts
- ❌ No currency handling

**Deferred To:** Billing system design (separate phase)

### Quota Enforcement System
- ❌ No quota definition schema
- ❌ No quota storage mechanism
- ❌ No quota checking logic
- ❌ No quota enforcement guards/middleware

**Deferred To:** Billing system design (separate phase)

### Billing System
- ❌ No invoice generation
- ❌ No payment processing
- ❌ No account management
- ❌ No usage reporting dashboards

**Deferred To:** Billing system design (separate phase)

### Usage Analytics
- ❌ No analytics data model
- ❌ No usage reports or dashboards
- ❌ No anomaly detection
- ❌ No usage forecasting

**Deferred To:** Analytics system design (separate phase)

### Reconciliation System
- ❌ No reconciliation process definition
- ❌ No provider bill comparison logic
- ❌ No automated recovery of lost records
- ❌ No dispute resolution workflow

**Deferred To:** Billing operations design (separate phase)

---

## SAFE RESUME POINT

### What Phase 13B Establishes

Phase 13B establishes the following policy decisions:

1. **Token Recording Rules:**
   - Record tokens post-success only
   - No recording on execution failure
   - Recording failure does not invalidate execution

2. **Cost Attribution Rules:**
   - Attribute to user, session, conversation
   - Include model and provider for future cost calculation
   - Include timestamp for billing period

3. **Quota Policy:**
   - Hard quotas enforced upstream (not in service)
   - Soft quotas checked asynchronously
   - Service does not enforce quotas

4. **Failure Semantics:**
   - Failed executions NOT billed
   - Partial failures treated as full failures
   - Platform absorbs provider cost in failure scenarios

5. **Sync vs Async:**
   - Token recording is synchronous
   - Cost calculation and quota checks are asynchronous
   - Execution always synchronous (request/response)

### What Phase 13C/13D May Build

**Token Recording Implementation (Phase 13C):**
- Define token recording service interface
- Implement token record storage
- Implement token recording call in AIExecutionService
- Add token recording tests

**Quota Enforcement Implementation (Phase 13D):**
- Define quota storage schema
- Implement quota checking logic
- Implement pre-execution guards
- Add quota enforcement tests

**Billing System (Phase 14+):**
- Define cost-per-token rates
- Implement cost calculation
- Implement invoice generation
- Implement payment processing

### What Must NOT Change Without Revising This Policy

**Locked Policy Decisions:**
- ✓ Token recording only for successful executions (maintains billing accuracy)
- ✓ Recording failure does not block execution result (maintains user experience)
- ✓ No quota enforcement in AIExecutionService (maintains separation of concerns)
- ✓ Synchronous token recording (maintains audit consistency)
- ✓ User-level attribution (aligns with request contract)

**Modifiable Implementation Details:**
- Token recording service interface (not yet defined)
- Token record storage schema (not yet defined)
- Quota enforcement mechanism (not yet defined)
- Cost calculation formulas (not yet defined)

---

## LOCKED INVARIANTS (RESTATED FROM PREVIOUS PHASES)

Phase 13B does NOT modify any prior phase contracts:

**From Phase 12B:**
- AIExecutionRequest interface (LOCKED)
- AIExecutionResult interface (LOCKED)
- AIAdapter interface (LOCKED)
- Token extraction in adapters (LOCKED)
- Throw-only error semantics (LOCKED)

**From Phase 13A:**
- Service owns orchestration and token recording (LOCKED)
- Token recording post-success only (LOCKED)
- No retries at service/adapter level (LOCKED)
- Exception propagation without modification (LOCKED)

All prior architectural decisions remain unchanged.

---

## ULTRA-BRIEF SUMMARY

- Tokens recorded post-success only; execution failures do not generate token records
- Token usage attributed to user, session, conversation with model and provider metadata
- Quota enforcement is upstream responsibility; AIExecutionService does not check quotas
- Token recording failures do not invalidate successful executions; user receives output
- Token recording is synchronous; cost calculation and quota checks are asynchronous

---

## DOCUMENT METADATA

**Phase:** 13B
**Title:** Token, Cost & Quota Policy
**Status:** DESIGN ONLY (NOT IMPLEMENTED)
**Design Date:** 2026-02-05
**Checkpoint Type:** Stage Design Document

**Previous Phases:**
- Phase 12B: Provider Architecture (COMPLETE & FROZEN)
- Phase 13A: Execution Orchestration Policy (DESIGN LOCKED)

**Next Phases (Potential):**
- Phase 13C: Token Recording Implementation
- Phase 13D: Quota Enforcement Implementation
- Phase 14+: Billing System Design

**Dependencies:**
- Builds on Phase 12B adapter architecture (no modifications)
- Builds on Phase 13A orchestration policy (no modifications)
- Provides policy guidance for Phase 13C+

---

**END OF PHASE 13B DESIGN DOCUMENT**

This is a design-only phase. No implementation is authorized. Future implementation phases must follow these policy decisions.
