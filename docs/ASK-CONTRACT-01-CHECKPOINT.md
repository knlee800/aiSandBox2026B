# ASK-CONTRACT-01 — Checkpoint

**Task:** ASK-CONTRACT-01 — Ask mode gets its own instructions and never claims a file change
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Workstream:** CORE. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith's tester finding of 2026-11-06 (Ask mode answered "I've switched the page to a black theme" with no file changed); Keith approved the fix and admitted it.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | Lane 1 with AI-SERVICE, beside RUN-STOP-01 in Lane 2; validator PASS | c66ae9bf0c032b39f297bb1749476545741dea89 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High, session 16f7f97e-af21-41bb-b51d-569705c3b46a | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- services/ai-service/src/worker/worker.processor.ts: a third contract ASK_OUTPUT_CONTRACT (files cannot change in Ask mode; no file-actions; no claim that a file changed; for a change request, explain or show code as text and point to Build mode). buildExecutionPromptParts takes executionIntent; the Agent contract still wins when useHarness is true, conversation gets the Ask contract, anything else keeps the Build contract. The worker passes resolveWorkerExecutionIntent(job.data.executionIntent). The Build and Agent texts are unchanged byte for byte, and the backstop that drops file-actions in Ask runs is unchanged.
- services/ai-service/src/worker/worker.processor.spec.ts: four contract tests (Ask exact text; Build for workspace_mutation and for no intent; Agent wins over conversation) and one processor-level test that a conversation job sends the Ask contract and the other two jobs the Build contract.
- RUN-STOP-01 in Lane 2 touches only frontend files; this lane touches only ai-service, so neither lane's evidence depends on the other.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service npm test | 45 suites passed; 1105 passed, 1 skipped (the known skip; HARNESS-FIXES-01A had 1100) |
| ai-service npm run build | exit 0 |
| Diff review | 2 files, both in the write set; matches the brief |

Evidence in `C:/Users/knlee/aisb-preflight/ASK-CONTRACT-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2362 | `7ac59806bb774eae644cb72647216429a9f9248a60f8a1bdbd0edff3b090ad46` |
| `brief-ask.txt` | 7409 | `fd8b9cb2c08189bcfcdecc8c5ecbfe42c0a8c65e300ff79d4cfed642acb28d32` |
| `cursor-result.json` | 9251 | `acdf5495deb8c26714b4a0d6b495896b32418302091983291bec1f71f147edfd` |
| `reviewer-gates.out` | 134 | `72e5456f63840551a2d343cd12818842764d3bb01b56e9440e926c13c2954930` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (5 n/a: no entity or schema change), FLOWS 4/4 (2 n/a: no checkpoint or revert behavior change)

FOLLOWUPS: 1 registered (STAGING-DEPLOY-11, deploying this task and RUN-STOP-01 together; NOT_READY until RUN-STOP-01 is locked and Keith approves the time) / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED. Lane 2 still ACTIVE with RUN-STOP-01. Not deployed.
