# PRIVATE-BETA-E2E-AUTO-01F — Final Checkpoint

**Task ID:** PRIVATE-BETA-E2E-AUTO-01F  
**Title:** Investigate Unbounded SSH Cleanup Execution  
**Parent:** PRIVATE-BETA-E2E-AUTO-01 — COMPLETE AND LOCKED — PASS — 2026-08-20  
**Predecessor:** PRIVATE-BETA-E2E-AUTO-01E — COMPLETE AND LOCKED — PASS — 2026-08-21  
**Final Status:** COMPLETE AND LOCKED — PASS — 2026-08-21  
**Checkpoint Date:** 2026-08-21  
**Lifecycle:** 3-step  
**Workstream:** RELIABILITY  
**Evidence class:** LOCAL-TESTS  
**Classification:** AUTOMATION_TOOLING_INVESTIGATION + bounded AUTOMATION_TOOLING_FIX  
**Product defect:** NO  
**Production source modification:** NO  
**Nature of Step 3:** GOVERNANCE / CONSOLIDATION ONLY — no implementation, LIVE, staging, SSH, provider, credit, env, gate, package, or Git mutation

```
UNBOUNDED_SSH_EXECUTION_PROVEN=YES
UNBOUNDED_SSH_EXECUTION_BOUNDED=YES
LIVE_FAILURE_OF_THIS_SURFACE=NOT_YET_OBSERVED
AUTOMATION_TOOLING_FIX=YES
PRODUCT_DEFECT=NO
PRODUCTION_SOURCE_MODIFICATION=NO
SSH_EXECUTION_TIMEOUT_MS=30000
CONTRACT_TIMEOUT_OVERRIDE_MS=200
RESTORE_TIMEOUT_STATUS=restore-unconfirmed-timeout
BATCHMODE_ADDED=NO
CONTRACT_TESTS=75 passed (64 pre-existing + 11 new)
TYPESCRIPT=PASS
GIT_DIFF_CHECK=PASS
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / PROHIBITED
LIVE-06_REGISTERED=NO
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
SSH_CONNECTIONS=0
STAGING_ACTIVITY=NONE
GATE_MUTATION=NONE
```

Step 2 implementation is already on HEAD `03614c72f93b05d485fda204f1220331c4d5b5f3` (`bound automated E2E SSH execution`). Keith owns Git. This consolidation does not commit.

Do not treat this checkpoint as a scheduler. Do not freeze a staging deployment SHA here. Do not register PRIVATE-BETA-E2E-LIVE-06 here. Do not rerun LIVE-05 or LIVE-04. Do not retry LIVE-03/02/01. Do not reopen AUTO-01E. Do not claim Builder private-beta readiness.

---

## 1. Lifecycle

1. Registration + unbounded-SSH-cleanup investigation (diagnostic only) — COMPLETE — 2026-08-21 — `docs/PRIVATE-BETA-E2E-AUTO-01F-DIAGNOSIS.md`
2. Bounded SSH execution timeout + CONTRACT validation — COMPLETE — 2026-08-21 — HEAD `03614c72f93b05d485fda204f1220331c4d5b5f3`
3. Consolidation / checkpoint / lock — COMPLETE — 2026-08-21 — this document

Lane 1 only throughout. Lane 2 EMPTY throughout. Lane 3 DISABLED throughout.

---

## 2. Step 1 source-risk proof — `createSshExecutor()` could remain pending indefinitely

AUTO-01F proved **from source** that `createSshExecutor()` could remain pending indefinitely. This was a **PROVEN SOURCE RISK**. It was **NOT** an observed LIVE failure.

Implementation before Step 2:

```ts
spawn('ssh', argv, { shell: false })
```

The executor Promise settled only on:

- child `'error'`
- child `'close'`

There was:

- no execution timeout
- no watchdog
- no AbortSignal
- no `child.kill()`
- no bounded race

Cleanup chain:

```
runGoldenPath()
  → finally
  → cleanup()
  → restoreExecutionGateIfChanged()
  → executeFn()
  → createSshExecutor()
  → ssh.exe
```

If `ssh.exe` never exited during execution-gate restoration:

- cleanup could remain pending
- `context.close()` might not run
- CLEANUP might not be recorded
- the formatted verdict might not be emitted
- `GLOBAL_EXECUTION_ENABLED` state would become unconfirmed

Playwright's `600000ms` outer timeout is not a reliable bound on `ssh.exe` and must not be treated as gate-restore confirmation.

