# GOV-ARCH-02 — Final Checkpoint

**Task ID:** GOV-ARCH-02  
**Title:** Architecture Reconciliation  
**Step:** 4 — Final Verification / Checkpoint / Consolidation / Lock  
**Checkpoint Date:** 2026-08-24  
**Final status:** COMPLETE AND LOCKED — PASS — 2026-08-24  
**Family:** GOVERNANCE / ARCHITECTURE / CURRENT-VS-FUTURE RECONCILIATION  
**Workstream:** GOVERNANCE (taxonomy only; zero admission weight)  
**Lifecycle:** 4-step GOVERNANCE  
**Evidence class:** GOVERNANCE  
**Nature:** GOVERNANCE VERIFICATION + CHECKPOINT + LOCK ONLY — no implementation, runtime, staging, provider, credit, gate, product, or Git mutation in this step

**Source map:** `docs/GOV-ARCH-02-SOURCE-MAP.md`  
**Stage-start:** `docs/GOV-ARCH-02-STAGE-START.md`  
**Authoritative HOW:** `ARCHITECTURE.md`  
**This checkpoint:** `docs/GOV-ARCH-02-CHECKPOINT.md`

Do not treat this checkpoint as a scheduler.  
Do not register GOV-PRD-02.  
Do not register the first genuine 2-source-lane pilot.  
Do not register or start PRIVATE-BETA-INVITE-01.  
Do not edit `PRD.md`.  
Do not edit `ARCHITECTURE.md` in Step 4.

Step 4 pre-write observation (read-only, after Keith committed the final correction pass):

```
branch = main
HEAD   = 60c21e098b544d1e1edb6c3e7bad9ac5fc64d019
         finalize GOV-ARCH-02 architecture corrections
git status --short = empty (CLEAN)
git diff --check HEAD^ HEAD = PASS
```

Prior Step 4 attempt (same day) STOPPED before any writes because `ARCHITECTURE.md` was dirty. That uncommitted delta was the intended final correction pass. Keith committed and pushed it as `60c21e0`. No checkpoint / board lock / registry lock was written during the failed attempt.

---

## Primary classification

```
FINAL_VERDICT=COMPLETE AND LOCKED — PASS — 2026-08-24
ARCHITECTURE_MD_AUTHORITY=TECHNICAL HOW — reconciled CURRENT + labeled PLANNED/FUTURE
PRD_MD_AUTHORITY=PRODUCT WHAT — unchanged
PREVIOUS_DIRTY_TREE_BLOCKER_RESOLVED=YES
CLEAN_COMMITTED_HEAD_VERIFIED=YES
FINAL_CORRECTIONS_PRESENT_IN_HEAD=YES
OPS_WATCHDOG_DOCUMENTED=YES
POSTGRES_STORAGE_BOUNDARY_CLEAR=YES
CHECKPOINT_CONFIRM_ORDER_VERIFIED_FROM_CURRENT_SOURCE=YES
DETERMINISM_WORDING_NON_ABSOLUTE=YES
ARCHITECTURE_MD_STEP_4_EDITS=0
PRD_MD_EDITS=0
IMPLEMENTATION_UNCHANGED=YES
GOV_PRD_02_REGISTERED=NO
PILOT_REGISTERED=NO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
```

---

## 1. Lifecycle

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration + source-map freeze | COMPLETE | 2026-08-23 |
| 2 | Architecture drift/gap inventory + Step 3 edit plan | COMPLETE | 2026-08-23 |
| 3 | Reconcile / update authoritative `ARCHITECTURE.md` + bounded final correction pass | COMPLETE | 2026-08-24 |
| 4 | Final verification / checkpoint / consolidation / lock | COMPLETE | 2026-08-24 |

Lane 1 held GOV-ARCH-02 GOVERNANCE occupancy (not an implementation lane) through Steps 1–4 and is released EMPTY at this lock. Lane 2 EMPTY throughout. Lane 3 DISABLED.

---

## 2. Step 1 source-map result

Frozen evidence: `docs/GOV-ARCH-02-SOURCE-MAP.md`.

- Identifier confirmed as the already-planned successor from GOV-OS-01 / GO-NO-GO-01.
- Authority split frozen: `PRD.md` = PRODUCT WHAT; `ARCHITECTURE.md` = TECHNICAL HOW; `CLAUDE.md` = Development OS; `TASKS.md` board = scheduler; `TASKS_BACKLOG_FULL.md` = registry.
- CURRENT implemented HOW was inventoried separately from APPROVED / PLANNED FUTURE HOW.
- Product-WHAT drift was deferred to GOV-PRD-02 (not registered).
- `ARCHITECTURE.md` and `PRD.md` were not edited in Step 1.

