#!/usr/bin/env python3
"""Isolated operator-bundle tests. Does not run accepted canary suites."""

from __future__ import annotations

import hashlib
import json
import os
import signal
import socket
import struct
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "lib"
BIN = ROOT / "bin"
VALID_ROUTE_TABLE = "default via 172.26.0.1 dev ens5 proto static\n"
VALID_ROUTE_TABLE_LO = (
    "default via 172.26.0.1 dev ens5 proto static\n"
    "127.0.0.0/8 dev lo proto kernel scope host src 127.0.0.1\n"
)
VALID_ROUTE_TABLE_V6_DEFAULT = "default via fe80::1 dev ens5 proto static\n"
sys.path.insert(0, str(LIB))

_TEST_HOST = socket.gethostname()


def _ev_hash(text: str) -> str:
    """SHA-256 hex digest for evidence output binding."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _make_evidence(
    ipv4_output=None,
    ipv6_output=None,
    ipv4_success=True,
    ipv6_success=True,
    include_ipv4=True,
    include_ipv6=True,
    hostname=None,
    checked_at_unix=None,
    ipv4_hash=None,
    ipv6_hash=None,
    ipv4_inspection=None,
    ipv6_inspection=None,
):
    """Build a coverage evidence dict for tests."""
    if ipv4_output is None:
        ipv4_output = VALID_ROUTE_TABLE
    if ipv6_output is None:
        ipv6_output = ""
    ev = {
        "schema": "AISB_01C6A_COVERAGE_EVIDENCE_V1",
        "hostname": hostname or _TEST_HOST,
        "checked_at_unix": checked_at_unix if checked_at_unix is not None else time.time(),
    }
    if include_ipv4:
        ev["ipv4"] = {
            "inspection": ipv4_inspection or "ip route show",
            "success": ipv4_success,
            "output_sha256": ipv4_hash or _ev_hash(ipv4_output),
        }
    if include_ipv6:
        ev["ipv6"] = {
            "inspection": ipv6_inspection or "ip -6 route show",
            "success": ipv6_success,
            "output_sha256": ipv6_hash or _ev_hash(ipv6_output),
        }
    return ev


def _cov(route=None, v6="", **evidence_kw):
    """Explicit IPv4+IPv6 coverage kwargs. Does not bypass validation."""
    if route is None:
        route = VALID_ROUTE_TABLE
    return {
        "route_table": route,
        "route_table_v6": v6,
        "evidence": _make_evidence(ipv4_output=route, ipv6_output=v6, **evidence_kw),
    }

from capture import (  # noqa: E402
    CaptureAdapter,
    CaptureHandle,
    start_capture,
    stop_capture,
    resolver_needs_loopback,
)
from cleanup_contract import CleanupPlan, may_remove_canary_failed_job, key_revoke_action, session_terminate_action
from config_deadlines import outer_timeout_ms, parse_wait_ms
from drop_stats import parse_tcpdump_stderr
from network_evidence import Flow, classify_network
from orchestrate import orchestrate
from overlay_restore import Pm2Adapter, restore_overlays
from pcap_validate import parse_pcap_records, validate_pcap_file
from reconcile import (
    EXIT_ACK_UNKNOWN,
    EXIT_TIMEOUT,
    RecordedIds,
    SubmitterOutcome,
    build_reconcile_env,
    decide_terminal,
    extract_recorded_ids,
    run_readonly_reconcile,
)
from supervise import ProcAdapter, ProcessIdentity, supervise
from vault import write_vault, load_metadata, PROTECTED_NAMES


def le_pcap(packets: list[bytes]) -> bytes:
    header = struct.pack("<IHHIIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    recs = [header]
    for pkt in packets:
        recs.append(struct.pack("<IIII", 0, 0, len(pkt), len(pkt)))
        recs.append(pkt)
    return b"".join(recs)


class MemoryPm2(Pm2Adapter):
    def __init__(self) -> None:
        self.apps: dict[str, dict[str, str | None]] = {}

    def restart_update_env(self, app: str, env: dict[str, str | None]) -> None:
        cur = dict(self.apps.get(app, {}))
        for key, value in env.items():
            if value is None:
                raise TypeError("PM2 merge cannot unset %s" % key)
            cur[key] = value
        self.apps[app] = cur

    def dump_env(self, app: str) -> dict[str, str | None]:
        return dict(self.apps[app])


class FakeProc(ProcAdapter):
    def __init__(self) -> None:
        self.next_pid = 2000
        self.procs: dict[int, dict] = {}
        self.signals: list[tuple[int, int]] = []
        self.group_signals: list[tuple[int, int]] = []
        self.next_behavior: dict = {
            "exit_code": 0,
            "immediate": True,
            "stdout": "",
            "stderr": "",
            "pgid_equals_pid": True,
            "cmdline_extra": "",
        }
        self.spawn_calls: list[list[str]] = []

    def spawn(self, argv, env, new_session: bool) -> int:
        self.spawn_calls.append(list(argv))
        pid = self.next_pid
        self.next_pid += 1
        b = dict(self.next_behavior)
        cmdline = " ".join(argv) + b.get("cmdline_extra", "")
        pgid = pid if b.get("pgid_equals_pid", True) else pid + 7
        self.procs[pid] = {
            "argv": list(argv),
            "env": dict(env),
            "cmdline": cmdline,
            "pgid": pgid,
            "alive": not b.get("immediate"),
            "exit": b.get("exit_code", 0) if b.get("immediate") else None,
            "stdout": b.get("stdout", ""),
            "stderr": b.get("stderr", ""),
            "members": b.get("members", [pid]),
            "survive_kill": b.get("survive_kill", False),
        }
        return pid

    def wait_nonblocking(self, pid: int):
        p = self.procs[pid]
        if p.get("raise_interrupt"):
            p["raise_interrupt"] = False
            raise KeyboardInterrupt
        return p["exit"]

    def cmdline(self, pid: int) -> str:
        return self.procs[pid]["cmdline"]

    def pgid(self, pid: int):
        return self.procs[pid]["pgid"]

    def group_members(self, pgid: int) -> list[int]:
        out = []
        for pid, p in self.procs.items():
            if p["pgid"] == pgid:
                out.extend(p.get("members", [pid]))
        return sorted(set(out))

    def send_signal(self, pid: int, sig: int) -> None:
        self.signals.append((pid, sig))
        if pid in self.procs:
            self.procs[pid]["alive"] = False
            if self.procs[pid]["exit"] is None:
                self.procs[pid]["exit"] = 137 if sig == getattr(signal, "SIGKILL", None) else 143

    def send_group_signal(self, pgid: int, sig: int) -> None:
        if pgid in (0, 1):
            raise RuntimeError("refusing init")
        self.group_signals.append((pgid, sig))
        for pid, p in self.procs.items():
            if p["pgid"] == pgid:
                if not p.get("survive_kill"):
                    p["alive"] = False
                    if p["exit"] is None:
                        p["exit"] = 137

    def alive(self, pid: int) -> bool:
        p = self.procs.get(pid)
        if not p:
            return False
        return bool(p["alive"])

    def read_stdout(self, pid: int) -> str:
        return self.procs[pid]["stdout"]

    def read_stderr(self, pid: int) -> str:
        return self.procs[pid]["stderr"]


class FakeCapture(CaptureAdapter):
    def __init__(self) -> None:
        self.next_pid = 8000
        self.alive_set: set[int] = set()
        self.cmd: dict[int, str] = {}
        self.argv: dict[int, list[str]] = {}
        self.start_ids: dict[int, str] = {}
        self.stderr: dict[int, str] = {}
        self.signals: list[tuple[int, int, bool]] = []
        self.read_rc = 0
        self.listen = True
        self.pidfile_ok = True
        self.kernel_drop = 0
        self.survive = False
        self.read_hook = None

    def start(self, iface, bpf, pcap_path, stderr_path, stdout_path, pidfile, exec_helper):
        pid = self.next_pid
        self.next_pid += 1
        sudo_pid = pid + 90000
        if self.pidfile_ok:
            Path(pidfile).write_text(str(pid) + "\n", encoding="utf-8")
        else:
            Path(pidfile).write_text("1\n", encoding="utf-8")
        argv = ["/usr/bin/tcpdump", "-nn", "-i", str(iface), "-U", "-w", str(pcap_path), *str(bpf).split()]
        self.argv[pid] = argv
        self.cmd[pid] = " ".join(argv)
        sid = f"{pid}:fake-start"
        self.start_ids[pid] = sid
        ident = {
            "tcpdump_pid": pid,
            "sudo_parent_pid": sudo_pid,
            "pidfile": pidfile,
            "pcap_path": pcap_path,
            "iface": iface,
            "tcpdump_argv": argv,
            "tcpdump_cmdline": self.cmd[pid],
            "start_identity": sid,
        }
        Path(pidfile + ".identity.json").write_text(json.dumps(ident) + "\n", encoding="utf-8")
        text = f"tcpdump: listening on {iface}, link-type EN10MB (Ethernet)\n" if self.listen else "permission denied\n"
        Path(stderr_path).write_text(text, encoding="utf-8")
        Path(pcap_path).write_bytes(le_pcap([]))
        self.alive_set.add(pid)
        self.stderr[pid] = stderr_path
        return pid, sudo_pid

    def alive(self, pid: int) -> bool:
        return pid in self.alive_set

    def cmdline(self, pid: int) -> str:
        return self.cmd[pid]

    def live_argv(self, pid: int) -> list[str]:
        if pid in self.argv:
            return list(self.argv[pid])
        return self.cmd[pid].split()

    def live_start_identity(self, pid: int) -> str:
        return self.start_ids[pid]

    def ppid(self, pid: int):
        return pid + 90000

    def pgid(self, pid: int):
        return pid

    def send(self, pid: int, sig: int, privileged: bool, **kwargs) -> None:
        self.signals.append((pid, sig, privileged))
        if sig == signal.SIGINT and not self.survive:
            err = self.stderr.get(pid)
            if err:
                with open(err, "a", encoding="utf-8") as f:
                    f.write("0 packets captured\n0 packets received by filter\n")
                    f.write(f"{self.kernel_drop} packets dropped by kernel\n")
            self.alive_set.discard(pid)
        if sig in (signal.SIGTERM, getattr(signal, "SIGKILL", signal.SIGTERM)) and not self.survive:
            self.alive_set.discard(pid)

    def tcpdump_read(self, pcap_path: str, err_path: str, timeout_sec: float | None = None) -> int:
        if self.read_hook:
            self.read_hook(pcap_path, timeout_sec)
        Path(err_path).write_text("", encoding="utf-8")
        return self.read_rc


class PcapTests(unittest.TestCase):
    def test_packet_records_empty_ok(self) -> None:
        data = le_pcap([])
        self.assertEqual(parse_pcap_records(data), 0)

    def test_truncated_record_fails(self) -> None:
        data = le_pcap([b"\x00\x01\x02\x03"])[:-2]
        with self.assertRaises(Exception) as ctx:
            parse_pcap_records(data)
        self.assertIn("TRUNCATED", ctx.exception.code)

    def test_bytes_to_eof_not_enough_when_tcpdump_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "a.pcap"
            pcap.write_bytes(le_pcap([b"\x00\x01\x02\x03"]))
            err = Path(td) / "err"
            err.write_text("tcpdump: truncated dump file\n")
            result = validate_pcap_file(str(pcap), tcpdump_rc=1, tcpdump_err_path=str(err))
            self.assertFalse(result.ok)
            self.assertEqual(result.code, "TCPDUMP_READ_NONZERO")

    def test_heredoc_argv_passing(self) -> None:
        data = le_pcap([b"ABCD"])
        with tempfile.TemporaryDirectory() as td:
            pcap = str(Path(td) / "x.pcap")
            Path(pcap).write_bytes(data)
            script = r"""
