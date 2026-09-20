# PM2-RECOVERY-ACQUISITION-01 — Stage-Start / Freeze (Step 2)

**Task:** PM2-RECOVERY-ACQUISITION-01 — Define the bounded PM2 observation-acquisition procedure and evidence handling
**Nature:** GOVERNANCE / DECISION (4-step). No implementation lane. No sidecar candidate.
**Step:** 3 of 4 COMPLETE — explicit Keith decision recorded against the frozen §7 matrix (§15). Previous: 2 of 4 COMPLETE — reviewable procedure freeze. Previous: 1 of 4 COMPLETE — registration / control-plane only (2026-09-19).
**Step 2 date:** 2026-09-19
**Step 2 HEAD at window open:** `0e208ef219d1b373546b53267bbc0664aede5621` (branch main; working tree clean; matches the expected baseline)
**Step 3 date:** 2026-09-20
**Step 3 HEAD at window open:** `90f5957025e96a1f80252b3fb78ac776bac0e842` (branch main; working tree clean; matches the expected baseline; Step 2 freeze + corrections §10–§14 committed by Keith)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-ACQUISITION-01 (Step 1 COMPLETE at HEAD `6557e8a7f068b54ba8f0a82dbeeb7dc161819d59`)
**Current status (after Step 3):** **Step 3 COMPLETE.** Requirements contract adopted at C-ADOPT. Q1-A `ABORT_IF_ABSENT`; Q2-B `TOOLING`; Q3-A `NO_RETRY`. `PROCEDURE_SELECTED=YES` (requirements contract). `PROCEDURE_APPROVED=YES` (C-ADOPT). `EXECUTION_AUTHORIZED=NO`. `MECHANISM_ESTABLISHED=NO`. No live acquisition, C-ACQ, transfer, or runtime authorization. Step 4 NOT AUTHORIZED. NOT LOCKED. Host remains UNCLEAN / HOLD. EXEC-01C6A `startCondition=NOT_READY`. Builder gate ON. Harness flags unchanged.
**Freeze status (historical, Step 2):** FROZEN for review. No decision was selected in §§0–14. At Step 2 close: `PROCEDURE_SELECTED=NO`; `PROCEDURE_APPROVED=NO`; `EXECUTION_AUTHORIZED=NO`; `MECHANISM_ESTABLISHED=NO`. §§0–14 are preserved unchanged as the controlling requirements specification. The §7.4 recommended-package `UNADOPTED` label is historical.
**Acceptance object:** A bounded observation-acquisition requirements contract and its authorization boundary. Adoption of this procedure will **not** authorize execution. The mechanism to implement the requirements is not established by this freeze (§6.3); a separately authorized capture child is the proposed follow-on dependency (§6.5).

**Locked predecessors read in this Step 2 (evidence only; not edited):**

| Predecessor | Document | Status |
|---|---|---|
| PM2-RECOVERY-VERIFY-01 | `docs/PM2-RECOVERY-VERIFY-01-STAGE-START.md` | COMPLETE AND LOCKED |
| PM2-RECOVERY-BASELINE-GOV-01 | `docs/PM2-RECOVERY-BASELINE-GOV-01-STAGE-START.md` | COMPLETE AND LOCKED |
| PM2-RECOVERY-POLICY-01 | `docs/PM2-RECOVERY-POLICY-01-STAGE-START.md` | COMPLETE AND LOCKED |
| PM2-DAEMON-INVESTIGATION-01 | `docs/PM2-DAEMON-INVESTIGATION-01-STAGE-START.md` | COMPLETE AND LOCKED |

**Verifier source statically inspected:** `ops/pm2-recovery-verify/compare_dual_env.py` — CLI flags, input schema validation, hash binding, identity/freshness check (`check_identity_and_freshness` l.854–893: `PM2_HOME_MISSING_IN_OBSERVATION` / `DAEMON_PID_MISSING_IN_OBSERVATION` when reference declares but observation omits), `NON_CLAIMS`, output creation at `0o600`, echo boundary. Not imported or executed.

---

## 0. Invariants preserved by this freeze (not re-decided)

| Invariant | State | Source |
|---|---|---|
| A1 (first-run applicability) | ADOPTED (A1-F; contract text only) | BASELINE-GOV-01 §14 |
| A2 (expected-baseline provenance policy) | ADOPTED (P-A; REQUIRED provenance policy only) | BASELINE-GOV-01 §14 |
| D7 | LEDGER_ONLY | BASELINE-GOV-01 §14.2 |
| First-run contract | DEFINED; no usable first-run path | BASELINE-GOV-01 §14.3 Rule A-1 |
| P1–P8 | BINDING, unchanged | PM2-FENCE-01 §6; POLICY-01 §3 |
| P7_ACCEPTED | NO | POLICY-01 §6; PM2-FENCE-01 §8 |
| HOST_CLEAN | NO | PM2-FENCE-01 §8; POLICY-01 §4 |
| Host state | UNCLEAN / HOLD | PM2-FENCE-01 §8; POLICY-01 §4.1 |
| OUTCOME_UNKNOWN_POLICY reopen gate | UNSATISFIED | PM2-FENCE-01 §8 |
| EXEC-01C6A | `startCondition=NOT_READY`; not reopened; not admitted | board / sidecar |
| Builder Ask gate | LEFT ON | BUILDER-LIVE-GATE-01 checkpoint |
| Verifier (`compare_dual_env.py` v1.0.0) | COMPLETE AND LOCKED; NOT APPROVED FOR LIVE USE | VERIFY-01 §14.8 |
| Recovery-material preservation (E1–E5) | BINDING | POLICY-01 §4.3 / §6.2 |
| Restoration payload | UNCHANGED (per-run preserved vault) | EXEC-01C6 §5.3 / §16; CANARY §4 |
| Frozen catalog `HARNESS_ENTITLEMENT_PROOF_V1` | FROZEN; not consumed or mutated | board |
| I-4 / I-5, reference preparation, C1, S2 evidence | remain outstanding | BASELINE-GOV-01 §14.3 |

Nothing in §§1–14 of this document weakens a row of this table.

---

## 1. Acceptance object and controlling scope

### 1.1 What this freeze defines

A prospective observation-acquisition requirements contract: what controls a later authorized acquisition **must** satisfy when obtaining raw PM2 `jlist` bytes and observation metadata. The freeze covers:

- **A.** Acquisition contract and evidence binding — alignment with the LOCKED verifier's Mode A input contract.
- **B.** PM2-client behavior and failure handling — carrying locked findings accurately.
- **C.** Authorization and sequencing — distinguishing procedure adoption from later operational use.
- **D.** Restricted evidence handling — private capture, LEDGER_ONLY, no disclosure.
- **E.** Mechanism assessment and proposed tooling dependency — the manual mechanism is not established; a capture child is the proposed follow-on.

### 1.2 What this freeze does not authorize

| Separate object | Why separate |
|---|---|
| Executing the acquisition procedure | requires later Step 3 Keith decision + separate operational authorization + established mechanism |
| Running the offline verifier against real data | VERIFY-01 NOT APPROVED FOR LIVE USE; separate authorization |
| Constructing B(H) reference document | A2 ADOPTED as policy; construction is a later authorized preparation step |
| Accepting host evidence (P4/P5/P7) | host-specific, time-specific attestation |
| C1 amendment of EXEC-01C6A | separately authorized control-plane step |
| Reopening EXEC-01C6A (P8) | requires §8 reopen gate |
| Transferring or executing the verifier on host | separately registered scope |
| Canary submission | requires reopen + admission + runtime mutexes |
| Reading `.env`, `dump.pm2`, ecosystem, systemd configuration | separate prerequisite |
| Inspecting or modifying vault/journal/marker material | separate explicit scope |
| Implementing, testing, or transferring a capture mechanism | separately authorized child (§6.5) |

---

## 2. Area A — Acquisition contract and evidence binding

### 2.1 Prospective acquisition sequence (requirements contract)

The following sequence defines the requirements that a later authorized acquisition must satisfy. Each step has explicit prerequisites, outputs, and failure outcomes. **Nothing below is authorized to execute. No mechanism implementing these requirements has been established (§6.3).**

**Prerequisites for the entire sequence (all must be satisfied before Step ACQ-1):**

- [ ] Keith Step 3 decision adopts this requirements contract (C-ADOPT, with Q1 resolved)
- [ ] Separate operational acquisition authorization granted by Keith (C-ACQ, with Q2 resolved and explicit invocation/attempt scope stated)
- [ ] Established and verified capture mechanism available (§6.5 child LOCKED and transferred, or a separately reviewed manual mechanism if one is later established)
- [ ] STAGING / PM2 ownership held by the authorized task
- [ ] E1 vault registry entry for (host, app set) recorded before first authorized run
- [ ] P4 attestation valid for the acquisition window (POLICY-01 §5.1) — supplied as externally authorized evidence (§4.2)
- [ ] P5 assessed at ACQ-1e pre-invocation checkpoint (§4.3)
- [ ] E2 host-ledger recording structure ready before invocation
- [ ] Private attempt directory created and verified (§5.1) — failure blocks invocation
- [ ] Target tuple confirmed and internally consistent (§3.2); daemon must be present (§7.1)
- [ ] No B(H) reference required at this point (§2.5)

**Step ACQ-1 — Pre-invocation observation (passive; no PM2 client)**

Every command in ACQ-1 must have its stdout and stderr routed to private log files in the attempt directory (§5.3). No command output displayed on the terminal.

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-1a | Record wall-clock time `T_obs_start` (UTC) — the start of the acquisition observation sequence | timestamp | — |
| ACQ-1b | Observe `rpc.sock` presence and holders at the confirmed target PM2 home (§3.2) (INVESTIGATION-01 A7/A8 method: `ls -l`, `lsof` on socket, no PM2 client) | socket state record | absent socket → record DAEMON_ABSENT → **STOP** (§7.1 Q1-A) |
| ACQ-1c | Observe daemon PID via process-table filter per §3.3 and `/proc/$PID/exe` (INVESTIGATION-01 A5; no PM2 client) | PID, exe path | no process found → record DAEMON_ABSENT → **STOP** |
| ACQ-1d | Record pre-invocation state: `{daemon_present, daemon_pid_observed, socket_present, T_obs_start}` in a private file in the attempt directory, mode 0600 | pre-observation record (restricted; §5) | write failure → STORAGE_FAILURE_BEFORE_INVOCATION (§3.5); preserve any already-created attempt-directory contents |
| ACQ-1e | Verify no operator PM2 CLI children exist, using the §3.3 filtering criteria — **P5 pre-invocation check** (§4.3) | filtered process list | pm2 CLI child present → **STOP**; P5 not satisfied; record in E2. Observation-tool failure (e.g. pgrep returns error, not merely empty) → **STOP**; record tool failure; do not treat as "no children found" |

**Prohibited in ACQ-1:** any PM2 client invocation (`pm2 -v`, `pm2 ls`, `pm2 jlist`, `pm2 ping`, …); reading `/proc/<pid>/environ`; any `.env`, vault, journal, marker, or secret access.

**Step ACQ-2 — Bounded jlist invocation**

The capture mechanism must enforce the requirements in §3.4.

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-2a | Record wall-clock time `T_invoke` (UTC) — immediately before the jlist command | timestamp | — |
| ACQ-2b | Launch the confirmed `pm2` binary (§3.2 target tuple) with argument `jlist`, under the authorized account, with `PM2_HOME` set to the confirmed target PM2 home. Route stdout and stderr to separate private files (mode 0600; §5.2 — no-overwrite creation required). Record the exact launched child's process identity for monitoring | raw jlist bytes (`stdout.raw`), stderr bytes (`stderr.raw`); recorded child identity | launch failure → INVOCATION_FAILED (§3.5). Child-identity or PID-record write failure after successful launch → do not abandon the live client; preserve all evidence; record anomaly; proceed to monitoring/escalation |
| ACQ-2c | Monitor the identified child process with bounded timeout and targeted escalation (§3.4). Collect the exit status | integer exit code | timeout or termination failure → see §3.4 and §3.5 |
| ACQ-2d | Record wall-clock time `T_post_cmd` immediately after the client process is confirmed exited and reaped | timestamp | — |

**If the client process cannot be confirmed exited** (KILL_FAILED, §3.5): the stdout and stderr files may still be held open by the process or by another process that inherited the descriptors. Their content may change. Do not hash, finalize, or reuse these files. Preserve as potentially-changing material with a notation in E2. See §3.4.

**Step ACQ-3 — Post-invocation observation (passive; no PM2 client)**

