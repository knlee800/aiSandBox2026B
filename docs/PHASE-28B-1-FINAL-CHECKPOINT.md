# PHASE 28B-1 FINAL CHECKPOINT — Launch State Enforcement

**Phase:** 28B-1 — Launch State Enforcement (Closed-by-Default)
**Nature:** IMPLEMENTATION (api-gateway ONLY)
**Scope:** Launch state enforcement without abort/rollback
**Status:** 🔒 COMPLETE and LOCKED
**Date:** 2026-02-07
**Dependencies:** Phase 28A (Launch Readiness Design), Phase 27B (Startup Validation), Phase 26B (Kill Switches), Phase 20A/20B (Auth), Phase 21B (Quota), Phase 22B (Usage Ledger)

---

## ULTRA-BRIEF SUMMARY

Phase 28B-1 implements deterministic launch-state enforcement in api-gateway, enabling phased rollout (CLOSED → INTERNAL → EARLY_ACCESS → PUBLIC) with closed-by-default posture. Launch state validated at startup (missing/invalid → crash exit 1). LaunchGuard enforces state restrictions AFTER auth/authz, BEFORE quota. API key identity extended with isInternal/isEarlyAccess flags. NO abort logic, NO rollback logic, NO billing coupling, NO ai-service changes. Test coverage: 53/53 passing (config validation, guard enforcement, startup crash behavior). System guarantees: deterministic decisions, no runtime mutation, restart required for state changes.

**Why This Enables Phase 2+:** Deterministic pre-execution filtering, phased traffic enablement, closed-by-default safety, clear upgrade path to abort controls (Phase 28B-2).

---

## PHASE OVERVIEW

Phase 28B-1 implements the launch readiness architecture defined in Phase 28A. It introduces deterministic launch-state enforcement for AI execution at the api-gateway layer, enabling a phased rollout model while preserving all existing execution, billing, and privacy invariants.

**Core Intent:**
- Enable CLOSED-by-default execution posture (explicit activation required)
- Support phased launch model (CLOSED → INTERNAL → EARLY_ACCESS → PUBLIC)
- Provide deterministic launch state enforcement (same inputs → same decision)
- Maintain fail-fast startup validation (invalid state → crash)
- Preserve all existing guard stack behaviors (auth, safety limits, quota)

**What This Phase Implements:**
- Four launch states (CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC)
- LaunchConfig for startup validation and state management
- LaunchGuard for execution-time enforcement
- API key identity flags (isInternal, isEarlyAccess)
- Startup validation integration
- Comprehensive test coverage (53 tests)

**What This Phase Does NOT Implement:**
- Abort logic or emergency stop controls
- Rollback procedures or deployment automation
- Billing or payment coupling
- Kill switch modifications
- Provider-specific behavior
- ai-service modifications
- Runtime state mutation

---

## 1. LAUNCH STATE MODEL

### 1.1 Four Launch States

Phase 28B-1 implements exactly four launch states, validated at startup:

#### CLOSED
- **Behavior:** All execution requests blocked with 403
- **Purpose:** Default state for new deployments (closed-by-default)
- **Error Message:** "AI execution is currently unavailable. Please try again later."
- **Identity Check:** No identity check needed (blocks all)

#### INTERNAL
- **Behavior:** Allow only internal/test API keys (isInternal=true)
- **Purpose:** Phase 1 of launch (internal validation, < 10 keys)
- **Error Message:** "AI execution is currently in internal testing phase"
- **Identity Check:** Requires isInternal=true

#### EARLY_ACCESS
- **Behavior:** Allow internal + early access keys (isInternal=true OR isEarlyAccess=true)
- **Purpose:** Phase 2 of launch (limited exposure, < 100 keys)
- **Error Message:** "AI execution is currently in early access phase"
- **Identity Check:** Requires isInternal=true OR isEarlyAccess=true

#### PUBLIC
- **Behavior:** Allow all authenticated and authorized API keys
- **Purpose:** Phase 3 of launch (full availability)
- **Error Message:** N/A (no restriction)
- **Identity Check:** No additional check (already authenticated)

### 1.2 State Transitions

**Configuration Method:**
```bash
# Set launch state via environment variable
export LAUNCH_STATE=CLOSED
export LAUNCH_STATE=INTERNAL
export LAUNCH_STATE=EARLY_ACCESS
export LAUNCH_STATE=PUBLIC
```

**Transition Requirements:**
- Restart required (no runtime mutation)
- Configuration change + pod restart
- No automatic transitions
- No gradual rollout within a state

**Validation Rules:**
- Missing LAUNCH_STATE → crash (exit 1)
- Invalid LAUNCH_STATE → crash (exit 1)
- Empty LAUNCH_STATE → crash (exit 1)
- No defaulting or silent fallbacks

### 1.3 Closed-by-Default Guarantee

**Enforcement Mechanism:**
- Startup validation REQUIRES explicit LAUNCH_STATE
- No default value provided
- Missing or invalid state → application fails to start
- Operators must explicitly choose a state

