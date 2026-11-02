# RUN-STATUS-01 — Checkpoint

**Task:** RUN-STATUS-01 — Owner-scoped list of active and recent runs
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** docs/GOV-HARNESS-RESET-01-DECISION.md order of work and docs/GOV-RPG-UI-COMPAT-01-REVIEW-RECORD.md. Keith approved the draft on 2026-11-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY | 602503659446e22b220a27de8e3c81929056b89f, ff29fe19fa31a1bfea0f57b182d08308ec5ff794 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session aa85b216-6849-4fed-8ded-a9714d4c0f49, one run | 996f2ff989cd5ca3a06fc7f4df246d201de4b5be |
| 3. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

`GET /api/ai/executions` takes state, optional sessionId and limit (default 20, capped at 50) and returns the caller's runs: execution ID, status, session, provider, model, tokens, start time, duration, mode and agent ID. The query always filters by user, uses bound parameters, and selects only two metadata keys. `execute` records runMode at all three ledger call sites, after the client's metadata, so a client cannot set it. The status mapping moved to one helper with the same behaviour.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2441 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |

Cursor's own run reported failures in four suites from a better-sqlite3 Node ABI mismatch. They pass in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/RUN-STATUS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 240431 | `49f97d8b0aedcaf5b6016711ebbd6ae4def5db2304dc24b1d46fbd1ce4f9fa5f` |
| `reviewer-summary.txt` | 278 | `9885dcc6c613af445d4623e4b9d3a326a2db1ef2753f1e80bf838e0f37b08b36` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All six met (diff review and the reviewer run). Not LOCKED by an implementer: locked by the control plane.

## Open items

- Mocked only: the SQL has not run on real PostgreSQL. The live check after RUN-RECOVER-01 covers it.
- No finish time is stored, so the list gives a start time and a duration.
- Not deployed: ainow-staging-01 runs 0838a5f.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
