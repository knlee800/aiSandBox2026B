# CHAT-STATE-PERSIST-01 — Checkpoint

**Task:** CHAT-STATE-PERSIST-01 — keep chat limits, delivery progress, holds and approval buttons across gateway restarts.
**Status:** COMPLETE AND LOCKED — 2026-11-19. MIGRATION released; GATEWAY passes to the next batch task.
**Loop:** 4-step: admission (2d66d2a, with the stage-start docs/CHAT-STATE-PERSIST-01-STAGE-START.md approved by Keith, "Yes, approve it", all seven recommendations); write-set widening by one test file (8bc1c50, after the worker stopped correctly in S1); implementation by an opus subagent (Opus 5.5) in worktree lane/CHAT-STATE-PERSIST-01, S1 b997976 and S2 e5e94a4, cherry-picked to main as a74c361 and e21972c; this LOCK. Part of Keith's Discord production batch.

## What changed (23 files, 2695 insertions, 291 deletions; exactly the write set)
- **Migration 1817000000000-AddChatPersistedState** (up probes, then): chat_run_deliveries gains parts_sent, send_failures (both integer NOT NULL DEFAULT 0 with CHECK >= 0), next_attempt_at, held_at, claimed_by varchar(36), claimed_until, and origin text with CHECK ('chat', 'platform') and DEFAULT 'platform' (existing rows stay NULL); new table chat_limit_hits (identity id, bucket CHECK of five values, subject_key varchar(64), occurred_at; index on bucket, subject_key, occurred_at); new table chat_approval_tokens (token_hash PK, run id FK to chat_run_deliveries ON DELETE CASCADE, link, user, referral (unique), step, expires_at (indexed), created_at). Down drops exactly that, after probing. No DELETE, UPDATE, TRUNCATE or IF EXISTS.
- **Delivery (S1)**: progress, failures, backoff and holds on the row; a lease (claimed_by, claimed_until) and compare-and-set on parts_sent, so a restart continues at the next part and two processes never send the same part; result parts sent by direct message carry Discord's nonce (25 hex characters of SHA-256 of `chat-result:<run>:<part>`) with enforce_nonce; follow-ups and approval notices carry none; rows in backoff leave the batch. /ask marks its row origin 'chat'; the Discord-only /ask limit, /cancel and /status read origin, falling back to the run_started audit rows for older rows.
- **Limits and buttons (S2)**: chat-limits.ts counts link codes, claims, failed claims, the pause and the 10-a-minute command limit as rows, under pg_advisory_xact_lock in one transaction; Discord ids only as SHA-256, rows pruned after an hour; a store error refuses the action. Approval tokens stored as SHA-256 only, 24 hours, one per step, spent on use; the custom id form and the six press checks are unchanged; one repair message with fresh buttons for a notified read-only step with no live token. Interaction tokens stay memory only (Q1). The identify guard stays in memory (Q5, dropped by Keith).

## Gates
| Gate | Worker | Control plane (branch) |
|---|---|---|
| gateway tests | baseline 6860; after S1 6901; after S2 6936 passed, 7 skipped, 14 failed (the known smoke.integration) | 6936 passed, 7 skipped, only the 14 known smoke.integration |
| gateway tsc / build | rc 0 / rc 0 after each slice | rc 0 / rc 0 |
On main after the cherry-picks: tsc and the chat, migration and collaboration-start tests rerun (see the LOCK record). The migration is proven by SQL-shape tests; it first runs against PostgreSQL in STAGING-DEPLOY-CHATBATCH-01 (new migration hash, rollback by down()).

## Review
The control plane read the limit store (advisory transaction lock, hashed subjects), the approval token store (hash at rest, one per step, spend on use, prune) and the migration SQL. Accepted deviations: origin's separate DEFAULT; /ask marking origin after its insert; optional TypeScript properties; heldCount removed; in-memory limit fallback only when ChatModule is not the builder (tests); ChatApprovalService's new token repository parameter.

CHECKLIST: EVERY 11/11, BACKEND 6/6, MIGRATION 4/4.
FOLLOWUPS: 0 registered / 4 superseded (one Discord connection owner before a second process into CHAT-SERVICE-SPLIT-01; chat_limit_hits and expired tokens into CHAT-PRUNE-01; resume() reading the link on every command, and two presses of one button racing between lookup and spend (approveStep's status check decides today; make spend a delete that must remove one row), into CHAT-TIDY-01; the ARCHITECTURE.md chat wording (lines 231, 580, 1193) into CHAT-LIVE-02's governance record) / 1 dropped (Keith, 2026-11-19, Q5: the identify guard across restarts) / 0 undisposed.
