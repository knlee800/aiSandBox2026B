# AGENT-HARNESS-01D Checkpoint — Tool Registry Contract

**Task ID:** AGENT-HARNESS-01D
**Title:** Tool Registry Contract
**Status:** COMPLETE and LOCKED
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Date:** 2026-06-19

---

## Problem

AGENT-HARNESS-01B created Agent Harness v1 contracts/config, and AGENT-HARNESS-01C created a data-only model profile registry. The next foundation needed was a typed Tool Registry Contract so future Agent Harness slices can describe available tools, tool input schemas, risk levels, approval requirements, timeouts, and execution boundaries without hardcoding tool lists inside WorkerProcessor or future tool loops.

## Objective

Create a typed Tool Registry Contract foundation for Agent Harness v1. This slice defines tool registry contracts and initial registry metadata as data only. It does not implement runtime tool execution.

---

## Implementation Summary

Added a new `tools/` module under `services/ai-service/src/agent-harness/` containing:

- A contracts file defining all registry-specific v1 typed contracts.
- A registry file providing centralized tool definitions, a frozen lookup map, and pure helper functions.
- A focused spec proving all required fields, uniqueness, conservative approval/risk metadata, safe lookup, and stable barrel export availability.
- An update to the agent-harness barrel export to include the new module.

No runtime behavior was changed. No tool execution was implemented. No WorkerProcessor, AIExecutionService, provider adapter, queue, prompt assembly, or file-action parser was modified.

---

## Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/agent-harness/tools/tool-registry.contracts.ts` | New — all v1 tool registry type/interface definitions |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` | New — centralized tool definitions list, frozen map, and pure helper functions |
| `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts` | New — 10 focused registry tests |
| `services/ai-service/src/agent-harness/index.ts` | Updated — added `tools/` barrel exports |

---

## Tool Registry Contracts / Registry Exports Created

### Contract types (tool-registry.contracts.ts)

- `AgentHarnessToolIdV1` — union of the 8 planned tool IDs
- `AgentHarnessToolCategoryV1` — `workspace | validation | preview | browser | search`
- `AgentHarnessToolRiskLevelV1` — `low | medium | high | destructive`
- `AgentHarnessToolImplementationStatusV1` — `planned | contract-only | implemented`
- `AgentHarnessToolAllowedModeV1` — alias to `AgentHarnessModeV1` from 01B contracts
- `AgentHarnessToolAllowedScopeV1` — `workspace | repository | session`
- `AgentHarnessToolAuditEventTypeV1` — `tool-called | tool-completed | tool-approved | tool-denied | tool-blocked`
- `AgentHarnessToolOutputSchemaV1` — alias to `AgentHarnessToolInputSchemaV1` from 01B contracts
- `AgentHarnessToolRegistryDefinitionV1` — full per-tool typed shape including all required fields
- `AgentHarnessToolDefinitionMapV1` — `Readonly<Record<string, AgentHarnessToolRegistryDefinitionV1>>`

### Registry exports (tool-registry.ts)

- `AGENT_HARNESS_TOOL_DEFINITIONS_V1` — frozen `readonly` array of the 8 planned tool definitions
- `AGENT_HARNESS_TOOL_DEFINITION_MAP_V1` — frozen lookup map by tool ID
- `listAgentHarnessToolDefinitions()` — returns the full definitions array
- `listEnabledAgentHarnessToolDefinitions()` — returns only enabled definitions (currently empty: all tools are disabled)
- `getAgentHarnessToolDefinition(toolId)` — returns a definition or `undefined` safely
- `isAgentHarnessToolEnabled(toolId)` — returns boolean; missing ID returns `false`
- `doesAgentHarnessToolRequireApproval(toolId)` — returns boolean; missing ID returns `false`

All exports are available from the stable `agent-harness/index.ts` barrel.

---

## Initial Planned Tools Included

| Tool ID | Category | Risk | Requires Approval | Status |
|---------|----------|------|-------------------|--------|
| `list_files` | workspace | low | false | contract-only |
| `read_file` | workspace | low | false | contract-only |
| `write_file` | workspace | high | **true** | contract-only |
| `delete_file` | workspace | **destructive** | **true** | contract-only |
| `run_validation` | validation | medium | false | contract-only |
| `start_preview` | preview | medium | false | planned |
| `browser_smoke` | browser | high | **true** | planned |
| `search_workspace` | search | low | false | planned |

**Conservative choices:**

- All tools are `enabled: false` — none will execute without a future implementation slice explicitly enabling them.
- All tools are `implementationStatus: 'planned'` or `'contract-only'`, never `'implemented'`.
- `write_file` requires approval and carries `riskLevel: 'high'`.
- `delete_file` requires approval and carries `riskLevel: 'destructive'` — the most conservative risk tier.
- `run_validation` description explicitly notes allow-listed commands only; it does not imply arbitrary shell access.
- `browser_smoke` is disabled and requires approval; `enableBrowserSmoke` remains `false` per 01B config defaults.
- `search_workspace` is disabled and does not imply semantic search is enabled; `enableSemanticSearch` remains `false` per 01B config defaults.
- No tool executes anything in this slice.

---

## Tests Added

**File:** `services/ai-service/src/agent-harness/tools/tool-registry.spec.ts`
**Suite:** `Agent Harness tool registry (v1)` — 10 tests

| # | Test |
|---|------|
| 1 | Exports the intended planned tool definitions (8 tools) |
| 2 | Ensures each tool has required contract fields |
| 3 | Enforces unique tool ids and matching map size |
| 4 | Ensures risk levels are present and valid |
| 5 | Keeps approval metadata conservative for risky write/delete classes |
| 6 | Returns expected tool definition for lookup helper |
| 7 | Handles missing tool lookup safely |
| 8 | Returns stable list data and correct enabled-list helper behavior |
| 9 | Makes tool registry exports available from stable agent-harness index |
| 10 | Does not require runtime wiring imports yet (guards worker.processor.ts and ai-execution.service.ts) |

---

## Validation Results

| Command | Result |
|---------|--------|
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm test -- src/agent-harness/tools/tool-registry.spec.ts` | **PASS** — 1 suite, 10 tests |
| `Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\ai-service"; npm run build` | **PASS** — tsc clean |

---

## Invariants Confirmed

- **Data-only:** This slice implemented typed contract definitions and registry metadata only. No runtime code was added or changed.
- **No runtime tool execution implemented.**
- **No tool dispatcher created.**
- **No runtime behavior changed.**
- **No WorkerProcessor behavior changed.**
- **No AIExecutionService behavior changed.**
- **No provider adapter behavior changed.**
- **No frontend/UI files changed.**
- **No database schema changes.**
- **No queue architecture changes.**
- **No tool-use/function-calling support added.**
- **No prompt template registry implemented.**
- **No checkpoint was created before this consolidation step** — the implementation step did not create a checkpoint, per governance rules.

---

## Dependency Chain

| Predecessor | Status |
|-------------|--------|
| AGENT-HARNESS-00 | COMPLETE and LOCKED |
| AGENT-HARNESS-01A | COMPLETE and LOCKED |
| AGENT-HARNESS-01B | COMPLETE and LOCKED |
| AGENT-HARNESS-01C | COMPLETE and LOCKED |
| **AGENT-HARNESS-01D** | **COMPLETE and LOCKED** |

---

## Next Recommended Task

**AGENT-HARNESS-01E — Prompt Template Registry**

Registration is the next step; implementation must not begin until AGENT-HARNESS-01E is formally registered as ACTIVE in `TASKS.md` and `TASKS_BACKLOG_FULL.md`.
