# Operator Prerequisites & Safety Checks

**Phase:** 61B  
**Reference:** PHASE-61A-DESIGN.md  
**Scope:** Prerequisites, dependencies, and safety checks for backup and restore operations

---

## 1. Tools Required

| Tool | Purpose | Where |
|------|---------|-------|
| `pg_dump` | PostgreSQL backup | Inside postgres container or host |
| `psql` | Restore plain SQL dumps | Inside postgres container or host |
| `pg_restore` | Restore custom format dumps | Inside postgres container or host |
| `docker` | Container access | Host |
| `sha256sum` | Integrity verification | Host (or equivalent) |

---

## 2. Access Requirements

| Requirement | Notes |
|-------------|-------|
| Docker host access | To exec into postgres container |
| PostgreSQL credentials | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from `.env` |
| Backup destination | Writable, off-host, encrypted |
| Deployment directory | For configuration backup |

---

## 3. Pre-Backup Safety Checks

- [ ] PostgreSQL is running and healthy
- [ ] No maintenance or migration in progress
- [ ] Backup destination has sufficient space
- [ ] Backup destination is off-host (not only on production node)

---

## 4. Pre-Restore Safety Checks

- [ ] Backup file integrity verified (checksum if available)
- [ ] Application services stopped (for database restore)
- [ ] Restore destination is correct (new volume or clean DB)
- [ ] No conflicting processes using database

---

## 5. Dependencies

- **PostgreSQL backup:** Requires postgres container running
- **Configuration backup:** Requires deployment directory accessible
- **Restore:** Requires postgres container (can be empty/fresh)

---

## 6. Escalation

- **Backup failure:** Retry; check logs; escalate if persistent
- **Restore failure:** Do not leave DB in partial state; stop services; escalate
- **Data loss suspected:** Escalate to platform owner immediately

---

**END OF DOCUMENT**
