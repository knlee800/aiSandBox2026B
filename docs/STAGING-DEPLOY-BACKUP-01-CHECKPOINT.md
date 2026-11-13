# STAGING-DEPLOY-BACKUP-01 — Checkpoint

**Task:** STAGING-DEPLOY-BACKUP-01 — Install the backup retention change on staging
**Status:** COMPLETE AND LOCKED — 2026-11-13. Result: passed.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutex:** STAGING.
**Source:** registered 2026-11-13 by the BACKUP-RETENTION-01 LOCK (07d95c1); admitted 161fdff after Keith approved the install ("Yes, install it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 161fdff |
| 2. Install and nightly check | from the host; evidence in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-BACKUP-01\` | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Install (2026-11-13, about 01:50 UTC)

Script `backup1-install.sh` (SHA-256 `8ae748fde967b6f38c37795444479aac2738d7ff84a613cc18dfb8766f9a7d58`), run once on ainow-staging-01 (machine id checked) after a hash check of the script and of both uploaded files. Before installing, it checked that no ops-test-mode marker or maintenance marker was present, that no backup was running, and that every installed file had the expected old hash. It took the operations lock while replacing the files.

| Installed file | Before | After |
|---|---|---|
| `/usr/local/lib/aisandbox/ops-lib.sh` | `3f380d7c…` | `d9eada27404d66633ae07901c4f14862a259e595d2767da353f4750fa6f1d904` |
| `/usr/local/lib/aisandbox/clean-baseline/lib/ops-lib.sh` | `3f380d7c…` | `d9eada27…` |
| `/usr/local/sbin/aisandbox-backup` (the service's ExecStart) | `fd645d78…` | `d537b9913d10ef1dc37e65b585c820cd033ae9309993838225ed56f72968a730` |
| `/usr/local/lib/aisandbox/clean-baseline/bin/aisandbox-backup` | `fd645d78…` | `d537b991…` |

The after-hashes equal the repository files on main. Each file kept its mode and owner (644 or 755, root:root) and passed `bash -n`. No service was restarted, and no application code was deployed. The backup timer stayed enabled and active.

**Exit 141:** the script stopped after the install and the after-checks, with rc 141. The cause was SIGPIPE from `systemctl list-timers … | head -2` under `pipefail`, so its last two steps did not run: the UNITS line and removing the two uploaded files from /tmp. A follow-up ssh removed them (`LEFT IN TMP: 0`), confirmed the four application units were active, and confirmed the two main installed hashes again (`backup1-after.out`). Nothing else was affected. The script was evidence-only and is not in the repository.

## Before-listing (read-only, same run)

- **Backup roots:** `/var/backups/aisandbox` and `/var/backups/aisandbox-offhost` are plain directories, not symlinks.
- **The 15 sets** were 7 nightly sets plus 8 pre-migration sets (2026-11-02 to 2026-11-11). The old rule kept the newest 7 nightly sets and deleted pre-migration sets only after 30 days, so all 15 were within the policy. PRIVACY-HOST-CHECK-01 reported "15 sets kept"; the kinds explain the number.
- **`records/`** holds 74 entries, which are never pruned (BACKUP-RETENTION-02, optional).
- **Off-host bundles:** 23 `.tar.age` bundles and 23 `.identity` files, with no partial files, links or other names. The oldest is 20261029T040824Z (15 days); the newest is 20261112T033009Z. None was older than 28 days.

**Correction:** PRIVACY-HOST-CHECK-01 (locked) reported "46 off-host encrypted bundles". That count included the `.identity` files; there were 23 bundles. In chat, the control plane also told Keith that the first nightly run would delete about 18 bundles. That was wrong: no bundle is old enough until about 2026-11-26, when 20261029T040824Z passes 28 days. The locked checkpoint is not edited, and the correction is recorded here and in the backlog.

## Nightly run check (2026-11-13, 03:36 UTC)

Script `backup1-check.sh` (read-only; SHA-256 `3439ae3654f56ea2ce200a05dfd2bc3ff1717b4f27063aaec3537cac96c5ee8f`), output `backup1-check.out`:

- `aisandbox-backup.service` result success, exit 0.
- The journal shows the backup completed (20261113T033017Z), then `retention deleted nightly set 20261106T033032Z`, then the summary `retention deleted 1 (nightly sets 1, pre-migration sets 0, failed sets 0, off-host bundles 0, identity files 0)`.
- Left: 7 nightly sets (20261107 to 20261113) and 8 pre-migration sets; 24 bundles and 24 identity files, oldest 20261029T040824Z, newest 20261113T033017Z.
- All four application units are active.

That is exactly what the new rules predict for today. The old script would also have deleted the oldest nightly set; the new one deletes nothing more until a pre-migration set passes 30 days (the 2026-11-02 set, about 2026-12-02) or a bundle passes 28 days (about 2026-11-26).

## Configuration check (03:36 UTC, read-only)

- `/etc/aisandbox/gateway.env` is `e07672862e84e00493d1864cb9c18f05a2f1b9129557c7412b3ad9590bd0944a` and `/etc/caddy/Caddyfile` is `205770cfa1043312d749dbf9e0b31ebc94d2c8b5a0ed6c703c18639042342ba8`. These are the baselines.
- The other env files (ai, cm, frontend, watchdog) were last modified 2026-10-26, and DEPLOYED was last modified at the 2026-11-12 aa0b32a deploy.
- The install did not record config hashes before it ran. It wrote only the four ops files above, and the after-state shows nothing else changed. Runs stay off; staging still runs aa0b32a.

All outputs were scanned for key and password text before saving: none found. Only names, counts and hashes were printed.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only in the repository, host changes limited to the four ops files; 8: no local runtime), DEPLOY 7/7 (1: STAGING held; 2: gateway.env and Caddyfile at the baselines after, with no before-hash check in the install script, recorded above, and only the four ops files written; 3 and 7: n/a, tester window closed; 4: no backup running and the expected old hashes before; afterwards the expected new hashes, units active, no migration, no restart, DEPLOYED unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED, with stagingAuthorized false;
- staging runs aa0b32a with the new backup pruning installed; runs off.