---

## 3. Step 2 architecture-gap result

Frozen evidence: `docs/GOV-ARCH-02-STAGE-START.md`.

- Read-only inventory against the frozen source map and repository source.
- F-items resolved from source: AI port **4001**; idle timeout 30 minutes request-driven in container-manager; `user_agents` persistence/API CURRENT; public confirm-build-apply on Gateway; coordinator in-memory and not product-reachable.
- Drift/gap table and supersession table frozen.
- Bounded Step 3 edit plan produced (Strategy B — patch in place).
- `ARCHITECTURE.md` and `PRD.md` were not edited in Step 2.
- Remaining unknowns classified as unverified runtime-instance details, not architecture blockers.

---

## 4. Step 3 reconciliation result

Committed HOW reconciliation:

- `e1d692b` `reconcile current architecture documentation` — primary Step 3 `ARCHITECTURE.md` reconciliation plus board/registry Step 3 status. Files: `ARCHITECTURE.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`. No application/source/config files.
- `60c21e0` `finalize GOV-ARCH-02 architecture corrections` — bounded final correction pass. File: `ARCHITECTURE.md` only.

`ARCHITECTURE.md` last reconciled 2026-08-24 (GOV-ARCH-02 Step 3). Prior freeze: 2026-08-10 (GOV-ARCH-01).

CURRENT vs PLANNED/FUTURE is explicit after the Authority Notice. Unlabeled statements are CURRENT implemented architecture. Gated, precursor, persistence-only, and leftover surfaces are not operational product capability.

---

## 5. Final correction pass (now in HEAD `60c21e0`)

Verified present in committed `ARCHITECTURE.md`:

### Ops watchdog

`aisandbox-ops-watchdog` is documented as CURRENT small-private-beta operational monitoring:

- Independent Node.js process (`monitoring/watchdog/ops-watchdog.js`), PM2-managed on staging
- Separate from the WorkerProcessor stuck-execution watchdog
- Does not share the API Gateway process failure domain
- Five-probe set from locked OPS-01 evidence: Gateway `GET /api/health/ready`; AI Service `GET /metrics`; Frontend public URL reachability; container-manager `GET /api/health`; Redis direct TCP AUTH + PING
- PostgreSQL covered transitively by Gateway readiness
- Outage and recovery notifications through Resend / email
- Not a production-grade / enterprise dashboard

### PostgreSQL storage boundary

PostgreSQL is the authoritative durable database for **relational / business application state**. Filesystem workspace / snapshot artifacts and container-manager SQLite / Docker runtime state are separate storage domains. The document does not claim filesystem or container runtime state is PostgreSQL-backed.

### Checkpoint / confirm ordering (verified against current source)

`ARCHITECTURE.md` §11.4 matches current frontend source (`frontend/app/[locale]/app/page.tsx`, `workspace-ai-file-actions.logic.ts`, `workspace-ai-coherence.logic.ts`):

```
workspace writes (`applySequentialFileActions`)
→ apply state (`setExecutionFileActionState`)
→ confirmBuildApplyIfQualifying
→ post-apply coherence (`runAiActionCoherence`)
→ tree / editor / preview refresh
→ Git checkpoint
→ checkpoint-list refresh
→ optional autosave (`attemptProjectAutosave`)
```

Apply-once (`acquireExecutionApplyGuard`) remains before sequential writes. Risky confirmation / AUTO_APPLY remain documented.

### Determinism wording

Provider / model output is **not** claimed deterministic. Deterministic state-transition and side-effect handling is the architecture intent, given a fixed provider response, tool results, and the same state.

---

## 6. CURRENT vs PLANNED / FUTURE separation

Hard CURRENT constraints in `ARCHITECTURE.md`:

