# USER-TEAMS-01C — Checkpoint (slice 01C: form and Team page)

**Task:** USER-TEAMS-01C — User-team form and Team page
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** AGENT. **Lifecycle:** 4-STEP; the stage-start is shared with USER-TEAMS-01. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the USER-TEAMS-01 stage-start approval. Keith approved it ("Yes, approve").

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1-2. Registration and stage-start | shared with USER-TEAMS-01 | 0b05d92 |
| 2a. Admission | Lane 2 with FRONTEND and I18N, beside USER-TEAMS-01B in Lane 1 (disjoint write sets) | 0449d89 |
| 2b. Write set widened | platform-dashboard.tsx and its test, for D18; the worker stopped on it | fa76ab0 |
| 3. Implementation | sonnet subagent (Sonnet 5.5: frontend-only UI and copy in three languages) in worktree lane/USER-TEAMS-01C, two commits, cherry-picked onto main | 2adfbae, e12f99b |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

**Team block (D17)** in the workflow form's Advanced section:
- A checkbox list from `options.teamChoices`, without the row being edited. Each entry shows its kind (Advisor or Your workflow), plus a note for draft and switched-off rows.
- A "{count} of 3" line. A fourth tick is refused with a hint, and a hint says every hand-off waits for approval.
- The section opens when a team is set. A saved member that is no longer a choice stays listed as unavailable, so it can be unticked.
- Advisor names come from translated keys.
- Create sends `teamMemberIds` only when it's non-empty. PATCH always sends it, so an emptied team saves as `[]`.

**Refusals:**
- `ROSTER_TOO_MANY`, `ROSTER_DUPLICATE`, `ROSTER_INVALID_BODY` and the `ROSTER_MEMBER_*` codes, `ROSTER_MEMBER_SELF` included, map to translated team messages.
- A code-less 400 whose text names `teamMemberIds` reads as the team limit.
- The Chief of Staff roster picker also maps `ROSTER_MEMBER_SELF`.

**Summary line (D18):** the workflow summary shows "Team: names" or "Team: None". The dashboard passes the selected row's `teamMemberIds` and the options' `teamChoices`; the change to that file is two lines.

**Team page (D19):**
- `isReportBackHandoff` takes the run's lead: the first agent in the list when the run detail has a workflow, otherwise the Chief of Staff.
- Fixed team ids and the two advisors are never a workflow lead, so coding and advisors runs are unchanged.
- A workflow lead's report-back step reads "{agent} → {lead} (report-back)" and carries the no-edit note. The Chief of Staff label is unchanged.
- Skipped names after a workflow start already resolved from the workflow list and the advisor labels; a test now covers that.

**Copy:**
- New keys in `platform.agentWorkflow`: `teamLabel`, `teamHint`, `teamApprovalHint`, `teamCount`, `teamLimit`, `teamEmpty`, `teamKindSystem`, `teamKindWorkflow`, `teamNoteDraft`, `teamNoteOff`, `teamUnknown`, `teamNames.*`, `summary.team`, `summary.teamNone` and `errors.teamTooMany` / `teamMemberRefused` / `teamMemberSelf`.
- New `collaboration.reportBackStepLead`.
- `sectionAdvanced` is reworded to "Advanced: model, budget and team".
- en, zh-TW and zh-CN all have it, with real Chinese, and the three files have identical key sets (1490 keys).

**Design:** the worker read Impeccable, the Emil Kowalski skill and DESIGN.md. It applied:
- the existing platform checkbox, label and hint classes;
- the roster picker's count and the refused fourth tick;
- `min-w-0` and `break-words` for long names;
- `role="status"` on the count and the limit hint;
- the amber chip for notes, an empty state, and Heroicons v2 Outline only;
- no new motion.

**Files (16):**
- platform: agent-workflow-fields, agent-workflow-model, create-agent-form, agent-workflow-summary, platform-dashboard, with the editor, summary and dashboard tests;
- collaboration: collaboration-roster, collaboration-page, collaboration-workflows test;
- `hooks/useUserAgents.ts` and its test;
- the three message files.

30 + 1 new tests. Two existing assertions were updated, both for new code lists: the refusal map's expected set, and the summary key list.

## Gates

| Gate | Result |
|---|---|
| frontend `npx tsc --noEmit` (branch and main) | exit 0 |
| frontend `npm test` (branch and main) | 1604 passed (1573 + 31), 0 failed |
| frontend `npm run build` (branch) | exit 0; tsconfig.tsbuildinfo restored |
| out-of-slice paths | `git diff --stat` over services, frontend/app, frontend/lib, frontend/components/workspace and office: empty |
| line endings | the 16 files are LF in the work tree and in the committed blobs |

## Limits

Not deployed. The form's team, the report-back label on a real workflow-lead run, and the empty-team round trip are checked live in USER-TEAMS-LIVE-01, after USER-TEAMS-01B and STAGING-DEPLOY-FD-02.

CHECKLIST: EVERY 11/11, UI 9/9 (2: the I18N lease is held by the control plane; 5: DESIGN.md followed; 9: the flows tests can't prove are named for USER-TEAMS-LIVE-01)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. The worker's live-check flows are superseded into USER-TEAMS-LIVE-01's acceptance.

Accepted as designed, not follow-ups:
- A future third advisor would show its English server name on the form until a `teamNames` key is added. Only two advisors exist, and adding one is its own task.
- The worker left a stray build log at `C:\Users\knlee\aisb-worktrees\scratch-build.log`, outside every repository. Keith may delete it.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED. USER-TEAMS-01B stays ACTIVE in Lane 1.
