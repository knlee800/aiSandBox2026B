# AGENT-HARNESS-06B — Read-Only Harness Canary Plan — Checkpoint

**Task ID:** AGENT-HARNESS-06B
**Status:** COMPLETE and LOCKED
**Completed:** 2026-07-06
**Nature:** PLANNING/GOVERNANCE — canary plan document, no runtime activation
**Checkpoint document:** docs/AGENT-HARNESS-06B-CHECKPOINT.md

---

## 1. Task Summary

AGENT-HARNESS-06B created the detailed, approval-gated plan for the first read-only Agent Harness canary execution. The task was governance and documentation only. No source code, tests, frontend, package files, environment files, Docker configuration, schemas, or database artifacts were changed. No runtime activation occurred. No canary was executed.

The canary plan document (`docs/AGENT-HARNESS-06B-CANARY-PLAN.md`) was created during the planning pass and contains all required sections: objective, environment requirements, required/forbidden env flags, allowed/blocked tool sets, test workspace specification, exact canary prompt, expected route evaluation, expected tool calls, expected audit events, success criteria, failure criteria, abort/stop conditions, rollback procedure, observability checklist, privacy/data safety checklist, manual approval steps, operator runbook, final report requirements, runtime execution boundary, and open questions.

---

## 2. Exact Files Changed

| File | Change |
|------|--------|
| `docs/AGENT-HARNESS-06B-CANARY-PLAN.md` | Created during planning pass (prior step) |
| `docs/AGENT-HARNESS-06B-CHECKPOINT.md` | Created in this consolidation step |
| `TASKS.md` | Updated: AGENT-HARNESS-06B marked COMPLETE and LOCKED |
| `TASKS_BACKLOG_FULL.md` | Updated: AGENT-HARNESS-06B marked COMPLETE and LOCKED |
| `docs/AINOW-EXECUTION-ROADMAP.md` | Updated: AGENT-HARNESS-06B marked COMPLETE; Keith decision recorded |

No implementation, source, test, frontend, package, env, Docker, schema, or database files were changed.

---

## 3. Canary Plan Document Reference

**Path:** `docs/AGENT-HARNESS-06B-CANARY-PLAN.md`
**Created:** 2026-07-06
**Status:** Planning document — complete, pending Keith approval before execution

---

## 4. Canary Objective Summary

Prove that the harness path can route a controlled read-only request through the tool loop using only `read_file` and `list_files`. Prove that write/delete/validation/browser tools are unavailable. Prove that audit events are emitted and contain no sensitive content (no prompt text, no model output, no file content, no tool arguments, no full tool results). Prove the canary can be stopped and rolled back safely.

---

## 5. Current Harness Safety State

| Element | Current Default |
|---------|----------------|
| `enableToolLoop` | `false` |
| `enableWriteTools` | `false` |
| `enableValidationTools` | `false` |
| `enableBrowserSmoke` | `false` |
| `read_file` registration | Always (when harness path active) |
| `list_files` registration | Always (when harness path active) |
| `write_file` registration | Only when `enableWriteTools === true` |
| `delete_file` registration | Only when `enableWriteTools === true` |
| `run_validation` registration | Only when `enableValidationTools === true` |
| `browser_smoke` registration | Only when `enableBrowserSmoke === true` |
| `start_preview` registry metadata | `enabled: false`, `implementationStatus: 'planned'` |
| `search_workspace` registry metadata | `enabled: false`, `implementationStatus: 'planned'` |
| Audit recorder | Implemented (`InMemoryHarnessAuditRecorder`) |
| `route_evaluated` log | Emitted in worker processor |
| `harness.loop_started` audit | Emits correct `toolTimeoutMs` |

The harness tool loop is NOT activated. `AGENT_HARNESS_ENABLE_TOOL_LOOP` remains `false` or absent.

---

## 6. Required Future Environment Flags

The following flags are required for the **future execution task only** (AGENT-HARNESS-06C or equivalent). They must NOT be set until that task is explicitly approved by Keith.

| Flag | Required Value | Purpose |
|------|---------------|---------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Enables the harness tool loop path |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` or absent | Blocks write/delete tool registration |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` or absent | Blocks validation tool registration |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` or absent | Blocks browser smoke tool registration |
| `REDIS_URL` | set | Worker processor requires it |

AI provider credentials required only if Keith approves real provider calls for the execution task.

---

## 7. Forbidden Future Environment Flags / States

| Forbidden State | Reason |
|-----------------|--------|
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS=true` | Would allow file mutation |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS=true` | Would allow command execution |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE=true` | Would allow browser launch |
| Production environment | Safety boundary |
| Real customer/user data in workspace | Privacy/safety |
| Shared workspace with valuable files | Data loss risk |
| Unreviewed/unapproved prompt | Prompt injection risk |
| Missing rollback/stop procedure | No recovery path |

