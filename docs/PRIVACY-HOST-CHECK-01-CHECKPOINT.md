# PRIVACY-HOST-CHECK-01 — Checkpoint

**Task:** PRIVACY-HOST-CHECK-01 — Answer the privacy inventory host questions on staging (read-only)
**Status:** COMPLETE AND LOCKED — 2026-11-12. Result: **passed**.
**Workstream:** CORE. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-12 by the PRIVACY-INVENTORY-01 LOCK. Keith asked for it ("Yes, run it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING (read-only); stagingAuthorized true | 626d96b |
| 2. Host check | `privhost.sh`, read-only, from the staging host at 2026-11-12T14:24:29Z on aa0b32a | no change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

The script printed names, counts and settings only:
- a value only for non-secret switches (`EMAIL_PROVIDER`, `STRIPE_PROVIDER_MODE`, `AI_PROVIDER`, `GLOBAL_EXECUTION_ENABLED`, `PROVIDER_*_ENABLED`);
- keys only as set, empty or absent.

It changed nothing: no deploy, no restart, no file written outside `/tmp`. The output was scanned for key and password-hash patterns, and none was found.

## Answers (numbers follow docs/PRIVACY-DATA-INVENTORY.md section 5)

| # | Question | Answer from the host |
|---|---|---|
| 1 | Disk encrypted at rest? | One disk (`nvme0n1`, 160 GB, ext4 root) on an Amazon EC2 t3.large holds PostgreSQL, workspaces, backups, Redis and Docker. **No OS-level encryption** (no device-mapper crypt). Whether the cloud volume is encrypted is not visible from the host: **Keith checks the cloud console** |
| 2 | Redis on disk? | Yes: RDB snapshots in `/var/lib/redis/dump.rdb` (30,901 bytes at the time). Append-only off. A password is set; bound to 127.0.0.1 and ::1 only; protected mode on. Same disk as question 1 |
| 3 | PostgreSQL and Redis loopback only? | Yes. 5432, 6379, 3002 and 4000 to 4002 listen on loopback only. Only Caddy (80, 443) listens publicly |
| 4 | Old SQLite `conversations` rows? | `/opt/aisandbox/database/aisandbox.db` (60 KB) is **container-manager's** file. Its tables are `checkpoints` (64), `governance_events` (11) and `sessions` (66). **There is no `conversations` table**, so the inventory's guess was wrong; recorded on ACCESS-READY-01. It is still written (modified 14:16 that day) |
| 5 | Where is the snapshot store? | `/opt/aisandbox/services/snapshot-store`: 116 files, 18 MB. The other two candidate paths are absent |
| 6 | Nightly backup running? | The timer is enabled and active: last run 03:30 UTC, next 03:30. **15 sets** in `/var/backups/aisandbox` (2026-11-02 to 2026-11-12, 187 MB). No pre-migration sets |
| 7 | Off-host bundle retention? | **46 encrypted bundles** (`.tar.age`) in `/var/backups/aisandbox-offhost`, from 2026-10-29 to now (204 MB). **Never pruned.** The `.identity` files beside them hold only metadata (commit, uid and gid, bundle hash), no key. Already part of ACCESS-READY-01 (c) |
| 12 | Logs: where and how long? | The systemd journal is persistent (`/var/log/journal`), 201 MB, oldest entry 2026-10-26 (the host's start). journald has default settings, so a size cap and no time limit. No aisandbox log files under `/var/log` |
| 13 | Caddy access logs? | **None.** The Caddyfile has no log directive, and the journal has no access-log lines in 7 days |
| 14 | Who has SSH and root? | Only `ubuntu`, with **one** authorized key; root has none. No password logins; root login allows keys only. `ubuntu` is the only sudo-group member (cloud-init sudoers). Login shells: root, sync, ubuntu, postgres |
| 15 | Who can read the env files? | All six (`ai`, `cm`, `frontend`, `gateway`, `watchdog`, Caddy operator) are mode 600, owner root:root, so root only |
| 16 | Admin role holders? | 3 users in all: **1 admin**, 2 users (counts only) |
| 19 | Provider keys and switches | `gateway.env` has `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` set; xAI, Groq and DeepSeek are absent. `ai.env` holds no provider key. **Every `PROVIDER_*_ENABLED` is false**, `AI_PROVIDER=stub` and `GLOBAL_EXECUTION_ENABLED=false`, so nothing is sent to any provider today |
| 22 | Email provider | `EMAIL_PROVIDER=stub`; no Resend key, so no email leaves the host |
| 23 | Google or Apple sign-in | No `GOOGLE_*` or `APPLE_*` variables |
| 24 | Stripe | `STRIPE_PROVIDER_MODE` unset; no Stripe key names |
| 25 | Container network reach | Session containers are on the default `bridge` network, which is not internal. **They can reach the internet** (an HTTPS request from a running session container succeeded). **They cannot reach** the host's PostgreSQL, Redis or service ports (5432, 6379, 4000 to 4002 closed from the container) |

## Questions only Keith can answer

| # | Question | What the control plane knows |
|---|---|---|
| 1 | Is the cloud volume encrypted at rest? | Check the instance's disk in the cloud console |
| 8 | Off-host copies: where, how often, how long kept? | The control plane copies a weekly bundle to `C:\Users\knlee\aisb-backups\` on Keith's PC (next about 2026-11-19). How long those copies are kept is Keith's choice |
| 9 | Who holds the `age` private key? | Keith, in his secret store and `C:\Users\knlee\aisb-secrets\` (from the backup setup records). Never read by the control plane |
| 10 | Cloud snapshots? | The old instance was deleted 2026-11-09, with archival snapshots kept for review on 2027-01-24. Current snapshots: check the console |
| 11 | Intended backup policy? | The script keeps 7 nightly sets (15 present today), 30-day pre-migration sets, and never prunes off-host bundles. The older document says 30 days daily and 1 year weekly. Keith chooses; the choice goes into ACCESS-READY-01 data retention |
| 14, 17, 18 | Who holds the SSH key, the basic_auth password and the console logins? | The one SSH key is the control plane's key on Keith's PC. The rest is Keith's to list |
| 20, 21 | Provider terms: training, retention, region, zero-retention; how long `store: true` responses are kept | From Keith's Anthropic and OpenAI accounts. Only these two keys are set, and both providers are switched off |
| 26 | Should the usage ledger keep AI answer text? | Keith decides; recorded on ACCESS-READY-01 (a) |
| 27 | Which regions' users come first? | Keith decides; a lawyer later says which rules apply |

Evidence in `C:/Users/knlee/aisb-preflight/PRIVACY-HOST-CHECK-01/`:

| File | SHA-256 |
|---|---|
| `privhost.sh` | `dacd80f8cd9479d9f641814df20224805eea19848c0ec069690bff169073d2f0` |
| `privhost.out` | 127 lines; scanned, no key or password-hash text |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (applied to a host task: 1: STAGING held read-only, ENV not held and not changed; 2: no configuration change; 3 and 7: n/a, tester window closed; 4: nothing deployed or restarted; 5: from the host; 6: output checked for key text; values printed only for non-secret switches)
FOLLOWUPS: 0 registered / 1 superseded (the SQLite file correction, by an ACCESS-READY-01 note) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-12 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED, with stagingAuthorized false;
- staging unchanged at aa0b32a, and runs are off.
