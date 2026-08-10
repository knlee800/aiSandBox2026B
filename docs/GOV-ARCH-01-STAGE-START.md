# GOV-ARCH-01-STAGE-START.md
## GOV-ARCH-01 Step 2 — Evidence Reconciliation / Stage-Start

**Task:** GOV-ARCH-01 — ARCHITECTURE.md Current-State Reconciliation
**Step:** 2 — Evidence Reconciliation / Stage-Start (Read-Only)
**Status:** COMPLETE — 2026-08-10
**Nature:** READ-ONLY audit. No source, test, config, schema, migration, environment, Docker,
or governance files changed during this step. ARCHITECTURE.md NOT modified.
**Created by:** GOV-ARCH-01 Step 2 authorized planning artifact.
**Authority for Step 3:** This document is the sole basis for Step 3 bounded edits to ARCHITECTURE.md.

---

## 1. Files Inspected

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Subject under audit |
| `CLAUDE.md` | Governance authority |
| `TASKS.md` (GOV-ARCH-01 section) | Task registration, scope, investigation targets |
| `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` | Platform architecture direction |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Execution ordering and COMPLETE/LOCKED history |
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` | Harness architecture baseline |
| `docs/AGENT-HARNESS-06E-CHECKPOINT.md` | Full E2E Worker→API GW→CM→Docker file canary |
| `docs/AGENT-HARNESS-07-CHECKPOINT.md` | Per-builder harness config adapter |
| `docs/AGENT-HARNESS-WRITE-CANARY-CHECKPOINT.md` | First live E2E write canary |
| `docs/AI-03-01A-CHECKPOINT.md` | Backend file-action output pipeline |
| `docs/AI-03-01B-CHECKPOINT.md` | Frontend file-action application |
| `docs/AI-03-01C-CHECKPOINT.md` | Chat file-action result surfacing |
| `docs/AI-03-02-CHECKPOINT.md` | Post-AI-action workspace coherence |
| `docs/AI-04-01-CHECKPOINT.md` | Backend chat persistence wiring |
| `docs/PR-01-01-CHECKPOINT.md` | Project save and restore (snapshot filesystem) |
| `docs/PR-02-01-CHECKPOINT.md` | Project import and export (zip archive) |
| `docs/PR-03-01-CHECKPOINT.md` | Project identity (persistent Project entity) |
| `docs/BILLING-READY-08-CHECKPOINT.md` | Free-plan credit balance provisioning |
| `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-CHECKPOINT.md` | Controlled xAI staging smoke |
| `docs/PRIVATE-BETA-BLOCKER-02-CHECKPOINT.md` | Preview proxy target fix |
| `services/api-gateway/src/app.module.ts` | Module list confirms PostgreSQL, BullMQ, all active modules |
| `services/api-gateway/src/config/database.config.ts` | Confirms PostgreSQL (`type: 'postgres'`) |
| `services/api-gateway/src/preview/preview.controller.ts` | Confirms preview proxy → CM:4002 |
| `services/api-gateway/src/safety/kill-switch.config.ts` | Confirms GLOBAL_EXECUTION_ENABLED |
| `services/ai-service/src/worker/worker.processor.ts` (top 100 lines) | Confirms BullMQ Worker, ToolDispatcher, harness imports |
| `services/ai-service/src/streaming/execution-stream.publisher.ts` | Confirms Redis Pub/Sub for streaming |
| `services/ai-service/src/queue/queue.service.ts` | Confirms BullMQ Queue + Redis |
| `services/ai-service/src/queue/queue.module.ts` | Queue module confirmed |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Harness gates: enableToolLoop default=false |
| `services/ai-service/src/agent-harness/tools/tool-registry.ts` (relevant sections) | search_workspace: registered, enabled=false |
| `services/ai-service/src/agent-harness/tools/tool-dispatcher.ts` | search_workspace: NO handler registered |
| `services/container-manager/src/main.ts` | CM port 4002 confirmed |
| `services/container-manager/src/browser-smoke/browser-smoke.service.ts` | Playwright Chromium confirmed |
| `frontend/lib/agent-platform/agent-registry.ts` | Static declarative TypeScript agent registry |
| `services/api-gateway/src/user-agent/` (module/service/controller) | DB-backed UserAgent entity confirmed |

---

## 2. Files Changed by Step 2

**ONE file created:**

| File | Action |
|------|--------|
| `docs/GOV-ARCH-01-STAGE-START.md` | CREATED — this document |

No other files modified. ARCHITECTURE.md NOT modified.

---

## 3. Confirmed Current System Topology

The implemented system (confirmed by source + COMPLETE/LOCKED checkpoints) is:

```
Browser
  │  HTTPS / SSE
  ▼
Frontend (Next.js)   ← /[locale]/app (workspace)  |  /[locale]/platform (dashboard)
  │  HTTP + SSE
  ▼
API Gateway (NestJS) — port 4000
  │  ┌────────────────────────────────────────────────────────────────┐
  │  │  Auth (session cookie)   Credit balance guard   Kill-switch   │
  │  │  CSRF guard              Rate-limit guard                     │
  │  └────────────────────────────────────────────────────────────────┘
  │
  ├──► BullMQ queue (ai-execution)  ─── Redis (REDIS_URL, port 6379)
  │                                          │  Pub/Sub: ai-execution-stream:{id}
  │                                          ▼
  │                                 AI Service Worker (WorkerProcessor, port 4099)
  │                                   │  [plain path] AIExecutionService → adapter → provider API
  │                                   │  [harness path, AGENT_HARNESS_ENABLE_TOOL_LOOP=true]
  │                                   │    executeAgentHarnessLoop → ToolDispatcher
  │                                   │      → file/validation/browser tool handlers
  │                                   │        → ApiGatewayHttpClient → API Gateway (HTTP)
  │                                   │          → ContainerManagerHttpClient → container-manager (HTTP)
  │                                   │
  │                                   └──► Redis Pub/Sub publish (events)
  │                                   └──► PostgreSQL (usage_records update)
  │                                   └──► POST /api/internal/executions/:id/finalize-accounting
  │
  ├──► GET /api/ai/executions/:id/stream → Redis Pub/Sub subscribe → SSE to browser
  ├──► GET /api/ai/executions/:id        → PostgreSQL (usage_records read)
  │
  ├──► container-manager (HTTP, port 4002)
  │       DockerRuntimeService → Docker workspace containers (/workspace)
  │       SessionsService, FilesService, GitService, PreviewService, BrowserSmokeService
  │
  └──► PostgreSQL (port 5432)
         TypeORM — sessions, users, projects, conversations, chat_messages,
         usage_records, credit_balances, credit_deduction_records,
         git_checkpoints, user_agents, subscriptions, webhooks, etc.
