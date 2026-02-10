# PHASE 20B DESIGN: Authorization Policy at api-gateway

**Status:** DESIGN COMPLETE (Ready for Implementation)
**Nature:** Authorization Policy Design (api-gateway only)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 20 (Authentication & Access Control Design)
**Prerequisite:** Phase 20A (API Key Authentication) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 20B designs the authorization layer for the api-gateway, building on Phase 20A's authentication foundation. While Phase 20A answers "who are you?" (authentication), Phase 20B answers "what are you allowed to do?" (authorization).

This design establishes:
- **Permission model** for authenticated API keys
- **Enforcement boundaries** (where authorization checks occur)
- **Failure semantics** (403 Forbidden for authorization violations)
- **Deterministic authorization** (same identity + request → same decision)

### 1.2 Relationship to Phase 20A

**Phase 20A (Authentication) provided:**
- API key validation (static config)
- Identity resolution (apiKey → userId + apiKeyId)
- Verified identity injection (trusted userId forwarded to ai-service)
- Authentication failures (401 Unauthorized)

**Phase 20B (Authorization) adds:**
- Permission scopes attached to API keys
- Authorization checks after successful authentication
- Authorization failures (403 Forbidden)
- Scope-based access control (minimal initial set)

**Flow:**
```
Request → Authentication (20A) → Authorization (20B) → ai-service
          ↓ 401 if fails        ↓ 403 if forbidden    ↓ executes
```

### 1.3 Design Scope

**IN SCOPE (This Design):**
- Authorization model (scope-based permissions)
- Enforcement architecture (guard pattern)
- Error semantics (403 behavior)
- Minimal scope definitions (initial MVP set)
- Testing strategy for future implementation

**OUT OF SCOPE:**
- Implementation work (deferred to Phase 20B-IMPL)
- Database schema changes (static config extension only)
- RBAC/ABAC complexity (MVP is scope-based only)
- Quotas, rate limiting, billing enforcement
- UI for managing permissions
- Changes to ai-service

---

## 2. Goals & Non-Goals

### 2.1 Goals

**Primary Goals:**
1. **Define authorization policy** for API keys (what actions are permitted)
2. **Establish enforcement boundaries** (where checks happen, deterministic behavior)
3. **Preserve locked invariants** (no contract changes, throw-only errors, privacy policy)
4. **Enable future scalability** (design allows gradual permission expansion)

**Secondary Goals:**
1. Keep implementation simple (extend static config, no database required for MVP)
2. Maintain determinism (same inputs → same authorization decision)
3. Align with industry standards (OAuth2-style scopes)
4. Clear separation: api-gateway enforces, ai-service trusts

### 2.2 Non-Goals

**Explicitly NOT in Phase 20B:**
- ❌ Implementation work (design only)
- ❌ Per-user RBAC (role-based access control)
- ❌ Attribute-based access control (ABAC)
- ❌ Resource-level permissions (e.g., "can only access own conversations")
- ❌ Dynamic permission updates (no runtime permission changes)
- ❌ Permission delegation or token exchange
- ❌ Quota enforcement (deferred to Phase 21)
- ❌ Rate limiting (deferred to Phase 21)
- ❌ Billing checks (deferred to billing phase)
- ❌ Provider-specific permissions (all authenticated users can use all providers)
- ❌ Model-specific permissions (all authenticated users can use all models)
- ❌ Tenant isolation (single-tenant assumption)
- ❌ Admin APIs or permission management endpoints
- ❌ Changes to ai-service authorization logic (remains trusting)

---

## 3. Authorization Model (MVP Design)

### 3.1 Permission Model: Scope-Based

**Design Decision:** Use OAuth2-style permission scopes attached to API keys.

**Rationale:**
- Industry standard (OAuth2, OpenID Connect)
- Simple to understand (strings representing capabilities)
- Easy to extend (add new scopes over time)
- No complex hierarchy (flat scope list)
- Static config compatible (extend ApiKeyConfig with scopes array)

**Scope Format:**
```
<resource>:<action>

Examples:
- ai:execute
- conversations:read
- conversations:write
- admin:*
```

### 3.2 Initial Scope Definitions (MVP)

For Phase 20B MVP, define **one critical scope**:

**`ai:execute`**
- **Description:** Permission to execute AI requests via POST /api/ai/execute
- **Required by:** AIExecutionController.execute()
- **Rationale:** Primary platform capability, must be explicitly granted

**Future Scopes (Documented but NOT Implemented in 20B):**
- `conversations:read` - Read conversation history (future endpoint)
- `conversations:write` - Create/update conversations (future endpoint)
- `sessions:manage` - Start/stop sessions (future endpoint)
- `admin:*` - Administrative operations (future)

**Design Note:** Start with single scope (`ai:execute`) to prove the pattern. Expand gradually as new endpoints are added.

### 3.3 Default Policy (Initial MVP Behavior)

**Question:** Should all authenticated API keys have `ai:execute` by default?

**Design Decision:** **YES** (for MVP simplicity and backward compatibility)

**Default Scope Grant:**
- All API keys in Phase 20B MVP will have `ai:execute` scope by default
- This maintains backward compatibility with Phase 20A behavior (authenticated → can execute)
- Future phases can add restricted API keys without `ai:execute` scope

