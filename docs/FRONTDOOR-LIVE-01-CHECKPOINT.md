# FRONTDOOR-LIVE-01 — Checkpoint

**Task:** FRONTDOOR-LIVE-01 — Live check: Keith gives the Chief of Staff a job; it passes work on and answers with the results
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-ONE-PLAN-01. Acceptance lines were added by the COS-FRONTDOOR-01B LOCK. Keith admitted it on 2026-11-11 ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT, with the three authorizations true | d3e0e64 |
| 2. Live check | runs on (fdl-on.sh); Keith's steps; host evidence; runs off (fdl-off.sh); briefing eval (fdl-eval.sh) | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Window

Runs were on from 02:10:33Z to 03:06:46Z UTC on staging 537ebfb.
- The settings were the BIZ-LIVE-04 ones: claude-opus-5-5, the stored test key (value never shown), and the default daily credit limits.
- The env files were saved first. After the window they were restored to the baseline hashes (gateway.env 568af710…, ai.env 721f4772…), with flags stub and false and all units active.

Totals: 15 executions, all completed on claude-opus-5-5, using 164,182 tokens and 173 credits, all Keith's. 7 collaboration runs, all completed, with nothing left open.

## Acceptance

| Line | Result | Evidence |
|---|---|---|
| Save a roster of one advisor and one workflow | pass | `collaboration_rosters`: Keith's row holds 2 members, CoSCopy and technology-advisor, in tick order |
| A job that needs the workflow; approve the dispatch, then the report-back | pass | Run collab_051ea: screen (depth 0), Chief of Staff → CoSCopy dispatch (depth 1, workflow CoSCopy), then the server-created `report-back` hand-off (depth 2). Each waited at `pending_approval` until Keith approved it. |
| The final answer is the Chief of Staff's, and Results shows it | pass | The answer Keith pasted is CoSCopy's plan plus "My comment". All 7 runs opened from Results; `result_seen_at` was set for each between 03:11:58Z and 03:12:30Z. |
| A second round with the advisor | pass | Run collab_20f6f started without a session (business project, no workspace). It went: dispatch to CoSCopy, report-back, dispatch to technology-advisor (depth 3), report-back (depth 4), then completed. Dispatch and report-back hand-offs don't count toward depth (collaboration-front-door.ts); MAX_FRONT_DOOR_ROUNDS 2 bounds the run. |
| An unusable member is skipped, with the hint | pass | With CoSCopy switched off, the run showed "These agents were left out of this run: CoSCopy (switched off)." The picker refuses to newly tick a draft, so the "off" reason exercised the same `roster.skipped` path. |
| The Chief of Staff with an empty roster still answers and gives the briefing | pass | Roster saved with 0 members. Run collab_2bdb8 had one step and no hand-offs, and completed. |
| Coding, advisors and direct workflow runs are unchanged | pass | Direct CoSCopy run (collab_24b49): one step, no front-door edges. Direct technology-advisor run in zh-TW (collab_94bb8): one step. Coding run in a project (collab_4d4b9): user → lead → writer → reviewer, ordinary hand-offs, no report-back. |
| en, zh-TW and zh-CN | pass | Keith checked the Team page, the roster list and buttons in zh-TW and zh-CN ("they all look fine"). The other steps ran in en. |
| COS-EVAL-01 briefing eval rerun with the new Chief of Staff prompt (030b4efe…) and the injected hand-off case | pass | 9 of 9 cases passed, including `inject-handoff-request` (a subject asks the Chief of Staff to hand off to technology-advisor) and `inject-forward-request`. Totals: 9 injected items reported and flagged, 0 false flags, 0 action claims, 0 hand-offs, 0 extra tool calls, 60,246 tokens. The eval's prompt copy is pinned to the gateway text by briefing-drift.spec.ts. |

The eval ran after runs were off, with the runner's own key environment, as in COS-EVAL-LIVE-02. It created no user credits, project, session or run. The output files were checked for key text, and none was found. Cap: `--max-total-tokens 150000`.

## Notes

- Round one started from a project's Team page, so it ran on that workspace project. Round two and the later runs used `/en/collaboration` without a session, so they ran on the business project.
- The coding run added notes.txt to Keith's project. He may revert it from History.

Evidence in `C:/Users/knlee/aisb-preflight/FRONTDOOR-LIVE-01/`:

| File | SHA-256 |
|---|---|
| `fdl-on.sh` | `e46cfe3fcf301492149ac5908efe0fa68d0631e0fb34fd6f02f393838ed73228` |
| `fdl-off.sh` | `57e6a1d6cca1cf2d8156a979daed4c231843b43037022c2135ecd6340754eac9` |
| `fdl-evidence.sh` | `117da76a9ab9478228c1887569e3193f6348e1c2db8ae88eec44289cbfc327fd` |
| `fdl-eval.sh` | `9fd6cec62b76f1a0ead5c1b4e628df9b67c0083a00dd07a14e70350737b0ce2b` |
| `aisb-fdl-results.json` (eval results) | `0b7d968006ba1f97b3cac49cbe0a0accfedaf2fa56eceb68988e8af520f02be5` |
| `aisb-fdl-answers.json` (eval answers) | `f7a14c8b6eb5c22e6e2b3a85b7ef0fec056d5bf5ffd59e0a143d83612f0212ca` |

Also in that folder: `fdl-on.out`, `fdl-evidence-1.out` to `-7.out`, `fdl-final.out`, `fdl-off.out`, `fdl-eval.out` and `fdl-seen.out`. All were checked for key text, and none was found.

## Limits

- One provider and model.
- The eval uses scripted mail and calendar data, one run per case.
- The skipped hint was shown with the "off" reason, not "draft". The picker refuses to newly tick a draft, and the server's skip path is the same.
- The eval results file was kept as evidence and not added to the repository baselines: this task's write scope is records and host state.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), LIVE 6/6 (PROVIDER-LIVE and CREDIT held; the stored test key, value never shown; default credit limits and the eval's 150,000-token cap; host evidence of runs, tokens and credits; runs switched off with the env files at their baselines; outputs checked for key text), DEPLOY n/a (no deploy)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false;
- staging runs 537ebfb with runs off.
