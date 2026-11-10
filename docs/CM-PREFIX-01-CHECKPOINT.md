# CM-PREFIX-01 — Checkpoint

**Task:** CM-PREFIX-01 — Container-manager internal routes served at /api/api/internal
**Status:** COMPLETE AND LOCKED — 2026-11-10.
**Workstream:** RELIABILITY. **Lifecycle:** 3-STEP. **Evidence class:** LOCAL-TESTS. **saturationClass:** OPTIONAL.
**Source:** registered by the CM-AUTH-01 LOCK (7615c7b, finding F2). Admitted 2026-11-10 (689535c) under Keith's instruction to keep starting the next tasks.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 2 with CONTAINER-MANAGER | 689535c |
| 2. Implementation | sonnet subagent (Sonnet 5.5: a route-prefix fix in one service, no auth, contract or schema change) in worktree lane/CM-PREFIX-01 (99abf01), cherry-picked onto main | ec1d8f3 |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Change

Four controllers declared `api/internal/...` under the global prefix `api`, so they served at `/api/api/internal/...`. The gateway calls `/api/internal/...` and got 404, so the admin ops summary's quota data and the billing export did not work. Each `@Controller` path drops its leading `api/`. No handler or guard changed: the class-level `@UseGuards(InternalServiceAuthGuard)` and CM-AUTH-01's global guard stay.

| Controller | Was | Now | Gateway caller |
|---|---|---|---|
| billing-export | /api/api/internal/billing-export | /api/internal/billing-export | services/api-gateway/src/clients/container-manager-http.client.ts:272 |
| quota-visibility | /api/api/internal/quota-visibility | /api/internal/quota-visibility | services/api-gateway/src/admin/admin.service.ts:77 |
| quota-evaluations | /api/api/internal/quota-evaluations | /api/internal/quota-evaluations | none |
| usage-aggregations | /api/api/internal/usage-aggregations | /api/internal/usage-aggregations | none |

No collision: internal/stats, internal/sessions, internal/git and internal/checkpoint-history are different prefixes.

Files (all in services/container-manager/src/): billing/billing-export.controller.ts, usage/internal-quota-evaluation.controller.ts, usage/internal-quota-visibility.controller.ts, usage/internal-usage-aggregation.controller.ts, __tests__/internal-key.http.spec.ts.

## Tests

`internal-key.http.spec.ts`:
- The route inventory lists the 19 corrected paths. It still asserts 63 guarded routes, with only `GET /api/health` open.
- The two F2 tests, which asserted the old behaviour, are replaced:
  - 10 paths under `/api/internal/...` (the two real gateway callers and eight more on the same controllers) each return 403 without the key, and reach a real handler with it (not 403, not route-not-found).
  - The same 10 paths under `/api/api/internal/...` now return 404 with the key.

## Gates (control-plane rerun on the branch)

| Gate | Result |
|---|---|
| container-manager `npm test` | 15 suites, 481 passed, 0 failed (baseline 481) |
| container-manager `npm run build` | clean |

The gateway and ai-service suites were not rerun: neither changed, and no ai-service test reads container-manager source. The cherry-picked files are LF.

## Limits

Not deployed. Staging still serves the old paths until the next deploy. STAGING-DEPLOY-WF-01 deploys main, so it carries this fix. Its host checks must use the new paths: STAGING-DEPLOY-CMAUTH-01 checked `/api/api/internal/billing-export/limits`, which now answers 404.

CHECKLIST: EVERY 11/11, BACKEND 6/6 (5: n/a, no entity or schema change; 6: 481 passed against a baseline of 481, no new failure)
FOLLOWUPS: 0 registered / 2 superseded / 0 dropped / 0 undisposed. (1) quota-evaluations and usage-aggregations have no gateway caller: superseded by CM-CLEANUP-01, whose scope now names them, to keep or remove. (2) Host checks that expect the old `/api/api/internal/...` paths: superseded by an acceptance line in STAGING-DEPLOY-WF-01. The worker's other notes were observations, not work: an untouched spec matched its grep, and `python3` on this machine is a Store stub.

## Lock

COMPLETE AND LOCKED on 2026-11-10 by the control plane. Lane 2 is released EMPTY, and CONTAINER-MANAGER is released UNOWNED.