---

## 8. Allowed Tool Set (Canary Execution)

| Tool | Risk Level | Category |
|------|-----------|----------|
| `list_files` | low | workspace/read-only |
| `read_file` | low | workspace/read-only |

---

## 9. Blocked Tool Set (Canary Execution)

| Tool | Reason |
|------|--------|
| `write_file` | Gated behind `enableWriteTools` (must be `false`) |
| `delete_file` | Gated behind `enableWriteTools` (must be `false`) |
| `run_validation` | Gated behind `enableValidationTools` (must be `false`) |
| `browser_smoke` | Gated behind `enableBrowserSmoke` (must be `false`) |
| `search_workspace` | Not implemented; `enabled: false` in registry |
| `start_preview` | Not implemented; `enabled: false` in registry |
| Any unknown/unregistered tool | Must be rejected by dispatcher |

---

## 10. Test Session / Workspace Requirements

- Simple isolated workspace with minimal known content.
- No secrets, credentials, or API keys.
- No large files (>1 KB).
- No customer data or real project source.
- No `.env` files.
- No binary files.
- Content is deterministic and known in advance so success can be verified.

Required workspace structure:
```
workspace/
├── README.md
└── docs/
    └── notes.md
```

See `docs/AGENT-HARNESS-06B-CANARY-PLAN.md` section 11 for exact file contents.

---

## 11. Exact Canary Prompt Summary

Canary prompt (must be reviewed and approved by Keith before use):

> Use the available tools to list the workspace files, read README.md, and summarize the contents. Do not modify files. Do not run commands. Do not use browser tools.

This prompt exercises `list_files` and `read_file`, requests a summary, and explicitly prohibits modification, commands, and browser tools.

---

## 12. Expected Route Evaluation

The worker processor will emit a structured `agent_harness.route_evaluated` log with:
- `harnessVersion: "v1"`
- `enableToolLoop: true`
- `selectedPath: "harness"`

Both conditions required: adapter `supportsToolUse` is `true` and `executeWithTools` exists.

---

## 13. Expected Tool Calls

| # | Tool | Purpose |
|---|------|---------|
| 1 | `list_files` | List workspace root files |
| 2 | `read_file` (README.md) | Read README content |
| 3 | `read_file` (docs/notes.md) | Optional: model may read additional file |

Total expected: 2–3 tool calls. No write/delete/validation/browser calls expected.

---

## 14. Expected Audit Events

| # | Event Type | Key Fields |
|---|-----------|------------|
| 1 | `harness.loop_started` | `maxToolIterations: 3`, `maxToolResultBytes: 262144`, `toolTimeoutMs: 30000` |
| 2 | `harness.model_invocation_started` | `iteration: 1` |
| 3 | `harness.model_invocation_completed` | `iteration: 1`, `toolCallCount: >=1`, `finishReason: 'tool_use'` |
| 4 | `harness.tool_dispatch_started` | `toolName: 'list_files'` |
| 5 | `harness.tool_dispatch_completed` | `toolName: 'list_files'`, `resultBytes: >0` |
| 6 | `harness.tool_dispatch_started` | `toolName: 'read_file'` |
| 7 | `harness.tool_dispatch_completed` | `toolName: 'read_file'`, `resultBytes: >0` |
| 8 | `harness.model_invocation_started` | `iteration: 2` |
| 9 | `harness.model_invocation_completed` | `iteration: 2`, `toolCallCount: 0`, `finishReason: 'stop'` |
| 10 | `harness.loop_completed` | `totalToolCalls: >=2`, `terminationReason: 'completed'` |

Privacy invariants for all audit events: no `prompt`, no `output`, no `content`, no `toolArguments`, no `toolResult` (only `resultBytes`).

---

## 15. Success Criteria

All of the following must be true for the canary to be considered successful:

- [ ] Harness path selected (`selectedPath: 'harness'`).
- [ ] Only `read_file` and `list_files` registered in the dispatcher.
- [ ] `read_file` dispatched successfully (non-error result).
- [ ] `list_files` dispatched successfully (non-error result).
- [ ] No `write_file` dispatch occurred.
- [ ] No `delete_file` dispatch occurred.
- [ ] No `run_validation` dispatch occurred.
- [ ] No `browser_smoke` dispatch occurred.
- [ ] Audit events emitted (all expected events present in logs).
- [ ] Audit events contain no sensitive content.
- [ ] Final assistant answer references workspace files.
- [ ] No unexpected errors or unhandled exceptions.
- [ ] No files changed in workspace after execution.
- [ ] Execution ledger status is `completed`.
- [ ] Environment flags match plan at time of execution.

