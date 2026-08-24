# GATEWAY-TEST-FIXTURE-01 — Pre-Existing Gateway Nest TestingModule Fixture Repair — Step 1 Plan / Scope Freeze

**Task ID:** GATEWAY-TEST-FIXTURE-01
**Title:** Pre-Existing Gateway Nest TestingModule Fixture Repair
**Step:** 1 — Registration + exact failure / root-cause / scope freeze
**Date:** 2026-08-24
**Status:** Step 1 COMPLETE — Step 2 PENDING — IMPLEMENTATION NOT STARTED
**Family:** RELIABILITY / TEST FIXTURE (taxonomy only; zero admission weight)
**Workstream:** RELIABILITY (taxonomy only; zero admission weight)
**Lifecycle:** 3-step (registration + freeze → test-fixture implementation + verification → consolidation / checkpoint / lock + PILOT-2LANE-01 Step 4 resume authorization)
**Evidence class:** LOCAL-TESTS
**Nature:** TEST FIXTURE / PROVIDER WIRING ONLY — zero production behavior change, zero runtime, zero provider, zero credit, zero staging, zero Git mutation in this step

Step 1 pre-write observation (read-only):

```
branch = main
HEAD   = 9e7075d2328d691b59a2401640a481d566589cc0
         complete first two-lane pilot implementations
git status --short = empty (CLEAN)
git log -5:
  9e7075d complete first two-lane pilot implementations
  b7d91a5 admit first two-lane pilot
  00d9d9b register first two-lane pilot
  113ad6f lock GOV-PRD-02 product requirements
  6322b8f reconcile authoritative product requirements
```

Identifier search: repo-wide `GATEWAY-TEST-FIXTURE` = zero matches before this registration. GATEWAY-TEST-FIXTURE-01 is new.

---

## 1. Discovery source

Discovered during **PILOT-2LANE-01 Step 4 integrated validation**.

PILOT-2LANE-01 remains **PAUSED / NOT LOCKED**. This registration does **not** resume PILOT-2LANE-01 Step 4.

Both implementation lanes are **LANE-DONE / NOT LOCKED** and are preserved in the combined Keith-owned Git checkpoint:

```
9e7075d complete first two-lane pilot implementations
```

Pilot exclusive files in that commit (unrelated to the failing suites):

```
frontend/components/workspace/workspace-shell.tsx
frontend/components/workspace/workspace-shell.test.tsx
frontend/messages/en.json
frontend/messages/zh-TW.json
frontend/messages/zh-CN.json
services/api-gateway/src/user-agent/user-agent.controller.ts
services/api-gateway/src/user-agent/user-agent.service.ts
services/api-gateway/src/user-agent/__tests__/user-agent.controller.spec.ts
services/api-gateway/src/user-agent/__tests__/user-agent.service.spec.ts
```

---

## 2. Why PILOT-2LANE-01 is paused

Serialized Step 4 combined validation requires the broad non-live gateway suite:

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

That command is red. The redness is **not** caused by either pilot lane. PILOT-2LANE-01 Step 4 stays paused until the non-live gateway suite is actually green with **only** `smoke.integration.spec.ts` excluded.

Fresh evidence (this Step 1) proves the 9 failing suites are **two classes**, not one. GATEWAY-TEST-FIXTURE-01 repairs **only Class 1**. Class 2 remains a **separate unregistered blocker**. PILOT Step 4 cannot resume on this task alone.

---

## 3. Exact failing broad-suite command

Fresh reproduction (2026-08-24, `--runInBand`, no Docker / Postgres / Redis / provider / LIVE / staging / browser / dev servers):

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

Result:

```
Test Suites: 9 failed, 1 skipped, 158 passed, 167 of 168 total
Tests:       83 failed, 6 skipped, 2032 passed, 2121 total
Snapshots:   0 total
Time:        48.857 s
```

The 1 skipped suite is the excluded smoke suite (`src/__tests__/smoke.integration.spec.ts`). No additional exclusions were used.

