# AI Sandbox Platform — Service Level Objectives

**Phase:** 54B  
**Purpose:** Define measurable service reliability targets for the aiSandBox platform.

---

## 1. Overview

This document defines **Service Level Indicators (SLIs)** and **Service Level Objectives (SLOs)** for the AI Sandbox Platform execution engine. SLIs are derived from Prometheus metrics exported by ai-service (Phases 52–53). SLOs provide quantitative targets for latency, reliability, and queue health.

**Related documentation:**
- `docs/OPERATIONS-RUNBOOK.md` — Incident procedures and alert interpretation
- `docs/OBSERVABILITY-ALERTS.md` — Prometheus alert rules
- `docs/OBSERVABILITY-PROMETHEUS.md` — Prometheus configuration

---

## 2. SLI Definitions

SLIs are measurable signals derived from Prometheus metrics. Each SLI maps to one or more metrics and a computation method.

### 2.1 Execution Reliability SLI

| SLI | Metric(s) | Computation | Unit |
|-----|-----------|-------------|------|
| **Execution success rate** | `aisandbox_execution_started_total`, `aisandbox_execution_completed_total`, `aisandbox_execution_failed_total` | `completed / (completed + failed)` over a time window | ratio (0–1) |

**Prometheus expression (success rate over 30 days):**
```
sum(increase(aisandbox_execution_completed_total[30d]))
/
(
  sum(increase(aisandbox_execution_completed_total[30d]))
  + sum(increase(aisandbox_execution_failed_total[30d]))
)
```

**Note:** Cancelled executions are excluded from success/failure counts. Started executions that neither complete nor fail within the window are not counted.

---

### 2.2 Execution Latency SLI

| SLI | Metric(s) | Computation | Unit |
|-----|-----------|-------------|------|
| **Execution latency P95** | `aisandbox_execution_latency_seconds` | 95th percentile of total execution runtime (enqueue → completion) | seconds |

**Prometheus expression:**
```
histogram_quantile(0.95, rate(aisandbox_execution_latency_seconds_bucket[5m]))
```

---

### 2.3 Provider Latency SLI

| SLI | Metric(s) | Computation | Unit |
|-----|-----------|-------------|------|
| **Provider latency P95** | `aisandbox_provider_latency_seconds` | 95th percentile of AI provider call duration | seconds |

**Prometheus expression:**
```
histogram_quantile(0.95, rate(aisandbox_provider_latency_seconds_bucket[5m]))
```

---

### 2.4 Queue Health SLIs

| SLI | Metric(s) | Computation | Unit |
|-----|-----------|-------------|------|
| **Queue backlog depth** | `aisandbox_queue_waiting_jobs` | Instantaneous count of jobs waiting in queue | jobs |
| **Queue lag P95** | `aisandbox_queue_lag_seconds` | 95th percentile of time from enqueue to worker claim | seconds |

**Prometheus expressions:**
```
# Backlog
aisandbox_queue_waiting_jobs

# Lag P95
histogram_quantile(0.95, rate(aisandbox_queue_lag_seconds_bucket[5m]))
```

---

### 2.5 Worker Health SLI

| SLI | Metric(s) | Computation | Unit |
|-----|-----------|-------------|------|
| **Stuck recovery rate** | `aisandbox_worker_stuck_recovered_total` | Rate of stuck-job recoveries per second | recoveries/sec |

**Prometheus expression:**
```
rate(aisandbox_worker_stuck_recovered_total[5m])
```

---

## 3. SLO Targets

SLOs define the target values for each SLI. These align with existing alert thresholds where applicable.

### 3.1 Execution Reliability SLO

| SLO | Target | Window | Interpretation |
|-----|--------|--------|----------------|
| **Execution success rate** | ≥ 99% | Rolling 30 days | At least 99% of non-cancelled executions complete successfully. |

**Formula:** `success_rate = completed / (completed + failed) ≥ 0.99`

---

### 3.2 Latency SLOs

| SLO | Target | Window | Interpretation |
|-----|--------|--------|----------------|
| **Execution latency P95** | ≤ 10 seconds | Rolling 5 minutes | 95% of executions finish within 10 seconds. |
| **Provider latency P95** | ≤ 8 seconds | Rolling 5 minutes | 95% of AI provider calls complete within 8 seconds. |

---

### 3.3 Queue Health SLOs

| SLO | Target | Window | Interpretation |
|-----|--------|--------|----------------|
| **Queue backlog** | ≤ 50 jobs | Instantaneous | No more than 50 jobs waiting in the queue. |
| **Queue lag P95** | ≤ 5 seconds | Rolling 5 minutes | 95% of jobs are claimed by a worker within 5 seconds of enqueue. |

---

### 3.4 Worker Health SLO

| SLO | Target | Window | Interpretation |
|-----|--------|--------|----------------|
| **Stuck recovery rate** | ≤ 0.1 recoveries/sec | Rolling 5 minutes | Stuck-job recoveries occur at most 0.1 per second on average. |

---

## 4. Error Budget

### 4.1 Concept

An **error budget** is the allowed amount of unreliability within an SLO window. It is the complement of the SLO target.

| SLO | Target | Error Budget |
|-----|--------|--------------|
| Execution success rate | 99% | 1% of executions may fail |
| Execution latency P95 | ≤ 10 s | 5% of executions may exceed 10 s |
| Queue backlog | ≤ 50 jobs | N/A (binary) |
| Queue lag P95 | ≤ 5 s | 5% of jobs may wait > 5 s |
| Stuck recovery rate | ≤ 0.1/sec | N/A (rate-based) |

