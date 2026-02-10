# PHASE 20 DESIGN: Authentication & Access Control

**Status:** DESIGN ONLY (No Implementation Authorized)
**Nature:** Authentication and Authorization Architecture
**Version:** v1.0.0-design
**Date:** 2026-02-06
**Parent Phase:** Phase 12-19 (AI Execution Pipeline)

---

## 1. Overview

### 1.1 Purpose

Phase 20 defines the authentication and access control model for the AI Sandbox Platform's public AI execution API. This design establishes WHO may call the service, HOW they authenticate, WHERE enforcement occurs, and WHAT guarantees the system provides.

This is a DESIGN-ONLY document. No implementation is authorized until this design is explicitly approved.

### 1.2 Current State (Locked)

**Implemented (Phases 12-19):**
- AI execution pipeline fully operational
- Public endpoint: POST /api/ai/execute (api-gateway)
- Six production-ready adapters (stub, anthropic, openai, groq, xai, deepseek)
- Throw-only error semantics
- Token accounting on success only
- Stateless execution
- Observability with privacy guarantees (no content logging)
- Deterministic execution behavior

**Missing:**
- Authentication (no caller verification)
- Authorization (no access control)
- Identity propagation (userId accepted but not verified)
- API key management
- Rate limiting or quotas (deferred to future phase)

### 1.3 Design Scope

**Phase 20 defines:**
- Authentication mechanisms (HOW callers prove identity)
- Authorization boundaries (WHAT is protected)
- Responsibility ownership (WHO enforces WHAT)
- Identity propagation (HOW identity flows between services)
- Failure semantics (WHAT happens on auth failure)
- Security invariants (WHAT must never change)

**Phase 20 does NOT define:**
- Billing integration (future phase)
- Usage quotas (future phase)
- Rate limiting (future phase)
- User management UI (future phase)
- Provider-specific access control (future phase)

---

## 2. Authentication Model

### 2.1 Supported Authentication Mechanisms

**Primary Mechanism: API Keys**

API keys serve as the principal authentication credential for machine-to-machine access to the AI execution API.

**Characteristics:**
- Long-lived bearer tokens
- Scoped to a single user account
- Opaque identifier (no embedded metadata)
- Revocable by user or system
- Single API key per user (initially)

**Authentication Flow:**
```
Client Request
  ↓
api-gateway: Extract API key from Authorization header
  ↓
api-gateway: Validate API key (existence, revocation status)
  ↓
api-gateway: Resolve API key → userId
  ↓
api-gateway: Inject verified userId into service request
  ↓
ai-service: Trust userId from api-gateway
```

**Secondary Mechanism: None (Phase 20)**

Phase 20 supports ONLY API key authentication. Future phases may add:
- JWT tokens (deferred)
- OAuth2 flows (deferred)
- Service-to-service tokens (deferred)

### 2.2 Caller Identity

**Identity Definition:**

A **caller identity** consists of:
- `userId`: Unique identifier for the authenticated user
- `apiKeyId`: Identifier for the specific API key used (for audit/revocation)

**Identity Resolution:**
- api-gateway resolves API key → userId before forwarding request
- ai-service receives verified userId (no authentication logic)
- userId is treated as trusted once it reaches ai-service

**Identity Lifecycle:**
- Identity resolved per-request (stateless)
- No session management
- No identity caching (Phase 20)
- No identity refresh tokens

### 2.3 Machine vs User Identity

**Phase 20 treats all identities as user identities:**
- API keys belong to user accounts
- No distinction between human users and service accounts
- No separate machine identity namespace
- No service-to-service authentication

**Future Consideration:**
- Machine identities may be added in future phases
- Service accounts may be introduced for inter-service calls
- Phase 20 establishes no constraints preventing this

### 2.4 Unauthenticated Access

**Policy: No Unauthenticated Access**

All requests to POST /api/ai/execute MUST include valid authentication.

