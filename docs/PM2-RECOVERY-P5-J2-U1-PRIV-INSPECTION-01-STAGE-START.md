# PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01 — Stage-Start / Read-Only Privileged Inspection Plan Freeze

**Task:** PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01 — Read-only privileged inspection plan for residual U-1 blockers left by locked PM2-RECOVERY-P5-J2-SEARCH-01 and selected by locked PM2-RECOVERY-P5-J2-U1-RESOLUTION-01 Option B
**Nature:** GOVERNANCE / PLAN (4-step). No implementation lane. No sidecar candidate. No saturationClass.
**Step:** 2 of 4 — plan freeze (this record). Step 1 registration is the same window. Steps 3–4 are NOT AUTHORIZED. Task is NOT LOCKED.
**Date:** 2026-09-30
**HEAD at window open:** `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d` (branch main; index empty; inherited dirtiness `docs/control-plane/SATURATION_PROOF.json` only, preserved unchanged and unstaged; origin/main matches HEAD)
**Registration:** `TASKS_BACKLOG_FULL.md` § PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01 (Step 1 COMPLETE this window)
**Controlling selection:** PM2-RECOVERY-P5-J2-U1-RESOLUTION-01 Option B, selected in the record committed at `37380505b815089b620de5b473ca0fb861b67404` and locked at `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`. Option text frozen at `f34234cebb3649cb9608cbaee65bed2c8549384b`. Options A, C, and D were not selected. That lock creates no execution authority. This plan does not alter it.
**Dependencies:** PM2-RECOVERY-P5-J2-U1-RESOLUTION-01 (COMPLETE AND LOCKED at `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`; not reopened), PM2-RECOVERY-P5-J2-SEARCH-01 (COMPLETE AND LOCKED 2026-09-29; lock commit `680387c3237cfdf35bceadbb78e7058b8defa94c`; Step 3 evidence committed at `5ee2d9a8821db761a5de99bdee785c5289bab102`; residual U-1 remain blocking; not reopened), PM2-RECOVERY-P5-J2-SCOPE-01 (COMPLETE AND LOCKED; current-host scope approved as proposed at `8b0afa889fc93aded5a178b324513166ebd388a5`), PM2-RECOVERY-P5-J2-AMENDMENT-01 (COMPLETE AND LOCKED; Option B adopted), PM2-RECOVERY-P5-JOURNAL-01 (COMPLETE AND LOCKED; J-2 adopted; E-J6 blocking; body physically unchanged), PM2-RECOVERY-P5-SCOPE-01 (COMPLETE AND LOCKED; BLOCKED under the unamended rule applied then), PM2-RECOVERY-P5-INVENTORY-01 (COMPLETE AND LOCKED; bounded inventory finding only). PM2-RECOVERY-ACQUISITION-01, PM2-RECOVERY-POLICY-01, PM2-RECOVERY-BASELINE-GOV-01, and PM2-RECOVERY-CAPTURE-01 remain COMPLETE AND LOCKED and are not reopened.
**Authorization:** Keith authorized **registration and Step 2 plan-freeze only** at baseline `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`. This window is documentation / governance planning only. It does not execute the privileged session.

**Status: PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01 — REGISTERED / READY / NOT ADMITTED — Steps 1–2 COMPLETE / PLAN FROZEN — 2026-09-30 at baseline `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`. Step 3 NOT AUTHORIZED. Step 4 NOT AUTHORIZED. Task NOT LOCKED. Privileged session not executed. No successor registered beyond this plan. SEARCH-01 and U1-RESOLUTION-01 remain COMPLETE AND LOCKED. No U-2(e); no P5; no C-ACQ; no HOST_CLEAN; no P7; no reopen.**

---

## §0. Invariants preserved by this freeze

