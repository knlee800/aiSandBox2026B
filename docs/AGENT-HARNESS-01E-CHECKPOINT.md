# AGENT-HARNESS-01E Checkpoint — Prompt Template Registry

**Task ID:** AGENT-HARNESS-01E
**Title:** Prompt Template Registry
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-21

---

## Problem

AGENT-HARNESS-01B created Agent Harness v1 contracts/config, AGENT-HARNESS-01C created a model profile registry, and AGENT-HARNESS-01D created a tool registry contract. The next foundation needed was a typed Prompt Template Registry so future Agent Harness slices can manage system prompts, planning prompts, tool-use prompts, repair prompts, validation prompts, and final response prompts without hardcoding prompt text across WorkerProcessor, AIExecutionService, adapters, or future tool loops.

## Objective

Create a typed, data-only Prompt Template Registry foundation for Agent Harness v1. This slice defines prompt template contracts and initial registry metadata as data only. It does not change runtime prompt assembly or model behavior.

---

## Implementation Summary

Added a new `prompts/` module under `services/ai-service/src/agent-harness/` containing:

- A contracts file defining all registry-specific v1 typed contracts for prompt template IDs, categories, implementation status, variables, output expectations, allowed modes, safety scope, definition shape, and map type.
- A registry file providing centralized, frozen prompt template definitions, a frozen lookup map, and pure helper functions.
- A focused spec proving all required fields, ID uniqueness, version format, conservative implementation status, safe lookup, enabled-list helper behavior, and stable barrel export availability, plus a guard confirming no runtime wiring exists yet.
- An update to the agent-harness barrel export to include the new module.

No runtime behavior was changed. No prompt assembly was changed. No prompt renderer or template interpolation engine was implemented. No WorkerProcessor, AIExecutionService, provider adapter, queue, file-action parser, or checkpoint/revert flow was modified.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/agent-harness/prompts/prompt-template.contracts.ts` | New — all v1 prompt template type/interface definitions |
| `services/ai-service/src/agent-harness/prompts/prompt-template.registry.ts` | New — centralized template definitions list, frozen map, and pure helper functions |
| `services/ai-service/src/agent-harness/prompts/prompt-template.registry.spec.ts` | New — 10 focused registry tests |
| `services/ai-service/src/agent-harness/index.ts` | Updated — added `prompts/` barrel exports |

---

## Prompt Template Contracts / Registry Exports Created

### Contract types (prompt-template.contracts.ts)

- `AgentHarnessPromptTemplateIdV1` — union of the 8 planned prompt template IDs
- `AgentHarnessPromptTemplateCategoryV1` — `system | planning | tooling | file-change | validation | repair | response`
- `AgentHarnessPromptTemplateImplementationStatusV1` — alias to `AgentHarnessToolImplementationStatusV1` from 01D (`planned | contract-only | implemented`)
- `AgentHarnessPromptTemplateAllowedModeV1` — alias to `AgentHarnessToolAllowedModeV1` from 01D (avoids duplicate type)
- `AgentHarnessPromptTemplateSafetyScopeV1` — `read-only-guidance | tool-planning-only | change-scope-constrained | validation-allow-list-only | repair-guidance-only | response-only`
- `AgentHarnessPromptTemplateVariableTypeV1` — `string | string[] | number | boolean | json`
- `AgentHarnessPromptTemplateVariableV1` — typed per-variable shape (name, description, type, example, allowedValues)
- `AgentHarnessPromptTemplateOutputExpectationV1` — format, mustInclude, mustNotInclude, notes
- `AgentHarnessPromptTemplateDefinitionV1` — full per-template typed shape including all required fields
- `AgentHarnessPromptTemplateMapV1` — `Readonly<Record<AgentHarnessPromptTemplateIdV1, AgentHarnessPromptTemplateDefinitionV1>>`

### Registry exports (prompt-template.registry.ts)

- `AGENT_HARNESS_PROMPT_TEMPLATES_V1` — frozen `readonly` array of the 8 planned prompt template definitions
- `AGENT_HARNESS_PROMPT_TEMPLATE_MAP_V1` — frozen lookup map by template ID
- `listAgentHarnessPromptTemplates()` — returns the full definitions array
- `listEnabledAgentHarnessPromptTemplates()` — returns only enabled definitions (currently empty: all templates are disabled)
- `getAgentHarnessPromptTemplate(templateId)` — returns a definition or `undefined` safely
- `isAgentHarnessPromptTemplateEnabled(templateId)` — returns boolean; missing ID returns `false`

All exports are available from the stable `agent-harness/index.ts` barrel.

---

## Initial Planned Prompt Templates Included

| Template ID | Category | Safety Scope | Status |
|-------------|----------|--------------|--------|
| `system_base` | system | read-only-guidance | contract-only |
| `planning_instruction` | planning | read-only-guidance | contract-only |
| `tool_selection` | tooling | tool-planning-only | planned |
| `tool_result_interpretation` | tooling | tool-planning-only | planned |
| `file_change_instruction` | file-change | change-scope-constrained | contract-only |
| `validation_instruction` | validation | validation-allow-list-only | contract-only |
| `repair_instruction` | repair | repair-guidance-only | planned |
| `final_response` | response | response-only | contract-only |

**Conservative choices:**

- All templates are `enabled: false` — none will render or affect prompt assembly without a future integration slice.
- All templates are `implementationStatus: 'planned'` or `'contract-only'`, never `'implemented'`.
- `tool_selection` and `tool_result_interpretation` reference planned tool IDs as `allowedToolIds` metadata only; they do not enable runtime tool execution.
- `validation_instruction` carries `safetyScope: 'validation-allow-list-only'` and its `mustNotInclude` explicitly guards against arbitrary shell execution.
- `file_change_instruction` carries `safetyScope: 'change-scope-constrained'` and `mustNotInclude: ['broad refactors']`.
- `repair_instruction` explicitly notes in `mustNotInclude` and `notes` that no automatic retry loop is introduced.
- `final_response` notes that current runtime final response behavior is unchanged.
- No template is rendered or executed in this slice.
- Existing prompt assembly order (`buildExecutionPromptParts` in `worker.processor.ts`) is unchanged.

---

## Tests Added

**File:** `services/ai-service/src/agent-harness/prompts/prompt-template.registry.spec.ts`
**Suite:** `Agent Harness prompt template registry (v1)` — 10 tests

| # | Test |
|---|------|
| 1 | Exports the intended planned prompt templates (8 templates) |
| 2 | Ensures each prompt template has required contract fields |
| 3 | Enforces unique prompt template ids and a matching map size |
| 4 | Ensures versions are present for all templates (semver format) |
| 5 | Keeps implementation status metadata conservative (all `enabled: false`, no `implemented` status) |
| 6 | Returns expected prompt template for lookup helper |
| 7 | Handles missing prompt template lookup safely |
| 8 | Returns stable list data and correct enabled-list helper behavior (0 enabled templates) |
| 9 | Makes prompt template exports available from stable agent-harness index |
| 10 | Does not require runtime wiring imports yet (guards `worker.processor.ts` and `ai-execution.service.ts`) |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- src/agent-harness/prompts/prompt-template.registry.spec.ts` | **PASS** — 1 suite, 10 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS** — tsc clean |
| ReadLints on `src/agent-harness/prompts/` and `src/agent-harness/index.ts` | **PASS** — no linter errors |

