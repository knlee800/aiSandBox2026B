# PM2-RECOVERY-VERIFY-01 — Stage-start / Step 2 freeze

**Task:** PM2-RECOVERY-VERIFY-01 — Bounded comparison-only PM2 dual-field overlay verifier
**Nature:** IMPLEMENTATION (4-step, high-risk; operator-side comparison evidence tooling)
**Current status:** **Step 2 COMPLETE — FREEZE — 2026-09-19; CORRECTED 2026-09-19 before implementation (§14).** Step 1 COMPLETE (registration `f020941afa3258ef80e9cad6939051fa26c3e4a2`, board/backlog/sidecar only). **Steps 3–4 NOT AUTHORIZED.** Nothing implemented, executed, dispatched, transferred, or admitted. Occupancy EMPTY. `admissionUncertain=true`. EXEC-01C6A `startCondition=NOT_READY` unchanged.
**Step 2 base HEAD:** `f020941afa3258ef80e9cad6939051fa26c3e4a2` (branch main; working tree clean at window open; Step 1 registration commit `docs: register pm2 recovery verifier`; matches the expected baseline named in the authorization)
**Governance decision predecessor (LOCKED):** PM2-RECOVERY-POLICY-01 — `docs/PM2-RECOVERY-POLICY-01-STAGE-START.md` §3.4 (B(H) requirements), §4.3 (prohibited in every outcome), §5.3 (P6 comparison-only procedure), §5.5 (manual vs verifier), §5.6 (PM2 client side-effect model), §13 (K-B3=VERIFIER direction only; A1 / A2 OPEN), §14 (lock)
**Implementation predecessor (LOCKED):** PM2-OVERLAY-UNKNOWN-01 — `docs/PM2-OVERLAY-UNKNOWN-01-STAGE-START.md` §3.4 (packaging), §4.8 (dual-field verification), §15.3 / §16.3 (evidence limits; lock); r3 tree `ops/aisb-01c6a-operator-bundle/` at `17a9855bc9ada298bcdbaf029eb208a3868a425d`; archive `aisb-01c6a-operator-review-r3-unknown-latch.zip` SHA-256 `e4473a8003ddad2f61747f7f8a576d4079302fd37f4c6a9ec2bf301b3d6ec2a2` (NOT APPROVED FOR LIVE USE; preserved unchanged by this task)

**Step 2 verdict (summary; detail in §12):** the verifier is frozen as an **offline comparison core with no PM2 client and no observation adapter** (§3). Its exact six-file write set is established (§7), so the sidecar candidate moves to `writeSetPrecision=EXACT` with HOTFILE leases on those six paths; `admissionUncertain` stays `true` because the fake-only execution location (a GitHub-hosted runner dispatch) and Step 3 itself remain unauthorized. Live observation acquisition is **not** in this task: it is identified as a separately authorized prerequisite (§3.4) that this freeze does not register.

---

## 0. Authorization and boundaries of this window

Keith authorized (2026-09-19, Step 2 only): static inspection of tracked code, creation of this document, and the control-plane writes listed in §13. Performed: static reads of `ops/aisb-01c6a-operator-bundle/lib/{overlay_restore,vault,secret_io,__init__}.py`, `bin/{mock-pm2,verify-transfer,write-transfer-manifest}.py`, `bin/restore-overlays.sh`, `TRANSFER.manifest`, `REVIEW-SHA256.txt`, `OPERATOR-BUNDLE.md` headings, `tests/test_operator_bundle.py` (import block, class list, `FakePm2Dual`, `compare_restore_dual` call sites), `.gitattributes`, `.github/workflows/pm2-overlay-unknown-verify.yml`, `docs/control-plane/mutex-catalog.json`, and the two predecessor freezes (targeted sections). Not performed: implementation, any import, compilation, test, mock, build, install, bundle mutation, workflow creation or edit, workflow dispatch, SSH, staging, PM2, browser, provider / credit, vendor fetch, Git mutation, subagents.

No protected recovery value, vault payload, `config/defaults.env` content, or host environment value was read.

This freeze does **not**: execute or authorize P6; select or close A1 / A2; designate B(H) or any baseline source or value; implement a first-run exception; authorize any PM2 client invocation, staging access, r3 / r4 transfer or live use; attest P4 / P5 / P7 or host CLEAN; prove F1–F5; satisfy the OUTCOME_UNKNOWN_POLICY reopen gate; amend EXEC-01C6A or change its `startCondition=NOT_READY`; authorize a canary; admit a lane; introduce a clearance mechanism or proof override.

---

## 1. Authority consulted (read-only; referenced, not repeated)

| Source | Used for |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | boot sequence; worker limits; lean metadata; evidence classes; mutex / HOTFILE semantics; runtime rules |
| `TASKS.md` CURRENT EXECUTION BOARD | occupancy EMPTY; GOVERNANCE UNOWNED; this task REGISTERED / READY / NOT ADMITTED; Steps 2–4 NOT AUTHORIZED at window open |
| `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-VERIFY-01 | registered purpose; scope boundaries 1–8; Step 2 obligations; Keith-decision boundary |
| PM2-RECOVERY-POLICY-01 stage-start §3.4, §4.2–§4.4, §5.3, §5.5, §5.6, §13 | B(H) content requirements (per key, per app, per field; presence token for secrets; provenance chain; validity conditions); comparison-only reads PERMITTED only when authorized; §5.6 call-path-grounded side-effect model; VERIFIER direction; A1 / A2 OPEN |
| PM2-OVERLAY-UNKNOWN-01 stage-start §3.4, §4.8, §15.3, §16 | packaging convention (archive hash recorded outside the archive); dual-field semantics and DIVERGENT rule; evidence limits; r3 lock |
| r3 code (paths in §0) | static suitability review of reuse candidates (§2) |
| `docs/control-plane/mutex-catalog.json` | no catalog mutex prefix covers `ops/` or `.github/` → HOTFILE leases (§7.4) |

Frozen source maps and locked checkpoints are evidence, not schedulers. Nothing was selected from chat, roadmap, or Platform-00.

---

## 2. Static suitability review of existing primitives (trace before reuse)

All observations below are from static reading of the r3 tree at `f020941` (identical bytes to `17a9855` for the 40 bundle files; `git status` clean). Nothing was imported or executed.

### 2.1 Import graph facts

- `lib/overlay_restore.py` imports `subprocess`, `threading`, `time`, `inspect`, `json`, `math`, `os`, `sys` and `from vault import …` (l.26–59). `lib/vault.py` imports `secret_io`. `lib/secret_io.py` and `lib/vault.py` import stdlib only and have no module-level side effects beyond constants (`vault.py` binds `_fsync = os.fsync`, `_replace = os.replace`). Importing `overlay_restore` does **not** spawn anything at import time, but it places `subprocess` in the process and exposes `CliPm2`, whose every method spawns the PM2 client.
- The bundle is not a package (`lib/__init__.py` is a two-line comment; scripts and tests do `sys.path.insert(0, <lib>)`, `tests/test_operator_bundle.py` l.18–27; `bin/restore-overlays.sh` l.7–10). There is no installable module and no stable import root on any host other than a checkout / extraction of the bundle.
- The r3 tree has **not** been transferred to any host (PM2-OVERLAY-UNKNOWN-01 §16.3 (h)). A verifier that imported r3 modules would therefore not run on the staging host without first transferring r3 — a transfer that is NOT authorized and that this task must not presuppose.

### 2.2 Candidate-by-candidate verdict

| Candidate (r3 path / lines) | What it does | Suitability for this verifier | Verdict |
|---|---|---|---|
| `CliPm2._pm2_env` / `dump_env_dual` (`overlay_restore.py` l.275–305) | `subprocess.check_output([pm2_bin, "jlist"], text=True, timeout=20)` **without `env=`** (inherits the operator's full environment); parses the list; fail-closed `BASELINE_APP_MISSING` / `BASELINE_APP_DUPLICATE` / `BASELINE_READ_FAILED`; returns `(top, nested)` with `nested = {}` when `env` is absent | It is a PM2 **client** invocation: per POLICY §5.6 it opens `rpc.sock`, auto-reconnects with backoff, has no request timeout inside the PM2 client, and may auto-launch a daemon from the client's environment when no daemon answers (whether `jlist` reaches `Client.start` was **not separately traced**). Its `timeout=20` bounds only the child's wall-clock, not the daemon-side effect. It is also gated in r3 by `require_explicit_live_authorization` only at the CLI entry points (`orchestrate.py`, `reconcile.py`, `capture.py`), not inside `CliPm2` itself | **NOT REUSED. No adapter.** The verifier contains no PM2 client (§3). The parsing rules (list; item `name`; `pm2_env` mapping; nested `env` mapping) are **re-specified** in §4.3 by reference to these lines and reimplemented, not imported |
| `compare_restore_dual` / `compare_restore` / `_state_of` / `env_state` (`overlay_restore.py` l.340–426, l.540–548) | Compares vault **metadata** entries (`{state, secret, value|protected_file}`) against `top` and `nested`; one expectation for both fields; embeds the HMAC ABSENT→EMPTY policy exception (`hmac_absent_empty_authorized`, `"ABSENT_PENDING_AUTH"`); for `secret` SET compares **presence only** (not value/token); `_state_of(None)` and `env_state` classify JSON `null` and a missing key both as `ABSENT`; emits `"expected": "?"` fallback for divergent keys | (a) The reference format is the vault metadata format, not an explicitly supplied B(H) with per-field expectations and presence tokens (POLICY §3.4 item 2); (b) it encodes restore **policy** (HMAC exception) that a comparison-only verifier must not apply; (c) secret SET matching by presence alone cannot detect a changed secret; (d) `null` is silently coerced into ABSENT, which the registered scope forbids; (e) it requires an authorization flag argument that has no meaning for comparison | **NOT REUSED.** The comparison core is a new pure function set (§5) with an exhaustive truth-table test (§8). The DIVERGENT rule (state differs, or both SET with different value/token) is **adopted by specification** from PM2-OVERLAY-UNKNOWN-01 §4.8, not by import |
| `vault.PROTECTED_NAMES` (`vault.py` l.30–39), `secret_io.SECRET_ENV_NAMES` / `SECRET_KEY_FRAGMENTS` / `is_secret_name` (`secret_io.py` l.12–63) | `PROTECTED_NAMES = frozenset({...})` — a `frozenset(...)` **call** whose single positional argument is a set display of **6** string constants; `SECRET_ENV_NAMES = frozenset({...})` — same form, **10** names (the 6 above plus `PASSWORD`, `SECRET`, `TOKEN`, `AUTHORIZATION`); `SECRET_KEY_FRAGMENTS = (...)` — a tuple display of **10** lowercase string constants | Correct source of the always-protected name policy; importing it would drag the bundle import root onto the host (§2.1) | **COPIED BY VALUE** into the verifier as `ALWAYS_PROTECTED_NAMES` (6) and `PROTECTED_NAME_FRAGMENTS` (10) (§4.6), with a static AST parity test that recognizes the exact constructor shape and literal-evaluates only its literal argument (never `eval`, `exec`, or import of r3) and fails if either drifts (§8 T9) |
| `secret_io.secure_create_file` (`secret_io.py` l.145–168) | `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW`, mode `0600`, verify mode or remove | Correct pattern for the verifier's two optional output files | **RE-IMPLEMENTED** minimally (same flags and mode; refuse to overwrite; remove on failure). Not imported |
| `bin/verify-transfer.py`, `bin/write-transfer-manifest.py`, `TRANSFER.manifest`, `REVIEW-SHA256.txt` | Bundle-specific manifests (`helpers=36`, CRLF, header conventions) | Bundle-only; extending them changes r3 bytes and the locked workflow gate `TRANSFER_VERIFY_OK helpers=36` | **NOT REUSED.** The verifier ships its own `SHA256SUMS` in `sha256sum` format (§7.3) |
| `tests/test_operator_bundle.py` `FakePm2Dual`, `MemoryPm2`, `bin/mock-pm2.py` | Fakes of a PM2 adapter / CLI | The verifier has no adapter to fake. `mock-pm2.py jlist` output shape (`[{"name", "pm2_env": {…, "env": {…}}}]`, l.92–99) documents the assumed jlist shape | **NOT REUSED.** Test fixtures are literal JSON documents of that shape (§8) |
| `.github/workflows/pm2-overlay-unknown-verify.yml` | Fake-only runner: pinned actions, RUNNER_TEMP isolation, PATH tripwires, static isolation scans, manifest gate, single-module unittest with AST-count gate, bytes-unchanged gate, bounded artifact | Its gates are bundle-specific (BUNDLE root, `helpers=36`, W1–W5 list, `tests.test_operator_bundle`, `ALLOWED_SKIPS`, `REQUIRED` groups) and the file is a locked predecessor's hotfile / evidence workflow | **PATTERN REUSED, FILE NOT EDITED.** A new, smaller workflow copies the isolation pattern (§8.3) for a concrete need: the existing job cannot run a second test module or verify a second tree without editing the locked evidence workflow and its numeric gates |

### 2.3 Assumed `pm2 jlist` shape and its limit

The verifier parses the shape that r3 `CliPm2._pm2_env` (l.276–295) and `bin/mock-pm2.py jlist` (l.92–99) assume: a JSON **array** of process objects each carrying a string `name` and an object `pm2_env`, whose top-level string members are the environment of the last spawn and whose `env` member is an object holding the daemon's declared environment. **This shape has never been validated against a live daemon by this repository's evidence** (PM2-OVERLAY-UNKNOWN-01 §15.3 (a)); the r3 K4 runs exercised fakes only. The verifier therefore treats every deviation as `INVALID_INPUT` (§4.9) rather than guessing, and this is recorded as an evidence limit for Step 4 (§9.3).

---

## 3. Architecture and PM2 boundary (FROZEN)

### 3.1 Decision: offline comparison core; no observation adapter

```
[ACQUISITION — OUT OF SCOPE; separately authorized prerequisite (§3.4)]
    pm2 jlist > <raw-jlist.json>  (mode 0600)   +   operator-written observation-meta.json
                    │
                    ▼
[NORMALIZATION — IN SCOPE; pure; no PM2; reads the raw file read-only]
    raw jlist JSON + observation meta + reference (key list / protected flags)
        → normalized observation (states; non-protected values; protected TOKENS only)
                    │
                    ▼
