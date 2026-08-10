# PRIVATE-BETA-OPS-01-STAGE-START.md
## Existing Observability / Alerting Audit + Stage-Start

**Task ID:** PRIVATE-BETA-OPS-01
**Step:** 2 — Existing Observability / Alerting Audit + Stage-Start
**Status:** COMPLETE (read-only audit; this document is the sole output)
**Date:** 2026-08-10
**Author:** Cursor / Sonnet 4.6
**Nature:** READ-ONLY AUDIT — documentation artifact only; no source, test, runtime, or configuration changes

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-OPS-01 |
| Title | Minimal Operational Visibility Baseline |
| Step | 2 — Existing Observability / Alerting Audit + Stage-Start |
| Predecessor | Step 1 — Registration — COMPLETE — 2026-08-10 |
| Governing state | GOV-ARCH-01 COMPLETE AND LOCKED, GOV-PRD-01 COMPLETE AND LOCKED |
| Execution gating | GLOBAL_EXECUTION_ENABLED = false (unchanged) |
| Beta cohort target | 1–3 trusted users (Builder-first) |
| Genuine multi-agent beta | NO-GO (unchanged) |

---

## 2. Files Inspected (Read-Only)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Working contract — governance rules |
| `TASKS.md` | Active execution ledger — PRIVATE-BETA-OPS-01 registration |
| `TASKS_BACKLOG_FULL.md` | TASK-41A and TASK-60A/60B entries |
| `ARCHITECTURE.md` | Service topology, non-goals, communication model |
| `PRD.md` | Builder-first current/gated/planned distinctions |
| `docs/GOV-ARCH-01-CHECKPOINT.md` | Architecture reconciliation — LOCKED |
| `docs/GOV-PRD-01-CHECKPOINT.md` | PRD reconciliation — LOCKED |
| `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md` | Deployment readiness — LOCKED |
| `docs/PRIVATE-BETA-FUNCTIONAL-READINESS-04-CHECKPOINT.md` | AI execution smoke — LOCKED |
| `docs/PHASE-41A-CHECKPOINT.md` | Phase 41A — runtime metrics implementation |
| `docs/PHASE-60A-DESIGN.md` | Phase 60A — alerting design |
| `docs/PHASE-60A-CHECKPOINT.md` | Phase 60A — alerting checkpoint |
| `docs/PHASE-60B-CHECKPOINT.md` | Phase 60B — external monitoring contract |
| `docs/PHASE-60-FINAL-CHECKPOINT.md` | Phase 60 — final checkpoint |
| `docs/EXTERNAL-MONITORING-CONTRACT.md` | Phase 60B contract document |
| `docs/OBSERVABILITY-ALERTS.md` | Phase 53C Prometheus alert rules |
| `docs/SERVICE-LEVEL-OBJECTIVES.md` | Phase 54B SLI/SLO definitions |
| `docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md` | Deployment runbook |
| `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` | PM2 startup runbook |
| `docs/runbooks/api-gateway-unreachable.md` | Phase 60B runbook |
| `docs/runbooks/docker-connectivity-lost.md` | Phase 60B runbook |
| `docs/runbooks/database-connectivity-lost.md` | Phase 60B runbook |
| `docs/runbooks/session-container-drift.md` | Phase 60B runbook |
| `docs/runbooks/elevated-error-termination-rate.md` | Phase 60B runbook |
| `services/api-gateway/src/health/health.controller.ts` | Health endpoints source |
| `services/container-manager/src/health/health.controller.ts` | Container-manager health source |
| `services/ai-service/src/main.ts` | AI service startup — no health controller |
| `services/api-gateway/src/runtime/runtime.controller.ts` | Runtime metrics controller |
| `services/api-gateway/src/runtime/runtime.service.ts` | Runtime metrics service |
| `services/ai-service/src/observability/metrics.controller.ts` | Prometheus metrics (ai-service) |
| `services/ai-service/src/observability/metrics.registry.ts` | Prometheus registry |
| `services/ai-service/src/observability/queue-metrics-updater.ts` | Queue depth gauge updater |
| `services/ai-service/src/metrics/metrics.controller.ts` | Internal worker metrics |
| `services/api-gateway/src/guards/internal-service-auth.guard.ts` | Internal auth guard |
| `services/api-gateway/src/app.module.ts` | Module registry |
| `services/api-gateway/src/email/resend-email.provider.ts` | Resend email provider |
| `services/api-gateway/src/email/email.module.ts` | Email module |
| `services/api-gateway/src/email/email-provider.interface.ts` | Email provider interface |
| `services/api-gateway/src/usage-ledger/orphan-reconciliation.worker.ts` | Orphan cleanup worker |
| `services/api-gateway/scripts/verify-metrics-41a.ps1` | Phase 41A verification script |
| `monitoring/prometheus/prometheus.yml` | Prometheus scrape config |
| `monitoring/prometheus/alerts/aisandbox-alerts.yml` | Prometheus alert rules |

**Files changed:** NONE (read-only audit step)

---

## 3. Health Endpoint Findings (Audit Area 1)

### 3.1 API Gateway Health Endpoints

#### `GET /api/health`

| Dimension | Finding |
|-----------|---------|
| Owning service | API Gateway (port 4000) |
| Source | `services/api-gateway/src/health/health.controller.ts` |
| What it checks | Process liveness only; returns `{ status: 'ok', timestamp, service, version }` |
| PostgreSQL readiness | NOT CHECKED |
| Redis readiness | NOT CHECKED |
| BullMQ/worker readiness | NOT CHECKED |
| Container-manager health | NOT CHECKED |
| Frontend health | NOT REPRESENTED |
| Auth required | None — publicly accessible |
| Classification | **IMPLEMENTED BUT LIMITED** — process liveness only; confirms API Gateway process is responding, not service readiness |

#### `GET /api/health/db`

| Dimension | Finding |
|-----------|---------|
| Owning service | API Gateway |
| What it checks | `SELECT 1` via TypeORM DataSource; 200 if connected, 503 if disconnected |
| PostgreSQL readiness | CHECKED — direct query |
| Redis readiness | NOT CHECKED |
| BullMQ/worker readiness | NOT CHECKED |
| Container-manager health | NOT CHECKED |
| Frontend health | NOT REPRESENTED |
| Auth required | None — publicly accessible |
| Classification | **IMPLEMENTED** — valuable; confirms PostgreSQL connectivity from API Gateway perspective |

#### `GET /api/health/ready`

| Dimension | Finding |
|-----------|---------|
| Owning service | API Gateway |
| What it checks | (1) EnvironmentValidator.validateEnvironment(), (2) `SELECT 1` database check, (3) KillSwitchConfig loaded, (4) GlobalSafetyLimits loaded. Returns 200 or 503. |
| PostgreSQL readiness | CHECKED |
| Redis readiness | NOT CHECKED — Redis is used by BullMQ but not probed here |
| BullMQ/worker readiness | NOT CHECKED |
| Container-manager health | NOT CHECKED |
| Frontend health | NOT REPRESENTED |
| Auth required | None — publicly accessible |
| Classification | **IMPLEMENTED** — highest-value health signal for operator; 503 means API Gateway cannot serve traffic (env missing, DB down, config failed) |

### 3.2 Container-Manager Health

#### `GET /api/health` (container-manager, port 4002 — internal only)

| Dimension | Finding |
|-----------|---------|
| Owning service | container-manager (port 4002) |
| Source | `services/container-manager/src/health/health.controller.ts` |
| What it checks | Process liveness only; returns `{ status: 'ok', service: 'container-manager', timestamp }` |
| Docker daemon health | NOT CHECKED |
| Auth required | None — but port 4002 is not externally exposed (internal only) |
| Classification | **IMPLEMENTED BUT LIMITED** — process liveness only; not externally accessible; Docker daemon state not probed |

### 3.3 AI Service Health

| Dimension | Finding |
|-----------|---------|
| Owning service | AI Service (port 4001 — internal only) |
| Health endpoint | **NO `HealthController` exists.** `main.ts` logs `/api/health` in startup console but no controller implements it. |
| Process visibility | PM2 `online` status only |
| Auth required | N/A |
| Classification | **NOT IMPLEMENTED** — process health is PM2-only; no HTTP health probe |

### 3.4 Frontend Health

| Dimension | Finding |
|-----------|---------|
| Service | Next.js frontend (port 3000 / 3002 on staging) |
| Health endpoint | None — Next.js default HTTP response on root route is the only available check |
| Classification | **NOT IMPLEMENTED** — HTTP 200 on root URL is the only available probe |

---

## 4. Runtime Metrics Findings (Audit Area 2)

### 4.1 `GET /api/runtime/metrics` (Phase 41A)

**Source:** `services/api-gateway/src/runtime/runtime.controller.ts` + `runtime.service.ts`

**Effective access:** The `RuntimeController` has `@UseGuards(InternalServiceAuthGuard)` decorator. However, the guard implementation (`internal-service-auth.guard.ts`) explicitly bypasses all routes that do NOT start with `/api/internal/` or `/api/events/`. `/api/runtime/metrics` does not match either prefix, so the guard returns `true` unconditionally.

