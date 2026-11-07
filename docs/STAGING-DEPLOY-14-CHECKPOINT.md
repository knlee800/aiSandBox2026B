# STAGING-DEPLOY-14 — Checkpoint

**Task:** STAGING-DEPLOY-14 — Deploy the server-side agent definitions (AGENT-DEFS-01) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME (the tester may be active). **saturationClass:** OPTIONAL (control-plane default).
**Source:** registered by AGENT-DEFS-01; Keith said deploy now on 2026-11-07, after being told that runs pause for about three minutes during the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; Cursor applied the hash-checked record (requested grok-4.7-high, resolved Grok 4.7 256K High); validator PASS | fa1b7bba12f5bda077b77cfce39fc5fc4e84d8f3 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy (sd14-deploy.sh)

Pre-check (read-only): staging at 4deae5a, migration hash cbd04277..., nothing active, open or running, env files at the tester-window hashes (gateway.env 5692ce35..., ai.env 132ebab3...), ops library at the expected version, all units active. Its informational tester query failed on a type mismatch and printed nothing; the deploy checks the queue itself.

The deploy script checked the host id, the previous commit, a clean tracked tree, all configuration files against the tester-window state, the flags (anthropic, email stub, execution on), nothing running and the ops library. It saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED to false, restarted the gateway (ready 200), confirmed nothing had started, and deployed fa1b7bb (06:17:12 to 06:19:21 UTC, exit 0), which holds AGENT-DEFS-01 (a68724f), a gateway and frontend change restarted in the same deploy; no migration. After it: HEAD and DEPLOYED are fa1b7bb, migration hash unchanged, the saved window gateway.env restored byte for byte (5692ce35...), gateway ready, runs back on, every configuration file unchanged, all eight units active, 401 without login through Caddy, gateway health 200, frontend pages 200 in all three languages, 20 guard checks 401 without a key (GET /api/system-agents added), the static test key refused with 403, CORS unchanged.

After-check (read-only): the system-agents controller is in the gateway build (10 files), GET /api/system-agents answers 401 without a session, the three new loading and error keys are in en.json, and the loading box test ID is in the frontend build (4 files), nothing running, env files at the window hashes. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-14/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2343 | `4f4d62dc32e2af03f7c38bb7806961f556490434f09bc37260f3b2162b93c446` |
| `cursor-admit-result.json` | 3416 | `83bd1a14606f8bfd5595b619e7bdd36a4b85c2086686400183944a1942c90049` |
| `sd14-pre.sh` | 1919 | `93f15e0f038b7f6affbd37c7ab80817eafde763a685ecba484e452070610e837` |
| `sd14-pre.out` | 1842 | `ffb810a5eb0485f4e20458f63afefefe10777acd5b5f23e66a9f0d9927178869` |
| `sd14-deploy.sh` | 11689 | `2730c7700c0675b7d0a3004cbb6dd2827fbd5edf76a4c79f95d365a680e842c5` |
| `sd14-deploy.out` | 8247 | `a2641ad1809a781625e4d2a6fdf8655d57ea120c6cc200a473de77bbf9f863f6` |
| `sd14-after.sh` | 1079 | `617c67e1926354ab7dbb5893232d31ffdaf9984e04e7a0053ad536dc00477e59` |
| `sd14-after.out` | 428 | `50dcc8b5758b7b9b36f634ec07239b122a727ae064d4ca4505d485ea1d6098e6` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane. Keith sees the same stations on the dashboard and in the office in his own testing; that is not a criterion of this task.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build in the repository), DEPLOY 7/7 (2: window hashes before and after, the tester may be active; 3 and 7: Keith told runs pause, runs off only for the deploy, window gateway.env restored byte for byte)

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs fa1b7bb.
