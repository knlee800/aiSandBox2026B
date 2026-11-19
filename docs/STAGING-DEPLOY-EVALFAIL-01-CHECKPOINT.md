# STAGING-DEPLOY-EVALFAIL-01 — Checkpoint

**Task:** STAGING-DEPLOY-EVALFAIL-01 — Deploy the chain-failed eval case
**Status:** COMPLETE AND LOCKED — 2026-11-19. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING.
**Source:** registered 2026-11-19 by the COS-EVAL-FAILCHAIN-01 LOCK. Keith approved the deploy on 2026-11-19 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 8d6b499 |
| 2. Deploy and host checks | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (ef-deploy.sh, started 2026-11-19T01:44:29Z, rc 0 at 01:46:43Z)

The deploy took d6530ad to 8d6b499 with aisandbox-deploy. 8d6b499 is the admission record on top of:
- COS-EVAL-FAILCHAIN-01: the chain-failed briefing eval case and its scoring;
- COS-EVAL-FAILCHAIN-TIDY-01: the failure request moved and the live report fields.

Both are ai-service eval code only.

**Before:**
- HEAD and DEPLOYED at d6530ad;
- migration hash c32f099c;
- configuration at the baseline;
- runs off, nothing open.

**After:**
- HEAD and DEPLOYED at 8d6b499.
- No migration: the hash stays c32f099c, and the latest migration row is still AddChainTriggerFiresOn1816000000000.
- Configuration unchanged (gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf).
- Runs, schedules, the run-result tool and every trigger switch are off; Discord is on.
- Every earlier deploy check passed.

**New and changed checks:**

| What | Result |
|---|---|
| Briefing case files in the checkout (expect 13; was 12) | 13 |
| `chain-failed-explain.json` in the checkout | 1 |
| The cause phrase list in the ai-service build | 3 files |
| The failure request in `briefing-instructions.js` | 1 |
| The old `briefingCaseOwnerRequest` left in the eval build (expect 0) | 0 |
| The live report's `causeClaims` field | 1 |
| Chain triggers whose `fires_on` is neither completed nor failed (expect 0) | 0 of 1 |
| Connector audit rows since the deploy | 0 |

**The chain-trigger check was widened.** The last deploy checked that every chain trigger reads `completed`. Keith's trigger 5f1793e3 now reads `failed`, so the check now counts triggers outside the two allowed values.

The script is the CHAINFAIL deploy script with:
- the new target, previous sha, migration hash and run folder;
- the migration check changed to expect no migration;
- the case count at 13;
- the lines above.

It passed a syntax check. No key text appears in any output.

## Host after-check (ef-after.out)

- Trigger lists unchanged.
- No audit rows and 0 runs since the deploy; 0 open runs.
- Env files at the baselines.
- Runs and every trigger switch off.

The output is byte for byte the same as after the previous deploy (both hash 6867f58e).

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-EVALFAIL-01/`. The scripts were made by `mk_def.py` in the control plane's scratchpad, with each change asserted. `ef-after-template.sh` is the unchanged after-check that `ef-after.sh` was made from (only the deploy time changes).

| File | SHA-256 |
|---|---|
| `ef-after-template.sh` | `b8992bdfe767bba6dc2971b95233105a723127f94ac8030c587c03f7fc0b1e50` |
| `ef-after.out` | `6867f58e4f100db623fd7bb3f3294d043f7ee9152296228b51908dc37b215010` |
| `ef-after.sh` | `f5c9a10d6b96830d4e2780a7d2152f0ca51d237bdbbf0610eeeaea1c70610863` |
| `ef-deploy.out` | `d91444284d49be39ebadc807748254b50a1acdb4ca3f70a0e5224310f8cb429c` |
| `ef-deploy.sh` | `474482d251e030fe711d7b8e6106c1f0d502e4fd58721bf6f933af7554cee098` |
| `run.sh` | `3903af643397630f5ee03a0d519030f307b1b25c99822958c7157bb168b00feb` |

## Limits

No eval run happened. Whether the real model passes the new case is COS-EVAL-LIVE-04, which Keith approves.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 5/5 + 2 n/a (1: STAGING held; 2: env hashes checked against the baselines before and after, no tester window open; 3 and 7: n/a, no tester window; 4: nothing open before, DEPLOYED sha and the unchanged migration hash as expected, health and guard checks passed, configuration unchanged; 5: every step from the staging host; 6: no secret printed, every output scanned for key text)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-19 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false.

Staging runs 8d6b499, with runs and every trigger switch off. The next step is COS-EVAL-LIVE-04, which Keith approves.