**Rationale:**
- Prevents accidental traffic exposure
- Forces conscious launch decision
- Aligns with Phase 28A safety principles
- Enables phased rollout with clear gates

---

## 2. IMPLEMENTATION DETAILS

### 2.1 LaunchConfig (Configuration Management)

**File:** `src/launch/launch.config.ts`

**Responsibilities:**
- Read LAUNCH_STATE from environment at startup
- Validate state is one of four allowed values
- Store state immutably (no runtime mutation)
- Provide getCurrentState() accessor
- Throw descriptive errors on invalid configuration

**API:**
```typescript
LaunchConfig.initialize()        // Called during startup
LaunchConfig.getCurrentState()   // Returns current LaunchState
LaunchConfig.isInitialized()     // Check if initialized
LaunchConfig.reset()             // Test-only: reset state
```

**Validation Logic:**
```typescript
// Missing state
if (!envValue) {
  throw new Error('STARTUP FAILURE: LAUNCH_STATE not set. Valid values: CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC');
}

// Invalid state
const validStates = ['CLOSED', 'INTERNAL', 'EARLY_ACCESS', 'PUBLIC'];
if (!validStates.includes(upperValue)) {
  throw new Error(`STARTUP FAILURE: Invalid LAUNCH_STATE="${envValue}". Valid values: ${validStates.join(', ')}`);
}
```

**Immutability Guarantee:**
- State set once at initialization
- No setters or mutation methods
- Environment variable changes do NOT affect running process
- Restart required to change state

### 2.2 LaunchGuard (Execution-Time Enforcement)

**File:** `src/launch/launch.guard.ts`

**Responsibilities:**
- Read current launch state from LaunchConfig
- Inspect API key identity (attached by ApiKeyAuthGuard)
- Enforce launch restrictions based on state + identity
- Throw 403 ForbiddenException when blocked

**Guard Stack Position:**
```
ApiKeyAuthGuard       (Phase 20A: Auth)
  ↓
AuthorizationGuard    (Phase 20B: Authz)
  ↓
ExecutionSafetyGuard  (Phase 26B: Kill switches + safety limits)
  ↓
LaunchGuard           (Phase 28B-1: Launch state)  ← NEW
  ↓
QuotaGuard            (Phase 21B: Quota)
  ↓
Controller            (Execute AI request)
```

**Enforcement Logic:**
```typescript
// PUBLIC: allow all
if (currentState === LaunchState.PUBLIC) {
  return true;
}

// CLOSED: block all (no identity check needed)
if (currentState === LaunchState.CLOSED) {
  throw new ForbiddenException('AI execution is currently unavailable. Please try again later.');
}

// Get identity (for INTERNAL and EARLY_ACCESS)
const identity = request.apiKeyIdentity;

// INTERNAL: allow only isInternal=true
if (currentState === LaunchState.INTERNAL) {
  if (identity.isInternal === true) return true;
  throw new ForbiddenException('AI execution is currently in internal testing phase');
}

// EARLY_ACCESS: allow isInternal=true OR isEarlyAccess=true
if (currentState === LaunchState.EARLY_ACCESS) {
  if (identity.isInternal === true || identity.isEarlyAccess === true) return true;
  throw new ForbiddenException('AI execution is currently in early access phase');
}
```

**Deterministic Behavior:**
- Same state + identity → same decision
- No random sampling or probabilistic logic
- No time-based variations
- No network calls or external state

### 2.3 API Key Identity Extension

**File:** `src/auth/api-key.config.ts`

**Extended Interface:**
```typescript
export interface ApiKeyIdentity {
  userId: string;
  apiKeyId: string;
  scopes: string[];              // Phase 20B: Authorization scopes
  isInternal?: boolean;          // Phase 28B-1: Internal/test key flag
  isEarlyAccess?: boolean;       // Phase 28B-1: Early access key flag
}
```

**Example API Keys:**
```typescript
[
  'test-api-key-user-1',
  {
    userId: 'user-1',
    apiKeyId: 'key-1',
    scopes: ['ai:execute'],
    isInternal: true,  // Internal test key
  },
],
[
  'test-api-key-user-2',
  {
    userId: 'user-2',
    apiKeyId: 'key-2',
    scopes: ['ai:execute'],
    isEarlyAccess: true,  // Early access key
  },
],
[
  'valid-api-key',
  {
    userId: 'test-user',
    apiKeyId: 'key-test',
    scopes: ['ai:execute'],
    // No flags: public key
  },
]
```

**Flag Semantics:**
- `isInternal=true`: Key allowed in INTERNAL state (and all higher states)
- `isEarlyAccess=true`: Key allowed in EARLY_ACCESS state (and PUBLIC)
- No flags: Key allowed only in PUBLIC state
- Flags are immutable (no runtime modification)

