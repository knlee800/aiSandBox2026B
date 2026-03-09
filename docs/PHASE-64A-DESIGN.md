# PHASE 64A DESIGN: Legal, Privacy & User Data Rights Readiness

**Phase:** 64A  
**Stage:** STAGE-64A  
**Task:** TASK-64A — Legal, Privacy & User Data Rights Readiness Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-57, PHASE-60, PHASE-61, PHASE-62, PHASE-63 COMPLETE  
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 64A defines launch-ready legal and privacy document scope, terms/privacy/cookie requirements, user data rights handling, operational procedures for export/deletion requests, consent and disclosure expectations, evidence/signoff requirements, and data scope mapping. The design aligns with the current single-node, request-driven architecture—no background workers, no cron, no event bus.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Legal and privacy operations are operator-driven. User data rights requests (export, deletion) are fulfilled manually or via operator-run procedures. No automated retention enforcement, no self-service data portability APIs in platform.

### 1.3 Baseline

- **Governance:** PHASE-57 (rollback plan, launch procedures)
- **Alerting/incident:** PHASE-60 (incident runbooks, external monitoring contract)
- **Backup/DR:** PHASE-61 (backup scope, restore runbooks)
- **Validation drills:** PHASE-62 (restore validation drill design)
- **Security/compliance:** PHASE-63 (audit logging, incident response, privacy/compliance operational readiness)
- **Content privacy:** PHASE-15B (no prompts, no AI responses logged; content privacy by default)
- **Project plan:** Legal/privacy/GDPR expectations where documented

---

## 2. Legal / Privacy Document Scope

### 2.1 Launch-Ready Documents (In Scope)

| Document | Purpose | Owner |
|----------|---------|-------|
| **Privacy Policy** | How user data is collected, used, stored, shared; retention; user rights | Platform owner |
| **Terms of Service** | Acceptable use, service limits, termination, liability | Platform owner |
| **Cookie Notice** | What cookies/tracking are used; purpose; consent | Platform owner |

These documents must exist and be published (e.g. linked from frontend, signup, or account settings) before production launch.

### 2.2 Required Sections (Platform Level)

| Document | Required Sections |
|----------|-------------------|
| **Privacy Policy** | Data collected; purpose; retention; third-party sharing (AI providers); user rights (access, export, deletion, correction); contact for requests; data location; security measures |
| **Terms of Service** | Service description; acceptable use; session limits; termination; disclaimers; governing law |
| **Cookie Notice** | Types of cookies; essential vs optional; how to manage |

### 2.3 In Scope vs Deferred

| In Scope | Deferred |
|----------|----------|
| Document scope definition | Legal counsel review (organizational) |
| Required section checklist | DPA templates |
| Operational procedures for requests | Formal GDPR certification |
| Evidence/signoff expectations | Privacy impact assessment (PIA) process |
| Data scope mapping | Automated consent management |
| Architecture fit | Self-service data portability API |

---

## 3. Terms / Privacy / Cookie Requirements

### 3.1 Privacy Policy Requirements

| Requirement | Expectation |
|-------------|-------------|
| **Data minimization** | Per PHASE-15B: no prompts, no AI responses logged; metadata only |
| **Purpose limitation** | State clearly: session management, AI execution, billing/usage |
| **Retention** | Per policy; document retention periods per data category |
| **Third-party disclosure** | AI providers (Anthropic, OpenAI, Google) receive prompts/responses; document in policy |
| **User rights** | Access, export, deletion, correction (with limitations); how to submit requests |
| **Contact** | Designated contact (email or form) for privacy requests |
| **Updates** | How policy changes are communicated |

### 3.2 Terms of Service Requirements