**Consequences:**
- Requests without Authorization header → 401 Unauthorized
- Requests with invalid API key → 401 Unauthorized
- Requests with revoked API key → 401 Unauthorized
- No anonymous execution
- No public stub execution without API key

**Exception: Health Check Endpoints**

Health check and status endpoints (if they exist) MAY remain unauthenticated. These are NOT part of Phase 20 scope.

### 2.5 Explicit Non-Support

**Phase 20 does NOT support:**
- Password-based authentication (no login flow)
- Multi-factor authentication (MFA)
- OAuth2 / OpenID Connect
- SAML
- JWT token validation
- Session cookies
- Refresh tokens
- Credential rotation flows
- Password reset flows
- Account recovery flows

---

## 3. Authorization Boundaries

### 3.1 What Authentication Protects

**Protected Resource:**
- POST /api/ai/execute endpoint (all requests)

**Authorization Policy:**
- Authenticated users MAY execute AI requests
- No per-provider authorization (Phase 20)
- No per-model authorization (Phase 20)
- No usage-based authorization (Phase 20)

**Authorization Check:**
```
IF request has valid API key
  AND API key resolves to valid userId
  AND API key is not revoked
THEN allow execution
ELSE reject with 401 Unauthorized
```

### 3.2 What Remains Public

**Phase 20 makes NO endpoints publicly accessible (without authentication).**

Exception: Health checks and infrastructure endpoints (out of scope for Phase 20).

### 3.3 Per-Request vs Per-Session Authorization

**Policy: Per-Request Authorization**

- Authorization performed on EVERY request
- No session state maintained
- No authorization caching
- No session tokens issued

**Rationale:**
- Maintains stateless execution semantics (locked from Phase 12B)
- Enables immediate API key revocation
- Simplifies failure modes
- Aligns with existing architecture

### 3.4 Explicit Non-Authorization

**Phase 20 does NOT authorize:**
- Provider access (all authenticated users can use any provider)
- Model selection (no model-level access control)
- Token consumption (no quota enforcement)
- Request rate (no rate limiting)
- Cost thresholds (no billing integration)
- Feature flags (no A/B testing)
- Tenant isolation (no multi-tenancy)

---

## 4. Responsibility Ownership

### 4.1 api-gateway Responsibilities

**api-gateway OWNS:**

1. **Authentication Enforcement:**
   - Extract API key from Authorization header
   - Validate API key existence
   - Check API key revocation status
   - Resolve API key → userId

2. **Authorization Enforcement:**
   - Verify authenticated user has access to endpoint
   - Reject unauthenticated requests (401)
   - Reject unauthorized requests (403, if applicable)

3. **Identity Injection:**
   - Replace untrusted userId in request with verified userId
   - Inject apiKeyId for audit purposes (metadata)
   - Forward verified request to ai-service

4. **Error Handling:**
   - Return 401 Unauthorized for authentication failures
   - Return 403 Forbidden for authorization failures (if applicable)
   - Propagate ai-service errors unchanged

**api-gateway does NOT:**
- Perform any AI execution logic
- Make authorization decisions based on token usage, quotas, or billing
- Cache authentication results (Phase 20)
- Manage API keys (storage, generation, revocation)
- Log authentication credentials (keys, tokens)

### 4.2 ai-service Responsibilities

**ai-service OWNS:**

1. **Trust Verification:**
   - Trust userId received from api-gateway
   - Do NOT re-authenticate
   - Do NOT validate API keys
   - Do NOT perform authorization checks

2. **Execution:**
   - Execute AI requests with verified userId
   - Record tokens against verified userId
   - Log observability data with userId (no content)

3. **Error Handling:**
   - Throw on execution failures (locked from Phase 15A)
   - Do NOT throw authentication/authorization errors
   - Propagate exceptions to api-gateway unchanged

**ai-service does NOT:**
- Perform authentication
- Perform authorization
- Validate API keys
- Resolve userId
- Make access control decisions
- Log authentication credentials

