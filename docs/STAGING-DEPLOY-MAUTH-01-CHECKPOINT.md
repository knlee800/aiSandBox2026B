# STAGING-DEPLOY-MAUTH-01 — Checkpoint

**Task:** STAGING-DEPLOY-MAUTH-01 — Deploy the refused mail sign-in state
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME.
**Mutexes:** STAGING. ENV was registered but dropped at admission, because there is no env change.
**Source:** registered 2026-11-18 by the CONN-MAIL-AUTH-STATE-01 LOCK. Keith approved the deploy on 2026-11-18 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 11cf987 |
| 2. Deploy and host checks | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (mauth-deploy.sh, started 2026-11-18T08:51:12Z, rc 0 at 08:53:54Z)

355e6db to 11cf987 with aisandbox-deploy. 11cf987 is the admission record on top of the CONN-MAIL-AUTH-STATE-01 code (dd65e81, 13bad2b, 15b390c) and lock (ae68be5). It touches connectors-mcp, the gateway, ai-service and the frontend.

**Before:**
- HEAD and DEPLOYED at 355e6db;
- migration hash 0f91cfda;
- configuration files at the baseline;
- GLOBAL_EXECUTION_ENABLED false; no executions or runs open.

**After:**
- HEAD and DEPLOYED at 11cf987.
- Migration hash 0f91cfda → 8b3e6e32. The latest migration row is AddConnectorSignInRefusedAt1815000000000.
- `connector_connections.sign_in_refused_at` is a nullable timestamptz; 0 of the 2 connections are marked refused.
- Configuration files unchanged (gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf).
- Flags unchanged: runs, schedules, the run-result tool and every trigger switch off; Discord on.
- Every earlier deploy check passed, including the five-tool connector child.

**New checks:**

| What | Files containing it |
|---|---|
| connectors-mcp refused text | 3 |
| gateway 409 reconnect text | 2 |
| gateway Verify text | 2 |
| ai-service pass-on text | 3 |
| gateway column | 2 |
| frontend en warning | 5 |
| frontend zh-TW Verify error | 5 |
| frontend zh-CN paused text | 5 |
| frontend warning test id | 4 |

There were 0 connector audit rows since the deploy.

**The script** is the MREAD deploy script with:
- the new target and run folder;
- the migration check changed to expect 1815;
- the new lines above.

It passed a syntax check. No key text appears in any output.

## Host after-check (mauth-after.out)

- The five trigger lists are the same as before the deploy.
- No audit rows and 0 runs since the deploy; 0 open runs.
- Env files are at the baselines (616841ca, 721f4772, 205770cf).
- GLOBAL_EXECUTION_ENABLED and every trigger switch are false.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-MAUTH-01/`. `mauth-after-template.sh` is the unchanged MREAD after-check that `mauth-after.sh` was made from.

| File | SHA-256 |
|---|---|
| `mauth-deploy.sh` | `566f57f2feeb0bde38a6b16ebd713569b007870e1b69c9bcb881b9d9a3ba037b` |
| `mauth-deploy.out` | `80fd769c3eb44a46eaaa3d82288f74a5f4b787a11f67bedaebd3a2aed8031bd7` |
| `mauth-after.sh` | `36b4d982058a290b0c8d855ff32cdb438e59aeeb057fd450368b51c149660930` |
| `mauth-after.out` | `6867f58e4f100db623fd7bb3f3294d043f7ee9152296228b51908dc37b215010` |
| `run.sh` | `e92640714a7baa42ddd1d7fb303e1dc1cb917b1b7b4c90f3007174f79f0f85e2` |

`mauth-after.out` has the same hash as `mread-after.out`: the after-state is byte for byte what it was after the previous deploy.

## Limits

- No mailbox sign-in and no run were started. Everything that needs a refused password, Verify, the timer or a run is MAIL-AUTH-LIVE-01, which Keith approves.
- The pages changed, but nothing shows until a connection is marked refused, so there was no page check here. The warning line and the paused text are checked in MAIL-AUTH-LIVE-01.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; the deployed code was gated in CONN-MAIL-AUTH-STATE-01; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files at the baselines before and after; 3 and 7: n/a, tester window closed; 4: nothing open before or after, DEPLOYED and migration hash as expected (1815 applied), health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs scanned for key text, none)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (MAIL-AUTH-LIVE-01 and GOV-ARCH-MAIL-AUTH-01 were registered by CONN-MAIL-AUTH-STATE-01).

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false;
- staging runs 11cf987, with runs and every trigger switch off.
