# CHAT-RESULTS-OTHER-01 — Checkpoint

**Task:** CHAT-RESULTS-OTHER-01 — results of every run the owner starts go to the linked Discord.
**Status:** COMPLETE AND LOCKED — 2026-11-19. GATEWAY, FRONTEND and I18N pass to the next batch task.
**Loop:** 3-step (admission 59c732b; implementation 47bbd54 by an opus subagent, Opus 5.5, in worktree lane/CHAT-RESULTS-OTHER-01, fast-forwarded; this LOCK). Part of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## What changed (16 files, 831 insertions, 62 deletions; inside the 19-path write set)
- **CollaborationRunStartedNotifier** (orchestration/collaboration-start.service.ts), provided and exported by OrchestrationModule; orchestration imports no chat code. `start` notifies { collaborationRunId, userId } after the run and its first hand-off exist and after the try block, so a listener can never reach the cancel path; a throwing or rejecting listener is swallowed and never awaited.
- **ChatRunService listener**: with the switch on, a Discord link and an active owner, a chat_run_deliveries row is inserted with insert-or-ignore (ON CONFLICT DO NOTHING) and the delivery is woken; failures are logged with ids and a reason code only. The /ask path uses the same insert-or-ignore, so each run has exactly one row.
- **Deviation, accepted:** /ask's three-runs limit, /cancel and /status count only Discord-started runs (rows with a chat run_started audit row), so Team-page and trigger runs neither block /ask nor get cancelled from Discord, and /status keeps its "runs from Discord" meaning.
- **Copy**: the Connections page linked view and /help say results and approval requests of every run (Team page, schedules, triggers and Discord) arrive in Discord; en, zh-TW, zh-CN.

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6842 passed; after 6860 passed, 7 skipped, 14 failed (the known smoke.integration) | 6860 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 | rc 0 / rc 0 |
| frontend tests | 2262 of 2262 | 2262 of 2262 |
| frontend tsc / build | rc 0 / rc 0 | rc 0 / rc 0 (tsconfig.tsbuildinfo restored) |

## Review
The control plane read the listener and the Discord-only count: no task text or Discord id in logs; the start response shape and routes unchanged; the delivery rules unchanged.

## Live checks (CHAT-LIVE-02)
A Team-page Chief of Staff run sends the step-1 approval notice with buttons and then the result; a schedule or trigger run's result arrives; one /ask run gives exactly one result; /status and /cancel touch only Discord runs; the page sentence in three languages.

CHECKLIST: EVERY 11/11, UI 9/9, BACKEND 6/6.
FOLLOWUPS: 0 registered / 4 superseded (the run's origin stored on the delivery row into CHAT-STATE-PERSIST-01's migration; the pre-existing race where a poll announces /ask's first step before /ask approves it into CHAT-TIDY-01; Team-page step-1 notices and workflow test runs in Discord, which may feel noisy, into CHAT-NOTIFY-ONLY-01) / 0 dropped / 0 undisposed.
