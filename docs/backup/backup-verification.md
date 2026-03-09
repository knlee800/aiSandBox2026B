# Backup Verification & Integrity Checks

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md  
**Scope:** Verification and integrity checks for backups

---

## 1. Purpose

Ensure backups are valid and restorable before they are needed for recovery.

---

## 2. PostgreSQL Dump Verification

### Before Restore (Integrity Check)

1. **File exists and non-zero**
   ```bash
   test -s "${BACKUP_FILE}" && echo "OK" || echo "FAIL"
   ```

2. **Validate dump structure** (plain SQL)
   ```bash
   head -5 "${BACKUP_FILE}"
   # Expect: -- PostgreSQL database dump
   ```

3. **Validate custom format** (if using `-Fc`)
   ```bash
   pg_restore --list "${BACKUP_FILE}" > /dev/null && echo "OK" || echo "CORRUPT"
   ```

### Checksum Verification

```bash
# At backup time
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

# At restore time (before restore)
sha256sum -c "${BACKUP_FILE}.sha256"
```

---

## 3. Configuration Backup Verification

1. **All required files present**
   - `.env`
   - `docker-compose.prod.yml`
   - `monitoring/prometheus/` (prometheus.yml, alerts)
   - `monitoring/grafana/` (provisioning, dashboards)
   - `database/`, `database/init/`

2. **`.env` is non-empty and contains expected variables**
   - Do not print values; check variable names exist (e.g. `DATABASE_URL`, `JWT_SECRET`).

---

## 4. Pre-Restore Safety Checklist

Before running any restore:

- [ ] Backup file checksum verified (if available)
- [ ] Backup is from intended point-in-time
- [ ] Application services stopped (for PostgreSQL restore)
- [ ] Operator has required tools (pg_restore or psql)
- [ ] Restore destination has sufficient space

---

## 5. Post-Backup Verification (Optional Restore Test)

Per PHASE-61A: Monthly restore test recommended. Use staging or isolated environment:

1. Restore PostgreSQL to test instance
2. Verify schema and row counts
3. Start application; run smoke test
4. Document result

---

**END OF DOCUMENT**
