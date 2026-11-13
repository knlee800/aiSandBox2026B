# CHAT-DISCORD-01 — Stage-start (Step 2)

Task: CHAT-DISCORD-01, Discord chat channel (plan `docs/AGENT-OPS-PLAN.md` 3.3, A7, E1-E3). Lane 1, 4-step, Step 2.
Drafted 2026-11-13 by a fable subagent on `lane/CHAT-DISCORD-01` (from main 6cb6aed). This document is the only write.
Nothing here is approved. Step 3 starts only after Keith approves; mutexes and write sets below are proposals.

Path short forms: GW = `services/api-gateway/src`, FE = `frontend`, OPS = `ops/clean-baseline`.
External facts were read on 2026-11-13 from the URLs in section 14. "Not verified" marks anything I could not prove.

## 0. Recommendation in short

| Question | Recommendation |
|---|---|
| Where the bot runs | A gateway module (`GW/chat/`), in the gateway process. No new service, no new systemd unit, no internal route, no new service key |
| Library | `@discordjs/core` 2.7.0 with `@discordjs/ws` 2.0.4 and `@discordjs/rest` 2.6.3, pinned exactly. Not the full `discord.js` |
| Surface | Slash commands in the bot's direct messages only. Gateway intents = 0. No Message Content intent |
| Link | The platform makes the code; the owner types it in Discord; the owner then confirms on the platform. This reverses the plan's wording (section 5) |
| Runs | The same start and approve code the Team page uses, as the linked owner. Discord starts have no session, so they are read-only by the existing rule |
| Switch | `CHAT_DISCORD_ENABLED`, default false. Runs still need `GLOBAL_EXECUTION_ENABLED` and the provider switch |
| Slices | A1 link backend, A2 link page, B bot connection and commands without runs, C1 runs and results, C2 approvals in Discord, then deploy and two live checks |

## 1. Today's facts

### 1.1 How an owner starts a Chief of Staff or workflow run

| Fact | Reference |
|---|---|
| Route `POST /api/collaboration/runs`, guard `SessionOrApiKeyAuthGuard` | GW/orchestration/collaboration.controller.ts:251-252, :264 |
| A browser session becomes an identity `{userId, apiKeyId: 'browser-session', scopes: ['ai:execute'], isInternal: true}`; `harnessEntitled` is read live from `user_entitlements` | GW/auth/session-or-api-key.guard.ts:55-64; GW/auth/entitlement.service.ts:64-79 |
| A session is valid only if not revoked, not expired and the user is active | GW/auth/auth.service.ts:311-319 |
| Every collaboration route refuses without `harnessEntitled === true` (403) | GW/orchestration/collaboration.controller.ts:569-577 |
| Body: `team` (coding, chief-of-staff, advisors) or `workflowId` (+ `testRun`), `task`, optional `sessionId`. Provider, model, instructions, scopes, tool profile and `decidedBy` are never taken from the body | collaboration.controller.ts:237-249, :804-845 |
| `task` is trimmed, required, at most 8000 characters | collaboration.controller.ts:844-858; GW/orchestration/collaboration-team.ts:46 |
| Without `sessionId` only the chief-of-staff team or a read-profile workflow may start; it runs on the owner's business session | collaboration.controller.ts:281-291, :600-614 |
| Roster members are read-profile only, at most 3; the Chief of Staff lists the usable ones | GW/orchestration/collaboration-roster.ts:50-57; ARCHITECTURE.md:1056 |
| The start creates the run and one hand-off in `pending_approval`. Nothing runs yet | collaboration.controller.ts:296-325; GW/orchestration/orchestration.service.ts:1060 |
| The owner approves each hand-off: `POST /api/collaboration/runs/:id/referrals/:referralId/approve` | collaboration.controller.ts:423-461; FE/components/collaboration/collaboration-page.tsx:936-947 |
| Approve runs every safety check: provider switch, `ExecutionSafetyGuard` (global switch, daily credit caps), abort guard, credit balance, token quota | orchestration.service.ts:1143, :1873-1925; GW/safety/execution-safety.guard.ts:56-57, :134; GW/safety/kill-switch.config.ts:17-18, :64; GW/safety/daily-credit-cap.service.ts:31-52 |
| Automatic approval exists only for child steps of a run led by a user workflow, read-only targets only. The first hand-off and Chief of Staff runs always wait for the owner | orchestration.service.ts:3433-3445, :3474-3478 |
| A waiting hand-off times out after 24 hours | GW/orchestration/collaboration-sweep.constants.ts:2 |
| Limits: 4 agents per run, 2 front-door rounds | GW/orchestration/orchestration.contracts.ts:88, :96 |

### 1.2 How results reach the owner

| Fact | Reference |
|---|---|
| A run moves forward when someone reads it (`getCollaborationRunWithReferrals` syncs and settles) or at the 5-minute sweep | orchestration.service.ts:456-484, :2595-2605; GW/orchestration/collaboration-sweep.constants.ts:1 |
| The final answer is the last completed hand-off's `result_summary` | GW/orchestration/collaboration-results.ts:158-167; GW/orchestration/collaboration-referral.entity.ts:123-124 |
| Results page: `GET /api/results`, `GET /api/results/unread-count`, `POST /api/results/:runId/seen`; unread = completed, failed or timed out and not yet opened | GW/orchestration/collaboration-results.controller.ts:154-186; collaboration-results.ts:18-22 |
| Header links to Connections and Results with an unread pill | FE/components/platform/platform-dashboard.tsx:314, :780-790 |

### 1.3 What a Discord message can reuse without a new trust path

