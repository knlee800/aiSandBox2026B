# ARCHITECTURE.md — System Architecture
## aiSandBox / ainow.biz Platform

---

## Authority Notice

This document defines the system architecture.

All implementation must conform to this file and CLAUDE.md.

If conflicts arise, these documents take precedence.

Last reconciled: 2026-08-10 (GOV-ARCH-01 Step 3 — bounded current-state reconciliation).

---

## Repository Layout (CRITICAL)

All source code lives in the repository root.

There is NO `aiSandBox/` subdirectory.

All paths are relative to root.

### Canonical Paths

```
services/api-gateway/
services/ai-service/
services/container-manager/
frontend/
```

Any change to this layout requires explicit approval.

---

## Table of Contents

1. System Overview
2. Architecture Principles
3. Service Architecture
4. Session Lifecycle
5. Governance Model
6. Preview Architecture
7. Data Model
8. API Design
9. Container Isolation
10. Error Semantics
11. AI Execution Architecture
12. Agent Harness Architecture
13. Platform Architecture
14. Communication Mechanism Summary
15. Explicit Non-Goals
16. Summary

---

## 1. System Overview

### High-Level Architecture

```
Browser
  │  HTTPS / SSE / WebSocket (preview only)
  ▼
Frontend (Next.js)
  │  /[locale]/app     — workspace (Builder)
  │  /[locale]/platform — platform dashboard (ainow.biz)
  │  HTTP + SSE
  ▼
API Gateway (NestJS) — port 4000
  │  Auth (session cookie), CSRF guard, Rate-limit guard
  │  Credit balance guard, Execution safety gate (GLOBAL_EXECUTION_ENABLED)
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
         (sessions, users, projects, conversations, chat_messages,
          usage_records, credit_balances, credit_deduction_records,
          git_checkpoints, user_agents, subscriptions, webhooks, etc.)
```

### Transport Summary

Communication is **mixed**: HTTP, BullMQ over Redis, Redis Pub/Sub, and WebSocket (preview only).
The system is not HTTP-only. The system is not queue-only.

See §14 Communication Mechanism Summary for the full matrix.

---

## 2. Architecture Principles

### Core Principles

#### Determinism
- Same input → same output is the design intent for execution logic
- AI execution runs asynchronously in a background queue worker; the worker itself is
  deterministic given fixed inputs (provider response, prompt assembly, tool results)

#### Governance on Requests, Queue-Driven Execution
- Session governance (auth, lifetime, idle, concurrency) is enforced at request time
- AI execution is queue-driven: API Gateway enqueues, WorkerProcessor claims and runs
- No cron jobs
- No schedulers

#### Persistent Terminal State
- Termination is permanent
- Stored in PostgreSQL (`terminated_at IS NOT NULL` → terminal)

#### Idempotency
- Safe retries
- No duplicate effects (idempotency guard on execution submission; `sourceEventId` on credit deductions)

#### Explicit Ownership
- Each service owns its domain
- No shared state between services except PostgreSQL (owned by API Gateway) and Redis (queue/event transport)

---

## 3. Service Architecture

### API Gateway

Owns:

- Authentication and authorization
- User identity
- Session ownership and lifecycle
- Project persistence
- Conversation and chat message persistence
- AI execution submission (BullMQ enqueue)
- Execution status and streaming surface (SSE via Redis Pub/Sub subscribe)
- Usage records and credit balance management
- Git checkpoint ledger
- User-agent records
- Preview proxy routing → container-manager
- Internal service endpoint hosting
- Orchestration coordinator (skeleton, in-memory; no persistence yet)

Does NOT own:

- Container lifecycle
- Docker runtime
- Workspace file contents
- Browser smoke execution

Path:
```
services/api-gateway/
```

---

### Container Manager

Owns:

- Docker workspace container lifecycle (create, start, stop, terminate)
- Workspace files (read/write within /workspace)
- Preview routing (port 4002)
- Git / checkpoint operations inside containers
- Browser smoke (Playwright Chromium)
- Governance enforcement at container level

