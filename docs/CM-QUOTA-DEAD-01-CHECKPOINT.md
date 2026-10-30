# CM-QUOTA-DEAD-01 — Checkpoint

**Task:** CM-QUOTA-DEAD-01 — Remove the dead container-manager Task 9.5A request-time quota check
**Status:** COMPLETE AND LOCKED — 2026-10-30
**Workstream:** RELIABILITY. **Lifecycle:** 2-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** the read-only investigation of 2026-10-30 (session "Investigate container-manager quota check failing open"), from the CLEAN-BASELINE-DEPLOY-01 C2 follow-up candidate: on ainow-staging-01 every workspace exec logged no such table and failed open.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration and admission | registered on Keith's approval, then admitted to Lane 1 with CONTAINER-MANAGER | ce4ef074254d9f81814eb925df4824c35c433746, 955615a8db80f9c1d022987f8fa5a98f1c040c07 |
| 1. Implementation | Cursor CLI (cursor-delegate), grok-4.7-high, session 41b96dd9-7f5c-4a05-b2c4-f803eefa70cb, one run | 2c1eb7b558a4c2f9cfdb33ae9033b6d8102bdc78 |
| 2. Consolidation and LOCK | this checkpoint, the result line, LANE-DONE and COMPLETE AND LOCKED, canonical validator | this record |

## Why it was dead

checkAndEnforceQuota read the container-manager SQLite tables users and token_usage. Those exist only in database/schema-sqlite.sql (loaded by the dev script database/test-sqlite.js); container-manager creates only sessions, governance_events and checkpoints, and nothing writes token_usage to SQLite. On a deployed host every call logged no such table and failed open. Users and AI usage live in the gateway PostgreSQL, where CreditBalanceGuard, QuotaGuard, TokenQuotaGuard, RateLimitGuard and SessionQuotaGuard enforce the real limits. Had the tables existed, every user would have fallen back to the FREE plan and platform-imposed terminations would have counted toward its 20-per-month limit.

## What changed

| File | Change |
|---|---|
| `services/container-manager/src/sessions/sessions.service.ts` | removed checkAndEnforceQuota, the checkQuota wrapper, the seven call sites with their comments, the QuotaEvaluationService import and constructor parameter, and the Task 9.5A JSDoc lines; the exec doc keeps the concurrent-exec 429 |
| `services/container-manager/src/previews/preview.service.ts` | removed the preview-start quota call and its JSDoc lines |
| `services/container-manager/src/sessions/sessions.service.spec.ts` | removed the quota mock from the four constructions; added a test that exec returns the container result with no quota service |

20 lines added, 126 removed. The termination (410), max-lifetime, idle-timeout and concurrent-exec (429) checks are unchanged and in the same order. Not changed: QuotaEvaluationService, UsageAggregationService, PlanQuotaConfig, the internal quota, usage and billing-export controllers, sessions.module.ts (still imports UsageModule), the gateway admin quota-visibility and billing reconciliation that read the same SQLite data, and the schema.

## Validation (reviewer, Node v22.14.0)

| Gate | Result | Baseline |
|---|---|---|
| container-manager `npm test` | 9 suites, 193/193 | 192/192 |
| container-manager `npm run build` | exit 0 | |
| search for checkAndEnforceQuota, checkQuota, Task 9.5A in container-manager source | 0 matches | |

Evidence copied to `C:\Users\knlee\aisb-preflight\CM-QUOTA-DEAD-01\`:

| File | Bytes | SHA-256 |
|---|---|---|
| `reviewer-cm-test.txt` | 20816 | `8cb402dbfa9c2fe996a48e1e9f9635bde44e17f69c4f55c80d9a21fe11f78a25` |
| `reviewer-cm-build.txt` | 51 | `d8cf8ea1c2c14197f5ab98901700b49b16d0ee0d9d4f61e16fdbe3dbdc1b8d33` |
| `reviewer-cm-test-baseline.txt` | 20816 | `f573755daa5d04684effd9a5cf556d9b0ab5de18238f95057bee76e43ce465da` |
| `cursor-brief.txt` | 4898 | `662c8c42aee11cc7ade963d0495cc11fa77ff4e58f67dc1566217dbc0b22fe30` |

## Acceptance criteria

| Criterion | Result |
|---|---|
| No checkAndEnforceQuota, checkQuota or [Task 9.5A] remains in container-manager source | met (0 matches) |
| Workspace operations and preview start still enforce termination, max lifetime, idle timeout and the concurrent-exec limit | met (diff review: those checks untouched; existing tests pass) |
| The spec no longer mocks hasUserExceededQuota and a new test shows exec succeeds without quota evaluation | met |
| container-manager npm test and npm run build pass on Node v22.14.0 | met (193/193) |
| Only the write-scope files change | met (three files) |
| Not LOCKED by an implementer | met (locked by the control plane) |
| After the next authorized deploy, no no such table lines in the container-manager log | open (deploy-time evidence, not a lock gate) |

## Open items

- Not deployed: ainow-staging-01 runs 7317749 until a separately authorized deploy; then check the container-manager log for no such table lines.
- Possible follow-up, not registered: the gateway admin quota-visibility and billing reconciliation and the container-manager internal quota, usage and billing-export controllers read the same SQLite data.

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-10-30 by the control plane. Lane 1 released EMPTY; CONTAINER-MANAGER released UNOWNED; GOVERNANCE UNOWNED.
