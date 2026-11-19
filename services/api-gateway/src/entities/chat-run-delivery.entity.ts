import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** CHAT-DISCORD-01 C1: the delivery states (stage-start section 5). */
export const CHAT_RUN_DELIVERY_STATUSES = ['waiting', 'delivered', 'failed', 'dropped'] as const;
export type ChatRunDeliveryStatus = (typeof CHAT_RUN_DELIVERY_STATUSES)[number];

/**
 * CHAT-STATE-PERSIST-01: where a delivery row came from. chat: /ask wrote it.
 * platform: the run-started listener wrote it (a run started anywhere else;
 * the column default). NULL: a row from before migration 1817.
 */
export const CHAT_RUN_DELIVERY_ORIGINS = ['chat', 'platform'] as const;
export type ChatRunDeliveryOrigin = (typeof CHAT_RUN_DELIVERY_ORIGINS)[number];

/**
 * CHAT-DISCORD-01 C1: one run started from a chat channel and where its
 * result goes (migration 1809000000000-CreateChatRunDeliveries).
 * waiting: the run has not ended or its result is not sent yet.
 * delivered: the answer (or the one-line end notice) was sent.
 * failed: sending failed after the retries.
 * dropped: not sent (no end within 24 hours, cancelled from the chat, or the
 * run is gone or not the link owner's).
 * Holds ids only, never message or result text. No relation decorators: the
 * chat_links foreign key and its cascade live in the migration.
 *
 * CHAT-STATE-PERSIST-01 (migration 1817000000000-AddChatPersistedState): the
 * delivery progress (parts_sent, send_failures, next_attempt_at), the hold
 * (held_at), the claim of the gateway process working on the row
 * (claimed_by, claimed_until) and the origin live on the row, so a restart
 * continues where it stopped.
 */
@Entity({ name: 'chat_run_deliveries', schema: 'public' })
@Index('idx_chat_run_deliveries_link_id_status', ['linkId', 'status'])
@Index('idx_chat_run_deliveries_status_created_at', ['status', 'createdAt'])
export class ChatRunDelivery {
  @PrimaryColumn({ type: 'text', name: 'collaboration_run_id' })
  collaborationRunId: string;

  @Column({ type: 'uuid', name: 'link_id' })
  linkId: string;

  @Column({ type: 'varchar', length: 16, default: () => "'waiting'" })
  status: ChatRunDeliveryStatus;

  @Column({ type: 'jsonb', name: 'notified_referral_ids', default: () => "'[]'::jsonb" })
  notifiedReferralIds: string[];

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'delivered_at', nullable: true })
  deliveredAt: Date | null;

  /** Result parts already sent (written after each part, before the next is sent). */
  @Column({ type: 'integer', name: 'parts_sent', default: 0 })
  partsSent?: number;

  /** Failed send attempts so far; the fourth failure fails the row. */
  @Column({ type: 'integer', name: 'send_failures', default: 0 })
  sendFailures?: number;

  /** Not before this time (backoff 10 s, 30 s, 90 s). */
  @Column({ type: 'timestamptz', name: 'next_attempt_at', nullable: true })
  nextAttemptAt?: Date | null;

  /** Discord refused the direct message; cleared by the user's next command or button press. */
  @Column({ type: 'timestamptz', name: 'held_at', nullable: true })
  heldAt?: Date | null;

  /** The gateway process working on the row (a random id made at boot). */
  @Column({ type: 'varchar', length: 36, name: 'claimed_by', nullable: true })
  claimedBy?: string | null;

  /** The claim ends by itself at this time. */
  @Column({ type: 'timestamptz', name: 'claimed_until', nullable: true })
  claimedUntil?: Date | null;

  /** chat (/ask), platform (the run-started listener; the column default) or NULL (before migration 1817). */
  @Column({ type: 'text', nullable: true, default: () => "'platform'" })
  origin?: ChatRunDeliveryOrigin | null;
}
