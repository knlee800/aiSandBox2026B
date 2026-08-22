# PRIVATE-BETA-E2E-AUTO-01K — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01K
**Title:** Staging Deduction Verification Database Connection Contract — Root Cause and Safe Secret-Preserving Adapter Contract
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Owning fix (this diagnosis):** AUTOMATION_ADAPTER_FIX
**Workstream:** RELIABILITY
**Lifecycle:** 3-step bounded task (Step 1 registration + investigation; Step 2 smallest proven TDD adapter correction; Step 3 consolidation/checkpoint/lock)
**Step:** 1 — COMPLETE
**Date:** 2026-08-22
**Lane:** Lane 1
**Parent runner:** PRIVATE-BETA-E2E-AUTO-01 (COMPLETE AND LOCKED — PASS)
**Triggering evidence:** PRIVATE-BETA-E2E-LIVE-10 (COMPLETE AND LOCKED — FAIL/BLOCKED — AUTOMATION_ADAPTER_FAILURE — DEDUCTION — 2026-08-22)

LIVE-10 historical classification remains AUTOMATION_ADAPTER_FAILURE. This document does not rewrite LIVE-10.

```
STEP_1_IMPLEMENTATION_PERFORMED=NO
PRODUCT_SOURCE_MODIFIED=NO
AUTOMATION_IMPLEMENTATION_MODIFIED=NO
STAGING_CONFIG_CHANGE_NEEDED=NO
SHARED_DEDUCTION_BALANCE_ADAPTER_FIX=NO
LIVE_RUNS=0
SSH_CONNECTIONS=0
STAGING_ACCESS=0
PROVIDER_CALLS=0
CREDITS_MUTATED=0
GATE_MUTATION=0
PROJECT_SESSION_CONTAINER=0
DEPENDENCY_CHANGES=0
GIT_MUTATION=0
PRODUCT_CHANGE_REQUIRED=NO
ROOT_CAUSE_PROVEN=YES
SELECTED_CONTRACT=REMOTE_EXTRACT_DATABASE_URL_FROM_ROOT_ENV_THEN_PSQL
GENERIC_SOURCE_ENV=PROHIBITED
```

Local tree at Step 1 (read-only before governance writes):

- branch = `main`
- `git rev-parse HEAD` = `100206b85e2830491dfb7f5e40ea04ce752e67aa`
- `git status --short` = empty (CLEAN)

This SHA is recorded as an observation only. It is **not** frozen as a required Step 2 SHA.

Do not print, request, or embed `DATABASE_URL` values.

---

## 1. Identifier verification

`PRIVATE-BETA-E2E-AUTO-01K` was **unused as a registered task** before this registration.

Repo-wide search found only historical recommendation prose:

| Location | Nature |
|---|---|
| `docs/PRIVATE-BETA-E2E-LIVE-10-CHECKPOINT.md:511` | “register PRIVATE-BETA-E2E-AUTO-01K” as exact-next recommendation |
| `docs/PRIVATE-BETA-E2E-LIVE-10-CHECKPOINT.md:555` | “Likely identifier if later registered: **PRIVATE-BETA-E2E-AUTO-01K** … repo search at this lock found **zero** occurrences.” |
| `TASKS.md` CURRENT EXECUTION BOARD | LIVE-10 lock “Do not register PRIVATE-BETA-E2E-AUTO-01K here” |
| `TASKS_BACKLOG_FULL.md` LIVE-10 locked body | “Exact next (NOT REGISTERED HERE)” / “Do not register PRIVATE-BETA-E2E-AUTO-01K here” |

Zero `### PRIVATE-BETA-E2E-AUTO-01K` registry entries existed. Historical recommendation prose does not count as prior registration.

Rejected alternatives: reopening LIVE-10 / LIVE-09 / AUTO-01G / AUTO-01H / AUTO-01I / AUTO-01J / 03L; registering PRIVATE-BETA-INVITE-01; a product credit-accounting change; generic `source .env`; embedding `DATABASE_URL` in Node/SSH argv from the local process; `pm2 env` secret dump.

---

## 2. Admission / state

Admitted to **Lane 1** as ACTIVE at Step 1. Lane 2 EMPTY. Lane 3 DISABLED.

Admission checks: lane capacity available (0/2 used at admission); Start condition READY; dependencies satisfied (LIVE-10 locked FAIL/BLOCKED at DEDUCTION; AUTO-01J/I/H/G and 03L locked PASS); no dependency on unfinished lane output; write scope is governance/diagnosis only in Step 1; GOVERNANCE acquired for this board/registry/diagnosis write then released; STAGING / PROVIDER-LIVE / CREDIT / ENV **not** acquired; HOTFILE leases remain UNOWNED until Step 2; evidence class LOCAL-TESTS for Step 2; revert isolation acceptable.

