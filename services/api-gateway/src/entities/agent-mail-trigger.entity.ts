import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** TRIGGER-MAIL-01 S2: what a mail trigger starts (the schedule targets). */
export const AGENT_MAIL_TRIGGER_TARGET_KINDS = ['chief-of-staff', 'workflow'] as const;
export type AgentMailTriggerTargetKind = (typeof AGENT_MAIL_TRIGGER_TARGET_KINDS)[number];

/** TRIGGER-MAIL-01 S2: the mailbox state of a trigger (stage-start section 3). */
export const AGENT_MAIL_TRIGGER_MAIL_STATES = ['ok', 'connector_missing', 'read_failed'] as const;
export type AgentMailTriggerMailState = (typeof AGENT_MAIL_TRIGGER_MAIL_STATES)[number];

/**
 * TRIGGER-MAIL-01 S2: one owner's mail trigger
 * (migration 1812000000000-CreateAgentMailTriggerTables).
 * - target_kind / workflow_id: the Chief of Staff, or one of the owner's own
 *   workflows (workflow_id is set only for a workflow, by CHECK; no foreign
 *   key, so a deleted workflow leaves the trigger to be skipped in slice S3).
 * - task: the owner's task text, 1..7500 (owner data; never audited or logged).
 * - sender_filter: required, at most 254: a full address or @ and a domain,
 *   stored in lower case (owner data that may name a third party; never
 *   audited or logged).
 * - subject_filter: optional owner text, 1..100, or null for any subject
 *   (owner data; never audited or logged).
 * - time_zone: an IANA name accepted by Intl.DateTimeFormat.
 * - armed_at: set at create, at switch-on and when sender, subject or zone
 *   change; mail that arrived earlier never fires.
 * - mail_state / mail_state_at: written by slice S3 only.
 * No relation decorators: the user foreign key and its cascade live in the
 * migration. The id is made by the service (randomUUID).
 */
@Entity({ name: 'agent_mail_triggers', schema: 'public' })
@Index('idx_agent_mail_triggers_user_id', ['userId'])
@Index('idx_agent_mail_triggers_enabled', ['enabled'])
export class AgentMailTrigger {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16, name: 'target_kind' })
  targetKind: AgentMailTriggerTargetKind;

  @Column({ type: 'uuid', name: 'workflow_id', nullable: true })
  workflowId: string | null;

  @Column({ type: 'text' })
  task: string;

  @Column({ type: 'varchar', length: 254, name: 'sender_filter' })
  senderFilter: string;

  @Column({ type: 'varchar', length: 100, name: 'subject_filter', nullable: true })
  subjectFilter: string | null;

  @Column({ type: 'varchar', length: 64, name: 'time_zone' })
  timeZone: string;

  @Column({ type: 'boolean', default: () => 'true' })
  enabled: boolean;

  @Column({ type: 'timestamptz', name: 'armed_at', default: () => 'CURRENT_TIMESTAMP' })
  armedAt: Date;

  @Column({ type: 'varchar', length: 32, name: 'mail_state', default: 'ok' })
  mailState: AgentMailTriggerMailState;

  @Column({ type: 'timestamptz', name: 'mail_state_at', nullable: true })
  mailStateAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
