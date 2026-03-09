# Backup Procedure: Configuration & Secrets

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md  
**Scope:** Operational backup of configuration and secrets

---

## 1. Purpose

Back up configuration files and secrets required to restore or rebuild the platform. These include `.env`, `docker-compose.prod.yml`, and monitoring configuration.

---

## 2. Operator Prerequisites

| Requirement | Notes |
|-------------|-------|
| Access to deployment directory | Repository root or deployment path |
| Backup destination | Off-host storage; encrypted at rest |
| Read access to `.env` | Contains secrets; restrict backup access |

---

## 3. Safety Checks (Pre-Backup)

1. **Verify `.env` exists** (do not print contents)
   ```bash
   test -f .env && echo "OK" || echo "MISSING"
   ```

2. **Verify backup destination is writable**

3. **Ensure backup is stored off-host** — Do not store only on same node as production.

---

## 4. Backup Steps

### Files to Back Up

| File/Directory | Purpose |
|----------------|---------|
| `.env` | Secrets, connection strings, feature flags |
| `docker-compose.prod.yml` | Service definitions, volumes, networks |
| `monitoring/prometheus/` | Alert rules, scrape config |
| `monitoring/grafana/` | Dashboards, provisioning |
| `database/` | Schema, migrations |
| `database/init/` | Init scripts |

### Procedure

```bash
BACKUP_DIR=/path/to/backup/destination
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="${BACKUP_DIR}/config_${BACKUP_DATE}"
mkdir -p "${BACKUP_ROOT}"

# Copy configuration (from repository root)
cp .env "${BACKUP_ROOT}/"
cp docker-compose.prod.yml "${BACKUP_ROOT}/"
cp -r monitoring "${BACKUP_ROOT}/"
cp -r database "${BACKUP_ROOT}/"
```

---

## 5. Verification (Post-Backup)

1. **Verify all files present**
   ```bash
   ls -la "${BACKUP_ROOT}"
   ls -la "${BACKUP_ROOT}/.env"
   ```

2. **Optional: checksum**
   ```bash
   find "${BACKUP_ROOT}" -type f -exec sha256sum {} \; > "${BACKUP_ROOT}.manifest"
   ```

---

## 6. Security Notes

- `.env` contains secrets. Restrict backup access to operators only.
- Store backups encrypted at rest.
- Do not commit backups to version control.

---

## 7. Rollback / Retry

- **If copy fails:** Check permissions; verify source files exist; retry.
- **If `.env` missing:** Do not proceed; locate or recreate from secure store.

---

**END OF PROCEDURE**
