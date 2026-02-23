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
 */
export interface CreateUsageRecordDto {
  apiKeyId: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  provider: string;
  adapter: string;
  model: string;
  tokensUsed: number;
  executionDurationMs: number;
  metadata?: Record<string, unknown>;
  requestId?: string; // Phase 43A-2B: Optional idempotency key from client
}

/**
 * UsageLedgerService
 *
 * Phase 22B: Usage Ledger Write Service
 * Phase 43A-2B: Idempotent write via requestId
 *
 * Responsibilities:
 * - Write immutable usage records to ledger
 * - Enforce success-only recording
 * - Ensure write-before-response semantics
 * - Provide deterministic failure behavior
 * - Handle idempotent retries via requestId (Phase 43A-2B)
 *
 * IMPORTANT:
 * - Write-only service (no read/query methods in Phase 22B)
 * - Records written AFTER ai-service success
 * - Records written BEFORE client response
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
   * Write a usage record to the ledger
   *
   * Phase 22B: Success-only, synchronous write
   * Phase 43A-2B: Idempotent via requestId
   *
   * @param dto - Usage record data
   * @returns Promise<UsageRecord> - Written record (new or existing if duplicate requestId)
   * @throws Error if write fails (propagates to caller)
   *
   * Semantics:
   * - Generates unique executionId
   * - Writes record to database
   * - If requestId provided and duplicate detected (unique violation), fetches existing record
   * - Throws on any failure (no retries)
   * - Deterministic behavior
   */
  async writeRecord(dto: CreateUsageRecordDto): Promise<UsageRecord> {
    // Generate unique execution ID
    const executionId = uuidv4();

    // Construct record
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
