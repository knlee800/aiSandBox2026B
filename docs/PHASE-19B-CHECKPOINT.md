# PHASE 19B CHECKPOINT: Dogfood Provider Override (xAI / DeepSeek / Groq)

**Status:** COMPLETE AND LOCKED
**Nature:** Internal Testing Infrastructure
**Version:** v1.0.0
**Date:** 2026-02-06
**Parent Phase:** Phase 19 (xAI and DeepSeek Adapter Integration)

---

## 1. Overview

### 1.1 Purpose

Phase 19B introduces dogfood-only provider overrides in ai-service to enable internal testing of real AI providers without modifying public behavior or contracts.

This stage exists purely for system owner validation and internal dogfooding.

### 1.2 Scope

**Changes:**
- Modified AI_ADAPTER factory in ai-service to check DOGFOOD_PROVIDER environment variable
- Added dogfood override logic for groq, xai, and deepseek
- Added comprehensive test coverage for override behavior

**No Changes:**
- No public API changes
- No contract modifications
- No adapter implementations changed
- No api-gateway changes
- No observability changes
- No production configuration changes

### 1.3 Implementation Summary

```
AI_ADAPTER Factory:
  1. Check DOGFOOD_PROVIDER environment variable (top of factory)
  2. If set to 'groq' / 'xai' / 'deepseek':
     - Validate required API key (GROQ_API_KEY / XAI_API_KEY / DEEPSEEK_API_KEY)
     - Throw immediately if missing, empty, or whitespace-only
     - Return corresponding adapter
  3. Otherwise:
     - Fall through to existing public provider selection logic
     - Default to StubAIAdapter
```

---

## 2. Implementation Details

### 2.1 Dogfood Override Logic

**Location:** `services/ai-service/src/ai-execution/ai-execution.module.ts`

**Implementation:**
```typescript
useFactory: (
  config?: AIProviderConfig,
  configService?: ConfigService,
): AIAdapter => {
  // DOGFOOD-ONLY: Environment variable override for internal testing
  const dogfoodProvider = process.env.DOGFOOD_PROVIDER;

  if (dogfoodProvider === 'groq') {
    const apiKey = configService?.get<string>('GROQ_API_KEY');
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'GROQ_API_KEY environment variable is required when DOGFOOD_PROVIDER=groq',
      );
    }
    return new GroqAdapter(apiKey);
  }

  if (dogfoodProvider === 'xai') {
    const apiKey = configService?.get<string>('XAI_API_KEY');
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'XAI_API_KEY environment variable is required when DOGFOOD_PROVIDER=xai',
      );
    }
    return new XAIAdapter(apiKey);
  }

  if (dogfoodProvider === 'deepseek') {
    const apiKey = configService?.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'DEEPSEEK_API_KEY environment variable is required when DOGFOOD_PROVIDER=deepseek',
      );
    }
    return new DeepSeekAdapter(apiKey);
  }

  // Fall through to existing public provider selection logic
  const provider = config?.provider ?? 'stub';
  // ... (existing switch statement unchanged)
}
```

**Characteristics:**
- ✅ Checked at very top of factory (before public provider selection)
- ✅ Strict API key validation (empty string and whitespace rejected)
- ✅ Fail-fast with clear error messages
- ✅ Zero impact when DOGFOOD_PROVIDER unset
- ✅ Falls through to existing logic when unset
- ✅ No changes to public provider selection

### 2.2 Supported Dogfood Providers

**DOGFOOD_PROVIDER=groq**
- Adapter: GroqAdapter
- Required: GROQ_API_KEY environment variable
- Model: mixtral-8x7b-32768
- Status: Existing (regression tested in Phase 19B)

**DOGFOOD_PROVIDER=xai (NEW)**
- Adapter: XAIAdapter
- Required: XAI_API_KEY environment variable
- Model: grok-beta
- Base URL: https://api.x.ai/v1
- Status: NEW in Phase 19B

**DOGFOOD_PROVIDER=deepseek (NEW)**
- Adapter: DeepSeekAdapter
- Required: DEEPSEEK_API_KEY environment variable
- Model: deepseek-chat
- Base URL: https://api.deepseek.com
- Status: NEW in Phase 19B

### 2.3 API Key Validation