Full analysis: `docs/PRIVATE-BETA-E2E-AUTO-01F-DIAGNOSIS.md`.

---

## 3. Step 2 bounded subprocess implementation

Files changed (exactly five, all inside the declared Step 2 write scope):

- `e2e/builder-golden-path/lib/constants.ts`
- `e2e/builder-golden-path/lib/staging.ts`
- `e2e/builder-golden-path/lib/safety-gates.ts`
- `e2e/builder-golden-path/tests/live-adapters.spec.ts`
- `e2e/builder-golden-path/tests/safety-gates.spec.ts`

No production frontend/backend source. No package/lockfile change. No dependency added.

### 3.1 Production SSH execution bound

| Bound | Constant | Value |
|---|---|---|
| production SSH child execution | `SSH_EXECUTION_TIMEOUT_MS` | **30000** |
| CONTRACT injected override | `timeoutMs` | **200** |

### 3.2 Kill-and-immediate-settle behavior

On timeout:

1. the executor marks itself settled
2. `child.kill()` is called exactly once
3. the executor rejects immediately
4. the executor does **not** wait for child `'close'`
5. a later `'close'` / `'error'` cannot double-settle
6. the timer is cleared on normal completion
7. there is no retry
8. there is no second SSH process

Direct child:

- command: `ssh`
- `shell: false`
- `stdio`: stdin ignored, stdout/stderr piped

No `taskkill`. No process-tree manager.

### 3.3 Typed error

**`SshExecutionTimeoutError`** in `e2e/builder-golden-path/lib/staging.ts`.

Safe diagnostics include:

- timeout milliseconds
- kill invoked / accepted state
- stdout truncated to maximum **400** characters
- stderr truncated to maximum **400** characters

The error does not emit command argv or secrets. No password, credential, or environment-secret diagnostic output was added.

### 3.4 BatchMode decision

**`BatchMode=yes` was NOT added.**

Reason: the staging alias `aisandbox-staging` depends on operator SSH configuration outside the repo. Its authentication mechanism was not inspected, so changing interactive/auth semantics was not justified inside this bounded lifecycle.

AUTO-01F owns the local subprocess execution bound only.

### 3.5 Gate restoration semantics

When SSH gate restoration times out:

```
executionGateFinal = restore-unconfirmed-timeout
```

**NEVER** `restored-false`.

Reason: timeout proves only that the local runner regained control. It does **not** prove whether the remote command

```
GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env
```

was never started, partially executed, completed remotely, or still in flight. Operator verification/remediation is therefore required.

Other existing SSH failures retain `restore-failed`. Success remains `restored-false`.

Do not claim false gate certainty. Do not claim `GLOBAL_EXECUTION_ENABLED=false` for a `restore-unconfirmed-timeout` path.

### 3.6 Cleanup recovery

Step 2 CONTRACT proof:

```
SSH restore timeout
  → SshExecutionTimeoutError
  → restoration marked restore-unconfirmed-timeout
  → local cleanup continues
  → CLEANUP recorded
  → runner returns terminal FAIL verdict
```

Observed CONTRACT cleanup evidence:

- `cleanup=session-stopped`
- CLEANUP is last
- runner regains control well below Playwright's `600000ms` outer timeout
- `providerGuard.usedCount = 0`
- `providerGuard.remaining = 1`

No credit mutation.

---

## 4. RED evidence

Before implementation, the never-exiting fake child remained:

```
still-pending
```

after the external 1-second watchdog.

After implementation, the same behavioral class terminates at the injected `timeoutMs = 200` with `SshExecutionTimeoutError`, `child.kill()` called exactly once, and no wait for `'close'`.

---

## 5. Regression coverage

Eleven new CONTRACT tests prove:

- a never-exiting SSH child times out
- `child.kill()` is called exactly once
- timeout rejects promptly
- timeout does not await `'close'`
- a late `'close'` cannot double-settle
- a late `'error'` cannot double-settle
- normal exit 0 still returns stdout
- nonzero exit retains existing failure behavior
- spawn error retains existing failure behavior
- no SSH retry
- runner cleanup regains control and reports `restore-unconfirmed-timeout`

Provider proof on the restore-timeout runner path:

```
providerGuard.usedCount = 0
providerGuard.remaining = 1
```

No credit mutation.

---

## 6. Validation

Independent Step 3 re-verification (2026-08-21), clean tree at HEAD `03614c72f93b05d485fda204f1220331c4d5b5f3`:

