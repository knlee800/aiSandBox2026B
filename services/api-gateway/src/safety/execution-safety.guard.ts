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
import {
  GatewayAIProvider,
  GatewayProviderModelValidationError,
  resolveGatewayProvider,
} from '../ai/provider-model.catalogue';

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
    // The per-provider rate-limit counter stays keyed on AI_PROVIDER
    // (PROVIDER-SWITCH-01 decision 3; moving it is a named follow-up).
    const rateLimitProvider = (process.env.AI_PROVIDER || 'stub').toLowerCase();
    const maxTokens = body.max_tokens;

    try {
      if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
        throw new ServiceUnavailableException(
          'AI execution temporarily disabled for maintenance',
        );
      }

      // PROVIDER-SWITCH-01: check the switch of the provider this request
      // will run on, resolved exactly as the execute controllers resolve it.
      const provider = this.resolveRequestProvider(body);
      if (!KillSwitchConfig.isProviderEnabled(provider)) {
        throw new ServiceUnavailableException(
          `Provider ${provider} temporarily unavailable`,
        );
      }

      if (!this.dailyCreditCapService) {
        this.warnMissingDailyCreditCapOnce();
        this.applyInMemoryLimits(rateLimitProvider, maxTokens);
        return true;
      }

      return this.applyDailyCreditCap(
        this.dailyCreditCapService,
        request,
        rateLimitProvider,
        maxTokens,
      );
    } catch (error) {
      this.mapSafetyError(error);
    }
  }

  /**
   * Returns one of the catalogue ids, never raw request text. A provider the
   * catalogue does not know gets the same 400 the controllers give (fail
   * closed); a missing or non-string provider uses AI_PROVIDER, then stub.
   */
  private resolveRequestProvider(body: {
    provider?: unknown;
  }): GatewayAIProvider {
    try {
      return resolveGatewayProvider({
        provider: body.provider,
        fallbackProviderEnv: process.env.AI_PROVIDER,
      });
    } catch (error) {
      if (error instanceof GatewayProviderModelValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
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
