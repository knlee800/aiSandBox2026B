import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * ApiKey Entity
 *
 * Phase 36A: API Key Management Backend Foundation
 *
 * Stores API keys with secure hashing.
 * Only the hashed version is stored; plaintext is returned once at creation.
 *
 * Schema:
 * - id: UUID primary key
 * - hashedKey: bcrypt hash of the full API key
 * - keyPrefix: first 8 characters for display (e.g., "sk_test_")
 * - userId: foreign key to users table
 * - scopes: JSON array of permission scopes
 * - createdAt: timestamp of creation
 * - revokedAt: nullable timestamp of revocation
 */
@Entity('api_keys')
export class ApiKey {
  /**
   * Unique identifier (UUID)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Hashed API key (bcrypt)
   * Never expose this field in responses
   */
  @Index('idx_api_key_hashed')
  @Column({ type: 'varchar', length: 255, name: 'hashed_key' })
  hashedKey: string;

  /**
   * Key prefix for display purposes (e.g., "sk_test_abc123de")
   * Allows users to identify keys without exposing the full value
   */
  @Column({ type: 'varchar', length: 20, name: 'key_prefix' })
  keyPrefix: string;

  /**
   * User who owns this API key
   */
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * User ID (foreign key)
   */
  @Index('idx_api_key_user_id')
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  /**
   * Permission scopes granted to this API key
   * Stored as JSON array (e.g., ["ai:execute", "sessions:read"])
   */
  @Column({ type: 'jsonb', default: '[]' })
  scopes: string[];

  /**
   * API key creation timestamp
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Revocation timestamp (nullable)
   * If set, the key is no longer valid
   */
  @Column({ type: 'timestamp', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  /**
   * Check if API key is revoked
   */
  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  /**
   * Check if API key is active (not revoked)
   */
  isActive(): boolean {
    return this.revokedAt === null;
  }
}
