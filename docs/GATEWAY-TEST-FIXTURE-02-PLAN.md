# GATEWAY-TEST-FIXTURE-02 — Class 2 Non-Live TypeORM/Jest Repair — Step 1 Plan / Architecture Freeze

**Task ID:** GATEWAY-TEST-FIXTURE-02
**Title:** Class 2 Non-Live TypeORM/Jest Repair (hermetic UsageRecord persistence for four AI-execution integration suites)
**Step:** 1 — Registration + exact root-cause + hermetic-test architecture freeze
**Date:** 2026-08-24
**Status:** Step 1 COMPLETE — Step 2 PENDING — IMPLEMENTATION NOT STARTED
**Family:** RELIABILITY / TEST FIXTURE (taxonomy only; zero admission weight)
**Workstream:** RELIABILITY (taxonomy only; zero admission weight)
**Lifecycle:** 3-step (registration + freeze → test-only implementation + validation → checkpoint / lock + PILOT-2LANE-01 Step 4 resume authorization)
**Evidence class:** LOCAL-TESTS
**Nature:** TEST ARCHITECTURE / FIXTURE ONLY — zero production behavior change, zero runtime, zero provider, zero credit, zero staging, zero Git mutation in this step

Step 1 pre-write observation (read-only):

```
branch = main
HEAD   = 08ec2f288e7262236145c638e0844b9ee0e0f74e
         update GATEWAY-TEST-FIXTURE-01 status to COMPLETE AND LOCKED; document verification results and next steps in checkpoint
git status --short = empty (CLEAN)
git log -5:
  08ec2f2 update GATEWAY-TEST-FIXTURE-01 status to COMPLETE AND LOCKED; document verification results and next steps in checkpoint
  d940294 register gateway test fixture repair
  9e7075d complete first two-lane pilot implementations
  b7d91a5 admit first two-lane pilot
  00d9d9b register first two-lane pilot
```

---

## 1. Task identity / date

| Field | Value |
|---|---|
| Task | GATEWAY-TEST-FIXTURE-02 |
| Date | 2026-08-24 |
| Step | 1 COMPLETE — architecture frozen; implementation NOT started |
| Identifier resolution | NEW. See §1a |

### 1a. Identifier-resolution evidence

Authoritative search (this window, before registration):

| Query | Result |
|---|---|
| Repo-wide `GATEWAY-TEST-FIXTURE` | Only GATEWAY-TEST-FIXTURE-01 (plan + checkpoint + board/registry). Class 1 LOCKED. |
| Repo-wide `GATEWAY-TEST-FIXTURE-02` | **zero matches** |
| `PRE_EXISTING_LIVE_TYPEORM_FORROOT_IN_NONLIVE_JEST` as an owned task ID | Classification string only; not a task identifier |
| TASKS_BACKLOG_FULL `^### GATEWAY-TEST` | Only `### GATEWAY-TEST-FIXTURE-01` |
| GATEWAY-TEST-FIXTURE-01 checkpoint / board | Class 2 = UNRESOLVED / SEPARATE TASK REQUIRED / **NOT REGISTERED HERE**. Explicit: do not invent the identifier in that lock. |

No existing canonical task owns “the four TypeORM/Postgres-dependent Jest integration suites becoming hermetic for the non-live gateway validation gate.”

GATEWAY-TEST-FIXTURE-02 is the next non-conflicting identifier in the existing family. It does **not** reopen Class 1.

---

## 2. Discovery source

Discovered during **PILOT-2LANE-01 Step 4** integrated validation.

Separated (not repaired) by **GATEWAY-TEST-FIXTURE-01**.

Fresh Class 2 confirmation in this Step 1 used the four-suite targeted command (not the full broad suite). PostgreSQL was not started.

---

## 3. Predecessor Class 1 lock

```
GATEWAY-TEST-FIXTURE-01 = COMPLETE AND LOCKED — PASS — 2026-08-24
Checkpoint = docs/GATEWAY-TEST-FIXTURE-01-CHECKPOINT.md
Class 1 = REPAIRED / GREEN (5 suites / 61 tests)
Class 1 classification = PRE_EXISTING_NEST_TESTINGMODULE_FIXTURE_DRIFT
Class 1 = CLOSED. Do not reopen.
```

