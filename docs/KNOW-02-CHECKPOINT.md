# KNOW-02 — Checkpoint

**Task:** KNOW-02 — Knowledge tools in the Harness
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** APPROVED_FUTURE (authorized by Keith with the plan on 2026-11-05).
**Source:** docs/AGENT-BIZ-KNOWLEDGE-PLAN.md section 6; Keith admitted it on 2026-11-06 after his tester finding that Knowledge documents were not used in answers.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with AI-SERVICE and GATEWAY; mutates HARNESS_ENTITLEMENT_PROOF_V1, Lane 2 empty; validator PASS | 5c29627faada06cedb65f14952ffbef2b14b1599 |
| 2. Stage-start | Cursor CLI read-only, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 7c47b434-1c3f-43a7-8edd-d7204854ce0f; control-plane review; Keith's three decisions; write set adds the tool allow-list file and its spec; validator PASS | 794b9f24a8ac75eac6afd986edd3c00dc48b0e17 |
| 3. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 120327df-e7f3-41b1-abc4-4094f059442d | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator; HARNESS_ENTITLEMENT_PROOF_V1 stays FROZEN with the new optional field | this commit (LOCAL-TESTS) |

## What changed

- ai-service: optional signed job field `knowledgeScopes` (job.types.ts). `worker/knowledge-scopes.ts` validates it after the proof and profile checks: missing is valid; present on a non-v1 job, not an array, a bad, unknown or duplicate id, or more than nine ids is a stored failure; a non-empty list on any profile other than `read` is `knowledge_scopes_profile_conflict`; all three codes are in knownHarnessMessages. The nine ids have a parity spec against the gateway registry.
- ai-service: tool definitions `search_knowledge` and `read_knowledge` (read-only, low risk, no approval, `additionalProperties: false`), handlers closed over the job's userId, the validated scopes and maxToolResultBytes (gateway errors become fixed sentences; reads slice content on a UTF-8 boundary and set `truncated`), registration beside `search_workspace` only for signed `read` with a non-empty list, progress targets, `ApiGatewayHttpClient.searchKnowledge` and `readKnowledge`, and both ids on the advertisement allow-list and its gate.
- api-gateway: `KNOWLEDGE_ROLE_SCOPES` (empty), `knowledgeScopesForProfile` and `knowledgeScopesJobFields` (a bad id throws, so it cannot be signed), spread in the `fileAccess` branch of `startReferralExecution`; `InternalKnowledgeController` (`POST /api/internal/knowledge/search` and `/read`) on KnowledgeModule behind the existing global internal-key guard, reading userId and scopes from the body the worker sends, checking both, and returning only the owner's active documents in those scopes, with one 404 for any document that is missing, another owner's, out of scope, deleted or without the heading; pure search and section functions (20 hits, 240-character previews, literal `%` and `_`, ATX headings).
- Accepted departures, all inside the design: the job-field helper also takes an explicit list (used by tests); equal `updatedAt` hits order by id; a long preview is 237 characters plus `...`; the tools use the same `allowedModes` as `search_workspace`.
- Not changed: `ai-execution.controller.ts` (Agent mode), `app.module.ts`, guards, entities, migrations, packages, frontend, the golden canonical payload test, and the collaboration profile cases (only `not.toHaveProperty('knowledgeScopes')` added).

**What this means now.** The role map is empty, so no job carries `knowledgeScopes` and the tools never register outside tests. Knowledge documents start reaching answers with BIZ-01 (Chief of Staff team), whose readiness condition (KNOW-02 and KNOW-03 LOCKED) is now met; Keith decides its admission.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service npm test | 47 suites passed; 1120 passed, 1 skipped (baseline ASK-CONTRACT-01: 45 suites, 1105 passed, 1 skipped) |
| ai-service npm run build | exit 0 |
| api-gateway npm test | 2769 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline HARNESS-FIXES-01A: 2748 passed, 7 skipped, the same 14 known runtime-only failures) |
| api-gateway npm run build | exit 0 |
| Diff review | 21 modified and 8 new files, all in the write set; matches the stage-start and Keith's decisions |

Evidence in `C:/Users/knlee/aisb-preflight/KNOW-02/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2331 | `fcb1d0e158a8fece37d3461023462e56add470ab62d27eef2b1541c43b9acbbd` |
| `brief-stage-start.txt` | 7430 | `b5f88c7d70a0f46d942c062dbabe75bc24731d649db8202163b601037ef6311d` |
| `brief-stage-start-record.txt` | 2385 | `4245bd289c401145d8ba8dfe7d7545db7249c2959bca5be48336cb391f7a6111` |
| `brief-impl.txt` | 7686 | `761c14f5e1bd191327bb7f175119b888a40282d19dc9653bfe039000536819f6` |
| `cursor-stage-start-result.json` | 37606 | `ba344da21643b1dd3502e6f33402a5585b48d1872a6c29ba7447d278777565c6` |
| `cursor-impl-result.json` | 12161 | `85fff129bfa7c02b83f8006667347f68c73780dd9a4b2b8409cd9c788b5dcead` |
| `reviewer-gates.out` | 573 | `28885c67eced1fab7f32b3a78f092f1cd73e9e1a4637cb38734f4929932959bb` |

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: no frontend build, tsconfig.tsbuildinfo untouched), BACKEND 6/6 (1 and 2: no guard or auth change, the internal routes sit behind the existing global internal-key guard; 3: no generated-app template touched; 4: the HARNESS_ENTITLEMENT_PROOF_V1 change went through admission and the stage-start and is re-frozen; 5: n/a, no entity or schema change; 6: gates compared with the latest checkpoints above)

FOLLOWUPS: 0 registered / 3 superseded / 3 dropped / 0 undisposed (superseded: filling the role map by BIZ-01, summaries in search by KNOW-04, deploying this code by BIZ-LIVE-01, whose first step is the deploy; dropped by Keith at the stage-start: knowledgeScopes on Agent-mode jobs, the tools for mutating profiles, SQL search or an index)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; AI-SERVICE and GATEWAY released UNOWNED; HARNESS_ENTITLEMENT_PROOF_V1 re-frozen. Not deployed; staging still runs 05539f7.