```

**Service classification:**

| Component | Classification | Evidence |
|-----------|----------------|---------|
| Frontend (Next.js) | CURRENT | Source — `/[locale]/app` workspace, `/[locale]/platform` dashboard |
| API Gateway (NestJS, port 4000) | CURRENT | Source — app.module.ts, all endpoints |
| AI Service / WorkerProcessor (port 4099) | CURRENT | Source — worker.processor.ts, BullMQ Worker |
| Redis (port 6379) | CURRENT | Source — queue.service.ts, execution-stream.publisher.ts |
| BullMQ (ai-execution queue) | CURRENT | Source — queue.service.ts, worker.processor.ts |
| container-manager (NestJS, port 4002) | CURRENT | Source — main.ts, sessions/files/preview/git/browser-smoke |
| PostgreSQL (port 5432) | CURRENT | Source — database.config.ts (`type: 'postgres'`) |
| Docker workspace containers | CURRENT | Source — docker-runtime.service.ts |
| Agent Harness (tool loop, gated) | GATED | Source — AGENT_HARNESS_ENABLE_TOOL_LOOP=false by default |
| ainow.biz platform dashboard | CURRENT (limited) | Source — /[locale]/platform, agent-registry.ts, AGENT-PLATFORM-00 |
| Stripe / payment processing | GATED | Source — BILLING_CHARGES_ENABLED=false |
| Knowledge runtime | PLANNED | AGENT-PLATFORM-00 |
| Multi-agent collaboration runtime | PLANNED (in-memory skeleton only) | OrchestrationService |
| gVisor sandbox | PLANNED | ARCHITECTURE.md §9 already says "planned" |

---

## 4. Section-by-Section ARCHITECTURE.md Audit

### §1 — System Overview (topology diagram + principle claims)

**4.1.1 — Topology Diagram (lines 59–71)**

```
Browser → Frontend (Next.js) → API Gateway (NestJS) → Container Manager → Docker Runtime
```

| Classification | Details |
|----------------|---------|
| STALE — partially correct but critically incomplete | The diagram omits the entire AI execution path: BullMQ queue, Redis, AI Service Worker, WorkerProcessor, and the streaming/status feedback path. These are all fully implemented and staging-proven. The diagram also omits PostgreSQL and Redis as infrastructure components. |
| Recommended Step 3 treatment | **Replace** with accurate multi-service topology. Retain the API Gateway → container-manager → Docker leg. Add AI execution path through BullMQ/Redis/Worker. Add persistence layer. |

**4.1.2 — "All communication is HTTP-only." (line 73)**

| Classification | FALSE |
|----------------|-------|
| Existing claim | "All communication is HTTP-only." |
| Current evidence | `services/ai-service/src/queue/queue.service.ts` — BullMQ Queue using Redis (`new Queue(name, { connection: this.connection })`). `services/ai-service/src/streaming/execution-stream.publisher.ts` — Redis Pub/Sub publish. API Gateway subscribes to Redis Pub/Sub for SSE stream. Multiple locked checkpoints (AGENT-HARNESS-06E, WRITE-CANARY-B, FR-04) prove the queue/worker path. |
| Correct fact | API Gateway → AI execution → BullMQ queue over Redis. AI Service → Redis Pub/Sub for execution streaming. Frontend → API Gateway → SSE (Redis Pub/Sub subscribe). HTTP is used for: Browser→API GW, API GW→container-manager, Worker/Harness tools→API GW. |
| Recommended Step 3 treatment | **Replace** with accurate statement. Describe HTTP paths and queue paths separately. |

**4.1.3 — "No message queues." (line 74)**

| Classification | FALSE |
|----------------|-------|
| Existing claim | "No message queues." |
| Current evidence | BullMQ `ai-execution` queue backed by Redis. Confirmed in source and by every AI execution checkpoint since AI-03-01A. |
| Correct fact | BullMQ (ai-execution queue) over Redis is the AI execution transport. |
| Recommended Step 3 treatment | **Remove** this claim. Replace with description of BullMQ/Redis role. |

**4.1.4 — "No event buses." (line 75)**

| Classification | FALSE (partially) |
|----------------|-------|
| Existing claim | "No event buses." |
| Current evidence | Redis Pub/Sub serves as the event transport for execution stream events (`ai-execution-stream:{id}` channels). Not a general-purpose event bus, but BullMQ + Redis together form the asynchronous execution event transport. |
| Correct fact | Redis Pub/Sub is used for execution streaming. BullMQ is the queue/job transport. Neither is a general-purpose event bus. |
| Recommended Step 3 treatment | **Replace** with accurate statement about Redis Pub/Sub role in execution streaming. |

**4.1.5 — "No background workers." (line 76)**

| Classification | FALSE |
|----------------|-------|
| Existing claim | "No background workers." |
| Current evidence | AI Service `WorkerProcessor` is a BullMQ worker that claims jobs from the `ai-execution` queue. Fully implemented and E2E proven. Confirmed by `worker.processor.ts` (imports `Worker` from `bullmq`). |
| Correct fact | AI Service WorkerProcessor is a background queue worker that processes all AI execution jobs. |
| Recommended Step 3 treatment | **Remove** this claim. Add AI Service Worker description in Section 3. |

---

### §2 — Architecture Principles (lines 82–107)

**4.2.1 — "Determinism: Same input → same output / No background state mutation" (lines 84–89)**

| Classification | PARTIALLY SUPERSEDED |
|----------------|-----|
| Context | The determinism principle remains a valid design goal, but the explicit "no background state mutation" claim is now false: WorkerProcessor mutates `usage_records` (PostgreSQL), publishes Redis events, creates checkpoints, and triggers credit deductions — all in a background queue worker. |
| Recommended Step 3 treatment | **Amend** to acknowledge that asynchronous queue execution is the pattern for AI jobs, while maintaining determinism intent for the execution logic itself. |

**4.2.2 — "Request-Driven Enforcement: No cron jobs / No schedulers" (lines 90–93)**

| Classification | VALID BUT NEEDS CLARIFICATION |
|----------------|-----|
| Context | No scheduled/cron jobs exist (confirmed — no cron/scheduler code found). The "request-driven" framing remains accurate for governance enforcement. However, AI execution itself is queue-driven (not inline request-driven). |
| Recommended Step 3 treatment | **Retain** no-cron claim. **Amend** to clarify that AI execution is queue-driven (not inline), while governance (auth, session, billing guards) remains request-driven. |

**4.2.3 — "Persistent Terminal State: Termination is permanent / Stored in database" (lines 94–98)**

| Classification | VALID |
|----------------|-------|
| Context | Session TERMINATED state is PostgreSQL-persisted. `terminated_at != NULL` is terminal. |
| Recommended Step 3 treatment | **Retain.** |

**4.2.4 — "Idempotency: Safe retries / No duplicate effects" (lines 100–103)**

| Classification | VALID |
|----------------|-------|
| Context | Idempotency is implemented at multiple layers (idempotency guard in AI execution, credit deduction `sourceEventId`). |
| Recommended Step 3 treatment | **Retain.** |

**4.2.5 — "Explicit Ownership: Each service owns its domain / No shared state" (lines 105–108)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

---

### §3 — Service Architecture (lines 110–168)

**4.3.1 — API Gateway section (lines 112–128)**

| Classification | VALID BUT NEEDS CLARIFICATION |
|----------------|-----|
| API Gateway owns: Auth, Authorization, User identity, Session ownership | VALID. |
| API Gateway does NOT own: Containers, Runtime, Enforcement | VALID. |
| Missing from API Gateway description | Queue job submission (BullMQ enqueue for AI execution). PostgreSQL (all application persistence). Internal service coordination (container-manager HTTP client, AI service HTTP client, finalize-accounting endpoint). Orchestration module (skeleton). |
| Recommended Step 3 treatment | **Amend** to add queue submission, PostgreSQL ownership, and project/billing/chat persistence responsibilities. |

**4.3.2 — Container Manager section (lines 130–150)**

| Classification | VALID BUT INCOMPLETE |
|----------------|-----|
| CM owns: Docker lifecycle, Governance, Termination, Preview routing, Runtime state | VALID. |
| Missing | Browser smoke (Playwright Chromium via `/opt/browser-smoke`), Git service (checkpoint creation), Files service (workspace R/W). |
| Port | CM runs on port 4002 (confirmed: `main.ts` line 28). |
| Recommended Step 3 treatment | **Amend** to add git, files, browser-smoke responsibilities. |

**4.3.3 — AI Service section (lines 152–168)**

| Classification | STALE — fundamentally incomplete |
|----------------|-----|
| Existing description | "Owns: AI adapters, Token accounting, Execution routing" |
| Current reality | AI Service also owns: BullMQ WorkerProcessor (queue job consumption), Agent Harness (tool loop, tool registry, tool dispatcher, handlers), Redis Pub/Sub streaming publisher, per-builder harness config adapter, provider adapter registry (Anthropic, OpenAI, Groq, xAI, DeepSeek, stub, TestToolCapableStub). |
| Missing entirely | Worker path and harness path descriptions. |
| Recommended Step 3 treatment | **Amend** to accurately describe Worker + Harness + streaming responsibilities. Add distinction between plain execution path and gated harness path. |

**4.3.4 — Missing services: Redis, PostgreSQL, ainow.biz platform**

| Classification | FALSE BY OMISSION |
|----------------|-----|
| Not described | Redis, PostgreSQL, ainow.biz platform layer, OrchestrationModule (skeleton) |
| Recommended Step 3 treatment | **Add** Redis and PostgreSQL as infrastructure components. **Add** platform context (ainow.biz umbrella, Builder Agent, static agent registry, DB-backed user agents). |

---

### §4 — Session Lifecycle (lines 170–193)

**4.4.1 — Session states: CREATED → ACTIVE → TERMINATED (lines 172–181)**

| Classification | VALID |
|----------------|-------|
| TERMINATED is final, no resurrection | VALID. |
| Recommended Step 3 treatment | **Retain.** |

**4.4.2 — Enforcement Order (lines 183–193)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

---

### §5 — Governance Model (lines 195–222)

**4.5.1 — Layers: Request → Application → Container (lines 198–201)**

| Classification | VALID BUT NEEDS CLARIFICATION |
|----------------|-----|
| The layered governance model is correct. | However, AI execution adds a queue/worker layer between Application and Container for execution jobs. |
| Recommended Step 3 treatment | **Retain** governance layers. **Add** note about execution kill-switch (GLOBAL_EXECUTION_ENABLED) as an additional application gate. |

**4.5.2 — Application-Level: Max lifetime, Idle timeout (in-memory), Exec concurrency (lines 202–211)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

**4.5.3 — Container-Level: CPU, Memory, PID limits, Filesystem isolation (lines 213–221)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

---

### §6 — Preview Architecture (lines 224–231)

**4.6.1 — "Preview is passive proxy only. No governance logic inside preview channel." (lines 226–228)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain** the principle. |

**4.6.2 — "WebSocket = preview only. Never control plane." (lines 229–231)**

| Classification | VALID BUT NEEDS CLARIFICATION |
|----------------|-----|
| Context | WebSocket is used for preview. Control plane uses HTTP only. |
| Recommended Step 3 treatment | **Retain** with optional clarification. |

**4.6.3 — Missing: proxy target**

| Classification | STALE BY OMISSION |
|----------------|-----|
| Current reality | Preview traffic flows: Browser → API Gateway PreviewController → container-manager (default port 4002, `CONTAINER_MANAGER_URL`). Fixed by PRIVATE-BETA-BLOCKER-02 (port was wrong: 4001→4002). |
| Recommended Step 3 treatment | **Add** accurate proxy target description (API Gateway → container-manager). |

---

### §7 — Data Model (lines 233–260)

**4.7.1 — "SQLite (single-process safe)" (lines 237–239)**

| Classification | FALSE |
|----------------|-------|
| Existing claim | "Current Database: SQLite (single-process safe) — Authoritative source." |
| Current evidence | `services/api-gateway/src/config/database.config.ts`: `type: 'postgres'`. Uses `DATABASE_URL` (postgres:// scheme) or individual POSTGRES_* env vars. TypeORM configured with PostgreSQL pool (max 10 connections). Confirmed by BILLING-READY-06A (34 tables, 132 indexes, 24 migration records in PostgreSQL). Staging uses actual PostgreSQL (`aisandbox-postgres` container). |
| Correct fact | PostgreSQL is the sole authoritative database. TypeORM manages the schema through migrations. No SQLite anywhere in the active codebase. |
| Recommended Step 3 treatment | **Replace entirely.** Describe PostgreSQL, TypeORM migrations, which service owns what data. |

**4.7.2 — Session Table schema (lines 241–260)**

| Classification | VALID BUT INCOMPLETE |
|----------------|-----|
| The columns listed (id, user_id, created_at, last_activity_at, terminated_at, termination_reason) are valid. | However, the schema is now richer: `project_id` FK (PR-03-01), and many other tables exist (projects, credit_balances, credit_deduction_records, user_agents, conversations, chat_messages, git_checkpoints, usage_records, subscriptions, etc.). |
| Recommended Step 3 treatment | **Retain** session table core columns as example. **Add** note that the full schema is managed by TypeORM migrations. Do not attempt to enumerate all tables in ARCHITECTURE.md. |

---

### §8 — API Design (lines 262–292)

**4.8.1 — Public APIs (lines 264–269)**

| Classification | STALE — incomplete |
|----------------|-----|
| Listed | POST /api/sessions, GET /api/sessions/:id, DELETE /api/sessions/:id, POST /api/sessions/:id/exec |
| Reality | The actual API surface is much larger: AI execution (`/api/ai/execute`, `/api/ai/executions/:id`, stream), project endpoints, conversation/chat endpoints, snapshot/import/export endpoints, billing endpoints, user endpoints, git/checkpoint endpoints, user-agent endpoints, platform endpoints, etc. |
| Recommended Step 3 treatment | **Amend** — note that listed endpoints are illustrative, not exhaustive. Do not attempt to enumerate all endpoints. List only architecture-representative examples per service. |

**4.8.2 — Internal APIs (lines 275–290)**

| Classification | VALID |
|----------------|-------|
| The four internal endpoints are correct and locked. | `POST /api/internal/sessions/:id/start`, `stop`, `error`, `POST /api/internal/git-checkpoints`. |
| Note | A fifth internal endpoint was added: `POST /api/internal/executions/:id/finalize-accounting` (BILLING-READY-04C). |
| Recommended Step 3 treatment | **Retain** existing four. **Add** `POST /api/internal/executions/:id/finalize-accounting`. Mark all as internal-only. |

---

### §9 — Container Isolation (lines 294–311)

**4.9.1 — Stack: Docker, Overlay FS, Namespaces, cgroups, gVisor (planned) (lines 296–303)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

**4.9.2 — Filesystem: Only /workspace writable / No host mounts (lines 305–310)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

---

### §10 — Error Semantics (lines 313–322)

| Classification | VALID |
|----------------|-------|
| 404, 410, 429, 502 semantics are correct. | |
| Recommended Step 3 treatment | **Retain.** |

---

### §11 — Explicit Non-Goals (lines 324–335)

**4.11.1 — "No background cleanup" (line 326)**

| Classification | VALID (narrowly) |
|----------------|-------|
| No scheduled cleanup jobs exist. Background worker is AI execution, not cleanup. | |
| Recommended Step 3 treatment | **Retain** with clarification that AI execution queue worker exists but is not a cleanup/maintenance worker. |

**4.11.2 — "No clustering / No distributed locks / No HA / Single-node focus" (lines 326–330)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

**4.11.3 — "No resurrection" (line 327)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

**4.11.4 — "No event bus" (line 328)**

| Classification | FALSE |
|----------------|-------|
| Redis Pub/Sub is used for execution streaming. BullMQ is the queue transport. While neither is a general-purpose event bus, the absolute "No event bus" claim misrepresents the architecture. | |
| Recommended Step 3 treatment | **Replace** with accurate statement: "No general-purpose event bus. Redis is used specifically for BullMQ queue transport and execution-stream Pub/Sub." |

**4.11.5 — "No cron" (line 329)**

| Classification | VALID |
|----------------|-------|
| No cron/scheduler jobs confirmed. | |
| Recommended Step 3 treatment | **Retain.** |

---

### §12 — Summary (lines 337–361)

**4.12.1 — "Prioritizes: Determinism, Simplicity, Auditability, Governance, Predictability"**

| Classification | VALID |
|----------------|-------|
| These design goals remain accurate. | |
| Recommended Step 3 treatment | **Retain.** |

**4.12.2 — "No horizontal scaling / No HA / Single-node focus" (lines 349–354)**

| Classification | VALID |
|----------------|-------|
| Recommended Step 3 treatment | **Retain.** |

**4.12.3 — "Document Status: Authoritative / Alignment: CLAUDE.md + PRD.md" (lines 356–360)**

| Classification | VALID BUT NEEDS CLARIFICATION |
|----------------|-----|
| After reconciliation, the document should retain its authority notice. | However, the current canonical paths list includes `backend/` (line 30) which does not exist in the repository. |
| Recommended Step 3 treatment | **Remove** `backend/` from canonical paths. Retain authority notice. |

---

### §0 — Canonical Paths (lines 22–34)

```
services/api-gateway/
services/ai-service/
services/container-manager/
frontend/
backend/
```

| Classification | FALSE (for `backend/`) |
|----------------|-----|
| `backend/` | Does not exist. CLAUDE.md §Repository Layout confirms: `services/api-gateway/`, `services/ai-service/`, `services/container-manager/`, `frontend/`. No `backend/` directory. |
| Recommended Step 3 treatment | **Remove** `backend/` from canonical paths list. |

---

## 5. Architecture Claim Classification Table

| Claim | Location | Classification | Step 3 Action |
|-------|----------|----------------|---------------|
| Topology diagram: Browser→FE→API GW→CM→Docker | §1 | STALE — critically incomplete | Replace |
| "All communication is HTTP-only." | §1 | FALSE | Replace |
| "No message queues." | §1 | FALSE | Remove / Replace |
| "No event buses." | §1 | FALSE | Replace with accurate Redis Pub/Sub description |
| "No background workers." | §1 | FALSE | Remove / Replace |
| "Determinism: same input → same output" | §2 | VALID | Retain |
| "No background state mutation" | §2 | PARTIALLY SUPERSEDED | Amend |
| "No cron jobs / No schedulers" | §2 | VALID | Retain with clarification |
| "Persistent Terminal State" | §2 | VALID | Retain |
| "Idempotency" | §2 | VALID | Retain |
| "Explicit Ownership" | §2 | VALID | Retain |
| API Gateway owns: Auth/Authorization/User identity/Session | §3 | VALID | Retain |
| API Gateway does NOT own: Containers/Runtime/Enforcement | §3 | VALID | Retain |
| Container Manager owns: Docker lifecycle/Governance/Termination/Preview | §3 | VALID | Retain |
| AI Service owns: AI adapters/Token accounting/Execution routing | §3 | STALE — incomplete | Amend |
| Session states: CREATED→ACTIVE→TERMINATED, TERMINATED is final | §4 | VALID | Retain |
| Enforcement order (Exists/Terminated/MaxLifetime/Idle/Concurrency) | §4 | VALID | Retain |
| Governance layers: Request→Application→Container | §5 | VALID | Retain |
| Application-level: Max lifetime / Idle timeout / Exec concurrency | §5 | VALID | Retain |
| Container-level: CPU/Memory/PID/Filesystem | §5 | VALID | Retain |
| "Preview is passive proxy only" | §6 | VALID | Retain |
| "WebSocket = preview only / Never control plane" | §6 | VALID | Retain |
| Preview proxy target not described | §6 | STALE BY OMISSION | Add |
| "SQLite (single-process safe)" | §7 | FALSE | Replace with PostgreSQL |
| Session table columns (id/user_id/created_at/etc.) | §7 | VALID BUT INCOMPLETE | Retain as example, add note |
| Internal APIs (4 endpoints listed) | §8 | VALID BUT INCOMPLETE | Retain, add finalize-accounting |
| Public APIs list | §8 | STALE — incomplete | Amend with representative examples |
| Container isolation stack (Docker/OverlayFS/Namespaces/cgroups/gVisor-planned) | §9 | VALID | Retain |
| /workspace only writable, no host mounts | §9 | VALID | Retain |
| Error codes 404/410/429/502 | §10 | VALID | Retain |
| "No background cleanup" | §11 | VALID (narrowly) | Retain with clarification |
| "No clustering / No HA / Single-node focus" | §11 | VALID | Retain |
| "No resurrection" | §11 | VALID | Retain |
| "No event bus" | §11 | FALSE | Replace |
| "No cron" | §11 | VALID | Retain |
| Summary priorities (Determinism/Simplicity/Auditability/Governance/Predictability) | §12 | VALID | Retain |
| Trade-offs (No horizontal scaling/No HA/Single-node) | §12 | VALID | Retain |
| `backend/` in canonical paths | §0 | FALSE | Remove |
| Agent Harness / multi-agent platform | Missing from entire document | PLANNED CONTENT NOT PRESENT | Add (current/gated/planned distinctions) |
| Redis infrastructure | Missing from entire document | FALSE BY OMISSION | Add |
| PostgreSQL infrastructure | Missing from entire document | FALSE BY OMISSION | Add (after replacing SQLite) |
| ainow.biz platform context | Missing from entire document | FALSE BY OMISSION | Add |
| AI execution flow (queue path) | Missing from entire document | FALSE BY OMISSION | Add |

---

## 6. Confirmed Communication Mechanism Matrix

| From | To | Mechanism | Evidence |
|------|----|-----------|---------|
| Browser | API Gateway | HTTP/HTTPS | Standard web |
| Browser | API Gateway | SSE (GET /api/ai/executions/:id/stream) | AI-03-01A; AGENT-HARNESS-V1-MASTER-PLAN §2.1 |
| Frontend | API Gateway | HTTP (all other API calls) | Source confirmed |
| API Gateway | BullMQ queue | BullMQ job enqueue via Redis | queue.service.ts; AGENT-HARNESS-V1-MASTER-PLAN §2.1 |
| API Gateway | container-manager | HTTP (ContainerManagerHttpClient) | AGENT-HARNESS-06E §2; preview.controller.ts |
| API Gateway | PostgreSQL | TypeORM (direct, pooled) | database.config.ts |
| AI Service Worker | Redis (BullMQ) | BullMQ Worker.process() | worker.processor.ts imports `Worker` from `bullmq` |
| AI Service Worker | Redis (Pub/Sub) | `redis.publish(channel, payload)` | execution-stream.publisher.ts |
| AI Service Worker | Provider API | HTTP (per adapter) | adapter implementations |
| AI Service Worker | API Gateway | HTTP (`POST /api/internal/executions/:id/finalize-accounting`) | BILLING-READY-04C |
| AI Service Worker (Harness) | API Gateway | HTTP (ApiGatewayHttpClient for file tools) | AGENT-HARNESS-06E §2 full call chain |
| API Gateway | Redis (Pub/Sub) | `redis.subscribe(channel)` for SSE forwarding | AI execution stream SSE path |
| AI Service Worker | PostgreSQL | TypeORM DataSource (usage_records) | worker.processor.ts imports DataSource |
| container-manager | Docker engine | Docker SDK/exec | docker-runtime.service.ts |
| container-manager | API Gateway | HTTP (api-gateway-http.client.ts) | container-manager source |
| Frontend | WebSocket (API Gateway) | WS (preview streaming) | WebSocketModule, preview only |

**Summary of transport types in use:**
- HTTP: Browser↔API GW, API GW↔CM, Worker↔API GW (Harness tools + accounting), Worker→Provider
- BullMQ over Redis: API GW→Worker (job submission and consumption)
- Redis Pub/Sub: Worker→Redis (publish events), API GW→Redis (subscribe for SSE)
- TypeORM/PostgreSQL: API GW→DB (all state), Worker→DB (usage_records)
- WebSocket: Browser→API GW (preview only)
- Docker SDK: CM→Docker engine

---

## 7. Confirmed Persistence Architecture

| Data Category | Owner | Storage | Evidence |
|---------------|-------|---------|---------|
| Sessions | API Gateway | PostgreSQL (`sessions` table) | database.config.ts, Session entity |
| Users | API Gateway | PostgreSQL (`users` table) | Auth module |
| Projects | API Gateway | PostgreSQL (`projects` table, migration 1771587000000) | PR-03-01 |
| Conversations / Chat messages | API Gateway | PostgreSQL (`conversations`, `chat_messages`) | AI-04-01 |
| AI execution records | API Gateway + AI Service | PostgreSQL (`usage_records`) | AI-03-01A; worker.processor.ts |
| Git checkpoints | API Gateway | PostgreSQL (`git_checkpoints`) | GitCheckpointModule |
| Credit balances | API Gateway | PostgreSQL (`credit_balances`) | BILLING-READY-03B |
| Credit deduction records | API Gateway | PostgreSQL (`credit_deduction_records`) | BILLING-READY-03B |
| Workspace snapshots | API Gateway | Host filesystem (`snapshot-store/` directory) | PR-01-01 |
| User agents (DB-backed) | API Gateway | PostgreSQL (`user_agents`) | AGENT-PLATFORM-CREATE-01A |
| Stripe subscriptions | API Gateway | PostgreSQL (subscription tables, BILLING-READY-05B) | BILLING-READY-05B |
| Docker workspace files | container-manager | Docker container filesystem (`/workspace`) | DockerRuntimeService |
| Container runtime state | container-manager | In-memory + Docker daemon | SessionsService |
| Orchestration coordinator state | API Gateway | In-memory only (OrchestrationService) | AGENT-PLATFORM-07C1 |
| SQLite | None | **DOES NOT EXIST** | Source confirms PostgreSQL only |

---

## 8. Confirmed AI Execution Architecture

### 8.1 Single-Shot Builder Execution Path (CURRENT — active beta path)

```
1. Frontend: POST /api/ai/execute (with provider, model, sessionId, prompt, workspaceContext)
2. API Gateway: guards run (SessionCookieGuard, CSRF, ExecutionSafetyGuard[GLOBAL_EXECUTION_ENABLED],
   CreditBalanceGuard, session ownership, idempotency guard)
