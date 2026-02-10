# PHASE 26A DESIGN: Production Readiness & Operational Safety

**Phase:** 26A
**Nature:** DESIGN ONLY (No Implementation)
**Scope:** Platform-level operational readiness and safety controls
**Status:** DESIGN COMPLETE
**Date:** 2026-02-07
**Prerequisite:** Phases 12-25B-3 COMPLETE (Execution, Billing, Payments Design)
**Next Phase:** Phase 26B (Production Readiness Implementation)

---

## 1. Phase Overview

### 1.1 What Phase 26A Defines

Phase 26A establishes the complete design for **Production Readiness & Operational Safety**—the policies, controls, and safeguards required to operate the AI Sandbox Platform safely with real users, without changing execution, billing, or payment behavior.

**Core Achievement:**
A comprehensive operational framework that:
- Provides emergency controls (kill switches) for safe shutdown
- Enforces global safety limits (caps beyond per-key quotas)
- Enables non-invasive observability (metadata-only, no content)
- Defines incident response procedures (playbooks for common failures)
- Ensures data integrity and deterministic recovery
- Establishes operational access boundaries (role separation, audit logging)

**Key Architectural Principle:**
Production safety is **layered, fail-safe, and non-invasive**—kill switches disable capabilities without data loss, safety limits prevent runaway costs before execution, observability exposes metrics without content, and recovery procedures leverage immutability for deterministic replay.

### 1.2 Why Production Readiness is Separate from Core Features

**Critical Design Decision:**
Phase 26A separates **operational safety controls** from **feature implementation** (Phases 12-25).

**Rationale:**
- **Independence:** Safety controls should not be intertwined with business logic
- **Fail-Safe Defaults:** Emergency controls must work even if features fail
- **Auditability:** Clear separation enables compliance verification
- **Flexibility:** Safety policies can evolve without touching execution/billing code
- **Testing:** Operational procedures can be tested independently

**Clear Boundary:**
```
Phases 12-25: Core Platform (execution, billing, payments)
  → Feature-focused, deterministic, immutable

Phase 26A: Operational Safety (kill switches, limits, observability)
  → Policy-focused, fail-safe, non-invasive

Phase 26B+: Implementation of 26A policies
  → Configuration-driven, auditable, reversible
```

---

## 2. Kill Switches & Emergency Controls

### 2.1 Purpose & Scope

**Purpose:**
Kill switches enable operators to disable specific platform capabilities immediately during incidents, without code deployments or data loss.

**Use Cases:**
- Provider billing spike (disable specific provider)
- Billing calculation bug (disable snapshot creation)
- Payment provider outage (disable payment execution)
- Security incident (disable all execution)
- Maintenance window (disable globally, drain gracefully)

### 2.2 Kill Switch Types

**Kill Switch 1: Global Execution Disable**
```
Name: GLOBAL_EXECUTION_ENABLED
Type: Boolean flag
Default: true (enabled)
Scope: All AI execution requests

When disabled:
  - All /api/ai/execute requests return 503 Service Unavailable
  - Error message: "AI execution temporarily disabled for maintenance"
  - NO partial execution (request rejected before provider API call)
  - NO usage recording (ledger not written)
  - NO billing impact (no snapshots created for disabled period)

Enforcement Point:
  - api-gateway: Before auth/authz/quota checks
  - Fail-fast (return 503 immediately)
```

**Kill Switch 2: Provider-Specific Disable**
```
Name: PROVIDER_{PROVIDER}_ENABLED
Type: Boolean flag per provider
Default: true (enabled per provider)
Scope: Specific AI provider (openai, anthropic, groq, xai, deepseek)

Examples:
  PROVIDER_OPENAI_ENABLED=false → OpenAI requests return 503
  PROVIDER_ANTHROPIC_ENABLED=true → Anthropic requests allowed
  PROVIDER_GROQ_ENABLED=false → Groq requests return 503

When disabled:
  - Requests for disabled provider return 503 Service Unavailable
  - Error message: "Provider {provider} temporarily unavailable"
  - Other providers unaffected
  - NO usage recording for disabled provider
  - NO billing impact for disabled provider

Enforcement Point:
  - api-gateway: After auth/authz, before provider routing
  - Provider-specific failure (other providers continue)
```

**Kill Switch 3: Billing Snapshot Creation Disable**
```
Name: BILLING_SNAPSHOT_CREATION_ENABLED
Type: Boolean flag
Default: true (enabled)
Scope: BillingService snapshot creation

When disabled:
  - Usage ledger continues to record (immutable, append-only)
  - BillingService.createSnapshot() returns early (no-op)
  - NO snapshots created during disabled period
  - Billing visibility APIs return existing snapshots only
  - Execution UNAFFECTED (users can still execute AI requests)

Use Case:
  - Billing calculation bug detected
  - Disable snapshot creation while investigating
  - Usage continues to accrue in ledger
  - Re-enable after bug fixed, recompute snapshots from ledger

Enforcement Point:
  - api-gateway BillingService: At snapshot creation entry point
  - Usage recording UNAFFECTED (continues normally)
```

**Kill Switch 4: Invoice Generation Disable**
```
Name: INVOICE_GENERATION_ENABLED
Type: Boolean flag
Default: true (enabled)
Scope: InvoiceService invoice creation

When disabled:
  - Billing snapshots continue to be created and finalized
  - InvoiceService.createFromSnapshot() returns early (no-op)
  - NO invoices created during disabled period
  - Snapshots remain in 'finalized' state (not converted to invoices)
  - Payment attempts NOT initiated (no invoices to charge)

Use Case:
  - Invoice generation bug detected
  - Disable invoice creation while investigating
  - Billing continues normally (snapshots accurate)
  - Re-enable after bug fixed, create invoices from finalized snapshots

Enforcement Point:
  - api-gateway InvoiceService: At invoice creation entry point
  - Billing snapshot creation UNAFFECTED (continues normally)
```

