# PHASE-56E Checkpoint — Full Fresh-Boot Schema Parity Fix

**Task:** TASK-56E  
**Phase:** 56  
**Stage:** 56E

---

## Summary

Full schema parity for fresh Docker boot: `conversations` and `chat_messages` tables aligned with runtime entities. No manual DB ALTERs after boot. Register → login → create API key → create session → add first chat message → xAI execute succeeds.

---

## Root Cause Summary

| Gap | Root Cause |
|-----|------------|
| `chat_messages` table missing | Init 001 never created it; runtime ChatMessageRepository.createMessage fails |
| `conversations.user_id` NOT NULL | Runtime ConversationRepository.createForSession inserts only sessionId + messagesCount; no user_id |
| `conversations.messages` / `current_message_number` | Legacy columns; runtime entity uses `messages_count` only |
| `conversations.messages_count` missing | Runtime entity expects this column; init had `current_message_number` |

---

## A) Init Schema Fixes (001_schema.sql)

- **conversations**: Replaced with runtime schema: `session_id`, `messages_count`, `created_at`, `updated_at` (removed `user_id`, `messages`, `current_message_number`)
- **chat_messages**: Added table + `chat_message_role` enum + indexes
- **DROP order**: Added `chat_messages` before `conversations` (FK dependency)

---

## B) Idempotent Patch (102_conversations_chat_messages_align.sql)

- Fresh boot: no-op (001 already created correct schema)
- Existing DBs: creates `chat_messages`, adds `messages_count`, drops legacy columns

---

## C) TypeORM Migration (1771495100000-AddChatMessagesAndAlignConversations.ts)

- Idempotent migration for existing DBs where init does not run
- Seeded in baseline (005) so TypeORM skips on fresh boot

---

## Files Changed

| File | Change |
|------|--------|
| `database/init/001_schema.sql` | conversations schema parity, add chat_messages table |
| `database/init/102_conversations_chat_messages_align.sql` | New idempotent patch |
| `database/init/005_typeorm_migrations_baseline.sql` | Seed AddChatMessagesAndAlignConversations |
| `services/api-gateway/src/migrations/1771495100000-AddChatMessagesAndAlignConversations.ts` | New migration |
| `docs/PHASE-56E-CHECKPOINT.md` | This file |

---

## Validation

```bash
docker compose down -v
docker compose up -d --build
# api-gateway healthy
# register → login → create API key → create session → add first chat message → xAI execute
```
