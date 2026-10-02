# PM2-RECOVERY-MECH-EXP-01 — Stage-start (Step 2 scope freeze) — bounded local experiment on the H-1 inspection-control candidate

**Task:** PM2-RECOVERY-MECH-EXP-01
**Nature:** GOVERNANCE / EVIDENCE (off-repo tooling route, AMENDMENT-02 §10; no implementation lane; no sidecar candidate; `AISB_MACHINE_REG_V1 nature=GOVERNANCE`)
**Lifecycle:** 4-step (Step 1 registration → Step 2 this freeze → Step 3 Stage A execution [Stage B only under a separate later authorization] → Step 4 independent review and lock of the *experiment record*, never of readiness)
**Authorization (Keith, 2026-10-01):** registration, scope freeze, and Stage A execution only, under conditions 1–8 (§3).
**Baseline:** HEAD `f24850bcb70c82dc72baa479d1c24969fc177f3d`; working tree carries only the inherited `M docs/control-plane/SATURATION_PROOF.json` (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`), preserved unmodified.
**Evidence class:** LOCAL-TESTS. **Mutexes:** GOVERNANCE transiently for record writes only. No STAGING, LOCAL-RUNTIME, PROVIDER-LIVE, ENV, CREDIT.
**Write scope:** this file; required `TASKS.md` / `TASKS_BACKLOG_FULL.md` registration and status records; `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\stage-a\` (source, fixtures, evidence, hashes). Nothing else.

## 0. What this task is not

- Not a host-inspection successor. Not a mechanism-readiness approval. Not an adoption of PRIV-INSPECTION-01 §17 (which remains PROPOSED / NOT ADOPTED, preserved verbatim). Not a change to AMENDMENT-02 (LOCKED, decision record only), PRIV-INSPECTION-01 §§0–13 / §6.3 ceilings / §8 stop items / §5 item 5, INVENTORY-01, or any other locked predecessor.
- Inspection-mechanism host use remains BLOCKED. Readiness for H remains BLOCKED under AMENDMENT-02 §6.3 (C2) and §8.5 (5). No local result from this task changes either, and no local result authorizes Stage B.
- Produces class T evidence about a Windows/MSYS fixture only. It is not evidence about the host, about sudo, about Linux GNU timeout semantics, or about any production path.

## 1. Hypothesis under test (UNVERIFIED; frozen verbatim from the reviewed proposal)

H-1: a host-authoritative single-brace-block script with one READY/GO gate, host-side caps/deadline strictly tighter than the frozen 120 s / 65536 B / 2000 L, per-command `timeout -s TERM -k 1 14 sudo -n timeout -s TERM -k 1 13 <utility> </dev/null`, separate-channel capture `cmd 2> >(stderr-cap) | stdout-cap` with parent `wait $!`, and the existing INVENTORY-01 supervisor as backstop, satisfies PRIV-INSPECTION-01 §8 items 6–7 as read by AMENDMENT-02 §6.3 (C2): a stop event is followed by no further command, and no root child or descendant survives its wrapper.

The capture shape `cmd </dev/null 2> >(cap ERR) | cap OUT; ps=("${PIPESTATUS[@]}"); fpid=$!; wait "$fpid"` is preserved exactly as the hypothesis under test. It is not repaired or replaced during this experiment. If it fails, the failure is recorded and candidate testing ends (condition 7).

Compliance criteria are not redefined here. Ceilings: 15 s per command, 120 s session, 65536 B / 2000 L aggregate (§6.3). FG-6 (C2): no root child or descendant survives its wrapper in any case. Measurement uncertainty is recorded as a separate field; it never widens a ceiling or excuses a survivor. An observation that cannot establish a criterion is INCONCLUSIVE, not PASS.

## 2. Three result dimensions, kept apart

1. **Experiment completion** — which cases ran, which are NOT RUN, artifacts hashed.
2. **Candidate result** — PASS / FAIL / INCONCLUSIVE per case criterion, plus harness-defect notes kept separate from candidate failures.
3. **Readiness** — never produced by this task.

## 3. Frozen conditions (Keith, verbatim)

1. Stage A only. No Stage B, Docker, WSL setup, sudo, SSH, network, package installation, host contact, application runtime or subagents. Use existing local PowerShell/MSYS tools. If required tools are unavailable, report the missing prerequisite without installing them.
2. Preserve the exact H-1 capture shape as the hypothesis under test. Run A-1 first, then A-2, then the remaining cases only if justified. Build only the harness needed for the next decisive case. Do not silently repair or replace the candidate during this experiment.
3. Separate candidate behavior from test-harness protection. The outer watchdog and Job Object cleanup protect the computer; they are not part of the candidate's stop mechanism. For local-stop simulations, do not kill the simulated remote through the outer Job Object at the candidate stop event and call that a PASS. Record candidate events, watchdog intervention and cleanup separately. If safe containment cannot be established, do not run the case.
4. Preserve the proposal's external bounds: 60 seconds per case, 256 KiB retained experimental capture per case, and 30 minutes for the Stage A execution batch. Separately enforce and report the candidate's aggregate capture limit of at most 65536 bytes / 2000 lines, or a declared tightening. Candidate output, audit logs and control markers must have explicit accounting. Extra diagnostic capacity is not candidate capacity.
5. Freeze the actual tested deadlines, clock source, instrumentation and uncertainty. A fixture start marker is not automatically an independently observed OS exec event. If event ordering cannot be established, report INCONCLUSIVE. Any shortened simulated session deadline must be identified; do not claim it tested the full 120 s.
6. Correct A-4 expectations: valid GO received before cutoff permits the planned execution; withheld, wrong or expired GO permits none. Timestamp actual cap/deadline events separately from STOPPED markers.
7. End candidate testing on the first decisive FAIL, or on an INCONCLUSIVE result that prevents further interpretation. Record remaining cases NOT RUN. No resizing, redesign or repeated attempts to obtain a pass. An inconclusive observation is not a counterexample. Distinguish harness defects from candidate failures.
8. Cleanup is limited to test-owned processes and artifacts. Preserve evidence for review. Record containment and cleanup results without claiming a whole-computer absence-of-writes proof.

## 4. Environment and tools (observed, not installed)

From `stage-a\evidence\toolcheck-output.txt`: MSYS bash 5.2.15(1)-release (`C:\Program Files\Git\usr\bin\bash.exe`; `MSYS_NT-10.0-22631 3.4.7`); GNU coreutils 8.32 (`timeout`, `sleep`, `date`, `stat`, `cat`, `wc`, `seq`, `head`, `tr`); GNU Awk 5.0.0; `EPOCHREALTIME` supported; process substitution and `/dev/fd` present; Windows PowerShell 5.1.22621.6133; .NET Framework `csc`/`Add-Type` for the Job Object adapter. No missing prerequisite. `C:\Windows\System32\bash.exe` (WSL) is not used.

## 5. Declared deviations from the host form of H-1 (Stage A is Windows-local and unprivileged)

| Host form | Stage A fixture | Consequence |
|---|---|---|
| `ssh -T … bash -s` with the block on stdin | local `bash.exe candidate.sh`, block is the script file; harness pipes GO on stdin | parse-before-run property of the brace block is the same; ssh stdin/EOF behaviour is NOT tested (A-5 truncated delivery is therefore limited to what a local pipe can simulate) |
| `timeout … sudo -n timeout … <utility>` | `timeout … timeout … bash util.sh` (no sudo; fixture utility) | sudo relay/startup interval and root survivors are NOT tested (Stage B question); only the shape, status propagation, and stop-event ordering are tested |
| Linux signals / process groups | MSYS/Cygwin signal emulation | 124/137 propagation observations are fixture-level; not transferable to Linux without Stage B |
| host 15 s / 120 s / 65536 B / 2000 L | per-case tightened: per-command ceiling 2–3 s, session budget 6–15 s, per-channel caps 2048 B / 60 L (exact values recorded per case in `harness.log` ENV line) | **shortened deadlines; the full 120 s and 15 s are NOT tested.** Candidate aggregate stdout+stderr is still accounted against 65536 B / 2000 L in `result.json` |
| independent OS exec observation (strace) | none available; `UTIL-EXEC` is a fixture marker written by the utility's own bash | exec ordering is established from fixture markers plus harness-observed stream arrival only; if that ordering cannot be established for a case, the case is INCONCLUSIVE |

## 6. Clock source, instrumentation, uncertainty (frozen)

- Candidate and utility audit lines: bash `$EPOCHREALTIME` (microsecond-format wall clock via MSYS gettimeofday; **not monotonic**; derived from the Windows system clock). Written to `candidate-audit.log` (instrumentation only; NOT candidate capture capacity).
- Harness lines: `DateTime.UtcNow` as Unix seconds (coarse, ~1–16 ms resolution) **plus** a monotonic `Stopwatch` (`sw=`) started at CASE-BEGIN. Written to `harness.log`.
- Correlation between the two logs is via the shared Windows system clock; a clock step during a 60 s case is unlikely but not excluded. Within one log, ordering of lines is reliable because each line is appended by the process that observed the event.
- Append races: candidate, filters and utility append to the same audit file from separate processes; line interleaving is possible, so **ordering is read from timestamps, not file position.**
- Uncertainty field per case: harness polling interval 5 ms; UtcNow granularity ≤ 16 ms; `EPOCHREALTIME` write latency unknown but sub-millisecond expected. Any ordering difference smaller than 20 ms between the two logs is treated as unresolved (INCONCLUSIVE for that ordering), never as PASS.

## 7. Bounds and accounting (frozen)

- Per case: 60 s wall clock (harness watchdog; on breach `TerminateJobObject` then record `WATCHDOG-FIRE` / `JOB-TERMINATE`); 256 KiB retained experimental capture per case (stdout + stderr; breach also fires the watchdog). Batch: 30 min from `evidence\batch.json` `batchStartUnix`; a case is refused (`BATCH-EXCEEDED`) after that.
- Candidate aggregate: at most 65536 B / 2000 L (frozen ceiling). Declared tightening per case: per-channel caps `AISB_OUT_CAP_B/L`, `AISB_ERR_CAP_B/L` (default 2048 B / 60 L). `result.json` reports total candidate stdout bytes, total stderr bytes, retained bytes, and the ceiling line. Control markers (`READY`, `RC`, `STOPPED`, `END`, `--- X-CAP-TRUNCATED … ---`) are candidate output and are counted inside the candidate total. `candidate-audit.log` and `harness.log` are diagnostic capacity, accounted separately, never candidate capacity.

## 8. Containment and cleanup (frozen)

- Every candidate process tree runs inside one Windows Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (`source\AisbJob.cs`, pattern copied from INVENTORY-01 §13.4 adapter). The harness assigns the job immediately after `Process.Start`; the candidate performs no exec before GO; **GO is never sent unless the assignment succeeded** (`GO-REFUSED` otherwise), so no utility exec occurs outside the job.
- Job Object / watchdog events are harness protection and are recorded as `HARNESS …` lines, never as candidate events. Killing the fixture through the job is never a candidate PASS (condition 3).
- At case end: `SURVIVOR-CHECK` (active processes still in the job after the candidate exited — test-owned descendants that outlived the candidate bash are reported as a number, not hidden), then job close. Cleanup touches only test-owned processes and the task directory. No whole-computer absence-of-writes claim is made.

## 9. Decisive cases (frozen; identical to the reviewed proposal; order and gating per condition 2)

| # | Case | Compliance criterion applied | FAIL if | Run gating |
|---|---|---|---|---|
| A-1 | Stderr filter sleeps 3 s after producer EOF, exits 3 | `wait $!` returns 3 to the parent before the next command is considered; `$!` is the stderr filter (pid provenance via `FILTER-EXIT tag=ERR pid=` = `fpid`) | parent proceeds before status retrieved, or retrieves a status other than 3, or `$!` is not the filter | first |
| A-2 | Two consecutive commands each with a process-substitution filter | `$!` refers to the current command's filter | stale `$!` | second, only if A-1 is not a decisive FAIL / blocking INCONCLUSIVE |
| A-3 | Producer writes distinguishable bytes to stdout and stderr; 10 000 stderr lines; marker-like and newline-bearing records | each byte lands on its own channel file; cap flags per channel; aggregate never exceeded | cross-channel contamination; a cap flag not available to the parent before the next command; any byte beyond budget retained | only if justified by A-1/A-2 |
| A-4 | GO delayed 0 / 2 / 5 s; GO withheld; wrong nonce; GO past the candidate's cutoff | valid GO received before cutoff permits the planned execution; withheld, wrong or expired GO permits none (zero utility execs) | any exec without a valid in-time GO; or planned execution refused after a valid in-time GO | only if justified |
| A-5 | Truncated block delivery (local-pipe simulation only; see §5) | zero execs | any exec | only if justified |
| A-6 | Host-visible stops: simulated 124, 137, cap hit, PID-GONE predicate | no command starts after the stop **event** timestamp (`CAP-HIT`, `PIPE-RETURN` of the wrapper exit, `STOP-EVENT HOST-DEADLINE`), timestamped separately from the `STOPPED` marker | an exec (`UTIL-EXEC` / `PRE-EXEC`) timestamp > stop-event timestamp | only if justified |
| A-7 | Local-only stop (backstop cap or deadline fires) while the simulated remote keeps emitting commands | the local stop is a stop; the remote must not execute further commands; the simulated remote is **not** killed through the outer Job Object at the candidate stop event | any remote exec after the local stop-event timestamp — candidate FAIL for that branch; record whether the host's own stop preceded or followed | only if justified and safe containment is established without using the job to produce the result |
| A-8 | Injected ssh-style stderr noise against the sized reserve | host stop precedes local backstop | local backstop fires while host RUNNING | only if justified |

Session deadline in every case is a **shortened simulated** budget (recorded per case). No case tests the full 120 s or 15 s ceilings.

**Proceed / end rule.** Candidate testing ends on the first decisive FAIL or on an INCONCLUSIVE result that prevents further interpretation; remaining cases are recorded NOT RUN. No resizing, redesign, or repeated attempts. Harness defects are recorded as such, may be corrected in the harness only (never in `candidate.sh`), and are listed separately in §11.

## 10. Frozen artifacts (SHA-256, pre-execution)

Directory `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\stage-a\`:

| File | SHA-256 | Bytes |
|---|---|---|
| `source\candidate.sh` (H-1 candidate fixture; frozen; not to be edited during Stage A) | `d751bb63e53a33c18fcf9224276299afc82ff7e5bf62a3bd0acfc33ba605e504` | 4527 |
| `fixtures\util.sh` (simulated utility; frozen) | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | 1885 |
| `source\AisbJob.cs` (harness containment) | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | 4106 |
| `source\Run-Case.ps1` (harness; may be corrected for harness defects, with the correction recorded in §11) | `a73d38f5901a1a53a7a44b7f26866e5758130d7c62b8c66083675d6b277ae14a` | 9125 |
| `source\toolcheck.sh` | `a67bddc7a529cfd003dabf6ad2a37850fed6f3f19c181abccad1c5ec31051a43` | 849 |

Pre-execution static checks: `bash -n candidate.sh` rc=0; `bash -n util.sh` rc=0; `Add-Type AisbJob.cs` compiled; Job Object create/setinfo OK. The candidate has not been executed before this freeze.

`stage-a\evidence\proposal-turn3-verbatim.md` retains the reviewed proposal text that this freeze mirrors.

## 11. Execution record (Step 3, Stage A) — appended after the freeze above; the freeze text in §§0–10 is not edited

**Executed:** 2026-10-01, same window as Steps 1–2, at baseline `f24850bcb70c82dc72baa479d1c24969fc177f3d`. Stage A only. No Docker, WSL, sudo, SSH, network, package installation, host contact, application runtime or subagents. Batch: one case executed; batch wall clock ≈ 7 s of the 30 min bound.

### 11.1 Experiment completion

| Case | State | Note |
|---|---|---|
| A-1 | RUN — **FAIL (decisive)** | §11.2 |
| A-2 | NOT RUN | ended by condition 7 after A-1 (a diagnostic probe, not a case, incidentally observed A-2's stale-`$!` branch; §11.3) |
| A-3 | NOT RUN | ended by condition 7 (an incidental cross-channel observation from A-1 is recorded in §11.3; it is not an A-3 result) |
| A-4 | NOT RUN | ended by condition 7 |
| A-5 | NOT RUN | ended by condition 7 |
| A-6 | NOT RUN | ended by condition 7 |
| A-7 | NOT RUN | ended by condition 7 |
| A-8 | NOT RUN | ended by condition 7 |

No resizing, redesign, or repeated attempt was made. `source\candidate.sh` SHA-256 after execution: `d751bb63e53a33c18fcf9224276299afc82ff7e5bf62a3bd0acfc33ba605e504` (identical to §10; candidate not modified).

### 11.2 A-1 — observed events and verdict

Parameters (declared tightening; recorded in `harness.log` ENV / PLAN): host budget 15 s; per-command ceiling 3 s; wrapper `timeout -s TERM -k 1 3 timeout -s TERM -k 1 2` (no sudo; §5); per-channel caps 2048 B / 60 L (defaults); plan `c1` (3 stdout + 3 stderr lines) then `c2` (2 stdout lines); stderr filter instrumented to sleep 3 s after EOF and exit 3 (`AISB_FILTER_SLEEP_ERR=3`, `AISB_FILTER_FORCE_RC_ERR=3`). GO sent valid, delay 0, after `JOB-ASSIGN ok=True`.

Candidate audit (`EPOCHREALTIME`, `evidence\A-1\candidate-audit.log`), command 1:

| t (s) | Event |
|---|---|
| 1790866720.216087 | `HOST-START` |
| …720.242354 | `PRE-EXEC idx=1` |
| …720.273618 / …720.275212 | `FILTER-START tag=OUT pid=117` / `FILTER-START tag=ERR pid=118` |
| …720.347334 | `UTIL-EXEC tag=c1 pid=120` (fixture marker, not an OS-observed exec) |
| …720.377751 | `UTIL-EXIT tag=c1 rc=0` |
| …720.382513 | `FILTER-EOF tag=ERR pid=118 rc=0 lines_seen=3 bytes_seen=147` |
| …723.420576 | `FILTER-EXIT tag=ERR pid=118 rc=3` (after the 3 s instrumented delay) |
| …723.421981 / …723.423211 | `FILTER-EOF tag=OUT pid=117 lines_seen=6 bytes_seen=294` / `FILTER-EXIT tag=OUT rc=0` |
| …723.426424 | `PIPE-RETURN idx=1 ps0=0 ps1=0 fpid=` — **`$!` is EMPTY in the parent** |
| …723.427682 | `WAIT-RETURN idx=1 se=1` — `wait ""` failed (`candidate-stderr.bin`: ``wait: `': not a pid or valid job spec``); **status 3 was not retrieved** |
| …723.457776 | `PRE-EXEC idx=2 name=c2` — **the parent proceeded to the next command** (+30 ms after `WAIT-RETURN`; +37 ms after the filter's status-3 exit) |
| …723.552928 | `UTIL-EXEC tag=c2 pid=130` (fixture marker) |

Command 2 repeated the identical pattern (`fpid=` empty, `se=1`), then `SCRIPT-END COMPLETE`, candidate exit 0, `END <nonce> COMPLETE`. Candidate stdout markers `RC 1 0 0 1` and `RC 2 0 0 1` record `ps0=0 ps1=0 se=1`.

**Criterion (frozen §9):** `wait $!` returns 3 to the parent before the next command is considered; `$!` is the stderr filter.
**Observed:** `$!` was not the filter (empty; filter pid 118 vs `fpid=` empty); the retrieved status was 1 (bash `wait` usage error), not 3; the parent proceeded to command 2 without the filter's status. All three FAIL branches of §9 A-1 are met.

**Verdict A-1: FAIL — decisive.** The H-1 capture shape `cmd 2> >(stderr-cap) | stdout-cap; wait $!` does not give the parent shell ownership of, or the exit status of, the stderr filter. A stderr-side cap flag (status 3) cannot reach the parent through `wait $!` under this shape, so a stderr cap event cannot stop the sequence by this path. Under the proposal's proceed/end rule and condition 7, candidate testing ends here with a recorded counterexample.

**Attribution (harness defect vs candidate property):** `source\diag-shape-probe.sh` (plain bash, outside the candidate fixture; output `evidence\A-1\diag-shape-probe-output.txt`): probe 1 — in a simple command `: 2> >(exit 3)`, `$!` is the substitution's pid and `wait $!` returns 3; probe 2 — in the pipeline `true 2> >(exit 3) | cat`, `$!` is empty and `PIPESTATUS` is `0 0`; probe 4 — if any background job existed earlier, `$!` after the pipeline is that earlier job's pid (stale). Cause: each pipeline element runs in a subshell; the process substitution attached to the left element is forked by that subshell, so the parent never records its pid. This is bash semantics of the frozen shape (bash 5.2.15 here; not Windows-specific in mechanism), not a harness or fixture defect. Readers should still treat the Linux transfer as untested (§5).

**Measurement limitations for A-1:** `UTIL-EXEC` / `PRE-EXEC` are fixture markers, not independently observed OS exec events (§5). Ordering of the decisive facts does not rest on fine timing: the empty `fpid`, `se=1`, and the bash error text are state facts; the parent's progression to command 2 is recorded 30 ms after `WAIT-RETURN` and 37 ms after the filter's status-3 exit, above the 20 ms unresolved band of §6. Shortened deadlines (15 s / 3 s) were used; the full 120 s / 15 s ceilings were not tested; no cap event and no deadline event occurred in A-1; A-1 says nothing about wrapper termination, survivors, sudo, or FG-6.

### 11.3 Incidental observations (not case results; recorded for the reviewer)

1. Cross-channel: in the pipeline, the stderr filter's stdout is the pipe into the stdout filter, so the three stderr-capture records `E000001–E000003` appeared in **candidate stdout** (`FILTER-EOF tag=OUT lines_seen=6` for 3 stdout lines; `candidate-stdout.bin`). The frozen shape, as written, does not keep the channels separate unless the stderr filter is explicitly redirected elsewhere. This bears on A-3 (NOT RUN) and is not an A-3 verdict.
2. Completion coupling: the stdout filter's EOF was delayed until the stderr filter exited (`FILTER-EOF tag=OUT` at …723.421981, 3.04 s after the producer's exit), because the stderr filter held the pipe's write end. The pipeline's *completion* therefore depended on the stderr filter, but its *status* still did not reach the parent.
3. Stale `$!` (probe 4) is the A-2 FAIL branch, observed in a diagnostic probe only; A-2 itself was NOT RUN.

### 11.4 Candidate capture accounting (frozen ceiling 65536 B / 2000 L)

| Channel | Bytes | Lines | Notes |
|---|---|---|---|
| Candidate stdout (incl. control markers `READY`, `RC`, `END`, and the mis-routed E-records) | 467 | 12 | retained in full (`candidate-stdout.bin`) |
| Candidate stderr | 262 | 2 | two bash `wait` usage errors; retained in full |
| **Candidate total** | **729** | **14** | within 65536 B / 2000 L; no per-channel cap (2048 B / 60 L) hit |
| `candidate-audit.log` (instrumentation; NOT candidate capacity) | 1697 | 27 | separate |
| `harness.log` (harness; NOT candidate capacity) | 2376 | 25 | separate |

Retention bound 256 KiB per case: 729 B used. Watchdog 60 s: elapsed 6.97 s.

### 11.5 Harness protection, containment and cleanup (separate from candidate events)

- `JOB-CREATED setinfo=True`; `PROC-START pid=20768`; `JOB-ASSIGN ok=True` (3 ms after start; before READY was observed; GO sent only after assignment).
- `WATCHDOG-FIRE`: none. `JOB-TERMINATE`: none. `READER-TIMEOUT`: none.
- `SURVIVOR-CHECK activeProcessesInJob=0` after candidate exit; `JOB-CLOSED` (kill-on-close had nothing to kill).
- Cleanup scope: test-owned processes (none remaining) and the task directory only. Evidence preserved under `stage-a\evidence\`. No whole-computer absence-of-writes proof is claimed.
- **Harness defect record (not a candidate failure):** the first A-1 launch failed at PowerShell parameter binding before any process was started — the harness's log function was named `H`, which PowerShell resolves to the built-in alias `h` (`Get-History`). Corrected by renaming to `Hlog` in `source\Run-Case.ps1` (pre-fix SHA-256 `a73d38f5…` §10; post-fix `1f11a09b558b8fac295cdb66d98e926583aa60ece46f1fff75d5b6d9f120bb7f`). The candidate was not executed in the failed launch; `evidence\batch.json` was removed and recreated before the real run so the batch clock reflects the executed batch. `candidate.sh` and `util.sh` were not touched.

### 11.6 Artifacts and hashes (post-execution)

Directory `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\stage-a\`; manifest `SHA256SUMS` (SHA-256 `ab7d8007457e3635e8de8d64ce3be31766a60fa7439c271fd63f667b7ae053b5`):

```
f40fe0795c4b4f092ede03f070c647fabe47f16273a2f69c15eda05311d1c858  evidence/A-1/candidate-audit.log
e271d901c7f967eab40dd8ee4a214cd51105965f089cf7e2c5c1e6ab7fb3a497  evidence/A-1/candidate-stderr.bin
199da2032695b4683bf313c73a46fb0edab2b41ce5076bbd0ededa10c6fae2b6  evidence/A-1/candidate-stdout.bin
f4c3383ea47247463c26a8dd9a99ff8a045fb58251b5727b737551a6b4ddf71e  evidence/A-1/diag-shape-probe-output.txt
1a9af3cb4f7769e2b9c7f3b746921319af70ca6d68a7b375588483200d989287  evidence/A-1/harness.log
470cbc7971b0cfc48ff69beaff21f7f8ef5ae35ae52dc57391cf7d7629a0bdab  evidence/A-1/result.json
33470ae95e277ca0e2ed61778c141fec235155c7b72b4d6aaa9c021288655dac  evidence/A-1/run-output.txt
94137cd467c913c3d7cdf88b42683dacafbd8e4d1c34cb1419d60f38b98ec3b5  evidence/batch.json
545f20e5f027af375f15a91a05343d163b947487f7ba20dfe8107f9b743a1d13  evidence/proposal-turn3-verbatim.md
27debcfbdb77e2286fd4fd36b1e3ff9be308a1474874f6716c54b7e6efce470f  evidence/SATURATION_PROOF-steps1-2.json
2cd5f2f4dd4dbc22fbe8d292aee6f5e7ed9ff2aacbb6acaebd33e34dda625dc1  evidence/toolcheck-output.txt
779a8f1bcb20107c61b256ba587336405bab9b14c377dc7d09e88c0bbf946b9d  evidence/validator-steps1-2-output.txt
9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba  fixtures/util.sh
6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d  source/AisbJob.cs
d751bb63e53a33c18fcf9224276299afc82ff7e5bf62a3bd0acfc33ba605e504  source/candidate.sh
e722dd8b25894fb5a726cf2c377eae03a516010b6d8e7cc400b56f3ffb183323  source/diag-shape-probe.sh
cae6ffc9027f896b74465e1e179d3c6a215783a0b8de11df522b2ad4f76aea8a  source/Register-Records.ps1
1f11a09b558b8fac295cdb66d98e926583aa60ece46f1fff75d5b6d9f120bb7f  source/Run-Case.ps1
a67bddc7a529cfd003dabf6ad2a37850fed6f3f19c181abccad1c5ec31051a43  source/toolcheck.sh
```

(`SATURATION_PROOF-step3.json` / `validator-step3-output.txt` are written after this record and are hashed in the board/backlog Step 3 status line.)

### 11.7 Verdicts, kept apart

- **Experiment completion:** Stage A ended early by rule at A-1; A-1 RUN, A-2…A-8 NOT RUN; artifacts hashed; no Stage B.
- **Candidate result:** H-1 capture shape **FAIL (decisive) on A-1** — the parent does not own and cannot retrieve the stderr filter's status via `wait $!`; the hypothesis as frozen is rejected on this criterion. Nothing is concluded about wrapper termination, survivors (FG-6), sudo, or the 15 s / 120 s ceilings.
- **Readiness:** not produced. Inspection-mechanism host use remains BLOCKED. AMENDMENT-02 §6.3 (C2) / §8.5 (1)–(6) unchanged. PRIV-INSPECTION-01 §17 remains PROPOSED / NOT ADOPTED. No Stage B is authorized by this result; a repaired or replacement shape would be a new hypothesis requiring its own authorization, not a continuation of this task.

Step 4 (independent review and lock of this experiment record) is NOT started in this window.

## 12. Step 4 independent review — documentation-only reconciliation record (2026-10-02) — appended; §§0–11 are not edited

**Authorization (Keith, 2026-10-02):** one documentation-only reconciliation of the independent Step 4 review. No further experiment, probe, test, rerun, restoration, lock, implementation, redesign, successor registration, Stage B, host access or subagents. Baseline HEAD `f24850bcb70c82dc72baa479d1c24969fc177f3d`. GOVERNANCE acquired transiently for the record writes of this section and the matching board / backlog fields, then released UNOWNED. Inherited repository `docs/control-plane/SATURATION_PROOF.json` (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`) untouched; new validation proofs are exported under `stage-a\evidence\review-export\validation\`. This record grants no retroactive authorization for anything it describes. Closure eligibility remains **PENDING final review**; the experiment record is **NOT LOCKED**.

### 12.1 Line-ending state of this stage-start (observed before this append)

| Bytes | Length (B) | SHA-256 |
|---|---|---|
| Reviewed file as observed during the independent review (2026-10-02, review window starting 00:23 UTC+8; LF line endings) | 27306 | `8831274e10f3058698e310f8528903674158f509fb25b2af3b4d34e34b71f9d8` |
| File on disk before this append (CRLF line endings, 219 CRLF, no bare LF; last write time observed as 2026-10-02 09:56:20.477 UTC+8) | 27525 | `47e4be73adc597c1445a735ca21e2a6e1b344cdcbc742d0eaf546d3e7c1a999a` |
| LF-normalized derivation of the 27525-byte file (each CR immediately preceding LF removed) | 27306 | `8831274e10f3058698e310f8528903674158f509fb25b2af3b4d34e34b71f9d8` |

- **Content preservation:** VERIFIED. The LF-normalized derivation is byte-identical to the reviewed file. The §§0–10 freeze text, LF-normalized, hashes to `2cd4342eec42afa5423a554c0707f890b7b41cc3c454439541440323ae050a15` both in the reviewed file and in the CRLF file.
- **Byte preservation against the reviewed LF file:** NOT preserved. The bytes on disk differ from the reviewed bytes by line endings (+219 B).
- **Byte preservation by this reconciliation:** the 27525 bytes found on disk (§§0–11, CRLF) are retained unchanged as the leading bytes of this file; this §12 is appended after them in CRLF. Nothing in §§0–11 is rewritten.
- **Cause of the conversion: UNKNOWN.** No evidence establishes which process performed it. It is not attributed to Git, an editor, or any other tool. **09:56:20 is an observed file last-write timestamp, not a proven conversion time.**

### 12.2 Line-ending state of manifest-covered Stage A files (current bytes left untouched)

`SHA256SUMS` is unchanged: 22 entries, 2092 B, SHA-256 `08c722bf533107dd51716fcd79024aa95835660c1bdbb2474974b4775d59174d`, last write time observed as 2026-10-01 23:03:31. 14 of its 22 entries verify byte-for-byte against the current files (all `evidence\` files, including every A-1 log, `.bin`, `.json`, `.txt` and the proposal).

The following 8 entries were observed with CRLF line endings. **Their current CRLF bytes DIFFER from the `SHA256SUMS` hashes; they do not pass the original manifest and are not byte-unchanged.** Only the LF-normalized derived copies match. The current files are left untouched; no restoration was performed.

| File | Current SHA-256 | Current B | Derived LF SHA-256 | Derived B | Derived = SHA256SUMS entry | Observed last write (2026-10-02, UTC+8) |
|---|---|---|---|---|---|---|
| `source/candidate.sh` | `c33edbb114854af0c525faf15b86175c44f6796c824c1d36df97f4111b1a08c0` | 4612 | `d751bb63e53a33c18fcf9224276299afc82ff7e5bf62a3bd0acfc33ba605e504` | 4527 | YES (exact) | 09:56:20.477 |
| `fixtures/util.sh` | `f552fda8a7931110e5d3c5622c0426c79845942f2cb55729fd1ae85321dd9b49` | 1920 | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | 1885 | YES (exact) | 09:56:20.478 |
| `source/AisbJob.cs` | `2c2a79099239b9bd340100005a6c636534c168d7fbd4b08828128de304ad5359` | 4148 | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | 4106 | YES (exact) | 09:56:20.424 |
| `source/Run-Case.ps1` | `d104ad9a631c5df53e0ae164c22087b4c027c0fcfe6cfe12cb8a301cc876f78c` | 9350 | `1f11a09b558b8fac295cdb66d98e926583aa60ece46f1fff75d5b6d9f120bb7f` | 9209 | YES (exact) | 09:56:20.385 |
| `source/toolcheck.sh` | `7e1549cc0ed87fcb2effedbc59dc251e086ca0652df387352c2089c17970b070` | 866 | `a67bddc7a529cfd003dabf6ad2a37850fed6f3f19c181abccad1c5ec31051a43` | 849 | YES (exact) | 09:56:20.385 |
| `source/diag-shape-probe.sh` | `a4ac140ca136c9ee4bd3accc266679d5888a3919daf90aee65ad1b65224fae18` | 948 | `e722dd8b25894fb5a726cf2c377eae03a516010b6d8e7cc400b56f3ffb183323` | 935 | YES (exact) | 09:56:20.423 |
| `source/Register-Records.ps1` | `e73eebe9b870f3f18842480fd9d42acbb9e0243b32946eaaeec7089b96f0b62b` | 14250 | `cae6ffc9027f896b74465e1e179d3c6a215783a0b8de11df522b2ad4f76aea8a` | 14139 | YES (exact) | 09:56:20.424 |
| `source/Update-Step3-Records.ps1` | `340ca9b54e8a7540ae11157a4ea15e2fea738fdf1553595da8438876ef04d5b5` | 5538 | `5682a7f4d89e98461cfdfdb90410d10a9e7678c81ae6266db53ff35fa8b526f3` | 5488 | YES (exact) | 09:56:20.478 |

During the independent review (2026-10-02, window starting 00:23 UTC+8) all 22 entries, including these 8, verified byte-for-byte. The conversion therefore occurred after that verification; its cause is **UNKNOWN** and the listed times are observed last-write timestamps, not a proven conversion time. Because the derived LF bytes reproduce the pre-execution / post-execution hashes exactly, the frozen candidate, fixture and harness content is recoverable and unchanged in content; this does not make the current files byte-identical to the manifest.

**Observed outside this task (reported only; not modified; not brought into this task's scope):** files with the same 2026-10-02 09:56:20 observed last-write timestamps and CRLF line endings were seen in 38 files under `C:\Users\knlee\aisb-preflight\INVENTORY-01\` (PM2-RECOVERY-P5-INVENTORY-01 evidence), in tracked `docs/GOV-OS-03-CHECKPOINT.md` and `docs/GOV-OS-03R1-CHECKPOINT.md` (LF-normalized bytes equal their HEAD blobs; `git status` does not show them because `core.autocrlf=true`), and in Git-ignored `.env.production.example` / `.env.staging.example`. No integrity conclusion about INVENTORY-01 is drawn here.

### 12.3 Disposition 1 — candidate result scope

A-1 supports rejection of the **exact tested capture shape** `cmd </dev/null 2> >(cap ERR) | cap OUT; ps=("${PIPESTATUS[@]}"); fpid=$!; wait "$fpid"` **on the Windows/MSYS fixture** (MSYS bash 5.2.15, `MSYS_NT-10.0-22631 3.4.7`). The decisive facts are state facts from the A-1 artifacts alone: `fpid=` empty in the parent; `wait ""` usage error with `se=1`; the stderr filter's `rc=3` never reached the parent; the parent's next command (`PRE-EXEC idx=2`) followed in program order of the same shell. The result does not depend on the post-failure probes or on cross-log timing. It is **not** generalized to Linux, GNU/Linux bash, sudo, signal or termination behaviour, survivors (FG-6), the 15 s / 120 s ceilings, or any other capture mechanism. A-1 did not exercise the "parent proceeds before the filter exits" branch: the pipeline completion waited for the stderr filter (§11.3(2)).

### 12.4 Disposition 2 — execution compliance: FAIL for condition 7

**Execution compliance: FAIL for condition 7** ("End candidate testing on the first decisive FAIL … No … repeated attempts"). After the A-1 FAIL (A-1 artifacts written 2026-10-01 22:58:46), `source\diag-shape-probe.sh` was written (22:59:33) and executed (output 22:59:43) with four probes of the frozen capture shape's semantics. Probes 1–2 addressed attribution of the A-1 result; probes 3–4 investigated the subjects of NOT-RUN cases A-3 (stderr-filter output routed into the stdout pipe) and A-2 (stale `$!`). The probe was not part of the frozen §9 plan, was not pre-hashed, and was not run under the Job Object. Describing it as "not a retry" does not authorize it. This record **records the deviation; it does not waive it and grants no retroactive authorization.**

This finding is separate from, and does not change: (a) A-1's evidentiary validity (§12.3; the A-1 artifacts predate the probe and do not rely on it); (b) artifact integrity (A-1 logs and evidence verify byte-for-byte against `SHA256SUMS`; the line-ending state of source / fixture files is recorded in §12.2).

Additional executions known from artifacts and records (executions that left no trace cannot be excluded):

| Order | Execution | Containment | Retained output |
|---|---|---|---|
| pre-freeze (2026-10-01 22:42) | `source\toolcheck.sh` — tool availability plus two simple-command process-substitution / `wait $!` semantics checks | none (not in a Job Object) | `evidence\toolcheck-output.txt` |
| pre-freeze | `bash -n candidate.sh`, `bash -n util.sh`, `Add-Type AisbJob.cs`, Job Object create / set-information (§10) | none | **not retained** (results stated in §10 only) |
| records (22:57) | `source\Register-Records.ps1`; lane-capacity validator run 1 | n/a | `evidence\validator-steps1-2-output.txt`, `evidence\SATURATION_PROOF-steps1-2.json` |
| execution | first `Run-Case.ps1` A-1 launch, failed at PowerShell parameter binding (alias `h` → `Get-History` shadowing function `H`) before `Process.Start` | no candidate process started | **not retained** |
| execution | manual removal of `evidence\batch.json` (as stated in §11.5) | n/a | none (see §12.7) |
| execution (22:58:24–46) | `Run-Case.ps1` A-1 — the only candidate run | Job Object, kill-on-close, assigned before GO | `evidence\A-1\*` |
| **post-failure** (22:59:33–43) | `source\diag-shape-probe.sh`, probes 1–4 (spawns process substitutions, a background `sleep 0.1`, `sleep 0.3`) | **none; no survivor check recorded** | `evidence\A-1\diag-shape-probe-output.txt` |
| records (23:02–23:03) | §11 append; `source\Update-Step3-Records.ps1`; lane-capacity validator run 2; `SHA256SUMS` regenerated | n/a | `evidence\validator-step3-output.txt`, `evidence\SATURATION_PROOF-step3.json`, `SHA256SUMS` |

Containment limitations: only the A-1 candidate run was inside the Job Object. Between `Process.Start` and `AssignProcessToJobObject` (about 3 ms) `bash.exe` ran unassigned; ordering of assignment before any candidate action rests on source structure (built-ins only before GO; GO gated on successful assignment), not on cross-clock timing (the first candidate audit line is 22 ms after `JOB-ASSIGN`, at the edge of the §6 20 ms band). The watchdog runs in the harness loop (independent of the candidate, not of the harness) and never fired, so it is untested. `SURVIVOR-CHECK` counts only processes in the job. No whole-computer absence-of-writes or absence-of-processes claim is made.

### 12.5 Disposition 3 — formal cases

A-2, A-3, A-4, A-5, A-6, A-7 and A-8 remain **NOT RUN as formal cases**. Disclosure: the post-failure probe nevertheless investigated subjects of A-2 (probe 4: `$!` after the pipeline equals a pre-existing background job's pid) and A-3 (probe 3: the process substitution's stdout reaches the stdout pipe), and the A-1 run itself incidentally showed stderr-capture records in candidate stdout (§11.3(1)). None of these is a case result or verdict for A-2 or A-3.

### 12.6 Disposition 4 — manifest reconciliation

- **Cited manifest** (§11.6, board `PM2_RECOVERY_MECH_EXP_01_STEP_3`, backlog Step 3 item): SHA-256 `ab7d8007457e3635e8de8d64ce3be31766a60fa7439c271fd63f667b7ae053b5`, 19 entries.
- **Current manifest on disk** (`stage-a\SHA256SUMS`, preserved unchanged): SHA-256 `08c722bf533107dd51716fcd79024aa95835660c1bdbb2474974b4775d59174d`, 22 entries, 2092 B, LF, trailing newline.
- **Relationship, verified from retained bytes:** deleting lines 10, 13 and 22 of the current manifest, keeping the remaining 19 lines in their existing order, LF-joined with a trailing LF, yields 1789 B with SHA-256 `ab7d8007457e3635e8de8d64ce3be31766a60fa7439c271fd63f667b7ae053b5`, and those 19 lines equal the §11.6 listing line for line. The 19 shared entries are therefore unchanged between the two manifests.
- **Entries added in the 22-entry manifest:**
  - line 10 — `27debcfbdb77e2286fd4fd36b1e3ff9be308a1474874f6716c54b7e6efce470f  evidence/SATURATION_PROOF-step3.json` (2496 B; byte-identical to `SATURATION_PROOF-steps1-2.json`)
  - line 13 — `779a8f1bcb20107c61b256ba587336405bab9b14c377dc7d09e88c0bbf946b9d  evidence/validator-step3-output.txt` (4994 B; byte-identical to `validator-steps1-2-output.txt`)
  - line 22 — `5682a7f4d89e98461cfdfdb90410d10a9e7678c81ae6266db53ff35fa8b526f3  source/Update-Step3-Records.ps1` (current file now CRLF, see §12.2)
- **The 19-entry manifest file was not independently retained.** Its bytes are a derivation from the retained 22-entry file, confirmed only by hash equality with the cited value; it is not claimed as a retained artifact and no copy is created as one.
- **Missing Step 3 validator references:** §11.6 states that `SATURATION_PROOF-step3.json` / `validator-step3-output.txt` "are hashed in the board/backlog Step 3 status line". They are not: neither the board `STEP_3` field nor the backlog Step 3 item contains those hashes, and the 22-entry manifest hash `08c722bf…` was recorded nowhere before this section. Their hashes are as listed above.

### 12.7 Disposition 5 — historical limitations (no replacements manufactured)

- **No pre-execution hash of the §§0–10 freeze text** was recorded. Preservation of the freeze cannot be proven cryptographically for the pre-execution period. Supporting (non-cryptographic) evidence: §10 records the pre-fix `Run-Case.ps1` hash `a73d38f5…`, and reversing the `Hlog`→`H` rename in the derived LF `Run-Case.ps1` reproduces exactly that hash (9125 B), indicating §10 was written before the harness fix. The current LF-normalized §§0–10 hash (`2cd4342e…`, §12.1) is a post-hoc reference only.
- **Static-check outputs** (`bash -n`, `Add-Type`, Job Object create) and the **failed-launch output** were not retained. No substitute outputs are produced.
- **`evidence\batch.json` account.** Established from existing evidence: the on-disk `batch.json` (217 B, `94137cd4…`) was created by the A-1 run itself — `batchStartUnix` 1790866719.78752 lies between `CASE-BEGIN` 1790866719.753370 and `BATCH-CHECK` 1790866719.833080 (`elapsed=0.038 s`), and `Run-Case.ps1` creates the file only when absent; so no `batch.json` existed when the A-1 run reached its batch check. Not established: whether a `batch.json` existed after the failed launch and was removed, as §11.5 states. The derived pre-fix harness calls the logging function at line 28, before `batch.json` creation at line 32, which conflicts with that account, but the failed launch left no retained output. **Provenance of the removal account: UNRESOLVED.** The batch clock used for the 30 min bound is valid either way.

### 12.8 Disposition 6 — explicit corrections (the corrected text in §§0–11 is left in place)

1. **Unsupported Linux wording.** §11.2 "This is bash semantics of the frozen shape (bash 5.2.15 here; not Windows-specific in mechanism)" is corrected to: *the behaviour was observed in MSYS bash 5.2.15 on Windows; nothing is concluded about Linux bash or any other environment.* §5 and §12.3 govern transfer.
2. **Undeclared supervisor substitution.** H-1 names "the existing INVENTORY-01 supervisor as backstop", and the reviewed proposal described a harness "over the existing supervisor class (modified copy, not the retained DLL)". Stage A used a new harness (`source\Run-Case.ps1`) and a new Job Object adapter (`source\AisbJob.cs`, pattern copied from INVENTORY-01 §13.4); the INVENTORY-01 supervisor was not used. §5 did not declare this. Effect: none on the A-1 criterion; the backstop element of H-1 was not exercised.
3. **Cap-location wording.** §5 states the per-case tightened caps are "recorded per case in `harness.log` ENV line". For A-1 the ENV line records only the explicitly passed keys (`AISB_FILTER_FORCE_RC_ERR=3`, `AISB_FILTER_SLEEP_ERR=3`, `AISB_HOST_BUDGET_SEC=15`, `AISB_PER_CMD_CEIL_SEC=3`). The per-channel caps 2048 B / 60 L (`AISB_OUT_CAP_B/L`, `AISB_ERR_CAP_B/L`) and `GO_WAIT_SEC=8` were not in the ENV line; they are the defaults in the frozen `candidate.sh` (lines 10–12).
4. **Proposal comparison wording.** §9 ("identical to the reviewed proposal") and the Step 2 records ("cases A-1…A-8 identical to the reviewed proposal") are corrected to: *A-2, A-3, A-5 and A-8 are identical; A-1 adds a `$!` pid-provenance clause to the criterion (FAIL-if unchanged); A-4's criterion and FAIL-if were corrected per condition 6; A-6 adds named stop events and exec markers; A-7 adds the prohibition on killing the simulated remote through the outer Job Object per condition 3; a Run-gating column was added per condition 2.* The changes are those authorized by conditions 2, 3 and 6.
5. **Stale MUTEX field.** Board `PM2_RECOVERY_MECH_EXP_01_MUTEX` said GOVERNANCE was "to be acquired transiently again for the Step 3 end-status record". That was future tense at Steps 1–2; the Step 3 record has since been written with GOVERNANCE released UNOWNED. The field is updated in this step and marked as corrected.

### 12.9 Status after this reconciliation

- Experiment completion: unchanged (A-1 RUN; A-2…A-8 NOT RUN).
- Candidate result: §12.3. Execution compliance: FAIL for condition 7 (§12.4). Artifact integrity: A-1 evidence verifies byte-for-byte; 8 source / fixture files differ from `SHA256SUMS` in current bytes and match only as derived LF copies (§12.2).
- Readiness: not produced. Inspection-mechanism host use remains BLOCKED. AMENDMENT-02 and PRIV-INSPECTION-01 §17 unchanged. Stage B NOT AUTHORIZED.
- **Closure eligibility: PENDING final review. NOT LOCKED.**

### 12.10 Activity ledger for this reconciliation and review export

Executions in this step: read-only inspection, hashing and Git read commands; this §12 append and board / backlog field writes; the lane-capacity validator with its proof written to `stage-a\evidence\review-export\validation\`; documentation / hash / diff checks; native `git diff` output to files; creation of the export bundle. No experiment, probe, candidate, harness, fixture, Docker, WSL, sudo, SSH, network, package, application runtime, host access, subagent, restoration, Git stage / commit / push / reset / restore / clean. During read-only inspection one reviewer command failed because a helper function named `H` was shadowed by the PowerShell alias `h` (`Get-History`) — the same precedence mechanism recorded in §11.5; it had no file effect. Export: `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\stage-a\evidence\review-export\` (bundle, separate export manifest `EXPORT-SHA256SUMS`, and `BUNDLE.sha256` beside the bundle; the bundle hash is not written into repository records because the bundle contains this file and the record diffs).

## 13. Step 4 completion — experiment record COMPLETE AND LOCKED as a failed experiment record (2026-10-02) — appended; §§0–12 are not edited

**Authorizations (Keith, 2026-10-02):** (a) completion of Step 4 and locking of the experiment record — the first attempt was interrupted after writing only `TASKS_BACKLOG_FULL.md` (§13.7); (b) controlled forward completion of that interrupted closure, documentation only. This closes a failed experiment. It does not approve the candidate, does not excuse or waive any execution deviation, and grants no readiness, Stage B, host or retroactive authority. No experiment, probe, fixture execution, implementation, redesign, host access, installation, normalization, rollback, Stage B, successor registration, Git staging / commit / push / reset / restore / clean, or subagents. GOVERNANCE was acquired for the controlled-completion writes of this section and the matching board / backlog records (not backdated), then released UNOWNED. §12's "closure eligibility PENDING final review" is superseded by this section; §12 itself is not edited.

### 13.1 Inputs

#### 13.1.1 Initial-attempt inputs (verified before the first attempt's only write)

| Input | Expected | Observed |
|---|---|---|
| HEAD | `f24850bcb70c82dc72baa479d1c24969fc177f3d` | match |
| This stage-start (§§0–12, CRLF) | SHA-256 `3d62c408e25e224367418b918e389fc1765e85a5f46623e9b4a5df8e57ad2599`, 46652 B | match |
| `TASKS.md` | SHA-256 `0a04a5171c446a364e1e4b1916dd13b5906e01815d1203a3f17b8f5ff2defd94` | match (4309452 B) |
| `TASKS_BACKLOG_FULL.md` | SHA-256 `8dece4f7f65dea045a8e2086b5be67cd15d93196fdc83e8a5538ca33ab87b53b` | match (5824293 B) |
| Reviewed input package `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\stage-a\evidence\review-export\PM2-RECOVERY-MECH-EXP-01-stage-a-review-export-2026-10-02.zip` | SHA-256 `2891126c3d35ead91b5afeaa09ce273ae13fbc9be48db8161b6e67dc920ee273` | match (334839 B) |
| Inherited repository `docs/control-plane/SATURATION_PROOF.json` | blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` | match |

