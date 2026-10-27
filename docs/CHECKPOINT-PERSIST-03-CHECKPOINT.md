# CHECKPOINT-PERSIST-03 — Checkpoint

**Task:** CHECKPOINT-PERSIST-03 — Restore a project's checkpoint history when the project is opened
**Status:** COMPLETE AND LOCKED — 2026-10-27
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** defect D2 of the CLEAN-BASELINE-DEPLOY-01 C1 repeat (check 9), recorded in repository commits 3a72f5532f0abec5da46487614ee9b190216def6 and 9332bc1.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Keith approved the task and scope on 2026-10-27; admitted to Lane 1 with GATEWAY | 3a72f5532f0abec5da46487614ee9b190216def6, 9332bc1 |
| 2. Implementation | Cursor CLI (cursor-delegate), grok-4.7-high, session 0b46331c-d14b-4ef6-864b-49daab005f20, one run | 5d1e470d0c697fec0498d596dcd23047d8ad549c |
| 3. Consolidation and LOCK | Part 1: Step 2 result | 2ee65f8f4c76945a90f9e8230d8c278a8951a1f7 |
| 3. Consolidation and LOCK | Part 2: this checkpoint, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

Implementation commit 5d1e470 changes exactly the two files of the write scope (152 lines added, 1 removed):

| File | Added | Removed |
|---|---|---|
| `services/api-gateway/src/projects/projects.service.ts` | 16 | 0 |
| `services/api-gateway/src/projects/projects.service.spec.ts` | 136 | 1 |

- `ProjectsService` receives `ContainerManagerHttpClient` (provided through `SessionModule`, so `ProjectsModule` is unchanged) and a Nest `Logger`.
- `openProjectIntoSession` (`POST /api/projects/:id/open`), after the session is associated with the project and after the snapshot restore when there is one, awaits `restoreCheckpointHistory(sessionId, projectId)`. An error is logged with the session id and the error message, and the open returns the same object as before.
- The history restore also runs when no snapshot is restored. When the association or the snapshot restore throws, the error propagates as before and no history restore is attempted.
- The frontend was checked before the brief: all four project-open call sites in `page.tsx` go through `openProjectInFreshSession`, which calls this endpoint whenever the project has a project-scoped snapshot.

Not changed: the associate-only path, the frontend, the container manager, the snapshot restore, the response shape, `ProjectsModule`, other endpoints, packages.

## Validation on the committed tree

| Gate | Result |
|---|---|
| `npx jest src/projects --maxWorkers=2` | 4 suites, 32 tests, all pass |
| `npx jest --maxWorkers=2` | 171 suites passed, 1 failed, 2 skipped; 2313 tests passed, 14 failed, 7 skipped (baseline 2309 passed, the same 14 failures) |
| `npm run build` | exit 0 |
| Write scope | only the two files |

The 14 failures are all in `src/__tests__/smoke.integration.spec.ts`, which needs a live PostgreSQL and Redis; they fail the same way before the change. The reviewer ran the gates independently after Cursor.

Evidence copied to `C:\Users\knlee\aisb-preflight\CHECKPOINT-PERSIST-03\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-jest-projects.txt` | 1202 | `3ec55e1fc88b722f42d7972706d34440eacca8ad4f859398cc4c1f93b50d31d3` |
| `reviewer-jest-full.txt` | 259590 | `036587e735932560195ea7941c62c9e7a1ef92c3d6011a0d68bfd34f56d51437` |
| `reviewer-npm-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `cursor-brief.txt` | 4939 | `ac035df8b8949350f5879dba1b3dd998cf0f6744cdbe37033c6df063311f7abe` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Opening a project restores its checkpoint history after the snapshot restore, with the session and project ids | met (call-order and argument test) |
| A history restore failure is logged and the open succeeds with an unchanged response | met (failure test) |
| Existing open behaviour is otherwise unchanged | met (diff review; existing tests pass unchanged) |
| Tests cover the call order, the arguments and the failure case | met (4 new tests) |
| Gateway jest passes apart from the known smoke failures, and the build passes | met |
| Only the write-scope files change | met |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- Live behaviour is not verified here. The staging proof is the CLEAN-BASELINE-DEPLOY-01 checks 4 and 9 repeat, after SESSION-STALE-01 is also LOCKED and DEPLOY-01 is re-admitted.
- A project opened without any project-scoped snapshot takes the associate-only path, which restores nothing; out of scope as registered.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-27 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED. SESSION-STALE-01 stays NOT_READY until its Step 2 stage-start. CLEAN-BASELINE-DEPLOY-01 stays READY and not admitted.