**Future Database Implementation:**
- Current: Static map in ApiKeyConfig
- Future: Database lookup with columns `is_internal`, `is_early_access`
- Migration path: Replace ApiKeyConfig.validateApiKey() with database query
- No changes to LaunchGuard required

### 2.4 Startup Validation Integration

**File:** `src/startup/configuration.validator.ts`

**Added Method:**
```typescript
static validateLaunchState(): void {
  try {
    LaunchConfig.initialize();
  } catch (error) {
    // Re-throw with startup failure format
    throw error;
  }
}
```

**Integration with validateAll():**
```typescript
static validateAll(): void {
  this.validateRequiredVariables();
  this.validateKillSwitches();
  this.validateSafetyLimits();
  this.validateLaunchState();  // Phase 28B-1
}
```

**Startup Sequence:**
```
1. EnvironmentValidator.validateEnvironment()
2. ConfigurationValidator.validateAll()
   - validateRequiredVariables()
   - validateKillSwitches()
   - validateSafetyLimits()
   - validateLaunchState()  ← Phase 28B-1
3. Database connectivity checks
4. Dependency validation
5. Service initialization
6. Final validation (kill switches, safety limits, launch state)
```

**File:** `src/startup/startup-guard.service.ts`

**Added Logging:**
```typescript
// Phase 6: Final Validation (Check 23.5)
try {
  const launchState = LaunchConfig.getCurrentState();
  this.logger.log(`✅ Launch state: ${launchState}`);
} catch (error) {
  throw new Error(
    '[STARTUP FAILURE] Launch state config validation failed\n' +
      `Reason: ${error.message}\n` +
      'Exit Code: 1',
  );
}
```

### 2.5 Guard Stack Integration

**File:** `src/ai/ai-execution.controller.ts`

**Updated Guard Stack:**
```typescript
@UseGuards(
  ApiKeyAuthGuard,       // Phase 20A: Authentication
  AuthorizationGuard,    // Phase 20B: Authorization
  ExecutionSafetyGuard,  // Phase 26B: Kill switches + safety limits
  LaunchGuard,           // Phase 28B-1: Launch state enforcement
  QuotaGuard             // Phase 21B: Quota
)
```

**Execution Flow:**
1. **ApiKeyAuthGuard**: Validate API key → attach identity to request
2. **AuthorizationGuard**: Check scopes (requires 'ai:execute')
3. **ExecutionSafetyGuard**: Check kill switches + global safety limits
4. **LaunchGuard**: Check launch state + identity flags ← NEW
5. **QuotaGuard**: Check quota availability
6. **Controller**: Forward to ai-service

**Error Responses:**
- 401: Missing or malformed Authorization header (ApiKeyAuthGuard)
- 403: Invalid API key (ApiKeyAuthGuard)
- 403: Insufficient permissions (AuthorizationGuard)
- 503: Kill switch disabled (ExecutionSafetyGuard)
- 429: Rate limit exceeded (ExecutionSafetyGuard)
- 403: Launch state restriction (LaunchGuard) ← NEW
- 429: Quota exceeded (QuotaGuard)
- 500+: ai-service errors (execution failure)

---

## 3. TEST COVERAGE

### 3.1 Test Summary

**Total Tests:** 53 passing
**Test Files:** 3
**Coverage Areas:**
- Launch configuration validation (18 tests)
- Launch guard enforcement (26 tests)
- Startup validation integration (9 tests)

### 3.2 LaunchConfig Tests

**File:** `src/launch/__tests__/launch.config.spec.ts` (18 tests)

**Valid Launch States (4 tests):**
- ✅ Initialize with CLOSED state
- ✅ Initialize with INTERNAL state
- ✅ Initialize with EARLY_ACCESS state
- ✅ Initialize with PUBLIC state

**Invalid Launch States (6 tests):**
- ✅ Throw on missing LAUNCH_STATE
- ✅ Throw on empty LAUNCH_STATE
- ✅ Throw on invalid state value
- ✅ Throw on partial state match
- ✅ Throw on numeric value
- ✅ Throw on boolean value

**Initialization State (4 tests):**
- ✅ Report not initialized before initialize()
- ✅ Report initialized after initialize()
- ✅ Throw when getting state before initialization
- ✅ Allow multiple getCurrentState() calls

**Reset Functionality (3 tests):**
- ✅ Reset initialization state
- ✅ Require re-initialization after reset
- ✅ Allow re-initialization with different state

**Immutability (1 test):**
- ✅ State change requires restart (reset + initialize)

### 3.3 LaunchGuard Tests

**File:** `src/launch/__tests__/launch.guard.spec.ts` (26 tests)

**PUBLIC State (3 tests):**
- ✅ Allow all authenticated keys
- ✅ Allow internal keys
- ✅ Allow early access keys

**CLOSED State (3 tests):**
- ✅ Block all keys
- ✅ Block internal keys
- ✅ Block early access keys

**INTERNAL State (5 tests):**
- ✅ Allow internal keys
- ✅ Block public keys
- ✅ Block early access keys
- ✅ Block keys with isInternal=false
- ✅ Correct error message

