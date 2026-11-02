# HARNESS-PROGRESS-01 — Checkpoint

**Task:** HARNESS-PROGRESS-01 — Publish each harness tool call to the execution stream while the run works
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the finding in docs/HARNESS-LIVE-04-CHECKPOINT.md. Keith approved the draft on 2026-11-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with AI-SERVICE | 9fef9ac51a84d81077b6d3469e779969312fddce, 7c59914e08873e1bfeb258975beb5a2041400b3d |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 6d50668e-3204-44ab-b023-e29bb823a1e8, one run | 8cec36159e28f58d7c16d2a4bd00ee44f162115c |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

`execution-stream.publisher.ts` gains publishHarnessProgress. New `tool-progress.ts` wraps a tool handler: it publishes step, tool and a target of at most 200 characters, then runs the handler. A failed publish does not affect the tool. `worker.processor.ts` wraps every harness handler. The draft proposed a recorder, but audit events carry no tool arguments, so handlers are wrapped instead. The loop, the audit recorder and the single-shot path do not change.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 39/39 suites; 1018 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |

Cursor's own run reported 4 failures in messages.service.spec.ts from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-PROGRESS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 266696 | `faa5aac5c5d42b844eb9f3a7278ec35c243549e2feb491137c393fb8f5085682` |
| `reviewer-summary.txt` | 129 | `d95f6260d6e0fdd6026a2f20917f2d492bb64b97fe0f15ff22abe32a5b9a5d10` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review and the reviewer run). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: real delivery is proven in HARNESS-LIVE-05.
- A provider retry restarts the step count at 1.
- Messages are not stored, so a viewer who connects late misses earlier steps. HARNESS-UI-01 opens the stream right after the run starts.
- Not deployed: ainow-staging-01 runs 8fb5b63.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