| Reuse | How |
|---|---|
| Identity | After the link lookup the module builds the same identity the session guard builds (same fields, `harnessEntitled` read live, user must be active). No API key, no session token, no new credential for the owner |
| Start | The same start code as `POST /api/collaboration/runs`, always without `sessionId`. Only `team: chief-of-staff` or `workflowId`. Read profile by the existing rule |
| Approve | `OrchestrationService.approveReferral` with `decidedBy` = the owner and `enforceTestsGate: true`, as the login route does (collaboration.controller.ts:435-441) |
| Progress | The same read the Team page polls (`getCollaborationRunWithReferrals`). No change to settling |
| Results | `finalAnswerOf`. `result_seen_at` stays owned by the Results page; a Discord delivery does not mark a result seen |
| Audit | `audit_events` (append-only; GW/entities/audit-event.entity.ts:3-8) |

Constraint found: `GW/orchestration/orchestration.service.ts` and `GW/ai/ai-execution.controller.ts` are in the frozen contract HARNESS_ENTITLEMENT_PROOF_V1 (`docs/control-plane/lane-saturation-state.json:9488-9498`). This design changes neither file.

Constraint found: `apiKeyId: 'browser-session'` is special-cased (GW/quota/quota.guard.ts:54). Decision D7 below keeps that value for chat-started runs and records the channel elsewhere.

Not found: the plan's "`@name` in chat" (A8). My search of the gateway, ai-service and frontend found no code that parses `@name`. Not verified either way.

## 2. Where the bot runs

Discord's gateway is a WebSocket the app opens outward ("apps open secure WebSocket connections with Discord"); interactions arrive either on that connection or at a public Interactions Endpoint URL, never both. With the gateway method no public inbound address is needed. Replies are sent by HTTPS to Discord. (Sources 1, 2.)

| Option | For | Against |
|---|---|---|
| **A. Gateway module `GW/chat/` (recommended)** | No new unit, env file or build artifact. No internal route, no second key. Calls the same services in-process. Precedent: in-process sweep timer (GW/orchestration/collaboration-sweep.worker.ts:13-22); plan 3.4 uses an in-process timer for triggers too | The library's code runs inside the gateway. A gateway restart drops the connection (it reconnects). The token lives in `gateway.env`, whose baseline hash changes once |
| B. New service `services/chat-discord/` with its own unit | Process separation from the gateway | The host tooling names four units in many places (OPS/lib/ops-lib.sh:942, :1200, :1545, :1586, :1755, :1801-1811) plus the build list (:2176-2179) and OPS/bin/aisandbox-prepare:501. A fifth unit means a wide ops change with HOTFILE leases. It needs routes both ways; `X-Internal-Service-Key` opens every `/api/internal/` route (GW/guards/internal-service-auth.guard.ts:12, :96-104), so the bot process would hold a wide key, or a new narrow key and guard would be needed (an auth change). All units run as the same user `aisandbox` (OPS/systemd/aisandbox-gateway.service:12-13), so isolation is weak anyway |
| C. Child process of the gateway, as connectors-mcp | No unit change | connectors-mcp is short-lived per call with an idle stop; a bot is long-lived and two-way. A poor fit |

Recommendation: A. The module is split so a later move to B is cheap: channel-neutral core (`GW/chat/`) and a thin Discord transport (`GW/chat/discord/`) behind an interface. Tests use a fake transport. Under Jest the transport never connects (precedent: collaboration-sweep.worker.ts:14).

Process model on staging: unchanged. The gateway unit (OPS/systemd/aisandbox-gateway.service) reads `/etc/aisandbox/gateway.env`. No new listening port. No Caddy change (OPS/caddy/Caddyfile:11-12). One gateway instance means one Discord session; PRD.md section 8 already excludes multi-node.

## 3. Library

Staging runs Node 24 (OPS/README.md:5; OPS/bin/aisandbox-prepare:365). Root `package.json:24-25` requires Node 20 or later.

| Option | Version (latest, source 8) | Licence | Node | Size and dependencies | Note |
|---|---|---|---|---|---|
| `discord.js` | 14.28.1 | Apache-2.0 | >=18 | 2.0 MB unpacked; 13 direct dependencies (caches, builders, formatters, `@discordjs/ws` 1.x, undici 6) | Most used. Most of it (guild caches, builders) is unused here |
| **`@discordjs/core` + `@discordjs/ws` + `@discordjs/rest` (recommended)** | 2.7.0 / 2.0.4 / 2.6.3 | Apache-2.0 | >=20 / >=20 / >=18 | 2.1 MB / 0.65 MB / 0.8 MB unpacked; bring `ws` 8, undici 6, `discord-api-types` 0.38 | Same project and repository as discord.js. Thin and typed. Handles heartbeat, resume, reconnect and REST rate-limit buckets. No caches |
| Raw WebSocket and `fetch` | none | — | — | no new package | We would own heartbeat, resume, reconnect and rate limits. A reconnect bug can burn the 1000 IDENTIFY calls per day, and Discord then resets the token (source 1). Not recommended |

Proposed new dependencies in `services/api-gateway/package.json`, exact pins as connectors-mcp does (`services/connectors-mcp/package.json:13-15`): `@discordjs/core` 2.7.0, `@discordjs/ws` 2.0.4, `@discordjs/rest` 2.6.3. This takes PACKAGE and Keith's approval. `discord-api-types` comes in transitively; the implementer pins it directly only if types are imported from it.

Not verified: publish dates of these versions (the registry page was too large to read to its `time` block), and the full transitive tree size. Slice B's first step records `npm ls` and `npm audit` for the three packages and stops if anything unexpected appears.

## 4. Discord setup only Keith can do

Least-privileged design: slash commands only, used in the direct-message chat with the bot.