**EARLY_ACCESS State (5 tests):**
- ✅ Allow internal keys
- ✅ Allow early access keys
- ✅ Allow keys with both flags
- ✅ Block public keys
- ✅ Block keys with both flags false

**Missing Identity (1 test):**
- ✅ Throw if identity not attached

**Uninitialized LaunchConfig (1 test):**
- ✅ Throw if LaunchConfig not initialized

**Case Handling (8 tests):**
- ✅ Handle lowercase state values
- ✅ Handle mixed case state values
- ✅ Validate all error messages
- ✅ Verify guard order (auth before launch state)

### 3.4 Startup Validation Tests

**File:** `src/launch/__tests__/launch-startup.spec.ts` (9 tests)

**Valid Configurations (4 tests):**
- ✅ Pass with CLOSED state
- ✅ Pass with INTERNAL state
- ✅ Pass with EARLY_ACCESS state
- ✅ Pass with PUBLIC state

**Invalid Configurations (3 tests):**
- ✅ Fail with missing LAUNCH_STATE
- ✅ Fail with invalid state
- ✅ Fail with partial match

**Integration Tests (2 tests):**
- ✅ Call validateLaunchState as part of validateAll
- ✅ Fail validateAll if launch state invalid

---

## 4. FILES CREATED

### 4.1 Core Implementation

**`src/launch/launch-state.enum.ts`**
- Defines LaunchState enum (CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC)
- Documentation for each state's purpose and behavior

**`src/launch/launch.config.ts`**
- LaunchConfig class for configuration management
- Startup validation (missing/invalid → crash)
- Immutable state storage
- getCurrentState() accessor

**`src/launch/launch.guard.ts`**
- LaunchGuard class implementing CanActivate
- Enforcement logic for all four states
- Integration with API key identity

**`src/launch/launch.module.ts`**
- NestJS module providing LaunchGuard
- Exports LaunchGuard for use in AIModule

**`src/launch/index.ts`**
- Barrel export for all launch components

### 4.2 Test Files

**`src/launch/__tests__/launch.config.spec.ts`**
- 18 unit tests for LaunchConfig
- Valid/invalid state handling
- Initialization and reset behavior
- Immutability verification

**`src/launch/__tests__/launch.guard.spec.ts`**
- 26 unit tests for LaunchGuard
- All four launch states tested
- Identity flag combinations
- Error message validation

**`src/launch/__tests__/launch-startup.spec.ts`**
- 9 integration tests for startup validation
- ConfigurationValidator integration
- Crash behavior verification

---

## 5. FILES MODIFIED

### 5.1 API Key Configuration

**`src/auth/api-key.config.ts`**

**Changes:**
- Extended ApiKeyIdentity interface with optional flags:
  - `isInternal?: boolean`
  - `isEarlyAccess?: boolean`
- Updated static API keys with flags:
  - `test-api-key-user-1`: isInternal=true
  - `test-api-key-user-2`: isEarlyAccess=true
  - `valid-api-key`: no flags (public)

**Backward Compatibility:**
- Flags are optional (existing code unaffected)
- No breaking changes to ApiKeyAuthGuard
- No changes to authorization logic

### 5.2 AI Execution Controller

**`src/ai/ai-execution.controller.ts`**

**Changes:**
- Added LaunchGuard to guard stack (4th position)
- Updated controller documentation
- Updated error documentation (403 for launch state)

**Guard Order:**
```typescript
@UseGuards(
  ApiKeyAuthGuard,
  AuthorizationGuard,
  ExecutionSafetyGuard,
  LaunchGuard,      // ← NEW
  QuotaGuard
)
```

### 5.3 AI Module

**`src/ai/ai.module.ts`**

**Changes:**
- Imported LaunchModule
- Updated module documentation
- Added LaunchModule to imports array

**Module Dependencies:**
```typescript
@Module({
  imports: [
    AuthModule,
    SafetyModule,
    LaunchModule,    // ← NEW
    QuotaModule,
    UsageLedgerModule,
  ],
  // ...
})
```

### 5.4 Startup Validation

**`src/startup/configuration.validator.ts`**

**Changes:**
- Imported LaunchConfig
- Added validateLaunchState() method
- Called validateLaunchState() in validateAll()

**Validation Sequence:**
```typescript
static validateAll(): void {
  this.validateRequiredVariables();
  this.validateKillSwitches();
  this.validateSafetyLimits();
  this.validateLaunchState();  // ← NEW
}
```

**`src/startup/startup-guard.service.ts`**

**Changes:**
- Imported LaunchConfig
- Added launch state logging in phase 6 (Check 23.5)
- Consistent error format for launch state failures

---

## 6. LOCKED INVARIANTS

Phase 28B-1 preserves all existing invariants and introduces new guarantees:

### 6.1 Preserved Invariants (Unchanged)