Does NOT own:

- Auth
- User data
- Business/application persistence (no direct PostgreSQL access)

Path:
```
services/container-manager/
```

---

### AI Service / WorkerProcessor

Owns:

- BullMQ WorkerProcessor (claims jobs from `ai-execution` queue)
- Provider adapter registry (Anthropic, OpenAI, Groq, xAI, DeepSeek, stub)
- Plain single-shot execution path (AIExecutionService → adapter → provider API)
- Agent Harness multi-turn tool loop (GATED — see §12)
- Redis Pub/Sub execution stream publishing
- Per-builder harness config adapter
- Usage record finalization
- Credit accounting trigger (POST /api/internal/executions/:id/finalize-accounting)

Path:
```
services/ai-service/
```

---

### Infrastructure Components

#### PostgreSQL (port 5432)
- Sole authoritative durable database
- Managed via TypeORM migrations
- Owned by API Gateway for all application state
- AI Service Worker has direct access to `usage_records` only

#### Redis (port 6379)
- BullMQ backend: `ai-execution` queue transport
- Pub/Sub: `ai-execution-stream:{executionId}` channels for execution event streaming
- Not a general-purpose event bus

---

## 4. Session Lifecycle

### States

```
CREATED → ACTIVE → TERMINATED
```

TERMINATED is final.

No resurrection.

---

### Enforcement Order

1. Exists? → 404
2. Terminated? → 410
3. Max lifetime? → 410
4. Idle timeout? → 410
5. Concurrency? → 429
6. Execute

---

## 5. Governance Model

### Layers

```
Request → Application → Queue/Worker → Container
```

---

### Application-Level

- Max lifetime
- Idle timeout (in-memory)
- Exec concurrency
- Execution safety gate: `GLOBAL_EXECUTION_ENABLED` env flag (see §11 AI Execution Architecture)

---

### Container-Level

- CPU limits
- Memory limits
- PID limits
- Filesystem isolation

---

## 6. Preview Architecture

Preview is passive proxy only.

No governance logic inside preview channel.

WebSocket = preview only.

Never control plane.

### Preview Proxy Path

```
Browser → API Gateway (PreviewController) → container-manager (port 4002, CONTAINER_MANAGER_URL)
```

The proxy target is container-manager. Preview does not route to AI Service.

---

## 7. Data Model

### Current Database

**PostgreSQL** — sole authoritative database.

TypeORM manages the schema through versioned migrations.
All durable application state is PostgreSQL-backed.

No SQLite is in use anywhere in the active codebase.

---

### Persistence Boundaries

| Data Category | Owner | Storage |
|---------------|-------|---------|
| Sessions | API Gateway | PostgreSQL (`sessions`) |
| Users | API Gateway | PostgreSQL (`users`) |
| Projects | API Gateway | PostgreSQL (`projects`) |
| Conversations / Chat messages | API Gateway | PostgreSQL (`conversations`, `chat_messages`) |
| AI execution records | API Gateway + AI Service | PostgreSQL (`usage_records`) |
| Git checkpoints | API Gateway | PostgreSQL (`git_checkpoints`) |
| Credit balances | API Gateway | PostgreSQL (`credit_balances`) |
| Credit deduction records | API Gateway | PostgreSQL (`credit_deduction_records`) |
| Workspace snapshots | API Gateway | Host filesystem (`snapshot-store/`) |
| User agents | API Gateway | PostgreSQL (`user_agents`) |
| Stripe subscriptions | API Gateway | PostgreSQL (subscription tables) |
| Docker workspace files | container-manager | Docker container filesystem (`/workspace`) |
| Container runtime state | container-manager | In-memory + Docker daemon |
| Orchestration coordinator state | API Gateway | In-memory only (no persistence) |

---

### Session Table (representative schema)

