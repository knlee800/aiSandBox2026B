# Retention and Handling Expectations

**Phase:** 63B  
**Reference:** PHASE-63A-DESIGN.md Section 3.3, 6.2, 7

---

## 1. Operational Audit Records

| Record Type | Retention | Handling |
|-------------|-----------|----------|
| Operator access | 12 months minimum | Append-only; operator-only access; no PII |
| Secrets rotation | 12 months minimum | When, which secret, operator |
| Restore operations | 12 months minimum | When, runbook, operator, outcome |
| Incident response | 12 months minimum | Incident type, actions, resolution |
| Security-relevant config changes | 12 months minimum | What changed, when, by whom |

**Storage:** Off-host or secured operator-only storage; encrypted at rest where feasible.

---

## 2. Backup Retention

| Backup Type | Retention (example) | Handling |
|-------------|---------------------|----------|
| PostgreSQL dumps | 30 days daily; 1 year weekly | Encrypted; off-host; operator access only |
| Configuration | Versioned with deployment | Encrypted; off-host |
| SQLite (if used) | Same as PostgreSQL | Off-host |

**Constraint:** Backups must not reside only on production node.

---

## 3. Data Handling (Privacy / Compliance)

| Data Area | Retention | Handling |
|-----------|-----------|----------|
| **User data (sessions, workspace)** | Ephemeral per container | Not persisted beyond session |
| **Usage/billing data (ledger)** | Policy-driven | Immutable; retention per policy; deletion procedure documented |
| **Operational logs** | Policy-driven | No PII; operator access only |
| **Audit logs** | 12 months minimum | No user content, no prompts, no PII; operational metadata only |

---

## 4. Deletion

- **User deletion (right to erasure):** Per privacy-compliance-request-handling runbook; cascade to sessions, usage, ledger per policy
- **Retention enforcement:** Manual or external tooling; no cron in platform (per architecture)

---

## 5. Evidence Retention

- Security review evidence: 12 months minimum
- Drill logs: Per PHASE-62; 12-month retention
- Incident reports: 12 months minimum

---

**Reference:** PHASE-63A-DESIGN.md Section 3, 6, 7
