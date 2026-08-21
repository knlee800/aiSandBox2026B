# PRIVATE-BETA-E2E-AUTO-01F — Step 1 Diagnosis

**Task ID:** PRIVATE-BETA-E2E-AUTO-01F
**Title:** Investigate Unbounded SSH Cleanup Execution
**Step:** 1 — Registration + root-cause/risk investigation ONLY
**Date:** 2026-08-21
**Classification:** AUTOMATION_TOOLING_INVESTIGATION
**Product defect:** NO — not in scope; no product source inspected as a defect
**Production source modification:** NO
**Evidence class:** LOCAL-TESTS (static source + existing CONTRACT tests + existing LIVE timing evidence only)

Diagnostic only. No implementation. No Playwright LIVE. No staging SSH. No provider. No credit. No gate change. No dependency change. No LIVE-06 registration. No Git mutation.

```
UNBOUNDED_SSH_EXECUTION_PROVEN=YES
LIVE_FAILURE_OF_THIS_SURFACE=NOT_YET_OBSERVED
IMPLEMENTATION_PERFORMED=NO
LIVE_RERUN=NO
SSH_CONNECTIONS=0
PROVIDER_CALL_USED=0
CREDITS_DEDUCTED=0
STAGING_ACTIVITY=NONE
GATE_MUTATION=NONE
```

This is a residual surface identified by locked AUTO-01E. It is **not** a proven LIVE hang. Step 1 proves from source that the hang *can* occur.

---

## 0. Source identity / admission facts

```
Current local HEAD     = c4040cdba44758b1298ecdd9c103e4134f9ba856
git status --short     = (clean)
Node                   = v22.14.0
package.json engines   = node >= 20.0.0
@playwright/test       = ^1.62.1
```

`PRIVATE-BETA-E2E-AUTO-01F` was unused repo-wide before this registration.

Predecessor: `PRIVATE-BETA-E2E-AUTO-01E` COMPLETE AND LOCKED — PASS — 2026-08-21. AUTO-01E bounded CREATE_SESSION project observation and recorded `createSshExecutor()` as an out-of-scope residual.

---

## 1. Primary question — can `createSshExecutor()` remain pending indefinitely?

**YES. Proven from source.**

If the spawned `ssh` process never emits `error` and never emits `close`, the returned Promise has no other completion path.

### 1.1 Exact implementation

`e2e/builder-golden-path/lib/staging.ts` lines 387-408:

