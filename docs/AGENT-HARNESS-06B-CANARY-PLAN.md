# AGENT-HARNESS-06B — Read-Only Harness Canary Plan

**Task ID:** AGENT-HARNESS-06B
**Status:** ACTIVE (planning document)
**Created:** 2026-07-06
**Parent task:** AGENT-HARNESS-06A — Read-Only Canary Hardening Slice (COMPLETE and LOCKED)
**Nature:** Planning/governance only. No runtime activation.

---

## 1. Executive Summary

This document defines the first read-only Agent Harness canary execution plan. It does not execute the canary.

Runtime activation is deferred to a separate explicit execution task (AGENT-HARNESS-06C or equivalent) after Keith approves this plan.

The plan specifies: environment gates, allowed/blocked tools, canary prompt, expected behavior, success/failure criteria, rollback procedure, observability requirements, manual approval steps, and final report format.

---

## 2. Canary Objective

- Prove that the harness path can route a controlled request through the tool loop using only read-only tools.
- Prove that `read_file` and `list_files` can run through the API Gateway boundary.
- Prove that `write_file`, `delete_file`, `run_validation`, and `browser_smoke` tools are unavailable during the canary.
- Prove that audit events are emitted and do not contain sensitive content (no prompt text, no model output text, no file content, no tool arguments, no full tool results).
- Prove the canary can be stopped and rolled back safely.

---

## 3. Current Harness Safety State

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

---

## 4. Non-Goals

- No production activation.
- No broad rollout.
- No `write_file` or `delete_file` dispatch.
- No `run_validation` dispatch.
- No `browser_smoke` dispatch.
- No `search_workspace` or `start_preview` dispatch.
- No database mutation.
- No frontend work.
- No billing work.
- No new tool implementation.
- No `.env` file edits in this planning task.
- No source code changes in this planning task.
- No Docker work.
- No schema/migration work.

---

## 5. Canary Environment Requirements

- Dedicated local or explicitly approved non-production environment.
- Dedicated test user (not a real customer account).
- Dedicated test session (created for canary purposes only).
- Dedicated simple test workspace (see section 10–11).
- No production data.
- No customer data.
- Provider configured only if Keith explicitly approves provider use for the future execution task.
- If provider call is not approved, future execution task must use a stub/test adapter path if available.

---

## 6. Required Environment Flags

The following flags are required for the **future execution task** (AGENT-HARNESS-06C or equivalent). They must NOT be set during this planning task.

| Flag | Required Value | Purpose |
|------|---------------|---------|
| `AGENT_HARNESS_ENABLE_TOOL_LOOP` | `true` | Enables the harness tool loop path |
| `AGENT_HARNESS_ENABLE_WRITE_TOOLS` | `false` or absent | Blocks write/delete tool registration |
| `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` | `false` or absent | Blocks validation tool registration |
| `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` | `false` or absent | Blocks browser smoke tool registration |

Additional environment requirements for execution:
- `REDIS_URL` must be set (worker processor requires it).
- AI provider credentials must be configured only if Keith approves real provider calls.
- Any entitlement/harness access flag required by the existing system must be explicitly documented during execution planning.

---

## 7. Forbidden Environment Flags / States

The following states are forbidden during canary execution:

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

## 8. Allowed Tool Set

Only the following tools may be registered and dispatched during the canary:

| Tool | Risk Level | Requires Approval | Category |
|------|-----------|-------------------|----------|
| `list_files` | low | no | workspace/read-only |
| `read_file` | low | no | workspace/read-only |

---

## 9. Blocked Tool Set

The following tools must NOT be registered or dispatched during the canary:

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

---

## 11. Required Test Workspace Contents

```
workspace/
├── README.md
└── docs/
    └── notes.md
```

**README.md** content (example):
```markdown
# Test Workspace

This is a simple test workspace for the Agent Harness read-only canary.

Created: 2026-07-06
Purpose: Verify read-only tool loop execution.
```

**docs/notes.md** content (example):
```markdown
# Notes

This file contains test notes for the canary workspace.

- Item A
- Item B
- Item C
```

---

## 12. Exact Canary Prompt / Request

The following prompt must be used for the canary execution. It must be reviewed and approved by Keith before use.

```
Use the available tools to list the workspace files, read README.md, and summarize the contents. Do not modify files. Do not run commands. Do not use browser tools.
```

This prompt:
- Exercises `list_files` (workspace root).
- Exercises `read_file` (README.md).
- Requests a summary (validates model produces output).
- Explicitly prohibits modification, commands, and browser tools.
- Is deterministic enough to verify against known workspace content.

