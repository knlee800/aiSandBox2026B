# PHASE 12B - STAGE C2-J DESIGN SPECIFICATION

**Groq Adapter Implementation (Design Only)**

---

## DOCUMENT TYPE

**DESIGN SPECIFICATION ONLY**

This document defines the design for Stage C2-J implementation. No code is written in this stage.

---

## STATUS

**DESIGN PHASE**

Date: 2026-02-05

---

## GOAL

Implement a Groq adapter (`GroqAdapter`) that integrates Groq's Chat Completions API into the AI execution system, following the exact architectural and behavioral patterns established in:

- **C2-H:** AnthropicAdapter implementation
- **C2-I:** OpenAIAdapter implementation
- **C2-K:** Provider configuration wiring via ConfigService

The GroqAdapter will enable the platform to use Groq's high-performance inference endpoints as an alternative AI provider.

---

## NON-GOALS

The following are **explicitly out of scope** for Stage C2-J:

### Features NOT Implemented

- ❌ Streaming responses (future enhancement)
- ❌ Function calling / tool use (future enhancement)
- ❌ Vision/image inputs (future enhancement)
- ❌ Multi-turn conversation history (adapters are stateless)
- ❌ Fine-tuned model management
- ❌ Token recording or billing logic (ADR-12B boundary preserved)
- ❌ Authentication beyond API key
- ❌ Rate limiting or quota enforcement
- ❌ Response caching
- ❌ Retry logic or circuit breakers
- ❌ Multiple API keys or key rotation
- ❌ Regional endpoint configuration
- ❌ Proxy or network configuration
- ❌ Provider failover or load balancing

### Architectural Boundaries

- ❌ No changes to AIAdapter interface (LOCKED from C2-A)
- ❌ No changes to AIExecutionRequest interface (LOCKED from C2-A)
- ❌ No changes to AIExecutionResult interface (LOCKED from C2-A)
- ❌ No changes to AIProviderConfig shape (LOCKED from C2-G)
- ❌ No changes to existing adapters (Stub, Anthropic, OpenAI) - all LOCKED
- ❌ No changes to AIExecutionService orchestration
- ❌ No changes to controller endpoints
- ❌ No changes to token recording or billing logic
- ❌ No changes to error payload structure (throw-only semantics preserved)

---

## ADAPTER RESPONSIBILITIES

### What GroqAdapter MUST Do

1. **Implement AIAdapter interface** exactly as defined in C2-A
2. **Transform requests:** Convert `AIExecutionRequest` → Groq Chat Completions API format
3. **Execute requests:** Call Groq API via official `groq-sdk` package
4. **Transform responses:** Convert Groq response → `AIExecutionResult`
5. **Extract token usage:** Parse token count from Groq response structure
6. **Handle errors:** Map Groq SDK errors → NestJS HTTP exceptions (throw-only)
7. **Validate configuration:** Fail-fast if API key is missing/empty at construction
8. **Maintain statefulness contract:** Single-turn, stateless execution only
9. **Log appropriately:** Error logging aligned with existing adapters

### What GroqAdapter MUST NOT Do

1. **DO NOT** persist, record, or bill tokens (ADR-12B boundary)
2. **DO NOT** manage conversation history (stateless adapter)
3. **DO NOT** implement retry logic or circuit breakers
4. **DO NOT** add authentication beyond API key validation
5. **DO NOT** add rate limiting or quota checks
6. **DO NOT** cache responses
7. **DO NOT** modify orchestration behavior
8. **DO NOT** expose new public APIs
9. **DO NOT** change existing adapter implementations
10. **DO NOT** violate locked interface contracts

---

## CONFIGURATION DESIGN

### Required Environment Variable

**Variable Name:** `GROQ_API_KEY`

**Source:** Environment variables via ConfigService

**Validation Rules:**
- MUST be present when `provider='groq'` is selected
- MUST NOT be undefined
- MUST NOT be empty string (`""`)
- MUST NOT be whitespace only (`"   "`)
- Validation occurs at module initialization (fail-fast)
- Clear error message: `"GROQ_API_KEY environment variable is required when provider is \"groq\""`

**Documentation Location:** `.env.example`

### Constructor Parameters

