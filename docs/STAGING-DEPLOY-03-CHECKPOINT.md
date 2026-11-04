# STAGING-DEPLOY-03 — Checkpoint

**Task:** STAGING-DEPLOY-03 — Deploy the small fixes and check the diff for a new file
**Status:** COMPLETE AND LOCKED — 2026-11-04
**Workstream:** RELIABILITY. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** Keith approved the window with the draft on 2026-11-04. Admitted in 2e2ce107f84097f5a3110ff640ad7dc7ee029a14. Keith on the result: "Done, it worked".

## Result

| Check | Result |
|---|---|
| Deploy | 089ab0f to 2e2ce107f84097f5a3110ff640ad7dc7ee029a14 at 03:37:37Z, rc 0; migration hash unchanged (c4bfc1a1); configuration files unchanged; health 200; 13 guard checks refused without a key |
| ops-lib.sh | both installed copies (/usr/local/lib/aisandbox/ops-lib.sh and /usr/local/lib/aisandbox/clean-baseline/lib/ops-lib.sh) checked as the previous version 43353f03 first, then replaced with the deployed file 70872c63, root:root 644 |
| Window | flags on 03:38:22Z, off 03:42:46Z, stored test key, claude-opus-5-5, tool loop, write and validation flags on for the window only |
| Run collab_301e0ae9-f71e-4cd0-a605-6d4a53cf2943 | lead, writer, reviewer, each approved by Keith; completed |
| New-file diff | writer 9ade211b created truncate.js and changed test.js after save point 9a29a78, npm test passed; the hand-off to the reviewer carried the diff with new file mode and a /dev/null side for truncate.js plus the test.js change; reviewer 724dbb53 ran npm test and approved |
| Afterwards | 0 active runs, 0 open hand-offs, no failed executions, flags off, gateway back to stub with execution off |
| Balance | 165 to 128, 3 jobs, 35,883 tokens |

## Limits

RUN-ERROR-01 and COLLAB-HANDOFF-RECOVER-01 were deployed but not exercised live: no step failed, and the Gateway was not restarted mid-step. OPS-APPEND-IDS-01 was installed but no deploy was refused. During the window Agent mode could also write, because the write flag is global.
