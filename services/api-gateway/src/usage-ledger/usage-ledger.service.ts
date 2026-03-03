import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageRecord } from '../entities/usage-record.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * CreateUsageRecordDto
 *
 * Data required to create a usage record
 * All fields sourced from api-gateway execution context
 * Phase 43A-2B: Added requestId for idempotent retries
 * Phase 43B-2A: Made execution result fields optional (two-phase write)
 */
export interface CreateUsageRecordDto {
  apiKeyId: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  provider: string;
  adapter: string;
  model?: string; // Phase 43B-2A: Optional (not known until AI completes)
  tokensUsed?: number; // Phase 43B-2A: Optional (not known until AI completes)
  executionDurationMs?: number; // Phase 43B-2A: Optional (not known until AI completes)
  metadata?: Record<string, unknown>;
  requestId?: string; // Phase 43A-2B: Optional idempotency key from client
  executionStatus?: string; // Phase 43B-2A: Execution status ('pending' | 'completed' | 'failed' | 'timeout')
}

/**
 * WriteExecutionIntentDto
 *
 * Phase 43B-2B: Data required to write execution intent BEFORE ai-service call
 * Minimal fields known before AI execution
 */
export interface WriteExecutionIntentDto {
  executionId: string; // Pre-generated UUID for this execution
  apiKeyId: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  provider: string;
  adapter: string;
  requestId?: string; // Optional idempotency key from client
  metadata?: Record<string, unknown>;
}

/**
 * UpdateExecutionResultDto
 *
 * Phase 43B-2C: Data required to update execution record AFTER ai-service success
 * Phase 43B-3: Added output for deterministic replay
 * Fields populated after AI execution completes
 */
export interface UpdateExecutionResultDto {
  executionId: string; // UUID of the execution intent record
  model: string; // AI model used
  tokensUsed: number; // Actual tokens consumed
  executionDurationMs: number; // Total execution time
  executionStatus: string; // 'completed' (or 'failed' for future use)
  output: string; // Phase 43B-3: AI output for deterministic replay
}

/**
 * UsageLedgerService
 *
 * Phase 22B: Usage Ledger Write Service
 * Phase 43A-2B: Idempotent write via requestId
 * Phase 43A-2C: Idempotency lookup for retry short-circuit
 * Phase 43B-2: Two-phase execution record (write-before-call)
 *
 * Responsibilities:
 * - Write immutable usage records to ledger
 * - Support two-phase execution: intent (pending) → result (completed)
 * - Ensure write-before-call semantics (Phase 43B-2B)
 * - Provide deterministic failure behavior
 * - Handle idempotent retries via requestId (Phase 43A-2B)
 * - Lookup existing records for idempotency short-circuit (Phase 43A-2C)
 *
 * IMPORTANT:
 * - Two-phase write: writeExecutionIntent() BEFORE ai-service call
 * - Update: updateExecutionResult() AFTER ai-service success
 * - Write failures cause request to fail (throw)
 * - No retries, no fallback, deterministic
 * - Duplicate requestId returns existing record (Phase 43A-2B)
 */
