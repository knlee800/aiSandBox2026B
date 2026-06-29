# AGENT-HARNESS-05C3 — Harness Version Runtime Validation — CHECKPOINT

**Task ID:** AGENT-HARNESS-05C3
**Status:** COMPLETE and LOCKED
**Completed:** 2026-06-27
**Family:** AGENT-HARNESS
**Phase:** 5C
**Nature:** RUNTIME VALIDATION / API-TO-QUEUE PROPAGATION / xAI / APPROVAL REQUIRED

---

## 1. Original Objective

Prove via runtime validation that:

1. The official `POST /api/ai/execute` route accepts `harnessVersion: 'v1'`.
2. The api-gateway forwards the field into the BullMQ job.
3. The ai-service worker receives the field.
4. The worker evaluates the harness branch gate.
5. Because `enableToolLoop` remains `false`, the harness loop is not entered.
6. The request falls through to the normal xAI execution path.
7. The xAI execution completes and can be retrieved from the polling endpoint.
8. No tool handler, browser_smoke action, file mutation, or workspace action is executed.

---

## 2. Dependencies

- **AGENT-HARNESS-05C1** — COMPLETE and LOCKED (architecture review selected public optional harnessVersion with strict allow-list validation)
- **AGENT-HARNESS-05C2** — COMPLETE and LOCKED (harnessVersion API-to-queue wiring implemented and statically validated)
- **AGENT-HARNESS-05C3A** — COMPLETE and LOCKED (worker harness route observability event added; resolved the observability gap that was blocking 05C3 runtime validation)
- **AGENT-HARNESS-05B7** — COMPLETE and LOCKED (production xAI provider/model execution path validated)
- **AGENT-HARNESS-05B8** — COMPLETE and LOCKED (seed login password hashes corrected)
- **AGENT-HARNESS-05B9** — COMPLETE and LOCKED (sessionId UUID boundary validation implemented)

---

## 3. Initial Production Compose Status

All eight production services were confirmed running before deployment commenced.

| Service | Status |
|---------|--------|
| postgres | running |
| redis | running |
| api-gateway | running |
| ai-service | running |
| container-manager | running |
| frontend | running |
| worker | running |
| nginx | running |

---

## 4. Deployment Performed

**Finding:** The deployed api-gateway image did not contain the 05C2 `harnessVersion` wiring. The image had been built before 05C2 was implemented.

**Resolution:**

| Step | Action |
|------|--------|
| 1 | Rebuilt and recreated api-gateway only to deploy 05C2 harnessVersion wiring. |
| 2 | Rebuilt and recreated ai-service only to deploy 05C3A `agent_harness.route_evaluated` event. |
| 3 | No other service was rebuilt or restarted. |
| 4 | All eight production services remained running throughout. |

---

## 5. Post-Deployment Verification

After deployment, all eight production services remained running. The updated api-gateway and ai-service containers were confirmed healthy before proceeding with runtime validation.

---

## 6. Compiled 05C2 and 05C3A Evidence

### 05C2 Evidence (api-gateway)

The deployed api-gateway accepted `harnessVersion: 'v1'` and returned HTTP 202 — confirming:
- `harnessVersion?: 'v1'` is present in `AIExecutionRequest`.
- Controller allow-list validation: `undefined` or `'v1'` accepted.
- `harnessVersion` forwarded into the BullMQ job payload.

### 05C3A Evidence (ai-service)

The `agent_harness.route_evaluated` structured event was emitted — confirming:
- `worker.processor.ts` received the field.
- `useHarness` was evaluated.
- The event logged `harnessVersion`, `enableToolLoop`, and `selectedPath`.

---

## 7. Config Gate Values

| Gate | Value |
|------|-------|
| `harnessVersion` | `'v1'` (sent in request) |
| `enableToolLoop` | `false` (unchanged) |
| `enableBrowserSmoke` | `false` (unchanged) |
| `enablePreApplyCheckpoint` | `true` (unchanged) |
| `selectedPath` | `'plain'` (derived: `harnessVersion === 'v1'` but `enableToolLoop === false`) |

---

## 8. Queue Baseline

BullMQ state before runtime validation:
- `waiting`: 0
- `active`: 0
- `failed` count: 3 (pre-existing, unrelated)

---

## 9. Authentication Result

Standard session-cookie login was performed using an existing valid UUID-backed test user.

- Login result: success.
- Auth session created.
- Session token: **[MASKED]**

---

## 10. Session, Conversation, and Execution IDs

| Field | Value |
|-------|-------|
| executionId | `18ff206a-80a6-4259-b203-c79f5fe1fec5` |
| Session token | [MASKED] |

---

## 11. Submit and Poll Results

### Submit

| Field | Value |
|-------|-------|
| Endpoint | `POST /api/ai/execute` |
| `harnessVersion` | `'v1'` |
| HTTP status | 202 Accepted |
| executionId | `18ff206a-80a6-4259-b203-c79f5fe1fec5` |

### Poll

| Field | Value |
|-------|-------|
| status | `completed` |
| provider | `xai` |
| model | `grok-4.3` |
| tokensUsed | `504` |
| output | `05C3 xAI validation passed` |
| fileActions | `[]` |

---

## 12. Exact Route Evaluated Event

