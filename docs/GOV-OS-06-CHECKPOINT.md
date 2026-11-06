# GOV-OS-06 — Checkpoint

**Task:** GOV-OS-06 — Tester window beside normal work
**Status:** COMPLETE AND LOCKED — 2026-11-06
**Nature:** GOVERNANCE (no lane). **Lifecycle:** 2-STEP: the opening record began the Development OS mutation; this record ends it.
**Source:** Keith asked on 2026-11-06 to let a trusted person test on staging while development continues, and approved option A (the tester window as a staging state) the same day.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Begin | registration, GOVERNANCE held, saturation suspended (OS_MUTATION) with both lanes empty | 1b248c321b60cebf4d054a2be4f0ee8ceec56379 |
| Implementation | Cursor CLI (cursor-delegate), requested grok-4.7-xhigh, resolved Grok 4.7 256K Extra High, session 49f1c8ca-1c11-42d9-91a2-8aed54133c77 | this commit |
| 2. Close | CLAUDE.md rule, follow-ups registered, mutation ended, canonical validator | this commit |

Cursor runs: the first two dispatches (2026-11-06T02:22Z and 02:23Z) were refused by Cursor with resource_exhausted before any command ran; the tree stayed clean. Keith switched the Cursor account (knlee803@gmail.com) and the third run applied the opening record and implemented the change.

## What changed

- scripts/validate-lane-capacity.ps1: runtimeAuthorization accepts the optional boolean testerWindowOpen (any other type MALFORMED, exit 1). Test-TesterWindowBlocked marks a record whose evidence class is PROVIDER-LIVE or whose canonical mutexes or runtime needs include PROVIDER-LIVE or CREDIT. With the window open, Test-Admissible returns TESTER_WINDOW_OPEN for such a candidate (after the pairwise conflict loop, before the runtime-authorization checks), and an occupied such lane makes the end state FAIL with exit 2. Nothing else changed.
- scripts/validate-lane-capacity.tests.ps1: compares rejectedCandidates only when expected.json has that field; existing fixtures are unaffected.
- docs/control-plane/fixtures/77 to 85: window open with one or two LOCAL-TESTS lanes and with a STAGING-RUNTIME lane pass; PROVIDER-LIVE and CREDIT candidates are rejected TESTER_WINDOW_OPEN; occupied PROVIDER-LIVE and CREDIT lanes FAIL exit 2; the same PROVIDER-LIVE candidate with the window closed is admissible as today; a string value is MALFORMED.
- CLAUDE.md: new section "Tester window (GOV-OS-06)" after Record economy.
- TASKS.md: a Tester window line (CLOSED).

## Validation (reviewer)

| Gate | Result |
|---|---|
| Fixture tests before the change (Cursor) | 76 of 76 pass |
| Fixture tests after the change (reviewer rerun) | 85 of 85 pass; fixtures 01 to 76 keep their results |
| Validator at the opening record | PASS, OS_MUTATION_QUIESCENCE |
| Validator at this record | PASS (dry run and canonical run) |
| Diff review | validator change matches the frozen design in the task body; no other OS semantics changed |

Evidence in `C:/Users/knlee/aisb-preflight/GOV-OS-06/`:

| File | Bytes | SHA-256 |
|---|---|---|
| `brief-gov6.txt` | 6398 | `2a7a5724c868e96d5b4431554ad0dc9296fd5b130dc88f56b621c182ca83b238` |
| `cursor-result-1.json` | 1165 | `50e2b4bc8abc7596f9f060e7fa3ff60be906ce676349b26f6170f741491ed223` |
| `cursor-result-2.json` | 1165 | `562568ef2ccb3eb7a05f5c207c1374168241ab96d5808e311beddad58165c8b8` |
| `cursor-result-3.json` | 6006 | `5c4367894873b7f4b79c3178899e58e5004a59def6aedebd48276bc3f3fcedde` |
| `reviewer-fixtures.out` | 3235 | `1fc3657f32c9151a01bbf2c860280ad56d0ec336a72a7508f8c074ac8cca6ca4` |

## Acceptance criteria

All seven met. Not LOCKED by an implementer: locked by the control plane.

## Limits

- The window's host steps and deploy blocks are off-repo; TESTER-SETUP-01 and TESTER-WINDOW-01 carry them.
- A deploy and a coding task still do not run in the two lanes at the same time (existing pair rule); deploys are short and run between coding tasks.

FOLLOWUPS: 2 registered (TESTER-SETUP-01, TESTER-WINDOW-01, NOT_READY, Keith decides) / 0 superseded / 0 dropped / 0 undisposed

## Lock

COMPLETE AND LOCKED on 2026-11-06 by the control plane. GOVERNANCE released UNOWNED; Development OS mutation ended; saturation not suspended.
