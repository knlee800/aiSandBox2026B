# HARNESS-SAVE-01 — Checkpoint

**Task:** HARNESS-SAVE-01 — Save the project on the server when an Agent run that wrote files ends
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** HARNESS-LIVE-06 run 8f8b4985. Its files were erased when reopening the project restored the saved copy at 09:15:14 UTC. Keith approved the fix on 2026-11-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY and AI-SERVICE; HARNESS-LIVE-06 returned to READY | 9e3d20eee888ae0f05353b4423f551ad61b2ac14, 8eaa90db2ae439cefc7cf7b705b0857a6a017c28 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 505b777b-8ba1-43cf-aec3-f65d478f03c2, one run | f37821cd33b9b705a7fb76b0b036d90cd767364b |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

A new internal route saves a snapshot labelled `[project-id:<id>:source:ai]`, the label the reopen lookup finds as newest; a missing or ended session, or one with no project, saves nothing. The worker calls it in the finally block after the harness loop when the run attempted a write or delete, so it also covers a failed run. A failed save logs a warning and does not change the result. The HARNESS-SAVE-01 admission also corrected a wrong HARNESS-LIVE-06 dependency list in the sidecar, written by an earlier generator of the control plane.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 39/39 suites; 1025 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |
| api-gateway `npm test` | 2449 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-SAVE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 292716 | `d42ab843e69e3e798cbe100545b7c5d18ffbf6f0ef45389e63b4fd0ec78b9fbb` |
| `reviewer-gateway-test.txt` | 243031 | `fd3950d8db3baf9444cd3243e5dab27f7945f0af27751097053a78bb09082c2c` |
| `reviewer-summary.txt` | 384 | `f9348a27bfde1b8f78381125ee1d5fee865d2b0fc1d1b020b7e64d7e0d92e7e3` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review and the reviewer run). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: the HARNESS-LIVE-06 close-the-page case proves it.
- Known limit, not changed: reopening a project while an Agent run is still working restores the saved copy over files written so far. The run's later save then captures only what is in the workspace at the end.
- Not deployed: ainow-staging-01 runs 67c054a.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY and AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
