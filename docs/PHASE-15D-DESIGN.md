# PHASE 15D DESIGN: Execution Lifecycle & State Model

**Status:** DESIGN CHECKPOINT
**Nature:** Design-Only Phase / Policy Definition
**Version:** v1.0
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Lifecycle states defined:** received → validating → routing → executing → recording_tokens → completed OR failed
• **State ownership locked:** Service owns all transitions; states are observable via logs, not persisted
• **Terminal states established:** completed (success, tokens recorded) and failed (exception thrown, zero tokens)
• **Cancellation semantics:** Best-effort signal, not a state; may transition to failed or completed depending on timing
• **Observability alignment:** State transitions logged per Phase 15B; executionId correlates logs across states

---

## 1. Purpose & Scope

### 1.1 Purpose

Phase 15D defines the **logical execution lifecycle** for AI execution requests. This phase establishes **what execution states exist**, **how states transition**, and **who owns state transitions**, without implementing state persistence or workflow orchestration.

### 1.2 Scope

Phase 15D defines:

- **Logical execution states** — Conceptual phases in the execution timeline
- **State transition rules** — Allowed and disallowed transitions
- **Terminal vs non-terminal states** — Which states are final vs intermediate
- **State ownership** — Service vs adapter vs caller responsibility for transitions
- **Deterministic state guarantees** — Which transitions are guaranteed vs best-effort
- **Cancellation semantics** — How cancellation interacts with state transitions
- **Token eligibility by state** — Which terminal states produce tokens
- **Observability per state** — Which states and transitions are logged

### 1.3 What Phase 15D Does NOT Define

Phase 15D explicitly does NOT define:

- State persistence (no database schema, no state storage)
- State mutation APIs (no endpoints to query or change state)
- Workflow orchestration (no state machine engine)
- Async execution model (execution remains synchronous)
- Queueing or scheduling (no background jobs)
- Retry state tracking (callers own retries)
- Compensation or rollback logic (execution is atomic)
- Caller-side orchestration libraries (callers implement as needed)
- Streaming or partial results (execution is atomic: result OR exception)

---

## 2. Execution States (Logical Model)

### 2.1 State Definitions

The following **logical states** represent observable phases in the execution lifecycle:

**received**
- **Meaning:** Service received execution request from caller
- **Entry:** Request arrives at service entry point
- **Exit:** Service begins request validation
- **Duration:** Instantaneous (logging overhead only)
- **Observable:** Yes (entry log with executionId, timestamp)
- **Terminal:** No

**validating**
- **Meaning:** Service is validating request structure and parameters
- **Entry:** Service begins validation logic
- **Exit:** Validation succeeds OR validation fails
- **Duration:** Non-deterministic (depends on request size)
- **Observable:** No (internal phase, not logged separately)
- **Terminal:** No

**routing**
- **Meaning:** Service is selecting adapter based on request
- **Entry:** Validation succeeds
- **Exit:** Adapter selected OR routing fails
- **Duration:** Deterministic (simple logic, fast)
- **Observable:** No (internal phase, not logged separately)
- **Terminal:** No

**executing**
- **Meaning:** Adapter is invoking provider API
- **Entry:** Adapter invocation begins
- **Exit:** Provider returns response OR provider returns error OR timeout occurs
- **Duration:** Non-deterministic (depends on provider, network, model)
- **Observable:** Yes (logs show adapter, provider, model)
- **Terminal:** No

**recording_tokens**
- **Meaning:** Service is recording token usage to token-usage table
- **Entry:** Provider returned successful response with token count
- **Exit:** Token recording succeeds OR token recording fails
- **Duration:** Non-deterministic (database operation)
- **Observable:** No (internal phase, not logged separately)
- **Terminal:** No

**completed**
- **Meaning:** Execution succeeded, returning AIExecutionResult to caller
- **Entry:** Token recording succeeds
- **Exit:** None (terminal state)
- **Duration:** N/A (terminal state)
- **Observable:** Yes (exit log with outcome=success, tokensUsed, durationMs)
- **Terminal:** Yes (success path)

