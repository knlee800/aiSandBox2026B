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
**Step 3 local-preflight correction #1:** 2026-09-28 — Keith-directed, localized; frozen plan and run-1 evidence preserved as historical text. (1) D-1: §4.3.3 terminal-outcome precedence amended — unknown/unconfirmed termination (EXIT_STATUS_UNKNOWN) now outranks byte/line/time limits; conditions unchanged; T15(c) retains TIME_LIMIT. (2) D-2: INV-6 byte cap and 200-PID limit unchanged; Test 11(c) split into (c1) PID limit / (c2) byte cap first — expected interaction of independent bounds. (3) D-3: §5.3 rows 9—12 pattern set and precedence recorded; Test 16 extended (16b—g). (4) WaitForExit protected (waitFailed/waitError; never infers exit; drain and reconciliation always run); Test 15(e) added. (5) Acceptance reporting corrected: executed-passed / blocked-by-design-conflict / substituted / unverified; PASS-WITH-DESIGN-CONFLICT withdrawn; §10 local-verification prerequisite remains unticked (U-1 OS-level stat permission, U-2 clock-change/injection). Amendment text in §14; dated pointer lines at each affected location. Step 3 remains PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE; §3.3 provenance unresolved.

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

> **Amended 2026-09-28 (Step 3 run 4 — §16.4):** the **host-key lookup identity** is determined from the effective client configuration (`ssh -G`, no connection) as the static IPv4 literal configured as `HostName` for `Host aisandbox-staging` (no `HostKeyAlias`, `CheckHostIP no`, port 22 → un-bracketed form); the alias `aisandbox-staging` itself is not a lookup identity. Keith's confirmation of this row remains required. The **trusted key source** row remains an unestablished prerequisite (§3.3; §16.6). The frozen table is not rewritten.

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

> **Amended 2026-09-28 (Step 3 run 4 — §16):** provenance collection was attempted under Keith's narrow authorization. The AWS-side path is **BLOCKED** (no existing authorized AWS authentication context on the operator host; none of `sts:GetCallerIdentity`, `lightsail:GetInstance`, `lightsail:GetInstanceAccessDetails` was called; no credentials created). The only local candidate — `known_hosts` line 12, `ssh-ed25519`, `SHA256:kwAg4iEcpglnu4XTqy6NrQOlz8xzybbV3xY6rzwmwO0` (same key under `staging.ainow.biz`) — is continuity / first-connection-class evidence, not independent provenance. **§3.3 remains UNESTABLISHED — BLOCKER.** No trust exception adopted; no key replaced or accepted. See §16.3–16.6.

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

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.1 / §14.4):** read `EXIT_STATUS_UNKNOWN` (rank 6) as **rank 4** — unknown/unconfirmed termination outranks byte/line/time limits; T2 is now `try { WaitForExit(5000) } catch (Exception) { waitFailed = true; waitError = ... }` — a wait exception is recorded, never infers exit, and never bypasses drain or reconciliation.

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

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.1):** the row order above is **superseded**: 1 STDIN_FAILURE, 2 CAPTURE_FAILURE, 3 PERSISTENCE_UNCONFIRMED, **4 EXIT_STATUS_UNKNOWN**, 5 BYTE_LIMIT / LINE_LIMIT, 6 TIME_LIMIT, 7 NORMAL. Conditions unchanged; the table above is retained as the historical freeze. `pollTrigger`, limit flags and kill/wait/exit evidence are recorded independently of the outcome.

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

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.4):** two fields added — `waitFailed` (bool) and `waitError` (`WaitForExit` exception type and message, verbatim); neither establishes exit.

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

> **Amended 2026-09-28 (Step 3 run 3 — §15.1):** the `beta` INACCESSIBLE branch is verified by executed evidence on a real mode-000 parent with GNU `stat` in a Linux container (U-1 resolved); the run-2 `stat`-shim evidence for `beta` is superseded. Fixture text unchanged.

**Test 11 — Sub-result accounting:** (a) `pgrep` shim returns 3 PIDs; `ps` shim fails for all. Assert: 3 `-RC` markers; `PS-ATTEMPTED = 3`, `PS-OK = 0`, `PS-FAIL = 3`; `EXEC_COMPLETE`; **`COVERAGE_INCOMPLETE`**. (b) `pgrep` shim returns 3 PIDs; the loop is killed after the 2nd `ps` (shim exits the group). Assert: 2 `-RC` markers but closing markers absent → `INCOMPLETE`; `COVERAGE_INCOMPLETE`. (c) `pgrep` shim returns 250 PIDs. Assert: `INV-6-PID-LIMIT: attempted=200 total=250`; `PS-ATTEMPTED = 200` (not 201); exactly 200 `-RC` markers; `COVERAGE_INCOMPLETE`. (d) `pgrep` shim returns 3 PIDs; one `-RC` marker deleted from the capture before classification. Assert: RC-count 2 ≠ ATTEMPTED 3 → `INCOMPLETE` even though `PS-ATTEMPTED` is present.

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.2):** (c) is split into **(c1)** PID limit reached with sufficiently short per-PID output (assertions as above, plus `CAP-RC: 0`) and **(c2)** byte cap reached first with realistic 42-byte `ps` output — assert `INCOMPLETE +TRUNCATED_BY_CAP` and `COVERAGE_INCOMPLETE`; no marker the cap can prevent is required. Limits unchanged; expected interaction of independent bounds, not a cap defect.

**Test 12 — Limit or failure discovered during drain:** (a) child writes a final burst that exactly consumes the byte budget and exits before the reader reserves it; the poll observes `HasExited` first. Assert: reconciliation yields `BYTE_LIMIT`, not `NORMAL`. (b) stderr reader's `Close()` throws (file handle sabotaged after last flush). Assert: `closeFailed`; `CAPTURE_FAILURE`; not `NORMAL`.

**Test 13a — Per-observation cap before session cap (pipeline):** run §2.7 locally with `getent passwd` substituted by `seq 1 200000`. Deterministic assertions: `INV-1-CAP-TRUNCATED` marker present exactly once; `INV-1-CAP-RC: 3`; no data record follows the marker in INV-1's output; `INV-1-PRODUCER-RC`, `INV-1-FILTER-RC`, `INV-1-END` present (outside cap); INV-1 execution class `TRUNCATED_BY_CAP`, `COVERAGE_INCOMPLETE`; INV-1 capped stdout ≤ 32,768 bytes + marker; `bytesReserved < byteBudget` (session cap not reached); INV-2 … INV-6 all present with END markers. Scheduling-dependent assertions: `INV-1-PRODUCER-RC` ∈ {0, 141} and `INV-1-FILTER-RC` ∈ {0, 141}; the classifier treats either as expected cap consequence. Negative assertion: substitute the filter with `awk '{print; exit 2}'` after 10 lines — `FILTER-RC: 2` must be classified `FILTER_FAILURE` (rank 9) and **not** suppressed by CAP-RC (here CAP-RC is 0, so the cap rule does not even apply); then with `seq` replaced by a producer that exits 5 after emitting beyond the cap — CAP-RC 3 with `PRODUCER-RC: 5` must still yield `PRODUCER_ERROR` evidence recorded alongside `TRUNCATED_BY_CAP` (rule 4 is primary; the non-SIGPIPE code is recorded as a secondary failure, not dropped).

**Test 13b — Candidate limit with short paths (INV-3):** fixture with 70 homes named `h01`…`h70` (no `.pm2`), plus fixture `/root`. Candidate list = `/root/.pm2` + 70 = 71. Per-candidate output ≈ 3 lines / ≈ 100 bytes, so 64 candidates ≈ 192 lines / ≈ 6.4 KB — **within** the 220-line / 12,288-byte cap. Assert: `INV-3-CANDIDATE-LIMIT: attempted=64 total=71` present; `INV-3-CHECKS: 64`; exactly 64 `INV-3-CHECK-RC` markers; `PRESENT + FAILED = 64`; `UNRESOLVED ≥ 1`; all four in-cap closing markers present; `CAP-RC: 0`; `GROUP-RC: 0`; `INV-3-END` present; execution class `EXEC_COMPLETE`; **`COVERAGE_INCOMPLETE`** with `CANDIDATE_LIMIT(64, 71)`.

**Test 13c — Output cap with long paths (INV-3):** fixture with 40 homes whose names are 200 characters. Each candidate ≈ 3 lines / ≈ 700 bytes → 40 candidates ≈ 28 KB, exceeding the 12,288-byte cap mid-loop. Deterministic assertions: `INV-3-CAP-TRUNCATED` present exactly once; `INV-3-CAP-RC: 3`; `INV-3-GROUP-RC` and `INV-3-END` present (outside cap); the in-cap closing markers (`CHECKS`, `PRESENT`, `FAILED`, `UNRESOLVED`) are **absent** and their absence is accepted — execution class `INCOMPLETE +TRUNCATED_BY_CAP` (rule 2 with cap evidence), **`COVERAGE_INCOMPLETE`** with `TRUNCATED_BY_CAP`. Scheduling-dependent assertion: `INV-3-GROUP-RC` ∈ {0, 141}. The test must **not** require `INV-3-CHECKS` or any marker that cap termination can prevent from being emitted.

**Test 13d — INV-4 sub-observation markers and interruption:** run §2.7 locally with `systemctl` substituted by a shim. (a) Normal: assert the exact marker sequence of the §2.4 "Normal" row; INV-4a and INV-4b each classified from their own markers; parent `EXEC_COMPLETE`. (b) Shim for the second call sleeps 60 s; supervisor deadline 10 s. Assert: `INV-4a-END` present; `INV-4b` opening present; `INV-4b-END`, `INV-4-END` absent; INV-4a classified normally; INV-4b `INCOMPLETE +TRUNCATED`; parent `INCOMPLETE +TRUNCATED`; INV-4 `COVERAGE_INCOMPLETE`. (c) Shim kills the script right after `INV-4a-END` (exit before `INV-4b`). Assert: INV-4b `NOT_EXECUTED`; parent `INCOMPLETE`; `COVERAGE_INCOMPLETE`.

**Test 14 — Reader timeout, shared drain deadline on the Stopwatch basis, ownership preserved:** stdout reader's file is a named pipe with no consumer so `Write` blocks forever; child exits normally. Assert: stdout join times out; recorded `remaining()` for the stderr and stdin joins is ≤ the remaining Stopwatch window (each strictly less than 5 s, and the sum of all three join waits ≤ 5 s + slack); Stopwatch elapsed at end of drain − Stopwatch elapsed at drain start ≤ 5.5 s (not 10–15 s); `PERSISTENCE_UNCONFIRMED`; main did not call `Close()` on the stdout file (instrumented flag / handle still open); inv-stdout.bin size reported `UNCONFIRMED`. Clock-independence: during the drain, the test advances the system clock by +60 s (or injects a fake `DateTime` provider); the drain duration measured by Stopwatch must be unaffected, and no `DateTime.UtcNow` call is made on the drain path (verified by an instrumented time provider that throws if called).

> **Amended 2026-09-28 (Step 3 run 3 — §15.2):** the clock-independence check is executed via the "instrumented `DateTime` provider that throws if called" alternative (armed wall-clock seam compiled with the unmodified source; zero calls during the shared drain deadline, the three joins and reconciliation; positive and negative controls) — U-2 resolved. The +60 s system-clock advance was not performed (system clock unchanged). The blocking-write stream stand-in for the named pipe is retained as a substitution.

**Test 15 — Exit status unknown and Kill failure paths (stub `IProcess`):** (a) `Kill()` succeeds but `HasExited` stays false. Assert: `killUnconfirmed`; `exitCode = UNKNOWN`; readers (stub streams stay open) time out → `PERSISTENCE_UNCONFIRMED` recorded with `killUnconfirmed`; no `-1` anywhere in the record. (b) `Kill()` throws `Win32Exception("Access is denied")`. Assert: `killFailed = true`, `killError` recorded verbatim; T2 `WaitForExit(5000)` still executed (stub call log); `HasExited` not inferred (stub reports false → `killUnconfirmed`); drain executed with the Stopwatch-based shared deadline; reconciliation executed; outcome `PERSISTENCE_UNCONFIRMED` if the stub streams stay open, `EXIT_STATUS_UNKNOWN` if the stub closes them; ownership of streams/files unchanged (no `Close()` by main). (c) `Kill()` throws `InvalidOperationException`; stub then reports `HasExited = true`, exit code 0. Assert: `killNote = ALREADY_EXITED_OR_NO_HANDLE`; exit code 0 recorded from `HasExited`/`ExitCode`, not from the exception; outcome follows the normal reconciliation rows (e.g., `TIME_LIMIT` if that was the trigger). (d) `Kill()` throws `InvalidOperationException` but stub keeps `HasExited = false`. Assert: no exit inferred; `killUnconfirmed`; `EXIT_STATUS_UNKNOWN` or `PERSISTENCE_UNCONFIRMED` per stream state.

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.1 / §14.4):** (b) `EXIT_STATUS_UNKNOWN` if the stub closes the streams and (d) `EXIT_STATUS_UNKNOWN` per stream state are now **deterministic** under the amended precedence; (c) retains `TIME_LIMIT` (exit reliably confirmed). **(e) added:** `WaitForExit()` throws (`Win32Exception` / `SystemException`) — assert `waitFailed`/`waitError` recorded verbatim, exit not inferred, shared 5 s Stopwatch drain and reconciliation executed, ownership unchanged, non-success record returned (e1 `EXIT_STATUS_UNKNOWN`; e2 `PERSISTENCE_UNCONFIRMED`; e3 `TIME_LIMIT` when `HasExited` is independently true).

