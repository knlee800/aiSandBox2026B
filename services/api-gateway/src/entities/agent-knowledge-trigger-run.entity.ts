import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-MORE-01 S1: the outcome of one document version (stage-start section 4). */
export const AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES = ['claimed', 'started', 'skipped'] as const;
export type AgentKnowledgeTriggerRunOutcome = (typeof AGENT_KNOWLEDGE_TRIGGER_RUN_OUTCOMES)[number];

/**
 * TRIGGER-MORE-01 S1: one document version for one knowledge trigger
 * (migration 1813000000000-CreateAgentKnowledgeTriggerTables).
 * Unique (trigger_id, document_key): the idempotency record, one start per
 * trigger per document version. The newest row is the trigger's "last run".
 * - user_id: copied from the trigger for owner-scoped reads.
 * - document_id: the knowledge document's id (no foreign key).
 * - document_key: SHA-256 hex of trigger id, document id and content hash;
 *   the content hash is not stored.
 * - changed_at: the document's change time (its updated_at).
 * - local_date: the owner's local date of the change ('YYYY-MM-DD'), for the
 *   day limit and the row cap.
 * - reason: a reason code (stage-start section 5) or null.
 * - collaboration_run_id: set when a run was created; one run holds the rows
 *   of its whole batch.
 * Holds ids, times, a hash and codes only, never a title, content, task or
 * result text. No relation decorators: the agent_knowledge_triggers foreign
 * key and its cascade live in the migration. Slice S2 writes these rows; S1
 * only reads and deletes them.
 */
@Entity({ name: 'agent_knowledge_trigger_runs', schema: 'public' })
@Index('uq_agent_knowledge_trigger_runs_trigger_id_document_key', ['triggerId', 'documentKey'], { unique: true })
@Index('idx_agent_knowledge_trigger_runs_user_id_created_at', ['userId', 'createdAt'])
@Index('idx_agent_knowledge_trigger_runs_trigger_id_local_date', ['triggerId', 'localDate'])
export class AgentKnowledgeTriggerRun {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'trigger_id' })
  triggerId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'document_id' })
  documentId: string;

  @Column({ type: 'char', length: 64, name: 'document_key' })
  documentKey: string;

  @Column({ type: 'timestamptz', name: 'changed_at' })
  changedAt: Date;

  @Column({ type: 'date', name: 'local_date' })
  localDate: string;

  @Column({ type: 'varchar', length: 16 })
  outcome: AgentKnowledgeTriggerRunOutcome;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reason: string | null;

  @Column({ type: 'text', name: 'collaboration_run_id', nullable: true })
  collaborationRunId: string | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
