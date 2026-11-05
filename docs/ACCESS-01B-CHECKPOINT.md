# ACCESS-01B — Checkpoint

**Task:** ACCESS-01B — Per-user entitlements table replacing the env allowlist
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Workstream:** COMMERCIAL. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL. **productClass:** CURRENT.
**Source:** slice S2 of docs/ACCESS-READY-01-PLAN.md. Keith approved the scope and admitted it on 2026-11-05, and approved the stage-start with his three decisions.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Registration and admission | registered by GOV-ACCESS-PLAN-01; admitted to Lane 1 with GATEWAY, MIGRATION and ENV | 1604ace (registration); 13f14aec36e5d9486d6cd4ec658faddfbd9392ad (admission) |
| 2. Stage-start | docs/ACCESS-01B-STAGE-START.md: Fable 5.1 draft (requested claude-fable-5-1-thinking-high, resolved Claude Fable 5.1 300K High, read-only), control-plane review, Keith's decisions | b43366aec03147b5cf6071c33de9555d27adba4a |
| 3. Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh (migration and auth), resolved Grok 4.7 256K Extra High, session b54e9efb-258e-4eb7-a080-92e8319ac656, one run | this commit |
| 4. LOCK | this checkpoint, board, backlog and sidecar, canonical validator | this commit (LOCAL-TESTS) |

## What changed

- Table user_entitlements (migration 1801000000000-CreateUserEntitlementsTable with a mocked spec; entity UserEntitlementEntity): user_id primary key referencing users with cascade delete, harness_enabled and agent_write_enabled (default false), plan_override, daily_token_limit_override (positive or null), updated_by, updated_at. down drops the table.
- services/api-gateway/src/auth/entitlement.service.ts: resolveHarnessEntitled reads harness_enabled by primary key; no row, a false row or a read error is false (fail closed, warn with the user ID only). setEntitlements upserts the row and inserts one audit_events row (category entitlement, event_type entitlement.updated, subject the target user, user_id the acting admin, payload with reason, before, after and changedFields) in one transaction; an audit failure rolls the change back.
- session-or-api-key.guard.ts and /api/auth/me read the service. isBrowserSessionHarnessEntitled and every read of AGENT_HARNESS_BROWSER_SESSION_USER_IDS are removed (Keith's decision 1); the line is deleted from ops/clean-baseline/env/gateway.env.template. API keys and the three routes that read harnessEntitled are unchanged.
- PATCH /api/admin/users/:userId/entitlements on admin-operational.controller.ts: SessionCookieGuard and AdminRoleGuard (class) plus CsrfGuard, ParseUUIDPipe, DTO validation (booleans, plan id from PLAN_DEFINITIONS or null, limit 1 to 100,000,000 or null, reason 1 to 500, at least one field), 404 for an unknown user, response { userId, before, after, auditEventId }. An admin may change their own row (decision 2).
- AuthModule registers both entities and provides and exports EntitlementService. Auth and admin specs updated; the env-list parsing tests are replaced by table cases and one test that a non-empty env value grants nothing.

## Validation (reviewer, Node v22.14.0)

| Gate | Result |
|---|---|
| `npx jest src/auth src/admin src/migrations` | 32 suites, 293 passed, 1 skipped |
| api-gateway `npm test` | 2679 passed, 7 skipped, 14 failed; the only failing suite is smoke.integration (runtime-only baseline) |
| api-gateway `npm run build` | exit 0 |
| Diff review | production code matches the stage-start and Keith's decisions; only files in the admitted write scope changed (entitlements/ and app.module.ts not used) |

Cursor's npm test reported 2673 passed because one unrelated suite (ai-execution.get-execution-file-actions, 6 tests) lost its Jest worker; it passed alone and in the reviewer run.

Evidence in `C:/Users/knlee/aisb-preflight/ACCESS-01B/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-ab-stage.txt` | 4571 | `8c4d19452fbc2f0caf47ee58608e98e4224258357c9377d5efcac3e0a54db4a2` |
| `brief-ab.txt` | 4135 | `9ad145b13c598f64c2ac6f1d9155f12da2ec85e784999d5953ae65e01889941d` |
| `cursor-result.json` | 10054 | `06f00bf019527f7a8e5b742ac12f584fd629352d9f8bc26dd50cff2e5ee5aa69` |
| `fable-result.json` | 19104 | `42b4c62f2f5165e03764d9631107e01a39642d51bb1387beaaf56eee28e272b0` |
| `fable-stage-draft.md` | 17626 | `b3494313a07d53f541305ead798d84d42bc88ff7f2072258eb46e6eb9f332a2f` |
| `reviewer-npm-test.out` | 284 | `07e5db9ebb59b03a4b306d13cb87d114dccd52b498ec3841ff7bec22d6f011df` |

## Acceptance criteria

All eight met by diff review and the reviewer run; the migration is proven by its mocked spec, not on a database. Not LOCKED by an implementer: locked by the control plane.

## Limits

- Not deployed. The next staging deploy runs the migration; then a host step Keith approves sets his users.role to admin (staging has one user, role user), and Keith sets his own row with the PATCH from the browser. Until then nobody on staging is entitled, the same as today's baseline.
- Staging's /etc/aisandbox/gateway.env still holds the empty allowlist line; the gateway no longer reads it.
- One primary-key read per browser-session request on the gated routes and /me; no cache, so a revocation is immediate.

FOLLOWUPS: 1 registered / 3 superseded / 1 dropped / 0 undisposed (registered ADMIN-CSRF-01, NOT_READY; superseded: the env-retire task by this task's decision 1 and criterion 2, /me exposing the other columns by ACCESS-01C and ACCESS-01D, an entitlements/ module by ACCESS-01I; dropped by Keith: an admin GET of entitlements)

## Lock

LANE-DONE and COMPLETE AND LOCKED on 2026-11-05 by the control plane. Lane 1 released EMPTY; GATEWAY, MIGRATION and ENV released UNOWNED.
