# Production Deployment Runbook

**Phase:** PHASE-55  
**Stage:** STAGE-55B  
**Task:** TASK-55B — Production Compose Bundle  
**Authority:** PRD.md, ARCHITECTURE.md, PRODUCTION-DEPLOYMENT-ARCHITECTURE.md

---

## 1. Overview

This runbook describes how to deploy the AI Sandbox Platform using the production Docker Compose bundle.

**Deliverables:**
- `docker-compose.prod.yml` — Production compose definition
- `.env.prod.example` — Environment variable template
- Dockerfiles for api-gateway, ai-service, container-manager, frontend

---

## 2. Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- Host with Docker socket access (for container-manager)
- Sufficient resources: 4GB RAM minimum, 2 CPU cores recommended

---

## 3. Deployment Steps

### 3.1 Prepare Environment

```bash
# Copy environment template
cp .env.prod.example .env

# Edit .env and set all CHANGE_ME values
# Required: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, INTERNAL_SERVICE_KEY, GRAFANA_ADMIN_PASSWORD
```

**Generate secrets:**
```bash
# JWT_SECRET and INTERNAL_SERVICE_KEY
openssl rand -hex 32
```

### 3.2 Build and Start

```bash
# Build all images and start services
docker compose -f docker-compose.prod.yml up -d --build

# Or without -d to view logs
docker compose -f docker-compose.prod.yml up --build
```

### 3.3 First-Time Database Setup

**WARNING:** `schema.sql` drops existing tables. Run only on a fresh database.

After the first start, apply the schema and migrations:

```bash
# Set POSTGRES_USER and POSTGRES_DB (or ensure .env is loaded)
# Apply base schema (destructive on existing data)
docker compose -f docker-compose.prod.yml exec -T postgres psql -U aisandbox -d aisandbox -f /schema/schema.sql

# Apply migrations (if any)
# docker compose -f docker-compose.prod.yml exec -T postgres psql -U aisandbox -d aisandbox -f /schema/migrations/001_add_oauth_support.sql
# docker compose -f docker-compose.prod.yml exec -T postgres psql -U aisandbox -d aisandbox -f /schema/migrations/002_add_session_termination.sql
```

### 3.4 Verify Deployment

| Service      | URL                    | Purpose                    |
|--------------|------------------------|----------------------------|
| Frontend     | http://localhost:3000  | Web UI                     |
| API Gateway  | http://localhost:4000  | API, health checks         |
| Grafana      | http://localhost:3001   | Dashboards (optional)      |

**Health check:**
```bash
curl http://localhost:4000/api/health
```

---

## 4. Environment Variables

See `.env.prod.example` for the full template. Key categories:

| Category      | Variables |
|---------------|-----------|
| Shared        | NODE_ENV, LOG_LEVEL |
| Database      | POSTGRES_*, DATABASE_URL |
| Redis         | REDIS_PASSWORD, REDIS_URL |
| API Gateway   | JWT_SECRET, INTERNAL_SERVICE_KEY, AI_PROVIDER |
| Grafana       | GRAFANA_ADMIN_USER, GRAFANA_ADMIN_PASSWORD |

**INTERNAL_SERVICE_KEY** must be identical in api-gateway, ai-service, and container-manager.

---

## 5. Scaling ai-service Workers

Workers share the Redis queue (BullMQ). Add replicas to increase throughput:

```bash
# Scale to 2 ai-service workers
docker compose -f docker-compose.prod.yml up -d --scale ai-service=2

# Scale to 3 workers
docker compose -f docker-compose.prod.yml up -d --scale ai-service=3
```

**Prometheus:** When scaling, update `monitoring/prometheus/prometheus.yml` to add scrape targets for each replica (e.g. `ai-service_1:4001`, `ai-service_2:4001`). With a single target, only one replica is scraped.

---

## 6. Network Exposure

| Service          | Port  | Exposed | Notes                    |
|------------------|-------|---------|--------------------------|
| api-gateway      | 4000  | Yes     | Public API               |
| frontend         | 3000  | Yes     | Web UI                   |
| grafana          | 3001  | Yes     | Optional, dashboards      |
| postgres         | 5432  | No      | Internal only             |
| redis            | 6379  | No      | Internal only             |
| ai-service       | 4001  | No      | Internal only             |
| container-manager| 4002  | No      | Internal only             |
| prometheus       | 9090  | No      | Internal only             |

---

## 7. Monitoring Access

**Prometheus** (internal): `http://prometheus:9090` (from within Docker network)  
**Grafana** (optional external): `http://localhost:3001`

Default Grafana credentials: set via `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` in `.env`.

---

## 8. Container Manager and Docker Socket

container-manager requires access to the Docker daemon. The compose file mounts:

```
/var/run/docker.sock:/var/run/docker.sock
```

**Linux:** Works by default.  
**Windows (Docker Desktop):** Typically works; Docker Desktop proxies the socket. If not, ensure Docker Desktop is running and the WSL 2 backend is used.

---

## 9. Stopping and Cleanup

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (data loss)
docker compose -f docker-compose.prod.yml down -v
```

---

## 10. Troubleshooting

| Issue | Action |
|-------|--------|
| api-gateway fails to start | Check DATABASE_URL, REDIS_URL, and that postgres/redis are healthy |
| container-manager fails | Verify Docker socket is accessible; run `docker ps` on host |
| Frontend cannot reach API | Ensure API_GATEWAY_URL build arg is `http://api-gateway:4000` |
| ai-service not processing jobs | Check REDIS_URL, INTERNAL_SERVICE_KEY matches api-gateway |

---

**Document Status:** Complete  
**Checkpoint:** `docs/PHASE-55B-CHECKPOINT.md` (to be created on task completion)