**Kill Switch 5: Payment Execution Disable (Future-Proofing)**
```
Name: PAYMENT_EXECUTION_ENABLED
Type: Boolean flag
Default: true (enabled)
Scope: PaymentService payment attempts

When disabled:
  - Invoices continue to be created and finalized
  - PaymentService.chargeInvoice() returns early (no-op)
  - NO payment attempts created during disabled period
  - Invoices remain in 'finalized' state (not charged)
  - Webhook reconciliation continues (existing attempts only)

Use Case:
  - Payment provider outage
  - Payment logic bug detected
  - Disable payment execution while investigating
  - Invoices accumulate (can charge later)

Enforcement Point:
  - api-gateway PaymentService: At payment attempt entry point
  - Invoice creation UNAFFECTED (continues normally)

Note: Payment logic not yet implemented (Phase 25B design only)
```

### 2.3 Centralized Kill Switch Configuration

**Storage Location:**
```
Environment variables (production):
  GLOBAL_EXECUTION_ENABLED=true
  PROVIDER_OPENAI_ENABLED=true
  PROVIDER_ANTHROPIC_ENABLED=true
  PROVIDER_GROQ_ENABLED=true
  PROVIDER_XAI_ENABLED=true
  PROVIDER_DEEPSEEK_ENABLED=true
  BILLING_SNAPSHOT_CREATION_ENABLED=true
  INVOICE_GENERATION_ENABLED=true
  PAYMENT_EXECUTION_ENABLED=true

Database table (optional, for dynamic updates):
  kill_switches (
    switch_name VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    updated_by VARCHAR(255) NOT NULL
  )
```

**Refresh Strategy:**
```
Option A: Environment variables (requires app restart)
  + Simple, no database dependency
  - Requires restart (slower to apply)

Option B: Database table with cache (check every 30 seconds)
  + Dynamic updates (no restart)
  + Audit trail (who changed, when)
  - Database dependency

Recommended: Option B (database with cache refresh)
  - Cache TTL: 30 seconds
  - Fallback: Environment variables if DB unavailable
```

### 2.4 Fail-Safe Defaults

**Design Principle:**
If kill switch state cannot be determined (DB unavailable, cache expired, config missing), default to DISABLED (safe state).

**Fail-Safe Logic:**
```typescript
function isExecutionEnabled(): boolean {
  try {
    const killSwitch = getKillSwitch('GLOBAL_EXECUTION_ENABLED');
    return killSwitch?.enabled ?? false; // Default: false (disabled)
  } catch (error) {
    logger.error('Failed to check kill switch, defaulting to disabled');
    return false; // Fail-safe: disable execution
  }
}
```

**Rationale:**
- Unknown state = unsafe state
- Better to reject valid requests than allow dangerous ones
- Temporary downtime > financial loss or security breach

### 2.5 No Partial Execution States

**Guarantee:**
Kill switches prevent execution from starting, NOT from completing mid-flight.

**Enforcement:**
```
Kill switch check happens BEFORE:
  - Provider API call
  - Usage recording
  - Billing snapshot creation
  - Invoice creation
  - Payment execution

Result:
  - If kill switch is OFF: request rejected immediately (no side effects)
  - If kill switch is ON: request proceeds to completion (atomic)
  - No partial states (either full execution or no execution)
```

**Example:**
```
Time T0: User requests AI execution
Time T1: api-gateway checks GLOBAL_EXECUTION_ENABLED → true
Time T2: Request routed to ai-service
Time T3: Kill switch flipped to false (by operator)
Time T4: ai-service completes execution → SUCCESS
Time T5: Usage recorded, billing snapshot created

Result: Request T0 completes successfully (checked at T1, before execution)

Time T6: Another user requests AI execution
Time T7: api-gateway checks GLOBAL_EXECUTION_ENABLED → false
Time T8: Request rejected with 503 (no execution, no usage, no billing)
```

### 2.6 Kill Switch Audit Trail

**Audit Requirements:**
Every kill switch change must be logged:
```
kill_switch_audit_log (
  id UUID PRIMARY KEY,
  switch_name VARCHAR(100) NOT NULL,
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  changed_by VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP NOT NULL,
  reason TEXT,
  incident_id VARCHAR(100)
)
```

**Audit Log Content:**
- Who changed the switch (operator ID)
- When it was changed (timestamp)
- What changed (old → new value)
- Why it was changed (reason text, incident ID)

**No Mutable Audit Log:**
Audit records are append-only (never updated or deleted).

---

## 3. Global Safety Limits

### 3.1 Purpose & Scope

**Purpose:**
Global safety limits provide platform-wide caps that override per-key quotas, preventing runaway costs and abuse.

**Difference from Per-Key Quotas (Phase 20):**
```
Per-Key Quotas (Phase 20):
  - User-specific limits (tokens per month, requests per hour)
  - Enforced per API key
  - Configurable by plan (free, pro, enterprise)

Global Safety Limits (Phase 26A):
  - Platform-wide caps (ceiling above all user quotas)
  - Enforced globally (across all users)
  - Hard limits (not configurable by users)
```

**Use Cases:**
- Prevent single request from consuming excessive tokens
- Prevent DDoS-like request floods
- Cap daily spend to prevent billing spikes
- Provider-specific ceilings (respect provider rate limits)

### 3.2 Safety Limit Types

**Limit 1: Max Tokens Per Execution**
```
Name: MAX_TOKENS_PER_EXECUTION
Type: Integer (token count)
Default: 100,000 tokens
Scope: Single AI execution request

Enforcement:
  - Check requested max_tokens before execution
  - If requested > MAX_TOKENS_PER_EXECUTION: reject with 400 Bad Request
  - Error message: "Requested max_tokens exceeds platform limit (100,000)"

Rationale:
  - Prevents single request from consuming excessive tokens
  - Protects against accidental or malicious large requests
  - Provider-independent (applies to all providers)

Example:
  User requests max_tokens=200,000 → REJECTED (exceeds 100,000 limit)
  User requests max_tokens=50,000 → ALLOWED (within limit)
```

