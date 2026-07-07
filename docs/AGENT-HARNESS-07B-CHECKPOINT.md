# AGENT-HARNESS-07B Checkpoint

**Task:** AGENT-HARNESS-07B — Worker Integration + Resolved Config Flow
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-07
**Parent task:** AGENT-HARNESS-07 — Per-Builder Harness Config Adapter (ACTIVE)

---

## 1. Task Summary

AGENT-HARNESS-07B is the second active child slice of AGENT-HARNESS-07. It wires the per-builder harness config adapter (built in AGENT-HARNESS-07A) into the `WorkerProcessor` execution path. `AiExecutionJob` and `AgentHarnessRunRequestV1` were extended with optional builder identity fields. `WorkerProcessor` now calls `resolveBuilderHarnessConfig()` before the harness route decision, and the resolved config is used throughout the harness branch — for `ToolDispatcher` construction, all handler registrations, `executeAgentHarnessLoop` options, audit recorder gating, and the pre-apply checkpoint gate. The plain execution path is unchanged. Global fallback behavior is fully preserved when identity fields are absent.

No frontend changes, no API Gateway enqueue wiring, no DB/migration changes, no billing enforcement, and no production tool-loop activation occurred in this slice.

---

## 2. Status Hierarchy

| Task | Status |
|------|--------|
| AGENT-HARNESS-07B | **COMPLETE and LOCKED** |
| AGENT-HARNESS-07 (parent) | **ACTIVE** — 07C remains |
| AGENT-HARNESS-07A | **COMPLETE and LOCKED** — 2026-07-07 |
| AGENT-HARNESS-07C | Not registered — future (after explicit Keith approval) |
| AGENT-HARNESS-06C | Not registered — deferred until AGENT-HARNESS-07 is COMPLETE and LOCKED |
| AGENT-PLATFORM-04 | COMPLETE and LOCKED |

---

## 3. Scope Completed

### 3.1 AiExecutionJob Identity Field Extension

`AiExecutionJob` in `services/ai-service/src/queue/job.types.ts` extended with five optional per-builder identity fields:

- `agentRole?: string` — identifies agent role for config resolution
- `builderProfileId?: string` — identifies the builder profile
- `harnessProfileId?: string` — optional harness profile override reference
- `modelProfileId?: string` — optional model profile override reference
- `toolPermissionProfileId?: string` — optional tool permission profile override reference

Fields are optional and typed to preserve backward compatibility with all existing job enqueue paths.

### 3.2 AgentHarnessRunRequestV1 Identity Field Extension

`AgentHarnessRunRequestV1` in `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` extended with matching optional readonly identity fields:

- `readonly agentRole?: string`
- `readonly builderProfileId?: string`
- `readonly harnessProfileId?: string`
- `readonly modelProfileId?: string`
- `readonly toolPermissionProfileId?: string`

Fields are optional and readonly, consistent with the V1 contract shape established in prior slices.

### 3.3 WorkerProcessor resolveBuilderHarnessConfig Integration

`WorkerProcessor` in `services/ai-service/src/worker/worker.processor.ts`:

- Imports `resolveBuilderHarnessConfig` from `../agent-harness/builder-profiles`
- Calls `resolveBuilderHarnessConfig({ agentRole: job.data.agentRole, builderProfileId: job.data.builderProfileId }, DEFAULT_AGENT_HARNESS_CONFIG_V1)` inside the `useHarness` branch, immediately after the harness route decision
- Logs `agent_harness.config_resolved` event with resolution metadata (`source`, `builderProfileId`, `harnessProfileId`, `fieldsOverridden`, `warnings`)
- Uses `resolvedConfig` in place of `DEFAULT_AGENT_HARNESS_CONFIG_V1` throughout the harness branch:
  - `ToolDispatcher` construction: `toolTimeoutMs`, `maxToolResultBytes`
  - `read_file` handler: `maxFileReadBytes`
  - `write_file` and `delete_file` handlers: gated on `resolvedConfig.enableWriteTools`, `maxFileWriteBytes`
  - `run_validation` handler: gated on `resolvedConfig.enableValidationTools`, `allowedValidationCommands`, `validationTimeoutMs`, `maxValidationOutputBytes`
  - `browser_smoke` handler: gated on `resolvedConfig.enableBrowserSmoke`, `browserSmokeTimeoutMs`
  - `InMemoryHarnessAuditRecorder`: instantiated only when `resolvedConfig.auditEventsEnabled`
  - `executeAgentHarnessLoop` options: `maxToolIterations`, `maxToolResultBytes`, `toolTimeoutMs`
  - Pre-apply checkpoint gate: controlled by `resolvedConfig.enablePreApplyCheckpoint`

