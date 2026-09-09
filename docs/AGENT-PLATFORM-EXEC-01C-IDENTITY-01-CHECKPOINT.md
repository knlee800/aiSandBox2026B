# AGENT-PLATFORM-EXEC-01C-IDENTITY-01 — Consolidation Checkpoint

**Task ID:** AGENT-PLATFORM-EXEC-01C-IDENTITY-01
**Title:** DB API-key internal-access capability for Gateway-ingress Harness canaries
**Step:** 4 — Independent Consolidation / Checkpoint / Lock
**Date:** 2026-09-09
**Verdict:** COMPLETE AND LOCKED — PASS — defined scope
**Implementation commit:** `ad6bf88b452080bda6185a852af29d950e0f5918`
**Subsequent compatible correction:** KEY-REVOKE-01 `409dff579f50176e6495b77cc6771c60c925ec13`
**Independent review verdict:** PASS
**Nature:** HIGH-RISK 4-step IMPLEMENTATION — authentication / migration / security
**Consolidation baseline:** `98cee6873c2fcf85cfda5392417cde91fb8d4ca8`

---

## 1. Final verdict

AGENT-PLATFORM-EXEC-01C-IDENTITY-01 is COMPLETE AND LOCKED for its **defined scope**: entity column, service propagation, guard propagation, migration authoring and staging apply, and unit/integration test evidence.

Staging `aisandbox` now has the `is_internal` column on `public.api_keys` (boolean, NOT NULL, default false) from `AddInternalAccessToApiKeys1773000000000`. Source code at HEAD correctly propagates `isInternal` through the `ApiKeyService.validateApiKey` → `ApiKeyAuthGuard` → `ApiKeyIdentity` chain. The KEY-REVOKE-01 `IsNull()` correction coexists with the `isInternal` propagation.

