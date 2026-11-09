# OLD-HOST-RETIRE-01 — Checkpoint

**Task:** OLD-HOST-RETIRE-01 — Delete the stopped old staging instance and its historical snapshots
**Status:** COMPLETE AND LOCKED — 2026-11-09
**Nature:** GOVERNANCE / EVIDENCE; no lane. **Lifecycle:** 2-STEP.
**Record:** registered a3dd824 (2026-11-09); Keith granted AUTH-9 in chat ("AUTH-9 yes", recorded in 3177e1f) for exactly the scope below, after the deletion list, the kept archival snapshots and the irreversibility were stated; the console run in Keith's signed-in Lightsail (account 002559670476, ap-southeast-1), through a Cursor desktop prompt and by Keith's hand, on 2026-11-09; this record locks it. This closes D of CLEAN-BASELINE-DEPLOY-01 (docs/CLEAN-BASELINE-DEPLOY-01-CHECKPOINT.md:64) before the day-30 date of 2026-11-25, as the consolidated plan section 6.D-ret allows.

## What happened (times UTC+8)

| Step | Result |
|---|---|
| 1. Before-state, 15:12 | aisandbox-staging Stopped, no public IPv4, no static IP; ainow-staging-01 Running with 18.136.141.186. The log records a first stop before this retry |
| 2. Archival snapshots, 15:20 to 15:21 | aisandbox-staging-archive-20261026 (2026-10-26 10:43) and aisandbox-staging-archive-stopped-20261026 (2026-10-26 13:04) listed, plus the 13 historical ones |
| 3. Instance deleted, 15:30 to 15:31 | "Successfully deleted the instance aisandbox-staging in the Singapore (ap-southeast-1) Region"; at 15:32 the Instances page shows only ainow-staging-01, Running, 18.136.141.186. Its seven automatic snapshots went with it |
| 4. 13 historical manual snapshots deleted, 15:35 to 15:39 | aisandbox-staging-pre-identity01-20260909 by the Cursor session (dialog seen); the other 12 by Keith in the console after the session paused (no per-dialog times); no NOT FOUND, no STOP |
| 5. After-state, 15:42 | The aisandbox-staging snapshot group shows exactly 2 instance snapshots, the two archival ones; no automatic snapshots remain |

The control plane viewed after-instances.png and after-snapshots.png and they match the log.

**Health after the run, from the staging host (read-only, 2026-11-09):** machine id ec2494e33db4dcf7b6be5fc3b3d9a22b; gateway /api/health/ready 200; https://staging.ainow.biz/ 401 (basic_auth, as expected); aisandbox-gateway, aisandbox-ai, aisandbox-cm, aisandbox-frontend and caddy active.

## Evidence (C:\Users\knlee\aisb-preflight\OLD-HOST-RETIRE-01\)

| File | Bytes | SHA-256 |
|---|---|---|
| run-log.md | 4500 | 30fdb7792134fb39bbd8e21543dd18ec53cdd594296e6159b8d1977d300e65f6 |
| before-instances.png | 706741 | 4e74bcf373706569d4f29d1f34825ec52ef549d1061ebfcbcf8793645ce47c65 |
| before-snapshots.png | 260438 | 9e1451fc1a86f29a17c4613b302a3e58043f14ed4383513c4cc3c6254e2e763c |
| before-snapshots-2.png | 276511 | 13cd99e490afc9ed0052f9fe7a07a40b5d241bfec33d6e2f2e9e6ff720b61a74 |
| after-instances.png | 181423 | c49b1130cebfa3bdede8809c4b42ddabe32472cba3d5bee3e471646db4905acc |
| after-snapshots.png | 186725 | 657677627510c48fb949131a75654aeaed7ab18afeb9dfa8d02c4f8e03885328 |

Names, times and screenshots only; no key or secret.

## Kept

The two archival snapshots stay as the only preservation copy (plan S3: keep 90 days, then review). Review date: 2027-01-24, listed in docs/AGENT-OPS-PLAN.md section 0 as an ops item. The old .env copies are gone with the 13 historical snapshots; the archival snapshots were taken from the same host, so they may also hold the old .env.

CHECKLIST: GOVERNANCE (record writes held GOVERNANCE only while writing; no OS rule changed), EVERY 1 (Keith's AUTH-9 before the run), 10 (no worker git), 11 (follow-up below disposed); DEPLOY 5 and 6 (host check from the staging host; no secret printed); the other EVERY, DEPLOY and BACKEND items are n/a: no code, build, migration or deploy.
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered as a plan section 0 ops item: review the two archival snapshots on 2027-01-24)

## Lock

COMPLETE AND LOCKED on 2026-11-09 by the control plane. aisandbox-staging no longer exists; it is no longer billed.
