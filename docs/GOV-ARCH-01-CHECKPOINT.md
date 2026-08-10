# GOV-ARCH-01-CHECKPOINT.md
## GOV-ARCH-01 — ARCHITECTURE.md Current-State Reconciliation

**Task ID:** GOV-ARCH-01
**Final Status:** COMPLETE AND LOCKED — 2026-08-10
**Family:** GOVERNANCE / ARCHITECTURE / CURRENT-STATE RECONCILIATION
**Nature:** DOCUMENTATION / GOVERNANCE ONLY
**Model:** Sonnet 4.6 (all steps)

---

## 1. Purpose

ARCHITECTURE.md contained materially false and stale claims that actively misrepresented the current
implemented system. The document's authority notice ("All implementation must conform to this file")
made these false claims particularly dangerous: future Cursor/Claude sessions could have deleted
correctly implemented infrastructure (PostgreSQL, Redis, BullMQ, WorkerProcessor) or added invalid
dependencies (SQLite) based on an authoritative document that was simply wrong.

GOV-ARCH-01 corrected this drift through a 4-step evidence-backed reconciliation, restricting all
changes strictly to `ARCHITECTURE.md` and documentation governance files.

---

## 2. Step Completion Table

| Step | Description | Status | Date |
|------|-------------|--------|------|
| 1 | Registration — GOV-ARCH-01 registered in TASKS.md + TASKS_BACKLOG_FULL.md | COMPLETE | 2026-08-10 |
| 2 | Evidence Reconciliation / Stage-Start — read-only architecture audit | COMPLETE | 2026-08-10 |
| 3 | Bounded ARCHITECTURE.md Reconciliation — documentation-only implementation | COMPLETE | 2026-08-10 |
| 4 | Consolidation / Checkpoint — this document | COMPLETE | 2026-08-10 |

---

## 3. Exact Files Changed Across Task Lifecycle

### Step 1 (Registration)
| File | Action |
|------|--------|
| `TASKS.md` | Modified — GOV-ARCH-01 registered |
| `TASKS_BACKLOG_FULL.md` | Modified — GOV-ARCH-01 mirrored |

### Step 2 (Evidence Reconciliation)
| File | Action |
|------|--------|
| `docs/GOV-ARCH-01-STAGE-START.md` | CREATED — read-only audit artifact |

No other files modified. ARCHITECTURE.md NOT modified in Step 2.

### Step 3 (Bounded Reconciliation)
| File | Action |
|------|--------|
| `ARCHITECTURE.md` | Modified — bounded current-state reconciliation |

No other files modified.

### Step 4 (Consolidation — this step)
| File | Action |
|------|--------|
| `docs/GOV-ARCH-01-CHECKPOINT.md` | CREATED — this document |
| `TASKS.md` | Modified — GOV-ARCH-01 marked COMPLETE AND LOCKED |
| `TASKS_BACKLOG_FULL.md` | Modified — GOV-ARCH-01 marked COMPLETE AND LOCKED |

---

## 4. Material Architecture Drift Corrected

The following false or critically stale claims were present in ARCHITECTURE.md before GOV-ARCH-01
and were corrected in Step 3:

| # | False Claim (pre-GOV-ARCH-01) | Risk Level | Resolution |
|---|-------------------------------|------------|------------|
| 1 | `SQLite (single-process safe)` as current database | CRITICAL | Replaced with PostgreSQL |
| 2 | `All communication is HTTP-only.` | HIGH | Removed; mixed architecture documented |
| 3 | `No message queues.` | HIGH | Removed; BullMQ/Redis queue described |
| 4 | `No background workers.` | HIGH | Removed; WorkerProcessor described |
| 5 | `No event buses.` in Non-Goals | MEDIUM | Replaced with accurate scoped Redis Pub/Sub statement |
| 6 | Topology diagram omitting AI Service, Redis, PostgreSQL, BullMQ | HIGH | Replaced with full multi-service topology |
| 7 | `backend/` in canonical paths (non-existent directory) | MEDIUM | Removed |
| 8 | Internal APIs missing `finalize-accounting` | LOW | Added |

---

## 5. Current Topology Now Recorded

