# Production Deployment Validation

**Phase:** PHASE-56  
**Stage:** STAGE-56A  
**Task:** TASK-56A — Production Deployment Validation  
**Authority:** PRD.md, ARCHITECTURE.md, PRODUCTION-DEPLOYMENT-RUNBOOK.md

---

## 1. Validation Overview

This document describes the validation procedure for the AI Sandbox Platform production deployment bundle created in Phase-55. The validation confirms that the full platform runs successfully using `docker-compose.prod.yml`.

**Scope:** Validation only. No execution logic, queue semantics, schema, or API contract changes. Only deployment configuration fixes are permitted if required.

**Platform components:**
- api-gateway
- ai-service
- container-manager
- frontend
- postgres
- redis
- prometheus
- grafana

**Expected outcome:** All services start, internal connectivity works, queue processing flows correctly, metrics are scraped, dashboards load, and alert rules are registered.

---

## 2. Service Startup Verification

### Procedure

```bash
# From repository root, with .env populated from .env.prod.example
docker compose -f docker-compose.prod.yml up -d --build
```

### Expected Result

All containers start and become healthy within their `start_period` and health check intervals.

| Service          | Container Name           | Health Check                         | Expected State |
|------------------|--------------------------|--------------------------------------|----------------|
| postgres         | aisandbox-postgres       | `pg_isready`                         | healthy        |
| redis            | aisandbox-redis          | `redis-cli ping`                     | healthy        |
| api-gateway      | aisandbox-api-gateway    | `GET /api/health` → 200              | healthy        |
| ai-service       | aisandbox-ai-service    | (no healthcheck in compose)          | running        |
| container-manager| aisandbox-container-manager | (no healthcheck in compose)      | running        |
| frontend         | aisandbox-frontend       | (no healthcheck in compose)          | running        |
| prometheus       | aisandbox-prometheus     | `GET /-/ready`                       | healthy        |
| grafana          | aisandbox-grafana        | `GET /api/health`                    | healthy        |

### Verification Commands

```bash
# List all containers and health status
docker compose -f docker-compose.prod.yml ps

# Inspect health of a specific service
docker inspect --format='{{.State.Health.Status}}' aisandbox-postgres
docker inspect --format='{{.State.Health.Status}}' aisandbox-api-gateway
```

### Pass Criteria

- All 8 services show `running` or `healthy`.
- No container restarts in a 60-second window after startup.

---

## 3. Service Connectivity Verification

### Internal Connectivity Assumptions

| From            | To                    | Purpose                                      |
|-----------------|-----------------------|----------------------------------------------|
| api-gateway     | ai-service            | Queue execution requests, receive results    |
| api-gateway     | postgres              | Session, ledger, quota data                  |
| api-gateway     | redis                 | Rate limiting, caching (if used)             |
| api-gateway     | container-manager     | Session lifecycle (start/stop/error)         |
| ai-service      | redis                 | BullMQ queue (enqueue, process jobs)         |
| ai-service      | postgres              | Worker ledger (usage_records)                |
| ai-service      | api-gateway           | Internal callbacks, status updates           |
| ai-service      | container-manager     | Session context for execution                |
| container-manager| api-gateway           | Internal session lifecycle, git checkpoints |
| prometheus      | ai-service:4001       | Scrape `/metrics`                            |
| grafana         | prometheus:9090       | Query metrics for dashboards                 |

### Verification Procedure

1. **api-gateway → ai-service**
   - Trigger an AI execution via `POST /api/ai/execute` (or equivalent).
   - Expect job to be queued and processed.

2. **api-gateway → postgres**
   - `curl http://localhost:4000/api/health` returns DB connectivity status.

3. **api-gateway → redis**
   - Health endpoint reflects Redis connectivity.

4. **ai-service → redis**
   - Jobs appear in BullMQ queue; workers process them.

5. **ai-service → postgres**
   - Worker records execution in `usage_records` (ledger).

6. **prometheus → ai-service:4001**
   - Prometheus target `aisandbox-ai-service` shows `UP` in Prometheus UI.

