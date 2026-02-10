# PHASE 20B CHECKPOINT: Scope-Based Authorization Implementation

**Status:** COMPLETE AND LOCKED
**Nature:** Authorization Enforcement (api-gateway only)
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 20 (Authentication & Access Control)
**Prerequisite:** Phase 20A (API Key Authentication) COMPLETE

---

## 1. Overview

### 1.1 Purpose

Phase 20B implements scope-based authorization enforcement at the api-gateway boundary, building on Phase 20A's authentication foundation. After identity is verified, authorization checks ensure the authenticated API key has the required permission scope (`ai:execute`) to perform the requested operation.

### 1.2 Scope

**Changes (api-gateway only):**
- Extended ApiKeyIdentity interface with `scopes: string[]`
- Extended static API key configuration with scopes
- Created AuthorizationGuard for scope validation
- Created @RequireScope decorator for route metadata
- Applied guards to AIExecutionController
- Comprehensive test coverage (10 new tests)

**No Changes (ai-service):**
- ai-service remains completely unchanged
- No authorization logic in ai-service
- ai-service trusts verified identity from api-gateway
- No changes to AIExecutionService
- No changes to adapters
- No changes to contracts

### 1.3 Implementation Summary

```
Authorization Flow:
  1. Client sends request with Authorization: Bearer <api-key>
  2. api-gateway: ApiKeyAuthGuard validates API key (Phase 20A)
  3. api-gateway: Resolves API key → userId, apiKeyId, scopes
  4. api-gateway: AuthorizationGuard validates scopes (Phase 20B)
  5. api-gateway: Checks 'ai:execute' ∈ scopes
  6. If missing → throw ForbiddenException (403)
  7. api-gateway: Replaces userId, injects apiKeyId (Phase 20A)
  8. api-gateway → ai-service: Forwards verified request
  9. ai-service: Trusts userId, executes request
```

---

## 2. What Was Implemented

### 2.1 Extended API Key Configuration

**File Modified:** `services/api-gateway/src/auth/api-key.config.ts`

**Interface Extension:**
```typescript
export interface ApiKeyIdentity {
  userId: string;
  apiKeyId: string;
  scopes: string[];  // NEW in Phase 20B
}
```

**Extended Registry:**
```typescript
private static readonly API_KEYS: Map<string, ApiKeyIdentity> = new Map([
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
- No breaking changes to existing authenticated users
- Authorization checks pass for all Phase 20A keys

### 2.2 Authorization Guard

**File Created:** `services/api-gateway/src/auth/authorization.guard.ts`

**Implementation:**
- NestJS CanActivate guard
- Reads required scopes from route metadata
- Reads granted scopes from ApiKeyIdentity
- Validates all required scopes are granted (AND logic)
- Throws ForbiddenException if insufficient permissions

**Validation Logic:**
```typescript
canActivate(context: ExecutionContext): boolean {
  // 1. Read required scopes from @RequireScope decorator
  const requiredScopes = this.reflector.get<string[]>(
    'REQUIRED_SCOPES',
    context.getHandler(),
  );

  // 2. No scopes required → allow
  if (!requiredScopes || requiredScopes.length === 0) {
    return true;
  }

  // 3. Get verified identity (attached by ApiKeyAuthGuard)
  const identity = request.apiKeyIdentity as ApiKeyIdentity;

  // 4. Check: all required scopes ∈ granted scopes
  const hasPermission = requiredScopes.every(scope =>
    identity.scopes.includes(scope)
  );

  // 5. Deny if insufficient permissions
  if (!hasPermission) {
    throw new ForbiddenException('Insufficient permissions');
  }

  return true;
}
```

**Characteristics:**
- ✅ Fail-fast (throws immediately)
- ✅ Stateless (no caching)
- ✅ Deterministic (same inputs → same decision)
- ✅ No retries
- ✅ No credential logging

### 2.3 Scope Declaration Decorator

**File Created:** `services/api-gateway/src/auth/decorators/require-scope.decorator.ts`

**Implementation:**
```typescript
export const RequireScope = (scope: string) =>
  SetMetadata('REQUIRED_SCOPES', [scope]);

export const RequireScopes = (scopes: string[]) =>
  SetMetadata('REQUIRED_SCOPES', scopes);