| Check | Result |
|---|---|
| `npx tsc --noEmit --project e2e/builder-golden-path/tsconfig.json` | **PASS** |
| `npm run e2e:builder:contract` | **75 passed** (64 pre-existing + 11 new) — PASS — 8.1s |
| `git diff --check` | **PASS** — no output |

Not performed in AUTO-01F (any step):

- `npm run e2e:builder:live`
- real SSH
- staging access / staging mutation
- provider call
- credit mutation
- execution-gate mutation
- dependency / lockfile change
- product source modification
- Git mutation
- LIVE-06 registration
- repair of residual `page.goto()` / `selectOption` / `trace` surfaces

```
RUNTIME_EXECUTION_AUTHORIZED=NO
PROVIDER_CALL_AUTHORIZED=NO
CREDIT_MUTATION_AUTHORIZED=NO
STAGING_MUTATION_AUTHORIZED=NO
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
SSH_CONNECTIONS=0
STAGING_ACTIVITY=NONE
GATE_MUTATION=NONE
```

---

## 7. Residual / explicitly out-of-scope surfaces

AUTO-01F **did not fix** and must not be claimed to close:

- unrelated `page.goto()`
- `submitBuild()` provider/model `selectOption` fallbacks
- `playwright.live.config.ts` `trace: 'off'`

AUTO-01F does **not** close all possible automation hangs. It specifically bounded local SSH subprocess execution so cleanup and execution-gate restoration cannot hang indefinitely.

No new safety-critical blocker was discovered in Step 3. Residual `page.goto()` / `selectOption` / `trace` items are **not** justification for another tooling-hardening lifecycle before LIVE.

---

## 8. Readiness consequence

AUTO-01F PASS means local SSH cleanup execution is finitely bounded at 30s **in CONTRACT**. A restore-command timeout kills the direct SSH child, returns control, records CLEANUP, and reports `restore-unconfirmed-timeout` without falsely claiming gate restoration.

It does **not** prove LIVE staging golden-path validation. AUTO-01F is CONTRACT-only.

```
LIVE_STAGING_VALIDATED=NO
BUILDER_PRIVATE_BETA_READINESS=NO_GO_PENDING_FRESH_AUTOMATED_E2E
PRIVATE-BETA-INVITE-01=UNREGISTERED / UNAUTHORIZED / UNTOUCHED / PROHIBITED
```

**Next recommended lifecycle (NOT REGISTERED HERE):** a fresh automated LIVE Builder E2E. Likely identifier **PRIVATE-BETA-E2E-LIVE-06** — still unused as a registered task at this lock (mentioned only as a recommended future identifier). The identifier **must be re-verified unused at registration**.

That future LIVE lifecycle must:

- deploy / verify the current clean authorized HEAD
- run the automated golden path exactly once
- consume one xAI / grok-4.5 provider-call budget
- perform zero retries
- allow an intentional qualifying credit deduction only if the golden path reaches it
- preserve every hard safety gate
- verify cleanup regardless of verdict
- treat `restore-unconfirmed-timeout` as unconfirmed gate state requiring operator verification, never as `GLOBAL_EXECUTION_ENABLED=false`

It is **not** registered or authorized by this lock. Do not rerun LIVE-05. Do not rerun LIVE-04. Do not retry LIVE-03/02/01. Do not reopen AUTO-01E. Do not return to manual browser testing. Do not start another tooling-hardening lifecycle merely because residual `page.goto()` / `selectOption` / `trace` items exist.

---

## 9. Step 3 consolidation writes

- `docs/PRIVATE-BETA-E2E-AUTO-01F-CHECKPOINT.md` — this document
- `TASKS.md` CURRENT EXECUTION BOARD only — AUTO-01F LOCKED; Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED; HOTFILE / GOVERNANCE released
- `TASKS_BACKLOG_FULL.md` — AUTO-01F final status / next recommendation only

No implementation change, and no locked-body rewrite, in Step 3.

Preserved and not modified in this consolidation:

- `docs/PRIVATE-BETA-E2E-AUTO-01F-DIAGNOSIS.md`
- `docs/PRIVATE-BETA-E2E-AUTO-01E-CHECKPOINT.md`
- locked AUTO-01 / AUTO-01A / AUTO-01B / AUTO-01C / AUTO-01D / AUTO-01E / LIVE-01..LIVE-05 bodies

---

**PRIVATE-BETA-E2E-AUTO-01F — COMPLETE AND LOCKED — PASS — 2026-08-21**
