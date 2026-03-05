# AI Sandbox Platform — Operational Runbook

**Phase:** 54A  
**Purpose:** Guide operators in monitoring, triaging, and responding to production incidents.

---

## 1. System Overview

### Execution Engine

The AI Sandbox Platform runs AI-assisted code execution through a distributed pipeline:

- **ai-service** — Orchestrates AI execution requests. Receives work, enqueues jobs, and streams results via SSE.
- **Redis + BullMQ** — In-memory queue. Jobs wait here until a worker claims them.
- **PostgreSQL ledger** — Source of truth for execution state. Records started, completed, failed, and cancelled executions.
- **Workers** — ai-service processes that claim jobs from the queue, call AI providers, and update the ledger. Multiple workers can run in parallel.

### Observability Stack

| Component | Role |
|-----------|------|
| **Prometheus** | Scrapes metrics from ai-service every 15 seconds. Stores time-series data. |
| **Grafana** | Visualizes Prometheus metrics in dashboards. |
| **Alert rules** | Prometheus evaluates rules against metrics. Alerts fire when conditions persist for 5 minutes. |

---

## 2. Monitoring Workflow

### Normal Monitoring Process

1. **Check Grafana dashboards** — Confirm execution rates, queue depth, and latency look normal.
2. **Check Prometheus targets** — Ensure ai-service scrape target is UP.
3. **Check Prometheus alerts** — Verify no alerts are Pending or Firing.

### Key Dashboards

| Dashboard | Purpose |
|-----------|---------|
| Execution Overview | Started, completed, failed, cancelled rates |
| Queue Health | Queue depth, completion/failure rate, lag |
| Worker Activity | Worker claims, stuck recoveries |
| Latency | Execution P95, provider P95 |

**Grafana:** http://localhost:3000  
**Prometheus:** http://localhost:9090

### Example Prometheus Queries

| Query | Use |
|-------|-----|
| `aisandbox_execution_started_total` | Total executions started |
| `aisandbox_execution_failed_total` | Total executions failed |
| `aisandbox_queue_waiting_jobs` | Jobs waiting in queue |
| `aisandbox_queue_active_jobs` | Jobs currently being processed |
| `rate(aisandbox_execution_started_total[5m])` | Execution start rate over 5 minutes |

---

## 3. Alert Interpretation

All alerts use `for: 5m` — they fire only after the condition persists for 5 minutes.

### AIExecutionFailureRateHigh

- **Meaning:** Execution failures are occurring at an elevated rate (> 0.1 failures/second over 5 minutes).
- **Common causes:** AI provider errors, quota limits, network timeouts, invalid requests.
- **Initial steps:** Check Grafana Execution Overview for failure rate. Inspect ai-service logs for recent errors. Query `rate(aisandbox_execution_failed_total[5m])` in Prometheus.

### AIExecutionLatencyHigh

- **Meaning:** P95 execution latency exceeds 10 seconds.
- **Common causes:** Slow AI provider responses, high queue lag, overloaded workers.
- **Initial steps:** Check Latency dashboard. Compare execution vs provider latency. If provider latency is high, the AI provider may be slow or overloaded.

### AIQueueBacklogHigh

- **Meaning:** More than 50 jobs waiting in the execution queue.

- **Common causes:** Insufficient workers, burst of requests, slow workers.
- **Initial steps:** Check Queue Health dashboard. Inspect `aisandbox_queue_waiting_jobs` and `aisandbox_queue_active_jobs`. Consider adding workers.

### AIQueueLagHigh

- **Meaning:** P95 queue wait time (enqueue → worker claim) exceeds 5 seconds.
- **Common causes:** Queue backlog, too few workers, workers blocked on slow providers.
- **Initial steps:** Check Queue Health dashboard. Correlate with AIQueueBacklogHigh. If backlog is low but lag is high, workers may be stuck or slow.

### AIWorkerStuckRecoverySpike

- **Meaning:** Workers are frequently recovering stuck executions (> 0.1 recoveries/second over 5 minutes).
- **Common causes:** Worker crashes, long-running AI calls, Redis connectivity issues, container restarts.
- **Initial steps:** Check Worker Activity dashboard. Inspect worker logs for crashes or restarts. Verify Redis connectivity.

---

## 4. Incident Triage Process

### Severity Levels

| Level | Definition |
|-------|------------|
| **P1** | System unavailable. Users cannot execute. |
| **P2** | Degraded performance. High latency or failure rate. |
| **P3** | Non-critical anomaly. Monitor but no immediate action. |

### Triage Steps

1. **Identify alert** — Note which alert fired and when.
2. **Confirm via dashboards** — Use Grafana to verify the condition. Rule out false positives.
3. **Inspect queue state** — Check waiting and active job counts. High backlog suggests capacity or throughput issues.
4. **Inspect worker health** — Check worker claim rate and stuck recoveries. Look for worker restarts.
5. **Inspect recent deploys** — If a deploy occurred recently, consider rollback if the timeline matches.

---

## 5. Queue Backlog Investigation

**Related alerts:** AIQueueBacklogHigh, AIQueueLagHigh