**Validation Rules:**
- API key must be present (not undefined)
- API key must not be empty string (`''`)
- API key must not be whitespace-only (`'   '`)
- Validation performed via `!apiKey || apiKey.trim().length === 0`

**Error Messages:**
- Groq: `'GROQ_API_KEY environment variable is required when DOGFOOD_PROVIDER=groq'`
- xAI: `'XAI_API_KEY environment variable is required when DOGFOOD_PROVIDER=xai'`
- DeepSeek: `'DEEPSEEK_API_KEY environment variable is required when DOGFOOD_PROVIDER=deepseek'`

**Validation Timing:**
- Validation occurs during module compilation (factory execution)
- Errors thrown immediately before adapter instantiation
- Module fails to compile if validation fails

### 2.4 Default Behavior Preservation

**When DOGFOOD_PROVIDER is unset:**
- Factory falls through to existing public provider selection logic
- Default provider: StubAIAdapter
- Public provider selection unchanged (stub / anthropic / openai / groq / xai / deepseek)
- No behavior change from Phase 19A

**When DOGFOOD_PROVIDER is empty string:**
- Treated as unset (falsy value)
- Factory falls through to public provider selection
- Default provider: StubAIAdapter

---

## 3. Files Modified

### 3.1 ai-service Module (MODIFIED)

**File:** `services/ai-service/src/ai-execution/ai-execution.module.ts`

**Changes:**
- Added dogfood override logic at top of AI_ADAPTER factory
- Added conditional checks for `DOGFOOD_PROVIDER` environment variable
- Added API key validation for groq, xai, and deepseek
- No changes to existing public provider selection logic
- No changes to imports or exports

**Lines Changed:** ~28 lines added

### 3.2 Test Files (CREATED)

**File:** `services/ai-service/src/ai-execution/__tests__/ai-execution.module.dogfood.spec.ts`

**Coverage:**
- DOGFOOD_PROVIDER=xai selection and validation (4 tests)
- DOGFOOD_PROVIDER=deepseek selection and validation (4 tests)
- DOGFOOD_PROVIDER=groq regression tests (2 tests)
- Default behavior when DOGFOOD_PROVIDER unset (2 tests)

**Total:** 12 new tests

---

## 4. Test Verification

### 4.1 Dogfood Override Tests

**Test Suite:** `ai-execution.module.dogfood.spec.ts`

**DOGFOOD_PROVIDER=xai:**
- ✅ Provides XAIAdapter when DOGFOOD_PROVIDER=xai with valid API key
- ✅ Throws when DOGFOOD_PROVIDER=xai but API key missing
- ✅ Throws when DOGFOOD_PROVIDER=xai but API key empty string
- ✅ Throws when DOGFOOD_PROVIDER=xai but API key whitespace only

**DOGFOOD_PROVIDER=deepseek:**
- ✅ Provides DeepSeekAdapter when DOGFOOD_PROVIDER=deepseek with valid API key
- ✅ Throws when DOGFOOD_PROVIDER=deepseek but API key missing
- ✅ Throws when DOGFOOD_PROVIDER=deepseek but API key empty string
- ✅ Throws when DOGFOOD_PROVIDER=deepseek but API key whitespace only

**DOGFOOD_PROVIDER=groq (regression):**
- ✅ Provides GroqAdapter when DOGFOOD_PROVIDER=groq with valid API key
- ✅ Throws when DOGFOOD_PROVIDER=groq but API key missing

**Default behavior:**
- ✅ Provides StubAIAdapter when DOGFOOD_PROVIDER not set
- ✅ Provides StubAIAdapter when DOGFOOD_PROVIDER empty string

### 4.2 Test Summary

**Total Tests:** 237 (all passing)
- Existing tests: 225 (no regressions)
- New dogfood tests: 12 (all passing)

**Test Execution:**
- Unit tests: PASS
- Integration tests: PASS
- Module tests: PASS
- Adapter tests: PASS
- TypeScript build: SUCCESS

---

## 5. Locked Invariants (RE-ASSERTED)

### 5.1 Contract Preservation (Phase 12B - LOCKED)

**AIExecutionRequest:**
```typescript
export interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}
```
- ✅ Unchanged by Phase 19B

**AIExecutionResult:**
```typescript
export interface AIExecutionResult {
  output: string;
  tokensUsed: number;
  model: string;
}
```
- ✅ Unchanged by Phase 19B