**From Phase 18A (Execution Flow):**
- ✅ Single execution, throw-only, token-on-success
- ✅ No retries, no caching, no streaming
- ✅ Pure passthrough to ai-service

**From Phase 20A/20B (Auth):**
- ✅ API key authentication required
- ✅ Scope-based authorization required
- ✅ Identity injection preserved

**From Phase 21B (Quota):**
- ✅ Quota enforcement unchanged
- ✅ Rate limiting unchanged
- ✅ Pre-execution quota check preserved

**From Phase 22B (Usage Ledger):**
- ✅ Usage recording after success only
- ✅ Ledger write failure → execution failure
- ✅ Billing integrity preserved

**From Phase 26B (Safety):**
- ✅ Kill switch enforcement unchanged
- ✅ Global safety limits unchanged
- ✅ Provider-specific limits unchanged

**From Phase 27B (Startup):**
- ✅ 25 startup checks preserved
- ✅ Fail-fast validation preserved
- ✅ Deterministic startup behavior

### 6.2 New Invariants (Phase 28B-1)

**Launch State Validation:**
- ✅ Missing LAUNCH_STATE → crash (exit 1)
- ✅ Invalid LAUNCH_STATE → crash (exit 1)
- ✅ No default or silent fallback
- ✅ Deterministic validation

**Launch State Enforcement:**
- ✅ CLOSED blocks all execution (403)
- ✅ INTERNAL allows only isInternal=true
- ✅ EARLY_ACCESS allows isInternal=true OR isEarlyAccess=true
- ✅ PUBLIC allows all authenticated keys
- ✅ Same state + identity → same decision

**Immutability:**
- ✅ No runtime state mutation
- ✅ Restart required for state change
- ✅ Configuration read once at startup

**Guard Stack Order:**
- ✅ Launch enforcement AFTER auth/authz
- ✅ Launch enforcement BEFORE quota
- ✅ Launch enforcement deterministic

**ai-service Isolation:**
- ✅ No changes to ai-service
- ✅ No awareness of launch state
- ✅ Execution semantics unchanged

---

## 7. EXPLICIT NON-GOALS

Phase 28B-1 explicitly does NOT implement:

### 7.1 Abort and Rollback (Phase 28B-2+)

❌ **No Abort Logic:**
- No emergency stop controls
- No immediate traffic kill switches
- No abort playbooks or automation
- No abort authority model

❌ **No Rollback Logic:**
- No deployment rollback procedures
- No version revert automation
- No state recovery mechanisms
- No rollback validation

❌ **No Kill Switch Changes:**
- GLOBAL_EXECUTION_ENABLED unchanged
- Provider kill switches unchanged
- Kill switch behavior preserved from Phase 26B

### 7.2 Billing and Payment Coupling

❌ **No Billing Changes:**
- Usage ledger unchanged
- Billing snapshots unchanged
- Invoice generation unchanged
- Pricing logic unchanged

❌ **No Payment Changes:**
- Payment execution unchanged
- Payment kill switch unchanged
- Payment gateway unchanged

❌ **No Cost Tracking:**
- No launch-state-specific cost tracking
- No per-state billing rules
- No cost limits per state

### 7.3 Advanced Features

❌ **No Provider-Specific Behavior:**
- Launch state applies to all providers equally
- No per-provider launch states
- No provider fallback logic

❌ **No Network-Based Restrictions:**
- No IP-based filtering
- No geographic restrictions
- No VPN detection

❌ **No Dynamic State Transitions:**
- No automatic state changes
- No time-based transitions
- No load-based transitions

❌ **No Monitoring Integration:**
- No metrics for launch state
- No alerts for state changes
- No dashboards (future phase)

❌ **No Database Changes:**
- No schema changes
- No migrations
- No persistent state storage

---

## 8. ARCHITECTURE SNAPSHOT

### 8.1 Request Flow (Phase 28B-1)

```
Client Request
  ↓
[POST /api/ai/execute]
  ↓
ApiKeyAuthGuard (Phase 20A)
  └─ Extract API key from Authorization header
  └─ Validate against ApiKeyConfig
  └─ Attach identity to request (userId, apiKeyId, scopes, isInternal, isEarlyAccess)
  ↓
AuthorizationGuard (Phase 20B)
  └─ Check required scopes ('ai:execute')
  └─ Throw 403 if insufficient permissions
  ↓
ExecutionSafetyGuard (Phase 26B)
  └─ Check GLOBAL_EXECUTION_ENABLED
  └─ Check provider-specific kill switches
  └─ Check global safety limits (tokens, rate, daily spend)
  └─ Throw 503 if disabled or limit reached
  ↓
LaunchGuard (Phase 28B-1) ← NEW
  └─ Read current launch state (LaunchConfig)
  └─ If PUBLIC: allow all
  └─ If CLOSED: block all (403)
  └─ If INTERNAL: allow only isInternal=true (403 otherwise)
  └─ If EARLY_ACCESS: allow isInternal OR isEarlyAccess (403 otherwise)
  ↓
QuotaGuard (Phase 21B)
  └─ Check request quota (requests per minute)
  └─ Check token quota (tokens per day)
  └─ Throw 429 if quota exceeded
  ↓
AIExecutionController
  └─ Inject verified userId and apiKeyId
  └─ Forward to ai-service (AIServiceHttpClient)
  ↓
ai-service (Phase 18A)
  └─ Execute AI request (unchanged)
  └─ Return result or throw error
  ↓
AIExecutionController
  └─ Write usage record to ledger (Phase 22B)
  └─ Track execution cost (Phase 26B)
  └─ Return result to client
```

