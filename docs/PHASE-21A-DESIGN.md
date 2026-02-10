# PHASE 21A DESIGN: Quota and Rate-Limiting Policy

**Status:** DESIGN-ONLY (No Implementation)
**Nature:** Policy Definition (api-gateway enforcement)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 20 (Authentication & Access Control)
**Prerequisite:** Phase 20B (Scope-Based Authorization) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 21A defines a quota and rate-limiting policy to prevent abuse of the AI execution endpoint without introducing billing, retries, or stateful orchestration. This is a design-only phase that establishes rules, ownership, semantics, and failure behavior.

### 1.2 Scope

**Design Scope:**
- Quota model definition (requests + tokens per time window)
- Rate limiting semantics (deterministic enforcement)
- Failure behavior (429 Too Many Requests)
- Ownership boundaries (api-gateway enforcement only)
- Observability policy (what can/cannot be logged)
- Non-goals (explicit exclusions)

**Implementation Scope:**
- NONE in this phase
- Phase 21B will implement the design

### 1.3 Core Principles

**Enforcement Principles:**
- ✅ Fail-fast (no retries)
- ✅ Deterministic (same inputs → same outcome)
- ✅ Stateless evaluation (no distributed coordination)
- ✅ Pre-execution checks (quota evaluated before AI call)
- ✅ Throw-only errors (no partial execution)

**Service Boundaries:**
- ✅ api-gateway: ONLY enforcement point
- ✅ ai-service: unchanged, no quota logic
- ✅ Callers: own retry logic and user messaging

---

## 2. Quota Model

### 2.1 Identity

**Quota Granularity:**
- Quotas apply per `apiKeyId`
- Quotas are independent across API keys
- No user-level aggregation
- No session-level aggregation

**Rationale:**
- API keys are the authenticated identity (Phase 20A)
- Simplest enforcement model
- Aligns with existing authorization model (Phase 20B)

### 2.2 Quota Types

**Two Independent Quota Types:**

**1. Request Count Quota**
- Limits number of requests per time window
- Example: 100 requests per minute
- Evaluated before execution
- Reset at window boundary

**2. Token Usage Quota**
- Limits total tokens consumed per time window
- Example: 10,000 tokens per day
- Evaluated before execution using estimated/reserved tokens
- Actual tokens recorded after execution (Phase 13)
- Reset at window boundary

**Independence:**
- Both quotas are evaluated independently
- Request count quota does NOT depend on token quota
- Token quota does NOT depend on request count quota
- Both must pass for execution to proceed

### 2.3 Quota Configuration

**Static Configuration Model:**
- Quotas defined per API key in static configuration
- No database required (Phase 21A/21B)
- No dynamic updates (Phase 21A/21B)
- Future: database-backed quotas (Phase 21C+)

**Example Configuration Structure:**
```typescript
// Design concept only (NOT implementation)
interface ApiKeyQuota {
  apiKeyId: string;
  requestsPerMinute: number;
  tokensPerDay: number;
}
```

### 2.4 Time Windows

**Fixed Time Windows:**
- Request count: 1-minute fixed window
- Token usage: 1-day fixed window
- Window boundaries aligned to clock time
  - Minute window: HH:MM:00 to HH:MM:59
  - Day window: 00:00:00 to 23:59:59 UTC
- No sliding windows required

**Window Reset:**
- Window resets at boundary
- Previous window state discarded
- No carryover or accumulation

**Rationale:**
- Simplest deterministic model
- No distributed synchronization
- Acceptable burst behavior for MVP

### 2.5 Token Estimation

**Pre-Execution Estimation:**
- Token quota checked BEFORE execution
- Estimation strategy (choose one in Phase 21B):
  - Conservative fixed estimate (e.g., 1000 tokens per request)
  - Prompt-length-based estimate (e.g., prompt.length * multiplier)
  - Maximum possible tokens for model
- Actual tokens recorded AFTER execution (Phase 13 unchanged)

**Estimation vs Actual:**
- Estimation used for quota check
- Actual tokens used for billing (future)
- No refund mechanism for overestimation
- No clawback mechanism for underestimation

**Rationale:**
- Cannot know actual tokens until execution completes
- Pre-execution check prevents quota violations
- Overestimation provides safety margin
- Simplicity preferred over accuracy for Phase 21A/21B

