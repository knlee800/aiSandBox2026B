# Validation Drill: Database Restore

**Phase:** 62B  
**Reference:** PHASE-62A-DESIGN.md Section 3.1  
**Procedure:** docs/runbooks/postgresql-restore.md  
**Frequency:** Quarterly minimum

---

## Objective

Prove that PostgreSQL restore from dump works. Validate that the Phase 61 postgresql-restore runbook is operationally usable.

---

## Environment Restrictions

| Environment | Allowed |
|-------------|---------|
| Staging | Yes |
| Isolated test | Yes |
| Production | **No** — restore target must NOT be production |

**Rule:** Use copy of production dump or staging backup. Restore target is always staging or isolated test DB.

---

## Prerequisites

| Item | Notes |
|------|-------|
| Backup file | Plain `.sql` or custom `.dump` (copy of production or staging backup) |
| Staging or isolated test environment | PostgreSQL container, Docker Compose |
| Phase 61 runbook | docs/runbooks/postgresql-restore.md |
| Tools | psql, pg_restore, curl, docker compose |
| Operator access | SSH, deployment directory |

---

## Safety Checks (Before Drill)

- [ ] Confirm environment is NOT production (verify hostname, env vars, no production data)
- [ ] Confirm restore target is staging/test DB — never production
- [ ] Confirm backup is a COPY; restore target is test
- [ ] Confirm operator has rollback plan (know how to abort and clean up)

---

## Execution Steps

1. **Record start time** — for RTO measurement
2. **Obtain backup** — from production copy or staging backup
3. **Create isolated PostgreSQL instance or use staging DB** — ensure target is empty or acceptable to overwrite
4. **Execute restore** — follow docs/runbooks/postgresql-restore.md (verification, stop services, restore, restart)
5. **Post-restore validation**
   - `GET /api/health/db` → 200
   - `GET /api/health/ready` → 200
   - Smoke test: Create session, execute, terminate
6. **Record end time** — RTO = end - start
7. **Record pass/fail** — per criteria below

---

## Evidence to Capture

| Artifact | Required |
|----------|----------|
| Drill log (date, operator, environment, duration) | Yes |
| Pass/fail result | Yes |
| RTO measurement (elapsed time) | Yes |
| Health check outputs (curl responses) | Yes |

**Retention:** 12 months minimum. Store in docs/drills/ or equivalent.

---

## Pass/Fail Criteria

| Result | Condition |
|--------|-----------|
| **Pass** | Restore completes; GET /api/health/db → 200; GET /api/health/ready → 200; smoke test succeeds |
| **Fail** | Any step fails; health checks fail; smoke test fails |

---

## Abort / Rollback Conditions

| Condition | Action |
|-----------|--------|
| Restore fails mid-way | Stop; do not leave DB in partial state; retry with same or earlier backup |
| Health checks fail after restore | Do not proceed; diagnose; rollback if needed |
| Wrong environment detected | Abort immediately; do not proceed |
| Operator uncertainty | Abort; escalate; document |

---

## Post-Drill Cleanup

Restore staging DB to pre-drill state if needed; or leave as restored (staging). Document final state.

---

## Signoff Record Requirements

- Drill operator: Name, date, pass/fail
- Ops lead / SRE: Review evidence; sign off
- Retention: 12 months

---

**END OF DRILL RUNBOOK**
