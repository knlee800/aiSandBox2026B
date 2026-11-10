# TEAM-PRESELECT-01 — Checkpoint

**Task:** TEAM-PRESELECT-01 — Open a workflow on the Team page preselected
**Status:** COMPLETE AND LOCKED — 2026-11-10. **Partial against its goal**: the preselect works on any Team page link that carries a session, but not yet from the agent panel (see Limits). Not deployed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the BIZ-USER-01D LOCK (1b51535). Admitted 2026-11-10 (5e90553) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with FRONTEND | 5e90553 |
| 2. Implementation | sonnet subagent in worktree lane/TEAM-PRESELECT-01 (4d3ea6f), cherry-picked onto main. A second pass to carry the id through a session choice stopped correctly, because the page has no session choice | a093bed |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change (5 files in frontend/components/collaboration/ and platform/)

- **Reading the query.** The Team page reads a `workflowId` query parameter next to `sessionId` and `projectId`. When the owner's workflows load and one matches, it is preselected, exactly like picking it, so the team choice clears. The helper is `preselectWorkflowId`, run once and guarded by a ref.
- **Non-matches.** An unknown id, a failed list or no parameter preselect nothing and show no notice. Later list refreshes never override the user's choice.
- **The panel link.** Both Open on Team links in the agent panel go to `/{locale}/collaboration?workflowId=<encoded id>`, built by `openOnTeamHref`.
- **Copy.** No new visible text.

Tests: 5 new. They cover the link builder, the match helper, a source check that the page reads the query, and hook tests: matching, waiting for a loading list, unknown id, failed list, no parameter, and no override after a team pick.

## Gates (control-plane rerun on the branch)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` | 1427 tests, 1427 pass, 0 fail (1422 before + 5) |
| `npm run build` (PowerShell) | exit 0; tsconfig.tsbuildinfo restored |

Every changed file is inside the write set. After the cherry-pick, the frontend on main is identical to the branch, and the files are LF.

## Limits

- **From the agent panel, the preselect does not happen yet.**
  - The Team page takes its session only from the URL (`collaboration-page.tsx:923`).
  - Without one it shows only "Open Team from a workspace session." and never loads workflows (`:926`, `collaboration-view.tsx:281-284`).
  - The agent panel has no session to pass.
- Links that carry `sessionId` preselect the workflow. Today the workspace's Team link is the only one; adding `workflowId` to it is a later choice.
- What the Team page should offer without a session is a product decision. It is registered as TEAM-NO-SESSION-01, for Keith.
- No skill reading was applied: the change has no markup, style or state text.

CHECKLIST: EVERY 11/11 (3: sonnet, passed explicitly; 9: tsbuildinfo restored), UI 7/9 (1 and 2: n/a, no new text; 4: not applied, non-visual logic only; 9: the live check, opening /collaboration?sessionId=…&workflowId=… and seeing the workflow selected, is owed at the next deploy)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed. Registered: TEAM-NO-SESSION-01, about what the Team page offers without a workspace session; Keith decides. Not a follow-up: the worker's note that `python3` is the Windows Store stub.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 released EMPTY; FRONTEND released UNOWNED. CM-AUTH-01 stays ACTIVE in Lane 2.
