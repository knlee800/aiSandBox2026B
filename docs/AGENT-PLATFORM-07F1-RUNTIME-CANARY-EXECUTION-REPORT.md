# AGENT-PLATFORM-07F1 — Runtime Canary Execution Report

**Task:** AGENT-PLATFORM-07F1 Step 3 — Queue Transport + Metadata Preservation Runtime Canary
**Status:** Step 3 COMPLETE — PASS
**Date:** 2026-07-10
**Nature:** Live runtime canary execution — BullMQ queue transport + metadata preservation verification
**Author:** AI-assisted runtime execution

---

## 1. Task Identity

| Field | Value |
|-------|-------|
| Task ID | AGENT-PLATFORM-07F1 |
| Step | 3 — Runtime Canary Execution |
| Canary type | Live queue transport + metadata preservation |
| Result | **PASS** |
| Date | 2026-07-10 |
| Keith approval | Explicitly authorized Step 3 runtime canary execution |

---

## 2. Files Created/Changed

| # | File | Action |
|---|------|--------|
| 1 | `services/ai-service/scripts/canary-07f1-submit-job.ts` | CREATED — canary job submission script |
| 2 | `docs/AGENT-PLATFORM-07F1-RUNTIME-CANARY-EXECUTION-REPORT.md` | CREATED — this execution report |

No production source files changed. No `.env` files modified. No package files modified. No governance files modified.

---

## 3. Runtime Topology

| Component | Required? | Status | Port |
|-----------|-----------|--------|------|
| Docker Desktop | YES | Running — Server Version 29.2.1 | — |
| PostgreSQL (`aisandbox-postgres`) | YES | Healthy — postgres:15-alpine | 5432 (published) |
| Redis (`aisandbox-redis`) | YES | Healthy — redis:7-alpine | 6379 (published) |
| AI Service Worker | YES | Started — PID 31892 on port 4001 | 4001 |
| API Gateway | **NO** | Not started | — |
| container-manager | **NO** | Not started | — |
| Docker workspace container | **NO** | Not started | — |
| Frontend/browser | **NO** | Not started | — |

---

## 4. Process-Scoped Env Values

All overrides applied via PowerShell `$env:` — no `.env` files modified.

| Variable | Value | Purpose |
|----------|-------|---------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` | Prevents harness branch; ensures plain execution path |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` | No write tool registration |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` | No validation tool registration |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` | No browser smoke tool registration |
| `REDIS_URL` | `redis://:***@localhost:6379` | Process-scoped localhost override (root `.env` uses Docker-internal hostname) |
| `DATABASE_URL` | `postgres://***:***@localhost:5432/aisandbox` | Process-scoped localhost override (root `.env` uses Docker-internal hostname) |

---

## 5. Preflight Results

| # | Check | Result |
|---|-------|--------|
| PREFLIGHT-1 | Docker Desktop running | PASS — Server Version 29.2.1 |
| PREFLIGHT-2 | PostgreSQL container healthy | PASS — Up, healthy |
| PREFLIGHT-3 | Redis container healthy | PASS — Up, healthy |
| PREFLIGHT-6 | PostgreSQL accepts connections | PASS — `pg_isready` accepting connections |
| PREFLIGHT-7 | `usage_records` schema verified | PASS — `execution_id` (uuid), `execution_status` (varchar), `metadata` (jsonb), `tokens_used` (integer), `provider` (varchar), `model` (varchar) |
| PREFLIGHT-8 | BullMQ queue empty | PASS — wait=0, active=0, failed=3 (pre-existing stale failures from 2026-04-24, unrelated) |
| PREFLIGHT-9 | No pre-existing canary rows | PASS — 0 rows with `metadata->>'canary' = 'AGENT-PLATFORM-07F1'` |

### 5.1 Preflight Finding: `execution_id` Column Type

The `execution_id` column is `uuid` type (not `varchar`). The readiness doc's planned `canary-07f1-<uuid>` prefix format is incompatible with the UUID column type. Adapted: canary uses plain `randomUUID()` for `execution_id` and identifies canary rows via `metadata->>'canary' = 'AGENT-PLATFORM-07F1'` marker.

### 5.2 Preflight Finding: Port Publishing

The `aisandbox-postgres` container initially had no port published to Windows (port 5432 not mapped). This was resolved by Keith recreating the container with `docker compose up -d postgres`. Redis port 6379 was correctly published throughout.

