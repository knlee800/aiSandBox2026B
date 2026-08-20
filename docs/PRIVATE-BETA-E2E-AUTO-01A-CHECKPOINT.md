# PRIVATE-BETA-E2E-AUTO-01A — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01A  
**Title:** LIVE Adapter Tooling Fix — Dynamic Execution-Edge Parity + SSH Executor Wiring  
**Parent:** PRIVATE-BETA-E2E-AUTO-01 — COMPLETE AND LOCKED — PASS — 2026-08-20 — Checkpoint: `docs/PRIVATE-BETA-E2E-AUTO-01-CHECKPOINT.md`  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-20  
**Checkpoint Date:** 2026-08-20  
**Lifecycle:** 2-step TINY  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Classification:** AUTOMATION_TOOLING_FIX  
**Product defect:** NO  
**Production source modification:** NO  
**Nature:** GOVERNANCE / CONSOLIDATION ONLY — no implementation, package, staging, provider, credit, env, Docker, or Git mutation in Step 2

```
AUTOMATION_TOOLING_FIX=YES
PRODUCT_DEFECT=NO
PRODUCTION_SOURCE_MODIFICATION=NO
DYNAMIC_EXECUTION_EDGE_PARITY=YES
SSH_EXECUTOR_WIRED=YES
AUTOMATION_ADAPTER_BLOCKERS_RESOLVED=YES
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=PROHIBITED
```

Step 1 implementation commit: `41a48db192fde77175f9600f41989c6ab6a2c95d` (`fix automated E2E live adapters`)

Do not treat this checkpoint as a scheduler. Do not freeze a staging deployment SHA here.

---

## 1. Lifecycle

1. Bounded implementation + isolated CONTRACT validation — COMPLETE — 2026-08-20
2. Consolidation / checkpoint — COMPLETE — 2026-08-20 — this document

Lane 2 only during implementation. Lane 1 remained PRIVATE-BETA-E2E-LIVE-01 ACTIVE / WAITING. Lane 3 DISABLED.

---

## 2. Root causes fixed

Both confirmed LIVE-01 Step 1 adapter blockers are preserved and closed.

### Root cause 1 — historical SHA coupling

`e2e/builder-golden-path/lib/staging.ts` previously defaulted to historical E2E-05 SHA `c3e39279abe3c0d6c348daa312107c8f6fc592b7` when no expected HEAD was supplied.

Permanent SHA coupling is **removed**. The historical SHA is **not** replaced with another frozen SHA.

Current behavior:

- `readAuthorizedLocalHead()` obtains current local HEAD
- local tree must be clean
- expected HEAD is passed explicitly into `inspectParity(expectedHeadSha)`
- staging HEAD must match exactly
- mismatch throws `UnsafeParityError`
- failure occurs in SAFETY before gate enable / BUILD / provider

### Root cause 2 — unbound SSH executor

`createLiveAdapters()` previously constructed `StagingHelper` without the existing SSH executor.

Current behavior:

- `createSshExecutor()` is wired into the LIVE staging adapter
- uses existing `aisandbox-staging` / `/opt/aisandbox` conventions
- no second SSH implementation
- no embedded credentials
- missing/failing SSH fails closed (`SshExecutorMissingError` / executor rejection)

---

## 3. Validation (Step 1; not re-run in Step 2)

| Check | Result |
|---|---|
| `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json` | PASS |
| `npm run e2e:builder:contract` | **29 passed** — ~3.1s — PASS |
| Previous AUTO-01 contract tests | 21 remain passing |

Additional coverage proves:

- no historical fixed staging SHA required
- expected HEAD supplied dynamically
- matching parity PASS
- mismatch fails before provider-capable phase
- `createLiveAdapters` binds SSH executor
- missing/failing SSH fails closed
- CONTRACT mode remains staging-free
- LIVE guards unchanged
- provider budget remains exactly 1
- retries remain 0
- preview-first phase order remains intact

---

## 4. No live activity

AUTO-01A performed:

- NO staging SSH
- NO Playwright LIVE
- NO provider call
- NO credit mutation
- NO execution-gate enable
- NO runtime mutation

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
```

---

## 5. LIVE-01 consequence

`AUTOMATION_ADAPTER_BLOCKERS_RESOLVED=YES`

PRIVATE-BETA-E2E-LIVE-01 Step 2 may proceed only after:

1. AUTO-01A is locked (this checkpoint)
2. Keith explicitly authorizes the controlled LIVE execution

This consolidation does **not** execute or authorize LIVE-01 Step 2. LIVE resources remain UNOWNED. Do not reacquire STAGING / PROVIDER-LIVE / CREDIT / ENV here.

Provider budget for current LIVE-01 state:

- AUTHORIZED=0
- USED=0

Future explicit Keith authorization may permit 1 provider call and 0 retries.

`BUILDER_PRIVATE_BETA_READINESS` remains `NO_GO_PENDING_FRESH_AUTOMATED_E2E`.  
`PRIVATE-BETA-INVITE-01` remains prohibited.

---

## 6. Step 2 consolidation writes

- `docs/PRIVATE-BETA-E2E-AUTO-01A-CHECKPOINT.md` — this document
- `TASKS.md` CURRENT EXECUTION BOARD only — AUTO-01A LOCKED; Lane 2 EMPTY; HOTFILE leases released; LIVE resources not reacquired
- `TASKS_BACKLOG_FULL.md` — AUTO-01A final status + LIVE-01 waiting-dependency update only

No implementation changes in Step 2.
