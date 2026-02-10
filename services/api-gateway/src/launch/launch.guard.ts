import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyIdentity } from '../auth/api-key.config';
import { LaunchConfig } from './launch.config';
import { LaunchState } from './launch-state.enum';

/**
 * LaunchGuard
 *
 * Phase 28B-1: Launch Readiness Implementation
 *
 * Enforces launch state restrictions on AI execution.
 * Executes AFTER authentication and authorization.
 * Executes BEFORE quota and execution forwarding.
 *
 * Guard Stack Position:
 * ApiKeyAuthGuard → AuthorizationGuard → ExecutionSafetyGuard → LaunchGuard → QuotaGuard
 *
 * Behavior by Launch State:
 * - CLOSED: Block all execution (403)
 * - INTERNAL: Allow only internal keys (isInternal=true)
 * - EARLY_ACCESS: Allow internal + early access keys (isInternal or isEarlyAccess)
 * - PUBLIC: Allow all authenticated and authorized keys
 *
 * Error Handling:
 * - Blocked by launch state → 403 Forbidden
 * - Missing identity → 403 Forbidden (configuration error)
 *
 * Design Principles:
 * - Fail-fast (throw immediately on restriction violation)
 * - Stateless (no caching, no session state)
 * - Deterministic (same state + identity → same decision)
 * - No retries
 * - No logging of credentials or content
 *
 * IMPORTANT: This guard must run AFTER ApiKeyAuthGuard.
 * ApiKeyAuthGuard attaches the verified identity to the request.
 */
@Injectable()
export class LaunchGuard implements CanActivate {
  /**
   * Check if execution allowed based on launch state and API key identity
   *
   * @param context - Execution context
   * @returns true if execution allowed, throws otherwise
   * @throws ForbiddenException if blocked by launch state
   */
  canActivate(context: ExecutionContext): boolean {
    // Get current launch state
    const currentState = LaunchConfig.getCurrentState();

    // PUBLIC state: allow all authenticated/authorized keys
    if (currentState === LaunchState.PUBLIC) {
      return true;
    }

    // CLOSED state: block all execution (no identity check needed)
    if (currentState === LaunchState.CLOSED) {
      throw new ForbiddenException(
        'AI execution is currently unavailable. Please try again later.',
      );
    }

    // For INTERNAL and EARLY_ACCESS states, need to check identity
    // Get verified identity from request (attached by ApiKeyAuthGuard)
    const request = context.switchToHttp().getRequest<Request>();
    const identity = (request as any).apiKeyIdentity as
      | ApiKeyIdentity
      | undefined;

    // Identity should always be present if ApiKeyAuthGuard ran
    // If missing, this is a configuration error (guard order wrong)
    if (!identity) {
      throw new ForbiddenException('Execution not allowed in current launch state');
    }

    // INTERNAL state: allow only internal keys
    if (currentState === LaunchState.INTERNAL) {
      if (identity.isInternal === true) {
        return true;
      }
      throw new ForbiddenException(
        'AI execution is currently in internal testing phase',
      );
    }

    // EARLY_ACCESS state: allow internal + early access keys
    if (currentState === LaunchState.EARLY_ACCESS) {
      if (identity.isInternal === true || identity.isEarlyAccess === true) {
        return true;
      }
      throw new ForbiddenException(
        'AI execution is currently in early access phase',
      );
    }

    // Unreachable: all states handled above
    // But included for completeness and type safety
    throw new ForbiddenException('Execution not allowed in current launch state');
  }
}
