# PM2-RECOVERY-CAPTURE-01 — Stage-Start: Design Freeze

**Task:** PM2-RECOVERY-CAPTURE-01 — Implement and verify the bounded PM2 observation capture mechanism
**Step:** 2 — Design and freeze
**Date:** 2026-09-20
**Baseline:** e5457b55ac86ddd50cad38434a70f061153d949e
**Nature:** IMPLEMENTATION (4-step lifecycle)
**Status:** Step 3 IN PROGRESS — T-BOUND-04 readiness replaced with non-blocking byte reader under absolute monotonic deadline; partial-then-stalls negative test added; 130 collected / 130 passed / 0 skipped non-root uid=1000 Linux python:3.10-slim pytest 9.1.1; SHA256SUMS verified; Step 4 NOT AUTHORIZED
**MECHANISM_ESTABLISHED:** NO

**Requirements predecessor (LOCKED):** PM2-RECOVERY-ACQUISITION-01 — `docs/PM2-RECOVERY-ACQUISITION-01-STAGE-START.md` §2–§5 (requirements contract), §6.5 (capture child acceptance criteria), §7 decisions (Q1-A ABORT_IF_ABSENT, Q2-B TOOLING, Q3-A NO_RETRY), §5.5 (publication allowlist), §3.2 (target tuple), §3.3 (P5 filtering), §3.4 (bounded invocation), §3.5 (failure conditions), §5.1–§5.4 (private storage and evidence handling)
**Implementation predecessor (LOCKED):** PM2-RECOVERY-VERIFY-01 — `docs/PM2-RECOVERY-VERIFY-01-STAGE-START.md` §4.2 (observation-meta schema), §4.3 (raw jlist input), §4.4 (field-state classification); source `ops/pm2-recovery-verify/compare_dual_env.py`

**Carried selections:** Q1-A ABORT_IF_ABSENT, Q2-B TOOLING, Q3-A NO_RETRY (not re-decided)

---

## 1. Design selection rationale

### 1.1 Language: Python ≥ 3.6

**Minimum API set:** `subprocess.Popen` (child management), `subprocess.run` with `stdout=subprocess.PIPE, stderr=subprocess.PIPE` (utility tool invocation; `capture_output=True` requires Python 3.7 and is not used), `os.waitpid` (explicit reaping), `os.kill` (targeted signaling), `time.monotonic` (CLOCK_MONOTONIC deadlines), `os.open` with `O_CREAT | O_EXCL` (exclusive file creation), `os.pipe` (pipe creation), `os.read` / `os.write` (non-blocking pipe I/O and file writes), `os.set_blocking` (pipe non-blocking mode), `select.poll` (multiplexed I/O readiness), `threading.Thread` (writer thread), `threading.Event` (writer completion signal), `queue.Queue` (thread-safe handoff), `json.dumps` / `json.loads` (safe JSON), `hashlib.sha256` (hashing), `signal.signal` (SIGCHLD disposition and interrupt handlers), `re.fullmatch` (identifier validation), `tempfile.mkdtemp` (private directory), `shutil.which` (tool availability), `pwd.getpwuid` (UID-to-name), `argparse` (argument parsing), `os.geteuid` (effective UID).

All APIs listed above are available in Python ≥ 3.6 (stdlib; no third-party dependencies). `capture_output=True` (Python 3.7+) is not used; `stdout=subprocess.PIPE, stderr=subprocess.PIPE` provides identical functionality.

**Imports:** `subprocess`, `os`, `sys`, `time`, `signal`, `json`, `hashlib`, `stat`, `argparse`, `logging`, `re`, `datetime`, `errno`, `pwd`, `tempfile`, `shutil`, `select`, `threading`, `queue`. All stdlib; no third-party dependencies.

### 1.2 Architecture: Pipe/EOF with separate writer

**Selected design basis** (Keith-authorized 2026-09-20):

1. **Supervisor-mediated stdout/stderr pipes.** The child writes to pipe write ends. The supervisor reads from pipe read ends and passes bytes to a writer thread that persists them to private files. The child never holds or sees the output file descriptors.
2. **Main-thread ownership** of child launch, signaling, and reaping. Only the main thread calls `waitpid`, `kill`, or `Popen`. The writer thread performs only file I/O.
3. **Flag-only interrupt handlers** for SIGINT, SIGTERM, SIGHUP. Handlers set a boolean flag; they do not raise exceptions or call any non-signal-safe function. The flag does not accelerate the locked 30/5/5 escalation sequence.
4. **Separate writer ownership of persistence.** The writer thread owns the output file descriptors from creation through `fsync` and `close`. The supervisor never closes, reads from, reuses, or hashes file descriptors owned by a live writer.
5. **EOF-based stream completion.** `os.read` returning empty bytes on a pipe read end means all write-end holders have closed their ends. This is the kernel completion event — it occurs when the child and all its descendants (and any SCM_RIGHTS recipients) have closed their inherited pipe write ends. EOF, not child exit alone, establishes that the stream is complete.
6. **Checked persistence acknowledgement.** The writer posts ACK_OK only after successful complete writes, `fsync`, and `close` of both output files and the identity log. Thread termination or join-return alone is not sufficient.
7. **Daemon writer thread.** The writer thread is started with `daemon=True`. Ordinary `sys.exit()` does not block waiting for a live writer. For ABANDONED paths, `os._exit(2)` provides immediate process-level termination.

**Pipe-reader closure and SIGPIPE/EPIPE effect (Keith-authorized):**

After drain timeout (§9.3), the supervisor may close pipe read ends and proceed to process exit. Surviving writers — including potentially a daemon that received a transferred descriptor via SCM_RIGHTS — may experience SIGPIPE (signal 13, default action: terminate) or EPIPE on their next `write()`. This is an indirect kernel effect of file-descriptor closure, not an explicit signal sent by the mechanism via `kill()`.

Keith has authorized this design with the disclosed side effect. This acceptance carries no current host risk and authorizes no execution. Any later C-ACQ must explicitly address this effect and its consequences for the target environment.

The prohibitions on broad signals, daemon PID targeting, and process-group kills (acquisition §3.4) are preserved. This clarification is recorded in this successor task; locked predecessor bodies are not rewritten.

### 1.3 Why Bash was withdrawn

