# AGENT-PLATFORM-05 — Multi-Builder Runtime Orchestration Plan — Checkpoint

**Task ID:** AGENT-PLATFORM-05
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-09
**Family:** AGENT PLATFORM / MULTI-BUILDER ORCHESTRATION
**Nature:** PLANNING / GOVERNANCE ONLY — no implementation, no runtime execution
**Checkpoint created:** 2026-07-09

---

## 1. Task Summary

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-05 |
| Steps | 4-step loop (Registration → Readiness Review → Orchestration Plan → Consolidation) |
| Nature | Planning/governance only |
| Implementation | NONE — this task produced planning documents only |
| Runtime execution | NONE — no services started, no jobs executed, no containers created |
| Keith approval | Registration approved 2026-07-09 |
| Final status | COMPLETE and LOCKED |

---

## 2. Workflow Steps — All COMPLETE

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration | COMPLETE and LOCKED | 2026-07-09 |
| 2 | Orchestration Readiness Review | COMPLETE and LOCKED | 2026-07-09 |
| 3 | Multi-Builder Orchestration Plan Document | COMPLETE and LOCKED | 2026-07-09 |
| 4 | Consolidation/Checkpoint (this step) | COMPLETE and LOCKED | 2026-07-09 |

---

## 3. Documents Produced