```ts
export function createSshExecutor(): (argv: string[]) => Promise<string> {
  return (argv) =>
    new Promise((resolve, reject) => {
      const child = spawn('ssh', argv, { shell: false });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ssh exited ${code}: ${stderr || stdout}`));
        }
      });
    });
}
```

### 1.2 Exact subprocess API

- Import: `import { spawn } from 'node:child_process';` (`staging.ts:1`)
- Call: `spawn('ssh', argv, { shell: false })` (`staging.ts:390`)
- Not `exec`, not `execFile`, not `spawnSync`, not `promisify(exec)`
- `shell: false` — no `cmd.exe` wrapper; `ssh.exe` is the direct child on Windows
- Default stdio (not overridden): pipes for stdin, stdout, stderr
- stdin is never written and never `.end()`'d

`argv` comes from `buildSshCommand()` (`staging.ts:53-55`):

```ts
export function buildSshCommand(remoteCommand: string): string[] {
  return [STAGING_SSH_ALIAS, remoteCommand];
}
```

`STAGING_SSH_ALIAS = 'aisandbox-staging'`. The spawned argv is exactly `['aisandbox-staging', <remoteCommand>]`. No `-o`, no `-F`, no identity flags.

### 1.3 Exact awaiting Promise

The Promise constructed at `staging.ts:389`. Callers `await` the function returned by `createSshExecutor()`.

LIVE binds that function here:

`e2e/builder-golden-path/lib/live-adapters.ts:75`

```ts
const execute = options.execute ?? createSshExecutor();
```

`StagingHelper` then `await`s `this.executeFn(...)` / `this.requireExecutor()(...)` for every remote command, including cleanup restore.

### 1.4 Exact completion conditions (only these)

The Promise **resolves** only if `child` emits `close` with `code === 0` (`staging.ts:400-402`).

The Promise **rejects** only if:

1. `child` emits `error` (`staging.ts:399`) — typical spawn failure, e.g. `ssh` not found
2. `child` emits `close` with `code !== 0` (`staging.ts:403-405`) — including `code === null`

There is no third path.

### 1.5 Current timeout / abort / kill behavior

Inspected statements inside `createSshExecutor()`. **None of the following exist:**

| Mechanism | Present? |
|---|---|
| `timeout` spawn option | **NO** |
| `signal` / `AbortSignal` / `AbortController` | **NO** |
| watchdog `setTimeout` | **NO** |
| bounded `Promise.race` | **NO** |
| `child.kill()` | **NO** |
| process-group / `detached` / job-object options | **NO** |
| `taskkill` | **NO** |
| stdin `'ignore'` | **NO** |

Node v22.14.0 `child_process.spawn` **does** support `timeout` and `signal` (`AbortSignal`). This executor does not pass either. Repo `engines.node` is `>=20.0.0`, so both APIs are available to Step 2 without a dependency change.

`child_process.exec` / `execFile` have a `timeout` option that this code does not use, because it uses `spawn`.

### 1.6 stdout / stderr buffering

- stdout and stderr are concatenated into JS strings on `'data'` (`staging.ts:393-398`)
- pipes are therefore drained, so a remote command is unlikely to block forever on a full pipe **because of this executor**
- there is no max-buffer cap; output can grow without bound in memory
- only `stderr || stdout` is placed on a non-zero close rejection; secrets are not stripped
- if the process never emits `close`, buffered strings are never returned to the caller

### 1.7 exit / error event behavior

- `'error'` rejects immediately (spawn failure)
- `'close'` (not `'exit'`) is the success/failure gate. `'close'` fires after the process exits **and** stdio streams close
- `'exit'` is not listened to
- no `'disconnect'` handler

### 1.8 Can a network / TCP / SSH handshake stall leave the Promise unresolved?

**YES, from these statements.** The Promise waits only for the local child to exit. Nothing in this function bounds:

1. TCP connect to the SSH server
2. SSH handshake / auth
3. an already-established session whose remote command does not return

A ConnectTimeout on `ssh` itself is **not** present in argv. Even if a user SSH config supplied `ConnectTimeout`, that would bound connection establishment only — not (2) after the socket is up, and not (3) a live-but-stuck remote command such as a hung `pm2 restart`.

### 1.9 Are interactive SSH prompts prevented?

**NO.** There is no `BatchMode`, no `-n`, no `stdin: 'ignore'`. Default stdin is a pipe that this code never writes. A password / passphrase / host-key confirmation prompt can wait on stdin or a console TTY until the child exits. That is a hang class independent of staging network health.

### 1.10 Are known-host / auth / connect timeouts supplied to `ssh`?

**NO, not in this repository's executor argv.** Exact existing ssh arguments:

```
ssh aisandbox-staging <remoteCommand>
```

Exact values for the asked-about options, **as passed by this executor:**

| Option | Value in `createSshExecutor` / `buildSshCommand` |
|---|---|
| `BatchMode` | **absent** |
| `ConnectTimeout` | **absent** |
| `ConnectionAttempts` | **absent** |
| `ServerAliveInterval` | **absent** |
| `ServerAliveCountMax` | **absent** |
| `StrictHostKeyChecking` | **absent** |

Any `Host aisandbox-staging` settings in an operator `~/.ssh/config` are outside this repo and are **not** part of the executor contract. Step 1 did not read operator SSH config (secrets / out of repo).

### 1.11 Does Node-level timeout protection exist independently of ssh options?

**NO.** There is no Node timer, no `spawn` `timeout`, and no `AbortSignal`. SSH options and Node-level execution timeout are both absent. They are not equivalent even if one were added later:

1. **Connection establishment timeout** — `ConnectTimeout` (not present)
2. **Established-session remote-command hang** — `ServerAliveInterval` detects a *dead* TCP session, not a live process that never returns; not present anyway
3. **Local child-process execution timeout** — the missing bound this task owns

An SSH `ConnectTimeout` alone is **not** an application execution timeout.

---

## 2. Cleanup data flow

Exact LIVE chain, using actual function names:

```
live.spec.ts
  test('LIVE Builder golden path @live-only')
    → createLiveAdapters({ browser })          // live-adapters.ts:183
         createLiveStagingHelper()             // live-adapters.ts:66-84
           execute = createSshExecutor()       // live-adapters.ts:75
         new StagingHelper({ execute })
    → runGoldenPath({ adapters, gateTracker }) // runner.ts:79
         try { … phases … }
         catch { failure = error }             // runner.ts:173-174
         finally {                             // runner.ts:175
           await adapters.cleanup({ ids, gateTracker })  // runner.ts:177
             live-adapters.ts cleanup()        // live-adapters.ts:398
               confirmListener?.dispose()
               page.request.post(session stop) // Playwright HTTP, not SSH
               await staging.restoreExecutionGateIfChanged()  // staging.ts:317
                 await executeFn(buildSshCommand(buildGateRestoreCommand()))
                   createSshExecutor() Promise
                     spawn('ssh', ['aisandbox-staging', restoreCmd], { shell: false })
               await context.close()           // live-adapters.ts:412 — AFTER restore await
               return { cleanup, executionGateFinal }
           phases.push('CLEANUP')              // runner.ts:184-186 — AFTER cleanup await
         }
    → formatPassSummary / formatFailSummary    // runner.ts:189-237 — AFTER finally
    → console.log(result.formatted)            // live.spec.ts:16
