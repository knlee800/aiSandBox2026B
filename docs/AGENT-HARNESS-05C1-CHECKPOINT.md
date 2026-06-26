# AGENT-HARNESS-05C1 — Harness Version Queue/API Wiring Review — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C1
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-26
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** ARCHITECTURE REVIEW / WIRING ANALYSIS

---

## 1. Objective

Inspect and determine the safest wiring strategy for `harnessVersion` through the API Gateway → BullMQ → ai-service worker path, so future validation can exercise the Agent Harness loop through the official production route rather than via direct BullMQ enqueue.

Triggered by AGENT-HARNESS-05B7 finding: `harnessVersion: "v1"` is not currently passed by api-gateway into the BullMQ execution job payload, meaning the Agent Harness worker branch is never reached from the production route.

---

## 2. Files Inspected

| File | Purpose |
|------|---------|
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Execution controller — request handling and BullMQ job construction |
| `services/api-gateway/src/queue/queue.service.ts` | Queue service — `enqueueExecution()` signature and payload forwarding |
| `services/api-gateway/src/clients/ai-service-http.client.ts` | `AIExecutionRequest` type definition |
| `services/ai-service/src/worker/worker.processor.ts` | Worker consumer — `harnessVersion` branch condition |
| `services/ai-service/src/worker/worker.processor.spec.ts` | Worker tests — coverage of `harnessVersion` path |
| `services/ai-service/src/agent-harness/config/agent-harness.config.ts` | Harness config defaults: `enableToolLoop`, `enableBrowserSmoke`, `enablePreApplyCheckpoint` |
| `services/ai-service/src/agent-harness/contracts/agent-harness.contracts.ts` | Harness contract types |
| `services/ai-service/src/queue/job.types.ts` | `AiExecutionJob` type — consumer-side field definitions |
| `docs/AGENT-HARNESS-05B7-CHECKPOINT.md` | Prior checkpoint — original finding about wiring gap |

---

## 3. Current Request / Controller Typing Summary

**`AIExecutionRequest`** (defined in `services/api-gateway/src/clients/ai-service-http.client.ts`):
- Does **not** include `harnessVersion`.
- The field is entirely absent from the public request type.

**`AIExecutionController`** (`services/api-gateway/src/ai/ai-execution.controller.ts`):
- Handles `POST /api/ai/execute`.
- Explicitly constructs the BullMQ job payload from the typed `AIExecutionRequest`.
- Because `harnessVersion` is absent from the type, it is **not forwarded** in the job payload.
- No validation or allow-list exists for `harnessVersion` at the controller boundary.

---

## 4. Current QueueService Payload Summary

**`QueueService.enqueueExecution(jobData: any)`** (`services/api-gateway/src/queue/queue.service.ts`):
- Accepts `jobData` typed as `any`.
- Would transparently forward any additional fields if they were present in the input object.
- `harnessVersion` would propagate to BullMQ if the controller passed it.
- **Gap:** The controller does not pass it, so it never reaches the queue regardless of `QueueService` flexibility.

---

## 5. Current ai-service Job / Worker Summary

**`AiExecutionJob`** (`services/ai-service/src/queue/job.types.ts`):
- Already includes `harnessVersion?: string` as an optional field.
- Consumer-side typing is ready to receive the field.

**`WorkerProcessor`** (`services/ai-service/src/worker/worker.processor.ts`):
- Already contains the branch condition:
  ```
  job.data.harnessVersion === 'v1' && DEFAULT_AGENT_HARNESS_CONFIG_V1.enableToolLoop
  ```
- When this condition is true, the Agent Harness loop is invoked.
- When this condition is false (current production default), plain execution is used.

---

## 6. Harness Config Gate Summary

**`DEFAULT_AGENT_HARNESS_CONFIG_V1`** (`services/ai-service/src/agent-harness/config/agent-harness.config.ts`):

| Gate | Default | Effect |
|------|---------|--------|
| `enableToolLoop` | `false` | Harness loop is **not** invoked even if `harnessVersion === 'v1'` |
| `enableBrowserSmoke` | `false` | Browser automation is **not** triggered |
| `enablePreApplyCheckpoint` | `true` | Pre-apply checkpoint is created for mutating tool calls |

**Critical observation:** Wiring `harnessVersion` from the API to the queue does **not** activate the Agent Harness loop by itself. The double gate (`harnessVersion === 'v1'` AND `enableToolLoop === true`) means that even after wiring, `enableToolLoop` must be explicitly enabled before the harness loop fires.

---

## 7. Gap Analysis

| Layer | State | Verdict |
|-------|-------|---------|
| `AIExecutionRequest` type | `harnessVersion` absent | **Gap** |
| Controller payload construction | Does not forward `harnessVersion` | **Gap** |
| Controller validation | No allow-list for `harnessVersion` | **Gap** |
| `QueueService.enqueueExecution()` | Accepts `any`, would pass through | Ready |
| `AiExecutionJob` consumer type | Includes `harnessVersion?: string` | Ready |
| `WorkerProcessor` branch condition | Correct gate implemented | Ready |
| `enableToolLoop` default | `false` | Safe (double gate) |
| `enableBrowserSmoke` default | `false` | Safe |
| `enablePreApplyCheckpoint` default | `true` | Correct protective default |

**Summary:** Producer side (api-gateway) is unwired. Consumer side (ai-service) is ready. The fix requires only api-gateway changes plus validation.

---

## 8. Security / Rollout Analysis

