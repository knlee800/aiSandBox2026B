# GOV-OS-04 — Checkpoint

**Task:** GOV-OS-04 — Cut control-plane record overhead
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Nature:** GOVERNANCE. **Lifecycle:** 2-STEP. No implementation lane.
**Source:** of 48 commits after b522502, 39 were records and 9 were code. Keith said "Cut the paperwork" and approved the draft on 2026-11-02.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| Begin | GOVERNANCE held, Development OS mutation with both lanes empty | 32ada8a809da19673fbfae9520d856c50b4f8116 |
| Close | validator change, fixtures, CLAUDE.md rules, board compaction, this checkpoint | this record |

## What changed

The record rules are in CLAUDE.md under Record economy. scripts/validate-lane-capacity.ps1 accepts an optional `runtimeAuthorization.liveWindowPaused`. With it true and staging, provider-live and credit authorization all false, the evidence check allows LOCAL-TESTS beside STAGING-RUNTIME or PROVIDER-LIVE. Nothing else in the validator changed.

## One change from the approved draft

The draft allowed the pair whenever the three authorizations were false. That would have changed the results of fixtures 29 and 30, because any live lane with its flags off would have forced a FORCING LOCAL-TESTS candidate into the other lane. The draft's own criterion says existing fixtures keep their results, so the exception also needs the explicit marker. Cursor stopped on this and did not edit.

## Validation

| Check | Result |
|---|---|
| scripts/validate-lane-capacity.tests.ps1 before the change | 70 of 70 |
| After the change | 76 of 76; fixtures 01 to 70 unchanged; 71 to 76 new |
| Canonical validator at this record | see the proof; exit 0 |

## Board compaction

282 lines before the LEGACY / FROZEN boundary lost everything after their first " Previous: ", about 1.37 million characters. Stale leading PM2-RECOVERY status lines were removed and the title and Lane 2 line were corrected. Content below the boundary is byte-identical. The full earlier board is in Git at 32ada8a809da19673fbfae9520d856c50b4f8116.

## Not changed

Lane count, mutexes, the scheduler, admission rules, validator use at transitions. The sidecar carries no marker now.

## Open

The rule that the control plane may land its own records still needs Keith's one-line permission edit so the validator can run without Cursor. Until then Cursor runs it.
