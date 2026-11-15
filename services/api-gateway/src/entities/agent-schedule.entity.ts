import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-01 S1: what a schedule starts (stage-start section 2). */
export const AGENT_SCHEDULE_TARGET_KINDS = ['chief-of-staff', 'workflow'] as const;
export type AgentScheduleTargetKind = (typeof AGENT_SCHEDULE_TARGET_KINDS)[number];

/**
 * TRIGGER-01 S1: one owner's schedule
 * (migration 1810000000000-CreateAgentScheduleTables).
 * - target_kind / workflow_id: the Chief of Staff, or one of the owner's own
 *   workflows (workflow_id is set only for a workflow, by CHECK; no foreign
 *   key, so a deleted workflow leaves the schedule to be skipped and switched
 *   off with a reason in slice S2).
 * - task: the owner's task text (owner data; never audited or logged).
 * - time_of_day: minutes after local midnight (0..1439).
 * - days: bit mask, Monday = 1 ... Sunday = 64 (1..127).
 * - time_zone: an IANA name accepted by Intl.DateTimeFormat.
 * - armed_at: set at create, at switch-on and when time, days or zone change;
 *   an occurrence earlier than this is not evaluated.
 * No relation decorators: the user foreign key and its cascade live in the
 * migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'agent_schedules', schema: 'public' })
@Index('idx_agent_schedules_user_id', ['userId'])
@Index('idx_agent_schedules_enabled', ['enabled'])
export class AgentSchedule {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16, name: 'target_kind' })
  targetKind: AgentScheduleTargetKind;

  @Column({ type: 'uuid', name: 'workflow_id', nullable: true })
  workflowId: string | null;

  @Column({ type: 'text' })
  task: string;

  @Column({ type: 'smallint', name: 'time_of_day' })
  timeOfDay: number;

  @Column({ type: 'smallint' })
  days: number;

  @Column({ type: 'varchar', length: 64, name: 'time_zone' })
  timeZone: string;

  @Column({ type: 'boolean', default: () => 'true' })
  enabled: boolean;

  @Column({ type: 'timestamptz', name: 'armed_at', default: () => 'CURRENT_TIMESTAMP' })
  armedAt: Date;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
