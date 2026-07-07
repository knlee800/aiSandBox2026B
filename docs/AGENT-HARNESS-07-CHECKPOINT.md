# AGENT-HARNESS-07 Parent Checkpoint

**Task:** AGENT-HARNESS-07 — Per-Builder Harness Config Adapter
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-07
**Closed by:** AGENT-HARNESS-07C Step 3 — Consolidation / Parent Close Checkpoint

---

## 1. Task Summary

AGENT-HARNESS-07 implemented the Per-Builder Harness Config Adapter: V1 typed contracts, a static default builder profile registry, a pure resolver adapter, and full worker integration through `WorkerProcessor`. All three child slices (07A, 07B, 07C) are COMPLETE and LOCKED. No production tool loop was activated. No frontend, API Gateway, database, billing, or runtime changes occurred.

---

## 2. Status Hierarchy

| Task | Status |
|------|--------|
| AGENT-HARNESS-07 | **COMPLETE and LOCKED — 2026-07-07** |
| AGENT-HARNESS-07A | **COMPLETE and LOCKED — 2026-07-07** |
| AGENT-HARNESS-07B | **COMPLETE and LOCKED — 2026-07-07** |
| AGENT-HARNESS-07C | **COMPLETE and LOCKED — 2026-07-07** |
| AGENT-HARNESS-06C | **Not registered — deferred** until Keith explicitly approves canary activation |
| AGENT-PLATFORM-04 | **COMPLETE and LOCKED — 2026-07-07** |

---

## 3. Child Slice Scope — AGENT-HARNESS-07A

**Checkpoint:** `docs/AGENT-HARNESS-07A-CHECKPOINT.md`

### 3.1 Builder Profile V1 Contracts

Typed contracts defined at `services/ai-service/src/agent-harness/builder-profiles/builder-profile.contracts.ts`. Shape-only — no env reads, no I/O, no async.

Key types:
- `BuilderHarnessProfileV1` — per-builder harness config override fields
- `BuilderModelProfileV1` — per-builder model selection hints
- `BuilderToolPermissionsV1` — per-builder tool access control
- `BuilderRuntimeLimitsV1` — per-builder session/workspace constraints
- `BuilderProfileV1` — top-level per-builder identity and config bundle
- `BuilderHarnessConfigAdapterInputV1` — adapter input shape
- `BuilderHarnessConfigResolutionSourceV1` — resolution source enum
- `BuilderHarnessConfigResolutionMetadataV1` — resolution audit metadata
- `BuilderHarnessConfigAdapterResultV1` — adapter output (config + metadata)

### 3.2 Static Default Builder Profile Registry

Static, data-only registry at `services/ai-service/src/agent-harness/builder-profiles/builder-profile.registry.ts`. No env reads, no async, no I/O.

`DEFAULT_BUILDER_PROFILE_V1` (`builderProfileId: 'builder-default'`):
- Preserves current single-builder behavior — no harness overrides; all config fields resolve from global defaults.
- `agentRole: 'builder'`, `enabled: true`, `profileVersion: 1`.

Exported functions: `getBuilderProfile`, `listBuilderProfiles`, `listEnabledBuilderProfiles`, `isBuilderProfileEnabled`.

### 3.3 Pure Per-Builder Harness Config Adapter

Pure function at `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts`. No env reads, no async, no I/O.

Resolution paths:
- `global-default-non-builder-role` — non-builder `agentRole` → global default + warning
- `global-default-missing-profile` — no `builderProfileId` → global default, no warnings
- `global-default-unknown-profile` — unknown `builderProfileId` → global default + warning
- `builder-profile` — known profile; harness fields merged over global default

Platform safety enforcement:
- **Approval floor fields** (`requireApprovalForDelete`, `requireApprovalForPackageInstall`, `requireApprovalForEnvFileWrite`, `requireApprovalForLargeWrite`) cannot be weakened below global/platform `true`. Silently reversed, warning recorded.
- **`allowArbitraryShell` platform veto** — cannot become `true` if global default is `false`. Silently reversed, warning recorded.