```

### A. Which cleanup operations use SSH?

Only gate restoration.

| Cleanup step | Transport | SSH? |
|---|---|---|
| `confirmListener?.dispose()` | in-process | NO |
| `page.request.post(…/api/sessions/:id/stop)` | Playwright APIRequest | NO |
| `staging.restoreExecutionGateIfChanged()` | `executeFn` → `ssh` | **YES**, if `shouldRestore()` and LIVE-authorized with a bound executor |
| `context.close()` | Playwright | NO |

Other SSH uses are **not** cleanup; they are SAFETY / DEDUCTION:

| Caller | Remote command builder | Phase |
|---|---|---|
| `inspectParity` | `buildParityInspectCommand` | SAFETY |
| `inspectGates` | `buildGateInspectCommand` | SAFETY |
| `enableExecutionGate` | `buildGateEnableCommand` | SAFETY |
| `waitForGatewayReady` | `buildGatewayReadyProbeCommand` (loop) | SAFETY |
| `queryDeduction` | `buildDeductionQuery` | DEDUCTION |
| `restoreExecutionGateIfChanged` | `buildGateRestoreCommand` | CLEANUP |

`waitForGatewayReady()` (`staging.ts:291-315`) has `GATEWAY_READY_TIMEOUT_MS = 30_000`, but that deadline only bounds the **loop**. Each iteration `await execute(buildSshCommand(buildGatewayReadyProbeCommand()))` is still the unbounded SSH Promise. If one probe child never exits, the 30s loop cannot advance.

### B. Does restoring `GLOBAL_EXECUTION_ENABLED=false` depend on this executor?

**YES, when the runner changed the gate.**

`buildGateRestoreCommand()` (`staging.ts:151-153`):

```ts
return 'GLOBAL_EXECUTION_ENABLED=false pm2 restart aisandbox-api-gateway --update-env';
```

`restoreExecutionGateIfChanged()` (`staging.ts:317-330`):

- If `gateTracker.shouldRestore()` is false → returns `not-changed-by-runner` / `not-attempted-no-authority`. **No SSH.**
- If executor missing or not LIVE-authorized → `describeRestore(false)` = `restore-failed`. **No SSH.**
- Else `await this.executeFn(buildSshCommand(buildGateRestoreCommand()))`. **This is the SSH child.**
- Success → `restored-false`
- Thrown rejection → `restore-failed`
- **Never-resolving Promise → no status is produced**

`shouldRestore()` is true only after `recordEnabledByRunner()` (`safety-gates.ts:114-116`), which `enableExecutionGate()` calls at `staging.ts:287` after the enable SSH command returns.

### C. Is `BILLING_CHARGES_ENABLED` restoration involved?

**NO.** The runner inspects it (`buildGateInspectCommand` greps both flags) and never sets it. Restore argv sets only `GLOBAL_EXECUTION_ENABLED=false`. Billing charges are not mutated by this executor.

### D. If SSH never resolves, which statements after it cannot execute?

If the hang is the restore `await` at `staging.ts:325` / `live-adapters.ts:411`:

- `restoreExecutionGateIfChanged` cannot `return` success or `catch`
- `context.close()` (`live-adapters.ts:412`) does not run
- `cleanup()` does not return
- `runGoldenPath` finally cannot assign `cleanup` / `executionGateFinal`, cannot enter the cleanup `catch`, cannot `phases.push('CLEANUP')`
- formatted PASS/FAIL verdict is not produced (`runner.ts:189-237`)
- `live.spec.ts` `console.log(result.formatted)` does not run

Session-stop HTTP **does** run before restore (`live-adapters.ts:401-410`). A restore hang does not prevent the stop request from having been issued; it prevents observing its result in a verdict and prevents `context.close()`.

### E. Does the runner produce a terminal verdict before or after this cleanup await?

**AFTER.** Verdict construction is strictly after the `try/catch/finally` (`runner.ts:189`). CLEANUP is pushed at the end of `finally`, and only after `await adapters.cleanup(...)` settles.

### F. Can Playwright's 600000ms outer timeout still terminate the overall test while cleanup is hung?

**At the test-status level, the timer still fires. It is not a reliable SSH bound.**

Evidence:

- `playwright.live.config.ts:16` sets `timeout: 10 * 60 * 1000` (600000)
- `live.spec.ts` has no extra timeout around `runGoldenPath`
- AUTO-01E / LIVE-05 proved that a hang **inside the try** (Playwright `waitForResponse`) lets the outer timeout abort **outside** `runGoldenPath`, skipping `finally`
- A hang **inside `finally`** is different: `finally` has already started. The test function is still awaiting `runGoldenPath`. When 600000ms elapses, Playwright marks the test timed out
- The hung object is a raw Node `child_process` Promise, not a Playwright handle. Playwright abort of Playwright operations does **not** call `child.kill()`
- LIVE-05's process **did** exit after 10.0m because the hung call was a Playwright wait Playwright can interrupt. That is **not** proof that a hung `ssh.exe` is interrupted the same way
- On Windows, killing the Node worker does not reliably kill child processes unless a job object is used. This executor sets `detached` default / `shell: false` and never creates a process group. An orphan `ssh.exe` is possible

Do **not** treat the 600s test timeout as the SSH execution timeout.

### G. If the outer timeout wins, what safety state could remain uncertain?

Do **not** claim the execution gate would definitely remain `true`. Source proves only:

- If `shouldRestore()` is true, restore SSH was the remaining confirmation path
- If that await never completes, the runner never records `restored-false` or `restore-failed`
- Actual PM2 / `.env` gate value on staging is then **unknown to the runner**
- It may already be false (restore succeeded on the server but the local child never closed), still true (restore never reached `pm2`), or in restart (restore started)

LIVE-05's `executionGateFinal=restored-false` was **operator recovery after a skipped finally**, not runner confirmation (`docs/PRIVATE-BETA-E2E-LIVE-05-CHECKPOINT.md`). That historical operator restore is not evidence that a hung cleanup SSH self-heals.

---

## 3. Process termination semantics (Windows / Node v22.14.0)

Relevant environment: Keith's Windows machine, Node v22.14.0, `spawn('ssh', argv, { shell: false })`.

- Direct child is `ssh.exe` (or whatever `ssh` resolves to on `PATH`)
- `child.kill()` in Node on Windows uses `TerminateProcess` on that PID. `SIGTERM` and `SIGKILL` both terminate. That is sufficient to end **that** `ssh.exe`
- A process *tree* is not created by this spawn options object. `taskkill /T` is not indicated unless later evidence shows leftover grandchildren (e.g. operator `ControlMaster` outside this repo)
- `AbortSignal` **is** supported by `spawn` on this Node version. Current code does not use it
- Step 2 should be: named timer → `child.kill()` → wait for `'close'` → typed timeout error with captured stdout/stderr. Not a cross-platform process manager

---

## 4. Existing test coverage — gap

No test exercises "spawned ssh child never exits."

| Test | What it actually does | Catches unbounded child? |
|---|---|---|
| `live-adapters.spec.ts` "binds the existing SSH executor…" | `typeof createSshExecutor() === 'function'`; injected `execute` **throws** `ssh exited 255` | **NO** — injected rejection, not a live child |
| AUTO-01C restore test | injected `execute` **returns** `''` for restore | **NO** — resolves immediately |
| `safety-gates.spec.ts` finally-style cleanup | `createRecordingAdapters().cleanup` returns immediately with `restored-false` | **NO** — no SSH |
| AUTO-01E CREATE_SESSION hang tests | fixture stalls Playwright responses; cleanup still uses recording/injected restore that returns | **NO** |
| Source-shape `toContain('createSshExecutor()')` | string present | **NO** |

Injected rejection is explicitly **not** proof. Existing tests never spawn `ssh`, never pass a child that omits `'close'`/`'error'`, and never assert a finite executor timeout. CONTRACT `playwright.config.ts` `timeout: 30_000` would eventually fail a truly hung test, but no current test creates that hang — so the gap is silent.

---

## 5. Safety design: control regained vs gate confirmed

These are different facts:

| State | Meaning | How it can be known after SSH timeout |
|---|---|---|
| **Runner regained control** | `createSshExecutor` Promise settled; `cleanup()` returned; `runGoldenPath` emitted a verdict; `CLEANUP` recorded | **YES** — that is what a local execution timeout proves |
| **Gate restoration confirmed** | `GLOBAL_EXECUTION_ENABLED=false` actually applied on staging (success of `buildGateRestoreCommand`) | **NO** — timeout only proves the local child was killed. The remote `pm2 restart` may have run, not started, or be in flight |

`describeRestore(true)` → `restored-false` must be reserved for a **completed** restore command (`close` code 0). A timeout must **not** be reported as `restored-false`.

Current `catch { return describeRestore(false) }` maps any rejection to `restore-failed`. That is closer, but it does not say "unconfirmed because the restore command itself timed out." Step 2 should add an explicit status, e.g. `restore-unconfirmed-timeout`.

Do **not** invent a second production control plane (no extra SSH retry, no out-of-band PM2 channel, no AUTO-01F staging mutation). If restore SSH times out, the runner/operator report must be:

```
executionGateFinal=restore-unconfirmed-timeout
GATE_RESTORATION_CONFIRMED=NO
OPERATOR_ACTION=verify GLOBAL_EXECUTION_ENABLED on staging using existing inspect/restore commands; do not assume false
```

---

## 6. Minimal deterministic RED tests for Step 2 (not implemented now)

No real staging. No real SSH network. No `GLOBAL_EXECUTION_ENABLED` mutation.

### 6.1 Executor-level RED

Inject a fake `spawn` (EventEmitter child: `stdout`/`stderr` emitters, `kill()`, never emits `'close'` or `'error'` unless `kill()` is invoked).

Against **current** `createSshExecutor()` (hardcoded `spawn`, no timeout):

1. Call the executor with the fake child
2. `Promise.race` the returned Promise against a 200ms probe
3. Assert the race yields `still-pending` (not resolved, not rejected)
4. Fake `kill()` in `afterEach` so CONTRACT does not leak a handle

That proves unbounded pending **without** using Playwright's 30s suite timeout as the oracle, and without treating an injected `throw` as proof.

After Step 2, the same fake child plus `timeoutMs: 200` must reject with the typed timeout error, and the fake `kill()` must have been called.

### 6.2 Runner-level RED

Wire `StagingHelper` / LIVE `cleanup()` to that same never-exiting executor (not an injected `execute` that simply never returns **bypassing** `createSshExecutor` — that would miss the spawn/kill contract).

`gateTracker.recordEnabledByRunner()` so restore SSH is actually attempted.

Assert:

- `runGoldenPath` returns in well under CONTRACT 30s and well under LIVE 600s
- `CLEANUP` is recorded
- a formatted verdict exists
- `executionGateFinal` is **not** `restored-false`
- `executionGateFinal` **is** the explicit unconfirmed-timeout status
- `cleanup` string may be session-stop result; do not claim session-stop unperformed unless it did not run

Cannot assert staging PM2 is false. Assert only: runner regained control, gate restoration **unconfirmed**.

---

## 7. Recommended Step 2 design (NOT implemented)

Derived from the evidence above.

### Timeout value

**`SSH_EXECUTION_TIMEOUT_MS = 30_000`**

Evidence, not an arbitrary number:

- `GATEWAY_READY_TIMEOUT_MS` is already 30_000 for the post-restart ready loop
- `LIVE_ACTION_TIMEOUT_MS` is 30_000
- `SESSION_CREATE_TIMEOUT_MS` is 30_000
- LIVE-02..LIVE-05 SAFETY SSH (parity, inspect, enable, ready-wait) completed in seconds; LIVE-03's `pm2 restart` returned fast enough that STARTING_BALANCE ran into HTTP 502 immediately — restart was not a long hang
- AUTO-01C already budgets 30s **after** enable SSH returns; enable/restore SSH itself is `pm2 restart`, historically short
- Outer LIVE timeout is 600_000; a 30s cleanup bound leaves margin. A 60s bound is optional only if later LIVE evidence shows `pm2 restart` over SSH exceeding 30s
- CONTRACT tests must override to ~200ms so they cannot approach the 30_000 suite timeout

60_000 (`LIVE_NAVIGATION_TIMEOUT_MS`) is the documented fallback if Step 2 hits a realistic `pm2 restart` duration concern. Default recommendation remains 30_000.

### Child termination

On timeout: `child.kill()` (Windows `TerminateProcess` on `ssh.exe`). Then settle on `'close'` or a short kill-wait, and reject typed. Use `stdin: 'ignore'` so the unused default stdin pipe is not an extra hang surface. Optional one-flag hardening, still in this task's spawn argv: `-o BatchMode=yes` so auth prompts fail closed instead of waiting the full 30s. No `taskkill /T`. No retry. No second SSH attempt.

### Typed error

New `SshExecutionTimeoutError` in `staging.ts` (same file as `SshExecutorMissingError` / `GatewayNotReadyError`):

- `name = 'SshExecutionTimeoutError'`
- message includes the timeout ms and that the child was killed
- include truncated stdout/stderr already collected; do not dump env/secrets

`restoreExecutionGateIfChanged` must catch this class and return `restore-unconfirmed-timeout` (new `GateRestoreStatus`). Other SSH failures remain `restore-failed`. Success remains `restored-false`.

### Runner behavior on timeout

- Promise settles → `finally` completes → verdict is emitted
- `executionGateFinal=restore-unconfirmed-timeout`
- `GATE_RESTORATION_CONFIRMED=NO` in operator-facing summary/error text
- `context.close()` still runs because restore no longer hangs
- no retry, no extra SSH, no staging/provider/credit

### Smallest Step 2 file scope

- `e2e/builder-golden-path/lib/staging.ts` — timeout, kill, typed error, restore status mapping, optional spawn injection + `timeoutMs` for tests
- `e2e/builder-golden-path/lib/constants.ts` — `SSH_EXECUTION_TIMEOUT_MS`
- `e2e/builder-golden-path/lib/safety-gates.ts` — add `restore-unconfirmed-timeout`
- `e2e/builder-golden-path/tests/live-adapters.spec.ts` — executor never-exits RED/GREEN + runner cleanup bound
- `e2e/builder-golden-path/tests/safety-gates.spec.ts` — new status mapping

`live-adapters.ts` / `runner.ts` need not change if restore swallows the typed error into the new status and still returns.

No package/lockfile. No product source. No Playwright LIVE config. No `page.goto` / `selectOption` / `trace` work.

### Excluded residual surfaces (AUTO-01E, not this task)

- unrelated `page.goto()`
- `submitBuild()` `selectOption` fallbacks
- `trace: 'off'`
- LIVE-06 registration

---

## 8. Step 1 activity ledger

```
production source modified     = NONE
automation implementation      = NONE
Playwright LIVE runs           = 0
Playwright CONTRACT runs       = 0
SSH connections                = 0
staging mutations              = 0
provider calls                 = 0
credits                        = 0
execution gate                 = untouched
dependencies added             = NONE
Git mutations                  = NONE
browser journeys started       = 0
```

---

**PRIVATE-BETA-E2E-AUTO-01F Step 1 — unbounded SSH child execution PROVEN from source — not yet observed as a LIVE failure — no implementation**
