# ARCHITECTURE.md — System Architecture
## aiSandBox / ainow.biz Platform

---

## Authority Notice

This document defines the system architecture (**TECHNICAL HOW**).

Product scope, user-facing promises, and launch language belong to `PRD.md` (**PRODUCT WHAT**). This file does not override `PRD.md`. `PRD.md` does not override this file.

All implementation must conform to this file and `CLAUDE.md`.

If conflicts arise, these documents take precedence in their domains.

Last reconciled: 2026-08-24 (GOV-ARCH-02 Step 3 — bounded current-state reconciliation). Prior freeze: 2026-08-10 (GOV-ARCH-01).

---

## CURRENT vs PLANNED / FUTURE

Unlabeled statements in this document are **CURRENT** implemented architecture.

**PLANNED / FUTURE** architecture must be labeled as such. Gated, precursor, persistence-only, or leftover surfaces are not operational product capability.

Hard CURRENT constraints:

- Private-beta AI execution is **Builder-first single-shot**. Harness is implemented but gated off (`AGENT_HARNESS_ENABLE_TOOL_LOOP=false`). Harness is not the beta default.
- Multi-agent product runtime is **not** operational. Specialist agents are placeholders. User-created agents are persisted, not executable.
- The in-memory orchestration coordinator is instantiated in API Gateway and is **not product-reachable** (no HTTP surface).
- Stripe charging is **not** CURRENT. Internal credit-ledger deduction is CURRENT and is independent of `BILLING_CHARGES_ENABLED`.
- Google OAuth routes exist but are **not activated** (fail-closed when the Passport strategy is unregistered).

Do not read approved plans, master-plan documents, or historical canaries as CURRENT HOW.

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

### High-Level Architecture (CURRENT)

```
Browser
  │  HTTPS / SSE / WebSocket (preview iframe only)
  ▼
Caddy (staging / current public TLS terminator)
  │  /api/*      → API Gateway :4000
  │  app pages   → Frontend (Next.js) :3002
  ▼
Frontend (Next.js) — port 3002
  │  /[locale]/app      — workspace (Builder)
  │  /[locale]/platform — platform dashboard shell
  │  iframe src=/api/preview/:sessionId/proxy
  │
  │  Local-dev without Caddy:
  │    Next.js fallback rewrite /api/:path* → Gateway
  │    Named App Router routes win over fallback
  │    (confirm-build-apply proxy is retained locally; not staging public path)
  ▼
API Gateway (NestJS) — port 4000
  │  Auth (session cookie), CSRF guard, Rate-limit guard
  │  Credit balance guard, Execution safety gate (GLOBAL_EXECUTION_ENABLED)
  │
  ├──► BullMQ queue (ai-execution) ── Redis (port 6379)
  │                                         │  Pub/Sub: ai-execution-stream:{executionId}
  │                                         ▼
  │                              AI Service / WorkerProcessor (port 4001)
  │                                  │  [plain path — CURRENT beta] AIExecutionService → provider API
  │                                  │  [harness path — GATED, not beta default]
  │                                  │    executeAgentHarnessLoop → ToolDispatcher
  │                                  │      → API Gateway (HTTP) → container-manager (HTTP)
  │                                  │
  │                                  ├──► Redis Pub/Sub (publish execution events)
  │                                  ├──► PostgreSQL (usage_records update)
  │                                  └──► POST /api/internal/executions/:id/finalize-accounting
  │                                        (usage finalization; not always the credit-charge point)
  │
  ├──► GET /api/ai/executions/:id/stream → Redis Pub/Sub subscribe → SSE to browser
  ├──► GET /api/ai/executions/:id        → PostgreSQL read
  ├──► POST /api/ai/executions/:id/confirm-build-apply
  │        (qualifying workspace_mutation apply → credit deduction)
  │
  ├──► container-manager (HTTP, port 4002)
  │       DockerRuntimeService → Docker workspace containers
  │         host bind-mount: ${workspacePath}:/workspace:rw
  │       SessionsService (idle/lifetime; local SQLite)
  │       FilesService, GitService, PreviewStrategyResolver, BrowserSmokeService
  │
  └──► PostgreSQL (port 5432)
         TypeORM — all durable application state
         (sessions, users, projects, conversations, chat_messages,
          usage_records, credit_balances, credit_deduction_records,
          git_checkpoints, user_agents, subscriptions, webhooks, etc.)
```

HISTORICAL: process-scoped Harness canaries used `PORT=4099` to avoid listen conflicts. **4099 is not a current AI Service network layer.** Canonical listen port is **4001**.

### Deployment topology (CURRENT vs alternate)

| Topology | What it runs | Status |
|----------|----------------|--------|
| Current staging | Caddy + PM2 host processes: Gateway `:4000`, AI Service `:4001`, container-manager `:4002`, Frontend `:3002` | **CURRENT** public/private-beta topology |
| `docker-compose.yml` | PostgreSQL, Redis, Prometheus, Grafana **only** | **CURRENT local infrastructure.** Does not run application processes. |
| `docker-compose.prod.yml` | Infra **plus** gateway / ai-service / container-manager / frontend images | **Alternate / future** image topology. **Not** current staging HOW. |