All command output routed to private log files in the attempt directory (§5.3).

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-3a | Record wall-clock time `T_post` (UTC) — start of post-observation sequence | timestamp | — |
| ACQ-3b | Observe daemon PID (same method as ACQ-1c, filtered per §3.3) | PID or absent | PID changed vs ACQ-1c → IDENTITY_CHANGE (§3.5). Daemon absent where previously present → DAEMON_DISAPPEARED. Equal PID does not guarantee the same daemon instance (§3.3 PID-reuse limitation) |
| ACQ-3c | Observe `rpc.sock` holders at the confirmed target PM2 home | holder list | new unexpected holder → record anomaly |
| ACQ-3d | Verify no operator PM2 CLI children remain, using §3.3 filtering criteria — P5 post-invocation check (§4.3) | filtered process list (names/args only, no env) | pm2 CLI child still present → LINGERING_CLIENT (§3.5) |

Post-checks detect changes; they cannot undo side effects the invocation already produced, and they cannot prove no side effect occurred. Equal pre/post daemon PID does not prove daemon continuity (PID reuse; §3.3).

**Step ACQ-4 — Hash binding and observation-meta construction**

Proceed to ACQ-4 **only if** the client process is confirmed exited and no other process holds the output file descriptors open (the output-writer/descriptor boundary is established). If either condition is not met, ACQ-4 is skipped; files are preserved as potentially-changing material with an unresolved finalization status.

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-4a | Compute SHA-256 over the exact bytes of `stdout.raw`. The file must not be held open for writing by any process. Route hash-tool output to a private log (§5.3); extract the hex digest from the log without displaying it on terminal | 64-char lowercase hex digest | tool failure → HASH_FAILED |
| ACQ-4b | Construct observation-meta JSON (§2.2) programmatically (no interactive text editor — editors create backup/swap files; §5.3). Uncertain fields handled per §2.2 field-by-field table | `observation-meta.json`, mode 0600 | — |
| ACQ-4c | Verify the observation-meta JSON is valid UTF-8 and syntactically valid JSON. This is a **syntax check only**; schema compliance, field formats, and hash correctness are verified only when the verifier later runs. Until then, the captured artifacts are **unvalidated material** — retained and integrity-protected but not labelled validated, correct, or ready for comparison | pass/fail | fail → META_INVALID |
| ACQ-4d | Compute SHA-256 over `observation-meta.json` for the E2 ledger record | hex digest | — |

**Deferred validation:** Hash correctness, schema compliance, and comparison suitability are verified only when the verifier runs (Mode A). Until then, artifacts are **unvalidated material**.

**Step ACQ-5 — E2 host-ledger entry**

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-5a | Record in the E2 host ledger the minimum acquisition entry per the locked E2 contract (POLICY-01 §4.4: "every `pm2` client invocation against H during the window — command, app, purpose, wall time, operator, exit status, ack/uncertain fate — recorded outside the vault"). For this acquisition: command = `pm2 jlist`; exit status = the collected integer (§3.4); fate = UNCERTAIN (exit status alone does not establish daemon-side fate; the daemon may or may not have processed the request, produced the response, or completed any internal action — §3.1). Additionally record: app set, purpose (PM2-RECOVERY-ACQUISITION-01), timestamps (`T_obs_start`, `T_invoke`, `T_post_cmd`, `T_post`), operator, stdout file SHA-256, observation-meta file SHA-256, recorded child identity, anomaly flags (DAEMON_ABSENT, IDENTITY_CHANGE, TIMEOUT, KILL_FAILED, AUTO_LAUNCH_SUSPECTED, LINGERING_CLIENT, DAEMON_DISAPPEARED) | E2 entry | — |
| ACQ-5b | Record P5 post-invocation status: whether operator PM2 CLI children (§3.3 criteria) were absent at ACQ-3d | E2 annotation | pm2 CLI child present → LINGERING_CLIENT |

**Step ACQ-6 — Provenance and status record (publishable)**

| Item | Action | Output | Failure → |
|---|---|---|---|
| ACQ-6a | Write a publishable acquisition-status record containing only the fields in the **publication allowlist** (§5.5): observation ID; host (declared); timestamps (`T_obs_start`, `T_invoke`, `T_post_cmd`, `T_post`); stdout file SHA-256; observation-meta file SHA-256; exit status (integer); acquisition child PID (integer only — not command line, executable path, or arguments); pre/post daemon PID observations (integers); anomaly flags (from the fixed set in §3.5); E2 entry reference (scalar ID); attempt outcome (COMPLETED / FAILED / DEFERRED). **No raw values, no stderr content, no jlist content, no paths from the capture directory, no command lines, no executable paths, no env variable names or values** | status record (publishable class; may be committed) | — |

**Status separation (no status implies the next):**

| Status | Meaning | Decided by |
|---|---|---|
| Requirements specified | This freeze's §2–§6 text defines what a capture must satisfy | this document |
| Mechanism established | A capture mechanism implementing these requirements exists and has been verified | capture child LOCKED (§6.5), or a separately reviewed manual mechanism |
| Tools available / verified | Mechanism and standard tools exist on host | host confirmation at C-ACQ |
| Capture authorized (C-ACQ) | Keith authorizes executing the procedure on host H at time T with explicit scope | separate Keith authorization |
| Capture completed | Execution produced artifacts; client confirmed exited; output-writer boundary established; files finalized and hashed | execution |
| Capture validated | Verifier confirmed hash binding, schema, and comparison result | verifier run (C-VERIFY) |
| Comparison accepted | Keith accepted the P6 evidence record | Keith decision (C-HOST) |

### 2.2 Observation-meta schema alignment

The observation-meta JSON must conform exactly to `aisb.pm2-dual-env-observation-meta.v1` (VERIFY-01 §4.2):

```json
{
  "schema": "aisb.pm2-dual-env-observation-meta.v1",
  "observation_id": "<id>",
  "host": "<host>",
  "pm2_home": "<string, optional>",
  "daemon_pid": "<positive integer, optional>",
  "captured_at": "<timestamp>",
  "captured_by": "<non-empty string>",
  "acquisition_record": "<non-empty string>",
  "jlist_sha256": "<64 lowercase hex>"
}
```

**Field-by-field requirements:**

| Field | Required | Format | Source in the acquisition procedure | Verifier identity rules (l.862–893) |
|---|---|---|---|---|
| `schema` | yes | exact string `"aisb.pm2-dual-env-observation-meta.v1"` | literal | strict schema check |
| `observation_id` | yes | `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$` | operator-assigned unique ID | format check |
| `host` | yes | `^[A-Za-z0-9][A-Za-z0-9.-]{0,253}$` | operator-declared; must match the host the command ran on | `HOST_MISMATCH` if differs from reference. **Declared, not authenticated** |
| `pm2_home` | optional | non-empty string ≤ 4096 chars | from the confirmed target tuple (§3.2); must equal the target PM2 home used for socket checks and invocation. If the reference later declares `pm2_home`, **omission from the observation is rejected** (`PM2_HOME_MISSING_IN_OBSERVATION`, l.866–867). An unknown value should remain absent in retained unvalidated material, but omission cannot bypass the later identity requirement if the reference declares the field | `PM2_HOME_MISSING_IN_OBSERVATION` if reference declares and observation omits; `PM2_HOME_MISMATCH` if both declare and differ. Never echoed (boolean flags only) |
| `daemon_pid` | optional | positive integer | observed daemon PID from ACQ-1c pre-invocation observation. If the reference later declares `daemon_pid`, **omission from the observation is rejected** (`DAEMON_PID_MISSING_IN_OBSERVATION`, l.873–874). After IDENTITY_CHANGE: do not present the pre-invocation PID as authenticated identity of the returned data; the capture is anomalous and stays unusable pending separate resolution (§3.5) | `DAEMON_PID_MISSING_IN_OBSERVATION` if reference declares and observation omits; `DAEMON_PID_MISMATCH` if both declare and differ |
| `captured_at` | yes | `YYYY-MM-DDTHH:MM:SSZ` (UTC, no offset, no fraction) | see §2.4 | freshness checks (max-age, future-skew ≤ 300s, validity window) |
| `captured_by` | yes | non-empty string ≤ 1024 chars | operator identifier | format check; **never echoed** in reports |
| `acquisition_record` | yes | non-empty string ≤ 1024 chars | E2 host-ledger reference (e.g. entry ID) | format check; **never echoed** in reports |
| `jlist_sha256` | yes | `^[0-9a-f]{64}$` (64 lowercase hex) | SHA-256 of exact raw bytes of `stdout.raw` (ACQ-4a); only after client confirmed exited and output-writer boundary established | `JLIST_HASH_MISMATCH` if re-computed hash differs (Mode A) |

### 2.3 Byte-hash binding

**Rule HASH-1:** The SHA-256 recorded in `jlist_sha256` is computed over the **exact bytes** written to `stdout.raw`. No filtering, reformatting, newline normalization, character-set conversion, decode/re-encode, JSON pretty-printing, `jq` processing, or any other transformation may occur between the raw capture and the hash computation.

**Rule HASH-2:** The verifier (Mode A, l.1460–1463) reads the raw jlist file, computes `hashlib.sha256(raw_bytes).hexdigest()`, and compares to `jlist_sha256`. A mismatch is `JLIST_HASH_MISMATCH` (exit 2, `INVALID_INPUT`). The verifier decodes and parses **the same bytes** it hashed.

**Rule HASH-3:** No intermediate tool, script, or process may modify the raw bytes between capture and hash. The file must be opened read-only for hashing. If the output-writer/descriptor boundary has not been established, the file may still be open for writing; hashing is deferred (§2.1 ACQ-4 precondition).

**Rule HASH-4:** If the raw bytes contain a trailing newline added by the shell or PM2 client, that newline is part of the captured bytes and the hash. No normalization is applied.

### 2.4 Capture interval and `captured_at` semantics

A `pm2 jlist` invocation is **not** an instantaneous snapshot. The interval between `T_obs_start` (ACQ-1a) and `T_post_cmd` (ACQ-2d) bounds when the data could have been produced. The exact daemon-side read time within that interval is unknown.

**Distinct timestamps recorded:**

| Timestamp | When recorded | Purpose |
|---|---|---|
| `T_obs_start` | ACQ-1a: start of acquisition observation sequence | earliest bound; used for `captured_at` |
| `T_invoke` | ACQ-2a: immediately before the jlist command | marks the invocation |
| `T_post_cmd` | ACQ-2d: after client confirmed exited | latest bound of data production |
| `T_post` | ACQ-3a: start of post-observation sequence | marks the beginning of post-checks |

`T_obs_start` precedes several pre-observations (ACQ-1b–1e) and the invocation itself. It is **not** immediately before the invocation; `T_invoke` is.

**`captured_at` definition:** `T_obs_start` from ACQ-1a, truncated to whole seconds, formatted as `YYYY-MM-DDTHH:MM:SSZ`. This is a conservative choice: it is the earliest moment at which the operator asserts the acquisition sequence began. The observation-meta schema has a single `captured_at` field; the full interval bounds (`T_obs_start`, `T_invoke`, `T_post_cmd`, `T_post`) are carried in the E2 ledger and the acquisition-status record, not in the observation-meta JSON.

**What `captured_at` does not establish:** it does not prove the daemon was running at that time, that the data reflects state at that time, that no daemon restart occurred during the capture, or that the transport was instantaneous. The verifier's `non_claims.observation_authenticated=false` accurately reflects this.

### 2.5 B(H) independence

Acquisition does **not** require an already constructed B(H) reference document. Observations may precede reference construction. The later adoption of observation data as baseline expectations requires separate per-(app, key) Keith decisions under the adopted A2 provenance policy (BASELINE-GOV-01 Rule C-4: "an observation never becomes an expected baseline automatically").

---

## 3. Area B — PM2-client behavior and failure handling

### 3.1 Client side-effect model (carried from locked findings)

Carried directly from POLICY-01 §5.6, grounded in INVESTIGATION-01 §12.2. **No finding is softened, invented, or changed.**

