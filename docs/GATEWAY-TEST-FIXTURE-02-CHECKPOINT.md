# GATEWAY-TEST-FIXTURE-02 — Class 2 Non-Live TypeORM/Jest Repair — Step 3 Checkpoint / Lock

**Task ID:** GATEWAY-TEST-FIXTURE-02
**Step:** 3 — Independent verification + checkpoint + lock (FINAL)
**Date:** 2026-08-27
**Verdict:** COMPLETE AND LOCKED — PASS — 2026-08-27
**Base HEAD:** `d128ce7d2bbd597d08e71675ff309b6da12fcc13` (branch `main`)
**Plan:** `docs/GATEWAY-TEST-FIXTURE-02-PLAN.md`
**Replan:** `docs/GATEWAY-TEST-FIXTURE-02-REPLAN.md`

---

## 1. Task / date

| Field | Value |
|---|---|
| Task | GATEWAY-TEST-FIXTURE-02 — Class 2 Non-Live TypeORM/Jest Repair |
| Lock date | 2026-08-27 (actual current completion date; not backdated) |
| Lifecycle | 3-step (Step 1 registration/freeze — Step 2 test-only implementation [2A STOPPED → 2R replan → 2B implementation] — Step 3 independent verification/checkpoint/lock) |
| Evidence class | LOCAL-TESTS |

## 2. Discovery

Discovered during **PILOT-2LANE-01 Step 4** integrated non-live gateway validation. The four Class 2 AI-execution integration suites were pre-existing red (not pilot-caused) and blocked the pilot's broad non-live gate.

## 3. Predecessor

**GATEWAY-TEST-FIXTURE-01** = COMPLETE AND LOCKED — PASS — 2026-08-24. Class 1 (Nest TestingModule DI fixture drift) repaired: 5 suites / 61 tests GREEN. Class 2 explicitly left unresolved and unregistered there; owned by this task.

## 4. Original Class 2 root cause

```
ROOT_CAUSE = PRE_EXISTING_LIVE_TYPEORM_FORROOT_IN_NONLIVE_JEST
PILOT_CAUSED = NO
PRODUCTION_CODE_FIX_REQUIRED = NO
```

All four suites constructed Nest with direct `TypeOrmModule.forRoot({ type: 'postgres', url: ... })` against external PostgreSQL, forbidden in the non-live gate. Three suites failed with TypeORM connect `AggregateError` at compile; two-phase had a broken DATABASE_URL skip-return producing `spyOn(undefined)` and one vacuous pass. Fresh Step 1 reproduction: 4 failed suites / 22 failed tests / 1 vacuous pass.

## 5. Original (Step 1) architecture

Hermetic `TypeOrmModule.forRoot({ type: 'better-sqlite3', database: ':memory:', entities: [UsageRecord], synchronize: true, dropSchema: true })` passing the **production decorated UsageRecord class** directly.

## 6. Step 2A compatibility STOP

Step 2A STOPPED correctly (2026-08-27): the production `UsageRecord` decorator metadata is PostgreSQL-specific and incompatible with better-sqlite3. No production workaround was attempted; returned to control plane per plan §14/§18 stop conditions.

## 7. Exact Step 2A error

```
DataTypeNotSupportedError:
Data type "timestamp" in "UsageRecord.timestamp" is not supported by
"better-sqlite3" database.
```

(`uuid` and `jsonb` columns would also have failed had validation proceeded past `timestamp`.)

## 8. Step 2R revised architecture (frozen)

```
TEST-ONLY ENTITYSCHEMA + REAL BETTER-SQLITE3 REPOSITORY + USAGERECORD DI-TOKEN BRIDGE
```

