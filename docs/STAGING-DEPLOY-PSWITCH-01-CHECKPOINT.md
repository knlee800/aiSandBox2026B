# STAGING-DEPLOY-PSWITCH-01 — Checkpoint

**Task:** STAGING-DEPLOY-PSWITCH-01 — Deploy PROVIDER-SWITCH-01
**Status:** COMPLETE AND LOCKED — 2026-11-13. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV (held, not changed).
**Source:** registered by the PROVIDER-SWITCH-01 LOCK (0e73fa4). Keith approved the deploy ("Yes, deploy"); admitted 5c67466.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 5c67466 |
| 2. Deploy and checks | from the host | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (2026-11-13T09:09:43Z)

Script `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-PSWITCH-01\pswitch1-deploy.sh` (SHA-256 `ad4866db9cbdbf386ac46a97e5e0d0ed3fe8bc84f67c8653164fb6e465e472b0`, 52,576 bytes, no blank lines). It is the STAGING-DEPLOY-PKEY-01 script with the new target, previous commit and run folder, plus three build markers for the switch check. It was checked with `bash -n` and ran once on ainow-staging-01 after a hash check.

Output: `pswitch1-deploy.out` (SHA-256 `6289453816f9935f95667e80daf384ee44db85474493ed2b625686fa9158205c`), scanned for key, password-hash and internal-key text: none.

- **Before:** HEAD and DEPLOYED 6f6b8e8; configuration at the baselines; `AI_PROVIDER=stub`, `GLOBAL_EXECUTION_ENABLED=false`; nothing open.
- **Deploy:** `aisandbox-deploy 5c674666711a42c22b8495ddc219bba0fdbe9720`, rc 0. No migration: the hash is unchanged at `9cfde25f`.
- **After:** configuration unchanged (gateway.env `e0767286`, Caddyfile `205770cf`); units active; every earlier check passed.
- **Provider checks:**
  - `GET /api/ai/providers` returns 401 without credentials and 200 with a temporary admin API key, which was revoked afterwards;
  - the internal route answers 401 with no key or a wrong key, and 200 with the key;
  - both answers say no provider is usable, and agree with the key counts in `/etc/aisandbox/ai.env` (all 0);
  - no key text appears in the answers.
- **Build markers:** `resolveGatewayProvider` (6 files) and `applyProviderSwitches` (3 files) are in the gateway build, and `resolveRequestProvider` is in `src/safety/execution-safety.guard.js`. ACCESS-01J's `store: false` is still in place.

**Not checked live:** the switch refusal itself. While `GLOBAL_EXECUTION_ENABLED` is false, the global switch answers first. The refusal is checked in ACCESS-01J-LIVE's run window, which must also switch on each provider it uses. No browser check was needed: the picker on staging is unchanged ("No provider available").

## State after

Staging runs 5c67466 with runs off and every provider switch off.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes checked before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, no migration and the hash unchanged, health, guard, provider and earlier checks pass, configuration unchanged; 5: from the host; 6: output checked for key text, the temporary key value never shown and revoked)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-13 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false.
