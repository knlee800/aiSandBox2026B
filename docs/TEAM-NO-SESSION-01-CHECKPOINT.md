# TEAM-NO-SESSION-01 — Checkpoint

**Task:** TEAM-NO-SESSION-01 — The Team page without a workspace session
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the TEAM-PRESELECT-01 LOCK (1717f2f). Keith decided on 2026-11-10 ("Yes, list them"). Admitted the same day (262f95a).

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Decision and admission | Lane 1 with FRONTEND and I18N; TEAM-NO-SESSION-02 registered | 262f95a |
| 2. Implementation | sonnet subagent in worktree lane/TEAM-NO-SESSION-01 (109ee17), cherry-picked onto main | ce832eb |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (7 files)

- **The list loads without a session.** The Team page loads the owner's workflows with or without one: `useCollaborationWorkflowList(true)`. `GET /api/collaboration/workflows` is owner-scoped (collaboration.controller.ts:260, checked read-only).
  - The picker is extracted unchanged into `pickerBlock`, so the loading, empty and failed-with-retry states are the same in both views.
  - `?workflowId=` preselection works without a session, so Open on Team from the agent panel now lands on the workflow.
- **Runs stay off.**
  - Without a session, Start and Start test run are shown but hard-disabled, with no click handler; the gateway's start route also needs a session.
  - Beneath them is a hint with an InformationCircle icon. The task box, team picker and presets stay hidden, as before.
  - New test ID: `collaboration-no-session`. The existing `collaboration-missing-session` is kept.
- **The hint.** `missingSession` was reworded in three languages:
  - en: "Runs start from a workspace session. Open Team from a workspace to start one."
  - zh-TW: 執行需從工作區的工作階段啟動。請從工作區開啟團隊後再開始。
  - zh-CN: 运行需从工作区的会话启动。请从工作区打开团队后再开始。
- **With a session, nothing changes.**

Tests (5 new in `collaboration-workflows.test.tsx`):
- the list states without a session;
- both buttons disabled, and the hint, with zh text checked;
- the form and no hint when a session is present;
- a source check that the list is always loaded;
- preselection without a session.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1432 tests, 1432 pass, 0 fail (1427 before + 5) |
| `npm run build` (PowerShell) | exit 0; tsconfig.tsbuildinfo restored |

Every changed file is inside the write set. After the cherry-pick, the frontend on main is identical to the branch, and the files are LF.

## Live check (at the next staging deploy)

1. Open the Team page with no session and with `?workflowId=<id>`: the list loads, the workflow is preselected, both buttons are disabled, and the hint shows.
2. Check the failed state with retry.
3. With a session, nothing has changed.
4. Check zh-TW and zh-CN.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 7/9 (4: the skills were not read as a separate step; existing tokens, classes and states were reused, with no new visual pattern; 9: the live check above)
FOLLOWUPS: 0 registered / 1 superseded / 0 dropped / 0 undisposed. Superseded: the selected workflow's start hint and spend line in the no-session view go to TEAM-NO-SESSION-02, whose body now names them.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. CM-AUTH-01 stays ACTIVE in Lane 2.
