# PM2-RECOVERY-P5-INVENTORY-01 — Stage-Start / Inspection Plan Freeze

**Task ID:** PM2-RECOVERY-P5-INVENTORY-01
**Step:** 2 — freeze bounded inventory inspection plan
**Date:** 2026-09-25
**Baseline:** `66eeb8fcec7416001925da5aa1e57993a81ac81c`
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-P5-INVENTORY-01 (Step 1 COMPLETE at HEAD `8d381aa4dbf69e7f528b16715c9042d5b134e206`)
**Dependencies:** PM2-RECOVERY-P5-JOURNAL-01 (COMPLETE AND LOCKED), PM2-RECOVERY-ACQUISITION-01 (COMPLETE AND LOCKED), PM2-RECOVERY-POLICY-01 (COMPLETE AND LOCKED), PM2-RECOVERY-BASELINE-GOV-01 (COMPLETE AND LOCKED). PM2-RECOVERY-CAPTURE-01 remains COMPLETE AND LOCKED and is not reopened.
**Acceptance object:** A bounded inventory finding that informs J-2 search-scope approval, records observed current accounts and default PM2-home candidates, and explicitly retains custom-location, historical, inaccessible, and incomplete-coverage uncertainties. An incomplete or blocked finding is a valid recorded outcome, not proof of absence.
**Step 2 correction #1:** 2026-09-25 — Keith-directed, 5 groups. (1) Trust provenance. (2) Enforced bounds. (3) Reliable outcomes. (4) Collection boundary. (5) Evidence and acceptance. See prior correction header for details.
**Step 2 correction #2:** 2026-09-28 — Keith-directed, 5 groups. (1) Bounds: byte-bounded capture. (2) Outcomes: stream separation, per-PID recording, classification precedence. (3) Traversal: explicit candidate checks. (4) Trust: authenticated channel with instance binding. (5) Verification: local synthetic tests. See prior correction header for details.
**Step 2 correction #3:** 2026-09-28 — Keith-directed, 3 groups. (1) Observation integrity: replaced silent candidate tests with stat recording every outcome (present/absent/inaccessible/error); glob-expansion failure detection; per-observation END markers; complete sub-result accounting; loop COMPLETE requires all closing markers; failed/missing sub-results propagate to INCOMPLETE; awk nonzero is FILTER_FAILURE not FILTER_NO_MATCH; ps nonzero is not necessarily process disappearance; SESSION_COMPLETE requires all observation END markers plus normal supervisor exit, not only START/END; INV-1 awk maxlines for per-observation line limit; INV-6 here-string for variable scope and PID limit. (2) Enforceable bounds: per-observation and session byte/line limits specified and enforced; line counting in reader threads with exact-line enforcement; execution deadline separated from total elapsed (includes detection 500ms + termination + reader drain + cleanup); termination is Kill/TerminateProcess on Windows (no SIGTERM); every interrupted observation classified. (3) Supervisor lifecycle: exact-budget boundary resolved; triggered limit takes precedence over process exit; blocking I/O outside shared lock; bounded stdin delivery with timeout; reader startup before stdin; normal-exit drain sequence; read/write/flush failure recorded as CAPTURE_FAILURE; exit code UNKNOWN when unavailable; file ownership per-thread; bounded reader-timeout outcome without concurrent close; extended verification Tests 6–11.
**Step 2 correction #4:** 2026-09-28 — Keith-directed, 3 groups, targeted. (1) Bounds: per-observation byte/line caps enforced remotely by the `cap` function on every pipeline and loop group (§2.0); TERM→KILL escalation via `timeout -k` on every producer, candidate `stat`, and per-PID `ps`; candidate limit 64; session timing starts at process launch before stdin delivery; single absolute drain deadline; stdin and close/persistence timeouts enforced through owner-thread joins; unsupported 191.5 s maximum removed. (2) Supervisor: exhaustion set when the last permitted byte/newline is reserved, before another Read; no trailing bytes beyond the last permitted newline; reserved counters distinguished from persisted counters; post-drain reconciliation; terminal-outcome precedence covering stdin failure, stdout OR stderr capture failure, reader/writer timeout, close failure, unknown exit status, and unclassified SSH failure — none fall through to session success. (3) Observation completeness: execution completeness (`EXEC_COMPLETE` / `SESSION_EXEC_COMPLETE`) separated from coverage (`COVERAGE_FULL` / `COVERAGE_INCOMPLETE`); inaccessible/unknown candidates, unresolved globs, failed or missing sub-results, candidate/PID-limit truncation propagate to `COVERAGE_INCOMPLETE`; per-PID RC-marker counts checked against attempted counts; attempted count incremented only for attempted PIDs. Designed tests extended to 1–16 with assertions for these requirements (DESIGNED, NOT EXECUTED).
**Step 2 correction #5:** 2026-09-28 — Keith-directed, localized; correction #4 architecture preserved. (1) Supervisor: shared 5 s drain deadline and every join's remaining time computed on the session `Stopwatch` (no `DateTime.UtcNow` for duration enforcement); `Process.Kill()` failure (`Win32Exception`, `NotSupportedException`, `InvalidOperationException`) handled without inferring exit, without bypassing `WaitForExit`, drain, or reconciliation; `killFailed` / `killError` / `killNote` recorded; reconciliation row 6 includes `killFailed`; Tests 14–15 extended (15a–15d). (2) INV-4: explicit `INV-4a` / `INV-4b` opening and END markers emitted by the script; parent/sub-observation mapping defined in §5.2; static traces for normal and interrupted cases in §2.4; Test 13d added. (3) Fixtures: Test 10 enumerates `/root/.pm2` and every fixture-derived candidate (CHECKS = 4, four RC markers); Test 13 split into 13a (pipeline cap; deterministic vs scheduling-dependent SIGPIPE assertions; non-SIGPIPE upstream codes preserved as recorded failures), 13b (candidate limit, short paths, in-cap closers present), 13c (output cap, long paths, missing in-cap closers accepted as `INCOMPLETE +TRUNCATED_BY_CAP`); cap-escalation rule updated for upstream status ∈ {0, 141}; `+UPSTREAM_FAILURE` secondary flag. Tests remain DESIGNED, NOT EXECUTED.

---

## §0. Invariants

1. This task does NOT reopen EXEC-01C6A. `startCondition=NOT_READY` is unchanged.
2. This task does NOT attest HOST_CLEAN, accept P7, or satisfy the reopen gate.
3. This task does NOT claim host-specific P5 satisfaction or unblock C-ACQ.
4. This task does NOT amend or reopen POLICY-01, ACQUISITION-01, BASELINE-GOV-01, CAPTURE-01, or P5-JOURNAL-01.
5. Locked predecessor document bodies remain physically unchanged.
6. The P5 process-table component and all other acquisition prerequisites (including E1) remain independently binding.
7. No implementation, canary, B(H) construction, verifier live use, or transfer is authorized.
8. Lane 3 remains DISABLED. INVITE-01 remains PARKED / UNAUTHORIZED / PROHIBITED.
9. An incomplete, blocked, or partial finding is a valid recorded outcome, not proof of absence.
10. Operator testimony may contribute evidence to the J-2 scope-approval gate. The inventory is one evidence source, not the exclusive source. Apply the adopted J-2 requirements.
11. SSH disconnect does not guarantee that all remote processes terminate. Remote cleanup is not assured (§9.9).
12. The daemon-title matching pattern detects only daemons using the matched title. It is not a guarantee of complete daemon detection (§9.8).
13. A pgrep no-match result does not establish daemon absence. It means no running process matched the pattern at observation time (§9.8).
14. SESSION_EXEC_COMPLETE classification requires all observation END markers, supervisor outcome NORMAL after post-drain reconciliation, and SSH exit 0 — not only INVENTORY-START and INVENTORY-END markers (§5.3).
15. Execution-complete labels (`EXEC_COMPLETE`, `SESSION_EXEC_COMPLETE`) assert only that commands ran to their END markers. They never assert evidence or coverage completeness. Coverage is a separate dimension (`COVERAGE_FULL` / `COVERAGE_INCOMPLETE`, §5.1, §5.4) and is INCOMPLETE whenever any candidate, glob, or sub-result is inaccessible, unknown, unresolved, failed, missing, or truncated.

---

## §1. Purpose and controlling requirements

### 1.1 Purpose

This task produces a bounded inventory finding that informs the J-2 scope-approval gate (P5-JOURNAL-01 LOCKED §2). The adopted J-2 rule requires a **recovery-material absence attestation** under a **scope-approval gate** before the P5 journal cross-check can be conditionally determined inapplicable for a first acquisition.

The scope-approval gate (P5-JOURNAL-01 §2 Option J-2) requires:

| Element | Requirement |
|---|---|
| **Scope proposal** | Keith (or a Keith-delegated inspector) proposes the search scope for (H, A), identifying: filesystem paths to examine, operator accounts covered, PM2 home directories, named apps, and the basis for believing these locations are the relevant ones |
| **Scope approval** | Keith approves the proposed scope before the search is performed |
| **Coverage justification** | Must cover every location where prior 01C6A-class recovery material could exist for (H, A), citing specific facts not assumptions |
| **Unknowns that prevent acceptance** | Unknown operator accounts; unknown PM2 home directories; unexplored filesystem areas; gaps in operator activity history; any pending operation that could produce material |

Before a scope proposal can be credibly justified, the proposer needs **factual observations** about the host's current account and PM2-home landscape. This inventory provides those observations.

### 1.2 Target host and app set

| Field | Value | Source |
|---|---|---|
| Host (H) | `aisandbox-staging` | ACQUISITION-01 §3.2; INVESTIGATION-01 §12.1 |
| App set (A) | `aisandbox-ai-service`, `aisandbox-api-gateway` | ACQUISITION-01 §3.2; POLICY-01 §3.1 |
| Historical operator account | `ubuntu` | INVESTIGATION-01 §12.1.1 |
| Historical PM2_HOME | `/home/ubuntu/.pm2` | INVESTIGATION-01 §12.1.2; ACQUISITION-01 §3.2 |

These are **historical observations** from 2026-09-18 (INVESTIGATION-01 Step 3). They are not proof of current state.

---

## §2. Proposed observations

Six read-only passive observations, each identified by a tag (INV-1 through INV-6). Each observation ends with an explicit `INV-N-END` marker; session integrity requires all six (§5.3 invariant 14). No PM2 client is invoked. No files are created, modified, or deleted on the staging host. No file contents are read. No vault, journal, or recovery-material directory contents are inspected or enumerated. All observations use standard GNU/Linux utilities available on Ubuntu.

Remote stdout carries observation data and markers. Remote stderr carries diagnostic messages (permission errors, tool errors, SSH client messages). The two streams are kept separate — no `2>&1` merging — so diagnostics are preserved without routing through data filters. See §4.3.2 for local capture of both streams.

Every observation's data path — complete pipeline or loop group — terminates in the `cap` function (§2.0), which enforces that observation's registered byte and line caps on the remote host. Exit-status markers and the `INV-N-END` marker are emitted **outside** the cap so they survive truncation.

### 2.0 Per-observation cap function and deadline escalation

**Cap function** (defined once at the top of §2.7):

```bash
cap() {
  LC_ALL=C awk -v tag="$1" -v maxl="$2" -v maxb="$3" '
    { l += 1; b += length($0) + 1
      if (l > maxl || b > maxb) {
        printf "--- %s-CAP-TRUNCATED: lines=%d bytes=%d ---\n", tag, l, b
        exit 3
      }
      print }'
}
```

| Property | Specification |
|---|---|
| Arguments | `tag`, `max lines`, `max bytes` |
| Counting | Per record: bytes = `length($0) + 1` under `LC_ALL=C` (byte semantics); lines = records. Conservative: a final record without trailing newline still counts +1 |
| Within cap | Records passed through unchanged; `cap` exits 0 |
| Cap reached | The record that would exceed either cap is **not** printed; one `<tag>-CAP-TRUNCATED` marker is printed; `cap` exits **3** |
| Escalation | When `cap` exits, the pipe closes. The upstream producer/filter (or the loop-group subshell) receives SIGPIPE on its next write and terminates (bash reports 141). This stops the producer without waiting for `timeout` |
| Exit-status recording | The `cap` exit code is recorded as `<tag>-CAP-RC`. `3` = truncated by cap. Any value other than 0 or 3 = `CAP_FAILURE` (e.g., 127 = awk missing) |
| Upstream status after CAP-RC 3 | **Scheduling-dependent.** The upstream stage may have already exited 0 before the pipe closed, or be terminated by SIGPIPE (141). Both 0 and 141 are expected consequences and are **not** independent PRODUCER_ERROR / FILTER_FAILURE. Any other non-zero upstream code (e.g., 1, 2, 124, 127, 137) is a recorded failure classified on its own merits — it is not suppressed by the cap (§5.1) |
| Deterministic cap evidence | Independent of scheduling: `<tag>-CAP-TRUNCATED` marker present exactly once; CAP-RC = 3; no data records follow the marker within that observation's capped output; markers emitted outside the cap (RC, END) are still present |

