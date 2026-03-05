# Operational Metrics & Capacity Monitoring

**Phase:** 58A  
**Purpose:** Define metrics and dashboards for long-term platform operations.

---

## 1. Purpose

Operational metrics support:

- **Long-term platform behavior** — Monitor trends over days, weeks, and months
- **Capacity planning** — Decide when to scale workers or infrastructure
- **Reliability trends** — Track success rates against SLO targets over time
- **Scaling decisions** — Use quantitative signals to add capacity before saturation

These metrics **complement** existing real-time dashboards (Execution Overview, Queue Health, Worker Activity, Latency). Existing dashboards focus on immediate health; operational metrics focus on trends and planning.

**Related documentation:**
- `docs/OBSERVABILITY-PROMETHEUS.md` — Prometheus configuration
- `docs/OBSERVABILITY-GRAFANA.md` — Grafana dashboards
- `docs/SERVICE-LEVEL-OBJECTIVES.md` — SLIs and SLOs
- `docs/OPERATIONS-RUNBOOK.md` — Incident procedures

---

## 2. Execution Volume Monitoring

Track usage growth and workload patterns.

### Metrics

| Metric | Description |
|--------|-------------|
| `aisandbox_execution_started_total` | Total executions enqueued (counter) |

### Example Prometheus Queries

```
# Executions per second (1h window)
rate(aisandbox_execution_started_total[1h])

# Executions per minute (scaled)
rate(aisandbox_execution_started_total[1h]) * 60

# Executions per hour (scaled)
rate(aisandbox_execution_started_total[1h]) * 3600

# Executions per day (scaled)
rate(aisandbox_execution_started_total[1h]) * 86400
```

### Suggested Dashboards

- **Executions per minute** — Short-term demand
- **Executions per hour** — Hourly workload patterns
- **Executions per day** — Daily growth and seasonality

### Purpose

- Track demand growth
- Identify workload patterns (peak hours, quiet periods)
- Plan capacity for anticipated load increases

---

## 3. Latency Trend Monitoring

Track long-term latency trends to detect performance regressions and provider degradation.

### Metrics

| Metric | Description |
|--------|-------------|
| `aisandbox_execution_latency_seconds` | End-to-end execution time (histogram) |
| `aisandbox_provider_latency_seconds` | AI provider call duration (histogram) |

### Example Prometheus Queries

```
# P95 execution latency (1h window for trend)
histogram_quantile(0.95, rate(aisandbox_execution_latency_seconds_bucket[1h]))

# P95 provider latency (1h window for trend)
histogram_quantile(0.95, rate(aisandbox_provider_latency_seconds_bucket[1h]))

# P50 execution latency (median)
histogram_quantile(0.50, rate(aisandbox_execution_latency_seconds_bucket[1h]))
```

### Suggested Dashboards

- **Latency trend (daily)** — Day-over-day P95 execution and provider latency
- **Latency trend (weekly)** — Week-over-week comparison

### Purpose

- Identify performance regressions
- Detect AI provider degradation
- Correlate latency changes with deployment or load changes

---

## 4. Queue Pressure Monitoring

Monitor queue load and processing capacity.

### Metrics

| Metric | Description |
|--------|-------------|
| `aisandbox_queue_waiting_jobs` | Jobs waiting in queue (gauge) |
| `aisandbox_queue_active_jobs` | Jobs currently being processed (gauge) |
| `aisandbox_queue_lag_seconds` | Time from enqueue to worker claim (histogram) |

### Example Prometheus Queries

```
# Queue backlog (instantaneous)
aisandbox_queue_waiting_jobs

# Queue lag P95 (5m window)
histogram_quantile(0.95, rate(aisandbox_queue_lag_seconds_bucket[5m]))

# Total queue load (waiting + active)
aisandbox_queue_waiting_jobs + aisandbox_queue_active_jobs
```

### Purpose

- Detect worker saturation
- Identify backlog growth before alerts fire
- Understand queue behavior under load

---

## 5. Worker Utilization Monitoring

Track worker activity levels.

### Metrics

| Metric | Description |
|--------|-------------|
| `aisandbox_worker_claim_total` | Total jobs claimed by workers (counter) |

### Example Prometheus Queries

