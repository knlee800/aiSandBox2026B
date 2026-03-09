# Runbook: Elevated Error Termination Rate

## Title

Elevated Error Termination Rate

## Trigger

`terminationReasons` where `reason === "error"` accounts for >20% of `terminatedSessionCount`, with `terminatedSessionCount >= 10` (volume floor).

## Severity

P2 (Warning)

## Verification

1. Poll `GET /api/runtime/metrics`.
2. Compute: `errorCount = sum(terminationReasons[].count where reason === "error")`.
3. Compute: `rate = errorCount / terminatedSessionCount`.
4. Confirm `rate > 0.2` and `terminatedSessionCount >= 10`.

## Remediation

1. Check container-manager logs for container start/stop failures.
2. Verify AI provider availability (if errors correlate with AI execution).
3. Review recent deployments or configuration changes.
4. Inspect session termination records in database for error patterns.
5. If provider-related: consider kill switch or provider failover per platform config.

## Escalation

- **P2:** Create ticket; investigate within 4 hours.
- Escalate if unresolved in 4 hours.

## Post-incident

- Document root cause (provider outage, resource exhaustion, config error, etc.).
- Note error rate and duration.
- Update runbook if new patterns identified.
