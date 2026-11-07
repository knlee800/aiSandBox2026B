# GOV-RSI-01 — Checkpoint

**Task:** GOV-RSI-01 — Record recursive self-improvement as long-term direction
**Status:** COMPLETE AND LOCKED — 2026-11-07
**Nature:** GOVERNANCE (no lane). **Lifecycle:** 1-RECORD (registered and locked together, GOV-OS-04).
**Source:** Keith's strategic direction of 2026-11-07 (ambition: intelligence of individual agents, collaboration and the platform; autonomy: human approval for every production change; scope: all, eventually the RSI mechanisms themselves), the control-plane readiness assessment, and Keith's approval of the S0 wording the same day.

## What changed

- PRD.md: section 2 Planned Goal "Recursive self-improvement (RSI)"; section 8 non-goal for the current phase; section 11 APPROVED FUTURE row.
- ARCHITECTURE.md: header sync line; section 13.1 row "Recursive self-improvement (RSI) — FUTURE / PLANNED"; new section 13.5 "Recursive Self-Improvement Compatibility (PLANNED constraint)": every capability change is a versioned artifact with an approval record, RSI produces only candidates; a protected set RSI may never change (authentication, guards, internal keys, signing, credits and billing, the kill switch, governance files and the validator, its evaluations, its approval gate, and the RSI mechanisms until Keith opens that stage); direction only for run provenance and one server-side agent definition source. It authorizes no refactor and selects no storage, scheduler or environment.
- TASKS_BACKLOG_FULL.md: GOV-RSI-01 (GOVERNANCE, locked) and RSI-00 (umbrella, NOT_READY, OPTIONAL, APPROVED_FUTURE / AUTHORIZED, PROVISIONAL) holding stages S1 to S8; an RSI note on BIZ-03 and BIZ-USER-01 to decide one server-side agent definition source before admission.
- Sidecar: RSI-00 candidate. Board: GOV-RSI-01 block, summary line, GOVERNANCE line.
- Not changed: code, CLAUDE.md, the checklists, locked documents, BIZ-02 (Lane 1 stays ACTIVE; this is not a Development OS mutation).

## Readiness assessment (summary)

The control layer is a strong base (bounded harness with budgets, signed per-job tool profiles, kill switch, caps, approval per hand-off, eval suite with live baselines, governance OS). The learning layer is missing: agent definitions are code constants in two places and not versioned; runs do not record the definition or model; harness traces are in memory only; there is no owner feedback signal; evals are not a release gate; there is no experiment environment apart from the one staging host. ARCHITECTURE.md is behind the code (GOV-ARCH-SYNC-01 is registered). Full text in the evidence file below.

Evidence in `C:/Users/knlee/aisb-preflight/GOV-RSI-01/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `RSI-READINESS-ASSESSMENT.md` | 9116 | `481d7db7beaf9204acff7e5f53c1b849714e1d5c36182bce7bc296cd4511ec55` |

## Acceptance criteria

All five met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7 and 9: n/a, no worker, code or build; 5: only the declared write scope changed), GOVERNANCE 9/9 (1: GOVERNANCE held for this record only, not an OS mutation, so BIZ-02 stays active; 2: RSI-00 carries the metadata, a machine stanza and a sidecar candidate with the saturationClass Keith approved; 3: no admission; 4 and 5: n/a, no code; 6: board and backlog mirrored, no Program Status; 7: Keith set the direction and approved the wording, an existing umbrella was searched for and none found; 8: no locked document edited; 9: validator in this record)

FOLLOWUPS: 1 registered / 0 superseded / 0 dropped / 0 undisposed (registered: RSI-00 holds S1 to S8, the eval-per-agent rule and the scheduler decision; the agent-definition decision is also noted on BIZ-03 and BIZ-USER-01; the ARCHITECTURE.md lag is already GOV-ARCH-SYNC-01)

## Lock

COMPLETE AND LOCKED on 2026-11-07 by the control plane. GOVERNANCE released UNOWNED. No implementation task admitted. Lane 1 stays ACTIVE with BIZ-02.
