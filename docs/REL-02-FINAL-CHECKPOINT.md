# REL-02 FINAL CHECKPOINT — Deployment Rehearsal Wave

## Metadata

- Family: REL-02 — Deployment Rehearsal
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-02-FINAL-CHECKPOINT.md`

---

## Purpose

This checkpoint records the completion and lock of the REL-02 deployment-readiness wave. It consolidates all sub-task outcomes, the final deployment smoke result, and the validated deployment procedure into a single auditable record.

---

## Scope

The REL-02 wave covered:
- One bounded prod-style deployment rehearsal from the documented runbook
- Runbook reconciliation to align documentation with validated live-stack behavior
- Final deployment smoke using the corrected runbook

No new features were introduced. No architecture was changed. No product code was changed. All work was documentation/validation focused.

---

## Completed Task List

| Task | Title | Status |
|------|-------|--------|
| REL-02-01 | Deployment Rehearsal and Packaging | COMPLETE and LOCKED |
| REL-02-02 | Runbook Reconciliation After Deployment Rehearsal | COMPLETE and LOCKED |

---

## Grouped Summary

### Deployment Rehearsal (REL-02-01)

- Stack brought up via `docker compose -f docker-compose.prod.yml` in documented infra-first order.
- Migrations confirmed via containerized `npm run migration:run:prod` (no pending migrations).
- Bounded smoke passed: health/readiness, auth, session, project, chat, quota, public API execute/status.
- Clean shutdown and restart confirmed.
- Five concrete runbook mismatches found and documented (no product blockers).

### Runbook Reconciliation (REL-02-02)

Corrected five mismatches in `docs/REL-01-05-CHECKPOINT.md`:

| # | Area | Correction |
|---|------|-----------|
| 1 | Migration CLI prerequisites | Added preferred containerized run path (`docker compose run api-gateway npm run migration:run:prod` with `@postgres:5432`); retained local CLI as alternative with prerequisite note |
| 2 | Auth token field | `accessToken` → `access_token` |
| 3 | API key creation | Added required `scopes` array to request; response field `key` → `apiKey` |
| 4 | Public API auth header | `X-API-Key` → `Authorization: Bearer <apiKey>` |
| 5 | Execute payload | Added `conversationId` as required field alongside `sessionId` and `prompt` |

### Final Deployment Smoke (`docs/REL-02-FINAL-SMOKE-CHECKPOINT.md`)

All areas passed with the corrected runbook, zero mismatches:

| Area | Result |
|------|--------|
| Clean down/up sequence | PASS |
| Infrastructure (postgres, redis healthy) | PASS |
| Application services startup | PASS |
| `GET /api/health`, `/api/health/db`, `/api/health/ready` | PASS (200) |
| `GET /api/v1/docs` | PASS (200) |
| Auth register/login (`access_token`) | PASS |
| Session create, project create | PASS |
| Message/conversation retrieval | PASS |
| API key create (scopes + `.apiKey`) | PASS |
| `POST /api/v1/ai/execute` (Bearer + conversationId) | PASS (202) |
| `GET /api/v1/ai/executions/:id` (Bearer) | PASS (200) |
| Clean shutdown + restart health recovery | PASS |

---

## Validated Deployment / Startup Sequence

1. Verify Docker daemon responsive (`docker ps`).
2. Bring up infrastructure: `docker compose ... up -d postgres redis` — wait for healthy.
3. Bring up application: `docker compose ... up -d api-gateway ai-service container-manager frontend`.
4. Poll `GET /api/health` until `200`.
5. Confirm `GET /api/health/db` and `GET /api/health/ready` both `200`.
6. Run migrations if needed: `docker compose ... run --rm -e DATABASE_URL="postgresql://aisandbox:<pw>@postgres:5432/<db>" api-gateway npm run migration:run:prod`.

---

## Validated Auth / Project / Public-API Smoke Path

```text
POST /api/auth/register                     → 201
POST /api/auth/login                        → 201  (.access_token present)
POST /api/sessions                          → 201  (JWT Bearer auth)
POST /api/projects                          → 201
POST /api/sessions/:id/messages             → 201  (seeds conversationId)
GET  /api/sessions/:id/conversation         → 200  (captures conversationId)
POST /api/keys  { scopes:["ai:execute"] }   → 201  (.apiKey field)
POST /api/v1/ai/execute
     Authorization: Bearer <apiKey>
     { sessionId, conversationId, prompt }  → 202  (.executionId field)
GET  /api/v1/ai/executions/:id
     Authorization: Bearer <apiKey>         → 200
```

---

## Preserved Invariants

- No product/runtime code changed in REL-02.
- No architecture changed.
- No spec files edited.
- All product behavior validated and preserved as-is from REL-01.
- Container isolation, auth, quota, session lifecycle, public API separation unchanged.

---

## Scope Statement

All work in REL-02 was:
- Documentation and validation only.
- Bounded to deployment rehearsal, runbook alignment, and final smoke validation.
- No new feature task started in this consolidation step.
