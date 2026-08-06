import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AppleProfileInput, AuthService, GoogleProfileInput } from './auth.service';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { CreditBalance } from '../entities/credit-balance.entity';
import { OauthAccount } from '../entities/oauth-account.entity';
import { VerificationToken } from '../entities/verification-token.entity';
import { EMAIL_PROVIDER } from '../email/email-provider.interface';
import { MONTHLY_CREDIT_ALLOCATIONS } from '../credit-ledger/types';

type MockTransactionManager = {
  create: jest.Mock;
  save: jest.Mock;
};

const buildUniqueViolationError = (constraint?: string): Error & { code: string; constraint?: string } => {
  const error = new Error('duplicate key value violates unique constraint') as Error & {
    code: string;
    constraint?: string;
  };
  error.code = '23505';
  if (constraint) {
    error.constraint = constraint;
  }
  return error;
};

const buildTransactionManager = (userId = 'tx-user-1'): MockTransactionManager => ({
  create: jest.fn((_entity: unknown, value: Record<string, unknown>) => ({ ...value })),
  save: jest.fn(async (entity: unknown, value: Record<string, unknown>) => {
    if (entity === User) {
      return { id: userId, ...value };
    }
    if (entity === CreditBalance) {
      return { id: 'tx-balance-1', ...value };
    }
    if (entity === OauthAccount) {
      return { id: 'tx-oauth-1', ...value };
    }
    if (entity === VerificationToken) {
      return { id: 'tx-token-1', ...value };
    }
    return value;
  }),
});

