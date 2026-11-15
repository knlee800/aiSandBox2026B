# STAGING-DEPLOY-CHAT-01 — Checkpoint

**Task:** STAGING-DEPLOY-CHAT-01 — Deploy the Discord chat channel and run live check 1
**Status:** COMPLETE AND LOCKED — 2026-11-15. Result: passed.
**Workstream:** PRODUCT. **Lifecycle:** 3-STEP. **Evidence class:** STAGING-RUNTIME. **Mutexes:** STAGING, ENV.
**Source:** registered by the CHAT-DISCORD-01 LOCK (3caa5e6). Keith approved the deploy ("Yes, deploy"); admitted 7fcc46d.

## Lifecycle record

| Step | Record | Repository commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING and ENV; stagingAuthorized true | 7fcc46d |
| 2. Deploy, Keith's bot setup and token, switch on, live check 1 | from the host and with Keith | none (host state only) |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Deploy (2026-11-14T04:00:01Z)

Script `C:\Users\knlee\aisb-preflight\STAGING-DEPLOY-CHAT-01\chat1-deploy.sh` (SHA-256 `f2612094068f10bf59dd0d73081d8b57c24b0f9e85245c2ed7754a52c5f1e3bf`, 55,620 bytes, no blank lines): the STAGING-DEPLOY-PSWITCH-01 script with the new target and run folder, the migration hash now expected to change, and a chat block. Output `chat1-deploy.out` (SHA-256 `a82e76625ca4230d40e725038083a13d13afbdeaee15967e1f749edc0ccff1b7`), scanned for key text: none.

- **Before:**
  - HEAD and DEPLOYED 5c67466; configuration at the baselines;
  - runs off; nothing open; ops library `d9eada27`.
- **Deploy:**
  - `aisandbox-deploy 7fcc46d6694f3f4d561a641089a5e01655cc28f2`, rc 0;
  - the deploy tool's pre-migration backup `/var/backups/aisandbox/20261114T035807Z`;
  - migration hash `9cfde25f` → `fa23a84de9535429ab9403283040fca354996af8d171336e84133ec163e2e521`;
  - the latest rows are CreateChatRunDeliveries1809000000000 and CreateChatLinkTables1808000000000.
- **After:**
  - configuration unchanged at that point (gateway.env `e0767286`, Caddyfile `205770cf`); units active;
  - every earlier check passed, including the provider checks with a temporary admin key, which was revoked;
  - the chat tables and their 3 unique indexes are present, with no rows;
  - `/api/chat-links` returns 401 without a session and 401 with the temporary API key alone (session only); POST code without a session returns 401;
  - the gateway logged `chat discord off reason=switch_off` and no connecting or ready line;
  - the build markers are present, and so are the `@discordjs/core`, `ws` and `rest` packages on the host.

## Keith's bot setup and token (2026-11-15)

- **Bot setup:** Keith created the Discord application and bot himself: Public Bot off (with the install link set to None first, which Discord requires), privileged intents off, a private server with only him, the bot installed with the `bot` and `applications.commands` scopes and no permissions.
- **Token:** Keith reset the token and typed it at a hidden prompt through `chat1-token.sh` (SHA-256 `ecd5961edc5d0504ac0e75b9a9b343465008389f57113f50a2b7f508d3d47710`; run once over `ssh -t`; deleted from /tmp after the run). The script appended `CHAT_DISCORD_ENABLED=false` and `DISCORD_BOT_TOKEN` to gateway.env, keeping its mode and owner, and printed only "set" and the hash. The control plane never saw the token.

## Switch on (2026-11-15T03:54:10Z)

Script `chat1-switchon.sh` (SHA-256 `c0d2f6bac434c67bb20ed75b757fcdc775d2cb869b5d0a897e424b2a216b8cdd`), output `chat1-switchon.out`.

- **Before:**
  - gateway.env `c3b1ca7b…`;
  - token length 72 (value not shown);
  - runs off; nothing open.
- **Switch on:**
  - `CHAT_DISCORD_ENABLED=true`, the gateway restarted, health 200;
  - the journal shows `chat discord connecting`, then `chat discord ready` one second later, then `chat discord commands registered count=7`.
- **Leak and port checks:**
  - token occurrences: 0 in the gateway journal since the restart, 0 in the whole boot journal;
  - listening ports unchanged, with 4000, 4001 and 4002 on 127.0.0.1 only;
  - units active.
- **New gateway.env baseline:** `1ecb298f6dc4680176e0440e25606b14c1e7c135e58bbb089dc1c4b1df6a81ea` (600 root:root). The Caddyfile and the other env files are unchanged.

## Live check 1 (2026-11-15, Keith: "Yes, all as described")

- **Keith's steps:**
  - On the Connections page he ticked the statement and created a code. He did this twice, because the first code was claimed but not confirmed.
  - In a direct message he used `/link` with the code, then pressed Confirm on the page, which showed the Discord name and id ending.
  - Then `/status`, `/ask` with the marker `pineapple7731` (the translated "runs are switched off" refusal), `/help` and `/language`.
  - Then `/unlink`, and `/ask` gave "link first".
- **Host check** (`chat1-check.sh`, SHA-256 `e7210abc3c18e3b011e711f5513790e1430e7bce8dfd3f254d25877650d6f2e7`, read only; output `chat1-check.out`, scanned for key text and 17–20 digit numbers: none):
  - rows now: links 0, codes 0, deliveries 0;
  - audit rows in category chat since the switch-on: link_code_created, link_claimed, link_code_created, link_claimed, link_confirmed, run_refused, link_removed. The payload keys are ids, counts, reason and stage only. Chat audit rows holding a Discord-id-shaped number: 0. Audit rows holding the marker: 0;
  - collaboration runs created since the switch-on: 0;
  - journal lines holding the marker, whole boot: 0;
  - chat log lines hold only names, outcomes and ids.

## State after

- **Code:** staging runs 7fcc46d, with migration hash `fa23a84d`.
- **Discord:** switched on and connected. Linking is gated per account and needs harness access, so in practice only Keith can link. No account is linked now.
- **Runs:** off (GLOBAL_EXECUTION_ENABLED=false), so `/ask` is refused until a run window.
- **Next:** CHAT-LIVE-01 gets a real answer and an approval in a run window, shared with ACCESS-01J-LIVE.

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code change; 5: records only; 8: no local runtime), DEPLOY 7/7 (1: STAGING and ENV held, ENV changed only by the two Discord keys and the switch; 2: baselines checked before the deploy and before the token step, new baseline recorded; 3 and 7: n/a, tester window closed; 4: nothing running, the expected commit and the new migration hash, health, guard, provider and chat checks pass; 5: from the host, Keith's token typed by him at a hidden prompt; 6: every output scanned for key text, the token value never shown or recorded, its absence from the journal checked)
FOLLOWUPS: 0 registered / 0 superseded / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-15 by the control plane:
- Lane 1 released EMPTY;
- STAGING and ENV released UNOWNED, with stagingAuthorized false;
- new gateway.env baseline `1ecb298f`.
