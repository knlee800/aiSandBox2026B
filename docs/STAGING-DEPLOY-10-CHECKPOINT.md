# STAGING-DEPLOY-10 — Checkpoint

**Task:** STAGING-DEPLOY-10 — Deploy the Agent safety fixes (HARNESS-FIXES-01A) during the tester window
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** registered by HARNESS-FIXES-01A; Keith said deploy now on 2026-11-06, accepting the restart during his testing, and then approved switching runs off for the deploy.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING | f4a66d748efbf64f93094aa82996d9446178ae54 |
| 1b. Scope | ENV added after the first attempt (Keith approved) | 07c5d0be0313ce67d038fc2492ba911e0cf7fa41 |
| 2. Pre-check and deploy | host blocks run by the control plane | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## First attempt (stopped, nothing changed)

sd10-deploy.sh at 07:12:11 UTC: pre-checks passed (staging at 951ee83, env files at the tester-window hashes, flags anthropic and execution on, nothing running), then aisandbox-deploy exited 11 with "GLOBAL_EXECUTION_ENABLED is not false": the host deploy tool requires runs off. A read-only check afterwards showed staging still at 951ee83, all units active, health 200, no maintenance marker, env files unchanged. GOV-OS-06 had assumed deploys could run with the window open; the rule gap is registered as GOV-DEPLOY-WINDOW-01.

## Deploy (sd10b-deploy.sh)

Pre-checks as above. The script saved the window gateway.env, changed only GLOBAL_EXECUTION_ENABLED from true to false (one line, checked by diff), restarted the gateway (ready 200) and confirmed nothing was running. aisandbox-deploy then took staging from 951ee83 to 07c5d0b (started 07:19:14 UTC, rc 0 at 07:22:54 UTC); the migration hash is unchanged (cbd04277...). The script restored the saved gateway.env byte for byte (5692ce351b06...), restarted the gateway (ready 200) and confirmed GLOBAL_EXECUTION_ENABLED true; all configuration files then matched the tester-window state (gateway.env 5692ce35..., ai.env 132ebab3..., the rest at their baselines). Runs were off for about four minutes. All units active; Caddy 401 without basic auth; gateway health 200; frontend /en, /en/office and the three Knowledge pages 200; 17 of 17 guard checks 401; the static key refused with 403; CORS: other origin and its preflight get no allow header, the app origin is echoed with credentials, no Origin is 200 without the header. No key text in any output.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-10/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd10-pre.sh` | 1506 | `043a9f902aa6ce3ba6275149b057901ed5a7a7640a35278136ce5f614b0418c3` |
| `sd10-pre.out` | 650 | `5fb386b5a2bdd0b1519b34c51d4e46535738bbaeacee633a3163bb678c308f6a` |
| `sd10-deploy.sh` | 9246 | `317adf248246cafad88a99a65dfd0a8127854ca17ba34c08a03db90fc4a056d5` |
| `sd10-deploy.out` | 870 | `fd85737186df65d9ae01b5b2997c3ebc6dba077669c0fb964e2d2f7b0e1fac73` |
| `sd10-after.sh` | 939 | `a1470c70d5c443fa313d6f079b0999041ef132a642f466d8feced662f39d638e` |
| `sd10b-deploy.sh` | 11519 | `a6b83308c82bcca28be89fa8b0b552fe04cc93a69ce1fd90d9870c14e37eb9d4` |
| `sd10b-deploy.out` | 8055 | `47f14fc35f058b8a2bf24ec0728da1bc796cc456cd622e2643ccd764e68d7d4b` |

## Acceptance criteria

All four met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (2 to 9 met or n/a: operational run, no code, no build), DEPLOY 6/6 (2: window hashes before and after; 3: Keith told before each attempt)

FOLLOWUPS: 1 registered (GOV-DEPLOY-WINDOW-01, the deploy rule for an open tester window, Keith approves the wording) / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; STAGING and ENV released UNOWNED; stagingAuthorized false; the tester window stays OPEN. Staging runs 07c5d0b.