**Deadline escalation (`timeout -k`):**

| Scope | Command prefix | TERM at | KILL at | Exit code on TERM / KILL |
|---|---|---|---|---|
| Producers (`getent`, `ls`, `systemctl`, `pgrep`) | `timeout -k 2 30` | 30 s | 32 s | 124 / 137 |
| Per-candidate `stat` (INV-3, INV-5) | `timeout -k 1 5` | 5 s | 6 s | 124 / 137 |
| Per-PID `ps` (INV-6) | `timeout -k 1 5` | 5 s | 6 s | 124 / 137 |

Both 124 and 137 classify as TIMEOUT for that command or sub-result (§5.1).

**Loop deadlines:** Loop duration is bounded by (candidate or PID limit) × (per-call TERM+KILL) — INV-3/INV-5: 64 × 6 s = 384 s worst case; INV-6: 200 × 6 s = 1,200 s worst case. These worst cases **exceed** the 180 s session execution deadline (§4.2). The session deadline is therefore the binding bound for a pathological loop; the interrupted loop is classified INCOMPLETE + TRUNCATED and COVERAGE_INCOMPLETE (§4.3.4, §5.1). Normal `stat`/`ps` calls complete in milliseconds.

**Registered per-observation caps (enforced by `cap`):**

| Obs | Max lines | Max bytes | Notes |
|---|---|---|---|
| INV-1 | 500 | 32,768 | pipeline: getent → awk filter → cap |
| INV-2 | 200 | 8,192 | pipeline: ls → cap |
| INV-3 | 220 | 12,288 | loop group → cap; 64-candidate limit |
| INV-4a, INV-4b | 200 each | 8,192 each | pipeline: systemctl → grep → cap |
| INV-5 | 220 | 12,288 | loop group → cap; 64-candidate limit |
| INV-6 | 640 | 20,480 | loop group → cap; 200-PID limit |
| **Sum** | **2,180** | **102,400** | Below session caps (3,000 lines / 131,072 bytes, §4.2), so a per-observation cap always triggers before the session cap for that observation's stdout |

Stderr is not per-observation capped (diagnostics preserved). Stderr shares the session budget headroom (§4.2).

### 2.1 INV-1: Account enumeration

**Purpose:** List all system accounts to identify every account that could have a PM2 home directory.

**Command:**
```bash
timeout -k 2 30 getent passwd | awk -F: -v OFS=: '{print $1,$3,$6,$7}' | cap INV-1 500 32768
inv1_prc=("${PIPESTATUS[@]}")
echo "--- INV-1-PRODUCER-RC: ${inv1_prc[0]} ---"
echo "--- INV-1-FILTER-RC: ${inv1_prc[1]} ---"
echo "--- INV-1-CAP-RC: ${inv1_prc[2]} ---"
```

**Per-observation caps:** 500 lines / 32,768 bytes, enforced by `cap` (§2.0).

**Output format:** One line per account: `username:uid:homedir:shell`. GECOS, GID, and password placeholder stripped. If output exceeds the cap, `cap` emits `INV-1-CAP-TRUNCATED` and stops the pipeline.

**Expected output:** 20–50 lines, < 3 KB.

**Exit status:** PIPESTATUS[0] = `getent` (via `timeout`); PIPESTATUS[1] = `awk` filter; PIPESTATUS[2] = `cap`. Diagnostic messages appear on stderr (captured separately in inv-stderr.bin).

**Filter semantics:** The filter is `awk`. Any awk exit code ≥ 1 is FILTER_FAILURE, not FILTER_NO_MATCH — except 141 when CAP-RC = 3 (§2.0). FILTER_NO_MATCH applies only to `grep` (§5.1).

### 2.2 INV-2: Home directory listing

**Purpose:** Identify home directories that exist under `/home`, including ownership and permissions.

**Command:**
```bash
timeout -k 2 30 ls -la /home/ | cap INV-2 200 8192
inv2_prc=("${PIPESTATUS[@]}")
echo "--- INV-2-RC: ${inv2_prc[0]} ---"
echo "--- INV-2-CAP-RC: ${inv2_prc[1]} ---"
```

**Per-observation caps:** 200 lines / 8,192 bytes, enforced by `cap`.

**Expected output:** < 20 lines, < 2 KB.

**Exit status:** PIPESTATUS[0] = `ls` (via `timeout`); PIPESTATUS[1] = `cap`. Errors appear on stderr (captured separately). INV-2 success (`RC: 0`) is also the reviewer's cross-check for resolving an INV-3/INV-5 `GLOB-UNRESOLVED: /home/*/` marker (§5.4).

### 2.3 INV-3: PM2 home directory discovery

**Purpose:** Check whether `.pm2` directories exist at each candidate default home-directory location. Every candidate's outcome is recorded.

**Method:** Home directories are enumerated once via `/home/*/`; each `<home>/.pm2` plus `/root/.pm2` is checked with an explicit, deadline-bounded `stat`. No silent `[ -d ]` tests. No directory-tree traversal. The whole loop group is capped by `cap`.

**Command:**
```bash
{
  inv3_checks=0; inv3_present=0; inv3_failed=0; inv3_unresolved=0
  inv3_candidates=(/root/.pm2)
  inv3_homes=(/home/*/)
  if [ "${inv3_homes[0]}" = "/home/*/" ]; then
    echo "--- INV-3-GLOB-UNRESOLVED: /home/*/ ---"
    inv3_unresolved=$((inv3_unresolved + 1))
  else
    for h in "${inv3_homes[@]}"; do inv3_candidates+=("${h}.pm2"); done
  fi
  for candidate in "${inv3_candidates[@]}"; do
    if [ "$inv3_checks" -ge 64 ]; then
      echo "--- INV-3-CANDIDATE-LIMIT: attempted=64 total=${#inv3_candidates[@]} ---"
      inv3_unresolved=$((inv3_unresolved + 1))
      break
    fi
    inv3_checks=$((inv3_checks + 1))
    echo "--- INV-3-CHECK: ${candidate} ---"
    timeout -k 1 5 stat -c '%F %U %n' "$candidate"
    inv3_rc=$?
    echo "--- INV-3-CHECK-RC: ${inv3_rc} ---"
    if [ "$inv3_rc" -eq 0 ]; then inv3_present=$((inv3_present + 1)); else inv3_failed=$((inv3_failed + 1)); fi
  done
  echo "--- INV-3-CHECKS: ${inv3_checks} ---"
  echo "--- INV-3-PRESENT: ${inv3_present} ---"
  echo "--- INV-3-FAILED: ${inv3_failed} ---"
  echo "--- INV-3-UNRESOLVED: ${inv3_unresolved} ---"
} | cap INV-3 220 12288
inv3_prc=("${PIPESTATUS[@]}")
echo "--- INV-3-GROUP-RC: ${inv3_prc[0]} ---"
echo "--- INV-3-CAP-RC: ${inv3_prc[1]} ---"
```

**Per-observation caps:** 220 lines / 12,288 bytes (`cap`); 64-candidate limit; per-`stat` deadline 5 s TERM / 6 s KILL.

**Candidate outcomes (per `INV-3-CHECK`):**

| stat exit | Outcome | How cause is determined |
|---|---|---|
| 0 | PRESENT — type, owner, path recorded on stdout | stdout output |
| 124 / 137 | TIMEOUT — `stat` did not return within deadline (e.g., hung mount). Coverage UNKNOWN | exit code |
| Other non-zero | FAILED — reviewer matches the path in the `stat` diagnostic in inv-stderr.bin: `No such file or directory` = ABSENT (covered); `Permission denied` = INACCESSIBLE (coverage UNKNOWN); any other / no matching diagnostic = UNKNOWN. Exit code alone does not distinguish these | inv-stderr.bin, matched by path |

**Glob resolution:** `/home/*/` requires read permission on `/home`. If it does not expand, `INV-3-GLOB-UNRESOLVED` is emitted and no home candidates are checked. Resolution at review (§5.4): if INV-2 (`ls -la /home/`) is EXEC_COMPLETE with `RC: 0` and lists **no** subdirectories, the unresolved glob resolves to "no home directories" (covered); otherwise it stays UNRESOLVED → COVERAGE_INCOMPLETE.

**Closing markers:** `INV-3-CHECKS`, `INV-3-PRESENT`, `INV-3-FAILED`, `INV-3-UNRESOLVED` (inside cap), then `INV-3-GROUP-RC`, `INV-3-CAP-RC`, `INV-3-END` (outside cap). All seven required for EXEC_COMPLETE; the count of `INV-3-CHECK-RC` markers must equal `INV-3-CHECKS`, and PRESENT + FAILED must equal CHECKS (§5.1).

**Coverage:** COVERAGE_FULL only if UNRESOLVED = 0, no CANDIDATE-LIMIT marker, CAP-RC = 0, and every FAILED candidate resolves to ABSENT. Any INACCESSIBLE, TIMEOUT, UNKNOWN, unresolved glob, candidate-limit, or cap truncation → COVERAGE_INCOMPLETE (§5.4).

**Directories enumerated by the shell:** `/home/` only (to expand `/home/*/`). Each candidate is checked with a single `stat` call. GROUP-RC 141 with CAP-RC 3 is the expected SIGPIPE consequence of cap escalation.

### 2.4 INV-4: systemd PM2 service check

**Purpose:** Determine if PM2 is configured as a systemd service, which could reveal additional operator accounts.

**Commands (two sub-observations, each with explicit opening and END markers and separate exit-status capture):**
```bash
echo "--- INV-4a: LIST-UNIT-FILES ---"
timeout -k 2 30 systemctl list-unit-files --type=service | grep -i pm2 | cap INV-4a 200 8192
inv4a_prc=("${PIPESTATUS[@]}")
echo "--- INV-4a-PRODUCER-RC: ${inv4a_prc[0]} ---"
echo "--- INV-4a-FILTER-RC: ${inv4a_prc[1]} ---"
echo "--- INV-4a-CAP-RC: ${inv4a_prc[2]} ---"
echo "--- INV-4a-END ---"
echo "--- INV-4b: LIST-UNITS-ALL ---"
timeout -k 2 30 systemctl list-units --type=service --all | grep -i pm2 | cap INV-4b 200 8192
inv4b_prc=("${PIPESTATUS[@]}")
echo "--- INV-4b-PRODUCER-RC: ${inv4b_prc[0]} ---"
echo "--- INV-4b-FILTER-RC: ${inv4b_prc[1]} ---"
echo "--- INV-4b-CAP-RC: ${inv4b_prc[2]} ---"
echo "--- INV-4b-END ---"
```

The parent markers `--- INV-4: SYSTEMD-PM2-SERVICES ---` and `--- INV-4-END ---` bracket both sub-observations (§2.7).

**Per-observation caps:** 200 lines / 8,192 bytes per sub-observation, enforced by `cap`.

**Exit status:** Each sub-observation records producer, filter, and cap exit codes via `PIPESTATUS`. `grep` exit 1 (no match) is `FILTER_NO_MATCH` when the producer succeeded. `grep` exit ≥ 2 is `FILTER_FAILURE`. Non-zero producer exit is `PRODUCER_ERROR` regardless of grep result. Exception in both cases: the cap-escalation rule (§5.1) when CAP-RC = 3. Errors appear on stderr (captured separately).

**Marker mapping and static trace (§5.1 INV-4 rules):** INV-4a and INV-4b are classified as independent command-based observations using their **own** opening and END markers and their own three RC markers. The parent INV-4 requires its own opening and END markers and combines the two (§5.2).