- Test-only `EntitySchema({ name: 'UsageRecord', tableName: 'usage_records' })` with SQLite-portable types — production decorated `UsageRecord` is **never registered** with any DataSource.
- Real `better-sqlite3` `:memory:` DataSource initialized **outside** Nest DI (`synchronize: true`, `dropSchema: true`); no `TypeOrmModule.forRoot` / `forFeature` in the TestingModule.
- Real TypeORM repository from that DataSource bridged into Nest via `{ provide: getRepositoryToken(UsageRecord), useValue: testRepo }` (token = `'UsageRecordRepository'`; the EntitySchema `name: 'UsageRecord'` yields the same token).
- Real production `UsageLedgerService` + real production `IdempotencyGuard` + `IdempotentReplayExceptionFilter`, all UNMODIFIED.
- Current-constructor mocks only for non-ledger services (`QueueService`, `ExecutionResultService`, `ExecutionStreamService`, `UserAiInstructionsService`, `ProjectAiContextService`, `SessionService`); `overrideGuard(CreditBalanceGuard)` and other non-target guards passthrough.
- No production abstraction added. Clean lifecycle: `beforeEach` `repository.clear()`, `afterAll` `app.close()` then guarded `dataSource.destroy()`.

## 9. Step 2R disposable proof

Temporary probe in `%TEMP%` (deleted; repo clean verified): 10/10 checks PASS — schema init, create/save, findOne, update, JSON round-trip, CreateDateColumn Date hydration, partial-unique allows distinct pairs, partial-unique rejects duplicate non-null pair (`SqliteError: UNIQUE constraint failed`), multiple NULL requestId rows allowed, token string = `'UsageRecordRepository'`. `BETTER_SQLITE3_ENTITYSCHEMA_ARCHITECTURE_COMPATIBLE=YES`.

## 10. Exact five implementation files (Step 2B; the only implementation dirt)

```
services/api-gateway/src/ai/__tests__/hermetic-usage-record-fixture.ts            (NEW)
services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts
```

## 11. Portable EntitySchema shape (test-only; NOT claimed production-equivalent)

All 14 persisted fields preserved: `executionId` (PK), `requestId`, `apiKeyId`, `userId`, `sessionId`, `conversationId`, `provider`, `adapter`, `model`, `tokensUsed`, `executionDurationMs`, `executionStatus` (default `'pending'`), `timestamp`, `metadata`. Portable mappings confined to the test helper: production `uuid` → `varchar`; production `timestamp` (CreateDateColumn) → `datetime` with `createDate: true`; production `jsonb` → `simple-json`. These are SQLite-portable test mappings only — no claim of production schema equivalence.

## 12. Repository-token bridge

Verified in all four suites: `{ provide: getRepositoryToken(UsageRecord), useValue: fixture.repository }` satisfies `@InjectRepository(UsageRecord)` in the unmodified production `UsageLedgerService`. Production decorated entity metadata never touches the SQLite DataSource.

## 13. Partial unique index

Real SQLite partial unique index created by synchronize from the EntitySchema:

```
name:    idx_usage_records_user_request_id
columns: (userId, requestId)
unique:  true
where:   "request_id" IS NOT NULL
```

Duplicate non-null `(userId, requestId)` is rejected by SQLite; multiple NULL `requestId` rows remain permitted (probe-verified; single-row invariants re-asserted by the suites). Not a Map/mock.

## 14. Lifecycle / isolation

Each suite owns an isolated `:memory:` DataSource created in `beforeAll` and destroyed in `afterAll` (`isInitialized`-guarded `destroy()`); `beforeEach` clears the table and resets mocks. Orphan suite additionally mocks `axios` to fail on any unexpected outbound HTTP. No cross-suite state; `--runInBand` clean.

## 15. Assertion retargets to CURRENT contract

First `POST /ai/execute` asserts **202 ACCEPTED / `status: 'queued'` / `executionId`** (intent written before `queueService.enqueueExecution`), replacing the obsolete synchronous in-request 200 + `body.output` contract. Completed-replay still asserts HTTP 200 with exact persisted body via `IdempotentReplayException` → filter. Pending replay 409. Worker completion simulated via real `usageLedgerService.updateExecutionResult` against the hermetic store. `spyOn(AIServiceHttpClient.execute)` removed; Postgres `$1` raw SQL removed; two-phase DATABASE_URL skip removed (always hermetic; no vacuous pass). No obsolete synchronous provider-execution contract restored; no assertion weakening — semantic review per suite:

