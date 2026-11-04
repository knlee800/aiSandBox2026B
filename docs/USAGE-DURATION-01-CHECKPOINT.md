# USAGE-DURATION-01 — Checkpoint

**Task:** USAGE-DURATION-01 — Write the run duration into usage_records when the worker finalizes an execution
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** USAGE-DATA-01 item 1; prerequisite of OFFICE-01 in docs/RPG-OFFICE-01-PLAN.md section 1a. Keith approved it with the plan on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with AI-SERVICE | b5494adbb40109a0ab5f4c9fc17ddc649083a02b |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

services/ai-service/src/worker/worker.processor.ts: the ten UPDATEs that write a final status inside the job (completed; failed for the profile or tool-gate rejection, the file-action contract, and the two thrown-error paths; cancelled at four points; timeout) also set execution_duration_ms from the existing measurement Math.round(performance.now() - executionStartTime), passed as the last bound parameter. Where the worker already computed that value after the UPDATE for metrics and logs, the one measurement moves to just before the UPDATE and is reused. The profile-rejection helper receives the start time from its three callers inside the job. 46 lines added, 23 removed.

Left unchanged: markRunningLedgerFailed (both of its UPDATEs). It serves the stuck-run scan, the queue failed handler and stalled-claim recovery, which have no start time for the run.

services/ai-service/src/worker/worker.processor.spec.ts: tests for each changed path check a non-negative integer duration in the right parameter position; one existing assertion now skips the new duration index. 240 lines added, 4 removed.

No other column, WHERE clause, metadata, stream, metric, accounting call or the harness entitlement proof changed. No backfill.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 45 suites, 1089 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |
| Cursor's run | `npx jest src/worker` 3 suites, 282 passed; build exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/USAGE-DURATION-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 373502 | `53bc1048fc47a637ee80c24a8a62ed469af690ce14f89aa6ac02ef8d6a98a1a2` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |

## Acceptance criteria

All five met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

Mocked only; not deployed (ainow-staging-01 runs a28c489). Runs closed by the stuck-run scan or the queue failed handler still have no duration. Existing rows keep null.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
