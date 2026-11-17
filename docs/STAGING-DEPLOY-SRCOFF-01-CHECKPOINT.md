# STAGING-DEPLOY-SRCOFF-01 — Checkpoint

**Task:** STAGING-DEPLOY-SRCOFF-01 — Deploy the switched-off source warning and the eval tidy-ups, and Keith checks the section
**Status:** COMPLETE AND LOCKED — 2026-11-17. Result: passed (deploy and Keith's check).
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING.
**Source:** registered 2026-11-17 by the CHAIN-SOURCE-OFF-01 LOCK. Keith approved the deploy on 2026-11-17 ("Yes, deploy").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING; stagingAuthorized true | 0427246 |
| 2. Deploy and Keith's check | from the staging host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Deploy (srcoff-deploy.sh, rc 0 at 2026-11-17T13:55:46Z)

ea75557 to 0427246 with aisandbox-deploy. It carries three tasks:
- CHAIN-SOURCE-OFF-01: the gateway source view and the page warning;
- COS-EVAL-MARKERS-01 and COS-EVAL-LABEL-01: briefing eval cases and code.

**Before:**
- HEAD and DEPLOYED were at ea75557;
- the configuration files were at the baseline;
- AI_PROVIDER and EMAIL_PROVIDER were stub, and GLOBAL_EXECUTION_ENABLED was false;
- no executions or runs were open;
- the ops library was at the expected version in both places.

**After:**
- HEAD and DEPLOYED were at 0427246;
- the migration hash was unchanged at 0f91cfda;
- the configuration files were unchanged (gateway.env 616841ca, Caddyfile 205770cf);
- the flags were unchanged, and every trigger switch and the run-result tool were off; Discord was on;
- every earlier deploy check passed: Caddy 401 without login, the preview host, the CSRF guard, the guard checks, CORS and the build markers.

**New checks:**
- the gateway build has the chain trigger source view;
- the frontend build has the new notice in en, the switched-off source note in zh-TW and zh-CN, and the form warning test id;
- no briefing case carries a bodyCase label;
- one case names print-verify.example.org;
- still twelve cases.

The script was built from cel4-deploy.sh with a new target, a new run folder and the four new checks; it passed a syntax check. No key text appears in any output.

## Keith's check (2026-11-17, "All looked right")

On the Schedules page, After a workflow finishes:
- his CoSCopy trigger shows no line;
- a new trigger with the switched-off workflow 每週客戶回饋摘要 as its source showed the form warning, and Save stayed available;
- once saved, its row showed the switched-off line;
- switching it on showed the amber notice;
- the texts read properly in 繁體中文 and 简体中文.

**Host checks after his check:**
- **Test trigger left behind.** After the first check, the test trigger (1e1b6d02) was still there and switched on. Nothing could fire, because the chain switch and the source workflow were both off. Keith deleted it on request.
- **Confirmed afterwards:**
  - one chain trigger left (5f1793e3, source 71f32136);
  - audit since the deploy: 1 created, 4 updated, 1 deleted;
  - 0 chain runs and 0 open runs;
  - env files at the baselines (616841ca, 721f4772, 205770cf);
  - GLOBAL_EXECUTION_ENABLED and CHAIN_TRIGGERS_ENABLED false.

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-SRCOFF-01/`.

| File | SHA-256 |
|---|---|
| `srcoff-deploy.sh` | `93088e1e6d19bc36ec6163a31a22820f6a58a549dff173f191a9cd4b96c45c88` |
| `srcoff-deploy.out` | `cf2af395c0b8c8ced04e8f597d7596d4bbf7d35995a733d428e572069c8c9992` |
| `srcoff-check.out` | `57299e3f322bd8d175591e22154b0890e855d0410ba8a015fc2def1572fd2195` |
| `srcoff-check2.out` | `9c139cb1b7f491ac86d704f76469255bcef19ff07a9d3ea5b361eec46f0d4331` |
| `run.sh` | `dd2f3b1b424bfb43e9aeaf80494cb6cd56b66db59eb1dc1ff53c7134c0f96c86` |

## Limits

- Phone width was left to Keith and not separately reported.
- The eval cases are on the host, but no eval was run.
- Chain triggers and runs stay off.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code, the deployed code was gated in its three tasks; 5: records and host state only; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), DEPLOY 7/7 (1: STAGING held; 2: env files at the baselines before and after; 3 and 7: n/a, tester window closed; 4: nothing open before or after, DEPLOYED and migration hash as expected, health and guard checks pass, configuration unchanged; 5: from the host; 6: outputs scanned for key text, none), UI 9/9 for the live part (item 9: Keith's check passed; items 1 to 8 were met in CHAIN-SOURCE-OFF-01)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-17 by the control plane:
- Lane 1 released EMPTY;
- STAGING released UNOWNED;
- stagingAuthorized false;
- staging runs 0427246, with runs and every trigger switch off.
