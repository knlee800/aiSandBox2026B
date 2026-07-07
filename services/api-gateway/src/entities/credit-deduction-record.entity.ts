import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Check,
} from 'typeorm';
import type { CreditDeductionLineItemResult } from '../billing/credit-deduction/types';

/**
 * CreditDeductionRecord Entity
 *
 * BILLING-READY-03B: Immutable deduction event persistence.
 *
 * One row per source event. Immutable after creation — no UPDATE operations
 * permitted (except status for future reversals). sourceEventId unique constraint
 * is the core idempotency mechanism.
 *
 * balanceBefore/balanceAfter are snapshot values captured at deduction time.
 * lineItems stored as JSONB array matching CreditDeductionLineItemResult[].
 */
@Entity('credit_deduction_records')
@Index('idx_credit_deduction_records_source_event', ['sourceEventId'], {
  unique: true,
})
@Index('idx_credit_deduction_records_owner_created', ['ownerId', 'createdAt'])
@Index('idx_credit_deduction_records_owner_status', ['ownerId', 'status'])
@Index('idx_credit_deduction_records_session', ['sessionId'])
@Index('idx_credit_deduction_records_execution', ['executionId'])
@Index('idx_credit_deduction_records_created_at', ['createdAt'])
@Check(
  'chk_credit_deduction_records_credits_non_negative',
  '"requested_credits" >= 0 AND "applied_credits" >= 0 AND "overflow_credits" >= 0',
)
@Check(
  'chk_credit_deduction_records_balance_consistency',
  '"balance_before" >= "balance_after"',
)
export class CreditDeductionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 255, name: 'source_event_id' })
  sourceEventId: string;

  @Column({ type: 'varchar', length: 50, name: 'source_event_type' })
  sourceEventType: string;

  @Column({ type: 'varchar', length: 100, name: 'agent_id', nullable: true })
  agentId: string | null;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId: string | null;

  @Column({ type: 'uuid', name: 'execution_id', nullable: true })
  executionId: string | null;

  @Column({ type: 'varchar', length: 100, name: 'model_id', nullable: true })
  modelId: string | null;

  @Column({ type: 'integer', name: 'requested_credits', default: 0 })
  requestedCredits: number;

  @Column({ type: 'integer', name: 'applied_credits', default: 0 })
  appliedCredits: number;

  @Column({ type: 'integer', name: 'overflow_credits', default: 0 })
  overflowCredits: number;

  @Column({ type: 'integer', name: 'balance_before' })
  balanceBefore: number;

  @Column({ type: 'integer', name: 'balance_after' })
  balanceAfter: number;

  @Column({ type: 'jsonb', name: 'line_items', default: '[]' })
  lineItems: CreditDeductionLineItemResult[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'applied' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
