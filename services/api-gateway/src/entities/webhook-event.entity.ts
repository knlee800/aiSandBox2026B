import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Webhook event processing status values.
 *
 * BILLING-READY-05D: webhook ingestion / idempotency foundation.
 */
export const WEBHOOK_EVENT_STATUSES = [
  'received',
  'verified',
  'processing',
  'processed',
  'ignored',
  'failed',
] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export const WEBHOOK_PROVIDERS = ['stripe'] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

/**
 * WebhookEvent Entity
 *
 * BILLING-READY-05D: TypeORM entity for the `webhook_events` table.
 * Records every inbound provider webhook event for idempotency and audit.
 * Unique constraint on (provider, provider_event_id) prevents duplicate processing.
 * No full payload stored — payload_hash only for audit/dedup safety.
 */
@Entity('webhook_events')
@Unique('uq_webhook_events_provider_event_id', ['provider', 'providerEventId'])
@Index('idx_webhook_events_event_type', ['eventType'])
@Index('idx_webhook_events_status', ['status'])
@Index('idx_webhook_events_received_at', ['receivedAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'provider_event_id' })
  providerEventId: string;

  @Column({ type: 'varchar', length: 50, default: "'stripe'" })
  provider: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'internal_event_type',
    nullable: true,
  })
  internalEventType: string | null;

  @Column({ type: 'varchar', length: 20, default: "'received'" })
  status: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'payload_hash',
    nullable: true,
  })
  payloadHash: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'error_code',
    nullable: true,
  })
  errorCode: string | null;

  @Column({ type: 'integer', default: 1 })
  attempts: number;

  @Column({ type: 'timestamptz', name: 'received_at', default: () => 'NOW()' })
  receivedAt: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