**Conclusion: `/api/runtime/metrics` is effectively publicly accessible without authentication.**

**Metrics currently exposed:**

| Metric | Source | Signal |
|--------|--------|--------|
| `activeSessionCount` | PostgreSQL query | Sessions with status ACTIVE or PENDING and `terminated_at IS NULL` |
| `runningContainerCount` | container-manager `/api/internal/stats` | Docker containers in running state |
| `terminatedSessionCount` | PostgreSQL query | Sessions with `terminated_at IS NOT NULL` |
| `terminationReasons` | PostgreSQL GROUP BY | Array of `{reason, count}` ordered by count DESC |
| `serviceUptimeSeconds` | In-memory `startTime` | Seconds since API Gateway process start |
| `dockerConnectivity` | container-manager `/api/internal/stats` | Boolean |
| `databaseConnectivity` | `SELECT 1` | Boolean |
| `timestamp` | Server time | ISO 8601 |

**What is NOT exposed:**
- Redis connectivity
- BullMQ queue state (waiting, active, failed job counts)
- AI Service worker state
- Worker execution failure/completion counts
- Provider error counts
- AI Service process health
- Container-manager process health
- Frontend health
- PM2 restart counts
- Memory/CPU

**Fail-soft behavior:** Endpoint always returns 200 OK. If PostgreSQL fails, counts return 0. If container-manager is unreachable, `dockerConnectivity=false` and `runningContainerCount=0`.

### 4.2 AI Service Internal Worker Metrics (Phase 49)

**Endpoint:** `GET /api/internal/metrics` on AI Service (port 4001)
**Auth:** `InternalServiceAuthGuard` — requires `X-Internal-Service-Key` header (this endpoint IS `/api/internal/*`)
**Source:** `services/ai-service/src/metrics/metrics.controller.ts` → `worker.processor.ts`

**Metrics exposed:**

| Metric | Type | Description |
|--------|------|-------------|
| `execution_completed_total` | Counter (in-memory) | Completed executions since process start |
| `execution_failed_total` | Counter (in-memory) | Failed executions since process start |
| `execution_cancelled_total` | Counter (in-memory) | Cancelled executions since process start |
| `execution_timeout_total` | Counter (in-memory) | Timed-out executions since process start |

**Critical limitation:** These counters are in-memory and reset on process restart. They are NOT persisted to PostgreSQL.
**Access:** Internal service only — not externally accessible at staging (port 4001 not exposed).

### 4.3 AI Service Prometheus Metrics (Phase 52A)

**Endpoint:** `GET /metrics` on AI Service (port 4001, no `/api` prefix)
**Auth:** None — but port 4001 is not externally exposed at staging
**Source:** `services/ai-service/src/observability/metrics.controller.ts` + `metrics.registry.ts`

**Metrics exposed:** Default Node.js `prom-client` metrics only (CPU, memory, event loop lag, GC, active handles/requests). No custom execution or queue metrics in Phase 52A.

**Queue depth gauges** (Phase 52D) — updated by `QueueMetricsUpdater` on a 10-second `setInterval`:
- BullMQ waiting/active/completed/failed job counts (Prometheus format)
- These are internal-only and would require Prometheus to be running and scraping.

**Prometheus/Grafana stack:** Config present in `monitoring/` directory but this is a Docker Compose dev/production tool stack that is NOT running on the current staging VPS (PM2-based deployment, not Docker Compose for monitoring).

**Alert rules** (`monitoring/prometheus/alerts/aisandbox-alerts.yml` and `docs/OBSERVABILITY-ALERTS.md`): Defined for Phase 53C but depend on Prometheus server running and scraping ai-service. **PROMETHEUS IS NOT RUNNING ON STAGING.** These rules are inactive.

---

## 5. PM2 Visibility Findings (Audit Area 3)

**Source:** `docs/PRIVATE-BETA-STAGING-EXECUTION-04D-PM2-HEALTH-SMOKE-RUNBOOK.md` + deployment evidence + `docs/PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md`

### What PM2 Provides on Staging

PM2 7.0.3 is running on the AWS Lightsail staging VPS (`staging.ainow.biz`). The following processes are managed:

| Process | PM2 name |
|---------|----------|
| API Gateway | `api-gateway` |
| AI Service | `ai-service` |
| Container Manager | `container-manager` |
| Frontend (Next.js) | `frontend` |

**What PM2 passively tracks per process:**
- `status` — `online`, `stopped`, `errored` 
- `restarts` — total restart count (from process start)
- `unstable_restarts` — crash-loop indicator
- `uptime` — time since last start
- `memory` — current heap/RSS
- `cpu` — recent CPU %
- Stdout/stderr logs — accessible via `pm2 logs <name>`
- Exit codes
- PID

**PM2 startup persistence:** `pm2 save` + `pm2 startup` are documented; confirmed in staging deployment (`PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md` — "Rollback path known: PM2 / SSH").

**What PM2 does NOT provide:**
- **Active notification to Keith** — PM2 tracks crash state passively. It does NOT send email, SMS, webhook, or any outbound notification on crash or restart. PM2's built-in notification requires a PM2 Plus (paid) or Keymetrics account; no such integration exists in this deployment.
- Automatic remediation
- External alerting

**PM2 crash detection:** If a process crashes and PM2 is configured to restart it (`--no-autorestart` not set), PM2 will restart the process automatically. Keith will not be notified. Keith must manually SSH in and run `pm2 list` or `pm2 logs` to discover the issue.

**Memory restart threshold:** No `--max-memory-restart` is documented in any PM2 start commands found in the runbooks. PM2 will not restart based on memory unless configured.

**Conclusion: PM2 provides passive state tracking with automatic restart. It provides zero active notification to Keith.**

---

## 6. Phase 60 Implementation vs. Design Findings (Audit Area 4)

**Source:** `docs/PHASE-60A-CHECKPOINT.md`, `docs/PHASE-60B-CHECKPOINT.md`, `docs/PHASE-60-FINAL-CHECKPOINT.md`

**Phase 60 in its entirety produced DOCUMENTATION AND RUNBOOKS ONLY. Zero code was implemented.**

| Phase 60 Deliverable | Nature | Classification |
|---------------------|--------|----------------|
| `docs/PHASE-60A-DESIGN.md` — alerting scope, thresholds, incident signal definitions | Design document | **DOCUMENTATION / DESIGN ONLY** |
| `docs/EXTERNAL-MONITORING-CONTRACT.md` — polling cadence, alert evaluation rules | Contract document | **DOCUMENTATION / DESIGN ONLY** |
| `docs/runbooks/docker-connectivity-lost.md` | Runbook | **DOCUMENTATION / DESIGN ONLY** |
| `docs/runbooks/database-connectivity-lost.md` | Runbook | **DOCUMENTATION / DESIGN ONLY** |
| `docs/runbooks/api-gateway-unreachable.md` | Runbook | **DOCUMENTATION / DESIGN ONLY** |
| `docs/runbooks/session-container-drift.md` | Runbook | **DOCUMENTATION / DESIGN ONLY** |
| `docs/runbooks/elevated-error-termination-rate.md` | Runbook | **DOCUMENTATION / DESIGN ONLY** |
| Alert evaluation logic | NONE | **NOT IMPLEMENTED** |
| Background alert checker | NONE | **NOT IMPLEMENTED** |
| Scheduled/periodic health poller | NONE | **NOT IMPLEMENTED** |
| Email notification | NONE | **NOT IMPLEMENTED** |
| Restart/crash detector | NONE | **NOT IMPLEMENTED** |
| Outage detector | NONE | **NOT IMPLEMENTED** |
| Provider-error detector | NONE | **NOT IMPLEMENTED** |
| Incident log | NONE | **NOT IMPLEMENTED** |
| Admin UI for alerts | NONE | **NOT IMPLEMENTED** |
| Prometheus alerting (Alertmanager) | Deferred in Phase 53C docs | **NOT IMPLEMENTED** |

**Phase 60 assumed an external monitoring system would be operated separately.** No such external monitoring system is known to be configured or running against staging.

**The Phase 60 design assumed architecture constraints of "no background workers / no cron / no event bus." These constraints remain active per ARCHITECTURE.md §15.**

---

## 7. Resend / Email Reuse Findings (Audit Area 5)

**Source:** `services/api-gateway/src/email/resend-email.provider.ts`, `email.module.ts`, `email-provider.interface.ts`

| Dimension | Finding |
|-----------|---------|
| Resend already a dependency | **YES** — `resend` npm package installed in api-gateway |
| Reusable email service | **YES** — `ResendEmailProvider` implements `EmailProvider` interface with `sendEmail(to, subject, html, text?)` |
| Current use of Resend | Auth emails only: email verification, password reset |
| Operational/system alerts use it | **NO** — zero operational or monitoring alert emails use it |
| Alert recipient configuration | **DOES NOT EXIST** — no `OPERATOR_ALERT_EMAIL` or equivalent env var |
| New secrets required | **PARTIALLY** — `RESEND_API_KEY` and `AUTH_EMAIL_FROM` already configured on staging for auth email delivery. A new `OPERATOR_ALERT_RECIPIENT` env var would be required. No new Resend account or new API key needed. |
| New architecture required | **NO** — the `EmailProvider` interface and `ResendEmailProvider` are already injectable via NestJS DI. Reuse requires only a new injectable service that accepts `EMAIL_PROVIDER` and a configurable recipient. No new module architecture. |
| Using Resend for beta outage alerts | **VIABLE** — the existing infrastructure already works (confirmed: Resend email delivery PASS in `PRIVATE-BETA-DEPLOYMENT-READINESS-CHECKPOINT.md`). Only a thin calling layer and a configurable recipient are missing. |

