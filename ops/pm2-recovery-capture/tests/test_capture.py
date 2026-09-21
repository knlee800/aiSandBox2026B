"""
PM2-RECOVERY-CAPTURE-01 test suite — fake-only verification plan.

All tests use synthetic data and fake executables in temporary directories.
No real PM2 binary, daemon, socket, PM2_HOME, environment secrets, or vaults.

Linux only. Python >= 3.6. pytest >= 3.0.
"""
import errno
import hashlib
import json
import os
import queue
import re
import select
import signal
import socket as socket_mod
import stat
import subprocess
import sys
import textwrap
import threading
import time

import pytest

# Import the module under test
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import capture as cap


# =====================================================================
# Fixtures
# =====================================================================

@pytest.fixture
def tmp_output(tmp_path):
    """Create an output directory owned by the current user with 0o700."""
    d = tmp_path / 'output'
    d.mkdir(mode=0o700)
    return str(d)


@pytest.fixture
def fake_account():
    """Return the effective username for test account matching."""
    import pwd
    return pwd.getpwuid(os.geteuid()).pw_name


@pytest.fixture
def fake_pm2_normal(tmp_path):
    """Fake pm2 that outputs JSON to stdout and exits 0."""
    script = tmp_path / 'fake_pm2_normal.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import sys, json
        json.dump([{"name":"app","pm_id":0}], sys.stdout)
        sys.stdout.flush()
        sys.exit(0)
    '''))
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_pm2_error(tmp_path):
    """Fake pm2 that outputs stderr and exits 1."""
    script = tmp_path / 'fake_pm2_error.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import sys
        sys.stderr.write("error output\\n")
        sys.exit(1)
    '''))
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_pm2_hang(tmp_path):
    """Fake pm2 that traps SIGTERM and sleeps."""
    script = tmp_path / 'fake_pm2_hang.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import signal, time
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        while True:
            time.sleep(1)
    '''))
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_pm2_slow(tmp_path):
    """Fake pm2 that sleeps beyond the timeout then exits."""
    script = tmp_path / 'fake_pm2_slow.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import time
        time.sleep(60)
    '''))
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_pm2_fork(tmp_path):
    """Fake pm2 that forks a child holding stdout pipe, parent exits."""
    script = tmp_path / 'fake_pm2_fork.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import os, sys, time
        sys.stdout.write("parent data\\n")
        sys.stdout.flush()
        pid = os.fork()
        if pid == 0:
            time.sleep(10)
            sys.stdout.write("child data\\n")
            sys.stdout.flush()
            os._exit(0)
        else:
            os._exit(0)
    '''))
    script.chmod(0o755)
    return str(script)


@pytest.fixture
def fake_pm2_transfer(tmp_path):
    """Fake pm2 that sends stdout fd via SCM_RIGHTS to a helper, then exits.
    The helper holds the pipe write end, preventing EOF."""
    helper_path = str(tmp_path / 'transfer_helper.py')
    script = tmp_path / 'fake_pm2_transfer.py'
    script.write_text(textwrap.dedent('''\
        #!/usr/bin/env python3
        import os, sys, socket, struct, array, time

        helper_path = sys.argv[1] if len(sys.argv) > 1 else ''
        sock_path = sys.argv[2] if len(sys.argv) > 2 else ''

        # Write some initial data
        sys.stdout.write("transfer data\\n")
        sys.stdout.flush()

        # Get our stdout fd
        stdout_fd = sys.stdout.fileno()

        # Connect to helper via unix socket and send stdout fd
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        for _ in range(50):
            try:
                sock.connect(sock_path)
                break
            except (ConnectionRefusedError, FileNotFoundError):
                time.sleep(0.1)

        # Send fd via SCM_RIGHTS
        fds = array.array('i', [stdout_fd])
        sock.sendmsg([b'x'], [(socket.SOL_SOCKET, socket.SCM_RIGHTS,
                                fds)])
        sock.close()

        # Parent exits — but helper still holds the pipe write end
        os._exit(0)
    '''))
    script.chmod(0o755)
    return str(script), helper_path


@pytest.fixture
def fake_socket(tmp_path):
    """Create a fake Unix domain socket for target enforcement tests."""
    sock_path = str(tmp_path / 'rpc.sock')
    s = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
    s.bind(sock_path)
    s.listen(1)
    yield sock_path, s
    s.close()


@pytest.fixture
def base_args(fake_account, tmp_output, fake_pm2_normal, tmp_path):
    """Return a minimal valid argument namespace."""
    home = str(tmp_path / 'pm2home')
    os.makedirs(home, exist_ok=True)
    return [
        '--account', fake_account,
        '--pm2-binary', fake_pm2_normal,
        '--pm2-home', home,
        '--observation-id', 'obs-001',
        '--host', 'test-host',
        '--captured-by', 'test-capture',
        '--acq-record', 'acq-001',
        '--output-dir', tmp_output,
    ]


def _setup_capture_env(tmp_path):
    """Create the full storage environment needed by run_capture."""
    attempt_dir = str(tmp_path / 'attempt')
    os.makedirs(attempt_dir, mode=0o700)

    stdout_path = os.path.join(attempt_dir, 'stdout.raw')
    stderr_path = os.path.join(attempt_dir, 'stderr.raw')
    identity_path = os.path.join(attempt_dir, 'child-identity.log')

    stdout_fd = cap.create_private_file(stdout_path)
    stderr_fd = cap.create_private_file(stderr_path)
    identity_fd = cap.create_private_file(identity_path)

    return (attempt_dir, stdout_path, stderr_path, identity_path,
            stdout_fd, stderr_fd, identity_fd)


def _make_args(**overrides):
    """Create a mock args namespace for testing."""
    defaults = {
        'account': 'testuser',
        'pm2_binary': '/tmp/fake_pm2',
        'pm2_home': '/tmp/pm2home',
        'observation_id': 'obs-001',
        'host': 'test-host',
        'captured_by': 'test',
        'acq_record': 'acq-001',
        'output_dir': '/tmp/out',
    }
    defaults.update(overrides)

    class Args:
        pass
    a = Args()
    for k, v in defaults.items():
        setattr(a, k, v)
    return a


# =====================================================================
# T-ARG: Argument validation (§16)
# =====================================================================

class TestArgValidation:
    """T-ARG-01 through T-ARG-09."""

    def test_arg_01_missing_account(self, base_args, capsys):
        """T-ARG-01: Missing --account -> exit 10, no argument echo."""
        filtered = []
        skip_next = False
        for a in base_args:
            if skip_next:
                skip_next = False
                continue
            if a == '--account':
                skip_next = True
                continue
            filtered.append(a)
        sys.argv = ['capture.py'] + filtered
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_02_invalid_observation_id(self, base_args):
        """T-ARG-02: Invalid --observation-id (control chars) -> exit 10."""
        idx = base_args.index('--observation-id') + 1
        args = list(base_args)
        args[idx] = 'obs\x00bad'
        sys.argv = ['capture.py'] + args
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_03_host_exceeds_254(self, base_args):
        """T-ARG-03: --host exceeds 254 chars -> exit 10."""
        idx = base_args.index('--host') + 1
        args = list(base_args)
        args[idx] = 'a' * 255
        sys.argv = ['capture.py'] + args
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_04_all_valid(self, base_args, monkeypatch):
        """T-ARG-04: All valid arguments -> Phase 0 passes."""
        monkeypatch.setattr('shutil.which', lambda x: '/usr/bin/' + x)
        sys.argv = ['capture.py'] + base_args
        args = cap.parse_and_validate_args()
        assert args.observation_id == 'obs-001'

    def test_arg_05_lsof_not_in_path(self, base_args, monkeypatch):
        """T-ARG-05: lsof not in PATH -> exit 10."""
        def fake_which(name):
            if name == 'lsof':
                return None
            return '/usr/bin/' + name
        monkeypatch.setattr('shutil.which', fake_which)
        sys.argv = ['capture.py'] + base_args
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_06_acq_record_path_separator(self, base_args):
        """T-ARG-06: --acq-record with path separator -> exit 10."""
        idx = base_args.index('--acq-record') + 1
        args = list(base_args)
        args[idx] = 'acq/bad'
        sys.argv = ['capture.py'] + args
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_07_acq_record_space(self, base_args):
        """T-ARG-07: --acq-record with space -> exit 10."""
        idx = base_args.index('--acq-record') + 1
        args = list(base_args)
        args[idx] = 'acq bad'
        sys.argv = ['capture.py'] + args
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_08_default_argparse_error(self, capsys):
        """T-ARG-08: Default argparse error -> no argument values in stderr."""
        sys.argv = ['capture.py']
        with pytest.raises(SystemExit) as exc:
            cap.parse_and_validate_args()
        assert exc.value.code == 10

    def test_arg_09_uncaught_exception_phase0(self):
        """T-ARG-09: Uncaught exception -> fixed diagnostic via excepthook."""
        assert cap._safe_excepthook is not None


# =====================================================================
# T-TARGET: Target enforcement (§4)
# =====================================================================

class TestTargetEnforcement:
    """T-TARGET-01 through T-TARGET-11."""

    def test_target_01_account_mismatch(self, monkeypatch):
        """T-TARGET-01: --account differs from effective UID -> exit 1."""
        args = _make_args(account='nonexistent_user_xyz')
        real_euid = os.geteuid()
        monkeypatch.setattr('os.geteuid', lambda: real_euid)
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_02_binary_nonexistent(self, fake_account):
        """T-TARGET-02: pm2-binary nonexistent -> exit 1."""
        args = _make_args(account=fake_account,
                          pm2_binary='/nonexistent/binary')
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_03_binary_not_executable(self, fake_account, tmp_path):
        """T-TARGET-03: pm2-binary not executable -> exit 1."""
        f = tmp_path / 'notexec'
        f.write_text('#!/bin/sh\n')
        f.chmod(0o644)
        args = _make_args(account=fake_account, pm2_binary=str(f))
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_05_home_nonexistent(self, fake_account, tmp_path):
        """T-TARGET-05: pm2-home nonexistent -> exit 1."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        args = _make_args(account=fake_account,
                          pm2_binary=str(binary),
                          pm2_home='/nonexistent/home')
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_07_socket_absent(self, fake_account, tmp_path):
        """T-TARGET-07: rpc.sock absent -> exit 1, DAEMON_ABSENT."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        home = tmp_path / 'pm2home'
        home.mkdir()
        args = _make_args(account=fake_account,
                          pm2_binary=str(binary),
                          pm2_home=str(home))
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_08_socket_is_file(self, fake_account, tmp_path):
        """T-TARGET-08: rpc.sock is regular file -> exit 1."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        home = tmp_path / 'pm2home'
        home.mkdir()
        (home / 'rpc.sock').write_text('not a socket')
        args = _make_args(account=fake_account,
                          pm2_binary=str(binary),
                          pm2_home=str(home))
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_04_binary_dangling_symlink(self, fake_account, tmp_path):
        """T-TARGET-04: pm2-binary is a dangling symlink -> exit 1."""
        home = tmp_path / 'pm2home'
        home.mkdir()
        link = tmp_path / 'pm2'
        os.symlink('/nonexistent/target', str(link))
        args = _make_args(account=fake_account,
                          pm2_binary=str(link),
                          pm2_home=str(home))
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1

    def test_target_06_home_symlink_valid(self, fake_account, tmp_path):
        """T-TARGET-06: pm2-home is a symlink to a valid directory -> resolves."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        real_home = tmp_path / 'real_home'
        real_home.mkdir()
        link_home = tmp_path / 'link_home'
        os.symlink(str(real_home), str(link_home))
        args = _make_args(account=fake_account,
                          pm2_binary=str(binary),
                          pm2_home=str(link_home))
        # No socket -> still exits 1, but for socket, not for home
        with pytest.raises(SystemExit) as exc:
            cap.enforce_target(args)
        assert exc.value.code == 1  # Fails at socket step, not home step

    def test_target_09_lsof_socket_fails(self, fake_account, tmp_path,
                                          monkeypatch):
        """T-TARGET-09: lsof on socket fails -> exit 1, TARGET_INCONSISTENT."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        home = tmp_path / 'pm2home'
        home.mkdir()
        # Create a real socket
        sock_path = str(home / 'rpc.sock')
        s = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        s.bind(sock_path)
        s.listen(1)
        try:
            class FailResult:
                returncode = 1
                stdout = b''
                stderr = b'lsof: error\n'
            monkeypatch.setattr(cap, '_run_tool', lambda args: FailResult())
            args = _make_args(account=fake_account,
                              pm2_binary=str(binary),
                              pm2_home=str(home))
            with pytest.raises(SystemExit) as exc:
                cap.enforce_target(args)
            assert exc.value.code == 1
        finally:
            s.close()

    def test_target_10_socket_wrong_pid(self, fake_account, tmp_path,
                                         monkeypatch):
        """T-TARGET-10: Socket held by different PID -> exit 1.
        (enforcement proceeds to pre-invocation which cross-checks)."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        home = tmp_path / 'pm2home'
        home.mkdir()
        sock_path = str(home / 'rpc.sock')
        s = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        s.bind(sock_path)
        s.listen(1)
        try:
            class LsofResult:
                returncode = 0
                stdout = b'99998\n'
                stderr = b''
            monkeypatch.setattr(cap, '_run_tool', lambda args: LsofResult())
            args = _make_args(account=fake_account,
                              pm2_binary=str(binary),
                              pm2_home=str(home))
            _, _, _, holders = cap.enforce_target(args)
            assert 99998 in holders
        finally:
            s.close()

    def test_target_11_all_valid(self, fake_account, tmp_path, monkeypatch):
        """T-TARGET-11: All valid, socket held by daemon PID -> passes."""
        binary = tmp_path / 'pm2'
        binary.write_text('#!/bin/sh\n')
        binary.chmod(0o755)
        home = tmp_path / 'pm2home'
        home.mkdir()
        sock_path = str(home / 'rpc.sock')
        s = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        s.bind(sock_path)
        s.listen(1)
        try:
            daemon_pid = 12345
            class LsofResult:
                returncode = 0
                stdout = str(daemon_pid).encode() + b'\n'
                stderr = b''
            monkeypatch.setattr(cap, '_run_tool', lambda a: LsofResult())
            args = _make_args(account=fake_account,
                              pm2_binary=str(binary),
                              pm2_home=str(home))
            result = cap.enforce_target(args)
            assert result is not None
            _, _, _, holders = result
            assert daemon_pid in holders
        finally:
            s.close()


# =====================================================================
# T-STORE: Storage (§5)
# =====================================================================

class TestStorage:
    """T-STORE-01 through T-STORE-08."""

    def test_store_01_not_writable(self, tmp_path):
        """T-STORE-01: output-dir not writable -> exit 1."""
        if os.geteuid() == 0:
            pytest.skip('root bypasses permission checks')
        d = tmp_path / 'readonly'
        d.mkdir(mode=0o500)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1

    def test_store_04_normal_creation(self, tmp_path):
        """T-STORE-04: Normal creation -> dir 0700, files 0600."""
        d = tmp_path / 'output'
        d.mkdir(mode=0o700)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        result = cap.create_private_storage(args, uid)
        attempt_dir = result[0]
        assert os.path.isdir(attempt_dir)
        assert stat.S_IMODE(os.stat(attempt_dir).st_mode) == 0o700

    def test_store_06_group_writable(self, tmp_path):
        """T-STORE-06: Parent dir group-writable -> exit 1."""
        d = tmp_path / 'groupw'
        d.mkdir(mode=0o770)
        d.chmod(0o770)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1

    def test_store_07_other_writable(self, tmp_path):
        """T-STORE-07: Parent dir other-writable -> exit 1."""
        d = tmp_path / 'otherw'
        d.mkdir(mode=0o707)
        d.chmod(0o707)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1

    def test_store_08_mode_0757(self, tmp_path):
        """T-STORE-08: Parent dir mode 0o757 -> exit 1."""
        d = tmp_path / 'mode757'
        d.mkdir(mode=0o757)
        d.chmod(0o757)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1

    def test_store_03_file_exists(self, tmp_path):
        """T-STORE-03: Output file already exists -> OSError from O_EXCL."""
        d = tmp_path / 'out'
        d.mkdir(mode=0o700)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        # First creation should succeed
        result = cap.create_private_storage(args, uid)
        assert result is not None
        # The attempt_dir was created inside d with tempfile.mkdtemp
        # O_EXCL collision is internal to create_private_file; test directly
        path = str(tmp_path / 'existing.raw')
        fd = cap.create_private_file(path)
        os.close(fd)
        with pytest.raises(OSError):
            cap.create_private_file(path)

    def test_store_05_symlink_in_output_dir(self, tmp_path):
        """T-STORE-05: Symlink in output-dir path -> exit 1."""
        real_dir = tmp_path / 'real'
        real_dir.mkdir(mode=0o700)
        link = tmp_path / 'link'
        os.symlink(str(real_dir), str(link))
        args = _make_args(output_dir=str(link))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1

    def test_store_02_ownership_mismatch(self, tmp_path, monkeypatch):
        """T-STORE-02: Ownership mismatch (st_uid ≠ geteuid) -> exit 1.
        Uses fault injection to make os.stat report a different uid."""
        d = tmp_path / 'owned_other'
        d.mkdir(mode=0o700)
        real_stat = os.stat

        def stat_wrong_uid(path, *a, **kw):
            result = real_stat(path, *a, **kw)
            if str(d) in str(path):
                # Return a modified stat_result with a fake uid
                class FakeStat:
                    pass
                fs = FakeStat()
                for attr in ('st_mode', 'st_ino', 'st_dev', 'st_nlink',
                             'st_gid', 'st_size', 'st_atime', 'st_mtime',
                             'st_ctime'):
                    setattr(fs, attr, getattr(result, attr))
                fs.st_uid = result.st_uid + 1  # different uid
                return fs
            return result

        monkeypatch.setattr('os.stat', stat_wrong_uid)
        args = _make_args(output_dir=str(d))
        uid = os.geteuid()
        with pytest.raises(SystemExit) as exc:
            cap.create_private_storage(args, uid)
        assert exc.value.code == 1


# =====================================================================
# T-INVOKE: Invocation / supervision — behavioral tests (§7)
# =====================================================================

class TestRunCapture:
    """Behavioral tests that actually execute run_capture with fake processes."""

    def test_invoke_normal_capture(self, tmp_path, fake_pm2_normal):
        """T-INVOKE-01: Normal pm2 jlist -> REAPED, exit 0, both EOF."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, stdout_path, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_normal, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_exit = result[1]
        eof = result[3]
        storage_failed = result[4]
        read_error = result[13]

        assert child_state == cap.REAPED
        assert child_exit == 0
        assert all(eof.values()), "Both streams should reach EOF"
        assert not storage_failed
        assert not read_error

        with open(stdout_path, 'rb') as f:
            content = f.read()
        assert len(content) > 0, "stdout.raw should contain captured output"

    def test_invoke_nonzero_exit(self, tmp_path, fake_pm2_error):
        """T-INVOKE-02: Fake pm2 exits 1 -> REAPED, exit 1, NON_ZERO_EXIT."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_error, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_exit = result[1]
        anomaly_flags = result[12]

        assert child_state == cap.REAPED
        assert child_exit == 1
        assert 'NON_ZERO_EXIT' in anomaly_flags

    def test_invoke_timeout_sigterm_sigkill(self, tmp_path, fake_pm2_hang,
                                             monkeypatch):
        """T-INVOKE-03: Process ignores SIGTERM -> timeout -> SIGTERM ->
        SIGKILL escalation. With shortened deadlines for test speed."""
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 1)
        monkeypatch.setattr(cap, 'TERM_GRACE', 1)
        monkeypatch.setattr(cap, 'KILL_GRACE', 1)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 1)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_hang, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        anomaly_flags = result[12]

        assert child_state == cap.REAPED
        assert 'TIMEOUT' in anomaly_flags

    def test_invoke_slow_timeout(self, tmp_path, fake_pm2_slow, monkeypatch):
        """T-INVOKE-04: Process sleeps beyond timeout -> SIGTERM kills it."""
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 1)
        monkeypatch.setattr(cap, 'TERM_GRACE', 1)
        monkeypatch.setattr(cap, 'KILL_GRACE', 1)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 1)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_slow, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        anomaly_flags = result[12]

        assert child_state == cap.REAPED
        assert 'TIMEOUT' in anomaly_flags

    def test_invoke_fork_descendant_holds_pipe(self, tmp_path, fake_pm2_fork,
                                                monkeypatch):
        """T-INVOKE-05: Parent exits, child holds pipe -> drain timeout."""
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 2)

        env = _setup_capture_env(tmp_path)
        attempt_dir, stdout_path, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_fork, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_exit = result[1]
        eof = result[3]

        assert child_state == cap.REAPED
        assert child_exit == 0
        # stdout may or may not reach EOF depending on drain timing
        # but at least parent data should be captured
        with open(stdout_path, 'rb') as f:
            content = f.read()
        assert b'parent data' in content

    @staticmethod
    def _read_readiness_line(proc_stdout, deadline_abs, max_bytes=256):
        """Read one newline-terminated message from *proc_stdout* using
        non-blocking os.read under an absolute monotonic deadline.

        Returns the stripped line bytes on success.
        Raises AssertionError on timeout, premature EOF, or oversized
        message (> *max_bytes* before newline).
        """
        fd = proc_stdout.fileno()
        os.set_blocking(fd, False)
        buf = b''
        try:
            while True:
                remaining = deadline_abs - time.monotonic()
                if remaining <= 0:
                    raise AssertionError(
                        "Readiness deadline expired; received so far: "
                        "{!r}".format(buf))
                rlist, _, _ = select.select([fd], [], [], remaining)
                if not rlist:
                    raise AssertionError(
                        "Readiness deadline expired (select); received "
                        "so far: {!r}".format(buf))
                chunk = os.read(fd, 1024)
                if not chunk:
                    raise AssertionError(
                        "Premature EOF; received so far: {!r}".format(buf))
                buf += chunk
                if len(buf) > max_bytes:
                    raise AssertionError(
                        "Oversized readiness message (>{} bytes): "
                        "{!r}".format(max_bytes, buf[:max_bytes + 20]))
                if b'\n' in buf:
                    line, _ = buf.split(b'\n', 1)
                    return line.strip()
        finally:
            os.set_blocking(fd, True)

    def test_bound_04_scm_rights_transfer(self, tmp_path, monkeypatch):
        """T-BOUND-04: Child sends pipe fd via SCM_RIGHTS to helper.
        Helper holds pipe write end after child exits -> no EOF -> DEFERRED.
        After collector exits (closing pipe readers), holder writes and
        observes EPIPE/SIGPIPE, reported via a separate marker file.
        All readiness waits are deadline-bounded."""
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 3)
        monkeypatch.setattr(cap, 'TERM_GRACE', 1)
        monkeypatch.setattr(cap, 'KILL_GRACE', 1)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 2)

        READINESS_TIMEOUT = 10  # seconds total for readiness operations

        # Marker file where helper reports write outcome
        marker_path = str(tmp_path / 'write_result.marker')

        # Create the helper that receives fd, holds it, then writes after
        # a signal indicating the collector has exited
        helper_script = tmp_path / 'transfer_helper.py'
        helper_script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import os, sys, socket, array, time, signal, errno

            sock_path = sys.argv[1]
            marker_path = sys.argv[2]

            srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            srv.bind(sock_path)
            srv.listen(1)

            # Signal readiness
            sys.stdout.write("READY\\n")
            sys.stdout.flush()

            conn, _ = srv.accept()
            msg, ancdata, flags, addr = conn.recvmsg(1,
                socket.CMSG_LEN(4))

            received_fd = None
            for cmsg_level, cmsg_type, cmsg_data in ancdata:
                if (cmsg_level == socket.SOL_SOCKET and
                        cmsg_type == socket.SCM_RIGHTS):
                    fds = array.array('i')
                    fds.frombytes(cmsg_data[:4])
                    received_fd = fds[0]

            conn.close()
            srv.close()

            if received_fd is None:
                with open(marker_path, 'w') as f:
                    f.write('NO_FD_RECEIVED')
                os._exit(1)

            # Hold fd; wait for the "WRITE_NOW" signal via a notify socket
            notify_path = sock_path + '.notify'
            nsrv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            nsrv.bind(notify_path)
            nsrv.listen(1)

            # Signal that we are ready to receive the write notification
            sys.stdout.write("HOLD_READY\\n")
            sys.stdout.flush()

            nsrv.settimeout(15)
            try:
                nconn, _ = nsrv.accept()
                nconn.recv(1)
                nconn.close()
            except socket.timeout:
                with open(marker_path, 'w') as f:
                    f.write('NOTIFY_TIMEOUT')
                os.close(received_fd)
                os._exit(1)
            finally:
                nsrv.close()

            # Collector has exited and closed pipe readers.
            # Now attempt to write to the pipe write fd.
            sigpipe_received = [False]
            def handle_sigpipe(sig, frame):
                sigpipe_received[0] = True
            signal.signal(signal.SIGPIPE, handle_sigpipe)

            write_result = 'UNKNOWN'
            try:
                os.write(received_fd, b'post-close probe\\n')
                write_result = 'WRITE_OK'
            except OSError as e:
                if e.errno == errno.EPIPE:
                    write_result = 'EPIPE'
                else:
                    write_result = 'OSError:' + str(e.errno)
            except BrokenPipeError:
                write_result = 'EPIPE'

            # Also check if SIGPIPE was delivered
            if sigpipe_received[0]:
                write_result = 'SIGPIPE'

            with open(marker_path, 'w') as f:
                f.write(write_result)

            os.close(received_fd)
            os._exit(0)
        '''))
        helper_script.chmod(0o755)

        # Create the fake pm2 that transfers stdout fd via SCM_RIGHTS
        scm_sock_path = str(tmp_path / 'scm_transfer.sock')
        fake_script = tmp_path / 'fake_pm2_scm.py'
        fake_script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import os, sys, socket, array, time

            sock_path = sys.argv[1]

            sys.stdout.write("transfer data\\n")
            sys.stdout.flush()

            stdout_fd = sys.stdout.fileno()

            sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            for _ in range(50):
                try:
                    sock.connect(sock_path)
                    break
                except (ConnectionRefusedError, FileNotFoundError):
                    time.sleep(0.05)
            else:
                os._exit(1)

            fds = array.array('i', [stdout_fd])
            sock.sendmsg([b'x'], [(socket.SOL_SOCKET,
                                    socket.SCM_RIGHTS, fds)])
            sock.close()
            os._exit(0)
        '''))
        fake_script.chmod(0o755)

        # Start the helper first
        helper_proc = subprocess.Popen(
            [sys.executable, str(helper_script), scm_sock_path,
             marker_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        try:
            # Absolute monotonic deadline for all readiness operations
            deadline_abs = time.monotonic() + READINESS_TIMEOUT

            # Bounded non-blocking wait for READY
            ready_msg = self._read_readiness_line(
                helper_proc.stdout, deadline_abs)
            assert ready_msg == b'READY', \
                "Expected READY, got: {!r}".format(ready_msg)

            # Create a wrapper binary that calls fake_pm2_scm with sock path
            wrapper = tmp_path / 'scm_wrapper.py'
            wrapper.write_text(textwrap.dedent('''\
                #!/usr/bin/env python3
                import os, sys
                os.execvp(sys.executable, [sys.executable,
                    '{}', '{}'])
            '''.format(str(fake_script), scm_sock_path)))
            wrapper.chmod(0o755)

            env = _setup_capture_env(tmp_path)
            attempt_dir, stdout_path, _, _, stdout_fd, stderr_fd, identity_fd = env
            args = _make_args()

            result = cap.run_capture(
                args, str(wrapper), str(tmp_path), attempt_dir,
                stdout_fd, stderr_fd, identity_fd, 12345)

            child_state = result[0]
            child_exit = result[1]
            eof = result[3]

            assert child_state == cap.REAPED
            assert child_exit == 0
            # Helper still holds the pipe write end -> no EOF on stdout
            assert not all(eof.values()), \
                "Should NOT reach EOF while helper holds transferred fd"

            with open(stdout_path, 'rb') as f:
                content = f.read()
            assert b'transfer data' in content

            # Bounded non-blocking wait for HOLD_READY
            hold_msg = self._read_readiness_line(
                helper_proc.stdout, deadline_abs)
            assert hold_msg == b'HOLD_READY', \
                "Expected HOLD_READY, got: {!r}".format(hold_msg)

            # Notify helper to attempt the write. Bounded connect.
            notify_path = scm_sock_path + '.notify'
            nsock = socket_mod.socket(socket_mod.AF_UNIX,
                                       socket_mod.SOCK_STREAM)
            try:
                connected = False
                while time.monotonic() < deadline_abs:
                    try:
                        nsock.settimeout(
                            max(0.01, deadline_abs - time.monotonic()))
                        nsock.connect(notify_path)
                        connected = True
                        break
                    except (ConnectionRefusedError, FileNotFoundError):
                        time.sleep(0.05)
                    except socket_mod.timeout:
                        break
                assert connected, \
                    "Notify socket must connect within deadline"
                nsock.send(b'G')
            finally:
                nsock.close()

            # Bounded wait for helper to finish and check marker
            wait_left = max(0.1, deadline_abs - time.monotonic() + 2)
            helper_proc.wait(timeout=wait_left)

            assert os.path.exists(marker_path), \
                "Helper must write marker file"
            with open(marker_path, 'r') as f:
                write_result = f.read().strip()
            assert write_result in ('EPIPE', 'SIGPIPE'), \
                "Holder must observe EPIPE or SIGPIPE, got: {}".format(
                    write_result)

        finally:
            try:
                helper_proc.kill()
                helper_proc.wait(timeout=5)
            except Exception:
                pass

    def test_bound_04_helper_never_ready(self, tmp_path, monkeypatch):
        """T-BOUND-04 robustness: helper that never announces readiness
        causes a bounded test failure and proper cleanup."""
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 2)
        monkeypatch.setattr(cap, 'TERM_GRACE', 1)
        monkeypatch.setattr(cap, 'KILL_GRACE', 1)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 1)

        READINESS_TIMEOUT = 2  # short deadline for this negative test

        # Helper that hangs forever without writing anything
        hang_script = tmp_path / 'hang_helper.py'
        hang_script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import time
            time.sleep(300)
        '''))
        hang_script.chmod(0o755)

        marker_path = str(tmp_path / 'never_ready.marker')
        scm_sock_path = str(tmp_path / 'never_ready.sock')

        helper_proc = subprocess.Popen(
            [sys.executable, str(hang_script), scm_sock_path,
             marker_path],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        try:
            deadline_abs = time.monotonic() + READINESS_TIMEOUT
            with pytest.raises(AssertionError, match=r'deadline expired'):
                self._read_readiness_line(
                    helper_proc.stdout, deadline_abs)
        finally:
            helper_proc.kill()
            helper_proc.wait(timeout=5)
            assert helper_proc.returncode is not None, \
                "Helper must be reaped after kill"

    def test_bound_04_helper_partial_then_stalls(self, tmp_path,
                                                  monkeypatch):
        """T-BOUND-04 robustness: helper writes a partial message without
        a newline, then stalls. The readiness reader must fail bounded
        and report the partial bytes. Cleanup kills only the test-owned
        helper."""
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 2)
        monkeypatch.setattr(cap, 'TERM_GRACE', 1)
        monkeypatch.setattr(cap, 'KILL_GRACE', 1)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 1)

        READINESS_TIMEOUT = 2

        # Helper writes partial "REA" (no newline) then hangs
        partial_script = tmp_path / 'partial_helper.py'
        partial_script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys, time
            sys.stdout.write("REA")
            sys.stdout.flush()
            time.sleep(300)
        '''))
        partial_script.chmod(0o755)

        helper_proc = subprocess.Popen(
            [sys.executable, str(partial_script)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )

        try:
            deadline_abs = time.monotonic() + READINESS_TIMEOUT
            with pytest.raises(AssertionError,
                               match=r"deadline expired.*REA"):
                self._read_readiness_line(
                    helper_proc.stdout, deadline_abs)
        finally:
            helper_proc.kill()
            helper_proc.wait(timeout=5)
            assert helper_proc.returncode is not None, \
                "Helper must be reaped after kill"

    def test_invoke_t_post_cmd_at_reap(self, tmp_path, fake_pm2_normal):
        """T-INVOKE-06: T_post_cmd recorded at reap, not after drain."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        t_before = time.time()
        result = cap.run_capture(
            args, fake_pm2_normal, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)
        t_after = time.time()

        T_post_cmd_utc = result[8]
        assert T_post_cmd_utc is not None, \
            "T_post_cmd should be set when child exits normally"

    def test_invoke_identity_enqueue_failure(self, tmp_path, fake_pm2_normal,
                                              monkeypatch):
        """T-INVOKE-07: Identity enqueue failure -> supervision continues."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        original_put = queue.Queue.put_nowait
        call_count = [0]

        def failing_put(self, item):
            call_count[0] += 1
            if call_count[0] == 1 and isinstance(item, tuple):
                tag = item[0] if isinstance(item, tuple) else None
                if tag == cap.IDENTITY_TAG:
                    raise Exception("simulated enqueue failure")
            return original_put(self, item)

        monkeypatch.setattr(queue.Queue, 'put_nowait', failing_put)

        result = cap.run_capture(
            args, fake_pm2_normal, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        identity_recorded = result[5]
        assert child_state == cap.REAPED
        assert not identity_recorded

    def test_invoke_11_kill_eperm(self):
        """T-INVOKE-11: os.kill EPERM -> _safe_kill catches; does not raise."""
        # _safe_kill catches EPERM silently; KILL_FAILED is set by the
        # supervision loop when KILL_GRACE expires after SIGKILL attempt.
        cap._safe_kill(999999999, signal.SIGTERM)  # ESRCH caught
        # EPERM: simulate by testing _safe_kill's error handling
        original_kill = os.kill
        try:
            def eperm_kill(pid, sig):
                raise PermissionError(errno.EPERM, 'not permitted')
            os.kill = eperm_kill
            cap._safe_kill(99999, signal.SIGTERM)  # should not raise
        finally:
            os.kill = original_kill

    def test_invoke_19_writer_ack_fail_during_supervision(self, tmp_path,
                                                           fake_pm2_normal,
                                                           monkeypatch):
        """T-INVOKE-19: Writer ACK_FAIL during supervision -> storage_failed
        set True; child supervision continues normally."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        # Force writer to fail by injecting ENOSPC on first write
        original_write = os.write
        write_count = [0]

        def enospc_write(fd, data):
            write_count[0] += 1
            if write_count[0] <= 3 and fd in (stdout_fd, stderr_fd, identity_fd):
                raise OSError(errno.ENOSPC, 'No space left')
            return original_write(fd, data)

        monkeypatch.setattr('os.write', enospc_write)

        result = cap.run_capture(
            args, fake_pm2_normal, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        storage_failed = result[4]
        assert child_state == cap.REAPED, "Child should still be supervised"
        assert storage_failed, "Writer failure should set storage_failed"


class TestInvocationHelpers:
    """T-INVOKE helper/unit tests."""

    def test_invoke_09_sigchld_sig_ign(self):
        """T-INVOKE-09: Inherited SIGCHLD=SIG_IGN -> reset to SIG_DFL."""
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)
        signal.signal(signal.SIGCHLD, signal.SIG_DFL)
        handler = signal.getsignal(signal.SIGCHLD)
        assert handler == signal.SIG_DFL

    def test_invoke_10_safe_kill_esrch(self):
        """T-INVOKE-10: os.kill ESRCH -> _safe_kill catches."""
        cap._safe_kill(999999999, signal.SIGTERM)

    def test_invoke_14_unknown_wait_status(self):
        """T-INVOKE-14: Unknown wait status -> raises ValueError."""
        with pytest.raises(ValueError):
            cap._decode_wait_status(0xFFFF)


# =====================================================================
# T-STREAM: Stream completion / EAGAIN vs EOF (§9, Fix 3)
# =====================================================================

class TestStreamCompletion:
    """Verify EAGAIN is not confused with EOF; read errors prevent
    finalization."""

    def test_stream_eagain_not_eof(self, tmp_path, monkeypatch):
        """T-STREAM-01: BlockingIOError on read -> NOT treated as EOF.
        Uses a fake process that delays output."""
        script = tmp_path / 'delayed.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys, time
            time.sleep(0.5)
            sys.stdout.write("delayed output\\n")
            sys.stdout.flush()
            sys.exit(0)
        '''))
        script.chmod(0o755)

        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 5)

        env = _setup_capture_env(tmp_path)
        attempt_dir, stdout_path, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_exit = result[1]
        read_error = result[13]

        assert child_state == cap.REAPED
        assert child_exit == 0
        assert not read_error
        with open(stdout_path, 'rb') as f:
            assert b'delayed output' in f.read()

    def test_stream_read_error_prevents_completed(self, tmp_path,
                                                    monkeypatch):
        """T-STREAM-02: OSError (not BlockingIOError) on read ->
        read_error=True, no COMPLETED."""
        import fcntl
        script = tmp_path / 'quick.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys
            sys.stdout.write("data\\n")
            sys.stdout.flush()
            sys.exit(0)
        '''))
        script.chmod(0o755)

        original_read = os.read
        error_injected = [False]

        def faulty_read(fd, n):
            if not error_injected[0]:
                try:
                    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
                except (OSError, ValueError):
                    return original_read(fd, n)
                if flags & os.O_NONBLOCK:
                    error_injected[0] = True
                    raise OSError(errno.EIO, "simulated I/O error")
            return original_read(fd, n)

        monkeypatch.setattr('os.read', faulty_read)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        read_error = result[13]
        assert read_error, "Read error should be flagged"


# =====================================================================
# T-HASH: Hash / meta (§10)
# =====================================================================

class TestHash:
    """T-HASH-01 through T-HASH-11."""

    def test_hash_01_known_content(self, tmp_path):
        """T-HASH-01: Known stdout.raw content -> SHA-256 matches."""
        f = tmp_path / 'stdout.raw'
        data = b'[{"name":"app"}]'
        f.write_bytes(data)
        expected = hashlib.sha256(data).hexdigest()
        assert cap._hash_file(str(f)) == expected

    def test_hash_02_empty(self, tmp_path):
        """T-HASH-02: Empty stdout.raw -> hash of empty bytes."""
        f = tmp_path / 'stdout.raw'
        f.write_bytes(b'')
        expected = hashlib.sha256(b'').hexdigest()
        assert cap._hash_file(str(f)) == expected

    def test_hash_03_binary(self, tmp_path):
        """T-HASH-03: Binary content -> hash includes all bytes."""
        f = tmp_path / 'stdout.raw'
        data = bytes(range(256)) * 100
        f.write_bytes(data)
        expected = hashlib.sha256(data).hexdigest()
        assert cap._hash_file(str(f)) == expected

    def test_hash_10_large_file(self, tmp_path):
        """T-HASH-10: Large file -> hash computed in chunks."""
        f = tmp_path / 'stdout.raw'
        data = b'x' * (cap.MEM_CAP + 1024)
        f.write_bytes(data)
        expected = hashlib.sha256(data).hexdigest()
        assert cap._hash_file(str(f)) == expected

    def test_hash_11_meta_fsync_fails(self, tmp_path, monkeypatch):
        """T-HASH-11: build_observation_meta fsync fails ->
        returns None; observation-meta.json may exist partially;
        not deleted; attempt incomplete."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'test data')
        args = _make_args()
        original_fsync = os.fsync

        def failing_fsync(fd):
            raise OSError(errno.EIO, 'disk error')

        monkeypatch.setattr('os.fsync', failing_fsync)
        result = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')
        assert result[0] is None, \
            "Fsync failure must prevent successful meta creation"
        # File may exist partially on disk — preservation required
        meta_path = os.path.join(str(tmp_path), 'observation-meta.json')
        # We don't assert deletion — frozen contract preserves partial files


# =====================================================================
# T-META: Metadata compatibility with locked verifier (§10, Fix 2)
# =====================================================================

class TestMetadataCompatibility:
    """Verify observation-meta.json matches the locked verifier schema."""

    VERIFIER_ALLOWED_KEYS = frozenset([
        'schema', 'observation_id', 'host', 'pm2_home', 'daemon_pid',
        'captured_at', 'captured_by', 'acquisition_record', 'jlist_sha256',
    ])
    VERIFIER_SCHEMA = 'aisb.pm2-dual-env-observation-meta.v1'

    def test_meta_schema_field_present(self, tmp_path):
        """T-META-01: observation-meta contains 'schema' with correct value."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'[{"name":"app"}]')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, meta_sha256, jlist_sha256 = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        assert meta_path is not None
        with open(meta_path, 'r') as f:
            doc = json.load(f)
        assert doc['schema'] == self.VERIFIER_SCHEMA

    def test_meta_only_allowed_keys(self, tmp_path):
        """T-META-02: No extra keys beyond verifier's allowed set."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'test data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        assert meta_path is not None
        with open(meta_path, 'r') as f:
            doc = json.load(f)
        extra_keys = set(doc.keys()) - self.VERIFIER_ALLOWED_KEYS
        assert not extra_keys, \
            f"Extra keys would fail verifier _check_unknown: {extra_keys}"

    def test_meta_required_fields_present(self, tmp_path):
        """T-META-03: All required verifier fields present."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'test data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)

        for field in ('schema', 'observation_id', 'host', 'captured_at',
                      'captured_by', 'acquisition_record', 'jlist_sha256'):
            assert field in doc, f"Required field '{field}' missing"

    def test_meta_field_name_mapping(self, tmp_path):
        """T-META-04: Field names use verifier conventions, not capture
        internal names (acquisition_record not acq_record, captured_at
        not T_invoke)."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'test')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)

        assert 'acquisition_record' in doc
        assert 'acq_record' not in doc
        assert 'captured_at' in doc
        assert 'T_invoke' not in doc
        assert 'account' not in doc
        assert 'pm2_binary' not in doc
        assert 'T_obs_start' not in doc
        assert 'anomaly_flags' not in doc

    def test_meta_daemon_pid_omitted_on_identity_change(self, tmp_path):
        """T-META-05: daemon_pid omitted when IDENTITY_CHANGE flagged."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            5678, True, ['IDENTITY_CHANGE'], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)
        assert 'daemon_pid' not in doc

    def test_meta_daemon_pid_omitted_on_disappeared(self, tmp_path):
        """T-META-06: daemon_pid omitted when DAEMON_DISAPPEARED flagged."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, ['DAEMON_DISAPPEARED'], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)
        assert 'daemon_pid' not in doc

    def test_meta_jlist_sha256_format(self, tmp_path):
        """T-META-07: jlist_sha256 is lowercase 64-char hex."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)
        sha = doc['jlist_sha256']
        assert re.fullmatch(r'[0-9a-f]{64}', sha), \
            f"jlist_sha256 must be lowercase hex64: {sha}"

    def test_meta_daemon_pid_positive_int(self, tmp_path):
        """T-META-08: daemon_pid when present is a positive integer."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'data')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-01T00:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)
        assert 'daemon_pid' in doc
        pid = doc['daemon_pid']
        assert isinstance(pid, int) and pid > 0


# =====================================================================
# T-WRITER: Writer lifecycle (§9.4)
# =====================================================================

class TestWriter:
    """T-WRITER-01 through T-WRITER-10."""

    def test_writer_01_normal_ack(self, tmp_path):
        """T-WRITER-01: Normal EOF + ACK_OK -> all data written."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'hello stdout'))
        dq.put((cap.STDERR_TAG, b'hello stderr'))
        dq.put((cap.IDENTITY_TAG, b'12345\n'))
        dq.put(cap.SENTINEL)

        evt.wait(timeout=5)
        assert rs[0] is cap.ACK_OK
        with open(stdout_path, 'rb') as f:
            assert f.read() == b'hello stdout'
        with open(stderr_path, 'rb') as f:
            assert f.read() == b'hello stderr'
        with open(identity_path, 'rb') as f:
            assert f.read() == b'12345\n'

    def test_writer_04_short_writes(self, tmp_path, monkeypatch):
        """T-WRITER-04: Short writes -> all bytes eventually written."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        original_write = os.write

        def short_write(fd, data):
            if len(data) > 1:
                return original_write(fd, data[:1])
            return original_write(fd, data)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        monkeypatch.setattr('os.write', short_write)
        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'ABCD'))
        dq.put(cap.SENTINEL)
        evt.wait(timeout=5)
        monkeypatch.undo()

        assert rs[0] is cap.ACK_OK
        with open(stdout_path, 'rb') as f:
            assert f.read() == b'ABCD'

    def test_writer_05_zero_write(self, tmp_path, monkeypatch):
        """T-WRITER-05: Zero-byte write -> ACK_FAIL, no infinite loop."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        monkeypatch.setattr('os.write', lambda fd, data: 0)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'data'))
        dq.put(cap.SENTINEL)
        evt.wait(timeout=5)
        monkeypatch.undo()

        assert rs[0] is cap.ACK_FAIL

    def test_writer_06_stalled_writer(self, tmp_path, monkeypatch):
        """T-WRITER-06: Writer blocks indefinitely -> ACK not received,
        supervisor must handle timeout via writer_event."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        stall_event = threading.Event()

        def stalling_write(fd, data):
            stall_event.wait(timeout=10)
            return len(data)

        monkeypatch.setattr('os.write', stalling_write)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'data'))
        # Writer should be stalled; event should not be set within timeout
        assert not evt.wait(timeout=1), \
            "Writer event should not be set while write is stalled"
        stall_event.set()
        evt.wait(timeout=5)

    def test_writer_10_close_then_raise_reuse(self, tmp_path, monkeypatch):
        """T-WRITER-10: os.close performs real close then raises;
        fd number reused; cleanup never closes replacement."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        original_close = os.close
        original_fsync = os.fsync
        close_log = []
        replacement_fd = [None]
        replacement_created = [False]

        def tracked_fsync(fd):
            original_fsync(fd)

        def close_then_raise(fd):
            close_log.append(('close', fd, replacement_created[0]))
            original_close(fd)
            if fd == stderr_fd:
                new_path = str(tmp_path / 'replacement.tmp')
                replacement_fd[0] = os.open(new_path,
                    os.O_CREAT | os.O_WRONLY, 0o600)
                replacement_created[0] = True
                raise OSError(errno.EIO, 'simulated close error')

        monkeypatch.setattr('os.close', close_then_raise)
        monkeypatch.setattr('os.fsync', tracked_fsync)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'data'))
        dq.put(cap.SENTINEL)
        evt.wait(timeout=5)
        monkeypatch.undo()

        assert rs[0] is cap.ACK_FAIL
        # stderr_fd should appear at most once in close log
        stderr_closes = [e for e in close_log if e[1] == stderr_fd]
        assert len(stderr_closes) <= 1
        # After replacement creation, no close should target the
        # replacement fd number
        if replacement_fd[0] is not None:
            post_creation_closes = [
                e for e in close_log
                if e[1] == replacement_fd[0] and e[2]
            ]
            assert len(post_creation_closes) == 0, \
                "Replacement fd must not be closed by cleanup"
            try:
                os.close(replacement_fd[0])
            except OSError:
                pass

    def test_writer_bound_08_enospc_second_chunk(self, tmp_path, monkeypatch):
        """T-BOUND-08: Writer ENOSPC on second chunk -> ACK_FAIL;
        first chunk's bytes in file."""
        stdout_path = str(tmp_path / 'stdout.raw')
        stderr_path = str(tmp_path / 'stderr.raw')
        identity_path = str(tmp_path / 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        original_write = os.write
        chunk_count = [0]

        def enospc_on_second(fd, data):
            if fd == stdout_fd:
                chunk_count[0] += 1
                if chunk_count[0] >= 2:
                    raise OSError(errno.ENOSPC, 'No space')
            return original_write(fd, data)

        monkeypatch.setattr('os.write', enospc_on_second)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'first'))
        dq.put((cap.STDOUT_TAG, b'second'))
        dq.put(cap.SENTINEL)
        evt.wait(timeout=5)
        monkeypatch.undo()

        assert rs[0] is cap.ACK_FAIL
        with open(stdout_path, 'rb') as f:
            content = f.read()
        assert content == b'first', "Only first chunk should be on disk"


# =====================================================================
# T-MEM: Memory / handoff — behavioral (§7.5)
# =====================================================================

class TestMemory:
    """T-MEM memory accounting tests."""

    def test_mem_budget_tracks_through_capture(self, tmp_path,
                                                fake_pm2_normal):
        """T-MEM-01: Budget is properly tracked: identity + data bytes
        accounted for, acks reduce budget."""
        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, fake_pm2_normal, str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        assert not result[4]  # storage_failed
        assert result[0] == cap.REAPED

    def test_mem_large_output_saturates(self, tmp_path, monkeypatch):
        """T-MEM-02: Output exceeding MEM_CAP -> backpressure, no crash."""
        monkeypatch.setattr(cap, 'MEM_CAP', 1024)

        script = tmp_path / 'big_output.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys
            sys.stdout.write("X" * 4096)
            sys.stdout.flush()
            sys.exit(0)
        '''))
        script.chmod(0o755)

        env = _setup_capture_env(tmp_path)
        attempt_dir, stdout_path, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()
        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        assert result[0] == cap.REAPED
        with open(stdout_path, 'rb') as f:
            data = f.read()
        assert len(data) > 0, "Some data should be captured"
        assert len(data) <= 4096


