# PRIVATE-BETA-STAGING-SETUP-04 — Runtime / Container Deployment Plan

**Task ID:** PRIVATE-BETA-STAGING-SETUP-04
**Step:** 2 — Runtime / Container Deployment Plan
**Status:** CREATED — 2026-07-21
**Date:** 2026-07-21
**Nature:** Planning only — no installation, no deployment, no runtime, no SSH, no builds, no implementation, no source/test/package/migration/entity/environment/Docker/deployment files changed.

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | PRIVATE-BETA-STAGING-SETUP-04 |
| Title | Runtime / Container Deployment Plan |
| Parent | PRIVATE-BETA-STAGING-SETUP — Staging / Production-like Deployment Target Setup |
| Family | BETA READY / PRIVATE BETA / STAGING SETUP / DEPLOYMENT TARGET |
| Priority | CRITICAL |
| Nature | RUNTIME / CONTAINER DEPLOYMENT PLANNING — NO IMPLEMENTATION |
| Risk | MEDIUM — planning only during this step; no installation or deployment |
| Step 1 | COMPLETE — Registration — 2026-07-21 |
| Step 2 | This document — Runtime / Container Deployment Plan — 2026-07-21 |
| Step 3 | PENDING — Consolidation / Handoff to SETUP-05 |
| Predecessors | PRIVATE-BETA-STAGING-SETUP-01 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-02 — COMPLETE and LOCKED — 2026-07-21 |
| | PRIVATE-BETA-STAGING-SETUP-03 — COMPLETE and LOCKED — 2026-07-21 |
| Keith approval | "go" — 2026-07-21 |

---

## 2. Purpose

This document records the complete runtime and container deployment plan for the AWS Lightsail staging server. It provides Keith with a concrete reference for:

- Installing Node.js 20 LTS, Docker Engine, PM2, and Caddy on the VPS
- Cloning the repo and building all services
- Configuring PM2 for process management
- Planning the service startup order
- Understanding health check, logging, and rollback procedures
- Understanding environment file creation procedures (without exposing secrets)

**No installation, deployment, or runtime occurs in this step.** All execution requires Keith explicit approval in a future child task or execution step.

---

## 3. Confirmed Staging / Runtime Decisions

Carried forward from SETUP-01, SETUP-02, and SETUP-03 (all COMPLETE and LOCKED — 2026-07-21) unchanged:

