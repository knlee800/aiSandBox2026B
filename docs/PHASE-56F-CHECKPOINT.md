# PHASE-56F Checkpoint — Fresh-Boot Validation Lock-In

**Task:** TASK-56F  
**Phase:** 56  
**Stage:** 56F

---

## Summary

Lock-in of the now-working fresh-boot production path. Regression validation script and final checkpoint document ensure regressions are caught immediately.

---

## Schema / Init + Migration Strategy

### Init Script Order (database/init/)

| Order | File | Purpose |
|-------|------|---------|
| 001 | `001_schema.sql` | Base schema (users, sessions, conversations, chat_messages, api_keys, billing_snapshots, invoices, usage_records, etc.) |
| 002 | `002_usage_records.sql` | usage_records with created_at |
| 003 | `003_add_demo_user.sql` | Demo user |
| 004 | `004_migrations_oauth_termination.sql` | OAuth + session termination |
| 005 | `005_typeorm_migrations_baseline.sql` | Seed migrations table so TypeORM skips init-covered migrations |
| 006 | `006_api_keys_schema_align.sql` | Idempotent patch for legacy api_keys |
| 100 | `100_usage_records_created_at.sql` | Idempotent backfill usage_records.created_at |
| 101 | `101_users_updated_at.sql` | Idempotent backfill users.updated_at |
| 102 | `102_conversations_chat_messages_align.sql` | Idempotent patch for conversations/chat_messages |

### Migration Strategy

- **Fresh boot:** Postgres runs `database/init/*.sql` in alphabetical order. All tables created by init. TypeORM migrations table seeded in 005; no migrations run at api-gateway startup.
- **Existing DBs:** Idempotent patches (006, 100, 101, 102) align schema. TypeORM migrations may run for DBs where init did not run.

### docker-compose.prod.yml

- Mount: `./database/init:/docker-entrypoint-initdb.d`
- Volumes: `/database` writable for api-gateway, ai-service, container-manager (SQLite legacy paths)

---

## Issues Fixed in 56A–56E

| Stage | Issue | Fix |
|-------|-------|-----|
| **56A** | Docker build determinism | `npm ci` → `npm install` (monorepo root-only lockfile) |
| **56A** | Missing runtime deps (containerized) | api-gateway: accept-language-parser, axios, uuid; ai-service: @nestjs/typeorm, pg, typeorm; container-manager: dotenv |
| **56A** | Production compose wiring | DATABASE_URL, REDIS_URL use postgres/redis hostnames |
| **56A** | SQLite file locations | Mount writable `/database` for api-gateway, ai-service, container-manager |
| **56A** | Prometheus access | Publish 9090:9090 |
| **56A** | Env configuration | env_file: ./.env, AI_PROVIDER pass-through |
| **56B** | node:20-alpine missing on fresh host | container-manager auto-pulls image, retries once on missing-image error |
| **56C** | Init ordering | database/init/ with 001→002→003→004→100 |
| **56C** | usage_records.created_at | 002 creates with created_at; 100 backfills existing DBs |
| **56C** | Broader missing-image detection | isMissingImageError extended for "image not found", "does not exist" |
| **56D** | api_keys schema mismatch | 001 entity schema (hashed_key, scopes, revoked_at); 006 idempotent patch |
| **56D** | billing_snapshots missing | Added to 001; 005 seeds CreateBillingSnapshotsTable |
| **56D** | invoices schema mismatch | 001 entity schema; FK to billing_snapshots |
| **56E** | chat_messages table missing | Added to 001; 102 idempotent patch |
| **56E** | conversations schema mismatch | 001 runtime schema (session_id, messages_count); removed user_id, messages, current_message_number |

---

## Regression Validation

### Command Sequence (Wiped Docker Boot)

```powershell
# 1. Wipe and boot
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d --build

# 2. Wait for api-gateway healthy
# (healthcheck: GET /api/health → 200)

# 3. Run validation script
.\scripts\phase-56-fresh-boot-validation.ps1 -BaseUrl "http://localhost:4000"
```

### Validation Script

`scripts/phase-56-fresh-boot-validation.ps1` exercises:

1. Register (POST /api/auth/register)
2. Login (POST /api/auth/login)
3. Create API key (POST /api/keys)
4. Create session (POST /api/sessions)
5. Add first chat message + real AI execute (POST /api/ai/execute)

Pass criteria: All steps succeed; execution completes (status completed or queued→completed).

---

## Files Changed

| File | Change |
|------|--------|
| `docs/PHASE-56F-CHECKPOINT.md` | This file |
| `scripts/phase-56-fresh-boot-validation.ps1` | New regression validation script |

---

## Invariants

- No runtime behavior changes
- No schema changes
- No refactors
- Current fresh-boot success is release-critical baseline
