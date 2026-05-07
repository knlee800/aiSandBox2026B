import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, GoogleProfileInput } from './auth.service';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { OauthAccount } from '../entities/oauth-account.entity';

describe('AuthService Google OAuth', () => {
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
