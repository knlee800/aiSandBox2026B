# CHAT-STATE-PERSIST-01 — Stage-start

Task: keep chat limits, retries and button tokens across restarts. Lifecycle 4-step, step 2 (this document). Drafted 2026-11-19 by a Fable 5.2 subagent, read-only on the repository. **Approved by Keith on 2026-11-19 ("Yes, approve it"), with the recommendation on all seven questions Q1 to Q7.** Addition at approval (control plane, from the CHAT-RESULTS-OTHER-01 LOCK): the migration also adds an `origin` column to `chat_run_deliveries` (text, nullable; 'chat' for /ask rows, 'platform' for the rest) so the Discord-only /ask limit, /cancel and /status read it instead of the run_started audit rows; existing rows read as before through the audit fallback.

Paths: `GW` = `services/api-gateway/src`. Line numbers are from `main` at 59c732b5. CHAT-RESULTS-OTHER-01 (Lane 1) edits `chat-delivery.service.ts`, `chat-run.service.ts`, `chat-transport.ts` and `chat.module.ts`, so this task starts only after it locks, and the lines will have moved.

## 0. Recommendation in short

| Topic | Decision |
|---|---|
| Delivery retry state, holds | Six new columns on `chat_run_deliveries`. Parts already sent are never sent again; held rows stay held |
| Link limits, pause, per-minute command limit | One small table `chat_limit_hits` (one row per counted event, sliding window read from the rows) |
| Approval buttons | Stored random token, only its SHA-256 at rest, in `chat_approval_tokens`, 24 hours, one per step. The custom id form `ap1:a:<token>` does not change. No signing key |
| Interaction tokens | Never stored. Memory only, as today |
| Two processes | A lease on the delivery row (`claimed_by`, `claimed_until`) plus compare-and-set on `parts_sent`. Two processes holding the Discord connection stays out of scope |
| Migration | One: `1817000000000-AddChatPersistedState` |
| Size | Two slices in one task, one migration (in slice 1) |
| Worker | opus subagent (migration, delivery and approval paths), evidence LOCAL-TESTS |

## 1. Inventory of in-memory chat state

| # | State | Where | Restart today | Two processes today |
|---|---|---|---|---|
| 1 | Link codes made per owner (5 an hour) | `GW/chat/chat-link.service.ts:338`, used :424-429 | Count resets: 5 more at once | 5 per process |
| 2 | Claim attempts per Discord user (5 an hour, then silence) | `chat-link.service.ts:339`, used :497-500 | Resets: guessing continues | 5 per process |
| 3 | Failed claims platform-wide (more than 100 an hour pauses linking) | `chat-link.service.ts:340`, :752-771 | Resets to 0 | 100 per process; one audit row each |
| 4 | Linking pause (`pausedUntil`, 1 hour) | `chat-link.service.ts:341`, :748 | Pause ends early | Only the process that tripped is paused |
| 5 | `/ask` and `/cancel` per owner (10 a minute) | `GW/chat/chat-run.service.ts:154-167`, :182, :199, :288 | Resets (window is 60 s) | 10 per process |
| 6 | Delivery attempts per run: `failures`, `nextAt`, `partsSent` | `GW/chat/chat-delivery.service.ts:117-121`, :181, :383-386, :416-449 | `partsSent` lost: a partly sent result is sent again from part 1; the failure count restarts | Both send every part |
| 7 | Held deliveries (direct message refused) | `chat-delivery.service.ts:123-129`, :184, :244-268, :331-357 | Forgotten: the boot pass tries the direct message again and holds again, one log line per run per restart | Each process tries and holds on its own; a command wakes only the process that got it |
| 8 | Last send time per link (1 message a second) | `chat-delivery.service.ts:182`, :527-535 | Resets; harmless | Not shared |
| 9 | Poller flags (`timer`, `ticking`, `again`, `destroyed`) | `chat-delivery.service.ts:186-190` | Rebuilt at boot (`wake`, :217) | Per process, by design |
| 10 | Approval button tokens (128-bit random, 24 hours, at most 2000) | `GW/chat/chat-approval.service.ts:149-156`, :261, :310-317, :355-362, :473-489 | All buttons answer "no longer works"; the step is in `notified_referral_ids`, so no new message is sent | A press works only in the process that made the button |
| 11 | Interaction references per Discord user (application id, interaction token, time, answered promise; 14 minutes; at most 10000) | `GW/chat/discord/discord-transport.ts:269-276`, :482, :664-689; cleared :566, :767 | Lost: results go by direct message, or are held if Discord refuses | Only in the process that got the interaction |
| 12 | Identify guard (20 failed identifies in 24 hours stops the bot) | `discord-transport.ts:242-260`, :480 | Count resets | One count per process |
| 13 | Connection facts (`applicationId`, `botUserId`, `sessionUp`, `commandsRegistered`, state) | `discord-transport.ts:483-490` | Rebuilt from Discord's READY | Per connection |
| 14 | Activity listeners | `GW/chat/chat-transport.ts:157` | Rebuilt at boot | Per process |