Class 1 repaired Nest `TestingModule` DI drift. It explicitly left Class 2 out of scope.

---

## 4. Pilot paused state (preserved)

```
PILOT-2LANE-01 = PAUSED / NOT LOCKED / RESUME_AUTHORIZED=NO
AGENT-PLATFORM-CREATE-01C = LANE-DONE / NOT LOCKED
I18N-SHELL-06 = LANE-DONE / NOT LOCKED
Lane 3 = DISABLED
PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
LIVE_STAGING_VALIDATED=YES
BUILDER_PRIVATE_BETA_READINESS=GO
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

This registration does **not** resume PILOT-2LANE-01 Step 4.

---

## 5. Fresh reproduction

PowerShell 5.x. No Docker / PostgreSQL / Redis / provider / LIVE / staging / browser / dev servers.

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts src/ai/__tests__/ai-execution-two-phase.integration.spec.ts --runInBand
```

Result (2026-08-24, HEAD `08ec2f2`):

```
Test Suites: 4 failed, 4 total
Tests:       22 failed, 1 passed, 23 total
Time:        5.897 s
```

The 1 “passed” test is **vacuous**: two-phase `should write execution intent BEFORE ai-service call` hits `if (!app) return` after the DATABASE_URL skip. It is not a product assertion pass.

---

## 6. Exact four failing suites

All paths relative to `services/api-gateway/`:

| # | Suite | `it()` count | Fresh outcome |
|---|---|---|---|
| 1 | `src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts` | 7 | 7 failed |
| 2 | `src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts` | 6 | 6 failed |
| 3 | `src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts` | 5 | 5 failed |
| 4 | `src/ai/__tests__/ai-execution-two-phase.integration.spec.ts` | 5 | 4 failed, 1 vacuous pass |

---

## 7. Exact failed test count

**22 failed tests** across **4 failed suites**.

Matches GATEWAY-TEST-FIXTURE-01 Step 3 remaining red (22). The Step 1 Class 2 inventory of 23 counted all two-phase `it()`s; one is the vacuous skip-return. Do not treat 22-vs-23 as a new failure class.

No test in any of the four suites reached a product assertion before fixture failure.

---

## 8. Root cause per suite

### Shared classification

```
ROOT_CAUSE = PRE_EXISTING_LIVE_TYPEORM_FORROOT_IN_NONLIVE_JEST
PILOT_CAUSED = NO
PRODUCTION_CODE_FIX_REQUIRED = NO
TEST_ARCHITECTURE_ONLY = YES
RUNTIME_REQUIRED_AS_WRITTEN = YES (Postgres) — forbidden for this gate
RUNTIME_REQUIRED_FOR_REPAIR = NO
```

These are **old hybrid HTTP+TypeORM tests** that accidentally became live-Postgres-dependent. They are **not** true live-DB integration tests (those already exist as opt-in `RUN_CREDIT_DB_INTEGRATION` postgres DataSource tests). They are also **not** already hermetic component tests (those already exist as mocked `ai-execution-idempotency.integration.spec.ts`).

### 1. Deterministic replay

- **TestingModule:** local `Test.createTestingModule` with `TypeOrmModule.forRoot` + `forFeature([UsageRecord])` + real `AIExecutionController` + real `UsageLedgerService` + real `IdempotencyGuard`.
- **forRoot path:** **direct**. `TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, entities: [UsageRecord], synchronize: true, retryAttempts: 0, retryDelay: 0 })`.
- **Indirect AppModule forRoot:** no.
- **DATABASE_URL:** `import 'dotenv/config'` then `process.env.DATABASE_URL` with **no fallback**. Fresh run: TypeORM still attempts Postgres TCP (`Unable to connect to the database` / empty `AggregateError`).
- **Postgres access:** unconditional at `beforeAll` compile. No skip.
- **First error:** TypeORM connect `AggregateError` at module setup. All 7 tests fail there. Product assertions never run.
- **Entities/repos exercised (intended):** `UsageRecord` via TypeORM repository + `UsageLedgerService`.
- **spyOn:** `aiServiceHttpClient.execute` after init — never reached.

