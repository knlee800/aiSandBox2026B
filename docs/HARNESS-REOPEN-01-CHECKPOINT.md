# HARNESS-REOPEN-01 — Checkpoint

**Task:** HARNESS-REOPEN-01 — Opening a project does not overwrite a running Agent run
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** HARNESS-LIVE-06 run 8f8b4985 and the HARNESS-SAVE-01 open item; HARNESS-FIXES-01 item 10. Keith approved the draft on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY | 9add6450b2192b2c912ac49d6d48b58741ff3080 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS: code and LOCK in one commit) |

## What changed

- services/api-gateway/src/projects/projects.service.ts: openProjectIntoSession, after associating the session with the project, looks up one usage_records row of the caller in that session with execution_status pending, running or cancel_requested. If one exists it logs one info line, restores neither the snapshot nor the checkpoint history, and returns restoredSnapshotId null. Otherwise behaviour is unchanged. 22 lines added, 1 removed.
- services/api-gateway/src/projects/projects.module.ts: UsageRecord added to TypeOrmModule.forFeature.
- services/api-gateway/src/projects/projects.service.spec.ts: a UsageRecord repository mock; tests for each of the three active statuses (no restores, null snapshot id, association before the check, query bound to user and session) and for no active run (both restores called). 102 lines added.

No frontend change: the frontend already treats a null restoredSnapshotId as nothing restored. No migration, no new dependency, no new UI text.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2577 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Cursor's run | `npx jest src/projects` 4 suites, 36 tests passed; build exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-REOPEN-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 244345 | `34a9a55c2c36d33a25a3f0100f890c2292d11c34bf4cd61af5d8f763b3188e98` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |

## Acceptance criteria

All six met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Mocked only. The live check (close the page during an Agent run, reopen the project, the run's files are intact) is HARNESS-FIXES-01 item 12, for the next staging window.
- A run stuck as pending blocks the restore until the existing stuck-run scan closes it.
- Not deployed: ainow-staging-01 runs a28c489.

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (the live check, as HARNESS-FIXES-01 item 12).

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
