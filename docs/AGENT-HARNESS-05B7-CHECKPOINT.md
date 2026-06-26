# AGENT-HARNESS-05B7 — Checkpoint

**Task ID:** AGENT-HARNESS-05B7
**Title:** ai-service Provider/Model Execution Validation Against Production Compose
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Verdict:** PASS

---

## 1. Objective

Validate — without making source changes — that ai-service can execute an Agent Harness flow through the production compose stack using the implemented tool infrastructure. Confirm that the provider/model execution path (submit → queue → worker → provider adapter → external call → ledger → poll) reaches completion end-to-end.

---

## 2. Prerequisites and Environment State

- AGENT-HARNESS-05B6C COMPLETE and LOCKED: browser_smoke infrastructure validated through production compose.
- AGENT-HARNESS-05B6D COMPLETE and LOCKED: internal session start DB row fix applied.
- Production compose stack (`docker-compose.prod.yml`) was down at session start.
- Stack was started with:
  ```
  docker compose -f docker-compose.prod.yml up -d
  ```
- All 8 containers came up successfully.
- api-gateway health confirmed HTTP 200:
  ```json
  {"status":"ok","service":"api-gateway","version":"0.1.0"}
  ```

---

## 3. Auth Path Selected

Cookie-based session auth via `POST /api/auth/login` with test user `test@aisandbox.com`.

---

## 4. Initial Blockers Found

### 4a. Seed password hash mismatch
- Login initially failed: seed SQL hash for `test@aisandbox.com` did not match `password123`.
- Blocker surfaced before any execution attempt.

### 4b. Non-UUID userId from static API key
- First execution attempt used a static API key path that produced a non-UUID `userId`, which failed at the DB UUID column constraint (HTTP 500).

### 4c. Non-UUID sessionId request failure
- Corrected auth path used, but initial sessionId `"05b7-xai-test"` was not a valid UUID.
- Request failed HTTP 500 due to UUID column constraint on `sessionId`.

---

## 5. Approved DB Data Correction

Keith approved a targeted DB data correction to fix the seed password hash mismatch:

```sql
UPDATE users SET password_hash = <bcrypt-hash-of-password123> WHERE email = 'test@aisandbox.com';
```

- Correction applied to the running PostgreSQL container only.
- No source files, migration files, seed files, or schema files were modified.
- This was a one-time data fix to unblock runtime validation.

After correction, login succeeded with masked session token:
```
SESSION_TOKEN: hNhP0YYajF***
```

---

## 6. Final Successful xAI Execution Details

**Provider:** xai
**Model returned:** grok-4.3
**sessionId used:** `35d53116-6723-4571-af12-ac256977c007` (valid UUID)
**userId:** `38b2bb95-9126-498a-a29f-86c2d335bed6`

### Submit Request
```
POST /api/ai/execute
```
Response: HTTP 202
```json
{"executionId":"ccc85998-acb4-4611-84a7-d5727a0119e1","status":"queued"}
```

### Poll Response
```
GET /api/ai/execute/ccc85998-acb4-4611-84a7-d5727a0119e1
```
Response: HTTP 200
```json
{
  "executionId": "ccc85998-acb4-4611-84a7-d5727a0119e1",
  "status": "completed",
  "tokensUsed": 472,
  "output": "05B7 xAI validation passed",
  "model": "grok-4.3",
  "provider": "xai",
  "fileActions": []
}
```

### usage_records Confirmation
```
execution_status: completed
provider: xai
tokens_used: 472
user_id: 38b2bb95-9126-498a-a29f-86c2d335bed6
```

---

## 7. Queue Stats

Checked before and after execution:

| Metric     | Before | After |
|------------|--------|-------|
| waiting    | 0      | 0     |
| active     | 0      | 0     |
| completed  | 0      | 0     |
| failed     | 3      | 3     |
| workers    | 4      | 4     |

- `removeOnComplete: true` explains completed count staying at 0.
- No new failures introduced during validation.
- Pre-existing 3 failed jobs were not touched.

---

## 8. Validated Execution Path

```
POST /api/ai/execute
  → cookie auth with valid UUID user
  → guards passed
  → usage intent written
  → BullMQ enqueue
  → ai-service WorkerProcessor
  → AIExecutionService
  → XAIAdapter
  → external xAI call
  → ledger completed
  → polling endpoint returned completed result
```

---

## 9. Verdict

**PASS**

The full provider/model execution path was validated end-to-end against the production compose stack using the xAI provider and a valid UUID user/session. All submission, queue, worker, adapter, external call, ledger, and polling stages completed successfully.

---

## 10. Confirmations / Non-Goals

- xAI was used. No stub/openai/anthropic/groq/deepseek provider was used.
- No browser_smoke was executed.
- No workspace sessions or containers were created.
- No source files were changed.
- No `.env` changes were made.
- No Docker image rebuilds were performed.
- No frontend changes were made.
- No schema migrations were run.
- Temporary files created during validation were deleted:
  - `.05b7-token.tmp`
  - `.05b7-execid.tmp`
  - `.05b7-fix.sql`
- One approved DB data correction was applied to `test@aisandbox.com` password_hash.

---

## 11. Follow-Up Observations (Not Fixed Here)

The following issues were observed and are deferred for separate registered fix slices after Keith review:

1. **Seed password hash mismatch in source** — The seed SQL/seed script for `test@aisandbox.com` does not produce a hash that matches `password123`. This should be corrected in a separate fix slice targeting the seed file only.
2. **sessionId UUID validation** — ai-service or api-gateway does not validate that `sessionId` is a valid UUID before the ledger write. HTTP 500 is returned rather than HTTP 400. A separate fix slice should add input validation or clarify the field type contract.
3. **XAI adapter model mismatch** — xAI returned `grok-4.3` despite adapter default documentation referencing `grok-3`. The model name should be verified and documentation updated in a follow-up task.
4. **Agent Harness harnessVersion path not validated** — The `harnessVersion` field in Agent Harness requests was not exercised during this validation. A follow-up slice should confirm its behavior.

---

## 12. Locked Invariants

The following invariants are now locked as a result of this checkpoint:

- Production compose xAI execution path is validated: `POST /api/ai/execute` → BullMQ → WorkerProcessor → XAIAdapter → external call → ledger → poll.
- Cookie-based session auth is the correct auth path for production compose validation.
- `usage_records` ledger write confirms completion and token usage.
- No source changes are required for the core execution path.
- `removeOnComplete: true` is the correct BullMQ queue behavior; completed count of 0 is expected.

---

## 13. Next Recommended Task

Register a follow-up fix slice for:
- Seed password hash mismatch correction in source (seed SQL / seed script), after Keith review.
- Optionally: sessionId UUID input validation before ledger write, after Keith review.

These are independent and can be registered as separate bounded fix slices.