No runtime, staging, provider, credit, or gate authority is granted.

---

## 3. Frozen LIVE-10 symptom (not rewritten)

```
FAILED_PHASE=DEDUCTION
LAST_SUCCESSFUL_PHASE=PUBLIC_CONFIRM
error=ssh exited 2: psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "ubuntu" does not exist
executionId=18feb0a2-b992-46c8-aa75-4667fc05005d
tokens_used=1164
AUTHORIZED_LOCAL_HEAD=c78dbad609677b7da86e3043629e042bcbcb8e9d
AUTH through PUBLIC_CONFIRM=PASS
AUTO-01I=HELD
AUTO-01G=HELD
AUTO-01H=HELD
03L Preview=PASS
AUTO-01J CHECKPOINT=PASS
Starting balance=25883
Product deduction=1164
Ending balance=24719
Product reconciliation=25883 - 1164 = 24719
Stripe=NO CHARGE
Runner DEDUCTION=FAIL
Runner BALANCE=NOT_REACHED
```

Frozen interpretation (LIVE-10 lock, unchanged): the runner deduction verifier did not have the intended staging `DATABASE_URL` inside the remote SSH command context.

This diagnosis **proves** that interpretation from source, shell-boundary, and staging-env-contract evidence. It does **not** assume that `source .env` or a raw `export DATABASE_URL` is the correct fix.

---

## 4. Exact DEDUCTION implementation path

Absolute Windows paths and functions:

| Step | Path / function |
|---|---|
| 1. DEDUCTION orchestration | `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\runner.ts` `runGoldenPath()` marks `'DEDUCTION'` then `adapters.verifyDeduction(ids.executionId ?? null)` |
| 2. LIVE `verifyDeduction()` | `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\live-adapters.ts` `createLiveAdapters().verifyDeduction` |
| 3. tokens_used | same function: Playwright `page.request.get(${baseURL}/api/ai/executions/${executionId})` then `tokens_used ?? tokensUsed` |
| 4. Balance/deduction SQL helper | `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\staging.ts` `buildDeductionQuery(executionId)` and `StagingHelper.queryDeduction(executionId)` |
| 5. SSH executor | `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\staging.ts` `createSshExecutor()` |
| 6. Remote command construction | `buildSshCommand(buildDeductionQuery(executionId))` → `['aisandbox-staging', <remoteCommand>]` |
| 7. Shell quoting | JS template literal in `buildDeductionQuery`; spawn `{ shell: false }` |
| 8. Output parsing | `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\evidence.ts` `countDeductionRowsForExecution(psqlOutput, executionId)` then `validateDeduction()` |
| 9. Timeout / error handling | `createSshExecutor` timeout `SSH_EXECUTION_TIMEOUT_MS=30000`; nonzero close → `new Error('ssh exited ${code}: ${stderr \|\| stdout}')`; timeout → `SshExecutionTimeoutError` (argv **not** included; stdout/stderr truncated to 400 chars) |

Exact LIVE `verifyDeduction()` sequence:

1. Require non-null `executionId` or throw `Cannot verify deduction without executionId.`
2. GET execution JSON; require numeric `tokens_used`
3. `staging.queryDeduction(executionId)`
4. Count psql lines containing `executionId`
5. `validateDeduction({ deductionCount, tokensUsed, creditsDeducted: tokensUsed })`

LIVE-10 reached step 3. Step 2 succeeded (`tokens_used=1164` was captured). Step 3 rejected before any row count.

---

## 5. Exact SSH command construction

`buildDeductionQuery(executionId)` currently returns **exactly**:

```text
psql "$DATABASE_URL" -c "SELECT source_event_id, requested_credits, applied_credits, overflow_credits, balance_before, balance_after, status FROM credit_deduction_records WHERE source_event_id = '<executionId-with-single-quotes-stripped>';"
```

`StagingHelper.queryDeduction`:

```text
this.assertLive()
this.requireExecutor()(buildSshCommand(buildDeductionQuery(executionId)))
```

`buildSshCommand(remoteCommand)`:

```text
[STAGING_SSH_ALIAS, remoteCommand]  // ['aisandbox-staging', remoteCommand]
```

`createSshExecutor` (LIVE default; `createLiveStagingHelper` binds it when no test `execute` is injected):

```text
spawn('ssh', argv, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
```

No remote working directory is set. No `cd /opt/aisandbox`. No env-file load. No `export DATABASE_URL=…`. No PM2 lookup. The remote command **assumes** `$DATABASE_URL` is already in the remote shell environment.

---

## 6. Exact shell / interpolation boundaries

Mapped layers for the exact LIVE-10 command:

