# CHAT-USER-INSTALL-01 — Checkpoint

**Task:** CHAT-USER-INSTALL-01 — any Discord account can use the bot.
**Status:** COMPLETE AND LOCKED — 2026-11-19. Lane 1, GATEWAY, FRONTEND and I18N released.
**Loop:** 3-step (registration and admission 574c20e; implementation 8468dd3 by an opus subagent, Opus 5.5, in worktree lane/CHAT-USER-INSTALL-01, cherry-picked to main as 877669e because main had moved; this LOCK). Keith said "fix it now", then "Yes, all 9" (the Discord production batch), 2026-11-19, after a second Discord account outside his private server could not use the bot.

## What changed (26 files, 1758 insertions, 83 deletions; all in the 29-path write set)
- **Commands** (discord-commands.ts): integration_types [GUILD_INSTALL, USER_INSTALL] (0, 1; checked against the library enum); contexts stay [BOT_DM]; interactions are still accepted only in the bot's direct message.
- **Interaction references** (discord-transport.ts): per outside user id, the latest accepted command or button press (application id, token, time, an answered promise), memory only, never logged or returned, cleared on disconnect and stop, capped at 10000, used only while younger than 14 minutes.
- **sendToUser** (replaces sendDirectMessage on ChatTransport): with a fresh reference, an interaction follow-up after the interaction's own answer (waits at most 5 s; mentions off; buttons kept); otherwise, or when the follow-up fails, the direct message. HTTP 403 with code 50007 or 50278 throws ChatDirectMessageRefusedError (no id, no text).
- **Held deliveries** (chat-delivery.service.ts): a refused result or approval notice is not a failed attempt; the row stays waiting, held in memory, with one log line `reason=dm_refused` and no audit row; ticks skip held rows (`Not(In(held))`); the 24-hour drop still applies; ChatActivityNotifier (a small shared provider, no Nest cycle) wakes the delivery on that user's next command or button press and the result goes out as follow-ups.
- **Links** (chat-link.service.ts): GET /api/chat-links adds `discord.installUrl` (https://discord.com/oauth2/authorize?client_id=<application id>&integration_type=1&scope=applications.commands) and `discord.botProfileUrl` (https://discord.com/users/<bot user id>) while the connection is ready and both READY ids are snowflakes, else null. Guards unchanged. The response gained two fields (additive).
- **Connections page**: five numbered steps (Add to Discord, choosing Add to my apps; Open the bot and press Message; tick and Create code; in the bot's DM type / and choose link, paste the code; Confirm), the held-results note, external links with rel="noopener noreferrer" and an sr-only new-tab text, Heroicons ArrowTopRightOnSquareIcon; the page keeps only Discord's own https links. en, zh-TW, zh-CN.
- **/help** in three languages: commands come from the / menu; held results arrive after the next command.

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | 6842 passed, 7 skipped, 14 failed (the known smoke.integration, database) | 6842 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 | rc 0 / rc 0 |
| frontend tests | 2261 of 2261 | 2261 of 2261 |
| frontend tsc / build | rc 0 / rc 0 | rc 0 / rc 0 (tsconfig.tsbuildinfo restored) |
On main after the cherry-pick: gateway tsc and the chat tests rerun (see the LOCK record).

## Review
The control plane read the transport, delivery, link-service and page-logic diffs: tokens stay in memory and out of logs; a refused DM never counts as a failure; links are built from public ids and re-checked on the page; the 24-hour drop and retries for other errors are unchanged. UI skills: Impeccable (one accent on the current step, plain list, existing spacing) and Emil (no added motion) applied as reported.

## Not verifiable locally
Whether Discord lets the bot direct-message a user-install account that shares no server, and how many follow-ups one interaction token takes: both are checked live in CHAT-LIVE-02 with Keith's second account after STAGING-DEPLOY-CHATBATCH-01. Keith's one portal step at deploy: Public Bot on, User Install on with the Discord-provided link (scope applications.commands).

CHECKLIST: EVERY 10/11, UI 9/9, BACKEND 6/6 — EVERY 4 partly met: the worker did not reopen CLAUDE.md (it had it in context) and read only the board lines for its task; EVERY 7 met with `--maxWorkers=6` after Jest ran out of memory with default workers while another lane ran.
FOLLOWUPS: 3 registered (GATE-WORKERS-01, STAGING-DEPLOY-CHATBATCH-01, CHAT-LIVE-02) / 2 superseded (memory-only holds after a restart into CHAT-STATE-PERSIST-01; a silent send while the transport is not ready into CHAT-TIDY-01) / 0 dropped / 0 undisposed.