- **two-phase:** intent persisted before enqueue (asserted inside the enqueue mock); first call 202/queued; pending replay 409; enqueue failure → 500 with pending remaining; queued success without worker keeps pending visible (financial integrity).
- **replay-quota:** first call invokes `TokenQuotaGuard` (spy count 1); completed replay does NOT re-invoke quota; replay succeeds even with quota spy forced false; no second enqueue; one relational `(userId, requestId)` row across replays.
- **deterministic-replay:** completed persisted replay = HTTP 200 exact output/tokens/model; metadata `aiExecutionResult` JSON round-trip verified in the row; multiple replays byte-identical (`toEqual` on bodies); 10,000-char and special-character outputs preserved; one row (relational uniqueness); quota not re-invoked; backward-compatible fallback `[Duplicate request - original response not stored]` for rows without `metadata.aiExecutionResult`.
- **orphan:** young pending (<5min) → 409 with pending row intact; old pending (>5min) transitioned through CURRENT `IdempotencyGuard.transitionOrphanToTimeout` then retry 202/queued; `reuseExecutionIntent` preserves one logical row (old executionId gone, no residual timeout row, count=1); completed replay after retry deterministic and quota-bypassing.

## 16. Fresh Class 2 targeted result (Step 3, 2026-08-27)

```
Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
Time:        5.845 s
```

Matches expected prior evidence (23). CLASS2_TARGETED=PASS.

## 17. Fresh Class 1 regression result (Step 3, 2026-08-27)

```
Test Suites: 5 passed, 5 total
Tests:       61 passed, 61 total
Time:        6.067 s
```

(`auth.service.verify` + `auth.service.reset` + `users.integration` + `ai-execution-idempotency.integration` + `execution-safety.integration`.) CLASS1_REGRESSION=PASS.

## 18. Fresh gateway build (Step 3)

`npm run build` (tsc) — exit 0. GATEWAY_BUILD=PASS. No tracked-artifact dirt after build.

## 19. Fresh broad non-live gate (Step 3, 2026-08-27)

```
Command: npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
Test Suites: 1 skipped, 167 passed, 167 of 168 total
Tests:       6 skipped, 2115 passed, 2121 total
Time:        44.959 s
```

| Metric | Value |
|---|---|
| Total suites | 168 |
| Passed suites | 167 |
| Skipped suites | 1 |
| Failed suites | 0 |
| Total tests | 2121 |
| Passed tests | 2115 |
| Skipped tests | 6 |
| Failed tests | 0 |

BROAD_NONLIVE_GATE=PASS. FAILED_SUITES=0. FAILED_TESTS=0.

## 20. Only smoke excluded

YES — the ignore pattern was exactly `smoke.integration.spec.ts`. No Class 2 filename in any ignore. No extra excludes. No external Postgres.

## 21. Existing skip classification

The 1 skipped suite / 6 skipped tests are entirely `src/billing/credit-deduction/__tests__/credit-deduction-concurrency.integration.spec.ts` — pre-existing intentional opt-in live-Postgres suite (`describe.skip` unless `RUN_CREDIT_DB_INTEGRATION=true`; exactly 6 `it()` cases). Unrelated to Class 2. CLASS2_SKIPS_INTRODUCED=NO.

## 22. Production edits

PRODUCTION_SOURCE_FILES_CHANGED=0. Verified by `git status --short` / `git diff --name-only`: only the five §10 test files dirty. `AIExecutionController`, `UsageLedgerService`, `IdempotencyGuard`, `UsageRecord`, filter, guards all UNMODIFIED.

## 23. Package / config / migration edits

PACKAGE_FILES_CHANGED=0. CONFIG_FILES_CHANGED=0. MIGRATIONS_CHANGED=0. No `package.json` / lockfile / `jest.config.js` / `.env` / compose / migration dirt.

