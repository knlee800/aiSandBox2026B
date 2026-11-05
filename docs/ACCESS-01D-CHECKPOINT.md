# ACCESS-01D — Checkpoint

**Task:** ACCESS-01D — Per-plan daily token limit and a run-sized balance check
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 3-STEP under the GOV-OS-04 record rules. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** slice S4 of docs/ACCESS-READY-01-PLAN.md. Keith approved the scope and decision D2 (daily token limit per plan with a per-user override: free 100,000; starter 500,000; pro 1,000,000; team 2,000,000) and admitted it on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration | with GOV-ACCESS-PLAN-01 | 1604ace |
| 1b. Admission | Lane 1 with GATEWAY (applied in the same Cursor run as Part A, committed alone) | e073a549dce676af074ed69e5633aa0ee7b4c2e4 |
| 2. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-high, resolved Grok 4.7 256K High, session 56e0f94c-5ff5-4a8c-8e9d-20e5dc71534a: the main run and one delta run for the review finding below | this commit |
| 3. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- PlanDefinition gains dailyTokenLimit; PLAN_DEFINITIONS sets free 100,000, starter 500,000, pro 1,000,000, team 2,000,000.
- TokenQuotaGuard: after the advisory lock, one read of users.role, user_entitlements (plan_override, daily_token_limit_override) and credit_balances.plan_id (owner_type user), comparing the caller id as text. Admins commit and pass. Limit = daily_token_limit_override, else the plan_override's limit when it names a known plan, else the balance plan's limit, else MAX_TOKENS_PER_24H. The rolling 24-hour sum, the lock, the 429 body (now with the resolved limit) and reset_at are unchanged.
- QuotaConfig.AGENT_RUN_TOKEN_ESTIMATE = 60,000 and estimatePreExecutionTokens: a body with harnessVersion is estimated at 60,000, others through estimateTokens (8,000 for a short prompt). Both guards use it.
- CreditBalanceGuard: non-admins need balance >= ceil(estimate / 1,000) (8 credits for a normal run, 60 for an Agent run); the 402 body keeps error_code credit_balance_exhausted and adds required_credits; a missing balance row is unchanged; admins still bypass.
- Specs for the plans, quota config, token guard and balance guard.

**Review finding fixed before LOCK:** the first version cast the caller id with $1::uuid. Identities from the static test keys have non-uuid ids and usage_records.user_id is varchar(50), so such a request would have failed with a 500. The delta compares users.id, user_entitlements.user_id and credit_balances.owner_id as text, with a test for a non-uuid id.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/quota src/billing src/credit-ledger` | 53 suites, 758 passed, 6 skipped |
| api-gateway `npm test` | 2704 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) |
| api-gateway `npm run build` | exit 0 |
| Diff review | only files in the admitted write scope changed |

Cursor's own gate runs hit out-of-memory Jest workers twice (unrelated suites did not start); both reruns passed, and the reviewer run above had no worker failure.

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-01D/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-ad.txt` | 6889 | `2d5366deb023020c3438e208fe8207f60a1bca9feccee78bcf7aeec847f9bee4` |
| `brief-ad-delta.txt` | 1577 | `7a9f839a27cc8e2224b21b0a5bed58aae911f96dc9dec09cb26c93cede49a4ad` |
| `cursor-result-1.json` | 3598 | `ab7e07c90bc9a7ca0941f93c99aad353b588fe2dcc67b3d0567af122221eb6f9` |
| `cursor-result-2.json` | 10926 | `eb667139ed2ba5f867abfb017cee9e7147d03ab819b9cc08dc40d3d5dc3e99c6` |
| `reviewer-npm-test.out` | 284 | `d8b0a3b04f0cdba01c79193725f8e5d2da33c121464078c4c7c497dc2efdf55c` |

## Acceptance criteria

All ten met by diff review and the reviewer run; queries are proven by mocks, not on a database. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed. Keith is admin on staging, so the token limit does not apply to him; the ACCESS-01F credit cap still does.
- The access read compares ids as text, so it does not use the users primary-key index; fine at staging size.
- A non-numeric limit override returns 500 after rollback; the admin route only stores integers 1 to 100,000,000.

## Review finding: static test API keys

services/api-gateway/src/auth/api-key-auth.guard.ts falls back to the fixed keys in api-key.config.ts whenever the database has no matching key, in every environment; test-harness-api-key grants harness access and internal status. Through Caddy a Bearer key cannot pass basic_auth, so today it matters only if port 4000 is reachable. Keith registered STATIC-KEYS-01 (NOT_READY) on 2026-11-05 and made ACCESS-LIVE-01 depend on it.

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered STATIC-KEYS-01)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY released UNOWNED.
