# PRIVATE-BETA-FUNCTIONAL-READINESS-04A — Anthropic Model Configuration Hardening

**Task ID:** PRIVATE-BETA-FUNCTIONAL-READINESS-04A
**Type:** Bounded source hardening — Anthropic model configuration
**Status:** ACTIVE — Step 1 COMPLETE (registration + implementation plan) — 2026-08-06
**Parent:** PRIVATE-BETA-FUNCTIONAL-READINESS-04 (ACTIVE — Step 3a BLOCKED pending FR-04A)
**Author:** Cursor / Grok
**Date:** 2026-08-06

---

## 1. Context

FR-04 readiness review found that `AnthropicAdapter` hardcodes:

```text
claude-3-5-sonnet-20241022
```

There is no environment-variable model override. FR-04 runtime execution (Step 3a onward) remains blocked. AI execution remains disabled on staging.

This task registers and plans a bounded source change only. This registration step does **not** change source, staging, PM2, environment files, provider credentials, or AI enablement.

---

## 2. Source Review Findings

### 2.1 Exact adapter and configuration files

| Role | Path |
|---|---|
| Adapter with hardcoded default model | `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` |
| Adapter factory / ConfigService wiring | `services/ai-service/src/ai-execution/ai-execution.service.ts` (`getAdapter` case `'anthropic'`) |
| Existing Anthropic unit tests | `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` |
| Existing adapter selection / fail-fast tests | `services/ai-service/src/ai-execution/__tests__/ai-execution.phase30c.spec.ts` |
| Related Phase 16 taxonomy tests (may assert model string) | `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-adapter-phase16.spec.ts` |

Confirmed source:

- `AnthropicAdapter` defines `private readonly defaultModel = 'claude-3-5-sonnet-20241022'`
- Constructor sets `this.model = options?.model ?? this.defaultModel`
- `AIExecutionService.getAdapter('anthropic')` reads only `ANTHROPIC_API_KEY` and calls `new AnthropicAdapter(apiKey)` — **no model env read**
- Request-level `request.model` can still override per execution after construction; FR-04 smoke does not rely on that path

### 2.2 Existing ConfigService and validation patterns

`AIExecutionService` already injects NestJS `ConfigService` and fail-fast validates provider API keys:

```text
const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
if (!apiKey || apiKey.trim().length === 0) {
  throw new Error(
    'ANTHROPIC_API_KEY environment variable is required when provider is "anthropic"',
  );
}
return new AnthropicAdapter(apiKey);
```

FR-04A must mirror that pattern for the model setting.

`ProviderValidator` in api-gateway validates `AI_PROVIDER` + provider API key at gateway startup. It does **not** construct `AnthropicAdapter` and does **not** need `ANTHROPIC_MODEL` for current startup validation. Model configuration belongs in **ai-service**.

### 2.3 Configuration key name

**Selected key:** `ANTHROPIC_MODEL`

Rationale:

- Aligns with existing `ANTHROPIC_API_KEY`
- Provider-scoped (not a generic `AI_MODEL`)
- Matches the FR-04 finding that no `ANTHROPIC_MODEL` / `AI_MODEL` override exists today

### 2.4 Safe behavior when the value is missing

| Mode | Behavior |
|---|---|
| Execution-disabled / stub mode (`provider === 'stub'`) | `AnthropicAdapter` is never constructed. Missing `ANTHROPIC_MODEL` is safe and must not affect stub startup or health-only staging posture. |
| Execution-enabled Anthropic mode (`provider === 'anthropic'`) | `getAdapter('anthropic')` must fail fast with a clear error if `ANTHROPIC_MODEL` is missing, empty, or whitespace-only. Do not fall back to the deprecated hardcoded model. |

### 2.5 Code default decision

**Selected: no replacement hardcoded model default.**

Anthropic mode must fail clearly without an explicit model.

Rules for implementation:

1. Do **not** select or hardcode a replacement official Anthropic model ID in this task.
2. Remove production reliance on `claude-3-5-sonnet-20241022` as an implicit default.
3. Require an explicit non-empty trimmed model string when constructing `AnthropicAdapter` for provider `anthropic`.
4. Keith (or a later approved FR-04 / staging config step) supplies the verified current Anthropic model ID via `ANTHROPIC_MODEL` — only after independent verification outside this registration.

---

## 3. Bounded Implementation Scope (Step 2)

### 3.1 Exact implementation files (proposed)

**Must change:**

1. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\anthropic-ai.adapter.ts`
2. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\ai-execution.service.ts`
3. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\__tests__\anthropic-ai.adapter.spec.ts`
4. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\__tests__\ai-execution.phase30c.spec.ts`

**Likely update if assertions break:**

5. `C:\Users\knlee\aiSandBox2026B\services\ai-service\src\ai-execution\adapters\__tests__\anthropic-adapter-phase16.spec.ts`

