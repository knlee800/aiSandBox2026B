# HARNESS-STEP-LIMIT-01 — Checkpoint

**Task:** HARNESS-STEP-LIMIT-01 — Raise the harness step limit, add a run token budget, and ask for an answer on the last call
**Status:** COMPLETE AND LOCKED — 2026-11-01
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** HARNESS-LIVE-02 run dedbc9b8-3cfc-4986-8edf-f07a104c4e2a, which fixed a bug on its third and last model call and failed with no answer. Keith approved the corrected draft on 2026-11-01.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered in two parts; admitted to Lane 1 with AI-SERVICE | 7ff8c4b6697216621feb2c6e6a3652895ad658be, 9292d7fef815ad6ff018443ff2a615662118080c |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 6b3fd1c9-cab5-409e-b736-985b386bc352, one run and one review delta | 4c6d606ebf62f3f190ad7af7eacdb133b39f4ef8 |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

| File | Change |
|---|---|
| `agent-harness.config.ts`, `agent-harness.contracts.ts` | maxToolIterations 8; new optional maxRunTokens, default 60,000 |
| `agent-harness-loop.ts` | before the last allowed call, or once the budget is reached, one notice goes on the newest tool result, in both toolResults and the transcript; tool calls after the notice are not run and the run ends as a limit failure with tokens and steps |
| `worker.processor.ts` | passes maxRunTokens, falling back to the global default so a builder profile cannot silently drop it; one added line in the harness output contract |
| the three spec files | new coverage for the defaults, the notice, the budget, ignored notices and unchanged system and tools; one existing test changed for the added contract line |

Not changed: system prompt and tools between calls, tool_choice, charging, tool results in the journal, the validation timeout, builder-profile overrides, other providers.

**Review delta:** the first implementation passed maxRunTokens straight from the resolved config. A builder profile with a harness profile resolves without it, which would have turned the budget off silently. The reviewer added the fallback.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service `npm test` | 38/38 suites; 1002 passed, 1 skipped |
| ai-service `npm run build` | exit 0 |

Cursor's own run reported 4 failures in messages.service.spec.ts from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-STEP-LIMIT-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 260339 | `30def19b6dde9949e1efcecfc2298aa9ad1b10a85e559e8b12603b78b512feb7` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All seven met (diff review and the reviewer run above). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: whether a real model obeys the notice, and whether 8 calls and 60,000 tokens are the right sizes, need a live window.
- Worst case is about 76,000 tokens per run, because the last call can pass the budget by one call.
- Not deployed: ainow-staging-01 runs 320cd84.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-01 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
