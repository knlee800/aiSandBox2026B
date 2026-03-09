# Validation Drill: Backup Integrity Verification

**Phase:** 62B  
**Reference:** PHASE-62A-DESIGN.md Section 3.5  
**Procedure:** docs/backup/backup-verification.md  
**Frequency:** Monthly minimum

---

## Objective

Prove that backups are valid and restorable without performing full restore. Lightweight verification that catches corrupt backups early.

---

## Environment Restrictions

| Environment | Allowed |
|-------------|---------|
| Staging | Yes |
| Isolated test | Yes |
| Production (read-only verification) | Yes — can verify production backup copies |

**Note:** No restore required. Read-only verification of backup files.

---

## Prerequisites

| Item | Notes |
|------|-------|
| Recent backup(s) | PostgreSQL dump, configuration backup |
| Phase 61 backup verification | docs/backup/backup-verification.md |
| Tools | sha256sum, pg_restore (for --list), head |
| Operator access | Path to backup files |

---

## Safety Checks (Before Drill)

- [ ] Confirm backup file path is correct
- [ ] No restore will be performed (read-only)
- [ ] Operator has required tools

---

## Execution Steps

1. **Select recent backup(s)** — PostgreSQL, config
2. **PostgreSQL verification**
   - File exists and non-zero: `test -s "${BACKUP_FILE}" && echo "OK"`
   - Checksum (if available): `sha256sum -c "${BACKUP_FILE}.sha256"`
   - Dump structure (plain SQL): `head -5 "${BACKUP_FILE}"` — expect PostgreSQL dump header
   - Custom format: `pg_restore --list "${BACKUP_FILE}" > /dev/null && echo "OK"`
3. **Configuration verification**
   - All required files present: `.env`, docker-compose.prod.yml, monitoring/, database/
   - `.env` non-empty; expected variable names exist
4. **Document result** — pass/fail, checksum output
5. **Record pass/fail**

---

## Evidence to Capture

| Artifact | Required |
|----------|----------|
| Drill log (date, operator, backup path, result) | Yes |
| Pass/fail result | Yes |
| Checksum verification output | Yes |

**Retention:** 12 months minimum.

---

## Pass/Fail Criteria

| Result | Condition |
|--------|-----------|
| **Pass** | Checksum valid; pg_restore --list succeeds (PostgreSQL); config files present and non-empty |
| **Fail** | Checksum mismatch; dump corrupt; config missing |

---

## Abort / Rollback Conditions

| Condition | Action |
|-----------|--------|
| Backup file not found | Abort; document; verify backup procedure |
| Checksum mismatch | Document; do not use backup for restore; escalate |
| Operator uncertainty | Abort; escalate; document |

---

## Post-Drill Cleanup

None (read-only drill).

---

## Signoff Record Requirements

- Drill operator: Name, date, pass/fail
- Ops lead / SRE: Review evidence; sign off
- Retention: 12 months

---

**END OF DRILL RUNBOOK**