**Test 16 — Unclassified SSH failure:** child exits 255 with stderr text matching none of the recognized host-key / auth / connection patterns. Assert: session class `SSH_FAILURE_UNCLASSIFIED` (§5.3); never `SESSION_EXEC_COMPLETE`; stderr preserved.

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.3):** the recognized pattern set and precedence are now recorded in §14.3; Test 16 is extended to (b) host-key, (c) authentication, (d) connection fixtures, (e) overlapping categories → highest-precedence category, (f) per-pattern matrix and remote-`stat` non-match, (g) exit ≠ 255 / non-NORMAL outcome never reach rows 9—12. `SSH_FAILURE_UNCLASSIFIED` preserved; no diagnostic establishes host-key provenance or authorizes a connection.

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

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.3):** the `recognized` host-key / authentication / connection patterns of rows 9—11 are the exact case-sensitive regex sets recorded in §14.3, evaluated only for exit 255 under `NORMAL` supervision, with fixed category precedence 9 → 10 → 11 → 12. A row 9—12 label never establishes §3.3 provenance or authorizes a connection.

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

> **Amended 2026-09-28 (Step 3 run 3 — §15.5):** the prerequisite "Local supervision verification passed" is **TICKED** by §15.5 (runs 2 + 3: all deterministic assertions hold, all scheduling-dependent values within their sets, 0 failed / 0 blocked / 0 unverified; retained fixture substitutions and platform limitations disclosed in §15.3, not waived). The first prerequisite (trusted host-key provenance, §3.3) remains **UNTICKED / BLOCKER**. The frozen check-box lines above are not rewritten.

> **Amended 2026-09-28 (Step 3 run 4 — §16.8):** the first prerequisite (trusted host-key provenance, §3.3) remains **UNTICKED / BLOCKER** after run 4 (AWS-side path BLOCKED — no existing authorized AWS authentication context; local `known_hosts` candidate documented but not independently bound to the instance). The second prerequisite stays TICKED per §15.5. The frozen check-box lines above are not rewritten.

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

---

## §13. Step 3 local preflight evidence — PARTIAL / LOCAL PREFLIGHT ONLY (appended 2026-09-28)

**Authorization:** Keith, 2026-09-28 — Step 3 **local preflight only** at baseline `f3ebe630f636ffae6082700dbba1b6094e681ab4`. This appendix records evidence only; §§0–12 above (the frozen Step 2 plan, SHA256 `E2FFCB86BFF4771614A013D56873F92E46FF070C977DBE03E525C006A58960A0` at `f3ebe630`) are unchanged. This is **not** inspection. No SSH, STAGING lease, AWS access, host inspection, vault/journal access, real PM2, transfer, application runtime, acquisition, host-specific P5 satisfaction, operational authorization, Step 4, subagents, or Git mutation occurred. **Trusted host-key provenance (§3.3) is NOT resolved by this authorization and remains a BLOCKER.** SSH and host inspection remain blocked pending that prerequisite and separate Keith authorization.

**Scope executed:** the §4.3 supervision mechanism implemented in local scratch outside the repository; §4.4 Tests 1–16 (incl. 5a/5b, 7 bytes+lines, 9a/9b, 11a–d, 12a/12b, 13a–13d, 14, 15a–15d, 16) executed against the actual supervision code, the frozen §2.7 script (extracted byte-for-byte from this document at `f3ebe630`; LF endings; SHA256 `F950CAE6872E9D2BB1A889EBC19AA84348B3CCB62957F3899271BF7F63917F87`) and a §5.1–§5.4 classifier, using synthetic child processes and Git-Bash fixtures with PATH shims; plus one supplementary nominal end-to-end run (T00, all shims nominal → `SESSION_EXEC_COMPLETE` / `SESSION_COVERAGE_FULL`).

### 13.1 Local tool verification (inspector host, unelevated session)

