# RUN-LIST-COLLAB-01 — Checkpoint

**Task:** RUN-LIST-COLLAB-01 — The run list returns the collaboration run and role of each run
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** prerequisite of OFFICE-01 in docs/RPG-OFFICE-01-PLAN.md section 1a. Keith approved it with the plan on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 2 with GATEWAY | b5494adbb40109a0ab5f4c9fc17ddc649083a02b |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, one run | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/api-gateway/src/ai/execution-result.service.ts: listRunsForUser also selects metadata->>'collaborationRunId' and metadata->>'builderProfileId'; ListedRunRow has both. The user filter, bound parameters, state, limit and ordering are unchanged.
- services/api-gateway/src/ai/ai-execution.controller.ts: ListedRunDto gains collaborationRunId and builderProfileId (string or null), filled with nullableText.
- Specs: the list-runs spec checks the SQL selects both keys with the user filter and bound parameters kept; the run-status HTTP spec and a new controller test check present values, explicit null and omitted keys.

No other route, field or the harness entitlement proof changed. No migration.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2578 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Cursor's run | the three edited suites passed; 23 failures in four SQLite integration suites came from a better-sqlite3 native-module version mismatch on Cursor's Node and are environmental; build exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/RUN-LIST-COLLAB-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 245776 | `e6e095db9526156843a263414ea94a6cd4e006b3b006744371c848db6d6ccf73` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |

## Acceptance criteria

All five met by diff review and the reviewer run. Not LOCKED by an implementer: locked by the control plane.

## Limits

Mocked only; not deployed (ainow-staging-01 runs a28c489). The first consumer is OFFICE-01.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 2 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
