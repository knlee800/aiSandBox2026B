# GOV-COLLAB-PLAN-01 — Checkpoint

**Task:** GOV-COLLAB-PLAN-01 — Update the AGENT-COLLAB-00 plan with what the COLLAB tasks built
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** registered by GOV-OS-05; started by Keith on 2026-11-05 alongside office slice 1.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Start | started with the RPG office plan record | b5494adbb40109a0ab5f4c9fc17ddc649083a02b |
| Close | the decision document, this checkpoint, the registrations and drops below | this record |

## How the decision was made

Fable 5.1 drafted docs/GOV-COLLAB-PLAN-01-DECISION.md through Cursor in read-only mode (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High"). The control plane checked its claims against the code and found them correct, and proposed one change: the in-memory daily spend counter becomes ACCESS-READY-01 item 6 instead of being treated as covered by item 1. Keith chose Option A on 2026-11-05: the built coding team (lead, writer, reviewer on the Team page) is the collaboration product; three small slices are registered; the business-agent remainder stays parked behind the knowledge base; plan parts the built design replaced are dropped. The locked AGENT-COLLAB-00 plan is not edited.

## Dispositions

| Follow-up | Disposition |
|---|---|
| Store audit and limit events | registered: COLLAB-AUDIT-01 |
| Edit the task before approving ("modify") | registered: COLLAB-EDIT-01 |
| Cancel from the Team page | registered: COLLAB-CANCEL-01 |
| Daily spend counter resets on restart | registered: ACCESS-READY-01 item 6 |
| AGENT-COLLAB-BIZ-01 scope | amended in its body: ready only after AGENT-KNOWLEDGE-01 is locked and Keith keeps business agents; modify moved to COLLAB-EDIT-01; defer and escalate dropped |
| Internal routes trust the key; caller-supplied decidedBy | dropped: internal callers only; the login route is owner-checked |
| A repeatable collaboration eval | dropped for now: one coding team and one user; revisit with ACCESS-READY-01 |
| Each agent re-reads files (token cost) | dropped: accepted while only Keith uses it |
| A rejected send-back counts as a round | dropped: minor, no observed effect |
| Referral types, extra statuses, IdempotencyRecord, per-agent and per-trigger limits, pause and resume, defer, escalate, timeout allow, registry-driven rules | dropped: replaced by the built design (decision document section 3) |
| Recovery live check | already dropped by GOV-OS-05 |

FOLLOWUPS: 4 registered / 0 superseded / 5 dropped / 0 undisposed

## Not changed

PRD.md and ARCHITECTURE.md. Business agents stay approved FUTURE in PRD.md.

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. GOVERNANCE UNOWNED.
