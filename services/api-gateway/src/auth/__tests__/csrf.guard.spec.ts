import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from '../csrf.guard';

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  const buildContext = (
    csrfCookie?: string,
    csrfHeader?: string | string[],
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          cookies: csrfCookie === undefined ? {} : { aisandbox_csrf: csrfCookie },
          headers: csrfHeader === undefined ? {} : { 'x-csrf-token': csrfHeader },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('returns true when cookie and header match', () => {
    expect(guard.canActivate(buildContext('token-value', 'token-value'))).toBe(true);
  });

  it('throws when the CSRF cookie is missing', () => {
    expect(() => guard.canActivate(buildContext(undefined, 'token-value'))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when the CSRF header is missing', () => {
    expect(() => guard.canActivate(buildContext('token-value', undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when cookie and header do not match', () => {
    expect(() => guard.canActivate(buildContext('token-value', 'other-token'))).toThrow(
      ForbiddenException,
    );
  });

  it('throws when the CSRF header is empty', () => {
    expect(() => guard.canActivate(buildContext('token-value', ''))).toThrow(
      ForbiddenException,
    );
  });
});

describe('CsrfGuard cookie names (COOKIE-PREFIX-01)', () => {
  const guard = new CsrfGuard();
  const ENV_NAMES = ['APP_BASE_URL', 'NODE_ENV'] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
  });

  afterEach(() => {
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  const contextWith = (cookies: Record<string, string>, header: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ cookies, headers: { 'x-csrf-token': header } }),
      }),
    }) as unknown as ExecutionContext;

  describe('secure mode', () => {
    beforeEach(() => {
      process.env.APP_BASE_URL = 'https://staging.ainow.biz';
      process.env.NODE_ENV = 'test';
    });

    it('compares the header with __Host-aisandbox_csrf', () => {
      expect(guard.canActivate(contextWith({ '__Host-aisandbox_csrf': 't' }, 't'))).toBe(true);
    });

    it('refuses a planted old-name cookie equal to the header', () => {
      expect(() => guard.canActivate(contextWith({ aisandbox_csrf: 't' }, 't'))).toThrow(
        ForbiddenException,
      );
      expect(() =>
        guard.canActivate(contextWith({ aisandbox_csrf: 't', '__Host-aisandbox_csrf': 'real' }, 't')),
      ).toThrow(ForbiddenException);
    });
  });

  it('outside secure mode reads the old name only', () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'development';
    expect(guard.canActivate(contextWith({ aisandbox_csrf: 't' }, 't'))).toBe(true);
    expect(() => guard.canActivate(contextWith({ '__Host-aisandbox_csrf': 't' }, 't'))).toThrow(
      ForbiddenException,
    );
  });
});