### Check These Metrics

- `aisandbox_queue_waiting_jobs` — How many jobs are waiting.
- `aisandbox_queue_active_jobs` — How many jobs are in progress.

### Investigate

- **Worker count** — Are enough workers running? Each ai-service instance runs workers.
- **Provider latency** — If `aisandbox_provider_latency_seconds` is high, workers are blocked on AI calls.
- **Redis health** — Verify Redis is reachable and responsive. Queue depends on Redis.

### Possible Actions

- **Increase workers** — Add more ai-service replicas or increase worker concurrency.
- **Investigate slow providers** — Check AI provider status and latency.
- **Inspect stuck jobs** — If active jobs are high but not completing, workers may be stuck. Check for AIWorkerStuckRecoverySpike.

---

## 6. Execution Failure Investigation

**Related alert:** AIExecutionFailureRateHigh

### Investigate

- **Recent error logs** — Search ai-service logs for execution failures.
- **Provider responses** — Check if AI provider returns errors or timeouts.
- **Quota limits** — Verify user or platform quotas are not exceeded.
- **Network issues** — Confirm connectivity to AI provider and Redis.

### Prometheus Query

```
rate(aisandbox_execution_failed_total[5m])
```

Use this to see failure rate over time and correlate with other events.

---

## 7. Worker Crash Recovery

**Related alert:** AIWorkerStuckRecoverySpike

### How It Works

Workers detect stuck executions and recover them automatically. The stuck-job watchdog reassigns work so jobs are not lost. Recoveries are expected occasionally; a spike indicates instability.

### Investigate

- **Worker logs** — Look for crash stack traces, OOM, or unhandled exceptions.
- **Container restarts** — Check if ai-service containers are restarting (e.g., Docker, Kubernetes).
- **Redis connectivity** — Verify workers can reach Redis. Intermittent Redis issues can cause stuck jobs.

### Confirm Recoveries

Query in Prometheus:

```
aisandbox_worker_stuck_recovered_total
```

Or use the rate:

```
rate(aisandbox_worker_stuck_recovered_total[5m])
```

---

## 8. Scaling Guidance

### Primary Scaling Lever

**Increase ai-service workers.** Each ai-service instance runs workers that claim jobs from the queue. More workers increase throughput.

### Indicators for Scaling

- **High queue backlog** — `aisandbox_queue_waiting_jobs` consistently above threshold.
- **Increasing queue lag** — P95 `aisandbox_queue_lag_seconds` trending up.
- **High worker utilization** — Active jobs near worker capacity; workers always busy.

### Scaling Method

- **Increase container replicas** — Run more ai-service instances (e.g., `docker compose up --scale ai-service=3` or Kubernetes replicas).
- Each replica adds workers. Prometheus can scrape multiple instances; add targets in `prometheus.yml` if needed.

---

## 9. Operational Checklist

### Daily Checks

- [ ] Prometheus targets healthy (http://localhost:9090/targets)
- [ ] Grafana dashboards show normal patterns
- [ ] Queue backlog low (`aisandbox_queue_waiting_jobs` < 50)
- [ ] No alerts firing (http://localhost:9090/alerts)

### Weekly Checks

- [ ] Review latency trends in Latency dashboard
- [ ] Review failure rates in Execution Overview
- [ ] Review stuck recovery rate in Worker Activity
- [ ] Confirm alert thresholds remain appropriate for load

---

## 10. Metrics Reference

### Execution

| Metric | Type | Description |
|--------|------|-------------|
| `aisandbox_execution_started_total` | Counter | Total executions started |
| `aisandbox_execution_completed_total` | Counter | Total executions completed |
| `aisandbox_execution_failed_total` | Counter | Total executions failed |
| `aisandbox_execution_cancelled_total` | Counter | Total executions cancelled |

### Latency

| Metric | Type | Description |
|--------|------|-------------|
| `aisandbox_execution_latency_seconds` | Histogram | Total execution runtime |
| `aisandbox_provider_latency_seconds` | Histogram | AI provider call duration |

### Queue

| Metric | Type | Description |
|--------|------|-------------|
| `aisandbox_queue_waiting_jobs` | Gauge | Jobs waiting in queue |
| `aisandbox_queue_active_jobs` | Gauge | Jobs currently being processed |
| `aisandbox_queue_completed_jobs` | Gauge | Completed jobs (recent) |
| `aisandbox_queue_failed_jobs` | Gauge | Failed jobs (recent) |
| `aisandbox_queue_lag_seconds` | Histogram | Time from enqueue to worker claim |

### Worker

| Metric | Type | Description |
|--------|------|-------------|
| `aisandbox_worker_claim_total` | Counter | Worker job claims |
| `aisandbox_worker_stuck_recovered_total` | Counter | Stuck execution recoveries |

---

## Related Documentation

- `docs/OBSERVABILITY-PROMETHEUS.md` — Prometheus configuration
- `docs/OBSERVABILITY-GRAFANA.md` — Grafana dashboards
- `docs/OBSERVABILITY-ALERTS.md` — Alert rules and tuning
