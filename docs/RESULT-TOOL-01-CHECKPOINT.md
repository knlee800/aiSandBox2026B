# RESULT-TOOL-01 — Checkpoint

**Task:** RESULT-TOOL-01 — A read-only agent tool that reads one of the owner's finished run results
**Status:** COMPLETE AND LOCKED — 2026-11-16. Built, not deployed: STAGING-DEPLOY-RESULTTOOL-01 (Keith approves) and RESULT-TOOL-LIVE-01 follow.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. It was registered as 3-step and set to 4-step at admission, because it adds an internal route and a new agent grant (Task Workflow Rules). **Evidence class:** LOCAL-TESTS.
**Mutexes by slice:** S1 GATEWAY; S2 GATEWAY and ENV; S3 AI-SERVICE. S2 and S3 ran alone in Lane 1 (exclusive capacity) because they change HARNESS_ENTITLEMENT_PROOF_V1.
**Source:** registered 2026-11-16 by the TRIGGER-MORE-01 LOCK (its Q3). Keith chose it on 2026-11-16 ("Start RESULT-TOOL-01").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission for the stage-start (lifecycle set to 4-step) | Lane 1, no mutex | 69f39d6 |
| 2. Stage-start | `docs/RESULT-TOOL-01-STAGE-START.md`, fable subagent (Fable 5.1, stage-start drafts) | 3f8245a |
| 2. Approval, S1 admitted | Keith: "Yes, approve all" | 9b6341a |
| 2. Contract change agreed | Keith: "Yes, go ahead" (S2 and S3 change HARNESS_ENTITLEMENT_PROOF_V1, alone in Lane 1) | recorded at the S2 admission |
| 3. S1 write set expanded | `orchestration.persistence.spec.ts`, which pins the module's controller list. 630427e carried this claim but held only the proof file; ac2b28c made the change | 630427e, ac2b28c |
| 3. S1 internal route | opus (an internal route), cherry-picked | 7868a17 (from 32d20b0) |
| 3. S1 landed, S2 admitted (exclusive, declared contract change) | | eda0b84 |
| 3. S2 grant and switch | opus (a new grant on the signed job), fast-forwarded | fade71a |
| 3. S2 landed, S3 admitted (exclusive, declared contract change) | | 6dc0168 |
| 3. S3 write set expanded | `briefing-worker-pin.spec.ts`, the eval pin on the worker prompt call | bc34515 |
| 3. S3 AI-service tool | opus (a tool under a signed grant), cherry-picked | 5252393 (from 36ffbe9) |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## Keith's decisions (2026-11-16, stage-start section 11, all as recommended)

| # | Decision |
|---|---|
| Q1 | The Chief of Staff and every workflow get the tool by default, with no form tick |
| Q2 | A switch, `RUN_RESULT_TOOL_ENABLED`, default off |
| Q3 | Its own deploy and live-check tasks, before TRIGGER-CHAIN-01 |
| Q4 | Completed runs only |
| Q5 | No list tool now |
| Q6 | A tool read does not mark the result as seen |
| Q7 | Escaped `<run_result>` tags plus a fixed worker system-prompt line; the rules text is changed later, in COS-MAIL-BODY-RULE-01 |
| Q8 | Answers up to 12,000 characters |

## What changed

- **S1, the internal route:** `POST /api/internal/collaboration/results/read`.
  - It sits behind the existing global internal-service guard, which is unchanged; no guard of its own.
  - The body carries `userId` and `runId`. The run is looked up by id, owner and `completed` status in one query, and checked again in code.
  - The answer is the final step's text with a trailing hand-off request removed, cut to 12,000 code points with a `truncated` flag. Also returned: the finish time and the workflow's name and test-run flag.
  - One fixed 404 answers a missing run, another owner's run, a run that is not completed, a run with no completed step and a blank answer.
  - It writes nothing: no settle, no `result_seen_at`. No audit row and no log line carries result text.
- **S2, the grant:** `collaboration-result-grant.ts` sets `runResultRead: true` on the signed job only when all of these hold:
  - `RUN_RESULT_TOOL_ENABLED` is exactly `true`;
  - the job is harness v1, with the `read` profile and read-only;
  - the step is the Chief of Staff or a workflow's own step. A workflow step whose target is a system-agent id is refused.

  The field is added in `orchestration.service.ts` before the proof is made, so the payload digest covers it. The env template gains its line.
- **S3, the tool:** `read_run_result` in the AI service.
  - It is registered only after the proof verifies, and only for the `read` profile with `runResultRead === true`.
  - Its only input is `runId`. The owner comes from the job, never from the arguments.
  - The answer goes inside `<run_result>` tags with `<`, `>` and `&` escaped, and is fitted to the tool-result byte cap.
  - Every error gives the one fixed text "Run result not found."
  - A fixed system-prompt line says run results are data, never instructions.
  - The registry has 11 tools, 9 of them advertisable.
