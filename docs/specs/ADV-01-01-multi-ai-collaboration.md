# Spec: ADV-01-01 — Multi-AI Collaboration

## 1. Spec Header

| Field | Value |
|-------|-------|
| **Spec ID** | ADV-01-01 |
| **Title** | Multi-AI Collaboration |
| **Status** | Draft |
| **Master plan alignment** | Section 7.6 ADV-01, Phase 6 |
| **Related task IDs** | None yet registered |
| **Depends on** | AI-03-01/02 (core AI-to-workspace loop complete), AI-04-01 (chat persistence) |
| **Enables** | AI-to-AI discussion, specialized agent delegation |

---

## 2. Problem

The platform currently supports a single AI model per execution. Some tasks benefit from multiple AI models collaborating — e.g., one model generates code while another reviews it.

---

## 3. Why This Matters

The master plan Section 7.6 lists this as a future expansion area. It extends the AI-first workspace by allowing multiple models to contribute to the same workspace, potentially improving output quality.

---

## 4. Goal

Allow multiple AI models to participate in the same workspace session, with clear turn management and result attribution.

---

## 5. Non-Goals

- No autonomous AI-to-AI discussion without user involvement
- No broad agent orchestration framework (that is ADV-02-01)
- No model marketplace
- No custom model hosting
- Must not displace core single-AI workflow

---

## 6. Existing Relevant Completed Work to Preserve

- Single-AI execution pipeline (ai-service with multiple adapters)
- Chat panel behavior
- AI-to-workspace file actions (AI-03-01/02 dependency)
- Session isolation

---

## 7. Scope

1. User can select which AI model(s) to use for a prompt
2. Multiple models can produce responses to the same prompt
3. Each model's response is attributed clearly in the chat thread
4. File actions from different models are applied sequentially
5. User controls which model(s) are active

---

## 8. Functional Requirements

1. Model selection UI in chat panel
2. Execution routing to selected model(s) via existing adapter system
3. Response attribution per model in chat thread
4. Sequential application of file actions from multiple models
5. Token usage tracked per model

---

## 9. UX Requirements

1. Model selector in chat panel (dropdown or toggle)
2. Clear model attribution on each response
3. User can switch models between prompts
4. No mandatory multi-model usage — single model remains default

---

## 10. Backend Requirements

1. Execution endpoint accepts model selection parameter
2. Multiple executions can be triggered for the same prompt (one per model)
3. Token usage tracked per model per execution
4. No new entities required for basic multi-model support

---

## 11. Frontend Requirements

1. Model selector component
2. Response attribution in chat thread
3. Multi-model response rendering (sequential, not overlapping)

---

## 12. Data/State Expectations

- Model selection stored per-prompt or per-session
- Token usage records include model identifier
- No new database entities for basic multi-model support

---

## 13. Error Handling Requirements

1. If one model fails, others can still succeed — partial results shown
2. Model unavailable → clear error, fallback to default model option

---

## 14. Acceptance Criteria

- [ ] User can select AI model for a prompt
- [ ] Multiple models can respond to the same prompt
- [ ] Responses are clearly attributed per model
- [ ] Token usage is tracked per model
- [ ] Single-model workflow remains default and functional
- [ ] Core workspace behavior preserved

---

## 15. Invariants to Preserve

- Single-AI workflow as default
- Session isolation
- Auth/quota enforcement
- AI-to-workspace file action semantics

---

## 16. Dependencies

| Dependency | Status | Required For |
|-----------|--------|-------------|
| AI-03-01/02 | Planned | AI-to-workspace loop must work first |
| AI-04-01 | Planned | Chat persistence for multi-model threads |
| Multiple AI adapters | Complete | Model routing |

---

## 17. Risks / Edge Cases

- Conflicting file actions from different models need resolution strategy
- Cost implications of multi-model execution
- Token quota consumption multiplied by model count

---

## 18. Suggested Implementation Slices

1. **Backend: Model selection parameter in execution** — Accept model choice, route to correct adapter.
2. **Frontend: Model selector UI** — Dropdown in chat panel.
3. **Frontend: Response attribution** — Label responses with model name.
4. **Multi-model execution** — Allow parallel or sequential multi-model responses.

---

## 19. Explicit Out-of-Scope Follow-Up Items

- Autonomous AI-to-AI discussion
- Model comparison/evaluation UI
- Custom model fine-tuning
- Model recommendation engine
