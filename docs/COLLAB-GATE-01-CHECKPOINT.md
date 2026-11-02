# COLLAB-GATE-01 — Checkpoint

**Task:** COLLAB-GATE-01 — Approval gate, loop prevention and safety checks for collaboration hand-offs
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** gaps found in COLLAB-LIVE-01 and its review. Keith approved the draft on 2026-11-02. Registered and admitted in 541c03860b502233a33f3bb35cdec85f0f5b1f0a. Code and lock are one commit under the GOV-OS-04 rules.

## What changed

A hand-off is saved with its job in a new nullable `pending_job` column and waits at `pending_approval` with no job and no ledger row. New internal routes approve and reject it. Approve runs the off switch, provider switch, daily spend and rate limits, abort mode, credit balance and token limit checks; a refusal leaves it waiting. A single conditional update claims it, so a repeat approve gets 409 and no second job. Depth, chain and visited come from the parent hand-off on the server; caller values are not read and caller limits are clamped down. The ninth stored hand-off in a run is refused. A run ends completed or failed when read, once none is waiting or running.

## Not applied, and why

SessionOrApiKeyAuthGuard and AuthorizationGuard (the caller is the internal service), LaunchGuard (needs API-key flags a run does not have), IdempotencyGuard (the claim and the create key cover it), QuotaGuard (legacy per-key counter; the token limit is TokenQuotaGuard), RateLimitGuard (per-IP on the public route; platform rate limits still run).

## Implementer

Cursor CLI, requested grok-4.7-xhigh, one run.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| api-gateway `npx jest` | 2494 passed, 7 skipped, 14 failed; only the known smoke.integration failures |
| api-gateway `npm run build` | exit 0 |
| Validator | exit 0 at this record |

## Limits

Not deployed; the migration has not run outside unit tests. Daily spend is an in-memory counter that resets on restart. Agents still do not choose hand-offs. No UI: approve and reject are internal routes, and decidedBy is what the caller says.
