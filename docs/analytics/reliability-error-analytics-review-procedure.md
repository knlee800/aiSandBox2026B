# Reliability / Error Analytics Review Procedure

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 4; PHASE-60A-DESIGN.md

---

## Purpose

Review reliability and error visibility to assess platform health, identify degradation, and correlate failures with cost or connectivity. Per PHASE-66A, data comes from runtime/metrics and efficiency-summary. When error rate exceeds PHASE-60 threshold (20%), follow incident runbooks.

## Scope

**In scope:**
- Error termination rate (session-level)
- Failed executions (execution-level)
- Execution success rate
- Connectivity status (Docker, database)
- Correlation: error rate vs cost, connectivity vs reliability

**Excluded:**
- Real-time alerting (handled by external monitor per PHASE-60)
- Automated remediation (operator-driven)
- Historical time-series storage (external system if needed)

## Prerequisites

- Network access to api-gateway
- curl, Postman, or equivalent
- PHASE-60 runbooks available (docker-connectivity-lost, database-connectivity-lost, elevated-error-termination-rate, session-container-drift)
- For billing correlation: apiKeyId, periodStart, periodEnd

## Data Sources / Dashboards Used

| Data | Endpoint | Parameters |
|------|----------|------------|
| Session termination reasons | `GET /api/runtime/metrics` | None |
| Connectivity | `GET /api/runtime/metrics` | None |
| Failed executions | `GET /api/billing/efficiency-summary` | apiKeyId, periodStart, periodEnd |
| Session–container drift | `GET /api/runtime/metrics` | activeSessionCount vs runningContainerCount |

## Review Steps

1. **Obtain runtime metrics** — `GET /api/runtime/metrics`
   - Record dockerConnectivity, databaseConnectivity
   - Record terminatedSessionCount, terminationReasons
   - Compute error termination rate: `errorCount = sum(terminationReasons[].count where reason === "error")`; `rate = errorCount / terminatedSessionCount`

2. **Check connectivity** — dockerConnectivity and databaseConnectivity must be true
   - If false: P1 incident; follow PHASE-60 runbooks immediately

3. **Evaluate error termination rate** — Per PHASE-60:
   - If rate > 0.2 (20%) AND terminatedSessionCount >= 10: Warning (P2); investigate
   - If rate > 0.2 with low volume: Monitor; may be noise

4. **Obtain efficiency summary** — `GET /api/billing/efficiency-summary?periodStart=...&periodEnd=...`
   - Record failedExecutions, completedExecutions
   - Compute execution success rate: `completedExecutions / (completedExecutions + failedExecutions)`

5. **Correlate session vs execution failures** — When error termination rate elevated:
   - Session-level errors (terminationReasons) vs execution-level (failedExecutions)
   - Failed executions may incur cost; document for cost review

6. **Check session–container drift** — activeSessionCount vs runningContainerCount
   - If persistently different (3+ poll cycles): P2 incident; follow session-container-drift runbook

## Interpretation Guidance

| Observation | Interpretation |
|-------------|----------------|
| dockerConnectivity false | Docker down; P1; follow docker-connectivity-lost runbook |
| databaseConnectivity false | DB down; P1; follow database-connectivity-lost runbook |
| Error termination rate > 20% (vol ≥ 10) | Elevated failures; P2; investigate container-manager logs, AI provider |
| Execution success rate < 95% | Execution-level issues; check AI provider, ai-service logs |
| failedExecutions high, error terminations high | Both session and execution failing; systemic issue |
| activeSessionCount ≠ runningContainerCount (persistent) | Drift; follow session-container-drift runbook |

## Escalation / Follow-Up Handling

| Condition | Action |
|-----------|--------|
| P1 (connectivity) | Page on-call; follow runbook; escalate to platform owner if unresolved in 30 min |
| P2 (error rate, drift) | Create ticket; triage within 4 hours; follow runbook |
| Success rate degradation | Document; correlate with deployments; escalate if sustained |
| Correlation with cost | Note for cost review; failed executions may still incur token cost |

## Evidence to Retain

- runtime/metrics snapshot at review time (timestamp, connectivity, terminationReasons)
- efficiency-summary for period (failedExecutions, completedExecutions)
- Computed error rate, success rate
- Incident log if P1/P2 triggered
- Retention: 12 months minimum per PHASE-65

## Signoff Requirements

- Weekly reliability review: Operator sign-off on completion
- P1 incident: Post-incident documentation per PHASE-60
- P2 incident: Ticket resolution; operator sign-off

---

**Reference:** PHASE-66A-DESIGN.md Section 4; PHASE-60A-DESIGN.md; docs/runbooks/elevated-error-termination-rate.md
