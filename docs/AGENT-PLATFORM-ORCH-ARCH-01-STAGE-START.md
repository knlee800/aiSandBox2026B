# AGENT-PLATFORM-ORCH-ARCH-01 — Stage-start / architecture freeze

**Task ID:** AGENT-PLATFORM-ORCH-ARCH-01
**Title:** Independent in-app orchestration architecture freeze
**Date:** 2026-09-14
**Nature:** GOVERNANCE — does NOT consume Lane 1 or Lane 2
**Lifecycle:** 4-step GOVERNANCE
**Step:** 4 — independent verification / checkpoint / lock
**Step status:** Step 1 COMPLETE — 2026-09-14; Step 2 COMPLETE — 2026-09-14; Step 3 COMPLETE — 2026-09-14; Step 4 COMPLETE AND LOCKED — 2026-09-14
**This document:** Authoritative frozen v1 architecture for future in-app orchestration on ainow.biz, and the Step 4 checkpoint / lock of that architecture decision. It does **not** rewrite `ARCHITECTURE.md`. It does **not** authorize implementation, child registration, canary, product UI, Harness, or EXEC-01C6A reopen. This lock records the architecture decision only.

**Step 2 committed HEAD:** `fe0307594abc96f03e62a4bfa2659ceef017575b` (branch `main`; message `docs: freeze orchestration architecture`)
**Step 3–4 base HEAD:** `fe0307594abc96f03e62a4bfa2659ceef017575b` (branch `main`; working tree clean at window open)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_COMPLETE=YES
STEP4_COMPLETE=YES
LOCKED=YES
LOCKS=ARCHITECTURE_DECISION_ONLY
ARCHITECTURE_MD_SYNC=NOT_PERFORMED
IMPLEMENTATION_STARTED=NO
CHILD_TASKS_REGISTERED=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
PM2_FENCE_01=COMPLETE AND LOCKED / OUTCOME_BLOCKED
HARNESS_ENABLEMENT=NO
PRODUCT_VISIBLE_ORCHESTRATION_UI=NO
TEMPORARY_PM2_OVERLAYS=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
PRIVATE_BETA_INVITE_01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
```

Keith authorized Steps 3–4 together: architecture-decision record plus checkpoint/lock. Living `ARCHITECTURE.md` sync is **not** performed in this window. This freeze does **not** reopen AGENT-PLATFORM-EXEC-01C6A. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED; `GLOBAL_EXECUTION_ENABLED` stays ON. PM2-FENCE-01 remains COMPLETE AND LOCKED (OUTCOME_BLOCKED under M3). Product-visible orchestration remains FUTURE/gated. Working single-shot Builder Ask/Build remains the current private-beta promise.

Historical `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` and `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` are not living authority.

---

## 1. Final architecture decision (v1)

Frozen v1 HOW for future in-app orchestration:

1. **Gateway durable orchestration coordinator** — API Gateway remains the coordinator. The current in-memory `OrchestrationService` is the precursor, not the durable product runtime.
2. **PostgreSQL-backed collaboration/referral state in a later child** — named `AGENT-PLATFORM-ORCH-PERSIST-01`; not registered in this window.
3. **Leaf executions are ordinary plain Builder jobs** on the existing `POST /api/ai/execute` → BullMQ `ai-execution` path.
4. **No `harnessVersion` for v1 orchestration** — leaf job payloads must omit `harnessVersion`.
5. **No temporary PM2 overlays.**
6. **No product-visible orchestration UI yet** — no new collaboration/referral/multi-Builder product surface; later UI/product exposure is a named future decision, not this freeze.
7. **Working single-shot Builder Ask/Build path must remain untouched.**

### Rationale

Independent Grok, Sonnet, and Opus reviews agree the old EXEC-01C6A / temporary PM2 overlay path must not be reused. Grok and Opus prefer Gateway coordinator + plain Builder leaf jobs. Sonnet’s Harness/referral reconciliation concern is a **future integration constraint**, not the v1 foundation: if Harness/tool-loop is later enabled, orchestration referrals must be reconciled with that path in a separately authorized task.

v1 therefore composes on the already-working Builder execute path instead of introducing a second runtime, a Harness-first loop, or a canary overlay procedure.

---

## 2. Source-grounded current surfaces

These are CURRENT facts. Precursor / leftover / gated surfaces are not product capability.

### 2.1 Current Builder execute path (CURRENT private-beta default)

Authoritative HOW: `ARCHITECTURE.md` §11.1.

```
Frontend POST /api/ai/execute
  → Caddy /api/* → API Gateway
  → guards (session / CSRF / GLOBAL_EXECUTION_ENABLED / credit / ownership / idempotency)
  → usage_records pending
  → BullMQ enqueue ai-execution
  → HTTP 202 { executionId, status: 'queued' }
  → WorkerProcessor
  → plain AIExecutionService → adapter → provider  (when harness is not selected)
```

Controller: `services/api-gateway/src/ai/ai-execution.controller.ts` `@Post('execute')`.
Worker: `services/ai-service/src/worker/worker.processor.ts`.
Frontend Ask/Build omits `harnessVersion` (`workspace-execution-intent.logic` helper; tests assert absence).

`agentId` may bind a persisted user-created agent onto this same path. `agentId` + `harnessVersion` is rejected. Ordinary no-agent Builder remains unchanged.

BUILDER-LIVE-GATE-01 left this path ON (`GLOBAL_EXECUTION_ENABLED=true`). This freeze must not change that gate.

### 2.2 In-memory OrchestrationService (precursor; not product-reachable)

| Fact | Source |
|---|---|
| Instantiated at Gateway boot | `OrchestrationModule` imported from `app.module.ts` |
| State | process-local `Map` stores: `collaborationRunStore`, `referralStore`, `idempotencyStore`, `referralExecutionMap` |
| HTTP surface | none — no orchestration controller; `AIExecutionController` does not inject `OrchestrationService` |
| Mode | `READ_ONLY_MODE_INDICATOR = 'read_only'`; write tools blocked |
| Leaf enqueue | `startReferralExecution` builds a job payload and calls `QueueService.enqueueExecution` |
| `harnessVersion` on leaf jobs | `StartReferralExecutionInput` may accept `harnessVersion`, but the enqueued `jobPayload` **omits** it |

This is the precursor coordinator. It is **not** durable. Process restart loses collaboration/referral state. It is **not** product-reachable. v1 keeps Gateway as coordinator and requires PostgreSQL durability in a later child.

### 2.3 Execute DTO orchestration fields (plumbing; optional)

`AIExecutionRequest` in `services/api-gateway/src/clients/ai-service-http.client.ts`:

- `harnessVersion?: 'v1'`
- `agentRole?`, `builderProfileId?`
- `collaborationRunId?`, `referralTraceId?`
- `agentId?` (persisted user-agent identity; distinct from Builder catalog id)

Gateway `POST /api/ai/execute` forwards `collaborationRunId` / `referralTraceId` into ledger metadata and the BullMQ job when present. The current Workspace Chat Ask/Build payload does **not** send those orchestration fields. Worker copies them into finalize metadata when present (`worker.processor.ts`).

v1 may later attach `collaborationRunId` / `referralTraceId` as job metadata. v1 must still omit `harnessVersion` on those leaf jobs.

### 2.4 Workspace orchestration checkbox (local sequential helper; not the v1 product)

Current UI:

- Default `isChatOrchestrationEnabled = false` in `frontend/app/[locale]/app/page.tsx`
- Checkbox `data-testid="workspace-chat-orchestration-toggle"` in `workspace-shell.tsx`
- Label key `ai.orchestrationLabel`: “Enable bounded orchestration (up to 3 sequential steps)”
- When enabled, `submitOrchestratedChatPrompt` plans up to 3 steps client-side (`workspace-chat-orchestration.logic.ts`) and sequentially `fetch('/api/ai/execute', …)` with the ordinary Ask/Build payload
- That fetch omits `harnessVersion`, `collaborationRunId`, and `referralTraceId`
- It does **not** call `OrchestrationService`

This checkbox is a **local sequential execute helper**, not Gateway coordinator orchestration, not multi-Builder, and not the selected v1 architecture. Frozen:

- Do not treat this checkbox as product-visible in-app orchestration
- Do not expand it into collaboration/referral/multi-Builder UI in this task family without a later UI/product exposure decision
- Do not wire it to `OrchestrationService` in this freeze
- Ordinary unchecked Ask/Build remains the private-beta path

### 2.5 Container-manager orchestration columns (leftover defaults; unused)

SQLite `sessions` table in `services/container-manager/src/sessions/sessions.service.ts`:

- `orchestrator_enabled INTEGER DEFAULT 0`
- `orchestrator_mode TEXT DEFAULT 'off'`

Mirrored in `database/schema.sql` / `database/schema-sqlite.sql` with `CHECK (orchestrator_mode IN ('off', 'lite', 'full'))`. Session create/update paths do not currently read or mutate these columns. They are leftover schema, not a product runtime, and not the v1 PostgreSQL collaboration/referral store.

v1 coordinator persistence belongs in API Gateway / PostgreSQL via `AGENT-PLATFORM-ORCH-PERSIST-01`, not in container-manager session SQLite.

### 2.6 Harness / tool-loop gating (FUTURE / gated / off)

| Gate | Default | Effect |
|---|---|---|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | Worker does not select the harness path |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | write/delete tools not registered |
| Worker routing | `harnessVersion === 'v1'` **and** `enableToolLoop` | otherwise plain `AIExecutionService` |
| Frontend Ask/Build | omits `harnessVersion` | stays on the plain path |

v1 orchestration must stay on that plain path. Harness/tool-loop remains FUTURE until separately authorized. EXEC-01C6A remains `startCondition=NOT_READY` and must not be reopened to “prove” orchestration.

---

## 3. Explicit invariants

1. **Ordinary Builder path unchanged.** Ask, Build, Preview, file-actions, checkpoints, credit, and logout/login reopen remain the working single-shot path. This freeze and later children must not retarget that path through Harness or a second queue.
2. **v1 orchestration leaf jobs use plain execution, no `harnessVersion`.** Coordinator-enqueued jobs must omit `harnessVersion`. Callers must not set `harnessVersion: 'v1'` to drive v1 orchestration.
3. **Coordinator state must be durable in PostgreSQL in a future child** (`AGENT-PLATFORM-ORCH-PERSIST-01`). In-memory Maps are not acceptable v1 product state.
4. **No product-visible orchestration UI yet.** No new collaboration/referral/multi-Builder product surface. The existing bounded-steps checkbox is not that product and must not be promoted as such.
5. **No temporary PM2 overlays.** PM2-FENCE-01 OUTCOME_BLOCKED remains. Do not reuse EXEC-01C6A overlay procedure.
6. **Harness/tool-loop is future only.** `AGENT_HARNESS_ENABLE_TOOL_LOOP` stays off for this architecture. Sonnet’s Harness/referral reconciliation is deferred until a separately authorized Harness task.

---

## 4. Rejected / deferred alternatives (not v1)

| Alternative | Status | Why |
|---|---|---|
| Harness-first orchestration | Rejected as v1 foundation | Current beta is single-shot; Harness is gated; leaf jobs must stay plain |
| Dedicated worker/queue now | Deferred | Adds a second runtime before durability and internal canary exist |
| Local prototype only | Rejected as the v1 path | ainow.biz / Gateway is the coordinator venue; a local-only prototype does not freeze HOW |
| Reopening EXEC-01C6A | Forbidden | `startCondition=NOT_READY`; PM2 overlay path is OUTCOME_BLOCKED; all three reviews reject reuse |
| Temporary PM2 overlays | Rejected | Same as EXEC-01C6A / PM2-FENCE-01 |

---

## 5. Named future children (NOT registered)

Do **not** create canonical headings, machine stanzas, or sidecar candidates for these IDs in this window.

### 5.1 AGENT-PLATFORM-ORCH-PERSIST-01 — durable coordinator persistence

- Replace in-memory Maps with PostgreSQL-backed collaboration/referral state owned by API Gateway
- Preserve read-only v1 constraints until a later write-tools decision
- Must not change ordinary Builder Ask/Build
- Must not enable Harness or send `harnessVersion`
- Migrations only under a later authorized implementation task

### 5.2 Later internal-only orchestration canary

- After persistence exists
- Internal-only; no product UI
- Leaf jobs must be plain Builder execute-path jobs
- Must not reopen EXEC-01C6A or use temporary PM2 overlays
- Must not disturb `GLOBAL_EXECUTION_ENABLED=true`

### 5.3 Later UI / product exposure decision

- Separate Keith authorization
- Product-visible orchestration remains FUTURE until then
- Existing bounded-steps checkbox is not that decision

---

## 6. Evidence required before beta exposure

Product-visible orchestration on ainow.biz is **not** authorized by this freeze. Before any later beta-exposure decision, at least:

1. `AGENT-PLATFORM-ORCH-PERSIST-01` (or successor) COMPLETE AND LOCKED with PostgreSQL durability proof
2. Internal-only canary PASS on the Gateway coordinator + plain leaf jobs
3. Observed leaf jobs omit `harnessVersion`
4. Ordinary Builder Ask / Build / Preview / logout-login reopen still PASS with the Builder gate still ON
5. Harness flags remain false; no tool-loop; no write tools
6. No temporary PM2 overlays; EXEC-01C6A still not reopened
7. Credit, session isolation, and checkpoint semantics unchanged for ordinary Builder
8. Separate Keith authorization for product-visible UI (the later UI/product exposure decision)

Absence of this evidence is not a reason to invent work. GOV-OS-02 still governs genuinely new product selection.

---

## 7. What stays gated / off

- Harness / tool-loop (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`)
- Write tools / specialist agents as product runtime
- Product-visible collaboration / referral / multi-Builder UI
- EXEC-01C6A reopen
- Temporary PM2 overlays
- Dedicated orchestration worker/queue
- PRIVATE-BETA-INVITE-01 (PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED)
- Stripe charging / invitation / Git by workers

---

## 8. Step 3 / Step 4 (COMPLETE AND LOCKED — 2026-09-14)

Step 3 in this task’s 4-step loop is **architecture-decision record**. Living `ARCHITECTURE.md` sync is **not** performed in this lock window.

Keith authorized Steps 3–4 together. Frozen v1 HOW (unchanged from Step 2):

1. Gateway durable orchestration coordinator
2. PostgreSQL-backed collaboration/referral state in a later child (`AGENT-PLATFORM-ORCH-PERSIST-01`; not registered)
3. Leaf jobs are ordinary plain Builder execute-path jobs
4. No `harnessVersion` for v1
5. No temporary PM2 overlays
6. No product-visible orchestration UI
7. Single-shot Builder Ask/Build stays untouched

**Step 3 record:** this document remains the architecture-decision record. Living `ARCHITECTURE.md` / `PRD.md` / `CLAUDE.md` / `AGENTS.md` were not rewritten. Product-visible orchestration remains FUTURE/gated.

**Step 4 independent verification:**

1. Step 2 freeze is committed at `fe0307594abc96f03e62a4bfa2659ceef017575b`.
2. Selected v1 architecture is unchanged.
3. Named children remain unregistered (no canonical heading, machine stanza, or sidecar candidate).
4. Occupancy remains Lane 1 EMPTY / Lane 2 EMPTY / GOVERNANCE UNOWNED. Occupancy hash unchanged.
5. EXEC-01C6A sidecar `startCondition=NOT_READY` remains UNCHANGED / not reopened.
6. BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON.
7. PM2-FENCE-01 remains COMPLETE AND LOCKED / OUTCOME_BLOCKED.
8. No application source, migrations, runtime, or Git mutation in this window.

**Verdict:** AGENT-PLATFORM-ORCH-ARCH-01 is **COMPLETE AND LOCKED**. This lock records the **architecture decision only**. It does not register children, admit implementation lanes, rewrite living architecture, enable product UI, enable Harness, or reopen EXEC-01C6A.

GOVERNANCE was acquired only for this checkpoint write, then released UNOWNED. `lane-saturation-state.json` was not edited.

---

## Out of scope (this Step 3–4 lock)

Implementation source; migrations; frontend work; tests except the lane-capacity validator; staging/SSH/AWS/PM2/env/provider/credit; Docker/Postgres/Redis; Harness enablement; EXEC-01C6A reopen; PRIVATE-BETA-INVITE-01; Git commit/push; registering named children; rewriting `ARCHITECTURE.md` / `PRD.md` / `CLAUDE.md` / `AGENTS.md`.

**Activation effect:** NONE
**Rollback boundary:** discard this window’s board/registry Step 3–4 field updates and the lock-section edits in this document. Ordinary Builder path and the live gate are untouched. The committed Step 2 freeze at `fe0307594abc96f03e62a4bfa2659ceef017575b` remains until Keith reverts it.
