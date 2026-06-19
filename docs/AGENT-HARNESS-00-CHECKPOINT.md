# AGENT-HARNESS-00 Checkpoint

**Task ID:** AGENT-HARNESS-00
**Title:** Agent Harness v1 Master Plan
**Status:** COMPLETE and LOCKED
**Locked:** 2026-06-19
**Family:** AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS
**Nature:** ARCHITECTURE / PRODUCT SYSTEM DESIGN / GOVERNANCE

---

## Files Changed Across AGENT-HARNESS-00

| File | Change Type |
|------|-------------|
| `C:\Users\knlee\aiSandBox2026B\TASKS.md` | Registration (task entry added) + COMPLETE/LOCKED status update |
| `C:\Users\knlee\aiSandBox2026B\TASKS_BACKLOG_FULL.md` | Registration (task entry added) + COMPLETE/LOCKED status update |
| `C:\Users\knlee\aiSandBox2026B\docs\AGENT-HARNESS-V1-MASTER-PLAN.md` | Created (planning/investigation output — documentation only) |
| `C:\Users\knlee\aiSandBox2026B\docs\AGENT-HARNESS-00-CHECKPOINT.md` | Created (this checkpoint document) |

**No source, runtime, test, or package/dependency files were changed.**

---

## Registration Output Summary

AGENT-HARNESS-00 was registered in `TASKS.md` and `TASKS_BACKLOG_FULL.md` under the family:

> AGENT HARNESS / TOOL PROTOCOL / MODEL ADAPTERS

Registration documented:
- Task ID, family, status, priority, nature, risk
- Problem statement: aiSandbox needs a professional agent harness bridging single-shot AI execution to plan → edit safely → run tests → fix → diff → checkpoint
- Objective: design the v1 architecture and split into safe bounded implementation slices
- Full scope and non-goals
- Candidate child slices (not yet registered): 01–07
- UX/UI multilingual-first governance note for future child slices
- Expected planning pass output: `docs/AGENT-HARNESS-V1-MASTER-PLAN.md`

---

## Investigation Output Summary

A codebase investigation pass was conducted prior to master plan creation, inspecting:

- `services/ai-service/src/ai-execution/` — execution flow, adapter layer, types, prompt assembly
- `services/ai-service/src/worker/` — WorkerProcessor, BullMQ job handling
- `services/ai-service/src/streaming/` — Redis SSE publisher
- `services/ai-service/src/queue/` — job types and queue config
- `services/ai-service/src/ai-execution/adapters/` — Anthropic, OpenAI, Groq, xAI, DeepSeek, Stub adapters
- `services/api-gateway/` — guard chain, session gates, file CRUD proxy
- `services/container-manager/` — DockerRuntimeService, workspace file operations, checkpoint creation
- `frontend/` — file-action apply flow, risky-batch confirmation, apply-once guard, post-apply coherence, checkpoint list, preview system
- Existing checkpoint docs: AI-CONTEXT, PREVIEW, APP-ROUTE-RESTORE families

Key findings confirmed:
- Current AI execution: single-shot, non-streaming, text parsed for file-actions
- LOCKED types exist: `AIExecutionRequest`, `AIExecutionResult`, `AIProviderConfig` in `services/ai-service/src/ai-execution/types.ts`
- Per-request model selection bug: `getAdapter()` ignores `request.model`, uses adapter `defaultModel`
- Prompt assembly buried in `WorkerProcessor` — not externalized
- No pre-apply checkpoint; no rollback on failed partial apply
- ARCHITECTURE.md documents SQLite + HTTP-only while code uses PostgreSQL + BullMQ/Redis (drift, not a bug to fix here)
- Two preview subsystems coexist (static HTML + dev-server proxy)

---

## Master Plan Coverage Summary

`docs/AGENT-HARNESS-V1-MASTER-PLAN.md` covers all seven areas from the task objective:

| Area | Sections Covered |
|------|-----------------|
| Tool protocol and model adapter layer | §4 (architecture layers), §8 (model adapter strategy), §9 (tool protocol strategy) |
| Repo indexing and semantic/code search | §12 (phased: lexical → chunking → semantic) |
| Patch/apply engine with checkpoint rollback | §13 (phased: safe contracts → pre-apply checkpoint → atomic rollback → diff/patch) |
| Validation runner | §14 (allow-list only, execution model, feed-back loop) |
| Browser smoke tool | §15 (investigation-first, manual fallback, future automation) |
| Plan/review UI | §16 (multilingual-first, Heroicons v2, advisory skills, UI components list) |
| Continuous evals | §17 (eval task format, scoring dimensions, regression tracking, CI integration) |