```sql
id
user_id
project_id
created_at
last_activity_at
terminated_at
termination_reason
```

`terminated_at IS NOT NULL` → terminal state.

Full schema is managed by TypeORM migrations. Do not maintain a full table inventory here.

---

## 8. API Design

### Public APIs (representative — not exhaustive)

```
POST   /api/sessions
GET    /api/sessions/:id
DELETE /api/sessions/:id

POST   /api/ai/execute
GET    /api/ai/executions/:id
GET    /api/ai/executions/:id/stream   (SSE)

POST   /api/projects
GET    /api/projects/:id

GET    /api/conversations
POST   /api/conversations

GET    /api/git-checkpoints
POST   /api/git-checkpoints/revert
```

JWT / session cookie required.

Ownership enforced on all session and project resources.

---

### Internal APIs (LOCKED)

These endpoints are internal service-to-service only.
Never expose to frontend or external users.
Never refactor security, guard strategy, or service identity without explicit task authorization.

```
POST /api/internal/sessions/:id/start
POST /api/internal/sessions/:id/stop
POST /api/internal/sessions/:id/error
POST /api/internal/git-checkpoints
POST /api/internal/executions/:id/finalize-accounting
```

---

## 9. Container Isolation

### Stack

- Docker
- Overlay FS
- Namespaces
- cgroups
- gVisor (PLANNED)

---

### Filesystem

Only `/workspace` is writable.

No host mounts.

---

## 10. Error Semantics

| Code | Meaning |
|------|---------|
| 404  | Not found |
| 410  | Terminated |
| 429  | Rate limit |
| 502  | Preview failure |

410 is permanent.

---

## 11. AI Execution Architecture

### 11.1 Single-Shot Builder Path (CURRENT — active beta path)

```
1. Frontend: POST /api/ai/execute
2. API Gateway: guards run (session cookie, CSRF, GLOBAL_EXECUTION_ENABLED,
   CreditBalanceGuard, session ownership, idempotency guard)
3. API Gateway: INSERT usage_records (status='pending')
4. API Gateway: BullMQ enqueue → ai-execution queue (Redis)
5. API Gateway: return 202 { executionId, status: 'queued' }

6. AI Service WorkerProcessor: claims job from BullMQ queue
7. Worker: assembles prompt (system + user + workspace context)
8. Worker: [useHarness=false] AIExecutionService.execute() → provider adapter → provider API
9. Worker: parses file-actions from response
10. Worker: publishes file-action and completion events → Redis Pub/Sub
11. Worker: UPDATE usage_records (status='completed')
12. Worker: POST /api/internal/executions/:id/finalize-accounting → credit deduction

Frontend:
  SSE:  GET /api/ai/executions/:id/stream → API GW subscribes Redis → events forwarded to browser
  Poll: GET /api/ai/executions/:id → usage_records read
  On file_actions: apply actions → workspace coherence (tree/editor/preview/checkpoint)
```

### 11.2 Safety Gates