### 4.3 Caller Responsibilities

**Callers MUST:**

1. **Provide Valid API Key:**
   - Include API key in Authorization header
   - Use format: `Authorization: Bearer <api-key>`
   - Ensure API key is not expired or revoked

2. **Handle Authentication Errors:**
   - Expect 401 Unauthorized for invalid keys
   - Do NOT retry authentication failures automatically
   - Obtain new API key if revoked

3. **Respect Error Responses:**
   - Do NOT retry 401/403 errors
   - Handle other errors according to existing semantics (locked from Phase 15A)

**Callers do NOT:**
- Include passwords or credentials (not supported)
- Manage API key lifecycle via execution endpoint
- Expect session state or cookies

### 4.4 Explicit "NOT Owned by Any Service"

**The following are OUT OF SCOPE for Phase 20:**

1. **API Key Management:**
   - API key generation (deferred to future phase)
   - API key storage (deferred to future phase)
   - API key revocation UI (deferred to future phase)
   - API key rotation (deferred to future phase)

2. **User Management:**
   - User registration (deferred)
   - User profile management (deferred)
   - Account settings (deferred)

3. **Billing Integration:**
   - Usage quotas (deferred)
   - Cost limits (deferred)
   - Payment method validation (deferred)

4. **Rate Limiting:**
   - Request rate limits (deferred)
   - Concurrency limits (deferred)
   - Provider-specific limits (deferred)

---

## 5. Identity Propagation

### 5.1 Gateway → Service Flow

**Propagation Model:**

```
1. Client Request:
   POST /api/ai/execute
   Authorization: Bearer <api-key>
   Body: {
     "sessionId": "...",
     "conversationId": "...",
     "userId": "untrusted-user-123",  // IGNORED
     "prompt": "..."
   }

2. api-gateway Authentication:
   - Extract api-key from header
   - Validate api-key
   - Resolve api-key → verified-userId
   - Resolve api-key → apiKeyId

3. api-gateway → ai-service Request:
   POST /ai/execute (internal)
   Body: {
     "sessionId": "...",
     "conversationId": "...",
     "userId": "verified-userId",  // REPLACED with verified identity
     "prompt": "...",
     "metadata": {
       "apiKeyId": "key-abc123"  // INJECTED for audit
     }
   }

4. ai-service Execution:
   - Trust userId (no validation)
   - Execute request
   - Record tokens against userId
   - Log observability data (metadata only)
```

**Key Characteristics:**
- api-gateway REPLACES untrusted userId with verified userId
- ai-service TRUSTS userId from api-gateway
- apiKeyId propagated via metadata (for audit/revocation)
- No other authentication data propagated

### 5.2 Metadata Propagated

**Verified Identity Metadata:**
- `userId` (string): Verified user identifier (REQUIRED)
- `apiKeyId` (string): API key identifier (OPTIONAL, via metadata)

**NOT Propagated:**
- API key value (credential must never reach ai-service)
- Authentication timestamp
- IP address (privacy policy)
- User agent (privacy policy)
- Session cookies
- JWT claims

### 5.3 Contract Implications

**AIExecutionRequest (LOCKED from Phase 12B):**
```typescript
export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;  // <-- Verified by api-gateway before forwarding
  prompt: string;
  metadata?: Record<string, unknown>;  // <-- apiKeyId injected here
}
```

**No Contract Changes Required:**
- AIExecutionRequest already includes userId
- metadata field already supports arbitrary data
- No new fields needed
- Contract remains locked

**Semantic Change:**
- Previously: userId accepted but not verified
- Phase 20: userId verified and replaced by api-gateway
- ai-service behavior unchanged (always trusted userId)

---

## 6. Failure Semantics

### 6.1 Authentication Failures

**Authentication Failure Categories:**

1. **Missing API Key:**
   - Request lacks Authorization header
   - Error: 401 Unauthorized
   - Message: "Missing authentication credentials"

