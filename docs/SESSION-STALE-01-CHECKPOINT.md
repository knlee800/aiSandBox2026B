# SESSION-STALE-01 — Checkpoint

**Task:** SESSION-STALE-01 — Do not reuse a session whose container is gone
**Status:** COMPLETE AND LOCKED — 2026-10-27
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** defect D1 of the CLEAN-BASELINE-DEPLOY-01 C1 repeat (check 9), recorded in repository commits 3a72f5532f0abec5da46487614ee9b190216def6 and 9332bc1.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | Keith approved the task with a provisional scope on 2026-10-27 | 3a72f5532f0abec5da46487614ee9b190216def6, 9332bc1 |
| 2. Stage-start | option 2 approved by Keith; docs/SESSION-STALE-01-STAGE-START.md; scope frozen and admitted to Lane 1 | 2328f7f3610b3c727b711c7e444fa4d303d75dd6, 59e7b1f201fd010d3c7544bd7980ce6cf0e8126c |
| 3. Implementation, run 1 | container manager; Cursor CLI, grok-4.7-xhigh, session 4f842d5a-6903-489b-b47e-2f7b8ddfcb37 | b9b818f3e00563f92c6cf5d2b7bda7b7d04e5393 |
| 3. Implementation, run 2 | frontend; Cursor CLI, grok-4.7-high, session edf8db9c-490c-4280-a810-cf6b824054d0 | c003daf64bb1a07d43759724e3f0b19fbfc0170b |
| 4. Consolidation and LOCK | Part 1: Step 3 result | e3bcbac165669166116d3219c287387c42f444ea |
| 4. Consolidation and LOCK | Part 2: this checkpoint, ARCHITECTURE.md section 4 CURRENT, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

The two implementation commits change exactly the eight files of the frozen write scope:

| File | Added | Removed |
|---|---|---|
| `services/container-manager/src/sessions/sessions.service.ts` | 125 | 37 |
| `services/container-manager/src/sessions/sessions.service.spec.ts` | 458 | 0 |
| `services/container-manager/src/docker/docker-runtime.service.ts` | 25 | 0 |
| `services/container-manager/src/docker/docker-runtime.service.spec.ts` | 79 | 0 |
| `frontend/lib/open-project-in-fresh-session.ts` | 21 | 1 |
| `frontend/lib/open-project-in-fresh-session.test.ts` | 156 | 0 |
| `frontend/components/workspace/workspace-projects.logic.ts` | 14 | 1 |
| `frontend/components/workspace/workspace-projects.logic.test.ts` | 50 | 0 |

- `DockerRuntimeService.getSessionContainerState` returns `running`, `stopped` or `missing` from the `sandbox-session-<id>` lookup and lets Docker errors through.
- In `SessionsService`, the seven session operations call `terminateIfContainerLost` only when their Docker call fails. For a stopped or missing container it applies the guarded termination with `container_lost`, logs the governance event, schedules the existing cleanup for a stopped container, clears the in-memory tracking and throws `GoneException` with `(reason: container_lost)`. For a running container, or a failed state check, the original error is rethrown. No gateway notification; the gateway ends its own session from the 410.
- `openWorkspaceProject` throws `ProjectOpenError` with the HTTP status and the same message. `openProjectInFreshSession` retries the open once in a fresh session when the open into a reused session fails with 410; other failures propagate.
- Refinement within the frozen design: the cleanup is scheduled only for a stopped container; a missing container has nothing to stop or remove.

Not changed: the gateway, the internal endpoints and the stop body, preview paths, the associate-only open path, visible text and message files, packages, and the leftover debug fetch in `startSessionContainer`.

## Validation on the committed tree

| Gate | Result |
|---|---|
| container manager `npm test` | 9 suites, 192 tests pass (156 before, 36 new) |
| container manager `npm run build` | exit 0 |
| frontend `npx tsc --noEmit` | exit 0, no output |
| frontend `npm test` | 786 pass, 0 fail (781 before, 5 new) |
| frontend `npm run build` | exit 0; `frontend/tsconfig.tsbuildinfo` restored after each build |
| Write scope | only the eight files |

The reviewer ran the gates independently after Cursor, the frontend typecheck and build one after another.

Evidence copied to `C:\Users\knlee\aisb-preflight\SESSION-STALE-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-cm-npm-test.txt` | 20816 | `079314bca1666ecbdc2f1e64b1ebb82064fa6cb346d8ef8345302c983f388c34` |
| `reviewer-cm-npm-build.txt` | 51 | `d8cf8ea1c2c14197f5ab98901700b49b16d0ee0d9d4f61e16fdbe3dbdc1b8d33` |
| `reviewer-fe-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-fe-npm-test.txt` | 169522 | `e84d6856b288c1333d5522d0b1a957115dc34cf87c26d5e5c18b107c911d7d28` |
| `reviewer-fe-npm-build.txt` | 2855 | `747b6c4c6f2c9c4e3eb497851b9b4b062fa72bce6d44c89403b3e9eda5212a22` |
| `cursor-brief-run1.txt` | 5506 | `c0f777eb242f2125d101a3094941716e1c5e062a11ba0dd20e04b55d0ea2e40a` |
| `cursor-brief-run2.txt` | 4167 | `a6da5a739eae637f850cb20f08e1be421c840a3892a3db71086f21ff74445d1b` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Stage-start record written with design, scope, mutexes, evidence class and contracts frozen | met (2328f7f, 59e7b1f) |
| Opening a project whose reusable session has no running container opens it in a working session without an error | met at the code level: the container manager returns 410 and the open retries once in a fresh session (tests); live proof is the DEPLOY-01 checks 4 and 9 repeat |
| Sessions with a running container are reused and behave as now; a dead session is ended the first time it is used | met (running-container and success-path tests) |
| Tests cover the dead-container case, and the stage-start gates pass | met (41 new tests; gates as above) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Live behaviour after a reboot is not verified here. The staging proof is the CLEAN-BASELINE-DEPLOY-01 checks 4 and 9 repeat on `C1 repeat`, which needs a re-admission record approved by Keith.
- Preview status polling of a dead session still fails until the session is ended or expires; out of scope, as recorded at the stage-start.
- Follow-up candidates, not registered: the debug fetch to 127.0.0.1:7870 in `startSessionContainer` (container manager) and in `page.tsx`; the container-manager quota evaluation logging no such table and failing open.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-27 by the control plane. Lane 1 released EMPTY; CONTAINER-MANAGER and FRONTEND released UNOWNED; GOVERNANCE UNOWNED. ARCHITECTURE.md section 4 lost-container note is CURRENT. CLEAN-BASELINE-DEPLOY-01 stays READY and not admitted until a re-admission record.
