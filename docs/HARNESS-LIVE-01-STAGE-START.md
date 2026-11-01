# HARNESS-LIVE-01 — Stage-Start

**Task:** HARNESS-LIVE-01 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Base commit:** 2661cb516d5ca2a5b9f40faf625931a60c4825fc.
**Approved by Keith:** 2026-11-01.
**Authorization, and no more:** one deploy of 2661cb5 to ainow-staging-01; one flags-on block; up to 3 read-only harness runs; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. No write, validation or browser tools. No product activation. Staging stays behind basic_auth, and the frontend still cannot start the harness.

## Sequence

1. Deploy, Cursor desktop, Keith's VPN off. Same guards as STAGING-DEPLOY-02. No migration, package, compose, environment or ops change.
2. Keith adds a few small test files to a project in the browser.
3. Flags on. Keith types the provider key at a hidden prompt. Current configuration is saved first and hash-checked. The block confirms the harness signing secret is present and equal in both files, printing no value, and stops if it is not. It adds no secret.
4. Up to 3 runs, each from a console snippet in Keith's logged-in browser: list the files; answer from one file; answer by following a clue across files. A session cookie is used, with no API key created. The third run may hit the 3-step limit, which is a useful result.
5. Read-only evidence block: usage rows including `model`, credits, harness events from the worker journal, and proof that no workspace file changed.
6. Flags off: saved configuration restored, hashes checked, services restarted. Keith then deletes the key in the provider console.
7. Keith reads the transcripts and records his judgement.

## Settings for the window

| Setting | Value | File |
|---|---|---|
| `GLOBAL_EXECUTION_ENABLED` | true | gateway.env |
| `PROVIDER_ANTHROPIC_ENABLED` | true | gateway.env |
| `AI_PROVIDER` | anthropic | gateway.env, ai.env |
| `ANTHROPIC_API_KEY` | typed by Keith | gateway.env, ai.env |
| `ANTHROPIC_MODEL` | claude-opus-5-5 | gateway.env, ai.env |
| `MAX_DAILY_SPEND_SOFT_USD`, `MAX_DAILY_SPEND_HARD_USD` | 1, 2 | gateway.env |
| `MAX_EXECUTIONS_PER_MINUTE_GLOBAL` | 2 | gateway.env |
| `MAX_TOKENS_PER_EXECUTION` | 16000 | gateway.env |
| `AGENT_HARNESS_BROWSER_SESSION_USER_IDS` | Keith's test user | gateway.env |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | true | ai.env |
| `EXECUTION_TIMEOUT_MS` | 180000 | ai.env |

Write, validation and browser tools stay false. Exact names are checked against the host files when the block is built.

## Spending

Our daily spend check may not price these models, and this is not confirmed. **The provider-side key limit of about $5, which Keith sets, is the real cap.** Worst case is about $1.20 per run in output tokens alone, if all 3 steps reach the 16,000-token limit, at $20 per million output tokens as read on 2026-10-31.

## Evidence

Off-repo in `C:\Users\knlee\aisb-preflight\HARNESS-LIVE-01\`. The worker logs harness audit events to its journal (`auditEventsEnabled` defaults true). The tool steps and final answers are what Keith judges. No key or secret value is printed or recorded.

## If it fails

This is the first real-model run ever, so failure is possible. On a failed run: stop, flags off, and bring the result to Keith. A fix is a new bounded step. There is no retrying beyond the 3 runs.

## Scope correction

The primary write scope is none: host state and off-repo evidence only. ENV is added because this task changes host environment files for the window. The deploy runs inside this task because a separate deploy task adds records without adding safety; this meets the dependency recorded in the task body.

## Second window (added 2026-11-01)

**Why:** in the first window, runs 1 and 2 completed with correct answers using one tool each. Run 3 failed on the 3-step limit, which its three-file clue could not fit, and left no steps, tokens or model. The multi-step criterion is not proven. Keith kept this task open and approved a fix and a second window. HARNESS-FAIL-RECORD-01 is locked.

**Authorization, and no more:** one deploy of 4e69b66a4c4528fa8c928d84c276c1dfc47235c5 to ainow-staging-01; one flags-on block with a new key; 3 more read-only runs; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Settings, caps, spending and evidence rules are as above. Evidence files are named hl02-*.

| Run | Prompt | Expected |
|---|---|---|
| 4 | List the files, then read the one with "final" in its name and give the launch day | list_files then read_file, answer Tuesday |
| 5 | Read ht-clue.txt, follow it, and give the code name and files read | two reads, answer BLUE HERON, within the limit |
| 6 | The same prompt as run 3 | fails on the limit, now with steps, tokens and model recorded |

If run 4 or 5 fails: stop, flags off, and bring the result to Keith.

**Correction to the first window's flags-off output:** the line "expected 0" for KEY LINES and ALLOWLIST LINES was wrong. The baseline gateway.env holds one placeholder key line and one empty allowlist line, so gateway=1 ai=0 and gateway=1 are correct; the restored file's hash matches the pre-key baseline. The second window's block prints the corrected expectation.