@Injectable()
export class UsageLedgerService {
  private readonly logger = new Logger(UsageLedgerService.name);

  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRecordRepository: Repository<UsageRecord>,
  ) {}

  /**
   * Write execution intent BEFORE ai-service call
   *
   * Phase 43B-2B: Two-phase execution record (write-before-call)
   *
   * @param dto - Execution intent data (minimal fields known before AI call)
   * @returns Promise<UsageRecord> - Written intent record (status: 'pending')
   * @throws Error if write fails (propagates to caller)
   *
   * Semantics:
   * - Writes record with execution_status = 'pending'
   * - model, tokensUsed, executionDurationMs are NULL (not known yet)
   * - If requestId provided and duplicate detected, returns existing record
   * - Throws on any failure (no retries)
   * - Deterministic behavior
   *
   * Purpose:
   * - Capture execution intent even if ai-service fails
   * - Prevent lost revenue if network/DB fails after AI success
   * - Enable idempotency check for concurrent requests
   */
  async writeExecutionIntent(
    dto: WriteExecutionIntentDto,
  ): Promise<UsageRecord> {
    // Construct intent record (status: 'pending')
    const record = this.usageRecordRepository.create({
      executionId: dto.executionId,
      apiKeyId: dto.apiKeyId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      conversationId: dto.conversationId,
      provider: dto.provider,
      adapter: dto.adapter,
      requestId: dto.requestId,
      metadata: dto.metadata,
      executionStatus: 'pending',
      // model, tokensUsed, executionDurationMs are NULL (not known yet)
    });

    try {
      // Write to database (synchronous, no retries)
      const savedRecord = await this.usageRecordRepository.save(record);

      // PHASE-43C-1: Structured JSON log — execution.intent_written
      this.logger.log(JSON.stringify({
        event: 'execution.intent_written',
        timestamp: new Date().toISOString(),
        userId: dto.userId,
        apiKeyId: dto.apiKeyId,
        requestId: dto.requestId ?? null,
        executionId: dto.executionId,
        status: 'pending',
        flow: 'new',
      }));

      return savedRecord;
    } catch (error) {
      // Phase 43A-2B: Handle idempotent retry (unique violation on user_id + request_id)
      if (dto.requestId && this.isUniqueViolation(error)) {
        this.logger.log(
          `Idempotent retry detected: userId=${dto.userId}, requestId=${dto.requestId}. ` +
            `Fetching existing record.`,
        );

        // Fetch and return existing record for this (userId, requestId)
        const existingRecord = await this.usageRecordRepository.findOne({
          where: {
            userId: dto.userId,
            requestId: dto.requestId,
          },
        });

        if (existingRecord) {
          this.logger.log(
            `Returning existing record: executionId=${existingRecord.executionId}, ` +
              `userId=${dto.userId}, requestId=${dto.requestId}, status=${existingRecord.executionStatus}`,
          );
          return existingRecord;
        }

        // Should not happen (unique violation but no record found)
        this.logger.error(
          `Unique violation detected but no existing record found: ` +
            `userId=${dto.userId}, requestId=${dto.requestId}`,
        );
        throw new Error('Idempotency conflict: unique violation but no existing record found');
      }

      // Log failure (no sensitive data)
      this.logger.error(
        `Failed to write execution intent: executionId=${dto.executionId}, ` +
          `apiKeyId=${dto.apiKeyId}, error=${error.message}`,
      );

      // Rethrow to propagate failure to caller
      throw error;
    }
  }

  /**
   * Update execution record AFTER ai-service success
   *
   * Phase 43B-2C: Two-phase execution record (update after success)
   * Phase 43B-3: Store full AIExecutionResult in metadata for deterministic replay
   *
   * @param dto - Execution result data (fields populated after AI call)
   * @returns Promise<UsageRecord> - Updated record (status: 'completed')
   * @throws Error if update fails (propagates to caller)
   *
   * Semantics:
   * - Updates existing record with execution_status = 'completed'
   * - Populates model, tokensUsed, executionDurationMs
   * - Stores full AIExecutionResult in metadata (Phase 43B-3)
   * - Throws if record not found (should never happen)
   * - Throws on any failure (no retries)
   * - Deterministic behavior
   *
   * Purpose:
   * - Record AI execution result after success
   * - Transition from 'pending' to 'completed'
   * - Enable billing based on actual token usage
   * - Enable deterministic replay (exact output match)
   */
  async updateExecutionResult(
    dto: UpdateExecutionResultDto,
  ): Promise<UsageRecord> {
    try {
      // Fetch existing record by executionId
      const record = await this.usageRecordRepository.findOne({
        where: { executionId: dto.executionId },
      });

      if (!record) {
        throw new Error(`Execution record not found: executionId=${dto.executionId}`);
      }

      // Update record with execution result
      record.model = dto.model;
      record.tokensUsed = dto.tokensUsed;
      record.executionDurationMs = dto.executionDurationMs;
      record.executionStatus = dto.executionStatus;

      // Phase 43B-3: Store full AIExecutionResult in metadata for deterministic replay
      // This enables replay to return the EXACT original response body
      record.metadata = {
        ...record.metadata,
        aiExecutionResult: {
          output: dto.output,
          tokensUsed: dto.tokensUsed,
          model: dto.model,
        },
      };

      // Save updated record
      const updatedRecord = await this.usageRecordRepository.save(record);

      // PHASE-43C-1: Structured JSON log — execution.result_updated
      this.logger.log(JSON.stringify({
        event: 'execution.result_updated',
        timestamp: new Date().toISOString(),
        userId: record.userId,
        apiKeyId: record.apiKeyId,
        requestId: record.requestId ?? null,
        executionId: dto.executionId,
        model: dto.model,
        tokensUsed: dto.tokensUsed,
        status: dto.executionStatus,
      }));

      return updatedRecord;
    } catch (error) {
      // PHASE-43C-1: Structured JSON log — execution.result_update_failed
      this.logger.error(JSON.stringify({
        event: 'execution.result_update_failed',
        timestamp: new Date().toISOString(),
        executionId: dto.executionId,
        errorClass: error?.constructor?.name ?? 'Error',
        errorMessage: error?.message ?? String(error),
      }));

      // Rethrow to propagate failure to caller
      throw error;
    }
  }

  /**
   * Write a usage record to the ledger
   *
   * Phase 22B: Success-only, synchronous write
   * Phase 43A-2B: Idempotent via requestId
   * Phase 43B-2: LEGACY METHOD - Use writeExecutionIntent() + updateExecutionResult() instead
   *
   * @deprecated Use two-phase write pattern: writeExecutionIntent() + updateExecutionResult()
   * @param dto - Usage record data
   * @returns Promise<UsageRecord> - Written record (new or existing if duplicate requestId)
   * @throws Error if write fails (propagates to caller)
   *
   * Semantics:
   * - Generates unique executionId
   * - Writes record to database with status 'completed' (single-phase)
   * - If requestId provided and duplicate detected (unique violation), fetches existing record
   * - Throws on any failure (no retries)
   * - Deterministic behavior
   *
   * IMPORTANT: This method is retained for backward compatibility only.
   * New code should use writeExecutionIntent() + updateExecutionResult().
   */
  async writeRecord(dto: CreateUsageRecordDto): Promise<UsageRecord> {
    // Generate unique execution ID
    const executionId = uuidv4();

    // Construct record (single-phase write with status 'completed')
    const record = this.usageRecordRepository.create({
      executionId,
      apiKeyId: dto.apiKeyId,
      userId: dto.userId,
      sessionId: dto.sessionId,
      conversationId: dto.conversationId,
      provider: dto.provider,
      adapter: dto.adapter,
      model: dto.model,
      tokensUsed: dto.tokensUsed,
      executionDurationMs: dto.executionDurationMs,
      metadata: dto.metadata,
      requestId: dto.requestId, // Phase 43A-2B: Optional idempotency key
      executionStatus: dto.executionStatus || 'completed', // Phase 43B-2: Default to 'completed' for legacy writes
    });

    try {
      // Write to database (synchronous, no retries)
      const savedRecord = await this.usageRecordRepository.save(record);

      // Log success (no sensitive data)
      this.logger.log(
        `Usage record written: executionId=${executionId}, ` +
          `apiKeyId=${dto.apiKeyId}, model=${dto.model}, tokens=${dto.tokensUsed}` +
          (dto.requestId ? `, requestId=${dto.requestId}` : ''),
      );

      return savedRecord;
    } catch (error) {
      // Phase 43A-2B: Handle idempotent retry (unique violation on user_id + request_id)
      if (dto.requestId && this.isUniqueViolation(error)) {
        this.logger.log(
          `Idempotent retry detected: userId=${dto.userId}, requestId=${dto.requestId}. ` +
            `Fetching existing record.`,
        );

        // Fetch and return existing record for this (userId, requestId)
        const existingRecord = await this.usageRecordRepository.findOne({
          where: {
            userId: dto.userId,
            requestId: dto.requestId,
          },
        });

        if (existingRecord) {
          this.logger.log(
            `Returning existing record: executionId=${existingRecord.executionId}, ` +
              `userId=${dto.userId}, requestId=${dto.requestId}`,
          );
          return existingRecord;
        }

        // Should not happen (unique violation but no record found)
        this.logger.error(
          `Unique violation detected but no existing record found: ` +
            `userId=${dto.userId}, requestId=${dto.requestId}`,
        );
        throw new Error('Idempotency conflict: unique violation but no existing record found');
      }

      // Log failure (no sensitive data)
      this.logger.error(
        `Failed to write usage record: executionId=${executionId}, ` +
          `apiKeyId=${dto.apiKeyId}, error=${error.message}`,
      );

      // Rethrow to propagate failure to caller
      // This will cause the request to fail (Phase 22B semantics)
      throw error;
    }
  }

  /**
   * Check if error is a unique constraint violation
   * Phase 43A-2B: Detect Postgres unique violation (code 23505)
   *
   * @param error - Error from database operation
   * @returns true if unique violation, false otherwise
   */
  private isUniqueViolation(error: any): boolean {
    // TypeORM QueryFailedError with Postgres error code 23505
    return (
      error.code === '23505' ||
      (error.constraint && error.constraint.includes('idx_usage_records_user_request_id'))
    );
  }

  /**
   * Transition orphaned 'pending' execution to 'timeout'
   *
   * Phase 43B-4: Orphan Execution Cleanup & Reconciliation
   *
   * @param executionId - UUID of the orphaned execution
   * @returns Promise<void>
   * @throws Error if update fails
   *
   * Semantics:
   * - Updates execution_status from 'pending' to 'timeout'
   * - Does NOT change tokens_used (remains NULL)
   * - Does NOT change model, executionDurationMs (remain NULL)
   * - Idempotent: If already 'timeout', no-op
   * - Deterministic: Same executionId → same outcome
   *
   * Purpose:
   * - Mark abandoned executions as 'timeout' (crashed/timed out)
   * - Allow retry with same request_id (unblock client)
   * - Preserve audit trail (no deletions)
   */
  async transitionOrphanToTimeout(executionId: string): Promise<void> {
    const result = await this.usageRecordRepository.update(
      { executionId, executionStatus: 'pending' },
      { executionStatus: 'timeout' },
    );

    if (result.affected === 0) {
      // Already transitioned (idempotent) or not found
      // PHASE-43C-1: Structured JSON log — idempotency.orphan_transition_noop
      this.logger.warn(JSON.stringify({
        event: 'idempotency.orphan_transition_noop',
        timestamp: new Date().toISOString(),
        executionId: executionId,
      }));
    } else {
      // PHASE-43C-1: Structured JSON log — idempotency.orphan_transitioned
      this.logger.log(JSON.stringify({
        event: 'idempotency.orphan_transitioned',
        timestamp: new Date().toISOString(),
        executionId: executionId,
      }));
    }
  }

  /**
   * Reuse existing execution row for retry after timeout/failed
   *
   * Phase 43B-4 HOTFIX: Reuse Execution Row on Retry After Timeout
   *
   * @param params - Execution intent data for retry
   * @returns Promise<string> - New executionId for the retry
   * @throws Error if existing record not found or not in retryable state
   *
   * Semantics:
   * - Find existing row by (userId, requestId)
   * - Ensure status is 'timeout' or 'failed' (retryable states)
   * - Generate new executionId
   * - UPDATE row (not INSERT) to avoid UNIQUE constraint violation
   * - Reset execution result fields (model, tokensUsed, executionDurationMs)
   * - Clear aiExecutionResult from metadata
   * - Set status back to 'pending'
   * - Update timestamp to NOW()
   * - Return new executionId for controller to use
   *
   * Purpose:
   * - Enable retry after orphan timeout without UNIQUE constraint violation
   * - Reuse existing row instead of creating duplicate
   * - Preserve audit trail (no deletions)
   * - Allow normal two-phase update flow to proceed
   */
  async reuseExecutionIntent(params: {
    requestId: string;
    userId: string;
    apiKeyId: string;
    sessionId: string;
    conversationId: string;
    provider: string;
    adapter: string;
    metadata?: any;
  }): Promise<string> {
    // Find existing row by (userId, requestId)
    const existingRecord = await this.usageRecordRepository.findOne({
      where: {
        userId: params.userId,
        requestId: params.requestId,
      },
    });

    if (!existingRecord) {
      throw new Error(
        `Cannot reuse execution intent: no existing record found for userId=${params.userId}, requestId=${params.requestId}`,
      );
    }

    // Ensure status is retryable (timeout or failed)
    if (
      existingRecord.executionStatus !== 'timeout' &&
      existingRecord.executionStatus !== 'failed'
    ) {
      throw new Error(
        `Cannot reuse execution intent: existing record has non-retryable status=${existingRecord.executionStatus}`,
      );
    }

    // Generate new executionId for retry
    const newExecutionId = uuidv4();

    // Strip aiExecutionResult from metadata (if present)
    const cleanMetadata = params.metadata ? { ...params.metadata } : {};
    if (cleanMetadata.aiExecutionResult) {
      delete cleanMetadata.aiExecutionResult;
    }

    // Update existing row (not INSERT) using old executionId as WHERE clause
    const previousStatus = existingRecord.executionStatus;
    const oldExecutionId = existingRecord.executionId;
    
    await this.usageRecordRepository.update(
      { executionId: oldExecutionId }, // Use old executionId to find the row
      {
        executionId: newExecutionId, // Update to new executionId
        executionStatus: 'pending',
        timestamp: new Date(),
        apiKeyId: params.apiKeyId,
        sessionId: params.sessionId,
        conversationId: params.conversationId,
        provider: params.provider,
        adapter: params.adapter,
        metadata: cleanMetadata,
        // Clear execution result fields
        model: null,
        tokensUsed: null,
        executionDurationMs: null,
      },
    );

    // PHASE-43C-1: Structured JSON log — execution.intent_reused
    this.logger.log(JSON.stringify({
      event: 'execution.intent_reused',
      timestamp: new Date().toISOString(),
      userId: params.userId,
      apiKeyId: params.apiKeyId,
      requestId: params.requestId,
      oldExecutionId: oldExecutionId,
      executionId: newExecutionId,
      previousStatus: previousStatus,
      flow: 'reuse',
    }));

    return newExecutionId;
  }

  /**
   * Find existing usage record by requestId
   *
   * Phase 43A-2C: Idempotency lookup for retry short-circuit
   *
   * @param userId - Verified user identifier
   * @param requestId - Client-provided idempotency key
   * @returns Promise<UsageRecord | null> - Existing record or null if not found
   *
   * Used by IdempotencyGuard to check if a request was already processed.
   * Enables retry-safe behavior: same (userId, requestId) → same response.
   */
  async findByRequestId(
    userId: string,
    requestId: string,
  ): Promise<UsageRecord | null> {
    return this.usageRecordRepository.findOne({
      where: {
        userId,
        requestId,
      },
    });
  }

  /**
   * Validate usage record data
   *
   * Phase 22B: Validate required fields
   *
   * @param dto - Usage record data
   * @throws Error if validation fails
   *
   * Validation rules:
   * - All required fields must be present
   * - tokensUsed must be positive (success-only)
   * - executionDurationMs must be non-negative
   */
  validateUsageRecord(dto: CreateUsageRecordDto): void {
    // Validate required fields
    if (!dto.apiKeyId) {
      throw new Error('apiKeyId is required');
    }
    if (!dto.userId) {
      throw new Error('userId is required');
    }
    if (!dto.sessionId) {
      throw new Error('sessionId is required');
    }
    if (!dto.conversationId) {
      throw new Error('conversationId is required');
    }
    if (!dto.provider) {
      throw new Error('provider is required');
    }
    if (!dto.adapter) {
      throw new Error('adapter is required');
    }
    if (!dto.model) {
      throw new Error('model is required');
    }

    // Validate token count (must be positive for success-only)
    if (typeof dto.tokensUsed !== 'number' || dto.tokensUsed <= 0) {
      throw new Error('tokensUsed must be a positive number');
    }

    // Validate duration (must be non-negative)
    if (
      typeof dto.executionDurationMs !== 'number' ||
      dto.executionDurationMs < 0
    ) {
      throw new Error('executionDurationMs must be a non-negative number');
    }
  }
}
