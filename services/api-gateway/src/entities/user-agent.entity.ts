import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import type {
  SystemAgentModel,
  SystemAgentReplyLanguage,
  SystemAgentToolProfile,
} from '../system-agents/system-agent-registry';

export const USER_AGENT_STATUSES = ['active', 'draft', 'disabled'] as const;
export type UserAgentStatus = (typeof USER_AGENT_STATUSES)[number];

@Entity('user_agents')
export class UserAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_agents_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  role: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  initials: string | null;

  // BIZ-USER-01A: the workflow spec, access, model and budget
  // (migration 1803000000000-AddUserAgentWorkflowColumns). `rules` is a
  // platform constant applied at render and is not stored.

  @Column({ type: 'varchar', length: 120, nullable: true })
  tone: string | null;

  @Column({ type: 'varchar', length: 8, name: 'reply_language', nullable: true })
  replyLanguage: SystemAgentReplyLanguage | null;

  @Column({ type: 'text', default: '' })
  purpose: string;

  @Column({ type: 'text', default: '' })
  procedure: string;

  @Column({ type: 'text', default: '' })
  result: string;

  @Column({ type: 'varchar', length: 8, name: 'tool_profile', default: 'read' })
  toolProfile: SystemAgentToolProfile;

  @Column({ type: 'jsonb', name: 'knowledge_scope_ids', default: () => "'[]'" })
  knowledgeScopeIds: string[];

  @Column({ type: 'jsonb', name: 'connector_tool_ids', default: () => "'[]'" })
  connectorToolIds: string[];

  @Column({ type: 'jsonb', default: () => `'{"choice":"server"}'` })
  model: SystemAgentModel;

  @Column({ type: 'integer', name: 'budget_per_run_credits', nullable: true })
  budgetPerRunCredits: number | null;

  @Column({ type: 'integer', name: 'budget_per_day_credits', nullable: true })
  budgetPerDayCredits: number | null;

  @Column({ type: 'varchar', length: 64, name: 'template_id', nullable: true })
  templateId: string | null;

  // USER-TEAMS-01 D1: the workflow's team, the ids of up to 3 agents it may
  // hand one question to (migration 1806000000000-AddUserAgentTeamColumn).
  // Saved with the form; checked at save and again at start.
  @Column({ type: 'jsonb', name: 'team_member_ids', default: () => "'[]'" })
  teamMemberIds: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
