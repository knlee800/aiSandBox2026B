#!/usr/bin/env python3
"""
PM2-RECOVERY-CAPTURE-01 — Bounded PM2 observation capture mechanism.

Implements the pipe/EOF architecture from the frozen design (§§1–15).
Linux only. Python >= 3.6. No third-party dependencies.

This tool captures a single `pm2 jlist` observation under strict
supervision with bounded deadlines, private storage, and exact-byte
hashing. It does NOT retry, clean up, correct the host, or adopt
observed values as baseline.

Exit codes:
    0  COMPLETED — all artifacts finalized and records written
    1  FAILED — pre-invocation failure
    2  FAILED — post-launch or finalization failure
    3  DEFERRED — partial stream persisted; not finalized
   10  USAGE — invalid arguments or missing tools
"""
from __future__ import print_function

import argparse
import datetime
import errno
import hashlib
import json
import logging
import os
import pwd
import queue
import re
import select
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time

# ---------------------------------------------------------------------------
# Constants — locked operational limits (§3.4 item 4) and design choices
# ---------------------------------------------------------------------------
TIMEOUT_LIMIT = 30   # Child deadline from T_invoke (locked)
TERM_GRACE = 5       # SIGTERM -> SIGKILL escalation (locked)
KILL_GRACE = 5        # SIGKILL -> KILL_FAILED (locked)
DRAIN_GRACE = 5       # Post-reap pipe drain timeout (design)
PERSIST_TIMEOUT = 5   # Writer shutdown ack timeout (design)
MEM_CAP = 16 * 1024 * 1024  # 16 MiB payload byte budget (design)

# Tags for the writer queue
STDOUT_TAG = 'STDOUT'
STDERR_TAG = 'STDERR'
IDENTITY_TAG = 'IDENTITY'
SENTINEL = object()

# Authoritative child states (§7.4)
LAUNCHED = 'LAUNCHED'
REAPED = 'REAPED'
IDENTITY_LOST = 'IDENTITY_LOST'
STATE_UNKNOWN = 'STATE_UNKNOWN'
KILL_FAILED_STATE = 'KILL_FAILED'

# Writer acknowledgement
ACK_OK = 'ACK_OK'
ACK_FAIL = 'ACK_FAIL'

# Validation patterns (verifier-aligned)
ID_RE = r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}'
HOST_RE = r'[A-Za-z0-9][A-Za-z0-9.-]{0,253}'

# Required external tools
REQUIRED_TOOLS = ['pgrep', 'lsof', 'sha256sum', 'readlink', 'id', 'stat']

# Forbidden permission bits for parent directory (§5.3)
FORBIDDEN_BITS = stat.S_IWGRP | stat.S_IWOTH | stat.S_ISVTX

# Locked publication allowlist anomaly flags (§3.5 / §5.5)
ALLOWED_ANOMALY_FLAGS = frozenset([
    'TIMEOUT', 'NON_ZERO_EXIT', 'IDENTITY_CHANGE',
    'DAEMON_DISAPPEARED', 'AUTO_LAUNCH_SUSPECTED', 'LINGERING_CLIENT',
])

# Verifier-compatible schema identifier (locked)
SCHEMA_OBSERVATION_META = 'aisb.pm2-dual-env-observation-meta.v1'

# ---------------------------------------------------------------------------
# Logging — fixed [capture] tag, no captured data (§3.3)
# ---------------------------------------------------------------------------
_log = logging.getLogger('capture')
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter('[capture] %(message)s'))
_log.addHandler(_handler)
_log.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Private error handling (§3.3)
# ---------------------------------------------------------------------------
_original_excepthook = sys.excepthook


def _safe_excepthook(exc_type, exc_value, exc_tb):
    """Top-level exception handler: fixed diagnostic only."""
    try:
        sys.stderr.write('[capture] INTERNAL: unhandled exception\n')
        sys.stderr.flush()
    except Exception:
        pass
    os._exit(2)


sys.excepthook = _safe_excepthook


class SafeArgumentParser(argparse.ArgumentParser):
    """ArgumentParser that never echoes supplied argument values (§16.1)."""

    def error(self, message):
        sys.stderr.write('[capture] USAGE: invalid arguments\n')
        sys.stderr.flush()
        sys.exit(10)

    def exit(self, status=0, message=None):
        if status != 0:
            sys.stderr.write('[capture] USAGE: invalid arguments\n')
            sys.stderr.flush()
        sys.exit(status if status != 0 else 10)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _decode_wait_status(raw_status):
    """Decode waitpid raw status into a return code (§7.5)."""
    if os.WIFEXITED(raw_status):
        return os.WEXITSTATUS(raw_status)
    if os.WIFSIGNALED(raw_status):
        return -(os.WTERMSIG(raw_status))
    raise ValueError('unknown wait status encoding')