3. API Gateway: INSERT usage_records (status='pending')
4. API Gateway: BullMQ enqueue → ai-execution queue (Redis)
5. API Gateway: return 202 { executionId, status: 'queued' }

6. AI Service WorkerProcessor: claims job from BullMQ queue
7. Worker: buildExecutionPromptParts() assembles system + user prompt
8. Worker: [useHarness=false] AIExecutionService.execute() → provider adapter → provider API
9. Worker: extractFileActionsFromOutput() parses file-actions from response
10. Worker: ExecutionStreamPublisher.publishFileActions() → Redis Pub/Sub
11. Worker: ExecutionStreamPublisher.publishCompletion() → Redis Pub/Sub
12. Worker: UPDATE usage_records (status='completed', metadata with fileActions)
13. Worker: POST /api/internal/executions/:id/finalize-accounting → credit deduction

Frontend:
  - SSE: GET /api/ai/executions/:id/stream → API GW subscribes Redis Pub/Sub → events forwarded
  - Poll: GET /api/ai/executions/:id → usage_records read
  - On file_actions event: apply file actions → workspace coherence (tree/editor/preview/checkpoint)
```

**GLOBAL_EXECUTION_ENABLED** is a fail-safe env gate (default=false, opt-in=true). When false, POST /api/ai/execute returns 503 before any execution logic runs. This is a **runtime kill-switch**, not an architectural absence.

### 8.2 Agent Harness Multi-Turn Tool Loop Path (GATED — disabled by default)

```
Same as above through step 7.
8. Worker: [useHarness=true, AGENT_HARNESS_ENABLE_TOOL_LOOP=true]
   resolveBuilderHarnessConfig() → resolved per-builder config
   executeAgentHarnessLoop() → multi-turn loop (max 3 iterations)
     Each iteration:
       → model invocation (adapter.executeWithTools())
       → ToolDispatcher routes tool calls:
           read_file / list_files → ApiGatewayHttpClient → API GW → CM → Docker
           write_file / delete_file → same path (gated by enableWriteTools)
           run_validation → CM ValidationService (gated by enableValidationTools)
           browser_smoke → CM BrowserSmokeService/Playwright (gated by enableBrowserSmoke)
       → InMemoryHarnessAuditRecorder records events
       → pre-apply checkpoint gate (enablePreApplyCheckpoint=true)
     Loop terminates when model says 'completed' or maxToolIterations reached