| Scenario | Emitted marker sequence | INV-4a | INV-4b | INV-4 parent |
|---|---|---|---|---|
| Normal | `INV-4`, `INV-4a`, data, 4a-PRODUCER/FILTER/CAP-RC, `INV-4a-END`, `INV-4b`, data, 4b-PRODUCER/FILTER/CAP-RC, `INV-4b-END`, `INV-4-END` | by RC codes (EXEC_COMPLETE or FILTER_NO_MATCH) | by RC codes | worst of 4a/4b; EXEC_COMPLETE if both are EXEC_COMPLETE / FILTER_NO_MATCH |
| Session interrupted after `INV-4a-END`, before `INV-4b` | …`INV-4a-END` then nothing | classified normally | NOT_EXECUTED (opening absent) | INCOMPLETE +TRUNCATED (parent END absent) |
| Session interrupted inside INV-4b (opening present, END absent) | …`INV-4b`, partial data | classified normally | INCOMPLETE +TRUNCATED | INCOMPLETE +TRUNCATED |
| Session interrupted inside INV-4a | `INV-4`, `INV-4a`, partial | INCOMPLETE +TRUNCATED | NOT_EXECUTED | INCOMPLETE +TRUNCATED |

In every non-normal row INV-4 coverage is COVERAGE_INCOMPLETE (§5.4).

### 2.5 INV-5: PM2 installation search

**Purpose:** Check whether PM2 is installed at known and standard global/per-user paths. Every candidate's outcome is recorded.

**Method:** Same structure as §2.3. Global candidates are fixed; per-home candidates derive from `/home/*/`; nvm version directories derive from `<home>/.nvm/versions/node/*/` with explicit unresolved-glob recording. Every candidate gets a deadline-bounded `stat`. The loop group is capped by `cap`.

**Command:**
```bash
{
  inv5_checks=0; inv5_present=0; inv5_failed=0; inv5_unresolved=0
  inv5_candidates=(/usr/lib/node_modules/pm2 /usr/local/lib/node_modules/pm2)
  inv5_homes=(/home/*/)
  if [ "${inv5_homes[0]}" = "/home/*/" ]; then
    echo "--- INV-5-GLOB-UNRESOLVED: /home/*/ ---"
    inv5_unresolved=$((inv5_unresolved + 1))
  else
    for h in "${inv5_homes[@]}"; do
      inv5_candidates+=("${h}node_modules/pm2" "${h}.npm-global/lib/node_modules/pm2")
      inv5_nvm=("${h}.nvm/versions/node/"*/)
      if [ "${inv5_nvm[0]}" = "${h}.nvm/versions/node/*/" ]; then
        echo "--- INV-5-GLOB-UNRESOLVED: ${h}.nvm/versions/node/*/ ---"
        inv5_unresolved=$((inv5_unresolved + 1))
        inv5_candidates+=("${h}.nvm/versions/node")
      else
        for v in "${inv5_nvm[@]}"; do inv5_candidates+=("${v}lib/node_modules/pm2"); done
      fi
    done
  fi
  for candidate in "${inv5_candidates[@]}"; do
    if [ "$inv5_checks" -ge 64 ]; then
      echo "--- INV-5-CANDIDATE-LIMIT: attempted=64 total=${#inv5_candidates[@]} ---"
      inv5_unresolved=$((inv5_unresolved + 1))
      break
    fi
    inv5_checks=$((inv5_checks + 1))
    echo "--- INV-5-CHECK: ${candidate} ---"
    timeout -k 1 5 stat -c '%F %U %n' "$candidate"
    inv5_rc=$?
    echo "--- INV-5-CHECK-RC: ${inv5_rc} ---"
    if [ "$inv5_rc" -eq 0 ]; then inv5_present=$((inv5_present + 1)); else inv5_failed=$((inv5_failed + 1)); fi
  done
  echo "--- INV-5-CHECKS: ${inv5_checks} ---"
  echo "--- INV-5-PRESENT: ${inv5_present} ---"
  echo "--- INV-5-FAILED: ${inv5_failed} ---"
  echo "--- INV-5-UNRESOLVED: ${inv5_unresolved} ---"
} | cap INV-5 220 12288
inv5_prc=("${PIPESTATUS[@]}")
echo "--- INV-5-GROUP-RC: ${inv5_prc[0]} ---"
echo "--- INV-5-CAP-RC: ${inv5_prc[1]} ---"
```

**Per-observation caps:** 220 lines / 12,288 bytes (`cap`); 64-candidate limit; per-`stat` deadline 5 s TERM / 6 s KILL.

**Candidate outcomes:** As §2.3 (PRESENT / TIMEOUT / ABSENT / INACCESSIBLE / UNKNOWN by path-matched stderr diagnostic).

**Glob resolution:**
- `/home/*/` unresolved: resolved via INV-2 as in §2.3.
- `<home>/.nvm/versions/node/*/` unresolved: the parent `<home>/.nvm/versions/node` is itself appended as a candidate. If that candidate's `stat` resolves to ABSENT, the unresolved nvm glob resolves to "nvm not installed for this home" (covered). If PRESENT (directory exists but glob did not expand → no execute permission or no versions) or INACCESSIBLE/UNKNOWN, it stays UNRESOLVED → COVERAGE_INCOMPLETE.

**Closing markers:** `INV-5-CHECKS`, `INV-5-PRESENT`, `INV-5-FAILED`, `INV-5-UNRESOLVED`, `INV-5-GROUP-RC`, `INV-5-CAP-RC`, `INV-5-END`. Same accounting rules as §2.3.

**Coverage:** Same rule as §2.3. Gaps outside the candidate set: §9.5.

### 2.6 INV-6: Running PM2 daemon check (passive)

**Purpose:** Identify which account(s) currently run PM2 daemons, using passive process-table observation only. No PM2 client is invoked.

**Command:**
```bash
{
  inv6_pids=$(timeout -k 2 30 pgrep -f "God Daemon")
  inv6_pgrep_rc=$?
  echo "--- INV-6-PGREP-RC: ${inv6_pgrep_rc} ---"
  inv6_total=0; inv6_attempted=0; inv6_ok=0; inv6_fail=0
  if [ "$inv6_pgrep_rc" -eq 0 ] && [ -n "$inv6_pids" ]; then
    inv6_total=$(printf '%s\n' "$inv6_pids" | wc -l)
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      if [ "$inv6_attempted" -ge 200 ]; then
        echo "--- INV-6-PID-LIMIT: attempted=200 total=${inv6_total} ---"
        break
      fi
      inv6_attempted=$((inv6_attempted + 1))
      echo "--- INV-6-PS-PID-${pid} ---"
      timeout -k 1 5 ps -o user=,pid=,lstart= -p "$pid"
      inv6_ps_rc=$?
      echo "--- INV-6-PS-PID-${pid}-RC: ${inv6_ps_rc} ---"
      if [ "$inv6_ps_rc" -eq 0 ]; then inv6_ok=$((inv6_ok + 1)); else inv6_fail=$((inv6_fail + 1)); fi
    done <<< "$inv6_pids"
  fi
  echo "--- INV-6-TOTAL-PIDS: ${inv6_total} ---"
  echo "--- INV-6-PS-ATTEMPTED: ${inv6_attempted} ---"
  echo "--- INV-6-PS-OK: ${inv6_ok} ---"
  echo "--- INV-6-PS-FAIL: ${inv6_fail} ---"
} | cap INV-6 640 20480
inv6_prc=("${PIPESTATUS[@]}")
echo "--- INV-6-GROUP-RC: ${inv6_prc[0]} ---"
echo "--- INV-6-CAP-RC: ${inv6_prc[1]} ---"
```

**Per-observation caps:** 640 lines / 20,480 bytes (`cap`); 200-PID limit checked **before** incrementing `inv6_attempted`, so the attempted count includes only PIDs for which `ps` was actually invoked; per-`ps` deadline 5 s TERM / 6 s KILL; `pgrep` 30 s TERM / 32 s KILL.

**Output fields:** `user`, `pid`, `lstart` only. No command-line arguments captured. The matched process title is NOT output.

**pgrep exit codes:**

| Exit | Classification |
|---|---|
| 0 | proceed to per-PID ps |
| 1 | EXEC_COMPLETE with zero matches (§0 invariant 13: does NOT establish daemon absence) |
| 2+ (not below) | PRODUCER_ERROR |
| 124 / 137 | TIMEOUT |
| 127 | MISSING_TOOL |
| 141 with CAP-RC 3 | expected cap escalation (§2.0) |

**Per-PID ps sub-results:** Each ps call's exit code is recorded with a per-PID `-RC` marker.

| ps exit | Recorded meaning |
|---|---|
| 0 | Process found; user, pid, lstart recorded |
| 124 / 137 | ps TIMEOUT for this PID |
| 127 | ps not installed (MISSING_TOOL for sub-observation) |
| Other non-zero | ps failed for this PID. Possible causes: process exited between pgrep and ps (race), PID format error, permissions, or tool error. Exit code alone does not determine cause; inv-stderr.bin contains the ps diagnostic. Neither exit 0 nor non-zero establishes daemon absence |

**Sub-result accounting (all required for EXEC_COMPLETE, §5.1):**
- Closing markers `INV-6-TOTAL-PIDS`, `INV-6-PS-ATTEMPTED`, `INV-6-PS-OK`, `INV-6-PS-FAIL` (inside cap) and `INV-6-GROUP-RC`, `INV-6-CAP-RC`, `INV-6-END` (outside cap) all present.
- Expected attempted = `min(TOTAL, 200)`. `PS-ATTEMPTED` must equal it (with `INV-6-PID-LIMIT` present iff TOTAL > 200).
- Actual count of `INV-6-PS-PID-<pid>-RC` markers must equal `PS-ATTEMPTED`. `PS-OK + PS-FAIL` must equal `PS-ATTEMPTED`. Presence of closing markers alone is not sufficient.
- Any mismatch → INCOMPLETE (loop interrupted or output lost).

**Coverage:** COVERAGE_FULL only if EXEC_COMPLETE, pgrep rc ∈ {0, 1}, no `INV-6-PID-LIMIT`, `PS-FAIL` = 0, CAP-RC = 0. Any failed/timed-out per-PID result, PID-limit truncation, or cap truncation → COVERAGE_INCOMPLETE (§5.4). COVERAGE_FULL still does not establish daemon absence (§0.13).

**Detection limitations:** §0 invariants 12–13, §9.8.

### 2.7 Complete inspection script

The following self-contained bash script is executed remotely via SSH (§3). Remote stdout carries observation data and markers to inv-stdout.bin. Remote stderr carries diagnostic messages to inv-stderr.bin. The two streams are NOT merged. Every observation's data path ends in `cap`; every observation ends with an explicit END marker emitted outside the cap.

