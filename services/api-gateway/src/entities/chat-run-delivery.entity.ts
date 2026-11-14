import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** CHAT-DISCORD-01 C1: the delivery states (stage-start section 5). */
export const CHAT_RUN_DELIVERY_STATUSES = ['waiting', 'delivered', 'failed', 'dropped'] as const;
export type ChatRunDeliveryStatus = (typeof CHAT_RUN_DELIVERY_STATUSES)[number];

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
}