Already in the database and unchanged: `chat_links`, `chat_link_codes`, `chat_run_deliveries.status` and `notified_referral_ids`.

## 2. Persist, rebuild or leave

| # | Decision | Reason |
|---|---|---|
| 1-4 | Persist (`chat_limit_hits`) | They are the guard against guessing a 40-bit link code; a deploy must not reset them |
| 5 | Persist in the same table | Same store, a few lines. The real bounds (3 runs in progress, daily caps, credits) are already in the database, so this is tidiness; see Q4 |
| 6 | Persist (`parts_sent`, `send_failures`, `next_attempt_at`) | The only way a partly sent result continues instead of starting over |
| 7 | Persist (`held_at`) | A held row stays held; no direct-message retry and no log line per restart |
| 8 | Leave in memory | One second of spacing; Discord's own rate limits cover the gap after a restart |
| 9, 13, 14 | Rebuild at boot | Process wiring, not state |
| 10 | Persist (`chat_approval_tokens`) | Buttons keep working, so nothing has to be sent again |
| 11 | Never persist | See 2.1 |
| 12 | Leave in memory | A restart is the guard's designed reset. A crash loop that identifies on every boot is a host problem (systemd restart limits); see Q5 |

### 2.1 Interaction tokens: never stored

An interaction token is a bearer credential: for 15 minutes anyone holding it can post follow-up messages to that user as the bot and edit or delete the bot's answer. Storing it would put live credentials in the database and in every backup, and would tie the chat module to an encryption key it does not have today.

What storing would buy: a user whose direct messages Discord refuses, who used a command less than 14 minutes before a deploy, and whose run ends just after it, would get the result without typing another command. With section 3 that user's result is held (now in the database) and arrives on their next command; it is on the Results page in every case. Users whose direct messages work lose nothing.

Recommendation: do not store. If Keith wants it anyway: AES-256-GCM with a key derived from `CONNECTOR_CREDENTIALS_KEY` by a fixed label (the pattern of `connectorGrantTokenKey` in `GW/connectors/connector-crypto.ts`), one row per Discord user, deleted at 14 minutes, on a failed follow-up and on disconnect. That is a separate task with its own security review, not this one.

### 2.2 Button tokens: stored, hashed, expiring

Today: `crypto.randomBytes(16)` as 22 base64url characters in the custom id; the map holds link, owner, run, step and expiry. All six checks of a press are re-read live.

| Option | For | Against |
|---|---|---|
| **A. Stored random token, SHA-256 at rest (recommended)** | No key to manage. Can be revoked (unlink, decision, send failure). The custom id form and every press check stay as they are. A database read does not give working custom ids | One row per waiting read-only step |
| B. Signed token (HMAC over link, run, step, expiry) | No table | Needs a signing key (a new env secret, or coupling to the connectors key); cannot be revoked; ids move into the custom id; Discord's 100-character limit |

