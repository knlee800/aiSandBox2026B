# USER-TEAMS-LIVE-01 — Checkpoint

**Task:** USER-TEAMS-LIVE-01 — Live check: a user workflow with a team
**Status:** COMPLETE AND LOCKED — 2026-11-11. Result: **passed**.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the USER-TEAMS-01 stage-start approval; widened by the APPROVAL-SET-01 and COS-DRAFTS-01 stage-start approval and the COS-DRAFTS-01 and -01B LOCKs. Keith admitted it on 2026-11-11 ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT; the three authorizations true | 03c3d59 |
| 2. Live check | Keith in the browser on staging 7ac9084; the control plane read every step from the host | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar, plan and ARCHITECTURE.md 13.1, canonical validator | this record |

## Window

- **Switch on** (utl-on.sh): gateway.env and ai.env were saved at their baseline hashes (568af710…, 721f4772…). Runs were switched on at 2026-11-11T07:39:20Z. Nothing was open before.
- **Switch off** (utl-off.sh): runs were switched off at 2026-11-11T12:44:39Z. Nothing was open at that point. The env files are back at their baseline hashes, with flags `AI_PROVIDER=stub` and `GLOBAL_EXECUTION_ENABLED=false`, and all units are active.
- **Usage in the window:** 10 executions, all on claude-opus-5-5, using 61,448 tokens and 68 credits.

## What Keith checked

All of it was in zh-TW, except where a line names another language. Each line was confirmed from the host evidence (`utl-evidence.sh`) as well as by Keith's answer.

| # | Check | Result |
|---|---|---|
| 1 | CoSCopy saved with a team of one advisor and approval `read_only` | team size 1, `read_only` |
| 2 | Run collab_8: CoSCopy dispatched to technology-advisor, and the report-back returned | Both steps carry `teamLeadId` = CoSCopy and `decisionReason auto:read_only`. The Team page showed "Approved automatically" on both, and Results showed CoSCopy's paragraph (Keith: yes, yes). |
| 3 | A Chief of Staff draft in zh-TW (run collab_7, target `chief-of-staff`) | The step's answer carries a parsed draft. Keith saw the card with 檢查並儲存. |
| 4 | Review and save | The form opened prefilled. Save stored 每週客戶回饋摘要 as `draft` with the defaults: no team, mode every, server model. The draft query left the address bar. |
| 5 | Test run, then switch on | The test run (`testRun` true) completed, and the workflow is `active`. |
| 6 | Team of 2 (the advisor and 每週客戶回饋摘要) with mode `credits` and a limit of 1 | The dispatch to the workflow member waited with `over_limit`; Keith saw 等你核准：這一步的費用可能超過你設定的上限。 He approved it, and the member ran. The report-back to CoSCopy also waited with `over_limit` and was approved. |
| 7 | A team member switched off | Keith saw 這次執行略過了這些代理：每週客戶回饋摘要（原因：已關閉）。 He cancelled that run afterwards (`cancelled`). |
| 8 | An empty team with mode every | The run was a single step with no `teamLeadId` and no 略過 line, exactly as before. |
| 9 | zh-CN | CoSCopy's summary, Results and a run were all in 简体中文. |
| 10 | en, phone width | The draft card read well at the narrowest window width. |
| 11 | The same 檢查並儲存 link opened as the second account | 找不到該草稿。 and an empty form. |

The Chief of Staff front door itself also ran unchanged in check 3: one step, no hand-off.

## Briefing eval

utl-eval.sh ran from the host after runs were switched off, from 12:45:03Z to 12:46:49Z UTC, with rc 0.
- **Setup:** the COS-EVAL-01 briefing runner on claude-opus-5-5, harness version `v1@7ac9084`. That build carries the Chief of Staff eval copy with hash 8f655afb, which STAGING-DEPLOY-FD-02 found in the ai-service build. The key was the stored test key on the host and was never shown.
- **Result:** 10 of 10 passed, including `inject-draft-request`.
  - 10 injected items: 10 reported and 10 flagged.
  - 0 false flags, 0 action claims, 0 hand-offs and 0 extra tool calls.
  - No `<draft` block in any answer.
- **Cost:** 20 model calls, 70,465 tokens and 75 credits.

## Evidence

Evidence is in `C:/Users/knlee/aisb-preflight/USER-TEAMS-LIVE-01/`. Every output was checked for key text, and none was found.

| File | SHA-256 |
|---|---|
| `utl-on.sh` | `d322a257fa1c1ad424d10e3ec09b72ce4bfed8b99a7c3cb92c6dfeb5f78a81b3` |
| `utl-off.sh` | `a4c61f566b7f489525467ff8ef041c944970c52215e934527a82577e82926856` |
| `utl-evidence.sh` | `d37ebdf39b185b906ea3bbdb13b3f323c907cf5f1928a70ad94e10217250a7d3` |
| `utl-eval.sh` | `1ca34311ec5bbe431336ef4ef1cbefd35a156e600834a3b1fd5d9a0db70626fe` |
| `utl-on.out` | `ac26174a9a3a8221752a1d42260d57abb1f8add7886b92f4815c45dd90515681` |
| `utl-off.out` | `a688bc4ce746cd2edfbba56ea266827e5c1520b0df3595b814dc9cb08efbb767` |
| `utl-ev11.out` (final evidence) | `044f6b7669005c8aa7ead3555674c50718c23a17769db1f850d80519abc1d1d2` |
| `utl-eval.out` | `32ade8499fb079da67133925e467eba6e5962e10a53be7aee1721a9719e98153` |
| `aisb-utl-results.json` | `56ede69213321e8d9bb8330a93ee9e3e83d61cfa85215bec9d9146b6b40c03ba` |
| `aisb-utl-answers.json` | `f2aabf6368025dffbc2f7c8fbd8ad12124e9e02c699595211ca0f7e6ecc003be` |

## Not checked live

- **An invalid draft has no link.** The model produced a valid draft, and an invalid one cannot be forced from the browser. The COS-DRAFTS-01B tests cover this case.
- **A stray lower-case "word:" line.** The one live draft parsed as valid, with no refusal. With one sample, there is no evidence for a parser follow-up.
- **The Chief of Staff reads the drafted workflow by name once it is on the roster.** This was not run. It needs runs on, so it moves to USER-TEAMS-LIVE-02, registered NOT_READY.

## Product status

User teams, approval settings and Chief of Staff drafts are deployed on staging and passed Keith's live check:
- **ARCHITECTURE.md 13.1:** the three rows change from BUILT to STAGING.
- **PRD.md:** the wording that moves them from APPROVED FUTURE to GATED is added to GOV-PRD-SYNC-01, for Keith to decide.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), LIVE 4/4 (1: PROVIDER-LIVE and CREDIT held, with STAGING and ENV; 2: default credit limits and the eval's 150,000-token cap, the stored test key on the host never shown; 3: every check read from the host evidence and Keith's own answers; 4: n/a, nothing needed a fix), DEPLOY n/a (no deploy)
FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered:** USER-TEAMS-LIVE-02, for the roster-by-name check with runs on.
- **Superseded:** the PRD wording, folded into GOV-PRD-SYNC-01.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- the three authorizations false;
- staging runs 7ac9084, and runs are off.