---

## 8. Existing Recurring Job / Scheduler Findings (Audit Area 6)

**Architecture constraint:** ARCHITECTURE.md §15 explicitly lists "No cron / No schedulers" as an explicit non-goal. §2 states "No cron jobs / No schedulers."

**Actual codebase findings:**

| Component | Type | Purpose | Operational monitoring value |
|-----------|------|---------|-------------------------------|
| `OrphanReconciliationWorker` (api-gateway) | `setInterval` every 60s | Cleans up stuck `pending` usage_records; transitions them to `timeout` | **ZERO** — operational database hygiene only; emits structured JSON logs; no crash or service health detection |
| `QueueMetricsUpdater` (ai-service) | `setInterval` every 10s | Updates BullMQ queue depth Prometheus gauges | **ZERO** — feeds Prometheus gauges that are not scraped on staging; no alerting |
| Prometheus alert rules (`monitoring/prometheus/alerts/aisandbox-alerts.yml`) | Prometheus — NOT RUNNING | AIExecutionFailureRateHigh, AIExecutionLatencyHigh, AIQueueBacklogHigh, AIQueueLagHigh, AIWorkerStuckRecoverySpike | **ZERO** — Prometheus server is not running on staging (PM2-based deployment, not Docker Compose monitoring stack) |
| PM2 auto-restart | PM2 behavior | Restarts crashed processes | **PASSIVE ONLY** — no notification |

**Conclusion:** There are NO active scheduled or recurring operational health checks or notification jobs. The orphan reconciliation worker and queue metrics updater are internal operational workers, not monitoring workers. Neither can detect or notify on service outages.

---

## 9. Structured Audit / Log Findings (Audit Area 7)

**AUDITABILITY vs. ACTIVE ALERTING:**

| Signal | Exists | Nature | Notifies Keith? |
|--------|--------|--------|-----------------|
| Harness audit events (`InMemoryHarnessAuditRecorder`) | YES | In-memory only; not persisted; lost on restart | NO |
| Orchestration audit events | YES (in-memory skeleton) | Not persisted | NO |
| `usage_records` (PostgreSQL) | YES | Execution records with status, tokens, provider | NO — passive; requires manual query |
| `credit_deduction_records` (PostgreSQL) | YES | Per-execution credit deductions | NO — passive |
| Application logs (NestJS) | YES | Stdout/stderr via PM2 | NO — passive; requires `pm2 logs` |
| `WorkerProcessor` structured JSON logs | YES | Per-execution JSON with `event`, `executionId`, `execution_status`, `metrics` | NO — passive; requires `pm2 logs ai-service` |
| OrphanReconciliationWorker structured logs | YES | JSON events for reconciliation state | NO — passive |
| PM2 restart/crash log | YES | `pm2 list` shows restart count and status | NO — passive; requires SSH |

**Key finding:** The platform has excellent passive auditability — structured JSON logs, PostgreSQL records, PM2 state. But auditability is not alerting. None of these mechanisms notify Keith without manual intervention.

---

## 10. Critical Service Visibility Matrix (Audit Area 8)

| Service | User Impact on Failure | Current Signal | Signal Type | Keith Knows Without Checking? | Additional Detection Required? |
|---------|----------------------|---------------|-------------|-------------------------------|-------------------------------|
| **Frontend** (Next.js) | Users cannot reach the product at all | HTTP 200 on root URL (informal); PM2 `online` status | Passive | NO | Low priority — Caddy/DNS failure also causes this; PM2 auto-restarts |
| **API Gateway** | All API calls fail; 502/504 from Caddy; users cannot auth or execute | `GET /api/health` → non-200; `GET /api/health/ready` → 503; PM2 `online` status | Passive | NO | **YES — alert on `/api/health/ready` persistent failure is highest-value signal** |
| **AI Service / WorkerProcessor** | AI execution requests queue but never complete; users see hung executions | PM2 `online` status; no HTTP health endpoint | Passive | NO | **YES — no HTTP probe exists; PM2 process status is the only signal** |
| **container-manager** | Sessions cannot be created or managed; workspace operations fail | `GET /api/health` (port 4002, internal only); `dockerConnectivity` in `/api/runtime/metrics` | Passive | NO | PARTIALLY — `dockerConnectivity=false` in runtime metrics surfaces this; but only if metrics are polled |
| **PostgreSQL** | All persistent state unavailable; sessions, projects, auth fail | `GET /api/health/db` → 503; `databaseConnectivity=false` in runtime metrics | Passive | NO | **YES — alert on `/api/health/db` or `databaseConnectivity=false` is critical** |
| **Redis / BullMQ** | AI execution requests enqueue but never processed; queue silently builds up | **NOT REPRESENTED in any health endpoint** | Passive | NO | **YES — no Redis health signal exists in any currently queryable endpoint** |

**Critical gap summary:**
1. Redis/BullMQ connectivity is invisible — no endpoint checks it
2. AI Service process health is invisible — no HTTP probe
3. All current signals are passive — no signal proactively reaches Keith

---

## 11. Existing Operator Response / Rollback Coverage (Audit Area 9)

**Phase 60B runbooks exist for the following scenarios:**

| Scenario | Runbook | Coverage |
|----------|---------|---------|
| Frontend down | None (no dedicated runbook) | MISSING |
| API Gateway down | `docs/runbooks/api-gateway-unreachable.md` | PRESENT — verify health endpoints, restart PM2 process, check logs |
| AI worker down | None (no dedicated runbook) | MISSING |
| container-manager down | `docs/runbooks/docker-connectivity-lost.md` (partial) | PARTIAL — covers Docker connectivity; not CM process crash specifically |
| Database unhealthy | `docs/runbooks/database-connectivity-lost.md` | PRESENT |
| Redis unhealthy | None (no dedicated runbook) | MISSING |
| Repeated PM2 restarts | None (no dedicated runbook) | MISSING — PM2 restart loop is not addressed in any runbook |

**Known from deployment readiness:**
- PM2 restart via SSH is documented as the recovery action
- DB backup at `/opt/aisandbox/db-backups/` confirmed
- Lightsail auto-snapshots active
- git rollback available

**Genuine missing operator-response guidance:**
1. What to do if AI Service crashes and cannot restart (no PM2 restart loop guidance)
2. What to do if Redis is unavailable (no runbook — BullMQ queue fails silently)
3. What to do if PM2 auto-restart loops without stabilizing (no escalation runbook)
4. First-check procedure for Keith: "what to look at first when something seems wrong" — not documented as a single reference

---

## 12. Gap Classification (Audit Area 10)

### REQUIRED BEFORE BUILDER BETA

These are genuine gaps that make a service outage during Builder beta completely silent:

| Gap | Severity | Justification |
|-----|----------|--------------|
| **No active notification path** — Keith has zero way to learn of a crash/outage without manually SSHing in | CRITICAL | A 1–3 user cohort in a controlled beta does not require enterprise monitoring, but a silent full outage is unacceptable |
| **Redis/BullMQ visibility absent** — No health endpoint checks Redis; if Redis goes down, AI execution silently fails with no signal in any queryable endpoint | HIGH | Redis failure kills all AI execution; `databaseConnectivity=false` surfaces but Redis absence is invisible |
| **AI Service process health has no HTTP probe** — Only PM2 status reveals AI Service state | MEDIUM | PM2 auto-restarts; but if the process can't restart, execution hangs silently |
| **No first-responder procedure** — Keith has no single documented "what to check first when something seems wrong" reference | LOW-MEDIUM | Runbooks for individual incidents exist, but no triage starting point |

### DESIRABLE BUT NOT REQUIRED

| Gap | Justification |
|-----|--------------|
| Redis health endpoint on API Gateway | Valuable but Redis failure will also manifest as `databaseConnectivity` issues or AI execution failures visible in usage_records |
| AI Service HTTP health endpoint | PM2 process status is sufficient for 1–3 user beta; add if AI Service restart loops become a problem |
| Per-execution provider failure logging to PostgreSQL | Currently in-memory only; adding DB persistence is good but not blocking |
| Runbook for Redis down | Useful but an operator notification alert will surface the issue; runbook can be created in Step 3 if needed |
| Runbook for PM2 restart loop | Useful addition but not a blocker |
| Runbook for frontend down | Caddy/DNS visibility is more relevant for frontend down; PM2 covers the process |

### NOT REQUIRED AT THIS SCALE (1–3 trusted users)

