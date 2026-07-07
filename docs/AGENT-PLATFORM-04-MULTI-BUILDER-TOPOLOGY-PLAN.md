# AGENT-PLATFORM-04 — Multi-Builder Runtime Topology Plan

**Task ID:** AGENT-PLATFORM-04
**Status:** Step 3 COMPLETE — Topology Plan Created (2026-07-07)
**Family:** AGENT PLATFORM / MULTI-BUILDER TOPOLOGY
**Nature:** ARCHITECTURE / PLANNING / GOVERNANCE — no implementation
**Scope:** Documentation only — no source edits, no runtime changes, no checkpoint

---

## 1. Problem Statement

The current aiSandBox platform supports exactly one Builder Agent identity in its runtime stack. The following structural limitations prevent multi-builder operation:

| Gap | Current State | Required State |
|-----|--------------|----------------|
| **Single Builder ID** | Frontend `AGENT_IDS` contains one `'builder'` entry. There is no concept of Builder profiles or Builder variants. | Multiple Builder profiles under the `builder` role, each with distinct configuration. |
| **Global Harness Config** | `createAgentHarnessConfigV1()` produces a single global `AgentHarnessRuntimeConfigV1` from `process.env`. All executions share identical config. | Per-Builder harness config resolution at execution time. |
| **No Agent Identity in Runtime** | `AgentHarnessRunRequestV1` carries `sessionId`, `userId`, `conversationId`, `mode` — but no `agentRole`, `builderProfileId`, or `harnessProfileId`. | Every execution request carries full agent identity. |
| **No Agent Identity in Worker** | `WorkerProcessor` reads job data with no builder profile awareness. Harness route decision uses only `job.data.harnessVersion` and global config. | Worker resolves per-builder config before dispatching. |
| **No Agent Identity in Sessions** | `Session` entity has `userId` and `projectId` but no agent identity fields. Container-manager creates sessions without builder identity. | Sessions carry `agentRole` and `builderProfileId` for isolation and audit. |
| **No Agent Identity in Usage Ledger** | `UsageRecord` tracks `userId`, `sessionId`, `provider`, `model` — no agent identity. | Usage records carry `agentRole` and `builderProfileId` for attribution. |
| **Partial in Billing** | `CreditDeductionRecord.agentId` exists (nullable) but is never populated. | Billing records populated with `agentRole` and `builderProfileId`. |
| **No Backend Registry** | Agent registry exists only in frontend (`frontend/lib/agent-platform/agent-registry.ts`). Backend has no registry service. | Backend agent registry resolves profiles at execution time. |

**Consequence:** AGENT-HARNESS-07 (Per-Builder Harness Config Adapter) cannot proceed without this topology plan defining how builder identity flows through the system.

---

## 2. Recommended Topology: Agent Role + Builder Profile Identity Model

### 2.1 Identity Model

Every Builder execution is identified by two orthogonal concepts:

| Concept | Description | Examples |
|---------|-------------|----------|
| **agentRole** | The stable role category. Determines which runtime class the agent belongs to. | `builder`, `chief-of-staff`, `product-strategy`, `technology-advisor` |
| **builderProfileId** | The specific Builder profile within the `builder` role. Differentiates Builder A from Builder B. | `builder-default`, `builder-fullstack`, `builder-frontend-only`, `builder-data-pipeline` |

**Key decisions:**
- `agentRole` is a discriminator, not an identity. It determines which runtime capabilities are required.
- `builderProfileId` is the specific identity. It resolves to a concrete manifest/profile with model, tool, knowledge, and harness configuration.
- Non-Builder agents use `agentRole` only (no `builderProfileId`). Their profiles are resolved directly from their `agentRole`.
- No hidden shared Builder identity is created. Every Builder execution must explicitly declare both `agentRole = 'builder'` AND a `builderProfileId`.

### 2.2 Why Not Agent ID Alone

The existing `AgentManifest.id` field (`'builder'`, `'chief-of-staff'`, etc.) works for role-level routing. But it cannot express "Builder profile A vs Builder profile B" without:
- Either overloading the id space (e.g., `builder-fullstack`, `builder-frontend-only` become top-level agent IDs — breaks role semantics)
- Or adding a profile dimension under the role

The role + profile model preserves the current agent registry structure while adding the required multi-builder distinction.