1. **Predecessor bodies unchanged.** SEARCH-01, U1-RESOLUTION-01, SCOPE-01, AMENDMENT-01, P5-JOURNAL-01, P5-SCOPE-01, P5-INVENTORY-01, ACQUISITION-01, POLICY-01, BASELINE-GOV-01, and CAPTURE-01 stage-start documents and backlog bodies remain physically unchanged. SEARCH-01 and U1-RESOLUTION-01 remain COMPLETE AND LOCKED and are not reopened.
2. **Option B is the only selected path, and it is not widened.** This plan prepares the separately authorized sudo/read-only inspection described by locked Option B. It does not select Option A, C, or D. It does not add a provider, AWS, SSM, or serial channel.
3. **Locked SEARCH-01 residuals are the input.** Every in-scope row is cited to SEARCH-01 §14.6 / §14.7 / §14.9 and U1-RESOLUTION-01 §2 / Option B. This freeze does not re-run, re-score, or close any row.
4. **U-1 remains blocking until a later authorized observation says otherwise.** Remaining U-1 is E-J6. This plan does not resolve any row.
5. **U-2 remains disclosed and unresolved.** Historical unknowns, including historical PID 1177465, are not targets. Current PID 1193674 is a U-1 artifact only.
6. **U1-accounts-now stays RESOLVED-COVERED.** This plan does not re-enumerate accounts.
7. **Already covered accessible results stay covered.** `/home/ubuntu/.pm2` PRESENT and the accessible ABSENT `.pm2` rows from SEARCH-01 are not re-searched.
8. **This window grants no privilege and performs no host access.** The privilege class in §4 is a definition for a later Step 3 authorization. It is not a grant.
9. **No successor is registered.** A later privileged session, if Keith authorizes it, is Step 3 of this task. It is not a new task. Step 3 is NOT AUTHORIZED.
10. **Testimony preserved.** Keith's testimony remains "probably no, but uncertain".
11. **EXEC-01C6A startCondition=NOT_READY; HOST_CLEAN=NO; P7_ACCEPTED=NO; REOPEN_GATE=UNSATISFIED; E1 UNREGISTERED.** Unchanged.
12. **Lane 3 DISABLED. Occupancy EMPTY. Sidecar unchanged. GOVERNANCE released UNOWNED.** Repository `docs/control-plane/SATURATION_PROOF.json` is not mutated.
13. **Committed records only.** No new host observation is introduced.

---

## §1. What this plan is

A bounded plan for one later read-only sudo session whose only purpose is to observe the residual U-1 blockers that SEARCH-01 could not read as `ubuntu`, plus PID 1193674 if that PID is still the same current process.

It is not a second full search. It is not whole-disk coverage. It is not U-2(e), P5, C-ACQ, HOST_CLEAN, P7, or reopen.

---

## §2. In-scope residuals and closed path set

### 2.1 Residual IDs

| ID | Locked residual | In this plan |
|---|---|---|
| **U1-G1** | `/root/.pm2` inaccessible | Metadata and name-class observation only |
| **U1-G2** | `.pm2` inaccessible for `caddy`, `redis`, `pollinate`, `chrony` | The four locked paths below, only |
| **U1-G3** | PM2 home of PID 1193674 unidentified | Only if that PID is still the same current process (§6 CC-PID) |
| **U1-G4-current** | PID 1193674 unmatched by `ps` / environ | Same PID rule. Historical PID 1177465 is not this row |
| **U1-G5-dormant** | Named-root traversal incomplete under `/root` and inaccessible `/var/lib` subtrees | Name-class find on the closed root list only |
| **U1-G6-leftover** | `/root` leftover unknown; inaccessible `/var/lib` subtrees | Name-only listing on the closed root list only |
| **U1-reloc** | Relocation destinations hidden by those inaccessible paths | Only names found inside the closed root list |
| **U1-pending** | Inaccessible paths could hide pending filename-class material | Filename-class names only, at session time, not permanent closure |
| **U1-unexplored** | Inaccessible/unsearched remainder; no default `--vault` / `--workdir` | Honesty rule unchanged. Named roots are not whole-filesystem coverage |

### 2.2 Closed path set

Explicit paths named by locked SEARCH-01 §14.6. No other path is in plan.

**`.pm2` metadata targets**

- `/root/.pm2`
- `/var/lib/caddy/.pm2`
- `/var/lib/redis/.pm2`
- `/var/cache/pollinate/.pm2`
- `/var/lib/chrony/.pm2`

**Name-class roots (listing and bounded find)**

