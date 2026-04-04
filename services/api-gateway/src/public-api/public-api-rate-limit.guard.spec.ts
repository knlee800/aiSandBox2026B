import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PublicApiRateLimitGuard,
  type PublicApiRateLimitConfig,
} from './public-api-rate-limit.guard';

describe('PublicApiRateLimitGuard', () => {
  const config: PublicApiRateLimitConfig = { maxRequests: 2, windowMs: 60_000 };

  const buildContext = (apiKeyId: string, retryAfterCollector: { value?: string }): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          route: { path: '/v1/sessions' },
          path: '/v1/sessions',
          apiKeyIdentity: { apiKeyId },
        }),
        getResponse: () => ({
          setHeader: (_key: string, value: string) => {
            retryAfterCollector.value = value;
          },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('rate limits per apiKeyId and endpoint', () => {
    const reflector = {
      get: jest.fn().mockReturnValue(config),
    } as unknown as Reflector;
    const guard = new PublicApiRateLimitGuard(reflector);
    const retryAfter: { value?: string } = {};

    expect(guard.canActivate(buildContext('key-1', retryAfter))).toBe(true);
    expect(guard.canActivate(buildContext('key-1', retryAfter))).toBe(true);
    expect(() => guard.canActivate(buildContext('key-1', retryAfter))).toThrow(HttpException);
    expect(retryAfter.value).toBeDefined();
  });

  it('does not share counters across api keys', () => {
    const reflector = {
      get: jest.fn().mockReturnValue(config),
    } as unknown as Reflector;
    const guard = new PublicApiRateLimitGuard(reflector);

    expect(guard.canActivate(buildContext('key-1', {}))).toBe(true);
    expect(guard.canActivate(buildContext('key-2', {}))).toBe(true);
    expect(guard.canActivate(buildContext('key-2', {}))).toBe(true);
  });
});