[COMPARISON — IN SCOPE; pure]
    reference × normalized observation → per field / per key / per app / aggregate result
                    │
                    ▼
[REPORT — IN SCOPE; redacted; publishable class (§6.4)]
    JSON report (stdout and optional 0600 file) + one summary line (stderr) + exit code
[NORMALIZED OBSERVATION — IN SCOPE; RESTRICTED class (§6.4); optional 0600 file only]
```

The verifier is one stdlib-only Python module (`compare_dual_env.py`, §7.1) exposing pure functions and a CLI. It **never** spawns a process, opens a socket, imports `subprocess`, reads a vault / journal / marker, or writes anything except its two optional output files. Two CLI modes exist (§4.10): **Mode A** (reference + observation-meta + raw jlist) and **Mode B** (reference + normalized observation). Neither mode authenticates the host, the daemon, the operator, or the capture time (§4.8).

### 3.2 Justification (smallest design meeting the registered scope)

1. **Scope boundary 5** requires PM2 access to be designed so that connect / reconnect / auto-launch are prevented or bounded. The only design in which they are *prevented* by the verifier is one in which the verifier contains no PM2 client. Any "bounded adapter" would spawn `pm2 jlist` and inherit every §5.6 effect: connection to `rpc.sock`, client auto-reconnect with backoff and no request timeout, and possible daemon auto-launch from the client's environment when no daemon answers.
2. **The pre-check race is real and cannot be closed by a pre-check.** A daemon / socket pre-check (`pm2 ping`, `pm2 pid`, a socket probe) is itself a PM2 client invocation or a custom transport. `pm2 ping` reaches the same `Client` path and can itself trigger `Client.start` when `pingDaemon` fails (POLICY §5.6 row "Daemon auto-launch"). Between any pre-check and the subsequent `jlist`, the daemon may stop, restart, or be replaced; the later client will reconnect or auto-launch regardless of what the pre-check saw. A socket-level probe that avoids the PM2 client would be a custom PM2 transport, which the registered scope prohibits. Therefore no in-verifier design can honestly be described as bounding the race, and this freeze does not describe one.
3. **Manual acquisition already exists as the POLICY §5.3 step 2 procedure** ("one `pm2 jlist` read per app set … or its manual equivalent"). Redirecting that read to a 0600 file adds no PM2 effect beyond the read itself and moves every side effect into a procedure that must carry its own P4 / P5 attestations and E2 host-ledger entry — exactly where POLICY §4.4 puts them.
4. **Everything that POLICY §5.5 wanted from a dedicated verifier remains in scope**: code-enforced redaction, deterministic SET / EMPTY / ABSENT classification, machine-checkable DIVERGENT, and a repeatable record — none of which requires the verifier to talk to PM2.
5. **Smaller write set.** Standalone tool, six new implementation files, zero modifications to existing tracked implementation / bundle / workflow files, no r4 archive (§7; governance mirrors are the control plane's separate writes, §7.1b).

### 3.3 Explicitly rejected alternatives

| Alternative | Why rejected |
|---|---|
| Comparison plus a tightly bounded `pm2 jlist` adapter (reuse of `CliPm2.dump_env_dual` or a copy) | Inherits §5.6 effects; cannot bound the auto-launch / reconnect race (§3.2 item 2); would require `PM2_HOME` / `HOME` selection logic and a live-authorization gate inside this task; would make the fake-only suite test a fake adapter rather than the live risk; would either import r3 (not on the host) or duplicate `CliPm2` |
| Socket-level daemon probe without the PM2 client | Custom PM2 transport — prohibited by the registered scope |
| Vault → reference converter (`metadata.json` + `protected/*.value` → reference document) | A2 is OPEN: providing a converter for one candidate source would pre-select baseline provenance in code; it would also read protected recovery values. A reference document is an **explicitly supplied input** to this verifier; how it is authored is an A2 matter outside this task |
| Integrating the verifier into the r3 bundle (r4) | Changes `TRANSFER.manifest` (36 → 37+ helpers), `REVIEW-SHA256.txt`, `OPERATOR-BUNDLE.md`, the locked workflow's `helpers=36` gate, and requires a new archive; r3 is LOCKED and NOT APPROVED FOR LIVE USE — a verifier should not be coupled to a bundle it must not presuppose is present |
| Extending `.github/workflows/pm2-overlay-unknown-verify.yml` with a second job | Edits a locked predecessor's evidence workflow (hotfile of PM2-OVERLAY-UNKNOWN-01); its numeric gates are bundle-specific |

### 3.4 Acquisition prerequisite (identified, NOT registered, NOT authorized here)

Before this verifier can produce a P6 comparison for a real host, a **separately authorized** acquisition step must exist. This freeze identifies what it must be; it does not register it, name a task ID for it, or authorize it.

- **What it produces:** (i) a raw `pm2 jlist` JSON file created with mode `0600` under the operator user, never copied off-host, never committed, never pasted; (ii) an observation-meta JSON (§4.2) written by the operator, including the raw file's SHA-256, `captured_at`, `captured_by`, host, and the daemon identity it observed.
- **What it must acknowledge (POLICY §5.6):** the read is a PM2 client invocation: it connects to `rpc.sock`, may auto-reconnect, has no request timeout in the PM2 client, and may auto-launch a daemon from the client's environment if no daemon answers. It is a process P5 must account for and an E2 host-ledger entry. It is **not** side-effect-free.
- **What it must carry:** P4 and P5 attestations valid for the read (POLICY §5.1, §5.2), E1 vault registry / E2 host ledger entries (POLICY §4.4), and the STAGING / PM2 authorizations that this task does not hold.
- **What this verifier can and cannot check about it:** in Mode A it can bind the meta to the exact raw bytes (`jlist_sha256` verified over the same bytes it parses) and compare declared identity / time fields against the reference (§4.8); in Mode B the raw-file hash is **declared, not verified** (§4.10). In neither mode can it verify that `captured_at`, `daemon_pid`, `pm2_home`, `captured_by`, or the host name are truthful, that P4 / P5 held, or that the daemon did not restart between the read and the evaluation. The report states this (§5.4 `non_claims.acquisition_side_effect_free=false`, `non_claims.observation_authenticated=false`, `observation.jlist_hash_verified`).

---

## 4. Exact input contract (FROZEN)

### 4.0 Common rules for every JSON input

- Inputs are opened `O_RDONLY|O_NOFOLLOW`; a missing file, directory, symlink, permission failure, or any other `OSError` on open / read → `INPUT_UNREADABLE` (exit 2; never `INTERNAL_ERROR`). The error names the input **role** (`reference`, `observation-meta`, `jlist`, `observation`) and fixed text only; the OS error string and the path are never echoed.
- Bytes are read **once**; the SHA-256 (where required) is computed over exactly those bytes, and exactly those bytes are then decoded and parsed. No second open.
- UTF-8 (strict decode; BOM refused) → else `INPUT_NOT_UTF8` (byte offset only).
- Parsed with an `object_pairs_hook` that refuses duplicate member names at any depth → `DUPLICATE_JSON_KEY`. This applies to every input including the raw jlist. The error carries the input role only (`path` = `""`); the duplicated member name is **never** echoed (in the raw jlist it may be an environment variable name of an unrelated process).
- **Strict-schema scope.** `UNKNOWN_FIELD` (unknown member at any object level) applies **only to verifier-owned schemas**: the reference (§4.1), the observation meta (§4.2), the normalized observation (§4.5), and every nested object those schemas define. It does **not** apply to the raw `pm2 jlist` document, which is PM2-owned and carries arbitrary process metadata and unrelated environment members (§4.3). Within verifier-owned schemas, strictness is what prevents an input from smuggling an `"approved": true` member: it is refused, not ignored.
- Required members missing → `MISSING_FIELD`; wrong JSON type → `WRONG_TYPE`. `null` is never accepted where a value is required.
- Timestamps: exactly `YYYY-MM-DDTHH:MM:SSZ` (UTC, no offset, no fraction) → else `TIMESTAMP_FORMAT`.
- Identifiers (`reference_id`, `observation_id`): `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Host: `^[A-Za-z0-9][A-Za-z0-9.-]{0,253}$`. App names: `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Key names: `^[A-Za-z_][A-Za-z0-9_]{0,255}$`; the key name `env` is reserved → `RESERVED_KEY_NAME`. Violations → `IDENTIFIER_FORMAT`.
- Tokens: `^sha256:[0-9a-f]{64}$` → else `TOKEN_FORMAT`.
- Maximum input size per file: 16 MiB → `INPUT_TOO_LARGE` (raw `pm2 jlist` for two apps is far smaller; this bounds memory and hashing).
- **Echo boundary (applies to every report, error record, summary line, and `INTERNAL_ERROR` line).** The verifier may reproduce from its inputs and invocation **only**: (i) *approved identifier fields* that have already passed their format rule — `reference_id`, `observation_id`, `host`, `daemon_pid`, timestamps, `jlist_sha256`, `provenance.source_kind` (enum), app names and key names **declared in the reference**; (ii) non-protected observed / expected `value` strings of SET keys named in the reference (§5.4; display-truncated); (iii) fixed diagnostic text chosen from a frozen table in F1. It **never** reproduces: free-text metadata (`declared_by`, `source`, `authorization_record`, `captured_by`, `acquisition_record`), `pm2_home` (a filesystem path), any member name that is not a schema-defined name or a validated reference-declared app / key name, any filesystem path (input or output), any CLI argument value, any raw text or byte from a document, any OS / JSON-decoder / exception message. Full provenance remains in the input records (§6.4 class C) for separate human review.
- **JSON pointer (`errors[].path`) vocabulary.** Segments may be: schema-defined member names; array indices; app / key names that appear in the reference **and** passed `IDENTIFIER_FORMAT`. Any other segment is replaced by the fixed placeholder `<unknown-member>` (for `UNKNOWN_FIELD`) or `<invalid-identifier>` (for a reference-declared name that failed its format rule). For the raw jlist, pointers stop at the element index (e.g. `/3`) or at a schema-defined member (`/3/pm2_env`, `/3/pm2_env/env`) followed at most by a reference-declared key name.
- **CLI parsing.** F1 does **not** use `argparse` (its default error path repeats supplied argument text). A minimal hand-rolled parser accepts exactly the flags in §4.10; any unknown flag, duplicate flag, missing value, non-integer or negative `--max-age-seconds`, or invalid mode combination → `USAGE` whose fixed detail names only the **frozen flag name** concerned (e.g. `--max-age-seconds must be a non-negative integer`), never the supplied text. `--help` prints a fixed text and exits 2 without reading any input. Output paths are never echoed; `OUTPUT_EXISTS` / `OUTPUT_WRITE_FAILED` name the output role (`report-output`, `observation-output`) only.

### 4.1 Reference document — `aisb.pm2-dual-env-reference.v1`

```json
{
  "schema": "aisb.pm2-dual-env-reference.v1",
  "reference_id": "<id>",
  "host": "<host>",
  "pm2_home": "<string, optional>",
  "daemon_pid": <positive integer, optional>,
  "valid_from": "<timestamp, optional>",
  "valid_until": "<timestamp, optional>",
  "provenance": {
    "declared_by": "<non-empty string>",
    "source_kind": "INTENT_DECLARATION" | "OBSERVATION_ADOPTED_BY_DECISION" | "OTHER",
    "source": "<non-empty string>",
    "declared_at": "<timestamp>",
    "authorization_record": "<non-empty string>"
  },
  "apps": {
    "<app>": {
      "keys": {
        "<KEY>": {
          "protected": true | false,
          "pm2_env":     { "state": "SET" | "EMPTY" | "ABSENT", "value": "<string>" | "token": "sha256:<hex>" },
          "pm2_env.env": { "state": "SET" | "EMPTY" | "ABSENT", "value": "<string>" | "token": "sha256:<hex>" }
        }
      }
    }
  }
}
```

Rules:

- `apps` non-empty (`NO_APPS`); each app's `keys` non-empty (`NO_KEYS`). Duplicate names are impossible after §4.0 but are checked case-sensitively as written.
- `protected` is **required** per key; there is no default (`MISSING_FIELD`).
- If the key name is in `ALWAYS_PROTECTED_NAMES` or matches `PROTECTED_NAME_FRAGMENTS` (§4.6) and `protected` is `false` → `PROTECTED_NAME_DECLARED_UNPROTECTED`.
- Field expectation shape (identical rule for both fields; the same rule governs the normalized observation §4.5 under the code `OBSERVATION_FIELD_SHAPE`):
  - `state=SET`, `protected=false` → exactly the member `value`, a **non-empty** string; no `token`.
  - `state=SET`, `protected=true` → exactly the member `token`, matching the token format; no `value`.
  - `state=EMPTY` or `state=ABSENT` → **neither** `value` nor `token` may be present (a payload on an EMPTY / ABSENT field is refused, not ignored).
  - Any other combination (empty `value`, both members, wrong member for the protection flag, `null`) → `EXPECTATION_SHAPE`. A `value` member on a protected key is additionally reported as `PROTECTED_VALUE_IN_REFERENCE`; the value is **not** echoed anywhere.
- Both field expectations of one key must be identical (state and value / token) → else `REFERENCE_FIELDS_INCONSISTENT`. Rationale: a reference that *intends* `pm2_env[k] ≠ pm2_env.env[k]` describes a latent overlay, not a clean base (PM2-OVERLAY-UNKNOWN-01 §4.8); the schema keeps both fields explicit (POLICY §3.4 item 2) and the verifier refuses inconsistency rather than inferring intent.
- `valid_from` ≤ `valid_until` when both present → else `VALIDITY_WINDOW_INVERTED`.
- The `provenance` block is checked for **shape only** and is **not copied** into the report. The report carries `reference.provenance_source_kind` (the validated enum) and `reference.authority = "NOT_EVALUATED_BY_VERIFIER"` unconditionally; the free-text members (`declared_by`, `source`, `authorization_record`) remain in the reference file for separate review (§6.4). No member of any input can make the verifier assert that the reference is approved, authoritative, or B(H). A1 / A2 remain OPEN; this task selects no source and no values.
- `pm2_home` is a filesystem path: it is compared (§4.8) but never echoed; the report carries only `pm2_home_declared` / `pm2_home_checked` booleans.

### 4.2 Observation meta — `aisb.pm2-dual-env-observation-meta.v1`

```json
{
  "schema": "aisb.pm2-dual-env-observation-meta.v1",
  "observation_id": "<id>",
  "host": "<host>",
  "pm2_home": "<string, optional>",
  "daemon_pid": <positive integer, optional>,
  "captured_at": "<timestamp>",
  "captured_by": "<non-empty string>",
  "acquisition_record": "<non-empty string; E2 host-ledger reference>",
  "jlist_sha256": "<64 lowercase hex>"
}
```

`jlist_sha256` is **required** and (Mode A) must equal the SHA-256 of the raw jlist bytes **as read by this invocation** — the same byte string that is then decoded and parsed → else `JLIST_HASH_MISMATCH`. This binds the operator's declaration to the exact bytes compared. `captured_by` and `acquisition_record` are validated as non-empty strings (≤ 1024 characters → else `WRONG_TYPE`) and are never echoed; the report records `provenance_fields_present=true` only.

### 4.3 Raw `pm2 jlist` input (read-only; protected material; PM2-owned shape)

Parsed per the r3 `CliPm2._pm2_env` shape (§2.3). The raw jlist is **not** a verifier-owned schema: `UNKNOWN_FIELD` does not apply to it. Process objects may carry any PM2 metadata (`pid`, `pm_id`, `monit`, `pm2_env.status`, `pm2_env.pm_cwd`, …) and `pm2_env` / `pm2_env.env` may carry any number of environment members unrelated to the reference. Unrelated members are **not read for comparison, not classified, not tokenized, not type-checked, and not reported**.

Structural checks applied to **every** element of the array (they establish which element is which app and therefore cannot be skipped for any element):

| Condition | Code |
|---|---|
| top level is not an array | `JLIST_NOT_LIST` |
| an element is not an object | `JLIST_ITEM_NOT_OBJECT` |
| an element has no member `name`, or `name` is not a string | `JLIST_ITEM_NAME_MISSING` |
| a reference app name equals the `name` of 0 elements | `APP_MISSING` |
| a reference app name equals the `name` of >1 elements | `APP_DUPLICATE` |

The string-`name` rule is required for every element because an element without a string `name` cannot be shown **not** to be a reference app; such an element is therefore **rejected**, not ignored. Elements whose string `name` is not a reference app name are **unrelated** processes: they are skipped, and neither their `name` nor any of their members is read further or echoed (pointers for their errors stop at the array index). Matching is exact, case-sensitive string equality.

Structural checks applied **only to the selected elements** (those whose `name` equals a reference app):

| Condition | Code |
|---|---|
| `pm2_env` missing or not an object | `PM2_ENV_NOT_OBJECT` |
| `pm2_env.env` missing or not an object | `NESTED_ENV_NOT_OBJECT` |
| a **reference-named** key is present with a non-string / `null` value in either field | §4.4 `NULL_VALUE` / `NON_STRING_VALUE` |

Within a selected element, only the reference-named keys of `pm2_env` and of `pm2_env.env` are read (by exact member lookup). No other member is touched.

### 4.4 Field-state classification (per named key, per field)

| Observed JSON member for `<KEY>` | Classification |
|---|---|
| member absent | `ABSENT` |
| string `""` | `EMPTY` |
| non-empty string | `SET` (value for non-protected keys; `sha256:` token for protected keys) |
| JSON `null` | `INVALID_INPUT` — `NULL_VALUE` (never coerced to ABSENT; deviation from r3 `_state_of`, recorded in §2.2) |
| number / boolean / object / array | `INVALID_INPUT` — `NON_STRING_VALUE` |

Missing, null, empty, and absent are therefore four distinct inputs mapped to two states plus two refusals; none is silently merged.

### 4.5 Normalized observation — `aisb.pm2-dual-env-observation.v1` (RESTRICTED output class; Mode B input)

Produced by normalization (§3.1; `--emit-observation`, Mode A only) and accepted as the observation input in Mode B (`--observation`; for off-host re-evaluation of a redacted record and for tests). It embeds every observation-meta member, so Mode B has **no separate meta file** and no second cross-check surface:

```json
{
  "schema": "aisb.pm2-dual-env-observation.v1",
  "observation_id": "<id>", "host": "<host>", "pm2_home": "<optional>", "daemon_pid": <optional>,
  "captured_at": "<timestamp>", "captured_by": "<string>", "acquisition_record": "<string>",
  "jlist_sha256": "<hex>", "normalized_at": "<timestamp>", "reference_id": "<id of the reference whose key list / protected flags governed normalization>",
  "apps": { "<app>": { "keys": { "<KEY>": {
      "protected": true | false,
      "pm2_env":     { "state": "...", "value": "..." | "token": "sha256:..." },
      "pm2_env.env": { "state": "...", "value": "..." | "token": "sha256:..." } } } } }
}
```

Mode B applies **every** check that Mode A applies after normalization, plus its own shape checks; normalized input cannot bypass any of them:

- strict schema (§4.0 `UNKNOWN_FIELD` / `MISSING_FIELD` / `WRONG_TYPE`), identifier / timestamp / hex / token formats;
- `normalized_at` ≥ `captured_at` → else `OBSERVATION_TIMESTAMPS_INCONSISTENT`;
- `reference_id` must equal the supplied reference's `reference_id` → else `OBSERVATION_REFERENCE_ID_MISMATCH`; app / key sets must equal the reference's exactly → else `OBSERVATION_KEYSET_MISMATCH`; every key's `protected` flag must equal the reference's → else `PROTECTED_FLAG_MISMATCH`;
- **protected-name rule** re-applied independently of the reference: a key in `ALWAYS_PROTECTED_NAMES` / matching `PROTECTED_NAME_FRAGMENTS` with `protected=false` → `PROTECTED_NAME_DECLARED_UNPROTECTED`;
- **field shape** per §4.1 (SET non-protected → non-empty `value` only; SET protected → well-formed `token` only; EMPTY / ABSENT → no payload) → else `OBSERVATION_FIELD_SHAPE`; a `value` member on a protected key → additionally `PROTECTED_VALUE_IN_OBSERVATION` (never echoed);
- identity and freshness (§4.8) exactly as in Mode A, using the embedded `host`, `pm2_home`, `daemon_pid`, `captured_at`.

In Mode B `jlist_sha256` is **declared, not verified** (no raw bytes are present). The report states `observation.source="NORMALIZED"` and `observation.jlist_hash_verified=false`; in Mode A it states `"RAW_JLIST"` / `true`. Mode B compares a record that was normalized earlier; it cannot detect a normalized record that was edited after emission, and it does not authenticate host, daemon, operator, or capture time any more than Mode A does.

### 4.6 Protected keys and tokens

- `ALWAYS_PROTECTED_NAMES` = `frozenset({"HARNESS_ENTITLEMENT_HMAC_SECRET", "AISB_01C6A_HMAC_SECRET", "XAI_API_KEY", "AISB_01C6A_API_KEY_TOKEN", "DATABASE_URL", "REDIS_URL"})` — **6** names, equal by value to r3 `vault.PROTECTED_NAMES`. `PROTECTED_NAME_FRAGMENTS` = `("secret", "password", "token", "authorization", "api_key", "apikey", "database_url", "redis_url", "hmac", "bearer")` — **10** fragments, equal by value to r3 `secret_io.SECRET_KEY_FRAGMENTS`, matched as substrings of the lowercased key name. `is_protected_name(k)` ⇔ `k ∈ ALWAYS_PROTECTED_NAMES or any(f in k.lower() for f in PROTECTED_NAME_FRAGMENTS)`. The four generic names in r3 `secret_io.SECRET_ENV_NAMES` that are not in `PROTECTED_NAMES` (`PASSWORD`, `SECRET`, `TOKEN`, `AUTHORIZATION`; 10 − 6) are covered by the fragments and are asserted protected by T9 rather than copied as a third constant. Parity with r3 is tested statically (§8 T9).
- **Token** = `"sha256:" + hex(SHA-256(UTF-8 bytes of the value))`. Tokens are **needed**: they are the only way to compare a SET secret by value without the value, and POLICY §3.4 item 2 already fixes this form for B(H).
- **What a token reveals (qualified; not "anonymous", not unconditionally "non-reversible"):** it is an **equality oracle** — anyone holding the token can confirm a guessed value, and for low-entropy values (short flags, dictionary words, predictable formats) it is **reversible by enumeration**. It is unsalted by design (salting would prevent comparison across independently authored reference and observation). A token of a high-entropy secret is not practically invertible, but it still identifies that secret across records and time. Tokens are therefore **RESTRICTED** material: permitted in the reference document, the normalized observation file (mode 0600, operator ledger), and — per the existing POLICY §3.4 item 2 convention — in governance evidence where Keith so decides; **never** in stdout / stderr, the comparison report, test logs, workflow artifacts, chat, or Git by default (§6.3).
- The verifier never computes a token for any key not named in the reference, and never stores or prints a protected raw value in any form.

### 4.7 Syntactic validity vs comparison result vs external approval

| Layer | Who establishes it | Where it appears |
|---|---|---|
| Syntactic / structural validity of the inputs (three in Mode A, two in Mode B) | the verifier (§4.0–§4.5, §4.9, §4.10) | `result=INVALID_INPUT` + `errors[]`, or proceed |
| Comparison result | the verifier (§5) | `result ∈ {MATCH, MISMATCH, DIVERGENT}` per field / key / app / aggregate |
| Authority of the reference (is it B(H)? was its provenance approved? A1 / A2) | **Keith / control plane only**, outside this tool | `reference.authority = "NOT_EVALUATED_BY_VERIFIER"` (constant); `reference.provenance_source_kind` (enum only); free-text provenance stays in the reference file |

### 4.8 Identity and freshness checks (performed after syntax, before comparison; identical in Mode A and Mode B)

| Check | Code on failure |
|---|---|
| `reference.host == observation.host` | `HOST_MISMATCH` |
| reference declares `pm2_home` and observation does **not** | `PM2_HOME_MISSING_IN_OBSERVATION` |
| both declare `pm2_home` and they differ (byte equality; never echoed) | `PM2_HOME_MISMATCH` |
| reference declares `daemon_pid` and observation does **not** | `DAEMON_PID_MISSING_IN_OBSERVATION` |
| both declare `daemon_pid` and they differ | `DAEMON_PID_MISMATCH` |
| observation declares `pm2_home` / `daemon_pid` and the reference does not | no error; report `pm2_home_checked=false` / `daemon_pid_checked=false` |
| `captured_at` within `[valid_from, valid_until]` when declared | `OBSERVATION_OUTSIDE_REFERENCE_VALIDITY` |
| `captured_at > evaluated_at + 300 s` (fixed skew tolerance; **always** applied, with or without `--max-age-seconds`) | `OBSERVATION_IN_FUTURE` |
| `--max-age-seconds N` given and `evaluated_at − captured_at > N` | `OBSERVATION_STALE` |
| Mode B: `normalized_at ≥ captured_at`; `reference_id` / key set / protected flags (§4.5) | as listed in §4.5 |

Absence of an observation field that the reference specifies is a failure, never a bypass. Identity or freshness failure is `INVALID_INPUT` (exit 2) with the specific code; no comparison is emitted. **What these checks do not do (stated in the report):** they compare *declared* strings and integers; they do **not** authenticate the host, the daemon (`daemon_pid` may be stale or fabricated), the operator, or the capture time. `captured_at` is operator-declared; `evaluated_at` comes from the evaluating host's clock; the tool cannot detect a daemon restart, deploy, `pm2 save` / `update` / `resurrect`, or `--update-env` between acquisition and evaluation; a comparison is point-in-time (PM2-FENCE-01 §4 as carried in POLICY §5.3). The POLICY §5.3 step 5 dwell-and-repeat is a **procedure**: two separate acquisitions and two verifier invocations; the verifier compares one observation per invocation and does not implement dwell.

### 4.9 Fail-closed code table (complete list; every code → `result=INVALID_INPUT`, exit 2)

Invocation / output: `USAGE`, `OUTPUT_EXISTS`, `OUTPUT_WRITE_FAILED`.
Reading / decoding: `INPUT_UNREADABLE`, `INPUT_TOO_LARGE`, `INPUT_NOT_UTF8`, `JSON_SYNTAX` (line / column / offset only; no content), `DUPLICATE_JSON_KEY` (role only; no member name).
Verifier-owned schemas: `UNKNOWN_FIELD`, `MISSING_FIELD`, `WRONG_TYPE`, `SCHEMA_ID_MISMATCH`, `IDENTIFIER_FORMAT`, `TIMESTAMP_FORMAT`, `TOKEN_FORMAT`, `VALIDITY_WINDOW_INVERTED`, `NO_APPS`, `NO_KEYS`, `RESERVED_KEY_NAME`, `EXPECTATION_SHAPE`, `PROTECTED_VALUE_IN_REFERENCE`, `PROTECTED_NAME_DECLARED_UNPROTECTED`, `REFERENCE_FIELDS_INCONSISTENT`.
Raw jlist (Mode A): `JLIST_HASH_MISMATCH`, `JLIST_NOT_LIST`, `JLIST_ITEM_NOT_OBJECT`, `JLIST_ITEM_NAME_MISSING`, `APP_MISSING`, `APP_DUPLICATE`, `PM2_ENV_NOT_OBJECT`, `NESTED_ENV_NOT_OBJECT`, `NULL_VALUE`, `NON_STRING_VALUE`.
Normalized observation (Mode B): `OBSERVATION_REFERENCE_ID_MISMATCH`, `OBSERVATION_KEYSET_MISMATCH`, `PROTECTED_FLAG_MISMATCH`, `OBSERVATION_FIELD_SHAPE`, `PROTECTED_VALUE_IN_OBSERVATION`, `OBSERVATION_TIMESTAMPS_INCONSISTENT`.
Identity / freshness: `HOST_MISMATCH`, `PM2_HOME_MISSING_IN_OBSERVATION`, `PM2_HOME_MISMATCH`, `DAEMON_PID_MISSING_IN_OBSERVATION`, `DAEMON_PID_MISMATCH`, `OBSERVATION_OUTSIDE_REFERENCE_VALIDITY`, `OBSERVATION_IN_FUTURE`, `OBSERVATION_STALE`.

Each error record is `{ "code", "path" (JSON pointer under the §4.0 vocabulary), "detail" (fixed text from the frozen table; may include reference-declared app / key names that passed validation; never values, tokens, free-text metadata, paths, argument text, or decoder messages) }`. Truncated or corrupt input surfaces as `JSON_SYNTAX` / `INPUT_NOT_UTF8` / `JLIST_HASH_MISMATCH`; incomplete references surface as `MISSING_FIELD` / `NO_KEYS` / `EXPECTATION_SHAPE`. Validation is all-or-nothing within a stage: every detected error of the current stage is collected and reported; no partial comparison is emitted. Stages run in the order read → decode → schema → identity / freshness → (Mode A) jlist structure → classification; a failing stage stops the pipeline.

**Report when identifiers cannot be extracted.** An `INVALID_INPUT` report always contains the `reference` and `observation` blocks, but each identifier member is present only if that member was read **and** passed its format rule; otherwise it is `null` (e.g. an unreadable reference yields `"reference": { "reference_id": null, "host": null, … , "authority": "NOT_EVALUATED_BY_VERIFIER" }`). The summary line prints `reference=-` / `observation=-` for a `null` identifier. Nothing that failed validation is ever printed in place of an identifier.

### 4.10 CLI modes (exactly two; anything else is `USAGE`)

| Mode | Required flags | Optional flags | Observation source | `jlist_sha256` |
|---|---|---|---|---|
| **A** | `--reference PATH --observation-meta PATH --jlist PATH` | `--report PATH`, `--emit-observation PATH`, `--max-age-seconds N` | raw `pm2 jlist` bytes, normalized in-process | **verified** over the bytes read |
| **B** | `--reference PATH --observation PATH` | `--report PATH`, `--max-age-seconds N` | normalized observation (§4.5) | **declared only** (not verifiable) |

`--help` alone: fixed text, exit 2. Mixing `--observation` with `--observation-meta` / `--jlist` / `--emit-observation`, repeating a flag, omitting a required flag, or supplying a non-integer / negative `--max-age-seconds` → `USAGE`. Flag values (paths, numbers) are never echoed (§4.0).

**Output ordering (both modes).** (1) Parse argv. (2) Create every requested output file exclusively (`O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW`, `0600`) **before any input is read**; `OUTPUT_EXISTS` if any exists (nothing else created). Files created by this step are recorded in an in-process list. (3) Read, validate, normalize, compare. (4) Write the normalized observation (if requested), then the report file (if requested); `fsync`; close. (5) Only after step 4 has succeeded, write the report to stdout and the summary line to stderr, and return the exit code. If any step from 2 onward fails on an output operation: every file in the created-by-this-invocation list is removed (never a pre-existing file), the result becomes `INVALID_INPUT` / `OUTPUT_WRITE_FAILED` (exit 2), and no MATCH / MISMATCH / DIVERGENT report is published on stdout. A MATCH is therefore never announced before its persistent record exists.

---

## 5. Comparison and output semantics (FROZEN)

### 5.1 Per-field truth table (R = reference expectation, O = observed classification)

| R.state | O.state | Field result |
|---|---|---|
| ABSENT | ABSENT | MATCH |
| ABSENT | EMPTY / SET | MISMATCH |
| EMPTY | EMPTY | MATCH |
| EMPTY | ABSENT / SET | MISMATCH |
| SET (value v / token t) | SET, same v (non-protected) or same t (protected) | MATCH |
| SET | SET, different v / t | MISMATCH |
| SET | ABSENT / EMPTY | MISMATCH |

### 5.2 Cross-field divergence and per-key result

`DIVERGENT(k)` ⇔ `O.top.state ≠ O.nested.state`, **or** both `SET` and (`O.top.value ≠ O.nested.value` for non-protected / `O.top.token ≠ O.nested.token` for protected). Divergence is a property of the **observation alone** and is reported even when one field matches the reference.

| DIVERGENT(k) | field(top) | field(nested) | Key result |
|---|---|---|---|
| true | any | any | **DIVERGENT** |
| false | MATCH | MATCH | **MATCH** |
| false | otherwise | otherwise | **MISMATCH** |

(When not divergent both fields have the same observed state and value / token, so they yield the same field result; the row "otherwise" is MISMATCH/MISMATCH.)

### 5.3 Aggregation and exit codes

Per app: any key DIVERGENT → `DIVERGENT`; else any key MISMATCH → `MISMATCH`; else `MATCH`. Aggregate over apps: same precedence.

| Aggregate `result` | Exit code | Meaning (and only this meaning) |
|---|---|---|
| `MATCH` | **0** | every named key in every named app matched the reference on both fields at the declared capture time — **evidence only** |
| `MISMATCH` | **3** | at least one key differs from the reference; no key is divergent |
| `DIVERGENT` | **4** | at least one key differs between `pm2_env[k]` and `pm2_env.env[k]` (latent overlay indication; POLICY §5.3 step 3: P6 FAIL — never "close enough") |
| `INVALID_INPUT` | **2** | invocation, read / decode, schema, identity, freshness, observation-shape, or output-placement failure (§4.9); nothing compared or nothing published as a comparison |
| `INTERNAL_ERROR` | **1** | unexpected exception in the top-level `main` guard; a minimal fixed JSON report (§5.4) plus one stderr line, each carrying only the exception **type name** (§6.2) |

Exit 0 is chosen for MATCH so that the tool composes with `set -e` procedures, **not** as a success claim; the summary line and report say so explicitly.

### 5.4 Report schema — `aisb.pm2-dual-env-comparison-report.v1` (stdout; optional `--report PATH`; publishable class §6.4)

```json
{
  "schema": "aisb.pm2-dual-env-comparison-report.v1",
  "tool": { "name": "compare_dual_env.py", "version": "1.0.0", "self_sha256": "<SHA-256 of the running module file>" },
  "evaluated_at": "<timestamp>",
  "result": "MATCH" | "MISMATCH" | "DIVERGENT" | "INVALID_INPUT",
  "exit_code": 0 | 3 | 4 | 2,
  "mode": "A" | "B" | null,
  "reference": { "reference_id": "<id>" | null, "host": "<host>" | null, "daemon_pid": int | null, "valid_from": ts | null, "valid_until": ts | null,
                 "pm2_home_declared": bool | null, "provenance_source_kind": "<enum>" | null,
                 "authority": "NOT_EVALUATED_BY_VERIFIER" },
  "observation": { "observation_id": "<id>" | null, "host": "<host>" | null, "daemon_pid": int | null, "captured_at": ts | null,
                   "pm2_home_declared": bool | null, "provenance_fields_present": bool | null,
                   "jlist_sha256": "<hex>" | null, "source": "RAW_JLIST" | "NORMALIZED" | null, "jlist_hash_verified": bool | null },
  "identity": { "host_checked": bool, "pm2_home_checked": bool, "daemon_pid_checked": bool },
  "freshness": { "validity_window_checked": bool, "future_check_applied": true, "max_age_seconds": int | null, "age_seconds_at_evaluation": int | null,
                 "limitations": "declared fields compared, not authenticated; captured_at is operator-declared; point-in-time; daemon restart / pm2 write between capture and evaluation is undetectable by this tool" },
  "apps": { "<app>": { "result", "keys": { "<KEY>": {
      "protected": bool, "result": "MATCH" | "MISMATCH" | "DIVERGENT", "divergent": bool,
      "pm2_env":     { "expected_state", "observed_state", "field_result", "expected_value"?, "observed_value"?, "observed_value_truncated"? },
      "pm2_env.env": { … same … } } } } },
  "counts": { "apps", "keys", "match", "mismatch", "divergent" },
  "errors": [ { "code", "path", "detail" } ],
  "non_claims": { …constant block, see below… }
}
```

- **Only approved identifier fields are echoed** (§4.0 echo boundary). Not present anywhere in the report: `pm2_home` (path), `captured_by`, `acquisition_record`, `declared_by`, `source`, `authorization_record`, any input / output path, any CLI argument text. These remain in the input records for separate review (§6.4 class C).
- `expected_value` / `observed_value` appear **only** for non-protected keys with state SET; values longer than 256 characters are truncated for display with `observed_value_truncated=true` (equality is computed on the full string). For protected keys **no value and no token** appears in the report — only states and results.
- On `INVALID_INPUT`, `apps` is `{}`, `counts` are zero, and every identifier that was not read or did not pass validation is `null` (§4.9).
- **`INTERNAL_ERROR` report (stdout; same `non_claims`):** `{ "schema": "aisb.pm2-dual-env-comparison-report.v1", "tool": {…}, "result": "INTERNAL_ERROR", "exit_code": 1, "error_type": "<ExceptionClassName>", "non_claims": {…} }`. It is composed from constants plus `type(exc).__name__` only; no message, no traceback, no identifiers (they may not have been validated). It is written best-effort; if writing it fails, the process still exits 1 after the stderr line. `--report` / `--emit-observation` files created by this invocation are removed.
- **`non_claims` constant block (present in every outcome, including `INTERNAL_ERROR`):** `{ "restoration_success": false, "command_fate_known": false, "fence_proof": "NONE", "host_clean": false, "policy_satisfied": false, "permission_to_run": false, "reference_authority_verified": false, "acquisition_side_effect_free": false, "observation_authenticated": false, "note": "A MATCH is comparison evidence only." }`. No input, flag, or code path changes it. `fence_proof` is the string `"NONE"` in continuity with r3 `FENCE_PROOF_NONE`.
- Summary line (stderr): `PM2_DUAL_ENV_COMPARE result=<R> exit=<n> mode=<A|B|-> apps=<a> keys=<k> match=<m> mismatch=<x> divergent=<d> reference=<reference_id|-> observation=<observation_id|-> evidence_only=true`. For `INTERNAL_ERROR`: `PM2_DUAL_ENV_COMPARE result=INTERNAL_ERROR exit=1 type=<ExceptionClassName>`.

### 5.5 Things the output never says

Restoration succeeded; a command's fate is known; a fence exists; the host is CLEAN; a policy (P1–P8) is satisfied; a run is permitted; the reference is authoritative or approved; acquisition was side-effect-free; the host / daemon / operator / capture time were authenticated; UNKNOWN may be cleared. The tool has no flag, argument, environment variable, or input member that can produce any of those statements.

---

## 6. Protected material and redaction (FROZEN)

### 6.1 Minimum read-only inputs

Mode A: exactly three files (reference, observation meta, raw `pm2 jlist`); Mode B: exactly two (reference, normalized observation). All are opened `O_RDONLY|O_NOFOLLOW` and read once. **No** vault directory, `metadata.json`, `protected/*.value`, `overlay_commands.json`, `unknown_overlay.json`, `pending_apps.json`, `restore_result.json`, `.run.lock`, `dump.pm2`, `/opt/aisandbox/.env`, or any PM2 home file is read. The verifier writes only: the report to stdout, the summary line to stderr, and — when requested — `--report PATH` and `--emit-observation PATH`, each created exclusively (`O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW`, mode `0600`) before any input is read, refusing to overwrite (`OUTPUT_EXISTS`), and removed on any later failure **only if this invocation created them** (§4.10 output ordering). Reference files, vaults, journals, markers, and all recovery material therefore remain byte-unchanged by construction; §8 T10 verifies input bytes before / after every CLI invocation.

### 6.2 Redaction rules by path

| Path | Rule |
|---|---|
| Normal report | approved identifier fields only (§4.0 echo boundary); protected keys: states and results only; non-protected SET keys: values (display-truncated at 256); no free-text metadata, no `pm2_home`, no paths, no argument text |
| `INVALID_INPUT` errors | code + JSON pointer (§4.0 vocabulary; unknown / invalid segments replaced by placeholders) + fixed detail from the frozen table; never a member value, token, free-text metadata value, unknown member name, path, argument text, or raw text from the input |
| CLI / usage errors | fixed text naming the frozen flag concerned; the supplied argument text (including bad numbers, unknown flag spellings, and paths) is never repeated; `argparse` is not used |
| Read / open failures (`INPUT_UNREADABLE`, `OUTPUT_EXISTS`, `OUTPUT_WRITE_FAILED`) | input / output **role** + fixed text; no path, no `errno` text, no `strerror` |
| JSON syntax errors | line / column / character offset only (the tool composes the message; it never echoes the document or the decoder message) |
| UTF-8 errors | offset only (the tool composes the message; Python's default message, which includes the byte, is not used) |
| Uncaught exception (`INTERNAL_ERROR`) | one stderr line `PM2_DUAL_ENV_COMPARE result=INTERNAL_ERROR exit=1 type=<ExceptionClassName>` and the minimal stdout report of §5.4; **no** message text, **no** traceback, **no** identifiers (the module's `main` catches `BaseException` other than `SystemExit` / `KeyboardInterrupt` at the top level and never re-raises with a message) |
| Subprocess failures | not applicable — the verifier spawns nothing; the test suite spawns only `sys.executable` and asserts on its captured streams |
| Test artifacts (§8) | tests use synthetic sentinel strings with the fixed prefix `SENTINEL-NOT-A-SECRET-` **in every echo-prone position**: protected and unrelated environment values, metadata free-text values, unknown / malformed member names, fixture directory and file names, and CLI argument values; leak assertions are boolean assertions with constant messages so a failing test cannot print the sentinel or the captured stream; the workflow captures test output **privately** (direct redirection; no `tee`), scans every evidence file in full (binary included) before any truncation, publishes a cleared copy only on an explicit gate success, never uploads the raw evidence directory, and on failure uploads only fixed allowlisted diagnostics (§8.3 steps 8, 12–15) |
| `--emit-observation` file | RESTRICTED class (§6.4): contains tokens but no raw protected values and no free-text metadata beyond what the meta declared; mode 0600; operator ledger only; never uploaded, committed, or pasted |

### 6.3 Tokens — where permitted

Reference document (authored under A2 rules, outside this task); normalized observation file (0600, on host); governance evidence only where Keith so decides under the existing POLICY §3.4 item 2 convention, with the §4.6 qualification recorded alongside. Not permitted: report, stdout, stderr, unittest logs, workflow artifacts, chat, Git.

### 6.4 Output and record classes (distinct handling)

| Class | Artifacts | Contains | Handling |
|---|---|---|---|
| **A — publishable report** | stdout report, `--report` file, stderr summary / error lines | approved identifier fields, states, results, non-protected SET values, fixed diagnostics, constant `non_claims` | may be attached to a P6 record after human review; still not to be pasted into chat with non-protected values unless the operator confirms none is sensitive |
| **B — RESTRICTED normalized observation** | `--emit-observation` file | class-A content plus **tokens** and the embedded meta identifiers | 0600 on host; operator ledger only; never uploaded, committed, pasted, or included in workflow artifacts |
| **C — input records (full provenance)** | reference, observation meta, raw jlist, normalized observation used as input | free-text provenance, `pm2_home`, `captured_by`, `acquisition_record`, raw environment (jlist) | read-only to the verifier; reviewed separately by a human under the applicable ledger rules; the verifier never copies class-C free text or raw material into class A or B |

The verifier never promotes content from a lower row to a higher row.

---

## 7. Exact files and packaging (FROZEN)

### 7.1 Write set — implementation files (six new files; zero modifications to existing tracked **implementation / bundle / workflow** files)

The "six new files / zero modifications" statement describes the **implementation** write set that the Step 3 worker produces. It does not describe the control-plane governance mirrors, which are a separately authorized write set performed by the control plane, not the worker (§7.1b).

| # | Path (repo-relative) | Content | Constraints |
|---|---|---|---|
| F1 | `ops/pm2-recovery-verify/compare_dual_env.py` | the verifier: constants (§4.6), hand-rolled CLI parser (§4.0 / §4.10), strict JSON loading, schema validation, normalization, comparison, report, `main(argv) -> int` | stdlib only; imports limited to `__future__`, `dataclasses`, `datetime`, `hashlib`, `json`, `os`, `re`, `stat`, `sys`, `typing` (**no** `argparse`, `subprocess`, `socket`, `shutil`, `platform`, `pathlib`, `multiprocessing`, `ctypes`, `urllib`, `http`, `asyncio`, `importlib`, `logging`, `traceback`); Python **≥3.8 syntax** (no `match`, `except*`, PEP 604 unions at runtime, `removeprefix`, dict `|`, `zoneinfo`; `from __future__ import annotations` for annotations only); no module-level side effects other than constants; no test-only hooks, environment variables, or override flags in production code; `if __name__ == "__main__": raise SystemExit(main(sys.argv[1:]))`; LF; `#!/usr/bin/env python3` shebang; mode `100644` |
| F2 | `ops/pm2-recovery-verify/tests/test_compare_dual_env.py` | unittest module implementing §8.1 | stdlib only (`unittest`, `unittest.mock`, `json`, `hashlib`, `os`, `sys`, `io`, `contextlib`, `tempfile`, `ast`, `subprocess` for `sys.executable` spawns only, `stat`); no `tests/__init__.py` (namespace package, same as r3); imports F1 via `sys.path.insert(0, <ops/pm2-recovery-verify>)`; the forced unexpected-error case uses `unittest.mock.patch.object` on a module-level F1 function to raise `RuntimeError` while calling `main()` in-process under `contextlib.redirect_stdout` / `redirect_stderr` — a test-only mechanism; F1 has no production override |
| F3 | `ops/pm2-recovery-verify/README.md` | operator documentation: purpose, non-claims, schemas (§4), exit codes (§5.3), redaction (§6), acquisition prerequisite statement (§3.4), transfer verification (`sha256sum -c SHA256SUMS`), "NOT APPROVED FOR LIVE USE until LOCKED and until a P6 procedure is separately authorized" | LF |
| F4 | `ops/pm2-recovery-verify/SHA256SUMS` | `sha256sum` format (`<hex>  <relative path>`), LF, one entry each for F1, F2, F3, F5 (not itself) | regenerated whenever F1/F2/F3/F5 change; verified by §8 T10 and the workflow |
| F5 | `ops/pm2-recovery-verify/.gitattributes` | `* text eol=lf` | directory-scoped so the root `.gitattributes` (part of the r3 baseline record) is not edited |
| F6 | `.github/workflows/pm2-recovery-verify.yml` | fake-only verification workflow (§8.3) | `workflow_dispatch` only; `permissions: contents: read`; pinned action SHAs identical to the existing workflow (`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`, `actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97`, `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`); LF |

Forbidden to the Step 3 **worker** (default-deny restated): any byte of `ops/aisb-01c6a-operator-bundle/**`, the root `.gitattributes`, `.github/workflows/pm2-overlay-unknown-verify.yml`, any `frontend/` / `services/` file, any archive, and every governance file (the worker reports; it does not mirror).

### 7.1b Governance mirrors (separately authorized control-plane writes; not part of the implementation write set)

| When | Files (control plane only, holding GOVERNANCE) | Content |
|---|---|---|
| Step 3 end | `TASKS.md` (this task's fields), `TASKS_BACKLOG_FULL.md` (this task's body), `docs/control-plane/lane-saturation-state.json` (this candidate only, if admission / status fields change), `docs/control-plane/SATURATION_PROOF.json` (validator output only) | Step 3 WRITTEN / BEHAVIOURAL VERIFICATION NOT RUN; occupancy per control-plane decision |
| Step 4 end | the same four, plus this document §11 / §12 | run id, `VERIFIER_SHA256`, counts, lock record, evidence limits |

These mirrors are **required** by §9.1 / §9.2 and are **not** counted against "zero modifications" in §7.1: the two statements govern different actors and different file sets.

### 7.2 Dependencies and helper reuse

None beyond CPython stdlib. No r3 import. No `pip`, no vendored code. Reuse is by **value / specification only**: protected-name constants (§4.6) and the DIVERGENT rule (§5.2), each covered by a test that would fail on drift (§8 T9).

### 7.3 Packaging decisions

| Question | Decision |
|---|---|
| Standalone or bundle change? | **Standalone** under `ops/pm2-recovery-verify/`. r3 bundle untouched (40/40 bytes, both manifests, `OPERATOR-BUNDLE.md`). |
| Which manifests / documentation change? | None of r3's. New `SHA256SUMS` (F4) and `README.md` (F3) belong to the verifier. |
| New archive required? | **No.** The delivered artifact is the single file F1; transfer (when separately authorized) is by file copy verified with `sha256sum -c SHA256SUMS` (or by comparing the recorded hash). |
| Where is the hash recorded outside the artifact? | (i) `SHA256SUMS` (F4, in-tree, not inside F1); (ii) this document §9 / §11 at Step 4; (iii) the `TASKS.md` board field `PM2_RECOVERY_VERIFY_01_VERIFIER_SHA256` and the canonical body — governance evidence, following the PM2-OVERLAY-UNKNOWN-01 §16 Option A(i) convention. |
| Which exact tested bytes must match the delivered artifact? | The blob of F1 at the **Step 3 commit that the Step 4 green run checked out** (`github.sha` == `checkout_sha` gate). Its SHA-256 must equal: the F4 entry, the runner's `sha256sum` of F1, the runner-reported `self_sha256` in the report emitted during the CLI tests, and the value recorded in governance. Any later edit to F1 re-opens Step 4. |
| r3 archive and evidence | Preserved: `e4473a80…c2a2` and the K4 runs are not touched, re-hashed, or re-dispatched. |

### 7.4 Mutexes and leases (existing catalogue only)

No catalogue mutex has a `pathPrefixes` entry covering `ops/` or `.github/` (`mutex-catalog.json`: GOVERNANCE=`docs/control-plane/`, GATEWAY, AI-SERVICE, CONTAINER-MANAGER, FRONTEND, MIGRATION only). Therefore: `mutexes=[]`; `hotfiles` = `writePaths` = the six F1–F6 paths (HOTFILE is the existing mechanism for paths outside every broad mutex); `writeSetPrecision=EXACT`; `i18n=false`; `sharedContractIds=[]`; `mutatesSharedContractIds=[]`; `evidenceClass=LOCAL-TESTS` unchanged (fake-only tests on a GitHub-hosted runner are LOCAL-TESTS *kind*; not STAGING-RUNTIME; no `runtimeNeeds`); `exclusiveCapacity=false`; `admissionUncertain=true` retained (Step 3 and the runner dispatch are not authorized; admission is a later control-plane decision). GOVERNANCE, STAGING, AI-SERVICE and all other catalogue mutexes remain undeclared. `mutex-catalog.json` is not edited.

### 7.5 Windows authoring note (Step 3)

F1–F6 are authored on Windows and must be LF on disk (F5 guarantees the index / checkout form; the implementer must also write LF bytes so `SHA256SUMS` computed locally equals the runner's). The r3 `.gitattributes` root rule is not touched.

---

## 8. Verification plan (FROZEN; no execution in Step 2 or Step 3)

### 8.1 Test module F2 — required test groups

| ID | Group | What it proves (fake-only) |
|---|---|---|
| T1 | Exhaustive per-field truth table | all 7 rows of §5.1 for non-protected (value) and protected (token) keys; parametrised over `R ∈ {SET a, EMPTY, ABSENT} × O ∈ {SET a, SET b, EMPTY, ABSENT}` |
| T2 | Divergence | every combination in which top ≠ nested (state or value / token) yields key `DIVERGENT` regardless of reference; both-SET-different-tokens included; precedence DIVERGENT > MISMATCH > MATCH at key, app, and aggregate level |
| T3 | Classification | absent member → ABSENT; `""` → EMPTY; non-empty → SET; `null` → `NULL_VALUE`; number / bool / object / array → `NON_STRING_VALUE`; `env` reserved |
| T4 | Malformed / corrupt / truncated inputs | non-UTF-8, BOM, truncated JSON, duplicate JSON key (in a verifier-owned schema **and** inside an unrelated jlist process — role only, no name echoed), non-list jlist, non-object item, item without a string `name` (absent **and** non-string), `pm2_env` not object, `env` missing, unknown field in every verifier-owned object level (including `"approved": true`), missing `protected`, every §4.1 shape violation (empty `value` on SET, payload on EMPTY / ABSENT, `token` on non-protected, `value` on protected, both members), protected name declared unprotected, inconsistent reference fields, inverted validity window, oversize input, **directory / missing / symlink / unreadable input path → `INPUT_UNREADABLE`** (not `INTERNAL_ERROR`) → each yields exactly the §4.9 code, exit 2, `apps == {}`, `null` identifiers where not validated, and the summary line |
| T5 | Apps / keys / raw-jlist scope | `APP_MISSING`, `APP_DUPLICATE`, `NO_APPS`, `NO_KEYS`; **unrelated named processes** (string `name` not in the reference) are skipped and absent from the report even when they carry `pm2_env` that is not an object, no `env`, and arbitrary members; **an element without a string `name` is rejected** (`JLIST_ITEM_NAME_MISSING`), never ignored; PM2 metadata members (`pid`, `pm_id`, `monit`, `pm2_env.status`, …) and unrelated environment members in selected apps produce no `UNKNOWN_FIELD` and never appear in the report |
| T6 | Identity and freshness | `HOST_MISMATCH`; `PM2_HOME_MISMATCH` and `DAEMON_PID_MISMATCH` when both declare; `PM2_HOME_MISSING_IN_OBSERVATION` / `DAEMON_PID_MISSING_IN_OBSERVATION` when only the reference declares; `*_checked=false` when only the observation declares; `OBSERVATION_OUTSIDE_REFERENCE_VALIDITY`; `OBSERVATION_IN_FUTURE` **with and without** `--max-age-seconds`; `OBSERVATION_STALE`; `JLIST_HASH_MISMATCH` (Mode A); Mode B: `OBSERVATION_TIMESTAMPS_INCONSISTENT`, `reference_id` / keyset / protected-flag mismatches, `OBSERVATION_FIELD_SHAPE`, `PROTECTED_VALUE_IN_OBSERVATION`, `PROTECTED_NAME_DECLARED_UNPROTECTED` re-applied; Mode B report carries `jlist_hash_verified=false`, Mode A `true` |
| T7 | Redaction (CLI, `sys.executable` spawn, plus in-process) | sentinels `SENTINEL-NOT-A-SECRET-<random>` placed in **every echo-prone position**: protected key values; unrelated processes' values **and** member names; metadata free text (`declared_by`, `source`, `authorization_record`, `captured_by`, `acquisition_record`); `pm2_home`; an unknown member **name** in each verifier-owned object; a malformed jlist element; the fixture **directory name and file names**; CLI argument values (an unknown flag spelled with the sentinel, a `--max-age-seconds` value containing it, a non-existent input path containing it, an existing `--report` path containing it). For MATCH, MISMATCH, DIVERGENT, every INVALID_INPUT family, and the forced INTERNAL_ERROR (§7.1 F2 mechanism): assert the sentinel and its `sha256:` token are absent from stdout, stderr, the `--report` file, and the `INTERNAL_ERROR` line; assert `INTERNAL_ERROR` output contains only the type name; assertions are boolean with constant messages |
| T8 | Authority, non-claims, every-outcome report | `reference.authority == "NOT_EVALUATED_BY_VERIFIER"` for every provenance shape; `provenance_source_kind` is the only provenance member echoed; `non_claims` equals the frozen constant in **all five** outcomes including the in-process forced `INTERNAL_ERROR` (stdout JSON parses; `error_type` is a class name; no other members); no CLI flag alters it (unknown flags → `USAGE` with fixed text) |
| T9 | Static parity with r3 by value | `ast.parse` (read-only; no import, no `eval`, no `exec`) of `ops/aisb-01c6a-operator-bundle/lib/vault.py` and `lib/secret_io.py`; locate exactly one module-level `Assign` whose single target is `Name("PROTECTED_NAMES")` and require its value to be `Call(func=Name("frozenset"), args=[<ast.Set of str Constant>], keywords=[])`; `ast.literal_eval` **only that set argument** → equals `ALWAYS_PROTECTED_NAMES` (6); same for `SECRET_ENV_NAMES` → 10 names, each asserted `is_protected_name(...) == True`; locate `Assign` target `Name("SECRET_KEY_FRAGMENTS")` with value an `ast.Tuple` of str Constants; `ast.literal_eval` the tuple → equals `PROTECTED_NAME_FRAGMENTS` (10, order-sensitive); any other node shape fails the test (no fallback) |
| T10 | Bytes and outputs | SHA-256 of reference / meta / jlist / normalized fixtures unchanged after every CLI run; `SHA256SUMS` entries equal the actual hashes of F1, F2, F3, F5; output files are mode `0600` (POSIX); `OUTPUT_EXISTS` refuses to overwrite and leaves the pre-existing file byte-identical; on a forced output failure (report path inside a read-only directory created by the test) only files created by that invocation are removed and no stdout report is published (`OUTPUT_WRITE_FAILED`, exit 2); no other file is created in the temp directory |
| T11 | No PM2 from import / comparison paths | (a) AST scan of F1: imports ⊆ frozen allowlist (no `argparse`); no `os.system` / `os.exec*` / `os.spawn*` / `os.popen`; no `socket`; no string `"pm2"` used as an argv element; (b) `sys.executable -c "import compare_dual_env, sys; print('subprocess' in sys.modules, 'socket' in sys.modules, 'argparse' in sys.modules)"` → `False False False`; (c) CLI run with `PATH` set to a temp dir containing executable shims named `pm2`, `node`, `sudo`, `tcpdump` that write a marker file — no marker is created |
| T12 | Round trip | Mode A with `--emit-observation`, then Mode B on the emitted file, reproduces the identical `apps` block and counts; the Mode B report shows `source="NORMALIZED"`, `jlist_hash_verified=false`; the emitted file contains tokens but never a raw protected value, `pm2_home` only as declared in meta, and no path or argument text |

Every CLI test spawns only `[sys.executable, F1, …]`; the in-process tests call `main()` directly; no test sets `PM2_HOME`, `PM2_BIN`, or any `AISB_*` variable; every temp directory is created under `TMPDIR` (the workflow sets `TMPDIR=$RUNNER_TEMP/tmp`); no skips are allowed on Linux (the workflow fails on any `skipped`).

### 8.2 What the tests do not prove (carried into Step 4 limits)

Real `pm2 jlist` output shape (§2.3); behaviour on any Python other than the runner's 3.12 (syntax rule §7.1 is reviewed, not multi-version-tested); acquisition side effects (out of scope); truthfulness of any operator-declared field; anything about a live host.

### 8.3 Workflow F6 — `pm2-recovery-verify` (fake-only, GitHub-hosted `ubuntu-24.04`, Python 3.12, `workflow_dispatch` only, `timeout-minutes: 15`; corrected 2026-09-19, §14 second correction)

**Three directories (fixed; created in step 0):**

| Var | Path | Class | Ever uploaded? |
|---|---|---|---|
| `EV` | `$RUNNER_TEMP/evidence` | **private raw evidence** — every log, timing / exit file, snapshot, tripwire log, parser output, private summary | **Never.** No step names `$EV` as an upload path |
| `PUB` | `$RUNNER_TEMP/publish` | **cleared publication copy** — created by the gate only after every present `$EV` file passed the scan; the only place truncation happens | Only by step 14, and only when `!cancelled() && steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true'` |
| `FAIL` | `$RUNNER_TEMP/failure` | **fixed allowlisted diagnostics** — never contains a copy of, or a line from, any evidence file | Only by step 15, and only when the gate did **not** clear |

**Placement rule (every step):** all evidence is written under `$EV` by **absolute path**. `TMPDIR="$RUNNER_TEMP/tmp"`, `PYTHONPYCACHEPREFIX="$RUNNER_TEMP/pycache"`. No step writes any file inside `$GITHUB_WORKSPACE` (step E fails if one appears). Job default `shell: bash`, which GitHub runs as `bash --noprofile --norc -eo pipefail {0}`; scripts do **not** disable `-e`. Every `run:` script starts with `set -u`, uses `|| exit <fixed code>` on evidence writes, and wraps every command whose non-zero status carries meaning (the test suite, `grep`, `cmp`) in an `if … ; then … ; else rc=$?; fi` conditional so the status is captured instead of terminating the step.

**Console rule (every step before clearance):** the GitHub console (`run:` stdout / stderr, `$GITHUB_STEP_SUMMARY`, `$GITHUB_OUTPUT`) receives **only** fixed progress strings and **validated** fields: integers matched by `^[0-9]{1,10}$`, hex matched by `^[0-9a-f]{40}$` / `^[0-9a-f]{64}$`, and step-outcome / gate-status enums. No raw test output, no evidence line, no file name from a listing, no argument, no path is echoed. Raw test stdout / stderr are captured **privately** by direct redirection; `tee` and any other console mirror are prohibited.

Steps (mirroring the isolation pattern of the existing workflow; not editing it):

0. **Directories**: `mkdir -p "$RUNNER_TEMP/evidence" "$RUNNER_TEMP/publish" "$RUNNER_TEMP/failure" "$RUNNER_TEMP/tmp" "$RUNNER_TEMP/pycache" "$RUNNER_TEMP/shims" || exit 80`; export `EV`, `PUB`, `FAIL` via `$GITHUB_ENV`. `$PUB` and `$FAIL` are created **empty** and stay empty until the gate / failure-diagnostics steps write to them.
1. **Checkout** pinned, `ref: ${{ github.sha }}`, `fetch-depth: 1`, `persist-credentials: false`.
2. **Set up Python 3.12** pinned.
3. **Identity** (`id: identity`) → `$EV/identity.txt` (workflow, run id / attempt, event, ref, dispatch vs checkout SHA — fail if different; fail if event ≠ `workflow_dispatch`; fail if Python ≠ 3.12). Console: fixed `IDENTITY_OK` or `IDENTITY_FAIL` plus the validated commit hex.
4. **Preflight** (`id: preflight`) → `$EV/preflight.txt`: `git check-attr text eol` on F1 shows `text: set`, `eol: lf`; runner env has no `PM2_HOME`, `PM2_BIN`, `NODE_BIN`, `AISB_*`, `MOCK_*` (names only, into the file, not the console); no real `pm2` on PATH; install PATH tripwire shims for `sudo pm2 tcpdump node` (exit 97 + log to `$EV/tripwire.log`) under `$RUNNER_TEMP/shims`; AST import-allowlist scan of F1 (same rule as T11a, `argparse` excluded) and spawn-argv scan of F2 (every `subprocess.*` argv[0] is `sys.executable`; no `os.system`/`exec`/`spawn`/`popen`; no `socket`); fail closed. Console: `PREFLIGHT_OK` / `PREFLIGHT_FAIL`.
5. **A. SHA256SUMS** (`id: sums`) → `$EV/sha256sums-verify.txt`: `(cd ops/pm2-recovery-verify && sha256sum -c --strict SHA256SUMS)`; verify the set of listed paths equals `git ls-files` of the directory minus `SHA256SUMS`; record F1's hash in the file and, after `^[0-9a-f]{64}$` validation, as output `verifier_sha256` and console `VERIFIER_SHA256=<hex>`.
6. **Before-snapshot** → `git ls-files -z -- ops/aisb-01c6a-operator-bundle ops/pm2-recovery-verify .gitattributes .github/workflows | xargs -0 sha256sum > "$EV/sha256-before.txt" || exit 81`.
7. **B. Byte-compile** (`id: compile`) F1 and F2 → `$EV/compile.txt` (stdout+stderr redirected; not echoed); fail if any `__pycache__` / `.pyc` appears in the tree. Console: `COMPILE_OK` / `COMPILE_FAIL`.
8. **C. Tests** (`id: tests`; single `bash` step; **no pipeline, no `tee`**; raw output goes only to the private log):

   ```bash
   set -u                             # GitHub's `shell: bash` already runs `bash -eo pipefail`; -e stays on
   cd "$GITHUB_WORKSPACE/ops/pm2-recovery-verify" || exit 90
   : > "$EV/unittest.log"            || exit 91      # capture file must be creatable before the suite runs
   start=$(date -u +%s)
   rc=0
   if timeout -k 30 600 python3 -m unittest -v tests.test_compare_dual_env \
       > "$EV/unittest.log" 2>&1; then
       rc=0
   else
       rc=$?                          # the suite's real exit status; 124 / 137 from timeout preserved;
   fi                                 # the `if` keeps inherited -e from terminating the step here
   end=$(date -u +%s)
   [ -f "$EV/unittest.log" ] && [ -r "$EV/unittest.log" ] || exit 92   # capture verification
   [ -s "$EV/unittest.log" ]          || exit 93      # unittest -v always writes; an empty capture is a capture failure
   printf '%s\n' "$rc" > "$EV/unittest.exit"          || exit 94
   printf 'start=%s end=%s seconds=%s\n' "$start" "$end" "$((end-start))" > "$EV/unittest.timing" || exit 95
   case "$rc" in ''|*[!0-9]*) exit 96 ;; esac         # rc must be a validated integer before it is echoed
   echo "TESTS_FINISHED unittest_exit=$rc"            # fixed message + validated integer only
   exit "$rc"
   ```

   Exit codes 90–96 are **capture / evidence-write failures** and are distinct from any test result. The private log is scanned in full by the gate before anything derived from it is published. *If a future edit reintroduces a pipeline (not planned):* it must redirect the consumer's stdout to a private file (never the console), capture `st=("${PIPESTATUS[@]}")` immediately, and exit non-zero unless **both** `st[0]` (producer) and `st[1]` (capture) are 0; the producer status is still recorded in `unittest.exit`.

9. **D. Parse** (`id: parse`; reads `$EV/unittest.log` privately) → `$EV/test-summary.json`: `unittest.exit` == 0; exactly one `Ran N tests`; N == AST count of `test_*` methods in F2; final `OK` with **no** `skipped=`, `failures=`, `errors=`, `unexpected successes`; every T1–T12 group has ≥1 test resolved by name prefix `test_t<N>_`; fail closed on any parser inconsistency. Console: `PARSE_OK ran=<int> defined=<int>` or `PARSE_FAIL` — integers only after `^[0-9]{1,10}$` validation; never a test name or log line.
10. **E. Bytes unchanged** (`id: bytes`) → `$EV/tracked-bytes.txt`: after-snapshot (`$EV/sha256-after.txt`) equals before-snapshot; `git status --porcelain --untracked-files=all` over the **whole checkout** is empty (proves no log, `.pyc`, fixture, or output file was written inside the workspace) — the porcelain output itself is written to the file, never echoed; `$EV/tripwire.log` empty; → `TRACKED_BYTES_UNCHANGED` and `R3_BYTES_UNCHANGED 40/40`. Console: `BYTES_OK` / `BYTES_FAIL`.
11. **Private summary** (`if: always()`; `id: summary`) → `$EV/SUMMARY.md` only (not `$GITHUB_STEP_SUMMARY`): run / commit / `VERIFIER_SHA256` / counts / step outcomes / the fixed evidence-limits sentence ("fake-only LOCAL-TESTS evidence; not live PM2; not staging; does not establish F1–F5, P4–P7, host CLEAN, reopen readiness, or a canary; does not authorize acquisition"). It is evidence-derived and is published only via the gate (step 12) as part of `$PUB`.
12. **R. Redaction gate** (`if: always()`; `id: gate`; the **only** step that writes to `$PUB`). First action: `echo "cleared=false" >> "$GITHUB_OUTPUT"; echo "gate_status=NOT_CLEARED_INCOMPLETE" >> "$GITHUB_OUTPUT"` so that a gate interrupted at any later point leaves the not-cleared default. Then, with `set -u` and every failure path ending in a **fixed** `gate_status` enum and `exit 1`:
    1. **Enumerate** `find "$EV" -mindepth 1 -print0`. Zero entries → `NOT_CLEARED_EMPTY`. Any entry that is not a regular file (`-L` symlink, `-d`, device, fifo) or any entry at depth > 1 → `NOT_CLEARED_UNEXPECTED_TYPE`. Any basename not in the **fixed allowlist** `identity.txt preflight.txt tripwire.log sha256sums-verify.txt sha256-before.txt sha256-after.txt compile.txt unittest.log unittest.exit unittest.timing test-summary.json tracked-bytes.txt SUMMARY.md` → `NOT_CLEARED_UNEXPECTED_FILE`. Unreadable (`! -r`) → `NOT_CLEARED_UNREADABLE`.
    2. **Scan every enumerated file completely, before any truncation or copy** (conditional status capture under inherited `-e`):

       ```bash
       grc=0
       if grep -a -q -E -e 'SENTINEL-NOT-A-SECRET-' -e 'sha256:[0-9a-f]{64}' -- "$f"; then
           grc=0                      # match
       else
           grc=$?                     # 1 = clean; >=2 = scanner error; never terminates the step
       fi
       case "$grc" in 0) match=$((match+1)) ;; 1) clean=$((clean+1)) ;; *) gate_status=NOT_CLEARED_SCANNER_ERROR ;; esac
       ```

       `-a` scans binary content as text so nothing is silently skipped. A match on any file → `NOT_CLEARED_MATCH` with `match_files=<int>` (count only; no name, no line). Every enumerated file must reach a clean verdict; a file that was not scanned for any reason (`clean + match ≠ enumerated`) is **NOT CLEARED** (`NOT_CLEARED_SCAN_INCOMPLETE`).
    3. **Only if every enumerated file is clean**: copy **only the present, enumerated, successfully scanned allowlisted files** — `cp -- "$EV/<name>" "$PUB/<name>"` for each such file (`|| gate_status=NOT_CLEARED_COPY_FAILED`). Allowlisted names that are **absent** because a producer step was skipped or failed are **not required** and are not an error at the gate (the exact 14-file requirement belongs to green-run acceptance §9.2, not to clearance). Then bound **the publication copy only** — `$PUB/unittest.log`, if present, → first 2.5 MiB + fixed marker line `--- TRUNCATED FOR PUBLICATION ---` + last 2.5 MiB when larger than 5 MiB (`$EV/unittest.log` is untouched); rescan `$PUB` with the same conditional scanner (a copy or truncation error cannot introduce content, but the rescan makes clearance depend on the published bytes themselves) → on any non-clean verdict remove `$PUB/*` and set `NOT_CLEARED_PUBLISH_RESCAN`; write `$PUB/redaction-gate.txt` = `REDACTION_GATE_PASS files=<int present and cleared> scanned_bytes=<int>`; **if and only if `$PUB/SUMMARY.md` exists**, append it to `$GITHUB_STEP_SUMMARY` (absent → skip the append; no error); finally `echo "cleared=true"` and `echo "gate_status=CLEARED"` to `$GITHUB_OUTPUT`; exit 0. Clearance therefore means: *every file present in `$EV` was scanned and is clean*, independently of whether the test run passed.
    4. **On any not-cleared path**: leave `$EV` as is (it is never uploaded, so its deletion is not a safety control), ensure `$PUB` is empty (`rm -f -- "$PUB"/*`; a failure here does not change the outcome because `$PUB` is uploaded only under the step-14 condition), write the enum and the integer `match_files` to `$GITHUB_OUTPUT`, print the fixed line `REDACTION_GATE <enum> match_files=<int>` to the console, and `exit 1` (gate `outcome=failure`).
**Clearance definition (used verbatim by steps 13–15):** `CLEARED ⇔ steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true'`. A gate that failed, was skipped, or was cancelled is never CLEARED even if a stale `cleared=true` output existed.

13. **Failure diagnostics** (`if: ${{ always() && !(steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true') }}`; `id: faildiag`) → `$FAIL/FAILURE.txt` containing **only** these fixed, allowlisted fields: `run_id`, `run_attempt` (integers from `github.*`), `sha` (40-hex from `github.sha`), `outcome_<step>` for identity, preflight, sums, compile, tests, parse, bytes, summary, gate (each one of `success|failure|cancelled|skipped` taken from `steps.<id>.outcome`), `gate_status` (the enum from `steps.gate.outputs.gate_status`, or `NOT_CLEARED_GATE_SKIPPED` when the output is empty), `match_files` (integer or `0`), `unittest_exit` (the integer from `$EV/unittest.exit` only if that file exists and its content matches `^[0-9]{1,3}$`; otherwise the fixed string `UNAVAILABLE`), and the fixed sentence "raw evidence was not cleared for publication and is not attached". It reads nothing else from `$EV`, copies no file, and never lists directory contents. The same fields are appended to `$GITHUB_STEP_SUMMARY`. Its safety follows from its construction (fixed keys; enum / integer / hex values), not from whether `$EV` or `$PUB` were emptied.
14. **Upload cleared artifact** (`if: ${{ !cancelled() && steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true' }}` — an **explicit clearance** condition, not `always()`; it permits publishing cleared diagnostics from a *failed test run*, and never publishes after a failed, skipped, or cancelled gate) `pm2-recovery-verify-<run_id>-<run_attempt>`, `path: ${{ runner.temp }}/publish`, retention 7 days, `if-no-files-found: error`. Contents: the present cleared files (the thirteen allowlisted files, with `unittest.log` bounded, on a green run; fewer when producer steps were skipped) plus `redaction-gate.txt`. **Never** any fixture, temp file, `--report` output, or normalized observation (tests create those only under `$TMPDIR`, outside `$EV` and `$PUB`).
15. **Upload failure diagnostics** (`if: ${{ always() && !(steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true') }}`) `pm2-recovery-verify-<run_id>-<run_attempt>-FAILURE`, `path: ${{ runner.temp }}/failure`, retention 7 days, `if-no-files-found: error`. Contents: `FAILURE.txt` only. Steps 14 and 15 are mutually exclusive by construction of the shared clearance definition.

There is **no** step with `path: ${{ runner.temp }}/evidence`; the raw evidence directory is never a publication input under any condition.

**Expected handling (static; to be confirmed by reading the run in Step 4):**

| Scenario | Steps 8–11 | Gate (12) | 13 | 14 | 15 | Job |
|---|---|---|---|---|---|---|
| Tests pass; scan clean | `tests` exit 0; `parse` OK; `bytes` OK; private summary written | every file allowlisted, regular, readable, scanned in full, clean → `$PUB` populated, publication log bounded, rescan clean, `redaction-gate.txt` written, step summary appended, `cleared=true` | skipped | uploads `$PUB` (14 files) | skipped | success |
| Tests fail and the private log contains a sentinel (or a `sha256:` token) | `tests` exit 1 (status preserved by the `if` conditional under inherited `-e`); console shows only `TESTS_FINISHED unittest_exit=1`; `parse` and `bytes` are skipped (no `always()`; see note); private summary records the outcomes | scan finds ≥1 match → `NOT_CLEARED_MATCH match_files=<n>`; `$PUB` empty; exit 1 (outcome `failure`) | writes `FAILURE.txt` (outcomes, `gate_status=NOT_CLEARED_MATCH`, `match_files`, `unittest_exit=1`) | skipped (gate outcome ≠ `success`) | uploads `FAILURE.txt` only | failure; the console never showed a test line |
| Tests fail and the private log is clean | as above, `tests` exit 1 | every present file clean → present set copied to `$PUB` (`unittest.log`, `unittest.exit`, `unittest.timing`, identity / preflight / sums / compile / snapshot files, `SUMMARY.md`; no `test-summary.json` / `tracked-bytes.txt` / `sha256-after.txt`); `cleared=true`; exit 0 (outcome `success`) | skipped | uploads the cleared partial set — *cleared diagnostics from a failed test run* | skipped | failure (from `tests`); Step 4 acceptance not met |
| Capture / evidence-write failure (e.g. `$EV` not writable, empty capture, exit-file or timing write fails) | `tests` exits 90–96 (fixed codes distinct from any test result); the suite's output, if any, is either fully in the private log or absent; later steps skipped | `$EV` is empty or partial. Empty → `NOT_CLEARED_EMPTY`. Partial → only present files are enumerated, scanned in full, and if all are clean the **present** set is copied and published (missing allowlisted files are not required at the gate; Step 4 acceptance separately requires `tests` / `parse` / `bytes` success and the exact 14 files, so the run cannot be accepted) | runs if not cleared | only if cleared (partial, cleared set) | if not cleared | failure |
| Scanner match or scanner error | any | match → `NOT_CLEARED_MATCH`; grep exit ≥2, unreadable file, non-regular entry, unknown name, depth > 1, or an unscanned file → the corresponding `NOT_CLEARED_*` enum; `$PUB` emptied; exit 1 | writes `FAILURE.txt` with the enum and counts | skipped | uploads `FAILURE.txt` | failure |
| Gate skipped or interrupted (job cancelled, runner lost, gate killed mid-scan) | any | gate `outcome` is `skipped` / `cancelled` / `failure`; `cleared` output absent or still `false`; `gate_status` absent or `NOT_CLEARED_INCOMPLETE` | if it runs: `gate_status=NOT_CLEARED_GATE_SKIPPED` / `NOT_CLEARED_INCOMPLETE` | skipped (`!cancelled()` false, or gate outcome ≠ `success`, or `cleared` ≠ `'true'`) | if it runs: `FAILURE.txt` | cancelled / failure; nothing from `$EV` or a half-filled `$PUB` is uploaded because step 14's condition is never satisfied |

Note on steps 9–10 in the second, third, and fourth rows: `parse` and `bytes` have no `always()` and are skipped once an earlier step fails; their `outcome=skipped` is recorded in `FAILURE.txt` (or, when the gate clears a partial set, is visible as the absence of their files in the cleared artifact). This is intentional — a failing run is read, not salvaged (§8.4). Only steps 11 (private summary), 12 (gate), 13 (failure diagnostics) and 15 (failure upload) carry `always()`, and none of them can publish raw evidence.

Not in the workflow: any `pm2`, `node`, `sudo`, `tcpdump`; any secret; any network client; any write to the checkout; any `tee` or console mirror of test output; any upload of `$RUNNER_TEMP/evidence`; any dispatch of `pm2-overlay-unknown-verify.yml`.

### 8.4 Execution authorization

No dispatch, local test, import, compilation, or mock run is authorized by Step 2 or by Step 3. Step 4 requires a separate explicit Keith authorization naming the Step 3 commit to dispatch. A failing run is a result to read, not a retry; each correction returns to Step 3 for a new commit and a new authorized dispatch.

---

## 9. Acceptance criteria (Step 3 / Step 4)

### 9.1 Step 3 — bounded implementation (requires separate Keith authorization)

- [ ] worker output is exactly F1–F6 created; among **implementation / bundle / workflow** files `git status` shows **no modified** tracked file; `git diff --stat HEAD -- ops/aisb-01c6a-operator-bundle .gitattributes .github/workflows/pm2-overlay-unknown-verify.yml frontend services` is empty; r3 40/40 raw SHA-256 unchanged (governance mirrors of §7.1b are the control plane's separate writes and are not counted here)
- [ ] F1 imports ⊆ §7.1 allowlist (no `argparse`, `subprocess`, `socket`, spawn primitives, `traceback`); Python ≥3.8 syntax rule honoured (reviewed statically); no test-only hook or override in production code
- [ ] F1 implements §4.0 (echo boundary; pointer vocabulary; hand-rolled CLI; read-once hashing), §4.1–§4.5 (shape rules; raw-jlist scope split; Mode B re-checks), §4.6, §4.8 (missing-in-observation codes; always-on future check), §4.9 (every code reachable and used; `null` identifiers on `INVALID_INPUT`), §4.10 (two modes; output ordering; created-file cleanup), §5.1–§5.5 (truth table, precedence, exit codes, report schema, `INTERNAL_ERROR` JSON, constant `non_claims`, `authority` constant), §6.1–§6.4 (inputs by mode; 0600 `O_EXCL` outputs; type-name-only `INTERNAL_ERROR`; no value / token / free text / path / argument text in class-A output)
- [ ] F2 implements every group T1–T12 with test names prefixed `test_t<N>_`; leak assertions boolean with constant messages; spawns only `sys.executable`; forced unexpected error via `unittest.mock.patch.object` in-process only; temp files only under `TMPDIR`
- [ ] F3 states purpose, both modes and the declared-vs-verified hash distinction, schemas, exit codes, redaction and output classes, acquisition prerequisite, non-claims, and "NOT APPROVED FOR LIVE USE"
- [ ] F4 lists F1, F2, F3, F5 with correct hashes (computed statically on LF bytes); F5 = `* text eol=lf`
- [ ] F6 matches §8.3 (three directories; placement and console rules; steps 0–15; pins; private capture by direct redirection with capture-failure exit codes 90–96 and no `tee`; full-file binary-inclusive scan before truncation with conditional `grep` status capture; test / timeout status preserved via the `if … else rc=$?` conditional under inherited `bash -eo pipefail`; publication only under `!cancelled() && steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true'`; failure-diagnostic steps use the negation of the same clearance definition; gate copies only present, enumerated, scanned files and appends `SUMMARY.md` only if present; failure artifact from `$RUNNER_TEMP/failure` with fixed allowlisted fields only; no step uploads `$RUNNER_TEMP/evidence`); not dispatched
- [ ] no local execution of F1 / F2, no import, no compilation, no mock, no workflow dispatch; lane validator + Git diff / scope check only
- [ ] control-plane mirrors per §7.1b: Step 3 WRITTEN / BEHAVIOURAL VERIFICATION NOT RUN; occupancy per control-plane decision; EXEC-01C6A `NOT_READY` unchanged

### 9.2 Step 4 — independent verification / checkpoint / lock (requires separate Keith authorization)

- [ ] one authorized `workflow_dispatch` of F6 at the Step 3 commit; `checkout_sha == dispatch_sha`
- [ ] steps 3, 4, 5, 7, 8, 9, 10, 12 green with `steps.gate.outcome == 'success'`, `steps.gate.outputs.cleared == 'true'`, `gate_status=CLEARED`; step 14 ran and steps 13 / 15 were skipped (no `-FAILURE` artifact exists); the cleared artifact contains **exactly** the fourteen files of §8.3 step 14 (this exact-count requirement applies to green-run acceptance only; the gate itself clears any present clean set) with `redaction-gate.txt` = `REDACTION_GATE_PASS files=13 …`; `test-summary.json.problems == []`; N ran == N defined; no skips / failures / errors; `unittest.exit` = `0`; tripwire log empty; whole-checkout `git status --porcelain --untracked-files=all` empty; `TRACKED_BYTES_UNCHANGED`; `R3_BYTES_UNCHANGED 40/40`; the job console shows no test output line (fixed messages and validated fields only)
- [ ] `VERIFIER_SHA256` from the runner == F4 entry for F1 == `git rev-parse <commit>:ops/pm2-recovery-verify/compare_dual_env.py` blob hashed locally (static `Get-FileHash` over `git cat-file` bytes, not the working copy)
- [ ] hash recorded in this document §11, the board field `PM2_RECOVERY_VERIFY_01_VERIFIER_SHA256`, and the canonical body; **not** inside F1
- [ ] lock record carries verbatim: fake-only LOCAL-TESTS on a GitHub-hosted runner; jlist shape never validated against a live daemon (§2.3); single platform / Python version; acquisition prerequisite unregistered and unauthorized; tokens qualification (§4.6); the tool has not been transferred to or run on any host; NOT APPROVED FOR LIVE USE until a P6 procedure is separately authorized
- [ ] lock does **not**: resolve A1 / A2; designate B(H); attest P4 / P5 / P7; establish host CLEAN; prove F1–F5; amend EXEC-01C6A acceptance; satisfy the reopen gate; authorize r3 / r4 or F1 live use or transfer; authorize a canary
- [ ] sidecar: candidate `status=LOCKED`, `admissionUncertain=false` (locked-candidate convention), `writeSetPrecision=EXACT`, write set / hotfiles retained as record; `PM2-RECOVERY-VERIFY-01` appended to `lockedTaskIds`; validator PASS

### 9.3 Evidence limits to be carried into any lock (pre-stated)

(a) fake-only; no live PM2, staging, daemon, or host; (b) assumed jlist shape (§2.3); (c) one runner platform / one CPython version; syntax-compatibility with older Pythons is a reviewed rule, not tested; (d) no acquisition procedure exists or is tested; §3.4 remains a prerequisite; (e) tokens are equality oracles (§4.6); (f) operator-declared fields are compared, not authenticated (§4.8); Mode B's `jlist_sha256` is declared, not verified (§4.10); (g) the redaction gate detects the synthetic sentinel prefix and `sha256:` tokens; it cannot detect a leak of an arbitrary string that carries neither marker — code review of the echo boundary (§4.0) remains the primary control; the GitHub console before clearance is protected by construction (fixed strings and validated fields), not by a scan, and GitHub's own step-header echo of `run:` scripts is outside the workflow's control; (h) the tool reads its own file for `self_sha256` and reports that hash; it does not prove which bytes a future host executes.

---

## 10. What remains outside this task (explicit)

| Item | Owner / where decided |
|---|---|
| A1 first-run applicability; A2 baseline requirement, provenance, source, and values — including how any reference document is authored | later explicit governance record (POLICY §13.7) |
| Acquisition prerequisite (§3.4): registration, authorization, P4 / P5 attestations, E1 / E2 entries, STAGING / PM2 access | separate control-plane registration and Keith authorization; not this task |
| Live acquisition / live use / transfer of F1 or r3 to any host | separately authorized window; NOT authorized here |
| P6 execution and P6 record; dwell / repeat procedure | later S2 host window using a LOCKED verifier plus authorized acquisition |
| P7 attestation; host CLEAN; reopen gate; EXEC-01C6A acceptance amendment (C1); canary | S2 / S3 / S4 control-plane steps (POLICY §13.6) |
| Publication of tokens in governance evidence | Keith decision under POLICY §3.4 item 2 with the §4.6 qualification |
| Python version on the staging host (affects nothing in this task; affects a future run) | acquisition / run authorization window |
| Step 3 authorization; Step 4 dispatch authorization; lane admission | Keith / control plane |

No clearance mechanism, proof provider, override, or latch-clearing path is introduced anywhere in this design.

---

## 11. Frozen values to be filled at Step 4 (placeholders; not evidence)

```
STEP_3_COMMIT=<sha>            (F1–F6 written)
STEP_4_RUN_ID=<id> ATTEMPT=<n> (single authorized dispatch)
VERIFIER_SHA256=<hex>          (F1 blob at STEP_3_COMMIT; == SHA256SUMS entry == runner sha256sum == report self_sha256)
TESTS_RAN=<N> DEFINED=<N> FAILURES=0 ERRORS=0 SKIPPED=0
R3_BYTES_UNCHANGED=40/40
```

---

## 12. Step 2 verdict

```
STEP_2_VERDICT=FREEZE_COMPLETE
ARCHITECTURE=OFFLINE_COMPARISON_CORE_NO_ADAPTER
PM2_CLIENT_IN_VERIFIER=NONE (no subprocess, no socket; auto-launch / reconnect race assigned to the unregistered acquisition prerequisite; not bounded by any pre-check)
REUSE_OF_R3_PRIMITIVES=BY_VALUE_AND_SPECIFICATION_ONLY (no import; compare_restore_dual / CliPm2 NOT reused; reasons §2.2)
WRITE_SET=EXACT (F1–F6; six new implementation files; zero modified tracked implementation / bundle / workflow files; governance mirrors listed separately §7.1b)
INPUT_CONTRACT=FROZEN (§4; two CLI modes §4.10; echo boundary §4.0; raw-jlist scope §4.3; A1/A2 OPEN; authority NOT_EVALUATED_BY_VERIFIER; fail-closed codes §4.9)
OUTPUT_CONTRACT=FROZEN (§5; exit 0/3/4/2/1; constant non_claims in all five outcomes; INTERNAL_ERROR minimal JSON; output ordering §4.10)
PROTECTED_MATERIAL=FROZEN (§6; 3 / 2 read-only inputs by mode; no vault/journal/marker read; tokens RESTRICTED and qualified; output classes A/B/C §6.4)
PACKAGING=STANDALONE_NO_ARCHIVE (§7.3; hash in SHA256SUMS + governance; r3 preserved)
VERIFICATION_PLAN=FROZEN (§8; T1–T12; new workflow F6: private capture without tee, full-file scan before truncation, publication only on explicit clearance, separate fixed-diagnostics failure artifact, raw evidence never uploaded; existing workflow not edited; no dispatch)
STEP_2_CORRECTION=APPLIED_2026-09-19 (§14; seven consistency points; write set, architecture, and packaging unchanged)
STEP_2_CORRECTION_2=APPLIED_2026-09-19 (§14.1; §8.3 evidence handling; contract and six paths unchanged)
ACQUISITION_PREREQUISITE=IDENTIFIED_NOT_REGISTERED_NOT_AUTHORIZED
A1_STATUS=OPEN  A2_STATUS=OPEN  BASELINE_DESIGNATED=NO
P6_EXECUTED=NO  HOST_CLEAN=NO  REOPEN_GATE_SATISFIED=NO  EXEC_01C6A_START_CONDITION=NOT_READY (unchanged)
STEP_3=NOT AUTHORIZED  STEP_4=NOT AUTHORIZED  LOCKED=NO
```

---

## 13. Activity ledger (Step 2 window, 2026-09-19)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor fetch=0, network=0, workflow created/edited/dispatched=0, r3 transferred/extracted/executed=0, Python executed=0, imports=0, compilation=0, tests=0 except lane-capacity validator, mocks=0, builds=0, installs=0, browser=0, subagents=0, bundle/manifests/archive edited=0 (40/40 unchanged), predecessor bodies or lock records edited=0, EXEC-01C6A documents / body / candidate edited=0, lockedTaskIds edited=0, mutex catalog edited=0, source/test files created=0, Git add/commit/push=0.

Writes: this document (new); `TASKS.md` this task's current board fields; `TASKS_BACKLOG_FULL.md` this task's body only; `docs/control-plane/lane-saturation-state.json` this candidate's scope / resource fields only (`writePaths`, `hotfiles`, `writeSetPrecision=EXACT`; `admissionUncertain=true` retained; `status`, `startCondition`, `saturationClass`, `dependsOn`, `evidenceClass`, `runtimeNeeds`, `exclusiveCapacity` unchanged); `docs/control-plane/SATURATION_PROOF.json` by the validator only. GOVERNANCE acquired transiently for these mirrors then released UNOWNED. Occupancy EMPTY. Lane 3 DISABLED. Keith owns commit / push.

---

## 14. Step 2 correction record (2026-09-19; before implementation; same uncommitted freeze)

Keith directed a consistency correction of the uncommitted Step 2 freeze. Architecture (`OFFLINE_COMPARISON_CORE_NO_ADAPTER`), the six-file implementation set F1–F6, and `STANDALONE_NO_ARCHIVE` are unchanged; the sidecar candidate's scope fields (`writePaths`, `hotfiles`, `writeSetPrecision`) therefore did not change and the sidecar was not edited. No implementation, execution, import, test, mock, workflow, SSH, PM2, staging, Git mutation, or subagent.

| # | Point | Corrected where |
|---|---|---|
| 1 | Redaction boundary: only approved, validated identifier fields and fixed diagnostic text are echoed; free-text provenance, `pm2_home`, invalid member names, paths, and CLI argument text are never reproduced; `argparse` dropped for a hand-rolled parser; pointer vocabulary with placeholders; sentinel cases extended to metadata values, malformed member names, paths, and CLI arguments; output classes A / B / C distinguished | §4.0 (echo boundary, pointer vocabulary, CLI parsing), §4.1, §4.2, §5.4, §6.2, §6.4, §7.1 (F1 allowlist), §8.1 T7 / T8 / T11 |
| 2 | Raw jlist schema: `UNKNOWN_FIELD` scoped to verifier-owned schemas; PM2 metadata and unrelated environment members permitted and never read / reported; every-element checks (object, string `name`, app cardinality) separated from selected-app checks (`pm2_env`, `env`, named-key classification); elements without a string `name` are rejected, unrelated named processes are skipped — T5 wording aligned | §4.0, §4.3, §8.1 T4 / T5 |
| 3 | Input modes: Mode A (reference + meta + raw jlist; hash verified over the bytes parsed) and Mode B (reference + normalized observation; no separate meta; hash declared, not verified; `jlist_hash_verified` reported); neither authenticates host / daemon / operator / time; Mode B re-applies schema, protected-name, shape, identity, freshness checks; `pm2_home` / `daemon_pid` declared by the reference must be present and equal in the observation; future-timestamp check always applied (300 s skew) independent of `--max-age-seconds` | §3.1, §3.4, §4.2, §4.5, §4.8, §4.10, §5.4, §8.1 T6 / T12 |
| 4 | State / error consistency: SET requires a non-empty `value` or well-formed `token`; EMPTY / ABSENT reject payloads (`EXPECTATION_SHAPE` / `OBSERVATION_FIELD_SHAPE`); `INVALID_INPUT` report carries `null` for identifiers not safely extracted and `-` in the summary line; `INTERNAL_ERROR` emits a minimal JSON report with the constant `non_claims` plus the stderr line (type name only), so every outcome carries `non_claims`; directory / unreadable input is `INPUT_UNREADABLE`; unexpected errors are forced only by `unittest.mock.patch.object` in-process (no production override) | §4.1, §4.5, §4.9, §5.3, §5.4, §6.2, §7.1 (F1 / F2), §8.1 T4 / T7 / T8 |
| 5 | Workflow placement: all logs, timing, exit files, summaries, snapshots under `$RUNNER_TEMP/evidence` by absolute path; `unittest.log` never in the checkout (whole-checkout porcelain check); real exit status preserved; redaction gate before publication. **Superseded in part by the second correction below (§8.3 rewritten 2026-09-19): private capture without `tee`, publication only on explicit clearance, separate fixed-diagnostics failure artifact.** | §8.3; §9.2; §9.3 (g) |
| 6 | Static parity: `PROTECTED_NAMES` recognized as `frozenset({...})` — AST `Call(func=Name("frozenset"))` with one set-display argument literal-evaluated; `SECRET_KEY_FRAGMENTS` as a tuple literal; `SECRET_ENV_NAMES` (10) asserted protected; no `eval` / `exec` / import of r3; counts corrected to 6 names / 10 fragments / 10 env names | §2.2, §4.6, §8.1 T9 |
| 7 | Scope / completion: "six new files / zero modifications" scoped to implementation files and actors; governance mirrors listed distinctly in §7.1b and required (not forbidden) by §9.1 / §9.2; output creation exclusive; on failure only files created by this invocation are removed; no MATCH report published before required output operations succeed (`OUTPUT_WRITE_FAILED`) | §4.10 output ordering, §6.1, §7.1, §7.1b, §8.1 T10, §9.1, §12 |

Remaining limitations after correction (unchanged in kind): §9.3 (a)–(h); the acquisition prerequisite (§3.4) remains unregistered and unauthorized; A1 / A2 OPEN; Steps 3–4 NOT AUTHORIZED.

### 14.1 Second correction (2026-09-19; §8.3 evidence handling only)

Keith directed a further correction of §8.3 and its directly affected acceptance criteria. Comparison / input contract (§4–§6), the six implementation paths F1–F6, packaging, and the sidecar candidate are unchanged.

| # | Point | Resolution |
|---|---|---|
| 1 | Private capture | Step 8 redirects test stdout / stderr directly to `$EV/unittest.log`; no `tee`, no console mirror; the suite / `timeout` exit status is preserved in `unittest.exit` and returned; capture or evidence-write errors exit with fixed codes 90–96 distinct from any test result; the pipeline variant (if ever reintroduced) must redirect the consumer privately and require both producer and capture statuses to pass |
| 2 | Complete scan before truncation / publication | Gate step 12 enumerates `$EV`, requires regular readable allowlisted files at depth 1, scans each file **completely** with `grep -a` (binary content included) before any copy or truncation; scanner error, unreadable file, unexpected type / name, empty directory, or any unscanned file → a `NOT_CLEARED_*` enum, never a silent skip |
| 3 | Publication only after explicit clearance | Cleared copy in `$RUNNER_TEMP/publish`, uploaded only when `!cancelled() && steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true'`; the raw `$RUNNER_TEMP/evidence` is never an upload path; failure diagnostics live in the separate `$RUNNER_TEMP/failure` directory and contain only fixed keys with enum / integer / hex values (no matched content, no file or directory names); their safety does not depend on deleting raw evidence |
| 4 | Logs and summaries after clearance | Console before clearance shows only fixed progress strings and regex-validated status / count / hex fields; `SUMMARY.md` is written privately and appended to `$GITHUB_STEP_SUMMARY` only by the gate on clearance; truncation applies only to the publication copy of `unittest.log` |
| 5 | Static expected handling | Five-scenario table in §8.3 (pass + clean; failed tests with sentinel; capture / write failure; scanner match or error; skipped / interrupted gate) |

Affected acceptance criteria: §9.1 (F6 line), §9.2 (green-run line); §6.2 test-artifacts row; §9.3 (g). Writes: this document; `TASKS.md` this task's fields; `TASKS_BACKLOG_FULL.md` this task's body; `docs/control-plane/SATURATION_PROOF.json` by the validator only. Sidecar not edited. No implementation, Python, tests, dispatch, staging, Git mutation, or subagents. Steps 3–4 remain NOT AUTHORIZED.

#### 14.1.1 Execution-detail addendum (2026-09-19; §8.3 only)

| # | Detail | Resolution |
|---|---|---|
| a | Inherited `bash -eo pipefail` | Step 8 wraps the suite in `rc=0; if timeout … > "$EV/unittest.log" 2>&1; then rc=0; else rc=$?; fi`, then performs the checked evidence writes and `exit "$rc"`; the gate wraps every `grep` in the same conditional so exit 1 (clean) and ≥2 (scanner error) are classified rather than terminating the step; the placement rule states that `-e` is not disabled |
| b | Publication condition | Step 14: `if: ${{ !cancelled() && steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true' }}`; steps 13 and 15: `if: ${{ always() && !(steps.gate.outcome == 'success' && steps.gate.outputs.cleared == 'true') }}`; a single clearance definition is stated above step 13; cleared diagnostics from a failed test run may be published; nothing is published after a failed, skipped, or cancelled gate |
| c | Partial evidence | The gate copies only present, enumerated, successfully scanned allowlisted files; absent files from skipped producer steps are not required; `SUMMARY.md` is appended to the step summary only if present; the exact 14-file requirement applies to §9.2 green-run acceptance only; a sixth scenario row ("tests fail, log clean") was added to the handling table |

Write scope unchanged (this document; `TASKS.md` fields; backlog body; `SATURATION_PROOF.json` by the validator). Sidecar not edited. Steps 3–4 remain NOT AUTHORIZED.

Correction-window writes: this document; `TASKS.md` this task's fields; `TASKS_BACKLOG_FULL.md` this task's body; `docs/control-plane/SATURATION_PROOF.json` by the validator only. Sidecar not edited (no scope field changed). GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY. EXEC-01C6A `startCondition=NOT_READY` unchanged. Keith owns commit / push.
