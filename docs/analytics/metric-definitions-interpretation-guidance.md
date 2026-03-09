# Metric Definitions / Interpretation Guidance

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 6

---

## Purpose

Define required metrics and provide interpretation guidance for analytics review and stakeholder reporting. Per PHASE-66A, all metrics are derived from existing endpoints. No new instrumentation.

## Scope

**In scope:**
- Metric definitions (name, formula, source, aggregation boundary)
- Interpretation guidance (what values mean, when to act)
- Aggregation boundaries (platform, apiKeyId, user_id, time window)

**Excluded:**
- New metrics or endpoints
- Automated metric computation in platform
- Prometheus/OpenMetrics format

---

## Metric Definitions

### Session Metrics (Platform-Wide)

| Metric | Definition | Source | Aggregation |
|--------|------------|--------|-------------|
| **activeSessionCount** | Count of sessions with terminated_at IS NULL | runtime/metrics | Point-in-time |
| **terminatedSessionCount** | Count of sessions with terminated_at IS NOT NULL | runtime/metrics | Cumulative |
| **runningContainerCount** | Containers reported by Docker API | runtime/metrics | Point-in-time |
| **terminationReasons** | Array of {reason, count}; reasons: idle_timeout, max_lifetime, explicit_delete, error | runtime/metrics | Point-in-time |

### Reliability Metrics

| Metric | Definition | Source | Aggregation |
|--------|------------|--------|-------------|
| **error termination rate** | terminationReasons[reason="error"].count / terminatedSessionCount | runtime/metrics | Point-in-time |
| **dockerConnectivity** | Boolean; Docker daemon reachable | runtime/metrics | Point-in-time |
| **databaseConnectivity** | Boolean; database reachable | runtime/metrics | Point-in-time |
| **failedExecutions** | Count of usage_records where execution_status = 'failed' | efficiency-summary | apiKeyId + period |
| **execution success rate** | completedExecutions / (completedExecutions + failedExecutions) | efficiency-summary | apiKeyId + period |

### Usage / Cost Metrics (apiKeyId-Scoped)

| Metric | Definition | Source | Aggregation |
|--------|------------|--------|-------------|
| **totalExecutions** | Count of usage_records in period | efficiency-summary | apiKeyId + periodStart/periodEnd |
| **totalTokens** | Sum of tokensUsed in period | efficiency-summary | apiKeyId + periodStart/periodEnd |
| **totalCostUSD** | Sum of cost from usage_records (pricing applied) | efficiency-summary | apiKeyId + periodStart/periodEnd |
| **completedExecutions** | Count where execution_status = 'completed' | efficiency-summary | apiKeyId + periodStart/periodEnd |
| **cost per execution** | totalCostUSD / completedExecutions | Derived | apiKeyId + period |
| **cost per 1K tokens** | totalCostUSD / (totalTokens / 1000) | Derived | apiKeyId + period |

### Per-User Metrics

| Metric | Definition | Source | Aggregation |
|--------|------------|--------|-------------|
| **Per-user quota status** | EXCEEDED, OK, etc. | admin/users/:userId/summary | user_id |
| **Per-user tokens used** | From user summary | admin/users/:userId/summary | user_id |
| **Per-user sessions** | From user summary | admin/users/:userId/summary | user_id |

---

## Aggregation Boundaries

| Boundary | Scope | Notes |
|----------|-------|-------|
| **Platform** | All sessions, all containers | runtime/metrics; no filtering |
| **apiKeyId** | Billing/usage for single apiKey | billing endpoints require apiKeyId |
| **user_id** | Per-user quota, usage | admin endpoint requires user_id |
| **Time window** | periodStart, periodEnd | billing endpoints require explicit params |

**No cross-apiKey aggregation** in current design. Multi-tenant rollup requires external aggregation.

---

## Interpretation Guidance

### Session Metrics

| Value | Interpretation |
|-------|----------------|
| activeSessionCount = 0 | No active sessions; platform idle or between waves |
| activeSessionCount high | Current load; correlate with container count for drift |
| terminatedSessionCount growing | Cumulative; reflects historical usage |
| terminationReasons: idle_timeout dominant | Normal; users leave sessions idle |
| terminationReasons: error dominant | Elevated failure; investigate per reliability procedure |

### Reliability Metrics

| Value | Interpretation |
|-------|----------------|
| error termination rate > 0.2 (20%) | PHASE-60 threshold; P2 if terminatedSessionCount >= 10 |
| dockerConnectivity false | P1; Docker down |
| databaseConnectivity false | P1; DB down |
| execution success rate < 0.95 | Execution-level issues; check AI provider |
| activeSessionCount ≠ runningContainerCount (persistent) | Session–container drift; P2 |

### Cost Metrics

| Value | Interpretation |
|-------|----------------|
| totalCostUSD rising, executions flat | Cost per execution rising; efficiency concern |
| totalCostUSD rising, executions rising | Usage growth; expected |
| cost per 1K tokens varies by provider | Efficiency comparison; consider provider mix |
| failedExecutions high | Failed executions may incur cost; reliability + cost concern |

### Edge Cases

| Case | Handling |
|------|----------|
| terminatedSessionCount = 0 | Cannot compute error rate; skip or report N/A |
| completedExecutions = 0 | Cannot compute cost per execution; skip or report N/A |
| totalTokens = 0 | Cannot compute cost per 1K tokens; skip or report N/A |
| Endpoint returns 5xx | Platform issue; escalate; document |

---

## Evidence to Retain

- Metric definitions (this document)
- Any custom computed metrics (formula, source)
- Retention: 12 months minimum per PHASE-65

## Signoff Requirements

- Metric definitions approved: Platform owner (design phase)
- Interpretation guidance updated: Operator or platform owner when new patterns identified

---

**Reference:** PHASE-66A-DESIGN.md Section 6; docs/analytics/product-usage-analytics-review-procedure.md; docs/analytics/reliability-error-analytics-review-procedure.md; docs/analytics/cost-efficiency-analytics-review-procedure.md
