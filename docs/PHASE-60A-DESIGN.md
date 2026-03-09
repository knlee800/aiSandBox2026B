# PHASE 60A DESIGN: Alerting & Incident Readiness

**Phase:** 60A  
**Stage:** STAGE-60A  
**Task:** TASK-60A — Alerting & Incident Readiness Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-41A, PHASE-58, PHASE-59 COMPLETE  
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 60A defines production alerting scope, alert thresholds, incident signal definitions, and runbook requirements for the AI Sandbox Platform. The design assumes **external polling** of existing HTTP endpoints—no in-process alert dispatch, no background workers, no event bus.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Alerting is performed by an external monitoring system that polls platform endpoints. The platform exposes signals; it does not send alerts.

### 1.3 Baseline Endpoints (Unchanged)

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `GET /api/runtime/metrics` | PHASE-41A | Session/container counts, connectivity |
| `GET /api/health` | api-gateway | Basic liveness |
| `GET /api/health/db` | api-gateway | Database connectivity (503 on failure) |
| `GET /api/health/ready` | api-gateway | Readiness (env, db, kill switches, safety limits) |
| `GET /api/billing/efficiency-summary` | PHASE-59 | Cost efficiency (periodStart/periodEnd) |
| `GET /api/billing/provider-trends` | PHASE-59 | Cost trends (periodStart/periodEnd) |

---

## 2. Alerting Scope

### 2.1 What to Alert On

| Signal | Source | Alert Type |
|--------|--------|------------|
| **Docker connectivity lost** | `runtime/metrics` → `dockerConnectivity === false` | Critical |
| **Database connectivity lost** | `runtime/metrics` → `databaseConnectivity === false` | Critical |
| **API Gateway unreachable** | `GET /api/health` timeout or 5xx | Critical |
| **Readiness check failing** | `GET /api/health/ready` returns 503 | Critical |
| **Session–container drift** | `activeSessionCount` ≠ `runningContainerCount` (persistent) | Warning |
| **High error termination rate** | `terminationReasons` where `reason === "error"` dominates | Warning |

### 2.2 What NOT to Alert On

| Signal | Rationale |
|--------|-----------|
| Idle timeout terminations | Expected behavior; not an incident |
| Max lifetime terminations | Expected behavior; not an incident |
| Manual (explicit delete) terminations | User-initiated; not an incident |
| Transient session–container drift | Brief drift during lifecycle transitions is normal; alert only if persistent |
| Cost metrics | Cost monitoring is for dashboards and review; not real-time incident signals |
| Rate limit hits (429) | Expected under load; not an incident unless sustained abuse |
| Individual session 410 Gone | Expected for terminated sessions |

### 2.3 Warning vs Critical Separation

| Severity | Definition | Examples |
|----------|-------------|----------|
| **Critical** | Platform cannot serve traffic or core dependencies are down | Docker down, DB down, api-gateway unreachable |
| **Warning** | Degraded state requiring investigation; platform may still function | Session–container drift, elevated error terminations |

---

## 3. Alert Thresholds

### 3.1 Connectivity Thresholds

| Condition | Threshold | Severity | Rationale |
|----------|-----------|----------|-----------|
| `dockerConnectivity` | `false` | Critical | Containers cannot be created or managed |
| `databaseConnectivity` | `false` | Critical | Sessions cannot be persisted; platform unusable |
| `/api/health` | Non-200 or timeout (>10s) | Critical | API Gateway may be down |
| `/api/health/ready` | 503 | Critical | Service not ready for traffic |

### 3.2 Session–Container Drift Threshold

| Condition | Threshold | Severity | Rationale |
|----------|-----------|----------|------------|
| `activeSessionCount - runningContainerCount` | `> 0` for 3+ consecutive poll cycles (e.g. 3 × 60s) | Warning | Orphaned sessions or stuck containers; requires reconciliation |

**Noise control:** Do not alert on single-cycle drift. Require persistence across multiple poll cycles.

### 3.3 Error Termination Rate Threshold

| Condition | Threshold | Severity | Rationale |
|----------|-----------|----------|------------|
| `terminationReasons[reason="error"].count / terminatedSessionCount` | `> 0.2` (20%) over rolling window | Warning | Elevated failure rate; may indicate provider or runtime issues |

**Noise control:** Only apply when `terminatedSessionCount >= 10` in the window to avoid false positives from low volume.

### 3.4 Noise-Control Guidance

1. **Debounce:** Require condition to persist for 2–3 poll cycles before firing.
2. **Cooldown:** Do not re-alert on same condition within 15 minutes unless severity escalates.
3. **Volume floor:** For rate-based alerts, require minimum sample size (e.g. 10 terminations) before evaluating.
4. **Avoid alert storms:** One alert per incident category; aggregate details in alert body.

---

## 4. Incident Signal Definitions

### 4.1 What Counts as an Incident

An **incident** is a platform state that requires operational action to restore normal operation or prevent user impact.