See §23 (correction record #7). Bash zombie-protection, `$SECONDS` monotonic, and `lsof` error handling were incorrect.

### 1.4 Prior lsof-based boundary (superseded)

Correction records #7 and #8 (§§23–24) document earlier designs that used `lsof` to check for open file holders after child exit. That approach was marked OPEN because lsof scans are non-atomic, same-UID processes can reopen files, and completeness assumptions could not be verified by the mechanism. The pipe/EOF architecture replaces it: stream completion is a kernel event (EOF), not an external-tool observation.

`lsof` remains required only for socket-holder cross-reference in Phase 1 (§4.1 item 5).

### 1.5 Single-file design

One self-contained script: `ops/pm2-recovery-capture/capture.py`. No companion scripts, configuration files, or build step.

### 1.6 Host prerequisites

- **UA-1:** Python ≥ 3.6 on target host. Absence at C-ACQ → MECHANISM_BLOCKED. These prerequisites do not currently exist; they must be confirmed at C-ACQ.
- **UA-2:** Standard Linux tools: `pgrep`, `lsof`, `sha256sum`, `readlink`, `id`, `stat`. Confirmed at C-ACQ; checked at Phase 0.

---

## 2. Frozen implementation write set

### 2.1 Repository files created by Step 3

| Path | Action | Content |
|---|---|---|
| `ops/pm2-recovery-capture/capture.py` | CREATE | Capture mechanism script |
| `ops/pm2-recovery-capture/tests/test_capture.py` | CREATE | Fake-only test suite (pytest) |
| `ops/pm2-recovery-capture/.gitattributes` | CREATE | `* text eol=lf` |
| `ops/pm2-recovery-capture/SHA256SUMS` | CREATE | SHA-256 of all committed files in the directory **except SHA256SUMS itself** |
| `ops/pm2-recovery-capture/README.md` | CREATE | Purpose, usage, constraints |

No existing repository file is modified by Step 3 implementation.

### 2.3 HOTFILE leases required at implementation admission

| Lease | Path |
|---|---|
| `HOTFILE:ops/pm2-recovery-capture/capture.py` | Primary implementation source |
| `HOTFILE:ops/pm2-recovery-capture/tests/test_capture.py` | Test suite |
| `HOTFILE:ops/pm2-recovery-capture/.gitattributes` | Line-ending convention |
| `HOTFILE:ops/pm2-recovery-capture/SHA256SUMS` | Integrity manifest |
| `HOTFILE:ops/pm2-recovery-capture/README.md` | Documentation |

No catalog mutex required (confirmed by static inspection of `docs/control-plane/mutex-catalog.json`).

### 2.4 Mutexes

GOVERNANCE transient for Step 3 board/registry updates only.

### 2.5 Evidence class

LOCAL-TESTS. Fake-only cases; no PM2, staging, Docker, database, or external service.

---

## 3. Capture mechanism design

### 3.1 Script interface

```
python3 capture.py \
  --account <user>         \
  --pm2-binary <path>      \
  --pm2-home <path>        \
  --observation-id <id>    \
  --host <hostname>        \
  --captured-by <string>   \
  --acq-record <id>        \
  --output-dir <path>
```

**Locked operational limits (§3.4 item 4; constants, no overrides):** Child deadline 30 s from T_invoke, SIGTERM grace 5 s, SIGKILL grace 5 s.

**Frozen design constants:**

| Constant | Value | Purpose |
|---|---|---|
| `TIMEOUT_LIMIT` | 30 s | Child deadline from T_invoke (locked) |
| `TERM_GRACE` | 5 s | SIGTERM → SIGKILL escalation (locked) |
| `KILL_GRACE` | 5 s | SIGKILL → KILL_FAILED (locked) |
| `DRAIN_GRACE` | 5 s | Post-reap pipe drain timeout (design choice) |
| `PERSIST_TIMEOUT` | 5 s | Writer shutdown acknowledgement timeout (design choice) |
| `MEM_CAP` | 16 MiB | Payload byte budget for queued data (design choice; matches verifier `MAX_INPUT_BYTES`) |

The first three are locked by acquisition §3.4. The last three are design choices frozen in this Step 2. None grant additional operational permission.

**Exit codes:**

| Code | Meaning |
|---|---|
| 0 | COMPLETED — child exited, streams drained, persistence confirmed, artifacts finalized, status/E2 records written |
| 1 | FAILED — pre-invocation failure (target, storage, daemon, P5, tool) |
| 2 | FAILED — post-launch failure (launch, KILL_FAILED, identity lost, hash, meta, writer abandoned, supervisor exception, identity record missing, status/E2 write failure) |
| 3 | DEFERRED — child exited, streams not fully drained but persisted prefix confirmed; files preserved unfinalized |
| 10 | USAGE — invalid arguments or missing tools |

Exit 0 may carry anomaly flags (TIMEOUT, NON_ZERO_EXIT, etc.); anomalies do not change the exit code when artifacts are finalized and all records are written. **TIMEOUT restriction (locked §3.5):** Partial output flagged with TIMEOUT is not usable for verification, even when properly finalized.

### 3.2 Execution phases

```
Phase 0: Argument validation, tool check, error handler installation (§16)
Phase 1: Target enforcement (§4)
Phase 2: Fresh private storage creation (§5)
Phase 3: Pre-invocation observations — ACQ-1 (§6)
Phase 4: Bounded jlist invocation and stream capture — ACQ-2 (§7)
Phase 5: Post-invocation observations — ACQ-3 (§8)
Phase 6: Hash binding and observation-meta — ACQ-4 (§10)
Phase 7: Status and E2 records — ACQ-5/ACQ-6 (§11)
```

### 3.3 Diagnostic and privacy model

**Private error handling:** The script installs:

1. A custom `argparse` error handler that overrides `ArgumentParser.error()` and `ArgumentParser.exit()` to emit `[capture] USAGE: invalid arguments` without echoing any supplied argument values.
2. A top-level exception handler (`sys.excepthook` replacement) that emits `[capture] INTERNAL: unhandled exception` to stderr without traceback, argument values, paths, or captured data. This covers main-thread exceptions only; writer-thread exceptions are caught internally (§9.4).

**Diagnostic output:** Fixed-tag `[capture]` messages to stderr via `logging`. No captured data, attempt-directory paths, environment values, tool error messages, or tracebacks. The script never writes diagnostics inside the supervision loop (§7.5). All diagnostic output is emitted before or after supervision.

**Private log routing:** All subprocess stdout/stderr captured by `subprocess.run(stdout=subprocess.PIPE, stderr=subprocess.PIPE)` (Python 3.6-compatible) or routed to pipes/private files.

**Fixed diagnostic status words:** `PASS`, `DAEMON_ABSENT`, `TARGET_INCONSISTENT`, `P5_NOT_SATISFIED`, `OBSERVATION_TOOL_FAILURE`, `STORAGE_FAILURE`, `INVOCATION_FAILED`, `TIMEOUT`, `KILL_FAILED`, `IDENTITY_LOST`, `COMPLETED`, `DEFERRED`, `IDENTITY_CHANGE`, `DAEMON_DISAPPEARED`, `LINGERING_CLIENT`, `AUTO_LAUNCH_SUSPECTED`, `HASH_FAILED`, `META_INVALID`, `MULTIPLE_DAEMON_MATCHES`, `SIGNAL_FAILED`, `SUPERVISOR_EXCEPTION`, `DRAIN_TIMEOUT`, `WRITER_ABANDONED`, `STORAGE_STALL`, `STATE_UNKNOWN`, `IDENTITY_NOT_RECORDED`.

**Publication-allowlist reconciliation:** The status record's `anomaly_flags` uses only the locked §3.5 set (§11.2). Internal-only names are private diagnostics only.

---

## 4. Control: Target enforcement

**Acquisition requirement:** §3.2 target tuple; §2.1 ACQ-1b socket check.

### 4.1 Mechanism

1. **Effective execution identity:** `pwd.getpwuid(os.geteuid()).pw_name`. Compare with `--account`. Mismatch → exit 1. (`os.geteuid()` returns the effective UID, not the real UID; this is correct for setuid execution and matches the process's actual permission scope.)
2. **Binary enforcement:** `os.path.isfile`, `os.access(X_OK)`, `os.path.realpath`. Failure → exit 1.
3. **PM2_HOME enforcement:** `os.path.isdir`, `os.path.realpath`. Failure → exit 1.
4. **Socket enforcement:** `os.path.join(resolved_home, 'rpc.sock')`, `stat.S_ISSOCK`. Missing/non-socket → exit 1 (`DAEMON_ABSENT`).
5. **Socket-holder cross-reference:** `subprocess.run(['lsof', '-t', '--', socket_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)`. Daemon PID must appear among holders. Failure → `TARGET_INCONSISTENT` → exit 1.

### 4.2 Trusted-path assumptions and TOCTOU

`os.path.realpath()` resolves symlinks at call time. Subsequent changes are residual TOCTOU. Assumption **A-TOCTOU**.

### 4.3 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-TARGET-01 | --account differs from effective UID | Exit 1 |
| T-TARGET-02 | pm2-binary nonexistent | Exit 1 |
| T-TARGET-03 | pm2-binary not executable | Exit 1 |
| T-TARGET-04 | pm2-binary dangling symlink | Exit 1 |
| T-TARGET-05 | pm2-home nonexistent | Exit 1 |
| T-TARGET-06 | pm2-home symlink to valid directory | Resolved; proceeds |
| T-TARGET-07 | rpc.sock absent | Exit 1, DAEMON_ABSENT |
| T-TARGET-08 | rpc.sock is regular file | Exit 1, DAEMON_ABSENT |
| T-TARGET-09 | lsof on socket fails | Exit 1, TARGET_INCONSISTENT |
| T-TARGET-10 | Socket held by different PID | Exit 1, TARGET_INCONSISTENT |
| T-TARGET-11 | All valid; socket held by daemon PID | Phase 1 passes |

---

## 5. Control: Fresh private storage

**Acquisition requirement:** §5.1–§5.2.

### 5.1 Directory and file creation

1. `os.umask(0o077)` at startup.
2. `tempfile.mkdtemp(prefix='capture-', dir=output_dir)` → mode 0700.
3. Verify: `realpath == path`, `st_uid == os.geteuid()`, `mode == 0o700`.
4. Exclusive file creation: `os.open(path, O_CREAT | O_EXCL | O_WRONLY, 0o600)` → `os.fdopen()`.

### 5.2 Descriptor ownership model (pipe/EOF architecture)

| Object | Created by | Owned by | Closed by |
|---|---|---|---|
| `stdout.raw` fd | supervisor, pre-T_invoke | **writer thread** | writer (fsync + close on ACK) |
| `stderr.raw` fd | supervisor, pre-T_invoke | **writer thread** | writer (fsync + close on ACK) |
| `child-identity.log` fd | supervisor, pre-T_invoke | **writer thread** | writer (close after identity write, or on ACK/failure) |
| stdout pipe write end | supervisor (`os.pipe`) | child (via Popen) | child / descendants |
| stderr pipe write end | supervisor (`os.pipe`) | child (via Popen) | child / descendants |
| stdout pipe read end | supervisor (`os.pipe`) | supervisor (main thread) | supervisor after drain |
| stderr pipe read end | supervisor (`os.pipe`) | supervisor (main thread) | supervisor after drain |

The child receives pipe write ends as its stdout/stderr via `Popen(stdout=out_w, stderr=err_w, stdin=DEVNULL, close_fds=True)`. `close_fds=True` ensures the child does not inherit the output-file fds, the identity-log fd, or the pipe read ends. The parent closes the pipe write ends immediately after `Popen` returns.

### 5.3 Parent-directory trust and off-repo

The script verifies: `output_dir` exists, is a directory, is writable, is owned by the effective UID (`os.geteuid()`), has no symlink components, and has no forbidden permission bits set. Forbidden bits: `stat.S_IWGRP | stat.S_IWOTH | stat.S_ISVTX` — group-writable, other-writable, or sticky. Numeric permission ordering (e.g., `mode <= 0o755`) is not used because it can admit modes like `0o757` (other-writable+executable). Off-repo placement is an operator prerequisite (**E-OFFREPO**).

### 5.4 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-STORE-01 | output-dir not writable | Exit 1 |
| T-STORE-02 | Ownership mismatch (st_uid ≠ geteuid) | Exit 1 |
| T-STORE-03 | File exists at target path | OSError from O_EXCL |
| T-STORE-04 | Normal creation | Dir 0700; files 0600 |
| T-STORE-05 | Symlink in output-dir | Exit 1 |
| T-STORE-06 | Parent dir group-writable (S_IWGRP set) | Exit 1 |
| T-STORE-07 | Parent dir other-writable (S_IWOTH set) | Exit 1 |
| T-STORE-08 | Parent dir mode 0o757 | Exit 1 (forbidden bits detected despite numeric ≤ 0o757 being false) |

---

## 6. Control: Pre-invocation observations (ACQ-1)

**Acquisition requirement:** §2.1 ACQ-1a–1e; all output privately routed.

### 6.1 Mechanism

**ACQ-1a — T_obs_start:** `datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')`.

**ACQ-1b — Socket observation:** Verified in Phase 1 (§4.1). Socket-holder enumeration via lsof in §4.1 item 5.

**ACQ-1c — Daemon PID:** `subprocess.run(['pgrep', '-af', 'God Daemon', '-u', account], stdout=subprocess.PIPE, stderr=subprocess.PIPE)`.
- returncode 0: parse single line. Multiple → TARGET_INCONSISTENT. Malformed → OBSERVATION_TOOL_FAILURE.
- returncode 1: no match → DAEMON_ABSENT → exit 1.
- returncode < 0 or ≥ 2: tool failure → exit 1.
- Cross-reference daemon PID with socket-holder list (§4.1 item 5).

**ACQ-1d — Pre-observation record:** JSON via `json.dumps()`.

**ACQ-1e — P5 check:** PID-based exclusion (exclude daemon PID, own PID, pgrep PID). Remaining → P5_NOT_SATISFIED → exit 1.

### 6.2 Verification cases

| Case ID | Expected |
|---|---|
| T-PRE-01 | Single daemon, no CLI children → PASS |
| T-PRE-02 | No pm2 processes → DAEMON_ABSENT |
| T-PRE-03 | pgrep exit 2 → OBSERVATION_TOOL_FAILURE |
| T-PRE-04 | Daemon + CLI child → P5_NOT_SATISFIED |
| T-PRE-05 | Two daemon matches → MULTIPLE_DAEMON_MATCHES |
| T-PRE-06 | pgrep killed (returncode -9) → OBSERVATION_TOOL_FAILURE |
| T-PRE-07 | Malformed output → OBSERVATION_TOOL_FAILURE |
| T-PRE-08 | Daemon PID not among socket holders → TARGET_INCONSISTENT |

---

## 7. Control: Bounded jlist invocation and stream capture (ACQ-2)

**Acquisition requirement:** §3.4 bounded invocation/monitoring/termination; §2.1 ACQ-2a–2d.

### 7.1 Pre-launch preparation (before T_invoke)

All preparatory I/O is completed before the invocation timestamp so that file-creation and pipe-setup latency does not consume the 30 s deadline:

1. Create output files (`stdout.raw`, `stderr.raw`, `child-identity.log`) via `create_private_file()`. All three file fds are passed to the writer thread (§9.4). The supervisor does not retain file fds after this point.
2. Create two pipes: `out_r, out_w = os.pipe(); err_r, err_w = os.pipe()`.
3. Set pipe read ends non-blocking: `os.set_blocking(out_r, False); os.set_blocking(err_r, False)`.
4. Start the writer thread (§9.4), passing it all file fds (stdout, stderr, identity) and the data queue. The writer thread is started with `daemon=True` (§1.2 item 7).

No file fds remain open in the main thread after step 4.

### 7.2 SIGCHLD disposition and signal handlers

**Before launch:**
- `signal.signal(signal.SIGCHLD, signal.SIG_DFL)` — explicitly established, not merely asserted. If the inherited disposition is `SIG_IGN` (which would prevent zombie creation and make `waitpid` unreliable), this call corrects it.
- Install flag-only handlers for SIGINT, SIGTERM, SIGHUP: `interrupted = False; def handler(sig, frame): nonlocal interrupted; interrupted = True`.

### 7.3 Launch and identity recording

```python
budget_used = 0  # initialized once; carried into supervision loop
identity_recorded = True

T_invoke_utc = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
T_invoke_mono = time.monotonic()

proc = subprocess.Popen(
    [resolved_binary, 'jlist'],
    stdout=out_w, stderr=err_w, stdin=subprocess.DEVNULL,
    close_fds=True,
    env=dict(os.environ, PM2_HOME=resolved_home),
)
child_pid = proc.pid
child_state = LAUNCHED

# All cleanup-required escalation state initialized before any
# post-launch code that could reach _bounded_terminate
sigterm_sent = False
sigkill_sent = False
sigterm_mono = 0.0
sigkill_mono = 0.0

os.close(out_w)
os.close(err_w)

try:
    identity_data = '{}\n'.format(child_pid).encode('ascii')
    data_queue.put_nowait((IDENTITY_TAG, identity_data))
    budget_used += len(identity_data)
except Exception:
    identity_recorded = False
    # PID retained in proc.pid; supervision continues
```

**Launch failure:** `Popen()` raises → no child exists → child_state remains unset → exit 2 (INVOCATION_FAILED). `Popen` either returns with a valid `proc.pid` or raises; no intermediate state exists.

**Post-launch pipe-end closure:** `os.close(out_w)` and `os.close(err_w)` are non-blocking kernel calls. If either raises (should not happen with valid fds), the exception is caught by the post-launch `BaseException` handler (§7.5) which calls `_bounded_terminate` with the initialized escalation state and `T_invoke_mono`.

**Identity recording:** After launch, enqueue `(IDENTITY, pid_bytes)` to the data queue. Payload size (< 32 bytes) is accounted against `MEM_CAP` via `budget_used`. The writer thread writes it to `child-identity.log`. If enqueue fails, `identity_recorded` is set to `False`. No synchronous file I/O occurs after T_invoke. Supervision proceeds regardless — PID is known in `proc.pid` in memory. However, a missing identity record prevents COMPLETED (exit 0): the capture exits FAILED (exit 2) after supervision because the required identity artifact is absent.

### 7.4 Exclusive reaping, child state, and Popen bookkeeping

Only `os.waitpid(proc.pid, os.WNOHANG)` in the supervision loop reaps the child. Never `proc.poll()`, `proc.wait()`, `proc.communicate()`, or context-manager use.

**Authoritative child state** (main-thread only; writer thread never reads or writes):

| State | Meaning | Signaling allowed? |
|---|---|---|
| `LAUNCHED` | Popen returned successfully; PID valid; not yet reaped | YES |
| `REAPED` | `waitpid` collected exit status; PID freed by kernel | NO |
| `IDENTITY_LOST` | `ChildProcessError` from `waitpid` or `os.kill` — PID may be reused | NO |
| `STATE_UNKNOWN` | Exception during reap, status decode, or ambiguous waitpid outcome | NO |
| `KILL_FAILED` | SIGKILL + KILL_GRACE expired; child still alive (PID not freed) | NO (further signaling futile) |

**Invariant:** `os.kill(proc.pid, ...)` is called only when `child_state == LAUNCHED`. All terminal states (REAPED, IDENTITY_LOST, STATE_UNKNOWN, KILL_FAILED) are irreversible. No signal is sent after entering a terminal state.

After reaping: `child_state` is set to `REAPED` **before** `proc.returncode` assignment. This ensures that if `_decode_wait_status` raises an exception, the state is already `REAPED` (not `LAUNCHED`), preventing signaling a freed PID:

```python
if pid_result != 0:
    child_state = REAPED  # FIRST: state transition
    try:
        proc.returncode = _decode_wait_status(raw_status)
        child_exit = proc.returncode
    except Exception:
        child_state = STATE_UNKNOWN  # decode failed; status indeterminate
        break
    reap_mono = time.monotonic()
```

KILL_FAILED: `proc.returncode` left `None`; `Popen.__del__` may attempt `waitpid(WNOHANG)` which is harmless.

### 7.5 Supervision loop

The main thread runs a single loop that multiplexes pipe reading, child-status checking, and deadline enforcement. **No file I/O, logging, `fsync`, timestamps-to-file, or diagnostic output occurs inside this loop.** All persistence is handled by the writer thread. Events (timestamps, state changes) are recorded in in-memory lists and flushed after supervision.

**Memory accounting:** `budget_used` is initialized once in §7.3 (before identity enqueue) and carried into the supervision loop without re-initialization. It tracks payload bytes currently in-flight: bytes enqueued to `data_queue` minus bytes acknowledged by the writer via `ack_queue`. This includes the writer's current in-flight chunk (added at enqueue, subtracted at ack) and the identity record. `MEM_CAP` (16 MiB) is a payload-byte budget only; Python object overhead (tuple wrappers, queue internals, bytes object headers) is not counted. Total Python heap usage is proportional but higher; the 16 MiB constant is chosen to keep total process memory well within reasonable limits.

```python
LAUNCHED = 'LAUNCHED'
REAPED = 'REAPED'
IDENTITY_LOST = 'IDENTITY_LOST'
STATE_UNKNOWN = 'STATE_UNKNOWN'
KILL_FAILED_STATE = 'KILL_FAILED'

poller = select.poll()
poller.register(out_r, select.POLLIN)
poller.register(err_r, select.POLLIN)

eof = {out_r: False, err_r: False}
# child_state, budget_used, identity_recorded, sigterm_sent, sigkill_sent,
# sigterm_mono, sigkill_mono all initialized in §7.3 and carried here
child_exit = None
reap_mono = 0.0
storage_failed = False

try:
  while True:
    # 1. Drain writer acks (bounded: at most 64 per iteration)
    for _ in range(64):
        try:
            n = ack_queue.get_nowait()
            if n < 0:
                storage_failed = True  # writer reported failure via negative ack
            else:
                budget_used -= n
        except queue.Empty:
            break

    # 2. Check writer failure (non-blocking)
    if not storage_failed and writer_event.is_set():
        if result_slot[0] is not ACK_OK:
            storage_failed = True
            # Do NOT break; continue supervising until child exits

    # 3. Poll pipes with capacity reservation
    avail = MEM_CAP - budget_used
    readable_fds = [fd for fd in (out_r, err_r)
                    if not eof[fd] and avail > 0]
    timeout_ms = 200
    if child_state == REAPED:
        remaining = DRAIN_GRACE - (time.monotonic() - reap_mono)
        if remaining <= 0:
            break  # drain timeout
        timeout_ms = min(timeout_ms, int(remaining * 1000))

    if readable_fds:
        ready = poller.poll(timeout_ms)
        for fd, event in ready:
            if eof[fd]:
                continue
            avail_now = MEM_CAP - budget_used
            if avail_now <= 0:
                break  # no capacity; defer reading to next iteration
            data = os.read(fd, min(65536, avail_now))
            if not data:
                eof[fd] = True
                poller.unregister(fd)
            else:
                data_queue.put_nowait((stream_tag(fd), data))
                budget_used += len(data)
    else:
        # No readable fds (at capacity or all EOF); wait briefly
        time.sleep(min(0.2, timeout_ms / 1000))

    # 4. Child status check
    if child_state == LAUNCHED:
        try:
            pid_result, raw_status = os.waitpid(proc.pid, os.WNOHANG)
        except ChildProcessError:
            child_state = IDENTITY_LOST
            break
        except Exception:
            # Non-ChildProcessError from waitpid: kernel state ambiguous.
            # Child may or may not have been reaped. Fail closed.
            child_state = STATE_UNKNOWN
            break
        if pid_result != 0:
            child_state = REAPED
            try:
                proc.returncode = _decode_wait_status(raw_status)
                child_exit = proc.returncode
            except Exception:
                child_state = STATE_UNKNOWN
                break
            reap_mono = time.monotonic()

    # 5. Deadline enforcement (only while child state is LAUNCHED)
    if child_state == LAUNCHED:
        now = time.monotonic()
        elapsed = now - T_invoke_mono
        if sigkill_sent and (now - sigkill_mono) >= KILL_GRACE:
            child_state = KILL_FAILED_STATE
            break
        elif sigterm_sent and not sigkill_sent \
                and (now - sigterm_mono) >= TERM_GRACE:
            _safe_kill(proc.pid, signal.SIGKILL)
            sigkill_sent = True
            sigkill_mono = time.monotonic()
        elif not sigterm_sent and elapsed >= TIMEOUT_LIMIT:
            _safe_kill(proc.pid, signal.SIGTERM)
            sigterm_sent = True
            sigterm_mono = time.monotonic()

    # 6. Completion check
    if child_state == REAPED and eof[out_r] and eof[err_r]:
        break  # stream completion
    if child_state == KILL_FAILED_STATE:
        break

except BaseException:
    _bounded_terminate(proc, child_state, T_invoke_mono,
                       sigterm_sent, sigterm_mono,
                       sigkill_sent, sigkill_mono)
    sys.exit(2)
```

**Key loop properties:**
- **Capacity reservation before read:** `avail_now` is checked before each `os.read`. The read size is limited to `min(65536, avail_now)`. At zero capacity, no read occurs. No consumed bytes are discarded. No corrupted partial read can occur.
- **Single budget initialization:** `budget_used` is initialized once in §7.3 and carried into the loop. The identity ack correctly decrements budget_used back to zero (never negative).
- Every call is non-blocking or bounded: `poll(timeout_ms)`, `os.read` on non-blocking fd limited to available capacity, `waitpid(WNOHANG)`, `os.kill`, `time.monotonic`, `ack_queue.get_nowait`, `data_queue.put_nowait`.
- `queue.Queue` uses internal locks for thread safety. These locks are held for constant-time enqueue/dequeue operations — never across file I/O. The writer thread acquires the lock only to dequeue, then releases it before any `os.write`.
- Ack-queue drain is bounded to 64 items per iteration to prevent deadline starvation from continuous output.
- Budget-full: when `budget_used >= MEM_CAP`, no stream fds are included in `readable_fds`. The supervisor does not read from pipes. The child's pipe buffer fills; the child may block on `write()` and enters the locked 30/5/5 sequence. No byte is dropped. EOF detection is deferred until capacity is freed by writer acks (or drain timeout fires).
- **Early writer failure:** `writer_event` is checked non-blockingly each iteration. Only `ACK_OK` is success; any other `result_slot[0]` value (ACK_FAIL, `None`, unknown) → `storage_failed`. Fail closed.
- **Broad waitpid catch:** Both `ChildProcessError` (ECHILD — no such child) and any other exception from `os.waitpid` are caught. Non-ChildProcessError exceptions set `child_state = STATE_UNKNOWN` because the kernel's reap state is ambiguous.

**`_safe_kill`:** catches ESRCH (process gone), EPERM (cannot signal) — loop continues. Signal failure does not break the loop.

**`_decode_wait_status`:** `os.WIFEXITED` → `os.WEXITSTATUS` (0..255); `os.WIFSIGNALED` → `-(os.WTERMSIG)` (negative); else → raises `ValueError` (unknown encoding; caught by STATE_UNKNOWN handler).

### 7.6 Bounded terminate (exception path)

```python
def _bounded_terminate(proc, child_state, T_invoke_mono,
                       sigterm_sent, sigterm_mono,
                       sigkill_sent, sigkill_mono):
    if child_state != LAUNCHED:
        return  # REAPED, IDENTITY_LOST, STATE_UNKNOWN, KILL_FAILED:
                # no signaling permitted
    # Preserve the locked 30/5/5 sequence from the original invocation
    if not sigterm_sent:
        # Wait until the original 30s deadline before sending SIGTERM.
        # The child may exit normally during this wait.
        initial_deadline = T_invoke_mono + TIMEOUT_LIMIT
        while time.monotonic() < initial_deadline:
            try:
                r, st = os.waitpid(proc.pid, os.WNOHANG)
            except ChildProcessError:
                return  # child already gone
            except Exception:
                return  # ambiguous; stop signaling
            if r:
                proc.returncode = _decode_wait_status(st)
                return  # child exited during initial wait
            time.sleep(0.05)
        _safe_kill(proc.pid, signal.SIGTERM)
        sigterm_mono = time.monotonic()
    # Wait remaining TERM_GRACE from sigterm_mono
    term_deadline = sigterm_mono + TERM_GRACE
    while time.monotonic() < term_deadline:
        try:
            r, st = os.waitpid(proc.pid, os.WNOHANG)
        except ChildProcessError:
            return
        except Exception:
            return  # ambiguous; stop signaling
        if r:
            proc.returncode = _decode_wait_status(st)
            return
        time.sleep(0.05)
    if not sigkill_sent:
        _safe_kill(proc.pid, signal.SIGKILL)
        sigkill_mono = time.monotonic()
    # Wait remaining KILL_GRACE from sigkill_mono
    kill_deadline = sigkill_mono + KILL_GRACE
    while time.monotonic() < kill_deadline:
        try:
            r, st = os.waitpid(proc.pid, os.WNOHANG)
        except ChildProcessError:
            return
        except Exception:
            return  # ambiguous; stop
        if r:
            proc.returncode = _decode_wait_status(st)
            return
        time.sleep(0.05)
    # KILL_FAILED — child becomes orphan
```

Uses the locked 30s→SIGTERM→5s→SIGKILL→5s sequence from the original invocation timestamp. No unconditional SIGKILL. All waits are non-blocking polls with bounded loops. No `waitpid(pid, 0)`.

**Initial deadline preservation:** If no SIGTERM has been sent, the function continues non-blocking child checks until the original 30 s deadline (`T_invoke_mono + TIMEOUT_LIMIT`) before sending SIGTERM. The child may exit normally during this period, in which case the function returns without signaling. This preserves the full locked sequence even when entered from an exception path.

**Escalation preservation:** If SIGTERM was already sent during supervision, SIGTERM is not re-sent and the remaining TERM_GRACE is computed from the original `sigterm_mono`. If SIGKILL was already sent, SIGKILL is not re-sent and the remaining KILL_GRACE is computed from the original `sigkill_mono`. Grace periods are never restarted.

**Pre-launch initialization:** All escalation variables (`sigterm_sent`, `sigkill_sent`, `sigterm_mono`, `sigkill_mono`) are initialized in §7.3 immediately after `child_state = LAUNCHED`, before any post-launch code (pipe-end closure, identity enqueue) that could reach this function via exception.

**Child-state guard:** The function checks `child_state` before any action. An exception after `child_state = REAPED` or `child_state = STATE_UNKNOWN` correctly prevents signaling.

**Exception safety within `_bounded_terminate`:** Non-ChildProcessError exceptions from `waitpid` inside `_bounded_terminate` cause an immediate return — no further signaling. If `_decode_wait_status` raises, `proc.returncode` remains `None`; the child is already reaped, so no PID reuse risk.

### 7.7 Post-loop states

| State | child_state | child_exit | eof_both | storage_failed | identity_recorded | Proceed to? |
|---|---|---|---|---|---|---|
| Stream complete | REAPED | integer | True | False | True | → writer shutdown (§9.2) |
| Stream complete + storage failure | REAPED | integer | True | True | — | → exit 2 (storage failure; artifacts partial) |
| Stream complete + identity not recorded | REAPED | integer | True | False | False | → exit 2 (identity record required) |
| Drain timeout | REAPED | integer | False | — | — | → writer shutdown (§9.2 drain path) |
| Unknown wait status | STATE_UNKNOWN | None | — | — | — | → writer shutdown (§9.2 terminal path) then exit 2 |
| ChildProcessError | IDENTITY_LOST | — | — | — | — | → writer shutdown (§9.2 terminal path) then exit 2 |
| KILL_FAILED | KILL_FAILED | — | — | — | — | → writer shutdown (§9.2 terminal path) then exit 2 |
| BaseException | — | — | — | — | — | → _bounded_terminate → sys.exit(2); daemon writer killed |

**After reaping:** `child_state == REAPED`. No signal sent. PID freed.

**T_post_cmd:** Recorded only after confirmed reap (child_state == REAPED with child_exit is not None): `datetime.datetime.utcnow()`.

### 7.8 Elapsed-time accounting

Deadlines use `time.monotonic()` (CLOCK_MONOTONIC; PEP 418). Evidence timestamps use `datetime.datetime.utcnow()` (wall clock). Never mixed. Scheduling: the design does not claim real-time guarantees. Assumption **A-SCHED**.

### 7.9 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-INVOKE-01 | Fake pm2 exits 0 with stdout | child_exit=0; stdout.raw has content |
| T-INVOKE-02 | Fake pm2 exits code 1 | child_exit=1; NON_ZERO_EXIT |
| T-INVOKE-03 | Fake pm2 sleeps 60 s | SIGTERM at ~30 s |
| T-INVOKE-04 | Fake ignores SIGTERM | SIGTERM → SIGKILL at ~35 s |
| T-INVOKE-05 | Binary not executable | Exit 2, INVOCATION_FAILED |
| T-INVOKE-06 | Identity enqueue fails | identity_recorded=False; proc.pid retained; monitoring continues; COMPLETED blocked |
| T-INVOKE-07 | KILL_FAILED (fault-injected) | child_state=KILL_FAILED; exit 2; files not finalized |
| T-INVOKE-08 | Monotonic deadline (monkeypatch) | Fires at correct offset from T_invoke_mono |
| T-INVOKE-09 | Inherited SIGCHLD=SIG_IGN | Reset to SIG_DFL before launch; zombie observable |
| T-INVOKE-10 | os.kill ESRCH | _safe_kill catches; loop continues |
| T-INVOKE-11 | os.kill EPERM | _safe_kill catches; KILL_FAILED eventual |
| T-INVOKE-12 | ChildProcessError from waitpid | child_state=IDENTITY_LOST; exit 2 |
| T-INVOKE-13 | BaseException during loop | _bounded_terminate with T_invoke_mono and current escalation state; exit 2 |
| T-INVOKE-14 | Unknown wait status (_decode raises) | child_state=STATE_UNKNOWN; exit 2 |
| T-INVOKE-15 | Post-reap SIGINT sets flag | No escalation change; drain continues normally |
| T-INVOKE-16 | Repeated SIGINT | Flag set once; no effect on 30/5/5 |
| T-INVOKE-17 | Exception after REAPED but before returncode set | child_state=STATE_UNKNOWN (not LAUNCHED); _bounded_terminate does nothing |
| T-INVOKE-18 | Exception during post-launch pipe-end closure | Escalation vars initialized; _bounded_terminate waits for original deadline; child properly terminated |
| T-INVOKE-19 | Writer ACK_FAIL during supervision | storage_failed=True; child supervision continues normally |
| T-INVOKE-20 | Budget exactly at MEM_CAP; child writes more | No read; child blocks; TIMEOUT fires normally |

---

## 8. Control: Post-invocation observations (ACQ-3)

**Acquisition requirement:** §2.1 ACQ-3a–3d.

Executed only if `child_state == REAPED` and `child_exit is not None`.

### 8.1 Mechanism

**ACQ-3a — T_post:** UTC timestamp.
**ACQ-3b — Daemon PID:** pgrep (`subprocess.run` with `stdout=subprocess.PIPE, stderr=subprocess.PIPE`); compare with pre-invocation. Tool errors logged privately.
**ACQ-3c — Socket holders:** lsof on socket. Unexpected holders recorded.
**ACQ-3d — P5 post check:** PID-based filtering. Tool errors logged privately.

### 8.2 Anomaly detection

| Condition | Published anomaly flags |
|---|---|
| Daemon absent | `DAEMON_DISAPPEARED`, `AUTO_LAUNCH_SUSPECTED` |
| Daemon PID changed | `IDENTITY_CHANGE`, `AUTO_LAUNCH_SUSPECTED` |
| CLI children remain | `LINGERING_CLIENT` |

Unknown post-observation results: fields omitted (not fabricated). Post-observation tool errors are private diagnostics only.

### 8.3 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-POST-01 | Daemon PID unchanged post-invocation | No anomaly flags |
| T-POST-02 | Daemon absent at post-check | DAEMON_DISAPPEARED, AUTO_LAUNCH_SUSPECTED |
| T-POST-03 | Daemon PID changed | IDENTITY_CHANGE, AUTO_LAUNCH_SUSPECTED |
| T-POST-04 | CLI children remain at ACQ-3d | LINGERING_CLIENT |
| T-POST-05 | Post pgrep exit ≥ 2 | Logged privately; post_daemon_pid field omitted |
| T-POST-06 | Post pgrep killed (returncode < 0) | Logged privately; post_daemon_pid field omitted |
| T-POST-07 | Multiple daemon matches at post-check | Logged privately; anomaly recorded |

---

## 9. Control: Stream completion and persistence boundary

**Acquisition requirement:** §3.4 item 6 (output-writer boundary before hashing); §3.5 KILL_FAILED.

### 9.1 Boundary definition

**The boundary is established when all six conditions hold:**

1. **Child exit confirmed:** `child_state == REAPED`, `child_exit is not None`.
2. **Both streams drained to EOF:** `eof[out_r] == True` and `eof[err_r] == True`. EOF means `os.read` returned empty bytes — all pipe write-end holders have closed their ends (kernel guarantee).
3. **Persistence acknowledged:** writer thread posted `ACK_OK` (§9.4) — both output files and identity log successfully written, fsync'd, and closed.
4. **No storage failure:** no ENOSPC, write error, or other I/O failure during persistence. `storage_failed == False`.
5. **No identity failure:** `child_state` is `REAPED` (not `IDENTITY_LOST`, `STATE_UNKNOWN`, or `KILL_FAILED`).
6. **Identity recorded:** `identity_recorded == True`.

Missing any condition → no hash, no observation-meta, no COMPLETED.

**Distinctions:**

- **EOF** = stream completion. All writers have closed. No more bytes will arrive.
- **ACK_OK** = completed artifacts. Bytes are durably on disk, files are closed.
- **A-SINGLE-UID-TRUST** = trust that no unrelated same-UID process reopens/modifies the artifacts. This is an external assumption, not a mechanism property.

### 9.2 Writer shutdown protocol

Writer shutdown occurs after every post-launch supervision loop exit, not only after stream-complete. The writer thread runs as a daemon thread (`daemon=True`), so `sys.exit()` does not block waiting for it.

**Stream-complete path** (eof both, child reaped, `storage_failed == False`, `identity_recorded == True`):

1. Send STOP sentinel to data queue: `data_queue.put_nowait(SENTINEL)`.
2. Wait for writer's completion event: `writer_event.wait(timeout=PERSIST_TIMEOUT)`.
3. Check result (fail closed — only explicit `ACK_OK` is success):
   - `result_slot[0] is ACK_OK` → boundary established → proceed to Phase 5.
   - `result_slot[0]` is `ACK_FAIL`, `None`, or any other value → persistence failed → exit 2.
   - Event not set → **ABANDONED** (§9.5) → exit 2 via `os._exit(2)`.

**Stream-complete + early storage failure** (`storage_failed` set during supervision):

Skip STOP sentinel and writer wait. Writer already reported failure. → exit 2. Writer daemon thread is killed on process exit.

**Stream-complete + identity not recorded** (`identity_recorded == False`):

Send STOP sentinel and wait for writer (to finalize whatever partial artifacts exist). Regardless of writer result: → exit 2 (IDENTITY_NOT_RECORDED). Required identity record is absent; COMPLETED is blocked.

**Drain timeout** (eof not both, child reaped):

1. Close pipe read ends (SIGPIPE/EPIPE disclosed, §1.2).
2. Send STOP sentinel: `data_queue.put_nowait(SENTINEL)`.
3. Wait: `writer_event.wait(timeout=PERSIST_TIMEOUT)`.
4. Outcome — writer failure supersedes drain timeout:
   - `ACK_OK` → DEFERRED (exit 3). Partial stream persisted.
   - `ACK_FAIL` or `None` → FAILED (exit 2). Persistence failed.
   - Event not set → ABANDONED → FAILED (exit 2) via `os._exit(2)`.

**KILL_FAILED / STATE_UNKNOWN / IDENTITY_LOST:**

1. Send STOP sentinel to writer (best-effort: `data_queue.put_nowait(SENTINEL)`).
2. Do NOT wait for writer. Files are potentially-changing (KILL_FAILED) or child state indeterminate.
3. → exit 2 via `os._exit(2)`. Writer daemon thread is killed on process exit.

**BaseException:**

No writer shutdown. `_bounded_terminate` then `sys.exit(2)`. Writer daemon thread is killed on process exit.

### 9.3 Drain timeout

If `DRAIN_GRACE` (5 s) elapses after child reap without EOF on both pipes, surviving writers still hold pipe write ends. The supervisor:

1. Stops reading. Closes pipe read ends. Remaining kernel-buffered bytes are discarded.
2. Sends STOP to writer. Waits `PERSIST_TIMEOUT`.
3. Outcome depends on writer result (§9.2 precedence). Writer failure or abandonment supersedes drain timeout:
   - ACK_OK → DEFERRED (exit 3). Partial artifacts persisted; not finalized.
   - ACK_FAIL or unknown → FAILED (exit 2). Persistence failed.
   - Not set → ABANDONED → FAILED (exit 2).

Closing the read ends causes the kernel to deliver SIGPIPE (or set EPIPE) to surviving writers on their next `write()`. This is the disclosed side-effect authorized by Keith (§1.2).

### 9.4 Writer thread lifecycle

The writer thread runs as a daemon thread (`daemon=True`) inside a top-level `try/except Exception` that catches all exceptions privately. Writer-thread exceptions are never propagated to the main thread (the main-thread `sys.excepthook` does not cover worker threads). Instead, the writer sets `result_slot = ACK_FAIL` and `writer_event` on any unhandled exception.

**Result slot initialization:** `result_slot = [None]`. Only explicit `ACK_OK` assignment is success. The supervisor treats `None`, `ACK_FAIL`, or any other value as failure (fail closed).

```python
writer = threading.Thread(target=_writer_main, args=(...), daemon=True)
writer.start()
```

```python
def _writer_main(stdout_fd, stderr_fd, identity_fd, data_queue,
                 ack_queue, writer_event, result_slot_ref):
    close_attempted = set()
    try:
        fd_map = {STDOUT_TAG: stdout_fd, STDERR_TAG: stderr_fd,
                  IDENTITY_TAG: identity_fd}
        while True:
            item = data_queue.get()  # blocks until available
            if item is SENTINEL:
                break
            tag, chunk = item
            fd = fd_map[tag]
            buf = memoryview(chunk)
            while len(buf) > 0:
                n = os.write(fd, buf)
                if n <= 0:
                    raise OSError('zero-length write')
                buf = buf[n:]
            ack_queue.put_nowait(len(chunk))
        # DRAINING complete; fsync and close all files
        for fd in (stdout_fd, stderr_fd, identity_fd):
            os.fsync(fd)
            close_attempted.add(fd)  # ownership relinquished before close
            os.close(fd)
        result_slot_ref[0] = ACK_OK
    except Exception:
        # Close only fds where no close has been attempted.
        # Once close is attempted, the fd number is freed at kernel
        # level even if close raises; retrying could close a
        # replacement descriptor opened by another thread.
        for fd in (stdout_fd, stderr_fd, identity_fd):
            if fd not in close_attempted:
                close_attempted.add(fd)
                try:
                    os.close(fd)
                except OSError:
                    pass
        result_slot_ref[0] = ACK_FAIL
    finally:
        writer_event.set()
```

| State | Description |
|---|---|
| RUNNING | Dequeuing and writing. `os.write` loop handles short writes: repeats until full chunk is written. Zero-byte write (`n <= 0`) → ACK_FAIL immediately (no infinite loop). Posts byte count to `ack_queue` after each complete chunk. |
| DRAINING | Received STOP sentinel. Continues writing remaining queued items. Then fsync + close all three files (stdout, stderr, identity), tracking each successful close. |
| ACK_OK | Successful fsync + close of all files. Sets `result_slot = ACK_OK`, then sets `writer_event`. |
| ACK_FAIL | Any `OSError` or unexpected exception during write/fsync/close. Closes only fds where no close has been attempted (close-attempt tracking prevents retry of uncertain closes). Sets `result_slot = ACK_FAIL`, then sets `writer_event`. |

Writer sets `result_slot` **then** sets the event — single-producer; supervisor checks `result_slot` only after event is set.

The writer thread holds no lock needed by supervision across file I/O. It acquires the data queue's internal lock briefly to dequeue (`data_queue.get()`), releases it, then performs `os.write` without any lock.

**Close-attempt tracking:** The `close_attempted` set tracks descriptors for which `os.close` has been attempted (ownership relinquished), regardless of whether the close succeeded or raised. `close_attempted.add(fd)` is called *before* `os.close(fd)`: once `os.close` is invoked, the kernel frees the fd number even if the call raises (e.g., EIO from deferred write-back error). That freed number may be immediately reused by another thread's `open()`. The exception handler closes only fds not in `close_attempted`. No descriptor number is ever closed twice; no replacement descriptor is affected.

### 9.5 ABANDONED state

If `writer_event` is not set within `PERSIST_TIMEOUT`:

- Supervisor has stopped waiting. The writer thread may still be alive holding file fds.
- Supervisor does **not** close, read, hash, or construct metadata for those file descriptors.
- **No blocking fallback.** No notification write. No fallback persistence or logging.
- Outcome: exit 2 (WRITER_ABANDONED).
- Process exit: `os._exit(2)`. This issues the `_exit(2)` syscall, which closes all process file descriptors. But `os._exit` does not provide a wall-clock termination guarantee: if the writer thread is blocked in a kernel I/O call on a stalled filesystem, process termination may be delayed. This is a kernel/scheduler limitation, not a mechanism guarantee. The mechanism provides bounded application-level waiting (`PERSIST_TIMEOUT`); it does not promise prompt process death.
- **ABANDONED means the supervisor has stopped waiting.** It does not prove the writer has stopped or that its files are stable.

**Recognizing incomplete attempts:** File presence, valid JSON content, and a `COMPLETED` value in `status.json` alone do not prove successful completion — a fully written `status.json` may survive an fsync or close failure that the collector detected. The **success-evidence rule** (§11.5) requires independently observed successful collector (capture.py) exit code 0 together with a checked `status.json` containing `attempt_outcome: "COMPLETED"`. Unknown or nonzero collector exit must be treated as incomplete regardless of `status.json` content. The collector exit code is distinct from the captured PM2 child exit code (`child_exit_code` within the status record).

### 9.6 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-BOUND-01 | Normal: child exits, EOF both, ACK_OK | Boundary established; proceed to hash |
| T-BOUND-02 | Descendant holds pipe write end 10 s | No EOF → drain timeout → DEFERRED (if ACK_OK) |
| T-BOUND-03 | Descendant writes after parent exits | Extra bytes included (EOF-not-exit is boundary) |
| T-BOUND-04 | SCM_RIGHTS: child sends pipe fd to helper | No EOF until helper closes → DEFERRED (if ACK_OK) |
| T-BOUND-05 | Child closes stdout then hangs | stdout EOF early; child eventually killed; stderr EOF after kill |
| T-BOUND-06 | KILL_FAILED | Phase skipped; files potentially-changing; os._exit(2) |
| T-BOUND-07 | Writer stalled (fsync blocks) | ABANDONED after PERSIST_TIMEOUT; exit 2 |
| T-BOUND-08 | Writer ENOSPC on second chunk | ACK_FAIL; exit 2; file = exact first chunk |
| T-BOUND-09 | Drain timeout with surviving writer | SIGPIPE observable on survivor's next write |
| T-BOUND-10 | 4 MiB output → no deadlock | Exact bytes; EOF; ACK_OK |
| T-BOUND-11 | Drain timeout + ACK_FAIL | FAILED (exit 2); persistence failure supersedes drain timeout |
| T-BOUND-12 | Drain timeout + ABANDONED (writer blocked) | FAILED (exit 2) via os._exit(2); not DEFERRED |
| T-BOUND-13 | Writer partial-close failure (stdout closed, stderr fsync fails) | ACK_FAIL; stderr closed in handler; stdout not double-closed |

---

## 10. Control: Hash binding and observation-meta (ACQ-4)

**Acquisition requirement:** §2.1 ACQ-4a–4d; §2.2 schema; §5.5 publication allowlist.

Only reached if boundary established (§9.1).

### 10.1 Mechanism

**ACK-4a — SHA-256 of stdout.raw (memory-bounded):**

After ACK_OK, the writer has fsync'd and closed `stdout.raw`. The main thread opens it for reading:

```python
h = hashlib.sha256()
with open(stdout_raw_path, 'rb') as f:
    while True:
        chunk = f.read(65536)
        if not chunk:
            break
        h.update(chunk)
jlist_sha256 = h.hexdigest()
```

**ACQ-4b — Observation-meta JSON:**

`daemon_pid` handling: omit key (not null) on IDENTITY_CHANGE or DAEMON_DISAPPEARED. Include as positive int otherwise. Verifier `_opt_pid` (l.488–495) accepts absent or positive integer; rejects explicit null.

**Write, close, then hash actual file bytes.** `os.write` loop handles short writes. `fsync` before close. Hash computed from re-read file, not in-memory representation.

**ACQ-4c — JSON validation:** `json.loads` of written file bytes. Syntax check only; schema compliance deferred to verifier.

### 10.2 Schema compatibility

Keys match verifier `validate_observation_meta()` (l.783). Identifiers use `re.fullmatch` with verifier-aligned patterns (`ID_RE`, `HOST_RE`).

### 10.3 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-HASH-01 | Known stdout.raw content | SHA-256 matches expected |
| T-HASH-02 | Empty stdout.raw | Hash of empty bytes |
| T-HASH-03 | Binary content in stdout.raw | Hash includes all bytes |
| T-HASH-04 | All meta fields present | Valid JSON, verifier schema-compatible |
| T-HASH-05 | daemon_pid as positive int | `"daemon_pid": 12345` (not null) |
| T-HASH-06 | SHA-256 cross-check | hashlib output matches re-read file hash |
| T-HASH-07 | Invalid host characters in --host | Rejected at Phase 0 validation (exit 10), not escaped |
| T-HASH-08 | IDENTITY_CHANGE: daemon_pid omitted | Key absent from JSON; verifier `_opt_pid` accepts |
| T-HASH-09 | Meta hash from file bytes | Hash computed from re-read `observation-meta.json`, not in-memory dict |
| T-HASH-10 | Large stdout.raw (> MEM_CAP on disk) | Hash computed in 64 KiB chunks; bounded memory |
| T-HASH-11 | Meta write succeeds, fsync fails | Exit 2, META_INVALID; observation-meta.json may exist partially written; not deleted; attempt incomplete |

---

## 11. Control: Status and E2 records (ACQ-5/ACQ-6)

### 11.1 Authoritative transition table

| Phase | Condition | Outcome | Exit | Status record? | Finalized? |
|---|---|---|---|---|---|
| 0 | Invalid args / missing tool | FAILED | 10 | NO | N/A |
| 1 | Target inconsistency | FAILED | 1 | NO | N/A |
| 2 | Storage failure | FAILED | 1 | NO | N/A |
| 3 | DAEMON_ABSENT / P5 / tool | FAILED | 1 | NO | N/A |
| 4 | Launch failure | FAILED | 2 | Best-effort | N/A |
| 4 | Normal/signal exit + EOF + ACK_OK + identity_recorded | → Phase 5 | — | — | — |
| 4 | Normal/signal exit + EOF + ACK_OK + not identity_recorded | FAILED | 2 | Best-effort | NO |
| 4 | Unknown wait status (STATE_UNKNOWN) | FAILED | 2 | Best-effort | NO |
| 4 | ChildProcessError (IDENTITY_LOST) | FAILED | 2 | Best-effort | NO |
| 4 | KILL_FAILED | FAILED | 2 | Best-effort | NO |
| 4 | Drain timeout + ACK_OK | DEFERRED | 3 | YES | NO |
| 4 | Drain timeout + ACK_FAIL/ABANDONED | FAILED | 2 | Best-effort | NO |
| 4 | ACK_FAIL (during or after supervision) | FAILED | 2 | Best-effort | NO |
| 4 | ABANDONED (persist timeout) | FAILED | 2 | NO | NO |
| 4 | BaseException | FAILED | 2 | NO | NO |
| 5 | Tool errors | → Phase 6 | — | — | — |
| 6 | Hash failure | FAILED | 2 | YES | NO |
| 6 | Meta write/validation fail | FAILED | 2 | Partial (may exist) | NO |
| 7 | All succeeded (artifacts + E2 + status written) | COMPLETED | 0 | YES | YES |
| 7 | E2 write failure | FAILED | 2 | NO | YES (raw artifacts finalized but E2 missing) |
| 7 | Status write failure (E2 succeeded) | FAILED | 2 | Partial (may exist) | YES (raw artifacts and E2 finalized but status incomplete) |

**TIMEOUT + eventual exit:** TIMEOUT is an anomaly flag, not an outcome. If child exits after SIGTERM/SIGKILL and streams drain and persistence succeeds → COMPLETED with TIMEOUT in anomaly_flags (exit 0). **Locked §3.5 restriction:** "Partial output is not usable for verification." TIMEOUT-flagged output, even when properly finalized, may be truncated and must not be treated as a complete daemon-state representation by downstream verification.

**Public attempt_outcome vocabulary:** The locked set is COMPLETED / FAILED / DEFERRED. There is no public INCOMPLETE status. When artifacts are finalized but records are incomplete, the public vocabulary maps to FAILED (exit 2). The operator distinguishes finalized-but-incomplete from other failures by examining what artifacts exist.

**Failed writes and partial files:** A write failure (fsync, close, or I/O error) does not guarantee the target file is absent. Files created by `O_CREAT | O_EXCL` exist from the moment of creation; partial bytes may have been written before the failure. A fully written `status.json` containing `attempt_outcome: "COMPLETED"` may survive an fsync or close failure that the collector subsequently detected. The mechanism never deletes or truncates existing files (§13.2). Successful completion is established by the **success-evidence rule** (§11.5): collector exit 0 AND checked `status.json` with `COMPLETED` AND artifacts present. Nonzero or unknown collector exit → attempt is incomplete regardless of file contents.

### 11.2 Public status record (ACQ-6a)

Locked publication allowlist (§5.5). Absent fields omitted (not null). `anomaly_flags` uses only locked §3.5 values; empty = `[]`.

### 11.3 Private E2 record (ACQ-5a)

Written to `e2-record.json`. Full E2 entry per POLICY-01 §4.4: command=`"pm2 jlist"`, fate=`"UNCERTAIN"`, p5_post_status, all timestamps, anomaly_flags. E2 reference input does not prove the entry was written.

**Publication order:** E2 record is written first; then status record. If E2 write fails → exit 2 (FAILED); no status record attempted. If E2 succeeds but status write fails → exit 2 (FAILED); E2 file exists on disk; status file may exist partially written.

### 11.4 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-STATUS-01 | Normal capture (all phases succeed) | COMPLETED; exit 0; anomaly_flags=[]; all fields present |
| T-STATUS-02 | IDENTITY_CHANGE | anomaly_flags includes IDENTITY_CHANGE; post_daemon_pid field present |
| T-STATUS-03 | DEFERRED (drain timeout + ACK_OK) | attempt_outcome=DEFERRED; no stdout_sha256, no meta_sha256 |
| T-STATUS-04 | Publication check | No paths, env values, raw data, or internal diagnostics in status record |
| T-STATUS-05 | Empty anomaly list | `"anomaly_flags": []` |
| T-STATUS-06 | TIMEOUT + eventual exit + boundary | COMPLETED; anomaly_flags=["TIMEOUT"]; TIMEOUT restriction noted |
| T-STATUS-07 | Post-obs tool failure | post_daemon_pid field absent (not null) |
| T-STATUS-08 | E2 record completeness | command, fate=UNCERTAIN, p5_post_status, all timestamps present |
| T-STATUS-09 | E2 write failure after artifact finalization | Exit 2 (FAILED); raw artifacts preserved; e2-record.json may exist partially written |
| T-STATUS-10 | Status write failure after E2 success | Exit 2 (FAILED); e2-record.json complete; status.json may exist partially written |
| T-STATUS-11 | Meta fsync failure (file created, partly written) | Exit 2 (FAILED); observation-meta.json exists on disk with partial content; not deleted |
| T-STATUS-12 | Status bytes fully written, fsync fails; collector exits 2 | status.json exists with COMPLETED content on disk; collector exit 2 → success-evidence rule → FAILED/incomplete |
| T-STATUS-13 | Status bytes fully written, close raises after kernel close; collector exits 2 | status.json may be durable; collector exit 2 → FAILED despite valid-looking file |

### 11.5 Success-evidence rule

A capture attempt is COMPLETED if and only if all three conditions are independently observed:

1. **Collector exit 0:** The capture tool process (`capture.py`) exited with code 0. This is the success-evidence carrier. Exit 0 means all writes, fsyncs, closes, status/E2 writes, and publication steps completed without error.
2. **status.json checked:** `status.json` exists, is valid JSON, and contains `attempt_outcome: "COMPLETED"`.
3. **Artifacts present:** `observation-meta.json` and `stdout.raw` exist in the attempt directory.

**Neither status.json alone nor collector exit alone is sufficient.** A `status.json` containing `COMPLETED` may exist on disk after a write that was not durably committed (fsync/close failure); the collector would have exited nonzero. Conversely, a collector exit 0 without a checked `status.json` does not establish the attempt's outcome fields.

**Collector exit vs child exit:** The collector exit code indicates whether the evidence workflow succeeded. The captured PM2 child's exit code is a separate field within the status record (`child_exit_code`). Collector exit 0 with child exit nonzero is a valid COMPLETED capture with a NON_ZERO_EXIT anomaly.

**Unknown collector outcome:** If the collector's exit code is unknown (e.g., the calling process was itself interrupted), the attempt must be treated as incomplete even if `status.json` contains `COMPLETED`. The operator may examine artifacts for forensic purposes but must not treat the attempt as COMPLETED.

This rule does not add fields to the locked publication allowlist. The collector exit code is an external process observation, not a field within the status record.

---

## 12. Control: Evidence-recording failure after successful launch

`proc.pid`, `os.waitpid`, `os.kill`, `time.monotonic`, pipe reads, and queue operations do not depend on file I/O. The supervision loop (§7.5) performs no file I/O. The writer thread handles all persistence independently.

**Writer failure during supervision:** The writer may fail at any time (e.g., ENOSPC on the first write). The supervision loop detects this by non-blocking check of `writer_event` (§7.5 step 2). Supervision continues — the child is still monitored, signaled, and reaped normally. Storage failure does not cause the supervisor to abandon a live child.

**Writer failure after supervision:** If the writer fails during the shutdown protocol (§9.2), the child has already been reaped and streams have been drained (or timed out). The failure affects only finalization, not child supervision.

**In both cases:** Storage failure after launch does not produce a COMPLETED result (exit 0). Preserved partial artifacts (on-disk bytes written before the failure) are not deleted.

---

## 13. Control: Partial evidence and preservation

### 13.1 Preservation mapping (locked requirements)

Locked §3.5 STORAGE_FAILURE_DURING: *"preserve whatever partial files exist. Incomplete evidence must not become a successful capture."*
Locked §5.4: *"Raw files are not edited, filtered, reformatted, or truncated after capture."*

| Category | Survives process exit? | Notes |
|---|---|---|
| On-disk bytes (written + fsync'd by writer) | Yes | Mechanism never deletes or truncates |
| On-disk bytes (written, not fsync'd) | Kernel-dependent | May or may not survive |
| Queued bytes (in data_queue) | No | Never reached disk |
| Pipe-buffered bytes (kernel) | No | Never read by supervisor |
| Partially written record files (meta, status, E2) | Yes | Created by O_EXCL; partial content preserved; not deleted |

The locked text requires preserving *existing partial files* — it does not guarantee every emitted byte reaches disk under arbitrary failure. STORAGE_FAILURE_DURING explicitly anticipates incomplete evidence.

**TIMEOUT and partial output:** Even when TIMEOUT output is properly finalized (boundary established, hashed), the locked §3.5 restriction applies: "Partial output is not usable for verification." Downstream verification must not treat TIMEOUT-flagged observations as complete.

### 13.2 No cleanup on failure

The script never deletes, rotates, or truncates files in the attempt directory.

---

## 14. Control: Observation-tool failure vs expected absence

`pgrep` exit codes: 0 = match, 1 = no match, < 0 = signal, ≥ 2 = error. Pre-invocation tool failure → exit 1. Post-invocation → logged privately; fields absent.

### 14.1 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-TOOL-01 | Pre-invocation pgrep exit ≥ 2 (internal error) | OBSERVATION_TOOL_FAILURE; exit 1 |
| T-TOOL-02 | Pre-invocation lsof fails on socket (exit ≠ 0 with stderr) | TARGET_INCONSISTENT; exit 1 |
| T-TOOL-03 | Post-invocation pgrep exit ≥ 2 | Privately logged; post_daemon_pid field omitted; does not change exit code |
| T-TOOL-04 | Post-invocation lsof fails on socket | Privately logged; socket-holder field omitted; does not change exit code |

---

## 15. No automatic retry, cleanup, host correction, or baseline adoption

Q3-A NO_RETRY. No retry loop. No host mutations. No verifier invocation. No observed value adopted as baseline.

---

## 16. Argument validation (Phase 0)

### 16.1 Custom parser error handling

`ArgumentParser` subclass: fixed diagnostic only, no argument echo. Default argparse error paths are overridden to prevent echoing supplied values. Uncaught exceptions during argument parsing are caught by the top-level exception handler (§3.3) and produce `[capture] INTERNAL: unhandled exception` only.

### 16.2 Validation

| Argument | Validation |
|---|---|
| `--account` | Non-empty; matches `pwd.getpwuid(os.geteuid()).pw_name` (effective UID) |
| `--pm2-binary` | File exists; executable |
| `--pm2-home` | Directory exists |
| `--observation-id` | `re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}')` |
| `--host` | `re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,253}')` |
| `--captured-by` | Non-empty; ≤ 1024 chars; no control characters |
| `--acq-record` | Same `ID_RE` pattern as observation-id (bounded identifier; no path separators, spaces, or control characters) |
| `--output-dir` | Directory exists; writable |

`--acq-record` is a bounded identifier with provenance verified at registration. Printable ASCII alone does not make a value publishable: paths, commands, and secret text are printable but not publishable. The `ID_RE` pattern and registration provenance together establish safety.

### 16.3 Tool availability

Required: `pgrep`, `lsof`, `sha256sum`, `readlink`, `id`, `stat`. All checked via `shutil.which`.

### 16.4 Verification cases

| Case ID | Input | Expected |
|---|---|---|
| T-ARG-01 | Missing --account | Exit 10; no argument echo on stderr |
| T-ARG-02 | Invalid --observation-id (control characters) | Exit 10 |
| T-ARG-03 | --host exceeds 254 chars | Exit 10 |
| T-ARG-04 | All valid arguments | Phase 0 passes |
| T-ARG-05 | lsof not in PATH | Exit 10 |
| T-ARG-06 | --acq-record with path separator | Exit 10 |
| T-ARG-07 | --acq-record with space | Exit 10 |
| T-ARG-08 | Default argparse error path triggered | No argument values appear in stderr output |
| T-ARG-09 | Uncaught exception in Phase 0 | `[capture] INTERNAL: unhandled exception` only; no traceback |

---

## 17. Test suite design (fake-only)

### 17.1 Environment

Python 3 with `pytest`. Linux only. `tmp_path` per test. No real PM2. pytest ≥ 3.0.

### 17.2 Deadline and constant injection

Locked 30/5/5 constants and design-choice constants (DRAIN_GRACE, PERSIST_TIMEOUT, MEM_CAP) are not overridable via CLI or environment variables. No production environment-variable override exists. Tests use `monkeypatch.setattr` — a pytest-only injection path unavailable to the production interpreter.

### 17.3 KILL_FAILED testing

Controlled fault injection: monkeypatch `os.waitpid` to return `(0, 0)` after sigkill. A fake process cannot ignore SIGKILL; KILL_FAILED is tested by injecting `waitpid` behavior, not by creating an unkillable process.

### 17.4 Fake pm2 binaries

| Fake | Behavior |
|---|---|
| `fake_pm2_normal.py` | Outputs JSON to stdout (pipe); exits 0 |
| `fake_pm2_error.py` | stderr output; exits 1 |
| `fake_pm2_hang.py` | Traps SIGTERM; sleeps (ignores pipe) |
| `fake_pm2_slow.py` | Sleeps beyond timeout then exits |
| `fake_pm2_fork.py` | Forks descendant holding stdout pipe write end; parent exits 0 |
| `fake_pm2_transfer.py` | Sends stdout fd via SCM_RIGHTS to test helper; exits 0 |

Fake processes create real `/proc` entries. Simulated vs real: process identity and `/proc` entries are real; socket/daemon observations are simulated via `tmp_path` fixtures.

### 17.5 Bounded test teardown

Each test kills only its own PIDs via `addfinalizer`. No `pkill` or `killall`.

### 17.6 Test categories

| Category | Cases |
|---|---|
| Argument validation | T-ARG-01–09 |
| Target enforcement | T-TARGET-01–11 |
| Storage | T-STORE-01–08 |
| Pre-invocation | T-PRE-01–08 |
| Invocation / supervision | T-INVOKE-01–20 |
| Post-invocation | T-POST-01–07 |
| Stream completion / boundary | T-BOUND-01–13 |
| Hash / meta | T-HASH-01–11 |
| Status / E2 | T-STATUS-01–13 |
| Tool failure | T-TOOL-01–04 |
| Integration | T-INT-01–02 |
| Writer lifecycle | T-WRITER-01–10 |
| Memory / handoff | T-MEM-01–08 |
| Child state / exception safety | T-STATE-01–11 |

### 17.7 Writer lifecycle cases

| Case ID | Input | Expected |
|---|---|---|
| T-WRITER-01 | Normal: EOF + ACK_OK | Hash proceeds |
| T-WRITER-02 | Writer blocked on fsync (gate) | ABANDONED after PERSIST_TIMEOUT; exit 2; no meta |
| T-WRITER-03 | Writer ENOSPC on second chunk | ACK_FAIL; exit 2; file = first chunk only |
| T-WRITER-04 | Short writes: os.write returns 1 byte per call | File bytes exact; all bytes present |
| T-WRITER-05 | Zero-byte write (os.write returns 0) | ACK_FAIL; no infinite loop; writer exits promptly |
| T-WRITER-06 | Drain timeout: descendant holds pipe 10 s | DEFERRED (if ACK_OK); SIGPIPE observable |
| T-WRITER-07 | Post-reap SIGINT during drain | No escalation change; drain continues |
| T-WRITER-08 | Persist timeout: writer still alive at exit | No cross-thread close; os._exit(2) |
| T-WRITER-09 | Partial close: stdout closed, stderr fsync fails | ACK_FAIL; stderr closed in handler; stdout not double-closed; close_attempted set consistent |
| T-WRITER-10 | Monkeypatched os.close: performs real close then raises OSError; fd number reused by another open | close_attempted prevents retry; replacement fd untouched; ACK_FAIL |

### 17.8 Memory/handoff cases

| Case ID | Input | Expected |
|---|---|---|
| T-MEM-01 | Child emits > MEM_CAP with healthy writer | Budget recovers via acks; no backpressure; all bytes captured |
| T-MEM-02 | Both streams saturated (stalled writer at MEM_CAP) | Neither read when budget full; deadlines still fire normally |
| T-MEM-03 | Writer stall then resume | Budget recovers via acks; reading resumes; no bytes lost |
| T-MEM-04 | Large output: 4 MiB with healthy writer | No deadlock; exact bytes; EOF; ACK_OK |
| T-MEM-05 | Stalled writer at exactly MEM_CAP; child emits more | Supervisor stops reading; child blocks on pipe; TIMEOUT fires |
| T-MEM-06 | Same as T-MEM-05, then writer resumes | Acks free capacity; supervisor reads remaining bytes + EOF |
| T-MEM-07 | Identity enqueue: budget accounts for identity bytes | budget_used includes identity payload; tiny and does not trigger backpressure |
| T-MEM-08 | Identity enqueue → loop entry → identity ack arrives | budget_used increments on enqueue, decrements on ack; never negative; returns exactly to zero |

### 17.9 Child state / exception safety cases

| Case ID | Input | Expected |
|---|---|---|
| T-STATE-01 | Exception after waitpid returns but before returncode set | child_state=STATE_UNKNOWN; _bounded_terminate does nothing; exit 2 |
| T-STATE-02 | ChildProcessError during supervision | child_state=IDENTITY_LOST; no further signaling; exit 2 |
| T-STATE-03 | Exception during post-launch pipe-end closure | Escalation vars initialized in §7.3; _bounded_terminate waits for original 30s deadline; child properly terminated |
| T-STATE-04 | KILL_FAILED: monkeypatched waitpid never returns pid | child_state=KILL_FAILED; no further signaling; exit 2 |
| T-STATE-05 | Repeated interrupts (SIGINT flag set during _bounded_terminate) | No effect on locked escalation sequence; completes normally |
| T-STATE-06 | Monkeypatched waitpid: reaps child then raises OSError | child_state=STATE_UNKNOWN; _bounded_terminate does nothing; no signal to recycled PID |
| T-STATE-07 | Exception before initial 30s deadline; child exits normally during initial wait | _bounded_terminate waits for original deadline; child collected via waitpid; returns without any signal |
| T-STATE-08 | Exception during TERM grace (sigterm_sent=True, sigkill_sent=False) | _bounded_terminate skips SIGTERM; waits remaining TERM_GRACE from original sigterm_mono; then SIGKILL |
| T-STATE-09 | Exception during KILL grace (sigterm_sent=True, sigkill_sent=True) | _bounded_terminate skips both signals; waits remaining KILL_GRACE from original sigkill_mono |
| T-STATE-10 | Exception before initial 30s deadline; child still running at deadline | _bounded_terminate waits until original deadline, then sends SIGTERM; continues TERM_GRACE → SIGKILL → KILL_GRACE |
| T-STATE-11 | Pipe-end close failure immediately after Popen | Escalation vars initialized; _bounded_terminate receives T_invoke_mono; waits for original deadline; no undefined state |

### 17.10 Tool failure cases

| Case ID | Input | Expected |
|---|---|---|
| T-TOOL-01 | Pre-invocation pgrep exit ≥ 2 (internal error) | OBSERVATION_TOOL_FAILURE; exit 1 |
| T-TOOL-02 | Pre-invocation lsof fails on socket (exit ≠ 0 with stderr) | TARGET_INCONSISTENT; exit 1 |
| T-TOOL-03 | Post-invocation pgrep exit ≥ 2 | Privately logged; post_daemon_pid field omitted; does not change exit code |
| T-TOOL-04 | Post-invocation lsof fails on socket | Privately logged; socket-holder field omitted; does not change exit code |

### 17.11 Integration cases

| Case ID | Input | Expected |
|---|---|---|
| T-INT-01 | Full normal flow: valid target, daemon present, single child, exits 0, EOF both, ACK_OK, hash, meta, E2, status | COMPLETED; exit 0; all artifacts present; anomaly_flags=[]; attempt_outcome=COMPLETED |
| T-INT-02 | Full timeout flow: valid target, daemon present, child hangs 60s, SIGTERM at 30s → SIGKILL at 35s → exit, EOF, ACK_OK, hash, meta, E2, status | COMPLETED; exit 0; anomaly_flags=["TIMEOUT"]; TIMEOUT restriction applies |

---

## 18. Unverified assumptions and prerequisites

| ID | Statement | Required for | Class |
|---|---|---|---|
| UA-1 | Python ≥ 3.6 on target host (`capture_output` not used; all APIs are 3.6-compatible) | Execution | Externally supplied (C-ACQ) |
| UA-2 | pgrep, lsof, sha256sum, readlink, id, stat available | All phases | Externally supplied (C-ACQ, Phase 0) |
| UA-3 | sha256sum produces lowercase hex | Cross-check | Externally supplied |
| P-MAIN-REAP | Only main thread calls waitpid/kill/Popen | Child identity | Enforceable (design) |
| A-PIPE-EOF | `os.read` returns empty bytes iff all write-end holders have closed | Stream completion | Enforceable (kernel POSIX guarantee) |
| A-SINGLE-UID-TRUST | No same-UID process reopens output files by path | Artifact integrity | Externally supplied |
| A-TOCTOU | Resolved target paths stable during execution | Target enforcement | Externally supplied |
| A-SCHED | Kernel scheduling reasonable | Deadline enforcement | Unavoidable limitation |
| A-PIPE-EQUIV | pm2 jlist content identical for pipe vs file stdout (both non-TTY) | Output correctness | Externally supplied |
| E-OFFREPO | output-dir outside repository | Storage isolation | Operator prerequisite |

**Retired assumptions** (superseded by pipe/EOF architecture): A-NAMESPACE, A-NO-TRANSFER, A-LSOF-COMPLETE, A-NO-RACE-WRITE, A-STDERR (during supervision). These were required by the lsof-based boundary (§§23–24) which is no longer used.

---

## 19. Explicit exclusions

This Step 2 design does not: implement, run tests, transfer, authorize live PM2, accept auto-launch risk, resolve P5 journal-applicability, construct B(H), authorize verifier live use, register C1, authorize canary, reopen EXEC-01C6A, attest host CLEAN, accept P7, edit locked predecessors, or create workflows.

### 19.1 Preserved statuses

A1/A2 unchanged. P2/P3 binding. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. Reopen UNSATISFIED. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED.

---

## 20. Write set summary for sidecar

```json
{
  "writePaths": [
    "ops/pm2-recovery-capture/capture.py",
    "ops/pm2-recovery-capture/tests/test_capture.py",
    "ops/pm2-recovery-capture/.gitattributes",
    "ops/pm2-recovery-capture/SHA256SUMS",
    "ops/pm2-recovery-capture/README.md"
  ],
  "hotfiles": ["(same)"],
  "mutexes": [],
  "writeSetPrecision": "EXACT",
  "admissionUncertain": true,
  "evidenceClass": "LOCAL-TESTS",
  "runtimeNeeds": []
}
```

Five future implementation paths. Control-plane bookkeeping is separate.

---

## 21. Lock scope (Step 2)

This document specifies (not implements, not enforces) the capture mechanism design. Step 3 implements exactly this design. Deviations require returning to control plane.

**MECHANISM_ESTABLISHED=NO.** Steps 3–4 NOT AUTHORIZED.

---

## 22. Acquisition §6.5 criteria mapping

| # | §6.5 Criterion | Mechanism section | Failure transition | Planned test cases | Status |
|---|---|---|---|---|---|
| C1 | Enforce account, executable, PM2_HOME; refuse ambiguous target | §4.1–§4.2 (geteuid, realpath, socket cross-ref) | Exit 1 | T-TARGET-01–11 | CLOSED |
| C2 | Secure fresh storage; no-overwrite creation | §5.1–§5.3 (umask, O_EXCL, forbidden-bit check) | Exit 1 | T-STORE-01–08 | CLOSED |
| C3 | Private stdout/stderr routing; setup/failure paths | §3.3 (stdout=PIPE,stderr=PIPE), §5.2, §7.5, §9.4 | Fixed diagnostics | T-ARG-08–09, T-WRITER-* | CLOSED |
| C4 | Fixed safe diagnostics when restricted logging fails | §3.3 (sys.excepthook, argparse override, writer try/except) | Fixed stderr | T-ARG-09 | CLOSED |
| C5 | Record and supervise exact child identity | §7.3 (identity enqueue + identity_recorded), §7.4 (child_state machine) | Exit 2 on IDENTITY_LOST/STATE_UNKNOWN/identity not recorded | T-INVOKE-01–20, T-STATE-01–09 | CLOSED |
| C6 | Bounded monitoring/escalation; no blocking wait | §7.5 (capacity-reserved reads, no file I/O, single budget init), §7.6 (initial-deadline-preserving bounded terminate) | KILL_FAILED exit 2 | T-INVOKE-03–04,07, T-MEM-01–08, T-STATE-07–11 | CLOSED |
| C7 | No broad signals or daemon signals | §7.5 (_safe_kill targets only proc.pid when LAUNCHED); §1.2 (SIGPIPE disclosed) | — | T-INVOKE-10–11 | CLOSED |
| C8 | Handle launch success + write failure | §7.5 step 2 (writer_event check, fail-closed result_slot), §12, §9.4 (close-attempt tracking) | ACK_FAIL/ABANDONED; supervision continues | T-WRITER-02–03,09–10, T-INVOKE-19, T-BOUND-11–13 | CLOSED |
| C9 | Preserve partial evidence; distinguish live/finalized | §13.1, §13.2, §11.1, §11.5 (success-evidence rule) | Transition table; no deletion; partial files preserved; collector exit as evidence carrier | T-BOUND-06, T-STATUS-03,09–13, T-HASH-11 | CLOSED |
| C10 | Output-writer boundary before hashing | §9.1 (6 conditions: EOF + ACK_OK + no failure + identity), §9.2–§9.3 (drain precedence) | DEFERRED exit 3 / FAILED exit 2 | T-BOUND-01–13, T-WRITER-01–09 | CLOSED |
| C11 | Exact-byte hashing, metadata, restricted outputs | §10.1–§10.2 (re-read file, fullmatch, omit-not-null) | Exit 2 on failure | T-HASH-01–11 | CLOSED |
| C12 | Observation-tool failure vs expected absence | §14, §14.1 (pgrep exit codes, lsof failure) | Pre: exit 1; Post: logged | T-TOOL-01–04 | CLOSED |
| C13 | No automatic retry/cleanup/host correction/baseline | §15 (Q3-A) | — | — | CLOSED |
| C14 | Fake-only verification | §17 (plan specified) | — | All T-* (140+ cases designed) | CLOSED (plan specified: decisive fake-only cases designed for every mechanism and failure transition; no tests executed; execution is Step 3; verification is Step 4) |

**All fourteen criteria: CLOSED** (design-addressed). C10 was previously OPEN under the lsof architecture (§24). The pipe/EOF architecture closes it: stream completion is a kernel event (EOF) that cannot be bypassed by inherited descriptors, forked descendants, or SCM_RIGHTS transfers — all such holders must close their write ends before EOF occurs. The remaining external assumption (A-SINGLE-UID-TRUST) applies to file-path reopening, not to the completion event.

**CLOSED means:** the design specifies a concrete mechanism, failure transitions, and decisive fake-only test cases for the criterion. It does not mean the mechanism has been implemented, tested, or verified. Implementation is Step 3; verification is Step 4. MECHANISM_ESTABLISHED=NO.

---

## 23. Correction record #7 — Bash → Python (2026-09-20)

**Withdrawn.** Bash zombie-protection, `$SECONDS` monotonic, and lsof error handling were incorrect. Runtime changed to Python 3. Write set changed from .sh to .py. See §1.3.

---

## 24. Correction record #8 — Nine-finding review (2026-09-20)

**Partially superseded.** Findings F1 (child lifecycle), F2 (deadlines), F4–F9 remain valid corrections. **F3 (output-writer boundary)** was marked OPEN under the lsof architecture; the pipe/EOF architecture (§9) replaces the lsof mechanism and closes C10.

Prior finding closure details from corrections #7 and #8 have been incorporated into their respective sections: verification cases restored to §§4.3, 6.2, 7.9, 8.3, 10.3, 11.4, 14.1, 16.4 (corrections #10–#11). The cases are authoritative in their current sections, not in this historical record.

---

## 25. Correction record #9 — Architecture consolidation (2026-09-20, baseline `e5457b55ac86ddd50cad38434a70f061153d949e`)

**Scope:** Consolidate the pipe/EOF architecture into a single coherent design document, replacing the superseded lsof-based boundary and direct-fd descriptor model. Keith-authorized design selection.

### 25.1 Architecture change

| Aspect | Prior (corrections #7–#8) | Consolidated |
|---|---|---|
| Child output routing | Direct to files (Popen stdout=fd) | Pipes → supervisor → writer thread → files |
| Output-writer boundary | lsof scan (OPEN) | EOF on pipes (CLOSED) |
| Persistence | Main-thread file I/O | Separate writer thread |
| Supervision loop I/O | Identity-log write, logging | No I/O in loop |
| Interrupt handling | Not specified | Flag-only; no escalation acceleration |
| Blocking analysis | Asserted | Demonstrated: all loop operations non-blocking or bounded |

### 25.2 Keith authorizations recorded

1. Supervisor-mediated pipe→file routing satisfies ACQ-2b.
2. Finite pipe-reader closure after drain timeout permitted.
3. SIGPIPE/EPIPE effect on surviving writers disclosed and accepted as design side-effect.
4. No current host risk accepted; C-ACQ must address SIGPIPE/EPIPE.

### 25.3 Sections rewritten

§1 (architecture rationale, SIGPIPE authorization), §3 (phases, constants, diagnostics), §5 (descriptor ownership), §7 (supervision with pipe reads and poll), §9 (EOF-based boundary replaces lsof), §10 (hash after ACK_OK), §11 (transition table with drain/persist states), §12 (writer failure model), §13 (preservation mapping), §17 (writer and memory test cases), §18 (assumptions — lsof boundary assumptions retired), §22 (C10 CLOSED).

### 25.4 Retired elements

- lsof-based output-writer boundary (former §9 from corrections #7–#8)
- Assumptions A-NAMESPACE, A-NO-TRANSFER, A-LSOF-COMPLETE, A-NO-RACE-WRITE
- Direct-fd descriptor model (Popen stdout=file_fd)
- P-SINGLE-THREAD prerequisite (replaced by P-MAIN-REAP)
- `_emergency_child_cleanup` with blocking `waitpid(pid, 0)` (replaced by `_bounded_terminate`)

### 25.5 Files modified

- `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md` — consolidated (this document)
- `TASKS.md` — this task's fields
- `TASKS_BACKLOG_FULL.md` — this task's body
- `docs/control-plane/SATURATION_PROOF.json` — validator output

---

## 26. Correction record #10 — Six-group design correction (2026-09-20, baseline `e5457b55ac86ddd50cad38434a70f061153d949e`)

**Scope:** Address six groups of design issues identified in Keith review of the pipe/EOF architecture consolidation. Design/documentation only.

### 26.1 Corrections applied

| Group | Finding | Corrected mechanism | Sections changed |
|---|---|---|---|
| 1. Capacity reservation | `os.read` called before capacity check; rejected bytes discarded | Reserve capacity before read; limit read size to `min(65536, avail_now)`; at zero capacity, do not read; no consumed bytes disappear | §7.5 (pseudocode rewritten) |
| 2. Post-launch persistence | Synchronous `os.write(identity_fd)` blocks monitoring after launch | Identity persistence through writer thread via data_queue; identity-log fd owned by writer; no main-thread file I/O after T_invoke | §5.2 (table), §7.1 (steps), §7.3 (enqueue) |
| 3. Exception cleanup | `_bounded_terminate` checks only `proc.returncode`; exception after reap but before assignment signals recycled PID | Explicit authoritative `child_state` machine; `REAPED` set before `returncode`; terminal states prevent signaling; STATE_UNKNOWN on decode exception | §7.4 (state table), §7.5 (pseudocode), §7.6 (guard), §7.7 (post-loop) |
| 4. Writer/shutdown/completion | ACK_FAIL during live supervision not handled; status-write failure = COMPLETED/exit 0 | Non-blocking `writer_event` check in loop; status-write failure → exit 2 (INCOMPLETE); TIMEOUT restriction noted; early writer failure does not abandon child | §7.5 (step 2), §9.2, §9.4, §11.1, §12 |
| 5. Runtime/identity/permissions | `getuid()` = real UID; `capture_output` requires 3.7; numeric permission ordering admits writable modes | `geteuid()` throughout; explicit `stdout=PIPE, stderr=PIPE`; forbidden-bit checks (`S_IWGRP\|S_IWOTH\|S_ISVTX`) | §1.1, §3.3, §4.1, §5.1, §5.3, §16.2, §18 |
| 6. Verification plan gaps | Case references to absent §§24.1–24.9; C14 claims CLOSED without distinguishing plan from execution | All cases restored inline in their sections; C14 status annotated "plan specified; no tests executed" | §8.3, §10.3, §11.4, §16.4, §17.6–17.9, §22 |

### 26.2 New verification cases added

| Category | New cases |
|---|---|
| Storage | T-STORE-07, T-STORE-08 (other-writable, mode 0o757 forbidden-bit detection) |
| Invocation | T-INVOKE-17–20 (post-reap exception, pipe-end closure exception, early writer ACK_FAIL, budget-at-cap) |
| Memory/handoff | T-MEM-05–07 (stalled-at-cap + more bytes, stalled then resume, identity budget accounting) |
| Child state | T-STATE-01–05 (post-reap exception, identity lost, pipe-close exception, kill-failed state, repeated interrupts) |
| Status | T-STATUS-09 (status/E2 write failure → exit 2) |

### 26.3 Diagnostic status words added

`STATE_UNKNOWN` — added to §3.3 fixed diagnostic status words.

### 26.4 Files modified

- `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md` — corrected (this document)
- `TASKS.md` — this task's fields
- `TASKS_BACKLOG_FULL.md` — this task's body
- `docs/control-plane/SATURATION_PROOF.json` — validator output

---

## 27. Correction record #11 — Five remaining contradictions (2026-09-20, baseline `e5457b55ac86ddd50cad38434a70f061153d949e`)

**Scope:** Resolve five remaining contradictions identified by Keith in the pipe/EOF design. Design/documentation only.

### 27.1 Corrections applied

| # | Finding | Corrected mechanism | Sections changed |
|---|---|---|---|
| 1 | budget_used initialized to 0 in §7.5 after identity enqueue in §7.3; identity ack makes counter negative | Single initialization: `budget_used = 0` in §7.3 before identity enqueue; carried into loop without re-initialization; `identity_recorded` flag gates COMPLETED | §7.3, §7.5, §7.7, §9.1, §9.2, §11.1 |
| 2 | waitpid catches only ChildProcessError; non-ECHILD exception after kernel reap leaves LAUNCHED; _bounded_terminate restarts fresh escalation ignoring existing signals | Broad `except Exception` after `except ChildProcessError` → STATE_UNKNOWN; `_bounded_terminate` receives and preserves (sigterm_sent, sigterm_mono, sigkill_sent, sigkill_mono); grace periods computed from original timestamps | §7.5, §7.6 |
| 3 | §9.3 declares DEFERRED unconditionally after drain timeout; no writer shutdown for KILL_FAILED/STATE_UNKNOWN; double-close risk in writer; result_slot initial value unspecified | Drain-timeout outcome depends on writer result (ACK_OK→DEFERRED, else→FAILED); writer shutdown defined for all terminal child paths; daemon thread; `closed` set tracks fds; `result_slot = [None]` fail-closed | §1.2, §7.1, §7.7, §9.2, §9.3, §9.4, §9.5 |
| 4 | T-HASH-11 assumes absent file after fsync failure; T-STATUS-09 assumes absent status.json; INCOMPLETE not in locked vocabulary | Files may exist partially written; not deleted; INCOMPLETE → FAILED in public vocabulary; E2/status publication order defined; partial-file rows added to §13.1 | §10.3, §11.1, §11.3, §11.4, §13.1 |
| 5 | T-TOOL-01–04 and T-INT-01–02 are ranges without concrete cases | Concrete inputs/outputs defined inline | §14.1, §17.10, §17.11 |

### 27.2 New verification cases added

| Category | New cases |
|---|---|
| Boundary | T-BOUND-11–13 (drain+ACK_FAIL, drain+ABANDONED, partial-close) |
| Status / E2 | T-STATUS-10–11 (status write fail after E2, meta partial file) |
| Memory / handoff | T-MEM-08 (identity ack counter returns to zero) |
| Writer lifecycle | T-WRITER-09 (partial-close fd tracking) |
| Child state | T-STATE-06–09 (waitpid-reap-then-raise, exception at each escalation stage) |
| Tool failure | T-TOOL-01–04 (concrete inline) |
| Integration | T-INT-01–02 (concrete inline) |

### 27.3 Diagnostic status words added

`IDENTITY_NOT_RECORDED` — added to §3.3 fixed diagnostic status words.

### 27.4 Files modified

- `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md` — corrected (this document)
- `TASKS.md` — this task's fields
- `TASKS_BACKLOG_FULL.md` — this task's body
- `docs/control-plane/SATURATION_PROOF.json` — validator output

---

## 28. Correction record #12 — Three targeted defects (2026-09-20, baseline `e5457b55ac86ddd50cad38434a70f061153d949e`)

**Scope:** Resolve three remaining defects identified by Keith. Targeted corrections only.

### 28.1 Corrections applied

| # | Finding | Corrected mechanism | Sections changed |
|---|---|---|---|
| 1 | `_bounded_terminate` sends SIGTERM immediately when no prior signal; escalation vars undefined if pipe-end close fails | `_bounded_terminate` receives `T_invoke_mono`; waits until original 30s deadline with non-blocking child checks before sending SIGTERM; escalation vars initialized in §7.3 before pipe-end closure | §7.3, §7.5, §7.6, §7.9, §17.9 |
| 2 | Writer `closed` set records successful closes only; `os.close` that raises after kernel-level close leaves fd untracked; handler retries freed fd number | `close_attempted` set marks ownership relinquishment *before* `os.close` invocation; any close error prevents ACK_OK; cleanup closes only un-attempted fds | §9.4, §17.7 |
| 3 | Fully written `status.json` with COMPLETED may survive fsync/close failure; file presence alone cannot prove success | **Success-evidence rule** (§11.5): COMPLETED requires collector exit 0 AND checked status.json AND artifacts present; unknown/nonzero collector exit → incomplete regardless of file contents; collector exit distinct from captured child exit | §9.5, §11.1, §11.4, §11.5 (new), §17.6 |

### 28.2 New verification cases added

| Category | New cases |
|---|---|
| Child state | T-STATE-10 (exception before deadline, child runs until deadline), T-STATE-11 (pipe-end close failure with initialized vars) |
| Writer lifecycle | T-WRITER-10 (close-then-raise with fd reuse; replacement untouched) |
| Status / E2 | T-STATUS-12 (all status bytes written, fsync fails, collector exits 2), T-STATUS-13 (close raises, collector exits 2) |

### 28.3 Files modified

- `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md` — corrected (this document)
- `TASKS.md` — this task's fields
- `TASKS_BACKLOG_FULL.md` — this task's body
- `docs/control-plane/SATURATION_PROOF.json` — validator output

---

## 29. Step 3 record — Implementation (2026-09-21, baseline `4e2231a8e2841fce3c134c0c861f02362e3ba5b9`)

**Scope:** Implement the frozen five-file scope and run the frozen fake-only verification plan.

### 29.1 Admission

Admitted to Lane 1 at baseline `4e2231a8e2841fce3c134c0c861f02362e3ba5b9`. Both lanes EMPTY, GOVERNANCE UNOWNED, all admission checks passed. HOTFILE leases acquired for all five implementation files. Validator PASS at admission.

### 29.2 Implementation

All five frozen files created:

| Path | Action | Notes |
|---|---|---|
| `ops/pm2-recovery-capture/capture.py` | CREATE | Full pipe/EOF architecture per §§1–15; ~650 lines |
| `ops/pm2-recovery-capture/tests/test_capture.py` | CREATE | Fake-only test suite; covers T-ARG, T-TARGET, T-STORE, T-INVOKE, T-HASH, T-WRITER, T-MEM, T-STATE, T-BOUND, T-STATUS, T-TOOL, T-INT, T-PRE, T-POST |
| `ops/pm2-recovery-capture/.gitattributes` | CREATE | `* text eol=lf` |
| `ops/pm2-recovery-capture/SHA256SUMS` | CREATE | SHA-256 of all four other files |
| `ops/pm2-recovery-capture/README.md` | CREATE | Purpose, usage, constraints, operational status |

### 29.3 Deviations

None from the frozen design. All mechanisms implemented as specified in §§1–15.

### 29.4 Test environment blocker

**LINUX_REQUIRED.** The capture mechanism uses Linux-only APIs (`signal.SIGCHLD`, `os.waitpid` with `WNOHANG`, `select.poll`, `pwd` module, Unix domain sockets). The available environment is Windows 10 with Python 3.13.1. WSL has only a stopped `docker-desktop` distribution with no Python or pytest.

Per Keith's instruction: "Use an existing permitted local Linux environment if available; do not substitute live staging, start Docker, or install new infrastructure to bypass a missing environment. Report a genuine environment blocker."

- **Tests written:** All frozen case IDs mapped to test functions.
- **Tests executed:** 0 (Linux environment unavailable).
- **Python syntax verified:** Both `capture.py` and `test_capture.py` pass `ast.parse` on Windows.

### 29.5 Verification status

| Check | Result |
|---|---|
| Python syntax (capture.py) | PASS (ast.parse) |
| Python syntax (test_capture.py) | PASS (ast.parse) |
| SHA256SUMS computed | PASS (excludes manifest itself) |
| git diff --check | PASS (exit 0; known LF/CRLF warning on sidecar) |
| Lane validator | PASS |
| Fake-only test suite | NOT EXECUTED (LINUX_REQUIRED) |

### 29.6 Preserved statuses

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding.

### 29.7 Files modified (control-plane)

- `docs/PM2-RECOVERY-CAPTURE-01-STAGE-START.md` — status header + §29
- `TASKS.md` — occupancy block, this task's fields
- `TASKS_BACKLOG_FULL.md` — this task's body
- `docs/control-plane/lane-saturation-state.json` — admission, candidate status
- `docs/control-plane/SATURATION_PROOF.json` — validator output

### 29.8 Step 3 continuation — Linux test environment (2026-09-21)

**Authorization:** Keith authorized Docker Desktop startup and a disposable Linux Python/pytest container with LOCAL-RUNTIME and CONTAINER-MANAGER leases.

**Environment:**
- Image: `python:3.12-slim` (`sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9`, linux/amd64)
- Python: 3.12.14
- pytest: 9.1.1
- Container: `pm2capture-test` (disposable, `--rm`)
- Test user: `testrunner` (uid=1000, non-root)
- Mount: `ops/pm2-recovery-capture` → `/mnt/capture:ro`
- Working copy: `/home/testrunner/work/` (copied from read-only mount, sha256 verified)

**Test defects fixed (5):**

| Test | Defect | Fix |
|---|---|---|
| `test_target_01_account_mismatch` | `monkeypatch.setattr('os.geteuid', lambda: os.geteuid())` creates infinite recursion | Capture `real_euid = os.geteuid()` before patching; use `lambda: real_euid` |
| `test_store_06_group_writable` | `d.mkdir(mode=0o770)` masked by umask; actual mode lacks S_IWGRP | Add explicit `d.chmod(0o770)` after mkdir |
| `test_store_07_other_writable` | `d.mkdir(mode=0o707)` masked by umask; actual mode lacks S_IWOTH | Add explicit `d.chmod(0o707)` after mkdir |
| `test_store_08_mode_0757` | `d.mkdir(mode=0o757)` masked by umask; forbidden bits absent | Add explicit `d.chmod(0o757)` after mkdir |
| `test_store_01_not_writable` | Root user bypasses `os.access(path, os.W_OK)` | Run as non-root `testrunner` (uid=1000); no code change needed |

**Files changed:** `ops/pm2-recovery-capture/tests/test_capture.py` only (4 targeted edits). `ops/pm2-recovery-capture/SHA256SUMS` regenerated.

**Test command:**
```
docker exec --user testrunner pm2capture-test bash -c \
  "cd /home/testrunner/work && PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_capture.py -v --tb=long"
```

**Results:** 52 collected, **52 passed**, 0 failed, 0 skipped in 0.12s.

**SHA256SUMS:** Regenerated and verified (`sha256sum -c SHA256SUMS` → all OK).

**Environment blocker:** RESOLVED. Linux execution succeeded via authorized Docker Desktop container.

### 29.9 Verification status (final)

| Check | Result |
|---|---|
| Python syntax (capture.py) | PASS (ast.parse) |
| Python syntax (test_capture.py) | PASS (ast.parse) |
| Fake-only test suite (Linux) | **PASS** (52/52) |
| SHA256SUMS computed and verified | PASS (excludes manifest itself) |
| git diff --check | See final report |
| Lane validator | See final report |

### 29.10 Preserved statuses

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding. Step 4 NOT AUTHORIZED.

### 29.11 Step 3 correction — six-group implementation and test defects (2026-09-21)

**Trigger:** Source review found that the previous 52-test suite did not exercise `run_capture()`, `main()`, or fake PM2 processes. Coverage claims withdrawn; limited coverage recorded honestly.

**capture.py corrections (6 groups):**

| Group | Defect | Fix |
|---|---|---|
| 1. Behavioral coverage | Tests only checked constants, not behavior | New behavioral tests exercising `run_capture()` with fake processes |
| 2. Metadata compatibility | `build_observation_meta()` emitted wrong field names (`acq_record` not `acquisition_record`, `T_invoke` not `captured_at`), extra keys (`account`, `pm2_binary`, `anomaly_flags`, etc.), missing `schema` field | Rewrote to emit only verifier-accepted fields; added `SCHEMA_OBSERVATION_META` constant; private evidence moved to E2 only |
| 3. Stream completion | `OSError` catch on `os.read` conflated EAGAIN (no data yet) with true errors and EOF | Separate `BlockingIOError` handler (continue); `OSError` sets `read_error=True`; only zero-byte read without exception = EOF; `read_error` prevents COMPLETED |
| 4. Observation checks | Command-substring exclusions (`'pgrep' in cmd`); no post-invocation socket check; tool signal termination ignored | PID-based exclusions using `subprocess.Popen` to capture pgrep PID; added post-invocation `lsof` socket-holder observation; signal termination handled as failure |
| 5. Post-launch exception | Poller construction unprotected after launch; child could be orphaned | Wrapped `select.poll()`/`register()` in try/except calling `_bounded_terminate` |
| 6. Evidence/outcomes | `T_post_cmd` recorded after drain, not at reap; DEFERRED ignores status write failure; E2 not written for DEFERRED | `T_post_cmd` recorded inside loop at reap; E2 written before status for DEFERRED; failed status write exits 2, not DEFERRED |

**test_capture.py rewrite:**
- Previous: 52 tests — constants, helpers, pattern matching, unit-only
- Current: 76 tests — adds behavioral tests exercising `run_capture()` with fake processes (normal, error, timeout, fork/descendant), stream completion (EAGAIN vs EOF, read errors), metadata compatibility (8 tests against verifier schema), memory saturation, poller failure, stalled writer, close-then-raise with fd reuse, cleanup deadline preservation, status write failure paths

**Test defects fixed during this cycle (3):**

| Test | Defect | Fix |
|---|---|---|
| `test_stream_read_error_prevents_completed` | Global `os.read` monkeypatch broke `subprocess.Popen` internals | Target only non-blocking fds via `fcntl.F_GETFL` check |
| `test_writer_10_close_then_raise_reuse` | Close log matched pre-creation close of same fd number | Track `replacement_created` flag; only check closes after replacement creation |
| `test_stream_read_error_prevents_completed` | Intentional `raise OSError` caught by same try/except block | Moved `fcntl` check into try; raise outside the except handler |

**Environment:** Docker Desktop, `python:3.12-slim`, Python 3.12.14, pytest 9.1.1, non-root `testrunner` (uid=1000).

**Results:** 76 collected, **76 passed**, 0 failed, 0 skipped in 13.54s.

**SHA256SUMS:** Regenerated and verified.

**Frozen-case-to-test mapping:**

| Frozen case | Test | Exercises |
|---|---|---|
| Normal capture (exit 0, both EOF) | `test_invoke_normal_capture` | `run_capture()` with fake pm2 → REAPED, exit 0, EOF both, stdout content |
| Non-zero exit | `test_invoke_nonzero_exit` | `run_capture()` with fake pm2 error → REAPED, exit 1, NON_ZERO_EXIT |
| Timeout + SIGTERM + SIGKILL | `test_invoke_timeout_sigterm_sigkill` | `run_capture()` with SIGTERM-ignoring fake → REAPED via SIGKILL, TIMEOUT flag |
| Slow process timeout | `test_invoke_slow_timeout` | `run_capture()` with sleeping fake → SIGTERM kills, TIMEOUT flag |
| Descendant holds pipe | `test_invoke_fork_descendant_holds_pipe` | `run_capture()` with forking fake → parent data captured, drain timeout |
| T_post_cmd at reap | `test_invoke_t_post_cmd_at_reap` | T_post_cmd recorded when child exits, not after drain |
| Identity enqueue failure | `test_invoke_identity_enqueue_failure` | Supervision continues despite identity enqueue error |
| EAGAIN vs EOF | `test_stream_eagain_not_eof` | Delayed output not lost to premature EOF |
| Read error prevents COMPLETED | `test_stream_read_error_prevents_completed` | OSError on pipe read → read_error=True |
| Metadata schema | `test_meta_schema_field_present` | schema field = verifier constant |
| Metadata allowed keys only | `test_meta_only_allowed_keys` | No extra keys beyond verifier set |
| Metadata required fields | `test_meta_required_fields_present` | All 7 required fields present |
| Metadata field names | `test_meta_field_name_mapping` | `acquisition_record` not `acq_record`, `captured_at` not `T_invoke` |
| daemon_pid omission on IDENTITY_CHANGE | `test_meta_daemon_pid_omitted_on_identity_change` | Key absent when flag set |
| daemon_pid omission on DAEMON_DISAPPEARED | `test_meta_daemon_pid_omitted_on_disappeared` | Key absent when flag set |
| jlist_sha256 hex format | `test_meta_jlist_sha256_format` | Lowercase 64-char hex |
| daemon_pid positive int | `test_meta_daemon_pid_positive_int` | Not null, not bool, positive |
| Stalled writer | `test_writer_06_stalled_writer` | Writer event not set while write blocks |
| Close-then-raise reuse | `test_writer_10_close_then_raise_reuse` | Replacement fd not closed by cleanup |
| Memory saturation | `test_mem_large_output_saturates` | Output > MEM_CAP → backpressure, some data captured |
| Cleanup preserves deadline | `test_state_cleanup_preserves_deadline` | _bounded_terminate waits near TIMEOUT_LIMIT before SIGTERM |
| Poller failure after launch | `test_except_poller_failure_exits` | select.poll() failure → bounded terminate + exit 2 |
| Status write failure | `test_status_write_failure_returns_false` | create_private_file error → returns False |
| DEFERRED status failure | `test_deferred_status_write_failure` | Failed status write not ignored |

**Remaining gaps:**
- Ambiguous reaping — **CLOSED.** 7 fault-injection tests added (see §29.13).
- Offline verifier compatibility — **CLOSED.** 4 tests using the real locked verifier (see §29.13).
- Persistence-timeout → ABANDONED — **CLOSED.** 3 subprocess-isolated tests (see §29.13).

### 29.13 Step 3 gap-closure cycle — three verification gaps

**Date:** 2026-09-21
**Environment:** Docker Desktop, `python:3.10-slim`, Python 3.10.21, pytest 9.1.1, root testrunner.
**Results:** 90 collected, **89 passed**, **1 skipped** (root permission test), 0 failed in 19.49s.

**Gap 1: Ambiguous reaping** (7 tests added)

| Test | Mechanism |
|---|---|
| `test_ambig_01_reap_then_runtime_error` | waitpid performs real reap, then raises RuntimeError → STATE_UNKNOWN, no signal to child PID |
| `test_ambig_02_child_process_error` | waitpid raises ChildProcessError → IDENTITY_LOST, no signal |
| `test_ambig_03_exception_during_term_grace` | Exception after SIGTERM sent during TERM_GRACE → STATE_UNKNOWN |
| `test_ambig_04_exception_during_kill_grace` | Exception after SIGKILL sent → STATE_UNKNOWN |
| `test_ambig_05_bounded_terminate_no_signal_after_reap` | _bounded_terminate with REAPED → no signals |
| `test_ambig_06_bounded_terminate_no_signal_state_unknown` | _bounded_terminate with STATE_UNKNOWN → no signals |
| `test_ambig_07_cleanup_preserves_existing_term` | SIGTERM already sent → preserves deadline, does not re-send SIGTERM |

**Gap 2: Offline verifier compatibility** (4 tests added)

| Test | Mechanism |
|---|---|
| `test_verifier_01_normal_capture_passes` | Imports locked `compare_dual_env.py`, generates synthetic observation-meta via `build_observation_meta()`, validates with `validate_observation_meta()` → 0 errors |
| `test_verifier_02_captured_at_is_t_obs_start` | Confirms `captured_at` is T_obs_start per acquisition §2.4, not T_invoke |
| `test_verifier_03_daemon_pid_omitted_identity_change` | IDENTITY_CHANGE → verifier accepts metadata without daemon_pid |
| `test_verifier_04_hash_binding` | jlist_sha256 in metadata matches actual file hash; verifier extracts matching value |

**captured_at fix:** `build_observation_meta()` now accepts `t_obs_start` parameter (was `T_invoke_utc`). `main()` passes `t_obs_start` per acquisition §2.4: "captured_at definition: T_obs_start from ACQ-1a."

**Gap 3: Persistence timeout / ABANDONED** (3 tests added)

All three tests run in a subprocess to isolate `os._exit(2)` from pytest:

| Test | Mechanism |
|---|---|
| `test_abandoned_01_persistence_timeout` | Writer blocked at fsync → PERSIST_TIMEOUT expires → exit 2; no metadata, no status; partial files preserved |
| `test_abandoned_02_no_descriptor_close` | Supervisor does not close writer-owned descriptors during ABANDONED |
| `test_abandoned_03_no_fallback_logging` | No fallback persistence, notification writes, or status/e2 files after ABANDONED |

**Additional fix:** `test_store_01_not_writable` now skips when running as root (Docker container).

**Updated frozen-case-to-test mapping (additions only):**

| Frozen case | Test | Decisive assertion |
|---|---|---|
| Ambiguous reap → STATE_UNKNOWN | `test_ambig_01` | `child_state == STATE_UNKNOWN`, no signals to child PID |
| ChildProcessError → IDENTITY_LOST | `test_ambig_02` | `child_state == IDENTITY_LOST`, no signals |
| Exception during TERM grace | `test_ambig_03` | `child_state == STATE_UNKNOWN` |
| Exception during KILL grace | `test_ambig_04` | `child_state == STATE_UNKNOWN` |
| No signal after REAPED | `test_ambig_05` | `len(signals_sent) == 0` |
| No signal after STATE_UNKNOWN | `test_ambig_06` | `len(signals_sent) == 0` |
| Existing SIGTERM preserved | `test_ambig_07` | No re-sent SIGTERM, SIGKILL escalated |
| Verifier full normal | `test_verifier_01` | `errors == []`, all obs fields populated |
| captured_at = T_obs_start | `test_verifier_02` | `doc['captured_at'] == t_obs_start` |
| daemon_pid omission identity | `test_verifier_03` | `'daemon_pid' not in doc`, verifier 0 errors |
| Hash binding exact bytes | `test_verifier_04` | `doc['jlist_sha256'] == expected_hash` |
| Persistence timeout → exit 2 | `test_abandoned_01` | `proc.returncode == 2`, no metadata/status, partial files exist |
| No descriptor close on ABANDONED | `test_abandoned_02` | `proc.returncode == 2`, no supervisor_close logged |
| No fallback writes on ABANDONED | `test_abandoned_03` | `proc.returncode == 2`, no status/e2/meta files |

**SHA256SUMS:** Regenerated and verified (`sha256sum -c` in Linux container).

### 29.14 Preserved statuses (updated)

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding. Step 4 NOT AUTHORIZED.

### 29.15 Step 3 correction — three verified review findings (2026-09-21)

**Finding 1: T-BOUND-04 SCM_RIGHTS survivor EPIPE/SIGPIPE observation**

Previous test proved descriptor transfer prevents EOF and blocks finalization but did not observe EPIPE/SIGPIPE after pipe-reader closure. Corrected: after `run_capture()` returns (pipe readers closed), the test notifies the holder via a separate AF_UNIX socket channel. The holder writes to the transferred pipe fd with a SIGPIPE handler installed. Outcome (EPIPE or SIGPIPE) is written to a marker file and asserted by the test.

| Assertion | Result |
|---|---|
| `child_state == REAPED` | PASSED |
| `not all(eof.values())` | PASSED |
| `write_result in ('EPIPE', 'SIGPIPE')` | PASSED |

**Finding 2: T-STATUS-12/13 targeted fault injection**

Previous tests replaced `write_status_record()` with an unconditional `False` stub. The real code path was not exercised. Corrected: both tests now run `main()` via subprocess with the real `write_status_record()`. Faults are injected at the `os.fsync` (T-STATUS-12) and `os.close` (T-STATUS-13) calls specifically when the target fd points to `status.json`, using `/proc/self/fd` readlink. Marker files confirm the fault was reached.

**T-STATUS-12 (fsync failure):**

| Assertion | Result |
|---|---|
| `proc.returncode == 2` (collector exit) | PASSED |
| `fsync_fault.marker` exists with `FSYNC_FAULT_REACHED` | PASSED |
| `status.json` exists with `attempt_outcome == COMPLETED` | PASSED |
| `stdout.raw` preserved | PASSED |

**T-STATUS-13 (close-after-kernel-close failure):**

| Assertion | Result |
|---|---|
| `proc.returncode == 2` (collector exit) | PASSED |
| `close_fault.marker` exists with `CLOSE_FAULT_REACHED` | PASSED |
| `status.json` exists with content | PASSED |
| `stdout.raw` preserved | PASSED |

**Environment:** python:3.10-slim, non-root testrunner uid=1000, pytest 9.1.1, repository read-only mount.

**Suite:** 128 collected / 128 passed / 0 skipped.

**SHA256SUMS:** Regenerated and verified in Linux (`sha256sum -c`).

```
3edfae233640d5a882dc4c1babceb0b30d6865315ff0376bf079b05cbe35aae5  capture.py
ab824e14c933c38f444fd4c8f52c1f54be78f74637402f106a38f158af626f36  tests/test_capture.py
a79691a93b46e49ce460c26ef22afcc03d6eca1e63bf2edbc20e96159510f6c9  .gitattributes
9ab5347c7e9fa3343c85176680190ea46d1fe3222736efea5e3c41eff4d9d17a  README.md
```

capture.py NOT changed this session.

### 29.16 Preserved statuses (updated)

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding. Step 4 NOT AUTHORIZED.

### 29.17 Step 3 correction — T-BOUND-04 deadline bounding (2026-09-21)

**Problem:** `test_bound_04_scm_rights_transfer` used two blocking `readline()` calls for READY and HOLD_READY messages and an unbounded connect loop for the notification socket. A misbehaving helper could hang the test indefinitely.

**Correction:**
- Both `readline()` calls replaced with `select.select()` on the helper's stdout fd, bounded by `READINESS_DEADLINE` (10 s). `select` returns readable/empty; the exact message (`READY` / `HOLD_READY`) is asserted.
- Notification socket connect loop bounded by `time.monotonic()` deadline with `settimeout()` on the socket.
- `helper_proc.wait(timeout=READINESS_DEADLINE)` replaces unbounded wait.
- New `test_bound_04_helper_never_ready`: launches a helper that hangs, confirms `select` timeout (2 s), kills helper, asserts reap. Proves test infrastructure itself fails bounded when a helper misbehaves.

| Test | Assertion | Result |
|---|---|---|
| `test_bound_04_scm_rights_transfer` | `rlist` truthy after select (READY) | **PASSED** |
| | `ready_line.strip() == b'READY'` | **PASSED** |
| | `rlist` truthy after select (HOLD_READY) | **PASSED** |
| | `hold_line.strip() == b'HOLD_READY'` | **PASSED** |
| | `connected` (notify socket) | **PASSED** |
| | `write_result in ('EPIPE', 'SIGPIPE')` | **PASSED** |
| `test_bound_04_helper_never_ready` | `not rlist` (select timeout) | **PASSED** |
| | `helper_proc.returncode is not None` (cleanup) | **PASSED** |

**Suite:** 129 collected / 129 passed / 0 skipped. capture.py NOT changed.

**SHA256SUMS:**

```
3edfae233640d5a882dc4c1babceb0b30d6865315ff0376bf079b05cbe35aae5  capture.py
6b80351fc8c0f52d86345fb45fbc51f0401227f5af70c14839466268fa75afe9  tests/test_capture.py
a79691a93b46e49ce460c26ef22afcc03d6eca1e63bf2edbc20e96159510f6c9  .gitattributes
9ab5347c7e9fa3343c85176680190ea46d1fe3222736efea5e3c41eff4d9d17a  README.md
```

### 29.18 Preserved statuses (updated)

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding. Step 4 NOT AUTHORIZED.

### 29.19 Step 3 correction — non-blocking readiness reader (2026-09-21)

**Problem:** The `select()+readline()` readiness pattern used a blocking `readline()` after `select` indicated readability. If `select` returned for a partial write (bytes available but no newline), `readline()` would block indefinitely. Two separate per-call deadlines did not share a single absolute bound.

**Correction:**

- Added `_read_readiness_line(proc_stdout, deadline_abs, max_bytes=256)` static method to `TestRunCapture`.
- Sets fd non-blocking via `os.set_blocking(fd, False)`.
- Loops: `select.select` with remaining time → `os.read(fd, 1024)` → accumulate into `buf`.
- Returns stripped line bytes on first `\n`.
- Raises `AssertionError` on: deadline expiry (includes partial bytes in message), premature EOF (`os.read` returns empty), or oversized message (> `max_bytes` before newline).
- Restores blocking mode in `finally`.
- Both READY and HOLD_READY use the same reader under one shared `deadline_abs = time.monotonic() + 10`.
- Notification socket connect loop bounded by the same `deadline_abs`.
- `helper_proc.wait` timeout derived from remaining deadline.

**Negative tests:**

| Test | Scenario | Assertion | Result |
|---|---|---|---|
| `test_bound_04_helper_never_ready` | Helper hangs, writes nothing | `AssertionError` matching `deadline expired`; helper killed and reaped | **PASSED** |
| `test_bound_04_helper_partial_then_stalls` | Helper writes `"REA"` (no newline) then hangs | `AssertionError` matching `deadline expired.*REA`; helper killed and reaped | **PASSED** |

**Main test unchanged assertions:**

| Assertion | Result |
|---|---|
| `ready_msg == b'READY'` (via reader) | **PASSED** |
| `hold_msg == b'HOLD_READY'` (via reader) | **PASSED** |
| `write_result in ('EPIPE', 'SIGPIPE')` | **PASSED** |

**Suite:** 130 collected / 130 passed / 0 skipped. capture.py NOT changed.

**SHA256SUMS:**

```
3edfae233640d5a882dc4c1babceb0b30d6865315ff0376bf079b05cbe35aae5  capture.py
31886a065fb446c4558a87a6f829334ce6e1708af0db3f7718647c546ec7eae5  tests/test_capture.py
a79691a93b46e49ce460c26ef22afcc03d6eca1e63bf2edbc20e96159510f6c9  .gitattributes
9ab5347c7e9fa3343c85176680190ea46d1fe3222736efea5e3c41eff4d9d17a  README.md
```

### 29.20 Preserved statuses (updated)

MECHANISM_ESTABLISHED=NO. P7_ACCEPTED=NO. HOST_CLEAN=NO. UNCLEAN/HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Harness UNCHANGED. P5 journal-applicability UNRESOLVED. A1/A2 contract-only. P2/P3 binding. Step 4 NOT AUTHORIZED.
