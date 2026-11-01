# HARNESS-LIVE-02 — Stage-Start

**Task:** HARNESS-LIVE-02 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Deploy commit:** c1060a44c19da779f6878c845570097312cd545e (the refusal fix; later commits are records only).
**Approved by Keith:** 2026-11-01 ("Approve the plan").
**Authorization, and no more:** one deploy of c1060a4 to ainow-staging-01; one flags-on block; up to 3 runs with write and validation tools; one revert to a save point by Keith in the browser; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Browser tools stay off. No product activation. Staging stays behind basic_auth, and the frontend still cannot start the harness.

## Sequence

1. Deploy, Cursor desktop. Same guards as HARNESS-LIVE-01. No migration, package, compose, environment or ops change.
2. Keith adds small test files to project C1 repeat from a browser console snippet.
3. Flags on. Keith types the provider key at a hidden prompt. Configuration is saved first and hash-checked.
4. Up to 3 runs from a console snippet in Keith's logged-in browser.
5. Keith reverts to the newest harness save point in the browser and checks the files with a second snippet.
6. Read-only evidence block, then flags off: saved configuration restored, hashes checked, services restarted. Keith then deletes the key.
7. Keith reads the transcripts and records his judgement.

| Run | Prompt in short | Expected |
|---|---|---|
| 1 | Create one new file with given content | write_file, save point first, file correct |
| 2 | Replace greet.js with given content, then run npm test | write_file, run_validation, passes |
| 3 | npm test fails: find the bug, fix it, confirm | likely fails on the 3-call limit, with steps, tokens and model recorded |

If run 1 or 2 fails: stop, flags off, and bring the result to Keith. Run 3 failing on the limit is a useful result, and any partial change it leaves is what the revert tests.

## Settings for the window

As in docs/HARNESS-LIVE-01-STAGE-START.md, plus in ai.env: `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` and `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=true`. Spending: the provider-side key limit of about $5, which Keith sets, is the real cap. Worst case is about $1.20 per run in output tokens.

## Checks settled at this stage-start (code read at bce90dc)

- **Intent and charging:** harness writes run on `executionIntent: conversation`. The gateway rejects harness with `workspace_mutation` only for a bound agentId, and the worker registers write tools from the flag alone. Charging stays token-based, as decided in docs/GOV-HARNESS-RESET-01-DECISION.md.
- **Save point:** the loop creates it before the first write_file or delete_file; the commit uses `--allow-empty`, so a clean workspace does not fail it. If it fails, the write does not run. There is no automatic rollback.
- **Test project:** C1 repeat has no package.json, so the setup snippet adds one with a Node-only test and no dependencies.
- **Timeout:** the dispatcher's 30-second tool timeout also applies to run_validation, so the 120-second validation timeout does not take effect. This test finishes in seconds. A real project's tests may not; this is recorded for the usable-harness work and not changed here.

## Evidence

Off-repo in `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-02/`. No key or secret value is printed or recorded.

## If it fails

On a failed block: stop, flags off, and bring the result to Keith. A fix is a new bounded step. There is no retrying beyond the 3 runs.

## Second window (added 2026-11-01)

**Why:** in the first window all three runs completed, but a hard-coded read-only list meant the model was never offered write_file or run_validation, so no write, validation or save point happened. HARNESS-WRITE-TOOLS-01 fixes that and gives the harness path a tool-based prompt, and is locked.

**Authorization, and no more:** one deploy of 320cd84de52d81e57d55b70d0da5981588914119 to ainow-staging-01; one flags-on block with a new key; up to 3 runs with write and validation tools; one revert to a save point by Keith in the browser; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Sequence, runs, settings, spending and the failure rule are as above. Evidence files are named hl04-*.

**Correction to this stage-start:** it said the worker registers write tools from the flag alone. That was true of the handlers, but a later filter limited what the model was offered, which the stage-start missed.

**Not yet exercised on the real path:** run_validation through the gateway and container-manager. If it fails, that is a result to bring to Keith.
