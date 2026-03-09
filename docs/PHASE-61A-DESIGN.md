# PHASE 61A DESIGN: Backup & Disaster Recovery

**Phase:** 61A  
**Stage:** STAGE-61A  
**Task:** TASK-61A — Backup & Disaster Recovery Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-56, PHASE-57, PHASE-60 COMPLETE  
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 61A defines backup scope, restore priorities, disaster recovery scenarios, recovery objectives (RPO/RTO), and operational restore/runbook requirements for the AI Sandbox Platform. The design assumes **manual or externally scheduled** backup operations—no in-process backup agents, no background workers, no cron inside the platform.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Backup and restore are performed by operators or external tooling (e.g. host cron, cloud backup services). The platform exposes no backup APIs. Restore is a manual procedure.

### 1.3 Baseline

- **Production validation:** PHASE-56 (docker-compose.prod.yml, PostgreSQL, Redis, volumes)
- **Governance:** PHASE-57 (rollback plan, launch procedures)
- **Alerting/runbook:** PHASE-60 (incident runbooks, external monitoring contract)
- **Project plan targets:** AI-SANDBOX-PLATFORM-PLAN.md (RTO 1h, RPO 15min—aspirational; see Section 4)

---

## 2. Backup Scope

### 2.1 What Must Be Backed Up

| Asset | Location | Criticality | Notes |
|-------|----------|-------------|-------|
| **PostgreSQL** | `postgres_data` volume | CRITICAL | Authoritative source for sessions, usage_records, billing, ledger |
| **Configuration** | `.env`, `docker-compose.prod.yml` | CRITICAL | Secrets, connection strings, feature flags |
| **Monitoring config** | `monitoring/prometheus/`, `monitoring/grafana/` | HIGH | Alert rules, dashboards |
| **Database schema** | `database/`, `database/init/` | HIGH | Migrations, init scripts |
| **SQLite files** | `api_gateway_data`, `ai_service_data`, `container_manager_data` (if in use) | MEDIUM | Legacy/auxiliary; verify per deployment |

### 2.2 What Does NOT Need Backup

| Asset | Rationale |
|-------|------------|
| **Redis** | Ephemeral; queue and cache can be rebuilt; sessions/state in PostgreSQL |
| **Session workspace data** | Ephemeral per container; not persisted across session lifecycle |
| **Build artifacts** | Rebuildable from source (`docker compose build`) |
| **Logs** | Operational only; not required for recovery |
| **Prometheus/Grafana data** | Metrics history; nice-to-have, not recovery-critical |

### 2.3 Backup Targets and Storage Classes

| Backup Type | Target | Storage Class | Retention |
|-------------|--------|---------------|-----------|
| PostgreSQL dump | File (e.g. `pg_dump` output) | Off-host, encrypted | Per policy (e.g. 30 days daily, 1 year weekly) |
| Configuration | File copy | Off-host, encrypted | Versioned with deployment |
| SQLite (if used) | File copy | Off-host | Same as PostgreSQL |

**Storage requirements:**
- Off-host: Backup must not reside only on the same node as production
- Encrypted at rest: Per project plan security checklist
- Access control: Restrict to operators; no application access

---

## 3. Restore Priorities

### 3.1 Restore Order

1. **Infrastructure** — PostgreSQL, Redis (if needed)
2. **Configuration** — `.env`, compose, monitoring
3. **PostgreSQL data** — Restore from dump
4. **Application services** — Start api-gateway, ai-service, container-manager, frontend
5. **Observability** — Start Prometheus, Grafana
6. **Validation** — Health checks, smoke tests

### 3.2 Dependency Order

```
PostgreSQL running + schema applied
    → Redis running
        → api-gateway, ai-service, container-manager (env + DATABASE_URL)
            → frontend
                → Prometheus, Grafana
```

### 3.3 Minimum Viable Recovery Path

For fastest recovery when only database is lost:

1. Stop application services (preserve Redis if intact)
2. Restore PostgreSQL from most recent dump
3. Restart application services
4. Verify `/api/health`, `/api/health/ready`, `/api/health/db`

---

## 4. Disaster Recovery Scenarios

### 4.1 Database Loss

| Cause | Examples | Response |
|-------|----------|----------|
| Corruption | Disk failure, bad migration | Restore from last known-good backup |
| Accidental deletion | `DROP TABLE`, truncate | Restore from backup; identify last good point |
| Volume loss | `postgres_data` volume destroyed | Restore PostgreSQL from dump to new volume |

**Procedure:** Run restore runbook (Section 6).

### 4.2 Host/Node Loss

| Cause | Examples | Response |
|-------|----------|----------|
| Hardware failure | Node unreachable | Provision new host; restore from backups |
| VM termination | Cloud instance terminated | Same as above |

**Procedure:** Full stack rebuild on new host; restore PostgreSQL; restore config; start services.

### 4.3 Corrupted Deployment

| Cause | Examples | Response |
|-------|----------|----------|
| Bad release | Broken image, bad migration | Rollback per PRODUCTION-LAUNCH-GOVERNANCE.md |
| Config error | Invalid env, wrong connection string | Revert config; restart services |

**Procedure:** Rollback to last known-good deployment; if DB affected, restore from backup.

### 4.4 Partial Service Failure