**Risks if `harnessVersion` is added to the public request body without controls:**
1. Any authenticated user could pass `harnessVersion: 'v1'`, but this alone does not activate harness execution because `enableToolLoop` defaults false.
2. Future change: if `enableToolLoop` is ever set true before request-body scoping is added, harness loop becomes available to all authenticated users.
3. `enableBrowserSmoke: false` prevents browser automation escaping.
4. `enablePreApplyCheckpoint: true` ensures mutating tool calls still create a recovery point.

**Quota/rate-limit risk:** Harness-mode execution uses the same queue path. Existing quota and rate-limit guards at the controller boundary apply regardless of `harnessVersion`.

**Safe wiring window:** The current config gate (`enableToolLoop: false`) provides a safe implementation window. Wiring can proceed before `enableToolLoop` is enabled, allowing the API path to be tested end-to-end without harness execution firing.

---

## 9. Strategy Comparison

| Strategy | Description | Pros | Cons | Risk |
|----------|-------------|------|------|------|
| **A** | Optional public request body field `harnessVersion?: 'v1'` with controller allow-list validation | Minimal change; validates real production path; no new endpoint | Field visible to all authenticated users | Low while `enableToolLoop: false` |
| **B** | Server-side default via env var or feature flag | No client API surface change | Requires env/config change per environment; no per-request control | Low but less flexible |
| **C** | Separate internal/admin endpoint for `harnessVersion` | Keeps main execute route clean; scoped access | New endpoint; does not validate the main production path | Low for harness; medium for route divergence |
| **D** | Keep inaccessible until broader rollout controls exist | No risk surface expansion | Cannot validate Agent Harness loop via production route | None now; defers risk to future |

---

## 10. Recommended Strategy

**Strategy A — Add optional public request body field with strict allow-list validation.**

### Rationale

- Minimal diff: only `AIExecutionRequest` type and controller validation logic.
- Validates the actual production route (`POST /api/ai/execute` → BullMQ → ai-service worker).
- No new endpoint required.
- Controller boundary validation prevents unexpected values:
  - `undefined` → allowed (default behavior preserved)
  - `'v1'` → allowed, forwarded to queue
  - anything else → `HTTP 400` returned immediately
- Double gate remains the real runtime safety boundary (`enableToolLoop: false` prevents harness loop execution).
- Future user/role scoping can be added before `enableToolLoop` is ever set true in production.

### Allow-list validation rule

```
if (harnessVersion !== undefined && harnessVersion !== 'v1') {
  throw new BadRequestException('Invalid harnessVersion');
}
```

---

## 11. Proposed Implementation Files

**Slice:** AGENT-HARNESS-05C2 — Harness Version API-to-Queue Wiring

| File | Change |
|------|--------|
| `services/api-gateway/src/clients/ai-service-http.client.ts` | Add `harnessVersion?: 'v1'` to `AIExecutionRequest` |
| `services/api-gateway/src/ai/ai-execution.controller.ts` | Validate `harnessVersion` allow-list; forward in queue job payload |
| `services/api-gateway/src/ai/ai-execution.controller.spec.ts` | Add tests for all `harnessVersion` validation cases |

---

## 12. Proposed Tests

| Test case | Expected result |
|-----------|----------------|
| `harnessVersion` undefined | Default behavior preserved; job payload unchanged |
| `harnessVersion: 'v1'` | Accepted; `harnessVersion: 'v1'` forwarded in queue job payload |
| `harnessVersion: 'v2'` | `HTTP 400` returned |
| `harnessVersion` non-string (e.g. number, object) | `HTTP 400` returned |

---

## 13. Proposed Validation Plan

1. Run `npm test` in `services/api-gateway` — all new and existing tests pass.
2. Run `npm run build` in `services/api-gateway` — no TypeScript errors.
3. Live smoke: send `POST /api/ai/execute` with `harnessVersion: 'v1'` via authenticated session; confirm job reaches ai-service worker with `harnessVersion` in job data (log inspection); confirm no harness loop fires while `enableToolLoop: false`.
4. Live smoke: send `POST /api/ai/execute` with `harnessVersion: 'v2'`; confirm `HTTP 400` returned.
5. Confirm existing plain execution path with no `harnessVersion` field is unaffected.

---

## 14. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `harnessVersion` accessible to all authenticated users | Double gate: `enableToolLoop: false` prevents harness execution; allow-list prevents unknown values |
| Future `enableToolLoop: true` before user scoping is added | Requires explicit separate task and review; not part of this slice |
| Regression in plain execution path | Existing controller tests cover default path; new test confirms `undefined` preserves behavior |
| TypeScript drift between `AIExecutionRequest` and `AiExecutionJob` | Both files updated in same slice; build validation confirms alignment |

---

## 15. Confirmations / Non-Goals

- No source, runtime, test, package, Docker, frontend, or database files were modified during this review.
- No `.env` changes.
- No tests or builds were run.
- No Docker commands were run.
- No provider or model execution was performed.
- No browser smoke was executed.
- No implementation was performed.
- No git commit or push was performed.
- This checkpoint is created during consolidation per AGENT-HARNESS-05C1 non-goals.

---

## 16. Next Recommended Task

**Register AGENT-HARNESS-05C2 — Harness Version API-to-Queue Wiring**

Registration only (no implementation during registration step):
- Scope: files listed in Section 11.
- Tests: cases listed in Section 12.
- Validation plan: Section 13.
- Depends on: AGENT-HARNESS-05C1 COMPLETE and LOCKED.
- Implementation loop: 3-step (registration → implementation → consolidation/checkpoint).