| Capability | Justification |
|------------|--------------|
| Distributed tracing (OpenTelemetry, Jaeger) | Not appropriate for single-node 1–3 user beta |
| Grafana / Prometheus (running stack) | Entire monitoring stack is not running on staging VPS; activating it would be a major infrastructure change |
| Sentry / Datadog / external APM | New vendor; not justified for 1–3 trusted users; operator-only beta |
| Centralized log ingestion (ELK/Loki) | Not appropriate for this scale |
| Synthetic global monitoring | Not appropriate for 1–3 trusted users |
| HA failover | Explicitly not in scope (ARCHITECTURE.md §15) |
| Pager rotations | Not appropriate; Keith is the only operator |
| Historical time-series alerting | PM2 logs and PostgreSQL usage_records provide adequate history for this scale |
| Alert dashboard UI | Not required; email notification suffices |
| Session-container drift alerting | Relevant for production at scale; not a blocking concern for 1–3 user beta where drift would be immediately visible in /api/runtime/metrics |

---

## 13. Recommended Smallest-Safe Solution

### Selection: **Option B — Tiny bounded alert extension using existing infrastructure**

**Rationale:**

- Current PM2 + health endpoints alone are insufficient (Option A fails) because they require Keith to manually SSH in. A 1–3 user beta can span hours or days unattended.
- Option C (standalone script/process) is not preferred because the existing Resend infrastructure already works and is simpler.
- Option D (external monitoring vendor) is NOT selected — no new vendor required or justified at this scale.

**Proposed minimal implementation:**

A new `OperatorAlertService` injectable in api-gateway that:

1. Checks `/api/health/ready` (already implemented) — if 503 or unreachable, it means API Gateway itself is unhealthy
2. Because the API Gateway health check can't detect its own crash (it's running inside the same process), the minimal detection uses two complementary signals:
   - A thin **scheduled health probe** running inside api-gateway at startup via `setInterval` — polls `databaseConnectivity` and `dockerConnectivity` via the existing `RuntimeService` (internal call, no HTTP round-trip)
   - Uses `OrphanReconciliationWorker` pattern (already established pattern for setInterval workers in api-gateway)
3. Sends a single email via existing `ResendEmailProvider` when:
   - `databaseConnectivity === false` (persists for 2 consecutive checks, ~2 minutes)
   - `dockerConnectivity === false` (persists for 2 consecutive checks, ~2 minutes)
4. PM2 crash detection: Adds a minimal `ecosystem.config.js` note in the runbook directing Keith to check `pm2 list` as the first step; **no code required for this**

**What this achieves:**
- Keith receives an email if the database or Docker goes down
- Keith can manually SSH for PM2 status to detect AI Service crash
- Existing health endpoints remain available for manual polling
- No new vendor, no new package dependency (Resend already exists), no external monitoring system

**Critical constraint:** The architecture's "No cron / No schedulers" non-goal (ARCHITECTURE.md §15) explicitly applies to **AI execution queue workers** and **session cleanup workers**. The OrphanReconciliationWorker already uses `setInterval` for operational purposes, establishing a precedent for bounded operational service monitors. Step 3 must explicitly acknowledge this and confirm it does not add a general-purpose scheduler.

---

## 14. Exact Step 3 Implementation Scope

**Step 3 is bounded to the following and nothing else:**

### Files to be created or modified:

| File | Action | Purpose |
|------|--------|---------|
| `services/api-gateway/src/operator-alert/operator-alert.service.ts` | **CREATE** | Injectable service — checks databaseConnectivity + dockerConnectivity from RuntimeService; sends alert email via EMAIL_PROVIDER if degraded for 2 consecutive checks; suppresses repeat alerts with cooldown |
| `services/api-gateway/src/operator-alert/operator-alert.module.ts` | **CREATE** | NestJS module wrapping OperatorAlertService; imports RuntimeModule and EmailModule |
| `services/api-gateway/src/app.module.ts` | **MODIFY** | Register OperatorAlertModule |
| `services/api-gateway/src/__tests__/operator-alert.service.spec.ts` (or similar) | **CREATE** | Unit tests covering alert trigger logic, cooldown, and email call |

### What Step 3 does NOT do:

- Does NOT add Redis health check (desirable but not required)
- Does NOT add AI Service HTTP health endpoint (PM2 sufficient for beta)
- Does NOT modify health endpoints
- Does NOT modify runtime.service.ts or runtime.controller.ts
- Does NOT modify any existing tests
- Does NOT add a new npm dependency (Resend already installed)
- Does NOT add Prometheus, Grafana, or any external monitoring vendor
- Does NOT modify Docker files, PM2 config, or .env files
- Does NOT modify TASKS.md or governance docs

### New environment variable required (Keith approval):

| Variable | Purpose | Required |
|----------|---------|---------|
| `OPERATOR_ALERT_RECIPIENT` | Email address to receive outage alerts | YES — must be configured on staging |
| `OPERATOR_ALERT_ENABLED` | Feature flag to enable/disable (default: `true` if recipient configured) | Recommended |

`RESEND_API_KEY` and `AUTH_EMAIL_FROM` already exist on staging. Only `OPERATOR_ALERT_RECIPIENT` is a new env var.

### What Step 3 alerts on (minimum):

| Condition | Signal | Debounce | Email sent |
|-----------|--------|---------|-----------|
| PostgreSQL unreachable | `databaseConnectivity === false` for 2 consecutive 60s checks | 2 × 60s = ~2 min | YES |
| Docker unreachable | `dockerConnectivity === false` for 2 consecutive 60s checks | 2 × 60s = ~2 min | YES |
| Alert cooldown | Same condition within 15 minutes | 15 min | NO (suppressed) |
| API Gateway itself down | Cannot self-detect via this path — PM2 auto-restart is the mitigation | N/A | NO |

**What Step 3 does NOT alert on (not required for beta):**
- API Gateway process crash (PM2 restarts it; runbook exists for manual escalation)
- Redis down (desirable but not required — see gap classification)
- AI Service crash (PM2 restarts it; execution will fail which becomes visible in usage_records)
- Provider failure (visible in usage_records)

---

## 15. Step 3 Runtime / Staging Validation Plan

| Validation | Method | Runtime action required? |
|------------|--------|--------------------------|
| Unit tests pass | `npm test` in `services/api-gateway` | NO (local) |
| TypeScript compiles | `npx tsc --noEmit` in `services/api-gateway` | NO (local) |
| `npm run build` passes | API Gateway build | NO (local) |
| Alert email delivery (staging smoke) | Set `OPERATOR_ALERT_RECIPIENT`, trigger a test alert by temporarily returning `databaseConnectivity=false` in a controlled way, or by calling the service directly | YES — requires Keith SSH action to set env var and restart PM2 api-gateway; then trigger test condition |

**Runtime/staging action required: YES — limited to:**
1. Keith adds `OPERATOR_ALERT_RECIPIENT` env var to `/opt/aisandbox/.env`
2. Keith runs `pm2 restart api-gateway`
3. Controlled test: momentarily confirm alert triggers (can use existing verify script pattern)

**This is minimal runtime action (env var + restart). No database changes, no Docker changes, no schema changes.**

---

## 16. Rollback Plan

| Step | Rollback action |
|------|----------------|
| Step 3 code deploy fails to build | `git revert` — no runtime impact (service unchanged) |
| Staging restart causes unexpected behavior | `pm2 restart api-gateway` restores prior state; operator alert feature is non-critical-path (additive only) |
| Alert emails are noisy or incorrect | Set `OPERATOR_ALERT_ENABLED=false` in `.env` and restart api-gateway |
| `OPERATOR_ALERT_RECIPIENT` incorrectly set | Correct env var and restart api-gateway — no data impact |

The operator alert service is **entirely additive and non-intrusive** — it runs on a separate interval, does not touch any existing service logic, and its failure (if any) does not affect API Gateway request handling.

---

## 17. Safety Constraints for Step 3

1. **No modification of existing health endpoints** — health controller is LOCKED behavior
2. **No modification of RuntimeService** — read usage only; no mutation
3. **No changes to auth, session, CSRF, or credit flows**
4. **No changes to GLOBAL_EXECUTION_ENABLED** — remains false
5. **No new npm packages** — Resend already installed
6. **No external monitoring vendor**
7. **No changes to Docker files, PM2 config, Caddy, database, or migrations**
8. **No modification of InternalServiceAuthGuard or RuntimeController**
9. **Operator alert service must fail silently** — email failure must never crash API Gateway or affect request handling
10. **Single cooldown per condition per 15 minutes** — do not spam Keith's inbox

---

## 18. Acceptance Criteria for Step 3

