# AGENT-PLATFORM-EXEC-01C-SCHEMA-01 — Base `api_keys` table prerequisite

**Task ID:** AGENT-PLATFORM-EXEC-01C-SCHEMA-01
**Title:** Additive create-table migration for missing `public.api_keys`
**Step:** Design freeze + source implementation (this document) — LOCK not authorized
**Date:** 2026-09-08
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — schema/migration
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable
**Base HEAD (registration/source window):** `b7a689c0157d5fa420d63142025dab8c2d09f7f0`
**Correction baseline (rollback atomicity / schema targeting / apply-procedure):** `4081b01b73f4f6a9c59f8e4495cf6c83423a26c4`
**Preserved dirty tree at original window open:** `TASKS.md`, `TASKS_BACKLOG_FULL.md` (IDENTITY-01 bounded staging migration STOPPED preflight). Those edits are preserved.

IDENTITY-01 seven-file implementation is not modified by this task. This correction window does not implement a deployment runner and does not change IDENTITY-01.

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
- `CONSTRAINT "fk_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE`
- `CREATE INDEX "idx_api_key_hashed" ON "public"."api_keys" ("hashed_key")` (index lives in the table's schema; PostgreSQL does not accept a schema-qualified index name on `CREATE INDEX`)
- `CREATE INDEX "idx_api_key_user_id" ON "public"."api_keys" ("user_id")`

DDL targeting: `CREATE TABLE`, `REFERENCES`, `COUNT`, `LOCK TABLE`, and `DROP TABLE` use `"public"."api_keys"` / `"public"."users"`. Index drops use `"public"."idx_api_key_hashed"` and `"public"."idx_api_key_user_id"`.

Explicitly **absent:** `is_internal` (IDENTITY-01), user/API-key/privilege/credit inserts, grants, backfill, automatic promotion.

---

## 5. Existing-table and rollback behavior

### 5.1 Existing table

`up()` queries `information_schema.tables` for `public.api_keys`. If present, it throws

`AGENT-PLATFORM-EXEC-01C-SCHEMA-01: public.api_keys already exists.`

with inspection SQL. It does **not** run `CREATE TABLE`. It does **not** use `CREATE TABLE IF NOT EXISTS`. Silent adoption of an unknown table is forbidden.

Omitting `IF EXISTS` / `IF NOT EXISTS` does **not** prove this migration created or owns the relation. Provenance is TypeORM migration history (`migrations` table) plus this `up()` refusal to adopt a pre-existing table. A missing table on `DROP` fails loudly; that is fail-closed behavior, not ownership proof.

### 5.2 Rollback ordering

TypeORM reverts only the last applied migration.

| Applied tip | Revert effect |
|---|---|
| SCHEMA-01 only | `CreateApiKeysTable1772950000000.down()` |
| SCHEMA-01 then IDENTITY-01 | Revert IDENTITY-01 first (`DROP COLUMN is_internal`), then a second revert for SCHEMA-01 |

Application-code rollback remains IDENTITY-01's contract: revert IDENTITY-01 entity mapping **before** dropping `is_internal`. SCHEMA-01 table drop is a later schema emergency, not a privilege tool.

### 5.3 Data-loss

Dropping a populated `api_keys` table destroys all API keys. That is **not** harmless.

`down()` (all SQL in the **existing** QueryRunner transaction; this class does not start, commit, or roll back that transaction):

1. Require `queryRunner.isTransactionActive === true`. If not, throw and execute **no** rollback SQL.
2. `LOCK TABLE "public"."api_keys" IN ACCESS EXCLUSIVE MODE NOWAIT` (must precede emptiness check; lock is retained through DROP for the rest of this transaction). Lock failure must not proceed to COUNT or DROP. Rollback must not wait indefinitely for the lock.
3. `SELECT COUNT(*)::int AS "row_count" FROM "public"."api_keys"`. Empty-table is only an explicit integer `0` or canonical digit string `"0"`. `null`, `''`, booleans, missing `row_count`, empty result sets, and malformed values are **not** zero. Do not coerce them with `Number()`.
4. If `row_count > 0`, throw and do not DROP.
5. If empty, `DROP INDEX "public"."idx_api_key_user_id"`, `DROP INDEX "public"."idx_api_key_hashed"`, then `DROP TABLE "public"."api_keys"` **without** `IF EXISTS`.

`DROP TABLE IF EXISTS` remains forbidden. Missing-table DROP fails loudly. That is not proof of table ownership.

Restore path for a populated table: verified pre-apply Lightsail snapshot, not this `down()`.

Mocked tests cover SQL order and fail-closed parsing. They do **not** prove live PostgreSQL locking or concurrent-insert behavior. That remains a later Lightsail PostgreSQL validation requirement.

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

Do **not** repeat the 197 IDENTITY-01 tests unless IDENTITY-01 source changes. Mocked tests do **not** prove PostgreSQL behavior, locking, or concurrent-insert safety.

### 7.2 Apply preflight (mandatory before any later apply; neither single nor batch apply is authorized in this window)

1. Pre-apply Lightsail snapshot (mandatory). Use the established Lightsail **console** snapshot procedure (instance → Snapshots → Create snapshot). Do **not** require a snapshot CLI. Wait until the snapshot status is **Available** before any later apply. If the snapshot cannot be created or does not become Available, STOP.
2. Confirm staging `users` PK and that `"public"."users"("id")` is the referenced constraint.
3. Confirm `public.api_keys` is still absent. If present, STOP — do not apply; inspect.
4. `npx typeorm migration:show -d dist/data-source.js` (or equivalent compiled show).
5. Expected pending set after this revision is delivered, and **before** any apply:

   - `[ ] CreateApiKeysTable1772950000000`
   - `[ ] AddInternalAccessToApiKeys1773000000000`

   If any other pending migration appears, STOP and assess separately.

**Standard TypeORM `migration:run` executes all pending migrations.** With both SCHEMA-01 and IDENTITY-01 pending, `DATABASE_URL=<url> npm run migration:run:prod` (`typeorm migration:run -d dist/data-source.js`) is a **two-migration** operation. It is **not** a SCHEMA-01-only procedure. Do not present or use that command as if it applied only `CreateApiKeysTable1772950000000`.

A **single-migration** apply requires a separately verified restricted migration-loading procedure that still writes normal TypeORM history bookkeeping. That procedure is **UNRESOLVED** here. Do not invent a CLI name filter, fake history rows, or change production migration discovery (`data-source.ts` glob) in this task.

Neither single-migration apply nor the two-migration batch is authorized in this window. The previous approval to apply only IDENTITY-01 does not authorize this migration or a two-migration batch. Separate STAGING + migration-execution authorization is required for whichever apply set Keith later approves.

Staging inspection / revert commands (apply remains unauthorized here):

| Operation | Command | Notes |
|---|---|---|
| Show | `DATABASE_URL=<url> npx typeorm migration:show -d dist/data-source.js` | Non-destructive |
| Standard apply | `DATABASE_URL=<url> npm run migration:run:prod` | Runs **all pending** migrations. With the expected pending set this is SCHEMA-01 **and** IDENTITY-01. Not SCHEMA-01-only. **Not authorized this window.** |
| Single-migration apply | UNRESOLVED | Needs a separately verified restricted loader that preserves history. Not invented here. **Not authorized this window.** |
| Revert | `DATABASE_URL=<url> npx typeorm migration:revert -d dist/data-source.js` | Reverts only the last applied migration. **Not authorized this window.** |

Requires current `dist/` including this new compiled migration before any later apply. `migration:revert:prod` still does not exist as an npm script.

### 7.3 PostgreSQL verification after SCHEMA-01 apply (before IDENTITY-01 apply)

Verify table, columns, nullability, defaults, PK, FK `"public"."users"("id") ON DELETE CASCADE`, indexes `idx_api_key_hashed` / `idx_api_key_user_id` on `public.api_keys`, and **no** `is_internal` yet.

Existing-table conflict: on a clone/snapshot copy only, create a decoy `api_keys` and confirm `up()` fails with the SCHEMA-01 diagnostic and does not adopt the decoy.

### 7.4 Old application compatibility

1. After SCHEMA-01 only: old application **without** `isInternal` entity mapping continues DB-key create/list/validate (TypeORM selects mapped columns only). IDENTITY-01 application code must **not** be deployed yet (`is_internal` still missing).
2. After a later authorized IDENTITY-01 migration: old application still ignores unmapped `is_internal`. Then IDENTITY-01 application code may be deployed.

### 7.5 Rollback requirements

- Verified **Available** Lightsail console snapshot before apply.
- `down()` refuses rollback SQL unless the QueryRunner transaction is already active; it does not commit or roll back that transaction.
- ACCESS EXCLUSIVE NOWAIT on `"public"."api_keys"` precedes COUNT and all DROPs; lock failure must not COUNT or DROP.
- Populated-table `down()` must fail closed (positive explicit row count).
- Invalid/missing count must fail closed (no `Number()` coercion to zero).
- Empty-table `down()` (explicit integer/`"0"`) drops schema-qualified indexes then `"public"."api_keys"` only.
- Live concurrent-insert vs rollback locking remains a later PostgreSQL validation item; mocked tests do not prove it.
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
