# PHASE 15B DESIGN: Execution Observability & Audit Policy

**Status:** DESIGN CHECKPOINT
**Nature:** Design-Only Phase / Policy Definition
**Version:** v1.0
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Observability scope locked:** executionId, adapter, provider, tokens, duration, error type—content redacted by default
• **Audit trail defined:** Success = (executionId, adapter, provider, tokens, duration); Failure = (executionId, adapter, error type)
• **Privacy enforced:** User prompts and AI responses never logged by service, callers own content visibility
• **Correlation IDs established:** executionId (service-owned, per-request unique), sessionId (caller-provided, optional)
• **Deterministic observability:** Timing and content are non-deterministic; execution path and outcome type are deterministic

---

## 1. Purpose & Scope

### 1.1 Purpose

Phase 15B defines **what execution metadata is observable** during AI execution without implementing observability tooling. This phase establishes the **policy boundary** between execution observability and execution behavior.

### 1.2 Scope

Phase 15B defines:

- **Execution identifiers** — executionId, sessionId, adapter, provider, model
- **Observable execution metadata** — What can be logged, traced, and audited
- **Logging guarantees** — When logs must exist, what they must contain
- **Redaction rules** — What content must never be logged by the service
- **Privacy boundaries** — Service vs caller responsibility for content visibility
- **Failure visibility** — What metadata is available when execution fails
- **Audit trail requirements** — Minimum data required for execution auditing
- **Non-observable guarantees** — What the service explicitly does not track

### 1.3 What Phase 15B Does NOT Define

Phase 15B explicitly does NOT define:

- Logging implementation (libraries, formats, destinations)
- Metrics systems (Prometheus, OpenTelemetry, StatsD)
- Tracing SDKs (Jaeger, Zipkin, OpenTelemetry)
- Dashboard or UI implementations
- Log storage schemas or retention policies
- Caller-side observability implementations
- Business intelligence or analytics queries
- Real-time monitoring alerting rules

---

## 2. Observability Principles

### 2.1 Core Principles

The AI Service observability model is governed by the following principles:

**Principle 1: Execution Path Observability**
- The service execution path (adapter selection, provider routing, token recording) is fully observable
- Execution timing and metadata are logged at service boundaries

**Principle 2: Content Privacy by Default**
- User prompts and AI-generated responses are **never logged by the service**
- Callers own content visibility and logging decisions

**Principle 3: Failure Transparency**
- Exception types, error categories, and provider error codes are observable
- Exception messages are informational and may be logged (no PII)

**Principle 4: Deterministic Metadata**
- Execution identifiers (executionId, adapter, provider) are deterministic and observable
- Execution outcomes (success vs exception type) are deterministic and observable
- Execution duration and token counts are non-deterministic but observable

**Principle 5: Caller-Provided Correlation**
- Callers may provide optional correlation identifiers (sessionId, userId, conversationId)
- Service propagates caller-provided identifiers without validation or storage

**Principle 6: Stateless Observability**
- Service logs individual execution events only
- Service does not aggregate, correlate, or persist execution history
- Callers own cross-request correlation and historical analysis

---

## 3. Execution Identifiers & Correlation

### 3.1 Service-Owned Identifiers

The service generates and tracks the following identifiers per execution:

**executionId**
- Type: UUID v4 (randomly generated per request)
- Scope: Single execution request
- Lifecycle: Generated at request entry, propagated through execution, included in logs and results
- Purpose: Unique identifier for debugging and audit trail correlation
- Guarantee: Never reused, globally unique across all executions

**adapter**
- Type: String (enum: "claude", "openai", "gemini")
- Scope: Single execution request
- Lifecycle: Determined during adapter selection, included in logs and results
- Purpose: Identifies which provider adapter was invoked

**provider**
- Type: String (enum: "anthropic", "openai", "google")
- Scope: Single execution request
- Lifecycle: Derived from adapter, included in logs and results
- Purpose: Identifies which AI provider serviced the request

**model**
- Type: String (e.g., "claude-3-opus-20240229")
- Scope: Single execution request
- Lifecycle: Provided in request, validated by adapter, included in logs and results
- Purpose: Identifies which AI model was used