2. **Invalid API Key:**
   - API key not found in system
   - API key malformed (wrong format)
   - Error: 401 Unauthorized
   - Message: "Invalid API key"

3. **Revoked API Key:**
   - API key exists but has been revoked
   - Error: 401 Unauthorized
   - Message: "API key has been revoked"

4. **Expired API Key (Future):**
   - API key exists but has expired
   - Error: 401 Unauthorized
   - Message: "API key has expired"
   - Note: Phase 20 does NOT implement expiration

**Characteristics:**
- All authentication failures return 401 Unauthorized
- No distinction between "key not found" and "key revoked" (security)
- No retry suggested (authentication failures are not transient)
- No detailed error information (prevents enumeration)

### 6.2 Authorization Failures

**Authorization Failure Categories:**

1. **Forbidden Resource (Future):**
   - Authenticated user lacks permission
   - Error: 403 Forbidden
   - Message: "Access denied"
   - Note: Phase 20 does NOT implement fine-grained authorization

**Phase 20 Behavior:**
- Authentication success → Authorization granted (no separate check)
- All authenticated users have full access
- 403 Forbidden NOT returned in Phase 20

### 6.3 Error Types (No Payloads)

**Alignment with Phase 15A (Throw-Only Semantics):**

- Authentication/authorization failures throw exceptions
- No error payloads in success responses
- No partial success states
- HTTP status code indicates failure type

**Error Response Format:**
```json
{
  "statusCode": 401,
  "message": "Invalid API key",
  "error": "Unauthorized"
}
```

**Characteristics:**
- Standard NestJS exception format
- No additional error metadata
- No stack traces in production
- Deterministic error responses

### 6.4 Deterministic Behavior Guarantees

**Locked Invariants from Phase 15A:**

1. **Same authentication state + same request → same result**
   - Valid key always succeeds authentication
   - Invalid key always fails authentication
   - No probabilistic failures

2. **No Retries Introduced:**
   - Authentication does NOT add retry logic
   - 401/403 errors do NOT trigger automatic retries
   - Maintains deterministic execution (locked)

3. **No Fallbacks:**
   - Authentication does NOT fall back to anonymous access
   - Invalid key does NOT fall back to stub provider
   - Maintains fail-fast semantics (locked)

4. **Stateless:**
   - No session state affects authentication
   - No caching affects authentication (Phase 20)
   - Each request authenticated independently

---

## 7. Security Invariants (LOCKED)

### 7.1 Privacy Policy (Phase 15B - LOCKED)

**Phase 20 MUST maintain:**

1. **No Prompt Logging:**
   - api-gateway does NOT log prompt content
   - Authentication layer does NOT log prompt content
   - Authorization layer does NOT log prompt content

2. **No Response Logging:**
   - api-gateway does NOT log AI response content
   - Authentication layer does NOT log AI response content

3. **No Content-Derived Metadata:**
   - api-gateway does NOT extract metadata from prompts
   - Authentication layer does NOT analyze prompt content
   - Authorization layer does NOT inspect response content

**Phase 20 guarantees maintained:**
- Authentication operates on headers and metadata only
- Authorization operates on identity and resource only
- No content inspection for security decisions

### 7.2 Credential Logging Policy

**API Key Logging Restrictions:**

1. **NEVER Log:**
   - Full API key value (credential)
   - Partial API key value (even last 4 characters)
   - Hashed API key value

2. **MAY Log:**
   - apiKeyId (opaque identifier, not the credential)
   - userId (resolved identity)
   - Authentication success/failure (boolean)
   - Timestamp of authentication attempt

3. **Observability Allowed:**
   - Authentication failure count (aggregated)
   - Authentication latency (aggregated)
   - API key usage count by keyId (not by key value)

**Rationale:**
- Prevents credential leakage via logs
- Enables security monitoring without exposing secrets
- Aligns with industry best practices