```
Browser
  │  HTTPS / SSE / WebSocket (preview only)
  ▼
Frontend (Next.js)
  │  /[locale]/app — workspace (Builder)  |  /[locale]/platform — ainow.biz dashboard
  │  HTTP + SSE
  ▼
API Gateway (NestJS) — port 4000
  │  Auth (session cookie), CSRF, Rate-limit, Credit balance guard
  │  Execution safety gate (GLOBAL_EXECUTION_ENABLED)
  │
  ├──► BullMQ queue (ai-execution) ── Redis (port 6379)
  │                                         │  Pub/Sub: ai-execution-stream:{executionId}
  │                                         ▼
  │                              AI Service / WorkerProcessor (port 4099)
  │                                  │  [plain path]  AIExecutionService → provider API
  │                                  │  [harness path, GATED] executeAgentHarnessLoop
  │                                  │    → ToolDispatcher → file/validation/browser handlers
  │                                  │      → API Gateway (HTTP) → container-manager (HTTP)
  │                                  │
  │                                  ├──► Redis Pub/Sub (publish execution events)
  │                                  ├──► PostgreSQL (usage_records update)
  │                                  └──► POST /api/internal/executions/:id/finalize-accounting
  │
  ├──► GET /api/ai/executions/:id/stream → Redis Pub/Sub subscribe → SSE to browser
  ├──► GET /api/ai/executions/:id        → PostgreSQL read
  │
  ├──► container-manager (HTTP, port 4002)
  │       DockerRuntimeService → Docker workspace containers (/workspace)
  │       SessionsService, FilesService, GitService, PreviewService, BrowserSmokeService
  │
  └──► PostgreSQL (port 5432)
         TypeORM — all durable application state
```

---

## 6. Communication Architecture Now Recorded

The system is neither HTTP-only nor queue-only. Mixed transport mechanisms are documented in
ARCHITECTURE.md §14 Communication Mechanism Summary.

| Transport | Used For |
|-----------|---------|
| HTTP / HTTPS | Browser↔API GW, API GW↔CM, Worker↔API GW (Harness tools + accounting), Worker→Provider |
| BullMQ over Redis | API GW → Worker (job submission and consumption) |
| Redis Pub/Sub | Worker → Redis (publish events), API GW → Redis (subscribe for SSE forwarding) |
| TypeORM / PostgreSQL | API GW (all application state), AI Worker (usage_records) |
| WebSocket | Browser↔API GW (preview streaming only — never control plane) |
| Docker SDK | CM ↔ Docker engine |

---

## 7. Persistence Architecture Now Recorded

**PostgreSQL** is the sole authoritative durable database (confirmed: `database.config.ts` `type: 'postgres'`).

No SQLite exists anywhere in the active codebase.

| Data Category | Owner | Storage |
|---------------|-------|---------|
| Sessions | API Gateway | PostgreSQL |
| Users | API Gateway | PostgreSQL |
| Projects | API Gateway | PostgreSQL |
| Conversations / Chat messages | API Gateway | PostgreSQL |
| AI execution records | API Gateway + AI Service | PostgreSQL (`usage_records`) |
| Git checkpoints | API Gateway | PostgreSQL |
| Credit balances / deductions | API Gateway | PostgreSQL |
| User agents | API Gateway | PostgreSQL |
| Workspace snapshots | API Gateway | Host filesystem (`snapshot-store/`) |
| Docker workspace files | container-manager | Docker container filesystem (`/workspace`) |
| Orchestration state | API Gateway | In-memory only (no persistence) |

---

## 8. AI Execution Architecture Now Recorded

ARCHITECTURE.md §11 now describes the full current execution path:

- `POST /api/ai/execute` → guards (GLOBAL_EXECUTION_ENABLED, CreditBalanceGuard, session ownership, idempotency)
- API Gateway → BullMQ enqueue → `ai-execution` queue → 202 response
- AI Service WorkerProcessor claims job → assembles prompt → plain or harness execution path
- Provider API invocation via adapter
- Redis Pub/Sub event publishing → SSE forwarded to browser
- PostgreSQL `usage_records` update
- `POST /api/internal/executions/:id/finalize-accounting` → credit deduction

Safety gates table (GLOBAL_EXECUTION_ENABLED, AGENT_HARNESS_ENABLE_TOOL_LOOP, write/validation/browser gates) documented with env flags, defaults, and effects.

---

## 9. Agent Harness CURRENT / GATED / NOT IMPLEMENTED Distinctions

### CURRENT (implemented and evidence-proven)
- Typed tool registry and ToolDispatcher
- `read_file` handler (E2E proven — AGENT-HARNESS-06E)
- `list_files` handler (E2E proven — AGENT-HARNESS-06E)
- Multi-turn bounded loop (`executeAgentHarnessLoop`)
- Provider tool-use bridge (`executeWithTools`)
- Per-builder harness config adapter (AGENT-HARNESS-07)
- Pre-apply checkpoint gate (`enablePreApplyCheckpoint=true`) — created before first write mutation
- Audit events (`InMemoryHarnessAuditRecorder`) — in-memory, not persisted to DB

### CURRENT (GATED — implemented, disabled by default)
- `write_file` handler — requires `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true`
- `delete_file` handler — requires `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true`
- `run_validation` handler — requires `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=true`
- `browser_smoke` handler (Playwright Chromium) — requires `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=true`
- Multi-turn tool loop activation — requires `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`