9. Worker: publishes events, updates usage_records, triggers accounting
```

**Gate summary:**
- `GLOBAL_EXECUTION_ENABLED=false` (env) → 503 before any execution. CURRENT safe default on staging.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` (env) → falls through to plain execution path. CURRENT default.
- `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` (env) → write/delete tools not registered.
- `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=false` (env) → run_validation not registered.
- `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=false` (env) → browser_smoke not registered.

**search_workspace status:** Schema registered in tool-registry.ts (`enabled: false`). No handler registered in ToolDispatcher. **No implementation.** Lexical workspace search results exist in the single-shot Builder context assembly path (WorkspaceContext.searchResults in worker.processor.ts), but not as a dispatchable Harness tool handler.

**Automatic rollback:** Does NOT exist. Pre-apply checkpoint is created before first mutation (`enablePreApplyCheckpoint=true`). Rollback must be done manually via existing checkpoint/revert path.

---

## 9. Confirmed Agent Harness Current/Gated/Planned Distinctions

| Capability | Status | Evidence |
|------------|--------|---------|
| Tool registry (schema) | CURRENT | tool-registry.ts |
| ToolDispatcher | CURRENT | tool-dispatcher.ts |
| read_file handler | CURRENT | file-tool-handlers.ts; E2E proven AGENT-HARNESS-06E |
| list_files handler | CURRENT | file-tool-handlers.ts; E2E proven AGENT-HARNESS-06E |
| write_file handler | CURRENT (gated) | file-tool-handlers.ts; E2E proven AGENT-HARNESS-WRITE-CANARY-B |
| delete_file handler | CURRENT (gated) | file-tool-handlers.ts; WRITE-CANARY-A coverage |
| run_validation handler | CURRENT (gated) | validation-tool-handlers.ts |
| browser_smoke handler | CURRENT (gated) | browser-smoke-tool-handlers.ts; Playwright Chromium |
| search_workspace | SCHEMA ONLY — no handler | tool-registry.ts registered; tool-dispatcher.ts: no handler |
| Multi-turn loop (executeAgentHarnessLoop) | CURRENT (gated) | AGENT-HARNESS-06E; AGENT-HARNESS-WRITE-CANARY-B |
| Provider tool-use bridge | CURRENT (gated) | adapter.executeWithTools() |
| Per-builder harness config | CURRENT | AGENT-HARNESS-07 |
| Pre-apply checkpoint gate | CURRENT | enablePreApplyCheckpoint=true |
| Audit events (InMemoryHarnessAuditRecorder) | CURRENT | AGENT-HARNESS-05C9 |
| Automatic rollback after partial failure | NOT IMPLEMENTED | AGENT-HARNESS-V1-MASTER-PLAN §1 (listed as goal, not implemented) |
| Real-provider autonomous harness tool-loop | UNPROVEN in production | All E2E canaries used test-harness-stub provider |
| Semantic/vector search | NOT IMPLEMENTED (planned) | enableSemanticSearch=false |
| Harness tool loop active by default | GATED | AGENT_HARNESS_ENABLE_TOOL_LOOP=false |

