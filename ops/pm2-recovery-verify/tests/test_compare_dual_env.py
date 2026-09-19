"""PM2-RECOVERY-VERIFY-01 -- fake-only test suite for compare_dual_env.py (groups T1-T12).

Every fixture is a literal JSON document written under TMPDIR. No PM2, no
network, no real secret. Every subprocess spawn is [sys.executable, ...].
Leak assertions are boolean assertions with constant messages so that a
failing test never prints a sentinel or a captured stream.
"""

import ast
import contextlib
import hashlib
import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
TOOL_DIR = os.path.dirname(HERE)
sys.path.insert(0, TOOL_DIR)

import compare_dual_env as cde  # noqa: E402  (after sys.path insert, by design)

F1 = os.path.join(TOOL_DIR, "compare_dual_env.py")
F2 = os.path.abspath(__file__)
F3 = os.path.join(TOOL_DIR, "README.md")
F4 = os.path.join(TOOL_DIR, "SHA256SUMS")
F5 = os.path.join(TOOL_DIR, ".gitattributes")
REPO_ROOT = os.path.dirname(os.path.dirname(TOOL_DIR))
R3_LIB = os.path.join(REPO_ROOT, "ops", "aisb-01c6a-operator-bundle", "lib")

SENTINEL = "SENTINEL-NOT-A-SECRET-" + os.urandom(8).hex()
TS = "2026-09-19T00:00:00Z"
HOST = "host-1.example"
APP = "app-a"
APP2 = "app-b"

F1_IMPORT_ALLOWLIST = frozenset({
    "__future__", "dataclasses", "datetime", "hashlib", "json", "os", "re", "stat", "sys", "typing",
})


# ---------------------------------------------------------------------------
# Fixture builders
# ---------------------------------------------------------------------------


def fset(value):
    return {"state": "SET", "value": value}


def ftok(value):
    return {"state": "SET", "token": cde.token_for(value)}


def fempty():
    return {"state": "EMPTY"}


def fabsent():
    return {"state": "ABSENT"}


def key(protected, top, nested=None):
    if nested is None:
        nested = dict(top)
    return {"protected": protected, "pm2_env": top, "pm2_env.env": nested}


def provenance(**over):
    doc = {
        "declared_by": "operator-fixture",
        "source_kind": "OTHER",
        "source": "fixture-source",
        "declared_at": TS,
        "authorization_record": "fixture-record",
    }
    doc.update(over)
    return doc


def default_apps():
    return {
        APP: {
            "keys": {
                "PLAIN_KEY": key(False, fset("plain-value")),
                "XAI_API_KEY": key(True, ftok("fixture-secret-value")),
                "EMPTY_KEY": key(False, fempty()),
                "ABSENT_KEY": key(False, fabsent()),
            }
        }
    }


def reference(apps=None, **over):
    doc = {
        "schema": cde.SCHEMA_REFERENCE,
        "reference_id": "ref-1",
        "host": HOST,
        "provenance": provenance(),
        "apps": apps if apps is not None else default_apps(),
    }
    doc.update(over)
    return doc


def default_env():
    return {
        "PLAIN_KEY": "plain-value",
        "XAI_API_KEY": "fixture-secret-value",
        "EMPTY_KEY": "",
        "UNRELATED_KEY": "unrelated-value",
    }


def process(name, top_env=None, nested_env=None, extra=None):
    top = dict(default_env() if top_env is None else top_env)
    nested = dict(top if nested_env is None else nested_env)
    top["env"] = nested
    top["status"] = "online"
    top["pm_cwd"] = "/srv/app"
    doc = {"name": name, "pid": 100, "pm_id": 0, "monit": {"memory": 1, "cpu": 0}, "pm2_env": top}
    if extra:
        doc.update(extra)
    return doc


def jlist_bytes(processes):
    return (json.dumps(processes, indent=1) + "\n").encode("utf-8")


def meta(jlist_data, **over):
    doc = {
        "schema": cde.SCHEMA_OBSERVATION_META,
        "observation_id": "obs-1",
        "host": HOST,
        "captured_at": TS,
        "captured_by": "operator-fixture",
        "acquisition_record": "E2-fixture",
        "jlist_sha256": hashlib.sha256(jlist_data).hexdigest(),
    }
    doc.update(over)
    return doc


def now_plus(seconds):
    return cde.format_timestamp(cde.now_utc() + cde.datetime.timedelta(seconds=seconds))


def write_json(path, doc):
    with open(path, "wb") as handle:
        handle.write((json.dumps(doc, indent=1) + "\n").encode("utf-8"))
    return path


def write_bytes(path, data):
    with open(path, "wb") as handle:
        handle.write(data)
    return path


