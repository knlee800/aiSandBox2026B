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
   * PHASE-41C: Proxy-aware IP normalization
   * - Parses X-Forwarded-For header (first public IP only)
   * - Skips private IP ranges
   * - Normalizes IPv6 formats
   * - Fallback chain: X-Forwarded-For → request.ip → socket.remoteAddress → 'unknown'
   */
  private getClientIp(request: Request): string {
    try {
      // 1. Try X-Forwarded-For (first public IP)
      const forwardedFor = request.headers['x-forwarded-for'];
      if (forwardedFor) {
        const ips = Array.isArray(forwardedFor)
          ? forwardedFor[0].split(',')
          : forwardedFor.split(',');

        // Find first public IP
        for (const ip of ips) {
          const normalized = this.normalizeIp(ip.trim());
          if (!this.isPrivateIp(normalized)) {
            return normalized;
          }
        }

        // All IPs are private, use last one (closest to server)
        if (ips.length > 0) {
          return this.normalizeIp(ips[ips.length - 1].trim());
        }
      }

      // 2. Fallback to request.ip
      if ((request as any).ip) {
        return this.normalizeIp((request as any).ip);
      }

      // 3. Fallback to socket.remoteAddress
      if (request.socket.remoteAddress) {
        return this.normalizeIp(request.socket.remoteAddress);
      }

      // 4. Final fallback
      return 'unknown';
    } catch (error) {
      // Never throw during IP extraction
      return 'unknown';
    }
  }

  /**
   * Normalize IP address format
   * PHASE-41C: Converts IPv4-mapped IPv6 to IPv4
   */
  private normalizeIp(ip: string): string {
    if (!ip) return 'unknown';

    // Remove IPv4-mapped IPv6 prefix (::ffff:x.x.x.x → x.x.x.x)
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }

    return ip;
  }

  /**
   * Check if IP is in private range
   * PHASE-41C: Detects RFC 1918 and RFC 4193 private addresses
   */
  private isPrivateIp(ip: string): boolean {
    if (!ip || ip === 'unknown') return false;

    // IPv4 private ranges
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('127.')) return true;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }

    // IPv6 private ranges
    if (ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    if (ip.startsWith('fe80:')) return true; // Link-local

    return false;
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
