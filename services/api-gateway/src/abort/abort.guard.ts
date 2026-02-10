import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AbortConfig } from './abort.config';
import { AbortMode } from './abort-mode.enum';

/**
 * AbortGuard
 *
 * Phase 28B-2: Abort & Rollback Controls
 *
 * Enforces abort mode restrictions on AI execution.
 * Executes AFTER LaunchGuard, BEFORE QuotaGuard.
 *
 * Guard Stack Position:
 * ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → AbortGuard → QuotaGuard
 *
 * Behavior by Abort Mode:
 * - NONE: Allow execution (no blocking)
 * - EXECUTION_BLOCKED: Block all AI execution (503)
 * - FULL_SHUTDOWN: Block all execution-related endpoints (503)
 *
 * Error Handling:
 * - Blocked by abort mode → 503 Service Unavailable
 *
 * Design Principles:
 * - Fail-fast (throw immediately on abort)
 * - Stateless (no caching, no session state)
 * - Deterministic (same mode → same decision)
 * - No retries
 * - No logging of credentials or content
 *
 * IMPORTANT: This guard runs AFTER LaunchGuard.
 */
@Injectable()
export class AbortGuard implements CanActivate {
  /**
   * Check if execution allowed based on abort mode
   *
   * @param context - Execution context
   * @returns true if execution allowed, throws otherwise
   * @throws ServiceUnavailableException if blocked by abort mode
   */
  canActivate(context: ExecutionContext): boolean {
    // Get current abort mode
    const currentMode = AbortConfig.getCurrentMode();

    // NONE: allow all execution
    if (currentMode === AbortMode.NONE) {
      return true;
    }

    // EXECUTION_BLOCKED: block AI execution
    if (currentMode === AbortMode.EXECUTION_BLOCKED) {
      throw new ServiceUnavailableException(
        'AI execution temporarily unavailable due to system maintenance. Please try again later.',
      );
    }

    // FULL_SHUTDOWN: block all execution
    if (currentMode === AbortMode.FULL_SHUTDOWN) {
      throw new ServiceUnavailableException(
        'Service temporarily unavailable due to emergency maintenance. Please try again later.',
      );
    }

    // Unreachable: all modes handled above
    // But included for completeness and type safety
    throw new ServiceUnavailableException(
      'Service temporarily unavailable',
    );
  }
}