```typescript
constructor(apiKey: string, options?: {
  model?: string;           // Default: to be determined based on Groq's recommended model
  maxTokens?: number;       // Default: 4096 (aligned with Anthropic/OpenAI)
  temperature?: number;     // Default: 1.0 (aligned with Anthropic/OpenAI)
  timeout?: number;         // Optional request timeout in milliseconds
  baseURL?: string;         // Optional custom base URL (if Groq SDK supports)
})
```

### Default Configuration

**Model Selection Strategy:**
- Default model: Use Groq's current most capable general-purpose model
- Candidate models (as of design): `mixtral-8x7b-32768`, `llama2-70b-4096`, or latest recommended
- Implementation phase MUST verify Groq's current model offerings
- Model MUST support standard chat completions format

**Other Defaults:**
- `maxTokens`: `4096` (consistent with Anthropic/OpenAI adapters)
- `temperature`: `1.0` (consistent with Anthropic/OpenAI adapters)
- `timeout`: Use SDK default if not specified

### Configuration Wiring

**Factory Provider Integration:**
- Add `case 'groq'` to existing AI_ADAPTER factory provider
- Resolve `GROQ_API_KEY` via `ConfigService.get<string>('GROQ_API_KEY')`
- Validate API key presence and non-emptiness
- Instantiate `GroqAdapter(apiKey)` with resolved configuration
- Throw clear error if validation fails

**Pattern Consistency:**
- MUST follow exact pattern from C2-K (AnthropicAdapter) and C2-I (OpenAIAdapter)
- MUST use optional ConfigService injection
- MUST preserve default stub adapter behavior when no config provided
- MUST maintain fail-safe fallback to StubAIAdapter for unknown providers

---

## REQUEST MAPPING DESIGN

### AIExecutionRequest → Groq Chat Completions Format

**Input Contract (LOCKED from C2-A):**
```typescript
interface AIExecutionRequest {
  sessionId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}
```

**Groq API Request Structure (Expected):**
```typescript
{
  model: string;              // From adapter configuration
  messages: [
    {
      role: "user",           // Single-turn user message only
      content: string         // From request.prompt
    }
  ],
  max_tokens?: number;        // From adapter configuration
  temperature?: number;       // From adapter configuration
}
```

**Mapping Rules:**

1. **Model:** Use instance-level model from configuration
2. **Messages:** Create single-element array with user role
3. **Content:** Direct passthrough of `request.prompt`
4. **Role:** Always `"user"` (single-turn execution)
5. **max_tokens:** Use instance-level maxTokens configuration
6. **temperature:** Use instance-level temperature configuration

**Fields Explicitly NOT Sent:**
- `sessionId` - Not sent to Groq (session management is orchestrator responsibility)
- `conversationId` - Not sent to Groq (stateless adapter)
- `userId` - Not sent to Groq (no user tracking in adapter)
- `metadata` - Not sent to Groq (adapter-level metadata not supported)

**Justification for Single-Turn:**
- Adapter is stateless by design (established in C2-H, C2-I)
- Conversation history managed by orchestrator if needed in future
- Consistent with existing Anthropic and OpenAI adapter behavior

---

## RESPONSE MAPPING DESIGN

### Groq Response → AIExecutionResult

**Output Contract (LOCKED from C2-A):**
```typescript
interface AIExecutionResult {
  output: string;       // AI-generated text response
  tokensUsed: number;   // Total tokens consumed
  model: string;        // Model identifier that processed the request
}
```

**Expected Groq API Response Structure:**
```typescript
{
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: [
    {
      index: number;
      message: {
        role: "assistant";
        content: string;
      };
      finish_reason: string;
    }
  ];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }
}
```

**Extraction Rules:**

1. **output:** Extract from `response.choices[0].message.content`
2. **tokensUsed:** Extract from `response.usage.total_tokens`
3. **model:** Extract from `response.model` (fallback to instance model if undefined)

**Validation Rules (Malformed Response Detection):**

Must throw `InternalServerErrorException` if:
- `response.choices` is missing
- `response.choices` is empty array
- `response.choices[0]` is undefined
- `response.choices[0].message` is missing
- `response.choices[0].message.content` is missing
- `response.choices[0].message.content` is empty string
- `response.usage` is missing
- `response.usage.total_tokens` is missing
- `response.usage.total_tokens` is not a number
- `response.usage.total_tokens` is negative

**Error Message Format:**
```
"Malformed Groq response: [specific reason]"
```

Examples:
- `"Malformed Groq response: missing choices array"`
- `"Malformed Groq response: empty content"`
- `"Malformed Groq response: invalid token count"`

