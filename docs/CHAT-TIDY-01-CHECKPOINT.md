# CHAT-TIDY-01 — Checkpoint

**Task:** CHAT-TIDY-01 — the Discord production batch's small fixes (13 items).
**Status:** COMPLETE AND LOCKED — 2026-11-20. Lane 1, GATEWAY, FRONTEND and I18N released.
**Loop:** 3-step (admission b42e255; implementation e1ca700 by an opus subagent, Opus 5.5, in worktree lane/CHAT-TIDY-01, fast-forwarded; this LOCK). The last code task of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## What changed (29 files, 2463 insertions, 251 deletions; inside the write set)
1. /ask agent autocomplete (type 4 answered with type 8, at most 25 usable workflows, read-only lookups, empty on failure or after 2 s, nothing logged per keystroke).
2. The 10-a-minute limit on every linked command and plain message except /link and /help; at most 3 replies a minute to an unlinked author (bucket command, subject SHA-256 of "unlinked:" + id).
3. /help names the Approve and Reject buttons.
4. Reject opens a form (type 9, one optional field, max 500); the submit runs all six press checks, spends the token and rejects with the trimmed reason or the translated "Rejected in Discord"; the typed text is never logged or audited.
5. eslint: ten no-explicit-any errors fixed in discord-transport.ts (the body said four); src/chat lint clean.
6. ChatTransportNotReadyError: a send while not ready is not attempted, not failed and not counted.
7. /ask writes its delivery row only after it approves its own first step, and the run-started listener waits for that owner's /asks in flight, so the self-approved step is never announced.
8. Token spend before the decision must delete exactly one row; a refused decision on a still-waiting step puts the token back.
9. resume(): no query without a held row; one UPDATE by link id otherwise.
10. Plain messages during a reconnect are queued (at most 50) and handled on ready or resume.
11. link.confirmed and the held-results notes updated (a plain message is not enough when direct messages are refused).
12. Right after Confirm only the green linked line; the amber notice on later views.
13. The duplicate prune removed from the delivery pass (ChatPruneService owns it).

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6994; after 7042 passed, 7 skipped, 14 failed (the known smoke.integration) | 7042 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build / eslint src/chat | rc 0 / rc 0 / clean | rc 0 / rc 0 / clean |
| frontend tests | 2269 of 2269 | 2269 of 2269 |
| frontend tsc / build | rc 0 / rc 0 | rc 0 / rc 0 (tsconfig.tsbuildinfo restored) |

## Review
The control plane read the token spend (delete must affect one row before approveStep or rejectReferral; restore on a refused decision) and the /ask ordering. Accepted deviations: names over 100 characters left out of autocomplete; item 7 reordered to keep collaboration-start.service.spec.ts (outside the write set) passing; a Reject press opens the form without database work (a stale button's submit says it no longer works).

CHECKLIST: EVERY 11/11, UI 9/9, BACKEND 6/6.
FOLLOWUPS: 1 registered (CHAT-ABUSE-LIMITS-01: slash commands other than /link from unlinked accounts are unlimited, and each autocomplete keystroke costs four reads with no cache) / 2 superseded (the form's Label component and UPDATE_MESSAGE on submit depend on Discord's current behaviour, into CHAT-LIVE-02; held-user knowledge lagging a pass with a second gateway process, into CHAT-SERVICE-SPLIT-01) / 0 dropped / 0 undisposed.
