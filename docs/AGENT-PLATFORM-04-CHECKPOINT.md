# AGENT-PLATFORM-04 — Multi-Builder Runtime Topology Plan — Checkpoint

**Task ID:** AGENT-PLATFORM-04
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-07
**Family:** AGENT PLATFORM / MULTI-BUILDER TOPOLOGY
**Nature:** ARCHITECTURE / PLANNING / GOVERNANCE — no implementation

---

## 1. Task Summary

AGENT-PLATFORM-04 produced the authoritative Multi-Builder Runtime Topology Plan for the ainow.biz platform. This plan defines how multiple Builder Agents can coexist with different configurations, isolation boundaries, and runtime identities before AGENT-HARNESS-07 (Per-Builder Harness Config Adapter) or any multi-agent runtime orchestration proceeds.

No source code was changed. No harness was activated. No migrations were created. No frontend or backend runtime behavior was altered.

---

## 2. Topology Plan Document

**Created:** `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`

---

## 3. Key Topology Decisions

| Decision | Choice |
|----------|--------|
| Identity model | Role + Profile — `agentRole` + `builderProfileId` |
| Session isolation | 1 Builder profile execution = 1 session = 1 container/workspace |
| Preview/checkpoint scope | Session-scoped initially — not global-agent scoped |
| Harness config resolution | Per-builder adapter with global config fallback (AGENT-HARNESS-07) |
| Non-Builder runtime | Separate, lightweight, future — do not force Builder harness onto non-Builder agents |
| Billing attribution | Populate existing `agentId` with `builderProfileId`; add `agentRole` + `builderProfileId` to `UsageRecord` and deduction events |
| Safety enforcement | Platform-level, not per-profile overridable — high-risk actions always require approval |
| Orchestration prerequisites | Safety limits mandatory before multi-builder runtime orchestration |

---

## 4. AGENT-HARNESS-07 Handoff

AGENT-HARNESS-07 must implement the **Per-Builder Harness Config Adapter**:

- Accepts `builderProfileId` from job payload / run request
- Resolves `BuilderProfile` from a backend registry
- Translates `BuilderHarnessProfile` manifest fields into `AgentHarnessConfigV1`
- Returns resolved config to the worker for use in execution
- Falls back to `DEFAULT_AGENT_HARNESS_CONFIG_V1` (global config) if `builderProfileId` is absent or unresolvable
- Must be registered and implemented **before** AGENT-HARNESS-06C activates

**AGENT-HARNESS-07 status:** Not registered. Next recommended task — must be registered after AGENT-PLATFORM-04 is COMPLETE and LOCKED.

---

## 5. Billing / Audit Attribution Decisions

| Entity | Current State | Required Future State |
|--------|--------------|----------------------|
| `UsageRecord` | No agent identity | Add `agentRole`, `builderProfileId` (nullable) |
| `CreditDeductionRecord.agentId` | Nullable, never populated | Populate with `builderProfileId` |
| `CreditDeductionRecord` | No `agentRole` | Consider adding `agentRole` (nullable) |
| `CreditDeductionEvent` | `agentId` optional | Pass `agentRole` + `builderProfileId` explicitly |
| Audit events (`AgentHarnessAuditEventV1`) | No agent identity | Add `agentRole`, `builderProfileId`, `harnessProfileId` |

These are future implementation requirements. Not implemented in AGENT-PLATFORM-04.

---

## 6. Builder vs Non-Builder Runtime Boundary

- **Builder Agent** requires full aiSandBox harness: Docker container, isolated `/workspace`, file tools, validation runner, git checkpoint/revert, preview server, Agent Harness tool loop.
- **Chief of Staff / Product Strategy / Technology Advisor** must NOT be forced into the Builder harness. These agents use lightweight runtime (knowledge retrieval, document analysis, strategic recommendation) — designed independently from the Builder harness.

---

## 7. Safety Boundaries

| Rule | Status |
|------|--------|
| No implicit file/tool escalation | Required — enforced by per-builder `toolPermissions` |
| No shared workspace writes without explicit routing/locking | Required — deferred to future collaboration task |
| No hidden cross-agent tool access | Required — tool dispatch scoped to executing agent's permissions |
| No uncontrolled Builder-to-Builder referral recursion | Required — max referral depth, max agents, idempotency, loop prevention, approval threshold before orchestration |

---

## 8. Future UX/UI Constraints

- aiSandBox is multilingual-first.
- Any new user-facing text for multi-builder selection or agent identity display must update `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`.
- Use existing translation hook/pattern.
- Icons: Heroicons v2 Outline only.
- Advisory skills (Impeccable, Emil Kowalski) are advisory only — must not override governance, scope, architecture, or tests.

---

## 9. Non-Goals Confirmed

- No source code changes in this task.
- No frontend changes.
- No backend runtime changes.
- No harness activation.
- No AGENT-HARNESS-07 registration.
- No AGENT-HARNESS-06C execution.
- No database migrations.
- No Docker/Postgres/database commands.

---

## 10. Acceptance Criteria — All Satisfied

- [x] AGENT-PLATFORM-04 registered in TASKS.md
- [x] AGENT-PLATFORM-04 mirrored in TASKS_BACKLOG_FULL.md
- [x] AINOW-EXECUTION-ROADMAP.md updated
- [x] AGENT-HARNESS-07 remains future/not registered
- [x] AGENT-HARNESS-06C remains deferred
- [x] BILLING-READY-03 remains COMPLETE and LOCKED
- [x] No implementation files changed
- [x] Multi-Builder Runtime Topology Plan created at `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md`
- [x] Checkpoint document created at `docs/AGENT-PLATFORM-04-CHECKPOINT.md`
- [x] AGENT-PLATFORM-04 marked COMPLETE and LOCKED in TASKS.md, TASKS_BACKLOG_FULL.md, AINOW-EXECUTION-ROADMAP.md

---

## 11. Files Changed in AGENT-PLATFORM-04

| File | Change |
|------|--------|
| `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` | Created (Step 3) |
| `docs/AGENT-PLATFORM-04-CHECKPOINT.md` | Created (Step 4 — this file) |
| `TASKS.md` | AGENT-PLATFORM-04 marked COMPLETE and LOCKED |
| `TASKS_BACKLOG_FULL.md` | Mirrored from TASKS.md |
| `docs/AINOW-EXECUTION-ROADMAP.md` | AGENT-PLATFORM-04 marked COMPLETE and LOCKED |

No source files, tests, runtime files, migrations, or environment files were changed.

---

## 12. Next Step

**AGENT-HARNESS-07 — Per-Builder Harness Config Adapter**

- Status: Not registered. Next recommended task.
- Must be registered in a dedicated registration step before implementation.
- Must be implemented before AGENT-HARNESS-06C activates.
- Topology plan in `docs/AGENT-PLATFORM-04-MULTI-BUILDER-TOPOLOGY-PLAN.md` section 7 defines the adapter requirements.

---

## Document Metadata

- **Created:** 2026-07-07
- **Task:** AGENT-PLATFORM-04 Step 4 — Consolidation/Checkpoint
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