| Effect | Applies to `jlist`? | Basis | Acquisition consequence |
|---|---|---|---|
| **Connection** to `rpc.sock`; auto-reconnect with backoff; no request timeout in the client path | **YES** | `Client.executeRemote` → `ReqSocket.send`; `Socket.connect` auto-reconnect (`sock.js` l.286–298); queue replay on connect (`queue.js`) | The acquisition `jlist` opens a connection. If the daemon is slow, the client may reconnect and replay queued messages. There is no client-side timeout to bound how long this takes |
| **Daemon auto-launch** if `pingDaemon` fails | **Possible** (not separately traced for `jlist`; treat as possible) | `Client.js` l.51–67; INVESTIGATION-01 §12.2 matrix row "Daemon absent" | If no daemon answers, the PM2 client **may** launch a new daemon from the client's environment. This is a mutation of host state |
| **Client env forwarding** into app's `pm2_env.env` | **NO** | merge at `ActionMethods.js` l.405 applies only to `restart --update-env` / `_operate` actions (`API.js` l.1361–1369) | `jlist` / `getMonitorData` is a read of live `pm2_env` references (`Methods.js` l.82); it does not construct `new_env` and does not merge |
| **Process on host** | **YES** | `pm2 jlist` spawns a Node process under the operator user; inherits the operator's full environment | The process exists during the invocation; it should exit after receiving the response |
| **Persistence to `dump.pm2`** | **NO** | only `pm2 save` / `dump` / `update` / signal-driven `gracefullExit` | `jlist` does not trigger persistence |

**Summary:** A `jlist` invocation is **not** side-effect-free. It creates a process, opens a connection, may auto-reconnect, may auto-launch a daemon, and has no client-side timeout. It does **not** merge or persist client environment. The verifier records `non_claims.acquisition_side_effect_free=false`.

### 3.2 Target selection

**Historical evidence (INVESTIGATION-01 §12.1.2, 2026-09-18; read-only SSH as `ubuntu` on `aisandbox-staging`):**

| Item | Observed value | Basis |
|---|---|---|
| **User** | `ubuntu` | INVESTIGATION-01 §12.1.1: "read-only SSH as `ubuntu`"; §12.1.2: daemon PID user `ubuntu` |
| **PM2_HOME** | `/home/ubuntu/.pm2` | §12.1.2: daemon title `God Daemon (/home/ubuntu/.pm2)`; boot banner `PM2 home : /home/ubuntu/.pm2` |
| **PM2 binary** | `/usr/lib/node_modules/pm2` (Node entry via `/usr/bin/node`) | §12.1.1: only pm2 install tree; no nvm/volta/fnm |
| **Daemon PID** | 844871 (at inspection 2026-09-18) | §12.1.2: `pgrep -af "God Daemon"` → 844871; started 2026-09-11 |
| **IPC socket** | `/home/ubuntu/.pm2/rpc.sock` | §12.1.2: `srwxrwxr-x ubuntu ubuntu … rpc.sock` |

**These are historical observations, not proof of current identity.** The daemon may have restarted, been reinstalled, or changed since the investigation date. This freeze does not perform live verification.

**Required target tuple (confirmed at C-ACQ time, not by this documentation window):**

| Parameter | Requirement |
|---|---|
| **Account** | The user account under which the PM2 daemon runs. Must be confirmed by a separately authorized live observation before invocation. Historical evidence suggests `ubuntu` |
| **PM2 binary** | The resolved path to the `pm2` executable. The capture mechanism must invoke this specific binary, not rely on PATH resolution or a default. Must be confirmed before invocation |
| **PM2_HOME** | The PM2 home directory. Must equal the home used by the running daemon. Historical evidence suggests `/home/ubuntu/.pm2`. The same PM2_HOME governs: (a) passive socket checks in ACQ-1, (b) the `pm2 jlist` invocation (client connects to `${PM2_HOME}/rpc.sock`), and (c) the `pm2_home` field in observation-meta. All three must use the same value |
| **Daemon identity** | Daemon PID, confirmed by passive observation (§3.3) at ACQ-1 time. Historical PID 844871 is not current evidence. **Daemon must be present** — see §7.1 |
| **Socket path** | `${PM2_HOME}/rpc.sock`. Derived from PM2_HOME; not independently selectable |

**Blocking conditions:** Missing, ambiguous, multiple, or inconsistent values in the target tuple block invocation. If the daemon cannot be found, or if the observed PM2_HOME / binary / socket path are inconsistent with each other, ACQ-1 records the inconsistency and stops. Do not fall back to a different PM2_HOME, a different binary, or a default path without explicit Keith authorization.

### 3.3 P5 filtering criteria and process identification

The P5 attestation (POLICY-01 §5.2) requires: "Operator-owned `pm2 restart … --update-env` / `jlist` children absent — process-table listing filtered to the operator user and `pm2` argv (names only)." The following criteria distinguish the relevant processes.

**Daemon process (not a CLI child; excluded from P5 CLI-child count):**

The PM2 daemon is identifiable by "God Daemon" in its command line (INVESTIGATION-01 §12.1.2: title `PM2 v7.0.3: God Daemon (/home/ubuntu/.pm2)`). The daemon is **not** a CLI child — it is the long-running server process. It is observed in ACQ-1c/ACQ-3b for identity, not counted as a P5 CLI child.

**PM2 CLI children (the P5-relevant processes):**

PM2 CLI processes (`pm2 jlist`, `pm2 restart`, etc.) are Node processes with `pm2` in their command line but **without** "God Daemon". These are the processes P5 checks for absence.

**The observation command itself:** Process-table observation tools (pgrep, ps, etc.) are not PM2 processes and must be excluded from the filter results. The capture mechanism must implement this exclusion correctly (e.g. exclude its own PID, exclude commands that do not match `pm2` argv).

**The acquisition jlist client:** During ACQ-2, the `pm2 jlist` process is a CLI child with a known identity (recorded in ACQ-2b). At ACQ-1e (before invocation), it does not exist. At ACQ-3d (after invocation), it should not exist (it should have exited). If it still exists at ACQ-3d, that is LINGERING_CLIENT.

**PID-reuse limitation:** A PID observed in ACQ-1c may be reused by the kernel for a different process between ACQ-1 and ACQ-3. Equal pre/post PID does not guarantee daemon continuity; it is a point-in-time comparison that reduces but does not eliminate uncertainty about daemon identity change. This limitation is inherent to PID-based observation.

### 3.4 Bounded invocation, monitoring, and termination (requirements)

The capture mechanism must enforce these requirements:

1. **Single invocation.** Exactly one `pm2 jlist` command per acquisition attempt. No retries without explicit scope (§7 Q3).

2. **Target enforcement.** The mechanism must invoke the confirmed PM2 binary, under the authorized account, with `PM2_HOME` set to the confirmed target. Ambiguous or missing target evidence must refuse to launch.

3. **Child identity recording.** The mechanism must record the exact identity of the launched child process for monitoring and signal targeting. The identity must be established at launch time before any monitoring begins.

4. **Bounded monitoring and escalation.** 30-second wall-clock deadline from `T_invoke`. The monitoring/escalation sequence must not block in a way that prevents later deadlines from being enforced (e.g. a blocking wait after SIGTERM must not prevent the SIGKILL deadline):
   - If the child has not exited within 30 seconds: send SIGTERM to the identified child only.
   - If the child has not exited within 5 seconds after SIGTERM: send SIGKILL to the identified child only.
   - If the child has not exited within 5 seconds after SIGKILL: **KILL_FAILED** (§3.5). Do not escalate to daemon or other processes.
   - **No broad signals.** No `pkill`, no daemon PID targeting, no process-group kills, no signals based on command-line substring matching alone.
   - **No unsafe identity inference.** A command-line containing "pm2" does not alone establish original-child identity. Successful `kill` return status does not alone prove correct process identity (PID may have been recycled).

5. **Exit-status collection.** After the child exits, collect its integer exit status. The mechanism must handle non-zero exit without bypassing evidence/status recording.

6. **Output-writer/descriptor boundary.** Before final hashing, the mechanism must establish that no process holds the output file descriptors open. Client exit alone does not establish this (another process may have inherited the descriptors). If the boundary cannot be established, retain an unresolved finalization status and do not treat the hash as a capture-integrity hash.

7. **Failure during monitoring infrastructure.** If a PID-record write or status-record write fails after the child has been successfully launched, the mechanism must not abandon the live child. It must still attempt monitoring, escalation, and evidence preservation.

8. **No mutation commands.** No `restart`, `reload`, `start`, `stop`, `delete`, `save`, `update`, `resurrect`, `kill` (of daemon), `--update-env`, or any other PM2 command is authorized.

9. **Internal client behavior.** The PM2 client may internally reconnect and replay queued messages (§3.1). This is not a procedure-level retry; it cannot be prevented without modifying the client.

**Client exit and daemon-side state:** Client exit by any cause (normal completion, SIGTERM, SIGKILL) does **not** establish that the daemon cancelled any in-progress work, completed its response, flushed any buffer, or is quiescent. The daemon's state after client termination is unknown.

### 3.5 Failure handling matrix

**Before invocation (ACQ-1 / attempt-directory setup):**

| Condition | Detection | Handling | HOLD effect |
|---|---|---|---|
| **STORAGE_FAILURE_BEFORE_INVOCATION** | Attempt-directory creation fails, ownership/permission check fails, or pre-observation file write fails | **STOP.** No PM2 invocation. Record the failure in E2 (the E2 entry states no invocation occurred). Preserve any already-created attempt-directory contents and partial pre-observation artifacts (they may contain diagnostic information) | HOLD unchanged |
| **DAEMON_ABSENT** | Process-table filter returns no match; socket absent or stale | **STOP** (Q1-A; §7.1). Do not invoke. Record DAEMON_ABSENT in E2 | HOLD unchanged |
| **TARGET_INCONSISTENT** | PM2_HOME, binary, socket, or daemon identity are missing, ambiguous, or inconsistent (§3.2) | **STOP.** Record inconsistency. No invocation | HOLD unchanged |
| **P5_NOT_SATISFIED** | Operator PM2 CLI child found at ACQ-1e (§3.3 criteria) | **STOP.** Record in E2. No invocation | HOLD unchanged |
| **OBSERVATION_TOOL_FAILURE** | Process-table observation tool itself fails (error return, not merely empty result) | **STOP.** Record tool failure. Do not treat as "no children found" or "no daemon" | HOLD unchanged |

**During/after invocation (ACQ-2 / ACQ-3):**

| Condition | Detection | Handling | Evidence | HOLD effect |
|---|---|---|---|---|
| **IDENTITY_CHANGE** | ACQ-3b daemon PID differs from ACQ-1c | Preserve all artifacts. Record IDENTITY_CHANGE in E2. **Capture is anomalous** — do not present the pre-invocation PID as authenticated identity of the returned data. Require separate Keith decision | all files preserved; anomalous | HOLD; E5 invalidation |
| **DAEMON_DISAPPEARED** | Daemon present at ACQ-1 but absent at ACQ-3 | Same as IDENTITY_CHANGE. May indicate daemon crash or auto-launch of a replacement. Preserve, record, require decision | all files preserved; anomalous | HOLD |
| **TIMEOUT** | Child not exited within 30s | Escalation per §3.4. If child eventually exits: establish output-writer boundary before hashing. Record TIMEOUT, signal, exit status in E2. Partial output is not usable for verification | partial files preserved; hashed only after output-writer boundary established | HOLD |
| **KILL_FAILED** | SIGKILL did not terminate within 5s, or PID recycled | Files may still be held open. **Do not hash, finalize, or reuse.** Preserve as potentially-changing material. Record KILL_FAILED in E2. **Stop.** No further acquisition action. No daemon kill | files preserved as potentially-changing | HOLD; process state unknown |
| **NON_ZERO_EXIT** | exit code ≠ 0, no timeout | Preserve files. Record exit status in E2. Output may be empty, partial, or error. Not usable for verification until validated. Hash only after output-writer boundary established | files preserved; hashed after boundary established | HOLD unchanged |
| **MALFORMED_OUTPUT** | Discovered when verifier later runs | Raw file preserved with hash. Verifier rejects with `JLIST_NOT_LIST` or parse error. Not detected during acquisition (deferred validation) | raw file preserved | HOLD unchanged |
| **DISCONNECT** | Client exits abnormally; partial output | Same as TIMEOUT handling. Preserve partial files. Record in E2 | partial files preserved | HOLD |
| **LINGERING_CLIENT** | PM2 CLI child present at ACQ-3d (§3.3) | Record in E2. Acquisition is **suspect**. Require separate decision. No automatic client or daemon cleanup | all artifacts preserved | HOLD; E5 evaluation |
| **STORAGE_FAILURE_DURING** | Write error on stdout/stderr during invocation, or hash/meta file creation fails after | If invocation already started: preserve whatever partial files exist. Incomplete evidence must not become a successful capture. Record in E2 with available information | partial artifacts | HOLD unchanged |
| **AUTO_LAUNCH_SUSPECTED** | Daemon present at ACQ-1 but identity changed or daemon disappeared and reappeared at ACQ-3, consistent with the residual auto-launch race (§3.6): daemon may have exited during invocation and client may have auto-launched a replacement. A changed PID or socket observation supports the suspicion but cannot prove auto-launch occurred or identify its cause. Same-PID replacement is not detected (§3.3). Set alongside IDENTITY_CHANGE or DAEMON_DISAPPEARED when the pattern is consistent with auto-launch | Preserve all artifacts. Record AUTO_LAUNCH_SUSPECTED with the accompanying condition. Keep HOLD. Require separate Keith decision. No cleanup, restart, or kill | all artifacts; anomalous | HOLD; host mutation suspected |

