# Security Operations: Operator Prerequisites and Safety Constraints

**Phase:** 63B  
**Reference:** PHASE-63A-DESIGN.md Section 5

---

## 1. Operator Prerequisites

### 1.1 Access Requirements

- Operator identity with individual (non-shared) credentials
- Access to `.env` or equivalent for secrets rotation
- Access to audit records and runbooks
- Ability to restart services (api-gateway, ai-service, container-manager)

### 1.2 Knowledge Requirements

- PHASE-60 incident runbooks (Docker, DB, API Gateway, drift, error rate)
- PHASE-61 backup and restore procedures
- PHASE-63A design (security operations scope)
- Security runbooks in docs/runbooks/

### 1.3 Tools

- Access to health endpoints: `/api/health`, `/api/health/ready`, `/api/health/db`
- Access to `/api/runtime/metrics` for connectivity and drift checks
- Backup/restore tools per docs/backup/

---

## 2. Safety Constraints

### 2.1 Access Control Rules

| Rule | Expectation |
|------|-------------|
| **Least privilege** | Operators have minimum access needed for role |
| **No shared accounts** | Individual operator identity; no shared root/admin |
| **Access review** | Quarterly review; revoke unused access |
| **Emergency access** | Documented in runbook; logged; reviewed post-use |

### 2.2 Operational Constraints

| Constraint | Expectation |
|------------|-------------|
| **No backdoors** | No undocumented credentials or access paths |
| **All access auditable** | Every operator action logged |
| **Restore target** | Staging or isolated test only; never production for drills |
| **Secrets consistency** | INTERNAL_SERVICE_KEY identical across api-gateway, ai-service, container-manager |

### 2.3 Pre-Action Safety Checks

- **Before restore:** Verify backup integrity; confirm restore target is non-production
- **Before secrets rotation:** Confirm all services can be restarted; verify health check endpoints
- **Before config change:** Document change; have rollback plan

---

## 3. Escalation

- **P1:** Page on-call; escalate to platform owner if unresolved in 30 min
- **P2:** Create ticket; escalate if unresolved in 4 hours
- **P3:** Log; review in next audit cycle

---

**Reference:** PHASE-63A-DESIGN.md Section 5, docs/backup/operator-prerequisites.md