- `/root`
- `/var/lib/docker`
- `/var/lib/containerd`
- `/var/lib/caddy`
- `/var/lib/redis`
- `/var/lib/chrony`
- `/var/lib/private`
- `/var/lib/amazon`
- `/var/lib/polkit-1`
- `/var/lib/udisks2`
- `/var/lib/postgresql/15/main`
- `/var/cache/pollinate`

SEARCH-01 find stderr also mentioned snapd cache/cookie/void, apt lists partial, and update-notifier partial without repeating full paths in the locked stage-start summary. Those rows stay U-1. A later Step 3 may include one of them only if that authorization quotes the exact path already written in the locked evidence package `C:\Users\knlee\aisb-k4-evidence\PM2-RECOVERY-P5-J2-SEARCH-01\run-1-20260929-185706`. This window does not open that package. Unquoted paths are not searched. ENOENT placeholders from SEARCH-01 (`/var/spool/{lpd,news,uucp}`, `/var/www`, `/var/list`, `/run/ircd`) are not inaccessible U-1 targets and are not in the closed set.

**Process target**

- PID **1193674** only, and only under the still-current rule in §6.
- PID **844871** may be read for `pid` and `comm` only, as a discriminator so it is not confused with 1193674. Its already identified `PM2_HOME=/home/ubuntu/.pm2` is not re-walked.

### 2.3 Out of scope

- Re-running OG-ACCOUNTS or the 22 accessible ABSENT `.pm2` checks
- `/home/ubuntu/.pm2` tree contents
- Historical PID 1177465 and every other U-2 ID
- Whole-disk `find`, new homes, new roots, or operator-chosen `--vault` / `--workdir` paths that were never recorded
- Docker CLI, Postgres server, Redis server, PM2 client, systemd mutation, AWS, transfer, acquisition

---

## §3. Allowed observations

A later Step 3, if separately authorized, may record only:

| Observation | Allowed result classes |
|---|---|
| `.pm2` path on the closed list | present / absent / still inaccessible / error |
| Directory entry names under a closed root | names of `.pm2`, leftover directories, and the filename class in §6 CC-FIND; not file bodies |
| Filename-class hit under a closed root | path and name only: `overlay_commands.json`, `pending_apps.json`, `unknown_overlay.json`, `restore_result.json`, directory name `protected` |
| PID 1193674 | absent; or present with `comm`, uid, start time, and the `PM2_HOME` value only |
| Privilege probe | `sudo -n` succeeded or failed; remote uid before sudo |

Not allowed as observations: file contents, `protected/*.value` bytes, database pages, Redis dumps, container-layer bytes, full process environ, secrets, or a process-table sweep.

Each row records an outcome. Silence is not absence. A path that still cannot be read stays U-1 / E-J6.

---

## §4. Privilege boundary

This section defines the privilege a later Step 3 authorization would have to grant. **This window does not grant it.**

| Boundary | Rule |
|---|---|
| Login | SSH as `ubuntu` to `aisandbox-staging` port 22. Not root SSH |
| Privilege class | Non-interactive `sudo -n` on the command classes in §6 only. This is a grant, unlike SEARCH-01 P-PRIV which was a non-grant |
| Elevation shape | One read-only command per sudo invocation. No `sudo -i`, `sudo su`, `sudo bash`, `sudo sh`, or an interactive root shell, even if sudoers would allow it |
| Password | No prompt. If `sudo -n` fails, stop the privileged classes. Do not ask for a password. Do not switch to AWS, SSM, or serial |
| Scope of root | The closed path set and `/proc/1193674` (plus the 844871 discriminator). Not the rest of the host |
| Time | One session, finite caps in §6. Not a standing sudo lease |
| Mutex | A later execution window acquires STAGING for that window and releases it. This freeze does not acquire STAGING |

If the later authorization grants a different privilege class, a wider path list, or a root shell, that is a plan modification and must be recorded before any command. Silent expansion invalidates the session (§8).

---

## §5. Read-only safeguards

All of the following bind a later Step 3. None is performed now.

