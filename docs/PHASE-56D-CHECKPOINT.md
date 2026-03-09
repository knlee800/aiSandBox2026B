# PHASE-56D Checkpoint — Fresh-Boot Schema Parity Hardening

**Task:** TASK-56D  
**Phase:** 56  
**Stage:** 56D

---

## Summary

Fresh-boot schema parity: init SQL aligned with runtime entities for `users`, `api_keys`, `usage_records`, `billing_snapshots`, `invoices`. No TypeORM synchronize, no manual DB ALTERs after boot.

---

## Root Cause Summary

| Gap | Root Cause |
|-----|------------|
| `usage_records.created_at` | 002 already had it; 100 backfills for existing DBs |
| `users.updated_at` | 001 already had it; 101 backfills for existing DBs |
| `api_keys` schema | 001 used legacy schema (key_hash, name, rate_limit_per_hour, is_active) instead of entity (hashed_key, scopes, revoked_at) |
| `api_keys.scopes` malformed array | Column was absent or wrong type; entity expects JSONB `'[]'` |
| `billing_snapshots` missing | Never in init; only created by migration at startup |
| `invoices` schema | 001 used legacy schema (id, user_id, stripe_invoice_id) instead of entity (invoice_id, snapshot_id, api_key_id, period_*) |
| Baseline migrations rerun | CreateBillingSnapshotsTable not seeded; ran against init-created tables |

---

## A) Init Schema Fixes (001_schema.sql)

- **api_keys**: Replaced with entity schema: `hashed_key`, `key_prefix`, `user_id`, `scopes` JSONB DEFAULT `'[]'`, `created_at`, `revoked_at`
- **billing_snapshots**: Added table + indexes (idx_billing_snapshots_*)
- **invoices**: Replaced with entity schema; FK to `billing_snapshots.snapshot_id`
- **DROP order**: Added `billing_snapshots` before `invoices` (FK dependency)

---

## B) Migration Baseline (005_typeorm_migrations_baseline.sql)

- Seeded `CreateBillingSnapshotsTable1738843300000` so TypeORM skips it (init creates table)
- All billing/usage/invoice tables now created by init; no migrations run at api-gateway startup

---

## C) Idempotent Patch (006_api_keys_schema_align.sql)

- Existing DBs with old `api_keys` (key_hash): add `hashed_key` (copy from key_hash), `scopes` JSONB, `revoked_at`
- Fresh boot: no-op (schema already correct)

---

## Files Changed

| File | Change |
|------|--------|
| `database/init/001_schema.sql` | api_keys, billing_snapshots, invoices schema parity |
| `database/init/005_typeorm_migrations_baseline.sql` | Seed CreateBillingSnapshotsTable |
| `database/init/006_api_keys_schema_align.sql` | New idempotent patch |
| `docs/PHASE-56D-CHECKPOINT.md` | This file |

---

## Validation

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build
# api-gateway healthy, no restart loop
# register → login → create API key → create session → add chat message → xAI execute
```
