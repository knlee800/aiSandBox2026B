# HARNESS-WRITE-TOOLS-01 — Checkpoint

**Task:** HARNESS-WRITE-TOOLS-01 — Offer write and validation tools to the model, and use a tool-based prompt on the harness path
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the first HARNESS-LIVE-02 window, 2026-11-01, where the model was offered only read tools with the flags on, and claimed a file change that did not happen. Keith approved this fix and a second window.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered in two parts; HARNESS-LIVE-02 returned to READY; admitted to Lane 1 with AI-SERVICE | baa5b20c9e1dafa88310d35be374a035edb8a92c, c049e66b6b26d0fda05dc7a5aeab913a3c46184f |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 42f5c416-0057-4291-97a8-215722fa12db, one run | 320cd84de52d81e57d55b70d0da5981588914119 |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `adapter-tool-use.mapper.ts` | the advertisable list is now list_files, read_file, write_file, run_validation; flag gates unchanged; delete_file, browser_smoke and search_workspace are never offered |
| `worker.processor.ts` | `buildExecutionPromptParts` takes `{ useHarness }`; the harness path uses a tool-based output contract in place of the file-action contract; with no option the output is unchanged |
| the three spec files | new coverage for flags, exclusions and both contracts; the existing tests that locked in read-only advertising changed on purpose |

**Scope expansion:** services/ai-service/src/agent-harness/tools/__tests__/tool-registration-gates.spec.ts was added by the control plane before implementation, because one of its tests locked in read-only advertising.

Not changed: charging, the step limit, tool timeouts, the dispatcher, the handlers, the harness loop, `requiresApproval` handling, file-action parsing, the plain path.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 38/38 suites; 991 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |

Cursor's own run reported 4 failures in messages.service.spec.ts from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-WRITE-TOOLS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 247208 | `7c866c46134b0724d6d23a5ba49f2d6ad38ed8436f4e8e6f5b7744b30fe00055` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All seven met (diff review and the reviewer run above), with the write scope expanded as recorded. Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: real proof comes from the second HARNESS-LIVE-02 window.
- `write_file` is marked `requiresApproval`, but nothing enforces it. Keith approved direct writes with a save point on staging only; approval gates remain planned work.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
