import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { INTERNAL_KEY_EXEMPT } from './internal-key-exempt.decorator';

export const INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key';

/**
 * AI-SERVICE-AUTH-01 (D5, SCOPE 2): constant-time compare of the internal
 * service key. False unless both are non-empty strings; false when the UTF-8
 * lengths differ; otherwise crypto.timingSafeEqual. A header sent twice is
 * never a match (Node joins it into one longer string; an array is refused).
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
 * Protects internal endpoints with shared secret authentication
 * Task 6.5: Explicit Container Deletion
 *
 * Design:
 * - Checks X-Internal-Service-Key header
 * - Compares to INTERNAL_SERVICE_KEY env variable in constant time
 *   (internalKeyMatches, AI-SERVICE-AUTH-01)
 * - Returns 403 Forbidden if missing/invalid
 * - Application fails to start if INTERNAL_SERVICE_KEY not configured
 *
 * CM-AUTH-01 (D1): also the global APP_GUARD. A handler carrying
 * @InternalKeyExempt() passes without the key (only GET /api/health).
 * The decision is made per handler, never from the path text, so letter
 * case, trailing slashes and new routes cannot open anything. The existing
 * class-level @UseGuards on the internal controllers stays; running the
 * check twice costs nothing.
 */
@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  private readonly internalServiceKey: string;
  private readonly reflector: Reflector;

  constructor(@Optional() reflector?: Reflector) {
    this.reflector = reflector ?? new Reflector();
    const key = process.env.INTERNAL_SERVICE_KEY;

    if (!key) {
      throw new Error(
        'FATAL: INTERNAL_SERVICE_KEY environment variable is not set. Application cannot start without internal service authentication configured.',
      );
    }

    this.internalServiceKey = key;
  }

  canActivate(context: ExecutionContext): boolean {
    // No handler (never the case for a real Nest context) means not exempt.
    const handler = typeof context.getHandler === 'function' ? context.getHandler() : undefined;
    const exempt = handler ? this.reflector.get<boolean>(INTERNAL_KEY_EXEMPT, handler) : undefined;
    if (exempt === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers[INTERNAL_SERVICE_KEY_HEADER];

    if (!providedKey || !internalKeyMatches(providedKey, this.internalServiceKey)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
