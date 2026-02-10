# PHASE 17A DESIGN: Dogfooding Observability Layer

**Status:** DESIGN CHECKPOINT
**Nature:** Design-Only Phase / Observability Policy
**Version:** v1.0
**Date:** 2026-02-05

---

## ULTRA-BRIEF SUMMARY

• **Observability scope defined:** Execution timing (total, adapter, token recording), metadata (executionId, adapter, provider, model, outcome, failure category)—logged synchronously per execution
• **Privacy reaffirmed:** Prompts and AI responses NEVER logged—only execution metadata and timing signals observable
• **Aggregate signals designed:** Latency percentiles (p50/p95/p99), failure rates by category, token usage by provider/model—computed from execution logs, not stored
• **Ownership locked:** Service logs execution signals, caller queries/aggregates logs, caller owns alerting/dashboards/mitigation—no service-level observability guarantees
• **Dogfooding intent:** Non-invasive observability for system owner validation before production—does not affect execution behavior, outcomes, or correctness

---

## 1. Phase Overview

### 1.1 Purpose

Phase 17A defines a **non-invasive observability layer** for private dogfooding of the AI Service before production deployment. This layer enables the system owner to observe real execution behavior, validate Phase 12-16 assumptions, and identify friction points without altering service behavior or contracts.

### 1.2 Dogfooding Context

**What is Dogfooding?**
- System owner uses the service internally before external release
- Owner observes real execution patterns, failures, and latencies
- Owner validates that Phase 12-16 contracts work as designed
- Owner identifies operational issues (e.g., excessive failures, slow adapters)

**What Dogfooding is NOT:**
- Not production observability (no SLOs, no production guarantees)
- Not monitoring (no alerting, no dashboards required)
- Not correctness validation (Phase 16 tests validate correctness)
- Not performance optimization (observability only, no tuning)

### 1.3 Scope

Phase 17A defines:

- **Execution signals** — What timing and metadata is logged per execution
- **Log format** — Structure and content of observability logs
- **Privacy guarantees** — Reaffirmation that prompts/responses are never logged
- **Aggregate signals** — How to compute latency percentiles, failure rates, token usage from logs
- **Ownership boundaries** — Service logs, caller queries/aggregates, caller owns interpretation
- **Failure visibility** — How failures appear in observability logs
- **Anti-patterns** — What observability must NOT do

### 1.4 What Phase 17A Does NOT Define

Phase 17A explicitly does NOT define:

- Log storage (implementation detail: file, database, stdout)
- Log aggregation tools (Elasticsearch, Splunk, CloudWatch)
- Metrics systems (Prometheus, StatsD, OpenTelemetry)
- Dashboards (Grafana, Kibana, custom UI)
- Alerting rules (PagerDuty, Slack, email)
- Tracing SDKs (Jaeger, Zipkin, OpenTelemetry spans)
- Retention policies (how long to keep logs)
- Query APIs (how callers retrieve logs)

---

## 2. Observability Signals (What is Logged)

### 2.1 Execution Entry Signal

**When Logged:** At the start of every execution (before adapter invocation)

**Required Fields:**
- `timestamp` — ISO 8601 timestamp (e.g., "2026-02-05T09:30:54.123Z")
- `level` — Log level ("INFO")
- `signal` — Signal type ("execution.entry")
- `executionId` — Unique execution identifier (UUID v4)
- `adapter` — Adapter to be used (e.g., "anthropic", "openai", "groq")
- `provider` — Provider to be invoked (e.g., "anthropic", "openai", "google")
- `model` — Model identifier (e.g., "claude-3-5-sonnet-20241022")

**Optional Fields (if caller provided):**
- `sessionId` — Caller-provided session identifier
- `userId` — Caller-provided user identifier
- `conversationId` — Caller-provided conversation identifier

