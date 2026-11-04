# HARNESS-EVAL-01 — Checkpoint

**Task:** HARNESS-EVAL-01 — A repeatable eval suite for the Agent Harness
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-04, with a comparison against the previous run added. Registered and admitted in a087ee0373bcdf22da7c9f0d17ac76be000bf95f. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

New folder services/ai-service/src/agent-harness/eval/ only (8 source files, 5 spec files, 10 task files). No change to the loop, handlers, dispatcher, worker, config, package or jest files.

- Task format: one JSON file per task in eval/tasks/ (inline starting files, user request, expected files created, modified, deleted or unchanged, content checks, answer checks, validation result, paths that must not be written). The loader validates each file and rejects unknown fields, bad shapes and duplicate ids.
- Runner: runEvalTask and runEvalSuite call the real executeAgentHarnessLoop with the real read, list, search, write, delete and validation handlers. The model call (executeFn) and the workspace client are injected; the default client is an in-memory workspace whose validation result comes from the task content checks.
- Scores per task: passed; safetyViolations (writes or deletes reaching the client for a mustNotWrite path, a path outside the workspace or a .env file); blockedAttempts (calls the handlers refused); modelCalls; toolCalls; tokens; credits (null unless a tokens-to-credits function is supplied); endedAs (answered, refusal, step_limit, error, aborted); failureReasons; finalAnswer (capped at 1000 characters).
- Results JSON per run (runId, date, model, harness version, tasks, totals), written to a directory the caller gives. compareResults lists regressions, fixes, new and missing tasks, and per-task changes in model calls, tool calls, tokens and credits, with a short text table.
- Ten seed tasks: answer from a file, edit one file, create a new file, fix a failing test, search then edit, change a function and its caller, refuse to write .env or ../, request already satisfied, delete a file, large request within the step limit.

## Implementer

Cursor CLI, requested grok-4.7-high, resolved Grok 4.7 256K High. One delta after review.

## Control-plane review

Read the scorer, runner and seed tasks. Review finding sent back as a delta: nothing checked the final answer, so answer-from-file passed with a wrong answer. Fixed with optional answerChecks and a stored finalAnswer; a spec shows "London" failing and "Paris" passing. Specs write only to temporary directories; the suite makes no network, process or provider calls.

Reran in Git Bash with Node v22.14.0: ai-service npm test 44 of 44 suites, 1063 passed, 1 skipped; npm run build exit 0. Cursor saw 4 failures in messages.service.spec.ts from a better-sqlite3 build for another Node version; they do not occur on Node 22.

ARCHITECTURE.md section 12.1 gains one row for the eval suite as internal dev tooling. PRD.md is unchanged.

## Limits

Scripted answers only: this proves the measuring tool, not harness quality. Refusal detection reads only the opening words of the answer. The runner does not seed or reset a remote workspace and does not build the worker system prompt or tool list; HARNESS-EVAL-LIVE-01 must supply a real executeFn, a seeded client and a credit function at its stage-start. HARNESS-EVAL-LIVE-01 stays NOT_READY until Keith approves a live window.
