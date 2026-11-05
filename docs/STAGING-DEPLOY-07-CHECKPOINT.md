# STAGING-DEPLOY-07 — Checkpoint

**Task:** STAGING-DEPLOY-07 — Deploy the access limits, test-key lockdown and signed Agent tool profile; Keith switches on Agent write
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-05 (no provider, no credits; static-key check and Keith's switch-on of Agent write included). Carries the row step that the ACCESS-01C checkpoint handed to the next staging deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING | abacbb3a5b16d9d2c14a8b7d783dffa84aa5287b |
| 2. Pre-check, deploy, Keith's switch-on and checks | host blocks run by the control plane; Keith in the browser | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

Read-only pre-check: staging at 4d08d26 (migration hash cbd04277…), nothing open, Keith admin with harness on and Agent write off, one entitlement audit row, NODE_ENV=production, gateway.env and ai.env at their baseline hashes, units active. The deploy block confirmed again that no executions or collaboration runs were queued or running (drained queue, ACCESS-01C decision 2) and that NODE_ENV is production, then ainow-staging-01 went from 4d08d26 to abacbb3 (SD7 DEPLOY PASSED, aisandbox-deploy rc 0 at 12:50:17 UTC). Migration hash unchanged, as expected with no migrations; configuration files unchanged; all units active; gateway health 200; Caddy 401 without basic auth; frontend /en, /en/office and the three Knowledge pages 200; 17 guard checks 401 without login; a request with the static key test-harness-api-key refused with 403 (STATIC-KEYS-01 live). No key text in any output.

## Keith's switch-on

- Keith ran the PATCH from the browser console on staging with agentWriteEnabled true and a reason: 200, before false, after true.
- Check block: role admin; row harness_enabled true and agent_write_enabled true, no overrides, updated by Keith at 12:56:50 UTC; two entitlement.updated audit rows, the new one (e3902dae-180f-4a2a-91f5-e87804ffe892) with changedFields ["agentWriteEnabled"] and his reason; AI_PROVIDER=stub and GLOBAL_EXECUTION_ENABLED=false; gateway.env unchanged; units active; nothing open.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-07/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd7-pre.sh` | 1385 | `253c1c611cd080b5c1ccdd68ecf96ca2c0f801e103f7da7dc96665ff8f82f96f` |
| `sd7-pre.out` | 1056 | `feb7ff10d236b52a1f60ceb00b424e49803f2ca27240918830f0f31949285c72` |
| `sd7-deploy.sh` | 7347 | `63e4eb8760a6b594d5b47b2879034540d6209c452aced4b634880598879db196` |
| `sd7-deploy.out` | 7290 | `9012e387c7f06802f7a763a8f1f35c1342967f63297679b7ba73e4c8be551dd9` |
| `sd7-check.sh` | 2159 | `d82da35889699ad7a9278f5738664e4de2c052283b1db0f9a043f17e1a76600c` |
| `sd7-check.out` | 501 | `8f068f63d13c29f3517da8d6459c21f2e417ed8bfe3057ef8916a4cca097588e` |

## Acceptance criteria

All seven met. Keith's judgement: "200 with after". Not LOCKED by an implementer: locked by the control plane.

## Limits

- The credit caps, token limits and signed tool profile act only when a run happens, and runs and the provider stayed off; ACCESS-LIVE-01 exercises them with real runs.
- Agent writes on staging still need AGENT_HARNESS_ENABLE_WRITE_TOOLS on, which happens only in live windows.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false. Staging runs abacbb3.