**Example:**
```json
{
  "timestamp": "2026-02-05T09:30:54.123Z",
  "level": "INFO",
  "signal": "execution.entry",
  "executionId": "550e8400-e29b-41d4-a716-446655440000",
  "adapter": "anthropic",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "sessionId": "session-123",
  "userId": "user-789"
}
```

### 2.2 Execution Exit Signal (Success)

**When Logged:** After successful execution (AIExecutionResult returned)

**Required Fields:**
- `timestamp` — ISO 8601 timestamp
- `level` — Log level ("INFO")
- `signal` — Signal type ("execution.exit.success")
- `executionId` — Unique execution identifier (same as entry)
- `adapter` — Adapter used
- `provider` — Provider used
- `model` — Model used
- `tokensUsed` — Total tokens consumed (from provider)
- `durationMs` — Total execution duration in milliseconds
- `adapterDurationMs` — Adapter execution duration (provider API call)
- `tokenRecordingDurationMs` — Token recording duration (if implemented)
- `outcome` — Execution outcome ("success")

**Optional Fields:**
- `sessionId`, `userId`, `conversationId` (if provided at entry)

**Example:**
```json
{
  "timestamp": "2026-02-05T09:30:55.456Z",
  "level": "INFO",
  "signal": "execution.exit.success",
  "executionId": "550e8400-e29b-41d4-a716-446655440000",
  "adapter": "anthropic",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "tokensUsed": 150,
  "durationMs": 1333,
  "adapterDurationMs": 1280,
  "tokenRecordingDurationMs": 45,
  "outcome": "success",
  "sessionId": "session-123"
}
```

### 2.3 Execution Exit Signal (Failure)

**When Logged:** After failed execution (exception thrown)

**Required Fields:**
- `timestamp` — ISO 8601 timestamp
- `level` — Log level ("ERROR")
- `signal` — Signal type ("execution.exit.failure")
- `executionId` — Unique execution identifier
- `adapter` — Adapter attempted (if selection succeeded)
- `provider` — Provider attempted (if selection succeeded)
- `model` — Model identifier (if provided in request)
- `errorType` — Exception class name (e.g., "BadRequestException")
- `errorCategory` — Failure category per Phase 15C ("validation", "provider", "rate_limit", "timeout", "unknown")
- `durationMs` — Execution duration before failure
- `outcome` — Execution outcome ("failure")

**Optional Fields:**
- `errorMessage` — Sanitized exception message (no PII, per Phase 15B)
- `errorCode` — Provider-specific error code (if available)
- `httpStatusCode` — HTTP status code (if provider error)
- `sessionId`, `userId`, `conversationId` (if provided at entry)

**Example:**
```json
{
  "timestamp": "2026-02-05T09:30:55.789Z",
  "level": "ERROR",
  "signal": "execution.exit.failure",
  "executionId": "550e8400-e29b-41d4-a716-446655440001",
  "adapter": "anthropic",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "errorType": "ServiceUnavailableException",
  "errorCategory": "rate_limit",
  "errorMessage": "Anthropic API rate limit exceeded",
  "httpStatusCode": 429,
  "durationMs": 234,
  "outcome": "failure",
  "sessionId": "session-456"
}
```

### 2.4 Signal Timing Guarantees

**Synchronous Logging:**
- Entry signal logged BEFORE adapter invocation
- Exit signal logged AFTER execution completes (success or failure)
- Signals emitted within single request/response cycle (no async logging)

**Timing Accuracy:**
- `durationMs` — Measured from execution entry to exit (total execution time)
- `adapterDurationMs` — Measured from adapter.execute() call to return (provider API time)
- `tokenRecordingDurationMs` — Measured from token recording start to completion (if success)

**Non-Deterministic Timing:**
- Execution duration varies per request (non-deterministic)
- Adapter duration varies based on provider latency (non-deterministic)
- Token recording duration varies based on database performance (non-deterministic)

### 2.5 Signal Correlation

