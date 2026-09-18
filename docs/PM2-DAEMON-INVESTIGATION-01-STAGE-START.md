# PM2-DAEMON-INVESTIGATION-01 — Stage-Start / Evidence-Scope Freeze

**Task ID:** PM2-DAEMON-INVESTIGATION-01
**Title:** Produce version-specific evidence and remediation requirements for a possible PM2 fencing/recovery successor
**Step:** 2 — evidence-scope freeze
**Step status:** Step 1 COMPLETE — 2026-09-18 (registration `b6924cd4f3583fd26807e24796c45f834d20e7fe` `docs: register pm2 daemon investigation`); Step 2 COMPLETE — 2026-09-18 (this freeze); Step 3 NOT AUTHORIZED; Step 4 NOT AUTHORIZED
**Nature:** GOVERNANCE / TECHNICAL INVESTIGATION — does NOT consume Lane 1 or Lane 2
**Risk:** HIGH (evidence-scope freeze only; no investigation executed)
**Lifecycle:** 4-step GOVERNANCE
**Parent:** none. Not a child of AGENT-PLATFORM-EXEC-01C6A. Does **not** reopen EXEC-01C6A. Not the fencing/recovery successor required by HARNESS-RESTART-GOV-01 OUTCOME_A / R1.
**This document:** Authoritative frozen investigation procedure (work packages A–E) for a later, separately authorized Step 3, and the container for the later Step 3 evidence report. It is not a scheduler, not an EXEC-01C6A reopen, not fence proof, and grants no runtime, staging, vendor-fetch, or bundle-audit permission.
**Step 2 base HEAD:** `b6924cd4f3583fd26807e24796c45f834d20e7fe` (branch `main`; registration commit; working tree clean at window open; occupancy EMPTY / GOVERNANCE UNOWNED)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=NO
STEP4_AUTHORIZED=NO
INVESTIGATION_EXECUTED=NO
VENDOR_SOURCE_FETCHED=NO
LIVE_STAGING_INSPECTION_PERFORMED=NO
OPERATOR_BUNDLE_AUDIT_EXECUTED=NO
PROPOSED_COMMANDS_EXECUTED=NO
EXEC_01C6A_REOPENED=NO
EXEC_01C6A_START_CONDITION=NOT_READY
FENCE_RECOVERY_SUCCESSOR_REGISTERED=NO
IMPLEMENTATION_CANDIDATE_CREATED=NO
F1_F5_PROVEN=NO
P1_P8_AUTHORIZED=NO
HOST_CLEAN_ATTESTED=NO
RESIDUAL_DAEMON_BUFFER_RISK_ACCEPTED=NO
BUILDER_GATE=LEFT_ON_UNCHANGED
HARNESS_FLAGS=UNCHANGED
STAGING_EXECUTION_AUTHORIZED=NO
PM2_AUTHORIZED=NO
LANE_1=EMPTY
LANE_2=EMPTY
LANE_3=DISABLED
GOVERNANCE_FINAL=UNOWNED
```

---

## 1. Authority and referenced requirements (not copied)

- `TASKS.md` CURRENT EXECUTION BOARD is the only scheduler. `TASKS_BACKLOG_FULL.md` is the canonical registry.
- **F1–F5** (genuine fencing capability), **P1–P8** (UNKNOWN_PENDING_OVERLAY host-clean gate), the **four CLI/daemon states** (CLIENT_NOT_DELIVERED / DELIVERED_UNACKED / DAEMON_ACKED / ACK_LOST), the **§4 rejected fencing proofs**, and the **named apps / named overlay keys** are frozen in `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` (§5, §6.4, §3, §4, §2). This freeze references them; it does not restate or reinterpret them.
- **OUTCOME_A / R1** and the successor-before-reopen sequence are frozen in `docs/HARNESS-RESTART-GOV-01-STAGE-START.md` §3.3. This investigation is not that successor.
- Staging topology, the shared PM2 worker, module-load Harness flag facts, and the `--update-env` merge lesson are recorded in `docs/AGENT-PLATFORM-EXEC-01C6-STAGE-START.md` §5.3–§5.5.
- Prior-review version caveat (canonical body, scope item 5): the supplied review examined PM2 v6.0.14 but **master branches** of the transport dependencies; those findings require version-matched verification and are not adopted as verified facts.

---

## 2. Work package A — version and source identity (FROZEN)

**Required evidence:** installed PM2 package identity (name/version from the installed tree), running daemon identity (as distinct evidence), resolved versions of the relevant transport dependencies (`pm2-axon`, `pm2-axon-rpc`, plus any dependency the installed tree shows on the client→daemon command path), and SHA-256 hashes of the bounded named source/artifact files below.

**Rule:** CLI version must **not** be equated with running-daemon version. The daemon may have been started from a different install than the one currently on disk.

**Minimum read-only staging inspection (PROPOSED COMMANDS ONLY — not executed in this window; execution requires later explicit Keith authorization of live inspection):** Lightsail browser SSH on `aisandbox-staging`, as the PM2-owning user, read-only:

```bash
# A1. CLI entry resolution (does not invoke PM2)
command -v pm2
readlink -f "$(command -v pm2)"
# PM2_ROOT below = the installed pm2 package directory resolved from A1 (do not guess it)