This LOCK does **not** deploy application code, restart services, grant internal-access privileges to any key, or prove the full deployed guard-chain end-to-end. Running staging remains on old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b`. The column exists but the current deployed application does not reference it.

---

## 2. Scope and exact seven-file implementation set

| # | File | Role |
|---|---|---|
| 1 | `services/api-gateway/src/entities/api-key.entity.ts` | `isInternal` boolean column (`is_internal`, default false) |
| 2 | `services/api-gateway/src/auth/api-key.service.ts` | `validateApiKey` returns `isInternal` from DB |
| 3 | `services/api-gateway/src/auth/api-key-auth.guard.ts` | Propagates `isInternal` from DB result to `ApiKeyIdentity` |
| 4 | `services/api-gateway/src/migrations/1773000000000-AddInternalAccessToApiKeys.ts` | `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN NOT NULL DEFAULT FALSE` |
| 5 | `services/api-gateway/src/auth/__tests__/api-key-auth.guard.spec.ts` | Tests: L4 (internal=true propagation), L5 (internal=false propagation), H1 (internal≠entitled), H2 (entitled≠internal) |
| 6 | `services/api-gateway/src/auth/__tests__/api-key.service.spec.ts` | Tests: D1 (create default false), D2 (validate returns isInternal), S4 (revoke doesn't change isInternal) |
| 7 | `services/api-gateway/src/auth/__tests__/api-key.controller.spec.ts` | Test: S1 (DTO whitelist strips isInternal from create request) |

Control-plane / evidence (not production source):

- `docs/AGENT-PLATFORM-EXEC-01C-IDENTITY-01-DESIGN.md`
- `docs/AGENT-PLATFORM-EXEC-01C-IDENTITY-01-STAGE-START.md`
- `docs/AGENT-PLATFORM-EXEC-01C-IDENTITY-01-CHECKPOINT.md` (this file)
- `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`

**Not modified by this consolidation:** SCHEMA-01 files, KEY-REVOKE-01 checkpoint, `LaunchGuard`, `session-or-api-key.guard.ts`, `api-key.config.ts`, `api-key.controller.ts`, `api-key.dto.ts`, `ai-execution.controller.ts`, ai-service, container-manager, frontend, frozen `HARNESS_ENTITLEMENT_PROOF_V1` contract.

---

## 3. Reviewed revisions

| Item | Revision |
|---|---|
| Consolidation baseline (HEAD) | `98cee6873c2fcf85cfda5392417cde91fb8d4ca8` |
| IDENTITY-01 implementation commit | `ad6bf88b452080bda6185a852af29d950e0f5918` |
| KEY-REVOKE-01 compatible correction | `409dff579f50176e6495b77cc6771c60c925ec13` |
| Migration blob SHA1 | `067490d1fa60fed8dae951de69f4b3dd3fa804b6` |
| Unchanged old application revision on staging | `b6b94516aff9981101ae8815aec2e2d36b8b231b` |

### Subsequent compatible correction (KEY-REVOKE-01)

KEY-REVOKE-01 modified two files in IDENTITY-01's write set:

- `api-key.service.ts`: Changed `where: { revokedAt: null }` → `where: { revokedAt: IsNull() }` in `validateApiKey`. Added `IsNull` import. IDENTITY-01's `isInternal: key.isInternal` propagation at line 174 is **preserved**. Both corrections coexist.
- `api-key.service.spec.ts`: Added `IsNull` import and `expect(mockRepository.find).toHaveBeenCalledWith({ where: { revokedAt: IsNull() } })` assertions to three validation tests. IDENTITY-01's D1/D2/S4 test additions are **preserved**.

The remaining five IDENTITY-01 files (`api-key.entity.ts`, `api-key-auth.guard.ts`, `1773000000000-AddInternalAccessToApiKeys.ts`, `api-key-auth.guard.spec.ts`, `api-key.controller.spec.ts`) are **unchanged** between `ad6bf88b` and HEAD.

Working tree at consolidation open: CLEAN relative to `98cee687`.

---

## 4. Independent evidence assessment

### 4.1 Isolated Lightsail test evidence (2026-09-07)

| Gate | Result | Provenance |
|---|---|---|
| Focused Jest (six suites) | **197/197 PASS** | Isolated copy `/tmp/aisb-identity-01-qLvb7h/src`; `--runTestsByPath` six files; no DB, no network |
| TypeScript compilation | **PASS** — `tsc --noEmit --incremental false` | Write-free; no `dist/` artifact |
| Prospective tests authored | **D1, D2, S1, S4, L4, L5, H1, H2 — all PASS** | Mocked unit tests |
| Pre-existing regression tests | **L1, L2, L3, H3, F1, F2, F3, R1, R2, S2, S3 — all PASS** | Unchanged by IDENTITY-01 |
| Live checkout | **Unchanged** `b6b94516aff9981101ae8815aec2e2d36b8b231b` dirty=0 | Isolated copy method |

Test suites run:
1. `api-key-auth.guard.spec.ts` — L4, L5, H1, H2, R2
2. `api-key.service.spec.ts` — D1, D2, S4, R1, S3
3. `api-key.controller.spec.ts` — S1, S2
4. `launch.guard.spec.ts` — L1, L2, L3
5. `session-or-api-key.guard.spec.ts` — H3
6. `ai-execution.controller.spec.ts` — F1, F2

### 4.2 Staging migration apply evidence (2026-09-09)

Evidence directory: `C:\Users\knlee\AppData\Local\Temp\aisb-identity-01-apply-evidence-20260909-103320`

| Gate | Result | Provenance |
|---|---|---|
| Preflight: `api_keys` present, `is_internal` absent | **PASS** | `preflight-typeorm.json` — cols before: `id,hashed_key,key_prefix,user_id,scopes,created_at,revoked_at` |
| Preflight: SCHEMA-01 in history, IDENTITY-01 not | **PASS** | `preflight-typeorm-before-apply.json` — history n=30; pending `["AddInternalAccessToApiKeys1773000000000"]` only |
| Preflight: runner database is `aisandbox` | **PASS** | `runner_db_is_aisandbox` |
| Preflight: unqualified `api_keys` resolves to `public` | **PASS** | `runner_unqualified_api_keys_is_public` |
| Apply: restricted loader exactly IDENTITY-01 | **PASS** | `pre_apply_loaded_exactly_identity01` / `pre_apply_pending_exactly_identity01` |
| Apply: migration executed | **PASS** | `identity01_runMigrations` applied `AddInternalAccessToApiKeys1773000000000`; `transaction=committed_via_typeorm_each` |
| Post-apply: column `is_internal` exists | **PASS** | `is_internal_exists` — cols: `id,hashed_key,key_prefix,user_id,scopes,created_at,revoked_at,is_internal` |
| Post-apply: column type/default/nullable | **PASS** | `is_internal_boolean_not_null_default_false` — `boolean`, `column_default=false`, `is_nullable=NO` |
| Post-apply: exactly one new history entry | **PASS** | `exactly_one_new_history_entry_identity01` — before=30, after=31 |
| Post-apply: unrestricted pending empty | **PASS** | `unrestricted_pending_empty_after_apply` — `[]` |
| Post-apply: aggregate rows | **PASS** | `no_null_or_true_internal_status` — `n=0, null_n=0, true_n=0, false_n=0` |
| Post-apply: base-table constraints/indexes intact | **PASS** | `fk_to_public_users_id_cascade`, `uuid_primary_key_id`, `expected_indexes` — PK, FK to `users(id) ON DELETE CASCADE`, `idx_api_key_hashed`, `idx_api_key_user_id` |
| Cleanup: host temp removed | **PASS** | `/tmp/aisb-identity-01-apply-PCJwSD` removed |
| Health: all 200 | **PASS** | `api_gateway_health`, `api_gateway_health_db`, `api_gateway_health_ready`, `container_manager_health` all 200 |

**Aggregate rows n=0:** This proves no existing-key promotion occurred. The table had zero rows at apply time. This is not a nonempty-data backfill test. Disposable PostgreSQL rehearsal (via SCHEMA-01) established column default-false behavior on non-empty tables.

### 4.3 Snapshot evidence (2026-09-09)

| Item | Detail |
|---|---|
| Snapshot name | `aisandbox-staging-pre-identity01-20260909` |
| Creation time | 2026-09-09 10:41 UTC+8 (from supplied screenshot) |
| Keith Available attestation | 2026-09-09 10:46 UTC+8 |
| Independent AWS CLI time verification | Unavailable (aws CLI absent locally and remotely) |
| Older snapshot retained | `aisandbox-staging-pre-schema01-20260908` |
| Neither snapshot deleted nor restored | ✓ |

### 4.4 Disposable PostgreSQL rehearsal evidence

Per SCHEMA-01 checkpoint, disposable database `aisb_schema01_rehearsal_55aaae2a2b56` was created/rehearsed/dropped on PostgreSQL 15.18 / TypeORM 0.3.28. This rehearsal established that `NOT NULL DEFAULT FALSE` applies correctly during `ALTER TABLE ADD COLUMN`. Migration ordering (SCHEMA-01 timestamp `1772950000000` < IDENTITY-01 timestamp `1773000000000`) was proven. The disposable db was dropped and the live checkout remained unchanged.

### 4.5 KEY-REVOKE-01 evidence (compatibility)

Per KEY-REVOKE-01 checkpoint (`docs/AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01-CHECKPOINT.md`):
- 19/19 unit tests + 1/1 PostgreSQL regression PASS on isolated Lightsail copy
- `IsNull()` predicate correctly filters revoked keys
- `isInternal: key.isInternal` propagation preserved in KEY-REVOKE-01's D1/D2/S4 and PG identity tests (`isInternal: false`)

---

## 5. Acceptance-criterion evidence map

### 5.1 Default-false behavior

| AC | Evidence | Verdict |
|---|---|---|
| D1 — `createApiKey()` produces `isInternal=false` | `api-key.service.spec.ts` asserts `repository.create()` literal excludes `isInternal`; entity column default `false` applies | **PASS** |
| D2 — `validateApiKey()` returns `isInternal: false` for non-internal key | `api-key.service.spec.ts` mock entity `isInternal: false` → return value asserted | **PASS** |
| D3 — migration applies `DEFAULT FALSE` to all existing rows | Staging apply: `is_internal_boolean_not_null_default_false` — boolean, NOT NULL, default false; aggregate n=0 (table was empty); disposable rehearsal proved column behavior on non-empty tables | **PASS** |

### 5.2 Trusted DB identity propagation

| AC | Evidence | Verdict |
|---|---|---|
| L4 — DB key `isInternal=true` propagated to identity | `api-key-auth.guard.spec.ts` — mock returns `isInternal: true`, asserts `request.apiKeyIdentity.isInternal === true` | **PASS** |
| L5 — DB key `isInternal=false` propagated to identity | `api-key-auth.guard.spec.ts` — mock returns `isInternal: false`, asserts `request.apiKeyIdentity.isInternal === false` | **PASS** |
| Source confirmation | HEAD line 174: `isInternal: key.isInternal` in `validateApiKey`; HEAD guard: `isInternal: dbIdentity.isInternal` | **PASS** |

### 5.3 Self-promotion prevention

| AC | Evidence | Verdict |
|---|---|---|
| S1 — DTO whitelist strips `isInternal` | `api-key.controller.spec.ts` — production `whitelist: true` strips undecorated properties | **PASS** |
| S2 — controller extracts only `scopes` | `api-key.controller.spec.ts` — verifies `service.createApiKey(userId, createDto.scopes)` | **PASS** |
| S3 — service `repository.create()` literal excludes `isInternal` | `api-key.service.spec.ts` — verifies `create({ hashedKey, keyPrefix, userId, scopes, revokedAt: null })` | **PASS** |
| S4 — `revokeApiKey()` does not change `isInternal` | `api-key.service.spec.ts` — asserts only `revokedAt` is set | **PASS** |

### 5.4 Entitlement independence

| AC | Evidence | Verdict |
|---|---|---|
| H1 — `isInternal=true` without `ai:harness` → `harnessEntitled: false` | `api-key-auth.guard.spec.ts` — `isInternal: true`, scopes `['ai:execute']` → `harnessEntitled: false` | **PASS** |
| H2 — `ai:harness` scope with `isInternal=false` → `harnessEntitled: true`, `isInternal: false` | `api-key-auth.guard.spec.ts` — `isInternal: false`, scopes include `ai:harness` → verified | **PASS** |
| H3 — browser session `isInternal: true` ≠ `harnessEntitled` | `session-or-api-key.guard.spec.ts` — "does not treat isInternal true as Harness entitlement" | **PASS** |

### 5.5 Ownership and revocation

| AC | Evidence | Verdict |
|---|---|---|
| F1 — session ownership rejection | `ai-execution.controller.spec.ts` — AGENT-HARNESS-05C5 tests (unchanged) | **PASS** |
| F2 — execution result ownership | `ai-execution.controller.spec.ts` — ownership checks on getExecutionResult/triggerBuildApply | **PASS** |
| F3 — key ownership on revoke | `api-key.service.spec.ts` — "should throw ForbiddenException when user does not own the key" | **PASS** |
| R1 — revoked keys excluded from `validateApiKey()` | `api-key.service.spec.ts` + KEY-REVOKE-01 `IsNull()` correction | **PASS** |
| R2 — invalid/unmatched key → 403 | `api-key-auth.guard.spec.ts` — "should throw ForbiddenException when API key is invalid" | **PASS** |
| R3 — revocation effect immediate (no cache) | Design verification: `validateApiKey()` queries DB every call; no cache layer | **PASS** |

### 5.6 Migration ordering

| AC | Evidence | Verdict |
|---|---|---|
| M4 — timestamp `1773000000000` unique and ordered after `1772900000000` | Verified in design and stage-start; staging apply confirmed correct ordering | **PASS** |
| Migration-first ordering | Staging apply demonstrated: column applied before code deployed; old application compatible with expanded schema | **PASS** |

---

## 6. Staging migration and snapshot evidence

### 6.1 Applied migration

- **Migration:** `AddInternalAccessToApiKeys1773000000000`
- **Database:** `aisandbox`
- **Transaction:** `committed_via_typeorm_each`
- **History entries:** 30 → 31 (exactly one new entry)
- **Unrestricted pending after apply:** empty
- **Column:** `is_internal` boolean NOT NULL default false

### 6.2 Column exists on staging

The `is_internal` column exists on staging database `aisandbox` in table `public.api_keys`. Post-apply verification confirmed column type (boolean), nullability (NOT NULL), and default (false).

### 6.3 Current identity code NOT yet deployed

Running staging remains at old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` (dirty=0). The updated entity, service, and guard code from IDENTITY-01 (and KEY-REVOKE-01's `IsNull()` correction) have **not** been deployed. The old application does not map the `is_internal` column in its entity metadata — TypeORM ignores the unmapped column. Health checks (all 200) confirm the old application functions despite the extra column, but health checks do not prove deployed internal-access behavior.

### 6.4 No live internal-key grant

No keys were created or granted internal access during this task. `PRIVILEGE_GRANT_AUTHORIZED=NO`. The aggregate rows (n=0) confirm no keys exist on staging at the time of the column apply — there was no promotion opportunity to test. The full deployed guard-chain proof (create key → grant internal → authenticate → LaunchGuard accept) is NOT claimed.

### 6.5 Snapshots

Both snapshots are retained:
- `aisandbox-staging-pre-identity01-20260909` — created 2026-09-09 10:41 UTC+8; Keith Available attestation 2026-09-09 10:46 UTC+8
- `aisandbox-staging-pre-schema01-20260908` — created 2026-09-08 19:31 UTC+8

Neither has been deleted or restored.

---

## 7. Operator procedure and per-key authorization boundary

### 7.1 Procedure verified

The operator grant/revoke SQL procedure was verified in the design document (§4.1 / §4.2) and independently confirmed in the stage-start (§6):
- Transactional with `BEGIN` / `COMMIT`
- Targets by `id` UUID AND `user_id` (prevents broad UPDATE)
- Affected-row check with `AND is_internal = FALSE` (grant) / `AND is_internal = TRUE` (revoke)
- Prior/new state capture for audit
- Zero-row result disambiguation documented
- Audit requirements: key UUID, key_prefix, user_id, prior/new value, timestamp, operator, authorization, reason — no key material

### 7.2 Per-key authorization boundary

An actual per-key privilege grant is **separately authorized** and was **not required** to complete this task. The IDENTITY-01 scope is:
1. Column and migration ✓
2. Service/guard propagation code ✓
3. Unit/integration tests proving the code paths ✓
4. Staging column apply ✓

The grant/revoke procedure is documented and verified for correctness. Executing it against a specific key requires separate Keith authorization at EXEC-01C6A admission time.

---

## 8. Deployment and activation ordering

### 8.1 Migration-first activation

**Mandatory:** The migration (`AddInternalAccessToApiKeys1773000000000`) must be applied and verified before updated application code is deployed. TypeORM generates SQL referencing every mapped entity column; if the column does not exist, PostgreSQL fails at the SQL level.

**Status:** Migration is **applied** on staging. Updated code is **not deployed**. The migration-first prerequisite for future code deployment is satisfied.

### 8.2 Application-first schema rollback

**Mandatory:** If rollback is needed, revert application code first (removing the `isInternal` entity mapping), then drop the column via migration revert. Dropping the column while the updated application runs causes the same TypeORM SQL failure.

**Note:** No `migration:revert:prod` npm script exists. Revert requires `npx typeorm migration:revert -d dist/data-source.js` or snapshot restoration. Dropping `is_internal` permanently loses all internal-access metadata.

---

## 9. Original SCHEMA-01 CHECK9 FAIL preserved

SCHEMA-01 old-application compatibility CHECK9 FAIL is **preserved** and **not reclassified** by this consolidation. Unchanged old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` still accepts revoked plaintext keys due to TypeORM 0.3.28 `invalidWhereValuesBehavior.null=ignore`. KEY-REVOKE-01 provides the independently reviewed, tested, source-LOCKED correction (`IsNull()` predicate; Checkpoint: `docs/AGENT-PLATFORM-EXEC-01C-KEY-REVOKE-01-CHECKPOINT.md`). The correction is committed but not deployed.

---

## 10. Remaining deployment and canary limitations

| Item | State |
|---|---|
| `is_internal` column on staging | **Applied** ✓ |
| IDENTITY-01 application code deployed | **NOT deployed** — old revision `b6b94516aff9981101ae8815aec2e2d36b8b231b` |
| KEY-REVOKE-01 `IsNull()` deployed | **NOT deployed** — old revision |
| Operator privilege grant | **NOT authorized** — no key granted internal access |
| Full deployed guard-chain proof | **NOT claimed** — requires code deployment + grant + live LaunchGuard test |
| EXEC-01C6A Gateway-ingress canary | Blocked on: code deployment, privilege grant, STAGING/CREDIT authorization |
| Live API-key security (revoked-key rejection) | **Unfixed on running staging** — CHECK9 FAIL preserved |

### 10.1 What IDENTITY-01 LOCK enables

IDENTITY-01 COMPLETE AND LOCKED satisfies the IDENTITY-01 dependency for EXEC-01C6A. However, EXEC-01C6A remains NOT ADMITTED because its own prerequisites (STAGING authorization, CREDIT authorization, code deployment, privilege grant, unresolved runtime prerequisites) are independently unresolved.

### 10.2 What IDENTITY-01 LOCK does NOT enable

- Product-visible Harness activation (remains FUTURE / gated / disabled)
- Running-staging API-key security repair
- Automatic EXEC-01C6A admission

---

## 11. Lifecycle / occupancy after lock

- Candidate retained (`nature=IMPLEMENTATION`) so GOV-OS-03R1 completeness remains satisfied.
- `status` **LOCKED** (`Test-Admissible` = NOT_READY).
- `saturationClass` remains **FORCING**.
- `writeSetPrecision=EXACT`; IDENTITY-01 `admissionUncertain=false`.
- Lane 1 released EMPTY; Lane 2 EMPTY; Lane 3 DISABLED.
- GATEWAY released UNOWNED; MIGRATION released UNOWNED; GOVERNANCE released UNOWNED.
- EXEC-01C6A: IDENTITY-01 dependency is now SATISFIED. EXEC-01C6A remains READY / NOT ADMITTED / ADMISSION_UNCERTAIN (own prerequisites unresolved).

---

## 12. Activity ledger (this consolidation window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, local application tests=0, tests executed=0 (existing evidence reused; not rerun), package install=0, migrations=0 (prior apply evidence reused), deployment=0, privilege grant=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 2 admission=0, Lane 3 enablement=0, EXEC-01C6A admission=0, invitation registration=0, Harness activation=0, UI=0, browser=0.

Governance writes: this checkpoint, `TASKS.md` CURRENT EXECUTION BOARD fields, IDENTITY-01 canonical body in `TASKS_BACKLOG_FULL.md`, `docs/control-plane/lane-saturation-state.json`. Validator proof stored only under `%TEMP%`. Tracked `docs/control-plane/SATURATION_PROOF.json` preserved.

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

---

*Checkpoint document created: 2026-09-09 — Step 4 independent consolidation — AGENT-PLATFORM-EXEC-01C-IDENTITY-01 COMPLETE AND LOCKED (defined scope) — no source/test/runtime changes — no git add/commit/push.*
