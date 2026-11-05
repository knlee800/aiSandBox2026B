# STAGING-DEPLOY-04 — Checkpoint

**Task:** STAGING-DEPLOY-04 — Deploy the office and the reopen fix, with Keith's browser check
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** the RPG-OFFICE-01 item "deploy and Keith's browser check of OFFICE-01" and HARNESS-FIXES-01 item 12. Keith approved the draft on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with STAGING, PROVIDER-LIVE, CREDIT and ENV | 1aee7ed3b88ccd5779b6a95e6f46b971ae2cee92 |
| 2. Deploy and live window | host blocks run by the control plane; Keith in the browser | no repository change |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this record |

## Deploy

ainow-staging-01 went from a28c489 to 1aee7ed (aisandbox-deploy rc 0 at 01:59:31 UTC). Migration hash c4bfc1a1… unchanged; configuration files unchanged; all units active; gateway health 200; frontend /en, /en/office, /zh-TW/office and /zh-CN/office 200; Caddy 401 without basic auth; 14 guard checks 401 without a key, including GET /api/ai/executions. Flags stayed off during the deploy.

## Keith's checks

- Office pages in en, zh-TW and zh-CN, with flags off: Keith reported "Office looks good".
- Live window 02:16:24 to 02:25:28 UTC (stored test key, claude-opus-5-5, spend caps 1 and 2 USD, tool loop, write and validation tools on): Keith ran an Agent run in "C1 repeat" that wrote notes/reopen-test.md, closed the page, reopened the project during the run, and watched the office. Keith reported "Files intact, office ok".

## Evidence from the host

| Check | Result |
|---|---|
| The fix acted | gateway log 02:24:25: "Active run in session 583c5208-50ed-4c90-a1d6-25c54141808b; skipping snapshot and checkpoint restore" |
| The run | 9669056f-68fb-4571-a7b7-e7f8f5283f32, agent mode, completed, claude-opus-5-5, 15,951 tokens |
| Duration recorded (USAGE-DURATION-01 live) | execution_duration_ms 30,497 |
| File intact | notes/reopen-test.md in the workspace, heading and 10 numbered lines |
| Credits | 16 applied, balance 128 to 112 |
| Open work after | 0 active collaboration runs, 0 open hand-offs, 0 active executions |
| Flags off | env files restored to the expected hashes; AI_PROVIDER=stub, GLOBAL_EXECUTION_ENABLED=false; health 200; key line gateway 1 placeholder, ai 0 |
| Secrets | no key text in any output |

Evidence in `C:/Users/knlee/aisb-preflight/STAGING-DEPLOY-04/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `sd4-deploy.sh` | 6115 | `24645987d65199e37e03ae2963c46edc4213806b228d5b86b23210c397a21469` |
| `sd4-deploy.out` | 6715 | `8705af2ddd8193fabf31c40fdaada8ab2530eefd7fb56262015efff41168ab5b` |
| `sd4-flags-on.sh` | 6908 | `8fba009dc6e23b4f3766957fb0755904b536592cfc85c5670eb1ab2abb433317` |
| `sd4-flags-on.out` | 1542 | `577bde76fa86195659d9aac62c9292fc4fe6959fe2c23f1889fbab7a55c596d1` |
| `sd4-flags-off.sh` | 2787 | `4d3eb05791bab8548c2eb2685c98ddda60cd916ace594b1c044c3f0be0ecff9d` |
| `sd4-flags-off.out` | 642 | `cd275066717fdb047784b3d72ad983e0e545cd1ba211442bc9a53b82e2cd3e2c` |
| `sd4-ev.sh` | 2404 | `10560e72faa389fa2abcdd109d5e97d7426112a4efaf66a5a34dcddd9cc59e77` |
| `sd4-ev.out` | 2433 | `b3561893f9d5abad94adc5099e27a798585ff75b7f277911f023d4c031b04606` |
| `sd4-ev2.out` | 607 | `bced02a1a99f09e59964c327ece53c7ba94116861cd4087275af94c550fe17d3` |

Three queries in sd4-ev.sh named the wrong table or column (credits, snapshots, checkpoints) and returned errors; the credit figure comes from sd4-ev2.out.

## Acceptance criteria

All seven met. Keith's judgement: "Office looks good" and "Files intact, office ok". Not LOCKED by an implementer: locked by the control plane.

## Limits

One run, one provider and model. The Team desk was seen with past collaboration runs only; no collaboration run ran in the window. Office runs behind basic_auth on staging only.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; STAGING, PROVIDER-LIVE, CREDIT and ENV released UNOWNED; stagingAuthorized, providerLiveAuthorized and creditAuthorized false. Staging runs 1aee7ed with flags off.
