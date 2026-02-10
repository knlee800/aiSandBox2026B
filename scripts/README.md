# AI Sandbox Platform - Startup Scripts

**Phase 35B-2: Startup Orchestration**

This directory contains orchestration scripts for single-command startup of the entire AI Sandbox Platform.

---

## Quick Start

### Windows (PowerShell)

```powershell
npm run start:all
```

Or directly:

```powershell
pwsh -File scripts/start-all.ps1
```

### Linux / macOS (Bash)

```bash
npm run start:all:bash
```

Or directly:

```bash
bash scripts/start-all.sh
```

---

## What These Scripts Do

The startup orchestration scripts perform the following steps in order:

1. **Prerequisites Check**
   - Verify Docker is installed
   - Verify Node.js is installed
   - Verify npm is installed

2. **Start PostgreSQL**
   - Start PostgreSQL container via docker-compose
   - Wait for health check to pass
   - Verify database is ready

3. **Start API Gateway**
   - Start API Gateway service (port 4000)
   - Wait for `/api/health` endpoint to respond
   - Verify readiness via `/api/health/ready`
   - Check database connection
   - Verify environment validation
   - Verify kill switches and safety limits loaded

4. **Start AI Service**
   - Start AI Service (port 4001)
   - Wait for `/health` endpoint to respond

5. **Start Frontend**
   - Start Next.js frontend (port 3000)
   - Wait for port to be available

---

## Configuration

### Environment Variables

You can customize the health check behavior:

**PowerShell:**
```powershell
$env:HEALTH_CHECK_TIMEOUT = 60
$env:HEALTH_CHECK_INTERVAL = 5
npm run start:all
```

**Bash:**
```bash
export HEALTH_CHECK_TIMEOUT=60
export HEALTH_CHECK_INTERVAL=5
npm run start:all:bash
```

### Default Values

- `HEALTH_CHECK_TIMEOUT`: 30 seconds
- `HEALTH_CHECK_INTERVAL`: 2 seconds

---

## Readiness Checks

The scripts perform comprehensive readiness checks:

### API Gateway Readiness

The script calls `GET /api/health/ready` and verifies:

- ✅ Environment validated
- ✅ Database connected
- ✅ Kill switches loaded
- ✅ Safety limits loaded

**Success Response:**
```json
{
  "status": "ready",
  "checks": {
    "environment": "validated",
    "database": "connected",
    "killSwitches": "loaded",
    "safetyLimits": "loaded"
  }
}
```

**Failure Response (503):**
```json
{
  "status": "not_ready",
  "error": "Database connection failed"
}
```

---

## Failure Handling

If any service fails to start, the script will:

1. **Stop orchestration** immediately
2. **Display clear error message** with the failure reason
3. **Provide actionable remediation steps**
4. **Exit with non-zero code**

### Example Failure Output

```
❌ API Gateway did not become ready within 30 seconds

ℹ️  Remediation:
  1. Check if port 4000 is available
  2. Check services/api-gateway/.env file exists
  3. Run manually: cd services/api-gateway && npm run dev
```

---

## Common Issues

### Issue: Port Already in Use

**Symptom:**
```
ℹ️  Port 4000 is already in use (API Gateway may already be running)
```

**Solution:**
- If the service is already running, the script will skip starting it
- If another process is using the port, stop that process first

**Check what's using a port:**

Windows:
```powershell
netstat -ano | findstr :4000
```

Linux/macOS:
```bash
lsof -i :4000
```

---

### Issue: PostgreSQL Not Healthy

**Symptom:**
```
❌ PostgreSQL did not become healthy within 30 seconds
```

**Solution:**
1. Check Docker is running: `docker ps`
2. Check PostgreSQL logs: `docker logs aisandbox-postgres`
3. Manually start: `docker-compose up -d postgres`
4. Wait and retry: `docker inspect aisandbox-postgres`

---

### Issue: API Gateway Not Ready

**Symptom:**
```
❌ API Gateway is not ready: not_ready
Error: Database connection failed
```

**Solution:**
1. Verify PostgreSQL is running: `docker ps | grep postgres`
2. Check environment variables in `services/api-gateway/.env`
3. Test database connection: `npm run db:test`
4. Check API Gateway logs manually: `cd services/api-gateway && npm run dev`

---

### Issue: Prerequisites Missing

**Symptom:**
```
❌ Docker is not installed or not in PATH
```

**Solution:**
- Install Docker Desktop: https://www.docker.com/products/docker-desktop
- Install Node.js: https://nodejs.org/
- Ensure all tools are in your PATH

---

## Manual Startup (Alternative)

If the orchestration script fails, you can start services manually:

### Step 1: Start PostgreSQL
```bash
docker-compose up -d postgres
```

### Step 2: Start API Gateway
```bash
cd services/api-gateway
npm run dev
```

### Step 3: Start AI Service
```bash
cd services/ai-service
npm run dev
```

### Step 4: Start Frontend
```bash
cd frontend
npm run dev
```

---

## Architecture Compliance

### Constraints Followed

✅ **No Backend Changes**
- Scripts only orchestrate existing services
- No modifications to API Gateway, AI Service, or Container Manager

✅ **No New API Endpoints**
- Uses existing `/api/health` and `/api/health/ready` endpoints
- No new endpoints created

✅ **No Schema Changes**
- No database modifications
- No migrations

✅ **No Configuration Mutation**
- Scripts do not modify .env files
- Scripts do not modify configuration files

✅ **No Background Daemons**
- Services run in foreground (visible terminals)
- No hidden background processes

✅ **No Docker Orchestration Changes**
- Uses existing docker-compose.yml
- No modifications to container configuration

---

## Stopping Services

The orchestration scripts start services in separate processes. To stop them:

### Windows
1. Find each service terminal window
2. Press `Ctrl+C` in each window

Or use Task Manager to kill processes by PID.

### Linux / macOS
1. Find each service terminal
2. Press `Ctrl+C` in each terminal

Or kill by PID:
```bash
kill <PID>
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) — Project governance and workflow
- [PRD.md](../PRD.md) — Product requirements
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System architecture
- [RUNBOOK.md](../RUNBOOK.md) — Database operations
- [docs/PHASE-35B-1-CHECKPOINT.md](../docs/PHASE-35B-1-CHECKPOINT.md) — System Readiness UI
- [docs/PHASE-35B-2-CHECKPOINT.md](../docs/PHASE-35B-2-CHECKPOINT.md) — This implementation

---

**Phase:** 35B-2  
**Nature:** IMPLEMENTATION  
**Scope:** FRONTEND + LOCAL DEV TOOLING ONLY  
**Status:** ✅ COMPLETE