7. **grafana → prometheus:9090**
   - Grafana datasource `Prometheus` (url: `http://prometheus:9090`) returns data.

### Pass Criteria

- Health endpoint reports DB and Redis OK.
- At least one successful execution flow (client → api-gateway → ai-service → result).
- Prometheus scrapes ai-service metrics.
- Grafana can query Prometheus.

---

## 4. Execution Flow Verification

### High-Level Flow

```
Client → api-gateway (POST /api/ai/execute)
    → api-gateway enqueues job to Redis (BullMQ)
    → ai-service worker claims job
    → ai-service calls provider adapter (AI_PROVIDER)
    → Result returned to client (via polling or callback)
    → Execution recorded in ledger (postgres)
```

### Verification Steps

1. Create a session: `POST /api/sessions`
2. Submit AI execution: `POST /api/ai/execute` with session context
3. Confirm job is queued (Redis) and processed (ai-service worker)
4. Confirm result returned to client
5. Confirm `usage_records` (or equivalent) updated in postgres

### Pass Criteria

- End-to-end execution completes without error.
- Ledger reflects the execution.

---

## 5. Metrics & Monitoring Verification

### Prometheus Target

- **Job:** `aisandbox-ai-service`
- **Target:** `http://ai-service:4001/metrics`
- **Config:** `monitoring/prometheus/prometheus.yml`

### Expected Metrics (from ai-service)

| Metric                               | Type      | Purpose                          |
|--------------------------------------|-----------|----------------------------------|
| `aisandbox_execution_started_total`   | counter   | Executions started               |
| `aisandbox_execution_completed_total`| counter   | Executions completed             |
| `aisandbox_execution_failed_total`   | counter   | Executions failed                |
| `aisandbox_execution_latency_seconds` | histogram | End-to-end execution latency     |
| `aisandbox_queue_waiting_jobs`       | gauge     | Jobs waiting in queue            |
| `aisandbox_queue_active_jobs`        | gauge     | Jobs currently processing        |
| `aisandbox_worker_claim_total`       | counter   | Worker job claims                |
| `aisandbox_worker_stuck_recovered_total` | counter | Stuck-job recoveries          |

### Verification

1. **Prometheus UI** (if port 9090 exposed):
   - Add `ports: ["9090:9090"]` to prometheus service in `docker-compose.prod.yml` if not already exposed.
   - Open `http://localhost:9090/targets`
   - Confirm `aisandbox-ai-service` target is `UP`.

2. **Grafana Explore** (always available):
   - Open `http://localhost:3001`
   - Login (default: admin / GRAFANA_ADMIN_PASSWORD)
   - Explore → Prometheus datasource
   - Run: `aisandbox_execution_started_total` or `aisandbox_queue_waiting_jobs`
   - Expect data (or at least metric definition) after some executions.

### Pass Criteria

- Prometheus target is UP.
- At least one of the expected metrics is present after execution activity.

---

## 6. Grafana Dashboards Verification

### Access