1. No remote file creation: no `>`, `>>`, `tee`, `install`, `cp`, `mv`, `rm`, `mkdir`, `chmod`, `chown`, or editor.
2. No PM2 client argument of any kind (`start`, `stop`, `restart`, `save`, `delete`, `update`, `resurrect`, dump-that-writes, or signal).
3. No `docker`, `docker compose`, `psql`, `redis-cli`, `pg_ctl`, or Redis/Postgres server control. Name-class directory reads under `/var/lib/docker`, `/var/lib/containerd`, `/var/lib/postgresql/15/main`, and `/var/lib/redis` are filesystem observations only.
4. No `systemctl start|stop|restart|reload|enable|disable`, no `service`, no unit-file edit.
5. No `kill`, `pkill`, or other signal.
6. No read of file bodies. `stat` metadata and directory entry names only, except the single `PM2_HOME` field from PID 1193674 environ when the still-current rule passes.
7. No copy off the host. No `scp`, `rsync`, or upload. Local supervisor captures stdout/stderr only.
8. Remote payload, if a later window uses one, is piped to `bash -s` stdin. No file is uploaded to the host. No repository script is created by this freeze.
9. `find` is `-xdev`, maxdepth 4, name predicates only, and rooted only on the closed list. `find /` is forbidden.
10. Cap, timeout, or permission denial fails closed to U-1. It is not converted to absence or to U-2.

---

## §6. Command classes (defined, not executed)

No command in this section is run in this window. No script file is created. Shapes are frozen so a later Step 3 can be reviewed against them.

### 6.1 Local carrier (later Step 3 only)

Same class as SEARCH-01 §7.1, cited and not run: Windows PowerShell 5.x local supervisor; remote bash on SSH stdin; no PTY (`-T`); `BatchMode=yes`; `StrictHostKeyChecking=yes`.

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

Host-key lookup identity and provenance are preconditions in §7. This freeze does not run `ssh`, `ssh -G`, `ssh-keygen`, or AWS. Carry-forward of the 2026-09-28 ED25519 fingerprint `SHA256:kwAg4iEcpglnu4XTqy6NrQOlz8xzybbV3xY6rzwmwO0` is not automatic.

### 6.2 Remote classes

| Class | Covers | Allowed shape | Stop inside the class |
|---|---|---|---|
| **CC-BIND** | Session identity | `whoami`, `id -u`, `hostname` as `ubuntu`, before sudo | If user is not `ubuntu` or host binding fails, stop the session |
| **CC-PRIV-PROBE** | Privilege probe once | `sudo -n id -u` or `sudo -n true` | Non-zero: stop every sudo class; do not prompt |
| **CC-STAT** | U1-G1, U1-G2 | `sudo -n stat` metadata only (`%F`, mode, owner, name) on the five `.pm2` paths | Non-zero or denial: record still inaccessible / error; do not chmod |
| **CC-LIST** | U1-G6-leftover | `sudo -n ls -1` name-only on each closed root | Do not `ls` file bodies; do not recurse into printing contents |
| **CC-FIND** | U1-G5-dormant, U1-reloc, inaccessible part of U1-pending and U1-unexplored | `sudo -n find <one closed root> -xdev -maxdepth 4` with name predicates `.pm2`, `overlay_commands.json`, `pending_apps.json`, `unknown_overlay.json`, `restore_result.json`, `protected` | Any root outside §2.2, any depth above 4, any `-exec` that writes, any content print: stop |
| **CC-PID** | U1-G3, U1-G4-current | See still-current rule below | PID gone, reused, or unbound: stop the PID class; do not scan other PIDs |
| **CC-MATERIAL-NAME** | Filename class at hits from CC-FIND | `sudo -n test -e` or the find name itself | `cat`, `head`, `dd`, or copy: stop |

**CC-PID still-current rule**

SEARCH-01 at `2026-09-29T11:01:05Z` recorded `ps` rc 1 and environ inaccessible for PID 1193674. Privilege does not reconstruct a vanished process.

