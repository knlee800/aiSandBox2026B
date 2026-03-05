# Production Security Guide

**Phase:** PHASE-55  
**Stage:** STAGE-55C  
**Task:** TASK-55C — Production Security Hardening

---

## 1. Threat Model Overview

The AI Sandbox Platform production deployment assumes:

- **External exposure:** API Gateway, Frontend, and optionally Grafana are reachable from the internet or internal network.
- **Internal-only:** Postgres, Redis, Prometheus, AI Service, and Container Manager are not published; they communicate over a private bridge network.
- **Secrets:** All sensitive values (DB credentials, JWT secret, internal service key, provider API keys) are supplied via environment variables from a `.env` file, never hardcoded in compose.

---

## 2. Required Secrets / Environment Variables

All values must be set in `.env` (from `.env.prod.example`). **Never commit `.env`.**

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | Database name |
| `DATABASE_URL` | Yes | Full PostgreSQL connection string |
| `REDIS_PASSWORD` | Yes | Redis AUTH password |
| `REDIS_URL` | Yes | Full Redis URL including password |
| `JWT_SECRET` | Yes | JWT signing secret (use `openssl rand -hex 32`) |
| `INTERNAL_SERVICE_KEY` | Yes | Shared secret for internal service-to-service auth |
| `GRAFANA_ADMIN_PASSWORD` | Yes | Grafana admin password |
| `AI_PROVIDER` | No | Default: `stub` |
| `ANTHROPIC_API_KEY` | If AI_PROVIDER=anthropic | AI provider API key |
| `OPENAI_API_KEY` | If AI_PROVIDER=openai | AI provider API key |
| `GROQ_API_KEY` | If AI_PROVIDER=groq | AI provider API key |
| `XAI_API_KEY` | If AI_PROVIDER=xai | AI provider API key |
| `DEEPSEEK_API_KEY` | If AI_PROVIDER=deepseek | AI provider API key |

---

## 3. Port Exposure Matrix

| Service | Published Port | Intended Access |
|---------|----------------|-----------------|
| api-gateway | 4000 | Public / internal |
| frontend | 3000 | Public / internal |
| grafana | 3001 | Optional (admin/monitoring) |
| postgres | — | Internal only |
| redis | — | Internal only |
| prometheus | — | Internal only |
| ai-service | — | Internal only |
| container-manager | — | Internal only |

---

## 4. Recommended Firewall Rules

- Allow inbound: 3000 (frontend), 4000 (API), 3001 (Grafana, if exposed).
- Deny inbound to all other host ports.
- Restrict Grafana (3001) to admin IPs or VPN when possible.

---

## 5. Container Hardening Applied

| Control | Applied To | Notes |
|---------|------------|-------|
| `restart: unless-stopped` | All services | Automatic restart on failure |
| `security_opt: no-new-privileges:true` | All services | Prevents privilege escalation |
| `deploy.resources.limits` | All services | CPU/memory limits (see below) |
| Healthchecks | postgres, redis, api-gateway, prometheus, grafana | Startup and liveness checks |

**Resource limits (per service):**

| Service | CPU | Memory |
|---------|-----|--------|
| api-gateway | 0.5 | 512M |
| ai-service | 1.0 | 1024M |
| container-manager | 0.5 | 512M |
| frontend | 0.5 | 512M |
| postgres | 1.0 | 2048M |
| redis | 0.5 | 512M |
| prometheus | 0.5 | 1024M |
| grafana | 0.5 | 512M |

---

## 6. Resource Limits: Compose vs Swarm

`deploy.resources.limits` is defined in `docker-compose.prod.yml`. 

- **Docker Compose (standalone):** These limits are **not enforced** by default. To enforce them, use Docker Swarm mode or apply limits at the host/orchestrator level.
- **Docker Swarm:** `deploy.resources` is enforced by the swarm scheduler.

For standalone Compose, consider using host-level cgroups or an orchestrator (Kubernetes, Swarm) for production resource enforcement.

---

## 7. Operational Checklist Before Go-Live

- [ ] All `CHANGE_ME` values in `.env` replaced with strong, unique secrets
- [ ] `.env` is in `.gitignore` and never committed
- [ ] Firewall restricts ports to intended sources
- [ ] Grafana admin password changed from default
- [ ] Database schema and migrations applied
- [ ] `docker compose -f docker-compose.prod.yml config` validates
- [ ] `docker compose -f docker-compose.prod.yml up -d` starts all services
- [ ] Health checks pass: `docker compose -f docker-compose.prod.yml ps`
- [ ] API Gateway `/api/health` returns 200
- [ ] Frontend loads and can reach API
