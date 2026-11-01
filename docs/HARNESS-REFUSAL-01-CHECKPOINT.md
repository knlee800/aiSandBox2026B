# HARNESS-REFUSAL-01 — Checkpoint

**Task:** HARNESS-REFUSAL-01 — Report an Anthropic refusal as a refusal
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** HARNESS-LIVE-01 execution 07036191-577f-4b04-bcd3-a59f9ace8eee, which failed with an empty Anthropic response and left no reason. Keith approved this fix on 2026-11-01.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered in two parts; admitted to Lane 1 with AI-SERVICE | a3756153825986bd276953f1038d74c15e7e1d56, 66249d831f5529f9a9d6b538da7ce81fd8b59f25 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 127e0d3d-580f-4c4f-9839-264c75d1351b, one run | c1060a44c19da779f6878c845570097312cd545e |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `services/ai-service/src/ai-execution/adapters/anthropic-ai.adapter.ts` | one private helper on both response paths checks `stop_reason` before content: a refusal, with or without partial text, logs the category and fails with `Anthropic declined the request (stop_reason=refusal, category=...)`; empty content with another `stop_reason` names it; empty content with no `stop_reason` keeps the old message |
| `services/ai-service/src/ai-execution/adapters/__tests__/anthropic-ai.adapter.spec.ts` | 10 tests, 5 per path, including that the explanation and partial text stay out of the error log |

No existing test changed. Not changed: normal responses, the request sent to Anthropic, fallback, retries, the step limit, charging, other providers.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 38/38 suites; 984 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |

Cursor's own run reported 4 failures in messages.service.spec.ts from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-REFUSAL-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 245651 | `9a55a4386eaae2d20512754223ce60d86ae1a25386ff31f7003064ac0af807f0` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All seven met (diff review and the reviewer run above). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked responses only: no real refusal has exercised this, and the cause of the HARNESS-LIVE-01 run 5 failure stays unconfirmed.
- Not deployed: the next live window carries it, under its own admission record.
- Automatic model fallback on refusal is a later decision for Keith.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