### 7.3 Execution Behavior (LOCKED)

**Phase 20 MUST NOT change:**

1. **AIAdapter Interface:**
   - No authentication logic in adapters
   - Adapters remain stateless
   - execute() signature unchanged

2. **Token Recording:**
   - Token recording still on success only
   - Authentication does NOT affect token accounting
   - Token recording logic unchanged

3. **Error Handling:**
   - Throw-only semantics maintained
   - No try/catch added to execution path
   - Exceptions propagate unchanged (except auth exceptions)

4. **Observability:**
   - Observability logging unchanged
   - userId already logged (now verified)
   - No new observability for authentication (Phase 20)

### 7.4 No Retries Introduced

**Phase 20 MUST NOT add retry logic:**

- Authentication failures do NOT trigger retries
- Authorization failures do NOT trigger retries
- Maintains deterministic execution (locked from Phase 15A)
- Callers responsible for retry decisions

### 7.5 No Billing Coupling

**Phase 20 MUST NOT integrate billing:**

- Authentication does NOT check billing status
- Authentication does NOT check account balance
- Authentication does NOT validate payment methods
- Authorization does NOT enforce usage quotas
- Authorization does NOT enforce cost limits

**Rationale:**
- Billing is a separate concern (future phase)
- Authentication concerns: identity verification only
- Authorization concerns: access control only
- Quota enforcement deferred to future phase

---

## 8. Explicit Non-Goals

### 8.1 Not Implemented in Phase 20

**User Management:**
- ❌ User registration flow
- ❌ User profile management
- ❌ Password management
- ❌ Email verification
- ❌ Account recovery
- ❌ User settings UI

**API Key Management:**
- ❌ API key generation endpoint
- ❌ API key revocation endpoint
- ❌ API key listing endpoint
- ❌ API key rotation mechanism
- ❌ API key expiration policy
- ❌ API key naming/labeling

**Advanced Authentication:**
- ❌ JWT token validation
- ❌ OAuth2 flows
- ❌ SAML integration
- ❌ Multi-factor authentication (MFA)
- ❌ Refresh tokens
- ❌ Session management
- ❌ Single sign-on (SSO)

**Fine-Grained Authorization:**
- ❌ Role-based access control (RBAC)
- ❌ Provider-specific access control
- ❌ Model-specific access control
- ❌ Feature flags per user
- ❌ Tenant isolation
- ❌ Resource-level permissions

**Billing Integration:**
- ❌ Usage quotas enforcement
- ❌ Rate limiting
- ❌ Cost limits
- ❌ Payment validation
- ❌ Subscription tiers
- ❌ Metering integration

**Security Features:**
- ❌ IP whitelisting
- ❌ CORS configuration
- ❌ Request signing
- ❌ mTLS
- ❌ API key rotation policies
- ❌ Anomaly detection
- ❌ Brute force protection

**Observability:**
- ❌ Authentication metrics (Phase 20)
- ❌ Authorization audit logs (Phase 20)
- ❌ Security dashboards
- ❌ Alerting on auth failures

### 8.2 Deferred to Future Phases

**Phase 21 (Potential): API Key Management**
- API key generation, listing, revocation
- API key metadata (name, created date)
- API key usage tracking

**Phase 22 (Potential): Usage Quotas**
- Token quotas per user
- Rate limiting
- Concurrency limits
- Cost limits

**Phase 23 (Potential): Advanced Authorization**
- Role-based access control
- Provider-specific permissions
- Model-specific permissions
- Tenant isolation

**Phase 24 (Potential): Security Enhancements**
- IP whitelisting
- Request signing
- mTLS
- Anomaly detection

---

## 9. Integration Points (With Locked Phases)

### 9.1 Phase 12B (AIAdapter Interface) - LOCKED

**No Changes Required:**
- AIAdapter interface remains unchanged
- Adapters do NOT gain authentication logic
- Adapters remain stateless
- execute() signature unchanged

