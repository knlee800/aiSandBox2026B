# HARNESS-LIVE-05 — Stage-Start

**Task:** HARNESS-LIVE-05 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Deploy commit:** 0838a5f47947ddc4ff884f66d999489501ea1294 (progress and Agent mode; later commits are records only).
**Approved by Keith:** 2026-11-02.
**Authorization, and no more:** one deploy of 0838a5f to ainow-staging-01, with requests carrying no key to confirm the guard; one flags-on block; up to 3 Agent runs that Keith starts in the browser; one revert from the screen; one Ask and one Build check; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Browser tools stay off. No product activation. Staging stays behind basic_auth.

## Sequence

1. The control plane runs the deploy and guard checks over SSH.
2. Keith makes a provider key and resets the test files from a console snippet.
3. Flags on. Keith types the key at a hidden prompt.
4. Keith uses Agent mode in the screen, on Anthropic with claude-opus-5-5, then one Ask and one Build check.
5. The control plane runs evidence and flags off over SSH. Keith deletes the key.
6. Keith records his judgement, including how it feels to use.

## Checks at this stage-start (code read at 6f78db3)

- No migration or package change between 8fb5b63 and 0838a5f. The deploy block stops if the migration hash changes.
- The frontend catalogue offers claude-opus-5-5.
- Agent sends the same workspaceContext as Ask and Build. The console runs in earlier windows sent none, so this is new.
- The Build check is a real single-shot provider call, so it needs execution on, and is covered by the same caps.

## Settings for the window

As in docs/HARNESS-LIVE-04-STAGE-START.md: same caps, write and validation tools on. The provider-side key limit of about $5, which Keith sets, is the real cap. Worst case is about $1.52 per Agent run.

## Evidence

Off-repo in `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-05/`. No key or secret value is printed or recorded.

## If it fails

On a failed block: stop, flags off, and bring the result to Keith. A fix is a new bounded step.
