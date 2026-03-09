# PHASE 63A DESIGN: Security Operations & Compliance Readiness

**Phase:** 63A  
**Stage:** STAGE-63A  
**Task:** TASK-63A — Security Operations & Compliance Readiness Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-57, PHASE-60, PHASE-61, PHASE-62 COMPLETE  
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 63A defines security operations scope for launch readiness, including audit logging, incident response, access control, secrets handling, backup encryption, privacy/compliance, and security runbook requirements. The design aligns with the current single-node, request-driven architecture—no background workers, no cron, no event bus.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Security operations are operator-driven or performed by external tooling. The platform exposes signals and logs; it does not run automated security jobs.

### 1.3 Baseline

- **Governance:** PHASE-57 (rollback plan, launch procedures)
- **Alerting/incident:** PHASE-60 (incident runbooks, external monitoring contract)
- **Backup/DR:** PHASE-61 (backup scope, restore runbooks)
- **Validation drills:** PHASE-62 (restore validation drill design)
- **Project plan:** RTO 1h, RPO 15min (aspirational); security/privacy expectations where documented

---

## 2. Security Operations Scope

### 2.1 Launch-Ready Security Operations (In Scope)

| Operation | Owner | Frequency | Notes |
|-----------|-------|-----------|-------|
| **Audit log review** | Operator | Per Section 3 | Review operational audit records |
| **Security incident response** | Incident responder | On trigger | Per PHASE-60 runbooks + security extensions |
| **Secrets rotation** | Operator | Per policy | INTERNAL_SERVICE_KEY, JWT_SECRET, DB passwords |
| **Backup encryption verification** | Operator | Per backup procedure | Confirm backups stored encrypted |
| **Access control review** | Operator | Quarterly | Who has operator access; least privilege |
| **Security runbook review** | Operator | Quarterly | Runbooks current; gaps identified |
| **Privacy/compliance checklist** | Operator | Per policy | Data handling, retention, deletion readiness |

### 2.2 Deferred (Out of Scope for 63A)

| Capability | Rationale |
|------------|-----------|
| Automated security scanning | Requires cron or background worker |
| SIEM integration | External; design-level only; no implementation |
| Penetration testing automation | Manual; out-of-band |
| SOC 2 / ISO 27001 certification | Organizational; beyond platform design |
| Real-time intrusion detection | Requires event bus or background workers |
| Automated vulnerability scanning | Requires scheduled jobs |

### 2.3 In Scope vs Deferred Summary

**In scope:** Operational procedures, runbook requirements, design-level expectations for audit, incident response, access control, backup protection, privacy readiness, and security review. All operator-driven or external-tooling-driven.

**Deferred:** Automated security tooling, certification processes, real-time detection, in-platform security agents.

---

## 3. Audit Logging / Review Requirements

### 3.1 Required Operational Audit Records

| Event | What to Log | Retention |
|-------|-------------|-----------|
| **Operator access** | Who, when, action (e.g. config change, restore) | 12 months minimum |
| **Secrets rotation** | When, which secret, operator | 12 months minimum |
| **Restore operations** | When, which runbook, operator, outcome | 12 months minimum |
| **Incident response** | Incident type, operator, actions taken, resolution | 12 months minimum |
| **Security-relevant config changes** | What changed, when, by whom | 12 months minimum |

**Design-level expectation:** Audit records are append-only. No user content, no prompts, no PII in audit logs (per Phase 15B/22 privacy policy). Operational metadata only.

### 3.2 Review Frequency and Ownership

| Review | Frequency | Owner | Purpose |
|--------|-----------|-------|---------|
| **Audit log review** | Monthly | Platform operator | Detect anomalies, unauthorized access |
| **Access control review** | Quarterly | Platform owner | Confirm least privilege; revoke unused access |
| **Security runbook review** | Quarterly | Incident responder | Ensure runbooks current; identify gaps |

### 3.3 Retention and Access Expectations

- **Retention:** 12 months minimum for operational audit records
- **Access:** Restricted to operators and platform owner; no application access
- **Storage:** Off-host or in secured operator-only storage; encrypted at rest where feasible
- **Deferred:** Automated retention enforcement (requires cron); manual or external tooling