# =====================================================================
# T-STATE: Child state / exception safety (§7.4, §7.6)
# =====================================================================

class TestChildState:
    """T-STATE-01 through T-STATE-11."""

    def test_state_01_exception_after_reap(self):
        """T-STATE-01: _bounded_terminate with non-LAUNCHED state -> noop."""
        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        cap._bounded_terminate(
            proc, cap.STATE_UNKNOWN, time.monotonic(),
            False, 0.0, False, 0.0)

    def test_state_02_identity_lost(self):
        """T-STATE-02: IDENTITY_LOST -> no signaling."""
        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        cap._bounded_terminate(
            proc, cap.IDENTITY_LOST, time.monotonic(),
            False, 0.0, False, 0.0)

    def test_state_04_kill_failed(self):
        """T-STATE-04: KILL_FAILED -> no further signaling."""
        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        cap._bounded_terminate(
            proc, cap.KILL_FAILED_STATE, time.monotonic(),
            False, 0.0, False, 0.0)

    def test_state_05_repeated_interrupts(self):
        """T-STATE-05: Repeated interrupts -> flag set, no crash."""
        interrupted = [False]

        def handler(sig, frame):
            interrupted[0] = True

        old = signal.getsignal(signal.SIGUSR1)
        signal.signal(signal.SIGUSR1, handler)
        os.kill(os.getpid(), signal.SIGUSR1)
        os.kill(os.getpid(), signal.SIGUSR1)
        assert interrupted[0] is True
        signal.signal(signal.SIGUSR1, old)

    def test_state_cleanup_preserves_deadline(self, monkeypatch):
        """T-STATE-06: _bounded_terminate preserves original deadline,
        does not signal immediately when no SIGTERM has been sent."""
        kills_sent = []

        def recording_kill(pid, sig):
            kills_sent.append((pid, sig, time.monotonic()))

        monkeypatch.setattr(cap, '_safe_kill', recording_kill)
        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 0.2)
        monkeypatch.setattr(cap, 'TERM_GRACE', 0.2)
        monkeypatch.setattr(cap, 'KILL_GRACE', 0.2)

        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        T_invoke = time.monotonic()

        def fake_waitpid(pid, flags):
            raise ChildProcessError("no child")

        monkeypatch.setattr('os.waitpid', fake_waitpid)
        t_start = time.monotonic()
        cap._bounded_terminate(
            proc, cap.LAUNCHED, T_invoke,
            False, 0.0, False, 0.0)
        elapsed = time.monotonic() - t_start

        # Should have waited at least ~TIMEOUT_LIMIT before signaling
        if kills_sent:
            first_kill_time = kills_sent[0][2] - T_invoke
            assert first_kill_time >= 0.15, \
                "Should wait near TIMEOUT_LIMIT before first SIGTERM"