1. Read existence with `ps -p 1193674` and, only if a process exists, `comm`, uid, and start time. Use `sudo -n` only if the unprivileged read is denied.
2. **PID-GONE:** no such process. Stop. Do not invent `PM2_HOME`. U1-G3 and U1-G4-current remain unresolved for identity.
3. **SAME-PROCESS:** a process exists and its start time is at or before `2026-09-29T11:01:05Z`. Then, and only then, read the `PM2_HOME` value from its environ and discard every other environ field. That value is an observation of this still-current process.
4. **PID-REUSED:** start time is after `2026-09-29T11:01:05Z`. Record comm and start time. Do not read environ. Do not attribute that process to the SEARCH-01 heuristic PID. Do not close U1-G3 or U1-G4-current.
5. **UNBOUND:** start time cannot be read. Do not read environ. Do not close the rows.
6. Optional discriminator: `ps -p 844871 -o pid,comm` only. Do not open `/home/ubuntu/.pm2`.

### 6.3 Numeric ceilings

Proposed ceilings for a later authorization. They may be tightened. Widening them, or widening roots, is a plan modification.

| Bound | Ceiling |
|---|---|
| SSH connect timeout | 10 s |
| SSH keepalive | 15 s × 4 |
| Session deadline | 120 s |
| Per-command timeout | 15 s |
| Find maxdepth | 4 |
| Find roots | closed list only |
| stdout+stderr capture | 65536 bytes / 2000 lines |
| PID environ retained | `PM2_HOME` value only, and only on SAME-PROCESS |

A cap-hit or timeout leaves the affected U-1 row as U-1.

---

## §7. Later Step 3 preconditions (not satisfied here)

A later execution window must have all of the following before any command. This freeze satisfies none of them.

| ID | Precondition |
|---|---|
| **P-AUTH** | Explicit Keith authorization of **this task's Step 3 only**, naming this frozen plan and its commit SHA. Step 4 remains separate |
| **P-SELECT** | U1-RESOLUTION-01 Option B remains the locked selection at `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d`, unchanged |
| **P-SSH-BIND** | `ubuntu@aisandbox-staging` port 22, key-based, `BatchMode=yes`, no PTY |
| **P-HOSTKEY** | Keith confirms host-key lookup identity and independent provenance at Step 3. Mismatch or refusal is a blocker. No TOFU |
| **P-SUPERVISOR** | Local supervisor of the SEARCH-01 / INVENTORY-01 class: private local captures, stdin script, finite caps, captures not deleted by the supervisor |
| **P-STAGING** | STAGING acquired for that window only, then released |
| **P-PRIV-GRANT** | The Step 3 authorization explicitly grants the §4 `sudo -n` class. This freeze is not that grant |
| **P-RO** | The Step 3 authorization repeats the §5 read-only list |
| **P-NO-COMINGLE** | That window does not also perform U-2(e), P5, C-ACQ, E1, HOST_CLEAN, P7, or reopen |

---

## §8. Stop conditions

Stop the later session, and do not improvise a wider command, when any of these is true:

1. A §7 precondition is missing.
2. Host-key mismatch, wrong user, or wrong host.
3. `sudo -n` fails or would prompt.
4. A command is outside §6, or a path is outside §2.2 (unless a quoted locked-evidence path was added in the Step 3 authorization itself).
5. Any write, signal, transfer, PM2 client, Docker CLI, Postgres client, or Redis client is about to run or has run.
6. CC-PID reaches PID-GONE, PID-REUSED, or UNBOUND.
7. A capture cap or timeout is hit. Affected rows stay U-1.
8. A filename-class hit would require reading or copying contents. Record the name and stop that class. Do not open C-ACQ.
9. The session is asked to resolve U-2, accept U-2(e), satisfy P5, clean the host, accept P7, or reopen EXEC-01C6A.

This planning window stops before item 1. No SSH, sudo, or host command is started.

---

## §9. Expected evidence outputs (later Step 3 only)

This window produces none of these artifacts and creates no evidence directory.

If Step 3 is later authorized and run, the local supervisor record must include:

1. Captured stdout, stderr, SSH identity, supervisor outcome, and SHA-256 of each capture. Not deleted by the supervisor.
2. Privilege record: uid before sudo, result of the one `sudo -n` probe, and confirmation that no root shell was opened.
3. One outcome per in-scope ID: present / absent / still inaccessible / error / PID-GONE / PID-REUSED / UNBOUND / SAME-PROCESS / not-executed.
4. For SAME-PROCESS only: `comm`, uid, start time, and `PM2_HOME` value. No other environ fields.
5. Name-class hits with path and filename. Empty is an observation inside the closed roots, not whole-filesystem absence.
6. Residual U-1 list after the session. Any unobserved or denied row remains U-1.
7. A statement that U-2 IDs were not modified and that U-2(e), P5, C-ACQ, HOST_CLEAN, P7, and reopen were not performed.

