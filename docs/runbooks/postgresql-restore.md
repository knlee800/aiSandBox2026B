# Runbook: PostgreSQL Restore from Backup

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md Section 6  
**Scenario:** Database loss (corruption, accidental deletion, volume loss)

---

## Title

PostgreSQL Restore from Dump

---

## Prerequisites

| Item | Notes |
|------|-------|
| Backup file | Plain `.sql` or custom `.dump` from pg_dump |
| Backup location | Path to backup file |
| PostgreSQL credentials | From `.env`: POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB |
| Tools | `psql` (plain) or `pg_restore` (custom format) |

---

## Verification (Before Restore)

1. **Verify backup file integrity**
   ```bash
   test -s "${BACKUP_FILE}" && echo "OK" || echo "FAIL"
   sha256sum -c "${BACKUP_FILE}.sha256"  # if checksum exists
   ```

2. **Validate dump** (custom format only)
   ```bash
   docker exec aisandbox-postgres pg_restore --list "${BACKUP_FILE}" > /dev/null
   ```

3. **Stop application services**
   ```bash
   docker compose -f docker-compose.prod.yml stop api-gateway ai-service container-manager frontend
   ```

---

## Restore Steps

### For Plain SQL Dump

```bash
# Copy backup into container if needed, or use stdin
docker exec -i aisandbox-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < "${BACKUP_FILE}"
```

Or if backup is in container:

```bash
docker exec aisandbox-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -f /path/in/container/backup.sql
```

### For Custom Format Dump (-Fc)

```bash
docker exec -i aisandbox-postgres pg_restore -U ${POSTGRES_USER} -d ${POSTGRES_DB} --clean --if-exists < "${BACKUP_FILE}"
```

**Note:** `--clean --if-exists` drops objects before restore. For fresh DB, omit if preferred.

---

## Post-Restore Validation

1. **Restart application services**
   ```bash
   docker compose -f docker-compose.prod.yml start api-gateway ai-service container-manager frontend
   ```

2. **Database connectivity**
   ```bash
   curl -s http://localhost:4000/api/health/db
   # Expect: 200
   ```

3. **Full readiness**
   ```bash
   curl -s http://localhost:4000/api/health/ready
   # Expect: 200
   ```

4. **Smoke test**
   - Create session: `POST /api/sessions`
   - Execute: `POST /api/sessions/:id/exec`
   - Terminate: `DELETE /api/sessions/:id`

---

## Rollback / Retry Guidance

- **If restore fails mid-way:** Stop services. Do not leave DB in partial state. Retry with same or earlier backup.
- **If corruption suspected:** Use earlier backup.
- **If schema mismatch:** Ensure backup matches current schema version; run migrations if needed after restore.

---

## Escalation

- Restore failure: Escalate to platform owner if unresolved in 30 minutes.
- Data loss confirmed: Escalate immediately.

---

## Post-incident

- Document restore point used (backup timestamp).
- Note duration of outage.
- Update runbook if new patterns identified.

---

**END OF RUNBOOK**
