# CHECKPOINT-PERSIST-02 — Checkpoint

**Task:** CHECKPOINT-PERSIST-02 — Keep checkpoint history across sessions of a project
**Status:** COMPLETE AND LOCKED — 2026-10-27
**Workstream:** RELIABILITY. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** the CLEAN-BASELINE-DEPLOY-01 C1 check 9 failure (repository commit 136bf6da5a6fd3503ed56e255e7d75aa21f56ebf). **Design:** docs/CHECKPOINT-PERSIST-02-STAGE-START.md.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | Registered with a provisional scope on 2026-10-27 | 7f76134f57eb34b53f223af661501dab41d75ca0, c6b8c547cf68439aeee923bc53a7c13ede482871 |
| 2. Stage-start | Option 1, a git history bundle per project; ARCHITECTURE.md section 11.5 row PLANNED; exact scope frozen; admitted to Lane 1 with CONTAINER-MANAGER and GATEWAY | 10b76a1025be4890c064815110e1280213994187, c5ee55360cb1d8a75c1ffa5b768a4f068a284020 |
| 3. Implementation, run 1 | container-manager; Cursor CLI, grok-4.7-xhigh, session 8eae432b-21aa-40be-9ed6-674d02565ef3, two passes | fb060d1247c28d85a6e2d5b4d0deb9fc591aabc5 |
| 3. Implementation, run 2 | api-gateway; Cursor CLI, grok-4.7-xhigh, session e640842b-ed6e-4022-8bf7-c25ecf6a2ce1, two passes | 70ea8b069d7d94657cd40431853d13c9f51fbbd3 |
| 4. Consolidation and LOCK | Part 1: Step 3 result | 29a18950c0d6ec0abfc17bb9971c91841856f884 |
| 4. Consolidation and LOCK | Part 2: this checkpoint, ARCHITECTURE.md row CURRENT, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

- **Container-manager** (`services/container-manager/src/git/`, 5 files, 1000 lines added, 3 removed): each checkpoint commit gets `refs/checkpoints/<hash>` before it is recorded; `InternalCheckpointHistoryController` serves `POST /api/internal/checkpoint-history/:sessionId/save` and `/restore` behind `InternalServiceAuthGuard`; save stores a git bundle of the session repository at `<projects root>/_checkpoint-history/<projectId>.bundle` (temporary file, then rename); restore fetches it into the new session with `--update-head-ok`, points HEAD at the saved branch or commit, and runs `git reset -q` without touching the restored files.
- **Gateway** (`services/api-gateway/src/`, 11 files, 1049 lines added, 40 removed): the client calls both endpoints with `X-Internal-Service-Key`; after each recorded checkpoint one background step looks up the session and saves the project history; the session snapshot restore endpoint restores the history after the files; listing returns the owner's rows across all sessions of the project, newest first; revert and diff accept a same-project, same-user row; sessions without a project are unchanged.
- Failures in history work are logged and never fail a checkpoint, a revert or a project open.

Not changed: the frontend, message files, the snapshot format, the database schema, entities, repositories, guards, ops scripts and backup.

## Validation on the committed trees

| Gate | Baseline | After |
|---|---|---|
| container-manager `npm test` | 8 suites, 137 tests pass | 9 suites, 156 tests pass |
| container-manager `npm run build` | pass | pass |
| api-gateway `npx jest --maxWorkers=2` | 170 suites, 2280 tests pass; `smoke.integration.spec.ts` fails 14 tests | 171 suites, 2309 tests pass; `smoke.integration.spec.ts` fails the same 14 tests |
| api-gateway `npm run build` | pass | pass |

`smoke.integration.spec.ts` needs a live PostgreSQL and Redis, which this task does not run. The gateway suite runs with `--maxWorkers=2` because the default worker count runs out of memory on this machine. Before the gates, `npm ci` at the repository root (approved by Keith) restored the lockfile install: `services/api-gateway/node_modules` had been missing, so the gateway had resolved `ioredis` 5.10.0 instead of its pinned 5.9.3. The gates use Node 22.14.0.

Evidence copied to `C:\Users\knlee\aisb-preflight\CHECKPOINT-PERSIST-02\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-cm-npm-test.txt` | 20816 | `0174e17a5f5b874de327f97c181c8e54d56cb533acca427f2f8bf108fa1153db` |
| `reviewer-cm-npm-build.txt` | 51 | `d8cf8ea1c2c14197f5ab98901700b49b16d0ee0d9d4f61e16fdbe3dbdc1b8d33` |
| `reviewer-gw-jest-maxworkers2.txt` | 262328 | `319f5c7ee9de12d0cb4de5af66ca9ff06b806c493c85c0d72999a21fe4ce005d` |
| `reviewer-gw-npm-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `baseline-cm-npm-test.txt` | 20756 | `53a159f8514b774b567b589cda6bee2e2dc843b999aca2b95a6c258fbe22bc3d` |
| `baseline-gw-jest-maxworkers2.txt` | 262572 | `24ec0f80fb3a3d94000bc7b3995a11d6a1a05dcea65c8908aaf46c2786080f09` |
| `cursor-run1-brief.txt` | 4277 | `4c0ee17644b594f22e3ff4d30d4c2e653158d87b3efc5fee333c6132373cad66` |
| `cursor-run1-followup-brief.txt` | 1422 | `10d4af77be4c7993d05bfbfa75054e2aea56f6fd4ecd6df2350932e5bd2d2398` |
| `cursor-run2-brief.txt` | 5733 | `a7f6be97313fde5050a609f538d2370378875c4018a5171c6723daeec3ae47d0` |
| `cursor-run2-followup-brief.txt` | 1539 | `b6f25d8618f31942e8dd1df4726d74ed6d795386cc60a4013dd087cee566d004` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Stage-start record written: design, ARCHITECTURE.md section 11.5, exact scope, mutexes, evidence class and contract frozen | met |
| After a reopen in a new session, the earlier checkpoints are listed and a revert to one of them works, with the editor, file tree, preview and list refreshed | met at the API level by the tests; the live end-to-end proof is the CLEAN-BASELINE-DEPLOY-01 C1 repeat on staging, as the stage-start records |
| Existing checkpoint creation and revert within a session are unchanged | met (every existing test passes) |
| Tests cover the cross-session history, and the gates named at the stage-start pass | met (19 container-manager and 29 gateway tests added; gates as above) |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Residual risks

- Bundle size grows with history; there is no pruning.
- Restore installs git on demand and needs the container network.
- History is restored only through the session snapshot restore endpoint, so a project opened without any snapshot gets no history.
- A checkpoint made in a session whose save failed stays listed, and a revert to it fails as a revert does today.
- Real Docker, git and database behaviour is not verified here.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-27 by the control plane. ARCHITECTURE.md section 11.5 row Checkpoint history across sessions is CURRENT. Lane 1 released EMPTY; CONTAINER-MANAGER and GATEWAY released UNOWNED; GOVERNANCE UNOWNED. Both fixes for the DEPLOY-01 C1 check 9 defect are now LOCKED; CLEAN-BASELINE-DEPLOY-01 stays READY and not admitted until its own re-admission record.
