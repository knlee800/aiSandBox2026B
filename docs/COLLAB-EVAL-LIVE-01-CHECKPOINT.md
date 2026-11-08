# COLLAB-EVAL-LIVE-01 — Checkpoint

**Task:** COLLAB-EVAL-LIVE-01 — First real run of the reviewer eval
**Status:** COMPLETE AND LOCKED — 2026-11-08
**Workstream:** AGENT. **Lifecycle:** 4-STEP. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** registered by COLLAB-EVAL-01 (13fe7e512fe46d406343797083bdde91a41c5fae). Keith approved the stage-start plan and the 150,000-token cap on 2026-11-08, after TESTER-WINDOW-CLOSE-01 closed the tester window. Separate LOCK record under the GOV-OS-04 rules.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | in the COLLAB-EVAL-01 LOCK | 13fe7e512fe46d406343797083bdde91a41c5fae |
| 2. Stage-start and admission | Lane 1 with AI-SERVICE, STAGING and PROVIDER-LIVE | 8bf0be8d1070a26798212c56ee018d95f57025ea |
| 3. Live runner, deploy and run | runner by Cursor (grok-4.7-high, resolved Grok 4.7 256K High), reviewed by the control plane; deploy and run from the staging host | 2a0744384e213cebadb9f49317162d0bb06df3c4 |
| 4. LOCK | this checkpoint, the reviewer baseline, board, backlog and sidecar, canonical validator | this record |

## What was built