def sha256_file(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def contains_token(text):
    index = text.find("sha256:")
    while index != -1:
        segment = text[index + 7:index + 71]
        if len(segment) == 64 and all(c in "0123456789abcdef" for c in segment):
            return True
        index = text.find("sha256:", index + 1)
    return False


def run_cli(args, cwd=None, env=None):
    proc = subprocess.run(
        [sys.executable, F1] + list(args),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=env,
        timeout=120,
    )
    return proc.returncode, proc.stdout.decode("utf-8", "replace"), proc.stderr.decode("utf-8", "replace")


def run_main(args):
    out = io.StringIO()
    err = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = cde.main(list(args))
    return code, out.getvalue(), err.getvalue()


def parse_report(stdout):
    return json.loads(stdout)


def codes(report):
    return sorted(e["code"] for e in report["errors"])


class Fixture:
    """One Mode A input set (reference, meta, jlist) written under a temp directory."""

    def __init__(self, directory, ref_doc=None, processes=None, meta_over=None, names=None):
        names = names or {}
        self.directory = directory
        self.ref_path = os.path.join(directory, names.get("reference", "reference.json"))
        self.meta_path = os.path.join(directory, names.get("meta", "observation-meta.json"))
        self.jlist_path = os.path.join(directory, names.get("jlist", "jlist.json"))
        write_json(self.ref_path, ref_doc if ref_doc is not None else reference())
        data = jlist_bytes(processes if processes is not None else [process(APP)])
        write_bytes(self.jlist_path, data)
        write_json(self.meta_path, meta(data, **(meta_over or {})))

    def args(self, *extra):
        return ["--reference", self.ref_path, "--observation-meta", self.meta_path, "--jlist", self.jlist_path] + list(extra)

    def hashes(self):
        return [sha256_file(p) for p in (self.ref_path, self.meta_path, self.jlist_path)]


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    def subdir(self, name="case"):
        path = tempfile.mkdtemp(prefix=name + "-", dir=self.tmp)
        return path

    def assert_invalid(self, rc, out, expected_codes):
        report = parse_report(out)
        self.assertEqual(rc, 2)
        self.assertEqual(report["result"], "INVALID_INPUT")
        self.assertEqual(report["exit_code"], 2)
        self.assertEqual(report["apps"], {})
        self.assertEqual(report["counts"], {"apps": 0, "keys": 0, "match": 0, "mismatch": 0, "divergent": 0})
        for code in expected_codes:
            self.assertIn(code, codes(report))
        return report

    def assert_leak_free(self, *texts):
        for text in texts:
            self.assertFalse(SENTINEL in text, "sentinel leaked into a class-A output")
            self.assertFalse(contains_token(text), "a sha256 token leaked into a class-A output")


# ---------------------------------------------------------------------------
# T1 truth table
# ---------------------------------------------------------------------------


class T1TruthTable(Base):
    def _rows(self, protected):
        make = (lambda v: cde.FieldSpec("SET", token=cde.token_for(v))) if protected else (lambda v: cde.FieldSpec("SET", value=v))
        r_set, o_same, o_other = make("a"), make("a"), make("b")
        empty, absent = cde.FieldSpec("EMPTY"), cde.FieldSpec("ABSENT")
        expected = {
            ("ABSENT", "ABSENT"): "MATCH", ("ABSENT", "EMPTY"): "MISMATCH", ("ABSENT", "SET a"): "MISMATCH", ("ABSENT", "SET b"): "MISMATCH",
            ("EMPTY", "EMPTY"): "MATCH", ("EMPTY", "ABSENT"): "MISMATCH", ("EMPTY", "SET a"): "MISMATCH", ("EMPTY", "SET b"): "MISMATCH",
            ("SET a", "SET a"): "MATCH", ("SET a", "SET b"): "MISMATCH", ("SET a", "ABSENT"): "MISMATCH", ("SET a", "EMPTY"): "MISMATCH",
        }
        specs = {"SET a": r_set, "EMPTY": empty, "ABSENT": absent}
        observed = {"SET a": o_same, "SET b": o_other, "EMPTY": empty, "ABSENT": absent}
        for r_name, r_spec in specs.items():
            for o_name, o_spec in observed.items():
                with self.subTest(protected=protected, reference=r_name, observed=o_name):
                    self.assertEqual(cde.compare_field(r_spec, o_spec, protected), expected[(r_name, o_name)])
        return len(expected)

    def test_t1_truth_table_non_protected(self):
        self.assertEqual(self._rows(False), 12)

    def test_t1_truth_table_protected(self):
        self.assertEqual(self._rows(True), 12)

    def test_t1_end_to_end_match_exit_0(self):
        fx = Fixture(self.subdir())
        rc, out, err = run_cli(fx.args())
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertEqual(report["result"], "MATCH")
        self.assertEqual(report["exit_code"], 0)
        self.assertEqual(report["mode"], "A")
        self.assertEqual(report["counts"], {"apps": 1, "keys": 4, "match": 4, "mismatch": 0, "divergent": 0})
        self.assertEqual(report["apps"][APP]["result"], "MATCH")
        self.assertTrue(err.startswith("PM2_DUAL_ENV_COMPARE result=MATCH exit=0 mode=A apps=1 keys=4 match=4"))
        self.assertIn("evidence_only=true", err)
        self.assertEqual(report["errors"], [])

    def test_t1_end_to_end_mismatch_exit_3(self):
        env = default_env()
        env["PLAIN_KEY"] = "other-value"
        fx = Fixture(self.subdir(), processes=[process(APP, env)])
        rc, out, _ = run_cli(fx.args())
        report = parse_report(out)
        self.assertEqual(rc, 3)
        self.assertEqual(report["result"], "MISMATCH")
        key_report = report["apps"][APP]["keys"]["PLAIN_KEY"]
        self.assertEqual(key_report["result"], "MISMATCH")
        self.assertFalse(key_report["divergent"])
        self.assertEqual(key_report["pm2_env"]["field_result"], "MISMATCH")
        self.assertEqual(key_report["pm2_env"]["expected_value"], "plain-value")
        self.assertEqual(key_report["pm2_env"]["observed_value"], "other-value")
        self.assertEqual(report["counts"]["mismatch"], 1)
        self.assertEqual(report["counts"]["match"], 3)


# ---------------------------------------------------------------------------
# T2 divergence
# ---------------------------------------------------------------------------


class T2Divergence(Base):
    def test_t2_divergent_state_or_value(self):
        value_a = cde.FieldSpec("SET", value="a")
        value_b = cde.FieldSpec("SET", value="b")
        token_a = cde.FieldSpec("SET", token=cde.token_for("a"))
        token_b = cde.FieldSpec("SET", token=cde.token_for("b"))
        empty, absent = cde.FieldSpec("EMPTY"), cde.FieldSpec("ABSENT")
        self.assertTrue(cde.is_divergent(value_a, value_b, False))
        self.assertTrue(cde.is_divergent(token_a, token_b, True))
        self.assertTrue(cde.is_divergent(value_a, empty, False))
        self.assertTrue(cde.is_divergent(empty, absent, False))
        self.assertTrue(cde.is_divergent(absent, token_a, True))
        self.assertFalse(cde.is_divergent(value_a, value_a, False))
        self.assertFalse(cde.is_divergent(token_a, token_a, True))
        self.assertFalse(cde.is_divergent(empty, empty, False))
        self.assertFalse(cde.is_divergent(absent, absent, True))
        # DIVERGENT is reported even when one field matches the reference
        ref_apps = {APP: {"K": cde.KeySpec(False, value_a, value_a)}}
        obs_apps = {APP: {"K": cde.KeySpec(False, value_a, value_b)}}
        result, apps, counts = cde.compare_apps(ref_apps, obs_apps)
        self.assertEqual(result, "DIVERGENT")
        self.assertEqual(apps[APP]["keys"]["K"]["result"], "DIVERGENT")
        self.assertTrue(apps[APP]["keys"]["K"]["divergent"])
        self.assertEqual(apps[APP]["keys"]["K"]["pm2_env"]["field_result"], "MATCH")
        self.assertEqual(counts["divergent"], 1)

    def test_t2_precedence_key_app_aggregate(self):
        value_a = cde.FieldSpec("SET", value="a")
        value_b = cde.FieldSpec("SET", value="b")
        ref_apps = {
            APP: {"K1": cde.KeySpec(False, value_a, value_a), "K2": cde.KeySpec(False, value_a, value_a)},
            APP2: {"K3": cde.KeySpec(False, value_a, value_a)},
        }
        obs_apps = {
            APP: {"K1": cde.KeySpec(False, value_b, value_b), "K2": cde.KeySpec(False, value_a, value_a)},
            APP2: {"K3": cde.KeySpec(False, value_a, value_a)},
        }
        result, apps, counts = cde.compare_apps(ref_apps, obs_apps)
        self.assertEqual(result, "MISMATCH")
        self.assertEqual(apps[APP]["result"], "MISMATCH")
        self.assertEqual(apps[APP2]["result"], "MATCH")
        self.assertEqual(counts, {"apps": 2, "keys": 3, "match": 2, "mismatch": 1, "divergent": 0})
        obs_apps[APP2]["K3"] = cde.KeySpec(False, value_a, value_b)
        result, apps, counts = cde.compare_apps(ref_apps, obs_apps)
        self.assertEqual(result, "DIVERGENT")
        self.assertEqual(apps[APP]["result"], "MISMATCH")
        self.assertEqual(apps[APP2]["result"], "DIVERGENT")
        self.assertEqual(counts["divergent"], 1)
        self.assertEqual(counts["mismatch"], 1)
        self.assertEqual(cde.EXIT_FOR_RESULT["DIVERGENT"], 4)
        self.assertEqual(cde.EXIT_FOR_RESULT["MISMATCH"], 3)

    def test_t2_end_to_end_divergent_exit_4(self):
        nested = default_env()
        nested["XAI_API_KEY"] = "another-secret-value"
        fx = Fixture(self.subdir(), processes=[process(APP, default_env(), nested)])
        rc, out, err = run_cli(fx.args())
        report = parse_report(out)
        self.assertEqual(rc, 4)
        self.assertEqual(report["result"], "DIVERGENT")
        key_report = report["apps"][APP]["keys"]["XAI_API_KEY"]
        self.assertTrue(key_report["divergent"])
        self.assertEqual(key_report["result"], "DIVERGENT")
        self.assertNotIn("observed_value", key_report["pm2_env"])
        self.assertNotIn("expected_value", key_report["pm2_env"])
        self.assertNotIn("token", json.dumps(key_report))
        self.assertIn("divergent=1", err)


# ---------------------------------------------------------------------------
# T3 classification
# ---------------------------------------------------------------------------


class T3Classification(Base):
    def test_t3_classify_member_states(self):
        mapping = {"E": "", "S": "v", "N": None, "I": 5, "B": True, "O": {}, "A": []}
        self.assertEqual(cde.classify_member(mapping, "missing", False)[1].state, "ABSENT")
        self.assertEqual(cde.classify_member(mapping, "E", False)[1].state, "EMPTY")
        spec = cde.classify_member(mapping, "S", False)[1]
        self.assertEqual((spec.state, spec.value, spec.token), ("SET", "v", None))
        spec = cde.classify_member(mapping, "S", True)[1]
        self.assertEqual((spec.state, spec.value, spec.token), ("SET", None, cde.token_for("v")))
        self.assertEqual(cde.classify_member(mapping, "N", False)[0], "NULL_VALUE")
        for name in ("I", "B", "O", "A"):
            self.assertEqual(cde.classify_member(mapping, name, False)[0], "NON_STRING_VALUE")

    def test_t3_null_and_non_string_end_to_end(self):
        top = default_env()
        top["PLAIN_KEY"] = None
        nested = default_env()
        nested["EMPTY_KEY"] = 7
        fx = Fixture(self.subdir(), processes=[process(APP, top, nested)])
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["NULL_VALUE", "NON_STRING_VALUE"])
        paths = sorted(e["path"] for e in report["errors"])
        self.assertEqual(paths, ["/0/pm2_env/PLAIN_KEY", "/0/pm2_env/env/EMPTY_KEY"])
        # identifiers were validated before the classification stage and are therefore echoed
        self.assertEqual(report["reference"]["reference_id"], "ref-1")
        self.assertEqual(report["observation"]["observation_id"], "obs-1")

    def test_t3_env_reserved_key_name(self):
        apps = default_apps()
        apps[APP]["keys"]["env"] = key(False, fset("x"))
        fx = Fixture(self.subdir(), ref_doc=reference(apps=apps))
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["RESERVED_KEY_NAME"])
        self.assertIn("/apps/app-a/keys/env", [e["path"] for e in report["errors"]])


# ---------------------------------------------------------------------------
# T4 malformed / corrupt / truncated inputs
# ---------------------------------------------------------------------------


