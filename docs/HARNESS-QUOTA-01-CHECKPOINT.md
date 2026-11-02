# HARNESS-QUOTA-01 — Checkpoint

**Task:** HARNESS-QUOTA-01 — Make the rolling 24-hour token limit a setting, with a default of 1,000,000
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the limit stopped HARNESS-LIVE-06 on 2026-11-02. Keith instructed the higher value and the fix.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration and admission | Lane 1 with GATEWAY; HARNESS-LIVE-06 returned to READY | 20dbe1185982f2ed659f26101fae36da71b8ff52, f23ed1b7fef6c51341b7f59af3a930eb0d1f93de |
| 1. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session ffcff120-dd9d-4dbf-9d84-5f74490b9455, one run | 67c054a4ffe183f6f4e96c2550350a48863a39a2 |
| 2. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

`MAX_TOKENS_PER_24H` reads the environment with the same helper as the session limits beside it, default 1,000,000, and an invalid value falls back to the default. It was fixed at 100,000 since 2026-02-23. No environment file changes. Tests that assumed 100,000 now derive from the limit, with the same refusal assertions.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2441 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| `auth.controller.google.spec.ts` | Lost in the full run to a Jest worker running out of memory; passes alone, 3 passed. Not related to this change |
| api-gateway `npm run build` | exit 0 |

Evidence in `C:/Users/knlee/aisb-preflight/HARNESS-QUOTA-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 256495 | `4bdb1c63b8fcb069e5207c013ac5df048ee370fcaa63fc1caa44e36547b2b4ec` |
| `reviewer-summary.txt` | 384 | `c52d0cac733e40a29b4ba3866c0225a1c6e824065cd9d1e5ced22222992a31ac` |
| `reviewer-node.txt` | 10 | `3861059a6571aac597811cb94a8b643edac0c28c1dc2baa1b7e8a48edeaa5835` |

## Acceptance criteria

All four met (diff review and the reviewer run). Not LOCKED by an implementer: locked by the control plane.

## Open items

- This value is for testing. A real per-user or per-plan limit must be settled with charging before anyone but Keith uses Agent. Spend stays capped separately by the daily spend caps and the provider key limit.
- Not deployed: ainow-staging-01 runs a481b9d. The next HARNESS-LIVE-06 window deploys it.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-02 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED.