**Rationale:**
- Simplifies initial rollout (no permission configuration needed)
- Avoids breaking existing authenticated users
- Establishes pattern for future scope expansion
- Later phases can introduce restricted keys for specific use cases

**Implementation Guidance:**
```typescript
// Extend ApiKeyConfig (static)
const API_KEY_REGISTRY = new Map<string, ApiKeyIdentity>([
  ['test-api-key-user-1', {
    userId: 'user-1',
    apiKeyId: 'key-1',
    scopes: ['ai:execute']  // DEFAULT GRANT
  }],
  // ... other keys
]);
```

### 3.4 Authorization Decision Logic

**Decision Flow:**
```
1. Request arrives at api-gateway
2. ApiKeyAuthGuard authenticates (Phase 20A) → identity resolved
3. AuthorizationGuard checks permissions:
   a. Extract required scope from route metadata (e.g., @RequireScope('ai:execute'))
   b. Lookup API key's granted scopes from ApiKeyConfig
   c. Check: required scope ∈ granted scopes?
   d. If YES → allow (proceed to controller)
   e. If NO → throw ForbiddenException (403)
4. Controller executes (assumes authorized)
```

**Determinism Guarantee:**
- Same API key + same endpoint → same authorization decision
- No probabilistic checks
- No time-based expiration (in MVP)
- No state-dependent behavior

**Authorization Success:**
- Guard returns `true`
- Request proceeds to controller
- Verified identity already attached by Phase 20A

**Authorization Failure:**
- Guard throws `ForbiddenException` (403)
- Request never reaches controller
- ai-service never called

---

## 4. Enforcement Architecture

### 4.1 Enforcement Boundary: api-gateway Only

**Design Principle:** Authorization is enforced at the api-gateway boundary. ai-service remains trusting.

**Service Boundaries:**
```
┌─────────────────────────────────────────────────┐
│ api-gateway                                     │
│                                                 │
│  1. Authentication (Phase 20A)                  │
│     ApiKeyAuthGuard → verify API key            │
│     Result: ApiKeyIdentity (userId + apiKeyId)  │
│                                                 │
│  2. Authorization (Phase 20B)                   │
│     AuthorizationGuard → verify scopes          │
│     Result: Allow (200) or Deny (403)           │
│                                                 │
│  3. Controller                                  │
│     Assumes: authenticated AND authorized       │
│     Action: forward verified request            │
└────────────────────┬────────────────────────────┘
                     │ AIExecutionRequest
                     │ (userId verified, no scopes)
                     ↓
┌─────────────────────────────────────────────────┐
│ ai-service                                      │
│                                                 │
│  • Trusts userId (no validation)                │
│  • No authentication logic                      │
│  • No authorization logic                       │
│  • Executes request                             │
│  • Records tokens                               │
└─────────────────────────────────────────────────┘
```

**Invariant:** ai-service NEVER performs authentication or authorization checks.

### 4.2 Enforcement Mechanism: Guard Pattern (Continuation of 20A)

**Design Decision:** Use NestJS Guards for authorization, matching Phase 20A's authentication pattern.

**Guard Execution Order:**
```typescript
@Post('execute')
@UseGuards(ApiKeyAuthGuard, AuthorizationGuard)  // Chain guards
@RequireScope('ai:execute')  // Metadata: required scope
async execute(
  @Body() request: AIExecutionRequest,
  @AuthenticatedUser() identity: ApiKeyIdentity,
) {
  // At this point: authenticated AND authorized
  // Proceed with execution
}
```

**Execution Flow:**
1. **ApiKeyAuthGuard** (Phase 20A) runs first
   - Validates API key
   - Resolves identity
   - Attaches identity to request
   - Throws 401 if authentication fails

2. **AuthorizationGuard** (Phase 20B) runs second
   - Reads required scope from route metadata (`@RequireScope`)
   - Reads granted scopes from identity (extended ApiKeyConfig)
   - Checks permission
   - Throws 403 if authorization fails

3. **Controller** runs last
   - Assumes authenticated and authorized
   - Performs business logic

**Design Benefits:**
- Separation of concerns (auth ≠ authz)
- Declarative permissions (metadata-driven)
- Reusable across controllers
- Easy to test in isolation

### 4.3 Scope Declaration: Route Metadata

**Design Decision:** Use custom decorator to declare required scopes per route.

**Decorator Syntax:**
```typescript
@RequireScope('ai:execute')  // Single scope
@Post('execute')
async execute(...) { }

// Future: multiple scopes (AND logic)
@RequireScopes(['conversations:read', 'conversations:write'])
@Post('conversations')
async manageConversation(...) { }
```

**Metadata Key:** `REQUIRED_SCOPES` (custom key for Reflector)

**Implementation Guidance (Future):**
```typescript
// decorators/require-scope.decorator.ts
export const RequireScope = (scope: string) =>
  SetMetadata('REQUIRED_SCOPES', [scope]);

export const RequireScopes = (scopes: string[]) =>
  SetMetadata('REQUIRED_SCOPES', scopes);
```

**Guard Reads Metadata:**
```typescript
// guards/authorization.guard.ts
const requiredScopes = this.reflector.get<string[]>(
  'REQUIRED_SCOPES',
  context.getHandler(),
);

if (!requiredScopes || requiredScopes.length === 0) {
  return true;  // No authorization required
}

const identity = request.user as ApiKeyIdentity;
const grantedScopes = this.getGrantedScopes(identity.apiKeyId);

// Check: all required scopes are granted
const hasPermission = requiredScopes.every(scope =>
  grantedScopes.includes(scope)
);

if (!hasPermission) {
  throw new ForbiddenException('Insufficient permissions');
}

return true;
```