class T4Malformed(Base):
    def test_t4_not_utf8_and_bom(self):
        fx = Fixture(self.subdir())
        write_bytes(fx.ref_path, b'{"schema": "\xff\xfe"}')
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["INPUT_NOT_UTF8"])
        self.assertIn("byte offset", report["errors"][0]["detail"])
        self.assertIsNone(report["reference"]["reference_id"])
        fx2 = Fixture(self.subdir())
        write_bytes(fx2.meta_path, b"\xef\xbb\xbf" + json.dumps(meta(b"x")).encode("utf-8"))
        rc, out, _ = run_cli(fx2.args())
        self.assert_invalid(rc, out, ["INPUT_NOT_UTF8"])

    def test_t4_truncated_json(self):
        fx = Fixture(self.subdir())
        data = jlist_bytes([process(APP)])
        write_bytes(fx.jlist_path, data[: len(data) // 2])
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["JSON_SYNTAX"])
        detail = report["errors"][0]["detail"]
        self.assertIn("line", detail)
        self.assertNotIn("Expecting", detail)
        write_bytes(fx.jlist_path, b"")
        rc, out, _ = run_cli(fx.args())
        self.assert_invalid(rc, out, ["JSON_SYNTAX"])
        write_bytes(fx.jlist_path, b"[NaN]")
        rc, out, _ = run_cli(fx.args())
        self.assert_invalid(rc, out, ["JSON_SYNTAX"])

    def test_t4_duplicate_key_reference_and_jlist_unrelated_process(self):
        fx = Fixture(self.subdir())
        write_bytes(fx.ref_path, b'{"schema": "a", "schema": "b"}')
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["DUPLICATE_JSON_KEY"])
        self.assertEqual(report["errors"][0]["path"], "")
        self.assertIn("reference", report["errors"][0]["detail"])
        fx2 = Fixture(self.subdir())
        dup_name = SENTINEL + "_DUP"
        raw = (
            '[{"name": "unrelated", "pm2_env": {"' + dup_name + '": "1", "' + dup_name + '": "2", "env": {}}},'
            + json.dumps(process(APP)) + "]"
        ).encode("utf-8")
        write_bytes(fx2.jlist_path, raw)
        write_json(fx2.meta_path, meta(raw))
        rc, out, err = run_cli(fx2.args())
        report = self.assert_invalid(rc, out, ["DUPLICATE_JSON_KEY"])
        self.assertIn("jlist", report["errors"][0]["detail"])
        self.assert_leak_free(out, err)

    def test_t4_jlist_structure(self):
        cases = [
            ({"a": 1}, "JLIST_NOT_LIST", ""),
            ([process(APP), 5], "JLIST_ITEM_NOT_OBJECT", "/1"),
            ([process(APP), {"pm2_env": {}}], "JLIST_ITEM_NAME_MISSING", "/1"),
            ([process(APP), {"name": 12, "pm2_env": {}}], "JLIST_ITEM_NAME_MISSING", "/1"),
            ([process(APP), {"name": None}], "JLIST_ITEM_NAME_MISSING", "/1"),
            ([{"name": APP, "pm2_env": "x"}], "PM2_ENV_NOT_OBJECT", "/0/pm2_env"),
            ([{"name": APP}], "PM2_ENV_NOT_OBJECT", "/0/pm2_env"),
            ([{"name": APP, "pm2_env": {"PLAIN_KEY": "plain-value"}}], "NESTED_ENV_NOT_OBJECT", "/0/pm2_env/env"),
            ([{"name": APP, "pm2_env": {"env": []}}], "NESTED_ENV_NOT_OBJECT", "/0/pm2_env/env"),
        ]
        for doc, code, path in cases:
            with self.subTest(code=code):
                fx = Fixture(self.subdir())
                raw = (json.dumps(doc) + "\n").encode("utf-8")
                write_bytes(fx.jlist_path, raw)
                write_json(fx.meta_path, meta(raw))
                rc, out, _ = run_cli(fx.args())
                report = self.assert_invalid(rc, out, [code])
                self.assertEqual([e["path"] for e in report["errors"] if e["code"] == code], [path])

    def test_t4_unknown_field_every_level(self):
        ref = reference()
        ref["approved"] = True
        ref["provenance"][SENTINEL] = "x"
        ref["apps"][APP]["extra"] = 1
        ref["apps"][APP]["keys"]["PLAIN_KEY"]["approved"] = True
        ref["apps"][APP]["keys"]["PLAIN_KEY"]["pm2_env"]["note"] = "x"
        fx = Fixture(self.subdir(), ref_doc=ref)
        rc, out, err = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["UNKNOWN_FIELD"])
        paths = sorted(e["path"] for e in report["errors"] if e["code"] == "UNKNOWN_FIELD")
        self.assertEqual(paths, [
            "/<unknown-member>",
            "/apps/app-a/<unknown-member>",
            "/apps/app-a/keys/PLAIN_KEY/<unknown-member>",
            "/apps/app-a/keys/PLAIN_KEY/pm2_env/<unknown-member>",
            "/provenance/<unknown-member>",
        ])
        self.assertNotIn("approved", out)
        self.assert_leak_free(out, err)
        fx2 = Fixture(self.subdir(), meta_over={"approved": True})
        rc, out, _ = run_cli(fx2.args())
        report = self.assert_invalid(rc, out, ["UNKNOWN_FIELD"])
        self.assertEqual(report["errors"][0]["path"], "/<unknown-member>")
        # normalized observation (Mode B): root, key, field level
        fx3 = Fixture(self.subdir())
        emitted = os.path.join(fx3.directory, "normalized.json")
        rc, _, _ = run_cli(fx3.args("--emit-observation", emitted))
        self.assertEqual(rc, 0)
        with open(emitted, "rb") as handle:
            norm = json.loads(handle.read().decode("utf-8"))
        norm["approved"] = True
        norm["apps"][APP]["keys"]["PLAIN_KEY"]["approved"] = True
        norm["apps"][APP]["keys"]["PLAIN_KEY"]["pm2_env.env"]["x"] = 1
        bad = write_json(os.path.join(fx3.directory, "bad-normalized.json"), norm)
        rc, out, _ = run_cli(["--reference", fx3.ref_path, "--observation", bad])
        report = self.assert_invalid(rc, out, ["UNKNOWN_FIELD"])
        paths = sorted(e["path"] for e in report["errors"] if e["code"] == "UNKNOWN_FIELD")
        self.assertEqual(paths, [
            "/<unknown-member>",
            "/apps/app-a/keys/PLAIN_KEY/<unknown-member>",
            "/apps/app-a/keys/PLAIN_KEY/pm2_env.env/<unknown-member>",
        ])

    def test_t4_missing_protected_and_shape_violations(self):
        def with_key(spec):
            apps = default_apps()
            apps[APP]["keys"]["CANDIDATE"] = spec
            return reference(apps=apps)

        cases = [
            ("missing protected", {"pm2_env": fset("v"), "pm2_env.env": fset("v")}, "MISSING_FIELD", "/apps/app-a/keys/CANDIDATE/protected"),
            ("empty value on SET", key(False, {"state": "SET", "value": ""}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("payload on EMPTY", key(False, {"state": "EMPTY", "value": "v"}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("payload on ABSENT", key(True, {"state": "ABSENT", "token": cde.token_for("v")}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("token on non-protected", key(False, {"state": "SET", "token": cde.token_for("v")}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("value on protected", key(True, {"state": "SET", "value": SENTINEL}), "PROTECTED_VALUE_IN_REFERENCE", "/apps/app-a/keys/CANDIDATE/pm2_env/value"),
            ("both members", key(False, {"state": "SET", "value": "v", "token": cde.token_for("v")}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("null value", key(False, {"state": "SET", "value": None}), "EXPECTATION_SHAPE", "/apps/app-a/keys/CANDIDATE/pm2_env"),
            ("bad token format", key(True, {"state": "SET", "token": "sha256:zz"}), "TOKEN_FORMAT", "/apps/app-a/keys/CANDIDATE/pm2_env/token"),
            ("bad state", key(False, {"state": "MAYBE"}), "WRONG_TYPE", "/apps/app-a/keys/CANDIDATE/pm2_env/state"),
            ("missing state", key(False, {"value": "v"}), "MISSING_FIELD", "/apps/app-a/keys/CANDIDATE/pm2_env/state"),
        ]
        for label, spec, code, path in cases:
            with self.subTest(case=label):
                fx = Fixture(self.subdir(), ref_doc=with_key(spec))
                rc, out, err = run_cli(fx.args())
                report = self.assert_invalid(rc, out, [code])
                self.assertIn(path, [e["path"] for e in report["errors"] if e["code"] == code])
                self.assert_leak_free(out, err)
        # "value on protected" is additionally reported as a shape violation and never echoed
        fx = Fixture(self.subdir(), ref_doc=with_key(key(True, {"state": "SET", "value": SENTINEL})))
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["PROTECTED_VALUE_IN_REFERENCE", "EXPECTATION_SHAPE"])
        self.assertFalse(SENTINEL in out, "protected reference value leaked")

    def test_t4_protected_name_declared_unprotected(self):
        for name in ("XAI_API_KEY", "MY_PASSWORD", "some_token_x", "REDIS_URL", "Bearer_Thing"):
            with self.subTest(name=name):
                apps = default_apps()
                apps[APP]["keys"][name] = key(False, fset("v"))
                fx = Fixture(self.subdir(), ref_doc=reference(apps=apps))
                rc, out, _ = run_cli(fx.args())
                report = self.assert_invalid(rc, out, ["PROTECTED_NAME_DECLARED_UNPROTECTED"])
                self.assertIn("/apps/app-a/keys/" + name + "/protected", [e["path"] for e in report["errors"]])

    def test_t4_reference_fields_inconsistent(self):
        apps = default_apps()
        apps[APP]["keys"]["PLAIN_KEY"] = key(False, fset("a"), fset("b"))
        apps[APP]["keys"]["EMPTY_KEY"] = key(False, fempty(), fabsent())
        fx = Fixture(self.subdir(), ref_doc=reference(apps=apps))
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["REFERENCE_FIELDS_INCONSISTENT"])
        paths = sorted(e["path"] for e in report["errors"])
        self.assertEqual(paths, ["/apps/app-a/keys/EMPTY_KEY", "/apps/app-a/keys/PLAIN_KEY"])

    def test_t4_validity_window_inverted_and_schema_id(self):
        fx = Fixture(self.subdir(), ref_doc=reference(valid_from="2026-09-19T01:00:00Z", valid_until="2026-09-19T00:00:00Z"))
        rc, out, _ = run_cli(fx.args())
        self.assert_invalid(rc, out, ["VALIDITY_WINDOW_INVERTED"])
        fx2 = Fixture(self.subdir(), ref_doc=reference(schema="aisb.other.v9"))
        rc, out, _ = run_cli(fx2.args())
        self.assert_invalid(rc, out, ["SCHEMA_ID_MISMATCH"])
        fx3 = Fixture(self.subdir(), ref_doc=reference(valid_from="2026-09-19 00:00:00", host="bad host", reference_id="/x", daemon_pid=0))
        rc, out, _ = run_cli(fx3.args())
        report = self.assert_invalid(rc, out, ["TIMESTAMP_FORMAT", "IDENTIFIER_FORMAT", "WRONG_TYPE"])
        self.assertIsNone(report["reference"]["reference_id"])
        self.assertIsNone(report["reference"]["host"])
        self.assertNotIn("bad host", out)

    def test_t4_oversize_input(self):
        fx = Fixture(self.subdir())
        big = b"[" + b" " * (16 * 1024 * 1024) + b"]"
        write_bytes(fx.jlist_path, big)
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["INPUT_TOO_LARGE"])
        self.assertIn("jlist", report["errors"][0]["detail"])

    def test_t4_unreadable_inputs(self):
        fx = Fixture(self.subdir())
        missing = os.path.join(fx.directory, SENTINEL + "-missing.json")
        rc, out, err = run_cli(["--reference", missing, "--observation-meta", fx.meta_path, "--jlist", fx.jlist_path])
        report = self.assert_invalid(rc, out, ["INPUT_UNREADABLE"])
        self.assertEqual(report["errors"][0]["path"], "")
        self.assertIn("reference", report["errors"][0]["detail"])
        self.assertIsNone(report["reference"]["reference_id"])
        self.assert_leak_free(out, err)
        rc, out, _ = run_cli(["--reference", fx.directory, "--observation-meta", fx.meta_path, "--jlist", fx.jlist_path])
        self.assert_invalid(rc, out, ["INPUT_UNREADABLE"])
        # every unreadable input of the stage is reported together
        rc, out, _ = run_cli(["--reference", missing, "--observation-meta", missing, "--jlist", fx.jlist_path])
        report = self.assert_invalid(rc, out, ["INPUT_UNREADABLE"])
        self.assertEqual(len(report["errors"]), 2)
        if os.name == "posix":
            link = os.path.join(fx.directory, "link.json")
            os.symlink(fx.ref_path, link)
            rc, out, _ = run_cli(["--reference", link, "--observation-meta", fx.meta_path, "--jlist", fx.jlist_path])
            self.assert_invalid(rc, out, ["INPUT_UNREADABLE"])
            if os.geteuid() != 0:
                os.chmod(fx.ref_path, 0)
                try:
                    rc, out, _ = run_cli(fx.args())
                    self.assert_invalid(rc, out, ["INPUT_UNREADABLE"])
                finally:
                    os.chmod(fx.ref_path, 0o600)

    def test_t4_invalid_input_report_shape(self):
        fx = Fixture(self.subdir())
        write_bytes(fx.ref_path, b"{")
        rc, out, err = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["JSON_SYNTAX"])
        self.assertEqual(report["mode"], "A")
        for member in ("reference_id", "host", "daemon_pid", "valid_from", "valid_until", "pm2_home_declared", "provenance_source_kind"):
            self.assertIsNone(report["reference"][member])
        self.assertEqual(report["reference"]["authority"], "NOT_EVALUATED_BY_VERIFIER")
        for member in ("observation_id", "host", "daemon_pid", "captured_at", "pm2_home_declared", "provenance_fields_present", "jlist_sha256", "source", "jlist_hash_verified"):
            self.assertIsNone(report["observation"][member])
        self.assertEqual(report["identity"], {"host_checked": False, "pm2_home_checked": False, "daemon_pid_checked": False})
        self.assertFalse(report["freshness"]["validity_window_checked"])
        self.assertTrue(report["freshness"]["future_check_applied"])
        self.assertIsNone(report["freshness"]["age_seconds_at_evaluation"])
        self.assertTrue(err.startswith("PM2_DUAL_ENV_COMPARE result=INVALID_INPUT exit=2 mode=A apps=0 keys=0 match=0 mismatch=0 divergent=0 reference=- observation=- evidence_only=true"))
        self.assertEqual(report["non_claims"], cde.NON_CLAIMS)


# ---------------------------------------------------------------------------
# T5 apps / keys / raw-jlist scope
# ---------------------------------------------------------------------------


class T5Scope(Base):
    def test_t5_app_missing_duplicate(self):
        fx = Fixture(self.subdir(), processes=[process("other")])
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["APP_MISSING"])
        self.assertIn(APP, report["errors"][0]["detail"])
        self.assertNotIn("other", out)
        fx2 = Fixture(self.subdir(), processes=[process(APP), process(APP)])
        rc, out, _ = run_cli(fx2.args())
        self.assert_invalid(rc, out, ["APP_DUPLICATE"])

    def test_t5_no_apps_no_keys(self):
        fx = Fixture(self.subdir(), ref_doc=reference(apps={}))
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["NO_APPS"])
        self.assertEqual(report["errors"][0]["path"], "/apps")
        fx2 = Fixture(self.subdir(), ref_doc=reference(apps={APP: {"keys": {}}}))
        rc, out, _ = run_cli(fx2.args())
        report = self.assert_invalid(rc, out, ["NO_KEYS"])
        self.assertEqual(report["errors"][0]["path"], "/apps/app-a/keys")

    def test_t5_unrelated_processes_skipped_and_metadata_ignored(self):
        unrelated_a = {"name": "other-a", "pm2_env": "not-an-object", SENTINEL + "_M": SENTINEL}
        unrelated_b = {"name": "other-b", "pm2_env": {SENTINEL + "_ENV": SENTINEL, "PLAIN_KEY": SENTINEL}}
        selected = process(APP, extra={"pm_uptime": 1, "created_at": 2, "custom": {"deep": [1, 2]}})
        selected["pm2_env"][SENTINEL + "_UNRELATED"] = SENTINEL
        selected["pm2_env"]["env"][SENTINEL + "_UNRELATED"] = SENTINEL
        selected["pm2_env"]["exec_interpreter"] = "node"
        fx = Fixture(self.subdir(), processes=[unrelated_a, selected, unrelated_b])
        rc, out, err = run_cli(fx.args())
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertEqual(report["result"], "MATCH")
        self.assertEqual(sorted(report["apps"].keys()), [APP])
        self.assertEqual(sorted(report["apps"][APP]["keys"].keys()), ["ABSENT_KEY", "EMPTY_KEY", "PLAIN_KEY", "XAI_API_KEY"])
        self.assertEqual(report["errors"], [])
        self.assertNotIn("other-a", out)
        self.assertNotIn("other-b", out)
        self.assertNotIn("UNKNOWN_FIELD", out)
        self.assertNotIn("exec_interpreter", out)
        self.assert_leak_free(out, err)

    def test_t5_unnamed_element_rejected(self):
        fx = Fixture(self.subdir(), processes=[{"pm2_env": {"env": {}}}, process(APP)])
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["JLIST_ITEM_NAME_MISSING"])
        self.assertEqual(report["errors"][0]["path"], "/0")


# ---------------------------------------------------------------------------
# T6 identity and freshness (Mode A and Mode B)
# ---------------------------------------------------------------------------


class T6IdentityFreshness(Base):
    def _mode_b_inputs(self, directory, ref_doc=None, meta_over=None, processes=None):
        fx = Fixture(directory, ref_doc=ref_doc, meta_over=meta_over, processes=processes)
        emitted = os.path.join(directory, "normalized.json")
        rc, out, _ = run_cli(fx.args("--emit-observation", emitted))
        self.assertEqual(rc, 0, "Mode A fixture run for Mode B must MATCH")
        with open(emitted, "rb") as handle:
            norm = json.loads(handle.read().decode("utf-8"))
        return fx, norm

    def _run_b(self, fx, norm, name="norm.json"):
        path = write_json(os.path.join(fx.directory, name), norm)
        return run_cli(["--reference", fx.ref_path, "--observation", path])

    def test_t6_host_mismatch(self):
        fx = Fixture(self.subdir(), meta_over={"host": "host-2.example"})
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["HOST_MISMATCH"])
        self.assertTrue(report["identity"]["host_checked"])
        self.assertEqual(report["observation"]["host"], "host-2.example")

    def test_t6_pm2_home_and_daemon_pid_checks(self):
        both = Fixture(self.subdir(), ref_doc=reference(pm2_home="/home/a/.pm2", daemon_pid=10), meta_over={"pm2_home": "/home/b/.pm2", "daemon_pid": 11})
        rc, out, err = run_cli(both.args())
        report = self.assert_invalid(rc, out, ["PM2_HOME_MISMATCH", "DAEMON_PID_MISMATCH"])
        self.assertTrue(report["identity"]["pm2_home_checked"])
        self.assertTrue(report["identity"]["daemon_pid_checked"])
        self.assertTrue(report["reference"]["pm2_home_declared"])
        self.assertTrue(report["observation"]["pm2_home_declared"])
        self.assertNotIn(".pm2", out + err)
        only_ref = Fixture(self.subdir(), ref_doc=reference(pm2_home="/home/a/.pm2", daemon_pid=10))
        rc, out, _ = run_cli(only_ref.args())
        report = self.assert_invalid(rc, out, ["PM2_HOME_MISSING_IN_OBSERVATION", "DAEMON_PID_MISSING_IN_OBSERVATION"])
        self.assertFalse(report["identity"]["pm2_home_checked"])
        self.assertFalse(report["identity"]["daemon_pid_checked"])
        only_obs = Fixture(self.subdir(), meta_over={"pm2_home": "/home/b/.pm2", "daemon_pid": 11})
        rc, out, _ = run_cli(only_obs.args())
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertFalse(report["identity"]["pm2_home_checked"])
        self.assertFalse(report["identity"]["daemon_pid_checked"])
        self.assertTrue(report["identity"]["host_checked"])
        self.assertFalse(report["reference"]["pm2_home_declared"])
        self.assertEqual(report["observation"]["daemon_pid"], 11)
        self.assertNotIn(".pm2", out)
        same = Fixture(self.subdir(), ref_doc=reference(pm2_home="/home/a/.pm2", daemon_pid=10), meta_over={"pm2_home": "/home/a/.pm2", "daemon_pid": 10})
        rc, out, _ = run_cli(same.args())
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertTrue(report["identity"]["pm2_home_checked"])
        self.assertTrue(report["identity"]["daemon_pid_checked"])

    def test_t6_validity_window(self):
        fx = Fixture(self.subdir(), ref_doc=reference(valid_from="2026-09-19T01:00:00Z", valid_until="2026-09-19T02:00:00Z"))
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["OBSERVATION_OUTSIDE_REFERENCE_VALIDITY"])
        self.assertTrue(report["freshness"]["validity_window_checked"])
        inside = Fixture(self.subdir(), ref_doc=reference(valid_from="2026-09-18T00:00:00Z", valid_until="2026-09-20T00:00:00Z"))
        rc, out, _ = run_cli(inside.args())
        self.assertEqual(rc, 0)
        self.assertTrue(parse_report(out)["freshness"]["validity_window_checked"])

    def test_t6_future_with_and_without_max_age(self):
        fx = Fixture(self.subdir(), meta_over={"captured_at": now_plus(3600)})
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["OBSERVATION_IN_FUTURE"])
        self.assertIsNone(report["freshness"]["max_age_seconds"])
        self.assertTrue(report["freshness"]["age_seconds_at_evaluation"] < 0)
        rc, out, _ = run_cli(fx.args("--max-age-seconds", "999999"))
        report = self.assert_invalid(rc, out, ["OBSERVATION_IN_FUTURE"])
        self.assertEqual(report["freshness"]["max_age_seconds"], 999999)
        within_skew = Fixture(self.subdir(), meta_over={"captured_at": now_plus(60)})
        rc, out, _ = run_cli(within_skew.args())
        self.assertEqual(rc, 0)

    def test_t6_stale(self):
        fx = Fixture(self.subdir(), meta_over={"captured_at": now_plus(-7200)})
        rc, out, _ = run_cli(fx.args("--max-age-seconds", "3600"))
        report = self.assert_invalid(rc, out, ["OBSERVATION_STALE"])
        self.assertTrue(report["freshness"]["age_seconds_at_evaluation"] >= 7000)
        rc, out, _ = run_cli(fx.args())
        self.assertEqual(rc, 0)
        rc, out, _ = run_cli(fx.args("--max-age-seconds", "86400"))
        self.assertEqual(rc, 0)

    def test_t6_jlist_hash_mismatch(self):
        fx = Fixture(self.subdir(), meta_over={"jlist_sha256": "0" * 64})
        rc, out, _ = run_cli(fx.args())
        report = self.assert_invalid(rc, out, ["JLIST_HASH_MISMATCH"])
        self.assertIs(report["observation"]["jlist_hash_verified"], False)
        self.assertEqual(report["observation"]["source"], "RAW_JLIST")
        bad = Fixture(self.subdir(), meta_over={"jlist_sha256": "ABC"})
        rc, out, _ = run_cli(bad.args())
        self.assert_invalid(rc, out, ["IDENTIFIER_FORMAT"])

    def test_t6_mode_b_checks(self):
        fx, norm = self._mode_b_inputs(self.subdir())
        cases = []
        doc = json.loads(json.dumps(norm)); doc["normalized_at"] = "2020-01-01T00:00:00Z"
        cases.append(("timestamps", doc, "OBSERVATION_TIMESTAMPS_INCONSISTENT"))
        doc = json.loads(json.dumps(norm)); doc["reference_id"] = "ref-other"
        cases.append(("reference id", doc, "OBSERVATION_REFERENCE_ID_MISMATCH"))
        doc = json.loads(json.dumps(norm)); doc["apps"][APP]["keys"].pop("EMPTY_KEY")
        cases.append(("keyset keys", doc, "OBSERVATION_KEYSET_MISMATCH"))
        doc = json.loads(json.dumps(norm)); doc["apps"]["zzz"] = doc["apps"][APP]
        cases.append(("keyset apps", doc, "OBSERVATION_KEYSET_MISMATCH"))
        doc = json.loads(json.dumps(norm)); doc["apps"][APP]["keys"]["PLAIN_KEY"]["protected"] = True
        doc["apps"][APP]["keys"]["PLAIN_KEY"]["pm2_env"] = ftok("plain-value"); doc["apps"][APP]["keys"]["PLAIN_KEY"]["pm2_env.env"] = ftok("plain-value")
        cases.append(("protected flag", doc, "PROTECTED_FLAG_MISMATCH"))
        doc = json.loads(json.dumps(norm)); doc["apps"][APP]["keys"]["EMPTY_KEY"]["pm2_env"] = {"state": "EMPTY", "value": "x"}
        cases.append(("field shape", doc, "OBSERVATION_FIELD_SHAPE"))
        doc = json.loads(json.dumps(norm)); doc["apps"][APP]["keys"]["XAI_API_KEY"]["pm2_env"] = {"state": "SET", "value": SENTINEL}
        cases.append(("protected value", doc, "PROTECTED_VALUE_IN_OBSERVATION"))
        doc = json.loads(json.dumps(norm)); doc["apps"][APP]["keys"]["XAI_API_KEY"]["protected"] = False
        doc["apps"][APP]["keys"]["XAI_API_KEY"]["pm2_env"] = fset("v"); doc["apps"][APP]["keys"]["XAI_API_KEY"]["pm2_env.env"] = fset("v")
        cases.append(("protected name", doc, "PROTECTED_NAME_DECLARED_UNPROTECTED"))
        doc = json.loads(json.dumps(norm)); doc["host"] = "host-2.example"
        cases.append(("host", doc, "HOST_MISMATCH"))
        doc = json.loads(json.dumps(norm)); doc["captured_at"] = now_plus(4000); doc["normalized_at"] = now_plus(4000)
        cases.append(("future", doc, "OBSERVATION_IN_FUTURE"))
        doc = json.loads(json.dumps(norm)); doc.pop("captured_by")
        cases.append(("missing captured_by", doc, "MISSING_FIELD"))
        for label, doc, code in cases:
            with self.subTest(case=label):
                rc, out, err = self._run_b(fx, doc)
                report = self.assert_invalid(rc, out, [code])
                self.assertEqual(report["mode"], "B")
                self.assert_leak_free(out, err)
        # a reference declaring pm2_home / daemon_pid requires them in the normalized observation too
        ref = reference(pm2_home="/home/a/.pm2", daemon_pid=10)
        fx2, norm2 = self._mode_b_inputs(self.subdir(), ref_doc=ref, meta_over={"pm2_home": "/home/a/.pm2", "daemon_pid": 10})
        self.assertEqual(norm2["pm2_home"], "/home/a/.pm2")
        stripped = json.loads(json.dumps(norm2)); stripped.pop("pm2_home"); stripped.pop("daemon_pid")
        rc, out, _ = self._run_b(fx2, stripped)
        self.assert_invalid(rc, out, ["PM2_HOME_MISSING_IN_OBSERVATION", "DAEMON_PID_MISSING_IN_OBSERVATION"])

    def test_t6_mode_reports_hash_verified_flag(self):
        fx, norm = self._mode_b_inputs(self.subdir())
        rc, out, _ = run_cli(fx.args())
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertEqual(report["observation"]["source"], "RAW_JLIST")
        self.assertIs(report["observation"]["jlist_hash_verified"], True)
        rc, out, _ = self._run_b(fx, norm)
        report = parse_report(out)
        self.assertEqual(rc, 0)
        self.assertEqual(report["mode"], "B")
        self.assertEqual(report["observation"]["source"], "NORMALIZED")
        self.assertIs(report["observation"]["jlist_hash_verified"], False)
        self.assertEqual(report["observation"]["jlist_sha256"], norm["jlist_sha256"])
        # a declared hash in Mode B is not verified: an altered declaration still compares
        altered = json.loads(json.dumps(norm)); altered["jlist_sha256"] = "f" * 64
        rc, out, _ = self._run_b(fx, altered, "altered.json")
        self.assertEqual(rc, 0)
        self.assertEqual(parse_report(out)["observation"]["jlist_sha256"], "f" * 64)