### 3.6 Invocation side effects and the auto-launch boundary

**Pre-check rule (Q1-A, the only available option; §7.1):** If ACQ-1 finds no daemon (DAEMON_ABSENT), the procedure stops and does not invoke `pm2 jlist`. This eliminates the scenario of invoking against a known-absent daemon — the primary auto-launch path.

**Residual race:** A successful pre-check does **not** guarantee that the daemon remains available when the PM2 client connects. The daemon could exit between the pre-check and the connection attempt. If that occurs, the client may encounter no daemon and auto-launch.

**Post-check limitations:** ACQ-3 may detect a change (IDENTITY_CHANGE, AUTO_LAUNCH_SUSPECTED, DAEMON_DISAPPEARED) but cannot undo side effects already produced.

**No strict no-daemon-creation mechanism:** No known PM2 client flag, API option, or supported mechanism establishes a strict guarantee that the invocation will not create a daemon. If strict no-daemon-creation is required, that route is **blocked** pending new evidence. This freeze does not invent a flag, unsupported API, or fence.

**No automatic recovery action:** No daemon stop, restart, kill, cleanup, or other mutation is an automatic response to any condition. AUTO_LAUNCH_SUSPECTED and IDENTITY_CHANGE require separate Keith decisions. There is no automatic retry or remediation.

**Procedure adoption and risk:** Adopting this requirements contract (C-ADOPT) accepts **no** current invocation risk, **no** mutation authorization, and **no** P7 risk. The residual auto-launch race is a constraint on later operational authorization (C-ACQ): when authorizing a specific acquisition, Keith accepts the residual race described here.

### 3.7 Retry and fresh-attempt constraints

**Retry** (additional invocation under the same C-ACQ authorization):

No retry is authorized by default. If the first invocation fails (any condition in §3.5), the operator records the failure in E2 and stops. A retry under the existing C-ACQ requires all of:

- Q3-B selected at C-ADOPT (if Q3 is UNRESOLVED or Q3-A, the adopted contract has no retry provision and no retry is permitted under the existing C-ACQ)
- the existing C-ACQ's explicit invocation/attempt scope includes this retry
- a new observation ID and a new attempt directory
- all conditions re-evaluated from ACQ-1 (fresh pre-observations)
- P4/P5 still valid at the retry's pre-check time
- no E5 invalidation event since the first attempt
- the failed attempt's directory and artifacts preserved (not overwritten, deleted, or reused)
- the retry recorded as a separate E2 entry referencing the prior failed attempt

**Fresh attempt under a new C-ACQ** (not a retry):

A separate C-ACQ authorization constitutes a fresh attempt, not a retry. It is permitted regardless of Q3, subject to:

- its own explicit invocation/attempt scope
- fresh P4/P5 evidence
- all §2.1 prerequisites re-satisfied independently
- preservation of all earlier attempt directories and artifacts
- its own observation ID, attempt directory, and E2 entry
- no E5 invalidation event

Q3-A (NO_RETRY) does not prevent a fresh attempt under a new C-ACQ. Silence (Q3 UNRESOLVED) does not authorize any attempt; each C-ACQ must state its own explicit scope.

---

## 4. Area C — Authorization and sequencing

### 4.1 Authorization stages (distinct; each requires separate Keith authorization)

| Stage | What it authorizes | What it does NOT authorize | Prerequisites |
|---|---|---|---|
| **C-ADOPT** | Adopts the text of this requirements contract and its authorization boundary. Q1 resolved | execution; STAGING; PM2; runtime; tool transfer; verifier live use; B(H) construction; host-evidence acceptance; no invocation risk accepted | this freeze reviewed; Q1 resolved; Step 3 authorized |
| **C-ACQ** | Executing the procedure on a specific host, at a specific time, for a specific app set. Keith specifies the exact invocation/attempt scope (number of invocations authorized and any retry conditions). Keith accepts the residual auto-launch race (§3.6) for authorized invocations | verifier run; reference construction; P7 acceptance; EXEC-01C6A reopen; canary | C-ADOPT; Q2 resolved; established and verified capture mechanism available (§6.5 child LOCKED + transferred); explicit invocation/attempt scope stated; target tuple confirmed; host tool availability confirmed; P4/P5 evidence externally supplied (§4.2, including journal-applicability resolution); STAGING/PM2 owned; E1/E2 ready |
| **C-TOOL-REG** | Registering an implementation child for a capture mechanism | implementing, testing, or transferring the child | C-ADOPT; Q2=TOOLING selected |
| **C-TOOL-IMPL** | Implementing and testing the child | transferring to host | C-TOOL-REG |
| **C-TOOL-TRANSFER** | Transferring the verified child to the host | using it for a capture (C-ACQ) | C-TOOL-IMPL complete and LOCKED |
| **C-VERIFY** | Running `compare_dual_env.py` against real data | host-evidence acceptance; EXEC-01C6A reopen | verifier LOCKED; NOT APPROVED FOR LIVE USE lifted; B(H) constructed; acquisition completed (raw files + meta produced; output-writer boundary established; files finalized) |
| **C-REF** | Building B(H) reference document under A2 policy | acquisition; verifier run | A2 ADOPTED; per-key provenance decisions; I-4/I-5 resolved or accepted |
| **C-HOST** | P4/P5 accepted; P6 record accepted; P7 attestation given | EXEC-01C6A reopen (also needs P8) | C-VERIFY completed; all evidence reviewed |
| **C-REOPEN** | Reopening EXEC-01C6A (satisfying the reopen gate) | canary execution | host gate satisfied; EXEC-01C6A amendment if C1; C-HOST completed |
| **C-CANARY** | Admitting and executing the canary submission | — | C-REOPEN; runtime mutexes acquired |

Each stage is independently authorized. No stage implies the next. A decision to adopt the requirements contract (C-ADOPT) carries no runtime authorization and no invocation risk.

### 4.2 P4/P5 evidence requirements

The P4 and P5 attestations require evidence that this acquisition procedure does not itself produce. The locked P4 form (POLICY-01 §5.1) references: E2 ledger showing no other operator run; `.run.lock` holder status for the registered vault (E1); board confirmation of exclusive STAGING/PM2. The locked P5 form (§5.2) references: journal cross-check for DISPATCHED attempts.

**Vault/journal reads are outside this procedure's scope** (§5.6 prohibits vault/journal access). Therefore:

| P4/P5 evidence item | How supplied | This procedure's role |
|---|---|---|
| E2 ledger: no other operator run | Operator reviews E2 before acquisition | this procedure records the acquisition's own E2 entry; does not read or verify prior entries |
| `.run.lock` holder status | Externally supplied finding: the authorized task confirms `.run.lock` status before granting C-ACQ | this procedure does not read `.run.lock` |
| No other STAGING/PM2 holder | TASKS.md board confirms no conflicting task | assessed at C-ACQ authorization |
| Journal cross-check | Externally supplied finding: the applicable journal evidence is reviewed under separate authorization before C-ACQ. This procedure does not read the journal, discover vaults, or determine journal applicability | this procedure does not read the journal |
| Process-table observation (P5) | This procedure performs the observation (ACQ-1e, ACQ-3d) using §3.3 criteria | directly performed |

**Journal-applicability status:** The locked P5 form references "every `DISPATCHED` attempt in the registered vault journal has a terminal." Whether a journal exists, whether recovery material exists independently of a designated vault, and whether the journal requirement applies to a first acquisition on a given (H, A) are questions this procedure does not answer. The locked contracts do not provide an explicit first-run P5 journal-applicability rule. Specifically:

- A1's amendment to first-run P2/P3 prerequisites does not itself amend P5.
- Neither the absence of a designated vault (no E1) nor the existence of an E1 entry proves that no applicable recovery material exists.
- This procedure does not discover vaults, inspect journals, or determine the presence or absence of recovery material.

Three possible states at C-ACQ time:

| State | Meaning | Effect on C-ACQ |
|---|---|---|
| **Applicable journal evidence supplied** | A separately authorized finding confirms the journal cross-check result (all DISPATCHED entries terminal, or UNCERTAIN entries listed) and supplies it as external evidence | P5 journal cross-check satisfied for this acquisition |
| **Explicitly determined inapplicable** | A separately authorized determination, citing its controlling authority, establishes that the P5 journal cross-check does not apply to this (H, A) at this time | P5 journal cross-check requirement removed for this acquisition by that authority |
| **Applicability / evidence unresolved** | Neither the journal evidence nor a controlling inapplicability determination has been supplied | **C-ACQ is blocked** on this unresolved P5 journal dependency |

This is an **unresolved dependency** on C-ACQ. The requirements contract (§2–§6) may still be adopted (C-ADOPT) independently; operational acquisition authorization (C-ACQ) remains blocked until the journal-applicability status is resolved by one of the first two states above.

### 4.3 P5 temporal structure and acquisition alignment

**Locked P5 text (POLICY-01 §5.2):**

> Operator-owned `pm2 restart … --update-env` / `jlist` children absent
>
> Evidence: process-table listing filtered to the operator user and `pm2` argv (names only), **at T1 and immediately before the P6 read**
>
> Stop condition: any operator `pm2` child present. Expiry: immediately after the P6 read completes (a later child invalidates it).

**Locked P5 contract (POLICY-01 §3 row P5):**

> Operator-owned PM2 CLI children for the overlay/restore commands are confirmed absent (process-table evidence of those operator children). This proves client absence, **not** daemon quiescence, and is therefore insufficient alone.

**Temporal structure:** P5 specifies assessment **"at T1 and immediately before the P6 read"** — discrete checkpoint times, not continuous monitoring. Expiry is **"immediately after the P6 read completes."** The P6 comparison procedure itself invokes `pm2 jlist` (§5.3 step 2) after confirming P5 at start (step 1). P5 frames the read: checked before, expired after.

**Acquisition alignment:**

| P5 element | In P6 comparison (POLICY-01 §5.3) | In acquisition |
|---|---|---|
| Pre-read check | "Confirm P4/P5 valid at start" (step 1) | ACQ-1e: no operator PM2 CLI children (§3.3) |
| The read | `pm2 jlist` (step 2) | ACQ-2: `pm2 jlist` |
| Post-read check | — | ACQ-3d: no operator PM2 CLI children |
| Expiry | "immediately after the P6 read completes" | after ACQ-2 client confirmed exited |

The acquisition procedure uses §3.3 filtering criteria to distinguish CLI children from the daemon process and from the observation commands themselves. The pre-invocation check (ACQ-1e) and post-invocation check (ACQ-3d) match the locked P5 checkpoint structure.

**No authorized-client exemption invented.** This analysis does not invent an "authorized-exempt" exception to P5. The P5 form specifies absence of specified CLI children at assessed checkpoints. The acquisition's `pm2 jlist` is the framed read; it does not exist at the checkpoint times (not yet launched at ACQ-1e; already exited at ACQ-3d). This is the same pattern as the P6 procedure, which also invokes jlist after P5 confirmation.

**Residual:** If Keith finds this checkpoint-based reading insufficient — that P5 requires continuous absence including during the authorized read — then a formal POLICY-01 amendment is required. Such an amendment is outside this task's registered scope and would be a dependency on C-ACQ.

### 4.4 Evidence assessed before, during, and after acquisition

| Evidence | Before (ACQ-1) | During (ACQ-2) | After (ACQ-3/4/5) |
|---|---|---|---|
| P4 (no concurrent overlay) | externally supplied (§4.2); subject to its validity/invalidation rules | not independently monitored by this procedure | ACQ-3 observes processes and socket holders only; this does not repeat the full P4 attestation (E2 review, `.run.lock` holder, governance confirmation per §4.2). Any required renewed P4 finding must be separately supplied |
| P5 (no operator PM2 CLI children, §3.3) | assessed at ACQ-1e (pre-read checkpoint) | acquisition client exists (the framed read) | assessed at ACQ-3d (post-read checkpoint) |
| Daemon identity | observed (PID via §3.3, socket) | unknown (client connected) | observed (PID comparison; §3.3 PID-reuse limitation applies) |
| Exit status | — | collected (§3.4) | recorded in E2 |
| Raw bytes | — | written to file | hashed only after output-writer boundary established |
| E2 ledger | prepared | — | completed |

