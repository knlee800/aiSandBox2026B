# AGENT-PLATFORM-EXEC-01C-IDENTITY-01 — DB API-Key Internal-Access Design

**Task ID:** AGENT-PLATFORM-EXEC-01C-IDENTITY-01
**Title:** DB API-key internal-access capability for Gateway-ingress Harness canaries
**Step:** Design and registration (this document)
**Status:** REGISTERED / READY / NOT ADMITTED
**Date:** 2026-09-07
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — Step 1 is this design/registration only
**Development program:** CURRENT
**Product-visible Harness capability:** FUTURE / gated / disabled / unavailable to users
**Base HEAD:** `196e7fa7476f5109b28990384c3aae91e83d5fb7` (branch `main`; HEAD == origin/main; working tree clean at window open)
**EXEC-01C6A prerequisite:** This task must be COMPLETE AND LOCKED before EXEC-01C6A Gateway-ingress execution proceeds

This is design, architecture, and registration documentation only. No application source, tests, migrations, environment, runtime, staging, provider, credit, Docker, PostgreSQL, Redis, browser, privilege grants, or Git commit/push.

---

## 1. Problem Statement

**Capability gap:** DB-persisted API keys cannot carry `isInternal=true` identity. This blocks EXEC-01C6A's Gateway-ingress canaries under `LAUNCH_STATE=INTERNAL`.

### Current identity construction

| Authentication path | `isInternal` source | Value |
|---|---|---|
| Static API key (test/dev) | `api-key.config.ts` map | `true` or `undefined` per entry |
| DB API key | NOT SET | always `undefined` (fails `=== true`) |
| Browser session | `session-or-api-key.guard.ts` hardcode | always `true` |

When `ApiKeyAuthGuard` resolves a DB key (`api-key-auth.guard.ts` lines 78–84):

```typescript
identity = {
  userId: dbIdentity.userId,
  apiKeyId: dbIdentity.apiKeyId,
  scopes: dbIdentity.scopes,
  harnessEntitled: dbIdentity.scopes.includes('ai:harness'),
};
// isInternal: NOT SET → undefined
```

`LaunchGuard` (`launch.guard.ts` line 84) checks `identity.isInternal === true`. DB keys always fail this check regardless of scopes or ownership.

### Why this is a canary prerequisite

EXEC-01C6A's xAI-negative and future EXEC-01C6B's real-provider canary both use `GATEWAY_HTTP_POST_/api/ai/execute` ingress. If staging `LAUNCH_STATE` is `INTERNAL` (likely — see LIVE-11 analog), DB-key identities need `isInternal=true` to pass `LaunchGuard`. Without this capability, Gateway-ingress canaries would be blocked at launch state.

The static key `test-harness-api-key` has `isInternal: true` in `api-key.config.ts`, but:
- It is a test key, not a DB-persisted key
- Static fallback is a development convenience, not a production identity mechanism
- Using only the static key would not prove DB-key identity propagation through the full authentication stack

---

## 2. Design

### 2.1 Entity change

Add a persisted `is_internal` boolean column to the `api_keys` table.

**File:** `services/api-gateway/src/entities/api-key.entity.ts`

```typescript
/**
 * Internal access flag
 * When true, this key is treated as an internal/operator key
 * for LaunchGuard INTERNAL state access.
 * Default false. Cannot be set via user-facing API.
 * Operator-only grant/revoke via direct database procedure.
 */
@Column({ type: 'boolean', default: false, name: 'is_internal' })
isInternal: boolean;
```

### 2.2 Service change

Update `ApiKeyService.validateApiKey()` return type to include `isInternal`.

**File:** `services/api-gateway/src/auth/api-key.service.ts`

```typescript
async validateApiKey(plaintextKey: string): Promise<{
  userId: string;
  apiKeyId: string;
  scopes: string[];
  isInternal: boolean;
} | null> {
  // ... existing bcrypt comparison ...
  return {
    userId: key.userId,
    apiKeyId: key.id,
    scopes: key.scopes,
    isInternal: key.isInternal,
  };
}
```

**Deployment constraint:** The migration adding the `is_internal` column MUST be applied and verified before this code is deployed. See §5.4 for the mandatory deployment order. TypeORM generates SQL referencing every mapped column; if the column does not exist, the query fails at the PostgreSQL level before any JavaScript executes.

### 2.3 Guard change

Propagate `isInternal` from DB validation result into the constructed `ApiKeyIdentity`.

