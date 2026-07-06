# AGENT-HARNESS-06A Checkpoint — Read-Only Canary Hardening Slice

**Task ID:** AGENT-HARNESS-06A
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-06
**Parent task:** AGENT-HARNESS-06 — Read-Only Harness Canary Readiness Review (COMPLETE and LOCKED)

---

## 1. Task Summary

AGENT-HARNESS-06A implemented the read-only canary hardening required before a true read-only Agent Harness canary can be planned. It addressed all three blockers identified in the AGENT-HARNESS-06 NO-GO review:

- **Primary blocker resolved:** `write_file`, `delete_file`, and `run_validation` were unconditionally registered whenever `useHarness=true`. These are now gated behind explicit default-off config flags.
- **Secondary finding resolved:** `browser_smoke` registry metadata previously said `enabled=true` while runtime default is `false`. Metadata is now aligned to `enabled=false`.
- **Secondary finding resolved:** `harness.loop_started` audit event was emitting `toolTimeoutMs: 0` regardless of configured timeout. The event now emits the actual configured value when provided.

Agent Harness was not activated. `enableToolLoop` remains `false`.

---

## 2. Exact Files Changed

Source and test files only. No governance/checkpoint files were modified during the implementation pass.

```
services/ai-service/src/agent-harness/config/agent-harness.config.ts
services/ai-service/src/agent-harness/config/agent-harness.config.spec.ts
services/ai-service/src/worker/worker.processor.ts
services/ai-service/src/worker/worker.processor.spec.ts
services/ai-service/src/agent-harness/tools/tool-registry.ts
services/ai-service/src/agent-harness/tools/tool-registry.spec.ts
services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts
services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.spec.ts
```

---

## 3. Implementation Summary

All changes are in `services/ai-service`. No other service, frontend, or governance file was modified during implementation.

- Added `AgentHarnessRuntimeConfigV1` type extending `AgentHarnessConfigV1` with two new runtime gate fields.
- Added strict env-backed boolean parsing for two new flags, consistent with the existing `AGENT_HARNESS_ENABLE_TOOL_LOOP` pattern.
- `createAgentHarnessConfigV1` factory now reads and exposes both new flags.
- `DEFAULT_AGENT_HARNESS_CONFIG_V1` type narrowed to `AgentHarnessRuntimeConfigV1`.
- `WorkerProcessor` conditional tool registration tightened.
- `tool-registry.ts` `browser_smoke` metadata corrected.
- `agent-harness-loop.ts` loop options extended and audit emission corrected.

---

## 4. Config Flags Added

**File:** `services/ai-service/src/agent-harness/config/agent-harness.config.ts`

| Flag | Type | Default | Env variable |
|------|------|---------|-------------|
| `enableWriteTools` | `boolean` | `false` | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` |
| `enableValidationTools` | `boolean` | `false` | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` |

- Both default to `false` when the env variable is absent, empty, or whitespace-only.
- Valid accepted values: `"true"` / `"false"` (case-insensitive, trimmed).
- Invalid non-empty values (e.g. `"1"`, `"yes"`) throw, consistent with existing strict parser behavior.
- `enableToolLoop` default `false` is unchanged.

---

## 5. WorkerProcessor Tool Registration Gating

**File:** `services/ai-service/src/worker/worker.processor.ts`

When `useHarness === true` (i.e. `harnessVersion === 'v1' && enableToolLoop === true`):

| Tool | Registration condition |
|------|----------------------|
| `read_file` | Always registered (read-only, safe) |
| `list_files` | Always registered (read-only, safe) |
| `write_file` | Registered only when `enableWriteTools === true` |
| `delete_file` | Registered only when `enableWriteTools === true` |
| `run_validation` | Registered only when `enableValidationTools === true` |
| `browser_smoke` | Registered only when `enableBrowserSmoke === true` (unchanged) |

Plain execution path (non-harness) is unchanged.
`enableToolLoop` remains `false` so the harness path is not reachable in the current default configuration.
The `toolTimeoutMs: DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs` is now passed into `executeAgentHarnessLoop` loop options.

---

## 6. Tool Registry Metadata Alignment

**File:** `services/ai-service/src/agent-harness/tools/tool-registry.ts`

`browser_smoke` registry entry changed:

```
enabled: true  →  enabled: false
```

`implementationStatus: 'implemented'` and all other metadata preserved.
`read_file`, `list_files`, `write_file`, `delete_file`, `run_validation` metadata unchanged.
`start_preview` and `search_workspace` remain `enabled: false` / `implementationStatus: 'planned'` (unchanged).

Note: The registry's `enabled` field is a metadata signal. Runtime tool availability is controlled by `WorkerProcessor` gating, not solely by registry metadata. Both are now consistently `false` for `browser_smoke` by default.

---

## 7. Audit toolTimeoutMs Fix

**File:** `services/ai-service/src/agent-harness/orchestrator/agent-harness-loop.ts`

- Added optional `toolTimeoutMs?: number` to `AgentHarnessLoopOptions`.
- `harness.loop_started` audit event emission changed from hardcoded `toolTimeoutMs: 0` to `toolTimeoutMs: options.toolTimeoutMs ?? 0`.
- `WorkerProcessor` now passes `toolTimeoutMs: DEFAULT_AGENT_HARNESS_CONFIG_V1.toolTimeoutMs` (30,000 ms) into loop options.
- Existing tests that do not pass `toolTimeoutMs` continue to see `0` as the backward-compatible fallback.