---

## 4. Security Incident Response Requirements

### 4.1 Incident Classes

| Class | Definition | Examples |
|-------|------------|----------|
| **P1 — Critical** | Platform down or core dependency compromised | Docker down, DB down, suspected credential compromise |
| **P2 — Warning** | Degraded state or potential security impact | Session–container drift, elevated errors, suspected abuse |
| **P3 — Informational** | Security-relevant but no immediate impact | Audit anomaly, policy violation |

### 4.2 Triage / Escalation Expectations

| Severity | Triage Target | Escalation |
|----------|---------------|------------|
| P1 | Immediate | Page on-call; escalate to platform owner if unresolved in 30 min |
| P2 | Within 4 hours | Create ticket; escalate if unresolved in 4 hours |
| P3 | Within 24 hours | Log; review in next audit cycle |

### 4.3 Containment / Recovery / Post-Incident Requirements

| Phase | Requirements |
|-------|--------------|
| **Containment** | Isolate affected systems; revoke compromised credentials; stop propagation |
| **Recovery** | Restore per PHASE-61 runbooks; rotate secrets if compromise suspected; verify health |
| **Post-incident** | Document incident, root cause, remediation; update runbooks if gaps found; sign-off |

### 4.4 Security-Specific Incident Triggers

| Trigger | Incident Class | Response |
|---------|----------------|----------|
| Suspected credential compromise | P1 | Rotate all secrets; revoke access; investigate |
| Unauthorized operator access | P1 | Revoke access; audit log review; contain |
| Backup exposure (unencrypted, public) | P1 | Rotate secrets; secure backup; investigate |
| Data breach or PII exposure | P1 | Contain; notify per policy; document |
| PHASE-60 connectivity/operational incidents | Per PHASE-60 | Use existing runbooks |

---

## 5. Access Control / Secrets Handling Requirements

### 5.1 Operator Handling Rules

| Rule | Expectation |
|------|-------------|
| **Least privilege** | Operators have minimum access needed for role |
| **No shared accounts** | Individual operator identity; no shared root/admin |
| **Access review** | Quarterly review; revoke unused access |
| **Emergency access** | Documented in runbook; logged; reviewed post-use |

### 5.2 Rotation / Storage Expectations

| Secret | Rotation | Storage |
|--------|----------|---------|
| **INTERNAL_SERVICE_KEY** | On compromise; annually minimum | `.env`; identical across api-gateway, ai-service, container-manager |
| **JWT_SECRET** | On compromise; annually minimum | `.env`; api-gateway only |
| **POSTGRES_PASSWORD** | On compromise; annually minimum | `.env`; all services using DB |
| **REDIS_PASSWORD** | On compromise; annually minimum | `.env`; if Redis in use |

**Rotation procedure:** Update `.env`; restart all services with new values; verify health. Document in runbook.

### 5.3 Emergency Access Guidance

- **When:** Platform down and normal access unavailable
- **Procedure:** Per documented emergency access runbook; log all actions; post-incident review required
- **Constraint:** No backdoors; no undocumented credentials; all access auditable

---

## 6. Sensitive Data / Backup Protection Requirements

### 6.1 Encryption Expectations

| Asset | At Rest | In Transit |
|-------|---------|------------|
| **PostgreSQL backups** | Encrypted (e.g. GPG, cloud provider encryption) | TLS when transferring |
| **Configuration backups** | Encrypted (secrets in config) | TLS when transferring |
| **Database (production)** | Per deployment (e.g. volume encryption) | TLS (DATABASE_URL with ssl) |

### 6.2 Backup Handling Constraints

| Constraint | Expectation |
|------------|-------------|
| **Off-host storage** | Backups must not reside only on production node |
| **Access control** | Restrict to operators; no application access |
| **Integrity** | Checksum verification per PHASE-61 backup-verification |
| **Retention** | Per policy (e.g. 30 days daily, 1 year weekly) |

### 6.3 Restore-Time Protection Requirements

