# CHAT-DISCORD-DM-01 — Checkpoint

**Task:** CHAT-DISCORD-DM-01 — plain direct messages to the Discord bot.
**Status:** COMPLETE AND LOCKED — 2026-11-19. GATEWAY passes to the next batch task.
**Loop:** 3-step (admission 07b4032; implementation 3e9b9b6 by an opus subagent, Opus 5.5, in worktree lane/CHAT-DISCORD-DM-01, fast-forwarded; this LOCK). Part of Keith's Discord production batch ("Yes, all 9", 2026-11-19).

## What changed (13 files, 809 insertions, 21 deletions; exactly the write set)
- **Intent**: DISCORD_GATEWAY_INTENTS is DirectMessages (4096; no privileged bit, checked against GatewayIntentBits).
- **Filter** (toChatPlainMessage): only a direct message (no guild_id, no member), type 0 or 19, no webhook, a human non-system author who is not the bot, snowflake author, message and channel ids, and only once the bot's own id is known. Only the trimmed content and the ids needed to reply are read.
- **Path**: ChatCommandService.handleMessage: switch off gives not available; the activity notifier fires; unlinked gets link first; empty, slash-leading and over-6000-character text get one line each (new message.* keys); an inactive or unentitled owner gets the /ask refusal; otherwise the unchanged ChatRunService.ask with { text }: the same limits (the 10-a-minute bucket shared with /ask), "@Name rest" workflows, refusals, audit rows and origin 'chat'.
- **Reply** in the DM with message_reference and mentions off; a refused reply (403, 50007 or 50278) is logged once. Logs carry outcome codes and the link id only.
- **/help** in three languages: plain messages go to the Chief of Staff, @name for a workflow; use /ask if the bot does not answer plain messages.

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6960 (a first baseline run had 10 environmental suite failures; the rerun was clean); after 6984 passed, 7 skipped, 14 failed (the known smoke.integration) | 6984 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 | rc 0 / rc 0 |

## Review
The control plane read the filter and the handler path: one shared /ask path, nothing of the text or Discord ids logged, no privileged intent. Accepted deviations: a new message.tooLong line (no 6000-character line existed); DiscordCalls.replyToMessage optional for a spec outside the write set; a stricter filter; text checks before the owner check.

CHECKLIST: EVERY 11/11, BACKEND 6/6.
FOLLOWUPS: 0 registered / 4 superseded into CHAT-TIDY-01 (a per-author reply limit for unlinked or junk plain messages; plain messages that arrive during a reconnect are dropped without notice; held results after a plain message still need a slash command when direct messages are refused, so say so where it matters; link.confirmed should mention plain messages) / 0 dropped / 0 undisposed.