**File:** `services/api-gateway/src/auth/api-key-auth.guard.ts`

```typescript
// Phase 36A: Try database validation first
let identity: ApiKeyIdentity | null = null;
try {
  const dbIdentity = await this.apiKeyService.validateApiKey(apiKey);
  if (dbIdentity) {
    identity = {
      userId: dbIdentity.userId,
      apiKeyId: dbIdentity.apiKeyId,
      scopes: dbIdentity.scopes,
      isInternal: dbIdentity.isInternal,
      harnessEntitled: dbIdentity.scopes.includes('ai:harness'),
    };
  }
} catch (error) {
  // If database validation fails, fall through to static config
}
```

### 2.4 What is NOT changed

- **LaunchGuard:** No change. Continues to check `identity.isInternal === true`. The policy is preserved.
- **`harnessEntitled`:** Remains derived from `scopes.includes('ai:harness')` for DB keys. `isInternal` and `harnessEntitled` remain independent.
- **`isEarlyAccess`:** Not added to DB keys. Remains static-config-only.
- **`ApiKeyIdentity` interface:** Already has `isInternal?: boolean`. No interface change needed.
- **Static key config:** `api-key.config.ts` is unchanged.
- **Browser session identity:** `session-or-api-key.guard.ts` hardcodes `isInternal: true` — unchanged.
- **`CreateApiKeyDto`:** Only has `scopes`. No `isInternal` field.
- **`ApiKeyController`:** No change. `createApiKey` and `revokeApiKey` do not touch `isInternal`.
- **`ai-execution.controller.ts`:** No change. Reads `identity.isInternal` via `LaunchGuard` (unchanged).
- **Harness entitlement proof:** No change. `isInternal` is not part of the HMAC proof claim set.
- **Frozen `HARNESS_ENTITLEMENT_PROOF_V1` contract:** Not touched.
- **Frontend:** No change.

---

## 3. Self-Promotion Protection

### 3.1 User-facing API surface

| Endpoint | Method | Fields accepted | `isInternal` exposure |
|---|---|---|---|
| `POST /api/keys` | createApiKey | `CreateApiKeyDto { scopes: string[] }` | NOT accepted |
| `GET /api/keys` | listApiKeys | N/A (read) | NOT returned |
| `DELETE /api/keys/:id` | revokeApiKey | N/A (id param) | NOT modified |

**Trace: create path**

1. `ApiKeyController.createApiKey()` extracts `req.user.userId` and `createDto.scopes`
2. Calls `apiKeyService.createApiKey(userId, scopes)` — no `isInternal` parameter
3. Service constructs entity: `apiKeyRepository.create({ hashedKey, keyPrefix, userId, scopes, revokedAt: null })` — `isInternal` not in the literal
4. TypeORM `save()` uses column default `false`
5. Result: every user-created key has `isInternal = false`

**Trace: DTO validation**

`CreateApiKeyDto` uses `class-validator` decorators: `@IsArray()`, `@ArrayNotEmpty()`, `@IsString({ each: true })` on `scopes`. No other fields are declared. The global `ValidationPipe` in `main.ts` is configured with `whitelist: true` and `transform: true`. `whitelist: true` **silently strips** any property not decorated with a `class-validator` decorator from the request body before it reaches the controller. `forbidNonWhitelisted` is **not** configured in production `main.ts` (it appears only in the smoke integration spec), so unknown properties are stripped rather than rejected with a 400 error. An attacker sending `{ scopes: ["ai:execute"], isInternal: true }` would have `isInternal` silently removed by the pipe. Even if the pipe were somehow bypassed, the controller and service never read `isInternal` from the DTO.

**Trace: object spreading**

`apiKeyRepository.create()` receives a literal with explicit keys. TypeORM's `create()` maps only recognized entity columns from the provided literal. Even if an attacker added `isInternal: true` to a request body, it would:
1. Not reach the service (controller extracts `createDto.scopes` only)
2. Not reach the repository (service passes explicit named parameters only)
3. Not be accepted by `create()` via spreading (no spread from user input)

**Trace: revoke path**

`revokeApiKey()` sets `revokedAt = new Date()` then `save()`. No other field is modified. Cannot promote.

**Trace: list path**

`listApiKeys()` returns `id`, `keyPrefix`, `scopes`, `createdAt`, `revokedAt`, `isActive`. Does NOT return `isInternal`. No information leakage.

### 3.2 Scope independence