**Integration:**
- Authentication occurs BEFORE adapter selection
- Adapters receive verified userId (as before)
- Token recording uses verified userId (as before)

### 9.2 Phase 13 (Token Recording) - LOCKED

**No Changes Required:**
- Token recording logic unchanged
- Tokens recorded against userId (now verified)
- Token recording still on success only

**Integration:**
- Authentication ensures userId is verified before recording
- Invalid authentication prevents token recording (request fails before execution)
- Token accounting accuracy improved (userId now trustworthy)

### 9.3 Phase 15A (Throw-Only Semantics) - LOCKED

**No Changes Required:**
- Throw-only error semantics maintained
- Authentication failures throw exceptions (401)
- Authorization failures throw exceptions (403, if applicable)

**Integration:**
- Authentication exceptions align with existing error taxonomy
- 401/403 added to documented exception types
- No try/catch added to execution path
- Exceptions propagate to api-gateway unchanged

### 9.4 Phase 15B (Privacy Policy) - LOCKED

**No Changes Required:**
- No prompt or response logging (maintained)
- Authentication operates on headers/metadata only
- No content inspection for security

**Integration:**
- api-gateway logs authentication events (success/failure, userId, keyId)
- api-gateway does NOT log prompt or response content
- Authentication layer respects privacy policy

### 9.5 Phase 17B (Observability) - LOCKED

**No Changes Required:**
- Observability logging unchanged
- userId already logged (now verified)
- No content-derived data (maintained)

**Integration:**
- AIExecutionService logs userId (now verified)
- Authentication adds no new observability logging (Phase 20)
- Future phases may add auth-specific observability

---

## 10. Architecture Snapshot (POST-PHASE-20)

### 10.1 Request Flow with Authentication

```
1. Client Request:
   POST /api/ai/execute
   Authorization: Bearer <api-key>
   Body: {
     "sessionId": "...",
     "conversationId": "...",
     "userId": "untrusted",
     "prompt": "..."
   }

2. api-gateway: Authentication
   ┌─────────────────────────────────────┐
   │ Extract API key from header         │
   │ Validate API key                    │
   │ Check revocation status             │
   │ Resolve API key → userId, apiKeyId  │
   └─────────────┬───────────────────────┘
                 │
                 ├─ Valid → Continue
                 └─ Invalid → Return 401 Unauthorized

3. api-gateway: Authorization
   ┌─────────────────────────────────────┐
   │ Check user has access to endpoint   │
   │ (Phase 20: All authenticated = OK)  │
   └─────────────┬───────────────────────┘
                 │
                 ├─ Authorized → Continue
                 └─ Forbidden → Return 403 Forbidden

4. api-gateway → ai-service:
   POST /ai/execute (internal)
   Body: {
     "sessionId": "...",
     "conversationId": "...",
     "userId": "verified-userId",  // REPLACED
     "prompt": "...",
     "metadata": {
       "apiKeyId": "key-abc123"  // INJECTED
     }
   }

5. ai-service: Execution (unchanged)
   ┌─────────────────────────────────────┐
   │ Trust userId (no validation)        │
   │ Select adapter                      │
   │ Execute request                     │
   │ Record tokens against userId        │
   │ Return AIExecutionResult            │
   └─────────────┬───────────────────────┘
                 │
                 ├─ Success → Return result
                 └─ Failure → Throw exception

6. api-gateway → Client:
   Success: AIExecutionResult
   Failure: HTTP error (401/403/500/etc)
```

### 10.2 Service Boundaries (POST-PHASE-20)

**api-gateway responsibilities:**
- ✅ Extract and validate API keys
- ✅ Resolve API key → userId
- ✅ Check revocation status
- ✅ Perform authorization checks
- ✅ Replace untrusted userId with verified userId
- ✅ Inject apiKeyId into metadata
- ✅ Forward verified request to ai-service
- ✅ Return authentication/authorization errors (401/403)
- ✅ Propagate ai-service responses unchanged