---

## TOKEN ACCOUNTING DESIGN

### Token Extraction Strategy

**Groq Token Usage Structure (Expected):**
```typescript
{
  usage: {
    prompt_tokens: number,      // Input tokens
    completion_tokens: number,  // Output tokens
    total_tokens: number        // Sum (authoritative source)
  }
}
```

**Primary Source:** `response.usage.total_tokens`

**Rationale:**
- Groq follows OpenAI-compatible API format
- `total_tokens` is authoritative (same as OpenAI approach in C2-I)
- No need to sum individual fields
- Simplifies extraction logic

**Validation:**
- Ensure `usage` object exists
- Ensure `total_tokens` field exists
- Ensure `total_tokens` is number type
- Ensure `total_tokens` >= 0
- Throw `InternalServerErrorException` if any validation fails

### Recording Boundary (ADR-12B Compliance)

**GroqAdapter Responsibility:**
- ✓ Extract `tokensUsed` from Groq response
- ✓ Return `tokensUsed` in `AIExecutionResult`
- ✗ **DO NOT** persist tokens to database
- ✗ **DO NOT** record tokens via token recording system
- ✗ **DO NOT** enforce billing or quotas

**AIExecutionService Responsibility:**
- Receive `AIExecutionResult` from adapter
- Record tokens via token recording system
- Handle billing and quota enforcement

**Design Principle:** Separation of concerns
- Adapter = extraction only
- Service = recording only
- Billing system = enforcement only

---

## ERROR HANDLING DESIGN

### Throw-Only Error Semantics

**Design Principle:** All errors MUST throw exceptions. No error payloads in `AIExecutionResult`.

**Rationale:**
- Consistent with AIAdapter contract (no error field in result interface)
- Aligned with AnthropicAdapter (C2-H) and OpenAIAdapter (C2-I)
- Simplifies error propagation through orchestrator
- Enables NestJS exception filters for HTTP response handling

### Error Category Mapping

| Groq Error Type | HTTP Status | NestJS Exception | Error Message |
|-----------------|-------------|------------------|---------------|
| Invalid API Key | 401 | `UnauthorizedException` | "Invalid Groq API key" |
| Invalid Request | 400 | `BadRequestException` | "Invalid request to Groq API: {details}" |
| Rate Limit Exceeded | 429 | `ServiceUnavailableException` | "Groq API rate limit exceeded" |
| Server Error | 500-599 | `InternalServerErrorException` | "Groq API server error: {status}" |
| Request Timeout | - | `ServiceUnavailableException` | "Groq API request timeout" |
| Network Error | - | `ServiceUnavailableException` | "Groq API connection error: {details}" |
| Malformed Response | - | `InternalServerErrorException` | "Malformed Groq response: {reason}" |
| Unknown Error | - | `InternalServerErrorException` | "Unexpected error during Groq API call: {message}" |

### Error Handling Implementation Pattern

**Method Signature:**
```typescript
private handleError(error: unknown): never
```

**Error Detection Logic:**

1. **Check for Groq SDK error type** (if SDK provides typed errors)
2. **Check for HTTP status code** in error object
3. **Check for timeout errors** (ETIMEDOUT, ESOCKETTIMEDOUT)
4. **Check for network errors** (ECONNREFUSED, ENOTFOUND, etc.)
5. **Default to unknown error** for unrecognized error types

**Logging:**
- Log full error object at ERROR level
- Log sanitized message at DEBUG level
- Do NOT log API keys or sensitive data

### Alignment with Existing Adapters

**Consistency Requirements:**
- ✓ Same error categories (401, 400, 429, 5xx, timeout, network)
- ✓ Same NestJS exception types
- ✓ Same throw-only semantics
- ✓ Same `handleError()` method pattern
- ✓ Same logging approach

---

## FACTORY PROVIDER INTEGRATION DESIGN

### Factory Provider Extension

**Location:** `src/ai-execution/ai-execution.module.ts`

