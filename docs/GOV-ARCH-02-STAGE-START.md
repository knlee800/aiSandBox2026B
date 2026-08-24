# GOV-ARCH-02 Step 2 — Architecture Drift / Gap Inventory and Step 3 Edit Plan

**Task ID:** GOV-ARCH-02  
**Title:** Architecture Reconciliation  
**Step:** 2 — Architecture drift/gap inventory + Step 3 edit plan  
**Status:** COMPLETE — 2026-08-23  
**Nature:** GOVERNANCE / DOCUMENTATION ONLY — no `ARCHITECTURE.md` write in this step  
**Workstream:** GOVERNANCE (taxonomy only; not an admission weight)  
**Lifecycle:** 4-step GOVERNANCE  
**Evidence class:** GOVERNANCE  
**Tree observed:** branch `main`, HEAD `20a1c3972073962bbc928168dd8da70fc75cd910`, `git status --short` CLEAN before Step 2 writes  
**Source map (frozen):** `docs/GOV-ARCH-02-SOURCE-MAP.md`  
**Subject (untouched this step):** `ARCHITECTURE.md` last reconciled 2026-08-10 (GOV-ARCH-01)

This document is Step 2 evidence. It does not replace `ARCHITECTURE.md`. It does not update `PRD.md`. Step 3 may apply the bounded edit plan below to `ARCHITECTURE.md`.

Do not treat this file as a scheduler.  
Do not register GOV-PRD-02.  
Do not register the first genuine 2-source-lane pilot.  
Do not register or start PRIVATE-BETA-INVITE-01.

---

## 1. Step 2 purpose

Determine, from actual repository source plus locked evidence, what `ARCHITECTURE.md` should say as TECHNICAL HOW.

For every architecture area in the frozen source map, record:

- A. what `ARCHITECTURE.md` currently says
- B. what the repo currently implements
- C. what locked governance/checkpoint evidence says
- D. accuracy class
- E. exact Step 3 documentation action

Accuracy classes used:

| Class | Meaning |
|-------|---------|
| CORRECT_CURRENT | Matches implemented truth; keep |
| OUTDATED | Once true or believed true; now superseded by source |
| INCOMPLETE | Directionally true but missing material HOW |
| WRONG | Contradicts current source |
| CURRENT_BUT_NEEDS_CLARIFICATION | True if qualified; currently easy to misread |
| FUTURE_NOT_LABELLED | Approved future described as if current, or unlabeled |
| HISTORICAL_SHOULD_BE_REMOVED_OR_REFRAMED | Canary/process-scoped/historical fact frozen as canonical |

Authority rule preserved:

- `PRD.md` = PRODUCT WHAT (not edited)
- `ARCHITECTURE.md` = TECHNICAL HOW (not edited in Step 2)
- Implemented locked checkpoints outweigh older plans when describing CURRENT
- Approved unimplemented plans remain FUTURE
- Product ideas are deferred to GOV-PRD-02

---

## 2. Evidence / source set reviewed

Read-only. No servers, Docker, migrations, SSH, provider APIs, or database connections.

### 2.1 Authority / board

- `AGENTS.md`
- `CLAUDE.md` (OS rules; not HOW)
- `TASKS.md` CURRENT EXECUTION BOARD only (stop at LEGACY / FROZEN)
- `TASKS_BACKLOG_FULL.md` GOV-ARCH-02 body
- `docs/GOV-ARCH-02-SOURCE-MAP.md`
- `ARCHITECTURE.md` (full)

`PRD.md` was not required for F-item resolution. Product-WHAT items are deferred (§14).

### 2.2 Implementation / config (primary HOW evidence)

