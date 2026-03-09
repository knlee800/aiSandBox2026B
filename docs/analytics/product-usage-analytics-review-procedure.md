# Product / Usage Analytics Review Procedure

**Phase:** 66B  
**Reference:** PHASE-66A-DESIGN.md Section 3

---

## Purpose

Review product usage and user activity visibility to assess platform adoption, session patterns, and feature utilization. Per PHASE-66A, all data comes from existing endpoints—no new analytics API. Operators obtain visibility via HTTP requests or manual DB queries.

## Scope

**In scope:**
- Session activity (active, terminated, termination breakdown)
- AI execution volume (totalExecutions, totalTokens)
- Per-user usage (quota status, usage on demand)
- Common workflow visibility (session lifecycle, execution, quota exhaustion)

**Excluded:**
- Retention/cohort analysis (requires manual DB queries; deferred)
- Feature-level instrumentation beyond billing (deferred)
- Real-time dashboards in platform (use external tooling)

## Prerequisites

- Network access to api-gateway
- curl, Postman, or equivalent
- For per-user lookup: INTERNAL_SERVICE_KEY, known user_id
- For billing endpoints: apiKeyId, periodStart, periodEnd (ISO 8601)

## Data Sources / Dashboards Used

| Data | Endpoint | Parameters |
|------|----------|------------|
| Session counts | `GET /api/runtime/metrics` | None |
| Termination breakdown | `GET /api/runtime/metrics` | None |
| Execution volume | `GET /api/billing/efficiency-summary` | apiKeyId, periodStart, periodEnd |
| Per-user usage | `GET /api/internal/admin/users/:userId/summary` | X-Internal-Service-Key |

**Note:** runtime/metrics is point-in-time; no history. For trends, poll periodically and store externally, or use efficiency-summary with different periods.

## Review Steps

1. **Obtain runtime metrics** — `GET /api/runtime/metrics`
   - Record activeSessionCount, terminatedSessionCount, terminationReasons
   - Note timestamp (point-in-time snapshot)

2. **Obtain efficiency summary** — `GET /api/billing/efficiency-summary?periodStart=...&periodEnd=...`
   - Record totalExecutions, totalTokens, completedExecutions, failedExecutions
   - Use period aligned with review window (e.g. last 7 days, last 30 days)

3. **Compare session vs execution** — activeSessionCount + terminatedSessionCount gives cumulative sessions; totalExecutions gives AI calls
   - High sessions, low executions → users creating sessions but not using AI heavily
   - Low sessions, high executions → power users or automation

4. **Check termination mix** — terminationReasons breakdown
   - idle_timeout, max_lifetime, explicit_delete = expected
   - error = investigate per reliability procedure

5. **Per-user lookup (if needed)** — `GET /api/internal/admin/users/:userId/summary`
   - For specific user: quota status, tokens used, sessions
   - Use when investigating support request or anomaly

## Interpretation Guidance

| Observation | Interpretation |
|-------------|----------------|
| activeSessionCount ≈ 0, terminatedSessionCount high | Past activity; current load low |
| terminationReasons dominated by idle_timeout | Normal; users leave sessions idle |
| terminationReasons dominated by error | Elevated failure; escalate per reliability procedure |
| totalExecutions growing week-over-week | Usage growth; positive signal |
| totalTokens / totalExecutions high | Token-heavy usage; cost correlation |
| Per-user EXCEEDED quota | User hit limits; support or quota adjustment per PHASE-65 |

## Escalation / Follow-Up Handling

| Condition | Action |
|-----------|--------|
| Error termination rate > 20% | Follow reliability procedure; correlate with failedExecutions |
| Unusual usage spike | Investigate; check for abuse per PHASE-65 abuse procedure |
| Per-user quota exhaustion | Support channel; manual quota adjustment per PHASE-65 if approved |
| No visibility for required metric | Document gap; escalate to platform owner for future endpoint |

## Evidence to Retain

- Snapshot of runtime/metrics at review time (timestamp, key fields)
- efficiency-summary response for review period (or summary values)
- Review log: date, operator, findings, anomalies
- Retention: 12 months minimum per PHASE-65

## Signoff Requirements

- Weekly usage review: Operator sign-off on completion
- Monthly usage review: Platform owner or delegate sign-off
- Launch analytics readiness: Platform owner sign-off on checklist (all visibility obtainable)

---

**Reference:** PHASE-66A-DESIGN.md Section 3; docs/analytics/metric-definitions-interpretation-guidance.md