**Current Factory Logic (Simplified):**
```typescript
{
  provide: AI_ADAPTER,
  useFactory: (
    config?: AIProviderConfig,
    configService?: ConfigService,
  ): AIAdapter => {
    const provider = config?.provider ?? 'stub';

    switch (provider) {
      case 'stub':
        return new StubAIAdapter();

      case 'anthropic':
        const anthropicKey = configService?.get<string>('ANTHROPIC_API_KEY');
        if (!anthropicKey || anthropicKey.trim().length === 0) {
          throw new Error('ANTHROPIC_API_KEY environment variable is required when provider is "anthropic"');
        }
        return new AnthropicAdapter(anthropicKey);

      case 'openai':
        const openaiKey = configService?.get<string>('OPENAI_API_KEY');
        if (!openaiKey || openaiKey.trim().length === 0) {
          throw new Error('OPENAI_API_KEY environment variable is required when provider is "openai"');
        }
        return new OpenAIAdapter(openaiKey);

      default:
        return new StubAIAdapter();
    }
  },
  inject: [
    { token: AI_PROVIDER_CONFIG, optional: true },
    { token: ConfigService, optional: true },
  ],
}
```

**New Case to Add:**
```typescript
case 'groq': {
  // C2-J: Resolve API key from ConfigService
  const groqKey = configService?.get<string>('GROQ_API_KEY');

  // Validate configuration
  if (!groqKey || groqKey.trim().length === 0) {
    throw new Error(
      'GROQ_API_KEY environment variable is required when provider is "groq"',
    );
  }

  // Instantiate adapter with resolved configuration
  return new GroqAdapter(groqKey);
}
```

**Integration Requirements:**
- Place new case before `default` case
- Follow exact validation pattern from `anthropic` and `openai` cases
- Use same error message format
- Preserve optional ConfigService injection
- Maintain default stub adapter behavior

### Module Documentation Update

**Add to module JSDoc:**
```typescript
/**
 * AIExecutionModule
 *
 * Stage C2-B: Service skeleton registered
 * Stage C2-D: Adapter interface + stub adapter wired
 * Stage C2-G: Configuration-driven adapter selection
 * Stage C2-H: Anthropic adapter integration
 * Stage C2-K: Provider configuration wiring
 * Stage C2-I: OpenAI adapter integration
 * Stage C2-J: Groq adapter integration  // <- ADD THIS LINE
 *
 * Providers:
 * - AIExecutionService (orchestration)
 * - StubAIAdapter (deterministic stub implementation)
 * - AnthropicAdapter (real Anthropic Claude integration)
 * - OpenAIAdapter (real OpenAI integration)
 * - GroqAdapter (real Groq integration)  // <- ADD THIS LINE
 * - AI_ADAPTER token binding (DI abstraction via factory)
 * - AI_PROVIDER_CONFIG token (optional configuration)
 */
```

---

## TESTING STRATEGY DESIGN

### Unit Tests for GroqAdapter

**Test File:** `src/ai-execution/adapters/__tests__/groq-ai.adapter.spec.ts`

**Test Suites:**

#### 1. Constructor Tests (8 tests)

1. ✓ Should instantiate with valid API key
2. ✓ Should throw when API key is undefined
3. ✓ Should throw when API key is empty string
4. ✓ Should throw when API key is whitespace only
5. ✓ Should use default model when not specified
6. ✓ Should use custom model when specified
7. ✓ Should use custom maxTokens when specified
8. ✓ Should use custom temperature when specified

#### 2. execute() Success Tests (6 tests)

9. ✓ Should transform AIExecutionRequest to Groq format correctly
10. ✓ Should extract text content from response.choices[0].message.content
11. ✓ Should extract token usage from response.usage.total_tokens
12. ✓ Should extract model from response.model
13. ✓ Should handle response with custom model identifier
14. ✓ Should use instance model as fallback if response.model is undefined

#### 3. execute() Error Tests (16 tests)

15. ✓ Should throw UnauthorizedException for 401 (invalid API key)
16. ✓ Should throw BadRequestException for 400 (validation error)
17. ✓ Should throw ServiceUnavailableException for 429 (rate limit)
18. ✓ Should throw InternalServerErrorException for 500 (server error)
19. ✓ Should throw ServiceUnavailableException for timeout
20. ✓ Should throw ServiceUnavailableException for network error (ECONNREFUSED)
21. ✓ Should throw InternalServerErrorException for malformed response (missing choices)
22. ✓ Should throw InternalServerErrorException for malformed response (empty choices array)
23. ✓ Should throw InternalServerErrorException for malformed response (missing content)
24. ✓ Should throw InternalServerErrorException for malformed response (empty content)
25. ✓ Should throw InternalServerErrorException for malformed response (missing usage)
26. ✓ Should throw InternalServerErrorException for malformed response (invalid token count - null)
27. ✓ Should throw InternalServerErrorException for malformed response (negative token count)
28. ✓ Should throw InternalServerErrorException for malformed response (string token count)
29. ✓ Should throw InternalServerErrorException for malformed response (missing total_tokens field)
30. ✓ Should throw InternalServerErrorException for unknown error