**Limit 2: Max Executions Per Minute (Global)**
```
Name: MAX_EXECUTIONS_PER_MINUTE_GLOBAL
Type: Integer (request count)
Default: 10,000 requests/minute
Scope: Entire platform (all users combined)

Enforcement:
  - Track execution count per minute (sliding window)
  - If current rate > MAX_EXECUTIONS_PER_MINUTE_GLOBAL: reject with 429 Too Many Requests
  - Error message: "Platform rate limit exceeded, retry after 60 seconds"

Rationale:
  - Protects backend infrastructure from overload
  - Prevents DDoS-like request floods
  - Allows graceful degradation (reject excess, accept within limit)

Implementation Note:
  - Sliding window counter (Redis or in-memory)
  - Increment on each execution attempt
  - Decrement after 60 seconds (time-based expiry)

Example:
  Current rate: 9,500 req/min → Request ALLOWED
  Current rate: 10,500 req/min → Request REJECTED (429)
```

**Limit 3: Max Daily Spend (Soft Cap)**
```
Name: MAX_DAILY_SPEND_SOFT_USD
Type: Decimal (USD amount)
Default: $10,000 USD per day
Scope: Entire platform (all users combined)

Enforcement:
  - Track cumulative usage cost per day (UTC day boundary)
  - If current day spend > MAX_DAILY_SPEND_SOFT_USD: log warning, send alert
  - NO request rejection (soft cap, observability only)

Rationale:
  - Early warning system for cost spikes
  - Operators notified before hard cap reached
  - Allows investigation without service disruption

Example:
  Daily spend: $8,000 → Normal operation
  Daily spend: $10,500 → Warning alert sent (execution continues)
  Daily spend: $19,000 → Critical alert sent (approaching hard cap)
```

**Limit 4: Max Daily Spend (Hard Cap)**
```
Name: MAX_DAILY_SPEND_HARD_USD
Type: Decimal (USD amount)
Default: $20,000 USD per day
Scope: Entire platform (all users combined)

Enforcement:
  - Track cumulative usage cost per day (UTC day boundary)
  - If current day spend >= MAX_DAILY_SPEND_HARD_USD: reject with 503 Service Unavailable
  - Error message: "Platform daily spend limit reached, service temporarily unavailable"

Rationale:
  - Absolute ceiling to prevent catastrophic billing
  - Last line of defense against runaway costs
  - Hard stop (rejects all requests until next day)

Recovery:
  - Automatic: Next UTC day (counter resets)
  - Manual: Operator raises hard cap (emergency override)

Example:
  Daily spend: $19,500 → Request ALLOWED (warning sent)
  Daily spend: $20,000 → All requests REJECTED (503)
  Next day (00:00 UTC): Counter resets, requests ALLOWED
```

**Limit 5: Provider-Specific Rate Limits**
```
Name: MAX_REQUESTS_PER_MINUTE_{PROVIDER}
Type: Integer (request count per provider)
Default: Provider-dependent
Scope: Per AI provider (openai, anthropic, groq, xai, deepseek)

Examples:
  MAX_REQUESTS_PER_MINUTE_OPENAI=5,000
  MAX_REQUESTS_PER_MINUTE_ANTHROPIC=3,000
  MAX_REQUESTS_PER_MINUTE_GROQ=10,000

Enforcement:
  - Track request count per provider per minute (sliding window)
  - If current rate > provider limit: reject with 429 Too Many Requests
  - Error message: "Provider {provider} rate limit exceeded, retry after 60 seconds"

Rationale:
  - Respect provider API rate limits (avoid 429s from provider)
  - Distribute load across providers (if one hits limit, others continue)
  - Provider-specific ceilings (each provider has different capacity)

Example:
  OpenAI: 4,900 req/min → Request ALLOWED
  OpenAI: 5,100 req/min → Request REJECTED (429)
  Anthropic: 2,500 req/min → Request ALLOWED (independent counter)
```

### 3.3 Enforcement Points

**Where Limits Are Checked:**
```
api-gateway request flow:
  1. Kill switch check (GLOBAL_EXECUTION_ENABLED)
  2. Provider kill switch check (PROVIDER_{X}_ENABLED)
  3. Authentication (API key valid?)
  4. Authorization (user has access?)
  5. Global rate limit check (MAX_EXECUTIONS_PER_MINUTE_GLOBAL)
  6. Provider rate limit check (MAX_REQUESTS_PER_MINUTE_{PROVIDER})
  7. Per-key quota check (Phase 20: tokens per month, requests per hour)
  8. Max tokens check (MAX_TOKENS_PER_EXECUTION)
  9. Daily spend check (MAX_DAILY_SPEND_HARD_USD)
  10. Execution proceeds (route to ai-service)

If any check fails: request rejected immediately (fail-fast)
```

**Enforcement Order Rationale:**
- Kill switches first (fastest, most critical)
- Auth/authz second (security)
- Rate limits third (protect infrastructure)
- Quota checks fourth (user-specific)
- Max tokens fifth (request validation)
- Daily spend sixth (cost protection)
- Execution last (only if all checks pass)

### 3.4 Deterministic Outcomes

**Guarantee:**
Same request state always produces same enforcement decision.

**Determinism Rules:**
- No randomness in limit checks
- No probabilistic rate limiting (no sampling)
- Time-based limits use consistent time source (UTC)
- Counters use deterministic increment/decrement logic
- Sliding windows use fixed duration (60 seconds, 24 hours)

**Example:**
```
Request A at 10:00:00 with current rate 9,999 req/min → ALLOWED
Request B at 10:00:01 with current rate 10,001 req/min → REJECTED (429)
Request C at 10:01:00 with current rate 9,500 req/min → ALLOWED (window shifted)

Deterministic: Same rate at same time always produces same result
```

### 3.5 Error Semantics

**HTTP Status Codes:**
```
400 Bad Request: Request invalid (e.g., max_tokens > MAX_TOKENS_PER_EXECUTION)
429 Too Many Requests: Rate limit exceeded (global or provider-specific)
503 Service Unavailable: Kill switch disabled or hard cap reached
```