---

## Invariants Confirmed

- **Data-only:** This slice implemented typed contract definitions and registry metadata only. No runtime code was added or changed.
- **No runtime prompt assembly change was implemented.**
- **No prompt renderer was implemented.**
- **No template interpolation engine was implemented.**
- **No runtime behavior changed.**
- **No WorkerProcessor behavior changed.**
- **No AIExecutionService behavior changed.**
- **No provider adapter behavior changed.**
- **No frontend/UI files changed.**
- **No database schema changes.**
- **No queue architecture changes.**
- **No tool-use/function-calling/runtime tool execution was implemented.**
- **No checkpoint was created before this consolidation step** — the implementation step did not create a checkpoint, per governance rules.

---

## Dependency Chain

| Predecessor | Status |
|-------------|--------|
| AGENT-HARNESS-00 | COMPLETE and LOCKED |
| AGENT-HARNESS-01A | COMPLETE and LOCKED |
| AGENT-HARNESS-01B | COMPLETE and LOCKED |
| AGENT-HARNESS-01C | COMPLETE and LOCKED |
| AGENT-HARNESS-01D | COMPLETE and LOCKED |
| **AGENT-HARNESS-01E** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-02A — Adapter Tool-Use Support**

There is no AGENT-HARNESS-01F defined in the master plan. The 01x foundation series (contracts, config, model profiles, tool registry, prompt templates) is now complete. The next task per the master plan is AGENT-HARNESS-02A, which extends provider adapters with optional tool-use methods (`executeWithTools()`), implements tool-call response parsing for Anthropic and OpenAI, and leaves the legacy `execute()` path unchanged.

Registration of AGENT-HARNESS-02A is the next step. Implementation must not begin until AGENT-HARNESS-02A is formally registered as ACTIVE in `TASKS.md` and `TASKS_BACKLOG_FULL.md`.
