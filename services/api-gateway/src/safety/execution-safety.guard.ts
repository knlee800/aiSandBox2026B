import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { KillSwitchConfig } from './kill-switch.config';
import { GlobalSafetyLimitService } from './global-safety-limit.service';

/**
 * Execution Safety Guard
 *
 * Enforces kill switches and global safety limits before execution.
 * Placed between AuthorizationGuard and QuotaGuard in guard stack.
 *
 * Phase 26B: Production Readiness
 */

@Injectable()
export class ExecutionSafetyGuard implements CanActivate {
  private readonly logger = new Logger(ExecutionSafetyGuard.name);

  constructor(
    private readonly globalSafetyLimitService: GlobalSafetyLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract provider and max_tokens from request body
    const body = request.body || {};
    const provider = (process.env.AI_PROVIDER || 'stub').toLowerCase();
    const maxTokens = body.max_tokens;

    try {
      // Check 1: Global execution kill switch
      if (!KillSwitchConfig.GLOBAL_EXECUTION_ENABLED) {
        throw new ServiceUnavailableException(
          'AI execution temporarily disabled for maintenance',
        );
      }

      // Check 2: Provider-specific kill switch
      if (!KillSwitchConfig.isProviderEnabled(provider)) {
        throw new ServiceUnavailableException(
          `Provider ${provider} temporarily unavailable`,
        );
      }

      // Check 3: Global safety limits (throws on exceed)
      this.globalSafetyLimitService.checkExecutionAllowed(provider, maxTokens);

      // Check 4: Record execution attempt (increment counters)
      this.globalSafetyLimitService.recordExecution(provider);

      // All checks passed
      return true;
    } catch (error) {
      // Map errors to appropriate HTTP status codes

      if (error instanceof HttpException) {
        // Already an HTTP exception, rethrow
        throw error;
      }

      const errorMessage = error.message || 'Unknown error';

      // Determine appropriate status code based on error message
      if (errorMessage.includes('max_tokens') && errorMessage.includes('exceeds')) {
        // Max tokens per execution exceeded
        throw new BadRequestException(errorMessage);
      } else if (errorMessage.includes('rate limit exceeded')) {
        // Rate limit exceeded (global or provider)
        throw new HttpException(
          {
            statusCode: 429,
            message: errorMessage,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else if (errorMessage.includes('daily spend limit')) {
        // Daily spend hard cap reached
        throw new ServiceUnavailableException(errorMessage);
      } else {
        // Unknown error, default to 503
        this.logger.error('Execution safety check failed', error);
        throw new ServiceUnavailableException(
          'Execution safety check failed',
        );
      }
    }
  }
}