Do not describe `docker-compose.yml` as the current staging application-process topology.

Frontend listens on **3002** (`next dev -p 3002` / staging PM2). Local Grafana compose uses `:3000` (local infra only).

### Transport Summary

Communication is **mixed**: HTTP, BullMQ over Redis, Redis Pub/Sub, and WebSocket (preview only).
The system is not HTTP-only. The system is not queue-only.

Builder single-shot execution is **BullMQ-based**. It is not a Gateway HTTP call to AI Service `POST /api/execute`.

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
- Idle timeout is request-driven inside container-manager (no idle sweeper / cron)
- AI execution is queue-driven: API Gateway enqueues, WorkerProcessor claims and runs
- No cron jobs
- No platform schedulers for session maintenance

#### Persistent Terminal State
- Termination is permanent
- Stored in PostgreSQL (`terminated_at IS NOT NULL` → terminal)

#### Idempotency
- Safe retries
- No duplicate effects (idempotency guard on execution submission)
- Credit deductions keyed by `sourceEventId` = `executionId` (unique `credit_deduction_records.source_event_id`)

#### Explicit Ownership
- Each service owns its domain
- Durable **application** state is PostgreSQL (owned by API Gateway)
- Redis is queue / Pub/Sub transport, not a general event bus
- container-manager owns local/runtime state in SQLite plus Docker FS — not application Postgres

---

## 3. Service Architecture

### API Gateway

Owns:

- Authentication and authorization (email/password, session cookie, CSRF, API keys)
- User identity
- Session ownership and lifecycle (PostgreSQL `sessions`; receives CM stop/error notifications)
- Project persistence
- Conversation and chat message persistence
- AI execution submission (BullMQ enqueue)
- Execution status and streaming surface (SSE via Redis Pub/Sub subscribe)
- Usage records and credit-ledger deduction
- Public confirm-build-apply (Build credit trigger)
- Git checkpoint ledger (`git_checkpoints`)
- User-agent records (`user_agents`) — persistence/API only
- Preview proxy routing → container-manager
- Internal service endpoint hosting
- Health / readiness / db endpoints
- Orchestration coordinator: **in-memory, instantiated at Gateway boot, no HTTP surface, not product-reachable**

Does NOT own:

- Container lifecycle
- Docker runtime
- Workspace file contents
- Browser smoke execution
- Session idle-timeout clock (container-manager `SessionsService`)

Path:
```
services/api-gateway/
```

---

### Container Manager

Owns:

- Docker workspace container lifecycle (create, start, stop, terminate)
- Host bind-mount of the session workspace into `/workspace`
- Workspace files (read/write within `/workspace`)
- Preview strategy resolution and serving (port 4002)
- Git / checkpoint operations inside containers
- Browser smoke (Playwright Chromium)
- Governance enforcement at container level (lifetime, idle, concurrency)
- Local SQLite for session/container/git runtime state

Does NOT own:

- Auth
- User data
- Business/application persistence (no PostgreSQL)

Path:
```
services/container-manager/
```

---

### AI Service / WorkerProcessor

Listens on **port 4001** (`process.env.PORT || 4001`). Staging PM2 binds `PORT=4001`.

Owns:

- BullMQ WorkerProcessor (claims jobs from `ai-execution` queue)
- Provider adapter registry (Anthropic, OpenAI, Groq, xAI, DeepSeek, stub)
- Plain single-shot execution path (AIExecutionService → adapter → provider API) — **CURRENT private-beta path**
- Agent Harness multi-turn tool loop (**GATED — not private-beta default**; see §12)
- Redis Pub/Sub execution stream publishing
- Per-builder harness config adapter
- `usage_records` finalization (status, tokens, result metadata)
- HTTP `POST /api/internal/executions/:id/finalize-accounting` — **usage/accounting finalization**, not the Build credit-charge point
- Stuck-execution watchdog (in-process timer; execution recovery only)
- HTTP health/metrics and leftover `POST /api/execute` (not the current Builder path)

Does NOT own:

- Credit-ledger deduction for qualifying Build applies (Gateway `triggerBuildApplyDeduction`)
- Workspace mutation (frontend file-action apply → Gateway → CM)

A leftover Gateway `AIServiceHttpClient` still defaults to `http://localhost:4001`. It is **not** the current Builder execute path.

Path:
```
services/ai-service/
```

---

### Frontend (Next.js)

Owns:

- Locale UI at `/[locale]/app` (Builder workspace) and `/[locale]/platform` (dashboard shell)
- File-action parse / risky-confirm / AUTO_APPLY / apply-once / sequential write / post-apply coherence
- Preview iframe pointing at Gateway preview proxy
- Local-dev App Router proxy for confirm-build-apply (retained; not staging public path)