| Layer | Interpolates `"$DATABASE_URL"`? | Evidence |
|---|---|---|
| PowerShell | **NO** | `npm run e2e:builder:live` launches Node. The command string lives in compiled JS, not a PowerShell expression. |
| Node runner | **NO** | JS template literal interpolates only `${…}`. `"$DATABASE_URL"` is a literal. |
| Node `child_process` shell | **NO** | `spawn(..., { shell: false })`. No `cmd.exe` / PowerShell wrapping. |
| SSH client (`ssh.exe`) | **NO** | OpenSSH client sends argv[1] as the remote command string. It does not expand `$DATABASE_URL`. |
| Remote sshd / shell | **YES — remote bash `-c`** | OpenSSH: if a command is specified, it is executed **instead of a login shell**, typically `user-shell -c <command>` as **one** `-c` argument. Staging SSH user is `ubuntu`. |
| `psql` | Receives the **already-expanded** first argument | After remote expansion, empty → `psql "" -c "SELECT …"` |

Login vs non-login:

- Command-specified SSH is **non-interactive** and **not** a login shell.
- Bash therefore does **not** source `~/.profile` / `~/.bash_profile` / `~/.bashrc` (unless `BASH_ENV` is set).
- It does **not** automatically load `/opt/aisandbox/.env`.
- It does **not** inherit PM2 process environment.

Quotes: the double quotes around `"$DATABASE_URL"` are **correct for remote expansion**. They do not strip the token locally. They also do not create a value that is not there. Unset → empty string.

LIVE-10 actually invoked `psql` (psql connection error, not a quoting/syntax failure). The SQL `-c` quoting is not the terminal defect.

---

## 7. Where DATABASE_URL is currently expected

**Current adapter expectation:** remote SSH shell environment variable `DATABASE_URL`.

It is **not** expected from:

- the local PowerShell process
- the Node process env (`StagingHelper` uses `process.env` only for LIVE authorization flags)
- a hard-coded remote wrapper
- a `cd` + dotenv load inside the deduction command

That expectation is **false for non-interactive SSH**. The adapter never loads the authoritative file and never copies PM2 env.

---

## 8. Authoritative staging DATABASE_URL source

Without SSH, from locked staging/deployment contract:

| Fact | Source |
|---|---|
| Authoritative file | `/opt/aisandbox/.env` |
| Ownership / mode | `ubuntu:ubuntu` / `chmod 600` (`-rw-------`) |
| Shared vs per-service | **Single root `.env`** for all services. No `/opt/aisandbox/services/api-gateway/.env` |
| Consumers | api-gateway, ai-service, container-manager (and operator CLI). TypeORM `data-source` uses `DATABASE_URL` exclusively |
| How app processes get it | **PM2 stored process environment**, captured at original `pm2 start` from a shell that had sourced the root `.env`. `import 'dotenv/config'` in `services/api-gateway/src/main.ts` loads `.env` from **PM2 cwd** (`/opt/aisandbox/services/api-gateway`) and finds **no** per-service file, so it loads nothing at runtime. DATABASE_URL in the running gateway is PM2-resident, not SSH-resident |
| Repo PM2 ecosystem file | **None** |
| Example URI shape (repo example only; not the staging secret) | unquoted `DATABASE_URL=postgresql://…` in root `.env.example` |
| Presence proven on staging | E2E-04 / E2E-05: `DATABASE_URL` present in PM2 gateway env (count=1, value never printed). LIVE-10 product deduction proves the **application** had a working DB connection |

Interactive/non-interactive SSH does **not** automatically receive this variable.

---

## 9. Whether remote SSH shell auto-loads it

**NO.**

Proven independently of LIVE-10:

- E2E-03 Stage Start: PM2 env is stored at start; bare SSH shells used for `pm2 restart … --update-env` do **not** contain the full `.env`. Merge semantics preserve PM2-stored `DATABASE_URL` **inside PM2**, not in the SSH shell.
- Command-specified SSH is non-login / non-interactive.
- `buildDeductionQuery` does not `cd /opt/aisandbox` and does not read `/opt/aisandbox/.env`.

LIVE-10 is the first automated-runner observation of this exact surface. It is consistent with the documented SSH/PM2 split.

---

## 10. Why psql selected role ubuntu

PostgreSQL client defaults when the connection URI is absent/empty:

- no `postgres://` / `postgresql://` conninfo
- no `PGHOST` / `PGUSER` / `PGDATABASE` in that process
- libpq uses the Unix-domain socket `/var/run/postgresql/.s.PGSQL.5432`
- default role = OS user of the process = SSH user **`ubuntu`**
- default database = same name as the user

Observed LIVE-10 error:

```text
connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "ubuntu" does not exist
```

That socket path is the no-host default. A loaded staging URI uses user `aisandbox` and host `localhost` (SETUP-06: PostgreSQL is localhost-only; `DATABASE_URL` must use `localhost`). That would produce a TCP/`localhost` error and role `aisandbox`, not socket + role `ubuntu`.

**Does this strongly prove DATABASE_URL was absent/empty in the remote psql process?**