| Gate | Env Flag | Default | Effect |
|------|----------|---------|--------|
| Execution kill-switch | `GLOBAL_EXECUTION_ENABLED` | `false` (opt-in) | When false, POST /api/ai/execute returns 503 before any logic runs |
| Harness tool loop | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | When false, falls through to plain single-shot path |
| Write/delete tools | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | When false, write_file/delete_file not registered |
| Validation tool | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | When false, run_validation not registered |
| Browser smoke tool | `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | When false, browser_smoke not registered |

`GLOBAL_EXECUTION_ENABLED=false` is a **runtime safety kill-switch**, not an architectural absence.
A disabled gate does not mean the architecture is absent.

---

## 12. Agent Harness Architecture

### 12.1 Current / Gated / Not-Implemented Table

| Capability | Status | Notes |
|------------|--------|-------|
| Tool registry (typed schema) | CURRENT | `tool-registry.ts` |
| ToolDispatcher | CURRENT | `tool-dispatcher.ts` |
| `read_file` handler | CURRENT | E2E proven (AGENT-HARNESS-06E) |
| `list_files` handler | CURRENT | E2E proven (AGENT-HARNESS-06E) |
| `write_file` handler | CURRENT (GATED) | E2E proven (AGENT-HARNESS-WRITE-CANARY-B); requires `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` |
| `delete_file` handler | CURRENT (GATED) | Covered by write-canary tests; same gate |
| `run_validation` handler | CURRENT (GATED) | Requires `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=true` |
| `browser_smoke` handler | CURRENT (GATED) | Playwright Chromium; requires `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=true` |
| Multi-turn bounded loop (`executeAgentHarnessLoop`) | CURRENT (GATED) | Max 3 iterations; requires `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` |
| Provider tool-use bridge (`executeWithTools`) | CURRENT (GATED) | Activated with harness path |
| Per-builder harness config | CURRENT | AGENT-HARNESS-07 |
| Pre-apply checkpoint gate | CURRENT | `enablePreApplyCheckpoint=true`; created before first write mutation |
| Audit events (`InMemoryHarnessAuditRecorder`) | CURRENT | In-memory only; not persisted to DB |
| `search_workspace` | SCHEMA ONLY — no handler | Registered in tool-registry.ts (`enabled: false`); no handler in ToolDispatcher |
| Automatic rollback after partial failure | NOT IMPLEMENTED | Pre-apply checkpoint exists; rollback is manual via checkpoint/revert path |
| Semantic / vector search | NOT IMPLEMENTED (PLANNED) | `enableSemanticSearch=false` |
| Real-provider autonomous harness loop | UNPROVEN in production | All E2E canaries used test-harness-stub provider |

### 12.2 Harness Execution Path (GATED)

```
Same entry as single-shot through step 7 (guards, enqueue, Worker claims job).
8. Worker: [useHarness=true, AGENT_HARNESS_ENABLE_TOOL_LOOP=true]
   resolveBuilderHarnessConfig() → per-builder config
   executeAgentHarnessLoop() → multi-turn loop (max maxToolIterations)
     Each iteration:
       → adapter.executeWithTools() — model invocation with tool schema
       → ToolDispatcher routes tool calls:
           read_file / list_files → ApiGatewayHttpClient → API GW → CM → Docker
           write_file / delete_file (gated) → same path
           run_validation (gated) → CM ValidationService
           browser_smoke (gated) → CM BrowserSmokeService / Playwright
       → InMemoryHarnessAuditRecorder records events
       → pre-apply checkpoint created before first write mutation
     Loop terminates: model signals 'completed' OR maxToolIterations reached
