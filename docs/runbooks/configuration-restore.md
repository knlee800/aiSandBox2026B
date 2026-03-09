# Runbook: Configuration & Secrets Restore

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md Section 4.5  
**Scenario:** Configuration/secrets loss (`.env` corrupted, accidental overwrite)

---

## Title

Configuration & Secrets Restore

---

## Prerequisites

| Item | Notes |
|------|-------|
| Configuration backup | From backup procedure (`.env`, compose, monitoring) |
| Backup location | Path to backup files |
| Deployment directory | Repository root |

---

## Verification (Before Restore)

1. **Backup files present**
   ```bash
   test -f "${BACKUP_ROOT}/.env" && echo "OK"
   test -f "${BACKUP_ROOT}/docker-compose.prod.yml" && echo "OK"
   ```

2. **Verify backup is from intended point-in-time**

3. **If secrets exposure suspected:** Plan to rotate secrets after restore.

---

## Restore Steps

### 1. Stop Application Services

```bash
docker compose -f docker-compose.prod.yml stop api-gateway ai-service container-manager frontend
```

### 2. Restore Configuration Files

```bash
cp "${BACKUP_ROOT}/.env" .
cp "${BACKUP_ROOT}/docker-compose.prod.yml" .
cp -r "${BACKUP_ROOT}/monitoring" .
cp -r "${BACKUP_ROOT}/database" .
```

### 3. Verify INTERNAL_SERVICE_KEY Consistency

All services (api-gateway, ai-service, container-manager) must use the same `INTERNAL_SERVICE_KEY`. Ensure `.env` has it set; it is passed via `env_file`.

### 4. Restart Application Services

```bash
docker compose -f docker-compose.prod.yml start api-gateway ai-service container-manager frontend
```

### 5. Restart Observability (if monitoring config changed)

```bash
docker compose -f docker-compose.prod.yml restart prometheus grafana
```

---

## Post-Restore Validation

1. **Health checks**
   ```bash
   curl -s http://localhost:4000/api/health
   curl -s http://localhost:4000/api/health/ready
   curl -s http://localhost:4000/api/health/db
   ```

2. **Internal service auth**
   - Verify container-manager can call api-gateway internal endpoints (session start/stop)

3. **Smoke test**
   - Create session, execute, terminate

---

## Rollback / Retry Guidance

- **If restore fails:** Revert to previous config; restart services.
- **If INTERNAL_SERVICE_KEY mismatch:** Update `.env` so all services use same value; restart all three (api-gateway, ai-service, container-manager).
- **If secrets rotated:** Update `.env` with new values; restart all services.

---

## Escalation

- Config restore failure: Escalate if unresolved in 30 minutes.
- Secrets exposure suspected: Rotate immediately; escalate if needed.

---

## Post-incident

- Document what was restored.
- If secrets rotated, document rotation.
- Update runbook if new patterns identified.

---

**END OF RUNBOOK**