# ---------------------------------------------------------------------------
# T7 redaction
# ---------------------------------------------------------------------------


class T7Redaction(Base):
    def _world(self, variant="match"):
        directory = tempfile.mkdtemp(prefix=SENTINEL + "-dir-", dir=self.tmp)
        secret = SENTINEL + "-secret"
        ref = reference(
            apps={APP: {"keys": {"XAI_API_KEY": key(True, ftok(secret)), "PLAIN_KEY": key(False, fset("plain-value"))}}},
            pm2_home=SENTINEL + "/pm2home",
            daemon_pid=4242,
            provenance=provenance(declared_by=SENTINEL + "-declarer", source=SENTINEL + "-source", authorization_record=SENTINEL + "-auth"),
        )
        top = {"XAI_API_KEY": secret, "PLAIN_KEY": "plain-value", SENTINEL + "_UNRELATED": SENTINEL + "-unrelated-value"}
        nested = dict(top)
        if variant == "mismatch":
            top["PLAIN_KEY"] = "changed-value"; nested["PLAIN_KEY"] = "changed-value"
        if variant == "divergent":
            nested["XAI_API_KEY"] = SENTINEL + "-other-secret"
        if variant == "null":
            top["PLAIN_KEY"] = None
        unrelated = {"name": "other", "pm2_env": {SENTINEL + "_X": SENTINEL + "-v", "env": {SENTINEL + "_Y": SENTINEL + "-w"}}, SENTINEL + "_META": SENTINEL}
        processes = [process(APP, top, nested, extra={SENTINEL + "_M": SENTINEL}), unrelated]
        if variant == "malformed-element":
            processes.append({"name": SENTINEL, "pm2_env": SENTINEL})
            processes.append({SENTINEL: SENTINEL})
        meta_over = {"pm2_home": SENTINEL + "/pm2home", "daemon_pid": 4242, "captured_by": SENTINEL + "-captor", "acquisition_record": SENTINEL + "-record"}
        if variant == "host":
            meta_over["host"] = "host-2.example"
        names = {"reference": SENTINEL + "-ref.json", "meta": SENTINEL + "-meta.json", "jlist": SENTINEL + "-jlist.json"}
        fx = Fixture(directory, ref_doc=ref, processes=processes, meta_over=meta_over, names=names)
        if variant == "unknown-member":
            doc = reference(apps=ref["apps"], pm2_home=ref["pm2_home"], daemon_pid=4242, provenance=ref["provenance"])
            doc[SENTINEL] = SENTINEL
            doc["provenance"][SENTINEL] = SENTINEL
            doc["apps"][APP]["keys"]["PLAIN_KEY"][SENTINEL] = SENTINEL
            write_json(fx.ref_path, doc)
        if variant == "dup-key":
            raw = ('[{"name": "x", "' + SENTINEL + '": 1, "' + SENTINEL + '": 2}]').encode("utf-8")
            write_bytes(fx.jlist_path, raw)
            write_json(fx.meta_path, meta(raw, **meta_over))
        if variant == "not-utf8":
            write_bytes(fx.ref_path, SENTINEL.encode("utf-8") + b"\xff")
        return fx, [secret, SENTINEL + "-other-secret", SENTINEL + "-unrelated-value"]

    def _check(self, fx, tokens_of, args, expected_rc, report_path=None):
        rc, out, err = run_cli(args)
        self.assertEqual(rc, expected_rc)
        texts = [out, err]
        if report_path is not None and os.path.exists(report_path):
            with open(report_path, "rb") as handle:
                texts.append(handle.read().decode("utf-8", "replace"))
        for text in texts:
            self.assertFalse(SENTINEL in text, "sentinel leaked into a class-A output")
            self.assertFalse(contains_token(text), "a sha256 token leaked into a class-A output")
            for value in tokens_of:
                self.assertFalse(cde.token_for(value) in text, "a protected token leaked into a class-A output")
        return out

    def test_t7_redaction_match_mismatch_divergent(self):
        for variant, rc in (("match", 0), ("mismatch", 3), ("divergent", 4)):
            with self.subTest(variant=variant):
                fx, values = self._world(variant)
                report_path = os.path.join(fx.directory, SENTINEL + "-report.json")
                out = self._check(fx, values, fx.args("--report", report_path), rc, report_path)
                report = parse_report(out)
                self.assertEqual(report["reference"]["pm2_home_declared"], True)
                self.assertNotIn("pm2_home", json.dumps(report["reference"]).replace("pm2_home_declared", ""))
                self.assertTrue(report["observation"]["provenance_fields_present"])
                self.assertEqual(report["reference"]["provenance_source_kind"], "OTHER")
                self.assertIn("plain-value", out)
                emitted = os.path.join(fx.directory, "emit.json")
                self._check(fx, values, fx.args("--emit-observation", emitted), rc)

    def test_t7_redaction_invalid_input_families(self):
        families = [
            ("not-utf8", ["INPUT_NOT_UTF8"]),
            ("dup-key", ["DUPLICATE_JSON_KEY"]),
            ("unknown-member", ["UNKNOWN_FIELD"]),
            ("host", ["HOST_MISMATCH"]),
            ("malformed-element", ["JLIST_ITEM_NAME_MISSING"]),
            ("null", ["NULL_VALUE"]),
        ]
        for variant, expected in families:
            with self.subTest(variant=variant):
                fx, values = self._world(variant)
                report_path = os.path.join(fx.directory, SENTINEL + "-report.json")
                out = self._check(fx, values, fx.args("--report", report_path), 2, report_path)
                report = parse_report(out)
                self.assertEqual(report["result"], "INVALID_INPUT")
                for code in expected:
                    self.assertIn(code, codes(report))
        # a missing input whose path carries the sentinel
        fx, values = self._world("match")
        missing = os.path.join(fx.directory, SENTINEL + "-nope.json")
        self._check(fx, values, ["--reference", missing, "--observation-meta", fx.meta_path, "--jlist", fx.jlist_path], 2)
        # a reference containing a protected raw value
        doc = reference(apps={APP: {"keys": {"XAI_API_KEY": key(True, {"state": "SET", "value": SENTINEL + "-raw"})}}})
        write_json(fx.ref_path, doc)
        out = self._check(fx, values + [SENTINEL + "-raw"], fx.args(), 2)
        self.assertIn("PROTECTED_VALUE_IN_REFERENCE", codes(parse_report(out)))

    def test_t7_redaction_cli_arguments_and_paths(self):
        fx, values = self._world("match")
        out = self._check(fx, values, ["--" + SENTINEL], 2)
        self.assertEqual(codes(parse_report(out)), ["USAGE"])
        out = self._check(fx, values, fx.args("--max-age-seconds", SENTINEL), 2)
        self.assertEqual(parse_report(out)["errors"][0]["detail"], "--max-age-seconds must be a non-negative integer")
        out = self._check(fx, values, fx.args("--max-age-seconds", "-5"), 2)
        self.assertEqual(codes(parse_report(out)), ["USAGE"])
        out = self._check(fx, values, fx.args("--reference", fx.ref_path), 2)
        self.assertEqual(parse_report(out)["errors"][0]["detail"], "argument repeated: --reference")
        out = self._check(fx, values, fx.args("--report"), 2)
        self.assertEqual(parse_report(out)["errors"][0]["detail"], "--report requires a value")
        out = self._check(fx, values, fx.args(SENTINEL), 2)
        self.assertEqual(parse_report(out)["errors"][0]["detail"], "unexpected positional argument")
        out = self._check(fx, values, ["--reference", fx.ref_path, "--observation", fx.meta_path, "--jlist", fx.jlist_path], 2)
        self.assertEqual(codes(parse_report(out)), ["USAGE"])
        existing = os.path.join(fx.directory, SENTINEL + "-existing.json")
        write_bytes(existing, b"pre-existing\n")
        out = self._check(fx, values, fx.args("--report", existing), 2)
        report = parse_report(out)
        self.assertEqual(codes(report), ["OUTPUT_EXISTS"])
        self.assertIn("report-output", report["errors"][0]["detail"])
        missing_dir = os.path.join(fx.directory, SENTINEL + "-nodir", "report.json")
        out = self._check(fx, values, fx.args("--report", missing_dir), 2)
        self.assertEqual(codes(parse_report(out)), ["OUTPUT_WRITE_FAILED"])

    def test_t7_redaction_internal_error_type_name_only(self):
        fx, values = self._world("match")
        report_path = os.path.join(fx.directory, SENTINEL + "-report.json")
        with mock.patch.object(cde, "compare_apps", side_effect=RuntimeError(SENTINEL)):
            rc, out, err = run_main(fx.args("--report", report_path))
        self.assertEqual(rc, 1)
        self.assertFalse(SENTINEL in out, "sentinel leaked into the INTERNAL_ERROR report")
        self.assertFalse(SENTINEL in err, "sentinel leaked into the INTERNAL_ERROR line")
        self.assertFalse(contains_token(out + err), "a token leaked into INTERNAL_ERROR output")
        self.assertEqual(err, "PM2_DUAL_ENV_COMPARE result=INTERNAL_ERROR exit=1 type=RuntimeError\n")
        report = parse_report(out)
        self.assertEqual(report["result"], "INTERNAL_ERROR")
        self.assertEqual(report["error_type"], "RuntimeError")
        self.assertFalse(os.path.exists(report_path), "report created by a failed invocation must be removed")
        self.assertNotIn("Traceback", out + err)


