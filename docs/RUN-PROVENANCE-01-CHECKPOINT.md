# RUN-PROVENANCE-01 — Checkpoint

**Task:** RUN-PROVENANCE-01 — Record which agent definition produced each Team-page run (RSI-00 stage S1)
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (no user-visible change).
**Source:** RSI-00 stage S1; Keith approved the draft and admitted it on 2026-11-07.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with GATEWAY; validator PASS | 31711d6efb4b6d4fbc21520258d18f540b285364 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 9b50a0d8-6700-4082-a124-a7eb2a7cbb9d; it stopped because an existing spec outside the write set asserts the referral ledger metadata exactly | this commit |
| Scope change | services/api-gateway/src/orchestration/__tests__/orchestration.service.spec.ts added (Keith); validator PASS | e046f6f7a7f8913cc25c5aa2bdbee0325a3a3544 |
| Follow-up | the same Cursor session resumed with a one-step brief; it made the one spec edit and was cut off when the control-plane session ended, before it reported; the control plane read the edit and ran the gates | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/api-gateway/src/orchestration/orchestration.service.ts: one private helper, referralAgentDefinitionMetadata(id), returns agentDefinitionId and, when systemAgentVersion(id) returns a string, agentDefinitionVersion; an id that is not in the registry (systemAgentVersion throws) returns agentDefinitionId only and never throws. Both referral writeExecutionIntent calls (createAndStartReferral and enqueueApprovedReferral) spread it into the metadata after the existing keys; every other key and field is unchanged.
- Tests: collaboration.controller.spec.ts captures the ledger call and checks a chief-of-staff and a coding-team lead hand-off carry agentDefinitionId and the exact systemAgentVersion with the other keys unchanged; internal-collaboration.controller.spec.ts checks that a hand-off to builder-b (not a registry id) records agentDefinitionId without a version and still reaches in_progress; orchestration.service.spec.ts keeps its exact metadata expectation and now includes agentDefinitionId: 'builder-b'.
- Not changed: ai-execution.controller.ts and Builder, Ask and Agent-mode runs (unstamped), the job payload and signed fields (HARNESS_ENTITLEMENT_PROOF_V1 unchanged), the system-agents registry, ai-service, the frontend, entities and migrations.

**What this means.** Once deployed, every Team-page hand-off run record names the agent definition and the exact version of its instructions; with the model already stored on the run, a later stage can compare versions. Builder and Agent-mode provenance stays held on RSI-00 (it needs a worker-prompt version in ai-service).

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway npm test -- --runInBand | 203 suites passed, 2 skipped, 1 failed; 2791 passed, 7 skipped, 14 failed, all in smoke.integration.spec.ts (baseline AGENT-DEFS-01: 2790 passed, the same 14 known runtime-only failures) |
| api-gateway npm run build | exit 0 |
| Diff review | 4 files changed (64 lines added, 1 removed), all in the write set |

Evidence in `C:/Users/knlee/aisb-preflight/RUN-PROVENANCE-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2355 | `084466d7d68a7dc2cbb515aeb07afa485969e8f8f420f02d57d9ae919e9b7157` |
| `brief-impl.txt` | 6984 | `d7623b8aeca25a50bf32f790287a4533c73ef8f3f4b476d90750689dc7046152` |
| `brief-scope.txt` | 2639 | `ec86d85f786edf7433409495c62e7792ba1f3dbb1e81a2bc249d33a444797f83` |
| `brief-delta.txt` | 1798 | `92942aef8cc82f180ce8d2621d1048782f73c5548c98e8efb9263a09456b238b` |
| `cursor-admit-result.json` | 3427 | `ba9236b826c3b8406f3d21101725b3aa69ca6a013279eae4b09ddc4d6ceba84a` |
| `cursor-impl-result.json` | 4902 | `c64ba6a7b458c0550b5a079c1e9d289b0305ae97383d1ac024e74dcb987f97df` |
| `cursor-scope-result.json` | 4019 | `4b885d346c36bb323ff7abd951fa74e0ef19c9e681e5d6e61969c41f136faca0` |
| `cursor-delta-events.jsonl` | 196174 | `68e479e90a5fb3d3eab99722d051843922d89958a8cd7646295575c36daad3f5` |
| `reviewer-gates.out` | 671 | `faa5ca449352c53efcadce8b40811889a0d7b60ed4581bf1da9b6467e63d1c66` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: n/a, no frontend build), BACKEND 6/6 (1 and 2: no guard, auth or internal route change; 3: no generated-app template touched; 4: HARNESS_ENTITLEMENT_PROOF_V1 unchanged, only usage-record metadata; 5: n/a, no entity or schema change, metadata is an existing JSON column; 6: gates compared with AGENT-DEFS-01)

FOLLOWUPS: 1 registered / 1 superseded / 0 dropped / 0 undisposed (registered: STAGING-DEPLOY-15, the deploy, OPTIONAL as the control-plane default; superseded: Builder and Agent-mode provenance, held on RSI-00)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-07 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED. Not deployed; staging runs fa1b7bb. RSI-00 stage S1 done for Team-page runs.