**Error Response Format:**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Platform rate limit exceeded (10,000 req/min)",
  "retryAfter": 60
}
```

**No Retries at Service Level:**
- Platform does NOT retry on behalf of user
- User receives error immediately
- User responsible for retry logic (with backoff)

---

## 4. Operational Observability (Non-Content)

### 4.1 Purpose & Scope

**Purpose:**
Operational observability enables operators to monitor platform health and detect incidents without accessing user content (prompts, responses, PII).

**Privacy Guarantee:**
All observability metrics are content-free (metadata only).

### 4.2 Execution Observability

**Metrics (Prometheus-Style):**
```
# Execution counts
ai_executions_total{provider, status}
  - status: success | failure | rejected

# Execution latency
ai_execution_duration_seconds{provider}

# Execution token usage
ai_execution_tokens_total{provider, type}
  - type: input | output | total

# Provider failures
ai_provider_errors_total{provider, error_type}
  - error_type: rate_limit | timeout | invalid_response | provider_error

# Kill switch metrics
ai_execution_rejected_total{reason}
  - reason: global_kill_switch | provider_disabled | rate_limit | quota_exceeded

# Safety limit metrics
ai_safety_limit_exceeded_total{limit_type}
  - limit_type: max_tokens | global_rate | provider_rate | daily_spend
```

**Dashboards (Grafana-Style):**
```
Dashboard 1: Execution Health
  - Executions per minute (by provider)
  - Success rate (%) (by provider)
  - P50/P95/P99 latency (by provider)
  - Error rate (%) (by error type)

Dashboard 2: Provider Health
  - Provider availability (% uptime)
  - Provider error rate (by provider)
  - Provider latency (by provider)
  - Provider rate limit hits (count)

Dashboard 3: Safety Controls
  - Kill switch status (enabled/disabled by switch)
  - Rate limit status (% capacity used)
  - Daily spend ($ current vs $ limit)
  - Safety limit rejections (count by limit type)
```

**NO Content Exposure:**
```
❌ NEVER expose:
  - User prompts
  - AI responses
  - Conversation history
  - API key names (only IDs)
  - User emails or PII

✅ CAN expose:
  - Execution counts
  - Token counts (aggregated)
  - Error rates
  - Latency percentiles
  - Provider identifiers
```

### 4.3 Billing Observability

**Metrics:**
```
# Billing snapshot counts
billing_snapshots_total{status}
  - status: draft | finalized

# Billing snapshot creation latency
billing_snapshot_creation_duration_seconds

# Billing snapshot amounts
billing_snapshot_amount_usd_total

# Billing errors
billing_errors_total{error_type}
  - error_type: snapshot_creation_failed | finalization_failed
```

**Dashboards:**
```
Dashboard 4: Billing Health
  - Snapshots created per hour
  - Snapshot finalization rate (%)
  - Total billable amount ($ per day)
  - Billing errors (count by type)
```

### 4.4 Invoice & Payment Observability

**Metrics:**
```
# Invoice counts
invoices_total{status}
  - status: draft | finalized | paid | failed | written_off

# Payment attempt counts
payment_attempts_total{status}
  - status: pending | succeeded | failed

# Payment failure rates
payment_failures_total{failure_code}
  - failure_code: card_declined | provider_error | network_error

# Webhook reconciliation
webhook_events_total{provider, processing_status}
  - processing_status: pending | processed | ignored
```

**Dashboards:**
```
Dashboard 5: Invoice & Payment Health
  - Invoices created per day
  - Invoice payment rate (%)
  - Payment success rate (%)
  - Payment failure breakdown (by failure code)
  - Webhook event processing rate
```

### 4.5 Logging Standards

**Log Levels:**
```
INFO: Normal operations (execution started, snapshot created, invoice paid)
WARN: Degraded state (rate limit approaching, soft cap exceeded, retry attempt)
ERROR: Failure (execution failed, snapshot creation failed, payment failed)
CRITICAL: Incident (kill switch activated, hard cap exceeded, provider outage)
```

**Log Structure (JSON):**
```json
{
  "timestamp": "2026-02-07T10:30:45Z",
  "level": "ERROR",
  "service": "api-gateway",
  "message": "AI execution failed",
  "metadata": {
    "executionId": "exec_abc123",
    "provider": "openai",
    "errorType": "provider_timeout",
    "duration": 30000
  }
}
```

**NO Content in Logs:**
```
❌ NEVER log:
  - User prompts
  - AI responses
  - API key values (only IDs)
  - User emails or names

✅ CAN log:
  - Execution IDs
  - Provider identifiers
  - Error types
  - Latency values
  - Token counts
```

---

## 5. Incident Response Playbooks

### 5.1 Playbook Purpose

**Purpose:**
Incident response playbooks provide step-by-step procedures for common operational failures, ensuring consistent and safe responses.

**Playbook Structure:**
Each playbook includes:
1. Detection signals (how to identify incident)
2. Immediate actions (first steps to take)
3. Kill switches involved (which to activate)
4. Data integrity guarantees (what remains consistent)
5. Recovery steps (how to resume normal operation)

### 5.2 Playbook 1: Provider Outage

**Scenario:**
External AI provider (OpenAI, Anthropic, etc.) becomes unavailable.

**Detection Signals:**
- Spike in provider_error rate (> 50% errors)
- Provider API returning 5xx errors consistently
- Provider latency > 30 seconds
- Multiple user reports of failures

**Immediate Actions:**
```
1. Verify outage scope:
   - Check provider status page
   - Check other users affected
   - Confirm error type (timeout vs 5xx vs rate limit)

2. Activate kill switch:
   - Disable specific provider: PROVIDER_{PROVIDER}_ENABLED=false
   - Example: PROVIDER_OPENAI_ENABLED=false

3. Communicate to users:
   - Return 503 Service Unavailable
   - Error message: "Provider {provider} temporarily unavailable"
   - Suggest alternative providers (if available)

4. Monitor other providers:
   - Ensure other providers unaffected
   - Redistribute load if possible
```

**Kill Switches Involved:**
- PROVIDER_{PROVIDER}_ENABLED (disable specific provider)
- GLOBAL_EXECUTION_ENABLED (if all providers affected)

**Data Integrity Guarantees:**
- Usage ledger: Unaffected (no writes during outage)
- Billing snapshots: Unaffected (created from existing usage)
- Invoices: Unaffected (created from existing snapshots)
- NO data loss (requests rejected, not partially processed)

**Recovery Steps:**
```
1. Confirm provider recovery:
   - Test provider API manually
   - Check provider status page (operational)
   - Verify error rate < 1%