---

## 3. Rate Limiting Semantics

### 3.1 Evaluation Order

**Quota Check Sequence:**
```
1. Authentication (Phase 20A)
   ↓ PASS
2. Authorization (Phase 20B)
   ↓ PASS
3. Request Count Quota Check (Phase 21B)
   ↓ PASS
4. Token Usage Quota Check (Phase 21B)
   ↓ PASS
5. Execution (Phase 12-15)
```

**Short-Circuit Evaluation:**
- First failure throws immediately
- Subsequent checks NOT evaluated
- No partial execution

### 3.2 Deterministic Enforcement

**Determinism Guarantees:**
- Same API key + same time window → same quota state
- Same quota state + same request → same decision
- No probabilistic failures
- No race conditions (single-process model acceptable)

**Non-Determinism Boundary:**
- Window transitions are deterministic (clock-based)
- Request arrival order within window is non-deterministic
- Last request before quota exhaustion is deterministic

### 3.3 State Management

**In-Memory State (Phase 21B):**
- Quota state stored in-memory (api-gateway process)
- State resets on api-gateway restart (acceptable for Phase 21B)
- No persistence required
- No distributed state

**Future: Persistent State (Phase 21C+):**
- Redis or similar for distributed quota tracking
- State survives api-gateway restarts
- Multi-instance coordination
- NOT in scope for Phase 21A/21B

---

## 4. Failure Behavior

### 4.1 Quota Exceeded Error

**HTTP Status Code:**
- 429 Too Many Requests

**Error Response Structure:**
```json
{
  "statusCode": 429,
  "message": "Quota exceeded",
  "error": "Too Many Requests"
}
```

**Error Characteristics:**
- ✅ Generic message (no quota details leaked)
- ✅ Deterministic (same quota state → same error)
- ✅ No sensitive data (no prompt, no apiKeyId, no token counts)
- ✅ No retry hints (no Retry-After header in Phase 21B)
- ✅ Fail-fast (thrown immediately)

### 4.2 Error Semantics Taxonomy

**Complete Error Code Map:**

**401 Unauthorized (Phase 20A):**
- Missing Authorization header
- Malformed Authorization header
- Invalid API key

**403 Forbidden (Phase 20B):**
- Valid API key
- Missing required scope (ai:execute)

**429 Too Many Requests (Phase 21B):**
- Valid API key
- Valid scope
- Request count quota exceeded
- OR token usage quota exceeded

**400/500/503 (Phase 15A):**
- Execution errors (after quota check passes)

**Clear Distinction:**
- 401 = authentication failure
- 403 = authorization failure (insufficient permissions)
- 429 = rate limiting failure (quota exceeded)
- 4xx/5xx = execution failure (quota not involved)

### 4.3 No Partial Execution

**Atomicity Guarantees:**
- Quota check → FAIL → no execution
- Quota check → PASS → execution proceeds
- No state where:
  - Quota consumed but execution failed
  - Execution succeeded but quota not consumed

**Token Recording:**
- Tokens recorded ONLY on successful execution (Phase 13)
- Tokens NOT recorded on quota failure (429)
- Tokens NOT recorded on execution failure (4xx/5xx)

### 4.4 Throw-Only Semantics (Maintained)

**Phase 21B Maintains Deterministic Behavior:**
- ✅ Quota failures throw immediately (no retries)
- ✅ No error payloads in success responses
- ✅ No partial success states
- ✅ Same request → same result (within same window)

---

## 5. Ownership & Boundaries

### 5.1 api-gateway Ownership

**api-gateway OWNS:**
- Quota evaluation (request count + token usage)
- Rate limiting enforcement (429 errors)
- Quota state management (in-memory for Phase 21B)
- Quota configuration loading (static config)
- Quota reset logic (window boundaries)

**api-gateway RESPONSIBILITIES:**
- Check quotas BEFORE forwarding to ai-service
- Throw 429 if quota exceeded
- Record quota usage (request count, estimated tokens)
- Reset quota state at window boundaries

### 5.2 ai-service Ownership

**ai-service OWNS:**
- NOTHING related to quotas

**ai-service DOES NOT:**
- ❌ Check quotas
- ❌ Enforce rate limits
- ❌ Track quota state
- ❌ Know about quota failures
- ❌ Receive quota information in requests