**YES. Confidence: HIGH.**

Alternative explanations considered and rejected as the LIVE-10 terminal cause:

- URI present but user `ubuntu`: contradicts documented `aisandbox` DB user and LIVE-10 operator evidence that a correctly loaded URI returned the product row.
- Quoting destroyed the token so psql never ran: contradicted by a real `psql:` error.
- Local PowerShell emptied it: contradicted by `shell: false` + JS non-interpolation.

---

## 11–12. Prior working runner DEDUCTION evidence

**No automated golden-path runner DEDUCTION phase has ever passed.**

| Run | Runner DEDUCTION | Notes |
|---|---|---|
| LIVE-01 .. LIVE-07 | NOT REACHED | failed earlier (parity / SAFETY / CREATE_SESSION / etc.) |
| LIVE-08 | NOT REACHED | failed PREVIEW |
| LIVE-09 | NOT REACHED | failed CHECKPOINT |
| LIVE-10 | **FAIL** | first runner reach of DEDUCTION; `psql "$DATABASE_URL"` over the same `createSshExecutor` |
| E2E-04 / E2E-05 | manual operator `psql` | **not** the Playwright runner. Operator loaded `DATABASE_URL` from `/opt/aisandbox/.env` using grep/cut (E2E-04 explicitly: do **not** source root `.env`) |
| LIVE-10 post-fail operator query | PASS as product evidence only | “queries that **do** load `DATABASE_URL` from `.env` found exactly one applied row”. Does **not** convert runner DEDUCTION to PASS |

`buildDeductionQuery` has always been `psql "$DATABASE_URL" …` with no env load. There is no earlier runner commit where this helper passed LIVE. Do not infer runner success from product-side credit evidence (LIVE-06/08/09/10 all had product 1:1 deduction while the runner was elsewhere).

Same SSH helper (`createSshExecutor` / `buildSshCommand`) is used for SAFETY/CLEANUP commands that **do not** need `DATABASE_URL` (`git`, `pm2`, `curl`). Those can pass while DEDUCTION cannot.

---

## 13–15. Current deduction SQL semantics / executionId / exactly-one

SQL (unchanged; not a separate causal defect):

```sql
SELECT source_event_id, requested_credits, applied_credits, overflow_credits,
       balance_before, balance_after, status
FROM credit_deduction_records
WHERE source_event_id = '<executionId>';
```

| Question | Answer |
|---|---|
| Table | `credit_deduction_records` |
| Correlation | `source_event_id = executionId`. Product: `usage-ledger.service.ts` `emitDeductionAttempt` sets `sourceEventId: record.executionId`. Comment: PersistentCreditDeductionGateway deduplicates via `sourceEventId = executionId` |
| Expected qualifying row | exactly one `applied` row for that `source_event_id` |
| Amount field | `applied_credits` / `requested_credits` (selected but **not parsed** by the runner; runner sets `creditsDeducted = tokensUsed`) |
| Exactly-one in runner | `validateDeduction` requires `deductionCount === 1` |
| Duplicate detection | line-count of psql stdout lines containing the UUID; product unique index `idx_credit_deduction_records_source_event` on `sourceEventId` |
| Output parsing robustness | naive `line.includes(executionId)`. Sufficient to count rows if psql returns tabular output. Does **not** parse `overflow_credits` even though SQL selects it (`overflowCredits` stays undefined → treated as 0) |
| SQL itself correct for LIVE-10? | **YES.** Operator query with a loaded URI found exactly one applied row for `18feb0a2-b992-46c8-aa75-4667fc05005d` (`requested_credits=1164`, `applied_credits=1164`, `overflow_credits=0`, `25883 → 24719`) |

Do **not** change SQL in Step 2. Connection acquisition is the proven defect. Residual: runner does not assert DB `applied_credits` / `overflow_credits` against `tokens_used`; out of Step 2 scope.

`executionId.replace(/'/g, '')` is a quoting sanitizer only, not a semantic change.

---

## 16–17. BALANCE DB connection mechanism / shared-helper verdict

`verifyBalance()` in `live-adapters.ts`:

- `GET ${baseURL}/api/billing/balance`
- `page.goto(…/billing)`
- wait for a billing-balance GET
- `validateBalanceArithmetic({ balanceBefore, appliedCredits, balanceAfter: payload.balance })`

**It does not use `psql`, `DATABASE_URL`, SSH, or `queryDeduction`.**

STARTING_BALANCE is also the billing API, not psql.

**Would the exact same defect block BALANCE next?** **NO** — different connection mechanism.

**Shared helper today?** **NO.** The only psql helper is `buildDeductionQuery` / `queryDeduction`.

Step 2 must still introduce **one** remote-DB-connection prefix owned by the staging helper and used by `queryDeduction`, so a future DB-side helper cannot copy the broken `psql "$DATABASE_URL"` assumption. That is still **one** root-cause adapter fix. **Do not change BALANCE semantics.**

