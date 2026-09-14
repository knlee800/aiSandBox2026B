import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  CollaborationAgentRole,
  CollaborationRunStatus,
  OrchestrationMode,
} from './orchestration.contracts';

@Entity({ name: 'collaboration_runs', schema: 'public' })
@Index('idx_collaboration_runs_user_id', ['userId'])
@Index('idx_collaboration_runs_status', ['status'])
@Check(
  'chk_collaboration_runs_status',
  `"status" IN ('active','completed','failed','cancelled','timed_out')`,
)
@Check('chk_collaboration_runs_mode', `"orchestration_mode" = 'read_only'`)
export class CollaborationRunEntity {
  @PrimaryColumn({ type: 'text', name: 'collaboration_run_id' })
  collaborationRunId: string;

  @Column({ type: 'text', name: 'user_id' })
  userId: string;

  @Column({ type: 'text', name: 'project_id' })
  projectId: string;

  @Column({ type: 'text', name: 'initiator_agent_role' })
  initiatorAgentRole: CollaborationAgentRole;

  @Column({ type: 'text', name: 'initiator_builder_profile_id' })
  initiatorBuilderProfileId: string;

  @Column({ type: 'text', name: 'orchestration_mode' })
  orchestrationMode: OrchestrationMode;

  @Column({ type: 'text', name: 'status' })
  status: CollaborationRunStatus;

  @Column({ type: 'jsonb', name: 'referral_ids', default: () => "'[]'::jsonb" })
  referralIds: string[];

  @Column({
    type: 'jsonb',
    name: 'active_builder_profile_ids',
  })
  activeBuilderProfileIds: string[];

  @Column({ type: 'integer', name: 'timeout_ms' })
  timeoutMs: number;

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
