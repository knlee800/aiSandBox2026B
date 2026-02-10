import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyConfig, ApiKeyIdentity } from './api-key.config';

/**
 * ApiKeyAuthGuard
 *
 * Phase 20A: API key authentication guard
 *
 * Enforces API key authentication for protected endpoints.
 *
 * Responsibilities:
 * - Extract API key from Authorization header
 * - Validate API key format (Bearer token)
 * - Validate API key against static configuration
 * - Resolve API key → userId and apiKeyId
 * - Attach verified identity to request object
 *
 * Error Handling:
 * - Missing Authorization header → 401 Unauthorized
 * - Malformed Authorization header → 401 Unauthorized
 * - Invalid API key → 403 Forbidden
 *
 * Design Principles:
 * - Fail-fast (throw immediately on validation failure)
 * - Stateless (no caching, no session state)
 * - No retries
 * - No logging of credentials
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  /**
   * Validate API key and attach verified identity to request
   *
   * @param context - Execution context
   * @returns true if authenticated, throws otherwise
   * @throws UnauthorizedException if Authorization header missing or malformed
   * @throws ForbiddenException if API key invalid
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract Authorization header
    const authHeader = request.headers['authorization'];

    // Missing Authorization header
    if (!authHeader) {
      throw new UnauthorizedException('Missing authentication credentials');
    }

    // Validate Bearer token format
    const [scheme, apiKey] = authHeader.split(' ');

    if (scheme !== 'Bearer') {
      throw new UnauthorizedException('Invalid authentication scheme');
    }

    if (!apiKey || apiKey.trim().length === 0) {
      throw new UnauthorizedException('Missing API key');
    }

    // Validate API key and resolve identity
    const identity = ApiKeyConfig.validateApiKey(apiKey);

    if (!identity) {
      throw new ForbiddenException('Invalid API key');
    }

    // Attach verified identity to request
    // This will be used by the controller to inject verified userId
    (request as any).apiKeyIdentity = identity;

    return true;
  }
}