**Correlation via executionId:**
- Entry signal and exit signal share same `executionId`
- Callers correlate entry/exit signals via `executionId` to compute metrics
- executionId is unique per execution (never reused, per Phase 15B)

**Cross-Execution Correlation:**
- Callers use `sessionId`, `userId`, `conversationId` to correlate across executions
- Service does not correlate executions (stateless, per Phase 15A)
- Caller owns cross-execution analysis and aggregation

---

## 3. Aggregate Signals (Design Only)

### 3.1 Latency Metrics

**Computed from Execution Logs:**

**Total Latency (durationMs):**
- p50 (median): 50th percentile of execution durations
- p95: 95th percentile of execution durations
- p99: 99th percentile of execution durations

**Adapter Latency (adapterDurationMs):**
- p50, p95, p99 per adapter (anthropic, openai, groq)
- p50, p95, p99 per provider (anthropic, openai, google)

**Token Recording Latency (tokenRecordingDurationMs):**
- p50, p95, p99 for successful executions only

**Computation Methodology:**
- Caller queries execution logs for time range (e.g., last 1 hour)
- Caller extracts `durationMs` values from exit signals
- Caller computes percentiles using statistical aggregation
- Service does NOT compute or store percentiles

**Example Query (Pseudocode):**
```
logs = query("signal=execution.exit.success", last_1_hour)
durations = logs.map(log => log.durationMs)
p50 = percentile(durations, 50)
p95 = percentile(durations, 95)
p99 = percentile(durations, 99)
```

### 3.2 Failure Rate Metrics

**Computed from Execution Logs:**

**Overall Failure Rate:**
- Total failures / Total executions
- Computed from count of `execution.exit.failure` vs `execution.exit.success` signals

**Failure Rate by Category (Phase 15C):**
- Validation failures / Total failures
- Provider failures / Total failures
- Rate limit failures / Total failures
- Timeout failures / Total failures
- Unknown failures / Total failures

**Failure Rate by Adapter/Provider:**
- Failures per adapter (anthropic, openai, groq)
- Failures per provider (anthropic, openai, google)

**Computation Methodology:**
- Caller queries execution logs for time range
- Caller groups by `errorCategory`, `adapter`, `provider`
- Caller computes ratios (failures / total executions)

**Example Query (Pseudocode):**
```
success_count = count("signal=execution.exit.success", last_1_hour)
failure_count = count("signal=execution.exit.failure", last_1_hour)
failure_rate = failure_count / (success_count + failure_count)

rate_limit_failures = count("signal=execution.exit.failure AND errorCategory=rate_limit", last_1_hour)
rate_limit_rate = rate_limit_failures / failure_count
```

### 3.3 Token Usage Metrics

**Computed from Execution Logs:**

**Total Tokens Consumed:**
- Sum of `tokensUsed` from successful executions
- Aggregated per time period (hour, day, week)

**Tokens by Provider/Model:**
- Tokens consumed per provider (anthropic, openai, google)
- Tokens consumed per model (claude-3-5-sonnet, gpt-4, etc.)

**Tokens by User/Session:**
- Tokens consumed per `userId` (if provided)
- Tokens consumed per `sessionId` (if provided)

**Computation Methodology:**
- Caller queries `execution.exit.success` signals
- Caller sums `tokensUsed` field
- Caller groups by `provider`, `model`, `userId`, `sessionId`

**Example Query (Pseudocode):**
```
success_logs = query("signal=execution.exit.success", last_1_day)
total_tokens = sum(success_logs.map(log => log.tokensUsed))

tokens_by_provider = groupBy(success_logs, "provider").map(group => {
  provider: group.key,
  tokens: sum(group.map(log => log.tokensUsed))
})
```

### 3.4 Aggregate Signal Non-Goals

The service does NOT:
- Pre-compute percentiles (caller computes from logs)
- Store aggregate metrics in database (caller aggregates on demand)
- Provide query APIs for aggregates (caller queries logs directly)
- Implement dashboards (caller visualizes as needed)
- Enforce retention policies (logs may expire, no guarantee)