Discovery's confirmation run that excluded smoke **plus** these 9 stale suites was reported as 158/158 suites PASS, 2031 tests PASS. Fresh passing remainder is **158 suites / 2032 tests**. The +1 passing test is the pilot user-agent surface added in `9e7075d` (those specs PASS). That delta does **not** create the 83 failures.

---

## 4. Exact failing suites (9)

All paths relative to `services/api-gateway/`:

| # | Suite | Tests | First compile/error class |
|---|---|---|---|
| 1 | `src/auth/__tests__/auth.service.verify.spec.ts` | 13 | Nest DI — `AuthService` missing `DataSource` index [4] |
| 2 | `src/auth/__tests__/auth.service.reset.spec.ts` | 7 | Nest DI — `AuthService` missing `DataSource` index [4] |
| 3 | `src/users/__tests__/users.integration.spec.ts` | 6 | Nest DI — `UsersService` missing `"PlanRepository"` index [1] |
| 4 | `src/ai/__tests__/ai-execution-idempotency.integration.spec.ts` | 7 | Nest DI — `CreditBalanceGuard` missing `CreditBalanceRepository` index [0] |
| 5 | `src/safety/execution-safety.integration.spec.ts` | 27 | Nest DI — `CreditBalanceGuard` missing `CreditBalanceRepository` index [0] |
| 6 | `src/ai/__tests__/ai-execution-deterministic-replay.integration.spec.ts` | 7 | TypeORM `forRoot` Postgres TCP `AggregateError` |
| 7 | `src/ai/__tests__/ai-execution-orphan-reconciliation.integration.spec.ts` | 6 | TypeORM `forRoot` Postgres TCP `AggregateError` |
| 8 | `src/ai/__tests__/ai-execution-two-phase.integration.spec.ts` | 5 | `DATABASE_URL` skip does not skip tests; `spyOn` on `undefined` |
| 9 | `src/ai/__tests__/ai-execution-replay-quota-bypass.integration.spec.ts` | 5 | TypeORM `forRoot` Postgres TCP `AggregateError` |

**Persistent failed test count: 83.** That equals the `it()` count across these 9 suites (13+7+6+7+27+7+6+5+5). Some suites also emit `afterEach` `app.close()` follow-on errors after compile failure; Jest still counts 83 failed tests.

---

## 5. Exact failing test count

- **Broad non-live run:** 83 failed / 2032 passed / 6 skipped / 2121 total
- **Class 1 (this task):** 60 tests across 5 suites
- **Class 2 (OUT OF SCOPE):** 23 tests across 4 suites

---

## 6. Exact root cause per suite

### Classification (fresh evidence; not forced)

```
ROOT_CAUSE (Class 1, 5 suites) = PRE_EXISTING_NEST_TESTINGMODULE_FIXTURE_DRIFT
PILOT_CAUSED = NO
PRODUCTION_CODE_FIX_REQUIRED = NO
TEST_FIXTURE_ONLY = YES
RUNTIME_REQUIRED = NO

ROOT_CAUSE (Class 2, 4 suites) = PRE_EXISTING_LIVE_TYPEORM_FORROOT_IN_NONLIVE_JEST
PILOT_CAUSED = NO
PRODUCTION_CODE_FIX_REQUIRED = NO
THIS_TASK = OUT OF SCOPE — STOP AND SEPARATE
RUNTIME_REQUIRED_TO_RUN_AS_WRITTEN = YES (Postgres) — forbidden here
```

Discovery expected Batch C = CreditBalanceGuard across five `ai-execution-*.integration.spec.ts` plus `execution-safety.integration.spec.ts`. Fresh first-error stacks **disagree**. Only **two** of those six are CreditBalanceGuard Nest DI. The other four call `TypeOrmModule.forRoot({ type: 'postgres', ... })` and fail at TCP connect (`Unable to connect to the database` / empty `AggregateError`). `ai-execution-two-phase.integration.spec.ts` prints `Skipping database-dependent integration test (DATABASE_URL not set)` then still runs tests against an uninitialized client.

