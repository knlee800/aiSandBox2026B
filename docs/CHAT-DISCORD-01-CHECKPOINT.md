# CHAT-DISCORD-01 — Checkpoint

**Task:** CHAT-DISCORD-01 — Discord chat channel
**Status:** COMPLETE AND LOCKED — 2026-11-14. Not deployed: STAGING-DEPLOY-CHAT-01, then CHAT-LIVE-01.
**Workstream:** PRODUCT. **Lifecycle:** 4-STEP. **Evidence class:** LOCAL-TESTS. **productClass:** APPROVED_FUTURE (authorized; GATED when live).
**Source:** registered 2026-11-09 by GOV-BIZ-AGENT-OPS-PLAN-01. Keith chose Phase 3 on 2026-11-13 ("Start Discord (Stage 5)") and approved the stage-start ("Yes, approve all eleven").

## Lifecycle record

| Step | Record | Repository commits |
|---|---|---|
| 1. Admission for the stage-start | Lane 1, no mutex | 6cb6aed |
| 2. Stage-start | docs/CHAT-DISCORD-01-STAGE-START.md, fable subagent (Fable 5.2), fast-forwarded; facts checked against the code | ae30cef, 9f2bf8f |
| 3, slice A1 | Link backend: GATEWAY, MIGRATION; opus; write set widened to 14 (0dd76d0) | 484f76f, 33adf2d, b9f037c, 2f4347e |
| 3, slice A2 | Link section on the Connections page: FRONTEND, I18N; sonnet | dc51ae7, 5ca9b04 |
| 3, slice B | Bot connection and commands: PACKAGE, GATEWAY, ENV; opus; write set widened to 22 (6fe2063) | e1fe19a, ce7746b, 2a1e01c |
| 3, slice C1 | Runs and results: GATEWAY, MIGRATION; opus; write set widened to 28 (7753d01) | fff407c, fbeb1eb, eb2cc45 |
| 3, slice C2 | Approvals in Discord: GATEWAY; opus | ddf8d06 |
| 4. LOCK | this checkpoint, board, backlog, sidecar and plan, canonical validator | this record |

## Keith's decisions (2026-11-13, stage-start section 12)

1. The bot is a gateway module, not a separate service.
2. It uses the `@discordjs/core` 2.7.0, `ws` 2.0.4 and `rest` 2.6.3 packages, pinned exactly.
3. Linking: the code is made on the platform, typed in Discord, then confirmed on the platform.
4. Direct messages only.
5. No free-text messages for now.
6. Approvals in Discord for read-only steps.
7. `/ask` approves the first step.
8. The full answer text goes to Discord, after a data statement the owner ticks.
9. Only accounts with harness access may link.
10. Two migrations.
11. Live check 2 shares ACCESS-01J-LIVE's run window.

Decided by the control plane during Step 3:
- the link routes use the session-only `SessionCookieGuard`, as the stage-start's "session auth" requires;
- the slash commands keep English names in every client, so `/link` matches the page;
- the command service and transport are normal Nest providers.

## What changed (services/api-gateway unless noted)

- **A1, link:**
  - Migration 1808 creates `chat_links` (unique on channel and Discord id; unique on owner and channel) and `chat_link_codes` (SHA-256 hash only, checked hex), both cascading from users; up and down are tested.
  - Link codes: one-time, 8 characters from 32 letters, 10 minutes, single use, replaced by a new one.
  - Claims: one answer for any invalid claim; a claim alone links nothing, and the owner confirms.
  - Limits: 5 codes per owner per hour, 5 claims per Discord user per hour, a pause after 100 failures in an hour.
  - Unlink deletes the link and its codes.
  - The five `/api/chat-links` routes: session only, plus harness access. With the switch off, GET says disabled and writes answer 503 `chat_link_unavailable` and write nothing.
  - Audit rows hold no Discord id and no code.
- **A2, page:** the Chat section on the Connections page (frontend), with 59 keys in en, zh-TW and zh-CN:
  - the data statement to tick, then a code shown once and never stored in the browser;
  - the pending claim with the Discord name and id ending, and Confirm or Cancel;
  - polling every 4 seconds, only while a code is live and the page is visible;
  - Unlink after a confirm step, and translated errors.
- **B, bot:**
  - The three packages: 12 lockfile entries, nothing else changed; `npm audit` is unchanged.
  - The transport sits behind a `ChatTransport` token and uses intents 0. It connects only with `CHAT_DISCORD_ENABLED=true` and `DISCORD_BOT_TOKEN` set, never under Jest, and never blocks boot. It stops after 20 failed identifies or a fatal close.
  - The token appears in no log line, and mentions are off in every reply.
  - Slash commands, for direct messages only: `/link`, `/unlink`, `/status`, `/language`, `/help`, `/ask` and `/cancel`. Descriptions are translated.
  - Replies come from `locales/*.json`. The env template gains `CHAT_DISCORD_ENABLED=false` and an empty `DISCORD_BOT_TOKEN`.
