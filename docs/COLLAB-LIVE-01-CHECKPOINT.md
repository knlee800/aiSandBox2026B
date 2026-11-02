# COLLAB-LIVE-01 — Checkpoint

**Task:** COLLAB-LIVE-01 — Collaboration internal test on staging
**Status:** COMPLETE AND LOCKED — 2026-11-02
**Workstream:** AGENT. **Evidence class:** PROVIDER-LIVE. **saturationClass:** OPTIONAL.
**Source:** Keith approved the window in the draft on 2026-11-02. Admitted in 7c540f50026c9b5449dfa54439d7909eda58f467. Staging deployed at 37a3a7f71ebb4bdefbc818f2417068c4d861c825. Keith on the two answers: "Judgement ok".

## Result

Run collab_97d2e166-b6ee-4108-bb71-b8544b8a2a1e on ainow-staging-01, 2026-11-02, flags on 11:09:37Z, flags off 11:11:01Z, stored test key, claude-opus-5-5.

| Check | Result |
|---|---|
| Tables | collaboration_runs and collaboration_referrals present |
| Agent A, execution 84bfe861-7cb6-4322-bbe5-d76e25b59913 | completed, 801 tokens, 1 credit, runMode ask, intent conversation, no harnessVersion |
| Agent B, execution 99340da7-a53d-4456-a391-6b5af63dc3c5 | completed, 3023 tokens, 4 credits, same, reviewed A's answer |
| Loop and depth | 400 with the reason; safety_limit_breached logged once each |
| Balance | 370 to 365 |
| Checkpoints in the session | 0 |
| New routes without a key | 401 in both letter cases |
| Flags off | env files restored; harness flags never on |

## Limits

The test script made the hand-off and pasted A's answer into B's prompt. Agents had no file access and did not choose to hand off. This proves the plumbing, not collaboration quality. Workspace files were not hash-compared because the container was not running; Ask jobs have no file tools and no checkpoint appeared. The test script exited 1 on a wrong column in its own evidence query after the test had finished; the evidence was collected again read-only.

## Gaps found, not fixed

- Loop and depth limits use values the caller supplies. A caller that omits them is not stopped.
- A run stays `active` after its referrals finish.
- Limit events are logged only, not stored.
- Routes trust the internal key and do not check that the session belongs to the user.