- Private-beta AI execution is Builder-first **single-shot BullMQ**
- Harness is **IMPLEMENTED_BUT_GATED** (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`); not the beta default
- Multi-agent product runtime is **not** operational
- Coordinator is in-memory, instantiated, no HTTP surface, **not product-reachable**
- Stripe charging is **not** CURRENT; internal credit ledger is CURRENT and independent of `BILLING_CHARGES_ENABLED`
- Google OAuth routes exist but are **not activated**

FUTURE / PLANNED remains labeled: durable multi-Builder / collaboration runtime, knowledge retrieval, Harness-as-default, Stripe live charging, Google OAuth activation, gVisor, automatic rollback, `search_workspace` handler, executable user-created agents.

---

## 7. Major superseded HOW corrected

Committed HOW no longer presents as CURRENT:

| Stale claim | Current HOW |
|-------------|-------------|
| AI Service canonical port 4099 | Canonical listen **4001**; 4099 is historical canary override |
| Immediate Build charge at finalize-accounting | `workspace_mutation` deducts only after qualifying successful apply confirmation |
| Harness as beta default | IMPLEMENTED_BUT_GATED; single-shot is beta path |
| `search_workspace` implemented | NOT IMPLEMENTED (schema only) |
| Automatic rollback implemented | NOT IMPLEMENTED; revert is manual via checkpoint/revert |
| No host mounts | Host `${workspacePath}:/workspace:rw` bind-mount is CURRENT |
| `e2e-auto.html` as Preview HOW | PreviewStrategyResolver / `index.html` contract; `e2e-auto.html` is historical LIVE-08 fixture |
| Multi-agent runtime operational | Persistence / placeholders / in-memory precursor only |
| Stripe live charging | Ledger CURRENT; live Stripe charging FUTURE |
| Google OAuth active | Fail-closed; not activated |
| Original RPG simulation implemented | Command-center shell/layout only |
| Next.js confirm proxy as canonical staging public route | Canonical public route is Gateway `POST /api/ai/executions/:executionId/confirm-build-apply` via Caddy `/api/*`; Next.js proxy is retained locally only |
| `docker-compose.yml` as staging app topology | Local infrastructure only (Postgres, Redis, Prometheus, Grafana) |
| Staging = compose app processes | CURRENT staging = Caddy + PM2 host processes |

Historical / FUTURE references remain only when clearly labelled.

---

## 8. Fresh Step 4 architecture verification

All required CURRENT truths verified in committed HEAD:

| # | Required truth | Result |
|---|----------------|--------|
| 1 | AI Service canonical port = 4001 | PASS |
| 2 | Staging topology = Caddy + PM2 host processes | PASS |
| 3 | `docker-compose.yml` = local infrastructure, not staging app topology | PASS |
| 4 | Builder private-beta execution = single-shot BullMQ path | PASS |
| 5 | Harness = IMPLEMENTED_BUT_GATED, not beta default | PASS |
| 6 | Session idle timeout default = 30 minutes, configurable, request-driven CM logic | PASS |
| 7 | `workspace_mutation` Build deduction only after qualifying successful apply confirmation | PASS |
| 8 | Public confirm route = `POST /api/ai/executions/:executionId/confirm-build-apply` | PASS |
| 9 | `sourceEventId` = `executionId` deduction idempotency | PASS |
| 10 | `BILLING_CHARGES_ENABLED` blocks Stripe charging, not internal credits | PASS |
| 11 | AUTO_APPLY / risky confirmation / apply-once / sequential writes documented | PASS |
| 12 | Current apply ordering as listed in §5 | PASS |
| 13 | Git checkpoint / revert implemented | PASS |
| 14 | Automatic rollback NOT implemented | PASS |
| 15 | Host `/workspace` bind-mount documented | PASS |
| 16 | PreviewStrategyResolver / `index.html` behavior documented | PASS |
| 17 | `user_agents` persistence/APIs CURRENT; autonomous execution NOT CURRENT | PASS |
| 18 | Coordinator = in-memory implemented but not product-reachable | PASS |
| 19 | `search_workspace` NOT implemented | PASS |
| 20 | Email/password auth CURRENT | PASS |
| 21 | Google OAuth not activated | PASS |
| 22 | Persistent credit ledger CURRENT | PASS |
| 23 | Stripe live charging NOT CURRENT | PASS |
| 24 | Monitoring / health architecture documented | PASS |
| 25 | Independent `aisandbox-ops-watchdog` documented separately from WorkerProcessor watchdog | PASS |
| 26 | Watchdog five-probe set + Resend/email alerting from locked evidence | PASS |
| 27 | PostgreSQL relational/business authority without falsely claiming FS/runtime is Postgres-backed | PASS |
| 28 | Provider/model output not falsely described as deterministic | PASS |
| 29 | CURRENT vs PLANNED/FUTURE boundary explicit | PASS |
| 30 | Multi-agent product runtime is NOT described as operational | PASS |

`git diff --check HEAD^ HEAD` = PASS.  
Step 3 / correction commits contain no application/source/config files.

---

## 9. Unresolved non-blocking runtime-instance details

Preserved as unverified instance details, **not** architecture blockers. Step 4 did not use runtime / staging access.

- Current live `user_agents` row contents
- Whether staging Prometheus currently scrapes PM2 `:4001`
- Whether staging `SESSION_IDLE_TIMEOUT_MS` was later overridden
- Leftover `AIServiceHttpClient` non-Builder use
- Current operational use of `docker-compose.prod.yml`

---

## 10. Authority / PRD-WHAT deferrals

`ARCHITECTURE.md` = TECHNICAL HOW.  
`PRD.md` = PRODUCT WHAT.

`PRD.md` was not edited in this lifecycle.

Deferred to unregistered GOV-PRD-02:

- Ask/Build user-facing language
- RPG product promise
- Coming-soon / specialist-agent positioning
- Knowledge / collaboration product promises
- Harness product / beta promise
- OAuth / Stripe activation decisions
- Invitation / support UX
- Launch messaging
- Roadmap priorities

---

## 11. Invitation state

```
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
```

Do not register. Do not start invitation work.

---

## 12. Successor sequence (NOT REGISTERED beyond this lock)

```
GOV-ARCH-02
→ GOV-PRD-02
→ first genuine 2-source-lane pilot
→ pilot review
→ explicit future Lane 3 decision
```

GOV-PRD-02 remains unregistered.  
The first genuine 2-source-lane pilot remains unregistered.  
Lane 3 remains DISABLED. No implicit enablement.

---

## 13. Exact files changed

### Steps 1–3 (already committed; not this Step 4)

| Step | Files |
|------|--------|
| 1 | `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/GOV-ARCH-02-SOURCE-MAP.md` |
| 2 | `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/GOV-ARCH-02-STAGE-START.md` |
| 3 | `ARCHITECTURE.md`, `TASKS.md`, `TASKS_BACKLOG_FULL.md`; later Keith commit `ARCHITECTURE.md` only (`60c21e0`) |

### Step 4 (this lock)

| File | Action |
|------|--------|
| `docs/GOV-ARCH-02-CHECKPOINT.md` | CREATED — this document |
| `TASKS.md` | CURRENT EXECUTION BOARD only — GOV-ARCH-02 COMPLETE AND LOCKED; lanes EMPTY; GOVERNANCE UNOWNED |
| `TASKS_BACKLOG_FULL.md` | GOV-ARCH-02 final lock state only |

`ARCHITECTURE.md` Step 4 edits = 0.  
`PRD.md` edits = 0.  
Application / source / config edits = 0.  
Git mutations = 0.

---

## 14. Verification evidence

```
branch = main
HEAD   = 60c21e098b544d1e1edb6c3e7bad9ac5fc64d019
tree   = CLEAN before Step 4 writes
git log -5:
  60c21e0 finalize GOV-ARCH-02 architecture corrections
  e1d692b reconcile current architecture documentation
  c681a40 complete GOV-ARCH-02 architecture gap inventory
  20a1c39 register GOV-ARCH-02 architecture reconciliation
  c194920 lock final private beta go decision
git diff --check HEAD^ HEAD = PASS
Step 3 application/source/config files = none
PRD.md in GOV-ARCH-02 commits = none
```

Ordering source inspected read-only (no edits):

- `frontend/app/[locale]/app/page.tsx` (`applyExecutionFileActions`, `maybeRunExecutionCoherence`)
- `frontend/components/workspace/workspace-ai-file-actions.logic.ts`
- `frontend/components/workspace/workspace-ai-coherence.logic.ts`

---

## 15. Activity ledger (Step 4)

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime mutation = 0
database mutation = 0
migrations = 0
product implementation = 0
frontend implementation = 0
backend/services implementation = 0
dependencies = 0
ARCHITECTURE.md Step 4 edits = 0
PRD.md edits = 0
Git mutations = 0
GOV-PRD-02 registration = 0
2-source-lane pilot registration = 0
PRIVATE-BETA-INVITE-01 registration = 0
```

Allowed Step 4 writes: this checkpoint, `TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` GOV-ARCH-02 lock body.

---

## 16. Invariants preserved

- `LIVE_STAGING_VALIDATED=YES`
- `BUILDER_PRIVATE_BETA_READINESS=GO`
- All runtime authorization flags remain NO
- All runtime resources remain UNOWNED
- GOVERNANCE released UNOWNED at this lock
- PRIVATE-BETA-INVITE-01 remains parked
- GOV-PRD-02 remains unregistered
- Lane 3 remains DISABLED