- **C1, runs:**
  - The Team page's start and approve code moved into `CollaborationStartService`. The controller's spec is byte-for-byte unchanged and green.
  - `/ask` (with an agent option or `@name`) starts a Chief of Staff run or the owner's own workflow:
    - as the linked owner, with the session guard's identity, never with a `sessionId` (so read-only);
    - it approves the first step through `approveReferral`, so every check runs: global and provider switches, daily caps, credits, token quota, workflow checks and the tests gate;
    - refusals are translated, and a refused run is cancelled.
  - `/cancel` cancels the owner's latest Discord run.
  - Migration 1809 creates `chat_run_deliveries`, cascading from `chat_links`.
  - A 10-second poller sends the final answer by direct message, in at most 5 parts of 1900 characters, with mentions off and retries. Rows are pruned after 30 days and deleted on unlink.
- **C2, approvals:** a newly waiting step gets an approval message with the request cut to 1000 characters and Approve and Reject buttons.
  - Button ids carry a random 128-bit token mapped on the server to the step, with no ids inside. It is valid 24 hours, works only for the linked owner, and is spent on a decision.
  - Read-only rule: approve is offered only when the step is constrained read-only with write tools off, and its target is a read-profile agent or the owner's own snapshotted workflow with read-only connectors, or exactly the Chief of Staff with the read profile. Anything else points to the Team page.
  - Approve goes through `approveStep` with the tests gate on. Reject goes through `rejectReferral` with the owner as `decidedBy` and the fixed `omitted` reason. The message is edited to show the decision.
- **Throughout:** no task, answer or request text and no Discord id in logs or audit rows. `orchestration.service.ts` and `ai-execution.controller.ts` are untouched.

## Control-plane review and gates

- **Read:** every slice's source diff.
- **Identity:** the Discord run identity is exactly the browser session's (`browser-session`, `ai:execute`, `isInternal: true`), so Discord runs are no more privileged than page runs. The page's safety checks run inside `approveReferral`, which Discord calls as the owner.
- **The migrations** drop only their own tables.
- **Mutation checks:** every slice's workers ran them (A1 14, A2 4, B 9, C1 10, C2 11), and each one made tests fail.

| Gate (control-plane rerun) | Baseline at 6cb6aed | Final (main ddf8d06, identical to the C2 branch) |
|---|---|---|
| api-gateway `npx jest --maxWorkers=2` | 4294 passed, 7 skipped, 14 known smoke.integration failures | 4623 passed, 7 skipped, the same 14 |
| api-gateway `npm run build` | rc 0 | rc 0 |
| frontend `npx tsc --noEmit`, `npm test`, `npm run build` | 1877 / 1877 | 1915 / 1915; tsc and build rc 0 (unchanged since slice A2) |
| ai-service `npx jest`, `npm run build` | 1381 passed, 1 skipped | 1381 passed, 1 skipped (not touched) |

The 14 failures are the database-dependent smoke suites. One full run during slice B showed a timing failure in `execution-safety.integration`; it passed alone and on two full reruns.

## Incident: packages installed through worktree links (slice B)

- **What happened:** the worker's approved `npm install` was refused by the permission check, so it wrote the lockfile only. Keith's later install in the worktree ran through the junctions to the main checkout. npm replaced both junctions with real folders and, through the gateway junction, removed `dotenv-expand` and `write-file-atomic` from the main checkout's `services/api-gateway/node_modules`, leaving 49 temporary folders there. The main root `node_modules` was untouched.
- **The fix:** at Keith's request the control plane ran `npm ci` in the main checkout (1208 packages; the gateway folder is back to 56 entries, with the Discord packages present). Every gate was then rerun on main.
- **Rule since then:** no npm command runs through linked `node_modules`, and package slices get no links. This is recorded in the control plane's tooling notes.
- **Leftover:** the folders `C:\Users\knlee\aisb-worktrees\CHAT-DISCORD-01-B` and `CHAT-DISCORD-01-C1` are unregistered leftovers that the permission check would not let the control plane delete; Keith deletes them.

## Not proven here (live)

STAGING-DEPLOY-CHAT-01 runs live check 1:
- deploy with the switch off;
- Keith creates the Discord app and bot and types the token at a hidden prompt;
- switch on;
- link, `/status`, `/help`, `/language`, and `/ask` getting the "runs are switched off" refusal;
- unlink;
- host checks of the rows and logs;
- a new gateway.env baseline.

CHAT-LIVE-01 then gets a real answer and an approval in a run window. Not verifiable offline:
- interactions arriving with intents 0;
- direct-message-only commands with a server install;
- Chinese descriptions accepted by the bulk command overwrite;
- the defer and edit timing;
- message buttons rendering and being removed on update.

## Follow-ups

