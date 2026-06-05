import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionOrApiKeyAuthGuard } from '../session-or-api-key.guard';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { AuthService } from '../auth.service';

describe('SessionOrApiKeyAuthGuard', () => {
  let guard: SessionOrApiKeyAuthGuard;
  let mockApiKeyAuthGuard: jest.Mocked<ApiKeyAuthGuard>;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockApiKeyAuthGuard = {
      canActivate: jest.fn(),
    } as any;

    mockAuthService = {
      validateSessionToken: jest.fn(),
    } as any;

    guard = new SessionOrApiKeyAuthGuard(mockApiKeyAuthGuard, mockAuthService);
  });

  function createContext(opts: {
    authHeader?: string;
    cookies?: Record<string, string>;
  }): { context: ExecutionContext; request: any } {
    const request: any = {
      headers: opts.authHeader ? { authorization: opts.authHeader } : {},
      cookies: opts.cookies ?? {},
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
    return { context, request };
  }

  it('delegates to ApiKeyAuthGuard when Authorization Bearer header is present', async () => {
    const { context, request } = createContext({
      authHeader: 'Bearer some-api-key',
    });
    mockApiKeyAuthGuard.canActivate.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockAuthService.validateSessionToken).not.toHaveBeenCalled();
  });

  it('populates req.apiKeyIdentity from session cookie when no Authorization header', async () => {
    const { context, request } = createContext({
      cookies: { aisandbox_session: 'valid-session-token' },
    });
    mockAuthService.validateSessionToken.mockResolvedValue({
      id: 'session-user-id',
      email: 'user@example.com',
      role: 'user',
      planType: 'free',
    } as any);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.apiKeyIdentity).toEqual({
      userId: 'session-user-id',
      apiKeyId: 'browser-session',
      scopes: ['ai:execute'],
      isInternal: true,
    });
    expect(mockApiKeyAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when neither header nor cookie is present', async () => {
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing authentication credentials',
    );
  });

  it('throws UnauthorizedException when session cookie is invalid/expired', async () => {
    const { context } = createContext({
      cookies: { aisandbox_session: 'expired-token' },
    });
    mockAuthService.validateSessionToken.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired session',
    );
  });

  it('header wins when both Authorization header and session cookie are present', async () => {
    const { context } = createContext({
      authHeader: 'Bearer my-api-key',
      cookies: { aisandbox_session: 'valid-session-token' },
    });
    mockApiKeyAuthGuard.canActivate.mockResolvedValue(true);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(mockAuthService.validateSessionToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when cookie exists but is empty string', async () => {
    const { context } = createContext({
      cookies: { aisandbox_session: '   ' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