---

## 3. Registry Model

### 3.1 Structural Hierarchy

```
AgentRole (builder | chief-of-staff | product-strategy | technology-advisor)
  └── AgentManifest (one per role for non-Builder agents)
  └── BuilderProfile[] (multiple per Builder role)
        └── modelProfile
        └── toolPermissions
        └── knowledgeScopes
        └── skills
        └── referralRules
        └── approvalRules
        └── harnessProfile
        └── runtimeLimits
```

### 3.2 Builder Profile Shape (Conceptual)

```typescript
interface BuilderProfile {
  readonly builderProfileId: string;
  readonly nameKey: AgentTextTranslationKey;
  readonly descriptionKey: AgentTextTranslationKey;
  readonly modelProfile: AgentModelProfile;
  readonly toolPermissions: AgentToolPermissions;
  readonly knowledgeScopes: readonly AgentKnowledgeScopeRef[];
  readonly skills: readonly AgentSkillRef[];
  readonly referralRules: readonly AgentReferralRule[];
  readonly approvalRules: readonly AgentApprovalRule[];
  readonly harnessProfile: BuilderHarnessProfile;
  readonly runtimeLimits: BuilderRuntimeLimits;
  readonly enabled: boolean;
  readonly profileVersion: number;
}
```

### 3.3 Builder Harness Profile Shape (Conceptual)

```typescript
interface BuilderHarnessProfile {
  readonly harnessProfileId: string;
  readonly maxToolIterations: number;
  readonly maxFileReadBytes: number;
  readonly maxFileWriteBytes: number;
  readonly maxToolResultBytes: number;
  readonly maxValidationOutputBytes: number;
  readonly toolTimeoutMs: number;
  readonly validationTimeoutMs: number;
  readonly browserSmokeTimeoutMs: number;
  readonly enableBrowserSmoke: boolean;
  readonly enableSemanticSearch: boolean;
  readonly enableToolLoop: boolean;
  readonly enablePreApplyCheckpoint: boolean;
  readonly enableWriteTools: boolean;
  readonly enableValidationTools: boolean;
  readonly auditEventsEnabled: boolean;
  readonly allowArbitraryShell: boolean;
  readonly allowedValidationCommands: readonly string[];
  readonly requireApprovalForDelete: boolean;
  readonly requireApprovalForPackageInstall: boolean;
  readonly requireApprovalForEnvFileWrite: boolean;
  readonly requireApprovalForLargeWrite: boolean;
}
```

### 3.4 Builder Runtime Limits Shape (Conceptual)

```typescript
interface BuilderRuntimeLimits {
  readonly maxConcurrentSessions: number;
  readonly maxSessionLifetimeMs: number;
  readonly maxIdleTimeoutMs: number;
  readonly maxWorkspaceSizeMB: number;
  readonly maxFileCount: number;
}
```

### 3.5 Non-Builder Agents

Existing non-Builder agents remain unchanged:
- `chief-of-staff` — coming_soon placeholder
- `product-strategy` — coming_soon placeholder
- `technology-advisor` — coming_soon placeholder

These agents do NOT have `BuilderProfile` or `BuilderHarnessProfile`. They use their `AgentManifest` directly for whatever lightweight runtime they eventually require.

---

## 4. Session/Container Isolation Model

### 4.1 Recommended Isolation Rule

**1 Builder profile execution = 1 session = 1 container/workspace.**

| Property | Value |
|----------|-------|
| Session-to-builder-profile | 1:1 per active execution |
| Container-to-session | 1:1 |
| Workspace-to-session | 1:1 |
| File operations scope | Session-scoped |
| Preview scope | Session-scoped |
| Checkpoint/revert scope | Session-scoped |
| Git operations scope | Session-scoped |

### 4.2 Shared Workspace Writes

Shared workspace writes (multiple Builder profiles writing to the same workspace/project) require explicit routing and locking. This is **not** implemented by this plan. It is deferred to a future multi-builder collaboration/orchestration task that must define:

- Write lock acquisition protocol
- Conflict resolution strategy
- File-level or directory-level locking granularity
- Notification/sync between concurrent Builder sessions

### 4.3 Preview/Checkpoint/File Operations

All preview, checkpoint, and file operations remain **session-scoped** initially:

- Preview server binds to the session's container
- Checkpoints are per-session git commits
- File tree is per-session workspace
- Revert restores per-session checkpoint

These operations are NOT made global-agent scoped in this plan. Global scoping requires the shared-workspace collaboration model defined above.

---

## 5. Runtime Identity Flow

The following describes how agent identity flows through the system end-to-end:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. FRONTEND — Registry / Profile Selection                              │
│    User selects or is assigned a Builder profile.                        │
│    Frontend reads from agent registry + builder profiles.               │
│    Emits: agentRole='builder', builderProfileId='builder-X'             │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. SESSION CREATION                                                     │
│    POST /api/sessions { userId, projectId, agentRole, builderProfileId }│
│    Session record carries agentRole + builderProfileId.                  │
│    Container/workspace created, scoped to this session.                  │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. API GATEWAY — Execution Request                                      │
│    POST /api/ai/execute { sessionId, prompt, ..., agentRole,            │
│       builderProfileId, harnessProfileId, modelProfileId }              │
│    API Gateway writes UsageRecord with agent identity fields.           │
│    API Gateway enqueues job to ai-execution queue.                       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. QUEUE JOB PAYLOAD                                                    │
│    Job data includes: executionId, sessionId, userId, prompt,           │
│       agentRole, builderProfileId, harnessProfileId, modelProfileId,    │
│       toolPermissionProfileId, harnessVersion                           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. AI-SERVICE WORKER                                                    │
│    WorkerProcessor receives job.                                         │
│    Resolves per-builder harness config via AGENT-HARNESS-07 adapter.    │
│    Uses builderProfileId to select correct AgentHarnessConfigV1.        │
│    Falls back to global default if adapter not yet available.           │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. AgentHarnessRunRequestV1                                             │
│    Extended with: agentRole, builderProfileId, harnessProfileId,        │
│       modelProfileId, toolPermissionProfileId                           │
│    Passed to executeAgentHarnessLoop.                                   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. TOOL DISPATCHER                                                      │
│    ToolDispatcher receives resolved config (per-builder limits).         │
│    Tool registration gated by per-builder toolPermissions.              │
│    Tool approval rules resolved per-builder.                            │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 8. USAGE LEDGER                                                         │
│    UsageRecord updated with completion data.                             │
│    agentRole + builderProfileId preserved on record for attribution.    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 9. CREDIT DEDUCTION EVENT                                               │
│    CreditDeductionEvent carries agentRole + builderProfileId.           │
│    CreditDeductionRecord.agentId populated with builderProfileId.       │
│    Future: separate agentRole column if needed.                          │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 10. AUDIT EVENTS                                                        │
│    AgentHarnessAuditEventV1 payload includes agentRole,                 │
│       builderProfileId, harnessProfileId.                               │
│    Usage events and deduction events carry same identity.               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Required Future Fields

The following fields must be added to relevant data structures in implementation tasks:

| Field | Purpose | Where |
|-------|---------|-------|
| `agentRole` | Role discriminator (builder, chief-of-staff, etc.) | RunRequest, job payload, session, usage record, deduction event, audit event |
| `builderProfileId` | Specific builder profile identity | RunRequest, job payload, session, usage record, deduction event, audit event |
| `harnessProfileId` | Resolved harness config identity for this execution | RunRequest, job payload, audit event |
| `modelProfileId` | Resolved model config identity for this execution | RunRequest, job payload, audit event |
| `toolPermissionProfileId` | Resolved tool permission set for this execution | RunRequest, job payload |
| `agentId` or `manifestId` | Optional — if needed to reference the top-level manifest entry | Job payload (already partially exists as `CreditDeductionRecord.agentId`) |
| `referralTraceId` | Future — traces referral chain in multi-agent collaboration | Job payload, audit event, deduction event (deferred) |
| `collaborationRunId` | Future — groups all executions in a single collaboration workflow | Job payload, audit event, deduction event (deferred) |

---

## 7. Harness Config Handoff for AGENT-HARNESS-07

### 7.1 AGENT-HARNESS-07 Responsibility

AGENT-HARNESS-07 must implement a **Per-Builder Harness Config Adapter** that:

1. Accepts a `builderProfileId` (from job payload / run request)
2. Resolves the corresponding `BuilderProfile` from a backend registry
3. Translates `BuilderProfile` manifest fields into a concrete `AgentHarnessConfigV1` (or `AgentHarnessRuntimeConfigV1`)
4. Returns the resolved config to the worker for use in the execution

### 7.2 Resolution Requirements

The adapter must resolve:

| Config Field | Source |
|-------------|--------|
| `maxToolIterations` | `BuilderHarnessProfile.maxToolIterations` |
| `maxFileReadBytes` | `BuilderHarnessProfile.maxFileReadBytes` |
| `maxFileWriteBytes` | `BuilderHarnessProfile.maxFileWriteBytes` |
| `maxToolResultBytes` | `BuilderHarnessProfile.maxToolResultBytes` |
| `maxValidationOutputBytes` | `BuilderHarnessProfile.maxValidationOutputBytes` |
| `toolTimeoutMs` | `BuilderHarnessProfile.toolTimeoutMs` |
| `validationTimeoutMs` | `BuilderHarnessProfile.validationTimeoutMs` |
| `browserSmokeTimeoutMs` | `BuilderHarnessProfile.browserSmokeTimeoutMs` |
| `enableBrowserSmoke` | `BuilderHarnessProfile.enableBrowserSmoke` |
| `enableSemanticSearch` | `BuilderHarnessProfile.enableSemanticSearch` |
| `enableToolLoop` | `BuilderHarnessProfile.enableToolLoop` |
| `enablePreApplyCheckpoint` | `BuilderHarnessProfile.enablePreApplyCheckpoint` |
| `enableWriteTools` | `BuilderHarnessProfile.enableWriteTools` |
| `enableValidationTools` | `BuilderHarnessProfile.enableValidationTools` |
| `auditEventsEnabled` | `BuilderHarnessProfile.auditEventsEnabled` |
| `allowArbitraryShell` | `BuilderHarnessProfile.allowArbitraryShell` |
| `allowedValidationCommands` | `BuilderHarnessProfile.allowedValidationCommands` |
| `requireApprovalForDelete` | `BuilderHarnessProfile.requireApprovalForDelete` |
| `requireApprovalForPackageInstall` | `BuilderHarnessProfile.requireApprovalForPackageInstall` |
| `requireApprovalForEnvFileWrite` | `BuilderHarnessProfile.requireApprovalForEnvFileWrite` |
| `requireApprovalForLargeWrite` | `BuilderHarnessProfile.requireApprovalForLargeWrite` |
| Model defaults/fallbacks | `BuilderProfile.modelProfile.defaultModelId`, `fallbackModelId` |
| Allowed/blocked/approval tools | `BuilderProfile.toolPermissions` |
| Runtime safety limits | `BuilderProfile.runtimeLimits` |

### 7.3 Fallback Strategy

- If `builderProfileId` is not provided or cannot be resolved → fall back to `DEFAULT_AGENT_HARNESS_CONFIG_V1` (current global config).
- If individual profile fields are missing or invalid → fall back to corresponding global default value.
- The current global config becomes the "default builder profile" until explicit profiles are registered.

### 7.4 AGENT-HARNESS-06C Gate

AGENT-HARNESS-06C (Builder Harness Canary) must NOT activate until the Per-Builder Harness Config Adapter exists. The adapter provides the safety boundary ensuring each builder profile operates within its declared limits.

---

## 8. Builder vs Non-Builder Runtime Boundary

### 8.1 Builder Agent Runtime Requirements

Builder Agent requires the full aiSandBox harness stack:

| Capability | Required |
|-----------|----------|
| Docker container | YES |
| Isolated /workspace filesystem | YES |
| Agent Harness tool loop | YES (when enabled) |
| File read/write/delete tools | YES |
| Validation runner | YES |
| Browser smoke (future) | YES |
| Git checkpoint/revert | YES |
| Preview server | YES |
| Per-session workspace isolation | YES |

### 8.2 Non-Builder Agent Runtime (Future)

Non-Builder agents (Chief of Staff, Product Strategy, Technology Advisor) may use a lightweight runtime initially:

| Capability | Required |
|-----------|----------|
| Docker container | NO (initially) |
| Isolated filesystem | NO (initially) |
| Agent Harness tool loop | NO (initially) |
| File tools | NO (initially) |
| Validation runner | NO |
| Browser smoke | NO |
| Git checkpoint/revert | NO |
| Preview server | NO |
| Knowledge scope access | YES (future) |
| Collaboration protocol | YES (future) |
| Approval gates | YES (future) |