2. Re-enable provider:
   - Set PROVIDER_{PROVIDER}_ENABLED=true
   - Monitor error rate for 5 minutes

3. Verify normal operation:
   - Check execution success rate (> 95%)
   - Check latency (within normal range)
   - Check user reports (no new failures)

4. Post-incident review:
   - Document outage duration
   - Document impact (requests rejected)
   - Update runbook if needed
```

### 5.3 Playbook 2: Cost Spike

**Scenario:**
Platform daily spend exceeds expected rate, approaching hard cap.

**Detection Signals:**
- Daily spend > $10,000 (soft cap exceeded)
- Daily spend growth rate > 50% per hour
- Alert: "MAX_DAILY_SPEND_SOFT_USD exceeded"
- Unusual token usage patterns (spike in large requests)

**Immediate Actions:**
```
1. Identify source:
   - Query usage ledger by API key (top spenders)
   - Query execution logs (identify large requests)
   - Check provider distribution (which provider?)

2. Assess risk:
   - Current spend: $X / $20,000 (hard cap)
   - Estimated time to hard cap: Y hours
   - Is spike legitimate (expected usage) or anomalous (abuse)?

3. If anomalous spike:
   - Suspend high-usage API keys (Phase 20: quota enforcement)
   - Reduce MAX_TOKENS_PER_EXECUTION (lower ceiling)
   - Activate GLOBAL_EXECUTION_ENABLED=false (if critical)

4. If legitimate spike:
   - Communicate to stakeholders (expected high usage)
   - Temporarily raise hard cap (emergency override)
   - Monitor closely (ensure no abuse)
```

**Kill Switches Involved:**
- GLOBAL_EXECUTION_ENABLED (if critical, stop all execution)
- PROVIDER_{PROVIDER}_ENABLED (if spike is provider-specific)

**Data Integrity Guarantees:**
- Usage ledger: Accurate (all usage recorded before kill switch)
- Billing snapshots: Accurate (created from complete ledger)
- NO retroactive changes (usage already recorded is immutable)

**Recovery Steps:**
```
1. Root cause resolution:
   - If abuse: Permanently suspend offending API keys
   - If legitimate: Adjust quotas or plan limits
   - If bug: Fix cost calculation logic (recompute if needed)

2. Re-enable execution:
   - Set GLOBAL_EXECUTION_ENABLED=true (if disabled)
   - Restore MAX_TOKENS_PER_EXECUTION to normal
   - Monitor spend rate (ensure stability)

3. Verify spend tracking:
   - Check daily spend counter accuracy
   - Check billing snapshot amounts
   - Check usage ledger consistency

4. Post-incident review:
   - Document spike cause
   - Document cost impact
   - Update alerting thresholds if needed
```

### 5.4 Playbook 3: Billing Calculation Bug

**Scenario:**
Billing snapshot calculation produces incorrect amounts (overcharge or undercharge).

**Detection Signals:**
- User reports incorrect billing
- Snapshot amount mismatch vs manual calculation
- Billing snapshot creation errors
- Discrepancy between usage ledger and snapshot

**Immediate Actions:**
```
1. Verify bug scope:
   - Compare usage ledger vs billing snapshot (sample snapshots)
   - Check pricing rate consistency
   - Identify affected snapshots (date range)

2. Activate kill switch:
   - Disable snapshot creation: BILLING_SNAPSHOT_CREATION_ENABLED=false
   - Prevents new incorrect snapshots from being created
   - Execution continues normally (usage still recorded)

3. Isolate affected data:
   - Mark affected snapshots (status or flag column)
   - DO NOT delete (preserve for audit)
   - Document snapshot IDs and amounts

4. Communicate to stakeholders:
   - Notify affected users (billing issue identified)
   - Provide timeline for resolution
   - Assure no incorrect charges (invoices not yet issued)
```

**Kill Switches Involved:**
- BILLING_SNAPSHOT_CREATION_ENABLED (disable snapshot creation)
- INVOICE_GENERATION_ENABLED (disable invoice creation, if already enabled)

**Data Integrity Guarantees:**
- Usage ledger: Unaffected, immutable (source-of-truth)
- Affected snapshots: Marked, not deleted (preserved for audit)
- Invoices: Not created from affected snapshots (kill switch prevents)

**Recovery Steps:**
```
1. Fix billing logic:
   - Identify bug in snapshot calculation
   - Deploy fix to BillingService
   - Verify fix with test snapshots

2. Recompute affected snapshots:
   - Query usage ledger for affected period
   - Delete incorrect snapshots (or mark as voided)
   - Recompute snapshots using fixed logic
   - Verify amounts match expected values

3. Re-enable snapshot creation:
   - Set BILLING_SNAPSHOT_CREATION_ENABLED=true
   - Monitor new snapshots (ensure correctness)

4. Issue corrected invoices:
   - Set INVOICE_GENERATION_ENABLED=true (if disabled)
   - Generate invoices from corrected snapshots
   - Communicate to users (issue resolved)

5. Post-incident review:
   - Document bug cause
   - Document affected users
   - Add regression tests (prevent recurrence)
```

### 5.5 Playbook 4: Snapshot Corruption

**Scenario:**
Billing snapshot data appears corrupted (missing fields, inconsistent amounts, invalid references).

**Detection Signals:**
- Snapshot validation errors
- Foreign key violations (invalid usage record IDs)
- Amount calculation errors (NaN, negative values)
- Snapshot creation failures (database errors)

**Immediate Actions:**
```
1. Verify corruption scope:
   - Identify corrupted snapshots (snapshot IDs)
   - Check usage ledger integrity (source data)
   - Determine corruption cause (bug vs data loss)

2. Activate kill switch:
   - Disable snapshot creation: BILLING_SNAPSHOT_CREATION_ENABLED=false
   - Disable invoice generation: INVOICE_GENERATION_ENABLED=false
   - Prevents propagation to invoices