**failed**
- **Meaning:** Execution failed, throwing AIExecutionException to caller
- **Entry:** Any non-terminal state encounters error
- **Exit:** None (terminal state)
- **Duration:** N/A (terminal state)
- **Observable:** Yes (exit log with outcome=failure, errorType, errorCategory)
- **Terminal:** Yes (failure path)

### 2.2 State Characteristics

**Non-Terminal States:**
- received, validating, routing, executing, recording_tokens
- Represent in-progress execution
- May transition to completed or failed
- Not observable as discrete log events (except received, executing)

**Terminal States:**
- completed, failed
- Represent final execution outcome
- No further transitions allowed
- Always observable via exit logs

**Observable States:**
- received (entry log)
- executing (adapter invocation visible in logs)
- completed (exit log with success metadata)
- failed (exit log with failure metadata)

**Non-Observable States:**
- validating, routing, recording_tokens
- Internal phases not logged separately (performance optimization)
- Observable indirectly via execution duration

### 2.3 State Not Persisted

**Critical Principle: States Are Logical, Not Stored**

The service does NOT:
- Persist state to database or cache
- Maintain in-memory state machine
- Expose state query APIs
- Track state transitions across requests

States are **observable via logs only**:
- Entry log shows "received" state
- Exit log shows "completed" or "failed" terminal state
- Intermediate states inferred from execution timeline

This preserves **stateless execution model** from Phase 15A.

---

## 3. State Transition Rules

### 3.1 Allowed State Transitions

The following state transitions are allowed:

**Linear Success Path:**
```
received → validating → routing → executing → recording_tokens → completed
```

**Validation Failure:**
```
received → validating → failed
```

**Routing Failure:**
```
received → validating → routing → failed
```

**Provider Failure:**
```
received → validating → routing → executing → failed
```

**Token Recording Failure:**
```
received → validating → routing → executing → recording_tokens → failed
```

**Cancellation (Best-Effort):**
```
received → failed (cancelled before execution started)
executing → failed (cancelled during provider invocation)
executing → completed (cancellation too late, execution completed)
```

### 3.2 Disallowed State Transitions

The following transitions are **explicitly forbidden**:

**No Backwards Transitions:**
- ❌ executing → validating (cannot go backwards)
- ❌ completed → executing (terminal state cannot transition)
- ❌ failed → executing (terminal state cannot transition)

**No State Skipping:**
- ❌ received → executing (must validate and route first)
- ❌ executing → completed (must record tokens first on success)

**No Dual Outcomes:**
- ❌ executing → completed AND failed (deterministic outcome)
- ❌ Return result + throw exception (violates Phase 15A determinism)

**No Retry Transitions:**
- ❌ failed → received (retries are new executions with new executionId)
- ❌ completed → received (idempotent retries are new executions)

### 3.3 Deterministic Transition Guarantees

**Deterministic Transitions:**
- received → validating (always happens)
- validating → routing (if validation succeeds)
- routing → executing (if routing succeeds)
- executing → recording_tokens (if provider returns success)
- recording_tokens → completed (if token recording succeeds)

**Non-Deterministic Transitions:**
- validating → failed (depends on request validity)
- routing → failed (depends on adapter selection logic)
- executing → failed (depends on provider behavior)
- executing → completed (depends on provider response time, network)
- recording_tokens → failed (depends on database availability)

**Timing Non-Determinism:**
- Duration in each state is non-deterministic
- Total execution duration is non-deterministic
- State transition timestamps are non-deterministic

**Outcome Determinism:**
- Exactly one terminal state reached: completed XOR failed
- Never reach both completed and failed
- Never remain in non-terminal state indefinitely (timeout causes failed)

---

## 4. State Ownership

### 4.1 Service Ownership

The **service** owns all state transitions:

**Service Responsibilities:**
- Progress execution through states (received → validating → routing → executing → recording_tokens → completed)
- Detect failures and transition to failed state
- Log state transitions (entry, exit)
- Generate executionId at received state
- Return final outcome (AIExecutionResult or AIExecutionException)

**Service Guarantees:**
- States transition automatically (no caller action required)
- Terminal state always reached (completed or failed, never stuck)
- Execution completes synchronously (no detached background work)

### 4.2 Adapter Ownership

