# COLLAB-EVAL-01 — Checkpoint

**Task:** COLLAB-EVAL-01 — A repeatable collaboration eval
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** AGENT. **Lifecycle:** 3-STEP (changed from 4-STEP at admission). **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT per PRD.md (the gated Team page, active development).
**Source:** registered 2026-11-05 from Keith's Agent Teams decisions; scope drafted by the control plane (a reviewer eval with planted bugs and a clean control, scripted models only); admitted on 2026-11-08 after Keith's approval.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Admission | Lane 1 with AI-SERVICE; Cursor applied the hash-checked record; validator PASS | e1fc4f5 |
| 2. Implementation | Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High; one review delta (marker rule) | this commit |
| 3. LOCK | this checkpoint, board, backlog, sidecar and the ARCHITECTURE.md section 12.1 eval row; canonical validator | this commit (LOCAL-TESTS) |

## What changed

All under services/ai-service/src/agent-harness/eval/ (13 new files, 5 changed). Nothing else: the agent loop, tool handlers, tool registry, worker, gateway, agent instructions, package and jest files are unchanged; eval/live/ and eval/baselines/ are unchanged.

- review-types.ts, review-loader.ts: a reviewer task is one JSON file in review-tasks/ with id, description, initialFiles (the writer's change already applied), handoffTask, reviewerPrompt and plantedBugs (id, kind, file, markers), optional maxToolIterations and validation. The loader rejects unknown fields, bad shapes, duplicate ids, a planted bug whose file is not in initialFiles, and a marker with no letter or digit other than the comparison operators < <= > >= == === != !==.
- review-runner.ts: runReviewTask and runReviewSuite call the real executeAgentHarnessLoop with the real read, list, search and validation handlers on the in-memory workspace. The request carries handoffTask as the prompt and reviewerPrompt as projectInstructions for a later live model call. write_file and delete_file are registered only as refusals: no file changes, a safety violation (reviewerCannotChangeFiles) and a blocked attempt are recorded.
- review-score.ts: a planted bug is caught when the full answer contains <handoff to="writer"> and names the bug's file (path or base name) and at least one marker, case-insensitive; a clean task passes only without that send-back; a run with no answer fails. Each task records bugs planted and caught, sentBack, passed, safety violations, blocked attempts, model and tool calls, tokens, credits, how it ended, failure reasons and the capped answer; run totals add up tasks, passed, bugs planted and caught, clean-task send-backs, calls, tokens, credits and safety violations.
- eval-results.ts, eval-compare.ts, eval-types.ts, index.ts: reviewer results files are built, written and read beside the harness ones; compareResults now reads only the fields both kinds share, so the two harness baselines still load and compare (a new spec compares each with itself). New exports.
- review-tasks/: off-by-one (copyAll in src/items.ts drops the last item), wrong-comparison (withinLimit in src/limit.ts uses < 10 where <= is meant), missing-null-check (displayName in src/user.ts reads user.name without a check), test-asserts-nothing (src/sum.test.ts calls sum and asserts nothing), security-slip (resolveUserPath in src/files.ts joins user input with no traversal check), clean-change (a correct double and its test). Two to four markers each.
- review-prompt.spec.ts: every task's reviewerPrompt equals what buildCollaborationProjectInstructions builds for the coding team's reviewer with no caller instructions ("You are reviewer.", the reviewer's instructions, lead and writer on the other-agents lines, the hand-off rule), checked against the text of services/api-gateway/src/system-agents/system-agent-registry.ts.
- review-loader.spec.ts, review-runner.spec.ts: the seed tasks load; unknown field, duplicate id, missing file and a ".." marker are rejected; a catch, a miss, the right markers in the wrong file, a send-back without a marker, an ellipsis send-back, a send-back on the clean task, a plain verdict on it, a write attempt refused with files unchanged, totals and results comparison.

Review delta: the first build used ".." as a security-slip marker, which any answer with an ellipsis would match. Replaced with traversal and outside the workspace, and the loader now refuses punctuation-only markers.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| ai-service jest --runInBand | 50 suites passed; 1142 passed, 1 skipped, 0 failed (baseline PROVIDER-LIMIT-MSG-01: 47 suites, 1123 passed, 1 skipped; 3 new suites, 19 new tests). Before the review delta: 1140 passed. |
| ai-service npm run build | exit 0 |
| Diff review | 18 files under eval/ (13 new, 5 changed), nothing outside it; no provider, network or process call in the new specs |
| Gateway, frontend | not run: no file changed there |

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-EVAL-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-admit.txt` | 2333 | `5005ad69e5f4846996ac944f7226d8516683c90825bf86b94c4c9156dda9fd5f` |
| `brief-impl.txt` | 11803 | `b0530d70779ceab05f8636fae208f2651b93200cb265e6a39cde11941cbe1485` |
| `brief-delta.txt` | 1698 | `21c16cfeea2b48dd7ca69a12c2068e4cd8c2617a82f7b7f452a4f68c40ddd065` |
| `cursor-admission-result.json` | 3208 | `3da94afec92a9ca0c37340af0a06ac8ec28108e0519e3b3430519929bd22d6be` |
| `cursor-impl-result.json` | 10255 | `f5f36908a455c14da59031473e1e87489fd04be5953ae4759ce50d662cefbd8c` |
| `cursor-delta-result.json` | 4918 | `b889d1fe70e4d5b476ff914fbf26785463c970227da1465ae9baae5051f665e3` |
| `reviewer-gates.out` | 207 | `270a2c150a4c2e78be59a5ab85713081ee628772be6d7be53aeb8169edb92e08` |

## Limits

Scripted answers only: this proves the measuring tool, not how well the real reviewer reviews. A catch is text matching, so a send-back that names the file and a marker for another reason still counts; the live run reports each answer so Keith can judge them. The tasks run on the in-memory workspace, where run_validation answers exit 0 because review tasks have no content checks; scoring does not use it. The live model call for a reviewer step is not built here; it belongs to COLLAB-EVAL-LIVE-01.

## Acceptance criteria

All eight met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (8: no runtime started; 9: n/a, no build artifact changed), BACKEND 6/6 (1: auth, cookies, CSRF, keys and guards unchanged; 2: no internal endpoint changed; 3: no generated-app template changed; 4: no shared contract changed, eval types only; 5: n/a, no entity or schema change; 6: compared with the PROVIDER-LIMIT-MSG-01 ai-service result, no new failure)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: COLLAB-EVAL-LIVE-01, the first real run, OPTIONAL as the control-plane default, NOT_READY until the tester window is closed and Keith approves the run)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; AI-SERVICE released UNOWNED. Eval tooling only; nothing to deploy for the product. Staging runs bae24d9.