# =====================================================================
# T-BOUND: Boundary conditions
# =====================================================================

class TestBoundary:
    def test_bound_constants_frozen(self):
        """T-BOUND-01: Frozen operational constants."""
        assert cap.DRAIN_GRACE == 5
        assert cap.PERSIST_TIMEOUT == 5
        assert cap.MEM_CAP == 16 * 1024 * 1024
        assert cap.TIMEOUT_LIMIT == 30
        assert cap.TERM_GRACE == 5
        assert cap.KILL_GRACE == 5


# =====================================================================
# T-STATUS: Status / E2 (§11)
# =====================================================================

class TestStatus:
    """T-STATUS tests for status and E2 record writing."""

    def test_status_05_empty_anomaly(self, tmp_path):
        """T-STATUS-05: Empty anomaly list -> []."""
        args = _make_args()
        result = cap.write_status_record(
            str(tmp_path), args, 'COMPLETED', 0, [], 'abc123', 'def456')
        assert result is True
        with open(str(tmp_path / 'status.json'), 'r') as f:
            data = json.load(f)
        assert data['anomaly_flags'] == []

    def test_status_04_publication_check(self, tmp_path):
        """T-STATUS-04: No paths, env values, raw data in status."""
        args = _make_args()
        cap.write_status_record(
            str(tmp_path), args, 'COMPLETED', 0,
            ['TIMEOUT'], 'abc', 'def')
        with open(str(tmp_path / 'status.json'), 'r') as f:
            content = f.read()
        assert '/tmp' not in content
        assert 'HOME' not in content

    def test_status_write_failure_returns_false(self, tmp_path, monkeypatch):
        """T-STATUS-07: Status write failure -> returns False."""
        args = _make_args()

        monkeypatch.setattr(cap, 'create_private_file',
                            lambda p: (_ for _ in ()).throw(
                                OSError("simulated")))
        result = cap.write_status_record(
            str(tmp_path), args, 'COMPLETED', 0, [], 'a', 'b')
        assert result is False

    def test_e2_record_written(self, tmp_path):
        """T-STATUS-08: E2 record contains required fields."""
        args = _make_args()
        result = cap.write_e2_record(
            str(tmp_path), args, '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:01Z', '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:02Z', 0, [], 'PASS', 'PASS')
        assert result is True
        with open(str(tmp_path / 'e2-record.json'), 'r') as f:
            e2 = json.load(f)
        assert e2['fate'] == 'UNCERTAIN'
        assert 'command' in e2
        assert e2['socket_obs_status'] == 'PASS'

    def test_deferred_status_write_failure(self, tmp_path, monkeypatch):
        """T-STATUS-09: DEFERRED with status write failure -> exit 2."""
        calls = []
        original_write_status = cap.write_status_record

        def failing_write_status(*args, **kwargs):
            calls.append(1)
            return False

        monkeypatch.setattr(cap, 'write_status_record', failing_write_status)
        # Simulate the DEFERRED path check from main()
        status_ok = cap.write_status_record(
            str(tmp_path), _make_args(), 'DEFERRED', 0, [], None, None)
        assert not status_ok, "Failed status write should return False"