### 5.3 Preflight Finding: Process-Scoped Database/Redis URLs

The root `.env` uses Docker-internal hostnames (`@postgres:5432`, `@redis:6379`). The AI Service Worker running on the Windows host requires localhost URLs. Both `DATABASE_URL` and `REDIS_URL` were set as process-scoped overrides via PowerShell `$env:` — no `.env` files were modified.

---

## 6. Queue Safety Results

### 6.1 Pre-Run Queue Inspection

| Queue Key | Count | Status |
|-----------|-------|--------|
| `bull:ai-execution:wait` | 0 | PASS |
| `bull:ai-execution:active` | 0 | PASS |
| `bull:ai-execution:failed` | 3 | Pre-existing (job IDs 118, 119, 134 — stale failures from 2026-04-24, `deepseek` provider, unrelated to 07F1) |

### 6.2 Post-Run Queue Inspection

| Queue Key | Count | Status |
|-----------|-------|--------|
| `bull:ai-execution:wait` | 0 | PASS |
| `bull:ai-execution:active` | 0 | PASS |
| `bull:ai-execution:failed` | 3 | Same pre-existing entries — canary job auto-removed on completion |

---

## 7. Canary Job Payload

```json
{
  "executionId": "8da5403a-f20e-480e-b7d8-196b18f7faef",
  "userId": "canary-07f1-user",
  "apiKeyId": "canary-07f1-apikey",
  "sessionId": "00000000-07f1-4000-a000-000c07f10001",
  "conversationId": "00000000-07f1-4000-a000-000c07f10002",
  "provider": "stub",
  "adapter": "stub",
  "prompt": "Canary 07F1: metadata preservation test. Return immediately.",
  "model": "stub",
  "submittedAt": "2026-07-10T10:35:38.952Z",
  "agentRole": "builder",
  "builderProfileId": "builder-canary-07f1",
  "collaborationRunId": "collab_canary-07f1-run",
  "referralTraceId": "trace_canary-07f1-trace",
  "parentReferralTraceId": "trace_canary-07f1-parent",
  "referringBuilderProfileId": "builder-canary-07f1-source",
  "orchestrationPriority": 5,
  "referralId": "ref_canary-07f1-referral",
  "isReferralExecution": true
}
```

- BullMQ queue: `ai-execution`
- BullMQ job name: `execute-ai`
- BullMQ job ID: `328`
- BullMQ options: `attempts: 1, removeOnComplete: true, removeOnFail: false`
- No `harnessVersion` — plain execution path

---

## 8. BullMQ Submission Result

| Field | Value |
|-------|-------|
| Script | `services/ai-service/scripts/canary-07f1-submit-job.ts` |
| Intent row inserted | `execution_id=8da5403a-f20e-480e-b7d8-196b18f7faef, status=pending` |
| BullMQ job submitted | `jobId=328` |
| Exit code | 0 |

---

## 9. Worker Processing Result

| Event | Detail | Result |
|-------|--------|--------|
| Job received | `Worker received job 328 executionId=8da5403a-f20e-480e-b7d8-196b18f7faef workerId=31892` | PASS |
| Job claimed | `Worker claimed executionId=8da5403a-f20e-480e-b7d8-196b18f7faef workerId=31892` | PASS |
| Route evaluated | `harnessVersion: null, enableToolLoop: false, selectedPath: "plain"` | PASS — plain path, no harness |
| Execution entry | `adapter: "stub", provider: "stub", model: "stub"` | PASS — stub only |
| StubAIAdapter | `StubAIAdapter.execute() called` | PASS — zero external calls |
| Execution exit | `tokensUsed: 0, durationMs: 1, outcome: "success"` | PASS — zero tokens |
| Execution completed | `tokens: 0, execution_status: "completed", duration_ms: 18` | PASS |
| Ledger finalized | `Ledger finalized executionId=8da5403a-f20e-480e-b7d8-196b18f7faef` | PASS |
| Queue event | `QueueEvent: job completed jobId=328` | PASS |

---

## 10. usage_records Verification

### 10.1 Core Fields

| Field | Expected | Actual | Result |
|-------|----------|--------|--------|
| `execution_id` | `8da5403a-f20e-480e-b7d8-196b18f7faef` | `8da5403a-f20e-480e-b7d8-196b18f7faef` | PASS |
| `execution_status` | `completed` | `completed` | PASS |
| `tokens_used` | `0` | `0` | PASS |

