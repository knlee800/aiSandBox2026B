import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthController } from './auth.controller';

describe('AuthController email verification routes', () => {
  const mockAuthService = {
    register: jest.fn(),
    validateAndConsumeToken: jest.fn(),
    markEmailVerified: jest.fn(),
    resendEmailVerification: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
  };

  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(mockAuthService as any, {
      resolveHarnessEntitled: jest.fn(),
    } as any);
  });

  it('register passes locale into authService.register', async () => {
    const userResponse = {
      id: 'user-1',
      email: 'new@example.com',
      role: 'user',
      plan_type: 'free',
    };
    mockAuthService.register.mockResolvedValue(userResponse);

    const result = await controller.register(
      { email: 'new@example.com', password: 'password123' },
      'zh-TW,zh;q=0.9',
    );

    expect(mockAuthService.register).toHaveBeenCalledWith(
      'new@example.com',
      'password123',
      'zh-TW',
    );
    expect(result).toEqual({
      message: 'User registered successfully',
      user: userResponse,
    });
  });

  it('GET email verify success redirects to /en/login?verified=1', async () => {
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;

    mockAuthService.validateAndConsumeToken.mockResolvedValue({
      userId: 'user-2',
      locale: 'en',
    });
    mockAuthService.markEmailVerified.mockResolvedValue(undefined);

    await controller.verifyEmail('valid-token', undefined, response);

    expect(mockAuthService.validateAndConsumeToken).toHaveBeenCalledWith('valid-token', 'email_verify');
    expect(mockAuthService.markEmailVerified).toHaveBeenCalledWith('user-2');
    expect(response.redirect).toHaveBeenCalledWith('/en/login?verified=1');
  });

  it('GET email verify invalid redirects to /en/login?error=token_expired', async () => {
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;

    mockAuthService.validateAndConsumeToken.mockRejectedValue(
      new UnauthorizedException('Invalid or expired verification token'),
    );

    await controller.verifyEmail('invalid-token', undefined, response);

    expect(mockAuthService.markEmailVerified).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith('/en/login?error=token_expired');
  });

  it('POST resend returns generic message and calls service with locale', async () => {
    mockAuthService.resendEmailVerification.mockResolvedValue(undefined);

    const result = await controller.resendVerificationEmail(
      { email: 'user@example.com' },
      'zh-CN,zh;q=0.9',
    );

    expect(mockAuthService.resendEmailVerification).toHaveBeenCalledWith('user@example.com', 'zh-CN');
    expect(result).toEqual({
      message: 'If that email is registered and unverified, a new verification link has been sent.',
    });
  });

  it('POST password-reset/request returns generic message and calls requestPasswordReset with locale', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

    const result = await controller.requestPasswordReset(
      { email: 'user@example.com' },
      'zh-TW,zh;q=0.9',
    );

    expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('user@example.com', 'zh-TW');
    expect(result).toEqual({
      message: 'If that email is registered, a password reset link has been sent.',
    });
  });

  it('POST password-reset/request preserves generic 200 behavior when service no-ops', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

    const result = await controller.requestPasswordReset({ email: 'unknown@example.com' }, undefined);

    expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('unknown@example.com', 'en');
    expect(result).toEqual({
      message: 'If that email is registered, a password reset link has been sent.',
    });
  });

  it('POST password-reset/confirm valid returns success message', async () => {
    mockAuthService.confirmPasswordReset.mockResolvedValue(undefined);

    const result = await controller.confirmPasswordReset({
      token: 'valid-reset-token',
      newPassword: 'newpassword123',
    });

    expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(
      'valid-reset-token',
      'newpassword123',
    );
    expect(result).toEqual({
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  });

  it('POST password-reset/confirm maps UnauthorizedException to BadRequestException', async () => {
    mockAuthService.confirmPasswordReset.mockRejectedValue(
      new UnauthorizedException('Invalid or expired verification token'),
    );

    const promise = controller.confirmPasswordReset({
      token: 'expired-reset-token',
      newPassword: 'newpassword123',
    });

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(
      'Reset link is invalid or has expired. Please request a new one.',
    );
  });
});

