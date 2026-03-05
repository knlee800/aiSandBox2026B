# Production Launch Governance

**Phase:** PHASE-57  
**Stage:** STAGE-57A  
**Task:** TASK-57A — Production Launch Governance  
**Authority:** PRD.md, ARCHITECTURE.md, CLAUDE.md

---

## 1. Purpose

This document defines the operational governance required to safely launch the AI Sandbox Platform in production.

**Goals:**

- Ensure a safe production release with minimal risk
- Minimize risk during the first deployment
- Define monitoring and rollback procedures

This document governs the **initial production cutover**. It establishes procedures and responsibilities for the first production release. All operators must follow these governance steps before and during launch.

---

## 2. Go-Live Checklist

Complete all items below before initiating production deployment.

### Deployment Readiness

- [ ] `docker-compose.prod.yml` validated against PRODUCTION-DEPLOYMENT-ARCHITECTURE.md
- [ ] Environment variables configured from `.env.prod.example`
- [ ] Required secrets provided: `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `GRAFANA_ADMIN_PASSWORD`
- [ ] Database reachable (PostgreSQL connectivity verified)
- [ ] Redis reachable (Redis connectivity verified)
- [ ] `INTERNAL_SERVICE_KEY` identical across api-gateway, ai-service, container-manager

### Monitoring Readiness

- [ ] Prometheus targets healthy (ai-service scrape target UP)
- [ ] Grafana dashboards loading (Execution Overview, Queue Health, Worker Activity, Latency)
- [ ] Alert rules registered (aisandbox.rules group with all 5 alerts)
- [ ] Prometheus and Grafana accessible to operators

### Operational Readiness

- [ ] Runbooks reviewed (PRODUCTION-DEPLOYMENT-RUNBOOK.md, OPERATIONS-RUNBOOK.md)
- [ ] Rollback plan confirmed and understood
- [ ] On-call operator assigned for launch monitoring window
- [ ] PRODUCTION-VALIDATION.md checklist completed

---

## 3. Rollback Plan

### Rollback Triggers

Initiate rollback if any of the following occur:

- **Critical execution failures** — Sustained high failure rate (AIExecutionFailureRateHigh firing)
- **Persistent queue backlog** — Queue depth or lag unacceptable (AIQueueBacklogHigh, AIQueueLagHigh firing)
- **Database connectivity failure** — api-gateway or ai-service cannot reach PostgreSQL
- **Monitoring failure** — Prometheus or Grafana unavailable, preventing visibility

### Rollback Procedure

1. **Stop production stack**
   ```bash
   docker compose -f docker-compose.prod.yml down
   ```

2. **Restore previous deployment bundle**
   - Revert to last known-good compose and configuration
   - Ensure `.env` matches the previous deployment

3. **Confirm database and Redis health**
   - Verify PostgreSQL is reachable and schema is intact
   - Verify Redis is reachable and queue state is acceptable

4. **Restart services**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. **Confirm monitoring restored**
   - Prometheus target UP
   - Grafana dashboards loading
   - Alerts evaluable

**Reference:** See PRODUCTION-DEPLOYMENT-RUNBOOK.md for full deployment commands and environment setup.

---

## 4. Launch Monitoring Window

### Duration

**First 24 hours** after production launch.

### Monitoring Responsibilities

During the monitoring window, the assigned operator must:

- Review Grafana dashboards at least every 2 hours
- Watch Prometheus alerts (no Pending or Firing alerts without investigation)
- Track execution success rate (started vs completed vs failed)
- Monitor queue backlog and latency

### Metrics to Observe

| Metric | Purpose |
|--------|---------|
| `aisandbox_execution_started_total` | Execution volume |
| `aisandbox_execution_failed_total` | Failure count |
| `aisandbox_queue_waiting_jobs` | Queue backlog |
| `aisandbox_execution_latency_seconds` | End-to-end latency |

### Escalation

If alerts persist for more than 15 minutes without resolution:

1. Document the alert and current metrics
2. Attempt remediation per OPERATIONS-RUNBOOK.md
3. If remediation fails or severity is P1/P2, initiate rollback per Section 3

---

## 5. Operational Responsibilities

### Release Operator

- Initiates deployment per PRODUCTION-DEPLOYMENT-RUNBOOK.md
- Completes Go-Live Checklist (Section 2)
- Obtains Release Approval (Section 6)
- Begins monitoring window

### Platform Engineer

- Validates deployment architecture and configuration
- Confirms monitoring stack (Prometheus, Grafana, alerts) is operational
- Supports rollback if required

### Incident Responder

- Monitors dashboards during launch window
- Responds to alerts per OPERATIONS-RUNBOOK.md
- Coordinates rollback with Release Operator if triggers are met

**Note:** A single person may fulfill multiple roles for small teams. Responsibilities must be clearly assigned before launch.

---

## 6. Release Approval Workflow

### Governance Gates

1. **Deployment readiness review** — Go-Live Checklist (Section 2) completed
2. **Monitoring stack verification** — Prometheus, Grafana, and alerts confirmed operational
3. **Runbook review** — Operators have read and understand PRODUCTION-DEPLOYMENT-RUNBOOK.md and OPERATIONS-RUNBOOK.md
4. **Final approval by release owner** — Sign-off below
5. **Deployment initiated** — Per PRODUCTION-DEPLOYMENT-RUNBOOK.md
6. **Monitoring window begins** — 24-hour window starts at deployment completion

### Sign-Off Checklist

| Gate | Sign-Off |
|------|----------|
| Deployment readiness | _________________ Date: ______ |
| Monitoring verification | _________________ Date: ______ |
| Runbook review | _________________ Date: ______ |
| Final approval (release owner) | _________________ Date: ______ |

---

## 7. Post-Launch Review

After the 24-hour monitoring window completes:

### Review Tasks

- [ ] Review error rates (execution failed vs completed)
- [ ] Review latency metrics (P95 execution and queue lag)
- [ ] Confirm alert stability (no unexpected firing, thresholds appropriate)
- [ ] Document any incidents and resolutions

### Outcome

- **If stable:** Declare platform **production-operational**. Continue normal monitoring per OPERATIONS-RUNBOOK.md.
- **If unstable:** Extend monitoring window, address issues, or consider rollback. Do not declare production-operational until stability is confirmed.

---

## References

- `PRODUCTION-DEPLOYMENT-ARCHITECTURE.md` — Deployment topology and configuration
- `PRODUCTION-DEPLOYMENT-RUNBOOK.md` — Deployment steps and commands
- `PRODUCTION-VALIDATION.md` — Validation procedure and go-live readiness
- `OPERATIONS-RUNBOOK.md` — Monitoring, alerts, and incident triage
- `OBSERVABILITY-ALERTS.md` — Alert rules and thresholds