---

## 10. Confirmed Platform Architecture (Current vs Planned)

| Component | Status | Evidence |
|-----------|--------|---------|
| ainow.biz as umbrella platform identity | CURRENT | AGENT-PLATFORM-00 |
| aiSandBox = Builder Agent module | CURRENT | AGENT-PLATFORM-00 §2.3 |
| Static system agent registry (TypeScript, read-only) | CURRENT | `frontend/lib/agent-platform/agent-registry.ts` |
| Platform dashboard (/[locale]/platform) | CURRENT | AGENT-PLATFORM-RPG-03A |
| Builder Agent CTA on dashboard (routes to /[locale]/app) | CURRENT | AGENT-PLATFORM-RPG-03A |
| Non-Builder agents (Chief of Staff, Product Strategy, Technology Advisor) | PLACEHOLDER — not functional | agent-registry.ts status='coming_soon' |
| DB-backed user-created agents (UserAgent entity) | CURRENT (persistence only) | AGENT-PLATFORM-CREATE-01A; user-agent.controller.ts |
| User-created agents as executable runtime agents | NOT IMPLEMENTED | No routing/execution wiring |
| OrchestrationService (in-memory skeleton) | CURRENT (skeleton, in-memory) | AGENT-PLATFORM-07C1; no persistence |
| Referral/collaboration runtime | SKELETON ONLY | OrchestrationService in-memory store |
| Knowledge base runtime | PLANNED | AGENT-PLATFORM-00 §5 |
| Work objects (tickets/decisions/referrals) | PLANNED | AGENT-PLATFORM-00 §6 |
| Multi-agent real-time collaboration | PLANNED | AGENT-PLATFORM-00 §7 |
| RPG office/town visual environment | CURRENT (static foundation) | AGENT-PLATFORM-RPG-03A |