## 24. External runtime

EXTERNAL_RUNTIME_USED=0. No Docker, PostgreSQL, Redis, provider calls, LIVE, staging, SSH, browser smoke, or dev servers. In-process `better-sqlite3` only (existing dependency; not an external runtime).

## 25. Git worker mutations

0. Read-only Git only (`branch --show-current`, `rev-parse`, `status`, `diff --name-only`, `diff --check`). Keith owns Git. `git diff --check` = PASS (no whitespace errors; informational CRLF warnings only).

## 26. GATEWAY-TEST-FIXTURE-02 conclusion

```
GATEWAY-TEST-FIXTURE-02 = COMPLETE AND LOCKED — PASS — 2026-08-27
STEP 1  COMPLETE (2026-08-24)
STEP 2A STOPPED — rejected direct production-entity SQLite architecture (2026-08-27)
STEP 2R COMPLETE — revised architecture frozen (2026-08-27)
STEP 2B COMPLETE — five-file implementation (2026-08-27)
STEP 3  COMPLETE — independent verification + lock (2026-08-27)
```

The four pre-existing Postgres-dependent hybrid gateway suites are hermetic and green using a test-only portable EntitySchema with real relational persistence.

## 27. PILOT-2LANE-01 resume authorization

```
PILOT_2LANE_01_RESUME_AUTHORIZED=YES
```

Both resume conditions met at this lock: GATEWAY-TEST-FIXTURE-02 COMPLETE AND LOCKED, and the fresh broad non-live gate passed with only smoke excluded. Pilot blocker state changes to:

```
PILOT-2LANE-01 = PAUSED — BLOCKER CLEARED — READY FOR SEPARATE STEP 4 RESUME LIFECYCLE — NOT LOCKED
```

This Step 3 does NOT resume or execute PILOT-2LANE-01 Step 4 (no PRD/ARCHITECTURE patches, no pilot checkpoint/lock here). Step 4 requires its own separate lifecycle.

## 28. Lane 3

DISABLED. This task was serialized blocker remediation, not a third source lane.

## 29. Invitations

PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. LIVE_STAGING_VALIDATED=YES. BUILDER_PRIVATE_BETA_READINESS=GO. All runtime authorization flags remain NO.

## 30. Exact successor

**PILOT-2LANE-01 Step 4 resume lifecycle** (separate, control-plane-led: consolidation, serialized integrated validation, bounded PRD.md §3.I / ARCHITECTURE.md §13.2 one-line patches, pilot concurrency review, LOCK). Preserved other state: AGENT-PLATFORM-CREATE-01C LANE-DONE / NOT LOCKED; I18N-SHELL-06 LANE-DONE / NOT LOCKED; GATEWAY-TEST-FIXTURE-01 COMPLETE AND LOCKED.

---

## Step 3 activity ledger

```
LIVE=0
SSH=0
staging=0
provider=0
credits=0
runtime=0
Docker=0
Postgres=0
Redis=0
dev servers=0
browser smoke=0
production implementation=0
test implementation=0 (Step 3 verified; did not modify the five Step 2B files)
dependencies=0
migrations=0
PRD.md=0
ARCHITECTURE.md=0
Git mutations=0
PILOT Step 4 resumed=NO (resume AUTHORIZED for a separate lifecycle only)
Lane 3=DISABLED
invitation registration=0
tests executed=YES (Class 2 four-suite targeted; Class 1 five-suite regression; broad non-live gate; all --runInBand, no Postgres)
```

## Blocker after lock

Keith owns Git. Commit this Step 3 state (`TASKS.md` board, `TASKS_BACKLOG_FULL.md` GATEWAY-TEST-FIXTURE-02 final body + pilot blocker mirror, the five implementation files, `docs/GATEWAY-TEST-FIXTURE-02-CHECKPOINT.md`). The PILOT-2LANE-01 Step 4 resume lifecycle must start in a fresh window after commit with a clean tree.