Classification of each in-scope row uses the SEARCH-01 result names: **RESOLVED-COVERED**, **RESOLVED-ABSENT**, **FOUND-MATERIAL**, or **U1-REMAINS**. Access failure, PID-GONE, PID-REUSED, and UNBOUND are **U1-REMAINS**. None of those results is U-2.

---

## §10. What even a completed later session does not do

- It does not identify PID 1193674's PM2 home if the process is gone, reused, or unbound.
- It does not close U-2 or historical PID 1177465.
- It does not permanently close **U1-pending**.
- It does not satisfy **U1-unexplored** outside the closed roots. There is still no default `--vault` / `--workdir`.
- It does not by itself authorize U-2(e). U-2(e) still requires every U-1 resolved after an approved search, as a separate decision.
- It does not satisfy P5, C-ACQ, E1, HOST_CLEAN, or P7, and it does not reopen EXEC-01C6A.
- It does not change EXEC-01C6A `startCondition=NOT_READY`.

---

## §11. Non-effects of this window

This registration and plan freeze:

- Does NOT execute the privileged session
- Does NOT grant sudo or any other privilege
- Does NOT perform SSH, AWS, host inspection, search execution, PM2, Docker, Postgres, Redis, or runtime mutation
- Does NOT create U-2(e) acceptance or recategorize U-1 as U-2
- Does NOT claim P5, C-ACQ, HOST_CLEAN, P7, or reopen
- Does NOT register or authorize any successor task
- Does NOT authorize Step 3 or Step 4
- Does NOT reopen or edit SEARCH-01 or U1-RESOLUTION-01
- Does NOT change EXEC-01C6A startCondition=NOT_READY
- Does NOT add a sidecar candidate or saturationClass
- Does NOT acquire STAGING
- Does NOT mutate repository `docs/control-plane/SATURATION_PROOF.json`
- Does NOT commit, push, reset, restore, clean, or stage

---

## §12. Step 1 / Step 2 acceptance criteria (this window)

- [x] Identifier PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01 confirmed unused before registration
- [x] Machine registration stanza `nature=GOVERNANCE` exactly once
- [x] Board records updated; occupancy remains EMPTY; GOVERNANCE released UNOWNED
- [x] Option B cited as locked at `efd2140c9a8b0742bae76a9b1ef9566ab27ba68d` without alteration
- [x] Allowed observations, privilege boundary, read-only safeguards, command classes, expected evidence outputs, stop conditions, and non-effects defined
- [x] Closed path set limited to SEARCH-01 inaccessible current paths and PID 1193674 if still current
- [x] Command classes not executed; no repository script created
- [x] SEARCH-01 and U1-RESOLUTION-01 remain COMPLETE AND LOCKED
- [x] No successor registered
- [x] Step 3 and Step 4 NOT AUTHORIZED; task NOT LOCKED
- [x] Validator proof written under `$env:TEMP`; repository SATURATION_PROOF.json not mutated
- [x] No Git commit, push, reset, restore, clean, or stage

---

## §13. Activity ledger (Steps 1–2, this window)

LIVE=0, SSH=0, staging=0, STAGING lease=0, AWS=0, sudo=0, provider=0, credits=0, runtime=0, Docker=0, Postgres=0, Redis=0, PM2=0, host inspection=0, search execution=0, privilege grant=0, transfer=0, acquisition=0, canary=0, U-2(e)=0, P5=0, C-ACQ=0, E1=0, HOST_CLEAN=0, P7=0, reopen=0, successor registration=0, subagents=0, browser automation=0, predecessor body edits=0, sidecar edits=0, lockedTaskIds edits=0, SATURATION_PROOF.json not mutated, Git commit/push/reset/restore/clean/stage=0.

Files written under transient GOVERNANCE: `TASKS.md`, `TASKS_BACKLOG_FULL.md`, `docs/PM2-RECOVERY-P5-J2-U1-PRIV-INSPECTION-01-STAGE-START.md`.