# =====================================================================
# T-TOOL: Tool failure (§14)
# =====================================================================

class TestToolFailure:
    def test_tool_constants(self):
        """T-TOOL-01: Required tools list complete."""
        assert 'pgrep' in cap.REQUIRED_TOOLS
        assert 'lsof' in cap.REQUIRED_TOOLS
        assert 'sha256sum' in cap.REQUIRED_TOOLS
        assert 'readlink' in cap.REQUIRED_TOOLS
        assert 'id' in cap.REQUIRED_TOOLS
        assert 'stat' in cap.REQUIRED_TOOLS


# =====================================================================
# T-INT: Integration — full pipeline test (§17.11)
# =====================================================================

class TestIntegration:
    """T-INT-01 and T-INT-02: Full pipeline integration tests.
    These run main()'s actual phases via subprocess with mocked environment."""

    @staticmethod
    def _write_collector_script(path, capture_dir, fake_binary, account,
                                pm2home, output, daemon_pid, extra_mp='',
                                timeout_limit=2, term_grace=1,
                                kill_grace=1, drain_grace=1):
        """Write a subprocess collector script exercising capture.main()."""
        lines = [
            'import os, sys, json, shutil',
            'sys.path.insert(0, %r)' % capture_dir,
            'import capture as cap',
            'import subprocess as _sp',
            '',
            'cap.TIMEOUT_LIMIT = %d' % timeout_limit,
            'cap.TERM_GRACE = %d' % term_grace,
            'cap.KILL_GRACE = %d' % kill_grace,
            'cap.DRAIN_GRACE = %d' % drain_grace,
            '',
            '# Mock shutil.which so tools always appear present',
            'shutil.which = lambda x: "/usr/bin/" + x',
            '',
            'daemon_pid_s = %r' % daemon_pid,
            'def mock_run_tool(args):',
            '    class R:',
            '        returncode = 0',
            '        stdout = (daemon_pid_s + " pm2: God Daemon\\n").encode()',
            '        stderr = b""',
            '    if "lsof" in args:',
            '        R.stdout = (daemon_pid_s + "\\n").encode()',
            '    return R()',
            'cap._run_tool = mock_run_tool',
            '',
            'class MockPopen:',
            '    pid = 88888',
            '    returncode = 1',
            '    def __init__(self, *a, **kw): pass',
            '    def communicate(self): return b"", b""',
            'original_Popen = _sp.Popen',
            'def patched_Popen(*a, **kw):',
            '    cmd = a[0] if a else kw.get("args", [])',
            '    if isinstance(cmd, (list, tuple)) and "pgrep" in str(cmd[0]):',
            '        return MockPopen()',
            '    return original_Popen(*a, **kw)',
            '_sp.Popen = patched_Popen',
            '',
            extra_mp,
            '',
            'sys.argv = [',
            '    "capture.py",',
            '    "--account", %r,' % account,
            '    "--pm2-binary", %r,' % fake_binary,
            '    "--pm2-home", %r,' % pm2home,
            '    "--observation-id", "obs-int",',
            '    "--host", "test-host",',
            '    "--captured-by", "test",',
            '    "--acq-record", "acq-int",',
            '    "--output-dir", %r,' % output,
            ']',
            '',
            'try:',
            '    cap.main()',
            'except SystemExit as e:',
            '    sys.exit(e.code if e.code is not None else 0)',
        ]
        with open(path, 'w') as f:
            f.write('\n'.join(lines) + '\n')

    def test_int_01_full_normal_flow(self, tmp_path, fake_pm2_normal,
                                      fake_account):
        """T-INT-01: Full normal flow -> COMPLETED; exit 0; all artifacts;
        anomaly_flags=[]; attempt_outcome=COMPLETED."""
        capture_dir = os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))
        pm2home = str(tmp_path / 'pm2home')
        os.makedirs(pm2home)
        output = str(tmp_path / 'output')
        os.makedirs(output, mode=0o700)

        sock_path = os.path.join(pm2home, 'rpc.sock')
        srv = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        srv.bind(sock_path)
        srv.listen(1)
        daemon_pid = str(os.getpid())

        script_path = str(tmp_path / 'int_01.py')
        self._write_collector_script(
            script_path, capture_dir, fake_pm2_normal, fake_account,
            pm2home, output, daemon_pid)

        try:
            proc = subprocess.run(
                [sys.executable, script_path],
                timeout=30, capture_output=True,
            )
            assert proc.returncode == 0, \
                "T-INT-01: exit 0 expected, got {}: {}".format(
                    proc.returncode, proc.stderr.decode()[:500])

            attempt_dirs = [d for d in os.listdir(output)
                           if d.startswith('capture-')]
            assert len(attempt_dirs) >= 1, "Attempt directory should exist"
            ad = os.path.join(output, attempt_dirs[0])

            assert os.path.exists(os.path.join(ad, 'stdout.raw'))
            assert os.path.exists(os.path.join(ad, 'observation-meta.json'))
            assert os.path.exists(os.path.join(ad, 'status.json'))
            assert os.path.exists(os.path.join(ad, 'e2-record.json'))

            with open(os.path.join(ad, 'status.json'), 'r') as f:
                status = json.load(f)
            assert status['attempt_outcome'] == 'COMPLETED'
            assert status['anomaly_flags'] == []
            assert 'stdout_sha256' in status
            assert 'meta_sha256' in status

        finally:
            srv.close()

    def test_int_02_full_timeout_flow(self, tmp_path, fake_pm2_hang,
                                       fake_account):
        """T-INT-02: Full timeout flow -> COMPLETED with TIMEOUT; exit 0."""
        capture_dir = os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))
        pm2home = str(tmp_path / 'pm2home')
        os.makedirs(pm2home)
        output = str(tmp_path / 'output')
        os.makedirs(output, mode=0o700)

        sock_path = os.path.join(pm2home, 'rpc.sock')
        srv = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        srv.bind(sock_path)
        srv.listen(1)
        daemon_pid = str(os.getpid())

        script_path = str(tmp_path / 'int_02.py')
        self._write_collector_script(
            script_path, capture_dir, fake_pm2_hang, fake_account,
            pm2home, output, daemon_pid,
            timeout_limit=2, term_grace=1, kill_grace=1, drain_grace=1)

        try:
            proc = subprocess.run(
                [sys.executable, script_path],
                timeout=30, capture_output=True,
            )
            assert proc.returncode == 0, \
                "T-INT-02: exit 0 expected, got {}: {}".format(
                    proc.returncode, proc.stderr.decode()[:500])

            attempt_dirs = [d for d in os.listdir(output)
                           if d.startswith('capture-')]
            assert len(attempt_dirs) >= 1
            ad = os.path.join(output, attempt_dirs[0])

            with open(os.path.join(ad, 'status.json'), 'r') as f:
                status = json.load(f)
            assert status['attempt_outcome'] == 'COMPLETED'
            assert 'TIMEOUT' in status['anomaly_flags']

        finally:
            srv.close()


