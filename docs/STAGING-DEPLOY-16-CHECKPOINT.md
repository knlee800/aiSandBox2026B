# STAGING-DEPLOY-16 — Checkpoint

**Task:** STAGING-DEPLOY-16 — Deploy the one-start Team page (COLLAB-START-ONCE-01) during the tester window, with KNOW-SCOPE-UX-01
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by COLLAB-START-ONCE-01; KNOW-SCOPE-UX-01 added at its LOCK; Keith said deploy now on 2026-11-07, after being told that runs pause for a few minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | 66efb5c0aa56e6841a2e93c7fdf65f76aaa38555 |
| 2. Pre-check and deploy | host blocks run by the control plane; first attempt refused by the host tool, second attempt passed | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

Pre-check (read-only, sd16-pre.sh): staging at 8a723bf, migration hash cbd04277..., env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, units active, no running executions, but 2 collaboration runs active with 2 hand-offs waiting for approval: Keith's extra advisors runs from 10:09:03 and 10:09:18 UTC (the double-start that COLLAB-START-ONCE-01 fixes). Its informational tester query failed on a type mismatch and printed nothing.

First attempt (sd16-deploy.sh, 11:21 UTC): Keith chose to leave the two waiting runs; the script's own drain check was changed for that attempt to count approved or running hand-offs instead of active runs. It saved the window gateway.env, switched runs off (gateway ready 200, nothing started) and called aisandbox-deploy, which refused at its own quiescence check because of the two active runs (exit 11, its standard post-start text). The script restored the window gateway.env and stopped. State read afterwards (sd16-state.sh): HEAD and DEPLOYED still 8a723bf, tracked tree clean, no maintenance marker, gateway, db and ready health 200, frontend 200, env files at the window hashes, runs back on; only the gateway had restarted (runs off for about 30 seconds). The host guard was not bypassed.

Keith then rejected the two waiting hand-offs on the Team page (12:23 UTC); both runs ended failed. Nothing open: 0 active runs, 0 running executions.

Second attempt (sd16b-deploy.sh, the original drain check, fresh run folder /root/aisb-sd16b): host id, previous commit, clean tree, every configuration file at the tester-window state, the flags (anthropic, email stub, execution on), nothing open or running, ops library; window gateway.env saved, only GLOBAL_EXECUTION_ENABLED switched to false, gateway ready 200, nothing started; deployed 66efb5c (12:49:21 to 12:51:58 UTC, exit 0), which holds COLLAB-START-ONCE-01 (b1cf050) and KNOW-SCOPE-UX-01 (b54e62a), frontend changes only; no migration. After it: HEAD and DEPLOYED are 66efb5c, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages (office, knowledge, collaboration), 20 guard checks 401 without a key, the static test key refused with 403, CORS unchanged.

After-check (read-only, sd16b-after.sh): the start guard is in the deployed Team page source, the Knowledge form scope picker is in the frontend build (4 files), the addingTo key is in en.json, nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-16/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2343 | `c3f03540d4a168dc3812d4a7714f063b1d9301b4ab7853e54e735fa6c26083f0` |
| `cursor-admission-result.json` | 3310 | `b129ee90ab4564352d8679cbdb0d086dbca6d583bd75f9c2d817b00ec6e61c3a` |
| `sd16-pre.sh` | 1919 | `2bf752b323845500e282cb6de8bc6b9b32bdbf3aa782dbc354851834c760ce19` |
| `sd16-pre.out` | 1647 | `d92dfb77e6db4aed1cde8d7e9d0176a9033571c1acca2eb4c28fc4589320771d` |
| `sd16-deploy.sh` | 11871 | `7ed63b5e3942ffb9fe9caf8a3fcfdd79583c95b1557c9f837c7134c17e95deed` |
| `sd16-deploy.out` | 2834 | `6b8a7fbd79533a3862a8d9532bda9259c156416cbd11fc885f7877d0dd2a0097` |
| `sd16-runs.sh` | 551 | `4fec845f39c7785f2e0bcd92e72ab52e3058b2e9418d0d274edf500215af2e2e` |
| `sd16-runs.out` | 509 | `7716661e30188e708fd393d01f3fe0c9748dcd13a0f8775d871633934ed70035` |
| `sd16-state.sh` | 1415 | `9a4bdaa2837bf6b6890cf7adcef7d26a912390b8ff5684e384fa433f28df492c` |
| `sd16-state.out` | 1603 | `f9627f69fa5c13e9db328b739aeb03a4ca5a94a88afeeda87ecadbeadf2fc947` |
| `sd16b-deploy.sh` | 11691 | `505255f3fee30f4d92f087231c161bb3e2661ea3e06ab2d0462a2c780ec1e7d8` |
| `sd16b-deploy.out` | 8338 | `ee3833f9049488c312c1faa87789bb0d67bc7db1e9842ec54ae9e940d82d7f49` |
| `sd16b-after.sh` | 902 | `a09d7b486baaae5f8e02b1eb6aecbe773cec2d5afa16b408508dd80612d26ed4` |
| `sd16b-after.out` | 359 | `7d40c17600700437551c5b999d3d483cf879fd57cc143e732ce1f2da6413a7b4` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith's own check of the two fixes on the Team and Knowledge pages is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for each deploy attempt, window gateway.env restored byte for byte both times)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 66efb5c.
