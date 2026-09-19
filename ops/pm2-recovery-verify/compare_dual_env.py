#!/usr/bin/env python3
"""PM2-RECOVERY-VERIFY-01 -- offline dual-field PM2 environment comparison verifier.

Compares the named keys of ``pm2_env[k]`` and ``pm2_env.env[k]`` for the apps
declared in an explicitly supplied reference document against an explicitly
supplied observation, preserving SET / EMPTY / ABSENT distinctions and never
printing protected values or tokens.

This module contains no PM2 client. It never spawns a process, opens a socket,
reads a vault / journal / marker, or writes anything except the two optional
output files requested on the command line. A MATCH is comparison evidence only:
it does not establish restoration success, command fate, a fence, host CLEAN,
policy satisfaction, permission to run, reference authority, side-effect-free
acquisition, or an authenticated host / daemon / operator / capture time.

Contract: docs/PM2-RECOVERY-VERIFY-01-STAGE-START.md (sections 4, 5, 6).
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import stat
import sys
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Constants (frozen; see stage-start sections 4.6, 5.3, 5.4)
# ---------------------------------------------------------------------------

TOOL_NAME = "compare_dual_env.py"
TOOL_VERSION = "1.0.0"

SCHEMA_REFERENCE = "aisb.pm2-dual-env-reference.v1"
SCHEMA_OBSERVATION_META = "aisb.pm2-dual-env-observation-meta.v1"
SCHEMA_OBSERVATION = "aisb.pm2-dual-env-observation.v1"
SCHEMA_REPORT = "aisb.pm2-dual-env-comparison-report.v1"

# Copied BY VALUE from r3 ops/aisb-01c6a-operator-bundle/lib/vault.py PROTECTED_NAMES
# (6 names) and lib/secret_io.py SECRET_KEY_FRAGMENTS (10 fragments). Parity is
# asserted statically by the test suite (T9); nothing from r3 is imported.
ALWAYS_PROTECTED_NAMES = frozenset({
    "HARNESS_ENTITLEMENT_HMAC_SECRET",
    "AISB_01C6A_HMAC_SECRET",
    "XAI_API_KEY",
    "AISB_01C6A_API_KEY_TOKEN",
    "DATABASE_URL",
    "REDIS_URL",
})
PROTECTED_NAME_FRAGMENTS = (
    "secret",
    "password",
    "token",
    "authorization",
    "api_key",
    "apikey",
    "database_url",
    "redis_url",
    "hmac",
    "bearer",
)

MAX_INPUT_BYTES = 16 * 1024 * 1024
MAX_FREE_TEXT_CHARS = 1024
MAX_PM2_HOME_CHARS = 4096
FUTURE_SKEW_SECONDS = 300
DISPLAY_TRUNCATE_CHARS = 256

EXIT_MATCH = 0
EXIT_INTERNAL_ERROR = 1
EXIT_INVALID_INPUT = 2
EXIT_MISMATCH = 3
EXIT_DIVERGENT = 4

RESULT_MATCH = "MATCH"
RESULT_MISMATCH = "MISMATCH"
RESULT_DIVERGENT = "DIVERGENT"
RESULT_INVALID_INPUT = "INVALID_INPUT"
RESULT_INTERNAL_ERROR = "INTERNAL_ERROR"

STATE_SET = "SET"
STATE_EMPTY = "EMPTY"
STATE_ABSENT = "ABSENT"
STATES = (STATE_SET, STATE_EMPTY, STATE_ABSENT)

SOURCE_KINDS = ("INTENT_DECLARATION", "OBSERVATION_ADOPTED_BY_DECISION", "OTHER")

AUTHORITY_CONSTANT = "NOT_EVALUATED_BY_VERIFIER"
FRESHNESS_LIMITATIONS = (
    "declared fields compared, not authenticated; captured_at is operator-declared; "
    "point-in-time; daemon restart / pm2 write between capture and evaluation is "
    "undetectable by this tool"
)

NON_CLAIMS = {
    "restoration_success": False,
    "command_fate_known": False,
    "fence_proof": "NONE",
    "host_clean": False,
    "policy_satisfied": False,
    "permission_to_run": False,
    "reference_authority_verified": False,
    "acquisition_side_effect_free": False,
    "observation_authenticated": False,
    "note": "A MATCH is comparison evidence only.",
}

ROLE_REFERENCE = "reference"
ROLE_OBSERVATION_META = "observation-meta"
ROLE_JLIST = "jlist"
ROLE_OBSERVATION = "observation"
ROLE_REPORT_OUTPUT = "report-output"
ROLE_OBSERVATION_OUTPUT = "observation-output"

FIELD_TOP = "pm2_env"
FIELD_NESTED = "pm2_env.env"

PLACEHOLDER_UNKNOWN = "<unknown-member>"
PLACEHOLDER_INVALID = "<invalid-identifier>"

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
HOST_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.-]{0,253}$")
APP_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
KEY_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,255}$")
TOKEN_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
TIMESTAMP_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")

FLAG_REFERENCE = "--reference"
FLAG_OBSERVATION_META = "--observation-meta"
FLAG_JLIST = "--jlist"
FLAG_OBSERVATION = "--observation"
FLAG_REPORT = "--report"
FLAG_EMIT_OBSERVATION = "--emit-observation"
FLAG_MAX_AGE = "--max-age-seconds"
FLAG_HELP = "--help"
VALUE_FLAGS = (
    FLAG_REFERENCE,
    FLAG_OBSERVATION_META,
    FLAG_JLIST,
    FLAG_OBSERVATION,
    FLAG_REPORT,
    FLAG_EMIT_OBSERVATION,
    FLAG_MAX_AGE,
)

USAGE_TEXT = (
    "usage:\n"
    "  compare_dual_env.py --reference PATH --observation-meta PATH --jlist PATH\n"
    "                      [--report PATH] [--emit-observation PATH] [--max-age-seconds N]\n"
    "  compare_dual_env.py --reference PATH --observation PATH\n"
    "                      [--report PATH] [--max-age-seconds N]\n"
    "  compare_dual_env.py --help\n"
    "\n"
    "Offline comparison of pm2_env[k] and pm2_env.env[k] against a reference.\n"
    "Exit codes: 0 MATCH (evidence only), 3 MISMATCH, 4 DIVERGENT, 2 INVALID_INPUT,\n"
    "1 INTERNAL_ERROR. No PM2 client is invoked. Nothing is authorized by a MATCH.\n"
)

# Fixed diagnostic texts. Placeholders are filled only with constant roles,
# validated integers, or reference-declared app names that passed validation.
DETAIL = {
    "USAGE": "invalid invocation",
    "OUTPUT_EXISTS": "{role} already exists; refusing to overwrite",
    "OUTPUT_WRITE_FAILED": "{role} could not be created or written; files created by this invocation were removed",
    "INPUT_UNREADABLE": "{role} could not be opened or read as a regular file",
    "INPUT_TOO_LARGE": "{role} exceeds the 16 MiB input limit",
    "INPUT_NOT_UTF8": "{role} is not strict UTF-8 without BOM (byte offset {offset})",
    "JSON_SYNTAX": "{role} is not valid JSON (line {line} column {column} offset {offset})",
    "DUPLICATE_JSON_KEY": "{role} contains a duplicate object member name",
    "UNKNOWN_FIELD": "unknown member in a verifier-owned object",
    "MISSING_FIELD": "required member is missing",
    "WRONG_TYPE": "member has the wrong JSON type or an out-of-range value",
    "SCHEMA_ID_MISMATCH": "schema member does not name the expected schema",
    "IDENTIFIER_FORMAT": "identifier does not match its required format",
    "TIMESTAMP_FORMAT": "timestamp is not YYYY-MM-DDTHH:MM:SSZ",
    "TOKEN_FORMAT": "token is not sha256:<64 lowercase hex>",
    "VALIDITY_WINDOW_INVERTED": "valid_from is later than valid_until",
    "NO_APPS": "apps must contain at least one app",
    "NO_KEYS": "keys must contain at least one key",
    "RESERVED_KEY_NAME": "the key name env is reserved",
    "EXPECTATION_SHAPE": "field expectation shape does not match its state and protection flag",
    "PROTECTED_VALUE_IN_REFERENCE": "a protected key carries a value member in the reference; only a token is permitted",
    "PROTECTED_NAME_DECLARED_UNPROTECTED": "key name is always protected but protected is false",
    "REFERENCE_FIELDS_INCONSISTENT": "pm2_env and pm2_env.env expectations differ for this key",
    "JLIST_HASH_MISMATCH": "SHA-256 of the jlist bytes read does not equal observation-meta jlist_sha256",
    "JLIST_NOT_LIST": "jlist top level is not an array",
    "JLIST_ITEM_NOT_OBJECT": "jlist element is not an object",
    "JLIST_ITEM_NAME_MISSING": "jlist element has no string name member",
    "APP_MISSING": "reference app {app} matches no jlist element",
    "APP_DUPLICATE": "reference app {app} matches more than one jlist element",
    "PM2_ENV_NOT_OBJECT": "pm2_env is missing or not an object for app {app}",
    "NESTED_ENV_NOT_OBJECT": "pm2_env.env is missing or not an object for app {app}",
    "NULL_VALUE": "observed member is JSON null; not coerced to ABSENT",
    "NON_STRING_VALUE": "observed member is not a string",
    "OBSERVATION_REFERENCE_ID_MISMATCH": "normalized observation reference_id differs from the supplied reference",
    "OBSERVATION_KEYSET_MISMATCH": "normalized observation app or key set differs from the reference",
    "PROTECTED_FLAG_MISMATCH": "normalized observation protected flag differs from the reference",
    "OBSERVATION_FIELD_SHAPE": "normalized observation field shape does not match its state and protection flag",
    "PROTECTED_VALUE_IN_OBSERVATION": "a protected key carries a value member in the normalized observation; only a token is permitted",
    "OBSERVATION_TIMESTAMPS_INCONSISTENT": "normalized_at is earlier than captured_at",
    "HOST_MISMATCH": "reference host and observation host differ",
    "PM2_HOME_MISSING_IN_OBSERVATION": "reference declares pm2_home but the observation does not",
    "PM2_HOME_MISMATCH": "reference pm2_home and observation pm2_home differ",
    "DAEMON_PID_MISSING_IN_OBSERVATION": "reference declares daemon_pid but the observation does not",
    "DAEMON_PID_MISMATCH": "reference daemon_pid and observation daemon_pid differ",
    "OBSERVATION_OUTSIDE_REFERENCE_VALIDITY": "captured_at is outside the reference validity window",
    "OBSERVATION_IN_FUTURE": "captured_at is more than 300 seconds after evaluated_at",
    "OBSERVATION_STALE": "observation age exceeds --max-age-seconds",
}

USAGE_DETAILS = {
    "unknown": "unknown argument",
    "repeated": "argument repeated: {flag}",
    "needs_value": "{flag} requires a value",
    "max_age": "--max-age-seconds must be a non-negative integer",
    "positional": "unexpected positional argument",
    "combination": (
        "invalid flag combination: use --reference with --observation-meta and --jlist "
        "(mode A) or with --observation (mode B)"
    ),
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def is_protected_name(key: str) -> bool:
    if key in ALWAYS_PROTECTED_NAMES:
        return True
    low = key.lower()
    return any(fragment in low for fragment in PROTECTED_NAME_FRAGMENTS)


def token_for(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def _escape_segment(segment: str) -> str:
    return segment.replace("~", "~0").replace("/", "~1")


def pointer(*segments: Any) -> str:
    if not segments:
        return ""
    return "/" + "/".join(_escape_segment(str(s)) for s in segments)


def parse_timestamp(text: str) -> Optional[datetime.datetime]:
    if not isinstance(text, str) or not TIMESTAMP_RE.match(text):
        return None
    try:
        parsed = datetime.datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None
    return parsed.replace(tzinfo=datetime.timezone.utc)


def format_timestamp(moment: datetime.datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def now_utc() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)


def error_record(code: str, path: str, **fields: Any) -> Dict[str, str]:
    template = DETAIL[code]
    return {"code": code, "path": path, "detail": template.format(**fields)}


class InvalidInput(Exception):
    """Raised with the collected error records of the failing stage."""

    def __init__(self, errors: List[Dict[str, str]]) -> None:
        Exception.__init__(self)
        self.errors = list(errors)


class _DuplicateMemberName(Exception):
    pass


class _RejectedConstant(Exception):
    pass


class Collector:
    def __init__(self) -> None:
        self.errors = []  # type: List[Dict[str, str]]

    def add(self, code: str, path: str, **fields: Any) -> None:
        self.errors.append(error_record(code, path, **fields))

    def raise_if_any(self) -> None:
        if self.errors:
            raise InvalidInput(self.errors)


class FieldSpec:
    """One field expectation / observation: state plus value (non-protected) or token (protected)."""

    __slots__ = ("state", "value", "token")

    def __init__(self, state: str, value: Optional[str] = None, token: Optional[str] = None) -> None:
        self.state = state
        self.value = value
        self.token = token

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, FieldSpec):
            return NotImplemented
        return self.state == other.state and self.value == other.value and self.token == other.token

    def __ne__(self, other: object) -> bool:
        result = self.__eq__(other)
        if result is NotImplemented:
            return result
        return not result

    def to_json(self) -> Dict[str, Any]:
        out = {"state": self.state}  # type: Dict[str, Any]
        if self.state == STATE_SET:
            if self.token is not None:
                out["token"] = self.token
            else:
                out["value"] = self.value
        return out


class KeySpec:
    __slots__ = ("protected", "top", "nested")

    def __init__(self, protected: bool, top: FieldSpec, nested: FieldSpec) -> None:
        self.protected = protected
        self.top = top
        self.nested = nested


# apps structure: Dict[app, Dict[key, KeySpec]]
AppsSpec = Dict[str, Dict[str, KeySpec]]


# ---------------------------------------------------------------------------
# Reading and decoding (stage 1 / 2)
# ---------------------------------------------------------------------------


def read_input_bytes(path: str, role: str) -> bytes:
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
    try:
        fd = os.open(path, flags)
    except (OSError, ValueError, TypeError):
        raise InvalidInput([error_record("INPUT_UNREADABLE", "", role=role)])
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise InvalidInput([error_record("INPUT_UNREADABLE", "", role=role)])
        if info.st_size > MAX_INPUT_BYTES:
            raise InvalidInput([error_record("INPUT_TOO_LARGE", "", role=role)])
        chunks = []  # type: List[bytes]
        total = 0
        while True:
            chunk = os.read(fd, 1 << 20)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_INPUT_BYTES:
                raise InvalidInput([error_record("INPUT_TOO_LARGE", "", role=role)])
            chunks.append(chunk)
    except OSError:
        raise InvalidInput([error_record("INPUT_UNREADABLE", "", role=role)])
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
    return b"".join(chunks)


def _pairs_hook(pairs: List[Tuple[str, Any]]) -> Dict[str, Any]:
    out = {}  # type: Dict[str, Any]
    for name, value in pairs:
        if name in out:
            raise _DuplicateMemberName()
        out[name] = value
    return out


def _reject_constant(_name: str) -> Any:
    raise _RejectedConstant()


def decode_json(data: bytes, role: str) -> Any:
    if data.startswith(b"\xef\xbb\xbf"):
        raise InvalidInput([error_record("INPUT_NOT_UTF8", "", role=role, offset=0)])
    try:
        text = data.decode("utf-8", "strict")
    except UnicodeDecodeError as exc:
        raise InvalidInput([error_record("INPUT_NOT_UTF8", "", role=role, offset=int(exc.start))])
    try:
        return json.loads(text, object_pairs_hook=_pairs_hook, parse_constant=_reject_constant)
    except _DuplicateMemberName:
        raise InvalidInput([error_record("DUPLICATE_JSON_KEY", "", role=role)])
    except _RejectedConstant:
        raise InvalidInput([error_record("JSON_SYNTAX", "", role=role, line=0, column=0, offset=0)])
    except json.JSONDecodeError as exc:
        raise InvalidInput([
            error_record("JSON_SYNTAX", "", role=role, line=int(exc.lineno), column=int(exc.colno), offset=int(exc.pos))
        ])
    except (RecursionError, ValueError):
        raise InvalidInput([error_record("JSON_SYNTAX", "", role=role, line=0, column=0, offset=0)])


# ---------------------------------------------------------------------------
# Schema validation (stage 3)
# ---------------------------------------------------------------------------


def _check_unknown(col: Collector, obj: Dict[str, Any], allowed: Tuple[str, ...], base: str) -> None:
    for name in obj:
        if name not in allowed:
            col.add("UNKNOWN_FIELD", base + pointer(PLACEHOLDER_UNKNOWN))


def _req_str(col: Collector, obj: Dict[str, Any], name: str, base: str, max_len: int = MAX_FREE_TEXT_CHARS) -> Optional[str]:
    if name not in obj:
        col.add("MISSING_FIELD", base + pointer(name))
        return None
    value = obj[name]
    if not isinstance(value, str) or value == "" or len(value) > max_len:
        col.add("WRONG_TYPE", base + pointer(name))
        return None
    return value


def _opt_str(col: Collector, obj: Dict[str, Any], name: str, base: str, max_len: int) -> Tuple[bool, Optional[str]]:
    if name not in obj:
        return False, None
    value = obj[name]
    if not isinstance(value, str) or value == "" or len(value) > max_len:
        col.add("WRONG_TYPE", base + pointer(name))
        return True, None
    return True, value


def _req_identifier(col: Collector, obj: Dict[str, Any], name: str, base: str, pattern: "re.Pattern[str]") -> Optional[str]:
    if name not in obj:
        col.add("MISSING_FIELD", base + pointer(name))
        return None
    value = obj[name]
    if not isinstance(value, str):
        col.add("WRONG_TYPE", base + pointer(name))
        return None
    if not pattern.match(value):
        col.add("IDENTIFIER_FORMAT", base + pointer(name))
        return None
    return value


def _timestamp_member(col: Collector, obj: Dict[str, Any], name: str, base: str, required: bool) -> Optional[datetime.datetime]:
    if name not in obj:
        if required:
            col.add("MISSING_FIELD", base + pointer(name))
        return None
    value = obj[name]
    if not isinstance(value, str):
        col.add("WRONG_TYPE", base + pointer(name))
        return None
    parsed = parse_timestamp(value)
    if parsed is None:
        col.add("TIMESTAMP_FORMAT", base + pointer(name))
        return None
    return parsed


def _opt_pid(col: Collector, obj: Dict[str, Any], base: str) -> Tuple[bool, Optional[int]]:
    if "daemon_pid" not in obj:
        return False, None
    value = obj["daemon_pid"]
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        col.add("WRONG_TYPE", base + pointer("daemon_pid"))
        return True, None
    return True, value


def _schema_member(col: Collector, obj: Dict[str, Any], expected: str) -> None:
    if "schema" not in obj:
        col.add("MISSING_FIELD", pointer("schema"))
        return
    value = obj["schema"]
    if not isinstance(value, str):
        col.add("WRONG_TYPE", pointer("schema"))
        return
    if value != expected:
        col.add("SCHEMA_ID_MISMATCH", pointer("schema"))


def _validate_field_spec(
    col: Collector,
    obj: Any,
    protected: Optional[bool],
    base: str,
    shape_code: str,
    protected_value_code: str,
) -> Optional[FieldSpec]:
    if not isinstance(obj, dict):
        col.add("WRONG_TYPE", base)
        return None
    _check_unknown(col, obj, ("state", "value", "token"), base)
    if "state" not in obj:
        col.add("MISSING_FIELD", base + pointer("state"))
        return None
    state = obj["state"]
    if not isinstance(state, str):
        col.add("WRONG_TYPE", base + pointer("state"))
        return None
    if state not in STATES:
        col.add("WRONG_TYPE", base + pointer("state"))
        return None
    has_value = "value" in obj
    has_token = "token" in obj
    if protected is True and has_value:
        col.add(protected_value_code, base + pointer("value"))
        col.add(shape_code, base)
        return None
    if protected is None:
        # protection flag itself was invalid; the shape cannot be judged
        return None
    if state == STATE_SET and not protected:
        value = obj.get("value")
        if has_token or not has_value or not isinstance(value, str) or value == "":
            col.add(shape_code, base)
            return None
        return FieldSpec(STATE_SET, value=value)
    if state == STATE_SET and protected:
        if has_value or not has_token:
            col.add(shape_code, base)
            return None
        token = obj["token"]
        if not isinstance(token, str):
            col.add("WRONG_TYPE", base + pointer("token"))
            return None
        if not TOKEN_RE.match(token):
            col.add("TOKEN_FORMAT", base + pointer("token"))
            return None
        return FieldSpec(STATE_SET, token=token)
    # EMPTY / ABSENT: no payload permitted
    if has_value or has_token:
        col.add(shape_code, base)
        return None
    return FieldSpec(state)


def _validate_apps(
    col: Collector,
    apps: Any,
    shape_code: str,
    protected_value_code: str,
    require_consistent: bool,
    reference_names: Optional[Dict[str, Tuple[str, ...]]],
) -> AppsSpec:
    """Validate an ``apps`` block.

    ``reference_names`` is None when validating the reference itself (any
    name that passes its format rule may appear in pointers). For the
    normalized observation it maps reference app -> declared key names, and
    names outside that vocabulary are replaced by placeholders in pointers.
    """
    result = {}  # type: AppsSpec
    base = pointer("apps")
    if not isinstance(apps, dict):
        col.add("WRONG_TYPE", base)
        return result
    if not apps:
        col.add("NO_APPS", base)
        return result
    for app_name, app_obj in apps.items():
        app_ok = APP_RE.match(app_name) is not None
        if not app_ok:
            col.add("IDENTIFIER_FORMAT", base + pointer(PLACEHOLDER_INVALID))
            app_seg = PLACEHOLDER_INVALID
        elif reference_names is not None and app_name not in reference_names:
            app_seg = PLACEHOLDER_UNKNOWN
        else:
            app_seg = app_name
        app_base = base + pointer(app_seg)
        if not isinstance(app_obj, dict):
            col.add("WRONG_TYPE", app_base)
            continue
        _check_unknown(col, app_obj, ("keys",), app_base)
        if "keys" not in app_obj:
            col.add("MISSING_FIELD", app_base + pointer("keys"))
            continue
        keys = app_obj["keys"]
        keys_base = app_base + pointer("keys")
        if not isinstance(keys, dict):
            col.add("WRONG_TYPE", keys_base)
            continue
        if not keys:
            col.add("NO_KEYS", keys_base)
            continue
        app_keys = {}  # type: Dict[str, KeySpec]
        for key_name, key_obj in keys.items():
            key_ok = KEY_RE.match(key_name) is not None
            if not key_ok:
                col.add("IDENTIFIER_FORMAT", keys_base + pointer(PLACEHOLDER_INVALID))
                key_seg = PLACEHOLDER_INVALID
            elif reference_names is not None and (
                app_seg != app_name or key_name not in reference_names.get(app_name, ())
            ):
                key_seg = PLACEHOLDER_UNKNOWN
            else:
                key_seg = key_name
            key_base = keys_base + pointer(key_seg)
            if key_ok and key_name == "env":
                col.add("RESERVED_KEY_NAME", key_base)
            if not isinstance(key_obj, dict):
                col.add("WRONG_TYPE", key_base)
                continue
            _check_unknown(col, key_obj, ("protected", FIELD_TOP, FIELD_NESTED), key_base)
            protected = None  # type: Optional[bool]
            if "protected" not in key_obj:
                col.add("MISSING_FIELD", key_base + pointer("protected"))
            elif not isinstance(key_obj["protected"], bool):
                col.add("WRONG_TYPE", key_base + pointer("protected"))
            else:
                protected = key_obj["protected"]
                if key_ok and protected is False and is_protected_name(key_name):
                    col.add("PROTECTED_NAME_DECLARED_UNPROTECTED", key_base + pointer("protected"))
            specs = []  # type: List[Optional[FieldSpec]]
            for field_name in (FIELD_TOP, FIELD_NESTED):
                if field_name not in key_obj:
                    col.add("MISSING_FIELD", key_base + pointer(field_name))
                    specs.append(None)
                    continue
                specs.append(
                    _validate_field_spec(
                        col, key_obj[field_name], protected, key_base + pointer(field_name), shape_code, protected_value_code
                    )
                )
            top, nested = specs[0], specs[1]
            if protected is None or top is None or nested is None or not key_ok:
                continue
            if require_consistent and top != nested:
                col.add("REFERENCE_FIELDS_INCONSISTENT", key_base)
                continue
            app_keys[key_name] = KeySpec(protected, top, nested)
        if app_ok:
            # Apps outside the reference vocabulary are kept (under their validated name)
            # so that the Mode B keyset cross-check can refuse them; pointers for them
            # already used the placeholder segment.
            result[app_name] = app_keys
    return result


class Reference:
    def __init__(self) -> None:
        self.reference_id = None  # type: Optional[str]
        self.host = None  # type: Optional[str]
        self.pm2_home_declared = None  # type: Optional[bool]
        self.pm2_home = None  # type: Optional[str]
        self.daemon_pid_declared = False
        self.daemon_pid = None  # type: Optional[int]
        self.valid_from = None  # type: Optional[datetime.datetime]
        self.valid_until = None  # type: Optional[datetime.datetime]
        self.provenance_source_kind = None  # type: Optional[str]
        self.apps = {}  # type: AppsSpec

    def declared_names(self) -> Dict[str, Tuple[str, ...]]:
        return dict((app, tuple(keys.keys())) for app, keys in self.apps.items())


def validate_reference(doc: Any, ref: Reference) -> List[Dict[str, str]]:
    """Validate the reference document, filling ``ref`` with every member that passed."""
    col = Collector()
    if not isinstance(doc, dict):
        col.add("WRONG_TYPE", "")
        return col.errors
    _check_unknown(
        col,
        doc,
        ("schema", "reference_id", "host", "pm2_home", "daemon_pid", "valid_from", "valid_until", "provenance", "apps"),
        "",
    )
    _schema_member(col, doc, SCHEMA_REFERENCE)
    ref.reference_id = _req_identifier(col, doc, "reference_id", "", ID_RE)
    ref.host = _req_identifier(col, doc, "host", "", HOST_RE)
    declared, home = _opt_str(col, doc, "pm2_home", "", MAX_PM2_HOME_CHARS)
    ref.pm2_home_declared = declared
    ref.pm2_home = home
    ref.daemon_pid_declared, ref.daemon_pid = _opt_pid(col, doc, "")
    ref.valid_from = _timestamp_member(col, doc, "valid_from", "", False)
    ref.valid_until = _timestamp_member(col, doc, "valid_until", "", False)
    if ref.valid_from is not None and ref.valid_until is not None and ref.valid_from > ref.valid_until:
        col.add("VALIDITY_WINDOW_INVERTED", pointer("valid_until"))
    if "provenance" not in doc:
        col.add("MISSING_FIELD", pointer("provenance"))
    else:
        prov = doc["provenance"]
        pbase = pointer("provenance")
        if not isinstance(prov, dict):
            col.add("WRONG_TYPE", pbase)
        else:
            _check_unknown(col, prov, ("declared_by", "source_kind", "source", "declared_at", "authorization_record"), pbase)
            _req_str(col, prov, "declared_by", pbase)
            _req_str(col, prov, "source", pbase)
            _req_str(col, prov, "authorization_record", pbase)
            _timestamp_member(col, prov, "declared_at", pbase, True)
            if "source_kind" not in prov:
                col.add("MISSING_FIELD", pbase + pointer("source_kind"))
            elif not isinstance(prov["source_kind"], str) or prov["source_kind"] not in SOURCE_KINDS:
                col.add("WRONG_TYPE", pbase + pointer("source_kind"))
            else:
                ref.provenance_source_kind = prov["source_kind"]
    if "apps" not in doc:
        col.add("MISSING_FIELD", pointer("apps"))
    else:
        ref.apps = _validate_apps(col, doc["apps"], "EXPECTATION_SHAPE", "PROTECTED_VALUE_IN_REFERENCE", True, None)
    return col.errors


class Observation:
    def __init__(self) -> None:
        self.observation_id = None  # type: Optional[str]
        self.host = None  # type: Optional[str]
        self.pm2_home_declared = None  # type: Optional[bool]
        self.pm2_home = None  # type: Optional[str]
        self.daemon_pid_declared = False
        self.daemon_pid = None  # type: Optional[int]
        self.captured_at = None  # type: Optional[datetime.datetime]
        self.captured_by = None  # type: Optional[str]
        self.acquisition_record = None  # type: Optional[str]
        self.provenance_fields_present = None  # type: Optional[bool]
        self.jlist_sha256 = None  # type: Optional[str]
        self.source = None  # type: Optional[str]
        self.jlist_hash_verified = None  # type: Optional[bool]
        self.normalized_at = None  # type: Optional[datetime.datetime]
        self.reference_id = None  # type: Optional[str]
        self.apps = {}  # type: AppsSpec


def _validate_observation_common(col: Collector, doc: Dict[str, Any], obs: Observation) -> None:
    obs.observation_id = _req_identifier(col, doc, "observation_id", "", ID_RE)
    obs.host = _req_identifier(col, doc, "host", "", HOST_RE)
    declared, home = _opt_str(col, doc, "pm2_home", "", MAX_PM2_HOME_CHARS)
    obs.pm2_home_declared = declared
    obs.pm2_home = home
    obs.daemon_pid_declared, obs.daemon_pid = _opt_pid(col, doc, "")
    obs.captured_at = _timestamp_member(col, doc, "captured_at", "", True)
    obs.captured_by = _req_str(col, doc, "captured_by", "")
    obs.acquisition_record = _req_str(col, doc, "acquisition_record", "")
    obs.provenance_fields_present = obs.captured_by is not None and obs.acquisition_record is not None
    if "jlist_sha256" not in doc:
        col.add("MISSING_FIELD", pointer("jlist_sha256"))
    elif not isinstance(doc["jlist_sha256"], str):
        col.add("WRONG_TYPE", pointer("jlist_sha256"))
    elif not HEX64_RE.match(doc["jlist_sha256"]):
        col.add("IDENTIFIER_FORMAT", pointer("jlist_sha256"))
    else:
        obs.jlist_sha256 = doc["jlist_sha256"]


def validate_observation_meta(doc: Any, obs: Observation) -> List[Dict[str, str]]:
    col = Collector()
    if not isinstance(doc, dict):
        col.add("WRONG_TYPE", "")
        return col.errors
    _check_unknown(
        col,
        doc,
        ("schema", "observation_id", "host", "pm2_home", "daemon_pid", "captured_at", "captured_by", "acquisition_record", "jlist_sha256"),
        "",
    )
    _schema_member(col, doc, SCHEMA_OBSERVATION_META)
    _validate_observation_common(col, doc, obs)
    obs.source = "RAW_JLIST"
    return col.errors


def validate_normalized_observation(doc: Any, obs: Observation, ref: Reference) -> List[Dict[str, str]]:
    """Validate a normalized observation (Mode B input) and cross-check it against the reference."""
    col = Collector()
    if not isinstance(doc, dict):
        col.add("WRONG_TYPE", "")
        return col.errors
    _check_unknown(
        col,
        doc,
        (
            "schema", "observation_id", "host", "pm2_home", "daemon_pid", "captured_at", "captured_by",
            "acquisition_record", "jlist_sha256", "normalized_at", "reference_id", "apps",
        ),
        "",
    )
    _schema_member(col, doc, SCHEMA_OBSERVATION)
    _validate_observation_common(col, doc, obs)
    obs.source = "NORMALIZED"
    obs.jlist_hash_verified = False
    obs.normalized_at = _timestamp_member(col, doc, "normalized_at", "", True)
    obs.reference_id = _req_identifier(col, doc, "reference_id", "", ID_RE)
    names = ref.declared_names()
    if "apps" not in doc:
        col.add("MISSING_FIELD", pointer("apps"))
    else:
        obs.apps = _validate_apps(col, doc["apps"], "OBSERVATION_FIELD_SHAPE", "PROTECTED_VALUE_IN_OBSERVATION", False, names)
    if col.errors:
        return col.errors
    # Cross-checks against the reference (observation-shape stage)
    if obs.normalized_at is not None and obs.captured_at is not None and obs.normalized_at < obs.captured_at:
        col.add("OBSERVATION_TIMESTAMPS_INCONSISTENT", pointer("normalized_at"))
    if obs.reference_id != ref.reference_id:
        col.add("OBSERVATION_REFERENCE_ID_MISMATCH", pointer("reference_id"))
    if set(obs.apps.keys()) != set(ref.apps.keys()):
        col.add("OBSERVATION_KEYSET_MISMATCH", pointer("apps"))
    else:
        for app_name, ref_keys in ref.apps.items():
            obs_keys = obs.apps[app_name]
            if set(obs_keys.keys()) != set(ref_keys.keys()):
                col.add("OBSERVATION_KEYSET_MISMATCH", pointer("apps", app_name, "keys"))
                continue
            for key_name, ref_spec in ref_keys.items():
                if obs_keys[key_name].protected != ref_spec.protected:
                    col.add("PROTECTED_FLAG_MISMATCH", pointer("apps", app_name, "keys", key_name, "protected"))
    return col.errors


# ---------------------------------------------------------------------------
# Identity and freshness (stage 4)
# ---------------------------------------------------------------------------


class IdentityFreshness:
    def __init__(self) -> None:
        self.host_checked = False
        self.pm2_home_checked = False
        self.daemon_pid_checked = False
        self.validity_window_checked = False
        self.age_seconds_at_evaluation = None  # type: Optional[int]


def check_identity_and_freshness(
    ref: Reference,
    obs: Observation,
    evaluated_at: datetime.datetime,
    max_age_seconds: Optional[int],
    marks: IdentityFreshness,
) -> List[Dict[str, str]]:
    col = Collector()
    marks.host_checked = True
    if ref.host != obs.host:
        col.add("HOST_MISMATCH", pointer("host"))
    if ref.pm2_home is not None:
        if obs.pm2_home is None:
            col.add("PM2_HOME_MISSING_IN_OBSERVATION", pointer("pm2_home"))
        else:
            marks.pm2_home_checked = True
            if ref.pm2_home.encode("utf-8") != obs.pm2_home.encode("utf-8"):
                col.add("PM2_HOME_MISMATCH", pointer("pm2_home"))
    if ref.daemon_pid is not None:
        if obs.daemon_pid is None:
            col.add("DAEMON_PID_MISSING_IN_OBSERVATION", pointer("daemon_pid"))
        else:
            marks.daemon_pid_checked = True
            if ref.daemon_pid != obs.daemon_pid:
                col.add("DAEMON_PID_MISMATCH", pointer("daemon_pid"))
    captured = obs.captured_at
    if captured is not None:
        if ref.valid_from is not None or ref.valid_until is not None:
            marks.validity_window_checked = True
            if (ref.valid_from is not None and captured < ref.valid_from) or (
                ref.valid_until is not None and captured > ref.valid_until
            ):
                col.add("OBSERVATION_OUTSIDE_REFERENCE_VALIDITY", pointer("captured_at"))
        age = int((evaluated_at - captured).total_seconds())
        marks.age_seconds_at_evaluation = age
        if captured > evaluated_at + datetime.timedelta(seconds=FUTURE_SKEW_SECONDS):
            col.add("OBSERVATION_IN_FUTURE", pointer("captured_at"))
        if max_age_seconds is not None and age > max_age_seconds:
            col.add("OBSERVATION_STALE", pointer("captured_at"))
    return col.errors


# ---------------------------------------------------------------------------
# Raw jlist structure and classification (stages 5 / 6, Mode A)
# ---------------------------------------------------------------------------


def select_jlist_elements(doc: Any, ref: Reference) -> Tuple[List[Dict[str, str]], Dict[str, Tuple[int, Dict[str, Any]]]]:
    """Apply the every-element and selected-element structural checks of section 4.3."""
    col = Collector()
    selected = {}  # type: Dict[str, Tuple[int, Dict[str, Any]]]
    if not isinstance(doc, list):
        col.add("JLIST_NOT_LIST", "")
        return col.errors, selected
    by_name = {}  # type: Dict[str, List[int]]
    for index, element in enumerate(doc):
        if not isinstance(element, dict):
            col.add("JLIST_ITEM_NOT_OBJECT", pointer(index))
            continue
        name = element.get("name") if "name" in element else None
        if not isinstance(name, str):
            col.add("JLIST_ITEM_NAME_MISSING", pointer(index))
            continue
        if name in ref.apps:
            by_name.setdefault(name, []).append(index)
    for app_name in ref.apps:
        indices = by_name.get(app_name, [])
        if len(indices) == 0:
            col.add("APP_MISSING", "", app=app_name)
        elif len(indices) > 1:
            col.add("APP_DUPLICATE", "", app=app_name)
        else:
            selected[app_name] = (indices[0], doc[indices[0]])
    if col.errors:
        return col.errors, {}
    for app_name, (index, element) in list(selected.items()):
        pm2_env = element.get("pm2_env") if "pm2_env" in element else None
        if not isinstance(pm2_env, dict):
            col.add("PM2_ENV_NOT_OBJECT", pointer(index, "pm2_env"), app=app_name)
            continue
        nested = pm2_env.get("env") if "env" in pm2_env else None
        if not isinstance(nested, dict):
            col.add("NESTED_ENV_NOT_OBJECT", pointer(index, "pm2_env", "env"), app=app_name)
    if col.errors:
        return col.errors, {}
    return [], selected


def classify_member(mapping: Dict[str, Any], key: str, protected: bool) -> Tuple[Optional[str], Optional[FieldSpec]]:
    """Return (error_code, FieldSpec) for one observed member per section 4.4."""
    if key not in mapping:
        return None, FieldSpec(STATE_ABSENT)
    value = mapping[key]
    if value is None:
        return "NULL_VALUE", None
    if not isinstance(value, str):
        return "NON_STRING_VALUE", None
    if value == "":
        return None, FieldSpec(STATE_EMPTY)
    if protected:
        return None, FieldSpec(STATE_SET, token=token_for(value))
    return None, FieldSpec(STATE_SET, value=value)


def normalize_jlist(selected: Dict[str, Tuple[int, Dict[str, Any]]], ref: Reference) -> Tuple[List[Dict[str, str]], AppsSpec]:
    col = Collector()
    apps = {}  # type: AppsSpec
    for app_name, ref_keys in ref.apps.items():
        index, element = selected[app_name]
        top_map = element["pm2_env"]
        nested_map = top_map["env"]
        app_out = {}  # type: Dict[str, KeySpec]
        for key_name, ref_spec in ref_keys.items():
            code_top, top = classify_member(top_map, key_name, ref_spec.protected)
            if code_top is not None:
                col.add(code_top, pointer(index, "pm2_env", key_name))
            code_nested, nested = classify_member(nested_map, key_name, ref_spec.protected)
            if code_nested is not None:
                col.add(code_nested, pointer(index, "pm2_env", "env", key_name))
            if top is not None and nested is not None:
                app_out[key_name] = KeySpec(ref_spec.protected, top, nested)
        apps[app_name] = app_out
    if col.errors:
        return col.errors, {}
    return [], apps


def build_normalized_observation(obs: Observation, ref: Reference, apps: AppsSpec, normalized_at: datetime.datetime) -> Dict[str, Any]:
    out = {"schema": SCHEMA_OBSERVATION, "observation_id": obs.observation_id, "host": obs.host}  # type: Dict[str, Any]
    if obs.pm2_home is not None:
        out["pm2_home"] = obs.pm2_home
    if obs.daemon_pid is not None:
        out["daemon_pid"] = obs.daemon_pid
    out["captured_at"] = format_timestamp(obs.captured_at) if obs.captured_at is not None else None
    out["captured_by"] = obs.captured_by
    out["acquisition_record"] = obs.acquisition_record
    out["jlist_sha256"] = obs.jlist_sha256
    out["normalized_at"] = format_timestamp(normalized_at)
    out["reference_id"] = ref.reference_id
    apps_out = {}  # type: Dict[str, Any]
    for app_name, keys in apps.items():
        keys_out = {}  # type: Dict[str, Any]
        for key_name, spec in keys.items():
            keys_out[key_name] = {
                "protected": spec.protected,
                FIELD_TOP: spec.top.to_json(),
                FIELD_NESTED: spec.nested.to_json(),
            }
        apps_out[app_name] = {"keys": keys_out}
    out["apps"] = apps_out
    return out


# ---------------------------------------------------------------------------
# Comparison (section 5)
# ---------------------------------------------------------------------------


def compare_field(expected: FieldSpec, observed: FieldSpec, protected: bool) -> str:
    if expected.state != observed.state:
        return RESULT_MISMATCH
    if expected.state != STATE_SET:
        return RESULT_MATCH
    if protected:
        return RESULT_MATCH if expected.token == observed.token else RESULT_MISMATCH
    return RESULT_MATCH if expected.value == observed.value else RESULT_MISMATCH


def is_divergent(top: FieldSpec, nested: FieldSpec, protected: bool) -> bool:
    if top.state != nested.state:
        return True
    if top.state != STATE_SET:
        return False
    if protected:
        return top.token != nested.token
    return top.value != nested.value


def _aggregate(results: List[str]) -> str:
    if RESULT_DIVERGENT in results:
        return RESULT_DIVERGENT
    if RESULT_MISMATCH in results:
        return RESULT_MISMATCH
    return RESULT_MATCH


def _display_value(value: Optional[str]) -> Tuple[Optional[str], bool]:
    if value is None:
        return None, False
    if len(value) > DISPLAY_TRUNCATE_CHARS:
        return value[:DISPLAY_TRUNCATE_CHARS], True
    return value, False


def _field_report(expected: FieldSpec, observed: FieldSpec, protected: bool) -> Dict[str, Any]:
    out = {
        "expected_state": expected.state,
        "observed_state": observed.state,
        "field_result": compare_field(expected, observed, protected),
    }  # type: Dict[str, Any]
    if not protected:
        if expected.state == STATE_SET:
            shown, _ = _display_value(expected.value)
            out["expected_value"] = shown
        if observed.state == STATE_SET:
            shown, truncated = _display_value(observed.value)
            out["observed_value"] = shown
            out["observed_value_truncated"] = truncated
    return out


def compare_apps(ref_apps: AppsSpec, obs_apps: AppsSpec) -> Tuple[str, Dict[str, Any], Dict[str, int]]:
    """Compare reference and observation apps blocks (same app / key sets by construction)."""
    apps_out = {}  # type: Dict[str, Any]
    app_results = []  # type: List[str]
    counts = {"apps": 0, "keys": 0, "match": 0, "mismatch": 0, "divergent": 0}
    for app_name, ref_keys in ref_apps.items():
        obs_keys = obs_apps[app_name]
        keys_out = {}  # type: Dict[str, Any]
        key_results = []  # type: List[str]
        for key_name, expected in ref_keys.items():
            observed = obs_keys[key_name]
            protected = expected.protected
            divergent = is_divergent(observed.top, observed.nested, protected)
            top_report = _field_report(expected.top, observed.top, protected)
            nested_report = _field_report(expected.nested, observed.nested, protected)
            if divergent:
                key_result = RESULT_DIVERGENT
            elif top_report["field_result"] == RESULT_MATCH and nested_report["field_result"] == RESULT_MATCH:
                key_result = RESULT_MATCH
            else:
                key_result = RESULT_MISMATCH
            keys_out[key_name] = {
                "protected": protected,
                "result": key_result,
                "divergent": divergent,
                FIELD_TOP: top_report,
                FIELD_NESTED: nested_report,
            }
            key_results.append(key_result)
            counts["keys"] += 1
            counts[key_result.lower()] += 1
        app_result = _aggregate(key_results)
        apps_out[app_name] = {"result": app_result, "keys": keys_out}
        app_results.append(app_result)
        counts["apps"] += 1
    return _aggregate(app_results), apps_out, counts


EXIT_FOR_RESULT = {
    RESULT_MATCH: EXIT_MATCH,
    RESULT_MISMATCH: EXIT_MISMATCH,
    RESULT_DIVERGENT: EXIT_DIVERGENT,
    RESULT_INVALID_INPUT: EXIT_INVALID_INPUT,
}


# ---------------------------------------------------------------------------
# Report assembly (section 5.4)
# ---------------------------------------------------------------------------


def self_sha256() -> Optional[str]:
    try:
        path = os.path.abspath(__file__)
        data = read_input_bytes(path, ROLE_REFERENCE)
    except (InvalidInput, OSError, NameError):
        return None
    return hashlib.sha256(data).hexdigest()


def _tool_block() -> Dict[str, Any]:
    return {"name": TOOL_NAME, "version": TOOL_VERSION, "self_sha256": self_sha256()}


def _timestamp_or_none(moment: Optional[datetime.datetime]) -> Optional[str]:
    return format_timestamp(moment) if moment is not None else None


def build_report(
    result: str,
    mode: Optional[str],
    evaluated_at: datetime.datetime,
    ref: Reference,
    obs: Observation,
    marks: IdentityFreshness,
    max_age_seconds: Optional[int],
    apps: Dict[str, Any],
    counts: Dict[str, int],
    errors: List[Dict[str, str]],
) -> Dict[str, Any]:
    return {
        "schema": SCHEMA_REPORT,
        "tool": _tool_block(),
        "evaluated_at": format_timestamp(evaluated_at),
        "result": result,
        "exit_code": EXIT_FOR_RESULT[result],
        "mode": mode,
        "reference": {
            "reference_id": ref.reference_id,
            "host": ref.host,
            "daemon_pid": ref.daemon_pid,
            "valid_from": _timestamp_or_none(ref.valid_from),
            "valid_until": _timestamp_or_none(ref.valid_until),
            "pm2_home_declared": ref.pm2_home_declared,
            "provenance_source_kind": ref.provenance_source_kind,
            "authority": AUTHORITY_CONSTANT,
        },
        "observation": {
            "observation_id": obs.observation_id,
            "host": obs.host,
            "daemon_pid": obs.daemon_pid,
            "captured_at": _timestamp_or_none(obs.captured_at),
            "pm2_home_declared": obs.pm2_home_declared,
            "provenance_fields_present": obs.provenance_fields_present,
            "jlist_sha256": obs.jlist_sha256,
            "source": obs.source,
            "jlist_hash_verified": obs.jlist_hash_verified,
        },
        "identity": {
            "host_checked": marks.host_checked,
            "pm2_home_checked": marks.pm2_home_checked,
            "daemon_pid_checked": marks.daemon_pid_checked,
        },
        "freshness": {
            "validity_window_checked": marks.validity_window_checked,
            "future_check_applied": True,
            "max_age_seconds": max_age_seconds,
            "age_seconds_at_evaluation": marks.age_seconds_at_evaluation,
            "limitations": FRESHNESS_LIMITATIONS,
        },
        "apps": apps,
        "counts": dict(counts),
        "errors": list(errors),
        "non_claims": dict(NON_CLAIMS),
    }


def internal_error_report(type_name: str) -> Dict[str, Any]:
    return {
        "schema": SCHEMA_REPORT,
        "tool": _tool_block(),
        "result": RESULT_INTERNAL_ERROR,
        "exit_code": EXIT_INTERNAL_ERROR,
        "error_type": type_name,
        "non_claims": dict(NON_CLAIMS),
    }


def summary_line(report: Dict[str, Any]) -> str:
    counts = report.get("counts") or {}
    ref_id = report.get("reference", {}).get("reference_id")
    obs_id = report.get("observation", {}).get("observation_id")
    mode = report.get("mode")
    return (
        "PM2_DUAL_ENV_COMPARE result={result} exit={exit_code} mode={mode} apps={apps} keys={keys} "
        "match={match} mismatch={mismatch} divergent={divergent} reference={ref} observation={obs} "
        "evidence_only=true"
    ).format(
        result=report["result"],
        exit_code=report["exit_code"],
        mode=mode if mode is not None else "-",
        apps=counts.get("apps", 0),
        keys=counts.get("keys", 0),
        match=counts.get("match", 0),
        mismatch=counts.get("mismatch", 0),
        divergent=counts.get("divergent", 0),
        ref=ref_id if ref_id is not None else "-",
        obs=obs_id if obs_id is not None else "-",
    )


def render_json(document: Dict[str, Any]) -> bytes:
    return (json.dumps(document, indent=2, sort_keys=False) + "\n").encode("utf-8")


# ---------------------------------------------------------------------------
# CLI parsing (hand-rolled; section 4.0 / 4.10)
# ---------------------------------------------------------------------------


class Invocation:
    def __init__(self) -> None:
        self.help = False
        self.mode = None  # type: Optional[str]
        self.reference = None  # type: Optional[str]
        self.observation_meta = None  # type: Optional[str]
        self.jlist = None  # type: Optional[str]
        self.observation = None  # type: Optional[str]
        self.report = None  # type: Optional[str]
        self.emit_observation = None  # type: Optional[str]
        self.max_age_seconds = None  # type: Optional[int]


def _usage_error(kind: str, flag: Optional[str] = None) -> InvalidInput:
    detail = USAGE_DETAILS[kind]
    if flag is not None:
        if flag not in VALUE_FLAGS:
            flag = FLAG_HELP
        detail = detail.format(flag=flag)
    return InvalidInput([{"code": "USAGE", "path": "", "detail": detail}])


def parse_argv(argv: List[str]) -> Invocation:
    inv = Invocation()
    seen = {}  # type: Dict[str, str]
    index = 0
    while index < len(argv):
        token = argv[index]
        if token == FLAG_HELP:
            inv.help = True
            index += 1
            continue
        if token not in VALUE_FLAGS:
            if token.startswith("-"):
                raise _usage_error("unknown")
            raise _usage_error("positional")
        if token in seen:
            raise _usage_error("repeated", token)
        if index + 1 >= len(argv) or argv[index + 1].startswith("--"):
            raise _usage_error("needs_value", token)
        value = argv[index + 1]
        seen[token] = value
        index += 2
    if inv.help:
        return inv
    if FLAG_MAX_AGE in seen:
        raw = seen[FLAG_MAX_AGE]
        if not re.match(r"^[0-9]{1,12}$", raw):
            raise _usage_error("max_age")
        inv.max_age_seconds = int(raw)
    has_ref = FLAG_REFERENCE in seen
    has_meta = FLAG_OBSERVATION_META in seen
    has_jlist = FLAG_JLIST in seen
    has_obs = FLAG_OBSERVATION in seen
    has_emit = FLAG_EMIT_OBSERVATION in seen
    if has_ref and has_meta and has_jlist and not has_obs:
        inv.mode = "A"
    elif has_ref and has_obs and not has_meta and not has_jlist and not has_emit:
        inv.mode = "B"
    else:
        raise _usage_error("combination")
    inv.reference = seen.get(FLAG_REFERENCE)
    inv.observation_meta = seen.get(FLAG_OBSERVATION_META)
    inv.jlist = seen.get(FLAG_JLIST)
    inv.observation = seen.get(FLAG_OBSERVATION)
    inv.report = seen.get(FLAG_REPORT)
    inv.emit_observation = seen.get(FLAG_EMIT_OBSERVATION)
    return inv


# ---------------------------------------------------------------------------
# Output files (exclusive creation; section 4.10 ordering)
# ---------------------------------------------------------------------------


class Outputs:
    def __init__(self) -> None:
        self.fds = {}  # type: Dict[str, int]
        self.paths = {}  # type: Dict[str, str]
        self.created = []  # type: List[str]

    def create(self, role: str, path: str) -> None:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_BINARY", 0)
        try:
            fd = os.open(path, flags, 0o600)
        except FileExistsError:
            raise InvalidInput([error_record("OUTPUT_EXISTS", "", role=role)])
        except (OSError, ValueError, TypeError):
            raise InvalidInput([error_record("OUTPUT_WRITE_FAILED", "", role=role)])
        self.created.append(path)
        self.fds[role] = fd
        self.paths[role] = path
        if os.name == "posix":
            try:
                info = os.fstat(fd)
            except OSError:
                raise InvalidInput([error_record("OUTPUT_WRITE_FAILED", "", role=role)])
            if not stat.S_ISREG(info.st_mode) or (stat.S_IMODE(info.st_mode) & 0o077) != 0:
                raise InvalidInput([error_record("OUTPUT_WRITE_FAILED", "", role=role)])

    def write(self, role: str, data: bytes) -> None:
        fd = self.fds.pop(role)
        try:
            view = memoryview(data)
            while len(view) > 0:
                written = os.write(fd, view)
                view = view[written:]
            os.fsync(fd)
        except OSError:
            try:
                os.close(fd)
            except OSError:
                pass
            raise InvalidInput([error_record("OUTPUT_WRITE_FAILED", "", role=role)])
        try:
            os.close(fd)
        except OSError:
            raise InvalidInput([error_record("OUTPUT_WRITE_FAILED", "", role=role)])
        # The path stays in ``created``: a later output failure removes every file
        # this invocation created, including outputs already written (section 4.10).

    def discard(self, role: str) -> None:
        """Remove an output created by this invocation that will not receive content."""
        if role not in self.paths:
            return
        fd = self.fds.pop(role, None)
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass
        path = self.paths.pop(role)
        if path in self.created:
            try:
                os.unlink(path)
            except OSError:
                pass
            self.created = [p for p in self.created if p != path]

    def cleanup(self) -> None:
        for fd in list(self.fds.values()):
            try:
                os.close(fd)
            except OSError:
                pass
        self.fds = {}
        for path in list(self.created):
            try:
                os.unlink(path)
            except OSError:
                pass
        self.created = []


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class Evaluation:
    def __init__(self, mode: Optional[str], max_age_seconds: Optional[int]) -> None:
        self.mode = mode
        self.max_age_seconds = max_age_seconds
        self.evaluated_at = now_utc()
        self.ref = Reference()
        self.obs = Observation()
        self.marks = IdentityFreshness()
        self.normalized = None  # type: Optional[Dict[str, Any]]


def evaluate(inv: Invocation, ev: Evaluation) -> Tuple[str, Dict[str, Any], Dict[str, int]]:
    """Run stages read -> decode -> schema -> identity/freshness -> jlist -> classification -> compare.

    Raises InvalidInput with the collected errors of the first failing stage.
    """
    # Stage 1: read (all inputs of the mode)
    read_errors = []  # type: List[Dict[str, str]]
    raw = {}  # type: Dict[str, bytes]
    roles = [(ROLE_REFERENCE, inv.reference)]
    if inv.mode == "A":
        roles.append((ROLE_OBSERVATION_META, inv.observation_meta))
        roles.append((ROLE_JLIST, inv.jlist))
    else:
        roles.append((ROLE_OBSERVATION, inv.observation))
    for role, path in roles:
        try:
            raw[role] = read_input_bytes(path or "", role)
        except InvalidInput as exc:
            read_errors.extend(exc.errors)
    if read_errors:
        raise InvalidInput(read_errors)
    # Stage 2: decode
    decode_errors = []  # type: List[Dict[str, str]]
    docs = {}  # type: Dict[str, Any]
    for role, _ in roles:
        try:
            docs[role] = decode_json(raw[role], role)
        except InvalidInput as exc:
            decode_errors.extend(exc.errors)
    if decode_errors:
        raise InvalidInput(decode_errors)
    # Stage 3: schema
    schema_errors = validate_reference(docs[ROLE_REFERENCE], ev.ref)
    if inv.mode == "A":
        schema_errors.extend(validate_observation_meta(docs[ROLE_OBSERVATION_META], ev.obs))
        if schema_errors:
            raise InvalidInput(schema_errors)
    else:
        if schema_errors:
            # The reference must be valid before the observation can be cross-checked against it;
            # observation-local shape errors are still collected in this stage.
            local = Observation()
            probe = Reference()
            probe.apps = {}
            schema_errors.extend(_observation_local_errors(docs[ROLE_OBSERVATION], local, probe))
            raise InvalidInput(schema_errors)
        schema_errors.extend(validate_normalized_observation(docs[ROLE_OBSERVATION], ev.obs, ev.ref))
        if schema_errors:
            raise InvalidInput(schema_errors)
    # Stage 4: identity / freshness
    id_errors = check_identity_and_freshness(ev.ref, ev.obs, ev.evaluated_at, ev.max_age_seconds, ev.marks)
    if id_errors:
        raise InvalidInput(id_errors)
    if inv.mode == "A":
        # Stage 5: jlist hash and structure
        digest = hashlib.sha256(raw[ROLE_JLIST]).hexdigest()
        if digest != ev.obs.jlist_sha256:
            ev.obs.jlist_hash_verified = False
            raise InvalidInput([error_record("JLIST_HASH_MISMATCH", pointer("jlist_sha256"))])
        ev.obs.jlist_hash_verified = True
        structure_errors, selected = select_jlist_elements(docs[ROLE_JLIST], ev.ref)
        if structure_errors:
            raise InvalidInput(structure_errors)
        # Stage 6: classification
        class_errors, obs_apps = normalize_jlist(selected, ev.ref)
        if class_errors:
            raise InvalidInput(class_errors)
        ev.obs.apps = obs_apps
        ev.normalized = build_normalized_observation(ev.obs, ev.ref, obs_apps, ev.evaluated_at)
    return compare_apps(ev.ref.apps, ev.obs.apps)


def _observation_local_errors(doc: Any, obs: Observation, empty_ref: Reference) -> List[Dict[str, str]]:
    """Collect the observation-local schema errors of a Mode B input when the reference itself failed.

    Cross-checks that need a valid reference are not attempted; app / key names cannot be
    vocabulary-checked and are therefore reported through placeholders only.
    """
    errors = validate_normalized_observation(doc, obs, empty_ref)
    return [e for e in errors if e["code"] not in (
        "OBSERVATION_REFERENCE_ID_MISMATCH", "OBSERVATION_KEYSET_MISMATCH", "PROTECTED_FLAG_MISMATCH",
    )]


def _emit_stdout(data: bytes) -> None:
    try:
        stream = sys.stdout.buffer  # type: ignore[attr-defined]
        stream.write(data)
        stream.flush()
    except (AttributeError, ValueError, OSError):
        try:
            sys.stdout.write(data.decode("utf-8"))
            sys.stdout.flush()
        except (ValueError, OSError):
            pass


def _emit_stderr(line: str) -> None:
    try:
        sys.stderr.write(line + "\n")
        sys.stderr.flush()
    except (ValueError, OSError):
        pass


def _run(argv: List[str], outputs: Outputs) -> int:
    try:
        inv = parse_argv(argv)
    except InvalidInput as exc:
        ev = Evaluation(None, None)
        report = build_report(RESULT_INVALID_INPUT, None, ev.evaluated_at, ev.ref, ev.obs, ev.marks, None, {}, _zero_counts(), exc.errors)
        _emit_stdout(render_json(report))
        _emit_stderr(summary_line(report))
        return EXIT_INVALID_INPUT
    if inv.help:
        _emit_stdout(USAGE_TEXT.encode("utf-8"))
        return EXIT_INVALID_INPUT
    ev = Evaluation(inv.mode, inv.max_age_seconds)
    errors = []  # type: List[Dict[str, str]]
    result = RESULT_INVALID_INPUT
    apps = {}  # type: Dict[str, Any]
    counts = _zero_counts()
    try:
        # Step 2: create every requested output exclusively before any input is read.
        if inv.report is not None:
            outputs.create(ROLE_REPORT_OUTPUT, inv.report)
        if inv.emit_observation is not None:
            outputs.create(ROLE_OBSERVATION_OUTPUT, inv.emit_observation)
        # Step 3: read, validate, normalize, compare.
        try:
            result, apps, counts = evaluate(inv, ev)
        except InvalidInput as exc:
            errors = exc.errors
            result = RESULT_INVALID_INPUT
            apps = {}
            counts = _zero_counts()
        report = build_report(result, inv.mode, ev.evaluated_at, ev.ref, ev.obs, ev.marks, inv.max_age_seconds, apps, counts, errors)
        # Step 4: persist outputs (normalized observation first, then the report), fsync, close.
        if inv.emit_observation is not None:
            if ev.normalized is not None and result != RESULT_INVALID_INPUT:
                outputs.write(ROLE_OBSERVATION_OUTPUT, render_json(ev.normalized))
            else:
                outputs.discard(ROLE_OBSERVATION_OUTPUT)
        if inv.report is not None:
            outputs.write(ROLE_REPORT_OUTPUT, render_json(report))
    except InvalidInput as exc:
        # An output operation failed (OUTPUT_EXISTS / OUTPUT_WRITE_FAILED): remove only what we created.
        outputs.cleanup()
        report = build_report(RESULT_INVALID_INPUT, inv.mode, ev.evaluated_at, ev.ref, ev.obs, ev.marks, inv.max_age_seconds, {}, _zero_counts(), exc.errors)
        _emit_stdout(render_json(report))
        _emit_stderr(summary_line(report))
        return EXIT_INVALID_INPUT
    # Step 5: only after persistence succeeded, publish to stdout / stderr.
    _emit_stdout(render_json(report))
    _emit_stderr(summary_line(report))
    return EXIT_FOR_RESULT[result]


def _zero_counts() -> Dict[str, int]:
    return {"apps": 0, "keys": 0, "match": 0, "mismatch": 0, "divergent": 0}


def main(argv: Optional[List[str]] = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
    outputs = Outputs()
    try:
        return _run(list(argv), outputs)
    except (SystemExit, KeyboardInterrupt):
        raise
    except BaseException as exc:  # noqa: B902 - top-level guard; type name only is emitted
        type_name = type(exc).__name__
        try:
            outputs.cleanup()
        except BaseException:
            pass
        try:
            _emit_stdout(render_json(internal_error_report(type_name)))
        except BaseException:
            pass
        _emit_stderr("PM2_DUAL_ENV_COMPARE result=INTERNAL_ERROR exit=1 type=" + type_name)
        return EXIT_INTERNAL_ERROR


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