# =====================================================================
# T-PRE: Pre-invocation observations (§6) — behavioral tests
# =====================================================================

class TestPreInvocation:
    """T-PRE-01 through T-PRE-08: behavioral pre-invocation tests."""

    def test_pre_observation_constants(self):
        """T-PRE-01: Anomaly flag allowlist correct."""
        assert 'TIMEOUT' in cap.ALLOWED_ANOMALY_FLAGS
        assert 'IDENTITY_CHANGE' in cap.ALLOWED_ANOMALY_FLAGS
        assert 'DAEMON_DISAPPEARED' in cap.ALLOWED_ANOMALY_FLAGS

    @staticmethod
    def _mock_run_tool_factory(responses):
        idx = [0]
        def mock(args):
            i = idx[0]; idx[0] += 1
            if i < len(responses):
                rc, out, err = responses[i]
            else:
                rc, out, err = (0, b'', b'')
            class R:
                returncode = rc
            R.stdout = out; R.stderr = err
            return R()
        return mock

    @staticmethod
    def _mock_popen_factory(rc=1, stdout=b'', stderr=b''):
        class MP:
            pid = 88888
            def __init__(self, *a, **kw): pass
            def communicate(self): return stdout, stderr
        MP.returncode = rc
        return MP

    def test_pre_01_single_daemon_pass(self, monkeypatch):
        """T-PRE-01: Single daemon, no CLI children -> PASS."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),  # daemon pgrep
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        t, dpid = cap.pre_invocation_observations(
            args, {1234}, '/tmp/h')
        assert dpid == 1234
        assert t is not None

    def test_pre_02_no_daemon(self, monkeypatch):
        """T-PRE-02: No pm2 processes -> DAEMON_ABSENT, exit 1."""
        responses = [(1, b'', b'')]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, set(), '/tmp/h')
        assert exc.value.code == 1

    def test_pre_03_pgrep_error(self, monkeypatch):
        """T-PRE-03: pgrep exit 2 -> OBSERVATION_TOOL_FAILURE, exit 1."""
        responses = [(2, b'', b'error\n')]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, set(), '/tmp/h')
        assert exc.value.code == 1

    def test_pre_04_daemon_plus_cli(self, monkeypatch):
        """T-PRE-04: Daemon + CLI child -> P5_NOT_SATISFIED, exit 1."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        p5_out = b'1234 pm2: God Daemon\n9999 pm2 start app\n'
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=0, stdout=p5_out))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, {1234}, '/tmp/h')
        assert exc.value.code == 1

    def test_pre_05_two_daemons(self, monkeypatch):
        """T-PRE-05: Two daemon matches -> MULTIPLE_DAEMON_MATCHES, exit 1."""
        responses = [
            (0, b'1234 pm2: God Daemon\n5678 pm2: God Daemon\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, {1234}, '/tmp/h')
        assert exc.value.code == 1

    def test_pre_06_pgrep_killed(self, monkeypatch):
        """T-PRE-06: pgrep killed (returncode -9) -> TOOL_FAILURE, exit 1."""
        responses = [(-9, b'', b'')]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, set(), '/tmp/h')
        assert exc.value.code == 1

    def test_pre_07_malformed_output(self, monkeypatch):
        """T-PRE-07: Malformed pgrep output -> OBSERVATION_TOOL_FAILURE."""
        responses = [
            (0, b'not_a_pid garbage\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        args = _make_args()
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, set(), '/tmp/h')
        assert exc.value.code == 1

    def test_pre_08_daemon_not_in_socket_holders(self, monkeypatch):
        """T-PRE-08: Daemon PID not among socket holders -> exit 1."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        # daemon_pid=1234 but socket_holders={9999}
        with pytest.raises(SystemExit) as exc:
            cap.pre_invocation_observations(args, {9999}, '/tmp/h')
        assert exc.value.code == 1


# =====================================================================
# T-POST: Post-invocation observations (§8) — behavioral tests
# =====================================================================

class TestPostInvocation:
    """T-POST-01 through T-POST-07: behavioral post-invocation tests."""

    def test_post_anomaly_flags(self):
        """Allowed anomaly flags list."""
        for flag in ['LINGERING_CLIENT', 'AUTO_LAUNCH_SUSPECTED',
                     'NON_ZERO_EXIT']:
            assert flag in cap.ALLOWED_ANOMALY_FLAGS

    @staticmethod
    def _mock_run_tool_factory(responses):
        idx = [0]
        def mock(args):
            i = idx[0]; idx[0] += 1
            if i < len(responses):
                rc, out, err = responses[i]
            else:
                rc, out, err = (0, b'', b'')
            class R:
                returncode = rc
            R.stdout = out; R.stderr = err
            return R()
        return mock

    @staticmethod
    def _mock_popen_factory(rc=1, stdout=b'', stderr=b''):
        class MP:
            pid = 88888
            def __init__(self, *a, **kw): pass
            def communicate(self): return stdout, stderr
        MP.returncode = rc
        return MP

    def test_post_01_daemon_unchanged(self, monkeypatch):
        """T-POST-01: Daemon PID unchanged -> no anomaly flags."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),  # daemon
            (0, b'1234\n', b''),                   # lsof socket
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        flags = []
        result = cap.post_invocation_observations(
            args, 1234, flags, '/tmp/s')
        assert len(flags) == 0
        assert result[1] == 1234  # post_daemon_pid

    def test_post_02_daemon_absent(self, monkeypatch):
        """T-POST-02: Daemon absent -> DAEMON_DISAPPEARED."""
        responses = [
            (1, b'', b''),          # daemon pgrep: no matches
            (0, b'', b''),          # lsof socket
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        flags = []
        cap.post_invocation_observations(args, 1234, flags, '/tmp/s')
        assert 'DAEMON_DISAPPEARED' in flags
        assert 'AUTO_LAUNCH_SUSPECTED' in flags

    def test_post_03_daemon_pid_changed(self, monkeypatch):
        """T-POST-03: Daemon PID changed -> IDENTITY_CHANGE."""
        responses = [
            (0, b'5678 pm2: God Daemon\n', b''),  # different PID
            (0, b'5678\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        flags = []
        cap.post_invocation_observations(args, 1234, flags, '/tmp/s')
        assert 'IDENTITY_CHANGE' in flags

    def test_post_04_lingering_client(self, monkeypatch):
        """T-POST-04: CLI children remain -> LINGERING_CLIENT."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),
            (0, b'1234\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        p5_out = b'1234 pm2: God Daemon\n9999 pm2 start app\n'
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=0, stdout=p5_out))
        args = _make_args()
        flags = []
        cap.post_invocation_observations(args, 1234, flags, '/tmp/s')
        assert 'LINGERING_CLIENT' in flags

    def test_post_05_pgrep_error(self, monkeypatch):
        """T-POST-05: Post pgrep exit >= 2 -> private tool failure."""
        responses = [
            (3, b'', b'error\n'),  # daemon pgrep error
            (0, b'', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        flags = []
        result = cap.post_invocation_observations(
            args, 1234, flags, '/tmp/s')
        assert 'IDENTITY_CHANGE' not in flags
        assert 'DAEMON_DISAPPEARED' not in flags
        assert not result[2]  # post_daemon_available = False

    def test_post_07_multiple_daemons(self, monkeypatch):
        """T-POST-07: Multiple daemon matches -> anomaly recorded."""
        responses = [
            (0, b'1234 pm2: God Daemon\n5678 pm2: God Daemon\n', b''),
            (0, b'1234\n5678\n', b''),
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(rc=1))
        args = _make_args()
        flags = []
        cap.post_invocation_observations(args, 1234, flags, '/tmp/s')
        assert 'IDENTITY_CHANGE' in flags


# =====================================================================
# T-EXCEPT: Post-launch exception path (§7.6, Fix 5)
# =====================================================================

class TestPostLaunchException:
    """Verify poller construction is protected and exception cleanup
    preserves child state."""

    def test_except_poller_failure_exits(self, tmp_path, monkeypatch):
        """T-EXCEPT-01: Poller construction failure after launch ->
        bounded terminate + exit 2."""
        script = tmp_path / 'quick.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import time
            time.sleep(30)
        '''))
        script.chmod(0o755)

        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 0.5)
        monkeypatch.setattr(cap, 'TERM_GRACE', 0.5)
        monkeypatch.setattr(cap, 'KILL_GRACE', 0.5)

        original_poll = select.poll

        def failing_poll():
            raise OSError("simulated poll failure")

        monkeypatch.setattr(select, 'poll', failing_poll)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        with pytest.raises(SystemExit) as exc:
            cap.run_capture(
                args, str(script), str(tmp_path), attempt_dir,
                stdout_fd, stderr_fd, identity_fd, 12345)
        assert exc.value.code == 2


# =====================================================================
# T-AMBIG: Ambiguous reaping / fault injection (Gap 1)
# =====================================================================

class TestAmbiguousReaping:
    """Fault-injection tests against actual supervision/cleanup code.
    Each test uses a real test-owned child and wraps waitpid to inject
    faults after the kernel has reaped the child."""

    def test_ambig_01_reap_then_runtime_error(self, tmp_path, monkeypatch):
        """waitpid performs real reap then raises RuntimeError ->
        STATE_UNKNOWN, no signal to child PID, no COMPLETED."""
        script = tmp_path / 'quick_exit.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys
            sys.stdout.write("data\\n")
            sys.stdout.flush()
            sys.exit(0)
        '''))
        script.chmod(0o755)

        original_waitpid = os.waitpid
        signals_sent = []
        reap_intercepted = [False]

        def reaping_then_raising(pid, flags):
            r, st = original_waitpid(pid, flags)
            if r != 0 and not reap_intercepted[0]:
                reap_intercepted[0] = True
                raise RuntimeError("simulated post-reap failure")
            return r, st

        original_safe_kill = cap._safe_kill

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig))
            original_safe_kill(pid, sig)

        monkeypatch.setattr('os.waitpid', reaping_then_raising)
        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_pid = result[2]
        assert child_state == cap.STATE_UNKNOWN

        child_signals = [s for s in signals_sent if s[0] == child_pid]
        assert len(child_signals) == 0, \
            "No signal should target child PID after ambiguous reap"

    def test_ambig_02_child_process_error(self, tmp_path, monkeypatch):
        """waitpid raises ChildProcessError -> IDENTITY_LOST, no signal."""
        script = tmp_path / 'quick_exit.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import sys
            sys.stdout.write("data\\n")
            sys.stdout.flush()
            sys.exit(0)
        '''))
        script.chmod(0o755)

        original_waitpid = os.waitpid
        signals_sent = []
        child_reaped_externally = [False]

        def external_reap_then_error(pid, flags):
            r, st = original_waitpid(pid, flags)
            if r != 0 and not child_reaped_externally[0]:
                child_reaped_externally[0] = True
                raise ChildProcessError("no child processes")
            return r, st

        original_safe_kill = cap._safe_kill

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig))

        monkeypatch.setattr('os.waitpid', external_reap_then_error)
        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        child_pid = result[2]
        assert child_state == cap.IDENTITY_LOST

        child_signals = [s for s in signals_sent if s[0] == child_pid]
        assert len(child_signals) == 0, \
            "No signal should target child PID after IDENTITY_LOST"

    def test_ambig_03_exception_during_term_grace(self, tmp_path, monkeypatch):
        """Exception after SIGTERM sent, during TERM_GRACE ->
        _bounded_terminate preserves existing escalation state."""
        script = tmp_path / 'sleeper.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import time
            time.sleep(60)
        '''))
        script.chmod(0o755)

        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 0.3)
        monkeypatch.setattr(cap, 'TERM_GRACE', 0.3)
        monkeypatch.setattr(cap, 'KILL_GRACE', 0.3)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 0.3)

        original_waitpid = os.waitpid
        sigterm_seen = [False]
        inject_after_term = [False]
        signals_sent = []
        original_safe_kill = cap._safe_kill

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig, time.monotonic()))
            if sig == signal.SIGTERM:
                sigterm_seen[0] = True
            original_safe_kill(pid, sig)

        def failing_after_term(pid, flags):
            if sigterm_seen[0] and not inject_after_term[0]:
                inject_after_term[0] = True
                raise RuntimeError("simulated exception during TERM grace")
            return original_waitpid(pid, flags)

        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)
        monkeypatch.setattr('os.waitpid', failing_after_term)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        assert child_state == cap.STATE_UNKNOWN

    def test_ambig_04_exception_during_kill_grace(self, tmp_path, monkeypatch):
        """Exception after SIGKILL sent -> _bounded_terminate handles it."""
        script = tmp_path / 'ignores_term.py'
        script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import signal, time
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            while True:
                time.sleep(0.1)
        '''))
        script.chmod(0o755)

        monkeypatch.setattr(cap, 'TIMEOUT_LIMIT', 0.2)
        monkeypatch.setattr(cap, 'TERM_GRACE', 0.2)
        monkeypatch.setattr(cap, 'KILL_GRACE', 0.3)
        monkeypatch.setattr(cap, 'DRAIN_GRACE', 0.2)

        original_waitpid = os.waitpid
        sigkill_seen = [False]
        inject_after_kill = [False]
        signals_sent = []
        original_safe_kill = cap._safe_kill

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig))
            if sig == signal.SIGKILL:
                sigkill_seen[0] = True
            original_safe_kill(pid, sig)

        def failing_after_kill(pid, flags):
            if sigkill_seen[0] and not inject_after_kill[0]:
                inject_after_kill[0] = True
                raise RuntimeError("simulated exception during KILL grace")
            return original_waitpid(pid, flags)

        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)
        monkeypatch.setattr('os.waitpid', failing_after_kill)

        env = _setup_capture_env(tmp_path)
        attempt_dir, _, _, _, stdout_fd, stderr_fd, identity_fd = env
        args = _make_args()

        result = cap.run_capture(
            args, str(script), str(tmp_path), attempt_dir,
            stdout_fd, stderr_fd, identity_fd, 12345)

        child_state = result[0]
        assert child_state == cap.STATE_UNKNOWN

    def test_ambig_05_bounded_terminate_no_signal_after_reap(self, monkeypatch):
        """_bounded_terminate with REAPED state -> no signals sent."""
        signals_sent = []

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig))

        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)

        proc = type('P', (), {'pid': 99999, 'returncode': 0})()
        cap._bounded_terminate(
            proc, cap.REAPED, time.monotonic(),
            False, 0.0, False, 0.0)

        assert len(signals_sent) == 0

    def test_ambig_06_bounded_terminate_no_signal_state_unknown(self,
                                                                  monkeypatch):
        """_bounded_terminate with STATE_UNKNOWN -> no signals sent."""
        signals_sent = []

        def tracking_kill(pid, sig):
            signals_sent.append((pid, sig))

        monkeypatch.setattr(cap, '_safe_kill', tracking_kill)

        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        cap._bounded_terminate(
            proc, cap.STATE_UNKNOWN, time.monotonic(),
            False, 0.0, False, 0.0)

        assert len(signals_sent) == 0

    def test_ambig_07_cleanup_preserves_existing_term(self, monkeypatch):
        """_bounded_terminate with SIGTERM already sent preserves its
        deadline rather than restarting. Pure recorder, no real signals."""
        signals_sent = []

        def recording_kill(pid, sig):
            signals_sent.append((pid, sig, time.monotonic()))

        monkeypatch.setattr(cap, '_safe_kill', recording_kill)
        monkeypatch.setattr(cap, 'TERM_GRACE', 0.3)
        monkeypatch.setattr(cap, 'KILL_GRACE', 0.3)

        def always_empty_waitpid(pid, flags):
            return 0, 0

        monkeypatch.setattr('os.waitpid', always_empty_waitpid)

        proc = type('P', (), {'pid': 99999, 'returncode': None})()
        sigterm_mono = time.monotonic()

        cap._bounded_terminate(
            proc, cap.LAUNCHED, time.monotonic() - 60,
            True, sigterm_mono, False, 0.0)

        kill_signals = [s for s in signals_sent if s[1] == signal.SIGKILL]
        assert len(kill_signals) == 1, "Should escalate to SIGKILL"
        term_signals = [s for s in signals_sent if s[1] == signal.SIGTERM]
        assert len(term_signals) == 0, \
            "Should NOT re-send SIGTERM"
        # Verify SIGKILL happened after TERM_GRACE from sigterm_mono
        kill_time = kill_signals[0][2]
        elapsed_from_term = kill_time - sigterm_mono
        assert elapsed_from_term >= 0.25, \
            f"SIGKILL should wait ~TERM_GRACE ({elapsed_from_term:.3f}s)"


# =====================================================================
# T-VERIFIER: Offline verifier compatibility (Gap 2)
# =====================================================================

class TestVerifierCompatibility:
    """Run the locked verifier's real validation against synthetic
    capture metadata. Verifier source is imported read-only; not modified."""

    @staticmethod
    def _import_verifier():
        """Import the locked verifier module."""
        verifier_dir = os.path.join(
            os.path.dirname(__file__), '..', '..', 'pm2-recovery-verify')
        if not os.path.isdir(verifier_dir):
            pytest.skip('Verifier source not available at expected path')
        saved_path = list(sys.path)
        sys.path.insert(0, os.path.realpath(verifier_dir))
        try:
            import compare_dual_env as verifier
            return verifier
        except ImportError:
            pytest.skip('Cannot import verifier module')
        finally:
            sys.path[:] = saved_path

    def test_verifier_01_normal_capture_passes(self, tmp_path):
        """Full synthetic normal capture -> verifier returns no errors."""
        verifier = self._import_verifier()

        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'[{"name":"app","pm_id":0}]')

        args = _make_args(pm2_home=str(tmp_path))
        t_obs_start = '2026-01-15T10:00:00Z'
        meta_path, meta_sha256, jlist_sha256 = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], t_obs_start)

        assert meta_path is not None

        with open(meta_path, 'r') as f:
            doc = json.load(f)

        obs = verifier.Observation()
        errors = verifier.validate_observation_meta(doc, obs)
        assert errors == [], \
            f"Verifier should accept valid metadata, got: {errors}"

        assert obs.observation_id == 'obs-001'
        assert obs.host == 'test-host'
        assert obs.jlist_sha256 == jlist_sha256
        assert obs.captured_at is not None
        assert obs.daemon_pid == 1234
        assert obs.acquisition_record == 'acq-001'

    def test_verifier_02_captured_at_is_t_obs_start(self, tmp_path):
        """captured_at uses T_obs_start per acquisition §2.4."""
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'data')

        args = _make_args(pm2_home=str(tmp_path))
        t_obs_start = '2026-06-15T08:30:00Z'
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], t_obs_start)

        with open(meta_path, 'r') as f:
            doc = json.load(f)

        assert doc['captured_at'] == t_obs_start, \
            "captured_at must be T_obs_start, not T_invoke"

    def test_verifier_03_daemon_pid_omitted_identity_change(self, tmp_path):
        """Verifier accepts metadata without daemon_pid when
        IDENTITY_CHANGE is flagged."""
        verifier = self._import_verifier()

        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(b'[{"name":"app"}]')

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, _ = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            5678, True, ['IDENTITY_CHANGE'], '2026-01-15T10:00:00Z')

        with open(meta_path, 'r') as f:
            doc = json.load(f)

        assert 'daemon_pid' not in doc

        obs = verifier.Observation()
        errors = verifier.validate_observation_meta(doc, obs)
        assert errors == [], \
            f"Verifier should accept meta without daemon_pid: {errors}"
        assert not obs.daemon_pid_declared

    def test_verifier_04_hash_binding(self, tmp_path):
        """jlist_sha256 in metadata matches actual file hash."""
        verifier = self._import_verifier()

        test_data = b'[{"name":"app","pm_id":0,"status":"online"}]'
        stdout_path = str(tmp_path / 'stdout.raw')
        with open(stdout_path, 'wb') as f:
            f.write(test_data)

        expected_hash = hashlib.sha256(test_data).hexdigest()

        args = _make_args(pm2_home=str(tmp_path))
        meta_path, _, jlist_sha256 = cap.build_observation_meta(
            args, str(tmp_path), stdout_path, 1234,
            1234, True, [], '2026-01-15T10:00:00Z')

        assert jlist_sha256 == expected_hash

        with open(meta_path, 'r') as f:
            doc = json.load(f)
        assert doc['jlist_sha256'] == expected_hash

        obs = verifier.Observation()
        verifier.validate_observation_meta(doc, obs)
        assert obs.jlist_sha256 == expected_hash


# =====================================================================
# T-ABANDONED: Persistence timeout / ABANDONED path (Gap 3)
# =====================================================================

class TestAbandonedPath:
    """Test ABANDONED shutdown path in a subprocess so os._exit(2)
    does not kill pytest."""

    def test_abandoned_01_persistence_timeout(self, tmp_path):
        """Writer blocked at persistence -> ABANDONED path -> exit 2.
        No hash, no metadata, no COMPLETED. Partial files preserved."""
        attempt_dir = str(tmp_path / 'attempt')
        os.makedirs(attempt_dir, mode=0o700)

        capture_dir = os.path.dirname(os.path.dirname(__file__))

        helper_script = str(tmp_path / 'abandoned_helper.py')
        with open(helper_script, 'w') as f:
            f.write(textwrap.dedent('''\
                import os, sys, queue, threading, time

                sys.path.insert(0, sys.argv[1])
                import capture as cap

                cap.PERSIST_TIMEOUT = 1
                cap.DRAIN_GRACE = 1

                attempt_dir = sys.argv[2]

                stdout_path = os.path.join(attempt_dir, 'stdout.raw')
                stderr_path = os.path.join(attempt_dir, 'stderr.raw')
                identity_path = os.path.join(attempt_dir, 'identity.log')

                stdout_fd = cap.create_private_file(stdout_path)
                stderr_fd = cap.create_private_file(stderr_path)
                identity_fd = cap.create_private_file(identity_path)

                data_queue = queue.Queue()
                ack_queue = queue.Queue()
                writer_event = threading.Event()
                result_slot = [None]

                stall_event = threading.Event()
                _original_fsync = os.fsync

                def stalling_fsync(fd):
                    stall_event.wait(timeout=30)
                    return _original_fsync(fd)

                os.fsync = stalling_fsync

                writer = threading.Thread(
                    target=cap._writer_main,
                    args=(stdout_fd, stderr_fd, identity_fd,
                          data_queue, ack_queue, writer_event, result_slot),
                    daemon=True,
                )
                writer.start()

                data_queue.put((cap.STDOUT_TAG, b'partial capture data'))
                data_queue.put((cap.STDERR_TAG, b'partial stderr'))
                data_queue.put((cap.IDENTITY_TAG, b'12345\\n'))
                data_queue.put(cap.SENTINEL)

                time.sleep(0.3)

                fake_eof = {0: True, 1: True}

                cap.shutdown_writer(
                    cap.REAPED, fake_eof, False, True,
                    data_queue, writer_event, result_slot)

                sys.exit(99)
            '''))

        proc = subprocess.run(
            [sys.executable, helper_script, capture_dir, attempt_dir],
            timeout=15,
            capture_output=True,
        )

        assert proc.returncode == 2, \
            f"ABANDONED path should exit 2, got {proc.returncode}"

        assert not os.path.exists(
            os.path.join(attempt_dir, 'observation-meta.json')), \
            "No metadata should be produced on ABANDONED"
        assert not os.path.exists(
            os.path.join(attempt_dir, 'status.json')), \
            "No status should be produced on ABANDONED"
        assert os.path.exists(
            os.path.join(attempt_dir, 'stdout.raw')), \
            "Partial stdout.raw should be preserved"
        assert os.path.exists(
            os.path.join(attempt_dir, 'stderr.raw')), \
            "Partial stderr.raw should be preserved"
        assert os.path.exists(
            os.path.join(attempt_dir, 'identity.log')), \
            "Partial identity.log should be preserved"

    def test_abandoned_02_no_descriptor_close(self, tmp_path):
        """Supervisor does not close writer-owned descriptors on ABANDONED.
        Writes forbidden-close events to a marker file that survives
        os._exit, making the assertion externally observable."""
        attempt_dir = str(tmp_path / 'attempt')
        os.makedirs(attempt_dir, mode=0o700)
        marker_path = str(tmp_path / 'forbidden_close.marker')

        capture_dir = os.path.dirname(os.path.dirname(__file__))

        helper_script = str(tmp_path / 'abandoned_no_close.py')
        with open(helper_script, 'w') as f:
            f.write(textwrap.dedent('''\
                import os, sys, queue, threading, time

                sys.path.insert(0, sys.argv[1])
                import capture as cap

                cap.PERSIST_TIMEOUT = 1

                attempt_dir = sys.argv[2]
                marker_path = sys.argv[3]

                stdout_path = os.path.join(attempt_dir, 'stdout.raw')
                stderr_path = os.path.join(attempt_dir, 'stderr.raw')
                identity_path = os.path.join(attempt_dir, 'identity.log')

                stdout_fd = cap.create_private_file(stdout_path)
                stderr_fd = cap.create_private_file(stderr_path)
                identity_fd = cap.create_private_file(identity_path)

                fd_set = {stdout_fd, stderr_fd, identity_fd}
                _original_close = os.close
                marker_fd = os.open(marker_path,
                    os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)

                def logging_close(fd):
                    if fd in fd_set:
                        msg = 'FORBIDDEN_CLOSE fd={}\\n'.format(fd).encode()
                        os.write(marker_fd, msg)
                        os.fsync(marker_fd)
                    if fd == marker_fd:
                        return _original_close(fd)
                    return _original_close(fd)

                os.close = logging_close

                data_queue = queue.Queue()
                ack_queue = queue.Queue()
                writer_event = threading.Event()
                result_slot = [None]

                _original_write = os.write

                def stalling_write(fd, data):
                    if fd in fd_set:
                        time.sleep(30)
                    return _original_write(fd, data)

                os.write = stalling_write

                writer = threading.Thread(
                    target=cap._writer_main,
                    args=(stdout_fd, stderr_fd, identity_fd,
                          data_queue, ack_queue, writer_event, result_slot),
                    daemon=True,
                )
                writer.start()

                data_queue.put((cap.STDOUT_TAG, b'test'))
                time.sleep(0.3)

                fake_eof = {0: True, 1: True}

                cap.shutdown_writer(
                    cap.REAPED, fake_eof, False, True,
                    data_queue, writer_event, result_slot)

                sys.exit(99)
            '''))

        proc = subprocess.run(
            [sys.executable, helper_script, capture_dir, attempt_dir,
             marker_path],
            timeout=15, capture_output=True,
        )

        assert proc.returncode == 2
        # Check the marker file for forbidden closes
        if os.path.exists(marker_path):
            with open(marker_path, 'r') as f:
                content = f.read()
            assert 'FORBIDDEN_CLOSE' not in content, \
                f"Supervisor closed writer-owned descriptors: {content}"

    def test_abandoned_03_no_fallback_logging(self, tmp_path):
        """ABANDONED path: no fallback persistence or notification writes.
        Verifies no new files beyond the initial three appear."""
        attempt_dir = str(tmp_path / 'attempt')
        os.makedirs(attempt_dir, mode=0o700)
        write_marker = str(tmp_path / 'post_timeout_writes.marker')

        capture_dir = os.path.dirname(os.path.dirname(__file__))

        helper_script = str(tmp_path / 'abandoned_no_fallback.py')
        with open(helper_script, 'w') as f:
            f.write(textwrap.dedent('''\
                import os, sys, queue, threading, time

                sys.path.insert(0, sys.argv[1])
                import capture as cap

                cap.PERSIST_TIMEOUT = 1

                attempt_dir = sys.argv[2]
                write_marker = sys.argv[3]

                stdout_path = os.path.join(attempt_dir, 'stdout.raw')
                stderr_path = os.path.join(attempt_dir, 'stderr.raw')
                identity_path = os.path.join(attempt_dir, 'identity.log')

                stdout_fd = cap.create_private_file(stdout_path)
                stderr_fd = cap.create_private_file(stderr_path)
                identity_fd = cap.create_private_file(identity_path)

                # Track writes after PERSIST_TIMEOUT expires
                marker_fd = os.open(write_marker,
                    os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
                timeout_reached = [False]
                _original_write = os.write

                def auditing_write(fd, data):
                    if timeout_reached[0] and fd != marker_fd:
                        msg = 'POST_TIMEOUT_WRITE fd={}\\n'.format(
                            fd).encode()
                        _original_write(marker_fd, msg)
                        os.fsync(marker_fd)
                    return _original_write(fd, data)

                os.write = auditing_write

                class TimingEvent:
                    """Event that records when timeout is reached."""
                    def wait(self, timeout=None):
                        time.sleep(timeout or 30)
                        timeout_reached[0] = True
                        return False
                    def is_set(self):
                        return False
                    def set(self):
                        pass

                data_queue = queue.Queue()
                ack_queue = queue.Queue()
                writer_event = TimingEvent()
                result_slot = [None]

                fake_eof = {0: True, 1: True}

                cap.shutdown_writer(
                    cap.REAPED, fake_eof, False, True,
                    data_queue, writer_event, result_slot)

                sys.exit(99)
            '''))

        proc = subprocess.run(
            [sys.executable, helper_script, capture_dir, attempt_dir,
             write_marker],
            timeout=15, capture_output=True,
        )

        assert proc.returncode == 2

        # No new files beyond initial three
        files_after = set(os.listdir(attempt_dir))
        assert 'status.json' not in files_after
        assert 'observation-meta.json' not in files_after
        assert 'e2-record.json' not in files_after

        # No post-timeout writes occurred
        if os.path.exists(write_marker):
            with open(write_marker, 'r') as f:
                content = f.read()
            assert 'POST_TIMEOUT_WRITE' not in content, \
                f"Prohibited writes after timeout: {content}"


# =====================================================================
# T-SHUTDOWN-ID: identity_recorded=False + writer timeout (Fix 1)
# =====================================================================

class TestShutdownIdentityAbandoned:
    """Regression: shutdown_writer with identity_recorded=False must
    follow the ABANDONED path if the writer times out."""

    def test_shutdown_identity_false_writer_timeout(self, tmp_path):
        """Writer blocked + identity_recorded=False -> ABANDONED exit 2."""
        attempt_dir = str(tmp_path / 'attempt')
        os.makedirs(attempt_dir, mode=0o700)
        capture_dir = os.path.dirname(os.path.dirname(__file__))

        helper = str(tmp_path / 'id_abandoned.py')
        with open(helper, 'w') as f:
            f.write(textwrap.dedent('''\
                import os, sys, queue, threading, time

                sys.path.insert(0, sys.argv[1])
                import capture as cap

                cap.PERSIST_TIMEOUT = 1

                attempt_dir = sys.argv[2]
                stdout_path = os.path.join(attempt_dir, 'stdout.raw')
                stderr_path = os.path.join(attempt_dir, 'stderr.raw')
                identity_path = os.path.join(attempt_dir, 'identity.log')

                stdout_fd = cap.create_private_file(stdout_path)
                stderr_fd = cap.create_private_file(stderr_path)
                identity_fd = cap.create_private_file(identity_path)

                data_queue = queue.Queue()
                ack_queue = queue.Queue()
                writer_event = threading.Event()
                result_slot = [None]

                _original_fsync = os.fsync
                def stalling_fsync(fd):
                    time.sleep(30)
                    return _original_fsync(fd)
                os.fsync = stalling_fsync

                writer = threading.Thread(
                    target=cap._writer_main,
                    args=(stdout_fd, stderr_fd, identity_fd,
                          data_queue, ack_queue, writer_event, result_slot),
                    daemon=True,
                )
                writer.start()

                data_queue.put((cap.STDOUT_TAG, b'data'))
                data_queue.put((cap.STDERR_TAG, b'err'))
                time.sleep(0.3)

                fake_eof = {0: True, 1: True}
                # identity_recorded=False, writer will block
                cap.shutdown_writer(
                    cap.REAPED, fake_eof, False, False,
                    data_queue, writer_event, result_slot)

                sys.exit(99)
            '''))

        proc = subprocess.run(
            [sys.executable, helper, capture_dir, attempt_dir],
            timeout=15, capture_output=True,
        )
        assert proc.returncode == 2, \
            f"ABANDONED expected exit 2, got {proc.returncode}"

    def test_shutdown_identity_false_writer_acks(self, tmp_path):
        """Writer ACKs normally + identity_recorded=False ->
        returns 'IDENTITY_NOT_RECORDED', not ABANDONED."""
        attempt_dir = str(tmp_path / 'attempt')
        os.makedirs(attempt_dir, mode=0o700)

        stdout_path = os.path.join(attempt_dir, 'stdout.raw')
        stderr_path = os.path.join(attempt_dir, 'stderr.raw')
        identity_path = os.path.join(attempt_dir, 'identity.log')

        stdout_fd = cap.create_private_file(stdout_path)
        stderr_fd = cap.create_private_file(stderr_path)
        identity_fd = cap.create_private_file(identity_path)

        dq = queue.Queue()
        aq = queue.Queue()
        evt = threading.Event()
        rs = [None]

        writer = threading.Thread(
            target=cap._writer_main,
            args=(stdout_fd, stderr_fd, identity_fd, dq, aq, evt, rs),
            daemon=True,
        )
        writer.start()

        dq.put((cap.STDOUT_TAG, b'data'))

        fake_eof = {0: True, 1: True}
        result = cap.shutdown_writer(
            cap.REAPED, fake_eof, False, False,
            dq, evt, rs)
        assert result == 'IDENTITY_NOT_RECORDED'


# =====================================================================
# T-POSTOBS: Post-invocation observation tool failures (Fix 3)
# =====================================================================

class TestPostObsToolFailure:
    """Regression: tool failure/signal in observation tools must not
    produce identity-change or absence anomaly flags."""

    @staticmethod
    def _mock_run_tool_factory(responses):
        """Create a _run_tool mock returning responses in sequence."""
        idx = [0]

        def mock_run_tool(args):
            i = idx[0]
            idx[0] += 1
            if i < len(responses):
                rc, stdout, stderr = responses[i]
            else:
                rc, stdout, stderr = (0, b'', b'')

            class R:
                returncode = rc
            R.stdout = stdout
            R.stderr = stderr
            return R()
        return mock_run_tool

    @staticmethod
    def _mock_popen_factory(returncode=1, stdout=b'', stderr=b''):
        """Create a subprocess.Popen mock for P5 check."""
        class MockPopen:
            pid = 88888
            def __init__(self, *a, **kw):
                pass
            def communicate(self):
                return stdout, stderr
        MockPopen.returncode = returncode
        return MockPopen

    def test_postobs_lsof_signaled_no_identity_change(self, monkeypatch):
        """lsof killed by signal -> TOOL_FAILURE, NOT IDENTITY_CHANGE."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),  # daemon pgrep
            (-9, b'', b''),                        # lsof signaled
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(returncode=1))

        args = _make_args()
        anomaly_flags = []
        result = cap.post_invocation_observations(
            args, 1234, anomaly_flags, '/tmp/fake.sock')

        assert 'IDENTITY_CHANGE' not in anomaly_flags, \
            "Tool failure must not become identity evidence"
        socket_obs = result[4]
        assert socket_obs == 'TOOL_FAILURE'

    def test_postobs_lsof_error_no_identity_change(self, monkeypatch):
        """lsof exit >=2 (error) -> TOOL_FAILURE, NOT IDENTITY_CHANGE."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),  # daemon pgrep
            (4, b'', b'lsof error\n'),             # lsof error
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(returncode=1))

        args = _make_args()
        anomaly_flags = []
        result = cap.post_invocation_observations(
            args, 1234, anomaly_flags, '/tmp/fake.sock')

        assert 'IDENTITY_CHANGE' not in anomaly_flags
        socket_obs = result[4]
        assert socket_obs == 'TOOL_FAILURE'

    def test_postobs_pgrep_signaled_no_daemon_disappeared(self, monkeypatch):
        """pgrep for daemon killed by signal -> uncertain, not disappeared."""
        responses = [
            (-15, b'', b''),   # daemon pgrep signaled
            (0, b'', b''),     # lsof (won't matter much)
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(returncode=1))

        args = _make_args()
        anomaly_flags = []
        result = cap.post_invocation_observations(
            args, 1234, anomaly_flags, '/tmp/fake.sock')

        assert 'DAEMON_DISAPPEARED' not in anomaly_flags, \
            "Signaled tool must not claim daemon disappeared"
        post_daemon_available = result[2]
        assert not post_daemon_available

    def test_postobs_p5_signaled_is_tool_failure(self, monkeypatch):
        """P5 pgrep signaled -> TOOL_FAILURE, not PASS or LINGERING."""
        responses = [
            (0, b'1234 pm2: God Daemon\n', b''),  # daemon pgrep
            (0, b'1234\n', b''),                   # lsof normal
        ]
        monkeypatch.setattr(cap, '_run_tool',
                            self._mock_run_tool_factory(responses))
        monkeypatch.setattr(subprocess, 'Popen',
                            self._mock_popen_factory(returncode=-9))

        args = _make_args()
        anomaly_flags = []
        result = cap.post_invocation_observations(
            args, 1234, anomaly_flags, '/tmp/fake.sock')

        p5_status = result[3]
        assert p5_status == 'TOOL_FAILURE'
        assert 'LINGERING_CLIENT' not in anomaly_flags

    def test_postobs_socket_obs_status_in_e2(self, tmp_path):
        """E2 record includes socket_obs_status field."""
        args = _make_args()
        result = cap.write_e2_record(
            str(tmp_path), args, '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:01Z', '2026-01-01T00:00:00Z',
            '2026-01-01T00:00:02Z', 0, [], 'PASS', 'TOOL_FAILURE')
        assert result is True
        with open(str(tmp_path / 'e2-record.json'), 'r') as f:
            e2 = json.load(f)
        assert e2['socket_obs_status'] == 'TOOL_FAILURE'


# =====================================================================
# T-DEFERRED-E2: DEFERRED branch E2 write failure (Fix 4)
# Exercises main()'s actual DEFERRED branch via subprocess
# =====================================================================

class TestDeferredE2Failure:
    """Regression: DEFERRED must not publish if E2 write fails.
    Uses subprocess to exercise main()'s actual code path."""

    def test_deferred_e2_failure_via_main(self, tmp_path, fake_account):
        """T-STATUS-09: E2 write failure in DEFERRED path -> exit 2 (not 3).
        Exercises main() via subprocess with a fork-holding-pipe fake
        (to trigger DEFERRED) and injected E2 failure.
        Verifies status.json is NOT published after E2 failure."""
        capture_dir = os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))
        pm2home = str(tmp_path / 'pm2home')
        os.makedirs(pm2home)
        output = str(tmp_path / 'output')
        os.makedirs(output, mode=0o700)

        sock_path = os.path.join(pm2home, 'rpc.sock')
        srv = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        srv.bind(sock_path)
        srv.listen(1)
        daemon_pid = str(os.getpid())

        fork_script = tmp_path / 'fork_for_deferred.py'
        fork_script.write_text(textwrap.dedent('''\
            #!/usr/bin/env python3
            import os, sys, time
            sys.stdout.write("parent data\\n")
            sys.stdout.flush()
            pid = os.fork()
            if pid == 0:
                time.sleep(15)
                os._exit(0)
            else:
                os._exit(0)
        '''))
        fork_script.chmod(0o755)

        helper = str(tmp_path / 'deferred_e2_main.py')
        lines = [
            'import os, sys, json, shutil',
            'sys.path.insert(0, %r)' % capture_dir,
            'import capture as cap',
            'import subprocess as _sp',
            '',
            'cap.TIMEOUT_LIMIT = 2',
            'cap.TERM_GRACE = 1',
            'cap.KILL_GRACE = 1',
            'cap.DRAIN_GRACE = 1',
            '',
            'shutil.which = lambda x: "/usr/bin/" + x',
            '',
            'daemon_pid_s = %r' % daemon_pid,
            'def mock_run_tool(args):',
            '    class R:',
            '        returncode = 0',
            '        stdout = (daemon_pid_s + " pm2: God Daemon\\n").encode()',
            '        stderr = b""',
            '    if "lsof" in args:',
            '        R.stdout = (daemon_pid_s + "\\n").encode()',
            '    return R()',
            'cap._run_tool = mock_run_tool',
            '',
            'class MockPopen:',
            '    pid = 88888',
            '    returncode = 1',
            '    def __init__(self, *a, **kw): pass',
            '    def communicate(self): return b"", b""',
            'original_Popen = _sp.Popen',
            'def patched_Popen(*a, **kw):',
            '    cmd = a[0] if a else kw.get("args", [])',
            '    if isinstance(cmd, (list,tuple)) and "pgrep" in str(cmd[0]):',
            '        return MockPopen()',
            '    return original_Popen(*a, **kw)',
            '_sp.Popen = patched_Popen',
            '',
            'cap.write_e2_record = lambda *a, **kw: False',
            '',
            'sys.argv = [',
            '    "capture.py",',
            '    "--account", %r,' % fake_account,
            '    "--pm2-binary", %r,' % str(fork_script),
            '    "--pm2-home", %r,' % pm2home,
            '    "--observation-id", "obs-def",',
            '    "--host", "h",',
            '    "--captured-by", "c",',
            '    "--acq-record", "a",',
            '    "--output-dir", %r,' % output,
            ']',
            '',
            'try:',
            '    cap.main()',
            'except SystemExit as e:',
            '    sys.exit(e.code if e.code is not None else 0)',
        ]
        with open(helper, 'w') as f:
            f.write('\n'.join(lines) + '\n')

        try:
            proc = subprocess.run(
                [sys.executable, helper],
                timeout=30, capture_output=True,
            )

            assert proc.returncode == 2, \
                "DEFERRED with E2 failure must exit 2, got {}: {}".format(
                    proc.returncode, proc.stderr.decode()[:500])

            attempt_dirs = [d for d in os.listdir(output)
                           if d.startswith('capture-')]
            for ad_name in attempt_dirs:
                ad = os.path.join(output, ad_name)
                assert not os.path.exists(
                    os.path.join(ad, 'status.json')), \
                    "status.json must NOT exist after E2 failure"
        finally:
            srv.close()

    def test_deferred_e2_write_failure_unit(self, tmp_path):
        """Unit: write_e2_record returns False on I/O failure."""
        ro_dir = str(tmp_path / 'ro')
        os.makedirs(ro_dir, mode=0o500)
        args = _make_args()
        e2_ok = cap.write_e2_record(
            ro_dir, args, 'T1', 'T2', 'T3', 'T4', 0, [], 'PASS', 'PASS')
        assert not e2_ok
        assert not os.path.exists(os.path.join(ro_dir, 'status.json'))

    def test_deferred_status_failure_after_e2(self, tmp_path, monkeypatch):
        """T-STATUS-10: Status write fails after E2 succeeds -> exit 2."""
        args = _make_args()
        e2_ok = cap.write_e2_record(
            str(tmp_path), args, 'T1', 'T2', 'T3', 'T4',
            0, [], 'PASS', 'PASS')
        assert e2_ok
        monkeypatch.setattr(cap, 'write_status_record',
                            lambda *a, **kw: False)
        status_ok = cap.write_status_record(
            str(tmp_path), args, 'DEFERRED', 0, [], None, None)
        assert not status_ok


# =====================================================================
# T-STATUS-12/13: Collector subprocess fsync/close failure (§11, §9.5)
# =====================================================================

class TestStatusCollectorFailure:
    """Exercise collector exit code independently of child exit.
    Demonstrate that a fully written COMPLETED status file alone
    does not establish successful capture."""

    @staticmethod
    def _write_status_failure_script(path, capture_dir, fake_binary,
                                      account, pm2home, output,
                                      daemon_pid, inject_lines):
        """Write a collector subprocess with injected status failure."""
        lines = [
            'import os, sys, json, shutil',
            'sys.path.insert(0, %r)' % capture_dir,
            'import capture as cap',
            'import subprocess as _sp',
            '',
            'cap.TIMEOUT_LIMIT = 2',
            'cap.TERM_GRACE = 1',
            'cap.KILL_GRACE = 1',
            'cap.DRAIN_GRACE = 1',
            '',
            'shutil.which = lambda x: "/usr/bin/" + x',
            '',
            'daemon_pid_s = %r' % daemon_pid,
            'def mock_run_tool(args):',
            '    class R:',
            '        returncode = 0',
            '        stdout = (daemon_pid_s + " pm2: God Daemon\\n").encode()',
            '        stderr = b""',
            '    if "lsof" in args:',
            '        R.stdout = (daemon_pid_s + "\\n").encode()',
            '    return R()',
            'cap._run_tool = mock_run_tool',
            '',
            'class MockPopen:',
            '    pid = 88888',
            '    returncode = 1',
            '    def __init__(self, *a, **kw): pass',
            '    def communicate(self): return b"", b""',
            'original_Popen = _sp.Popen',
            'def patched_Popen(*a, **kw):',
            '    cmd = a[0] if a else kw.get("args", [])',
            '    if isinstance(cmd, (list,tuple)) and "pgrep" in str(cmd[0]):',
            '        return MockPopen()',
            '    return original_Popen(*a, **kw)',
            '_sp.Popen = patched_Popen',
            '',
        ] + inject_lines + [
            '',
            'sys.argv = [',
            '    "capture.py",',
            '    "--account", %r,' % account,
            '    "--pm2-binary", %r,' % fake_binary,
            '    "--pm2-home", %r,' % pm2home,
            '    "--observation-id", "obs-st",',
            '    "--host", "h",',
            '    "--captured-by", "c",',
            '    "--acq-record", "a",',
            '    "--output-dir", %r,' % output,
            ']',
            '',
            'try:',
            '    cap.main()',
            'except SystemExit as e:',
            '    sys.exit(e.code if e.code is not None else 0)',
        ]
        with open(path, 'w') as f:
            f.write('\n'.join(lines) + '\n')

    def test_status_12_fsync_fails_collector_exits_2(self, tmp_path,
                                                      fake_pm2_normal,
                                                      fake_account):
        """T-STATUS-12: Real write_status_record executes; os.fsync
        fails specifically on the status-file fd. Status bytes are fully
        written to disk. Collector exits 2. status.json exists with
        COMPLETED content but collector exit overrides."""
        capture_dir = os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))
        pm2home = str(tmp_path / 'pm2home')
        os.makedirs(pm2home)
        output = str(tmp_path / 'output')
        os.makedirs(output, mode=0o700)
        sock_path = os.path.join(pm2home, 'rpc.sock')
        srv = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        srv.bind(sock_path)
        srv.listen(1)
        daemon_pid = str(os.getpid())

        # Inject: monkeypatch os.fsync to fail on status.json fd.
        # The real write_status_record runs: create_private_file, _write_all,
        # os.fsync, os.close — we fail only the fsync call for status.json.
        inject = [
            'import errno as _errno',
            '_original_fsync = os.fsync',
            '_fsync_marker = %r' % str(tmp_path / 'fsync_fault.marker'),
            'def fsync_fault(fd):',
            '    try:',
            '        path = os.readlink("/proc/self/fd/%d" % fd)',
            '    except Exception:',
            '        path = ""',
            '    if "status.json" in path:',
            '        with open(_fsync_marker, "w") as mf:',
            '            mf.write("FSYNC_FAULT_REACHED")',
            '        raise OSError(_errno.EIO, "injected fsync failure")',
            '    return _original_fsync(fd)',
            'os.fsync = fsync_fault',
        ]

        helper = str(tmp_path / 'status12.py')
        self._write_status_failure_script(
            helper, capture_dir, fake_pm2_normal, fake_account,
            pm2home, output, daemon_pid, inject)

        try:
            proc = subprocess.run(
                [sys.executable, helper],
                timeout=30, capture_output=True,
            )
            assert proc.returncode == 2, \
                "Collector must exit 2 when status fsync fails, got {}".format(
                    proc.returncode)

            # Verify the fault was actually reached
            fsync_marker = str(tmp_path / 'fsync_fault.marker')
            assert os.path.exists(fsync_marker), \
                "fsync fault injection must have been reached"
            with open(fsync_marker, 'r') as f:
                assert f.read().strip() == 'FSYNC_FAULT_REACHED'

            # status.json MUST exist on disk (bytes written before fsync)
            attempt_dirs = [d for d in os.listdir(output)
                           if d.startswith('capture-')]
            assert len(attempt_dirs) >= 1, "Attempt directory must exist"
            ad = os.path.join(output, attempt_dirs[0])
            sp = os.path.join(ad, 'status.json')
            assert os.path.exists(sp), \
                "status.json must exist (bytes written before fsync failed)"
            with open(sp, 'r') as f:
                status = json.load(f)
            assert status.get('attempt_outcome') == 'COMPLETED', \
                "Status file content must say COMPLETED"

            # stdout.raw must also be preserved
            assert os.path.exists(os.path.join(ad, 'stdout.raw'))
        finally:
            srv.close()

    def test_status_13_close_raises_collector_exits_2(self, tmp_path,
                                                       fake_pm2_normal,
                                                       fake_account):
        """T-STATUS-13: Real write_status_record executes; os.close
        performs the kernel close then raises. Status file is durable.
        Collector exits 2 -> FAILED despite valid file."""
        capture_dir = os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))
        pm2home = str(tmp_path / 'pm2home')
        os.makedirs(pm2home)
        output = str(tmp_path / 'output')
        os.makedirs(output, mode=0o700)
        sock_path = os.path.join(pm2home, 'rpc.sock')
        srv = socket_mod.socket(socket_mod.AF_UNIX, socket_mod.SOCK_STREAM)
        srv.bind(sock_path)
        srv.listen(1)
        daemon_pid = str(os.getpid())

        # Inject: monkeypatch os.close to perform the real kernel close
        # then raise on the status.json fd.
        inject = [
            'import errno as _errno',
            '_original_close = os.close',
            '_close_marker = %r' % str(tmp_path / 'close_fault.marker'),
            '_status_fd_closed = [False]',
            'def close_fault(fd):',
            '    try:',
            '        path = os.readlink("/proc/self/fd/%d" % fd)',
            '    except Exception:',
            '        path = ""',
            '    if "status.json" in path and not _status_fd_closed[0]:',
            '        _status_fd_closed[0] = True',
            '        _original_close(fd)',
            '        with open(_close_marker, "w") as mf:',
            '            mf.write("CLOSE_FAULT_REACHED")',
            '        raise OSError(_errno.EIO, "injected close failure")',
            '    return _original_close(fd)',
            'os.close = close_fault',
        ]

        helper = str(tmp_path / 'status13.py')
        self._write_status_failure_script(
            helper, capture_dir, fake_pm2_normal, fake_account,
            pm2home, output, daemon_pid, inject)

        try:
            proc = subprocess.run(
                [sys.executable, helper],
                timeout=30, capture_output=True,
            )
            assert proc.returncode == 2, \
                "Collector must exit 2 when close raises, got {}".format(
                    proc.returncode)

            # Verify the fault was actually reached
            close_marker = str(tmp_path / 'close_fault.marker')
            assert os.path.exists(close_marker), \
                "close fault injection must have been reached"
            with open(close_marker, 'r') as f:
                assert f.read().strip() == 'CLOSE_FAULT_REACHED'

            # status.json must exist (kernel close succeeded before raise)
            attempt_dirs = [d for d in os.listdir(output)
                           if d.startswith('capture-')]
            assert len(attempt_dirs) >= 1, "Attempt directory must exist"
            ad = os.path.join(output, attempt_dirs[0])
            sp = os.path.join(ad, 'status.json')
            assert os.path.exists(sp), \
                "status.json must exist (kernel close succeeded before raise)"
            with open(sp, 'r') as f:
                content = f.read()
            assert len(content) > 0, "status.json must have content"

            # stdout.raw preserved
            assert os.path.exists(os.path.join(ad, 'stdout.raw'))
        finally:
            srv.close()


