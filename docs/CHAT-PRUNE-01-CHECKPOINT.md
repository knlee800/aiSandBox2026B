# CHAT-PRUNE-01 — Checkpoint

**Task:** CHAT-PRUNE-01 — prune old Discord chat rows whether or not Discord is switched on.
**Status:** COMPLETE AND LOCKED — 2026-11-19. GATEWAY passes to the next batch task.
**Loop:** 3-step (admission 0d9371d; implementation a8702ba by a sonnet subagent, Sonnet 5.5, in worktree lane/CHAT-PRUNE-01, fast-forwarded; this LOCK). Part of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## What changed (8 files, 381 insertions, 2 deletions; inside the write set)
- **ChatPruneService** (new, in ChatModule): at bootstrap and hourly (setInterval, unref'd, no overlap, nothing under Jest unless allowed, stopped on destroy), whatever the Discord switch says: expired chat_link_codes (ChatLinkService.pruneExpiredCodes, a public wrapper over the existing deleteExpiredCodes, which now returns its count), finished chat_run_deliveries older than 30 days (ChatDeliveryService.prune), chat_limit_hits older than an hour (ChatLimits.prune), expired chat_approval_tokens (ChatApprovalService.pruneExpired). Each step is wrapped on its own (a failure logs the step and an error name); one counts-only line per pass when something was deleted.

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6984; after 6994 passed, 7 skipped, 14 failed (the known smoke.integration) | 6994 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 | rc 0 / rc 0 |

## Review
The control plane read the service: existing prune functions reused, no query duplicated, failures contained per step, nothing but counts logged.

CHECKLIST: EVERY 10/11, BACKEND 6/6 — EVERY 4 partly met: the worker did not reopen CLAUDE.md and read the board lines by grep; EVERY 7: its baseline ran while it began editing (the counts are consistent; the control plane's rerun is the gate of record).
FOLLOWUPS: 0 registered / 1 superseded (ChatDeliveryService.tick() still prunes the same tables on every pass: remove the duplicate, into CHAT-TIDY-01 item 13) / 0 dropped / 0 undisposed.
