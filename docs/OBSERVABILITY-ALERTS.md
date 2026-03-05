# Observability — Prometheus Alert Rules

**Phase:** 53C  
**Scope:** Alert rules only (no ai-service code changes)

---

## Overview

Prometheus evaluates alert rules against metrics scraped from ai-service. All alerts use `for: 5m` to avoid noisy firing on brief spikes.

**Alerts page:** http://localhost:9090/alerts

---

## Alert Rules

| Alert | Expression | Threshold | Meaning |
|-------|------------|-----------|---------|
| AIExecutionFailureRateHigh | `rate(aisandbox_execution_failed_total[5m]) > 0.1` | > 0.1 failures/sec | Elevated execution failure rate |
| AIExecutionLatencyHigh | P95 of `aisandbox_execution_latency_seconds` > 10 | > 10 s | Slow AI responses |
| AIQueueBacklogHigh | `aisandbox_queue_waiting_jobs > 50` | > 50 jobs | Queue depth too high |
| AIQueueLagHigh | P95 of `aisandbox_queue_lag_seconds` > 5 | > 5 s | Jobs waiting too long in queue |
| AIWorkerStuckRecoverySpike | `rate(aisandbox_worker_stuck_recovered_total[5m]) > 0.1` | > 0.1/sec | Frequent stuck-job recoveries |

---

## How Alerts Are Evaluated

1. **Evaluation interval:** Prometheus evaluates rules every 15 seconds (from `evaluation_interval` in `prometheus.yml`).
2. **`for` duration:** An alert enters **Pending** when the expression is true. It fires only after the condition remains true for 5 minutes.
3. **State transitions:** `Inactive` → `Pending` (5m) → `Firing`.

---

## Tuning Thresholds

Edit `monitoring/prometheus/alerts/aisandbox-alerts.yml` and adjust:

| Alert | Parameter | Example |
|-------|-----------|---------|
| AIExecutionFailureRateHigh | `> 0.1` | Lower (e.g. `0.05`) for stricter; higher for noisier environments |
| AIExecutionLatencyHigh | `> 10` | Seconds; increase if AI provider is routinely slow |
| AIQueueBacklogHigh | `> 50` | Jobs; increase for higher throughput |
| AIQueueLagHigh | `> 5` | Seconds; increase if queue lag is acceptable |
| AIWorkerStuckRecoverySpike | `> 0.1` | Per second; lower for stricter monitoring |

After editing, restart Prometheus:

```bash
docker compose restart prometheus
```

---

## Viewing Alerts in Prometheus UI

1. Start the stack: `docker compose up`
2. Open http://localhost:9090/alerts
3. Expand **aisandbox.rules** to see each alert and its state (Inactive / Pending / Firing)

---

## Files

- **Rules:** `monitoring/prometheus/alerts/aisandbox-alerts.yml`
- **Config:** `monitoring/prometheus/prometheus.yml` (includes `rule_files`)
- **Mount:** `docker-compose.yml` mounts `./monitoring/prometheus/alerts` at `/etc/prometheus/alerts`

---

## Alertmanager (Future)

Alert routing (e.g. Slack, PagerDuty) is not implemented in Phase-53C. Alerts are visible in Prometheus only. Alertmanager integration will be added in a later phase.
