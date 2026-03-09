# Runbook: Docker Connectivity Lost

## Title

Docker Connectivity Lost

## Trigger

`GET /api/runtime/metrics` returns `dockerConnectivity === false`.

## Severity

P1 (Critical)

## Verification

1. Poll `GET /api/runtime/metrics`.
2. Confirm `dockerConnectivity` is `false`.
3. Optionally: verify Docker daemon status on host (`docker info` or equivalent).

## Remediation

1. Restart Docker daemon on the host running container-manager.
2. Verify container-manager can reach Docker (check `CONTAINER_MANAGER_URL` or equivalent from api-gateway).
3. Re-poll `/api/runtime/metrics`; confirm `dockerConnectivity` is `true`.
4. Check container-manager logs for connection errors.

## Escalation

- **P1:** Page on-call immediately.
- Escalate to platform owner if unresolved in 30 minutes.

## Post-incident

- Document root cause (Docker daemon crash, network partition, etc.).
- Note duration of outage.
- Update runbook if new patterns identified.