| # | Decision | Confirmed Value |
|---|----------|-----------------|
| 1 | Provider | **AWS Lightsail** |
| 2 | Region | **Singapore / ap-southeast-1** |
| 3 | Instance | **8 GB RAM / 2 vCPU / 160 GB SSD** |
| 4 | Budget | **~US$40–44/month** |
| 5 | Instance name | **aisandbox-staging** |
| 6 | Static IP planned | **aisandbox-staging-ip** |
| 7 | Staging domain | **staging.ainow.biz** |
| 8 | Future production app domain | **app.ainow.biz** |
| 9 | Root domain (later) | **ainow.biz** (marketing/landing) |
| 10 | Architecture | **Single VPS staging** |
| 11 | Reverse proxy / TLS | **Caddy** (automatic Let's Encrypt) |
| 12 | Database | **Self-host PostgreSQL 15 on same VPS** |
| 13 | Redis | **Self-host Redis 7 on same VPS** |
| 14 | Process manager | **PM2** |
| 15 | Repo path on VPS | **/opt/aisandbox** |
| 16 | App user | **ubuntu** (initially) |
| 17 | AI Service / Container Manager | **Deploy for parity; risky execution disabled by kill switches** |
| 18 | Migration execution | **Separate explicit approval only** |
| 19 | Beta invite | **Separate explicit approval only** |

### Runtime Defaults Recorded

| # | Setting | Value |
|---|---------|-------|
| 1 | OS | Ubuntu LTS |
| 2 | Node.js | 20 LTS |
| 3 | Process manager | PM2 |
| 4 | Reverse proxy | Caddy |
| 5 | Frontend port | 3002 (internal only) |
| 6 | API Gateway port | 4000 (internal only) |
| 7 | AI Service port | 4001 (internal only) |
| 8 | Container Manager port | 4002 (internal only) |
| 9 | PostgreSQL port | 5432 (localhost only) |
| 10 | Redis port | 6379 (localhost only) |
| 11 | Caddy public ports | 80 and 443 only |

---

## 4. What SETUP-04 Covers

| # | Item |
|---|------|
| 1 | Ubuntu LTS runtime baseline |
| 2 | Node.js 20 LTS installation plan |
| 3 | npm / corepack / package manager handling |
| 4 | Docker Engine installation plan |
| 5 | Docker permission and safety plan |
| 6 | PM2 installation plan |
| 7 | Caddy installation plan |
| 8 | Git / repo clone plan |
| 9 | Repo target path on VPS |
| 10 | Service inventory |
| 11 | Service build plan |
| 12 | Frontend build/start plan |
| 13 | API Gateway build/start plan |
| 14 | AI Service Worker build/start plan |
| 15 | Container Manager build/start plan |
| 16 | PostgreSQL / Redis dependency notes |
| 17 | Environment file creation procedure (without exposing secrets) |
| 18 | PM2 ecosystem plan |
| 19 | Service startup order |
| 20 | Health check plan |
| 21 | Log location plan |
| 22 | Rollback / restart plan |
| 23 | Keith manual actions |
| 24 | What must not happen yet |
| 25 | PASS / BLOCKED criteria |
| 26 | Handoff to SETUP-05 |
| 27 | Safety boundaries |

---

## 5. What SETUP-04 Does NOT Do

| # | Not Done |
|---|---------|
| 1 | Does NOT install Node.js |
| 2 | Does NOT install Docker |
| 3 | Does NOT install PM2 |
| 4 | Does NOT install Caddy |
| 5 | Does NOT clone the repo |
| 6 | Does NOT build any services |
| 7 | Does NOT create PM2 ecosystem file |
| 8 | Does NOT create or modify `.env` files |
| 9 | Does NOT configure PM2 or Caddy |
| 10 | Does NOT create the AWS server or static IP |
| 11 | Does NOT change DNS or TLS |
| 12 | Does NOT change firewall rules |
| 13 | Does NOT SSH to any server |
| 14 | Does NOT deploy any service |
| 15 | Does NOT start any runtime (Docker, PostgreSQL, Redis, PM2, Node) |
| 16 | Does NOT execute migrations |
| 17 | Does NOT run tests or builds |
| 18 | Does NOT call APIs or open browsers |
| 19 | Does NOT modify source code, test files, or package files |
| 20 | Does NOT modify environment files or open secret-bearing files |
| 21 | Does NOT invite beta users or claim beta launch |
| 22 | Does NOT make git commits or pushes |
| 23 | Does NOT use subagents |
| 24 | Does NOT modify TASKS.md, TASKS_BACKLOG_FULL.md, or AINOW-EXECUTION-ROADMAP.md |

---

## 6. Ubuntu LTS Runtime Baseline

| Field | Value |
|-------|-------|
| OS | **Ubuntu LTS** (22.04 LTS or 24.04 LTS — whichever Lightsail offers at time of creation) |
| Initial updates | Already planned in SETUP-02 server baseline plan |
| Timezone | **Asia/Hong_Kong** (planned in SETUP-02) |
| Default user | **ubuntu** (standard Lightsail Ubuntu image) |
| Shell | **bash** |

Ubuntu LTS provides:
- Long-term security updates (5+ years)
- Widest community support for Node.js, Docker, PostgreSQL, Redis, Caddy
- Compatible `apt` package management
- Stable base for all runtime dependencies

SETUP-02 already documented the initial OS update and timezone configuration. SETUP-04 begins after the clean OS baseline exists.

---

## 7. Node.js 20 LTS Installation Plan

### Method: NodeSource Repository

The recommended installation method for Node.js 20 LTS on Ubuntu is via the NodeSource binary distribution.

### Future Installation Commands (Reference Only — Not Executed)

```bash
# Keith runs on VPS inside Lightsail browser SSH — future only
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Future Verification Commands (Reference Only — Not Executed)

```bash
node --version
# Expected: v20.x.x

npm --version
# Expected: 10.x.x (bundled with Node.js 20)
```

### Why Node.js 20 LTS

| Factor | Value |
|--------|-------|
| Root `package.json` `engines` field | `"node": ">=20.0.0"` |
| LTS status | Node.js 20 is Active LTS (supported through April 2026, maintenance through April 2027) |
| Compatibility | All project dependencies tested against Node.js 20 in local development |
| Alternative | Node.js 22 LTS is acceptable if 20 is unavailable, but 20 is the proven baseline |

### Node.js Installation Rules

- Install Node.js 20 LTS only (not latest/current).
- NodeSource repository is the recommended method for Ubuntu server deployments.
- Do NOT use `snap` to install Node.js (can cause permission issues with global packages).
- Do NOT use `nvm` on a server unless multiple Node.js versions are required (unnecessary complexity for staging).
- Verify `node --version` and `npm --version` after installation.

---

## 8. npm / Corepack / Package Manager Handling

### Root `package.json` Observation

The root `package.json` declares:

```json
"packageManager": "bun@1.x"
```

### Staging Decision: Use npm

| Factor | Decision |
|--------|----------|
| Local development | Uses `bun` per root `package.json` |
| Staging deployment | **Use `npm`** |
| Rationale | `npm` is bundled with Node.js 20; no additional tooling needed; simpler server setup; `bun` runtime is not required for production builds |

### npm on Staging

- `npm` is bundled with Node.js 20 — no separate installation needed.
- Use `npm ci` (not `npm install`) for deterministic installs from `package-lock.json`.
- If `package-lock.json` does not exist for a service or the workspace root, use `npm install` to generate it first, then use `npm ci` for subsequent installs.

### Corepack

- Corepack is bundled with Node.js 20 but disabled by default.
- For staging, **do NOT enable corepack** — it is unnecessary since we are using the bundled `npm`.
- If `bun` is needed on the VPS for any reason in the future, that would require a separate decision.

### Workspace Handling

The root `package.json` declares workspaces:

```json
"workspaces": ["services/*", "frontend"]
```

On the staging VPS, each service will be built individually in its own directory using `npm ci && npm run build`. The workspace root's `npm ci` may also install dependencies for all workspaces — verify which approach works during execution. The recommended approach is:

1. Run `npm ci` at the repo root to install all workspace dependencies.
2. Then `npm run build` in each service directory individually.

If workspace root `npm ci` fails due to missing `package-lock.json`, fall back to running `npm install` at the repo root first.

### Package Lock File Status

| Location | Expected State |
|----------|---------------|
| Root `package-lock.json` | UNKNOWN — may or may not exist in repo; verify during execution |
| `frontend/package-lock.json` | UNKNOWN — verify during execution |
| `services/api-gateway/package-lock.json` | UNKNOWN — verify during execution |
| `services/ai-service/package-lock.json` | UNKNOWN — verify during execution |
| `services/container-manager/package-lock.json` | UNKNOWN — verify during execution |

If lock files are missing, `npm install` must be run first to generate them. This is an execution-time concern, not a planning blocker.

---

## 9. Docker Engine Installation Plan

### Method: Official Docker Repository

The recommended installation method for Docker Engine on Ubuntu is via the official Docker `apt` repository.

### Future Installation Commands (Reference Only — Not Executed)

```bash
# Keith runs on VPS inside Lightsail browser SSH — future only

# Remove any older Docker packages
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Install prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Future Verification Commands (Reference Only — Not Executed)

```bash
docker --version
# Expected: Docker version 27.x.x or similar

sudo docker run hello-world
# Expected: "Hello from Docker!" message

docker compose version
# Expected: Docker Compose version v2.x.x
```

### Why Docker Engine

| Factor | Value |
|--------|-------|
| Container Manager dependency | Container Manager uses `dockerode` npm package — requires Docker socket |
| Sandbox containers | User sandbox containers are managed via Docker Engine |
| Staging parity | Docker Engine is required for full service parity |
| Kill switch safety | Docker sandbox execution is disabled by default via kill switches |

---

## 10. Docker Permission and Safety Plan

### Docker Group Access

```bash
# Future — Keith runs on VPS
sudo usermod -aG docker ubuntu
# Log out and log back in for group change to take effect
```

After this, the `ubuntu` user can run `docker` commands without `sudo`.

### Docker Safety Rules

| # | Rule |
|---|------|
| 1 | Docker socket access (`/var/run/docker.sock`) is powerful — equivalent to root |
| 2 | Container Manager requires Docker socket access to manage sandbox containers |
| 3 | Do NOT expose Docker socket publicly (port 2375/2376) |
| 4 | Do NOT run `docker compose down -v` without Keith explicit approval — destroys volumes |
| 5 | Do NOT run Docker containers with `--privileged` unless explicitly required |
| 6 | Do NOT mount sensitive host directories into containers |
| 7 | Keep Docker images updated for security patches |
| 8 | Remove unused images periodically: `docker image prune` |
| 9 | Monitor Docker disk usage: `docker system df` |
| 10 | For staging, sandbox execution is disabled by kill switches — Docker is installed for parity but will not run user containers until kill switches are enabled |

### Docker Socket Path

| Field | Value |
|-------|-------|
| Socket path | `/var/run/docker.sock` |
| Container Manager env var | `DOCKER_HOST=unix:///var/run/docker.sock` |
| Access | `ubuntu` user via `docker` group |

### Docker Volume Safety

- Docker volumes persist data beyond container lifecycle.
- `docker compose down -v` destroys all volumes — **never run without Keith explicit approval**.
- `docker compose down` (without `-v`) is safe — stops and removes containers but preserves volumes.
- `docker compose stop` is safest — stops containers without removing anything.

---

## 11. PM2 Installation Plan

### Method: Global npm Install

```bash
# Future — Keith runs on VPS — not executed now
sudo npm install -g pm2
```

### Future Verification Command (Reference Only — Not Executed)

```bash
pm2 --version
# Expected: 5.x.x or similar
```

### PM2 Concepts for Staging

| # | Concept | Notes |
|---|---------|-------|
| 1 | One process per service | Each service (frontend, api-gateway, ai-service, container-manager) runs as a separate PM2 process |
| 2 | Restart policy | PM2 auto-restarts crashed processes by default |
| 3 | Startup on boot | `pm2 startup` generates a systemd service to start PM2 on system boot |
| 4 | Process persistence | `pm2 save` saves the current process list for restoration after reboot |
| 5 | Log retention | PM2 stores logs in `~/.pm2/logs/`; configure log rotation with `pm2-logrotate` |
| 6 | Status monitoring | `pm2 status` shows all managed processes and their state |
| 7 | Log viewing | `pm2 logs <name>` shows real-time logs for a specific service |
| 8 | Restart individual | `pm2 restart <name>` restarts a specific service |
| 9 | Restart all | `pm2 restart all` restarts all managed services |
| 10 | Stop individual | `pm2 stop <name>` stops a specific service |
| 11 | Stop all | `pm2 stop all` stops all managed services |

### PM2 Post-Install Setup (Future — Not Executed Now)

```bash
# After PM2 is installed and services are configured:
pm2 startup
# Follow the printed command (copies a systemd unit file)
# Then after all services are started:
pm2 save
```

### PM2 Log Rotation (Future — Not Executed Now)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```

---

## 12. Caddy Installation Plan

### Method: Official Caddy Repository

Caddy installation was referenced in SETUP-03 (DNS/TLS Plan). The installation commands are repeated here for completeness.

### Future Installation Commands (Reference Only — Not Executed)

```bash
# Keith runs on VPS inside Lightsail browser SSH — future only
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Future Verification Command (Reference Only — Not Executed)

```bash
caddy version
# Expected: v2.x.x
```

### Caddy Configuration Notes

- Actual Caddyfile creation belongs to a later execution step (after DNS/static IP/server exist).
- The Caddyfile location on Ubuntu is typically `/etc/caddy/Caddyfile`.
- Caddy runs as a systemd service: `sudo systemctl start caddy`, `sudo systemctl stop caddy`, `sudo systemctl reload caddy`.
- Caddy must NOT be started until DNS A record for `staging.ainow.biz` resolves to the static IP.
- Conceptual Caddyfile (from SETUP-03 — not created in SETUP-04):

```text
staging.ainow.biz {
    reverse_proxy /api/* localhost:4000
    reverse_proxy localhost:3002
}
```

---

## 13. Git / Repo Clone Plan

### Git on Ubuntu

Git is pre-installed on Ubuntu LTS images. Verify with:

```bash
# Future — verify only
git --version
```

If git is not installed:

```bash
# Future — Keith runs on VPS
sudo apt install -y git
```

### Repo Clone (Future — Not Executed Now)

| Field | Value |
|-------|-------|
| Clone source | UNKNOWN — must be decided by Keith |
| Options | GitHub HTTPS clone, GitHub SSH clone, or manual transfer |
| Clone target | `/opt/aisandbox` |

### Clone Source Decision Required

Keith must decide before clone:

| # | Option | Notes |
|---|--------|-------|
| 1 | GitHub HTTPS clone | Requires GitHub personal access token or deploy key if repo is private |
| 2 | GitHub SSH clone | Requires SSH key configured for GitHub on the VPS |
| 3 | Manual transfer | `scp` or `rsync` from local machine — no GitHub access needed |

The clone source decision is deferred to execution. No repo clone occurs in SETUP-04.

### Clone Commands (Future — Reference Only)

```bash
# Option 1 — GitHub HTTPS (if repo is accessible)
sudo mkdir -p /opt/aisandbox
sudo chown ubuntu:ubuntu /opt/aisandbox
git clone https://github.com/<owner>/<repo>.git /opt/aisandbox

# Option 2 — GitHub SSH
git clone git@github.com:<owner>/<repo>.git /opt/aisandbox

# Option 3 — Manual transfer from Keith's machine
# (from Keith's local PowerShell)
# scp -r -i <key> C:\Users\knlee\aiSandBox2026B\* ubuntu@<static-ip>:/opt/aisandbox/
```

Replace `<owner>/<repo>` with actual GitHub repo path. Replace `<static-ip>` with actual Lightsail static IP.

---

## 14. Repo Target Path on VPS

| Field | Value |
|-------|-------|
| Repo path | **/opt/aisandbox** |
| Owner | `ubuntu:ubuntu` |
| Permissions | Standard user read/write/execute |

### Directory Structure on VPS (Expected After Clone)

```text
/opt/aisandbox/
  ├── package.json
  ├── frontend/
  │   └── package.json
  ├── services/
  │   ├── api-gateway/
  │   │   └── package.json
  │   ├── ai-service/
  │   │   └── package.json
  │   └── container-manager/
  │       └── package.json
  ├── docs/
  ├── docker-compose.yml
  └── ... (other project files)
```

### Rules

- `/opt/aisandbox` is the single source of truth for all deployed code on the VPS.
- The `.env` file must be created inside this directory (or service subdirectories as needed) by Keith — never committed.
- The `ubuntu` user must own `/opt/aisandbox` and all contents.
- No repo clone occurs in SETUP-04 planning.
- No git commit or push occurs in SETUP-04 planning.

---

## 15. Service Inventory

Identified from package.json files and existing documentation:

| # | Service | Location (relative to repo root) | Port | Required | Technology |
|---|---------|----------------------------------|------|----------|------------|
| 1 | Frontend | `frontend/` | 3002 | YES | Next.js 15 / React 19 |
| 2 | API Gateway | `services/api-gateway/` | 4000 | YES | NestJS 10 / TypeScript |
| 3 | AI Service Worker | `services/ai-service/` | 4001 | YES | NestJS 10 / TypeScript |
| 4 | Container Manager | `services/container-manager/` | 4002 | YES | NestJS 10 / TypeScript |
| 5 | PostgreSQL | System package (not in repo) | 5432 | YES | PostgreSQL 15 |
| 6 | Redis | System package (not in repo) | 6379 | YES | Redis 7 |
| 7 | Caddy | System package (not in repo) | 80/443 | YES | Caddy v2 |
| 8 | Docker Engine | System package (not in repo) | socket | YES | Docker CE |

### Key Dependencies Between Services

| Service | Depends On |
|---------|-----------|
| API Gateway | PostgreSQL, Redis (BullMQ) |
| AI Service Worker | PostgreSQL, Redis (BullMQ), API Gateway (internal endpoints) |
| Container Manager | Docker Engine socket, API Gateway (internal endpoints) |
| Frontend | API Gateway (`API_GATEWAY_URL` for SSR rewrites) |
| Caddy | Frontend (port 3002), API Gateway (port 4000), DNS A record |

---

## 16. Service Build Plan

### General Build Approach

All services are built from TypeScript source. The build produces JavaScript output in `dist/` (NestJS services) or `.next/` (frontend).

### Dependency Installation Approach

**Recommended approach — workspace root install:**

```bash
# Future — Keith runs on VPS
cd /opt/aisandbox
npm install
# or npm ci (if package-lock.json exists)
```

This installs dependencies for all workspaces (frontend + all services) in one pass.

**Fallback — per-service install:**

If workspace root install fails, install dependencies in each service individually:

```bash
cd /opt/aisandbox/frontend && npm install
cd /opt/aisandbox/services/api-gateway && npm install
cd /opt/aisandbox/services/ai-service && npm install
cd /opt/aisandbox/services/container-manager && npm install
```

### Build Commands by Service

All build commands identified from `package.json` `scripts.build`:

| # | Service | Build Command (run from service directory) | Build Script | Output |
|---|---------|-------------------------------------------|-------------|--------|
| 1 | Frontend | `npm run build` | `next build` | `.next/` directory |
| 2 | API Gateway | `npm run build` | `tsc` | `dist/` directory |
| 3 | AI Service Worker | `npm run build` | `tsc` | `dist/` directory |
| 4 | Container Manager | `npm run build` | `tsc` | `dist/` directory |

### Build Order

Build order is not strictly dependent, but the recommended order is:

1. API Gateway (build first — other services may reference shared types)
2. AI Service Worker
3. Container Manager
4. Frontend (build last — may take longer due to Next.js optimization)

### Build Verification

After each build, verify the output exists:

```bash
# Future — verify only
ls /opt/aisandbox/services/api-gateway/dist/main.js
ls /opt/aisandbox/services/ai-service/dist/main.js
ls /opt/aisandbox/services/container-manager/dist/main.js
ls /opt/aisandbox/frontend/.next/
```

---

## 17. Frontend Build/Start Plan

### Package.json Scripts (from `frontend/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `next build` | Build production-optimized Next.js app |
| `start` | `next start` | Start production Next.js server |
| `dev` | `next dev -p 3002` | Development mode (NOT for staging) |

### Frontend Build (Future — Not Executed Now)

```bash
cd /opt/aisandbox/frontend
npm run build
```

### Frontend Start (Future — Not Executed Now)

```bash
cd /opt/aisandbox/frontend
PORT=3002 npm start
# or equivalently:
# npx next start -p 3002
```

### Important: Port Configuration

The `start` script in `package.json` is `next start` without a port flag. The default Next.js port is 3000. To use port 3002 for staging, the port must be specified via:

- Environment variable: `PORT=3002`
- Or command line: `npx next start -p 3002`
- Or PM2 ecosystem configuration (see Section 23)

### Frontend Configuration Notes

| Item | Value |
|------|-------|
| Output mode | Standard (NOT standalone) — `next.config.js` does not set `output: 'standalone'` |
| API rewrite | `next.config.js` rewrites `/api/*` to `API_GATEWAY_URL` (default `http://localhost:4000`) |
| Required env | `API_GATEWAY_URL=http://localhost:4000` (server-side only — used by Next.js rewrites) |
| Port | 3002 (must be specified explicitly) |
| i18n | Supports en, zh-TW, zh-CN |

### Frontend Start via PM2 (Planned — Not Created Now)

```bash
# Future PM2 command — reference only
PORT=3002 pm2 start npm --name frontend --cwd /opt/aisandbox/frontend -- start
```

---

## 18. API Gateway Build/Start Plan

### Package.json Scripts (from `services/api-gateway/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `start` | `node dist/main.js` | Start production API Gateway |
| `dev` | `ts-node-dev --respawn --transpile-only src/main.ts` | Development mode (NOT for staging) |
| `migration:run:prod` | `typeorm migration:run -d dist/data-source.js` | Run migrations (production mode) |
| `migration:show` | `typeorm-ts-node-commonjs migration:show -d data-source.ts` | Show migration status (non-destructive) |

### API Gateway Build (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/api-gateway
npm run build
```

### API Gateway Start (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/api-gateway
node dist/main.js
# or via npm:
# npm start
```

### API Gateway Notes

| Item | Value |
|------|-------|
| Entry point | `dist/main.js` |
| Port | 4000 (configured via `PORT` env var) |
| Dependencies | PostgreSQL 15, Redis 7 (BullMQ), `INTERNAL_SERVICE_KEY` for internal API auth |
| Health endpoints | `GET /api/health`, `GET /api/health/db`, `GET /api/health/ready` |
| Migration command (prod) | `npm run migration:run:prod` — requires Keith explicit approval |
| Migration status (safe) | `npm run migration:show` — non-destructive |

### API Gateway Start via PM2 (Planned — Not Created Now)

```bash
# Future PM2 command — reference only
pm2 start dist/main.js --name api-gateway --cwd /opt/aisandbox/services/api-gateway
```

---

## 19. AI Service Worker Build/Start Plan

### Package.json Scripts (from `services/ai-service/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `start` | `node dist/main.js` | Start production AI Service Worker |
| `dev` | `ts-node-dev --respawn --transpile-only src/main.ts` | Development mode (NOT for staging) |

### AI Service Worker Build (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/ai-service
npm run build
```

### AI Service Worker Start (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/ai-service
node dist/main.js
```

### AI Service Worker Notes

| Item | Value |
|------|-------|
| Entry point | `dist/main.js` |
| Port | 4001 |
| Dependencies | PostgreSQL 15, Redis 7 (BullMQ), API Gateway (internal endpoints) |
| Kill switches | `GLOBAL_EXECUTION_ENABLED=false`, `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`, `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` — all disabled for initial staging |
| Health check | No dedicated health endpoint — health inferred from PM2 process status and BullMQ activity |

### AI Service Worker Start via PM2 (Planned — Not Created Now)

```bash
# Future PM2 command — reference only
pm2 start dist/main.js --name ai-service --cwd /opt/aisandbox/services/ai-service
```

---

## 20. Container Manager Build/Start Plan

### Package.json Scripts (from `services/container-manager/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `start` | `node dist/main.js` | Start production Container Manager |
| `dev` | `ts-node-dev --respawn --transpile-only src/main.ts` | Development mode (NOT for staging) |

### Container Manager Build (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/container-manager
npm run build
```

### Container Manager Start (Future — Not Executed Now)

```bash
cd /opt/aisandbox/services/container-manager
node dist/main.js
```

### Container Manager Notes

| Item | Value |
|------|-------|
| Entry point | `dist/main.js` |
| Port | 4002 |
| Dependencies | Docker Engine socket (`dockerode` npm package), API Gateway (internal endpoints) |
| Docker env var | `DOCKER_HOST=unix:///var/run/docker.sock` |
| Health endpoint | `GET /health` on port 4002 |
| Staging behavior | Deployed for parity; sandbox container operations disabled by kill switches |

### Container Manager Start via PM2 (Planned — Not Created Now)

```bash
# Future PM2 command — reference only
pm2 start dist/main.js --name container-manager --cwd /opt/aisandbox/services/container-manager
```

---

## 21. PostgreSQL / Redis Dependency Notes

### PostgreSQL 15

| Item | Value |
|------|-------|
| Installation | System package: `sudo apt install -y postgresql-15` |
| Port | 5432 (localhost only) |
| Database name | `aisandbox` |
| User | `aisandbox` |
| Binding | `127.0.0.1` only — must NOT be internet-exposed |
| Setup belongs to | SETUP-06 — Database / Redis Setup |

PostgreSQL must be running and configured before API Gateway or AI Service Worker can start. Database creation, user creation, password configuration, and `pg_hba.conf` configuration belong to SETUP-06.

### Redis 7

| Item | Value |
|------|-------|
| Installation | System package: `sudo apt install -y redis-server` |
| Port | 6379 (localhost only) |
| Authentication | Password-protected (`requirepass` in `redis.conf`) |
| Binding | `127.0.0.1` only — must NOT be internet-exposed |
| Setup belongs to | SETUP-06 — Database / Redis Setup |

Redis must be running before API Gateway, AI Service Worker, or any BullMQ-dependent service can start.

### Dependency Chain

```
PostgreSQL must be running
  → API Gateway can start (requires DB connection)
  → AI Service Worker can start (requires DB connection)

Redis must be running
  → API Gateway can start (requires Redis/BullMQ connection)
  → AI Service Worker can start (requires Redis/BullMQ connection)
```

PostgreSQL and Redis installation/configuration are NOT part of SETUP-04. They belong to SETUP-06 (Database / Redis Setup).

---

## 22. Environment File Creation Procedure (Without Exposing Secrets)

### Procedure Overview

The `.env` file must be created on the VPS by Keith. No secret values appear in this document or any planning document.

### Steps (Future — Not Executed Now)

| # | Step | Who |
|---|------|-----|
| 1 | Clone repo to `/opt/aisandbox` | Keith (after SETUP-04 execution step) |
| 2 | Copy template to `.env` | Keith: `cp .env.staging.example .env` (or create from DEPLOYMENT-GUIDE.md Section 6 template) |
| 3 | Restrict permissions | Keith: `chmod 600 .env` |
| 4 | Generate secrets | Keith runs `openssl rand -hex 32` (or `-hex 64` for JWT/session) for each secret key |
| 5 | Edit `.env` with real values | Keith manually replaces placeholder values on the VPS |
| 6 | Verify presence | Keith or AI verifies key presence without reading values (SETUP-05 scope) |

### Rules

| # | Rule |
|---|------|
| 1 | No secret values in this document |
| 2 | No secret values in any planning document |
| 3 | No secret values in Cursor/chat |
| 4 | `.env` file is created on the VPS only by Keith or safe secret-entry procedure |
| 5 | `.env` must NOT be committed to git |
| 6 | `.env` must have `chmod 600` permissions (owner read/write only) |
| 7 | Secret generation uses `openssl rand -hex 32` (or `-hex 64`) |
| 8 | Each environment (staging, production) must use unique secrets |
| 9 | SETUP-05 will handle the env variable presence checklist and secret-entry procedure |
| 10 | No `.env` creation occurs in SETUP-04 |

### Secret Generation Reference (Key Names Only — No Values)

```bash
# Keith runs on VPS — values stay on the server
openssl rand -hex 32   # → INTERNAL_SERVICE_KEY
openssl rand -hex 64   # → JWT_SECRET
openssl rand -hex 64   # → SESSION_SECRET
openssl rand -hex 64   # → OAUTH_STATE_SECRET
openssl rand -hex 32   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → REDIS_PASSWORD
```

---

## 23. PM2 Ecosystem Plan

### Conceptual PM2 Ecosystem File (Planned — Not Created Now)

A PM2 ecosystem file (`ecosystem.config.js`) would define all services in a single configuration. This file would be created on the VPS during a future execution step.

### Conceptual Ecosystem Structure (Reference Only)

```javascript
// /opt/aisandbox/ecosystem.config.js — CONCEPTUAL — NOT CREATED NOW
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: '/opt/aisandbox/services/api-gateway',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '4000'
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'ai-service',
      cwd: '/opt/aisandbox/services/ai-service',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '4001'
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'container-manager',
      cwd: '/opt/aisandbox/services/container-manager',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: '4002'
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    },
    {
      name: 'frontend',
      cwd: '/opt/aisandbox/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      env: {
        NODE_ENV: 'production',
        PORT: '3002'
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
```

### PM2 Ecosystem Notes

| # | Note |
|---|------|
| 1 | Ecosystem file is planned only — not created in SETUP-04 |
| 2 | Each service runs as a separate PM2 process |
| 3 | `autorestart: true` ensures PM2 restarts crashed processes |
| 4 | `max_restarts: 10` prevents infinite restart loops |
| 5 | `restart_delay: 5000` (5 seconds) provides backoff between restart attempts |
| 6 | `instances: 1` — single instance per service (adequate for staging) |
| 7 | Environment variables in the ecosystem file are NON-SECRET defaults only |
| 8 | Secret environment variables must be loaded from the `.env` file, not embedded in the ecosystem file |
| 9 | The ecosystem file must be reviewed and adjusted during execution based on actual service behavior |
| 10 | Frontend start uses `next start -p 3002` — the exact PM2 `script`/`args` format may need adjustment during execution |

### PM2 Ecosystem File Alternatives

If the ecosystem file approach has issues, individual PM2 start commands can be used instead:

```bash
# Alternative — individual PM2 start (reference only)
pm2 start dist/main.js --name api-gateway --cwd /opt/aisandbox/services/api-gateway
pm2 start dist/main.js --name ai-service --cwd /opt/aisandbox/services/ai-service
pm2 start dist/main.js --name container-manager --cwd /opt/aisandbox/services/container-manager
PORT=3002 pm2 start npm --name frontend --cwd /opt/aisandbox/frontend -- start
pm2 save
pm2 startup
```

---

## 24. Service Startup Order

### Recommended Startup Order

| # | Service | Wait For | Verification |
|---|---------|----------|--------------|
| 1 | PostgreSQL | `pg_isready` returns exit code 0 | `pg_isready -U aisandbox -d aisandbox` |
| 2 | Redis | `redis-cli ping` returns `PONG` | `redis-cli -a <password> ping` |
| 3 | API Gateway | `GET /api/health/ready` returns 200 | `curl http://localhost:4000/api/health/ready` |
| 4 | Container Manager | `GET /health` returns 200 on port 4002 | `curl http://localhost:4002/health` |
| 5 | AI Service Worker | Process starts (BullMQ connection established) | `pm2 status ai-service` shows `online` |
| 6 | Frontend | HTTP 200 on `http://localhost:3002` | `curl http://localhost:3002` |
| 7 | Caddy | HTTPS 200 on `https://staging.ainow.biz` | `curl https://staging.ainow.biz` (external) |

### Startup Order Rationale

- PostgreSQL and Redis must be running before any application service starts — all services depend on them.
- API Gateway must be running before Container Manager and AI Service Worker — they call API Gateway internal endpoints.
- Container Manager can start before or after AI Service Worker — they are independent of each other.
- Frontend must be running before Caddy can successfully proxy requests to it.
- Caddy must be started last — it serves as the public entry point.

### Shutdown Order (Reverse of Startup)

| # | Service | Action | Notes |
|---|---------|--------|-------|
| 1 | Caddy | `sudo systemctl stop caddy` | Stops external traffic immediately |
| 2 | Frontend | `pm2 stop frontend` | No new page loads |
| 3 | AI Service Worker | `pm2 stop ai-service` | Let running jobs finish or timeout |
| 4 | Container Manager | `pm2 stop container-manager` | Stop user containers gracefully |
| 5 | API Gateway | `pm2 stop api-gateway` | Close connections |
| 6 | Redis | `sudo systemctl stop redis-server` | RDB snapshot auto-saved |
| 7 | PostgreSQL | `sudo systemctl stop postgresql` | Clean shutdown |

### Notes

- This startup order may be adjusted based on actual dependency checks during execution.
- PostgreSQL and Redis are managed by systemd (system packages), not PM2.
- Application services (API Gateway, AI Service, Container Manager, Frontend) are managed by PM2.
- Caddy is managed by systemd.

---

## 25. Health Check Plan

### Service Health Checks

| # | Service | Check Method | Command / URL | Expected Result |
|---|---------|-------------|---------------|-----------------|
| 1 | PostgreSQL | CLI | `pg_isready -U aisandbox -d aisandbox` | Exit code 0 |
| 2 | Redis | CLI | `redis-cli -a <password> ping` | `PONG` |
| 3 | API Gateway — basic | HTTP | `curl http://localhost:4000/api/health` | `{ "status": "ok" }` |
| 4 | API Gateway — DB | HTTP | `curl http://localhost:4000/api/health/db` | `{ "status": "ok", "database": "connected" }` |
| 5 | API Gateway — ready | HTTP | `curl http://localhost:4000/api/health/ready` | `{ "status": "ready", ... }` |
| 6 | Container Manager | HTTP | `curl http://localhost:4002/health` | `{ "status": "ok" }` |
| 7 | AI Service Worker | PM2 | `pm2 status ai-service` | Shows `online` status |
| 8 | Frontend — local | HTTP | `curl http://localhost:3002` | HTTP 200 |
| 9 | Caddy — external | HTTPS | `curl https://staging.ainow.biz` | HTTP 200 + valid TLS |
| 10 | Caddy — API route | HTTPS | `curl https://staging.ainow.biz/api/health` | `{ "status": "ok" }` |

### Health Check Sequence (Future — After Full Deployment)

1. SSH to Lightsail VPS.
2. `pg_isready -U aisandbox -d aisandbox` — PostgreSQL running.
3. `redis-cli -a <password> ping` — Redis running.
4. `pm2 status` — all 4 app services show `online`.
5. `curl http://localhost:4000/api/health` — API Gateway basic health.
6. `curl http://localhost:4000/api/health/db` — API Gateway DB connectivity.
7. `curl http://localhost:4000/api/health/ready` — API Gateway full readiness.
8. `curl http://localhost:4002/health` — Container Manager health.
9. `curl http://localhost:3002` — Frontend local response.
10. From external machine: `curl https://staging.ainow.biz` — Caddy + TLS + frontend.
11. From external machine: `curl https://staging.ainow.biz/api/health` — Caddy + TLS + API.
12. Verify logs are clean: `pm2 logs --lines 50`.

### Health Check Notes

- Steps 1–9 run on the VPS (internal checks).
- Steps 10–11 run from an external machine or browser (external checks).
- External checks only work after DNS A record is configured and Caddy has TLS.
- AI Service Worker has no dedicated health endpoint — health is inferred from PM2 status and BullMQ job processing.

---

## 26. Log Location Plan

### PM2 Logs

| Item | Location |
|------|----------|
| PM2 log directory | `~/.pm2/logs/` (i.e., `/home/ubuntu/.pm2/logs/`) |
| API Gateway stdout | `~/.pm2/logs/api-gateway-out.log` |
| API Gateway stderr | `~/.pm2/logs/api-gateway-error.log` |
| AI Service stdout | `~/.pm2/logs/ai-service-out.log` |
| AI Service stderr | `~/.pm2/logs/ai-service-error.log` |
| Container Manager stdout | `~/.pm2/logs/container-manager-out.log` |
| Container Manager stderr | `~/.pm2/logs/container-manager-error.log` |
| Frontend stdout | `~/.pm2/logs/frontend-out.log` |
| Frontend stderr | `~/.pm2/logs/frontend-error.log` |

### System Service Logs

| Item | Command |
|------|---------|
| PostgreSQL logs | `sudo journalctl -u postgresql` |
| Redis logs | `sudo journalctl -u redis-server` |
| Caddy logs | `sudo journalctl -u caddy` |
| System logs | `sudo journalctl -f` (follow all) |

### PM2 Log Commands

| Command | Purpose |
|---------|---------|
| `pm2 logs` | Show all service logs (real-time) |
| `pm2 logs api-gateway` | Show API Gateway logs (real-time) |
| `pm2 logs api-gateway --lines 100` | Show last 100 lines of API Gateway logs |
| `pm2 flush` | Clear all PM2 log files |

### Log Rotation

- PM2 log rotation via `pm2-logrotate` module (see Section 11).
- System logs are managed by `journald` (automatic rotation).
- PostgreSQL, Redis, and Caddy logs are managed by their respective systemd services.

### Log Monitoring for Beta

| # | Item | Method |
|---|------|--------|
| 1 | Real-time log monitoring | `pm2 logs` on VPS |
| 2 | Error log monitoring | `pm2 logs --err` on VPS |
| 3 | Disk space check | `df -h` and `du -sh ~/.pm2/logs/` |
| 4 | Log retention policy | Keep 7 rotated log files (via `pm2-logrotate`) |

---

## 27. Rollback / Restart Plan

### Individual Service Restart

| # | Scenario | Command |
|---|----------|---------|
| 1 | Restart a single service | `pm2 restart <service-name>` |
| 2 | Restart all services | `pm2 restart all` |
| 3 | Stop a single service | `pm2 stop <service-name>` |
| 4 | Stop all services | `pm2 stop all` |

### Data Layer Restart

| # | Scenario | Command |
|---|----------|---------|
| 1 | Restart PostgreSQL | `sudo systemctl restart postgresql` |
| 2 | Restart Redis | `sudo systemctl restart redis-server` |
| 3 | Check PostgreSQL status | `sudo systemctl status postgresql` |
| 4 | Check Redis status | `sudo systemctl status redis-server` |

### Bad Deployment Rollback

| # | Step | Command |
|---|------|---------|
| 1 | Stop all app services | `pm2 stop all` |
| 2 | Revert to last known good code | `cd /opt/aisandbox && git checkout <last-known-good-commit>` |
| 3 | Rebuild all services | Run `npm run build` in each service directory |
| 4 | Restart all services | `pm2 restart all` |
| 5 | Verify health | Run health check sequence (Section 25) |

### Kill Switches (from DEPLOYMENT-GUIDE.md)

| # | Kill Switch | Effect | How |
|---|------------|--------|-----|
| K1 | Stop AI Service Worker | No new AI executions; jobs queue in Redis | `pm2 stop ai-service` |
| K2 | `GLOBAL_EXECUTION_ENABLED=false` + restart API Gateway | All AI execution returns 503 | Edit `.env` → `pm2 restart api-gateway` |
| K3 | `AGENT_HARNESS_ENABLE_WRITE_TOOLS=false` + restart AI Worker | Write tools disabled; read-only continues | Edit `.env` → `pm2 restart ai-service` |
| K4 | `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` + restart AI Worker | Tool loop disabled entirely | Edit `.env` → `pm2 restart ai-service` |
| K5 | `LAUNCH_STATE=CLOSED` + restart API Gateway | Platform access denied to all users | Edit `.env` → `pm2 restart api-gateway` |
| K6 | Stop Caddy | No external traffic reaches any service | `sudo systemctl stop caddy` |

### Emergency Shutdown

```bash
# Emergency — stop everything
pm2 stop all
sudo systemctl stop caddy
# PostgreSQL and Redis can remain running unless explicitly needed to stop
```

### Database Backup Before Risky Operations

```bash
# Keith runs on VPS before migration or risky change
pg_dump -U aisandbox -d aisandbox > /home/ubuntu/backups/aisandbox_$(date +%Y%m%d_%H%M%S).sql
```

### Lightsail Snapshot for Full-VPS Rollback

Lightsail snapshots (created via AWS console) provide full-VPS rollback. Snapshots should be created:

- After initial runtime baseline (Node.js + Docker + PM2 + Caddy installed)
- Before first app deployment
- Before migration execution
- Before major configuration changes

---

## 28. Keith Manual Actions

These actions must be performed by Keith manually. They are documented for future reference — **do not execute in this planning step.**

### Runtime Installation Actions (Future)

| # | Action | Prerequisite |
|---|--------|-------------|
| 1 | Install Node.js 20 LTS via NodeSource | SSH access to VPS |
| 2 | Verify `node --version` and `npm --version` | Node.js installed |
| 3 | Install Docker Engine via official repository | SSH access to VPS |
| 4 | Add `ubuntu` user to `docker` group | Docker installed |
| 5 | Verify `docker --version` and `docker run hello-world` | Docker installed |
| 6 | Install PM2 globally: `sudo npm install -g pm2` | Node.js installed |
| 7 | Verify `pm2 --version` | PM2 installed |
| 8 | Install Caddy via official repository | SSH access to VPS |
| 9 | Verify `caddy version` | Caddy installed |
| 10 | Create Lightsail snapshot after runtime baseline | All runtime tools installed |

### Deployment Actions (Future)

| # | Action | Prerequisite |
|---|--------|-------------|
| 11 | Decide clone source (GitHub HTTPS/SSH or manual transfer) | SSH access to VPS |
| 12 | Create `/opt/aisandbox` directory: `sudo mkdir -p /opt/aisandbox && sudo chown ubuntu:ubuntu /opt/aisandbox` | SSH access |
| 13 | Clone or transfer repo to `/opt/aisandbox` | Clone source decided |
| 14 | Install dependencies: `cd /opt/aisandbox && npm install` | Repo cloned |
| 15 | Build all services: `npm run build` in each service directory | Dependencies installed |
| 16 | Verify build outputs exist | Services built |
| 17 | Create `.env` file with real secrets (SETUP-05 procedure) | Template available |
| 18 | Start services via PM2 (in startup order) | Builds complete + env configured |
| 19 | Run `pm2 save` and `pm2 startup` | Services running |
| 20 | Create Lightsail snapshot before migration | Services running |
| 21 | Create Caddyfile and start Caddy | DNS A record configured |
| 22 | Verify all health checks pass | Full stack running |

---

## 29. What Must Not Happen Yet

| # | Prohibited Action | Belongs To |
|---|-------------------|-----------|
| 1 | Install Node.js | Future execution step |
| 2 | Install Docker | Future execution step |
| 3 | Install PM2 | Future execution step |
| 4 | Install Caddy | Future execution step |
| 5 | Clone repo | Future execution step |
| 6 | Build services | Future execution step |
| 7 | Start services | Future execution step |
| 8 | Configure PM2 | Future execution step |
| 9 | Create Caddyfile | Future execution step |
| 10 | Create `.env` files | SETUP-05 |
| 11 | Run migrations | SETUP-08 with Keith explicit approval |
| 12 | Create AWS server / static IP | Future execution step (Keith approval) |
| 13 | Configure DNS / TLS | Future execution step (after server/static IP exist) |
| 14 | Change firewall rules | Future execution step |
| 15 | SSH to any server | Future execution step |
| 16 | Use Docker / PostgreSQL / Redis | Future execution step |
| 17 | Run tests or builds | Future execution step |
| 18 | Call APIs or open browser | Future execution step |
| 19 | Modify source / test / package / migration / entity files | Not in scope |
| 20 | Open / edit `.env` or secret-bearing files | Not in scope |
| 21 | Invite beta users | Separate explicit approval |
| 22 | Claim beta launch | Not applicable |
| 23 | Git commit or git push | Not in scope |

---

## 30. PASS / BLOCKED Criteria

### PASS — Step 2 passes if ALL of the following are recorded:

- [ ] Node.js 20 LTS installation plan recorded.
- [ ] Docker Engine installation plan recorded.
- [ ] Docker permission and safety plan recorded.
- [ ] PM2 installation plan recorded.
- [ ] Caddy installation plan recorded.
- [ ] Git / repo clone plan recorded.
- [ ] Repo path (`/opt/aisandbox`) recorded.
- [ ] Service inventory recorded (frontend, API Gateway, AI Service, Container Manager, PostgreSQL, Redis, Caddy, Docker).
- [ ] Service build plan recorded based on package.json scripts.
- [ ] Frontend build/start plan recorded (`next build` / `next start -p 3002`).
- [ ] API Gateway build/start plan recorded (`tsc` / `node dist/main.js`).
- [ ] AI Service Worker build/start plan recorded (`tsc` / `node dist/main.js`).
- [ ] Container Manager build/start plan recorded (`tsc` / `node dist/main.js`).
- [ ] PM2 ecosystem concept recorded.
- [ ] Service startup order recorded (PostgreSQL → Redis → API Gateway → Container Manager → AI Service → Frontend → Caddy).
- [ ] Health check plan recorded.
- [ ] Log location plan recorded.
- [ ] Rollback / restart plan recorded.
- [ ] Environment / secrets procedure deferred safely to SETUP-05.
- [ ] No installation, deployment, or runtime occurred.

### BLOCKED — Step 2 is BLOCKED if ANY of the following are true:

- [ ] Package scripts cannot be identified enough to plan safely.
- [ ] Runtime plan requires source/package/env/Dockerfile changes now.
- [ ] Deployment execution is required in this step.
- [ ] Secret handling is unsafe.
- [ ] Docker safety is unclear.
- [ ] Service inventory is unclear.
- [ ] Startup order is unsafe.
- [ ] Rollback / restart path is missing.

**Step 2 verdict: PASS — all criteria met. No blockers identified.**

All package.json scripts were identified successfully:
- Frontend: `build` → `next build`, `start` → `next start`
- API Gateway: `build` → `tsc`, `start` → `node dist/main.js`
- AI Service: `build` → `tsc`, `start` → `node dist/main.js`
- Container Manager: `build` → `tsc`, `start` → `node dist/main.js`

---

## 31. Handoff to SETUP-05

| Field | Value |
|-------|-------|
| Next child task | **PRIVATE-BETA-STAGING-SETUP-05** |
| Title | **Env Variable Presence Checklist + Secret Entry Procedure** |
| Scope | Plan env variable presence checklist (key names only, no values); plan safe secret-entry procedure for Keith; plan `.env` file creation steps; plan `chmod 600` verification |
| Prerequisites | SETUP-04 PASS (this document confirms) |
| Registration | Keith must explicitly approve SETUP-05 registration |

### SETUP-05 Expected Scope

1. Comprehensive env variable key name checklist (cross-referenced from DEPLOYMENT-GUIDE.md and stage-start).
2. Secret-entry procedure for Keith (generate secrets on VPS, populate `.env`).
3. Env file permission verification (`chmod 600`).
4. Presence-only verification plan (check key existence without reading values).
5. Service-by-service env variable mapping.
6. No secret values in any document.
7. No `.env` creation in SETUP-05 planning step.

**SETUP-05 is NOT registered in this step.** Registration belongs to Step 3 (Consolidation) or a future explicit registration step.

---

## 32. Safety Boundaries

| # | Safety Boundary |
|---|----------------|
| 1 | No implementation during this step |
| 2 | No Node.js installation |
| 3 | No Docker installation |
| 4 | No PM2 installation |
| 5 | No Caddy installation |
| 6 | No repo clone |
| 7 | No service builds |
| 8 | No service starts |
| 9 | No PM2 configuration |
| 10 | No Caddyfile creation |
| 11 | No `.env` file creation or modification |
| 12 | No source code changes |
| 13 | No test file changes |
| 14 | No package file changes |
| 15 | No migration execution |
| 16 | No environment file editing or opening |
| 17 | No Docker / runtime startup |
| 18 | No PostgreSQL / Redis use |
| 19 | No user invitations |
| 20 | No public beta launch claims |
| 21 | No secrets opened, printed, or exposed |
| 22 | No `.env`, `.env.local`, `.env.staging`, `.env.production` opened |
| 23 | No credential, key, certificate, or token files opened |
| 24 | No destructive database commands |
| 25 | No `docker compose down -v` |
| 26 | No deployment setup or configuration changes |
| 27 | No git commit or git push |
| 28 | No subagents |
| 29 | No governance file changes (TASKS.md, TASKS_BACKLOG_FULL.md, roadmap) |
| 30 | No AWS server creation or static IP creation |
| 31 | No DNS or TLS configuration |
| 32 | No firewall changes |
| 33 | No SSH connections |
| 34 | No API calls |
| 35 | No browser automation |
| 36 | No test or build execution |

---

## 33. Exact Next Action

**Step 2 is COMPLETE. Proceed to Step 3 — Consolidation / Handoff to SETUP-05.**

Step 3 will:

1. Update TASKS.md — mark SETUP-04 COMPLETE and LOCKED.
2. Update TASKS_BACKLOG_FULL.md — mirror status.
3. Update AINOW-EXECUTION-ROADMAP.md — mirror status.
4. Create checkpoint document: `docs/PRIVATE-BETA-STAGING-SETUP-04-CHECKPOINT.md`.
5. Hand off to SETUP-05 registration (Keith explicit approval required).

**Keith must explicitly say "go" or equivalent before Step 3 (Consolidation) begins.**

No installation. No deployment. No runtime. No SSH. No Docker. No PostgreSQL. No Redis. No builds. No tests. No API calls. No browser. No migration execution. No `.env` creation. No secrets. No subagents. No governance file changes.

---

**Document created:** 2026-07-21
**Step 2 status:** Runtime / Container Deployment Plan CREATED.
**Step 2 verdict:** PASS — all criteria met. No blockers identified.
**No Node.js installed.**
**No Docker installed.**
**No PM2 installed.**
**No Caddy installed.**
**No repo cloned.**
**No services built.**
**No services started.**
**No PM2 configured.**
**No Caddyfile created.**
**No `.env` created or modified.**
**No implementation occurred.**
**No source/test/package/migration/entity/environment/Docker/deployment files changed.**
**No runtime, Docker, DB, browser, API, test, build, migration execution, or deployment occurred.**
**No git commit or git push occurred.**
**No secret-bearing environment file opened.**
**No subagents used.**