With A a token row is: token hash, link, owner, run, step id, step number, expiry. Issuing a token for a step that already has one replaces it (unique on the step), so only the newest message's buttons work. A press looks the row up by hash; the checks 1 to 6 in `chat-approval.service.ts:59-70` are unchanged. The row is deleted on a decision, when the step or run is no longer available, when the message could not be sent (`revoke`), at expiry, and by cascade with its delivery row. The 2000-token cap goes: rows are bounded by waiting steps and the 24-hour expiry.

## 3. Schema

Migration `1817000000000-AddChatPersistedState` (class `AddChatPersistedState1817000000000`), next after `1816000000000-AddChainTriggerFiresOn`. Check at admission that no other task of the Discord batch took 1817. Style as 1809 and 1816: probe first, refuse on an unexpected state, plain SQL, no `IF EXISTS`.

**3.1 `chat_run_deliveries`, new columns**

| Column | Type | Meaning |
|---|---|---|
| `parts_sent` | integer NOT NULL DEFAULT 0, CHECK >= 0 | Result parts already sent |
| `send_failures` | integer NOT NULL DEFAULT 0, CHECK >= 0 | Failed attempts so far (failed after the 4th, as today) |
| `next_attempt_at` | timestamptz NULL | Not before this time (backoff 10 s, 30 s, 90 s) |
| `held_at` | timestamptz NULL | Set when Discord refused the direct message; cleared by the user's next command or press |
| `claimed_by` | varchar(36) NULL | The gateway process working on the row (a random id made at boot) |
| `claimed_until` | timestamptz NULL | The claim ends by itself at this time |

No new index: the poller's `(status, created_at)` index still serves. Existing rows take the defaults. No row is rewritten by hand.

**3.2 `chat_limit_hits`** (one row per counted event)

| Column | Type |
|---|---|
| `id` | bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY |
| `bucket` | varchar(24) NOT NULL, CHECK IN ('code_create', 'claim_attempt', 'claim_failed', 'link_pause', 'command') |
| `subject_key` | varchar(64) NOT NULL |
| `occurred_at` | timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP |

Index `idx_chat_limit_hits_bucket_subject_occurred_at` on (`bucket`, `subject_key`, `occurred_at`). `subject_key` is the owner id (`code_create`, `command`), the SHA-256 hex of the Discord user id (`claim_attempt`), or the channel name `discord` (`claim_failed`, `link_pause`). The Discord user id itself is not stored here (Q3). A pause is one `link_pause` row: linking is paused while such a row is younger than 1 hour. No foreign keys.

**3.3 `chat_approval_tokens`**

| Column | Type |
|---|---|
| `token_hash` | varchar(64) PRIMARY KEY (SHA-256 hex of the token) |
| `collaboration_run_id` | text NOT NULL REFERENCES `chat_run_deliveries`(`collaboration_run_id`) ON DELETE CASCADE |
| `link_id` | uuid NOT NULL |
| `user_id` | uuid NOT NULL |
| `referral_id` | text NOT NULL, unique index `uq_chat_approval_tokens_referral_id` |
| `step` | integer NOT NULL |
| `expires_at` | timestamptz NOT NULL, index `idx_chat_approval_tokens_expires_at` |
| `created_at` | timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP |

Unlink deletes the delivery rows (code and the existing cascade), which deletes the tokens.

**3.4 Retention and pruning**