describe('AuthController getProfile harness entitlement', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const profile = {
    id: userId,
    email: 'profile@example.com',
    role: 'user',
    plan_type: 'free',
    emailVerified: true,
  };

  const mockAuthService = {
    getUserById: jest.fn(),
  };
  const entitlements = {
    resolveHarnessEntitled: jest.fn(),
    resolveAgentWriteEnabled: jest.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.getUserById.mockResolvedValue({ ...profile });
    entitlements.resolveAgentWriteEnabled.mockResolvedValue(false);
    controller = new AuthController(mockAuthService as any, entitlements as any);
  });

  it('returns harnessEntitled true from the table read and keeps the existing profile fields', async () => {
    entitlements.resolveHarnessEntitled.mockResolvedValue(true);

    const result = await controller.getProfile({ user: { userId } });

    expect(entitlements.resolveHarnessEntitled).toHaveBeenCalledWith(userId);
    expect(mockAuthService.getUserById).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      ...profile,
      harnessEntitled: true,
      agentWriteEnabled: false,
    });
  });

  it('returns harnessEntitled false from the table read and keeps the existing profile fields', async () => {
    entitlements.resolveHarnessEntitled.mockResolvedValue(false);

    const result = await controller.getProfile({ user: { userId } });

    expect(entitlements.resolveHarnessEntitled).toHaveBeenCalledWith(userId);
    expect(mockAuthService.getUserById).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      ...profile,
      harnessEntitled: false,
      agentWriteEnabled: false,
    });
  });

  it('returns agentWriteEnabled true when the lookup is true', async () => {
    entitlements.resolveHarnessEntitled.mockResolvedValue(true);
    entitlements.resolveAgentWriteEnabled.mockResolvedValue(true);

    const result = await controller.getProfile({ user: { userId } });

    expect(entitlements.resolveAgentWriteEnabled).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      ...profile,
      harnessEntitled: true,
      agentWriteEnabled: true,
    });
  });

  it('returns agentWriteEnabled false when the lookup is false', async () => {
    entitlements.resolveHarnessEntitled.mockResolvedValue(false);
    entitlements.resolveAgentWriteEnabled.mockResolvedValue(false);

    const result = await controller.getProfile({ user: { userId } });

    expect(entitlements.resolveAgentWriteEnabled).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      ...profile,
      harnessEntitled: false,
      agentWriteEnabled: false,
    });
  });

  it('returns agentWriteEnabled false when the lookup fails', async () => {
    entitlements.resolveHarnessEntitled.mockResolvedValue(true);
    entitlements.resolveAgentWriteEnabled.mockRejectedValue(new Error('lookup failed'));

    const result = await controller.getProfile({ user: { userId } });

    expect(entitlements.resolveAgentWriteEnabled).toHaveBeenCalledWith(userId);
    expect(result).toEqual({
      ...profile,
      harnessEntitled: true,
      agentWriteEnabled: false,
    });
  });
});

describe('AuthController session cookie (COOKIE-PREFIX-01)', () => {
  const ENV_NAMES = ['APP_BASE_URL', 'NODE_ENV'] as const;
  const saved: Record<string, string | undefined> = {};
  const authService = {
    login: jest.fn(async () => ({ sessionToken: 'new-token', user: { id: 'user-1' } })),
    revokeSession: jest.fn(async () => undefined),
  };
  let controller: AuthController;

  function recordingResponse() {
    const calls: Array<{ kind: 'set' | 'clear'; name: string; value?: string; options: any }> = [];
    const response = {
      cookie: jest.fn((name: string, value: string, options: any) => {
        calls.push({ kind: 'set', name, value, options });
      }),
      clearCookie: jest.fn((name: string, options: any) => {
        calls.push({ kind: 'clear', name, options });
      }),
    } as unknown as Response;
    return { response, calls };
  }

  beforeEach(() => {
    for (const name of ENV_NAMES) saved[name] = process.env[name];
    jest.clearAllMocks();
    controller = new AuthController(authService as any, {} as any);
  });

  afterEach(() => {
    for (const name of ENV_NAMES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  describe('secure mode', () => {
    beforeEach(() => {
      process.env.APP_BASE_URL = 'https://staging.ainow.biz';
      process.env.NODE_ENV = 'test';
    });

    it('login sets __Host-aisandbox_session and clears the old name', async () => {
      const { response, calls } = recordingResponse();
      await controller.login({ email: 'a@example.com', password: 'x' } as any, response);
      expect(calls).toEqual([
        {
          kind: 'clear',
          name: 'aisandbox_session',
          options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
        },
        {
          kind: 'set',
          name: '__Host-aisandbox_session',
          value: 'new-token',
          options: {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          },
        },
      ]);
      expect(calls.some((call) => 'domain' in (call.options ?? {}))).toBe(false);
    });

    it('logout revokes the __Host- token and clears both names with Secure and Path=/', async () => {
      const { response, calls } = recordingResponse();
      await controller.logout(
        { cookies: { '__Host-aisandbox_session': 'real-token', aisandbox_session: 'old-token' } },
        response,
      );
      expect(authService.revokeSession).toHaveBeenCalledWith('real-token');
      expect(calls).toEqual([
        {
          kind: 'clear',
          name: '__Host-aisandbox_session',
          options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
        },
        {
          kind: 'clear',
          name: 'aisandbox_session',
          options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
        },
      ]);
    });
  });

  describe('local http (today unchanged)', () => {
    beforeEach(() => {
      process.env.APP_BASE_URL = 'http://localhost:3000';
      process.env.NODE_ENV = 'development';
    });

    it('login sets aisandbox_session exactly as before and clears nothing', async () => {
      const { response, calls } = recordingResponse();
      await controller.login({ email: 'a@example.com', password: 'x' } as any, response);
      expect(calls).toEqual([
        {
          kind: 'set',
          name: 'aisandbox_session',
          value: 'new-token',
          options: {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          },
        },
      ]);
    });

    it('logout clears aisandbox_session with path / only, as before', async () => {
      const { response, calls } = recordingResponse();
      await controller.logout({ cookies: { aisandbox_session: 'local-token' } }, response);
      expect(authService.revokeSession).toHaveBeenCalledWith('local-token');
      expect(calls).toEqual([{ kind: 'clear', name: 'aisandbox_session', options: { path: '/' } }]);
    });
  });
});
