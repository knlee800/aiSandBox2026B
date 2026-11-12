import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { SessionOrApiKeyAuthGuard } from '../session-or-api-key.guard';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { AuthService } from '../auth.service';
import { EntitlementService } from '../entitlement.service';
import { User } from '../../entities/user.entity';

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

  describe('browser-session harness entitlement from user_entitlements', () => {
    const ALLOW_LIST_KEY = 'AGENT_HARNESS_BROWSER_SESSION_USER_IDS';
    const USER_ID = '11111111-1111-4111-8111-111111111111';
    const SESSION_COOKIE = 'valid-session-token';
    let findOne: jest.Mock;
    let originalAllowList: string | undefined;

    beforeEach(() => {
      originalAllowList = process.env[ALLOW_LIST_KEY];
      delete process.env[ALLOW_LIST_KEY];
      findOne = jest.fn().mockResolvedValue(null);
      const entitlements = new EntitlementService(
        { findOne, manager: { transaction: jest.fn() } } as never,
        { findOne: jest.fn() } as never,
      );
      guard = new SessionOrApiKeyAuthGuard(
        mockApiKeyAuthGuard,
        mockAuthService,
        entitlements,
      );
    });

    afterEach(() => {
      if (originalAllowList === undefined) {
        delete process.env[ALLOW_LIST_KEY];
      } else {
        process.env[ALLOW_LIST_KEY] = originalAllowList;
      }
    });

    async function authenticate(id = USER_ID) {
      const { context, request } = createContext({
        cookies: { aisandbox_session: SESSION_COOKIE },
      });
      mockAuthService.validateSessionToken.mockResolvedValue({
        id,
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
      } as User);
      const result = await guard.canActivate(context);
      return { result, request };
    }

    it('sets harnessEntitled when the row has harnessEnabled true and selects only that column', async () => {
      findOne.mockResolvedValue({ harnessEnabled: true });

      const { result, request } = await authenticate();

      expect(result).toBe(true);
      expect(findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: ['harnessEnabled'],
      });
      expect(request.apiKeyIdentity).toEqual({
        userId: USER_ID,
        apiKeyId: 'browser-session',
        scopes: ['ai:execute'],
        isInternal: true,
        harnessEntitled: true,
      });
    });

    it('leaves harnessEntitled unset when the row has harnessEnabled false even if the env lists the user', async () => {
      process.env[ALLOW_LIST_KEY] = USER_ID;
      findOne.mockResolvedValue({ harnessEnabled: false });

      const { result, request } = await authenticate();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(USER_ID);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('leaves harnessEntitled unset when the user has no row', async () => {
      findOne.mockResolvedValue(null);

      const { result, request } = await authenticate();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('a non-empty AGENT_HARNESS_BROWSER_SESSION_USER_IDS value grants nothing', async () => {
      process.env[ALLOW_LIST_KEY] = `${USER_ID},22222222-2222-4222-8222-222222222222`;
      findOne.mockResolvedValue(null);

      const { result, request } = await authenticate();

      expect(result).toBe(true);
      expect(findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: ['harnessEnabled'],
      });
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('leaves harnessEntitled unset and warns with the userId when the read fails', async () => {
      findOne.mockRejectedValue(new Error('secret sql'));
      const warnSpy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      try {
        const { result, request } = await authenticate();

        expect(result).toBe(true);
        expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
        expect(warnSpy).toHaveBeenCalledWith(USER_ID);
        expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('secret sql');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does not call the entitlement read on the Bearer path', async () => {
      process.env[ALLOW_LIST_KEY] = USER_ID;
      const { context, request } = createContext({
        authHeader: 'Bearer test-api-key-user-1',
      });
      const apiKeyIdentity = {
        userId: USER_ID,
        apiKeyId: 'key-1',
        scopes: ['ai:execute'],
        isInternal: true,
      };
      mockApiKeyAuthGuard.canActivate.mockImplementation(async () => {
        request.apiKeyIdentity = { ...apiKeyIdentity };
        return true;
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(findOne).not.toHaveBeenCalled();
      expect(mockAuthService.validateSessionToken).not.toHaveBeenCalled();
      expect(request.apiKeyIdentity).toEqual(apiKeyIdentity);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('leaves harnessEntitled unset when EntitlementService is absent', async () => {
      process.env[ALLOW_LIST_KEY] = USER_ID;
      guard = new SessionOrApiKeyAuthGuard(mockApiKeyAuthGuard, mockAuthService);

      const { result, request } = await authenticate();

      expect(result).toBe(true);
      expect(findOne).not.toHaveBeenCalled();
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });
  });
});

describe('SessionOrApiKeyAuthGuard cookie names (COOKIE-PREFIX-01)', () => {
  const ENV_NAMES = ['APP_BASE_URL', 'NODE_ENV'] as const;
  const saved: Record<string, string | undefined> = {};
  let validateSessionToken: jest.Mock;
  let guard: SessionOrApiKeyAuthGuard;

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    validateSessionToken = jest.fn(async (token: string) =>
      token === 'good-token'
        ? ({ id: 'user-1', email: 'u@example.com', role: 'user', planType: 'free' } as any)
        : null,
    );
    guard = new SessionOrApiKeyAuthGuard(
      { canActivate: jest.fn() } as any,
      { validateSessionToken } as any,
    );
  });

  afterEach(() => {
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  function contextWith(cookies: Record<string, string>) {
    const request: any = { headers: {}, cookies };
    return {
      request,
      context: { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext,
    };
  }

  describe('secure mode (https APP_BASE_URL)', () => {
    beforeEach(() => {
      process.env.APP_BASE_URL = 'https://staging.ainow.biz';
      process.env.NODE_ENV = 'test';
    });

    it('refuses a request that carries only the old name', async () => {
      const { context } = contextWith({ aisandbox_session: 'good-token' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect(validateSessionToken).not.toHaveBeenCalled();
    });

    it('accepts the same token under __Host-aisandbox_session', async () => {
      const { context, request } = contextWith({ '__Host-aisandbox_session': 'good-token' });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.apiKeyIdentity.userId).toBe('user-1');
    });

    it('uses only the new name when both are present and differ', async () => {
      const { context } = contextWith({
        aisandbox_session: 'planted-token',
        '__Host-aisandbox_session': 'good-token',
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(validateSessionToken).toHaveBeenCalledTimes(1);
      expect(validateSessionToken).toHaveBeenCalledWith('good-token');
    });
  });

  it('in production with no APP_BASE_URL reads only the new name', async () => {
    delete process.env.APP_BASE_URL;
    process.env.NODE_ENV = 'production';
    await expect(
      guard.canActivate(contextWith({ aisandbox_session: 'good-token' }).context),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      guard.canActivate(contextWith({ '__Host-aisandbox_session': 'good-token' }).context),
    ).resolves.toBe(true);
  });

  it('on local http reads only the old name, as before', async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.NODE_ENV = 'development';
    await expect(
      guard.canActivate(contextWith({ aisandbox_session: 'good-token' }).context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextWith({ '__Host-aisandbox_session': 'good-token' }).context),
    ).rejects.toThrow(UnauthorizedException);
  });
});