Additional master plan content:
- §2: Current architecture baseline (execution flow, prompt/context flow, file-action/apply flow, workspace file flow, checkpoint/revert flow, preview flow)
- §3: Existing reusable foundations table (22 entries)
- §4: Target architecture diagram (layered architecture including Agent Harness Orchestrator)
- §5: Cursor rules/subagent integration model — strict/lite lane policy, subagent bounds
- §6: No-hardcoding/future-changeability strategy (model profiles, tool registry, prompt templates, policy config, contract versioning, child slice pattern)
- §7: Contract strategy — LOCKED types, parallel contracts, bridge strategy
- §10: Prompt template strategy (4 modes, assembly order, model-profile-aware adjustments)
- §11: Policy/config strategy (AgentHarnessPolicy shape, no-arbitrary-shell rule)
- §18: Child slice roadmap — 9 sub-slices (AGENT-HARNESS-01A through 07A) with full scope, non-goals, likely files, validation requirements, dependencies, strict/lite lane, changeability notes
- §19: Non-goals for Agent Harness v1 (14 explicit non-goals)
- §20: Risks and mitigations (architecture, security, subagent-specific, UX/UI risks)
- §21: Recommended next step: register AGENT-HARNESS-01A

---

## Governance Confirmations

- **Documentation/governance only:** This task was entirely documentation and governance work. No implementation was performed.
- **No source/runtime/test/package files changed:** Confirmed. Only `docs/`, `TASKS.md`, and `TASKS_BACKLOG_FULL.md` were modified.
- **No implementation done:** Confirmed. No code was written or modified.
- **ARCHITECTURE.md drift documented as risk, not fixed:** Confirmed. See §20.1 (Architecture Risks, first row): "ARCHITECTURE.md drift: says SQLite + HTTP-only, while current code uses PostgreSQL + BullMQ/Redis." Documented as risk with mitigation: "recommend a future architecture-reconciliation slice. Do NOT fix in Agent Harness slices."
- **LOCKED execution types migration strategy documented:** Confirmed. See §7: Contract Strategy. LOCKED types (`AIExecutionRequest`, `AIExecutionResult`, `AIProviderConfig`) must not be mutated. New parallel contracts (`AgentHarnessRequest`, `AgentHarnessResult`, etc.) are defined in a new file. Bridge strategy via `harnessVersion` field in job data maintains backward compatibility.
- **No-hardcoding/future-changeability strategy documented:** Confirmed. See §6: Changeability / No-Hardcoding Architecture — covers adding models (6.1), registering tools (6.2), changing prompt templates (6.3), updating policy config (6.4), adding contract versions (6.5), and adding child slices (6.6).
- **UX/UI multilingual governance documented for future UI slices:** Confirmed. See §16.1 (Multilingual-First) and §20.4 (UX/UI Risks). All new user-facing text must update `frontend/messages/en.json`, `frontend/messages/zh-TW.json`, `frontend/messages/zh-CN.json`. Use Heroicons v2 Outline only.

---

## Acceptance Criteria Review

| Criterion | Status |
|-----------|--------|
| `docs/AGENT-HARNESS-V1-MASTER-PLAN.md` created | PASS |
| Master plan covers all 7 areas from task objective | PASS |
| Current architecture baseline documented | PASS |
| Existing reusable foundations documented | PASS |
| Child slice roadmap with bounded sub-slices (01A–07A) | PASS |
| LOCKED types migration strategy documented | PASS |
| No-hardcoding/future-changeability strategy documented | PASS |
| UX/UI multilingual governance documented | PASS |
| ARCHITECTURE.md drift documented as risk, not fixed | PASS |
| Recommended next step documented (§21) | PASS |
| No source/runtime/test/package files changed | PASS |
| No implementation done | PASS |
| No checkpoint created before consolidation | PASS (this is the checkpoint) |
| No git commit/push steps included | PASS |

---

## Validation

This task was documentation and governance only. No frontend, backend, test, or package files were changed.

- No markdown lint command exists in this repository. Manual document review was performed.
- Manual review of `docs/AGENT-HARNESS-V1-MASTER-PLAN.md`: document is complete, well-structured, internally consistent. All 21 sections and §18 child slice roadmap entries are present and coherent.
- Manual review of `docs/AGENT-HARNESS-00-CHECKPOINT.md` (this file): confirms task was documentation/governance only.
- No frontend/backend builds or tests were run because no source/runtime/test files were changed.

---

## Next Recommended Task

**AGENT-HARNESS-01A — Per-Request Model Selection Fix registration**

This is the smallest, safest, most bounded first implementation slice:
- Fixes: `AIExecutionService.getAdapter()` passes `request.model` to adapter constructors when present.
- Scope: `services/ai-service/src/ai-execution/ai-execution.service.ts` + unit test.
- No model profile registry yet. No tool-use changes. No prompt changes. No contract changes.
- Strict-lane work. Security review recommended.
- Dependencies: none.

The next step is to **register** AGENT-HARNESS-01A in `TASKS.md` and `TASKS_BACKLOG_FULL.md`. Do not implement until registration is complete.

---

## Master Plan Reference

`C:\Users\knlee\aiSandBox2026B\docs\AGENT-HARNESS-V1-MASTER-PLAN.md`