---

## 4. Privacy Model

### 4.1 Immutable Privacy Guarantees (Phase 15B)

Phase 17A **reaffirms** Phase 15B privacy policy:

**Always Redacted (NEVER Logged):**
- User prompts (`messages[].content`)
- AI-generated responses (`responseText`)
- System prompts or instructions
- Conversation history text
- File contents or attachments
- Any content-derived data (summaries, keywords, embeddings)

**Always Observable (Logged):**
- Execution identifiers (executionId, sessionId, userId, conversationId)
- Execution timing (durationMs, adapterDurationMs, tokenRecordingDurationMs)
- Execution metadata (adapter, provider, model)
- Token counts (tokensUsed) — numeric only, no content
- Exception types and categories (errorType, errorCategory)
- Timestamps and outcomes (success/failure)

**Conditionally Sanitized (Before Logging):**
- Exception messages (sanitized to remove PII, paths, API keys)
- Provider error codes (logged as-is, informational)

### 4.2 Privacy Responsibility Boundaries

**Service Responsibility:**
- Never log user prompts or AI responses (enforced by design)
- Sanitize exception messages to remove PII (per Phase 15B)
- Redact API keys and credentials from all logs
- Emit only metadata and timing signals

**Caller Responsibility:**
- Decide whether to log conversation content (service does not)
- Implement user consent for content logging (if required)
- Comply with privacy regulations (GDPR, CCPA) for any content logging
- Protect log access (logs contain user IDs, session IDs)

### 4.3 Privacy Verification

**How to Verify Privacy Compliance:**
1. Query all observability logs for time period
2. Search for sensitive patterns (SSN, credit card, email, API keys)
3. Assert: No prompt content present in logs
4. Assert: No response content present in logs
5. Assert: Only metadata (IDs, timing, counts) present

**Example Verification (Pseudocode):**
```
logs = query("signal=execution.*", last_1_hour)
for log in logs:
  assert "prompt" not in log
  assert "response" not in log
  assert "content" not in log
  assert log contains only {executionId, adapter, model, timing, tokens}
```

---

## 5. Observability Non-Goals

### 5.1 What Observability Does NOT Provide

**No Execution Behavior Changes:**
- Observability does NOT affect execution outcomes
- Logging failures do NOT cause execution failures
- Logging latency does NOT materially affect execution latency

**No Correctness Guarantees:**
- Observability is best-effort (logs may be lost)
- Service does not guarantee log delivery
- Service does not guarantee log durability
- Missing logs do NOT indicate execution failure

**No Performance Guarantees:**
- Observability overhead is non-zero but small
- Service does not guarantee observability performance
- Logging slow does NOT make execution slow (async if needed)

**No Production SLOs:**
- Observability is for dogfooding, not production monitoring
- No uptime guarantees (99.9%, 99.99%, etc.)
- No latency SLOs (p99 < 2s, etc.)
- No error rate SLOs (error rate < 1%, etc.)

### 5.2 What Observability Must NOT Do

**Must NOT Implement:**
- ❌ Retries (caller owns, per Phase 15A)
- ❌ Circuit breakers (caller owns)
- ❌ Rate limiting (caller owns, per Phase 15A)
- ❌ Billing calculation (caller owns, per Phase 15A)
- ❌ Quota enforcement (caller owns, per Phase 15A)
- ❌ Idempotency deduplication (caller owns, per Phase 15A)
- ❌ Alerting or paging (caller implements)
- ❌ Dashboards (caller implements)
- ❌ Metrics aggregation (caller computes)

**Must NOT Change:**
- ❌ Execution behavior (stateless, synchronous, throw-only)
- ❌ Token recording policy (only on success, per Phase 13)
- ❌ Exception propagation (throw-only, per Phase 15A)
- ❌ Privacy policy (no prompts/responses logged, per Phase 15B)
- ❌ Failure taxonomy (exception types stable, per Phase 15C)

