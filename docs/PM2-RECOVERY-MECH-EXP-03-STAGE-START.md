# PM2-RECOVERY-MECH-EXP-03 — Stage-start (Step 1 registration + Step 2 scope freeze) — bounded local experiment on the H-3 aggregate-capture hypothesis, single case C-1

**Task:** PM2-RECOVERY-MECH-EXP-03
**Nature:** GOVERNANCE / EVIDENCE (off-repo tooling route, AMENDMENT-02 §10; no implementation lane; no sidecar candidate; `AISB_MACHINE_REG_V1 nature=GOVERNANCE`)
**Lifecycle:** 4-step (Step 1 registration → Step 2 this freeze → Step 3 execution of the single case C-1 [NOT AUTHORIZED by this window] → Step 4 independent review and lock of the *experiment record*, never of readiness [NOT AUTHORIZED by this window])
**Authorization (Keith, 2026-10-02):** Steps 1–2 only — registration, scope freeze, new off-repository candidate and case-specific assertion script implementing the reviewed conservative full-allocation design, byte-identical copies of the harness / Job Object / utility sources, static syntax checks, required documentation validation, hashes, review package. **No candidate, harness, fixture, assertion, probe or runtime execution.** No host access, Stage B, predecessor edit, acceptance, lock or Git mutation. Execution requires separate authorization.
**Baseline:** HEAD `946050ca89addc8b497f378dcb1470e33286b7b6`; working tree carries only the inherited `M docs/control-plane/SATURATION_PROOF.json` (blob `50ce410efe547a7e24f06ef75b9410916d5dae8a`), preserved unmodified; validator proofs for this task are written outside the repository.
**Evidence class:** LOCAL-TESTS. **Mutexes:** GOVERNANCE transiently for record writes only. No STAGING, LOCAL-RUNTIME, PROVIDER-LIVE, ENV, CREDIT.
**Write scope:** this file; required `TASKS.md` / `TASKS_BACKLOG_FULL.md` registration and status records; `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\stage-a\` (source, fixtures, evidence, hashes, review package). Nothing else. The locked `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-01\` and `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-02\` trees, their packages and all historical evidence are read-only inputs and are not modified.

## 0. What this task is not

- Not a host-inspection successor. Not a Stage B authorization. Not a mechanism-readiness approval. Not a reopening or amendment of PM2-RECOVERY-MECH-EXP-01 or PM2-RECOVERY-MECH-EXP-02 (both COMPLETE AND LOCKED as experiment records). Not an adoption of PRIV-INSPECTION-01 §17 (PROPOSED / NOT ADOPTED). Not a change to AMENDMENT-02 (LOCKED) or any other locked predecessor.
- Inspection-mechanism host use remains BLOCKED. Readiness remains BLOCKED under AMENDMENT-02 §6.3 (C2) and §8.5 (5). No local result from this task changes either.
- A new exploratory local experiment on a new hypothesis (H-3). Origin: MECH-EXP-02 §17.4 found that B-1's `STOPPED CAP` came from an injected filter status, not from a cap; §17.7 records that B-1 established nothing about the 65536 B / 2000 L aggregate or the cap mechanism itself. MECH-EXP-02's sources stay as frozen; this task uses new sources in a new tree.
- Produces, if ever executed, class T evidence about a Windows/MSYS fixture only.

## 1. Hypothesis under test (UNVERIFIED; frozen verbatim)

H-3: with the H-2 per-command capture shape, re-plumbed so that the stderr filter writes to a saved channel-stderr descriptor (fd 4) and the parent's fd 2 is `/dev/null`,

```
{ cmd </dev/null 2>&3 4>&- | cap OUT ... 3>&- 4>&-; ps=("${PIPESTATUS[@]}"); } 3> >(cap ERR ... >&4 4>&-); fpid=$!; wait "$fpid"
```

a parent that, before each dispatch, (a) computes a stdout slice and a stderr slice (bytes and lines) from a session pool initialised at 65536 B / 2000 L less a fixed session reservation, (b) debits both slices plus a fixed per-command reservation from that pool and never credits any unused allocation back (**conservative full-allocation session charging**), and (c) passes the slices to the two filters, keeps everything the candidate writes to channel stdout and channel stderr within 65536 B / 2000 L for the whole session. A filter whose slice would be exceeded by the next record passes no further records, writes one bounded marker, reads and discards its input to EOF and exits 3 (**slice exhaustion**). The H-2 positive-confirmation gate then records `STOPPED CAP` and dispatches no subsequent command.

CAP in this task means **slice exhaustion under conservative session charging**. It does not mean that the actual 65536 B channel total was reached: under full charging the session pool is consumed by allocations, not by bytes written. It does not mean that a producer was terminated: the exhausted filter drains its producer to EOF, and the producer runs to completion.

Compliance criteria are not redefined. Ceilings (shared contract): 15 s per command, 120 s session, 65536 B / 2000 L aggregate (PRIV-INSPECTION-01 §6.3). AMENDMENT-02 §6.3 (C2) readiness rule unchanged. An observation that cannot establish a criterion is INCONCLUSIVE-EVIDENCE, never PASS.

## 2. Result dimensions, kept apart

1. **Experiment completion** — whether C-1 ran, artifacts hashed. 2. **Candidate result** — C-1 verdict per §11 precedence. 3. **Readiness** — never produced by this task.

## 3. Frozen conditions

MECH-EXP-02 §3 conditions are carried over as applicable, adjusted as follows:

1. Stage A only; Windows-local; unprivileged; existing local PowerShell / MSYS tools; no Docker, WSL, sudo, SSH, network, package installation, host contact, application runtime or subagents.
2. **Exactly one case, C-1.** No additional cases, probes, retries or design expansion. The candidate and assertion script are not edited after this freeze.
3. Harness protection (Job Object, watchdog, retention budget, reader timeout) is not part of the candidate mechanism; harness intervention never produces PASS (§11).
4. Bounds: 180 s per case watchdog; one shared 256 KiB retained budget for candidate stdout + stderr; 30 min batch; candidate channel output bounded by the candidate at 65536 B / 2000 L (§8); diagnostic logs accounted separately.
5. Instrumentation, clock source and uncertainty frozen in §6. Fixture markers are not OS-observed exec events.
6. Every dispatched producer must return 0; there is no expected-error bypass.
7. **No follow-on probe, rerun or redesign after the first decisive outcome.** A FAIL, CASE-INVALID or INCONCLUSIVE-EVIDENCE verdict ends candidate testing under this task; the result is recorded and hashed.
8. Cleanup is limited to test-owned processes and the task directory; evidence is preserved; no whole-computer claim.

## 4. Environment (observed in MECH-EXP-01; not re-run here)

As MECH-EXP-02 §4: MSYS bash 5.2.15(1)-release (`C:\Program Files\Git\usr\bin\bash.exe`), GNU coreutils 8.32 `timeout`, `EPOCHREALTIME`, process substitution with `/dev/fd`, Windows PowerShell 5.1, .NET `Add-Type`. This window's static check re-read only the bash version string (§15). The candidate's `OPTS` line re-records shell options and constants at execution time (§10 S1).

## 5. Declared deviations

### 5.1 From the host form of H-3

| Host form | Stage A fixture | Consequence |
|---|---|---|
| `ssh -T … bash -s` with the block on stdin | local `bash.exe candidate.sh`; harness pipes GO on stdin | ssh stdin/EOF behaviour NOT tested |
| `timeout -s TERM -k 1 14 sudo -n timeout -s TERM -k 1 13 <utility>` | `timeout -s TERM -k 1 14 timeout -s TERM -k 1 13 bash util.sh` (no sudo; fixture utility) | sudo relay, root survivors, Linux signal semantics NOT tested |
| host 15 s / 120 s | per-command ceiling 15 s, session budget 120 s, supplied via environment | deadlines are configured, not exercised (§5.2) |
| bash process substitution backed by `/dev/fd/N` | `/dev/fd` present locally | backing is platform-dependent and NOT assumed for H (MECH-EXP-02 §5 carried forward) |
| here-strings (`<<<`) for the plan and per-spec split | bash 5.2 may back a here-string by a pipe or a temporary file | a temporary file would be a remote write on H; NOT tested; carried forward from MECH-EXP-02 |
| independent OS exec observation | none; `UTIL-EXEC` is a fixture marker | exec evidence is marker-based |
| local `ssh.exe` termination | not simulated | local termination does not prove remote termination |

### 5.2 Changes from B-1 (MECH-EXP-02 §9.1), frozen explicitly

| Parameter | B-1 | C-1 (this freeze) |
|---|---|---|
| Wrapper (each command) | `timeout -s TERM -k 1 3 timeout -s TERM -k 1 2` | `timeout -s TERM -k 1 14 timeout -s TERM -k 1 13` |
| `AISB_PER_CMD_CEIL_SEC` | `3` | `15` |
| `AISB_HOST_BUDGET_SEC` | `15` | `120` |
| `-WatchdogSec` | `60` | `180` |
| Filter test knobs | `AISB_FILTER_SLEEP_ERR=3`, `AISB_FILTER_FORCE_RC_ERR=3` | removed from the candidate; not supplied |
| Capture limits | per-channel 2048 B / 60 L from environment (defaults) | session-charged slices from hard-coded constants (§7.3); not configurable |
| Defaults for budget / ceiling | `15` / `3` if unset | none; unset or malformed → `SETUP-FAIL`, exit 6, before READY |
| Evidence root | MECH-EXP-02 tree | MECH-EXP-03 tree, supplied explicitly with `-Root` (§9.3) |

These values are chosen so that, on this fixture, no deadline is expected to end C-1 before the gate is exercised. **They do not establish timeout enforcement**, 124 / 137 propagation, the 15 s / 120 s deadlines or the HOST-DEADLINE branch. A deadline outcome in C-1 is TIMING and gives INCONCLUSIVE-EVIDENCE, never PASS and never a defect. The 180 s watchdog is harness protection only (it exceeds the 120 s candidate budget so that a normal candidate stop precedes it).

## 6. Clock source, instrumentation, uncertainty (frozen)

- As MECH-EXP-02 §6: audit lines `<EPOCHREALTIME> <writerPid> <EVENT> <detail>`; the unchanged `util.sh` writes `<t> UTIL-<EVENT> <detail>`. File order among lines with the same writer pid is that writer's program order; cross-writer order is never read from file position.
- New candidate events: `SETUP-FAIL`, `SETUP-OK`, `ALLOC`; `FILTER-START` / `CAP-HIT` / `FILTER-EOF` / `FILTER-EXIT` now carry `idx`, and `FILTER-START` carries the slice (`maxl`, `maxb`); `CAP-HIT` / `FILTER-EOF` carry passed counts; `SCRIPT-END` carries the remaining pool.
- **No timing requirement on successful `wait`.** No wall-clock separation is asserted between candidate events.
- **Cross-clock band (20 ms):** used only for the intervention rule (§11 rule 3), comparing audit `EPOCHREALTIME` with the harness `DateTime.UtcNow` Unix seconds. Captured stdout / stderr files are untimed and never qualify under that rule.
- Harness lines: `DateTime.UtcNow` Unix seconds plus a monotonic `Stopwatch` (`sw=`). No execution-speed assumption is made anywhere in §10.

## 7. Mechanism design (frozen)

### 7.1 Descriptors

| Process | fd 0 | fd 1 | fd 2 | fd 3 | fd 4 |
|---|---|---|---|---|---|
| parent (after setup) | harness stdin (GO) | channel stdout | `/dev/null` | not open | channel stderr (saved by `exec 4>&2`) |
| producer (wrapper → `util.sh`) | `/dev/null` | pipe → OUT filter | pipe → ERR filter (`2>&3`) | pipe → ERR filter | closed (`4>&-`) |
| OUT filter (pipeline element) | pipe from producer | channel stdout | `/dev/null` | closed (`3>&-`) | closed (`4>&-`) |
| ERR filter (process substitution, forked by the parent) | pipe from the group's fd 3 | channel stderr (`>&4`) | `/dev/null` | not open | closed (`4>&-`) |

Setup is two checked steps, `exec 4>&2` then `exec 2>/dev/null`; either failure writes `SETUP-FAIL step=…` and exits 5 before READY. The only channel writers are the parent (READY, RC, STOPPED, END on fd 1), the OUT filter (records and marker on fd 1) and the ERR filter (records and marker on fd 4). Bash diagnostics from the parent and filters go to `/dev/null`; wrapper and utility stderr go into the ERR filter. Static review only: bash may hold saved close-on-exec copies of descriptors around function-call redirections; the filters exec nothing, and the producer applies its redirections in the forked child before exec. None of this is established by `bash -n` (§13 finding 3).

### 7.2 Inputs (validated before READY)

`AISB_AUDIT` non-empty (else exit 6 with no audit); `AISB_NONCE` 16 lowercase hex; `AISB_PLAN` non-empty; `AISB_UTIL` readable; `AISB_HOST_BUDGET_SEC` and `AISB_PER_CMD_CEIL_SEC` `^[1-9][0-9]{0,3}$` with no default; `AISB_GO_WAIT_SEC` default 8, `^[1-9][0-9]{0,2}$`. Any failure writes `SETUP-FAIL step=inputs bad=[…]` and exits 6 before READY. Success writes `SETUP-OK`, then `OPTS`.

### 7.3 Constants, reservations, allocation

Hard-coded: `B_MAX=65536 L_MAX=2000`; session reservation `SES_B=104 SES_L=3`; per-command reservation `CMD_B=117 CMD_L=3`; per-command maxima `OUT_MAX 40000 B / 1000 L`, `ERR_MAX 10000 B / 250 L`; `MIN_SLICE=2`. Pool starts at `REM_B=65432 REM_L=1997`.

Reservation sizes (bytes include LF): session = `READY <16hex>` 23 + `STOPPED <reason ≤ 25>` 34 + `END <16hex> <reason ≤ 25>` 47 = 104 B / 3 L. Per started command = `RC <≤3> <≤3> <≤3> <≤3>` 19 + two markers `--- TAG-CAP-TRUNCATED lines=<≤4 digits> bytes=<≤5 digits> ---` 2 × 49 = 117 B / 3 L.

Per command, after the STOPPED check and the HOST-DEADLINE check:

```
avB = REM_B − 117 ; avL = REM_L − 3
if avB < 2 or avL < 2: STOP-EVENT BUDGET-EXHAUSTED; print STOPPED BUDGET-EXHAUSTED; NOT-STARTED; return   # global exhaustion, before dispatch
oB = min(40000, ⌊avB·4/5⌋) ; eB = min(10000, avB − oB)
oL = min(1000,  ⌊avL·4/5⌋) ; eL = min(250,   avL − oL)
REM_B −= oB + eB + 117 ; REM_L −= oL + eL + 3                                                   # debit before dispatch; never credited
ALLOC idx oB eB oL eL chargeB chargeL remB remL
```

Because `eB ≤ avB − oB` and `eL ≤ avL − oL`, each charge is at most the remaining pool, so the pool never goes negative and the sum of charges never exceeds 65432 B / 1997 L.

### 7.4 Parent / filter status flow

```
cap TAG IDX MAXL MAXB:                       # pl=0 pb=0 l=0 b=0 in every instance (locals)
  FILTER-START tag idx pid maxl maxb
  for each input record (LF-terminated on output):  l++, b += len+1
    if hit: discard; continue
    if l > MAXL or b > MAXB: hit, rc=3; CAP-HIT (lines bytes passed_lines passed_bytes); print marker with pl pb; continue
    print record; pl=l; pb=b
  FILTER-EOF (rc lines_seen bytes_seen passed_lines passed_bytes); FILTER-EXIT rc; return rc   # rc ∈ {0,3}

