import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.enum';
import { Session } from './session.entity';

/**
 * User Entity
 * Represents a user account in the AI Sandbox platform
 */
@Entity('users')
export class User {
  /**
   * Unique identifier (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User email address (unique, indexed for fast lookups)
   */
  @Index('idx_user_email')
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * Hashed password (bcrypt)
   * Never expose this field in responses
   * Nullable to support OAuth-only users
   */
  @Column({ type: 'varchar', length: 255, name: 'password_hash', nullable: true })
  passwordHash: string | null;

  /**
   * Authentication provider (email, google, apple, github)
   */
  @Column({ type: 'varchar', length: 50, name: 'auth_provider', default: 'email' })
  authProvider: string;

  /**
   * OAuth provider-specific user ID
   */
  @Column({ type: 'varchar', length: 255, name: 'oauth_id', nullable: true })
  oauthId: string | null;

  /**
   * User role (admin, user, beta)
   */
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  /**
   * Plan type (free, pro, enterprise)
   */
  @Column({ type: 'varchar', length: 50, name: 'plan_type', default: 'free' })
  planType: string;

  /**
   * Stripe customer ID for billing
   */
  @Column({ type: 'varchar', length: 255, name: 'stripe_customer_id', nullable: true })
  stripeCustomerId: string | null;

  /**
   * Account active status
   * Inactive accounts cannot log in
   */
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  /**
   * Last login timestamp
   */
  @Column({ type: 'timestamp', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  /**
   * Account creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * User's sessions (one-to-many relationship)
   */
  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
}
