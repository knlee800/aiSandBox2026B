# Observability — Prometheus Integration

**Phase:** 53A  
**Scope:** Infrastructure configuration only

---

## Overview

Prometheus scrapes metrics from ai-service's `GET /metrics` endpoint (Phase-52). No code changes to ai-service are required.

---

## How Prometheus Scrapes ai-service

- **Endpoint:** `GET /metrics`
- **Default port:** 4001
- **Job name:** `aisandbox-ai-service`
- **Scrape interval:** 15 seconds

Configuration: `monitoring/prometheus/prometheus.yml`

---

## Starting Prometheus

```bash
docker compose up
```

Prometheus starts with postgres and redis. It scrapes ai-service when ai-service is reachable at the configured target.

---

## Accessing Prometheus UI

**URL:** http://localhost:9090

- **Status → Targets:** Verify `aisandbox-ai-service` target
- **Graph:** Query metrics

---

## Target Configuration

**Default target:** `ai-service:4001`

When ai-service runs **on the host** (e.g. `npm run dev` in `services/ai-service`), use `host.docker.internal:4001` instead. Edit `monitoring/prometheus/prometheus.yml`:

```yaml
static_configs:
  - targets:
      - host.docker.internal:4001
```

When ai-service runs **in Docker** (same network), `ai-service:4001` resolves if the ai-service container is named or aliased `ai-service`.

---

## Multi-Worker Compatibility

To scrape multiple ai-service instances, add targets to `static_configs`:

```yaml
static_configs:
  - targets:
      - ai-service-1:4001
      - ai-service-2:4001
      - ai-service-3:4001
```

Each instance exposes its own metrics. Prometheus aggregates by `instance` label.

---

## Example Queries

| Metric | Description |
|--------|-------------|
| `aisandbox_execution_started_total` | Total executions started |
| `aisandbox_execution_completed_total` | Total executions completed |
| `aisandbox_execution_failed_total` | Total executions failed |
| `aisandbox_queue_waiting_jobs` | Queue depth (waiting) |
| `aisandbox_queue_active_jobs` | Queue depth (active) |
| `aisandbox_worker_claim_total` | Worker claim count |

**Example:** `rate(aisandbox_execution_started_total[5m])` — execution start rate over 5 minutes.