| # | Criterion | How to verify |
|---|-----------|--------------|
| 1 | `OperatorAlertService` injects `RuntimeService` and `EMAIL_PROVIDER` | Source inspection |
| 2 | Alert triggers on `databaseConnectivity === false` for 2 consecutive checks | Unit test |
| 3 | Alert triggers on `dockerConnectivity === false` for 2 consecutive checks | Unit test |
| 4 | Alert does not re-fire within 15-minute cooldown window | Unit test |
| 5 | No alert fires if `OPERATOR_ALERT_RECIPIENT` is not configured | Unit test |
| 6 | No alert fires if `OPERATOR_ALERT_ENABLED=false` | Unit test |
| 7 | Alert email failure does not throw or crash API Gateway | Unit test (mock Resend throwing) |
| 8 | `npm test` passes (api-gateway) | Validation command |
| 9 | `npx tsc --noEmit` passes (api-gateway) | Validation command |
| 10 | `npm run build` passes (api-gateway) | Validation command |
| 11 | Email delivery confirmed on staging (manual smoke) | Keith SSH + pm2 restart + test trigger |
| 12 | No existing test IDs changed | Diff review |
| 13 | No files outside `operator-alert/` module and `app.module.ts` modified | Diff review |
| 14 | `GLOBAL_EXECUTION_ENABLED` unchanged | Confirmation |

---

## 19. Items Requiring Keith Approval Before Step 3

| Item | Nature | Required before |
|------|--------|----------------|
| `OPERATOR_ALERT_RECIPIENT` — the email address to receive operator alerts | New env var on staging; Keith must provide the recipient address | Step 3 implementation start |
| `OPERATOR_ALERT_ENABLED` — optional feature flag | Recommended to set `true` | Step 3 staging smoke |

**No new external service, no new vendor, no new production credential (existing RESEND_API_KEY used), no material new infrastructure.**

Keith approval is required for the recipient email address configuration only. The implementation approach (Option B — reuse Resend) does not require Keith approval beyond that.

---

## 20. Step 3 — Bounded Scope Confirmation

**Code changes needed: YES** — one new injectable service + one new module + one app.module.ts registration.

**Runtime/staging actions needed: YES** — limited to:
- Keith adds one env var (`OPERATOR_ALERT_RECIPIENT`) to `/opt/aisandbox/.env`
- Keith runs `pm2 restart api-gateway`
- One controlled validation of email delivery

**New external vendor: NO**

**New external monitoring service: NO**

**Architecture refactor: NO**

**New dependency (npm): NO** — Resend already installed

**Scope is bounded, reversible, and additive.**

---

## 21. Confirmation: No Implementation or Runtime Action Occurred in Step 2

- [x] No source files modified
- [x] No test files modified
- [x] No translation files modified
- [x] No migration files modified or run
- [x] No database accessed or modified
- [x] No staging / .env / runtime action taken
- [x] No services restarted
- [x] GLOBAL_EXECUTION_ENABLED not changed and remains false
- [x] No provider calls made
- [x] No SSH / AWS CLI / PM2 / systemd / Caddy action
- [x] No Docker / PostgreSQL / Redis command run
- [x] No terminal/runtime commands run
- [x] No git commit or push
- [x] No subagents used
- [x] PRIVATE-BETA-INVITE-01 untouched
- [x] No new tasks registered
- [x] TASKS.md not modified
- [x] TASKS_BACKLOG_FULL.md not modified
- [x] ARCHITECTURE.md not modified
- [x] PRD.md not modified
- [x] CLAUDE.md not modified
- [x] All COMPLETE AND LOCKED predecessor checkpoints preserved

---

## 22. Next Step

**PRIVATE-BETA-OPS-01 Step 3 — Minimal Operational Visibility Implementation + Controlled Validation**

**Prerequisites before starting Step 3:**
1. Keith provides `OPERATOR_ALERT_RECIPIENT` email address (the only required approval item)
2. Open a new Cursor window (per CLAUDE.md new-window rules — Step 3 is an implementation step)
3. Use GPT-5.3 Codex (per CLAUDE.md model guidance — routine bounded backend implementation)

**Step 3 deliverables:**
- `services/api-gateway/src/operator-alert/operator-alert.service.ts`
- `services/api-gateway/src/operator-alert/operator-alert.module.ts`
- `services/api-gateway/src/app.module.ts` (registration only)
- Unit tests for OperatorAlertService
- Staging smoke confirmation (email delivered)

---

*Stage-start created: 2026-08-10 — PRIVATE-BETA-OPS-01 Step 2.*
*Zero implementation, runtime, test, configuration, schema, migration, environment, or Docker changes occurred.*

---
---

# STEP 2A — Architecture Correction: Failure-Domain Analysis and Monitoring Redesign

**Task ID:** PRIVATE-BETA-OPS-01
**Step:** 2A — Architecture Correction (appended to Step 2 Stage-Start)
**Status:** COMPLETE (read-only correction audit; this section is the sole output)
**Date:** 2026-08-10
**Author:** Cursor / Opus 4.6
**Nature:** READ-ONLY ARCHITECTURE CORRECTION — no source, test, runtime, config, env, Docker, or deployment changes
**Trigger:** Step 2 recommended an `OperatorAlertService` running inside API Gateway. That design cannot satisfy the task's central requirement because it shares the same failure domain as the service whose crash it must detect.

---

## 2A-1. Previous Recommendation Verdict

### Previous Option B — API-Gateway-hosted `OperatorAlertService`

**Verdict: INSUFFICIENT**

**Reasoning:**

| Failure Scenario | Can In-Process Monitor Detect? | Why |
|------------------|-------------------------------|-----|
| API Gateway process crash | **NO** | Monitor runs inside API Gateway. Process death kills the monitor. |
| API Gateway hang / OOM | **NO** | A hung process cannot execute its own interval timer. |
| Frontend (Next.js) crash | **NO** | No check for frontend was included. |
| AI Service / WorkerProcessor crash | **NO** | No check for AI Service was included. |
| container-manager crash | **PARTIALLY** | `dockerConnectivity=false` occurs when container-manager is unreachable, but this signal was attributed to Docker daemon failure, not CM process death. |
| Redis / BullMQ failure | **NO** | Explicitly excluded from Step 2 scope. No Redis check in any health endpoint. |
| PostgreSQL failure | **YES** | `databaseConnectivity=false` via internal `RuntimeService` call. Works while API Gateway is alive. |
| Docker daemon failure | **YES** | `dockerConnectivity=false` via internal `RuntimeService` call. Works while API Gateway is alive. |

**Summary:** The in-process monitor detects 2 of 6 critical failure categories, and ONLY while the host process (API Gateway) is itself alive. The single most important failure — API Gateway crash — is fundamentally undetectable by a monitor embedded inside it.

**Failure-domain principle violated:** A monitoring mechanism must not share the exact same failure domain as the service whose complete outage it must detect.

**The Step 2 recommendation is not preserved. Step 3 must use a corrected architecture.**

---

## 2A-2. Failure-Domain Analysis

### Principle

If Process A must detect that Process B has crashed, A and B must not share a single point of failure that kills both simultaneously.

**Corollary:** An in-process monitor inside API Gateway can detect failures of API Gateway's *downstream dependencies* (PostgreSQL, Docker) but can NEVER detect API Gateway's own death.

### Failure domain map for staging (`staging.ainow.biz` — single AWS Lightsail VPS, PM2 7.0.3)

| Component | PM2 process name | Port | Failure domain | Can a monitor inside API Gateway detect crash? |
|-----------|-----------------|------|----------------|------------------------------------------------|
| Frontend (Next.js) | `frontend` | 3002 | Own PM2 process | NO — not checked |
| API Gateway (NestJS) | `api-gateway` | 4000 | Own PM2 process | **NO — same process** |
| AI Service (NestJS) | `ai-service` | 4001 | Own PM2 process | NO — not checked |
| container-manager (NestJS) | `container-manager` | 4002 | Own PM2 process | PARTIAL — dockerConnectivity only |
| PostgreSQL | System service | 5432 | OS service | YES — via `SELECT 1` |
| Redis | System service | 6379 | OS service | NO — not checked |
| Caddy (reverse proxy) | System service | 443 | OS service | NO — not checked |
| PM2 daemon | System daemon | N/A | OS service | N/A — if PM2 dies, all processes die; VPS reboot is the recovery |

### Required monitor placement

A monitor that must detect crashes of ALL application processes (frontend, api-gateway, ai-service, container-manager) must run **outside** all of those processes — as an independent process managed by PM2.

---

## 2A-3. Critical Services Requiring Active Detection

For the 1–3 trusted user Builder beta, the following failures require active notification to Keith:

| # | Component | User Impact on Failure | Detection Signal Available | Detection Method |
|---|-----------|----------------------|---------------------------|------------------|
| 1 | **API Gateway** | All API calls fail; 502/504 from Caddy; auth fails; execution fails | `GET http://localhost:4000/api/health/ready` — 200 = alive, 503 = degraded, ECONNREFUSED = dead | HTTP probe from independent process |
| 2 | **AI Service / WorkerProcessor** | AI execution requests queue but never complete; users see hung executions | `GET http://localhost:4001/metrics` — 200 = alive (Prometheus endpoint exists, confirmed in source), ECONNREFUSED = dead | HTTP probe from independent process |
| 3 | **Frontend** | Users cannot reach the product at all | `GET https://staging.ainow.biz` — 200/3xx = alive, timeout/ECONNREFUSED = dead | HTTPS probe from independent process (also validates Caddy + DNS + TLS) |
| 4 | **PostgreSQL** | All persistent state unavailable | Covered transitively: if API Gateway is up AND `/api/health/ready` returns 200, PostgreSQL is alive (readiness check runs `SELECT 1`). If API Gateway is down, that is already a P1 alert. | Transitive via API Gateway readiness |
| 5 | **container-manager** | Sessions cannot be created or managed; workspace operations fail | `GET http://localhost:4002/api/health` — 200 = alive, ECONNREFUSED = dead | HTTP probe from independent process |
| 6 | **Redis / BullMQ** | AI execution silently fails; queue builds up; streaming broken | `REDIS_URL` from env → TCP connect + Redis PING via Node.js `net` module | Direct TCP probe from independent process |