`SHARED_DEDUCTION_BALANCE_ADAPTER_FIX=NO` (no BALANCE code change). Shared **DB-connection prefix for any psql** = YES, owned by `staging.ts`, consumed today only by DEDUCTION.

---

## 18. Safest DB connection option comparison

| Option | Correctness | Secret exposure | Shell quoting | Interactive-shell dependency | Deterministic | Repo precedent | Product architecture | Test-harness OK? |
|---|---|---|---|---|---|---|---|---|
| **A. Generic `source` / `. /opt/aisandbox/.env` then psql** | Unsafe | Can abort mid-file; keys after `AUTH_EMAIL_FROM` (including `XAI_API_KEY`) may not load | Angle-bracket display-name is stdin redirect | Would “work” only if source succeeded | **NO** | E2E-03: **UNSAFE and prohibited** | No | **NO** |
| **A′. Extract only `DATABASE_URL` from `/opt/aisandbox/.env`, fail-closed if empty, then `psql "$DATABASE_URL"`** | Yes | Value never printed; never in local argv; never in timeout argv diagnostics | grep/cut does not parse the rest of the file as shell | None | Yes | **E2E-04 §10.1** (`export DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env \| cut -d= -f2-)`). LIVE-10 operator post-fail queries used a loaded URI | No | **YES** |
| **B. Runner obtains DATABASE_URL locally and sends it over SSH** | Local process does not have staging URI | **Leak:** Windows `ssh.exe` argv, remote `ps`, and `error=` if psql echoes conninfo | High | None | N/A | None for LIVE runner | No | **NO** (secret-safety hard fail) |
| **C. Use PM2 process environment** | PM2 **has** DATABASE_URL | `pm2 env` dumps **all** secrets onto SSH stdout captured by the executor; `error=` / evidence can leak | Fragile `pm2 env` formatting | None | Partial | Gate inspect greps only `GLOBAL_EXECUTION_ENABLED\|BILLING_CHARGES_ENABLED`, never `DATABASE_URL` | No | **NO** as dump; not selected |
| **D. Existing repo-provided DB helper** | `queryDeduction` **is** the helper; it is the bug | — | — | — | — | No other runner psql helper | No | Fix D, do not add a product CLI |
| **E. Staging API instead of direct DB** | Billing API already used by BALANCE; DEDUCTION contract is exactly-one `credit_deduction_records` row | Lower | N/A | None | Yes | BALANCE/STARTING_BALANCE | Would change golden-path evidence class | Larger than needed; SQL is fine |
| **F. Other** | `sudo -u postgres psql` (04E identity checks) | Superuser, wrong least-privilege | — | None | Yes | Migration identity only | No | **NO** for credit evidence |

---

## 19. Selected safe contract

**A′ — remote extract-only of `DATABASE_URL` from `/opt/aisandbox/.env`, fail closed if missing/empty, then the existing `psql "$DATABASE_URL" -c "SELECT …"`.**

Not generic `source .env`.
Not PM2 env dump.
Not local secret forwarding.
Not a product/API change.
Not a BALANCE change.

Conceptual remote command (exact quoting is Step 2 TDD; value must never be echoed):

```bash
DATABASE_URL=$(grep '^DATABASE_URL=' /opt/aisandbox/.env | cut -d= -f2-)
if [ -z "$DATABASE_URL" ]; then echo AISB_DATABASE_URL_MISSING; exit 1; fi
psql "$DATABASE_URL" -c "SELECT …"
```

Optional equivalent: Python one-key parse that prints **only** the value to command substitution (not SSH stdout), then the same fail-closed + psql. Prefer grep/cut unless Step 2 tests prove a quoting incompatibility with the documented unquoted URI shape.

---

## 20–21. Secret-redaction / command logging risk

`createSshExecutor` logging:

- Does **not** log argv.
- Timeout diagnostics: stdout/stderr truncated to 400 chars; AUTO-01F CONTRACT asserts a secret placed **in the remote command** does **not** appear in `SshExecutionTimeoutError.message`.
- Non-timeout failure: **full** `stderr || stdout` in `ssh exited ${code}: …`.
- Runner FAIL summary: `error=${summary.error}` with **no redaction** (`lib/summary.ts`). LIVE-10 printed the ubuntu socket error in the formatted verdict.

**Hard prohibition:** do not put the URI in the **local** ssh argv (option B). Do not `echo "$DATABASE_URL"`. Do not `pm2 env | grep DATABASE_URL` as the command’s stdout. Do not write secrets into repo/docs/temp files.

Residual: `psql "$DATABASE_URL"` still places the URI in **remote** `psql` argv (same as the established operator pattern). Acceptable for the test harness if the runner never prints argv or the URI. psql auth errors typically name host/role, not the password URI; still fail-closed without echoing the extract.

