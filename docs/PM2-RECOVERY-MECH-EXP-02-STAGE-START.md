# PM2-RECOVERY-MECH-EXP-02 — Stage-start (Step 1 registration + Step 2 scope freeze) — bounded local experiment on the H-2 brace-group capture hypothesis, single case B-1

**Task:** PM2-RECOVERY-MECH-EXP-02
**Nature:** GOVERNANCE / EVIDENCE (off-repo tooling route, AMENDMENT-02 §10; no implementation lane; no sidecar candidate; `AISB_MACHINE_REG_V1 nature=GOVERNANCE`)
**Lifecycle:** 4-step (Step 1 registration → Step 2 this freeze → Step 3 execution of the single case B-1 [NOT AUTHORIZED by this window] → Step 4 independent review and lock of the *experiment record*, never of readiness [NOT AUTHORIZED by this window])
**Authorization (Keith, 2026-10-02):** documentation and off-repository source preparation only — registration, scope freeze, authoring of the candidate / corrected harness copy / assertion script, static review, hashes, review package. **Step 3 execution and Step 4 closure are not authorized.** No experiment, runtime test, probe, host access, successor registration, adoption of PRIV-INSPECTION-01 §17, acceptance, lock, staging, commit or push.
**Baseline:** HEAD `d6425171480342e7ed045820cc6472061ef4a400`; working tree carries only the inherited `M docs/control-plane/SATURATION_PROOF.json` (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`), preserved unmodified; validator proofs for this task are written outside the repository.
**Evidence class:** LOCAL-TESTS. **Mutexes:** GOVERNANCE transiently for record writes only. No STAGING, LOCAL-RUNTIME, PROVIDER-LIVE, ENV, CREDIT.
**Write scope:** this file; required `TASKS.md` / `TASKS_BACKLOG_FULL.md` registration and status records; `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-02\stage-a\` (source, fixtures, evidence, hashes, review package). Nothing else. The locked `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\` tree and all historical evidence are read-only inputs and are not modified.

## 0. What this task is not

- Not a host-inspection successor. Not a mechanism-readiness approval. Not a reopening of PM2-RECOVERY-MECH-EXP-01 (COMPLETE AND LOCKED as a failed experiment record) and not an amendment to any locked document. Not an adoption of PRIV-INSPECTION-01 §17 (PROPOSED / NOT ADOPTED, preserved verbatim). Not a change to AMENDMENT-02 (LOCKED, decision record only), PRIV-INSPECTION-01 §§0–13 / §6.3 ceilings / §8 stop items, INVENTORY-01, or any other locked predecessor.
- Inspection-mechanism host use remains BLOCKED. Readiness remains BLOCKED under AMENDMENT-02 §6.3 (C2) and §8.5 (5). No local result from this task changes either; no local result authorizes a Stage B or any host contact.
- A new exploratory local experiment on a new hypothesis (H-2). H-2 is not a repair of MECH-EXP-01's frozen candidate inside that task; MECH-EXP-01 §11.7 states that a replacement shape is a new hypothesis requiring its own authorization. This is that registration.
- Produces, if ever executed, class T evidence about a Windows/MSYS fixture only.

## 1. Hypothesis under test (UNVERIFIED; frozen verbatim)

H-2: in a host-authoritative single brace block with one READY/GO gate, the per-command capture shape

```
{ cmd </dev/null 2>&3 | cap OUT ... 3>&-; ps=("${PIPESTATUS[@]}"); } 3> >(cap ERR ... >&2); fpid=$!; wait "$fpid"
```

gives the parent shell (a) the stdout filter's exit status via `PIPESTATUS[1]`, (b) the stderr filter's pid via `$!` and its exit status via `wait "$fpid"`, because the stderr process substitution is attached as a redirection of a brace group executed by the parent rather than of a pipeline element executed by a subshell; (c) byte-separate channels, because the stderr filter writes to the parent's real stderr (`>&2`) and the stdout filter closes its inherited copy of the stderr pipe (`3>&-`); and (d) a positive-confirmation gate — dispatch of command *n+1* only when `ps[0]=0`, `ps[1]=0`, `se=0` are all present, numeric and confirmed — stops the sequence on any missing, malformed or non-zero status.

Origin (established, MECH-EXP-01 §11.2 / §12.3 / §13.2): in the H-1 shape `cmd 2> >(cap ERR) | cap OUT; wait $!`, the procsub was forked by the left pipeline element's subshell; `$!` was empty in the parent, `wait ""` returned 1, status 3 was never retrieved and the next command ran. Probe 1 and `toolcheck-output.txt` (same MSYS bash 5.2.15) established that for a *simple command* `: 2> >(exit 3)`, `$!` is the procsub pid and `wait $!` returns 3. H-2's assumptions (untested; §9 tests them): a procsub attached as a *group* redirection is forked by the parent with `$!` equal to its `$BASHPID`; a foreground pipeline inside the group leaves `$!` unchanged; `wait` on it returns its status after a delayed exit; `>&2` + `3>&-` give byte-exact separation.

Compliance criteria are not redefined. Ceilings (shared contract): 15 s per command, 120 s session, 65536 B / 2000 L aggregate (PRIV-INSPECTION-01 §6.3). AMENDMENT-02 §6.3 (C2) readiness rule unchanged. An observation that cannot establish a criterion is INCONCLUSIVE-EVIDENCE, never PASS.

## 2. Result dimensions, kept apart

1. **Experiment completion** — whether B-1 ran, artifacts hashed. 2. **Candidate result** — B-1 verdict per §9.6 precedence. 3. **Readiness** — never produced by this task.

## 3. Frozen conditions

Keith's MECH-EXP-01 conditions 1–8 are carried over as applicable and tightened as follows (verbatim text in MECH-EXP-01 stage-start §3; not restated):

1. Stage A only; Windows-local; unprivileged; existing local PowerShell / MSYS tools; no Docker, WSL, sudo, SSH, network, package installation, host contact, application runtime or subagents.
2. **Exactly one case, B-1.** No additional cases, probes, retries or design expansion. The candidate is not edited after this freeze.
3. Harness protection (Job Object, watchdog, retention budget, reader timeout) is not part of the candidate stop mechanism; harness intervention never produces PASS (§9.6).
4. Bounds: 60 s per case; one shared 256 KiB retained budget for candidate stdout + stderr; 30 min batch; candidate aggregate accounted against 65536 B / 2000 L with declared per-channel tightening; diagnostic logs accounted separately (§7).
5. Instrumentation, clock source and uncertainty frozen in §6. Fixture markers are not OS-observed exec events.
6. B-1 requires the producer to return 0; there is no expected-error bypass (§9.1).
7. **No follow-on probe, rerun or redesign after the first decisive failure.** A FAIL, CASE-INVALID or INCONCLUSIVE-EVIDENCE verdict ends candidate testing under this task; the result is recorded and hashed.
8. Cleanup is limited to test-owned processes and the task directory; evidence is preserved; no whole-computer absence-of-writes or absence-of-processes claim.

## 4. Environment (observed in MECH-EXP-01; not re-run here)

From MECH-EXP-01 `stage-a\evidence\toolcheck-output.txt`: MSYS bash 5.2.15(1)-release (`C:\Program Files\Git\usr\bin\bash.exe`; `MSYS_NT-10.0-22631 3.4.7`); GNU coreutils 8.32 (`timeout`, `sleep`, …); `EPOCHREALTIME` supported; process substitution and `/dev/fd` present; Windows PowerShell 5.1; .NET `Add-Type` for the Job Object adapter. The candidate's `OPTS` audit line re-records bash version and shell options at execution time (§9.4 S1). No tool is installed by this task.

## 5. Declared deviations from the host form of H-2

| Host form | Stage A fixture | Consequence |
|---|---|---|
| `ssh -T … bash -s` with the block on stdin | local `bash.exe candidate.sh`; harness pipes GO on stdin | ssh stdin/EOF behaviour NOT tested |
| `timeout -s TERM -k 1 14 sudo -n timeout -s TERM -k 1 13 <utility>` | `timeout -s TERM -k 1 3 timeout -s TERM -k 1 2 bash util.sh` (no sudo; fixture utility) | sudo relay, root survivors, Linux signal semantics NOT tested |
| host 15 s / 120 s / 65536 B / 2000 L | budget 15 s, per-command ceiling 3 s, per-channel caps 2048 B / 60 L (recorded in the audit `OPTS` line) | shortened deadlines; full ceilings NOT tested; aggregate accounted, not enforced |
| bash process substitution backed by `/dev/fd/N` | `/dev/fd` present locally (MECH-EXP-01 toolcheck) | **Bash's process-substitution backing (`/dev/fd` vs a temporary named pipe) is platform-dependent and is NOT assumed for H.** A FIFO-backed procsub would be a remote filesystem write (PRIV-INSPECTION-01 §8 item 5; §17 "no remote writes") and would make the shape inadmissible for host use as-is. B-1 says nothing about H's implementation. |
| INVENTORY-01 supervisor as local backstop (H-1 wording) | `Run-Case.ps1` + `AisbJob.cs` (pattern from INVENTORY-01 §13.4), not the INVENTORY-01 supervisor | declared explicitly (MECH-EXP-01 §12.8(2) correction carried forward); the backstop element is not exercised |
| independent OS exec observation | none; `UTIL-EXEC` is a fixture marker written by the utility's own bash | exec evidence is marker-based |
| local `ssh.exe` termination by the supervisor | not simulated | **Local SSH termination does not prove remote parent / filter / wrapper / child termination.** A descendant holding fd 3 or the stdout pipe blocks the gate — fail-closed for dispatch, not termination. |

## 6. Clock source, instrumentation, uncertainty (frozen)

- Candidate, filter and utility audit lines: bash `$EPOCHREALTIME` (wall clock, not monotonic). **Every candidate audit line carries the writer's pid** as its second field (`<t> <writerPid> <EVENT> <detail>`). The frozen, unchanged `util.sh` writes `<t> UTIL-<EVENT> <detail>` and records its pid inside the detail; the assertion script parses both forms.
- **Program order:** among audit lines with the same writer pid, file position is program order for that process (each line is one synchronous `>>` append by that process). Parent-written events (`PRE-EXEC`, `PIPE-RETURN`, `WAIT-RETURN`, `STOP-EVENT`, `STOPPED`, `NOT-STARTED`, `DISPATCH-OK`, `SCRIPT-END`) are ordered by file position after verifying they share the `SCRIPT-START` writer pid. Lines from different writers may interleave; cross-writer order is never read from file position.
- **No timing requirement on successful `wait` completion.** `wait "$fpid"` returning 3 is itself the proof that the stderr filter exited before `wait` returned; no 20 ms separation is applied to it. Wall-clock differences (`WAIT-RETURN` − `FILTER-EOF tag=ERR`; `FILTER-EXIT tag=ERR` vs `WAIT-RETURN`) are recorded as diagnostics only and are **not** claimed to measure time spent blocking in `wait`.
- **Cross-clock band (20 ms):** used only for the pre-intervention FAIL exception (§9.6 rule 3b), comparing audit `EPOCHREALTIME` with the harness's `DateTime.UtcNow` Unix seconds (same Windows system clock; coarse ~1–16 ms; polling 5 ms). A defect established only from untimed files (`candidate-stdout.bin`, `candidate-stderr.bin`) is never eligible for that exception.
- Harness lines: `DateTime.UtcNow` Unix seconds plus a monotonic `Stopwatch` (`sw=`).

## 7. Bounds and accounting (frozen; harness protection separate from candidate behaviour)

- **Harness:** 60 s wall-clock watchdog; **one shared retained budget of 262144 B across candidate stdout + stderr** (`-RetainBytes`); bytes beyond the budget are counted only (`droppedStdoutBytes` / `droppedStderrBytes`), never retained and never copied into any diagnostic log; budget exhaustion fires `WATCHDOG-FIRE reason=RETENTION` → `JOB-TERMINATE`; READY parsing bounded to a 256 B stdout prefix (`-ReadyPrefixBytes`), READY must be the first line or GO is withheld (`READY-NOT-FOUND`); `READER-TIMEOUT` at exit + 5 s; `HARD-ABANDON` at watchdog + 10 s; batch bound 30 min via `evidence\batch.json`.
- **Candidate declared tightening:** host budget 15 s; per-command ceiling 3 s; per-channel caps 2048 B / 60 L; GO wait 8 s — all recorded by the candidate in its `OPTS` audit line. Candidate aggregate stdout + stderr is reported against 65536 B / 2000 L in `result.json`; **the aggregate is accounted, not enforced**, by this candidate or harness (the parent sees per-channel cap flags, not sums).
- **Diagnostic capacity:** `candidate-audit.log` and `harness.log` are reported in `result.json` `diagnosticBytes` and are never counted against the retention budget. `OUT-CHUNK` / `ERR-CHUNK` lines carry metadata only (byte count, retained, dropped, timestamp) — no candidate payload. The harness's end-of-run console display prints retained bytes only (never beyond budget); if that console output is captured to a file it duplicates retained bytes and nothing else.
- **The shared-budget, count-only and bounded-READY corrections are untested by B-1** (expected volume ≈ 365 B); they are required for the bound to mean what it states, not for this case's volume.

## 8. Containment and cleanup (frozen)

- Every candidate process tree runs inside one Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (`source\AisbJob.cs`, unchanged from MECH-EXP-01, SHA-256 `6d39c70f…`). **Assignment happens immediately after `Process.Start` and always before GO is sent; it is not guaranteed to precede the candidate's READY line.** GO is refused (`GO-REFUSED`) if assignment failed; the candidate performs no exec before GO.
- Job Object / watchdog / reader events are harness protection, recorded as `HARNESS …` lines, never as candidate events. Killing the fixture through the job is never a candidate PASS.
- Case end: stdin closed; `SURVIVOR-CHECK` (+1.5 s recheck if > 0); job disposed (kill-on-close); `.bin` files, `result.json` written; then `Assert-B1.ps1` reads the retained evidence and writes exactly one new file, `assertions.json`; `SHA256SUMS` regenerated over the task directory. Only test-owned processes and the task directory are touched. Evidence is never deleted. No whole-computer claim.

## 9. Case B-1 (the only case)

### 9.1 Plan and parameters

| Item | Value |
|---|---|
| Plan | `c1\|timeout -s TERM -k 1 3 timeout -s TERM -k 1 2\|--out 3 --err 3` then `c2\|timeout -s TERM -k 1 3 timeout -s TERM -k 1 2\|--out 2` |
| Producer `c1` | 3 stdout records `O00000n` + 40×`x`, 3 stderr records `E00000n` + 40×`x`, **exit 0** (`util.sh` default `rc=0`; no `--rc`) |
| ERR filter | consumes to EOF, sleeps 3 s, returns injected 3 (`AISB_FILTER_SLEEP_ERR=3`, `AISB_FILTER_FORCE_RC_ERR=3`) |
| Env | `AISB_FILTER_SLEEP_ERR=3 AISB_FILTER_FORCE_RC_ERR=3 AISB_HOST_BUDGET_SEC=15 AISB_PER_CMD_CEIL_SEC=3` |
| GO | VALID, delay 0 |
| Harness | `-WatchdogSec 60 -RetainBytes 262144 -ReadyPrefixBytes 256` |
| Expected | gate records `STOPPED CAP`; `c2` never executes |

Invocation (for the separately authorized Step 3 only; not run in this window):

```powershell
Set-Location -Path "C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-02\stage-a"
.\source\Run-Case.ps1 -CaseId B-1 -GoMode VALID -GoDelaySec 0 -WatchdogSec 60 -RetainBytes 262144 -ReadyPrefixBytes 256 -Plan "c1|timeout -s TERM -k 1 3 timeout -s TERM -k 1 2|--out 3 --err 3`nc2|timeout -s TERM -k 1 3 timeout -s TERM -k 1 2|--out 2" -Env @{ AISB_FILTER_SLEEP_ERR='3'; AISB_FILTER_FORCE_RC_ERR='3'; AISB_HOST_BUDGET_SEC='15'; AISB_PER_CMD_CEIL_SEC='3' }
.\source\Assert-B1.ps1 -CaseDir "C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-02\stage-a\evidence\B-1"
```

### 9.2 Exact expected output bytes

LF line endings (as retained in MECH-EXP-01 A-1); `<N>` = the 16-hex nonce from `result.json`; one record per line; each `x` run is exactly 40 characters.

```
candidate-stdout.bin — 218 bytes
READY <N>\n                                        23
O000001 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
O000002 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
O000003 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
RC 1 0 0 3\n                                       11
STOPPED CAP\n                                      12
END <N> CAP\n                                      25

candidate-stderr.bin — 147 bytes
E000001 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
E000002 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
E000003 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n   49
```

### 9.3 Classifier (frozen in `candidate.sh`)

Exactly two pipeline statuses are required (`${#ps[@]} -eq 2`); `ps[0]`, `ps[1]` and `se` are each validated independently as present, numeric exit statuses (`^[0-9]{1,3}$` and ≤ 255); the producer must return 0; `124` / `137` → `TIMEOUT-*`; any other non-zero `ps[0]` → `OTHER-ERROR-*`; `ps[1]=3` or `se=3` → `CAP`; any other non-zero filter status → `FILTER-STATUS-*`; empty or stale `$!` → `FILTER-STATUS-UNAVAILABLE`; missing / malformed → `MALFORMED-*`. There is no `--expect-rc` or any other expected-error bypass. Dispatch proceeds (`DISPATCH-OK`) only on full positive confirmation.

### 9.4 Assertions (evaluated by `Assert-B1.ps1` over retained evidence)

`L(EVENT)` = audit line; `w(L)` = writer pid; `pos(L)` = file position. Failure types: **DEFECT** (positive evidence of a candidate defect), **MISSING** (absent / incomplete markers), **SETUP** (wrong configuration or precondition), **INTEGRITY** (incomplete capture), **INTERVENTION** (harness acted).

| # | Assertion | Failure type |
|---|---|---|
| S1 | `OPTS` present; `$-` contains no `e`; `SHELLOPTS` lacks `errexit`, `posix`, `monitor`; `BASHOPTS` lacks `lastpipe`; `lastpipe`/`posix`/`errexit`/`monitor` recorded `off`; `pipefail` state recorded (either value); `SCRIPT-START` present | OPTS absent → MISSING; wrong configuration → SETUP |
| P1 | exactly one `FILTER-START tag=ERR`; its `pid=` equals `fpid=[…]` in `PIPE-RETURN idx=1` and `pid=` in the single `FILTER-EXIT tag=ERR … rc=3`; its writer pid equals that pid | lines absent → MISSING; present and unequal → DEFECT |
| P2 | `fpid` ≠ `pid` of `FILTER-START tag=OUT`, ≠ `w(SCRIPT-START)`, ≠ `pid` of `UTIL-EXEC tag=c1`; `prev_bang=[]` in `PRE-EXEC idx=1` | lines absent → MISSING; otherwise DEFECT |
| P3 | `PIPE-RETURN idx=1`: `n=2 ps0=[0] ps1=[0]` | absent → MISSING; `ps0`≠0 → SETUP (intended branch not exercised); `n`≠2 or `ps1`≠0 → DEFECT |
| W1 | `WAIT-RETURN idx=1 se=[3]`; stdout contains `\nRC 1 0 0 3\n`; all parent events (`PRE-EXEC`, `PIPE-RETURN`, `WAIT-RETURN`, `STOP-EVENT`, `STOPPED` for idx=1, `NOT-STARTED idx=2`, `SCRIPT-END`) share `w(SCRIPT-START)`; `pos(PIPE-RETURN) < pos(WAIT-RETURN) < pos(STOP-EVENT) < pos(STOPPED) < pos(NOT-STARTED idx=2) < pos(SCRIPT-END)`. No timing requirement. Diagnostics recorded, not asserted | lines absent or `RC 1` line absent → MISSING; writer pids not uniform → INTEGRITY; `se`≠3 / wrong RC values / wrong order → DEFECT |
| G1 | `STOP-EVENT CAP idx=1` and `STOPPED CAP idx=1` present; no `DISPATCH-OK` | `DISPATCH-OK` present or a different stop reason → DEFECT; stop lines absent → MISSING |
| D1 | absent: `PRE-EXEC idx=2`, `UTIL-EXEC tag=c2`, any second `UTIL-EXEC`, more than 2 `FILTER-START`; present: `NOT-STARTED idx=2 name=c2 reason=CAP`, `SCRIPT-END CAP` | any forbidden presence → DEFECT; required lines absent → MISSING |
| O1 | `candidate-stdout.bin` byte-equal to the 218-byte expectation (§9.2) | with C1 passing → DEFECT; with C1 failing → INTEGRITY; file absent → MISSING |
| E1 | `candidate-stderr.bin` byte-equal to the 147-byte expectation (§9.2) | same as O1 |
| X1 | `exitCode=0`, `jobAssigned=true`, `watchdogFired=false`, `survivorsBeforeClose=0`; `harness.log` contains none of `WATCHDOG-FIRE`, `JOB-TERMINATE`, `READER-TIMEOUT`, `HARD-ABANDON`, `GO-REFUSED`, `GO-WRITE-FAILED`, `READY-NOT-FOUND`, `BATCH-EXCEEDED` | INTERVENTION |
| C1 | `retainedStdoutBytes = candidateStdoutBytesTotal`; `retainedStderrBytes = candidateStderrBytesTotal`; `dropped* = 0`; `retainedTotalBytes ≤ 262144`; `.bin` lengths equal the retained counts; aggregate ≤ 65536 recorded (informational, not an enforcement claim) | INTEGRITY |

### 9.5 Assertion script

`source\Assert-B1.ps1` reads `candidate-audit.log`, `harness.log`, `candidate-stdout.bin`, `candidate-stderr.bin`, `result.json`; records their SHA-256; evaluates §9.4; applies §9.6; **writes exactly one new file, `assertions.json`, and refuses to overwrite an existing one.** It modifies nothing else.

### 9.6 Verdict precedence (global; applied in this order)

1. **S1** failed with wrong shell configuration → **CASE-INVALID**. S1 failed because `OPTS` is absent → **INCONCLUSIVE-EVIDENCE**.
2. Any **SETUP** failure (P3 `ps0`≠0) → **CASE-INVALID**.
3. **DEFECT** failures: with X1 passing → **FAIL**. With X1 failing (intervention): **FAIL only if every DEFECT is established from audit lines whose `EPOCHREALTIME` precedes the first intervention's harness Unix time by more than 0.020 s**; DEFECTs resting on untimed files (O1 / E1) are never eligible; otherwise → **INCONCLUSIVE-EVIDENCE**.
4. Any INTERVENTION, MISSING or INTEGRITY failure with no eligible DEFECT → **INCONCLUSIVE-EVIDENCE**.
5. All assertions pass → **PASS** (bounded: this fixture, this capture / status / gate behaviour only).

Consequences: incorrect setup is never a counterexample; incomplete evidence or harness intervention defaults to INCONCLUSIVE-EVIDENCE; a FAIL requires adequate evidence establishing a candidate defect under the required setup; missing markers caused by interruption never establish a defect; the pre-intervention exception must satisfy the evidence and ordering requirement above and is not bypassed by any "any FAIL" rule; intervention never produces PASS. After any non-PASS verdict: record, hash, stop (condition 7).

### 9.7 What a PASS would and would not establish

A PASS establishes only that, on this MSYS bash with this producer and these filters, the H-2 shape gives the parent the stderr filter's pid and status, keeps the channels byte-separate, and the gate stops on the injected status. It establishes nothing about the 65536 B / 2000 L aggregate, the 15 s / 120 s deadlines, 124 / 137 propagation, `sudo`, FG-6 survivors, Linux transfer, process-substitution backing on H, remote termination, or host readiness, which remains BLOCKED. Pid reuse between consecutive commands is a residual not covered by P1 / P2.

## 10. Harness correction (local copy; original preserved)

`source\Run-Case.ps1` is a corrected copy of MECH-EXP-01 `Run-Case.ps1` (derived LF, SHA-256 `1f11a09b558b8fac295cdb66d98e926583aa60ece46f1fff75d5b6d9f120bb7f`), which is preserved unchanged in the MECH-EXP-01 tree. Observed in the predecessor: `$outMs` and `$errMs` were each capped at `$RetainBytes` independently (up to 2 × `RetainBytes` retained) and the sum was checked only after the fact; `$outText` accumulated all stdout unbounded and was re-scanned every 5 ms; `OUT-CHUNK` lines copied the first line of each chunk's payload into `harness.log`. Corrections (diff: `evidence\prep\diff-Run-Case.ps1.vs-EXP-01-1f11a09b.diff`): (1) one shared `$retainRemaining` budget drawn by whichever channel's chunk arrives first; (2) count-only beyond the budget (`dropped*` counters), RETENTION watchdog unchanged in trigger; (3) bounded READY parsing over a 256 B prefix, anchored `\AREADY (\S+)\n`, `READY-NOT-FOUND` withholds GO; (4) `OUT-CHUNK` metadata only; (5) `result.json` fields `retainedTotalBytes`, `droppedStdoutBytes`, `droppedStderrBytes`, `sharedRetentionBudgetBytes`, `readyPrefixBytes`, `readyFailed`, `diagnosticBytes`; `-Root` default and header comment updated. Containment, GO gating, nonce, env plumbing, `READER-TIMEOUT`, `HARD-ABANDON`, batch bound and the display section are otherwise unchanged.

## 11. Frozen artifacts (SHA-256, pre-execution) and static review

Directory `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-02\stage-a\`; all files LF, UTF-8 without BOM.

| File | SHA-256 | Bytes | Predecessor |
|---|---|---|---|
| `source\candidate.sh` (H-2 fixture; frozen) | `60f7785099652f9b35e138732a9806a012fc0fe0ccf1d7c55e6dacf33e212f72` | 6539 | MECH-EXP-01 `candidate.sh` LF `d751bb63…` (diff `evidence\prep\diff-candidate.sh.vs-EXP-01-d751bb63.diff`) |
| `source\Run-Case.ps1` (corrected harness copy) | `27227b80319cf9e7e6b34a5f40738a9fd5dc88a2888d7c851982d0e6db1ec532` | 12417 | MECH-EXP-01 `Run-Case.ps1` LF `1f11a09b…` |
| `source\Assert-B1.ps1` (new) | `d2d990fa7292f38ffadb5398eba1da39720a25e93fa8866283b6d44a6ac8a2d7` | 19507 | none |
| `source\AisbJob.cs` (unchanged copy) | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | 4106 | identical |
| `fixtures\util.sh` (unchanged copy) | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | 1885 | identical |
| `SHA256SUMS` (the five entries above) | `1cecfeb5271eb1eb7318390786c9f4512f803436d4328e7c9b59ca7b788a5802` | 426 | — |

Static review (non-executing; outputs in `evidence\prep\`): `bash -n candidate.sh` rc=0; `bash -n util.sh` rc=0; PowerShell `Parser::ParseFile` 0 errors for `Run-Case.ps1` and `Assert-B1.ps1`. `AisbJob.cs` was not recompiled (bytes identical to the MECH-EXP-01 artifact that compiled there). Manual review against §§6–9 found and corrected three defects in `Assert-B1.ps1` **before** this freeze: the audit parser did not accept the frozen `util.sh` line form (no writer-pid field), which would have made P2 / D1 permanently MISSING; byte comparison relied on `[Linq.Enumerable]::SequenceEqual` generic inference (replaced by an explicit loop); the parent-event null check used pipeline filtering (replaced by an explicit loop). No candidate, harness, fixture or assertion script was executed.

## 12. Write set and non-effects

- Written this window: this file; `TASKS.md` records (lines 1 / 21 / 46 / 51 status prefixes and a `PM2_RECOVERY_MECH_EXP_02_*` field block); `TASKS_BACKLOG_FULL.md` canonical body with `AISB_MACHINE_REG_V1 nature=GOVERNANCE`; the off-repo directory above including `evidence\prep\` (static-review outputs, diffs) and `evidence\review-export\` (package, `EXPORT-SHA256SUMS`, `BUNDLE.sha256`, validator proof and output).
- Not written: anything under `services/`, `frontend/`, compose, env, package, sidecar, mutex catalog, occupancy block, repository `SATURATION_PROOF.json`; any file under `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\`; any locked predecessor; PRIV-INSPECTION-01 §17.
- **Step 3 (B-1 execution) and Step 4 (review / lock): NOT AUTHORIZED.** Recovery gates unchanged: AGENT-PLATFORM-EXEC-01C6A `startCondition=NOT_READY`; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED. Lane 3 DISABLED; occupancy EMPTY. No Git stage / commit / push / branch / worktree.

## 13. Activity ledger (Steps 1–2)

Experiment / probe / fixture / candidate / harness / assertion-script executions = 0; static syntax checks = 3 files (`bash -n` ×2, PowerShell parser ×2 — non-executing); Docker / WSL / sudo / SSH / network / package installation / application runtime / host access / subagents = 0; MECH-EXP-01 tree writes = 0; predecessor body edits = 0; sidecar / catalog / occupancy edits = 0; repository `SATURATION_PROOF.json` not mutated; Git stage / commit / push / reset / restore / clean = 0. GOVERNANCE acquired transiently for the record writes then released UNOWNED. Lane-capacity validator run on the end state with `-ProofPath` under `stage-a\evidence\review-export\validation\`.

## 14. Step 2 correction C1 (2026-10-02) — appended; §§0–13 are not edited

**Authorization (Keith, 2026-10-02):** one bounded Step 2 correction. Preparation only. Step 3 execution and Step 4 closure remain NOT AUTHORIZED. No candidate, harness, fixture or assertion-script execution. No probe, retry, host access, new registration, acceptance, lock, or Git mutation. H-2 is unchanged. B-1 remains the only case. GOVERNANCE acquired transiently for this section and this task's board / backlog records, then released UNOWNED.

**Relationship to the original freeze.** The bytes of this file before this section are the Steps 1–2 freeze: SHA-256 `e7aa5bc1530a9fe44a0f71e57c398752e5b75929a962287d9a90560cd7a50dc6`, 27112 B, LF. §11 remains the freeze manifest. That manifest's `SHA256SUMS` (`1cecfeb5271eb1eb7318390786c9f4512f803436d4328e7c9b59ca7b788a5802`) is preserved in the original review package and is not the working manifest after C1.

| File | Freeze SHA-256 (§11) | Effective SHA-256 after C1 | Bytes after C1 |
|---|---|---|---|
| `source\candidate.sh` | `60f7785099652f9b35e138732a9806a012fc0fe0ccf1d7c55e6dacf33e212f72` | unchanged | 6539 |
| `source\AisbJob.cs` | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | unchanged | 4106 |
| `fixtures\util.sh` | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | unchanged | 1885 |
| `source\Assert-B1.ps1` | `d2d990fa7292f38ffadb5398eba1da39720a25e93fa8866283b6d44a6ac8a2d7` | `cc5565e7baf5ccd774789e712dbf0a23c52ac02b9741c0db459e94105a53a879` | 29145 |
| `source\Run-Case.ps1` | `27227b80319cf9e7e6b34a5f40738a9fd5dc88a2888d7c851982d0e6db1ec532` | `25f9938cd8d215c5453b57e4ed1b04031ccb870b6d3bb192a867c40ebcdc9315` | 13114 |
| working `SHA256SUMS` | `1cecfeb5271eb1eb7318390786c9f4512f803436d4328e7c9b59ca7b788a5802` | `b64ae30c986b3e0f025a63afae2f4c3718247b2e0f17a05478f90a62d5d7186e` | 426 |

### 14.1 Assert-B1.ps1

- **U1.** Any unparsed audit line fails as INTEGRITY. That blocks PASS. It is not a DEFECT, and it is not converted into one.
- **R1.** `result.json` is parsed inside a handler. Absence, empty input, invalid JSON, a non-object, a missing or null required field, or a nonce that is not 16 hex is MISSING. The script does not throw on those inputs and does not treat them as a candidate defect.
- **Dependencies.** A recorded DEFECT carries `depOk` and `evidenceClass`. Before precedence, a DEFECT with `depOk` false is reclassified INTEGRITY (`downgradedFrom=DEFECT`) and cannot determine FAIL. Audit DEFECTs require the cited lines to be parsed and timestamped. Stdout, stderr and process findings are DEFECT only when `result.json` is valid and, for W1S / O1 / E1, only when C1 passes.
- **W1 / W1S.** W1 is audit-only (`se=3`, same-writer program order). W1S is the stdout comparison for the line `RC 1 0 0 3`. W1S has `evidenceClass=stdout` and `evidenceTmax` forced null. It cannot satisfy the pre-intervention exception, including by timestamps taken from other records. Wall-clock notes on W1 stay diagnostic.
- **Distinctions kept.** SETUP is an observed wrong shell option or an observed producer status other than 0 (CASE-INVALID). MISSING is absent or malformed evidence. INTEGRITY is incomplete or unreliable capture, including unparsed lines. INTERVENTION is harness or containment action. DEFECT is an observed wrong candidate value whose dependencies hold.
- **XC.** A non-zero process exit with no harness intervention is XC, not an X1 intervention finding. If intervention was recorded, the exit code is not classified as a candidate defect.
- **Setup gate.** FAIL is reached only when S1 passed and `ps0=0` was observed. Otherwise the verdict is CASE-INVALID (observed wrong setup) or INCONCLUSIVE-EVIDENCE.
- **Pre-intervention exception.** With intervention, FAIL requires every remaining DEFECT to have `evidenceClass=audit` and `evidenceTmax` more than 0.020 s before the first intervention. There is no rule that turns any failure into FAIL without that check.
- The script still writes only a new `assertions.json` and refuses to overwrite one. If the case directory is absent it writes nothing.

### 14.2 Run-Case.ps1

- If `evidence\<CaseId>` already exists, the harness prints `CASE-DIR-EXISTS` and exits 8 before creating files, deleting files, launching a process, or reading or writing `batch.json`. The only frozen case is B-1. Startup `Remove-Item` of case evidence is removed.
- After each `Pump`, if the shared remaining budget is 0 and the watchdog has not fired, the harness records `WATCHDOG-FIRE reason=RETENTION` and terminates the job before GO can be sent and before the normal-exit break. Count-only accounting past the budget and metadata-only `OUT-CHUNK` / `ERR-CHUNK` lines are unchanged.
- B-1's expected volume is about 365 B against a 262144 B budget. C1 does not claim the refusal branch, the zero-remaining branch, or count-only handling past the budget were tested.

### 14.3 Review exports

The Step 2 package diffs were produced through a PowerShell text pipeline and contain corrupted non-ASCII bytes. Those files and the original ZIP are left in place. C1 regenerates predecessor-source diffs and repository diffs with `git diff --output` (`core.autocrlf=false`, `core.safecrlf=false` on that command only; no Git config change and no encoding normalization of repository or source files). Each regenerated diff is checked by copying the old side, applying the diff with `git apply`, and comparing the result byte-for-byte with the new side. Correction-only diffs are the freeze snapshots of `Assert-B1.ps1` and `Run-Case.ps1` against the C1 files.

- Original package, preserved: `evidence\review-export\PM2-RECOVERY-MECH-EXP-02-steps-1-2-review-export-2026-10-02.zip`, SHA-256 `3d49e882d3196954a97fb245898fe8b85c7de99491663926d66d424234f71233`, 167723 B. Its `EXPORT-SHA256SUMS` remains `c68139d25e72a53a00b39d18dce254ea7ffd7964751b6fa7980f0a74759a1337`.
- C1 package, distinct directory: `evidence\c1-correction-export\`. Bundle hash is recorded beside that bundle, not in repository records.

### 14.4 What C1 does not do

No change to H-2, to B-1's plan or expected output bytes, or to `candidate.sh`, `AisbJob.cs`, or `util.sh`. No new case. No execution. Step 3 and Step 4 remain NOT AUTHORIZED. Host use remains BLOCKED. The aggregate cap, deadlines, FG-6, remote termination, process-substitution backing on H, and host readiness remain unestablished. PRIV-INSPECTION-01 §17 is not adopted. The MECH-EXP-01 tree is not modified. Repository `SATURATION_PROOF.json` is not modified.

### 14.5 Static review

`Parser::ParseFile` reported 0 errors for the C1 `Assert-B1.ps1` and `Run-Case.ps1`. Neither script was executed. Output: `evidence\c1-static\`.

### 14.6 Activity

Executions of the candidate, harness, fixture and assertion script = 0. Probes = 0. Host access = 0. Git stage / commit / push / reset / restore / clean = 0. MECH-EXP-01 writes = 0. Original review ZIP writes = 0. Repository `SATURATION_PROOF.json` not mutated. Lane-capacity validator, if run, writes its proof under `evidence\c1-correction-export\validation\` via `-ProofPath`.

## 15. Step 2 correction C2 (2026-10-02) — appended; §§0–14 are not edited

**Authorization (Keith, 2026-10-02):** targeted Step 2 correction of `Assert-B1.ps1` only. `candidate.sh`, `Run-Case.ps1`, `AisbJob.cs` and `util.sh` are byte-unchanged. H-2 and B-1 are unchanged. No case added. No execution, probe, host access, new registration, lock, or Git mutation. Step 3 and Step 4 remain NOT AUTHORIZED. GOVERNANCE acquired transiently for this section and this task's board / backlog records, then released UNOWNED.

**Relationship to earlier records.** The freeze (§§0–13, first 27112 B, `e7aa5bc1530a9fe44a0f71e57c398752e5b75929a962287d9a90560cd7a50dc6`) and C1 (§14; file `8605c0789bb125f8c3b88a27b8c1e192647048324dda1303fd04811aee5d99b1` before this section) are not rewritten. C2 supersedes only the `Assert-B1.ps1` hash and the §14.1 **XC** bullet. The other C1 assertion changes stay: U1, R1, evidence dependencies, audit-only W1, untimed W1S, and refusal to overwrite `assertions.json`.

| File | Freeze (§11) | After C1 (§14) | Effective after C2 |
|---|---|---|---|
| `source\Assert-B1.ps1` | `d2d990fa7292f38ffadb5398eba1da39720a25e93fa8866283b6d44a6ac8a2d7` | `cc5565e7baf5ccd774789e712dbf0a23c52ac02b9741c0db459e94105a53a879` | `276c8af8e5dabdd5a519474ba6b773b3981b58997086b263cb359c825d9854b4` (31926 B) |
| `source\Run-Case.ps1` | `27227b80…1ec532` | `25f9938cd8d215c5453b57e4ed1b04031ccb870b6d3bb192a867c40ebcdc9315` | unchanged from C1 |
| `source\candidate.sh` | `60f7785099652f9b35e138732a9806a012fc0fe0ccf1d7c55e6dacf33e212f72` | unchanged | unchanged |
| `source\AisbJob.cs` | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | unchanged | unchanged |
| `fixtures\util.sh` | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | unchanged | unchanged |
| working `SHA256SUMS` | `1cecfeb5…7a5802` | `b64ae30c986b3e0f025a63afae2f4c3718247b2e0f17a05478f90a62d5d7186e` | `c6c09e87234af54c888d2c8274f5bd2274b6a19e85db12b4d41b9c3f8a972c7c` |

### 15.1 Harness evidence for X1

X1 passes only when `harness.log` is present, readable and non-empty. Every line must parse as `<unix> sw=<s> HARNESS <EVENT> [detail]`. `CASE-BEGIN`, `PROC-START`, `JOB-ASSIGN`, `SURVIVOR-CHECK`, `JOB-CLOSED` and `CASE-END` must each appear exactly once. Otherwise X1 is MISSING. An existing empty file therefore cannot establish "no intervention" or allow PASS. Intervention events and the first intervention time come from parsed harness lines.

### 15.2 Survivor query failure and result.json types

`AisbJob.ActiveProcesses()` returns uint32 `0xFFFFFFFF` (4294967295) when the job cannot be queried. `Assert-B1.ps1` compares it as Int64 and never casts it to Int32. That value is unknown survivor status. X1 is MISSING, not zero survivors and not a defect. A valid observed non-zero count fails X1 as INTERVENTION, as in the frozen §9 X1 row. X1 also requires the `SURVIVOR-CHECK activeProcessesInJob=` value to equal `result.json`.

R1 validates types and ranges before any comparison, arithmetic or conversion:

- `nonce` is a string of 16 hex.
- `exitCode` is null or an Int32-range integer.
- `jobAssigned` and `watchdogFired` are booleans.
- `survivorsBeforeClose` is an integer from 0 to 4294967295.
- The seven byte counters are integers from 0 to 2^53−1.

A violation is R1 MISSING, and dependent rows become evidence gaps. C1 rejected a null `exitCode`. C2 accepts null, because `Run-Case.ps1` writes null when the process has not exited. X1 then records that exit as not observed (MISSING). P3 also limits the audit `n` field to at most three digits before conversion, which removes an Int32 overflow path of the same class.

### 15.3 Process exit

The C1 XC row and its DEFECT path are removed. As in the frozen §9 X1 row, a non-zero observed `exitCode` fails X1 as INTERVENTION. That gives INCONCLUSIVE-EVIDENCE unless an independently established DEFECT meets the existing rule 3b audit-timestamp and intervention requirements. A non-zero exit alone never establishes a candidate defect.

### 15.4 Static review and observations

`Parser::ParseFile` reported 0 errors for `Assert-B1.ps1`. Nothing was executed. Unchanged harness, static observation only: in `Run-Case.ps1`, `$survivors -ne 0xFFFFFFFF` compares against the Windows PowerShell 5.x literal value Int32 −1. A failed survivor query would therefore probably still trigger the 1.5 s `SURVIVOR-RECHECK`. That affects only an extra diagnostic line. `survivorsBeforeClose` still records 4294967295, which `Assert-B1.ps1` treats as unknown. `Run-Case.ps1` is left byte-unchanged as instructed, and this was not tested.

### 15.5 Packages and activity

The original Steps 1–2 package (`3d49e882d3196954a97fb245898fe8b85c7de99491663926d66d424234f71233`) and the C1 package (`9ee995cc1168d4589016f0a7871ec88237f251a33400c6eaecc5b32565080e55`) are preserved. The C2 package is `evidence\c2-correction-export\`. Its bundle hash is recorded beside the bundle, not in repository records. Executions of the candidate, harness, fixture and assertion script = 0. Probes = 0. Host access = 0. Git stage / commit / push / reset / restore / clean = 0. MECH-EXP-01 writes = 0. Repository `SATURATION_PROOF.json` not mutated. The lane-capacity validator proof is written under `evidence\c2-correction-export\validation\` via `-ProofPath`.

## 16. Step 3 execution record (2026-10-02) — appended; §§0–15 are not edited

**Authorization (Keith, 2026-10-02):** Step 3 only. Exactly one Windows-local B-1 run under the frozen plan as corrected by C1 and C2. Step 4 review and closure NOT AUTHORIZED. GOVERNANCE acquired transiently for this section and this task's board / backlog records, then released UNOWNED.

### 16.1 Pre-execution checks (all passed; nothing repaired)

HEAD `d6425171480342e7ed045820cc6472061ef4a400`. Repository `SATURATION_PROOF.json` blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`. Reviewed C2 ZIP `f79f779f31c55361181257d4ac984476e501464441ebc9ccc4f02b1b957c26af`. Stage-start `a332ac1af41b5258950c117bea36033b90d24c2bf9d8b8977cec1a2e04b962ec`. Working `SHA256SUMS` `c6c09e87234af54c888d2c8274f5bd2274b6a19e85db12b4d41b9c3f8a972c7c`, and all five source hashes matched it. `evidence\B-1` and `evidence\batch.json` did not exist. Windows PowerShell 5.1.22621.6133. CurrentUser policy RemoteSigned. No execution-policy override was used.

### 16.2 Execution

- **Harness.** The two §9.1 lines (`Set-Location …`; `.\source\Run-Case.ps1 -CaseId B-1 …`) ran once, verbatim, in a child `powershell.exe -NoProfile -NonInteractive -EncodedCommand`. One wrapper line was appended to echo `$?` and `$LASTEXITCODE`. Child exit 0, 4.97 s wall, wrapper `run-case-statement-succeeded=True`. Stderr (608 B) contains only two CLIXML progress records ("preparing modules for first use"). There is no error record.
- **Assertion script.** `.\source\Assert-B1.ps1 -CaseDir …\evidence\B-1` ran once, in a second child process with the same wrapper. Exit 0. Stderr holds the same two progress records only. It wrote `assertions.json`.
- Invocation text, stdout, stderr and status for both are in `evidence\step3-execution\`.
- No source was modified. No probe, retry, second case or host contact.

### 16.3 Candidate outcome — B-1 PASS (bounded)

`assertions.json` verdict **PASS** (rule 5). All 14 rows passed: U1, R1, S1, P1, P2, P3, W1, G1, D1, C1, W1S, O1, E1, X1.

- **Parent and filter pids.** The parent shell (writer 2008) recorded `PIPE-RETURN idx=1 n=2 ps0=[0] ps1=[0] fpid=[2016]`. The ERR filter recorded `FILTER-START tag=ERR pid=2016` and `FILTER-EXIT … rc=3`.
- **Wait and gate.** The parent's `WAIT-RETURN idx=1 se=[3]` followed. Then, in file order, came `STOP-EVENT CAP idx=1`, `STOPPED CAP idx=1`, `NOT-STARTED idx=2 name=c2 reason=CAP` and `SCRIPT-END CAP`.
- **Command 2.** There was no `DISPATCH-OK`, no `PRE-EXEC idx=2` and no `UTIL-EXEC c2`.
- **Shell options.** `set=[hB]`; pipefail, lastpipe, posix, errexit and monitor were all off.
- **Captured bytes.** `candidate-stdout.bin` is 218 B and `candidate-stderr.bin` is 147 B. Both are byte-equal to §9.2 with nonce `d102184202d44c71`.
- **Diagnostic only.** WAIT-RETURN was 3.029 s after the ERR filter's EOF line. FILTER-EXIT(ERR) preceded WAIT-RETURN by 0.006 s. This is not a measure of time blocked in `wait`.

### 16.4 Containment and harness (reported separately from the candidate)

- **Job and GO.** `JOB-ASSIGN ok=True` was at sw 0.3447, 5 ms after `PROC-START`, and before `GO-SENT` at sw 0.4924. It also happened to precede `READY-OBSERVED` at sw 0.4756. This run does not rely on that order.
- **Interventions.** None. There was no WATCHDOG-FIRE, JOB-TERMINATE, READER-TIMEOUT, HARD-ABANDON, GO-REFUSED, GO-WRITE-FAILED, READY-NOT-FOUND or BATCH-EXCEEDED. `watchdogFired=false`.
- **Exit and cleanup.** `PROC-EXIT code=0`. `SURVIVOR-CHECK activeProcessesInJob=0`, with no recheck needed. Then `JOB-CLOSED`.
- **Capture budget.** Retained 365 / 262144 B shared budget, 0 dropped. The aggregate is 365 B against the 65536 B ceiling, which is accounted, not enforced. The batch elapsed 3.8 s of 1800 s.
- **Process cleanup.** After the run, Windows pid 28688 (candidate bash), 20508 (harness child shell) and 16756 (assertion child shell) were no longer running. Only those test-owned pids were checked. No whole-computer claim.
- **Untested branches.** The C1 refusal branch, the zero-remaining branch and count-only handling past the budget were not exercised, and are still not claimed tested.

### 16.5 Execution compliance

- One harness run and one assertion run. No modification, probe, retry or added case.
- **Declared deviations:**
  1. A wrapper status line was appended to each child-process command.
  2. The assertion script ran in a separate child process, not in the same session as the harness.
  3. §8's "`SHA256SUMS` regenerated over the task directory" was carried out, per this authorization, as a separate `evidence\step3-execution\EXECUTION-SHA256SUMS`. The frozen source manifest was preserved.
- **Accepted design behavior.** `result.json` `diagnosticBytes.harnessLog=2016` is measured before `CASE-END` is appended; the final `harness.log` is 2126 B.

### 16.6 Evidence and preservation

| File | SHA-256 | Bytes |
|---|---|---|
| `evidence\B-1\candidate-stdout.bin` | `cf545e8bc611258ca6cbe8ea13efe33be754dafe29e715bc268c96358041f6b4` | 218 |
| `evidence\B-1\candidate-stderr.bin` | `42df506b2445ba73c657700a6f8f6b5c5764dfddfd20e270328664d4eea23b28` | 147 |
| `evidence\B-1\candidate-audit.log` | `234666bf954d9a4bd0f776b542d0faae39357644a54bed97b92d96f750216f87` | 1716 |
| `evidence\B-1\harness.log` | `eea2c8113469cd0ee1a5f0a4eba7ecda00e2112f64627fe08c4e661d5f32f59a` | 2126 |
| `evidence\B-1\result.json` | `2f261dcc4d03c819cd6b439f303e6c1db1aca6252e834903d1db1b78d0e7b8d3` | 1196 |
| `evidence\B-1\assertions.json` | `ba7aa5ab6ee0c72868021542c4ba9e41d2f4093d997d8a2fe15dd00169baeb5d` | 9615 |
| `evidence\batch.json` | `ccb8533043b092604b8f9a8f5d67a516c98398761aeed01c6265dc6dbae67fca` | 217 |
| `evidence\step3-execution\EXECUTION-SHA256SUMS` | `e47d5f1dffa121446794f5e267eb91c8ce93eb9ec688f014478255b3d0467a7c` | 16 entries |

- **Sources.** Post-run hashes of all five sources equal the working `SHA256SUMS` (`c6c09e87…`), which is unchanged.
- **Packages.** The original, C1 and C2 ZIPs are unchanged (`3d49e882…`, `9ee995cc…`, `f79f779f…`).
- **MECH-EXP-01.** Its tree was not written; its newest file is still 2026-10-02T11:37:22, and `SHA256SUMS` is still `08c722bf…`.
- **Step 3 package.** `evidence\step3-export\`. The bundle hash is recorded beside the bundle.

### 16.7 What this does not establish

A PASS establishes only the bounded B-1 capture / status / gate behavior on this MSYS bash 5.2.15 with this fixture. It establishes nothing about:

- the 65536 B / 2000 L aggregate;
- the 15 s / 120 s deadlines, or 124 / 137 propagation;
- `sudo`, FG-6 survivors, or Linux transfer;
- process-substitution backing on H;
- remote termination;
- host readiness.

Host use remains BLOCKED. No readiness is produced. No Stage B authority. Not a host-inspection successor. PRIV-INSPECTION-01 §17 is not adopted. EXEC-01C6A NOT_READY, HOST_CLEAN=NO, P7_ACCEPTED=NO, REOPEN_GATE=UNSATISFIED are unchanged. Step 4 review and lock remain NOT AUTHORIZED. Not accepted. Not locked.

## 17. Step 4 independent review and closure (2026-10-02) — appended; §§0–16 are not edited

**Authorization (Keith, 2026-10-02):** Step 4 only. Independent evidence review of the Step 3 package and, only if its criteria pass, closure and lock of this bounded experiment record. No test, probe, rerun, source edit, host access, host readiness, Stage B, inspection, recovery, acceptance or successor registration. GOVERNANCE acquired transiently for this section and this task's board / backlog records, then released UNOWNED. STAGING not acquired.

### 17.1 Inputs (verified before any write)

- **Repository.** HEAD `d6425171480342e7ed045820cc6472061ef4a400`. Inherited `SATURATION_PROOF.json` blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`, unchanged. Stage-start `fbfb22d2375b99b00cf3dd8da97c6db722f1cd61c34d803f26f13e0854bb5346` (46597 B). `TASKS.md` `df867edba6289669fa7d3a8679d1ae75e3081b886707175667b7f5bbd14c6b68`. `TASKS_BACKLOG_FULL.md` `b0c911cac78289d7405f9cb5e6a543e3fd35f5759d3f4d1f3b01e1482824e2c8`.
- **Step 3 package.** `evidence\step3-export\PM2-RECOVERY-MECH-EXP-02-step3-execution-review-export-2026-10-02.zip`, SHA-256 `02e1a013da8f5da33c5055eb8f49d939e4c40dc718ed63ebf3482753a09eea30`, equal to its `BUNDLE.sha256`. Its `EXPORT-SHA256SUMS` verifies 31 / 31, with no unlisted file.
- **Effective frozen sources.** The packaged `frozen-sources\SHA256SUMS` and the live working `SHA256SUMS` are both `c6c09e87234af54c888d2c8274f5bd2274b6a19e85db12b4d41b9c3f8a972c7c`. All five live and packaged sources equal the C2 effective hashes in the §15 table.
- **Evidence.** Live evidence files equal the packaged copies. `EXECUTION-SHA256SUMS` `e47d5f1dffa121446794f5e267eb91c8ce93eb9ec688f014478255b3d0467a7c` verifies 16 / 16.
- **Preserved.** Original package `3d49e882…`, C1 package `9ee995cc…` and C2 package `f79f779f…` are unchanged. The MECH-EXP-01 tree's newest file is still 2026-10-02T11:37:22, and its `SHA256SUMS` is still `08c722bf…`.

### 17.2 Method

Read-only. `candidate.sh`, `Run-Case.ps1`, `util.sh` and `Assert-B1.ps1` were not executed. `candidate.sh` and `util.sh` were read as text to confirm marker semantics. The Step 3 package was extracted to a copy under `evidence\step4-closure\pkg\`; the ZIP itself was only read.

Two review scripts were written for this step: `evidence\step4-closure\Review-Hashes.ps1` and `Verify-Evidence.ps1`. They read the evidence and recompute every assertion from the raw files, using their own parser, expected-byte construction and unified-diff applier. Their outputs are `review-hashes-output.txt` and `verify-evidence-output.txt`; the final run reports 0 failed checks. Early runs reported false failures caused by defects in these review scripts themselves: a PowerShell alias clash, case-insensitive variable collisions, single-element array handling and a CRLF length miscount. The scripts were corrected and rerun. Only the final outputs are relied on. No evidence file was written.

### 17.3 Review criteria and findings — all met

| # | Criterion | Finding |
|---|---|---|
| R-1 | Exact invocation; declared deviations | Harness invocation lines 1–2 are byte-identical to §9.1. The assertion invocation is §9.1's `Set-Location` line plus its third line. The only additions are the declared wrapper status lines. Both child processes exited 0 (`run-case-status.txt`, `assert-status.txt`). No deviation beyond the three in §16.5 was found. |
| R-2 | Sources match the reviewed C2 effective manifest | Yes (§17.1). |
| R-3 | Parent / filter pid provenance; wait status 3 | Parent writer 2008 (`SCRIPT-START`). `FILTER-START tag=ERR pid=2016`, written by 2016; `PIPE-RETURN idx=1 n=2 ps0=[0] ps1=[0] fpid=[2016]`; `FILTER-EXIT tag=ERR pid=2016 rc=3`. `fpid` differs from the OUT filter (2018), the parent (2008) and the utility (2020). `PRE-EXEC idx=1` has `prev_bang=[]`. `WAIT-RETURN idx=1 se=[3]`. |
| R-4 | Same-parent event order; no c2 dispatch | All seven parent events carry writer 2008, in file order `PIPE-RETURN` (line 14) < `WAIT-RETURN` (16) < `STOP-EVENT` (17) < `STOPPED` (18) < `NOT-STARTED idx=2` (19) < `SCRIPT-END` (20). There is no `DISPATCH-OK` and no `PRE-EXEC idx=2`. There is one `UTIL-EXEC` (c1) and there are two `FILTER-START` lines. |
| R-5 | Exact bytes | `candidate-stdout.bin` (218 B) and `candidate-stderr.bin` (147 B) are LF only and byte-equal to §9.2, rebuilt independently with nonce `d102184202d44c71`. |
| R-6 | All 14 assertion results | U1, R1, S1, P1, P2, P3, W1, G1, D1, C1, W1S, O1, E1 and X1 were recomputed from the underlying evidence. Each passes, matching `assertions.json` (verdict PASS, rule 5, correction C2). The input hashes recorded in `assertions.json` equal the current evidence hashes. |
| R-7 | Job assignment before GO; no intervention; exit 0; zero survivors | `JOB-ASSIGN ok=True` at sw 0.344715 (4.8 ms after `PROC-START`), before `GO-SENT` at sw 0.492387. None of the eight intervention events appears. Each required harness event appears once, and 22 / 22 lines parse. `PROC-EXIT code=0` and `exitCode=0`. `SURVIVOR-CHECK activeProcessesInJob=0` equals `survivorsBeforeClose=0`; then `JOB-CLOSED`. Retained 365 / 262144 B, 0 dropped. Batch 3.76 s of 1800 s. |
| R-8 | Record diffs | Each Step 3 diff, applied to its retained pre-Step-3 snapshot (stage-start `a332ac1a…`, `TASKS.md` `cbfb25cb…`, backlog `ba42bec3…`), reproduces the Step 3 file exactly (`fbfb22d2…`, `df867edb…`, `b0c911ca…`). |
| R-9 | Preserved freeze / C1 / C2 prefixes | Leading 27112 B = `e7aa5bc1…` (freeze). Leading 34254 B = `8605c078…` (through C1). Leading 39605 B = `a332ac1a…` (through C2). Each boundary is the byte before the next appended section's separator line. |

### 17.4 STOPPED CAP provenance

**STOPPED CAP resulted from the injected ERR filter exit status 3. No actual CAP-HIT and no capture-budget exhaustion occurred.**

- The ERR filter reached EOF with `rc=0 lines_seen=3 bytes_seen=147` against its 60 L / 2048 B cap. It slept about 3 s and then returned the injected `AISB_FILTER_FORCE_RC_ERR=3` (`FILTER-EXIT … rc=3`).
- The parent's `wait` returned that status as `se=3`. With `ps0=0` and `ps1=0`, the classifier's `se=3` branch labelled the stop `CAP`.
- The OUT filter also ended `rc=0`, with 3 lines / 147 B.
- There is no `CAP-HIT` audit line and no `CAP-TRUNCATED` marker in either channel. The harness retained 365 of 262144 B, dropped 0, and fired no RETENTION watchdog.
- The `STOP-EVENT` detail text lists CAP-HIT as a possible source. Here no CAP-HIT occurred.

B-1 therefore tests the gate's response to a filter status of 3, not the cap mechanism.

### 17.5 Observations (non-blocking; nothing changed)

- `harness.log` and `result.json` are CRLF (Windows PowerShell writer). The candidate audit log and both `.bin` captures are LF only. §9.2 governs the `.bin` files only.
- Both wrapper lines record `lastexitcode=[]`, because calling a `.ps1` does not set `$LASTEXITCODE`. The exit-0 evidence is the child-process exit codes in the two status files.
- §16.4's statement that Windows pids 28688, 20508 and 16756 were no longer running has no retained output. It cannot be re-verified from retained evidence. Survivor evidence for the job rests on `SURVIVOR-CHECK` 0 and `JOB-CLOSED`.
- `diagnosticBytes.harnessLog=2016` plus the 110-byte `CASE-END` line equals the final 2126 B, as §16.5 states.

### 17.6 Closure

**COMPLETE AND LOCKED — bounded local experiment record, B-1 PASS.** Three results are kept separate:

- **Candidate outcome.** B-1 PASS (§9.6 rule 5), bounded to this fixture and to the capture / status / gate behaviour of MSYS bash 5.2.15.
- **Execution compliance.** Compliant with the Step 3 authorization: one harness run and one assertion run; no modification, probe, retry or added case. The three declared deviations (§16.5) stand as recorded. They are not waived or reclassified.
- **Containment.** Job Object assigned before GO; no harness intervention; exit 0; 0 survivors; job closed.

The lock covers the experiment record only. It approves no candidate for host use, excuses no deviation and grants no retroactive authorization.

### 17.7 Limitations carried forward; state unchanged

The §5 declared deviations, the §9.7 limits, the harness branches untested since §14.2 / §16.4 (refusal, zero-remaining, count-only past the budget) and the §16.7 limitations all remain. B-1 establishes nothing about:

- the 65536 B / 2000 L aggregate;
- the 15 s / 120 s deadlines, or 124 / 137 propagation;
- `sudo`, FG-6 survivors, or Linux transfer;
- process-substitution backing on H;
- remote termination;
- the cap mechanism itself;
- pid reuse;
- host readiness.

Readiness: NO. Host use: BLOCKED. Stage B: NOT AUTHORIZED. No successor is registered. PRIV-INSPECTION-01 §17 remains unadopted. AGENT-PLATFORM-EXEC-01C6A `startCondition=NOT_READY`, HOST_CLEAN=NO, P7_ACCEPTED=NO and REOPEN_GATE=UNSATISFIED are unchanged. Occupancy EMPTY. Lane 3 DISABLED.

### 17.8 Write set and activity

Written: this section; this task's `TASKS.md` and `TASKS_BACKLOG_FULL.md` records; and `evidence\step4-closure\`, which holds the review scripts and outputs, the extracted package copy, pre-Step-4 snapshots, prepared outputs, Step 4 record diffs, the validator proof and the closure-review package. The closure-review bundle hash is recorded beside the bundle, not in repository records.

Executions of the candidate, harness, fixture and assertion script = 0. Probes = 0. Reruns = 0. Source edits = 0. Host access = 0. STAGING not acquired. Git stage / commit / push / reset / restore / clean = 0. MECH-EXP-01 writes = 0. Historical package writes = 0. Repository `SATURATION_PROOF.json` not mutated. The lane-capacity validator proof is written under `evidence\step4-closure\validation\` via `-ProofPath`.