**Do not bundle Class 2 into GATEWAY-TEST-FIXTURE-01.** Converting those suites to mocks, skipping them, or pointing them at live Postgres is a different task. This task must not start Docker/Postgres to make them pass.

### Class 1 — in scope

**A. `auth.service.verify.spec.ts` / `auth.service.reset.spec.ts`**

- Current `AuthService` constructor (`services/api-gateway/src/auth/auth.service.ts`): `User`, `OauthAccount`, `AuthSession`, `VerificationToken`, **`DataSource`**, `EMAIL_PROVIDER`.
- `this.dataSource.transaction` is used by `register` / Google / Apple create paths (lines 497, 558, 649).
- Stale fixtures provide the four repositories + `EMAIL_PROVIDER` only. Nest: `Nest can't resolve dependencies of the AuthService (..., ?, Symbol(EMAIL_PROVIDER)). Please make sure that the argument DataSource at index [4] is available`.
- Passing sibling `src/auth/auth.service.spec.ts` already provides `{ provide: DataSource, useValue: mockDataSource }` with a `transaction` callback. Production `auth.service.ts` is not failing; that sibling suite PASS.

**B. `users.integration.spec.ts`**

- Current `UsersService` constructor (`services/api-gateway/src/users/users.service.ts`): `User` repo, **`Plan` repo**, `QuotaService`.
- Stale fixture provides `User` + `QuotaService` only. Nest: `argument "PlanRepository" at index [1]`.
- Passing sibling `src/users/users.service.spec.ts` already provides `getRepositoryToken(Plan)`. Production `users.service.ts` is not failing.

**C. `ai-execution-idempotency.integration.spec.ts` / `execution-safety.integration.spec.ts`**

- `AIExecutionController` `@UseGuards(..., CreditBalanceGuard, ...)` (`src/ai/ai-execution.controller.ts`).
- Current `CreditBalanceGuard` constructor (`src/billing/credit-balance.guard.ts`): `CreditBalanceRepository`, `User` repo.
- These fixtures override sibling guards (quota, launch, abort, etc.) but **not** `CreditBalanceGuard`. Nest instantiates the real guard and cannot resolve `CreditBalanceRepository` at index [0].
- Passing siblings already call `.overrideGuard(CreditBalanceGuard).useValue(...)`.
- These suites are **not** testing credit-balance gating. Required repair is `overrideGuard(CreditBalanceGuard)` passthrough (`canActivate: true`), matching existing guard overrides. Do **not** instantiate the real guard (would require balance rows and would change suite behavior).
- Follow-on `app.close()` TypeError on `execution-safety` is a consequence of compile failure (`app` undefined), not a second product bug.

### Class 2 — OUT OF SCOPE (separate)

Suites 6–9 import `TypeOrmModule.forRoot` against real Postgres. First error is connection/`spyOn(undefined)`, **not** CreditBalanceGuard. They may also lack `CreditBalanceGuard` overrides, but that is unproven because compile never gets past TypeORM connect. Do not treat them as Batch C.

---

## 7. Proof failures predate pilot

| Production contract change | Commit | Date | Fixture last touched | Fixture date |
|---|---|---|---|---|
| `AuthService` gained `DataSource` | `96fe527` feat(billing): provision credit balances for new and existing users | 2026-08-06 | verify `091e030`; reset `dc932ba` | 2026-05-08 |
| `UsersService` gained `planRepository` | `cb71ea3` CO-02-01 Billing and Plans Foundation | 2026-04-04 | `users.integration.spec.ts` `46bbb8e` | 2026-03-11 |
| `CreditBalanceGuard` on AI execute `@UseGuards` | `9c94dc1` BILLING-READY-04A | 2026-07-13 | idempotency `458008f` 2026-06-05; execution-safety last touch `01bca54` 2026-07-23 did **not** add CreditBalanceGuard override | before / without the guard provider |

All Class 1 fixture files predate, or were not updated for, the constructor/guard contract they now fail to satisfy.

---

## 8. Proof PILOT-2LANE-01 did not cause them

`git diff --name-only 9e7075d^..9e7075d` is the nine pilot files listed in §1. **Zero** of the nine failing suites are in that commit.

