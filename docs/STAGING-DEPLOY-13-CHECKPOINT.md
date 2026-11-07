# STAGING-DEPLOY-13 — Checkpoint

**Task:** STAGING-DEPLOY-13 — Deploy the Chief of Staff office desk (BIZ-02) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by BIZ-02; Keith said deploy now on 2026-11-07, after being told that runs pause for about three minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | 4deae5ae3a0c8f55c538311d95d0087f3e118321 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd13-deploy.sh)

Pre-check (read-only): staging at 41a752e, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed 4deae5a (04:32:18 to 04:34:43 UTC, exit 0), which holds BIZ-02 (8c5ce34), a frontend change; no migration. After it: HEAD and DEPLOYED are 4deae5a, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 19 guard checks 401 without a key, the static test key refused with 403, CORS unchanged.

After-check (read-only): both knowledgeBadge keys and the chiefOfStaffIntent key are in en.json, and the detail-panel Open link (agent-detail-open) is in the frontend build (4 files), nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-13/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2343 | `08b16160da2d21c193a3b05def41ef51ba71d7d4f655b39d5fd01cfbebefcb64` |
| `cursor-admit-result.json` | 3310 | `e4b0cb79faf63c1ddf90eaad67c1e7a6769e09d84cb37f92b51d2a664433dcf4` |
| `sd13-pre.sh` | 1919 | `08cb2d5401ce672efca06e64bc86d445d43f9a69de804ff08ee786e0bfefeec5` |
| `sd13-pre.out` | 1842 | `f4a24eddf68c27de10ca2ec4f3cf63c35f2edab09d174d09840f11dad0d6c70a` |
| `sd13-deploy.sh` | 11660 | `25baa5d59c1afd8e5033eeaba2a0dd0c93fde0f7b6130bc7ab1e7aed7b7b1c3a` |
| `sd13-deploy.out` | 8226 | `9e37290ff69cd0ebf736f670b5d68e71c87ba2b06f849f9e7eaedd23555055ca` |
| `sd13-after.sh` | 891 | `25087a4fbc374ceb9060a289233ddf7efeebba5ce4a5fc4a2b63f007653f0a28` |
| `sd13-after.out` | 383 | `2a57bbc45762087ae3431b206d613695b2f6e60ec59096c31b44a92abc251a43` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith checks the office desk, its document badge and the dashboard card in his own testing; that is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 4deae5a.
