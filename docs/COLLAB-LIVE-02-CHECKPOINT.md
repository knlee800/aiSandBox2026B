# COLLAB-LIVE-02 — Checkpoint

**Task:** COLLAB-LIVE-02 — Approval gate and loop prevention on staging
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** Keith approved the window in the draft on 2026-11-02. Admitted in 22bc2028671a7ad3a017abea3f7c1dcfad3ba5e0. Staging deployed at c55c13d7ee81bfabd45c391b3d435a732e836c84 with the migration. Keith on the answer: "Judgement ok".

## Stale record decision (U2)

The first deploy at 12:51Z was refused before anything stopped: run collab_97d2e166-b6ee-4108-bb71-b8544b8a2a1e from COLLAB-LIVE-01 was still `active`, which the quiescence check counts as in flight. Its two referrals were completed and no usage row was unfinished. Keith approved ("Yes, mark it") setting that one row to `completed`. Done by a guarded update; 0 active runs after.

## Result

Flags on 13:24:49Z, off 13:25:28Z, stored test key, claude-opus-5-5, harness flags off. Main run collab_b6816677-4073-460a-9e72-2a321ecd2e94; execution 1cbcf1d3-184b-432c-972a-418668d062a1, 429 tokens, 1 credit, runMode ask, no harnessVersion. Balance 365 to 364.

| Check | Result |
|---|---|
| Waiting hand-off | no job, no ledger row after 8 seconds |
| Global switch off, provider on | approve 503, stays waiting, no ledger row |
| Provider switch off | approve 503 |
| A to B to A with caller depth 0 and empty visited | 400, limitType loop |
| Parent not in the run | 400 |
| Rejected | never ran; approve after it 409 |
| Approved | ran once; repeat approve 409 |
| Ninth hand-off | 400, limitType handoff; ledger 0 |
| Run finish | completed for the main run; failed when all rejected |
| After the window | 0 active runs, 0 open hand-offs, env files restored |

## Limits

Spend, credit and token refusals are unit-tested only. The daily spend counter is in memory. decidedBy is what the caller says. Agents still do not choose hand-offs.

## Gaps found, not fixed

- A waiting hand-off or an unread finished run blocks every deploy, and nothing expires them.
- `append_ids_only` in ops/clean-baseline/lib/ops-lib.sh selects a column `id` that usage_records does not have, so the refusal message hides the cause. The check itself still works.