These rows were enforced by the first attempt's fail-closed checks; that run's output is retained only as a conversation copy (§13.7).

#### 13.1.2 Completion inputs (verified before any completion write)

| Input | Expected | Observed |
|---|---|---|
| HEAD | `f24850bcb70c82dc72baa479d1c24969fc177f3d` | match |
| This stage-start (§§0–12, CRLF) | SHA-256 `3d62c408e25e224367418b918e389fc1765e85a5f46623e9b4a5df8e57ad2599`, 46652 B | match (unchanged since the initial attempt) |
| `TASKS.md` | SHA-256 `0a04a5171c446a364e1e4b1916dd13b5906e01815d1203a3f17b8f5ff2defd94` | match (unchanged since the initial attempt) |
| `TASKS_BACKLOG_FULL.md` (partially written by the first attempt) | SHA-256 `b85ad3e6f03a704854184501241bf2ce46736a6a665ecd1c0c0c13ef87959261` | match (5827685 B; differs from the initial-attempt input `8dece4f7…`) |
| Interrupted-review package `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\step4-interrupted-review-export\PM2-RECOVERY-MECH-EXP-01-step4-interrupted-review-2026-10-02.zip` | SHA-256 `96dc547a1541ed5a70f6e93703fdf6da110c261028b5153a299fb6ae604fd55c` | match |
| Reviewed input package (as in §13.1.1) | SHA-256 `2891126c3d35ead91b5afeaa09ce273ae13fbc9be48db8161b6e67dc920ee273` | match |
| Export manifest `review-export\EXPORT-SHA256SUMS` | SHA-256 `4b4be009a883ff84863f685cedc6fad84ed31b176b478db441708471659eb3ca`, 47 entries | match; 47 / 47 entries match the reviewed ZIP's entries |
| Original manifest `stage-a\SHA256SUMS` | SHA-256 `08c722bf533107dd51716fcd79024aa95835660c1bdbb2474974b4775d59174d`, 22 entries | match; 14 entries match current bytes, 8 match only as derived LF copies |
| Inherited repository `docs/control-plane/SATURATION_PROOF.json` | blob `50ce410efe547a7e24f06ef75b9410916d5dae8a` | match |

