import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { AppleProfileInput, AuthService, GoogleProfileInput } from '../auth.service';
import { User } from '../../entities/user.entity';
import { AuthSession } from '../../entities/auth-session.entity';
import { OauthAccount } from '../../entities/oauth-account.entity';
import { VerificationToken } from '../../entities/verification-token.entity';
import { EMAIL_PROVIDER } from '../../email/email-provider.interface';

describe('AuthService email verification logic', () => {
  let service: AuthService;

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

  beforeEach(async () => {
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

  it('generateAndStoreVerificationToken stores hash (not raw) and returns base64url token', async () => {
    mockVerificationTokenRepository.save.mockImplementation(async (value) => value);

    const rawToken = await service.generateAndStoreVerificationToken(
      'user-1',
      'email_verify',
      24 * 60 * 60 * 1000,
      'zh-TW',
    );

    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');

    expect(mockVerificationTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'email_verify',
        locale: 'zh-TW',
        tokenHash: expectedHash,
      }),
    );
    expect(mockVerificationTokenRepository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: rawToken }),
    );
    expect(mockVerificationTokenRepository.save).toHaveBeenCalledTimes(1);
  });

  it('validateAndConsumeToken returns userId/locale and consumes token when valid', async () => {
    const tokenRow = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash',
      type: 'email_verify',
      locale: 'zh-CN',
      usedAt: null,
      user: {
        isActive: true,
      },
    } as unknown as VerificationToken;

    mockVerificationTokenRepository.findOne.mockResolvedValue(tokenRow);
    mockVerificationTokenRepository.save.mockImplementation(async (value) => value);

    const result = await service.validateAndConsumeToken('raw-token', 'email_verify');

    expect(result).toEqual({ userId: 'user-1', locale: 'zh-CN' });
    expect(mockVerificationTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'token-1',
        usedAt: expect.any(Date),
      }),
    );
  });

  it('validateAndConsumeToken throws for invalid/expired/used/wrong type token', async () => {
    mockVerificationTokenRepository.findOne.mockResolvedValue(null);

    await expect(
      service.validateAndConsumeToken('invalid-token', 'email_verify'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validateAndConsumeToken throws when token user is inactive', async () => {
    mockVerificationTokenRepository.findOne.mockResolvedValue({
      id: 'token-2',
      userId: 'user-2',
      locale: 'en',
      usedAt: null,
      user: {
        isActive: false,
      },
    });

    await expect(service.validateAndConsumeToken('raw-token', 'email_verify')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('resendEmailVerification returns silently for unknown email and sends no email', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    const sendSpy = jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue(undefined);

    await expect(
      service.resendEmailVerification('missing@example.com', 'en'),
    ).resolves.toBeUndefined();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockVerificationTokenRepository.update).not.toHaveBeenCalled();
  });

  it('resendEmailVerification returns silently for already verified user', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-3',
      email: 'verified@example.com',
      isActive: true,
      emailVerified: true,
    });
    const sendSpy = jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue(undefined);

    await expect(
      service.resendEmailVerification('verified@example.com', 'en'),
    ).resolves.toBeUndefined();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockVerificationTokenRepository.update).not.toHaveBeenCalled();
  });

  it('resendEmailVerification returns silently for inactive user', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-4',
      email: 'inactive@example.com',
      isActive: false,
      emailVerified: false,
    });
    const sendSpy = jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue(undefined);

    await expect(
      service.resendEmailVerification('inactive@example.com', 'en'),
    ).resolves.toBeUndefined();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(mockVerificationTokenRepository.update).not.toHaveBeenCalled();
  });

  it('resendEmailVerification invalidates old token and sends a new verification email', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-5',
      email: 'user@example.com',
      isActive: true,
      emailVerified: false,
    });
    mockVerificationTokenRepository.update.mockResolvedValue({ affected: 1 });
    const generateSpy = jest
      .spyOn(service, 'generateAndStoreVerificationToken')
      .mockResolvedValue('new-raw-token');
    const sendSpy = jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue(undefined);

    await service.resendEmailVerification(' User@Example.com ', 'zh-TW');

    expect(mockVerificationTokenRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-5',
        type: 'email_verify',
      }),
      expect.objectContaining({
        usedAt: expect.any(Date),
      }),
    );
    expect(generateSpy).toHaveBeenCalledWith(
      'user-5',
      'email_verify',
      24 * 60 * 60 * 1000,
      'zh-TW',
    );
    expect(sendSpy).toHaveBeenCalledWith('user@example.com', 'new-raw-token', 'zh-TW');
  });

  it('register generates verification token and sends verification email', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockResolvedValue({
      id: 'user-6',
      email: 'register@example.com',
      role: 'user',
      planType: 'free',
    });

    const generateSpy = jest
      .spyOn(service, 'generateAndStoreVerificationToken')
      .mockResolvedValue('register-token');
    const sendSpy = jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue(undefined);

    const result = await service.register('register@example.com', 'password123', 'zh-CN');

    expect(generateSpy).toHaveBeenCalledWith('user-6', 'email_verify', 24 * 60 * 60 * 1000, 'zh-CN');
    expect(sendSpy).toHaveBeenCalledWith('register@example.com', 'register-token', 'zh-CN');
    expect(result).toEqual({
      id: 'user-6',
      email: 'register@example.com',
      role: 'user',
      plan_type: 'free',
    });
  });

  const googleProfile = (overrides?: Partial<GoogleProfileInput>): GoogleProfileInput => ({
    googleId: 'google-user-verify',
    email: 'google@example.com',
    emailVerified: true,
    ...overrides,
  });

  const appleProfile = (overrides?: Partial<AppleProfileInput>): AppleProfileInput => ({
    appleId: 'apple-user-verify',
    email: 'apple@example.com',
    emailVerified: true,
    isPrivateEmail: false,
    name: null,
    ...overrides,
  });

  it('findOrCreateGoogleUser sets emailVerified=true for new users', async () => {
    mockOauthAccountRepository.findOne.mockResolvedValue(null);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockResolvedValue({
      id: 'google-user-id',
      email: 'google@example.com',
    });
    mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-google' });

    await service.findOrCreateGoogleUser(googleProfile());

    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: 'google',
        emailVerified: true,
      }),
    );
  });

  it('findOrCreateAppleUser sets emailVerified=true for new normal email users', async () => {
    mockOauthAccountRepository.findOne.mockResolvedValue(null);
    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockResolvedValue({
      id: 'apple-user-id',
      email: 'apple@example.com',
    });
    mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-apple' });

    await service.findOrCreateAppleUser(appleProfile());

    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: 'apple',
        emailVerified: true,
      }),
    );
  });

  it('findOrCreateAppleUser sets emailVerified=true for relay email users', async () => {
    mockOauthAccountRepository.findOne.mockResolvedValue(null);
    mockUserRepository.save.mockResolvedValue({
      id: 'apple-relay-user-id',
      email: 'relay@privaterelay.appleid.com',
    });
    mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-apple-relay' });

    await service.findOrCreateAppleUser(
      appleProfile({
        email: 'relay@privaterelay.appleid.com',
        isPrivateEmail: true,
      }),
    );

    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: 'apple',
        emailVerified: true,
      }),
    );
  });

  it('getUserById returns emailVerified', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'user-7',
      email: 'profile@example.com',
      role: 'user',
      planType: 'free',
      emailVerified: true,
    });

    const result = await service.getUserById('user-7');

    expect(result).toEqual({
      id: 'user-7',
      email: 'profile@example.com',
      role: 'user',
      plan_type: 'free',
      emailVerified: true,
    });
  });
});
