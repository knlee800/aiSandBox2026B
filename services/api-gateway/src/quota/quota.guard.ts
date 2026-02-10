import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaConfig } from './quota.config';
import { ApiKeyIdentity } from '../auth/api-key.config';

/**
 * QuotaGuard
 *
 * Phase 21B: Quota enforcement guard
 *
 * Enforces quota limits before AI execution:
 * 1. Check request count quota (requests per minute)
 * 2. Check token usage quota (tokens per day)
 *
 * Runs AFTER authentication and authorization:
 * ApiKeyAuthGuard → AuthorizationGuard → QuotaGuard → Controller
 *
 * Throws 429 Too Many Requests if quota exceeded.
 * No retries, no partial execution, fail-fast.
 *
 * IMPORTANT:
 * - Requires ApiKeyAuthGuard to run first (attaches identity)
 * - Pre-execution check (quota validated before ai-service call)
 * - Deterministic (same inputs → same decision within window)
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private readonly quotaService: QuotaService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Get verified identity (attached by ApiKeyAuthGuard)
    const identity = request.apiKeyIdentity as ApiKeyIdentity;

    // Identity must exist (auth guard should have validated)
    if (!identity || !identity.apiKeyId) {
      throw new HttpException(
        'Quota check failed: missing identity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const apiKeyId = identity.apiKeyId;

    // 1. Check request count quota
    if (!this.quotaService.checkRequestQuota(apiKeyId)) {
      throw new HttpException('Quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 2. Check token usage quota (with conservative estimate)
    const estimatedTokens = QuotaConfig.estimateTokens();
    if (!this.quotaService.checkTokenQuota(apiKeyId, estimatedTokens)) {
      throw new HttpException('Quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 3. Record usage (quota check passed)
    this.quotaService.recordRequest(apiKeyId);
    this.quotaService.recordTokens(apiKeyId, estimatedTokens);

    // Allow execution
    return true;
  }
}