# A2. Installed package identity
grep -E '"(name|version)"' "$PM2_ROOT/package.json"

# A3. Resolved transport dependency versions and recorded integrity where present
grep -E '"(name|version|_resolved|_integrity)"' "$PM2_ROOT/node_modules/pm2-axon/package.json"
grep -E '"(name|version|_resolved|_integrity)"' "$PM2_ROOT/node_modules/pm2-axon-rpc/package.json"

# A4. Bounded artifact hashes
sha256sum "$PM2_ROOT/package.json" "$PM2_ROOT/lib/Daemon.js" "$PM2_ROOT/lib/Client.js" "$PM2_ROOT/lib/God.js"
find "$PM2_ROOT/node_modules/pm2-axon/lib" "$PM2_ROOT/node_modules/pm2-axon-rpc/lib" -maxdepth 1 -name '*.js' -print0 | xargs -0 sha256sum

# A5. Running daemon identity (passive; no PM2 client; daemon PID only)
pgrep -af "God Daemon" || true
ps -o pid=,lstart=,etimes=,args= -p "$DAEMON_PID"
ls -l "/proc/$DAEMON_PID/exe"
tr '\0' ' ' < "/proc/$DAEMON_PID/cmdline"; echo

# A6. Daemon boot banner lines only (no app log content)
grep -aE 'PM2 version|Launching in|RPC interface' "$HOME/.pm2/pm2.log" | tail -n 5

# A7. IPC socket presence / mtime
ls -l "$HOME/.pm2/rpc.sock" "$HOME/.pm2/pub.sock"

