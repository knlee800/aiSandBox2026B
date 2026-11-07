# STAGING-DEPLOY-17 — Checkpoint

**Task:** STAGING-DEPLOY-17 — Deploy Cancel run (COLLAB-CANCEL-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by COLLAB-CANCEL-01; Keith said deploy now on 2026-11-07, after being told that runs pause for a few minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | e28e4a7a0a5eeed219c167b64ed57642a140f82e |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd17-deploy.sh)

Pre-check (read-only): staging at 66efb5c, migration hash cbd04277..., 0 active runs, 0 open hand-offs, 0 running executions, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing active or running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed e28e4a7 (14:15:51 to 14:18:13 UTC, exit 0), which holds COLLAB-CANCEL-01 (e4f9fb4), a gateway and frontend change; no migration. After it: HEAD and DEPLOYED are e28e4a7, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 22 guard checks 401 without a key (two new ones for the cancel route, lower and upper case), the static test key refused with 403, CORS unchanged.

After-check (read-only): the cancel route is in the gateway build (1 file) and answers 401 without a session, the Cancel run button is in the frontend build (4 files), the cancelRun key is in en.json, nothing active or running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-17/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2313 | `7bfaf9eb27932f0fa3f33aad91b00b28cddd389e1ed63ac509d54244d35c7045` |
| `cursor-admission-result.json` | 3363 | `a29bd2fefcd3a55ea01dfe60da5389e7cec0dee5a83be355a5a54b6eb6498cbf` |
| `sd17-pre.sh` | 1919 | `ddd6bbc265ba16718373d8073e964267aac01acd5685c8c9bad5ac8c286d5dfd` |
| `sd17-pre.out` | 1647 | `d7141432099877df6e4fc3e50a4c5cdad68b37e459f24e94b20c71c0cc46201b` |
| `sd17-deploy.sh` | 11783 | `d4124aa82fdb2c9fbb415cb76f15b9be634943c654e08af9971fdec6d22d5b0c` |
| `sd17-deploy.out` | 8515 | `bb3daf20d307fd368b5fc1508639da7339ab7734cbc8aa3f6e9e3488e0b4b1dc` |
| `sd17-after.sh` | 1201 | `9702079f3fac419a561436afc3d18c0c31a2ac43ea37f0dc682cfdcf66599f75` |
| `sd17-after.out` | 420 | `524e973fe807840646f84b99029c4eea1ad09515780ec0a3474e740a485ef034` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith's own use of Cancel run on the Team page is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs e28e4a7.
