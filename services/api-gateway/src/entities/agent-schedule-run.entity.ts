import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-01 S1: the outcome of one occurrence (stage-start section 2). */
export const AGENT_SCHEDULE_RUN_OUTCOMES = ['claimed', 'started', 'skipped'] as const;
export type AgentScheduleRunOutcome = (typeof AGENT_SCHEDULE_RUN_OUTCOMES)[number];

/**
 * TRIGGER-01 S1: one occurrence of a schedule on one local date
 * (migration 1810000000000-CreateAgentScheduleTables).
 * Unique (schedule_id, local_date): the idempotency record, one start per
 * schedule per local day. The newest row is the schedule's "last run".
 * - user_id: copied from the schedule for owner-scoped reads.
 * - local_date: the owner's local date of the occurrence ('YYYY-MM-DD').
 * - reason: a reason code (stage-start section 5) or null.
 * - collaboration_run_id: set when a run was created.
 * Holds ids and codes only, never task or result text. No relation
 * decorators: the agent_schedules foreign key and its cascade live in the
 * migration. Slice S2 writes these rows; S1 only reads and deletes them.
 */
@Entity({ name: 'agent_schedule_runs', schema: 'public' })
@Index('uq_agent_schedule_runs_schedule_id_local_date', ['scheduleId', 'localDate'], { unique: true })
@Index('idx_agent_schedule_runs_user_id_created_at', ['userId', 'createdAt'])
export class AgentScheduleRun {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'schedule_id' })
  scheduleId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'date', name: 'local_date' })
  localDate: string;

  @Column({ type: 'varchar', length: 16 })
  outcome: AgentScheduleRunOutcome;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: 'text', name: 'collaboration_run_id', nullable: true })
  collaborationRunId: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