### 2. Orphan reconciliation

- **TestingModule:** same pattern. Direct `TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL, ... })`.
- **dotenv:** `dotenv.config()` (17 vars injected; `DATABASE_URL` still unset for TypeORM connect).
- **Postgres access:** unconditional. No skip.
- **Additional Postgres-specific SQL:** `dataSource.query(\`UPDATE usage_records SET execution_status = 'timeout' WHERE execution_id = $1\`, ...)`.
- **First error:** TypeORM connect `AggregateError` at module setup. All 6 tests fail there.

### 3. Replay quota bypass

- **TestingModule:** same pattern. Direct `TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL \|\| 'postgresql://postgres:postgres@localhost:5432/aisandbox_test', ... })`.
- **DATABASE_URL:** hardcoded **localhost Postgres fallback** when unset. Unconditional TCP to `localhost:5432`.
- **No skip.**
- **First error:** TypeORM connect `AggregateError` at module setup. All 5 tests fail there.

### 4. Two-phase

- **TestingModule:** same `TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DATABASE_URL \|\| 'postgresql://postgres:postgres@localhost:5432/aisandbox_test', ... })` **inside** `beforeAll`.
- **Skip:** `if (!process.env.DATABASE_URL && !process.env.CI) { console.warn(...); return; }` — **does not call `describe.skip` / `it.skip`**. Module is never compiled. `app` and `aiServiceHttpClient` stay `undefined`.
- **Fresh run:** skip fired (`DATABASE_URL` unset, `CI` unset).
- **First test** has `if (!app) return` → vacuous pass.
- **Other four tests** have **no** `if (!app)` guard → `jest.spyOn(aiServiceHttpClient, 'execute')` → `Cannot use spyOn on a primitive value; undefined given`.
- **Product assertions never run.**

---

## 9. Shared root cause or subgroups

**One shared root cause.** All four suites construct Nest with **direct** `TypeOrmModule.forRoot({ type: 'postgres', ... })` against an external PostgreSQL that the non-live gate forbids.

Subgroups (same class, different surface):

| Subgroup | Suites | Connect behavior |
|---|---|---|
| Unconditional Postgres forRoot | deterministic, orphan, replay-quota | TCP `AggregateError` at compile |
| Broken skip (return without skipping tests) | two-phase | skip-return → `spyOn(undefined)` |

Latent fixture defects **masked** by the connect/skip failure (must be repaired in the same four files once the DB fixture is hermetic; **not** independent root causes):

1. Current `AIExecutionController` constructor requires `QueueService`, `ExecutionResultService`, `ExecutionStreamService`, `UserAiInstructionsService`, `ProjectAiContextService`, `SessionService`. These suites still provide the obsolete `AIServiceHttpClient` execute path.
2. `@UseGuards(..., CreditBalanceGuard, ...)` is not `overrideGuard`'d (Class 1 Batch C pattern).
3. Assertions still expect in-request `HttpStatus.OK` + `body.output` from `AIServiceHttpClient.execute`. Current production is **202 ACCEPTED / `status: 'queued'`** after `writeExecutionIntent` + `queueService.enqueueExecution`. Replay of a **completed** row still returns **HTTP 200** via `IdempotentReplayExceptionFilter`.

---

## 10. spyOn(undefined) trace

```
Object that is undefined = aiServiceHttpClient
Why = beforeAll returned early (DATABASE_URL skip); moduleFixture.get(AIServiceHttpClient) never ran
Caused by DB setup skip = YES
Independent fixture defect = NO
```

`aiServiceHttpClient` is declared `let aiServiceHttpClient: AIServiceHttpClient` and is only assigned after `app.init()`. Skip-return leaves it undefined.

Expected repair: make the fixture hermetic so `beforeAll` always initializes the module. **Do not** independently patch `spyOn`. After hermetic init, `AIServiceHttpClient` is also no longer a controller constructor dependency; Step 2 must stop spying on a client the HTTP path does not call (see §11 / §15).

---

## 11. Original intended test semantics (must remain meaningful)

