# STAGING-DEPLOY-COSRULE-01 — Checkpoint

**Task:** STAGING-DEPLOY-COSRULE-01 — Deploy the Chief of Staff data-rule change and re-test the workflows
**Status:** COMPLETE AND LOCKED — 2026-11-17. Result: passed (deploy). The workflow re-tests moved to COS-EVAL-LIVE-03: they need runs on, which this task does not hold.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING (tester window closed).
**Source:** registered 2026-11-17 by the COS-MAIL-BODY-RULE-01 LOCK. Keith approved the deploy on 2026-11-17 ("Yes, deploy").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1; stagingAuthorized true | 2b30cd1 |
| 2. Deploy and host evidence | from the host | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Scripts and outputs

The files are in `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-COSRULE-01\`. The control plane made `cos1-deploy.sh` from `chain1-deploy.sh` with `mk_cos1.py` in its scratchpad, asserting each change. It dropped the env step and the migration-change check, and added the data-rule checks.

| File | SHA-256 |
|---|---|
| `cos1-deploy.sh` | `eb9a2a24c06d92de6de5314aef0a154793a39696aefa9a98c81c51842e83e60b` |
| `cos1-check.sh` (read only: the same post-deploy checks without the deploy, each failure numbered) | `831c673dee523634697035ef88257c9e02f6d64f7412292b0bc756ff72413019` |
| `cos1-workflows.sh` (read only) | `d0f7cb2450966393f73ff546288883dde959a12973698641982899c6d0818c78` |

The outputs are `cos1-deploy.out`, `cos1-check.out` and `cos1-workflows.out`. A scan for key text found none. Every temporary API key was revoked.

## Deploy (2026-11-17, rc 0 at 10:28:52Z)

| Check | Result |
|---|---|
| Before | host at 12598e7; migration hash 0f91cfda; configuration at the baselines (gateway.env 616841ca, ai.env 721f4772, Caddyfile 205770cf); runs off; nothing open |
| Deploy | `aisandbox-deploy 2b30cd1` rc 0; HEAD and DEPLOYED at 2b30cd1 (code equal to c9c1efe) |
| Migration | none: hash unchanged at 0f91cfda; latest migration still 1814 |
| Earlier checks | all as before: the preview host, the CSRF guard, cookies, the picker bridge, guards, CORS, ports, container-manager, providers (none usable, as expected), the provider switch, Discord ready, schedules and every trigger type (rows unchanged, switches false), the run-result route, time zones UTC |
| The data rule | the gateway build has the new sentence in 2 files and the old one in 0; the ai-service build has the new eval copy (hash f5d6e40d in 2 files, 8f655afb in 0); case `inject-run-result` is in the checkout |
| One stale expectation | the script's inherited check "eval copy hash 8f655afb present" failed, so the script stopped after the deploy, at its final check. That hash was replaced on purpose by this change. The read-only rerun (`cos1-check.sh`) numbered the failing checks: that line was the only one. Later deploy scripts are made from this one with the expectation set to f5d6e40d |
| After | configuration unchanged; every trigger switch, the run-result tool, schedules and runs off; Discord on; nothing open |

## Workflows (host read, as Keith)

| Workflow | Status | Tested | Version |
|---|---|---|---|
| 71f32136 (the chain trigger's source) | active | false | f305ae56… (new) |
| ab4cb6ae | switched off | false | e3830340… (new) |

Both versions changed with the rule text, as expected, so neither counts as tested. A test run needs runs on with a provider, which is a run window with ENV, PROVIDER-LIVE and CREDIT. So Keith's re-tests move into COS-EVAL-LIVE-03, which opens such a window anyway. Its mutexes gain ENV and CREDIT, and its scope gains the re-tests. The registration in COS-MAIL-BODY-RULE-01's lock had put the re-tests here by mistake.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| Keith's workflow re-test runs | superseded by COS-EVAL-LIVE-03 (scope, mutexes ENV and CREDIT added in this record) |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files checked against the baselines before and after, unchanged; 3 and 7: n/a, tester window closed; 4: nothing open before or after, health ready, units active, DEPLOYED and migration hash as expected; 5: from the host; 6: outputs scanned for key text, temporary API keys revoked, no secret printed)
FOLLOWUPS: 0 registered / 1 superseded (the workflow re-tests, by COS-EVAL-LIVE-03) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY; STAGING released UNOWNED; stagingAuthorized false;
- staging runs 2b30cd1 with the new data rule, and every switch and runs off.
