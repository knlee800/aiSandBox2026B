# AGENT-PLATFORM-EXEC-01C-SCHEMA-01 — Base `api_keys` table prerequisite

**Task ID:** AGENT-PLATFORM-EXEC-01C-SCHEMA-01
**Title:** Additive create-table migration for missing `public.api_keys`
**Step:** Design freeze + source implementation (this document) — LOCK not authorized
**Date:** 2026-09-08
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — schema/migration
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable
**Base HEAD:** `b7a689c0157d5fa420d63142025dab8c2d09f7f0`
**Preserved dirty tree at window open:** `TASKS.md`, `TASKS_BACKLOG_FULL.md` (IDENTITY-01 bounded staging migration STOPPED preflight). Those edits are preserved.

IDENTITY-01 seven-file implementation is not modified by this task.

---

## 1. Problem

Authorized Lightsail preflight for IDENTITY-01 found:

| Live fact | Value |
|---|---|
| Database | `aisandbox` |
| `public.api_keys` | **absent** |
| Applied migrations | 29 |
| Latest applied | `AddAdminGrantAuditColumns1772900000000` |
| Pending (then) | solely `AddInternalAccessToApiKeys1773000000000` |
| Snapshot | not created (`aws` CLI unavailable) |
| Apply | **not executed** |
| Live checkout | `/opt/aisandbox` remained `b6b94516aff9981101ae8815aec2e2d36b8b231b` dirty=0 |

IDENTITY-01's migration is `ALTER TABLE "api_keys" ADD COLUMN ...`. It cannot create the missing table.

The historical create-table migration

`services/api-gateway/migrations/1770889928593-1770461400000-AddApiKeysTable.ts`

is **outside** active discovery (`data-source.ts` uses `src/migrations/*.{ts,js}` only). It also references `users(user_id)`, which does not match the current User entity primary key mapping (`users.id`). This task does **not** move that file, execute it, or expand discovery to historical migrations.

---

## 2. Repository conclusions vs live facts

### 2.1 Repository conclusions (inspected this window)

| Item | Evidence |
|---|---|
| Users PK column | `User` entity `@PrimaryGeneratedColumn('uuid')` maps to `id`. Active `InitSchema20260123` creates `"users"."id" uuid PRIMARY KEY`. Later owned-child FKs use `"users"("id")` (sessions, user_agents, projects). |
| Historical `users(user_id)` | Only in inactive `services/api-gateway/migrations/` (InitialSchema / AddApiKeysTable). Stale. Do not use. |
| API-key columns | Entity + historical create + `ApiKeyService` create/list/validate/revoke: `id`, `hashed_key` varchar(255) NOT NULL, `key_prefix` varchar(20) NOT NULL, `user_id` uuid NOT NULL, `scopes` jsonb NOT NULL default `[]`, `created_at` timestamp NOT NULL default `now()`, `revoked_at` timestamp NULL. |
| Indexes | Entity `@Index('idx_api_key_hashed')` on `hashed_key`; `@Index('idx_api_key_user_id')` on `user_id`. Historical create used the same names. |
| `is_internal` | IDENTITY-01 entity/migration already authored. **Not** part of this base table. |
| Deletion | Historical api_keys FK used `ON DELETE CASCADE`. Sibling owned-child tables and `UserAgent` use `ON DELETE CASCADE`. `ApiKey` entity omits `onDelete` (TypeORM metadata gap). This task does not edit the entity. SQL FK uses `ON DELETE CASCADE` to match schema history and sibling owned-child tables. |
| Discovery | `data-source.ts` `migrations: [__dirname + '/src/migrations/*.{ts,js}']`. `synchronize: false` in `data-source.ts` and `database.config.ts`. |
| Consumers | `createApiKey` writes hashed key, prefix, userId, scopes, `revokedAt: null`. `validateApiKey` loads `revokedAt: null` rows. `listApiKeys` filters by `userId`. No consumer inserts users, privileges, or credit rows via this table. |

### 2.2 Live facts still unverified (mandatory later apply preflight)

| Fact | Status |
|---|---|
| Staging `users` primary key is actually `id` | UNVERIFIED |
| Staging `users` referenced constraints match `"users"("id")` | UNVERIFIED |
| Current applied/pending set after this revision is delivered | UNVERIFIED |
| No unexpected extra pending migrations | UNVERIFIED |
| No incompatible `api_keys` relation already present under another schema/name | UNVERIFIED |

