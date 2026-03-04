import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * UsageRecord Entity
 *
 * Phase 22B: Usage Ledger
 * Phase 43A-2A: Idempotency via request_id
 * Phase 43B-2A: Two-phase execution record (execution_status)
 *
 * Immutable ledger for recording AI executions.
 * Used for future billing, analytics, and reporting.
 *
 * IMPORTANT:
 * - Append-only ledger (records never updated or deleted)
 * - Two-phase recording: 'pending' → 'completed' (Phase 43B-2A)
 * - Written by api-gateway BEFORE ai-service call (intent)
 * - Updated by api-gateway AFTER ai-service success (result)
 * - NO prompt or response content (privacy policy Phase 15B)
 * - Idempotent retries via request_id (Phase 43A-2A)
 */
@Entity('usage_records')
@Index('idx_usage_records_api_key_timestamp', ['apiKeyId', 'timestamp'])
@Index('idx_usage_records_user_timestamp', ['userId', 'timestamp'])
@Index('idx_usage_records_timestamp', ['timestamp'])
@Index('idx_usage_records_user_request_id', ['userId', 'requestId'], {
  unique: true,
  where: 'request_id IS NOT NULL',
})
export class UsageRecord {
  /**
   * Unique execution identifier (UUID v4)
   * Primary key - ensures exactly one record per execution
   */
  @PrimaryColumn({ type: 'uuid', name: 'execution_id' })
  executionId: string;

  /**
   * Client-provided idempotency key (Phase 43A-2A)
   * Optional - enables idempotent retries to prevent duplicate billing
   * UNIQUE constraint: (user_id, request_id) WHERE request_id IS NOT NULL
   * Source: Client-generated UUID or request identifier
   */
  @Column({ type: 'varchar', length: 100, name: 'request_id', nullable: true })
  requestId?: string;

  /**
   * API key identifier (NOT the key value)
   * Links usage to API key for billing per key
   * Source: ApiKeyIdentity from Phase 20A
   */
  @Column({ type: 'varchar', length: 50, name: 'api_key_id' })
  apiKeyId: string;

  /**
   * Verified user identifier
   * Links usage to user for user-level reporting
   * Source: Verified ApiKeyIdentity.userId from Phase 20A
   */
  @Column({ type: 'varchar', length: 50, name: 'user_id' })
  userId: string;

  /**
   * Session identifier
   * Links usage to session for session-level analytics
   * Source: AIExecutionRequest.sessionId
   */
  @Column({ type: 'uuid', name: 'session_id' })
  sessionId: string;

  /**
   * Conversation identifier
   * Links usage to conversation for conversation-level analytics
   * Source: AIExecutionRequest.conversationId
   */
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  /**
   * AI provider identifier
   * Examples: 'anthropic', 'openai', 'stub'
   * Used for provider-level reporting
   */
  @Column({ type: 'varchar', length: 50 })
  provider: string;

  /**
   * Adapter identifier
   * Examples: 'claude-stub', 'anthropic-http', 'openai-http'
   * Used for adapter-level analytics
   */
  @Column({ type: 'varchar', length: 50 })
  adapter: string;

  /**
   * AI model identifier
   * Examples: 'claude-3-5-sonnet-20241022', 'gpt-4', 'stub'
   * Source: AIExecutionResult.model from ai-service
   * Used for model-based billing
   * Phase 43B-2A: Nullable (not known until AI execution completes)
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  /**
   * Actual tokens consumed
   * Source: AIExecutionResult.tokensUsed from ai-service
   * Basis for billing calculations (future)
   * Phase 43B-2A: Nullable (not known until AI execution completes)
   */
  @Column({ type: 'integer', name: 'tokens_used', nullable: true })
  tokensUsed?: number;

  /**
   * Execution duration in milliseconds
   * Measured by api-gateway (time between request and response)
   * Used for performance analytics
   * Phase 43B-2A: Nullable (not known until AI execution completes)
   */
  @Column({ type: 'integer', name: 'execution_duration_ms', nullable: true })
  executionDurationMs?: number;

  /**
   * Execution status (Phase 43B-2A: Two-phase execution record)
   * Phase 47.1: Added cancel_requested, cancelled
   * Values: 'pending', 'running', 'completed', 'failed', 'timeout', 'cancel_requested', 'cancelled'
   * - 'pending': Execution intent written, AI call in progress
   * - 'running': Worker claimed job, AI execution in progress
   * - 'completed': AI execution succeeded, result recorded
   * - 'failed': AI execution failed
   * - 'timeout': Execution abandoned (cleanup job marks orphaned records)
   * - 'cancel_requested': Client requested cancellation, worker should abort (Phase 47)
   * - 'cancelled': Execution was aborted by worker (Phase 47)
   * Default: 'pending' (write-before-call)
   */
  @Column({ type: 'varchar', length: 20, name: 'execution_status', default: 'pending' })
  executionStatus: string;

  /**
   * Execution completion timestamp (UTC)
   * When execution completed (ledger write time)
   * Used for time-range queries (billing cycles, trends)
   */
  @CreateDateColumn({ type: 'timestamp', name: 'timestamp' })
  timestamp: Date;

  /**
   * Optional metadata (reserved for future use)
   * Examples: { "region": "us-east-1", "version": "1.0.0" }
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;
}