### 8.2 Startup Sequence (Phase 28B-1)

```
Application Start
  ↓
StartupGuardService.onModuleInit()
  ↓
Phase 1: Environment Detection
  └─ Validate NODE_ENV
  └─ Validate working directory
  ↓
Phase 2: Configuration Validation
  └─ validateRequiredVariables()
  └─ validateKillSwitches()
  └─ validateSafetyLimits()
  └─ validateLaunchState() ← NEW
      └─ LaunchConfig.initialize()
          └─ Read LAUNCH_STATE from env
          └─ Validate state (CLOSED|INTERNAL|EARLY_ACCESS|PUBLIC)
          └─ Throw on missing or invalid
  ↓
Phase 3: Database Connectivity
  └─ Test database connection
  └─ Verify schema and tables
  ↓
Phase 4: Dependency Validation
  └─ Validate provider credentials
  └─ Check billing database
  ↓
Phase 5: Service Initialization
  └─ Load NestJS modules
  └─ Register guards (including LaunchGuard)
  └─ Initialize repositories
  ↓
Phase 6: Final Validation
  └─ Verify kill switch config loaded
  └─ Verify safety limit config loaded
  └─ Verify launch state initialized ← NEW
      └─ LaunchConfig.getCurrentState()
      └─ Log current state
  └─ Ready to bind to port
  ↓
SUCCESS: Application ready
  └─ Log startup success
  └─ Accept traffic
```

### 8.3 State Transition Model

```
CLOSED (Default)
  └─ All traffic blocked
  └─ System operational but unavailable
  └─ Default for new deployments
  ↓
  Manual operator action:
  - Set LAUNCH_STATE=INTERNAL
  - Restart pods
  ↓
INTERNAL (Phase 1)
  └─ Internal test keys only (< 10 keys)
  └─ First-hour validation (cost < $10)
  └─ Success rate > 95%
  ↓
  Validation passed:
  - Set LAUNCH_STATE=EARLY_ACCESS
  - Restart pods
  ↓
EARLY_ACCESS (Phase 2)
  └─ Internal + early access keys (< 100 keys)
  └─ 24-hour validation (cost < $1,000)
  └─ Billing integrity verified
  ↓
  Validation passed:
  - Set LAUNCH_STATE=PUBLIC
  - Restart pods
  ↓
PUBLIC (Phase 3)
  └─ All authenticated keys allowed
  └─ Continuous monitoring
  └─ Daily spend hard cap enforced
```

---

## 9. TESTING AND VERIFICATION

### 9.1 Test Execution

**Command:**
```bash
npm test -- --testPathPattern=launch
```

**Results:**
```
Test Suites: 3 passed, 3 total
Tests:       53 passed, 53 total
Snapshots:   0 total
Time:        2.363 s
```

### 9.2 Test Coverage by Category

**Configuration Validation (18 tests):**
- Valid launch states (4 tests)
- Invalid launch states (6 tests)
- Initialization behavior (4 tests)
- Reset functionality (3 tests)
- Immutability (1 test)

**Guard Enforcement (26 tests):**
- PUBLIC state (3 tests)
- CLOSED state (3 tests)
- INTERNAL state (5 tests)
- EARLY_ACCESS state (5 tests)
- Missing identity (1 test)
- Uninitialized config (1 test)
- Case handling (8 tests)

**Startup Integration (9 tests):**
- Valid configurations (4 tests)
- Invalid configurations (3 tests)
- validateAll() integration (2 tests)

### 9.3 Manual Verification Checklist

**Startup Behavior:**
- [ ] Missing LAUNCH_STATE → crash with clear error message
- [ ] Invalid LAUNCH_STATE → crash with valid values listed
- [ ] Valid LAUNCH_STATE → startup succeeds and logs state

**CLOSED State:**
- [ ] Internal keys → 403 "AI execution is currently unavailable"
- [ ] Early access keys → 403 "AI execution is currently unavailable"
- [ ] Public keys → 403 "AI execution is currently unavailable"

**INTERNAL State:**
- [ ] Internal keys (isInternal=true) → 200 OK (execution succeeds)
- [ ] Early access keys → 403 "internal testing phase"
- [ ] Public keys → 403 "internal testing phase"

**EARLY_ACCESS State:**
- [ ] Internal keys → 200 OK
- [ ] Early access keys (isEarlyAccess=true) → 200 OK
- [ ] Public keys → 403 "early access phase"

