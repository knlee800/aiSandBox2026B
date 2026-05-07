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
