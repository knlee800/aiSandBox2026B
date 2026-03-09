# External Monitoring Contract

**Phase:** 60B  
**Task:** TASK-60B — External Monitoring Contract & Runbook Implementation  
**Source:** PHASE-60A-DESIGN.md  
**Date:** 2026-03-09

---

## 1. Overview

This contract defines how external monitoring systems consume AI Sandbox Platform signals for alerting. The platform exposes HTTP endpoints only; it does not send alerts. External monitors must poll these endpoints and evaluate conditions.

**Architectural constraint:** No background workers, no cron, no event bus. Alerting is performed entirely by external systems.

---

## 2. Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/runtime/metrics` | GET | Session/container counts, connectivity status |
| `GET /api/health` | GET | Basic liveness |
| `GET /api/health/db` | GET | Database connectivity (503 on failure) |
| `GET /api/health/ready` | GET | Readiness (env, db, kill switches, safety limits) |

All endpoints are relative to the API Gateway base URL (e.g. `http://localhost:4000`).

---

## 3. Response Formats and Fields Used

### 3.1 GET /api/runtime/metrics

**Response:** 200 OK, JSON

| Field | Type | Used For |
|-------|------|----------|
| `dockerConnectivity` | boolean | Critical alert if `false` |
| `databaseConnectivity` | boolean | Critical alert if `false` |
| `activeSessionCount` | number | Drift evaluation vs `runningContainerCount` |
| `runningContainerCount` | number | Drift evaluation vs `activeSessionCount` |
| `terminatedSessionCount` | number | Volume floor for error-rate alert |
| `terminationReasons` | array of `{reason, count}` | Error-rate evaluation |
| `timestamp` | string (ISO 8601) | Audit |

**Example:**

```json
{
  "activeSessionCount": 3,
  "runningContainerCount": 2,
  "terminatedSessionCount": 15,
  "terminationReasons": [
    { "reason": "idle_timeout", "count": 8 },
    { "reason": "error", "count": 4 },
    { "reason": "manual", "count": 3 }
  ],
  "serviceUptimeSeconds": 3600,
  "dockerConnectivity": true,
  "databaseConnectivity": true,
  "timestamp": "2026-03-09T12:00:00.000Z"
}
```

### 3.2 GET /api/health

**Response:** 200 OK, JSON

| Field | Used For |
|-------|----------|
| HTTP status | Critical alert if non-200 or timeout |

### 3.3 GET /api/health/db

**Response:** 200 OK if connected, 503 if disconnected

| Field | Used For |
|-------|----------|
| HTTP status | Critical alert if 503 |

### 3.4 GET /api/health/ready

**Response:** 200 OK if ready, 503 if not ready

| Field | Used For |
|-------|----------|
| HTTP status | Critical alert if 503 |

---

## 4. Polling Cadence

| Endpoint | Recommended Interval | Rationale |
|----------|----------------------|-----------|
| `/api/runtime/metrics` | 60s | Drift requires 3+ cycles; 60s balances latency and load |
| `/api/health` | 30s | Critical; faster detection |
| `/api/health/ready` | 30s | Critical; faster detection |
| `/api/health/db` | 60s | Redundant with `runtime/metrics` → `databaseConnectivity`; optional |

**Detection latency:** Governed by poll interval. For critical signals, 30–60s is recommended.

---

## 5. Alert Evaluation Rules

### 5.1 Critical Alerts (P1)

| Condition | Evaluation | Severity |
|-----------|------------|----------|
| `dockerConnectivity === false` | From `/api/runtime/metrics` | P1 |
| `databaseConnectivity === false` | From `/api/runtime/metrics` | P1 |
| `/api/health` returns non-200 or timeout (>10s) | HTTP check | P1 |
| `/api/health/ready` returns 503 | HTTP check | P1 |

**Debounce:** Fire immediately on first detection for connectivity/health. Optionally require 2 consecutive failures to reduce transient noise.

### 5.2 Warning Alerts (P2)

| Condition | Evaluation | Severity |
|-----------|------------|----------|
| Session–container drift | `activeSessionCount !== runningContainerCount` for 3+ consecutive poll cycles | P2 |
| Elevated error termination rate | `errorCount / terminatedSessionCount > 0.2` when `terminatedSessionCount >= 10` | P2 |

**Error rate calculation:**

```
errorCount = sum(terminationReasons[].count where reason === "error")
rate = errorCount / terminatedSessionCount
alert if rate > 0.2 AND terminatedSessionCount >= 10
```

**Debounce:** Require 3 consecutive poll cycles for drift. For error rate, evaluate over rolling window (e.g. current metrics snapshot; platform does not retain history).

---

## 6. Debounce and Cooldown Guidance

| Rule | Value | Rationale |
|------|-------|-----------|
| Drift debounce | 3 poll cycles | Transient drift during lifecycle is normal |
| Error-rate volume floor | 10 terminations | Avoid false positives from low volume |
| Cooldown | 15 minutes | Do not re-alert same condition unless severity escalates |
| Alert storms | One alert per incident category | Aggregate details in alert body |

---

## 7. Severity Mapping

| Severity | Name | Response Target |
|----------|------|------------------|
| P1 | Critical | Immediate; platform degraded or down |
| P2 | Warning | Within 4 hours; investigate and remediate |

---

## 8. Known Limitations

| Limitation | Rationale |
|------------|-----------|
| JSON format only | `/api/runtime/metrics` returns JSON; Prometheus requires exporter or custom scrape config |
| No historical data | Platform does not retain time-series; external system must store history for trend alerts |
| No push/webhooks | Polling only; no real-time event emission |
| Cost endpoints out of scope | `/api/billing/*` require period params; not suitable for simple polling without aggregation |
| Single snapshot | Error-rate and drift evaluated on current snapshot; no built-in rolling window |

---

## 9. Runbook References

| Incident | Runbook |
|----------|---------|
| Docker connectivity lost | `docs/runbooks/docker-connectivity-lost.md` |
| Database connectivity lost | `docs/runbooks/database-connectivity-lost.md` |
| API Gateway unreachable | `docs/runbooks/api-gateway-unreachable.md` |
| Session–container drift | `docs/runbooks/session-container-drift.md` |
| Elevated error termination rate | `docs/runbooks/elevated-error-termination-rate.md` |

---

**END OF CONTRACT**
