import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';

/**
 * Credit grant status values.
 *
 * BILLING-READY-05E: credit grant / top-up accounting foundation.
 */
export const CREDIT_GRANT_STATUSES = [
  'pending',
  'granted',
  'failed',
  'ignored',
] as const;
export type CreditGrantStatus = (typeof CREDIT_GRANT_STATUSES)[number];

export const CREDIT_GRANT_TYPES = [
  'topup',
  'subscription_monthly',
  'subscription_initial',
  'admin',
  'promotional',
] as const;
export type CreditGrantType = (typeof CREDIT_GRANT_TYPES)[number];

export const CREDIT_GRANT_SOURCE_TYPES = [
  'webhook',
  'system',
  'admin',
] as const;
export type CreditGrantSourceType = (typeof CREDIT_GRANT_SOURCE_TYPES)[number];

/**
 * CreditGrant Entity
 *
 * BILLING-READY-05E: TypeORM entity for the `credit_grants` table.
 * Records every credit grant attempt (top-up, subscription initial/renewal,
 * admin, promotional) for idempotency, audit, and accounting.
 *
 * Unique constraint on source_event_id prevents double-credit.
 * balance_before/balance_after are snapshot values captured at grant time.
 * No full provider payload stored — webhook_event_id links to webhook_events.
 */
@Entity('credit_grants')
@Index('idx_credit_grants_source_event_id', ['sourceEventId'], { unique: true })
@Index('idx_credit_grants_owner', ['ownerId', 'ownerType'])
@Index('idx_credit_grants_webhook_event', ['webhookEventId'])
@Index('idx_credit_grants_status', ['status'])
@Index('idx_credit_grants_created_at', ['createdAt'])
@Index('idx_credit_grants_grant_type', ['grantType'])
@Check('chk_credit_grants_amount_positive', '"amount" > 0')
@Check(
  'chk_credit_grants_balance_consistency',
  '"balance_after" >= "balance_before"',
)
export class CreditGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, name: 'owner_type', default: 'user' })
  ownerType: string;

  @Column({ type: 'varchar', length: 30, name: 'grant_type' })
  grantType: string;

  @Column({ type: 'varchar', length: 30, name: 'source_type' })
  sourceType: string;

  @Column({ type: 'varchar', length: 255, name: 'source_event_id' })
  sourceEventId: string;

  @Column({ type: 'varchar', length: 50, default: 'stripe' })
  provider: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_event_id',
    nullable: true,
  })
  providerEventId: string | null;

  @Column({ type: 'uuid', name: 'webhook_event_id', nullable: true })
  webhookEventId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'plan_type', nullable: true })
  planType: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'top_up_pack_id',
    nullable: true,
  })
  topUpPackId: string | null;

  @Column({
    type: 'uuid',
    name: 'granted_by_user_id',
    nullable: true,
  })
  grantedByUserId: string | null;

  @Column({
    type: 'text',
    name: 'reason',
    nullable: true,
  })
  reason: string | null;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'integer', name: 'balance_before' })
  balanceBefore: number;

  @Column({ type: 'integer', name: 'balance_after' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 50, name: 'error_code', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'timestamptz', name: 'granted_at', nullable: true })
  grantedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