Does NOT own:

- Canonical staging `/api/*` routing (Caddy → Gateway)
- Durable application state

Path:
```
frontend/
```

Local/staging listen port: **3002**.

---

### Infrastructure Components

#### PostgreSQL (port 5432)
- Sole authoritative **application** durable database
- Managed via TypeORM migrations
- Owned by API Gateway for all application state
- AI Service Worker has direct access to `usage_records` only
- container-manager does **not** use PostgreSQL

#### Redis (port 6379)
- BullMQ backend: `ai-execution` queue transport
- Pub/Sub: `ai-execution-stream:{executionId}` channels for execution event streaming
- Not a general-purpose event bus

#### container-manager SQLite
- Local/runtime state for sessions, containers, and git operations inside container-manager
- Not the application source of truth
- Distinct from PostgreSQL `sessions` / `git_checkpoints`

#### Local compose monitoring (CURRENT local infra HOW)
- Prometheus (`:9090`) and Grafana (`:3000`) are defined in `docker-compose.yml`
- Local scrape config targets compose hostname `ai-service:4001` `/metrics`
- Whether current staging Prometheus scrapes the PM2 process on `localhost:4001` was **not asserted** by GOV-ARCH-02
- Do not treat compose scrape topology as proven staging monitor HOW

---

### Auth (CURRENT HOW)

- Email/password: `POST /api/auth/register`, `POST /api/auth/login`
- Email verification: `GET /api/auth/email/verify`, `POST /api/auth/email/verify/resend`
- Password reset: `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm`
- Session: `GET /api/auth/me`, `POST /api/auth/logout`
- Cookies: `aisandbox_session` (session) and `aisandbox_csrf` (CSRF)
- Execute / confirm-build-apply accept `SessionOrApiKeyAuthGuard`
- Ownership: session / project / execution / agent rows scoped to `userId`; cross-user reads return not-found
- Google and Apple OAuth **routes exist**. If the Passport strategy is not registered, redirect is `oauth_failed`. Google OAuth is **not activated**.
- Generated-app auth templates **must not** reference `aisandbox_session`, `aisandbox_csrf`, `aisandbox_oauth_state`, `X-Internal-Service-Key`, or platform guards

Product activation of Google OAuth is a PRODUCT WHAT decision (`PRD.md` / GOV-PRD-02). This file records only the fail-closed technical state.

---

### Billing / credits (CURRENT HOW vs FUTURE charging)

See §11.3 for Builder/Ask deduction timing.

| Mechanism | Status |
|-----------|--------|
| Persistent credit ledger (`credit_balances`, `credit_deduction_records`, grants) | **CURRENT** |
| Authoritative displayed balance | `credit_balances.balance` |
| Token → credit (`model_tokens`, 1 credit = 1 token) | **CURRENT** |
| `BILLING_CHARGES_ENABLED=false` | **CURRENT default / safety gate** — prevents **Stripe charging only**. Does **not** disable internal credit-ledger deduction. |
| StripePaymentProvider | Modes exist (disabled/stub/test/live). **No Stripe SDK. No live charging.** |
| Checkout / webhook scaffolding | Present; cannot charge while the gate is false |
| Stripe charging | **FUTURE / deferred** |

LIVE-11 proved a qualifying credit deduction with Stripe charging disabled.

---

### Monitoring (CURRENT HOW)

| Surface | Owner | Status |
|---------|-------|--------|
| `GET /api/health` | Gateway | CURRENT |
| `GET /api/health/ready` | Gateway | CURRENT (startup guards) |
| `GET /api/health/db` | Gateway | CURRENT |
| AI Service `/metrics` | AI Service | CURRENT scrape target in **local compose** Prometheus config |
| Worker stuck-execution watchdog | AI Service WorkerProcessor | CURRENT in-process recovery for stuck `running` executions. **Not** a session idle reaper. |
| Prometheus / Grafana | `docker-compose.yml` | CURRENT **local infrastructure**. Staging scrape of PM2 processes is unverified. |

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

Idle timeout is enforced by container-manager on **request-driven** session access (see §5). Preview does not participate in the idle check.

---

## 5. Governance Model

### Layers

```
Request → Application (Gateway) → Queue/Worker → Container-manager / Docker
```

---

### Application-Level (API Gateway)

- Execution safety gate: `GLOBAL_EXECUTION_ENABLED` env flag (see §11)
- CreditBalanceGuard on execute
- Session ownership / CSRF / auth
- PostgreSQL session terminal state (`terminated_at`, `termination_reason`)
- Receives `POST /api/internal/sessions/:id/stop` with `{ reason: idle_timeout }` from container-manager and persists termination

PostgreSQL `sessions.last_activity_at` is application persistence. It is **not** the idle-timeout clock.

---

### Runtime idle timeout (container-manager — CURRENT)

