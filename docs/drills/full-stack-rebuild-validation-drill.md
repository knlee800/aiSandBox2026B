# Validation Drill: Full Stack Rebuild / Host Loss Recovery

**Phase:** 62B  
**Reference:** PHASE-62A-DESIGN.md Section 3.3  
**Procedure:** docs/runbooks/full-stack-rebuild.md  
**Frequency:** Quarterly minimum

---

## Objective

Prove that full stack can be rebuilt from scratch using backups. Validate RTO and the Phase 61 full-stack-rebuild runbook.

---

## Environment Restrictions

| Environment | Allowed |
|-------------|---------|
| Staging | Yes |
| Isolated test | Yes |
| Production | **No** — simulates host loss without affecting production |

---

## Prerequisites

| Item | Notes |
|------|-------|
| Clean host or torn-down staging stack | Provisioned with Docker, Docker Compose |
| PostgreSQL backup | From backup procedure |
| Configuration backup | `.env`, docker-compose.prod.yml, monitoring |
| Phase 61 runbook | docs/runbooks/full-stack-rebuild.md |
| Phase 61 backup verification | docs/backup/backup-verification.md |
| Tools | psql, pg_restore, curl, docker compose |
| Operator access | SSH, deployment directory |

---

## Safety Checks (Before Drill)

- [ ] Confirm environment is NOT production
- [ ] Confirm restore target is staging/test
- [ ] Confirm backup is a COPY; restore target is test
- [ ] Confirm operator has rollback plan

---

## Execution Steps

1. **Record start time** — for RTO measurement
2. **Provision clean host or tear down staging stack**
3. **Restore config, PostgreSQL, start services** — follow docs/runbooks/full-stack-rebuild.md
4. **Full validation**
   - `GET /api/health/db` → 200
   - `GET /api/health/ready` → 200
   - `GET /api/runtime/metrics` → 200
   - Smoke test: Create session, execute, terminate
5. **Record end time** — RTO = end - start
6. **Record pass/fail**

---

## Evidence to Capture

| Artifact | Required |
|----------|----------|
| Drill log (date, operator, environment, duration) | Yes |
| Pass/fail result | Yes |
| RTO measurement | Yes |
| Health check outputs | Yes |

**Retention:** 12 months minimum.

---

## Pass/Fail Criteria

| Result | Condition |
|--------|-----------|
| **Pass** | All services up; health/db, health/ready → 200; runtime/metrics → 200; smoke test succeeds |
| **Fail** | Any service fails; health fails; smoke test fails |

---

## Abort / Rollback Conditions

| Condition | Action |
|-----------|--------|
| Step fails | Fix failing step; do not proceed with partial state |
| PostgreSQL restore fails | See postgresql-restore.md rollback guidance |
| Wrong environment detected | Abort immediately |
| Operator uncertainty | Abort; escalate; document |

---

## Post-Drill Cleanup

Staging may remain rebuilt. Document state.

---

## Signoff Record Requirements

- Drill operator: Name, date, pass/fail, RTO
- Ops lead / SRE: Review evidence; sign off
- Retention: 12 months

---

**END OF DRILL RUNBOOK**
