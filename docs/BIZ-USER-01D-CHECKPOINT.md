# BIZ-USER-01D — Checkpoint

**Task:** BIZ-USER-01D — Workflow summary, switch on or off, and Open on Team
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the BIZ-USER-01C LOCK (8fe430f). Admitted 2026-11-10 (80b5887) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND and I18N | 80b5887 |
| 2. Implementation | sonnet subagent in worktree lane/BIZ-USER-01D (6d52ec7), cherry-picked onto main | a7bc4ad |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (12 files, all in frontend/components/platform/, the hook and the message files)

1. **Summary.** A new `agent-workflow-summary.tsx` sits in the detail panel. It shows:
   - knowledge folder names;
   - the model with its credit cost, from the options route;
   - budgets per run and per day;
   - the state (the existing draft, active or disabled badge);
   - "Tested at this version" or "Needs a test run", from `GET /api/collaboration/workflows` through a new `useWorkflowSummaries` hook, matched by id.

   The dashboard card shows the tested note on one line.
2. **Switch.**
   - On sends `PATCH /api/agents/:id {status: 'active'}`; off sends `{status: 'disabled'}`. The DTO accepts active, draft and disabled; draft is never sent.
   - Switching on is allowed only when the workflow is tested at its current version. Otherwise the switch is disabled, with the hint "Run a test first" and Open on Team. While the summary is loading or has failed, a workflow that is off cannot be switched on.
   - Switching off asks first ("Switch off" / "Keep on").
   - After a switch or a save, both lists refetch. A failed switch shows a translated error.
3. **Open on Team** links to `/{locale}/collaboration` without preselecting the workflow: the Team page reads only sessionId and projectId. Preselection is TEAM-PRESELECT-01.
4. **Budget hint.** For an existing workflow, the editor's budget fields show "Last run: N credits. Spent today: M credits." ("no run yet" when there is none), with loading and failed lines.
5. **States.** The summary has loading (Spinner), failed with "Try again", and empty.
6. **Copy.** 31 new keys under `platform.agentWorkflow.summary.*` in en, zh-TW and zh-CN, with lines added only. Folder names reuse `knowledge.scopes.*`.
7. **Unchanged.** Existing test IDs are kept. `agent-station-card.tsx` gained the `React` import it lacked.

Tests: 38 new.
- 26 in `agent-workflow-summary.test.tsx`: rendering, the tested and untested states, switch-on gating, confirm phases, the link target, the states, the editor hint, and key and placeholder parity with a no-English check.
- 12 in the hook test: the switch and PATCH bodies, parsing and errors.

Skills: Impeccable (labelled sections, a definition list, errors in place with retry, written-out states) and Emil Kowalski (press feedback, a short ease-out on the switch, motion-reduce respected).

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1422 tests, 1422 pass, 0 fail (1384 before + 38 new) |
| `npm run build` (PowerShell) | exit 0; tsconfig.tsbuildinfo restored |

- Every changed file is inside the write set.
- After the cherry-pick, the frontend on main is identical to the branch, and the files are LF.
- The worker's untracked scratch file `frontend/.addkeys.js` was never committed. It went with the worktree's removal.

## Live check (at the next staging deploy with runs on, with BIZ-USER-01B and 01C's items)

1. The summary and card for a workflow.
2. An untested workflow: the switch is disabled, the hint shows, and Open on Team opens the Team page.
3. After a passing test run, it can be switched on, and the panel and card show active.
4. Switching off asks first.
5. After an edit, the tested chip returns to "Needs a test run", and the budget hint shows the last run and today's spend.
6. zh-TW, zh-CN and phone width.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 8/9 (9: the live check above; the repository has no click-level test harness)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed. Registered: TEAM-PRESELECT-01, so the Team page reads a workflowId query and preselects that workflow. Accepted on record, not follow-ups: no DOM click harness, and the list's brief loading state after a switch, which is existing behavior.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND and I18N released UNOWNED. CM-AUTH-01 stays ACTIVE in Lane 2.