3. Isolate corrupted data:
   - Mark corrupted snapshots (flag column)
   - DO NOT delete (preserve for forensics)
   - Document corruption pattern

4. Verify usage ledger integrity:
   - Query usage_records table (check for corruption)
   - If ledger corrupted: CRITICAL (escalate immediately)
   - If ledger intact: Corruption limited to snapshots (recoverable)
```

**Kill Switches Involved:**
- BILLING_SNAPSHOT_CREATION_ENABLED (prevent new snapshots)
- INVOICE_GENERATION_ENABLED (prevent invoice creation)

**Data Integrity Guarantees:**
- Usage ledger: Immutable, append-only (source-of-truth)
- Corrupted snapshots: Marked, not deleted
- Invoices: Not created from corrupted snapshots

**Recovery Steps:**
```
1. Restore snapshot integrity:
   - If ledger intact: Recompute snapshots from ledger
   - If ledger corrupted: Restore from backup (if available)
   - Delete corrupted snapshots (after backup)

2. Re-enable snapshot creation:
   - Set BILLING_SNAPSHOT_CREATION_ENABLED=true
   - Monitor new snapshots (ensure no corruption)

3. Re-enable invoice generation:
   - Set INVOICE_GENERATION_ENABLED=true
   - Generate invoices from restored snapshots

4. Post-incident review:
   - Document corruption cause
   - Implement data validation checks
   - Add snapshot integrity monitoring
```

### 5.6 Playbook 5: Payment Provider Outage (Future)

**Scenario:**
External payment provider (Stripe, PayPal) becomes unavailable.

**Detection Signals:**
- Payment attempts timing out
- Provider API returning 5xx errors
- Webhook delivery failures
- Provider status page reports outage

**Immediate Actions:**
```
1. Verify outage scope:
   - Check provider status page
   - Test payment API manually
   - Confirm webhook delivery failures

2. Activate kill switch:
   - Disable payment execution: PAYMENT_EXECUTION_ENABLED=false
   - Invoices continue to be created (not charged)
   - Webhooks for existing attempts continue to be processed

3. Communicate to stakeholders:
   - Notify finance team (payment delays expected)
   - Document affected invoices (not charged during outage)
```

**Kill Switches Involved:**
- PAYMENT_EXECUTION_ENABLED (disable payment attempts)

**Data Integrity Guarantees:**
- Usage ledger: Unaffected
- Billing snapshots: Unaffected
- Invoices: Created normally (not charged during outage)
- Payment attempts: Not created during outage

**Recovery Steps:**
```
1. Confirm provider recovery:
   - Test payment API manually
   - Verify webhook delivery working
   - Check provider status (operational)

2. Re-enable payment execution:
   - Set PAYMENT_EXECUTION_ENABLED=true
   - Monitor payment success rate

3. Process backlog:
   - Identify invoices created during outage (not charged)
   - Initiate payment attempts for backlog
   - Monitor payment success rate (ensure provider stable)

4. Post-incident review:
   - Document outage duration
   - Document affected invoices
   - Update payment retry strategy if needed
```

**Note:** Payment logic not yet implemented (Phase 25B design only). Playbook is future-proofing.

---

## 6. Data Integrity & Recovery

### 6.1 Immutability Guarantees

**Immutable Data (Source-of-Truth):**
```
1. Usage Ledger (usage_records):
   - Append-only, never updated or deleted
   - Source-of-truth for all usage
   - Basis for billing snapshot recomputation

2. Billing Snapshots (after finalization):
   - Amounts, line items, period FROZEN
   - Only status transitions allowed (draft → finalized)
   - Basis for invoice recomputation

3. Invoices (after finalization):
   - Amounts, line items, period FROZEN
   - Only status transitions allowed (pending_payment → paid)
   - Basis for payment attempt verification

4. Payment Attempts (after completion):
   - Status, amounts, timestamps FROZEN
   - Append-only audit trail
   - Basis for reconciliation verification
```

**Mutable Data (State Only):**
```
- BillingSnapshot.status (draft → finalized)
- Invoice.status (state transitions)
- PaymentAttempt.status (pending → succeeded/failed)
- WebhookEvent.processingStatus (pending → processed/ignored)
```

### 6.2 Recomputing Billing Snapshots

**Use Case:**
Billing calculation bug detected, need to recompute snapshots from usage ledger.

**Recomputation Procedure:**
```
1. Disable snapshot creation:
   - Set BILLING_SNAPSHOT_CREATION_ENABLED=false
   - Prevents new incorrect snapshots

2. Identify affected snapshots:
   - Query billing_snapshots WHERE status='draft' AND created_at >= bug_start_date
   - Mark snapshots as voided (flag column or status)

3. Query usage ledger:
   - SELECT * FROM usage_records WHERE created_at >= period_start AND created_at <= period_end
   - Aggregate by (api_key_id, provider, model)

4. Recompute snapshots:
   - Apply corrected pricing rates
   - Create new snapshots (with fixed logic)
   - Verify amounts against expected values

5. Verify determinism:
   - Recompute same snapshot twice → should produce identical results
   - Compare with manual calculation

6. Re-enable snapshot creation:
   - Set BILLING_SNAPSHOT_CREATION_ENABLED=true
   - Monitor new snapshots (ensure correctness)
```

**Guarantees:**
- Usage ledger: Immutable, unchanged
- Old snapshots: Marked as voided (not deleted)
- New snapshots: Recomputed from ledger (deterministic)
- Invoices: Not created from voided snapshots

### 6.3 Re-Issuing Invoices

**Use Case:**
Invoice generation bug detected, need to re-issue invoices from snapshots.

**Re-Issue Procedure:**
```
1. Disable invoice generation:
   - Set INVOICE_GENERATION_ENABLED=false
   - Prevents new incorrect invoices

2. Identify affected invoices:
   - Query invoices WHERE status='draft' AND created_at >= bug_start_date
   - Mark invoices as voided (flag column or status)

3. Query billing snapshots:
   - SELECT * FROM billing_snapshots WHERE status='finalized' AND snapshot_id IN (affected)
   - Verify snapshot integrity (amounts correct)