import sys
sys.path.insert(0, sys.argv[4])
from pcap_validate import validate_pcap_file
assert sys.argv[1].endswith("x.pcap"), sys.argv
result = validate_pcap_file(sys.argv[1], tcpdump_rc=int(sys.argv[2]), tcpdump_err_path=sys.argv[3] or None)
raise SystemExit(0 if result.ok else 1)
"""
            import subprocess

            proc = subprocess.run(
                [sys.executable, "-", pcap, "0", "", str(LIB)],
                input=script,
                text=True,
                cwd=str(ROOT),
            )
            self.assertEqual(proc.returncode, 0)
            proc_fail = subprocess.run(
                [sys.executable, "-", pcap, "7", "", str(LIB)],
                input=script,
                text=True,
            )
            self.assertEqual(proc_fail.returncode, 1)


class TerminalVsSubmitterTests(unittest.TestCase):
    def test_ack_unknown_does_not_start_tail(self) -> None:
        stdout = json.dumps({"event": "stub_identifiers_recorded", "executionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"})
        outcome = SubmitterOutcome(
            exit_code=EXIT_ACK_UNKNOWN,
            killed=False,
            timed_out=False,
            identity_failed=False,
            stdout=stdout,
            stderr="",
            ids=extract_recorded_ids(stdout, "", "stub"),
        )
        d = decide_terminal(outcome)
        self.assertFalse(d.start_capture_tail)
        self.assertTrue(d.require_reconcile)
        self.assertTrue(d.prohibit_next_canary)
        self.assertEqual(d.classification, "INCOMPLETE")

    def test_timeout_and_killed_do_not_start_tail(self) -> None:
        ids = RecordedIds(execution_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", which="stub")
        for kwargs in (
            dict(exit_code=EXIT_TIMEOUT, killed=False, timed_out=True, identity_failed=False),
            dict(exit_code=None, killed=True, timed_out=False, identity_failed=False),
        ):
            d = decide_terminal(SubmitterOutcome(stdout="", stderr="", ids=ids, **kwargs))
            self.assertFalse(d.start_capture_tail)
            self.assertTrue(d.prohibit_next_canary)

    def test_reconcile_env_never_live_submit(self) -> None:
        ids = RecordedIds(
            execution_id="cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            request_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            which="xai",
        )
        env = build_reconcile_env({"AISB_01C6A_LIVE_SUBMIT": "YES", "FOO": "1"}, ids, "xai")
        self.assertNotIn("AISB_01C6A_LIVE_SUBMIT", env)
        self.assertEqual(env["AISB_01C6A_RECONCILE"], "YES")
        self.assertNotEqual(env.get("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED"), "YES")

    def test_reconcile_env_does_not_default_staging_auth(self) -> None:
        ids = RecordedIds(execution_id="cccccccc-cccc-4ccc-8ccc-cccccccccccc", which="stub")
        env = build_reconcile_env({}, ids, "stub")
        self.assertNotIn("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED", env)

    def test_reconcile_incomplete_prohibits_next(self) -> None:
        ids = RecordedIds(execution_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", which="stub")

        def runner(env, timeout_ms):
            self.assertNotIn("AISB_01C6A_LIVE_SUBMIT", env)
            self.assertEqual(env["AISB_01C6A_RECONCILE_EXECUTION_ID"], ids.execution_id)
            return (3, '{"event":"stub_canary_result","outcome":"incomplete"}\n', "", False, False)

        rec = run_readonly_reconcile("stub", ids, {}, 1000, runner)
        self.assertFalse(rec.execution_terminal)
        self.assertTrue(rec.prohibit_next_canary)
        self.assertFalse(rec.start_capture_tail)


class SuperviseTests(unittest.TestCase):
    def test_deadline_from_validated_config(self) -> None:
        env = {"AISB_01C6A_WAIT_MS": "20000", "AISB_01C6A_OP_TIMEOUT_MS": "8000", "AISB_01C6A_SHUTDOWN_TIMEOUT_MS": "5000"}
        self.assertEqual(outer_timeout_ms(env), 69000)
        with self.assertRaises(Exception):
            parse_wait_ms({"AISB_01C6A_WAIT_MS": "0"})

    def test_identity_failure_reaps_and_does_not_abandon(self) -> None:
        proc = FakeProc()
        proc.next_behavior = {
            "immediate": False,
            "exit_code": None,
            "pgid_equals_pid": False,
            "stdout": "",
            "stderr": "",
        }
        result = supervise(
            ["/usr/bin/node", "/tmp/canary.js"],
            {},
            timeout_ms=1000,
            expected_js="/tmp/canary.js",
            proc=proc,
            now=lambda: 0,
        )
        self.assertTrue(result.identity_failed)
        self.assertFalse(result.abandoned)
        self.assertTrue(result.killed)
        self.assertTrue(proc.signals or proc.group_signals)

    def test_timeout_kills_owned_group(self) -> None:
        proc = FakeProc()
        proc.next_behavior = {"immediate": False, "exit_code": None, "stdout": "", "stderr": ""}
        t = {"n": 0}

        def now():
            t["n"] += 10000
            return t["n"]

        result = supervise(
            ["/usr/bin/node", "/tmp/canary.js"],
            {},
            timeout_ms=5000,
            expected_js="/tmp/canary.js",
            proc=proc,
            now=now,
        )
        self.assertTrue(result.timed_out)
        self.assertTrue(result.killed)
        self.assertFalse(result.abandoned)

    def test_interrupt_does_not_abandon(self) -> None:
        proc = FakeProc()
        proc.next_behavior = {"immediate": False, "exit_code": None, "stdout": "", "stderr": ""}

        def wait_then_interrupt(pid):
            raise KeyboardInterrupt

        proc.wait_nonblocking = wait_then_interrupt  # type: ignore[method-assign]
        result = supervise(
            ["/usr/bin/node", "/tmp/canary.js"],
            {},
            timeout_ms=50000,
            expected_js="/tmp/canary.js",
            proc=proc,
        )
        self.assertTrue(result.interrupted)
        self.assertFalse(result.abandoned)

    def test_surviving_member_recorded(self) -> None:
        proc = FakeProc()
        proc.next_behavior = {
            "immediate": False,
            "exit_code": None,
            "stdout": "",
            "stderr": "",
            "survive_kill": True,
            "members": [2000, 2001],
        }
        # spawn uses 2000 first
        t = {"n": 0}

        def now():
            t["n"] += 20000
            return t["n"]

        result = supervise(
            ["/usr/bin/node", "/tmp/canary.js"],
            {},
            timeout_ms=1000,
            expected_js="/tmp/canary.js",
            proc=proc,
            now=now,
        )
        self.assertTrue(result.timed_out)
        self.assertTrue(result.surviving_pids)


class CaptureTests(unittest.TestCase):
    def test_listen_before_ready_and_pidfile_identity(self) -> None:
        cap = FakeCapture()
        with tempfile.TemporaryDirectory() as td:
            h = start_capture("t-ens5", "ens5", "tcp port 443", td, "helper", cap)
            self.assertTrue(h.listening)
            self.assertNotEqual(h.tcpdump_pid, h.sudo_parent_pid)
            self.assertIn("/usr/bin/tcpdump", cap.cmd[h.tcpdump_pid])

    def test_pidfile_mismatch_is_failure(self) -> None:
        cap = FakeCapture()
        cap.pidfile_ok = False
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(Exception) as ctx:
                start_capture("t-ens5", "ens5", "tcp port 443", td, "helper", cap)
            self.assertEqual(ctx.exception.code, "PIDFILE_MISMATCH")

    def test_loopback_needed_for_stub_resolver(self) -> None:
        self.assertTrue(resolver_needs_loopback("nameserver 127.0.0.53\n"))
        self.assertFalse(resolver_needs_loopback("nameserver 172.26.0.1\n"))

    def test_drop_stats_and_nonzero_read(self) -> None:
        stats = parse_tcpdump_stderr("1 packets captured\n1 packets received by filter\n2 packets dropped by kernel\n")
        self.assertFalse(stats.ok)
        cap = FakeCapture()
        cap.read_rc = 1
        with tempfile.TemporaryDirectory() as td:
            h = start_capture("t-ens5", "ens5", "tcp port 443", td, "helper", cap)
            sr = stop_capture(h, cap, tail_sec=0)
            self.assertFalse(sr.ok)
            self.assertEqual(sr.code, "TCPDUMP_READ_NONZERO")
            self.assertTrue(any(s[2] for s in cap.signals))  # privileged shutdown


class NetworkEvidenceTests(unittest.TestCase):
    def test_script_field_stays_not_established(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=True,
            lifecycle_reason="OK",
            flows=[],
            xai_addrs={"104.18.18.80"},
            ss_before={"1.2.3.4:443"},
            dns_qnames=[],
        )
        self.assertEqual(ev.script_provider_traffic_proof, "NOT_ESTABLISHED")
        self.assertEqual(ev.independent_result, "PASS")

    def test_ss_before_does_not_attribute_https(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=True,
            lifecycle_reason="OK",
            flows=[Flow("10.0.0.5", "1.2.3.4", 5555, 443, "tcp")],
            xai_addrs={"104.18.18.80"},
            ss_before={"1.2.3.4:443"},
            dns_qnames=[],
        )
        self.assertEqual(ev.independent_result, "INCOMPLETE")
        self.assertIn("UNEXPLAINED_HTTPS", ev.reasons)

    def test_doh_unresolved(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=True,
            lifecycle_reason="OK",
            flows=[Flow("10.0.0.5", "1.1.1.1", 3333, 853, "tcp")],
            xai_addrs={"104.18.18.80"},
            ss_before=set(),
            dns_qnames=[],
        )
        self.assertEqual(ev.independent_result, "INCOMPLETE")
        self.assertIn("ENCRYPTED_DNS_UNRESOLVED", ev.reasons)

    def test_missing_lifecycle_never_pass(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=False,
            lifecycle_reason="NOT_LISTENING",
            flows=[],
            xai_addrs=set(),
            ss_before=set(),
            dns_qnames=[],
        )
        self.assertEqual(ev.independent_result, "INCOMPLETE")


class OverlayTests(unittest.TestCase):
    def test_hmac_absent_empty_requires_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            write_vault(
                td,
                {
                    "HARNESS_ENTITLEMENT_HMAC_SECRET": None,
                    "GLOBAL_EXECUTION_ENABLED": "false",
                    "XAI_API_KEY": "dummy-not-real",
                },
            )
            meta = load_metadata(td)
            self.assertTrue(meta["HARNESS_ENTITLEMENT_HMAC_SECRET"]["secret"])
            self.assertIn("XAI_API_KEY", PROTECTED_NAMES)
            self.assertEqual(meta["GLOBAL_EXECUTION_ENABLED"]["value"], "false")
            pm2 = MemoryPm2()
            pm2.apps["gw"] = {"HARNESS_ENTITLEMENT_HMAC_SECRET": "overlay-secret", "GLOBAL_EXECUTION_ENABLED": "true"}
            result = restore_overlays(td, ["gw"], pm2, hmac_absent_empty_authorized=False)
            self.assertFalse(result.ok)
            self.assertTrue(result.pending_hmac_authorization)
            self.assertTrue(result.preserved_vault)
            self.assertTrue(Path(td, "metadata.json").is_file())

    def test_hmac_exception_not_extended_to_other_absent(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            write_vault(
                td,
                {
                    "HARNESS_ENTITLEMENT_HMAC_SECRET": None,
                    "WRITE_ENABLED": None,
                    "GLOBAL_EXECUTION_ENABLED": "false",
                },
            )
            pm2 = MemoryPm2()
            pm2.apps["gw"] = {
                "HARNESS_ENTITLEMENT_HMAC_SECRET": "overlay",
                "WRITE_ENABLED": "true",
                "GLOBAL_EXECUTION_ENABLED": "true",
            }
            result = restore_overlays(td, ["gw"], pm2, hmac_absent_empty_authorized=True)
            self.assertFalse(result.ok)
            self.assertIn("UNSUPPORTED_ABSENT", result.message)
            self.assertEqual(pm2.apps["gw"].get("HARNESS_ENTITLEMENT_HMAC_SECRET"), "overlay")
            self.assertEqual(pm2.apps["gw"].get("WRITE_ENABLED"), "true")
            self.assertEqual(pm2.apps["gw"]["GLOBAL_EXECUTION_ENABLED"], "true")

    def test_mismatch_preserves_vault(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            write_vault(td, {"GLOBAL_EXECUTION_ENABLED": "false"})
            pm2 = MemoryPm2()
            pm2.apps["gw"] = {"GLOBAL_EXECUTION_ENABLED": "false"}

            class BadPm2(MemoryPm2):
                def dump_env(self, app):
                    return {"GLOBAL_EXECUTION_ENABLED": "true"}

            bad = BadPm2()
            bad.apps = pm2.apps
            result = restore_overlays(td, ["gw"], bad, hmac_absent_empty_authorized=True)
            self.assertFalse(result.ok)
            self.assertTrue(result.preserved_vault)


class CleanupTests(unittest.TestCase):
    def test_baseline_jobs_untouched(self) -> None:
        plan = CleanupPlan(evidence_captured=True, canary_failed_job_removal_authorized=True, canary_failed_job_ids=["99"])
        self.assertFalse(may_remove_canary_failed_job(plan, 1).allowed)
        self.assertFalse(may_remove_canary_failed_job(plan, "2").allowed)
        self.assertTrue(may_remove_canary_failed_job(plan, "99").allowed)
        self.assertFalse(may_remove_canary_failed_job(CleanupPlan(evidence_captured=True), "99").allowed)
        self.assertEqual(key_revoke_action("abc").code, "DELETE_KEY")
        self.assertIn("/api/keys/abc", key_revoke_action("abc").message)
        self.assertIn("/api/sessions/s1", session_terminate_action("s1").message)


class OrchestrateFailurePathTests(unittest.TestCase):
    def _common(self, td: str, proc: FakeProc, cap: FakeCapture):
        vault = Path(td) / "vault"
        vault.mkdir()
        work = Path(td) / "work"
        work.mkdir()
        pm2 = MemoryPm2()
        pm2.apps["aisandbox-api-gateway"] = {"GLOBAL_EXECUTION_ENABLED": "false"}
        pm2.apps["aisandbox-ai-service"] = {"GLOBAL_EXECUTION_ENABLED": "false"}
        deleted = {"n": 0}

        def apply_overlays():
            pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"] = "true"

        def delete_vault():
            deleted["n"] += 1

        return vault, work, pm2, apply_overlays, delete_vault, deleted

    def test_ack_unknown_restores_no_tail_no_next(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            stdout = json.dumps(
                {
                    "event": "stub_identifiers_recorded",
                    "executionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                }
            )
            proc.next_behavior = {
                "immediate": True,
                "exit_code": EXIT_ACK_UNKNOWN,
                "stdout": stdout,
                "stderr": "",
            }
            cap = FakeCapture()
            vault, work, pm2, apply_overlays, delete_vault, deleted = self._common(td, proc, cap)

            def runner(env, timeout_ms):
                self.assertNotIn("AISB_01C6A_LIVE_SUBMIT", env)
                self.assertTrue(cap.alive_set, "capture must remain running during reconcile")
                return (3, '{"outcome":"incomplete"}\n', "", False, False)

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={"AISB_01C6A_LIVE_SUBMIT": "YES"},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=runner,
                flows=[],
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=[],
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(result.capture_tail_started)
            self.assertTrue(result.overlays_restored)
            self.assertFalse(result.next_canary_allowed)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertEqual(result.script_provider_traffic_proof, "NOT_ESTABLISHED")
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(deleted["n"], 1)

    def test_capture_start_fail_still_restores(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            cap.listen = False
            vault, work, pm2, apply_overlays, delete_vault, deleted = self._common(td, proc, cap)
            result = orchestrate(
                which="xai",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "x.js")],
                submit_env={},
                expected_js=str(work / "x.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 127.0.0.53\n",
                **_cov(VALID_ROUTE_TABLE_LO),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, t: (3, "", "", False, False),
                flows=[],
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=[],
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertTrue(result.overlays_restored)
            self.assertFalse(result.next_canary_allowed)
            self.assertFalse(result.capture_tail_started)
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")


class ManifestTests(unittest.TestCase):
    def test_every_helper_listed(self) -> None:
        manifest = ROOT / "TRANSFER.manifest"
        self.assertTrue(manifest.is_file(), "TRANSFER.manifest must exist")
        sys.path.insert(0, str(BIN))
        import importlib.util

        spec = importlib.util.spec_from_file_location("verify_transfer", BIN / "verify-transfer.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        rc = mod.verify(ROOT, manifest)
        self.assertEqual(rc, 0)


class MockPm2CliTests(unittest.TestCase):
    def test_mock_pm2_restart_update_env(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            state = Path(td) / "state.json"
            Path(state).write_text(
                json.dumps(
                    {
                        "apps": {
                            "gw": {
                                "GLOBAL_EXECUTION_ENABLED": "false",
                                "HARNESS_ENTITLEMENT_HMAC_SECRET": "keep-me",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["MOCK_PM2_STATE"] = str(state)
            env["GLOBAL_EXECUTION_ENABLED"] = "true"
            subprocess.check_call([sys.executable, str(BIN / "mock-pm2.py"), "restart", "gw", "--update-env"], env=env)
            out = subprocess.check_output([sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True)
            apps = json.loads(out)
            self.assertEqual(apps[0]["pm2_env"]["GLOBAL_EXECUTION_ENABLED"], "true")
            self.assertEqual(apps[0]["pm2_env"]["HARNESS_ENTITLEMENT_HMAC_SECRET"], "keep-me")


def _eth_ipv4_tcp(src="10.0.0.5", dst="1.2.3.4", sport=5555, dport=443) -> bytes:
    import ipaddress

    eth = b"\x00" * 6 + b"\x11" * 6 + b"\x08\x00"
    sip = ipaddress.IPv4Address(src).packed
    dip = ipaddress.IPv4Address(dst).packed
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 40, 0, 0, 64, 6, 0, sip, dip)
    tcp = struct.pack("!HH", sport, dport) + b"\x00" * 16
    return eth + ip + tcp


def _stub_result(*, outcome, proof, accounting, job_state, execution_id) -> str:
    return json.dumps(
        {
            "event": "stub_canary_result",
            "outcome": outcome,
            "executionId": execution_id,
            "jobId": "99",
            "jobState": job_state,
            "proofAccepted": proof,
            "accountingEvidence": accounting,
            "usageRecordDeleted": False,
            "failedJobRemoved": False,
            "automaticRetryCount": 0,
        }
    )


class AcceptedScriptGateTests(unittest.TestCase):
    def test_failed_stub_does_not_allow_next_canary(self) -> None:
        from accepted_result import allows_next_canary, parse_accepted_script_result
        from reconcile import RecordedIds

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        stdout = _stub_result(
            outcome="failed", proof="rejected", accounting="unknown", job_state="failed", execution_id=eid
        )
        accepted = parse_accepted_script_result(
            "stub", stdout, "", 1, RecordedIds(execution_id=eid, which="stub")
        )
        self.assertTrue(accepted.execution_terminal)
        self.assertFalse(accepted.intended_accepted)
        self.assertFalse(
            allows_next_canary(
                "stub",
                accepted,
                restore_ok=True,
                overlays_restored=True,
                network_independent="PASS",
            )
        )

    def test_orchestrate_failed_stub_empty_pcap_forbids_xai(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 1,
                "stdout": _stub_result(
                    outcome="failed",
                    proof="rejected",
                    accounting="unknown",
                    job_state="failed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(result.next_canary_allowed)
            self.assertTrue(result.capture_tail_started)
            self.assertEqual(result.network_independent, "PASS")

    def test_intended_stub_allows_next(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 0,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertTrue(result.next_canary_allowed)
            self.assertTrue(result.overlays_restored)
            self.assertEqual(result.network_independent, "PASS")

    def test_cleanup_incomplete_never_allows_next(self) -> None:
        from accepted_result import allows_next_canary, parse_accepted_script_result
        from reconcile import EXIT_CLEANUP_INCOMPLETE, RecordedIds

        eid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
        stdout = _stub_result(
            outcome="completed", proof="accepted", accounting="pass", job_state="completed", execution_id=eid
        )
        accepted = parse_accepted_script_result(
            "stub", stdout, "CLEANUP_INCOMPLETE: pg\n", EXIT_CLEANUP_INCOMPLETE, RecordedIds(execution_id=eid)
        )
        self.assertFalse(accepted.intended_accepted)
        self.assertFalse(
            allows_next_canary("stub", accepted, restore_ok=True, overlays_restored=True, network_independent="PASS")
        )

    def test_unparsed_pcap_is_incomplete(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 0,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)

            orig_start = cap.start

            def start_and_corrupt(*a, **k):
                pid, sudo = orig_start(*a, **k)
                pcap = k.get("pcap_path") or a[2]
                Path(pcap).write_bytes(le_pcap([b"\x00\x01\x02\x03"]))
                return pid, sudo

            cap.start = start_and_corrupt  # type: ignore[method-assign]
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(result.next_canary_allowed)
            self.assertEqual(result.network_independent, "INCOMPLETE")


class OverlayRestoreDriverTests(unittest.TestCase):
    def test_mark_before_apply_restores_after_exception(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _apply, delete_vault, deleted = helper._common(td, proc, cap)

            def apply_partial():
                pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"] = "true"
                raise RuntimeError("partial apply")

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_partial,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertTrue(result.overlays_restored)
            self.assertFalse(result.next_canary_allowed)

    def test_cli_pm2_partial_failure_continues(self) -> None:
        from overlay_restore import CliPm2, restore_overlays

        with tempfile.TemporaryDirectory() as td:
            vault = Path(td) / "vault"
            vault.mkdir()
            write_vault(str(vault), {"GLOBAL_EXECUTION_ENABLED": "false"})
            state = Path(td) / "state.json"
            Path(state).write_text(
                json.dumps(
                    {
                        "apps": {
                            "gw": {"GLOBAL_EXECUTION_ENABLED": "true"},
                            "ai": {"GLOBAL_EXECUTION_ENABLED": "true"},
                        }
                    }
                ),
                encoding="utf-8",
            )
            os.environ["MOCK_PM2_STATE"] = str(state)

            class Flaky(CliPm2):
                def restart_update_env(self, app, envmap):
                    if app == "ai":
                        raise RuntimeError("pm2 fail")
                    return super().restart_update_env(app, envmap)

            pm2 = Flaky(str(BIN / "mock-pm2.py"))
            result = restore_overlays(str(vault), ["gw", "ai"], pm2, hmac_absent_empty_authorized=True)
            self.assertFalse(result.ok)
            self.assertIn("gw", result.apps_restored)
            self.assertIn("ai", result.apps_failed)
            self.assertTrue(result.preserved_vault)
            self.assertTrue(Path(vault, "metadata.json").is_file())

    def test_interrupt_during_restore_attempts_other_apps(self) -> None:
        from overlay_restore import restore_overlays

        with tempfile.TemporaryDirectory() as td:
            write_vault(td, {"GLOBAL_EXECUTION_ENABLED": "false"})
            pm2 = MemoryPm2()
            pm2.apps["gw"] = {"GLOBAL_EXECUTION_ENABLED": "true"}
            pm2.apps["ai"] = {"GLOBAL_EXECUTION_ENABLED": "true"}

            class InterruptFirst(MemoryPm2):
                def restart_update_env(self, app, envmap):
                    if app == "gw":
                        raise KeyboardInterrupt
                    return super().restart_update_env(app, envmap)

            bad = InterruptFirst()
            bad.apps = pm2.apps
            result = restore_overlays(td, ["gw", "ai"], bad, hmac_absent_empty_authorized=True)
            self.assertTrue(result.interrupted)
            self.assertFalse(result.ok)
            self.assertIn("ai", result.apps_restored)
            self.assertEqual(bad.apps["ai"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertTrue(result.preserved_vault)

    def test_cli_pm2_refuses_absent(self) -> None:
        from overlay_restore import CliPm2, UnsupportedAbsentRestore

        pm2 = CliPm2(str(BIN / "mock-pm2.py"))
        with self.assertRaises(UnsupportedAbsentRestore):
            pm2.restart_update_env("gw", {"WRITE_ENABLED": None})


class ReconcileCaptureAndAuthTests(unittest.TestCase):
    def test_reconcile_timeout_no_resubmit_no_next(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            stdout = json.dumps(
                {"event": "stub_identifiers_recorded", "executionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
            )
            proc.next_behavior = {"immediate": True, "exit_code": EXIT_ACK_UNKNOWN, "stdout": stdout, "stderr": ""}
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            called = {"n": 0}

            def runner(env, timeout_ms):
                called["n"] += 1
                self.assertTrue(cap.alive_set)
                self.assertNotIn("AISB_01C6A_LIVE_SUBMIT", env)
                return (5, "", "", True, False)

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=runner,
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(called["n"], 1)
            self.assertFalse(result.capture_tail_started)
            self.assertFalse(result.next_canary_allowed)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("RECONCILE_BOUND_EXPIRED", result.reasons)

    def test_reconcile_cli_requires_auth_for_live_node(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            ids = Path(td) / "ids.json"
            ids.write_text(
                json.dumps({"execution_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["PYTHONPATH"] = str(LIB)
            env.pop("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED", None)
            env["NODE_BIN"] = "/usr/bin/node"
            env["AISB_SUDO_BIN"] = str(BIN / "mock-sudo.py")
            env["PM2_BIN"] = str(BIN / "mock-pm2.py")
            env["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "reconcile.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--ids",
                    str(ids),
                    "--js",
                    str(BIN / "mock-node.py"),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(proc.returncode, 0)

    def test_reconcile_cli_invokes_mock_observer(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            ids = Path(td) / "ids.json"
            ids.write_text(
                json.dumps({"execution_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["PYTHONPATH"] = str(LIB)
            env["NODE_BIN"] = str(BIN / "mock-node.py")
            env["AISB_SUDO_BIN"] = str(BIN / "mock-sudo.py")
            env["PM2_BIN"] = str(BIN / "mock-pm2.py")
            env["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
            env["AISB_01C6A_MOCK_NODE_JSON"] = json.dumps(
                {
                    "event": "stub_canary_result",
                    "outcome": "failed",
                    "jobState": "failed",
                    "proofAccepted": "rejected",
                    "executionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "accountingEvidence": "unknown",
                }
            )
            env["AISB_01C6A_MOCK_NODE_EXIT"] = "1"
            env["AISB_01C6A_PROC_LOG_DIR"] = str(Path(td) / "proc")
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "reconcile.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--ids",
                    str(ids),
                    "--js",
                    str(BIN / "mock-node.py"),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertIn("RECONCILE_DONE", proc.stdout)

    def test_stop_cli_signals_and_honors_zero_tail(self) -> None:
        import subprocess
        from capture import persist_handle, start_capture

        cap = FakeCapture()
        with tempfile.TemporaryDirectory() as td:
            h = start_capture("t-ens5", "ens5", "tcp port 443", td, "helper", cap)
            persist_handle(h)
            env = os.environ.copy()
            env["PYTHONPATH"] = str(LIB)
            env["AISB_SUDO_BIN"] = str(BIN / "mock-sudo.py")
            env["PM2_BIN"] = str(BIN / "mock-pm2.py")
            env["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "capture.py"),
                    "stop",
                    "--prep",
                    str(ROOT),
                    "--workdir",
                    td,
                    "--name",
                    "t-ens5",
                    "--tail-sec",
                    "0",
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertIn("CAPTURE_STOP", proc.stdout)


class AdapterBoundaryTests(unittest.TestCase):
    def test_process_exists_eperm_vs_esrch(self) -> None:
        import errno
        from process_alive import process_exists

        def kill_eperm(pid, sig):
            raise PermissionError("EPERM")

        def kill_esrch(pid, sig):
            raise ProcessLookupError("ESRCH")

        def kill_errno_eperm(pid, sig):
            raise OSError(errno.EPERM, "eperm")

        def kill_errno_esrch(pid, sig):
            raise OSError(errno.ESRCH, "esrch")

        self.assertTrue(process_exists(42, kill=kill_eperm))
        self.assertFalse(process_exists(42, kill=kill_esrch))
        self.assertTrue(process_exists(42, kill=kill_errno_eperm))
        self.assertFalse(process_exists(42, kill=kill_errno_esrch))

    def test_linux_proc_file_logs_large_output(self) -> None:
        from supervise import LinuxProc, supervise

        with tempfile.TemporaryDirectory() as td:
            proc = LinuxProc(log_dir=td)
            script = "import sys; sys.stdout.write('X'*200000); sys.stderr.write('E'*1000)"
            result = supervise(
                argv=[sys.executable, "-c", script],
                env=os.environ.copy(),
                timeout_ms=20000,
                expected_js="-c",
                expected_node=sys.executable,
                proc=proc,
            )
            self.assertEqual(result.exit_code, 0)
            self.assertEqual(len(result.stdout), 200000)
            self.assertIn("E", result.stderr)
            self.assertTrue(list(Path(td).glob("*.identity.json")))

    def test_linux_capture_start_failure_cleans_up(self) -> None:
        from linux_capture import LinuxCapture

        td = tempfile.mkdtemp()
        cap = LinuxCapture(str(BIN / "mock-sudo.py"), sys.executable, str(BIN / "tcpdump-exec.py"))
        env_hold = os.environ.get("AISB_TCPDUMP_BIN")
        os.environ["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
        try:
            pcap = str(Path(td) / "x.pcap")
            err = str(Path(td) / "err")
            out = str(Path(td) / "out")
            pidfile = str(Path(td) / "never.pid")
            os.makedirs(pidfile, exist_ok=True)
            with self.assertRaises(Exception):
                cap.start("ens5", "tcp port 443", pcap, err, out, pidfile, str(BIN / "tcpdump-exec.py"))
            self.assertFalse(any(p.poll() is None for p in cap._popens.values()))
        finally:
            if env_hold is None:
                os.environ.pop("AISB_TCPDUMP_BIN", None)
            else:
                os.environ["AISB_TCPDUMP_BIN"] = env_hold
            import shutil

            shutil.rmtree(td, ignore_errors=True)

    def test_linux_capture_alive_and_stop_with_mocks(self) -> None:
        from capture import start_capture, stop_capture
        from linux_capture import LinuxCapture

        td = tempfile.mkdtemp()
        os.environ["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
        cap = LinuxCapture(str(BIN / "mock-sudo.py"), sys.executable, str(BIN / "tcpdump-exec.py"))
        try:
            h = start_capture("live-ens5", "ens5", "tcp port 443", td, str(BIN / "tcpdump-exec.py"), cap)
            self.assertTrue(h.listening)
            self.assertTrue(cap.alive(h.tcpdump_pid))
            sr = stop_capture(h, cap, tail_sec=0)
            self.assertFalse(cap.alive(h.tcpdump_pid))
            if os.name != "nt":
                self.assertTrue(sr.ok)
        finally:
            os.environ.pop("AISB_TCPDUMP_BIN", None)
            import shutil

            shutil.rmtree(td, ignore_errors=True)

    def test_pcap_https_unexplained_from_capture(self) -> None:
        from pcap_flows import parse_pcap_flows

        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "a.pcap"
            pcap.write_bytes(le_pcap([_eth_ipv4_tcp()]))
            obs = parse_pcap_flows(str(pcap))
            self.assertTrue(obs.parse_complete)
            self.assertEqual(obs.flows[0].dport, 443)
            ev = classify_network(
                capture_lifecycle_ok=True,
                lifecycle_reason="OK",
                flows=obs.flows,
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=obs.dns_qnames,
                coverage_complete=obs.parse_complete,
            )
            self.assertEqual(ev.independent_result, "INCOMPLETE")

    def test_orchestrate_interrupt_restores(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            proc.next_behavior = {"immediate": False, "exit_code": None, "stdout": "", "stderr": ""}
            proc.wait_nonblocking = lambda pid: (_ for _ in ()).throw(KeyboardInterrupt)  # type: ignore
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "canary.js")],
                submit_env={},
                expected_js=str(work / "canary.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(result.next_canary_allowed)
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_entry_points_are_executable(self) -> None:
        orch = (BIN / "orchestrate-canary.sh").read_text(encoding="utf-8")
        rec = (BIN / "reconcile-readonly.sh").read_text(encoding="utf-8")
        stop = (BIN / "stop-capture-validate.sh").read_text(encoding="utf-8")
        self.assertIn("lib/orchestrate.py", orch)
        self.assertNotIn("ORCHESTRATOR_IMPORT_OK", orch)
        self.assertIn("lib/reconcile.py", rec)
        self.assertNotIn(".reconcile.env", rec)
        self.assertIn("lib/capture.py", stop)
        self.assertIn("--tail-sec", stop)

    def test_bash_stop_wrapper_if_present(self) -> None:
        import subprocess

        bash = Path(r"C:\Program Files\Git\bin\bash.exe")
        if not bash.is_file():
            self.skipTest("git bash not present")
        with tempfile.TemporaryDirectory() as td:
            from capture import persist_handle, start_capture

            cap = FakeCapture()
            h = start_capture("t-ens5", "ens5", "tcp port 443", td, "helper", cap)
            persist_handle(h)
            env = os.environ.copy()
            env["PREP"] = str(ROOT)
            env["PYTHON3"] = sys.executable
            env["PYTHONPATH"] = str(LIB)
            env["AISB_SUDO_BIN"] = str(BIN / "mock-sudo.py")
            env["PM2_BIN"] = str(BIN / "mock-pm2.py")
            env["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
            proc = subprocess.run(
                [str(bash), str(BIN / "stop-capture-validate.sh"), td, "t-ens5", "0"],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertIn("CAPTURE_STOP", proc.stdout + proc.stderr)


def _dns_query(name: str) -> bytes:
    labels = b""
    for part in name.split("."):
        raw = part.encode("ascii")
        labels += bytes([len(raw)]) + raw
    labels += b"\x00"
    header = struct.pack("!HHHHHH", 0x1234, 0x0100, 1, 0, 0, 0)
    return header + labels + struct.pack("!HH", 1, 1)


def _eth_ipv4_tcp_full(src="10.0.0.5", dst="1.2.3.4", sport=5555, dport=443, payload=b"") -> bytes:
    import ipaddress

    eth = b"\x00" * 6 + b"\x11" * 6 + b"\x08\x00"
    sip = ipaddress.IPv4Address(src).packed
    dip = ipaddress.IPv4Address(dst).packed
    tcp = struct.pack("!HHIIBBHHH", sport, dport, 0, 0, 0x50, 0x10, 0, 0, 0) + payload
    total = 20 + len(tcp)
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, total, 0, 0, 64, 6, 0, sip, dip)
    return eth + ip + tcp


def _eth_ipv6_tcp(src="2001:db8::1", dst="2001:db8::2", sport=5555, dport=443) -> bytes:
    import ipaddress

    eth = b"\x00" * 6 + b"\x11" * 6 + b"\x86\xdd"
    sip = ipaddress.IPv6Address(src).packed
    dip = ipaddress.IPv6Address(dst).packed
    payload_len = 20
    ip = struct.pack("!IHBB", 0x60000000, payload_len, 6, 64) + sip + dip
    tcp = struct.pack("!HHIIBBHHH", sport, dport, 0, 0, 0x50, 0x10, 0, 0, 0)
    return eth + ip + tcp


def _xai_accepted_result(execution_id: str, request_id: str) -> str:
    return json.dumps(
        {
            "event": "xai_canary_result",
            "outcome": "EXPECTED_XAI_REJECTION",
            "executionId": execution_id,
            "requestId": request_id,
            "httpStatus": 202,
            "proofAccepted": "accepted",
            "providerTrafficProof": "NOT_ESTABLISHED",
            "directEnqueueUsed": False,
            "automaticRetryCount": 0,
            "postAck": "ack",
        }
    )


class RemainingDefectTests(unittest.TestCase):
    def test_baseline_dump_failure_stops_before_overlay(self) -> None:
        from overlay_restore import OverlayError, record_baselines_from_pm2

        class BoomPm2(MemoryPm2):
            def dump_env(self, app):
                raise RuntimeError("jlist failed")

        with tempfile.TemporaryDirectory() as td:
            applied = {"n": 0}

            def apply_overlays():
                applied["n"] += 1

            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, _pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=BoomPm2(),
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("BASELINE_READ_FAILED", result.reasons)
            with self.assertRaises(OverlayError):
                record_baselines_from_pm2(str(vault), ["gw"], BoomPm2(), {"GLOBAL_EXECUTION_ENABLED": "false"})

    def test_absent_hmac_not_replaced_with_assumed_set(self) -> None:
        from overlay_restore import record_baselines_from_pm2
        from vault import load_app_metadata

        class EmptyDump(MemoryPm2):
            def dump_env(self, app):
                return {}

        with tempfile.TemporaryDirectory() as td:
            record_baselines_from_pm2(
                td,
                ["gw"],
                EmptyDump(),
                {"HARNESS_ENTITLEMENT_HMAC_SECRET": "from-caller"},
            )
            meta = load_app_metadata(td, "gw")
            self.assertEqual(meta["HARNESS_ENTITLEMENT_HMAC_SECRET"]["state"], "ABSENT")
            self.assertIsNone(meta["HARNESS_ENTITLEMENT_HMAC_SECRET"].get("protected_file"))

    def test_hmac_unauthorized_refuses_before_overlay(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            pm2.apps["aisandbox-ai-service"] = {"GLOBAL_EXECUTION_ENABLED": "false"}
            applied = {"n": 0}

            def apply_overlays():
                applied["n"] += 1
                pm2.apps["aisandbox-ai-service"]["HARNESS_ENTITLEMENT_HMAC_SECRET"] = "injected"

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"HARNESS_ENTITLEMENT_HMAC_SECRET": None},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=False,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertIn("PENDING_HMAC", result.reasons)
            self.assertNotIn("HARNESS_ENTITLEMENT_HMAC_SECRET", pm2.apps["aisandbox-ai-service"])

    def test_xai_expected_rejection_is_terminal_without_job_state(self) -> None:
        from accepted_result import parse_accepted_script_result
        from reconcile import decide_terminal, SubmitterOutcome, extract_recorded_ids

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        rid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        stdout = _xai_accepted_result(eid, rid)
        ids = extract_recorded_ids(stdout, "", "xai")
        accepted = parse_accepted_script_result("xai", stdout, "", 0, ids)
        decision = decide_terminal(
            SubmitterOutcome(exit_code=0, killed=False, timed_out=False, identity_failed=False, stdout=stdout, stderr="", ids=ids)
        )
        self.assertTrue(accepted.intended_accepted)
        self.assertTrue(accepted.execution_terminal)
        self.assertTrue(decision.execution_terminal)
        self.assertFalse(decision.require_reconcile)
        self.assertNotIn("jobState", stdout)
        self.assertNotIn("executionStatus", stdout)

    def test_stub_missing_job_completed_is_terminal(self) -> None:
        from reconcile import decide_terminal, SubmitterOutcome, extract_recorded_ids

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        stdout = _stub_result(
            outcome="completed",
            proof="accepted",
            accounting="pass",
            job_state="missing",
            execution_id=eid,
        )
        ids = extract_recorded_ids(stdout, "", "stub")
        decision = decide_terminal(
            SubmitterOutcome(exit_code=0, killed=False, timed_out=False, identity_failed=False, stdout=stdout, stderr="", ids=ids)
        )
        self.assertTrue(decision.execution_terminal)

    def test_tcp_dns_api_xai_is_not_pass(self) -> None:
        from pcap_flows import parse_pcap_flows

        q = _dns_query("api.x.ai")
        pkt = _eth_ipv4_tcp_full(dport=53, payload=struct.pack("!H", len(q)) + q)
        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "dns.pcap"
            pcap.write_bytes(le_pcap([pkt]))
            obs = parse_pcap_flows(str(pcap))
            self.assertIn("api.x.ai", "".join(obs.dns_qnames))
            ev = classify_network(
                capture_lifecycle_ok=True,
                lifecycle_reason="OK",
                flows=obs.flows,
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=obs.dns_qnames,
                coverage_complete=obs.parse_complete,
            )
            self.assertNotEqual(ev.independent_result, "PASS")

    def test_sport_443_is_unexplained(self) -> None:
        from pcap_flows import parse_pcap_flows

        pkt = _eth_ipv4_tcp(src="1.2.3.4", dst="10.0.0.5", sport=443, dport=5555)
        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "resp.pcap"
            pcap.write_bytes(le_pcap([pkt]))
            obs = parse_pcap_flows(str(pcap))
            ev = classify_network(
                capture_lifecycle_ok=True,
                lifecycle_reason="OK",
                flows=obs.flows,
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=obs.dns_qnames,
                coverage_complete=obs.parse_complete,
            )
            self.assertEqual(ev.independent_result, "INCOMPLETE")
            self.assertIn("UNEXPLAINED_HTTPS", ev.reasons)

    def test_ipv6_tcp_and_fragment_and_linktype(self) -> None:
        from pcap_flows import parse_pcap_flows

        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "v6.pcap"
            pcap.write_bytes(le_pcap([_eth_ipv6_tcp()]))
            obs = parse_pcap_flows(str(pcap))
            self.assertTrue(obs.parse_complete)
            self.assertEqual(obs.flows[0].dport, 443)
            ev = classify_network(
                capture_lifecycle_ok=True,
                lifecycle_reason="OK",
                flows=obs.flows,
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=[],
                coverage_complete=obs.parse_complete,
            )
            self.assertEqual(ev.independent_result, "INCOMPLETE")

            frag = bytearray(_eth_ipv4_tcp())
            # set IPv4 more-fragments in flags at eth(14)+offset 6
            frag[14 + 6] = 0x20
            pcap_f = Path(td) / "frag.pcap"
            pcap_f.write_bytes(le_pcap([bytes(frag)]))
            obs_f = parse_pcap_flows(str(pcap_f))
            self.assertFalse(obs_f.parse_complete)

            v6frag = bytearray(_eth_ipv6_tcp())
            v6frag[14 + 6] = 44
            pcap_v6f = Path(td) / "v6frag.pcap"
            pcap_v6f.write_bytes(le_pcap([bytes(v6frag)]))
            obs_v6f = parse_pcap_flows(str(pcap_v6f))
            self.assertFalse(obs_v6f.parse_complete)

            blob = bytearray(le_pcap([b"\x00" * 14]))
            struct.pack_into("<I", blob, 20, 0x9999)
            pcap_l = Path(td) / "badlink.pcap"
            pcap_l.write_bytes(bytes(blob))
            obs_l = parse_pcap_flows(str(pcap_l))
            self.assertFalse(obs_l.parse_complete)
            self.assertEqual(obs_l.message, "UNSUPPORTED_LINKTYPE")

    def test_missing_route_coverage_never_pass(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=True,
            lifecycle_reason="OK",
            flows=[],
            xai_addrs={"1.1.1.1"},
            ss_before=set(),
            dns_qnames=[],
            route_coverage_ok=False,
        )
        self.assertEqual(ev.independent_result, "INCOMPLETE")
        self.assertIn("ROUTE_COVERAGE_MISSING", ev.reasons)

    def test_owned_descendant_is_reaped(self) -> None:
        from process_alive import process_exists
        from supervise import LinuxProc, supervise

        with tempfile.TemporaryDirectory() as td:
            child_pid_path = Path(td) / "child.pid"
            script = (
                "import subprocess, sys\n"
                "from pathlib import Path\n"
                "p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])\n"
                "Path(r'%s').write_text(str(p.pid))\n" % child_pid_path
            )
            proc = LinuxProc(log_dir=td)
            result = supervise(
                argv=[sys.executable, "-c", script],
                env=os.environ.copy(),
                timeout_ms=15000,
                expected_js="-c",
                expected_node=sys.executable,
                proc=proc,
            )
            child_pid = int(child_pid_path.read_text()) if child_pid_path.is_file() else None
            self.assertEqual(result.exit_code, 0)
            if child_pid:
                self.assertFalse(process_exists(child_pid), "owned descendant must not remain alive")
            self.assertFalse(result.surviving_pids)

    def test_linux_capture_signals_recorded_tcpdump_not_fixture_pid(self) -> None:
        from capture import start_capture, stop_capture
        from linux_capture import LinuxCapture

        td = tempfile.mkdtemp()
        os.environ["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
        cap = LinuxCapture(str(BIN / "mock-sudo.py"), sys.executable, str(BIN / "tcpdump-exec.py"))
        sent: list[int] = []
        orig = cap.send

        def wrapped(pid, sig, privileged, **kwargs):
            sent.append(pid)
            return orig(pid, sig, privileged, **kwargs)

        cap.send = wrapped  # type: ignore[method-assign]
        try:
            h = start_capture("live-ens5", "ens5", "tcp port 443", td, str(BIN / "tcpdump-exec.py"), cap)
            self.assertNotEqual(h.tcpdump_pid, 8000)
            self.assertNotIn(8000, sent)
            sr = stop_capture(h, cap, tail_sec=0)
            self.assertTrue(sent)
            self.assertNotIn(8000, sent)
            self.assertIn(h.tcpdump_pid, sent)
            if h.sudo_parent_pid and h.sudo_parent_pid != h.tcpdump_pid:
                self.assertNotEqual(sent[0], h.sudo_parent_pid)
            if os.name != "nt":
                self.assertTrue(sr.ok)
        finally:
            os.environ.pop("AISB_TCPDUMP_BIN", None)
            import shutil

            shutil.rmtree(td, ignore_errors=True)

    def test_unresolved_vault_not_overwritten(self) -> None:
        from vault import write_vault

        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            write_vault(str(vault), {"HARNESS_ENTITLEMENT_HMAC_SECRET": "keep-me"})
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("UNRESOLVED_VAULT_EXISTS", result.reasons)
            self.assertTrue((Path(vault) / "protected" / "HARNESS_ENTITLEMENT_HMAC_SECRET.value").is_file())

    def test_vault_deleted_only_after_restore_match(self) -> None:
        from vault import protected_recovery_present, write_app_vault

        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, _delete, deleted = helper._common(td, proc, cap)
            write_app_vault(str(vault), "aisandbox-api-gateway", {"GLOBAL_EXECUTION_ENABLED": "false"})
            from vault import delete_protected_recovery

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=lambda: delete_protected_recovery(str(vault)),
                capture_tail_sec=0,
            )
            self.assertTrue(result.overlays_restored)
            self.assertFalse(protected_recovery_present(str(vault)))

    def test_worker_window_failure_restores(self) -> None:
        import time as time_mod

        from overlay_restore import OverlayWindowState

        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            windows = OverlayWindowState(
                worker_app="aisandbox-ai-service",
                gateway_app="aisandbox-api-gateway",
                worker_limit_sec=0,
                gateway_limit_sec=300,
            )

            def apply_overlays():
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"
                windows.mark_applied("aisandbox-ai-service", time_mod.monotonic())

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
                overlay_windows=windows,
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")


class ShippedCliDriverTests(unittest.TestCase):
    def _cli_env(self, td: str, *, hmac_auth: bool, route_ok: bool, mock_json: str, pm2_state: dict) -> dict[str, str]:
        state = Path(td) / "pm2.json"
        state.write_text(json.dumps(pm2_state), encoding="utf-8")
        resolv = Path(td) / "resolv.conf"
        resolv.write_text("nameserver 172.26.0.1\n", encoding="utf-8")
        routes = Path(td) / "routes.txt"
        env = os.environ.copy()
        env["PYTHONPATH"] = str(LIB)
        env["NODE_BIN"] = str(BIN / "mock-node.py")
        env["PM2_BIN"] = str(BIN / "mock-pm2.py")
        env["AISB_SUDO_BIN"] = str(BIN / "mock-sudo.py")
        env["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
        env["MOCK_PM2_STATE"] = str(state)
        env["AISB_01C6A_HMAC_SECRET"] = "cli-hmac-secret"
        env["AISB_01C6A_DUMMY_XAI_API_KEY"] = "01C6A-NONSECRET-DUMMY-XAI-KEY"
        env["AISB_01C6A_MOCK_NODE_JSON"] = mock_json
        env["AISB_01C6A_MOCK_NODE_EXIT"] = "0"
        env["AISB_01C6A_PROC_LOG_DIR"] = str(Path(td) / "proc")
        env.pop("AISB_01C6A_ROUTE_COVERAGE_OK", None)
        if hmac_auth:
            env["AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED"] = "YES"
        else:
            env.pop("AISB_01C6A_HMAC_ABSENT_EMPTY_RESTORE_AUTHORIZED", None)
        if route_ok:
            routes.write_text(VALID_ROUTE_TABLE, encoding="utf-8")
            env["AISB_01C6A_ROUTE_TABLE_FILE"] = str(routes)
            routes_v6 = Path(td) / "routes-v6.txt"
            routes_v6.write_text("", encoding="utf-8")
            env["AISB_01C6A_ROUTE_TABLE_V6_FILE"] = str(routes_v6)
            evidence_path = Path(td) / "coverage-evidence.json"
            evidence_path.write_text(
                json.dumps(_make_evidence(ipv4_output=VALID_ROUTE_TABLE, ipv6_output="")),
                encoding="utf-8",
            )
            env["AISB_01C6A_COVERAGE_EVIDENCE"] = str(evidence_path)
        else:
            env.pop("AISB_01C6A_ROUTE_TABLE_FILE", None)
            env.pop("AISB_01C6A_ROUTE_TABLE_V6_FILE", None)
            env.pop("AISB_01C6A_COVERAGE_EVIDENCE", None)
        env.pop("AISB_01C6A_STAGING_EXECUTION_AUTHORIZED", None)
        return env

    def _base_pm2(self) -> dict:
        return {
            "apps": {
                "aisandbox-api-gateway": {"GLOBAL_EXECUTION_ENABLED": "false"},
                "aisandbox-ai-service": {
                    "GLOBAL_EXECUTION_ENABLED": "false",
                    "AGENT_HARNESS_ENABLE_TOOL_LOOP": "false",
                    "XAI_API_KEY": "staging-original-key",
                },
            }
        }

    def test_cli_stub_preserves_gateway_execution_false(self) -> None:
        import subprocess

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        stdout = _stub_result(
            outcome="completed",
            proof="accepted",
            accounting="pass",
            job_state="completed",
            execution_id=eid,
        )
        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            env = self._cli_env(td, hmac_auth=True, route_ok=True, mock_json=stdout, pm2_state=self._base_pm2())
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            self.assertEqual(apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")
            self.assertEqual(apps["aisandbox-ai-service"].get("XAI_API_KEY"), "staging-original-key")
            self.assertIn("ORCHESTRATE_DONE", proc.stdout)
            self.assertIn("classification=OBSERVATION_COMPLETE", proc.stdout)
            state = json.loads(Path(env["MOCK_PM2_STATE"]).read_text(encoding="utf-8"))
            for item in state.get("history") or []:
                if item.get("app") == "aisandbox-api-gateway":
                    self.assertNotEqual(item.get("env", {}).get("GLOBAL_EXECUTION_ENABLED"), "true")

    def test_cli_xai_expected_rejection_exits_zero(self) -> None:
        import subprocess

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        rid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        stdout = _xai_accepted_result(eid, rid)
        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            env = self._cli_env(td, hmac_auth=True, route_ok=True, mock_json=stdout, pm2_state=self._base_pm2())
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "xai",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            self.assertIn("ORCHESTRATE_DONE", proc.stdout)
            payload = json.loads((work / "orchestrate-result.json").read_text(encoding="utf-8"))
            self.assertEqual(payload.get("classification"), "OBSERVATION_COMPLETE")
            self.assertFalse(payload.get("next_canary_allowed"))
            state = json.loads(Path(env["MOCK_PM2_STATE"]).read_text(encoding="utf-8"))
            gw_vals = [
                item.get("env", {}).get("GLOBAL_EXECUTION_ENABLED")
                for item in state.get("history") or []
                if item.get("app") == "aisandbox-api-gateway"
            ]
            self.assertIn("true", gw_vals)
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_cli_hmac_unauthorized_does_not_overlay(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            env = self._cli_env(
                td,
                hmac_auth=False,
                route_ok=True,
                mock_json="{}",
                pm2_state=self._base_pm2(),
            )
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 3)
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")
            self.assertNotIn("HARNESS_ENTITLEMENT_HMAC_SECRET", apps["aisandbox-ai-service"])
            self.assertEqual(apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_cli_missing_route_coverage_never_pass(self) -> None:
        import subprocess

        eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        stdout = _stub_result(
            outcome="completed",
            proof="accepted",
            accounting="pass",
            job_state="completed",
            execution_id=eid,
        )
        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            env = self._cli_env(td, hmac_auth=True, route_ok=False, mock_json=stdout, pm2_state=self._base_pm2())
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 3, proc.stdout + proc.stderr)
            payload = json.loads((work / "orchestrate-result.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["network_independent"], "INCOMPLETE")
            self.assertTrue(
                any("ROUTE" in r for r in payload["reasons"]),
                payload["reasons"],
            )
            self.assertFalse(payload["next_canary_allowed"])
            self.assertNotEqual(payload.get("classification"), "OBSERVATION_COMPLETE")
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")
            self.assertEqual(apps["aisandbox-ai-service"].get("XAI_API_KEY"), "staging-original-key")
            self.assertEqual(apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_cli_worker_window_exceeded(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            env = self._cli_env(td, hmac_auth=True, route_ok=True, mock_json="{}", pm2_state=self._base_pm2())
            env["AISB_01C6A_WORKER_WINDOW_SEC"] = "0"
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 3, proc.stdout + proc.stderr)
            payload = json.loads((work / "orchestrate-result.json").read_text(encoding="utf-8"))
            self.assertIn("WORKER_WINDOW_EXCEEDED", payload["reasons"])
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")
            self.assertEqual(apps["aisandbox-ai-service"].get("XAI_API_KEY"), "staging-original-key")


class DriverOverlayContractTests(unittest.TestCase):
    def test_driver_stub_does_not_enable_gateway_execution(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 0,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            pm2.apps["aisandbox-ai-service"] = {
                "GLOBAL_EXECUTION_ENABLED": "false",
                "AGENT_HARNESS_ENABLE_TOOL_LOOP": "false",
                "XAI_API_KEY": "staging-original-key",
            }
            history: list[tuple[str, dict]] = []
            orig = pm2.restart_update_env

            def traced(app, envmap):
                history.append((app, dict(envmap)))
                return orig(app, envmap)

            pm2.restart_update_env = traced  # type: ignore[method-assign]
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={
                    "AISB_01C6A_HMAC_SECRET": "driver-hmac",
                    "AISB_01C6A_DUMMY_XAI_API_KEY": "01C6A-NONSECRET-DUMMY-XAI-KEY",
                },
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=None,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            gw_vals = [e.get("GLOBAL_EXECUTION_ENABLED") for a, e in history if a == "aisandbox-api-gateway"]
            self.assertNotIn("true", gw_vals)
            self.assertTrue(
                any(
                    a == "aisandbox-ai-service" and e.get("AGENT_HARNESS_ENABLE_TOOL_LOOP") == "true"
                    for a, e in history
                )
            )
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(pm2.apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")
            self.assertEqual(pm2.apps["aisandbox-ai-service"].get("XAI_API_KEY"), "staging-original-key")
            self.assertTrue(result.overlays_restored)
            self.assertTrue(result.next_canary_allowed)

    def test_hmac_unauthorized_driver_writes_no_recovery_vault(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            pm2.apps["aisandbox-ai-service"] = {
                "GLOBAL_EXECUTION_ENABLED": "false",
                "AGENT_HARNESS_ENABLE_TOOL_LOOP": "false",
                "XAI_API_KEY": "staging-original-key",
            }
            applied = {"n": 0}
            orig = pm2.restart_update_env

            def traced(app, envmap):
                applied["n"] += 1
                return orig(app, envmap)

            pm2.restart_update_env = traced  # type: ignore[method-assign]
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={"AISB_01C6A_HMAC_SECRET": "driver-hmac"},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"HARNESS_ENTITLEMENT_HMAC_SECRET": None},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=False,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=None,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertIn("PENDING_HMAC", result.reasons)
            self.assertFalse((Path(vault) / "apps" / "aisandbox-ai-service" / "protected" / "XAI_API_KEY.value").is_file())
            self.assertNotIn("HARNESS_ENTITLEMENT_HMAC_SECRET", pm2.apps["aisandbox-ai-service"])
            self.assertEqual(pm2.apps["aisandbox-ai-service"].get("XAI_API_KEY"), "staging-original-key")

    def test_missing_app_stops_before_overlay(self) -> None:
        from overlay_restore import OverlayError, dump_app_envs

        class Missing(MemoryPm2):
            def dump_env(self, app):
                raise KeyError(app)

        pm2 = Missing()
        applied = {"n": 0}

        def apply_overlays():
            applied["n"] += 1

        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, _pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertIn("BASELINE_APP_MISSING", result.reasons)
            with self.assertRaises(OverlayError):
                dump_app_envs(["missing-app"], Missing())

    def test_duplicate_app_stops_before_overlay(self) -> None:
        from overlay_restore import OverlayError, dump_app_envs

        with self.assertRaises(OverlayError) as ctx:
            dump_app_envs(["gw", "gw"], MemoryPm2())
        self.assertEqual(ctx.exception.code, "BASELINE_APP_DUPLICATE")

    def test_gateway_window_failure_restores(self) -> None:
        import time as time_mod

        from overlay_restore import OverlayWindowState

        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
            windows = OverlayWindowState(
                worker_app="aisandbox-ai-service",
                gateway_app="aisandbox-api-gateway",
                worker_limit_sec=1800,
                gateway_limit_sec=0,
            )

            def apply_overlays():
                pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"] = "true"
                windows.mark_applied("aisandbox-api-gateway", time_mod.monotonic())

            result = orchestrate(
                which="xai",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 1.1.1.1\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
                overlay_windows=windows,
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("GATEWAY_WINDOW_EXCEEDED", result.reasons)
            self.assertEqual(pm2.apps["aisandbox-api-gateway"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_tcp_dns_without_length_prefix_is_incomplete(self) -> None:
        from pcap_flows import parse_pcap_flows

        q = _dns_query("api.x.ai")
        pkt = _eth_ipv4_tcp_full(dport=53, payload=q)
        with tempfile.TemporaryDirectory() as td:
            pcap = Path(td) / "short.pcap"
            pcap.write_bytes(le_pcap([pkt]))
            obs = parse_pcap_flows(str(pcap))
            self.assertFalse(obs.parse_complete)
            ev = classify_network(
                capture_lifecycle_ok=True,
                lifecycle_reason="OK",
                flows=obs.flows,
                xai_addrs=set(),
                ss_before=set(),
                dns_qnames=obs.dns_qnames,
                coverage_complete=obs.parse_complete,
            )
            self.assertNotEqual(ev.independent_result, "PASS")


class VirtualClock:
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def monotonic(self) -> float:
        return self.t

    def sleep(self, sec: float) -> None:
        self.t += float(sec)

    def advance(self, sec: float) -> None:
        self.t += float(sec)


class CorrectionBoundaryTests(unittest.TestCase):
    def test_posix_privileged_kill_spy_not_mock_sudo(self) -> None:
        from capture import CaptureSignalError
        from linux_capture import LinuxCapture, privileged_kill_argv, posix_privileged_kill

        argv = privileged_kill_argv("/usr/bin/sudo", signal.SIGINT, 4242)
        self.assertEqual(argv[0], "/usr/bin/sudo")
        self.assertFalse(argv[0].endswith(".py"))
        self.assertEqual(argv[1:4], ["-n", "kill", f"-{int(signal.SIGINT)}"])
        calls: list[list[str]] = []

        class Spy:
            returncode = 0

            def __call__(self, cmd, **kwargs):
                calls.append(list(cmd))
                return self

        posix_privileged_kill("/usr/bin/sudo", signal.SIGTERM, 4242, run=Spy())
        self.assertEqual(calls[0][0], "/usr/bin/sudo")
        self.assertIn("kill", calls[0])

        cap = LinuxCapture("/usr/bin/sudo", sys.executable, "exec.py")
        cap._idents[4242] = {
            "tcpdump_pid": 4242,
            "pcap_path": "/tmp/ens5.pcap",
            "iface": "ens5",
            "tcpdump_argv": ["/usr/bin/tcpdump", "-nn", "-i", "ens5", "-U", "-w", "/tmp/ens5.pcap", "tcp", "port", "443"],
            "tcpdump_cmdline": "/usr/bin/tcpdump -nn -i ens5 -U -w /tmp/ens5.pcap tcp port 443",
            "start_identity": "4242:start",
        }
        cap.alive = lambda pid: True  # type: ignore[method-assign]
        cap.live_cmdline = lambda pid: cap._idents[4242]["tcpdump_cmdline"]  # type: ignore[method-assign]
        cap.live_start_identity = lambda pid: "4242:start"  # type: ignore[method-assign]
        spy = Spy()
        cap.send(4242, signal.SIGINT, privileged=True, platform="posix", run_cmd=spy)
        self.assertEqual(spy.returncode, 0)
        self.assertEqual(calls[-1][0], "/usr/bin/sudo")
        self.assertFalse(calls[-1][0].endswith(".py"))

        class TimeoutSpy:
            def __call__(self, cmd, **kwargs):
                import subprocess as sp

                raise sp.TimeoutExpired(cmd, 5)

        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(4242, signal.SIGTERM, privileged=True, platform="posix", run_cmd=TimeoutSpy())
        self.assertEqual(ctx.exception.code, "PRIVILEGED_KILL_TIMEOUT")

        class FailSpy:
            returncode = 1

            def __call__(self, cmd, **kwargs):
                return self

        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(4242, getattr(signal, "SIGKILL", signal.SIGTERM), privileged=True, platform="posix", run_cmd=FailSpy())
        self.assertEqual(ctx.exception.code, "PRIVILEGED_KILL_FAILED")

    def test_pid_reuse_does_not_signal(self) -> None:
        from capture import CaptureSignalError
        from linux_capture import LinuxCapture

        cap = LinuxCapture("/usr/bin/sudo", sys.executable, "exec.py")
        cap._idents[99] = {
            "tcpdump_pid": 99,
            "pcap_path": "/tmp/owned.pcap",
            "iface": "ens5",
            "tcpdump_argv": ["/usr/bin/tcpdump", "-nn", "-i", "ens5", "-U", "-w", "/tmp/owned.pcap", "tcp"],
            "tcpdump_cmdline": "/usr/bin/tcpdump -nn -i ens5 -U -w /tmp/owned.pcap tcp",
            "start_identity": "99:start",
        }
        cap.alive = lambda pid: True  # type: ignore[method-assign]
        cap.live_cmdline = lambda pid: "/usr/bin/sshd -f /etc/ssh/sshd_config"  # type: ignore[method-assign]
        cap.live_start_identity = lambda pid: "99:start"  # type: ignore[method-assign]
        signaled = {"n": 0}

        def run_cmd(cmd, **kwargs):
            signaled["n"] += 1
            class R:
                returncode = 0
            return R()

        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(99, signal.SIGINT, privileged=True, platform="posix", run_cmd=run_cmd)
        self.assertEqual(ctx.exception.code, "TCPDUMP_PID_REUSED")
        self.assertEqual(signaled["n"], 0)

        cap.live_cmdline = lambda pid: "/usr/bin/tcpdump -nn -i ens5 -U -w /tmp/other.pcap tcp"  # type: ignore
        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(99, signal.SIGINT, privileged=True, platform="posix", run_cmd=run_cmd)
        self.assertEqual(ctx.exception.code, "TCPDUMP_PID_REUSED")
        self.assertEqual(signaled["n"], 0)

    def test_fresh_process_stop_owned_disposable(self) -> None:
        from capture import load_handle, persist_handle, start_capture, stop_capture
        from linux_capture import LinuxCapture

        td = tempfile.mkdtemp()
        os.environ["AISB_TCPDUMP_BIN"] = str(BIN / "mock-tcpdump.py")
        starter = LinuxCapture(str(BIN / "mock-sudo.py"), sys.executable, str(BIN / "tcpdump-exec.py"))
        stopper = LinuxCapture(str(BIN / "mock-sudo.py"), sys.executable, str(BIN / "tcpdump-exec.py"))
        try:
            h = start_capture("fresh-ens5", "ens5", "tcp port 443", td, str(BIN / "tcpdump-exec.py"), starter)
            persist_handle(h)
            self.assertTrue(starter.alive(h.tcpdump_pid))
            loaded = load_handle(h.handle_path)
            sr = stop_capture(loaded, stopper, tail_sec=0)
            self.assertFalse(stopper.alive(loaded.tcpdump_pid) or starter.alive(h.tcpdump_pid))
            if os.name != "nt":
                self.assertTrue(sr.ok, sr.code)
            else:
                self.assertIn(sr.code, ("CAPTURE_STOPPED", "TCPDUMP_PID_REUSED", "CAPTURE_SIGNAL_FAILED", "TCPDUMP_CMDLINE_UNREADABLE"))
        finally:
            os.environ.pop("AISB_TCPDUMP_BIN", None)
            import shutil

            shutil.rmtree(td, ignore_errors=True)

    def test_window_limits_reject_nonfinite_negative_and_86400(self) -> None:
        from overlay_restore import OverlayError, OverlayWindowState, window_limits_from_env

        with self.assertRaises(OverlayError) as ctx:
            window_limits_from_env({"AISB_01C6A_WORKER_WINDOW_SEC": "86400"})
        self.assertEqual(ctx.exception.code, "WINDOW_LIMIT_INVALID")
        for raw in ("nan", "inf", "-1", "1800.1"):
            with self.assertRaises(OverlayError):
                window_limits_from_env({"AISB_01C6A_WORKER_WINDOW_SEC": raw})
        for raw in ("nan", "inf", "-5", "301"):
            with self.assertRaises(OverlayError):
                window_limits_from_env({"AISB_01C6A_GATEWAY_WINDOW_SEC": raw})
        with self.assertRaises(OverlayError):
            OverlayWindowState("w", "g", worker_limit_sec=float("nan"), gateway_limit_sec=300)
        worker, gateway = window_limits_from_env({})
        self.assertEqual(worker, 1800)
        self.assertEqual(gateway, 300)

    def test_invalid_window_does_not_mutate(self) -> None:
        import subprocess

        with tempfile.TemporaryDirectory() as td:
            work = Path(td) / "work"
            vault = Path(td) / "vault"
            work.mkdir()
            helper = ShippedCliDriverTests()
            env = helper._cli_env(td, hmac_auth=True, route_ok=True, mock_json="{}", pm2_state=helper._base_pm2())
            env["AISB_01C6A_WORKER_WINDOW_SEC"] = "86400"
            resolv = Path(td) / "resolv.conf"
            proc = subprocess.run(
                [
                    sys.executable,
                    str(LIB / "orchestrate.py"),
                    "--prep",
                    str(ROOT),
                    "--which",
                    "stub",
                    "--workdir",
                    str(work),
                    "--vault",
                    str(vault),
                    "--js",
                    str(BIN / "mock-node.py"),
                    "--resolv",
                    str(resolv),
                ],
                env=env,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
            )
            self.assertEqual(proc.returncode, 3)
            jlist = subprocess.check_output(
                [sys.executable, str(BIN / "mock-pm2.py"), "jlist"], env=env, text=True
            )
            apps = {item["name"]: item["pm2_env"] for item in json.loads(jlist)}
            self.assertEqual(apps["aisandbox-ai-service"].get("AGENT_HARNESS_ENABLE_TOOL_LOOP"), "false")

    def _windowed(self, td, proc, cap, clock, apply_overlays, **extra):
        from overlay_restore import OverlayWindowState

        helper = OrchestrateFailurePathTests()
        vault, work, pm2, _a, delete_vault, deleted = helper._common(td, proc, cap)
        wrap = extra.pop("wrap_pm2", None)
        if wrap:
            wrap(pm2)
        windows = OverlayWindowState(
            worker_app="aisandbox-ai-service",
            gateway_app="aisandbox-api-gateway",
            worker_limit_sec=0.1,
            gateway_limit_sec=300,
            restore_reserve_sec=0.0,
        )

        def apply():
            apply_overlays(pm2)

        kwargs = dict(
            which="stub",
            workdir=str(work),
            vault_dir=str(vault),
            submit_argv=["/usr/bin/node", str(work / "c.js")],
            submit_env={},
            expected_js=str(work / "c.js"),
            overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
            captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
            pm2=pm2,
            proc=proc,
            capture_adapter=cap,
            exec_helper="helper",
            resolv_conf="nameserver 172.26.0.1\n",
            **_cov(),
            hmac_absent_empty_authorized=True,
            reconcile_runner=lambda env, tmo: (3, "", "", False, False),
            apply_overlays=apply,
            delete_vault=delete_vault,
            capture_tail_sec=0,
            overlay_windows=windows,
            now=clock.monotonic,
            sleep=clock.sleep,
        )
        kwargs.update(extra)
        return orchestrate(**kwargs), pm2, proc, deleted

    def test_virtual_clock_expiry_during_apply(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()

            def apply_overlays(pm2):
                clock.advance(0.2)
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            result, pm2, proc, _d = self._windowed(td, proc, cap, clock, apply_overlays)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertFalse(proc.spawn_calls)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertNotEqual(result.classification, "OBSERVATION_COMPLETE")

    def test_virtual_clock_expiry_during_submit(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            proc.next_behavior = {
                "immediate": False,
                "exit_code": None,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }

            def wait_late(pid):
                clock.advance(0.2)
                proc.procs[pid]["exit"] = 0
                proc.procs[pid]["alive"] = False
                return 0

            proc.wait_nonblocking = wait_late  # type: ignore[method-assign]
            cap = FakeCapture()

            def apply_overlays(pm2):
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            result, pm2, proc, _d = self._windowed(td, proc, cap, clock, apply_overlays)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertTrue(proc.spawn_calls)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_virtual_clock_expiry_during_reconcile(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            stdout = json.dumps(
                {"event": "stub_identifiers_recorded", "executionId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
            )
            proc.next_behavior = {
                "immediate": True,
                "exit_code": EXIT_ACK_UNKNOWN,
                "stdout": stdout,
                "stderr": "",
            }
            cap = FakeCapture()
            eid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

            def runner(env, timeout_ms):
                clock.advance(0.2)
                return (
                    0,
                    _stub_result(
                        outcome="completed",
                        proof="accepted",
                        accounting="pass",
                        job_state="completed",
                        execution_id=eid,
                    ),
                    "",
                    False,
                    False,
                )

            def apply_overlays(pm2):
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            result, pm2, proc, _d = self._windowed(
                td, proc, cap, clock, apply_overlays, reconcile_runner=runner
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_virtual_clock_expiry_during_capture_read_not_success(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 0,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()
            cap.read_hook = lambda pcap, timeout: clock.advance(0.25)

            def apply_overlays(pm2):
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            result, pm2, proc, _d = self._windowed(td, proc, cap, clock, apply_overlays)
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertNotEqual(result.classification, "OBSERVATION_COMPLETE")
            self.assertFalse(result.next_canary_allowed)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")

    def test_virtual_clock_expiry_during_restore(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            eid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
            proc.next_behavior = {
                "immediate": True,
                "exit_code": 0,
                "stdout": _stub_result(
                    outcome="completed",
                    proof="accepted",
                    accounting="pass",
                    job_state="completed",
                    execution_id=eid,
                ),
                "stderr": "",
            }
            cap = FakeCapture()

            def apply_overlays(pm2):
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            def wrap_pm2(pm2):
                orig = pm2.restart_update_env

                def slow_restart(app, envmap):
                    clock.advance(0.2)
                    return orig(app, envmap)

                pm2.restart_update_env = slow_restart  # type: ignore[method-assign]

            result, pm2, proc, _d = self._windowed(
                td, proc, cap, clock, apply_overlays, wrap_pm2=wrap_pm2
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertFalse(result.next_canary_allowed)

    def test_restore_owner_does_not_double_restart(self) -> None:
        clock = VirtualClock()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            restarts: list[str] = []

            def apply_overlays(pm2):
                clock.advance(0.2)
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            def wrap_pm2(pm2):
                orig = pm2.restart_update_env

                def traced(app, envmap):
                    restarts.append(app)
                    return orig(app, envmap)

                pm2.restart_update_env = traced  # type: ignore[method-assign]

            result, pm2, proc, _d = self._windowed(
                td, proc, cap, clock, apply_overlays, wrap_pm2=wrap_pm2
            )
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertEqual(restarts.count("aisandbox-ai-service"), 1)
            self.assertEqual(restarts.count("aisandbox-api-gateway"), 1)

    def test_comment_only_resolv_zero_overlay_zero_submit(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            applied = {"n": 0}

            def apply():
                applied["n"] += 1
                apply_overlays()

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="# nameserver 172.26.0.1\n; comment only\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertFalse(proc.spawn_calls)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("RESOLVER_CONFIG_INCOMPLETE", result.reasons)

    def test_malformed_nameserver_zero_overlay(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver not-an-ip\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(proc.spawn_calls)
            self.assertIn("RESOLVER_NAMESERVER_MALFORMED", result.reasons)

    def test_loopback_required_without_lo_zero_overlay(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 127.0.0.53\n",
                **_cov(),
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply_overlays,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertFalse(proc.spawn_calls)
            self.assertIn("LOOPBACK_COVERAGE_MISSING", result.reasons)

    def test_empty_pcap_may_pass_observation(self) -> None:
        ev = classify_network(
            capture_lifecycle_ok=True,
            lifecycle_reason="OK",
            flows=[],
            xai_addrs={"104.18.18.80"},
            ss_before=set(),
            dns_qnames=[],
            coverage_complete=True,
            route_coverage_ok=True,
            resolver_coverage_ok=True,
        )
        self.assertEqual(ev.independent_result, "PASS")
        self.assertEqual(ev.script_provider_traffic_proof, "NOT_ESTABLISHED")

    def test_yes_flag_is_not_route_evidence(self) -> None:
        from coverage import assess_coverage

        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table="",
            route_flag_yes=True,
        )
        self.assertFalse(report.ok)
        self.assertEqual(report.code, "ROUTE_COVERAGE_MISSING")

    def test_prefix_pcap_filename_does_not_signal(self) -> None:
        from capture import CaptureSignalError
        from linux_capture import LinuxCapture

        cap = LinuxCapture("/usr/bin/sudo", sys.executable, "exec.py")
        expected = "/tmp/owned.pcap"
        prefix = "/tmp/owned.pcap.extra"
        cap._idents[99] = {
            "tcpdump_pid": 99,
            "pcap_path": expected,
            "iface": "ens5",
            "tcpdump_argv": ["/usr/bin/tcpdump", "-nn", "-i", "ens5", "-U", "-w", expected, "tcp"],
            "tcpdump_cmdline": f"/usr/bin/tcpdump -nn -i ens5 -U -w {expected} tcp",
            "start_identity": "99:start",
        }
        cap.alive = lambda pid: True  # type: ignore[method-assign]
        cap.live_cmdline = lambda pid: f"/usr/bin/tcpdump -nn -i ens5 -U -w {prefix} tcp"  # type: ignore
        cap.live_argv = lambda pid: ["/usr/bin/tcpdump", "-nn", "-i", "ens5", "-U", "-w", prefix, "tcp"]  # type: ignore
        cap.live_start_identity = lambda pid: "99:start"  # type: ignore
        signaled = {"n": 0}

        def run_cmd(cmd, **kwargs):
            signaled["n"] += 1

            class R:
                returncode = 0

            return R()

        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(99, signal.SIGINT, privileged=True, platform="posix", run_cmd=run_cmd, expected_pcap=expected, expected_iface="ens5")
        self.assertEqual(ctx.exception.code, "TCPDUMP_PID_REUSED")
        self.assertEqual(signaled["n"], 0)

    def test_changed_start_identity_does_not_signal(self) -> None:
        from capture import CaptureSignalError
        from linux_capture import LinuxCapture

        cap = LinuxCapture("/usr/bin/sudo", sys.executable, "exec.py")
        argv = ["/usr/bin/tcpdump", "-nn", "-i", "ens5", "-U", "-w", "/tmp/owned.pcap", "tcp"]
        cap._idents[99] = {
            "tcpdump_pid": 99,
            "pcap_path": "/tmp/owned.pcap",
            "iface": "ens5",
            "tcpdump_argv": argv,
            "tcpdump_cmdline": "/usr/bin/tcpdump -nn -i ens5 -U -w /tmp/owned.pcap tcp",
            "start_identity": "99:111",
        }
        cap.alive = lambda pid: True  # type: ignore[method-assign]
        cap.live_argv = lambda pid: list(argv)  # type: ignore
        cap.live_cmdline = lambda pid: " ".join(argv)  # type: ignore
        cap.live_start_identity = lambda pid: "99:222"  # type: ignore
        signaled = {"n": 0}

        def run_cmd(cmd, **kwargs):
            signaled["n"] += 1

            class R:
                returncode = 0

            return R()

        with self.assertRaises(CaptureSignalError) as ctx:
            cap.send(
                99,
                signal.SIGINT,
                privileged=True,
                platform="posix",
                run_cmd=run_cmd,
                expected_pcap="/tmp/owned.pcap",
                expected_iface="ens5",
            )
        self.assertEqual(ctx.exception.code, "TCPDUMP_PID_REUSED")
        self.assertEqual(signaled["n"], 0)

    def test_coverage_false_ok_cases_zero_overlay_zero_submit(self) -> None:
        from coverage import assess_coverage

        cases = [
            (
                "ens5 link no default",
                "nameserver 172.26.0.1\n",
                "2: ens5: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9001\n",
                None,
            ),
            (
                "conflicting defaults last ens5",
                "nameserver 172.26.0.1\n",
                "default via 10.0.0.1 dev eth0\ndefault via 172.26.0.1 dev ens5\n",
                None,
            ),
            (
                "preflight no timestamp",
                "nameserver 172.26.0.1\n",
                "",
                {
                    "interfaces": ["ens5"],
                    "nameservers": ["172.26.0.1"],
                    "default_dev": "ens5",
                    "hostname": "ignored-host",
                },
            ),
            (
                "nameserverXYZ",
                "nameserverXYZ 172.26.0.1\n",
                "default via 172.26.0.1 dev ens5\n",
                None,
            ),
            (
                "127.0.0.2 without lo",
                "nameserver 127.0.0.2\n",
                "default via 172.26.0.1 dev ens5\n",
                None,
            ),
        ]
        for name, resolv, routes, pre in cases:
            report = assess_coverage(
                resolv_conf=resolv,
                route_table=routes,
                preflight=pre,
                now_unix=1_800_000_000,
                expected_hostname="ignored-host",
            )
            self.assertFalse(report.ok, name)
            self.assertNotEqual(report.code, "COVERAGE_OK", name)

        for name, resolv, routes, pre in cases:
            with tempfile.TemporaryDirectory() as td:
                proc = FakeProc()
                cap = FakeCapture()
                helper = OrchestrateFailurePathTests()
                vault, work, pm2, apply_overlays, delete_vault, deleted = helper._common(td, proc, cap)
                applied = {"n": 0}

                def apply(apply_overlays=apply_overlays, applied=applied):
                    applied["n"] += 1
                    apply_overlays()

                result = orchestrate(
                    which="stub",
                    workdir=str(work),
                    vault_dir=str(vault),
                    submit_argv=["/usr/bin/node", str(work / "c.js")],
                    submit_env={},
                    expected_js=str(work / "c.js"),
                    overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                    captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                    pm2=pm2,
                    proc=proc,
                    capture_adapter=cap,
                    exec_helper="helper",
                    resolv_conf=resolv,
                    route_table=routes,
                    preflight=pre,
                    hmac_absent_empty_authorized=True,
                    reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                    apply_overlays=apply,
                    delete_vault=delete_vault,
                    capture_tail_sec=0,
                )
                self.assertEqual(applied["n"], 0, name)
                self.assertFalse(proc.spawn_calls, name)
                self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false", name)
                self.assertEqual(result.classification, "INCOMPLETE", name)

    def test_restore_reserve_fits_overlay_windows(self) -> None:
        from overlay_restore import (
            CAPTURE_STOP_RESERVE_SEC,
            DEFAULT_RESTORE_TIMEOUT_SEC,
            GATEWAY_WINDOW_SEC,
            PCAP_PARSE_RESERVE_SEC,
            WORKER_WINDOW_SEC,
            compute_restore_reserve_sec,
        )

        reserve = compute_restore_reserve_sec(2)
        self.assertLessEqual(reserve, GATEWAY_WINDOW_SEC)
        self.assertLessEqual(reserve, WORKER_WINDOW_SEC)
        self.assertGreaterEqual(
            reserve,
            CAPTURE_STOP_RESERVE_SEC + PCAP_PARSE_RESERVE_SEC + (2 * DEFAULT_RESTORE_TIMEOUT_SEC * 2),
        )

    def test_apply_payloads_stop_after_restore_started(self) -> None:
        from overlay_restore import apply_overlay_payloads

        started = {"n": 0}
        pm2 = MemoryPm2()
        pm2.apps["a"] = {}
        pm2.apps["b"] = {}

        def abort() -> bool:
            return started["n"] >= 1

        orig = pm2.restart_update_env

        def counted(app, envmap):
            started["n"] += 1
            return orig(app, envmap)

        pm2.restart_update_env = counted  # type: ignore[method-assign]
        apply_overlay_payloads(pm2, {"a": {"X": "1"}, "b": {"Y": "1"}}, abort=abort)
        self.assertEqual(started["n"], 1)
        self.assertNotIn("Y", pm2.apps["b"])

    def test_restore_while_supervise_remains_blocked(self) -> None:
        import threading
        import time

        from overlay_restore import OverlayWindowState

        blocked = threading.Event()
        released = threading.Event()
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            proc.next_behavior = {"immediate": False, "exit_code": None, "stdout": "", "stderr": ""}

            def wait_block(pid):
                blocked.set()
                released.wait(timeout=5)
                proc.procs[pid]["exit"] = 1
                proc.procs[pid]["alive"] = False
                return 1

            proc.wait_nonblocking = wait_block  # type: ignore[method-assign]
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, _deleted = helper._common(td, proc, cap)

            def apply():
                apply_overlays()
                pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"] = "true"

            windows = OverlayWindowState(
                worker_app="aisandbox-ai-service",
                gateway_app="aisandbox-api-gateway",
                worker_limit_sec=0.1,
                gateway_limit_sec=300,
                restore_reserve_sec=0.0,
            )
            holder: dict = {}

            def run() -> None:
                holder["r"] = orchestrate(
                    which="stub",
                    workdir=str(work),
                    vault_dir=str(vault),
                    submit_argv=["/usr/bin/node", str(work / "c.js")],
                    submit_env={},
                    expected_js=str(work / "c.js"),
                    overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                    captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                    pm2=pm2,
                    proc=proc,
                    capture_adapter=cap,
                    exec_helper="helper",
                    resolv_conf="nameserver 172.26.0.1\n",
                    **_cov(),
                    hmac_absent_empty_authorized=True,
                    reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                    apply_overlays=apply,
                    delete_vault=delete_vault,
                    capture_tail_sec=0,
                    overlay_windows=windows,
                    now=time.monotonic,
                    sleep=time.sleep,
                )

            thread = threading.Thread(target=run)
            thread.start()
            self.assertTrue(blocked.wait(timeout=5))
            time.sleep(0.201)
            still_blocked = not released.is_set()
            overlay = pm2.apps["aisandbox-ai-service"].get("GLOBAL_EXECUTION_ENABLED")
            released.set()
            thread.join(timeout=10)
            self.assertTrue(still_blocked)
            self.assertEqual(overlay, "false")
            self.assertTrue(thread.is_alive() is False)
            result = holder["r"]
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("WORKER_WINDOW_EXCEEDED", result.reasons)
            self.assertTrue(result.vault_preserved or os.path.isdir(str(vault)))

    def test_ipv4_only_observation_without_ipv6_inspection_rejects(self) -> None:
        from coverage import FAMILY_NOT_OBSERVED, FAMILY_PRESENT, assess_coverage

        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            now_unix=1_800_000_000,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(report.ok)
        self.assertEqual(report.code, "EVIDENCE_IPV4_NOT_OBSERVED")
        self.assertEqual(report.ipv6_status, FAMILY_NOT_OBSERVED)

        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            evidence=_make_evidence(include_ipv6=False, ipv4_output=VALID_ROUTE_TABLE, checked_at_unix=1_800_000_000),
            now_unix=1_800_000_000,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(report.ok)
        self.assertEqual(report.code, "EVIDENCE_IPV6_NOT_OBSERVED")
        self.assertEqual(report.ipv4_status, FAMILY_PRESENT)
        self.assertEqual(report.ipv6_status, FAMILY_NOT_OBSERVED)

    def test_successful_empty_ipv6_inspection_is_observed_absent(self) -> None:
        from coverage import FAMILY_OBSERVED_ABSENT, FAMILY_PRESENT, assess_coverage

        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6="",
            evidence=_make_evidence(
                ipv4_output=VALID_ROUTE_TABLE,
                ipv6_output="",
                checked_at_unix=1_800_000_000,
            ),
            now_unix=1_800_000_000,
            expected_hostname=_TEST_HOST,
        )
        self.assertTrue(report.ok)
        self.assertEqual(report.code, "COVERAGE_OK")
        self.assertEqual(report.ipv4_status, FAMILY_PRESENT)
        self.assertEqual(report.ipv6_status, FAMILY_OBSERVED_ABSENT)

    def test_failed_ipv6_inspection_with_empty_output_rejects(self) -> None:
        from coverage import assess_coverage

        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6="",
            evidence=_make_evidence(
                ipv4_output=VALID_ROUTE_TABLE,
                ipv6_output="",
                ipv6_success=False,
                checked_at_unix=1_800_000_000,
            ),
            now_unix=1_800_000_000,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(report.ok)
        self.assertEqual(report.code, "EVIDENCE_IPV6_FAILED")

    def test_missing_or_mismatched_host_timestamp_output_binding_rejects(self) -> None:
        from coverage import assess_coverage

        fresh = 1_800_000_000
        bound = _make_evidence(ipv4_output=VALID_ROUTE_TABLE, ipv6_output="", checked_at_unix=fresh)
        host_mismatch = _make_evidence(
            ipv4_output=VALID_ROUTE_TABLE,
            ipv6_output="",
            hostname="other-host",
            checked_at_unix=fresh,
        )
        stale = _make_evidence(
            ipv4_output=VALID_ROUTE_TABLE,
            ipv6_output="",
            checked_at_unix=fresh - 7200,
        )
        bad_hash = _make_evidence(
            ipv4_output=VALID_ROUTE_TABLE,
            ipv6_output="",
            ipv6_hash=_ev_hash("not-the-v6-output\n"),
            checked_at_unix=fresh,
        )
        missing_ts = dict(bound)
        del missing_ts["checked_at_unix"]

        cases = [
            ("host", host_mismatch, "EVIDENCE_HOST_MISMATCH"),
            ("stale", stale, "EVIDENCE_STALE"),
            ("hash", bad_hash, "EVIDENCE_IPV6_BINDING_MISMATCH"),
            ("ts", missing_ts, "EVIDENCE_TIMESTAMP_MISSING"),
        ]
        for name, evidence, code in cases:
            report = assess_coverage(
                resolv_conf="nameserver 172.26.0.1\n",
                route_table=VALID_ROUTE_TABLE,
                route_table_v6="",
                evidence=evidence,
                now_unix=fresh,
                expected_hostname=_TEST_HOST,
            )
            self.assertFalse(report.ok, name)
            self.assertEqual(report.code, code, name)

        unrelated = {
            "schema": "AISB_01C6A_PREFLIGHT_COVERAGE_V1",
            "hostname": _TEST_HOST,
            "checked_at_unix": fresh,
            "interfaces": ["ens5"],
            "nameservers": ["172.26.0.1"],
            "default_ipv4_dev": "ens5",
            "ipv4": {
                "inspection": "ip route show",
                "success": True,
                "output_sha256": _ev_hash("default via 10.0.0.1 dev ens5\n"),
            },
            "ipv6": {
                "inspection": "ip -6 route show",
                "success": True,
                "output_sha256": _ev_hash(""),
            },
        }
        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6="",
            evidence=bound,
            preflight=unrelated,
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(report.ok)
        self.assertEqual(report.code, "PREFLIGHT_OUTPUT_BINDING_MISMATCH")

        generic = {
            "schema": "AISB_01C6A_PREFLIGHT_COVERAGE_V1",
            "hostname": _TEST_HOST,
            "checked_at_unix": fresh,
            "interfaces": ["ens5"],
            "nameservers": ["172.26.0.1"],
            "default_dev": "ens5",
        }
        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table="",
            preflight=generic,
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(report.ok)
        self.assertIn(
            report.code,
            ("PREFLIGHT_GENERIC_DEFAULT_DEV", "EVIDENCE_IPV4_NOT_OBSERVED"),
        )

        ipv4_as_v6 = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6=VALID_ROUTE_TABLE,
            evidence=_make_evidence(
                ipv4_output=VALID_ROUTE_TABLE,
                ipv6_output=VALID_ROUTE_TABLE,
                checked_at_unix=fresh,
            ),
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertFalse(ipv4_as_v6.ok)
        self.assertEqual(ipv4_as_v6.code, "EVIDENCE_IPV6_OUTPUT_WRONG_FAMILY")

    def test_valid_observations_for_both_families_accept(self) -> None:
        from coverage import FAMILY_OBSERVED_ABSENT, FAMILY_PRESENT, assess_coverage

        fresh = 1_800_000_000
        report = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\nnameserver 2001:4860:4860::8888\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6=VALID_ROUTE_TABLE_V6_DEFAULT,
            evidence=_make_evidence(
                ipv4_output=VALID_ROUTE_TABLE,
                ipv6_output=VALID_ROUTE_TABLE_V6_DEFAULT,
                checked_at_unix=fresh,
            ),
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertTrue(report.ok, report.code)
        self.assertEqual(report.ipv4_status, FAMILY_PRESENT)
        self.assertEqual(report.ipv6_status, FAMILY_PRESENT)

        empty_v6 = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            route_table=VALID_ROUTE_TABLE,
            route_table_v6="",
            evidence=_make_evidence(
                ipv4_output=VALID_ROUTE_TABLE,
                ipv6_output="",
                checked_at_unix=fresh,
            ),
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertTrue(empty_v6.ok, empty_v6.code)
        self.assertEqual(empty_v6.ipv6_status, FAMILY_OBSERVED_ABSENT)

        preflight = {
            "schema": "AISB_01C6A_PREFLIGHT_COVERAGE_V1",
            "hostname": _TEST_HOST,
            "checked_at_unix": fresh,
            "interfaces": ["ens5"],
            "nameservers": ["172.26.0.1"],
            "default_ipv4_dev": "ens5",
            "ipv4_output": VALID_ROUTE_TABLE,
            "ipv6_output": "",
            "ipv4": {
                "inspection": "ip route show",
                "success": True,
                "output_sha256": _ev_hash(VALID_ROUTE_TABLE),
            },
            "ipv6": {
                "inspection": "ip -6 route show",
                "success": True,
                "output_sha256": _ev_hash(""),
            },
        }
        via_preflight = assess_coverage(
            resolv_conf="nameserver 172.26.0.1\n",
            preflight=preflight,
            now_unix=fresh,
            expected_hostname=_TEST_HOST,
        )
        self.assertTrue(via_preflight.ok, via_preflight.code)
        self.assertEqual(via_preflight.ipv4_status, FAMILY_PRESENT)
        self.assertEqual(via_preflight.ipv6_status, FAMILY_OBSERVED_ABSENT)

    def test_invalid_coverage_through_orchestrator_zero_mutation_zero_submit(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            proc = FakeProc()
            cap = FakeCapture()
            helper = OrchestrateFailurePathTests()
            vault, work, pm2, apply_overlays, delete_vault, _deleted = helper._common(td, proc, cap)
            applied = {"n": 0}

            def apply():
                applied["n"] += 1
                apply_overlays()

            result = orchestrate(
                which="stub",
                workdir=str(work),
                vault_dir=str(vault),
                submit_argv=["/usr/bin/node", str(work / "c.js")],
                submit_env={},
                expected_js=str(work / "c.js"),
                overlay_apps=["aisandbox-api-gateway", "aisandbox-ai-service"],
                captured_overlay={"GLOBAL_EXECUTION_ENABLED": "false"},
                pm2=pm2,
                proc=proc,
                capture_adapter=cap,
                exec_helper="helper",
                resolv_conf="nameserver 172.26.0.1\n",
                route_table=VALID_ROUTE_TABLE,
                hmac_absent_empty_authorized=True,
                reconcile_runner=lambda env, tmo: (3, "", "", False, False),
                apply_overlays=apply,
                delete_vault=delete_vault,
                capture_tail_sec=0,
            )
            self.assertEqual(applied["n"], 0)
            self.assertFalse(proc.spawn_calls)
            self.assertEqual(pm2.apps["aisandbox-ai-service"]["GLOBAL_EXECUTION_ENABLED"], "false")
            self.assertEqual(result.classification, "INCOMPLETE")
            self.assertIn("EVIDENCE_IPV4_NOT_OBSERVED", result.reasons)


if __name__ == "__main__":
    unittest.main(verbosity=2)