- **Registered (NOT_READY; OPTIONAL by control-plane default; Keith may change):**
  - **Chat extensions:**
    - CHAT-DISCORD-DM-01 (free-text direct messages, Q5);
    - CHAT-NOTIFY-ONLY-01 (a "notice only" setting, Q8);
    - CHAT-SESSION-01 (coding and advisors teams from Discord);
    - CHAT-RESULTS-OTHER-01 (results of platform-started runs, opt-in);
    - CHAT-SERVICE-SPLIT-01 (the transport in its own service);
    - CHAT-EVAL-01 (injection cases for chat-started tasks).
  - **Account safety and housekeeping:**
    - CHAT-LINK-NOTICE-01 (an e-mail notice at link and unlink, and a notice of each new link on the Connections page);
    - CHAT-PRUNE-01 (pruning expired codes and old delivery rows while the switch is off; expired code rows deleted only on the next link call);
    - CHAT-STATE-PERSIST-01 (rate limits, delivery retry state and button tokens are held in memory and lost on restart; waiting steps are not re-sent with fresh buttons).
  - **Code tidy and other fixes:**
    - CHAT-TIDY-01 (agent-name autocomplete, the per-minute limit covering only /ask and /cancel, /help not mentioning the buttons, a typed reject reason, four `no-explicit-any` errors in discord-transport.ts);
    - WS-UPGRADE-01 (the existing `ws` 8.18.3 advisories, fixed in 8.20.2 and later; the Discord connection uses it);
    - GW-I18N-LOADER-01 (the gateway's existing `config/i18n.ts` looks broken at run time).
- **Bodies written:** STAGING-DEPLOY-CHAT-01 and CHAT-LIVE-01, F8. The PRD.md and ARCHITECTURE.md wording of stage-start section 11 lands with CHAT-LIVE-01.
- **Superseded:**
  - F3, Discord in the outside-services list, by ACCESS-READY-01 (a note added);
  - F8, by the two bodies above;
  - B's `/status` counts, by C1;
  - B's command-name question, by the English names;
  - unlink answering 503 while the switch is off, by A1 acceptance 8 as designed;
  - a code expiring in a hidden tab clearing on the next refresh, as designed;
  - the A2 button-class sharing and a DOM test harness, by BUILDER-POLISH-01 (a note added);
  - the optional delivery repository in ChatLinkService, by the review: the database cascade backs it up;
  - the Chief of Staff extension of the read-only rule, by the review above (Keith's Q6);
  - the incident's two leftover folders, by Keith's own step.

CHECKLIST: EVERY 11/11 (1: admitted 6cb6aed and each slice's admission; 2: 4-step with an approved stage-start; 3: fable, opus and sonnet named before each dispatch; 4: self-contained briefs, no further subagents; 5: every slice inside its write set, widened by the control plane before any edit, the new dependency approved by Keith; 6: tests added in every slice; 7: gates rerun by the control plane on every branch and on main; 8: no runtime started; 9: tsconfig.tsbuildinfo restored, dist ignored; 10: worktrees, cherry-picks and fast-forwards by the control plane, branches removed; 11: FOLLOWUPS line), BACKEND 6/6 (1: no auth, cookie, CSRF, internal-key or guard change, the existing session guard, entitlement, approve and reject paths reused; 2: no internal endpoint; 3: no generated-app template; 4: orchestration.service.ts and ai-execution.controller.ts untouched, the A1 route shapes frozen and kept; 5: both schema changes under MIGRATION; 6: compared with the baselines), MIGRATION 4/4 (1: held for 1808 and 1809; 2: ordered after 1807 and 1808, the 1807 spec's latest check made a filter; 3: up and down tested; 4: each down drops only its own tables), UI 9/9 (A2: translated in three languages, I18N held, existing icons only, both advisory skills read, DESIGN.md classes, every state translated and tested, no redesign, existing test ids kept, live check in STAGING-DEPLOY-CHAT-01)
FOLLOWUPS: 12 registered (CHAT-DISCORD-DM-01; CHAT-NOTIFY-ONLY-01; CHAT-SESSION-01; CHAT-RESULTS-OTHER-01; CHAT-SERVICE-SPLIT-01; CHAT-EVAL-01; CHAT-LINK-NOTICE-01; CHAT-PRUNE-01; CHAT-STATE-PERSIST-01; CHAT-TIDY-01; WS-UPGRADE-01; GW-I18N-LOADER-01) / 10 superseded (F3 by ACCESS-READY-01; F8 by the two bodies; the /status counts by C1; the command names by the English names; unlink while off by A1 acceptance 8; the hidden-tab code by design; the A2 class sharing and DOM harness by BUILDER-POLISH-01; the optional delivery repository by the review; the Chief of Staff read-only extension by the review; the leftover folders by Keith's step) / 0 dropped / 0 undisposed.

## Lock

COMPLETE AND LOCKED on 2026-11-14 by the control plane:
- Lane 1 released EMPTY;
- GATEWAY released UNOWNED;
- not deployed: staging still runs 5c67466.