```

**Usage:**
```typescript
@RequireScope('ai:execute')  // Single scope
@Post('execute')
async execute(...) { }
```

### 2.4 Controller Wiring

**File Modified:** `services/api-gateway/src/ai/ai-execution.controller.ts`

**Changes:**
```typescript
@Post('execute')
@HttpCode(HttpStatus.OK)
@UseGuards(ApiKeyAuthGuard, AuthorizationGuard)  // CHAIN: auth then authz
@RequireScope('ai:execute')  // REQUIRED SCOPE
async execute(
  @Body() request: AIExecutionRequest,
  @AuthenticatedUser() identity: ApiKeyIdentity,
): Promise<AIExecutionResult> {
  // Identity injection unchanged from Phase 20A
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

**Guard Execution Order:**
1. ApiKeyAuthGuard runs first (Phase 20A)
2. AuthorizationGuard runs second (Phase 20B)
3. Controller executes if both pass

### 2.5 Module Configuration

**File Modified:** `services/api-gateway/src/auth/auth.module.ts`

**Changes:**
```typescript
@Module({
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyAuthGuard,      // Phase 20A
    AuthorizationGuard,   // Phase 20B (NEW)
  ],
  exports: [
    AuthService,
    ApiKeyAuthGuard,      // Phase 20A
    AuthorizationGuard,   // Phase 20B (NEW)
  ],
})
export class AuthModule {}
```

---

## 3. Authorization Flow

### 3.1 Successful Authorization

```
1. Client Request:
   POST /api/ai/execute
   Authorization: Bearer valid-api-key
   Body: { "sessionId": "...", "userId": "...", "prompt": "..." }

2. api-gateway (ApiKeyAuthGuard):
   ┌─────────────────────────────────────┐
   │ Validate API key                    │
   │ Resolve identity:                   │
   │   userId: "test-user"               │
   │   apiKeyId: "key-test"              │
   │   scopes: ["ai:execute"]            │
   │ Attach identity to request          │
   └─────────────┬───────────────────────┘
                 ↓ PASS (authenticated)

3. api-gateway (AuthorizationGuard):
   ┌─────────────────────────────────────┐
   │ Read required: ["ai:execute"]       │
   │ Read granted: ["ai:execute"]        │
   │ Check: "ai:execute" ∈ granted ✓     │
   │ Return true (allow)                 │
   └─────────────┬───────────────────────┘
                 ↓ PASS (authorized)

4. api-gateway (Controller):
   ┌─────────────────────────────────────┐
   │ Replace userId with verified userId │
   │ Inject apiKeyId into metadata       │
   │ Forward to ai-service               │
   └─────────────┬───────────────────────┘
                 ↓

5. ai-service:
   Executes request normally (trusts identity)

6. Client Response:
   200 OK { "output": "...", "tokensUsed": 100, "model": "stub" }
```

### 3.2 Failed Authorization (Insufficient Permissions)

```
1. Client Request:
   POST /api/ai/execute
   Authorization: Bearer api-key-without-scope
   Body: { ... }

2. api-gateway (ApiKeyAuthGuard):
   ┌─────────────────────────────────────┐
   │ Validate API key ✓                  │
   │ Resolve identity:                   │
   │   userId: "restricted-user"         │
   │   apiKeyId: "key-restricted"        │
   │   scopes: []  ← NO SCOPES           │
   │ Attach identity to request          │
   └─────────────┬───────────────────────┘
                 ↓ PASS (authenticated)

3. api-gateway (AuthorizationGuard):
   ┌─────────────────────────────────────┐
   │ Read required: ["ai:execute"]       │
   │ Read granted: []                    │
   │ Check: "ai:execute" ∈ [] ✗          │
   │ Throw ForbiddenException            │
   └─────────────────────────────────────┘

4. Client Response:
   403 Forbidden
   {
     "statusCode": 403,
     "message": "Insufficient permissions",
     "error": "Forbidden"
   }

   Controller: NEVER CALLED
   ai-service: NEVER CALLED
```

### 3.3 Failed Authentication (Still 401)

```
1. Client Request:
   POST /api/ai/execute
   Authorization: Bearer invalid-api-key
   Body: { ... }

2. api-gateway (ApiKeyAuthGuard):
   ┌─────────────────────────────────────┐
   │ Validate API key                    │
   │ Key not found in registry           │
   │ Throw ForbiddenException (401)      │
   └─────────────────────────────────────┘

3. Client Response:
   401 Unauthorized (Phase 20A behavior unchanged)

   AuthorizationGuard: NEVER CALLED
   Controller: NEVER CALLED
   ai-service: NEVER CALLED
```

---

## 4. Error Semantics

### 4.1 Authorization Error (403 Forbidden)

**Status Code:** 403 Forbidden

**Trigger:** Valid API key, but missing required scope

**Error Response:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**Characteristics:**
- ✅ Generic message (no scope details leaked)
- ✅ Fail-fast (no retries)
- ✅ Deterministic (same key → same result)
- ✅ No credential values in error

### 4.2 Error Code Taxonomy

**401 Unauthorized (Phase 20A):**
- Missing Authorization header
- Malformed Authorization header
- Invalid API key

**403 Forbidden (Phase 20B):**
- Valid API key
- Missing required scope

**Clear Distinction:**
- 401 = authentication failure (invalid/missing credentials)
- 403 = authorization failure (valid credentials, insufficient permissions)

### 4.3 Throw-Only Semantics (Maintained)

**Phase 20B Maintains Deterministic Behavior:**
- ✅ Authorization failures throw immediately (no retries)
- ✅ No error payloads in success responses
- ✅ No partial success states
- ✅ Same request → same result

---

## 5. Files Modified / Created

### 5.1 New Files (Created)

**Authorization Logic:**
- `services/api-gateway/src/auth/authorization.guard.ts` (85 lines)
- `services/api-gateway/src/auth/decorators/require-scope.decorator.ts` (35 lines)

**Test Files:**
- `services/api-gateway/src/auth/__tests__/authorization.guard.spec.ts` (165 lines)

**Total New Code:** ~285 lines

### 5.2 Modified Files

**Configuration (api-gateway):**
- `services/api-gateway/src/auth/api-key.config.ts`
  - Added `scopes: string[]` to ApiKeyIdentity interface
  - Added scopes to all API keys in registry
  - ~10 lines modified

**Controller (api-gateway):**
- `services/api-gateway/src/ai/ai-execution.controller.ts`
  - Added AuthorizationGuard to @UseGuards
  - Added @RequireScope('ai:execute') decorator
  - Updated documentation
  - ~8 lines modified

**Module (api-gateway):**
- `services/api-gateway/src/auth/auth.module.ts`
  - Added AuthorizationGuard to providers and exports
  - ~3 lines modified

**Tests (api-gateway):**
- `services/api-gateway/src/auth/__tests__/api-key.config.spec.ts`
  - Added scope assertions to existing tests
  - ~6 lines modified

- `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts`
  - Added scope assertions to existing tests
  - ~6 lines modified

- `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts`
  - Added scopes to identity objects
  - Added 3 new authorization test cases
  - ~50 lines modified/added

- `services/api-gateway/src/ai/ai-execution.controller.spec.ts`
  - Added scopes to identity objects
  - ~8 lines modified

**Total Modified Code:** ~91 lines

### 5.3 No Changes (ai-service)

**ai-service files UNCHANGED:**
- ✅ services/ai-service/src/ai-execution/ai-execution.controller.ts
- ✅ services/ai-service/src/ai-execution/ai-execution.service.ts
- ✅ services/ai-service/src/ai-execution/adapters/* (all adapters)
- ✅ All other ai-service files

**ai-service behavior UNCHANGED:**
- ✅ Trusts userId from api-gateway
- ✅ No authentication logic
- ✅ No authorization logic
- ✅ Execution flow unchanged
- ✅ Token recording unchanged

---

## 6. Test Coverage Summary

### 6.1 New Unit Tests (AuthorizationGuard)

**Test Cases (10 new tests):**
1. ✅ Allow when no scopes required
2. ✅ Allow when required scope is granted
3. ✅ Deny when required scope is missing (403)
4. ✅ Deny when scopes array is empty (403)
5. ✅ Allow when multiple required scopes are all granted
6. ✅ Deny when one of multiple required scopes is missing (403)
7. ✅ Deny when identity is missing (403)
8. ✅ Allow when empty scopes array is required
9. ✅ Deterministic behavior (same input → same result)
10. ✅ Handle undefined scopes as empty array

**File:** `services/api-gateway/src/auth/__tests__/authorization.guard.spec.ts`

### 6.2 Updated Integration Tests

**Test Cases (3 new tests):**
1. ✅ Execute successfully with ai:execute scope
2. ✅ Verify scopes are not forwarded to ai-service
3. ✅ Maintain backward compatibility with Phase 20A keys

**Updated existing tests (6 tests):**
- All identity objects now include `scopes: ['ai:execute']`
- All tests still pass (backward compatibility verified)

**File:** `services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts`

### 6.3 Test Summary

**Total Tests:** 47 (all passing)
- AuthorizationGuard tests: 10 (new)
- Updated auth tests: 6 (modified to include scopes)
- Updated integration tests: 9 (modified to include scopes)
- Existing tests: 22 (unchanged, still passing)

**Test Execution:**
- All tests: PASS (47/47)
- TypeScript compilation: SUCCESS (Phase 20B files)
- No regressions from Phase 20A

**Test Coverage:**
- Authorization success path: ✅
- Authorization failure path (403): ✅
- Guard execution order: ✅
- Scope validation logic: ✅
- Deterministic behavior: ✅
- Backward compatibility: ✅

---

## 7. Locked Invariants (Re-Asserted)

### 7.1 Contracts (Phase 12B - LOCKED)

**AIExecutionRequest (Unchanged by Phase 20B):**
```typescript
export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;  // Verified by Phase 20A
  prompt: string;
  metadata?: Record<string, unknown>;  // apiKeyId from Phase 20A
  // NO scopes field (not forwarded)
}
```

**AIExecutionResult (Unchanged by Phase 20B):**
```typescript
export interface AIExecutionResult {
  output: string;
  tokensUsed: number;
  model: string;
  // NO authorization metadata
}
```

### 7.2 ai-service Remains Trusting (Phase 12B - LOCKED)

**ai-service behavior:**
- ✅ Trusts userId from api-gateway (Phase 20A)
- ✅ No authentication logic (Phase 20A)
- ✅ No authorization logic (Phase 20B)
- ✅ No scope validation
- ✅ Stateless execution maintained

**Service boundary:**
- ✅ api-gateway: Authentication (20A) + Authorization (20B)
- ✅ ai-service: Trusting execution
- ✅ Clear separation maintained

### 7.3 Throw-Only Errors (Phase 15A - LOCKED)

**Error handling unchanged:**
- ✅ Authorization failures throw (403)
- ✅ No error payloads in success responses
- ✅ No partial success states

**Error types:**
- 401 Unauthorized (Phase 20A)
- 403 Forbidden (Phase 20B)
- 400/500/503 (Phase 15A execution errors)

### 7.4 Token Recording (Phase 13 - LOCKED)

**Token recording behavior:**
- ✅ Tokens recorded on success only
- ✅ No token recording on authorization failure (Phase 20B)
- ✅ Token recording logic unchanged

### 7.5 Privacy Policy (Phase 15B - LOCKED)

**Privacy guarantees maintained:**
- ✅ No prompt logging
- ✅ No response logging
- ✅ No API key logging
- ✅ Authorization decisions logged (boolean only)

### 7.6 Execution Determinism (Phase 15A - LOCKED)

**Deterministic execution maintained:**
- ✅ Same API key + same request → same authentication result (20A)
- ✅ Same API key + same request → same authorization result (20B)
- ✅ Same verified request → same execution result (15A)
- ✅ No probabilistic failures
- ✅ No retries

---

## 8. Status Declaration

### 8.1 Completion Statement

**Phase 20B is COMPLETE and LOCKED as of 2026-02-06.**

### 8.2 Implementation Summary

**Authorization Enforcement:**
- ✅ Scope-based authorization at api-gateway
- ✅ Single scope defined: `ai:execute`
- ✅ All existing API keys granted `ai:execute` scope
- ✅ Missing scope → 403 Forbidden
- ✅ Fail-fast, stateless, deterministic

**Service Boundaries:**
- ✅ api-gateway: Authentication (20A) + Authorization (20B)
- ✅ ai-service: Trusting execution (unchanged)
- ✅ Clear separation maintained

**Testing:**
- ✅ 47 tests passing (10 new, 37 updated/existing)
- ✅ Comprehensive coverage
- ✅ No regressions
- ✅ TypeScript compilation successful

**Locked Invariants:**
- ✅ AIExecutionRequest/AIExecutionResult unchanged
- ✅ Throw-only error semantics preserved
- ✅ ai-service remains trusting and unchanged
- ✅ Token recording unchanged
- ✅ Privacy policy maintained
- ✅ Execution determinism maintained

---

## ULTRA-BRIEF SUMMARY

• **Scope-based authorization enforced** at api-gateway with single scope `ai:execute` granted to all API keys by default (backward compatible with Phase 20A)
• **AuthorizationGuard validates** required scopes after authentication with 403 Forbidden for insufficient permissions (fail-fast, deterministic, no retries)
• **All existing API keys** granted `ai:execute` scope in static config (no database required, no breaking changes)
• **ai-service completely unchanged** with no authorization logic added (trusts verified identity from api-gateway, clear service boundary maintained)
• **47 tests passing** with 10 new authorization tests added, all invariants preserved (contracts unchanged, throw-only errors, privacy policy maintained)

---

**END OF PHASE 20B CHECKPOINT**