services/ai-service/src/agent-harness/eval/live/: review-live-execute.ts, review-live-run.ts, run-review-live.ts and review-live-runner.spec.ts (11 tests). Each model call is built the way the worker builds a coding-team reviewer step: buildExecutionPromptParts with the hand-off task as the prompt, the task's file list, no global instructions, the task's reviewerPrompt as project instructions, useHarness true and execution intent conversation (the gateway's startReferralExecution sets it for every hand-off step); buildAIExecutionRequest with provider anthropic; the review-profile tools read_file, list_files, search_workspace and run_validation, with no write or delete (the worker registers knowledge tools only for the read profile with scopes, so none here). AnthropicAdapter, claude-opus-5-5, maxRunTokens 60000, step limit 8, whole-run cap 150,000 tokens, credits at 1 per 1K tokens; full answers written to a separate answers file; the key read only from the environment and scrubbed from output, errors and files. Reuses the harness live runner's helpers; no existing file changed.

Gates rerun by the control plane: ai-service 51 suites, 1153 passed, 1 skipped, 0 failed (baseline 1142 in docs/COLLAB-EVAL-01-CHECKPOINT.md, plus 11); build clean. Cursor's own run showed 4 failures in src/messages/__tests__/messages.service.spec.ts from better-sqlite3 built for another Node ABI in its shell (environmental; they pass under Node 22).

## Deploy (cel-deploy.sh, 2026-11-08T10:38Z)

bae24d9 to 2a07443 with the standard block: configuration files at the baseline hashes before and after (the tester window was closed), AI_PROVIDER stub and GLOBAL_EXECUTION_ENABLED false, nothing running, migration hash unchanged (cbd04277...), all eight units active, health 200, 24 guard checks 401, the static test key 403, CORS checks pass, the built runner and the six review tasks present.

## Run (cel-run.sh, 2026-11-08T10:39Z)

Run on the host as the service user with the stored test key passed only in its environment; no worker run, no user credits, no project, session or run created. Output files checked for the key text: none found.

| Task | Planted | Scored | Reviewer answer | Model calls | Tokens |
|---|---|---|---|---|---|
| clean-change | 0 | pass (approved, not sent back) | approved; optional extra test cases | 4 | 6,940 |
| missing-null-check | 1 | caught | sent back: displayName(undefined) and displayName({}) crash; tests for both | 3 | 5,652 |
| off-by-one | 1 | caught | sent back: loop stops one item early; whole-result tests | 3 | 5,313 |
| security-slip | 1 | caught | sent back: path traversal through path.join; a relative-path check, not startsWith | 3 | 5,818 |
| test-asserts-nothing | 1 | missed by scoring | sent back naming src/sum.test.ts: the test never checks what sum returns and cannot fail; asked for expect(sum([1, 2, 3])).toBe(6) | 3 | 5,602 |
| wrong-comparison | 1 | caught | sent back: count < 10 should be count <= 10; limit tests | 3 | 5,073 |

Totals: 6 tasks, 5 passed by scoring, 4 of 5 bugs caught by scoring and 5 of 5 by reading, clean change not sent back, 19 model calls, 21 tool calls, 34,398 tokens of the 150,000 cap, 37 credits, 0 safety violations, 0 blocked attempts, every task ended with an answer, about 53 seconds. Model claude-opus-5-5. No task was repeated: the one unclear result comes from the task's marker list, not from the reviewer, so a repeat would not change it.

Reviewer baseline: services/ai-service/src/agent-harness/eval/baselines/review/2026-11-08-claude-opus-5-5.json (the run's results file, SHA-256 3548bc296ae4b95843500b3debbe67ba421f488ae27eaacb2c8e72f4a0fa29dd). It sits in a review subfolder so the harness baseline self-compare test keeps reading only the harness baselines.

Evidence in `C:/Users/knlee/aisb-preflight/COLLAB-EVAL-LIVE-01/`:

| File | SHA-256 |
|---|---|
| `cel-deploy.sh` | `992508657e9cfa77397215ee9f2f6600d70ac63c2681855ab600749a99c60ce0` |
| `cel-run.sh` | `b34ec24f779170143b9cc6906831957377fb11523558a4680f3a7cf20b810128` |
| `aisb-cel1-results.json` | `3548bc296ae4b95843500b3debbe67ba421f488ae27eaacb2c8e72f4a0fa29dd` |
| `aisb-cel1-answers.json` | `375c7695230f4966734bc212a570b50c58f9bc65363f51b574d2e38a857cb8ea` |
| `aisb-cel1-out.txt` | `34ec82fe1b6aada6bbc63314017c543f60f0fbf2ef5b0d499bf54e6dd9b70b1b` |

## Findings

- A single reviewer on claude-opus-5-5 sent back all five planted bugs with the right file and a correct fix, and approved the clean change. This is the evidence for COLLAB-FANOUT-01, whose readiness is that a single reviewer misses bugs worth the cost; this run shows no such miss.
- test-asserts-nothing's markers ("asserts nothing", "no assertion", "adds the numbers", "no expect") did not match a correct answer that said the test never checks the result and cannot fail. COLLAB-EVAL-MARKERS-01 is registered to widen them and rescore the saved answers.
- The eval validation tool only reports that validation passed; on the clean change the reviewer said it could not confirm the test ran. This is the in-memory eval workspace's limit, recorded in COLLAB-EVAL-01.

## Keith judgement

Keith accepted the run as the reviewer baseline on 2026-11-08, with test-asserts-nothing counted as a marker miss, and asked to register the marker fix.

## Limits

In-memory workspace only; no container files and no real npm test. One provider and model. Staging now runs 2a07443 (eval code only since bae24d9); runs stay off. stagingAuthorized and providerLiveAuthorized are false after this lock.

CHECKLIST: EVERY 11/11 (3: grok-4.7-high named for every Cursor run; 7: control plane reran ai-service tests and build, Cursor's sqlite failures reported as environmental; 8: no local runtime started; 9: n/a, no build artifact changed), BACKEND 6/6 (1 to 4: auth, internal endpoints, templates and shared contracts unchanged, eval/live only; 5: n/a, no schema change; 6: compared with the COLLAB-EVAL-01 counts), DEPLOY 7/7 (1: STAGING held; 2: baseline hashes before and after, no tester active; 3 and 7: n/a, tester window closed; 4: nothing running, deployed commit and migration hash as expected, health and guard checks pass, configuration unchanged; 5: run from the host; 6: outputs checked for key text), LIVE 4/4 (1: PROVIDER-LIVE held, CREDIT not needed, no user credits; 2: cap 150,000 tokens and the expected spend in the approved draft, key from the stored key file and never shown; 3: results from the host-side results and answers files; 4: n/a, no fix needed during the live step)
FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (COLLAB-EVAL-MARKERS-01)

## Lock

COMPLETE AND LOCKED on 2026-11-08 by the control plane. Lane 1 released EMPTY; AI-SERVICE, STAGING and PROVIDER-LIVE released UNOWNED; the three authorization flags false.
