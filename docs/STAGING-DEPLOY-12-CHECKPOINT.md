# STAGING-DEPLOY-12 — Checkpoint

**Task:** STAGING-DEPLOY-12 — Deploy the provider usage-limit message (PROVIDER-LIMIT-MSG-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by PROVIDER-LIMIT-MSG-01; Keith said deploy now on 2026-11-07, after being told that runs pause for about three minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | 41a752e1111f01e4e0c16cd055b1fcbdd504d27a |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd12-deploy.sh)

Pre-check (read-only): staging at e5cc286, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed 41a752e (03:21:36 to 03:24:04 UTC, exit 0), which holds PROVIDER-LIMIT-MSG-01 (1f7b220); no migration. After it: HEAD and DEPLOYED are 41a752e, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 19 guard checks 401 without a key, the static test key refused with 403, CORS unchanged.

After-check (read-only): the fixed sentence AI provider usage limit reached is in the AI service build (3 files), the translated copy is in the frontend build (5 files), both providerUsageLimit keys are in en.json, nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-12/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2343 | `e0b0112346676e5afbcae480df723eec68b9280f40047fd02d6450277aa3582e` |
| `cursor-admit-result.json` | 3299 | `9e131b3d3b882cc6c46c9fe75f8d9c2ccdfc8466fd2f6c15c88ff673ece7865b` |
| `sd12-pre.sh` | 1919 | `54b9eaee4073ead6ed1048201edacba779f8470d674859a2202bd4ae9db10ca5` |
| `sd12-pre.out` | 1842 | `969c4ab28234cbc2fe347dd03c926bb075543d0af5998698a1e1cc3f49a87951` |
| `sd12-deploy.sh` | 11660 | `a95789c592b7d7ae401b440b23885e9d4171877d297eb07ddf79bf367db45845` |
| `sd12-deploy.out` | 8343 | `db5fa24bdb834d692aae9470dc225c3c98cda6f10d3bc657a140ed1a06383eb0` |
| `sd12-after.sh` | 943 | `c44bb6c7a5e06b217ec325deadde3c1fd346514a7bef358c5ece83a714283d14` |
| `sd12-after.out` | 388 | `5a500b48edf759d9b8dbf54cc11d872177276858f0c60b4c3e9e2385ad852495` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. The message itself appears only when the provider refuses a run; no provider run was made to trigger it.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 41a752e.
