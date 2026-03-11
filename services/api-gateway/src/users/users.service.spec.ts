import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { QuotaService } from '../quota/quota.service';
import { QuotaConfig } from '../quota/quota.config';
import { UsersService } from './users.service';

describe('UsersService (TASK-68B-2)', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let quotaService: jest.Mocked<QuotaService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
    };

    const mockQuotaService = {
      getActiveSessionCount: jest.fn(),
      getRolling24hSessionCount: jest.fn(),
      getRolling24hTokenUsage: jest.fn(),
      getOldestUsageIn24h: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    quotaService = module.get(QuotaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('returns current user profile fields', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      } as User);

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        email: 'user@example.com',
        createdAt: '2026-03-10T10:00:00.000Z',
      });
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getUsage', () => {
    it('returns rolling 24h usage summary with resetAt and estimated cost', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      } as User);
      quotaService.getActiveSessionCount.mockResolvedValue(3);
      quotaService.getRolling24hSessionCount.mockResolvedValue(8);
      quotaService.getRolling24hTokenUsage.mockResolvedValue(45230);
      quotaService.getOldestUsageIn24h.mockResolvedValue(
        new Date('2026-03-09T20:00:00.000Z'),
      );

      const result = await service.getUsage('user-1');

      expect(result).toEqual({
        activeSessions: 3,
        sessionsCreated24h: 8,
        tokensUsed24h: 45230,
        estimatedCost: 0.452,
        resetAt: '2026-03-10T20:00:00.000Z',
      });
    });

    it('returns resetAt as null when there is no usage in rolling window', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      } as User);
      quotaService.getActiveSessionCount.mockResolvedValue(0);
      quotaService.getRolling24hSessionCount.mockResolvedValue(0);
      quotaService.getRolling24hTokenUsage.mockResolvedValue(0);
      quotaService.getOldestUsageIn24h.mockResolvedValue(null);

      const result = await service.getUsage('user-1');

      expect(result).toEqual({
        activeSessions: 0,
        sessionsCreated24h: 0,
        tokensUsed24h: 0,
        estimatedCost: 0,
        resetAt: null,
      });
    });

    it('throws UnauthorizedException for inactive/missing user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUsage('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getQuotas', () => {
    it('returns limits plus current usage values', async () => {
      jest.spyOn(service, 'getUsage').mockResolvedValue({
        activeSessions: 2,
        sessionsCreated24h: 7,
        tokensUsed24h: 12000,
        estimatedCost: 0.12,
        resetAt: '2026-03-11T12:00:00.000Z',
      });

      const result = await service.getQuotas('user-1');

      expect(result).toEqual({
        maxActiveSessions: QuotaConfig.MAX_ACTIVE_SESSIONS_PER_USER,
        currentActiveSessions: 2,
        maxSessions24h: QuotaConfig.MAX_SESSIONS_PER_24H,
        currentSessions24h: 7,
        maxTokens24h: QuotaConfig.MAX_TOKENS_PER_24H,
        currentTokens24h: 12000,
        resetAt: '2026-03-11T12:00:00.000Z',
      });
    });

    it('throws UnauthorizedException for inactive/missing user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      quotaService.getActiveSessionCount.mockResolvedValue(0);
      quotaService.getRolling24hSessionCount.mockResolvedValue(0);
      quotaService.getRolling24hTokenUsage.mockResolvedValue(0);
      quotaService.getOldestUsageIn24h.mockResolvedValue(null);

      await expect(service.getQuotas('missing-user')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
