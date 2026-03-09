# Launch-Day Admin Health / Visibility Checklist

**Phase:** 65B  
**Reference:** PHASE-65A-DESIGN.md Section 6; PHASE-57; PHASE-60

---

## Purpose

Ensure operators have minimum admin-visible operational information during launch and can verify platform health. Per PHASE-57, first 24 hours after production launch require active monitoring. This checklist defines what to check and how.

## Scope

**In scope:**
- Pre-launch verification
- Launch monitoring window (first 24 hours)
- Admin visibility via existing endpoints
- Verification that metrics reflect reality

**Excluded:**
- New admin-only endpoints (none added)
- Automated health dashboards (use external tooling if available)
- Post-launch review (per PRODUCTION-LAUNCH-GOVERNANCE.md)

## Prerequisites

- INTERNAL_SERVICE_KEY for admin endpoints
- Network access to api-gateway
- curl, Postman, or equivalent
- PRODUCTION-LAUNCH-GOVERNANCE.md reviewed
- PHASE-60 runbooks available (Docker, DB, API Gateway, drift, error rate)
- On-call operator assigned for launch monitoring window

## Pre-Launch Verification

Complete before initiating production deployment (per PHASE-57 go-live checklist):

| Check | Endpoint / Action | Pass Criteria |
|-------|-------------------|---------------|
| API Gateway liveness | `GET /api/health` | 200 OK |
| Database connectivity | `GET /api/health/db` | 200 OK |
| Readiness | `GET /api/health/ready` | 200 OK |
| Runtime metrics | `GET /api/runtime/metrics` | 200 OK; dockerConnectivity, databaseConnectivity true |
| Admin user summary | `GET /api/internal/admin/users/:userId/summary` (with X-Internal-Service-Key) | Valid response |
| Draft invoices | `GET /api/internal/admin/invoices` (with X-Internal-Service-Key) | Valid response |

## Launch Monitoring Window (First 24 Hours)

Per PHASE-57 Section 4. Operators must monitor:

| Metric | Source | Frequency | Pass Criteria |
|--------|--------|-----------|---------------|
| **Execution success rate** | External monitor; PHASE-60 alerts | Continuous | No sustained high failure rate |
| **Queue backlog** | Per deployment (e.g. ai-service metrics) | Per PHASE-60 | No AIQueueBacklogHigh, AIQueueLagHigh |
| **Latency** | External monitor | Continuous | Within acceptable range |
| **Alert activity** | External monitor (Prometheus, Uptime Robot) | Continuous | No P1 alerts; P2 triaged |
| **Session counts** | `GET /api/runtime/metrics` | Every 60 min | activeSessionCount, runningContainerCount consistent |
| **Connectivity** | `GET /api/runtime/metrics` | Every 60 min | dockerConnectivity, databaseConnectivity true |
| **Termination reasons** | `GET /api/runtime/metrics` | Every 60 min | Error rate < 20% (with volume floor) |

## Admin Visibility Endpoints Reference

| Information | Endpoint | Auth |
|-------------|----------|------|
| Session counts | `GET /api/runtime/metrics` | None (or per deployment) |
| Container counts | `GET /api/runtime/metrics` | None |
| Connectivity | `GET /api/runtime/metrics` | None |
| Termination reasons | `GET /api/runtime/metrics` | None |
| API health | `GET /api/health`, `/api/health/db`, `/api/health/ready` | None |
| User quota status | `GET /api/internal/admin/users/:userId/summary` | X-Internal-Service-Key |
| Draft invoices | `GET /api/internal/admin/invoices` | X-Internal-Service-Key |
| Cost efficiency | `GET /api/billing/efficiency-summary`, `provider-trends` | Per deployment |

## Verification Steps

1. **Confirm metrics reflect reality** — Compare activeSessionCount to actual running containers if possible
2. **No session–container drift** — activeSessionCount ≈ runningContainerCount (transient drift during lifecycle OK; persistent drift = incident per PHASE-60)
3. **Connectivity stable** — dockerConnectivity, databaseConnectivity remain true
4. **No P1 incidents** — Per PHASE-60; if any, follow runbooks immediately

## Exception / Escalation Handling

| Condition | Action |
|-----------|--------|
| **P1 alert** | Page on-call; follow PHASE-60 runbook; escalate to platform owner if unresolved in 30 min |
| **P2 alert** | Create ticket; triage within 4 hours |
| **Session–container drift (persistent)** | Run reconciliation per PHASE-43C; verify orphan cleanup |
| **Readiness 503** | Restart api-gateway; check logs; verify env, db, kill switches |
| **Docker down** | Per runbook: docker-connectivity-lost.md |
| **Database down** | Per runbook: database-connectivity-lost.md |

## Evidence to Retain

- Pre-launch checklist completion (signed)
- Monitoring log: time, metrics snapshot, anomalies (if any)
- Incident log: any P1/P2 during window; resolution
- Post-launch review notes (per PHASE-57)

## Signoff Requirements

- Pre-launch: Release operator sign-off on go-live checklist
- Post 24h: Platform owner or delegate sign-off on launch monitoring completion
- Any incident: Per PHASE-60 post-incident documentation

---

**Reference:** PHASE-65A-DESIGN.md Section 6; PRODUCTION-LAUNCH-GOVERNANCE.md; PHASE-60A-DESIGN.md