---

## 22. Env-file compatibility findings

| Finding | Evidence |
|---|---|
| Generic `source .env` / `. /opt/aisandbox/.env` | **PROHIBITED.** E2E-03: `AUTH_EMAIL_FROM` unquoted display-name / angle brackets cause bash source failure; keys **after** that line include `XAI_API_KEY`. 04J Step 6B recorded the same warning as non-blocking follow-up. E2E-04: “do NOT source root .env”. |
| Node dotenv vs shell | `dotenv/config` is not what the SSH command uses. PM2 cwd has no service `.env`. Dotenv would strip quotes; grep/cut would keep them if present. Root `.env.example` `DATABASE_URL` is **unquoted**. LIVE-10 operator extract worked on the real staging file. |
| Comments / spaces / `=` in URI | `grep '^DATABASE_URL='` + `cut -d= -f2-` keeps `=` inside the URI. Lines not starting with `DATABASE_URL=` are ignored (comments, other keys). |
| Extract only DATABASE_URL without echoing | Command substitution + fail-closed empty check + psql. Print `AISB_DATABASE_URL_MISSING` only, never the value. |
| Application helper | No runner/package helper exists beyond this broken `buildDeductionQuery`. 04E Python key-presence prints `DATABASE_URL_PRESENT=yes` without values — useful precedent for presence, not for loading into psql. |

Do **not** prescribe `source .env`.

---

## 23. Fail-closed connection behavior

The fixed adapter must distinguish:

| Class | Current behavior | Required |
|---|---|---|
| A. Valid DB connection | Never reached on LIVE-10 | psql exit 0 + tabular stdout |
| B. DATABASE_URL missing/unavailable | Collapses to C-like ubuntu socket error | Distinct `AISB_DATABASE_URL_MISSING` (or typed runner error) **before** psql |
| C. Authentication failure | Would be a psql FATAL after a loaded URI | Keep psql stderr; do not echo URI |
| D. SQL/query failure | psql ERROR | Keep as SSH nonzero |
| E. Empty result | Would be `(0 rows)` + `deductionCount=0` + `expected exactly 1` | Unchanged `validateDeduction` |

`SELECT current_database(), current_user` would prove DB `aisandbox` / role `aisandbox` without printing the URI. It is **not required** if extract fail-closed + psql exit 0 already separates A/B. Skip it in Step 2 to avoid extra SSH round-trip and extra stdout. Minimum evidence that the intended staging DB was queried: psql exit 0 against a URI loaded from `/opt/aisandbox/.env`, returning either the `source_event_id` row or `(0 rows)` — **not** a unix-socket `role "ubuntu"` error.

---

## 24–26. CONTRACT fixture current behavior / fidelity / RED design

Current CONTRACT:

- `createRecordingAdapters().verifyDeduction()` in `runner.ts` **stubs success** `{ deductionCount: 1, tokensUsed: 1178, creditsDeducted: 1178 }` and never calls `queryDeduction`.
- AUTO-01H live-adapter test **replaces** `verifyDeduction` with a stub that only records `executionId`.
- **Zero tests** assert `buildDeductionQuery()` text.
- Injected `execute` fakes used for SAFETY/CLEANUP do not cover DEDUCTION argv.

CONTRACT bypasses SSH for the golden-path stub path. It simulates a successful deduction **without command/env semantics**.

**Fixture fidelity verdict:** TOO OPTIMISTIC. It hid remote-env absence → psql defaults → role ubuntu.

**Faithful RED (local, no staging, no secrets):**

1. Unit-assert current `buildDeductionQuery('exec-id')` is `psql "$DATABASE_URL" …` and does **not** mention `/opt/aisandbox/.env`, `grep '^DATABASE_URL='`, or `AISB_DATABASE_URL_MISSING`.
2. Fake `execute` records `argv[1]`. Calling `queryDeduction` under LIVE-authorized env must send that exact remote command.
3. Fake remote: if `argv[1]` does not extract from `/opt/aisandbox/.env`, reject with the LIVE-10 text `ssh exited 2: psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "ubuntu" does not exist`.
4. After GREEN: recorded command **must** extract `DATABASE_URL` from `/opt/aisandbox/.env` (grep/cut or proven one-key parser), fail closed on empty, then `psql "$DATABASE_URL" -c "SELECT … source_event_id …"`. Must **not** contain `source ` / `. /opt/aisandbox/.env`. Must **not** contain `postgresql://` or any URI secret. Must still correlate `source_event_id = executionId` and preserve exactly-one counting.
5. Optional: fake extract-success stdout with one UUID line → `countDeductionRowsForExecution` still 1; missing-URL stdout `AISB_DATABASE_URL_MISSING` must not be counted as a deduction row.

Do not implement in Step 1.

