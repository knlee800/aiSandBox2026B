# COLLAB-GATE-TESTS-01 — Checkpoint

**Task:** COLLAB-GATE-TESTS-01 — Validation gate: no writer-to-reviewer approval on failing or missing tests
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** AGENT. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith's Agent Teams assessment (registered 5e9620c992a6d6c96c9d92bb1d65c8fa3bc2a32f). Keith admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with the Agent Teams and limits decisions | 5e9620c992a6d6c96c9d92bb1d65c8fa3bc2a32f |
| 1b. Admission | Lane 1 with GATEWAY, FRONTEND and I18N | 2932aa23f924c12f1e3cef8779bc4efb46024549 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 68d77ab7-b47e-47b8-b48c-6b195285c887, two runs (build, then one reviewer fix) | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

Gateway (services/api-gateway/src/orchestration/): new collaboration-tests-gate.ts with the rule and the writer-step lookup (the hand-off's answer-handoff idempotency key, else the nearest writer ancestor through parentReferralTraceId), and its spec. OrchestrationService.approveReferral enforces the gate for the login approve route only, after the existing pending, harness and credit checks and before the hand-off is claimed, so a blocked approval starts no work. A writer-to-reviewer hand-off whose writer step changed files and whose latest validation run failed or did not run returns 409 TESTS_NOT_PASSED, unless the request carries approveWithoutPassingTests true (JSON true only). The hand-off view gains testsGate (passed, not_required, blocked) and testsBlockReason (failed, none). The internal approve route, reject, guards, owner, spend and credit checks are unchanged.

Frontend: the Team page shows why a waiting hand-off is blocked and an explicit "Approve without passing tests" checkbox that must be ticked before Approve; the flag is sent only when ticked; a 409 shows the same blocked state. Three strings in en, zh-TW and zh-CN.

Reviewer fix (second run): a writer-to-reviewer hand-off whose writer step or work record cannot be found now blocks (reason none, override available) instead of approving; the gate fails closed.

## Scope expansion by the control plane

frontend/lib/collaboration/ (api.ts, logic.ts) and frontend/lib/collaboration.test.ts: the page's API client must carry the override flag. Same area, FRONTEND mutex held, Lane 2 empty. Recorded here, as HARNESS-DELETE-01 recorded its expansions.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npm test` | 2622 passed, 7 skipped, 14 failed; all 14 are the known runtime-only smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| `npx tsx --test lib/collaboration.test.ts` | 13 passed, 0 failed |
| frontend `npx tsc --noEmit` | exit 0 |
| frontend `npm test` | 835 passed, 0 failed |
| frontend `npm run build` | exit 0; frontend/tsconfig.tsbuildinfo restored |
| Cursor's runs | `npx jest src/orchestration` 9 suites, 193 passed after the fix |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-GATE-TESTS-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-gateway-test.txt` | 245210 | `f64b6b2734cd0a6f194fb94b9d1029d18b75f9e3fa0025e502b5f5f5cc56e1d8` |
| `reviewer-gateway-build.txt` | 45 | `7d45362984464872d740f22adcbdc4c1b9ae9c96e82aa10cfa855a6f328d6742` |
| `reviewer-collab-tests.txt` | 2940 | `d3c7002cd489ef6c37862a4d9c3d80069e23e6eafb0cfab1e512cde6349bd605` |
| `reviewer-tsc.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `reviewer-frontend-test.txt` | 180147 | `3b14faf5a33c4fba462cf64d351b3cc3240ad780aeb8d94a3675fe406092a476` |
| `reviewer-frontend-build.txt` | 3108 | `96c2a6739e70742d4dd8a670e96872d200b0730f67ddde44822261d7a3858578` |

## Acceptance criteria

All six met by diff review and the reviewer run ("only files in the write scope" as expanded above). Not LOCKED by an implementer: locked by the control plane.

## Limits

Mocked only; not deployed (staging runs 1aee7ed). Refusals are not stored as events until COLLAB-AUDIT-01. The internal approve route is not gated (internal callers only).

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY, FRONTEND and I18N released UNOWNED; GOVERNANCE UNOWNED.
