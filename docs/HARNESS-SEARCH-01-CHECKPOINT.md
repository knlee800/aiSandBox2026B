# HARNESS-SEARCH-01 — Checkpoint

**Task:** HARNESS-SEARCH-01 — Offer the existing workspace search to the harness as a read-only tool
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the usable-harness slices in docs/GOV-HARNESS-RESET-01-DECISION.md. Keith chose search and approved the draft on 2026-11-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered in two parts; admitted to Lane 1 with GATEWAY and AI-SERVICE | a3b8440f11c8e7003e704ec826cf01d03210b59c, c9c6e2c4f2021e5e18ecacf2893069c768daf1d0 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 059b2980-1e0f-4cef-be87-7500598e6d0d, one run | 002e46ada9d994f12e5b28e4e56b0f61b555ae91 |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `internal-workspace-files.controller.ts` | new POST :sessionId/search; rejects a missing, non-string or blank query; calls the existing search |
| `api-gateway-http.client.ts`, `file-tool-handlers.ts` | searchWorkspace client call and search_workspace handler |
| `tool-registry.ts` | enabled and implemented; plain-text description; schema has only query; planned and semantic tags removed |
| `adapter-tool-use.mapper.ts`, `worker.processor.ts` | offered and registered beside list_files, with no flag of its own |
| eight spec files | new coverage for the route, client, handler, registry and offer; tests that used search_workspace as a tool with no handler now use start_preview, with the same assertions |

Not changed: the container manager and the search itself, the save-point tool list, the output contract, the orchestration read-only tool list, other tools.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 38/38 suites; 1007 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |
| api-gateway `npm test` | 2338 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Cursor's own run reported 4 failures in messages.service.spec.ts from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-SEARCH-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 260680 | `097ca8ce5df21c22711148f99e1708c11b31d16876ad60024809bcbba2342b83` |
| `reviewer-gateway-test.txt` | 234174 | `ffe7e97b8c8d99ba8176cfb7b1ea43b70f5440ab46c478aa514fd0addace2e74` |
| `reviewer-summary.txt` | 398 | `6c5a427725d4f5b32bb6d1ed37acc833ac225dd3635556a10b02d8a3c54df53f` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review and the reviewer run above). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: search with a real model, and through the real route to a container, needs a live window. Keith decides that separately.
- Known weakness, not changed: if the search script fails with no output, the container manager returns no matches instead of an error, so the model could wrongly conclude the text is absent. The fix is in the container manager and would need its own task.
- Not deployed: ainow-staging-01 runs 4c6d606.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY and AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
