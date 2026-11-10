import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

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
 */
@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  private readonly internalServiceKey: string;

  constructor() {
    const key = process.env.INTERNAL_SERVICE_KEY;

    if (!key) {
      throw new Error(
        'FATAL: INTERNAL_SERVICE_KEY environment variable is not set. Application cannot start without internal service authentication configured.',
      );
    }

    this.internalServiceKey = key;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers['x-internal-service-key'];

    if (!providedKey || !internalKeyMatches(providedKey, this.internalServiceKey)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