Resolution metadata tracks: `source`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`, `fieldsOverridden`, `fieldsDefaulted`, `warnings`.

### 3.4 07A Files Created

| File | Description |
|------|-------------|
| `services/ai-service/src/agent-harness/builder-profiles/builder-profile.contracts.ts` | V1 typed contracts |
| `services/ai-service/src/agent-harness/builder-profiles/builder-profile.registry.ts` | Static default registry |
| `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts` | Pure adapter |
| `services/ai-service/src/agent-harness/builder-profiles/index.ts` | Barrel export |
| `services/ai-service/src/agent-harness/builder-profiles/__tests__/builder-profile.registry.spec.ts` | Registry unit tests |
| `services/ai-service/src/agent-harness/builder-profiles/__tests__/builder-harness-config-adapter.spec.ts` | Adapter unit tests |

---

## 4. Child Slice Scope — AGENT-HARNESS-07B

**Checkpoint:** `docs/AGENT-HARNESS-07B-CHECKPOINT.md`

### 4.1 AiExecutionJob Identity Field Extension

`AiExecutionJob` in `services/ai-service/src/queue/job.types.ts` extended with five optional per-builder identity fields:
- `agentRole?: string`
- `builderProfileId?: string`
- `harnessProfileId?: string`
- `modelProfileId?: string`
- `toolPermissionProfileId?: string`

All fields are optional — fully backward-compatible with all existing job enqueue paths.

### 4.2 AgentHarnessRunRequestV1 Identity Field Extension

`AgentHarnessRunRequestV1` in `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` extended with matching optional readonly identity fields. Consistent with V1 contract shape.

### 4.3 WorkerProcessor resolveBuilderHarnessConfig Integration

`WorkerProcessor` in `services/ai-service/src/worker/worker.processor.ts`:
- Imports `resolveBuilderHarnessConfig` from `../agent-harness/builder-profiles`
- Calls adapter inside the `useHarness` branch (after harness route decision), passing `{ agentRole: job.data.agentRole, builderProfileId: job.data.builderProfileId }` and `DEFAULT_AGENT_HARNESS_CONFIG_V1`
- Logs `agent_harness.config_resolved` event with resolution metadata (no sensitive fields)
- Uses `resolvedConfig` throughout the harness branch: `ToolDispatcher`, `read_file`, `write_file`, `delete_file`, `run_validation`, `browser_smoke`, `InMemoryHarnessAuditRecorder`, `executeAgentHarnessLoop` options, pre-apply checkpoint gate

### 4.4 Global DEFAULT_AGENT_HARNESS_CONFIG_V1 Master Gate Preserved

`DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` remains the master environment gate. The `useHarness` decision references only the global constant — the resolved config's `enableToolLoop` is not used as a secondary gate.

### 4.5 Plain Execution Path Unchanged

The plain `aiExecutionService.execute(executionRequest)` path (when `useHarness` is false) is completely unchanged.

### 4.6 07B Files Changed

| File | Change |
|------|--------|
| `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` extended with optional identity fields |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | `AgentHarnessRunRequestV1` extended with optional readonly identity fields |
| `services/ai-service/src/worker/worker.processor.ts` | `resolveBuilderHarnessConfig` imported and called; resolved config flows through harness branch |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Existing tests updated for backward compatibility |
| `services/ai-service/src/worker/__tests__/worker.processor.builder-config.spec.ts` | New: 07B worker integration tests |

---

## 5. Child Slice Scope — AGENT-HARNESS-07C

**Regression matrix:** `docs/AGENT-HARNESS-07C-REGRESSION-MATRIX.md`

### 5.1 Regression Matrix Created

`docs/AGENT-HARNESS-07C-REGRESSION-MATRIX.md` created as Step 2 output. Full static inspection of all 07A and 07B source files, contracts, and test files. No source files changed. No tests, builds, or runtime commands executed.

### 5.2 Parent Acceptance Criteria Validated

All 16 parent AGENT-HARNESS-07 acceptance criteria confirmed satisfied in the regression matrix (§5):

| Acceptance Criterion | Result |
|----------------------|--------|
| Per-builder harness config adapter implemented | **PASS** |
| Builder profile V1 contracts defined | **PASS** |
| Static builder profile registry with `DEFAULT_BUILDER_PROFILE_V1` | **PASS** |
| Default profile preserves current single-builder behavior | **PASS** |
| Worker integration uses resolved config | **PASS** |
| Optional identity fields backward-compatible | **PASS** |
| Global fallback preserved when identity fields absent | **PASS** |
| Global `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` remains master gate | **PASS** |
| No AGENT-HARNESS-06C activation | **PASS** |
| No production tool loop activation | **PASS** |
| No Docker/Postgres/Redis/runtime commands required or executed | **PASS** |
| No frontend changes | **PASS** |
| No DB/migration changes | **PASS** |
| No API Gateway enqueue wiring for identity fields | **PASS** |
| No billing enforcement changes | **PASS** |
| All 07A/07B locked invariants preserved/correctly established | **PASS** |

---

## 6. Validation Evidence

### 6.1 07A Validation (recorded in AGENT-HARNESS-07A-CHECKPOINT.md §6)

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="builder-profile"` | Passed |
| `npx jest --testPathPatterns="builder-harness-config-adapter"` | Passed |
| `npx jest --testPathPatterns="app.module"` | Passed |
| `npm test` | Passed — 32 suites, 594 tests, 1 skipped |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

