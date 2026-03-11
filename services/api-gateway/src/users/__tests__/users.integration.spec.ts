import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { QuotaService } from '../../quota/quota.service';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

describe('UsersController Integration (TASK-68B-2)', () => {
  let controller: UsersController;
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
      controllers: [UsersController],
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

    controller = module.get<UsersController>(UsersController);
    userRepository = module.get(getRepositoryToken(User));
    quotaService = module.get(QuotaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('supports GET /api/users/me success path', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
    } as User);

    const result = await controller.getCurrentUser({
      user: { userId: 'user-1' },
    });

    expect(result).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      createdAt: '2026-03-10T10:00:00.000Z',
    });
  });

  it('supports GET /api/users/me/usage success path', async () => {
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

    const result = await controller.getUsage({
      user: { userId: 'user-1' },
    });

    expect(result.activeSessions).toBe(3);
    expect(result.sessionsCreated24h).toBe(8);
    expect(result.tokensUsed24h).toBe(45230);
    expect(result.estimatedCost).toBe(0.452);
  });

  it('supports GET /api/users/me/quotas success path', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
    } as User);
    quotaService.getActiveSessionCount.mockResolvedValue(2);
    quotaService.getRolling24hSessionCount.mockResolvedValue(5);
    quotaService.getRolling24hTokenUsage.mockResolvedValue(10000);
    quotaService.getOldestUsageIn24h.mockResolvedValue(
      new Date('2026-03-09T22:00:00.000Z'),
    );

    const result = await controller.getQuotas({
      user: { userId: 'user-1' },
    });

    expect(result.maxActiveSessions).toBe(5);
    expect(result.currentActiveSessions).toBe(2);
    expect(result.maxSessions24h).toBe(20);
    expect(result.currentSessions24h).toBe(5);
    expect(result.maxTokens24h).toBe(100000);
    expect(result.currentTokens24h).toBe(10000);
  });

  it('propagates invalid/error behavior when user is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      controller.getCurrentUser({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns resetAt null when no 24h usage exists', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
    } as User);
    quotaService.getActiveSessionCount.mockResolvedValue(0);
    quotaService.getRolling24hSessionCount.mockResolvedValue(0);
    quotaService.getRolling24hTokenUsage.mockResolvedValue(0);
    quotaService.getOldestUsageIn24h.mockResolvedValue(null);

    const usage = await controller.getUsage({
      user: { userId: 'user-1' },
    });
    const quotas = await controller.getQuotas({
      user: { userId: 'user-1' },
    });

    expect(usage.resetAt).toBeNull();
    expect(quotas.resetAt).toBeNull();
  });

  it('enforces same unauthorized behavior on usage/quota endpoints', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      controller.getUsage({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      controller.getQuotas({ user: { userId: 'missing-user' } }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