---

## 8. Tests Added / Updated

### `agent-harness.config.spec.ts`
- `createAgentHarnessConfigV1` — `enableWriteTools` and `enableValidationTools` default `false` when env empty.
- Parses `"true"` / `"false"` correctly for both new flags.
- Throws for invalid values (`"1"`, `"yes"`) with variable name in error message.
- `DEFAULT_AGENT_HARNESS_CONFIG_V1` — both new flags default `false`.

### `worker.processor.spec.ts`
- `read_file` and `list_files` always registered in harness path.
- Write/delete registration is gated behind `enableWriteTools` (source assertion).
- `run_validation` registration is gated behind `enableValidationTools` (source assertion).
- `enableWriteTools` and `enableValidationTools` confirmed `false` in default config.
- Config can be set to `true` via env (factory test).
- `toolTimeoutMs` passed into loop options (source assertion).
- Plain path remains unchanged (structural assertion).

### `tool-registry.spec.ts`
- Enabled-tool list count updated from 6 to 5 (browser_smoke removed from enabled set).
- `browser_smoke` confirmed `enabled: false` and `isAgentHarnessToolEnabled('browser_smoke') === false`.
- `browser_smoke` `implementationStatus: 'implemented'` and `riskLevel: 'high'` preserved.

### `agent-harness-loop.spec.ts`
- `loop_started` event emits `toolTimeoutMs: 0` when no value is provided (backward-compatible fallback confirmed).
- `loop_started` event emits actual `toolTimeoutMs: 30_000` when passed via options.

---

## 9. Validation Evidence

All commands run from `C:\Users\knlee\aiSandBox2026B\services\ai-service`:

| Command | Result |
|---------|--------|
| `npx jest --testPathPattern="agent-harness.config.spec"` | PASS — 28 tests |
| `npx jest --testPathPattern="worker.processor.spec"` | PASS — 69 tests |
| `npx jest --testPathPattern="tool-registry.spec"` | PASS — 15 tests |
| `npx jest --testPathPattern="agent-harness-loop.spec"` | PASS — 47 tests |
| `npx jest --testPathPattern="harness-audit-recorder.spec"` | PASS — 5 tests |
| `npm run build` | PASS — `tsc` clean, no errors |

No linter errors on edited files.

---

## 10. Read-Only Canary Safety Confirmation

After this hardening slice, a read-only canary session (if one is planned and activated) would have access only to:

- `read_file`
- `list_files`

provided that:
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS` is absent or `"false"` (default)
- `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` is absent or `"false"` (default)
- `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` remains absent or `"false"` (unchanged default)

No canary was run during this slice.

---

## 11. Runtime Activation Confirmation

- `enableToolLoop` remains `false` in `DEFAULT_AGENT_HARNESS_CONFIG_V1`.
- Agent Harness was not activated.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` was not set at any point.
- No live harness execution was performed.

---

## 12. No Frontend / Package / Env / Docker / Schema / Database Changes

- No frontend files modified.
- No translation files modified.
- `package.json` not modified.
- No `.env` or secret files modified.
- No Docker files modified.
- No database or schema files modified.
- No API Gateway or container-manager files modified.

---

## 13. Non-Goals Confirmed

- No canary was run.
- Agent Harness was not activated.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` was not set.
- Write tools are not enabled by default.
- Validation tools are not enabled by default.
- `browser_smoke` is not enabled by default.
- Tool handler behavior (beyond registration gating) was not changed.
- API Gateway and container-manager were not modified.
- Frontend was not modified.
- Database/schema was not modified.
- Billing was not implemented.
- BILLING-READY-00 was not registered.
- AGENT-SKILLS-00 was not registered.
- No subagents were used.

---

## 14. Remaining Risks

**Operational (low):**

- Any future canary environment must explicitly confirm `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` (or absent) and `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=false` (or absent) before activating `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`.
- The harness path itself is still gated by `enableToolLoop=false`, so these flags are moot unless the canary activation task explicitly changes that gate.

**Documentation (very low):**

- `AgentHarnessConfigV1` in `agent-harness.contracts.ts` does not yet declare `enableWriteTools` / `enableValidationTools`. These live on the `AgentHarnessRuntimeConfigV1` extension type in `agent-harness.config.ts`. This is intentional: the contracts file is foundational and was not touched to minimize scope risk. A future slice may promote these to the base contract.

---

## 15. Next Recommended Task

**AGENT-HARNESS-06B — Read-Only Harness Canary Plan**

With the primary blocker resolved, plan the true read-only Agent Harness canary: define activation criteria, environment gates, observability requirements, rollback procedure, and acceptance criteria before any live canary execution.

After harness canary planning: BILLING-READY-00.

---

## 16. Final Status

**AGENT-HARNESS-06A — Read-Only Canary Hardening Slice — COMPLETE and LOCKED.**

All implementation acceptance criteria satisfied. Build and tests passing. No runtime activation performed. No governance files modified during implementation pass.
