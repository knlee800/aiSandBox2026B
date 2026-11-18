# MAIL-READ-LIVE-01 — Checkpoint

**Task:** MAIL-READ-LIVE-01 — Live check of the one-message mail tool
**Status:** COMPLETE AND LOCKED — 2026-11-18. Result: passed.
**Workstream:** AGENT. **Lifecycle:** 3-STEP. **Evidence class:** PROVIDER-LIVE. **Mutexes:** STAGING, ENV, PROVIDER-LIVE, CREDIT.
**Source:** registered 2026-11-18 by the CONN-MAIL-READ-01 LOCK. Keith opened the run window on 2026-11-18 ("Yes, run it").

## Lifecycle record

| Step | Record | Commit |
|---|---|---|
| 1. Admission | Lane 1 with STAGING, ENV, PROVIDER-LIVE and CREDIT; the three authorizations true | 13841c7 |
| 2. Run window | from the staging host on 355e6db, 2026-11-18 03:17:50Z to 05:08:24Z | no code change |
| 3. LOCK | this checkpoint, board, backlog, sidecar and plan; validator | this record |

## The window

- **Phase a (03:18:50Z):** env files saved at the baselines (gateway.env 616841ca, ai.env 721f4772); nothing changed. Before: every trigger switch, schedules, the run-result tool and runs off; write and validation tools off; 0 credits used by Keith that day.
- **Phase b (03:32:28Z):** the stored Anthropic test key (never shown), claude-opus-5-5, runs on, the tool loop on, write and validation tools off; the gateway, the AI worker and Discord ready.
- **Phase c (04:02:56Z):** MAIL_TRIGGERS_ENABLED on.
- **Off (05:08:24Z):** env files restored byte for byte to 616841ca and 721f4772; every flag back (AI_PROVIDER stub, runs, schedules, event, mail, knowledge and chain triggers and the run-result tool off, Discord on); all four units active.

Each run was a Chief of Staff run started through `POST /api/collaboration/runs` with a temporary API key on Keith's account (scopes ai:execute and ai:harness, made on the host, never shown, revoked when the script ended), and its first step approved as the owner.

## Results

The connector calls come from the audit rows, which carry the tool, the outcome and the item count only.

| # | Step | Result |
|---|---|---|
| 1 | Keith sent a mail with PINEAPPLE61 in the subject to the connected mailbox (no trigger matches it) | — |
| 2 | Find run (PINEAPPLE62): list unread mail and answer only the PINEAPPLE61 mail's id | `mail_list_unread_metadata` ok, 25 items; the answer was the digits `733` only; 16 credits ✓ |
| 3 | Keith opened that mail (now read) | — |
| 4 | Read run (PINEAPPLE63): read ids 733 and 4000000000 with `mail_read_message` | `mail_read_message` ok, 1 item (the read message was found), then an error with 0 items (the made-up id); the answer (60 characters) names 4000000000 as not found and says yes, the subject has PINEAPPLE61; 7 credits ✓ |
| 5 | Mail triggers on; Keith mailed his PINEAPPLE31 trigger (1deb884c) | the timer's reads at 04:03, 04:13, 04:23, 04:33 and 04:44 UTC found no new unread Inbox mail; the read at 04:53:59 found 1 |
| 6 | The trigger's run | started by 1deb884c; at 04:54:04 it called `mail_read_message` (ok, 1 item) with the id the trigger gave; completed, its answer (167 characters) carries the task's PINEAPPLE32 marker; 7 credits ✓ |
| 7 | Diagnostic run (PINEAPPLE64), started while the mail seemed missing: answer the PINEAPPLE31 mail's id or NONE | `mail_list_unread_metadata` ok, 25 items; the answer was 539 characters, not the id or NONE; 16 credits (the trigger had fired meanwhile, so the answer was not needed) |
| 8 | The read at 05:03:58 | found the same mail again; no second row, no second run ✓ |