**AIProviderConfig:**
```typescript
export interface AIProviderConfig {
  provider: 'stub' | 'anthropic' | 'openai' | 'groq' | 'xai' | 'deepseek';
}
```
- ✅ Unchanged by Phase 19B (dogfood override bypasses this)

### 5.2 Adapter Interface (Phase 12B - LOCKED)

**AIAdapter interface:**
```typescript
export interface AIAdapter {
  readonly model: string;
  execute(request: AIExecutionRequest): Promise<AIExecutionResult>;
}
```
- ✅ Unchanged by Phase 19B
- ✅ No new methods or properties
- ✅ All adapters implement interface exactly

### 5.3 Default Behavior (Phase 12B - LOCKED)

**StubAIAdapter remains default:**
- ✅ When DOGFOOD_PROVIDER unset → StubAIAdapter
- ✅ When AI_PROVIDER_CONFIG not provided → StubAIAdapter
- ✅ When AI_PROVIDER_CONFIG.provider = 'stub' → StubAIAdapter
- ✅ No changes to stub selection logic

### 5.4 Throw-Only Semantics (Phase 15A - LOCKED)

**Error handling unchanged:**
- ✅ Adapters throw on all failures (no error payloads)
- ✅ No try/catch in controllers
- ✅ Exceptions propagate unchanged
- ✅ HTTP status codes determined by exception type
- ✅ No error recovery or fallback

### 5.5 Token Recording (Phase 13 - LOCKED)

**Token recording behavior:**
- ✅ Adapters return tokensUsed in AIExecutionResult
- ✅ Token recording performed by AIExecutionService
- ✅ Adapters do NOT persist, record, or bill tokens
- ✅ No changes to token recording logic

### 5.6 Observability Logging (Phase 17B - LOCKED)

**Logging behavior:**
- ✅ No prompt or response logging at adapter level
- ✅ No content-derived data logging
- ✅ Observability handled by AIExecutionService
- ✅ Dogfood override adds no logging

### 5.7 Privacy Policy (Phase 15B - LOCKED)

**Privacy guarantees:**
- ✅ No prompt logging
- ✅ No response logging
- ✅ No content-derived metadata
- ✅ Dogfood override respects privacy policy

---

## 6. What Was NOT Changed

### 6.1 No Adapter Changes

**XAIAdapter (Phase 19A):**
- ✅ Implementation unchanged
- ✅ Constructor unchanged
- ✅ execute() method unchanged
- ✅ Error handling unchanged

**DeepSeekAdapter (Phase 19A):**
- ✅ Implementation unchanged
- ✅ Constructor unchanged
- ✅ execute() method unchanged
- ✅ Error handling unchanged

**GroqAdapter (Phase 12B-J):**
- ✅ Implementation unchanged
- ✅ Dogfood override was pre-existing

### 6.2 No Public Configuration Changes

**Public provider selection:**
- ✅ AI_PROVIDER_CONFIG contract unchanged
- ✅ Provider switch statement unchanged
- ✅ ConfigService usage unchanged
- ✅ API key validation for public providers unchanged

**Configuration files:**
- ✅ No .env changes
- ✅ No docker-compose changes
- ✅ No configuration modules changed

### 6.3 No api-gateway Changes

**api-gateway unchanged:**
- ✅ No controller changes
- ✅ No client changes
- ✅ No module changes
- ✅ No route changes
- ✅ No test changes

**Gateway behavior:**
- ✅ Public endpoint unchanged: POST /api/ai/execute
- ✅ Request forwarding unchanged
- ✅ Response handling unchanged
- ✅ Error propagation unchanged

### 6.4 No Service Logic Changes

**AIExecutionService unchanged:**
- ✅ No changes to execute() method
- ✅ No changes to token recording
- ✅ No changes to observability logging
- ✅ No changes to error handling

**AIExecutionController unchanged:**
- ✅ No changes to endpoints
- ✅ No changes to request handling
- ✅ No changes to response mapping

---

## 7. Architecture Snapshot (POST-PHASE-19B)

### 7.1 Dogfood Override Flow