---

## 16. Failure Criteria

Any of the following constitutes canary failure:

- Any `write_file`, `delete_file`, `run_validation`, or `browser_smoke` dispatch.
- Any file mutation in the workspace.
- Any command execution.
- Any production or unapproved provider call.
- Missing `agent_harness.route_evaluated` log.
- Missing `harness.loop_started` or `harness.loop_completed` audit event.
- Sensitive content leaked into audit events.
- Unhandled exception during harness loop.
- Unknown tool dispatch not controlled.
- Environment flags not matching plan at execution time.
- Execution ledger status is not `completed`.

---

## 17. Abort / Stop Conditions

Immediately stop the canary if:

- Wrong environment detected (production, shared, or non-dedicated).
- Wrong flags detected (`enableWriteTools`, `enableValidationTools`, or `enableBrowserSmoke` is `true`).
- Tool set includes `write_file`, `delete_file`, `run_validation`, or `browser_smoke`.
- Production data present in workspace.
- Provider/API call not approved by Keith.
- Unexpected file mutation detected.
- Unexpected runtime error or crash.
- Audit event contains prompt content, model output, or file content.

---

## 18. Rollback Procedure

1. Stop dev/worker processes immediately (kill the `ai-service` process).
2. Reset env flags to safe defaults: remove or set `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`; verify write/validation/browser flags are `false` or absent.
3. Verify no flags remain active before restart.
4. If workspace mutation occurred: discard the dedicated test workspace or revert using checkpoint.
5. Record incident in final canary report.
6. Do not restart the canary without investigating the failure cause.
7. Report to Keith before any retry.

---

## 19. Observability Checklist

| # | Item | When |
|---|------|------|
| 1 | `agent_harness.route_evaluated` log | During execution |
| 2 | All `harness.*` audit events | During execution |
| 3 | Tool dispatch events (started/completed/failed) | During execution |
| 4 | Final assistant result text (summary only) | After execution |
| 5 | Worker process logs (full) | During execution |
| 6 | Registered tool set in dispatcher (before loop) | Before execution |
| 7 | Environment flags snapshot | Before execution |
| 8 | Workspace file listing (before and after) | Before and after |
| 9 | Execution ledger record status | After execution |
| 10 | No sensitive content in any captured log | After execution (verification) |

---

## 20. Privacy / Data Safety Checklist

| # | Requirement | How Verified |
|---|-------------|--------------|
| 1 | Dedicated non-sensitive workspace | Workspace contains only known test files |
| 2 | No secrets in workspace | Manual inspection before execution |
| 3 | No customer files | Workspace created fresh for canary |
| 4 | No production data | Dedicated local/non-production environment |
| 5 | No model prompt/output in audit event payloads | Audit event type definitions exclude these fields |
| 6 | No full file content in audit logs | Audit emits `resultBytes` only, not content |
| 7 | No tool arguments in audit events | Audit event types do not include input/args |
| 8 | Worker logs do not contain file content | Confirm by log inspection after execution |

---

## 21. Manual Approval Requirements

The following approvals must be obtained from Keith **before** AGENT-HARNESS-06C (or equivalent) may proceed:

| # | Approval Item | Status |
|---|---------------|--------|
| 1 | This canary plan document reviewed and accepted | Pending |
| 2 | Canary environment choice (local dev vs isolated) | Pending |
| 3 | Provider choice (real provider vs stub adapter) | Pending |
| 4 | Exact canary prompt approved | Pending |
| 5 | Environment flags confirmed | Pending |
| 6 | Execution window approved (when to run) | Pending |
| 7 | Final canary report reviewed after execution | Pending |

---

## 22. Runtime Execution Boundary

**AGENT-HARNESS-06B creates the plan only.**

Actual canary execution must be a separate task:

- **Proposed ID:** AGENT-HARNESS-06C — Read-Only Harness Canary Execution
- **Prerequisites:** This plan document and checkpoint reviewed and approved by Keith.
- **Requires:** Keith's explicit approval before any runtime/provider/dev-server command.
- **Scope:** Execute one canary session using the plan defined in `docs/AGENT-HARNESS-06B-CANARY-PLAN.md`. Produce the final canary report.

