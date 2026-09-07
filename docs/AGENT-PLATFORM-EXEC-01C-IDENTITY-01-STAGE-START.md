# AGENT-PLATFORM-EXEC-01C-IDENTITY-01 — Stage-Start

**Task ID:** AGENT-PLATFORM-EXEC-01C-IDENTITY-01
**Title:** DB API-key internal-access capability for Gateway-ingress Harness canaries
**Step:** 2 — Stage-start (freeze implementation, security validation, and migration rollout contract)
**Status:** COMPLETE
**Date:** 2026-09-07
**Base HEAD:** `2294a5534c8db54366375728bd932bff6ef99372` (branch `main`; HEAD == origin/main; working tree clean)
**Design document:** `docs/AGENT-PLATFORM-EXEC-01C-IDENTITY-01-DESIGN.md`

This is a governance documentation step. No application source, tests, migration execution, runtime, staging, provider, credit, Docker, PostgreSQL, Redis, browser, privilege grants, or Git commit/push.

---

## 1. Base State Verification

| Check | Result |
|---|---|
| HEAD | `2294a5534c8db54366375728bd932bff6ef99372` |
| origin/main | `2294a5534c8db54366375728bd932bff6ef99372` (identical) |
| Working tree | Clean (`git status --porcelain` = empty) |
| Lane 1 | EMPTY |
| Lane 2 | EMPTY |
| Lane 3 | DISABLED |
| GOVERNANCE | UNOWNED → acquired transiently for this step → released UNOWNED |
| GATEWAY | UNOWNED (not acquired in this step) |
| MIGRATION | UNOWNED (not acquired in this step) |
| IDENTITY-01 status | REGISTERED / READY / NOT ADMITTED — Step 1 COMPLETE |
| Sidecar occupancy hash | `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` |
| GOV-AUTH-03 dependency | LOCKED ✓ |
| EXEC-01C6A dependency on IDENTITY-01 | Present and unresolved ✓ |

---

## 2. Source Verification Against Approved Design

All design statements in `docs/AGENT-PLATFORM-EXEC-01C-IDENTITY-01-DESIGN.md` independently verified against source at HEAD `2294a5534c`.

### 2.1 Entity — `api-key.entity.ts`

**Verified:** `ApiKey` entity has NO `isInternal` column. Columns: `id`, `hashedKey`, `keyPrefix`, `userId`, `scopes`, `createdAt`, `revokedAt`. Design correctly proposes adding `@Column({ type: 'boolean', default: false, name: 'is_internal' }) isInternal: boolean`.

### 2.2 Service — `api-key.service.ts`

**Verified:** `validateApiKey()` returns `{ userId: string; apiKeyId: string; scopes: string[] } | null`. No `isInternal` in return type. The service queries `this.apiKeyRepository.find({ where: { revokedAt: null } })` — fetches all non-revoked keys, performs bcrypt comparison. No cache. Design correctly proposes adding `isInternal: key.isInternal` to the return.

**Verified:** `createApiKey()` uses explicit literal `this.apiKeyRepository.create({ hashedKey, keyPrefix, userId, scopes, revokedAt: null })` — no `isInternal` parameter. TypeORM column default `false` applies.

**Verified:** `revokeApiKey()` sets only `revokedAt = new Date()` then `save()`. No other field modified.

**Verified:** `listApiKeys()` returns `{ id, keyPrefix, scopes, createdAt, revokedAt, isActive }` — does NOT return `isInternal`. No information leakage.

### 2.3 Guard — `api-key-auth.guard.ts`

**Verified:** DB-key identity construction (lines 78–84):
```typescript
identity = {
  userId: dbIdentity.userId,
  apiKeyId: dbIdentity.apiKeyId,
  scopes: dbIdentity.scopes,
  harnessEntitled: dbIdentity.scopes.includes('ai:harness'),
};
```
No `isInternal` set — always `undefined`. Design correctly proposes adding `isInternal: dbIdentity.isInternal`.

**Verified:** Static fallback fires only when `identity` is `null` after DB attempt (line 92–94). Static config returns complete `ApiKeyIdentity` objects including `isInternal` where configured.

### 2.4 LaunchGuard — `launch.guard.ts`

**Verified:** Line 84: `if (identity.isInternal === true)`. Uses strict equality `=== true`. `undefined` fails. **No change required or proposed by design.** Policy preserved.

### 2.5 ApiKeyIdentity interface — `api-key.config.ts`

**Verified:** `isInternal?: boolean` already exists in the interface (line 18). No interface change needed.