- Having `ai:harness` scope does NOT grant `isInternal=true`
- Having `isInternal=true` does NOT grant `harnessEntitled=true`
- Both are independent attributes with separate semantics:
  - `isInternal`: LaunchGuard access in INTERNAL/EARLY_ACCESS states
  - `harnessEntitled`: Harness execution gate (derived from `ai:harness` scope)
- A key needs BOTH `isInternal=true` AND `scopes.includes('ai:harness')` AND `harnessVersion='v1'` for Gateway-ingress Harness execution under INTERNAL launch state

### 3.3 Migration safety

- `NOT NULL DEFAULT FALSE`: all existing keys receive `is_internal = false` during migration; no existing key becomes internal
- No backfill to `isInternal=true` — the migration applies only the column default
- No automatic promotion based on scope presence (having `ai:harness` does not imply internal access)
- Mandatory migration-first deployment order (see §5.4) — application code must not reference the column before it exists in the database

---

## 4. Privilege Administration

### 4.1 Grant procedure

**Authorization:** Keith (platform operator) only. No automated grant. No self-service. No application API for this operation.

**Prerequisites:**
1. Keith has explicitly authorized the grant for a specific key
2. Operator has the key's UUID `id` (from `GET /api/keys` list or DB query) and the owning `user_id`
3. Operator has verified the key is active by confirming `revoked_at IS NULL`

**Procedure:**
```sql
BEGIN;

-- Step 1: Verify target exists and capture prior state
SELECT id, key_prefix, user_id, scopes, is_internal, revoked_at
  FROM api_keys
  WHERE id = '<key-uuid>' AND user_id = '<user-uuid>';
-- STOP if zero rows returned (key not found or user mismatch)
-- STOP if revoked_at IS NOT NULL (revoked key; do not grant internal status)
-- RECORD prior is_internal value for audit

-- Step 2: Grant (with affected-row check)
UPDATE api_keys
  SET is_internal = TRUE
  WHERE id = '<key-uuid>'
    AND user_id = '<user-uuid>'
    AND revoked_at IS NULL
    AND is_internal = FALSE;
-- VERIFY exactly 1 row affected
-- If 0 rows: key may already be internal, revoked, or misidentified — do not proceed blindly

-- Step 3: Verify post-mutation state
SELECT id, key_prefix, user_id, is_internal, revoked_at
  FROM api_keys
  WHERE id = '<key-uuid>';
-- CONFIRM is_internal = TRUE

COMMIT;
```

**Affected-row check:** The `UPDATE` includes `AND is_internal = FALSE` to ensure exactly 1 row is updated. If the key is already `is_internal = TRUE`, 0 rows are affected. This is not an error but must be noted in the audit (idempotent grant attempt; prior value was already TRUE).

