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
    controller = new AuthController(mockAuthService as any);
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