### 8.3 Boundary Enforcement Rule

**Do NOT generalize the Builder harness to all agents.** The Builder runtime is purpose-built for code execution in isolated containers. Non-Builder agents have fundamentally different execution models (knowledge retrieval, document analysis, email triage, strategic recommendation) that do not require container isolation or file-system tools.

Future non-Builder runtime should be designed independently from the Builder harness when those agents become functional.

---

## 9. Billing Attribution

### 9.1 Current State

| Entity | Agent Identity Field | Status |
|--------|---------------------|--------|
| `UsageRecord` | None | No agent identity |
| `CreditDeductionRecord` | `agentId` (nullable) | Exists but never populated |
| `CreditDeductionEvent` | `agentId` (optional) | Passes through to record |

### 9.2 Required Future State

| Entity | Fields to Add/Populate | Purpose |
|--------|----------------------|---------|
| `UsageRecord` | `agentRole`, `builderProfileId` (both nullable initially) | Per-agent usage reporting, plan entitlement enforcement |
| `CreditDeductionRecord` | `agentId` → populated with `builderProfileId` | Per-builder deduction attribution |
| `CreditDeductionRecord` | Consider: `agentRole` (new nullable column) | Role-level deduction reporting |
| `CreditDeductionEvent` | `agentRole`, `builderProfileId` passed explicitly | Clean attribution at event creation time |

### 9.3 Billing Enforcement Rules

- Future billing/entitlement enforcement tasks must avoid ambiguity between Builder profiles.
- Per-builder credit allocation (if offered) requires `builderProfileId` on deduction records.
- Aggregate user-level billing uses `userId` as today — `builderProfileId` is for attribution/reporting, not for separate billing buckets (initially).
- If per-builder billing buckets are introduced later, the `builderProfileId` field is already present for that evolution.

---

## 10. Audit/Events

### 10.1 Harness Audit Events

`AgentHarnessAuditEventV1.payload` should eventually include:

```typescript
{
  agentRole: string;
  builderProfileId: string;
  harnessProfileId: string;
  // ... existing payload fields ...
}
```

### 10.2 Usage Events

Usage records should carry `agentRole` and `builderProfileId` for:
- Per-agent usage dashboards
- Per-builder cost analysis
- Entitlement enforcement per agent (future)

### 10.3 Credit Deduction Events

Credit deduction events and records should carry:
- `agentRole` — which role consumed credits
- `builderProfileId` — which specific profile consumed credits
- Future: `referralTraceId` / `collaborationRunId` for multi-agent collaboration attribution

### 10.4 Collaboration Events (Future)

When multi-agent collaboration is implemented, collaboration events should carry:
- `referralTraceId` — traces the referral chain
- `collaborationRunId` — groups all executions in a single collaboration workflow
- Source agent identity and target agent identity

---

## 11. Safety Boundaries

### 11.1 Mandatory Safety Rules

| Rule | Description |
|------|-------------|
| No implicit file/tool escalation | A Builder profile with restricted tool access cannot gain access to tools not in its `toolPermissions`. |
| No shared workspace writes without explicit routing | Multiple Builder profiles cannot write to the same workspace without a defined locking/routing protocol. |
| No hidden cross-agent tool access | Agent A cannot invoke tools registered to Agent B. Tool dispatch is scoped to the executing agent's permissions. |
| No uncontrolled Builder-to-Builder referral recursion | Referral chains must be bounded. |

### 11.2 Required Before Multi-Builder Orchestration

The following must be defined and enforced before any multi-builder runtime orchestration proceeds:

| Safety Requirement | Status |
|-------------------|--------|
| Max referral depth | REQUIRED — configurable limit before orchestration |
| Max agents per collaboration | REQUIRED — configurable limit before orchestration |
| Duplicate referral idempotency | REQUIRED — idempotency key on referrals before orchestration |
| Referral loop prevention | REQUIRED — chain path tracking before orchestration |
| Threshold pause + owner approval | REQUIRED — auto-pause at safety limits before orchestration |

### 11.3 High-Risk Action Defaults

