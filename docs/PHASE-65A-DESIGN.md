# PHASE 65A DESIGN: Admin Tools & Launch Operations

**Phase:** 65A  
**Stage:** STAGE-65A  
**Task:** TASK-65A — Admin Tools & Launch Operations Design  
**Nature:** DOCUMENTATION / DESIGN (NO CODE)  
**Status:** DESIGN COMPLETE  
**Date:** 2026-03-09  
**Prerequisite:** PHASE-57, PHASE-60, PHASE-63, PHASE-64 COMPLETE  
**Next Phase:** Implementation (when authorized)

---

## 1. Overview

### 1.1 Purpose

Phase 65A defines launch-ready admin tool scope, admin actions and operator permissions, abuse/ban/suspension operational requirements, refund/credit/manual quota adjustment operational requirements, admin health/visibility requirements, and audit/evidence/signoff requirements for admin actions. The design aligns with the current single-node, request-driven architecture—no background workers, no cron, no event bus.

### 1.2 Architectural Constraints

Per ARCHITECTURE.md Section 11:
- No background workers
- No cron jobs
- No event bus

**Implication:** Admin operations are operator-driven. Admin actions are performed via existing internal endpoints or out-of-band procedures (scripts, manual DB operations). No automated admin workflows, no admin UI in platform.

### 1.3 Baseline

- **Governance:** PHASE-57 (rollback plan, launch procedures, go-live checklist)
- **Alerting/incident:** PHASE-60 (incident runbooks, external monitoring contract)
- **Security/compliance:** PHASE-63 (audit logging, incident response, access control, evidence/signoff)
- **Legal/privacy:** PHASE-64 (user data rights, export/deletion procedures)
- **Existing admin:** Task 11A/11B/12B1 internal admin endpoints (user summary, invoice list, void, finalize)

---

## 2. Admin Tool Scope

### 2.1 Launch-Ready Admin Capabilities (In Scope)

| Capability | Source | Purpose |
|------------|--------|---------|
| **User ops summary** | Task 11A | View user quota status, usage, limits |
| **Invoice list (draft)** | Task 11A | List draft invoices with filters |
| **Invoice detail** | Task 11A | View invoice with billing snapshot |
| **Invoice void** | Task 11B | Void draft invoice (X-Admin-Actor required) |
| **Invoice finalize** | Task 12B1 | Finalize draft invoice (X-Admin-Actor required) |
| **Runtime metrics** | PHASE-41A | Session/container counts, connectivity via `/api/runtime/metrics` |
| **Health endpoints** | api-gateway | `/api/health`, `/api/health/db`, `/api/health/ready` |
| **Billing efficiency/trends** | PHASE-59 | Cost efficiency, provider trends (period params) |

All above are **existing** endpoints. No new endpoints in 65A.

### 2.2 In Scope vs Deferred

| In Scope | Deferred |
|----------|----------|
| Design-level admin action catalog | Admin UI (dashboard, forms) |
| Operator permission expectations | Automated abuse detection |
| Abuse/ban/suspension operational procedures | Ban/suspension API endpoints |
| Refund/credit/quota adjustment operational procedures | Refund/credit API endpoints |
| Admin health/visibility requirements | New admin-only metrics endpoints |
| Audit/evidence/signoff requirements for admin actions | Automated audit enforcement |
| Architecture fit and constraints | Background admin jobs |

### 2.3 Launch-Day Admin Reality

- **Visibility:** Operators use existing internal endpoints (curl, Postman, scripts) with `X-Internal-Service-Key`
- **Mutations:** Invoice void/finalize require `X-Admin-Actor` header; operator identity logged
- **No admin UI:** All admin actions are CLI/script-driven or via external tooling
- **No ban/suspension endpoints:** Abuse handling is operational (manual procedures, support channel)

---

## 3. Admin Actions / Operator Permissions

### 3.1 Allowed Admin Actions (Existing)

| Action | Endpoint | Auth | Audit |
|--------|----------|------|-------|
| **View user ops summary** | GET /api/internal/admin/users/:userId/summary | Internal key | Read-only; no mutation log |
| **List draft invoices** | GET /api/internal/admin/invoices | Internal key | Read-only |
| **View invoice detail** | GET /api/internal/admin/invoices/:invoiceId | Internal key | Read-only |
| **Void draft invoice** | POST /api/internal/admin/invoices/:invoiceId/void | Internal key + X-Admin-Actor | voidedBy, voidedAt persisted |
| **Finalize draft invoice** | POST /api/internal/admin/invoices/:invoiceId/finalize | Internal key + X-Admin-Actor | finalizedBy, finalizedAt persisted |

### 3.2 Role / Permission Expectations

| Role | Allowed Actions | Constraint |
|------|-----------------|------------|
| **Platform operator** | Read all admin endpoints; call void/finalize with X-Admin-Actor | Must have INTERNAL_SERVICE_KEY; individual identity in X-Admin-Actor |
| **Incident responder** | Same as platform operator; per PHASE-60/63 runbooks | Escalation per runbook |
| **Platform owner** | All operator actions; approval for sensitive actions | Per Section 3.3 |