| Requirement | Expectation |
|-------------|-------------|
| **Service description** | AI-assisted coding sandbox; isolated containers; governed execution |
| **Acceptable use** | No abuse; no prohibited content; rate limits and quotas |
| **Session limits** | Per PRD: idle timeout, max lifetime, concurrent exec limits |
| **Termination** | Platform may terminate; user may delete sessions; termination is permanent |
| **Disclaimers** | AI output accuracy; no warranty; liability limitations |
| **Governing law** | Jurisdiction for disputes |

### 3.3 Cookie Notice Requirements

| Requirement | Expectation |
|-------------|-------------|
| **Essential cookies** | Session/auth cookies; state required for service |
| **Optional cookies** | Analytics, preferences (if any); document and obtain consent where required |
| **Third-party cookies** | If frontend embeds third-party (e.g. analytics), disclose |
| **Management** | How user can manage or disable non-essential cookies |

### 3.4 Consent / Disclosure Requirements

| Scenario | Requirement |
|----------|-------------|
| **Account creation** | User agrees to Terms and Privacy Policy (explicit or by use) |
| **AI execution** | Disclosure that prompts/responses are sent to third-party AI providers |
| **Optional tracking** | Consent before non-essential cookies or analytics |
| **Policy changes** | Notice of material changes; continued use may constitute acceptance |

---

## 4. User Data Rights Handling Requirements

### 4.1 Access / Export Requests

| Requirement | Expectation |
|-------------|-------------|
| **Scope** | User may request export of their data: sessions metadata, usage records, billing/ledger data (if applicable) |
| **Format** | Machine-readable (e.g. JSON, CSV); operator-produced per runbook |
| **Timeline** | Per policy (e.g. 30 days for GDPR); operator-driven; no SLA in platform |
| **Identity verification** | Operator verifies requestor identity (e.g. matches user_id, email) before export |
| **Exclusions** | Session workspace content is ephemeral; not persisted beyond container lifecycle; export only persisted metadata |

### 4.2 Deletion Requests

| Requirement | Expectation |
|-------------|-------------|
| **Scope** | User may request deletion of their data; cascade: sessions → usage_records → ledger (per PHASE-63) |
| **Procedure** | Per `docs/runbooks/privacy-compliance-request-handling.md` |
| **Timeline** | Per policy (e.g. 30 days for GDPR); operator-driven |
| **Identity verification** | Operator verifies requestor identity before deletion |
| **Audit** | Log deletion: when, operator, user_id (hashed or reference only); no PII in audit |
| **Verification** | Confirm no residual user data; document completion |

### 4.3 Correction Limitations

| Limitation | Rationale |
|------------|-----------|
| **Ledger immutability** | Billing/usage records are append-only; correction via adjustment record, not edit |
| **Session metadata** | created_at, terminated_at are immutable; correction limited to non-audit fields if any |
| **Workspace content** | Ephemeral; not persisted; no correction path |
| **AI prompts/responses** | Never stored by platform (PHASE-15B); no correction needed |

### 4.4 Identity Verification / Operator Handling Expectations

| Expectation | Detail |
|-------------|--------|
| **Verification** | Operator confirms requestor is the account owner (e.g. authenticated user, email match) |
| **No over-disclosure** | Export only that user's data; no cross-user data |
| **Documentation** | Document verification method; retain evidence per retention policy |
| **Escalation** | Ambiguous or contested requests escalate to platform owner |

---

## 5. Operational Handling Requirements

### 5.1 Intake, Tracking, Fulfillment, Review, Signoff

| Phase | Expectation |
|-------|-------------|
| **Intake** | Request received via designated channel (email, form); logged with date, request type |
| **Tracking** | Ticket or log entry; status: received, in progress, completed, rejected (with reason) |
| **Fulfillment** | Operator executes per runbook (export or deletion); documents steps |
| **Review** | Platform owner or delegate reviews completion; verifies no residual data (deletion) or correct scope (export) |
| **Signoff** | Operator sign-off on completion; evidence retained per Section 5.2 |

### 5.2 Evidence Requirements

