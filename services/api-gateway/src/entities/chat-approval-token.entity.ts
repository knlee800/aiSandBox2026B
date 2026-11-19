import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * CHAT-STATE-PERSIST-01: one live approval button message (stage-start
 * section 3.3; migration 1817000000000-AddChatPersistedState). The button
 * token is random (128 bits) and travels only in the custom id; the row keeps
 * its SHA-256 hex, so a database read gives no working custom id. One row per
 * step (unique referral_id): a new message for the step replaces the token.
 * Deleted on a decision, when the step or run is no longer available, when
 * the message could not be sent, at expiry (24 hours) and by cascade with its
 * delivery row (the foreign key lives in the migration).
 */
@Entity({ name: 'chat_approval_tokens', schema: 'public' })
@Index('uq_chat_approval_tokens_referral_id', ['referralId'], { unique: true })
@Index('idx_chat_approval_tokens_expires_at', ['expiresAt'])
export class ChatApprovalToken {
  @PrimaryColumn({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'text', name: 'collaboration_run_id' })
  collaborationRunId: string;

  @Column({ type: 'uuid', name: 'link_id' })
  linkId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'text', name: 'referral_id' })
  referralId: string;

  @Column({ type: 'integer' })
  step: number;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
