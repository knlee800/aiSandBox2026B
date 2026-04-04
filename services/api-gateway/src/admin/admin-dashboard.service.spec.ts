import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { UsageRecord } from '../entities/usage-record.entity';
import { Plan } from '../entities/plan.entity';
import { AdminDashboardService } from './admin-dashboard.service';
import { ContainerManagerHttpClient } from '../clients/container-manager-http.client';
import { SessionService } from '../sessions/session.service';

describe('AdminDashboardService (TASK-68B-3)', () => {
  let service: AdminDashboardService;
  let userRepository: jest.Mocked<Repository<User>>;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let usageRecordRepository: jest.Mocked<Repository<UsageRecord>>;
  let planRepository: jest.Mocked<Repository<Plan>>;
  let containerClient: jest.Mocked<ContainerManagerHttpClient>;
  let sessionService: jest.Mocked<SessionService>;

  beforeEach(async () => {
    const mockUserRepository = {
      find: jest.fn(),
    };

    const mockSessionRepository = {
      createQueryBuilder: jest.fn(),
    };

    const mockUsageRecordRepository = {
      createQueryBuilder: jest.fn(),
    };
    const mockPlanRepository = {
      find: jest.fn(),
    };
    const mockContainerClient = {
      stopSession: jest.fn(),
    };
    const mockSessionService = {
      terminateSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
        {
          provide: getRepositoryToken(Plan),
          useValue: mockPlanRepository,
        },
        {
          provide: ContainerManagerHttpClient,
          useValue: mockContainerClient,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
    userRepository = module.get(getRepositoryToken(User));
    sessionRepository = module.get(getRepositoryToken(Session));
    usageRecordRepository = module.get(getRepositoryToken(UsageRecord));
    planRepository = module.get(getRepositoryToken(Plan));
    containerClient = module.get(ContainerManagerHttpClient);
    sessionService = module.get(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns user summaries and supports search/quotaStatus filter', async () => {
    planRepository.find.mockResolvedValue([
      {
        code: 'free',
        name: 'Free',
        maxActiveSessions: 5,
        maxSessions24h: 20,
        maxTokens24h: 100000,
      } as Plan,
    ]);
    userRepository.find.mockResolvedValue([
      {
        id: 'user-1',
        email: 'first@example.com',
        role: 'user',
        planType: 'free',
        planStatus: 'active',
        isActive: true,
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      } as User,
      {
        id: 'user-2',
        email: 'second@example.com',
        role: 'user',
        planType: 'free',
        planStatus: 'active',
        isActive: true,
        createdAt: new Date('2026-03-10T09:00:00.000Z'),
      } as User,
    ]);

    const sessionQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          userId: 'user-1',
          totalSessions: '10',
          activeSessions: '5',
          sessionsCreated24h: '20',
        },
        {
          userId: 'user-2',
          totalSessions: '2',
          activeSessions: '1',
          sessionsCreated24h: '1',
        },
      ]),
    };

    const usageQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { userId: 'user-1', tokensUsed24h: '100000' },
        { userId: 'user-2', tokensUsed24h: '500' },
      ]),
    };

    sessionRepository.createQueryBuilder.mockReturnValue(sessionQb);
    usageRecordRepository.createQueryBuilder.mockReturnValue(usageQb);

    const result = await service.getAdminUsers({
      search: 'first@',
      quotaStatus: 'EXCEEDED',
    });

    expect(result.users).toHaveLength(1);
    expect(result.users[0].userId).toBe('user-1');
    expect(result.users[0].quotaStatus).toBe('EXCEEDED');
    expect(result.users[0].planCode).toBe('free');
    expect(result.users[0].planName).toBe('Free');
    expect(result.users[0].estimatedCost).toBe(1);
  });

  it('throws BadRequestException for invalid users filter', async () => {
    await expect(
      service.getAdminUsers({
        quotaStatus: 'INVALID' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns sessions with status/user/date filters', async () => {
    const sessionsQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'session-1',
          userId: 'user-1',
          user: { email: 'user@example.com' },
          status: 'active',
          terminatedAt: null,
          terminationReason: null,
          createdAt: new Date('2026-03-10T10:00:00.000Z'),
          lastActivityAt: new Date('2026-03-10T10:10:00.000Z'),
          expiresAt: new Date('2026-03-10T12:00:00.000Z'),
        },
      ]),
    };
    sessionRepository.createQueryBuilder.mockReturnValue(sessionsQb);

    const result = await service.getAdminSessions({
      status: 'active',
      userId: 'user-1',
      dateRange: '24h',
      startDate: '2026-03-09T00:00:00.000Z',
      endDate: '2026-03-10T23:59:59.000Z',
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].sessionId).toBe('session-1');
    expect(sessionsQb.andWhere).toHaveBeenCalled();
  });

  it('throws BadRequestException for invalid sessions filters', async () => {
    const sessionsQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    sessionRepository.createQueryBuilder.mockReturnValue(sessionsQb);

    await expect(
      service.getAdminSessions({
        status: 'broken' as any,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getAdminSessions({
        status: 'active',
        startDate: 'not-a-date',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns admin user detail with quota, usage, and plan state', async () => {
    planRepository.find.mockResolvedValue([
      {
        code: 'pro',
        name: 'Pro',
        maxActiveSessions: 10,
        maxSessions24h: 50,
        maxTokens24h: 500000,
      } as Plan,
    ]);
    userRepository.findOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'admin',
      planType: 'pro',
      planStatus: 'active',
      isActive: true,
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
    } as User);

    const sessionQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        totalSessions: '8',
        activeSessions: '3',
        sessionsCreated24h: '6',
      }),
    };
    const usageQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        tokensUsed24h: '9000',
      }),
    };
    sessionRepository.createQueryBuilder.mockReturnValue(sessionQb);
    usageRecordRepository.createQueryBuilder.mockReturnValue(usageQb);

    const detail = await service.getAdminUserDetail('user-1');

    expect(detail.planCode).toBe('pro');
    expect(detail.planName).toBe('Pro');
    expect(detail.planStatus).toBe('active');
    expect(detail.quotas.maxTokens24h).toBe(500000);
    expect(detail.quotas.currentTokens24h).toBe(9000);
  });

  it('terminates session using existing semantics path', async () => {
    const stopSessionMock = containerClient.stopSession as jest.Mock;
    const terminateSessionMock = sessionService.terminateSession as jest.Mock;
    stopSessionMock.mockResolvedValue(undefined);
    terminateSessionMock.mockResolvedValue(undefined);
    sessionRepository.findOne = jest.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      status: 'active',
      terminatedAt: null,
    } as Session);

    const result = await service.terminateSessionAsAdmin('session-1', 'ops@example.com');

    expect(stopSessionMock).toHaveBeenCalledWith('session-1');
    expect(terminateSessionMock).toHaveBeenCalledWith('session-1', 'manual');
    expect(result).toEqual({ message: 'Session terminated successfully' });
  });
});
