# AGENT-PLATFORM-ORCH-PERSIST-01 — Stage-start / implementation freeze

**Task ID:** AGENT-PLATFORM-ORCH-PERSIST-01
**Title:** Durable orchestration coordinator persistence
**Date:** 2026-09-14
**Nature:** IMPLEMENTATION — high-risk persistence / schema / coordinator state
**Lifecycle:** 4-step IMPLEMENTATION
**Step:** 2 — stage-start / exact write-set freeze / persistence design freeze
**Step status:** Step 1 COMPLETE — 2026-09-14; Step 2 COMPLETE — 2026-09-14; Step 3 NOT AUTHORIZED; Step 4 NOT AUTHORIZED
**This document:** Authoritative Step 2 freeze for durable PostgreSQL-backed collaboration/referral state owned by API Gateway `OrchestrationService`. It does **not** authorize implementation, admission, migration apply, HTTP, frontend, Harness, EXEC-01C6A reopen, or runtime.

**Step 1 committed HEAD:** `b8108257a877cec0af50722e842f7ce2badabdcd` (branch `main`; message `docs: register orchestration persistence`)
**Step 2 base HEAD:** `b8108257a877cec0af50722e842f7ce2badabdcd` (branch `main`; working tree clean at window open)
**Parent lock:** AGENT-PLATFORM-ORCH-ARCH-01 COMPLETE AND LOCKED — Checkpoint: `docs/AGENT-PLATFORM-ORCH-ARCH-01-STAGE-START.md`
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=NO
STEP4_AUTHORIZED=NO
IMPLEMENTATION_STARTED=NO
ADMITTED=NO
WRITE_SET_PRECISION=EXACT
ADMISSION_UNCERTAIN=true
TEST_ADMISSIBLE=ADMISSION_UNCERTAIN
MUTEXES_DECLARED=GATEWAY,MIGRATION
MUTEXES_ACQUIRED=NO
MIGRATION_EXECUTION_AUTHORIZED=NO
HTTP_CONTROLLER=NO
PRODUCT_VISIBLE_ORCHESTRATION_UI=NO
HARNESS_ENABLEMENT=NO
HARNESS_VERSION_ON_LEAF_JOBS=OMIT
TEMPORARY_PM2_OVERLAYS=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
BUILDER_LIVE_GATE_01=COMPLETE AND LOCKED / LEFT_ON
PM2_FENCE_01=COMPLETE AND LOCKED / OUTCOME_BLOCKED
AUDIT_PERSISTENCE=DEFERRED (in-memory remains)
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE=UNOWNED (end-state)
PRIVATE_BETA_INVITE_01=PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
```

Keith authorized Step 2 only. This freeze does **not** admit an implementation lane. Candidate remains `status=READY` / `admissionUncertain=true` so it stays out of S.

---

## 1. Inherited architecture (must not reopen)

Frozen by AGENT-PLATFORM-ORCH-ARCH-01:

1. Gateway durable orchestration coordinator
2. PostgreSQL-backed collaboration/referral state (this child)
3. Leaf jobs are ordinary plain Builder execute-path jobs
4. No `harnessVersion` for v1
5. No temporary PM2 overlays
6. No product-visible orchestration UI
7. Single-shot Builder Ask/Build stays untouched

Historical `docs/AGENT-PLATFORM-05-MULTI-BUILDER-ORCHESTRATION-PLAN.md` and `docs/AGENT-PLATFORM-07-READ-ONLY-ORCHESTRATION-COORDINATOR-PLAN.md` are not living authority.

---

## 2. Source-grounded current state (HEAD `b8108257a877cec0af50722e842f7ce2badabdcd`)

### 2.1 In-memory coordinator

`services/api-gateway/src/orchestration/orchestration.service.ts`:

| Store | Type | Key | Value |
|---|---|---|---|
| `collaborationRunStore` | `Map` | `CollaborationRunId` | `CollaborationRun` |
| `referralStore` | `Map` | `ReferralId` | `CollaborationReferral` |
| `idempotencyStore` | `Map` | `${collaborationRunId}::${idempotencyKey}` | `ReferralId` |
| `referralExecutionMap` | `Map` | `ReferralId` | `executionId` string |

Audit is a separate `InMemoryOrchestrationAuditRecorder` (`orchestration-audit.recorder.ts`). Tests call `getAuditEvents()` / `clearAuditEvents()`.

HTTP: none. `AIExecutionController` does not inject `OrchestrationService`. Repo-wide application callers of create/get/referral APIs are the orchestration tests only.

`startReferralExecution` may accept `harnessVersion` on input; enqueued `jobPayload` **omits** it (EXEC-01C5B1 tests at service.spec.ts ~586–609).

### 2.2 Contract types (frozen-read this slice)

`orchestration.contracts.ts` already defines the durable shape. Step 3 must map rows onto these types. Do **not** edit this file in this slice.

Safety defaults that must be preserved:

- `DEFAULT_MAX_REFERRAL_DEPTH = 3`
- `DEFAULT_MAX_AGENTS_PER_COLLABORATION = 4`
- `READ_ONLY_MODE_INDICATOR = 'read_only'`
- `allowWriteTools = false`
- `READ_ONLY_ALLOWED_TOOL_IDS = ['list_files', 'read_file']`
- `READ_ONLY_BLOCKED_TOOL_IDS = ['write_file', 'delete_file', 'run_validation']`

Idempotency semantics that the unique index must match:

- Same `(collaborationRunId, idempotencyKey)` while status is **not** `failed` / `cancelled` / `timed_out` → duplicate (return existing)
- Same key after `failed` / `cancelled` / `timed_out` → create is valid (current Map overwrite)
- `completed` and `rejected` remain duplicate (not in the replay list)

### 2.3 TypeORM load path

`database.config.ts` auto-loads `src/**/*.entity{.ts,.js}`. Entities under `orchestration/` are therefore discovered without editing `entities/index.ts` or `app.module.ts`. `OrchestrationModule` must still `TypeOrmModule.forFeature([...])`.

### 2.4 Latest migration

Latest active timestamp: `1773000000000-AddInternalAccessToApiKeys`. This slice’s create-table migration is **`1773100000000`**.

### 2.5 Builder execute path

`POST /api/ai/execute` already forwards optional `collaborationRunId` / `referralTraceId` when present. Workspace Ask/Build does not send them. This slice must not edit the controller, worker, frontend, or frozen contract `HARNESS_ENTITLEMENT_PROOF_V1`.

### 2.6 Container-manager leftover columns

SQLite `orchestrator_enabled` / `orchestrator_mode` remain leftover and **out of scope**.

---

## 3. Frozen schema design

Two tables only. No audit table. No separate idempotency table. No separate execution-map table. No users/projects FK this slice (current IDs are prefixed strings; tests use `'user-01'` / `'project-01'`; no HTTP callers).

All names are `"public"`-qualified. Do **not** use `CREATE TABLE IF NOT EXISTS`. Fail closed if either table already exists.

### 3.1 `public.collaboration_runs`

| Column | Type | Null | Notes |
|---|---|---|---|
| `collaboration_run_id` | `text` | NOT NULL | PK. Current generator is `collab_${uuid}` or caller-supplied string |
| `user_id` | `text` | NOT NULL | No FK this slice |
| `project_id` | `text` | NOT NULL | No FK this slice |
| `initiator_agent_role` | `text` | NOT NULL | `CollaborationAgentRole` |
| `initiator_builder_profile_id` | `text` | NOT NULL | |
| `orchestration_mode` | `text` | NOT NULL | CHECK `= 'read_only'` |
| `status` | `text` | NOT NULL | CHECK IN (`active`,`completed`,`failed`,`cancelled`,`timed_out`) |
| `referral_ids` | `jsonb` | NOT NULL | DEFAULT `'[]'::jsonb`; text array of referral IDs; keep 1:1 with contract |
| `active_builder_profile_ids` | `jsonb` | NOT NULL | text array |
| `timeout_ms` | `integer` | NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |
| `completed_at` | `timestamptz` | NULL | |
| `failed_at` | `timestamptz` | NULL | |
| `timed_out_at` | `timestamptz` | NULL | |
| `cancel_requested_at` | `timestamptz` | NULL | |
| `cancelled_by_user_id` | `text` | NULL | |
| `cancel_reason` | `text` | NULL | |

Indexes:

- PK `collaboration_runs_pkey` on `collaboration_run_id`
- `idx_collaboration_runs_user_id` on `user_id`
- `idx_collaboration_runs_status` on `status`

CHECK:

- `chk_collaboration_runs_status`
- `chk_collaboration_runs_mode` (`orchestration_mode = 'read_only'`)

### 3.2 `public.collaboration_referrals`

| Column | Type | Null | Notes |
|---|---|---|---|
| `referral_id` | `text` | NOT NULL | PK |
| `collaboration_run_id` | `text` | NOT NULL | FK → `collaboration_runs(collaboration_run_id)` ON DELETE CASCADE |
| `referral_trace_id` | `text` | NOT NULL | UNIQUE |
| `parent_referral_trace_id` | `text` | NULL | No FK; parent is a trace id |
| `source_agent_role` | `text` | NOT NULL | |
| `source_builder_profile_id` | `text` | NOT NULL | |
| `target_agent_role` | `text` | NOT NULL | |
| `target_builder_profile_id` | `text` | NOT NULL | |
| `status` | `text` | NOT NULL | CHECK IN (`pending_approval`,`approved`,`in_progress`,`completed`,`failed`,`cancelled`,`timed_out`,`rejected`) |
| `cancel_status` | `text` | NOT NULL | CHECK IN (`not_requested`,`requested`,`cancelled`,`rejected`) |
| `idempotency_key` | `text` | NOT NULL | |
| `referral_chain` | `jsonb` | NOT NULL | text array |
| `depth` | `integer` | NOT NULL | |
| `max_depth` | `integer` | NOT NULL | |
| `visited_builder_profile_ids` | `jsonb` | NOT NULL | text array |
| `timeout_ms` | `integer` | NOT NULL | |
| `constraint_timeout_ms` | `integer` | NOT NULL | flattened `ReferralConstraints.timeoutMs` |
| `constraint_max_depth` | `integer` | NOT NULL | |
| `constraint_max_agents_per_collaboration` | `integer` | NOT NULL | |
| `constraint_read_only` | `boolean` | NOT NULL | CHECK `= true` |
| `constraint_allow_write_tools` | `boolean` | NOT NULL | CHECK `= false` |
| `constraint_allowed_tools` | `jsonb` | NOT NULL | text array |
| `execution_id` | `text` | NULL | replaces `referralExecutionMap` |
| `result_status` | `text` | NULL | CHECK NULL OR IN (`success`,`partial`,`failed`) |
| `result_summary` | `text` | NULL | |
| `result_output_files` | `jsonb` | NULL | text array |
| `result_duration_ms` | `integer` | NULL | |
| `created_at` | `timestamptz` | NOT NULL | |
| `updated_at` | `timestamptz` | NOT NULL | |
| `completed_at` | `timestamptz` | NULL | |
| `failed_at` | `timestamptz` | NULL | |
| `timed_out_at` | `timestamptz` | NULL | |
| `cancel_requested_at` | `timestamptz` | NULL | |
| `cancelled_by_user_id` | `text` | NULL | |
| `cancel_reason` | `text` | NULL | |

Indexes / uniqueness:

- PK `collaboration_referrals_pkey` on `referral_id`
- UNIQUE `uq_collaboration_referrals_trace_id` on `referral_trace_id`
- `idx_collaboration_referrals_run_id` on `collaboration_run_id`
- `idx_collaboration_referrals_parent_trace` on `parent_referral_trace_id`
- `idx_collaboration_referrals_status` on `status`
- Partial unique `uq_collaboration_referrals_idempotency_active` on `(collaboration_run_id, idempotency_key)` **WHERE `status NOT IN ('failed','cancelled','timed_out')`**
- Partial unique `uq_collaboration_referrals_execution_id` on `execution_id` **WHERE `execution_id IS NOT NULL`**

FK:

- `fk_collaboration_referrals_run` FOREIGN KEY (`collaboration_run_id`) REFERENCES `"public"."collaboration_runs"("collaboration_run_id")` ON DELETE CASCADE

### 3.3 Audit rows

**Deferred.** `InMemoryOrchestrationAuditRecorder` remains. No `orchestration_audit_events` table in this slice. Logger-backed in-process events stay sufficient for existing tests. A later named task may persist audit.

### 3.4 Mapping of the four Maps

| Current Map | Durable location |
|---|---|
| `collaborationRunStore` | `collaboration_runs` |
| `referralStore` | `collaboration_referrals` |
| `idempotencyStore` | partial unique index on referrals |
| `referralExecutionMap` | `collaboration_referrals.execution_id` |

### 3.5 Migration class / fail-closed / down()

File: `services/api-gateway/src/migrations/1773100000000-CreateCollaborationOrchestrationTables.ts`

Class name: `CreateCollaborationOrchestrationTables1773100000000`

`up()`:

1. If `public.collaboration_runs` **or** `public.collaboration_referrals` exists → throw actionable diagnostic; refuse to adopt
2. Create `collaboration_runs`
3. Create `collaboration_referrals` (FK requires runs first)
4. Create indexes listed above

`down()`:

1. Require active QueryRunner transaction
2. `LOCK TABLE "public"."collaboration_referrals", "public"."collaboration_runs" IN ACCESS EXCLUSIVE MODE NOWAIT`
3. Refuse DROP if either table has `COUNT(*) > 0`
4. Drop indexes then drop referrals then runs
5. Do not commit/roll back the runner transaction
6. Do not use `DROP TABLE IF EXISTS` for the populated-refusal path (empty-table DROP is explicit)

No `IF NOT EXISTS` on CREATE. Provenance is TypeORM history plus refuse-to-adopt.

**Apply is not authorized in Step 3.** Step 3 authors the migration file and mocked SQL-shape tests only. `MIGRATION_EXECUTION_AUTHORIZED=NO` until a later Keith authorization.

---

## 4. Frozen TypeORM entity / repository plan

No custom repository class. Inject TypeORM `Repository<T>`.

### 4.1 Entity files (new)

- `services/api-gateway/src/orchestration/collaboration-run.entity.ts`
  - `@Entity({ name: 'collaboration_runs', schema: 'public' })`
  - `@PrimaryColumn({ type: 'text', name: 'collaboration_run_id' })`
  - jsonb columns typed as `string[]` (or `simple-json` **forbidden**; use `type: 'jsonb'`)
  - timestamptz as `Date`
- `services/api-gateway/src/orchestration/collaboration-referral.entity.ts`
  - `@Entity({ name: 'collaboration_referrals', schema: 'public' })`
  - `@PrimaryColumn({ type: 'text', name: 'referral_id' })`
  - `@ManyToOne` / `@JoinColumn` to `CollaborationRunEntity` on `collaboration_run_id`
  - unique/index decorators matching §3.2 (partial uniques may be migration-only if TypeORM decorator cannot express the WHERE clause; migration SQL is authoritative)

### 4.2 Module wiring

`orchestration.module.ts` adds:

```text
TypeOrmModule.forFeature([CollaborationRunEntity, CollaborationReferralEntity])
```

Keep `QueueModule` and `ExecutionResultService`. Do not add a controller.

### 4.3 `entities/index.ts`

**Not in write set.** Auto-load glob covers `orchestration/*.entity.ts`. Barrel update is unnecessary.

### 4.4 `orchestration.contracts.ts`

**Not in write set.** Service maps entity rows ↔ existing contract objects (ISO strings on read, `Date` in columns).

### 4.5 `orchestration-audit.recorder.ts`

**Not in write set.** In-memory recorder unchanged.

---

## 5. Frozen OrchestrationService refactor plan

### 5.1 Replace Maps with repositories

Remove the four private `Map` fields. Inject:

- `@InjectRepository(CollaborationRunEntity) runRepo`
- `@InjectRepository(CollaborationReferralEntity) referralRepo`

Optional constructor `QueueService` / `ExecutionResultService` / audit recorder remain.

Private mappers (in the service file, no extra mapper file):

- `toCollaborationRun(entity) → CollaborationRun` (Date → ISO)
- `toReferral(entity) → CollaborationReferral`
- `fromCreateRunInput` / `fromCreateReferralInput` for inserts

### 5.2 Async in-process API

There is no HTTP. Tests are the only callers. Store-backed methods become `Promise<...>`:

| Method | After freeze |
|---|---|
| `createCollaborationRun` | `Promise<CollaborationRun>` |
| `getCollaborationRun` | `Promise<CollaborationRun \| null>` |
| `createReferral` | `Promise<CollaborationReferral>` |
| `getReferral` | `Promise<CollaborationReferral \| null>` |
| `completeReferral` | `Promise<CollaborationReferral>` |
| `failReferral` | `Promise<CollaborationReferral>` |
| `validateReferral` | `Promise<ValidateReferralResult>` |
| `startReferralExecution` | already async |
| `cancelReferral` | already async |
| `cancelCollaboration` | already async |
| `getDefaultReferralConstraints` | stays sync |
| `getReadOnlyPolicy` | stays sync |
| `getAuditEvents` / `clearAuditEvents` | stay sync (in-memory) |

### 5.3 Transactions

`createReferral`, `completeReferral`, `failReferral`, `startReferralExecution` (status + `execution_id`), `cancelReferral`, and `cancelCollaboration` must use `repository.manager.transaction` so run JSON arrays / referral row / execution_id stay consistent.

`createCollaborationRun` with an existing PK returns the existing row (current idempotent create). Insert only when missing.

Idempotency lookup: `findOne` by `(collaboration_run_id, idempotency_key)` where status not in replay set; if a replay-status row exists, treat as valid-to-create (partial unique allows the new row).

### 5.4 Preserve contracts and safety limits

Keep current throw messages and audit `limitType` values (`depth`, `loop`, `agent_limit`). Keep `resolveConstraints` rejecting write tools before persist. Keep `assertReadOnlyConstraints` before enqueue.

`startReferralExecution` job payload remains the current field set and **must omit `harnessVersion`** even if input supplies it. Do not add `harnessEntitlementProof`. Do not change `QueueService.enqueueExecution` signature.

### 5.5 Forbidden in this slice

- HTTP controller / new route
- frontend / i18n / checkbox wiring
- `ai-execution.controller.ts` / worker / job.types
- `harnessVersion` on leaf jobs
- Builder execute-handler behavior change
- container-manager SQLite columns
- dedicated queue/worker
- ENV / compose / package.json
- migration apply / Docker / Postgres / Redis runtime

---

## 6. Frozen tests

Evidence class remains `LOCAL-TESTS`. No PostgreSQL, Docker, or Lightsail in Step 3.

### 6.1 Update existing service tests

`services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts`

- Provide `getRepositoryToken` fakes (in-memory maps behind TypeORM-shaped `findOne`/`save`/`find`)
- `await` the async methods
- Keep all safety, idempotency, loop, harnessVersion-omit, and audit emission cases
- Retarget “records executionId in private map for cancel lookup” to `execution_id` on the referral row / `getReferral()` result path used by cancel

### 6.2 Update existing canary tests

`services/api-gateway/src/orchestration/__tests__/orchestration.canary.spec.ts`

- Same repository fakes + `await`
- Keep the 15 in-process canary cases, including harness/write-canary non-involvement

### 6.3 New durable persistence tests

`services/api-gateway/src/orchestration/__tests__/orchestration.persistence.spec.ts`

Must prove, with repository fakes only (no real Postgres):

1. A second `OrchestrationService` instance constructed against the same fake store reads previously saved runs/referrals (restart analogue)
2. Maps are gone (`collaborationRunStore` / `referralStore` / `idempotencyStore` / `referralExecutionMap` are not instance fields)
3. Idempotent duplicate vs retry-after-`failed`/`cancelled`/`timed_out`
4. Depth / loop / agent-limit still throw and still emit `safety_limit_breached`
5. `startReferralExecution` payload omits `harnessVersion`
6. No HTTP module/controller is registered by `OrchestrationModule`

### 6.4 New migration mocked SQL-shape tests

`services/api-gateway/src/migrations/__tests__/1773100000000-CreateCollaborationOrchestrationTables.spec.ts`

Mirror SCHEMA-01 mocked style:

- creates both tables without `IF NOT EXISTS`
- required columns, CHECKs, FK, partial unique indexes
- `up()` refuses when either table exists
- `down()` requires transaction, ACCESS EXCLUSIVE NOWAIT, refuses populated DROP
- does not start/commit/roll back the runner transaction

These tests do **not** prove live PostgreSQL locking.

### 6.5 Ordinary Builder execute-path regression

**By write-set exclusion.** Do not modify:

- `services/api-gateway/src/ai/ai-execution.controller.ts`
- `services/api-gateway/src/ai/ai-execution.controller.spec.ts`
- `services/ai-service/src/worker/worker.processor.ts`
- frontend Ask/Build helpers

Existing controller specs already cover optional orchestration metadata forwarding and ordinary payload omission. Leaving those files untouched is the local-only regression for this slice. Do not consume or mutate `HARNESS_ENTITLEMENT_PROOF_V1`.

Focused Step 3 test command (when implementation is later authorized):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx jest --testPathPattern "orchestration\\.(service|canary|persistence)\.spec|1773100000000-CreateCollaborationOrchestrationTables"
```

Focused typecheck (when later authorized):

```powershell
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npx tsc --noEmit --incremental false
```

Neither command is authorized in this Step 2 window.

---

## 7. Exact frozen write set

`writeSetPrecision=EXACT`. Paths are repo-relative POSIX.

**Modify:**

1. `services/api-gateway/src/orchestration/orchestration.service.ts`
2. `services/api-gateway/src/orchestration/orchestration.module.ts`
3. `services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts`
4. `services/api-gateway/src/orchestration/__tests__/orchestration.canary.spec.ts`

**Create:**

5. `services/api-gateway/src/orchestration/collaboration-run.entity.ts`
6. `services/api-gateway/src/orchestration/collaboration-referral.entity.ts`
7. `services/api-gateway/src/orchestration/__tests__/orchestration.persistence.spec.ts`
8. `services/api-gateway/src/migrations/1773100000000-CreateCollaborationOrchestrationTables.ts`
9. `services/api-gateway/src/migrations/__tests__/1773100000000-CreateCollaborationOrchestrationTables.spec.ts`

**Explicitly excluded:**

- `orchestration.contracts.ts`
- `orchestration-audit.recorder.ts`
- `entities/index.ts`
- `app.module.ts`
- `ai-execution.controller.ts` / its spec
- `database.config.ts`
- frontend, i18n, ai-service, container-manager
- `package.json` / lockfiles / compose / `.env*`
- this stage-start is a Step 2 governance write, not a Step 3 source file

---

## 8. Mutexes and admission requirements

| Item | Freeze |
|---|---|
| Mutexes | GATEWAY, MIGRATION — declared; **not acquired** in Step 2 |
| Hotfiles | none (GATEWAY covers `services/api-gateway/`) |
| I18N | false |
| runtimeNeeds | none |
| evidenceClass | LOCAL-TESTS |
| exclusiveCapacity | false |
| sharedContractIds | none |
| mutatesSharedContractIds | none |
| `HARNESS_ENTITLEMENT_PROOF_V1` | remains FROZEN; not consumed; not mutated |
| status | READY |
| startCondition | READY |
| writeSetPrecision | EXACT |
| admissionUncertain | **true** (Step 3/admission not authorized; keeps candidate out of S) |
| productClass | CURRENT |
| futureAuthorization | NONE |
| saturationClass | FORCING |

Step 2 does **not** admit Lane 1 or Lane 2. Occupancy remains EMPTY. GOVERNANCE is acquired only for this documentation write, then released UNOWNED.

Admission of Step 3 still requires a later Keith authorization. Setting `admissionUncertain=false` in the same window as source edits is **not** this Step 2.

---

## 9. Revert strategy

| Layer | Revert |
|---|---|
| Step 2 governance | Discard this document plus this window’s board/registry/sidecar write-set field updates |
| Step 3 source (later) | Delete the five new files; restore the four modified files |
| Migration apply | Not authorized; if a later window applies it, rollback is the frozen `down()` plus snapshot policy — **not** this slice |
| Occupancy | Already EMPTY; revert must not admit a lane |
| Ordinary Builder | Untouched; no execute-path revert |

Cannot invalidate locked ORCH-ARCH-01 / BUILDER-LIVE-GATE-01 / PM2-FENCE-01 / EXEC-01A / 01B / 01C1..01C5B2 / IDENTITY-01 / SCHEMA-01 / KEY-REVOKE-01 / GOV-AUTH-03. EXEC-01C6A `startCondition=NOT_READY` must remain.

---

## 10. Acceptance criteria

### Step 2 (this window)

- [x] Stage-start created: `docs/AGENT-PLATFORM-ORCH-PERSIST-01-STAGE-START.md`
- [x] Exact schema frozen (`collaboration_runs`, `collaboration_referrals`)
- [x] Audit persistence deferred (in-memory)
- [x] Exact entity/repository plan frozen
- [x] OrchestrationService Map→repository refactor frozen, including async API
- [x] Safety limits / idempotency / loop detection preserved
- [x] `harnessVersion` omit preserved
- [x] No HTTP / no frontend / no Harness / no EXEC-01C6A reopen
- [x] Exact 9-file write set frozen
- [x] Mutexes GATEWAY + MIGRATION declared not acquired
- [x] `writeSetPrecision=EXACT` / `admissionUncertain=true`
- [x] Lane 1 EMPTY / Lane 2 EMPTY / Lane 3 DISABLED
- [x] No implementation / no migration file created this window
- [x] No Git commit/push

### Step 3 (NOT AUTHORIZED)

- [ ] Source authored in the frozen 9-file set only
- [ ] Maps removed; repositories used
- [ ] Existing service + canary tests updated and passing locally
- [ ] New persistence + migration mocked tests passing locally
- [ ] Enqueued leaf jobs omit `harnessVersion`
- [ ] No controller, no frontend, no execute-handler edits
- [ ] Validator PASS; occupancy EMPTY unless a later admission step is separately authorized
- [ ] Migration **not** applied

### Step 4 (NOT AUTHORIZED)

- [ ] Independent verification / checkpoint / lock

---

## 11. Risks and stop conditions

**Risks**

1. Partial unique index is required to preserve retry-after-failure; a naive UNIQUE `(run, idempotency_key)` would change contract behavior.
2. Sync→async service methods will fail existing tests until they `await`; that is expected and in-scope.
3. JSONB `referral_ids` can drift from FK rows if updates skip the transaction — stop and use a transaction.
4. Auto-load of `*.entity.ts` will register the new entities at Gateway boot after deploy; without an applied migration, production boot is unsafe. Step 3 must not be deployed. Apply remains a later Keith decision.
5. TypeORM decorator may not express partial unique indexes; SQL in the migration is authoritative.

**Stop immediately if Step 3 (once authorized) would:**

- add an HTTP controller or route
- edit frontend / i18n
- put `harnessVersion` on the enqueued job
- edit `ai-execution.controller.ts`, worker, or `job.types.ts`
- reopen EXEC-01C6A or use temporary PM2 overlays
- apply migrations, start Docker/Postgres/Redis, or touch staging/SSH/AWS/PM2/env/provider/credit
- persist audit rows (out of this slice)
- add a third table or a users/projects FK
- change safety-limit defaults
- set `admissionUncertain=false` without Keith admission authorization
- enable Lane 3

---

## 12. Step 2 question answers (registration mandatory list)

1. **Tables / files:** `collaboration_runs` + `collaboration_referrals`; entities in §4.1; idempotency and execution map are columns/indexes, not tables.
2. **`orchestration.contracts.ts`:** frozen-read. No change.
3. **Migration timestamp:** `1773100000000`; fail-closed existing-table (§3.5).
4. **Map semantics:** §3.4 / §5. Restart-loss of Maps is replaced by row reads. No HTTP/frontend change.
5. **Safety limits:** unchanged constants and `resolveConstraints` / `validateReferral` throws; DB CHECKs enforce read-only / no write tools.
6. **`startReferralExecution`:** still `QueueService.enqueueExecution`; payload omits `harnessVersion`.
7. **`entities/index.ts`:** not required; not in write set; no HOTFILE.
8. **Tests:** §6. Mocked only. No Postgres runtime.
9. **No controller:** confirmed; stop condition if added.
10. **Container-manager SQLite leftover:** out of scope.

---

## 13. Authorization state (end of Step 2)

```
IMPLEMENTATION_AUTHORIZED=NO
ADMISSION_AUTHORIZED=NO
STAGING_AUTHORIZED=NO
MIGRATION_EXECUTION_AUTHORIZED=NO
LOCAL_RUNTIME_AUTHORIZED=NO
PROVIDER_LIVE_AUTHORIZED=NO
CREDIT_AUTHORIZED=NO
TESTS_EXECUTED=NO
APPLICATION_SOURCE_CHANGED=NO
LANE_1=EMPTY
LANE_2=EMPTY
GATEWAY_ACQUIRED=NO
MIGRATION_ACQUIRED=NO
EXEC_01C6A_REOPENED=NO
```

---

## 14. Activity ledger

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, product implementation=0, application source=0, tests executed=0, package install=0, migrations authored=0, migrations applied=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, UI=0, browser=0.

Governance writes: this stage-start; `TASKS.md` CURRENT EXECUTION BOARD fields; `TASKS_BACKLOG_FULL.md` PERSIST-01 body; sidecar candidate write-set / precision update; `SATURATION_PROOF.json` only as validator output. Occupancy facts unchanged (EMPTY / GOVERNANCE UNOWNED).

**Invitation invariant:** PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

**Lane 3 invariant:** Lane 3 remains DISABLED.

**Product-visible orchestration / Harness:** FUTURE / gated / disabled / unavailable.

**Activation effect:** NONE
**Rollback boundary:** discard this document and this window’s board/registry/sidecar Step 2 field updates. No implementation to roll back.
