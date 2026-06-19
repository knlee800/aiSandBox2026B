# AGENT-HARNESS-01B Checkpoint

**Task ID:** AGENT-HARNESS-01B
**Title:** Agent Harness v1 Contracts + Config Shape
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Depends on:** AGENT-HARNESS-00 COMPLETE and LOCKED; AGENT-HARNESS-01A COMPLETE and LOCKED
**Date completed:** 2026-06-19

---

## Problem Summary

AGENT-HARNESS-00 established that future Agent Harness work must avoid hardcoded behavior and must be built around versioned contracts, policy/config objects, registries, adapters, and explicit migration paths. Before implementing tool protocol, model profiles, prompt templates, or multi-turn tool loops, the project needed a small typed foundation defining Agent Harness v1 contract and config shapes without changing runtime behavior.

---

## Objective Summary

Create typed Agent Harness v1 contracts and configuration shapes that future slices can use as a stable foundation for:

- versioned Agent Harness v1 request/state/tool/config contracts;
- conservative policy/config defaults;
- future model profile registry;
- future tool registry;
- future prompt template registry;
- future audit/eval events;

without implementing runtime behavior or changing the current AI execution flow.

---

## Implementation Summary

This slice was strictly types/config-only. No runtime wiring was performed.

### New module structure

```
services/ai-service/src/agent-harness/
  contracts/
    agent-harness.contracts.ts
    agent-harness.contracts.spec.ts
  config/
    agent-harness.config.ts
    agent-harness.config.spec.ts
  index.ts
```

### What was done

1. **`agent-harness.contracts.ts`** — Defined all versioned v1 TypeScript interfaces/types with `readonly`-friendly shapes and no `any` usage. Used `unknown` and `Record<string, unknown>` for future extensibility in tool payloads and audit event payloads.

2. **`agent-harness.config.ts`** — Created `DEFAULT_AGENT_HARNESS_CONFIG_V1` with conservative policy defaults. All destructive/risky actions require approval by default. All feature flags disabled by default. Validation commands stored as config data (not WorkerProcessor hardcoding).

3. **`index.ts`** — Stable barrel export re-exporting everything from contracts and config modules. Future slices should import from this index only.

4. **`agent-harness.contracts.spec.ts`** — Verified that the v1 contract version constant exports correctly and that all v1 contract shapes are importable and constructable from the stable index.

5. **`agent-harness.config.spec.ts`** — Verified that default config exports correctly, safety-sensitive defaults are conservative, the validation command allow-list exists as config data, and numeric guardrails are positive.

---

## Exact Files Changed

**New files (implementation only):**