**Adapters** own execution within the executing state:

**Adapter Responsibilities:**
- Invoke provider API (executing state activity)
- Map provider responses to AIExecutionResult or AIExecutionException
- Propagate provider errors as typed exceptions
- Extract token counts from provider responses

**Adapter Does NOT:**
- Transition to completed or failed states (service does this)
- Record tokens (service does this after adapter returns)
- Retry provider calls (violates Phase 15A stateless principle)
- Log state transitions (service does this)

### 4.3 Caller Ownership

**Callers** own request lifecycle, NOT execution state:

**Caller Responsibilities:**
- Initiate execution by calling service
- Enforce timeouts (cancel request if too slow)
- Handle terminal state (AIExecutionResult or AIExecutionException)
- Decide whether to retry (failed state → new execution)

**Caller Does NOT:**
- Transition execution state (service owns all transitions)
- Query execution state (no state query API)
- Mutate execution state (no state mutation API)
- Track state across retries (each retry is new execution)

### 4.4 Provider Ownership

**Providers** (external AI APIs) own execution within the provider:

**Provider Responsibilities:**
- Process AI request
- Return response with token count OR error
- Enforce rate limits and quotas

**Provider Does NOT:**
- Know about service states (provider is external)
- Log state transitions (service does this)
- Guarantee response time (may be slow or timeout)

---

## 5. Failure & Cancellation Interaction

### 5.1 Failure State Entry

The **failed** terminal state is entered when:

**Validation Failure (validating → failed):**
- Request violates schema (missing fields, invalid types)
- Unsupported adapter or model identifier
- Exception: AIValidationException (per Phase 15C)

**Routing Failure (routing → failed):**
- Adapter selection logic fails (should be rare)
- Exception: AIUnknownException

**Provider Failure (executing → failed):**
- Provider returns error response (HTTP 4xx, 5xx)
- Provider rate limits request (HTTP 429)
- Network error or connection failure
- Exception: AIProviderException, AIRateLimitException, AIUnknownException

**Token Recording Failure (recording_tokens → failed):**
- Database unavailable or transaction fails
- Exception: AIUnknownException (critical service error)

**Timeout (executing → failed):**
- Caller-enforced timeout expires
- Exception: AITimeoutException (caller detects, service may not complete)

### 5.2 Cancellation Semantics

**Cancellation Is a Signal, Not a State**

Cancellation does NOT introduce a "cancelled" state. Instead:

**Cancellation Behavior:**
- Caller sends cancellation signal (HTTP request abort, timeout)
- Service attempts to abort execution (best-effort)
- Execution may transition to failed OR completed depending on timing

**Best-Effort Cancellation:**
- Cancellation before executing state → Transition to failed (no provider invocation)
- Cancellation during executing state → Depends on provider response timing
  - If provider has not yet responded → Transition to failed (request aborted)
  - If provider has already responded → Transition to completed (too late to cancel)
- Cancellation after executing state → Ignored (execution already committed)

**Cancellation Failure Handling:**
- If cancellation succeeds → failed state with AITimeoutException
- If cancellation too late → completed state with AIExecutionResult
- Caller MUST handle both outcomes (cancellation is non-deterministic)

**Cancellation Non-Guarantees:**
- Service does NOT guarantee cancellation succeeds
- Service does NOT refund tokens if cancellation too late
- Service does NOT track cancellation attempts

### 5.3 Failure Propagation

All failures propagate as **exceptions**, not error states:

**Failure Propagation Rules:**
- Service throws AIExecutionException (or subclass)
- Exception includes executionId, category, adapter, provider
- Caller receives exception synchronously (no async error handling)
- Failed state is observable via exit log (outcome=failure)

**No Partial Results:**
- Failed executions never return partial AIExecutionResult
- Failed executions never record partial token counts
- Failed executions always produce zero tokens (per Phase 15C)

---

## 6. Token & Billing Eligibility by State

### 6.1 Token Production by Terminal State

Token counts are produced ONLY in the **completed** terminal state:

**completed State:**
- ✅ Tokens produced: tokensUsed > 0
- ✅ Tokens recorded to token-usage table
- ✅ Billable: Caller MUST bill end users (per Phase 15C)
- Observable: Exit log includes tokensUsed

