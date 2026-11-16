import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-MAIL-01 S2: the outcome of one message (stage-start section 2). */
export const AGENT_MAIL_TRIGGER_RUN_OUTCOMES = ['claimed', 'started', 'skipped'] as const;
export type AgentMailTriggerRunOutcome = (typeof AGENT_MAIL_TRIGGER_RUN_OUTCOMES)[number];

/**
 * TRIGGER-MAIL-01 S2: one message for one mail trigger
 * (migration 1812000000000-CreateAgentMailTriggerTables).
 * Unique (trigger_id, message_key): the idempotency record, one start per
 * trigger per message. The newest row is the trigger's "last run".
 * - user_id: copied from the trigger for owner-scoped reads.
 * - message_key: SHA-256 hex of trigger id, the mailbox's UIDVALIDITY and
 *   the message's UID; neither raw value is stored.
 * - arrived_at: the mail server's arrival time (INTERNALDATE), not the
 *   sender's Date header.
 * - local_date: the owner's local date of the arrival ('YYYY-MM-DD'), for the
 *   day limit and the row cap.
 * - reason: a reason code (stage-start section 6) or null.
 * - collaboration_run_id: set when a run was created.
 * Holds ids, times, a hash and codes only, never a sender, subject, body,
 * task or result text. No relation decorators: the agent_mail_triggers
 * foreign key and its cascade live in the migration. Slice S3 writes these
 * rows; S2 only reads and deletes them.
 */
@Entity({ name: 'agent_mail_trigger_runs', schema: 'public' })
@Index('uq_agent_mail_trigger_runs_trigger_id_message_key', ['triggerId', 'messageKey'], { unique: true })
@Index('idx_agent_mail_trigger_runs_user_id_created_at', ['userId', 'createdAt'])
@Index('idx_agent_mail_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'])
export class AgentMailTriggerRun {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'trigger_id' })
  triggerId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'char', length: 64, name: 'message_key' })
  messageKey: string;

  @Column({ type: 'timestamptz', name: 'arrived_at' })
  arrivedAt: Date;

  @Column({ type: 'date', name: 'local_date' })
  localDate: string;

  @Column({ type: 'varchar', length: 16 })
  outcome: AgentMailTriggerRunOutcome;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: 'text', name: 'collaboration_run_id', nullable: true })
  collaborationRunId: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
