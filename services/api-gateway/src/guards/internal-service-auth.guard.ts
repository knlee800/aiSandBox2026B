import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

const PROTECTED_PATH_PREFIXES = [
  '/api/internal/',
  '/api/events/',
  '/api/chat-messages/',
  '/api/token-usage/',
  '/api/runtime/',
] as const;

/**
 * AI-SERVICE-AUTH-01 (D5): constant-time compare of the internal service key.
 * False unless both are non-empty strings; false when the UTF-8 lengths
 * differ; otherwise crypto.timingSafeEqual. A header sent twice is never a
 * match (Node joins it into one longer string; an array is refused).
 * Accepts and refuses exactly what the old `!==` compare did for any key
 * that can arrive in an HTTP header.
 */
export function internalKeyMatches(provided: unknown, expected: unknown): boolean {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }
  if (provided.length === 0 || expected.length === 0) {
    return false;
  }
  const providedBytes = Buffer.from(provided, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

/**
 * InternalServiceAuthGuard
 * Protects internal service routes with shared secret authentication.
 * Task 5.2A: Internal Service Authentication
 *
 * Protected prefixes (matching ignores letter case):
 * - /api/internal/
 * - /api/events/
 * - /api/chat-messages/
 * - /api/token-usage/
 * - /api/runtime/
 *
 * Design:
 * - Checks X-Internal-Service-Key header
 * - Compares to INTERNAL_SERVICE_KEY env variable in constant time
 *   (internalKeyMatches, AI-SERVICE-AUTH-01)
 * - Returns 401 Unauthorized if missing/invalid (no detailed leak)
 * - Applies only to the prefixes above; matching ignores letter case
 * - All other routes bypass this guard
 */
@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceAuthGuard.name);
  private readonly internalServiceKey: string | undefined;

  constructor() {
    this.internalServiceKey = process.env.INTERNAL_SERVICE_KEY;

    if (!this.internalServiceKey) {
      this.logger.warn(
        '⚠️  INTERNAL_SERVICE_KEY not set. Requests to internal API endpoints are refused.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    const isProtectedRoute = PROTECTED_PATH_PREFIXES.some((prefix) =>
      path.toLowerCase().startsWith(prefix),
    );
    if (!isProtectedRoute) {
      return true; // Bypass guard for public routes
    }

    // If no key is configured, DENY access to internal routes
    if (!this.internalServiceKey) {
      this.logger.error(
        `Internal route access denied: ${path} (INTERNAL_SERVICE_KEY not configured)`,
      );
      throw new UnauthorizedException('Unauthorized');
    }

    // Check X-Internal-Service-Key header
    const providedKey = request.headers['x-internal-service-key'];

    if (!providedKey) {
      this.logger.warn(`Internal route access denied: ${path} (missing header)`);
      throw new UnauthorizedException('Unauthorized');
    }

    if (!internalKeyMatches(providedKey, this.internalServiceKey)) {
      this.logger.warn(`Internal route access denied: ${path} (invalid key)`);
      throw new UnauthorizedException('Unauthorized');
    }

    // Valid key - allow access
    this.logger.debug(`Internal route access granted: ${path}`);
    return true;
  }
}
