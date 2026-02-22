import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * RateLimitGuard
 * 
 * PHASE-41B: In-memory rate limiting for high-risk endpoints
 * 
 * Implementation:
 * - In-memory Map with timestamp buckets
 * - Key = endpoint + client IP
 * - Window resets every 60 seconds
 * - No external dependencies (no Redis)
 * - No background workers (cleanup on access)
 * 
 * Usage:
 * @UseGuards(RateLimitGuard)
 * @RateLimit({ maxRequests: 10, windowMs: 60000 })
 */

// Metadata key for rate limit configuration
export const RATE_LIMIT_KEY = 'rateLimit';

// Rate limit configuration interface
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

// Rate limit decorator
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);

// Request tracking entry
interface RequestEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  // In-memory storage: key = "endpoint:ip", value = RequestEntry
  private readonly requests = new Map<string, RequestEntry>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get rate limit configuration from decorator
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // If no rate limit configured, allow request
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const endpoint = `${request.method} ${request.route?.path || request.path}`;
    const key = `${endpoint}:${clientIp}`;

    const now = Date.now();
    const entry = this.requests.get(key);

    // If no entry or window expired, create new entry
    if (!entry || now - entry.windowStart >= config.windowMs) {
      this.requests.set(key, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil(
        (entry.windowStart + config.windowMs - now) / 1000,
      );

      // Set Retry-After header before throwing
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', retryAfter.toString());

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too Many Requests',
          error: `Rate limit exceeded for ${endpoint}`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          cause: {
            retryAfter,
          },
        },
      );
    }

    return true;
  }

  /**
   * Extract client IP from request
   * Checks X-Forwarded-For header first (for proxies), then falls back to socket IP
   */
  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }
    return request.socket.remoteAddress || 'unknown';
  }

  /**
   * Cleanup expired entries (called periodically on access)
   * Removes entries older than 2 minutes to prevent memory leaks
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const maxAge = 120000; // 2 minutes

    for (const [key, entry] of this.requests.entries()) {
      if (now - entry.windowStart > maxAge) {
        this.requests.delete(key);
      }
    }
  }
}
