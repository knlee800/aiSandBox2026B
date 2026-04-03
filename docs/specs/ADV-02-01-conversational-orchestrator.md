# Spec: ADV-02-01 — Conversational Orchestrator

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | ADV-02-01 |
| **Title** | Conversational Orchestrator |
| **Status** | Draft |
| **Master plan alignment** | Section 7.6 ADV-02, Phase 6 |
| **Related task IDs** | None yet registered |
| **Depends on** | AI-03-01/02, AI-04-01 |
| **Enables** | Multi-step autonomous workflows, complex task decomposition |

---

## 2. Problem

The current AI execution model is single-turn: one prompt, one response, one set of file actions. Complex coding tasks often require multi-step reasoning, planning, and iterative file modifications.

---

## 3. Why This Matters

The master plan Section 7.6 lists this as a future expansion. An orchestrator allows the AI to break complex tasks into steps and execute them sequentially, improving the platform's ability to handle real coding projects.

---

## 4. Goal

Introduce a conversational orchestrator that can decompose complex prompts into multi-step AI execution sequences, with user visibility and control at each step.

---

## 5. Non-Goals

- No fully autonomous agent that runs without user awareness
- No execution of arbitrary system commands without user consent
- No replacement of the single-turn prompt flow (must coexist)
- Must not displace core Phases 1–5 work

---

## 6. Existing Relevant Completed Work to Preserve

- Single-turn AI execution pipeline
- Chat panel behavior
- AI-to-workspace file actions
- Checkpoint/revert for safety

---

## 7. Scope

1. Orchestrator accepts a complex prompt and decomposes into steps
2. Each step is a bounded AI execution (prompt → response → optional file actions)
3. User can see the plan and progress
4. User can pause, resume, or cancel the orchestration
5. Each step produces checkpoints for reversibility

---

## 8. Functional Requirements

1. Orchestrator receives user prompt and produces a step plan
2. Steps execute sequentially with AI execution pipeline
3. Each step's result is visible in chat thread
4. User can intervene between steps
5. Orchestrator state is session-scoped

---

## 9. UX Requirements

1. "Plan" view showing orchestration steps
2. Step-by-step progress in chat thread
3. Pause/resume/cancel controls
4. Clear indication of current step and remaining steps

---

## 10. Backend Requirements

1. Orchestrator service or module in ai-service
2. Step decomposition logic (may use AI for planning)
3. Sequential execution with inter-step state
4. Checkpoint creation after each step

---

## 11. Frontend Requirements

1. Orchestration plan display
2. Step progress indicators
3. Control buttons (pause/resume/cancel)
4. Step results in chat thread

---

## 12. Data/State Expectations

- Orchestration plan: list of steps with status
- Step state: pending, running, completed, failed, cancelled
- Session-scoped orchestration state

---

## 13. Error Handling Requirements

1. Step failure → stop orchestration, show error, allow retry or skip
2. User cancellation → clean stop, preserve completed work
3. Session termination during orchestration → graceful abort

---

## 14. Acceptance Criteria

- [ ] User submits complex prompt and sees a step plan
- [ ] Steps execute sequentially with visible progress
- [ ] User can pause/cancel orchestration
- [ ] Each step produces a checkpoint
- [ ] Single-turn prompt flow still works normally
- [ ] Core workspace behavior preserved

---

## 15. Invariants to Preserve

- Single-turn prompt flow as default
- Session isolation
- Checkpoint/revert safety
- Auth/quota enforcement (per step)

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| AI-03-01/02 | Planned | AI file actions per step |
| AI-04-01 | Planned | Chat persistence for multi-step threads |
| ADV-01-01 | Planned | Optional enhancement — multi-model orchestration; NOT a hard prerequisite |

---

## 17. Risks / Edge Cases

- Step decomposition quality depends on AI model capability
- Long orchestrations may hit session timeout
- Token consumption may be high for multi-step orchestrations
- Rollback mid-orchestration needs checkpoint-per-step

---

## 18. Suggested Implementation Slices

1. **Backend: Orchestrator module** — Step decomposition and sequential execution.
2. **Frontend: Plan view** — Display orchestration steps and progress.
3. **Frontend: Control actions** — Pause/resume/cancel.
4. **Auto-checkpoint per step** — Integrate with existing checkpoint system.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Fully autonomous agent without user oversight
- Custom orchestration templates
- Orchestration sharing/export
- Parallel step execution
