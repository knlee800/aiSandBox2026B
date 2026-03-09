# Review Cadence / Ownership / Signoff Guidance

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 5, 6

---

## Purpose

Define review cadence, ownership, and signoff expectations for analytics and growth visibility. Per PHASE-66A, operators and stakeholders obtain visibility via existing endpoints. This guidance ensures consistent review rhythm and accountability.

## Scope

**In scope:**
- Review frequency by type (operational health, cost, usage, reliability)
- Owner assignment
- Signoff requirements
- Escalation and evidence retention

**Excluded:**
- Automated review scheduling (external scheduler or manual)
- Platform-hosted review workflow
- New roles or permissions in platform

---

## Review Cadence

| Review | Frequency | Owner | Data Sources |
|--------|-----------|-------|--------------|
| **Operational health** | Continuous (external monitor) | Operator | runtime/metrics, health endpoints |
| **Cost review** | Weekly | Platform owner or delegate | efficiency-summary, provider-trends |
| **Usage/growth review** | Weekly or monthly | Stakeholder (with operator support) | efficiency-summary, provider-trends |
| **Reliability review** | Weekly | Operator | runtime/metrics, efficiency-summary |
| **Product/usage analytics review** | Weekly | Operator | runtime/metrics, efficiency-summary, admin users |
| **Stakeholder report** | Weekly or monthly | Operator produces; Stakeholder consumes | All above |
| **Analytics signoff** | Per launch milestone | Platform owner | Evidence per PHASE-66A Section 6 |

---

## Ownership

| Role | Responsibilities |
|------|------------------|
| **Operator** | Run operational health, reliability, product/usage reviews; produce stakeholder report; retain evidence |
| **Platform owner or delegate** | Cost review; analytics signoff; approve scope changes |
| **Stakeholder** | Consume reports; acknowledge; request clarifications or new metrics (escalate to platform owner) |

**Design-level expectation:** No RBAC in platform. Ownership is organizational, not enforced by code.

---

## Signoff Requirements

### Per-Review Signoff

| Review | Signoff | Evidence |
|--------|---------|----------|
| Weekly usage review | Operator sign-off on completion | Review log; metrics snapshot |
| Weekly reliability review | Operator sign-off on completion | Review log; error rate; incident log if P1/P2 |
| Weekly cost review | Platform owner or delegate sign-off | Review log; efficiency-summary snapshot |
| Monthly usage review | Platform owner or delegate sign-off | Review log; trend summary |
| Stakeholder report | Operator sign-off (produced); Stakeholder acknowledgment (per org) | Report copy; delivery confirmation |

### Milestone Signoff

| Milestone | Signoff | Evidence |
|-----------|---------|----------|
| **Launch analytics readiness** | Platform owner | Checklist: all required visibility obtainable from existing endpoints |
| **Cost visibility** | Platform owner | efficiency-summary, provider-trends return valid data for test period |
| **Reliability visibility** | Operator | runtime/metrics returns terminationReasons; error rate computable |
| **Operator dashboard** | Operator | Document or script showing how to obtain each required view |
| **Stakeholder report** | Platform owner | Sample report (spreadsheet/slide) with weekly usage, cost, reliability |

---

## Escalation

| Condition | Escalate To | Action |
|-----------|-------------|--------|
| P1 incident | On-call; platform owner if unresolved in 30 min | Per PHASE-60 |
| P2 incident | Operator; platform owner if unresolved in 4 hours | Per PHASE-60 |
| Metric not obtainable | Platform owner | Document gap; scope for future endpoint |
| Stakeholder requests new metric | Platform owner | Document request; evaluate scope |
| Review cadence insufficient | Platform owner | Adjust frequency; document |

---

## Evidence to Retain

| Evidence | Retention |
|----------|-----------|
| Review logs | 12 months minimum |
| Metrics snapshots | 12 months minimum |
| Stakeholder reports | 12 months minimum |
| Signoff records | 12 months minimum |
| Incident logs | Per PHASE-60 |

Per PHASE-65 audit expectations.

---

## Procedure References

| Review Type | Procedure |
|-------------|-----------|
| Product/usage | docs/analytics/product-usage-analytics-review-procedure.md |
| Reliability/error | docs/analytics/reliability-error-analytics-review-procedure.md |
| Cost/efficiency | docs/analytics/cost-efficiency-analytics-review-procedure.md |
| Stakeholder report | docs/analytics/stakeholder-founder-reporting-procedure.md |
| Metric definitions | docs/analytics/metric-definitions-interpretation-guidance.md |

---

**Reference:** PHASE-66A-DESIGN.md Section 5, 6; PHASE-65A-DESIGN.md Section 7
