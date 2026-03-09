# PHASE 62A DESIGN: Backup & Restore Validation Drill

**Phase:** 62A  
**Stage:** STAGE-62A  
**Task:** TASK-62A — Backup & Restore Validation Drill Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-61 COMPLETE  
**Next Phase:** Drill runbook implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 62A defines the design for backup and restore validation drills. These drills prove that Phase 61 backup and disaster recovery procedures actually work in practice. Drills are **manual, operator-driven** exercises—no automated scheduling inside the platform, no code changes, no schema or endpoint changes.

### 1.2 Relationship to Phase 61

| Phase 61 Artifact | Phase 62 Use |
|------------------|--------------|
| PHASE-61A-DESIGN.md | Defines backup scope, restore order, RPO/RTO targets |
| PHASE-61B runbooks | postgresql-restore, full-stack-rebuild, configuration-restore |
| docs/backup/* | Backup procedures, verification, operator prerequisites |
| PHASE-61-FINAL-CHECKPOINT | Validates 61 docs; 62 drills validate procedures in practice |

### 1.3 Architectural Constraints

Per ARCHITECTURE.md Section 11 and CLAUDE.md:
- No background workers
- No cron jobs
- No event bus
- No code changes
- No schema changes
- No endpoint changes

**Implication:** Drills are scheduled by operators or external tooling (e.g. calendar reminder, ops runbook). The platform exposes no drill APIs. Drill execution is manual.

---

## 2. Validation Drill Scope

### 2.1 What Drills Must Be Run

| Drill | Mandatory | Frequency | Environment |
|-------|-----------|------------|-------------|
| Database restore validation | **Mandatory** | Per Section 6.1 | Staging or isolated test |
| Configuration/secrets restore validation | **Mandatory** | Per Section 6.1 | Staging or isolated test |
| Full stack rebuild / host loss recovery | **Mandatory** | Per Section 6.1 | Staging or isolated test |
| Backup integrity verification | **Mandatory** | Per Section 6.1 | Any (no restore required) |
| Corrupted deployment recovery | **Optional** | As needed | Staging only |

### 2.2 Mandatory vs Optional

**Mandatory drills** must be executed at least at the frequency specified in Section 6. Evidence must be retained per Section 6.3.

**Optional drills** may be run when:
- Corrupted deployment scenario is suspected or planned
- Additional confidence is needed before major releases
- Post-incident validation is required

### 2.3 Allowed Environments for Drills

| Environment | Allowed | Notes |
|-------------|---------|-------|
| **Staging** | Yes | Preferred; mirrors production topology |
| **Isolated test** | Yes | Dedicated host/VM, no production data |
| **Production** | **No** | See Section 2.4 |

### 2.4 Production Actions Explicitly Forbidden

| Action | Rationale |
|--------|-----------|
| Restore production database from backup as a drill | Risk of data loss, downtime, inconsistency |
| Stop production services to simulate host loss | Unacceptable downtime |
| Overwrite production `.env` or config as a drill | Risk of service outage |
| Run restore drill against production backup copy | If restore fails, no production impact—but restore target must NOT be production DB |
| Automated drill execution in production | No cron, no background workers |

**Rule:** Drills that involve restore operations MUST target non-production environments. Production backups may be **copied** to a test environment for drill use; the restore target is always staging or isolated test.

---

## 3. Drill Scenarios

### 3.1 Database Restore Validation

**Objective:** Prove that PostgreSQL restore from dump works.

**Procedure reference:** `docs/runbooks/postgresql-restore.md`

**Drill steps:**
1. Obtain a backup (from production copy or staging backup)
2. Create isolated PostgreSQL instance or use staging DB
3. Execute restore per runbook
4. Run post-restore validation (health checks, smoke test)
5. Record elapsed time, pass/fail, artifacts

**Data source:** Copy of production dump or staging dump. Never restore into production.

### 3.2 Configuration / Secrets Restore Validation

**Objective:** Prove that configuration restore works and INTERNAL_SERVICE_KEY consistency is maintained.

**Procedure reference:** `docs/runbooks/configuration-restore.md`

**Drill steps:**
1. Stash current staging config (or use backup copy)
2. Corrupt or remove `.env` / compose config
3. Restore from backup per runbook
4. Restart services; verify health and internal auth
5. Record pass/fail, artifacts

**Constraint:** Staging or isolated test only. No production config overwrite.

### 3.3 Full Stack Rebuild / Host Loss Recovery Validation

**Objective:** Prove that full stack can be rebuilt from scratch using backups.

**Procedure reference:** `docs/runbooks/full-stack-rebuild.md`

**Drill steps:**
1. Provision clean host or tear down staging stack
2. Restore config, PostgreSQL, start services per runbook
3. Run full validation (health, metrics, smoke test)
4. Record elapsed time (RTO measurement), pass/fail, artifacts

**Environment:** Staging or isolated test. Simulates host loss without affecting production.

### 3.4 Corrupted Deployment Recovery Validation (Optional)

**Objective:** Prove that rollback + restore procedure works when deployment is corrupted.

**Procedure reference:** `docs/runbooks/full-stack-rebuild.md`, PRODUCTION-LAUNCH-GOVERNANCE.md

**Drill steps:**
1. Deploy known-bad image or config to staging
2. Execute rollback per governance
3. If DB affected, restore from backup
4. Validate recovery
5. Record pass/fail, artifacts

**When to run:** Before major releases, or after corruption incident.

### 3.5 Backup Integrity Verification Drill

**Objective:** Prove that backups are valid and restorable without performing full restore.

**Procedure reference:** `docs/backup/backup-verification.md`

**Drill steps:**
1. Select recent backup(s) (PostgreSQL, config)
2. Run integrity checks (checksum, pg_restore --list)
3. Document result; no restore required
4. Record pass/fail, checksum verification result

**Environment:** Any. Can verify production backup copies without restore.

---

## 4. Success Criteria

### 4.1 Pass/Fail Criteria per Drill

| Drill | Pass | Fail |
|-------|------|------|
| Database restore | Restore completes; GET /api/health/db → 200; GET /api/health/ready → 200; smoke test (create session, exec, terminate) succeeds | Any step fails; health checks fail; smoke test fails |
| Configuration restore | Config restored; services start; health/ready → 200; internal auth works | Config missing; services fail to start; auth broken |
| Full stack rebuild | All services up; health/db, health/ready → 200; GET /api/runtime/metrics → 200; smoke test succeeds | Any service fails; health fails; smoke test fails |
| Corrupted deployment | Rollback completes; restore if needed; validation passes | Rollback fails; inconsistent state |
| Backup integrity | Checksum valid; pg_restore --list succeeds (PostgreSQL); config files present and non-empty | Checksum mismatch; dump corrupt; config missing |

### 4.2 Required Evidence / Artifacts

| Artifact | Required For | Retention |
|----------|--------------|-----------|
| Drill log (date, operator, environment, duration) | All drills | Per Section 6.3 |
| Pass/fail result | All drills | Per Section 6.3 |
| RTO measurement (elapsed time) | Full stack rebuild, DB restore | Per Section 6.3 |
| Checksum verification output | Backup integrity | Per Section 6.3 |
| Health check outputs (curl responses) | Restore drills | Per Section 6.3 |

### 4.3 Data Integrity Verification Expectations

| Check | Method |
|-------|--------|
| Database connectivity | GET /api/health/db returns 200 |
| Full readiness | GET /api/health/ready returns 200 |
| Runtime metrics | GET /api/runtime/metrics returns 200 (full stack drill) |
| Session lifecycle | POST /api/sessions → 201; exec; DELETE → 204 |
| Internal service auth | api-gateway, ai-service, container-manager communicate (no 401/403 on internal calls) |

### 4.4 Service Health / Smoke Validation After Restore

Per PHASE-61A-DESIGN.md Section 6.5:

1. `GET /api/health/db` → 200
2. `GET /api/health/ready` → 200
3. `GET /api/runtime/metrics` → 200 (full stack)
4. Smoke test: Create session, execute command, terminate session

---

## 5. Recovery Objectives Validation

### 5.1 How to Measure Achieved RTO

**RTO** = Time from "start of restore" to "services operational and validated."

**Measurement:**
1. Record start time (e.g. when restore steps begin)
2. Record end time (when smoke test passes)
3. RTO achieved = end - start

**Drill applicability:** Full stack rebuild and database restore drills produce RTO measurements. Record in drill log.

**Project plan target:** RTO 1 hour (aspirational). PHASE-61A: 1h achievable with practiced procedure; 4h conservative.

### 5.2 How to Estimate or Verify Achieved RPO

**RPO** = Maximum acceptable data loss (time between last backup and failure).

**Verification:**
- RPO is determined by backup frequency, not by drill
- If backups run daily: RPO ≈ 24 hours
- If backups run hourly: RPO ≈ 1 hour
- Project plan aspiration: 15 minutes (not achievable without automation—PHASE-61A)

**Drill applicability:** Backup integrity drill verifies backup exists and is valid. It does NOT measure RPO. RPO is a policy/operational choice (backup schedule).

### 5.3 What Is Currently Testable vs Deferred

| Objective | Testable via Drill | Deferred |
|-----------|--------------------|----------|
| RTO | Yes—full stack rebuild, DB restore | — |
| RPO | No—policy/schedule, not drill | Automated RPO requires external tooling |
| Restore procedure correctness | Yes—all restore drills | — |
| Backup integrity | Yes—backup integrity drill | — |
| Config restore | Yes—configuration restore drill | — |
| Corrupted deployment recovery | Yes—optional drill | — |

---

## 6. Drill Runbook Requirements

### 6.1 Required Structure for Validation Drill Runbooks

Each validation drill runbook MUST include:

1. **Title** — Drill name (e.g. "Database Restore Validation Drill")
2. **Prerequisites** — Environment, backup copy, tools, operator access
3. **Safety checks** — Confirm non-production; confirm backup copy (not production DB)
4. **Drill steps** — Ordered steps referencing Phase 61 runbooks
5. **Success criteria** — Pass/fail checklist
6. **Evidence requirements** — What to record, where to store
7. **Rollback / abort conditions** — When to stop, how to clean up
8. **Post-drill cleanup** — Restore staging to normal state if needed

### 6.2 Operator Prerequisites

| Prerequisite | Notes |
|--------------|-------|
| Access to staging or isolated test environment | SSH, Docker, compose |
| Backup copy (not production restore target) | Copy of dump, config backup |
| Phase 61 runbooks | postgresql-restore, full-stack-rebuild, configuration-restore |
| Phase 61 backup procedures | postgresql-backup-procedure, configuration-backup-procedure |
| Tools | psql, pg_restore, curl, docker compose |

### 6.3 Safety Checks

| Check | Before Drill |
|------|--------------|
| Confirm environment is NOT production | Verify hostname, env vars, no production data |
| Confirm restore target is staging/test | Never restore into production DB |
| Confirm backup is a COPY | Production backup may be copied; restore target is test |
| Confirm operator has rollback plan | Know how to abort and clean up |

### 6.4 Rollback / Abort Conditions

| Condition | Action |
|-----------|--------|
| Restore fails mid-way | Stop; do not leave DB in partial state; retry with same or earlier backup |
| Health checks fail after restore | Do not proceed; diagnose; rollback if needed |
| Wrong environment detected | Abort immediately; do not proceed |
| Operator uncertainty | Abort; escalate; document |

### 6.5 Post-Drill Cleanup

| Drill | Cleanup |
|------|---------|
| Database restore | Restore staging DB to pre-drill state if needed; or leave as restored (staging) |
| Configuration restore | Restore staging config to normal |
| Full stack rebuild | Staging may remain rebuilt; document state |
| Backup integrity | None (read-only) |
| Corrupted deployment | Rollback to known-good; document |

---

## 7. Scheduling / Governance Guidance

### 7.1 Recommended Drill Frequency

| Drill | Frequency | Rationale |
|-------|-----------|-----------|
| Database restore | Quarterly minimum | Validates most critical restore path |
| Configuration restore | Quarterly minimum | Validates config recovery |
| Full stack rebuild | Quarterly minimum | Validates RTO; full procedure |
| Backup integrity | Monthly minimum | Lightweight; catches corrupt backups early |
| Corrupted deployment | As needed | Optional; before major releases |

**Project plan reference:** AI-SANDBOX-PLATFORM-PLAN.md — "Test recovery: Monthly." Phase 62A interprets: at least one drill monthly (backup integrity); full restore drills quarterly.

### 7.2 Ownership / Signoff Expectations

| Role | Responsibility |
|------|-----------------|
| **Drill operator** | Execute drill; record evidence; report pass/fail |
| **Ops lead / SRE** | Schedule drills; review evidence; sign off |
| **Checkpoint retention** | Per Section 7.3 |

### 7.3 Checkpoint / Evidence Retention Requirements

| Evidence | Retention | Location |
|----------|-----------|----------|
| Drill log (date, operator, result, duration) | 12 months minimum | docs/drills/ or equivalent |
| RTO measurement | 12 months | With drill log |
| Pass/fail result | 12 months | With drill log |

### 7.4 Known Risks and Limitations

| Risk | Mitigation |
|------|------------|
| Drills skipped due to operational load | Calendar reminder; quarterly review; mandate in ops runbook |
| Staging differs from production | Document differences; accept that drill validates procedure, not production fidelity |
| Backup copy unavailable | Use staging backup; ensure staging backup procedure exists |
| RTO not achieved | Document; improve procedure or adjust target |
| No automated drill scheduling | By design; no cron in platform; external calendar/ticketing |

---

## 8. Architecture Fit

### 8.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Drills |
|------------|-------------------------|
| No background workers | Platform does not run drills; operator executes manually |
| No cron | No scheduled drill execution inside platform; external scheduling (calendar, ops) |
| No event bus | No drill-complete events; operator records result manually |
| Request-driven | Drills use existing health/API endpoints; no new endpoints |

### 8.2 Single-Node Reality First

- One PostgreSQL, one Redis, no replication
- Full restore required on node loss
- Drills validate single-node restore path only
- No failover drill (no HA)

### 8.3 No Destructive Production Automation

- No automated restore in production
- No automated drill execution in production
- All restore drills target non-production
- Operators perform drills manually

### 8.4 Deferred Future HA/Cloud Improvements

| Improvement | When | Notes |
|-------------|------|-------|
| Multi-node / HA | Architecture change | Would require failover drill design |
| Cloud-managed DB | Migration | PITR, automated backups—different drill scope |
| Automated drill in CI/CD | When approved | External pipeline; not platform cron |

---

## 9. Phase Output Docs

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-62A-DESIGN.md` | This document |
| Checkpoint | `docs/PHASE-62A-CHECKPOINT.md` | Completion record |

**Deferred to later phase:** Validation drill runbooks (e.g. `docs/drills/database-restore-validation-drill.md`). Phase 62A is design only.

---

**END OF DESIGN**