---

## 13. Expected Route Evaluation

The worker processor will emit a structured `agent_harness.route_evaluated` log:

```json
{
  "event": "agent_harness.route_evaluated",
  "executionId": "<test-execution-id>",
  "harnessVersion": "v1",
  "enableToolLoop": true,
  "selectedPath": "harness"
}
```

Expected conditions:
- `harnessVersion` is `"v1"` (set on the job/request).
- `enableToolLoop` is `true` (canary environment flag).
- `selectedPath` is `"harness"` (both conditions met).
- Adapter `supportsToolUse` is `true` and `executeWithTools` exists.

---

## 14. Expected Tool Calls

| # | Tool | Arguments (approximate) | Purpose |
|---|------|------------------------|---------|
| 1 | `list_files` | `{ "path": "." }` or `{ "path": "/" }` or `{}` | List workspace root files |
| 2 | `read_file` | `{ "path": "README.md" }` | Read README content |
| 3 | (optional) `read_file` | `{ "path": "docs/notes.md" }` | Model may optionally read additional file |

Expected constraints:
- No `write_file` call.
- No `delete_file` call.
- No `run_validation` call.
- No `browser_smoke` call.
- No unregistered tool call.
- Total tool calls: 2–3.

---

## 15. Expected Audit Events

The following audit events should be emitted in sequence:

| # | Event Type | Key Fields |
|---|-----------|------------|
| 1 | `harness.loop_started` | `maxToolIterations: 3`, `maxToolResultBytes: 262144`, `toolTimeoutMs: 30000` |
| 2 | `harness.model_invocation_started` | `iteration: 1` |
| 3 | `harness.model_invocation_completed` | `iteration: 1`, `toolCallCount: >=1`, `finishReason: 'tool_use'` or similar |
| 4 | `harness.tool_dispatch_started` | `toolName: 'list_files'` |
| 5 | `harness.tool_dispatch_completed` | `toolName: 'list_files'`, `resultBytes: >0` |
| 6 | `harness.tool_dispatch_started` | `toolName: 'read_file'` |
| 7 | `harness.tool_dispatch_completed` | `toolName: 'read_file'`, `resultBytes: >0` |
| 8 | `harness.model_invocation_started` | `iteration: 2` (model processes tool results) |
| 9 | `harness.model_invocation_completed` | `iteration: 2`, `toolCallCount: 0`, `finishReason: 'stop'` or `'end_turn'` |
| 10 | `harness.loop_completed` | `totalToolCalls: >=2`, `terminationReason: 'completed'` |

Privacy invariants for all audit events:
- No `prompt` field.
- No `output` field.
- No `content` field.
- No `toolArguments` field.
- No `toolResult` field (only `resultBytes`).
- No full file content.

If the model requests a blocked or unknown tool:
- `harness.tool_dispatch_failed` is emitted with error message (not content).
- This is acceptable but not expected given the prompt.

---

## 16. Expected Final Result

- Assistant produces a text summary of the workspace files and README content.
- No files are created, modified, or deleted in the workspace.
- No commands are executed.
- No browser is opened.
- No database side effects occur.
- No provider side effects beyond the approved model call(s) if provider use is approved.
- Execution status in ledger: `completed`.
- Stream publishes completion event.

---

## 17. Success Criteria

All of the following must be true for the canary to be considered successful:

- [ ] Harness path selected (`selectedPath: 'harness'`).
- [ ] Only `read_file` and `list_files` are registered in the dispatcher.
- [ ] `read_file` dispatched successfully (non-error result).
- [ ] `list_files` dispatched successfully (non-error result).
- [ ] No `write_file` dispatch occurred.
- [ ] No `delete_file` dispatch occurred.
- [ ] No `run_validation` dispatch occurred.
- [ ] No `browser_smoke` dispatch occurred.
- [ ] Audit events emitted (all expected events present in logs).
- [ ] Audit events contain no sensitive content (no prompt/output/file content/tool args/tool results).
- [ ] Final assistant answer is correct enough for the test README (references workspace files).
- [ ] No unexpected errors or unhandled exceptions.
- [ ] No files changed in workspace after execution.
- [ ] Execution ledger status is `completed`.
- [ ] Environment flags match plan at time of execution.

---

## 18. Failure Criteria

Any of the following constitutes canary failure:

- Any `write_file` dispatch (started or completed).
- Any `delete_file` dispatch (started or completed).
- Any `run_validation` dispatch (started or completed).
- Any `browser_smoke` dispatch (started or completed).
- Any file mutation in the workspace.
- Any command execution.
- Any production or costly/unapproved provider call.
- Missing `agent_harness.route_evaluated` log.
- Missing `harness.loop_started` or `harness.loop_completed` audit event.
- Sensitive content leaked into audit events (prompt text, model output, file content, tool arguments, full tool results).
- Unhandled exception during harness loop.
- Unknown tool dispatch not controlled (no error response from dispatcher).
- Environment flags not matching plan at execution time.
- Execution ledger status is not `completed` (e.g. `failed`, `timeout`).

---

## 19. Abort / Stop Conditions

Immediately stop the canary if any of the following occur:

- Wrong environment detected (production, shared, or non-dedicated).
- Wrong flags detected (`enableWriteTools`, `enableValidationTools`, or `enableBrowserSmoke` is `true`).
- Tool set includes `write_file`, `delete_file`, `run_validation`, or `browser_smoke`.
- Production data present in workspace.
- Provider/API call not approved by Keith.
- Unexpected file mutation detected.
- Unexpected runtime error or crash.
- Audit event contains prompt content, model output, or file content.
- Execution hangs beyond `EXECUTION_TIMEOUT_MS` without timeout handler triggering.

---

## 20. Rollback Procedure

If a canary failure or abort condition occurs:

1. **Stop dev/worker processes** immediately (kill the `ai-service` process).
2. **Reset env flags to safe defaults:**
   - Remove or set `AGENT_HARNESS_ENABLE_TOOL_LOOP=false`.
   - Verify `AGENT_HARNESS_ENABLE_WRITE_TOOLS` is `false` or absent.
   - Verify `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` is `false` or absent.
   - Verify `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` is `false` or absent.
3. **Verify no flags remain active** by inspecting env/config before restart.
4. **If workspace mutation occurred unexpectedly:**
   - Discard the dedicated test workspace entirely.
   - Or revert using checkpoint if applicable and safe.
5. **Record incident in final canary report** with details of what failed and when it was stopped.
6. **Do not restart the canary** without investigating the failure cause.
7. **Report to Keith** before any retry.

---

## 21. Observability Checklist

Before, during, and after canary execution, capture:

| # | Item | When |
|---|------|------|
| 1 | `agent_harness.route_evaluated` log | During execution |
| 2 | All `harness.*` audit events | During execution |
| 3 | Tool dispatch events (started/completed/failed) | During execution |
| 4 | Final assistant result text (summary only, not full output stored in audit) | After execution |
| 5 | Worker process logs (full) | During execution |
| 6 | Registered tool set in dispatcher (before loop) | Before execution |
| 7 | Environment flags snapshot | Before execution |
| 8 | Workspace file listing (before and after) | Before and after |
| 9 | Execution ledger record status | After execution |
| 10 | No sensitive content in any captured log | After execution (verification) |

---

## 22. Privacy / Data Safety Checklist

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

## 23. Manual Approval Steps

The following approvals must be obtained from Keith **before** the future execution task (AGENT-HARNESS-06C) may proceed:

| # | Approval Item | Approved By | Status |
|---|---------------|-------------|--------|
| 1 | This canary plan document reviewed and accepted | Keith | Pending |
| 2 | Canary environment choice (local dev vs isolated) | Keith | Pending |
| 3 | Provider choice (real provider vs stub adapter) | Keith | Pending |
| 4 | Exact canary prompt approved | Keith | Pending |
| 5 | Environment flags confirmed | Keith | Pending |
| 6 | Execution window approved (when to run) | Keith | Pending |
| 7 | Final canary report reviewed after execution | Keith | Pending |

---

## 24. Operator Runbook

### Pre-Execution Checklist (Future Task Only)

1. Confirm this plan document is approved by Keith.
2. Confirm environment is non-production and dedicated.
3. Create or verify test workspace with known content (section 11).
4. Create or verify dedicated test user and test session.
5. Set environment flags:
   - `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`
   - `AGENT_HARNESS_ENABLE_WRITE_TOOLS` absent or `false`
   - `AGENT_HARNESS_ENABLE_VALIDATION_TOOLS` absent or `false`
   - `AGENT_HARNESS_ENABLE_BROWSER_SMOKE` absent or `false`
6. Verify provider/stub configuration matches Keith's approval.
7. Verify Redis is running and `REDIS_URL` is set.
8. Verify PostgreSQL is running (if ledger updates are needed).
9. Start AI service worker.
10. Capture workspace file listing (before).
11. Capture environment flags snapshot.
12. Confirm dispatcher has only `read_file` and `list_files` registered.

### During Execution

