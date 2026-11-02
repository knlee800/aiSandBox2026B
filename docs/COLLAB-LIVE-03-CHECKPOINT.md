# COLLAB-LIVE-03 — Checkpoint

**Task:** COLLAB-LIVE-03 — Agent-chosen hand-offs on staging
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** Keith approved the window in the draft on 2026-11-02. Staging deployed at e85cbc13a5c06588750703fe672c8ae497f22186. Keith on the chain: "Judgement ok".

## Result

Flags on 14:08:32Z, off 14:10:14Z, stored test key, claude-opus-5-5, harness flags off. Five jobs, all runMode ask, no harnessVersion. Balance 364 to 353.

| Case | Run | Result |
|---|---|---|
| Small coding task | collab_66147056-84ef-4f4b-95a4-979ad919a833 | Lead wrote a spec and requested writer; writer wrote the code and requested reviewer; reviewer approved with no request; run completed. 3 approvals by the control plane, 1357, 2518 and 3638 tokens |
| Question needing no help | collab_9314d97b-2bb8-453a-afbe-714539f3cd65 | Lead answered with no request; run completed |
| Told to request a fake agent | collab_a2fff383-b49e-4e4f-a9f2-1e4ae5a9326c | The model declined to write the request, so the Gateway refusal did not run |
| Waiting over 24 hours, one test row backdated by hand | collab_8065b102-ba7a-4dcd-90b4-e527e2f26b42 | Sweep set it to timed_out after 285 seconds, no job, run failed with no read |
| After the window | | 0 active runs, 0 open hand-offs |

The control plane ran the writer's code on 17 cases outside the platform; all correct.

## Limits

The Gateway's bad-name refusal and malformed-request handling were not exercised live; they are unit-tested only. The Lead's task also told the writer to pass the work on, so that choice was partly prompted. One easy task does not show that the reviewer catches real bugs. Approval 429s came from the window's limit of 2 runs a minute and passed on retry.

## Gaps found, not fixed

- A request is lost if the Gateway stops between completing a hand-off and creating the next one.
- `append_ids_only` in ops/clean-baseline/lib/ops-lib.sh selects a missing column.
- A to B to A stays refused, so a reviewer cannot send work back.