4. Re-issue invoices:
   - Create new invoices from snapshots (with fixed logic)
   - Verify amounts match snapshot amounts

5. Re-enable invoice generation:
   - Set INVOICE_GENERATION_ENABLED=true
   - Monitor new invoices (ensure correctness)
```

**Guarantees:**
- Billing snapshots: Immutable, unchanged
- Old invoices: Marked as voided (not deleted)
- New invoices: Created from snapshots (deterministic)
- Payment attempts: Not created for voided invoices

### 6.4 Verifying Deterministic Replay

**Purpose:**
Verify that recomputation produces identical results (determinism guarantee).

**Replay Verification Procedure:**
```
1. Select sample snapshot:
   - Choose random finalized snapshot
   - Document snapshot_id, period, amounts

2. Query usage ledger:
   - SELECT * FROM usage_records WHERE usage_record_id IN (snapshot.usage_record_ids)
   - Extract raw usage data

3. Recompute snapshot:
   - Apply snapshot calculation logic to usage data
   - Generate new snapshot (in-memory, not persisted)

4. Compare snapshots:
   - Compare totalCostUSD (original vs recomputed)
   - Compare lineItems (original vs recomputed)
   - If identical: Determinism verified
   - If different: Determinism VIOLATED (investigate)

5. Repeat for multiple samples:
   - Test 100 random snapshots
   - Verify 100% match rate
   - If any mismatch: Determinism NOT guaranteed
```

**Guarantees:**
- Same usage data → same snapshot (deterministic)
- Recomputation produces identical results
- Billing logic is reproducible

### 6.5 Handling Partial Failures Safely

**Scenario:**
Snapshot creation starts, but fails mid-process (database error, crash, etc.).

**Safe Failure Handling:**
```
1. Transaction boundaries:
   - All snapshot creation wrapped in database transaction
   - If failure: transaction rolled back (no partial snapshot)
   - Result: Either complete snapshot or no snapshot (atomic)

2. Idempotency:
   - Snapshot creation can be retried safely
   - Same usage data → same snapshot (deterministic)
   - Retry produces identical result

3. No orphaned data:
   - No partial snapshots in database
   - No inconsistent state (either fully created or not at all)

4. Recovery:
   - Retry snapshot creation (same inputs)
   - Verify successful creation
   - No manual cleanup required
```

**Guarantees:**
- No partial snapshots (transaction atomicity)
- No data loss (usage ledger unchanged)
- Retry is safe (idempotent)

---

## 7. Operational Access Boundaries

### 7.1 Role Separation

**Roles:**
```
1. Operator (Platform Admin):
   - Can view observability metrics
   - Can activate kill switches
   - Can adjust safety limits (with approval)
   - CANNOT view user content (prompts, responses)
   - CANNOT modify usage ledger or billing snapshots

2. Support Engineer:
   - Can view user-specific metrics (execution counts, failures)
   - Can view billing snapshots (amounts only, no content)
   - CANNOT modify data (read-only access)
   - CANNOT activate kill switches (operator only)

3. User (API Key Holder):
   - Can execute AI requests
   - Can view own usage and billing
   - CANNOT view other users' data
   - CANNOT modify quotas or limits

4. Finance Admin:
   - Can view billing snapshots and invoices
   - Can issue refunds (future)
   - CANNOT view usage details or prompts
   - CANNOT activate kill switches
```

### 7.2 Read-Only vs Write Authority

**Read-Only Access (Support Engineers):**
```
Allowed:
  ✅ Query usage_records (counts, tokens, providers)
  ✅ Query billing_snapshots (amounts, status)
  ✅ Query invoices (amounts, status)
  ✅ Query payment_attempts (status, failure codes)
  ✅ View observability dashboards

Forbidden:
  ❌ UPDATE usage_records
  ❌ UPDATE billing_snapshots (except status)
  ❌ UPDATE invoices (except status)
  ❌ DELETE any records
  ❌ Activate kill switches
```

**Write Authority (Operators Only):**
```
Allowed:
  ✅ Activate/deactivate kill switches
  ✅ Adjust safety limits (with approval)
  ✅ Mark snapshots as voided (with audit log)
  ✅ Trigger snapshot recomputation (with approval)

Forbidden:
  ❌ Modify usage_records (immutable)
  ❌ Modify billing snapshot amounts (immutable)
  ❌ Modify invoice amounts (immutable)
  ❌ Delete usage records (append-only)
```

### 7.3 No "God Mode" Mutation

**Design Principle:**
No operator should have unrestricted mutation access to production data.

**Enforcement:**
```
Database access:
  - Operators: Read-only access (SELECT only)
  - Automated processes: Read-write access (via application)
  - Direct database writes: Audit logged, requires approval

Application access:
  - Operators: API-based operations (kill switches, recomputation triggers)
  - NO direct database modification via SQL
  - All mutations logged (audit trail)

Emergency access:
  - "Break glass" procedure (requires approval + justification)
  - Temporary elevated access (revoked after incident)
  - Full audit trail (who, what, when, why)
```

### 7.4 Audit Logging Requirements

**What Must Be Audited:**
```
1. Kill switch changes:
   - Who activated/deactivated
   - Which switch
   - When changed
   - Why changed (reason text)

2. Safety limit changes:
   - Who changed limit
   - Which limit (MAX_TOKENS_PER_EXECUTION, etc.)
   - Old value → new value
   - When changed
   - Why changed

3. Data modifications:
   - Snapshot voiding (who, which snapshots, when, why)
   - Invoice voiding (who, which invoices, when, why)
   - Recomputation triggers (who, which snapshots, when, why)

4. Emergency access:
   - "Break glass" activations (who, when, duration)
   - Elevated access grants (who, to whom, when, revoked when)
