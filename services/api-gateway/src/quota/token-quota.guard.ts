import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaConfig } from './quota.config';

/**
 * TokenQuotaGuard
 *
 * PHASE-42A-3: Max Tokens Per Rolling 24h Enforcement
 *
 * Enforces hard limit on AI token consumption per user.
 * Applied to POST /api/ai/execute before AI provider call.
 *
 * Enforcement Logic:
 * - Query database: SUM(tokens_used) WHERE user_id = ? AND timestamp > NOW() - 24h
 * - If sum >= MAX_TOKENS_PER_24H (100000), throw HTTP 403 Forbidden
 * - Otherwise, allow AI execution
 *
 * Hard Stop Behavior:
 * - No partial execution
 * - No AI provider called if quota exceeded
 * - Deterministic error response
 *
 * Database-Backed:
 * - Quota state persists across restarts
 * - Idempotent enforcement (same request → same result)
 *
 * IMPORTANT:
 * - Requires ApiKeyAuthGuard to run first (attaches user identity)
 * - Pre-execution check (quota validated before AI provider call)
 * - Deterministic (same inputs → same decision)
 * - Single-node correctness only (no distributed coordination)
 * - Enforces based on CURRENT usage only (no pre-estimation)
 * - Token usage recorded AFTER execution, so quota check is post-facto
 * - User must stay under limit to continue executing
 *
 * LIMITATION:
 * - Cannot prevent the FIRST request that exceeds quota (tokens recorded after execution)
 * - Subsequent requests blocked once quota exceeded
 * - This is acceptable for PHASE-42A-3 (deterministic, DB-backed enforcement)
 */
@Injectable()
export class TokenQuotaGuard implements CanActivate {
  constructor(private readonly quotaService: QuotaService) {}

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

    // PHASE-42A-3: Check rolling 24h token usage quota
    const tokenQuotaAvailable = await this.quotaService.checkRolling24hTokenQuota(userId);

    if (!tokenQuotaAvailable) {
      // Get current usage for error response
      const currentUsage =
        await this.quotaService.getRolling24hTokenUsage(userId);

      // Get oldest usage record to calculate reset_at
      const oldestUsage = await this.quotaService.getOldestUsageIn24h(userId);
      
      // Calculate reset_at: oldest usage + 24h
      const resetAt = oldestUsage
        ? new Date(oldestUsage.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Throw HTTP 403 Forbidden with deterministic error structure
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Quota exceeded',
          details: {
            quota_type: 'max_tokens_per_24h',
            limit: QuotaConfig.MAX_TOKENS_PER_24H,
            used: currentUsage,
            reset_at: resetAt,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Allow AI execution
    return true;
  }
}