### 3.2 Caller-Provided Identifiers (Optional)

Callers may provide the following optional correlation identifiers:

**sessionId**
- Type: String (caller-defined, opaque to service)
- Scope: Caller-managed grouping of related executions
- Lifecycle: Provided in AIExecutionRequest.metadata, propagated to logs if present
- Purpose: Enables caller-side correlation of executions within a user session
- Guarantee: Service does not validate, store, or interpret sessionId

**userId**
- Type: String (caller-defined, opaque to service)
- Scope: Caller-managed user identity
- Lifecycle: Provided in AIExecutionRequest.metadata, propagated to logs if present
- Purpose: Enables caller-side correlation of executions per user
- Guarantee: Service does not validate, store, or interpret userId

**conversationId**
- Type: String (caller-defined, opaque to service)
- Scope: Caller-managed conversation thread
- Lifecycle: Provided in AIExecutionRequest.metadata, propagated to logs if present
- Purpose: Enables caller-side correlation of executions within a conversation
- Guarantee: Service does not validate, store, or interpret conversationId

### 3.3 Correlation Rules

- **Service-owned IDs are always present** — executionId, adapter, provider, model are guaranteed in logs
- **Caller-provided IDs are optional** — sessionId, userId, conversationId are included only if provided
- **Service does not enforce correlation** — Service logs IDs but does not join or aggregate executions
- **Callers own cross-request correlation** — Callers use logs/traces to correlate executions via shared IDs

---

## 4. Logging Guarantees

### 4.1 Success Path Logging

When execution succeeds (returns AIExecutionResult), the service guarantees the following metadata is observable:

**Required Success Metadata:**
- `executionId` — Unique execution identifier
- `timestamp` — ISO 8601 timestamp of request entry
- `adapter` — Adapter used (claude, openai, gemini)
- `provider` — Provider used (anthropic, openai, google)
- `model` — Model identifier
- `tokensUsed` — Total tokens consumed (from provider)
- `durationMs` — Execution duration in milliseconds
- `outcome` — "success"

**Optional Success Metadata (if provided by caller):**
- `sessionId` — Caller-provided session identifier
- `userId` — Caller-provided user identifier
- `conversationId` — Caller-provided conversation identifier

**Explicitly Excluded from Logs:**
- `messages` — User prompts and conversation history (never logged)
- `responseText` — AI-generated response content (never logged)
- `systemPrompt` — System instructions (never logged)

### 4.2 Failure Path Logging

When execution fails (throws typed exception), the service guarantees the following metadata is observable:

**Required Failure Metadata:**
- `executionId` — Unique execution identifier
- `timestamp` — ISO 8601 timestamp of request entry
- `adapter` — Adapter attempted (if selection succeeded)
- `provider` — Provider attempted (if adapter selection succeeded)
- `model` — Model identifier (if provided in request)
- `errorType` — Exception class name (AIProviderError, AIRateLimitError, etc.)
- `errorCategory` — High-level category (validation, provider, rate_limit, timeout, unknown)
- `durationMs` — Execution duration before failure
- `outcome` — "failure"

**Optional Failure Metadata:**
- `errorCode` — Provider-specific error code (if available from provider)
- `errorMessage` — Sanitized exception message (no PII, informational only)
- `sessionId`, `userId`, `conversationId` — If provided by caller

**Explicitly Excluded from Logs:**
- `messages` — User prompts (never logged even on failure)
- `stackTrace` — Internal stack traces (logged separately in debug logs, not audit logs)
- `sensitiveDetails` — API keys, tokens, credentials (redacted)

### 4.3 Logging Timing Guarantees

- **Entry logging** — Execution entry is logged before adapter invocation
- **Exit logging** — Execution exit is logged after result or exception
- **Synchronous logging** — Logs are emitted before response is returned to caller
- **No delayed logging** — Service does not queue or batch audit logs

---

## 5. Redaction & Privacy Rules

### 5.1 Content Redaction Policy

The service enforces the following content redaction rules:

