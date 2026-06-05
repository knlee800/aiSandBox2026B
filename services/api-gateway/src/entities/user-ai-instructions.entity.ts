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
import { User } from './user.entity';

@Entity('user_ai_instructions')
export class UserAiInstructions {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_user_ai_instructions_user_id')
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  userId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', name: 'global_instructions', nullable: true })
  globalInstructions: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
