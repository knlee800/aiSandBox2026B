# Validation Drill: Configuration / Secrets Restore

**Phase:** 62B  
**Reference:** PHASE-62A-DESIGN.md Section 3.2  
**Procedure:** docs/runbooks/configuration-restore.md  
**Frequency:** Quarterly minimum

---

## Objective

Prove that configuration restore works and INTERNAL_SERVICE_KEY consistency is maintained. Validate that the Phase 61 configuration-restore runbook is operationally usable.

---

## Environment Restrictions

| Environment | Allowed |
|-------------|---------|
| Staging | Yes |
| Isolated test | Yes |
| Production | **No** — no production config overwrite |

---

## Prerequisites

| Item | Notes |
|------|-------|
| Configuration backup | From backup procedure (`.env`, compose, monitoring) |
| Staging or isolated test environment | Running stack |
| Phase 61 runbook | docs/runbooks/configuration-restore.md |
| Tools | curl, docker compose |
| Operator access | SSH, deployment directory |

---

## Safety Checks (Before Drill)

- [ ] Confirm environment is NOT production
- [ ] Confirm staging config can be overwritten (stash current if needed)
- [ ] Confirm backup is from intended point-in-time
- [ ] Confirm operator has rollback plan

---

## Execution Steps

1. **Stash current staging config** — or use backup copy
2. **Corrupt or remove** `.env` / compose config (simulate loss)
3. **Restore from backup** — follow docs/runbooks/configuration-restore.md
4. **Restart services** — api-gateway, ai-service, container-manager, frontend
5. **Verify health and internal auth**
   - `GET /api/health` → 200
   - `GET /api/health/ready` → 200
   - `GET /api/health/db` → 200
   - Internal service auth works (no 401/403 on internal calls)
6. **Smoke test** — Create session, execute, terminate
7. **Record pass/fail**

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
| **Pass** | Config restored; services start; health/ready → 200; internal auth works |
| **Fail** | Config missing; services fail to start; auth broken |

---

## Abort / Rollback Conditions

| Condition | Action |
|-----------|--------|
| Restore fails | Revert to previous config; restart services |
| INTERNAL_SERVICE_KEY mismatch | Update `.env` so all services use same value; restart all |
| Wrong environment detected | Abort immediately |
| Operator uncertainty | Abort; escalate; document |

---

## Post-Drill Cleanup

Restore staging config to normal. Document final state.

---

## Signoff Record Requirements

- Drill operator: Name, date, pass/fail
- Ops lead / SRE: Review evidence; sign off
- Retention: 12 months

---

**END OF DRILL RUNBOOK**
