import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionOrApiKeyAuthGuard } from '../session-or-api-key.guard';
import { ApiKeyAuthGuard } from '../api-key-auth.guard';
import { AuthService } from '../auth.service';
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

  describe('AGENT-PLATFORM-EXEC-01C5 browser-session Harness entitlement', () => {
    const ALLOW_LIST_KEY = 'AGENT_HARNESS_BROWSER_SESSION_USER_IDS';
    const ALLOWED_USER_ID = '11111111-1111-4111-8111-111111111111';
    const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
    const SESSION_COOKIE = 'valid-session-token';

    let originalAllowList: string | undefined;

    function restoreAllowListEnv(): void {
      if (originalAllowList === undefined) {
        delete process.env[ALLOW_LIST_KEY];
      } else {
        process.env[ALLOW_LIST_KEY] = originalAllowList;
      }
    }

    async function authenticateBrowserUser(
      userOverrides?: Partial<Pick<User, 'id' | 'email' | 'role' | 'planType'>>,
    ) {
      const { context, request } = createContext({
        cookies: { aisandbox_session: SESSION_COOKIE },
      });
      mockAuthService.validateSessionToken.mockResolvedValue({
        id: ALLOWED_USER_ID,
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        ...userOverrides,
      } as User);
      const result = await guard.canActivate(context);
      return { result, request };
    }

    beforeEach(() => {
      originalAllowList = process.env[ALLOW_LIST_KEY];
      delete process.env[ALLOW_LIST_KEY];
    });

    afterEach(() => {
      restoreAllowListEnv();
    });

    it('grants harnessEntitled true to one valid configured authenticated user UUID', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;

      const { result, request } = await authenticateBrowserUser();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(ALLOWED_USER_ID);
      expect(request.apiKeyIdentity.apiKeyId).toBe('browser-session');
      expect(request.apiKeyIdentity.scopes).toEqual(['ai:execute']);
      expect(request.apiKeyIdentity.isInternal).toBe(true);
      expect(request.apiKeyIdentity.harnessEntitled).toBe(true);
    });

    it('does not grant entitlement to a different valid authenticated user UUID', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;

      const { result, request } = await authenticateBrowserUser({
        id: OTHER_USER_ID,
      });

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(OTHER_USER_ID);
      expect(request.apiKeyIdentity.isInternal).toBe(true);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('missing configuration grants nobody', async () => {
      delete process.env[ALLOW_LIST_KEY];

      const { result, request } = await authenticateBrowserUser();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(ALLOWED_USER_ID);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('empty and whitespace-only configuration grants nobody', async () => {
      process.env[ALLOW_LIST_KEY] = '';
      const empty = await authenticateBrowserUser();
      expect(empty.result).toBe(true);
      expect(empty.request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');

      process.env[ALLOW_LIST_KEY] = '   \t\n  ';
      const whitespace = await authenticateBrowserUser();
      expect(whitespace.result).toBe(true);
      expect(whitespace.request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('one malformed token invalidates the entire list even when the authenticated UUID is also present', async () => {
      process.env[ALLOW_LIST_KEY] = `${ALLOWED_USER_ID},not-a-uuid`;

      const { result, request } = await authenticateBrowserUser();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(ALLOWED_USER_ID);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('rejects an email address as an allow-list entry and grants nobody', async () => {
      process.env[ALLOW_LIST_KEY] = 'user@example.com';

      const { result, request } = await authenticateBrowserUser({
        email: 'user@example.com',
      });

      expect(result).toBe(true);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('discards empty tokens inside a non-empty list because they are not malformed', async () => {
      process.env[ALLOW_LIST_KEY] = `,${ALLOWED_USER_ID},,${OTHER_USER_ID},`;

      const entitled = await authenticateBrowserUser();
      expect(entitled.result).toBe(true);
      expect(entitled.request.apiKeyIdentity.harnessEntitled).toBe(true);

      const other = await authenticateBrowserUser({ id: OTHER_USER_ID });
      expect(other.result).toBe(true);
      expect(other.request.apiKeyIdentity.harnessEntitled).toBe(true);
    });

    it('treats duplicates as a set and does not change the membership result', async () => {
      process.env[ALLOW_LIST_KEY] = `${ALLOWED_USER_ID},${ALLOWED_USER_ID},${ALLOWED_USER_ID}`;

      const entitled = await authenticateBrowserUser();
      expect(entitled.result).toBe(true);
      expect(entitled.request.apiKeyIdentity.harnessEntitled).toBe(true);

      const other = await authenticateBrowserUser({ id: OTHER_USER_ID });
      expect(other.result).toBe(true);
      expect(other.request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('trims surrounding whitespace on the raw value and each token, then matches case-insensitively', async () => {
      process.env[ALLOW_LIST_KEY] = `  ${ALLOWED_USER_ID.toUpperCase()} , ${OTHER_USER_ID}  `;

      const entitled = await authenticateBrowserUser({
        id: ALLOWED_USER_ID.toLowerCase(),
      });
      expect(entitled.result).toBe(true);
      expect(entitled.request.apiKeyIdentity.harnessEntitled).toBe(true);
    });

    it('matches only authenticated user.id, not email, role, plan, or request/body userId', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;
      const { context, request } = createContext({
        cookies: { aisandbox_session: SESSION_COOKIE },
      });
      request.body = { userId: ALLOWED_USER_ID };
      mockAuthService.validateSessionToken.mockResolvedValue({
        id: OTHER_USER_ID,
        email: ALLOWED_USER_ID,
        role: ALLOWED_USER_ID,
        planType: ALLOWED_USER_ID,
      } as unknown as User);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.userId).toBe(OTHER_USER_ID);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
      expect(mockAuthService.validateSessionToken).toHaveBeenCalledWith(SESSION_COOKIE);
    });

    it('does not treat isInternal true as Harness entitlement', async () => {
      delete process.env[ALLOW_LIST_KEY];

      const { result, request } = await authenticateBrowserUser();

      expect(result).toBe(true);
      expect(request.apiKeyIdentity.isInternal).toBe(true);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });

    it('keeps invalid/expired session behavior unchanged', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;
      const { context } = createContext({
        cookies: { aisandbox_session: 'expired-token' },
      });
      mockAuthService.validateSessionToken.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired session',
      );
    });

    it('keeps missing-cookie behavior unchanged', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;
      const { context } = createContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing authentication credentials',
      );
    });

    it('keeps Bearer-header priority unchanged when a session cookie is also present', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;
      const { context } = createContext({
        authHeader: 'Bearer my-api-key',
        cookies: { aisandbox_session: SESSION_COOKIE },
      });
      mockApiKeyAuthGuard.canActivate.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockApiKeyAuthGuard.canActivate).toHaveBeenCalledWith(context);
      expect(mockAuthService.validateSessionToken).not.toHaveBeenCalled();
    });

    it('does not apply the browser allow-list to the Bearer API-key identity', async () => {
      process.env[ALLOW_LIST_KEY] = ALLOWED_USER_ID;
      const { context, request } = createContext({
        authHeader: 'Bearer test-api-key-user-1',
      });
      const apiKeyIdentity = {
        userId: ALLOWED_USER_ID,
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
      expect(mockApiKeyAuthGuard.canActivate).toHaveBeenCalledWith(context);
      expect(mockAuthService.validateSessionToken).not.toHaveBeenCalled();
      expect(request.apiKeyIdentity).toEqual(apiKeyIdentity);
      expect(request.apiKeyIdentity).not.toHaveProperty('harnessEntitled');
    });
  });
});