**ai-service Behavior (Unchanged):**
- ✅ Trusts userId from api-gateway (Phase 20A)
- ✅ Executes requests normally
- ✅ Records tokens on success (Phase 13)
- ✅ Stateless execution (Phase 12B)

### 5.3 Caller Ownership

**Callers OWN:**
- Retry logic (if desired)
- Backoff behavior (if desired)
- User messaging ("quota exceeded, try later")
- Request throttling (to stay under quota)

**Callers RECEIVE:**
- 429 Too Many Requests (quota exceeded)
- No retry hints (Phase 21B)
- No quota details (security/privacy)

**Callers DO NOT RECEIVE:**
- Remaining quota
- Quota reset time
- Quota limits
- (Future: Phase 21C+ may add quota headers)

### 5.4 Service Boundary Diagram

```
┌─────────────────────────────────────────────┐
│ Client (Frontend)                           │
│ - Sends request with API key                │
│ - Handles 429 errors                        │
│ - Owns retry logic                          │
└─────────────┬───────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│ api-gateway                                 │
│ 1. Authentication (Phase 20A) ✓             │
│ 2. Authorization (Phase 20B) ✓              │
│ 3. Request Count Quota (Phase 21B) ← NEW   │
│ 4. Token Usage Quota (Phase 21B) ← NEW     │
│ 5. Forward to ai-service                    │
└─────────────┬───────────────────────────────┘
              ↓ (if all checks pass)
┌─────────────────────────────────────────────┐
│ ai-service                                  │
│ - Trusts verified identity                  │
│ - Executes AI request                       │
│ - Records tokens (Phase 13)                 │
│ - NO quota logic                            │
└─────────────────────────────────────────────┘
```

---

## 6. Observability Policy

### 6.1 Allowed Observations

**Quota Events (Allowed):**
- Event: quota_exceeded
- Fields:
  - apiKeyId: string (identity only)
  - quotaType: 'request' | 'token'
  - timestamp: ISO 8601
  - endpoint: string (e.g., '/api/ai/execute')

**Quota State (Allowed):**
- Current usage count (requests or tokens)
- Quota limit (requests or tokens)
- Window start time
- Window end time

**HTTP Logs (Allowed):**
- Status code: 429
- Endpoint: /api/ai/execute
- Timestamp
- API key ID (ONLY ID, not key value)

### 6.2 Forbidden Observations

**MUST NOT be logged:**
- ❌ Prompt content
- ❌ AI output
- ❌ User text
- ❌ API key values
- ❌ userId (unless explicitly consented)
- ❌ Session content
- ❌ Conversation history

**Privacy Policy Alignment:**
- Phase 15B privacy policy maintained
- No prompt logging (Phase 15B)
- No response logging (Phase 15B)
- No credential logging (Phase 20A)

### 6.3 Observability Boundaries

**What can be measured:**
- ✅ Quota hit rate (% of requests hitting quota)
- ✅ Average quota utilization
- ✅ Quota exhaustion frequency
- ✅ Time to quota reset

**What cannot be measured:**
- ❌ User intent (no prompt analysis)
- ❌ Output quality (no response analysis)
- ❌ User behavior patterns (no session tracking)

---

## 7. Non-Goals (MANDATORY)

### 7.1 Explicitly Excluded from Phase 21A/21B

**❌ Billing & Pricing:**
- No cost calculation
- No payment processing
- No invoicing
- No credit/debit tracking
- No billing tiers

**❌ Tier Management:**
- No free/pro/enterprise tiers
- No tier upgrades
- No tier-based quota adjustments
- No tier configuration

**❌ Database Storage:**
- No quota persistence (Phase 21B uses in-memory)
- No quota history
- No usage analytics storage
- (Future: Phase 21C+ may add Redis/DB)

**❌ Distributed Rate Limiting:**
- No multi-instance coordination (Phase 21B is single-instance)
- No Redis-based rate limiting
- No distributed locks
- (Future: Phase 21C+ for multi-instance)

**❌ Dynamic Quota Updates:**
- No runtime quota changes
- No admin API for quota updates
- No per-user quota overrides
- (Future: Phase 21C+ for admin controls)

