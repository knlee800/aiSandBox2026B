# AGENT-HARNESS-01C Checkpoint

**Task ID:** AGENT-HARNESS-01C
**Title:** Model Profile Registry
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Depends on:** AGENT-HARNESS-00 COMPLETE and LOCKED; AGENT-HARNESS-01A COMPLETE and LOCKED; AGENT-HARNESS-01B COMPLETE and LOCKED
**Date completed:** 2026-06-19

---

## Problem Summary

AGENT-HARNESS-01A fixed per-request model propagation, and AGENT-HARNESS-01B added versioned Agent Harness v1 contracts and config defaults. The next foundation required was a model profile registry so future Agent Harness slices can describe model capabilities, provider mapping, tool support, streaming support, context limits, cost tier, and default behavior without scattering hardcoded model names or model behavior across WorkerProcessor, AIExecutionService, or provider adapters.

---

## Objective Summary

Create a typed Model Profile Registry foundation for Agent Harness v1. This slice defines model profiles as config/registry data only. It does not change current runtime routing behavior.

---

## Implementation Summary

This slice was strictly data/config-only. No runtime wiring was performed.

### New module structure

```
services/ai-service/src/agent-harness/
  model-profiles/
    model-profile.contracts.ts
    model-profile.registry.ts
    model-profile.registry.spec.ts
  index.ts   (updated barrel export)
```

### What was done

1. **`model-profile.contracts.ts`** — Defined typed v1 model profile contract:
   - `AgentHarnessModelProviderV1` — union of supported provider names
   - `AgentHarnessModelCostTierV1` — broad cost tier enum (`low | medium | high | premium`)
   - `AgentHarnessModelToolCallFormatV1` — tool-call format placeholder (`none | anthropic-messages | openai-chat-completions`)
   - `AgentHarnessModelProfileV1` — full typed profile interface with `readonly` fields
   - `AgentHarnessModelProfileMapV1` — `Readonly<Record<string, AgentHarnessModelProfileV1>>`

2. **`model-profile.registry.ts`** — Centralized Agent Harness model profile registry:
   - `AGENT_HARNESS_MODEL_PROFILES_V1` — frozen array of initial profiles for all supported provider families
   - `AGENT_HARNESS_MODEL_PROFILE_MAP_V1` — frozen id-keyed map derived from the array
   - `listAgentHarnessModelProfiles()` — pure helper returning the full profile list
   - `listEnabledAgentHarnessModelProfiles()` — pure helper returning only enabled profiles
   - `getAgentHarnessModelProfile(profileId)` — safe lookup returning `undefined` if not found
   - `isAgentHarnessModelProfileEnabled(profileId)` — pure boolean helper; returns `false` for unknown ids

3. **`model-profile.registry.spec.ts`** — Focused tests proving all required registry invariants (see Tests section below).

4. **`index.ts`** — Stable barrel export updated to re-export `model-profile.contracts` and `model-profile.registry` in addition to existing contracts/config exports.

---

## Exact Files Changed

**New files:**

- `services/ai-service/src/agent-harness/model-profiles/model-profile.contracts.ts`
- `services/ai-service/src/agent-harness/model-profiles/model-profile.registry.ts`
- `services/ai-service/src/agent-harness/model-profiles/model-profile.registry.spec.ts`

**Updated files:**

- `services/ai-service/src/agent-harness/index.ts` (added two new `export *` lines)

**No other files were modified.**

---

## Model Profile Contracts/Registry Exports Created

### Types

- `AgentHarnessModelProviderV1`
- `AgentHarnessModelCostTierV1`
- `AgentHarnessModelToolCallFormatV1`
- `AgentHarnessModelProfileV1`
- `AgentHarnessModelProfileMapV1`

### Data constants

- `AGENT_HARNESS_MODEL_PROFILES_V1`
- `AGENT_HARNESS_MODEL_PROFILE_MAP_V1`

### Helper functions

- `listAgentHarnessModelProfiles()`
- `listEnabledAgentHarnessModelProfiles()`
- `getAgentHarnessModelProfile(profileId)`
- `isAgentHarnessModelProfileEnabled(profileId)`

---

## Initial Profiles Included and Why They Are Conservative

One profile per currently supported provider/adapter family was added. Model IDs were sourced directly from the existing adapter default fields (`private readonly defaultModel = ...`) to ensure alignment with what the platform already uses at runtime.