---

## 6. Failure Interaction (How Failures Appear in Logs)

### 6.1 Failure Signal Format

**All failures produce `execution.exit.failure` signal:**

**Validation Failures (errorCategory: "validation"):**
- `errorType`: "BadRequestException"
- `httpStatusCode`: 400 (if provider error)
- `errorMessage`: "Invalid request to [provider] API"
- `durationMs`: Short (fails before provider invocation)

**Provider Failures (errorCategory: "provider"):**
- `errorType`: "InternalServerErrorException"
- `httpStatusCode`: 500, 502, 503 (if provider error)
- `errorMessage`: "[Provider] API server error"
- `durationMs`: Variable (depends on provider timeout)

**Rate Limit Failures (errorCategory: "rate_limit"):**
- `errorType`: "ServiceUnavailableException"
- `httpStatusCode`: 429
- `errorMessage`: "[Provider] API rate limit exceeded"
- `durationMs`: Short (provider rejects before execution)

**Timeout Failures (errorCategory: "timeout"):**
- `errorType`: "ServiceUnavailableException"
- `errorMessage`: "[Provider] API timeout"
- `durationMs`: Long (equals timeout duration)

**Unknown Failures (errorCategory: "unknown"):**
- `errorType`: "InternalServerErrorException"
- `errorMessage`: "Unexpected error during [provider] API call"
- `durationMs`: Variable

### 6.2 Failure Observability Examples

**Example: Rate Limit Failure**
```json
{
  "timestamp": "2026-02-05T09:31:00.123Z",
  "level": "ERROR",
  "signal": "execution.exit.failure",
  "executionId": "660e8400-e29b-41d4-a716-446655440002",
  "adapter": "anthropic",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "errorType": "ServiceUnavailableException",
  "errorCategory": "rate_limit",
  "errorMessage": "Anthropic API rate limit exceeded",
  "httpStatusCode": 429,
  "durationMs": 156,
  "outcome": "failure"
}
```

**Example: Provider Outage**
```json
{
  "timestamp": "2026-02-05T09:31:05.789Z",
  "level": "ERROR",
  "signal": "execution.exit.failure",
  "executionId": "770e8400-e29b-41d4-a716-446655440003",
  "adapter": "openai",
  "provider": "openai",
  "model": "gpt-4",
  "errorType": "InternalServerErrorException",
  "errorCategory": "provider",
  "errorMessage": "OpenAI API server error",
  "httpStatusCode": 503,
  "durationMs": 2345,
  "outcome": "failure"
}
```

### 6.3 Failure Pattern Detection

**Callers can detect failure patterns from logs:**

**High Rate Limit Failure Rate:**
```
rate_limit_failures = count("errorCategory=rate_limit", last_1_hour)
total_failures = count("signal=execution.exit.failure", last_1_hour)
rate_limit_ratio = rate_limit_failures / total_failures

if rate_limit_ratio > 0.5:
  # More than 50% of failures are rate limits
  # Caller should implement rate limiting or backoff
```

**Provider Outage Detection:**
```
provider_failures = count("errorCategory=provider AND provider=anthropic", last_5_min)
if provider_failures > 10:
  # High provider failure rate
  # Caller may switch to different provider
```

**Slow Adapter Detection:**
```
anthropic_durations = query("adapter=anthropic", last_1_hour).map(log => log.durationMs)
anthropic_p99 = percentile(anthropic_durations, 99)

openai_durations = query("adapter=openai", last_1_hour).map(log => log.durationMs)
openai_p99 = percentile(openai_durations, 99)

if anthropic_p99 > 2 * openai_p99:
  # Anthropic is significantly slower
  # Caller may prefer OpenAI for latency-sensitive requests
```

---

## 7. Caller Responsibilities

### 7.1 Observability Ownership