**failed State:**
- ❌ Tokens produced: Zero tokens always
- ❌ Tokens NOT recorded to token-usage table
- ❌ NOT billable: Caller MUST NOT bill end users (per Phase 15C)
- Observable: Exit log includes errorType, errorCategory (no tokensUsed)

### 6.2 Token Eligibility by Non-Terminal State

Non-terminal states do NOT produce tokens:

**received, validating, routing:**
- No provider invocation occurred
- No tokens consumed
- If execution fails in these states → Zero tokens

**executing:**
- Provider invocation in progress
- Tokens NOT YET recorded
- If execution fails during executing → Zero tokens
- If execution succeeds → Tokens recorded in recording_tokens state

**recording_tokens:**
- Tokens being recorded to database
- If recording fails → Zero tokens (execution transitions to failed)
- If recording succeeds → Tokens recorded (execution transitions to completed)

### 6.3 Alignment with Phase 13–15 Token Policy

Phase 15D state model enforces Phase 13–15 token policy:

**Phase 13 (Token Recording):**
- Token recording occurs atomically in recording_tokens state
- Token recording only happens on success path (executing → recording_tokens → completed)
- Token recording failure causes transition to failed state

**Phase 15A (Caller Responsibility):**
- Callers own billing decisions based on terminal state
- completed → Caller bills end users
- failed → Caller does NOT bill end users

**Phase 15C (Token Eligibility):**
- All exceptions produce zero tokens → failed state always zero tokens
- AIExecutionResult produces tokens → completed state always has tokens
- No partial billing → No intermediate state produces tokens

---

## 7. Observability Alignment

### 7.1 Observable State Transitions

The following state transitions are **observable via logs** (per Phase 15B):

**Entry Log (received State):**
- Logged when execution enters received state
- Fields: executionId, timestamp, adapter (attempted), provider (attempted), model
- Optional: sessionId, userId, conversationId (if caller provided)

**Exit Log (completed State):**
- Logged when execution enters completed terminal state
- Fields: executionId, timestamp, adapter, provider, model, tokensUsed, durationMs, outcome=success
- Optional: sessionId, userId, conversationId

**Exit Log (failed State):**
- Logged when execution enters failed terminal state
- Fields: executionId, timestamp, adapter, provider, model, errorType, errorCategory, durationMs, outcome=failure
- Optional: sessionId, userId, conversationId, errorCode, errorMessage (sanitized)

### 7.2 Non-Observable State Transitions

The following state transitions are NOT logged separately (performance optimization):

**Internal Transitions:**
- received → validating (no separate log)
- validating → routing (no separate log)
- routing → executing (no separate log)
- executing → recording_tokens (no separate log)
- recording_tokens → completed (logged as completed exit log)

**Why Not Logged:**
- Internal states are short-lived (milliseconds to seconds)
- Logging every transition introduces performance overhead
- Execution duration (durationMs) captures total time across all states
- Debugging can infer state from entry/exit logs + exception type

### 7.3 Correlation Across States

Execution state transitions are **correlated via executionId**:

**Correlation Rules:**
- executionId generated at received state
- executionId propagated to all logs (entry log, exit log)
- executionId included in AIExecutionResult and AIExecutionException
- Caller uses executionId to correlate logs across states

**Cross-Request Non-Correlation:**
- Service does NOT correlate retries (each retry is new executionId)
- Service does NOT correlate idempotent requests (caller owns idempotency)
- Caller uses sessionId, userId to correlate across executions (per Phase 15B)

### 7.4 Observability Non-Guarantees

The service does NOT provide:

- Real-time state query APIs (no "get execution state" endpoint)
- State change webhooks or callbacks (execution is synchronous)
- State aggregation or analytics (callers query logs for this)
- State machine visualization (states are conceptual, not persisted)

---

## 8. Explicit Non-Responsibilities

### 8.1 Service Non-Responsibilities

The service does NOT:

**State Persistence:**
- Store execution state in database or cache
- Provide state query or mutation APIs
- Track state across retries or requests