### PostgreSQL coverage rationale

PostgreSQL does NOT require a separate direct probe. The watchdog already checks API Gateway readiness (`/api/health/ready`), which executes `SELECT 1`. Two outcomes:

- API Gateway UP + readiness 200 → PostgreSQL is alive
- API Gateway UP + readiness 503 → PostgreSQL is likely down (or env/config issue) — alert fires for readiness failure
- API Gateway DOWN → alert fires for API Gateway — PostgreSQL state is moot until API Gateway is restored

Adding a direct PostgreSQL probe would require the watchdog to know `DATABASE_URL` (a secret with password), parse it, and open a TCP/pg connection. This adds complexity for zero incremental detection value at this scale.

### Redis coverage rationale

Redis DOES require a direct probe. No existing HTTP endpoint checks Redis. API Gateway readiness does NOT check Redis. AI Service has no health endpoint. The only way to detect Redis failure is a direct connection attempt.

The watchdog can parse `REDIS_URL` from env (format: `redis://:PASSWORD@localhost:6379`), extract host/port/password, and perform a TCP-level Redis AUTH + PING using Node.js built-in `net` module. This avoids any npm dependency.

---

## 2A-4. Smallest Safe Monitoring Architecture

### Selection: Out-of-Process PM2-Managed Watchdog

A standalone Node.js script (`monitoring/watchdog/ops-watchdog.js`) managed by PM2 as an independent process, separate from all application services.

### Why this is the smallest safe option

| Property | Explanation |
|----------|-------------|
| Independent failure domain | Runs as its own PM2 process; crash of any application process does NOT kill the watchdog |
| Zero new npm dependencies | Uses Node.js built-in `fetch()` (Node 18+, confirmed on staging) for Resend API, `http` module for localhost probes, `https` module for frontend probe, `net` module for Redis TCP PING |
| Reuses existing Resend | Calls Resend REST API (`POST https://api.resend.com/emails`) directly with `fetch()` using the existing `RESEND_API_KEY` and `AUTH_EMAIL_FROM` from env |
| Reuses existing env | Reads from same `/opt/aisandbox/.env` via PM2 env inheritance or dotenv-style parsing |
| PM2 auto-restart | If the watchdog itself crashes, PM2 restarts it (brief blind spot during restart only) |
| No NestJS / no DI / no module system | Plain Node.js script; ~150–250 lines; no framework overhead |
| No new external vendor | Resend already paid for and configured |
| No new secrets | Reuses `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `REDIS_URL`; only `OPERATOR_ALERT_RECIPIENT` is new (not a secret — it's Keith's email address) |
| Additive and non-intrusive | Does not modify any application service; does not touch any existing module, controller, or test |
| Trivially removable | `pm2 delete ops-watchdog` — zero application code change required to remove |

### Why this survives target-process crashes

| Failure | Watchdog behavior |
|---------|------------------|
| API Gateway crashes | Watchdog is a separate PM2 process. Detects via `http://localhost:4000/api/health/ready` → ECONNREFUSED. Sends alert. |
| AI Service crashes | Watchdog detects via `http://localhost:4001/metrics` → ECONNREFUSED. Sends alert. |
| Frontend crashes | Watchdog detects via `https://staging.ainow.biz` → timeout/error. Sends alert. |
| container-manager crashes | Watchdog detects via `http://localhost:4002/api/health` → ECONNREFUSED. Sends alert. |
| PostgreSQL crashes | API Gateway readiness returns 503 (detected) OR API Gateway also crashes (detected). |
| Redis crashes | Watchdog detects via direct TCP PING failure. Sends alert. |
| Watchdog itself crashes | PM2 auto-restarts it. Brief blind spot (~seconds). Acceptable for 1–3 user beta. |
| PM2 daemon crashes | All processes die. VPS-level systemd restart of PM2 is the mitigation (`pm2 startup` already configured). |
| VPS crashes | AWS Lightsail auto-reboot / manual Keith action. Out of scope for application-level monitoring. |

---

## 2A-5. Options Evaluated

### Option A — Existing PM2-native mechanism

| Aspect | Finding |
|--------|---------|
| PM2 OSS crash notification | **NOT AVAILABLE.** PM2 free/OSS does not have built-in email, webhook, or push notification on process crash. |
| PM2 Plus / Keymetrics | Paid service. Not installed. Not justified for 1–3 user beta. |
| PM2 modules (e.g. `pm2-logrotate`) | Log rotation only. No crash notification module in free tier. |
| PM2 programmatic API | Available via `pm2` npm package. Could be used by an external script to query process list. However, HTTP probes are more reliable (detect process alive but unresponsive). |
| PM2 ecosystem.config.js | No ecosystem file exists in repo. Could be created but doesn't solve notification. |

**Verdict:** PM2 OSS cannot actively notify Keith of crashes. However, PM2 CAN manage the watchdog process (auto-restart, lifecycle). PM2 is the lifecycle manager, not the notification mechanism.

### Option B — Small out-of-process local watchdog (SELECTED)

See Section 2A-4 above. This is the recommended approach.

### Option C — Existing external monitoring mechanism already present

| Aspect | Finding |
|--------|---------|
| Phase 60 alerting | **DOCUMENTATION ONLY.** Zero code implemented. Phase 60 produced design docs and runbooks. No alert evaluation logic, no background checker, no notification path exists. |
| Prometheus / Alertmanager | Config files present in `monitoring/` directory but Prometheus is NOT running on staging. Activating the full Prometheus + Alertmanager stack on a single VPS for 1–3 users is disproportionate. |
| External uptime service | None configured. No evidence of UptimeRobot, Pingdom, or similar. |
| AWS CloudWatch / Lightsail alerts | Lightsail has basic instance-level monitoring (CPU/network) but does not have application-level health checking. No CloudWatch alarms are documented. |

**Verdict:** No existing external monitoring mechanism is operational. Nothing to reuse.

### Option D — External monitoring vendor

| Aspect | Finding |
|--------|---------|
| UptimeRobot (free tier) | Could check `https://staging.ainow.biz` and `/api/health/ready` from external. 5-minute check interval on free tier. Cannot check internal services (localhost ports), Redis, or PM2 state. |
| Datadog / New Relic / Sentry | Massively disproportionate for 1–3 users. |
| BetterUptime / Checkly | Reasonable but introduces a new vendor, new account, new credential. |

**Verdict:** Not required. The out-of-process watchdog covers all critical services without any external vendor. If Keith later wants external monitoring, it can be added alongside (not instead of) the local watchdog.

---

## 2A-6. Signal Sources for Each Critical Component

| # | Component | Signal | Endpoint/Method | Success | Failure | Debounce |
|---|-----------|--------|-----------------|---------|---------|----------|
| 1 | API Gateway | HTTP readiness | `GET http://localhost:4000/api/health/ready` | 200 | 503, timeout, ECONNREFUSED | 2 consecutive failures (~2 min) |
| 2 | AI Service | HTTP liveness | `GET http://localhost:4001/metrics` | 200 (Prometheus text) | timeout, ECONNREFUSED | 2 consecutive failures (~2 min) |
| 3 | Frontend | HTTPS reachability | `GET https://staging.ainow.biz` | 200 or 3xx | timeout, ECONNREFUSED, 5xx | 3 consecutive failures (~3 min) — higher threshold because Caddy/DNS transient issues are possible |
| 4 | container-manager | HTTP liveness | `GET http://localhost:4002/api/health` | 200 | timeout, ECONNREFUSED | 2 consecutive failures (~2 min) |
| 5 | PostgreSQL | Transitive | Covered by API Gateway readiness (runs `SELECT 1`) | readiness 200 implies DB alive | readiness 503 alerts for readiness failure | N/A — covered by signal #1 |
| 6 | Redis | TCP PING | `net.connect()` to Redis host:port → `AUTH password\r\nPING\r\n` → expect `+PONG` | `+PONG` received | connect failure, timeout, wrong response | 2 consecutive failures (~2 min) |

### AI Service signal choice rationale

The AI Service has no `HealthController` (confirmed in Step 2 audit). However, it DOES expose `GET /metrics` (Prometheus text format, `PrometheusMetricsController`, excluded from `/api` prefix). This endpoint:

- Exists and responds with 200 when the process is alive
- Returns Prometheus text exposition format (not JSON)
- Requires no authentication
- Is on port 4001 (internal only — not exposed externally, but accessible from localhost)