- `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts`
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts`
- `services/ai-service/src/agent-harness/index.ts`
- `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.spec.ts`
- `services/ai-service/src/agent-harness/config/agent-harness.config.spec.ts`

**No existing files were modified.**

---

## Contract/Config Exports Created

### Version constant

- `AGENT_HARNESS_CONTRACT_VERSION_V1` (`'v1' as const`)

### Types / interfaces

- `AgentHarnessContractVersionV1`
- `AgentHarnessModeV1` — `'plan' | 'execute' | 'review'`
- `AgentHarnessRunStatusV1` — `'queued' | 'running' | 'completed' | 'failed' | 'cancelled'`
- `AgentHarnessModelProfileReferenceV1`
- `AgentHarnessToolInputSchemaV1`
- `AgentHarnessToolDefinitionV1`
- `AgentHarnessToolCallV1`
- `AgentHarnessToolResultV1`
- `AgentHarnessToolErrorV1`
- `AgentHarnessPolicyV1`
- `AgentHarnessConfigV1` (extends `AgentHarnessPolicyV1`)
- `AgentHarnessRunRequestV1`
- `AgentHarnessRunStateV1`
- `AgentHarnessValidationResultV1`
- `AgentHarnessBrowserSmokeResultV1`
- `AgentHarnessAuditEventV1`

### Config default

- `DEFAULT_AGENT_HARNESS_CONFIG_V1: AgentHarnessConfigV1`

---

## Conservative Safety Defaults Chosen

| Field | Default | Rationale |
|---|---|---|
| `allowArbitraryShell` | `false` | Arbitrary shell execution is high-risk; must be explicitly enabled per policy |
| `enableBrowserSmoke` | `false` | Not implemented yet; disabled until browser smoke slice ships |
| `enableSemanticSearch` | `false` | Not implemented yet; disabled until repo indexing slice ships |
| `enableToolLoop` | `false` | Not implemented yet; disabled until multi-turn tool loop slice ships |
| `requireApprovalForDelete` | `true` | Destructive file action; requires explicit approval |
| `requireApprovalForPackageInstall` | `true` | Package install changes dependency tree; requires explicit approval |
| `requireApprovalForEnvFileWrite` | `true` | `.env` writes could expose or overwrite secrets; requires explicit approval |
| `requireApprovalForLargeWrite` | `true` | Large writes could corrupt files; requires explicit approval |
| `allowedValidationCommands` | `['npm test', 'npm run build', 'npx tsc --noEmit']` | Explicit allow-list stored as config data; WorkerProcessor must not hardcode this |
| `auditEventsEnabled` | `true` | Audit logging on by default for observability |
| `maxToolIterations` | `3` | Conservative cap; prevents runaway tool loops |
| `toolTimeoutMs` | `30_000` | 30s per tool call |
| `validationTimeoutMs` | `120_000` | 2m for test/build runs |
| `browserSmokeTimeoutMs` | `120_000` | 2m for browser smoke scenarios |

---

## Tests Added

| File | Test suite | Tests |
|---|---|---|
| `agent-harness.contracts.spec.ts` | `Agent Harness v1 contract exports` | 2 |
| `agent-harness.config.spec.ts` | `Agent Harness v1 config defaults` | 4 |

Tests cover:
1. v1 contract version constant exported from stable index.
2. All v1 contract shapes importable and constructable from stable index.
3. Default config object is present and exported.
4. Safety-sensitive defaults are conservative (`allowArbitraryShell`, `enableBrowserSmoke`, `enableToolLoop`, `enableSemanticSearch`, all `requireApproval*`).
5. Validation command allow-list exists as config data (non-empty array).
6. Numeric guardrails are positive.

---

## Validation Results

| Command | Result |
|---|---|
| `npm test -- src/agent-harness/contracts/agent-harness.contracts.spec.ts src/agent-harness/config/agent-harness.config.spec.ts` | PASS — 2 suites, 6 tests |
| `npm run build` | PASS — tsc clean |
| IDE diagnostics on `src/agent-harness/` | PASS — no linter errors |

---

## Invariants Confirmed

| Invariant | Confirmed |
|---|---|
| Types/config-only foundation; no runtime behavior wiring | Yes |
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
| LOCKED AIExecutionRequest / AIExecutionResult not mutated | Yes |
| Model profile registry not implemented | Yes |
| Tool registry not implemented | Yes |
| Prompt template registry not implemented | Yes |
| WorkerProcessor multi-turn loop not implemented | Yes |
| Adapter tool-use/function-calling not implemented | Yes |
| No checkpoint created before this consolidation step | Yes |

---

## No-Hardcoding Invariants

- Versioned v1 contracts used throughout (no unversioned loose shapes).
- Contracts are parallel to LOCKED AIExecutionRequest / AIExecutionResult (no mutation).
- All policy defaults centralized in one config module.
- No hardcoded model names anywhere in the new module.
- No hardcoded tool lists.
- Validation command allow-list exists as config data (`allowedValidationCommands`).
- All feature flags prepare for future enabling without current runtime behavior change.

---

## Next Recommended Task

**AGENT-HARNESS-01C — Model Profile Registry** (registration step next, then implementation).

This will build on the `AgentHarnessModelProfileReferenceV1` placeholder established in this slice and implement a typed registry of model profiles that decouples model selection from hardcoded provider/model strings.
