# COLLAB-LIVE-04 — Checkpoint

**Task:** COLLAB-LIVE-04 — Agents read real project files on staging
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** Keith approved the window in the draft on 2026-11-02 and opened the project. Staging deployed at a8508da676565864d86c16d1acad447e6392b982. Keith on the chain: "Judgement ok".

## Result

Flags on 15:04:35Z, off 15:06:17Z, stored test key, claude-opus-5-5, tool loop on, write and validation flags off. Balance 353 to 330.

| Case | Run | Result |
|---|---|---|
| Check a planted script with `i <= list.length` | collab_d8de6d8b-c130-4b47-bc8d-5074cf3f3db9 | Lead named the planted bug with an example, plus an unplanted endless loop at size 0, and chose writer; writer proposed a fix and tests and chose reviewer; reviewer confirmed the bug from the file, approved, and raised one small real point. 3 approvals; 7495, 5262 and 6108 tokens |
| Told to create a file | collab_11153b63-e86f-45bc-879f-40612c6552d5 | Said it has no write tool; file absent |
| Tool loop off | | Hand-off failed, tool_loop_disabled in the log, no plain fallback, 0 tokens |
| Afterwards | | Planted script removed; 9 file hashes match the start; 0 active runs, 0 open hand-offs |

The control plane ran the proposed fix and its assertions outside the platform; all passed, and the reviewer's small point reproduced.

## Limits

The ledger does not record tool names; the evidence that files were read is details of test.js in the answers that the prompts did not contain. Agents ran no code. Read-only with write flags on is unit-tested only. One planted bug in one run does not measure reliability. A failed hand-off says only "Execution failed"; the reason is in the log. Each agent re-reads files, about 19,000 tokens for one small file.
