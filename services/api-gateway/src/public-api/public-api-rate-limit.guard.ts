import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PUBLIC_API_RATE_LIMIT_KEY = 'PUBLIC_API_RATE_LIMIT';

export interface PublicApiRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const PublicApiRateLimit = (config: PublicApiRateLimitConfig) =>
  SetMetadata(PUBLIC_API_RATE_LIMIT_KEY, config);

interface RequestEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class PublicApiRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RequestEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<PublicApiRateLimitConfig>(
      PUBLIC_API_RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      path?: string;
      route?: { path?: string };
      apiKeyIdentity?: { apiKeyId?: string };
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader: (key: string, value: string) => void;
    }>();

    const apiKeyId = request.apiKeyIdentity?.apiKeyId;
    if (!apiKeyId) {
      return true;
    }

    const endpoint = `${request.method ?? 'UNKNOWN'} ${request.route?.path ?? request.path ?? 'unknown'}`;
    const key = `${endpoint}:${apiKeyId}`;
    const now = Date.now();
    const existing = this.requests.get(key);

    if (!existing || now - existing.windowStart >= config.windowMs) {
      this.requests.set(key, { count: 1, windowStart: now });
      this.cleanupExpiredEntries();
      return true;
    }

    existing.count += 1;
    if (existing.count > config.maxRequests) {
      const retryAfter = Math.ceil((existing.windowStart + config.windowMs - now) / 1000);
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          error: `Rate limit exceeded for ${endpoint}`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.cleanupExpiredEntries();
    return true;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const maxAge = 120000;
    for (const [key, value] of this.requests.entries()) {
      if (now - value.windowStart > maxAge) {
        this.requests.delete(key);
      }
    }
  }
}