### 10.2 Metadata JSONB — 9 Orchestration Fields

| # | Field | Expected | Actual | Result |
|---|-------|----------|--------|--------|
| 1 | `metadata.agentRole` | `builder` | `builder` | PASS |
| 2 | `metadata.builderProfileId` | `builder-canary-07f1` | `builder-canary-07f1` | PASS |
| 3 | `metadata.collaborationRunId` | `collab_canary-07f1-run` | `collab_canary-07f1-run` | PASS |
| 4 | `metadata.referralTraceId` | `trace_canary-07f1-trace` | `trace_canary-07f1-trace` | PASS |
| 5 | `metadata.parentReferralTraceId` | `trace_canary-07f1-parent` | `trace_canary-07f1-parent` | PASS |
| 6 | `metadata.referringBuilderProfileId` | `builder-canary-07f1-source` | `builder-canary-07f1-source` | PASS |
| 7 | `metadata.orchestrationPriority` | `5` | `5` | PASS |
| 8 | `metadata.referralId` | `ref_canary-07f1-referral` | `ref_canary-07f1-referral` | PASS |
| 9 | `metadata.isReferralExecution` | `true` | `true` | PASS |

**All 9 orchestration fields survived BullMQ queue transport and were persisted into `usage_records.metadata` JSONB by the worker.**

---

## 11. Cleanup Result

| # | Step | Result |
|---|------|--------|
| 1 | Pre-cleanup count check | 1 row (expected) |
| 2 | `DELETE FROM usage_records WHERE execution_id = '8da5403a-f20e-480e-b7d8-196b18f7faef'` | DELETE 1 |
| 3 | Post-cleanup verification | 0 rows (confirmed clean) |
| 4 | AI Service Worker stopped | Stopped (PID 3696 / child PID 31892) |

---

## 12. Safety Confirmations

### 12.1 Provider/API Safety

| Check | Result |
|-------|--------|
| Provider in job payload | `stub` — PASS |
| Provider in worker log | `stub` — PASS |
| Adapter in worker log | `stub` — PASS |
| StubAIAdapter called | Yes — zero external HTTP calls — PASS |
| Tokens used | 0 — PASS |
| No non-stub provider detected | PASS |
| No API key referenced | PASS |

### 12.2 Write-Tool Safety