### 4.4 Static Configuration Extension

**Design Decision:** Extend Phase 20A's static ApiKeyConfig to include scopes. No database required for MVP.

**Extended Interface:**
```typescript
export interface ApiKeyIdentity {
  userId: string;
  apiKeyId: string;
  scopes: string[];  // NEW in Phase 20B
}
```

**Extended Config:**
```typescript
const API_KEY_REGISTRY = new Map<string, ApiKeyIdentity>([
  ['test-api-key-user-1', {
    userId: 'user-1',
    apiKeyId: 'key-1',
    scopes: ['ai:execute'],  // DEFAULT GRANT
  }],
  ['test-api-key-user-2', {
    userId: 'user-2',
    apiKeyId: 'key-2',
    scopes: ['ai:execute'],  // DEFAULT GRANT
  }],
  ['valid-api-key', {
    userId: 'test-user',
    apiKeyId: 'key-test',
    scopes: ['ai:execute'],  // DEFAULT GRANT
  }],
]);
```

**Backward Compatibility:**
- All existing Phase 20A API keys gain `ai:execute` scope
- Authorization checks pass (all keys have required scope)
- Behavior unchanged from user perspective

**Future Scalability:**
- Can add restricted keys: `scopes: []` (no permissions)
- Can add admin keys: `scopes: ['ai:execute', 'admin:*']`
- Can migrate to database without changing guard logic

---

## 5. Error Semantics

### 5.1 Authorization Failure: 403 Forbidden

**Status Code:** 403 Forbidden

**Trigger Conditions:**
- API key authenticated successfully (Phase 20A passed)
- API key lacks required scope for requested operation
- Example: API key has `scopes: ['conversations:read']` but route requires `ai:execute`

