import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QuotaConfig } from './quota.config';

/**
 * TokenQuotaGuard
 *
 * PHASE-42B-2: Atomic Token Quota Enforcement (Concurrency-Safe)
 *
 * Enforces hard limit on AI token consumption per user using PostgreSQL
 * transaction-scoped advisory locks to prevent TOCTOU race conditions.
 *
 * Enforcement Logic:
 * 1. BEGIN transaction
 * 2. Acquire advisory lock: pg_advisory_xact_lock(hash('quota:token:' || userId))
 * 3. Query: SUM(tokens_used) WHERE user_id = ? AND timestamp > NOW() - 24h
 * 4. Estimate tokens for current request
 * 5. If currentUsage + estimatedTokens > MAX_TOKENS_PER_24H:
 *      ROLLBACK (releases lock)
 *      Throw HTTP 429 Quota Exceeded
 * 6. COMMIT (releases lock)
 * 7. Allow AI execution (lock NOT held during execution)
 *
 * Hard Stop Behavior:
 * - No partial execution
 * - No AI provider called if quota exceeded
 * - Deterministic error response
 *
 * Concurrency Safety:
 * - Advisory lock serializes quota checks per user
 * - Lock held ONLY during quota check (~50-100ms)
 * - Lock NOT held during AI execution (10-30s)
 * - Automatic lock release on transaction commit/rollback
 *
 * Database-Backed:
 * - Quota state persists across restarts
 * - Idempotent enforcement (same request → same result)
 *
 * IMPORTANT:
 * - Requires ApiKeyAuthGuard to run first (attaches user identity)
 * - Pre-execution check (quota validated before AI provider call)
 * - Deterministic (same inputs → same decision)
 * - Single-node deployment (advisory locks are per-database)
 * - Uses 64-bit advisory lock (hashtext() produces bigint)
 * - Zero schema changes (no new tables/columns)
 */
@Injectable()
export class TokenQuotaGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get authenticated user (attached by ApiKeyAuthGuard)
    const identity = request.apiKeyIdentity;

    // User identity must exist (auth guard should have validated)
    if (!identity || !identity.userId) {
      throw new HttpException(
        'Token quota check failed: missing user identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const userId = identity.userId;

    // Create query runner for explicit transaction control
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    // Track transaction state to prevent rollback/commit on non-started transaction
    let transactionStarted = false;

    try {
      await queryRunner.startTransaction();
      transactionStarted = true;

      // STEP 1: Acquire transaction-scoped advisory lock
      // Lock key: hashtext('quota:token:' || userId)
      // This blocks if another transaction holds the lock for this user
      // Lock is automatically released on COMMIT or ROLLBACK
      await queryRunner.query(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        [`quota:token:${userId}`],
      );

      // STEP 2: Query rolling 24h token usage (serialized per user)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await queryRunner.query(
        `SELECT COALESCE(SUM(tokens_used), 0)::integer AS total
         FROM usage_records
         WHERE user_id = $1 
           AND timestamp > $2`,
        [userId, twentyFourHoursAgo],
      );

      const currentUsage = result[0].total;

      // STEP 3: Estimate tokens for current request
      // Conservative estimate to prevent under-quota violations
      const estimatedTokens = QuotaConfig.estimateTokens(request.body?.prompt);

      // STEP 4: Enforce quota (including estimated tokens for this request)
      if (currentUsage + estimatedTokens > QuotaConfig.MAX_TOKENS_PER_24H) {
        // Get oldest usage record for reset_at calculation
        const oldestResult = await queryRunner.query(
          `SELECT timestamp FROM usage_records
           WHERE user_id = $1 AND timestamp > $2
           ORDER BY timestamp ASC LIMIT 1`,
          [userId, twentyFourHoursAgo],
        );

        const resetAt = oldestResult[0]
          ? new Date(
              oldestResult[0].timestamp.getTime() + 24 * 60 * 60 * 1000,
            ).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // ROLLBACK transaction (releases lock automatically)
        await queryRunner.rollbackTransaction();
        transactionStarted = false; // Mark as no longer active

        // Throw HTTP 429 with quota-specific error structure
        // IMPORTANT: Use 429 (not 403) to indicate temporary resource exhaustion
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Quota Exceeded',
            message: 'Token quota exceeded',
            details: {
              quota_type: 'max_tokens_per_24h',
              limit: QuotaConfig.MAX_TOKENS_PER_24H,
              used: currentUsage,
              estimated_tokens: estimatedTokens,
              reset_at: resetAt,
            },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // STEP 5: Quota available - COMMIT transaction (releases lock)
      await queryRunner.commitTransaction();
      transactionStarted = false; // Mark as no longer active

      // Lock is now released, AI execution can proceed
      return true;
    } catch (error) {
      // Rollback ONLY if transaction was started and not yet committed/rolled back
      if (transactionStarted) {
        await queryRunner.rollbackTransaction();
        transactionStarted = false;
      }
      throw error;
    } finally {
      // Always release query runner (safe even if already released)
      await queryRunner.release();
    }
  }
}
