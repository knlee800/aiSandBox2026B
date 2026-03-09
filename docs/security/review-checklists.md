# Security Operations Review Checklists

**Phase:** 63B  
**Reference:** PHASE-63A-DESIGN.md Section 8.2

---

## 1. Security Runbook Review (Quarterly)

**Owner:** Incident responder  
**Frequency:** Quarterly

| Check | Done |
|-------|------|
| All runbooks in docs/runbooks/ reviewed for currency | [ ] |
| PHASE-60 runbooks (Docker, DB, API Gateway, drift, error rate) current | [ ] |
| Security runbooks (credential-compromise, unauthorized-access, backup-exposure, secrets-rotation, emergency-access) current | [ ] |
| Audit-log-review, backup-restore-sensitive-data, privacy-compliance-request-handling current | [ ] |
| Gaps identified and documented | [ ] |
| Updates applied where needed | [ ] |
| Sign-off | _________________ Date: ______ |

---

## 2. Access Control Review (Quarterly)

**Owner:** Platform owner  
**Frequency:** Quarterly

| Check | Done |
|-------|------|
| Operator list documented | [ ] |
| Least privilege confirmed per role | [ ] |
| Unused access revoked | [ ] |
| No shared accounts | [ ] |
| Changes documented | [ ] |
| Sign-off | _________________ Date: ______ |

---

## 3. Secrets Rotation Review (Annually)

**Owner:** Operator  
**Frequency:** Annually minimum

| Check | Done |
|-------|------|
| INTERNAL_SERVICE_KEY rotated (or documented why deferred) | [ ] |
| JWT_SECRET rotated (or documented why deferred) | [ ] |
| POSTGRES_PASSWORD rotated (or documented why deferred) | [ ] |
| REDIS_PASSWORD rotated if in use (or documented why deferred) | [ ] |
| Rotation dates documented | [ ] |
| Sign-off | _________________ Date: ______ |

---

## 4. Backup Security Review (Quarterly)

**Owner:** Operator  
**Frequency:** Quarterly

| Check | Done |
|-------|------|
| Backups encrypted | [ ] |
| Backups off-host | [ ] |
| Access restricted to operators | [ ] |
| Retention per policy | [ ] |
| Findings documented | [ ] |
| Sign-off | _________________ Date: ______ |

---

## 5. Audit Log Review (Monthly)

**Owner:** Platform operator  
**Frequency:** Monthly

| Check | Done |
|-------|------|
| Audit records retrieved for period | [ ] |
| Anomalies reviewed | [ ] |
| Findings documented (or "none") | [ ] |
| Sign-off | _________________ Date: ______ |

---

**Reference:** PHASE-63A-DESIGN.md Section 8.2, 8.3