| Check | Result |
|-------|--------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `false` (process-scoped) — PASS |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` (process-scoped) — PASS |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` (process-scoped) — PASS |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` (process-scoped) — PASS |
| Harness route selected | `plain` — no tool dispatch — PASS |
| `write_file` dispatched | No — PASS |
| `delete_file` dispatched | No — PASS |
| `run_validation` dispatched | No — PASS |
| `browser_smoke` dispatched | No — PASS |

### 12.3 AGENT-HARNESS Write Canary Separation

| Check | Result |
|-------|--------|
| AGENT-HARNESS write canary involved | No — PASS |
| Write tool dispatch in worker logs | None — PASS |
| Harness tool loop activation | Blocked by `enableToolLoop: false` — PASS |

### 12.4 Environment Safety

| Check | Result |
|-------|--------|
| `.env` files modified | No — `git diff --name-only -- "*.env*"` returned empty — PASS |
| Production source changes | No — `git diff --stat -- services/` returned empty — PASS |
| All env overrides process-scoped | Yes — PowerShell `$env:` only — PASS |

### 12.5 Service Boundary Safety

| Check | Result |
|-------|--------|
| API Gateway started | No — PASS |
| container-manager started | No — PASS |
| Frontend/browser started | No — PASS |
| Docker workspace container used | No — PASS |

---

## 13. Full PASS/FAIL Criteria Verification

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Docker/PostgreSQL/Redis healthy | PASS |
| 2 | BullMQ queue initially empty (wait/active) | PASS |
| 3 | AI Service Worker starts | PASS — `Worker connected to ai-execution queue` |
| 4 | Canary intent row inserted | PASS — `status=pending` |
| 5 | BullMQ job submitted | PASS — `jobId=328` |
| 6 | Worker processes job | PASS — received + claimed |
| 7 | Worker completes execution | PASS — `execution_status: 'completed'`, `duration_ms: 18` |
| 8 | `execution_status = 'completed'` | PASS |
| 9 | `tokens_used = 0` | PASS |
| 10 | `metadata.agentRole` = `'builder'` | PASS |
| 11 | `metadata.builderProfileId` = `'builder-canary-07f1'` | PASS |
| 12 | `metadata.collaborationRunId` = `'collab_canary-07f1-run'` | PASS |
| 13 | `metadata.referralTraceId` = `'trace_canary-07f1-trace'` | PASS |
| 14 | `metadata.parentReferralTraceId` = `'trace_canary-07f1-parent'` | PASS |
| 15 | `metadata.referringBuilderProfileId` = `'builder-canary-07f1-source'` | PASS |
| 16 | `metadata.orchestrationPriority` = `5` | PASS |
| 17 | `metadata.referralId` = `'ref_canary-07f1-referral'` | PASS |
| 18 | `metadata.isReferralExecution` = `true` | PASS |
| 19 | Provider = `stub` | PASS |
| 20 | No `.env` changes | PASS |
| 21 | No production source changes | PASS |
| 22 | Cleanup successful | PASS — DELETE 1, verified 0 remaining |
| 23 | Queue clean after canary (wait/active) | PASS — 0/0 |
| 24 | No AGENT-HARNESS write canary | PASS |
| 25 | Execution path = plain | PASS — `selectedPath: 'plain'` |
| 26 | No API Gateway/container-manager/browser | PASS |

---

## 14. Conclusion

### **AGENT-PLATFORM-07F1 Step 3: PASS**

One orchestration-enriched BullMQ `ai-execution` job was submitted directly to the queue by the canary script, processed by the AI Service Worker using the `stub` provider (plain execution path, zero tokens, zero external API calls), and all 9 orchestration metadata fields were verified in `usage_records.metadata` JSONB:

1. `agentRole` — survived transport
2. `builderProfileId` — survived transport
3. `collaborationRunId` — survived transport
4. `referralTraceId` — survived transport
5. `parentReferralTraceId` — survived transport
6. `referringBuilderProfileId` — survived transport
7. `orchestrationPriority` (numeric) — survived transport
8. `referralId` — survived transport
9. `isReferralExecution` (boolean) — survived transport

The canary row was cleaned up. No production source, `.env`, package, governance, frontend, database, or migration files were changed. No API Gateway, container-manager, browser, provider/API, or AGENT-HARNESS write canary involvement.

### 14.1 Ready for Step 4 Consolidation?

**YES.** AGENT-PLATFORM-07F1 is ready for Step 4 consolidation in a separate window. Step 4 should:
- Mark AGENT-PLATFORM-07F1 as COMPLETE and LOCKED in `TASKS.md` and `TASKS_BACKLOG_FULL.md`
- Create `docs/AGENT-PLATFORM-07F1-CHECKPOINT.md`
- Update `docs/AINOW-EXECUTION-ROADMAP.md`
- No production source changes

### 14.2 Preflight Findings for Future Reference

1. **`execution_id` is UUID type** — canary scripts that need identifiable prefixes must use metadata markers instead of execution_id prefixes
2. **Root `.env` uses Docker-internal hostnames** — AI Service Worker running on Windows host requires process-scoped `REDIS_URL` and `DATABASE_URL` overrides with `localhost`
3. **PostgreSQL port publishing** — containers started independently (not via docker-compose) may lack port mappings; verify with `docker port` before starting host services

---

## 15. References

- `docs/AGENT-PLATFORM-07F1-RUNTIME-EXECUTION-READINESS.md` — Step 2 readiness plan
- `docs/AGENT-HARNESS-06E-CHECKPOINT.md` — 06E precedent (full E2E canary)
- `docs/AGENT-HARNESS-07-CHECKPOINT.md` — per-builder config adapter
- `services/ai-service/scripts/canary-07f1-submit-job.ts` — canary script
- `services/ai-service/src/worker/worker.processor.ts` — metadata preservation (lines 1013-1024)
- `services/ai-service/src/queue/job.types.ts` — `AiExecutionJob` type with orchestration fields

---

## Document Metadata

- **Created:** 2026-07-10
- **Task:** AGENT-PLATFORM-07F1 Step 3 — Queue Transport + Metadata Preservation Runtime Canary
- **Status:** Step 3 COMPLETE — PASS
- **Author:** AI-assisted runtime execution
- **Governance:** CLAUDE.md, TASKS.md, TASKS_BACKLOG_FULL.md
