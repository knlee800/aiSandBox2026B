import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_ai_context')
export class ProjectAiContext {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_project_ai_context_project_id')
  @Column({ type: 'uuid', name: 'project_id', unique: true })
  projectId: string;

  @ManyToOne(() => Project, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'text', name: 'project_instructions', nullable: true })
  projectInstructions: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