This is the most reliable available HTTP liveness signal for AI Service. Adding a proper `HealthController` to AI Service is desirable but NOT required for the beta watchdog — the `/metrics` endpoint serves the same "is the process alive and responding to HTTP?" function.

### Frontend signal choice rationale

Checking `https://staging.ainow.biz` (public URL) rather than `http://localhost:3002` is preferable because:

- It validates the entire path: DNS → Caddy TLS termination → reverse proxy → Next.js process
- If the frontend process crashes, this URL will fail (Caddy returns 502)
- If Caddy crashes, this URL will also fail — which is equally important to detect
- A `localhost:3002` check would miss Caddy/DNS failures

The tradeoff is that transient DNS/network issues could cause false positives. The 3-failure debounce mitigates this.

---

## 2A-7. Redis / BullMQ Coverage

### Current state

- **Zero visibility.** No health endpoint in any service checks Redis connectivity.
- API Gateway startup guard logs a warning about Redis but does not validate it.
- API Gateway readiness (`/api/health/ready`) does NOT check Redis.
- AI Service `QueueMetricsUpdater` updates Prometheus gauges from BullMQ queue state, but Prometheus is not running on staging and the gauges are internal-only.

### Recommended approach

The watchdog performs a direct TCP-level Redis PING:

1. Parse `REDIS_URL` from environment (format: `redis://:PASSWORD@HOST:PORT`)
2. Open TCP connection via Node.js `net.createConnection(port, host)`
3. Send `AUTH <password>\r\nPING\r\n` (RESP inline format)
4. Expect response containing `+PONG`
5. Close connection
6. If connection fails, times out, or does not return PONG → increment failure counter