**Always Redacted (Never Logged by Service):**
- User prompts (`messages[].content`)
- AI-generated responses (`responseText`)
- System prompts or instructions
- Conversation history text
- File contents or attachments
- Tool use arguments (if tools are added in future phases)

**Never Redacted (Always Observable):**
- Execution identifiers (executionId, adapter, provider, model)
- Token counts (`tokensUsed`)
- Execution duration (`durationMs`)
- Exception types and categories
- Timestamp and outcome

**Conditionally Redacted (Sanitized Before Logging):**
- Exception messages (sanitized to remove PII, paths, sensitive data)
- Model identifiers (logged as-is, may contain version info)
- Provider error codes (logged as-is, informational)

### 5.2 Privacy Responsibility Boundaries

**Service Responsibility:**
- Never log user prompts or AI responses
- Sanitize exception messages to remove PII
- Redact API keys and credentials from all logs

**Caller Responsibility:**
- Decide whether to log conversation content (user prompts, AI responses)
- Implement user consent for content logging
- Comply with privacy regulations (GDPR, CCPA, etc.)
- Redact sensitive user data before calling service (if required by policy)

### 5.3 Why Content Is Not Logged by Service

The service does not log conversation content for the following reasons:

1. **Privacy by design** — Minimize PII exposure and data retention
2. **Regulatory compliance** — Avoid service-level GDPR/CCPA liability
3. **Caller flexibility** — Enable callers to implement custom content logging policies
4. **Storage efficiency** — Conversation content is large and expensive to store
5. **Stateless architecture** — Service has no business reason to retain content

---

## 6. Failure & Exception Visibility

### 6.1 Exception Observability Rules

When execution fails, the following exception metadata is observable:

**Always Observable:**
- Exception type (AIProviderError, AIRateLimitError, AIInvalidRequestError, etc.)
- Error category (validation, provider, rate_limit, timeout, unknown)
- Execution phase (adapter_selection, provider_invocation, token_recording, unknown)

**Conditionally Observable:**
- Provider error code (if provider returned structured error)
- Exception message (sanitized, informational only)
- HTTP status code (if applicable to provider error)

**Never Observable (Not Logged in Audit Logs):**
- Stack traces (logged separately in debug logs)
- Provider API keys or credentials
- Internal service implementation details

### 6.2 Exception Message Sanitization

Exception messages are sanitized before logging:

**Sanitization Rules:**
- Remove file paths (replace with `<path>`)
- Remove API keys (replace with `<redacted>`)
- Remove user identifiers (replace with `<userId>`)
- Remove IP addresses (replace with `<ip>`)
- Preserve error type, category, and actionable context

**Example Sanitization:**

Before: `Provider API key 'sk-abc123' is invalid at /var/app/config.json:42`
After: `Provider API key '<redacted>' is invalid at <path>`

### 6.3 Failure Correlation

Failed executions can be correlated via:

- `executionId` — Unique to failed execution
- `sessionId` — Links failure to broader user session (if provided)
- `timestamp` — Enables temporal correlation with other events
- `errorType` + `errorCategory` — Enables failure pattern analysis

---

## 7. Audit Trail Guarantees

### 7.1 Minimum Audit Trail

Every execution (success or failure) produces an audit trail containing:

**Universal Audit Fields:**
1. `executionId` — Unique execution identifier
2. `timestamp` — ISO 8601 timestamp
3. `outcome` — "success" or "failure"
4. `adapter` — Adapter used or attempted
5. `provider` — Provider used or attempted
6. `model` — Model identifier
7. `durationMs` — Execution duration

**Success-Specific Fields:**
8. `tokensUsed` — Tokens consumed

**Failure-Specific Fields:**
9. `errorType` — Exception class
10. `errorCategory` — Error category

### 7.2 Audit Trail Purpose

The audit trail enables:

- **Debugging** — Trace individual execution failures via executionId
- **Billing verification** — Verify token charges against successful executions
- **Usage analysis** — Aggregate execution counts by adapter, provider, model
- **Failure analysis** — Identify failure patterns by errorType and errorCategory
- **SLA monitoring** — Track execution duration and success rates

### 7.3 Audit Trail Non-Goals

