# Cost / Efficiency Analytics Review Procedure

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 4; PHASE-59A-DESIGN.md

---

## Purpose

Review cost and efficiency visibility to assess spend, provider mix, cost per execution, and optimization opportunities. Per PHASE-66A, data comes from billing endpoints (efficiency-summary, provider-trends). Cost visibility is apiKeyId-scoped; per-user cost requires manual aggregation.

## Scope

**In scope:**
- Total cost for period (totalCostUSD)
- Cost by provider (byProvider)
- Cost per execution, cost per 1K tokens
- Provider trends (daily granularity)
- Correlation: cost spike vs usage, error cost (failed executions)

**Excluded:**
- Per-user cost aggregation (manual DB or deferred)
- Automated cost alerts (informational only)
- Billing enforcement (separate from analytics)

## Prerequisites

- Network access to api-gateway
- curl, Postman, or equivalent
- apiKeyId for billing endpoints
- periodStart, periodEnd (ISO 8601) for time window

## Data Sources / Dashboards Used

| Data | Endpoint | Parameters |
|------|----------|------------|
| Efficiency summary | `GET /api/billing/efficiency-summary` | apiKeyId, periodStart, periodEnd |
| Provider trends | `GET /api/billing/provider-trends` | apiKeyId, periodStart, periodEnd |

## Review Steps

1. **Obtain efficiency summary** — `GET /api/billing/efficiency-summary?apiKeyId=...&periodStart=...&periodEnd=...`
   - Record totalCostUSD, totalTokens, totalExecutions, completedExecutions, failedExecutions
   - Record byProvider (provider, totalCostUSD, totalTokens, totalRequests)

2. **Compute derived metrics**
   - Cost per execution: `totalCostUSD / completedExecutions` (avoid div by zero)
   - Cost per 1K tokens: `totalCostUSD / (totalTokens / 1000)` (avoid div by zero)
   - Failed execution share: `failedExecutions / (completedExecutions + failedExecutions)`

3. **Obtain provider trends** — `GET /api/billing/provider-trends?apiKeyId=...&periodStart=...&periodEnd=...`
   - Review daily cost by provider
   - Identify spikes, trend changes

4. **Compare periods** — For weekly/monthly review:
   - Call efficiency-summary for this period and prior period
   - Compare totalCostUSD, totalExecutions, cost per execution
   - Note growth or efficiency change

5. **Correlate with reliability** — If failedExecutions high:
   - Failed executions may incur cost (tokens used before failure)
   - Document for reliability review

## Interpretation Guidance

| Observation | Interpretation |
|-------------|----------------|
| totalCostUSD growing, totalExecutions flat | Cost per execution rising; check provider mix, pricing |
| totalCostUSD growing, totalExecutions growing | Usage growth; expected |
| One provider dominates cost | Consider provider efficiency; cost per 1K tokens comparison |
| failedExecutions high | Failed executions may still incur cost; reliability issue |
| Cost per 1K tokens varies by provider | Efficiency signal; compare to platform average |
| Provider trend spike on specific day | Correlate with deployment, incident, or usage spike |

## Escalation / Follow-Up Handling

| Condition | Action |
|-----------|--------|
| Cost spike unexplained | Investigate usage, provider mix; document |
| Cost per execution rising | Review provider pricing; consider provider mix change |
| Failed execution cost significant | Escalate to reliability review; reduce failure rate |
| Billing endpoint returns error | Check apiKeyId, period params; escalate if platform issue |

## Evidence to Retain

- efficiency-summary response (or key fields) for review period
- provider-trends response (or summary) for review period
- Computed cost per execution, cost per 1K tokens
- Review log: date, operator, findings, anomalies
- Retention: 12 months minimum per PHASE-65

## Signoff Requirements

- Weekly cost review: Platform owner or delegate sign-off
- Monthly cost review: Platform owner sign-off
- Launch cost visibility: Platform owner sign-off (endpoints return valid data for test period)

---

**Reference:** PHASE-66A-DESIGN.md Section 4; PHASE-59A-DESIGN.md; docs/analytics/metric-definitions-interpretation-guidance.md