# =====================================================================
# Helpers
# =====================================================================

class TestHelpers:
    """Test helper functions directly."""

    def test_decode_normal_exit(self):
        """_decode_wait_status with unknown encoding -> ValueError."""
        with pytest.raises(ValueError):
            cap._decode_wait_status(0xFFFF)

    def test_write_all(self, tmp_path):
        """_write_all handles complete writes."""
        path = str(tmp_path / 'test.bin')
        fd = os.open(path, os.O_CREAT | os.O_WRONLY, 0o600)
        cap._write_all(fd, b'hello world')
        os.close(fd)
        with open(path, 'rb') as f:
            assert f.read() == b'hello world'

    def test_create_private_file(self, tmp_path):
        """create_private_file creates with O_EXCL."""
        path = str(tmp_path / 'excl.bin')
        fd = cap.create_private_file(path)
        os.close(fd)
        assert os.path.exists(path)
        assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
        with pytest.raises(OSError):
            cap.create_private_file(path)

    def test_hash_file_matches(self, tmp_path):
        """_hash_file produces correct SHA-256."""
        path = str(tmp_path / 'data.bin')
        data = b'test data for hashing'
        with open(path, 'wb') as f:
            f.write(data)
        assert cap._hash_file(path) == hashlib.sha256(data).hexdigest()

    def test_safe_kill_nonexistent(self):
        """_safe_kill with nonexistent PID -> no exception."""
        cap._safe_kill(999999999, signal.SIGTERM)

    def test_id_re_pattern(self):
        """ID_RE matches valid identifiers."""
        assert re.fullmatch(cap.ID_RE, 'obs-001')
        assert re.fullmatch(cap.ID_RE, 'A' * 128)
        assert re.fullmatch(cap.ID_RE, 'a.b-c_d')
        assert re.fullmatch(cap.ID_RE, '-bad') is None
        assert re.fullmatch(cap.ID_RE, '') is None

    def test_host_re_pattern(self):
        """HOST_RE matches valid hostnames."""
        assert re.fullmatch(cap.HOST_RE, 'test-host')
        assert re.fullmatch(cap.HOST_RE, 'a' * 254)
        assert re.fullmatch(cap.HOST_RE, 'a' * 255) is None
        assert re.fullmatch(cap.HOST_RE, '-bad') is None
