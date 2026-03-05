# Production Deployment Architecture

**Phase:** PHASE-55  
**Stage:** STAGE-55A  
**Task:** TASK-55A — Production Deployment Architecture  
**Status:** Design Only (No Implementation)  
**Authority:** PRD.md, ARCHITECTURE.md, CLAUDE.md

---

## 1. Document Purpose

This document defines the production deployment topology for the AI Sandbox Platform. It is a **design-only** specification. No code, schema, execution logic, or queue behavior changes are implied.

**Invariants Preserved:**
- All execution engine invariants
- HTTP-only communication between services
- Internal API contract (container-manager → api-gateway)
- BullMQ queue semantics (ai-execution queue)
- Governance and termination semantics

---

## 2. Service Layout

### 2.1 Component Inventory

| Component | Type | Port (Internal) | Purpose |
|-----------|------|-----------------|---------|
| **api-gateway** | NestJS | 4000 | Auth, session ownership, routing, queue producer |
| **ai-service** | NestJS | 4001 | AI execution workers, queue consumer, streaming |
| **container-manager** | NestJS | 4002 | Docker lifecycle, governance, preview proxy |
| **PostgreSQL** | Database | 5432 | Authoritative session state, billing, usage |
| **Redis** | Cache/Queue | 6379 | BullMQ (ai-execution), execution streaming pub/sub |
| **Prometheus** | Observability | 9090 | Metrics scrape, alert evaluation |
| **Grafana** | Observability | 3000 | Dashboards, visualization |
| **Frontend** | Next.js | 3000 (app) | Web UI, proxies /api to api-gateway |

