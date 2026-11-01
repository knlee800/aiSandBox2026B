# HARNESS-FAIL-RECORD-01 — Checkpoint

**Task:** HARNESS-FAIL-RECORD-01 — Keep the steps, tokens and model of a failed harness run
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the first HARNESS-LIVE-01 window, 2026-11-01, where execution 4a73f68e-ed6a-4d52-8194-1b12aad0b433 hit the 3-step limit and left no steps, tokens or model. Keith decided to keep that task open and fix this first.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered; HARNESS-LIVE-01 returned to READY because the validator refuses LOCAL-TESTS beside PROVIDER-LIVE; admitted to Lane 1 with AI-SERVICE | f5b00281bed24f137878bf16beedd22dd506e0ff, 087b461f03778bae31365a5a6544ff1438f3ab97 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 167ff0a5-95ea-4d70-8e49-8453526719df, one run | 6471f5d8cfb359ee82840ff5e1dacd6748c18375 |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `services/ai-service/src/worker/worker.processor.ts` | audit events are logged in a finally around executeAgentHarnessLoop; the final failed-path UPDATE also sets model = $2 and tokens_used = COALESCE($3, tokens_used), with $3 taken from HarnessMaxIterationsError.tokensUsed and otherwise null; the completion log uses the same token value |
| `services/ai-service/src/worker/worker.processor.spec.ts` | four behavioural tests: step-limit audit events logged once, step-limit tokens and model with no accounting notification, other failure writes model with no token value, success logs once and writes its usual row |

No existing test changed. Credits are unchanged: failed runs stay uncharged. Aborted and timed-out harness runs now also log their audit events; their ledger updates are unchanged. Not changed: the step limit, partial answers, token counts for other failures, the harness loop file, the schema.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 38/38 suites; 974 passed, 1 skipped |
| `src/worker/worker.processor.spec.ts` | 180/180 |
| ai-service `npm run build` | exit 0 |

Cursor's own run reported 4 failures: three suites killed out of memory and a better-sqlite3 Node ABI mismatch in messages.service.spec.ts. All pass in the reviewer run on Node v22.14.0. The new SQL ran against a mock database only, so real-database proof comes from the second HARNESS-LIVE-01 window.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-FAIL-RECORD-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 237053 | `d4e8c83f831960b65565bb0495265e35ae0e6a44464dc1009f2af588c0ed859b` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-worker-test.txt` | 70352 | `fc8b5662431b40f97a882737b2a5b1f3b4bc8c50f331a0c4c460af6ed9e48c74` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All seven met (diff review and the reviewer run above). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Not deployed: the second HARNESS-LIVE-01 window carries it, under its own admission record.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