**❌ ai-service Changes:**
- No quota logic in ai-service
- No token reservation in ai-service
- No ai-service API changes

**❌ Retry Logic:**
- No automatic retries
- No backoff strategies
- No Retry-After headers (Phase 21B)
- (Future: Phase 21C+ may add Retry-After)

**❌ User-Facing Quota Details:**
- No remaining quota in response
- No quota reset time in response
- No quota limit disclosure
- (Future: Phase 21C+ may add quota headers)

### 7.2 Future Enhancements (NOT NOW)

**Phase 21C+ (Future):**
- Redis-based distributed quota tracking
- Database-backed quota configuration
- Retry-After header in 429 response
- Quota headers (X-RateLimit-Remaining, X-RateLimit-Reset)
- Admin API for quota management
- Billing integration
- Tier-based quotas
- Usage dashboards

---

## 8. Safe Resume Point

### 8.1 What MUST Remain Unchanged in Phase 21B

**Locked Contracts (Phases 12-20):**
- ✅ AIExecutionRequest unchanged (no quota fields)
- ✅ AIExecutionResult unchanged (no quota fields)
- ✅ ai-service API unchanged
- ✅ ai-service behavior unchanged (trusting, stateless)
- ✅ Token recording logic unchanged (Phase 13)

**Locked Error Semantics (Phase 15A):**
- ✅ Throw-only errors
- ✅ No partial execution
- ✅ No error payloads in success responses
- ✅ Deterministic outcomes

**Locked Privacy Policy (Phase 15B):**
- ✅ No prompt logging
- ✅ No response logging
- ✅ No credential logging

**Locked Authentication (Phase 20A):**
- ✅ API key authentication unchanged
- ✅ Identity resolution unchanged
- ✅ 401 error semantics unchanged

**Locked Authorization (Phase 20B):**
- ✅ Scope validation unchanged
- ✅ ai:execute scope required
- ✅ 403 error semantics unchanged

### 8.2 What CAN Be Extended Later

**Phase 21C+ Extensions (Allowed):**
- Persistent quota state (Redis/DB)
- Distributed quota tracking (multi-instance)
- Dynamic quota configuration (admin API)
- Retry-After header in 429 response
- Quota headers (X-RateLimit-*)
- Billing integration (separate service)
- Tier-based quotas (free/pro/enterprise)
- Usage analytics (separate service)

**Extension Principles:**
- Extensions MUST NOT break Phase 21B contracts
- Extensions MUST NOT change error semantics
- Extensions MUST NOT add quota logic to ai-service
- Extensions MUST maintain determinism guarantees

### 8.3 Alignment with Phases 12-20

**Phase 12B (Service Boundaries):**
- ✅ api-gateway → ai-service boundary preserved
- ✅ Quota enforcement at api-gateway only
- ✅ ai-service remains trusting

**Phase 13 (Token Recording):**
- ✅ Token recording unchanged
- ✅ Tokens recorded on success only
- ✅ No token recording on quota failure (429)

**Phase 15A (Throw-Only Errors):**
- ✅ 429 errors throw immediately
- ✅ No partial execution
- ✅ Deterministic error behavior

**Phase 15B (Privacy Policy):**
- ✅ No prompt logging
- ✅ No response logging
- ✅ Quota logs do not expose sensitive data

**Phase 20A (Authentication):**
- ✅ Quota applied per apiKeyId
- ✅ Identity resolution unchanged
- ✅ Authentication before quota check

**Phase 20B (Authorization):**
- ✅ Scope check before quota check
- ✅ Quota check after authorization passes
- ✅ Clear error distinction (403 vs 429)

---

## 9. Design Decisions & Rationale

### 9.1 Fixed Windows vs Sliding Windows

**Decision:** Fixed time windows (1-minute, 1-day)

**Rationale:**
- Simplest deterministic model
- No distributed state required
- Acceptable burst behavior for MVP
- Window reset is clock-based (deterministic)

**Trade-offs:**
- Allows burst at window boundary (e.g., 200 requests in 2 seconds across window transition)
- Acceptable for Phase 21B (abuse prevention, not hard limit)
- Future: sliding windows in Phase 21C+ if needed

### 9.2 Pre-Execution Token Estimation

**Decision:** Estimate tokens before execution for quota check