**Audit evidence (mandatory):** Operator records the following without exposing key material:
- Key `id` (UUID)
- `key_prefix` (first 16 chars, for human identification)
- `user_id` (UUID of key owner)
- Prior `is_internal` value (from Step 1 SELECT)
- New `is_internal` value (from Step 3 SELECT)
- Timestamp of operation
- Operator identity (who performed the change)
- Authorization reference (Keith's explicit approval; how/when)
- Reason for grant
- **Excluded:** `hashed_key`, plaintext key material, full key value

**Single-key targeting:** The `WHERE` clause requires both `id` AND `user_id`. A broad `UPDATE api_keys SET is_internal = TRUE` without a fully qualified `WHERE` clause is forbidden.

**Already-internal keys:** If Step 2 affects 0 rows because `is_internal` is already `TRUE`, the transaction is still valid. Record in audit as "no-op grant; key was already internal" with prior and post values both `TRUE`.

### 4.2 Revoke internal-access procedure

**Authorization:** Keith (platform operator) only. Same authorization requirements as grant.

```sql
BEGIN;

-- Step 1: Verify target and capture prior state
SELECT id, key_prefix, user_id, is_internal, revoked_at
  FROM api_keys
  WHERE id = '<key-uuid>' AND user_id = '<user-uuid>';
-- RECORD prior is_internal value for audit

-- Step 2: Revoke internal access (with affected-row check)
UPDATE api_keys
  SET is_internal = FALSE
  WHERE id = '<key-uuid>'
    AND user_id = '<user-uuid>'
    AND is_internal = TRUE;
-- VERIFY exactly 1 row affected
-- If 0 rows: key may already be non-internal or misidentified

-- Step 3: Verify post-mutation state
SELECT id, key_prefix, user_id, is_internal
  FROM api_keys
  WHERE id = '<key-uuid>';
-- CONFIRM is_internal = FALSE

COMMIT;
```

**Revoking from already-revoked keys:** If the key's `revoked_at IS NOT NULL` (the key itself is revoked via the API), the `is_internal` value is operationally irrelevant because `validateApiKey()` excludes revoked keys. However, for hygiene, the operator may still set `is_internal = FALSE` on a revoked key. The `UPDATE` omits the `revoked_at IS NULL` guard to allow this cleanup.

**Already-non-internal keys:** If Step 2 affects 0 rows because `is_internal` is already `FALSE`, record in audit as "no-op revoke; key was already non-internal".

**Audit:** Same evidence requirements as §4.1 (key UUID, key_prefix, user_id, prior/new value, timestamp, operator, authorization, reason; no key material).

### 4.3 Effect timing

**Immediate.** No cache exists in the authentication path.

`ApiKeyService.validateApiKey()` queries the database on every request:
```typescript
const allKeys = await this.apiKeyRepository.find({
  where: { revokedAt: null },
});
```

There is no in-memory cache, no Redis cache, no TTL. Changes to `is_internal` take effect on the very next API call that validates that key.

### 4.4 Revoked, expired, deleted, and invalid keys

- **Revoked keys** (`revokedAt !== null`): excluded from `validateApiKey()` query. `isInternal` is irrelevant.
- **Deleted keys** (row removed): not found by bcrypt comparison. `isInternal` is irrelevant.
- **Invalid keys** (no match): `validateApiKey()` returns `null`. Static fallback is attempted. `isInternal` from DB never applies.
- **There is no key expiration mechanism.** Keys are either active (`revokedAt === null`) or revoked.

### 4.5 Restoration after temporary internal use

After a canary or temporary internal use:
1. Revoke the specific key: `revokeApiKey(keyId, userId)` via API or `UPDATE api_keys SET revoked_at = NOW() WHERE id = '<key-uuid>'`
2. Or remove internal status: set `is_internal = FALSE` via the revoke procedure above
3. Confirm the key no longer passes LaunchGuard in INTERNAL state

### 4.6 Ordinary key operations cannot promote

| Operation | Can set `isInternal`? | Reason |
|---|---|---|
| `POST /api/keys` (create) | NO | Service hardcodes `isInternal` to default `false` |
| `DELETE /api/keys/:id` (revoke) | NO | Only sets `revokedAt` |
| `GET /api/keys` (list) | NO | Read-only |
| User request body injection | NO | DTO → service → repository chain never passes `isInternal` |

---

## 5. Migration Design

### 5.1 Migration file

**File:** `services/api-gateway/src/migrations/1773000000000-AddInternalAccessToApiKeys.ts`
**Timestamp:** `1773000000000` (after latest `1772900000000-AddAdminGrantAuditColumns`)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInternalAccessToApiKeys1773000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
      DROP COLUMN IF EXISTS "is_internal";
    `);
  }
}
```

### 5.2 Convention compliance

- Follows existing migration pattern (see `1772900000000-AddAdminGrantAuditColumns.ts`)
- Raw SQL with `IF NOT EXISTS` / `IF EXISTS` guards
- Single `ALTER TABLE ADD COLUMN` with `NOT NULL DEFAULT FALSE`
- Clean `down()` with `DROP COLUMN`

### 5.3 Existing key behavior

All existing `api_keys` rows receive `is_internal = FALSE`. This is correct:
- No existing DB key should be internal
- Static test keys already have `isInternal: true` in `api-key.config.ts`
- No backfill to `TRUE`

### 5.4 Application/schema rollout order (AWS Lightsail)

**Mandatory deployment order: migration-first, then application code.**

TypeORM with `synchronize: false` does not auto-create columns. The TypeORM entity metadata maps `isInternal` to a SQL column `"is_internal"`. When `ApiKeyService.validateApiKey()` calls `this.apiKeyRepository.find({ where: { revokedAt: null } })`, TypeORM generates SQL that includes every mapped column in the `SELECT` list: `SELECT "api_keys"."is_internal", ... FROM "api_keys" ...`. If the column does not yet exist in the database, PostgreSQL returns a fatal error (`column "is_internal" of relation "api_keys" does not exist`). The JavaScript `?? false` fallback never executes because the SQL itself fails before any JavaScript column access occurs.

1. **Deploy and verify the additive migration first** — `ALTER TABLE ADD COLUMN ... DEFAULT FALSE`
   - Safe: existing (old) application code does not reference `is_internal` in its entity metadata
   - TypeORM `SELECT` from old application does not include the new column; PostgreSQL silently ignores the extra column in the table
   - All existing keys receive `is_internal = FALSE`
   - **Verify:** confirm column exists with `\d api_keys` or equivalent query before proceeding

2. **Verify old application compatibility** — the old application (without the entity column) continues to function correctly against the expanded schema because TypeORM only selects columns mapped in its entity metadata. An unmapped column in the database is ignored.

3. **Deploy updated application code** — entity + service + guard changes
   - Safe: the column already exists with correct default and verified data
   - New code reads `isInternal` from the entity via TypeORM's generated SQL
   - All existing keys return `isInternal = false` (the column default)

**Reverse order (code before migration) is NOT safe.** Deploying the updated entity while the column does not yet exist causes TypeORM to generate SQL referencing a nonexistent column, resulting in PostgreSQL errors on every API key validation. This would break all DB-key authentication until the migration is applied.

### 5.5 Rollback behavior

**Mandatory rollback order: application code first, then migration.**

Dropping the column while the updated application is still running would cause the same TypeORM SQL failure described in §5.4 (the entity still maps `isInternal` to a column that no longer exists).

**Step 1 — Application rollback** (restore code without `isInternal` entity mapping):
- Entity no longer references `is_internal`; TypeORM-generated SQL no longer includes it
- Column remains in database but is ignored by the old application
- Guard falls back to static config for `isInternal` (existing behavior)
- DB-key authentication continues to function
- No data corruption

**Step 2 — Migration rollback** (`down()`):
- Drops `is_internal` column from `api_keys` table
- **Loss:** all `is_internal` privilege metadata (which keys were granted internal access) is permanently lost
- This is metadata loss, not a complete operational revocation strategy; any running processes that cached or read the old value before the column drop would not be aware of the change until they re-query
- Verify no application processes still reference the dropped column before considering rollback complete

**Important:** Dropping the column loses internal-access metadata. If operational revocation is needed (e.g., removing a specific key's internal status), use the operator revoke procedure (§4.2) rather than migration rollback. Migration rollback is a schema emergency measure, not a privilege management tool.

### 5.6 Lightsail execution

**Deployment sequence on AWS Lightsail staging (`aisandbox-staging`):**

1. **SSH to Lightsail instance**
2. **Run migration** (application remains on old code):
   ```bash
   cd /opt/aisandbox/services/api-gateway
   DATABASE_URL=<staging-url> npx typeorm migration:run -d data-source.ts
   ```
3. **Verify column exists:**
   ```sql
   SELECT column_name, data_type, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'api_keys' AND column_name = 'is_internal';
   ```
4. **Verify old application still functions** (DB-key authentication, key creation, key listing should all work without errors — TypeORM ignores unmapped columns)
5. **Deploy updated application code** (entity + service + guard with `isInternal` mapping)
6. **Verify updated application** (DB-key validation now includes `isInternal: false` for all keys)

**Rollback sequence** (if needed):
1. **Revert application code** to version without `isInternal` entity mapping
2. **Verify application functions** with the extra column still present
3. **Run migration revert** (only if column removal is required):
   ```bash
   DATABASE_URL=<staging-url> npx typeorm migration:revert -d data-source.ts
   ```
4. **Acknowledge:** column removal permanently loses `is_internal` metadata

Migration execution is **not authorized** in this registration. It requires separate STAGING authorization.

**Repository deployment mechanism:** The project uses `npx typeorm migration:run -d data-source.ts` for migration application and `npx typeorm migration:revert -d data-source.ts` for rollback. `data-source.ts` reads `DATABASE_URL` and discovers migrations from `src/migrations/*.{ts,js}`. TypeORM executes pending migrations in timestamp order and records them in a `migrations` table. The `synchronize: false` setting in both `data-source.ts` and `database.config.ts` ensures TypeORM never auto-applies schema changes.

---

## 6. Affected Types, Services, Guards, and Tests

### 6.1 Exact prospective implementation files

| # | File | Change |
|---|---|---|
| 1 | `services/api-gateway/src/entities/api-key.entity.ts` | Add `isInternal` column |
| 2 | `services/api-gateway/src/auth/api-key.service.ts` | Return `isInternal` from `validateApiKey()` |
| 3 | `services/api-gateway/src/auth/api-key-auth.guard.ts` | Propagate `isInternal` from DB result to identity |
| 4 | `services/api-gateway/src/migrations/1773000000000-AddInternalAccessToApiKeys.ts` | New migration file |
| 5 | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | Test DB key isInternal propagation |
| 6 | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | Test isInternal in validateApiKey return |

### 6.2 NOT changed (preserved)

| File | Reason |
|---|---|
| `services/api-gateway/src/auth/api-key.config.ts` | Static keys unchanged |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Browser session unchanged |
| `services/api-gateway/src/launch/launch.guard.ts` | Policy unchanged |
| `services/api-gateway/src/auth/dto/api-key.dto.ts` | No isInternal in DTO |
| `services/api-gateway/src/auth/api-key.controller.ts` | No isInternal in create/revoke |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Not modified by this task |
| `services/ai-service/**` | Not in scope |
| `frontend/**` | Not in scope |
| Frozen `HARNESS_ENTITLEMENT_PROOF_V1` paths | Not touched |

---

## 7. Required Validation Plan

All validation is planned for later authorized execution. No tests run in this window. Tests target AWS Lightsail unless separately justified for local execution.

### 7.1 Acceptance criteria mapped to exact test paths

Each required validation criterion is mapped to an existing test file (✓ existing) or a prospective test location (⊕ prospective). Existing tests that already prove a requirement are reused; prospective tests are additions needed during IDENTITY-01 implementation.

#### 7.1.1 Default false for existing/new ordinary keys

| # | Criterion | Test file | Status |
|---|---|---|---|
| D1 | `createApiKey()` produces key with `isInternal=false` (entity default) | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ⊕ Prospective: add assertion that `repository.create()` call does not include `isInternal` and the saved entity has `isInternal=false` via column default |
| D2 | `validateApiKey()` returns `isInternal: false` for a non-internal DB key | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ⊕ Prospective: extend existing `validateApiKey` tests to assert `isInternal: false` in return value when mock entity has `isInternal: false` |
| D3 | Migration applies `DEFAULT FALSE` to all existing rows | Staging integration (not a unit test; verified by operator SQL query after migration) | Planned for Lightsail |

#### 7.1.2 Actual endpoint rejection or safe handling of attempted self-promotion

| # | Criterion | Test file | Status |
|---|---|---|---|
| S1 | Global `ValidationPipe` with `whitelist: true` strips `isInternal` from `CreateApiKeyDto` | `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` | ⊕ Prospective: add test sending `{ scopes: [...], isInternal: true }` and verify the service is called with only `scopes` (not `isInternal`). Note: this requires an integration-style test with the validation pipe; the existing controller spec mocks the service directly. Alternatively, add a dedicated DTO validation unit test |
| S2 | Controller extracts only `createDto.scopes`, never passes `isInternal` | `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` | ✓ Existing: `createApiKey` test verifies `service.createApiKey(userId, createDto.scopes)` call signature (no isInternal argument) |
| S3 | Service `createApiKey()` passes explicit literal to `repository.create()` without `isInternal` | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ✓ Existing: `createApiKey` test verifies `repository.create()` called with `{ hashedKey, keyPrefix, userId, scopes, revokedAt: null }` (no `isInternal` field) |
| S4 | `revokeApiKey()` does not modify `isInternal` | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ✓ Existing: `revokeApiKey` test verifies only `revokedAt` is set; ⊕ prospective: add explicit assertion that saved entity does not change `isInternal` |

#### 7.1.3 INTERNAL launch rejection for ordinary DB keys

| # | Criterion | Test file | Status |
|---|---|---|---|
| L1 | `LaunchGuard` in INTERNAL state rejects identity with `isInternal: false` | `services/api-gateway/src/launch/__tests__/launch.guard.spec.ts` | ✓ Existing: "should block keys with isInternal=false" test |
| L2 | `LaunchGuard` in INTERNAL state rejects identity with `isInternal: undefined` (no flag) | `services/api-gateway/src/launch/__tests__/launch.guard.spec.ts` | ✓ Existing: "should block public keys" test (identity has no `isInternal`) |
| L3 | `LaunchGuard` in INTERNAL state allows identity with `isInternal: true` | `services/api-gateway/src/launch/__tests__/launch.guard.spec.ts` | ✓ Existing: "should allow internal keys" test |
| L4 | DB key with `isInternal=true` propagated through guard → identity has `isInternal: true` → passes LaunchGuard | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | ⊕ Prospective: add test where `mockApiKeyService.validateApiKey` returns `{ ..., isInternal: true }` and verify `request.apiKeyIdentity.isInternal === true` |
| L5 | DB key with `isInternal=false` propagated through guard → identity has `isInternal: false` → blocked by LaunchGuard | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | ⊕ Prospective: add test where mock returns `{ ..., isInternal: false }` and verify `request.apiKeyIdentity.isInternal === false` |

#### 7.1.4 Harness entitlement remains separately required

| # | Criterion | Test file | Status |
|---|---|---|---|
| H1 | DB key with `isInternal=true` but without `ai:harness` scope → `harnessEntitled: false` | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | ⊕ Prospective: add test with `isInternal: true` and `scopes: ['ai:execute']` → verify `harnessEntitled: false` |
| H2 | DB key with `ai:harness` scope but `isInternal=false` → `harnessEntitled: true`, `isInternal: false` | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | ⊕ Prospective: add test with `isInternal: false` and `scopes: ['ai:harness']` → verify `harnessEntitled: true`, `isInternal: false` |
| H3 | Browser session identity has `isInternal: true` but `harnessEntitled` depends on allow-list, not `isInternal` | `services/api-gateway/src/auth/__tests__/session-or-api-key.guard.spec.ts` | ✓ Existing: "does not treat isInternal true as Harness entitlement" test |

#### 7.1.5 Foreign session/agent ownership rejection

| # | Criterion | Test file | Status |
|---|---|---|---|
| F1 | Session ownership check: `session.userId !== identity.userId` → `NotFoundException` | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | ✓ Existing: AGENT-HARNESS-05C5 session ownership enforcement tests (this is independent of `isInternal` and unchanged by IDENTITY-01) |
| F2 | Execution result ownership check | `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | ✓ Existing: execution ownership checks on `getExecutionResult` and `triggerBuildApply` |
| F3 | Key ownership on revoke: user cannot revoke another user's key | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ✓ Existing: "should throw ForbiddenException when user does not own the key" |

**Note:** Foreign-ownership rejection is not changed by IDENTITY-01. `isInternal=true` does not bypass UUID ownership checks. These existing tests confirm the invariant. No prospective tests needed unless implementation inadvertently couples `isInternal` to ownership (verify during implementation review).

#### 7.1.6 Revoked/expired keys and revocation effect

| # | Criterion | Test file | Status |
|---|---|---|---|
| R1 | Revoked keys (`revokedAt !== null`) excluded from `validateApiKey()` query | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | ✓ Existing: "should return null for revoked API key" |
| R2 | Invalid/unmatched key → `validateApiKey()` returns `null` → static fallback or 403 | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | ✓ Existing: "should throw ForbiddenException when API key is invalid" |
| R3 | Revocation effect is immediate (no cache) | Design verification: `validateApiKey()` queries DB on every call (no cache layer); see §4.3 | Confirmed by code inspection |
| R4 | Operator revoke procedure sets `is_internal = FALSE` with affected-row check | Staging integration (operator procedure, not unit test) | Planned for Lightsail |

#### 7.1.7 Migration defaults and rollout compatibility

| # | Criterion | Test file | Status |
|---|---|---|---|
| M1 | Migration `up()` adds column with `NOT NULL DEFAULT FALSE` | Manual verification of migration SQL + staging dry-run | Planned for Lightsail |
| M2 | Old application compatible with expanded schema (unmapped column ignored) | Staging verification: deploy migration, verify old application still serves requests | Planned for Lightsail |
| M3 | Migration `down()` drops column cleanly | Staging dry-run / verification | Planned for Lightsail |
| M4 | Migration timestamp `1773000000000` is unique and correctly ordered after `1772900000000` | ✓ Verified: highest existing migration is `1772900000000-AddAdminGrantAuditColumns.ts`; `1773000000000` is unique and correctly ordered |

### 7.2 Existing coverage summary

The following existing test files already prove requirements without modification:

- `services/api-gateway/src/launch/__tests__/launch.guard.spec.ts` — L1, L2, L3 (LaunchGuard INTERNAL state enforcement)
- `services/api-gateway/src/auth/__tests__/session-or-api-key.guard.spec.ts` — H3 (browser session isInternal ≠ harnessEntitled)
- `services/api-gateway/src/ai/ai-execution.controller.spec.ts` — F1, F2 (session/execution ownership)
- `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` — R1, S3 (revoked key exclusion, create literal)
- `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` — R2 (invalid key rejection)
- `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` — S2 (controller call signature)

### 7.3 Prospective test additions (implementation step only)

| File | Tests to add |
|---|---|
| `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | D1 (create default), D2 (validate returns isInternal), S4 (revoke doesn't change isInternal) |
| `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | L4 (internal=true propagation), L5 (internal=false propagation), H1 (internal ≠ entitled), H2 (entitled ≠ internal) |
| `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` | S1 (DTO whitelist strips isInternal — may require integration-style test with ValidationPipe) |

### 7.4 Authentication precedence / static fallback

The current priority is: DB first → static fallback. After this change:
1. DB key found → identity includes `isInternal` from DB column
2. DB not found / error → static config → `isInternal` from static map
3. Neither → `ForbiddenException`

**Regression risk:** If a key exists in BOTH DB (with `isInternal=false`) and static config (with `isInternal=true`), the DB path wins and `isInternal` would be `false`. This is correct for production (DB is authoritative) but could affect test keys if they're also in the DB. Test to verify static fallback only fires when DB returns `null`.

**Existing test coverage:** `api-key-auth.guard.spec.ts` already tests: "should fallback to static config when database validation fails" and "should handle database errors gracefully and fallback to static config". These cover the precedence chain but do not specifically test `isInternal` propagation from each path (prospective L4/L5 address this for the DB path; the static path is already tested implicitly since `ApiKeyConfig` returns complete identity objects including `isInternal`).

---

## 8. Dependency and Mutex Declarations

### 8.1 This task

| Field | Value |
|---|---|
| Task ID | `AGENT-PLATFORM-EXEC-01C-IDENTITY-01` |
| Depends on (machine) | `["GOV-AUTH-03"]` |
| Mutexes | `["GATEWAY", "MIGRATION"]` |
| Write paths | 6 files listed in §6.1 |
| Evidence class | `LOCAL-TESTS` |
| Runtime needs | `[]` |
| Shared contracts | `[]` consumer / `[]` mutator |

### 8.2 EXEC-01C6A dependency update

EXEC-01C6A's machine `dependsOn` must include `AGENT-PLATFORM-EXEC-01C-IDENTITY-01`. Updated array:
```json
["AGENT-PLATFORM-EXEC-01C3", "AGENT-PLATFORM-EXEC-01C4", "AGENT-PLATFORM-EXEC-01C5", "AGENT-PLATFORM-EXEC-01C5B", "AGENT-PLATFORM-EXEC-01C-IDENTITY-01"]
```

This ensures EXEC-01C6A cannot be admitted until this identity work is COMPLETE AND LOCKED. No cycle: EXEC-01C-IDENTITY-01 depends on GOV-AUTH-03 (locked); EXEC-01C6A depends on EXEC-01C-IDENTITY-01. Neither depends on EXEC-01C6 or EXEC-01C.

---

## 9. Remaining Decisions and Design Blockers

1. **Migration execution authorization:** Lightsail staging migration execution requires separate STAGING authorization (not granted here)
2. **Exact operator grant target:** Which specific DB key on staging will be granted internal access — determined at EXEC-01C6A admission time when the entitled identity is confirmed
3. **`isEarlyAccess` DB persistence:** Out of scope. Not needed for the canary. May be a separate future task
4. **Validation pipe discrepancy:** The production `main.ts` configures `ValidationPipe({ whitelist: true, transform: true })` — `whitelist: true` silently strips unknown properties. The smoke integration spec additionally sets `forbidNonWhitelisted: true` (which rejects with 400). Self-promotion protection does not depend on `forbidNonWhitelisted` (the controller/service chain never reads `isInternal` from user input regardless), but the discrepancy between production and test pipe configuration should be noted. This is a pre-existing discrepancy, not introduced by this task
5. **Index on `is_internal`:** Not added. The column is not used in queries (keys are found by bcrypt comparison, not by `is_internal` filter). An index would add write overhead with no query benefit

---

## 10. Authorization Boundary

```
IMPLEMENTATION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
MIGRATION_EXECUTION_AUTHORIZED=NO
PRIVILEGE_GRANT_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
TESTS_EXECUTED=NO
APPLICATION_SOURCE_CHANGED=NO
```

---

## 11. Confirmation of Zero Implementation Activity

- No application source, tests, migrations, environment, sidecar, validator, or mutex-catalog changes in this window
- No Harness flag changes
- No frontend `harnessVersion`
- No privilege grants executed
- Runtime/Docker/database/staging-connection/browser/provider-live/credit = 0
- Git commit/push = NO
- No lane occupied
- No implementation mutex acquired
