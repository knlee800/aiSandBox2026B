# REL-02-02 CHECKPOINT - Runbook Reconciliation After Deployment Rehearsal

## Task Metadata

- Task ID: REL-02-02
- Title: Runbook Reconciliation After Deployment Rehearsal
- Nature: DOCUMENTATION (RELEASE READINESS, RUNBOOK ALIGNMENT)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/REL-02-02-CHECKPOINT.md`

## Objective

Reconcile the operational runbook (`docs/REL-01-05-CHECKPOINT.md`) with the concrete mismatches discovered during REL-02-01 so the documented deployment procedure matches validated reality.

## Source of Truth

- `docs/REL-02-01-CHECKPOINT.md` — exact validated rehearsal commands and outcomes

## Exact File Updated

- `C:\Users\knlee\aiSandBox2026B\docs\REL-01-05-CHECKPOINT.md` — Section 4 (Migration), Section 5 (Health/Smoke Checks → Auth, Public API Smoke)

## Exact Corrections Made

### 1. Migration CLI prerequisites (Section 4 — Run Migrations)

**Before:** Single `npx typeorm` CLI path using `localhost:5432` with placeholder `DATABASE_URL`.

**After:** Two-path documentation:
- **Preferred:** containerized run via `docker compose ... run api-gateway npm run migration:run:prod` using `@postgres:5432` (internal compose network — validated).
- **Alternative:** local CLI path retained but clearly noted as requiring PostgreSQL port-forwarded or running directly on host.

**Reason:** Localhost `5432` is not reachable from the host when PostgreSQL runs inside compose; containerized path was the only successful path during rehearsal.

---

### 2. Auth token response field name (Section 5 — Auth / Session Gate)

**Before:** `$token = ($login.Content | ConvertFrom-Json).accessToken`

**After:** `$token = ($login.Content | ConvertFrom-Json).access_token   # field is access_token (not accessToken)`

**Reason:** Actual API response contains `access_token`, not `accessToken`.

---

### 3. API key creation payload and response field (Section 5 — Public API Smoke)

**Before:**
```powershell
$keyResp = Invoke-WebRequest ... -Body '{"name":"smoke"}'
$apiKey  = ($keyResp.Content | ConvertFrom-Json).key
```

**After:**
```powershell
$keyResp = Invoke-WebRequest ... -Body '{"name":"smoke","scopes":["ai:execute"]}'
$apiKey  = ($keyResp.Content | ConvertFrom-Json).apiKey
```

**Reason:** `POST /api/keys` requires a non-empty `scopes` array; response field is `apiKey` not `key`.

---

### 4. Public API authentication header (Section 5 — Public API Smoke)

**Before:** `Headers @{ "X-API-Key" = $apiKey }`

**After:** `Headers @{ Authorization = "Bearer $apiKey" }`

**Reason:** `X-API-Key` returned `401`; `Authorization: Bearer <apiKey>` is the accepted header.

---

### 5. Public execute payload requires conversationId (Section 5 — Public API Smoke)

**Before:**
```powershell
$execBody = '{"sessionId":"...","prompt":"ping"}'
```

**After:**
```powershell
# Retrieve conversationId first
$conv           = Invoke-WebRequest -Uri "$base/api/sessions/$sessionId/conversation" ...
$conversationId = ($conv.Content | ConvertFrom-Json).id

# Include conversationId in execute payload
$execBody = '{"sessionId":"...","conversationId":"...","prompt":"ping"}'
```

**Reason:** `POST /api/v1/ai/execute` returns `400` with `conversationId is required` when omitted.

---

## Runtime Behavior

No product code was changed. All corrections are documentation-only. Runtime behavior is identical to what was validated in REL-02-01.

## Confirmation

The operational runbook (`docs/REL-01-05-CHECKPOINT.md`) now reflects the exact validated deployment rehearsal behavior from REL-02-01. A fresh operator following the corrected runbook will encounter commands and payloads that match the live stack.