### 2.6 Static key config — `api-key.config.ts`

**Verified:** `test-harness-api-key` has `isInternal: true, harnessEntitled: true`. `test-api-key-user-1` has `isInternal: true`. `test-api-key-user-2` has `isEarlyAccess: true` (no `isInternal`). `valid-api-key` has no flags. **No change proposed.**

### 2.7 Browser session — `session-or-api-key.guard.ts`

**Verified:** Browser session identity hardcodes `isInternal: true` (line 84). `harnessEntitled` derived independently from allow-list. **No change proposed.**

### 2.8 DTO — `api-key.dto.ts`

**Verified:** `CreateApiKeyDto` has only `scopes` decorated with `@IsArray() @ArrayNotEmpty() @IsString({ each: true })`. No `isInternal` field. **No change proposed.**

### 2.9 Validation pipe — `main.ts`

**Verified:** `new ValidationPipe({ whitelist: true, transform: true })` (lines 63–66). `whitelist: true` silently strips undecorated properties. `forbidNonWhitelisted` is NOT configured — unknown fields are stripped, not rejected with 400. This is a pre-existing discrepancy from the smoke spec (which sets `forbidNonWhitelisted: true`). **Not changed by IDENTITY-01.**

### 2.10 Controller — `api-key.controller.ts`

**Verified:** `createApiKey()` calls `this.apiKeyService.createApiKey(userId, createDto.scopes)` — only `scopes` extracted from DTO. `revokeApiKey()` calls `this.apiKeyService.revokeApiKey(id, userId)` — no `isInternal`. **No change proposed.**

### 2.11 Database config — `config/database.config.ts` and `data-source.ts`

**Verified:** Both files set `synchronize: false`. Migrations are the only schema change mechanism.

### 2.12 Independence verification

**Verified:** `harnessEntitled` derived from `scopes.includes('ai:harness')` in the guard (line 83). Completely independent of `isInternal`. Design correctly states both remain independent.

### 2.13 Harness entitlement proof contract

**Verified:** `HARNESS_ENTITLEMENT_PROOF_V1` contract (FROZEN in sidecar) covers `ai-execution.controller.ts`, `job.types.ts`, `worker.processor.ts`. IDENTITY-01 does NOT touch these files. The frozen contract is NOT mutated.

---

## 3. Design Supersession — Migration Runner Commands

**Design §5.6 states:**
```bash
DATABASE_URL=<staging-url> npx typeorm migration:run -d data-source.ts
```

**This is superseded.** Source inspection of `services/api-gateway/package.json` reveals:

| Script | Command | Environment |
|---|---|---|
| `migration:run` | `typeorm-ts-node-commonjs migration:run -d data-source.ts` | Local development (TypeScript source + ts-node) |
| `migration:run:prod` | `typeorm migration:run -d dist/data-source.js` | **Staging/production (compiled JavaScript)** |
| `migration:revert` | `typeorm-ts-node-commonjs migration:revert -d data-source.ts` | Local development |
| `migration:show` | `typeorm-ts-node-commonjs migration:show -d data-source.ts` | Local development |

**Evidence:** Prior Lightsail staging migration execution (documented in `docs/PRIVATE-BETA-STAGING-EXECUTION-04E-MIGRATION-EXECUTION-EVIDENCE-REVIEW.md`) used `npm run migration:run:prod`, producing `MIGRATION_RUN_PROD_EXIT=0`. The migration readiness plan (`docs/PRIVATE-BETA-STAGING-SETUP-08-MIGRATION-READINESS-PLAN.md` §7) explicitly maps:
- `migration:run` → "Local development only (uses ts-node)"
- `migration:run:prod` → "Staging/production (uses compiled dist/)"

**Reason:** `data-source.ts` is TypeScript. Bare `npx typeorm migration:run -d data-source.ts` fails because the `typeorm` CLI does not natively register a TypeScript loader. The `typeorm-ts-node-commonjs` wrapper registers `ts-node` for CommonJS. On staging/production, the compiled `dist/data-source.js` is used instead.

**Additional finding:** `migration:revert:prod` does NOT exist as a package script. The migration readiness plan documents this gap (§7): "Production/Staging Rollback Command: `migration:revert:prod` — NOT FOUND." Staging revert requires either direct command execution or backup restoration.

**Corrected staging commands (frozen):**