runcmd idx:
  STOPPED? → NOT-STARTED.  HOST-DEADLINE? → stop.  BUDGET-EXHAUSTED? → stop.  allocate + debit (§7.3)
  prev=$!; PRE-EXEC
  { producer | cap OUT idx oL oB ; ps=(PIPESTATUS) } 3> >(cap ERR idx eL eB >&4)
  fpid=$!; PIPE-RETURN; wait fpid → se (only if fpid non-empty and ≠ prev); WAIT-RETURN
  RC line: each field printed only if valid (status 0..255, idx 1..999), else NA            # bounded to 19 B
  gate: fpid missing/reused → FILTER-STATUS-UNAVAILABLE; n≠2 → MALFORMED-PIPESTATUS-n<≤3 digits|X>;
        malformed ps0/ps1/se → MALFORMED-*; ps0 124/137 → TIMEOUT-*; ps0≠0 → OTHER-ERROR-ps0;
        ps1=3 or se=3 → CAP; other non-zero → FILTER-STATUS-ps1/se; else DISPATCH-OK
  on stop: STOP-EVENT; STOPPED=reason; print STOPPED reason once
```

Changes outside `cap` / `runcmd` that the design actually requires: the checked descriptor setup, input validation and constants (preamble); `SETUP-OK` before READY; removal of the B-1 filter knobs; `SCRIPT-END` carrying the remaining pool. READY / GO / END handling is unchanged.

### 7.5 Channel bound (static argument; not established by a test)

Every channel line is one of: a READY / STOPPED / END line (session reservation; STOPPED is printed at most once because a set `STOPPED` diverts every later command to NOT-STARTED; the NO-GO and BAD-GO branches print READY and one END only); an RC line or marker of a started command (per-command reservation, debited before the command starts); or a record passed by a filter within its slice. Records passed are bounded by `pl ≤ maxl` and `pb ≤ maxb` with LF counted. Commands that do not start write no RC, no marker and no record. Hence channel bytes ≤ 104 + Σ charges ≤ 65536 and channel lines ≤ 3 + Σ charges ≤ 2000. Pre-READY failures write nothing to the channel except whatever bash itself prints if `exec 4>&2` fails before fd 2 is redirected; that branch exits before READY and cannot PASS (§11 rule 1).

## 8. Bounds and containment (frozen)

- **Harness (unchanged source):** `-WatchdogSec 180`; one shared retained budget of 262144 B across candidate stdout + stderr (expected C-1 volume 61282 B, so `RETENTION` is not expected); 256 B READY prefix; `READER-TIMEOUT` at exit + 5 s; `HARD-ABANDON` at watchdog + 10 s; 30 min batch via `evidence\batch.json` (created by the harness at run time; it does not exist now).
- **Job Object:** `source\AisbJob.cs`, byte-identical to MECH-EXP-02 (and MECH-EXP-01). Assignment immediately after `Process.Start`, before GO; GO refused if assignment fails.
- **Cleanup:** as MECH-EXP-02 §8, with `Assert-C1.ps1` writing exactly one new file, `assertions.json`, and refusing to overwrite it. Only test-owned processes and the task directory are touched. Evidence is never deleted.

## 9. Case C-1 (the only case)

### 9.1 Plan and parameters

| Item | Value |
|---|---|
| Plan | `c1\|W\|--out 800 --err 200 --bytes 40`, then `c2\|W\|--out 400 --err 0 --bytes 40`, then `c3\|W\|--out 1 --err 0 --bytes 40`, where `W` = `timeout -s TERM -k 1 14 timeout -s TERM -k 1 13` |
| Producers | `util.sh` records `O%06d` / `E%06d` + space + 40 × `x` + LF = 49 B each; all stdout before stderr; exit 0 (`rc=0`; no `--rc`, `--hang`, `--pidgone`, `--ignore-term`) |
| Env (`-Env`) | exactly `AISB_HOST_BUDGET_SEC=120 AISB_PER_CMD_CEIL_SEC=15` |
| GO | VALID, delay 0 |
| Harness | `-Root` = the MECH-EXP-03 `stage-a` tree; `-WatchdogSec 180 -RetainBytes 262144 -ReadyPrefixBytes 256` |
| Expected | c1 fits its slices (no CAP-HIT, DISPATCH-OK); c2's OUT slice is exhausted at record 249; gate records `STOPPED CAP` at idx 2; c3 is NOT-STARTED; `SCRIPT-END CAP remB=0 remL=0` |

### 9.2 Worked budget (conservative full-allocation charging)

| idx | avB / avL | oB | eB | oL | eL | chargeB | chargeL | remB | remL | volume | outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | 104 | 3 | 65432 | 1997 | session reservation | — |
| 1 | 65315 / 1994 | 40000 | 10000 | 1000 | 250 | 50117 | 1253 | 15315 | 744 | OUT 800 L / 39200 B; ERR 200 L / 9800 B | fits: 39200 ≤ 40000, 800 ≤ 1000; 9800 ≤ 10000, 200 ≤ 250 |
| 2 | 15198 / 741 | 12158 | 3040 | 592 | 149 | 15315 | 744 | 0 | 0 | OUT 400 L / 19600 B; ERR 0 | OUT slice exhausted by bytes: 248 × 49 = 12152 ≤ 12158 < 12201 = 249 × 49 (lines 249 ≤ 592) |
| 3 | — | — | — | — | — | — | — | 0 | 0 | — | NOT-STARTED reason=CAP (STOPPED check precedes allocation) |

Slice exhaustion vs global exhaustion: c2's CAP is **slice exhaustion** — its OUT slice is 12158 B because c1's full allocation, not c1's 49000 B of actual output, was charged. The actual channel total stays at 61282 B, well under 65536 B. **Global exhaustion** (`BUDGET-EXHAUSTED`) is the separate pre-dispatch stop when `avB < 2` or `avL < 2`; after c2 the pool is 0 / 0, but c3 is diverted by the earlier `STOPPED CAP` first, so C-1 does not exercise `BUDGET-EXHAUSTED`.

Expected filter events: idx 1 OUT `FILTER-EOF rc=0 lines_seen=800 bytes_seen=39200 passed_lines=800 passed_bytes=39200`; idx 1 ERR `rc=0 lines_seen=200 bytes_seen=9800 passed_lines=200 passed_bytes=9800`; idx 2 OUT `CAP-HIT tag=OUT idx=2 lines=249 bytes=12201 passed_lines=248 passed_bytes=12152` then `FILTER-EOF rc=3 lines_seen=400 bytes_seen=19600 passed_lines=248 passed_bytes=12152`; idx 2 ERR `rc=0 lines_seen=0 bytes_seen=0 passed_lines=0 passed_bytes=0`. Expected statuses: idx 1 `ps0=0 ps1=0 se=0`; idx 2 `ps0=0 ps1=3 se=0`.

### 9.3 Invocation (for the separately authorized Step 3 only; not run in this window)

```powershell
Set-Location -Path "C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\stage-a"
.\source\Run-Case.ps1 -Root "C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\stage-a" -CaseId C-1 -GoMode VALID -GoDelaySec 0 -WatchdogSec 180 -RetainBytes 262144 -ReadyPrefixBytes 256 -Plan "c1|timeout -s TERM -k 1 14 timeout -s TERM -k 1 13|--out 800 --err 200 --bytes 40`nc2|timeout -s TERM -k 1 14 timeout -s TERM -k 1 13|--out 400 --err 0 --bytes 40`nc3|timeout -s TERM -k 1 14 timeout -s TERM -k 1 13|--out 1 --err 0 --bytes 40" -Env @{ AISB_HOST_BUDGET_SEC='120'; AISB_PER_CMD_CEIL_SEC='15' }
.\source\Assert-C1.ps1 -CaseDir "C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\stage-a\evidence\C-1"
```

**`-Root` is mandatory in substance.** The copied harness's default `-Root` is the locked MECH-EXP-02 tree, which has no `evidence\C-1`, so omitting `-Root` would not be refused and would write into a locked tree. Step 3 must verify the literal `-Root` argument before running. Expected harness lines: `ENV nonce=<N> AISB_HOST_BUDGET_SEC=120 AISB_PER_CMD_CEIL_SEC=15`; `PLAN c1|W|--out 800 --err 200 --bytes 40 ;; c2|W|--out 400 --err 0 --bytes 40 ;; c3|W|--out 1 --err 0 --bytes 40` (W expanded).

### 9.4 Exact expected output bytes

LF line endings; `<N>` = the 16-hex nonce from `result.json`; `x40` = 40 × `x`.

`candidate-stdout.bin` — **51482 B / 1054 L**, in order:

| Content | Lines | Bytes |
|---|---|---|
| `READY <N>` | 1 | 23 |
| `O000001 x40` … `O000800 x40` | 800 | 39200 |
| `RC 1 0 0 0` | 1 | 11 |
| `O000001 x40` … `O000248 x40` | 248 | 12152 |
| `--- OUT-CAP-TRUNCATED lines=248 bytes=12152 ---` | 1 | 48 |
| `RC 2 0 3 0` | 1 | 11 |
| `STOPPED CAP` | 1 | 12 |
| `END <N> CAP` | 1 | 25 |

`candidate-stderr.bin` — **9800 B / 200 L**: `E000001 x40` … `E000200 x40`.

Channel total 61282 B / 1254 L. Ordering across the two files is not asserted.

## 10. Assertions (`source\Assert-C1.ps1`; case C-1 only)

Every row receives exactly one failure type when it fails: DEFECT, SETUP, TIMING, UNATTRIBUTED, NOT-REACHED, MISSING, INTEGRITY or INTERVENTION. Each row also records an evidence class: `audit` (timestamped audit lines), `absence` (rests on a line being absent), `bound` (B1 / B2) or `capture` (untimed `.bin` content).

**COMPLETE evidence** = U1 ∧ R1 ∧ X1 ∧ XE ∧ CAPT pass ∧ `SCRIPT-END` present from the `SCRIPT-START` writer. Every absence-based DEFECT and every absence-based passing claim (N3) requires COMPLETE evidence; otherwise it is INTEGRITY.

| Row | Pass condition | Failure attribution |
|---|---|---|
| U1 | audit log present, readable, every line parsed | absent / unreadable → MISSING; unparsed → INTEGRITY |
| R1 | `result.json` object; nonce 16 hex; `exitCode` null or Int32; booleans; survivors integer 0..4294967295 (Int64 compare); seven byte counters 0..2^53−1 | MISSING |
| X1 | harness log adequate (present, non-empty, all lines parsed, CASE-BEGIN / PROC-START / JOB-ASSIGN / SURVIVOR-CHECK / JOB-CLOSED / CASE-END once each); no intervention line; `watchdogFired=false`; `jobAssigned=true`; survivors 0 and equal to `SURVIVOR-CHECK` | inadequate → MISSING; intervention / survivors > 0 → INTERVENTION; survivors 4294967295 → MISSING (unknown, never zero, never a defect) |
| XE | `exitCode=0` with `SCRIPT-END` from the parent writer | null → MISSING; non-zero with `SETUP-FAIL` → SETUP; with `GO-TIMEOUT` → TIMING; otherwise UNATTRIBUTED; 0 without SCRIPT-END → INTEGRITY. Never DEFECT |
| CAPT | retained = totals, dropped 0, retained total ≤ 262144, file lengths = retained | invalid inputs → MISSING; loss → INTEGRITY |
| S0 | `SCRIPT-START` < `SETUP-OK` < `READY-SENT` from one writer, no `SETUP-FAIL`; READY nonce = harness nonce; `GO-RECV [GO <N>]`; `HOST-START`; harness `READY-OBSERVED match=True` and `GO-SENT` once | `SETUP-FAIL` → SETUP; `SETUP-OK` absent → MISSING; GO-TIMEOUT → TIMING; GO-INVALID → UNATTRIBUTED; writer / order / nonce mismatch → INTEGRITY |
| S1 | `OPTS`: errexit / posix / monitor / lastpipe off, pipefail recorded; constants equal §7.3 (`ceiling`, `session_res`, `cmd_res`, `out_max`, `err_max`, `pool`, `go_wait=8s`, `budget=120s`, `ceil=15s`) | observed difference → SETUP; missing field → MISSING |
| S2 | harness `CASE-BEGIN` prefix, `ENV` and `PLAN` equal §9.1 / §9.3 exactly | difference → SETUP; nonce disagreement → INTEGRITY; missing → MISSING |
| S3 | for each started command, `UTIL-EXEC` args equal the plan and any `UTIL-EXIT` has rc 0 | difference → SETUP; `UTIL-EXEC` absent after `PRE-EXEC` → SETUP only with COMPLETE evidence, else MISSING |
| A1 / A2 | `ALLOC` idx 1 / idx 2 equal §9.2; `FILTER-START` OUT / ERR slices equal the ALLOC slices | value mismatch → DEFECT (audit); `PRE-EXEC` without `ALLOC` → DEFECT (absence); missing → MISSING |
| P1 / P2 | ERR `FILTER-START.pid` = its writer = `fpid` = ERR `FILTER-EXIT.pid`; `fpid` ≠ OUT filter, parent, utility; `prev_bang` = `[]` (idx 1) / idx 1 `fpid` (idx 2); ERR rc = `se`; OUT rc = `ps1` | `fpid` = `prev_bang` → UNATTRIBUTED (pid-reuse residual); other mismatch → DEFECT (audit) |
| K1 | idx 1: `n=2`, `ps0=ps1=se=0`, no CAP-HIT, no STOP-EVENT, `DISPATCH-OK`, FILTER-EOF counts as §9.2 | producer / filter status per attribution order below; wrong counts / spurious CAP-HIT / spurious stop → DEFECT (audit) |
| K2 | idx 2: `n=2`, `ps0=0`, one OUT CAP-HIT with §9.2 fields, `ps1=3`, `se=0`, no ERR CAP-HIT, FILTER-EOF drained counts as §9.2 | no OUT CAP-HIT with `ps0=0` → DEFECT (absence); wrong fields → DEFECT (audit); producer / filter status per attribution order |
| G2 | `STOP-EVENT CAP idx=2` and `STOPPED CAP idx=2`; no `DISPATCH-OK idx=2` | dispatch-ok present → DEFECT; other reason with `ps0=0` → DEFECT; `ps0≠0` → NOT-REACHED; missing → MISSING |
| N3 | after the first `STOPPED` (reason R at idx k): no `ALLOC` / `PRE-EXEC` / `FILTER-START` / `UTIL-EXEC` for idx > k (idx ≥ k for HOST-DEADLINE / BUDGET-EXHAUSTED); `STOPPED` once; `NOT-STARTED idx=3 name=c3 reason=R`; `SCRIPT-END R` | marker present → DEFECT (audit); no marker but evidence not COMPLETE → INTEGRITY; missing → MISSING |
| W | parent events SCRIPT-START < SETUP-OK < OPTS < READY-SENT < GO-RECV < HOST-START < ALLOC1 < PRE-EXEC1 < PIPE-RETURN1 < WAIT-RETURN1 < DISPATCH-OK1 < ALLOC2 < PRE-EXEC2 < PIPE-RETURN2 < WAIT-RETURN2 < STOP-EVENT2 < STOPPED2 < NOT-STARTED3 < SCRIPT-END, one writer | order → DEFECT (audit); writers differ → INTEGRITY; not on the expected path → NOT-REACHED |
| B1 | harness byte totals stdout + stderr ≤ 65536 | excess → DEFECT (bound; depends on R1 and adequate harness log) |
| B2 | LF line count stdout + stderr ≤ 2000 | excess → DEFECT (bound; also requires CAPT) |
| B3 | every line LF-terminated, ≤ 49 B, inside the closed grammar (READY first, END last, RC, records, STOPPED ≤ 1, one marker per channel at most) | violation → DEFECT (capture; requires CAPT) |
| O1 / E1 | byte-equal to §9.4 (51482 B / 9800 B) | only evaluated on the expected path (else NOT-REACHED); mismatch → DEFECT (capture) only when CAPT passes, else INTEGRITY |

**Unexpected producer status attribution (first match applies):** (1) 124 / 137 → TIMING; (2) a `UTIL-EXEC` with arguments differing from the plan, or `UTIL-EXIT rc≠0` → SETUP; (3) `UTIL-EXEC` absent after `PRE-EXEC`, with COMPLETE evidence → SETUP; (4) 141 with `UTIL-EXEC` present, `UTIL-EXIT` absent, and a filter of that command with `FILTER-START` but no `FILTER-EOF`, with COMPLETE evidence → DEFECT (absence; the filter stopped draining); (5) anything else → UNATTRIBUTED. **Unexpected filter status:** DEFECT (audit) only when that filter's own `FILTER-EXIT` records the same rc; otherwise UNATTRIBUTED.

Output: `assertions.json` (UTF-8 without BOM) with `verdict`, `completeEvidence`, `interventionObserved`, `firstInterventionUnix`, a charged-vs-written diagnostic, the precedence trace, every row and the hashes of all five inputs.

## 11. Verdict precedence and intervention

- **Rule 0.** A DEFECT whose evidence dependencies are unmet is reclassified INTEGRITY before precedence.
- **Rule 1 (proof prerequisites).** S0, S1, S2: any SETUP → **CASE-INVALID**; any other failure → **INCONCLUSIVE-EVIDENCE**. Successful descriptor setup, validated inputs, READY/GO and the frozen configuration are prerequisites of any proof. A pre-READY failure cannot PASS.
- **Rule 2.** Any other SETUP → **CASE-INVALID**.
- **Rule 3 (defects).** With no intervention: any DEFECT → **FAIL**. With intervention, each DEFECT is judged on its own evidence: it qualifies if its class is `bound`, or its class is `audit` and its latest cited timestamp is more than 0.020 s before the first intervention. Absence findings cannot coexist with intervention (COMPLETE evidence requires X1). Capture findings never qualify. FAIL if at least one DEFECT qualifies; otherwise INCONCLUSIVE-EVIDENCE. **Change from B-1:** MECH-EXP-02 required every defect to precede intervention; this rule judges each defect separately.
- **Rule 4.** Any remaining TIMING, UNATTRIBUTED, NOT-REACHED, MISSING, INTEGRITY or INTERVENTION → **INCONCLUSIVE-EVIDENCE**.
- **Rule 5.** All rows pass → **PASS**.

First intervention time = the earliest harness intervention line (`WATCHDOG-FIRE`, `JOB-TERMINATE`, `READER-TIMEOUT`, `HARD-ABANDON`, `GO-REFUSED`, `GO-WRITE-FAILED`, `READY-NOT-FOUND`, `BATCH-EXCEEDED`) or the `SURVIVOR-CHECK` time when observed survivors > 0.

## 12. What a PASS would and would not establish

A PASS would establish only, for this fixture on MSYS bash 5.2.15: c1's output passed within its slices; c2's stdout slice, reduced by conservative session charging, was exhausted by the filter's own byte check with a correct marker; the filter drained its producer to EOF and returned 3; the gate recorded `STOPPED CAP`; and no subsequent command was dispatched; with channel output byte-exact and within 65536 B / 2000 L.

It would not establish: reaching the actual 65536 B global limit; the 2000 L bound being binding; ERR-slice exhaustion; `BUDGET-EXHAUSTED`; producer termination (the producer is drained, not stopped); the 15 s / 120 s deadlines, HOST-DEADLINE or 124 / 137 propagation; `sudo`, FG-6 survivors, Linux transfer; process-substitution or here-string backing on H; remote delivery or termination; pid reuse; host readiness. The §7.5 bound is a static argument; C-1 exercises one path through it.

## 13. Resolution of the review findings (applied before this freeze)

1. **Mutually consistent verdict classes.** Exit 141 is no longer blanket CASE-INVALID. Every unexpected producer or filter status goes through one attribution order (§10); SETUP requires fixture evidence (`UTIL-EXEC` args, `UTIL-EXIT rc`, or `UTIL-EXEC` absent with COMPLETE evidence) and DEFECT requires candidate evidence (own `FILTER-EXIT`, or the 141 undrained-filter pattern with COMPLETE evidence). Unsupported statuses are UNATTRIBUTED. XE is never a DEFECT.
2. **Complete evidence for absence findings.** COMPLETE evidence is defined once and required for every absence-class DEFECT and for N3's absence claim. C2's evidence validation (U1, R1, X1 adequacy, unknown-survivor MISSING, per-defect `depOk` / `evidenceClass` / `evidenceTmax`, downgrade before precedence) is preserved. Intervention precedence is §11 rule 3.
3. **Setup and inputs as prerequisites.** The candidate checks both descriptor steps and validates every input before READY, writing `SETUP-FAIL` or `SETUP-OK`. S0 requires `SETUP-OK` from the parent before READY; `bash -n` is recorded as syntax evidence only. §11 rule 1 makes S0 / S1 / S2 prerequisites: a pre-READY failure is CASE-INVALID or INCONCLUSIVE-EVIDENCE, never PASS. Passed counters `pl` / `pb` are locals initialised to 0 in every filter instance. RC fields are validated and bounded before emission (status 0..255 or `NA`; idx 1..999 or `NA`), and the PIPESTATUS count in the stop reason is bounded to three digits or `X`.

## 14. Harness, Job Object and utility — unchanged; compatibility review

`Run-Case.ps1`, `AisbJob.cs` and `util.sh` are byte-identical copies of the MECH-EXP-02 effective sources (§15). No blocking incompatibility was found: the harness takes `-Root` for all paths (candidate, Job Object, utility, `batch.json`, working directory); it refuses an existing `evidence\C-1` (exit 8); it records `CASE-BEGIN`, `ENV` (`nonce=` + sorted `-Env` keys) and `PLAN` (newlines as ` ;; `) in the forms S2 checks; `READY-OBSERVED` carries `match=True/False`; the 262144 B retention budget exceeds the expected 61282 B. Its header comments still name MECH-EXP-02 and its default `-Root` points at the MECH-EXP-02 tree; both are left unchanged, and §9.3 supplies `-Root` explicitly. The harness's child environment inherits the launching shell's environment; a stray `AISB_GO_WAIT_SEC` would show as an S1 SETUP difference, and Step 3 should confirm no other `AISB_*` variable is set in the launching shell.

## 15. Frozen artifacts (SHA-256, pre-execution) and static review

Tree: `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\stage-a\`. `SHA256SUMS` (426 B, LF) SHA-256 `50414343746e72146f6385ab044adcc62cbf2071bf34b5f60d1e7a04b50eff5a`.

| File | SHA-256 | Bytes | Provenance |
|---|---|---|---|
| `source\candidate.sh` | `01043cee22cba7029f657b7c5d01b107d44d6b095c02e90ea8de77eb4266d971` | 9626 | new; derived from MECH-EXP-02 `60f77850…` |
| `source\Assert-C1.ps1` | `012efa6983470f03da01add5f99d00dae9281a4f483c25514d28652f72e9be1a` | 57555 | new; derived from MECH-EXP-02 C2 `Assert-B1.ps1` `276c8af8…` |
| `source\Run-Case.ps1` | `25f9938cd8d215c5453b57e4ed1b04031ccb870b6d3bb192a867c40ebcdc9315` | 13114 | byte copy of MECH-EXP-02 |
| `source\AisbJob.cs` | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | 4106 | byte copy of MECH-EXP-02 |
| `fixtures\util.sh` | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | 1885 | byte copy of MECH-EXP-02 |

New sources are LF only, without BOM; their only non-ASCII characters are em dashes in comments (as in `Assert-B1.ps1`). Focused diffs (`evidence\review-export\prep\diff-candidate.sh.vs-EXP-02-60f77850.diff` `f056d2a5…`, `diff-Assert-C1.ps1.vs-EXP-02-Assert-B1-276c8af8.diff` `140e59a3…`) were verified by applying each to a temporary copy of its predecessor with `patch.exe`; each reproduced the frozen hash exactly.

Static checks (`evidence\prep\static-checks.txt`): `bash -n` exit 0 for `candidate.sh` and `util.sh` (GNU bash 5.2.15(1)-release); PowerShell `Parser.ParseFile` 0 errors for `Assert-C1.ps1` and `Run-Case.ps1`. These are syntax checks only. They execute no code and establish neither descriptor setup, input validation, runtime behaviour nor assertion correctness.

## 16. Step 3 pre-execution checks, write set, non-effects, activity ledger

**Step 3 pre-execution checks (for the separately authorized step):** HEAD and `SATURATION_PROOF.json` blob as recorded at that time; all five source hashes equal §15; `evidence\C-1` and `evidence\batch.json` absent in the MECH-EXP-03 tree; the literal `-Root` argument equals the MECH-EXP-03 `stage-a` path; no `AISB_*` variable in the launching shell; Windows PowerShell 5.x.

**Write set (Steps 1–2):** this file; this task's `TASKS.md` records (header line, two lane-status lines, GOVERNANCE line, `PM2_RECOVERY_MECH_EXP_03_*` field block); this task's canonical body at the end of `TASKS_BACKLOG_FULL.md`; the MECH-EXP-03 `stage-a` tree (`source\`, `fixtures\`, `SHA256SUMS`, `evidence\prep\`, `evidence\review-export\`).

**Non-effects:** executions of candidate, harness, fixture and assertion script = 0; probes = 0; runtime = 0; host access = 0; Stage B = 0; MECH-EXP-01 / MECH-EXP-02 tree or package writes = 0; predecessor record edits = 0; sidecar / catalog / `lockedTaskIds` edits = 0; repository `SATURATION_PROOF.json` not mutated (validator proof written under `evidence\review-export\validation\` via `-ProofPath`); STAGING not acquired; Git stage / commit / push / branch / reset / restore / clean = 0; subagents = 0. Readiness: NO. Host use: BLOCKED. Stage B: NOT AUTHORIZED. Occupancy EMPTY. Lane 3 DISABLED.

**Status: PM2-RECOVERY-MECH-EXP-03 — Steps 1–2 COMPLETE (registered; scope frozen; sources hashed; not executed) — 2026-10-02 at baseline `946050ca89addc8b497f378dcb1470e33286b7b6`. Step 3 NOT AUTHORIZED. Step 4 NOT AUTHORIZED. Not accepted. Not locked.**

## 17. Step 2 correction C1 (2026-10-02) — appended; §§0–16 are not edited

Keith authorized correction C1 of Step 2 at baseline `946050ca89addc8b497f378dcb1470e33286b7b6`. Steps 3–4 remain NOT AUTHORIZED. The text above this section (§§0–16, 36453 B, SHA-256 `5535c0874cd632863be9e1de65e071a7da590154130f131223cf4d81c02d617a`) is the Step 2 freeze and is not rewritten. Where this section differs from §10, §11 or §15, this section governs. Only `source\Assert-C1.ps1` and the working `SHA256SUMS` changed.

### 17.1 Findings

1. **Case-insensitive variable collision.** PowerShell variable names are case-insensitive. `$A` (the assertion collection) and `$a` were one variable. On the expected path, S3's `$a = Field $u 'args'` (frozen line 418) replaced the collection with a string, so the next `Rec` failed on `.Add` and the script stopped without writing `assertions.json`. Separately, `foreach ($a in $allocs)` (frozen line 806) would have replaced it with an `ALLOC` audit line before serialization. `AttribProducer` held a local `$a` as well.
2. **Values compared before validation.** `ALLOC`, `FILTER-*`, `CAP-HIT`, PIPESTATUS (`n`, `ps0`, `ps1`, `fpid`, `se`), `PRE-EXEC`, `UTIL-*`, `NOT-STARTED` and stop fields were compared directly against expectations. An absent or malformed field therefore became an observed-value DEFECT (or SETUP) instead of an evidence gap.
3. **Unguarded numeric conversions.**
   - `[double]` on harness timestamps sat outside any `try`, so an oversized value stopped the script.
   - `[double]` on audit timestamps sat inside the read `try`, so an oversized value discarded the whole audit.
   - `[int]` on the first `STOPPED` idx (frozen line 603) stopped the script when the value was oversized.
   - `[long]` in the charge diagnostic (frozen line 806) stopped the script after precedence, before `assertions.json` was written.
4. **Mistaken predecessor ID in this task's mirrors.** The Steps 1–2 registration named `PM2-RECOVERY-P5-U1-PRIV-INSPECTION-01`. The registered task is `PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01`. §§0–16 do not contain either string.

### 17.2 Corrections (`source\Assert-C1.ps1` only)

1. **Names.**
   - The collection is `$Assertions`. No variable in any scope shares its name in any spelling.
   - The former collision sites now use descriptive names: `$utilArgs`, `$utilExec`, `$utilExit` and `$utilRc` in S3 and `AttribProducer`; `$allocLines`, `$allocLine`, `$chargedBytes` and `$chargedLines` in the diagnostic; `$row` and `$traceLine` in the downgrade, precedence and output loops.
   - Other reused script-scope names were made distinct. Examples are audit and harness parsing, the B3 grammar counters and patterns, N3 (`$stopIdx`, `$laterIdx`), G2, K1 / K2, S1 / S2, O1 / E1 and `EvalAlloc` (`$allocExpected`).
2. **Required-field grammar.** A required field is validated before its value is compared:
   - absent (key missing, or the value empty where the grammar does not admit empty) → **MISSING**;
   - present but outside its grammar → **INTEGRITY**, with the values not compared and not treated as a candidate defect;
   - well-formed but different from the expectation → the §10 type: DEFECT, with SETUP for fixture fields.

   Grammar: idx `1..999`; counts, bytes and slices `0..999999999` (at most 9 digits, no leading zero); exit status `0..255`; pid `1..9999999999`; filter tag `OUT|ERR`; fixture tag / name `c1..c9`; stop reason `[A-Za-z0-9/-]{1,25}`; `prev_bang` empty or a pid; PIPESTATUS count `n` at most 3 digits; `UTIL-EXEC args` printable ASCII, 1..200 characters.

   It applies to:
   - A1 / A2: `ALLOC` and both `FILTER-START` lines.
   - P1 / P2: both `FILTER-START`, both `FILTER-EXIT`, `PIPE-RETURN fpid` / `ps1`, `WAIT-RETURN`, `PRE-EXEC` and `UTIL-EXEC`.
   - K1 / K2, in order: `ps0` → producer attribution → `n` → `ps1` / `se` → `CAP-HIT` → `STOP-EVENT` → `FILTER-EOF`.
   - G2: `STOPPED` (exact `<reason> idx=<n>`) and `STOP-EVENT` (`<reason> idx=<n>`, optionally followed by text).
   - N3: first `STOPPED`, `NOT-STARTED idx=3`, `SCRIPT-END <reason> remB=<n> remL=<n>`.
   - S3 and the producer / filter attribution: `UTIL-EXEC`, `UTIL-EXIT`, the command's own `FILTER-EXIT`.

   A SETUP or DEFECT attribution now uses only well-formed fields. Absence-based findings (`PRE-EXEC` without `ALLOC`, no OUT `CAP-HIT` with `ps0=0`, `UTIL-EXEC` absent) and event-presence findings (spurious `CAP-HIT` / `STOP-EVENT` / `DISPATCH-OK`, dispatch markers after a stop) are unchanged. One case keeps the frozen evidence rule: a well-formed wrong K2 `CAP-HIT` value remains a DEFECT when `FILTER-EOF` is absent or malformed.
3. **Numeric guards.**
   - Audit and harness timestamps must match `^\d{1,15}\.\d{1,9}$` and are converted with `[double]::TryParse`. A failure makes the line unparsed: U1 INTEGRITY for the audit; X1 MISSING for the harness.
   - The audit writer pid must match `[1-9]\d{0,9}`.
   - The `STOPPED` idx is converted with `[int]` only after the idx grammar.
   - The charge diagnostic converts with `[long]` only after the count grammar, skips malformed `ALLOC` lines and reports how many it skipped. It runs in its own `try`; a failure there sets `chargedDiagnostic = "diagnostic unavailable: …"` and never touches `$Assertions` or the verdict.
4. **Fail-closed evaluation (rule R).** Evaluation from U1 through rule 5 runs inside one `try`. An unexpected error is recorded as `evaluationError`, the rows already collected are kept and serialized, and the verdict is **INCONCLUSIVE-EVIDENCE**. After rules 0–5, rule R also checks that each of the 23 frozen row IDs was recorded exactly once and that no other ID was recorded. Otherwise the verdict is INCONCLUSIVE-EVIDENCE. With a complete row set and no error, rule R changes no verdict. `assertions.json` additionally carries `evaluationError` and `assertionIdCheck`.

### 17.3 Unchanged

The following are unchanged:
- H-3, the single case C-1, the §9.2 allocations, the §9.4 expected bytes (stdout 51482 B / 1054 L; stderr 9800 B / 200 L) and the §9.3 invocation;
- the 23 row IDs and their recording order (U1, R1, X1, XE, CAPT, S0, S1, S2, S3, A1, P1, K1, A2, P2, K2, G2, N3, W, B1, B2, B3, O1, E1);
- the failure types, the COMPLETE-evidence rule, rules 0–5 and the attribution order (now over well-formed fields).

`candidate.sh`, `Run-Case.ps1`, `AisbJob.cs` and `util.sh` are byte-unchanged.

### 17.4 Effective and superseded hashes (SHA-256)

| File | Effective (C1) | Superseded (§15 freeze) |
|---|---|---|
| `source\Assert-C1.ps1` | `17cffa68422ef37c2b8b8771b46d6d475e370599c5743bbeb214a4b56ba72cb0` (72688 B) | `012efa6983470f03da01add5f99d00dae9281a4f483c25514d28652f72e9be1a` (57555 B) |
| `SHA256SUMS` (working) | `373c96921f24854e7ab9bc3acb79a57c01db32fd545a7618dd30fae70918655f` (426 B) | `50414343746e72146f6385ab044adcc62cbf2071bf34b5f60d1e7a04b50eff5a` (426 B) |
| `source\candidate.sh` | `01043cee22cba7029f657b7c5d01b107d44d6b095c02e90ea8de77eb4266d971` | unchanged |
| `source\Run-Case.ps1` | `25f9938cd8d215c5453b57e4ed1b04031ccb870b6d3bb192a867c40ebcdc9315` | unchanged |
| `source\AisbJob.cs` | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | unchanged |
| `fixtures\util.sh` | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | unchanged |

The superseded files are kept as byte copies in `evidence\c1-correction\freeze\` and in the original review ZIP. There are two C1-only diffs:
- `evidence\c1-correction\diffs\C1-Assert-C1.ps1.diff`: SHA-256 `b06539812aaf5e67958652b639ea22023d385441aff64e49740d46d3b6d4489e`; 26 hunks, +312 / −130 lines.
- `C1-SHA256SUMS.diff`: SHA-256 `f5fde5fc5fd28cb83b3670077e36e68f1437187bf5265c90378f49f8bb0d634a`; one line.

Applying each diff with `patch.exe --binary` to a temporary freeze copy reproduced its effective hash exactly. The effective `Assert-C1.ps1` is LF, without BOM; its only non-ASCII characters are em dashes in comments.

### 17.5 Static verification (no execution)

All checks are under `evidence\c1-correction\validation\`. `Check-AssertStatic.ps1` uses `Parser.ParseFile` and the AST only; it never invokes its target.

| Check | Frozen file | Corrected file |
|---|---|---|
| Parse errors | 0 | 0 |
| Case-insensitive variable collisions | 2: script-scope `a` / `A`, and `AttribProducer` `a` vs script `A` (`static-check-freeze.txt`) | 0 (`static-check-corrected.txt`) |
| Assignments to automatic variables | 0 | 0 |
| Literal row IDs | 23 | 23 |
| Numeric casts reached by unbounded input | 6 (frozen lines 119, 124, 145, 603, 806 ×2) | 0 |

Every remaining numeric cast is preceded by a bounded pattern or by the C2 `result.json` type and range validation.

The static trace is in `STATIC-TRACE.md`:
- On the expected C-1 path, each of the 23 IDs is recorded exactly once, in the frozen order. Rule 5 gives PASS. Rule R finds 23 / 23 with no extras. The diagnostic gives 104 + 50117 + 15315 = 65536 B and 3 + 1253 + 744 = 2000 L. `assertions = @($Assertions)` serializes the same 23 rows.
- Missing fields become MISSING without any value comparison.
- Malformed or oversized values become INTEGRITY, or an unparsed line, with no cast, and later rows continue. An unexpected error keeps the collected rows and yields INCONCLUSIVE-EVIDENCE.

Helper names were checked against PowerShell aliases and cmdlets; none collide. These checks establish syntax, naming and traced control flow only. They do not establish runtime behaviour.

### 17.6 Predecessor-ID correction

This task's current mirrors now name `PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01`: the `TASKS.md` field `PM2_RECOVERY_MECH_EXP_03_DEPENDS_ON` and the `**Depends on:**` line of this task's backlog body.

The following were not edited:
- the Steps 1–2 prep files and the original review ZIP, which are historical records;
- the locked MECH-EXP-01 and MECH-EXP-02 records, whose `TASKS.md` field lines and backlog bodies contain the same string. Locked records are not edited by this correction.

### 17.7 Packages, Step 3 checks, non-effects

**Original package (preserved).** The Steps 1–2 review package is not modified:
- `evidence\review-export\PM2-RECOVERY-MECH-EXP-03-steps-1-2-review-export-2026-10-02.zip`: SHA-256 `21e9aab3eea428df85a1af933a062bc3a2af00774c46bae8a19331086ce99de5`, 206384 B;
- `EXPORT-SHA256SUMS`: `f9ecbf66672697c59d9e21d2d626a679fbd001d5010617344e9b1446a6c0ad7b`.

**C1 package.** The C1 review package is `evidence\c1-correction-export\`. Its bundle hash is recorded beside the bundle, not in repository records, because the bundle contains these records. The lane-capacity validator proof is written under `evidence\c1-correction\validation\` via `-ProofPath`; the repository `SATURATION_PROOF.json` is not mutated.

**Step 3 pre-execution checks** (for a separately authorized Step 3) replace §16's source-hash check with the §17.4 effective hashes:
- `Assert-C1.ps1` `17cffa68…`;
- `SHA256SUMS` `373c9692…`.

All other §16 checks stand.

**Write set (C1):** this section; this task's `TASKS.md` records (header line, two lane-status lines, GOVERNANCE line, new and corrected `PM2_RECOVERY_MECH_EXP_03_*` fields); this task's backlog body; and, in the MECH-EXP-03 `stage-a` tree, `source\Assert-C1.ps1`, `SHA256SUMS`, `evidence\c1-correction\` and `evidence\c1-correction-export\`.

**Non-effects:**
- **Execution:** candidate, harness, fixture and assertion script were each run 0 times. There were no probes, runtime, host access or Stage B.
- **Untouched artifacts:** `candidate.sh`, `Run-Case.ps1`, `AisbJob.cs` and `util.sh` are byte-unchanged. There were no writes to the MECH-EXP-01 / MECH-EXP-02 trees or packages, and none to the original package. Predecessor record edits, sidecar / catalog / `lockedTaskIds` edits, and repository `SATURATION_PROOF.json` writes all = 0.
- **Process:** no acceptance or lock. Git stage / commit / push / branch / reset / restore / clean = 0. Subagents = 0.
- **State:** readiness NO; host use BLOCKED; Stage B NOT AUTHORIZED; occupancy EMPTY; Lane 3 DISABLED.

GOVERNANCE was acquired transiently for these records, then released UNOWNED.

**Status: PM2-RECOVERY-MECH-EXP-03 — Step 2 correction C1 RECORDED (`Assert-C1.ps1` corrected; other sources byte-unchanged; not executed) — 2026-10-02 at baseline `946050ca89addc8b497f378dcb1470e33286b7b6`. Step 3 NOT AUTHORIZED. Step 4 NOT AUTHORIZED. Not accepted. Not locked.**

## 18. Step 3 C-1 execution record (2026-10-02) — appended; §§0–17 are not edited

Keith authorized Step 3 on 2026-10-02: one Windows-local C-1 harness run and one assertion evaluation under §9.3 as corrected by §17. He separately authorized this record as documentation and evidence packaging only. Step 4 remains NOT AUTHORIZED. The text above this section (§§0–17, 48883 B, SHA-256 `075457374971ef14ead0d8224491e99a772241eee60ec12c736912780d0ea2eb`) is preserved byte-for-byte. While this record was written, no candidate, harness, fixture, assertion script, probe or recorder was run, and nothing was rerun.

### 18.1 Inputs verified before any write

HEAD `946050ca89addc8b497f378dcb1470e33286b7b6`, nothing staged. The working tree carries the inherited `M docs/control-plane/SATURATION_PROOF.json`, `M TASKS.md`, `M TASKS_BACKLOG_FULL.md` and this untracked file.

| Item | SHA-256 | Bytes |
|---|---|---|
| `SATURATION_PROOF.json` working blob (Git object id) | `50ce410efe547a7e24f06ef75b9410916d5dae8a` | — |
| `SHA256SUMS` (effective, §17.4); all five entries verify | `373c96921f24854e7ab9bc3acb79a57c01db32fd545a7618dd30fae70918655f` | 426 |
| `source\candidate.sh` | `01043cee22cba7029f657b7c5d01b107d44d6b095c02e90ea8de77eb4266d971` | 9626 |
| `source\Assert-C1.ps1` | `17cffa68422ef37c2b8b8771b46d6d475e370599c5743bbeb214a4b56ba72cb0` | 72688 |
| `source\Run-Case.ps1` | `25f9938cd8d215c5453b57e4ed1b04031ccb870b6d3bb192a867c40ebcdc9315` | 13114 |
| `source\AisbJob.cs` | `6d39c70ffe99081f4feb1914749b28ba10a251a0e72a98488bcccd074a3c861d` | 4106 |
| `fixtures\util.sh` | `9f7686a92bfe1844aba8a28d27366bf91f90a17cc6eb386942f3ed8549ecc6ba` | 1885 |
| this file before §18 | `075457374971ef14ead0d8224491e99a772241eee60ec12c736912780d0ea2eb` | 48883 |
| retained execution package `evidence\EXP-03-manual-step3-review.zip` (15 entries, each byte-equal to its loose copy) | `0d728941f191493a7685c587c4ee8a0e6e69bce7bc77df3fb4ee387d76710bd0` | 18897 |
| C1 package (§17.7), unchanged | `dc81e315fa4ca2cb8e836ed7876530f7ee59b5871536428f800e5b3a39b624ce` | — |
| original Steps 1–2 package, unchanged | `21e9aab3eea428df85a1af933a062bc3a2af00774c46bae8a19331086ce99de5` | 206384 |

`TASKS.md` (4372224 B) and `TASKS_BACKLOG_FULL.md` (5862726 B) have the sizes and encodings recorded at the C1 end state.

### 18.2 Execution method and launcher

**Established from the retained files:**
- **Launcher.** `evidence\manual-step3\Invoke-Frozen-C1.ps1` is 759 B, LF, ASCII, SHA-256 `cd7c368360e64cf35c36a6ebe1a887406eecbf8d7c26eedc98a478a055dd14eb`, written 10:43:34.150Z. Its `Run-Case.ps1` line is byte-identical to the §9.3 harness line, including the literal `-Root` of this task's `stage-a` tree. Only the surrounding lines differ from §9.3:
  - `Set-Location -LiteralPath` with a single-quoted path instead of `-Path` with a double-quoted one (same path);
  - `$ErrorActionPreference = 'Stop'`, and a `try` / `catch` whose `catch` writes the error and exits 1;
  - `$global:LASTEXITCODE = 0` before the call and `exit $LASTEXITCODE` after it.

  The launcher does not invoke `Assert-C1.ps1`.
- **Stream records** (outside the case evidence, in `evidence\manual-step3\`): `harness.stdout.txt` 60796 B, `harness.stderr.txt` 0 B, `harness.exitcode.txt` `0`; `assertion.stdout.txt` 2816 B, `assertion.stderr.txt` 0 B, `assertion.exitcode.txt` `0`; `source-hashes-after.txt` 426 B.
- **Write order (UTC, 2026-10-02):** launcher 10:43:34.150; harness `CASE-BEGIN` 10:43:34.891; `batch.json` start 10:43:34.899; `JOB-ASSIGN` 10:43:35.194; `GO-SENT` 10:43:35.346; `CASE-END` 10:43:36.035; harness exit-code file 10:43:36.306; `assertions.json` 10:43:37.585 (`evaluatedUtc` 10:43:37.577); assertion exit-code file 10:43:38.399; `source-hashes-after.txt` 10:43:38.430; ZIP 10:43:40.564.
- **One run of each.** The evidence holds one case directory, one `batch.json` case entry, one `CASE-BEGIN` and one `assertions.json`. The harness refuses an existing `evidence\C-1` (exit 8), and `Assert-C1.ps1` refuses to overwrite `assertions.json`.

**Keith's account** (not observable from the retained files): he ran the harness once and the assertion script once from standalone Windows PowerShell with Cursor closed, and both exited 0.

**Not retained:**
- the outer commands that wrote the launcher, captured the streams, ran `Assert-C1.ps1`, hashed the sources and built the ZIP;
- the exact assertion command line;
- any pre-execution precheck output.

The 6.4 s from launcher write to ZIP is consistent with one scripted sequence but does not identify it. The retained files cannot exclude a run whose evidence was removed.

**`evidence\step3\Record-Step3.ps1` was not used.** It was prepared in the paused session as a single-use child-process recorder. Its launchers (`Invoke-C1-Harness.ps1`, `Invoke-C1-Assert.ps1`) were never written, and none of its output files exist. In this pass it was read, not run. Its current bytes are the CRLF form from §18.5 item 5.

### 18.3 Pre-execution conditions (§16, §17.7)

| Condition | Support |
|---|---|
| HEAD and `SATURATION_PROOF.json` blob | equal before (precheck-recovery pass, about 10:03Z) and after (§18.1); no record at run time |
| five source hashes | `source-hashes-after.txt` is byte-equal to `SHA256SUMS`; the two restored sources were last written at 10:34:01Z and the other three before this task's freeze, all before the run |
| `evidence\C-1` and `evidence\batch.json` absent | confirmed absent at the precheck-recovery pass; `batch.json` records one case started 10:43:34.899Z; the harness would have exited 8 had `evidence\C-1` existed, and it exited 0 |
| literal `-Root` = this task's `stage-a` | launcher line byte-equal to §9.3 |
| no `AISB_*` variable in the launching shell | partly: S1 shows `go_wait=8s`, the default, so `AISB_GO_WAIT_SEC` was unset or 8. S2's `ENV` line lists only the `-Env` keys and says nothing about inherited variables. Otherwise Keith's account only |
| Windows PowerShell 5.x | Keith's account only |

### 18.4 C-1 result (from retained evidence only)

**Verdict: PASS by rule 5.** `completeEvidence=true`, `evaluationError` empty, `interventionObserved=false`, `assertionIdCheck` 23 expected / 23 recorded with no problems. All 23 rows have `ok=true` and `depOk=true`, with no failure type and no downgrade: U1, R1, X1, XE, CAPT, S0, S1, S2, S3, A1, P1, K1, A2, P2, K2, G2, N3, W, B1, B2, B3, O1, E1. `assertions.json` SHA-256 `2c0bb38ae37a9242c9f743f02473abe3dfd1d0bead72311b4959fbf2e36c91e5`; its `caseDir` is this task's `evidence\C-1`.

**CAP-HIT provenance** (audit log; writer pids in brackets):
- `ALLOC idx=2` [120]: from avB 15198, oB 12158, eB 3040, oL 592, eL 149; charge 15315 B / 744 L; `remB=0 remL=0`.
- OUT filter [139]: `FILTER-START maxl=592 maxb=12158`, then `CAP-HIT tag=OUT idx=2 lines=249 bytes=12201 passed_lines=248 passed_bytes=12152`. Record 249 would have brought the slice to 12201 B > 12158 B while lines stayed at 249 ≤ 592, so the byte check fired. The marker `--- OUT-CAP-TRUNCATED lines=248 bytes=12152 ---` is stdout line 1051. Then `FILTER-EOF rc=3 lines_seen=400 bytes_seen=19600` (producer drained to EOF; `UTIL-EXIT tag=c2 rc=0`) and `FILTER-EXIT rc=3`.
- Gate [120]: `PIPE-RETURN idx=2 ps0=[0] ps1=[3] fpid=[137]`; ERR filter [137] rc 0 with 0 lines; `WAIT-RETURN se=[0]`; `STOP-EVENT CAP idx=2`; `STOPPED CAP idx=2`.
- c3: `NOT-STARTED idx=3 name=c3 reason=CAP`. There is no `ALLOC`, `PRE-EXEC` or `FILTER-START` for idx 3 and no `UTIL-EXEC tag=c3`. Then `SCRIPT-END CAP remB=0 remL=0`. **c3 was not dispatched.**
- There is exactly one `CAP-HIT` event. Unlike B-1 (MECH-EXP-02 §17.4), whose `STOPPED CAP` came from an injected filter status, C-1 had no filter knobs (§5.2).

**Allocation accounting.** idx 1 passed OUT 800 L / 39200 B and ERR 200 L / 9800 B, within 1000 L / 40000 B and 250 L / 10000 B, ending in `DISPATCH-OK`. Charged: 104 + 50117 + 15315 = 65536 B and 3 + 1253 + 744 = 2000 L, the whole pool by allocation. Written: 61282 B / 1254 L.

**Output.**
- `candidate-stdout.bin` is 51482 B / 1054 L and `candidate-stderr.bin` is 9800 B / 200 L. Both are LF only, with no CR, and every line is at most 49 B including LF.
- The §9.4 bytes were rebuilt in memory from the `result.json` nonce `741409ca34814197`. They give `e739d67ab6712a9cc4739aea8d8b5243f346011a15e85fc1a6640bcd44bec974` and `fd1f443c05e58acea28579e9629f16815cd384c0b17d44236c80e5152fdb9147`, equal to the captured files.
- Harness retention: retained equals totals, dropped 0 / 0, retained total 61282 B ≤ 262144 B.

**Containment.**
- The Job Object was assigned (`JOB-ASSIGN ok=True`, `sw=0.310044`) before `GO-SENT` (`sw=0.461603`).
- The harness log has none of `WATCHDOG-FIRE`, `JOB-TERMINATE`, `READER-TIMEOUT`, `HARD-ABANDON`, `GO-REFUSED`, `GO-WRITE-FAILED`, `READY-NOT-FOUND` or `BATCH-EXCEEDED`, and `watchdogFired=false`.
- `SURVIVOR-CHECK activeProcessesInJob=0`; `survivorsBeforeClose=0`.
- Candidate exit 0 after 1.127 s; harness exit 0; assertion exit 0.

**Post-run sources.** `source-hashes-after.txt` is byte-equal to `SHA256SUMS` (both `373c9692…`). The five sources are rechecked after these record writes (§18.8).

### 18.5 Preparation and environment incidents

Sources: the paused Step 3 session record, including the Cursor logs read in that session, and the preservation package. Times are UTC on 2026-10-02.

1. **Precheck crash (established).** The first run of the agent-authored `evidence\step3\Precheck-Step3.ps1` failed because Windows PowerShell 5 stripped quotes from a native `-Command` version check. It wrote no launcher and ran nothing in the experiment.
2. **Edit/run race (established; an agent process fault).** The agent issued an edit of `Precheck-Step3.ps1` and its rerun in the same parallel tool batch. The rerun started at 09:43:12.48, before the edit was applied at 09:43:12.97. It ended about 09:43:20.5, after 8.1 s, printed nothing and exited 0, and left no precheck output or launcher. What bytes it read, and why it printed nothing, are unknown.
3. **Disappearance (cause unknown).** `Precheck-Step3.ps1`, created at 09:41:50, was absent afterwards. The `evidence\step3` directory's last-write time is 09:43:20.54. No log records a delete, revert or rejection. The removal is not attributed to any person, tool or process. The script was not recreated.
4. **Tool refusals (tool layer; reason unknown).** Two file-tool writes to recreate the script were refused with `Write permission denied: ` and an empty path. These were not shown to be filesystem errors: the directory granted the user full control with no deny entry, a neighbouring file had been written at 09:42:16, and Defender recorded no detection. Cursor settings and feature gates changed at 09:44:19, and the session's workspace was later removed. The refusals were not bypassed through PowerShell or any other mechanism.
5. **Line-ending rewrite (established; writer unknown).** After a Cursor restart, 103 files were rewritten between 10:02:37.17 and 10:02:37.29. The new session started at 10:02:34, and its renderer warned of 513 open working copies at 10:02:36.256.
   - **Changes:** 101 files went from LF to CRLF. Two `.ts` files changed write time only.
   - **Affected:** this file, `candidate.sh`, `Assert-C1.ps1`, and loose EXP-03 prep, validation and tool files; files in the locked MECH-EXP-01 and MECH-EXP-02 trees and in INVENTORY-01; repository documents, two `.env.*.example` files and six service source files.
   - **Not rewritten:** `TASKS.md`, the backlog, `CLAUDE.md`, `AGENTS.md`, `PRD.md`, `ARCHITECTURE.md` and every ZIP package.
   - **Git:** with `core.autocrlf=true`, `git status` does not show the rewritten repository files.
   - **Writer unknown.** No log records a save, format or line-ending action. This record does not claim the cause is understood or that it cannot recur.
6. **Preservation.** Byte copies of all 103 files (with paths, sizes, hashes and times), Cursor log excerpts and the precheck creation and edit records are in `C:\Users\knlee\aisb-preflight\PM2-RECOVERY-MECH-EXP-03\eol-incident-2026-10-02\PM2-RECOVERY-MECH-EXP-03-eol-incident-preservation-2026-10-02.zip`. SHA-256 `e888a4104b0dcc468aa604bc31bbbd74edd3d176ba85e7d8a4f4a36213a81b48`, 821947 B, 120 entries.
7. **Keith's three-file restoration (outcome verified).**
   - **Keith's account:** he ran `eol-incident-2026-10-02\Restore-Exp03-EolIncident.ps1` from standalone Windows PowerShell with Cursor closed. The script's SHA-256 is `0b87eec3063132b72c87992146ffe226a6f4e524db6c7b7e9a97502e79e2cfeb`, equal to its preservation-manifest entry. It writes to the console only, so no restoration log is retained.
   - **Verified now:** `candidate.sh` (`01043cee…`, 9626 B), `Assert-C1.ps1` (`17cffa68…`, 72688 B) and this file's §§0–17 (`07545737…`, 48883 B) equal their reviewed C1-package bytes. Their last-write times are 10:34:01.47–.50, before the 10:43:34 run.
   - **Scope:** of the 103 incident files, only these three have changed since the incident. The other 100 still have their incident hashes. This record restores none of them, including the loose EXP-03 prep and validation files whose packaged copies remain intact.

### 18.6 Execution compliance and deviations

**Compliant:**
- exactly one case, C-1;
- the §9.3 harness line byte-exact, with the frozen plan, `-Env`, wrappers, 180 s watchdog, 262144 B retention and 256 B READY prefix (S2 PASS);
- effective sources equal to the manifest before and after (§18.3, §18.4), with no source edit and no regenerated `SHA256SUMS`;
- no retries, probes or added cases (Keith's account; consistent with the evidence).

**Deviations (recorded, not waived):**
- **Manual execution.** Keith ran Step 3 from standalone Windows PowerShell rather than through the agent's recorded child-process method. Whether the launcher ran in a fresh child process is not recorded.
- **Launcher wrapper lines** around the byte-exact §9.3 harness line (§18.2).
- **Missing records.** The pre-execution precheck output, the assertion command line and the outer capture commands were not retained. The `AISB_*` and PowerShell-version prechecks rest on Keith's account, apart from the S1 / S2 evidence in §18.3.
- **Late execution manifest.** This record pass produced the execution manifest (§18.7), not the execution itself. It hashes the retained files as found.
- **Preparation incidents** (§18.5) occurred before execution. None of them ran the candidate, harness, fixture or assertion script: `evidence\C-1` and `evidence\batch.json` were confirmed absent after them, and the only case record is from the 10:43:34 run.

### 18.7 Execution manifest and packages

- **Execution manifest:** `evidence\step3-record\EXECUTION-SHA256SUMS`, 1535 B, SHA-256 `b7ba6989b8fa89efa00953648039679254d9f6d3c57bdd54c7c4300b63746be9`. It has 15 entries, matching the 15 entries of the retained ZIP. The preparation manifest `SHA256SUMS` is not overwritten.
- **Retained execution package:** `evidence\EXP-03-manual-step3-review.zip` (`0d728941…`), preserved unmodified.
- **Step 3 record package:** `evidence\step3-record-export\`. Its bundle hash is recorded beside the bundle, not here, because the bundle contains this record.
- **Other packages:** the original (`21e9aab3…`), C1 (`dc81e315…`) and preservation (`e888a410…`) packages are unchanged.

### 18.8 Bounded conclusion, write set, non-effects

**Candidate outcome: C-1 PASS, bounded.** This holds on this Windows / MSYS bash 5.2.15 fixture only:
- conservative full-allocation session charging reduced c2's stdout slice to 12158 B, because c1's full allocation was charged;
- the OUT filter's own byte check exhausted that slice at record 249;
- the filter wrote one correct marker, drained its producer to EOF and returned 3;
- the gate recorded `STOPPED CAP`, and c3 was not dispatched;
- channel output was byte-exact and within 65536 B / 2000 L.

**Not established:**
- reaching the actual 65536 B limit (61282 B were written), or the 2000 L bound being binding;
- ERR-slice exhaustion or `BUDGET-EXHAUSTED`;
- producer termination: the producer was drained, not stopped;
- the 15 s / 120 s deadlines, HOST-DEADLINE, 124 / 137 propagation or any timeout enforcement;
- `sudo`, FG-6 survivors or Linux behaviour;
- process-substitution or here-string backing on H, remote delivery or termination, and pid reuse;
- host readiness.

§12 stands. Readiness NO. Host use BLOCKED. Stage B NOT AUTHORIZED. Not accepted. Not locked. Step 4, the independent review and lock of the experiment record, is NOT AUTHORIZED.

**Write set (this record):**
- this section, appended;
- this task's `TASKS.md` records: the header line, lines 21 / 46 / 51, `PM2_RECOVERY_MECH_EXP_03_STEP_3` and new `PM2_RECOVERY_MECH_EXP_03_STEP_3_*` fields;
- this task's backlog body: the Status line, lifecycle item 3 and the appended Step 3 lines;
- `evidence\step3-record\` and `evidence\step3-record-export\`.

**Non-effects:**
- **Execution:** no candidate, harness, fixture, assertion-script, probe or recorder runs in this pass. `Record-Step3.ps1` was read only.
- **Edits:** no source edits, incident-file restorations or writes to the MECH-EXP-01 / MECH-EXP-02 trees or packages. Predecessor records and this file's §§0–17 were not edited, and neither were the sidecar, catalog or `lockedTaskIds`.
- **Saturation proof:** the repository `SATURATION_PROOF.json` is not mutated. The validator proof is under `evidence\step3-record\validation\`.
- **Process:** no host access, Stage B, successor registration, acceptance or lock. STAGING was not acquired. No Git stage, commit, push, branch, reset, restore or clean. No subagents.
- **State:** occupancy EMPTY; Lane 3 DISABLED.

GOVERNANCE was acquired transiently for these records, then released UNOWNED.

**Status: PM2-RECOVERY-MECH-EXP-03 — Step 3 C-1 execution COMPLETE and RECORDED — C-1 PASS (bounded) — 2026-10-02 at baseline `946050ca89addc8b497f378dcb1470e33286b7b6`. Step 4 NOT AUTHORIZED. Not accepted. Not locked.**

## 19. Documentation correction (2026-10-03) — appended; §§0–17 are not edited

Keith authorized this narrow documentation correction after the three-file EOL restoration. This section supersedes two statements in §18. The remainder of the §18 evidence record stands. This pass performs no experiment, harness run, assertion run, probe, Step 4, or lock. The bytes through the end of §18 (66939 B, SHA-256 `563d05f2b3201c8d1df7aa3d0d523f84c4530d012e48ffc4aaadd2fcfe6f32cb`) are preserved. §§0–17 remain SHA-256 `075457374971ef14ead0d8224491e99a772241eee60ec12c736912780d0ea2eb` / 48883 B.

### 19.1 Line-ending incident (§18.5 item 5)

The §18.5 item 5 sentence "101 files went from LF to CRLF" is withdrawn.

Established facts:

- 103 files had the incident timestamp.
- 101 were CRLF afterward and 2 TypeScript files remained LF.
- Eight EXP-01 stage-a files were already CRLF and byte-identical to the earlier reviewed package.
- Some files are proven new CRLF conversions, and some remain unknown.
- The writer is not attributed.

### 19.2 `elapsedSec` (§18.4 Containment)

The §18.4 sentence "Candidate exit 0 after 1.127 s" is withdrawn. The retained `result.json` field `elapsedSec` is serialized as `1.1271073999999999`, the value cited as 1.1271074. That value is harness elapsedSec at result creation. It is not candidate runtime. It supplies no timing-enforcement claim.

These retained facts stay separate from `elapsedSec`:

- process exit 0;
- no harness intervention;
- zero survivors;
- job closed.

### 19.3 Unchanged conclusions

The Step 3 record otherwise stands. C-1 PASS remains bounded. Readiness remains NO. Host use remains BLOCKED. Stage B remains NOT AUTHORIZED. Step 4 remains NOT AUTHORIZED. The task is not accepted and not locked.

### 19.4 Write set and non-effects

**Write set:** this section; the current EXP-03 board status lines and the current `PM2_RECOVERY_MECH_EXP_03_STEP_3_CONTAINMENT` field; the current EXP-03 backlog status line and the correction paragraph in that body. Review diffs and the lane-capacity proof are written off-repo.

**Preserved:** source files; the existing review ZIP; §§0–17 byte-for-byte; the §18 evidence record apart from the two statements this section supersedes.

**Non-effects:** no experiment, harness, assertion, probe, Step 4, lock, or host action. STAGING was not acquired. The repository `SATURATION_PROOF.json` was not written. No Git stage, commit, push, restore, reset, or clean. Occupancy EMPTY. Lane 3 DISABLED.

GOVERNANCE was acquired transiently for these records, then released UNOWNED.
