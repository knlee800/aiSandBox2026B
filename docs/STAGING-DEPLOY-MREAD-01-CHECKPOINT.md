# STAGING-DEPLOY-MREAD-01 — Checkpoint

**Task:** STAGING-DEPLOY-MREAD-01 — Deploy the one-message mail tool
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING.
**Source:** registered 2026-11-18 by the CONN-MAIL-READ-01 LOCK. Keith approved the deploy on 2026-11-18 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 355e6db |
| 2. Deploy and host checks | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (mread-deploy.sh, started 2026-11-18T03:03:49Z, rc 0 at 03:08:08Z)

e759b9c to 355e6db with aisandbox-deploy. 355e6db is the admission record on top of the CONN-MAIL-READ-01 code (2f3c32f) and lock (32f4dfa): connectors-mcp, gateway and ai-service.

**Before:**
- HEAD and DEPLOYED were at e759b9c;
- the configuration files were at the baseline;
- GLOBAL_EXECUTION_ENABLED was false; no executions or runs were open.

**After:**
- HEAD and DEPLOYED were at 355e6db;
- the migration hash was unchanged at 0f91cfda;
- the configuration files were unchanged (gateway.env 616841ca, Caddyfile 205770cf);
- the flags were unchanged; runs, schedules, the run-result tool and every trigger switch were off; Discord was on;
- every earlier deploy check passed.

**New checks:**
- the connector child's tools/list names all five tools, mail_read_message among them;
- the builds carry mail_read_message in connectors-mcp (5 files), withCompanionToolIds in the gateway (3), the ai-service definition (2) and the gateway's not-found text (2);
- no connector audit rows since the deploy (0).

The script is the TGTOFF deploy script with a new target, a new run folder, the five-tool check and the two new lines; it passed a syntax check. No key text appears in any output.

## Host after-check (mread-after.out)

- the five trigger lists are the same as before the deploy;
- no audit rows and 0 runs since the deploy, 0 open runs;
- env files at the baselines (616841ca, 721f4772, 205770cf);
- GLOBAL_EXECUTION_ENABLED and every trigger switch false.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-MREAD-01/`.

| File | SHA-256 |
|---|---|
| `mread-deploy.sh` | `89302dd60f701fc5426be8d57feaebe2b0dabdef4d500559874d7d7cbe7b0f3f` |
| `mread-deploy.out` | `8c2324b7f264479a90d2050ab4bf3b5b09ed8883addc3762c0df713f05243926` |
| `mread-after.sh` | `b8992bdfe767bba6dc2971b95233105a723127f94ac8030c587c03f7fc0b1e50` |
| `mread-after.out` | `6867f58e4f100db623fd7bb3f3294d043f7ee9152296228b51908dc37b215010` |
| `run.sh` | `2ffaec161c09bb30c43bcfaab3a68cf293798d3ce36795ee05cf301bf88a77b5` |

## Limits

- No mailbox was read and no run was started: the read of a real message and a mail-triggered run are MAIL-READ-LIVE-01, which Keith approves.
- No visible change, so no page check.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code, the deployed code was gated in CONN-MAIL-READ-01; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files at the baselines before and after; 3 and 7: n/a, tester window closed; 4: nothing open before or after, DEPLOYED and migration hash as expected, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs scanned for key text, none)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (MAIL-READ-LIVE-01 was registered by CONN-MAIL-READ-01).

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false;
- staging runs 355e6db, with runs and every trigger switch off.
