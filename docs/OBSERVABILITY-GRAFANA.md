# Observability — Grafana Integration

**Phase:** 53B  
**Scope:** Infrastructure configuration only

---

## Overview

Grafana visualizes Prometheus metrics exported by ai-service (Phase-52). Grafana connects to the Prometheus instance created in Stage-53A.

---

## How Grafana Connects to Prometheus

- **Datasource:** Prometheus
- **URL:** `http://prometheus:9090` (Docker network)
- **Access:** Proxy (Grafana queries Prometheus on behalf of the browser)
- **Default:** Prometheus is set as the default datasource

Configuration: `monitoring/grafana/provisioning/datasources/prometheus.yml`

---

## Starting Grafana

```bash
docker compose up
```

Grafana starts with postgres, redis, and prometheus. Access the UI at:

**URL:** http://localhost:3000

---

## Default Login

| Field    | Value  |
|----------|--------|
| User     | admin  |
| Password | admin  |

Change the password after first login in production.

---

## Auto-Loaded Dashboards

Dashboards are provisioned at startup from:

`monitoring/grafana/dashboards/`

Grafana mounts this directory to `/var/lib/grafana/dashboards` and loads all JSON files automatically. No manual import is required.

**Provisioned dashboards:**

| Dashboard           | File                    | Panels                                      |
|---------------------|-------------------------|---------------------------------------------|
| Execution Overview  | execution-overview.json  | Started, completed, failed, cancelled rates |
| Queue Health        | queue-health.json       | Queue depth, completion/failure rate, lag   |
| Worker Activity     | worker-activity.json     | Worker claims, stuck recoveries             |
| Latency             | latency.json            | Execution P95, provider P95                 |

---

## Adding or Editing Dashboards

1. Edit JSON files in `monitoring/grafana/dashboards/`
2. Restart Grafana: `docker compose restart grafana`
3. Or use the Grafana UI to edit; changes are stored in Grafana's database (not persisted to repo unless exported)

To persist UI edits to the repo, export the dashboard JSON from Grafana (Dashboard settings → JSON Model) and save to the corresponding file in `monitoring/grafana/dashboards/`.