Until AGENT-HARNESS-06C is explicitly registered and approved:
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` must remain `false` or absent.
- No dev server should be started for canary purposes.
- No provider calls should be made for canary purposes.

---

## 23. Validation Evidence from Planning Pass

| # | Evidence Item | Result |
|---|---------------|--------|
| 1 | `docs/AGENT-HARNESS-06B-CANARY-PLAN.md` created | Confirmed — file exists |
| 2 | All 16 planning acceptance criteria marked `[x]` in TASKS.md | Confirmed |
| 3 | All 16 planning acceptance criteria marked `[x]` in TASKS_BACKLOG_FULL.md | Confirmed |
| 4 | Canary objective defined (section 2 of plan) | Confirmed |
| 5 | Env flag requirements defined (section 6 of plan) | Confirmed |
| 6 | Allowed tool set defined: `read_file`, `list_files` (section 8 of plan) | Confirmed |
| 7 | Blocked tool set defined (section 9 of plan) | Confirmed |
| 8 | Test session/workspace requirements defined (sections 10–11 of plan) | Confirmed |
| 9 | Exact canary prompt defined (section 12 of plan) | Confirmed |
| 10 | Expected audit events defined (section 15 of plan) | Confirmed |
| 11 | Success criteria defined (section 17 of plan) | Confirmed |
| 12 | Failure criteria defined (section 18 of plan) | Confirmed |
| 13 | Rollback procedure defined (section 20 of plan) | Confirmed |
| 14 | Observability checklist defined (section 21 of plan) | Confirmed |
| 15 | Manual approval steps defined (section 23 of plan) | Confirmed |
| 16 | Final report requirements defined (section 25 of plan) | Confirmed |
| 17 | Runtime activation explicitly deferred to section 26 of plan | Confirmed |

---

## 24. Confirmation: No Runtime Activation Occurred

- `AGENT_HARNESS_ENABLE_TOOL_LOOP` was NOT set to `true` during this task.
- No dev server was started for canary purposes.
- No canary job was submitted.
- No provider calls were made for canary purposes.
- No harness tool loop was exercised.
- Agent Harness remains in default-off state.

---

## 25. Confirmation: No Env Files Modified

- No `.env` files were read, created, or modified during this task.
- No environment variables were set or changed.
- No secret files were modified.
- No `.env.local`, `.env.development`, `.env.production`, or similar files were touched.

---

## 26. Remaining Risks

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Provider choice not decided | Keith must decide: real provider vs stub adapter. Stub-first is safer. |
| 2 | Environment choice not decided | Keith must decide: local dev vs isolated. Isolated is safer. |
| 3 | Test session creation method not determined | Depends on environment choice. |
| 4 | Canary prompt not formally approved | Keith must approve exact prompt before execution. |
| 5 | AI model behavior with blocked tools unknown | If model requests blocked tool, dispatcher returns error. Behavior should be tested. |
| 6 | Redis availability for canary environment | Must verify `REDIS_URL` is set and Redis is running before execution. |
| 7 | PostgreSQL availability for ledger updates | Must verify PostgreSQL is running before execution if ledger updates are required. |
| 8 | Manual approval gate (section 21) | All 7 approval items remain pending Keith review. |

---

## 27. Next Recommended Task Options

Keith decision required. Two candidates. Neither is registered.

**Option A: AGENT-HARNESS-06C — Read-Only Harness Canary Execution**
- Execute the canary as planned in `docs/AGENT-HARNESS-06B-CANARY-PLAN.md`.
- Requires Keith review and approval of this checkpoint and the canary plan.
- Requires Keith decisions on provider choice, environment, and execution window.
- Higher technical risk but directly validates Agent Harness readiness.

**Option B: BILLING-READY-00 — Billing, Plan, Credit, and Entitlement Audit**
- Audit existing billing, plan, credit, and entitlement state.
- No dependency on harness execution.
- Lower technical risk; advances commercial readiness track.
- Can be done while canary decisions are pending.

**Do not register either task without Keith's explicit decision.**

---

## 28. Final Status

| Item | Status |
|------|--------|
| AGENT-HARNESS-06B | COMPLETE and LOCKED |
| Canary plan document | Created (`docs/AGENT-HARNESS-06B-CANARY-PLAN.md`) |
| All planning acceptance criteria | [x] (all 16 met) |
| Runtime activation | Deferred — NOT activated |
| `AGENT_HARNESS_ENABLE_TOOL_LOOP=true` | NOT set |
| Canary execution | NOT performed |
| Env files modified | NO |
| Source/test/frontend/package/env/Docker/schema/database files changed | NONE |
| Runtime/provider/database/browser/Docker commands executed | NONE |
| Subagents used | NONE |
| Next step | Keith decision required (see section 27) |

---

**AGENT-HARNESS-06B — Read-Only Harness Canary Plan — COMPLETE and LOCKED. Checkpoint created 2026-07-06. Runtime activation deferred.**