### SCHEMA ONLY / NO HANDLER
- `search_workspace` — registered in tool-registry.ts (`enabled: false`); no handler in ToolDispatcher

### NOT IMPLEMENTED
- **Automatic rollback** after partial Harness failure — does NOT exist.
  Pre-apply checkpoint exists; rollback must be initiated manually via checkpoint/revert path.
- Semantic / vector search (`enableSemanticSearch=false`)

### UNPROVEN
- Real-provider autonomous Harness tool-loop — all E2E canaries used test-harness-stub provider

---

## 10. Platform Architecture CURRENT / PLANNED Distinctions

### CURRENT
- ainow.biz as umbrella platform identity
- aiSandBox = Builder Agent module (`/[locale]/app`)
- ainow.biz platform dashboard (`/[locale]/platform`)
- Static TypeScript system-agent registry (`frontend/lib/agent-platform/agent-registry.ts`)
- DB-backed user-created agent persistence (`user_agents` table, UserAgent entity)
- RPG office/town platform shell (static foundation)
- OrchestrationService (in-memory skeleton only — no persistence)
- Builder Agent AI execution (active beta path)

### PLACEHOLDER / NOT FUNCTIONAL
- Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) — `status: 'coming_soon'`

### NOT IMPLEMENTED
- User-created agents as executable runtime agents
- Referral / agent collaboration runtime

### PLANNED
- Knowledge base runtime
- Work objects (tickets, decisions, referrals)
- Multi-agent real-time collaboration
- Semantic / vector retrieval

---

## 11. Preview Architecture Corrected

Preview proxy path is now accurately recorded as:

```
Browser → API Gateway (PreviewController) → container-manager (port 4002, CONTAINER_MANAGER_URL)
```

The pre-GOV-ARCH-01 document did not specify a proxy target. The obsolete incorrect target
(port 4001 / AI Service) was fixed in PRIVATE-BETA-BLOCKER-02 and is not encoded in ARCHITECTURE.md.

---

## 12. Valid Architecture Principles Preserved

The following principles were classified VALID in Step 2 and were preserved unchanged:

| Principle | Section | Status |
|-----------|---------|--------|
| Session lifecycle: CREATED → ACTIVE → TERMINATED; TERMINATED is final | §4 | PRESERVED |
| Enforcement order (Exists/Terminated/MaxLifetime/Idle/Concurrency/Execute) | §4 | PRESERVED |
| Request-level governance layers | §5 | PRESERVED (updated to Request→Application→Queue/Worker→Container) |
| Application-level: Max lifetime, Idle timeout, Exec concurrency | §5 | PRESERVED |
| Container-level: CPU/Memory/PID limits, Filesystem isolation | §5 | PRESERVED |
| Preview is passive proxy only / Never control plane | §6 | PRESERVED |
| WebSocket = preview only | §6 | PRESERVED |
| Idempotency: safe retries, no duplicate effects | §2 | PRESERVED |
| Explicit Ownership: each service owns its domain | §2 | PRESERVED |
| Container isolation: Docker/OverlayFS/Namespaces/cgroups/gVisor (planned) | §9 | PRESERVED |
| /workspace only writable / No host mounts | §9 | PRESERVED |
| Error semantics: 404/410/429/502 | §10 | PRESERVED |
| No cron / No schedulers | §2, §15 | PRESERVED |
| No clustering / No HA / Single-node focus | §15, §16 | PRESERVED |
| No resurrection | §4, §15 | PRESERVED |
| Determinism as design intent | §2 | PRESERVED (amended to acknowledge async worker pattern) |

---

## 13. Explicit Out-of-Scope Items

The following were explicitly excluded from GOV-ARCH-01 and were not touched:

- PRD.md reconciliation (remains stale — recommend GOV-PRD-01)
- CLAUDE.md changes
- AINOW-EXECUTION-ROADMAP.md
- AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md
- Source code, tests, package files, Docker files
- Migrations, schemas, environment files
- Deployment or runtime commands
- Stripe/payment implementation details
- Deployment host specifics (VPS, PM2)
- Full API endpoint enumeration
- Full database schema enumeration
- Per-builder profile registry details

---

## 14. Residual Uncertainties

These items are UNKNOWN per Step 2 evidence and were appropriately not asserted in ARCHITECTURE.md:

| Item | Disposition |
|------|------------|
| Whether container-manager has any direct PostgreSQL access | Not asserted; document states "no direct PostgreSQL access" consistent with source inspection |
| AI Service HTTP surface beyond port 4099 health endpoint | Not architecture-critical; omitted |
| Exact staging deployment topology (VPS specs, PM2 config) | Not encoded — ARCHITECTURE.md uses logical topology |
| Future gVisor enablement timeline | PLANNED — retained as-is from original |