Passing remainder includes `src/ai/__tests__/ai-execution-guards.integration.spec.ts` and `src/ai/__tests__/ai-execution.controller.integration.spec.ts` (they already override `CreditBalanceGuard`). Pilot user-agent specs PASS. Frontend i18n files are not on the gateway jest path.

`PILOT_CAUSED=NO`.

---

## 9. Exact writable test files (Step 2 freeze — no wildcards)

```
services/api-gateway/src/auth/__tests__/auth.service.verify.spec.ts
services/api-gateway/src/auth/__tests__/auth.service.reset.spec.ts
services/api-gateway/src/users/__tests__/users.integration.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution-idempotency.integration.spec.ts
services/api-gateway/src/safety/execution-safety.integration.spec.ts
```

No other test files. No production files. No jest config. No package.json. No PRD/ARCHITECTURE. No governance files in Step 2.

### Per-file repair freeze

#### Batch A — AuthService `DataSource`

| File | Tests | Missing dep | Required provider | Mock needs behavior? | Assertions |
|---|---|---|---|---|---|
| `auth.service.verify.spec.ts` | 13 | `DataSource` index [4] | `{ provide: DataSource, useValue: mockDataSource }` | **YES** for `register` / `findOrCreateGoogleUser` / `findOrCreateAppleUser` — copy `transaction` callback from passing `auth.service.spec.ts` (not empty `{}`) | Keep email-verify token hash / consume / resend / getUserById assertions. Update only assertions that are invalid against **current** `AuthService.register` / OAuth create (those methods now persist inside `dataSource.transaction`; do not restore the pre-`96fe527` spy-on-`generateAndStoreVerificationToken` production path) |
| `auth.service.reset.spec.ts` | 7 | `DataSource` index [4] | same `DataSource` provider | Reset methods do not call `dataSource`; **DI presence** is sufficient. Same transaction-capable mock as verify is allowed for fixture consistency | Keep all reset silent-unknown / email / consume / revoke assertions unchanged |

#### Batch B — UsersService `Plan` repository

| File | Tests | Missing dep | Required provider | Mock needs behavior? | Assertions |
|---|---|---|---|---|---|
| `users.integration.spec.ts` | 6 | `getRepositoryToken(Plan)` (`"PlanRepository"` index [1]) | `{ provide: getRepositoryToken(Plan), useValue: mockPlanRepository }` with `findOne` | **YES** — `getCurrentUser` / `getQuotas` call `planRepository.findOne`. Copy the Plan mock from passing `users.service.spec.ts`. User `findOne` mocks must include `planType` / `planStatus` so `resolvePlanStateForUser` can run | Unauthorized / missing-user / `resetAt` null remain unchanged. **GET /me `toEqual` currently omits `planCode` / `planName` / `planStatus`.** After DI is fixed, current production DTO includes those fields. Update the expected object to match current `UsersService.getCurrentUser` (as already asserted in `users.service.spec.ts`). That is contract-accurate, not assertion weakening. Do not drop plan fields from production |

#### Batch C — CreditBalanceGuard override

| File | Tests | Missing dep | Required provider | Mock needs behavior? | Assertions |
|---|---|---|---|---|---|
| `ai-execution-idempotency.integration.spec.ts` | 7 | `CreditBalanceRepository` via real `CreditBalanceGuard` | `.overrideGuard(CreditBalanceGuard).useValue({ canActivate: () => true })` (or existing mockGuardValue pattern) | **Merely DI / bypass** — suite tests idempotency, not credit gating | Keep all idempotency / quota-bypass-on-replay / per-user key assertions unchanged |
| `execution-safety.integration.spec.ts` | 27 | same | same `overrideGuard(CreditBalanceGuard)` | **Merely DI / bypass** — suite tests execution-safety, not credit gating | Keep all 503/429/400/success safety assertions unchanged. After compile succeeds, `app.close()` in `afterEach` must run (no extra product change) |

**Do not** add `CreditBalanceRepository` + real `CreditBalanceGuard` to Batch C unless the suite is converted to test credit gating (out of scope).