---

## 11. Confirmed Governance Drift Requiring Correction

These are the false or materially stale claims that actively mislead Cursor/Claude work:

| # | Claim | Risk |
|---|-------|------|
| 1 | "SQLite (single-process safe)" | **CRITICAL** — would cause AI sessions to delete PostgreSQL or add SQLite dependencies |
| 2 | "All communication is HTTP-only." | **HIGH** — would cause removal of BullMQ/Redis infrastructure |
| 3 | "No message queues." | **HIGH** — same risk as above |
| 4 | "No background workers." | **HIGH** — would cause removal of WorkerProcessor |
| 5 | "No event buses." (+ in Non-Goals) | **MEDIUM** — mischaracterizes Redis Pub/Sub role |
| 6 | Topology diagram omits AI Service, Redis, PostgreSQL, BullMQ | **HIGH** — incomplete picture leads to incorrect architectural decisions |
| 7 | `backend/` in canonical paths | **MEDIUM** — non-existent path would confuse navigation |
| 8 | Internal APIs missing `finalize-accounting` | **LOW** — incomplete but not dangerous |

---

## 12. Genuine UNKNOWN Items

| Item | Status |
|------|--------|
| Whether container-manager has any direct PostgreSQL access | **UNKNOWN** — source inspection showed no TypeORM/DataSource in CM app.module.ts, but not fully confirmed. Likely uses only API Gateway HTTP calls for durable state. |
| Whether AI Service (non-worker) has a REST HTTP interface beyond health/port 4099 | **UNKNOWN** — worker.processor.ts confirmed, but AI service HTTP surface not fully inspected. Not architecture-critical for ARCHITECTURE.md. |
| Exact staging deployment topology (VPS specs, PM2 config) | **UNKNOWN** — evidence confirms VPS + PM2 + PostgreSQL/Redis/Docker, but do not encode specifics into ARCHITECTURE.md. |
| Future gVisor enablement timeline | **PLANNED** — ARCHITECTURE.md already says "planned." Retain as-is. |