### 4.5 Separation from P7

Nothing in this acquisition procedure accepts residual daemon-buffer risk (P7). The acquisition creates a jlist read; it does not attest that no buffered frame exists, that no UNCERTAIN attempt's fate is known, or that the daemon is quiescent. P7 remains `P7_ACCEPTED=NO`. Requirements-contract adoption (C-ADOPT) accepts no P7 risk.

---

## 5. Area D — Restricted evidence handling

### 5.1 Private attempt directory (requirements)

**Before any invocation**, the capture mechanism must create a private attempt directory satisfying:

- **Off-repo.** Not inside the repository working tree or any Git-tracked path.
- **Mode 0700.** Only the authorized user may read/write/list.
- **Exclusive creation.** The directory must be freshly created; creation must fail if the path already exists.
- **Verified ownership/permissions.** After creation, ownership and permissions must be verified before use.
- **No symlinks.** The directory path must not traverse symlinks.
- **Unique.** Each acquisition attempt gets its own directory. Retry attempts (§3.7) get separate directories.
- **No reuse.** A failed directory must not be reused.
- **Setup errors privately routed.** Setup error diagnostics must not be displayed on the terminal. If restricted logging cannot be established, only fixed safe diagnostics are emitted (§5.3).

If directory creation or verification fails: **STOP**. STORAGE_FAILURE_BEFORE_INVOCATION (§3.5). Do not invoke PM2.

### 5.2 File permissions and creation (requirements)

All files in the attempt directory must be created with mode 0600, from creation (no window of insecure permissions). File creation must refuse existing targets (no-overwrite). The capture mechanism must enforce this.

Files created in the attempt directory:

| File | Content class | Created by | Mode |
|---|---|---|---|
| `stdout.raw` | **RESTRICTED (class C)** — raw PM2 jlist; may contain secrets, env values, paths | capture mechanism in ACQ-2 | 0600 |
| `stderr.raw` | **RESTRICTED** — may contain error messages with paths, env hints, diagnostics | capture mechanism in ACQ-2 | 0600 |
| `observation-meta.json` | **RESTRICTED (verifier-input)** — declared host, pm2_home, captured_by, acquisition_record | capture mechanism in ACQ-4 (no text editor; §5.3) | 0600 |
| `pre-obs.log` | **RESTRICTED** — output of ACQ-1 commands | capture mechanism | 0600 |
| `post-obs.log` | **RESTRICTED** — output of ACQ-3 commands | capture mechanism | 0600 |
| `hash.log` | **RESTRICTED** — hash output | capture mechanism in ACQ-4 | 0600 |
| child-identity, timestamps, status | operational | capture mechanism | 0600 |

### 5.3 Console and disclosure rules (requirements)

| Rule | Requirement |
|---|---|
| **No console echo — any command** | Every command in the acquisition sequence must have its stdout and stderr routed to private log files in the attempt directory. No output displayed on the terminal, in scrollback, or in shell history. This includes setup commands, observation tools, hashing tools, and syntax-check tools |
| **No text editor** | Do not use an interactive text editor (vim, nano, emacs, etc.) to construct the observation-meta JSON. Editors create temporary files (`.swp`, `~backup`, `#autosave#`) that may contain sensitive data in locations outside the attempt directory |
| **No public artifact** | Raw files, stderr, observation-meta, and log files must not be uploaded, committed, pasted, or transferred |
| **No chat/log disclosure** | No raw value, env content, secret, token, or path from any captured file in chat, console, governance records, or Git |
| **Private routing for all tools** | All observation, hashing, validation, and diagnostic tools must have their output privately routed. Fixed diagnostic text only for the operator: pass/fail indicators, signal status. Not raw file content |

**If private logging is unavailable** (attempt directory not writable, filesystem full): only fixed safe diagnostics may be emitted. The set of permitted safe diagnostics must be defined by the capture mechanism. They must contain no captured data, no file paths from the attempt directory, and no environment content. The operator records the failure in E2.

### 5.4 Integrity and retention

| Requirement | Specification |
|---|---|
| **No modification after capture** | Raw files are not edited, filtered, reformatted, or truncated after capture. Hash is computed over original bytes after output-writer boundary established |
| **No finalization without boundary** | If the output-writer/descriptor boundary is not established, files are preserved with unresolved finalization status; no hash is recorded as a capture-integrity hash; no observation-meta is constructed from those files |
| **Attempt-directory isolation** | Each attempt has its own directory. Retry attempts have separate directories. Failed-attempt directories are preserved intact |
| **Retention** | Acquisition artifacts are retained for subsequent authorized steps. Retention is **distinct** from immutable recovery-material retention (POLICY-01 §4.3 / §6.2) |
| **Transfer boundaries** | Raw files may be supplied to a later authorized verifier run on the same host. Not transferred off-host without explicit authorization |

### 5.5 LEDGER_ONLY compliance and publication allowlist

Per BASELINE-GOV-01 §14.2 D7 (LEDGER_ONLY): governance records carry reference IDs and file hashes only. No token value, raw env value, or secret.

**Publication allowlist** (the only fields permitted in the acquisition-status record, ACQ-6a): observation ID; host (declared); timestamps (`T_obs_start`, `T_invoke`, `T_post_cmd`, `T_post`); stdout file SHA-256; observation-meta file SHA-256; exit status (integer); acquisition child PID (integer only — not the command line, executable path, arguments, or full process identity structure); pre/post daemon PID observations (integers); anomaly flags (from the fixed set in §3.5); E2 entry reference (scalar ID); attempt outcome (COMPLETED / FAILED / DEFERRED).

**Prohibited in publishable records:** raw jlist content, stderr content, environment variable names or values, token values, file paths from the capture directory, command lines, executable paths, process arguments, and any other unrestricted text from the capture. LEDGER_ONLY requires that governance records reference captured material by ID and hash only.

### 5.6 Existing material

This procedure does **not** authorize: reading `dump.pm2`; reading `.env`, ecosystem, systemd configuration; reading vault, journal, marker, or `.run.lock` files; deleting, rotating, or modifying existing recovery material; accessing `/proc/<pid>/environ`.

Any fact dependent on these sources is a separate prerequisite. The observation-meta's `pm2_home` field comes from the confirmed target tuple (§3.2), which is based on prior authorized observations or operator knowledge, not reads performed under this procedure.

---

## 6. Area E — Mechanism assessment and proposed tooling dependency

### 6.1 What the requirements demand

The acquisition requirements (§2–§5) demand controls including:

1. Enforcing the authorized account, resolved executable, and PM2_HOME.
2. Refusing ambiguous/missing target evidence.
3. Secure fresh attempt storage with no-overwrite file creation.
4. Private stdout/stderr routing for all commands, including setup and failure paths.
5. Fixed safe diagnostics if restricted logging cannot be established.
6. Recording and supervising the exact launched child identity.
7. Bounded monitoring/escalation that cannot block before later deadlines.
8. No broad signals, daemon signals, or unsafe identity inference.
9. Handling launch success followed by ledger/PID/status-write failure without abandoning a live client.
10. Preserving all partial evidence; distinguishing live/potentially-changing files from finalized evidence.
11. Establishing the output-writer/descriptor boundary before final hashing, or retaining an unresolved finalization status.
12. Exact-byte hashing, metadata construction, and restricted outputs.
13. Correct handling of expected absence versus observation-tool failure.
14. No automatic retry, cleanup, host correction, or baseline adoption.

### 6.2 What exists today

| Mechanism | Status | Location |
|---|---|---|
| `pm2 jlist` command | assumed available on host (not confirmed by this documentation window) | host |
| Standard Linux tools | availability assumed but **not confirmed** by this freeze or prior locked evidence | host |
| Python 3 | **not confirmed on the target host.** The verifier's test suite (VERIFY-01) ran on a GitHub-hosted runner, not on the staging host. Host Python availability is a later prerequisite | host (unconfirmed) |
| Locked verifier (`compare_dual_env.py`) | COMPLETE AND LOCKED; NOT APPROVED FOR LIVE USE | `ops/pm2-recovery-verify/` |
| Capture mechanism implementing §6.1 | **does not exist** | — |
| Observation-meta template | **does not exist** | — |

**Host tool availability is a prerequisite for C-ACQ**, not established by this freeze.

### 6.3 Mechanism assessment

**Verdict: `MANUAL_MECHANISM_NOT_ESTABLISHED`.**

The requirements in §6.1 have not been demonstrated satisfiable by the evidence in this freeze. Specifically:

- No mechanism has been shown to enforce target-tuple identity (authorized account, resolved binary, PM2_HOME) rather than relying on ambient PATH/HOME.
- No mechanism has been shown to create files with no-overwrite guarantees rather than truncating existing files.
- No mechanism has been shown to supervise a launched child, enforce non-blocking escalation deadlines, or correctly distinguish signal-delivery success from process-identity confirmation.
- No mechanism has been shown to establish the output-writer/descriptor boundary (confirming no inherited descriptor remains open in another process) before hashing.
- No mechanism has been shown to privately route setup errors or to handle expected-absence tool results versus tool failures under strict error handling without bypassing evidence recording.
- No mechanism has been shown to handle a PID-record write failure after a successful child launch without abandoning the live child.

These are mechanism gaps, not requirement gaps. The requirements (§2–§5) stand as a contract. The missing item is a verified implementation of those requirements.

### 6.4 When would a manual mechanism become available?

A manual mechanism could become available if a separately reviewed procedure concretely demonstrates each control in §6.1 and its failure paths are walked through against the requirements. This freeze does not contain such a demonstration. If one is later proposed, it would require its own review before being accepted as satisfying C-ACQ mechanism readiness.

### 6.5 Proposed follow-on dependency: bounded capture child

**Nature:** A separately authorized implementation child to implement the §6.1 controls.

**Required acceptance criteria (future; not implemented here):**

- Enforce the authorized account, resolved executable, and PM2_HOME; refuse ambiguous/missing target evidence.
- Secure fresh attempt storage and no-overwrite file creation.
- Private stdout/stderr routing, including setup and failure paths.
- Fixed safe diagnostics if restricted logging cannot be established.
- Record and supervise the exact launched child identity.
- Bounded monitoring/escalation that cannot block before later deadlines.
- No broad signals, daemon signals, or unsafe identity inference.
- Handle launch success followed by ledger/PID/status-write failure.
- Preserve all partial evidence; distinguish live/potentially-changing files from finalized evidence.
- Establish the output-writer/descriptor boundary before final hashing, or retain an unresolved finalization status.
- Exact-byte hashing, metadata construction, and restricted outputs.
- Correct handling of expected absence versus observation-tool failure.
- No automatic retry, cleanup, host correction, or baseline adoption.
- **Fake-only verification** of normal and failure paths before any transfer or operational use.

**Not decided here:** implementation language, build system, test framework, file structure, registration timing, or admission. No child is registered, implemented, or admitted by this freeze.

**Lifecycle:** C-TOOL-REG → C-TOOL-IMPL (with fake-only tests) → C-TOOL-TRANSFER → available for C-ACQ. Each stage separately authorized.

### 6.6 Missing mechanisms summary

| Missing mechanism | What requirement needs it | Minimum follow-on scope | Blocked until established |
|---|---|---|---|
| **Capture child** (§6.5) | All §6.1 controls | separately authorized implementation child with fake-only verification | **C-ACQ is blocked** on mechanism readiness |
| **Observation-meta template** | Reduced schema-compliance risk | JSON template with placeholders | nothing blocked; reduces risk |
| **Host tool confirmation** | Tool availability (§6.2) | separately authorized live observation confirming tool versions | **C-ACQ is blocked** until confirmed |
| **Verifier live-use authorization** | Running verifier against real data | separate authorization | **validation** of captured data is blocked |

---

## 7. Decision matrix

### 7.0 Decision structure

Three questions (Q1–Q3) for Keith. The P5 checkpoint analysis (§4.3) is presented for review, not as a decision with options.

**Settled decisions NOT re-asked:** A1, A2, D7, I-1, AM-1 through AM-5 (BASELINE-GOV-01 §14).

### 7.1 Q1 — Daemon-present pre-check rule

**Context:** If ACQ-1 finds no daemon, invoking jlist risks auto-launch (§3.6). Even if present, a daemon may exit before the client connects (residual race).

