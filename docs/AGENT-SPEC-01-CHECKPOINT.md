# AGENT-SPEC-01 — Checkpoint

**Task:** AGENT-SPEC-01 — Typed agent spec fields
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01 (plan A9, C7, C9, C10). Admitted on 2026-11-10 under Keith's instruction to keep starting the next tasks ("do not stop!!! ... keep looking for the next task to start").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration, corrected at admission | Lane 1 with GATEWAY and AI-SERVICE | 813de3d |
| 2. Stage-start | docs/AGENT-SPEC-01-STAGE-START.md, drafted by a fable subagent, approved by the control plane | c5cd1d5 |
| 3. Implementation | opus subagent in worktree lane/AGENT-SPEC-01 (916142a), cherry-picked onto main | a1fc29c |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan, ARCHITECTURE.md, canonical validator | this record |

Two points the stage-start left open, settled by the control plane with the drafter's recommendations. Both are reversible, and Keith may change them:
- the v1 platform model list is the four Anthropic ids;
- `collaboration-tool-profile.ts` was added to the write set.

## What changed (8 files)

| Design | Met by |
|---|---|
| D1 Fields | Typed `SystemAgentPromptSpec` (tone, replyLanguage, purpose, procedure, result, rules), `SystemAgentAccess` (tool profile, knowledge scopes, connector tool ids) and `SystemAgentModel`. `modelChoice` is removed. Shape checks are `systemAgentPromptSpecProblems` and `isSystemAgentModel`. |
| D2 Rendering | `renderAgentInstructions` joins the non-empty parts with a blank line; `instructions` is derived from it. **Accepted deviation:** the three coding texts (lead, writer, reviewer) stay single-quoted literal constants used as `procedure`, because `review-prompt.spec.ts` reads them by declaration text. They were never exported, and their rendered output is still pinned. |
| D3 Byte-identical | All eight rendered prompts equal today's text: 0, 290, 153, 300, 2576, 1164, 832 and 1159 characters, pinned in a test and cross-checked against c5cd1d5. The instruction text lines only moved. |
| D4 Hash | It covers `{id, tone, replyLanguage, purpose, procedure, result, rules, instructions, toolProfile, scopes, connectorToolIds, model, teamRole}`. All eight hashes changed once; the Chief of Staff's went d34f3eb4 → 7daa2a2e. Nothing compares them: the only store is usage-ledger provenance, and no signed job, grant or proof carries the hash. |
| D5 Never-do | `neverDoFor(access)` returns typed codes and is not in the prompt, hash or public row. For the Chief of Staff it returns FILES_NO_CHANGE, MAIL_READ_ONLY, CALENDAR_READ_ONLY, KNOWLEDGE_ONLY_SCOPES (six scopes), EXTERNAL_ACTIONS_NONE, DECISIONS_OWNER and ACCESS_FIXED. |
| D6 Models | `platform-models.ts` lists the four Anthropic ids at 1 credit per 1K tokens. The tests check each id against the catalogue and the cost against `CREDIT_RATES`. |
| D7 Model today | Every agent uses `{ choice: 'server' }`. Nothing applies a platform model to a run. |
| D8 4000 limit | Tested for all eight. `agentInstructionsWithinLimit` returns true at 4000 and false at 4001. |
| D9 Connector access | `COLLABORATION_ROLE_CONNECTOR_TOOLS` is built from the registry's `connectorToolIds` and has the same shape as before. The grant tests are unchanged and pass. |
| D10 Drift check | It re-renders `CHIEF_OF_STAFF_SPEC` from the source and checks the eval copy (2576 characters, unchanged). It also pins the renderer, the draft snippet, the hash key order and the connector ids. The eval's hash pin was updated. |
| D11 Public row | Unchanged. |

## Gates (control-plane rerun on the branch)

| Service | Tests | Build | Baseline |
|---|---|---|---|
| api-gateway | 2894 passed, 7 skipped; 14 failed, all in `smoke.integration.spec.ts` | exit 0 | 2879 + 15 new; the same 14 known smoke failures |
| ai-service | 1231 passed, 1 skipped | exit 0 | 1230 + 1 new drift test |

The worker saw two gateway suites fail once under load (`stored-orchestration-audit.recorder.spec.ts`, `users.service.spec.ts`). Both passed alone and in its next two full runs, and they passed in the control-plane rerun too.

After the cherry-pick:
- `services/` on main is identical to the gated branch;
- the changed files are LF.

## Limits

- Not deployed. The new hashes reach the usage ledger and `GET /api/system-agents` only after a deploy, and nothing compares them.
- If the coding roles are ever split into parts, `review-prompt.spec.ts` needs the same re-render treatment as the briefing drift check.

CHECKLIST: EVERY 11/11 (3: opus, passed explicitly; 4: self-contained brief; 9: no tracked artifacts), BACKEND 5/6 (5: n/a, no entity, schema or migration change; 6: compared with the latest baselines, no new failure)
FOLLOWUPS: 1 registered / 2 superseded / 0 dropped / 0 undisposed. Done in this record: the backlog's 2296 corrected to 2576, and ARCHITECTURE.md:980 and 1004 corrected (the registry lives in the Gateway since AGENT-DEFS-01). Hash information only.
- registered: MODEL-PRICE-01, a credit price per model, NOT_READY until Keith sets prices;
- superseded: spec fields, never-do and models over an owner route, by BIZ-USER-01A and 01B;
- superseded: applying a platform model to a run, by BIZ-USER-01C.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; GATEWAY and AI-SERVICE released UNOWNED. DESIGN-GAPS-01B stays ACTIVE in Lane 2.