```
AI_ADAPTER Factory Execution:
  ┌─────────────────────────────────────┐
  │ 1. Check DOGFOOD_PROVIDER env var  │
  └─────────────┬───────────────────────┘
                │
                ├─ 'groq'     → GroqAdapter(GROQ_API_KEY)
                ├─ 'xai'      → XAIAdapter(XAI_API_KEY)
                ├─ 'deepseek' → DeepSeekAdapter(DEEPSEEK_API_KEY)
                │
                ▼ (unset or empty)
  ┌─────────────────────────────────────┐
  │ 2. Check AI_PROVIDER_CONFIG         │
  └─────────────┬───────────────────────┘
                │
                ├─ 'stub'      → StubAIAdapter
                ├─ 'anthropic' → AnthropicAdapter(ANTHROPIC_API_KEY)
                ├─ 'openai'    → OpenAIAdapter(OPENAI_API_KEY)
                ├─ 'groq'      → GroqAdapter(GROQ_API_KEY)
                ├─ 'xai'       → XAIAdapter(XAI_API_KEY)
                ├─ 'deepseek'  → DeepSeekAdapter(DEEPSEEK_API_KEY)
                │
                ▼ (not provided)
  ┌─────────────────────────────────────┐
  │ 3. Default to StubAIAdapter         │
  └─────────────────────────────────────┘
```

### 7.2 Service Boundaries (UNCHANGED)

**ai-service responsibilities:**
- ✅ AI adapter selection (dogfood override + public selection)
- ✅ AI execution via adapters
- ✅ Token recording
- ✅ Observability logging
- ✅ Failure taxonomy

**api-gateway responsibilities:**
- ✅ Expose public endpoint: POST /api/ai/execute
- ✅ Forward requests to ai-service
- ✅ Propagate responses unchanged
- ✅ Propagate exceptions unchanged

**Clear boundaries:**
- ✅ api-gateway has zero AI execution logic
- ✅ ai-service has zero gateway knowledge
- ✅ Dogfood override isolated to ai-service factory
- ✅ No cross-service dogfood logic

---

## 8. Usage Guide (Internal Only)

### 8.1 Enabling Dogfood Override

**For Groq:**
```bash
export DOGFOOD_PROVIDER=groq
export GROQ_API_KEY=gsk-your-api-key-here
npm run dev
```

**For xAI (Grok):**
```bash
export DOGFOOD_PROVIDER=xai
export XAI_API_KEY=xai-your-api-key-here
npm run dev
```

**For DeepSeek:**
```bash
export DOGFOOD_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-your-api-key-here
npm run dev
```

### 8.2 Disabling Dogfood Override

**Return to stub:**
```bash
unset DOGFOOD_PROVIDER
npm run dev
```

**Verify default:**
```bash
curl -X POST http://localhost:4000/api/ai/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test",
    "conversationId": "test",
    "userId": "test",
    "prompt": "Hello"
  }'
```

**Expected (stub):**
```json
{
  "output": "Stub response for prompt: Hello",
  "tokensUsed": 0,
  "model": "stub"
}
```

### 8.3 API Key Validation Errors

**Missing API key:**
```
Error: GROQ_API_KEY environment variable is required when DOGFOOD_PROVIDER=groq
```

**Empty API key:**
```
Error: XAI_API_KEY environment variable is required when DOGFOOD_PROVIDER=xai
```

**Whitespace-only API key:**
```
Error: DEEPSEEK_API_KEY environment variable is required when DOGFOOD_PROVIDER=deepseek
```

---

## 9. Explicit Non-Goals

Phase 19B did NOT implement:

**Production Configuration:**
- ❌ No production dogfood rollout
- ❌ No feature flags
- ❌ No environment-based defaults
- ❌ No configuration files

**Public API Changes:**
- ❌ No new public provider options
- ❌ No contract modifications
- ❌ No endpoint changes
- ❌ No response format changes

**Advanced Features:**
- ❌ No retries at dogfood level
- ❌ No fallback to stub on error
- ❌ No provider rotation
- ❌ No load balancing

**Observability:**
- ❌ No dogfood-specific logging
- ❌ No metrics differentiation
- ❌ No tracing tags
- ❌ No alerting

**Billing:**
- ❌ No dogfood cost tracking
- ❌ No quota enforcement
- ❌ No rate limiting
- ❌ No usage reports