### 2.2 Service Dependencies

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ HTTPS
                           ▼
                    ┌─────────────┐
                    │  Frontend   │ (Next.js)
                    │   :3000     │
                    └──────┬──────┘
                           │ /api/* → api-gateway
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     api-gateway (:4000)                            │
│  - Auth, sessions, quota, billing                                 │
│  - Enqueues AI jobs → Redis                                       │
│  - Calls container-manager (start/stop/delete)                    │
│  - Receives internal callbacks from container-manager             │
└───────┬─────────────────────────────────────┬────────────────────┘
        │                                     │
        │ HTTP                                 │ HTTP
        ▼                                     ▼
┌───────────────────┐                 ┌───────────────────┐
│ container-manager │                 │    ai-service     │
│     (:4002)       │                 │     (:4001)      │
│ - Docker socket   │                 │ - BullMQ worker  │
│ - Session runtime │                 │ - AI adapters    │
│ - Preview proxy   │                 │ - Redis pub/sub  │
└───────┬───────────┘                 └─────────┬─────────┘
        │                                     │
        │ Internal callbacks                   │ Redis
        │ (start/stop/error/git-checkpoints)   │
        ▼                                     ▼
┌───────────────────┐                 ┌───────────────────┐
│   api-gateway     │                 │       Redis        │
│  /api/internal/*  │                 │       (:6379)      │
└───────────────────┘                 └───────────────────┘
        │
        ▼
┌───────────────────┐
│    PostgreSQL     │
│     (:5432)       │
└───────────────────┘
```

### 2.3 Data Flow Summary

- **User → Frontend → api-gateway:** All public API traffic
- **api-gateway → container-manager:** Session start, stop, delete, stats, billing export
- **container-manager → api-gateway:** Internal callbacks (start, stop, error, git-checkpoints)
- **api-gateway → ai-service:** AI execution requests (via queue, not direct HTTP)
- **api-gateway ↔ Redis:** Queue producer, execution stream pub/sub
- **ai-service ↔ Redis:** Queue consumer (BullMQ worker), execution stream pub/sub
- **ai-service → api-gateway:** Internal HTTP (e.g., ledger updates, idempotency)
- **ai-service → container-manager:** Exec/file operations (CONTAINER_MANAGER_URL)
- **Prometheus → ai-service:** Scrape `/metrics` (Phase-52, Phase-53)

---

## 3. Container Orchestration Approach

### 3.1 Recommended: Docker Compose (Single Node)

For initial production, **Docker Compose** remains the primary orchestration approach:

- **Rationale:** Aligns with current local setup, minimal operational complexity, single-node design per ARCHITECTURE.md
- **Scope:** All services run on one host
- **Limitation:** No built-in HA, no automatic failover (accepted per ARCHITECTURE.md Section 12)

### 3.2 Alternative: Kubernetes (Future)

If multi-node or HA is required later:

- **api-gateway:** Stateless, horizontally scalable (replicas behind load balancer)
- **ai-service:** Worker replicas share Redis queue; each replica runs BullMQ workers
- **container-manager:** **Single replica only** — Docker socket binding and session affinity require one instance per Docker host
- **PostgreSQL, Redis:** Managed services or StatefulSet with persistent volumes

### 3.3 Container Placement Rules

| Service | Placement Constraint | Reason |
|---------|----------------------|--------|
| container-manager | Same host as Docker daemon | Requires `unix:///var/run/docker.sock` (or Windows pipe) |
| api-gateway | Any | Stateless |
| ai-service | Any | Stateless workers; Redis is remote |
| PostgreSQL | Persistent volume | Data durability |
| Redis | Persistent volume | Queue and pub/sub state |
| Prometheus | Any | Scrape targets by network name |
| Grafana | Any | Datasource by network name |

---

## 4. Secrets Management Strategy

### 4.1 Secret Categories

| Category | Examples | Handling |
|----------|----------|----------|
| **Database** | POSTGRES_PASSWORD, DATABASE_URL | Inject at runtime; never in image |
| **Redis** | REDIS_PASSWORD, REDIS_URL | Inject at runtime |
| **JWT** | JWT_SECRET | Inject at runtime |
| **Internal Auth** | INTERNAL_SERVICE_KEY | Shared secret; inject identically in api-gateway, ai-service, container-manager |
| **AI Providers** | ANTHROPIC_API_KEY, OPENAI_API_KEY, etc. | Inject at runtime; api-gateway and ai-service as needed |
| **Billing** | Stripe keys (future) | Inject at runtime |

### 4.2 Injection Methods

**Docker Compose:**
- Use `env_file` for non-secret config
- Use `environment` with variable substitution from host env (e.g., `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`)
- For production: populate from external secret store (e.g., HashiCorp Vault, cloud provider secrets) before `docker compose up`

**Kubernetes:**
- Use `Secret` resources
- Mount as env vars or files
- Prefer external secret operators (e.g., External Secrets Operator) for rotation

### 4.3 Rules

- No secrets in Docker images
- No secrets in git
- `.env` files excluded via `.gitignore`
- `INTERNAL_SERVICE_KEY` must match across api-gateway, ai-service, container-manager
- Generate `INTERNAL_SERVICE_KEY` with `openssl rand -hex 32`

---

## 5. Environment Variable Structure

### 5.1 Shared (All Application Services)

| Variable | Required | Description |
|----------|----------|-------------|
| NODE_ENV | Yes | `development`, `staging`, `production` |
| INTERNAL_SERVICE_KEY | Yes | Shared secret for internal API auth |

### 5.2 api-gateway

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No (default 4000) | Listen port |
| DATABASE_URL | Yes* | PostgreSQL connection string |
| POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB | Yes* | Alternative to DATABASE_URL |
| REDIS_URL | Yes | Redis for queue + streaming |
| JWT_SECRET | Yes | JWT signing |
| JWT_EXPIRES_IN | No | Token expiry |
| CONTAINER_MANAGER_URL | No (default http://localhost:4002) | container-manager base URL |
| AI_PROVIDER | No | Provider selection (stub, anthropic, openai, etc.) |
| AI provider keys | Conditional | Per AI_PROVIDER |
| BILLING_CHARGES_ENABLED | No | Kill-switch (default false) |

### 5.3 ai-service

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No (default 4001) | Listen port |
| REDIS_URL | Yes | Redis for BullMQ + pub/sub |
| API_GATEWAY_URL | Yes | api-gateway base URL |
| CONTAINER_MANAGER_URL | Yes | container-manager base URL (e.g. http://container-manager:4002) |
| INTERNAL_SERVICE_KEY | Yes | Must match api-gateway |
| AI_PROVIDER | No | Must match api-gateway |
| AI provider keys | Conditional | Per AI_PROVIDER |

### 5.4 container-manager

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No (default 4002) | Listen port |
| API_GATEWAY_URL | Yes | api-gateway base URL |
| INTERNAL_SERVICE_KEY | Yes | Must match api-gateway |
| DOCKER_HOST | No | Docker socket (unix:///var/run/docker.sock or Windows pipe) |
| CONTAINER_CPU_LIMIT | No | CPU limit per container |
| CONTAINER_MEMORY_LIMIT | No | Memory limit per container |
| SESSION_MAX_LIFETIME_MS | No | Max session lifetime |
| SESSION_IDLE_TIMEOUT_MS | No | Idle timeout |
| ENABLE_PREVIEW_ACCESS_CONTROL | No | JWT for preview |
| JWT_SECRET | Conditional | When preview access control enabled |

### 5.5 Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| API base URL | Yes | Backend URL for /api proxy (build-time or runtime) |

### 5.6 Infrastructure

| Service | Key Variables |
|---------|---------------|
| PostgreSQL | POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB |
| Redis | REDIS_PASSWORD (via REDIS_URL in apps) |
| Prometheus | Config file (scrape targets) |
| Grafana | GF_SECURITY_ADMIN_PASSWORD, datasource URLs |

---

## 6. Network Architecture

### 6.1 Docker Compose Network

- **Network name:** `aisandbox-network` (bridge driver)
- **DNS resolution:** Service names resolve to container IPs (e.g., `postgres`, `redis`, `api-gateway`, `ai-service`, `container-manager`)

### 6.2 Connectivity Matrix

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| Frontend | api-gateway | HTTP | API proxy |
| api-gateway | container-manager | HTTP | Session lifecycle |
| api-gateway | PostgreSQL | TCP 5432 | DB |
| api-gateway | Redis | TCP 6379 | Queue, pub/sub |
| container-manager | api-gateway | HTTP | Internal callbacks |
| ai-service | api-gateway | HTTP | Internal calls |
| ai-service | container-manager | HTTP | Exec, files |
| ai-service | Redis | TCP 6379 | Queue, pub/sub |
| Prometheus | ai-service | HTTP | Scrape /metrics |
| Grafana | Prometheus | HTTP | Datasource |

### 6.3 External Exposure

- **Ingress:** Only Frontend (and optionally api-gateway for health) exposed to internet
- **Internal APIs:** `/api/internal/*` must never be exposed publicly
- **Reverse proxy:** Nginx or similar in front of Frontend + api-gateway for TLS termination, rate limiting

### 6.4 Firewall / Security Groups

- Block direct access to PostgreSQL, Redis, Prometheus, Grafana from public internet
- Allow only inter-service traffic within private network
- Allow Prometheus → ai-service (and future scrape targets) within private network

---

## 7. Scaling Strategy for ai-service Workers

### 7.1 Current Model

- **One ai-service process** = one BullMQ worker (single worker per process)
- **Queue:** `ai-execution` (BullMQ)
- **Scaling:** Add more ai-service replicas; each runs a worker that competes for jobs

### 7.2 Horizontal Scaling

| Replicas | Behavior |
|----------|----------|
| 1 | Single worker; jobs processed sequentially per worker |
| N | N workers; jobs distributed by BullMQ; no coordination required |

### 7.3 Constraints

- **Redis:** Single instance; ensure connection limits support N workers
- **Idempotency:** Execution ledger in api-gateway; workers must not duplicate execution (Phase-51.3: attempts=1, in-worker retry only)
- **Streaming:** Redis pub/sub; all workers and api-gateway share same Redis

### 7.4 Scaling Triggers (Operational)

- **Queue backlog:** `aisandbox_queue_waiting_jobs` (Prometheus) — add workers if sustained > threshold
- **Latency:** `aisandbox_execution_latency_seconds` — add workers if P95 exceeds SLO
- **Worker stuck recovery:** `aisandbox_worker_stuck_recovered_total` — investigate before scaling

### 7.5 Recommended Starting Point

- **Production:** Start with 2–3 ai-service replicas (workers)
- **Tune:** Based on queue depth and latency alerts (Phase-53C)

---

## 8. Monitoring Placement

### 8.1 Current Observability Stack

- **Prometheus:** Scrapes ai-service `/metrics` (Phase-52, Phase-53A)
- **Grafana:** Dashboards for execution, queue, worker (Phase-53B)
- **Alerts:** Phase-53C (execution failure rate, latency, queue backlog, queue lag, worker stuck recovery)

### 8.2 Scrape Targets (Production)

| Job | Target | Path |
|-----|--------|------|
| aisandbox-ai-service | ai-service:4001 | /metrics |

**Multi-worker:** When multiple ai-service replicas exist, add static targets:

```yaml
# prometheus.yml (conceptual)
scrape_configs:
  - job_name: aisandbox-ai-service
    static_configs:
      - targets: ['ai-service-1:4001', 'ai-service-2:4001', 'ai-service-3:4001']
```

Or use DNS service discovery if using Kubernetes.

### 8.3 Placement of Observability Components

| Component | Placement | Notes |
|-----------|------------|-------|
| Prometheus | Same Docker network | Scrape by service name |
| Grafana | Same Docker network | Datasource: Prometheus URL |
| Alertmanager | Optional | For alert routing (future) |

### 8.4 Future Additions (Out of Scope Here)

- api-gateway metrics endpoint
- container-manager metrics
- PostgreSQL metrics
- Redis metrics
- Log aggregation (ELK, Loki)

---

## 9. Summary

| Aspect | Recommendation |
|--------|----------------|
| **Orchestration** | Docker Compose (single node) for initial production |
| **Secrets** | Environment injection; no secrets in images or git |
| **Network** | Single bridge network; internal APIs never exposed |
| **Scaling** | ai-service: 2–3 worker replicas; scale based on queue metrics |
| **Monitoring** | Prometheus + Grafana; multi-target scrape for ai-service replicas |
| **container-manager** | Single replica; must share host with Docker daemon |

---

**Document Status:** Design Complete  
**Next Step:** Await implementation prompt (STAGE-55B or equivalent).  
**No code, schema, execution logic, or queue behavior changes in this stage.**