# ---------------------------------------------------------------------------
# T8 authority, non-claims, every-outcome report
# ---------------------------------------------------------------------------


class T8Authority(Base):
    def test_t8_authority_constant_for_every_source_kind(self):
        for kind in cde.SOURCE_KINDS:
            with self.subTest(kind=kind):
                fx = Fixture(self.subdir(), ref_doc=reference(provenance=provenance(source_kind=kind, declared_by="approved-by-keith", authorization_record="APPROVED")))
                rc, out, _ = run_cli(fx.args())
                report = parse_report(out)
                self.assertEqual(rc, 0)
                self.assertEqual(report["reference"]["authority"], "NOT_EVALUATED_BY_VERIFIER")
                self.assertEqual(report["reference"]["provenance_source_kind"], kind)
                self.assertNotIn("approved-by-keith", out)
                self.assertNotIn("APPROVED", out)
                self.assertNotIn("declared_by", out)
                self.assertNotIn("authorization_record", out)
        fx = Fixture(self.subdir(), ref_doc=reference(provenance=provenance(source_kind="APPROVED")))
        rc, out, _ = run_cli(fx.args())
        self.assert_invalid(rc, out, ["WRONG_TYPE"])

    def test_t8_non_claims_in_all_five_outcomes(self):
        outcomes = []
        fx = Fixture(self.subdir())
        outcomes.append(run_cli(fx.args()))
        env = default_env(); env["PLAIN_KEY"] = "z"
        outcomes.append(run_cli(Fixture(self.subdir(), processes=[process(APP, env)]).args()))
        nested = default_env(); nested["PLAIN_KEY"] = "z"
        outcomes.append(run_cli(Fixture(self.subdir(), processes=[process(APP, default_env(), nested)]).args()))
        outcomes.append(run_cli(["--reference", os.path.join(self.tmp, "none.json"), "--observation", os.path.join(self.tmp, "none2.json")]))
        with mock.patch.object(cde, "compare_apps", side_effect=RuntimeError("forced")):
            outcomes.append(run_main(fx.args()))
        expected = [(0, "MATCH"), (3, "MISMATCH"), (4, "DIVERGENT"), (2, "INVALID_INPUT"), (1, "INTERNAL_ERROR")]
        for (rc, out, _), (exp_rc, exp_result) in zip(outcomes, expected):
            with self.subTest(result=exp_result):
                report = parse_report(out)
                self.assertEqual(rc, exp_rc)
                self.assertEqual(report["result"], exp_result)
                self.assertEqual(report["exit_code"], exp_rc)
                self.assertEqual(report["non_claims"], cde.NON_CLAIMS)
                self.assertEqual(report["schema"], cde.SCHEMA_REPORT)
                self.assertEqual(report["tool"]["name"], "compare_dual_env.py")
                self.assertEqual(report["tool"]["self_sha256"], sha256_file(F1))
        internal = parse_report(outcomes[4][1])
        self.assertEqual(sorted(internal.keys()), ["error_type", "exit_code", "non_claims", "result", "schema", "tool"])
        self.assertEqual(cde.NON_CLAIMS["fence_proof"], "NONE")
        self.assertEqual(cde.NON_CLAIMS["note"], "A MATCH is comparison evidence only.")
        for name in ("restoration_success", "command_fate_known", "host_clean", "policy_satisfied", "permission_to_run", "reference_authority_verified", "acquisition_side_effect_free", "observation_authenticated"):
            self.assertIs(cde.NON_CLAIMS[name], False)

    def test_t8_unknown_flag_usage_fixed_text_and_help(self):
        rc, out, err = run_cli(["--approve", "yes"])
        report = self.assert_invalid(rc, out, ["USAGE"])
        self.assertEqual(report["errors"][0]["detail"], "unknown argument")
        self.assertIsNone(report["mode"])
        self.assertEqual(report["non_claims"], cde.NON_CLAIMS)
        self.assertNotIn("approve", out + err)
        rc, out, err = run_cli(["--help"])
        self.assertEqual(rc, 2)
        self.assertEqual(out, cde.USAGE_TEXT)
        self.assertEqual(err, "")
        rc, out, _ = run_cli([])
        self.assert_invalid(rc, out, ["USAGE"])
        fx = Fixture(self.subdir())
        rc, out, _ = run_cli(fx.args("--allow-restart", "1"))
        self.assert_invalid(rc, out, ["USAGE"])