Do NOT invent answers to these. For UNKNOWN items, ARCHITECTURE.md should either omit the detail or explicitly mark it uncertain.

---

## 13. Step 3 Bounded Edit Plan

### 13.1 Recommended Section Structure for Step 3

Step 3 should produce an ARCHITECTURE.md that retains the existing structure but corrects all FALSE/STALE claims and adds the missing critical sections. The document should be organized as follows:

**Sections to RETAIN (with minor amendments noted):**
- Authority Notice (retain — but update after reconciliation)
- Repository Layout / Canonical Paths (retain, remove `backend/`)
- Architecture Principles §2 (retain, amend determinism principle)
- Session Lifecycle §4 (retain entirely)
- Governance Model §5 (retain, add execution kill-switch note)
- Container Isolation §9 (retain entirely)
- Error Semantics §10 (retain entirely)
- Summary §12 (retain, note single-node / no HA trade-off)

**Sections to REPLACE (significantly wrong):**
- §1 System Overview topology diagram — replace with accurate multi-service topology
- §7 Data Model — replace SQLite with PostgreSQL

**Sections to AMEND (partially correct, needs additions):**
- §3 Service Architecture — add AI Service Worker role, Redis, PostgreSQL as infrastructure, add brief ainow.biz platform context
- §6 Preview Architecture — add proxy target (API GW → CM)
- §8 API Design — update public APIs to representative examples, add finalize-accounting to internal APIs
- §11 Non-Goals — remove "No event bus", replace with accurate statement; retain other non-goals

