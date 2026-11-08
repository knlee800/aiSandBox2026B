# COLLAB-EVAL-MARKERS-01 — Checkpoint

**Task:** COLLAB-EVAL-MARKERS-01 — Wider markers for the test-asserts-nothing reviewer task
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** AGENT. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by COLLAB-EVAL-LIVE-01 (7eba7fd54f4502f40a74fb5a81afd3d4fda9bc6d) from Keith's judgement; admitted by Keith in 48cd24d17b30ba5805f95c561edcfd2fecd1af1f. Code and LOCK in one record (GOV-OS-04, LOCAL-TESTS).

## What changed

- services/ai-service/src/agent-harness/eval/review-tasks/test-asserts-nothing.json: the planted bug keeps its four markers and gains "never checks", "can't fail", "can’t fail", "cannot fail", "never asserts" and "toBe". Nothing else in the file changed; the loader rules are unchanged and accept them.
- services/ai-service/src/agent-harness/eval/review-markers.spec.ts (new, 4 tests): the saved COLLAB-EVAL-LIVE-01 answer (copied exactly; the control plane compared it with the answers file) scores the bug as caught; a send-back that names only src/sum.ts is missed; naming src/sum.test.ts without a writer hand-off is missed; the other five review tasks load with the same markers and planted-bug counts.
- services/ai-service/src/agent-harness/eval/review-loader.spec.ts: its expected marker list for test-asserts-nothing now has the ten markers. This file was added to the write scope by the control plane on 2026-11-08, after Cursor stopped because the existing spec checks the exact list; only that expectation changed.

The reviewer baseline file (baselines/review/2026-11-08-claude-opus-5-5.json, SHA-256 3548bc296ae4b95843500b3debbe67ba421f488ae27eaacb2c8e72f4a0fa29dd) is unchanged and still records the run as scored at the time (4 of 5); rescoring its saved answer with the new markers gives 5 of 5. Not deployed: eval files only; staging stays at 2a07443 and a later live run would deploy first.

## Gates (rerun by the control plane)

ai-service: 52 suites, 1157 passed, 1 skipped, 0 failed (baseline 1153 in docs/COLLAB-EVAL-LIVE-01-CHECKPOINT.md, plus 4); build clean. Cursor's own run showed the known better-sqlite3 Node ABI failures in src/messages/__tests__/messages.service.spec.ts in its shell (environmental; they pass under Node 22).

Cursor: grok-4.7-high requested for both runs, resolved Grok 4.7 256K High.

CHECKLIST: EVERY 11/11 (5: write scope expanded by the control plane to review-loader.spec.ts, expectation only; 6: new spec covers the change; 7: control plane reran tests and build, Cursor's sqlite failures environmental; 8: no runtime started; 9: n/a, no build artifact changed), BACKEND 6/6 (1 to 4: auth, internal endpoints, templates and shared contracts unchanged, eval files only; 5: n/a, no schema change; 6: compared with the COLLAB-EVAL-LIVE-01 counts)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED.
