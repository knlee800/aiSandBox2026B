"""Split protected secrets from redacted overlay metadata.

Permission-setting failures are not ignored. Secret values never enter
metadata.json or stdout.

PM2-OVERLAY-UNKNOWN-01 (stage-start §4 as corrected by §10.3, controlling):
this module also owns the durable command-attempt journal
(``overlay_commands.json``), the monotonic ``UNKNOWN_PENDING_OVERLAY`` latch
(``unknown_overlay.json``), the redacted ``restore_result.json`` record, the
vault-scoped cross-process run lock (``.run.lock``), and the fail-closed
next-run refusal. Nothing in this module clears the latch, resolves an
orphaned attempt, or deletes recovery material without a proven restore;
there is no such procedure in this bundle.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from secret_io import secure_replace_file

PROTECTED_NAMES = frozenset(
    {
        "HARNESS_ENTITLEMENT_HMAC_SECRET",
        "AISB_01C6A_HMAC_SECRET",
        "XAI_API_KEY",
        "AISB_01C6A_API_KEY_TOKEN",
        "DATABASE_URL",
        "REDIS_URL",
    }
)

ORDINARY_FLAGS = (
    "AGENT_HARNESS_ENABLE_TOOL_LOOP",
    "GLOBAL_EXECUTION_ENABLED",
    "PROVIDER_XAI_ENABLED",
    "AGENT_HARNESS_ENABLE_WRITE_TOOLS",
    "AGENT_HARNESS_STUB_WRITE_MODE",
)

HMAC_NAMES = ("HARNESS_ENTITLEMENT_HMAC_SECRET", "AISB_01C6A_HMAC_SECRET")
META_SKIP = frozenset({"_pending_apps", "_format"})

JOURNAL_FILE = "overlay_commands.json"
UNKNOWN_MARKER_FILE = "unknown_overlay.json"
RESTORE_RESULT_FILE = "restore_result.json"
PENDING_APPS_FILE = "pending_apps.json"
RUN_LOCK_FILE = ".run.lock"
JOURNAL_FORMAT = 1
MARKER_FORMAT = 1

# Journal phases. INTENT and DISPATCHED are non-terminal.
PHASE_INTENT = "INTENT"
PHASE_DISPATCHED = "DISPATCHED"
FATE_ACKED = "ACKED"
FATE_NOT_DELIVERED = "NOT_DELIVERED"
FATE_UNCERTAIN = "UNCERTAIN"
TERMINAL_PHASES = frozenset({FATE_ACKED, FATE_NOT_DELIVERED, FATE_UNCERTAIN})
ALL_PHASES = frozenset({PHASE_INTENT, PHASE_DISPATCHED}) | TERMINAL_PHASES

DURABILITY_FULL = "FULL"
DURABILITY_RENAME_ONLY = "RENAME_ONLY"

# Indirection so a test spy can observe the durable-write call sequence
# without patching the ``os`` module globally.
_fsync = os.fsync
_replace = os.replace


class VaultStateError(RuntimeError):
    """Fail-closed vault state error. ``code`` is a stable machine token."""

    def __init__(self, code: str, message: str = "", *, codes: list[str] | None = None) -> None:
        super().__init__(message or code)
        self.code = code
        self.codes = list(codes) if codes else [code]


@dataclass
class OverlayVar:
    name: str
    state: str  # SET | EMPTY | ABSENT
    restore_value: str | None  # exact SET value; None for EMPTY/ABSENT
    secret: bool


def classify_state(raw: str | None) -> str:
    if raw is None:
        return "ABSENT"
    if raw == "":
        return "EMPTY"
    return "SET"


# ---------------------------------------------------------------------------
# Durable atomic replace (§10.3.C)
# ---------------------------------------------------------------------------


def durable_replace(path: str, data: bytes | str, mode: int = 0o600) -> str:
    """Atomically replace ``path`` with ``data`` and make the result durable.

    Same-directory temp file -> write -> flush -> fsync(file) -> os.replace ->
    fsync(directory) on POSIX. ``os.replace`` alone gives atomic visibility,
    not crash durability; the directory fsync makes the rename durable. On
    Windows no directory fsync exists; the caller records ``RENAME_ONLY`` and
    Windows is not a supported execution target for this state machine.
    Raises ``OSError`` on any failure; the caller decides the fail-closed
    consequence.
    """
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    payload = data if isinstance(data, bytes) else data.encode("utf-8")
    tmp = tempfile.NamedTemporaryFile(dir=directory, prefix=".tmp-", suffix=".part", delete=False)
    tmp_name = tmp.name
    try:
        try:
            if os.name != "nt":
                os.chmod(tmp_name, mode)
            tmp.write(payload)
            tmp.flush()
            _fsync(tmp.fileno())
        finally:
            tmp.close()
        _replace(tmp_name, path)
    except BaseException:
        try:
            os.remove(tmp_name)
        except OSError:
            pass
        raise
    if os.name == "nt":
        return DURABILITY_RENAME_ONLY
    dfd = os.open(directory, os.O_RDONLY)
    try:
        _fsync(dfd)
    finally:
        os.close(dfd)
    return DURABILITY_FULL


def _dump_json_bytes(obj: Any) -> bytes:
    return (json.dumps(obj, indent=2, sort_keys=True) + "\n").encode("utf-8")


# ---------------------------------------------------------------------------
# Vault writers (existing semantics; pending_apps writes are now durable)
# ---------------------------------------------------------------------------


def _entries_from_captured(vault_dir: str, captured: Mapping[str, str | None], *, rel_protected: str) -> dict[str, Any]:
    protected = os.path.join(vault_dir, rel_protected)
    os.makedirs(protected, exist_ok=True)
    meta: dict[str, Any] = {}
    for name, raw in captured.items():
        if name in META_SKIP:
            continue
        state = classify_state(raw)
        secret = name in PROTECTED_NAMES
        entry: dict[str, Any] = {"state": state, "secret": secret}
        if secret:
            path = os.path.join(protected, f"{name}.value")
            if state == "SET":
                secure_replace_file(path, raw or "", mode=0o600)
                entry["protected_file"] = f"{rel_protected}/{name}.value"
            else:
                entry["protected_file"] = None
        else:
            entry["value"] = raw if state == "SET" else None
        meta[name] = entry
    return meta


def write_vault(vault_dir: str, captured: Mapping[str, str | None]) -> None:
    os.makedirs(vault_dir, exist_ok=True)
    meta = _entries_from_captured(vault_dir, captured, rel_protected="protected")
    meta["_format"] = "shared"
    meta_path = os.path.join(vault_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")


def write_app_vault(vault_dir: str, app: str, captured: Mapping[str, str | None]) -> None:
    if not app or app.startswith("."):
        raise ValueError("invalid app name")
    app_dir = os.path.join(vault_dir, "apps", app)
    os.makedirs(app_dir, exist_ok=True)
    meta = _entries_from_captured(app_dir, captured, rel_protected="protected")
    meta["_format"] = "app"
    meta_path = os.path.join(app_dir, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, sort_keys=True)
        f.write("\n")


def mark_pending_apps(vault_dir: str, apps: list[str]) -> None:
    os.makedirs(vault_dir, exist_ok=True)
    path = os.path.join(vault_dir, PENDING_APPS_FILE)
    existing: list[str] = []
    if os.path.isfile(path):
        try:
            raw = json.loads(Path(path).read_text(encoding="utf-8"))
            if isinstance(raw, list):
                existing = [str(x) for x in raw]
        except json.JSONDecodeError:
            existing = []
    merged = list(dict.fromkeys([*existing, *apps]))
    durable_replace(path, (json.dumps(merged) + "\n").encode("utf-8"))


def load_pending_apps(vault_dir: str) -> list[str]:
    path = os.path.join(vault_dir, PENDING_APPS_FILE)
    if not os.path.isfile(path):
        return []
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


def clear_pending_app(vault_dir: str, app: str) -> None:
    """Remove one app from the pending marker.

    Callers may invoke this only after a *proven* restore (stage-start
    §10.3.A.4). It refuses while the vault is latched or has unresolved
    attempts so a caller cannot clear pending state under UNKNOWN.
    """
    codes = unresolved_state_codes(vault_dir)
    if codes:
        raise VaultStateError("UNKNOWN_LATCHED", "pending state retained while UNKNOWN/unresolved", codes=codes)
    pending = [a for a in load_pending_apps(vault_dir) if a != app]
    path = os.path.join(vault_dir, PENDING_APPS_FILE)
    durable_replace(path, (json.dumps(pending) + "\n").encode("utf-8"))


def load_metadata(vault_dir: str) -> dict[str, Any]:
    path = os.path.join(vault_dir, "metadata.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_app_metadata(vault_dir: str, app: str) -> dict[str, Any]:
    app_meta = os.path.join(vault_dir, "apps", app, "metadata.json")
    if os.path.isfile(app_meta):
        with open(app_meta, "r", encoding="utf-8") as f:
            return json.load(f)
    return load_metadata(vault_dir)


def var_entries(metadata: Mapping[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in metadata.items() if k not in META_SKIP and isinstance(v, dict) and "state" in v}


def load_protected(vault_dir: str, name: str, *, app: str | None = None) -> str | None:
    candidates = []
    if app:
        candidates.append(os.path.join(vault_dir, "apps", app, "protected", f"{name}.value"))
    candidates.append(os.path.join(vault_dir, "protected", f"{name}.value"))
    for path in candidates:
        if os.path.isfile(path):
            return Path(path).read_text(encoding="utf-8")
    return None


# ---------------------------------------------------------------------------
# Command-attempt journal (§4.1, §10.3.B, §10.3.C)
# ---------------------------------------------------------------------------


def _journal_path(vault_dir: str) -> str:
    return os.path.join(vault_dir, JOURNAL_FILE)


def _marker_path(vault_dir: str) -> str:
    return os.path.join(vault_dir, UNKNOWN_MARKER_FILE)


def _validate_journal_shape(raw: Any) -> list[dict[str, Any]]:
    """Return entries or raise ``VaultStateError('UNKNOWN_STATE_CORRUPT')``."""
    if not isinstance(raw, dict):
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal is not an object")
    if raw.get("format") != JOURNAL_FORMAT:
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal format unsupported")
    entries = raw.get("entries")
    if not isinstance(entries, list):
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal entries missing")
    expected_seq = 1
    for entry in entries:
        if not isinstance(entry, dict):
            raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal entry is not an object")
        for key in ("attempt_id", "run_id", "op", "app", "phase", "seq"):
            if key not in entry:
                raise VaultStateError("UNKNOWN_STATE_CORRUPT", f"journal entry missing {key}")
        if entry["phase"] not in ALL_PHASES:
            raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal entry phase invalid")
        if entry["seq"] != expected_seq:
            raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal seq not contiguous")
        expected_seq += 1
    return entries


def load_journal_entries(vault_dir: str) -> list[dict[str, Any]]:
    """Read and validate the journal. Missing file -> []. Corrupt -> raise."""
    path = _journal_path(vault_dir)
    if not os.path.isfile(path):
        return []
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", f"journal unreadable: {type(exc).__name__}") from exc
    return _validate_journal_shape(raw)


def entry_is_terminal(entry: Mapping[str, Any]) -> bool:
    return entry.get("phase") in TERMINAL_PHASES


def entry_is_unresolved(entry: Mapping[str, Any]) -> bool:
    """Non-terminal (INTENT/DISPATCHED without fate) or UNCERTAIN."""
    phase = entry.get("phase")
    return phase not in TERMINAL_PHASES or phase == FATE_UNCERTAIN


class CommandJournal:
    """Durable, serialized command-attempt journal for one run.

    All mutations reload the file under ``lock`` (the journal lock; ordered
    *after* any coordination lock the caller holds), verify contiguity and
    the in-memory ``seq`` expectation, then write with ``durable_replace``.
    """

    def __init__(self, vault_dir: str, *, run_id: str | None = None, pid: int | None = None) -> None:
        self.vault_dir = vault_dir
        self.run_id = run_id or uuid.uuid4().hex
        self.pid = pid if pid is not None else os.getpid()
        self.lock = threading.Lock()
        self._expected_last_seq: int | None = None
        self.last_durability: str | None = None

    # -- internal ---------------------------------------------------------
    def _load_locked(self) -> list[dict[str, Any]]:
        entries = load_journal_entries(self.vault_dir)
        last = entries[-1]["seq"] if entries else 0
        if self._expected_last_seq is not None and last != self._expected_last_seq:
            raise VaultStateError(
                "JOURNAL_SEQ_MISMATCH",
                f"journal seq {last} != expected {self._expected_last_seq}",
            )
        return entries

    def _write_locked(self, entries: list[dict[str, Any]]) -> None:
        payload = {"format": JOURNAL_FORMAT, "entries": entries}
        try:
            self.last_durability = durable_replace(_journal_path(self.vault_dir), _dump_json_bytes(payload))
        except OSError as exc:
            raise VaultStateError("JOURNAL_WRITE_FAILED", f"{type(exc).__name__}") from exc
        self._expected_last_seq = entries[-1]["seq"] if entries else 0

    def _find_locked(self, entries: list[dict[str, Any]], attempt_id: str) -> dict[str, Any]:
        for entry in entries:
            if entry.get("attempt_id") == attempt_id:
                return entry
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", "journal entry for attempt missing")

    # -- public -----------------------------------------------------------
    def entries(self) -> list[dict[str, Any]]:
        with self.lock:
            return [dict(e) for e in self._load_locked()]

    def intent(self, op: str, app: str, keys: list[str]) -> str:
        """Persist INTENT before any child may be spawned. Returns attempt_id."""
        attempt_id = uuid.uuid4().hex
        with self.lock:
            entries = self._load_locked()
            entries.append(
                {
                    "attempt_id": attempt_id,
                    "run_id": self.run_id,
                    "pid": self.pid,
                    "seq": (entries[-1]["seq"] + 1) if entries else 1,
                    "op": op,
                    "app": app,
                    "keys": sorted(str(k) for k in keys),
                    "phase": PHASE_INTENT,
                    "mono_ts": time.monotonic(),
                    "wall_ts": time.time(),
                    "client_pid": None,
                    "exit_code": None,
                    "reason": None,
                    # Windows has no directory fsync (§10.3.C step 4); disclosed per entry.
                    "durability": DURABILITY_RENAME_ONLY if os.name == "nt" else DURABILITY_FULL,
                }
            )
            self._write_locked(entries)
        return attempt_id

    def dispatched(self, attempt_id: str, client_pid: int | None) -> None:
        with self.lock:
            entries = self._load_locked()
            entry = self._find_locked(entries, attempt_id)
            if entry["phase"] != PHASE_INTENT:
                raise VaultStateError("UNKNOWN_STATE_CORRUPT", "DISPATCHED after non-INTENT phase")
            entry["phase"] = PHASE_DISPATCHED
            entry["client_pid"] = client_pid
            entry["dispatched_mono_ts"] = time.monotonic()
            self._write_locked(entries)

    def terminal(
        self,
        attempt_id: str,
        fate: str,
        *,
        exit_code: int | None = None,
        reason: str | None = None,
    ) -> None:
        if fate not in TERMINAL_PHASES:
            raise ValueError("invalid terminal fate")
        with self.lock:
            entries = self._load_locked()
            entry = self._find_locked(entries, attempt_id)
            if entry["phase"] in TERMINAL_PHASES:
                # A terminal is written once. Uncertainty stays latched:
                # only an upgrade *to* UNCERTAIN is permitted afterwards.
                if fate == FATE_UNCERTAIN and entry["phase"] != FATE_UNCERTAIN:
                    entry["phase"] = FATE_UNCERTAIN
                    entry["reason"] = reason or entry.get("reason")
                    entry["terminal_mono_ts"] = time.monotonic()
                    self._write_locked(entries)
                return
            entry["phase"] = fate
            entry["exit_code"] = exit_code
            entry["reason"] = reason
            entry["terminal_mono_ts"] = time.monotonic()
            self._write_locked(entries)

    #: Fields that identify an entry or constitute its (write-once) terminal.
    #: ``annotate`` never touches them; late evidence goes into separate keys.
    IMMUTABLE_ENTRY_FIELDS = frozenset(
        {"attempt_id", "run_id", "pid", "seq", "op", "app", "keys", "phase", "reason", "exit_code", "terminal_mono_ts"}
    )

    def annotate(self, attempt_id: str, **fields: Any) -> None:
        """Attach non-value evidence metadata (e.g. ``late_ack=...``) to an entry.

        Identity and terminal fields (``phase`` / ``reason`` / ``exit_code`` /
        ``terminal_mono_ts`` ...) are never rewritten: a late acknowledgement
        after an UNCERTAIN terminal is additional evidence, not a new fate.
        """
        with self.lock:
            entries = self._load_locked()
            entry = self._find_locked(entries, attempt_id)
            changed = False
            for key, value in fields.items():
                if key in self.IMMUTABLE_ENTRY_FIELDS:
                    continue
                entry[key] = value
                changed = True
            if changed:
                self._write_locked(entries)


# ---------------------------------------------------------------------------
# UNKNOWN_PENDING_OVERLAY latch (§4.3; monotonic)
# ---------------------------------------------------------------------------


def _load_marker(vault_dir: str) -> dict[str, Any] | None:
    path = _marker_path(vault_dir)
    if not os.path.isfile(path):
        return None
    try:
        raw = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", f"marker unreadable: {type(exc).__name__}") from exc
    if not isinstance(raw, dict) or raw.get("format") != MARKER_FORMAT:
        raise VaultStateError("UNKNOWN_STATE_CORRUPT", "marker shape invalid")
    return raw


def latch_unknown(
    vault_dir: str,
    *,
    attempts: list[str] | None = None,
    apps: list[str] | None = None,
    keys: list[str] | None = None,
    reasons: list[str] | None = None,
    journal: CommandJournal | None = None,
) -> None:
    """Write or refresh the UNKNOWN marker. Never removes anything.

    Existing marker content is merged (union), so a later latch cannot narrow
    an earlier one. Serialized through the journal lock when a journal is
    supplied so marker and journal writes never interleave.
    """
    lock = journal.lock if journal is not None else threading.Lock()
    with lock:
        try:
            existing = _load_marker(vault_dir)
        except VaultStateError:
            existing = None  # corrupt marker is still a latch; rewrite a valid one
        merged: dict[str, Any] = {
            "format": MARKER_FORMAT,
            "latched_wall_ts": (existing or {}).get("latched_wall_ts", time.time()),
            "latched_mono_ts": (existing or {}).get("latched_mono_ts", time.monotonic()),
            "attempts": [],
            "apps": [],
            "keys": [],
            "reasons": [],
            "refreshed_wall_ts": time.time(),
        }
        for field_name, extra in (("attempts", attempts), ("apps", apps), ("keys", keys), ("reasons", reasons)):
            values = list((existing or {}).get(field_name) or [])
            for item in extra or []:
                if item not in values:
                    values.append(item)
            merged[field_name] = [str(v) for v in values]
        try:
            os.makedirs(vault_dir, exist_ok=True)
            durable_replace(_marker_path(vault_dir), _dump_json_bytes(merged))
        except OSError as exc:
            raise VaultStateError("JOURNAL_WRITE_FAILED", f"marker: {type(exc).__name__}") from exc


def unresolved_state_codes(vault_dir: str) -> list[str]:
    """Codes describing why the vault is unresolved; [] when clean.

    Fail closed: an unreadable or malformed marker/journal yields
    ``UNKNOWN_STATE_CORRUPT`` rather than "clean".
    """
    codes: list[str] = []
    if not os.path.isdir(vault_dir):
        return codes
    try:
        if _load_marker(vault_dir) is not None:
            codes.append("UNRESOLVED_UNKNOWN_OVERLAY")
    except VaultStateError:
        codes.append("UNKNOWN_STATE_CORRUPT")
    try:
        entries = load_journal_entries(vault_dir)
    except VaultStateError:
        if "UNKNOWN_STATE_CORRUPT" not in codes:
            codes.append("UNKNOWN_STATE_CORRUPT")
        entries = []
    if any(entry_is_unresolved(e) for e in entries):
        codes.append("UNRESOLVED_COMMAND_ATTEMPTS")
    return codes


def unknown_latched(vault_dir: str) -> bool:
    """Latched iff marker exists, or journal has UNCERTAIN/non-terminal, or state is corrupt."""
    return bool(unresolved_state_codes(vault_dir))


def orphaned_attempts(vault_dir: str, *, run_id: str) -> list[dict[str, Any]]:
    """Non-terminal entries not owned by ``run_id``. Corrupt journal -> raise."""
    return [
        dict(e)
        for e in load_journal_entries(vault_dir)
        if not entry_is_terminal(e) and e.get("run_id") != run_id
    ]


def write_restore_result(vault_dir: str, payload: Mapping[str, Any]) -> None:
    """Persist the redacted restore result (names/states only, never values)."""
    try:
        os.makedirs(vault_dir, exist_ok=True)
        durable_replace(os.path.join(vault_dir, RESTORE_RESULT_FILE), _dump_json_bytes(dict(payload)))
    except OSError as exc:
        raise VaultStateError("JOURNAL_WRITE_FAILED", f"restore_result: {type(exc).__name__}") from exc


# ---------------------------------------------------------------------------
# Vault-scoped cross-process run lock (§10.3.C)
# ---------------------------------------------------------------------------

_HELD_RUN_LOCKS: dict[str, "VaultRunLock"] = {}
_HELD_RUN_LOCKS_GUARD = threading.Lock()


def _lock_key(vault_dir: str) -> str:
    return os.path.normcase(os.path.realpath(os.path.abspath(vault_dir)))


class VaultRunLock:
    """Exclusive per-vault run lock.

    ``acquire`` raises ``VaultStateError('RUN_LOCK_HELD')`` when another
    process holds the OS lock **or** when this process already holds a run
    lock for the same vault (a second independent run in one process is a
    competing run, not the owner). The owning run passes its held lock object
    to nested calls (``restore_overlays(run_lock=...)``) instead of
    re-acquiring, so nested calls never deadlock on their own lock.
    """

    def __init__(self, vault_dir: str) -> None:
        self.vault_dir = vault_dir
        self.path = os.path.join(vault_dir, RUN_LOCK_FILE)
        self._fd: int | None = None
        self._key = _lock_key(vault_dir)
        self.held = False

    def acquire(self) -> "VaultRunLock":
        with _HELD_RUN_LOCKS_GUARD:
            if self._key in _HELD_RUN_LOCKS:
                raise VaultStateError("RUN_LOCK_HELD", "run lock already held in this process")
            os.makedirs(self.vault_dir, exist_ok=True)
            fd = os.open(self.path, os.O_RDWR | os.O_CREAT, 0o600)
            try:
                if os.name == "nt":
                    import msvcrt

                    try:
                        msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
                    except OSError as exc:
                        raise VaultStateError("RUN_LOCK_HELD", "run lock held by another process") from exc
                else:
                    import fcntl

                    try:
                        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    except OSError as exc:
                        raise VaultStateError("RUN_LOCK_HELD", "run lock held by another process") from exc
            except BaseException:
                os.close(fd)
                raise
            self._fd = fd
            self.held = True
            _HELD_RUN_LOCKS[self._key] = self
        return self

    def release(self) -> None:
        with _HELD_RUN_LOCKS_GUARD:
            if not self.held:
                return
            fd = self._fd
            self._fd = None
            self.held = False
            if _HELD_RUN_LOCKS.get(self._key) is self:
                del _HELD_RUN_LOCKS[self._key]
            if fd is None:
                return
            try:
                if os.name == "nt":
                    import msvcrt

                    try:
                        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
                    except OSError:
                        pass
                else:
                    import fcntl

                    try:
                        fcntl.flock(fd, fcntl.LOCK_UN)
                    except OSError:
                        pass
            finally:
                os.close(fd)

    def __enter__(self) -> "VaultRunLock":
        return self.acquire()

    def __exit__(self, *_exc: Any) -> None:
        self.release()


# ---------------------------------------------------------------------------
# Recovery presence, next-run refusal, deletion gate
# ---------------------------------------------------------------------------


def protected_recovery_present(vault_dir: str) -> bool:
    """True when protected recovery material still exists.

    Extended (§4.5 note): the UNKNOWN marker and any unresolved journal entry
    (or corrupt marker/journal) count as recovery material.
    """
    pending_path = os.path.join(vault_dir, PENDING_APPS_FILE)
    if os.path.isfile(pending_path):
        try:
            pending = load_pending_apps(vault_dir)
        except (OSError, json.JSONDecodeError):
            return True
        if pending:
            return True
    if unresolved_state_codes(vault_dir):
        return True
    roots = [os.path.join(vault_dir, "protected")]
    apps_dir = os.path.join(vault_dir, "apps")
    if os.path.isdir(apps_dir):
        for name in os.listdir(apps_dir):
            roots.append(os.path.join(apps_dir, name, "protected"))
    for root in roots:
        if not os.path.isdir(root):
            continue
        for fname in os.listdir(root):
            if fname.endswith(".value") and os.path.isfile(os.path.join(root, fname)):
                return True
    return False


def refuse_unresolved_vault(vault_dir: str) -> None:
    """Raise when the vault carries any unresolved state (§4.7).

    Codes (all fail closed): ``UNRESOLVED_VAULT_EXISTS`` (protected material
    or pending apps), ``UNRESOLVED_UNKNOWN_OVERLAY`` (marker),
    ``UNRESOLVED_COMMAND_ATTEMPTS`` (non-terminal or UNCERTAIN journal entry),
    ``UNKNOWN_STATE_CORRUPT`` (marker/journal unreadable or malformed).
    """
    if not os.path.isdir(vault_dir):
        return
    codes = unresolved_state_codes(vault_dir)
    pending_or_protected = False
    pending_path = os.path.join(vault_dir, PENDING_APPS_FILE)
    if os.path.isfile(pending_path):
        try:
            pending_or_protected = bool(load_pending_apps(vault_dir))
        except (OSError, json.JSONDecodeError):
            pending_or_protected = True
    if not pending_or_protected:
        roots = [os.path.join(vault_dir, "protected")]
        apps_dir = os.path.join(vault_dir, "apps")
        if os.path.isdir(apps_dir):
            for name in os.listdir(apps_dir):
                roots.append(os.path.join(apps_dir, name, "protected"))
        for root in roots:
            if os.path.isdir(root) and any(
                f.endswith(".value") and os.path.isfile(os.path.join(root, f)) for f in os.listdir(root)
            ):
                pending_or_protected = True
                break
    if pending_or_protected:
        codes.insert(0, "UNRESOLVED_VAULT_EXISTS")
    if codes:
        raise VaultStateError(codes[0], ",".join(codes), codes=codes)


def _is_proven_restore(result: Any) -> bool:
    return bool(result is not None and getattr(result, "restore_proven", False) is True)


def delete_protected_recovery(vault_dir: str, *, proven_result: Any = None) -> None:
    """Delete protected recovery secrets only after a *proven* restore.

    Refuses (``RESTORE_UNPROVEN``) unless ``proven_result.restore_proven`` is
    True, and (``UNKNOWN_LATCHED``) while the marker or unresolved journal
    entries exist — so a caller-supplied ``delete_vault`` cannot bypass the
    latch or the F5 gate. In this bundle no production path can produce a
    proven result (stage-start §10.3.A), so this function never deletes in
    production. Redacted metadata is always kept.
    """
    if not _is_proven_restore(proven_result):
        raise VaultStateError("RESTORE_UNPROVEN", "recovery deletion requires a proven restore result")
    codes = unresolved_state_codes(vault_dir)
    if codes:
        raise VaultStateError("UNKNOWN_LATCHED", "recovery material retained while UNKNOWN/unresolved", codes=codes)
    roots = [os.path.join(vault_dir, "protected")]
    apps_dir = os.path.join(vault_dir, "apps")
    if os.path.isdir(apps_dir):
        for name in os.listdir(apps_dir):
            roots.append(os.path.join(apps_dir, name, "protected"))
    for root in roots:
        if not os.path.isdir(root):
            continue
        for fname in os.listdir(root):
            path = os.path.join(root, fname)
            if os.path.isfile(path):
                os.remove(path)
        try:
            os.rmdir(root)
        except OSError:
            pass
    pending_path = os.path.join(vault_dir, PENDING_APPS_FILE)
    if os.path.isfile(pending_path):
        os.remove(pending_path)


def restore_plan(metadata: Mapping[str, Any], hmac_absent_empty_authorized: bool) -> dict[str, OverlayVar]:
    plan: dict[str, OverlayVar] = {}
    for name, entry in var_entries(metadata).items():
        state = entry["state"]
        secret = bool(entry.get("secret"))
        value = entry.get("value")
        if name in HMAC_NAMES and state == "ABSENT":
            if hmac_absent_empty_authorized:
                plan[name] = OverlayVar(name, "EMPTY", "", secret)
            else:
                plan[name] = OverlayVar(name, "ABSENT", None, secret)
            continue
        if state == "SET":
            plan[name] = OverlayVar(name, "SET", value, secret)
        elif state == "EMPTY":
            plan[name] = OverlayVar(name, "EMPTY", "", secret)
        else:
            plan[name] = OverlayVar(name, "ABSENT", None, secret)
    return plan
