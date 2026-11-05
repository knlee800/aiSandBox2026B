# STAGING-DEPLOY-06 — Checkpoint

**Task:** STAGING-DEPLOY-06 — Deploy the audit table and per-user access; make Keith admin and switch him on
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-05 (no provider, no credits; admin step and Keith's switch-on included).

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING | 4d08d2610bbb2578ef8f2bc2f4c77a0278573ed2 |
| 2. Deploy, admin step, Keith's switch-on and checks | host blocks run by the control plane; Keith in the browser | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

Read-only pre-check: staging at 4f2db62, audit_events and user_entitlements absent, Keith's role user, gateway.env at the baseline hash bf6864f9…, nothing open. ainow-staging-01 then went from 4f2db62 to 4d08d26 (SD6 DEPLOY PASSED, aisandbox-deploy rc 0 at 08:06:03 UTC). Migration hash changed as expected to cbd04277…; CreateAuditEventsTable1800000000000 and CreateUserEntitlementsTable1801000000000 recorded; audit_events with idx_audit_events_subject_occurred, trg_audit_events_refuse_change and audit_events_refuse_change; user_entitlements present; both tables empty. Configuration files unchanged; all units active; gateway health 200; Caddy 401 without basic auth; frontend /en, /en/office and the three Knowledge pages 200; 17 guard checks 401 without login, including PATCH /api/admin/users/:userId/entitlements and GET /api/auth/me. The "Failed to connect" lines in the deploy output are aisandbox-deploy's own polling while services restart. No key text in any output.

## Admin step and Keith's switch-on

- 08:06:23 UTC: one SQL update set Keith's users.role from user to admin (staging has one user; exactly one row changed; one admin).
- Keith ran the PATCH from the browser console on staging: 200, before null, after harnessEnabled true.
- Check block: Keith's row harness_enabled true, agent_write_enabled false, no overrides, updated_by = Keith, 08:21:21 UTC; exactly one audit row entitlement.updated (2437072a-f356-42e4-8c30-27e172f38ad3) with Keith as actor, changedFields ["harnessEnabled"] and his reason. Inside rolled-back transactions the database refused both UPDATE and DELETE on that row ("audit_events rows are immutable"); the row is intact.
- AI_PROVIDER=stub and GLOBAL_EXECUTION_ENABLED=false; gateway.env unchanged; 0 active runs and executions.
- Keith reported that Knowledge opens without a window.

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-06/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd6-pre.sh` | 986 | `29be672ffa49cfbea344001aa0f722aea60f5abaa9a85e7378c9c9c540dc8308` |
| `sd6-pre.out` | 837 | `6d643a9557f3bbe796ab4ae2fffa9ba7cc67eb3c96b093d85773ed0652057945` |
| `sd6-deploy.sh` | 7515 | `58d1fa0295865dc312f40c54d7dce51b89c0a2306cd6a9d411d20248bd9f22b2` |
| `sd6-deploy.out` | 8718 | `6862084eead8323ed0a6146b58269c0a1f87ef60723613583bccd0cf9138f79f` |
| `sd6-admin.sh` | 1384 | `96c15a489c8140d14772ef458134eb8de30e58c568f2291e99453dedbaae73a0` |
| `sd6-admin.out` | 107 | `f705d84d1804263d6cfc07e9cc3bdba1a10b73982fedcafec0c249f4550bfaec` |
| `sd6-check.sh` | 2704 | `bb69e4866e85a64f1bc8cc791fe246a88c1a5b74ac33894bf1f5acce1f04e0fc` |
| `sd6-check.out` | 847 | `a4641abcdb26b8cc43996ae2bfcfdf00189eb5a3a1127c67cb0d2db5c261c50e` |

## Acceptance criteria

All seven met. Keith's judgement: "200 with after" and "Right account, opens". Not LOCKED by an implementer: locked by the control plane.

## Limits

- One account. Knowledge was opened, not exercised again (STAGING-DEPLOY-05 covered upload, replace and delete). No collaboration run ran, so no orchestration audit row exists yet on staging.
- Keith's admin role and harness access stay on by design; runs and the provider stay off, so nothing can spend. Agent mode controls are visible to him; a run is refused while runs are off.
- Staging's gateway.env keeps the empty allowlist line, which the gateway no longer reads.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false. Staging runs 4d08d26 with Keith's access set in user_entitlements.
