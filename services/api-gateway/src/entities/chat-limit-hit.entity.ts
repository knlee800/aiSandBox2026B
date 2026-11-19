import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * CHAT-STATE-PERSIST-01: the counted chat events (stage-start section 3.2).
 * code_create: a link code made (subject: the owner id).
 * claim_attempt: a /link claim attempt (subject: the SHA-256 hex of the
 * Discord user id; the id itself is never stored here).
 * claim_failed: a failed claim (subject: the channel, discord).
 * link_pause: linking paused for an hour (subject: the channel, discord).
 * command: an /ask or /cancel (subject: the owner id).
 */
export const CHAT_LIMIT_BUCKETS = ['code_create', 'claim_attempt', 'claim_failed', 'link_pause', 'command'] as const;
export type ChatLimitBucket = (typeof CHAT_LIMIT_BUCKETS)[number];

/**
 * CHAT-STATE-PERSIST-01: one row per counted chat event (migration
 * 1817000000000-AddChatPersistedState). The limits count the rows of a
 * bucket and subject inside a sliding window; rows older than the window are
 * deleted. Holds no Discord id, no code and no text.
 */
@Entity({ name: 'chat_limit_hits', schema: 'public' })
@Index('idx_chat_limit_hits_bucket_subject_occurred_at', ['bucket', 'subjectKey', 'occurredAt'])
export class ChatLimitHit {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id: string;

  @Column({ type: 'varchar', length: 24 })
  bucket: ChatLimitBucket;

  @Column({ type: 'varchar', length: 64, name: 'subject_key' })
  subjectKey: string;

  @Column({ type: 'timestamptz', name: 'occurred_at', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt: Date;
}
