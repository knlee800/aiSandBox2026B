import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-CHAIN-01 S1: what a chain trigger starts (the schedule targets). */
export const AGENT_CHAIN_TRIGGER_TARGET_KINDS = ['chief-of-staff', 'workflow'] as const;
export type AgentChainTriggerTargetKind = (typeof AGENT_CHAIN_TRIGGER_TARGET_KINDS)[number];

/**
 * TRIGGER-CHAIN-01 S1: one owner's chain trigger
 * (migration 1814000000000-CreateAgentChainTriggerTables).
 * - source_workflow_id: one of the owner's own workflows; a completed run of
 *   it starts the target (slice S2). No foreign key.
 * - target_kind / workflow_id: the Chief of Staff, or another of the owner's
 *   own workflows (workflow_id is set only for a workflow, by CHECK; never the
 *   source, by CHECK; no foreign key, so a deleted workflow leaves the trigger
 *   to be skipped in slice S2).
 * - task: the owner's task text, 1..7000 (owner data; never audited or logged).
 * - time_zone: an IANA name accepted by Intl.DateTimeFormat.
 * - armed_at: set at create, at switch-on and when the source changes; runs
 *   created earlier never fire.
 * No relation decorators: the user foreign key and its cascade live in the
 * migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'agent_chain_triggers', schema: 'public' })
@Index('idx_agent_chain_triggers_user_id', ['userId'])
@Index('idx_agent_chain_triggers_enabled', ['enabled'])
export class AgentChainTrigger {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'source_workflow_id' })
  sourceWorkflowId: string;

  @Column({ type: 'varchar', length: 16, name: 'target_kind' })
  targetKind: AgentChainTriggerTargetKind;

  @Column({ type: 'uuid', name: 'workflow_id', nullable: true })
  workflowId: string | null;

  @Column({ type: 'text' })
  task: string;

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