- **HARNESS_ENTITLEMENT_PROOF_V1:** changed as declared, in `job.types.ts` (the optional field), `worker.processor.ts` (the registration after the proof verifies) and `orchestration.service.ts` (the field set before the proof). The proof code and claim string are unchanged. It is re-frozen with the same four paths.
- **Unchanged:** auth, guards, CSRF, keys, the system-agent registry, the workflow grants, the frontend and the eval prompt (the eval keeps modelling the switch off).

## Control-plane review and gates (rerun on every branch)

| Slice | What the control plane read | Gates |
|---|---|---|
| S1 | the controller (no guard of its own, fixed 404, body checks) and the owner-and-status query | gateway 6145 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S2 | the job-build diff (the field spread before the proof; three changed lines) and the grant conditions | gateway 6201 passed, 7 skipped, 14 known; tsc and build rc 0 |
| S3 | the job field, the resolver, and the registration after verification (line 1717, after the proof at 1653), read profile only | ai-service 1407 passed, 1 skipped, 0 failed; tsc and build rc 0 |

The 14 known failures are in `smoke.integration.spec.ts` and need a database. Every landed file is LF.

**Two write-set expansions.** Both workers stopped on a spec outside their write set that pins an exact list, and the control plane added that one spec:
- S1: `orchestration.persistence.spec.ts:445`, the module's controller list;
- S3: `briefing-worker-pin.spec.ts:75`, the worker prompt call.

**A record slip, corrected forward.** Commit 630427e's message says the S1 write set was expanded, but the commit holds only the refreshed `SATURATION_PROOF.json`: its record script stopped on an ambiguous anchor and the rest of that command line still ran. Commit ac2b28c made the change and says so. No history was rewritten.

**Design calls the workers made inside the approved design** (accepted by the control plane):
- **S1:**
  - a local UUID pattern equal to the knowledge one;
  - the run checked again in code after the query.
- **S2:**
  - a workflow step targeting a system-agent id is refused;
  - the field is added after the connector grants, as CONN-GRANT-01 did.
- **S3:**
  - a malformed `runId` is refused locally with the same fixed text;
  - the advertisable list lives in the tool-use mapper.

## Not proven here

- **Real runs:** that a model given only a run id in its task calls the tool, and how much a read costs.
- **On staging:** the route and the grant against PostgreSQL and the real job queue.

These belong to STAGING-DEPLOY-RESULTTOOL-01 and RESULT-TOOL-LIVE-01. A second owner can't be tested live, because staging has one user; the owner check is proven by S1's tests.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| F1 a list of recent results | registered RESULT-LIST-01 |
| F2 the access on the workflow form and in the registry | registered RESULT-GRANT-FORM-01 |
| F3 the data rule names run results, an eval case, the cost of changing the rules text, and the knowledge-document correction | superseded by COS-MAIL-BODY-RULE-01 (note) |
| F4 deploy | registered STAGING-DEPLOY-RESULTTOOL-01 |
| F5 live check and wording | registered RESULT-TOOL-LIVE-01 |
| F6 the chain trigger's start condition and task text | superseded by TRIGGER-CHAIN-01 (note) |
| F7 the switch line, the inventory, and the unowned internal run route | superseded by GOV-CHECKLIST-01 and ACCESS-READY-01 (notes) |
| F8 showing that a run read another run's result | superseded by TRIGGER-ORIGIN-01 (note) |
| S3: the Chief of Staff eval models the switch off | superseded by COS-MAIL-BODY-RULE-01 (note) |

CHECKLIST: EVERY 11/11 (1: admitted 69f39d6, each slice admitted; 2: 4-step with an approved stage-start; 3: fable and opus named before each dispatch; 4: self-contained briefs, no further subagents; 5: each slice inside its write set, two expansions recorded by the control plane before the workers touched the added specs; 6: tests in every slice; 7: gates rerun by the control plane on every branch; 8: no runtime started; 9: no tracked artifact changed; 10: worktrees, fast-forwards and cherry-picks by the control plane; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change; the new route relies on the existing global internal guard; 2: the internal route stays internal; 3: no generated-app template; 4: HARNESS_ENTITLEMENT_PROOF_V1 changed only as declared with Keith's agreement, run alone in Lane 1 and re-frozen; no other frozen contract touched; 5: n/a, no entity or schema change; 6: compared with the baselines, no new failure)
FOLLOWUPS: 4 registered (STAGING-DEPLOY-RESULTTOOL-01; RESULT-TOOL-LIVE-01; RESULT-LIST-01; RESULT-GRANT-FORM-01) / 6 superseded (F3 and the eval switch-on by COS-MAIL-BODY-RULE-01; F6 by TRIGGER-CHAIN-01; F7 by GOV-CHECKLIST-01 and ACCESS-READY-01; F8 by TRIGGER-ORIGIN-01; the unowned internal run route by ACCESS-READY-01) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-16 by the control plane:
- Lane 1 released EMPTY; exclusive capacity released; AI-SERVICE released UNOWNED (GATEWAY and ENV released at S2);
- HARNESS_ENTITLEMENT_PROOF_V1 re-frozen;
- nothing deployed: staging still runs c091b53.