These suites are supposed to prove **real `IdempotencyGuard` + real `UsageLedgerService` + real `UsageRecord` persistence** through HTTP, not a mocked ledger.

### Deterministic replay (PHASE-43B-3)

Must remain meaningful:

- Replay of a **completed** record returns HTTP 200 with **exact** stored `metadata.aiExecutionResult` (deep equality).
- Multiple replays stay identical; **one** `(userId, requestId)` row.
- Quota guards are **not** invoked on completed replay.
- Records **without** `metadata.aiExecutionResult` fall back to `[Duplicate request - original response not stored]`.
- Long text / special characters round-trip through JSON metadata.

Current-contract retarget (allowed; same class as GATEWAY-TEST-FIXTURE-01 Batch C):

- First `POST /ai/execute` now returns **202 queued** and writes **pending**, not completed output. Do **not** keep asserting first-call `200` + `body.output`.
- Completed-replay: persist a completed row (seed or call real `updateExecutionResult` against the hermetic DB to simulate worker completion), then HTTP replay → 200 exact body.
- Do **not** spy `AIServiceHttpClient.execute` as the in-request AI path; that path is gone.

### Orphan reconciliation (PHASE-43B-4 + HOTFIX)

Must remain meaningful:

- Young `pending` → HTTP **409** `Execution in progress`; row stays pending.
- Orphan (`pending` older than 5 minutes) → `transitionOrphanToTimeout` then retry allowed.
- Retry after timeout **reuses** the row (`reuseExecutionIntent`); **row count = 1**; old `executionId` does not remain as a second billable row.
- After successful retry (now **202 queued** + pending-or-reused row), a later completed replay still bypasses quota and is deterministic.

Replace Postgres `$1` raw SQL with TypeORM `repository.update` / service `transitionOrphanToTimeout` (test-only). Do not keep driver-specific SQL.

### Replay quota bypass (PHASE-43B-2-HOTFIX)

Must remain meaningful:

- First request **does** invoke `TokenQuotaGuard`.
- Completed replay **does not** invoke `TokenQuotaGuard` (exception terminates the guard pipeline).
- Replay succeeds even if the quota spy would return false.
- DB row count for `(user_id, request_id)` remains 1.
- Replay does not call the worker/provider again (`enqueueExecution` not called on completed replay).

First-call success body is **202 queued**, not `output`. Replay of completed still **200**.

### Two-phase (PHASE-43B-2 / current 44.4D)

Must remain meaningful against **current** production:

- Intent is written **before** `queueService.enqueueExecution` (`pending` visible; `model` / `tokensUsed` / `executionDurationMs` null).
- Second request while pending → **409**.
- After completion (seeded/worker-simulated), same key → cached 200, one row.
- If enqueue fails after intent write → HTTP 500, **pending remains** (current equivalent of “failure leaves pending”).
- Queued success without a worker → pending remains visible (current financial-integrity property). Do **not** keep spying `UsageLedgerService.prototype.updateExecutionResult` as an in-request controller step; the HTTP path no longer calls it.

Do **not** convert these into shallow `UsageLedgerService` mocks. Passing `ai-execution-idempotency.integration.spec.ts` already covers mocked-ledger HTTP/controller behavior. Class 2 exists to keep **relational persistence** (unique `(user_id, request_id)`, status transitions, JSON metadata, row reuse).

---

## 12. Why external Postgres is invalid for the non-live gate

The blocker command is:

