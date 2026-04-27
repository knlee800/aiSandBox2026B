import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';
import { Workspace } from './workspace.entity';

export type ProjectVisibility = 'private' | 'public';

/**
 * Project Entity
 * Stable, user-owned project identity independent from session lifecycle.
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_projects_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.projects, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Workspace, (workspace) => workspace.projects, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @Index('idx_projects_workspace_id')
  @Column({ type: 'uuid', name: 'workspace_id', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index('idx_projects_slug')
  @Column({ type: 'varchar' })
  slug: string;

  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility: ProjectVisibility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Session, (session) => session.project)
  sessions: Session[];
}