- **URL:** `http://localhost:3001`
- **Credentials:** `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from `.env`

### Expected Dashboards

| Dashboard          | File                                   | Panels / Purpose                    |
|--------------------|----------------------------------------|-------------------------------------|
| Execution Overview | `monitoring/grafana/dashboards/execution-overview.json` | Started, completed, failed, cancelled rates |
| Queue Health       | `monitoring/grafana/dashboards/queue-health.json`       | Waiting, active jobs, lag P95       |
| Worker Activity    | `monitoring/grafana/dashboards/worker-activity.json`    | Worker claims, stuck recoveries     |
| Latency            | `monitoring/grafana/dashboards/latency.json`            | Execution and provider latency      |

### Verification Steps

1. Login to Grafana.
2. Navigate to Dashboards.
3. Open each dashboard listed above.
4. Confirm panels load without error (data may be empty if no traffic).

### Pass Criteria

- All four dashboards load.
- No datasource or query errors in panels.

---

## 7. Alert System Verification

### Alert Rules File

- **Path:** `monitoring/prometheus/alerts/aisandbox-alerts.yml`
- **Mounted:** `/etc/prometheus/alerts/` in Prometheus container

### Expected Alert Group

**Group:** `aisandbox.rules`

| Alert Name                  | Condition                                                       | Purpose                    |
|-----------------------------|-----------------------------------------------------------------|----------------------------|
| AIExecutionFailureRateHigh  | `rate(aisandbox_execution_failed_total[5m]) > 0.1`              | Elevated failure rate      |
| AIExecutionLatencyHigh      | P95 `aisandbox_execution_latency_seconds` > 10s                 | Slow AI responses          |
| AIQueueBacklogHigh          | `aisandbox_queue_waiting_jobs > 50`                              | Queue depth too high       |
| AIQueueLagHigh              | P95 `aisandbox_queue_lag_seconds` > 5s                            | Jobs waiting too long      |
| AIWorkerStuckRecoverySpike  | `rate(aisandbox_worker_stuck_recovered_total[5m]) > 0.1`         | Frequent stuck recoveries  |

### Verification

1. **Prometheus Alerts UI** (if port 9090 exposed):
   - Open `http://localhost:9090/alerts`
   - Expand `aisandbox.rules`
   - Confirm all 5 alerts are listed (state: Inactive or Pending under normal load).

2. **Grafana Alerting** (alternative):
   - Grafana → Alerting → Alert rules
   - If Prometheus is configured as alertmanager, rules may appear here.

### Pass Criteria

- Alert group `aisandbox.rules` is loaded.
- All 5 alerts are registered and evaluable (no config errors).

---

## 8. Failure Mode Checklist

If validation fails, use this checklist to diagnose. **Fix only deployment configuration** (docker-compose, env, mounts). Do not change execution logic, queue behavior, schema, or API contracts.

| Failure Mode                         | Symptom                              | Fix (deployment config only)                    |
|--------------------------------------|--------------------------------------|-------------------------------------------------|
| Service container startup failure    | Container exits or restarts           | Check env vars, depends_on, healthcheck; fix .env or compose |
| Redis connectivity issues            | ai-service or api-gateway fails       | Verify REDIS_URL, REDIS_PASSWORD match redis command |
| Postgres connection misconfiguration | DB errors in api-gateway or ai-service| Verify DATABASE_URL, POSTGRES_* vars; ensure ai-service has DATABASE_URL if worker uses it |
| Prometheus target down               | Target `aisandbox-ai-service` DOWN    | Verify ai-service:4001 reachable from prometheus; check network |
| Grafana datasource error             | Dashboards show "datasource error"    | Verify prometheus url `http://prometheus:9090` in provisioning |
| Alert rules not loaded               | No aisandbox.rules in /alerts         | Verify volume mount: `./monitoring/prometheus/alerts:/etc/prometheus/alerts:ro` |
| Port not exposed                     | Cannot access Prometheus/Grafana from host | Add `ports: ["9090:9090"]` to prometheus if operator access needed |
| INTERNAL_SERVICE_KEY mismatch        | Internal API calls fail (401/403)     | Ensure identical INTERNAL_SERVICE_KEY in api-gateway, ai-service, container-manager |

---

## 9. Go-Live Readiness Checklist

Before declaring production deployment validated:

- [ ] All 8 services start and remain healthy
- [ ] api-gateway health returns 200 with DB and Redis OK
- [ ] At least one successful AI execution end-to-end
- [ ] BullMQ queue processes jobs (single or multi-worker)
- [ ] Ledger (usage_records) updated after execution
- [ ] Prometheus scrapes ai-service metrics (target UP)
- [ ] Grafana dashboards load (Execution Overview, Queue Health, Worker Activity, Latency)
- [ ] Alert group `aisandbox.rules` registered with all 5 alerts
- [ ] No deployment config issues from Failure Mode Checklist

---

## References

- `PRODUCTION-DEPLOYMENT-RUNBOOK.md` — Deployment steps and env vars
- `OBSERVABILITY-ALERTS.md` — Alert tuning and SLO alignment
- `SERVICE-LEVEL-OBJECTIVES.md` — SLO definitions and metric queries