**Design-level expectation:** No RBAC in platform. Access control is operational: only operators with INTERNAL_SERVICE_KEY and network access to api-gateway can call admin endpoints. Permission boundaries are organizational, not enforced by code.

### 3.3 Approval Requirements for Sensitive Actions

| Action | Approval | Evidence |
|--------|----------|----------|
| **Invoice void** | Operator discretion; document reason in ticket or runbook | X-Admin-Actor in response; voidedBy in DB |
| **Invoice finalize** | Operator discretion; reconciliation check enforced by endpoint | X-Admin-Actor in response; finalizedBy in DB |
| **Refund (out-of-band)** | Platform owner or delegate; per Section 4 | Ticket; sign-off; audit log |
| **Manual quota adjustment (out-of-band)** | Platform owner or delegate; per Section 4 | Ticket; sign-off; audit log |
| **User ban/suspension (out-of-band)** | Platform owner or delegate; per Section 5 | Ticket; evidence; sign-off |

**Sensitive = financial impact or user restriction.** Approval is operational, not automated.

---

## 4. Abuse / Ban / Suspension Requirements

### 4.1 Abuse Handling Categories

| Category | Definition | Examples |
|----------|------------|----------|
| **Rate limit abuse** | Sustained 429 responses; IP or user exceeding limits | High POST /api/sessions, POST /api/ai/execute |
| **Quota abuse** | User repeatedly hitting quota ceilings | EXCEEDED quota status; support requests for overage |
| **Prohibited use** | Terms violation; prohibited content; malicious behavior | Per Terms of Service |
| **Resource exhaustion** | Attempts to exhaust platform resources | Many sessions, high token usage, container abuse |

### 4.2 Suspension / Restriction / Ban Decision Rules

| Action | When | Who Decides | Evidence Required |
|--------|------|--------------|-------------------|
| **Warning** | First minor abuse; no immediate restriction | Operator | Log entry; user notified |
| **Temporary restriction** | Repeated abuse; quota override revoked; rate limit tightened | Platform owner or delegate | Ticket; abuse evidence; decision log |
| **Account suspension** | Serious or repeated Terms violation | Platform owner | Ticket; evidence; Terms reference; sign-off |
| **Ban** | Severe abuse; fraud; legal requirement | Platform owner | Ticket; evidence; legal/compliance input if needed; sign-off |

**Design-level expectation:** No ban/suspension API in platform. Actions are operational:
- Restriction: Operator adjusts config (if supported) or uses support channel to communicate
- Suspension: Operator or external system prevents login (if auth supports); or manual intervention
- Ban: Same as suspension; permanent; documented

### 4.3 Evidence and Escalation Expectations

| Requirement | Expectation |
|-------------|-------------|
| **Evidence** | Log abuse indicators: user_id, IP, timestamps, endpoint, rate/volume; retain per retention policy |
| **Escalation** | Minor → operator; repeated/serious → platform owner; legal/compliance → organizational |
| **Documentation** | Decision log: action taken, reason, evidence reference, operator, date |
| **Review** | Quarterly review of abuse decisions per PHASE-63 access control review |

---

## 5. Refund / Credit / Manual Quota Adjustment Requirements

### 5.1 When Operators May Act

| Action | When | Constraint |
|--------|------|------------|
| **Refund** | User overcharged; billing error; goodwill (approved) | Per policy; platform owner approval for non-error refunds |
| **Credit** | Compensate user; correct billing error | Per policy; platform owner approval |
| **Manual quota adjustment** | User legitimately needs higher limit; temporary override | Per policy; platform owner approval; time-bound |

### 5.2 Required Checks Before Action

| Check | Expectation |
|-------|-------------|
| **Identity verification** | Confirm user_id; no cross-user action |
| **Approval** | Platform owner or delegate sign-off for non-routine actions |
| **Audit trail** | Document: action, user_id, amount/limit, reason, operator, date |
| **Reversibility** | Document rollback steps if action was incorrect |

### 5.3 Audit / Signoff Expectations

| Action | Audit | Signoff |
|--------|-------|---------|
| **Refund** | Log: user_id, amount, reason, operator, timestamp | Platform owner or delegate |
| **Credit** | Log: user_id, credit amount, reason, operator, timestamp | Platform owner or delegate |
| **Quota adjustment** | Log: user_id, old/new limit, reason, operator, expiry (if any) | Platform owner or delegate |

**Design-level expectation:** No refund/credit/quota API in platform. Actions are out-of-band: payment provider dashboard, manual DB updates, config changes. Ledger corrections per PHASE-63: adjustment records, not edits.

### 5.4 Rollback / Correction Handling

| Scenario | Procedure |
|----------|-----------|
| **Incorrect refund** | Document; contact user; reverse per payment provider; log correction |
| **Incorrect credit** | Document; apply offsetting adjustment; log correction |
| **Incorrect quota** | Revert to default or previous value; log correction |

---

## 6. Admin Health / Visibility Requirements

### 6.1 Minimum Admin-Visible Operational Information