---

## 15. Validation Performed

| Check | Result |
|-------|--------|
| `SQLite` appears in ARCHITECTURE.md | Not present (only "No SQLite is in use anywhere in the active codebase.") |
| `HTTP-only` claim present | Not present (replaced with "The system is not HTTP-only.") |
| `No message queues` claim present | Not present |
| `No background workers` claim present | Not present |
| `No event bus` false absolute claim present | Not present (replaced with accurate scoped Redis Pub/Sub statement) |
| `backend/` in canonical paths | Not present |
| Automatic/atomic Harness rollback claimed | Not present (explicitly stated "does NOT exist") |
| Preview target port 4001 present | Not present |
| Multi-agent runtime claimed as current | Not present |
| Knowledge runtime claimed as current | Not present |
| Custom agents claimed as executable | Not present |
| Harness permanently active claimed | Not present |
| Semantic search claimed as current | Not present |
| Only ARCHITECTURE.md modified in Step 3 | Confirmed (git diff --name-only) |

---

## 16. Safety Confirmations

- [x] No source code modified in any step
- [x] No tests modified in any step
- [x] No package files modified in any step
- [x] No Docker files modified in any step
- [x] No migrations or schemas modified in any step
- [x] No environment files modified or opened in any step
- [x] No Docker, PostgreSQL, Redis, migration, server, provider, browser smoke, staging, or deployment commands run
- [x] No git commit or push performed
- [x] No subagents used in any step
- [x] PRIVATE-BETA-INVITE-01 untouched in all steps
- [x] GLOBAL_EXECUTION_ENABLED unchanged and unchanged in documented architecture (documented as runtime kill-switch gate, not architectural absence)
- [x] All COMPLETE AND LOCKED predecessor task entries preserved

---

## 17. Governance Impact

ARCHITECTURE.md is the highest-authority technical document after CLAUDE.md. Correcting its
false claims has immediate impact on all future Cursor/Claude sessions:

- Future sessions will no longer receive instructions to delete BullMQ/Redis infrastructure
- Future sessions will no longer receive instructions to replace PostgreSQL with SQLite
- Future sessions will no longer receive instructions to eliminate the WorkerProcessor
- The Agent Harness gating model is now accurately documented: present but disabled by default
- The platform distinction between Builder Agent (current) and non-Builder agents (planned) is clear

---

## 18. Acceptance Criteria Verification

| Criterion | Satisfied |
|-----------|-----------|
| Step 1 registration complete | ✅ |
| Step 2 evidence reconciliation complete | ✅ |
| Step 3 ARCHITECTURE.md reconciliation complete | ✅ |
| ARCHITECTURE.md no longer describes SQLite as current | ✅ |
| HTTP-only claim corrected | ✅ |
| No-message-queue claim corrected | ✅ |
| No-background-worker claim corrected | ✅ |
| Redis/BullMQ/WorkerProcessor represented | ✅ |
| PostgreSQL represented | ✅ |
| Mixed communication architecture represented | ✅ |
| Agent Harness gated/current/not-implemented distinctions represented | ✅ |
| No atomic/automatic rollback claim | ✅ |
| Platform current/planned distinction represented | ✅ |
| Preview path correctly points to container-manager | ✅ |
| No speculative future architecture promoted to current | ✅ |
| No source/runtime/infrastructure changes occurred | ✅ |
| PRIVATE-BETA-INVITE-01 untouched | ✅ |
| GLOBAL_EXECUTION_ENABLED unchanged | ✅ |
| No subagents | ✅ |
| No git commit/push | ✅ |

---

## 19. Recommended Next Governance Task

**GOV-PRD-01 — PRD.md Current-State Reconciliation**

**Status: NOT REGISTERED — do not start without explicit registration.**

PRD.md still contains stale architecture and product assumptions, including:
- SQLite as current database
- HTTP-only service communication framing
- No background workers framing
- Pre-ainow.biz product framing

GOV-PRD-01 follows the same 4-step HIGH-governance-risk lifecycle as GOV-ARCH-01.
It must be explicitly registered before work begins.

---

## 20. Locked-State Instruction

**GOV-ARCH-01 is COMPLETE AND LOCKED.**

This checkpoint and all task entries are locked.
No modifications are permitted except explicitly approved documentation corrections.
Do not re-open GOV-ARCH-01 to add scope.
Do not modify ARCHITECTURE.md under GOV-ARCH-01 authority.
Any further ARCHITECTURE.md changes require a new registered task.

---

*Checkpoint created: 2026-08-10 — GOV-ARCH-01 Step 4 Consolidation.*
*Zero production, runtime, source, or infrastructure changes occurred across all four steps.*
