import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { INTERNAL_KEY_EXEMPT } from './internal-key-exempt.decorator';

export const INTERNAL_SERVICE_KEY_HEADER = 'x-internal-service-key';

/**
 * AI-SERVICE-AUTH-01 (D5): constant-time compare of the internal service key.
 * False unless both are non-empty strings; false when the UTF-8 lengths
 * differ; otherwise crypto.timingSafeEqual. An array (header sent twice)
 * is never a match.
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
 * InternalServiceAuthGuard (AI-SERVICE-AUTH-01, D3)
 *
 * Global APP_GUARD for ai-service. Refuses every HTTP request with
 * 401 Unauthorized unless:
 * - the handler carries @InternalKeyExempt(), or
 * - INTERNAL_SERVICE_KEY is set and X-Internal-Service-Key is a single
 *   string equal to it (constant-time compare).
 *
 * The decision is made per handler, never from the path text, so letter
 * case, trailing slashes and new routes cannot open anything.
 */
@Injectable()
export class InternalServiceAuthGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceAuthGuard.name);
  private readonly internalServiceKey: string | undefined;

  constructor(private readonly reflector: Reflector) {
    this.internalServiceKey = process.env.INTERNAL_SERVICE_KEY;
    if (!this.internalServiceKey) {
      this.logger.warn(
        'INTERNAL_SERVICE_KEY not set. Every ai-service route except the exempt health and metrics routes is refused.',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const exempt = this.reflector.get<boolean>(INTERNAL_KEY_EXEMPT, context.getHandler());
    if (exempt === true) {
      return true;
    }

    if (context.getType() !== 'http') {
      throw new UnauthorizedException('Unauthorized');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
      method?: string;
      path?: string;
    }>();
    const where = `${request.method ?? '?'} ${request.path ?? '?'}`;

    if (!this.internalServiceKey) {
      this.logger.warn(`Internal key refused: ${where} (INTERNAL_SERVICE_KEY not configured)`);
      throw new UnauthorizedException('Unauthorized');
    }

    const provided = request.headers?.[INTERNAL_SERVICE_KEY_HEADER];
    if (!internalKeyMatches(provided, this.internalServiceKey)) {
      this.logger.warn(`Internal key refused: ${where}`);
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}
