# PHASE-56C Checkpoint — Fresh Boot Production Hardening

**Task:** TASK-56C  
**Phase:** 56  
**Stage:** 56C

---

## Summary

Fresh boot production hardening: database init ordering fixed, `usage_records.created_at` reproducible, container-manager auto-pulls `node:20-alpine`, runbook updated.

---

## A) Database Init Ordering

- Created `database/init/` with ordered scripts (alphabetical = execution order):
  - `001_schema.sql` — base schema
  - `002_usage_records.sql` — creates `usage_records` with `created_at`
  - `003_add_demo_user.sql` — demo user
  - `004_migrations_oauth_termination.sql` — OAuth + session termination
  - `100_usage_records_created_at.sql` — idempotent migration (backfill for existing DBs)
- `docker-compose.prod.yml`: mount `./database/init:/docker-entrypoint-initdb.d`

## B) Schema Reproducibility

- `usage_records.created_at`: column exists, `DEFAULT now()`, `NOT NULL`
- Fresh init: `002_usage_records.sql` creates table with `created_at`
- Existing DBs: `100_usage_records_created_at.sql` backfills from `timestamp`

## C) node:20-alpine Auto-Pull

- TASK-56B already implemented: on missing image, pull and retry once
- TASK-56C: extended `isMissingImageError` with `image not found`, `does not exist`

## D) Documentation

- `docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md`: §3.3 Fresh Boot assumptions

---

## Files Changed

| File | Change |
|------|--------|
| `database/init/001_schema.sql` | New (from schema.sql) |
| `database/init/002_usage_records.sql` | New |
| `database/init/003_add_demo_user.sql` | New |
| `database/init/004_migrations_oauth_termination.sql` | New |
| `database/init/100_usage_records_created_at.sql` | New |
| `docker-compose.prod.yml` | Init mount → database/init |
| `services/container-manager/.../docker-runtime.service.ts` | Broader missing-image detection |
| `docs/PRODUCTION-DEPLOYMENT-RUNBOOK.md` | Fresh boot §3.3 |
| `docs/PHASE-56C-CHECKPOINT.md` | This file |

---

## Validation

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
# Verify usage_records.created_at exists
# Create session, execute one xAI request (no manual pull/DB patch)
```
