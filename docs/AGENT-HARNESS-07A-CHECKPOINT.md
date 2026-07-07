# AGENT-HARNESS-07A Checkpoint

**Task:** AGENT-HARNESS-07A — Backend Builder Profile Registry + Adapter Contract
**Status:** COMPLETE and LOCKED
**Date:** 2026-07-07
**Parent task:** AGENT-HARNESS-07 — Per-Builder Harness Config Adapter (ACTIVE)

---

## 1. Task Summary

AGENT-HARNESS-07A is the first active child slice of AGENT-HARNESS-07. It implements the backend static builder profile registry, all typed V1 contracts, and the pure per-builder harness config adapter. No worker integration, no job payload changes, no runtime behavior changes, and no frontend changes were made in this slice.

---

## 2. Status Hierarchy

| Task | Status |
|------|--------|
| AGENT-HARNESS-07A | **COMPLETE and LOCKED** |
| AGENT-HARNESS-07 (parent) | **ACTIVE** — 07B and 07C remain |
| AGENT-HARNESS-07B | Not registered — future (after 07A COMPLETE and LOCKED) |
| AGENT-HARNESS-07C | Not registered — future (after 07B COMPLETE and LOCKED) |
| AGENT-HARNESS-06C | Not registered — deferred until AGENT-HARNESS-07 is COMPLETE and LOCKED |
| AGENT-PLATFORM-04 | COMPLETE and LOCKED |

---

## 3. Scope Completed

### 3.1 Builder Profile V1 Contracts

Typed contracts for per-builder harness config resolution. Shape-only — no runtime behavior, no env reads, no I/O.

Key contract types:

- `BuilderHarnessProfileV1` — per-builder overrides for harness config fields
- `BuilderModelProfileV1` — per-builder model selection hints
- `BuilderToolPermissionsV1` — per-builder tool access control
- `BuilderRuntimeLimitsV1` — per-builder session/workspace constraints
- `BuilderProfileV1` — top-level per-builder identity and config bundle
- `BuilderHarnessConfigAdapterInputV1` — adapter input shape
- `BuilderHarnessConfigResolutionSourceV1` — resolution source enum
- `BuilderHarnessConfigResolutionMetadataV1` — resolution audit metadata
- `BuilderHarnessConfigAdapterResultV1` — adapter output (config + metadata)

### 3.2 Static Default Builder Profile Registry

Static, data-only registry. No env reads, no async, no I/O.

`DEFAULT_BUILDER_PROFILE_V1` (`builderProfileId: 'builder-default'`):
- Preserves current single-builder behavior — no harness overrides defined, so all config fields resolve from global defaults.
- `agentRole: 'builder'`, `enabled: true`, `profileVersion: 1`.

Exported functions:
- `getBuilderProfile(id)` — returns profile by ID or undefined
- `listBuilderProfiles()` — returns full list
- `listEnabledBuilderProfiles()` — returns only enabled profiles
- `isBuilderProfileEnabled(id)` — boolean check

### 3.3 Pure Per-Builder Harness Config Adapter

Pure function — no env reads, no async, no I/O. Resolves `AgentHarnessRuntimeConfigV1` for a given builder profile, falling back to the global default for missing fields.

Resolution paths:
- `global-default-non-builder-role` — non-builder `agentRole` returns global default with warning
- `global-default-missing-profile` — no `builderProfileId` provided returns global default
- `global-default-unknown-profile` — unknown `builderProfileId` returns global default with warning
- `builder-profile` — known profile found; harness profile fields merged over global default

Platform safety enforcement:
- **Approval floor fields** (`requireApprovalForDelete`, `requireApprovalForPackageInstall`, `requireApprovalForEnvFileWrite`, `requireApprovalForLargeWrite`) cannot be weakened below global/platform `true`. Any attempt is silently reversed and recorded in `metadata.warnings`.
- **`allowArbitraryShell` platform veto** — cannot become `true` if global default is `false`. Any attempt is silently reversed and recorded in `metadata.warnings`.

Resolution metadata tracks:
- `source` — resolution path taken
- `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`
- `fieldsOverridden` — fields taken from builder harness profile
- `fieldsDefaulted` — fields taken from global default
- `warnings` — platform floor/veto enforcement messages

