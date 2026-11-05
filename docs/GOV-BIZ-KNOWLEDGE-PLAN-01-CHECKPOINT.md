# GOV-BIZ-KNOWLEDGE-PLAN-01 — Checkpoint

**Task:** GOV-BIZ-KNOWLEDGE-PLAN-01 — Plan the knowledge base and the business agents together
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** Keith decided on 2026-11-05 that business agents stay a goal and asked to plan both; Keith approved the plan on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration | planning task registered | b372496a2670f511b3d3891ee1d3f96cc7a603b7 |
| Close | the plan document, this checkpoint, the registrations below | this record |

## How the plan was made

Fable 5.1 drafted docs/AGENT-BIZ-KNOWLEDGE-PLAN.md through Cursor in read-only mode (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High"). The control plane checked its claims against the code and found them correct, and added two corrections: KNOW-02 changes the frozen shared contract HARNESS_ENTITLEMENT_PROOF_V1 and must run alone under the contract-change protocol; ARCHITECTURE.md still lists persisted referrals as FUTURE. Keith approved the plan with both corrections and its recommended decisions: documents in PostgreSQL, knowledge per account, Chief of Staff first, Harness tools rather than prompt context, no charge for storage with summaries charged later, a Chief of Staff run starts from an open project, a team field on the start route, and PRD changes only after the live check.

## Registered by this record

| Task | State |
|---|---|
| KNOW-01 to KNOW-04 | children of AGENT-KNOWLEDGE-01; READY, startCondition NOT_READY; APPROVED_FUTURE with futureAuthorization AUTHORIZED; KNOW-01 has its write set, the others are PROVISIONAL |
| BIZ-01, BIZ-LIVE-01, BIZ-02, BIZ-03 | children of AGENT-COLLAB-BIZ-01; same states, PROVISIONAL |
| BIZ-NOPROJECT-01 | READY, startCondition NOT_READY, PROVISIONAL |
| GOV-ARCH-SYNC-01 | governance documentation correction for ARCHITECTURE.md, not started |

All saturationClass OPTIONAL. Nothing admitted.

## Dispositions

| Follow-up named in the plan or review | Disposition |
|---|---|
| The eight slices KNOW-01 to KNOW-04, BIZ-01, BIZ-LIVE-01, BIZ-02, BIZ-03 | registered (8) |
| Project-less business runs | registered: BIZ-NOPROJECT-01 |
| Stale ARCHITECTURE row for persisted referrals | registered: GOV-ARCH-SYNC-01 |
| Enforcing plan entitlements for knowledge items | registered: ACCESS-READY-01 item 7 |
| Legal Advisor role, scope and registry entry | registered: kept in AGENT-COLLAB-BIZ-01, ready only after BIZ-03 and a PRD change Keith approves |
| Work objects, the contract scenario, approval categories | registered: kept in AGENT-COLLAB-BIZ-01, ready when Keith approves a first external action |
| Scope-ID parity test between frontend and gateway | superseded by a KNOW-01 acceptance criterion |
| Prompt-pack injection, key facts, chunking, vectors, connectors, scheduled refresh, sensitive-scope review | dropped by Keith for now: not needed by a read-only Chief of Staff |
| Knowledge per project | dropped by Keith: plan decision 2 |

FOLLOWUPS: 13 registered / 1 superseded / 2 dropped / 0 undisposed

## Not changed

PRD.md and ARCHITECTURE.md (the ARCHITECTURE correction is GOV-ARCH-SYNC-01). AGENT-KNOWLEDGE-01 and AGENT-COLLAB-BIZ-01 stay APPROVED_FUTURE and NOT_READY as umbrellas.

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. GOVERNANCE UNOWNED.
