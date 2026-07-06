# AINOW-EXECUTION-ROADMAP — ainow.biz Execution Roadmap and Priority Guardrails

**Created:** 2026-07-06
**Task:** ROADMAP-00
**Status:** ACTIVE governance document
**Authority:** This document controls execution order. Product architecture remains governed by AGENT-PLATFORM-00.

---

## 1. Purpose

This document controls execution order, not product architecture.

Product architecture remains governed by `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md` (the master plan).

This document prevents priority drift across task families:
- Agent Harness
- Agent Platform
- Knowledge
- Collaboration
- Billing
- Beta preparation

It establishes the agreed sequence, guardrails, and rules for when that sequence may change.

---

## 2. Current Completed Foundation

| Task ID | Name | Status |
|---------|------|--------|
| AGENT-HARNESS-05C9 | Structured Harness Audit Events | COMPLETE and LOCKED |
| AGENT-PLATFORM-00 | ainow.biz Multi-Agent Platform Master Plan | COMPLETE and LOCKED |
| AGENT-PLATFORM-01 | Agent Registry Foundation | COMPLETE and LOCKED |
| AGENT-PLATFORM-02 | Static RPG Office/Town Dashboard Shell | COMPLETE and LOCKED |
| AGENT-PLATFORM-03 | Builder Agent Route Integration Review | COMPLETE and LOCKED |

---

## 3. Strategic Execution Sequence

| # | Task ID | Name | Status |
|---|---------|------|--------|
| 1 | AGENT-HARNESS-05C9 | Structured Harness Audit Events | COMPLETE |
| 2 | AGENT-PLATFORM-02 | Static RPG Office/Town Dashboard Shell | COMPLETE |
| 3 | AGENT-PLATFORM-03 | Builder Agent Route Integration Review | COMPLETE |
| 4 | AGENT-KNOWLEDGE-00 | Common Knowledge Base Architecture Plan | COMPLETE |
| 5 | AGENT-COLLAB-00 | Agent Referral and Collaboration Protocol Plan | NEXT |
| 6 | Next Agent Harness slice | TBD — decide after collaboration plan | After Collaboration plan |
| 7 | BILLING-READY-00 | Billing, Plan, Credit, and Entitlement Audit | After Knowledge + Collaboration |
| 8 | Beta preparation | Beta readiness checklist | After Billing audit |

---

## 4. Current Next Task

**AGENT-COLLAB-00 — Agent Referral and Collaboration Protocol Plan**

AGENT-KNOWLEDGE-00 is COMPLETE and LOCKED (2026-07-06). AGENT-COLLAB-00 is the next task to register and plan.

---

## 5. Task Family Ordering Rules

- Knowledge comes before Collaboration.
- Collaboration comes before deeper automation/integrations.
- Billing readiness comes after Knowledge and Collaboration plans are complete.
- Platform UI implementation should not outrun underlying architecture.
- Harness work can interrupt Platform work only when it protects execution safety.
- Only one ACTIVE task at a time unless Keith explicitly approves parallel work.

---

## 6. One Active Task Rule

Only one task may be ACTIVE at a time unless Keith explicitly approves parallel work.

If a second task needs attention urgently, the current ACTIVE task must be paused first. See section 7 for pause/resume rules.

---

## 7. Pause / Resume Rules

- If execution priority changes, pause the current ACTIVE task before registering another ACTIVE task.
- Resume paused tasks only after the interrupting task is COMPLETE and LOCKED.
- Record pause/resume reason in TASKS.md and TASKS_BACKLOG_FULL.md.
- Paused tasks retain their position in the sequence — they are not demoted or deprioritized unless Keith explicitly changes priority.

---

## 8. Drift Prevention Rules

- Do not jump to AGENT-COLLAB-00 before AGENT-KNOWLEDGE-00 unless Keith explicitly changes priority.
- Do not start Billing before Knowledge and Collaboration foundations are planned.
- Do not start external integrations before collaboration and approval gates are planned.
- Do not add new agent runtime behavior before registry, knowledge, collaboration, and approval models are defined.
- Do not activate Agent Harness tool loop unless a validated activation/canary task explicitly does so.
- Do not register or suggest tasks out of sequence without citing this document and recording the deviation reason.

---

## 9. When Priority May Change

Priority may change only for:

- Security/safety issue
- Data loss risk
- Broken build or production-blocking bug
- Harness execution flaw that blocks safe platform work
- Explicit Keith decision

Any priority change must be recorded: who changed it, why, when, and what the new next task is.

---

## 10. What Not To Start Yet

The following must not be started until their prerequisites in the strategic sequence are complete:

- Real Gmail/Slack/Notion integrations
- Legal Advisor implementation
- Stripe/payment integration
- Real multi-agent runtime orchestration
- Walking character/gameplay
- Production Agent Harness activation
- Database schema for collaboration or knowledge unless registered as a dedicated architecture/schema task

---

## 11. Near-Term Sequence

| # | Task | Nature |
|---|------|--------|
| 1 | ROADMAP-00 | This roadmap doc (governance only) |
| 2 | AGENT-KNOWLEDGE-00 | Register + planning doc |
| 3 | AGENT-COLLAB-00 | Register + planning doc |
| 4 | Next Harness slice | Decide after collaboration plan |
| 5 | BILLING-READY-00 | Audit/planning |

---

## 12. Medium-Term Sequence

- Knowledge ingestion architecture
- Work object schema planning
- Collaboration protocol implementation slices
- Approval gate implementation slices
- Platform UI improvements
- Agent Harness canary planning

---

## 13. Beta Readiness Sequence

- Billing/credits/entitlement readiness
- Usage limits
- Security/privacy review
- Browser smoke and UX validation
- Harness read-only canary
- Production activation checklist

---

## 14. Update Policy

- Update this roadmap only during explicit roadmap/governance tasks.
- Do not edit this roadmap inside unrelated implementation tasks.
- If priority changes, record who/why/when and the new next task.
- Keep it concise. It is a guide, not a full architecture plan.

---

## 15. Final Notes

- This document is a guardrail, not a straitjacket. Keith can change priority at any time with explicit recorded justification.
- The strategic sequence was agreed after drift occurred (AGENT-COLLAB-00 was suggested before AGENT-KNOWLEDGE-00). This document prevents recurrence.
- Architecture remains in `docs/AGENT-PLATFORM-00-AINOW-MULTI-AGENT-PLAN.md`.
- Active task ledger remains in `TASKS.md`.
- Master backlog remains in `TASKS_BACKLOG_FULL.md`.
- This document adds execution-order governance that those files do not provide.