### 3.4 Global DEFAULT_AGENT_HARNESS_CONFIG_V1 Master env Gate Preserved

`DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` remains the master environment gate. The harness path is only entered when `job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop`. The resolved config's `enableToolLoop` is not used as a secondary gate — this is intentional: the global env gate controls production activation, not per-builder profile.

### 3.5 Plain Execution Path Unchanged

The plain `aiExecutionService.execute(executionRequest)` path (when `useHarness` is false) is completely unchanged. No resolved config is computed, no adapter is called, and no harness logic is entered.

### 3.6 Fallback Behavior Preserved

When `agentRole` and `builderProfileId` are absent from the job payload, `resolveBuilderHarnessConfig` falls back to `global-default-missing-profile` resolution path, returning the global default config unchanged. All existing behavior is preserved.

---

## 4. Implementation Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` extended with optional identity fields (`agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`) |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | `AgentHarnessRunRequestV1` extended with matching optional readonly identity fields |
| `services/ai-service/src/worker/worker.processor.ts` | `resolveBuilderHarnessConfig` imported and called; resolved config used throughout harness branch |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Existing tests updated/extended to remain backward-compatible with resolved config integration |
| `services/ai-service/src/worker\__tests__\worker.processor.builder-config.spec.ts` | New test file: AGENT-HARNESS-07B worker integration tests — identity field acceptance, config resolution, fallback, global default path |

---

## 5. Validation Evidence

All validation run in `services/ai-service/` context:

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="worker.processor"` | Passed — 33 suites, 629 tests, 1 skipped |
| `npx jest --testPathPatterns="builder-profile"` | Passed |
| `npx jest --testPathPatterns="builder-harness-config-adapter"` | Passed |
| `npm test` | Passed — 33 suites, 629 tests, 1 skipped |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

Test count increased from 594 (post-07A) to 629 (post-07B): +35 tests added by `worker.processor.builder-config.spec.ts` and related 07B test coverage.

---

## 6. Non-Goals Confirmed

The following were explicitly out of scope for AGENT-HARNESS-07B and were not touched:

- No AGENT-HARNESS-06C activation
- No production tool-loop activation (`AGENT_HARNESS_ENABLE_TOOL_LOOP` not set)
- No frontend changes
- No API Gateway enqueue wiring for identity fields
- No DB/migration changes
- No billing enforcement
- No Docker/Postgres/Redis/runtime commands

---

## 7. Locked Invariants for 07C

The following are now locked and must not be modified without registering a new task:

- `AiExecutionJob` optional identity field shape (`agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`)
- `AgentHarnessRunRequestV1` optional identity field shape (matching the above)
- `WorkerProcessor` call to `resolveBuilderHarnessConfig` before harness route decision
- Resolved config as the single source of truth for all harness branch config values
- `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` as master env gate (not the resolved config)
- Plain execution path unchanged

AGENT-HARNESS-07C (Validation/Regression Matrix and Checkpoint) must validate the full 07A + 07B integration and close out AGENT-HARNESS-07.

---

## 8. Next Recommended Step

**AGENT-HARNESS-07C — Validation/Regression Matrix and Checkpoint** (not yet registered)

Scope when registered:
- Full regression matrix validating 07A + 07B integration end-to-end
- Confirm all AGENT-HARNESS-07 acceptance criteria satisfied
- AGENT-HARNESS-07 checkpoint document created
- AGENT-HARNESS-07 marked COMPLETE and LOCKED
- AGENT-HARNESS-06C unblock decision recorded (remains deferred until Keith explicitly approves canary)

Do not register AGENT-HARNESS-07C until explicitly approved.

---

## 9. References

- `docs/AGENT-HARNESS-07A-CHECKPOINT.md` — 07A checkpoint (builder profile registry + adapter)
- `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` — topology plan (prerequisite)
- `docs/AGENT-PLATFORM-04-CHECKPOINT.md` — AGENT-PLATFORM-04 checkpoint
- `TASKS.md` → AGENT-HARNESS-07 / AGENT-HARNESS-07B
- `TASKS_BACKLOG_FULL.md` → AGENT-HARNESS-07 / AGENT-HARNESS-07B