```
# Worker claim rate (5m window)
rate(aisandbox_worker_claim_total[5m])

# Worker claim rate (1h window for trend)
rate(aisandbox_worker_claim_total[1h])
```

### Suggested Dashboards

- **Worker claim rate** — Throughput per second
- **Worker activity trend** — Hourly or daily claim rate over time

### Purpose

- Measure worker throughput
- Compare claim rate to execution volume (utilization)
- Identify when workers are underutilized or saturated

---

## 6. Capacity Planning Metrics

Signals used to decide when to scale.

### Scaling Indicators

| Indicator | Metric / Query | Interpretation |
|-----------|----------------|----------------|
| Queue backlog increasing | `aisandbox_queue_waiting_jobs` | Sustained growth → add workers |
| Queue lag rising | `histogram_quantile(0.95, rate(aisandbox_queue_lag_seconds_bucket[5m]))` | Jobs wait longer → capacity insufficient |
| Worker claim rate near saturation | `rate(aisandbox_worker_claim_total[5m])` vs execution rate | Claim rate ≈ execution rate with backlog → scale |
| Latency degradation under load | `histogram_quantile(0.95, rate(aisandbox_execution_latency_seconds_bucket[5m]))` | P95 rising with load → capacity or provider issue |

### Scaling Lever

**Increase ai-service worker replicas** — Add more ai-service instances to process more jobs concurrently. Update Prometheus scrape targets to include new replicas.

### Operator Evaluation Steps

1. **Baseline** — Record current execution volume, latency P95, queue backlog, and worker count during stable periods.
2. **Trend** — Compare weekly: Is volume growing? Is latency or queue lag trending up?
3. **Correlation** — When backlog or lag spikes, check execution volume. If volume is high and backlog persists, scaling is indicated.
4. **Threshold** — Use SLO targets (queue backlog ≤ 50, lag P95 ≤ 5s) as early warning. Plan scaling before sustained breaches.

---

## 7. Reliability Trend Monitoring

Track reliability over time against SLO targets.

### Metrics

| Metric | Description |
|--------|-------------|
| `aisandbox_execution_failed_total` | Total failed executions (counter) |
| `aisandbox_execution_started_total` | Total started executions (counter) |
| `aisandbox_execution_completed_total` | Total completed executions (counter) |

### Example Prometheus Queries

```
# Execution success rate (1h window)
1 - (
  rate(aisandbox_execution_failed_total[1h])
  /
  rate(aisandbox_execution_started_total[1h])
)

# Success rate (30d window, for SLO tracking)
sum(increase(aisandbox_execution_completed_total[30d]))
/
(
  sum(increase(aisandbox_execution_completed_total[30d]))
  + sum(increase(aisandbox_execution_failed_total[30d]))
)
```

### Purpose

- Track reliability against 99% SLO target
- Identify reliability degradation over time
- Correlate with deployments or provider changes

---

## 8. Operational Dashboard Strategy

Recommended Grafana dashboards for long-term monitoring.

| Dashboard | Panels | Purpose |
|-----------|--------|---------|
| **Execution Trends** | Executions/min, /hour, /day; volume over 7d, 30d | Demand growth and workload patterns |
| **Latency Trends** | P95 execution and provider latency; daily/weekly comparison | Performance regression detection |
| **Queue Capacity** | Backlog, lag P95, waiting + active jobs over time | Queue pressure and saturation |
| **Worker Utilization** | Claim rate, claim rate vs execution rate, activity trend | Worker throughput and utilization |

These dashboards **complement** existing operational dashboards (Execution Overview, Queue Health, Worker Activity, Latency), which focus on real-time health.

---

## 9. Weekly Operational Review

Periodic monitoring routine to maintain platform reliability and plan capacity.

### Weekly Checks

- **Execution volume growth** — Compare this week vs last week. Is demand increasing?
- **Latency trend changes** — Any upward drift in P95 execution or provider latency?
- **Queue backlog patterns** — Sustained high backlog or recurring spikes?
- **Worker utilization trends** — Are workers saturated or underutilized?
- **Error rate changes** — Success rate trending down? Approaching SLO breach?

### Purpose

- Catch trends before they become incidents
- Plan capacity increases in advance
- Align scaling with business growth

---

## Document History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2025-03-05 | Initial operational metrics definition (Phase 58A) |