| Fact | Value |
|------|--------|
| Duration (default) | **1800000 ms = 30 minutes** |
| Config | `SESSION_IDLE_TIMEOUT_MS` (container-manager `GovernanceConfig`) |
| Owner | container-manager `SessionsService` |
| Mechanism | Request-driven in-memory `lastActivity` Map |
| Sweeper / cron / `setInterval` idle reaper | **None** |
| Preview path | Does **not** update or check idle |
| Active AI execution | Does **not** suppress idle timeout |

Whether a later operator overrode `SESSION_IDLE_TIMEOUT_MS` on staging after the locked 03K default-applied evidence is **not asserted** here. Architecture is: default 30 minutes, configurable by env.

---

### Container-Level

- CPU limits
- Memory limits
- PID limits
- Filesystem isolation (`/workspace` writable inside the container)
- Host bind-mount of the session workspace directory (see §9)

---

## 6. Preview Architecture

Preview is a **strategy-resolved** serving path plus a **passive proxy**. There is no session-governance logic inside the preview channel (idle is not checked on preview).

WebSocket = preview only.

Never control plane.

HISTORICAL: LIVE-08 used a runner fixture `e2e-auto.html`. That is **not** product Preview HOW. Current static HTML contract is `index.html`.

### PreviewStrategyResolver (container-manager)

Detection order:

1. Optional start command → `node-dev-server` / `process-proxy`
2. `package.json` scripts / framework → `node-dev-server` where resolved
3. `/workspace/index.html` → `static-html` / `direct-read` (`appRoot=/workspace`)
4. Immediate subdirectory `/workspace/*/index.html` → `static-html` / `direct-read`
5. Else `unknown` (including HTML without `index.html` → missing-index diagnostic)

Root `index.html` is preferred over a subdirectory. Other HTML without `index.html` does not satisfy the static contract.

Node-dev-server / framework preview via `package.json` is implemented in the resolver (**CURRENT capability**). The private-beta proven path is **static `index.html`**.

### Preview Proxy Path

```
Browser iframe
  src=/api/preview/:sessionId/proxy?refresh=
    → Caddy /api/* (staging) or Next rewrite (local)
    → API Gateway PreviewController
    → container-manager :4002
```

The proxy target is container-manager. Preview does not route to AI Service.

---

## 7. Data Model

### Current Database

**PostgreSQL** is the sole authoritative **application** database.

TypeORM manages the schema through versioned migrations.
All durable application state is PostgreSQL-backed.

container-manager uses **local SQLite** for runtime session/container/git state. That is not application source of truth.

---

### Persistence Boundaries

| Data Category | Owner | Storage |
|---------------|-------|---------|
| Sessions (application) | API Gateway | PostgreSQL (`sessions`) |
| Users | API Gateway | PostgreSQL (`users`) |
| Projects | API Gateway | PostgreSQL (`projects`) |
| Conversations / Chat messages | API Gateway | PostgreSQL (`conversations`, `chat_messages`) |
| AI execution records | API Gateway + AI Service | PostgreSQL (`usage_records`) |
| Git checkpoints (ledger) | API Gateway | PostgreSQL (`git_checkpoints`) |
| Credit balances | API Gateway | PostgreSQL (`credit_balances`) |
| Credit deduction records | API Gateway | PostgreSQL (`credit_deduction_records`) |
| Workspace snapshots | API Gateway | Host filesystem (`snapshot-store/`) |
| User agents | API Gateway | PostgreSQL (`user_agents`) — persistence only; not an execution runtime |
| Stripe subscription rows | API Gateway | PostgreSQL (subscription tables) — schema CURRENT; live Stripe charging NOT CURRENT |
| Docker workspace files | container-manager | Host workspace directory bind-mounted as `/workspace` |
| Container / session runtime state | container-manager | **Local SQLite** + Docker daemon + in-memory `lastActivity` |
| Git operations inside container | container-manager | Git in `/workspace` + CM SQLite; ledger is Gateway Postgres |
| Orchestration coordinator state | API Gateway | In-memory only (no persistence; not product-reachable) |

`user_agents` schema, entity, and migration exist in the repository. Locked staging evidence records that migration `CreateUserAgentsTable1772500000000` was applied. Live row contents were **not** probed by GOV-ARCH-02.

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

### Public routing (CURRENT)

Staging / current public traffic:

```
Browser /api/*  →  Caddy  →  API Gateway :4000
```

The Next.js App Router confirm-build-apply proxy remains in the repository and can intercept the same relative URL in **local Next.js** before rewrite fallback. It is **not** the canonical staging public path.

---

### Public APIs (representative — not exhaustive)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/email/verify
POST   /api/auth/email/verify/resend
POST   /api/auth/password-reset/request
POST   /api/auth/password-reset/confirm
GET    /api/auth/me
POST   /api/auth/logout

GET    /api/health
GET    /api/health/ready
GET    /api/health/db

POST   /api/sessions
GET    /api/sessions/:id
DELETE /api/sessions/:id
POST   /api/sessions/:id/checkpoints
GET    /api/sessions/:id/checkpoints
GET    /api/sessions/:id/checkpoints/:hash/diff
POST   /api/sessions/:id/revert