```bash
set -u

cap() {
  LC_ALL=C awk -v tag="$1" -v maxl="$2" -v maxb="$3" '
    { l += 1; b += length($0) + 1
      if (l > maxl || b > maxb) {
        printf "--- %s-CAP-TRUNCATED: lines=%d bytes=%d ---\n", tag, l, b
        exit 3
      }
      print }'
}

echo "=== INVENTORY-START $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "=== HOSTNAME: $(hostname) ==="
echo "=== WHOAMI: $(whoami) ==="

echo "--- INV-1: ACCOUNT-ENUMERATION ---"
timeout -k 2 30 getent passwd | awk -F: -v OFS=: '{print $1,$3,$6,$7}' | cap INV-1 500 32768
inv1_prc=("${PIPESTATUS[@]}")
echo "--- INV-1-PRODUCER-RC: ${inv1_prc[0]} ---"
echo "--- INV-1-FILTER-RC: ${inv1_prc[1]} ---"
echo "--- INV-1-CAP-RC: ${inv1_prc[2]} ---"
echo "--- INV-1-END ---"

echo "--- INV-2: HOME-DIRECTORY-LISTING ---"
timeout -k 2 30 ls -la /home/ | cap INV-2 200 8192
inv2_prc=("${PIPESTATUS[@]}")
echo "--- INV-2-RC: ${inv2_prc[0]} ---"
echo "--- INV-2-CAP-RC: ${inv2_prc[1]} ---"
echo "--- INV-2-END ---"

echo "--- INV-3: PM2-HOME-DISCOVERY ---"
{
  inv3_checks=0; inv3_present=0; inv3_failed=0; inv3_unresolved=0
  inv3_candidates=(/root/.pm2)
  inv3_homes=(/home/*/)
  if [ "${inv3_homes[0]}" = "/home/*/" ]; then
    echo "--- INV-3-GLOB-UNRESOLVED: /home/*/ ---"
    inv3_unresolved=$((inv3_unresolved + 1))
  else
    for h in "${inv3_homes[@]}"; do inv3_candidates+=("${h}.pm2"); done
  fi
  for candidate in "${inv3_candidates[@]}"; do
    if [ "$inv3_checks" -ge 64 ]; then
      echo "--- INV-3-CANDIDATE-LIMIT: attempted=64 total=${#inv3_candidates[@]} ---"
      inv3_unresolved=$((inv3_unresolved + 1))
      break
    fi
    inv3_checks=$((inv3_checks + 1))
    echo "--- INV-3-CHECK: ${candidate} ---"
    timeout -k 1 5 stat -c '%F %U %n' "$candidate"
    inv3_rc=$?
    echo "--- INV-3-CHECK-RC: ${inv3_rc} ---"
    if [ "$inv3_rc" -eq 0 ]; then inv3_present=$((inv3_present + 1)); else inv3_failed=$((inv3_failed + 1)); fi
  done
  echo "--- INV-3-CHECKS: ${inv3_checks} ---"
  echo "--- INV-3-PRESENT: ${inv3_present} ---"
  echo "--- INV-3-FAILED: ${inv3_failed} ---"
  echo "--- INV-3-UNRESOLVED: ${inv3_unresolved} ---"
} | cap INV-3 220 12288
inv3_prc=("${PIPESTATUS[@]}")
echo "--- INV-3-GROUP-RC: ${inv3_prc[0]} ---"
echo "--- INV-3-CAP-RC: ${inv3_prc[1]} ---"
echo "--- INV-3-END ---"

echo "--- INV-4: SYSTEMD-PM2-SERVICES ---"
echo "--- INV-4a: LIST-UNIT-FILES ---"
timeout -k 2 30 systemctl list-unit-files --type=service | grep -i pm2 | cap INV-4a 200 8192
inv4a_prc=("${PIPESTATUS[@]}")
echo "--- INV-4a-PRODUCER-RC: ${inv4a_prc[0]} ---"
echo "--- INV-4a-FILTER-RC: ${inv4a_prc[1]} ---"
echo "--- INV-4a-CAP-RC: ${inv4a_prc[2]} ---"
echo "--- INV-4a-END ---"
echo "--- INV-4b: LIST-UNITS-ALL ---"
timeout -k 2 30 systemctl list-units --type=service --all | grep -i pm2 | cap INV-4b 200 8192
inv4b_prc=("${PIPESTATUS[@]}")
echo "--- INV-4b-PRODUCER-RC: ${inv4b_prc[0]} ---"
echo "--- INV-4b-FILTER-RC: ${inv4b_prc[1]} ---"
echo "--- INV-4b-CAP-RC: ${inv4b_prc[2]} ---"
echo "--- INV-4b-END ---"
echo "--- INV-4-END ---"

echo "--- INV-5: PM2-INSTALL-SEARCH ---"
{
  inv5_checks=0; inv5_present=0; inv5_failed=0; inv5_unresolved=0
  inv5_candidates=(/usr/lib/node_modules/pm2 /usr/local/lib/node_modules/pm2)
  inv5_homes=(/home/*/)
  if [ "${inv5_homes[0]}" = "/home/*/" ]; then
    echo "--- INV-5-GLOB-UNRESOLVED: /home/*/ ---"
    inv5_unresolved=$((inv5_unresolved + 1))
  else
    for h in "${inv5_homes[@]}"; do
      inv5_candidates+=("${h}node_modules/pm2" "${h}.npm-global/lib/node_modules/pm2")
      inv5_nvm=("${h}.nvm/versions/node/"*/)
      if [ "${inv5_nvm[0]}" = "${h}.nvm/versions/node/*/" ]; then
        echo "--- INV-5-GLOB-UNRESOLVED: ${h}.nvm/versions/node/*/ ---"
        inv5_unresolved=$((inv5_unresolved + 1))
        inv5_candidates+=("${h}.nvm/versions/node")
      else
        for v in "${inv5_nvm[@]}"; do inv5_candidates+=("${v}lib/node_modules/pm2"); done
      fi
    done
  fi
  for candidate in "${inv5_candidates[@]}"; do
    if [ "$inv5_checks" -ge 64 ]; then
      echo "--- INV-5-CANDIDATE-LIMIT: attempted=64 total=${#inv5_candidates[@]} ---"
      inv5_unresolved=$((inv5_unresolved + 1))
      break
    fi
    inv5_checks=$((inv5_checks + 1))
    echo "--- INV-5-CHECK: ${candidate} ---"
    timeout -k 1 5 stat -c '%F %U %n' "$candidate"
    inv5_rc=$?
    echo "--- INV-5-CHECK-RC: ${inv5_rc} ---"
    if [ "$inv5_rc" -eq 0 ]; then inv5_present=$((inv5_present + 1)); else inv5_failed=$((inv5_failed + 1)); fi
  done
  echo "--- INV-5-CHECKS: ${inv5_checks} ---"
  echo "--- INV-5-PRESENT: ${inv5_present} ---"
  echo "--- INV-5-FAILED: ${inv5_failed} ---"
  echo "--- INV-5-UNRESOLVED: ${inv5_unresolved} ---"
} | cap INV-5 220 12288
inv5_prc=("${PIPESTATUS[@]}")
echo "--- INV-5-GROUP-RC: ${inv5_prc[0]} ---"
echo "--- INV-5-CAP-RC: ${inv5_prc[1]} ---"
echo "--- INV-5-END ---"

echo "--- INV-6: RUNNING-PM2-DAEMONS ---"
{
  inv6_pids=$(timeout -k 2 30 pgrep -f "God Daemon")
  inv6_pgrep_rc=$?
  echo "--- INV-6-PGREP-RC: ${inv6_pgrep_rc} ---"
  inv6_total=0; inv6_attempted=0; inv6_ok=0; inv6_fail=0
  if [ "$inv6_pgrep_rc" -eq 0 ] && [ -n "$inv6_pids" ]; then
    inv6_total=$(printf '%s\n' "$inv6_pids" | wc -l)
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      if [ "$inv6_attempted" -ge 200 ]; then
        echo "--- INV-6-PID-LIMIT: attempted=200 total=${inv6_total} ---"
        break
      fi
      inv6_attempted=$((inv6_attempted + 1))
      echo "--- INV-6-PS-PID-${pid} ---"
      timeout -k 1 5 ps -o user=,pid=,lstart= -p "$pid"
      inv6_ps_rc=$?
      echo "--- INV-6-PS-PID-${pid}-RC: ${inv6_ps_rc} ---"
      if [ "$inv6_ps_rc" -eq 0 ]; then inv6_ok=$((inv6_ok + 1)); else inv6_fail=$((inv6_fail + 1)); fi
    done <<< "$inv6_pids"
  fi
  echo "--- INV-6-TOTAL-PIDS: ${inv6_total} ---"
  echo "--- INV-6-PS-ATTEMPTED: ${inv6_attempted} ---"
  echo "--- INV-6-PS-OK: ${inv6_ok} ---"
  echo "--- INV-6-PS-FAIL: ${inv6_fail} ---"
} | cap INV-6 640 20480
inv6_prc=("${PIPESTATUS[@]}")
echo "--- INV-6-GROUP-RC: ${inv6_prc[0]} ---"
echo "--- INV-6-CAP-RC: ${inv6_prc[1]} ---"
echo "--- INV-6-END ---"

echo "=== INVENTORY-END $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
```

**Privilege requirements:** All commands run as `ubuntu`. No privilege escalation. Restricted paths produce "Permission denied" on stderr.

**Script assumptions:** GNU coreutils (`timeout` with `-k`, `stat`), `getent`, `awk` (mawk or gawk; `length` is byte-based under `LC_ALL=C`), `systemctl`, `grep`, `pgrep`, `ps`, `wc` available on Ubuntu. `bash` ≥ 4.4 (PIPESTATUS, here-string `<<<`, arrays under `set -u`). Default SIGPIPE disposition in the sshd-spawned shell (required for cap escalation; a loop-group subshell killed by SIGPIPE reports GROUP-RC 141).

---

## §3. SSH configuration and host-key verification

### 3.1 Connection binding

The SSH invocation is bound to these specific parameters:

| Parameter | Value | Source |
|---|---|---|
| **User** | `ubuntu` | INVESTIGATION-01 §12.1.1; ACQUISITION-01 §3.2; explicit via `ubuntu@` |
| **Endpoint** | `aisandbox-staging` | INVESTIGATION-01; ACQUISITION-01 §3.2 |
| **Port** | 22 | Explicit via `-p 22` |
| **Host-key lookup identity** | Hostname used by SSH client for `known_hosts` lookup. Keith must confirm at Step 3 | SSH client configuration |
| **Authentication** | Key-based only (`BatchMode=yes`) | SSH option |
| **Trusted key source** | EXECUTION PREREQUISITE — §3.3 | Must be established before Step 3 |

**Connection command:**

```
ssh -T -p 22 \
    -o StrictHostKeyChecking=yes \
    -o BatchMode=yes \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=4 \
    ubuntu@aisandbox-staging \
    'bash -s'
```

The §2.7 inspection script is piped to stdin by the local supervision procedure (§4.3). No files uploaded to staging.

**SSH option requirements:**

| Option | Value | Purpose |
|---|---|---|
| `-T` | (flag) | Disable PTY; keeps remote stdout/stderr as separate SSH channels |
| `-p` | `22` | Explicit port |
| `StrictHostKeyChecking` | `yes` | Refuse if host key does not match `known_hosts` |
| `BatchMode` | `yes` | No interactive prompts |
| `ConnectTimeout` | `10` | 10-second connection timeout |
| `ServerAliveInterval` | `15` | Keepalive every 15s |
| `ServerAliveCountMax` | `4` | Disconnect after 60s unresponsive |

### 3.2 Host-key verification during connection

`StrictHostKeyChecking=yes` verifies the server's host key against `known_hosts`. Continuity is evidence the key has not changed. It is **not** independent authentication of the original key. Continuity and original authentication are distinct.

### 3.3 Trusted host-key provenance — EXECUTION PREREQUISITE

**Prerequisite:** Provenance of the `known_hosts` entry must be established before Step 3. Evidence must bind the key to the intended instance through a channel that is (1) independent of the SSH connection, (2) authenticated, and (3) instance-specific.

**Acceptable evidence (non-exhaustive):** Host-key fingerprint from authenticated AWS API/console for the specific instance; key deployed during provisioning with deployment records; Keith's attestation recording source, channel, and instance binding.

**NOT independent provenance:** First SSH connection (TOFU); absence of third-party access; fingerprint from unauthenticated channel; known_hosts continuity alone.

**If unestablished:** BLOCKER. No trust exception adopted. Blocked status is a valid outcome (§0.9).

---

## §4. Deadlines, output limits, and enforcement

### 4.1 Remote enforcement

| Mechanism | Limit | Enforced by |
|---|---|---|
| Producer deadline | 30 s TERM, 32 s KILL | `timeout -k 2 30` on remote host |
| Per-candidate / per-PID deadline | 5 s TERM, 6 s KILL | `timeout -k 1 5` on each `stat` / `ps` |
| Per-observation byte and line caps | §2.0 table | `cap` function on every pipeline / loop group; SIGPIPE escalation |
| Candidate limit (INV-3, INV-5) | 64 | loop `break` before attempt + `CANDIDATE-LIMIT` marker |
| PID limit (INV-6) | 200 | loop `break` before attempt + `PID-LIMIT` marker |
| SSH connection timeout | 10 seconds | SSH client `ConnectTimeout` |
| SSH keepalive timeout | 60 seconds unresponsive | `ServerAliveInterval=15 × ServerAliveCountMax=4` |

### 4.2 Session-level limits and their relationship to per-observation caps

**Session limits (enforced by local supervisor §4.3):**

| Limit | Value | Enforcement |
|---|---|---|
| Session byte budget | 131,072 bytes (128 KB) combined stdout+stderr | Exact: readers reserve and write at most `byteBudget` bytes total (§4.3.2) |
| Session line budget | 3,000 lines combined stdout+stderr | Exact: readers reserve and write at most `lineBudget` newlines total; no trailing bytes beyond the last permitted newline (§4.3.2) |
| Execution deadline | 180 s measured from process launch (`Stopwatch` started immediately after `Process.Start()`, **before** stdin delivery) | Main-thread poll every 500 ms (§4.3.3) |
| Stdin delivery deadline | 10 s from launch | Main-thread poll observes stdin writer thread still alive (§4.3.3) |
| Kill confirmation wait | 5 s | `WaitForExit(5000)` |
| Drain / persistence deadline | 5 s, one deadline shared by all thread joins | `drainDeadlineElapsed = stopwatch.Elapsed + 5 s`; each join uses `max(0, drainDeadlineElapsed − stopwatch.Elapsed)`; Stopwatch basis only (§4.3.3) |