### 3.4 Module Barrel Export

`index.ts` re-exports all contracts, registry functions, and the adapter function.

---

## 4. Files Created

| File | Description |
|------|-------------|
| `services/ai-service/src/agent-harness/builder-profiles/builder-profile.contracts.ts` | V1 typed contracts — shape only |
| `services/ai-service/src/agent-harness/builder-profiles/builder-profile.registry.ts` | Static default builder profile registry |
| `services/ai-service/src/agent-harness/builder-profiles/builder-harness-config-adapter.ts` | Pure per-builder harness config adapter |
| `services/ai-service/src/agent-harness/builder-profiles/index.ts` | Barrel export |
| `services/ai-service/src/agent-harness/builder-profiles/__tests__/builder-profile.registry.spec.ts` | Registry unit tests |
| `services/ai-service/src/agent-harness/builder-profiles/__tests__/builder-harness-config-adapter.spec.ts` | Adapter unit tests |

---

## 5. Validation Blocker Fix

**File changed:** `services/ai-service/src/__tests__/app.module.spec.ts`

**Reason:** Pre-existing app.module spec was written to require live infrastructure env vars, causing non-deterministic failures in CI and developer environments without Docker/Redis. The fix made the spec deterministic and infra-independent by setting only minimal required process.env entries in `beforeEach` (not the full live infrastructure stack).

**Scope:** Test file only. No production config weakened. No Docker/Redis dependency added. No source module behavior changed.

---

## 6. Validation Evidence

All validation run in `services/ai-service/` context:

| Command | Result |
|---------|--------|
| `npx jest --testPathPatterns="builder-profile"` | Passed |
| `npx jest --testPathPatterns="builder-harness-config-adapter"` | Passed |
| `npx jest --testPathPatterns="app.module"` | Passed |
| `npm test` | Passed — 32 suites, 594 tests, 1 skipped |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

---

## 7. Non-Goals Confirmed

The following were explicitly out of scope for AGENT-HARNESS-07A and were not touched:

- No worker integration (`WorkerProcessor` unchanged)
- No job payload changes
- No `AgentHarnessRunRequestV1` changes
- No runtime behavior changes
- No harness/tool loop activation
- No frontend changes
- No DB/migration changes
- No Docker/Postgres/Redis/runtime commands

---

## 8. Locked Invariants for 07B

The following contracts are now locked and must not be modified without registering a new task:

- `BuilderHarnessProfileV1` contract shape
- `BuilderProfileV1` contract shape
- `BuilderHarnessConfigAdapterResultV1` contract shape
- `resolveBuilderHarnessConfig` function signature and platform safety enforcement behavior
- `DEFAULT_BUILDER_PROFILE_V1` identity (`builderProfileId: 'builder-default'`, `agentRole: 'builder'`, no harness overrides)

AGENT-HARNESS-07B (Worker Integration + Resolved Config Flow) must call `resolveBuilderHarnessConfig` using the contracts established here.

---

## 9. Next Recommended Step

**AGENT-HARNESS-07B — Worker Integration + Resolved Config Flow** (not yet registered)

Scope when registered:
- `WorkerProcessor` calls `resolveBuilderHarnessConfig` to resolve per-builder config before dispatching
- `AgentHarnessRunRequestV1` extended with: `agentRole`, `builderProfileId`, `harnessProfileId`, `modelProfileId`, `toolPermissionProfileId`
- Resolved config passed to `executeAgentHarnessLoop`
- Fallback to global default preserved
- Unit tests cover worker dispatch with resolved config

Do not register AGENT-HARNESS-07B until explicitly approved.

---

## 10. References

- `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` — topology plan (prerequisite)
- `docs/AGENT-PLATFORM-04-CHECKPOINT.md` — AGENT-PLATFORM-04 checkpoint
- `TASKS.md` → AGENT-HARNESS-07 / AGENT-HARNESS-07A
- `TASKS_BACKLOG_FULL.md` → AGENT-HARNESS-07 / AGENT-HARNESS-07A
