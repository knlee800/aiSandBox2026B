# STAGING-DEPLOY-WS3-01 — Checkpoint

**Task:** STAGING-DEPLOY-WS3-01 — Deploy the switch-on wiring and refusal message
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered and admitted in one record (8e1f8d3) after WORKFLOW-STATUS-03 locked. Keith approved the deploy on 2026-11-10 ("Yes, deploy it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 8e1f8d3 |
| 2. Deploy and host checks | ws3-deploy.sh from the staging host, then one read-only check of the compiled binding (ws3-after) | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (ws3-deploy.sh; aisandbox-deploy done 2026-11-10T12:00:43Z UTC)

678d511 → 8e1f8d3, aisandbox-deploy rc 0. It carried WORKFLOW-STATUS-03: the save hook passes the 409 refusal code, and OrchestrationModule binds the switch-on check.

**Before:**
- HEAD and DEPLOYED were at 678d511.
- Migration hash 976a9358, clean tree, configuration at the baselines.
- Flags: stub, stub, false. Nothing was running.
- The key matched across the three env files (compared by hash; only "match" printed).

**After:**
- HEAD and DEPLOYED are at 8e1f8d3, and the migration hash is **unchanged**.
- Configuration and flags are unchanged, and all 8 units are active.
- **Standard checks:**
  - 401 without login through Caddy;
  - gateway health answers 200 on 3 routes;
  - 12 frontend pages answer 200;
  - 29 guard checks answer 401;
  - the static test key gets 403;
  - CORS behaves as expected;
  - the connector server lists both tools.
- **Earlier checks still pass:**
  - ports on 127.0.0.1;
  - the ai-service guard, and its removed chat routes answer 404;
  - the container-manager guard, and its corrected and removed routes answer as expected;
  - no CORS headers on 4002, and the WebSocket upgrade is refused;
  - the traversal URLs answer 401.
- **Build markers:** the gateway build contains `UserWorkflowSwitchOnSlot` in 5 files, plus the earlier markers.
- **Journals and state:** no key text and no switch-on binding errors in the gateway journal; no open runs; `user_agents` active=1; business rows 1 and 1.

**The binding (ws3-after).** Two of the script's new build checks looked under `dist/user-agent/`, but the build writes to `dist/src/user-agent/`, so they printed 0 and blank. Neither check can fail the script. A read-only check of the real path then confirmed:

| Item | Result |
|---|---|
| `onModuleInit` in `dist/src/user-agent/user-workflow-switch-on.js` | 1 |
| the bind call | 1 |
| `strict: false` (the old run-time lookup) | 0 |
| `TestedWorkflowSwitchOnCheck` in the compiled `orchestration.module.js` | 1 |

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-WS3-01/`:

| File | SHA-256 |
|---|---|
| `ws3-deploy.sh` | `7e4b8a280e7060a2dacdf57f254463328dda46179fe0f4fac3deeb11d9847f20` |
| `ws3-deploy.out` | `029126a228b506ec17ce10643555ab63b392549eaa4d24fc68c1475eef445185` |
| `ws3-after.out` | `893f3d49721c51958725f8f1419663cb8ed632be1ebe49c8843569aa7caaaf07` |

## Limits

The host cannot make a logged-in switch-on, so whether the binding works in the running app is shown three ways:
- the compiled code;
- the absence of binding errors;
- WORKFLOW-STATUS-03's production-shaped wiring test.

Keith's browser check, when he next opens staging, gives the final proof:
- a switch-on is refused with "Run a test first" until a test run, and allowed after one;
- a 503 would mean the check is not bound.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV not changed; 2: baseline hashes before and after; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit, migration hash unchanged, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs checked for key text)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Superseded:** the logged-in switch-on check, by the WORKFLOW-STATUS-03 live check.
- **Fixed in the control plane's tooling notes:** the dist path in the build checks (`dist/src/`).

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- staging runs 8e1f8d3, migration hash 976a9358, with runs off.