**Example environment documentation updates (implementation step, not staging mutation):**

6. `C:\Users\knlee\aiSandBox2026B\.env.example`
7. `C:\Users\knlee\aiSandBox2026B\services\ai-service\.env.example`

Optional note-only (no startup requirement unless separately approved):

8. `C:\Users\knlee\aiSandBox2026B\services\api-gateway\.env.example` — may document that model is ai-service-owned; api-gateway does not call Anthropic with a model ID today

### 3.2 Intended behavior

1. Read `ANTHROPIC_MODEL` via `ConfigService` inside `getAdapter('anthropic')`.
2. Fail fast if missing / empty / whitespace-only, with a clear message naming `ANTHROPIC_MODEL`.
3. Pass validated model into `new AnthropicAdapter(apiKey, { model })`.
4. Adapter constructor requires a non-empty trimmed `options.model` (or equivalent fail-fast) — no deprecated code default fallback.
5. Preserve request-level `request.model` override behavior already present in `execute()`.
6. Preserve stub / other provider paths unchanged.
7. Do not enable AI execution, touch staging, change PM2, set credentials, or call Anthropic APIs.

### 3.3 Validation rules for `ANTHROPIC_MODEL`

Minimum safe validation (implementation):

- Required when provider is `anthropic`
- Must be a non-empty string after trim
- Reject empty / whitespace-only
- Do **not** maintain an allowlist of Anthropic model IDs in this slice (would go stale and requires independent verification)
- Do **not** invent a replacement default model ID

### 3.4 Tests required

| Case | Expected |
|---|---|
| Configured valid `ANTHROPIC_MODEL` | `getAdapter('anthropic')` constructs adapter with that model |
| Missing `ANTHROPIC_MODEL` | Fail fast with clear `ANTHROPIC_MODEL ... required` error |
| Empty string | Fail fast |
| Whitespace-only | Fail fast |
| Adapter constructor without model / with empty model | Fail fast (after removing hardcoded default fallback) |
| Adapter constructor with explicit model | Uses provided model |
| Stub provider | Unaffected; no `ANTHROPIC_MODEL` required |
| Existing Anthropic API-key missing tests | Remain valid and pass |

Update any existing tests that currently assert the hardcoded default `claude-3-5-sonnet-20241022` as the implicit constructor default.

### 3.5 Out of scope

- Staging / PM2 / runtime / SSH changes
- Enabling `GLOBAL_EXECUTION_ENABLED`
- Setting or rotating provider credentials
- Anthropic API calls
- Selecting/verifying a replacement official Anthropic model ID
- OpenAI / Groq / xAI / DeepSeek model env hardening
- api-gateway `ProviderValidator` model validation (not required for this bounded slice)
- Billing/invoice fixture model strings outside ai-service adapter path
- FR-04 Step 3a/3b/3c execution
- User invitations / PRIVATE-BETA-INVITE-01
- Locked checkpoint edits

---

## 4. Three-Step Workflow

1. **Registration / planning** — COMPLETE (this document + TASKS / backlog / roadmap updates) — 2026-08-06
2. **Source implementation + focused validation** — NEXT / NOT STARTED
3. **Consolidation / checkpoint** — NOT STARTED

After FR-04A COMPLETE and LOCKED, FR-04 Step 3a may be reconsidered only under separate approval. Until then, FR-04 Step 3a remains **BLOCKED**.

---

## 5. Validation Commands (implementation step only)

PowerShell, full paths:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- --testPathPattern="anthropic-ai.adapter|anthropic-adapter-phase16|ai-execution.phase30c"
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build
```

If broader adapter selection regressions are suspected after local edits:

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- --testPathPattern="ai-execution"
```

Do **not** run these during registration. Do **not** start services, touch staging, or enable AI execution for FR-04A validation.

---

## 6. Parent FR-04 Impact

- FR-04 remains ACTIVE.
- FR-04 Step 1 remains COMPLETE.
- FR-04 Steps 2–4 remain NOT STARTED.
- **FR-04 Step 3a remains BLOCKED pending FR-04A completion.**
- Hardcoded deprecated model must not be treated as a safe staging smoke target.
- AI execution remains disabled.
- PRIVATE-BETA-INVITE-01 remains NOT REGISTERED.

---

## 7. Single Next Action

**PRIVATE-BETA-FUNCTIONAL-READINESS-04A Step 2 — Source implementation and focused validation** for `ANTHROPIC_MODEL` wiring, fail-fast validation, adapter default removal, and focused tests. No staging or AI enablement in that step.

---

## 8. Registration Confirmation

This registration step:

- Changed only approved governance/plan files
- Did not change production/source implementation files
- Did not change staging, PM2, runtime, environment values, or provider credentials
- Did not enable AI execution
- Did not make Anthropic API calls
- Did not invite users
- Did not modify locked checkpoints
- Did not perform Git actions
