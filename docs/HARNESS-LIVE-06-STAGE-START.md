# HARNESS-LIVE-06 — Stage-Start

**Task:** HARNESS-LIVE-06 (Lane 1; STAGING, PROVIDER-LIVE, CREDIT, ENV; PROVIDER-LIVE evidence).
**Deploy commit:** a481b9d05322d34707fcdb99f7458ac1ed2e08d0 (run list and reconnect; later commits are records only).
**Approved by Keith:** 2026-11-02, with the RUN-STATUS-01 and RUN-RECOVER-01 draft.
**Authorization, and no more:** one deploy of a481b9d to ainow-staging-01, with requests carrying no key to confirm the guard; one flags-on block; up to 3 runs that Keith starts in the browser; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Browser tools stay off. No product activation. Staging stays behind basic_auth.

## Sequence

1. The control plane runs the deploy and guard checks over SSH.
2. Keith makes a provider key and resets the test files from a console snippet.
3. Flags on. Keith types the key at a hidden prompt.
4. Keith runs the three cases: refresh during an Agent run, close the page during an Agent run, refresh during a Build run. He then opens the run list.
5. The control plane runs evidence and flags off over SSH. Keith deletes the key.
6. Keith records his judgement.

## Checks at this stage-start (code read at the RUN-RECOVER-01 lock)

- No migration or package change between 0838a5f and a481b9d. The deploy block stops if the migration hash changes.
- A Build run takes seconds, so the refresh has to be quick. If it finishes first, that case proves nothing and is reported as such.

## Settings for the window

As in docs/HARNESS-LIVE-05-STAGE-START.md: same caps, write and validation tools on. The provider-side key limit of about $5, which Keith sets, is the real cap. Worst case is about $1.52 per Agent run.

## Evidence

Off-repo in `C:/Users/knlee/aisb-preflight/HARNESS-LIVE-06/`. No key or secret value is printed or recorded.

## If it fails

On a failed block: stop, flags off, and bring the result to Keith. A fix is a new bounded step.

## Second window (added 2026-11-02)

**Why:** in the first window, the refresh case (execution 21623ded) and the run list passed. The next run was refused by the 100,000-token rolling limit, so the close-the-page and Build cases did not run. Keith instructed a higher limit, and HARNESS-QUOTA-01 is locked.

**Authorization, and no more:** one deploy of 67c054a4ffe183f6f4e96c2550350a48863a39a2 to ainow-staging-01, with requests carrying no key to confirm the guard; one flags-on block with a new key; up to 2 runs in the browser; one read-only evidence block; one flags-off block. Any failed block stops; no rollback or other recovery runs without separate approval. Settings, caps, spending and evidence rules are as above. Evidence files are named hl09-*.