The following action categories require approval defaults regardless of builder profile configuration:

- Legal commitments
- Financial transactions
- Contract acceptance/modification
- Public-facing content publishing
- External communications
- Permission/access changes
- Data deletion (irreversible)

These defaults are enforced at the platform level and cannot be overridden by individual builder profile manifests.

---

## 12. Future Implementation Sequence

| # | Step | Nature | Dependencies |
|---|------|--------|-------------|
| 1 | **AGENT-PLATFORM-04** completes topology plan | Governance (THIS TASK) | None — completes now |
| 2 | **AGENT-HARNESS-07** registration/planning | Registration + planning | AGENT-PLATFORM-04 complete |
| 3 | **AGENT-HARNESS-07** implementation — Per-Builder Harness Config Adapter | Implementation | AGENT-HARNESS-07 registration |
| 4 | **AGENT-HARNESS-06C** — Builder harness canary | Runtime activation | AGENT-HARNESS-07 implementation complete |
| 5 | Multi-builder collaboration/runtime orchestration | Future planning + implementation | AGENT-HARNESS-06C, safety boundaries defined |
| 6 | Billing enforcement / entitlement gating | Future planning + implementation | Clarified agent attribution fields populated |

**Rules:**
- AGENT-HARNESS-07 must NOT be registered until AGENT-PLATFORM-04 is COMPLETE and LOCKED.
- AGENT-HARNESS-06C must NOT activate until AGENT-HARNESS-07 adapter exists.
- Multi-builder orchestration must NOT proceed until safety boundaries (section 11.2) are defined and enforced.
- Billing enforcement must NOT proceed until agent attribution fields are populated in production records.

---

## 13. UX/UI Future Note

If future UI work is added for multi-builder selection, profile configuration, or agent identity display:

- aiSandBox is multilingual-first.
- Any new user-facing text must update:
  - `frontend/messages/en.json`
  - `frontend/messages/zh-TW.json`
  - `frontend/messages/zh-CN.json`
- Use existing translation hook/pattern.
- Icons: Heroicons v2 Outline only.
- Advisory skills (Impeccable, Emil Kowalski) are advisory only — must not override governance, scope, architecture, or tests.

---

## 14. Topology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Identity model | Role + Profile (agentRole + builderProfileId) | Preserves existing registry; adds per-builder differentiation without breaking role semantics |
| Session isolation | 1 builder profile execution = 1 session = 1 container | Simplest correct isolation; shared writes deferred |
| Preview/checkpoint scope | Session-scoped (not global-agent) | Current system is session-scoped; changing requires collaboration model |
| Harness config resolution | Per-builder adapter with global fallback | Allows incremental adoption; existing behavior preserved as default |
| Non-Builder runtime | Separate, lightweight, future | Do not force container/harness requirements onto non-Builder agents |
| Billing attribution | Populate existing `agentId`, add `agentRole` + `builderProfileId` | Uses existing schema where possible; minimal migration |
| Safety enforcement | Platform-level, not per-profile overridable | High-risk actions always require approval regardless of profile config |
| Orchestration prerequisites | Safety limits mandatory before multi-builder runtime | Prevents runaway referral chains and resource exhaustion |

---

## 15. What This Plan Does NOT Do

- Does NOT implement any source code changes
- Does NOT register AGENT-HARNESS-07
- Does NOT activate AGENT-HARNESS-06C
- Does NOT create database migrations
- Does NOT change frontend/backend/container-manager code
- Does NOT define concrete TypeScript implementations (shapes above are conceptual)
- Does NOT register multi-builder orchestration tasks
- Does NOT change billing enforcement or Stripe integration
- Does NOT define shared-workspace collaboration protocol (deferred)
- Does NOT enable any runtime feature gates

---

## Document Metadata

- **Created:** 2026-07-07
- **Task:** AGENT-PLATFORM-04 Step 3
- **Status:** Step 3 COMPLETE — Topology Plan Created
- **Author:** AI-assisted governance pass
- **Source:** Current codebase analysis (agent-registry.ts, agent-harness.contracts.ts, agent-harness.config.ts, worker.processor.ts, session.entity.ts, usage-record.entity.ts, credit-deduction-record.entity.ts, sessions.service.ts) + AGENT-PLATFORM-00 master plan
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
