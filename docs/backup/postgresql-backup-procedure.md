# Backup Procedure: PostgreSQL

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md  
**Scope:** Operational backup of PostgreSQL database

---

## 1. Purpose

Create a consistent backup of the PostgreSQL database for disaster recovery. The database is the authoritative source for sessions, usage_records, billing, and ledger data.

---

## 2. Operator Prerequisites

| Requirement | Notes |
|-------------|-------|
| Access to host running Docker | Or access to postgres container |
| `pg_dump` available | Via PostgreSQL client tools or inside postgres container |
| Backup destination | Off-host storage; encrypted at rest per policy |
| Sufficient disk space | For dump file (typically 10–50% of DB size for plain format) |

---

## 3. Safety Checks (Pre-Backup)

1. **Verify PostgreSQL is running**
   ```bash
   docker exec aisandbox-postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
   ```

2. **Verify no long-running transactions** (optional)
   ```bash
   docker exec aisandbox-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT pid, state, query_start FROM pg_stat_activity WHERE state != 'idle';"
   ```

3. **Confirm backup destination is writable and has space**

---

## 4. Backup Steps

### Option A: Using Docker exec (recommended for production)

```bash
# Set variables (or source from .env)
POSTGRES_USER=aisandbox
POSTGRES_DB=aisandbox
BACKUP_DIR=/path/to/backup/destination
BACKUP_FILE="aisandbox_$(date +%Y%m%d_%H%M%S).sql"

# Run pg_dump inside postgres container
docker exec aisandbox-postgres pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} --no-owner --no-acl > "${BACKUP_DIR}/${BACKUP_FILE}"
```

### Option B: Using volume mount

If backup destination is mounted into postgres container:

```bash
docker exec aisandbox-postgres pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} --no-owner --no-acl -f /backup/aisandbox_$(date +%Y%m%d_%H%M%S).sql
```

### Format Notes

- **Plain SQL (`.sql`):** Human-readable; restores with `psql`. Recommended for portability.
- **Custom (`.dump`):** Use `pg_dump -Fc` for compressed, parallel-restore capable format. Restores with `pg_restore`.

---

## 5. Verification (Post-Backup)

1. **Verify file exists and has non-zero size**
   ```bash
   ls -la "${BACKUP_DIR}/${BACKUP_FILE}"
   ```

2. **Verify dump integrity** (plain SQL)
   ```bash
   head -20 "${BACKUP_DIR}/${BACKUP_FILE}"
   # Should show PostgreSQL dump header
   ```

3. **Optional: checksum**
   ```bash
   sha256sum "${BACKUP_DIR}/${BACKUP_FILE}" > "${BACKUP_DIR}/${BACKUP_FILE}.sha256"
   ```

---

## 6. Retention

Per PHASE-61A-DESIGN.md: retain per policy (e.g. 30 days daily, 1 year weekly). Store off-host, encrypted.

---

## 7. Rollback / Retry

- **If backup fails:** Check PostgreSQL logs; verify disk space; retry.
- **If partial write:** Delete incomplete file; retry from step 4.

---

**END OF PROCEDURE**