| Option | Prerequisites | Effect | Non-effects | Constraints |
|---|---|---|---|---|
| **Q1-A: ABORT_IF_ABSENT** | none | DAEMON_ABSENT → stop. No invocation. Eliminates the primary auto-launch scenario. The residual race remains | does not provide a strict no-auto-launch guarantee; does not prove daemon continuity; does not accept invocation risk (acceptance is at C-ACQ) | — |
| **Q1-B: PROCEED_WITH_RISK** | — | — | — | **Unavailable in this requirements contract.** The target tuple (§3.2) requires a present daemon. Invocation against a known-absent daemon contradicts the target requirement and produces near-certain auto-launch (a host mutation). No mechanism in this contract addresses absent-daemon invocation safely. Absent-daemon operation is a separately scoped decision requiring its own analysis of target-identity relaxation, auto-launch consequences, and mutation acceptance. It is not offered as a procedure option here |
| **Q1-C: UNRESOLVED** | — | Requirements contract cannot be adopted (Q1 determines abort conditions) | blocks C-ADOPT |

**Refusal handling:** If Keith records none of Q1-A/C, Q1 is UNRESOLVED and the requirements contract cannot be adopted.

### 7.2 Q2 — Capture mechanism

**Context:** §6.3 determines that the manual mechanism is not established (`MANUAL_MECHANISM_NOT_ESTABLISHED`). §6.5 proposes a capture child as the follow-on dependency.

| Option | Prerequisites | Effect | Non-effects |
|---|---|---|---|
| **Q2-A: MANUAL** | — | — | **Unavailable.** No manual mechanism satisfying §6.1 has been established. If a separately reviewed manual mechanism is later demonstrated and accepted, Q2-A may be reconsidered. Until then, it cannot satisfy C-ACQ mechanism readiness |
| **Q2-B: TOOLING** | none beyond this freeze for selection at C-ADOPT | Q2-B may be selected now; no child need exist yet. The child lifecycle (C-TOOL-REG → C-TOOL-IMPL → C-TOOL-TRANSFER) is a prerequisite for C-ACQ, not for selecting Q2-B. C-ACQ is blocked until the child is registered, implemented with fake-only verification, LOCKED, and transferred to host | does not block C-ADOPT; blocks C-ACQ until tooling is LOCKED and transferred |
| **Q2-C: UNRESOLVED** | — | The mechanism decision is deferred. C-ACQ cannot proceed until Q2 is resolved | does not block C-ADOPT |

**Refusal handling:** If Keith records nothing, Q2 is UNRESOLVED and C-ACQ cannot proceed.

### 7.3 Q3 — Retry scope

**Context:** If the first invocation fails (§3.5), should one retry be authorized?

| Option | Prerequisites | Effect | Non-effects |
|---|---|---|---|
| **Q3-A: NO_RETRY** | none | Any failure stops the acquisition. A new attempt requires a separate C-ACQ authorization with fresh P4/P5 | does not prevent a future separately-authorized attempt; does not discard failed artifacts |
| **Q3-B: ONE_BOUNDED_RETRY** | P4/P5 still valid at retry; no E5 event; first-attempt artifacts preserved; retry has new observation ID, new attempt directory, new E2 entry | One additional invocation permitted within the same C-ACQ window | does not authorize unlimited retries; does not waive P4/P5 re-check; the retry is itself a separately authorized invocation under the same C-ACQ scope |
| **Q3-C: UNRESOLVED** | — | Retry scope is not decided. If the first attempt fails, no retry is authorized until Q3 is resolved separately | **UNRESOLVED is not NO_RETRY.** Q3-A is a deliberate policy choice; silence is the absence of a choice. UNRESOLVED is recorded as UNRESOLVED |

**Refusal handling:** If Keith records nothing, Q3 is **UNRESOLVED**. This does not default to Q3-A. UNRESOLVED means the adopted contract has no retry provision. A later C-ACQ must independently specify its own invocation/attempt scope; if it does not, execution is blocked.

**Reconciliation with C-ACQ:** C-ACQ (§4.1) must specify an explicit invocation/attempt scope. Q3 governs the general retry-policy choice adopted at Step 3. These are distinct:

- **Q3** (decided at C-ADOPT): establishes whether the adopted contract text permits a bounded retry at all, and under what conditions.
- **C-ACQ invocation scope** (decided at each operational authorization): specifies exactly how many invocations are authorized and any retry conditions for this particular acquisition. This is an explicit field in the authorization, not inferred from Q3 or from silence.

If Q3 is UNRESOLVED at C-ADOPT time, the adopted contract has no retry provision; a later C-ACQ may still explicitly authorize exactly one invocation with no retry, but it must say so — it cannot rely on silence implying one shot. If no explicit invocation/attempt scope is supplied in C-ACQ, **execution is blocked**. No retry is implied by authorization of the first invocation.

### 7.4 Recommended package (UNADOPTED)

| Question | Recommended value | Rationale |
|---|---|---|
| Q1 | **Q1-A: ABORT_IF_ABSENT** | eliminates the primary auto-launch scenario; consistent with target-tuple daemon requirement |
| Q2 | **Q2-B: TOOLING** | manual mechanism not established; a verified capture child is the smallest path to C-ACQ readiness |
| Q3 | **Q3-A: NO_RETRY** | conservative; failure investigation more valuable than immediate retry |

**This package is UNADOPTED.** Adopting it adopts requirements-contract text only (C-ADOPT). No execution, runtime, invocation risk, mutation, STAGING, PM2, verifier live use, B(H) construction, host-evidence acceptance, EXEC-01C6A reopen, canary, or mechanism implementation is authorized by the package or by Step 3. C-ACQ remains blocked on mechanism readiness (§6.5 child lifecycle) and all other operational prerequisites.

### 7.5 Decision dependencies

| Question | Blocks C-ADOPT? | Blocks C-ACQ? | Notes |
|---|---|---|---|
| **Q1** | **YES** — determines abort conditions | YES — selected rule governs each invocation | Q1-B unavailable (§7.1) |
| **Q2** | NO | **YES** — Q2-B blocks until child LOCKED + transferred; Q2-A unavailable; Q2-C blocks | — |
| **Q3** | NO | C-ACQ must independently specify invocation/attempt scope; Q3 UNRESOLVED means no retry provision in contract text; does not itself block C-ACQ if C-ACQ states explicit scope | independent of Q1/Q2 |
| **P5 checkpoint analysis** (§4.3) | NO | If Keith finds insufficient → formal POLICY-01 amendment required → blocks C-ACQ | not a Q; presented as analysis |
| **Mechanism readiness** (§6.5) | NO | **YES** — capture child must be LOCKED and transferred | — |
| **Host tool confirmation** | NO | **YES** — tools must be confirmed available | prerequisite for C-ACQ |
| **Target tuple** (§3.2) | NO | **YES** — must be confirmed and consistent; daemon present | prerequisite for C-ACQ |
| **P5 journal-applicability** (§4.2) | NO | **YES** — unresolved blocks C-ACQ | — |

### 7.6 Distinction of adoption levels

| Level | Meaning | Decided by |
|---|---|---|
| **Requirements adopted** (C-ADOPT) | §2–§6 text reviewed; Q1 resolved; requirements contract is the authorized specification | Step 3 |
| **Mechanism established** | Capture child LOCKED and transferred (§6.5); or a separately reviewed manual mechanism accepted | child lifecycle / separate review |
| **Tools available** | Mechanism and standard tools on host confirmed | host observation |
| **Acquisition authorized** (C-ACQ) | Keith authorizes execution on host H at time T for app set S with explicit invocation/attempt scope, accepting residual auto-launch race; Q2 resolved; P5 journal-applicability resolved; mechanism established | separate authorization |
| **Capture completed** | Client confirmed exited; output-writer boundary established; files finalized and hashed; E2 recorded | execution |
| **Capture validated** | Verifier confirmed hash/schema/comparison | verifier run (C-VERIFY) |
| **Comparison accepted** | Keith accepted P6 evidence | Keith decision (C-HOST) |

---

## 8. Static walkthrough

Requirements-level consistency checks. These walkthroughs verify that the requirements contract (§2–§5) is internally consistent for each scenario. They do **not** verify that a mechanism implementing these requirements exists or works correctly — that is the role of the capture child's fake-only verification (§6.5).

### 8.1 Normal capture (daemon present, Q1-A, Q2-B mechanism available, clean exit)

1. Attempt directory created (exclusive, mode 0700, verified). — requirement: §5.1
2. ACQ-1: daemon PID found via §3.3 criteria; socket present at target PM2_HOME; T_obs_start recorded. ACQ-1e: no PM2 CLI children (§3.3). — requirement: §2.1 ACQ-1
3. ACQ-2: T_invoke recorded. Confirmed binary invoked with PM2_HOME; stdout/stderr to separate private files (no-overwrite). Child identity recorded. Child exits normally. T_post_cmd recorded. Output-writer boundary established. — requirement: §3.4, §5.2
4. ACQ-3: same daemon PID (point-in-time; PID-reuse caveat applies). No lingering client at ACQ-3d. — requirement: §2.1 ACQ-3, §3.3
5. ACQ-4: hash computed after boundary established. observation-meta JSON constructed programmatically; syntax validated. Artifacts are unvalidated material until verifier runs. — requirement: §2.1 ACQ-4, §2.3
6. ACQ-5: E2 entry per POLICY-01 §4.4: command, exit status, fate=UNCERTAIN, timestamps, hashes. — requirement: §2.1 ACQ-5
7. ACQ-6: publishable status (observation ID, hashes, exit status, anomaly=none). — requirement: §2.1 ACQ-6

### 8.2 Missing daemon, Q1-A (ABORT_IF_ABSENT)

1. Directory created. — requirement: §5.1
2. ACQ-1: no daemon process found. DAEMON_ABSENT recorded.
3. **STOP.** No jlist. No auto-launch risk from this invocation. — requirement: §3.5, §7.1
4. E2: records DAEMON_ABSENT, no invocation. Attempt directory and pre-observation logs preserved. — requirement: §3.5

### 8.3 Identity change (daemon PID differs)

1. ACQ-1: PID observed. ACQ-1e: clean.
2. ACQ-2: exit 0; files captured. Output-writer boundary established.
3. ACQ-3: PID different. **IDENTITY_CHANGE.** Capture is anomalous — pre-invocation PID is not authenticated identity of the returned data. — requirement: §3.5
4. Artifacts preserved; anomalous. Require separate decision. No retry, no cleanup. — requirement: §3.5

### 8.4 Daemon replaced with same PID (PID-reuse)

1. ACQ-1: PID observed.
2. Between ACQ-1 and ACQ-3: daemon killed, kernel reuses same PID for a new daemon.
3. ACQ-3: PID same. Pre/post comparison shows no change. **Replacement is NOT detected.** — limitation: §3.3
4. No mechanism in these requirements detects same-PID replacement. The verifier's `non_claims.observation_authenticated=false` reflects this.

### 8.5 Timeout with bounded termination

1. ACQ-2: child hangs. 30s → SIGTERM (targeted) → 5s → child exits.
2. Exit status collected. Output-writer boundary established (after confirming no inherited descriptors). — requirement: §3.4
3. TIMEOUT recorded in E2. Partial output; not usable for verification. — requirement: §3.5

### 8.6 KILL_FAILED (child cannot be terminated)

1. ACQ-2: hangs. SIGTERM → 5s → SIGKILL → 5s → still alive. KILL_FAILED.
2. Files may still be held open. **No hash computed. No observation-meta constructed. No finalization.** Files preserved as potentially-changing material. — requirement: §3.5, §5.4
3. KILL_FAILED recorded in E2. Stop. No further action. No daemon kill. — requirement: §3.4

### 8.7 Storage failure before invocation

1. Directory creation fails (filesystem full). STORAGE_FAILURE_BEFORE_INVOCATION.
2. No PM2 invocation. E2 records the storage failure only. — requirement: §3.5
3. Any partial setup artifacts (e.g. partially created directory, fallback log) preserved. — requirement: §3.5

### 8.8 Storage failure during invocation

1. Child launched, but output file write fails mid-capture (disk full).
2. Partial stdout.raw exists. Child may still be running.
3. Monitoring continues per §3.4. After child confirmed exited: preserve partial files. Incomplete evidence does not become a successful capture. STORAGE_FAILURE_DURING in E2. — requirement: §3.5

### 8.9 Sensitive stderr

1. Child exits non-zero; stderr contains filesystem paths.
2. Stderr was captured to `stderr.raw` (mode 0600). Not displayed. — requirement: §5.3
3. E2: exit status (integer) and stderr file SHA-256 only. — requirement: §5.5

### 8.10 Hash mismatch (deferred detection)