```
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

That command is **NON-LIVE**. It must not start PostgreSQL, Docker, Redis, providers, staging, or LIVE.

`smoke.integration.spec.ts` is the **only** allowed exclusion (it is the live-runtime suite). Class 2 filenames must **not** be added to `testPathIgnorePatterns`.

`credit-deduction-concurrency.integration.spec.ts` is already opt-in live Postgres (`RUN_CREDIT_DB_INTEGRATION=true`). That skip pattern is **not** the repair: it would leave these four suites red or excluded.

---

## 13. Working repository patterns compared

| Pattern | Where | What it proves | Fit for Class 2 |
|---|---|---|---|
| Repository / provider mocks + `overrideGuard` | Passing `ai-execution-idempotency.integration.spec.ts`, `ai-execution.controller.integration.spec.ts`, `execution-safety.integration.spec.ts` (Class 1), `usage-ledger.service.spec.ts`, `idempotency.guard.spec.ts` | Current 202/queued constructor wiring; guard order; mocked ledger | **Insufficient alone** — no unique index, no row reuse, no JSONB round-trip |
| `getRepositoryToken` mocks | Many service specs | Unit isolation | Same weakening |
| Opt-in live Postgres `new DataSource({ type: 'postgres' })` | `credit-deduction-concurrency.integration.spec.ts` | True Postgres concurrency | **Forbidden** here (external runtime) |
| Production `AppDataSource` | `services/api-gateway/data-source.ts` | Production Postgres | **Forbidden** |
| Raw `better-sqlite3` Database | `sqlite-database-path.spec.ts` (already passing under this Jest), invoices/admin services | File/dir SQLite, not TypeORM `UsageRecord` | Proves **Jest can load `better-sqlite3` with current `jest.config.js`**. Does **not** by itself provide TypeORM repositories |
| TypeORM `forRoot` sqlite/better-sqlite3 in tests | **None in this repo** | — | No existing helper to reuse |
| Skip on missing `DATABASE_URL` | two-phase (broken); credit opt-in (working skip) | Avoid live DB | **Invalid** as the gate repair |

`better-sqlite3` is already in `services/api-gateway/package.json` dependencies (`^12.5.0`). No new dependency. Current Jest config has no special transform ignore; the existing sqlite path spec already imports it.

---

## 14. Options evaluated

### A. Existing repo-standard repository/provider mocks

| Criterion | Rating |
|---|---|
| Preserves test meaning | **Poor** — drops unique constraint, row reuse, JSON metadata persistence, pending 409 against real rows |
| No external runtime | Excellent |
| Minimal scope | Good (four files) |
| Production fidelity | Poor for ledger semantics |
| Deterministic | Excellent |
| Complexity | Low |
| Hidden coupling | Low |
| Reversibility | Excellent |
| Broad-suite compatibility | Excellent |

**Reject.** Would duplicate Class 1 / passing idempotency mocks and weaken Class 2’s reason to exist.

### B. Hermetic in-process TypeORM `better-sqlite3` `:memory:`

Replace each suite’s `TypeOrmModule.forRoot({ type: 'postgres', url: ... })` with:

```
TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [UsageRecord],
  synchronize: true,
  dropSchema: true,
  retryAttempts: 0,
  retryDelay: 0,
})
```

Keep **real** `UsageLedgerService` + **real** `IdempotencyGuard` + `forFeature([UsageRecord])`. Mock only non-ledger current constructor deps (`QueueService`, session/instructions/stream/result) and `overrideGuard(CreditBalanceGuard)` passthrough. Retarget assertions to current 202/queued vs completed-replay 200.

| Criterion | Rating |
|---|---|
| Preserves test meaning | **Good** — real repository, unique index, status UPDATE, JSON metadata, row reuse |
| No external runtime | Excellent (in-process library already depended on) |
| Minimal scope | Excellent (four suite files only; no new helper) |
| Production fidelity | Medium-high (SQLite ≠ Postgres; unique/JSON/status ops used here are portable). `isUniqueViolation` is Postgres `23505`; Class 2 retry-after-timeout uses `reuseExecutionIntent` UPDATE, not the unique-violation insert fallback |
| Deterministic | Excellent |
| Complexity | Medium (current-contract fixture wiring + assertion retarget) |
| Hidden coupling | Medium (TypeORM sqlite mapping of `uuid` / `jsonb`) |
| Reversibility | Excellent (test files only) |
| Broad-suite compatibility | Excellent if synchronize succeeds |

**Select.**

**Step 2 STOP if:** `synchronize` fails on `UsageRecord` `uuid` / `jsonb` under better-sqlite3. Do **not** edit `usage-record.entity.ts`. Do **not** add a package. Return to control plane.

### C. Dedicated test DataSource helper already present

**None exists** for TypeORM sqlite. Live Postgres DataSource helper is the opt-in credit suite. Creating a new shared helper is **not** required and is forbidden as an aesthetic extra file.

### D. Other established pattern (skip / exclude / live Postgres)

Skip, extra jest ignore, or starting Postgres: **Reject.** Would not clear the declared gate, or would violate NON-LIVE.

---

## 15. Selected hermetic repair architecture

```
SELECTED = B
TypeOrmModule.forRoot better-sqlite3 :memory: + real UsageLedgerService + real IdempotencyGuard + real UsageRecord repository
QueueService / SessionService / sibling services = mocks (current constructor)
CreditBalanceGuard = overrideGuard passthrough (suite is not credit-gating)
Assertions retargeted to CURRENT 202 queued / pending intent / completed-replay 200
AIServiceHttpClient.execute spies removed from the HTTP path
two-phase DATABASE_URL skip removed (always hermetic)
orphan $1 SQL replaced with TypeORM repository/service update
```

Why this preserves meaning: the invariants that justified a real DB (one row per `(userId, requestId)`, pending 409, orphan → timeout → row reuse, JSON metadata exact replay, quota bypass via `IdempotentReplayException`) still execute against TypeORM persistence. Mocks are limited to services the suites were never proving (queue, session lookup, credit guard).

---

## 16. Exact writable files (Step 2 freeze — no wildcards)

```
services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts
```

No fifth helper file. No other test files. No production files. No `jest.config.js`. No `package.json`. No `.env`. No migrations. No PRD/ARCHITECTURE.

---

## 17. Exact read-only production / pattern references

Step 2 may **read**, never write:

```
services/api-gateway/src/ai/ai-execution.controller.ts
services/api-gateway/src/ai/idempotency.guard.ts
services/api-gateway/src/ai/idempotent-replay.exception.ts
services/api-gateway/src/filters/idempotent-replay-exception.filter.ts
services/api-gateway/src/usage-ledger/usage-ledger.service.ts
services/api-gateway/src/entities/usage-record.entity.ts
services/api-gateway/src/billing/credit-balance.guard.ts
services/api-gateway/src/queue/queue.service.ts
services/api-gateway/src/sessions/session.service.ts
```

Read-only **pattern references** (do not edit):

```
services/api-gateway/src/ai/__tests__/ai-execution-idempotency.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts
services/api-gateway/src/safety/execution-safety.integration.spec.ts
services/api-gateway/src/ai/idempotency.guard.spec.ts
services/api-gateway/src/common/sqlite-database-path.spec.ts
services/api-gateway/jest.config.js
services/api-gateway/package.json
```

---

## 18. Production-code prohibition

```
PRODUCTION_SOURCE_CHANGES = 0
```

Do not change `AIExecutionController`, `UsageLedgerService`, `IdempotencyGuard`, `UsageRecord`, credit, queue, or auth to make tests easier.

If a production-source change appears necessary (including entity-type changes for sqlite synchronize): **STOP**. Do not implement.

Assertion updates are allowed **only** where the frozen fixture asserts a DTO/status/call shape current production no longer has (202/queued vs obsolete in-request 200+output; enqueue vs execute spy). That is contract-accurate, not assertion weakening.

---

## 19. Runtime prohibition

Do not use Docker, PostgreSQL, Redis, provider calls, LIVE, staging, browser smoke, or dev servers.

`better-sqlite3` in-process is not an external runtime.

---

## 20. Package / config boundary

```
package.json changes = NO
lockfile changes = NO
root/service Jest config changes = NO (default)
TypeORM production config changes = NO
.env changes = NO
migrations = NO
new dependencies = NO
```

No dedicated test-only config change is required at freeze time: `better-sqlite3` is already a gateway dependency and already loads under current Jest.

If Step 2 empirically needs a Jest config change: **STOP** and return to control plane. Do not silently expand scope.

---

## 21. Step 2 batching

**One common fixture architecture**, applied **sequentially suite-by-suite** (green each file before the next):

| Order | Suite | Why this order |
|---|---|---|
| 1 | two-phase | Smallest; proves hermetic forRoot + current constructor + pending/409/enqueue; removes skip/`spyOn(undefined)` |
| 2 | replay-quota-bypass | Adds TokenQuotaGuard spy + completed-replay 200 vs first-call 202 |
| 3 | deterministic-replay | Adds JSON metadata exact replay / fallback / long/special text |
| 4 | orphan-reconciliation | Adds age/timeout/reuse/row-count; replace `$1` SQL |

Do not implement all four in one uncontrolled edit. Shared architecture, sequential validation.

---

## 22. Targeted validation commands (Step 2)

PowerShell 5.x. `--runInBand`. After each suite:

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"

npx jest src/ai/__tests__/ai-execution-two-phase.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts --runInBand

npx jest src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts --runInBand
```

