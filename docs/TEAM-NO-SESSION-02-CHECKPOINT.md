# TEAM-NO-SESSION-02 — Checkpoint

**Task:** TEAM-NO-SESSION-02 — Run business workflows from the Team page without a workspace session
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-10 from Keith's decision ("Yes, list them") at TEAM-NO-SESSION-01. Plan row 30.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | from Keith's decision | (TEAM-NO-SESSION-01 lock) |
| 2. Stage-start | docs/TEAM-NO-SESSION-02-STAGE-START.md, drafted ahead of admission by a fable subagent. Keith chose DECISION A on 2026-11-10 ("Yes, business project"). B follows the registered scope; C, D and E were taken on their recommendations | 6769698 |
| 3. Implementation | opus subagent (Opus 5.5: moves the session requirement on the start route, writes sessions and projects rows, spans gateway and frontend) in worktree lane/TEAM-NO-SESSION-02, fast-forwarded onto main | e9d8128 |
| 4. LOCK | this checkpoint, board, backlog, sidecar, plan, an ARCHITECTURE.md row, canonical validator | this record |

## What changed

**`POST /api/collaboration/runs`**
- A workflow body without `sessionId` (`{ task, workflowId, testRun? }`) answers 201. The run uses the owner's business project and session. The response shape is unchanged.
- With a `sessionId`, the path is today's path, and an unusable session still answers 409 with no fallback.
- A team body without `sessionId` still answers 400. So do a malformed `sessionId`, and `team` sent together with `workflowId`.
- Every refusal comes before any business row is created: 404, the 409 workflow codes, 429, 409 budget, 503.
- A plan whose signed profile is not `read` answers 409 WORKFLOW_INVALID.
- 401 and 403 are unchanged.

**`GET /api/collaboration/workflows`** gains `business: { projectId } | null`. It is read-only and never creates rows.

**Business rows** (`collaboration-business-session.ts`). Every lookup is by owner, oldest row first.

| Row | Values |
|---|---|
| Project | name "Business workflows", slug `business-<userId>`, private, `workspaceId` null |
| Session | that project, `containerId` null, status stopped, `expiresAt` = `createdAt`, `terminatedAt` null; `lastActivityAt` touched on reuse |

The worker made the stage-start's lookups stricter, and the control plane accepts it:
- The project lookup also requires `workspaceId IS NULL`, so a project the owner made through the projects routes is never taken.
- The session lookup also requires `status = stopped` and no container, so a workspace session opened on the business project is never taken.

A terminated business session is replaced on the same project.

The control plane checked the code for anything that would act on an expired session: there is no expiry sweeper, and the orphan reconciler does not touch sessions. The session therefore stays as written. It is outside the five-session quota, hidden from the default session list, and unusable to the workspace.

**Caller note.** "This run has no project files or workspace. Do not use the file tools." is passed as `projectInstructions` for session-less starts only. The workflow version hash and `agentDefinitionVersion` are unchanged. The enqueued job and the ledger intent carry the business session id.

**Team page.**
- Without a session, with a workflow selected: the task box, Start and Start test run follow `workflowStart` (buttons, hint and spend line). The start body has no `sessionId`.
- Without a session and no workflow: no task box, no team picker, and the reworded `missingSession` hint in three languages.
- "Past runs" uses `business.projectId` without a session (a `projectId` in the URL wins), with a new `pastRunsBusiness` line.
- With a session, nothing changes.
- Existing test IDs are kept. The worker read Impeccable and Emil and kept to existing components and DESIGN.md patterns: no new styles, motion, icons or modals.

The frozen contract HARNESS_ENTITLEMENT_PROOF_V1 is untouched: the diff over `orchestration.service.ts`, `src/ai` and ai-service is empty. A test checks that a session-less job is signed with the same key set as one with a session.

Files: `orchestration/collaboration-business-session.ts` and its spec (new), `collaboration.controller.ts` and its spec, `orchestration.module.ts`, `frontend/components/collaboration/` (page, view, workflows and their test), and the three message files.

## Gates (control-plane rerun on main after the fast-forward)

| Gate | Result |
|---|---|
| gateway `npx jest --maxWorkers=2` | 3364 passed (3344 + 20 new), 7 skipped, 14 failed; the 14 are the known smoke.integration failures |
| gateway `npm run build` | exit 0 |
| ai-service `npx jest --runInBand` | 1296 passed, 1 skipped, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 1505 passed (1489 + 16), 0 failed |
| frontend `npm run build` | exit 0; tsconfig.tsbuildinfo restored |
| line endings | all 12 files LF in this checkout |

## Limits

- **Not deployed.** STAGING-DEPLOY-WF-01 carries it.
- **Not run against a real database:** the two rows' inserts (Postgres defaults and the CreateDateColumn), and the model's behaviour with the caller note. The tests use fake repositories.
- **The browser flow** needs Keith's live check in BIZ-LIVE-04.

CHECKLIST: EVERY 11/11, UI 9/9 (9: the live check is in BIZ-LIVE-04), BACKEND 6/6 (1: no guard, cookie, CSRF, key or entitlement change; 3: no generated-app template touched; 4: frozen-path diff empty; 5: n/a, no entity or schema change; 6: only the 14 known smoke failures)

FOLLOWUPS: 2 registered / 4 superseded / 0 dropped / 0 undisposed.

**Registered:**
- HARNESS-NOFILES-01, NOT_READY: the worker stops advertising file tools for runs without a workspace. That needs a HARNESS_ENTITLEMENT_PROOF_V1 change; the caller note makes it cosmetic. Stage-start follow-up 2.
- BIZ-ROWS-HIDE-01, NOT_READY: hide the business project and session from `GET /api/projects` and the admin sessions view, and decide whether the projects routes may open, rename or delete the business project. Stage-start follow-up 5, plus the worker's note.

**Superseded:**
- BIZ-NOPROJECT-01, answered by this task with no remainder (follow-up 1).
- TRIGGER-01 reuses `ensureForOwner`: a line added to TRIGGER-01 (follow-up 3).
- The live-check list: an acceptance line in BIZ-LIVE-04 (follow-up 4).
- The workflows list showing `business` only on its next read: a line in RESULTS-POLISH-01 (worker).

**Done in this record:** the ARCHITECTURE.md data-ownership row (follow-up 6).

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 1 is released EMPTY. GATEWAY, FRONTEND and I18N are released UNOWNED.