**PUBLIC State:**
- [ ] Internal keys → 200 OK
- [ ] Early access keys → 200 OK
- [ ] Public keys → 200 OK

**Guard Order:**
- [ ] Invalid API key → 403 "Invalid API key" (not launch state message)
- [ ] Missing Authorization header → 401 (not launch state message)
- [ ] Kill switch disabled → 503 (not launch state message)

---

## 10. OPERATIONAL CONSIDERATIONS

### 10.1 Configuration Management

**Production Deployment:**
```bash
# 1. Set launch state
export LAUNCH_STATE=CLOSED

# 2. Verify other required variables
export NODE_ENV=production
export PORT=3000
export DATABASE_URL=postgresql://...
export ANTHROPIC_API_KEY=sk-ant-...
export GLOBAL_EXECUTION_ENABLED=true

# 3. Deploy
kubectl apply -f deployment.yaml

# 4. Verify startup
kubectl logs -f deployment/api-gateway
# Expected: "✅ Launch state: CLOSED"
```

**State Transition:**
```bash
# 1. Update configuration
kubectl set env deployment/api-gateway LAUNCH_STATE=INTERNAL

# 2. Restart pods (rolling restart)
kubectl rollout restart deployment/api-gateway

# 3. Wait for rollout
kubectl rollout status deployment/api-gateway

# 4. Verify new state
kubectl logs deployment/api-gateway | grep "Launch state"
# Expected: "✅ Launch state: INTERNAL"

# 5. Test execution with internal key
curl -X POST https://api.example.com/api/ai/execute \
  -H "Authorization: Bearer internal-test-key" \
  -d '{"provider": "anthropic", "messages": [...]}'
# Expected: 200 OK
```

### 10.2 Monitoring (Future Phase)

**Metrics to Track (Not Implemented in 28B-1):**
- Launch state (current value)
- Execution requests per launch state
- 403 errors by launch state
- State transition events
- Time in each state

**Alerts to Configure (Not Implemented in 28B-1):**
- Startup failure due to invalid launch state
- Unexpected state transition
- High 403 rate in PUBLIC state
- Low request rate in PUBLIC state

### 10.3 Troubleshooting

**Issue: Application fails to start**
```
Error: STARTUP FAILURE: LAUNCH_STATE environment variable not set
```
**Resolution:**
```bash
export LAUNCH_STATE=CLOSED
# Restart application
```

**Issue: Application fails to start with invalid state**
```
Error: STARTUP FAILURE: Invalid LAUNCH_STATE="PRODUCTION"
```
**Resolution:**
```bash
export LAUNCH_STATE=PUBLIC  # Use valid value
# Restart application
```

**Issue: All requests returning 403 in PUBLIC state**
```
Response: {"statusCode": 403, "message": "AI execution is currently unavailable"}
```
**Resolution:**
- Check current launch state: `kubectl logs deployment/api-gateway | grep "Launch state"`
- If state is CLOSED, transition to PUBLIC
- If state is PUBLIC, issue is not launch-related (check other guards)

**Issue: Early access users getting 403**
```
Response: {"statusCode": 403, "message": "AI execution is currently in early access phase"}
```
**Resolution:**
- Verify API key has `isEarlyAccess=true` flag
- Check launch state is EARLY_ACCESS or PUBLIC
- If PUBLIC, issue is not launch-related (check API key configuration)

---

## 11. FUTURE PHASES

### 11.1 Phase 28B-2 (Abort & Rollback)

**Planned Additions (NOT in 28B-1):**
- Emergency abort controls
- Kill switch toggle commands
- Rollback automation
- Abort playbooks
- Cost tracking integration
- Real-time abort triggers

**Requirements:**
- Phase 28B-1 complete and tested
- Abort conditions defined (Phase 28A)
- Rollback procedures documented (Phase 28A)
- Incident response team trained

### 11.2 Phase 28B-3 (Launch Verification Scripts)

**Planned Additions (NOT in 28B-1):**
- Pre-launch checklist automation
- First-hour monitoring script
- 24-hour validation script
- Cost sanity checks
- Billing integrity verification

**Requirements:**
- Phase 28B-1 complete
- Phase 28B-2 abort controls ready
- Monitoring infrastructure deployed

### 11.3 Phase 29+ (Advanced Launch Features)

**Potential Features (NOT in 28B-1):**
- Per-provider launch states
- Geographic restrictions
- API key cohort management
- Automatic state transitions (with approval gates)
- Launch metrics and dashboards
- Launch state history and audit log

---

## 12. SAFE RESUME POINT

**Phase 28B-1 Status:** 🔒 COMPLETE and LOCKED

**What is Frozen:**
- Four launch states (CLOSED, INTERNAL, EARLY_ACCESS, PUBLIC)
- LaunchConfig validation logic
- LaunchGuard enforcement logic
- API key identity flags (isInternal, isEarlyAccess)
- Startup validation integration
- Guard stack order and position
- Error messages and status codes
- Test coverage and assertions

