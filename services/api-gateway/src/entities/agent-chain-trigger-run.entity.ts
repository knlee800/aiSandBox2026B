import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-CHAIN-01 S1: the outcome of one finished source run (stage-start section 4). */
export const AGENT_CHAIN_TRIGGER_RUN_OUTCOMES = ['claimed', 'started', 'skipped'] as const;
export type AgentChainTriggerRunOutcome = (typeof AGENT_CHAIN_TRIGGER_RUN_OUTCOMES)[number];

/**
 * TRIGGER-CHAIN-01 S1: one finished source run for one chain trigger
 * (migration 1814000000000-CreateAgentChainTriggerTables).
 * Unique (trigger_id, source_run_id): the idempotency record, one start per
 * trigger per finished run. The newest row is the trigger's "last run".
 * - user_id: copied from the trigger for owner-scoped reads.
 * - source_run_id: the finished run's id (text, 1..128; no foreign key).
 * - source_completed_at: the finished run's completion (settle) time.
 * - local_date: the owner's local date ('YYYY-MM-DD'), for the day limit and
 *   the row cap.
 * - depth: 1 plus the depth of the chain row that started the finished run,
 *   or 1 (slice S2); at least 1 by CHECK.
 * - reason: a reason code (stage-start section 3) or null.
 * - collaboration_run_id: the started run, when one was created; indexed for
 *   the depth lookup.
 * Holds ids, times, a depth and codes only, never a task, an answer or a
 * workflow name. No relation decorators: the agent_chain_triggers foreign key
 * and its cascade live in the migration. Slice S2 writes these rows; S1 only
 * reads and deletes them.
 */
@Entity({ name: 'agent_chain_trigger_runs', schema: 'public' })
@Index('uq_agent_chain_trigger_runs_trigger_id_source_run_id', ['triggerId', 'sourceRunId'], { unique: true })
@Index('idx_agent_chain_trigger_runs_user_id_created_at', ['userId', 'createdAt'])
@Index('idx_agent_chain_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'])
@Index('idx_agent_chain_trigger_runs_collaboration_run_id', ['collaborationRunId'])
export class AgentChainTriggerRun {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'trigger_id' })
  triggerId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'text', name: 'source_run_id' })
  sourceRunId: string;

  @Column({ type: 'timestamptz', name: 'source_completed_at' })
  sourceCompletedAt: Date;

  @Column({ type: 'date', name: 'local_date' })
  localDate: string;

  @Column({ type: 'integer' })
  depth: number;

  @Column({ type: 'varchar', length: 16 })
  outcome: AgentChainTriggerRunOutcome;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: 'text', name: 'collaboration_run_id', nullable: true })
  collaborationRunId: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
