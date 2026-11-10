# OFFICE-07 — Checkpoint

**Task:** OFFICE-07 — Cancel from the office
**Status:** COMPLETE AND LOCKED — 2026-11-10. Built and tested; not deployed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-09 by GOV-ONE-PLAN-01. Ready once the plan item 26 review confirmed cancellation is owner-checked (docs/SECURITY-CHECK-26-REVIEW.md). Admitted 2026-11-10 (4a262ba) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with FRONTEND and I18N | 4a262ba |
| 2. Implementation | sonnet subagent in worktree lane/OFFICE-07 (d6c95bf), cherry-picked onto main | b571cbb |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (7 files)

- **Where the control appears.** "Cancel run" is in the desk panel's Current run section. `officeCancellableRunId(desk)` shows it only when the desk is `queued` or `working` and has a `collaborationRunId`, which every office run already carries. It is not shown for stopping or finished runs, or for desks without a Team run. The office still has no approve, reject or edit control.
- **Confirming.** The first click opens a confirm step, with "Keep run" focused by default. Only "Confirm cancel" sends the request, and only from the confirming state, so a double click sends nothing.
- **States.** While the request runs, both buttons are disabled and the Spinner shows. Then a dismissible result appears:
  - cancelled;
  - already finished (409);
  - not found (404);
  - failed (any other error, including a network error), shown with `role=alert`.
  The office then refreshes its runs and hand-offs through its existing poll path.
- **The request.** `cancelOfficeCollaborationRun(id)` in `frontend/lib/office/office-cancel.ts` sends `POST /api/collaboration/runs/:id/cancel` through the existing `collaborationFetch`, the same CSRF and credentials path as the Team page. It needs no backend change. The route is owner-checked in the controller, in the service and for each hand-off.
- **Copy.** The four existing `collaboration.cancelRun*` keys are reused. There are five new `office.cancelRun*` keys in en, zh-TW and zh-CN: cancelling, cancelled, finished, not found and failed.
- **Visuals.** Heroicons XCircle, ExclamationTriangle and XMark. A quiet danger button on dark, a solid red final confirm, and the brand focus ring.
- **Test IDs.** Six new ones, from office-cancel-run to office-cancel-dismiss. No existing test ID changed.
- **Tests (14 new).** Active-only visibility, the status mapping, each state's text in three languages, and the request target. The repository has no DOM test harness, so the click-to-request wiring is checked in the source, not by a click test.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1319 tests, 1319 pass, 0 fail (1305 before + 14 new) |
| `npm run build` | exit 0 (tsconfig.tsbuildinfo restored) |

- Every changed file is inside the write set.
- After the cherry-pick, the frontend on main is identical to the branch, and the changed files are LF.

The worker saw one environmental build crash in Git Bash: a Node native assertion after "Compiled successfully". The PowerShell build and the control-plane rerun passed.

## Live check (at the next staging deploy, with runs on)

1. Cancel a working Team run from its desk: confirm, see the spinner, then "Run cancelled". The desk moves to Stopped or Done on the next poll, and the Team page shows the run as cancelled.
2. "Keep run" leaves the run going.
3. A run that has just finished shows "already finished".
4. Keyboard focus works, and the zh-TW and zh-CN text appears.
5. Team role desks that vanish when the run ends close the panel, and the result notice goes with it. Judge whether that is acceptable.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 8/9 (6: the idle, cancelling, failed and done states are translated and tested; 9: the click flow needs the live check above)
FOLLOWUPS: 0 registered / 2 superseded / 0 dropped / 0 undisposed:
- the Team page's own inline cancel request could use the new helper: superseded by BUILDER-POLISH-01, whose body now names it;
- the result notice being lost when a desk vanishes: superseded by the live check list above, item 5.

Not a follow-up: the control being in the panel only, not on the desk card, is accepted on record.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 released EMPTY; FRONTEND and I18N released UNOWNED.
