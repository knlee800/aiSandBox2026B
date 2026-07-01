# AGENT-HARNESS-05C7A — Harness Entitlement Runtime Validation
## Checkpoint Document

**Task ID:** AGENT-HARNESS-05C7A
**Title:** Harness Entitlement Runtime Validation
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-01
**Nature:** Runtime validation / security boundary verification

---

## Dependencies

- AGENT-HARNESS-05C4 — COMPLETE and LOCKED
- AGENT-HARNESS-05C5 — COMPLETE and LOCKED
- AGENT-HARNESS-05C5A — COMPLETE and LOCKED
- AGENT-HARNESS-05C6 — COMPLETE and LOCKED
- AGENT-HARNESS-05C6A — COMPLETE and LOCKED
- AGENT-HARNESS-05C7 — COMPLETE and LOCKED

---

## Objective

Runtime-validate AGENT-HARNESS-05C7 in production compose. Confirm that the harness identity entitlement gate operates correctly under live service conditions — non-entitled identities are rejected, explicitly entitled identities are accepted and routed to `selectedPath: "plain"`, and no side effects (tool-dispatch, file action, checkpoint, browser_smoke) occur.

---

## Scope Executed

**Choice B only — Scenarios A, B, C.**

Scenario D (Explicitly Entitled v1 Acceptance) was **not executed**. Entitled identity setup requires a supported DB-backed API key that cannot be created without raw DB mutation or an approved application flow. Scenario D is explicitly out of scope for this task and should be registered separately if needed. See section below.

---

## Scenario D — Not Executed / Out of Scope

Scenario D (explicit v1 acceptance via harness-entitled identity) was not executed under AGENT-HARNESS-05C7A.

Reason: The static `test-harness-api-key` userId is synthetic and cannot own real UUID-backed sessions. No DB-backed API key was created for the real test user during this task. No raw DB mutation was approved.

This remains out of scope. If needed, register a separate task:
- **Recommended next task:** AGENT-HARNESS-05C8 — Execution-Bound Hardening (registration only), or optionally a separate entitled v1 acceptance task.

Scenario D validation criteria remain unchecked and must not be marked complete under 05C7A.

---

## Deployment Verification Evidence (Scenario A — PASS)

| Check | Result |
|---|---|
| Services running before start | 8/8 running |
| Process-local PowerShell override | `AGENT_HARNESS_ENABLE_TOOL_LOOP=false` set before compose; restored in finally block |
| api-gateway tsc build | Clean, exit 0 |
| api-gateway container recreated (--no-deps) | Success |
| api-gateway health | HTTP 200 `{"status":"ok"}` |
| Compiled 05C7 gate present | `identity.harnessEntitled !== true` found in `/app/dist/src/ai/ai-execution.controller.js` |
| ai-service enableToolLoop | false |
| ai-service enableBrowserSmoke | false |
| ai-service AGENT_HARNESS_ENABLE_TOOL_LOOP env | false |
| Queue baseline | waiting=0, active=0, failed=3 |
| usage_records baseline | 4 |

---

## Plain Non-Entitled Browser Execution Evidence (Scenario B — PASS)

| Property | Value |
|---|---|
| User | demo@aisandbox.com |
| User UUID | 1eb05cfa-af67-428a-bbec-a0ef0163b539 |
| Session | 660cf3ca-5498-4829-8f67-2c93e65a42eb |
| conversationId | 7fb21478-2445-4e20-8361-276a366df317 |
| executionId | ed3ec014-7cb1-4b38-a30c-bc7cd4d4c930 |
| HTTP status | 202 Accepted |
| Execution status | completed |
| Provider | xai |
| Model | grok-4.3 |
| tokensUsed | 510 |
| Output | `05C7A plain validation passed` |
| fileActions | [] (empty) |
| usage_records | 4 → 5 (+1) |
| Queue failed count | 3 (unchanged) |

### Exact route_evaluated Event — Scenario B

```json
{
  "harnessVersion": null,
  "enableToolLoop": false,
  "selectedPath": "plain"
}
```

---

## Non-Entitled Browser v1 Rejection Evidence (Scenario C — PASS)

| Property | Value |
|---|---|
| Browser-session identity | Same as Scenario B (demo@aisandbox.com, UUID 1eb05cfa-af67-428a-bbec-a0ef0163b539) |
| Identity properties | isInternal: true, harnessEntitled: undefined / not set |
| conversationId | 9d03ba9b-8a72-4e92-8a8d-a67ddd758279 |
| harnessVersion sent | "v1" |
| HTTP status | **403 Forbidden** |
| Response body | `{"message":"Forbidden","error":"Forbidden","statusCode":403}` |
| executionId returned | None |
| usage_records | 5 (unchanged) |
| Queue stats | failed=3 (unchanged) |
| route_evaluated event in ai-service | **None** |
| Ledger row created | **None** |
| BullMQ job created | **None** |

