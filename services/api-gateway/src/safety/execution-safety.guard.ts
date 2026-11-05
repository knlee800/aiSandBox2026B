import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { KillSwitchConfig } from './kill-switch.config';
import { GlobalSafetyLimitService } from './global-safety-limit.service';
import { DailyCreditCapService } from './daily-credit-cap.service';

/**
 * Execution Safety Guard
 *
 * Enforces kill switches, the daily credit cap, and global safety limits
 * before execution. Placed between AuthorizationGuard and QuotaGuard in the
 * guard stack.
 *
 * Phase 26B: Production Readiness
 */

@Injectable()
export class ExecutionSafetyGuard implements CanActivate {
  private readonly logger = new Logger(ExecutionSafetyGuard.name);
  private missingDailyCreditCapWarned = false;

  constructor(
    private readonly globalSafetyLimitService: GlobalSafetyLimitService,
    @Optional()
    private readonly dailyCreditCapService?: DailyCreditCapService,
  ) {}

  /**
   * Returns a boolean when the cap service is absent so callers that construct
   * this guard with only GlobalSafetyLimitService keep synchronous checks.
   * The cap path returns a Promise because it reads the credit ledger.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request?.body || {};
    const provider = (process.env.AI_PROVIDER || 'stub').toLowerCase();
    const maxTokens = body.max_tokens;

    try {
      if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
        throw new ServiceUnavailableException(
          'AI execution temporarily disabled for maintenance',
        );
      }

      if (!KillSwitchConfig.isProviderEnabled(provider)) {
        throw new ServiceUnavailableException(
          `Provider ${provider} temporarily unavailable`,
        );
      }

      if (!this.dailyCreditCapService) {
        this.warnMissingDailyCreditCapOnce();
        this.applyInMemoryLimits(provider, maxTokens);
        return true;
      }

      return this.applyDailyCreditCap(
        this.dailyCreditCapService,
        request,
        provider,
        maxTokens,
      );
    } catch (error) {
      this.mapSafetyError(error);
    }
  }

  private warnMissingDailyCreditCapOnce(): void {
    if (this.missingDailyCreditCapWarned) {
      return;
    }
    this.missingDailyCreditCapWarned = true;
    this.logger.warn(
      'Daily credit cap service is unavailable; skipping the daily credit cap check',
    );
  }

  private applyInMemoryLimits(
    provider: string,
    maxTokens: number | undefined,
  ): void {
    this.globalSafetyLimitService.checkExecutionAllowed(provider, maxTokens);
    this.globalSafetyLimitService.recordExecution(provider);
  }

  private async applyDailyCreditCap(
    dailyCreditCapService: DailyCreditCapService,
    request: { apiKeyIdentity?: { userId?: unknown } },
    provider: string,
    maxTokens: number | undefined,
  ): Promise<boolean> {
    try {
      await dailyCreditCapService.assertWithinDailyCap(
        request?.apiKeyIdentity?.userId,
      );
      this.applyInMemoryLimits(provider, maxTokens);
      return true;
    } catch (error) {
      this.mapSafetyError(error);
    }
  }

  private mapSafetyError(error: any): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const errorMessage = error.message || 'Unknown error';

    if (errorMessage.includes('max_tokens') && errorMessage.includes('exceeds')) {
      throw new BadRequestException(errorMessage);
    } else if (errorMessage.includes('rate limit exceeded')) {
      throw new HttpException(
        {
          statusCode: 429,
          message: errorMessage,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    } else {
      this.logger.error('Execution safety check failed', error);
      throw new ServiceUnavailableException('Execution safety check failed');
    }
  }
}