# ---------------------------------------------------------------------------
# T9 static parity with r3 by value (AST only; no import, no eval, no exec)
# ---------------------------------------------------------------------------


class T9Parity(unittest.TestCase):
    def _module_assign(self, path, name):
        with open(path, "rb") as handle:
            tree = ast.parse(handle.read().decode("utf-8"), path)
        found = [
            node for node in tree.body
            if isinstance(node, ast.Assign) and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name) and node.targets[0].id == name
        ]
        self.assertEqual(len(found), 1)
        return found[0].value

    def _frozenset_literal(self, value):
        self.assertIsInstance(value, ast.Call)
        self.assertIsInstance(value.func, ast.Name)
        self.assertEqual(value.func.id, "frozenset")
        self.assertEqual(len(value.args), 1)
        self.assertEqual(value.keywords, [])
        self.assertIsInstance(value.args[0], ast.Set)
        for element in value.args[0].elts:
            self.assertIsInstance(element, ast.Constant)
            self.assertIsInstance(element.value, str)
        return ast.literal_eval(value.args[0])

    def test_t9_protected_names_parity(self):
        names = self._frozenset_literal(self._module_assign(os.path.join(R3_LIB, "vault.py"), "PROTECTED_NAMES"))
        self.assertEqual(len(names), 6)
        self.assertEqual(set(names), set(cde.ALWAYS_PROTECTED_NAMES))
        self.assertEqual(len(cde.ALWAYS_PROTECTED_NAMES), 6)

    def test_t9_secret_env_names_all_protected(self):
        names = self._frozenset_literal(self._module_assign(os.path.join(R3_LIB, "secret_io.py"), "SECRET_ENV_NAMES"))
        self.assertEqual(len(names), 10)
        for name in names:
            self.assertTrue(cde.is_protected_name(name))
        self.assertEqual(sorted(set(names) - set(cde.ALWAYS_PROTECTED_NAMES)), ["AUTHORIZATION", "PASSWORD", "SECRET", "TOKEN"])
        self.assertFalse(cde.is_protected_name("PLAIN_KEY"))
        self.assertFalse(cde.is_protected_name("PORT"))

    def test_t9_secret_key_fragments_parity(self):
        value = self._module_assign(os.path.join(R3_LIB, "secret_io.py"), "SECRET_KEY_FRAGMENTS")
        self.assertIsInstance(value, ast.Tuple)
        for element in value.elts:
            self.assertIsInstance(element, ast.Constant)
            self.assertIsInstance(element.value, str)
        fragments = ast.literal_eval(value)
        self.assertEqual(len(fragments), 10)
        self.assertEqual(fragments, cde.PROTECTED_NAME_FRAGMENTS)
        self.assertEqual(len(cde.PROTECTED_NAME_FRAGMENTS), 10)