POST   /api/ai/execute
GET    /api/ai/executions/:id
GET    /api/ai/executions/:id/stream   (SSE)
POST   /api/ai/executions/:executionId/confirm-build-apply

POST   /api/projects
GET    /api/projects/:id

GET    /api/conversations
POST   /api/conversations

POST   /api/agents
GET    /api/agents
GET    /api/agents/:id

GET    /api/preview/:sessionId/proxy
```

Session cookie (and CSRF where required). Execute / confirm-build-apply also accept API key via `SessionOrApiKeyAuthGuard`.

Ownership enforced on session, project, execution, and agent resources (cross-user → not-found).

`POST /api/agents` and `GET /api/agents` persist and list user-created agent **records**. They do not start autonomous product agents.

Do **not** treat `/api/git-checkpoints` as the canonical public checkpoint API.

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
POST /api/internal/executions/:id/confirm-build-apply
```

Public confirm-build-apply does not replace the internal route. Staging browsers use the **public** Gateway route via Caddy.

---

## 9. Container Isolation

### Stack

- Docker
- Overlay FS
- Namespaces
- cgroups
- gVisor (**PLANNED / FUTURE** — not current)

---

### Filesystem

Inside the container, only `/workspace` is writable.

The host session workspace directory **is bind-mounted**:

```
Binds: [`${workspacePath}:/workspace:rw`]
```

Do not state “no host mounts.” The bind-mount is CURRENT runtime architecture. It is the reason Git must set `safe.directory` to `/workspace` (Git 2.52 rejects root-owned `.git` vs uid-1000 bind-mounted `/workspace`). `safe.directory` is set to `/workspace` only — not `*`.

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

### 11.1 Single-Shot Builder Path (CURRENT — private-beta default)

Harness is **not** this path. See §12.

```
1. Frontend: POST /api/ai/execute
     { sessionId, conversationId, prompt, executionIntent?, provider?, model?,
       workspaceContext?, agentRole?, builderProfileId?, collaborationRunId?,
       referralTraceId? }
     Optional identity fields are accepted plumbing. The frontend does not currently send
     agentRole, builderProfileId, collaborationRunId, or referralTraceId.

2. Staging: Caddy /api/* → Gateway
   Local-dev: Next rewrite/fallback (except named App Router routes)

3. API Gateway guards: session cookie / CSRF / GLOBAL_EXECUTION_ENABLED /
   CreditBalanceGuard / session ownership / idempotency (requestId)

4. executionId = uuid v4 (or reuse timeout/failed row)
5. INSERT usage_records pending + metadata (intent, optional identity fields)
6. BullMQ enqueue ai-execution
7. Return 202 { executionId, status: 'queued' }

8. WorkerProcessor claims job
9. useHarness = (harnessVersion === 'v1' AND DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop)
   CURRENT beta: false → AIExecutionService → adapter → provider
10. Parse file-actions; publish Redis Pub/Sub; UPDATE usage_records completed
11. POST /api/internal/executions/:id/finalize-accounting
      conversation / missing persisted intent / unknown persisted intent → deduct now
      workspace_mutation → skip (build_awaiting_apply)  — not the Build charge point

Frontend:
  SSE:  GET /api/ai/executions/:id/stream → API GW subscribes Redis → events to browser
  Poll: GET /api/ai/executions/:id → usage_records read
  File-action apply pipeline (§11.4)
  Qualifying workspace_mutation apply → POST /api/ai/executions/:id/confirm-build-apply
  Preview iframe → GET /api/preview/:sessionId/proxy → Gateway → CM
```

Proven Builder provider path: adapter registry is CURRENT; locked LIVE-11 evidence used xAI / grok-4.5. `usage_records` store provider and model.

---

### 11.2 Safety Gates

| Gate | Env Flag | Default | Effect |
|------|----------|---------|--------|
| Execution kill-switch | `GLOBAL_EXECUTION_ENABLED` | `false` (opt-in) | When false, POST /api/ai/execute returns 503 before any logic runs |
| Harness tool loop | `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | When false, falls through to plain single-shot path |
| Write/delete tools | `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | When false, write_file/delete_file not registered |
| Validation tool | `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | When false, run_validation not registered |
| Browser smoke tool | `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | When false, browser_smoke not registered |
| Stripe charging | `BILLING_CHARGES_ENABLED` | `false` | When false, Stripe charging is blocked. **Credit-ledger deduction still runs.** |

`GLOBAL_EXECUTION_ENABLED=false` is a **runtime safety kill-switch**, not an architectural absence.
A disabled gate does not mean the architecture is absent.
A gated Harness does **not** mean Harness is the operational beta path.

---

### 11.3 Execution intent and credit deduction (CURRENT)

Do not use the pre-03D model in which every completed execution charged at finalize-accounting.

On **execute request**:

- Omitted `executionIntent` is stored as **`workspace_mutation`** (`DEFAULT_EXECUTION_INTENT`)
- Ask / conversation must send `executionIntent: 'conversation'` explicitly

Worker finalize-accounting (`triggerDeductionForExecution`) inspects the **persisted** intent:

| Persisted intent | Finalize-accounting result |
|------------------|----------------------------|
| `conversation` | Deduct immediately (`emitDeductionAttempt`) |
| missing / unknown (legacy / safe default on existing rows) | Deduct immediately |
| `workspace_mutation` | **Do not deduct** (`reason=build_awaiting_apply`) |
| non-completed | Skip |

Zero-token completed Ask still writes a 0-credit audit deduction attempt.

Those two defaulting rules are **not** the same:

- Request omit → stored as `workspace_mutation` (delayed Build path if apply later qualifies)
- Persisted missing/unknown on an existing completed row → immediate deduction (legacy / safe default)

#### When token usage becomes known

Worker completes the provider call and writes `usage_records` (`status=completed`, `tokensUsed`, provider/model, `aiExecutionResult` including `fileActions` and persisted `executionIntent`).

#### When credit deduction occurs for Build

Only after a **qualifying full-success workspace apply confirmation**.

`triggerBuildApplyDeduction` requires:

- usage record exists and `completed`
- persisted intent **exactly** `workspace_mutation`
- persisted `fileActions` non-empty
- confirmation structurally valid
- `applyStatus === 'applied'`
- `totalActions === fileActions.length`
- `successCount === totalActions` (partial apply does not charge)

Parser flag `workspaceMutationAttempted` is **not** accounting authority.

#### What confirm-build-apply does

Public (and internal) route asserts the apply result and may trigger the **same** deduction gateway used by Ask.

It does **not** re-run the model. It does **not** mutate the workspace.

Canonical public route:

```
POST /api/ai/executions/:executionId/confirm-build-apply
```

Owner: Gateway `AIExecutionController.confirmBuildApply` → `UsageLedgerService.triggerBuildApplyDeduction`.

#### Idempotency

`PersistentCreditDeductionGateway` unique `credit_deduction_records.source_event_id`.

**`sourceEventId` = `executionId`** (one deduction key per execution). Duplicate Ask finalize or duplicate Build confirm reuse the gateway path.

---

### 11.4 File-action apply pipeline (CURRENT)

Frontend-owned (`workspace-ai-file-actions.logic.ts` + workspace page):

1. Parse model `fileActions`
2. If batch is risky (count > 3, any delete, large content, or sensitive paths such as `.env*`, lockfiles, `package.json`, `docker-compose.yml`, `*.config.js/ts/...`) → await confirmation
3. Else **AUTO_APPLY** (including the golden-path one-file Build)
4. `acquireExecutionApplyGuard(executionId)` — apply-once
5. `applySequentialFileActions` — sequential writes/deletes through session file APIs → Gateway → CM `/workspace`
6. On applied: `confirmBuildApplyIfQualifying` for `workspace_mutation`
7. Coherence: refresh file tree, editor, preview; **create Git checkpoint**; refresh checkpoint list; optional project autosave

Conversation executions skip confirm-build-apply.

This is technical HOW for the current apply pipeline. It is not a product-copy promise.

---

### 11.5 Git checkpoint and revert (CURRENT)

| Piece | HOW |
|-------|-----|
| Git inside container | `GitService`; `git config --global --replace-all safe.directory /workspace` |
| Ledger | Gateway PostgreSQL `git_checkpoints`; CM notifies `POST /api/internal/git-checkpoints` |
| Public API | `POST/GET /api/sessions/:sessionId/checkpoints`, diff, `POST /api/sessions/:sessionId/revert` |
| `commitHash` | Git commit SHA stored on the ledger; UI labels by hash prefix |
| Revert | Implemented; restores workspace files; frontend refreshes tree/editor/preview/list |
| Automatic rollback | **NOT IMPLEMENTED** |
| Harness pre-apply checkpoint | CURRENT on the **gated** harness path only (`enablePreApplyCheckpoint`) |

---

### 11.6 Identifiers

| ID | Created | Role | Optional / future |
|----|---------|------|-------------------|
| `executionId` | Gateway on execute (uuid v4) | Queue job, usage_records, SSE channel, confirm URL, `sourceEventId` | Required CURRENT |
| `projectId` | Project APIs / open-project | Session `project_id`; not required on execute body | CURRENT project identity |
| `sessionId` | `POST /api/sessions` | Execute, files, preview, checkpoints, CM | Required CURRENT |
| `containerId` | CM Docker create | CM SQLite / Docker; not a Builder HTTP field | CURRENT runtime |
| `builderProfileId` | Optional execute body; harness `builder-default` if harness path | Job + usage metadata if provided | Optional CURRENT plumbing; **frontend does not send it** |
| `agentRole` | Optional execute body | Job + usage metadata if provided | Optional CURRENT plumbing; **frontend does not send it** |
| `collaborationRunId` | Optional; in-memory coordinator if called | Job metadata if provided | FUTURE product; optional CURRENT field |
| `referralTraceId` | Optional; in-memory coordinator if called | Job metadata if provided | FUTURE product; optional CURRENT field |