**Session caps vs per-observation caps:** the sum of per-observation stdout caps is 2,180 lines / 102,400 bytes (§2.0), below the session caps of 3,000 lines / 131,072 bytes. The remaining headroom (~820 lines / ~28 KB) carries START/END/RC/END markers (~50 lines including the INV-4a/INV-4b sub-observation markers, ~2 KB) and stderr diagnostics. Consequently a per-observation cap always triggers before the session cap for that observation's stdout. Stderr is not per-observation capped; if stderr diagnostics exhaust the headroom, the session BYTE_LIMIT / LINE_LIMIT triggers and is classified as SESSION_TRUNCATED (§5.3) — an honest session-level truncation, not a substitute for the per-observation mechanism.

**Total wall-clock bound:** no single total maximum is asserted in Step 2. The mechanism bounds each phase (execution 180 s; poll detection ≤ 500 ms; kill wait ≤ 5 s; shared drain ≤ 5 s; final recording), but joined threads that time out keep running (§4.3.3) and the mechanism has not been exercised. Elapsed totals are measured by Tests 1 and 14 (§4.4); a total bound may be recorded at Step 3 from measured evidence only.

### 4.3 Local supervision procedure

#### 4.3.1 Process and stdin management

SSH process created via `System.Diagnostics.Process` with `UseShellExecute=false`, stdin/stdout/stderr redirected.

**Thread and ownership model:**

| Thread | Owns | Only this thread may |
|---|---|---|
| Main | `Process` object, `Stopwatch`, poll loop | Start/Kill/WaitForExit the process; join other threads; compute the terminal outcome |
| Stdout reader | `StandardOutput.BaseStream`, `inv-stdout.bin` `FileStream` | Read stdout; Write/Flush/Close inv-stdout.bin |
| Stderr reader | `StandardError.BaseStream`, `inv-stderr.bin` `FileStream` | Read stderr; Write/Flush/Close inv-stderr.bin |
| Stdin writer | `StandardInput.BaseStream` | Write/Flush/Close stdin |

Ownership never transfers on timeout. Main never reads, writes, flushes, or closes a stream or file owned by another thread, including after a join timeout. This is the no-concurrent-close guarantee.

**Launch sequence:**
1. Main opens `inv-stdout.bin` and `inv-stderr.bin` (`FileMode.CreateNew`, owner-only ACL, §7.1) and hands each `FileStream` to its reader thread object before starting it.
2. `process.Start()`. Immediately: `stopwatch.Start()`. **Session timing begins here — before any stdin delivery.**
3. Start stdout reader and stderr reader threads (§4.3.2). Readers block in `Read()`.
4. Start stdin writer thread: writes the §2.7 script (UTF-8, LF line endings, ~5 KB) to `StandardInput.BaseStream`, `Flush()`, `Close()`. On any exception: set `stdinFailed = true`, exit thread. On success: set `stdinDelivered = true`, exit thread.
5. Main enters the poll loop (§4.3.3). Main does **not** block on the stdin write; the stdin deadline is enforced by the poll loop observing the writer thread (`stdinWriter.IsAlive && elapsed > 10 s → stdinDeliveryFailed = true`). The writer thread is never aborted; `Kill()` closes the pipe, which unblocks a stalled write with an exception.

#### 4.3.2 Byte-and-line-bounded capture (reader algorithm)

**Shared state** (protected by one .NET `Monitor` lock):
- `bytesReserved` (long), `linesReserved` (long) — budget consumed by reservation
- `limitExhausted` (bool), `limitReason` (`BYTE_LIMIT` | `LINE_LIMIT`)
- `byteBudget` = 131,072; `lineBudget` = 3,000

**Per-reader state** (written only by the owning reader; published with `Volatile.Write` at thread exit, read by main after join):
- `bytesPersisted`, `linesPersisted` — successfully written **and flushed**
- `readFailed`, `writeFailed`, `flushFailed`, `closeFailed` (bool + exception text)
- `readCount` — number of `Read()` calls (for Test 7)
- `readerFinished` (bool)

Each reader executes:

1. Allocate a 4,096-byte buffer (reused each iteration).
2. **Read** (outside lock): `bytesRead = stream.Read(buffer, 0, 4096)`; `readCount++`. Returns 0 → go to **Finish**. Throws → `readFailed = true` → **Finish**.
3. **Reserve** (acquire lock):
   a. `rb = byteBudget − bytesReserved`; `rl = lineBudget − linesReserved`. Defensive: if `rb ≤ 0` or `rl ≤ 0` (must not occur, because exhaustion exits the loop before another Read), set `limitExhausted = true` (reason by whichever is ≤ 0), `toWrite = 0`, `n = 0`, release lock, go to **Finish**.
   b. `toWrite = min(bytesRead, rb)`.
   c. Scan `buffer[0..toWrite)` for 0x0A → `n`. If `n ≥ rl`: `pos` = index of the `rl`-th newline; `toWrite = pos + 1`; `n = rl`; `limitExhausted = true`, `limitReason = LINE_LIMIT`. **Bytes after the last permitted newline are neither reserved nor written**, including any partial trailing line in this buffer.
   d. Else if `toWrite == rb` (this reservation consumes the last permitted byte, whether or not `bytesRead > rb`): `limitExhausted = true`, `limitReason = BYTE_LIMIT`.
   e. `bytesReserved += toWrite`; `linesReserved += n`. Copy `limitExhausted` to a local `exhaustedNow`.
   f. Release lock.
   **Exhaustion is set at the moment the last permitted byte or newline is reserved — inside this step, before any further `Read()`.**
4. **Write** (outside lock): if `toWrite > 0`: `file.Write(buffer, 0, toWrite)`. Throws → `writeFailed = true` → **Finish**.
5. **Flush** (outside lock): `file.Flush(flushToDisk: true)`. Throws → `flushFailed = true` → **Finish**.
6. `bytesPersisted += toWrite`; `linesPersisted += n`.
7. If `exhaustedNow`: go to **Finish** (no further `Read()`). Else go to step 2.

**Finish** (owner thread only): `file.Close()`; throws → `closeFailed = true`. Publish per-reader state; `readerFinished = true`; exit. Bytes read but not reserved (`bytesRead − toWrite`, or anything read after exhaustion — none, by step 7) are discarded and never written.

**Reserved vs persisted:** `bytesReserved` is the budget consumed; `Σ bytesPersisted` is what is on disk after a successful flush. Invariant: `Σ bytesPersisted ≤ bytesReserved` (same for lines). Equality holds when both readers Finish without write/flush failure. Any gap is reported and implies `writeFailed` or `flushFailed` on some reader (§4.3.5). Retention guarantees are stated over reserved counts (an upper bound on persisted).

**Retention guarantees:**
- Byte: combined files contain at most `byteBudget` bytes. Zero overshoot.
- Line: combined files contain at most `lineBudget` newline characters. When the line budget is exhausted, the file ends exactly at the last permitted newline — no trailing bytes. A partial final line can exist only when the byte budget was exhausted first (step 3d) and that partial line contains no newline.
- Exact budget boundary: a process that emits exactly `byteBudget` bytes (or exactly `lineBudget` newlines) and then goes silent triggers `limitExhausted` on the reservation of its final buffer; the reader exits without another blocking `Read()`; the main poll observes exhaustion within ≤ 500 ms (Test 7).

**Memory bound:** one 4,096-byte buffer per reader. **Blocking I/O outside lock:** `Read` (2), `Write` (4), `Flush` (5), `Close` (Finish) are all outside the lock; lock hold time is the counter arithmetic and a 4 KB newline scan.

#### 4.3.3 Poll loop, termination, drain, and final reconciliation

**Poll loop** (main thread, 500 ms interval). Each iteration evaluates in this order and records the first hit as `pollTrigger`:

1. `limitExhausted` → `pollTrigger = limitReason`
2. any reader `readFailed || writeFailed || flushFailed` → `CAPTURE_FAILURE`
3. `stdinFailed`, or `stdinWriter.IsAlive && elapsed > 10 s` (→ set `stdinDeliveryFailed = true`) → `STDIN_FAILURE`
4. `elapsed > 180 s` → `TIME_LIMIT`
5. `process.HasExited` → re-evaluate 1–3; if any hits, use it; else `pollTrigger = PROCESS_EXITED`
6. none → sleep 500 ms, repeat

`pollTrigger` is informational (recorded). It is **not** the terminal outcome; that is computed only after reconciliation below.

**Termination** (when `pollTrigger ≠ PROCESS_EXITED`):

| Step | Action | Bound |
|---|---|---|
| T1 | `try { process.Kill(); } catch (InvalidOperationException) { killNote = ALREADY_EXITED_OR_NO_HANDLE } catch (Win32Exception ex) { killFailed = true; killError = ex.Message } catch (NotSupportedException ex) { killFailed = true; killError = ex.Message }`. **No catch branch infers that the process exited.** Only `process.HasExited` (read in T2/T3) establishes exit | immediate |
| T2 | `process.WaitForExit(5000)` — executed **regardless of T1 outcome** (a failed Kill does not skip the wait; the process may still exit on its own or via the closed SSH channel) | 5 s |
| T3 | `HasExited == false` → `killUnconfirmed = true`. Recorded alongside `killFailed` / `killError` when present | — |

A failed or unconfirmed Kill never bypasses drain (below) or final reconciliation. If the process is still running, its pipes remain open; readers may stay blocked in `Read()` and therefore time out at the drain deadline — they keep ownership of their streams and files (no close by main), and the outcome surfaces as `PERSISTENCE_UNCONFIRMED` (rank 3) with `killFailed` / `killUnconfirmed` recorded; if the readers do finish (pipes closed by the remote side), the outcome surfaces as `EXIT_STATUS_UNKNOWN` (rank 6). Termination uncertainty is never resolved by assumption.

**Exit status read** (all paths): try `process.ExitCode` only if `HasExited`; success → integer; `HasExited == false` or exception → `exitCode = UNKNOWN`. `-1` is never synthesized.

**Drain** (all paths, including normal exit). All durations use the session `Stopwatch` (monotonic), never `DateTime.UtcNow`:
- `drainDeadlineElapsed = stopwatch.Elapsed + 5 s` — **one deadline on the Stopwatch time base**
- `remaining() = max(TimeSpan.Zero, drainDeadlineElapsed − stopwatch.Elapsed)`
- `stdoutReader.Join(remaining())` → timed out → `stdoutReaderTimeout = true`
- `stderrReader.Join(remaining())` → timed out → `stderrReaderTimeout = true`
- `stdinWriter.Join(remaining())` → timed out → `stdinWriterTimeout = true`

The three joins share the single 5 s window on the Stopwatch basis, so the drain phase takes at most 5 s (plus scheduler slack) regardless of how many threads stall, and is immune to wall-clock adjustments. A timed-out thread keeps ownership of its stream and file; main performs no close on them. Persistence/close is inside each reader's Finish, so the join deadline is also the persistence/close deadline: a reader that has not finished by the deadline has **unconfirmed persistence**. `drainDeadlineElapsed`, each join's `remaining()` value, and the Stopwatch reading at the end of drain are recorded (§4.3.5).

**Normal-exit drain:** when the process exits, the OS closes the pipes; readers' `Read()` returns 0; each reader runs Finish (final flush + close) and exits; main's joins complete. Reservation of a final buffer can still occur during this drain and can set `limitExhausted` after the process exited — this is captured by reconciliation.

**Final reconciliation** (after drain, main thread, reading published state under the lock / after joins). Re-read every flag as it stands **now**, including anything set during drain or Finish. Compute `supervisorOutcome` as the first match:

| Pri | `supervisorOutcome` | Condition |
|---|---|---|
| 1 | `STDIN_FAILURE` | `stdinFailed` or `stdinDeliveryFailed` |
| 2 | `CAPTURE_FAILURE` | any reader (stdout **or** stderr) has `readFailed`, `writeFailed`, `flushFailed`, or `closeFailed` |
| 3 | `PERSISTENCE_UNCONFIRMED` | any of `stdoutReaderTimeout`, `stderrReaderTimeout`, `stdinWriterTimeout`, or a reader with `readerFinished == false` |
| 4 | `BYTE_LIMIT` / `LINE_LIMIT` | `limitExhausted` (regardless of whether it was set before or after process exit) |
| 5 | `TIME_LIMIT` | elapsed exceeded 180 s before exit was observed |
| 6 | `EXIT_STATUS_UNKNOWN` | `killFailed`, `killUnconfirmed`, `HasExited == false`, or `exitCode == UNKNOWN` |
| 7 | `NORMAL` | none of the above; process exited; integer exit code available; both readers finished; `Σ bytesPersisted == bytesReserved` and `Σ linesPersisted == linesReserved` |

Every session receives exactly one `supervisorOutcome`. A limit or failure discovered after process exit (during drain or Finish) changes the outcome from `NORMAL` to the corresponding row; `NORMAL` is only reachable when every check is clean at reconciliation time. If `Σ persisted ≠ reserved` yet no failure flag is set (should be impossible), the outcome is `CAPTURE_FAILURE` with note `ACCOUNTING_MISMATCH`.

#### 4.3.4 Partial evidence and interrupted observations

Capture files are flushed after each write. Whatever was persisted before termination or failure remains in the files. Files are never deleted by the supervisor.

**Every interrupted observation is classified** (§5.1) from its markers in inv-stdout.bin:
- Opening marker absent → NOT_EXECUTED
- Opening marker present, END marker absent → INCOMPLETE (+TRUNCATED when `supervisorOutcome` is a limit or TIME_LIMIT)
- Opening and END present → classified by its RC markers and cap results

Every interrupted or truncated observation is also COVERAGE_INCOMPLETE (§5.4).

#### 4.3.5 Post-session recording

| Field | Value |
|---|---|
| `supervisorOutcome` | one of §4.3.3 reconciliation rows |
| `pollTrigger` | poll-time trigger (informational) |
| Process exit code | integer, or `UNKNOWN` (never -1) |
| `killFailed`, `killError`, `killNote`, `killUnconfirmed` | Kill exception recorded verbatim (`Win32Exception` / `NotSupportedException` message); `ALREADY_EXITED_OR_NO_HANDLE` for `InvalidOperationException`; `killUnconfirmed` when `HasExited` stayed false after T2 |
| Elapsed at trigger, `drainDeadlineElapsed`, per-join `remaining()`, elapsed at end of drain, elapsed at end of reconciliation | seconds (Stopwatch, from launch; no wall-clock values) |
| `bytesReserved`, `linesReserved` | shared state |
| Per stream: `bytesPersisted`, `linesPersisted`, `readCount`, `readFailed`, `writeFailed`, `flushFailed`, `closeFailed` (+exception text), `readerFinished`, `readerTimeout` | per-reader state |
| `stdinDelivered`, `stdinFailed`, `stdinDeliveryFailed`, `stdinWriterTimeout` | stdin writer state |
| inv-stdout.bin size, inv-stderr.bin size | bytes on disk after reconciliation (for finished readers only; for a timed-out reader the size is reported as `UNCONFIRMED`) |

#### 4.3.6 Remote process state after local termination

When the local SSH client is killed, the TCP connection drops. Remote `sshd` should send SIGHUP. **Remote cleanup is not guaranteed** (§0.11, §9.9).

### 4.4 Local supervision verification — DESIGNED, NOT EXECUTED

**Purpose:** Verify supervision procedure (§4.3) on the inspector's Windows system using local synthetic tests. No SSH or remote host required.

Each test states its setup and the assertions that must hold. Tests 1–9 and 12, 14–16 exercise the local supervisor with a synthetic child process (no remote host). Tests 10, 11, 13a–13d run the §2.7 script under a local bash (WSL or Git Bash) against synthetic fixtures, with the producers substituted as noted; they verify script semantics and the §5 classifier, not the staging host. Assertions are labeled **deterministic** (must hold on every run) or **scheduling-dependent** (a stated set of acceptable values); a test never requires a marker that the mechanism under test can legitimately prevent from being emitted.

**Test 1 — Time limit from launch:** child sleeps 3 s **before reading stdin**, then prints 1 line/s indefinitely. Deadline 10 s. Assert: `supervisorOutcome = TIME_LIMIT`; elapsed at trigger is 10.0–10.5 s **measured from launch** (not 13 s); capture has ≈7 lines; total elapsed through reconciliation is recorded (no bound asserted).

**Test 2 — Byte limit:** child streams data. `byteBudget = 4,096`. Assert: `BYTE_LIMIT`; combined persisted bytes = 4,096; `bytesReserved = Σ bytesPersisted = 4,096`.

**Test 3 — Line limit, no trailing bytes:** child streams lines of varying length without ever aligning to 4,096-byte buffers. `lineBudget = 50`. Assert: `LINE_LIMIT`; combined newline count = 50; the last byte of the truncated file is 0x0A (no partial trailing line); `linesReserved = Σ linesPersisted = 50`.

**Test 4 — Partial evidence:** child prints 5 lines then sleeps 60 s. Deadline 10 s. Assert: `TIME_LIMIT`; 5 lines persisted; files exist.

**Test 5 — Stdin delivery and stdin stall:** (a) child echoes stdin; 3 lines written. Assert: 3 lines captured; `stdinDelivered = true`; `NORMAL`. (b) child never reads stdin; script payload 1 MB (exceeds pipe buffer). Assert: poll sets `stdinDeliveryFailed` at 10.0–10.5 s from launch; `supervisorOutcome = STDIN_FAILURE`; not `NORMAL`.

**Test 6 — Stderr separation:** child writes distinct lines to stdout and stderr. Assert: each line in the correct file only.

**Test 7 — Exact budget followed by silence (no further Read):** child writes exactly `byteBudget` bytes in one burst then sleeps 60 s. Assert: `limitExhausted` set at the reservation of the final buffer; `readCount` equals the number of reads needed to consume the budget (no additional blocking `Read()` after exhaustion); elapsed at trigger ≤ 1 s (far below the deadline); `BYTE_LIMIT`; persisted = `byteBudget` exactly. Repeat with exactly `lineBudget` newlines → `LINE_LIMIT`.

**Test 8 — Exit concurrent with limit:** child writes exactly `byteBudget` bytes and exits 0 immediately. Assert: `supervisorOutcome = BYTE_LIMIT`, not `NORMAL`; exit code 0 recorded; `pollTrigger` may be either value.

**Test 9 — Capture failure on either stream:** (a) inv-stdout.bin opened on a path made unwritable after open (or a stream wrapper that throws on the 2nd write). Assert: `writeFailed` on stdout reader; `CAPTURE_FAILURE`; stderr file intact. (b) same for **stderr** only. Assert: `CAPTURE_FAILURE` (stderr failure alone is terminal, not `NORMAL`); stdout file intact.

**Test 10 — Inaccessible / unknown candidates (INV-3):** the §2.7 script runs under a fixture root (container or test-only prefix substitution for `/home` and `/root`, recorded as such) with three homes: `alpha` (readable, `.pm2` present), `beta` (home mode 000), `gamma` (readable, `.pm2` absent, `stat` PATH-shim sleeps 30 s for `…/gamma/.pm2` and execs real `stat` otherwise). The fixture-derived candidate list, in script order, is exactly: `/root/.pm2`, `/home/alpha/.pm2`, `/home/beta/.pm2`, `/home/gamma/.pm2` — **four** candidates. Assert: `INV-3-CHECKS: 4`; exactly four `INV-3-CHECK-RC` markers with codes, in order, `/root/.pm2` → 1 (fixture `/root` mode 700 → `Permission denied` → INACCESSIBLE; if the fixture makes `/root` searchable, → `No such file or directory` → ABSENT; the fixture must declare which and the assertion follows it), `alpha` → 0, `beta` → 1 with path-matched `Permission denied`, `gamma` → 124; `PRESENT: 1`, `FAILED: 3`, `UNRESOLVED: 0`; PRESENT + FAILED = CHECKS; all closing markers and `INV-3-END` present; `CAP-RC: 0`; execution class `EXEC_COMPLETE`; **`COVERAGE_INCOMPLETE`** listing `INACCESSIBLE(/home/beta/.pm2)`, `TIMEOUT(/home/gamma/.pm2)`, and `INACCESSIBLE(/root/.pm2)` or nothing for `/root/.pm2` per the declared fixture. No candidate outside this list may appear.

**Test 11 — Sub-result accounting:** (a) `pgrep` shim returns 3 PIDs; `ps` shim fails for all. Assert: 3 `-RC` markers; `PS-ATTEMPTED = 3`, `PS-OK = 0`, `PS-FAIL = 3`; `EXEC_COMPLETE`; **`COVERAGE_INCOMPLETE`**. (b) `pgrep` shim returns 3 PIDs; the loop is killed after the 2nd `ps` (shim exits the group). Assert: 2 `-RC` markers but closing markers absent → `INCOMPLETE`; `COVERAGE_INCOMPLETE`. (c) `pgrep` shim returns 250 PIDs. Assert: `INV-6-PID-LIMIT: attempted=200 total=250`; `PS-ATTEMPTED = 200` (not 201); exactly 200 `-RC` markers; `COVERAGE_INCOMPLETE`. (d) `pgrep` shim returns 3 PIDs; one `-RC` marker deleted from the capture before classification. Assert: RC-count 2 ≠ ATTEMPTED 3 → `INCOMPLETE` even though `PS-ATTEMPTED` is present.

**Test 12 — Limit or failure discovered during drain:** (a) child writes a final burst that exactly consumes the byte budget and exits before the reader reserves it; the poll observes `HasExited` first. Assert: reconciliation yields `BYTE_LIMIT`, not `NORMAL`. (b) stderr reader's `Close()` throws (file handle sabotaged after last flush). Assert: `closeFailed`; `CAPTURE_FAILURE`; not `NORMAL`.

**Test 13a — Per-observation cap before session cap (pipeline):** run §2.7 locally with `getent passwd` substituted by `seq 1 200000`. Deterministic assertions: `INV-1-CAP-TRUNCATED` marker present exactly once; `INV-1-CAP-RC: 3`; no data record follows the marker in INV-1's output; `INV-1-PRODUCER-RC`, `INV-1-FILTER-RC`, `INV-1-END` present (outside cap); INV-1 execution class `TRUNCATED_BY_CAP`, `COVERAGE_INCOMPLETE`; INV-1 capped stdout ≤ 32,768 bytes + marker; `bytesReserved < byteBudget` (session cap not reached); INV-2 … INV-6 all present with END markers. Scheduling-dependent assertions: `INV-1-PRODUCER-RC` ∈ {0, 141} and `INV-1-FILTER-RC` ∈ {0, 141}; the classifier treats either as expected cap consequence. Negative assertion: substitute the filter with `awk '{print; exit 2}'` after 10 lines — `FILTER-RC: 2` must be classified `FILTER_FAILURE` (rank 9) and **not** suppressed by CAP-RC (here CAP-RC is 0, so the cap rule does not even apply); then with `seq` replaced by a producer that exits 5 after emitting beyond the cap — CAP-RC 3 with `PRODUCER-RC: 5` must still yield `PRODUCER_ERROR` evidence recorded alongside `TRUNCATED_BY_CAP` (rule 4 is primary; the non-SIGPIPE code is recorded as a secondary failure, not dropped).

**Test 13b — Candidate limit with short paths (INV-3):** fixture with 70 homes named `h01`…`h70` (no `.pm2`), plus fixture `/root`. Candidate list = `/root/.pm2` + 70 = 71. Per-candidate output ≈ 3 lines / ≈ 100 bytes, so 64 candidates ≈ 192 lines / ≈ 6.4 KB — **within** the 220-line / 12,288-byte cap. Assert: `INV-3-CANDIDATE-LIMIT: attempted=64 total=71` present; `INV-3-CHECKS: 64`; exactly 64 `INV-3-CHECK-RC` markers; `PRESENT + FAILED = 64`; `UNRESOLVED ≥ 1`; all four in-cap closing markers present; `CAP-RC: 0`; `GROUP-RC: 0`; `INV-3-END` present; execution class `EXEC_COMPLETE`; **`COVERAGE_INCOMPLETE`** with `CANDIDATE_LIMIT(64, 71)`.

