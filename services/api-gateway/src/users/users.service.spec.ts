import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { QuotaService } from '../quota/quota.service';
import { UsersService } from './users.service';

describe('UsersService (CO-02-01)', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let planRepository: jest.Mocked<Repository<Plan>>;
  let quotaService: jest.Mocked<QuotaService>;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
    };
    const mockPlanRepository = {
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
          provide: getRepositoryToken(Plan),
          useValue: mockPlanRepository,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    planRepository = module.get(getRepositoryToken(Plan));
    quotaService = module.get(QuotaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('returns current user profile fields including plan state', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        planType: 'free',
        planStatus: 'active',
      } as User);
      planRepository.findOne.mockResolvedValue({
        code: 'free',
        name: 'Free',
        maxActiveSessions: 5,
        maxSessions24h: 20,
        maxTokens24h: 100000,
      } as Plan);

      const result = await service.getCurrentUser('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        email: 'user@example.com',
        createdAt: '2026-03-10T10:00:00.000Z',
        planCode: 'free',
        planName: 'Free',
        planStatus: 'active',
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
        planType: 'free',
        planStatus: 'active',
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
  });

  describe('getQuotas', () => {
    it('returns limits from active assigned plan plus current usage values', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        planType: 'pro',
        planStatus: 'active',
      } as User);
      quotaService.getActiveSessionCount.mockResolvedValue(2);
      quotaService.getRolling24hSessionCount.mockResolvedValue(7);
      quotaService.getRolling24hTokenUsage.mockResolvedValue(12000);
      quotaService.getOldestUsageIn24h.mockResolvedValue(
        new Date('2026-03-10T12:00:00.000Z'),
      );
      planRepository.findOne.mockResolvedValue({
        code: 'pro',
        name: 'Pro',
        maxActiveSessions: 15,
        maxSessions24h: 100,
        maxTokens24h: 500000,
      } as Plan);

      const result = await service.getQuotas('user-1');

      expect(result).toEqual({
        planCode: 'pro',
        planName: 'Pro',
        planStatus: 'active',
        maxActiveSessions: 15,
        currentActiveSessions: 2,
        maxSessions24h: 100,
        currentSessions24h: 7,
        maxTokens24h: 500000,
        currentTokens24h: 12000,
        resetAt: '2026-03-11T12:00:00.000Z',
      });
    });

    it('falls back to free plan limits when assignment status is cancelled', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        planType: 'pro',
        planStatus: 'cancelled',
      } as User);
      quotaService.getActiveSessionCount.mockResolvedValue(1);
      quotaService.getRolling24hSessionCount.mockResolvedValue(3);
      quotaService.getRolling24hTokenUsage.mockResolvedValue(5000);
      quotaService.getOldestUsageIn24h.mockResolvedValue(null);
      planRepository.findOne.mockResolvedValue({
        code: 'free',
        name: 'Free',
        maxActiveSessions: 5,
        maxSessions24h: 20,
        maxTokens24h: 100000,
      } as Plan);

      const result = await service.getQuotas('user-1');
      expect(result.planCode).toBe('free');
      expect(result.planName).toBe('Free');
      expect(result.planStatus).toBe('cancelled');
      expect(result.maxTokens24h).toBe(100000);
    });
  });
});
