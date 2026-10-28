# CREDIT-UNIT-01 — Checkpoint

**Task:** CREDIT-UNIT-01 — Charge model tokens per started 1,000 tokens, as the credit rate defines
**Status:** COMPLETE AND LOCKED — 2026-10-28
**Workstream:** COMMERCIAL. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** FORCING.
**Source:** defect D3 of the CLEAN-BASELINE-DEPLOY-01 C2 run, recorded in repository commits 7ff0bbfc7395c9be72c89c251bf1ff7f0011fc94 and ddf754a252cbf7ac44f638822210ff3f0c4d7e6f.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Keith approved the task, its scope and the round-up rule on 2026-10-28; admitted to Lane 1 with GATEWAY | 7ff0bbfc7395c9be72c89c251bf1ff7f0011fc94, ddf754a252cbf7ac44f638822210ff3f0c4d7e6f |
| 2. Implementation | Cursor CLI (cursor-delegate), grok-4.7-high, session 242f8fb3-3cf2-4ee5-bcbb-350f6752418d, one run | 78b5df1774fd1bb79fafd2c214827de6014e9d0d |
| 3. Consolidation and LOCK | Part 1: Step 2 result | 5e51f486dc5f0dd1c2b2005dbff215e023417ebd |
| 3. Consolidation and LOCK | Part 2: this checkpoint, the ARCHITECTURE.md section 11.3 note, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## What changed

Implementation commit 78b5df1 changes exactly the two files of the write scope:

| File | Added | Removed |
|---|---|---|
| `services/api-gateway/src/usage-ledger/usage-ledger.service.ts` | 15 | 2 |
| `services/api-gateway/src/usage-ledger/__tests__/usage-ledger.service.spec.ts` | 157 | 3 |

- `modelTokenBlockCount(tokensUsed)` returns `Math.ceil(tokensUsed / 1000)`, and 0 for zero, missing, negative or non-finite counts.
- `UsageLedgerService.emitDeductionAttempt`, the single deduction path for the Ask (finalize) and the Build (confirm-build-apply), now sends the `model_tokens` line item with unit `1K_tokens` and that count, and adds the raw count to the event metadata as `tokensUsed`.
- With the rate of 1 credit per `1K_tokens`, a charge is one credit for each started 1,000 tokens: 1 to 1000 tokens cost 1 credit, 1001 to 2000 cost 2, and a zero-token Ask still writes its 0-credit audit deduction. The staging Ask of 1023 tokens would now cost 2 credits instead of 1023.

Not changed: the rate table, `CreditCalculationService`, the deduction gateways, idempotency by `executionId`, the intent gates, the database, the frontend, existing balances, and the empty `usage_records.model` value.

## Validation on the committed tree

| Gate | Result |
|---|---|
| `npx jest src/usage-ledger src/billing --maxWorkers=2` | 47 suites, 747 tests pass |
| `npx jest --maxWorkers=2` | 171 suites passed, 1 failed, 2 skipped; 2320 tests passed, 14 failed, 7 skipped (baseline 2313 passed, the same 14 failures) |
| `npm run build` | exit 0 |
| Write scope | only the two files |

The reviewer ran the gates independently after Cursor, on Node v22.14.0 as for the baselines. The 14 failures are all in `src/__tests__/smoke.integration.spec.ts`, which needs a live PostgreSQL and Redis.

Evidence copied to `C:\Users\knlee\aisb-preflight\CREDIT-UNIT-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-jest-usage-ledger-billing.txt` | 27556 | `e397c22e70110b8018f2873bab03179c986c31863d2850b37a14fc07641c6e89` |
| `reviewer-jest-full.txt` | 262488 | `8e8caf0e3edf5fb691bae0af71b736d963b0f9fce90c6f2ee4522ce38c6716ff` |
| `reviewer-npm-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `cursor-brief.txt` | 4391 | `3210d9294921ce8ce9d774ed99d4ac42a2b66ca5eca74e2ea66dbaa976372114` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| Ask and Build deductions send unit 1K_tokens and unitCount Math.ceil(tokensUsed / 1000) | met (single deduction path; Ask and Build tests) |
| 0 or missing tokens give 0; 1 and 1000 give 1; 1001 and 1023 give 2 | met (boundary tests) |
| The raw token count is kept in the event metadata as tokensUsed | met (metadata test) |
| Idempotency by executionId and other deduction behaviour unchanged | met (diff review; existing tests pass) |
| Tests cover the boundaries on both paths; updated tests no longer expect raw counts | met (7 new tests, 3 updated assertions) |
| Gateway jest passes apart from the known smoke failures, and the build passes | met |
| Only the write-scope files change | met |
| Not LOCKED by an implementer | met (locked by the control plane) |

## Open items

- The live charge is not verified here. The staging proof is the CLEAN-BASELINE-DEPLOY-01 C2 repeat, after a re-admission record approved by Keith, which also restores the test account's 500 credits through the admin credit grant.
- Follow-up candidates, not registered: the empty `usage_records.model` value for provider executions; the container-manager quota evaluation logging no such table and failing open.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-28 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED; GOVERNANCE UNOWNED. ARCHITECTURE.md section 11.3 states the rounding rule as CURRENT. CLEAN-BASELINE-DEPLOY-01 stays READY and not admitted until a re-admission record.
