# COLLAB-HANDOFF-RECOVER-01 — Checkpoint

**Task:** COLLAB-HANDOFF-RECOVER-01 — A finished step hand-off survives a Gateway restart
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** Keith approved the draft on 2026-11-04. Registered in 8e2e733085bfa661b6140e61f240344c9d3006d8, admitted in 887d99824ad50c501bd66b6007da28e3f2df5040. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

services/api-gateway/src/orchestration/orchestration.service.ts and orchestration.contracts.ts. The real gap was worse than registered: after a Gateway restart between completing a step and creating its requested hand-off, the next page poll or sweep saw nothing open and marked the run finished, so the requested work silently never happened.

- The live hand-off step now sets pendingJob.handoffChecked = true once it has decided, for every outcome (no request, refused, malformed, created, existing follow-up, no agent list). The page does not read this field.
- A completed step counts as processed when handoffChecked is set, it has a handoffNote, it has no pendingJob, or any referral in the run carries its answer-handoff idempotency key (any status).
- One recovery helper runs the normal hand-off path for unprocessed completed steps of an active run (empty answers parse as no request). It runs in the 5-minute sweep and in the run read the Team page polls, before settlement.
- Settlement does not finish a run while it has an unprocessed completed step.
- A unique violation on uq_collaboration_referrals_idempotency_active (a race) is treated as already done; other unique violations stay refusals.
- No migration; approval, guards, caps, rounds and depth unchanged.

## Implementer

Cursor CLI, requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, one session with two control-plane review deltas: the first moved recovery into the page read and replaced a visible "none" note with the hidden flag; the second stopped empty answers and steps without pendingJob from holding a run open forever.

## Control-plane review

Read the diff after each round. Reran: npx jest src/orchestration src/clients src/guards 13 suites, 256 passed; full api-gateway suite 2573 passed, 14 failed (the known smoke.integration baseline), 7 skipped; npm run build exit 0.

## Limits

Mock-tested only; not deployed. The database index covers active and completed rows but not failed, cancelled or timed-out ones; recovery checks every status, the live retry path does not. pendingJob updates are read-modify-write, as before.