| Data | Removed |
|---|---|
| Limit hits | Rows of the same bucket and subject older than its window are deleted on every write; the delivery pass deletes all rows older than 1 hour. Nothing lives longer than needed except while no write and no pass happens (CHAT-PRUNE-01's always-on prune should include this table and expired tokens; one line in whichever lands second) |
| Tokens | On decision, unavailable, revoke; expired rows on every issue and every delivery pass; cascade |
| Delivery columns | With the row (30-day prune, unchanged) |

**3.5 up and down**

- up: refuses unless `chat_run_deliveries` exists, `parts_sent` does not, and neither new table exists. Then one `ALTER TABLE` adding the six columns, two `CREATE TABLE`, three `CREATE INDEX`.
- down: refuses unless all three are present. Drops `chat_approval_tokens`, `chat_limit_hits`, then the six columns. Loses: the counters and any pause (limits start fresh), the buttons (they answer "no longer works"), and the retry state (a result that was partly sent at that moment is sent again from part 1, once). No run, result, link or delivery row is lost.

## 4. Behaviour after a restart

| Case | Behaviour |
|---|---|
| Limits | Counted from the rows: the fifth code this hour is still the fifth after a deploy; a pause lasts its full hour; `retryAfterSeconds` comes from the oldest row in the window |
| Partly sent result | Each part's success is written before the next part is sent (`parts_sent` n to n+1). After a restart the pass continues at part `parts_sent + 1`. Parts are cut again from the same stored answer, so they are the same parts |
| A crash between Discord's "sent" and the database write | The one part in flight could be sent twice. To close this for direct messages, each part carries Discord's `nonce` with `enforce_nonce` (a value derived from run id and part number), which makes Discord drop a repeat within a few minutes. The implementer confirms both fields in Discord's Create Message documentation before using them; follow-ups cannot carry a nonce, so that narrow window stays for them (Q2) |
| Failed sends | `send_failures` and `next_attempt_at` are read from the row; the fourth failure still ends in `failed` with one audit row |
| Held deliveries | The pass reads only rows with `held_at` empty, so a held row is not tried and writes no log line. The user's next command or press clears `held_at` for that link's waiting rows and runs a pass, as today. The 24-hour drop still applies to held rows |
| Waiting approval, buttons sent before the restart | The buttons still work (token rows). No new message |
| Waiting approval, no live token (the deploy of this task itself; rows lost by a rollback) | One repair rule in the pass: a step that is waiting, already notified and positively read-only, with no token row, gets one fresh message with new buttons. The new token row is what stops a second one. Steps that only get the Team page line are not sent again |
| Run ended during the restart | The boot pass picks the waiting row up, as today |
| Transition, once | The deploy that brings this task still loses the old in-memory state one last time. STAGING-DEPLOY-CHATBATCH-01 already deploys with nothing running |

No duplicates: results by `parts_sent`; approval notices by `notified_referral_ids` (unchanged) and one token per step.

## 5. Concurrency

The task is ready "before more than one gateway process", so the row logic is made safe now; it costs two columns.

| Guard | How |
|---|---|
| One worker per delivery row | Before working on a row: `UPDATE ... SET claimed_by = <me>, claimed_until = now + 120 s WHERE run = ? AND status = 'waiting' AND (claimed_until IS NULL OR claimed_until < now)`. One row changed means the claim is held. Released at the end of the row; a crashed process's claim runs out by itself |
| No part twice | After each part: `UPDATE ... SET parts_sent = n + 1, claimed_until = now + 120 s WHERE run = ? AND status = 'waiting' AND parts_sent = n AND claimed_by = <me>`. Zero rows changed: stop, another process has the row |
| Finish | Unchanged: `status` moves only from `waiting` (`chat-delivery.service.ts:543-546`) |
| Limits | Count and insert in one transaction under `pg_advisory_xact_lock` on bucket and subject, so two processes cannot both take the last slot and only one writes the pause row and its audit row |
| Button press | Row lookup, then the Team page's own approve or reject; a second press of the same step is refused by the orchestration's own state check, as today |
| Token replace | The unique index on the step |

Why a lease and not `SELECT ... FOR UPDATE SKIP LOCKED`: sending five parts takes seconds, and a row lock would hold a database transaction open across network calls.

Out of scope, and each still blocks a second gateway process:

- Two processes holding the Discord connection. Both would receive and answer every command. Needs one connection owner (CHAT-SERVICE-SPLIT-01 or a leader lock).
- Waking the poller in another process, and interaction references in another process. Both go away with one connection owner.
- The one-message-a-second spacing and the identify guard across processes.

## 6. Work plan

**Slices (one task, one worktree, two commits):**

| Slice | Content |
|---|---|
| S1 | The migration and its spec; the entities; delivery: `parts_sent`, `send_failures`, `next_attempt_at`, `held_at`, the claim, the nonce, the pass query |
| S2 | `chat-limits.ts` and its use in the link service and the run service; the pause; stored approval tokens; the fresh-button repair rule |

S1 can lock on its own if S2 has to wait: the tables of S2 would exist unused.

**Write set (exact):**

- `services/api-gateway/src/migrations/1817000000000-AddChatPersistedState.ts` (new)
- `services/api-gateway/src/migrations/__tests__/1817000000000-AddChatPersistedState.spec.ts` (new)
- `services/api-gateway/src/entities/chat-run-delivery.entity.ts`
- `services/api-gateway/src/entities/chat-limit-hit.entity.ts` (new)
- `services/api-gateway/src/entities/chat-approval-token.entity.ts` (new)
- `services/api-gateway/src/entities/index.ts`
- `services/api-gateway/src/chat/chat-limits.ts`, `chat-limits.spec.ts` (new)
- `services/api-gateway/src/chat/chat-link.service.ts`, `chat-link.service.spec.ts`
- `services/api-gateway/src/chat/chat-run.service.ts`, `chat-run.service.spec.ts`
- `services/api-gateway/src/chat/chat-delivery.service.ts`, `chat-delivery.service.spec.ts`
- `services/api-gateway/src/chat/chat-approval.service.ts`, `chat-approval.service.spec.ts`
- `services/api-gateway/src/chat/chat-transport.ts` (an optional dedupe key on `sendToUser`; the fake)
- `services/api-gateway/src/chat/discord/discord-transport.ts`, `discord-transport.spec.ts` (the nonce fields only)
- `services/api-gateway/src/chat/chat.module.ts`
- `services/api-gateway/src/chat/chat-link.controller.spec.ts`, `chat-commands.spec.ts` (test setup only, if the new provider needs wiring)

Entities are loaded by glob (`GW/config/database.config.ts:21`), so no list file changes. Records by the control plane at LOCK (GOVERNANCE): ARCHITECTURE.md lines 231, 580 and 1193 name the chat tables and say buttons are "random tokens mapped on the server".

**Mutexes:** GATEWAY, MIGRATION. No frontend, no I18N, no PACKAGE, no ENV (no new variable). **Evidence class:** LOCAL-TESTS. **Checklists:** EVERY, BACKEND, MIGRATION.

**Worker:** Claude subagent, opus (Opus 5.5): a migration, plus the delivery and approval paths. The MIGRATION checklist's Cursor model (grok-4.7-xhigh) applies only if Keith prefers Cursor.

**Tests (unit, with fakes; no database is started):**

- Migration spec in the style of the 1816 spec: timestamp is the newest; exact up and down SQL; up refuses when a column or table already exists or `chat_run_deliveries` is missing; down refuses unless all are present; no `DELETE`, `UPDATE`, `TRUNCATE` or `IF EXISTS`; entity columns match the SQL.
- Limits: counting survives a new service instance over the same fake store (this is the restart test, used for every item below); the sixth code and the sixth claim are refused; hit 101 pauses once with one audit row; the pause ends after an hour; old rows are deleted; a store error refuses the action.
- Delivery: a new service instance continues at part 3 of 5 and sends parts 3 to 5 only; failures and backoff carry over and the fourth failure fails the row; a held row is skipped by a new instance with no send and no log line; a command clears the hold and the parts go out; a held row is dropped at 24 hours; a row claimed by another process is skipped; an expired claim is taken over; a lost compare-and-set stops sending.
- Approvals: a button made by one instance is honoured by another; a wrong, expired, replaced or spent token does nothing; the token text is never stored (only its hash); unlink removes tokens; a failed send revokes; the repair rule sends exactly one fresh message for a notified read-only step without a token and none on the next pass; a Team-page-only step is not sent again.
- Every existing chat spec still passes; the gateway gates are compared with the known failures in the latest gateway checkpoint.

**Stop conditions for the worker:** any need to touch a file outside the write set; `nonce` or `enforce_nonce` not in Discord's documentation as described (then leave the nonce out and report); any change to a guard, the press checks or the delivery rules of section 8.

## 7. Risks and open questions for Keith (recommendation first)

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| Q1 | Store interaction tokens so held results go out right after a deploy? | No, never stored (2.1) | Encrypted with a key derived from the connectors key, as its own task |
| Q2 | The one part in flight during a crash | Accept the narrow window and add Discord's nonce for direct messages | Write the count before sending: never a repeat, but a crash can lose one part |
| Q3 | Claim limits need a key per Discord user. Store the SHA-256 of the id for at most an hour? | Yes. A snowflake hash can be reversed by trying ids, so treat it as the id at rest for an hour; the plain id is already in `chat_links` for linked users | Plain id (simpler, same exposure) or a keyed hash (needs a key) |
| Q4 | Persist the 10-a-minute command limit too? | Yes, same store | Leave it in memory: a restart resets at most one minute |
| Q5 | Persist the identify guard? | No, not here | A follow-up task if the host ever crash-loops |
| Q6 | A fresh button message for steps whose buttons died in this task's own deploy | Yes, the repair rule in section 4 (the old message stays, its buttons answer "no longer works") | No repair: those steps are decided on the Team page |
| Q7 | One task with two slices, or two tasks? | One task, two slices, one migration | Register S2 as its own task |

Risks:

- The migration is proven by SQL-shape tests only; it first runs against PostgreSQL in STAGING-DEPLOY-CHATBATCH-01, which then has a new migration hash and a rollback note (3.5).
- Every limited action now costs one short transaction; every pass costs a claim and a release per row. At today's volume this is not measurable.
- Parts are re-cut from the stored answer. If the user changes `/language` between two parts of one result, the cut notice on part 5 can differ in length. Cosmetic.
- Rows in backoff no longer take a place in the 20-row batch (they are filtered in the query). A small improvement, noted because it changes which rows a pass reads.
- If the database is down, limits refuse and buttons answer the fixed error line. The run paths need the database anyway.

Follow-ups noticed (named, not registered): one Discord connection owner before a second gateway process (may be superseded by CHAT-SERVICE-SPLIT-01); the identify guard across restarts (Q5); CHAT-PRUNE-01 to include `chat_limit_hits` and expired tokens.

## 8. What is not changed

- Guards, platform auth, sessions, CSRF, internal routes, entitlements, the kill switch.
- The six checks of a button press, the read-only rule (`chatStepIsReadOnly`), the approve and reject calls, and the custom id form.
- The delivery rules: parts of at most 1900 characters, at most 5 parts, 3 retries with 10 s, 30 s and 90 s, one message a second per owner, mentions off, follow-up first and direct message second, a refused direct message is held and not failed.
- The 24-hour drop, the 30-day prune of finished rows, and `result_seen_at`. The Results page is untouched.
- The limit numbers: 5 codes an hour, 5 claims an hour, pause after more than 100 failed claims, 10 commands a minute, 3 runs in progress.
- The link flow, the code format and its hashing, the audit event names and what audit rows and logs may hold (ids, counts, reason codes; never a token, a custom id, a Discord id or message text).
- Interaction references: memory only, 14 minutes, cleared on disconnect.
- No new environment variable, dependency, route, frontend change or translation.
- `CHAT_DISCORD_ENABLED` off: nothing is read or written, as today.
