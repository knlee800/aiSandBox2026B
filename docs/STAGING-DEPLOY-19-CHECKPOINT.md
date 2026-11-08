# STAGING-DEPLOY-19 — Checkpoint

**Task:** STAGING-DEPLOY-19 — Deploy Edit task (COLLAB-EDIT-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by COLLAB-EDIT-01; Keith said deploy now on 2026-11-08, after being told that runs pause for a few minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | bae24d9e88d85b62e3a8ea4ec7468eeb7743c788 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd19-deploy.sh)

Pre-check (read-only): staging at 563091f, migration hash cbd04277..., 0 active runs, 0 open hand-offs, 0 running executions, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing active or running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed bae24d9 (05:55:25 to 05:57:51 UTC, exit 0), which holds COLLAB-EDIT-01 (8772a60), a gateway and frontend change; no migration. After it: HEAD and DEPLOYED are bae24d9, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 24 guard checks 401 without a key (two new: the prompt route, lower and upper case), the static test key refused with 403, CORS unchanged.

After-check (read-only): the prompt route is in the gateway build (1 file), the lead's numbered-plan sentence is in the gateway build (1 file), the Edit task button is in the frontend build (4 files), editTask is in en.json, saveTask is in zh-TW.json, the prompt route answers 401 without a session, the Team page answers 200, nothing active or running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-19/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2313 | `ca1162b78c19228c48baa47a52352855fe1e9e930ab98d4a01b8a25dc5dcd480` |
| `cursor-admission-result.json` | 3465 | `902a1bbf11e3edded48d786d337a8189ff079e1b7383af8d9146e58fa2395c04` |
| `sd19-pre.sh` | 1919 | `ed976c1cddca30dff724a012ba2f6bde94a30b5a55a4ef6a1b8967bdbf6f0fff` |
| `sd19-pre.out` | 1647 | `ae478bca391a542573b08b02e04bba434ea09ea68949688f33a8600eef591622` |
| `sd19-deploy.sh` | 11907 | `4f9466bfbdeeecc2e4e6e810ff133088fbd9fa23a9acafaef69cef295aa08989` |
| `sd19-deploy.out` | 8533 | `0dd6f509a2c2e06b5d038c4904fe7c87cb1bfe064a8366dcbc76f43cfec7cac9` |
| `sd19-after.sh` | 1641 | `9f012bad1dd3c23c60a354c50c38283a757a7e7ba08283c3975b0e7851a5692d` |
| `sd19-after.out` | 512 | `0d8ed3014a13c3ca66c02203094756c9bc78ab84ead8eca4ed58bf44d13420f0` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith's own check of Edit task on a waiting hand-off is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs bae24d9.