---

## 27–35. Hypotheses

### H1 — Remote non-interactive SSH shell does not inherit staging DATABASE_URL, so `psql "$DATABASE_URL"` is empty

**Supporting:** spawn command-specified SSH; non-login bash; no `.env` load in `buildDeductionQuery`; LIVE-10 unix-socket + role ubuntu; E2E-03 bare SSH vs PM2 env split.
**Contradicting:** none material.
**Verdict:** **CONFIRMED**

### H2 — DATABASE_URL exists in authoritative staging `.env` but the runner never loads it

**Supporting:** SETUP-05 `/opt/aisandbox/.env` `chmod 600`; E2E-04/05 presence; LIVE-10 operator extract found the product row; app/PM2 had a working DB (product deduction occurred).
**Contradicting:** none for “exists and is used by the app.”
**Verdict:** **CONFIRMED**

### H3 — PowerShell/Node/SSH quoting strips or prematurely expands DATABASE_URL

**Supporting:** none for local stripping. Remote expansion **does** occur and finds empty (that is H1, not a quoting bug).
**Contradicting:** JS `${}` vs `$DATABASE_URL`; `shell: false`; LIVE-10 reached `psql`.
**Verdict:** **REFUTED** as the cause. Remote empty expansion is expected given H1.

### H4 — DATABASE_URL exists in PM2 only and should be retrieved from PM2

**Supporting:** E2E-03/05: PM2 gateway env contains DATABASE_URL; dotenv at PM2 cwd loads nothing.
**Contradicting:** authoritative **file** is still `/opt/aisandbox/.env` (SETUP-05). `pm2 env` dumps all secrets into captured stdout — prohibited. Gate inspect greps only execution flags.
**Verdict:** **PARTIAL** — present in PM2, but PM2 dump is **not** the selected retrieval contract.

### H5 — Command previously worked because a shell happened to export DATABASE_URL (nondeterministic)

**Supporting:** interactive operator sessions that export via grep/cut work; a leftover interactive env could theoretically make `psql "$DATABASE_URL"` succeed.
**Contradicting:** no automated runner DEDUCTION has ever passed; default SSH does not persist a previous session’s exports; LIVE-10 used the standard executor.
**Verdict:** **PARTIAL** — the adapter is **nondeterministic if** remote env is accidentally populated; in LIVE it is **deterministically empty**. Not a reason to keep the current command.

### H6 — SQL / deduction correlation is wrong independently of the connection issue

**Supporting:** runner does not parse `applied_credits`/`overflow_credits` from psql (residual).
**Contradicting:** LIVE-10 product row matched `source_event_id = executionId` 1:1; unique index; `validateDeduction` exactly-one.
**Verdict:** **REFUTED** as LIVE-10 terminal cause. Residual parsing gap is not Step 2.

### H7 — BALANCE shares the same broken DB connection boundary

**Supporting:** none in current code.
**Contradicting:** `verifyBalance` uses GET `/api/billing/balance` only.
**Verdict:** **REFUTED** for current BALANCE. Introduce a shared **psql connection prefix** anyway so DEDUCTION is the only consumer today.

### H8 — CONTRACT fixture is too optimistic and hides remote-env semantics

**Supporting:** stubbed `verifyDeduction`; zero `buildDeductionQuery` tests; no fake-SSH env-absent case.
**Contradicting:** none.
**Verdict:** **CONFIRMED**

### H9 — Other

Typed `SshExecutionTimeoutError` redacts argv, but nonzero `ssh exited` includes full stderr and the FAIL summary prints `error=` verbatim. Embedding a URI in the command or in stdout would leak through LIVE-10-style evidence. This constrains the fix (secret safety) but is not a second root cause.
**Verdict:** **CONFIRMED** as a safety constraint, not as a competing cause.

---

## 36. Precise root cause

LIVE `queryDeduction()` sends `psql "$DATABASE_URL" …` over command-specified SSH. The remote non-interactive shell does **not** have `DATABASE_URL`. The runner never extracts it from `/opt/aisandbox/.env`. Remote bash expands the empty variable. `psql` then uses libpq defaults (unix socket, role `ubuntu`). Staging PostgreSQL has no role `ubuntu`. The application’s real DB connection (PM2-resident URI from the same `.env`) is unused by this verifier.

This is an **automation adapter** defect. Staging `.env` is present and the product credit path worked. Generic `source .env` is **not** a safe fix.

---

## 37–40. Owning classification / product / staging / shared fix

| Item | Value |
|---|---|
| Owning fix | **AUTOMATION_ADAPTER_FIX** |
| LIVE-10 historical class (unchanged) | AUTOMATION_ADAPTER_FAILURE |
| Product change needed | **NO** |
| Staging config change needed | **NO** |
| Shared DEDUCTION/BALANCE adapter fix | **NO** (BALANCE stays on billing API). Shared **psql env-load prefix** in `staging.ts` for DEDUCTION: **YES** |