| Operation | Command | Notes |
|---|---|---|
| Show pending | `DATABASE_URL=<url> npm run migration:show` or `npx typeorm migration:show -d dist/data-source.js` | Non-destructive; verify pending set before apply |
| Apply | `DATABASE_URL=<url> npm run migration:run:prod` | Requires current `dist/` build; equivalent to `typeorm migration:run -d dist/data-source.js` |
| Revert | `DATABASE_URL=<url> npx typeorm migration:revert -d dist/data-source.js` | No npm script exists; requires `dist/` build; or restore from pre-migration snapshot |

---

## 4. Frozen Implementation Scope

### 4.1 Corrected prospective write set (7 files)

The design §6.1 lists 6 files. Source inspection confirms the controller spec (`api-key.controller.spec.ts`) requires a prospective test for DTO whitelist stripping (design §7.3 criterion S1). The corrected write set is 7 files.

| # | File | Change |
|---|---|---|
| 1 | `services/api-gateway/src/entities/api-key.entity.ts` | Add `isInternal` boolean column (`is_internal`, default false) |
| 2 | `services/api-gateway/src/auth/api-key.service.ts` | Return `isInternal` from `validateApiKey()` |
| 3 | `services/api-gateway/src/auth/api-key-auth.guard.ts` | Propagate `isInternal` from DB result to identity |
| 4 | `services/api-gateway/src/migrations/1773000000000-AddInternalAccessToApiKeys.ts` | New migration: `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN NOT NULL DEFAULT FALSE` |
| 5 | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | Tests: L4 (internal=true propagation), L5 (internal=false propagation), H1 (internal≠entitled), H2 (entitled≠internal) |
| 6 | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | Tests: D1 (create default false), D2 (validate returns isInternal), S4 (revoke doesn't change isInternal) |
| 7 | `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` | Test: S1 (DTO whitelist strips isInternal from create request) |

### 4.2 Migration filename verification

- **Proposed:** `1773000000000-AddInternalAccessToApiKeys.ts`
- **Latest existing:** `1772900000000-AddAdminGrantAuditColumns.ts`
- **Timestamp `1773000000000`:** Unique, correctly ordered after `1772900000000`. No collision among 29 existing migrations. ✓
- **Convention compliance:** Follows raw-SQL pattern with `IF NOT EXISTS`/`IF EXISTS` guards, consistent with `1772900000000-AddAdminGrantAuditColumns.ts`.

### 4.3 Files NOT changed (preserved)

| File | Reason |
|---|---|
| `services/api-gateway/src/auth/api-key.config.ts` | Static keys unchanged; `ApiKeyIdentity` interface already has `isInternal?: boolean` |
| `services/api-gateway/src/auth/session-or-api-key.guard.ts` | Browser session hardcode unchanged |
| `services/api-gateway/src/launch/launch.guard.ts` | Policy unchanged; continues `isInternal === true` check |
| `services/api-gateway/src/auth/dto/api-key.dto.ts` | No `isInternal` in DTO by design |
| `services/api-gateway/src/auth/api-key.controller.ts` | No `isInternal` in create/revoke |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Not in scope; HARNESS_ENTITLEMENT_PROOF_V1 FROZEN |
| `services/ai-service/**` | Not in scope |
| `frontend/**` | Not in scope |

### 4.4 Decomposition assessment

7 files. Single entity column addition, single service return modification, single guard propagation, single migration, and 3 test files with bounded additions. **No child-slice decomposition required.** The scope is a single bounded implementation step.

---

## 5. Frozen Security Acceptance Criteria

### 5.1 Existing/new ordinary keys remain non-internal

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| D1 | `createApiKey()` produces `isInternal=false` | ⊕ Prospective: `api-key.service.spec.ts` — assert `repository.create()` literal excludes `isInternal`; entity column default `false` applies | Mocked unit test; proves service logic |
| D2 | `validateApiKey()` returns `isInternal: false` for non-internal key | ⊕ Prospective: `api-key.service.spec.ts` — mock entity with `isInternal: false`, assert return value | Mocked unit test; proves service return type |
| D3 | Migration applies `DEFAULT FALSE` to all existing rows | Staging integration: operator SQL verification after migration | LIVE-ONLY; unverified in this step |
| S3 | Service passes explicit literal without `isInternal` to `repository.create()` | ✓ Existing: `api-key.service.spec.ts` — verifies `create({ hashedKey, keyPrefix, userId, scopes, revokedAt: null })` | Mocked unit test; proves no `isInternal` in create literal |

### 5.2 Production whitelist stripping — not rejection

`ValidationPipe({ whitelist: true })` **silently strips** undecorated properties. It does not reject with 400. `forbidNonWhitelisted` is NOT configured in production `main.ts`. An attacker sending `{ scopes: [...], isInternal: true }` would have `isInternal` silently removed. The DTO whitelist is a defense-in-depth layer, not the primary protection.

The primary self-promotion protection chain is:
1. Controller extracts only `createDto.scopes` (never reads `isInternal` from DTO)
2. Service receives only `(userId, scopes)` — no `isInternal` parameter
3. Service passes explicit literal to `repository.create()` — no `isInternal` key
4. Entity column default `false` applies via TypeORM

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| S1 | DTO whitelist strips `isInternal` | ⊕ Prospective: `api-key.controller.spec.ts` — test with validation pipe or DTO validation | Defense-in-depth; mocked test proves pipe behavior |
| S2 | Controller extracts only `scopes` | ✓ Existing: `api-key.controller.spec.ts` — verifies `service.createApiKey(userId, createDto.scopes)` | Mocked unit test; proves controller call signature |

**Limitation:** S1 and S2 are isolated mocked tests. They do not prove the full guard chain end-to-end. The self-promotion protection is structurally assured by the code architecture (controller/service/repository chain never reads `isInternal` from user input), not solely by individual test assertions.

### 5.3 Internal access does not imply Harness entitlement, or vice versa

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| H1 | `isInternal=true` without `ai:harness` → `harnessEntitled: false` | ⊕ Prospective: `api-key-auth.guard.spec.ts` — mock returns `isInternal: true`, scopes `['ai:execute']`; verify `harnessEntitled: false` | Mocked unit test |
| H2 | `ai:harness` scope with `isInternal=false` → `harnessEntitled: true`, `isInternal: false` | ⊕ Prospective: `api-key-auth.guard.spec.ts` — mock returns `isInternal: false`, scopes include `ai:harness` | Mocked unit test |
| H3 | Browser session `isInternal: true` ≠ `harnessEntitled` | ✓ Existing: `session-or-api-key.guard.spec.ts` — "does not treat isInternal true as Harness entitlement" | Mocked unit test |

### 5.4 Foreign-owned sessions and agents remain rejected

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| F1 | Session ownership: `session.userId !== identity.userId` → NotFoundException | ✓ Existing: `ai-execution.controller.spec.ts` — AGENT-HARNESS-05C5 tests | Mocked unit test; unchanged by IDENTITY-01 |
| F2 | Execution result ownership | ✓ Existing: `ai-execution.controller.spec.ts` — ownership checks on getExecutionResult/triggerBuildApply | Mocked unit test |
| F3 | Key ownership on revoke | ✓ Existing: `api-key.service.spec.ts` — "should throw ForbiddenException when user does not own the key" | Mocked unit test |

`isInternal=true` does NOT bypass UUID ownership checks. These existing tests confirm the invariant. If implementation inadvertently couples `isInternal` to ownership, the existing tests would regress — verify during implementation review.

### 5.5 Revoked/expired keys cannot regain access

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| R1 | Revoked keys excluded from `validateApiKey()` | ✓ Existing: `api-key.service.spec.ts` — "should return null for revoked API key" | Mocked unit test; query uses `where: { revokedAt: null }` |
| R2 | Invalid/unmatched key → `null` → static fallback or 403 | ✓ Existing: `api-key-auth.guard.spec.ts` — "should throw ForbiddenException when API key is invalid" | Mocked unit test |
| R3 | Revocation effect immediate (no cache) | Design verification: `validateApiKey()` queries DB on every call; no cache layer | Code inspection; no runtime verification |

### 5.6 Revoking internal access — effect timing

**Verified:** `validateApiKey()` performs a fresh `this.apiKeyRepository.find({ where: { revokedAt: null } })` on every request. No in-memory cache, no Redis cache, no TTL. Setting `is_internal = FALSE` via the operator revoke procedure takes effect on the very next API call that validates that key.

| # | Requirement | Evidence | Coverage |
|---|---|---|---|
| R4 | Operator revoke procedure sets `is_internal = FALSE` | Staging integration: operator SQL execution with audit | LIVE-ONLY; unverified in this step |

### 5.7 Authentication precedence and fallback preserved

**Verified:** Priority order remains:
1. DB key found → identity includes `isInternal` from DB column (new behavior)
2. DB not found / DB error → static config → `isInternal` from static map (unchanged)
3. Neither → `ForbiddenException` (unchanged)

Existing test coverage: `api-key-auth.guard.spec.ts` tests "should fallback to static config when database validation fails" and "should handle database errors gracefully and fallback to static config". These prove the precedence chain.

**Regression risk:** If a key exists in BOTH DB (with `isInternal=false`) and static config (with `isInternal=true`), the DB path wins. This is correct (DB is authoritative) but could affect static test keys if inadvertently also present in the DB.

---

## 6. Operator Grant/Revoke Verification

### 6.1 Grant procedure analysis

The design §4.1 grant SQL includes:
- **Transactional:** `BEGIN` / `COMMIT` wrapper
- **Targeting:** `WHERE id = '<key-uuid>' AND user_id = '<user-uuid>'` — both key UUID and owner UUID required
- **Validity predicate:** `AND revoked_at IS NULL` in Step 1 SELECT — operator must STOP if key is revoked
- **Affected-row precision:** `AND is_internal = FALSE` in UPDATE — ensures exactly 1 row for a valid non-internal key
- **Prior/new state capture:** Step 1 SELECT before UPDATE; Step 3 SELECT after
- **Audit requirements:** Key UUID, key_prefix, user_id, prior/new value, timestamp, operator, authorization, reason — no key material

### 6.2 Zero-row result disambiguation

If the UPDATE in Step 2 affects 0 rows, the operator must cross-reference the Step 1 SELECT result:

| Step 1 result | Step 2 = 0 rows | Meaning | Action |
|---|---|---|---|
| 0 rows from Step 1 SELECT | N/A (operator should have STOPPED) | Key not found or user mismatch — **wrong identity** | Verify key UUID and user UUID; do not proceed |
| `revoked_at IS NOT NULL` | N/A (operator should have STOPPED) | Key is revoked — **invalid key state** | Do not grant internal access to revoked keys |
| `is_internal = TRUE` | 0 rows (expected) | Key already internal — **idempotent no-op** | Record in audit: "no-op grant; prior value already TRUE" |
| `is_internal = FALSE`, `revoked_at IS NULL` | 0 rows (unexpected) | **Concurrent change** — another operator or process modified the key between Step 1 and Step 2 | Re-execute Step 1 SELECT; assess new state; do not blindly retry |

The design's two-step pattern (SELECT then UPDATE within a transaction) provides diagnostic capability. The `AND is_internal = FALSE` predicate in the UPDATE separates "already in desired state" from "concurrent modification or identity error" when combined with the Step 1 result.

### 6.3 Revoke procedure analysis

The design §4.2 revoke SQL:
- **Targeting:** Same `WHERE id AND user_id` targeting
- **`revoked_at` guard intentionally omitted:** Operator may clean `is_internal` on revoked keys for hygiene
- **Affected-row precision:** `AND is_internal = TRUE` — ensures exactly 1 row for a valid internal key
- **Same zero-row disambiguation logic applies** (reference Step 1 SELECT)

### 6.4 Broad UPDATE protection

Both procedures require `WHERE id = '<key-uuid>' AND user_id = '<user-uuid>'`. A broad `UPDATE api_keys SET is_internal = TRUE` without qualified targeting is forbidden. The `AND user_id` clause prevents mass promotion even if an operator mistakenly omits the `AND id` clause.

---

## 7. Frozen Migration Runner and Rollout/Rollback Sequence

### 7.1 Deployment order (mandatory)

**Phase 1 — Migration first (application remains on old code):**

1. Build the API Gateway: `npm run build` (produces `dist/` including `dist/data-source.js` and compiled migrations)
2. Inspect pending migrations (non-destructive):
   ```bash
   DATABASE_URL=<staging-url> npx typeorm migration:show -d dist/data-source.js
   ```
   Verify that `AddInternalAccessToApiKeys1773000000000` appears as pending `[ ]`. Do NOT silently run unrelated pending migrations — if others appear, assess and approve them separately.
3. Apply the migration:
   ```bash
   DATABASE_URL=<staging-url> npm run migration:run:prod
   ```
4. Verify column exists:
   ```sql
   SELECT column_name, data_type, column_default, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'api_keys' AND column_name = 'is_internal';
   ```
   Expected: `is_internal | boolean | false | NO`
5. Verify old application still functions — DB-key authentication, key creation, key listing work without errors (TypeORM ignores unmapped columns in the database)

**Phase 2 — Application code deployment:**

6. Deploy updated application code (entity + service + guard changes)
7. Verify updated application — DB-key validation now includes `isInternal: false` for all existing keys

### 7.2 Rollback sequence (mandatory order)

**Phase 1 — Application code rollback first:**

1. Restore application code to the version without `isInternal` entity mapping
2. Verify application functions with the extra column still present (TypeORM ignores unmapped columns)

**Phase 2 — Migration revert (only if column removal is required):**

3. Verify `AddInternalAccessToApiKeys1773000000000` is the most recently applied migration. If subsequent migrations were applied, those must be reverted first (TypeORM reverts the last-applied migration only).
4. Run revert:
   ```bash
   DATABASE_URL=<staging-url> npx typeorm migration:revert -d dist/data-source.js
   ```
   Note: No `migration:revert:prod` npm script exists; this uses a direct `npx` command with the compiled data source.
5. **Loss acknowledgment:** Dropping `is_internal` permanently loses all internal-access metadata (which keys were granted). This is metadata loss. Operational revocation of specific keys should use the operator revoke procedure (§6.3 above), not migration rollback. Migration rollback is a schema emergency measure.
6. Verify no application processes still reference the dropped column.

### 7.3 Live-only facts (unverified in this step)

| Fact | Status | Verification needed |
|---|---|---|
| Current `api_keys` table state on staging | UNVERIFIED | SSH + SQL query before migration |
| Number of applied migrations on staging | UNVERIFIED | `migration:show` before apply |
| `dist/` build freshness on staging | UNVERIFIED | Build step before migration |
| `ts-node` availability on staging | UNVERIFIED | Not needed for `migration:run:prod` (uses compiled JS) |
| Pre-migration snapshot availability | UNVERIFIED | Lightsail console before migration |

---

## 8. Validation Environment and Execution Boundary

### 8.0 Evidence class versus execution venue

`evidenceClass=LOCAL-TESTS` is sidecar schema metadata — it classifies the *grade* of evidence required (unit/integration tests, as distinct from LOCAL-RUNTIME, STAGING-RUNTIME, or PROVIDER-LIVE). It is not a physical venue authorization. The validator uses it for pairwise conflict and runtime-need checks, not to determine where commands execute.

Keith's standing instruction: application testing takes place on AWS Lightsail. `evidenceClass=LOCAL-TESTS` does not authorize workstation execution of `npm test` or `npm run build`.

### 8.1 Authorization decomposition

Source implementation, remote test/build verification, live application deployment, migration execution, and key promotion are distinct authorization boundaries:

| Operation | Authorization | Mutexes | Status | Notes |
|---|---|---|---|---|
| **Source implementation** (Step 3) | Keith implementation authorization | GATEWAY, MIGRATION | NOT AUTHORIZED; not acquired | Write 7 files to repository; no runtime permission |
| **Remote test/build verification** (Step 3 validation) | Separate STAGING authorization | STAGING | NOT AUTHORIZED; PENDING PROCEDURE | Requires STAGING lease, revision delivery procedure, and Lightsail access; see §8.2 |
| **Staging deployment** (Step 4) | Separate STAGING authorization | STAGING | NOT AUTHORIZED | Deploy updated application code to running service |
| **Schema migration execution** (Step 4) | Separate STAGING authorization + migration confirmation | STAGING, MIGRATION | NOT AUTHORIZED | Mandatory migration-first; pre-migration snapshot required |
| **Operator privilege grant/revoke** | Separate Keith authorization per key | STAGING | NOT AUTHORIZED | Staging DB access only; not a credit/balance mutation |

**Source implementation is separable.** IDENTITY-01's `runtimeNeeds=[]` and `evidenceClass=LOCAL-TESTS` (schema grade, not venue). The scheduler does not require staging authorization before admitting the task for source implementation. Source implementation (writing the 7 files) can be authorized and admitted with GATEWAY + MIGRATION — no STAGING lease, no runtime permission. Remote test/build verification and all Step 4 operations require separate STAGING authorization as later gates. STAGING is not declared in the task's admission mutexes; it is acquired when Keith authorizes remote validation or staging operations.

**CREDIT is not required for operator privilege grants.** CLAUDE.md defines CREDIT as "Intentional credit / balance / accounting state mutation or evidence-sensitive credit validation." Setting `api_keys.is_internal` is an API-key metadata change — it does not mutate credit balances, credit grants, credit deductions, or accounting state. STAGING suffices (staging DB access for the SQL procedure). CREDIT is required by EXEC-01C6A's canary execution (which may involve credit-relevant provider calls), not by IDENTITY-01's privilege operation.

### 8.2 Smallest meaningful later validation sequence

**Remote validation status: PENDING PROCEDURE/AUTHORIZATION.**

Test execution requires delivering the implementation revision to Lightsail and running tests there without activating updated application code before its migration. The revision delivery procedure and STAGING lease have not been authorized. This does not prevent source implementation, but it prevents claiming validation complete or locking the task.

#### 8.2.1 Jest suite analysis

`npm test` (= `jest`, no arguments) runs ALL 167 `.spec.ts` files in `src/` (per `testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'`). No `pretest` / `posttest` lifecycle scripts. No `globalSetup` / `globalTeardown` / `setupFiles` in `jest.config.js`.

The suite contains tests that access a real database:

| Test file | DB/network access | Gated? |
|---|---|---|
| `src/__tests__/smoke.integration.spec.ts` | **YES** — boots full NestJS app via `AppModule`, connects to PostgreSQL (`DataSource`), runs HTTP requests via supertest; requires running PostgreSQL, migrated database, valid API key, provider key | **NOT gated** — runs unconditionally |
| `src/billing/credit-deduction/__tests__/credit-deduction-concurrency.integration.spec.ts` | YES — real `DataSource` and PostgreSQL | Skipped unless `RUN_CREDIT_DB_INTEGRATION=true`; safe when env var is absent |
| All other `.spec.ts` (165 files) | No — mocked unit tests | N/A |

**Blanket `npm test` is not safe for isolated validation on Lightsail** — `smoke.integration.spec.ts` would connect to the staging database, bootstrap `AppModule` (which initializes TypeORM and may trigger schema sync or connection pool activity), and run HTTP requests.

**Focused command for IDENTITY-01 validation (frozen):**

```bash
npx jest --testPathPattern "(api-key|launch\.guard|session-or-api-key\.guard|ai-execution\.controller)\.spec"
```

This runs ONLY the IDENTITY-01-relevant test files and their regression surface:

| File | Tests | DB/network |
|---|---|---|
| `auth/__tests__/api-key-auth.guard.spec.ts` | L4, L5, H1, H2, R2 | None (mocked) |
| `auth/__tests__/api-key.service.spec.ts` | D1, D2, S4, R1, S3 | None (mocked) |
| `auth/__tests__/api-key.controller.spec.ts` | S1, S2 | None (mocked) |
| `launch/__tests__/launch.guard.spec.ts` | L1, L2, L3 | None (mocked) |
| `auth/__tests__/session-or-api-key.guard.spec.ts` | H3 | None (mocked) |
| `ai/ai-execution.controller.spec.ts` | F1, F2 | None (mocked) |

All matched files are mocked unit tests. None connect to a database, make network requests, or produce file-system side effects.

**Not run** (excluded by pattern): `smoke.integration.spec.ts`, `credit-deduction-concurrency.integration.spec.ts`, all other unrelated spec files.

#### 8.2.2 TypeScript compilation verification

`tsconfig.json` specifies `"incremental": true` (TypeScript `^5.3.3`). Incremental compilation produces build metadata:

| Command | Writes | Safe in-place? |
|---|---|---|
| `npx tsc --noEmit` | `./dist/tsconfig.tsbuildinfo` (build metadata in the running app's `dist/`) | **NO** — writes to live `dist/` directory |
| `npx tsc --noEmit --incremental false` | Nothing | **YES** — suppresses `.tsbuildinfo` generation; fully write-free |
| `npm run build` (= `tsc`) | Full `./dist/` including compiled JS | **NO** — overwrites running application; deferred to Step 4 deployment |

`*.tsbuildinfo` is git-ignored (root `.gitignore`), but on Lightsail it would still write to the live `dist/` directory.

`tsconfig.json` `exclude` omits `src/**/*.spec.ts` and `src/**/*.test.ts`. Type-checking covers production source only; test file compilation is verified separately by ts-jest during the focused jest run.

**Focused command for IDENTITY-01 compilation verification (frozen):**

```bash
npx tsc --noEmit --incremental false
```

#### 8.2.3 Revision delivery to Lightsail

The implementation revision must reach Lightsail for validation. The established live path is `/opt/aisandbox/` (a Git checkout used by the running application). No separate test directory convention exists.

**Constraint:** Updating the live checkout with `git pull` modifies source files in the running application's directory. The running application uses compiled `dist/` (started by PM2 from `dist/main.js`), not source files. However, this is not isolated test preparation — the live checkout is modified. Any subsequent `npm run build` or service restart would activate the updated entity mapping (which references `is_internal`), causing PostgreSQL errors if the migration has not yet been applied.

**Assessed options:**

| Option | Isolation | Setup cost | Status |
|---|---|---|---|
| **A. Separate clone** (e.g., `/opt/aisandbox-test/`) | Full isolation — separate directory, separate `dist/` | Requires `git clone`, `cd services/api-gateway && npm install`; no established convention | UNRESOLVED |
| **B. Git worktree** | Source isolation; shares `.git` | Requires `node_modules` symlink or separate `npm install` | UNRESOLVED |
| **C. Test in live checkout after `git pull`, before `npm run build`** | Source files updated; `dist/` untouched if no build is run | Minimal — `git pull` only; ts-jest compiles from source in-memory; `tsc --noEmit --incremental false` writes nothing; PM2 does not auto-restart on source changes | REQUIRES KEITH AUTHORIZATION — modifies live checkout |

For option C: the focused jest command and `tsc --noEmit --incremental false` are source-only operations. They do not touch `dist/`, the database, or the running application process. The risk is operational — the live checkout contains updated source, and an uncoordinated `npm run build` or restart would activate code before migration.

**Current status: PENDING PROCEDURE/AUTHORIZATION.** No option has been selected or authorized. Source implementation can proceed independently.

#### 8.2.4 Validation sequence (when remote validation is authorized)

**Step 3 validation (requires STAGING authorization and revision delivery procedure):**

1. Deliver implementation revision to Lightsail via authorized procedure (§8.2.3)
2. Focused jest: `npx jest --testPathPattern "(api-key|launch\.guard|session-or-api-key\.guard|ai-execution\.controller)\.spec"`
3. Focused type-check: `npx tsc --noEmit --incremental false`
4. All IDENTITY-01 tests (D1, D2, S1–S4, L4, L5, H1, H2) pass; all regression tests (L1–L3, H3, F1–F3, R1, R2, S2, S3) pass

**After migration (Step 4) — STAGING-RUNTIME on Lightsail:**

1. Pre-migration snapshot of Lightsail instance (mandatory gate)
2. `migration:show` — verify pending set (only `AddInternalAccessToApiKeys1773000000000`)
3. `migration:run:prod` — apply migration
4. Column verification SQL — confirm `is_internal` exists with correct type/default
5. Old application compatibility — verify existing DB-key authentication unaffected
6. Updated application deployment — verify `isInternal: false` propagated
7. Operator grant of `is_internal = TRUE` on a specific test key (separate Keith authorization)
8. Verify granted key passes LaunchGuard in INTERNAL state
9. Operator revoke — verify revoked key no longer passes LaunchGuard
10. Cleanup: revoke test key or remove internal status

### 8.3 Required staging data/setup

- An active (non-revoked) DB API key on staging for testing internal-access grant
- Keith authorization for the specific key grant
- Pre-migration Lightsail snapshot

### 8.4 Cleanup

- After validation: revoke internal access from any test keys granted during validation
- Do NOT grant internal access to existing user keys for convenience testing — use a purpose-created test key or the specific canary key

### 8.5 Unrelated records

Do NOT touch unrelated `api_keys` rows. The migration applies `DEFAULT FALSE` globally (no selective backfill). The operator grant/revoke targets individual keys by UUID.

---

## 9. Authorization and Admission State

```
IMPLEMENTATION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
MIGRATION_EXECUTION_AUTHORIZED=NO
PRIVILEGE_GRANT_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
TESTS_EXECUTED=NO
REMOTE_VALIDATION_PROCEDURE=PENDING
REVISION_DELIVERY_METHOD=UNRESOLVED
APPLICATION_SOURCE_CHANGED=NO
IDENTITY_01_ADMITTED=NO
IDENTITY_01_LANE=NONE
GATEWAY_ACQUIRED=NO
MIGRATION_ACQUIRED=NO
STAGING_ACQUIRED=NO
EXEC_01C6A_DEPENDENCY_RESOLVED=NO
```

IDENTITY-01 remains REGISTERED / READY / NOT ADMITTED. Step 2 (this stage-start) is COMPLETE. Steps 3–4 remain NOT AUTHORIZED. Neither implementation lane is occupied. No implementation mutexes are acquired. Remote validation procedure is PENDING — source implementation can proceed but validation and lock require STAGING authorization and a resolved revision delivery method.

EXEC-01C6A remains dependent on IDENTITY-01 completion. Its separate canary blockers (STAGING, CREDIT authorization; ENV assessment) remain unresolved.

---

## 10. Activity Ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, product implementation=0, frontend implementation=0, backend implementation=0, application source=0, local application tests=0, tests executed=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, sidecar edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, UI=0, browser=0.

Governance writes: this stage-start document, TASKS.md (board fields for IDENTITY-01 step status and governance line), TASKS_BACKLOG_FULL.md (IDENTITY-01 body status and step 2 AC).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Product-visible Harness:** Remains FUTURE / GATED / DISABLED / UNAVAILABLE.