**Total Adapter Tests:** 30 tests (aligned with OpenAI adapter test count)

**Test Isolation Requirements:**
- Groq SDK client MUST be fully mocked
- No real network calls allowed
- Deterministic test results required
- Fast execution target: ~200ms for all adapter tests

### Module Integration Tests

**Test File:** `src/ai-execution/__tests__/ai-execution.module.spec.ts`

**New Tests to Add (5 tests):**

1. ✓ Should provide GroqAdapter when provider is "groq" with valid API key
2. ✓ Should throw error when provider is "groq" but API key is missing
3. ✓ Should throw error when provider is "groq" but API key is empty string
4. ✓ Should throw error when provider is "groq" but API key is whitespace only
5. ✓ Should throw error when GroqAdapter constructed with empty API key

**Test Implementation Pattern:**
- Direct provider injection (same as Anthropic/OpenAI tests)
- Mocked ConfigService for deterministic testing
- Factory provider logic duplicated in test
- Validates both successful instantiation and error cases

**Test Documentation Update:**
```typescript
/**
 * AIExecutionModule Tests
 *
 * Stage C2-G: Configuration-driven adapter selection
 * Stage C2-H: Anthropic adapter integration
 * Stage C2-K: Provider configuration wiring
 * Stage C2-I: OpenAI adapter integration
 * Stage C2-J: Groq adapter integration  // <- ADD THIS LINE
 *
 * Verifies:
 * - Default adapter is StubAIAdapter when no config provided
 * - Explicit stub config selects StubAIAdapter
 * - Unknown provider defaults to StubAIAdapter (fail-safe)
 * - Anthropic provider selects AnthropicAdapter with valid config
 * - Anthropic provider throws when API key is missing
 * - OpenAI provider selects OpenAIAdapter with valid config
 * - OpenAI provider throws when API key is missing
 * - Groq provider selects GroqAdapter with valid config  // <- ADD THIS LINE
 * - Groq provider throws when API key is missing  // <- ADD THIS LINE
 * - Factory provider is deterministic and testable
 */
```

### Regression Testing

**Requirement:** All existing tests MUST pass with no modifications

**Expected Test Results After C2-J Implementation:**
```
Test Suites: 4 passed, 4 total
Tests:       113 passed (78 existing + 35 new), 1 skipped, 114 total
Time:        < 3s
```

**Test Breakdown:**
- groq-ai.adapter.spec.ts: 30 tests (new)
- ai-execution.module.spec.ts: 53 tests (48 existing + 5 new)
- anthropic-ai.adapter.spec.ts: 30 tests (existing, no changes)
- openai-ai.adapter.spec.ts: 30 tests (existing, no changes)

---

## IMPLEMENTATION STAGE GATE

### Entry Criteria (Before C2-J Implementation Begins)

**Prerequisites:**
- ✓ Stage C2-I checkpoint is COMPLETE and LOCKED
- ✓ All existing tests passing (78 tests)
- ✓ This design document (C2-J-DESIGN.md) is approved
- ✓ Groq SDK package identified and version confirmed
- ✓ Groq API documentation reviewed
- ✓ Default model selected based on current Groq offerings
- ✓ Token usage response format confirmed with Groq docs

**Design Approval:**
- User/architect has reviewed this design document
- No ambiguities or unresolved questions remain
- All locked invariants are understood and respected

### Exit Criteria (Before C2-J is Marked Complete)

**Code Deliverables:**
1. ✓ `src/ai-execution/adapters/groq-ai.adapter.ts` created
2. ✓ `src/ai-execution/adapters/__tests__/groq-ai.adapter.spec.ts` created
3. ✓ `package.json` modified (groq-sdk dependency added)
4. ✓ `src/ai-execution/ai-execution.module.ts` modified (factory provider extended)
5. ✓ `src/ai-execution/__tests__/ai-execution.module.spec.ts` modified (5 tests added)
6. ✓ `.env.example` modified (GROQ_API_KEY documented)

