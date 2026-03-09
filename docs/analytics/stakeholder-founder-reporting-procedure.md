# Stakeholder / Founder Reporting Procedure

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 5

---

## Purpose

Produce periodic reports for stakeholders and founders on usage growth, reliability, and cost efficiency. Per PHASE-66A, stakeholder receives reports from operator (spreadsheet, slide deck) or accesses external BI that polls endpoints. No platform-hosted stakeholder dashboard.

## Scope

**In scope:**
- Usage growth (totalExecutions, totalTokens, totalCostUSD over periods)
- Reliability (error rate, success rate)
- Cost efficiency (cost per execution, cost per 1K tokens, byProvider)
- Session activity (activeSessionCount, terminatedSessionCount)

**Excluded:**
- Real-time dashboards in platform
- Automated report generation (operator or external tool produces)
- Retention/cohort analysis (manual DB or deferred)

## Prerequisites

- Operator with access to api-gateway
- apiKeyId for billing endpoints
- Report template or format agreed with stakeholder
- docs/analytics/product-usage-analytics-review-procedure.md
- docs/analytics/reliability-error-analytics-review-procedure.md
- docs/analytics/cost-efficiency-analytics-review-procedure.md

## Data Sources / Dashboards Used

| Data | Endpoint | Parameters |
|------|----------|------------|
| Session activity | `GET /api/runtime/metrics` | None |
| Usage, cost, reliability | `GET /api/billing/efficiency-summary` | apiKeyId, periodStart, periodEnd |
| Cost trends | `GET /api/billing/provider-trends` | apiKeyId, periodStart, periodEnd |

## Report Structure

### Minimum Report Sections

1. **Executive summary** — 2–3 sentences: usage trend, reliability status, cost trend
2. **Usage** — totalExecutions, totalTokens for period; comparison to prior period
3. **Reliability** — Error termination rate, execution success rate; any incidents
4. **Cost** — totalCostUSD, cost per execution, cost per 1K tokens; byProvider breakdown
5. **Session activity** — activeSessionCount, terminatedSessionCount (point-in-time or snapshot)
6. **Anomalies / follow-up** — Any issues, investigations, or actions

### Report Format

- Spreadsheet (CSV, XLSX) or slide deck (PDF, PPTX)
- Include period (periodStart–periodEnd) and report date
- Include data source (endpoint, params) for traceability

## Review Steps (Report Production)

1. **Define report period** — e.g. last 7 days, last 30 days
2. **Gather data** — Follow product-usage, reliability, cost-efficiency procedures
3. **Populate report template** — Fill sections with gathered data
4. **Add interpretation** — Brief notes on trends, anomalies
5. **Deliver** — Email, shared drive, or stakeholder-designated channel
6. **Retain copy** — Per evidence requirements

## Interpretation Guidance

| Metric | Stakeholder-Relevant Interpretation |
|--------|-------------------------------------|
| totalExecutions up | Usage growth; platform adoption |
| totalCostUSD up, executions flat | Cost efficiency declining; investigate |
| Error rate > 20% | Reliability concern; incident or remediation in progress |
| Success rate < 95% | Execution quality issue; under investigation |
| One provider > 80% cost | Provider concentration; consider diversification |

## Escalation / Follow-Up Handling

| Condition | Action |
|-----------|--------|
| Stakeholder questions data | Operator provides endpoint, params, procedure reference |
| Stakeholder requests new metric | Document request; escalate to platform owner for scope |
| Report delivery failure | Retry; document; escalate if persistent |
| Anomaly in report | Note in report; follow relevant procedure (reliability, cost) |

## Evidence to Retain

- Report copy (spreadsheet, slide deck)
- Data snapshots used (or reference to procedure evidence)
- Delivery confirmation (date, recipient)
- Retention: 12 months minimum per PHASE-65

## Signoff Requirements

- Report produced: Operator sign-off
- Report reviewed: Stakeholder acknowledgment (per org process)
- Launch stakeholder report: Platform owner sign-off (sample report with usage, cost, reliability)

---

**Reference:** PHASE-66A-DESIGN.md Section 5; docs/analytics/review-cadence-ownership-signoff-guidance.md
