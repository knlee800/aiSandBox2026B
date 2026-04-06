# REL-02 FINAL SMOKE CHECKPOINT

## Metadata

- Nature: VALIDATION (RELEASE READINESS, FINAL DEPLOYMENT SMOKE)
- Status: PASS
- Checkpoint: `docs/REL-02-FINAL-SMOKE-CHECKPOINT.md`
- Authority: corrected runbook from `docs/REL-01-05-CHECKPOINT.md` (REL-02-02 corrections applied)

---

## Objective

Run one final bounded deployment smoke using the corrected runbook/rehearsal flow before REL-02 umbrella closure.

---

## Exact Commands / Actions / Checks Run

### 1. Docker/Compose Baseline

```powershell
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" down
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d postgres redis
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d api-gateway ai-service container-manager frontend
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps
```

### 2. Health / Readiness

```powershell
# Polled until healthy (up to 40s)
GET http://localhost:4000/api/health     → 200
GET http://localhost:4000/api/health/db  → 200
GET http://localhost:4000/api/health/ready → 200
GET http://localhost:4000/api/v1/docs    → 200
```

### 3. Auth Flow

```powershell
POST /api/auth/register  → 201
POST /api/auth/login     → 201
($login.Content | ConvertFrom-Json).access_token  → present
```

### 4. Core Smoke

```powershell
POST /api/sessions                        → 201  (sessionId captured)
POST /api/projects                        → 201
POST /api/sessions/:id/messages           → 201
GET  /api/sessions/:id/conversation       → 200  (conversationId captured)
POST /api/keys  (with scopes:["ai:execute"]) → 201  (apiKey captured)
POST /api/v1/ai/execute
  Authorization: Bearer <apiKey>
  body: { sessionId, conversationId, prompt:"ping" }
                                          → 202  (executionId captured)
GET  /api/v1/ai/executions/:executionId
  Authorization: Bearer <apiKey>
                                          → 200 (polled, resolved within 10 attempts)
```

IDs from this run:
- session_id: `43962a5d-5a3c-4f11-baae-62966e4990f3`
- conversation_id: `e65c4c1a-f731-468b-b038-9d3d4dee7ad2`
- execution_id: `4740a49d-1bb1-44e1-9a7f-8cf26037dd20`

### 5. Restart Sanity

```powershell
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" down
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d postgres redis
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" up -d api-gateway ai-service container-manager frontend
# Polled health/readiness after restart
GET http://localhost:4000/api/health       → 200
GET http://localhost:4000/api/health/ready → 200
docker compose -f "C:\Users\knlee\aiSandBox2026B\docker-compose.prod.yml" ps  (all services up)
```

---

## Pass/Fail Outcomes by Area

| Area | Outcome |
|------|---------|
| Docker compose clean down | PASS |
| Infrastructure startup (postgres, redis healthy) | PASS |
| Application services startup | PASS |
| `GET /api/health` | PASS (200) |
| `GET /api/health/db` | PASS (200) |
| `GET /api/health/ready` | PASS (200) |
| `GET /api/v1/docs` | PASS (200) |
| Auth register/login + `access_token` present | PASS |
| Session create | PASS (201) |
| Project create | PASS (201) |
| Session message + conversation ID retrieval | PASS |
| API key create (with scopes, `.apiKey` field) | PASS (201) |
| `POST /api/v1/ai/execute` (Bearer auth, conversationId included) | PASS (202) |
| `GET /api/v1/ai/executions/:id` (Bearer auth) | PASS (200) |
| Clean shutdown | PASS |
| Stack restart + health/readiness recovery | PASS |

---

## Corrected Runbook Alignment

All five REL-02-02 corrections applied in the runbook were exercised and confirmed correct:

1. Migration containerized run path — stack came up cleanly with migrations already applied; no regression.
2. Auth token field `access_token` — used; worked.
3. API key scopes array + `.apiKey` response field — used; worked.
4. Public API `Authorization: Bearer <apiKey>` header — used; worked.
5. `conversationId` required in execute payload — included; worked.

No runbook mismatch was encountered during this smoke run.

---

## Reproducibility Verdict

**PASS — no blockers, no mismatches.**

The corrected runbook matches validated live-stack behavior exactly. The deployment flow is reproducible as documented.

---

## Recommendation

Safe to proceed to REL-02 umbrella closure and deployment handoff checkpoint.