describe('AuthService atomic provisioning', () => {
  let service: AuthService;
  let transactionManager: MockTransactionManager;
  const originalAppBaseUrl = process.env.APP_BASE_URL;

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

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const expectAtomicSaveOrder = (expectedOrder: unknown[]) => {
    const saveOrder = transactionManager.save.mock.calls.map(([entity]) => entity);
    expect(saveOrder).toEqual(expectedOrder);
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
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    jest.useRealTimers();

    process.env.APP_BASE_URL = 'https://app.example.com';

    transactionManager = buildTransactionManager();
    mockDataSource.transaction.mockImplementation(
      async (callback: (manager: EntityManager) => Promise<unknown>) =>
        callback(transactionManager as unknown as EntityManager),
    );
    mockUserRepository.update.mockResolvedValue({ affected: 1 });
  });

  afterAll(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
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

  describe('Email registration', () => {
    it('commits user, balance, and verification token in a single transaction', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.register('new.user@example.com', 'password123', 'en');

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expectAtomicSaveOrder([User, CreditBalance, VerificationToken]);
      expect(mockVerificationTokenRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'tx-user-1',
        email: 'new.user@example.com',
        role: 'user',
        plan_type: 'free',
      });
    });

    it('sends verification email only after transaction commit', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      let transactionCommitted = false;
      mockDataSource.transaction.mockImplementation(
        async (callback: (manager: EntityManager) => Promise<unknown>) => {
          const txResult = await callback(transactionManager as unknown as EntityManager);
          transactionCommitted = true;
          return txResult;
        },
      );
      mockEmailProvider.sendEmail.mockImplementation(async () => {
        expect(transactionCommitted).toBe(true);
      });

      await service.register('post.commit@example.com', 'password123', 'en');

      expect(mockEmailProvider.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('rolls back registration when balance provisioning fails', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const balanceFailure = new Error('balance insert failed');
      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return { id: 'rollback-user-1', ...value };
        }
        if (entity === CreditBalance) {
          throw balanceFailure;
        }
        return value;
      });

      await expect(service.register('rollback@example.com', 'password123', 'en')).rejects.toBe(
        balanceFailure,
      );
      expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
      expect(mockVerificationTokenRepository.save).not.toHaveBeenCalled();
    });

    it('does not send verification email after transaction rollback', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return { id: 'rollback-user-2', ...value };
        }
        if (entity === CreditBalance) {
          throw new Error('credit balance write failed');
        }
        return value;
      });

      await expect(service.register('no-email@example.com', 'password123', 'en')).rejects.toThrow(
        'credit balance write failed',
      );
      expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
    });

    it('preserves user-already-exists behavior for concurrent duplicate email races', async () => {
      mockUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-1', email: 'dupe@example.com' } as User);

      mockDataSource.transaction.mockRejectedValue(buildUniqueViolationError('users_email_key'));

      await expect(service.register('dupe@example.com', 'password123', 'en')).rejects.toThrow(
        new UnauthorizedException('User already exists'),
      );
      expect(mockEmailProvider.sendEmail).not.toHaveBeenCalled();
    });

    it('uses authoritative free-plan allocation and UTC month boundaries for balance provisioning', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-08-15T10:45:00.000Z'));
      mockUserRepository.findOne.mockResolvedValue(null);

      await service.register('boundaries@example.com', 'password123', 'en');

      const balanceCreateCall = transactionManager.create.mock.calls.find(
        ([entity]) => entity === CreditBalance,
      );
      expect(balanceCreateCall).toBeDefined();
      expect(balanceCreateCall?.[1]).toEqual(
        expect.objectContaining({
          ownerId: 'tx-user-1',
          ownerType: 'user',
          planId: 'free',
          balance: MONTHLY_CREDIT_ALLOCATIONS.free,
          monthlyAllocation: MONTHLY_CREDIT_ALLOCATIONS.free,
          periodStart: new Date(Date.UTC(2026, 7, 1)),
          periodEnd: new Date(Date.UTC(2026, 8, 1)),
        }),
      );
    });
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('links a verified google email to an existing user without creating another balance', async () => {
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('commits new google user, balance, and oauth link atomically', async () => {
      const savedUser = {
        id: 'google-user-3',
        email: 'new.user@example.com',
        passwordHash: null,
        authProvider: 'google',
        oauthId: 'google-user-999',
        emailVerified: true,
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return savedUser;
        }
        if (entity === CreditBalance) {
          return { id: 'google-balance-1', ...value };
        }
        if (entity === OauthAccount) {
          return { id: 'google-oauth-1', ...value };
        }
        return value;
      });

      const result = await service.findOrCreateGoogleUser(
        googleProfile({
          googleId: 'google-user-999',
          email: 'new.user@example.com',
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expectAtomicSaveOrder([User, CreditBalance, OauthAccount]);
      expect(mockOauthAccountRepository.save).not.toHaveBeenCalled();
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('refetches and returns committed google winner on oauth uniqueness race', async () => {
      const winner = {
        id: 'google-winner-1',
        email: 'winner@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'oauth-google-winner',
          user: winner,
        });
      mockUserRepository.findOne.mockResolvedValue(null);
      mockDataSource.transaction.mockRejectedValue(
        buildUniqueViolationError('uq_oauth_accounts_provider_provider_account_id'),
      );

      const result = await service.findOrCreateGoogleUser(googleProfile());

      expect(result).toBe(winner);
      expect(mockUserRepository.update).toHaveBeenCalledWith('google-winner-1', {
        lastLoginAt: expect.any(Date),
      });
    });

    it('propagates oauth uniqueness errors when no committed google winner is found', async () => {
      const uniqueError = buildUniqueViolationError('uq_oauth_accounts_provider_provider_account_id');

      mockOauthAccountRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockDataSource.transaction.mockRejectedValue(uniqueError);

      await expect(service.findOrCreateGoogleUser(googleProfile())).rejects.toBe(uniqueError);
    });

    it('propagates unrelated database errors for google provisioning', async () => {
      const dbError = new Error('deadlock detected') as Error & { code: string };
      dbError.code = '40P01';

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      mockDataSource.transaction.mockRejectedValue(dbError);

      await expect(service.findOrCreateGoogleUser(googleProfile())).rejects.toBe(dbError);
      expect(mockOauthAccountRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('does not return a new google user when balance provisioning fails', async () => {
      const balanceFailure = new Error('google balance failure');
      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);

      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return { id: 'google-balance-fail-user', ...value };
        }
        if (entity === CreditBalance) {
          throw balanceFailure;
        }
        return value;
      });

      await expect(service.findOrCreateGoogleUser(googleProfile())).rejects.toBe(balanceFailure);
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('auto-links a real email to an existing user without creating another balance', async () => {
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('commits private-relay apple user, balance, and oauth link atomically', async () => {
      const savedUser = {
        id: 'user-7',
        email: 'relay@privaterelay.appleid.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-789',
        emailVerified: true,
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: new Date('2026-01-02T00:00:00.000Z'),
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return savedUser;
        }
        if (entity === CreditBalance) {
          return { id: 'apple-balance-private', ...value };
        }
        if (entity === OauthAccount) {
          return { id: 'apple-oauth-private', ...value };
        }
        return value;
      });

      const result = await service.findOrCreateAppleUser(
        appleProfile({
          appleId: 'apple-user-789',
          email: 'relay@privaterelay.appleid.com',
          isPrivateEmail: true,
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expectAtomicSaveOrder([User, CreditBalance, OauthAccount]);
      expect(mockOauthAccountRepository.save).not.toHaveBeenCalled();
    });

    it('commits new apple user, balance, and oauth link atomically', async () => {
      const savedUser = {
        id: 'user-8',
        email: 'new.apple.user@example.com',
        passwordHash: null,
        authProvider: 'apple',
        oauthId: 'apple-user-999',
        emailVerified: true,
        role: 'user',
        planType: 'free',
        isActive: true,
        lastLoginAt: new Date('2026-01-03T00:00:00.000Z'),
      } as unknown as User;

      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return savedUser;
        }
        if (entity === CreditBalance) {
          return { id: 'apple-balance-new', ...value };
        }
        if (entity === OauthAccount) {
          return { id: 'apple-oauth-new', ...value };
        }
        return value;
      });

      const result = await service.findOrCreateAppleUser(
        appleProfile({
          appleId: 'apple-user-999',
          email: 'new.apple.user@example.com',
        }),
      );

      expect(result).toBe(savedUser);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expectAtomicSaveOrder([User, CreditBalance, OauthAccount]);
      expect(mockOauthAccountRepository.save).not.toHaveBeenCalled();
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
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
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('refetches and returns committed apple winner on oauth uniqueness race', async () => {
      const winner = {
        id: 'apple-winner-1',
        email: 'apple.winner@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
      } as User;

      mockOauthAccountRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'oauth-apple-winner',
          user: winner,
        });

      mockDataSource.transaction.mockRejectedValue(
        buildUniqueViolationError('uq_oauth_accounts_provider_provider_account_id'),
      );

      const result = await service.findOrCreateAppleUser(
        appleProfile({
          appleId: 'apple-winner-id',
          email: 'relay@privaterelay.appleid.com',
          isPrivateEmail: true,
        }),
      );

      expect(result).toBe(winner);
      expect(mockUserRepository.update).toHaveBeenCalledWith('apple-winner-1', {
        lastLoginAt: expect.any(Date),
      });
    });

    it('does not return a new apple user when balance provisioning fails', async () => {
      const balanceFailure = new Error('apple balance failure');
      mockOauthAccountRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null);
      transactionManager.save.mockImplementation(async (entity: unknown, value: Record<string, unknown>) => {
        if (entity === User) {
          return { id: 'apple-balance-fail-user', ...value };
        }
        if (entity === CreditBalance) {
          throw balanceFailure;
        }
        return value;
      });

      await expect(
        service.findOrCreateAppleUser(
          appleProfile({
            appleId: 'apple-balance-fail-id',
            email: 'apple-new-user@example.com',
          }),
        ),
      ).rejects.toBe(balanceFailure);
    });
  });
});