| Tool | Result |
|---|---|
| Windows PowerShell | 5.1.22621 / CLR 4.0.30319 (harness, classifier) |
| `csc.exe` | v4.0.30319 (C# 5) — compiled the supervisor DLL and synthetic child |
| Git for Windows bash | 5.2.15(1)-release, MSYS 3.4.7 — launched as `usr\bin\bash.exe -s` with PATH = `<fixture shims>;C:\Program Files\Git\usr\bin;<Windows PATH>` (the `bin\bash.exe` wrapper prepends `/usr/bin` ahead of shims and was therefore not used for fixture runs) |
| GNU Awk 5.0.0 | present; byte-length accounting under `LC_ALL=C` observed (Test 13c cap marker `lines=85 bytes=12380` against the 12,288-byte cap) |
| GNU coreutils 8.32 | `timeout` (`-k` confirmed: probe rc 124), `stat`, `seq`, `wc`, `grep`, `sed`, `sleep`, `ls` present |
| SIGPIPE propagation | confirmed: `PIPESTATUS` = `141 3` (2-stage) and `141 141 3` (3-stage) |
| `getent`, `pgrep`, `systemctl` | MISSING on Windows — replaced by PATH shims exactly as §4.4 prescribes for Tests 10/11/13 |
| `ps` | MSYS `ps` present but does not support `-o user=,pid=,lstart=` — shimmed for Tests 10/11/13 |
| WSL | only the stopped `docker-desktop` distro; unusable and Docker runtime not authorized — not used |

**Windows-only limitation (explicit blocker for one branch):** OS-level `Permission denied` from `stat` inside a mode-000 / ACL-denied directory is **not reproducible on this host** (probe with `icacls /deny` on the parent: `ls` and `cat` return `Permission denied`, MSYS `stat` succeeds). Test 10's `beta` INACCESSIBLE branch was therefore exercised through the `stat` PATH-shim emitting the GNU diagnostic (`stat: cannot statx '<path>': Permission denied`, exit 1). The classifier path is verified; the OS-level behaviour of `stat` under a 000-mode home remains **unverified locally** (verify on a Linux host at Step 3 pre-flight, or Keith accepts the shim evidence).

> **Amended 2026-09-28 (Step 3 run 3 — §15.1):** resolved — OS-level behaviour verified in a Linux container (real GNU `stat` 8.32, mode-000 parent, uid 1001): exit 1, path-matched `Permission denied`, INACCESSIBLE, coverage incomplete. Retained as the run-1 / run-2 record.

### 13.2 Artifacts (retained outside Git through review)

Root: `C:\Users\knlee\aisb-preflight\INVENTORY-01\`. Manifest `manifest-sha256.txt` (180 entries) SHA256 `DFB38550805C73521F774BDFEAF3E3B8F23524F6B074164706419ECCB2CE79A2`.

| Path (relative to root) | SHA256 | Role |
|---|---|---|
| `supervisor\Supervisor.cs` | `403E19DC725759817A7306210A1B5CE4BC097F44E9DCA5C482E46ED1D10FBB09` | §4.3 implementation: `IProc`, `RealProc`, `Reader` (§4.3.2), `Supervisor.Run` (§4.3.1/4.3.3/4.3.5), test doubles (`StubProc`, `GateStream`, `FaultingStream`, `BlockingWriteStream`) |
| `supervisor\AisbSupervisor.dll` | `0E41D44703CFCA0D1C5A4F35DBBC4DB18C8DB49146580CDE242D327EED6EA478` | compiled supervisor (the code intended for later use; loaded by the harness) |
| `supervisor\Child.cs` / `Child.exe` | `ED80CF00E5C1C278661FD23A7BCB398DF34950440CD3B91125BA42A11D57B474` / `29C664330681A8AA00991FDEDCD094FD6697DDAE3D804E03E2014EFA5E742A95` | synthetic child (Tests 1–9, 12, 14, 16) |
| `classifier\Classifier.ps1` | `778228838636D70506E2AA5425B782887B88BA4C245C0B5EE5DB4E48200B5B4E` | §5.1 (command / loop / INV-6), §5.2 INV-4, §5.3 session, §5.4 coverage |
| `tests\Run-Tests.ps1` | `4ADEC5D71FF57DA4F086F494337781A1B4A7F4DDC848090852CA697C808AB75F` | harness, fixtures, shims, assertions |
| `tests\Write-Manifest.ps1` | `ED6310C34B8DCEAD310D0CAA2143CE321C585B6D082D35B1E98FB5BC7DDE647A` | manifest generator |
| `script\inspection.sh` / `script\Extract-Script.ps1` | `F950CAE6872E9D2BB1A889EBC19AA84348B3CCB62957F3899271BF7F63917F87` / `74D3AC2573EE50E61D8A5B2662DC630272DAACED3B80DDC96D23F55F2E9D463A` | frozen §2.7 script (LF) and its extractor |
| `fixtures\T<n>\script-used.sh`, `fixtures\T<n>\shims\{getent,pgrep,ps,systemctl,stat}` | per manifest | test copies (prefix substitution / fault points recorded in 13.4) and shims |
| `evidence\<test>\inv-stdout.bin`, `inv-stderr.bin`, `record.json`, `classification.json` | per manifest | raw captures, §4.3.5 supervisor record, §5 classification per run |
| `evidence\results.json` / `results.md` / `results-detail.md` / `run-console.txt` / `toolcheck-output.txt` | `2A7098C6F5F1F70D207B88B0E5C8222D19053330B45C44499DEFDCC2344A4BBC` / `E93435FCCEAC9E888372941FBAB197CA4FBB6CAE34829C9D7202D3A114BE8879` / `85BA81735AD1333A818ABACE53418E28376C03681D5EEC7C96DB2F7A69F56DEB` / `EFFD16C21638364ACC56C76D66EA2FE9B6198CBCB85F920DEB6DD0E060FB1ECF` / `C25AC36CA2B44E810D738249EB458E13FB7D0C821E8B5BD49D3258627EADD6B8` | consolidated results, per-assertion detail, console log, tool check |

Any later execution must load `AisbSupervisor.dll` with the hash above (or a rebuild of `Supervisor.cs` with the hash above) and the §2.7 script with hash `F950CAE6…`.

### 13.3 Results (final consolidated run, 2026-09-28; wall clock per test in `results.md`)

Legend: **det** = deterministic assertion (must hold); **sched** = scheduling-dependent (must be within stated set); **conflict** = designed expectation that the frozen mechanism cannot satisfy (design finding, §13.5). Status `PASS` = all det+sched hold; `PASS-WITH-DESIGN-CONFLICT` = all det+sched hold, ≥1 conflict recorded; no test `FAIL`/`ERROR`.

| Test | Status | Key measured values |
|---|---|---|
| 1 Time limit from launch | PASS 3/3 | `TIME_LIMIT`; elapsed at trigger **10.272 s from launch** (child slept 3 s before reading stdin); 8 lines captured (sched set 6–8); total elapsed through reconciliation 10.289 s (recorded, no bound) |
| 2 Byte limit | PASS 4/4 | `BYTE_LIMIT`; `bytesReserved` = Σ persisted = on-disk = **4,096** |
| 3 Line limit, no trailing bytes | PASS 5/5 | `LINE_LIMIT`; 50 newlines; last byte 0x0A; file length 3,237 = `bytesPersisted` |
| 4 Partial evidence | PASS 3/3 | `TIME_LIMIT` at 10.25 s; 5 lines persisted; both files exist |
| 5a Stdin delivery | PASS 3/3 | 3 lines echoed; `stdinDelivered=true`; `NORMAL` |
| 5b Stdin stall (1 MB, child never reads) | PASS 3/3 | `stdinDeliveryFailed` at **10.233 s from launch**; `STDIN_FAILURE`; after Kill the blocked write raised IOException (pipe closed) → `stdinFailed=true`, writer join did not time out |
| 6 Stderr separation | PASS 3/3 | 5 `OUT-` lines only in inv-stdout.bin; 5 `ERR-` lines only in inv-stderr.bin; `NORMAL` |
| 7 Exact budget then silence | PASS 9/9 | bytes: `readCount=1`, `readCountAtExhaustion=1` (no Read after exhaustion), trigger 0.509 s, 4,096 persisted; lines: `LINE_LIMIT`, 50 newlines ending 0x0A, `readCount=1=atExhaustion`, trigger 0.507 s |
| 8 Exit concurrent with limit | PASS 3/3 | `BYTE_LIMIT` (not `NORMAL`); exit 0; `pollTrigger=BYTE_LIMIT` (sched set {BYTE_LIMIT, PROCESS_EXITED}) |
| 9a/9b Capture failure | PASS 6/6 | (a) stdout `writeFailed` (synthetic write fault #2) → `CAPTURE_FAILURE`, stderr file intact; (b) stderr `writeFailed` → `CAPTURE_FAILURE`, stdout intact |
| 10 Inaccessible / unknown candidates | PASS 9/9 | candidate list exactly `<fx>/root/.pm2, <fx>/home/alpha/.pm2, <fx>/home/beta/.pm2, <fx>/home/gamma/.pm2`; `CHECKS: 4`; CHECK-RC `1,0,1,124`; PRESENT 1 / FAILED 3 / UNRESOLVED 0; CAP-RC 0; INV-3 `EXEC_COMPLETE`; `COVERAGE_INCOMPLETE` = `INACCESSIBLE(beta)`, `TIMEOUT(gamma)`, nothing for `/root/.pm2` (declared ABSENT, path-matched `No such file or directory`); session `SESSION_EXEC_COMPLETE` with `SESSION_COVERAGE_INCOMPLETE` (execution/coverage separation observed). beta via shim — see 13.1 |
| 11a–d Sub-result accounting | PASS-WITH-DESIGN-CONFLICT 10/10 det, 0/1 conflict | (a) 3 RC markers, ATTEMPTED 3 / OK 0 / FAIL 3, `EXEC_COMPLETE`, `COVERAGE_INCOMPLETE` PS_FAIL×3; (b) 2 RC markers, closers absent (GROUP-RC 7) → `INCOMPLETE`; (c) `PID-LIMIT: attempted=200 total=250`, ATTEMPTED 200, exactly 200 RC markers, `PID_LIMIT(200, 250)` (ps failing; in-cap INV-6 ≈ 12,289 bytes); (d) one RC marker deleted → RC-count 2 ≠ ATTEMPTED 3 → `INCOMPLETE`. Supplementary (c, realistic 42-byte `ps` line): INV-6 output 20,628 bytes > 20,480 cap → `INCOMPLETE +TRUNCATED_BY_CAP` (D-2) |
| 12a/12b Limit / failure during drain | PASS 6/6 | (a) reader delayed 1.5 s before Reserve → `pollTrigger=PROCESS_EXITED`, reconciliation `BYTE_LIMIT`, exit 0; (b) stderr `Close()` throws → `closeFailed`, `CAPTURE_FAILURE`, trigger `PROCESS_EXITED` |
| 13a Per-observation cap (pipeline) | PASS 11/11 det, 2/2 sched | `INV-1-CAP-TRUNCATED` ×1; CAP-RC 3; next line after marker is `INV-1-PRODUCER-RC`; INV-1 `TRUNCATED_BY_CAP` / `COVERAGE_INCOMPLETE`; 3,392 capped bytes (500-line cap hit first); `bytesReserved` 6,752 < 131,072; INV-2…INV-6 END present; PRODUCER-RC 141, FILTER-RC 141 (sched set {0,141}, no `+UPSTREAM_FAILURE`). Neg (i): PRODUCER 0 / FILTER 2 / CAP 0 → `FILTER_FAILURE`. Neg (ii): PRODUCER 5 / CAP 3 → `TRUNCATED_BY_CAP` + `+UPSTREAM_FAILURE(producer, 5)` + note `PRODUCER_ERROR(5)` |
| 13b Candidate limit (short paths) | PASS 6/6 | `CANDIDATE-LIMIT: attempted=64 total=71`; CHECKS 64 = 64 RC markers; PRESENT 0 + FAILED 64; UNRESOLVED 1; CAP-RC 0; GROUP-RC 0; `EXEC_COMPLETE`; `COVERAGE_INCOMPLETE` with `CANDIDATE_LIMIT(64, 71)`; in-cap ≈ 7,805 bytes |
| 13c Output cap (long paths) | PASS 6/6 det, 1/1 sched | `INV-3-CAP-TRUNCATED: lines=85 bytes=12380` ×1; CAP-RC 3; GROUP-RC 141 (sched set {0,141}); END present; in-cap closers absent (accepted); `INCOMPLETE +TRUNCATED_BY_CAP`; `COVERAGE_INCOMPLETE` with `TRUNCATED_BY_CAP`; 28 candidates emitted before cap |
| 13d INV-4 markers / interruption | PASS 8/8 | (a) exact §2.4 Normal 12-marker sequence; 4a/4b/parent `EXEC_COMPLETE`; (b) deadline 10 s, `TIME_LIMIT` at 10.28 s, `INV-4a-END` + `INV-4b` opening present, `INV-4b-END`/`INV-4-END` absent, 4b `INCOMPLETE +TRUNCATED`, parent `INCOMPLETE +TRUNCATED`, coverage INCOMPLETE; (c) exit 9 after `INV-4a-END` → 4b `NOT_EXECUTED`, parent `INCOMPLETE`, session `SESSION_INCOMPLETE` |
| 14 Reader timeout / shared drain / ownership | PASS 8/8 | stdout join timed out (`remaining()` 5.000 s); stderr and stdin `remaining()` 0.000 s; sum of join waits 5.009 s; drain duration 5.009 s (Stopwatch); `PERSISTENCE_UNCONFIRMED`; blocking stream never closed by main; inv-stdout.bin size `UNCONFIRMED`; source scan: 0 wall-clock call sites in `Supervisor.cs` |
| 15a–d Kill / exit-status paths (stub) | PASS-WITH-DESIGN-CONFLICT 19/19 det, 0/2 conflict | (a) `killUnconfirmed`, exit `UNKNOWN`, `PERSISTENCE_UNCONFIRMED`, no `-1` in record, call log `Start,Kill,WaitForExit(5000)`; (b) `killFailed`, `killError="Win32Exception: Access is denied"`, `WaitForExit(5000)` executed, `killUnconfirmed`, drain window 5.000 s / drain 5.011 s, `PERSISTENCE_UNCONFIRMED`, no Close by main; (b2, stub closes streams) readers finished, killFailed+killUnconfirmed+exit UNKNOWN recorded, outcome **`TIME_LIMIT`** (designed: `EXIT_STATUS_UNKNOWN` → D-1); (c) `killNote=ALREADY_EXITED_OR_NO_HANDLE`, exit 0 from `HasExited`/`ExitCode`, `TIME_LIMIT`; (d) `killUnconfirmed`, exit `UNKNOWN`, killNote set, readers finished, outcome **`TIME_LIMIT`** (designed: `EXIT_STATUS_UNKNOWN` → D-1), no `-1` |
| 16 Unclassified SSH failure | PASS 4/4 | exit 255 with unrecognized stderr → `SSH_FAILURE_UNCLASSIFIED`; never `SESSION_EXEC_COMPLETE`; stderr preserved |
| T00 nominal (supplementary) | PASS 3/3 | all six observations `EXEC_COMPLETE`; `SESSION_EXEC_COMPLETE`; `SESSION_COVERAGE_FULL` (all failed candidates ABSENT; nvm glob resolved via parent ABSENT); 3,386 bytes / 81 lines reserved |

Totals: 21 test groups executed (Tests 1–16 with all sub-tests + T00); **19 PASS, 2 PASS-WITH-DESIGN-CONFLICT, 0 FAIL, 0 ERROR**; every frozen deterministic assertion holds except the two Test 15 sub-expectations recorded under D-1; every scheduling-dependent value is within its stated set. Full per-assertion listing: `evidence\results-detail.md`.

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.5):** `PASS-WITH-DESIGN-CONFLICT` is withdrawn; unmet frozen assertions are not PASS. Run-1 restated: Test 15 = BLOCKED-DESIGN-CONFLICT (15b2/15d), Tests 10 and 14 = PARTIAL-UNVERIFIED, Tests 11 and 13d = PASS-SUBSTITUTED, all others PASS. Run-2 results (corrected mechanism) in §14.5.

### 13.4 Fixture deviations and substitutions (recorded, not silent)

- **Prefix substitution (Tests 10, 11, 13, T00):** test copies of §2.7 replace `/home/` with `<fixture>/home/` and `/root/.pm2` with `<fixture>/root/.pm2` (permitted by the Test 10 text; `script-used.sh` retained per fixture). INV-5's `/usr/lib/node_modules/pm2` and `/usr/local/lib/node_modules/pm2` were checked as-is (absent under MSYS).
- **Test 10:** fixture `/root` declared searchable with no `.pm2` → ABSENT (rc 1, no coverage reason); `beta` INACCESSIBLE produced by the `stat` shim diagnostic (13.1 limitation); `gamma` via shim `exec sleep 30` → `timeout -k 1 5` → rc 124.
- **Test 11(b):** fault point `if [ "$inv6_attempted" -eq 2 ]; then exit 7; fi` inserted in the test copy after the per-PID RC echo (stand-in for "shim exits the group").
- **Test 11(c):** the frozen text does not specify `ps` output; executed with `ps` failing (all frozen assertions hold) and additionally with a realistic 42-byte `ps -o user=,pid=,lstart=` line (D-2).
- **Test 13a negative (i):** filter replaced by `awk '{print} NR==10{exit 2}'` with a 20-line producer so that the producer exits 0 before the filter exits (isolates `FILTER_FAILURE` from producer SIGPIPE).
- **Test 13c:** 60 homes with 120-character names, each with `.pm2` present (Windows MAX_PATH), instead of 40 × 200-character names; the cap is still exceeded mid-loop (candidate 29).
- **Test 13d(b) kill adapter:** the local child `bash.exe` spawns MSYS descendants that inherit the pipes and whose Windows parent links point at exec stubs, so `taskkill /T` cannot reach them (observed: `timeout`, `grep`, `awk`, `sleep` survived and held the pipe → `PERSISTENCE_UNCONFIRMED`). For fixture runs only, `RealProc` places bash in a Windows Job Object at `Start()` and `Kill()` terminates the job. The `Supervisor` class is unchanged; the production child `ssh.exe` has no descendants, and Tests 1–4, 5b, 7, 9 exercised plain `Process.Kill()` (pipes closed immediately; drain 0.00 s).
- **Test 13d(c):** `exit 9` inserted after the `INV-4a-END` echo (stand-in for "shim kills the script").
- **Test 12(a):** a test hook delays the stdout reader 1.5 s between Read and Reserve so `HasExited` is observed before reservation; the hook does not alter the algorithm's order or accounting.
- **Test 14:** a stream whose `Write` blocks forever stands in for the named pipe; the system-clock advance is replaced by a source scan (zero `DateTime` / `TickCount` call sites in `Supervisor.cs`; all durations are Stopwatch readings) because the clock cannot be changed from an unelevated session.
- **Exit code after local Kill:** Windows `TerminateProcess` yields a genuine exit code `-1` read from the killed child (Tests 1–4, 5b, 7, 9). This is a read integer, not a synthesized placeholder; stub Tests 15a/15d confirm `UNKNOWN` is used and `-1` never synthesized.
- **§7.1 owner-only ACL:** capture files were created with `FileMode.CreateNew` and an owner-only `FileSecurity` (protected DACL, current user FullControl).

### 13.5 Design findings — reported, NOT amended (Keith decision required)

- **D-1 — §4.3.3 reconciliation precedence vs. Test 15(b)/(d) and §4.3.3 Termination prose.** Row 5 `TIME_LIMIT` outranks row 6 `EXIT_STATUS_UNKNOWN`, and a Kill only ever follows a non-`PROCESS_EXITED` trigger, each of which maps to a higher-priority row (1 STDIN_FAILURE, 2 CAPTURE_FAILURE, 4 BYTE/LINE_LIMIT, 5 TIME_LIMIT). Consequently `killFailed` / `killUnconfirmed` can never surface as `EXIT_STATUS_UNKNOWN` when the readers finish; the outcome is the trigger's row (observed `TIME_LIMIT` in 15b2/15d) with `killFailed`/`killUnconfirmed`/`exitCode=UNKNOWN` preserved in the record fields. The mechanism follows the table as frozen; the Test 15 text ("`EXIT_STATUS_UNKNOWN` if the stub closes them") and the Termination prose ("if the readers do finish … `EXIT_STATUS_UNKNOWN` (rank 6)") disagree with it. Options: re-rank row 6 above row 5 (and decide against rows 4), or amend the test/prose to the table and rely on the recorded fields. Not resolved here.
- **D-2 — INV-6 byte cap (20,480) vs. the PID limit (200).** With 5-digit PIDs and a realistic 42-byte `ps -o user=,pid=,lstart=` line, 200 PIDs produce 27 + 42 + 33 ≈ 102 bytes each → 20,628 bytes including closers, exceeding the cap; the observation becomes `INCOMPLETE +TRUNCATED_BY_CAP` and the closing counters are lost before the PID limit can be reported. 7-digit PIDs truncate earlier. The design's own PID limit cannot complete within its own byte cap at realistic output widths. Not resolved here (e.g., raise the INV-6 cap or lower the PID limit; either is a Step 2 correction).
- **D-3 — §5.3 rows 9–11 "recognized" host-key / authentication / connection patterns are not enumerated in the frozen plan.** The preflight classifier uses an implementation-defined list (`Classifier.ps1`: e.g., `REMOTE HOST IDENTIFICATION HAS CHANGED`, `Host key verification failed`, `Permission denied (publickey`, `Connection timed out`, `Connection refused`, `Could not resolve hostname`, `kex_exchange_identification`). The pattern set must be frozen before real execution; Test 16 (catch-all) holds for any pattern set.
- **Resolution (2026-09-28, §14):** D-1 reconciled by the §14.1 amendment; D-2 resolved in §14.2 without changing limits; D-3 resolved in §14.3 by recording the pattern set and precedence; WaitForExit protection added in §14.4. The three findings above are retained as the run-1 record.

### 13.6 Step status after local preflight

- **Step 3 = PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE.**
- §10 execution prerequisites: trusted host-key provenance (§3.3) — **UNRESOLVED / BLOCKER** (not addressed by this authorization). Local supervision verification — **executed**; all frozen deterministic assertions hold except Test 15(b)/(d) `EXIT_STATUS_UNKNOWN` (D-1); scheduling-dependent values within sets; the §10 check-box remains **unticked** pending Keith's decisions on D-1, D-2, D-3 and the 13.1 OS-level `stat` limitation.
- §10 pre-flight "configured with production params": the supervisor's defaults are the production parameters (131,072 bytes, 3,000 lines, 180 s from launch, 10 s stdin, 5 s kill wait, 5 s shared drain); fixture runs used the production byte/line budgets and a 170 s deadline (10 s in Tests 1, 4, 13d(b); reduced budgets in Tests 2, 3, 7, 8, 12a as designed).
- **Activity ledger (Step 3 local preflight):** SSH=0, STAGING acquired=0, AWS=0, host inspection=0, vault/journal access=0, PM2=0, transfer=0, application/runtime infrastructure (Docker/Postgres/Redis/services)=0, acquisition=0, host-specific P5 claims=0, Step 4=0, subagents=0, Git commit/push=0, predecessor bodies edited=0; local synthetic child processes and Git-Bash fixture runs=YES; supervision verification executed=YES (local); synthetic test groups executed=21; frozen §§0–12 edited=0 (appendix only).

> **Amended 2026-09-28 (Step 3 local-preflight correction #1 —  §14.7):** superseded by §14.7 after correction #1 (run 2: 0 failed, 0 blocked, 2 unverified requirements U-1/U-2; §10 local-verification prerequisite remains unticked; Step 3 remains PARTIAL / LOCAL PREFLIGHT ONLY).

---

## §14. Step 3 local-preflight correction #1 — design reconciliation and corrected acceptance (2026-09-28)

**Authorization:** Keith, 2026-09-28 — localized Step 3 local-preflight correction at baseline `f3ebe630f636ffae6082700dbba1b6094e681ab4`. This correction **includes** the specific design reconciliation below (D-1, D-2, D-3, WaitForExit protection, acceptance reporting). It does **not** authorize inspection. Step 3 remains **PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE**. Trusted host-key provenance (§3.3) remains unresolved. No SSH, STAGING lease, AWS access, host inspection, vault/journal access, real PM2, Docker, application runtime, transfer, acquisition, operational authorization, Step 4, subagents, or Git mutation occurred.

**How the frozen text is preserved.** The Step 2 freeze (§§0–12 at `f3ebe630`, SHA256 `E2FFCB86BFF4771614A013D56873F92E46FF070C977DBE03E525C006A58960A0`) and the run-1 evidence appendix (§13) are retained verbatim as historical evidence. This correction (a) appends this §14, and (b) inserts **dated pointer lines only** at the affected locations — the header correction list, §4.3.3 (Termination prose; reconciliation table), §4.3.5, §4.4 Tests 11 / 15 / 16, §5.3, §13.3, §13.5, §13.6 — each beginning `**Step 3 local-preflight correction #1:**` or `> **Amended 2026-09-28 (Step 3 local-preflight correction #1 …)**` or `- **Resolution (2026-09-28, §14)**`. No frozen sentence was altered or removed. Verification recorded in 14.6: removing every inserted pointer line (and its preceding blank line) reproduces the pre-correction working-tree file byte-for-byte, whose first 87,316 bytes equal the committed `E2FFCB86…` freeze. Where §14 and an earlier section disagree, **§14 supersedes**; the earlier text remains as the record of what was frozen.

### 14.1 D-1 — amended terminal-outcome precedence (supersedes the §4.3.3 reconciliation table order and the §4.3.3 Termination prose "rank 6")

Final reconciliation (after drain, main thread; re-read every flag as it stands now) computes `supervisorOutcome` as the **first** match:

| Pri | `supervisorOutcome` | Condition (unchanged from the frozen table; only the order changes) |
|---|---|---|
| 1 | `STDIN_FAILURE` | `stdinFailed` or `stdinDeliveryFailed` |
| 2 | `CAPTURE_FAILURE` | any reader (stdout **or** stderr) has `readFailed`, `writeFailed`, `flushFailed`, or `closeFailed` |
| 3 | `PERSISTENCE_UNCONFIRMED` | any of `stdoutReaderTimeout`, `stderrReaderTimeout`, `stdinWriterTimeout`, or a reader with `readerFinished == false` |
| 4 | `EXIT_STATUS_UNKNOWN` | `killFailed`, `killUnconfirmed`, `HasExited == false`, or `exitCode == UNKNOWN` |
| 5 | `BYTE_LIMIT` / `LINE_LIMIT` | `limitExhausted` (regardless of whether it was set before or after process exit) |
| 6 | `TIME_LIMIT` | elapsed exceeded the deadline before exit was observed |
| 7 | `NORMAL` | none of the above; process exited; integer exit code available; both readers finished; `Σ bytesPersisted == bytesReserved` and `Σ linesPersisted == linesReserved` (else `CAPTURE_FAILURE` with note `ACCOUNTING_MISMATCH`) |

Rules carried with the amendment:
- **Unknown or unconfirmed termination outranks byte/line/time limits.** A session whose process state cannot be confirmed is never reported as a mere limit or timeout.
- `pollTrigger`, `limitExhausted` / `limitReason`, `bytesReserved` / `linesReserved`, and the kill / wait / exit evidence (`killAttempted`, `killFailed`, `killError`, `killNote`, `killUnconfirmed`, `waitFailed`, `waitError`, `exitCode`, `HasExited` at reconcile) are **recorded independently** of the outcome chosen; the outcome never erases them.
- **A Kill exception never establishes process exit.** Only `HasExited` (read in T2/T3 and again at reconciliation) establishes exit; `ExitCode` is read only when `HasExited` is true.
- Test 15(c) — Kill throws `InvalidOperationException`, the process is then reliably confirmed exited with an integer exit code, and no higher-priority condition applies — **retains `TIME_LIMIT`** (row 6) because row 4 does not fire.
- §4.3.3 Termination prose is read with "rank 4" in place of "rank 6": if the readers finish but exit remains unconfirmed, the outcome is `EXIT_STATUS_UNKNOWN`; if the readers time out, `PERSISTENCE_UNCONFIRMED` (rank 3) still wins.
- §5.3 is unaffected: row 8 `EXIT_STATUS_UNKNOWN` continues to map `supervisorOutcome = EXIT_STATUS_UNKNOWN`; rows 3–8 still override marker-based rows.

Test 15(b) "`EXIT_STATUS_UNKNOWN` if the stub closes them" and Test 15(d) "`EXIT_STATUS_UNKNOWN` … per stream state" are now **deterministic** assertions consistent with the table (verified: 15b2 and 15d → `EXIT_STATUS_UNKNOWN` with `pollTrigger = TIME_LIMIT`, `killFailed` / `killUnconfirmed` and `exitCode = UNKNOWN` recorded).

### 14.2 D-2 — INV-6 byte cap and PID limit are independent bounds (limits unchanged)

The INV-6 per-observation cap (**20,480 bytes / 640 lines**, §2.0) and the **200-PID** limit (§2.6) are both retained exactly as frozen. Their interaction is expected behaviour, not an unresolved cap defect: whichever bound is reached first terminates the observation with its own evidence, and the classifier reports it as such. Test 11(c) is amended to keep **two separate fixtures**:

- **11(c1) — PID limit reached with sufficiently short output:** `pgrep` shim returns 250 PIDs; per-PID output is short (fixture: `ps` fails, its diagnostic goes to stderr; ≈ 60 bytes per PID on stdout). Assert (deterministic): `INV-6-PID-LIMIT: attempted=200 total=250`; `PS-ATTEMPTED = 200` (not 201); exactly 200 `-RC` markers; `CAP-RC: 0`; in-cap INV-6 bytes < 20,480; `COVERAGE_INCOMPLETE` with `PID_LIMIT(200, 250)`. (Verified: 12,289 in-cap bytes; `EXEC_COMPLETE`.)
- **11(c2) — byte cap reached first with realistic output:** `pgrep` shim returns 250 PIDs; `ps` shim emits a realistic 42-byte `ps -o user=,pid=,lstart=` line per PID. Assert (deterministic): `INV-6-CAP-TRUNCATED` present exactly once; `INV-6-CAP-RC: 3`; execution class **`INCOMPLETE +TRUNCATED_BY_CAP`**; **`COVERAGE_INCOMPLETE`** with `TRUNCATED_BY_CAP`; at least one in-cap closing marker is prevented by the cap; `-RC` markers ≤ 200; no marker that the cap can prevent is required. Scheduling-dependent: `INV-6-GROUP-RC` ∈ {0, 141}. (Verified: cap marker `lines=603 bytes=20505`; 200 `-RC` markers and the `PID-LIMIT` marker were emitted before the cap; closers `TOTAL-PIDS`, `PS-ATTEMPTED`, `PS-OK`, `PS-FAIL` prevented; `GROUP-RC 0`; INV-6 text 20,628 bytes.)

The run-1 supplementary requirement "INV-6 accounting survives 200 realistic PIDs within the 20,480-byte cap" is **removed**; it was never a frozen assertion and it contradicted the frozen bounds. The §13.5 D-2 wording "the design's own PID limit cannot complete within its own byte cap" is superseded by this section.

### 14.3 D-3 — §5.3 rows 9–12 pattern set and precedence (recorded)

**Evaluation rules.** Rows 9–12 are evaluated only when `supervisorOutcome = NORMAL` and the SSH exit code is **255** (rows 3–8 override; any other exit code falls to rows 13–15). Each pattern is a **case-sensitive .NET regular expression** matched anywhere in the raw `inv-stderr.bin` text (line order irrelevant). **Category precedence is fixed:** `HOST_KEY_MISMATCH` (row 9) → `AUTHENTICATION_FAILURE` (row 10) → `CONNECTION_FAILURE` (row 11) → `SSH_FAILURE_UNCLASSIFIED` (row 12). The first category with **any** matching pattern wins; a stderr matching several categories is labelled by the highest-precedence category, and the patterns that matched in every category are recorded as evidence. `SSH_FAILURE_UNCLASSIFIED` is preserved as the catch-all for exit 255 with no match (including empty stderr). Because `inv-stderr.bin` also carries remote-side stderr, the authentication patterns are restricted to OpenSSH client phrasing (parenthesised method list); a remote `stat: … Permission denied` diagnostic does **not** match any category (verified).

| Row | Category | Patterns (regex, case-sensitive) |
|---|---|---|
| 9 | `HOST_KEY_MISMATCH` (security-relevant) | `REMOTE HOST IDENTIFICATION HAS CHANGED` · `Host key verification failed` · `No \S+ host key is known for` · `POSSIBLE DNS SPOOFING` · `Offending \S+ key in` · `Host key for \S+ has changed` |
| 10 | `AUTHENTICATION_FAILURE` | `Permission denied \((publickey\|password\|keyboard-interactive\|gssapi-with-mic\|gssapi-keyex\|hostbased)[^)]*\)` · `Permission denied, please try again` · `Too many authentication failures` · `Authentication failed` · `no mutual signature algorithm` · `sign_and_send_pubkey: signing failed` |
| 11 | `CONNECTION_FAILURE` | `Connection timed out` · `Connection refused` · `Could not resolve hostname` · `No route to host` · `Network is unreachable` · `Connection closed by` · `Connection reset by` · `kex_exchange_identification` · `Timeout, server \S+ not responding` · `client_loop: send disconnect` · `Broken pipe` |
| 12 | `SSH_FAILURE_UNCLASSIFIED` | no pattern above matched (catch-all for exit 255) |

**Non-authority of labels.** A row 9–12 label is a classification of captured diagnostics only. **No diagnostic — matched or unmatched — establishes trusted host-key provenance (§3.3), authorizes a connection, or satisfies any §10 prerequisite.** `HOST_KEY_MISMATCH` in particular is a stop signal, never a basis for updating `known_hosts`.

**Test 16 is amended** to: (a) unmatched text → `SSH_FAILURE_UNCLASSIFIED` (frozen); (b) host-key fixture → `HOST_KEY_MISMATCH`; (c) authentication fixture → `AUTHENTICATION_FAILURE`; (d) connection fixture → `CONNECTION_FAILURE` — (b)–(d) run as real child processes (exit 255) through the supervisor; (e) overlapping categories in either line order → highest-precedence category (host-key+auth, auth+conn, host-key+conn, all three); (f) per-pattern matrix: each of the 23 recorded patterns alone maps to its own category; remote `stat … Permission denied` alone and empty stderr → `SSH_FAILURE_UNCLASSIFIED`; (g) recognized text with exit ≠ 255 → row 13/14, and with a non-NORMAL `supervisorOutcome` → rows 3–8 (never rows 9–12); no diagnostic class is a success class. All verified (17/17 deterministic).

### 14.4 WaitForExit failure handling (supersedes §4.3.3 T2 wording; extends §4.3.5)

T2 becomes: `try { process.WaitForExit(5000); } catch (Exception ex) { waitFailed = true; waitError = "<Type>: <Message>"; }` — executed regardless of T1 outcome. A `WaitForExit` exception (documented: `Win32Exception`, `SystemException` / `InvalidOperationException`) is **recorded and never used to infer exit**; T3 then reads `HasExited` exactly as before (`false` → `killUnconfirmed = true`). Drain (single 5 s Stopwatch deadline) and final reconciliation **always** follow. If exit remains unconfirmed the amended row 4 (`EXIT_STATUS_UNKNOWN`) applies, subject to rows 1–3. If `HasExited` is nevertheless true and `ExitCode` readable, exit is confirmed by those reads (not by the wait) and the outcome follows the remaining rows. §4.3.5 gains two fields: `waitFailed` (bool) and `waitError` (exception type and message, verbatim).

**Test 15(e) added (stub `IProcess`; `WaitForExit` throws):** (e1) `Win32Exception("The handle is invalid")`, `HasExited` stays false, stub closes streams at Kill. Assert: `WaitForExit(5000)` in the call log; `waitFailed = true`, `waitError` verbatim; `killUnconfirmed`; `exitCode = UNKNOWN`; drain window 5.000 s on the shared Stopwatch deadline and reconciliation executed; readers finished; outcome `EXIT_STATUS_UNKNOWN` (non-success record returned); no `Close()` by main on the stub streams; no `-1`. (e2) `SystemException`, streams stay open. Assert: `waitFailed` recorded; readers time out on the shared deadline (drain ≤ 5.5 s) → `PERSISTENCE_UNCONFIRMED` (higher-priority failure wins); ownership unchanged. (e3) `Win32Exception` but `HasExited` became true before the throw with exit code 0. Assert: `waitFailed` recorded; exit confirmed via `HasExited`/`ExitCode`, not via the wait; outcome `TIME_LIMIT`. All verified (e1 drain 0.000 s since readers had finished, window 5.000 s; e2 drain 5.010 s).

### 14.5 Corrected acceptance reporting (supersedes §13.3 status vocabulary and totals)

**Categories.** Every recorded item is exactly one of:
1. **Executed and passed** — a frozen deterministic or scheduling-dependent assertion evaluated against the real mechanism and satisfied (`det` / `sched`).
2. **Blocked by a design conflict** — a frozen assertion that cannot be evaluated as frozen because the design contradicts itself (`blocked`). **Never counted as PASS.**
3. **Substituted evidence** — an assertion discharged by a mechanism that differs from the frozen text (`subst`); it is listed explicitly and does not verify the frozen mechanism itself.
4. **Unverified requirement** — a frozen requirement not executed here (`unverified`). **Never counted as PASS; no substitute counts as verification.**

Test status: `FAIL` if any executed/substituted assertion fails; else `BLOCKED-DESIGN-CONFLICT` if any blocked item; else `PARTIAL-UNVERIFIED` if any unverified requirement; else `PASS-SUBSTITUTED` if any substituted item; else `PASS`. The run-1 label `PASS-WITH-DESIGN-CONFLICT` is withdrawn.

**Run-1 (§13.3) restated under these categories:** Test 15 — **BLOCKED-DESIGN-CONFLICT** (2 frozen assertions, 15(b2)/(d) `EXIT_STATUS_UNKNOWN`, blocked by D-1; 19 executed and passed). Test 11 — the failed item was a supplementary, non-frozen requirement (removed in 14.2); frozen 11(a)–(d) assertions executed and passed; 11(b) discharged by substituted evidence (fault point) → **PASS-SUBSTITUTED**. Test 10 — **PARTIAL-UNVERIFIED** (OS-level permission behaviour unverified; beta branch substituted by the `stat` shim). Test 14 — **PARTIAL-UNVERIFIED** (clock-change/injection check not executed; blocking stream and source scan are substitutes). Test 13d — **PASS-SUBSTITUTED** (Job-Object kill adapter; fault point). All other run-1 tests — PASS. Run-1 corrected totals: **16 PASS** + 2 PASS-SUBSTITUTED + 2 PARTIAL-UNVERIFIED + 1 BLOCKED-DESIGN-CONFLICT (Test 15) = 21 groups, 0 FAIL (documentation-only reconciliation 2026-09-28: subtotal corrected from 15 to 16 PASS; the 21 groups are Tests 1, 2, 3, 4, 5a, 5b, 6, 7, 8, 9, 10, 11, 12, 13a, 13b, 13c, 13d, 14, 15, 16 and T00); the run-1 headline "19 PASS, 2 PASS-WITH-DESIGN-CONFLICT" is superseded.

**Run 2 — focused affected tests (T15, T16; T10, T11, T14) then one consolidated regression run (all 21 groups) against the corrected supervisor/classifier, 2026-09-28:**

| Test | Status | Executed pass/total | Substituted | Blocked | Unverified | Key values |
|---|---|---|---|---|---|---|
| 1–9 (incl. 5a/5b, 7 bytes+lines, 9a/9b) | PASS | 39/39 | 0 | 0 | 0 | unchanged behaviour under the amended precedence: T01 `TIME_LIMIT` 10.27 s; T02/T03/T07 limits exact; T05b `STDIN_FAILURE` 10.23 s; T08 `BYTE_LIMIT` with exit 0; T09 `CAPTURE_FAILURE` both sides |
| 10 | **PARTIAL-UNVERIFIED** | 6/6 | 4/4 | 0 | **1** | frozen candidate list/CHECKS/CAP/EXEC_COMPLETE/root-ABSENT/gamma-TIMEOUT executed; beta rc 1 + `Permission denied` + `INACCESSIBLE` coverage reason **substituted** (stat shim); **unverified:** OS-level `stat` on a mode-000 home |
| 11 | PASS-SUBSTITUTED | 15/15 | 1/1 | 0 | 0 | (a) 3/3/0/3; (b) fault point → `INCOMPLETE` (subst); (c1) PID limit 200/250, CAP-RC 0, 12,289 B; (c2) cap `lines=603 bytes=20505` → `INCOMPLETE +TRUNCATED_BY_CAP`, coverage `TRUNCATED_BY_CAP`; (d) deleted RC marker → `INCOMPLETE` |
| 12 | PASS | 6/6 | 0 | 0 | 0 | (a) `BYTE_LIMIT` after `PROCESS_EXITED`; (b) `closeFailed` → `CAPTURE_FAILURE` |
| 13a / 13b / 13c | PASS | 13/13, 6/6, 7/7 | 0 | 0 | 0 | as run 1 (CAP-RC 3 ×1; PRODUCER/FILTER 141; candidate limit 64/71; cap `lines=85 bytes=12380`; GROUP-RC 141) |
| 13d | PASS-SUBSTITUTED | 6/6 | 2/2 | 0 | 0 | (a) exact 12-marker sequence; (b) `TIME_LIMIT` 10.22 s via Job-Object kill adapter (subst); (c) fault point exit 9 → 4b `NOT_EXECUTED` (subst) |
| 14 | **PARTIAL-UNVERIFIED** | 6/6 | 2/2 | 0 | **1** | drain 5.00 s on the shared deadline; `PERSISTENCE_UNCONFIRMED`; no Close by main; size `UNCONFIRMED`; **substituted:** blocking stream (for named pipe), source scan (0 wall-clock call sites); **unverified:** +60 s clock advance / throwing time-provider injection |
| 15 (a, b, b2, c, d, e1, e2, e3) | PASS | 32/32 | 0 | 0 | 0 | (a) `PERSISTENCE_UNCONFIRMED`; (b) `killError="Win32Exception: Access is denied"`, `WaitForExit(5000)` executed, drain 5.011 s; **(b2) `EXIT_STATUS_UNKNOWN`** (trigger `TIME_LIMIT`, kill evidence preserved); (c) exit 0 confirmed → **`TIME_LIMIT` retained**; **(d) `EXIT_STATUS_UNKNOWN`**; (e1) `waitError="Win32Exception: The handle is invalid"`, `killUnconfirmed`, window 5.000 s, `EXIT_STATUS_UNKNOWN`, no Close by main; (e2) `SystemException` recorded, `PERSISTENCE_UNCONFIRMED`, drain 5.010 s; (e3) `waitFailed` + exit 0 → `TIME_LIMIT`; no `-1` anywhere |
| 16 (a–g) | PASS | 17/17 | 0 | 0 | 0 | (a) `SSH_FAILURE_UNCLASSIFIED`; (b) `HOST_KEY_MISMATCH`; (c) `AUTHENTICATION_FAILURE`; (d) `CONNECTION_FAILURE`; (e) overlaps → precedence; (f) 23-pattern matrix; remote stat diagnostic → unclassified; (g) exit 1 → `SESSION_MALFORMED`, `TIME_LIMIT` → `SESSION_TIMEOUT` |
| T00 nominal (supplementary) | PASS | 3/3 | 0 | 0 | 0 | `SESSION_EXEC_COMPLETE` / `SESSION_COVERAGE_FULL` |

**Run-2 totals:** executed and passed **159**; executed and failed **0**; substituted evidence (passed) **9**; blocked by design conflict **0**; unverified requirements **2**. Tests: **17 PASS, 2 PASS-SUBSTITUTED, 2 PARTIAL-UNVERIFIED, 0 BLOCKED-DESIGN-CONFLICT, 0 FAIL, 0 ERROR.** Full per-assertion listing: `evidence\results-detail.md`.

**Substituted evidence (explicit list):** Test 10 beta — `stat` PATH-shim diagnostic in place of a mode-000 home (4 assertions); Test 11(b) — inserted `exit 7` fault point in place of "shim exits the group"; Test 13d(b) — Windows Job-Object kill for the bash fixture in place of plain `Process.Kill` (production `ssh.exe` path exercised by Tests 1–4, 5b, 7, 9); Test 13d(c) — inserted `exit 9` in place of "shim kills the script"; Test 14 — blocking-write stream in place of a named pipe; source scan in place of the clock-change/injection check. Also recorded (not counted as substitutions): prefix substitution for `/home` and `/root`; Test 13a neg (i) filter form; Test 13c 60 × 120-character homes; Test 12(a) reader hook; real `-1` exit codes after local `TerminateProcess`.

**Unverified requirements (explicit list; no waiver granted):** (U-1) Test 10 — OS-level `Permission denied` from `stat` inside a mode-000 / ACL-denied home: **the permission-diagnostic shim does not verify OS permission behaviour**; not reproducible on this Windows/MSYS host; requires a Linux host. (U-2) Test 14 — the frozen clock-independence check (+60 s system-clock advance during drain, or an instrumented `DateTime` provider that throws if called): **the source scan does not execute it**; the clock cannot be changed from an unelevated session and the supervisor has no injectable time provider.

**Consequence for §10:** the execution prerequisite "Local supervision verification passed" remains **unticked** while U-1 and U-2 are unverified. This correction grants no waiver of those requirements.

> **Amended 2026-09-28 (Step 3 run 3 — §15.3 / §15.5):** U-1 and U-2 are resolved by executed evidence (run 3); the unverified list is now empty and the §10 local-verification prerequisite is ticked in §15.5. The two paragraphs above are retained as the run-2 record.

### 14.6 Artifacts and hashes (run 2; run 1 preserved separately)

Root `C:\Users\knlee\aisb-preflight\INVENTORY-01\`. Run-1 evidence, fixtures, manifest and sources are preserved unchanged under `runs\run1-2026-09-28\` (`manifest-sha256.txt` SHA256 `DFB38550805C73521F774BDFEAF3E3B8F23524F6B074164706419ECCB2CE79A2`; `src\Supervisor.cs` `403E19DC…`, `src\Classifier.ps1` `77822883…`, `src\Run-Tests.ps1` `4ADEC5D7…`). Run-2 manifest `manifest-sha256.txt` (388 entries, includes the run-1 snapshot) SHA256 `164048E8A601CC20B40ACDF0B99A4210A3728E5BDAF0CEF364E2307F23E8084A`.

| Path (relative to root) | SHA256 (run 2) | Change |
|---|---|---|
| `supervisor\Supervisor.cs` | `D50DCB7137769CF73CDBC698EE5D9C909D30FE4106C86FB7F8D5D89BC4FAE0DF` | §14.1 precedence; §14.4 T2 try/catch + `WaitFailed`/`WaitError`; `StubProc.WaitBehavior`/`WaitSetsExited` (test double only) |
| `supervisor\AisbSupervisor.dll` | `E5AF106E4299D7C76F9B2DA1811A1AD9FCFD3749D0CE4F33516308D87CE2F5CC` | rebuilt (csc 4.0.30319) |
| `supervisor\Child.cs` / `Child.exe` | `526DD65E6288DC87244C1E601DA993A7A40CD05F9E50D5F5C217970F6613C3DF` / `8F40357C50B7ACF66703697A0C27F37F0BAC9CBECB78DB5224BCD800F2A2BAB9` | added `exit-with-stderr-lines` mode (Test 16b–d) |
| `classifier\Classifier.ps1` | `D417D10E3A76B98F1A16814F8FD68DA8D81B9E6969715BDF6DC1C591C0EBA1C5` | §14.3 pattern set, precedence, `Classify-SshDiagnostic` |
| `tests\Run-Tests.ps1` | `7872A55E57A31A6AA3EDF8CD8B556D4458E992B2A73DF120C0CA894FECCE8606` | §14.5 categories; Tests 11(c1)/(c2), 15(b2)/(d)/(e1–e3), 16(b–g); substituted/unverified marking |
| `script\inspection.sh` | `F950CAE6872E9D2BB1A889EBC19AA84348B3CCB62957F3899271BF7F63917F87` | unchanged (frozen §2.7) |
| `evidence\results.json` / `results.md` / `results-detail.md` / `run-console.txt` | `3FAC1C1DFBA52225B863083CC21A9A11C912557DE172F72EB09DABEC2D74615C` / `72EEDA1A59069764F77661CF21961DEFEC68D3B0C6AA2B2648BB1CC3F3997EF4` / `46B25FF78121861F776E2519C6C69DB483F44B99DAB27A987EDB1983AD4A90A9` / `720CAD230276E893EB730DAA8DA83FD95FAE95AE9DABCC977BA61B736B94E7BF` | consolidated run 2 |
| `evidence\focused-T15-T16-console.txt` / `focused-T10-T11-T14-console.txt` / `focused-T11-rerun-console.txt` | `67D39AFE4B32BD898E18DD56748A28EEF62720E021C860A50A466396D458AB3E` / `34B1AFC1AAA7A4F1785807ABD6F70A01E303E5D102A4CD139AFA057C17AD6763` / `338845F736D026E1A2AEB712CC8FE8F0CD176486DAFD7D23FE1CA11648F37E55` | focused runs (the T11 first focused run recorded one harness prediction error in (c2) — "RC markers < 200 / PID-LIMIT absent" — corrected to the factual assertion in 14.2 before the rerun; no mechanism change) |
| `evidence\<test>\…`, `fixtures\T*\…` | per manifest | run-2 captures, records, classifications, script copies, shims |

Any later execution must load `AisbSupervisor.dll` with hash `E5AF106E…` (or a rebuild of `Supervisor.cs` `D50DCB71…`), `Classifier.ps1` `D417D10E…`, and the §2.7 script `F950CAE6…`.

**Pointer-insertion verification:** the pre-correction working-tree stage-start (SHA256 `EFB795B78BC4311E782205E1983C546CAA34BE1E2542241694871D303A63AE26`, §§0–13) was reproduced byte-for-byte by removing the inserted pointer lines from the corrected file; its first 87,316 bytes equal the committed freeze `E2FFCB86…` at `f3ebe630`.

### 14.7 Step status after correction #1

- **Step 3 = PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE.**
- §10 execution prerequisites: trusted host-key provenance (§3.3) — **UNRESOLVED / BLOCKER**. Local supervision verification — executed under the amended design; **0 failed, 0 blocked**; **remains unticked** because U-1 and U-2 are unverified (no waiver).
- Design findings: D-1 **reconciled by amendment** (14.1); D-2 **resolved without changing limits** (14.2); D-3 **resolved by recording the pattern set** (14.3); WaitForExit protection **added** (14.4). No further open design finding from the local preflight.
- **Activity ledger (correction #1):** SSH=0, STAGING acquired=0, AWS=0, host inspection=0, vault/journal access=0, PM2=0, Docker=0, transfer=0, application/runtime infrastructure=0, acquisition=0, host-specific P5 claims=0, operational authorization=0, Step 4=0, subagents=0, Git commit/push=0, predecessor bodies edited=0; frozen §§0–12 sentences altered=0 (dated pointer lines inserted only); local synthetic child processes and Git-Bash fixture runs=YES; focused runs=3 (T15+T16; T10+T11+T14; T11 rerun); consolidated regression run=1 (21 groups); run-1 evidence preserved=YES.

> **Amended 2026-09-28 (Step 3 run 3 — §15.5):** superseded by §15.5 after run 3 (U-1 / U-2 resolved by executed evidence; §10 local-verification prerequisite ticked; trusted host-key provenance still UNRESOLVED / BLOCKER; Step 3 remains PARTIAL / LOCAL PREFLIGHT ONLY).

---

## §15. Step 3 local preflight run 3 — U-1 / U-2 resolution (2026-09-28)

**Authorization:** Keith, 2026-09-28 — continued Step 3 **local preflight only** at baseline `e33ad5024a232fede0796c3f8dd02ca86d5ea8eb` (HEAD; working tree clean at window open), limited to resolving U-1 and U-2. Local Docker use was authorized **solely** for the U-1 verification. This appendix records evidence only; §§0–12 (frozen plan), §13 (run 1), §14 (correction #1, run 2) and their hashes are unchanged and remain historical text. This is **not** inspection. No SSH or SSH preflight, STAGING lease, AWS access, host inspection, vault/journal access, real PM2, application runtime, transfer, acquisition, host-specific P5 satisfaction, operational authorization, Step 4, subagents, or Git mutation occurred. **Trusted host-key provenance (§3.3) remains UNRESOLVED / BLOCKER.** Step 3 remains **PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE.**

**Shared code unchanged:** run 3 loads the run-2 artifacts as-is — `supervisor\AisbSupervisor.dll` `E5AF106E…`, `Supervisor.cs` `D50DCB71…`, `classifier\Classifier.ps1` `D417D10E…`, `tests\Run-Tests.ps1` `7872A55E…`, frozen §2.7 script `F950CAE6…`. Because no supervisor or classifier code changed, no rerun of the existing 21 groups was required; the run-2 results (§14.5) stand. New harness work and evidence live in the separate run directory `runs\run3-2026-09-28-U1U2\` (15.4); run 1 (`runs\run1-2026-09-28\`, manifest `DFB38550…`) and the run-2 manifest (`164048E8…`) are preserved unchanged.

### 15.1 U-1 — actual OS permission behaviour of `stat` under a traversal-denied parent (Test 10 beta branch)

**Method.** A disposable local Linux container (`ubuntu:22.04`, image Id `sha256:b8b6ee6aa931ecd9d0d952abc34dc0e5f7c6a30c6bb71b079fe399fde0329c02`, RepoDigest `ubuntu@sha256:b8b6ee6a…`, created 2026-09-03; Ubuntu 22.04.5 LTS, bash 5.1.16, **GNU coreutils 8.32 `stat` at `/usr/bin/stat`**, `timeout` 8.32, mawk 1.3.4, default PATH `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin` — no shim directory) was started with `--network none` and exactly one mount: the run-3 container-script directory, **read-only** (`/mnt/aisb`). No real PM2 home, credential, vault/journal, or host evidence was mounted. Container `aisb-u1-20260928-170422` (Id `df7bd75d932206e3d866d4245f4b38e5fcd6ee67ff9503d0c1d09f519767859c`); removed after the run.

Phase 1 (root): non-root user `inspector` **uid=1001 gid=1001** created with `-M` (no home directory, so it is not an INV-3 candidate); synthetic fixtures `/home/alpha/.pm2` (accessible-present control), `/home/beta/.pm2` (target), `/home/gamma` with no `.pm2` (accessible-absent control), all mode 755, owner root. **Existence established before restriction** from both perspectives: root `stat` → `drwxr-xr-x 0:0 root directory /home/beta/.pm2` (rc 0); the non-root inspector's own `timeout -k 1 5 stat -c '%F %U %n' /home/beta/.pm2` → `directory root /home/beta/.pm2`, **rc 0**. Phase 2 (root): `chmod 000 /home/beta` → `d--------- 0:0 root directory /home/beta`; root `stat /home/beta/.pm2` still rc 0 (the candidate exists). Fixture declaration: the image's `/root` is mode 700 (`drwx------`), so `/root/.pm2` is the frozen Test 10 "`/root` mode 700 → Permission denied → INACCESSIBLE" branch; gamma is the accessible-absent control (no 30 s `stat` shim in this run — the TIMEOUT branch remains covered by run-2 Test 10).

**Execution (the actual pipeline, SSH transport replaced).** The **actual supervisor** (`AisbSupervisor.dll` `E5AF106E…`, production parameters 131,072 B / 3,000 L / 180 s / 10 s stdin / 5 s kill wait / 5 s shared drain) launched `docker.exe exec -i --user 1001:1001 -e LC_ALL=C <container> bash -s` as its child and delivered the **byte-identical frozen §2.7 script** (`F950CAE6…`; no prefix substitution — the script's real `/home/*/` and `/root/.pm2` paths are the container's paths) on stdin. Real GNU `stat` ran inside the container as uid 1001; stdout/stderr were captured to `inv-stdout.bin` / `inv-stderr.bin` and classified by the **actual classifier** (`Classifier.ps1` `D417D10E…`). A second, direct in-container run of the same script (as inspector, from the read-only mount, no Windows pipe path) was captured as a control.

**Results (27 deterministic assertions, all PASS; 0 substituted, 0 unverified):**

| Check | Result |
|---|---|
| Supervisor record | `NORMAL`; `pollTrigger=PROCESS_EXITED`; exit 0; `stdinDelivered=true`; trigger at 0.50 s; 4,905 B / 128 L reserved; inv-stdout.bin 3,719 B; inv-stderr.bin 1,186 B; `=== WHOAMI: inspector ===` |
| INV-3 candidate list | exactly `/root/.pm2`, `/home/alpha/.pm2`, `/home/beta/.pm2`, `/home/gamma/.pm2` (four, in script order) |
| INV-3 markers | `CHECKS: 4`; `CHECK-RC` in order **1, 0, 1, 1** (real `stat` exit codes); `PRESENT: 1`, `FAILED: 3`, `UNRESOLVED: 0`; all closers + `INV-3-END`; `CAP-RC: 0`; `GROUP-RC: 0`; execution class **`EXEC_COMPLETE`** |
| beta diagnostic (inv-stderr.bin) | `stat: cannot statx '/home/beta/.pm2': Permission denied` — emitted by GNU `stat` itself (no shim) |
| Classifier, beta | `Resolve-FailedCandidate` → **`INACCESSIBLE`** (path-matched); not `ABSENT`, not `UNKNOWN`; beta never appears as a PRESENT stat line |
| Classifier, controls | `/home/alpha/.pm2` → PRESENT (`directory root /home/alpha/.pm2` on stdout); `/home/gamma/.pm2` → `ABSENT` (path-matched `No such file or directory`); `/root/.pm2` → `INACCESSIBLE` (declared) |
| INV-3 coverage | **`COVERAGE_INCOMPLETE`** with reasons exactly `INACCESSIBLE(/root/.pm2)`, `INACCESSIBLE(/home/beta/.pm2)` — never `COVERAGE_FULL`; nothing for alpha/gamma |
| Session | `SESSION_EXEC_COMPLETE` / **`SESSION_COVERAGE_INCOMPLETE`** (execution/coverage separation preserved). Other observations recorded, not asserted: INV-1 `EXEC_COMPLETE`/FULL; INV-2 `EXEC_COMPLETE`/FULL (its `ls -la /home` shows `d---------` for beta); INV-4 `INCOMPLETE` (image has no `systemctl`); INV-5 `EXEC_COMPLETE`/INCOMPLETE; INV-6 `EXEC_COMPLETE`/INCOMPLETE |
| Direct in-container control | rc 0; INV-3 observation text **identical** to the supervised capture; stderr byte-identical to `inv-stderr.bin` (same SHA256 `32CA47A7…`) |
| Contrast | after restriction, `[ -d /home/beta/.pm2 ]` is silently **false** and `ls /home/beta` → `Permission denied` (rc 2) — the reason §2.3 uses an explicit, diagnostic-emitting `stat` |

**Conclusion:** the frozen Test 10 beta branch is now supported by executed evidence of the actual OS behaviour: a non-root process, real GNU `stat`, a real mode-000 parent, exit 1 with a path-matched `Permission denied` diagnostic, classified **INACCESSIBLE** with **incomplete coverage** — never ABSENT and never a successful absence finding. The run-2 `stat`-shim evidence for beta (§13.1 / §13.4 / §14.5) is **superseded** by this executed evidence; U-1 is **resolved**. Retained limitation: the container is Ubuntu 22.04 with coreutils 8.32; the staging host's actual coreutils build is observed only at inspection.

### 15.2 U-2 — clock independence of the shared drain deadline and joins (Test 14)

**Method (instrumented build with a wall-clock seam; Windows system clock unchanged).** The frozen Test 14 check admits two mechanisms: a +60 s system-clock advance during drain, **or** an instrumented `DateTime` provider that throws if called. The second was executed. `u2\WallClockSeam.cs` declares types named `DateTime`, `DateTimeOffset` and `Environment` **inside namespace `AisbPreflight`**; C# resolves simple type names in the enclosing namespace before `using System;` imports, so every wall-clock access written in `Supervisor.cs` as `DateTime.UtcNow` / `.Now` / `.Today` / `DateTimeOffset.*` / `Environment.TickCount(64)` binds to the seam, which — when **armed** — throws `WallClockAccessException` at the exact call site (stack retained) and counts calls. `Stopwatch` is untouched; elapsed-duration enforcement stays on it. Precondition asserted: the unmodified `Supervisor.cs` contains no fully qualified bypass token (`System.DateTime`, `global::`, `System.Environment`, `System.TimeZoneInfo`), so the seam intercepts every wall-clock access the supervisor could make. Three builds (csc 4.8.9232.0, `/optimize-`, command lines and hashes in `u2\build-provenance.json`):

| Build | Sources | Purpose |
|---|---|---|
| **A** `AisbSupervisor-seam.dll` `21CEF780…` | **byte-identical** run-2 `Supervisor.cs` (`D50DCB71…`) + `WallClockSeam.cs` (`9C51134C…`) | the supervisor's actual timing path, seam armed for the entire `Run()` |
| **B** `AisbSupervisor-injected-seam.dll` `C9B74DD8…` | `Supervisor-injected.cs` (`28994E28…`; diff `23EB746C…` = **exactly one added line** on the drain path: `{ long __wc = DateTime.UtcNow.Ticks; … }` immediately after `TimeSpan drainStart = sw.Elapsed;`) + seam | positive control — proves the seam is live on the drain path |
| **C** `AisbSupervisor-injected-noseam.dll` `78C821EC…` | `Supervisor-injected.cs` alone (binds to `System.DateTime`) | control — the injected line is benign without the seam |

Each DLL was executed in its own process by `u2\Run-U2-Build.ps1` against the frozen Test 14 fixture (stdout capture stream whose `Write` blocks forever — retained stand-in for a named pipe with no consumer; child `Child.exe mix 0` exits normally; deadline 30 s), plus the **actual run-2 DLL** as baseline. Independently, an over-approximating IL token scan of every method body in the actual DLL `E5AF106E…` resolved 234 distinct member references (`evidence\U2\il-member-refs.txt`).

**Results (22 assertions: 20 deterministic PASS, 2 substituted PASS — the named-pipe stand-in; 0 unverified):**

| Check | Result |
|---|---|
| IL scan of the actual DLL | **0** references to `System.DateTime`, `System.DateTimeOffset`, `System.TimeZoneInfo`, `System.Environment::get_TickCount*`, `Stopwatch::GetTimestamp`; `Supervisor.Run` references `Stopwatch::get_Elapsed`, `Thread::Join`, `Thread::Sleep` |
| Baseline (actual DLL) | no exception; `PERSISTENCE_UNCONFIRMED`; drain 5.009 s |
| **A — seam armed** | **no exception; seam `Calls = 0`; still armed at end.** Shared window `drainDeadlineElapsed − drainStart` = **5.000 s** (0.5112 → 5.5112 s); stdout join `remaining()` 4.999 s, timed out; stderr and stdin joins `remaining()` **0.000 s** (< 5 s, ≤ window); sum of join waits ≤ 5.5 s; drain duration **5.011 s** (Stopwatch; within 4.9–5.5 s); `PERSISTENCE_UNCONFIRMED`; main never `Close()`d the stdout stream; inv-stdout.bin size `UNCONFIRMED`; exit 0; outcome/trigger identical to baseline |
| **B — positive control** | `AisbPreflight.WallClockAccessException: wall-clock access on supervisor path: DateTime.UtcNow`, thrown from `WallClockSeam.Access` ← **`Supervisor.Run`** at the injected drain-path read; seam `Calls = 1`; no record returned; stdout stream still not closed by main (ownership preserved under the fault) |
| **C — no-seam control** | no exception; `PERSISTENCE_UNCONFIRMED`; drain 5.010 s — the throw in B is attributable to the seam intercepting a real wall-clock access |

**Conclusion:** the supervisor's actual timing path (unmodified source, armed seam, executed) made **zero** wall-clock accesses while computing the shared 5 s drain deadline, the three `remaining()` allowances, the joins and reconciliation; the seam is demonstrably live on that path (B) and inert without a wall-clock access (C); the binary artifact contains no wall-clock member reference. The source scan of run 2 is **superseded** by executed evidence; U-2 is **resolved**. Not performed by direction: the +60 s system-clock advance (Windows system clock unchanged). Retained substitution: the blocking-write stream stands in for a named pipe with no consumer.

### 15.3 Results (run 3) and combined acceptance after runs 2 + 3

| Group | Status | det | subst | unverified |
|---|---|---|---|---|
| U-1 (Test 10 beta branch, actual OS) | **PASS** | 27/27 | 0 | 0 |
| U-2 (Test 14 clock independence, instrumented) | **PASS-SUBSTITUTED** | 20/20 | 2/2 (named-pipe stand-in) | 0 |

Run-3 totals: executed and passed **47**; executed and failed **0**; substituted (passed) **2**; blocked **0**; unverified **0**.

**Combined status of the 21 frozen groups (run 2 §14.5, updated by run 3):** Test 10 → **PASS** (beta branch verified by U-1 executed evidence; run-2 shim evidence superseded; gamma TIMEOUT branch from run 2 unchanged); Test 14 → **PASS-SUBSTITUTED** (clock-independence executed via U-2; named-pipe stand-in retained). **18 PASS + 3 PASS-SUBSTITUTED (Tests 11, 13d, 14) + 0 PARTIAL-UNVERIFIED + 0 BLOCKED-DESIGN-CONFLICT + 0 FAIL + 0 ERROR = 21 groups.** Unverified requirements: **none**.

**Retained substitutions (fixture mechanisms; the frozen assertions were executed and hold):** Test 11(b) inserted `exit 7` for "shim exits the group"; Test 13d(b) Windows Job-Object kill for the bash fixture (production `ssh.exe` path exercised by plain `Process.Kill()` in Tests 1–4, 5b, 7, 9); Test 13d(c) inserted `exit 9` for "shim kills the script"; Test 14 blocking-write stream for a named pipe; prefix substitution for `/home` and `/root` in run-2 fixture scripts (permitted by the Test 10 text; not used in run 3). **Retained platform limitations:** Windows/MSYS host for the supervisor and Git-Bash fixtures; U-1 executed on Ubuntu 22.04 / coreutils 8.32 in a container rather than the staging host; `-1` exit codes after local `TerminateProcess` are read integers (§13.4); Docker Desktop (WSL2 backend) was required for U-1 only.

### 15.4 Artifacts and hashes (run 3; runs 1 and 2 preserved)

Root `C:\Users\knlee\aisb-preflight\INVENTORY-01\runs\run3-2026-09-28-U1U2\`. Manifest `manifest-sha256.txt` (55 entries) SHA256 `202DC8F6E96F2B63D2CE4DE31E3CC81037725928B144A71CC5A1D2D2AD90F520`. Root run-2 artifacts and manifest (`164048E8…`) and the run-1 snapshot (`DFB38550…`) are byte-unchanged.

| Path (relative to run-3 root) | SHA256 | Role |
|---|---|---|
| `Run-U1U2.ps1` | `B086A8E366AE980DB9D6BEA35F7392DA361F03362890E32FFC77A19A6192A115` | run-3 harness (U-1 container flow + supervised run + classifier; U-2 IL scan, builds, per-build child processes, assertions) |
| `u1\container\inspection.sh` | `F950CAE6872E9D2BB1A889EBC19AA84348B3CCB62957F3899271BF7F63917F87` | frozen §2.7 script (byte-identical) |
| `u1\container\setup-phase1.sh` / `probe-inspector-pre.sh` / `setup-phase2.sh` / `probe-inspector-post.sh` | `4FC356DB…` / `26111DA4…` / `094F4CB2…` / `2987C6FF…` | fixture setup (root), non-root probes before/after restriction |
| `evidence\U1\image-inspect.json` / `container-inspect.json` / `docker-version.txt` / `container-rm.txt` | `74F86613…` / `732EA9DB…` / per manifest | image identity, container identity (mounts, network, user), daemon version, removal |
| `evidence\U1\phase1-*.txt`, `probe-pre-*.txt`, `phase2-*.txt`, `probe-post-*.txt` | per manifest | UID, permissions, commands, tool versions, pre/post-restriction `stat` output |
| `evidence\U1\supervised\inv-stdout.bin` / `inv-stderr.bin` / `record.json` / `classification.json` | `1388E796…` / `32CA47A7…` / `778B9345…` / `43CE1316…` | actual supervisor capture, §4.3.5 record, §5 classification |
| `evidence\U1\direct-stdout.txt` / `direct-stderr.txt` / `direct-rc.txt` | `4E39AE68…` / `32CA47A7…` / `5FECEB66…` | direct in-container control |
| `u2\WallClockSeam.cs` | `9C51134C9EA6824767F7E46BD14D389B3DEC3A7954F8B2FFD86D2F6A0F245BAF` | instrumentation seam (instrumented builds only) |
| `u2\Supervisor.cs` / `Supervisor-injected.cs` / `Supervisor-injected.diff` | `D50DCB71…` (= run-2 source) / `28994E28…` / `23EB746C…` | build-A source (byte-identical), positive-control source, one-line unified diff |
| `u2\AisbSupervisor-seam.dll` / `-injected-seam.dll` / `-injected-noseam.dll` | `21CEF780…` / `C9B74DD8…` / `78C821EC…` | builds A / B / C |
| `u2\Build-U2.ps1` / `Run-U2-Build.ps1` / `build-provenance.json` | `84939661…` / `F620089A…` / `C5FB405D…` | build script, per-build executor, compiler + command-line + hash provenance |
| `evidence\U2\baseline-actual-dll\`, `A-seam-armed\`, `B-injected-seam-armed\`, `C-injected-noseam\` (`result.json`, `record.json` / `exception.json`) | per manifest | per-build execution records |
| `evidence\U2\il-member-refs.txt` / `il-member-refs-Supervisor.Run.txt` | `3294A973…` / `D41F8565…` | IL member-reference scan of the actual DLL |
| `evidence\results.json` / `results.md` / `results-detail.md` / `run-console.txt` / `run-console-attempt1-harness-errors.txt` | `9EF59EDC…` / `B175A954…` / `C383B742…` / `1E9E4629…` / per manifest | consolidated results, per-assertion detail, console (the attempt-1 console records two harness-only errors — an `$args` parameter shadowing and a CRLF warning treated as an error — fixed before the recorded run; no mechanism change) |

Any later execution must load `AisbSupervisor.dll` `E5AF106E…` (or a rebuild of `Supervisor.cs` `D50DCB71…`), `Classifier.ps1` `D417D10E…`, and the §2.7 script `F950CAE6…`. The instrumented builds are evidence only and must never be used for inspection.

### 15.5 Step status after run 3

- **Step 3 = PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE.**
- §10 execution prerequisite **"Local supervision verification passed"** — **TICKED (2026-09-28, runs 2 + 3):** §4.4 Tests 1–16 including 13a–13d and 15a–15e executed against the actual supervision code; all deterministic assertions hold (U-1 and U-2 now by executed evidence); all scheduling-dependent values within their stated sets; 0 failed, 0 blocked, 0 unverified; the fixture substitutions and platform limitations listed in 15.3 are retained and disclosed, not waived. The frozen check-box text in §10 is not rewritten; the dated pointer under §10 refers here.
- §10 execution prerequisite **trusted host-key provenance (§3.3) — UNRESOLVED / BLOCKER.** SSH, SSH preflight and host inspection remain blocked pending that prerequisite and separate Keith authorization.
- Design findings: none new. No assertion weakened, no requirement waived, no design amendment made in run 3.
- **Activity ledger (run 3):** SSH=0, SSH preflight=0, STAGING acquired=0, AWS=0, host inspection=0, vault/journal access=0, real PM2=0, application runtime=0, transfer=0, acquisition=0, host-specific P5 claims=0, operational authorization=0, Step 4=0, subagents=0, Git commit/push=0, predecessor bodies edited=0, frozen §§0–14 sentences altered=0 (dated pointer lines inserted only), shared supervisor/classifier code changed=0, Windows system clock changed=0. **Local Docker=YES (U-1 only):** Docker Desktop was not running and was started for this step (LOCAL-RUNTIME acquired transiently, released); `ubuntu:22.04` pulled from Docker Hub (network egress for the pull only; retained locally as the recorded image); one disposable container, `--network none`, one read-only mount, removed after the run; no other container, database, Redis or service touched. A stop of Docker Desktop was attempted afterwards; the application relaunched itself and is left running for Keith to quit. Local synthetic child processes and instrumented supervisor builds=YES (Windows).

> **Amended 2026-09-28 (Step 3 run 4 — §16):** the §3.3 blocker bullet in 15.5 was worked in run 4 (provenance collection). Outcome: **BLOCKED / UNRESOLVED** — see §16.3 (AWS path blocked), §16.4–16.5 (local candidate and binding), §16.6 (assessment). Step 3 remains PARTIAL — NOT INSPECTION COMPLETE.

---

## §16. Step 3 run 4 — trusted host-key provenance collection under §3.3 (2026-09-28)

### 16.1 Authorization, baseline and scope

Keith authorized (2026-09-28) continued Step 3 at baseline `b9b3ee08a7c70f3d4b2a0d23665c91c1261ec690` (HEAD verified; working tree clean at window open; this file SHA256 `6DA57B6AFB3ECD2AE41B75F6E4E9E8CB79C27E0F9D21A19B4F3E633388AFF295` before this run), limited to collecting and evaluating trusted server-host-key provenance under frozen §3.3. Permitted: narrow AWS read calls (`sts:GetCallerIdentity`, `lightsail:GetInstance`, `lightsail:GetInstanceAccessDetails` with protocol `ssh`) through an **existing** authorized AWS authentication context only — no credential creation or alteration, no IAM change, no `CreateKeyPair` / `DownloadDefaultKeyPair` / `ImportKeyPair`; if no such context exists, report BLOCKED. Also permitted: local fingerprint recompute; read-only inspection of the local SSH client configuration and `known_hosts` (no configuration hooks executed, no connection, no keyscan, no modification); comparison with the frozen §3.1 binding. Excluded: SSH of any kind (including browser SSH and benign preflight), STAGING, host inspection, vault/journal, PM2, transfer, acquisition, Docker, application runtime, host-specific P5 satisfaction, Step 4, subagents, Git mutations, instance / firewall / IAM / host-key changes. Repository writes limited to this file, `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/control-plane/SATURATION_PROOF.json`. GOVERNANCE acquired transiently for the record updates; no STAGING, PROVIDER-LIVE or LOCAL-RUNTIME lease was needed (no SSH, no provider execution, no local runtime started).

### 16.2 Intended account / region / instance from project records

| Item | Value | Source (tracked records) |
|---|---|---|
| Provider / account | AWS Lightsail, Keith's account. **Account ID is not recorded in tracked docs**; it was to be established from `sts:GetCallerIdentity`, which was not reached (16.3) | `docs/PRIVATE-BETA-STAGING-SETUP-01-CHECKPOINT.md` |
| Region | `ap-southeast-1` (Singapore) | SETUP-01 / `docs/PRIVATE-BETA-STAGING-SETUP-02-CHECKPOINT.md` |
| Instance name | `aisandbox-staging` | `docs/PRIVATE-BETA-STAGING-EXECUTION-01-CHECKPOINT.md` |
| Static IP | `aisandbox-staging-ip` attached; the IPv4 value is recorded in `docs/PRIVATE-BETA-STAGING-EXECUTION-04H-CHECKPOINT.md` and is not repeated in this file | EXECUTION-01 / 04H checkpoints |
| Public hostname | `staging.ainow.biz` → the static IP (DNS A record) | 04H checkpoint |
| SSH user / port | `ubuntu` / 22 (Lightsail firewall TCP 22 open) | EXECUTION-01 checkpoint; frozen §3.1 |
| Local SSH configuration | "Not in this task" at EXECUTION-01; present on the operator host today (16.4) | EXECUTION-01 checkpoint |

The intended context was determined from these records only. No other account, region or instance was enumerated or queried.

### 16.3 AWS retrieval — BLOCKED (no existing authorized AWS authentication context)

Discovery on the operator host was limited to presence checks (names and existence only; no credential file contents read; nothing created or altered): `aws` is not on `PATH` and is not installed at the standard AWS CLI v2 locations; no Amazon/AWS program directories exist; no AWS Tools for PowerShell modules are installed (`Get-AWSCredential` absent); `%USERPROFILE%\.aws` exists but is **empty** (no `config`, `credentials`, `sso\` or `cli\` caches); no `AWS_*` environment variables are set; no Session Manager plugin. Keith's authorization permits only an existing authorized context and forbids creating a new authentication setup.

Consequently **none of the three permitted API calls was made**: the authenticated account / principal was not established; the instance record (name, ARN, region, creation time, endpoint) was not retrieved from AWS; no temporary SSH access credentials were ever received; no AWS-recorded server `hostKeys` (algorithm, public key, fingerprint, `witnessedAt`) were obtained; no fingerprint recompute against AWS values was possible. The AWS-side provenance path is **BLOCKED** (not failed, not attempted with substitute credentials).

### 16.4 Local SSH client configuration and known_hosts (read-only)

- **`%USERPROFILE%\.ssh\config`** (173 bytes, written 2026-08-10): a single block `Host aisandbox-staging` with `HostName <static IPv4>`, `User ubuntu`, `IdentityFile …\LightsailDefaultKey-ap-southeast-1.pem`, `IdentitiesOnly yes`. No `Match`, `Include`, `ProxyCommand`, `ProxyJump`, `LocalCommand`, `KnownHostsCommand`, `HostKeyAlias`, `UserKnownHostsFile` or `StrictHostKeyChecking` directive; no system-wide `ssh_config`. Because the configuration is hook-free, `ssh -G -p 22 ubuntu@aisandbox-staging` (OpenSSH_for_Windows_9.5p1; prints the effective configuration only; no connection) was used to resolve the effective binding: user `ubuntu`; `hostname` = the configured static IPv4; `port 22`; `hostkeyalias` empty; `checkhostip no`; `hashknownhosts no`; `stricthostkeychecking ask` (client default — the frozen §3.1 command overrides it with `=yes`); `updatehostkeys true` (client default); `userknownhostsfile` = `~/.ssh/known_hosts` and `~/.ssh/known_hosts2` (absent); global known_hosts files absent. The identity file was neither read nor used.
- **Host-key lookup identity (§3.1 row):** with no `HostKeyAlias` and `CheckHostIP no`, OpenSSH looks up the *effective `HostName`* — the static IPv4 literal, in its un-bracketed form because the port is 22. The alias `aisandbox-staging` is **not** itself a lookup identity. Keith's confirmation of this row remains required (16.6).
- **`~/.ssh/known_hosts`** (13 lines, 2,516 bytes, SHA256 `54E7C8165AACFF09C90A7119974D9ADAAC3260D7A638235858E673E12B9A6BD2`, last written 2026-08-20; plain, unhashed entries; inspected only with offline `ssh-keygen -F` / `-l`):
  - lookup identity (static IPv4): **exactly one entry — line 12, `ssh-ed25519`, fingerprint `SHA256:kwAg4iEcpglnu4XTqy6NrQOlz8xzybbV3xY6rzwmwO0`**. Recomputing the fingerprint locally from the extracted public key (`ssh-keygen -lf`) reproduces the same value.
  - `staging.ainow.biz`: one entry — line 11, `ssh-ed25519`, the **same** fingerprint (consistent across the DNS name and the IP).
  - `aisandbox-staging` and `[<static IPv4>]:22`: no entries. No ECDSA or RSA entry exists for the host. `~/.ssh/known_hosts.old` (2025-03-10) contains no entry for the IP, so the candidate was recorded between 2025-03 and 2026-08-20; the recording channel is not documented in tracked records.
- No file under `~/.ssh` was modified. No endpoint was contacted.

### 16.5 Comparison with the frozen §3.1 binding

| Frozen §3.1 | Local effective (16.4) | AWS record (16.3) | Result |
|---|---|---|---|
| User `ubuntu` | `ubuntu` | not retrieved | consistent locally |
| Endpoint `aisandbox-staging` | client alias → static IPv4 recorded for `aisandbox-staging-ip` (04H) | instance name / endpoint not AWS-confirmed | consistent with tracked records only |
| Port 22 | 22 | — | consistent |
| Host-key lookup identity | static IPv4 literal | — | determined; Keith confirmation pending |
| Trusted key source (§3.3) | one ED25519 candidate `SHA256:kwAg4iEcpglnu4XTqy6NrQOlz8xzybbV3xY6rzwmwO0` (known_hosts line 12; identical key on line 11) | **no AWS-recorded host key retrieved** | **no independent, instance-specific binding** |

### 16.6 Assessment against §3.3

The evidence collected in this run does **not** establish §3.3. What exists is a single, internally consistent `known_hosts` candidate (ED25519; the same key under the DNS name and the IP) whose original source is undocumented in tracked records. That is `known_hosts` continuity / first-connection-class evidence, which §3.3 explicitly lists as **NOT independent provenance**. Nothing collected binds the candidate to the instance `aisandbox-staging` through a channel that is independent of SSH, authenticated and instance-specific; AWS-recorded keys and their `witnessedAt` values were not obtained, so no AWS comparison, no timing evaluation and no mismatch determination could be made. **§3.3 remains UNESTABLISHED — BLOCKER.** No trust exception is adopted; the existing entry was neither replaced, accepted nor altered; final provenance acceptance stays pending Keith's review. Blocked status is a valid outcome (§0.9). No SSH execution follows from this run.

Routes that could still satisfy §3.3 (Keith's decision; none started here, none authorized by this run): (a) an existing or newly Keith-authorized authenticated AWS context (CLI or console) yielding `GetInstanceAccessDetails` server `hostKeys` for `aisandbox-staging` in `ap-southeast-1`, compared with `SHA256:kwAg4iEcpglnu4XTqy6NrQOlz8xzybbV3xY6rzwmwO0` and read with `witnessedAt` as Lightsail's recording time rather than a fresh observation; (b) provisioning-time deployment records for the host key, if any exist; (c) Keith's attestation recording the source, channel, date and instance binding of the 2026-08 `known_hosts` entries. Under every route a missing key, mismatch, ambiguous instance / endpoint binding or unexplained timing concern remains blocking.

### 16.7 Artifacts and hashes (run 4; runs 1–3 preserved)

Root `C:\Users\knlee\aisb-preflight\INVENTORY-01\runs\run4-2026-09-28-PROVENANCE\`. Manifest `manifest-sha256.txt` (7 entries) SHA256 `44F60E995D9CFD9A48BA6E957741B79ADCECA20C2763AB3D692F9C81148007B9`. Root run-2 artifacts and manifest (`164048E8…`), the run-1 snapshot (`DFB38550…`) and the run-3 directory (manifest `202DC8F6…`) are byte-unchanged. No artifact contains credentials (none were received). Files under `private\` and the two `evidence\` files marked below contain the static IPv4 literal and the public host key and are retained privately only.

| Path (relative to run-4 root) | SHA256 | Role |
|---|---|---|
| `evidence\aws-context-discovery.txt` | `E4DBAC9FBF35906B626C78C87316A0FA600896F45715F312A038ED95EDB56D56` | presence-only discovery of an existing AWS authentication context; BLOCKED result; retrieval time |
| `evidence\provenance-record.json` | `795343B45BA1844094A82FF6B15278EF98952DB65E7F1D2E7D92C3AA6EA19F0C` | private record: intended context, AWS outcome (not called), effective SSH binding, known_hosts candidate and recompute, binding comparison, assessment, ledger (contains the IPv4) |
| `evidence\ssh-G-ubuntu-at-aisandbox-staging-p22.txt` | `CD63DB1EDF0CE5A80462166C476C48216EC3615323E088B653FEF6A8CC0109AE` | `ssh -G` effective configuration (contains the IPv4) |
| `evidence\known_hosts-lookups.txt` | `C4DF99276456403D3A8F2F208F04770EA2E7FDDD4C29FA58409C2184D9A51777` | offline `ssh-keygen -F` / `-l` lookups, known_hosts hash and mtime, local recompute (contains the IPv4) |
| `private\ssh-config-copy.txt` / `known_hosts-candidate-lines-11-12.txt` / `candidate-ed25519.pub` | `C2DA0133…` / `DD713897…` / `41E44B55…` | byte copies of the client config block and the two candidate entries; extracted public key used for the recompute |

Post-manifest (this run's record-application scripts and this section text) are listed in the records ledger of `TASKS_BACKLOG_FULL.md`.

### 16.8 Step status after run 4

- **Step 3 = PARTIAL / LOCAL PREFLIGHT ONLY — NOT INSPECTION COMPLETE.**
- §10 execution prerequisite **trusted host-key provenance (§3.3) — UNRESOLVED / BLOCKER** after run 4: the AWS-side path is BLOCKED (no existing authorized AWS authentication context; zero API calls); the local candidate is documented but not independently bound to the instance. Keith's confirmation of the host-key lookup identity (16.4) is also pending.
- §10 execution prerequisite "Local supervision verification passed" — TICKED (§15.5), unchanged.
- Design findings: none new. No assertion weakened, no requirement waived, no design amendment made in run 4; no frozen sentence rewritten (dated pointer lines inserted under §3.1, §3.3, §10 and §15.5 only).
- **Activity ledger (run 4):** SSH=0 (including browser SSH and benign preflight), SSH keyscan=0, STAGING acquired=0, AWS API calls=0 (presence-only context discovery; credentials created / altered / read=0; temporary credentials received=0), host inspection=0, vault/journal access=0, PM2=0, transfer=0, acquisition=0, Docker=0, application runtime=0, host-specific P5 claims=0, operational authorization=0, Step 4=0, subagents=0, Git commit/push/branch=0, predecessor bodies edited=0, frozen §§0–15 sentences altered=0, SSH configuration / known_hosts modified=0, identity file read or used=0, instance / firewall / IAM / host-key changes=0. Local read-only activity only: `ssh -G`, `ssh-keygen -F` / `-l` / `-lf`, filesystem presence checks and hashing.
