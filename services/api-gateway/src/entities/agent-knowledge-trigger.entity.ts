import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-MORE-01 S1: what a knowledge trigger starts (the schedule targets). */
export const AGENT_KNOWLEDGE_TRIGGER_TARGET_KINDS = ['chief-of-staff', 'workflow'] as const;
export type AgentKnowledgeTriggerTargetKind = (typeof AGENT_KNOWLEDGE_TRIGGER_TARGET_KINDS)[number];

/**
 * TRIGGER-MORE-01 S1: one owner's knowledge trigger
 * (migration 1813000000000-CreateAgentKnowledgeTriggerTables).
 * - target_kind / workflow_id: the Chief of Staff, or one of the owner's own
 *   workflows (workflow_id is set only for a workflow, by CHECK; no foreign
 *   key, so a deleted workflow leaves the trigger to be skipped in slice S2).
 * - task: the owner's task text, 1..7000 (owner data; never audited or logged).
 * - scope_id: one of the nine fixed Knowledge folder ids (the routes check it);
 *   a Chief of Staff trigger only on a folder the Chief of Staff reads.
 * - time_zone: an IANA name accepted by Intl.DateTimeFormat.
 * - armed_at: set at create, at switch-on and when the folder or the zone
 *   change; documents changed earlier never fire.
 * No relation decorators: the user foreign key and its cascade live in the
 * migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'agent_knowledge_triggers', schema: 'public' })
@Index('idx_agent_knowledge_triggers_user_id', ['userId'])
@Index('idx_agent_knowledge_triggers_enabled', ['enabled'])
export class AgentKnowledgeTrigger {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16, name: 'target_kind' })
  targetKind: AgentKnowledgeTriggerTargetKind;

  @Column({ type: 'uuid', name: 'workflow_id', nullable: true })
  workflowId: string | null;

  @Column({ type: 'text' })
  task: string;

  @Column({ type: 'varchar', length: 64, name: 'scope_id' })
  scopeId: string;

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