**Test 13c — Output cap with long paths (INV-3):** fixture with 40 homes whose names are 200 characters. Each candidate ≈ 3 lines / ≈ 700 bytes → 40 candidates ≈ 28 KB, exceeding the 12,288-byte cap mid-loop. Deterministic assertions: `INV-3-CAP-TRUNCATED` present exactly once; `INV-3-CAP-RC: 3`; `INV-3-GROUP-RC` and `INV-3-END` present (outside cap); the in-cap closing markers (`CHECKS`, `PRESENT`, `FAILED`, `UNRESOLVED`) are **absent** and their absence is accepted — execution class `INCOMPLETE +TRUNCATED_BY_CAP` (rule 2 with cap evidence), **`COVERAGE_INCOMPLETE`** with `TRUNCATED_BY_CAP`. Scheduling-dependent assertion: `INV-3-GROUP-RC` ∈ {0, 141}. The test must **not** require `INV-3-CHECKS` or any marker that cap termination can prevent from being emitted.

**Test 13d — INV-4 sub-observation markers and interruption:** run §2.7 locally with `systemctl` substituted by a shim. (a) Normal: assert the exact marker sequence of the §2.4 "Normal" row; INV-4a and INV-4b each classified from their own markers; parent `EXEC_COMPLETE`. (b) Shim for the second call sleeps 60 s; supervisor deadline 10 s. Assert: `INV-4a-END` present; `INV-4b` opening present; `INV-4b-END`, `INV-4-END` absent; INV-4a classified normally; INV-4b `INCOMPLETE +TRUNCATED`; parent `INCOMPLETE +TRUNCATED`; INV-4 `COVERAGE_INCOMPLETE`. (c) Shim kills the script right after `INV-4a-END` (exit before `INV-4b`). Assert: INV-4b `NOT_EXECUTED`; parent `INCOMPLETE`; `COVERAGE_INCOMPLETE`.

**Test 14 — Reader timeout, shared drain deadline on the Stopwatch basis, ownership preserved:** stdout reader's file is a named pipe with no consumer so `Write` blocks forever; child exits normally. Assert: stdout join times out; recorded `remaining()` for the stderr and stdin joins is ≤ the remaining Stopwatch window (each strictly less than 5 s, and the sum of all three join waits ≤ 5 s + slack); Stopwatch elapsed at end of drain − Stopwatch elapsed at drain start ≤ 5.5 s (not 10–15 s); `PERSISTENCE_UNCONFIRMED`; main did not call `Close()` on the stdout file (instrumented flag / handle still open); inv-stdout.bin size reported `UNCONFIRMED`. Clock-independence: during the drain, the test advances the system clock by +60 s (or injects a fake `DateTime` provider); the drain duration measured by Stopwatch must be unaffected, and no `DateTime.UtcNow` call is made on the drain path (verified by an instrumented time provider that throws if called).

**Test 15 — Exit status unknown and Kill failure paths (stub `IProcess`):** (a) `Kill()` succeeds but `HasExited` stays false. Assert: `killUnconfirmed`; `exitCode = UNKNOWN`; readers (stub streams stay open) time out → `PERSISTENCE_UNCONFIRMED` recorded with `killUnconfirmed`; no `-1` anywhere in the record. (b) `Kill()` throws `Win32Exception("Access is denied")`. Assert: `killFailed = true`, `killError` recorded verbatim; T2 `WaitForExit(5000)` still executed (stub call log); `HasExited` not inferred (stub reports false → `killUnconfirmed`); drain executed with the Stopwatch-based shared deadline; reconciliation executed; outcome `PERSISTENCE_UNCONFIRMED` if the stub streams stay open, `EXIT_STATUS_UNKNOWN` if the stub closes them; ownership of streams/files unchanged (no `Close()` by main). (c) `Kill()` throws `InvalidOperationException`; stub then reports `HasExited = true`, exit code 0. Assert: `killNote = ALREADY_EXITED_OR_NO_HANDLE`; exit code 0 recorded from `HasExited`/`ExitCode`, not from the exception; outcome follows the normal reconciliation rows (e.g., `TIME_LIMIT` if that was the trigger). (d) `Kill()` throws `InvalidOperationException` but stub keeps `HasExited = false`. Assert: no exit inferred; `killUnconfirmed`; `EXIT_STATUS_UNKNOWN` or `PERSISTENCE_UNCONFIRMED` per stream state.

**Test 16 — Unclassified SSH failure:** child exits 255 with stderr text matching none of the recognized host-key / auth / connection patterns. Assert: session class `SSH_FAILURE_UNCLASSIFIED` (§5.3); never `SESSION_EXEC_COMPLETE`; stderr preserved.

**Status:** Designed. NOT EXECUTED during Step 2. Step 3 pre-flight requirement (§10). Tests 10, 11, 13a–13d require a local bash with GNU coreutils; if unavailable on the inspector's system, they run under WSL and that is recorded.

---

## §5. Failure classifications

### 5.1 Per-observation classification precedence

Each observation receives exactly one **execution class** (this section) and exactly one **coverage class** (§5.4). Execution class describes whether the commands ran to their END marker with consistent accounting. It never asserts coverage (§0 invariant 15). Every observation has an opening marker (`--- INV-N: ... ---`), cap/RC markers, and a required END marker (`--- INV-N-END ---`).

**Cap-escalation rule (all observations):** when `<tag>-CAP-RC` = 3, the `<tag>-CAP-TRUNCATED` marker must be present (deterministic cap evidence). The exit status of upstream stages (producer, filter, GROUP-RC) is then scheduling-dependent: **0** (stage finished before the pipe closed) and **141** (SIGPIPE) are both expected consequences and are **not** independent PRODUCER_ERROR / FILTER_FAILURE. Any other non-zero upstream code alongside CAP-RC 3 is a recorded failure classified on its own merits and carried as a secondary failure note next to the cap classification — never suppressed.

#### Command-based observations (INV-1, INV-2, INV-4a, INV-4b)

INV-4a and INV-4b each carry their **own** opening marker (`--- INV-4a: LIST-UNIT-FILES ---`, `--- INV-4b: LIST-UNITS-ALL ---`), their own three RC markers, and their own END marker (`--- INV-4a-END ---`, `--- INV-4b-END ---`), emitted by the script (§2.4, §2.7). The rules below apply to them directly using those markers; the parent `INV-4` / `INV-4-END` markers are handled in §5.2.

Apply the first matching rule:

| Pri | Execution class | Condition |
|---|---|---|
| 1 | `NOT_EXECUTED` | Opening marker absent from inv-stdout.bin |
| 2 | `INCOMPLETE` | Opening marker present but END marker absent, OR any required RC marker (PRODUCER/RC, FILTER, CAP) absent |
| 3 | `MALFORMED` | An RC marker contains a non-integer value |
| 4 | `TRUNCATED_BY_CAP` | CAP-RC = 3 (per-observation cap reached; `-CAP-TRUNCATED` marker present). Partial data retained |
| 5 | `CAP_FAILURE` | CAP-RC ∉ {0, 3} (e.g., 127 = awk missing). Data path not trustworthy |
| 6 | `TIMEOUT` | Producer exit 124 or 137 |
| 7 | `MISSING_TOOL` | Producer exit 127 |
| 8 | `PRODUCER_ERROR` | Producer exit non-zero, not 124/137/127, not a valid-empty code |
| 9 | `FILTER_FAILURE` | Filter is `grep` and exit ≥ 2, OR filter is any non-grep tool (awk) and exit ≥ 1 |
| 10 | `FILTER_NO_MATCH` | Filter is `grep`, producer exit 0, grep exit exactly 1. Valid empty result. Does NOT apply to awk |
| 11 | `EXEC_COMPLETE` | Producer exit 0, filter exit 0 (if pipeline), CAP-RC 0, END marker present |

#### Loop-based observations (INV-3, INV-5)

| Pri | Execution class | Condition |
|---|---|---|
| 1 | `NOT_EXECUTED` | Opening marker absent |
| 2 | `INCOMPLETE` | Any required marker absent: CHECKS, PRESENT, FAILED, UNRESOLVED, GROUP-RC, CAP-RC, END; **or** count of `-CHECK-RC` markers ≠ CHECKS; **or** PRESENT + FAILED ≠ CHECKS. When CAP-RC = 3 and the `-CAP-TRUNCATED` marker are also present, record `INCOMPLETE +TRUNCATED_BY_CAP`: the in-cap closing markers were legitimately prevented by cap termination, and their absence is expected evidence, not a separate defect |
| 3 | `MALFORMED` | Any marker value non-integer |
| 4 | `TRUNCATED_BY_CAP` | CAP-RC = 3 with all in-cap closing markers still present (cap reached exactly at the end of the loop output) |
| 5 | `CAP_FAILURE` | CAP-RC ∉ {0, 3} |
| 6 | `EXEC_COMPLETE` | All markers present and counts consistent; CAP-RC 0. Individual candidate `stat` failures/timeouts do not change the execution class — they drive the **coverage** class (§5.4) |

#### INV-6 (pgrep + per-PID loop group)

| Pri | Execution class | Condition |
|---|---|---|
| 1 | `NOT_EXECUTED` | Opening marker absent |
| 2 | `INCOMPLETE` | Any required marker absent: PGREP-RC, TOTAL-PIDS, PS-ATTEMPTED, PS-OK, PS-FAIL, GROUP-RC, CAP-RC, END; **or** PS-ATTEMPTED ≠ min(TOTAL, 200); **or** (`PID-LIMIT` present) ≠ (TOTAL > 200); **or** actual count of `INV-6-PS-PID-<pid>-RC` markers ≠ PS-ATTEMPTED; **or** PS-OK + PS-FAIL ≠ PS-ATTEMPTED |
| 3 | `MALFORMED` | Any marker value non-integer |
| 4 | `TRUNCATED_BY_CAP` | CAP-RC = 3 |
| 5 | `CAP_FAILURE` | CAP-RC ∉ {0, 3} |
| 6 | `TIMEOUT` | pgrep 124 / 137 |
| 7 | `MISSING_TOOL` | pgrep 127 |
| 8 | `PRODUCER_ERROR` | pgrep ≥ 2, not above |
| 9 | `EXEC_COMPLETE` | pgrep ∈ {0, 1}; all markers present and counts consistent; CAP-RC 0. Per-PID `ps` failures do not change the execution class — they drive the coverage class |

**Secondary flags:** `+TRUNCATED` — END marker absent while `supervisorOutcome` is BYTE_LIMIT / LINE_LIMIT / TIME_LIMIT (session-level interruption). `+TRUNCATED_BY_CAP` — CAP-RC = 3 with cap marker present when the primary class is INCOMPLETE (loop groups). `+UPSTREAM_FAILURE(<stage>, <rc>)` — a non-{0,141} upstream code recorded alongside a cap classification.

### 5.2 Sub-observation combination

**INV-4 (parent + two sub-observations):**
1. INV-4a and INV-4b are classified independently by the command-based rules using their own opening / RC / END markers.
2. Parent INV-4: `NOT_EXECUTED` if `--- INV-4: SYSTEMD-PM2-SERVICES ---` is absent; `INCOMPLETE` if `--- INV-4-END ---` is absent or either sub-observation is not one of {`EXEC_COMPLETE`, `FILTER_NO_MATCH`}; otherwise the parent execution class = worst (lowest-numbered rule) of the two sub-observations, which in that case is `EXEC_COMPLETE` or `FILTER_NO_MATCH`.
3. Parent coverage = `COVERAGE_INCOMPLETE` unless both sub-observations are `EXEC_COMPLETE` / `FILTER_NO_MATCH` and the parent END marker is present.
4. Static traces for the normal case and for interruption before / inside each sub-observation are given in §2.4.

**INV-6 per-PID sub-results:**
- ps exit 0: process found
- ps exit 124 / 137: sub-result TIMEOUT
- ps exit 127: sub-result MISSING_TOOL
- other non-zero: ps failed; cause not determined by exit code (race, format, permission, tool). inv-stderr.bin consulted for the diagnostic
- Sub-results feed the INV-6 execution-class count checks (rule 2) and the coverage class (§5.4). Presence of `PS-ATTEMPTED` is never sufficient on its own; the actual `-RC` marker count is compared to it.

### 5.3 Session-level classification precedence

Input: `supervisorOutcome` (§4.3.3 reconciliation), SSH exit code, inv-stdout.bin markers, inv-stderr.bin. Apply the first match. Every session gets exactly one class; there is no fall-through.