**Rationale:**
- Cannot know actual tokens until execution completes
- Pre-execution check prevents quota violations
- Conservative estimates provide safety margin

**Trade-offs:**
- Overestimation wastes quota headroom
- Underestimation risks quota violations
- Acceptable for Phase 21B (safety over accuracy)

### 9.3 No Retry-After Header

**Decision:** No Retry-After header in Phase 21B

**Rationale:**
- Simplicity (no clock synchronization required)
- Callers can implement own backoff
- Fixed windows make retry time predictable

**Trade-offs:**
- Clients must guess retry time
- Acceptable for Phase 21B MVP
- Future: add Retry-After in Phase 21C+

### 9.4 In-Memory State (Phase 21B)

**Decision:** In-memory quota state in Phase 21B

**Rationale:**
- Simplest implementation
- Single-instance deployment acceptable for MVP
- No external dependencies (Redis, DB)

**Trade-offs:**
- State lost on api-gateway restart (acceptable for Phase 21B)
- Cannot scale horizontally (acceptable for Phase 21B)
- Future: Redis-based state in Phase 21C+ for multi-instance

### 9.5 Static Configuration (Phase 21B)

**Decision:** Static quota configuration in Phase 21B

**Rationale:**
- No database required
- No admin API required
- Simple deployment

**Trade-offs:**
- Cannot change quotas without code change
- No per-user customization
- Acceptable for Phase 21B MVP
- Future: database-backed config in Phase 21C+

---

## 10. Phase 21B Implementation Guidance (Preview)

### 10.1 Implementation Checklist (NOT TO BE EXECUTED IN PHASE 21A)

**Files to Create (Phase 21B):**
- `services/api-gateway/src/quota/quota.guard.ts`
- `services/api-gateway/src/quota/quota.service.ts`
- `services/api-gateway/src/quota/quota.config.ts`
- `services/api-gateway/src/quota/quota.module.ts`

**Files to Modify (Phase 21B):**
- `services/api-gateway/src/ai/ai-execution.controller.ts` (add QuotaGuard)
- `services/api-gateway/src/auth/api-key.config.ts` (add quota limits)

**Files NOT to Modify (Phase 21B):**
- ✅ All ai-service files
- ✅ AIExecutionRequest/AIExecutionResult interfaces
- ✅ Token recording logic (Phase 13)

### 10.2 Guard Execution Order (Phase 21B)

```
1. ApiKeyAuthGuard (Phase 20A)
   ↓ PASS → identity attached
2. AuthorizationGuard (Phase 20B)
   ↓ PASS → scope validated
3. QuotaGuard (Phase 21B) ← NEW
   ↓ PASS → quota checked
4. Controller executes
   ↓
5. ai-service executes
   ↓
6. Token recording (Phase 13)
```

### 10.3 Testing Requirements (Phase 21B)

**Unit Tests Required:**
- QuotaGuard: request count quota enforcement
- QuotaGuard: token usage quota enforcement
- QuotaGuard: window reset behavior
- QuotaGuard: deterministic outcomes
- QuotaService: quota state management
- QuotaService: window boundary logic

**Integration Tests Required:**
- 429 error on request count quota exceeded
- 429 error on token usage quota exceeded
- Successful execution when quota available
- Quota reset at window boundary
- No token recording on 429 error

**Test Coverage Target:**
- All quota logic paths tested
- All error paths tested (429)
- All success paths tested
- Backward compatibility with Phases 20A/20B verified

---

## ULTRA-BRIEF SUMMARY

• **Quota Model:** Two independent quotas per apiKeyId (requests per minute + tokens per day) with fixed time windows, pre-execution token estimation, and in-memory state (Phase 21B)

• **Enforcement Location:** api-gateway ONLY enforcement point with guard chain (auth → authz → quota) before forwarding to ai-service, no quota logic in ai-service

• **Failure Semantics:** 429 Too Many Requests thrown immediately on quota exceeded with fail-fast deterministic behavior, no partial execution, no token recording on failure

• **ai-service Unchanged:** ai-service remains completely unchanged with no quota logic, trusts verified identity from api-gateway, stateless execution preserved (Phase 12B-20B contracts maintained)

---

**END OF PHASE 21A DESIGN**