**What May Be Extended (Future Phases):**
- Additional launch states (require design approval)
- Abort and rollback controls (Phase 28B-2)
- Launch verification scripts (Phase 28B-3)
- Monitoring and metrics (Phase 29+)
- Database-backed API key flags (future)

**Next Allowable Work:**
- Phase 28B-2: Abort & Rollback Controls (IMPLEMENTATION)
  - Emergency abort commands
  - Kill switch automation
  - Rollback procedures
  - Cost tracking integration

**Forbidden Changes (Without Reopening Phase 28B-1):**
- Modifying launch state enum values
- Changing guard stack order
- Altering enforcement logic
- Adding new identity flags without design
- Modifying startup validation sequence
- Changing error messages or status codes

---

## 13. DEPENDENCY GRAPH

**Phase 28B-1 Depends On:**
- ✅ Phase 28A: Launch Readiness Design (architecture locked)
- ✅ Phase 27B: Production Hardening (startup validation)
- ✅ Phase 26B: Kill Switches and Safety Limits (guard infrastructure)
- ✅ Phase 20A: API Key Authentication (identity management)
- ✅ Phase 20B: Scope-Based Authorization (guard stack)
- ✅ Phase 21B: Quota Enforcement (guard stack)
- ✅ Phase 22B: Usage Ledger (billing integrity)
- ✅ Phase 18A: AI Execution Flow (execution semantics)

**Phases That Depend On Phase 28B-1:**
- ⏳ Phase 28B-2: Abort & Rollback (requires launch state infrastructure)
- ⏳ Phase 28B-3: Launch Verification Scripts (requires launch state)
- ⏳ Phase 29+: Advanced Launch Features (requires base launch system)

**No Circular Dependencies:**
- Launch enforcement is additive (does not modify existing phases)
- Guard stack preserves execution semantics
- No changes to ai-service or billing

---

## 14. CRITICAL SUCCESS CRITERIA

Phase 28B-1 is considered successful if ALL criteria are met:

### 14.1 Functional Requirements

**Launch State Validation:**
- [x] Missing LAUNCH_STATE → crash (exit 1)
- [x] Invalid LAUNCH_STATE → crash (exit 1)
- [x] Valid LAUNCH_STATE → startup succeeds
- [x] State logged during startup (Phase 6)

**Launch State Enforcement:**
- [x] CLOSED blocks all execution (403)
- [x] INTERNAL allows only isInternal=true
- [x] EARLY_ACCESS allows isInternal OR isEarlyAccess
- [x] PUBLIC allows all authenticated keys
- [x] Same state + identity → same decision

**Guard Stack Integration:**
- [x] LaunchGuard executes AFTER ExecutionSafetyGuard
- [x] LaunchGuard executes BEFORE QuotaGuard
- [x] Authentication enforced before launch state
- [x] Authorization enforced before launch state

**API Key Identity:**
- [x] isInternal flag recognized
- [x] isEarlyAccess flag recognized
- [x] Flags are optional (backward compatible)
- [x] Static API keys updated with flags

### 14.2 Non-Functional Requirements

**Determinism:**
- [x] Same inputs → same outputs
- [x] No randomness or time-based logic
- [x] No network calls or external state

**Immutability:**
- [x] No runtime state mutation
- [x] Restart required for state change
- [x] Configuration read once at startup

**Performance:**
- [x] No additional network calls
- [x] No database queries
- [x] Minimal CPU overhead (simple enum check)

**Isolation:**
- [x] No changes to ai-service
- [x] No changes to billing
- [x] No changes to kill switches
- [x] No changes to safety limits

### 14.3 Test Requirements

**Test Coverage:**
- [x] 50+ tests passing
- [x] All four launch states tested
- [x] Invalid configuration tested
- [x] Guard enforcement tested
- [x] Startup validation tested

**Test Categories:**
- [x] Unit tests (config + guard)
- [x] Integration tests (startup)
- [x] Error message validation
- [x] Edge case coverage

### 14.4 Documentation Requirements

**Code Documentation:**
- [x] All files have clear headers
- [x] All methods have JSDoc comments
- [x] Error messages are descriptive
- [x] Guard order documented

**Checkpoint Documentation:**
- [x] Formal checkpoint created (this file)
- [x] Architecture snapshot included
- [x] Invariants documented
- [x] Non-goals explicit

---

## END OF PHASE 28B-1 CHECKPOINT

**Phase 28B-1 is COMPLETE and LOCKED.**

All changes in this phase are frozen and may not be modified without explicit approval to reopen Phase 28B-1.

Next phase: **Phase 28B-2 — Abort & Rollback Controls (IMPLEMENTATION)**

**Checkpoint Date:** 2026-02-07
**Checkpoint Author:** Implementation Team
**Review Status:** ✅ Complete
**Lock Status:** 🔒 Locked