The audit trail explicitly does NOT enable:

- **Content auditing** — Conversation content is not logged
- **User behavior analysis** — No user prompts or response tracking
- **Quota enforcement** — Service does not track per-user usage
- **Billing calculation** — Service does not compute costs or aggregate usage
- **Historical replay** — Execution cannot be replayed from audit logs (content not logged)

---

## 8. Explicit Non-Observables

### 8.1 What Is Explicitly NOT Observable

The following data is **explicitly excluded** from service observability:

**Conversation Content:**
- User prompts (`messages[].content`)
- AI-generated responses (`responseText`)
- System prompts or instructions
- Conversation history

**User Identity & State:**
- User identity (unless caller provides `userId` in metadata)
- User session state
- User quota or usage history
- User authentication tokens

**Business Logic:**
- Billing calculations or cost data
- Quota enforcement logic or limits
- Retry attempt counts (service does not retry)
- Idempotency cache hits/misses (service does not deduplicate)

**Internal Implementation Details:**
- Adapter implementation code paths
- Provider SDK internal state
- Token recording database queries
- Service framework internals (NestJS lifecycle, dependency injection)

**Provider-Specific Secrets:**
- API keys or credentials
- Provider authentication tokens
- Provider-specific configuration

### 8.2 Why Non-Observables Exist

Non-observables exist to:

1. **Preserve privacy** — Avoid logging sensitive user data
2. **Minimize liability** — Reduce PII retention and regulatory risk
3. **Maintain statelessness** — Service does not track cross-request state
4. **Respect caller boundaries** — Callers own user identity, quotas, and billing
5. **Reduce storage costs** — Conversation content is large and expensive

---

## 9. Safe Resume Point

### 9.1 What Future Phases May Build On

Future phases may:

- **Implement structured logging** — JSON-formatted logs with standardized fields (Phase 16+)
- **Add distributed tracing** — OpenTelemetry spans for execution path visualization (Phase 17+)
- **Introduce metrics** — Prometheus counters for execution counts, duration histograms (Phase 17+)
- **Add debug logging** — Verbose logs for adapter behavior, provider responses (Phase 18+)
- **Implement caller-side observability libraries** — SDKs for log aggregation, correlation (Phase 19+)
- **Add content logging opt-in** — Callers explicitly enable conversation content logging (Phase 20+)

### 9.2 What Future Phases Must NOT Change

The following observability policies are **immutable** for all v1.x versions:

- **Content is never logged by service** — User prompts and AI responses are always redacted
- **Service is stateless** — No cross-request aggregation or correlation by service
- **Callers own content visibility** — Service does not enforce or implement content logging policies
- **executionId is unique per request** — Never reused, always present in logs
- **Token recording only on success** — Failed executions never log token counts
- **Exception types are stable** — Exception class names are part of public API contract

Changing any of these requires:

1. Formal reopening of Phase 15B
2. Version bump to v2.0
3. Update to Phase 15B checkpoint document
4. Notification to all callers of breaking changes

### 9.3 Integration with Phase 15A

Phase 15B complements Phase 15A caller responsibility policy:

**Phase 15A established:**
- Callers own retries, idempotency, quotas, billing, timeouts
- Service is stateless and synchronous
- Token recording only on success

**Phase 15B extends:**
- Callers own content logging decisions
- Service logs execution metadata only (no content)
- Audit trail enables billing verification but not billing calculation
- Callers must implement observability for user-facing features (quota tracking, usage dashboards)

---

## Declaration of Finality

### Completion Statement

**Phase 15B DESIGN is COMPLETE and LOCKED as of 2026-02-05.**

### Immutability Clause

No changes to observability guarantees are permitted without:

1. Formal reopening of Phase 15B
2. Explicit approval from project governance
3. Version bump to v2.0 (if content logging policy changes)
4. Update to this design document

### Policy Authority

This document is the **authoritative source** for execution observability policy. In case of conflict:

1. This document supersedes code comments
2. This document supersedes implementation assumptions
3. This document supersedes "helpful" logging enhancements

**THIS DOCUMENT WINS.**

---

**END OF PHASE 15B DESIGN**
