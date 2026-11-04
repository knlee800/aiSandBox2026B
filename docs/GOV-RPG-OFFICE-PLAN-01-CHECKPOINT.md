# GOV-RPG-OFFICE-PLAN-01 — Checkpoint

**Task:** GOV-RPG-OFFICE-PLAN-01 — Plan the RPG office
**Status:** COMPLETE AND LOCKED — 2026-11-05
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** RPG-OFFICE-01 (reset order step 5). Keith approved planning on 2026-11-05 and approved the plan on 2026-11-05.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Registration | registered with HARNESS-REOPEN-01 | 9add6450b2192b2c912ac49d6d48b58741ff3080 |
| Close | the plan document, this checkpoint, the registrations below | this record |

## How the plan was made

Fable 5.1 drafted it through Cursor in read-only mode (requested claude-fable-5-1-thinking-high, resolved "Claude Fable 5.1 300K High"). The control plane checked its claims about the code and found them correct, apart from one line reference off by one, and one gap: durations are never recorded. Keith asked for the control plane's comments; the edits are marked [CP edit] in docs/RPG-OFFICE-01-PLAN.md: two prerequisites before the first slice, one approval flow, polling in slice 1, a Team desk for collaboration runs, Chinese terms aligned with the existing message files, and simple art until the art source is decided. Keith chose office slice 1 first, with GOV-COLLAB-PLAN-01 written alongside. His approval covers the plan's open decisions as recommended: a new office route, a header link from the platform screen, simple in-house art for now, a Former agents desk, accepting "Stopping" inferred from the active list, and the global recent limit of 50.

## Registered by this record

| Task | State |
|---|---|
| USAGE-DURATION-01 | ADMITTED, Lane 1, AI-SERVICE |
| RUN-LIST-COLLAB-01 | ADMITTED, Lane 2, GATEWAY |
| OFFICE-01 | READY, startCondition NOT_READY until both prerequisites are locked; APPROVED_FUTURE with futureAuthorization AUTHORIZED |
| GOV-COLLAB-PLAN-01 | started (ACTIVE, governance, no lane) |

USAGE-DATA-01 item 1 is superseded by USAGE-DURATION-01.

## Dispositions

| Follow-up named in the plan | Disposition |
|---|---|
| First slice | registered: OFFICE-01 |
| Duration never recorded | registered: USAGE-DURATION-01 |
| Collaboration runs shown as Builder runs | registered: RUN-LIST-COLLAB-01 |
| OFFICE-02 push updates, OFFICE-03 characters, OFFICE-04 animation, OFFICE-05 collaboration in the office, OFFICE-06 run detail, OFFICE-07 cancel from the office | registered as items of RPG-OFFICE-01 (6) |
| Optional agentId filter on the run list | registered as an item of RPG-OFFICE-01 |
| Real art source, decided before OFFICE-03 | registered as an item of RPG-OFFICE-01 |
| "Open workspace" goes to the run's session | registered as an item of RPG-OFFICE-01 |
| Deploy and Keith's browser check of OFFICE-01 | registered as an item of RPG-OFFICE-01 |

FOLLOWUPS: 13 registered / 0 superseded / 0 dropped / 0 undisposed

## Not changed

PRD.md and ARCHITECTURE.md. RPG-OFFICE-01 stays APPROVED_FUTURE and NOT_READY as the umbrella; only OFFICE-01 is authorized.

## Lock

COMPLETE AND LOCKED on 2026-11-05 by the control plane. GOVERNANCE UNOWNED.