Not STAGING_ENV_CONFIGURATION_FIX: `/opt/aisandbox/.env` and PM2 already have `DATABASE_URL`. Not PRODUCT_CREDIT_FIX: 1:1 product deduction is proven. Not CONTRACT_FIXTURE_ONLY: LIVE failed for real; fixture must change **with** the adapter. Not SPEC_DECISION_REQUIRED: the contract is proven.

---

## 41–43. Smallest Step 2 design / files

TDD only. No LIVE. No SSH to staging. No product files. No BALANCE semantic change. No SQL change.

**RED:** current `buildDeductionQuery` / `queryDeduction` remote command does not obtain `DATABASE_URL` from `/opt/aisandbox/.env`; fake SSH with DATABASE_URL absent reproduces LIVE-10 `role "ubuntu"` / unix-socket failure.

**GREEN:** one remote-DB-connection prefix in `staging.ts` used by `queryDeduction`: extract-only `DATABASE_URL` from `/opt/aisandbox/.env`, fail closed if missing/empty with a distinct token, then existing SELECT. No secret in logs/argv/docs. Exactly-one `source_event_id` counting unchanged. `verifyBalance` untouched.

Then focused tests + full CONTRACT + `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json`.

Likely implementation files:

- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\lib\staging.ts`

Likely test/fixture files:

- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\tests\live-adapters.spec.ts`
- `C:\Users\knlee\aiSandBox2026B\e2e\builder-golden-path\tests\evidence.spec.ts` (only if missing-URL stdout must not count as a deduction row)

`live-adapters.ts` / `runner.ts` / product/services: **not** required if `queryDeduction` owns fail-closed.

Before another provider-bearing LIVE run, CONTRACT must prove: correct staging DB connection acquisition; no secret leakage; deduction still correlated to `executionId`; exactly-one intact; BALANCE connection path unchanged (API); failures bounded/fail closed.

---

## 44. Residual uncertainty

- Exact quoting of the staging `DATABASE_URL` line (quotes vs unquoted) was not re-read (no SSH, no secret print). Operator grep/cut worked on LIVE-10. If Step 2 RED/GREEN against the example unquoted shape is insufficient, use a one-key parser that strips optional surrounding quotes **without printing**.
- Whether `cut` would keep a leading `export ` prefix: SETUP-05 / `.env.example` use `DATABASE_URL=`, not `export DATABASE_URL=`.
- Runner still does not parse `applied_credits`/`overflow_credits` from psql. Not LIVE-10 causal. Out of Step 2.
- Exact OpenSSH-for-Windows wrapping of `bash -c` is inferred from OpenSSH command-specified-session behavior plus LIVE-10 actually executing `psql`. Not in doubt enough to block the contract.

---

## 45. Step 1 activity ledger

```
LIVE runs = 0
SSH = 0
staging = 0
provider = 0
credits = 0
gate mutations = 0
runtime project/session/container = 0
runner implementation changes = 0
product changes = 0
dependency changes = 0
Git mutations = 0
```

Local read-only source/docs inspection only. No Docker/Postgres/Redis. No CONTRACT run required for Step 1. No `npm run e2e:builder:live`.

---

## 46–50. Files / git / terminal state / lane / blocker

Recorded after the governance writes that this diagnosis accompanies:

- `TASKS.md` CURRENT EXECUTION BOARD above LEGACY / FROZEN
- `TASKS_BACKLOG_FULL.md` AUTO-01K registration / Step 1 diagnosis
- `docs/PRIVATE-BETA-E2E-AUTO-01K-DIAGNOSIS.md` (this file)

Step 1 terminal state: **COMPLETE** — root cause and safe secret-preserving adapter contract proven. Step 2 **not** started.

Lane / resource state after this write: Lane 1 = PRIVATE-BETA-E2E-AUTO-01K ACTIVE; Lane 2 EMPTY; Lane 3 DISABLED; GOVERNANCE released UNOWNED; STAGING / PROVIDER-LIVE / CREDIT / ENV UNOWNED; HOTFILE UNOWNED; all runtime authorization flags NO.

**Blocker before Step 2:** explicit Keith authorization for AUTO-01K Step 2 — one smallest TDD adapter correction of the shared remote DB-connection prefix used by `queryDeduction`. No LIVE. No SSH. No staging. No provider. No credits. No product source. No BALANCE semantic change. No generic `source .env`. Keith owns Git.

**PRIVATE-BETA-E2E-AUTO-01K STEP 1 COMPLETE — DEDUCTION DATABASE CONNECTION ROOT CAUSE AND SAFE SECRET-PRESERVING ADAPTER CONTRACT PROVEN — READY FOR ONE TDD SHARED DB-VERIFICATION FIX**