| Profile ID | Provider | Model | Cost tier | Capability flags |
|---|---|---|---|---|
| `anthropic.claude-3-5-sonnet` | `anthropic` | `claude-3-5-sonnet-20241022` | `high` | all `false` |
| `openai.gpt-4o` | `openai` | `gpt-4o` | `high` | all `false` |
| `groq.mixtral-8x7b-32768` | `groq` | `mixtral-8x7b-32768` | `medium` | all `false` |
| `xai.grok-3` | `xai` | `grok-3` | `high` | all `false` |
| `deepseek.deepseek-chat` | `deepseek` | `deepseek-chat` | `low` | all `false` |
| `stub.default` | `stub` | `stub` | `low` | all `false` |

**Conservative choices made:**

- All capability flags (`supportsTools`, `supportsStreaming`, `supportsJsonMode`, `supportsVision`) set to `false`. No capability claims are made until a future registered slice wires and validates them.
- Broad `costTier` values only; no pricing claims or token-cost numbers.
- `contextWindowTokens` set to the adapter default max token floor (8192 / 32768 for Groq), not to marketing-claimed maximums.
- `providerOptions` included only where adapters explicitly use a non-default `baseURL` (xAI and DeepSeek), matching existing adapter code.
- No external provider availability checks; the registry is pure data.

---

## Tests Added

| File | Test suite | Tests |
|---|---|---|
| `model-profile.registry.spec.ts` | `Agent Harness model profile registry (v1)` | 9 |

Tests cover:
1. Registry exports at least the intended initial provider-family profiles (5 named profiles, minimum 5 total).
2. Each profile has required fields and non-empty provider/model/id/displayName/family/purpose strings.
3. Profile IDs are unique and the map size matches the list size.
4. Capability flags (`supportsTools`, `supportsStreaming`, `supportsJsonMode`, `supportsVision`, `enabled`) are booleans.
5. Helper lookup (`getAgentHarnessModelProfile`) returns the expected profile.
6. Missing profile lookup is handled safely (returns `undefined`; `isEnabled` returns `false`).
7. List helpers return stable data; enabled list filter behavior is correct.
8. Registry exports are available from the stable `agent-harness` index file.
9. `WorkerProcessor` and `AIExecutionService` source files do not import from `agent-harness/model-profiles` (no runtime wiring).

---

## Validation Results

| Command | Result |
|---|---|
| `npm test -- src/agent-harness/model-profiles/model-profile.registry.spec.ts` | PASS — 1 suite, 9 tests |
| `npm run build` | PASS — tsc clean |
| IDE diagnostics on `src/agent-harness/model-profiles/` and `src/agent-harness/index.ts` | PASS — no linter errors |

All commands run from `C:\Users\knlee\aiSandBox2026B\services\ai-service`.

---

## Invariants Confirmed

| Invariant | Confirmed |
|---|---|
| Data/config-only foundation; no runtime behavior wiring | Yes |
| WorkerProcessor behavior unchanged | Yes |
| AIExecutionService behavior unchanged | Yes |
| All provider adapters unchanged | Yes |
| Queue/SSE/status behavior unchanged | Yes |
| Prompt assembly ordering unchanged | Yes |
| File-action parsing unchanged | Yes |
| Checkpoint/revert/coherence flow unchanged | Yes |
| Frontend/UI files unchanged | Yes |
| Database schema unchanged | Yes |
| Queue architecture unchanged | Yes |
| Dependency files unchanged | Yes |
| No tool-use/function-calling support implemented | Yes |
| No tool protocol runtime execution implemented | Yes |
| No tool registry implemented | Yes |
| No prompt template registry implemented | Yes |
| No streaming implementation | Yes |
| No repo indexing/search implementation | Yes |
| No validation runner implemented | Yes |
| No browser smoke implemented | Yes |
| No plan/review UI implemented | Yes |
| No checkpoint created before this consolidation step | Yes |

---

## No-Hardcoding Invariants

- All model profiles centralized in one registry module; model names do not appear in WorkerProcessor, AIExecutionService, or adapters as part of this slice.
- Provider defaults and model profile registry are kept separate; no future wiring occurs in this slice.
- Adding a new model profile is a data-only change in `model-profile.registry.ts`; no code-path change required.
- All profiles are typed and version-aware (carry `contractVersion: 'v1'`).
- Capability flags are present for future tool-use/streaming/prompt-template decisions.
- No pricing claims; only broad cost tiers.
- No hardcoded provider-specific behavior outside the profile `providerOptions` data field.

---

## Next Recommended Task

**AGENT-HARNESS-01D — Tool Registry Contract** (registration step next, then implementation).

This will build on the `AgentHarnessToolDefinitionV1` placeholder established in AGENT-HARNESS-01B and implement a typed tool registry contract/foundation that decouples tool definitions from hardcoded tool lists in WorkerProcessor or AIExecutionService.
