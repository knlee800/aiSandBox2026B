# PM2-DAEMON-INVESTIGATION-01 — Stage-Start / Evidence-Scope Freeze

**Task ID:** PM2-DAEMON-INVESTIGATION-01
**Title:** Produce version-specific evidence and remediation requirements for a possible PM2 fencing/recovery successor
**Step:** 3 — investigation (evidence report in §12)
**Step status:** Step 1 COMPLETE — 2026-09-18 (registration `b6924cd4f3583fd26807e24796c45f834d20e7fe` `docs: register pm2 daemon investigation`); Step 2 COMPLETE — 2026-09-18 (evidence-scope freeze, §2–§11); Step 3 COMPLETE — 2026-09-18 (Keith-authorized investigation A–E; evidence report §12; Keith-authorized documentation-only correction pass applied 2026-09-18, ledger §12.9); Step 4 NOT AUTHORIZED
**Nature:** GOVERNANCE / TECHNICAL INVESTIGATION — does NOT consume Lane 1 or Lane 2
**Risk:** HIGH (read-only evidence collection only; no fence implemented; no host mutation)
**Lifecycle:** 4-step GOVERNANCE
**Parent:** none. Not a child of AGENT-PLATFORM-EXEC-01C6A. Does **not** reopen EXEC-01C6A. Not the fencing/recovery successor required by HARNESS-RESTART-GOV-01 OUTCOME_A / R1.
**This document:** Authoritative frozen investigation procedure (work packages A–E, §2–§6) and the Step 3 evidence report (§12). It is not a scheduler, not an EXEC-01C6A reopen, not fence proof, and grants no runtime, staging, PM2, or implementation permission. Step 3 findings are evidence and design candidates only.
**Step 2 base HEAD:** `b6924cd4f3583fd26807e24796c45f834d20e7fe` (branch `main`; registration commit; working tree clean at window open; occupancy EMPTY / GOVERNANCE UNOWNED)
**Step 3 base HEAD:** `1241f7aefe98318d94acce6e9421c257d1a55441` (branch `main`; Step 2 freeze commit; working tree clean at window open; occupancy EMPTY / GOVERNANCE UNOWNED)
**Occupancy hash (end-state):** `sha256:942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d` (Lane 1 EMPTY, Lane 2 EMPTY, GOVERNANCE UNOWNED)