**ai-service responsibilities:**
- ✅ Trust userId from api-gateway
- ✅ Execute AI requests (unchanged)
- ✅ Record tokens against verified userId
- ✅ Log observability data (metadata only)
- ✅ Throw on execution failures (unchanged)

**Clear boundaries:**
- api-gateway: Authentication and authorization ONLY
- ai-service: Execution and token recording ONLY
- No authentication logic in ai-service
- No execution logic in api-gateway
- Identity verification at boundary (api-gateway)
- Identity trusted internally (ai-service)

### 10.3 Execution Invariants (POST-PHASE-20)

**Maintained from Previous Phases:**
- ✅ AIAdapter interface unchanged
- ✅ Throw-only error semantics unchanged
- ✅ Token recording on success only
- ✅ Stateless execution unchanged
- ✅ Privacy policy unchanged (no content logging)
- ✅ Observability unchanged (metadata only)
- ✅ Deterministic execution unchanged
- ✅ No retries introduced
- ✅ No fallbacks introduced

**New Invariants (Phase 20):**
- ✅ All requests must be authenticated
- ✅ userId is verified before execution
- ✅ apiKeyId propagated for audit
- ✅ Authentication failures return 401
- ✅ Authorization failures return 403 (if applicable)
- ✅ No content inspection for security

---

## 11. Safe Resume Point

### 11.1 Phase 20 Design Completion

**Phase 20 design is COMPLETE as of 2026-02-06.**

**What Was Designed:**
- ✅ Authentication model (API keys as bearer tokens)
- ✅ Authorization boundaries (authenticated users have access)
- ✅ Responsibility ownership (api-gateway vs ai-service)
- ✅ Identity propagation (verified userId replacement)
- ✅ Failure semantics (401/403 errors)
- ✅ Security invariants (privacy, no retries, no billing coupling)
- ✅ Integration points with locked phases
- ✅ Explicit non-goals (quotas, rate limiting, advanced auth)

**What Remains Unimplemented:**
- All implementation details
- API key storage and management
- Authentication middleware
- Authorization guards
- User management
- Billing integration
- Rate limiting
- Quotas

### 11.2 Implementation Sub-Phases (Suggested)

**Phase 20A (Potential): API Key Infrastructure**
- API key storage schema
- API key generation logic
- API key validation service
- API key revocation mechanism

**Phase 20B (Potential): Authentication Middleware**
- api-gateway authentication middleware
- Authorization guards
- Error handling for auth failures
- userId replacement logic

**Phase 20C (Potential): API Key Management Endpoints**
- POST /api/keys (create API key)
- GET /api/keys (list API keys)
- DELETE /api/keys/:keyId (revoke API key)
- Integration with frontend

**Phase 20D (Potential): Observability & Audit**
- Authentication metrics
- Authorization audit logs
- Security monitoring
- Anomaly detection

**Note:** These sub-phases are suggestions only and are NOT authorized for implementation until explicitly approved.

### 11.3 Dependencies for Future Phases

**Future phases can safely assume (after Phase 20 implementation):**

1. **Authentication Available:**
   - All requests to POST /api/ai/execute are authenticated
   - userId is verified and trustworthy
   - apiKeyId available for audit

2. **Stable Contracts:**
   - AIExecutionRequest unchanged (userId verified, not added)
   - AIExecutionResult unchanged
   - AIAdapter interface unchanged
   - Error semantics extended with 401/403

3. **Stable Behavior:**
   - Authentication at api-gateway boundary
   - No authentication in ai-service
   - Throw-only error semantics maintained
   - Privacy policy maintained
   - Stateless execution maintained

4. **Ready for Extension:**
   - Quotas can check userId before execution
   - Rate limiting can key on userId or apiKeyId
   - Billing can associate costs with userId
   - Fine-grained authorization can check userId permissions

