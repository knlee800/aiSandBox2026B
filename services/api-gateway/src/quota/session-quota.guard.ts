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
 * SessionQuotaGuard
 *
 * PHASE-42A-1: Max Active Sessions Per User Enforcement
 *
 * Enforces hard limit on concurrent active sessions per user.
 * Applied to POST /api/sessions before container creation.
 *
 * Enforcement Logic:
 * - Query database: COUNT(*) WHERE user_id = ? AND terminated_at IS NULL
 * - If count >= MAX_ACTIVE_SESSIONS_PER_USER (5), throw HTTP 403 Forbidden
 * - Otherwise, allow session creation
 *
 * Hard Stop Behavior:
 * - No partial execution
 * - No container started if quota exceeded
 * - Deterministic error response
 *
 * Database-Backed:
 * - Quota state persists across restarts
 * - Idempotent enforcement (same request → same result)
 *
 * IMPORTANT:
 * - Requires JwtAuthGuard to run first (attaches user identity)
 * - Pre-execution check (quota validated before container start)
 * - Deterministic (same inputs → same decision)
 * - Single-node correctness only (no distributed coordination)
 */
@Injectable()
export class SessionQuotaGuard implements CanActivate {
  constructor(private readonly quotaService: QuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get authenticated user (attached by JwtAuthGuard)
    const user = request.user;

    // User must exist (JWT guard should have validated)
    if (!user || !user.userId) {
      throw new HttpException(
        'Session quota check failed: missing user identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const userId = user.userId;

    // Check session quota (database query)
    const quotaAvailable = await this.quotaService.checkSessionQuota(userId);

    if (!quotaAvailable) {
      // Get current count for error response
      const currentCount =
        await this.quotaService.getActiveSessionCount(userId);

      // Throw HTTP 403 Forbidden with deterministic error structure
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Quota exceeded',
          details: {
            quota_type: 'max_active_sessions',
            limit: QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER,
            current: currentCount,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Allow session creation
    return true;
  }
}
