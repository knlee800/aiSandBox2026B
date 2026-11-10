# BIZ-LIVE-04 — Checkpoint

**Task:** BIZ-LIVE-04 — Live check of a user workflow
**Status:** COMPLETE AND LOCKED — 2026-11-10. Result: **passed**, with two findings registered and one item not run.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan row 32). Keith admitted it on 2026-11-10 ("Yes, start it").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT; the three authorizations true | 615a402 |
| 2. Live window | runs on (bl4-on.sh), Keith in the browser, host evidence (bl4-evidence.sh, twice), runs off (bl4-off.sh) | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Window

**Runs on: 2026-11-10T08:25:06Z to 09:51:45Z UTC.** Staging was at 324ccca, using the BODIES-LIVE-01 settings:
- the provider was claude-opus-5-5, through the stored test key, with its value never shown;
- the global execution rate was 4 per minute, with a 16,000 token cap per execution;
- the default daily credit limits stayed in place.

The env files were saved before the switch. At the end they were restored, and both match their baselines (gateway.env 568af710, ai.env 721f4772). All units were active afterwards, and no output contains key text.

## What Keith did, and what the host saw

Keith copied the Chief of Staff template ("CoSCopy") and ran it twice from the Team page without a workspace session: first a test run, then a real run. He opened a result on the Results page.

| Host evidence | Result |
|---|---|
| Executions | 2, both completed, claude-opus-5-5: 20,880 tokens in 26.1 s, then 20,934 tokens in 27.0 s |
| Credits | 42 across 2 deduction records (21 each) |
| Collaboration runs | 2, both `completed`, both on the **business** project. Workflow CoSCopy, `testRun` true then false |
| Business rows (TEAM-NO-SESSION-02) | One "Business workflows" project (workspace null), plus one session that is stopped, has no container, expired at creation and is not terminated. Both inserted correctly on real Postgres at the first session-less start. The second run reused them |
| File tools on business runs | 0 lines naming read_file, list_files or search_workspace in the AI journal; the caller note held |
| Seen marks (RESULTS-01) | The real run was marked seen at 09:46:29 when Keith opened it. The test run is still unseen and counts toward the badge |
| Open runs at switch-off | none |

Keith walked the browser steps:
- the copy;
- the test run and the real run without a session;
- Past runs;
- the Results page and its badge;
- the Chinese pages and the workspace project list.

He finished with "ok, done" and reported no problem other than the two findings below. The control plane records that he reported nothing else; it does not claim that each visual item was confirmed one by one.

## Findings (from Keith, confirmed from the host and the code)

1. **Role and Description stop the copy.** Creating an agent, a copy included, requires Role and Description, and the form doesn't say what they are for. They are display-only. `userWorkflowPromptSpec` (services/api-gateway/src/user-agent/user-agent.service.ts:95) renders only tone, reply language, purpose, procedure and result, plus the platform rules. Role and Description appear on the agent's card and profile only.
2. **A new workflow starts switched on, before any test.** The copy was stored with `status = active` (the column default) at 09:27:34, so the panel's "Available for runs" switch showed On from the start. It is safe, because Start stays locked until a passing test at the current version, and the server refuses an untested start. It is misleading, though, and it skips the "a draft can only test-run" step that BIZ-USER-01C intended.

Both are registered as WORKFLOW-CREATE-01.

## Acceptance items

| Item | Result |
|---|---|
| Copy a template, edit it, run it on staging | met |
| Team page without a session: pick a workflow, test run, then Start; past runs list the run | met (host rows) |
| Two business rows insert on real Postgres; the admin view shows one stopped session | rows met (host); admin view not reported |
| The model doesn't use the file tools | met (0 attempts) |
| Opening a result clears it from the badge count | met (seen mark); the count's visual not reported |
| Filters, paging, list and detail states, three languages, phone width, workspace project list | walked by Keith; no problem reported |
| A user without harness access sees the calm notice and no pill | **not run**: both entitled staging accounts have harness on. Covered by unit tests (results-screen 403, platform-dashboard non-200). Moved to ACCESS-READY-01 for the second-user check |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), LIVE 6/6 (PROVIDER-LIVE and CREDIT held; the stored test key, value never shown; default credit limits; host evidence of runs, tokens and credits; runs switched off with the env files at their baselines; outputs checked for key text), DEPLOY n/a (no deploy)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed.
- **Registered:** WORKFLOW-CREATE-01, NOT_READY. A new or copied workflow starts off, or as a draft, until its test passes. Role and Description are prefilled from the template and explained as display-only, or made optional.
- **Superseded:** the no-harness view check, by a line in ACCESS-READY-01.

Evidence in `C:/Users/knlee/aisb-preflight/BIZ-LIVE-04/`:

| File | SHA-256 |
|---|---|
| `bl4-on.sh` | `b4d026fda174b2b474a1377c89cb4e2a2e5123daf798c51774b0815a210bb73c` |
| `bl4-on.out` | `d5b25fcde8b930aae22f62bfeaa5ad91d083f52954f4e606b828c791e87e3992` |
| `bl4-evidence.sh` | `db80e07363b3f19cc5c4bec6ac9c0d0a0621765708ba7197ccb180e062fd5bdf` |
| `bl4-evidence-1.out` | `0ef23e186fb54556933e0262241019569b8ae02e34ff7785a0316d2a5608cc88` |
| `bl4-evidence-2.out` | `372e5a1486f95b638c4a7b099edf1d6e29304c6bdb0489edf20778b5438b4954` |
| `bl4-off.sh` | `fc00b9c3ceeff3a24342d1e8577e9c533f9d9e0591c621a5021c6a8268f1b6b8` |
| `bl4-off.out` | `45afa7301fce6d5147ebf3a9744b566dc51c52991b0151710a0e0a71df2e1d41` |

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- stagingAuthorized, providerLiveAuthorized and creditAuthorized set false;
- staging runs 324ccca, with runs off.