| Point | Fact or choice | Source |
|---|---|---|
| Intents | 0. Interactions are not tied to an intent ("events not associated with an intent will always be sent"). Not verified on the interactions page itself; Slice B proves it with the fake and the live check | 1 |
| Message Content intent | Not needed. Privileged intents are GUILD_PRESENCES, GUILD_MEMBERS, MESSAGE_CONTENT. Slash command text arrives in the interaction. (Direct messages to the bot are exempt from the intent anyway, should free text come later) | 1 |
| Commands | Global commands with `contexts` = BOT_DM only, so they do not appear in server channels. Not verified that a BOT_DM-only list is accepted; fallback: allow GUILD too and answer there with an ephemeral "use the direct message" | 3 |
| Install | Guild install into a private server that Keith creates and only he is in, scopes `bot` and `applications.commands`, permissions 0. A shared server makes the bot's direct messages certain. Not verified: `permissions=0` in the URL, and whether a user-install alone lets the bot send a direct message later | 4, 6, 7 |
| Public Bot | Off: "only the app owner can add the bot to guilds" | 4 |
| Interactions Endpoint URL | Left empty (gateway method) | 2 |

Keith's steps (the deploy slice gives them as a checked list):

1. Discord Developer Portal: New Application (a name such as "ainow staging"). Note the Application ID (not secret).
2. Bot page: Public Bot off. All three privileged intents off.
3. Installation page: guild install only; scopes `bot`, `applications.commands`; permissions none.
4. Create a private Discord server with only Keith in it. Open the install link, add the bot to that server.
5. Bot page: Reset Token, copy it once. On the host, at the hidden prompt the deploy slice provides, paste it. Never into chat, the repository or a file on the PC.
6. Turn on two-factor sign-in for the Discord account (it owns the bot).

Bot token handling:

| Point | Rule |
|---|---|
| Where | `DISCORD_BOT_TOKEN` in `/etc/aisandbox/gateway.env`. The template (`OPS/env/gateway.env.template`) gains the key name with an empty placeholder and `CHAT_DISCORD_ENABLED=false` |
| Entry | A host script reads it at a hidden prompt, writes the env file, prints only "set" and the new file hash. Precedent: `CONNECTOR_CREDENTIALS_KEY` (plan 3.1 Broker row) |
| Missing or bad token | The chat module stays off and logs one line without the value. The gateway still boots (same rule as the connector key) |
| Logs | Never the token, never the `Authorization` header. Library debug events are not logged |
| Backups | `gateway.env` is already in the encrypted backup; the baseline hash is re-recorded at the deploy |
| Rotation | Portal: Reset Token. Host: hidden prompt again, restart the gateway, check the "ready" line. On any suspected leak: reset first, then investigate. Not verified in the docs I read that a reset invalidates the old token at once; the portal says so |
| Guard | Reconnects back off; after 20 failed IDENTIFY attempts in a day the module switches itself off until restart (Discord's limit is 1000 per day, then a forced token reset; source 1) |

## 5. Account link by a one-time code

The plan says the code is "typed on the platform" (plan 3.3). I recommend the reverse, plus a confirm on the platform.

| Direction | Risk |
|---|---|
| Plan: Discord shows a code, the owner types it on the platform | An attacker gets a code in Discord and tricks the owner into typing it while signed in. The attacker's Discord account is then linked to the owner's account and can start runs and read results. This is the known device-code phishing shape |
| **Recommended: the platform shows a code to the signed-in owner, the owner types `/link` in Discord, then confirms on the platform** | A guessed or stolen code alone links nothing: the owner must confirm on the platform, where the page shows which Discord account asks |

| Item | Design |
|---|---|
| Who may link | A signed-in owner with harness access (the same `assertEntitled` rule). Checked again on every command |
| Code | 8 characters from a 32-letter alphabet without look-alikes (40 bits), shown once as `XXXX-XXXX`. Made with `crypto.randomBytes` |
| Lifetime | 10 minutes. Single use. One live code per owner per channel; a new one replaces the old |
| At rest | SHA-256 hash only (precedent GW/auth/auth.service.ts:85; `verification_tokens.token_hash`, GW/entities/verification-token.entity.ts:29-30) |
| Claim | `/link code:` in Discord marks the code claimed by that Discord user id and answers "go back to the platform and press Confirm". The answer is the same for a wrong, used or expired code |
| Confirm | The Connections page polls, shows "Discord account NAME (id ending 1234) asks to link" with Confirm and Cancel. Confirm creates the link; Cancel deletes the claim |
| Rate limits | Code creation: 5 per owner per hour. `/link` attempts: 5 per Discord user per hour, then silence. More than 100 failed attempts platform-wide in an hour pauses linking for an hour and writes an audit row |
| One to one | One Discord account per owner per channel; one owner per Discord account (two unique indexes). A second link attempt is refused until unlink |
| Unlink | On the page, or `/unlink` in Discord. Deletes the link row, its codes and its delivery rows. Runs already started keep going and their results stay on the Results page only |
| Stored | Discord user id (a number), the reply language, timestamps. No Discord name, e-mail or avatar. The name shown at confirm is held on the code row for at most 10 minutes |

Tables (one migration, next number after `1807000000000-AddUserAgentApprovalColumns.ts`; MIGRATION mutex). Names are channel-neutral so LINE and later channels reuse them.

| Table | Columns |
|---|---|
| `chat_links` | `id` uuid; `user_id` uuid, foreign key to `users` with cascade delete; `channel` varchar(16) (`discord`); `external_user_id` varchar(32); `locale` varchar(10); `created_at`; `last_used_at`. Unique (`channel`, `external_user_id`); unique (`user_id`, `channel`) |
| `chat_link_codes` | `id`; `user_id` (cascade); `channel`; `code_hash` varchar(64) unique; `locale`; `expires_at`; `claimed_external_user_id` null; `claimed_display_name` varchar(64) null; `claimed_at` null; `created_at`. Rows are deleted on confirm, cancel, replacement and expiry |
| `chat_run_deliveries` (Slice C1; second migration, or the same one if Keith prefers a single migration) | `collaboration_run_id` text primary key; `link_id` uuid (cascade); `status` (waiting, delivered, failed, dropped); `notified_referral_ids` jsonb; `created_at`; `delivered_at` null. No message text |

Routes (session auth, harness access, covered by the global same-origin write guard, ARCHITECTURE.md:364):

- `GET /api/chat-links` — switch state, the owner's link (channel, linked time, last four digits of the id), any pending claim.
- `POST /api/chat-links/discord/code` — returns the code once and its expiry.
- `POST /api/chat-links/discord/confirm` and `POST /api/chat-links/discord/cancel`.
- `DELETE /api/chat-links/discord`.

Audit events (`audit_events`, category `chat`; payload holds ids, reason codes and counts only): `link_code_created`, `link_claimed`, `link_confirmed`, `link_cancelled`, `link_removed`, `link_attempts_paused`, and from Slice C `run_started`, `run_refused`, `approval_decided`, `result_delivered`, `delivery_failed`. Because audit rows can never be deleted (audit-event.entity.ts:5), the Discord user id is never written to them; the subject is the link's own uuid.

## 6. Two-way flow

### 6.1 Commands (direct message with the bot)

| Command | Slice | What it does |
|---|---|---|
| `/link code:` | B | Section 5 |
| `/unlink` | B | Removes the link |
| `/status` | B | Linked or not, runs on or off, waiting approvals, runs in progress (counts only) |
| `/language` | B | en, zh-TW or zh-CN for the bot's own text |
| `/help` | B | Fixed text |
| `/ask text: [agent:]` | C1 | Without `agent`: a Chief of Staff front-door start. With `agent`: that workflow (E3). A leading `@name` in `text` is read the same way |
| `/cancel` | C1 | Cancels the owner's latest active Discord-started run (existing cancel path, collaboration.controller.ts:541) |

`@name` (E3): the `agent` option offers the owner's own switched-on workflows by name (autocomplete, at most 25 choices; source 3). The server resolves the name against the owner's workflow list (`listForOwner`, collaboration.controller.ts:361-362) and starts with that `workflowId`. Unknown or ambiguous names are refused with the list of valid names. The coding and advisors teams need a session and are not offered. The existing rules decide the rest: a workflow that is off, untested or not read-profile is refused by the same refusal codes the page shows.

Command names and descriptions carry `name_localizations` and `description_localizations` for zh-TW and zh-CN (both are Discord locales; sources 3, 5).

### 6.2 A message becomes a run

1. Interaction arrives. The module answers within 3 seconds with a deferred reply (Discord's limit; source 2).
2. Look up the link by Discord user id. No link: fixed "link first" text. Stop.
3. Load the owner. Must be active and harness-entitled now. Otherwise a fixed refusal. Stop.
4. Per-owner limits: 10 commands a minute, 3 active Discord-started runs. Over the limit: refusal. Stop.
5. Pre-check the switches (`CHAT_DISCORD_ENABLED`, `KillSwitchConfig.GLOBAL_EXECUTION_ENABLED`). Off: the translated "runs are switched off" refusal. Nothing is created. Stop.
6. Start through the shared start code with `{team: 'chief-of-staff', task}` or `{workflowId, task}` and no `sessionId`.
7. Approve the first hand-off as the owner. The owner asked for exactly this step, so the command is the click. Every check in `approveReferral` still runs. If it refuses (credits, caps, provider off), the run is cancelled and the refusal reason is translated.
8. Write the delivery row and the audit row. Edit the deferred reply to "Started".

Decisions for the implementer:

| # | Decision |
|---|---|
| D1 | The start logic moves from the controller's private methods into an injectable `CollaborationStartService`; the controller delegates. Behaviour-neutral: `collaboration.controller.spec.ts` passes unchanged. The chat module calls the same service. No second start path |
| D2 | Discord starts never carry `sessionId`. So they are read-profile only (collaboration.controller.ts:281-291, :607). Nothing started from Discord can write, send or delete |
| D3 | Nothing in a Discord message can set provider, model, instructions, grants, approval settings, entitlements or budgets. The grammar is the fixed command list; everything else is task text |
| D4 | `orchestration.service.ts` and `ai-execution.controller.ts` are not edited (frozen contract). If the implementer finds an edit is needed: stop and return |
| D5 | Progress: a poller in the chat module reads each waiting delivery's run every 10 seconds through `getCollaborationRunWithReferrals` (what the Team page's poll does). It stops when no delivery waits. Off under Jest |
| D6 | A delivery older than 24 hours without an end is marked dropped (the hand-off itself times out at 24 hours) |
| D7 | The identity uses `apiKeyId: 'browser-session'`, as the session guard does, because that string is special-cased (quota.guard.ts:54). The channel is recorded in `chat_run_deliveries` and the audit row, not in `apiKeyId` |

### 6.3 Results and approvals come back by direct message

| Item | Design |
|---|---|
| Channel | Within 15 minutes the interaction token can edit the reply (source 2). After that the bot sends a direct message (`POST /users/@me/channels`, then a message; source 6) |
| Result | The final answer text, split at paragraph or line breaks into parts of at most 1900 characters (Discord's limit is 2000; source 7). At most 5 parts; then "cut — read the rest on the Results page". Plain content, no embeds, no files |
| Mentions | Every message sets `allowed_mentions: {parse: []}` so nothing in an answer can ping anyone (source 7) |
| Failed, timed out, cancelled | One translated line with the existing failure reason code. No raw provider error text |
| Approval request (Slice C2) | When a child hand-off waits: a message with the target's name, the step number, the request text cut to 1000 characters, and Approve and Reject buttons |
| Approve button | Server-side: link, owner, run ownership, hand-off still waiting, and `constraintReadOnly === true`. Then `approveReferral` as the owner. Anything not positively read-only is refused with "decide this on the Team page" |
| Without C2 | C1 alone sends "a step is waiting for your approval on the Team page". So C1 is complete without buttons |
| Rate limits | The library follows Discord's bucket headers and `retry_after`; the global limit is 50 requests a second (source 9). The module sends at most one message a second per owner |
| Delivery failure | Retried 3 times with backoff, then marked failed with an audit row. The result is on the Results page in every case |

### 6.4 Runs off

Staging runs with `GLOBAL_EXECUTION_ENABLED=false`. Then the bot stays connected; `/link`, `/unlink`, `/status`, `/language` and `/help` work; `/ask` gets the translated refusal at step 5 and creates nothing. With `CHAT_DISCORD_ENABLED=false` the module does not connect at all, the link routes answer "not available", and the page section says so.

### 6.5 Every Discord message is untrusted data

| Rule | How |
|---|---|
| Never instructions to the platform | Only the command name and its typed options are read. No text is parsed for settings, links or commands (the one exception is the leading `@name`, resolved against the owner's own list) |
| Only the linked owner's own words | The task is the invoking user's `text` option. Usernames, server and channel names, replies, forwarded messages, attachments and embeds never enter a prompt |
| No one else can speak | Direct-message commands only. A server channel message from another person never reaches a run |
| Length | `text` has `max_length` 6000 (the option limit; source 3), below the 8000 task limit |
| The model's limits are tools, not prompts | Read profile only (D2). Same position as the briefing: tool text is data, and limits are enforced by the tools granted (plan section 2; eval in `services/ai-service/src/agent-harness/eval/`) |
| Outbound | No mentions, no links added by the bot except the platform's own base URL |
| Eval | CHAT-LIVE-01 includes one injection probe: a task whose text tells the Chief of Staff to change settings, link another account and send mail. Pass: answered or declined as text, no action, no hand-off beyond the roster rules |

## 7. Privacy and safety

| Topic | Position |
|---|---|
| What leaves to Discord | The bot's fixed replies, result text, failure lines, and (C2) the cut hand-off request. Discord Inc. becomes an outside service that holds this text in the owner's direct-message history until the owner or Discord deletes it. The platform cannot delete it later |
| What Discord sends us | The Discord user id, the display name (held 10 minutes at link time only), the interaction locale, the command options |
| Never sent | The owner's e-mail, platform user id, session data, connector secrets, file contents outside a result |
| Stored | Section 5 tables. No Discord message text is stored by the chat module. The task text is stored where every task is stored today (the hand-off's `pending_job.prompt`), the answer in `result_summary` |
| Retention | Codes: minutes. Delivery rows: pruned after 30 days. Link: until unlink. Backups keep copies 30 days or less (Keith, 2026-11-13, TASKS_BACKLOG_FULL.md:84332). Runs and their text have no delete path today (docs/PRIVACY-DATA-INVENTORY.md section 4, gaps 2-3); this task does not change that |
| Deletion on unlink | Link, codes and delivery rows are deleted. Audit rows stay but hold no Discord id |
| Logs | Event names, ids, counts and reason codes. Never message text, result text, the code or the token. A test asserts the log calls |
| Consent (PDPA, Singapore first) | Before the code is made, the page shows a data statement in three languages: results are sent to Discord, a company outside Singapore; Discord keeps them under its own terms; unlink stops further sending. The owner ticks it. Purpose-limited: the link is used only to receive commands and send results. A lawyer confirms the wording with the rest of the privacy work (Q6 of the same decision) |
| Outside users | Gated per account like the rest of the front door. Nobody but Keith until the ACCESS-READY-01 conditions hold; Discord joins the list of outside services at that point (follow-up F3) |
| Kill switch | `CHAT_DISCORD_ENABLED` (default false; anything but the exact string `true` is off, like kill-switch.config.ts:18). It gates the connection, the link routes and delivery. It never turns runs on: `GLOBAL_EXECUTION_ENABLED`, the provider switch, credits and caps all still apply. The tester-window rules are untouched |
| Discord account takeover | Read-only runs and approvals, bounded by daily caps. The page's unlink ends it at once. A notice of each new link also shows on the Connections page |

## 8. i18n

| Text | Where | Mutex |
|---|---|---|
| Bot replies (help, refusals, started, waiting, cut, failures) | The gateway's own locale files `services/api-gateway/locales/en.json`, `zh-TW.json`, `zh-CN.json`, loaded by GW/config/i18n.ts:5-17 (precedent GW/auth/auth.service.ts:57) | GATEWAY |
| Command names and descriptions | The same three files, sent to Discord as localizations at registration | GATEWAY |
| Link section on the Connections page, data statement | `frontend/messages/en.json`, `zh-TW.json`, `zh-CN.json` | I18N |

How the bot knows the language: the link row stores the locale of the page where the code was made (`users` has no language column; `verification_tokens.locale` is the precedent, verification-token.entity.ts:41-42). `/language` changes it. Before a link exists the interaction's `locale` field is used (en-US or en-GB to en; zh-TW; zh-CN; anything else en). A test asserts every reply key exists in all three files. The agent's answer keeps the agent's own reply language; only the bot's frame text follows the link locale.

## 9. Slices

Baselines to compare against: gateway 4294 passed, 7 skipped, plus the 14 known `smoke.integration` failures; frontend 1877 of 1877; ai-service 1381 passed, 1 skipped; container-manager last recorded 983 passed, 3 skipped. This task changes neither ai-service nor container-manager; their suites are not rerun unless a slice touches them (none does).

Common stop conditions for every slice: a needed edit outside the write set; a needed change to a frozen-contract file; a change to guards, cookies, CSRF or internal routes; a new dependency not named here; a gate failure not in the known list.

| Slice | What | Write set (N = new) | Mutexes | Model | Checklists |
|---|---|---|---|---|---|
| **A1** Link backend | Tables, entities, link service (code, claim, confirm, cancel, unlink, limits), routes, audit, `CHAT_DISCORD_ENABLED` read. No Discord connection; claim is a service method the tests call | N `GW/migrations/1808000000000-CreateChatLinkTables.ts`; N `GW/entities/chat-link.entity.ts`, `chat-link-code.entity.ts`; `GW/entities/index.ts`; N `GW/chat/chat.module.ts`, `chat-link.service.ts`, `chat-link.controller.ts`, `chat-switch.ts`, their specs; `GW/app.module.ts`; migration test list under `GW/migrations/__tests__/` if it enumerates migrations | GATEWAY, MIGRATION | opus (auth-adjacent, migration) | EVERY, BACKEND, MIGRATION |
| **A2** Link page | A "Chat" section on the Connections page: data statement, Create code, pending claim with Confirm and Cancel, linked state with Unlink, "not available" state | `FE/components/connections/connections-screen.tsx`; N `FE/components/connections/chat-link-section.tsx`, `chat-link-api.ts`, `chat-link.logic.ts`, tests; the three `frontend/messages/*.json` | FRONTEND, I18N | sonnet (one-service UI and copy). Reads Impeccable, Emil and DESIGN.md | EVERY, UI |
| **B** Bot connection and commands without runs | The three packages; transport interface, Discord transport, fake; command registration; `/link`, `/unlink`, `/status`, `/language`, `/help`; `/ask` answers the "not built yet" or "runs off" refusal; reconnect guard; reply texts; env template keys | `services/api-gateway/package.json`, root `package-lock.json`; N `GW/chat/chat-transport.ts`, `chat-commands.ts`, `chat-replies.ts`, `GW/chat/discord/discord-transport.ts`, `discord-commands.ts`, specs; `GW/chat/chat.module.ts`, `chat-link.service.ts`; `services/api-gateway/locales/*.json` (3); `OPS/env/gateway.env.template`; `GW/startup/configuration.validator.ts` only if it must learn the new keys | PACKAGE, GATEWAY, ENV | opus (new outside connection, secret handling) | EVERY, BACKEND |
| **C1** Runs and results | D1 extraction; `/ask`, `@name`, `/cancel`; delivery table and poller; chunking; refusal mapping; audit | N `GW/orchestration/collaboration-start.service.ts` and spec; `GW/orchestration/collaboration.controller.ts`, `orchestration.module.ts`; N `GW/migrations/1809000000000-CreateChatRunDeliveries.ts`, `GW/entities/chat-run-delivery.entity.ts`; `GW/entities/index.ts`; N `GW/chat/chat-run.service.ts`, `chat-delivery.service.ts`, `chat-chunk.ts`, specs; `GW/chat/chat-commands.ts`, `chat.module.ts`, `discord/discord-commands.ts`; gateway locale files (3) | GATEWAY, MIGRATION | opus (cross-module, the approval gate, a migration) | EVERY, BACKEND, MIGRATION |
| **C2** Approvals in Discord | Approval messages with buttons; the read-only check; reject with a reason; expired buttons | `GW/chat/chat-delivery.service.ts`, N `chat-approval.service.ts`, `discord/discord-transport.ts`, specs; gateway locale files (3) | GATEWAY | opus (the approval gate) | EVERY, BACKEND |
| **D1** STAGING-DEPLOY-CHAT-01 | Deploy with the switch off, check; Keith types the token; switch on; new `gateway.env` baseline; live check 1 (section 10) | host only; checkpoint | STAGING, ENV | control plane from the host | EVERY, DEPLOY |
| **D2** CHAT-LIVE-01 | Run window, a real answer in Discord (section 10) | host only; checkpoint | STAGING, ENV, PROVIDER-LIVE, CREDIT | control plane and Keith | EVERY, DEPLOY, LIVE |

A1 and A2 can run in two lanes at once (no shared file; the route shapes in section 5 are the frozen contract between them). B, C1 and C2 run one after another (all hold GATEWAY). FLOWS does not apply: no slice touches checkpoints, revert or file actions.

Gates per slice:

| Slice | Gates |
|---|---|
| A1, B, C1, C2 | `services/api-gateway`: `npm test` (4294 + new, 7 skipped, the same 14 known failures), `npm run build` rc 0 |
| A2 | `frontend`: `npx tsc --noEmit`, `npm test` (1877 + new), `npm run build`, then restore `frontend/tsconfig.tsbuildinfo` |
| B | also `npm ls` for the three packages and `npm audit --omit=dev` recorded; lockfile diff limited to the new packages and their dependencies |

Acceptance criteria:

| Slice | Criteria |
|---|---|
| A1 | (1) Only the hash is stored; the code is returned once. (2) Expired, used, replaced and wrong codes all give the same claim answer. (3) A claim alone creates no link; confirm by the signed-in owner does. (4) Limits in section 5 hold, with tests. (5) Both unique indexes hold. (6) Unlink deletes link and codes. (7) Routes refuse without session (401) and without harness access (403). (8) Switch off: routes answer "not available" and write nothing. (9) Audit rows carry no Discord id and no code. (10) Migration up and down tested |
| A2 | (1) Every state renders in three languages with no hardcoded text. (2) The code cannot be made before the data statement is ticked. (3) The code is shown once and not kept in browser storage. (4) Confirm shows the Discord name and id ending. (5) Existing Connections tests and test ids unchanged |
| B | (1) Switch off or token missing: no connection, gateway boots, one log line without the value. (2) Intents value is 0. (3) Commands registered for direct messages with zh-TW and zh-CN localizations. (4) Every reply key exists in three files. (5) An unlinked user gets only fixed text. (6) The token appears in no log call (test). (7) Reconnect guard stops after 20 failed identifies. (8) No connection under Jest. (9) `/ask` creates nothing in this slice |
| C1 | (1) `collaboration.controller.spec.ts` unchanged and green after D1. (2) A Discord start equals the page's start for the same owner and body (test compares the stored hand-off). (3) No `sessionId` ever. (4) Runs off, not entitled, inactive user, over cap, provider off, no credits: each a translated refusal; where a run was created it is cancelled. (5) Final answer delivered in parts of at most 1900 characters, at most 5, mentions off. (6) No message or result text in logs or audit (test). (7) Delivery rows pruned after 30 days and deleted on unlink. (8) The frozen-contract files are untouched (`git diff --stat` shows neither) |
| C2 | (1) Approve and Reject go through the existing service calls with the owner as `decidedBy`. (2) A step that is not positively read-only is refused. (3) A button pressed by anyone but the linked owner, on a decided step, or after unlink does nothing. (4) The request text is cut to 1000 characters |

## 10. Live checks

Staging today: runs off, every provider switch off, no provider key in `ai.env` (STAGING-DEPLOY-PSWITCH-01, TASKS.md:980). So the live check is staged.

**Live check 1 (inside STAGING-DEPLOY-CHAT-01; no runs, no provider key, no credits):**

| Who | Step | Pass |
|---|---|---|
| Host | Deploy with `CHAT_DISCORD_ENABLED=false`; migrations applied; the earlier deploy checks | all pass; no connection line in the journal |
| Keith | Portal steps of section 4; token at the hidden prompt | script prints "set" and the new hash only |
| Host | Switch on, restart the gateway | one "chat ready" line; no new listening port (`ss -ltn` unchanged); the token string absent from the journal |
| Keith | Connections page: tick the statement, Create code. Discord: `/link`. Page: Confirm | page shows linked; bot says linked |
| Keith | `/status`, `/help`, `/language zh-TW`, then `/ask` with a marker word | refusal "runs are switched off" in zh-TW; no run row created |
| Host | Tables and audit rows; search the journal for Keith's marker word | rows as expected; marker absent from logs; audit rows hold no Discord id |
| Keith | `/unlink`, then `/ask` | "link first"; link, code and delivery rows gone |
| Host | Record the new `gateway.env` baseline hash | recorded in the checkpoint |

**Live check 2 (CHAT-LIVE-01; needs a run window):** it needs a provider key typed by Keith on the host, `GLOBAL_EXECUTION_ENABLED` and one provider switch on for the window only, and credits. It holds STAGING, ENV, PROVIDER-LIVE and CREDIT, and the tester window must be closed. Recommendation: share one run window with ACCESS-01J-LIVE, which already waits for one (TASKS.md:980), to pay for a window once. Steps: `/ask` a question answered from Keith's Knowledge; the answer arrives by direct message; a roster hand-off waits, Keith approves it in Discord (C2) or on the Team page; the report-back and final answer arrive; the injection probe of 6.5; a long answer shows the split; cost measured; then everything off and the env files back at their recorded hashes.

## 11. PRD.md and ARCHITECTURE.md wording (drafts for Keith; lands with CHAT-LIVE-01, GOVERNANCE held)

PRD.md section 11, GATED table, new row:

> | Discord chat channel: a linked owner asks the Chief of Staff or one of their own workflows from a direct message with the platform's bot and receives the result there; read-only runs; linking needs a one-time code and a confirmation on the platform | Gated per account and behind `CHAT_DISCORD_ENABLED` (default off); proven on staging DATE (CHAT-LIVE-01); not in the private-beta promise |

PRD.md section 8, "Broad external integrations", narrowed:

> - **Broad external integrations**: No general third-party integration platform in current scope. The exceptions are GATED (section 11): allowlisted, platform-run, read-only connectors to the owner's own mail and calendar, and the Discord chat channel. Other chat channels (LINE, WhatsApp, WeChat via WeCom, Slack) and other integrations remain approved FUTURE.

PRD.md section 11, the paragraph at :626, one sentence replaced:

> The Discord chat channel is now GATED (see GATED); LINE, WhatsApp, WeChat via WeCom and Slack, and triggers (schedules, before a calendar event, matching mail), come later, off by default with daily limits.

ARCHITECTURE.md, new subsection after 13.5 (the plan calls it 13.8; today the last subsection is 13.5, see section 13 below):

> ### 13.6 Chat channels (GATED)
> The gateway module `chat/` links an owner to an outside chat account and carries commands in and results out. Discord is the first channel. The gateway opens an outbound WebSocket to Discord with no gateway intents; there is no public inbound address and no new service. `CHAT_DISCORD_ENABLED` (default false) gates the connection, the link routes and delivery; it never enables runs. Linking: the platform issues a one-time code (hash at rest, 10 minutes), the owner types it in Discord, and confirms on the platform. `chat_links` holds the Discord user id and reply language only. A command starts a run through the same start code as `POST /api/collaboration/runs`, as the linked owner, without a session, so read-profile only; the approval gate, entitlements, credits, daily caps and provider switches apply unchanged. Results are read from the run and sent as direct messages. Message text is untrusted data: only fixed commands are read, and no chat text is logged or written to `audit_events`.

ARCHITECTURE.md smaller lines: section 3 gateway list ("Chat channels (`chat_links`, `chat_link_codes`, `chat_run_deliveries`, `/api/chat-links`; CHAT-DISCORD-01)"); section 7 data-model row for the three tables; section 8 the five `/api/chat-links` routes; 13.1 a status row; section 14 one line "API Gateway → Discord: outbound WebSocket and HTTPS".

## 12. Open questions for Keith (recommendation first)

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| Q1 | Where the bot runs | Gateway module | A separate service with its own unit: wider ops change, a second key |
| Q2 | Library (new dependency, PACKAGE) | `@discordjs/core` 2.7.0, `@discordjs/ws` 2.0.4, `@discordjs/rest` 2.6.3, exact pins | `discord.js` 14.28.1 (one package, larger) |
| Q3 | Link direction | Code made on the platform, typed in Discord, confirmed on the platform. This changes the plan's "typed on the platform" | The plan's direction, with the phishing risk of section 5 |
| Q4 | Where people talk to the bot | Direct messages only, slash commands, no intents | Also a server channel: other people could see or trigger commands |
| Q5 | Free-text direct messages (no slash) | Not now; later as its own task (needs the DIRECT_MESSAGES intent, not privileged) | Now, in C1: more parsing of untrusted text |
| Q6 | Approving hand-offs in Discord | Yes for read-only steps (C2), since every Discord-started run is read-only | Team page only: C2 is dropped and C1's notice stays |
| Q7 | Does `/ask` also approve the first step | Yes; the command is the owner's request for that step and every check still runs | A second confirm button before anything runs |
| Q8 | Result text in Discord | The full answer, cut after 5 parts, with the data statement at link time | A notice only ("your result is ready") with nothing of the answer leaving the platform |
| Q9 | Who may link | Accounts with harness access; in practice Keith only for now | — |
| Q10 | One migration or two | Two (A1 link tables, C1 delivery table), each with its slice | One in A1, to migrate staging once |
| Q11 | Live check 2 timing | Share ACCESS-01J-LIVE's run window | Its own window |

## 13. Things in the plan and records that turned out different

| # | Finding |
|---|---|
| P1 | Plan 3.3 says the code is "typed on the platform". Section 5 recommends the reverse with a confirm (Q3) |
| P2 | Plan section 7 says "new 13.8 Chat channels". ARCHITECTURE.md has subsections 13.1 to 13.5 only; connectors and triggers have no 13.6 or 13.7 heading (connectors landed as rows and lines). The draft uses 13.6 |
| P3 | STAGING-DEPLOY-CHAT-01 and CHAT-LIVE-01 have sidecar candidates (`lane-saturation-state.json:8186`, `:8208`) but I found no body with a Task ID line in `TASKS_BACKLOG_FULL.md` (the only hit is the follow-ups line :88659). The brief expected bodies "if present": not present |
| P4 | The CHAT-DISCORD-01 body lists evidence class LOCAL-TESTS. That fits A1 to C2; the deploy and live tasks carry the staging and provider-live evidence |
| P5 | Plan A8 names "`@name` in chat" as existing. I found no such code (section 1.3). E3's `@name` here is built new, as the `agent` option and a leading `@name` |
| P6 | The backlog body's write scope says "new gateway module or services/chat-discord/". Section 2 chooses the gateway module; PACKAGE then falls on `services/api-gateway/package.json` and the root lockfile |
| P7 | Bot replies do not use the three frontend message files (I18N mutex); they use the gateway's own locale files under GATEWAY. Only the link page takes I18N |

## 14. Follow-ups noticed (named, not registered)

| # | Follow-up |
|---|---|
| F1 | CHAT-DISCORD-DM-01: free-text direct messages without a slash command (Q5) |
| F2 | CHAT-NOTIFY-ONLY-01: a per-owner setting "send a notice only, not the answer" (Q8) |
| F3 | Add Discord to the outside-services list in the privacy inventory and in the future privacy page (ACCESS-READY-01 items 10 and 15), before any second user links |
| F4 | CHAT-SESSION-01: Discord starts for the coding and advisors teams, which need a session; needs a way to choose the project |
| F5 | CHAT-RESULTS-OTHER-01: send results of runs started on the platform (Team page, later triggers) to the linked chat, as an opt-in |
| F6 | CHAT-SERVICE-SPLIT-01: move the transport to its own service and unit if a second channel or load makes that worth the ops change; includes a narrow internal key |
| F7 | CHAT-EVAL-01: fixed injection cases for chat-started tasks in the eval framework, beyond the one live probe |
| F8 | Backlog bodies for STAGING-DEPLOY-CHAT-01 and CHAT-LIVE-01 (P3) |
| F9 | A link-time and unlink-time e-mail notice to the owner through the platform mailer, as a takeover signal |
| F10 | Expired `chat_link_codes` and old delivery rows are pruned by the chat poller only while the switch is on; a prune that also runs with the switch off |

## 15. Sources (all read 2026-11-13)

| # | URL | Used for |
|---|---|---|
| 1 | https://docs.discord.com/developers/events/gateway | outbound WebSocket, intents, privileged intents, Message Content exceptions, 120 events per 60 s, 1000 IDENTIFY per 24 h and token reset |
| 2 | https://docs.discord.com/developers/interactions/receiving-and-responding | gateway or endpoint URL (exclusive), 3-second reply, 15-minute token, deferred and ephemeral replies, `user` in direct messages |
| 3 | https://docs.discord.com/developers/interactions/application-commands | contexts and install types, limits (100 commands, option `max_length` 6000, 25 choices), localizations, interaction `locale` |
| 4 | https://docs.discord.com/developers/topics/oauth2 | `bot` and `applications.commands` scopes, install URL, Public Bot |
| 5 | https://docs.discord.com/developers/reference | locales zh-TW and zh-CN, `Authorization: Bot`, API v10, TLS 1.2 |
| 6 | https://docs.discord.com/developers/resources/user | Create DM and its warning about opening many direct messages |
| 7 | https://docs.discord.com/developers/resources/message and https://docs.discord.com/developers/resources/application | 2000-character limit, `allowed_mentions`, install contexts |
| 8 | https://registry.npmjs.org/discord.js/latest, https://registry.npmjs.org/@discordjs/core/latest, https://registry.npmjs.org/@discordjs/ws/latest, https://registry.npmjs.org/@discordjs/rest/latest | versions, licence, Node range, size, dependencies |
| 9 | https://docs.discord.com/developers/topics/rate-limits | 50 requests a second, bucket headers, `retry_after`, 10,000 invalid requests per 10 minutes |

The pages were read through a summarising fetch tool, not line by line; quoted phrases are as the tool returned them. Items marked "not verified" in sections 3 to 6 are to be confirmed in Slice B before the live check.

CHECKLIST: EVERY applies to this step as a document-only write (one file, inside the write set, no source, test, record or governance edit; no runtime started; no secret read). The per-slice lists are named in section 9 and are counted in each slice's checkpoint.
FOLLOWUPS: 10 named in section 14, none registered here (registration is the control plane's step).
