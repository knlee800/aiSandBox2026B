import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AppleProfileInput, AuthService, GoogleProfileInput } from './auth.service';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { OauthAccount } from '../entities/oauth-account.entity';
import { EMAIL_PROVIDER } from '../email/email-provider.interface';

describe('AuthService OAuth account linking', () => {
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
          provide: EMAIL_PROVIDER,
          useValue: mockEmailProvider,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  const googleProfile = (overrides?: Partial<GoogleProfileInput>): GoogleProfileInput => ({
    googleId: 'google-user-123',
    email: 'user@example.com',
    emailVerified: true,
    ...overrides,
  });

  const appleProfile = (overrides?: Partial<AppleProfileInput>): AppleProfileInput => ({
    appleId: 'apple-user-123',
    email: 'user@example.com',
    emailVerified: true,
    isPrivateEmail: false,
    name: null,
    ...overrides,
  });

  describe('Google OAuth', () => {
    it('returns the linked user when a google oauth account already exists', async () => {
      const linkedUser = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne.mockResolvedValue({
        id: 'oauth-1',
        user: linkedUser,
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.findOrCreateGoogleUser(googleProfile());

      expect(result).toBe(linkedUser);
      expect(mockOauthAccountRepository.findOne).toHaveBeenCalledWith({
        where: {
          provider: 'google',
          providerAccountId: 'google-user-123',
        },
        relations: {
          user: true,
        },
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-1', {
        lastLoginAt: expect.any(Date),
      });
    });

    it('links a verified google email to an existing user', async () => {
      const existingUser = {
        id: 'user-2',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockOauthAccountRepository.create.mockImplementation((value) => value);
      mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-2' });
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.findOrCreateGoogleUser(googleProfile());

      expect(result).toBe(existingUser);
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockOauthAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-2',
        provider: 'google',
        providerAccountId: 'google-user-123',
        providerEmail: 'user@example.com',
      });
      expect(mockOauthAccountRepository.save).toHaveBeenCalled();
    });

    it('creates a new user and oauth link when no match exists', async () => {
      const createdUser = {
        email: 'new.user@example.com',
        passwordHash: null,
        authProvider: 'google',
        oauthId: 'google-user-999',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      };
      const savedUser = {
        id: 'user-3',
        ...createdUser,
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((value) => value);
      mockUserRepository.save.mockResolvedValue(savedUser);
      mockOauthAccountRepository.create.mockImplementation((value) => value);
      mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-3' });

      const result = await service.findOrCreateGoogleUser(
        googleProfile({
          googleId: 'google-user-999',
          email: 'new.user@example.com',
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'new.user@example.com',
        passwordHash: null,
        authProvider: 'google',
        oauthId: 'google-user-999',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockOauthAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-3',
        provider: 'google',
        providerAccountId: 'google-user-999',
        providerEmail: 'new.user@example.com',
      });
    });

    it('rejects linking an existing user with an unverified google email', async () => {
      const existingUser = {
        id: 'user-4',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(
        service.findOrCreateGoogleUser(
          googleProfile({
            emailVerified: false,
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockOauthAccountRepository.create).not.toHaveBeenCalled();
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Apple OAuth', () => {
    it('returns the linked user when an apple oauth account already exists', async () => {
      const linkedUser = {
        id: 'user-5',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne.mockResolvedValue({
        id: 'oauth-apple-1',
        user: linkedUser,
      });
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.findOrCreateAppleUser(appleProfile());

      expect(result).toBe(linkedUser);
      expect(mockOauthAccountRepository.findOne).toHaveBeenCalledWith({
        where: {
          provider: 'apple',
          providerAccountId: 'apple-user-123',
        },
        relations: {
          user: true,
        },
      });
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-5', {
        lastLoginAt: expect.any(Date),
      });
    });

    it('auto-links a real email to an existing user', async () => {
      const existingUser = {
        id: 'user-6',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(existingUser);
      mockOauthAccountRepository.create.mockImplementation((value) => value);
      mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-apple-2' });
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.findOrCreateAppleUser(appleProfile());

      expect(result).toBe(existingUser);
      expect(mockOauthAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-6',
        provider: 'apple',
        providerAccountId: 'apple-user-123',
        providerEmail: 'user@example.com',
      });
      expect(mockOauthAccountRepository.save).toHaveBeenCalled();
    });

    it('does not auto-link a private relay email and creates a new user', async () => {
      const createdUser = {
        email: 'relay@privaterelay.appleid.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-789',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      };
      const savedUser = {
        id: 'user-7',
        ...createdUser,
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((value) => value);
      mockUserRepository.save.mockResolvedValue(savedUser);
      mockOauthAccountRepository.create.mockImplementation((value) => value);
      mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-apple-3' });

      const result = await service.findOrCreateAppleUser(
        appleProfile({
          appleId: 'apple-user-789',
          email: 'relay@privaterelay.appleid.com',
          isPrivateEmail: true,
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'relay@privaterelay.appleid.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-789',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      });
      expect(mockOauthAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-7',
        provider: 'apple',
        providerAccountId: 'apple-user-789',
        providerEmail: 'relay@privaterelay.appleid.com',
      });
    });

    it('creates a new user and oauth link when no match exists', async () => {
      const createdUser = {
        email: 'new.apple.user@example.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-999',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      };
      const savedUser = {
        id: 'user-8',
        ...createdUser,
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((value) => value);
      mockUserRepository.save.mockResolvedValue(savedUser);
      mockOauthAccountRepository.create.mockImplementation((value) => value);
      mockOauthAccountRepository.save.mockResolvedValue({ id: 'oauth-apple-4' });

      const result = await service.findOrCreateAppleUser(
        appleProfile({
          appleId: 'apple-user-999',
          email: 'new.apple.user@example.com',
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'new.apple.user@example.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-999',
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: expect.any(Date),
      });
      expect(mockOauthAccountRepository.create).toHaveBeenCalledWith({
        userId: 'user-8',
        provider: 'apple',
        providerAccountId: 'apple-user-999',
        providerEmail: 'new.apple.user@example.com',
      });
    });

    it('throws when no provider match exists and apple email is missing', async () => {
      mockOauthAccountRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOrCreateAppleUser(
          appleProfile({
            email: null,
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockOauthAccountRepository.create).not.toHaveBeenCalled();
    });

    it('throws when an apple oauth account is linked to an inactive user', async () => {
      mockOauthAccountRepository.findOne.mockResolvedValue({
        id: 'oauth-apple-5',
        user: {
          id: 'user-9',
          email: 'inactive@example.com',
          role: 'user',
          planType: 'free',
          isActive: false,
        },
      });

      await expect(service.findOrCreateAppleUser(appleProfile())).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });
});
