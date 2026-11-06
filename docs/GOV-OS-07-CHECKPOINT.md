# GOV-OS-07 — Checkpoint

**Task:** GOV-OS-07 — Rule checklists in briefs and checkpoints
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Nature:** GOVERNANCE (no lane). **Lifecycle:** 2-STEP: the opening record began the Development OS mutation; this record ends it.
**Source:** Keith asked on 2026-11-06 why the design-skill guideline existed but was not followed, and how to make rules followed in general; he approved the draft the same day.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Begin | registration, GOVERNANCE held, saturation suspended (OS_MUTATION) with both lanes empty | 601a3e0e1c546548c2edfe6b6051c622102881fc |
| Review | Cursor CLI read-only, requested claude-fable-5-1-thinking-high, resolved Claude Fable 5.1 300K High, session f5ab6ddd-ac9e-46a9-ad33-254b13905964 | no repository change |
| 2. Close | checklist file, CLAUDE.md, follow-ups registered, mutation ended, canonical validator | this commit |

## Cause found

Rules that a machine or a required line checks were followed (validator, hash-checked records, the FOLLOWUPS line). Rules that lived only as prose were missed: the Impeccable and Emil design skills were last applied in the UX-IA series (May 2026) and not named in later UI briefs; ACCESS-READY-01 item 9 (CORS before a second user) was not linked to the second-user checklist. Cursor briefs were built from the previous brief, so an omission stayed.

## What changed

- docs/control-plane/task-checklists.md (new): nine lists (EVERY 11, UI 9, FLOWS 4, BACKEND 6, MIGRATION 4, DEPLOY 6, LIVE 4, READINESS 2, GOVERNANCE 9; 55 items). Each item names its CLAUDE.md section or is marked GOV-OS-07.
- CLAUDE.md: new section "Rule checklists (GOV-OS-07)" (briefs copy the lists from the file, never from an earlier brief; every checkpoint carries a CHECKLIST line; GOV-OS-07 items are rules; readiness conditions are listed where the milestone is tracked); UX/UI Work Rules now require UI briefs to name both design skills, the worker to read them, and the checkpoint to say what was applied, and say UI work follows DESIGN.md once it exists; the authority table gains rows for the checklist file, DESIGN.md (visual reference, advisory) and PRODUCT.md (design context; PRD.md stays the product authority).

## Review

The first draft (8 lists) went to Fable 5.1 read-only. It reported missing rules (model routing, the 2/3/4-step loop, boot sequence, runtime start rule, tests and files-changed report, dependencies and PACKAGE, the I18N lease, live smoke, frontend checkpoint and file-action flows, entity changes needing MIGRATION, the pause rule, governance metadata, evidence isolation, record economy, Next-Work Selection, consolidation scope), items stated as CLAUDE.md rules that CLAUDE.md does not contain (deploy checks, migration round trip, readiness), and unclear items. The control plane rewrote the file: every missing rule added, a FLOWS list split out, practice rules marked GOV-OS-07 and adopted by the new CLAUDE.md section, unclear items made concrete, and duplicates and validator-enforced items removed. The first draft was not kept; the findings are in fable-review.json.

Evidence in `C:/Users/knlee/aisb-preflight/GOV-OS-07/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-fable.txt` | 1460 | `4fe1af170049edfdde9d99e833e46d447f8c7d9d591674d6457581a988d81ef3` |
| `fable-review.json` | 10367 | `48cba18a5718cec612ff0b8ca75cc35ab97332577bb1dcdd2de784ed58cc6d05` |

## Acceptance criteria

All six met. Not LOCKED by an implementer: locked by the control plane.

CHECKLIST: EVERY 11/11 (items 2 to 9 met or n/a: governance record, no code, no runtime, no build), GOVERNANCE 9/9

FOLLOWUPS: 2 registered (DESIGN-DOC-01, CHECKLIST-LINT-01, NOT_READY, Keith decides) / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. GOVERNANCE released UNOWNED; Development OS mutation ended; saturation not suspended. The tester window stays OPEN.
