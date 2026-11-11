# SNAPSHOT-PICK-01 — Checkpoint

**Task:** SNAPSHOT-PICK-01 — Reopen restores only a snapshot of the same project
**Status:** COMPLETE AND LOCKED — 2026-11-11.
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered 2026-11-11 by the CHECKPOINT-LIVE-02 LOCK. Admitted by the control plane under Keith's 2026-11-10 keep-going instruction.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with GATEWAY: `projects.service.ts` and its spec (with CM-BODY-ROUTE-01 in Lane 2) | a0d50cc |
| 1. Implementation | sonnet subagent (Sonnet 5.5: one gateway file and its spec, no auth or contract change) in worktree lane/SNAPSHOT-PICK-01, fast-forwarded onto main | 4a4d800 |
| 2. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

- **The defect:** `ProjectsService.openProjectIntoSession` used `args.snapshotId`, or else the user's newest snapshot across all projects. So reopening project B without a chosen version could restore project A's files into B.
- **Without `snapshotId`:** the reopen now takes the newest snapshot (`listSnapshots` is newest first) whose label names this project. If there is none, no snapshot is restored, `restoredSnapshotId` is null, and the checkpoint history restore still runs.
- **With `snapshotId`:** the explicit id is used exactly as before, and `listSnapshots` is not called.
- **Label rule:** the private helper `parseProjectIdFromSnapshotLabel` mirrors the frontend's `parseProjectScopedSnapshotLabelParts` in `frontend/components/workspace/workspace-snapshots.logic.ts`.
  - The label is trimmed and must be `[project-id:<id>…]`.
  - The id runs up to the first `:name:`, or else `:source:`, and is trimmed. An empty id gives null.
  - The match is exact and case-sensitive, against the trimmed project id.
  - The control plane compared the helper with the frontend function line by line.

**Tests:** 5 new in `projects.service.spec.ts`:
- another project's newer snapshot is skipped, and this project's older one is restored;
- with no snapshot of this project, nothing is restored, the result is null, and the history restore still runs;
- null, plain, empty-id, unterminated and lookalike (`project-B2`) labels are never chosen;
- a trimmed, case-sensitive id match;
- an explicit `snapshotId` is used unchanged.

Before the fix, 4 of the 5 failed; the explicit-id test passed, as expected. One existing test, "restores latest snapshot when snapshotId omitted", had snapshots with null labels. They now carry this project's label.

## Gates

| Gate | Branch (control-plane rerun) | main |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 3805 passed (3800 + 5), 7 skipped, plus the 14 known `smoke.integration` failures | `src/projects` and `src/snapshots`: 6 suites, 60 passed (same tree after the fast-forward) |
| api-gateway `npm run build` | exit 0 | — |
| diff scope | only the two write-set files | — |
| line endings | LF | LF after the fast-forward |

## Limits

- **Not deployed.** It deploys with CM-BODY-ROUTE-01 as STAGING-DEPLOY-SNAP-02.
- **Unlabelled snapshots:** a project whose only snapshots have no project label now restores nothing on reopen, unless the user picks a version. This is the intended behaviour.
- **The label rule exists twice,** in the frontend and in the gateway. Each side's tests pin it. Keeping the two in step is registered as SNAPSHOT-LABEL-01.

CHECKLIST: EVERY 11/11 (3: sonnet named with the reason; 4: self-contained brief, no further subagents; 7: gates rerun by the control plane on the branch and main; 8: no runtime; 9: no build artifact changed; 10: worker committed only on its branch, fast-forwarded by the control plane), BACKEND 6/6 (1 to 5: no auth, guard, internal endpoint, template, contract or entity change; 6: only the 14 known smoke failures)
FOLLOWUPS: 2 registered (SNAPSHOT-LABEL-01; STAGING-DEPLOY-SNAP-02, shared with CM-BODY-ROUTE-01) / 0 superseded / 0 dropped / 0 undisposed. The unlabelled-snapshot behaviour is intended, not a follow-up.

## Lock

COMPLETE AND LOCKED on 2026-11-11 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- not deployed.