---

## 10. Exact read-only production files

Step 2 may **read**, never write:

```
services/api-gateway/src/auth/auth.service.ts
services/api-gateway/src/users/users.service.ts
services/api-gateway/src/billing/credit-balance.guard.ts
services/api-gateway/src/ai/ai-execution.controller.ts
services/api-gateway/src/billing/credit-deduction/credit-balance.repository.ts
services/api-gateway/src/entities/user.entity.ts
services/api-gateway/src/entities/plan.entity.ts
```

Read-only **pattern references** (do not edit):

```
services/api-gateway/src/auth/auth.service.spec.ts
services/api-gateway/src/users/users.service.spec.ts
services/api-gateway/src/ai/__tests__/ai-execution.controller.integration.spec.ts
services/api-gateway/src/ai/ai-execution.controller.spec.ts
```

---

## 11. Batch A/B/C split

One task lifecycle. Implementation is **three sequential batches**. Do not mix groups in one uncontrolled edit. Each batch must turn **its** suites green before the next.

| Batch | Dependency group | Files | Tests |
|---|---|---|---|
| A | `AuthService` / `DataSource` | verify + reset specs | 20 |
| B | `UsersService` / `Plan` repo | users.integration.spec.ts | 6 |
| C | `CreditBalanceGuard` override | idempotency + execution-safety | 34 |

Class 2 TypeORM suites are **not** a Batch D of this task.

---

## 12. No-production-code rule

- Do not change `AuthService`, `UsersService`, `CreditBalanceGuard`, billing, auth, AI execution, schemas, migrations, or runtime.
- Do not weaken assertions merely to get green tests.
- Tests must instantiate **current** production dependencies.
- Assertion updates are allowed **only** where the frozen fixture currently asserts a DTO/call shape that current production no longer has (documented in §9 Batch A register/OAuth and Batch B GET /me plan fields).

---

## 13. No-runtime rule

Do not use Docker, PostgreSQL, Redis, provider calls, LIVE, staging, browser smoke, or dev servers.

Known Class 1 failures occur at Nest `TestingModule.compile()`. If runtime becomes necessary: **STOP**.

Class 2 as written needs Postgres. That is why it is out of scope.

---

## 14. Validation commands (Step 2)

PowerShell 5.x, full Windows paths. `--runInBand` for the same reason as Step 1.

After Batch A:

```
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"
npx jest src/auth/__tests__/auth.service.verify.spec.ts src/auth/__tests__/auth.service.reset.spec.ts --runInBand
```

After Batch B:

```
npx jest src/users/__tests__/users.integration.spec.ts --runInBand
```

After Batch C:

```
npx jest src/ai/__tests__/ai-execution-idempotency.integration.spec.ts src/safety/execution-safety.integration.spec.ts --runInBand
```