**Test Requirements:**
- ✓ All 30 GroqAdapter unit tests passing
- ✓ All 5 new module integration tests passing
- ✓ All 78 existing tests still passing (no regressions)
- ✓ Test execution time < 3 seconds
- ✓ No real network calls in tests

**Documentation Requirements:**
- ✓ `.env.example` updated with GROQ_API_KEY
- ✓ Module JSDoc updated with C2-J stage reference
- ✓ Test suite JSDoc updated with C2-J stage reference

**Validation Requirements:**
- ✓ Service boots successfully with stub adapter (default)
- ✓ Service boots successfully with Groq adapter when configured
- ✓ Clear error message when Groq provider selected without API key
- ✓ No changes to locked files (existing adapters, interfaces, contracts)
- ✓ No breaking changes to existing functionality

**Checkpoint Requirements:**
- ✓ Create `docs/PHASE-12B-STAGE-C2-J-CHECKPOINT.md`
- ✓ Document all file changes
- ✓ Document test coverage
- ✓ Document locked invariants
- ✓ Document explicit non-goals
- ✓ Declare stage COMPLETE and LOCKED

### Stage Completion Definition

Stage C2-J is considered COMPLETE when:

1. All exit criteria above are met
2. Checkpoint document is created and reviewed
3. No open questions or ambiguities remain
4. All locked invariants are preserved
5. Stage is declared LOCKED (no further changes permitted)

---

## FILES TO BE CREATED/MODIFIED (IMPLEMENTATION PHASE)

### Files to Create (2 files)

1. **`src/ai-execution/adapters/groq-ai.adapter.ts`**
   - Purpose: GroqAdapter implementation
   - Estimated lines: ~310 lines (aligned with OpenAIAdapter)

2. **`src/ai-execution/adapters/__tests__/groq-ai.adapter.spec.ts`**
   - Purpose: GroqAdapter unit tests
   - Estimated lines: ~450 lines (aligned with OpenAIAdapter tests)

### Files to Modify (4 files)

3. **`package.json`**
   - Change: Add groq-sdk dependency
   - Lines changed: +1 line

4. **`src/ai-execution/ai-execution.module.ts`**
   - Changes:
     - Add GroqAdapter import
     - Add `case 'groq'` to factory provider
     - Update module JSDoc
   - Lines changed: ~20 lines

5. **`src/ai-execution/__tests__/ai-execution.module.spec.ts`**
   - Changes:
     - Add GroqAdapter import
     - Add 5 Groq provider configuration tests
     - Update test suite JSDoc
   - Lines changed: ~270 lines

6. **`.env.example`**
   - Change: Add GROQ_API_KEY documentation
   - Lines changed: ~5 lines

### Files Explicitly NOT Modified

The following files MUST NOT be changed:

- `src/ai-execution/ai-execution.service.ts` - LOCKED
- `src/ai-execution/adapters/anthropic-ai.adapter.ts` - LOCKED (C2-H)
- `src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` - LOCKED
- `src/ai-execution/adapters/openai-ai.adapter.ts` - LOCKED (C2-I)
- `src/ai-execution/adapters/__tests__/openai-ai.adapter.spec.ts` - LOCKED
- `src/ai-execution/adapters/stub-ai.adapter.ts` - LOCKED
- `src/ai-execution/adapters/ai-adapter.interface.ts` - LOCKED (C2-A)
- `src/ai-execution/types.ts` - LOCKED (C2-A, C2-G)
- `src/ai-execution/adapters/tokens.ts` - LOCKED
- `src/app.module.ts` - LOCKED (C2-K)

---

## DESIGN ALIGNMENT SUMMARY

### Comparison with Existing Adapters