All four together:

```
npx jest src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts src/ai/__tests__/ai-execution-two-phase.integration.spec.ts --runInBand
```

Gateway build:

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
```

Write-set / whitespace audit:

```
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
git -C "C:\Users\knlee\aiSandBox2026B" diff -- "services/api-gateway/src" ":!services/api-gateway/src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-two-phase.integration.spec.ts"
```

The last `git diff` must show **zero production source edits**.

---

## 23. Broad-gate command

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

Required result: **0 failed suites, 0 failed tests**. Only `smoke.integration.spec.ts` excluded. No Class 2 exclusion. No PostgreSQL.

This command is the **PILOT resume bar**. Step 2 should run it. Step 3 independently re-runs it before lock / resume authorization.

---

## 24. Completion standard

GATEWAY-TEST-FIXTURE-02 is complete only when:

- All four frozen suites PASS (no vacuous `if (!app) return`)
- Broad non-live suite PASS with only smoke excluded
- `PRODUCTION_SOURCE_FILES_CHANGED=0`
- package/config/migration/PRD/ARCHITECTURE diffs = 0
- Gateway `npm run build` PASS
- `git diff --check` PASS
- Runtime = 0

---

## 25. Pilot resume criterion

PILOT-2LANE-01 Step 4 may resume **only** after GATEWAY-TEST-FIXTURE-02 Step 3 lock when:

1. GATEWAY-TEST-FIXTURE-01 remains COMPLETE AND LOCKED (already true), **and**
2. GATEWAY-TEST-FIXTURE-02 is COMPLETE AND LOCKED, **and**
3. Fresh broad command in §23 is green with no extra excludes.

This Step 1 does **not** grant resume. Step 2 must **not** self-declare LOCKED or resume.

---

## 26. Lane 3 state

Lane 3 = **DISABLED**. This task is serialized blocker remediation, **not** a 3rd source lane. It cannot enable Lane 3.

---

## 27. Invitation state

PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED.

---

## Mutex / admission (serialized blocker)

- No parallel source lane. Lanes 1–2 remain occupied LANE-DONE.
- This is **not** implementation-lane admission.
- GOVERNANCE: held for this Step 1 registration write, then released UNOWNED.
- Step 2 later owns **GATEWAY test surface only** (the four files in §16). Production gateway source remains READ ONLY.
- GATEWAY today remains owned by AGENT-PLATFORM-CREATE-01C (LANE-DONE). Step 2 may take GATEWAY for the frozen test files because 01C will not write further; 01C’s exclusive 4-file write set stays frozen.
- FRONTEND + I18N stay with I18N-SHELL-06.
- No LOCAL-RUNTIME / STAGING / PROVIDER-LIVE / CREDIT / ENV / PACKAGE / COMPOSE / MIGRATION.
- Hot-file leases: the four §16 paths during Step 2 only.

---

## Step 1 activity ledger

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
test implementation=0
dependencies=0
migrations=0
PRD.md=0
ARCHITECTURE.md=0
Git mutations=0
PILOT Step 4 resumed=NO
Lane 3=DISABLED
invitation registration=0
tests executed=YES (four Class 2 suites together, --runInBand, no Postgres)
```

---

## Blocker before Step 2

Keith owns Git. Step 2 must not start until Keith commits this Step 1 governance state (`TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` GATEWAY-TEST-FIXTURE-02 body + minimal PILOT mirror, `docs/GATEWAY-TEST-FIXTURE-02-PLAN.md`) and `git status --short` is empty. Open a **new** Cursor window for Step 2. Do not implement fixtures in the Step 1 window.