| File | Description |
|------|-------------|
| `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md` | Step 2 — Orchestration readiness review (created 2026-07-09) |
| `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` | Step 3 — Multi-builder orchestration plan document, 19 sections (created 2026-07-09) |
| `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | Step 4 — This checkpoint document (created 2026-07-09) |

---

## 4. Step 2 — Orchestration Readiness Review Summary

**File created:** `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md`

### Governance Readiness: PASS

| Criterion | Result |
|-----------|--------|
| AGENT-PLATFORM-05 ACTIVE | PASS |
| AGENT-PLATFORM-04 COMPLETE and LOCKED | PASS |
| AGENT-HARNESS-07 COMPLETE and LOCKED | PASS |
| AGENT-HARNESS-06E COMPLETE and LOCKED | PASS |
| One-active-task rule satisfied | PASS |

### Current Foundation Summarized

- **AGENT-PLATFORM-04:** Role + Profile identity model (`agentRole` + `builderProfileId`), 1:1 session/container isolation, shared workspace writes explicitly deferred.
- **AGENT-HARNESS-07:** V1 typed contracts (`BuilderProfileV1`, `BuilderHarnessProfileV1`), static `DEFAULT_BUILDER_PROFILE_V1`, `resolveBuilderHarnessConfig()` pure function adapter, `WorkerProcessor` integration.
- **AGENT-HARNESS-06E:** Full E2E read-only file path validated — `list_files` SUCCESS, `read_file` SUCCESS through Worker → ToolDispatcher → ApiGatewayHttpClient → API Gateway → container-manager → Docker container filesystem.

### Orchestration Gaps Identified

| Gap | Status |
|-----|--------|
| No `collaborationRunId` | ABSENT |
| No `referralTraceId` | ABSENT |
| No Builder A/B runtime coordinator | ABSENT |
| No upstream job submission identity wiring | ABSENT — API Gateway enqueue never populates `agentRole`/`builderProfileId` |
| No shared workspace locking | ABSENT |
| No multi-builder conflict resolution | ABSENT |
| No orchestration queue/routing policy | ABSENT |
| No collaboration audit model (typed) | ABSENT |
| No per-builder billing attribution runtime path | PARTIAL — `CreditDeductionRecord.agentId` column exists, never populated |
| No approval gate orchestration | ABSENT |

---

## 5. Step 3 — Orchestration Plan Document Summary

**File created:** `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md`
**Sections:** 19 (plus Key Decisions summary at §20)
**Zero blockers at time of plan creation.**

### 19 Plan Sections

| # | Section |
|---|---------|
| 1 | Task Summary |
| 2 | Foundation Summary (AGENT-PLATFORM-04, AGENT-HARNESS-07, AGENT-HARNESS-06E) |
| 3 | Orchestration Goal (read-only first, write deferral) |
| 4 | Identity Model (`agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`) |
| 5 | Initial Orchestration Topology (1 builder = 1 session = 1 container) |
| 6 | Builder A/B Routing Model (single queue, metadata routing) |
| 7 | Session/Workspace/Container Ownership |
| 8 | Referral/Collaboration Flow (referral object shape, approval points, cancellation behavior) |
| 9 | Safety Limits (max depth, max agents, idempotency, loop prevention, timeouts) |
| 10 | File/Write Safety Model (read-only first; write enablement gates) |
| 11 | Shared Workspace Conflict Strategy (workspace-level mutex when writes eventually enabled) |
| 12 | Approval Model (platform-level mandatory approvals; per-collaboration gates) |
| 13 | Audit and Observability (event schemas, `OrchestrationAuditEvent` interface) |
| 14 | Billing Attribution (agentRole/builderProfileId attribution; enforcement deferred) |
| 15 | API Gateway / Upstream Identity Wiring Needs |
| 16 | UX/UI Future Constraints (multilingual-first, Heroicons v2 Outline) |
| 17 | Recommended Implementation Sequence (7 future slices) |
| 18 | Non-Goals |
| 19 | Readiness Conclusion (AGENT-PLATFORM-05 ready for Step 4) |

---

## 6. Key Decisions Locked

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Initial orchestration mode | Read-only | Safety first; write tools not validated for multi-builder |
| Routing model | Single queue, metadata routing | Simplest; uses existing BullMQ; no infrastructure changes |
| Session isolation | 1 builder = 1 session = 1 container | Preserves AGENT-PLATFORM-04 topology |
| Write strategy | Deferred entirely | Requires separate canary, conflict model, and Keith approval |
| Referral model | Async referral with explicit approval gates | Prevents runaway chains; owner retains control |
| Lock strategy (future) | Workspace-level mutex (sequential execution) | Simplest correct model when writes eventually enabled |
| Max referral depth | 3 (configurable) | Prevents deep chains; owner approval at depth−1 |
| Max agents per collaboration | 4 (configurable) | Prevents resource exhaustion; owner approval at limit−1 |
| First implementation slice | Upstream identity propagation | Unblocks all downstream work; low risk; backward-compatible |
| Billing enforcement | Deferred to BILLING-READY-04+ | Attribution designed; enforcement separate |

---

## 7. Recommended Implementation Sequence (Not Registered)

| # | Candidate Task | Nature | Risk |
|---|----------------|--------|------|
| 1 | **Upstream Identity Propagation** | Implementation | Medium |
| 2 | **collaborationRunId / referralTraceId Schema** | Implementation (DB migration) | Medium |
| 3 | **Orchestration Coordinator Service (Read-Only)** | Implementation | High |
| 4 | **Collaboration Audit Events** | Implementation | Low |
| 5 | **Single-Builder Write Canary** | Runtime canary | High |
| 6 | **Write Safety Model Design** | Planning | Medium |
| 7 | **Multi-Builder Write Activation** | Runtime | Very High |

**Recommended first implementation slice:** AGENT-PLATFORM-06 — Upstream Identity Propagation — wire `agentRole`/`builderProfileId` from frontend → API Gateway → job payload. Requires Keith approval before registration.

---

## 8. Deferred Items

| Item | Status |
|------|--------|
| Shared workspace writes | Explicitly deferred — requires write canary + conflict model + Keith approval |
| Write tool activation (`write_file`, `delete_file`) | Explicitly deferred |
| Concurrent write conflict resolution | Explicitly deferred |
| Per-builder billing enforcement | Deferred to BILLING-READY-04+ |
| Approval gate runtime implementation | Deferred — contract defined, implementation is future slice |
| Non-Builder agent runtime | Not yet designed |
| `collaborationRunId`/`referralTraceId` DB columns | Future migration — design only in this task |
| Typed collaboration audit event schema | Future implementation — untyped `payload` remains for now |

---

## 9. UX/UI Constraints (Locked for Future Implementors)

- aiSandBox is **multilingual-first**. Any future UI for multi-builder orchestration must:
  - Add or update keys in `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`
  - Use existing translation hook/pattern (`useTranslations` / `next-intl`)
  - Not add hardcoded English UI copy
- Icons: **Heroicons v2 Outline only**
- Impeccable and Emil Kowalski design engineering skills are **advisory only** — must not override governance, scope, architecture, or tests
- Empty/loading/error/success states must be multilingual

---

## 10. Non-Goals Confirmed

| Non-Goal | Status |
|----------|--------|
| No implementation of any source code | CONFIRMED |
| No runtime orchestration | CONFIRMED |
| No service startup | CONFIRMED |
| No database migration | CONFIRMED |
| No frontend UI changes | CONFIRMED |
| No provider/API calls | CONFIRMED |
| No billing enforcement | CONFIRMED |
| No write tool activation | CONFIRMED |
| No tests/builds/commands run | CONFIRMED |
| No browser smoke | CONFIRMED |
| No BullMQ jobs executed | CONFIRMED |

---

## 11. Acceptance Criteria — All Satisfied

| Criterion | Status |
|-----------|--------|
| AGENT-PLATFORM-05 registered in TASKS.md as ACTIVE | [x] COMPLETE |
| AGENT-PLATFORM-05 mirrored in TASKS_BACKLOG_FULL.md | [x] COMPLETE |
| AINOW-EXECUTION-ROADMAP.md shows AGENT-PLATFORM-05 ACTIVE | [x] COMPLETE |
| AGENT-PLATFORM-04 remains COMPLETE and LOCKED | [x] CONFIRMED |
| AGENT-HARNESS-07 remains COMPLETE and LOCKED | [x] CONFIRMED |
| AGENT-HARNESS-06E remains COMPLETE and LOCKED | [x] CONFIRMED |
| Registration records planning/governance only | [x] COMPLETE |
| `docs/AGENT-PLATFORM-05-READINESS-REVIEW.md` created | [x] COMPLETE (Step 2) |
| `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` created | [x] COMPLETE (Step 3) |
| Orchestration Readiness Review complete (Step 2) | [x] COMPLETE |
| Multi-Builder Orchestration Plan Document created (Step 3) | [x] COMPLETE |
| Consolidation/Checkpoint complete (Step 4) | [x] COMPLETE (this document) |
| No implementation files changed | [x] CONFIRMED |
| No commands/tests/runtime/provider calls | [x] CONFIRMED |
| TASKS.md updated COMPLETE and LOCKED | [x] COMPLETE |
| TASKS_BACKLOG_FULL.md mirrored | [x] COMPLETE |
| AINOW-EXECUTION-ROADMAP.md updated | [x] COMPLETE |
| Next recommended task recorded (not registered) | [x] AGENT-PLATFORM-06 — Upstream Identity Propagation |

---

## 12. Prerequisite Chain Integrity (Locked Invariants)

| Task | Status at Checkpoint |
|------|---------------------|
| AGENT-HARNESS-06E | COMPLETE and LOCKED — 2026-07-09 |
| AGENT-HARNESS-07 | COMPLETE and LOCKED — 2026-07-07 |
| AGENT-PLATFORM-04 | COMPLETE and LOCKED — 2026-07-07 |
| AGENT-PLATFORM-05 | COMPLETE and LOCKED — 2026-07-09 |

These invariants must not be disturbed by future tasks unless an explicitly approved architecture change task targets them.

---

## 13. Files Changed During Consolidation

| File | Action |
|------|--------|
| `docs/AGENT-PLATFORM-05-CHECKPOINT.md` | CREATED (this document) |
| `TASKS.md` | UPDATED — AGENT-PLATFORM-05 marked COMPLETE and LOCKED |
| `TASKS_BACKLOG_FULL.md` | UPDATED — mirrored TASKS.md exactly |
| `docs/AINOW-EXECUTION-ROADMAP.md` | UPDATED — AGENT-PLATFORM-05 marked COMPLETE and LOCKED; next task recorded |

### Files NOT Changed

- All files under `services/` — NOT CHANGED
- All files under `frontend/` — NOT CHANGED
- All files under `database/` — NOT CHANGED
- All `.env*` files — NOT CHANGED
- All `docker*` files — NOT CHANGED
- All `package*.json` files — NOT CHANGED
- All migration files — NOT CHANGED
- All test files — NOT CHANGED

---

## 14. Next Step (Not Registered)

**AGENT-PLATFORM-06 — Upstream Identity Propagation**

Recommended first implementation slice from the orchestration plan:

- Wire `agentRole` and `builderProfileId` from frontend execution request → API Gateway `enqueueExecution()` → `AiExecutionJob` payload
- Populate identity fields on `UsageRecord` at intent-write time
- Backward-compatible: all fields optional; single-builder executions unaffected
- Unblocks: audit events, billing attribution, orchestration coordinator

**Status:** Not registered. Requires Keith approval before registration.

---

## Document Metadata

- **Created:** 2026-07-09
- **Task:** AGENT-PLATFORM-05 Step 4 — Consolidation/Checkpoint
- **Status:** COMPLETE and LOCKED
- **Author:** AI-assisted governance pass
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md, docs/AINOW-EXECUTION-ROADMAP.md