| Pri | Session class | Condition | Capture? |
|---|---|---|---|
| 1 | `NO_TRUSTED_HOST_KEY` | §3.3 prerequisite not met (pre-launch) | No |
| 2 | `ENFORCEMENT_NOT_VERIFIED` | §4.4 verification not passed (pre-launch) | No |
| 3 | `STDIN_FAILURE` | `supervisorOutcome = STDIN_FAILURE` | Partial |
| 4 | `CAPTURE_FAILURE` | `supervisorOutcome = CAPTURE_FAILURE` (stdout **or** stderr read/write/flush/close failure) | Partial |
| 5 | `PERSISTENCE_UNCONFIRMED` | `supervisorOutcome = PERSISTENCE_UNCONFIRMED` (any reader/writer join timeout) | Unconfirmed |
| 6 | `SESSION_TRUNCATED` | `supervisorOutcome = BYTE_LIMIT` or `LINE_LIMIT` | Yes (bounded) |
| 7 | `SESSION_TIMEOUT` | `supervisorOutcome = TIME_LIMIT` | Yes (partial) |
| 8 | `EXIT_STATUS_UNKNOWN` | `supervisorOutcome = EXIT_STATUS_UNKNOWN` | Yes |
| 9 | `HOST_KEY_MISMATCH` | exit 255 and stderr matches a recognized host-key pattern. **Security-relevant** | Stderr |
| 10 | `AUTHENTICATION_FAILURE` | exit 255 and stderr matches a recognized authentication pattern | Stderr |
| 11 | `CONNECTION_FAILURE` | exit 255 and stderr matches a recognized connection pattern | Stderr |
| 12 | `SSH_FAILURE_UNCLASSIFIED` | exit 255 and no recognized pattern (catch-all for 255) | Stderr |
| 13 | `SESSION_MALFORMED` | `INVENTORY-START` absent | Yes |
| 14 | `SESSION_INCOMPLETE` | exit ≠ 0 (non-255), or `INVENTORY-END` absent, or any of the six `INV-N-END` absent (catch-all for a normally supervised process that failed a marker condition) | Yes |
| 15 | `SESSION_EXEC_COMPLETE` | `supervisorOutcome = NORMAL`, exit 0, `INVENTORY-START` present, all six `INV-N-END` present, `INVENTORY-END` present | Yes |

**§0 invariants 14–15:** `SESSION_EXEC_COMPLETE` requires reconciled `NORMAL` plus all markers. It asserts execution only. Session coverage is recorded separately (§5.4).

**Rows 3–8 override marker-based rows.** If the supervisor recorded any non-NORMAL outcome, the session class is that row regardless of which markers are present.

**Pre-launch blocked (1–2):** No SSH, no capture. Blocker evidence recorded directly.

### 5.4 Coverage classification (separate from execution)

Each observation gets exactly one coverage class; the session gets an aggregate.

| Observation | `COVERAGE_FULL` iff | Otherwise `COVERAGE_INCOMPLETE` with reasons |
|---|---|---|
| INV-1, INV-2 | execution class `EXEC_COMPLETE` | any other execution class |
| INV-4 | both sub-observations `EXEC_COMPLETE` or `FILTER_NO_MATCH` | any other |
| INV-3, INV-5 | `EXEC_COMPLETE` **and** UNRESOLVED = 0 (or every unresolved glob resolves per §2.3/§2.5 rules) **and** no `CANDIDATE-LIMIT` **and** every FAILED candidate resolves to ABSENT via a path-matched `No such file or directory` diagnostic in inv-stderr.bin | reasons: `INACCESSIBLE(<path>)`, `TIMEOUT(<path>)`, `UNKNOWN(<path>)` (no matching diagnostic), `GLOB_UNRESOLVED(<pattern>)`, `CANDIDATE_LIMIT(attempted, total)`, `TRUNCATED_BY_CAP`, `INCOMPLETE` |
| INV-6 | `EXEC_COMPLETE` **and** no `PID-LIMIT` **and** PS-FAIL = 0 | reasons: `PS_FAIL(<pid>, rc)`, `PID_LIMIT(attempted, total)`, `TRUNCATED_BY_CAP`, `INCOMPLETE`, pgrep TIMEOUT/MISSING_TOOL/PRODUCER_ERROR |

Any observation whose execution class is not `EXEC_COMPLETE` (or `FILTER_NO_MATCH` for INV-4) is automatically `COVERAGE_INCOMPLETE`.

**Session coverage:** `SESSION_COVERAGE_FULL` iff session class is `SESSION_EXEC_COMPLETE` **and** all six observations are `COVERAGE_FULL`. Otherwise `SESSION_COVERAGE_INCOMPLETE` listing every reason. `SESSION_COVERAGE_FULL` still asserts only that the registered candidate set was fully observed; §9 limitations and §0 invariants 9, 12, 13 continue to apply — it is not proof of absence.

---

## §6. Leases, privilege requirements, and GOVERNANCE ownership

### 6.1 Required leases

| Step | Lease | Scope | Acquired | Released |
|---|---|---|---|---|
| Step 2 | GOVERNANCE | Board/backlog/stage-start writes | transiently | end of Step 2 |
| Step 3 | STAGING | Read-only SSH | before connection | after session ends |
| Step 3 | GOVERNANCE | Record writes | transiently | end of Step 3 |
| Step 4 | GOVERNANCE | Review, lock writes | transiently | end of Step 4 |

### 6.2 Privilege requirements

All remote commands as `ubuntu`. No privilege escalation.

### 6.3 GOVERNANCE ownership

Acquired transiently at Steps 2, 3, 4 for record writes.

---

## §7. Evidence handling

### 7.1 Capture files

| File | Content |
|---|---|
| `inv-stdout.bin` | SSH stdout: observation data, markers, exit codes |
| `inv-stderr.bin` | SSH stderr: diagnostics, stat/ps errors, SSH client messages |

Permissions restrict to inspector's account. Streams NOT merged.

### 7.2 Retention

Retained through Step 4 review. No automatic deletion. Retained whenever capture occurred (§5.3 classifications 3–15), including unconfirmed-persistence captures. Not committed, uploaded, or shared.

### 7.3 Publication allowlist

Publishable: account names/UIDs/homedirs/shells; home directory listings; `.pm2` paths/owners/types; systemd unit names; installation paths; daemon user/PID/lstart; markers/timestamps/exit codes; stat diagnostics (absent/inaccessible); session metadata. All other content requires redaction review.

### 7.4 SSH side effects

Auth log, lastlog/wtmp/utmp entries. No shell history (bash -s stdin). No files created. No PM2 state changes. Remote processes may persist (§9.9).

### 7.5 E-J5 interaction

This session is activity on (H, A). E-J5 applicability determined under validity/invalidation rules at attestation time. Not pre-determined here.

---

## §8. Operator testimony and evidence sources

### 8.1 Evidence sources

| Source | Type | Use |
|---|---|---|
| This inventory | Machine observation | Current accounts, PM2 homes, installations, daemons |
| Operator testimony (Keith) | Human knowledge | Historical practices, non-standard configs |
| Locked predecessors | Governance record | INVESTIGATION-01 §12 (2026-09-18) |

### 8.2 No blanket exclusion

Both inventory and operator testimony contribute. Neither alone necessarily sufficient.

---

## §9. Coverage limitations

### 9.1 Permission-restricted paths

`ubuntu` cannot read restricted directories. `stat` on candidates in restricted parents exits non-zero with "Permission denied" on stderr. This is recorded per-candidate in INV-3/INV-5 sub-results and in inv-stderr.bin, and propagates to `COVERAGE_INCOMPLETE` as `INACCESSIBLE(<path>)` (§5.4). No permission flag is derived from commands that emit no diagnostics; a failed candidate with no path-matched diagnostic is `UNKNOWN`, also coverage-incomplete.

### 9.2 Non-standard PM2_HOME locations

PM2_HOME can be any path. INV-3 checks only `$HOME/.pm2`. No config files searched. INV-6 captures user/pid/lstart only — does NOT capture process title or PM2_HOME. Operator testimony (§8) addresses known configs.

### 9.3 Historical accounts

Current accounts only. Removed accounts not visible. Operator testimony addresses.

### 9.4 Crontab and non-interactive PM2

Crontab entries for other users not inspected. INV-4 (systemd) and INV-6 (daemons) provide partial coverage.

### 9.5 Candidate check gaps

No directory-tree traversal. Only explicitly derived candidate paths checked, up to the 64-candidate limit per observation.

**INV-3:** Not checked: home directories outside `/home` (other than `/root`) — INV-1's homedir field is the reviewer's cross-reference for such accounts; `.pm2` outside home dirs; deeper nesting. `/home/` entries the shell cannot enumerate surface as `GLOB-UNRESOLVED`; entries whose `.pm2` cannot be stat'ed surface as INACCESSIBLE/TIMEOUT/UNKNOWN. All propagate to `COVERAGE_INCOMPLETE`.

**INV-5:** Not checked: `/opt`, `/srv`, `/var`; yarn/pnpm; Docker volumes; non-standard prefixes; nvm installs whose `versions/node` directory cannot be enumerated (surfaced as `GLOB-UNRESOLVED` with a parent `stat` for resolution).

Glob expansion enumerates `/home/` (and, per home, `.nvm/versions/node/`) only. No vault-name list maintained. No exclusion claim.

### 9.6–9.9

**9.6 Point-in-time.** Observation is a snapshot. Post-observation changes not captured.

**9.7 Incomplete finding validity.** Blocked or partial = valid outcome (§0.9).

**9.8 Daemon title matching.** `God Daemon` pattern is heuristic. pgrep no-match ≠ absence (§0.13).

**9.9 Remote process state.** SSH disconnect does not guarantee cleanup (§0.11).

---

## §10. Step 3 AC

**Execution prerequisites (BLOCKERs):**
- [ ] Trusted host-key provenance (§3.3)
- [ ] Local supervision verification passed (§4.4 Tests 1–16 including 13a–13d and 15a–15d; all deterministic assertions hold; all scheduling-dependent values within their stated sets)

**Pre-flight:**
- [ ] Keith authorizes Step 3 at stated baseline
- [ ] STAGING acquired; known_hosts confirmed; provenance recorded
- [ ] Supervision tests passed; configured with production params (131,072 bytes, 3,000 lines, 180 s deadline from launch, 10 s stdin, 5 s kill wait, 5 s shared drain)

**Execution:**
- [ ] SSH under supervision (§4.3); output captured; `supervisorOutcome` recorded after reconciliation (§4.3.5)
- [ ] Session classified (§5.3); per-observation execution class (§5.1) and coverage class (§5.4) recorded; session coverage recorded
- [ ] STAGING released after session
- [ ] Pre-launch blocked: blocker evidence, no SSH, no capture, no fabricated data
- [ ] Capture produced: files retained (§7.2); finding recorded; coverage limitations (§9) retained
- [ ] GOVERNANCE transiently; board/backlog updated
- [ ] Validator; `git diff --check`
- [ ] No PM2, no file creation on host, no privilege escalation
- [ ] No predecessor edits; no Git commit/push
- [ ] Step 4 NOT AUTHORIZED; §0 preserved

---

## §11. Step 4 AC

- [ ] Keith authorizes at stated baseline
- [ ] Pre-launch blocked: blocker evidence accurate; no SSH; no capture; no fabricated data
- [ ] Capture produced: raw files available; session classification verified against capture + reconciled supervisor record (reserved vs persisted counts, per-stream flags); per-observation execution class verified against markers, RC/CAP markers, and marker **counts** (CHECK-RC vs CHECKS; PS-PID-RC vs PS-ATTEMPTED); coverage class verified with path-matched inv-stderr.bin diagnostics and glob-resolution rules; publication allowlist checked; §9 limitations retained; no absence claims outside scope; execution-complete labels not presented as coverage; no P5/C-ACQ claims
- [ ] §0 verified; predecessors unchanged; GOVERNANCE transiently
- [ ] COMPLETE AND LOCKED; validator; `git diff --check`; no predecessor edits; no Git

---

## §12. Non-effects (Step 2)

No SSH, STAGING, host inspection, vault/journal, config reads, PM2, runtime, acquisition, transfer, P5/C-ACQ claims, predecessor amendments, EXEC-01C6A changes, HOST_CLEAN, canary, implementation, sidecar, scope-proposal freeze, trust-provenance resolution, supervision-test execution, SSH pre-flight.

**Activity ledger:** All zeros except: stage-start created = YES (corrections #1–#5); commands frozen = YES (§2.7); supervision verification executed = 0; synthetic tests executed = 0; subagents = 0; Git = 0.