| Incident Type | Trigger | Severity |
|---------------|---------|----------|
| **Connectivity: Docker** | `dockerConnectivity === false` | P1 (Critical) |
| **Connectivity: Database** | `databaseConnectivity === false` | P1 (Critical) |
| **Connectivity: API Gateway** | Health/ready endpoints unreachable or 5xx | P1 (Critical) |
| **Session–Container Drift** | Persistent `activeSessionCount ≠ runningContainerCount` | P2 (Warning) |
| **Elevated Error Terminations** | Error termination rate > 20% (with volume floor) | P2 (Warning) |

### 4.2 Severity Classification

| Level | Name | Response Target |
|-------|------|------------------|
| P1 | Critical | Immediate; platform degraded or down |
| P2 | Warning | Within 4 hours; investigate and remediate |

### 4.3 Signal-to-Incident Mapping

| Signal | Incident | Severity |
|--------|----------|----------|
| `dockerConnectivity: false` | Docker connectivity incident | P1 |
| `databaseConnectivity: false` | Database connectivity incident | P1 |
| `/api/health` timeout or 5xx | API Gateway availability incident | P1 |
| `/api/health/ready` 503 | API Gateway readiness incident | P1 |
| Session–container drift (persistent) | Session–container reconciliation incident | P2 |
| Error termination rate > 20% | Elevated error termination incident | P2 |

---

## 5. Incident Readiness / Runbook Requirements

### 5.1 Required Runbook Structure

Each runbook MUST include:

1. **Title** — Incident type (e.g. "Docker Connectivity Lost")
2. **Trigger** — What signal fires this runbook
3. **Severity** — P1 or P2
4. **Verification steps** — How to confirm the incident state
5. **Remediation steps** — Ordered actions to resolve
6. **Escalation path** — When and to whom to escalate
7. **Post-incident** — What to document after resolution

### 5.2 Required Runbook Categories

| Category | Runbooks Required |
|----------|-------------------|
| **Connectivity** | Docker connectivity lost, Database connectivity lost, API Gateway unreachable |
| **Session/Container** | Session–container drift |
| **Termination** | Elevated error termination rate |

### 5.3 Minimum Operational Actions

| Incident | Verification | Remediation |
|----------|--------------|-------------|
| Docker down | Poll `/api/runtime/metrics`; check `dockerConnectivity` | Restart Docker daemon; verify container-manager can reach Docker |
| Database down | Poll `/api/health/db`; check `runtime/metrics` → `databaseConnectivity` | Verify PostgreSQL is running; check connection string; restart api-gateway if needed |
| API Gateway unreachable | Poll `/api/health`, `/api/health/ready` | Restart api-gateway; check logs for startup failures |
| Session–container drift | Compare `activeSessionCount` vs `runningContainerCount` over time | Run reconciliation (per PHASE-43C); verify orphan cleanup |
| Elevated error terminations | Inspect `terminationReasons` in `/api/runtime/metrics` | Check container-manager logs; verify AI provider availability; review recent changes |

### 5.4 Escalation Path

- **P1:** Page on-call immediately. Escalate to platform owner if unresolved in 30 minutes.
- **P2:** Create ticket. Escalate if unresolved in 4 hours.

---

## 6. Architecture Fit

### 6.1 How External Monitoring Consumes Signals

```
External Monitor (e.g. Prometheus + Alertmanager, Uptime Robot, custom script)
    │
    ├── Poll GET /api/runtime/metrics (e.g. every 60s)
    │       → Evaluate dockerConnectivity, databaseConnectivity
    │       → Evaluate activeSessionCount vs runningContainerCount
    │       → Evaluate terminationReasons
    │
    ├── Poll GET /api/health (e.g. every 30s)
    │       → Alert on non-200 or timeout
    │
    └── Poll GET /api/health/ready (e.g. every 30s)
            → Alert on 503
```

**Interface assumption:** External monitor performs HTTP GET requests. No push, no webhooks, no in-process integration.

### 6.2 Constraints from No-Worker / No-Cron / No-Event-Bus Architecture

| Constraint | Implication |
|------------|-------------|
| No background workers | Platform does not run alert evaluation; external system must poll |
| No cron | No scheduled health checks inside platform; external system must schedule |
| No event bus | No real-time event emission; polling interval determines detection latency |

**Detection latency:** Governed by poll interval. Recommend 30–60s for critical signals.

### 6.3 Known Gaps (Deferred to Later Phases)

| Gap | Rationale |
|-----|-----------|
| Prometheus exposition format | `/api/runtime/metrics` returns JSON; Prometheus would need exporter or custom scrape config |
| Historical alerting | No time-series storage in platform; external system must retain history |
| Cost-based alerts | Cost endpoints require period params; not suitable for real-time polling without aggregation logic |
| Queue/worker metrics | PHASE-58 metrics (queue pressure, worker utilization) may exist in ai-service; out of scope for 60A baseline |

---

## 7. Phase Output

- **Design doc:** This document (`docs/PHASE-60A-DESIGN.md`)
- **Checkpoint:** `docs/PHASE-60A-CHECKPOINT.md`

---

**END OF DESIGN**