1. ACQ-4a: hash computed correctly.
2. ACQ-4b: meta constructed with transcription error (possible under any mechanism).
3. ACQ-4c: JSON validates syntactically.
4. **Deferred detection:** mismatch found when verifier runs → `JLIST_HASH_MISMATCH`. Not detected during acquisition. Artifacts are unvalidated material. — requirement: §2.1 ACQ-4

### 8.11 Missing meta field (deferred detection)

1. Operator/mechanism omits `acquisition_record`.
2. JSON validates syntactically.
3. **Deferred:** verifier reports `MISSING_FIELD`. Artifacts are unvalidated material. — requirement: §2.1 ACQ-4

### 8.12 Auto-launch race (daemon exits between pre-check and invocation, Q1-A)

1. ACQ-1: daemon PID found. Pre-check passes.
2. Between ACQ-1 and ACQ-2: daemon exits.
3. ACQ-2: client encounters no daemon. May auto-launch. — limitation: §3.6
4. ACQ-3: daemon PID changed (IDENTITY_CHANGE + AUTO_LAUNCH_SUSPECTED) or daemon absent (DAEMON_DISAPPEARED). A changed PID supports suspicion but does not prove auto-launch or its cause. Same-PID replacement is not detected (§3.3). Artifacts preserved. Require Keith decision. — requirement: §3.5
5. Post-check detected change but cannot undo the auto-launch. — limitation: §3.6

### 8.13 Lingering client after invocation

1. ACQ-2 completes (exit 0, files captured).
2. ACQ-3d: observation finds a PM2 CLI child matching §3.3 criteria, identity ≠ recorded acquisition child. LINGERING_CLIENT.
3. This is an unrecorded PM2 client. Acquisition is suspect. Require separate decision. — requirement: §3.5

### 8.14 Observation-tool failure at ACQ-1e

1. Process-table observation tool itself fails (error return, not empty result).
2. **STOP.** OBSERVATION_TOOL_FAILURE recorded. P5 status unknown. — requirement: §3.5
3. Not treated as "no children found." — requirement: §2.1 ACQ-1e

### 8.15 Child-identity write failure after successful launch

1. ACQ-2b: child launched successfully. PID-record write fails.
2. Child is now running without a recorded identity.
3. Mechanism must not abandon the live child; must still attempt monitoring/escalation using whatever identity information is available. — requirement: §3.4 item 7
4. Anomaly recorded. Evidence preserved. — requirement: §3.5

---

## 9. Step 2 ledger

- Created: `docs/PM2-RECOVERY-ACQUISITION-01-STAGE-START.md` (this file)
- Mirrored: `TASKS.md` (this task's fields only); `TASKS_BACKLOG_FULL.md` (this task's body only); `docs/control-plane/SATURATION_PROOF.json` (validator output only)
- Not touched: sidecar, `lockedTaskIds`, any predecessor body or locked freeze, EXEC-01C6A body / candidate, operator bundle, `ops/pm2-recovery-verify/`, workflows, application source, tests, PRD, ARCHITECTURE, CLAUDE, AGENTS
- Mutex: GOVERNANCE acquired transiently; released UNOWNED at end of step
- Occupancy: Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED
- Runtime: none
- Result: **Step 2 COMPLETE — freeze ready for review. Steps 3–4 NOT AUTHORIZED. PROCEDURE_SELECTED=NO. PROCEDURE_APPROVED=NO. EXECUTION_AUTHORIZED=NO. MECHANISM_ESTABLISHED=NO.**

Decisions ready for Keith (Step 3):
- Q1: daemon-present pre-check rule (Q1-A / Q1-C; Q1-B unavailable)
- Q2: capture mechanism (Q2-B proposed / Q2-C; Q2-A unavailable)
- Q3: retry scope (Q3-A / Q3-B / Q3-C; UNRESOLVED ≠ NO_RETRY)
- P5 temporal analysis (§4.3): presented for review, not as a decision
- Recommended package (UNADOPTED): Q1-A + Q2-B + Q3-A

Unresolved dependencies (not created by this freeze; pre-existing or identified here):
- I-4 / I-5 (reference-construction inputs; OPEN)
- C1 EXEC-01C6A amendment direction
- Verifier live-use authorization
- B(H) reference construction
- S2 host-evidence acceptance
- EXEC-01C6A reopen gate
- Host tool availability / target-tuple confirmation (prerequisite for C-ACQ)
- If Keith finds P5 checkpoint analysis insufficient: formal POLICY-01 amendment
- P5 journal-applicability resolution (externally supplied evidence, explicit inapplicability determination, or remains unresolved → blocks C-ACQ)
- **Capture mechanism readiness** (§6.5 child LOCKED and transferred → blocks C-ACQ)

**Step 2 activity ledger:** LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor-source fetch=0, live inspection=0, `.env` / `dump.pm2` / vault / journal / marker access=0, workflow dispatched=0, r3 transferred/extracted/executed=0, F1 transferred/executed=0, product implementation=0, frontend implementation=0, backend implementation=0, application source=0, canary scripts mutated=0, evidence doc mutated=0, operator-bundle mutation=0, verifier-tree mutation=0, workflow mutated=0, `.gitattributes` mutated=0, local application tests=0, tests executed=0 except lane-capacity validator, mocks=0, imports=0, builds=0, installs=0, browser=0, subagents=0, dependencies=0, migrations=0, PRD.md edits=0, ARCHITECTURE.md edits=0, CLAUDE.md edits=0, AGENTS.md edits=0, validator edits=0, mutex-catalog edits=0, sidecar edits=0, lockedTaskIds edits=0, predecessor body edits=0, EXEC-01C6A body/candidate edits=0, locked freeze edits=0, Git mutations=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, invitation registration=0, Harness activation=0, UI=0, later child tasks registered=0, EXEC-01C6A reopened=0, procedure selected=0, procedure approved=0, live acquisition=0, baseline designated=0, observation adopted=0, requirement waived=0.

---

## 10. Correction record #1 (2026-09-19, same uncommitted freeze, baseline `0e208ef219d1b373546b53267bbc0664aede5621`)

5 findings: (1) §3.6 auto-launch boundary explicit; (2) §4.3 P5 checkpoint analysis from locked text; (3) manual controls substantiated (umask/install, timeout, E2 grounding, deferred validation); (4) Q numbering reduced to Q1–Q3; (5) walkthroughs expanded.

## 11. Correction record #2 (2026-09-19, same uncommitted freeze, baseline `0e208ef219d1b373546b53267bbc0664aede5621`)

Keith-directed review, 7 findings. Verified against INVESTIGATION-01 §12.1.2, POLICY-01 §5.2/§4.4/§5.1, VERIFY-01 §4.8 / l.854–893 before editing.

| # | Finding | Correction |
|---|---|---|
| 1 | §3.2 attributed account "aisandbox"; investigation records user `ubuntu`, home `/home/ubuntu/.pm2`. Verifier Python claim unsupported. P5 filtering undefined | §3.2 rewritten with historical evidence from §12.1.2; target tuple defined with blocking conditions; Python claim removed (§6.2); §3.3 added with filtering criteria distinguishing daemon, CLI children, observation tools |
| 2 | Unchecked mkdir/install, truncating `>`, no fail-closed mechanism, no private routing for observation tools, "do not display if sensitive" unenforceable, storage failures not split | §5.1 rewritten: `mktemp -d` exclusive, verified; §5.2: umask-based; §5.3: all commands privately routed, no text editor, fallback logging; §3.5 split STORAGE_FAILURE before/during |
| 3 | Foreground jlist blocks — no way to get PID; signals may target wrong process; shell non-zero exit may bypass recording; un-exited client files may change | §3.4 rewritten: background launch, PID recording, targeted signals with identity check, exit-status collection via `wait`; §2.1 ACQ-4 gated on confirmed exit; KILL_FAILED files preserved as potentially-changing; manual sufficiency reassessed (§6.3) |
| 4 | C-VERIFY required "acquisition completed and validated" (circular); C-TOOL conflated registration/implementation/transfer; §4.2 required vault/journal reads prohibited by §5.6; no journal-applicability analysis | §4.1: C-VERIFY requires "completed" not "validated"; C-TOOL split into C-TOOL-REG/IMPL/TRANSFER; C-REOPEN/C-CANARY split; §4.2: vault/journal evidence externally supplied; journal-applicability stated (further corrected §12, §13) |
| 5 | "fate = exit status" in ACQ-5; verifier identity rules understated; IDENTITY_CHANGE presented stale PID; T_pre mislabelled "immediately before invocation"; race walkthrough claimed detection without evidence | ACQ-5: fate=UNCERTAIN; §2.2: `*_MISSING_IN_OBSERVATION` rules from l.866–874; IDENTITY_CHANGE: anomalous capture; T_obs_start/T_invoke distinguished (§2.4); walkthrough §8.5: same-PID replacement undetected |
| 6 | Q3 silence defaulted to Q3-A; Q1-B conflicted with unconditional DAEMON_ABSENT stop; Q2-A said risks "accepted" at adoption | Q3 silence = UNRESOLVED; Q1-B given explicit constraint (§7.1); Q2-A: method selection, not risk acceptance; reconciliation with C-ACQ stated |
| 7 | Stale Q2/Q3 references from prior numbering | All cross-references verified |

No decision selected. Steps 3–4 NOT AUTHORIZED.

## 12. Correction record #3 (2026-09-20, same uncommitted freeze, baseline `0e208ef219d1b373546b53267bbc0664aede5621`)

Keith-directed review, 2 bounded findings.

| # | Finding | Correction |
|---|---|---|
| 1 | §4.2 journal-applicability: "no vault → vacuously satisfied" lacks controlling adopted authority; A1 first-run amendment does not amend P5; absence of vault/E1 does not prove no applicable recovery material exists | §4.2: removed vacuous-satisfaction reasoning; three states defined (applicable evidence supplied, explicitly determined inapplicable with controlling authority, unresolved → blocks C-ACQ); P5 journal-applicability recorded as unresolved dependency; procedure adoptable while operational acquisition blocked on this |
| 2 | §7.3/§4.1: C-ACQ without explicit invocation/attempt scope implied one shot; silence should not permit execution | §4.1 C-ACQ: requires explicit invocation/attempt scope (no inference from silence); §7.3: Q3 (general retry policy) distinguished from C-ACQ invocation scope (explicit per-authorization); refusal handling: missing scope blocks execution; §7.5 Q3 row corrected; §7.6 C-ACQ row corrected; §3.7 retry prerequisites corrected; §2.1 prerequisite corrected |

No decision selected. Steps 3–4 NOT AUTHORIZED.

## 13. Correction record #4 (2026-09-20, same uncommitted freeze, baseline `0e208ef219d1b373546b53267bbc0664aede5621`)

Keith-directed review, 5 findings.

| # | Finding | Correction |
|---|---|---|
| 1 | Shell examples do not establish claimed controls (no exclusive creation, no target enforcement, blocking escalation deadlines, no identity confirmation, no descriptor boundary, no setup-error routing, uninitialized FALLBACK_LOG, set -e bypasses, PID-write failure abandons child) | `MANUAL_MECHANISM_NOT_ESTABLISHED` (§6.3). All executable-looking shell examples removed. §2–§5 retained as requirements contract. §3.4 rewritten as mechanism requirements. §5.1/§5.2/§5.3 rewritten as requirements |
| 2 | No minimum missing mechanism specified | §6.5: bounded capture child proposed with 14 required acceptance criteria; fake-only verification required before transfer/use; no implementation language chosen; no child registered |
| 3 | Q2-A recommended despite unsupported mechanism; Q2-A authorizes use of unavailable manual procedure | Q2-A marked unavailable; Q2-B recommended; recommended package changed to Q1-A + Q2-B + Q3-A; C-ACQ blocked on mechanism readiness |
| 4 | Q1-B permits invocation against absent daemon but target tuple requires present daemon; both marked usable | Q1-B marked unavailable in this requirements contract; absent-daemon operation carried as separately scoped decision |
| 5 | P5 prereq placed at ACQ-3; T_post described as "after post-observations" but recorded at start; storage failure claims "no partial state"; walkthroughs use ✓ marks implying mechanism verification | P5 prereq corrected to ACQ-1e; T_post corrected to "start of post-observation sequence"; storage failure preserves partial setup artifacts; walkthroughs reference requirements, not mechanism verification; OBSERVATION_TOOL_FAILURE and child-identity-write-failure cases added |

No decision selected. Steps 3–4 NOT AUTHORIZED. PROCEDURE_SELECTED=NO. PROCEDURE_APPROVED=NO. EXECUTION_AUTHORIZED=NO. MECHANISM_ESTABLISHED=NO. Host UNCLEAN / HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Occupancy EMPTY. GOVERNANCE released UNOWNED.

