import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyIdentity } from './api-key.config';

/**
 * AuthorizationGuard
 *
 * Phase 20B: Scope-based authorization guard
 *
 * Enforces authorization for protected endpoints after authentication.
 * Checks if the authenticated API key has required permission scopes.
 *
 * Responsibilities:
 * - Read required scopes from route metadata (@RequireScope decorator)
 * - Read granted scopes from verified identity (attached by ApiKeyAuthGuard)
 * - Check if all required scopes are granted
 * - Throw ForbiddenException (403) if insufficient permissions
 *
 * Error Handling:
 * - Missing required scope → 403 Forbidden
 *
 * Design Principles:
 * - Fail-fast (throw immediately on authorization failure)
 * - Stateless (no caching, no session state)
 * - Deterministic (same identity + route → same decision)
 * - No retries
 * - No logging of credentials or content
 *
 * IMPORTANT: This guard must run AFTER ApiKeyAuthGuard.
 * ApiKeyAuthGuard attaches the verified identity to the request.
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Check if authenticated user has required scopes
   *
   * @param context - Execution context
   * @returns true if authorized, throws otherwise
   * @throws ForbiddenException if insufficient permissions
   */
  canActivate(context: ExecutionContext): boolean {
    // Read required scopes from route metadata
    const requiredScopes = this.reflector.get<string[]>(
      'REQUIRED_SCOPES',
      context.getHandler(),
    );

    // No scopes required → allow
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    // Get verified identity from request (attached by ApiKeyAuthGuard)
    const request = context.switchToHttp().getRequest<Request>();
    const identity = (request as any).apiKeyIdentity as
      | ApiKeyIdentity
      | undefined;

    // Identity should always be present if ApiKeyAuthGuard ran
    // If missing, this is a configuration error (guard order wrong)
    if (!identity) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Get granted scopes from identity
    const grantedScopes = identity.scopes || [];

    // Check: all required scopes must be granted (AND logic)
    const hasPermission = requiredScopes.every((requiredScope) =>
      grantedScopes.includes(requiredScope),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
