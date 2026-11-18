# STAGING-DEPLOY-TGTOFF-01 — Checkpoint

**Task:** STAGING-DEPLOY-TGTOFF-01 — Deploy the switched-off target warnings, and Keith checks the trigger sections
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed (deploy and Keith's check).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING.
**Source:** registered 2026-11-17 by the TRIGGER-TARGET-OFF-01 LOCK. Keith approved the deploy on 2026-11-17 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | e759b9c |
| 2. Deploy and Keith's check | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (tgtoff-deploy.sh, rc 0 at 2026-11-17T15:46:03Z)

0427246 to e759b9c with aisandbox-deploy. e759b9c is the admission record on top of 8f31d2b, so the deployed code is TRIGGER-TARGET-OFF-01 (c1f641f, 29f4043), frontend only. The admission text named 8f31d2b; the script was regenerated for e759b9c so that DEPLOYED equals main.

**Before:**
- HEAD and DEPLOYED were at 0427246;
- the configuration files were at the baseline;
- GLOBAL_EXECUTION_ENABLED was false; no executions or runs were open;
- the ops library was at the expected version.

**After:**
- HEAD and DEPLOYED were at e759b9c;
- the migration hash was unchanged at 0f91cfda;
- the configuration files were unchanged (gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf);
- the flags were unchanged; runs, schedules, the run-result tool and every trigger switch were off; Discord was on;
- every earlier deploy check passed.

**New check:** the frontend build has the en switch-on notice (5 files), the zh-TW and zh-CN switched-off notes (5 each), the form warning test id (4) and the chain both-off key (9).

The `curl: (7) Failed to connect` lines in the output are the services restarting during the deploy; the health checks after it passed. No key text appears in any output.

## Host check of the target status (tgt-check.out, before Keith's check)

Each of the five trigger lists answers its target: schedules a70a13ef, 7669d295 and e0947451 (Chief of Staff) and e25df6cc (workflow ab4cb6ae, the switched-off 每週客戶回饋摘要); event 04bff22d, mail 67de1802 and 1deb884c, knowledge c6d6dce2, chain 5f1793e3 (Chief of Staff). 0 open runs; env files at the baselines; all six switches false. Its audit query used a wrong column name (`action`; the table has `event_type`) and failed; the after-check corrected it.

## Keith's check (2026-11-18, "All looked right")

On the Schedules page:
- the existing schedule e25df6cc, which starts the switched-off 每週客戶回饋摘要, showed the amber line;
- a test trigger in the After a workflow finishes section with 每週客戶回饋摘要 as its target showed the form warning with Save available, the row line once saved, and the amber notice on switch-on;
- the texts in 繁體中文 and 简体中文.

**Host after-check (tgt-after.out):**
- the five trigger lists are the same as before his check (the test trigger is gone);
- audit since the deploy: chain_trigger_created 1, chain_trigger_updated 4, chain_trigger_deleted 1;
- 0 runs since the deploy and 0 open runs;
- env files at the baselines (616841ca, 721f4772, 205770cf);
- GLOBAL_EXECUTION_ENABLED and every trigger switch false.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-TGTOFF-01/`.

| File | SHA-256 |
|---|---|
| `tgtoff-deploy.sh` | `f1c59ca148bdddeb4b2441598681169c991bdb236c911fd954dba66445c802ee` |
| `tgtoff-deploy.out` | `65303014b33a717cede8bfb7d7208d8eecffb4bfbdbdfea6ac5632faf827bfe7` |
| `tgt-check.sh` | `fdc49c84cf4dfbad54fa6d851a0e7a1636adfd56f76a62670fd4b1063583ba17` |
| `tgt-check.out` | `5417e719b931af113b1c583a9017ca8749de11f45b56e2bd33be8c237c795eec` |
| `tgt-after.sh` | `eaa00e3b34e75c7371c0bdd71d70849eea6c8ece50a5d0cb8dd10511fb83d87b` |
| `tgt-after.out` | `944664478cc62b1a15ccb7494398f0c7640d8b090e79be5b7688310d042b6739` |
| `run.sh` | `eebfce7d845b28047a446a51127e91d08258ca342cc9359622d4cffcb3744e66` |

## Limits

- Keith tested the form and switch-on in one trigger section (the chain section); the schedule, event, mail and knowledge sections use the same code and were covered by the tests and the existing schedule's row line.
- Phone width was left to Keith and not separately reported.
- Runs and every trigger switch stay off, so the run-time refusal was not exercised.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code, the deployed code was gated in TRIGGER-TARGET-OFF-01; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files at the baselines before and after; 3 and 7: n/a, tester window closed; 4: nothing open before or after, DEPLOYED and migration hash as expected, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs scanned for key text, none), UI 9/9 for the live part (item 9: Keith's check passed; items 1 to 8 were met in TRIGGER-TARGET-OFF-01)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false;
- staging runs e759b9c, with runs and every trigger switch off.