After all batches (this task's success — **not** PILOT resume):

```
npx jest src/auth/__tests__/auth.service.verify.spec.ts src/auth/__tests__/auth.service.reset.spec.ts src/users/__tests__/users.integration.spec.ts src/ai/__tests__/ai-execution-idempotency.integration.spec.ts src/safety/execution-safety.integration.spec.ts --runInBand
Set-Location -Path "C:\Users\knlee\aiSandBox2026B\services\api-gateway"; npm run build
git -C "C:\Users\knlee\aiSandBox2026B" diff --check
git -C "C:\Users\knlee\aiSandBox2026B" diff -- "services/api-gateway/src" ":!services/api-gateway/src/auth/__tests__/auth.service.verify.spec.ts" ":!services/api-gateway/src/auth/__tests__/auth.service.reset.spec.ts" ":!services/api-gateway/src/users/__tests__/users.integration.spec.ts" ":!services/api-gateway/src/ai/__tests__/ai-execution-idempotency.integration.spec.ts" ":!services/api-gateway/src/safety/execution-safety.integration.spec.ts"
```

The last `git diff` must show **zero production source edits**.

Broad non-live suite (diagnostic only until Class 2 is separately repaired):

```
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

Expected after this task: Class 1 suites PASS; Class 2 suites still FAIL (4 suites / 23 tests). **Do not** add Class 2 filenames to `--testPathIgnorePatterns` and call the repair complete.

---

## 15. Broad-suite success criterion

**This task cannot claim the broad non-live suite green.** Discovery's "only smoke excluded" bar still requires Class 2.

GATEWAY-TEST-FIXTURE-01 Step 2 success:

- All 5 frozen suites PASS (60 tests)
- Zero production source edits
- Zero runtime
- Gateway `npm run build` PASS
- `git diff --check` PASS
- Class 2 still red, documented, not excluded to fake green

The repair is **not** complete merely because the 9 suites are excluded.

---

## 16. Pilot-resume criterion

PILOT-2LANE-01 Step 4 may resume **only** after a later control-plane step when:

1. GATEWAY-TEST-FIXTURE-01 is COMPLETE AND LOCKED, **and**
2. The Class 2 TypeORM-forRoot non-live failures are resolved by a **separately registered** task (not this one), **and**
3. Fresh:

```
npx jest --testPathIgnorePatterns=smoke.integration.spec.ts --runInBand
```

is green with **no additional exclusions**.

This Step 1 does **not** grant PILOT Step 4 resume. This task's Step 3 consolidation must **not** authorize resume while Class 2 remains red.

---

## 17. Invitation / Lane 3 / pilot state preserved

- PILOT-2LANE-01 = PAUSED / NOT LOCKED
- AGENT-PLATFORM-CREATE-01C = LANE-DONE / NOT LOCKED
- I18N-SHELL-06 = LANE-DONE / NOT LOCKED
- Lane 3 = DISABLED (this task cannot enable it; not a 3rd source lane)
- PRIVATE-BETA-INVITE-01 = PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED
- LIVE_STAGING_VALIDATED=YES
- BUILDER_PRIVATE_BETA_READINESS=GO
- RUNTIME_EXECUTION_AUTHORIZED=NO / PROVIDER_CALL_AUTHORIZED=NO / CREDIT_MUTATION_AUTHORIZED=NO / STAGING_MUTATION_AUTHORIZED=NO

---

## Mutex / admission (serialized blocker)

- No parallel source lane. Lanes 1–2 remain occupied LANE-DONE.
- This is **not** implementation-lane admission.
- GOVERNANCE: held for this Step 1 registration write, then released UNOWNED.
- Step 2 later owns **GATEWAY test surface only** (the five files in §9). Production gateway source remains READ ONLY.
- GATEWAY today remains owned by AGENT-PLATFORM-CREATE-01C (LANE-DONE). Step 2 may take GATEWAY for the frozen test files because 01C will not write further; 01C's exclusive 4-file write set stays frozen.
- FRONTEND + I18N stay with I18N-SHELL-06.
- No LOCAL-RUNTIME / STAGING / PROVIDER-LIVE / CREDIT / ENV / PACKAGE / COMPOSE / MIGRATION.
- Hot-file leases: the five §9 paths during Step 2 only.

---

## Step 1 activity ledger

```
LIVE=0
SSH=0
staging=0
provider=0
credits=0
gates=0
runtime=0
Docker=0
Postgres=0
Redis=0
product implementation=0
frontend implementation=0
backend production edits=0
tests executed=YES (one non-live gateway jest --runInBand)
dependencies=0
PRD.md edits=0
ARCHITECTURE.md edits=0
Git mutations=0
Lane 3=DISABLED
invitation registration=0
Class 2 TypeORM suites repaired=0
PILOT-2LANE-01 Step 4 resumed=NO
```

---

## Blocker before Step 2

Keith owns Git. Step 2 must not start until Keith commits this Step 1 governance state (`TASKS.md` CURRENT EXECUTION BOARD, `TASKS_BACKLOG_FULL.md` GATEWAY-TEST-FIXTURE-01 body, `docs/GATEWAY-TEST-FIXTURE-01-PLAN.md`) and `git status --short` is empty. Open a **new** Cursor window for Step 2. Do not implement fixtures in the Step 1 window.