### 13.2 Final dispositions (separate conclusions)

1. **Experiment record review: ELIGIBLE FOR CLOSURE.** The record (§§0–12, the original manifest and the files it covers, the derived LF copies, and the reviewed input package) supports the conclusions below with the limitations in §13.4.
2. **Experiment task: COMPLETE AND LOCKED as a failed experiment record.** The lock closes the record. It is not an approval of the candidate, not a readiness result, and not a waiver.
3. **A-1: decisive FAIL** for the exact tested capture shape `cmd </dev/null 2> >(cap ERR) | cap OUT; ps=("${PIPESTATUS[@]}"); fpid=$!; wait "$fpid"` on the Windows/MSYS fixture (MSYS bash 5.2.15). Not generalized to Linux, sudo, termination behaviour, survivors, the 15 s / 120 s ceilings, or other mechanisms (§12.3).
4. **Execution compliance: FAIL for condition 7** (stop after the first decisive FAIL). **Recorded, not waived.** The formal case sequence ended after A-1, but unauthorized post-failure diagnostic probes (`source\diag-shape-probe.sh`, probes 1–4; unfrozen; outside the Job Object) followed. The execution as a whole therefore did **not** obey the stop rule. Wording elsewhere in this task's records such as "ENDED BY RULE AT A-1" or "Stage A ended early by rule" describes the formal case sequence only and is qualified by this finding. The lock preserves the finding and grants no retroactive authorization (§12.4).
5. **A-2, A-3, A-4, A-5, A-6, A-7, A-8: NOT RUN as formal cases.** Disclosure retained: the post-failure probes investigated subjects of A-2 (stale `$!`) and A-3 (stderr-filter output reaching the stdout pipe); neither is a case result (§12.5).
6. **Evidence state.** Of the 22 entries in the original `SHA256SUMS`, **14 match current bytes**. **8 match only as explicitly derived LF copies** (`review-export\stage-a-derived-lf\`, derived on 2026-10-02 by removing each CR immediately preceding an LF); the current CRLF bytes of those 8 files (`source\candidate.sh`, `source\Run-Case.ps1`, `source\AisbJob.cs`, `source\toolcheck.sh`, `source\diag-shape-probe.sh`, `source\Register-Records.ps1`, `source\Update-Step3-Records.ps1`, `fixtures\util.sh`) **differ from the original manifest and do not pass it** (per-file hashes in §12.2). **Export manifest: 47 / 47.** The cited 19-entry manifest `ab7d8007…` remains a derivation from the retained 22-entry file, not a retained artifact (§12.6).
7. **Readiness produced: NO. Host use: BLOCKED. Stage B: NOT AUTHORIZED.**

### 13.3 Preserved unchanged by this step

Both reviewed packages (the Stage A review-export ZIP with `EXPORT-SHA256SUMS` and `BUNDLE.sha256`, and the interrupted-review ZIP with its `SHA256SUMS`), the original `SHA256SUMS`, the current Stage A files (including the 8 CRLF files), the derived LF copies, all source, fixtures and execution evidence, the first attempt's `stage-a\evidence\step4-closure\` contents (including `Apply-Step4-Lock.ps1`, its §13 fragment and `record-edits.json`), the first attempt's pre-write snapshots, and the backlog's partial-write rows. The first 46652 bytes of this file (§§0–12, CRLF, including the 27525 bytes found on disk before §12) are retained unchanged; this §13 is appended after them in CRLF. Locked predecessors, PRIV-INSPECTION-01 §17, the sidecar, the mutex catalog, the occupancy block and the inherited repository `SATURATION_PROOF.json` are not modified.

### 13.4 Historical limitations that remain at lock

- No pre-execution hash of the §§0–10 freeze text (§12.7).
- Static-check (`bash -n`, `Add-Type`, Job Object create) and failed-launch outputs were not retained; no substitutes exist (§12.7).
- The `evidence\batch.json` removal account remains UNRESOLVED; the on-disk `batch.json` was created by the A-1 run (§12.7).
- The cause of the LF→CRLF conversion of this stage-start and the 8 Stage A files remains UNKNOWN; 2026-10-02 09:56:20 (UTC+8) is an observed last-write timestamp, not a proven conversion time (§12.1–12.2). Reported evidence from the Step 4 investigation: Cursor local history holds entries with source "Undo Create Diff" at that time whose stored snapshots match the current CRLF bytes of this stage-start and six of the eight files. That is reported evidence only; it does not prove who or what triggered the operation. This matter is separate from the Step 4 script matter in §13.7. The same observation for INVENTORY-01 evidence remains reported only, outside this task.

### 13.5 Gates and non-effects

No successor is registered. Recovery gates are unchanged: AGENT-PLATFORM-EXEC-01C6A `startCondition=NOT_READY`; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED. This task attests nothing about host cleanliness, satisfies no reopen gate, and does not reopen EXEC-01C6A. AMENDMENT-02 remains a locked decision record; PRIV-INSPECTION-01 §17 remains PROPOSED / NOT ADOPTED. Lane 3 DISABLED unchanged; occupancy EMPTY unchanged.

### 13.6 Activity ledger for Step 4

- **First attempt (interrupted):** one execution of `Apply-Step4-Lock.ps1`, which wrote only `TASKS_BACKLOG_FULL.md` (§13.7). It did not write this section or `TASKS.md`, ran no lane-capacity validator and recorded no GOVERNANCE board entry.
- **Read-only investigation and the interrupted-review export** (outside the repository).
- **Controlled completion:** this §13 append and this task's `TASKS.md` fields, plus one appended correction / completion row in `TASKS_BACKLOG_FULL.md`. The backlog's earlier replacements and lock rows were not applied a second time. Post-write full-content checks, documentation diff / encoding checks and the lane-capacity validator are run after these writes; their results are recorded in `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\step4-completion-export\`, not asserted in this section.
- Experiment / probe / fixture / candidate / harness executions = 0; reruns of `Apply-Step4-Lock.ps1` = 0; restorations / normalizations / rollbacks = 0; implementation = 0; host access = 0; installation = 0; Stage B = 0; successor registration = 0; subagents = 0; Git stage / commit / push / reset / restore / clean = 0.

### 13.7 Interrupted first attempt and its correction

- **What it wrote.** The first attempt wrote only `TASKS_BACKLOG_FULL.md` (observed last-write time 2026-10-02 11:06:18.644 UTC+8): the Status line, the Step 4 item, and two appended rows ("Step 4 lock record", "Step 4 lock activity ledger"). It changed that file from `8dece4f7…` to `b85ad3e6…`. Its lock text did not establish closure.
- **The executed script.** `stage-a\evidence\step4-closure\tools\Apply-Step4-Lock.ps1` (SHA-256 `72ab2d8fbf03ac221666e72a49b5994dd9d672d2dd07590d4a330e583a388f5c`, 6430 B) is the executed version with two omitted writes. It built the §13 append and the `TASKS.md` output but never wrote them, printing "(pending write)" for both. Its post-checks verified preserved prefixes only and did not verify completion. It is preserved unchanged and was not rerun.
- **What it did not do.** It ran no lane-capacity validator and completed no GOVERNANCE board record. The backlog activity-ledger statements that the validator was run and that GOVERNANCE was acquired and released are superseded by the correction row and by this section.
- **Alteration.** External alteration of the script is UNESTABLISHED: no independent intended version was retained, and file timestamps do not establish a cause.
- **Run output.** Its output is retained only as a conversation copy, transcribed in the interrupted-review package (`run-output\apply-run-output.CONVERSATION-COPY.txt`). It is not independently captured stdout.
- **Completion.** Completion used a new operation over prepared full output bytes, with full-content comparison after writing. The partial-write backlog history is preserved.