| Cause | Examples | Response |
|-------|----------|----------|
| Single service down | api-gateway crash, container-manager OOM | Restart service; use PHASE-60 runbooks |
| Database connectivity lost | Per runbook `database-connectivity-lost.md` | Remediate per that runbook |

**Procedure:** Per PHASE-60 incident runbooks; no backup restore needed unless data loss confirmed.

### 4.5 Configuration/Secrets Loss

| Cause | Examples | Response |
|-------|----------|----------|
| `.env` lost or corrupted | Accidental overwrite | Restore from backup; rotate secrets if exposure suspected |
| Secrets rotated externally | JWT_SECRET, INTERNAL_SERVICE_KEY changed | Update `.env`; restart all services with new keys |

**Procedure:** Restore config from backup; ensure `INTERNAL_SERVICE_KEY` identical across api-gateway, ai-service, container-manager.

---

## 5. Recovery Objectives

### 5.1 RPO (Recovery Point Objective)

| Target | Rationale | Currently Achievable |
|--------|-----------|----------------------|
| **15 minutes** | Project plan aspiration | **No** — Requires continuous WAL streaming or frequent dumps; no automation in platform |
| **1 hour** | Manual hourly dump | **Yes** — If operator runs `pg_dump` hourly |
| **24 hours** | Daily dump | **Yes** — Minimal operational overhead |

**Deferred:** Automated RPO guarantees require external backup tooling (e.g. cloud provider PITR, WAL archiving). Phase 61A does not implement these.

### 5.2 RTO (Recovery Time Objective)

| Target | Rationale | Currently Achievable |
|--------|-----------|----------------------|
| **1 hour** | Project plan aspiration | **Yes** — With practiced restore procedure and pre-staged restore runbook |
| **4 hours** | Conservative | **Yes** — With minimal practice |

**Factors:** Restore time depends on dump size, network speed to backup storage, operator familiarity. Single-node focus means no failover; full restore required.

### 5.3 What Is Deferred

| Capability | Rationale |
|------------|-----------|
| Automated backups | Requires cron or background worker; violates architecture |
| Point-in-time recovery (PITR) | Requires WAL archiving; operational complexity |
| Cross-region replication | Out of scope; single-node architecture |
| HA/failover | ARCHITECTURE.md Section 12: "No HA" accepted |

---

## 6. Restore / Recovery Runbook Requirements

### 6.1 Required Runbook Structure

Each restore runbook MUST include:

1. **Title** — Scenario (e.g. "PostgreSQL Restore from Backup")
2. **Prerequisites** — Backup location, credentials, tools (pg_restore, etc.)
3. **Verification steps** — How to confirm backup integrity before restore
4. **Restore steps** — Ordered, idempotent where possible
5. **Post-restore validation** — Health checks, smoke tests
6. **Rollback / retry guidance** — If restore fails, how to retry or revert
7. **Escalation** — When to escalate

### 6.2 Required Runbook Categories

| Category | Runbooks Required |
|----------|-------------------|
| **Database** | PostgreSQL restore from dump |
| **Full stack** | Host loss / full rebuild |
| **Configuration** | Config/secrets restore |

### 6.3 Verification Steps

- Checksum or integrity check of backup file before restore
- PostgreSQL `pg_restore --list` or equivalent to validate dump
- Post-restore: `GET /api/health/db` returns 200
- Post-restore: `GET /api/health/ready` returns 200
- Smoke test: Create session, execute, terminate

### 6.4 Rollback / Retry Guidance

- If restore fails mid-way: Stop services; do not leave DB in partial state
- Retry: Use same backup or earlier backup if corruption suspected
- Rollback: If new deployment caused issue, revert to previous compose/images per PRODUCTION-LAUNCH-GOVERNANCE.md

### 6.5 Post-Recovery Validation

| Check | Method |
|-------|--------|
| Database connectivity | `GET /api/health/db` |
| Full readiness | `GET /api/health/ready` |
| Runtime metrics | `GET /api/runtime/metrics` |
| Session create | `POST /api/sessions` (smoke) |

---

## 7. Architecture Fit

### 7.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Backup/DR |
|------------|---------------------------|
| No background workers | Platform does not run backup jobs; external tooling or operator must |
| No cron | No scheduled `pg_dump` inside platform; host cron or cloud scheduler |
| No event bus | No backup-complete events; operator verifies manually |
| Request-driven | Restore is out-of-band; no API for backup/restore |

### 7.2 Single-Node Reality

- One PostgreSQL instance
- One Redis instance
- No replication, no failover
- Full restore required on node loss
- RTO dominated by restore + service startup

### 7.3 Deferred Future Improvements

| Improvement | When | Notes |
|-------------|------|-------|
| Cloud-managed PostgreSQL | Migration to RDS/Cloud SQL | PITR, automated backups |
| Off-site backup replication | When multi-region needed | S3 cross-region, etc. |
| Automated backup verification | When tooling approved | Restore test in staging |
| HA / failover | Architecture change | Would require design change |

---

## 8. Phase Output

- **Design doc:** This document (`docs/PHASE-61A-DESIGN.md`)
- **Checkpoint:** `docs/PHASE-61A-CHECKPOINT.md`

---

**END OF DESIGN**
