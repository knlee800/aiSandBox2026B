import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { UsageRecord } from '../../entities/usage-record.entity';
import { AdminDashboardController } from '../admin-dashboard.controller';
import { AdminDashboardService } from '../admin-dashboard.service';
import { InternalServiceAuthGuard } from '../../guards/internal-service-auth.guard';

describe('AdminDashboard Integration (TASK-68B-3)', () => {
  let controller: AdminDashboardController;
  let sessionRepository: any;
  let usageRecordRepository: any;
  let originalInternalServiceKey: string | undefined;

  beforeEach(async () => {
    originalInternalServiceKey = process.env.INTERNAL_SERVICE_KEY;
    process.env.INTERNAL_SERVICE_KEY = 'test-internal-key';

    const sessionQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getMany: jest.fn(),
    };

    const usageQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    const mockUserRepository = {
      find: jest.fn(),
    };

    const mockSessionRepository = {
      createQueryBuilder: jest.fn(() => sessionQb),
    };

    const mockUsageRecordRepository = {
      createQueryBuilder: jest.fn(() => usageQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        AdminDashboardService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(UsageRecord),
          useValue: mockUsageRecordRepository,
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
    sessionRepository = module.get(getRepositoryToken(Session));
    usageRecordRepository = module.get(getRepositoryToken(UsageRecord));
  });

  afterEach(() => {
    process.env.INTERNAL_SERVICE_KEY = originalInternalServiceKey;
    jest.clearAllMocks();
  });

  it('supports GET /api/internal/admin/users success path', async () => {
    const userRepository = (controller as any).adminDashboardService['userRepository'];
    userRepository.find.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        planType: 'free',
        isActive: true,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      },
    ]);

    sessionRepository.createQueryBuilder().getRawMany.mockResolvedValue([
      {
        userId: 'user-1',
        totalSessions: '3',
        activeSessions: '1',
        sessionsCreated24h: '2',
      },
    ]);

    usageRecordRepository.createQueryBuilder().getRawMany.mockResolvedValue([
      { userId: 'user-1', tokensUsed24h: '1500' },
    ]);

    const result = await controller.getUsers(undefined, undefined);

    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe('user-1');
    expect(result.users[0].estimatedCost).toBe(0.015);
  });

  it('supports GET /api/internal/admin/sessions success path', async () => {
    sessionRepository.createQueryBuilder().getMany.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        user: { email: 'user@example.com' },
        status: 'active',
        terminatedAt: null,
        terminationReason: null,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
        lastActivityAt: new Date('2026-03-10T10:05:00.000Z'),
        expiresAt: new Date('2026-03-10T12:00:00.000Z'),
      },
    ]);

    const result = await controller.getSessions('active', 'user-1', '24h');

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].sessionId).toBe('session-1');
  });

  it('enforces internal auth guard behavior', () => {
    const guard = new InternalServiceAuthGuard();
    const createContext = (path: string, key?: string) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            path,
            headers: key ? { 'x-internal-service-key': key } : {},
          }),
        }),
      }) as any;

    expect(() => guard.canActivate(createContext('/api/internal/admin/users'))).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(createContext('/api/internal/admin/users', 'wrong-key')),
    ).toThrow(UnauthorizedException);
    expect(
      guard.canActivate(createContext('/api/internal/admin/users', 'test-internal-key')),
    ).toBe(true);
  });
});
