# CLEAN-BASELINE-RUNTIME-01 — Checkpoint

**Date:** 2026-10-07
**Status:** COMPLETE AND LOCKED
**HEAD:** `078df1bfc3e5b42a4065385ff8b98b3e4ec3fe91`
**Lane:** Lane 1 released EMPTY. Lane 2 EMPTY. Lane 3 DISABLED.
**Mutexes:** CONTAINER-MANAGER, LOCAL-RUNTIME, ENV, and GATEWAY released UNOWNED. GOVERNANCE UNOWNED.

## Lock basis

Accepted evidence package, reviewed independently before this closure. This lock reuses that package. No further implementation or test cycle was run.

- Path: `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-RUNTIME-01-ISOLATION-2026-10-07.zip`
- Size: 9168136 bytes
- SHA-256: `815fbcd6d3a99514ec2e872ece98ea965eb58c5552618873a94cd8e2c1fe403b`

## What this lock records

Selected runtime Node 24. Normal workspace image default `node:24-alpine`, overridable by `SANDBOX_IMAGE`. Local smoke contract in the accepted package: execution disabled returns 503 and does not enqueue; execution enabled only inside that test returns 202 queued. Focused smoke: 14 passed. Full gateway: 7 skipped, 2294 passed, 2301 total, exit 0.

## What this lock does not record

OPS-01 and DEPLOY-01 remain `NOT_READY` and unadmitted. Deployment, a real Builder journey, backup and restore acceptance, host access, invitations, harness activation, live provider execution, and spending remain separate. `HOST_CLEAN=NO`. `P7_ACCEPTED=NO`. `EXEC-01C6A=NOT_READY`. The ARCHITECTURE replacement row stays PLANNED. Authorization flags are unchanged: `localRuntimeAuthorized` true; staging, provider-live, and credit unauthorized.

## Closure records

- `TASKS.md`
- `TASKS_BACKLOG_FULL.md`
- `docs/control-plane/lane-saturation-state.json`
- `docs/CLEAN-BASELINE-GOV-01-DECISION.md`
- `docs/CLEAN-BASELINE-RUNTIME-01-CHECKPOINT.md`

The four implementation files and `ARCHITECTURE.md` are unchanged by this closure. `docs/control-plane/SATURATION_PROOF.json` is the validator output for this end state.

## Validator

`scripts/validate-lane-capacity.ps1` exited 0. Result PASS. idleCode `NO_PAIRWISE_ADMISSIBLE_CANDIDATE`.

- HEAD: `078df1bfc3e5b42a4065385ff8b98b3e4ec3fe91`
- occupancyHash: `942ff6798903e6f79e92aca2e8641dfcf7d4e19903c94c3429b13f2c37e5ec3d`
- sidecarSha256: `8692161a85fd4eec8f7112b0e7c4b01b0c7281e85f419f68dad1fb7fa73c062f`
- mutexCatalogSha256: `64232fa4b478f75a4b5542342d1bfa868398338a7b60cd86233552dd64c8d4df`

Pre-closure proof, preserved before that run: `C:\Users\knlee\aisb-preflight\CLEAN-BASELINE-RUNTIME-01-work\SATURATION_PROOF-before-runtime-01-lock.json` SHA-256 `9e8ea6b11016af5fef3574a92a9ec61e0da8835b96bc07c20683481cc8478318`.
