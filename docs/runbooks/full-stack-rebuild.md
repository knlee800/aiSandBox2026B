# Runbook: Full Stack Rebuild (Host/Node Loss)

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md Section 4.2  
**Scenario:** Host/node loss (hardware failure, VM termination)

---

## Title

Full Stack Rebuild After Host/Node Loss

---

## Prerequisites

| Item | Notes |
|------|-------|
| New host | Provisioned with Docker, Docker Compose |
| Repository | Source code or deployment bundle |
| PostgreSQL backup | From backup procedure |
| Configuration backup | `.env`, docker-compose.prod.yml, monitoring |
| Credentials | All secrets from backup or secure store |

---

## Verification (Before Restore)

1. **Backup files available**
   - PostgreSQL dump
   - Configuration backup (`.env`, compose, monitoring)

2. **New host ready**
   - Docker installed
   - Docker Compose installed
   - Sufficient resources (CPU, memory, disk)

3. **Verify backup integrity**
   - See `docs/backup/backup-verification.md`

---

## Restore Steps

### 1. Restore Configuration

```bash
# Copy configuration to deployment directory
cp -r "${BACKUP_ROOT}/.env" .
cp "${BACKUP_ROOT}/docker-compose.prod.yml" .
cp -r "${BACKUP_ROOT}/monitoring" .
cp -r "${BACKUP_ROOT}/database" .
```

### 2. Start Infrastructure

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis
```

Wait for health checks:

```bash
docker compose -f docker-compose.prod.yml ps
# postgres and redis should be healthy
```

### 3. Restore PostgreSQL

```bash
# Restore from dump (see postgresql-restore.md for details)
docker exec -i aisandbox-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < "${BACKUP_FILE}"
```

### 4. Start Application Services

```bash
# Build and start (required on fresh host)
docker compose -f docker-compose.prod.yml up -d --build api-gateway ai-service container-manager frontend
```

### 5. Start Observability

```bash
docker compose -f docker-compose.prod.yml up -d prometheus grafana
```

### 6. Validation

See Post-Restore Validation below.

---

## Post-Restore Validation

| Check | Method |
|-------|--------|
| Database connectivity | `GET /api/health/db` → 200 |
| Full readiness | `GET /api/health/ready` → 200 |
| Runtime metrics | `GET /api/runtime/metrics` |
| Session create | `POST /api/sessions` (smoke) |

```bash
curl -s http://localhost:4000/api/health/db
curl -s http://localhost:4000/api/health/ready
curl -s http://localhost:4000/api/runtime/metrics
```

---

## Rollback / Retry Guidance

- **If step fails:** Fix the failing step; do not proceed with partial state.
- **If PostgreSQL restore fails:** See `postgresql-restore.md` rollback guidance.
- **If config wrong:** Restore config from backup again; verify `INTERNAL_SERVICE_KEY` identical across api-gateway, ai-service, container-manager.

---

## Escalation

- Full rebuild failure: Escalate to platform owner.
- RTO exceeded: Escalate; document blockers.

---

## Post-incident

- Document rebuild duration.
- Note any deviations from procedure.
- Update runbook if new patterns identified.

---

**END OF RUNBOOK**
