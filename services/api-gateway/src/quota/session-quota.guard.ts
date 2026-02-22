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
 * PHASE-42A-2: Max Sessions Per Rolling 24h Enforcement
 *
 * Enforces hard limits on session creation per user.
 * Applied to POST /api/sessions before container creation.
 *
 * Enforcement Logic (in order):
 * 1. Check max active sessions: COUNT(*) WHERE user_id = ? AND terminated_at IS NULL
 *    - If count >= MAX_ACTIVE_SESSIONS_PER_USER (5), throw HTTP 403 Forbidden
 * 2. Check rolling 24h sessions: COUNT(*) WHERE user_id = ? AND created_at > NOW() - 24h
 *    - If count >= MAX_SESSIONS_PER_24H (20), throw HTTP 403 Forbidden
 * 3. Otherwise, allow session creation
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

    // PHASE-42A-1: Check max active sessions quota
    const activeQuotaAvailable = await this.quotaService.checkSessionQuota(userId);

    if (!activeQuotaAvailable) {
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

    // PHASE-42A-2: Check rolling 24h sessions quota
    const rolling24hQuotaAvailable = await this.quotaService.checkRolling24hSessionQuota(userId);

    if (!rolling24hQuotaAvailable) {
      // Get current count for error response
      const currentCount =
        await this.quotaService.getRolling24hSessionCount(userId);

      // Get oldest session to calculate reset_at
      const oldestSession = await this.quotaService.getOldestSessionIn24h(userId);
      
      // Calculate reset_at: oldest session + 24h
      const resetAt = oldestSession
        ? new Date(oldestSession.getTime() + 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Throw HTTP 403 Forbidden with deterministic error structure
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Quota exceeded',
          details: {
            quota_type: 'max_sessions_per_24h',
            limit: QuotaConfig.MAX_SESSIONS_PER_24H,
            current: currentCount,
            reset_at: resetAt,
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Allow session creation
    return true;
  }
}