| Information | Source | Purpose |
|-------------|--------|---------|
| **Session counts** | /api/runtime/metrics | activeSessionCount, terminatedSessionCount |
| **Container counts** | /api/runtime/metrics | runningContainerCount |
| **Connectivity** | /api/runtime/metrics | dockerConnectivity, databaseConnectivity |
| **Termination reasons** | /api/runtime/metrics | terminationReasons breakdown |
| **API health** | /api/health, /api/health/db, /api/health/ready | Liveness, DB, readiness |
| **User quota status** | /api/internal/admin/users/:userId/summary | Per-user quota, usage |
| **Draft invoices** | /api/internal/admin/invoices | Billing visibility |
| **Cost efficiency** | /api/billing/efficiency-summary, provider-trends | Cost monitoring |

### 6.2 Launch-Day Monitoring / Verification Needs

Per PHASE-57 and PHASE-60:
- **First 24 hours:** Operators monitor execution success rate, queue backlog, latency, alert activity
- **External monitor** polls /api/runtime/metrics, /api/health, /api/health/ready
- **Admin visibility** via same endpoints; no separate admin dashboard
- **Verification:** Confirm metrics reflect reality; no session–container drift; connectivity stable

### 6.3 Boundaries of Manual Operations

| Boundary | Expectation |
|----------|-------------|
| **No automated admin jobs** | All admin actions are operator-initiated or external-tool-initiated |
| **No cron-driven admin tasks** | External scheduler may run scripts; platform has no cron |
| **Read-only by default** | Mutations (void, finalize) require explicit operator action and X-Admin-Actor |
| **Out-of-band for refund/credit/quota** | No platform API; use payment provider, DB, config |

---

## 7. Audit / Evidence / Signoff Requirements

### 7.1 Required Records for Admin Actions

| Action | Record | Retention |
|--------|--------|-----------|
| **Invoice void** | voidedBy, voidedAt in DB; X-Admin-Actor in request | Per ledger retention |
| **Invoice finalize** | finalizedBy, finalizedAt in DB; X-Admin-Actor in request | Per ledger retention |
| **Refund (out-of-band)** | Ticket; amount; user_id; reason; operator; date | 12 months minimum |
| **Credit (out-of-band)** | Ticket; amount; user_id; reason; operator; date | 12 months minimum |
| **Quota adjustment (out-of-band)** | Ticket; user_id; old/new limit; reason; operator; date | 12 months minimum |
| **Ban/suspension** | Ticket; user_id; evidence; decision; operator; date | 12 months minimum |

### 7.2 Review Expectations

| Review | Frequency | Owner | Purpose |
|--------|-----------|-------|---------|
| **Admin action audit** | Monthly | Platform operator | Review void/finalize and out-of-band actions; anomalies |
| **Abuse decision review** | Quarterly | Platform owner | Abuse handling consistency; escalation patterns |
| **Financial adjustment review** | Monthly | Platform owner or delegate | Refunds, credits; policy compliance |

### 7.3 Retention / Operator Accountability

| Requirement | Expectation |
|-------------|-------------|
| **Retention** | 12 months minimum for admin action records |
| **Accountability** | X-Admin-Actor and voidedBy/finalizedBy provide operator identity |
| **No PII in audit** | Operational metadata only; user_id as reference, not PII |
| **Access** | Restricted to operators and platform owner |

---

## 8. Architecture Fit

### 8.1 Alignment with No-Worker / No-Cron Constraints

| Constraint | Implication for Admin |
|------------|------------------------|
| No background workers | No automated admin jobs; no abuse auto-detection; operator or external tool |
| No cron | No scheduled admin tasks; external scheduler or manual |
| No event bus | No real-time admin event dispatch; polling or manual review |
| Request-driven | Admin actions are HTTP calls to existing endpoints or out-of-band procedures |

### 8.2 Request-Driven Reality First

- **Existing admin endpoints** are internal-only; called by operators with INTERNAL_SERVICE_KEY
- **Mutations** require X-Admin-Actor; audit trail in DB
- **No admin UI** in platform; operators use curl, scripts, Postman, or external dashboards
- **Out-of-band actions** (refund, credit, quota, ban) are manual; no platform API

### 8.3 Deferred Future Admin UI / Automation Improvements

| Improvement | When | Notes |
|-------------|------|-------|
| Admin dashboard UI | When product requires | Web UI for admin endpoints; design change |
| Ban/suspension API | When abuse tooling required | Endpoint to restrict user; schema change |
| Refund/credit API | When billing automation required | Endpoint for adjustments; payment provider integration |
| Automated abuse detection | When cron/tooling approved | External job or background worker; architecture change |
| Admin role RBAC | When multi-operator scaling | Permission model in platform |
| Self-service quota override | When product requires | User-facing or support tool |

---

## 9. Phase Output Docs

| Document | Path | Purpose |
|----------|------|---------|
| Design | `docs/PHASE-65A-DESIGN.md` | This document |
| Checkpoint | `docs/PHASE-65A-CHECKPOINT.md` | Completion record |

---

**END OF DESIGN**