- Restore target (staging/test) must have same access controls as production
- Restored data treated as sensitive; no exposure to untrusted networks
- Post-restore: verify no residual sensitive data in logs or temp files

---

## 7. Privacy / Compliance Readiness

### 7.1 GDPR / Privacy Operational Readiness (Where Applicable)

| Requirement | Design-Level Expectation |
|-------------|--------------------------|
| **Data minimization** | Ledger and audit logs contain no prompts, no responses, no PII (Phase 15B/22) |
| **Right to erasure** | Design supports: user deletion can cascade to sessions, usage; operational procedures for deletion runbook |
| **Data retention** | Policy-driven; design supports configurable retention; operator enforces |
| **Auditability** | Audit trail for operational actions; ledger for usage; no sensitive content in audit |
| **Breach notification** | Procedure in security incident runbook; document, contain, notify per policy |

### 7.2 Data Handling / Deletion / Auditability Expectations

| Area | Expectation |
|------|-------------|
| **User data** | Sessions, workspace: ephemeral per container; not persisted beyond session |
| **Usage/billing data** | Ledger: immutable; retention per policy; deletion procedure documented |
| **Operational logs** | No PII; retention per policy; operator access only |
| **Deletion** | Runbook for user data deletion; cascade rules; verification steps |

### 7.3 Deferred

- Formal GDPR compliance certification
- Data processing agreements (DPA) templates
- Automated retention enforcement
- Privacy impact assessment (PIA) process

---

## 8. Security Runbook / Review Requirements

### 8.1 Required Runbook Categories

| Category | Runbooks Required |
|----------|-------------------|
| **Incident response** | Per PHASE-60 (Docker, DB, API Gateway, drift, error rate) |
| **Security incidents** | Credential compromise, unauthorized access, backup exposure |
| **Secrets** | Secrets rotation procedure, emergency rotation |
| **Access** | Access revocation, emergency access |

### 8.2 Required Review Checklists

| Checklist | Frequency | Content |
|-----------|-----------|---------|
| **Security runbook review** | Quarterly | All runbooks current; gaps identified; updates applied |
| **Access control review** | Quarterly | Operator list; least privilege; revoke unused |
| **Secrets rotation review** | Annually | All secrets rotated per policy; document dates |
| **Backup security review** | Quarterly | Backups encrypted; off-host; access restricted |

### 8.3 Evidence / Signoff Expectations

| Activity | Evidence | Signoff |
|----------|----------|---------|
| **Audit log review** | Review log; anomalies documented or none | Operator sign-off |
| **Access control review** | Access list; changes made | Platform owner sign-off |
| **Security runbook review** | Runbook versions; updates applied | Incident responder sign-off |
| **Drill execution** | Per PHASE-62; drill log, pass/fail | Operator sign-off |

---

## 9. Architecture Fit

### 9.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Security Ops |
|------------|------------------------------|
| No background workers | No automated security scanning; operator or external tool |
| No cron | No scheduled security jobs; external scheduler or manual |
| No event bus | No real-time security event dispatch; polling or manual review |
| Request-driven | Security operations are out-of-band; no platform APIs for security automation |

### 9.2 Single-Node Reality

- One database instance; one container runtime
- No distributed secrets; single `.env` or equivalent
- Full restore required on node loss (per PHASE-61)
- Operator access to single node; no multi-region failover

### 9.3 Deferred Future Hardening / Cloud / HA Improvements

| Improvement | When | Notes |
|-------------|------|-------|
| Cloud-managed secrets (e.g. Vault, AWS Secrets Manager) | Migration to cloud | Centralized rotation, audit |
| SIEM integration | When SOC/security team requires | Forward logs to SIEM; design-level |
| Automated vulnerability scanning | When CI/CD approved | External tool; not in platform |
| HA / multi-node | Architecture change | Distributed secrets; design change |
| mTLS / internal API keys | Per CLAUDE.md future protection | Placeholder only; not implemented |

---

## 10. Phase Output Docs

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-63A-DESIGN.md` | This document |
| Checkpoint | `docs/PHASE-63A-CHECKPOINT.md` | Completion record |

---

**END OF DESIGN**
