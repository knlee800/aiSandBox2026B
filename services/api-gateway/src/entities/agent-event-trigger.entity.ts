import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-EVENT-01 S2: what an event trigger starts (the schedule targets). */
export const AGENT_EVENT_TRIGGER_TARGET_KINDS = ['chief-of-staff', 'workflow'] as const;
export type AgentEventTriggerTargetKind = (typeof AGENT_EVENT_TRIGGER_TARGET_KINDS)[number];

/** TRIGGER-EVENT-01 S2: the calendar state of a trigger (stage-start section 3). */
export const AGENT_EVENT_TRIGGER_CALENDAR_STATES = ['ok', 'connector_missing', 'read_failed'] as const;
export type AgentEventTriggerCalendarState = (typeof AGENT_EVENT_TRIGGER_CALENDAR_STATES)[number];

/**
 * TRIGGER-EVENT-01 S2: one owner's event trigger
 * (migration 1811000000000-CreateAgentEventTriggerTables).
 * - target_kind / workflow_id: the Chief of Staff, or one of the owner's own
 *   workflows (workflow_id is set only for a workflow, by CHECK; no foreign
 *   key, so a deleted workflow leaves the trigger to be skipped in slice S3).
 * - task: the owner's task text, 1..7500 (owner data; never audited or logged).
 * - lead_minutes: 5..120, default 15.
 * - title_filter: optional owner text, 1..100, or null for every timed event
 *   (owner data; never audited or logged).
 * - time_zone: an IANA name accepted by Intl.DateTimeFormat.
 * - armed_at: set at create, at switch-on and when lead, filter or zone
 *   change; an occurrence whose trigger time is earlier is not evaluated.
 * - calendar_state / calendar_state_at: written by slice S3 only.
 * No relation decorators: the user foreign key and its cascade live in the
 * migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'agent_event_triggers', schema: 'public' })
@Index('idx_agent_event_triggers_user_id', ['userId'])
@Index('idx_agent_event_triggers_enabled', ['enabled'])
export class AgentEventTrigger {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16, name: 'target_kind' })
  targetKind: AgentEventTriggerTargetKind;

  @Column({ type: 'uuid', name: 'workflow_id', nullable: true })
  workflowId: string | null;

  @Column({ type: 'text' })
  task: string;

  @Column({ type: 'smallint', name: 'lead_minutes', default: 15 })
  leadMinutes: number;

  @Column({ type: 'varchar', length: 100, name: 'title_filter', nullable: true })
  titleFilter: string | null;

  @Column({ type: 'varchar', length: 64, name: 'time_zone' })
  timeZone: string;

  @Column({ type: 'boolean', default: () => 'true' })
  enabled: boolean;

  @Column({ type: 'timestamptz', name: 'armed_at', default: () => 'CURRENT_TIMESTAMP' })
  armedAt: Date;

  @Column({ type: 'varchar', length: 32, name: 'calendar_state', default: 'ok' })
  calendarState: AgentEventTriggerCalendarState;

  @Column({ type: 'timestamptz', name: 'calendar_state_at', nullable: true })
  calendarStateAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