### 6.2 07B Validation (recorded in AGENT-HARNESS-07B-CHECKPOINT.md §5)

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="worker.processor"` | Passed — 33 suites, 629 tests, 1 skipped |
| `npx jest --testPathPatterns="builder-profile"` | Passed |
| `npx jest --testPathPatterns="builder-harness-config-adapter"` | Passed |
| `npm test` | Passed — 33 suites, 629 tests, 1 skipped (+35 tests vs post-07A) |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

### 6.3 07C Validation

- Regression matrix static inspection: PASS — all checks passed, no blockers identified.
- No tests or builds run in 07C (validation/governance step only).

---

## 7. Known Deferred Items

| Deferred Item | Status | Blocking Task |
|---------------|--------|---------------|
| API Gateway / upstream job submission does not yet populate `agentRole`, `builderProfileId`, or other identity fields in the BullMQ job payload | Deferred — identity fields are optional; fallback path fully covered | Future task (unregistered) |
| Per-profile `enableToolLoop` secondary gate not enforced — global `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` remains sole production gate | Intentional design decision per 07B locked invariant | Future task (unregistered) |
| Live canary / browser smoke | Deferred to AGENT-HARNESS-06C or later with explicit Keith approval | AGENT-HARNESS-06C — not registered |
| Multi-builder orchestration (routing, referral, session-per-builder) | Deferred | Unregistered future tasks |
| Billing attribution wiring (per-builder credit deduction) | Deferred | BILLING-READY-04+ family |

---

## 8. AGENT-HARNESS-06C Status

- **Prerequisite:** AGENT-HARNESS-07 is now COMPLETE and LOCKED — 06C's declared prerequisite is satisfied from a prerequisite standpoint.
- **Registration status:** **Not registered.**
- **Activation status:** **Deferred.** AGENT-HARNESS-06C must not be registered or activated until Keith explicitly approves canary activation. The prerequisite being satisfied does not constitute approval.

---

## 9. Non-Goals Confirmed

The following were explicitly out of scope for AGENT-HARNESS-07 and all child slices:

- No AGENT-HARNESS-06C activation
- No production tool-loop activation (`AGENT_HARNESS_ENABLE_TOOL_LOOP` not set)
- No env changes
- No Docker/Postgres/Redis/runtime commands
- No frontend changes
- No API Gateway enqueue wiring for identity fields
- No database/migration changes
- No billing enforcement
- No Stripe/payment
- No multi-builder orchestration

---

## 10. Locked Invariants

The following are now locked. Do not modify without registering a new task:

- `BuilderHarnessProfileV1` contract shape
- `BuilderProfileV1` contract shape
- `BuilderHarnessConfigAdapterResultV1` contract shape
- `resolveBuilderHarnessConfig` function signature and platform safety enforcement behavior
- `DEFAULT_BUILDER_PROFILE_V1` identity (`builderProfileId: 'builder-default'`, `agentRole: 'builder'`, no harness overrides)
- `AiExecutionJob` optional identity field shape (`agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`)
- `AgentHarnessRunRequestV1` optional identity field shape (matching the above, all `readonly`)
- `WorkerProcessor` call to `resolveBuilderHarnessConfig` before harness route decision
- Resolved config as the single source of truth for all harness branch config values
- `DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` as master env gate (not the resolved config)
- Plain execution path unchanged

---

## 11. Next Recommended Step

**AGENT-HARNESS-06C — Read-Only Harness Canary Execution** (not registered)

AGENT-HARNESS-06C's prerequisite (AGENT-HARNESS-07) is now satisfied. However, AGENT-HARNESS-06C must not be registered or activated until Keith explicitly approves canary activation.

Do not register AGENT-HARNESS-06C without explicit Keith approval.

---

## 12. References

- `docs/AGENT-HARNESS-07A-CHECKPOINT.md` — 07A checkpoint (builder profile registry + adapter)
- `docs/AGENT-HARNESS-07B-CHECKPOINT.md` — 07B checkpoint (worker integration + resolved config flow)
- `docs/AGENT-HARNESS-07C-REGRESSION-MATRIX.md` — 07C regression matrix (validation)
- `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` — prerequisite topology plan
- `docs/AGENT-PLATFORM-04-CHECKPOINT.md` — AGENT-PLATFORM-04 checkpoint
- `TASKS.md` → AGENT-HARNESS-07
- `TASKS_BACKLOG_FULL.md` → AGENT-HARNESS-07
- `docs/AINOW-EXECUTION-ROADMAP.md` → §3 row 9