def _safe_kill(pid, sig):
    """Send signal to pid, catching ESRCH/EPERM (§7.5)."""
    try:
        os.kill(pid, sig)
    except OSError as e:
        if e.errno not in (errno.ESRCH, errno.EPERM):
            raise


def create_private_file(path):
    """Create a private file with O_CREAT|O_EXCL|O_WRONLY, mode 0600 (§5.1)."""
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    return fd


def _write_all(fd, data):
    """Write all bytes to fd, handling short writes (§9.4)."""
    buf = memoryview(data)
    while len(buf) > 0:
        n = os.write(fd, buf)
        if n <= 0:
            raise OSError('zero-length write')
        buf = buf[n:]


def _hash_file(path):
    """SHA-256 hash of file bytes in 64 KiB chunks (§10.1)."""
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _run_tool(args):
    """Run an external tool with private output routing (§3.3)."""
    return subprocess.run(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


# ---------------------------------------------------------------------------
# Writer thread (§9.4)
# ---------------------------------------------------------------------------

def _writer_main(stdout_fd, stderr_fd, identity_fd, data_queue,
                 ack_queue, writer_event, result_slot_ref):
    """Writer thread: owns file fds through fsync and close."""
    close_attempted = set()
    try:
        fd_map = {
            STDOUT_TAG: stdout_fd,
            STDERR_TAG: stderr_fd,
            IDENTITY_TAG: identity_fd,
        }
        while True:
            item = data_queue.get()
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
            close_attempted.add(fd)
            os.close(fd)
        result_slot_ref[0] = ACK_OK
    except Exception:
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


# ---------------------------------------------------------------------------
# Bounded terminate — exception path (§7.6)
# ---------------------------------------------------------------------------

def _bounded_terminate(proc, child_state, T_invoke_mono,
                       sigterm_sent, sigterm_mono,
                       sigkill_sent, sigkill_mono):
    """Bounded child termination preserving locked 30/5/5 sequence."""
    if child_state != LAUNCHED:
        return

    if not sigterm_sent:
        initial_deadline = T_invoke_mono + TIMEOUT_LIMIT
        while time.monotonic() < initial_deadline:
            try:
                r, st = os.waitpid(proc.pid, os.WNOHANG)
            except ChildProcessError:
                return
            except Exception:
                return
            if r:
                try:
                    proc.returncode = _decode_wait_status(st)
                except Exception:
                    pass
                return
            time.sleep(0.05)
        _safe_kill(proc.pid, signal.SIGTERM)
        sigterm_mono = time.monotonic()

    term_deadline = sigterm_mono + TERM_GRACE
    while time.monotonic() < term_deadline:
        try:
            r, st = os.waitpid(proc.pid, os.WNOHANG)
        except ChildProcessError:
            return
        except Exception:
            return
        if r:
            try:
                proc.returncode = _decode_wait_status(st)
            except Exception:
                pass
            return
        time.sleep(0.05)

    if not sigkill_sent:
        _safe_kill(proc.pid, signal.SIGKILL)
        sigkill_mono = time.monotonic()

    kill_deadline = sigkill_mono + KILL_GRACE
    while time.monotonic() < kill_deadline:
        try:
            r, st = os.waitpid(proc.pid, os.WNOHANG)
        except ChildProcessError:
            return
        except Exception:
            return
        if r:
            try:
                proc.returncode = _decode_wait_status(st)
            except Exception:
                pass
            return
        time.sleep(0.05)
    # KILL_FAILED — child becomes orphan


# ---------------------------------------------------------------------------
# Phase 0: Argument validation and tool check (§16)
# ---------------------------------------------------------------------------

def parse_and_validate_args():
    """Parse CLI arguments with safe error handling (§16.1–16.3)."""
    parser = SafeArgumentParser(
        description='Bounded PM2 observation capture',
        add_help=False,
    )
    parser.add_argument('--account', required=True)
    parser.add_argument('--pm2-binary', required=True)
    parser.add_argument('--pm2-home', required=True)
    parser.add_argument('--observation-id', required=True)
    parser.add_argument('--host', required=True)
    parser.add_argument('--captured-by', required=True)
    parser.add_argument('--acq-record', required=True)
    parser.add_argument('--output-dir', required=True)

    args = parser.parse_args()

    # Validation (§16.2)
    if not args.account:
        _log.error('USAGE: --account is empty')
        sys.exit(10)

    if not re.fullmatch(ID_RE, args.observation_id):
        _log.error('USAGE: invalid --observation-id')
        sys.exit(10)

    if not re.fullmatch(HOST_RE, args.host):
        _log.error('USAGE: invalid --host')
        sys.exit(10)

    if not args.captured_by or len(args.captured_by) > 1024:
        _log.error('USAGE: invalid --captured-by')
        sys.exit(10)
    for ch in args.captured_by:
        if ord(ch) < 0x20 or ord(ch) == 0x7f:
            _log.error('USAGE: invalid --captured-by')
            sys.exit(10)

    if not re.fullmatch(ID_RE, args.acq_record):
        _log.error('USAGE: invalid --acq-record')
        sys.exit(10)

    if not os.path.isdir(args.output_dir):
        _log.error('USAGE: --output-dir is not a directory')
        sys.exit(10)

    # Tool availability (§16.3)
    for tool in REQUIRED_TOOLS:
        if shutil.which(tool) is None:
            _log.error('USAGE: required tool not found: %s', tool)
            sys.exit(10)

    return args


# ---------------------------------------------------------------------------
# Phase 1: Target enforcement (§4)
# ---------------------------------------------------------------------------

def enforce_target(args):
    """Verify account, binary, PM2_HOME, socket, and daemon (§4.1)."""
    # Effective execution identity
    effective_uid = os.geteuid()
    try:
        effective_user = pwd.getpwuid(effective_uid).pw_name
    except KeyError:
        _log.error('TARGET: cannot resolve effective UID')
        sys.exit(1)

    if effective_user != args.account:
        _log.error('TARGET: account mismatch')
        sys.exit(1)

    # Binary enforcement
    resolved_binary = os.path.realpath(args.pm2_binary)
    if not os.path.isfile(resolved_binary):
        _log.error('TARGET: pm2-binary not found')
        sys.exit(1)
    if not os.access(resolved_binary, os.X_OK):
        _log.error('TARGET: pm2-binary not executable')
        sys.exit(1)

    # PM2_HOME enforcement
    resolved_home = os.path.realpath(args.pm2_home)
    if not os.path.isdir(resolved_home):
        _log.error('TARGET: pm2-home not found')
        sys.exit(1)

    # Socket enforcement
    socket_path = os.path.join(resolved_home, 'rpc.sock')
    try:
        st = os.stat(socket_path)
    except OSError:
        _log.error('TARGET: DAEMON_ABSENT')
        sys.exit(1)
    if not stat.S_ISSOCK(st.st_mode):
        _log.error('TARGET: DAEMON_ABSENT')
        sys.exit(1)

    # Socket-holder cross-reference (§4.1 item 5)
    result = _run_tool(['lsof', '-t', '--', socket_path])
    if result.returncode != 0:
        _log.error('TARGET: TARGET_INCONSISTENT')
        sys.exit(1)
    socket_holders = set()
    for line in result.stdout.decode('utf-8', errors='replace').strip().split('\n'):
        line = line.strip()
        if line:
            try:
                socket_holders.add(int(line))
            except ValueError:
                pass

    return resolved_binary, resolved_home, socket_path, socket_holders


# ---------------------------------------------------------------------------
# Phase 2: Fresh private storage (§5)
# ---------------------------------------------------------------------------

def create_private_storage(args, effective_uid):
    """Create fresh private attempt directory and output files (§5.1–5.3)."""
    output_dir = args.output_dir

    # Parent-directory trust (§5.3)
    real_output = os.path.realpath(output_dir)
    if real_output != os.path.abspath(output_dir):
        _log.error('STORAGE: symlink in output-dir')
        sys.exit(1)

    dir_stat = os.stat(real_output)
    if dir_stat.st_uid != effective_uid:
        _log.error('STORAGE: ownership mismatch')
        sys.exit(1)
    if dir_stat.st_mode & FORBIDDEN_BITS:
        _log.error('STORAGE: forbidden permission bits')
        sys.exit(1)
    if not os.access(real_output, os.W_OK):
        _log.error('STORAGE: not writable')
        sys.exit(1)

    # Set umask
    old_umask = os.umask(0o077)

    try:
        attempt_dir = tempfile.mkdtemp(prefix='capture-', dir=real_output)
    except OSError:
        os.umask(old_umask)
        _log.error('STORAGE: STORAGE_FAILURE')
        sys.exit(1)

    # Verify attempt directory
    ad_stat = os.stat(attempt_dir)
    ad_real = os.path.realpath(attempt_dir)
    if ad_real != attempt_dir:
        _log.error('STORAGE: STORAGE_FAILURE')
        sys.exit(1)
    if ad_stat.st_uid != effective_uid:
        _log.error('STORAGE: STORAGE_FAILURE')
        sys.exit(1)
    if stat.S_IMODE(ad_stat.st_mode) != 0o700:
        _log.error('STORAGE: STORAGE_FAILURE')
        sys.exit(1)

    # Create output files via O_CREAT|O_EXCL (§5.1 item 4)
    stdout_path = os.path.join(attempt_dir, 'stdout.raw')
    stderr_path = os.path.join(attempt_dir, 'stderr.raw')
    identity_path = os.path.join(attempt_dir, 'child-identity.log')

    try:
        stdout_fd = create_private_file(stdout_path)
        stderr_fd = create_private_file(stderr_path)
        identity_fd = create_private_file(identity_path)
    except OSError:
        _log.error('STORAGE: STORAGE_FAILURE')
        sys.exit(1)

    return attempt_dir, stdout_path, stderr_path, identity_path, \
        stdout_fd, stderr_fd, identity_fd, old_umask


# ---------------------------------------------------------------------------
# Phase 3: Pre-invocation observations — ACQ-1 (§6)
# ---------------------------------------------------------------------------

def pre_invocation_observations(args, socket_holders, resolved_home):
    """Collect ACQ-1a–1e observations (§6.1)."""
    # ACQ-1a — T_obs_start
    t_obs_start = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    # ACQ-1c — Daemon PID
    result = _run_tool([
        'pgrep', '-af', 'God Daemon', '-u', args.account
    ])
    daemon_pid = None
    if result.returncode == 1:
        _log.error('PRE-OBS: DAEMON_ABSENT')
        sys.exit(1)
    if result.returncode < 0 or result.returncode >= 2:
        _log.error('PRE-OBS: OBSERVATION_TOOL_FAILURE')
        sys.exit(1)

    lines = result.stdout.decode('utf-8', errors='replace').strip().split('\n')
    valid_lines = [l.strip() for l in lines if l.strip()]
    if len(valid_lines) == 0:
        _log.error('PRE-OBS: DAEMON_ABSENT')
        sys.exit(1)
    if len(valid_lines) > 1:
        _log.error('PRE-OBS: MULTIPLE_DAEMON_MATCHES')
        sys.exit(1)

    parts = valid_lines[0].split(None, 1)
    if len(parts) < 1:
        _log.error('PRE-OBS: OBSERVATION_TOOL_FAILURE')
        sys.exit(1)
    try:
        daemon_pid = int(parts[0])
    except ValueError:
        _log.error('PRE-OBS: OBSERVATION_TOOL_FAILURE')
        sys.exit(1)

    # Cross-reference daemon with socket holders
    if daemon_pid not in socket_holders:
        _log.error('PRE-OBS: TARGET_INCONSISTENT')
        sys.exit(1)

    # ACQ-1e — P5 check (PID-based exclusions per frozen design)
    p5_proc = subprocess.Popen(
        ['pgrep', '-af', 'pm2', '-u', args.account],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    p5_pid = p5_proc.pid
    p5_stdout, p5_stderr = p5_proc.communicate()
    p5_returncode = p5_proc.returncode
    if p5_returncode < 0:
        _log.error('PRE-OBS: OBSERVATION_TOOL_FAILURE')
        sys.exit(1)
    if p5_returncode >= 2:
        _log.error('PRE-OBS: OBSERVATION_TOOL_FAILURE')
        sys.exit(1)
    if p5_returncode == 0:
        p5_lines = p5_stdout.decode('utf-8', errors='replace').strip().split('\n')
        own_pid = os.getpid()
        known_pids = {daemon_pid, own_pid, p5_pid}
        for line in p5_lines:
            line = line.strip()
            if not line:
                continue
            line_parts = line.split(None, 1)
            if len(line_parts) < 1:
                continue
            try:
                pid = int(line_parts[0])
            except ValueError:
                continue
            if pid in known_pids:
                continue
            _log.error('PRE-OBS: P5_NOT_SATISFIED')
            sys.exit(1)

    return t_obs_start, daemon_pid


# ---------------------------------------------------------------------------
# Phase 4: Bounded jlist invocation and stream capture — ACQ-2 (§7)
# ---------------------------------------------------------------------------

def run_capture(args, resolved_binary, resolved_home, attempt_dir,
                stdout_fd, stderr_fd, identity_fd, daemon_pid):
    """Execute the bounded jlist capture (§7.1–7.9)."""
    # Create pipes
    out_r, out_w = os.pipe()
    err_r, err_w = os.pipe()
    os.set_blocking(out_r, False)
    os.set_blocking(err_r, False)

    # Start writer thread (§7.1 step 4, §9.4)
    data_queue_obj = queue.Queue()
    ack_queue_obj = queue.Queue()
    writer_event = threading.Event()
    result_slot = [None]

    writer = threading.Thread(
        target=_writer_main,
        args=(stdout_fd, stderr_fd, identity_fd, data_queue_obj,
              ack_queue_obj, writer_event, result_slot),
        daemon=True,
    )
    writer.start()

    # §7.2 SIGCHLD disposition and signal handlers
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)
    interrupted = [False]

    def _interrupt_handler(sig, frame):
        interrupted[0] = True

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, _interrupt_handler)

    # §7.3 Launch and identity recording
    budget_used = 0
    identity_recorded = True

    T_invoke_utc = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    T_invoke_mono = time.monotonic()

    try:
        proc = subprocess.Popen(
            [resolved_binary, 'jlist'],
            stdout=out_w, stderr=err_w, stdin=subprocess.DEVNULL,
            close_fds=True,
            env=dict(os.environ, PM2_HOME=resolved_home),
        )
    except Exception:
        os.close(out_w)
        os.close(err_w)
        os.close(out_r)
        os.close(err_r)
        data_queue_obj.put_nowait(SENTINEL)
        _log.error('INVOKE: INVOCATION_FAILED')
        sys.exit(2)

    child_pid = proc.pid
    child_state = LAUNCHED

    sigterm_sent = False
    sigkill_sent = False
    sigterm_mono = 0.0
    sigkill_mono = 0.0

    try:
        os.close(out_w)
        os.close(err_w)
    except Exception:
        _bounded_terminate(proc, child_state, T_invoke_mono,
                           sigterm_sent, sigterm_mono,
                           sigkill_sent, sigkill_mono)
        sys.exit(2)

    try:
        identity_data = '{}\n'.format(child_pid).encode('ascii')
        data_queue_obj.put_nowait((IDENTITY_TAG, identity_data))
        budget_used += len(identity_data)
    except Exception:
        identity_recorded = False

    # §7.5 Supervision loop
    def _stream_tag(fd):
        return STDOUT_TAG if fd == out_r else STDERR_TAG

    try:
        poller = select.poll()
        poller.register(out_r, select.POLLIN)
        poller.register(err_r, select.POLLIN)
    except Exception:
        _bounded_terminate(proc, child_state, T_invoke_mono,
                           sigterm_sent, sigterm_mono,
                           sigkill_sent, sigkill_mono)
        sys.exit(2)

    eof = {out_r: False, err_r: False}
    child_exit = None
    reap_mono = 0.0
    storage_failed = False
    read_error = False
    T_post_cmd_utc = None

    try:
        while True:
            # 1. Drain writer acks (bounded: at most 64 per iteration)
            for _ in range(64):
                try:
                    n = ack_queue_obj.get_nowait()
                    if n < 0:
                        storage_failed = True
                    else:
                        budget_used -= n
                except queue.Empty:
                    break

            # 2. Check writer failure (non-blocking)
            if not storage_failed and writer_event.is_set():
                if result_slot[0] is not ACK_OK:
                    storage_failed = True

            # 3. Poll pipes with capacity reservation
            avail = MEM_CAP - budget_used
            readable_fds = [fd for fd in (out_r, err_r)
                            if not eof[fd] and avail > 0]
            timeout_ms = 200
            if child_state == REAPED:
                remaining = DRAIN_GRACE - (time.monotonic() - reap_mono)
                if remaining <= 0:
                    break
                timeout_ms = min(timeout_ms, max(1, int(remaining * 1000)))

            if readable_fds:
                ready = poller.poll(timeout_ms)
                for fd, event in ready:
                    if eof[fd]:
                        continue
                    avail_now = MEM_CAP - budget_used
                    if avail_now <= 0:
                        break
                    try:
                        data = os.read(fd, min(65536, avail_now))
                    except BlockingIOError:
                        continue
                    except OSError:
                        read_error = True
                        eof[fd] = True
                        try:
                            poller.unregister(fd)
                        except Exception:
                            pass
                        continue
                    if not data:
                        eof[fd] = True
                        try:
                            poller.unregister(fd)
                        except Exception:
                            pass
                    else:
                        data_queue_obj.put_nowait((_stream_tag(fd), data))
                        budget_used += len(data)
            else:
                time.sleep(min(0.2, timeout_ms / 1000.0))

            # 4. Child status check
            if child_state == LAUNCHED:
                try:
                    pid_result, raw_status = os.waitpid(proc.pid, os.WNOHANG)
                except ChildProcessError:
                    child_state = IDENTITY_LOST
                    break
                except Exception:
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
                    T_post_cmd_utc = datetime.datetime.utcnow().strftime(
                        '%Y-%m-%dT%H:%M:%SZ')

            # 5. Deadline enforcement
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
                break
            if child_state == KILL_FAILED_STATE:
                break

    except BaseException:
        _bounded_terminate(proc, child_state, T_invoke_mono,
                           sigterm_sent, sigterm_mono,
                           sigkill_sent, sigkill_mono)
        sys.exit(2)

    # Close pipe read ends
    for fd in (out_r, err_r):
        try:
            os.close(fd)
        except OSError:
            pass

    # Determine anomaly flags from supervision
    anomaly_flags = []
    if sigterm_sent:
        anomaly_flags.append('TIMEOUT')
    if child_exit is not None and child_exit != 0:
        anomaly_flags.append('NON_ZERO_EXIT')

    return (child_state, child_exit, child_pid, eof, storage_failed,
            identity_recorded, T_invoke_utc, T_invoke_mono,
            T_post_cmd_utc, data_queue_obj, writer_event, result_slot,
            anomaly_flags, read_error)


