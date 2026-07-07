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
 * CreditBalance Entity
 *
 * BILLING-READY-03B: Per-user credit balance persistence.
 *
 * One row per user. Plan changes update the existing row.
 * Balance is always non-negative (enforced by CHECK constraint).
 * ownerType discriminator enables future team/org billing without migration.
 *
 * Immutability: balance is mutated only by the credit deduction transaction
 * (BILLING-READY-03C/03D) and periodic resets.
 */
@Entity('credit_balances')
@Index('idx_credit_balances_owner', ['ownerId', 'ownerType'], { unique: true })
@Index('idx_credit_balances_status', ['status'])
@Check('chk_credit_balances_balance_non_negative', '"balance" >= 0')
@Check(
  'chk_credit_balances_period_valid',
  '"period_start" < "period_end"',
)
export class CreditBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 20, name: 'owner_type', default: 'user' })
  ownerType: string;

  @Column({ type: 'varchar', length: 50, name: 'plan_id', default: 'free' })
  planId: string;

  @Column({ type: 'integer', default: 0 })
  balance: number;

  @Column({ type: 'integer', name: 'monthly_allocation', default: 0 })
  monthlyAllocation: number;

  @Column({ type: 'integer', name: 'rollover_balance', default: 0 })
  rolloverBalance: number;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'timestamp', name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'timestamp', name: 'period_end' })
  periodEnd: Date;

  @Column({ type: 'timestamp', name: 'reset_at', nullable: true })
  resetAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