**Workflow Orchestration:**
- Implement workflow engine or state machine library
- Support long-running or async executions
- Provide compensation or rollback logic

**Retry State Tracking:**
- Track retry attempts across executions
- Correlate retries via idempotency keys
- Deduplicate retry requests

**Cancellation Guarantees:**
- Guarantee cancellation succeeds (best-effort only)
- Refund tokens if cancellation too late
- Track cancellation attempts

**Cross-Request State:**
- Track user sessions or conversation state
- Correlate executions across users
- Aggregate state transitions for analytics

### 8.2 Adapter Non-Responsibilities

Adapters do NOT:

**State Management:**
- Transition to terminal states (service does this)
- Record tokens (service does this)
- Log state transitions (service does this)

**Retry Logic:**
- Retry provider API calls (violates Phase 15A)
- Implement provider fallback (service is stateless)

### 8.3 Caller Non-Responsibilities

Callers do NOT:

**State Tracking:**
- Query execution state (no API exists)
- Mutate execution state (no API exists)
- Track state across retries (each retry is new execution)

**State Correlation:**
- Correlate state transitions (service logs do this)
- Aggregate state transitions (callers query logs if needed)

---

## 9. Safe Resume Point

### 9.1 What Future Phases May Build On

Future phases may:

- **Implement state logging** — Log entry/exit state transitions per Phase 15B (Phase 16+)
- **Add state tracing** — Distributed tracing spans for state transitions (Phase 17+)
- **Implement cancellation handling** — Best-effort cancellation logic (Phase 18+)
- **Add state metrics** — Counters for completed vs failed states, histograms for state duration (Phase 19+)
- **Implement timeout middleware** — Caller-enforced timeout utilities (Phase 20+)
- **Add debug logging** — Verbose logs for internal state transitions (validating, routing, recording_tokens) (Phase 21+)

### 9.2 What Future Phases Must NOT Change

The following lifecycle policies are **immutable** for all v1.x versions:

- **States are logical, not persisted** — No state storage or query APIs
- **Deterministic outcome** — Exactly one terminal state (completed XOR failed)
- **Token recording only on completed** — failed state always produces zero tokens
- **Stateless execution** — No cross-request state tracking
- **Cancellation is best-effort** — No guaranteed cancellation
- **Linear state progression** — No backwards or skipped transitions

Changing any of these requires:

1. Formal reopening of Phase 15D
2. Version bump to v2.0
3. Update to Phase 15D checkpoint document
4. Notification to all callers of breaking changes

### 9.3 Integration with Phase 15A, 15B, 15C

Phase 15D complements prior design phases:

**Phase 15A established:**
- Callers own retries, idempotency, quotas, billing, timeouts
- Service is stateless and synchronous
- Token recording only on success

**Phase 15B established:**
- Service logs execution metadata (executionId, adapter, provider, tokens, duration)
- Content is never logged (user prompts, AI responses)
- Audit trail enables billing verification but not billing calculation

**Phase 15C established:**
- Failure taxonomy (validation, provider, rate_limit, timeout, unknown)
- Retry eligibility policy (validation never retryable, rate_limit always retryable)
- Token eligibility (all failures produce zero tokens)

**Phase 15D extends:**
- Defines execution lifecycle (received → validating → routing → executing → recording_tokens → completed/failed)
- Defines state ownership (service owns all transitions)
- Defines terminal states (completed = tokens recorded, failed = zero tokens)
- Defines cancellation semantics (best-effort signal, not a state)
- Defines observability per state (entry/exit logs, executionId correlation)

---

## Declaration of Finality

### Completion Statement

**Phase 15D DESIGN is COMPLETE and LOCKED as of 2026-02-05.**

### Immutability Clause

No changes to execution lifecycle or state model are permitted without:

1. Formal reopening of Phase 15D
2. Explicit approval from project governance
3. Version bump to v2.0 (if state semantics change)
4. Update to this design document

### Policy Authority

This document is the **authoritative source** for execution lifecycle policy. In case of conflict:

1. This document supersedes code comments
2. This document supersedes implementation assumptions
3. This document supersedes "helpful" state management enhancements

**THIS DOCUMENT WINS.**

---

**END OF PHASE 15D DESIGN**
