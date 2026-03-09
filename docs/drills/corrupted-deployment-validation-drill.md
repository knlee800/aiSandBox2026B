# Validation Drill: Corrupted Deployment Recovery (Optional)

**Phase:** 62B  
**Reference:** PHASE-62A-DESIGN.md Section 3.4  
**Procedure:** docs/runbooks/full-stack-rebuild.md, PRODUCTION-LAUNCH-GOVERNANCE.md  
**Frequency:** As needed (before major releases, after corruption incident)

---

## Objective

Prove that rollback + restore procedure works when deployment is corrupted. Optional drill for additional confidence.

---

## Environment Restrictions

| Environment | Allowed |
|-------------|---------|
| Staging | Yes |
| Isolated test | No (staging preferred for deployment simulation) |
| Production | **No** |

---

## Prerequisites

| Item | Notes |
|------|-------|
| Staging environment | With known-good baseline |
| Known-bad image or config | To simulate corruption |
| Phase 61 runbooks | full-stack-rebuild, postgresql-restore, configuration-restore |
| PRODUCTION-LAUNCH-GOVERNANCE.md | Rollback procedure |
| Backup | PostgreSQL, config (if DB affected) |
| Tools | docker compose, curl |
| Operator access | SSH, deployment directory |

---

## Safety Checks (Before Drill)

- [ ] Confirm environment is staging (NOT production)
- [ ] Confirm known-good rollback path exists
- [ ] Confirm backup available if DB restore needed
- [ ] Confirm operator has rollback plan

---

## Execution Steps

1. **Deploy known-bad image or config to staging** — simulate corruption
2. **Execute rollback** — per PRODUCTION-LAUNCH-GOVERNANCE.md
3. **If DB affected** — restore from backup per postgresql-restore.md
4. **Validate recovery**
   - `GET /api/health/db` → 200
   - `GET /api/health/ready` → 200
   - Smoke test: Create session, execute, terminate
5. **Record pass/fail**

---

## Evidence to Capture

| Artifact | Required |
|----------|----------|
| Drill log (date, operator, environment, duration) | Yes |
| Pass/fail result | Yes |
| Health check outputs | Yes |

**Retention:** 12 months minimum.

---

## Pass/Fail Criteria

| Result | Condition |
|--------|-----------|
| **Pass** | Rollback completes; restore if needed; validation passes |
| **Fail** | Rollback fails; inconsistent state |

---

## Abort / Rollback Conditions

| Condition | Action |
|-----------|--------|
| Rollback fails | Escalate; use full-stack-rebuild if needed |
| Wrong environment detected | Abort immediately |
| Operator uncertainty | Abort; escalate; document |

---

## Post-Drill Cleanup

Rollback to known-good; document state.

---

## Signoff Record Requirements

- Drill operator: Name, date, pass/fail
- Ops lead / SRE: Review evidence; sign off
- Retention: 12 months

---

**END OF DRILL RUNBOOK**