```json
{
  "event": "agent_harness.route_evaluated",
  "executionId": "18ff206a-80a6-4259-b203-c79f5fe1fec5",
  "harnessVersion": "v1",
  "enableToolLoop": false,
  "selectedPath": "plain"
}
```

---

## 13. Field-by-Field Route Assertions

| Field | Expected | Observed | Pass? |
|-------|----------|----------|-------|
| `event` | `agent_harness.route_evaluated` | `agent_harness.route_evaluated` | ✓ |
| `executionId` | `18ff206a-80a6-4259-b203-c79f5fe1fec5` | `18ff206a-80a6-4259-b203-c79f5fe1fec5` | ✓ |
| `harnessVersion` | `v1` | `v1` | ✓ |
| `enableToolLoop` | `false` | `false` | ✓ |
| `selectedPath` | `plain` | `plain` | ✓ |

---

## 14. Route Event Count

Exactly **one** `agent_harness.route_evaluated` event was emitted for executionId `18ff206a-80a6-4259-b203-c79f5fe1fec5`.

No duplicate or stray events observed.

---

## 15. Postgres Usage Record

One `usage_records` row was written for the execution:

- Status: `completed`
- Provider: `xai`
- Model: `grok-4.3`
- Tokens: `504`

---

## 16. Queue Before/After Comparison

| Metric | Before | After |
|--------|--------|-------|
| `waiting` | 0 | 0 |
| `active` | 0 | 0 |
| `failed` | 3 | 3 |

The failed count remained unchanged at 3 (pre-existing, unrelated). The queue returned to clean state after processing.

---

## 17. fileActions Assertion

`fileActions` in the poll response: `[]`

No file tool, file write, file delete, or workspace action was executed during this execution.

---

## 18. Harness / Tool / Browser Inactivity Evidence

| Item | Status |
|------|--------|
| Harness tool loop entered | No (`enableToolLoop: false`) |
| Any harness tool executed | No |
| `browser_smoke` executed | No (`enableBrowserSmoke: false`) |
| `preApplyCheckpointHash` present | No (not set — confirming plain path) |
| File actions count | 0 |

---

## 19. xAI Provider / Model / Token / Output Result

| Field | Value |
|-------|-------|
| Provider | `xai` |
| Model | `grok-4.3` |
| Tokens used | `504` |
| Output | `05C3 xAI validation passed` |

---

## 20. Cost Estimate

Estimated provider cost: **below USD $0.01**

No overspend. Cost within approved minimal-prompt bounds.

---

## 21. Cleanup Result

- No temporary files remained after validation.
- Session used was a pre-existing test user session — no residual artifacts.
- No changes to repository files.
- No changes to `.env`.

---

## 22. Final Compose Status

All eight production services remained running after validation:

| Service | Status |
|---------|--------|
| postgres | running |
| redis | running |
| api-gateway | running |
| ai-service | running |
| container-manager | running |
| frontend | running |
| worker | running |
| nginx | running |

---

## 23. Confirmation No Files or .env Changed

- No source files were modified during runtime validation.
- No `.env` files were modified.
- No Docker, frontend, database, or package files were modified.
- The only repository changes introduced by this consolidation are governance/documentation files only.

---

## 24. Final Verdict

**PASS**

All eight runtime acceptance criteria satisfied:

1. ✓ Production compose prerequisites verified — all eight services running.
2. ✓ `agent_harness.route_evaluated` observability method confirmed (05C3A deployed).
3. ✓ Keith explicitly approved runtime commands and xAI call.
4. ✓ Session-cookie authentication succeeded.
5. ✓ `POST /api/ai/execute` with `harnessVersion: 'v1'` returned HTTP 202.
6. ✓ `WorkerProcessor` received and evaluated the field — confirmed via `route_evaluated` event.
7. ✓ `enableToolLoop` remained `false`; harness loop not entered; no harness tools or `browser_smoke` executed.
8. ✓ Normal xAI execution completed; poll reports `completed`, provider `xai`, model `grok-4.3`, tokens 504, output `05C3 xAI validation passed`; usage record written; no file actions; secrets masked; no source or config changes; cleanup complete.

---

## 25. Locked Invariants

The following invariants are locked from this checkpoint forward:

- `harnessVersion` accepts only `undefined` or `'v1'`. Any other value returns HTTP 400 at the api-gateway controller.
- `enableToolLoop` must remain `false` until an explicit separately reviewed and approved activation task enables it.
- `enableBrowserSmoke` must remain `false` until an explicit separately reviewed and approved activation task enables it.
- A `v1` request with `enableToolLoop: false` therefore always selects `selectedPath: 'plain'`.
- No harness tool becomes reachable until a separately reviewed activation task.
- The `agent_harness.route_evaluated` event is worker-internal and must never include sensitive fields (prompts, keys, cookies, workspace content).
- xAI is the validated production provider for harness validation executions.
- No future task may activate the tool loop without architecture/security review and explicit Keith approval.

---

## 26. Next Recommended Task

**Register AGENT-HARNESS-05C4 — Controlled Harness Loop Activation Readiness Review**

Registration only. Do not activate the tool loop or change any configuration without explicit Keith approval.

Scope of 05C4 registration:
- Review architecture and security preconditions required before `enableToolLoop` can be set to `true`.
- Enumerate required acceptance criteria.
- Document risks, activation plan, and rollback strategy.
- Registration only — no source changes during registration.

---

> LOCKED — do not modify this checkpoint.