```

**Audit Log Schema:**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  actor VARCHAR(255) NOT NULL,  -- Who performed action
  action VARCHAR(100) NOT NULL,  -- What action (e.g., 'kill_switch_changed')
  resource VARCHAR(255) NOT NULL, -- Which resource (e.g., 'GLOBAL_EXECUTION_ENABLED')
  old_value TEXT,                -- Old value (if applicable)
  new_value TEXT,                -- New value (if applicable)
  reason TEXT,                   -- Why action performed
  incident_id VARCHAR(100),      -- Related incident ID (if applicable)
  ip_address VARCHAR(50),        -- Source IP
  user_agent TEXT                -- Source user agent
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

**Audit Log Retention:**
```
Minimum retention: 2 years (compliance)
Append-only: No updates or deletes
Access: Read-only for operators, write-only for system
```

---

## 8. Explicit Non-Goals (NOT in Phase 26A)

### 8.1 No Implementation

**NOT Delivered:**
- ❌ No code changes
- ❌ No database migrations
- ❌ No new endpoints
- ❌ No UI components
- ❌ No tests

**Rationale:** Phase 26A is design specification only.

### 8.2 No Payment Logic

**NOT Delivered:**
- ❌ Payment execution implementation
- ❌ Payment provider SDK integration
- ❌ Payment retry logic

**Rationale:** Payment logic designed in Phase 25, not yet implemented.

### 8.3 No Retry or Orchestration Logic

**NOT Delivered:**
- ❌ Automatic retry mechanisms
- ❌ Workflow orchestration (e.g., Temporal, Step Functions)
- ❌ Background job processing

**Rationale:** Operational logic deferred to Phase 26B implementation.

### 8.4 No Changes to Execution, Billing, or Snapshot Code

**NOT Delivered:**
- ❌ No modifications to ai-service
- ❌ No modifications to BillingService snapshot calculation
- ❌ No modifications to InvoiceService

**Rationale:** Phase 26A defines operational controls around existing systems, not changes to systems themselves.

---

## 9. Safe Resume Point

### 9.1 Phase 26A Status

**Status:** DESIGN COMPLETE

**Design Deliverables:**
- ✅ Kill switch design (5 switches: global, provider, billing, invoice, payment)
- ✅ Global safety limit design (5 limits: max tokens, global rate, daily spend, provider rate)
- ✅ Operational observability design (execution, billing, invoice, payment metrics)
- ✅ Incident response playbooks (5 playbooks: provider outage, cost spike, billing bug, snapshot corruption, payment outage)
- ✅ Data integrity & recovery design (recomputation, re-issue, deterministic replay)
- ✅ Operational access boundaries (role separation, read-only vs write, audit logging)

**Design Correctness:**
- All kill switches have fail-safe defaults (disable > allow)
- All safety limits enforced before execution (fail-fast)
- All observability is content-free (metadata only)
- All playbooks preserve data integrity (immutability)
- All recovery procedures are deterministic (same inputs → same outputs)
- All access is audited (append-only log)

**No Implementation:**
Phase 26A contains ZERO code, migrations, endpoints, or UI. All design only.

### 9.2 What is LOCKED

**Locked Design Elements:**
- Kill switch types and enforcement points
- Safety limit types and thresholds
- Observability metrics (content-free)
- Incident playbook structure
- Data immutability guarantees
- Audit logging requirements

**Cannot Change Without User Approval:**
- Adding execution-blocking checks
- Modifying immutability rules
- Exposing user content in observability
- Bypassing audit logging

### 9.3 Next Allowable Phase

**Phase 26B: Production Readiness Implementation (NOT AUTHORIZED)**

**Scope (if authorized):**
- Implement kill switch checks (configuration-driven)
- Implement safety limit enforcement (rate limiters, counters)
- Implement observability metrics (Prometheus, Grafana)
- Implement audit logging (database table, append-only)
- Write tests (kill switch behavior, safety limit enforcement)
- Document operational procedures (runbooks)

**Prerequisites:**
- ✅ Phase 26A (Production Readiness Design) COMPLETE

**Unlocks:**
- Safe production operation
- Emergency incident response capability
- Cost control and abuse prevention
- Operational visibility without content exposure

**NOT Authorized Yet:** Requires explicit user approval to proceed.

---

## ULTRA-BRIEF SUMMARY

• **Kill switches designed for safe emergency shutdown** with 5 centralized switches (global execution, provider-specific, billing snapshots, invoice generation, payment execution) enforcing fail-safe defaults (disable > allow), no partial execution states (checks before provider calls), and complete audit trail (who/what/when/why logged), enabling operators to disable capabilities immediately during incidents without code deployment or data loss

• **Global safety limits provide platform-wide cost protection** with 5 limit types (max tokens per execution 100k, max executions per minute 10k global, max daily spend soft $10k/hard $20k, provider-specific rate limits) enforced before execution (fail-fast), producing deterministic outcomes (same state → same decision), and clear error semantics (400 invalid request, 429 rate limit, 503 service unavailable), preventing runaway costs and infrastructure overload while preserving per-key quota enforcement

• **Operational observability exposes metadata without content** providing content-free metrics (execution counts, token usage, failure rates, provider health, billing/invoice/payment counts) via Prometheus-style metrics and Grafana dashboards, safe JSON-structured logs (INFO/WARN/ERROR/CRITICAL levels), and strict privacy guarantees (NO prompts, NO AI responses, NO PII exposed), enabling operators to monitor platform health and detect incidents while preserving user privacy

• **Incident response playbooks define deterministic recovery procedures** for 5 common failures (provider outage, cost spike, billing bug, snapshot corruption, payment outage) with each playbook specifying detection signals, immediate actions, kill switches involved, data integrity guarantees (immutability preserved), and recovery steps (recomputation from immutable source data), ensuring consistent and safe incident response while preventing data loss or corruption

• **Data integrity recovery leverages immutability for deterministic replay** with usage ledger as immutable source-of-truth enabling billing snapshot recomputation (query ledger → apply corrected logic → verify determinism), billing snapshots as immutable source enabling invoice re-issue (query snapshots → create new invoices → verify amounts), and operational access boundaries (role separation, read-only vs write authority, no god-mode mutation, append-only audit logging) preventing unauthorized data modification while enabling safe recovery procedures

---

**END OF PHASE 26A DESIGN**

**Phase 26A design is COMPLETE.**

**Next phase (Phase 26B: Production Readiness Implementation) requires explicit user authorization.**
