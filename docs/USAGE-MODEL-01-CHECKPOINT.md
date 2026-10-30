# USAGE-MODEL-01 — Checkpoint

**Task:** USAGE-MODEL-01 — Write the model into usage_records when the AI-service worker finalizes an execution
**Status:** COMPLETE AND LOCKED — 2026-10-30
**Workstream:** COMMERCIAL. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the read-only investigation of 2026-10-30, from the CLEAN-BASELINE-DEPLOY-01 C2 follow-up: on ainow-staging-01 the usage_records rows of the two xai grok-4.5 provider runs had an empty model.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration and admission | registered on Keith's approval, then admitted to Lane 1 with AI-SERVICE | b0c069d09a26d6eeafeffc22878a60bfd1f25023, 1d7964f541a8dfc2b7177e5f3210e415abb3995f |
| 1. Implementation | Cursor desktop, Grok 4.7 High, prompt pasted by Keith, one run | ab138571eac6f833a3bc1b7b00d2a636f094e801 |
| 2. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## Why the column was empty

The gateway writes the pending usage_records intent without a model and passes the resolved model only in the queue payload. The AI-service worker finalizes the row, but its completed and contract-failure UPDATEs set only execution_status, tokens_used and metadata, so the model reached only metadata.aiExecutionResult.model. The gateway method that would set the column, updateExecutionResult, has no caller. The column has been nullable since migration 1740355300000, so it stayed NULL and no migration was needed. Readers affected: credit_deduction_records.metadata.model (null) and any per-model reporting; credit amounts do not depend on the model.

## What changed

| File | Change |
|---|---|
| `services/ai-service/src/worker/worker.processor.ts` | new exported helper resolveLedgerModel (first non-blank trimmed string of the AI result model and the job model, else null, cut to 100 characters); the completed and contract-failure UPDATEs set model = $4 |
| `services/ai-service/src/worker/worker.processor.spec.ts` | five helper tests; four worker tests that check params[3] for the result model, the job-model fallback, null, and the contract-failure update |

33 lines added and 4 removed in the worker, 161 added in the spec. Parameters $1 to $3 and every other UPDATE, metadata value, stream, accounting call and the harness entitlement proof are unchanged. Not changed: the gateway, the schema, execution_duration_ms (same gap, a possible follow-up), and existing rows (no backfill).

## Validation (reviewer, Node v22.14.0)

| Gate | Result | Baseline |
|---|---|---|
| ai-service `npx jest --maxWorkers=2` | 38/38 suites; 912 passed, 1 skipped | 37/38 suites; 898 passed, 1 skipped, 5 failed |
| ai-service worker suites | 3 suites, 248/248 | 239/239 |
| ai-service `npm run build` | exit 0 | exit 0 |

The 5 baseline failures are adapter-selection timeouts in ai-execution.phase30c.spec.ts; they also failed when that suite ran alone at baseline, passed in the after-change run, and are unrelated to the worker. Plain npx jest runs out of worker memory on this machine, hence --maxWorkers=2.

Evidence copied to `C:\Users\knlee\aisb-preflight\USAGE-MODEL-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-ai-test.txt` | 202910 | `f428b7c30f21d7b4b05869dcab8f1f32b5f05c3f35a729fc31fb5d2f8320e09f` |
| `reviewer-ai-build.txt` | 44 | `c1a6ccccb476844eadd90f48f36228aa54578d4f92baf0b42d6896e3d0c24fb7` |
| `reviewer-worker-test.txt` | 35988 | `0cb6bbe7ef776d15f905e7a2cdc34c2db1bdc08c1f2e56bf3953b0092090dffb` |
| `reviewer-ai-test-baseline.txt` | 201130 | `4184de38061882b9ff0c87172ee728b33c9b8b3ad19d97836576592a88d88fe5` |
| `reviewer-phase30c-baseline-alone.txt` | 13205 | `250f014c38aa62a9253323198d164cd4f20a936e4ee08f999d4d942306daf924` |
| `reviewer-worker-test-baseline.txt` | 26088 | `15f434fde61bd9f81ce8bdf9da3e558635b88a031443754becadb9cc0824ed7e` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Completed and contract-failure UPDATEs set model to the AI result model, else the job model, else NULL (blank counts as missing; cut to 100 characters) | met |
| $1 to $3 and the status, tokens and metadata values unchanged; model is $4; timeout, cancel and other failure UPDATEs unchanged | met (diff review) |
| New tests cover the result model, the job-model fallback, NULL and the contract-failure update | met (9 new tests) |
| ai-service npm test and npm run build pass on Node v22.14.0 with no new failures | met |
| Only the write-scope files change; no migration | met (two files) |
| Not LOCKED by an implementer | met (locked by the control plane) |
| After the next authorized deploy, a real provider execution on ainow-staging-01 has a non-empty usage_records.model | open (deploy-time evidence, not a lock gate) |

## Open items

- Not deployed: ainow-staging-01 runs 7317749 until a separately authorized deploy, which can carry DEBUG-INGEST-01, CM-QUOTA-DEAD-01 and this task; then check usage_records.model for the next real provider execution.
- Possible follow-up, not registered: the worker also never writes execution_duration_ms.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-30 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED; GOVERNANCE UNOWNED.
