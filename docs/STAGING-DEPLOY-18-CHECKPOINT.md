# STAGING-DEPLOY-18 — Checkpoint

**Task:** STAGING-DEPLOY-18 — Deploy the clear Reject (COLLAB-REJECT-UX-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by COLLAB-REJECT-UX-01; Keith said deploy now on 2026-11-08, after being told that runs pause for a few minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | 563091fd76ab0b1ff178814b938df711c6ec74f7 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd18-deploy.sh)

Pre-check (read-only): staging at e28e4a7, migration hash cbd04277..., 0 active runs, 0 open hand-offs, 0 running executions, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing active or running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed 563091f (18:04:10 to 18:06:24 UTC on the host clock, exit 0), which holds COLLAB-REJECT-UX-01 (c0b317d), a frontend change; no migration. After it: HEAD and DEPLOYED are 563091f, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 22 guard checks 401 without a key, the static test key refused with 403, CORS unchanged.

After-check (read-only): the ended-after-a-rejection line is in the frontend build (4 files), rejectPrompt is in en.json, runEndedByReject is in zh-TW.json, cancelReject reads Don't reject, the Team page answers 200, nothing active or running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-18/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2313 | `6223e961e6752bf3ef63bb04564f5d8e20929f413a87f6701cf3efa1097249c1` |
| `cursor-admission-result.json` | 3315 | `3b684005386ed0076d06d9402d06ad97b4838dc8c3ba341d2ef6415f89b081e3` |
| `sd18-pre.sh` | 1919 | `98044d58e13577399b3606a3df8e7a3ee60c9f6b1243f47645f64fe6e993e9af` |
| `sd18-pre.out` | 1647 | `f5f0d587ede94fdefdf49f32eb050e9a3c8ceea84ecf06a089c35d4adb6054f2` |
| `sd18-deploy.sh` | 11783 | `d58d435e242400d8ce1df4ddcb3977376ac3243486e9df76a85e0946c3ece87b` |
| `sd18-deploy.out` | 8339 | `a48e2796477525358f2d76376cff53cfa576919750f0003c8312e3a401e19209` |
| `sd18-after.sh` | 1246 | `b100335bf64b81735dff906a100a90e57566e4c102ecc85a586042d9a7efbabe` |
| `sd18-after.out` | 467 | `73f688a867f5df3663e625c60a33fa765e889f65a935fa71adccd2af238fb348` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith's own use of the new Reject on the Team page is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 563091f.
