import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../entities/user.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import { OauthAccount } from '../../entities/oauth-account.entity';
import { VerificationToken } from '../../entities/verification-token.entity';
import { EMAIL_PROVIDER } from '../../email/email-provider.interface';

describe('AuthService password reset logic', () => {
  let service: AuthService;
  let originalAppBaseUrl: string | undefined;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockOauthAccountRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuthSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockVerificationTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockEmailProvider = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    originalAppBaseUrl = process.env.APP_BASE_URL;
  });

  afterAll(() => {
    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
      return;
    }
    process.env.APP_BASE_URL = originalAppBaseUrl;
  });

  beforeEach(async () => {
    process.env.APP_BASE_URL = 'http://localhost:4000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(OauthAccount),
          useValue: mockOauthAccountRepository,
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: mockAuthSessionRepository,
        },
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: mockVerificationTokenRepository,
        },
        {
          provide: EMAIL_PROVIDER,
          useValue: mockEmailProvider,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockUserRepository.create.mockImplementation((value) => value);
    mockOauthAccountRepository.create.mockImplementation((value) => value);
    mockVerificationTokenRepository.create.mockImplementation((value) => value);
  });

  it('requestPasswordReset unknown email returns silently and sends no email', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(service.requestPasswordReset('missing@example.com', 'en')).resolves.toBeUndefined();

    expect(mockVerificationTokenRepository.update).not.toHaveBeenCalled();
    expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it('requestPasswordReset inactive user returns silently and sends no email', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-2',
      email: 'inactive@example.com',
      isActive: false,
    });

    await expect(
      service.requestPasswordReset('inactive@example.com', 'en'),
    ).resolves.toBeUndefined();

    expect(mockVerificationTokenRepository.update).not.toHaveBeenCalled();
    expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
  });

  it('requestPasswordReset valid user invalidates prior tokens, generates token, and sends email', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-3',
      email: 'user@example.com',
      isActive: true,
    });
    mockVerificationTokenRepository.update.mockResolvedValue({ affected: 1 });
    const generateSpy = jest
      .spyOn(service, 'generateAndStoreVerificationToken')
      .mockResolvedValue('reset-token');

    await service.requestPasswordReset(' User@Example.com ', 'zh-TW');

    expect(mockVerificationTokenRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-3',
        type: 'password_reset',
      }),
      expect.objectContaining({
        usedAt: expect.any(Date),
      }),
    );
    expect(generateSpy).toHaveBeenCalledWith('user-3', 'password_reset', 60 * 60 * 1000, 'zh-TW');
    expect(mockEmailProvider.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset your password — AI Sandbox',
        html: expect.stringContaining('/zh-TW/reset-password?token=reset-token'),
        text: expect.stringContaining('/zh-TW/reset-password?token=reset-token'),
      }),
    );
  });

  it('confirmPasswordReset valid token updates password hash, consumes token, and revokes sessions', async () => {
    const tokenRow = {
      id: 'token-4',
      userId: 'user-4',
      type: 'password_reset',
      locale: 'en',
      usedAt: null,
      user: {
        isActive: true,
      },
    } as unknown as VerificationToken;
    mockVerificationTokenRepository.findOne.mockResolvedValue(tokenRow);
    mockVerificationTokenRepository.save.mockImplementation(async (value) => value);
    mockUserRepository.update.mockResolvedValue({ affected: 1 });
    mockAuthSessionRepository.update.mockResolvedValue({ affected: 2 });

    await service.confirmPasswordReset('valid-reset-token', 'newpassword123');

    expect(mockVerificationTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'token-4',
        usedAt: expect.any(Date),
      }),
    );
    expect(mockUserRepository.update).toHaveBeenCalledWith(
      'user-4',
      expect.objectContaining({
        passwordHash: expect.any(String),
      }),
    );
    const updatedHash = mockUserRepository.update.mock.calls[0][1].passwordHash as string;
    expect(updatedHash).not.toBe('newpassword123');
    await expect(bcrypt.compare('newpassword123', updatedHash)).resolves.toBe(true);
    expect(mockAuthSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-4',
      }),
      expect.objectContaining({
        revokedAt: expect.any(Date),
      }),
    );
  });

  it('confirmPasswordReset invalid or expired token throws UnauthorizedException', async () => {
    mockVerificationTokenRepository.findOne.mockResolvedValue(null);

    await expect(
      service.confirmPasswordReset('invalid-reset-token', 'newpassword123'),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockUserRepository.update).not.toHaveBeenCalled();
    expect(mockAuthSessionRepository.update).not.toHaveBeenCalled();
  });

  it('confirmPasswordReset short password throws BadRequestException before token lookup', async () => {
    await expect(service.confirmPasswordReset('any-token', '12345')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockVerificationTokenRepository.findOne).not.toHaveBeenCalled();
    expect(mockUserRepository.update).not.toHaveBeenCalled();
  });

  it('revokeAllUserSessions updates revokedAt on active sessions', async () => {
    mockAuthSessionRepository.update.mockResolvedValue({ affected: 2 });

    await service.revokeAllUserSessions('user-7');

    expect(mockAuthSessionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-7',
      }),
      expect.objectContaining({
        revokedAt: expect.any(Date),
      }),
    );
  });
});
