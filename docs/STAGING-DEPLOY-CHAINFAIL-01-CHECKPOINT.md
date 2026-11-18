# STAGING-DEPLOY-CHAINFAIL-01 — Checkpoint

**Task:** STAGING-DEPLOY-CHAINFAIL-01 — Deploy failed-run chain triggers and the one-minute sweep
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING.
**Source:** registered 2026-11-18 by the TRIGGER-CHAIN-FAILED-01 LOCK. Keith approved the deploy on 2026-11-18 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | d6530ad |
| 2. Deploy and host checks | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (cf-deploy.sh, started 2026-11-18T13:19:17Z, rc 0 at 13:22:17Z)

The deploy took 11cf987 to d6530ad with aisandbox-deploy. d6530ad is the admission record on top of:
- TRIGGER-CHAIN-FAILED-01: the gateway and the frontend;
- RUN-FINISH-EVENT-01: the one-minute collaboration sweep.

**Before:**
- HEAD and DEPLOYED at 11cf987;
- migration hash 8b3e6e32;
- configuration at the baseline;
- runs off, nothing open.

**After:**
- HEAD and DEPLOYED at d6530ad.
- Migration hash 8b3e6e32 → c32f099c. The latest migration row is AddChainTriggerFiresOn1816000000000.
- `agent_chain_triggers.fires_on` is NOT NULL with its CHECK, and the one existing chain trigger reads `completed`.
- Configuration unchanged (gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf).
- Runs, schedules, the run-result tool and every trigger switch are off; Discord is on.
- Every earlier deploy check passed.

**New checks:**

| What | Result |
|---|---|
| Gateway: the failure task text | 1 file |
| Gateway: the `chain_trigger_invalid_fires_on` code | 2 files |
| `collaboration-sweep.constants.js` | sets `60 * 1000` |
| Frontend: "Finishes normally" | 5 files |
| Frontend: zh-TW "來源工作流程" | 9 files |
| Frontend: the choice's test id | 4 files |
| Connector audit rows since the deploy | 0 |

The script is the MAUTH deploy script with:
- the new target and run folder;
- the migration check changed to expect 1816;
- the lines above.

It passed a syntax check. No key text appears in any output.

## Host after-check (cf-after.out)

- Trigger lists unchanged.
- No audit rows and 0 runs since the deploy; 0 open runs.
- Env files at the baselines.
- Runs and every trigger switch off.

The output is byte for byte the same as after the previous deploy.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-CHAINFAIL-01/`. `cf-after-template.sh` is the unchanged after-check that `cf-after.sh` was made from.

| File | SHA-256 |
|---|---|
| `cf-after-template.sh` | `b8992bdfe767bba6dc2971b95233105a723127f94ac8030c587c03f7fc0b1e50` |
| `cf-after.out` | `6867f58e4f100db623fd7bb3f3294d043f7ee9152296228b51908dc37b215010` |
| `cf-after.sh` | `f3f8e0646830f3aa372e8818178bab10e1ee1aae5685d7e733b1dcb27a0b2ce5` |
| `cf-deploy.out` | `ce588c10b38a94bed40a1f7d73cc60bfc1505b49cd80590bf4308f8b4ea4a928` |
| `cf-deploy.sh` | `2ce47f19aac41f0ac0056166ba8daefed823c00ee03ea27a40c0a503484bb8bf` |
| `run.sh` | `ea4b06062d51e775e69599195393e898ef4815d3210b6798130aeaa463d05cd0` |

## Also closed

STAGING-DEPLOY-SWEEP-01 is COMPLETE AND LOCKED as carried by this deploy. Its own scope said the next deploy would carry it. The 60-second sweep is checked in the build above.

## Limits

- No run started. A real failed run starting a failure trigger, the task lines reaching the model, and the page at phone width and in context are all TRIGGER-CHAIN-FAILED-LIVE-01, which Keith approves.
- The one-minute sweep's load on staging is not measured.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code, the deployed code was gated in its tasks; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files at the baselines before and after; 3 and 7: n/a, tester window closed; 4: nothing open before or after, DEPLOYED and migration hash as expected (1816 applied), health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs scanned for key text, none)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed (STAGING-DEPLOY-SWEEP-01 closed as carried; TRIGGER-CHAIN-FAILED-LIVE-01 was registered by TRIGGER-CHAIN-FAILED-01).

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false.

Staging runs d6530ad, with runs and every trigger switch off.
