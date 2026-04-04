import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SessionStatus } from './session-status.enum';
import { User } from './user.entity';
import { Project } from './project.entity';

/**
 * Session Entity
 * Represents a sandbox session with an isolated container
 */
@Entity('sessions')
export class Session {
  /**
   * Unique identifier (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Session status (pending, active, stopped, expired, error)
   */
  @Index('idx_session_status')
  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.PENDING,
  })
  status: SessionStatus;

  /**
   * Docker container ID (nullable until container is created)
   */
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'container_id' })
  containerId: string | null;

  /**
   * Session creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Session expiration timestamp
   * After this time, the session should be marked as expired
   */
  @Index('idx_session_expires_at')
  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  /**
   * Last activity timestamp
   * Updated on each user interaction
   */
  @Column({ type: 'timestamp', name: 'last_activity_at' })
  lastActivityAt: Date;

  /**
   * Owning user (many-to-one relationship)
   */
  @ManyToOne(() => User, (user) => user.sessions, {
    nullable: false,
    onDelete: 'CASCADE', // Delete sessions when user is deleted
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * User ID (foreign key)
   * Indexed for fast lookups by user
   */
  @Index('idx_session_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * Optional associated project (nullable for backward compatibility).
   */
  @ManyToOne(() => Project, (project) => project.sessions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  /**
   * Optional project ID (foreign key).
   */
  @Index('idx_sessions_project_id')
  @Column({ type: 'uuid', name: 'project_id', nullable: true })
  projectId: string | null;

  /**
   * Termination timestamp (nullable)
   * Set when session is terminated by governance violation or manual action
   * Once set, session is irreversibly terminated (HTTP 410 Gone)
   * 
   * PHASE-40B-3A: Added for unified session persistence
   */
  @Index('idx_sessions_terminated_at')
  @Column({ type: 'timestamp', nullable: true, name: 'terminated_at' })
  terminatedAt: Date | null;

  /**
   * Termination reason (nullable)
   * Examples: 'max_lifetime', 'idle_timeout', 'manual', 'error'
   * Provides context for why session was terminated
   * 
   * PHASE-40B-3A: Added for unified session persistence
   */
  @Index('idx_sessions_termination_reason')
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'termination_reason' })
  terminationReason: string | null;
}