13. Submit canary job with:
    - `harnessVersion: 'v1'`
    - `provider: <approved provider>`
    - `prompt: <exact approved prompt>`
    - Test session ID
    - Test workspace context (minimal file paths)
14. Monitor worker logs in real-time.
15. Watch for abort conditions (section 19).
16. If abort condition detected, execute rollback (section 20).

### Post-Execution Checklist

17. Capture workspace file listing (after) — compare with before.
18. Capture all worker logs.
19. Capture all audit events.
20. Verify execution ledger status is `completed`.
21. Verify no files were mutated.
22. Verify audit events match expected sequence (section 15).
23. Verify no sensitive content in logs or audit.
24. Verify final assistant response references workspace files.
25. Reset environment flags (remove `AGENT_HARNESS_ENABLE_TOOL_LOOP=true`).
26. Confirm flags are reset.
27. Produce final canary report (section 25).

**Important:** Do not execute any of the above steps during this planning task. These steps are for the future execution task (AGENT-HARNESS-06C) only.

---

## 25. Final Canary Report Requirements

After canary execution (future task), the final report must include:

| # | Report Item |
|---|-------------|
| 1 | Environment used (local dev / isolated test) |
| 2 | Flags used (exact env variable values) |
| 3 | Prompt used (exact text) |
| 4 | Session ID and workspace used |
| 5 | Tools registered in dispatcher |
| 6 | Tool calls observed (name, order, success/failure) |
| 7 | Audit events observed (full event type list) |
| 8 | Final assistant result (summary, not full text in audit) |
| 9 | Success or failure determination |
| 10 | Any unexpected behavior observed |
| 11 | Whether safe to proceed to next canary stage |
| 12 | Confirmation that flags were reset after execution |
| 13 | Confirmation that environment was shut down or returned to safe state |
| 14 | Workspace integrity verification (no mutations) |

---

## 26. Runtime Execution Task Boundary

**This task (AGENT-HARNESS-06B) creates the plan only.**

Actual canary execution must be a separate task:

- **Proposed ID:** AGENT-HARNESS-06C — Read-Only Harness Canary Execution
- **Prerequisites:** This plan document approved by Keith.
- **Requires:** Keith's explicit approval before any runtime/provider/dev-server command.
- **Scope:** Execute one canary session using the plan defined here. Produce the final canary report.
- **Non-scope:** No new tooling, no source changes beyond what execution requires, no frontend changes.

Until AGENT-HARNESS-06C is explicitly registered and approved:
- `AGENT_HARNESS_ENABLE_TOOL_LOOP` must remain `false` or absent.
- No dev server should be started for canary purposes.
- No provider calls should be made for canary purposes.

---

## 27. Open Questions / Deferred Decisions

| # | Question | Notes |
|---|----------|-------|
| 1 | Real provider vs stub adapter for execution? | Keith to decide. Stub avoids external cost/risk. Real provider proves end-to-end. |
| 2 | Local dev vs isolated test environment? | Local dev is simplest. Isolated is safer. Keith to decide. |
| 3 | Exact test session creation method? | API call? Direct DB insert? Depends on environment choice. |
| 4 | Does Keith want to perform manual browser/log inspection? | Affects execution window and operator procedure. |
| 5 | Should canary use real provider tool calling or stub adapter first? | Stub-first is safer; real-provider-first proves more. |
| 6 | Exact AI provider/model for canary? | Affects cost and behavior. Smaller/cheaper model preferred for first canary. |
| 7 | How to handle model requesting blocked tool? | Current dispatcher returns error for unregistered tools. Confirm this behavior is tested. |

---

## 28. Acceptance Criteria

Planning acceptance criteria (mirrors TASKS.md):

- [x] Canary plan document created.
- [x] Canary objective defined (section 2).
- [x] Canary environment requirements defined (section 5).
- [x] Env flag requirements defined (section 6).
- [x] Allowed read-only tool set defined (section 8).
- [x] Blocked tool set defined (section 9).
- [x] Test session/workspace requirements defined (sections 10–11).
- [x] Exact canary prompt/request defined (section 12).
- [x] Expected audit events defined (section 15).
- [x] Success criteria defined (section 17).
- [x] Failure criteria defined (section 18).
- [x] Rollback procedure defined (section 20).
- [x] Observability checklist defined (section 21).
- [x] Manual approval steps defined (section 23).
- [x] Final report requirements defined (section 25).
- [x] Runtime activation deferred to separate explicit execution task (section 26).

---

## Document End

**AGENT-HARNESS-06B — Read-Only Harness Canary Plan — Planning document complete. Runtime activation deferred.**