Repository conclusions do **not** replace that preflight.

---

## 3. Frozen write set

| # | File | Role |
|---|---|---|
| 1 | `services/api-gateway/src/migrations/1772950000000-CreateApiKeysTable.ts` | Additive create-table migration |
| 2 | `services/api-gateway/src/migrations/__tests__/1772950000000-CreateApiKeysTable.spec.ts` | Focused mocked SQL-shape tests |

Control-plane / evidence (not IDENTITY-01 files; not application auth behavior):

- `docs/AGENT-PLATFORM-EXEC-01C-SCHEMA-01-DESIGN.md` (this file)
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`

**Not modified:** IDENTITY-01's seven implementation files, historical `services/api-gateway/migrations/**`, `data-source.ts` discovery glob, auth/entitlement/credit code, user rows, privileges.

---

## 4. Frozen schema

Timestamp: `1772950000000` — unique in `src/migrations/`; after `1772900000000`; before `1773000000000`.

Class: `CreateApiKeysTable1772950000000`.

Table `public.api_keys`:

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid PK | NO | `gen_random_uuid()` |
| `hashed_key` | varchar(255) | NO | none |
| `key_prefix` | varchar(20) | NO | none |
| `user_id` | uuid | NO | none |
| `scopes` | jsonb | NO | `'[]'::jsonb` |
| `created_at` | TIMESTAMP | NO | `now()` |
| `revoked_at` | TIMESTAMP | YES | NULL |

Constraints / indexes:

- PK on `id`
- `CONSTRAINT "fk_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`
- `idx_api_key_hashed` on `hashed_key`
- `idx_api_key_user_id` on `user_id`

Explicitly **absent:** `is_internal` (IDENTITY-01), user/API-key/privilege/credit inserts, grants, backfill, automatic promotion.

---

## 5. Existing-table and rollback behavior

### 5.1 Existing table

`up()` queries `information_schema.tables` for `public.api_keys`. If present, it throws

`AGENT-PLATFORM-EXEC-01C-SCHEMA-01: public.api_keys already exists.`

with inspection SQL. It does **not** run `CREATE TABLE`. It does **not** use `IF NOT EXISTS`. Silent adoption of an unknown table is forbidden.

### 5.2 Rollback ordering

TypeORM reverts only the last applied migration.

| Applied tip | Revert effect |
|---|---|
| SCHEMA-01 only | `CreateApiKeysTable1772950000000.down()` |
| SCHEMA-01 then IDENTITY-01 | Revert IDENTITY-01 first (`DROP COLUMN is_internal`), then a second revert for SCHEMA-01 |

Application-code rollback remains IDENTITY-01's contract: revert IDENTITY-01 entity mapping **before** dropping `is_internal`. SCHEMA-01 table drop is a later schema emergency, not a privilege tool.

### 5.3 Data-loss

Dropping a populated `api_keys` table destroys all API keys. That is **not** harmless.

`down()`:

1. `SELECT COUNT(*)` from `api_keys`
2. If `row_count > 0`, throw and do not DROP
3. If empty, `DROP INDEX` then `DROP TABLE "api_keys"` **without** `IF EXISTS`

Because `up()` never adopts an existing table, `down()` cannot drop a pre-existing table that `up()` silently accepted. `DROP TABLE IF EXISTS` is forbidden here.

Restore path for a populated table: pre-apply snapshot, not this `down()`.

---

## 6. Lane / mutex handoff (frozen)

IDENTITY-01 occupied Lane 1 and owned GATEWAY + MIGRATION. SCHEMA-01 needs the same mutexes. Simultaneous ownership is forbidden.

Documented pause/handoff (GOV-OS-03 lane release / RETURN-TO-READY producing EMPTY, then admission):

1. GOVERNANCE acquired transiently
2. IDENTITY-01 lane released EMPTY; GATEWAY + MIGRATION released
3. IDENTITY-01 candidate `status=READY` (not LANE-DONE, not LOCKED); machine `dependsOn` includes SCHEMA-01 (unmet until SCHEMA-01 LOCKED)
4. SCHEMA-01 registered, write set frozen EXACT, admitted to Lane 1, GATEWAY + MIGRATION acquired
5. GOVERNANCE released UNOWNED

Acyclic graph:

- SCHEMA-01 `dependsOn`: `["GOV-AUTH-03"]` (LOCKED). Does **not** depend on IDENTITY-01.
- IDENTITY-01 `dependsOn`: `["GOV-AUTH-03", "AGENT-PLATFORM-EXEC-01C-SCHEMA-01"]`
- EXEC-01C6A `dependsOn` still includes IDENTITY-01 (must be COMPLETE AND LOCKED)

IDENTITY-01 isolated Lightsail evidence (197 passed / tsc PASS, source SHA `ad6bf88b452080bda6185a852af29d950e0f5918`) is preserved and not re-run unless a concrete IDENTITY-01 source change requires it. This task does not change those seven files.

---

## 7. Later Lightsail validation (not authorized here)

No AWS, package install, application build, database connection, migration execution, snapshot, deployment, restart, environment change, privilege operation, or provider call is authorized in the source window.

The previous approval to apply **only** IDENTITY-01 does **not** authorize this new migration or a two-migration batch. Separate STAGING + migration-execution authorization is required for each apply.

### 7.1 Isolated revision delivery and focused tests

1. Deliver this revision to Lightsail via an authorized isolated procedure (do not activate IDENTITY-01 entity mapping against a database that still lacks `api_keys` / `is_internal`).
2. Focused mocked tests only:

```bash
npx jest --runTestsByPath src/migrations/__tests__/1772950000000-CreateApiKeysTable.spec.ts
npx tsc --noEmit --incremental false
```

Do **not** repeat the 197 IDENTITY-01 tests unless IDENTITY-01 source changes. Mocked tests do **not** prove PostgreSQL behavior.

### 7.2 Apply preflight (mandatory before any SCHEMA-01 apply)

1. Pre-apply Lightsail snapshot (mandatory). Snapshot CLI must be available.
2. Confirm staging `users` PK and that `"users"("id")` is the referenced constraint.
3. Confirm `public.api_keys` is still absent. If present, STOP — do not apply; inspect.
4. `npx typeorm migration:show -d dist/data-source.js` (or equivalent compiled show).
5. Expected pending set after this revision is delivered, and **before** any apply:

   - `[ ] CreateApiKeysTable1772950000000`
   - `[ ] AddInternalAccessToApiKeys1773000000000`

   If any other pending migration appears, STOP and assess separately.
6. Apply **only** SCHEMA-01 if that is the authorized set. Do not silently run IDENTITY-01 in the same batch unless Keith authorizes a two-migration batch separately.

Staging runner (frozen from IDENTITY-01 stage-start; still correct):

| Operation | Command |
|---|---|
| Show | `DATABASE_URL=<url> npx typeorm migration:show -d dist/data-source.js` |
| Apply | `DATABASE_URL=<url> npm run migration:run:prod` |
| Revert | `DATABASE_URL=<url> npx typeorm migration:revert -d dist/data-source.js` |

Requires current `dist/` including this new compiled migration. `migration:revert:prod` still does not exist as an npm script.

### 7.3 PostgreSQL verification after SCHEMA-01 apply (before IDENTITY-01 apply)

Verify table, columns, nullability, defaults, PK, FK `"users"("id") ON DELETE CASCADE`, indexes `idx_api_key_hashed` / `idx_api_key_user_id`, and **no** `is_internal` yet.

Existing-table conflict: on a clone/snapshot copy only, create a decoy `api_keys` and confirm `up()` fails with the SCHEMA-01 diagnostic and does not adopt the decoy.

### 7.4 Old application compatibility

1. After SCHEMA-01 only: old application **without** `isInternal` entity mapping continues DB-key create/list/validate (TypeORM selects mapped columns only). IDENTITY-01 application code must **not** be deployed yet (`is_internal` still missing).
2. After a later authorized IDENTITY-01 migration: old application still ignores unmapped `is_internal`. Then IDENTITY-01 application code may be deployed.

### 7.5 Rollback requirements

- Snapshot before apply.
- Populated-table `down()` must fail closed.
- Empty-table `down()` drops only this table.
- If IDENTITY-01 column was also applied, revert IDENTITY-01 first.

---

## 8. Authorization boundary

```
IMPLEMENTATION_AUTHORIZED=YES (source + registration + handoff in this window)
STAGING_AUTHORIZED=NO
MIGRATION_EXECUTION_AUTHORIZED=NO
PRIVILEGE_GRANT_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
APPLICATION_TESTS_EXECUTED=NO
IDENTITY_01_LOCKED=NO
EXEC_01C6A_UNBLOCKED=NO
```

Source completion is not runtime validation, LANE-DONE, or LOCKED.
