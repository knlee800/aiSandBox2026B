# COLLAB-WRITE-01 — Checkpoint

**Task:** COLLAB-WRITE-01 — The Writer applies fixes after approval; the Reviewer runs tests
**Status:** COMPLETE AND LOCKED — 2026-11-03
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft and, on 2026-11-03, the design in docs/COLLAB-WRITE-01-STAGE-START.md ("Approve design"). Registered and admitted in 80af16773be2262450ca2ab9248ce9a72a7754ab. Authority for writes: GOV-HARNESS-RESET-01 decision 4. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

A signed job field `harnessToolProfile` set by the Gateway from the target role: lead read, writer write, reviewer review. The worker registers per job: read gets read_file, list_files and search_workspace; review adds run_validation; write adds write_file and run_validation. delete_file is never registered for a profile. The write and validation flags must be on, or the job stores a readable reason and stops. write keeps the existing pre-apply checkpoint and project save; read and review get neither. The worker records written paths and validation runs. GET shows canChangeFiles, changedPaths, savePoint and tests; the page warns before approving a writer step and shows changes, the save point, test results and a link to the workspace. New text in en, zh-TW and zh-CN.

## Implementer

Cursor CLI, requested grok-4.7-xhigh, one run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npx jest` | 1033 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |
| api-gateway `npx jest` | 2548 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| frontend `npx tsc --noEmit`, `npm test`, `npm run build` | exit 0; 832 passed; tsconfig.tsbuildinfo restored |
| Validator | exit 0 at this record |

## Limits and decisions to know

Not deployed. A writer that asks for delete_file still triggers the pre-apply checkpoint first, then gets an unknown-tool error; nothing is deleted. A thrown write still triggers the project save but its path is not listed. The internal key route follows the same role mapping, so an internal caller can target writer. Checkpoint creation, listing and revert are unchanged.