| Aspect | AnthropicAdapter | OpenAIAdapter | GroqAdapter (Designed) |
|--------|------------------|---------------|------------------------|
| **Interface** | AIAdapter | AIAdapter | AIAdapter |
| **Constructor** | `(apiKey, options?)` | `(apiKey, options?)` | `(apiKey, options?)` |
| **SDK** | `@anthropic-ai/sdk` | `openai` | `groq-sdk` |
| **API** | Anthropic Messages API | OpenAI Chat Completions | Groq Chat Completions |
| **Default Model** | `claude-3-5-sonnet-20241022` | `gpt-4o` | TBD (Groq's recommended model) |
| **Token Extraction** | `input_tokens + output_tokens` | `usage.total_tokens` | `usage.total_tokens` |
| **Response Content** | `content[0].text` | `choices[0].message.content` | `choices[0].message.content` |
| **Error Handling** | Throw-only, NestJS exceptions | Throw-only, NestJS exceptions | Throw-only, NestJS exceptions |
| **Configuration** | `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` | `GROQ_API_KEY` |
| **Factory Case** | `case 'anthropic'` | `case 'openai'` | `case 'groq'` |
| **Stateless** | Yes | Yes | Yes |
| **Deterministic** | Yes | Yes | Yes |

### Structural Consistency

All three real adapters (Anthropic, OpenAI, Groq) maintain perfect structural alignment:

- ✓ Same constructor signature pattern
- ✓ Same request transformation approach
- ✓ Same response transformation approach
- ✓ Same error handling pattern (`handleError()` method)
- ✓ Same logging approach (error + debug levels)
- ✓ Same test structure (30 tests per adapter)
- ✓ Same factory provider integration pattern
- ✓ Same validation rules (API key presence, non-empty, non-whitespace)
- ✓ Same stateless execution model
- ✓ Same ADR-12B boundary compliance (no token recording)

### Differences from OpenAI Adapter

**API Format Similarity:**
- Groq uses OpenAI-compatible Chat Completions API format
- Request structure: identical to OpenAI
- Response structure: identical to OpenAI
- Token usage extraction: same as OpenAI (`usage.total_tokens`)

**Expected Differences:**
- SDK package name: `groq-sdk` instead of `openai`
- Base URL: Groq's API endpoint (different from OpenAI)
- Default model: Groq's model instead of `gpt-4o`
- Error types: Groq SDK error types (may differ from OpenAI SDK)

**Implementation Note:**
Due to API compatibility, GroqAdapter implementation will closely resemble OpenAIAdapter with different SDK imports and error handling specifics.

---

## DEPENDENCY MANAGEMENT

### Required Package

**Package Name:** `groq-sdk` (expected)

**Version Selection Strategy:**
- Use latest stable version available at implementation time
- Verify package exists on npm registry
- If official package name differs, use correct package name
- Document actual package name and version in checkpoint

**Alternative Packages (If Official SDK Unavailable):**
- If Groq does not provide official SDK, consider:
  - Using direct HTTP client (axios/fetch) with OpenAI-compatible format
  - Using OpenAI SDK with custom base URL (if Groq API is fully compatible)
- Design decision: Prefer official SDK if available for better error handling

**Package Installation:**
```bash
npm install groq-sdk@latest
```

**package.json Entry (Expected):**
```json
{
  "dependencies": {
    "groq-sdk": "^X.Y.Z"
  }
}
```

---

## ENVIRONMENT VARIABLE DOCUMENTATION

### .env.example Update

**Section to Add:**

```bash
# Groq API Configuration (C2-J: Groq Adapter)
# Required when AI_PROVIDER is set to "groq"
# Get your API key from: https://console.groq.com/ (or appropriate Groq console URL)
GROQ_API_KEY=gsk-your-api-key-here
```

**Placement:** After OPENAI_API_KEY section

**Documentation Notes:**
- Provide clear instructions for obtaining Groq API key
- Use example key format that matches Groq's key prefix (if applicable)
- Link to Groq's API key management page

---

## KNOWN LIMITATIONS (DESIGN PHASE)

### Assumptions Requiring Verification

The following assumptions MUST be verified during implementation phase:

1. **SDK Availability:** Groq provides official Node.js SDK
2. **API Format:** Groq API follows OpenAI-compatible Chat Completions format
3. **Token Usage:** Groq response includes `usage.total_tokens` field
4. **Model Availability:** Groq offers general-purpose chat completion models
5. **Error Types:** Groq SDK provides typed errors or HTTP status codes

### Implementation Risks

1. **SDK Package Name:** Official package name may differ from `groq-sdk`
2. **API Compatibility:** Groq API may have subtle differences from OpenAI format
3. **Token Reporting:** Groq may use different token usage field structure
4. **Default Model:** Best default model may change over time
5. **Error Handling:** SDK error types may require adapter-specific handling

### Mitigation Strategy

If assumptions are incorrect during implementation:

1. **Consult Groq API documentation** for authoritative format
2. **Adjust adapter implementation** to match actual API behavior
3. **Update this design document** if significant deviations discovered
4. **Maintain structural consistency** with Anthropic/OpenAI adapters
5. **Preserve all locked invariants** regardless of Groq-specific details

---

## DESIGN DECISIONS

### Why Groq?

**Rationale for Adding Groq Provider:**
- Groq offers high-performance LLM inference
- Groq uses OpenAI-compatible API (reduces integration complexity)
- Multiple provider options increase platform flexibility
- Aligns with multi-provider strategy established in C2-G

### Why Follow OpenAI Pattern?

**Rationale:**
- Groq API is documented as OpenAI-compatible
- Reduces implementation complexity
- Leverages lessons learned from C2-I (OpenAI adapter)
- Maintains architectural consistency

### Why Same Default Configuration?

**maxTokens: 4096, temperature: 1.0**

**Rationale:**
- Consistency across all adapters
- Predictable behavior for users
- Simplified testing and debugging
- Established in C2-H and C2-I

### Why No Streaming?

**Rationale:**
- Out of scope for initial adapter implementation (established in C2-H)
- Requires interface changes (breaks C2-A lock)
- Can be added in future enhancement stage
- Consistency with existing Anthropic/OpenAI adapters

---

## FUTURE CONSIDERATIONS

The following enhancements are explicitly deferred to future stages:

### Potential Future Enhancements (Not C2-J)

1. **Streaming Support:** Add streaming response method to all adapters
2. **Function Calling:** Extend AIExecutionRequest to support tool use
3. **Vision Support:** Extend request format to support image inputs
4. **Model Management:** Dynamic model selection based on request metadata
5. **Retry Logic:** Shared retry decorator for all adapters
6. **Response Caching:** Optional caching layer above adapter

### Cross-Adapter Improvements (Not C2-J)

1. **Shared Error Handler:** Extract common error handling logic
2. **Shared Token Validator:** Extract common token validation logic
3. **Shared Request Logger:** Extract common request/response logging
4. **Adapter Testing Utilities:** Shared test helpers for all adapters

**Note:** These enhancements are NOT part of C2-J scope and MUST NOT be implemented in this stage.

---

## DESIGN VALIDATION CHECKLIST

Before proceeding to implementation, verify:

- [ ] All locked invariants are identified and respected
- [ ] No changes to existing adapter implementations planned
- [ ] No changes to interface contracts planned
- [ ] Factory provider pattern follows C2-K exactly
- [ ] Error handling follows C2-H and C2-I exactly
- [ ] Test structure follows C2-I exactly
- [ ] Token accounting respects ADR-12B boundary
- [ ] Configuration wiring follows C2-K pattern exactly
- [ ] All explicit non-goals are documented
- [ ] All files to create/modify are listed
- [ ] Entry/exit criteria are clear and measurable
- [ ] Groq SDK package existence is verified
- [ ] Groq API format compatibility is confirmed
- [ ] Default model selection is researched
- [ ] This design document is approved by user/architect

---

## DESIGN SUMMARY

**Stage C2-J** will implement a GroqAdapter that:

1. **Conforms to AIAdapter interface** (LOCKED from C2-A)
2. **Integrates Groq Chat Completions API** via official SDK
3. **Follows exact structural pattern** of OpenAIAdapter (C2-I)
4. **Uses configuration wiring pattern** from C2-K
5. **Maintains throw-only error semantics** established in C2-H/C2-I
6. **Respects ADR-12B boundary** (no token recording in adapter)
7. **Provides comprehensive test coverage** (35 tests total)
8. **Preserves all locked invariants** from previous stages
9. **Introduces no breaking changes** to existing functionality

**Key Design Principles:**
- Structural consistency with existing adapters
- Fail-fast validation for missing configuration
- Stateless, single-turn execution only
- Clear separation of concerns (extraction vs recording)
- No changes to locked contracts or implementations

**Estimated Implementation Scope:**
- 2 new files (~760 lines total)
- 4 modified files (~296 lines added)
- 35 new tests (30 adapter + 5 module)
- 1 new dependency (groq-sdk)

---

## STAGE DECLARATION

**Stage C2-J: Groq Adapter Implementation**

**Status:** DESIGN PHASE COMPLETE

**Design Date:** 2026-02-05

**Implementation Status:** NOT STARTED

**Next Step:** User approval of this design document, then proceed to implementation phase

---

**END OF DESIGN SPECIFICATION**

This document defines the complete design for Stage C2-J. No code is written in this stage. Implementation proceeds only after design approval.