- `docker-compose.yml` — local infra only (Postgres, Redis, Prometheus, Grafana)
- `docker-compose.prod.yml` — design/production compose including app services; **not** current staging topology
- `services/ai-service/src/main.ts`, `.env.example`
- `services/api-gateway/src/clients/ai-service-http.client.ts`
- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/internal-accounting.controller.ts`
- `services/api-gateway/src/usage-ledger/usage-ledger.service.ts`
- `services/api-gateway/src/orchestration/*`
- `services/api-gateway/src/user-agent/*`, `src/entities/user-agent.entity.ts`, `src/migrations/1772500000000-CreateUserAgentsTable.ts`
- `services/api-gateway/src/auth/*`, `src/startup/production-guardrails.validator.ts`, `src/admin/charge-readiness.service.ts`
- `services/api-gateway/src/payments/providers/stripe-payment.provider.ts`
- `services/api-gateway/src/checkpoints/checkpoints.controller.ts`
- `services/api-gateway/src/git-checkpoints/*`
- `services/api-gateway/src/health/health.controller.ts`
- `services/container-manager/src/config/governance.config.ts`, `.env.example`
- `services/container-manager/src/sessions/sessions.service.ts`
- `services/container-manager/src/preview/preview-strategy.resolver.ts`
- `services/container-manager/src/git/git.service.ts`
- `services/container-manager/src/docker/docker-runtime.service.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- `services/ai-service/src/agent-harness/config/agent-harness.config.ts`
- `frontend/next.config.js`
- `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts`
- `frontend/lib/build-apply-confirm-proxy.server.ts`
- `frontend/components/workspace/workspace-ai-file-actions.logic.ts`
- `frontend/app/[locale]/app/page.tsx` (file-action apply / confirm path)
- `frontend/package.json` (`next dev -p 3002`)
- `monitoring/prometheus/prometheus.yml`
- `frontend/lib/auth-module/auth-module-generator.ts`

### 2.3 Locked evidence used as CURRENT/FUTURE classifiers

- GOV-ARCH-01 checkpoint (baseline HOW freeze 2026-08-10)
- GOV-OS-01 checkpoint (pending mandate for this task)
- PRIVATE-BETA-GO-NO-GO-01 GO (beta operational constraint; not product copy)
- PRIVATE-BETA-E2E-LIVE-11 PASS
- 03D / 03D-A / 03D-B, 03H, 03I, 03J, 03K, 03L
- PREVIEW-STRATEGY-01A
- AGENT-PLATFORM-06, 07A–07C, CREATE-01A/01B
- AUTH-MODULE / AUTH-APP; Google OAuth 04B Outcome B
- BILLING-READY-05A StripePaymentProvider (no SDK)
- STAGING-04D PM2 port commands; STAGING-04E `user_agents` migration applied
- STAGING-04I2B / 03J Caddy `/api/*` → Gateway `:4000`

Git observed at Step 2 start:

```
branch = main
HEAD   = 20a1c3972073962bbc928168dd8da70fc75cd910
status = CLEAN
```

---

## 3. Resolved F-items

### F1 — AI service listen port

```
AI_SERVICE_CURRENT_PORT=4001
```

| Layer | Port | Evidence |
|-------|------|----------|
| Local / default listen | **4001** | `services/ai-service/src/main.ts`: `process.env.PORT \|\| 4001`; `.env.example` `PORT=4001` |
| Container / internal (prod compose) | **4001** | `docker-compose.prod.yml` `PORT: 4001`; Prometheus scrape `ai-service:4001`; no host publish of AI HTTP |
| Staging bound (PM2) | **4001** | `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` `PORT=4001 pm2 start ... ai-service` |
| Gateway leftover HTTP client default | **4001** | `AI_SERVICE_URL \|\| 'http://localhost:4001'` — **not** the current Builder execute path |
| Historical canary override | **4099** | AGENT-HARNESS-06D/06E/07F process-scoped `PORT=4099` to avoid conflict; copied into GOV-ARCH-01 / `ARCHITECTURE.md` |

Do not collapse layers: they currently agree on **4001**. **4099 is not a distinct network layer of the current platform.** It is a historical canary override that GOV-ARCH-01 froze as canonical.

Current Builder execute path does **not** HTTP-call AI Service. Gateway enqueues BullMQ; WorkerProcessor claims jobs. AI Service still *listens* HTTP for health/metrics/legacy `POST /api/execute`.

`ARCHITECTURE.md` §1/§3 port **4099** = **WRONG** (HISTORICAL_SHOULD_BE_REMOVED_OR_REFRAMED).

### F2 — Session / container idle timeout

| Fact | Value |
|------|--------|
| Duration (default) | **1800000 ms = 30 minutes** |
| Config key | `SESSION_IDLE_TIMEOUT_MS` (container-manager) |
| Configurable? | **YES** — env parsed in `GovernanceConfig`; default if unset |
| Enforcement owner | **container-manager `SessionsService`** |
| Mechanism | **Request-driven** in-memory `lastActivity` Map; **no sweeper, no cron, no setInterval** |
| Staging effective value (03K locked) | Default 1800000 because PM2 env did **not** set the key |
| Gateway role | Receives `POST /api/internal/sessions/:id/stop` `{reason: idle_timeout}` and writes PostgreSQL `terminated_at` / `termination_reason` |
| Preview path | Does **not** participate in idle check (preview bypasses `SessionsService`) |
| Active AI execution | Does **not** suppress idle timeout (03K) |

`ARCHITECTURE.md` §5 “Idle timeout (in-memory)” at **Application-Level** = **INCOMPLETE / CURRENT_BUT_NEEDS_CLARIFICATION**. The in-memory part is true **inside container-manager**, not API Gateway application governance. Duration and env are missing. No background cleanup worker exists for idle (consistent with §15 “No background cleanup workers” **if** that sentence is kept scoped to Gateway/AI maintenance — CM is request-driven, not a sweeper).

### F3 — `user_agents` persistence / migration state

```
USER_AGENTS_SCHEMA_IMPLEMENTED=YES
USER_AGENTS_MIGRATION_EXISTS=YES
LATEST_LOCKED_EVIDENCE_SAYS_MIGRATION_APPLIED_TO_STAGING=YES
```

| Question | Answer | Evidence |
|----------|--------|----------|
| Entity / table in repo | YES | `UserAgent` `@Entity('user_agents')` |
| Migration file | YES | `services/api-gateway/src/migrations/1772500000000-CreateUserAgentsTable.ts` |
| APIs | YES | `POST /api/agents`, `GET /api/agents`, `GET /api/agents/:id` (`SessionCookieGuard`) |
| Executable runtime | NO | Persistence + MVP UI only |
| CREATE-01A “migration not executed” | SUPERSEDED | Historical at 2026-07-20 |
| Staging applied (locked) | YES | 04E checkpoint: `Migration CreateUserAgentsTable1772500000000 has been executed successfully.` + `user_agents` listed |
| Live DB contents **right now** | UNKNOWN | Step 2 did not connect to Postgres; architecture is the **repository/migration** fact plus locked 04E evidence |

### F4 — `confirm-build-apply` public route

| Fact | Value |
|------|--------|
| Public canonical route | `POST /api/ai/executions/:executionId/confirm-build-apply` |
| Owning service | API Gateway `AIExecutionController.confirmBuildApply` → `UsageLedgerService.triggerBuildApplyDeduction` |
| Auth | `SessionOrApiKeyAuthGuard`; ownership = same not-found convention as `getExecution` |
| Internal route retained | `POST /api/internal/executions/:executionId/confirm-build-apply` (`InternalServiceAuthGuard`) |
| Next.js App Router proxy exists | YES — `frontend/app/api/ai/executions/[executionId]/confirm-build-apply/route.ts` |
| Next.js fallback rewrite | `next.config.js` `fallback` `/api/:path*` → Gateway. **Named App Router route wins over fallback.** |
| Staging public path | Caddy `handle /api/*` → Gateway `:4000`. Browser never hits Next.js for this URL. |
| Proxy status | **Retained; not on the staging public path.** Locally, Next.js can still intercept the same URL before fallback. Classify as **legacy/retained dual-path**, not deleted. |

Current staging/public request flow:

```
Browser fetch POST /api/ai/executions/:executionId/confirm-build-apply
  → Caddy /api/* 
  → API Gateway :4000 public authenticated route
  → UsageLedgerService.triggerBuildApplyDeduction
  → PersistentCreditDeductionGateway (sourceEventId = executionId)
```

Current local-dev possible flow (no Caddy):

```
Browser fetch same relative URL
  → Next.js App Router handler (not rewrite fallback)
  → proxyConfirmBuildApply
  → Gateway INTERNAL confirm-build-apply (X-Internal-Service-Key)
```

03J Architecture B remains CURRENT for public/staging HOW.

### F5 — Orchestration coordinator reachability

**Classification:** `IN_MEMORY_IMPLEMENTED_BUT_NOT_PRODUCT_REACHABLE`

| Question | Answer |
|----------|--------|
| Files / classes | `OrchestrationModule`, `OrchestrationService`, `orchestration.contracts.ts`, `InMemoryOrchestrationAuditRecorder`, `ExecutionResultService` wiring |
| Instantiated? | YES — `AppModule` imports `OrchestrationModule`; Nest instantiates the provider at Gateway boot |
| Public HTTP path? | NO — no orchestration controller |
| Internal HTTP path? | NO |
| Other production injectors? | NO — only tests import `OrchestrationService` |
| Persists state? | NO — in-memory stores (`collaborationRunStore`, `referralStore`, `idempotencyStore`, `referralExecutionMap`) |
| Can enqueue if called in-process? | YES — `startReferralExecution()` can call `QueueService.enqueueExecution()` |
| Product-reachable multi-Builder? | NO |
| Infrastructure-only? | YES — boot-resident skeleton + canary-tested internals |

Differs from FUTURE PLATFORM-05/07: those plans are durable orchestration, product collaboration runtime, persisted referrals, and shared-project writes. 07C is a **precursor in-memory coordinator**, not that runtime.

`ARCHITECTURE.md` “skeleton, in-memory; no persistence” = **CORRECT_CURRENT but INCOMPLETE** (does not say: instantiated, no HTTP surface, enqueue-capable if called, not product-reachable).

---

## 4. Actual current topology

CURRENT deployed/private-beta topology is **host processes + Caddy**, not `docker-compose.yml` app services.

### 4.1 Logical services

| Component | Responsibility | Inbound | Outbound | Protocol | Persistence | Environment |
|-----------|----------------|---------|----------|----------|-------------|-------------|
| Frontend / Next.js | Locale UI; Builder `/[locale]/app`; platform `/[locale]/platform`; iframe preview; file-action apply | Browser HTTPS | Relative `/api/*` | HTTP, SSE, WS (preview iframe) | None (cookies only) | Staging PM2 `:3002`; local `next dev -p 3002`. **Not** in `docker-compose.yml`. Grafana compose uses `:3000` (local infra only). |
| Caddy | TLS terminator; public routing | Browser | Next.js `:3002`; Gateway `:4000` | HTTPS → HTTP | None | **Staging/current public.** `/api/*` → Gateway `:4000`. App pages → Next. No Caddyfile in repo. |
| API Gateway NestJS `:4000` | Auth, sessions, projects, execute enqueue, SSE, credits, checkpoint ledger, agents CRUD, preview proxy, internal APIs | Browser via Caddy; CM; AI Worker | Redis, Postgres, CM `:4002` | HTTP, SSE, WS preview, BullMQ enqueue, TypeORM | PostgreSQL owner | Staging PM2; local host. Prod compose file exists but is not current staging. |
| AI Service / WorkerProcessor default `:4001` | BullMQ worker; provider adapters; harness (gated); usage_records update; finalize-accounting HTTP | Redis queue | Provider HTTPS; Redis Pub/Sub; Gateway internal HTTP; Postgres `usage_records` | BullMQ, HTTP, Pub/Sub | `usage_records` only | Staging PM2 `:4001`; not in local compose |
| Container Manager `:4002` | Docker containers, files, Git, preview, idle/lifetime/concurrency | Gateway HTTP | Docker engine; Gateway internal session/git | HTTP, Docker SDK | **Local SQLite** (sessions/containers/git) + Docker FS. **No PostgreSQL.** | Staging PM2; local host |
| PostgreSQL `:5432` | Sole **application** durable DB | Gateway; AI worker (`usage_records`) | — | TypeORM | Durable | Local compose + staging host |
| Redis `:6379` | `ai-execution` queue + `ai-execution-stream:{id}` | Gateway; Worker | — | BullMQ / Pub/Sub | Ephemeral transport | Local compose + staging host |
| Prometheus `:9090` | Scrape AI `/metrics` | Compose network | `ai-service:4001` | HTTP | Local compose volume | **Local compose.** Staging scrape of that hostname is compose-oriented, not proven as current staging monitor. |
| Grafana `:3000` | Dashboards | Browser (local) | Prometheus | HTTP | Local compose | **Local compose only.** Port collides with typical Next `:3000`; frontend therefore uses `:3002`. |
| Provider APIs | Model inference | AI Worker adapters | Anthropic/OpenAI/Groq/xAI/DeepSeek/stub | HTTPS | None | Proven Builder path: xAI / grok-4.5 (LIVE-11). Adapter registry is CURRENT. |
| Watchdog | Stuck-execution recovery inside WorkerProcessor | Internal timer in worker job | usage_records / metrics | In-process | None | CURRENT for **execution** stuck recovery, not session idle |

`ARCHITECTURE.md` logical diagram is **INCOMPLETE** (missing Caddy, compose vs PM2 split, frontend `:3002`, CM SQLite, monitoring) and **WRONG** on AI port 4099.

### 4.2 Compose vs process ownership

| File | What it runs | Status vs ARCHITECTURE.md |
|------|----------------|---------------------------|
| `docker-compose.yml` | Postgres, Redis, Prometheus, Grafana **only** | INCOMPLETE — doc implies services without this split |
| `docker-compose.prod.yml` | Infra **plus** gateway/ai/cm/frontend images | FUTURE / alternate deploy design; **not** current staging HOW |
| Staging PM2 | `api-gateway:4000`, `ai-service:4001`, `container-manager:4002`, `frontend:3002` | Missing from ARCHITECTURE.md |
| Staging Caddy | Public `/api/*` → Gateway | Missing |

---

## 5. Builder execution flow (CURRENT — single-shot)

Do **not** describe Harness as the beta-default path.

```
User Build/Ask in /[locale]/app
  → Frontend POST /api/ai/execute
       { sessionId, conversationId, prompt, executionIntent?, provider?, model?,
         workspaceContext?, agentRole?, builderProfileId?, collaborationRunId?, referralTraceId? }
  → Caddy /api/* (staging) or Next rewrite/fallback (local, except named App Router routes)
  → Gateway guards: session cookie / CSRF / GLOBAL_EXECUTION_ENABLED / CreditBalanceGuard /
       session ownership / idempotency (requestId)
  → executionId = uuid v4 (or reuse timeout/failed row)
  → INSERT usage_records pending + metadata (intent, optional identity fields)
  → BullMQ enqueue ai-execution
  → 202 { executionId, status: 'queued' }

  → WorkerProcessor claims job
  → useHarness = (harnessVersion==='v1' AND DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop)
       CURRENT beta: false → plain AIExecutionService → adapter → provider
  → parse file-actions; publish Redis Pub/Sub; UPDATE usage_records completed
  → POST /api/internal/executions/:id/finalize-accounting
       conversation / missing / unknown intent → deduct now
       workspace_mutation → skip (build_awaiting_apply)

  → Frontend SSE GET /api/ai/executions/:id/stream and/or poll GET /api/ai/executions/:id
  → File-action pipeline (frontend):
       parse → risky-batch? await confirm : AUTO_APPLY
       acquireExecutionApplyGuard (apply-once)
       applySequentialFileActions → CM files/write via Gateway
       post-apply coherence: file tree, editor, preview, checkpoint
       if qualifying workspace_mutation apply:
         POST /api/ai/executions/:id/confirm-build-apply
  → Gateway triggerBuildApplyDeduction (idempotent sourceEventId=executionId)
  → credit_balances.balance authoritative; UI reads billing API (03H)
  → Preview iframe GET /api/preview/:sessionId/proxy → Gateway → CM :4002
       static HTML requires index.html at /workspace or immediate subdirectory
```

### Identifier creation / propagation

| ID | Created | Propagated | Optional / future |
|----|---------|------------|-------------------|
| `executionId` | Gateway on execute (uuid v4) | Queue job, usage_records, SSE channel, confirm URL, `sourceEventId` | Required CURRENT |
| `projectId` | Project APIs / open-project | Session `project_id`; not required on execute body | CURRENT project identity |
| `sessionId` | `POST /api/sessions` | Execute, files, preview, checkpoints, CM | Required CURRENT |
| `containerId` | CM Docker create | CM SQLite / Docker; not a Builder HTTP field | CURRENT runtime |
| `builderProfileId` | Optional execute body; harness `builder-default` if harness path | Job + usage metadata if provided | **Optional CURRENT plumbing; frontend does not send it** |
| `agentRole` | Optional execute body | Job + usage metadata if provided | **Optional CURRENT plumbing; frontend does not send it** |
| `collaborationRunId` | Optional; 07C in-memory if coordinator called | Job metadata if provided | **FUTURE product; optional CURRENT field** |
| `referralTraceId` | Optional; 07C if coordinator called | Job metadata if provided | **FUTURE product; optional CURRENT field** |

Omitted `executionIntent` defaults to **`workspace_mutation`** (`DEFAULT_EXECUTION_INTENT`). Ask/conversation must send `conversation` explicitly.

---

## 6. Credit architecture (replacement semantics for Step 3)

`ARCHITECTURE.md` §11 step 12 (“Worker finalize-accounting → credit deduction”) is **OUTDATED** for Build. Worker **still** calls finalize-accounting; that call is no longer the Build charge point.

### 6.1 When token usage becomes known

Worker completes provider call, writes `usage_records` (`status=completed`, `tokensUsed`, model/provider, `aiExecutionResult` including `fileActions` and persisted `executionIntent`).

### 6.2 Whether final accounting directly charges

`POST /api/internal/executions/:id/finalize-accounting` → `triggerDeductionForExecution`:

| Persisted intent | Result |
|------------------|--------|
| `conversation` | Deduct immediately (`emitDeductionAttempt`) |
| missing / unknown (legacy / safe default) | Deduct immediately |
| `workspace_mutation` | **Do not deduct** (`reason=build_awaiting_apply`) |
| non-completed | Skip |

Zero-token completed Ask still writes a 0-credit audit deduction attempt.

### 6.3 When credit deduction occurs for Build

Only after a **qualifying full-success workspace apply confirmation**:

`triggerBuildApplyDeduction` requires:

- usage record exists and `completed`
- persisted intent **exactly** `workspace_mutation`
- persisted `fileActions` non-empty
- confirmation structurally valid
- `applyStatus === 'applied'`
- `totalActions === fileActions.length`
- `successCount === totalActions` (partial apply does not charge)

Parser flag `workspaceMutationAttempted` is **not** accounting authority.

### 6.4 What confirm-build-apply does

Public (and internal) route asserts apply result and may trigger the **same** deduction gateway used by Ask. It does not re-run the model. It does not mutate workspace.

### 6.5 Idempotency

`PersistentCreditDeductionGateway` unique `credit_deduction_records.source_event_id`.

**`sourceEventId` = `executionId`** (one deduction key per execution). Duplicate Ask finalize or duplicate Build confirm reuse the gateway path.

### 6.6 Stripe vs credits

| Mechanism | CURRENT |
|-----------|---------|
| Credit ledger | CURRENT — `credit_balances.balance` authoritative (03H) |
| Token→credit | CURRENT — `model_tokens` 1 credit = 1 token |
| Stripe charging | **NOT CURRENT** — `BILLING_CHARGES_ENABLED` default/false; ChargeReadinessService kill-switch; StripePaymentProvider **no Stripe SDK**, no live charge |
| Webhook controller | Scaffold exists; `from 'stripe'` forbidden in those modules |
| Checkout | Blocked when charges disabled |

`BILLING_CHARGES_ENABLED` is a **Stripe/charge safety gate**, not the Builder credit-ledger deduction switch. LIVE-11 deducted credits with `BILLING_CHARGES_ENABLED=false`.

---

## 7. Checkpoint / file-mutation architecture

### 7.1 File actions / AUTO_APPLY (CURRENT)

Frontend-owned apply pipeline (`workspace-ai-file-actions.logic.ts` + `app/[locale]/app/page.tsx`):

1. Parse model `fileActions`
2. If batch risky (count > 3, any delete, large content, sensitive paths: `.env*`, lockfiles, `package.json`, `docker-compose.yml`, `*.config.js/ts/...`) → `awaiting-confirmation`
3. Else **AUTO_APPLY** (golden-path one-file Build)
4. `acquireExecutionApplyGuard(executionId)` — apply-once
5. `applySequentialFileActions` — sequential writes/deletes through session file APIs → Gateway → CM `/workspace`
6. On applied: `confirmBuildApplyIfQualifying` for workspace_mutation
7. Coherence: refresh tree, editor, preview, **create checkpoint**, refresh checkpoint list, optional project autosave

Conversation executions skip confirm-build-apply.

### 7.2 Git checkpoints (CURRENT)

| Piece | HOW |
|-------|-----|
| Git inside container | `GitService`; `git config --global --replace-all safe.directory /workspace` (not `*`) |
| Why safe.directory | Git 2.52 rejects root-owned git vs uid-1000 bind-mount `/workspace` (03I) |
| Ledger | Gateway PostgreSQL `git_checkpoints`; CM notifies `POST /api/internal/git-checkpoints` |
| Public API (actual) | `POST/GET /api/sessions/:id/checkpoints`, diff, `POST /api/sessions/:id/revert` |
| Public API listed in ARCHITECTURE.md | `GET /api/git-checkpoints`, `POST /api/git-checkpoints/revert` — **WRONG** |
| `commitHash` | Git commit SHA stored on ledger; UI labels by hash prefix |
| Revert | Implemented; restores workspace files; frontend refreshes tree/editor/preview/list |
| Automatic rollback | **NOT IMPLEMENTED** |
| Harness pre-apply checkpoint | CURRENT gated harness path only (`enablePreApplyCheckpoint`) |

### 7.3 Host mounts

`ARCHITECTURE.md` §9 “No host mounts” is **WRONG**.

`DockerRuntimeService` binds `${workspacePath}:/workspace:rw`. Only `/workspace` is writable **inside** the container; the host directory **is** mounted. That bind-mount is the 03I `safe.directory` cause.

---

## 8. Preview architecture

CURRENT is more than a proxy.

| Piece | HOW |
|-------|-----|
| Resolver | `PreviewStrategyResolver` in container-manager |
| Detection order | optional start command → `package.json` scripts/framework → `/workspace/index.html` → immediate subdirectory `/workspace/*/index.html` → else unknown |
| Static HTML contract | **`index.html` required** at workspace root **or** one immediate subdirectory. Other HTML without `index.html` → unknown / missing-index diagnostic |
| Root vs subdir | Root `index.html` preferred over subdirectory |
| Serving | `direct-read` for static HTML (not a long-running static server for that strategy) |
| Proxy | Browser iframe `src=/api/preview/:sessionId/proxy?refresh=` → Gateway `PreviewController` → CM `:4002` |
| Governance in preview channel | None (idle not checked on preview) |
| LIVE-08 `e2e-auto.html` | Historical FAIL. Product HOW is `index.html`. 03L aligned the runner fixture; did not change product Preview |

`ARCHITECTURE.md` §6 proxy-only = **INCOMPLETE**.

Node-dev-server / framework preview via `package.json` is implemented in the resolver (CURRENT capability). Private-beta proven path is **static `index.html`**.

---

## 9. Current vs future agent-platform architecture

### 9.1 CURRENT (source-proven)

- Static TypeScript system-agent registry `frontend/lib/agent-platform/agent-registry.ts` (read-only)
- Platform dashboard / RPG command-center **shell** at `/[locale]/platform`; Builder at `/[locale]/app`
- Non-Builder system agents: `coming_soon` placeholders — **not executable**
- User-created agents: PostgreSQL `user_agents` + `POST/GET /api/agents` + MVP UI — **not an execution runtime**
- Optional identity fields on execute → job → usage metadata (AGENT-PLATFORM-06)
- Per-builder harness config adapter + `builder-default` (used only if harness path selected)
- In-memory `OrchestrationService` instantiated, **not product-reachable**
- Single-shot Builder is the operational AI path

### 9.2 FUTURE (approved plans; not operational)

- Functional specialist agents (Chief of Staff, Product Strategy, Technology Advisor)
- Multi-Builder concurrent runtime / shared-project collaboration (PLATFORM-04/05)
- Durable orchestration, persisted referrals, product collaboration/work objects (PLATFORM-07 plan, COLLAB-00)
- Knowledge ingestion / vector / semantic retrieval (KNOWLEDGE-00)
- Approval workflows as product runtime
- Broader tool execution / Harness as default Builder experience
- User-created agents as executable agents

Do not blur. 07C in-memory safety limits are a **precursor**, not collaboration product runtime.

---

## 10. Harness architecture

| Capability | Classification |
|------------|----------------|
| Tool registry + dispatcher | IMPLEMENTED_BUT_GATED (loop off by default) |
| `read_file` / `list_files` | IMPLEMENTED (canary-proven) |
| `write_file` / `delete_file` | IMPLEMENTED_BUT_GATED (`AGENT_HARNESS_ENABLE_WRITE_TOOLS`) |
| `run_validation` / `browser_smoke` | IMPLEMENTED_BUT_GATED |
| Multi-turn loop `executeAgentHarnessLoop` (max 3) | IMPLEMENTED_BUT_GATED (`AGENT_HARNESS_ENABLE_TOOL_LOOP`, default false) |
| `useHarness` worker gate | `harnessVersion==='v1' AND DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop` |
| `search_workspace` | NOT_IMPLEMENTED (schema only, `enabled: false`, no dispatcher handler) |
| Automatic rollback | NOT_IMPLEMENTED |
| Semantic search | NOT_IMPLEMENTED / FUTURE_TARGET |
| Real-provider autonomous loop | UNPROVEN (canaries used stub) |
| Enabled for current private beta | **NO** — GO/NO-GO Harness OUT OF SCOPE; gates default false |

`ARCHITECTURE.md` §12 table is largely **CORRECT_CURRENT**. Step 3 should add the beta constraint: gated ≠ operational beta path.

---

## 11. Auth / billing architecture

### 11.1 Auth (CURRENT HOW only)

- Email/password `POST /api/auth/register`, `POST /api/auth/login`
- Email verification token consume + resend
- Password reset request/confirm
- Session cookie `aisandbox_session` + CSRF `aisandbox_csrf`
- API keys via `SessionOrApiKeyAuthGuard` on execute/confirm
- Ownership: session/project/execution/agent rows scoped to `userId`; cross-user reads return not-found
- Google/Apple OAuth **routes exist**; if Passport strategy not registered, redirect `oauth_failed`. Google OAuth **not activated** (04B Outcome B; GO/NO-GO out of scope)
- Generated-app auth templates **forbid** `aisandbox_session`, `aisandbox_csrf`, `aisandbox_oauth_state`, `X-Internal-Service-Key`, platform guards

### 11.2 Billing (CURRENT HOW only)

- Persistent credit ledger + grants + deduction records
- Authoritative balance = `credit_balances.balance`
- Builder/Ask deduction per §6
- `BILLING_CHARGES_ENABLED` explicit in production startup; default false means **no Stripe charges**
- StripePaymentProvider: disabled/stub/test/live modes; **no Stripe SDK; no live charging**
- Checkout/webhook scaffolding exists; cannot charge while gate is false
- Do not document Stripe as a current payment path

---

## 12. Complete drift / gap table

| Subsystem | ARCHITECTURE.md now | Actual implemented | Locked evidence | Accuracy | Step 3 action |
|-----------|---------------------|--------------------|-----------------|----------|---------------|
| Builder single-shot | §11.1 mostly | Same through step 11; Build charge delayed | 03D, LIVE-11 | OUTDATED on charge point | UPDATE §11 |
| Harness | §12 gated table | Matches; beta disabled | GO/NO-GO | CORRECT_CURRENT + clarify beta | RELABEL/UPDATE note |
| Agent registry | §13.2 | Static TS registry | PLATFORM-01 | CORRECT_CURRENT | KEEP + minor API note |
| Create Agent | Table only | Entity, migration, `/api/agents` | CREATE-01A/B, 04E | INCOMPLETE | ADD APIs; migration CURRENT |
| Multi-Builder | Not claimed operational | Identity types only | PLATFORM-04/05 | CORRECT as non-current | RELABEL FUTURE |
| Coordinator | “skeleton” | In-memory, instantiated, no HTTP | 07A–07C | INCOMPLETE | UPDATE CURRENT vs FUTURE |
| Knowledge | PLANNED | No runtime (credit categories exist as unused enums) | KNOWLEDGE-00 | CORRECT_CURRENT as PLANNED | KEEP FUTURE |
| Collaboration | SKELETON/PLANNED | 07C precursor only | COLLAB-00, 07C | CURRENT_BUT_NEEDS_CLARIFICATION | SPLIT precursor vs product |
| Preview | Proxy only | Resolver + `index.html` contract + iframe | PREVIEW-STRATEGY-01A, 03L, LIVE-11 | INCOMPLETE | ADD strategy |
| File actions / checkpoints | Thin frontend apply | AUTO_APPLY, risky confirm, apply-once, sequential write, confirm-build-apply, Git+ledger, revert, no auto-rollback | AI-03, 03I, 03J | INCOMPLETE | ADD pipeline + Git HOW |
| Credits | Immediate finalize | Intent-gated delayed Build | 03D, 03H, LIVE-11 | OUTDATED | REWRITE §11 accounting |
| Auth | Cookie/CSRF mention | Full module + isolation + OAuth deferred | AUTH-*, 04B | INCOMPLETE | ADD boundary |
| Billing / Stripe | Tables; no gate | Ledger CURRENT; Stripe NOT charging | BILLING-READY-05A/08, LIVE-11 | INCOMPLETE | ADD `BILLING_CHARGES_ENABLED` |
| Runtime containers | Docker + “no host mounts” | Docker + **bind-mount** `/workspace` + CM SQLite | 03I, docker-runtime | WRONG on mounts; INCOMPLETE on SQLite | UPDATE §3/§9 |
| Gateway | Port 4000 | Correct; missing public routes | 03J | INCOMPLETE APIs | UPDATE §8 |
| AI service | Port 4099; charge trigger | Port **4001**; BullMQ worker; leftover HTTP `/api/execute` | main.ts, 04D, F1 | WRONG port; OUTDATED charge | UPDATE §1/§3/§11 |
| Monitoring | Absent | Health/ready/metrics; compose Prometheus/Grafana; worker stuck watchdog; no idle sweeper | compose, health controllers, worker | INCOMPLETE | ADD short CURRENT monitoring |
| RPG shell | “static foundation” | Command-center shell; no game engine | RPG-03A/03B | CURRENT_BUT_NEEDS_CLARIFICATION | KEEP shell; do not restore simulation |
| Staging routing | Logical only | Caddy `/api/*` → GW; PM2 apps | 03J, 04D, 04I2B | INCOMPLETE | ADD deployment topology CURRENT vs compose |
| Identity fields | Absent | Optional on execute/job/usage | PLATFORM-06 | INCOMPLETE | ADD optional CURRENT |
| Intent split | Absent | `conversation` vs `workspace_mutation` | 03D-A | INCOMPLETE | ADD |
| Idle timeout | “in-memory” app layer | CM 30 min request-driven | 03K, governance.config | INCOMPLETE | UPDATE §5 |
| Public git APIs | `/api/git-checkpoints` | `/api/sessions/:id/checkpoints*` | checkpoints.controller | WRONG | UPDATE §8 |
| gVisor | PLANNED | Unimplemented | §9 | CORRECT FUTURE | KEEP |
| Invitations | Absent (correct) | Not architecture | GO/NO-GO | KEEP excluded | Do not add |

GOV-ARCH-01 residuals:

| Residual | Resolution |
|----------|------------|
| CM PostgreSQL access | **No Postgres.** Local **SQLite** for CM session/container/git. Gateway owns app Postgres. |
| AI HTTP beyond health | **Exists:** `POST /api/execute`, messages/conversations leftovers, `/metrics`, `/api/health`, internal queue. **Not** the current Builder path (BullMQ). |
| Exact staging host specs | Stay **out** of ARCHITECTURE.md (logical HOW only). |

---

## 13. Supersession table

| # | Older statement | Newer authoritative truth | Why superseded | Step 3 treatment |
|---|-----------------|---------------------------|----------------|------------------|
| 1 | Original RPG walking-character / town simulation | Command-center RPG-identified shell; no game engine | RPG-MVP-RESET + RPG-03A/03B implemented shell only | RELABEL_HISTORICAL for simulation; KEEP shell as CURRENT |
| 2 | ainow.biz is a general multi-agent work platform now | Builder-first; other agents placeholders | GO/NO-GO 2026-08-23 | REWRITE CURRENT; FUTURE labeled |
| 3 | Harness default understand→plan→edit→test | Single-shot is beta path; Harness gated | §12 + GO/NO-GO | RELABEL_FUTURE / KEEP gated table |
| 4 | Pre-03D deduct at AI completion | Build deducts after qualifying apply; Ask immediate | 03D Architecture A | REWRITE |
| 5 | 03D-B Next.js confirm proxy is the public path | Public Gateway route; Caddy `/api/*` → GW; proxy retained off public path | 03J Architecture B | REWRITE public path; RELABEL proxy retained |
| 6 | Worker finalize-accounting is the Build charge point | Finalize records usage; Build trigger is confirm-build-apply | 03D intent gate | REWRITE split |
| 7 | Production HTTP-only communication | Mixed HTTP/BullMQ/Pub/Sub/WS | GOV-ARCH-01 | KEEP mixed transport; production doc remains superseded |
| 8 | AI Service port 4099 vs production-doc 4001 | Canonical listen **4001**; 4099 was canary override | F1 source | REMOVE 4099 as canonical; REWRITE 4001 |
| 9 | External monitoring “no workers / no event bus” | BullMQ worker + Redis Pub/Sub exist; no cron | GOV-ARCH-01 | RELABEL_HISTORICAL constraint sentence |
| 10 | BILLING-READY-01A “no credit ledger” | Persistent ledger exists | BILLING-READY-03..08 | RELABEL_HISTORICAL |
| 11 | KNOWLEDGE/COLLAB headers “ACTIVE planning” | Plans locked FUTURE; runtimes not built | Their checkpoints 2026-07-06 | RELABEL_FUTURE |
| 12 | HARNESS-V1 master plan as current baseline | Plan = target + stale baseline | HARNESS-00 + later slices | RELABEL_FUTURE; do not copy baseline |
| 13 | Roadmap “product architecture governed by Platform-00” | PRD=WHAT, ARCHITECTURE=HOW | GOV-OS-01 | KEEP domain split; do not cite Platform-00 as HOW |
| 14 | OrchestrationService “skeleton” underspecified | In-memory implemented, not product-reachable | 07C source | REWRITE CURRENT vs FUTURE |
| 15 | LIVE-08 frozen artifact `e2e-auto.html` | Static preview requires `index.html` | PREVIEW-STRATEGY-01A + 03L | REMOVE e2e-auto as HOW; RELABEL_HISTORICAL FAIL |
| 16 | Idle timeout vaguely “in-memory” at app layer | CM 30 min request-driven Map | F2, 03K | REWRITE |
| 17 | CREATE-01A migration not executed | Migration exists; 04E applied on staging | 04E checkpoint | REWRITE persistence CURRENT; do not claim live DB probe |
| 18 | Users charged at provider completion (HOW) | Charged at qualifying Build apply / Ask completion | 03D | REWRITE HOW; WHAT copy → GOV-PRD-02 |

---

## 14. Product-WHAT deferrals (GOV-PRD-02 — NOT REGISTERED)

Do not solve here:

- User-facing meaning of Ask vs Build “spending” credits
- RPG identity / command-center product promise vs original simulation vision
- Coming-soon agent product promises and when they become real
- Multi-agent collaboration as a user-facing product
- Knowledge base as a user-facing product
- Harness as a user-facing beta promise
- Invitation cohort, support channel, Google OAuth product activation, Stripe product activation
- Public launch / broader rollout language
- Planned Goals in `PRD.md` that are not architecture-approved HOW
- GO/NO-GO accepted limitations that are product-scope
- UX-IA-00 remaining product IA

---

## 15. Exact Step 3 edit plan

**Strategy: B — bounded structural reconciliation**, preserving useful GOV-ARCH-01 content. Not a total rewrite. Smallest coherent authoritative CURRENT vs PLANNED split.

Do **not** add staging hostnames, secrets, or invitation architecture.

### Group A — Authority / CURRENT vs FUTURE framing

| # | Section | Current problem | Replacement truth | Sources | Action | CURRENT/FUTURE | Risk |
|---|---------|-----------------|-------------------|---------|--------|----------------|------|
| A1 | Authority Notice | Last reconciled 2026-08-10 | Date → GOV-ARCH-02 Step 3 date; note CURRENT vs PLANNED | This inventory | UPDATE | CURRENT | Low |
| A2 | After TOC or §1 | No hard CURRENT/PLANNED split | Short rule: unlabeled = CURRENT; FUTURE must be labeled; Harness gated ≠ beta-on; multi-agent not operational | GO/NO-GO, this doc | ADD | CURRENT | Low if short |
| A3 | §16 Summary | Generic | Point to CURRENT Builder-first mixed-transport platform; list non-operational FUTURE in one sentence | This doc | UPDATE | CURRENT | Low |

### Group B — Topology / ports / compose / staging

| # | Section | Current problem | Replacement truth | Sources | Action | CURRENT/FUTURE | Risk |
|---|---------|-----------------|-------------------|---------|--------|----------------|------|
| B1 | §1 diagram | AI port 4099; no Caddy; no frontend port | AI **4001**; Frontend **3002**; Caddy `/api/*`→GW 4000; CM 4002; Postgres 5432; Redis 6379 | F1, 04D, 03J | UPDATE | CURRENT | Medium (port error) |
| B2 | §1 / new subsection | Compose vs apps collapsed | Local `docker-compose.yml` = Postgres/Redis/Prometheus/Grafana only. Apps are host/PM2 processes. `docker-compose.prod.yml` = alternate/future image topology, not current staging. | compose files, 04D | ADD | CURRENT vs FUTURE | Medium |
| B3 | §3 AI Service | Port 4099; “credit accounting trigger” as if charge | Listen 4001; owns worker + adapters + harness; **triggers finalize-accounting (usage), not Build charge** | main.ts, 03D | UPDATE | CURRENT | Medium |
| B4 | §3 CM | “no PostgreSQL” true but omits SQLite; preview 4002 ok | Add local SQLite for CM session/container/git; still no app Postgres | sessions.service, 03K | UPDATE | CURRENT | Low |
| B5 | §3 Gateway | Orchestration “skeleton” only | Instantiated in-memory coordinator; no HTTP; not product-reachable | F5 | UPDATE | CURRENT | Low |
| B6 | §14 matrix | Fine overall | Fix AI port if mentioned; add Caddy; add Worker→GW confirm not needed | This doc | UPDATE | CURRENT | Low |

### Group C — Execution / credits / APIs

| # | Section | Current problem | Replacement truth | Sources | Action | CURRENT/FUTURE | Risk |
|---|---------|-----------------|-------------------|---------|--------|----------------|------|
| C1 | §11.1 steps 11–12 + Frontend | Finalize = charge | Split: usage finalization vs intent-gated deduction; confirm-build-apply; AUTO_APPLY; SSE unchanged | §6 this doc | UPDATE | CURRENT | **High** |
| C2 | §11 new 11.3 | Missing intent | `conversation` immediate; `workspace_mutation` delayed; default omitted = workspace_mutation | controller DEFAULT_EXECUTION_INTENT | ADD | CURRENT | High |
| C3 | §8 Public APIs | Missing confirm, agents, health; wrong git paths | Add confirm-build-apply, `/api/agents`, health/ready; replace git paths with `/api/sessions/:id/checkpoints*` + revert | controllers | UPDATE | CURRENT | Medium |
| C4 | §8 Internal APIs | Missing internal confirm | Add `POST /api/internal/executions/:id/confirm-build-apply`; keep finalize-accounting, sessions lifecycle, git-checkpoints | internal-accounting.controller | UPDATE | CURRENT | Low |
| C5 | §7 data model | Fine tables; omit CM SQLite | Add CM SQLite row; keep user_agents | F3, F2 | UPDATE | CURRENT | Low |
| C6 | §2 Idempotency | sourceEventId mentioned | Explicit: sourceEventId = executionId | usage-ledger | UPDATE | CURRENT | Low |

### Group D — Preview / files / Git / idle

| # | Section | Current problem | Replacement truth | Sources | Action | CURRENT/FUTURE | Risk |
|---|---------|-----------------|-------------------|---------|--------|----------------|------|
| D1 | §6 Preview | Proxy only | Add PreviewStrategyResolver; `index.html` root or immediate subdir; iframe URL; e2e-auto.html is **not** HOW | PREVIEW-STRATEGY-01A, 03L | UPDATE | CURRENT | Medium |
| D2 | §5 Governance | Idle at app layer | CM request-driven 30 min `SESSION_IDLE_TIMEOUT_MS`; in-memory lastActivity; Gateway notified; preview bypass; no sweeper | F2, 03K | UPDATE | CURRENT | Medium |
| D3 | New subsection under §11 or §6 | File-action HOW missing | Parse → risky confirm vs AUTO_APPLY → apply-once → sequential CM writes → confirm-build-apply → coherence/checkpoint | page.tsx, file-actions.logic | ADD | CURRENT | Medium |
| D4 | §9 Filesystem | “No host mounts” | Bind-mount host workspacePath → `/workspace:rw`; only /workspace writable in container; safe.directory /workspace | docker-runtime, 03I | UPDATE | CURRENT | Medium |
| D5 | Git HOW missing | Ledger mentioned only | Container Git + ledger + safe.directory + revert implemented + no automatic rollback | 03I, git.service, checkpoints.controller | ADD | CURRENT | Medium |

### Group E — Platform / identity / auth / billing / monitoring

| # | Section | Current problem | Replacement truth | Sources | Action | CURRENT/FUTURE | Risk |
|---|---------|-----------------|-------------------|---------|--------|----------------|------|
| E1 | §13.1 table | Orchestration underspecified; Create Agent APIs missing | Split CURRENT precursor vs FUTURE durable; add `/api/agents`; user agents not executable | F3, F5 | UPDATE | CURRENT/FUTURE | Medium |
| E2 | §13.2 | OK | Note APIs; 04E migration exists in repo; staging applied per locked 04E (no live probe claim) | F3 | UPDATE | CURRENT | Low |
| E3 | §13.3 | OK list | Keep; add “product-reachable multi-Builder” and “Stripe charging” and “Google OAuth login” | GO/NO-GO | UPDATE | FUTURE excluded | Low |
| E4 | Optional identity | Absent | Optional agentRole / builderProfileId / collaborationRunId / referralTraceId on execute→job→metadata; frontend does not currently send | PLATFORM-06, frontend grep | ADD | CURRENT plumbing / FUTURE product | Low |
| E5 | Auth boundary | Thin | Email/password + verify + cookies/CSRF; OAuth routes fail-closed if unregistered; generated-app isolation | AUTH-*, generator forbidden tokens | ADD short § or §3 | CURRENT | Low |
| E6 | Billing gate | Absent | Ledger CURRENT; BILLING_CHARGES_ENABLED Stripe kill-switch default false; no Stripe SDK | charge-readiness, stripe-payment.provider | ADD | CURRENT vs FUTURE | Medium |
| E7 | Monitoring | Absent | Gateway `/api/health`, `/api/health/ready`, `/api/health/db`; AI `/metrics`; local Prometheus/Grafana; worker stuck watchdog ≠ session idle | health.controller, prometheus.yml, worker | ADD short | CURRENT | Low (don’t over-claim staging Prometheus) |
| E8 | Provider attribution | Thin | Adapter registry; usage_records store provider/model; proven path xAI/grok-4.5 | LIVE-11, adapters | UPDATE §3/§11 | CURRENT | Low |
| E9 | §12 Harness | Missing beta-off | Add: not private-beta default; IMPLEMENTED_BUT_GATED | GO/NO-GO | UPDATE | CURRENT gated / FUTURE default | Low |

### Group F — Do not add / do not claim

- Invitations, support channel, Lane 3, Kubernetes/HA
- Harness as beta-on
- Multi-agent product runtime
- Knowledge/collab product
- Stripe live charging
- Google OAuth as available login
- Automatic rollback
- `search_workspace` handler
- Exact Lightsail instance specs
- Product copy for Ask vs Build

### Group G — Structure decision for Step 3

Keep TOC §§1–16. Patch in place. Add **short** subsections rather than new top-level parts, except a compact “CURRENT vs PLANNED” callout after Authority Notice.

Do **not** duplicate the full Step 2 inventory into ARCHITECTURE.md. Architecture should state HOW, not evidence history.

---

## 16. Exclusions

This Step 2 (and the GOV-ARCH-02 lifecycle) does not:

- edit `ARCHITECTURE.md` (Step 3 does)
- edit `PRD.md`
- implement product features or refactor services
- run runtime, Docker, Postgres, Redis, migrations, SSH, providers, credits
- register GOV-PRD-02 or the 2-source-lane pilot
- register or start PRIVATE-BETA-INVITE-01
- mutate Development OS (`CLAUDE.md` / `AGENTS.md`)
- rewrite Platform-00 or roadmap bodies
- promote speculative product ideas into HOW

---

## 17. Invitation parked state

```
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
PRIVATE-BETA-INVITE-01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
INVITATION_EXECUTION_PERMITTED=NO
FRESH_KEITH_INVITATION_AUTHORIZATION=STILL REQUIRED
```

This task is not invitation work.

---

## 18. Unresolved architecture ambiguity (documentation-safe)

None block Step 3. Remaining unknowns are **runtime instance state**, not repository HOW:

| Item | Status | Step 3 handling |
|------|--------|-----------------|
| Live Postgres `user_agents` row contents **today** | UNKNOWN without DB | Document schema+migration+locked 04E apply; do not claim a live row count |
| Whether staging Prometheus currently scrapes PM2 `localhost:4001` vs compose hostname `ai-service:4001` | UNKNOWN without staging inspect | Document local compose scrape config as **local compose HOW**; do not assert staging Prometheus topology |
| Whether a human later set `SESSION_IDLE_TIMEOUT_MS` on staging after 03K | UNKNOWN without env read | Document default 30 min + configurable; 03K locked default-applied |
| Whether leftover `AIServiceHttpClient.execute` is still used by any non-Builder path | Not on CURRENT Builder path; client remains in module | Describe as leftover HTTP client defaulting to `:4001`; Builder path = BullMQ |
| `docker-compose.prod.yml` operational use | File exists; current staging is PM2 | Label as alternate/future compose topology, not current staging |

Step 3 **can proceed without runtime evidence: YES**.

---

## 19. Successor sequence (NOT REGISTERED beyond GOV-ARCH-02)

```
GOV-ARCH-02 Step 3 (ARCHITECTURE.md reconciliation)
→ GOV-ARCH-02 Step 4 (checkpoint / lock)
→ GOV-PRD-02 (unregistered)
→ first genuine 2-source-lane pilot (unregistered)
→ pilot review
→ explicit future Lane 3 decision
```

PRIVATE-BETA-INVITE-01 remains PARKED.

---

## 20. Step 2 activity ledger

```
LIVE = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gates = 0
runtime mutation = 0
database mutation = 0
migrations executed = 0
product = 0
frontend = 0
backend/services = 0
dependencies = 0
ARCHITECTURE.md edits = 0
PRD.md edits = 0
Git mutations = 0
```

Allowed writes this step: this file; `TASKS.md` CURRENT EXECUTION BOARD; `TASKS_BACKLOG_FULL.md` GOV-ARCH-02 Step 2 only.

---

*GOV-ARCH-02 Step 2 — 2026-08-23 — current implemented architecture verified against source — ARCHITECTURE.md drift and supersession inventoried — CURRENT vs FUTURE boundary frozen — bounded Step 3 plan ready — PRD work and invitations remain deferred.*
