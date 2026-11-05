# ACCESS-01F — Checkpoint

**Task:** ACCESS-01F — Daily spend caps counted from the credit ledger
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** slice S6 of docs/ACCESS-READY-01-PLAN.md. Keith approved the scope and the default caps (500 credits per user, 1,000 platform per UTC day) and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with GOV-ACCESS-PLAN-01 | 1604ace |
| 1b. Admission | Lane 1 with GATEWAY | d7971b750cac533ec6dee012beb1cc8b5cf4fba3 |
| 1c. Scope expansion | Keith approved three more files after the first run stopped | 104a8a25ba4b15c620fcad3d385972e788cc86de |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High; see runs below | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

Cursor runs, all on knlee801@gmail.com: e675b3b4-fd04-49f4-be1a-bc6d915e32fd stopped before editing (removing the USD counter breaks a collaboration test outside the scope); a second run was stopped by the control plane within seconds because its brief had a broken Node path (no file changed, tree checked clean); c912a53a-0094-4cda-91fe-22db381710ff stopped at its hash check because the brief named the script col-afxx.py (no file changed); 0ef26a11-afe2-4017-8121-dc5e8daecb14 applied the scope record and implemented the task.

## What changed

- services/api-gateway/src/safety/daily-credit-cap.service.ts: sums requested_credits from credit_deduction_records created since 00:00 UTC, for the platform and for the caller (owner_id), every status included. MAX_DAILY_CREDITS_PLATFORM (default 1,000) and MAX_DAILY_CREDITS_PER_USER (default 500); a missing, empty, non-numeric or non-positive value uses the default. Platform or user total at or above its cap: 429 "Daily credit limit reached" with cap platform or user. Missing user ID: 429. Read error or invalid total: 503 "Daily credit limit check failed", warning without the error.
- execution-safety.guard.ts: after the kill switches, awaits the cap check with request.apiKeyIdentity.userId, then the unchanged rate and max-token checks. The cap service is injected optionally because specs outside safety/ build the real guard with only GlobalSafetyLimitService; when absent the guard skips the cap and warns once. SafetyModule provides and exports the cap service and registers the repository, and the AI, orchestration and public API modules all import SafetyModule, so production always has it (wiring test added).
- global-safety-limit.service.ts and global-safety-limits.config.ts: the in-memory daily USD window, recordExecutionCost, the daily spend getter and MAX_DAILY_SPEND_SOFT_USD / MAX_DAILY_SPEND_HARD_USD removed; per-minute limits, MAX_TOKENS_PER_EXECUTION and kill switches unchanged.
- startup/configuration.validator.ts and spec: range checks for the two credit caps (1 to 10,000,000) replace the USD checks and the soft-below-hard rule.
- orchestration/internal-collaboration.controller.spec.ts: the waiting hand-off test now uses the real cap service with a ledger fake at the platform cap and expects 429; nothing else in the file changed.
- Safety specs updated; new specs for the cap service and module wiring.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/safety src/orchestration src/startup` | 22 suites, 449 passed |
| api-gateway `npm test` | 2681 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) |
| api-gateway `npm run build` | exit 0 |
| Diff review | only files in the expanded write scope changed; module wiring checked |

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-01F/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-af.txt` | 4760 | `bab7c20c1f48a199ba6ae2fb6c1be5dd5c4aff25364dc381b2c269b6db41c5d4` |
| `brief-af2.txt` | 7696 | `f2ee403c541ee9717ae3db745d4769c0a3748c15d122382966931f6f6ed1e9f7` |
| `cursor-result.json` | 9787 | `fe8b1ca5bf7516e87281ef4f1321813f66d177970a03fc5d9ff6331e2e510bf8` |
| `reviewer-npm-test.out` | 284 | `8e3e914b4940171367da81ddc2d66dc0b3dbcb0ee4d7b8cb125505b333c08e50` |

## Acceptance criteria

All nine met by diff review and the reviewer run; the ledger query is proven by mocks, not on a database. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed; staging still has the in-memory USD counter until the next staging deploy, after which the defaults apply (staging gateway.env sets neither credit cap).
- A run's cost is recorded when it finishes, so a run in progress is not counted and one run can pass a cap by its own size.
- Two ledger reads per execute request and per hand-off approval. Earlier live-window scripts set MAX_DAILY_SPEND_*; those settings are no longer read, and future windows set the two credit caps instead.

FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED.
