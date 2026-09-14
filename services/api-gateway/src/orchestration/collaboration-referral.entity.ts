import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CollaborationRunEntity } from './collaboration-run.entity';
import type {
  CollaborationAgentRole,
  ReferralCancelStatus,
  ReferralResultStatus,
  ReferralStatus,
} from './orchestration.contracts';

@Entity({ name: 'collaboration_referrals', schema: 'public' })
@Index('idx_collaboration_referrals_run_id', ['collaborationRunId'])
@Index('idx_collaboration_referrals_parent_trace', ['parentReferralTraceId'])
@Index('idx_collaboration_referrals_status', ['status'])
@Index('uq_collaboration_referrals_trace_id', ['referralTraceId'], {
  unique: true,
})
@Check(
  'chk_collaboration_referrals_status',
  `"status" IN ('pending_approval','approved','in_progress','completed','failed','cancelled','timed_out','rejected')`,
)
@Check(
  'chk_collaboration_referrals_cancel_status',
  `"cancel_status" IN ('not_requested','requested','cancelled','rejected')`,
)
@Check('chk_collaboration_referrals_read_only', `"constraint_read_only" = true`)
@Check(
  'chk_collaboration_referrals_allow_write_tools',
  `"constraint_allow_write_tools" = false`,
)
@Check(
  'chk_collaboration_referrals_result_status',
  `"result_status" IS NULL OR "result_status" IN ('success','partial','failed')`,
)
export class CollaborationReferralEntity {
  @PrimaryColumn({ type: 'text', name: 'referral_id' })
  referralId: string;

  @ManyToOne(() => CollaborationRunEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaboration_run_id' })
  collaborationRun: CollaborationRunEntity;

  @Column({ type: 'text', name: 'collaboration_run_id' })
  collaborationRunId: string;

  @Column({ type: 'text', name: 'referral_trace_id' })
  referralTraceId: string;

  @Column({ type: 'text', name: 'parent_referral_trace_id', nullable: true })
  parentReferralTraceId: string | null;

  @Column({ type: 'text', name: 'source_agent_role' })
  sourceAgentRole: CollaborationAgentRole;

  @Column({ type: 'text', name: 'source_builder_profile_id' })
  sourceBuilderProfileId: string;

  @Column({ type: 'text', name: 'target_agent_role' })
  targetAgentRole: CollaborationAgentRole;

  @Column({ type: 'text', name: 'target_builder_profile_id' })
  targetBuilderProfileId: string;

  @Column({ type: 'text', name: 'status' })
  status: ReferralStatus;

  @Column({ type: 'text', name: 'cancel_status' })
  cancelStatus: ReferralCancelStatus;

  @Column({ type: 'text', name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'jsonb', name: 'referral_chain' })
  referralChain: string[];

  @Column({ type: 'integer', name: 'depth' })
  depth: number;

  @Column({ type: 'integer', name: 'max_depth' })
  maxDepth: number;

  @Column({ type: 'jsonb', name: 'visited_builder_profile_ids' })
  visitedBuilderProfileIds: string[];

  @Column({ type: 'integer', name: 'timeout_ms' })
  timeoutMs: number;

  @Column({ type: 'integer', name: 'constraint_timeout_ms' })
  constraintTimeoutMs: number;

  @Column({ type: 'integer', name: 'constraint_max_depth' })
  constraintMaxDepth: number;

  @Column({ type: 'integer', name: 'constraint_max_agents_per_collaboration' })
  constraintMaxAgentsPerCollaboration: number;

  @Column({ type: 'boolean', name: 'constraint_read_only' })
  constraintReadOnly: boolean;

  @Column({ type: 'boolean', name: 'constraint_allow_write_tools' })
  constraintAllowWriteTools: boolean;

  @Column({ type: 'jsonb', name: 'constraint_allowed_tools' })
  constraintAllowedTools: string[];

  @Column({ type: 'text', name: 'execution_id', nullable: true })
  executionId: string | null;

  @Column({ type: 'text', name: 'result_status', nullable: true })
  resultStatus: ReferralResultStatus | null;

  @Column({ type: 'text', name: 'result_summary', nullable: true })
  resultSummary: string | null;

  @Column({ type: 'jsonb', name: 'result_output_files', nullable: true })
  resultOutputFiles: string[] | null;

  @Column({ type: 'integer', name: 'result_duration_ms', nullable: true })
  resultDurationMs: number | null;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'failed_at', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'timed_out_at', nullable: true })
  timedOutAt: Date | null;

  @Column({ type: 'timestamptz', name: 'cancel_requested_at', nullable: true })
  cancelRequestedAt: Date | null;

  @Column({ type: 'text', name: 'cancelled_by_user_id', nullable: true })
  cancelledByUserId: string | null;

  @Column({ type: 'text', name: 'cancel_reason', nullable: true })
  cancelReason: string | null;
}
