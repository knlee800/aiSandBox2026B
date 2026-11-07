# STAGING-DEPLOY-15 — Checkpoint

**Task:** STAGING-DEPLOY-15 — Deploy run provenance (RUN-PROVENANCE-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by RUN-PROVENANCE-01; Keith said deploy now on 2026-11-07, after being told that runs pause for about three minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | a690c21188c6048b27bc81e1b31359f430a8aa56 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd15-deploy.sh)

Pre-check (read-only): staging at fa1b7bb, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed a690c21 (07:38:13 to 07:40:38 UTC, exit 0), which holds RUN-PROVENANCE-01 (458e14e), a gateway change; no migration. After it: HEAD and DEPLOYED are a690c21, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 20 guard checks 401 without a key, the static test key refused with 403, CORS unchanged.

After-check (read-only): the agentDefinitionVersion provenance key is in the gateway build (1 file), GET /api/system-agents still answers 401 without a session, nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-15/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2343 | `78d8716f6e92895e1ce9f19197b895810ad89d505259309fd04610c7cded347d` |
| `cursor-admit-result.json` | 3504 | `e8dcfe4f4fdac1a467b07ed2cc2ad6e4fa8700e4371c6f1f7e5f208d3f5c74c7` |
| `sd15-pre.sh` | 1919 | `df57557146efa437a26968b9ef18e7856caca6400fb1686e4f9c9896512d539e` |
| `sd15-pre.out` | 1842 | `f3ac5633692695b2605b7964e7089f613761b1347dd796b2287ee6efb48fe41b` |
| `sd15-deploy.sh` | 11689 | `3c6ba6bc670308bce14273793e0269e8a8205df48a5829a563474e537fd33650` |
| `sd15-deploy.out` | 8306 | `f6c275b60ce06bd3da06387a5fb7516fdff000b0a930e570c93e48512e34fd07` |
| `sd15-after.sh` | 807 | `dd92119d284e5f0bdc4cf4a376370694d98eb4d1deb005f4126173a2fc6a9ee6` |
| `sd15-after.out` | 339 | `add8e3974aef3d4973840f5cd70494d52bd97d0cd5242800c39c07be0101441e` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. The next Team-page hand-off records agentDefinitionId and agentDefinitionVersion; no run was started to prove it, and that is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs a690c21.