```
STEP1_COMPLETE=YES
STEP2_COMPLETE=YES
STEP3_AUTHORIZED=YES
STEP3_COMPLETE=YES
STEP4_AUTHORIZED=NO
INVESTIGATION_EXECUTED=YES
VENDOR_SOURCE_FETCHED=YES (pm2@7.0.3, amp@0.3.1, amp-message@0.1.2 registry artifacts; integrity verified; not installed; not executed)
LIVE_STAGING_INSPECTION_PERFORMED=YES (read-only SSH as ubuntu; frozen A1–A8 plus recorded bounded A3/A8 adaptations; no PM2 client invoked)
OPERATOR_BUNDLE_AUDIT_EXECUTED=YES (SHA-256 + static read only; nothing executed; raw-hash procedure deviation recorded §12.1.5)
PROPOSED_COMMANDS_EXECUTED=YES (A1–A8 read-only; see §12.1.1)
STAGING_APPLICABILITY_INSTALLED_SOURCE=KNOWN (on-disk tree hash-identical to registry pm2-7.0.3.tgz; §12.1.3)
STAGING_APPLICABILITY_DAEMON_VERSION=CORROBORATED 7.0.3 (process title + boot banner; not a byte-level proof)
STAGING_APPLICABILITY=UNKNOWN for daemon loaded-code identity (freeze §2 UNKNOWN rule applies to daemon-side findings; §12.1.3)
PM2_INSTALLED_VERSION=7.0.3
PM2_RUNNING_DAEMON_VERSION=7.0.3 (banner + process title; PID 844871; started 2026-09-11 06:15:45 HKT)
FENCE_VERDICT=NO_MECHANISM_SATISFYING_F1_F5_ESTABLISHED_IN_INSPECTED_VERSION_AND_SCOPE; ONE_DESIGN_CANDIDATE_WITH_OPEN_CONDITIONS (single-connection ordering; §12.3)
BUNDLE_F5_DEFECT=STATICALLY_ESTABLISHED_POSSIBLE_CONTROL_FLOW_PATH (not executed / not reproduced; §12.4)
STEP3_CORRECTION_PASS_APPLIED=YES (2026-09-18; documentation only; §12.9)
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

---

## 12. Step 3 evidence report (2026-09-18; Keith-authorized A–E; evidence only)

**Verdict (lead; corrected 2026-09-18, §12.9):** Within the inspected version (**pm2 7.0.3**, installed on-disk source hash-verified; daemon version corroborated by title/banner; exact loaded bytes unproven) and the inspected scope (client → transport → `God` action path, operator bundle), **this investigation has not established any mechanism that satisfies F1–F5.** No documented guarantee and no exposed RPC was found that establishes the daemon-side fate of a command whose acknowledgement was lost. Source inspection yields exactly **one design candidate** — *same-connection ordering on the daemon's single `rep` socket* — which orders **dispatch** of frames within one connection; it does **not** by itself establish F1 (fate of an ACK_LOST frame), F2 (last-mutation-wins across connection generations, outstanding operations, and competing writers), or F3 (restart completion). Host exclusivity (P4/P5) is operational evidence, not a source finding. The existing operator bundle contains a **statically established possible control-flow path** violating F5: `subprocess.TimeoutExpired` on an overlay `pm2 restart --update-env` propagates as a generic exception, `restore_always()` runs, a matching `jlist` snapshot sets `restore_ok=True` / `overlays_restored=True`, and protected recovery material plus the pending marker are deleted — with no daemon-side fate input. This path was traced by reading, not executed. **Concrete next action (unregistered, unauthorized):** a separately registered bounded task would need to (a) keep the outcome `UNKNOWN_PENDING_OVERLAY` on `TimeoutExpired`/killed-client apply (P2), (b) never delete recovery material or clear `pending_apps.json` under UNKNOWN (P3), (c) block the next run until Keith-authorized named-key verification after P4/P5 (P6), and (d) if fencing is pursued, prove the open conditions listed in §12.3 for the single-connection candidate. This report registers nothing, selects no policy, accepts no residual risk, declares no host CLEAN, and reopens nothing.

### 12.1 Source / version inventory and staging applicability

**12.1.1 Installed package identity (A1, A2, A3, A4, A8) — read-only SSH as `ubuntu` on `aisandbox-staging`:**

| Item | Evidence |
|---|---|
| CLI entry | `command -v pm2` → `/usr/bin/pm2`; `readlink -f` → `/usr/lib/node_modules/pm2/bin/pm2`; `/usr/bin/pm2 -> ../lib/node_modules/pm2/bin/pm2` (root-owned symlink, Jul 24 10:35). `PM2_ROOT=/usr/lib/node_modules/pm2` resolved from A1, not guessed. |
| Installed package | `package.json` `"name": "pm2"`, `"version": "7.0.3"`. |
| Node on PATH | `/usr/bin/node`, `v20.20.2` (no PM2 client invoked). |
| Transport dependencies | `node_modules/pm2-axon` and `node_modules/pm2-axon-rpc` **ABSENT**. `require('../modules/pm2-axon-rpc')` / `require('../modules/pm2-axon')` in `lib/Client.js` l.10/12 and `lib/Daemon.js` l.13/14: the transport is **vendored inside the pm2 package** at `modules/pm2-axon` and `modules/pm2-axon-rpc` (no `package.json` in either vendored dir; no `_resolved`/`_integrity` available for them — they are part of the pm2 artifact). Frame codec dependencies resolved: `node_modules/amp` `0.3.1`, `node_modules/amp-message` `0.1.2` (declared exactly in pm2 `dependencies`). No lockfile present under `PM2_ROOT`. |
| Only pm2 install tree | `find /usr /opt /home/ubuntu -maxdepth 6 -type d -name pm2 -path '*node_modules/pm2'` → only `/usr/lib/node_modules/pm2`. No `~/.nvm`, `~/.volta`, `~/.fnm`, `~/.npm-global`. |
| Tree stability (A8) | All hashed files mtime `2026-07-24 10:35:24 +0800`; newest file under `PM2_ROOT` `2026-07-24 10:35:25`. Host boot `2026-07-29 17:16:17`. Daemon start `2026-09-11 06:15:45 HKT` (below). **No mtime evidence of modification after daemon start.** mtimes are metadata: they do not exclude a modify-and-revert, a modification with preserved timestamps, or loading from a path since removed; A8 therefore narrows but does not close the loaded-code gap (§12.1.3). |

**A3 adaptation recorded:** frozen A3 targeted `node_modules/pm2-axon*/package.json`, which do not exist at 7.0.3; the bounded substitute (names + hashes of the vendored `modules/pm2-axon*` trees, `amp`, `amp-message`, and the pm2 `dependencies` block / `require()` lines) was executed read-only. **A8 adaptation recorded:** bounded name-only search for alternative pm2 trees / version managers, the daemon banner block at the last start (PM2 log lines only, app lines filtered), daemon `/proc/<pid>/fd` socket inode names only, and a passive scan for other processes holding `rpc.sock` open (none found at inspection time). No environment, secrets, vaults, application logs, or broad process arguments were read.

**12.1.2 Running daemon identity (A5, A6, A7) — kept separate from installed identity:**

| Item | Evidence |
|---|---|
| Daemon PID / title | `pgrep -af "God Daemon"` → single match `844871 PM2 v7.0.3: God Daemon (/home/ubuntu/.pm2)`; user `ubuntu`; `lstart Fri Sep 11 06:15:45 2026`; `etimes 625447` at inspection (2026-09-18T03:59:53Z). |
| Executable / cwd | `/proc/844871/exe -> /usr/bin/node`; cwd `/`. |
| Boot banner (A6, PM2 log lines only) | `2026-09-11T06:15:45: PM2 log: --- New PM2 Daemon started ---`; `PM2 version : 7.0.3`; `Node.js version : 20.20.2`; `PM2 home : /home/ubuntu/.pm2`; `RPC socket file : /home/ubuntu/.pm2/rpc.sock`; `BUS socket file : /home/ubuntu/.pm2/pub.sock`; `Process dump file : /home/ubuntu/.pm2/dump.pm2`; `Concurrent actions : 2`; `SIGTERM timeout : 1600`; `Runtime Binary : /usr/bin/node`. Earlier banners 2026-07-24, 2026-07-29 (×2) all `7.0.3`. |
| IPC sockets (A7) | `srwxrwxr-x ubuntu ubuntu … Sep 11 06:15 /home/ubuntu/.pm2/rpc.sock` and `pub.sock` (mtime = daemon start). |

**12.1.3 Staging applicability (corrected 2026-09-18, §12.9) — three separate claims:**

| Claim | Status | Basis and limit |
|---|---|---|
| (a) Installed on-disk source identity | **KNOWN** | `/usr/lib/node_modules/pm2` is `pm2@7.0.3`; every one of the 24 staging file hashes in §12.1.4 equals the registry `pm2-7.0.3.tgz` extraction byte-for-byte. All **CLI-side** source citations (client, transport `req`, `API._operate`, `--update-env` merge construction) apply to the code the bundle's `pm2` client executes from disk **at the time it is spawned**, subject to the same on-disk identity holding at that time. |
| (b) Running-daemon **version** | **CORROBORATED 7.0.3** | Process title `PM2 v7.0.3: God Daemon` (A5) and boot banner `PM2 version : 7.0.3` / `Runtime Binary : /usr/bin/node` (A6). Both are self-reported strings written by the daemon from `package.json` at start; they identify the version the daemon believed it was, not the bytes it loaded. |
| (c) Exact **loaded-code** identity of daemon PID 844871 | **UNKNOWN** | Node loaded code once at 2026-09-11 06:15:45. Old mtimes (A8), absence of newer files, and a bounded `-maxdepth 6` alternative-tree / version-manager search (§12.1.1) reduce the likelihood of, but do not exclude, modification-and-reversion, timestamp-preserving edits, or a tree present at start and since removed. No evidence collected in Step 3 ties the daemon's in-memory code to the hashed bytes. Per the freeze §2 UNKNOWN rule, **daemon-side findings** (dispatch order, l.405 merge point, reply behavior, dump/exit paths) are recorded as `STAGING_APPLICABILITY=UNKNOWN` for the live daemon; they are established for the **7.0.3 artifact** and for the on-disk tree that any **future** daemon start from this tree would load. |

Net: the version-pinned source findings in §12.2–§12.4 stand as findings about pm2 7.0.3 and about the staging on-disk tree. Their applicability to the currently running daemon process is corroborated by version but not proven at the byte level. No further staging inspection was performed or is authorized by this correction.

**12.1.4 Vendor artifacts (B) — retrieved to `%TEMP%\pm2inv\vendor\`, extracted with tar only, never installed or executed:**

| Artifact | Integrity |
|---|---|
| `pm2-7.0.3.tgz` (registry.npmjs.org) | registry `integrity` `sha512-zRJOdburpb9OEPB0uqoNT8C1Gp7hPJPVy4Kr67XJNuT9UlMQcOt1WXrYQUmwqKPHk8FyauvP1CPhqoCrCaPw0Q==` — **local sha512 matches**; sha256 `daf790481179dbc51d495a3faf3724b6ea3c4375ba7652b16e9275a8e143eefa`; registry `shasum` `fd9bab54f7a27af12875ca8a8c9bee616b0f22e4`; `gitHead` `01d4f6d59c5eaf4ff6683bb38824dcf38d25b289`; `fileCount` 232. |
| `amp-0.3.1.tgz` | `sha512-OwIuC4yZaRogHKiuU5WlMR5Xk/jAcpPtawWL05Gj8Lvm2F6mwoJt4O/bHI+DHwG79vWd+8OFYM4/BzYqyRd3qw==`; sha256 `45cd6fb321538fcc820ddbd1aa63d1257cadaf60d5c5e34239273efec73eaa80`. |
| `amp-message-0.1.2.tgz` | `sha512-JqutcFwoU1+jhv7ArgW38bqrE+LQdcRv4NxNw0mp0JHQyB6tXesWRjtYKlDgHRY2o3JE5UTaBGUK8kSWUdxWUg==`; sha256 `85022553112fb5ad8bc70c23c7f737449ca5f9620c51427adf560f1163ced65e`. |
| Official docs | `pm2.keymetrics.io/docs/usage/environment/` fetched (HTML saved); `--update-env` is documented as "update environment on restart" only. **No documented completion, ordering, idempotency, or acknowledgement guarantee exists for `restart`.** |

**Staging ↔ artifact hash equality (24/24 files, sha256):** `package.json` `f2819cff…88d6`; `lib/Daemon.js` `c4e27c6a…2fb9`; `lib/Client.js` `535b4b98…2a7b`; `lib/God.js` `f598e511…500d`; `lib/God/ActionMethods.js` `4fc5442f…2f96e`; `lib/God/Methods.js` `577a8505…2044`; `lib/API.js` `2a9153c1…5cf7`; `lib/API/Extra.js` `2932ea33…6520`; `constants.js` `5a4adce0…a853`; `modules/pm2-axon-rpc/{index,lib/client,lib/server}.js` `f5177ff5…b656` / `f105ec1a…6f91` / `6da3f93c…7483`; `modules/pm2-axon/{index,lib/index,lib/plugins/queue,lib/sockets/rep,lib/sockets/req,lib/sockets/sock,lib/utils}.js` `564748a7…f4ab` / `98c1ff92…3f4` / `ce908755…1be` / `e295c393…5a0` / `d418b612…df77` / `50de3ac2…dd54` / `561edbe0…302f`; `amp/{index,lib/decode,lib/encode,lib/stream}.js` `e976e5f2…3274` / `53070d73…6fa` / `6b3be5fd…aaf1` / `151e2620…4d5`; `amp-message/index.js` `72150251…142e`. Full 64-hex values are in the captured outputs `%TEMP%\pm2inv\*.out.txt` (local evidence only, not repository artifacts). Therefore every source citation below applies to the **installed on-disk code on staging**; applicability to the **running daemon's loaded code** is governed by §12.1.3 (c) and is UNKNOWN.

**12.1.5 Operator bundle (C) — `%TEMP%\aisb-01c6a-operator-review\`, read-only (corrected 2026-09-18, §12.9):** 39 accepted entries across `REVIEW-SHA256.txt` + `TRANSFER.manifest`. All 21 frozen-list files present. `__pycache__` not present. Nothing executed; no protected values read; no bundle file or manifest was normalized, repaired, regenerated, or overwritten.

**Frozen procedure (§4 step 1–2, 5):** raw `Get-FileHash -Algorithm SHA256` over the frozen list, compared to the accepted values; **static read of matched files only**; mismatches recorded as limitations and not silently accepted.

**Actual result under the frozen procedure (raw bytes):**

| Raw SHA-256 vs accepted | Files |
|---|---|
| **RAW_MATCH** — 1 | `TRANSFER.manifest` (value listed in `REVIEW-SHA256.txt`) |
| **RAW_MISMATCH** — 20 | `OPERATOR-BUNDLE.md`, `bin/verify-transfer.py`, `lib/overlay_restore.py`, `lib/supervise.py`, `lib/orchestrate.py`, `lib/vault.py`, `lib/accepted_result.py`, `lib/cleanup_contract.py`, `lib/reconcile.py`, `lib/secret_io.py`, `lib/process_alive.py`, `lib/config_deadlines.py`, `bin/restore-overlays.sh`, `bin/run-canary-supervised.sh`, `bin/orchestrate-canary.sh`, `tests/test_operator_bundle.py`, `config/defaults.env`, `config/xai-observation-addrs.txt`, `bin/mock-pm2.py` (all 20 local copies contain CRLF) |
| Not self-listed (expected) | `REVIEW-SHA256.txt` |

**Deviation recorded:** Step 3 additionally computed SHA-256 over a CRLF→LF **in-memory** transformation of each file's bytes (files on disk untouched). For all 20 raw-mismatch files that normalized-content hash equals the accepted value exactly. This is a **normalized-content equivalence**, not the raw match the frozen procedure required. Under the frozen rule "audit only what matches", the strictly matched set is `TRANSFER.manifest` alone; the static readings in §12.2–§12.4 of the other 20 files were performed on **normalized-equivalent, not raw-verified** copies and are therefore recorded with that qualification. The static findings are retained because line-ending transformation does not alter Python/shell control flow, but the bundle **cannot** be claimed as transfer-verified or accepted-hash-verified in its present on-disk form, and `bin/verify-transfer.py` / `TRANSFER.manifest` raw verification would fail against these copies. 18 additional manifest files (capture/pcap/tcpdump helpers) lie outside the frozen audit set and were raw-hashed only (not compared for audit purposes, not read).

### 12.2 F1–F5 and relevant P1–P8 findings (7.0.3 source, decisive references)

**Transport facts (observed implementation at pm2 7.0.3, not documented guarantees; daemon-side applicability to the live process per §12.1.3 (c)):**

- **Delivery:** `Client.executeRemote` (`lib/Client.js` l.504–541) → `rpc.Client.call` (`modules/pm2-axon-rpc/lib/client.js` l.30–48) → `ReqSocket.send` (`modules/pm2-axon/lib/sockets/req.js` l.80–101): allocates `fn.id`, stores the callback in `this.callbacks`, and `sock.write(this.pack(args))`. If no peer is connected the message is **enqueued** (`plugins/queue.js` l.56–60, bounded by `hwm`) and **replayed on `connect`** (l.39–50). `Socket.connect` (`sockets/sock.js` l.257–306) **auto-reconnects** on `close` with 100 ms → 5 s backoff (l.286–298) unless `retry timeout` is 0. **There is no request timeout anywhere in the client path.**
- **Dispatch:** `Daemon` binds one `rep` socket on `rpc.sock` (`lib/Daemon.js` l.132–136) and exposes `God` methods (l.215–247; `restartProcessId` l.225, `getMonitorData` l.220, `ping` l.247, `killMe` l.216). `RepSocket.onmessage` (`sockets/rep.js` l.41–51) pops the request id and emits `message`; `rpc.Server.onmessage` (`server.js` l.72–105) looks the method up and **invokes it synchronously on receipt** (`fn.apply(null, args)` l.104). Node's single thread plus per-connection stream framing (`amp` `Parser`, `sock.js` l.190–194) gives **FIFO dispatch within one connection**. Ordering **across** connections is by kernel readiness/event-loop interleaving and is not specified.
- **Env mutation point:** `God.restartProcessId` (`lib/God/ActionMethods.js` l.387–425) performs `Utility.extend(proc.pm2_env.env, env)` at **l.405 — before** `stopProcessId` (l.412) and `startProcessId` (l.416). **If** the handler reaches l.405, the overlay is merged into daemon memory at that point, independent of whether the subsequent stop/start completes or whether any reply is written. Handler entry does **not** imply the merge: l.391–394 return early (`opts.id` undefined; id not in `God.clusters_db`) before l.405. A client `write()` or a client-side timeout proves neither daemon receipt, nor handler execution, nor that l.405 ran. With `--update-env`, the CLI constructs `new_env` from **its own** `process.env` plus the action's explicit `envs` (`lib/API.js` l.1361–1369); what that `process.env` contains is determined by whoever spawned the CLI (for the bundle, `_child_env_for_pm2()` — see D4, §12.4).
- **Asynchronous completion:** the reply is issued only from the `startProcessId` callback (`executeApp` → `forkMode`/`nodeApp` → `cb`), i.e. after `killProcess`/`processIsDead` (up to `KILL_TIMEOUT` 1600 ms, `constants.js` l.105) and spawn. The child's actual environment is built at spawn from **top-level** `pm2_env` scalars (`lib/God/ForkMode.js` l.95–102) after `executeApp` copies `pm2_env.env` onto the top level (`lib/God.js` l.176–178). Auto-restart (`God.handleExit` l.513–519) re-runs `executeApp(proc.pm2_env)` — so a merged-but-not-yet-spawned overlay **applies at the next crash/auto-restart** without any client command.
- **Acknowledgement:** `reply()` (`rep.js` l.53–70) writes only `if (sock.writable)`; otherwise it logs "peer went away" and **discards the reply** (l.66–69). The daemon has no retry, no completion log, and no per-request identity persistence. `ReqSocket.onmessage` (`req.js` l.59–70) drops replies with no matching callback (`missing callback`).
- **Persistence — source-supported paths only (corrected 2026-09-18, §12.9):** a merged `pm2_env.env` reaches `dump.pm2` only when a dump is written **after** the merge. Three dump writers exist at 7.0.3: (1) CLI `pm2 save` / `pm2 dump` — `CLI.prototype.dump` (`lib/API/Startup.js` l.423–500) calls `getMonitorData` and writes each `pm2_env` (including `.env`) to `DUMP_FILE_PATH` (l.482); (2) daemon-side `God.dumpProcessList` (`ActionMethods.js` l.127–198), invoked from **signal-driven** `Daemon.prototype.gracefullExit` (`Daemon.js` l.325–360; wired to SIGTERM/SIGINT/SIGQUIT at l.297–300) which dumps, then deletes processes, then exits; (3) `pm2 update` — `API.update` (`API.js` l.397–410) calls `that.dump(...)` **before** `killDaemon`, then relaunches and `resurrect`s. **The CLI `pm2 kill` path does not dump:** `API.killDaemon` (`API.js` l.629–653) sends `notifyKillPM2` (sets `God.pm2_being_killed`, `ActionMethods.js` l.215–216), runs `_operate('deleteProcessId','all')` (l.636), then `Client.killDaemon` → RPC `killMe` (`Client.js` l.554–590) → `Daemon.prototype.close` (`Daemon.js` l.256–292), which closes the sockets, unlinks the pid file and exits **without** calling `gracefullExit` or `dumpProcessList`. Therefore: after `pm2 kill`, `pm2 resurrect` restores whatever the **last prior dump** contained — a merged overlay survives that sequence **only if** a `save`/`dump`/`update`/signal-exit dump occurred after the merge; if the last dump predates the merge, the merge is lost with the daemon's memory. The earlier unconditional statement that a merged overlay "survives `pm2 kill` + `pm2 resurrect`" is withdrawn. None of this makes daemon shutdown a fence: `deleteProcessId('all')` and `close` do not drain or account for in-flight or buffered frames, and `pm2_being_killed` only aborts restarts that check it (l.408/413) after the l.405 merge.
- **Daemon replacement / `pm2 update`:** `API.update` dumps first (l.406), then `killDaemon`, `launchDaemon`, `launchRPC`, `resurrect` (l.407–410); `Daemon.js` l.51 is the daemon-side self-update spawn. A merge present at the time of the `update` dump is carried into the new daemon. No path drains in-flight RPCs before the dump.
- **`ping`:** `God.ping` (`ActionMethods.js` l.207–209) returns `pong` immediately. Because dispatch is synchronous and FIFO **per connection**, a `pong` on the **same connection** after a `restartProcessId` frame shows that the restart frame was **dispatched** (handler invoked) before the ping was dispatched. It does **not** show that l.405 ran (the handler may have returned at l.391–394), does **not** show stop/start completion (those are asynchronous and reply later), and shows nothing about frames on **other** connections, about a prior connection generation of the same client, or about operations still outstanding from earlier frames. On a **new** connection (the bundle's `CliPm2` spawns a fresh `pm2` client per call) a later `ping`/`jlist` reply is **not** a completion or ordering barrier.
- **Concurrency:** `API._operate` uses `eachLimit(ids, concurrent_actions)` (`API.js` l.1352) with `CONCURRENT_ACTIONS` = 2 (`constants.js` l.92–95; staging banner confirms `Concurrent actions : 2`), so a multi-target restart issues concurrent RPCs on one connection; single-app `restart <name> --update-env` issues one.

**Failure-mode matrix (client = `pm2 restart <app> --update-env` child process spawned by the bundle with a 20 s `subprocess` timeout):**

Column meanings: "Frame received by daemon" = the daemon's event loop read and framed the request (not merely that the client's `write()` returned); "l.405 merge" = the handler reached the merge line (requires receipt **and** passing l.391–394). Neither column is observable by the client; entries state what the source *permits*, not what any run *did*.

| Scenario | Frame received by daemon? | l.405 merge? | Reply | Observable to client | Fate class |
|---|---|---|---|---|---|
| Daemon absent / socket missing | No — client `pingDaemon` fails; `Client.start` would **launch a new daemon** (`Client.js` l.51–67) | No | — | Error / new daemon | `CLIENT_NOT_DELIVERED` (but daemon spawn is a side effect) |
| Client killed by `TimeoutExpired` after client `write()` returned | **UNKNOWN** — bytes may sit in the kernel socket buffer and be read later, or be discarded with the closed peer; the source gives no observable to distinguish | **UNKNOWN** — if received and id valid, merge occurs synchronously on read | If produced, discarded (`peer went away`) or written to a dead socket | Nothing | **`ACK_LOST` — fate UNKNOWN (merge possible, not established)** |
| Client killed before `write` (enqueue phase) | No | No | — | Nothing | `CLIENT_NOT_DELIVERED` |
| Stop hangs (child ignores SIGINT) after receipt | Yes | Yes | Delayed ≥ `KILL_TIMEOUT`; may exceed 20 s | Timeout | `DELIVERED_UNACKED` → merge in memory; spawn happens later or never |
| Daemon crash after receipt, before stop/start | Yes | Yes (in memory only) | None | Connection close → client reconnect loop | Merge lost **unless** a dump ran after it; `dump.pm2` may predate the merge |
| Signal-driven `gracefullExit` after receipt | Yes | Yes | None | Close | Merge **persisted** via `dumpProcessList`; a later `resurrect` applies it |
| CLI `pm2 kill` (`killDaemon` → `deleteProcessId all` → `killMe` → `close`) after receipt | Yes | Yes | None to the timed-out client | Close | **No dump on this path**; merge survives only if a prior `save`/`dump`/`update`/signal dump captured it |
| Reconnect with queued frame | Late | Late, after daemon returns | Possibly | Client may already be dead | Replay hazard: a frame the operator believes was never sent applies later (live client only) |
| Competing client on another connection | Yes | Interleaved at event-loop granularity | Yes | Each sees only its own reply | Cross-connection order undefined |

**F1 — daemon-side fate of an ACK_LOST command is knowable:** **NOT ESTABLISHED in the inspected version and scope.** No RPC found returns a request journal, sequence number, or completion record; replies are best-effort and unlogged; `pm2.log` records app lifecycle (`Stopping app`, `online`) but not request identity or the env merge. FIFO does not waive F1: FIFO orders frames on one connection but the killed client's frame either was or was not read by the daemon, and nothing observable distinguishes the two except the *effect* (a later restart with the overlay present, or a `jlist` showing merged values after a spawn). **Insufficient evidence** to establish F1 by any passive means; a behavioral probe (canary) would itself be a mutation.

**F2 — last mutation wins / no later replay:** **NOT ESTABLISHED.** What the source supports is narrower: **dispatch order** of frames is FIFO **within one connection** (synchronous invoke at `server.js` l.104; per-connection `amp` framing), and `Utility.extend` is last-writer-wins **at the moment each handler runs**. That does not yet give F2, because F2 additionally requires: (i) no frames from an earlier **connection generation** of the same or a predecessor client remain buffered or queued (`queue.js` replay from a live client; kernel buffers from a dead one); (ii) no **outstanding asynchronous operations** from earlier frames (stop/kill timers, `restart_task`, auto-restart `executeApp`) will re-spawn from `pm2_env` after the "last" mutation; (iii) no **competing writer** on another connection interleaves (kernel/event-loop order is unspecified); (iv) the "last" restart's own **completion** is known (F3). The bundle's one-process-per-command adapter opens a new connection per command, so even condition (i) is not met for the bundle as written. Replay from `queue.js` requires a live client; a killed client cannot replay, which removes that one source of later frames but not kernel-buffered bytes or the other conditions.

**F3 — proof of daemon completion / quiescence / cancellation:** **NOT ESTABLISHED.** No cancellation exists (merge is irreversible except by a compensating `--update-env`). Quiescence is not exposed. Same-connection `ping` after `restart` shows dispatch ordering only — not that l.405 ran, and not restart completion. `getMonitorData` returns live `pm2_env` references (`Methods.js` l.82) whose `status` field (`online`/`stopping`/`launching`) is observable, but a status transition shows a spawn happened, not that it was *this* command's spawn.

**F4 — named-key restore verification:** **PARTIALLY SUPPORTED, WITH A BLIND SPOT.** `jlist` top-level `pm2_env` fields reflect the environment of the **last spawn** (`God.js` l.178 copy at `executeApp`), so they can verify what a currently running child sees. They do **not** reflect a merge sitting only in `pm2_env.env` (l.405) that has not yet spawned. The bundle's `dump_env` reads top-level fields (`overlay_restore.py` l.155) and therefore **cannot detect a latent pending overlay** that will apply at the next auto-restart. A complete F4 check must compare **both** top-level `pm2_env[k]` **and** `pm2_env.env[k]` for each named key.

**F5 — automation reports `restore_ok=True` only when F1–F4 hold:** **NOT MET — statically established possible control-flow path** in the bundle sets `restore_ok=True` without any F1–F4 input (§12.4). Not executed or reproduced.

**P1–P8 (UNKNOWN_PENDING_OVERLAY host-clean gate, PM2-FENCE-01 stage-start §6.4; IDs used with their frozen meanings — corrected 2026-09-18, §12.9):**

| ID | Frozen meaning | Step 3 finding |
|---|---|---|
| P1 | Keith has authorized the UNKNOWN_PENDING_OVERLAY policy in a later control-plane step | **NOT RECORDED.** No authorization exists; this report does not request or grant it. |
| P2 | Result class for the overlapping overlay remains `UNKNOWN_PENDING_OVERLAY`, never rewritten to restore success | **Bundle as written would violate P2**: the D1 path (§12.4) rewrites an apply-timeout outcome to `restore_ok=True` / `overlays_restored=True`. Remediation requirement, not implemented. |
| P3 | Recovery vault is intact | **Bundle as written would violate P3**: the D1 path calls `delete_protected_recovery` (`*.value` + `pending_apps.json`) on snapshot match. Remediation requirement, not implemented. |
| P4 | Exclusive operator control of the named PM2 apps attested: no concurrent 01C6A overlay CLI, no other authorized overlay dispatcher, no competing `--update-env` | **NOT ESTABLISHED; not a source finding.** Point-in-time passive observation (single daemon; no other `rpc.sock` holders at inspection) is not an attestation of exclusive control. `monitoring/watchdog/ops-watchdog.js` contains no `pm2`/`child_process`/`spawn`/`restart` invocation — it is not itself a PM2 writer; that is one input to a future P4 attestation, not the attestation. |
| P5 | Operator-owned PM2 CLI children for the overlay/restore commands confirmed absent (process-table evidence of those operator children); proves client absence, not daemon quiescence | **NOT ESTABLISHED.** Step 3 did not inspect the process table for operator-owned `pm2 restart --update-env` / `jlist` children (outside A1–A8). Source finding relevant to P5: `subprocess.check_call(timeout=…)` kills the client on timeout, so client absence after a `TimeoutExpired` is expected — and, as §6.4 states, insufficient alone. |
| P6 | After P4 and P5, named keys on named apps match the preserved baseline by a Keith-authorized verification procedure | **NOT ESTABLISHED; procedure not authorized.** Source finding relevant to a future P6 procedure: `jlist` top-level `pm2_env[k]` reflects the last spawn only; a complete named-key comparison must also inspect `pm2_env.env[k]` (F4 blind spot, D2). |
| P7 | Keith attests residual daemon-buffer risk is accepted for this host at this time; `jlist` is not the fence | **NOT RECORDED.** Not requested or granted here. |
| P8 | EXEC-01C6A reopen, if ever, is a separate Keith authorization after CLEAN | **NOT RECORDED; NOT REQUESTED.** EXEC-01C6A remains `startCondition=NOT_READY`. |

Note: the earlier text of this paragraph mislabelled P6 as "bounded blast radius", P7 as "next-run blocking", and P8 as "operator-verified reconciliation"; those are not the frozen meanings and have been removed. The underlying observations survive under their correct homes: payload breadth → D4 (§12.4); next-run blocking → remediation requirement R-D1c (§12.4), which is a mechanism that would serve P2/P3 continuity between runs and is not itself a P-ID; `reconcile.py` `ACK_UNKNOWN` handling concerns canary-job acknowledgements and is not a PM2-overlay control.

### 12.3 Per-mechanism verdicts

| Mechanism | Verdict | Reason |
|---|---|---|
| Later `pm2 ping` (new connection) as completion barrier | **REJECTED** | New connection; no cross-connection order; `God.ping` is a pure `pong`. |
| Same-connection sequenced `restart` then `ping` | **DESIGN CANDIDATE — INSUFFICIENT AS EVIDENCED; open conditions** | Source supports only: the restart frame was **dispatched** before the `pong` on that connection. It does **not** establish that l.405 ran (early returns l.391–394), restart completion (F3), or anything about other connections. To become a supported F2 mechanism it must additionally prove: no buffered/queued frames from earlier connection generations; no outstanding asynchronous restart/auto-restart operations; no competing writers (operational P4); and a completion semantic for the restart itself. Requires a long-lived single client connection (not the CLI-per-command adapter). Not implemented; not a fence. |
| `jlist` snapshot equality after restore | **INSUFFICIENT** | Top-level fields only; blind to latent `pm2_env.env` merge; not a fate proof. |
| Dual-field `jlist` check (`pm2_env[k]` **and** `pm2_env.env[k]`) | **DESIGN CANDIDATE (verification input only)** | Would detect a latent pending overlay visible in daemon memory; still not a fate proof for the ACK_LOST command itself and not a completion barrier. Relevant to a future P6 procedure; not authorized. |
| Reconnect-queue replay as risk | **REJECTED as a source of later frames when the client is dead**; **RETAINED as risk if the client survives** | `queue.js` only flushes from a live client. Kernel-buffered bytes from a dead client are a separate, unresolved risk (F1). |
| Daemon shutdown / `pm2 kill` / `resurrect` to "clear" or "fence" state | **REJECTED** | No shutdown path drains or accounts for in-flight or buffered frames. Persistence of a merge across shutdown depends on whether a dump (`save`/`dump`/`update`/signal `gracefullExit`) ran after the merge; CLI `pm2 kill` itself does not dump (§12.2). Outcome is therefore path-dependent and unobservable to the operator without reading `dump.pm2` (prohibited). Not a fence. |
| Watchdog takeover (`restore_always` from watchdog thread) | **REJECTED as fence** | Single-owner restore lock (`orchestrate.py` l.244–288) prevents double restore but has no daemon-side fate input; it inherits the F5 defect. |
| Log-based fate proof (`pm2.log` app lines) | **INSUFFICIENT** | Lifecycle lines lack request identity; cannot attribute a `Stopping app` line to a specific timed-out command. |
| `pm2 save` / `dump.pm2` inspection | **INSUFFICIENT / MUTATING** | `pm2 save` is a client command (prohibited in A); reading `dump.pm2` exposes env values (prohibited). |
| Host exclusivity from source | **NOT A SOURCE FINDING** | P4/P5 operational only. |

### 12.4 Statically established bundle defects and exact remediation requirements

Reading basis (§12.1.5): the files below were read on local copies whose **normalized-content** SHA-256 equals the accepted value but whose **raw** SHA-256 does not (CRLF). Line numbers refer to those copies. Nothing below was executed or reproduced; "path" means a control-flow path the source permits.

**Defect D1 — overlay-apply `TimeoutExpired` → generic exception → restore snapshot match → success flags → pending-marker / recovery-material deletion (would violate F5, P2, P3). Statically established possible control-flow path:**

1. `orchestrate.py` l.456 `apply_fn()` → `driver_apply` (l.414–415) → `apply_overlay_payloads` (`overlay_restore.py` l.386–395) → `pm2.restart_update_env` (rebound to `gated_restart`, `orchestrate.py` l.435–440) → `CliPm2.restart_update_env` (`overlay_restore.py` l.126–136): `subprocess.check_call([pm2, "restart", app, "--update-env"], env=_child_env_for_pm2(overlay), timeout=20)`. On timeout `check_call` **kills the pm2 client** and raises `subprocess.TimeoutExpired`. This is the `ACK_LOST` shape: whether the daemon received the frame and merged is **UNKNOWN** to the bundle (§12.2 matrix).
2. No handler catches `TimeoutExpired` specifically. It propagates to `orchestrate.py` l.634 `except Exception as exc:` → `reasons.append("ORCHESTRATE_ERROR:TimeoutExpired…")` → l.637 `restore_always()`.
3. `restore_always` (l.244–288) → `restore_overlays` (`overlay_restore.py` l.606–705): for each app, `pm2.restart_update_env(app, baseline)` (l.656) then `actual = pm2.dump_env(app)` (l.657, top-level fields only, l.155) → `compare_restore` → on match `apps_restored.append(app)` and **`clear_pending_app(vault_dir, app)`** (l.669) → `ok = matched and len(apps_restored) == len(apps)` (l.682) → `RestoreResult(ok=True, preserved_vault=False)`.
4. Back in `restore_always`: `restore_ok = result.ok` (l.277), `overlays_restored = result.ok` (l.278), and if `due is None` → **`delete_vault_fn()`** (l.280–281) → `delete_protected_recovery` (`vault.py` l.192–212) removes every `*.value` and **`pending_apps.json`**.
5. `finish("INCOMPLETE", next_canary=False…)` (l.639) — the run is classified INCOMPLETE, but the emitted JSON carries `restore_ok: true`, `overlays_restored: true`, `vault_preserved: false`, and the UNKNOWN latch is gone.

Possible consequences the source permits (not observed): (a) if the timed-out overlay frame was received and merged but its spawn is pending or hung, or if the restore's own restart was received and merged but its spawn had not yet occurred when `dump_env` ran, `dump_env` may still match the baseline top-level fields while `pm2_env.env` holds a different value → that value applies on a later spawn with recovery material already deleted; (b) the next orchestrate run finds no `pending_apps.json` and proceeds. The test suite encodes the flags-after-exception behaviour as expected (`tests/test_operator_bundle.py` l.1043–1078 `test_mark_before_apply_restores_after_exception` asserts `overlays_restored` True after an apply exception; the fake PM2 applies synchronously and cannot represent daemon-side latent state; no test exercises `TimeoutExpired` on overlay apply). Tests were read, not run.

**Defect D2 — F4 blind spot:** `CliPm2.dump_env` returns `pm2_env` top-level only (l.155); `compare_restore` never inspects `pm2_env.env`.

**Defect D3 — per-command client connections:** `CliPm2` spawns a new `pm2` process per command; even same-connection dispatch ordering therefore does not hold between apply, restore, and any concurrent operator command (F2 conditions §12.2 unmet).

**Finding D4 — `--update-env` payload composition (corrected 2026-09-18, §12.9; a residual-exposure assessment, not an absence-of-filtering defect):** the bundle does **not** forward the parent operator environment. `CliPm2.restart_update_env` passes `env=_child_env_for_pm2(overlay)` (`overlay_restore.py` l.134); `_child_env_for_pm2` (l.88–113) builds the pm2 client's environment from an explicit **allowlist** — `PATH`, `PATHEXT`, `SYSTEMROOT`, `SYSTEMDRIVE`, `WINDIR`, `COMSPEC`, `MOCK_PM2_STATE`, `PYTHONPATH`, `PYTHONHOME`, `PYTHONIOENCODING`, `TEMP`, `TMP`, `HOME`, `USERPROFILE`, `LANG`, `LC_ALL` — copied from `os.environ` only where present, plus the overlay keys. PM2 then sends **that** `process.env` plus explicit `envs` (`API.js` l.1361–1369). Remaining exposure, from the allowlist itself: on Linux staging the keys plausibly present are `PATH`, `HOME`, `LANG`, `LC_ALL`, `TEMP`/`TMP` (if set), `PYTHONPATH`/`PYTHONHOME`/`PYTHONIOENCODING` (if set by the orchestrator's launcher), and `MOCK_PM2_STATE` (test-only; should be absent in a live window). Each of these is merged into the target app's `pm2_env.env` on every overlay and restore and persists there (subject to §12.2 persistence paths) — e.g. an operator `PATH` or `PYTHONPATH` replacing the app's. Not assessed: variables the pm2 CLI itself sets on its own `process.env` before `_operate` (not exhaustively traced). Values were not read.

**Ack-class separation:** `reconcile.py` `EXIT_ACK_UNKNOWN` (l.23, l.190–199) and `accepted_result.py` `ack_unknown` concern **canary-job** submission acknowledgements and correctly latch `prohibit_next_canary=True`. They are **not** PM2-overlay acknowledgements and do not protect the overlay path.

**Exact remediation requirements (findings only; UNREGISTERED; UNAUTHORIZED; not implemented). P-IDs cited with their frozen §6.4 meanings:**

- R-D1a (serves P2): treat `subprocess.TimeoutExpired` (and any killed/non-zero client exit whose frame may have been written) on **apply** and on **restore** as the distinct outcome `UNKNOWN_PENDING_OVERLAY`; set `restore_ok=False`, `overlays_restored=False`, `vault_preserved=True`; never rewrite that outcome to success.
- R-D1b (serves P2): `restore_overlays` must treat a restore-side `TimeoutExpired` as `apps_failed` **and** as UNKNOWN (not merely mismatch), since the compensating merge's fate is equally unknown.
- R-D1c (serves P3 and continuity of P2 across runs): under UNKNOWN, never call `delete_vault_fn()` or `clear_pending_app()`; persist an explicit UNKNOWN marker (e.g. `pending_apps.json` retained plus `unknown_overlay.json` with app, keys, timestamps) that `refuse_unresolved_vault` (`vault.py` l.187) rejects at the next run start until a Keith-authorized P6 verification procedure, performed after P4/P5, clears it. This mechanism is not itself P4–P8 and does not substitute for them.
- R-D2 (input to a future P6 procedure): `dump_env` must return both top-level `pm2_env[k]` and `pm2_env.env[k]`; `compare_restore` must require equality on both for every named key; a top-level/`.env` divergence is itself `UNKNOWN_PENDING_OVERLAY`.
- R-D3 (only if a fence is pursued; does not by itself establish F2): replace per-command CLI spawns with one long-lived RPC connection (Node client using the vendored `pm2-axon-rpc`, or pm2's programmatic API) so apply → verify → restore → ping are dispatched in order on one connection; and **prove** the open conditions of §12.3 — no buffered/queued frames from earlier connection generations, no outstanding asynchronous restart/auto-restart operations, a restart-completion semantic, and operational P4/P5 evidence before each window.
- R-D4 (assessment of the existing allowlist; not "add filtering"): review each `_child_env_for_pm2` allowlist key for necessity on the Linux target (Windows-only keys are inert there; `MOCK_PM2_STATE` must be absent in live windows; `PYTHONPATH`/`PYTHONHOME`/`PATH`/`HOME`/`LANG`/`LC_ALL`/`TEMP`/`TMP` are merged into the app's `pm2_env.env` on every overlay/restore) and decide per key whether it must be forwarded to the pm2 CLI at all; record the decision. No change is implemented here.
- R-T: add tests where the fake PM2 (a) raises `TimeoutExpired` after applying the merge, (b) reports top-level/`.env` divergence; assert vault preserved, UNKNOWN marker present, `restore_ok=False`.
- R-M: before any Linux transfer, obtain an LF-faithful copy of the bundle (e.g. re-extract from the original archive or checkout with LF) and re-verify **raw** SHA-256 against `REVIEW-SHA256.txt` / `TRANSFER.manifest`; the present local copies do not raw-verify (§12.1.5). This correction pass did not modify any bundle file or manifest.

### 12.5 Smallest useful proposal — UNREGISTERED

**Option A (recovery-policy mechanics, smallest):** implement R-D1a/b/c, R-D2, R-D4 (assessment), R-T only, in the operator bundle. Outcome: the bundle would keep `UNKNOWN_PENDING_OVERLAY` as UNKNOWN (P2 mechanics), retain recovery material (P3 mechanics), block the next run until cleared, and expose the dual-field input a future P6 procedure needs. This does **not** implement a fence, does **not** establish F1–F3, and does **not** by itself satisfy `OUTCOME_UNKNOWN_POLICY`: that outcome additionally requires P1 (Keith's policy authorization), P4/P5 (operational exclusivity / client-absence attestations), P6 (Keith-authorized verification procedure), P7 (Keith's explicit residual daemon-buffer risk acceptance), and P8 (separate reopen authorization) — none of which this report records or requests.

**Option B (fence candidate, larger):** Option A plus R-D3. As evidenced here it establishes only same-connection **dispatch ordering**; it does **not yet** establish F2 or F3. Conditions that would still have to be proven: no frames from earlier connection generations; no outstanding asynchronous operations; no competing writers (operational P4); a restart-completion semantic; and the long-lived fence client's own survival across the window (supervisor/pidfile evidence). F1 remains unaddressed for the client-death case.

Neither option is registered, admitted, or authorized by this report. Neither selects a policy, accepts residual risk, declares host CLEAN, or is a reopen gate for EXEC-01C6A.

### 12.6 Remaining authorization decisions (Keith)

1. Whether to register a bounded implementation task for Option A (recovery policy) or Option B (fence candidate) — per CLAUDE.md Next-Work Selection Protocol; this is a named-task light check, not a frontier audit.
2. Whether the `UNKNOWN_PENDING_OVERLAY` policy is to be authorized at all (P1) and, separately, whether residual daemon-buffer risk is accepted for the shared staging PM2 worker (P7) — neither is decided or requested here.
3. Whether P4/P5 attestations (exclusive operator control; operator-owned overlay/restore CLI children absent) may be collected operationally during a later authorized window, and what Keith-authorized P6 verification procedure would follow them.
4. Whether Step 4 (checkpoint / lock of this investigation) is authorized.

### 12.7 Missing inputs and next actions (Step 3)

| Input | Status | Next action |
|---|---|---|
| Staging PM2 / transport identity | **OBTAINED** (7.0.3; vendored axon; amp 0.3.1; amp-message 0.1.2) | none |
| Running-daemon version | **CORROBORATED** (title + banner 7.0.3) | none |
| Running-daemon loaded-code identity | **UNKNOWN** (§12.1.3 (c)); freeze UNKNOWN rule applied to daemon-side findings | none authorized; a future daemon started from the hashed tree would load the verified bytes |
| Vendored `pm2-axon*` upstream version tags | **UNAVAILABLE** at 7.0.3 (no per-module `package.json`); hashes recorded instead | none required; artifact hash governs |
| Bundle raw-hash verification | **NOT MET** (20/21 raw mismatch, CRLF); normalized-content equivalence recorded as a deviation (§12.1.5) | R-M before any transfer; no file touched here |
| P4 / P5 attestations | **NOT ESTABLISHED**; not obtainable from source; point-in-time passive observation only | decision 3 above |
| Behavioral confirmation of ACK_LOST receipt/merge | **NOT AUTHORIZED** (would mutate) | only under a registered task with a disposable PM2 home |

### 12.8 Activity ledger (Step 3 window)

LIVE=read-only SSH only; SSH=YES (`ssh aisandbox-staging 'bash -s'` as `ubuntu`, scripts piped from stdin, nothing uploaded, frozen A1–A8 plus the bounded A3/A8 adaptations recorded in §12.1.1); staging mutation=0; PM2 client invocations=0; environment/secret/vault/app-log reads=0; AWS=0; provider=0; credits=0; Docker=0; Postgres=0; Redis=0; flags=0; canary submission=0; vendor-source fetch=YES (3 registry tarballs + 1 registry metadata JSON + 1 docs HTML; extracted with tar; not installed; no scripts executed); operator-bundle hashes computed=YES (39 manifest entries; 21 frozen files); operator-bundle content reads=YES (frozen list only; no `.value`/protected reads); operator-bundle mutation=0; Python/tests/mocks executed=0; application source=0; local application tests=0; tests executed=0 except lane-capacity validator; dependencies=0; migrations=0; PRD.md=0; ARCHITECTURE.md=0; CLAUDE.md=0; AGENTS.md=0; validator edits=0; mutex-catalog edits=0; `lane-saturation-state.json`=0; predecessor bodies=0; prepared canary artifacts=0; Git commit/push=0; Lane 1/2 admission=0; Lane 3=0; EXEC-01C6A reopened=0; successor registered=0; implementation candidate created=0; Step 4=0.

Governance writes (Step 3): this document (§12 + header status); `TASKS.md` current board fields; `TASKS_BACKLOG_FULL.md` PM2-DAEMON-INVESTIGATION-01 body only; `docs/control-plane/SATURATION_PROOF.json` only as validator output. GOVERNANCE acquired transiently for this control-plane write then released UNOWNED. STAGING used transiently for read-only SSH inspection only (no PM2 client, no mutation) then released UNOWNED. End-state occupancy EMPTY / GOVERNANCE UNOWNED.

### 12.9 Step 3 correction ledger (2026-09-18; Keith-authorized documentation-only pass)

Scope: corrections to the §12 findings and the current header only. §2–§11 (Step 2 freeze) unchanged. No Step 4, no lock, no successor, no EXEC-01C6A reopen. No investigation repeated: sources are the existing `%TEMP%\pm2inv` captures/artifacts and the existing operator-review bundle, statically re-read; nothing executed; no SSH, PM2, staging, or network access in this pass.

| # | Correction | Where | Source basis |
|---|---|---|---|
| 1 | P1–P8 restored to frozen §6.4 meanings (P1 Keith policy authorization; P2 UNKNOWN stays UNKNOWN; P3 vault intact; P4 exclusive operator control; P5 operator CLI children absent; P6 named-key verification after P4/P5; P7 Keith residual daemon-buffer risk acceptance; P8 separate reopen authorization). Mislabelled P6/P7/P8 uses removed from findings, remediation items, Options A/B, and decisions. | Lead verdict; §12.2 P-table; §12.4 R-items; §12.5; §12.6 | `docs/AGENT-PLATFORM-EXEC-01C6A-PM2-FENCE-01-STAGE-START.md` §6.4 l.267–274 |
| 2 | Environment forwarding: D4 re-characterised as an allowlist assessment; `_child_env_for_pm2()` allowlist enumerated; remaining exposure stated; R-D4 rewritten as per-key assessment; "entire operator environment" claim withdrawn. | §12.2 env-mutation bullet; §12.4 D4, R-D4 | `overlay_restore.py` l.88–113, l.134; `API.js` l.1361–1369 |
| 3 | Shutdown paths distinguished: CLI `pm2 kill` (`API.killDaemon` → `deleteProcessId all` → `killMe` → `Daemon.close`, no dump) vs signal-driven `gracefullExit` (dumps) vs `pm2 save`/`dump` vs `pm2 update` (dumps before kill). Unconditional "merge survives `pm2 kill` + `resurrect`" withdrawn; shutdown not endorsed as a fence. | §12.2 persistence + replacement bullets; matrix rows; §12.3 kill row | `API.js` l.397–410, l.629–657; `Client.js` l.554–590; `Daemon.js` l.256–292, l.297–300, l.325–360; `ActionMethods.js` l.127–198, l.215–216, l.408/413; `Startup.js` l.423–500 |
| 4 | Ordering/fate narrowed: write/timeout ≠ receipt/handler/merge; handler entry ≠ merge (l.391–394 early returns); same-connection order ≠ completion; "very likely committed" removed; matrix columns redefined with UNKNOWN entries; F2 reclassified NOT ESTABLISHED with explicit open conditions; Option B no longer "establishes F2"; universal "no supported fence exists" replaced by the bounded not-established finding; header `FENCE_VERDICT` updated. | Lead verdict; §12.2 bullets, matrix, F1–F3; §12.3; §12.4 D1 step 1, D3; §12.5 | `ActionMethods.js` l.387–425; `server.js` l.104; `rep.js` l.53–70; `req.js` l.80–101; `queue.js` l.39–60; `sock.js` l.286–306 |
| 5 | Hash-procedure deviation recorded: raw SHA-256 result (1 RAW_MATCH, 20 RAW_MISMATCH) separated from in-memory CRLF→LF normalized-content equivalence; frozen "audit only matches" condition stated as not met for 20 files; static findings retained with that qualification; acceptance claims limited; no file/manifest normalized or modified. | §12.1.5; §12.4 reading basis; §12.7; header | Existing hash outputs (raw and normalized) from the Step 3 window; frozen §4 steps 1–2, 5 |
| 6 | Staging applicability separated into (a) installed on-disk source KNOWN, (b) daemon version CORROBORATED, (c) loaded-code identity UNKNOWN; freeze §2 UNKNOWN rule applied to daemon-side findings; A8 row qualified; header fields split; §12.7 rows split. Version-pinned source findings preserved. | Header; §12.1.1 A8 row; §12.1.3; §12.1.4 closing sentence; §12.2 heading; §12.7 | Existing A5/A6/A8 captures; freeze §2 UNKNOWN rule |

Retained unchanged in substance: D1 static control-flow path (now labelled statically established, not reproduced); D2 (F4 blind spot); D3; transport delivery/dispatch/ack facts; vendor artifact integrity; version inventory.

Correction-pass ledger: SSH=0, staging=0, PM2=0, AWS=0, network=0, vendor/bundle code executed=0, Python/tests/mocks=0, bundle/manifest/captured-output mutation=0, sidecar=0, predecessor bodies=0, application source=0, Git add/commit/push=0, successor registration=0, Step 4=0, EXEC-01C6A reopen=0. Writes: this document (§12 findings, header, this ledger); `TASKS.md` current board fields for this task; `TASKS_BACKLOG_FULL.md` this task's body; `docs/control-plane/SATURATION_PROOF.json` as validator output. GOVERNANCE acquired transiently then released UNOWNED. Occupancy EMPTY.