---

## isInternal Bypass Proof

The browser-session identity used in Scenarios B and C has `isInternal: true`. Despite this, the v1 request in Scenario C was rejected with HTTP 403.

**Proof:** `isInternal: true` did **not** bypass the harness entitlement gate. The gate checks `identity.harnessEntitled !== true`, and `isInternal` is not `harnessEntitled`. The rejection occurred before any route_evaluated event, BullMQ job, ledger row, or worker involvement.

---

## Queue / Ledger Before–After Evidence

| Metric | Before (Scenario A baseline) | After Scenario B | After Scenario C | Final |
|---|---|---|---|---|
| Queue waiting | 0 | 0 | 0 | 0 |
| Queue active | 0 | 0 | 0 | 0 |
| Queue failed | 3 | 3 | 3 | 3 |
| usage_records rows | 4 | 5 | 5 | 5 |

Scenario B added exactly 1 usage_records row (executionId `ed3ec014-7cb1-4b38-a30c-bc7cd4d4c930`). Scenario C added zero rows.

---

## No route_evaluated Event for Scenario C

Confirmed: no `route_evaluated` event was emitted in ai-service during Scenario C. The 403 rejection in api-gateway occurred before the request reached the BullMQ queue or the ai-service worker. The entitlement gate is purely controller-level in api-gateway.

---

## Cleanup Summary

- Session 660cf3ca-5498-4829-8f67-2c93e65a42eb stopped successfully.
- Session 660cf3ca-5498-4829-8f67-2c93e65a42eb terminated successfully.
- Temporary cookie/body files removed.
- All 8 services running after cleanup.
- api-gateway health: HTTP 200.
- Queue final stats: waiting=0, active=0, failed=3 (unchanged).

---

## Retained Side Effects

The following side effects remain in the live environment as expected and permitted:

- api-gateway image rebuilt with 05C7 code.
- api-gateway container recreated.
- One `auth_sessions` row from demo@aisandbox.com login.
- One `usage_records` row for executionId `ed3ec014-7cb1-4b38-a30c-bc7cd4d4c930` (Scenario B).

No other persistent side effects. No pre-existing sessions or rows were disturbed.

---

## Safety Confirmations

- No source files changed.
- `.env` was not read or modified.
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` was never set to `true`.
- No DB-backed API key created.
- No LaunchGuard / `LAUNCH_STATE` override.
- No static harness key execution attempted.
- No raw DB mutation.
- No Agent Harness activation.
- No `browser_smoke`, tool-dispatch, checkpoint, or file actions.
- No git commit or push.
- No subagents used.
- Cost: 1 xAI call; estimated provider cost < $0.01.

---

## Final Verdict

**PASS**

05C7A validates the runtime rejection boundary:

1. Plain non-entitled browser execution continues to work correctly (HTTP 202, completed, selectedPath: plain).
2. Non-entitled browser v1 request is rejected with HTTP 403 before ledger/queue/worker/provider.
3. `isInternal: true` does not bypass entitlement.
4. `enableToolLoop` remains false throughout.
5. No harness tools, tool-dispatch, browser_smoke, file actions, or checkpoints were activated.
6. Cleanup was clean; all 8 services healthy; queue stable.

---

## Locked Invariants

The following invariants are established and locked by this checkpoint:

1. The api-gateway compiled binary includes the `identity.harnessEntitled !== true` gate at the entitlement check path.
2. Non-entitled browser-session identities (regardless of `isInternal`) receive HTTP 403 for any request with `harnessVersion: "v1"`.
3. The 403 rejection is fully pre-queue and pre-worker — no route_evaluated event, no BullMQ job, no usage_records row, no ledger row is created.
4. `isInternal: true` is not equivalent to `harnessEntitled: true`. They are distinct identity properties.
5. `enableToolLoop` and `enableBrowserSmoke` remain false in ai-service.
6. Plain (non-harness) non-entitled execution is unaffected by the gate.
7. Scenario D (entitled v1 acceptance) is explicitly out of scope for 05C7A and must not be considered validated.

These invariants must be preserved by all future tasks in the AGENT-HARNESS family unless an explicit superseding task is approved and documented.

---

## Next Recommended Task

Register **AGENT-HARNESS-05C8 — Execution-Bound Hardening**, registration only.

If Scenario D (explicitly entitled v1 acceptance) is required before 05C8, register it as a separate preceding task with a LaunchGuard compatibility analysis and explicit DB-backed API key setup approval.

---

*COMPLETE and LOCKED — 2026-07-01. This checkpoint document must not be modified.*