**Streaming:**
- ❌ No streaming responses
- ❌ No Server-Sent Events (SSE)
- ❌ No WebSocket support

**Validation:**
- ❌ No request validation beyond adapter
- ❌ No prompt content filtering
- ❌ No response validation

---

## 10. Rollback Plan

### 10.1 How to Revert Phase 19B

If Phase 19B must be reverted:

**Step 1: Remove dogfood override logic**
```typescript
// services/ai-service/src/ai-execution/ai-execution.module.ts
// Remove lines 64-81 (xai and deepseek dogfood checks)
// Groq dogfood check (lines 55-63) can remain or be removed
```

**Step 2: Delete dogfood test file**
```bash
rm services/ai-service/src/ai-execution/__tests__/ai-execution.module.dogfood.spec.ts
```

**Step 3: Verify rollback**
```bash
npm run build  # Should succeed
npm test       # Should pass (225 tests)
```

**Rollback Impact:**
- ✅ DOGFOOD_PROVIDER environment variable ignored
- ✅ All requests use public provider selection logic
- ✅ Default behavior: StubAIAdapter
- ✅ No data loss (stateless services)
- ✅ No database changes to revert

**Rollback Safety:**
- Non-destructive (remove 18 lines, delete 1 file)
- No downstream dependencies
- No production impact (dogfood-only feature)
- No contract changes to revert

### 10.2 Partial Rollback Options

**Keep Groq, remove xAI/DeepSeek:**
- Remove lines 64-81 only
- Keep lines 55-63 (groq dogfood check)
- Update dogfood tests accordingly

**Remove all dogfood overrides:**
- Remove lines 55-81 (all dogfood checks)
- Delete dogfood test file
- No other changes needed

---

## 11. Safe Resume Point

### 11.1 Phase 19B Completion Status

**Phase 19B is COMPLETE and LOCKED as of 2026-02-06.**

**What Was Implemented:**
- ✅ Dogfood override logic for groq, xai, deepseek
- ✅ Strict API key validation
- ✅ Comprehensive test coverage (12 new tests)
- ✅ All tests passing (237 total)
- ✅ Build succeeds without errors

### 11.2 What Remains Unchanged

**Public behavior:**
- StubAIAdapter remains default
- Public provider selection unchanged
- Contracts unchanged
- api-gateway unchanged
- No production configuration changes

**Architecture:**
- Adapter interface unchanged
- Token recording unchanged
- Observability unchanged
- Privacy policy unchanged
- Error handling unchanged

### 11.3 Future Work (NOT Part of Phase 19B)

**Future phases MAY implement:**
- Phase 20: Production provider configuration
- Phase 21: Provider selection UI
- Phase 22: Advanced features (streaming, caching)
- Phase 23: Provider analytics

**None of these are included in Phase 19B.**

---

## Declaration of Finality

### Completion Statement

**Phase 19B is COMPLETE and LOCKED as of 2026-02-06.**

### Implementation Summary

- ✅ Dogfood override logic added at top of AI_ADAPTER factory
- ✅ Support for DOGFOOD_PROVIDER=xai with XAI_API_KEY validation
- ✅ Support for DOGFOOD_PROVIDER=deepseek with DEEPSEEK_API_KEY validation
- ✅ Support for DOGFOOD_PROVIDER=groq (regression tested)
- ✅ Strict API key validation (empty/whitespace rejected)
- ✅ Stub remains default when DOGFOOD_PROVIDER unset
- ✅ Public provider selection logic unchanged
- ✅ All tests passing (237 total, 12 new)
- ✅ Zero impact on public behavior
- ✅ Fully reversible change

### Implementation Authority

This checkpoint supersedes any previous documentation regarding dogfood provider override behavior.

**Phase 19B is NOW OPERATIONALLY COMPLETE.**

---

## ULTRA-BRIEF SUMMARY

• **Dogfood-only provider override** added for groq, xai, and deepseek via DOGFOOD_PROVIDER environment variable
• **Override selected at top of factory** with strict API key validation (throws on missing/empty/whitespace)
• **Stub remains default** when DOGFOOD_PROVIDER unset; public behavior unchanged
• **All tests passing** (237 total: 225 existing + 12 new dogfood tests)
• **Fully reversible** internal-only change with zero production impact

---

**END OF PHASE 19B CHECKPOINT**