**Service Responsibilities (Emit Signals):**
- Log execution entry signal (before adapter invocation)
- Log execution exit signal (after completion, success or failure)
- Include all required fields (executionId, adapter, provider, model, timing, outcome)
- Sanitize exception messages (remove PII, API keys)
- Emit signals synchronously (within request/response cycle)

**Caller Responsibilities (Interpret Signals):**
- Query execution logs (file, database, stdout, aggregation service)
- Compute aggregate metrics (latency percentiles, failure rates, token usage)
- Detect failure patterns (rate limits, provider outages, slow adapters)
- Implement alerting (if needed for dogfooding)
- Implement dashboards (if needed for visibility)
- Implement mitigation (retries, fallback providers, rate limiting)

### 7.2 What Callers Must NOT Assume

**No Delivery Guarantees:**
- Logs may be lost (network failure, disk full, logging service down)
- Missing logs do NOT indicate execution failure
- Caller must NOT use logs for correctness guarantees

**No Durability Guarantees:**
- Logs may be deleted (retention policy, storage limits)
- Caller must NOT rely on logs for audit trail (Phase 15B audit trail is separate)

**No Real-Time Guarantees:**
- Logs may be delayed (buffering, batching, aggregation lag)
- Caller must NOT use logs for real-time alerting (best-effort only)

**No Backwards Compatibility Guarantees:**
- Log format may change in future phases (add fields, rename fields)
- Caller must handle unknown fields gracefully
- Dogfooding observability is experimental (may change)

### 7.3 Caller Best Practices

**Log Querying:**
- Use time range filters to limit query size (last 1 hour, last 1 day)
- Use signal type filters (`signal=execution.exit.success`)
- Use correlation filters (`executionId`, `sessionId`, `adapter`)

**Aggregate Computation:**
- Compute percentiles on demand (do not pre-aggregate)
- Refresh metrics periodically (every 1 minute, every 5 minutes)
- Store computed metrics separately (do not re-query logs)

**Failure Analysis:**
- Group failures by `errorCategory` to identify systemic issues
- Group failures by `provider` to identify provider-specific issues
- Correlate failures with external events (provider status pages)

**Alerting:**
- Alert on high failure rates (e.g., > 10% failures in last 5 minutes)
- Alert on high rate limit failures (e.g., > 50% of failures are rate limits)
- Alert on slow executions (e.g., p99 > 5 seconds)

---

## 8. Risks & Anti-Patterns

### 8.1 Anti-Pattern: Using Observability for Correctness

**Risk:**
- Caller assumes missing logs indicate execution failure
- Caller retries execution if logs are missing
- Caller rejects execution if logs are not written

**Mitigation:**
- Observability is best-effort, not correctness guarantee
- Execution outcome is deterministic (result OR exception)
- Missing logs do NOT affect execution outcome
- Caller must use execution result/exception for correctness, NOT logs

### 8.2 Anti-Pattern: Logging Performance Dependency

**Risk:**
- Service blocks execution until logs are written
- Service fails execution if logging fails
- Service waits for log confirmation before returning

**Mitigation:**
- Logging must be non-blocking (async if needed)
- Logging failures must NOT cause execution failures
- Service returns result/exception immediately, regardless of logging

### 8.3 Anti-Pattern: Content Logging Creep

**Risk:**
- Developer logs prompt "summary" or "keywords" (violates privacy)
- Developer logs response "preview" or "first 100 chars" (violates privacy)
- Developer logs "useful debugging info" containing content

**Mitigation:**
- Phase 15B privacy policy is immutable (no prompts, no responses, EVER)
- Any content-derived data (summaries, keywords, embeddings) is PROHIBITED
- Privacy verification tests (Phase 16) enforce this

### 8.4 Anti-Pattern: Observability Complexity Creep

**Risk:**
- Observability layer grows too complex (metrics, tracing, profiling)
- Observability becomes a maintenance burden
- Observability slows down development

