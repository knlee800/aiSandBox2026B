import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Subscription status values aligned with Stripe lifecycle.
 *
 * BILLING-READY-05B: persistence foundation only — no provider API calls.
 */
export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'cancelled',
  'expired',
  'unpaid',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Plan type values aligned with PLAN_DEFINITIONS (plan-definition.ts).
 */
export const SUBSCRIPTION_PLAN_TYPES = [
  'free',
  'starter',
  'pro',
  'team',
] as const;
export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

/**
 * Subscription Entity
 *
 * BILLING-READY-05B: TypeORM entity for the existing `subscriptions` table.
 * Maps to raw SQL table created in database/schema.sql / database/init/001_schema.sql.
 * Migration aligns raw SQL schema with this entity (adds missing columns, updates CHECKs).
 *
 * One active subscription per user enforced via partial unique index
 * (user_id) WHERE status IN ('active', 'trialing', 'past_due').
 */
@Entity('subscriptions')
@Index('idx_subscriptions_user_id', ['userId'])
@Index('idx_subscriptions_status', ['status'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'stripe_subscription_id',
    nullable: true,
  })
  stripeSubscriptionId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'stripe_price_id',
    nullable: true,
  })
  stripePriceId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'plan_type',
    default: 'free',
  })
  planType: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: string;

  @Column({ type: 'timestamptz', name: 'current_period_start' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamptz', name: 'current_period_end' })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamptz', name: 'cancel_at', nullable: true })
  cancelAt: Date | null;

  @Column({
    type: 'boolean',
    name: 'cancel_at_period_end',
    default: false,
  })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