# ---------------------------------------------------------------------------
# T10 bytes and outputs
# ---------------------------------------------------------------------------


class T10Bytes(Base):
    def test_t10_input_bytes_unchanged_after_cli_runs(self):
        fx = Fixture(self.subdir())
        before = fx.hashes()
        emitted = os.path.join(fx.directory, "normalized.json")
        rc, _, _ = run_cli(fx.args("--emit-observation", emitted, "--report", os.path.join(fx.directory, "r1.json")))
        self.assertEqual(rc, 0)
        norm_before = sha256_file(emitted)
        rc, _, _ = run_cli(["--reference", fx.ref_path, "--observation", emitted, "--report", os.path.join(fx.directory, "r2.json")])
        self.assertEqual(rc, 0)
        broken = Fixture(self.subdir(), meta_over={"host": "host-9"})
        rc, _, _ = run_cli(broken.args("--report", os.path.join(broken.directory, "r3.json")))
        self.assertEqual(rc, 2)
        self.assertEqual(fx.hashes(), before)
        self.assertEqual(sha256_file(emitted), norm_before)
        self.assertEqual(sorted(os.listdir(fx.directory)), ["jlist.json", "normalized.json", "observation-meta.json", "r1.json", "r2.json", "reference.json"])
        self.assertEqual(sorted(os.listdir(broken.directory)), ["jlist.json", "observation-meta.json", "r3.json", "reference.json"])

    def test_t10_sha256sums_matches_files(self):
        with open(F4, "rb") as handle:
            raw = handle.read()
        self.assertFalse(b"\r" in raw, "SHA256SUMS must be LF-only")
        entries = {}
        for line in raw.decode("utf-8").splitlines():
            digest, _, rel = line.partition("  ")
            self.assertEqual(len(digest), 64)
            entries[rel] = digest
        self.assertEqual(sorted(entries), [".gitattributes", "README.md", "compare_dual_env.py", "tests/test_compare_dual_env.py"])
        for rel, digest in entries.items():
            self.assertEqual(sha256_file(os.path.join(TOOL_DIR, rel)), digest)
        with open(F5, "rb") as handle:
            self.assertEqual(handle.read(), b"* text eol=lf\n")
        for path in (F1, F2, F3):
            with open(path, "rb") as handle:
                self.assertFalse(b"\r" in handle.read(), "implementation files must be LF-only")

    def test_t10_output_mode_0600_and_output_exists(self):
        fx = Fixture(self.subdir())
        report_path = os.path.join(fx.directory, "report.json")
        emitted = os.path.join(fx.directory, "normalized.json")
        rc, out, _ = run_cli(fx.args("--report", report_path, "--emit-observation", emitted))
        self.assertEqual(rc, 0)
        with open(report_path, "rb") as handle:
            self.assertEqual(handle.read().decode("utf-8"), out)
        if os.name == "posix":
            for path in (report_path, emitted):
                self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
        pre = sha256_file(report_path)
        rc, out, _ = run_cli(fx.args("--report", report_path))
        report = self.assert_invalid(rc, out, ["OUTPUT_EXISTS"])
        self.assertEqual(sha256_file(report_path), pre)
        self.assertIsNone(report["reference"]["reference_id"], "no input may be read before outputs exist")
        rc, out, _ = run_cli(fx.args("--emit-observation", emitted))
        self.assert_invalid(rc, out, ["OUTPUT_EXISTS"])
        self.assertEqual(sorted(os.listdir(fx.directory)), ["jlist.json", "normalized.json", "observation-meta.json", "report.json", "reference.json"])

    def test_t10_output_write_failed_cleanup(self):
        fx = Fixture(self.subdir())
        report_path = os.path.join(fx.directory, "report.json")
        bad = os.path.join(fx.directory, "no-such-dir", "normalized.json")
        rc, out, err = run_cli(fx.args("--report", report_path, "--emit-observation", bad))
        report = self.assert_invalid(rc, out, ["OUTPUT_WRITE_FAILED"])
        self.assertIn("observation-output", report["errors"][0]["detail"])
        self.assertFalse(os.path.exists(report_path), "report created by this invocation must be removed")
        self.assertNotIn("MATCH", out.replace("MATCH is comparison", ""))
        self.assertTrue(err.startswith("PM2_DUAL_ENV_COMPARE result=INVALID_INPUT exit=2"))
        self.assertEqual(sorted(os.listdir(fx.directory)), ["jlist.json", "observation-meta.json", "reference.json"])
        if os.name == "posix" and os.geteuid() != 0:
            locked = os.path.join(fx.directory, "locked")
            os.mkdir(locked)
            os.chmod(locked, 0o500)
            try:
                rc, out, _ = run_cli(fx.args("--report", os.path.join(locked, "report.json")))
                self.assert_invalid(rc, out, ["OUTPUT_WRITE_FAILED"])
                self.assertEqual(os.listdir(locked), [])
            finally:
                os.chmod(locked, 0o700)
        # an INVALID_INPUT run removes an emit-observation file it created but could not fill
        broken = Fixture(self.subdir(), meta_over={"host": "host-9"})
        emitted = os.path.join(broken.directory, "normalized.json")
        rc, out, _ = run_cli(broken.args("--emit-observation", emitted, "--report", os.path.join(broken.directory, "report.json")))
        self.assert_invalid(rc, out, ["HOST_MISMATCH"])
        self.assertFalse(os.path.exists(emitted))
        self.assertTrue(os.path.exists(os.path.join(broken.directory, "report.json")))