# ---------------------------------------------------------------------------
# Phase 5: Post-invocation observations — ACQ-3 (§8)
# ---------------------------------------------------------------------------

def post_invocation_observations(args, daemon_pid, anomaly_flags,
                                  socket_path):
    """Collect ACQ-3a–3d observations (§8.1–8.2)."""
    T_obs_end = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')

    post_daemon_pid = None
    post_daemon_available = True

    # ACQ-3b — Post daemon PID
    result = _run_tool([
        'pgrep', '-af', 'God Daemon', '-u', args.account
    ])
    if result.returncode < 0 or result.returncode >= 2:
        post_daemon_available = False
    elif result.returncode == 0:
        lines = result.stdout.decode('utf-8', errors='replace').strip().split('\n')
        valid_lines = [l.strip() for l in lines if l.strip()]
        if len(valid_lines) == 1:
            parts = valid_lines[0].split(None, 1)
            if parts:
                try:
                    post_daemon_pid = int(parts[0])
                except ValueError:
                    post_daemon_available = False
            else:
                post_daemon_available = False
        elif len(valid_lines) > 1:
            anomaly_flags.append('IDENTITY_CHANGE')
            post_daemon_available = False
        else:
            post_daemon_available = False
    elif result.returncode == 1:
        anomaly_flags.extend(['DAEMON_DISAPPEARED', 'AUTO_LAUNCH_SUSPECTED'])
        post_daemon_available = False

    # Check for daemon identity change
    if post_daemon_pid is not None and daemon_pid is not None:
        if post_daemon_pid != daemon_pid:
            anomaly_flags.extend(['IDENTITY_CHANGE', 'AUTO_LAUNCH_SUSPECTED'])

    # ACQ-3c — Post-invocation socket-holder observation
    socket_obs_status = 'PASS'
    post_socket_result = _run_tool(['lsof', '-t', '--', socket_path])
    if post_socket_result.returncode < 0 or post_socket_result.returncode >= 2:
        # Tool failure or signaled: uncertain socket state, not identity evidence
        socket_obs_status = 'TOOL_FAILURE'
    elif post_socket_result.returncode == 0:
        post_holders = set()
        for line in post_socket_result.stdout.decode(
                'utf-8', errors='replace').strip().split('\n'):
            line = line.strip()
            if line:
                try:
                    post_holders.add(int(line))
                except ValueError:
                    pass
        if post_daemon_pid is not None and post_daemon_pid not in post_holders:
            anomaly_flags.append('IDENTITY_CHANGE')

    # ACQ-3d — P5 post check (PID-based exclusions)
    p5_post_status = 'PASS'
    p5_proc = subprocess.Popen(
        ['pgrep', '-af', 'pm2', '-u', args.account],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    p5_pid = p5_proc.pid
    p5_stdout, p5_stderr = p5_proc.communicate()
    p5_returncode = p5_proc.returncode
    if p5_returncode < 0 or p5_returncode >= 2:
        p5_post_status = 'TOOL_FAILURE'
    elif p5_returncode == 0:
        p5_lines = p5_stdout.decode('utf-8', errors='replace').strip().split('\n')
        own_pid = os.getpid()
        known_pids = {own_pid, p5_pid}
        if daemon_pid is not None:
            known_pids.add(daemon_pid)
        if post_daemon_pid is not None:
            known_pids.add(post_daemon_pid)
        for line in p5_lines:
            line = line.strip()
            if not line:
                continue
            line_parts = line.split(None, 1)
            if len(line_parts) < 1:
                continue
            try:
                pid = int(line_parts[0])
            except ValueError:
                continue
            if pid in known_pids:
                continue
            anomaly_flags.append('LINGERING_CLIENT')
            p5_post_status = 'LINGERING_CLIENT'
            break

    return T_obs_end, post_daemon_pid, post_daemon_available, \
        p5_post_status, socket_obs_status


# ---------------------------------------------------------------------------
# Writer shutdown protocol (§9.2)
# ---------------------------------------------------------------------------

def shutdown_writer(child_state, eof, storage_failed, identity_recorded,
                    data_queue_obj, writer_event, result_slot):
    """Execute writer shutdown per §9.2."""
    eof_both = eof.get(True, False)  # placeholder
    # Determine path
    is_stream_complete = (child_state == REAPED
                          and all(eof.values()))

    if child_state in (KILL_FAILED_STATE, STATE_UNKNOWN, IDENTITY_LOST):
        # Terminal states: best-effort STOP, no wait
        try:
            data_queue_obj.put_nowait(SENTINEL)
        except Exception:
            pass
        os._exit(2)

    if storage_failed:
        # Already reported failure
        return ACK_FAIL

    if is_stream_complete and not identity_recorded:
        # Send STOP and wait to preserve partial artifacts
        try:
            data_queue_obj.put_nowait(SENTINEL)
        except Exception:
            pass
        writer_event.wait(timeout=PERSIST_TIMEOUT)
        if not writer_event.is_set():
            # ABANDONED — writer did not acknowledge within timeout
            os._exit(2)
        return 'IDENTITY_NOT_RECORDED'

    # Normal or drain-timeout path
    if not all(eof.values()):
        # Drain timeout: close pipe read ends (already closed by caller)
        pass

    try:
        data_queue_obj.put_nowait(SENTINEL)
    except Exception:
        pass

    writer_event.wait(timeout=PERSIST_TIMEOUT)

    if not writer_event.is_set():
        # ABANDONED
        os._exit(2)

    return result_slot[0]


# ---------------------------------------------------------------------------
# Phase 6: Hash binding and observation-meta — ACQ-4 (§10)
# ---------------------------------------------------------------------------

def build_observation_meta(args, attempt_dir, stdout_path, daemon_pid,
                           post_daemon_pid, post_daemon_available,
                           anomaly_flags, t_obs_start):
    """Build and write observation-meta.json, then hash (§10.1–10.2).

    Emits only the locked verifier-accepted schema fields:
    schema, observation_id, host, pm2_home, daemon_pid,
    captured_at, captured_by, acquisition_record, jlist_sha256.
    Private evidence belongs in the E2 record only.

    captured_at = T_obs_start per acquisition §2.4, not T_invoke.
    """
    jlist_sha256 = _hash_file(stdout_path)

    meta = {
        'schema': SCHEMA_OBSERVATION_META,
        'observation_id': args.observation_id,
        'host': args.host,
        'pm2_home': os.path.realpath(args.pm2_home),
        'captured_at': t_obs_start,
        'captured_by': args.captured_by,
        'acquisition_record': args.acq_record,
        'jlist_sha256': jlist_sha256,
    }

    # Omit daemon_pid on IDENTITY_CHANGE or DAEMON_DISAPPEARED (frozen)
    identity_anomalies = {'IDENTITY_CHANGE', 'DAEMON_DISAPPEARED'}
    if not (identity_anomalies & set(anomaly_flags)):
        if post_daemon_available and post_daemon_pid is not None:
            meta['daemon_pid'] = post_daemon_pid
        elif daemon_pid is not None and post_daemon_available:
            meta['daemon_pid'] = daemon_pid

    # Write, close, then hash actual file bytes
    meta_path = os.path.join(attempt_dir, 'observation-meta.json')
    meta_bytes = json.dumps(meta, indent=2, sort_keys=True).encode('utf-8')

    try:
        meta_fd = create_private_file(meta_path)
        _write_all(meta_fd, meta_bytes)
        os.fsync(meta_fd)
        os.close(meta_fd)
    except Exception:
        _log.error('META: META_INVALID')
        return None, None, jlist_sha256

    # JSON validation of written file
    try:
        with open(meta_path, 'rb') as f:
            written_bytes = f.read()
        json.loads(written_bytes)
    except Exception:
        _log.error('META: META_INVALID')
        return None, None, jlist_sha256

    meta_sha256 = _hash_file(meta_path)
    return meta_path, meta_sha256, jlist_sha256


# ---------------------------------------------------------------------------
# Phase 7: Status and E2 records — ACQ-5/ACQ-6 (§11)
# ---------------------------------------------------------------------------

def write_e2_record(attempt_dir, args, T_invoke_utc, T_post_cmd_utc,
                    t_obs_start, T_obs_end, child_exit, anomaly_flags,
                    p5_post_status, socket_obs_status='SKIPPED'):
    """Write private E2 record (§11.3)."""
    e2 = {
        'command': 'pm2 jlist',
        'observation_id': args.observation_id,
        'acq_record': args.acq_record,
        'fate': 'UNCERTAIN',
        'T_invoke': T_invoke_utc,
        'T_obs_start': t_obs_start,
        'anomaly_flags': [f for f in anomaly_flags if f in ALLOWED_ANOMALY_FLAGS],
        'p5_post_status': p5_post_status,
        'socket_obs_status': socket_obs_status,
    }
    if T_post_cmd_utc:
        e2['T_post_cmd'] = T_post_cmd_utc
    if T_obs_end:
        e2['T_obs_end'] = T_obs_end
    if child_exit is not None:
        e2['child_exit_code'] = child_exit

    e2_path = os.path.join(attempt_dir, 'e2-record.json')
    e2_bytes = json.dumps(e2, indent=2, sort_keys=True).encode('utf-8')

    try:
        e2_fd = create_private_file(e2_path)
        _write_all(e2_fd, e2_bytes)
        os.fsync(e2_fd)
        os.close(e2_fd)
    except Exception:
        return False
    return True


def write_status_record(attempt_dir, args, outcome, child_exit,
                        anomaly_flags, jlist_sha256, meta_sha256):
    """Write public status record (§11.2)."""
    status = {
        'observation_id': args.observation_id,
        'attempt_outcome': outcome,
        'anomaly_flags': [f for f in anomaly_flags if f in ALLOWED_ANOMALY_FLAGS],
    }
    if child_exit is not None:
        status['child_exit_code'] = child_exit
    if outcome == 'COMPLETED' and jlist_sha256:
        status['stdout_sha256'] = jlist_sha256
    if outcome == 'COMPLETED' and meta_sha256:
        status['meta_sha256'] = meta_sha256

    status_path = os.path.join(attempt_dir, 'status.json')
    status_bytes = json.dumps(status, indent=2, sort_keys=True).encode('utf-8')

    try:
        status_fd = create_private_file(status_path)
        _write_all(status_fd, status_bytes)
        os.fsync(status_fd)
        os.close(status_fd)
    except Exception:
        return False
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    """Capture entry point — phases 0 through 7 (§3.2)."""
    # Phase 0: Argument validation
    args = parse_and_validate_args()

    # Phase 1: Target enforcement
    resolved_binary, resolved_home, socket_path, socket_holders = \
        enforce_target(args)

    effective_uid = os.geteuid()

    # Phase 2: Fresh private storage
    (attempt_dir, stdout_path, stderr_path, identity_path,
     stdout_fd, stderr_fd, identity_fd, old_umask) = \
        create_private_storage(args, effective_uid)

    # Phase 3: Pre-invocation observations
    t_obs_start, daemon_pid = pre_invocation_observations(
        args, socket_holders, resolved_home)

    # Phase 4: Bounded jlist invocation
    (child_state, child_exit, child_pid, eof, storage_failed,
     identity_recorded, T_invoke_utc, T_invoke_mono,
     T_post_cmd_utc, data_queue_obj, writer_event, result_slot,
     anomaly_flags, read_error) = run_capture(
        args, resolved_binary, resolved_home, attempt_dir,
        stdout_fd, stderr_fd, identity_fd, daemon_pid)

    # Writer shutdown (§9.2)
    writer_result = shutdown_writer(
        child_state, eof, storage_failed, identity_recorded,
        data_queue_obj, writer_event, result_slot)

    # Post-loop evaluation (§7.7)
    if child_state in (IDENTITY_LOST, STATE_UNKNOWN, KILL_FAILED_STATE):
        _log.error('CAPTURE: %s', child_state)
        sys.exit(2)

    if storage_failed or writer_result is ACK_FAIL:
        _log.error('CAPTURE: STORAGE_FAILURE')
        sys.exit(2)

    if writer_result == 'IDENTITY_NOT_RECORDED':
        _log.error('CAPTURE: IDENTITY_NOT_RECORDED')
        sys.exit(2)

    if writer_result is not ACK_OK:
        _log.error('CAPTURE: WRITER_ABANDONED')
        sys.exit(2)

    # Determine outcome path
    eof_both = all(eof.values())
    is_deferred = (not eof_both) and child_state == REAPED

    # Read error prevents COMPLETED
    if read_error and not is_deferred:
        _log.error('CAPTURE: READ_ERROR')
        sys.exit(2)

    # Phase 5: Post-invocation observations (only if child reaped with exit)
    T_obs_end = None
    post_daemon_pid = None
    post_daemon_available = False
    p5_post_status = 'SKIPPED'
    socket_obs_status = 'SKIPPED'

    if child_state == REAPED and child_exit is not None:
        T_obs_end, post_daemon_pid, post_daemon_available, \
            p5_post_status, socket_obs_status = \
            post_invocation_observations(args, daemon_pid, anomaly_flags,
                                         socket_path)

    if is_deferred:
        # DEFERRED: partial stream persisted, not finalized
        # Write E2 first, then status; both must succeed
        e2_ok = write_e2_record(attempt_dir, args, T_invoke_utc, T_post_cmd_utc,
                        t_obs_start, T_obs_end, child_exit, anomaly_flags,
                        p5_post_status, socket_obs_status)
        if not e2_ok:
            _log.error('CAPTURE: E2 write failure')
            sys.exit(2)
        status_ok = write_status_record(
            attempt_dir, args, 'DEFERRED', child_exit,
            anomaly_flags, None, None)
        if not status_ok:
            _log.error('CAPTURE: status write failure')
            sys.exit(2)
        _log.info('DEFERRED')
        sys.exit(3)

    # Phase 6: Hash binding and observation-meta (only if boundary established)
    if not eof_both or child_state != REAPED:
        _log.error('CAPTURE: boundary not established')
        sys.exit(2)

    meta_path, meta_sha256, jlist_sha256 = build_observation_meta(
        args, attempt_dir, stdout_path, daemon_pid,
        post_daemon_pid, post_daemon_available,
        anomaly_flags, t_obs_start)

    if meta_path is None:
        _log.error('CAPTURE: META_INVALID')
        sys.exit(2)

    # Phase 7: E2 and status records
    if not write_e2_record(attempt_dir, args, T_invoke_utc, T_post_cmd_utc,
                           t_obs_start, T_obs_end, child_exit, anomaly_flags,
                           p5_post_status, socket_obs_status):
        _log.error('CAPTURE: E2 write failure')
        sys.exit(2)

    if not write_status_record(attempt_dir, args, 'COMPLETED', child_exit,
                               anomaly_flags, jlist_sha256, meta_sha256):
        _log.error('CAPTURE: status write failure')
        sys.exit(2)

    _log.info('COMPLETED')
    sys.exit(0)


if __name__ == '__main__':
    main()
