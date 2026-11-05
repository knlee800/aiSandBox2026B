# STAGING-DEPLOY-09 — Checkpoint

**Task:** STAGING-DEPLOY-09 — Deploy HTTP CORS limited to the app's origin (ACCESS-CORS-01)
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-06 (gateway change only, run from the host, nothing needed from Keith after approval).

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | in the ACCESS-CORS-01 LOCK record, Lane 1 with STAGING | 951ee8388b0655014fe349a2adb9de9bef6ef8e6 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

Read-only pre-check: staging at 3c584a9 (migration hash cbd04277…), nothing open, gateway.env and ai.env at their baseline hashes, NODE_ENV production, units active, APP_BASE_URL https://staging.ainow.biz. The deploy block confirmed again that nothing was queued or running, then ainow-staging-01 went from 3c584a9 to 951ee83 (SD9 DEPLOY PASSED, aisandbox-deploy rc 0 at 2026-11-05T17:26:56Z UTC). Migration hash unchanged; configuration files unchanged; all units active; gateway health 200; Caddy 401 without basic auth; frontend /en, /en/office and the three Knowledge pages 200; 17 of 17 guard checks 401 without login; the static key test-harness-api-key refused with 403. The connection-refused lines in the output are the deploy tool's readiness polling during the restart, as in earlier deploys. No key text in any output.

CORS from the host against 127.0.0.1:4000:

| Request | Access-Control-Allow-Origin |
|---|---|
| GET /api/health, Origin https://evil.example | none |
| OPTIONS /api/auth/login preflight, Origin https://evil.example | none |
| GET /api/health, Origin https://staging.ainow.biz | https://staging.ainow.biz, with Allow-Credentials true |
| OPTIONS /api/auth/login preflight, Origin https://staging.ainow.biz | https://staging.ainow.biz |
| GET /api/health, no Origin | none; status 200 as before |

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-09/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd9-pre.sh` | 1506 | `043a9f902aa6ce3ba6275149b057901ed5a7a7640a35278136ce5f614b0418c3` |
| `sd9-pre.out` | 1098 | `c3de858827b9f23a8b7b503daa7210889df4df9ad2ca9c251b84d414900e7d69` |
| `sd9-deploy.sh` | 9235 | `ea759fa84345238527bb642f5c49050660171b2f523d2caf3217b00c7a88e984` |
| `sd9-deploy.out` | 7591 | `4b0f05567b1330c488a6dc74674e6fa23974f0b53f4d2aa29b142874f7bdffac` |

## Acceptance criteria

All four met. No browser step and no live window, as approved. Not LOCKED by an implementer: locked by the control plane.

## Limits

- The browser path goes through Caddy and Next on the app's own origin, so CORS does not apply to it; the health, page and guard checks above show that path unchanged.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false. Staging runs 951ee83.