# ---------------------------------------------------------------------------
# T11 no PM2 from import / comparison paths
# ---------------------------------------------------------------------------


class T11NoPm2(Base):
    def test_t11_ast_import_allowlist_and_no_spawn(self):
        with open(F1, "rb") as handle:
            source = handle.read().decode("utf-8")
        tree = ast.parse(source, F1)
        imported = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imported.add(alias.name.split(".")[0])
            elif isinstance(node, ast.ImportFrom):
                self.assertIsNotNone(node.module)
                imported.add(node.module.split(".")[0])
        self.assertTrue(imported <= F1_IMPORT_ALLOWLIST, "F1 imports outside the frozen allowlist")
        for forbidden in ("argparse", "subprocess", "socket", "shutil", "platform", "pathlib", "multiprocessing", "ctypes", "urllib", "http", "asyncio", "importlib", "logging", "traceback"):
            self.assertNotIn(forbidden, imported)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                owner, attr = node.func.value.id, node.func.attr
                self.assertFalse(owner == "os" and (attr == "system" or attr.startswith("exec") or attr.startswith("spawn") or attr == "popen" or attr == "fork"), "spawn primitive in F1")
                self.assertNotEqual(owner, "socket")
                self.assertNotEqual(owner, "subprocess")
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                self.assertNotEqual(node.value, "pm2", "the string pm2 must not be an argv element in F1")
            if isinstance(node, (ast.List, ast.Tuple)):
                for element in node.elts:
                    if isinstance(element, ast.Constant):
                        self.assertNotEqual(element.value, "pm2")
        self.assertIn('if __name__ == "__main__":', source)
        self.assertTrue(source.startswith("#!/usr/bin/env python3\n"))
        self.assertNotIn("os.environ", source)

    def test_t11_import_does_not_load_subprocess_socket_argparse(self):
        code = "import compare_dual_env, sys; print('subprocess' in sys.modules, 'socket' in sys.modules, 'argparse' in sys.modules)"
        proc = subprocess.run([sys.executable, "-c", code], cwd=TOOL_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.decode("utf-8").strip(), "False False False")

    def test_t11_path_shims_not_invoked(self):
        shims = os.path.join(self.tmp, "shims")
        markers = os.path.join(self.tmp, "markers")
        os.mkdir(shims)
        os.mkdir(markers)
        if os.name == "posix":
            for name in ("pm2", "node", "sudo", "tcpdump"):
                path = os.path.join(shims, name)
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write("#!/bin/sh\n: > '" + os.path.join(markers, name) + "'\nexit 97\n")
                os.chmod(path, 0o755)
        env = dict(os.environ)
        env["PATH"] = shims
        fx = Fixture(self.subdir())
        rc, out, _ = run_cli(fx.args(), env=env)
        self.assertEqual(rc, 0)
        self.assertEqual(parse_report(out)["result"], "MATCH")
        rc, _, _ = run_cli(fx.args("--max-age-seconds", "x"), env=env)
        self.assertEqual(rc, 2)
        self.assertEqual(os.listdir(markers), [])


# ---------------------------------------------------------------------------
# T12 round trip
# ---------------------------------------------------------------------------


class T12RoundTrip(Base):
    def test_t12_round_trip_mode_a_to_mode_b(self):
        directory = tempfile.mkdtemp(prefix=SENTINEL + "-rt-", dir=self.tmp)
        secret = SENTINEL + "-secret"
        ref = reference(apps={APP: {"keys": {"XAI_API_KEY": key(True, ftok(secret)), "PLAIN_KEY": key(False, fset("plain-value")), "GONE": key(False, fabsent())}}}, pm2_home="/home/op/.pm2")
        top = {"XAI_API_KEY": secret, "PLAIN_KEY": "plain-value", SENTINEL + "_U": SENTINEL}
        nested = dict(top)
        nested["PLAIN_KEY"] = "other-value"
        fx = Fixture(directory, ref_doc=ref, processes=[process(APP, top, nested)], meta_over={"pm2_home": "/home/op/.pm2", "captured_by": SENTINEL + "-captor"})
        emitted = os.path.join(directory, SENTINEL + "-normalized.json")
        report_a_path = os.path.join(directory, "report-a.json")
        rc, out_a, err_a = run_cli(fx.args("--emit-observation", emitted, "--report", report_a_path))
        self.assertEqual(rc, 4)
        report_a = parse_report(out_a)
        rc, out_b, err_b = run_cli(["--reference", fx.ref_path, "--observation", emitted])
        self.assertEqual(rc, 4)
        report_b = parse_report(out_b)
        self.assertEqual(report_a["apps"], report_b["apps"])
        self.assertEqual(report_a["counts"], report_b["counts"])
        self.assertEqual(report_a["result"], report_b["result"])
        self.assertEqual(report_a["mode"], "A")
        self.assertEqual(report_b["mode"], "B")
        self.assertEqual(report_a["observation"]["source"], "RAW_JLIST")
        self.assertIs(report_a["observation"]["jlist_hash_verified"], True)
        self.assertEqual(report_b["observation"]["source"], "NORMALIZED")
        self.assertIs(report_b["observation"]["jlist_hash_verified"], False)
        self.assertEqual(report_b["observation"]["observation_id"], "obs-1")
        self.assertTrue(report_b["identity"]["pm2_home_checked"])
        for text in (out_a, err_a, out_b, err_b):
            self.assertFalse(SENTINEL in text, "sentinel leaked into a class-A output")
            self.assertFalse(contains_token(text), "a token leaked into a class-A output")
        with open(emitted, "rb") as handle:
            emitted_text = handle.read().decode("utf-8")
        emitted_doc = json.loads(emitted_text)
        self.assertEqual(emitted_doc["schema"], cde.SCHEMA_OBSERVATION)
        self.assertEqual(emitted_doc["reference_id"], "ref-1")
        self.assertEqual(emitted_doc["pm2_home"], "/home/op/.pm2")
        self.assertEqual(emitted_doc["captured_by"], SENTINEL + "-captor")
        self.assertEqual(emitted_doc["apps"][APP]["keys"]["XAI_API_KEY"]["pm2_env"]["token"], cde.token_for(secret))
        self.assertNotIn("value", emitted_doc["apps"][APP]["keys"]["XAI_API_KEY"]["pm2_env"])
        self.assertFalse(secret in emitted_text, "raw protected value leaked into the normalized observation")
        self.assertFalse((SENTINEL + "_U") in emitted_text, "unrelated member leaked into the normalized observation")
        self.assertNotIn(directory, emitted_text)
        self.assertNotIn("--reference", emitted_text)
        self.assertEqual(sorted(emitted_doc["apps"][APP]["keys"].keys()), ["GONE", "PLAIN_KEY", "XAI_API_KEY"])
        self.assertEqual(emitted_doc["apps"][APP]["keys"]["GONE"]["pm2_env"], {"state": "ABSENT"})
        self.assertEqual(emitted_doc["apps"][APP]["keys"]["PLAIN_KEY"]["pm2_env.env"], {"state": "SET", "value": "other-value"})
        self.assertEqual(emitted_doc["normalized_at"], report_a["evaluated_at"])


if __name__ == "__main__":
    unittest.main()