## 14. Correction record #5 (2026-09-20, same uncommitted freeze, baseline `0e208ef219d1b373546b53267bbc0664aede5621`)

Final consistency correction, 5 findings. Requirements-only approach and UNADOPTED Q1-A + Q2-B + Q3-A accepted for review.

| # | Finding | Correction |
|---|---|---|
| 1 | §7.2 Q2-B listed child registration as a prerequisite for selection, while §4.1 requires Q2=TOOLING before C-TOOL-REG | §7.2: Q2-B prerequisites changed to "none beyond this freeze for selection at C-ADOPT"; child lifecycle (C-TOOL-REG → IMPL → TRANSFER) is a C-ACQ prerequisite, not a selection prerequisite |
| 2 | §3.7 required Q3-B for every retry including one under a new C-ACQ; §7.3 Q3-A expressly allows a future attempt under a new C-ACQ | §3.7 split into "retry" (additional invocation under existing C-ACQ; requires Q3-B + explicit scope) and "fresh attempt under a new C-ACQ" (not a retry; allowed regardless of Q3; own prerequisites). Q3-A prevents retry under existing C-ACQ but not a fresh attempt under a new one. Silence remains UNRESOLVED |
| 3 | ACQ-6a and §5.5 listed different publishable field sets | §5.5 renamed "LEDGER_ONLY compliance and publication allowlist" with one canonical allowlist; ACQ-6a references §5.5; child identity restricted to PID integer only (not command line, executable path, arguments); prohibited items explicitly enumerated |
| 4 | §4.4 claimed P4 "re-confirmed at ACQ-3" but ACQ-3 only observes processes/socket holders, not the full P4 attestation (E2, vault-lock, governance) | §4.4: P4 row corrected — externally supplied, subject to validity rules, not independently monitored during acquisition; ACQ-3 does not repeat the full attestation; renewed P4 finding must be separately supplied |
| 5 | §3.5 AUTO_LAUNCH_SUSPECTED defined as "daemon absent at ACQ-1 but present at ACQ-3" — unreachable under Q1-A (absent → STOP) | §3.5: redefined for the residual-race scenario — daemon present at ACQ-1, identity changed or disappeared/reappeared at ACQ-3, consistent with auto-launch race; set alongside IDENTITY_CHANGE or DAEMON_DISAPPEARED; changed PID supports suspicion, cannot prove cause; same-PID limitation preserved. §8.12 walkthrough updated |

No decision selected. Steps 3–4 NOT AUTHORIZED. PROCEDURE_SELECTED=NO. PROCEDURE_APPROVED=NO. EXECUTION_AUTHORIZED=NO. MECHANISM_ESTABLISHED=NO. Host UNCLEAN / HOLD. EXEC-01C6A NOT_READY. Builder gate ON. Occupancy EMPTY. GOVERNANCE released UNOWNED.

---

## 15. Step 3 — explicit Keith decision record (2026-09-20; HEAD `90f5957025e96a1f80252b3fb78ac776bac0e842`)

This section records Keith's decision against the frozen §7 matrix. It adds no requirements text, rewrites no frozen option, registers no child, authorizes no invocation, and performs no Step 4 verification. §§0–14 are unchanged. The §7.4 recommended-package `UNADOPTED` label is historical and is not edited.

### 15.1 Authorization and Keith's answer

- **Keith's statement (recorded in full):** "Approve Q1-A (ABORT_IF_ABSENT), Q2-B (TOOLING), and Q3-A (NO_RETRY). Authorize Step 3 only at baseline 90f5957025e96a1f80252b3fb78ac776bac0e842."
- **Object of the approval:** the frozen §7 questions Q1, Q2 and Q3, with the three named available options. The §7.4 recommended package (Q1-A + Q2-B + Q3-A) was labelled UNADOPTED at freeze time; that label remains historical. Adoption is by this record only.
- **Authorization scope:** Step 3 only. Step 4 (independent verification / checkpoint / lock) is **NOT AUTHORIZED**. "Authorize Step 3 only" is a process authorization, not an operational authorization and not a C-ACQ.
- **Git:** Keith owns Git. This record is written uncommitted for Keith's commit.

### 15.2 Recorded selections

| Question | Keith's selection | Frozen availability (§7) | Completeness | Notes recorded with the selection |
|---|---|---|---|---|
| Q1 | **Q1-A: ABORT_IF_ABSENT** | available (§7.1) | independently interpretable | Known-absent daemon at ACQ-1 → stop; no invocation. Residual auto-launch race remains (§3.6) and is **not** accepted for any current invocation |
| Q2 | **Q2-B: TOOLING** | available for selection at C-ADOPT (§7.2; no child need exist yet) | independently interpretable | Selects the future capture-child route. Registers, implements, tests, transfers, and executes nothing. Child lifecycle remains a C-ACQ prerequisite |
| Q3 | **Q3-A: NO_RETRY** | available (§7.3) | independently interpretable | No additional invocation under the same C-ACQ. A fresh attempt requires a new explicit C-ACQ and all prerequisites. Silence is not inferred |

**Unavailable options not selected:** Q1-B remains unavailable under the frozen contract (§7.1). Q2-A remains unavailable (`MANUAL_MECHANISM_NOT_ESTABLISHED`; §7.2). Q1-C and Q2-C (UNRESOLVED) are not selected. Q3-B and Q3-C are not selected.

No secret value, restricted token, or protected material appears in the statement or the selections. Nothing redacted.

### 15.3 Completeness and compatibility against frozen §7

| Check | Required | Present | Result |
|---|---|---|---|
| Q1 resolved for C-ADOPT (§7.5) | Q1-A or Q1-C; Q1-B unavailable | Q1-A | **complete** — abort conditions determined; C-ADOPT unblocked on Q1 |
| Q2 resolved for C-ADOPT (§7.5) | Q2 does not block C-ADOPT; Q2-B may be selected now | Q2-B | **complete** for C-ADOPT. C-ACQ remains blocked until the capture child is registered, implemented with fake-only verification, LOCKED, and transferred |
| Q3 resolved as policy (§7.3 / §7.5) | Q3-A / Q3-B / Q3-C each independently interpretable; UNRESOLVED ≠ NO_RETRY | Q3-A | **complete** — adopted contract has a NO_RETRY provision. C-ACQ must still state explicit invocation/attempt scope; missing scope still blocks execution |
| Unavailable options not used | Q1-B and Q2-A must not be treated as selected | neither selected | **compatible** |
| Residual auto-launch vs Q1-A | Q1-A does not claim a strict no-auto-launch guarantee | residual race disclosed; not accepted for current invocation | **compatible** with §3.6 / §7.1 |
| TOOLING vs child registration | Q2-B selection ≠ C-TOOL-REG | no child registered | **compatible** with §7.2 / §4.1 |
| NO_RETRY vs fresh attempt | Q3-A permits no retry under the same C-ACQ; a new C-ACQ is not a retry | recorded in §15.4 | **compatible** with §3.7 / §7.3 |
| P5 checkpoint analysis (§4.3) | analysis, not a decision | not treated as exemption, waiver, host attestation, or inferred decision | **compatible** — no new P5 rule adopted |
| P5 journal-applicability (§4.2) | unresolved blocks C-ACQ; does not block C-ADOPT | remains unresolved | **compatible** |

No UNRESOLVED, incomplete, or incompatible combination. The selected set corresponds to the historically UNADOPTED §7.4 recommended package and is now Keith's recorded choice by this section, not by §7.4.

### 15.4 Derived effects (existing task vocabulary)

- **C-ADOPT:** YES. The frozen requirements contract (§§2–6) is adopted as the authorized specification. Adoption accepts **no** current invocation risk, **no** mutation authorization, and **no** P7 risk (§3.6 / §4.5).
- **Q1-A ABORT_IF_ABSENT:** DAEMON_ABSENT at pre-check → no invocation. Residual auto-launch race after a successful pre-check remains. That residual is **not** accepted for any current invocation. No current C-ACQ exists.
- **Q2-B TOOLING:** method is the future capture-child route (§6.5). This decision registers, implements, tests, transfers, and executes **nothing**. `MECHANISM_ESTABLISHED=NO`.
- **Q3-A NO_RETRY:** no additional invocation under the same C-ACQ. A fresh attempt requires a new explicit C-ACQ, fresh prerequisites, and preservation of earlier evidence. No retry is implied by a first invocation. Silence remains UNRESOLVED and is not this selection.
- **C-ACQ:** NO. No capture is executable or operationally authorized. Each later C-ACQ requires explicit invocation/attempt scope.
- **C-TOOL-REG / C-TOOL-IMPL / C-TOOL-TRANSFER:** not authorized. No child registered.
- **C-VERIFY / C-REF / C-HOST / C-REOPEN / C-CANARY:** not authorized.
- **PROCEDURE_SELECTED=YES** (requirements contract). **PROCEDURE_APPROVED=YES** (C-ADOPT). **EXECUTION_AUTHORIZED=NO**. **LOCKED=NO**.

### 15.5 Explicit non-effects (preserved boundaries)

- Capture mechanism readiness remains outstanding; no child registered.
- P5 journal-applicability remains unresolved and blocks C-ACQ.
- Host tools and target tuple remain unconfirmed for operational use.
- Each later C-ACQ requires explicit invocation/attempt scope.
- I-4 / I-5, reference preparation, verifier live-use approval, C1, S2 host evidence, and reopening remain outside this step.
- A1 ADOPTED as contract text only; A2 ADOPTED as REQUIRED provenance policy only; first-run contract DEFINED; no usable first-run path.
- P2 / P3 binding. `P7_ACCEPTED=NO`. `HOST_CLEAN=NO`. Host UNCLEAN / HOLD. Reopen gate UNSATISFIED. EXEC-01C6A `startCondition=NOT_READY`. Builder gate ON. Harness flags unchanged.
- P5 checkpoint analysis remains analysis: not a new exemption, waiver, host attestation, or separate decision inferred from this approval.
- No live acquisition, PM2 client invocation, verifier live use, tool transfer, B(H) construction, host-evidence acceptance, canary, or mutation.
- **Step 3 COMPLETE does not mean checkpoint verified or task LOCKED. Step 4 remains NOT AUTHORIZED.**

### 15.6 Outstanding dependencies carried forward

| Dependency | Status | Effect |
|---|---|---|
| Capture mechanism readiness (§6.5 child LOCKED and transferred) | outstanding; no child registered | blocks C-ACQ |
| P5 journal-applicability (§4.2) | unresolved | blocks C-ACQ |
| Host tool availability / target-tuple confirmation | unconfirmed | blocks C-ACQ |
| Explicit C-ACQ invocation/attempt scope | none | blocks any later execution |
| I-4 / I-5 | OPEN | reference construction; outside this step |
| Verifier live-use authorization | none | blocks C-VERIFY |
| B(H) reference construction | not started | C-REF; outside this step |
| C1 EXEC-01C6A amendment | not registered | outside this step |
| S2 host-evidence acceptance | none | C-HOST; outside this step |
| EXEC-01C6A reopen gate | UNSATISFIED | C-REOPEN; outside this step |
| Step 4 independent verification / checkpoint / lock | NOT AUTHORIZED | requires Keith's separate authorization |

### 15.7 Step 3 ledger

- Write set: this document (header current-status lines updated; historical freeze status preserved; §§0–14 unchanged; §15 appended); `TASKS.md` (this task's current fields and governance ledger entries, `Previous:` preserved); `TASKS_BACKLOG_FULL.md` (this task's body only); `docs/control-plane/SATURATION_PROOF.json` (validator output only).
- Not touched: sidecar, candidates, `lockedTaskIds`, mutex catalog, any predecessor body or locked freeze, EXEC-01C6A body / candidate, operator bundle, `ops/pm2-recovery-verify/`, workflows, application source, tests, PRD, ARCHITECTURE, CLAUDE, AGENTS.
- Mutex: GOVERNANCE acquired transiently for this control-plane step; released UNOWNED at end of step. No implementation lane. Occupancy: Lane 1 EMPTY; Lane 2 EMPTY; Lane 3 DISABLED.
- Runtime / activity: none (no Python, imports, tests, mocks, builds, installs, SSH, staging, PM2, config / vault / journal access, browser, workflow dispatch, subagents, child registration). Git: no add / commit / push / reset / restore; Keith owns Git.
- Result: **Step 3 COMPLETE. C-ADOPT. Q1-A / Q2-B / Q3-A. MECHANISM_ESTABLISHED=NO. EXECUTION_AUTHORIZED=NO. Step 4 NOT AUTHORIZED. NOT LOCKED.**