---

## 12. Agent Harness Architecture

**Classification: IMPLEMENTED_BUT_GATED.**

Current private beta does **not** enable Harness. Default `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`. Worker `useHarness` requires `harnessVersion==='v1'` **and** that loop flag.

Do not describe Harness as the current Builder execution default. Harness-as-default autonomous execution remains **FUTURE**.

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
| Pre-apply checkpoint gate | CURRENT (gated path) | `enablePreApplyCheckpoint=true`; created before first write mutation |
| Audit events (`InMemoryHarnessAuditRecorder`) | CURRENT | In-memory only; not persisted to DB |
| `search_workspace` | **NOT IMPLEMENTED** (schema only) | Registered in tool-registry.ts (`enabled: false`); no handler in ToolDispatcher |
| Automatic rollback after partial failure | **NOT IMPLEMENTED** | Pre-apply checkpoint exists on gated path; rollback is manual via checkpoint/revert |
| Semantic / vector search | NOT IMPLEMENTED (PLANNED) | `enableSemanticSearch=false` |
| Real-provider autonomous harness loop | UNPROVEN | All E2E canaries used test-harness-stub provider |

### 12.2 Harness Execution Path (GATED — not private-beta default)

```
Same entry as single-shot through Worker claim and prompt assembly.
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
9. Worker: publishes events, updates usage_records, calls finalize-accounting
   (same usage-finalization split as the plain path — not automatically a Build charge)
```

**Automatic rollback does NOT exist.**
A pre-apply checkpoint is created before the first mutation on the gated path. If a partial failure occurs,
rollback must be initiated manually through the existing checkpoint/revert path.

---

## 13. Platform Architecture

### 13.1 ainow.biz Platform Context

ainow.biz is the umbrella platform identity. aiSandBox is the Builder Agent module within it.

The original walking-character / town **simulation** is **not implemented**. CURRENT RPG-related architecture is the command-center **shell/layout** at `/[locale]/platform` only. Product positioning of that shell belongs to `PRD.md`.

| Component | Status |
|-----------|--------|
| ainow.biz platform identity and dashboard (`/[locale]/platform`) | CURRENT (shell) |
| aiSandBox = Builder Agent module (`/[locale]/app`) | CURRENT |
| Static TypeScript system-agent registry (`frontend/lib/agent-platform/agent-registry.ts`) | CURRENT (read-only) |
| DB-backed user-created agent records (`user_agents`, `POST/GET /api/agents`) | CURRENT (**persistence/API only**; not executable) |
| Platform RPG command-center shell | CURRENT (layout/shell; no game engine) |
| OrchestrationService | CURRENT precursor: **in-memory, instantiated, no HTTP, not product-reachable**. Can enqueue if called in-process. **Not** the future durable multi-Builder runtime. |
| Builder Agent AI execution (single-shot) | CURRENT |
| Optional execute identity fields (`agentRole`, `builderProfileId`, `collaborationRunId`, `referralTraceId`) | CURRENT plumbing; frontend does not send them |
| Non-Builder system agents (Chief of Staff, Product Strategy, Technology Advisor) | PLACEHOLDER — `status: 'coming_soon'`; **not executable** |
| User-created agents as executable runtime agents | **FUTURE** — NOT IMPLEMENTED |
| Referral / agent collaboration **product** runtime | **FUTURE** — not the 07C in-memory precursor |
| Durable orchestration / persisted referrals / shared-project writes | **FUTURE** |
| Knowledge base runtime | **FUTURE / PLANNED** |
| Work objects (tickets, decisions, referrals) | **FUTURE / PLANNED** |
| Multi-agent real-time collaboration | **FUTURE / PLANNED** |
| Semantic / vector retrieval | **FUTURE / PLANNED** |
| Harness as default Builder experience | **FUTURE** |
| Stripe charging | **FUTURE / deferred** |
| Google OAuth login activation | **FUTURE / deferred** |

### 13.2 Agent Registry and Create Agent

The system-agent registry is a static TypeScript declaration (`agent-registry.ts`).
It is read-only at runtime. Non-Builder agents are declared but not executable.

User-created agents:

- Entity `UserAgent` / table `user_agents`
- Migration exists in repo; locked staging evidence says it was applied
- APIs: `POST /api/agents`, `GET /api/agents`, `GET /api/agents/:id` (`SessionCookieGuard`)
- MVP UI exists
- **Not** routed to any execution runtime

Do not claim a live `user_agents` row count. Persistence capability ≠ execution capability.

### 13.3 What Is Not Current Platform Architecture

Do not describe the following as current:

- Knowledge ingestion runtime
- Vector database / semantic retrieval
- Real non-Builder agent execution
- Executable user-created agents
- Work-object runtime
- Chief-of-Staff, Product Strategy, or Technology Advisor agent execution
- Product-reachable multi-Builder / collaboration runtime
- Durable orchestration (the in-memory coordinator is a precursor only)
- Automatic Harness rollback
- Harness `search_workspace` handler
- Harness as private-beta default execution
- Stripe live charging
- Google OAuth as an available login
- Original RPG simulation / game engine
- gVisor sandboxing

---

## 14. Communication Mechanism Summary

The system uses mixed communication mechanisms. It is neither HTTP-only nor queue-only.

| From | To | Mechanism |
|------|----|-----------|
| Browser | Caddy (staging) | HTTPS |
| Caddy `/api/*` | API Gateway `:4000` | HTTP |
| Caddy app pages | Frontend `:3002` | HTTP |
| Browser | API Gateway | SSE (`GET /api/ai/executions/:id/stream`) |
| Browser iframe | API Gateway | HTTP preview proxy (WebSocket where preview streaming uses it) |
| Frontend (local-dev) | API Gateway | HTTP rewrite/fallback; named App Router routes may intercept first |
| API Gateway | BullMQ / Redis | BullMQ job enqueue (`ai-execution` queue) |
| API Gateway | container-manager | HTTP |
| API Gateway | PostgreSQL | TypeORM (pooled, direct) |
| API Gateway | Redis (Pub/Sub) | Subscribe to `ai-execution-stream:{id}` for SSE forwarding |
| AI Service Worker | Redis (BullMQ) | BullMQ Worker.process() — job consumption |
| AI Service Worker | Redis (Pub/Sub) | Publish execution events to `ai-execution-stream:{id}` |
| AI Service Worker | Provider API | HTTP (per adapter) |
| AI Service Worker | API Gateway | HTTP (`POST /api/internal/executions/:id/finalize-accounting`) |
| AI Service Worker (Harness, gated) | API Gateway | HTTP (ApiGatewayHttpClient — file tool calls) |
| Browser / Frontend | API Gateway | HTTP `POST /api/ai/executions/:id/confirm-build-apply` (staging via Caddy) |
| container-manager | Docker engine | Docker SDK + bind-mount `${workspacePath}:/workspace:rw` |
| container-manager | API Gateway | HTTP (session lifecycle + `POST /api/internal/git-checkpoints`) |

**Transport types in use:**
- **HTTP** — Browser↔Caddy↔API GW / Frontend, API GW↔CM, Worker↔API GW (Harness tools + finalize-accounting), Worker→Provider
- **BullMQ over Redis** — API GW→Worker (current Builder job submission and consumption)
- **Redis Pub/Sub** — Worker→Redis (publish), API GW→Redis (subscribe for SSE forwarding)
- **TypeORM / PostgreSQL** — API GW (application state), AI Worker (`usage_records`)
- **SQLite** — container-manager local/runtime state
- **WebSocket** — preview streaming only
- **Docker SDK** — CM↔Docker engine

Leftover AI Service `POST /api/execute` HTTP remains as a listen surface. It is **not** the current Builder execute transport.

---

## 15. Explicit Non-Goals

- No session-idle sweeper / cron / background reaper (idle is request-driven in container-manager)
- No clustering
- No distributed locks
- No HA
- No horizontal scaling
- No resurrection of terminated sessions
- No general-purpose event bus (Redis is used specifically for BullMQ queue transport and
  execution-stream Pub/Sub — not as a general event bus)
- No cron
- No platform schedulers for maintenance (the Worker stuck-execution watchdog is in-process execution recovery only)
- No Kubernetes
- No Kafka
- No event-sourcing architecture

All intentional for current scope.

The WorkerProcessor stuck-execution watchdog is **not** a contradiction of “no idle reaper.” It recovers stuck AI executions; it does not scan session idle.

---

## 16. Summary

CURRENT architecture is a **Builder-first**, mixed-transport platform: Caddy + PM2 (staging) or local host processes plus compose infrastructure (Postgres, Redis, local Prometheus/Grafana); Gateway enqueue; BullMQ Worker on **:4001**; container-manager Docker + bind-mounted `/workspace` + SQLite; delayed Build credit deduction after qualifying confirm-build-apply; session checkpoints under `/api/sessions/:id/...`; gated Harness off by default.

Not operational as product runtime: specialist agents, executable user-created agents, multi-Builder collaboration, durable orchestration, knowledge retrieval, Harness-as-default, Stripe charging, Google OAuth activation, gVisor, automatic rollback, `search_workspace`.

Trade-offs:

- No horizontal scaling
- No HA
- Single-node focus

These are accepted.

---

Document Status: Authoritative TECHNICAL HOW
Alignment: CLAUDE.md (OS) + PRD.md (WHAT; not reconciled here)
Layout: Root-Based Monorepo
Last reconciled: 2026-08-24 (GOV-ARCH-02 Step 3)
Prior freeze: 2026-08-10 (GOV-ARCH-01)