### 4.2 Execution Success Error Budget

For the **99% success rate** SLO over a 30-day window:

- **Budget:** 1% of executions may fail.
- **Example:** If 100,000 executions occur in 30 days, up to 1,000 failures are within budget.
- **Exhaustion:** If failures exceed 1,000, the error budget is exhausted.

**Prometheus expression (failures within budget):**
```
# Budget remaining: (completed + failed) * 0.01 - failed
# Positive = budget remaining; negative = budget exhausted
(
  sum(increase(aisandbox_execution_completed_total[30d]))
  + sum(increase(aisandbox_execution_failed_total[30d]))
) * 0.01
- sum(increase(aisandbox_execution_failed_total[30d]))
```

### 4.3 Use of Error Budget

- **Release decisions:** Consume budget cautiously. If budget is nearly exhausted, defer risky changes.
- **Incident response:** SLO breaches consume budget. Focus on restoring service before adding features.
- **Prioritization:** When budget is healthy, new features and optimizations are acceptable. When exhausted, reliability work takes precedence.

---

## 5. Operational Interpretation of SLO Breaches

When an SLO is breached, operators should interpret the breach and take action per the runbook.

### 5.1 Execution Success Rate Breach

**Meaning:** Too many executions are failing. Error budget is being consumed.

**Operational response:**
1. Check `docs/OPERATIONS-RUNBOOK.md` § 6 — Execution Failure Investigation.
2. Correlate with AIExecutionFailureRateHigh alert.
3. Inspect ai-service logs for failure causes (provider errors, timeouts, quota).
4. If provider-related, check AI provider status. If platform-related, investigate queue, workers, and Redis.

---

### 5.2 Execution Latency P95 Breach

**Meaning:** Executions are taking too long. User experience degrades.

**Operational response:**
1. Check `docs/OPERATIONS-RUNBOOK.md` § 3 — AIExecutionLatencyHigh.
2. Compare execution latency vs provider latency in Grafana Latency dashboard.
3. If provider latency is high → AI provider may be slow or overloaded.
4. If queue lag is high → See § 5.4. If both are normal → Investigate worker capacity or bottlenecks.

---

### 5.3 Provider Latency P95 Breach

**Meaning:** AI provider calls are slow. This contributes to execution latency.

**Operational response:**
1. Check AI provider status pages and SLAs.
2. Review provider rate limits and quotas.
3. Consider provider-side issues before scaling workers.

---

### 5.4 Queue Backlog SLO Breach

**Meaning:** More than 50 jobs are waiting. Throughput may be insufficient.

**Operational response:**
1. Check `docs/OPERATIONS-RUNBOOK.md` § 5 — Queue Backlog Investigation.
2. Correlate with AIQueueBacklogHigh alert.
3. Inspect `aisandbox_queue_waiting_jobs` and `aisandbox_queue_active_jobs`.
4. Consider scaling: add ai-service replicas or increase worker concurrency per `docs/OPERATIONS-RUNBOOK.md` § 8.

---

### 5.5 Queue Lag P95 Breach

**Meaning:** Jobs wait too long before a worker claims them.

**Operational response:**
1. Check `docs/OPERATIONS-RUNBOOK.md` § 3 — AIQueueLagHigh.
2. If backlog is high → Scale workers (see § 5.4).
3. If backlog is low but lag is high → Workers may be stuck or blocked. Check AIWorkerStuckRecoverySpike and worker logs.

---

### 5.6 Stuck Recovery Rate SLO Breach

**Meaning:** Workers are frequently recovering stuck executions. Runtime instability.

**Operational response:**
1. Check `docs/OPERATIONS-RUNBOOK.md` § 7 — Worker Crash Recovery.
2. Correlate with AIWorkerStuckRecoverySpike alert.
3. Inspect worker logs for crashes, OOM, or Redis connectivity issues.
4. Verify container/process restarts. Check Redis health.

---

## 6. SLO–Alert Alignment

| SLO | Corresponding Alert | Alert Threshold |
|-----|---------------------|-----------------|
| Execution success rate | AIExecutionFailureRateHigh | > 0.1 failures/sec for 5m |
| Execution latency P95 | AIExecutionLatencyHigh | P95 > 10 s for 5m |
| Queue backlog | AIQueueBacklogHigh | > 50 jobs for 5m |
| Queue lag P95 | AIQueueLagHigh | P95 > 5 s for 5m |
| Stuck recovery rate | AIWorkerStuckRecoverySpike | > 0.1/sec for 5m |

Alerts use a 5-minute persistence window to reduce noise. SLOs use longer windows (30 days for success rate, 5 minutes for latency/queue) for different purposes: alerts for immediate response, SLOs for trend and budget tracking.

---

## 7. Review and Tuning

- **SLO targets** may be adjusted based on observed load and business requirements. Document changes in this file.
- **Alert thresholds** are tuned in `monitoring/prometheus/alerts/aisandbox-alerts.yml`. Keep SLO targets and alert thresholds aligned where they represent the same condition.
- **Error budget** policy (e.g., freeze on exhaustion) is not enforced by tooling; it is an operational guideline.

---

## Document History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2025-03-05 | Initial SLO/SLI definitions (Phase 54B) |