**Sections to ADD (entirely missing):**
- AI execution architecture (queue path: API GW → BullMQ → Worker → Provider → Redis Pub/Sub)
- Agent Harness (current/gated/planned table)
- Platform architecture (ainow.biz umbrella, Builder Agent, agent registry — current vs planned)
- Communication mechanism summary (HTTP vs BullMQ vs Redis Pub/Sub vs PostgreSQL)

### 13.2 Sections to NOT Add

- Do not add Stripe/payment implementation details
- Do not add deployment host specifics (VPS IP, PM2 config)
- Do not add all API endpoints (too many — keep representative)
- Do not add full database schema (too large — keep representative)
- Do not add per-builder profile registry details
- Do not describe real-provider autonomous Harness execution as proven

### 13.3 Current/Gated/Planned Labeling Requirement

Step 3 must clearly label:
- **CURRENT** — implemented and evidence-proven
- **GATED** — implemented but disabled by env flag (Agent Harness tool loop, write/delete tools, browser smoke, GLOBAL_EXECUTION_ENABLED)
- **PLANNED** — not yet implemented (gVisor, knowledge runtime, multi-agent collaboration, semantic search, automatic rollback)

### 13.4 Critical Invariants Step 3 Must Preserve

These ARCHITECTURE.md invariants must be carried forward unchanged:
- Session lifecycle states and enforcement order (§4)
- Container isolation stack description with gVisor as planned (§9)
- Error code semantics (§10)
- Internal API routes (§8, now extended to include finalize-accounting)
- Single-node focus / no HA / no horizontal scaling trade-offs (§12)
- "Preview is passive proxy only / Never control plane" (§6)

### 13.5 Minimum Safe Structure for Step 3

Step 3 must:
1. Replace topology diagram in §1 with accurate multi-service view
2. Remove "HTTP-only", "No message queues", "No background workers", "No event buses" claims from §1
3. Remove `backend/` from canonical paths
4. Replace SQLite with PostgreSQL in §7
5. Add AI Service / Worker / BullMQ / Redis to §3
6. Add brief platform context (ainow.biz / Builder Agent) to §3 or new §
7. Add AI execution flow section (queue path)
8. Add Agent Harness section (current/gated/planned)
9. Add communication mechanism summary
10. Amend §11 Non-Goals: remove "No event bus", add accurate statement
11. Add `finalize-accounting` to internal APIs §8

Step 3 must NOT:
- Touch session lifecycle §4, governance model §5, container isolation §9, error semantics §10
- Claim automatic Harness rollback exists
- Claim multi-agent runtime is live
- Claim real-provider Harness execution is production-proven
- Claim search_workspace has a working handler
- Describe GLOBAL_EXECUTION_ENABLED=false as architectural absence (it is a gate)
- Add Stripe/provider/payment implementation details
- Add deployment host specifics

---

## 14. Confirmation Checklist

- [x] ARCHITECTURE.md NOT modified in Step 2
- [x] PRD.md NOT modified
- [x] CLAUDE.md NOT modified
- [x] TASKS.md NOT modified
- [x] TASKS_BACKLOG_FULL.md NOT modified
- [x] AINOW-EXECUTION-ROADMAP.md NOT modified
- [x] AGENT-PLATFORM-00 NOT modified
- [x] No source, test, config, schema, migration, environment, Docker, or checkpoint files modified
- [x] No runtime, Docker, PostgreSQL, Redis, migration, server, browser smoke, staging, or deployment commands run
- [x] No secret-bearing `.env` files opened
- [x] No git commit or push
- [x] No task registered
- [x] PRIVATE-BETA-INVITE-01 remains untouched
- [x] GLOBAL_EXECUTION_ENABLED unchanged
- [x] All COMPLETE AND LOCKED history preserved

---

## 15. Next Step

**GOV-ARCH-01 Step 3 — Bounded ARCHITECTURE.md Reconciliation**

- Input: this document (GOV-ARCH-01-STAGE-START.md)
- Output: updated `ARCHITECTURE.md` only
- Model: Sonnet 4.6
- New window recommended
- No runtime/infrastructure action permitted
- Must implement exactly §13.5 above
- Must not go beyond §13.2 (what to NOT add)
- Must preserve all invariants in §13.4
- Must distinguish CURRENT / GATED / PLANNED per §13.3

**GOV-ARCH-01 Step 4 — Consolidation / Checkpoint**
- Create `docs/GOV-ARCH-01-CHECKPOINT.md`
- Mark GOV-ARCH-01 COMPLETE AND LOCKED
- No source changes

---

*Document created: 2026-08-10 by GOV-ARCH-01 Step 2.*
*Read-only audit — zero production, runtime, or source changes occurred during this step.*