9. Worker: publishes events, updates usage_records, triggers accounting (same as plain path)
```

**Automatic rollback does NOT exist.**
A pre-apply checkpoint is created before the first mutation. If a partial failure occurs,
rollback must be initiated manually through the existing checkpoint/revert path.

---

## 13. Platform Architecture

### 13.1 ainow.biz Platform Context

ainow.biz is the umbrella platform. aiSandBox is the Builder Agent module within it.

| Component | Status |
|-----------|--------|
| ainow.biz platform identity and dashboard (`/[locale]/platform`) | CURRENT |
| aiSandBox = Builder Agent module (`/[locale]/app`) | CURRENT |
| Static TypeScript system-agent registry (`frontend/lib/agent-platform/agent-registry.ts`) | CURRENT |
| DB-backed user-created agent records (`user_agents` table, UserAgent entity) | CURRENT (persistence only) |
| Platform RPG office/town shell (static foundation) | CURRENT |
| OrchestrationService | CURRENT (in-memory skeleton; no persistence) |
| Builder Agent AI execution | CURRENT |
| Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) | PLACEHOLDER — `status: 'coming_soon'`; not functional |
| User-created agents as executable runtime agents | NOT IMPLEMENTED |
| Referral / agent collaboration runtime | SKELETON ONLY (OrchestrationService in-memory) |
| Knowledge base runtime | PLANNED |
| Work objects (tickets, decisions, referrals) | PLANNED |
| Multi-agent real-time collaboration | PLANNED |
| Semantic / vector retrieval | PLANNED |

### 13.2 Agent Registry

The system-agent registry is a static TypeScript declaration (`agent-registry.ts`).
It is read-only at runtime. Non-Builder agents are declared but not executable.

User-created agents are persisted to PostgreSQL via the `user_agents` table.
User-created agents are **not** routed to any execution runtime yet.

### 13.3 What Is Not Current Platform Architecture

Do not describe the following as current:

- Knowledge ingestion runtime
- Vector database / semantic retrieval
- Real non-Builder agent execution
- Work-object runtime
- Chief-of-Staff, Product Strategy, or Technology Advisor agent execution
- Multi-agent collaboration runtime
- Automatic Harness rollback
- Harness `search_workspace` handler

---

## 14. Communication Mechanism Summary

The system uses mixed communication mechanisms. It is neither HTTP-only nor queue-only.

| From | To | Mechanism |
|------|----|-----------|
| Browser | API Gateway | HTTP / HTTPS |
| Browser | API Gateway | SSE (`GET /api/ai/executions/:id/stream`) |
| Browser | API Gateway | WebSocket (preview only) |
| Frontend | API Gateway | HTTP (all other API calls) |
| API Gateway | BullMQ / Redis | BullMQ job enqueue (ai-execution queue) |
| API Gateway | container-manager | HTTP |
| API Gateway | PostgreSQL | TypeORM (pooled, direct) |
| API Gateway | Redis (Pub/Sub) | Subscribe to `ai-execution-stream:{id}` for SSE forwarding |
| AI Service Worker | Redis (BullMQ) | BullMQ Worker.process() — job consumption |
| AI Service Worker | Redis (Pub/Sub) | Publish execution events to `ai-execution-stream:{id}` |
| AI Service Worker | Provider API | HTTP (per adapter) |
| AI Service Worker | API Gateway | HTTP (`POST /api/internal/executions/:id/finalize-accounting`) |
| AI Service Worker (Harness) | API Gateway | HTTP (ApiGatewayHttpClient — file tool calls) |
| API Gateway → CM | Docker workspace | HTTP (ContainerManagerHttpClient) |
| container-manager | Docker engine | Docker SDK |
| container-manager | API Gateway | HTTP (api-gateway-http.client) |

**Transport types in use:**
- **HTTP** — Browser↔API GW, API GW↔CM, Worker↔API GW (Harness tools + accounting), Worker→Provider
- **BullMQ over Redis** — API GW→Worker (job submission and consumption)
- **Redis Pub/Sub** — Worker→Redis (publish), API GW→Redis (subscribe for SSE forwarding)
- **TypeORM / PostgreSQL** — API GW (all application state), AI Worker (usage_records)
- **WebSocket** — Browser↔API GW (preview streaming only)
- **Docker SDK** — CM↔Docker engine

---

## 15. Explicit Non-Goals

- No background cleanup workers (AI execution queue worker is for execution, not maintenance)
- No clustering
- No distributed locks
- No HA
- No horizontal scaling
- No resurrection of terminated sessions
- No general-purpose event bus (Redis is used specifically for BullMQ queue transport and
  execution-stream Pub/Sub — not as a general event bus)
- No cron
- No schedulers
- No Kubernetes
- No Kafka
- No event-sourcing architecture

All intentional for current scope.

---

## 16. Summary

This architecture prioritizes:

- Determinism
- Simplicity
- Auditability
- Governance
- Predictability

Trade-offs:

- No horizontal scaling
- No HA
- Single-node focus

These are accepted.

---

Document Status: Authoritative
Alignment: CLAUDE.md + PRD.md
Layout: Root-Based Monorepo
Last reconciled: 2026-08-10 (GOV-ARCH-01)
