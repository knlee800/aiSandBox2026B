# BACKUP-RETENTION-01 — Checkpoint

**Task:** BACKUP-RETENTION-01 — Keep backup copies 30 days or less (prune by date)
**Status:** COMPLETE AND LOCKED — 2026-11-13. Not installed on the host.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-13 (c0eb172) from Keith's privacy answers (ACCESS-READY-01, Q2: every backup copy kept 30 days or less). Keith asked for it ("Start BACKUP-RETENTION-01").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1, no mutex, HOTFILE leases on the write set | 888b94f |
| 2. Implementation | opus subagent in worktree `lane/BACKUP-RETENTION-01`, fast-forwarded into main | 518a7e2 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## What changed

- **`ops/clean-baseline/lib/ops-lib.sh`** gains `backup_prune_retention <now-epoch>`, plus two helpers: `backup_ts_epoch` and `backup_retention_is_link`.
  - Every age comes from the UTC timestamp in the item's name, never from mtime. A name that does not round-trip is skipped.
  - It acts only on `20YYMMDDTHHMMSSZ` names with exactly no suffix, `.failed`, `.tar.age` or `.identity`.
  - It leaves alone: symlinks, a symlinked root, `*.partial`, the `records/` directory, and any other name.
  - The rules:
    - the newest 7 nightly sets are kept (unchanged);
    - pre-migration sets and `<ts>.failed` sets older than 30 days are deleted (failed sets were never deleted before);
    - off-host `<ts>.tar.age` bundles older than 28 days are deleted with their `<ts>.identity` files, and orphan identity files go after 28 days too; the newest bundle is never deleted.
  - Each deletion prints its name only, followed by a summary count.
  - The function refuses (return 10) a missing or non-integer time, and empty `AISB_BACKUPS` or `AISB_OFFHOST`.
- **`ops/clean-baseline/bin/aisandbox-backup`**: the old inline pruning (by mtime, which never touched off-host bundles) is replaced by one call, `backup_prune_retention "$(date -u +%s)"`. It still runs only after a successful backup, under the operations lock.
- **`ops/clean-baseline/tests/regression/backup-retention.sh`** is new, with 115 checks. It covers:
  - every rule, with exact boundaries (28 and 30 days kept, one second more deleted);
  - mtimes that contradict the names;
  - the newest bundle kept at 40 and 100 days;
  - partial files, symlinks and 20 odd or invalid names left alone;
  - mixed nightly, pre-migration and failed sets;
  - a second run that deletes nothing;
  - the refusals;
  - an end-to-end run of the entry point with stubbed operations: pruning after success, and none after a failed backup (exit 20).
- **`ops/clean-baseline/README.md`**: the retention paragraph now states the new rules.

The rule for off-host bundles is "older than 28 days, newest kept". So the host keeps up to four weeks of nightly bundles, not exactly four weekly ones. Every copy is still under 30 days, which is what Keith decided.

## Implementer

opus subagent (Opus 5.5; data deletion on the host), commit 518a7e2 on `lane/BACKUP-RETENTION-01`. The worker also mutated the code on purpose: a `>=` boundary, no newest-bundle skip, keeping 6, ignoring `kind`, no name anchor, no call. The test caught each one.

**Limit on Windows:** this machine cannot create real symlinks, so the test replaces the link check with a list of paths. On Linux the same test uses real symlinks; that branch has not been run.

## Control-plane review

The control plane read the full diff of the library, the entry point and the README, and checked the test file's deletions (only inside its own `mktemp -d` folder, removed by a trap).

Gates rerun in Git Bash:

| Gate | Result |
|---|---|
| `bash -n bin/aisandbox-backup`, `bash -n lib/ops-lib.sh` | exit 0 |
| `tests/regression/backup-retention.sh` | `passed=115 failed=0` |
| the 27 existing `tests/regression/*.sh` and `tests/static/*.sh` | all pass, last lines identical to the baseline on main at 888b94f (for example `T2.6 PASS`, `T4.4 PASS`, `passed=13 failed=0`, `regression pass=63 fail=0`) |
| after the fast-forward on main | `backup-retention.sh` `passed=115 failed=0`, `T2.6 PASS`, syntax ok; LF only in all four files |

The worktree and branch were removed. Files on main:

| File | SHA-256 |
|---|---|
| `ops/clean-baseline/lib/ops-lib.sh` | `d9eada27404d66633ae07901c4f14862a259e595d2767da353f4750fa6f1d904` |
| `ops/clean-baseline/bin/aisandbox-backup` | `d537b9913d10ef1dc37e65b585c820cd033ae9309993838225ed56f72968a730` |

**Left for Keith:**
- The worker was refused permission to remove a probe folder it made, `C:\Users\knlee\AppData\Local\Temp\tmp.eOpa59iMiT` (an empty directory and its copy). The control plane does not remove it either.

## Follow-ups

- **STAGING-DEPLOY-BACKUP-01** (registered):
  - install the two files on staging together (the new entry point with the old library would stop with exit 127 after a successful backup);
  - a read-only before-listing that also shows whether either backup root is a symlink, and why 15 sets were present;
  - check the next nightly run's deletions.
- **BACKUP-RETENTION-02** (registered, optional):
  - an age cap for the `records/deploy-<ts>` directories, which hold operation records and are never pruned;
  - an age cap for the newest 7 nightly sets if backups stop for weeks.
- **Superseded:**
  - the symlinked-root check, by the STAGING-DEPLOY-BACKUP-01 before-listing;
  - pre-migration bundles going at 28 days while their local sets go at 30 days, by Keith's 30-day decision (all copies are under 30 days; no remainder);
  - whether the C3 acceptance set 20261029T040824Z on Keith's PC is kept beyond 30 days, by a note on ACCESS-READY-01 (Keith's open question).

CHECKLIST: EVERY 11/11 (1: admitted 888b94f; 2: 3-step; 3: opus, data deletion; 4: self-contained brief, no further subagents; 5: four files inside the write set, t2.6 unchanged, no dependency; 6: new test with 115 checks; 7: gates rerun by the control plane; 8: no runtime started; 9: no artifact changed; 10: worktree, fast-forward by the control plane, worktree and branch removed; 11: FOLLOWUPS line), BACKEND n/a (ops scripts only, no service source)
FOLLOWUPS: 2 registered (STAGING-DEPLOY-BACKUP-01; BACKUP-RETENTION-02) / 3 superseded (symlinked-root check by STAGING-DEPLOY-BACKUP-01; pre-migration bundles at 28 days by Keith's 30-day decision; the C3 set question by an ACCESS-READY-01 note) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- the HOTFILE leases released;
- staging is unchanged: it still runs the old backup script until STAGING-DEPLOY-BACKUP-01.