**Why not extend `/api/health/ready` to check Redis?** That would be a valuable improvement but:
- It modifies the existing health controller (LOCKED behavior per Step 2 safety constraints)
- It only works while API Gateway is alive (doesn't help if API Gateway is also down)
- The watchdog already checks Redis directly, making the endpoint change redundant for alerting purposes

**Why not use `ioredis`?** The `ioredis` package is installed in api-gateway and ai-service `node_modules/`, but the watchdog should not reach into another service's `node_modules`. A raw TCP PING avoids any dependency. Redis RESP protocol PING is trivial (~20 lines of Node.js).

### BullMQ queue state

BullMQ queue health is implied by Redis health + AI Service process health:
- Redis alive + AI Service alive → BullMQ worker is connected and processing
- Redis dead → BullMQ cannot function → alert fires for Redis
- AI Service dead → worker is not processing → alert fires for AI Service

Direct BullMQ queue depth/stalled job monitoring is desirable but NOT required for the beta. Queue failures will manifest as hung user executions, visible in `usage_records` and user-reported.

---

## 2A-8. AI Worker Coverage

### Current state

- No HTTP health endpoint (`HealthController`) in AI Service
- `GET /metrics` (Prometheus) exists — returns 200 when process alive
- PM2 tracks `online` / `stopped` / `errored` status and restart count
- In-memory worker metrics (`execution_completed_total`, etc.) exist but are not externally queryable without `X-Internal-Service-Key`

### Recommended approach

The watchdog checks `GET http://localhost:4001/metrics`:
- 200 → AI Service process alive and responding
- ECONNREFUSED → process is dead
- Timeout → process may be hung/overloaded

This tells us the NestJS process is alive and accepting HTTP connections. It does NOT tell us the BullMQ worker is actively processing jobs (the worker could be connected but stuck). However, for a 1–3 user beta:

- PM2 auto-restarts crashed processes
- A fully stuck worker (alive but not processing) is a rare edge case
- Stuck execution detection already exists (`WorkerProcessor.scanForStuckExecutions()` runs on a 30-second interval internally)
- Users will report hung executions

**A dedicated AI Service health endpoint should be added later** (registered as follow-up, not in this task's scope) to check:
- Redis/BullMQ connection state
- Worker active/idle state
- Last successful execution timestamp

---

## 2A-9. Frontend Coverage

### Recommended approach

`GET https://staging.ainow.biz` is sufficient for this cohort.

- Validates full user-facing path: DNS → Caddy → Next.js
- HTTP 200 or 3xx (locale redirect) = frontend operational
- Timeout / connection error / 5xx = frontend or Caddy or DNS failure → alert
- 3-consecutive-failure debounce prevents transient false positives

No new endpoint required.

---

## 2A-10. Notification Mechanism

### Resend REST API via Node.js built-in `fetch()`

The watchdog sends alert emails by calling the Resend HTTP API directly:

```text
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json

{
  "from": "<AUTH_EMAIL_FROM>",
  "to": "<OPERATOR_ALERT_RECIPIENT>",
  "subject": "[aiSandBox ALERT] <component> — <condition>",
  "html": "<alert details with timestamp, component, consecutive failures>"
}
```

**Why not reuse `ResendEmailProvider` via NestJS DI?**
- The watchdog is a standalone Node.js script, not a NestJS application
- Importing NestJS DI would require bootstrapping the entire NestJS container — disproportionate for a watchdog
- The Resend REST API is trivial to call with `fetch()` — 10 lines of code
- The existing `RESEND_API_KEY` and `AUTH_EMAIL_FROM` env vars are reused directly

**Security:**
- `RESEND_API_KEY` is already in `/opt/aisandbox/.env` on staging
- The watchdog reads it from env, never logs it, never exposes it
- No new API key or Resend account needed

**Cooldown:**
- Same condition within 30 minutes → suppress (prevents inbox flooding)
- Different condition → send immediately
- Recovery (component comes back up) → send recovery notification
- Alert email failure → log error, do not crash watchdog

---

## 2A-11. Process / Lifecycle Mechanism

### PM2-managed independent process

| Aspect | Detail |
|--------|--------|
| Process name | `ops-watchdog` |
| Runtime | Node.js (same runtime as all services) |
| PM2 start command | `pm2 start /opt/aisandbox/monitoring/watchdog/ops-watchdog.js --name ops-watchdog --cwd /opt/aisandbox` |
| Auto-restart | Yes — PM2 default behavior restarts crashed processes |
| Check interval | 60 seconds (`setTimeout`-based loop, not `setInterval` — avoids overlapping checks) |
| Env loading | Inherits from shell session (same as other PM2 processes on staging) |
| Graceful shutdown | Clears timeout on SIGINT/SIGTERM |
| PM2 save | `pm2 save` after starting to persist across PM2 daemon restart |
| Startup persistence | Already configured via `pm2 startup` + `pm2 save` |

**Architecture constraint compliance:** ARCHITECTURE.md §15 "No cron / No schedulers" applies to AI execution queue workers and session maintenance. The watchdog is operational infrastructure monitoring, not application logic. Precedent: `OrphanReconciliationWorker` (setInterval, operational), `QueueMetricsUpdater` (setInterval, operational), `WorkerProcessor.scanForStuckExecutions` (setInterval, operational). The watchdog follows this established pattern but runs in a separate process for failure-domain independence.

**Why not cron?** A cron job could run a health check script periodically. However:
- The architecture has a no-cron posture
- A PM2-managed process is already the established lifecycle pattern
- The watchdog needs state across checks (consecutive failure counters, cooldown timers) — cron is stateless per invocation
- PM2 provides auto-restart, log capture, and process visibility for free

---

## 2A-12. Corrected Step 3 Implementation Scope

### Files to be created

| File | Action | Purpose |
|------|--------|---------|
| `monitoring/watchdog/ops-watchdog.js` | **CREATE** | Standalone Node.js watchdog script — checks all 6 critical services, sends Resend alert on sustained failure, cooldown/debounce, recovery notification |

### Files to be modified

| File | Action | Purpose |
|------|--------|---------|
| None | — | No existing source, test, config, or module files are modified |

### Files NOT created (correction from Step 2)

| File from Step 2 | Why removed |
|-------------------|-------------|
| `services/api-gateway/src/operator-alert/operator-alert.service.ts` | Architecture correction — in-process monitor is INSUFFICIENT |
| `services/api-gateway/src/operator-alert/operator-alert.module.ts` | Not needed — watchdog is standalone, not a NestJS module |
| `services/api-gateway/src/app.module.ts` modification | Not needed — no NestJS module to register |
| `services/api-gateway/src/__tests__/operator-alert.service.spec.ts` | Not needed — watchdog tested differently (see below) |

### Testing approach

The watchdog is a standalone script, not a NestJS injectable. Testing approach:

| Test type | Method |
|-----------|--------|
| Unit logic | Extract check functions and alert logic into testable functions within the script. Test with a small test file (`monitoring/watchdog/__tests__/ops-watchdog.test.js`) using Jest or plain Node.js `assert`. Mock `fetch()` and `net.createConnection()`. |
| Integration (staging) | Keith runs the watchdog via PM2 on staging. Verify it starts, runs check cycle, logs results. Stop one service temporarily, confirm alert email arrives. Restart service, confirm recovery email arrives. |

### What Step 3 does NOT do (unchanged)

- Does NOT modify health endpoints (LOCKED behavior)
- Does NOT modify runtime.service.ts or runtime.controller.ts
- Does NOT modify any existing tests
- Does NOT add a new npm dependency (uses Node.js built-in `fetch()`, `http`, `https`, `net`)
- Does NOT add Prometheus, Grafana, or any external monitoring vendor
- Does NOT modify Docker files, PM2 config, or existing .env template files
- Does NOT modify TASKS.md or governance docs
- Does NOT add an AI Service health endpoint (follow-up task)
- Does NOT extend `/api/health/ready` to check Redis (follow-up task)

### New environment variable required (Keith must provide before staging smoke)

| Variable | Purpose | Secret? | New credential? |
|----------|---------|---------|-----------------|
| `OPERATOR_ALERT_RECIPIENT` | Email address to receive operator alerts | No — it's Keith's email | No |

No other new env var, secret, or credential is required. The watchdog reuses:
- `RESEND_API_KEY` (already on staging)
- `AUTH_EMAIL_FROM` (already on staging)
- `REDIS_URL` (already on staging — used to parse Redis host/port/password for TCP PING)

---

## 2A-13. New Dependency / Vendor / Credential Requirements

| Question | Answer |
|----------|--------|
| New npm dependency required? | **NO** — uses only Node.js built-in modules (`http`, `https`, `net`, `url`, `fetch`) |
| New external vendor required? | **NO** — reuses existing Resend account |
| New credential / secret required? | **NO** — reuses `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `REDIS_URL` |
| New env var (non-secret) required? | **YES** — `OPERATOR_ALERT_RECIPIENT` (Keith's email address) |
| Keith must provide only an alert-recipient email or anything else? | **Only the alert-recipient email.** No other input needed. |

---

## 2A-14. Controlled Staging Validation Plan

| # | Validation | Method | Runtime action? |
|---|-----------|--------|-----------------|
| 1 | Watchdog script syntax / lint | `node --check monitoring/watchdog/ops-watchdog.js` | No (local) |
| 2 | Unit tests for check/alert logic | `node monitoring/watchdog/__tests__/ops-watchdog.test.js` (or Jest) | No (local) |
| 3 | Keith adds `OPERATOR_ALERT_RECIPIENT` to `/opt/aisandbox/.env` | SSH action by Keith | Yes — env var only |
| 4 | Keith deploys watchdog file to VPS | `git pull` or SCP | Yes — minimal |
| 5 | Keith starts watchdog via PM2 | `pm2 start /opt/aisandbox/monitoring/watchdog/ops-watchdog.js --name ops-watchdog --cwd /opt/aisandbox` | Yes — new PM2 process |
| 6 | Verify watchdog appears in `pm2 list` with `online` status | `pm2 list` | Yes — read-only |
| 7 | Verify check cycle runs (watchdog stdout logs) | `pm2 logs ops-watchdog --lines 20` | Yes — read-only |
| 8 | Controlled alert test: stop a non-critical service temporarily | `pm2 stop container-manager` → wait ~2 min → confirm alert email → `pm2 start container-manager` | Yes — controlled, reversible |
| 9 | Verify recovery notification | After restarting container-manager, confirm recovery email within next check cycle | Yes — read-only |
| 10 | Verify cooldown (same alert not repeated within 30 min) | Check watchdog logs for suppression message | Yes — read-only |
| 11 | `pm2 save` to persist watchdog | `pm2 save` | Yes — minimal |

**Total runtime actions:** Keith adds one env var, deploys one file, starts one PM2 process, performs one controlled stop/start test. No database, no Docker, no migration, no schema change.

---

## 2A-15. Rollback Plan

| Scenario | Rollback action | Impact |
|----------|----------------|--------|
| Watchdog fails to start | Check logs (`pm2 logs ops-watchdog`). Fix script or env. No application impact. | Zero — watchdog is additive |
| Watchdog sends false alerts | Adjust debounce/cooldown thresholds in script. `pm2 restart ops-watchdog`. | Zero — watchdog is additive |
| Watchdog is noisy/unwanted | `pm2 stop ops-watchdog` or `pm2 delete ops-watchdog`. `pm2 save`. | Zero — watchdog is additive |
| Watchdog crashes repeatedly | PM2 auto-restarts. If crash-looping, `pm2 stop ops-watchdog` and investigate. | Zero — watchdog is additive |
| Want to remove entirely | `pm2 delete ops-watchdog && pm2 save`. Optionally remove `monitoring/watchdog/` from repo. | Zero — no application code references watchdog |

**The watchdog is entirely additive and isolated.** It has no coupling to any application service. Its presence or absence does not affect any application behavior.

---

## 2A-16. Updated Step 3 Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|--------------|
| 1 | `monitoring/watchdog/ops-watchdog.js` created as standalone Node.js script | Source inspection |
| 2 | Watchdog checks API Gateway via `http://localhost:4000/api/health/ready` | Source inspection + unit test |
| 3 | Watchdog checks AI Service via `http://localhost:4001/metrics` | Source inspection + unit test |
| 4 | Watchdog checks Frontend via `https://staging.ainow.biz` | Source inspection + unit test |
| 5 | Watchdog checks container-manager via `http://localhost:4002/api/health` | Source inspection + unit test |
| 6 | Watchdog checks Redis via TCP PING parsed from `REDIS_URL` | Source inspection + unit test |
| 7 | Watchdog sends alert email via Resend REST API on sustained failure (2+ consecutive for services, 3+ for frontend) | Unit test with mocked `fetch()` |
| 8 | Watchdog sends recovery email when component recovers | Unit test |
| 9 | Watchdog suppresses repeat alerts within 30-minute cooldown | Unit test |
| 10 | Watchdog does not start checking if `OPERATOR_ALERT_RECIPIENT` is not configured | Unit test |
| 11 | Watchdog logs structured JSON for each check cycle | Source inspection |
| 12 | Alert email failure does not crash watchdog | Unit test (mock `fetch()` throwing) |
| 13 | `node --check monitoring/watchdog/ops-watchdog.js` passes | Validation command |
| 14 | Unit tests pass | Validation command |
| 15 | No existing files modified (zero-diff on application source) | `git diff` — only new files in `monitoring/watchdog/` |
| 16 | Email delivery confirmed on staging (manual smoke) | Keith SSH: start watchdog, stop a service, confirm email, restart service, confirm recovery email |
| 17 | `GLOBAL_EXECUTION_ENABLED` unchanged | Confirmation |
| 18 | PRIVATE-BETA-INVITE-01 untouched | Confirmation |

---

## 2A-17. Confirmation Checklist

- [x] Previous recommendation verdict delivered: **INSUFFICIENT**
- [x] Failure-domain analysis completed
- [x] Critical services requiring active detection identified (6 components)
- [x] Smallest safe monitoring architecture defined (out-of-process PM2-managed watchdog)
- [x] Crash survival analysis completed for all failure scenarios
- [x] Signal sources identified for each critical component
- [x] Redis/BullMQ coverage addressed (direct TCP PING)
- [x] AI Worker coverage addressed (`GET /metrics` probe)
- [x] Frontend coverage addressed (`GET https://staging.ainow.biz`)
- [x] Notification mechanism defined (Resend REST API via `fetch()`)
- [x] Process/lifecycle mechanism defined (PM2-managed, `setTimeout` loop)
- [x] Step 3 files identified: `monitoring/watchdog/ops-watchdog.js` + tests
- [x] No new npm dependency required
- [x] No new external vendor required
- [x] No new credential/secret required (reuses existing `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `REDIS_URL`)
- [x] Keith must provide only `OPERATOR_ALERT_RECIPIENT` (alert-recipient email address)
- [x] Controlled staging validation plan defined
- [x] Rollback plan defined
- [x] Updated Step 3 acceptance criteria defined
- [x] **No implementation or runtime action occurred** — this is a read-only correction document
- [x] **GLOBAL_EXECUTION_ENABLED unchanged** — remains false
- [x] **PRIVATE-BETA-INVITE-01 untouched**

---

## 2A-18. Step 2 Evidence Preserved

All Step 2 (Sections 1–22) content above is preserved intact. Step 2 evidence remains valuable:
- Health endpoint audit (Sections 3–4) — accurate and reused by watchdog signal selection
- PM2 visibility findings (Section 5) — accurate and confirms PM2 cannot notify
- Phase 60 audit (Section 6) — accurate and confirms no existing implementation
- Resend reuse findings (Section 7) — accurate and confirmed reusable
- Critical service visibility matrix (Section 10) — accurate, extended by 2A
- Gap classification (Section 12) — accurate

Only the Step 2 **recommended solution** (Section 13: API-Gateway-hosted `OperatorAlertService`) and its downstream implications (Sections 14–18 acceptance criteria, file list, scope) are **superseded** by this Step 2A correction.

---

*Step 2A correction created: 2026-08-10 — PRIVATE-BETA-OPS-01.*
*Zero implementation, runtime, test, configuration, schema, migration, environment, Docker, or deployment changes occurred.*
*GLOBAL_EXECUTION_ENABLED remains false.*
*PRIVATE-BETA-INVITE-01 remains untouched.*

---

**READY FOR STEP 3**