**Error Response Format:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**Design Constraints:**
- **Standard NestJS format** (match Phase 20A pattern)
- **No permission details leaked** (don't expose which scope is missing)
- **Generic message only** ("Insufficient permissions")
- **No stack traces**
- **No credential values**

**Rationale for Generic Message:**
- Security: Don't reveal permission model to unauthenticated probers
- Simplicity: Clients should not programmatically parse error messages
- Stability: Message can change without breaking clients

### 5.2 Error Code Taxonomy (Updated from Phase 20A)

**Authentication vs Authorization Errors:**

**401 Unauthorized (Phase 20A):**
- Missing `Authorization` header
- Malformed `Authorization` header (not "Bearer <key>")
- Empty or whitespace-only API key
- Invalid API key (not in registry)

**403 Forbidden (Phase 20B):**
- Valid API key (authenticated)
- Insufficient scopes (not authorized)

**Clear Distinction:**
- 401 = "I don't know who you are" (authentication failure)
- 403 = "I know who you are, but you can't do this" (authorization failure)

**Execution Errors (Unchanged):**
- 400 Bad Request (validation failures)
- 500 Internal Server Error (execution failures)
- 503 Service Unavailable (provider unavailable)

### 5.3 Throw-Only Semantics (Locked from Phase 15A)

**Phase 20B Maintains Deterministic Throw-Only Behavior:**
- ✅ Authorization failures throw immediately (no retries)
- ✅ No fallback mechanisms (no "try admin if user fails")
- ✅ No error payloads in success responses
- ✅ No partial success states
- ✅ Same request with same API key → same result

**No Retry Logic:**
- Authorization failure is deterministic (missing scope won't appear later)
- Don't retry 403 errors (waste of resources)
- Client must use API key with correct scopes

**Guard Behavior:**
```typescript
// AuthorizationGuard
if (!hasPermission) {
  throw new ForbiddenException('Insufficient permissions');  // IMMEDIATE
}
return true;  // ALLOW
```

**Controller Assumption:**
- If controller executes, authorization succeeded
- No need to check permissions again
- Trust the guard chain

### 5.4 Error Propagation

**Authorization Errors (api-gateway):**
- Thrown by AuthorizationGuard
- Never reach controller
- Never reach ai-service
- Returned directly to client (403 JSON response)

**Execution Errors (ai-service):**
- Propagated unchanged from ai-service
- Not affected by authorization layer
- Same semantics as Phase 15A–17

**Error Isolation:**
- Authentication errors: 401 (Phase 20A)
- Authorization errors: 403 (Phase 20B)
- Execution errors: 400/500/503 (Phase 15A–17)
- Clear boundaries, no mixing

---

## 6. Identity & Context Propagation

### 6.1 Reuse Phase 20A Identity Injection

**Phase 20A Established:**
- Verified `userId` replaces untrusted `userId`
- `apiKeyId` injected into `metadata`
- Verified `AIExecutionRequest` forwarded to ai-service

**Phase 20B Does NOT Change This:**
- ✅ Identity injection logic unchanged
- ✅ `userId` replacement unchanged
- ✅ `apiKeyId` in metadata unchanged
- ✅ ai-service receives same request format

**Authorization is Stateless:**
- Authorization decision made at api-gateway
- Decision NOT forwarded to ai-service (no "authorized: true" flag)
- ai-service trusts that api-gateway enforced policy

### 6.2 Scope Information: Where Does It Live?

**Design Decision:** Scopes are NOT forwarded to ai-service.

**Storage:**
- Scopes stored in api-gateway's ApiKeyConfig (static)
- Scopes attached to `ApiKeyIdentity` (in-memory during request)
- Scopes read by AuthorizationGuard during authorization check
- Scopes discarded after authorization check

**NOT Forwarded:**
- `AIExecutionRequest` does NOT include `scopes` field
- ai-service does NOT receive scope information
- ai-service does NOT need scope information (trusting execution)

**Audit Trail:**
- `apiKeyId` in metadata (Phase 20A) is sufficient for audit
- Audit system can lookup scopes from API key registry later
- No need to duplicate scope data in every request

**Rationale:**
- Scopes are authorization metadata, not execution data
- ai-service doesn't need scopes (policy enforced upstream)
- Keeps contracts minimal (no new fields)
- Reduces payload size

### 6.3 What Gets Forwarded to ai-service

**AIExecutionRequest (Unchanged from Phase 20A):**
```typescript
{
  "sessionId": "session-123",
  "conversationId": "conv-456",
  "userId": "test-user",  // VERIFIED (20A)
  "prompt": "Hello",
  "metadata": {
    "apiKeyId": "key-test",  // INJECTED (20A)
    // NO scopes field
  }
}
```

**Invariant:** AIExecutionRequest contract unchanged by Phase 20B.

---

## 7. Privacy & Security Considerations

### 7.1 Privacy Policy (Locked from Phase 15B)

**Phase 15B Privacy Guarantees (Still Maintained):**
- ✅ No prompt logging
- ✅ No response logging
- ✅ No content-derived metadata

**Phase 20B Adds:**
- ✅ No API key logging (credentials never logged)
- ✅ Authorization decisions logged (boolean: allowed/denied)
- ✅ Required scopes logged (metadata: which scope was checked)
- ✅ Granted scopes logged (metadata: which scopes user has)
- ✅ No actual prompt/response content logged

**Observability Logging (Minimal):**
```typescript
// ALLOWED
logger.info('Authorization check', {
  apiKeyId: 'key-test',      // Identifier, not credential
  userId: 'test-user',       // Identity
  requiredScope: 'ai:execute',  // Policy metadata
  decision: 'allowed',       // Boolean result
});

// FORBIDDEN
logger.info('Authorization denied', {
  apiKeyId: 'key-test',
  userId: 'test-user',
  requiredScope: 'ai:execute',
  grantedScopes: ['conversations:read'],  // For debugging
  decision: 'denied',
});
```

**What MUST NOT Be Logged:**
- ❌ API key values (credentials)
- ❌ Authorization header values
- ❌ Prompt content
- ❌ Response content
- ❌ Bearer tokens

### 7.2 Security Properties

**Fail-Secure Defaults:**
- Missing `@RequireScope` decorator → no authorization check (allowed)
  - **Design Note:** This is intentional for internal routes
  - Public routes MUST have explicit `@RequireScope`
  - Linter rule recommended: require `@RequireScope` on public routes

- Empty scopes array `scopes: []` → no permissions (deny all)
  - **Design Note:** Useful for revoked/suspended API keys

**No Bypass Possible:**
- Authorization check runs in guard (before controller)
- No way to skip guard (NestJS enforces guard execution)
- Controller cannot be reached without passing guard
- ai-service trusts api-gateway (internal service boundary)

**Deterministic Decisions:**
- Same API key + same endpoint → same decision
- No time-based variations (no expiration in MVP)
- No probabilistic checks
- No state-dependent behavior

**Least Privilege:**
- Start with minimal scopes (`ai:execute` only)
- Add scopes incrementally as features are added
- Default deny for new endpoints (require explicit `@RequireScope`)

---

## 8. Implementation Guidance (For Future Phase 20B-IMPL)

### 8.1 Files to Create

**Authorization Logic (api-gateway):**
1. `services/api-gateway/src/auth/authorization.guard.ts`
   - NestJS CanActivate guard
   - Reads required scopes from route metadata
   - Reads granted scopes from ApiKeyIdentity
   - Throws ForbiddenException if insufficient permissions
   - ~80 lines

2. `services/api-gateway/src/auth/decorators/require-scope.decorator.ts`
   - Custom metadata decorator
   - `@RequireScope(scope: string)`
   - `@RequireScopes(scopes: string[])`
   - ~20 lines

**Configuration Extension (api-gateway):**
3. Modify `services/api-gateway/src/auth/api-key.config.ts`
   - Add `scopes: string[]` to `ApiKeyIdentity` interface
   - Add scopes to all API keys in registry (default: `['ai:execute']`)
   - ~10 lines modified

**Test Files (api-gateway):**
4. `services/api-gateway/src/auth/__tests__/authorization.guard.spec.ts`
   - Unit tests for AuthorizationGuard
   - Test cases: allowed, denied, missing metadata
   - ~100 lines

5. Modify `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts`
   - Add authorization test cases
   - Test 403 for missing scope
   - Verify regression: existing keys still work
   - ~30 lines added

**Total New Code:** ~200 lines
**Total Modified Code:** ~40 lines

### 8.2 Module Wiring

**auth.module.ts (Modified):**
```typescript
@Module({
  providers: [
    ApiKeyAuthGuard,      // Phase 20A
    AuthorizationGuard,   // Phase 20B (NEW)
  ],
  exports: [
    ApiKeyAuthGuard,      // Phase 20A
    AuthorizationGuard,   // Phase 20B (NEW)
  ],
})
export class AuthModule {}
```

**ai-execution.controller.ts (Modified):**
```typescript
@Post('execute')
@UseGuards(ApiKeyAuthGuard, AuthorizationGuard)  // Chain both guards
@RequireScope('ai:execute')  // NEW decorator
async execute(
  @Body() request: AIExecutionRequest,
  @AuthenticatedUser() identity: ApiKeyIdentity,
) {
  // Identity injection logic unchanged from Phase 20A
  const verifiedRequest: AIExecutionRequest = {
    ...request,
    userId: identity.userId,
    metadata: {
      ...request.metadata,
      apiKeyId: identity.apiKeyId,
    },
  };
  return await this.aiServiceHttpClient.execute(verifiedRequest);
}
```

### 8.3 No Changes to ai-service

**ai-service Files (Completely Unchanged):**
- ✅ `services/ai-service/src/ai-execution/ai-execution.controller.ts`
- ✅ `services/ai-service/src/ai-execution/ai-execution.service.ts`
- ✅ `services/ai-service/src/ai-execution/adapters/*`
- ✅ All other ai-service files

**ai-service Behavior (Unchanged):**
- ✅ Trusts userId from api-gateway
- ✅ No authentication logic
- ✅ No authorization logic
- ✅ Execution flow unchanged
- ✅ Token recording unchanged

---

## 9. Testing Strategy

### 9.1 Unit Tests (AuthorizationGuard)

**Required Test Cases:**

**TC-AUTH-01: Allow when scope granted**
- Setup: API key has `scopes: ['ai:execute']`
- Action: Call route requiring `@RequireScope('ai:execute')`
- Expected: Guard returns `true`, controller executes

**TC-AUTH-02: Deny when scope missing**
- Setup: API key has `scopes: ['conversations:read']`
- Action: Call route requiring `@RequireScope('ai:execute')`
- Expected: Guard throws ForbiddenException (403)

**TC-AUTH-03: Allow when no scope required**
- Setup: API key has `scopes: []`
- Action: Call route without `@RequireScope` decorator
- Expected: Guard returns `true`, controller executes

**TC-AUTH-04: Allow when multiple scopes granted (all required present)**
- Setup: API key has `scopes: ['ai:execute', 'conversations:read']`
- Action: Call route requiring `@RequireScopes(['ai:execute', 'conversations:read'])`
- Expected: Guard returns `true`

**TC-AUTH-05: Deny when multiple scopes required (one missing)**
- Setup: API key has `scopes: ['ai:execute']`
- Action: Call route requiring `@RequireScopes(['ai:execute', 'admin:*'])`
- Expected: Guard throws ForbiddenException (403)

**TC-AUTH-06: Error message does not leak scope information**
- Setup: API key has `scopes: []`
- Action: Call route requiring `@RequireScope('ai:execute')`
- Expected: Error message is generic ("Insufficient permissions")

**TC-AUTH-07: Deterministic behavior**
- Setup: API key has `scopes: ['conversations:read']`
- Action: Call same route 3 times requiring `@RequireScope('ai:execute')`
- Expected: All 3 calls fail with identical 403 response

### 9.2 Integration Tests (Controller)

**Required Test Cases:**

**TC-INT-01: Full flow - authentication + authorization success**
- Setup: Valid API key with `scopes: ['ai:execute']`
- Action: POST /api/ai/execute with Authorization header
- Expected: 200 OK with AIExecutionResult

**TC-INT-02: Full flow - authentication success, authorization failure**
- Setup: Valid API key with `scopes: []` (no permissions)
- Action: POST /api/ai/execute with Authorization header
- Expected: 403 Forbidden ("Insufficient permissions")

**TC-INT-03: Regression - Phase 20A still works**
- Setup: Existing test API key (from Phase 20A) now has `scopes: ['ai:execute']`
- Action: POST /api/ai/execute with Authorization header
- Expected: 200 OK (backward compatible)

**TC-INT-04: Verified userId still forwarded to ai-service**
- Setup: Valid API key with `scopes: ['ai:execute']`
- Action: POST /api/ai/execute with untrusted userId in body
- Expected: ai-service receives verified userId (from API key), not untrusted userId

**TC-INT-05: apiKeyId still injected into metadata**
- Setup: Valid API key with `scopes: ['ai:execute']`
- Action: POST /api/ai/execute
- Expected: ai-service receives metadata.apiKeyId

**TC-INT-06: Authorization failure does not call ai-service**
- Setup: Valid API key with `scopes: []`
- Action: POST /api/ai/execute
- Expected: 403 response, ai-service HTTP client NOT called

### 9.3 Guard Execution Order Tests

**TC-ORDER-01: Authentication runs before authorization**
- Setup: Invalid API key (not in registry)
- Action: POST /api/ai/execute
- Expected: 401 Unauthorized (authentication fails first, authorization never runs)

**TC-ORDER-02: Authorization runs after authentication**
- Setup: Valid API key with `scopes: []`
- Action: POST /api/ai/execute
- Expected: 403 Forbidden (authentication passed, authorization failed)

### 9.4 Static Configuration Tests

**TC-CONFIG-01: All default API keys have ai:execute scope**
- Setup: Read ApiKeyConfig
- Action: Verify all entries have `scopes: ['ai:execute']`
- Expected: All test keys grant ai:execute by default

**TC-CONFIG-02: ApiKeyIdentity includes scopes field**
- Setup: Call `validateApiKey('valid-api-key')`
- Action: Inspect returned identity
- Expected: Identity includes `{ userId, apiKeyId, scopes: ['ai:execute'] }`

### 9.5 Test Coverage Requirements

**Minimum Coverage:**
- AuthorizationGuard: 100% line coverage
- @RequireScope decorator: 100% line coverage
- AIExecutionController authorization path: 100% line coverage

**Regression Coverage:**
- All Phase 20A tests must still pass (34 tests)
- New Phase 20B tests: ~15 tests
- Total tests after Phase 20B: ~49 tests

**Test Execution Time:**
- Unit tests: < 5 seconds
- Integration tests: < 10 seconds
- Total: < 15 seconds

---

## 10. Determinism & Correctness Guarantees

### 10.1 Deterministic Authorization

**Guarantee:** Same API key + same endpoint → same authorization decision (always).

**No Time-Based Variations:**
- No expiration checks (in MVP)
- No "valid from" timestamps
- No "valid until" timestamps
- Decision is purely scope-based

**No State-Based Variations:**
- No quota checks (deferred to Phase 21)
- No rate limit checks (deferred to Phase 21)
- No billing status checks (deferred to billing phase)
- Decision is stateless

**Idempotent Checks:**
- Calling authorization check multiple times → same result
- No side effects (no logging changes decision)
- No caching (stateless validation)

### 10.2 Consistency with Phase 20A

**Authentication + Authorization = Composable:**
- Authentication failure (401) → authorization never runs
- Authentication success + authorization failure (403)
- Authentication success + authorization success → controller runs

**No Ambiguity:**
- 401 = authentication problem (fix: provide valid API key)
- 403 = authorization problem (fix: use API key with correct scopes)
- Never 401 when you mean 403 (or vice versa)

**Clear Error Messages:**
- 401: "Missing authentication credentials" or "Invalid API key"
- 403: "Insufficient permissions"
- Never mix messages (don't say "unauthorized" for both)

### 10.3 Correctness Properties

**Security Properties:**
1. **No bypass:** All routes with `@RequireScope` enforce authorization
2. **Fail-secure:** Missing scopes → deny (not allow)
3. **Least privilege:** Only granted scopes are allowed
4. **No elevation:** Cannot gain scopes at runtime

**Functional Properties:**
1. **Backward compatible:** Phase 20A keys still work (with `ai:execute` scope)
2. **Forward compatible:** Can add new scopes without breaking existing keys
3. **Contract stable:** AIExecutionRequest/AIExecutionResult unchanged
4. **Service boundary:** api-gateway enforces, ai-service trusts

---

## 11. Locked Invariants (Re-Asserted)

### 11.1 Contracts (Phase 12B - LOCKED)

**AIExecutionRequest (Unchanged by Phase 20B):**
```typescript
export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;  // Verified by Phase 20A
  prompt: string;
  metadata?: Record<string, unknown>;  // apiKeyId from Phase 20A
  // NO scopes field (Phase 20B does not add this)
}
```

**AIExecutionResult (Unchanged by Phase 20B):**
```typescript
export interface AIExecutionResult {
  output: string;
  tokensUsed: number;
  model: string;
  // NO authorization metadata added
}
```

### 11.2 ai-service Remains Trusting (Phase 12B - LOCKED)

**ai-service Behavior:**
- ✅ Trusts userId received from api-gateway (Phase 20A)
- ✅ No authentication logic (Phase 20A)
- ✅ No authorization logic (Phase 20B)
- ✅ No scope validation
- ✅ No permission checks
- ✅ Stateless execution maintained

**Service Boundary:**
- ✅ api-gateway: Authentication (20A) + Authorization (20B)
- ✅ ai-service: Trusting execution
- ✅ Clear separation maintained

### 11.3 Throw-Only Errors (Phase 15A - LOCKED)

**Error Handling Unchanged:**
- ✅ Authorization failures throw (403)
- ✅ No error payloads in success responses
- ✅ No partial success states
- ✅ No try/catch in execution path

**New Error Type (Phase 20B):**
- 403 Forbidden (authorization failures)

**Existing Error Types (Unchanged):**
- 401 Unauthorized (authentication failures from Phase 20A)
- 400 Bad Request (validation failures from Phase 15A)
- 500 Internal Server Error (execution failures from Phase 15A)
- 503 Service Unavailable (provider unavailable from Phase 15A)

### 11.4 Token Recording (Phase 13 - LOCKED)

**Token Recording Behavior:**
- ✅ Tokens recorded on success only
- ✅ Tokens recorded against verified userId (Phase 20A)
- ✅ No token recording on authentication failure (Phase 20A)
- ✅ No token recording on authorization failure (Phase 20B)
- ✅ Token recording logic unchanged

### 11.5 Privacy Policy (Phase 15B - LOCKED)

**Privacy Guarantees Maintained:**
- ✅ No prompt logging (Phase 15B)
- ✅ No response logging (Phase 15B)
- ✅ No content-derived metadata (Phase 15B)
- ✅ No API key logging (Phase 20A)
- ✅ Authorization decisions logged (boolean only, Phase 20B)

### 11.6 Observability (Phase 17B - LOCKED)

**Observability Unchanged:**
- ✅ AIExecutionService logs userId (verified by Phase 20A)
- ✅ AIExecutionService logs metadata (includes apiKeyId from Phase 20A)
- ✅ No prompt or response logging (Phase 15B)
- ✅ No authorization-specific observability (Phase 20B MVP)

**Future Consideration:**
- Authorization metrics deferred to Phase 20C
- Authorization audit logs deferred to Phase 20C

### 11.7 Execution Determinism (Phase 15A - LOCKED)

**Deterministic Execution Maintained:**
- ✅ Same API key + same request → same authentication result (Phase 20A)
- ✅ Same API key + same request → same authorization result (Phase 20B)
- ✅ Same verified request → same execution result (Phase 15A)
- ✅ No probabilistic failures
- ✅ No state-dependent behavior
- ✅ No retries introduced
- ✅ No fallbacks introduced

---

## 12. Explicit Non-Goals (Re-Asserted)

### 12.1 Not Designed in Phase 20B

**Advanced Authorization:**
- ❌ Role-based access control (RBAC)
- ❌ Attribute-based access control (ABAC)
- ❌ Resource-level permissions (e.g., "can only read own data")
- ❌ Hierarchical permissions (e.g., admin implies user)
- ❌ Permission delegation (e.g., "allow X to act as Y")
- ❌ Dynamic scopes (runtime scope changes)

**Permission Management:**
- ❌ API key CRUD endpoints (still deferred)
- ❌ Scope assignment UI
- ❌ Scope listing endpoints
- ❌ Permission audit endpoints
- ❌ User self-service permission requests

**Quotas & Limits:**
- ❌ Usage quotas (deferred to Phase 21)
- ❌ Rate limiting (deferred to Phase 21)
- ❌ Concurrency limits (deferred to Phase 21)
- ❌ Cost limits (deferred to Phase 21)

**Billing Integration:**
- ❌ Billing checks during authorization
- ❌ Subscription tier checks
- ❌ Payment validation
- ❌ Credit balance checks

**Time-Based Controls:**
- ❌ API key expiration
- ❌ Temporary access grants
- ❌ Time-limited permissions
- ❌ Schedule-based permissions (e.g., "only weekdays")

**Observability & Audit:**
- ❌ Authorization metrics (Phase 20C potential)
- ❌ Authorization audit logs (Phase 20C potential)
- ❌ Permission usage analytics
- ❌ Security dashboards

**Performance:**
- ❌ Authorization result caching
- ❌ Scope lookup caching
- ❌ Precomputed permission matrices

### 12.2 Deferred to Future Phases

**Phase 20B-IMPL (Next):**
- Implement authorization guard
- Implement scope decorators
- Extend static config with scopes
- Write comprehensive tests

**Phase 20C (Potential): Observability & Audit**
- Authorization metrics
- Authorization audit logs
- Security monitoring dashboards
- Alerting on repeated authorization failures

**Phase 21 (Potential): Usage Quotas**
- Token quotas per user
- Rate limiting (requests per minute)
- Cost limits (spending caps)
- Integration with authorization (403 when quota exceeded)

**Phase 22 (Potential): Advanced Authorization**
- RBAC (roles and permissions)
- Resource-level permissions
- Provider-specific access control
- Model-specific access control

---

## 13. Safe Resume Point

### 13.1 Phase 20B Design Completion Status

**Phase 20B Design is COMPLETE as of 2026-02-06.**

**What Was Designed:**
- ✅ Scope-based authorization model (minimal MVP)
- ✅ Initial scope definition (`ai:execute`)
- ✅ Enforcement architecture (guard pattern)
- ✅ Error semantics (403 Forbidden)
- ✅ Static config extension (no database required)
- ✅ Determinism guarantees (stateless authorization)
- ✅ Privacy policy maintained (no content logging)
- ✅ Testing strategy (15 new test cases)
- ✅ Backward compatibility (Phase 20A keys work)

**What Remains Unchanged:**
- ✅ ai-service completely unchanged (trusting execution)
- ✅ AIExecutionRequest/AIExecutionResult contracts unchanged
- ✅ Phase 20A authentication logic unchanged
- ✅ Token recording logic unchanged
- ✅ Privacy policy unchanged
- ✅ Observability logic unchanged

### 13.2 Dependencies for Phase 20B-IMPL

**Phase 20B-IMPL can safely assume:**

1. **Design Decisions Finalized:**
   - Scope-based permissions model approved
   - `ai:execute` scope defined
   - Guard pattern selected for enforcement
   - 403 error semantics defined

2. **Phase 20A Foundation:**
   - API keys authenticated at api-gateway
   - Verified identity available (userId + apiKeyId)
   - 401 errors for authentication failures
   - No changes to ai-service

3. **Implementation Guidance:**
   - Create AuthorizationGuard (~80 lines)
   - Create @RequireScope decorator (~20 lines)
   - Extend ApiKeyConfig with scopes (~10 lines modified)
   - Write 15 new tests (~130 lines)
   - Total effort: ~240 lines of code

4. **Clear Success Criteria:**
   - All 49 tests passing (34 existing + 15 new)
   - TypeScript compilation successful
   - No regressions in Phase 20A behavior
   - 403 errors returned for insufficient permissions

### 13.3 Implementation Checklist (For Phase 20B-IMPL)

**Step 1: Extend Static Config**
- [ ] Add `scopes: string[]` to `ApiKeyIdentity` interface
- [ ] Add `scopes: ['ai:execute']` to all existing API keys
- [ ] Write unit tests for extended config

**Step 2: Create Authorization Guard**
- [ ] Create `authorization.guard.ts` in `auth/` directory
- [ ] Implement scope checking logic
- [ ] Throw ForbiddenException for insufficient permissions
- [ ] Write unit tests (7 test cases)

**Step 3: Create Scope Decorator**
- [ ] Create `require-scope.decorator.ts` in `auth/decorators/`
- [ ] Implement `@RequireScope(scope: string)`
- [ ] Implement `@RequireScopes(scopes: string[])`

**Step 4: Wire Up Authorization**
- [ ] Add AuthorizationGuard to auth.module.ts providers/exports
- [ ] Add `@UseGuards(ApiKeyAuthGuard, AuthorizationGuard)` to execute()
- [ ] Add `@RequireScope('ai:execute')` to execute()

**Step 5: Write Integration Tests**
- [ ] Add 8 integration test cases to controller test
- [ ] Verify 403 for missing scope
- [ ] Verify 200 for valid scope
- [ ] Verify regression: Phase 20A still works

**Step 6: Verify**
- [ ] All tests pass (49 total)
- [ ] TypeScript compiles without errors
- [ ] No console.log or debug code
- [ ] Manual testing: curl with valid/invalid scopes

### 13.4 Future Work (NOT Part of Phase 20B)

**Phase 20C (Potential): Observability & Audit**
- Authorization metrics (success/failure rates)
- Authorization audit logs (who accessed what)
- Security monitoring dashboards
- Alerting on authorization anomalies

**Phase 21 (Potential): Usage Quotas**
- Token quotas per user (enforce in authorization guard?)
- Rate limiting (requests per minute)
- Cost limits (spending caps)
- Integration with authorization (quota exceeded → 403)

**Phase 22 (Potential): Advanced Authorization**
- API key management endpoints (CRUD)
- Database persistence for API keys
- RBAC (roles and permissions)
- Resource-level permissions

**Phase 23 (Potential): Multi-Tenancy**
- Tenant isolation
- Tenant-specific API keys
- Tenant-specific quotas
- Cross-tenant access controls

**Note:** These are suggestions only. Phase 20C scope must be explicitly defined by user.

---

## 14. Implementation Timeline Estimate (Informational Only)

**Design Phase (Phase 20B):**
- ✅ COMPLETE (this document)

**Implementation Phase (Phase 20B-IMPL):**
- AuthorizationGuard implementation: ~1 hour
- Decorator implementation: ~30 minutes
- Config extension: ~15 minutes
- Test implementation: ~2 hours
- Integration and verification: ~1 hour
- **Total:** ~5 hours (single developer, uninterrupted)

**Deployment:**
- api-gateway redeployment: ~15 minutes
- Smoke testing: ~15 minutes
- **Total:** ~30 minutes

**Note:** These are rough estimates for planning purposes only. Actual implementation time may vary.

---

## 15. Conclusion

### 15.1 Design Summary

Phase 20B establishes a minimal, scope-based authorization layer at the api-gateway, building on Phase 20A's authentication foundation.

**Key Design Decisions:**
1. **Scope-based permissions** (OAuth2 style)
2. **Single initial scope** (`ai:execute`)
3. **Guard pattern enforcement** (reusing Phase 20A pattern)
4. **403 Forbidden** for authorization failures
5. **Static config extension** (no database required for MVP)
6. **ai-service remains trusting** (no authorization logic)
7. **Deterministic authorization** (stateless, no time-based checks)
8. **Backward compatible** (Phase 20A keys gain `ai:execute` by default)

**Design Benefits:**
- ✅ Simple to implement (~240 lines of code)
- ✅ Simple to understand (declarative `@RequireScope`)
- ✅ Simple to extend (add new scopes incrementally)
- ✅ Simple to test (deterministic behavior)
- ✅ No breaking changes (contracts preserved)
- ✅ No service rewrites (ai-service unchanged)

### 15.2 Design Authority

This design document supersedes any previous discussions or assumptions regarding Phase 20B authorization implementation.

**Phase 20B Design is NOW COMPLETE and READY FOR IMPLEMENTATION.**

---

## ULTRA-BRIEF SUMMARY

• **Scope-based authorization model** designed with single initial scope (`ai:execute`) using OAuth2-style permission strings attached to API keys
• **Guard pattern enforcement** at api-gateway after authentication (20A) with 403 Forbidden for insufficient permissions, deterministic decisions, and no retries
• **Static config extension only** adding `scopes: ['ai:execute']` to all existing API keys (no database required), maintaining backward compatibility with Phase 20A
• **ai-service unchanged** and remains trusting with no authorization logic, clear boundary preserved (api-gateway enforces, ai-service executes)
• **All invariants preserved** with contracts unchanged (AIExecutionRequest/AIExecutionResult), throw-only errors, privacy policy maintained, and comprehensive test plan (~15 new tests)

---

**END OF PHASE 20B DESIGN**
