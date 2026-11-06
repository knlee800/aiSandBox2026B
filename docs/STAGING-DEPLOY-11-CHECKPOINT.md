# STAGING-DEPLOY-11 — Checkpoint

**Task:** STAGING-DEPLOY-11 — Deploy the Ask contract (ASK-CONTRACT-01) and the Stop button (RUN-STOP-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered by ASK-CONTRACT-01; Keith said deploy now on 2026-11-06, after being told that runs pause for a few minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV | 05539f772b963569d14909bbe290dad378b674fd |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd11-deploy.sh)

Pre-check (read-only): staging at 07c5d0b, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), all units active. The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library version. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED from true to false (one line, checked by diff), restarted the gateway (ready 200) and confirmed nothing had started. aisandbox-deploy then took staging from 07c5d0b to 05539f7 (started 10:42:27 UTC, rc 0 at 10:45:21 UTC); the migration hash is unchanged. The script restored the saved gateway.env byte for byte (5692ce351b06...), restarted the gateway (ready 200) and confirmed GLOBAL_EXECUTION_ENABLED true; all configuration files then matched the tester-window state. Runs were off for about four minutes. All units active; Caddy 401 without basic auth; gateway health 200; frontend /en, /en/office and the three Knowledge pages 200; 17 of 17 guard checks 401; the static key refused with 403; CORS: other origin and its preflight get no allow header, the app origin is echoed with credentials, no Origin is 200 without the header. The curl "Failed to connect" lines in the deploy output are the deploy tool's own readiness probes while services restart.

After-check (read-only): the Ask-mode instructions are in the AI service build (2 files), the Stop button test ID is in the frontend build (4 files), the runStopped key is in en.json, nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-11/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd11-pre.sh` | 1506 | `043a9f902aa6ce3ba6275149b057901ed5a7a7640a35278136ce5f614b0418c3` |
| `sd11-pre.out` | 819 | `7f9fda9aeabd76e2137237d9e6b1cbc6c2ee6611e1d4f7996ac569f36a7cd313` |
| `sd11-deploy.sh` | 11518 | `26ec98d527d61ad04db8158daaaeebce7be5d552a4dd7db04f6c6a7bb121ec38` |
| `sd11-deploy.out` | 7618 | `af3427350e96a2ea80b1e5b5d52f4df4c784df06077bfe43d434af386c25dabd` |
| `sd11-after.sh` | 889 | `6207b198706e2a72398d7f9604db6598763c82a19e7636813fce7cfb7588cdd0` |
| `sd11-after.out` | 369 | `b22e54014169c17cf9ccf2c931da3e5fb6447ff6a42aacc86b2dab28a562b15e` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith checks Ask and Stop in his own testing; that is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 05539f7.