---

## 12. Open Design Questions

### 12.1 Questions Requiring Clarification

**API Key Format:**
- Prefix format (e.g., `sk_live_...` vs `key_...`)?
- Length requirements (e.g., 32 bytes, 64 bytes)?
- Encoding (base64, hex, alphanumeric)?

**API Key Scope:**
- Single API key per user (initially)?
- Multiple API keys per user (future)?
- API key naming/labeling?

**Revocation Behavior:**
- Immediate revocation (no grace period)?
- Soft delete vs hard delete?
- Revocation audit trail?

**Error Messages:**
- Generic "Invalid API key" or specific error codes?
- Distinguish between missing/invalid/revoked?
- Security vs usability trade-off?

**Identity Metadata:**
- What additional metadata should be propagated?
- apiKeyId always included or optional?
- Future extensibility considerations?

### 12.2 Implementation Decisions Deferred

**Storage:**
- Database schema for API keys
- Hashing/encryption strategy
- Revocation tracking mechanism

**Performance:**
- API key validation caching strategy
- Cache TTL and invalidation
- Validation latency targets

**Security:**
- Rate limiting on auth failures
- Brute force protection
- Anomaly detection

**Observability:**
- Authentication metrics to track
- Audit log format
- Retention policy

---

## 13. Declaration of Design Finality

### 13.1 Design Completion Statement

**Phase 20 design is COMPLETE as of 2026-02-06.**

### 13.2 Design Summary

**Authentication Model:**
- ✅ API keys as primary authentication mechanism
- ✅ Bearer token format (Authorization header)
- ✅ API key validation at api-gateway
- ✅ API key → userId resolution
- ✅ Revocation support (design)

**Authorization Boundaries:**
- ✅ All authenticated users have access (Phase 20)
- ✅ No fine-grained authorization (deferred)
- ✅ No quota enforcement (deferred)
- ✅ No rate limiting (deferred)

**Responsibility Ownership:**
- ✅ api-gateway: Authentication and authorization
- ✅ ai-service: Trust verified userId
- ✅ Clear boundary between services

**Identity Propagation:**
- ✅ api-gateway replaces untrusted userId with verified userId
- ✅ apiKeyId propagated via metadata
- ✅ No credential propagation

**Failure Semantics:**
- ✅ 401 Unauthorized for authentication failures
- ✅ 403 Forbidden for authorization failures (future)
- ✅ Throw-only error semantics maintained
- ✅ No retries on auth failures

**Security Invariants:**
- ✅ No content logging (maintained)
- ✅ No credential logging (new)
- ✅ Privacy policy maintained
- ✅ No billing coupling (deferred)
- ✅ Stateless execution maintained

**Integration:**
- ✅ All locked phases (12-19) remain unchanged
- ✅ No contract modifications required
- ✅ No adapter interface changes
- ✅ No execution behavior changes

### 13.3 Design Authority

This design document establishes the architectural foundation for Phase 20 implementation.

**No implementation is authorized until this design is explicitly approved.**

**Phase 20 design is NOW COMPLETE.**

---

## ULTRA-BRIEF SUMMARY

• **API key authentication** at api-gateway boundary (bearer tokens in Authorization header) with validation, revocation checking, and API key → userId resolution
• **api-gateway enforces auth** (validates keys, replaces untrusted userId with verified userId, injects apiKeyId metadata) while ai-service trusts verified identity
• **401 Unauthorized** for all auth failures (missing/invalid/revoked keys) with throw-only semantics and no retries, maintaining deterministic execution
• **All locked invariants preserved** (no contract changes, no content logging, privacy policy maintained, stateless execution, no billing coupling)
• **Explicit non-goals** include API key management UI, quotas, rate limiting, fine-grained authorization, billing integration, and advanced auth mechanisms (deferred to future phases)

---

**END OF PHASE 20 DESIGN DOCUMENT**