**Watch items from CONN-MAIL-READ-01:**
- **The id form.** The model sent the id as text in both reads (733 accepted, the trigger's id accepted); the gateway never refused a number.
- **The trigger text.** "Use your mail tool to read it" was enough: the triggered run chose `mail_read_message` with the trigger's id, not the unread list.

Neither needs a fix.

**Privacy:**
- no app-service journal line in the whole boot holds a PINEAPPLE marker or a knlee80 address;
- no audit row in the window holds either;
- no mail history row holds a marker or an address.

**After the close (checked at 05:15:41Z, past the next 10-minute tick):**
- 0 connector rows, 0 mail-trigger rows and 0 usage records since the close;
- 0 open executions and 0 active runs;
- the three temporary keys revoked;
- env files and Caddyfile at the baselines (616841ca, 721f4772, 205770cf).

**Credits:** 46 over 4 usage records (16, 7, 7, 16).

## Evidence

All files are in `C:/Users/knlee/aisb-preflight/MAIL-READ-LIVE-01/`.

| File | SHA-256 |
|---|---|
| `mrl-a.out` | `9b49415eb4476dec72dfdb47fa5121ef9ec74755ad5e97e713afd53cabc6b0d8` |
| `mrl-after.out` | `39e9799eac890a16ed3f212e4024d8ea6278dbd84ca9b0d831dfa52afda0d26a` |
| `mrl-after.sh` | `58350b66e781a810a31648b6647c99aac2a288a13a2ac9531aa45d695f30e249` |
| `mrl-b.out` | `27268f8d37a83a7cdad10ae0fe28f1ccc0e1b967dd81e9885914a57cd2f631de` |
| `mrl-c.out` | `d15dc663733106757a868f663428f16d2ad92d98ccadc56804c95a31f28a2695` |
| `mrl-off.out` | `7cc1377f62f25aff0d6ce4b9f98221c5485d79803e8c99e9091d8e7d9c12772e` |
| `mrl-off.sh` | `0cb908575d096438ad20d7c0e2509a28dc2871e3d7cfbcd3824374d0b852fa34` |
| `mrl-phase.sh` | `18795460d0e7f253e087cfbcf4b05f5f4fad3f5406ccbf623074ca60d86e1fff` |
| `mrl-pre.out` | `91543e69178166d2e8dc5edced111a4cc189c4b8fb3949c52fa086ba237b4c0d` |
| `mrl-pre.sh` | `1271a51d33740d39053c0903be1ca0fcf3e24328da73f3e25ee32ddabb72db95` |
| `mrl-r1.out` | `ec554335c11b87bb35574c1e6e18d91be9a77ad7c2d7fe74dec918edb23170a1` |
| `mrl-r2.out` | `62b21d51e79e5439260d4972772e6840060fff1e9cea8961816fc70996b5e726` |
| `mrl-r3.out` | `7ad18cd9dccd94d012f14a8ce889aac5f5bff39a42c05d74820feee36ae1ab04` |
| `mrl-run.sh` | `adac15b5169f0426d5a8dbec80cf9b5dcf0c80c763391bdb72ee000661ed1980` |
| `mrl-s1.out` | `baa8025b7f2021e9e2e389575b7eba87c1281feefbdb27264263f5084e12ac07` |
| `mrl-s2.out` | `b8bc704ab86e1ec5023410897d93db7cd95d43a4b76cb3af1923f1703c9c9113` |
| `mrl-s3.out` | `b89288420f9c829f82798a97f1dd08891fcf95453133bd1d12e0ffb43b664751` |
| `mrl-s4.out` | `0f969eeb3b0b955e8d96dbdb7927de8bdb388a3b853a248cf4af0546ed27a951` |
| `mrl-s5.out` | `301a4d1f5b6a5bdf4463ca757ba86823894c3a77e2fea01fc639bc5a4eaf578c` |
| `mrl-s6.out` | `f5873167c1d124954ac724dfea9de7fb6c88e81db3f17cc221183680fa4589ff` |
| `mrl-status.sh` | `e2abb114b3f8423c2d2809b49d8a39eaccb9c70d03a2793536468ce830893a6a` |
| `mrl-w1.out` | `79e6a52bc90405ab232e1c5b400287b9cdb92b563784f1727023951fb226ea13` |
| `mrl-w2.out` | `af80424ef1997e54cb79ab3ed5697c3ee2b9321b12e042a36f10a2b70969970b` |
| `mrl-w3.out` | `1a651620c13771b98a724ff1e9ab49ec418226a9ea2a0077f10e218e11d12245` |
| `mrl-w4.out` | `1a651620c13771b98a724ff1e9ab49ec418226a9ea2a0077f10e218e11d12245` |
| `mrl-w5.out` | `0a9557340fafee9f044222eeb3db67c7f90adbc44592a2db9675b74f17f54077` |
| `mrl-wait.sh` | `de9784880766c4ecb94fc332399895e53a485a91112811574a9ad32c7fdd0290` |
| `mrl-wait2.sh` | `24a5b31f326b143abb944e6bc7458dd957001e6c3679e5d146b19491b91eb54a` |
| `run.sh` | `dc36d0275cca19d5605872eb49e5584972439651141a7c00cd94dcf9ff539b96` |

Every output was scanned for key text; none.

## Limits

- **Read state.** That the read left message 733 read and unchanged rests on the code (EXAMINE and BODY.PEEK, tested in CONN-MAIL-READ-01) and on the same read path the unread tool has used live since CONN-03. The check did not inspect flags. An unread message was read by the triggered run, and the next read (05:03:58) still listed it as unread, so PEEK did not mark it read.
- **Delivery delay.** The PINEAPPLE31 mail first showed in the 04:53:59 read, about 50 minutes after phase c. Whether it was delivered late or sent again is not known to the control plane. The platform behaved as designed: every read found the Inbox, and the first read that saw the mail started the run.
- **Wording.** The diagnostic run did not follow its answer format; it served no check.

## Follow-ups

| Follow-up | Disposition |
|---|---|
| ARCHITECTURE.md's connector server and broker lines (and PRD.md's connector row, if Keith wants it) do not name the one-message tool | registered GOV-ARCH-MAIL-READ-01 (GOVERNANCE; Keith approves the wording) |
| Watch item: the model sending messageId as a number | resolved: text both times, no fix (from CONN-MAIL-READ-01, superseded there by this task) |
| Watch item: the trigger text "your mail tool" | resolved: the triggered run chose the new tool, no fix |

CHECKLIST: EVERY 11/11 (3, 4, 6, 7, 9: n/a, no worker and no code; 5: records and host state only, restored; 8: no local runtime; 10: the control plane's records; 11: FOLLOWUPS line), LIVE 3/4 + 1 n/a (1: PROVIDER-LIVE and CREDIT held; 2: the expected spend (about 50 to 60 credits, three runs) stated before the window, the key read from the stored key file on the host and never shown; 3: every result from host-side audit, usage and run rows; 4: n/a, no fix was needed, so no pause)
FOLLOWUPS: 1 registered (GOV-ARCH-MAIL-READ-01) / 0 superseded / 0 dropped / 0 undisposed (the two watch items were superseded into this task by CONN-MAIL-READ-01 and are resolved here with no fix needed).

## Lock

COMPLETE AND LOCKED on 2026-11-18 by the control plane:
- Lane 1 released EMPTY;
- STAGING, ENV, PROVIDER-LIVE and CREDIT released UNOWNED;
- stagingAuthorized, providerLiveAuthorized and creditAuthorized false;
- staging runs 355e6db, with runs and every trigger switch off.