# A8. Installed-tree stability relative to daemon start time
stat -c '%y %n' "$PM2_ROOT/package.json" "$PM2_ROOT/lib/Daemon.js" "$PM2_ROOT/lib/Client.js"
```

**Prohibited in A:** invoking any PM2 client (`pm2 -v`, `pm2 ls`, `pm2 jlist`, `pm2 ping`, `pm2 report`, `pm2 save`, …) — a PM2 client can spawn or reconnect a daemon merely to read metadata; reading `/proc/<pid>/environ` or any environment dump; secrets, vault contents, `/opt/aisandbox/.env` values; broad process-table output beyond the identified daemon PID(s); any write, restart, or overlay.

**UNKNOWN rule:** Node loads code at daemon start. Disk hashes identify the currently installed code, not necessarily the loaded code. If the daemon process title / boot banner version cannot be tied to the hashed tree, or A8 cannot exclude post-start modification of the tree, the Step 3 report must record `STAGING_APPLICABILITY=UNKNOWN` for daemon-side findings rather than overclaiming. Live inspection requires later explicit Keith authorization; **this freeze grants none**.

---

## 3. Work package B — vendor-source characterization (FROZEN)

**Bounded sources (no fetch in this Step 2 window):**

1. Official PM2 source repository and official PM2 documentation, pinned to the **exact release tag / commit matching the installed version identified by A** (not master, not latest).
2. The transport dependencies identified from A's versioned manifests or package artifacts — at minimum `pm2-axon` and `pm2-axon-rpc` — pinned to the **exact resolved versions**, with npm integrity hashes (`_integrity` / registry sha512) recorded where available.

**Rules:**

- Do **not** substitute transport master branches for the identified installed versions. The prior review's master-branch findings are unverified input, not evidence.
- Trace **separately**, without collapsing: (1) client→daemon command delivery; (2) daemon-side dispatch / handler execution; (3) process-env mutation application point; (4) asynchronous completion; (5) acknowledgement production and receipt.
- Cover these mechanisms/failure modes: CLI timeout; socket disconnect; reconnect queues / buffered-command replay on reconnect; client crash; watchdog takeover; competing clients on separate connections; daemon replacement (kill / resurrect / update).
- Distinguish observed implementation behavior at the pinned version from a documented supported guarantee.
- If live version evidence (A) is unavailable or UNKNOWN, source-only findings may still proceed under later Step 3 authorization, but every such finding must carry `STAGING_APPLICABILITY=UNKNOWN` explicitly.

---

## 4. Work package C — operator-bundle audit (FROZEN)

**Existing bundle location (pre-existing local artifact; not created by this task):**
`C:\Users\knlee\AppData\Local\Temp\aisb-01c6a-operator-review\`

A read-only directory-**name** inventory was taken in this Step 2 window solely to freeze the exact file list. No bundle file contents were read, no hashes were computed, and nothing was executed in this window.

**Frozen relevant files (audit set for later Step 3):**

| Role | Files |
|---|---|
| Bundle description / accepted hashes | `OPERATOR-BUNDLE.md`, `REVIEW-SHA256.txt`, `TRANSFER.manifest`, `bin/verify-transfer.py` |
| Overlay apply/restore and ack handling (primary defect surface) | `lib/overlay_restore.py`, `lib/supervise.py`, `lib/orchestrate.py` |
| Recovery material and result flags | `lib/vault.py`, `lib/accepted_result.py`, `lib/cleanup_contract.py`, `lib/reconcile.py`, `lib/secret_io.py` |
| Supporting semantics | `lib/process_alive.py`, `lib/config_deadlines.py`, `bin/restore-overlays.sh`, `bin/run-canary-supervised.sh`, `bin/orchestrate-canary.sh` |
| Test expectations (read-only; never run) | `tests/test_operator_bundle.py` |
| Hash-only (contents never copied into evidence) | `config/defaults.env`, `config/xai-observation-addrs.txt` |

`__pycache__` artifacts are derived files: excluded from content inspection; presence noted only.

**Read-only hashing/inspection procedure (later Step 3 only; not executed now):**

1. `Get-FileHash -Algorithm SHA256` (PowerShell 5.x) over the frozen file list; compare against `REVIEW-SHA256.txt` / `TRANSFER.manifest` entries; record match or mismatch per file.
2. Static read of the matched files only. **No execution:** no Python invocation, no module import, no test run, no shell script execution, no mock use.
3. Verify by code reading the reported defect path: overlay `TimeoutExpired` → restore snapshot matches → `restore_ok=True` / `overlays_restored=True` → vault / `pending_apps.json` deletion. Identify exact functions and lines.
4. Distinguish **PM2-overlay acknowledgements** (CLI child exit for `restart --update-env`, per `CliPm2`) from **canary-job acknowledgements** (job/queue completion signals). A finding about one must not be attributed to the other.
5. If the bundle is missing, or file hashes differ from the accepted `REVIEW-SHA256.txt` / `TRANSFER.manifest` values, record the limitation and audit only what matches; do **not** recreate, repair, execute, or silently accept the bundle.
6. Never read protected recovery values: vault contents, recovery maps, presence tokens, pending-overlay payload values, or any secret material. Code that handles them may be read; the values may not.

**No bundle audit execution in this Step 2 window.**

---

## 5. Work package D — requirements mapping (FROZEN)

- Map each mechanism finding **independently** to F1–F5 (PM2-FENCE-01 stage-start §5) and, where the finding concerns the recovery-policy path, to the relevant P1–P8 prerequisites (§6.4).
- **FIFO does not waive F1.** In-connection FIFO does not establish the daemon-side fate of an ACK_LOST command and says nothing about other connections.
- A ping or a later RPC response is **not** a completion barrier unless its semantics demonstrably establish that property at the pinned version.
- Source inspection **cannot** attest host exclusivity (P4/P5 are operational evidence, not source findings).
- Required UNKNOWN latching (never rewriting `UNKNOWN_PENDING_OVERLAY` to success), preservation of recovery material (vault / presence tokens / pre-apply dumps), and next-run blocking are recorded as **remediation requirements only**. Step 3 must not implement them.

---

## 6. Work package E — deliverable and stopping rule (FROZEN)

Step 3 produces **one evidence report inside this task's stage-start/checkpoint document**, containing:

1. Source/version inventory and staging applicability (KNOWN per A, or UNKNOWN explicitly).
2. Requirement-by-requirement findings (F1–F5; relevant P1–P8).
3. Per mechanism: **supported candidate** / **rejected candidate** / **insufficient evidence**, with the reason.
4. Verified operator-bundle defects and the remediation requirements (findings only).
5. The smallest concrete next implementation or recovery-policy proposal — recorded **UNREGISTERED**.
6. The remaining authorization decisions for Keith.

**Meaning constraints:** a *supported candidate* is an evidence-supported **design candidate** only — not an implemented fence, not host CLEAN, not P1–P8 authorization, not residual-risk acceptance, and not permission to reopen EXEC-01C6A. Failure of one candidate does not prove every fence impossible and does not automatically select the residual-risk policy.

**Stopping rule:** the investigation is bounded to work packages A–D and this deliverable. Do not create additional governance tasks merely to restate missing evidence. If an input is missing (e.g., live inspection not authorized, bundle hash mismatch, vendor version unresolvable), record the missing input and the specific next action needed to obtain it, then continue with the remaining packages under explicit UNKNOWN applicability.

---

## 7. Later evidence-access authorizations still required (none granted here)

| Access | Authorization required |
|---|---|
| Step 3 investigation window | KEITH_DECISION_REQUIRED_BEFORE_INVESTIGATION=YES |
| Live read-only staging inspection (work package A commands) | Separate explicit Keith authorization naming read-only Lightsail SSH; still no PM2 client invocation |
| Vendor-source fetch (work package B) | KEITH_DECISION_REQUIRED_BEFORE_VENDOR_SOURCE_FETCH=YES |
| Operator-bundle read-only audit execution (work package C) | Named in the Step 3 authorization |
| Step 4 verification / checkpoint / lock | KEITH_DECISION_REQUIRED_BEFORE_CHECKPOINT_LOCK=YES |
| EXEC-01C6A reopen, PM2, STAGING mutation, ENV, CREDIT, PROVIDER-LIVE, Harness flags | Not this task; separate authorizations per HARNESS-RESTART-GOV-01 §3.3 |

---

## 8. What this Step 2 freeze does not authorize

Step 3 or Step 4 execution; the investigation itself; vendor-source fetch; live staging inspection; operator-bundle audit execution; reopening AGENT-PLATFORM-EXEC-01C6A; changing EXEC-01C6A `startCondition=NOT_READY`; registering the fencing/recovery successor, EXEC-01C6B, EXEC-01C7, or any implementation candidate; proving F1–F5; authorizing P1–P8; attesting host CLEAN; accepting residual daemon-buffer risk; STAGING / PM2 / ENV / CREDIT / PROVIDER-LIVE / LOCAL-RUNTIME / SSH / Docker / database / Redis; Harness or Builder gate/flag changes; operator-bundle mutation; implementation code or runtime procedures; editing PRD.md / ARCHITECTURE.md / CLAUDE.md / AGENTS.md / validator / mutex catalog / `lane-saturation-state.json` / EXEC-01C6A prepared artifacts.

---

## 9. Missing inputs recorded (with the specific next action)

| Missing input | Specific next action |
|---|---|
| Installed staging PM2 / transport versions and running-daemon identity | Keith-authorized Step 3 live read-only inspection executing the frozen A1–A8 proposals |
| Version-pinned vendor-source facts | Keith-authorized Step 3 vendor fetch pinned to A-identified versions (B) |
| Verified bundle state vs accepted hashes | Keith-authorized Step 3 read-only bundle audit (C) |
| Host exclusivity evidence | Operational evidence under a later separately authorized step; cannot come from source inspection (D) |

---

## 10. Invariants unchanged

- EXEC-01C6A remains MACHINE BLOCKER ENFORCED / `startCondition=NOT_READY` / not reopened / not admitted / not LANE-DONE / not LOCKED.
- HARNESS-RESTART-GOV-01 remains COMPLETE AND LOCKED (OUTCOME_A / R1). PM2-FENCE-01 remains COMPLETE AND LOCKED (OUTCOME_BLOCKED / M3).
- BUILDER-LIVE-GATE-01 remains COMPLETE AND LOCKED / gate LEFT ON (`GLOBAL_EXECUTION_ENABLED=true`). Harness flags unchanged. Product-visible Harness remains FUTURE / gated.
- PRIVATE-BETA-INVITE-01 remains PARKED / UNREGISTERED / UNAUTHORIZED / NOT EXECUTABLE / PROHIBITED. Lane 3 remains DISABLED.
- `HARNESS_ENTITLEMENT_PROOF_V1` remains FROZEN. Prepared 01C6A artifacts untouched.
- Occupancy EMPTY. No sidecar candidate. `docs/control-plane/lane-saturation-state.json` unchanged.

---

## 11. Activity ledger (Step 2 window)

LIVE=0, SSH=0, staging=0, AWS=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, flags=0, key creation=0, canary submission=0, vendor-source fetch=0, live inspection=0, proposed A-commands executed=0, operator-bundle content reads=0, operator-bundle hashes computed=0, operator-bundle mutation=0 (read-only file-name inventory only), canary scripts mutated=0, evidence doc mutated=0, sidecar mutation=0, application source=0, local application tests=0, tests executed=0 except lane-capacity validator, dependencies=0, migrations=0, PRD.md=0, ARCHITECTURE.md=0, CLAUDE.md=0, AGENTS.md=0, validator edits=0, mutex-catalog edits=0, Git commit/push=0, Lane 1 admission=0, Lane 2 admission=0, Lane 3 enablement=0, EXEC-01C6A reopened=0, fencing/recovery successor registered=0, implementation candidate created=0, investigation executed=0.

Governance writes (Step 2): this document (created); `TASKS.md` current board fields; `TASKS_BACKLOG_FULL.md` PM2-DAEMON-INVESTIGATION-01 body only; `docs/control-plane/SATURATION_PROOF.json` only as validator output. GOVERNANCE acquired transiently for this control-plane write then released UNOWNED. End-state occupancy EMPTY / GOVERNANCE UNOWNED.
