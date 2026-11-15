import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-EVENT-01 S2: the outcome of one occurrence (stage-start section 2). */
export const AGENT_EVENT_TRIGGER_RUN_OUTCOMES = ['claimed', 'started', 'skipped'] as const;
export type AgentEventTriggerRunOutcome = (typeof AGENT_EVENT_TRIGGER_RUN_OUTCOMES)[number];

/**
 * TRIGGER-EVENT-01 S2: one occurrence of an event trigger
 * (migration 1811000000000-CreateAgentEventTriggerTables).
 * Unique (trigger_id, occurrence_key): the idempotency record, one start per
 * trigger per event occurrence. The newest row is the trigger's "last run".
 * - user_id: copied from the trigger for owner-scoped reads.
 * - occurrence_key: SHA-256 hex of trigger id, event uid and start; the raw
 *   uid is never stored.
 * - event_start: the event's start instant.
 * - local_date: the owner's local date of the occurrence ('YYYY-MM-DD'), for
 *   the day limit.
 * - reason: a reason code (stage-start section 6) or null.
 * - collaboration_run_id: set when a run was created.
 * Holds ids, times, a hash and codes only, never a title, task or result
 * text. No relation decorators: the agent_event_triggers foreign key and its
 * cascade live in the migration. Slice S3 writes these rows; S2 only reads
 * and deletes them.
 */
@Entity({ name: 'agent_event_trigger_runs', schema: 'public' })
@Index('uq_agent_event_trigger_runs_trigger_id_occurrence_key', ['triggerId', 'occurrenceKey'], { unique: true })
@Index('idx_agent_event_trigger_runs_user_id_created_at', ['userId', 'createdAt'])
@Index('idx_agent_event_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'])
export class AgentEventTriggerRun {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'trigger_id' })
  triggerId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'char', length: 64, name: 'occurrence_key' })
  occurrenceKey: string;

  @Column({ type: 'timestamptz', name: 'event_start' })
  eventStart: Date;

  @Column({ type: 'date', name: 'local_date' })
  localDate: string;

  @Column({ type: 'varchar', length: 16 })
  outcome: AgentEventTriggerRunOutcome;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: 'text', name: 'collaboration_run_id', nullable: true })
  collaborationRunId: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