| Activity | Evidence |
|---------|----------|
| **Export request** | Request log; verification record; export package (or reference); completion date; operator |
| **Deletion request** | Request log; verification record; cascade deletion confirmation; completion date; operator |
| **Policy update** | Version history; publication date; notification method |
| **Retention review** | Review date; findings; changes made; sign-off |

### 5.3 Escalation Rules

| Condition | Escalation |
|-----------|------------|
| **Identity unclear** | Escalate to platform owner before fulfilling |
| **Legal/compliance question** | Escalate to legal or compliance (organizational) |
| **Bulk or complex request** | Escalate for scope and timeline review |
| **Data breach suspected** | Per PHASE-63 security incident; P1; contain, document, notify |
| **Dispute** | Escalate to platform owner; document resolution |

---

## 6. Data Scope Mapping

### 6.1 User / Platform Data Categories Covered

| Category | Description | Retention | Export | Deletion |
|----------|-------------|-----------|--------|----------|
| **Session metadata** | id, user_id, created_at, last_activity_at, terminated_at, termination_reason | Until deletion request or policy | Yes | Yes (cascade) |
| **Usage records** | Token usage, execution counts, timestamps | Policy-driven | Yes | Yes (cascade) |
| **Billing/ledger** | Invoices, payments, usage snapshots | Policy-driven; immutable | Yes (metadata) | Anonymize or per policy |
| **Account data** | user_id, email (if stored), auth identifiers | Until deletion | Yes | Yes |
| **Operational audit** | Operator actions; no PII | 12 months minimum | No (operator-only) | Per retention |

### 6.2 Excluded or Constrained by Architecture / Retention / Safety

| Data | Constraint |
|------|------------|
| **Session workspace content** | Ephemeral; lives only in container; not persisted beyond session; not exportable after container removal |
| **Prompts / AI responses** | Never logged by platform (PHASE-15B); not stored; not exportable |
| **Redis / cache** | Ephemeral; not backup target; not in scope for export/deletion |
| **Logs** | No PII per design; operational only; retention per policy; not user-exportable |
| **Backups** | May contain user data; restore target treated as sensitive; deletion requires backup purge or retention expiry |
| **Ledger immutable records** | Correction via adjustment; deletion may require anonymization vs hard delete per policy |

### 6.3 Third-Party Data Flow

| Flow | Disclosure |
|------|-------------|
| **AI providers** | Prompts and responses sent to Anthropic, OpenAI, Google; disclosed in Privacy Policy |
| **No other third parties** | Per current architecture; document if changed |

---

## 7. Architecture Fit

### 7.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Legal/Privacy |
|------------|------------------------------|
| No background workers | No automated retention enforcement; operator or external tool |
| No cron | No scheduled deletion jobs; manual or external scheduler |
| No event bus | No real-time consent or request dispatch; operator-driven |
| Request-driven | No self-service export/deletion API; requests fulfilled out-of-band |

### 7.2 Request-Driven Reality First

- User data rights requests are **operator-fulfilled**
- No platform API for "download my data" or "delete my account"
- Intake via email, form, or support channel
- Fulfillment per runbook; manual database operations or scripts
- Timeline depends on operator capacity; document in policy (e.g. "within 30 days")

### 7.3 Deferred Future Automation / Legal Hardening

| Improvement | When | Notes |
|-------------|------|-------|
| Self-service export API | When product requires | Would need authenticated endpoint; design change |
| Self-service deletion API | When product requires | Cascade logic; design change |
| Automated retention enforcement | When cron/tooling approved | External job or migration |
| Consent management platform | When required | Third-party integration |
| DPA templates | When B2B/enterprise | Organizational |
| GDPR certification | When required | Organizational |

---

## 8. Phase Output Docs

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-64A-DESIGN.md` | This document |
| Checkpoint | `docs/PHASE-64A-CHECKPOINT.md` | Completion record |

---

**END OF DESIGN**
