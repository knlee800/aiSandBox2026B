# STAGING-DEPLOY-08 — Checkpoint

**Task:** STAGING-DEPLOY-08 — Deploy the real refusal messages (LIMIT-MESSAGE-01)
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-05 (frontend only, run from the host, nothing needed from Keith after approval).

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING | 3c584a932ea669fcc56b7401e46e12bd2789bf03 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

Read-only pre-check: staging at abacbb3 (migration hash cbd04277…), nothing open, gateway.env and ai.env at their baseline hashes, NODE_ENV production, units active. The deploy block confirmed again that nothing was queued or running, then ainow-staging-01 went from abacbb3 to 3c584a9 (SD8 DEPLOY PASSED, aisandbox-deploy rc 0 at 14:37:47 UTC). Migration hash unchanged; configuration files unchanged; all units active; gateway health 200; Caddy 401 without basic auth; frontend /en, /en/office and the three Knowledge pages 200; 17 of 17 guard checks 401 without login; the static key test-harness-api-key refused with 403. The built frontend contains the new English daily-credit message (5 files), and the deployed zh-TW and zh-CN message files contain the new text (3 keys each; the build also holds it as plain text, 5 files each). No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-08/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd8-pre.sh` | 1385 | `253c1c611cd080b5c1ccdd68ecf96ca2c0f801e103f7da7dc96665ff8f82f96f` |
| `sd8-pre.out` | 1056 | `d5e934fea628b1b40445372b808ba731891f92652fc75bfc539a339b5c4a3c26` |
| `sd8-deploy.sh` | 8049 | `e7a445cd1d54efc9c819236bb2c4e45b59f11f70ce8ad27f2c9743bbbcc10198` |
| `sd8-deploy.out` | 7443 | `c2439dcfcc8e7d7af3703aafc5272077d004ffec4247aaf7a062fb5ab5957472` |

## Acceptance criteria

All four met. No browser step and no live window, as approved. Not LOCKED by an implementer: locked by the control plane.

## Limits

- The messages appear only when a run is refused, which needs a live window; LIMIT-MESSAGE-01's tests cover each case. The next approved live check can see them on screen.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false. Staging runs 3c584a9.