**Mitigation:**
- Phase 17A is dogfooding only (minimal, temporary)
- Observability must remain simple (log entry, log exit, done)
- Production observability is future phase (17B+) with clear boundaries

### 8.5 Anti-Pattern: SLO Commitment from Dogfooding

**Risk:**
- System owner observes p99 latency of 1.2s during dogfooding
- System owner promises p99 < 1.5s to production users
- Production traffic breaks SLO, owner blames service

**Mitigation:**
- Dogfooding observability is NOT production monitoring
- No SLOs defined in Phase 17A (latency, error rate, availability)
- System owner must NOT commit to SLOs based on dogfooding data

---

## 9. Safe Resume Point

### 9.1 What Future Phases May Build On

Future phases may extend observability:

**Phase 17B+: Production Observability**
- Add structured logging (JSON format with schema)
- Add distributed tracing (OpenTelemetry spans)
- Add metrics export (Prometheus, StatsD)
- Define production SLOs (latency, error rate, availability)

**Phase 18+: Advanced Observability**
- Add custom metrics (business metrics, feature usage)
- Add log sampling (reduce log volume for high-traffic)
- Add log enrichment (geolocation, user agent, etc.)

**Phase 19+: Observability Tooling**
- Implement query APIs (REST endpoints for log queries)
- Implement dashboards (Grafana, custom UI)
- Implement alerting (PagerDuty, Slack, email)

### 9.2 What Future Phases Must NOT Change

The following observability policies are **immutable** for all v1.x versions:

**Privacy Guarantees (Phase 15B):**
- ✅ Prompts NEVER logged
- ✅ AI responses NEVER logged
- ✅ Content-derived data NEVER logged
- ✅ Only metadata and timing logged

**Execution Behavior (Phase 15A):**
- ✅ Observability does NOT affect execution outcomes
- ✅ Logging failures do NOT cause execution failures
- ✅ Service remains stateless (no cross-request aggregation)

**Ownership Boundaries (Phase 15A):**
- ✅ Service logs signals, caller interprets
- ✅ Caller owns retries, alerting, mitigation
- ✅ Caller owns dashboards, aggregation, analysis

**Signal Stability:**
- ✅ Signal types stable (`execution.entry`, `execution.exit.success`, `execution.exit.failure`)
- ✅ Required fields stable (executionId, adapter, provider, model, outcome)
- ✅ Optional fields may be added, but required fields never removed

Changing any of these requires:
1. Formal reopening of Phase 17A
2. Version bump to v2.0
3. Update to Phase 17A checkpoint document
4. Notification to all callers of breaking changes

### 9.3 Integration with Phase 15B

Phase 17A extends Phase 15B observability policy:

**Phase 15B established:**
- Execution metadata is observable (executionId, adapter, provider, tokens, duration)
- Content is never logged (prompts, responses)
- Audit trail requirements (success = tokens, failure = error type)

**Phase 17A extends:**
- Defines log signal format (entry, exit.success, exit.failure)
- Defines timing fields (durationMs, adapterDurationMs, tokenRecordingDurationMs)
- Defines aggregate signals (latency percentiles, failure rates, token usage)
- Defines caller responsibilities (query, aggregate, alert)
- Defines dogfooding context (not production, experimental)

---

## Declaration of Finality

### Completion Statement

**Phase 17A DESIGN is COMPLETE and LOCKED as of 2026-02-05.**

### Immutability Clause

No changes to observability signals or privacy guarantees are permitted without:

1. Formal reopening of Phase 17A
2. Explicit approval from project governance
3. Version bump to v2.0 (if privacy policy changes)
4. Update to this design document

### Policy Authority

This document is the **authoritative source** for dogfooding observability policy. In case of conflict:

1. This document supersedes code comments
2. This document supersedes implementation assumptions
3. This document supersedes "helpful" logging enhancements

**THIS DOCUMENT WINS.**

---

**END OF PHASE 17A DESIGN**
