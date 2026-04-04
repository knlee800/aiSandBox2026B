import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { UsageRecord } from '../../entities/usage-record.entity';
import { Plan } from '../../entities/plan.entity';
import { UsersService } from '../../users/users.service';
import { QuotaService } from '../../quota/quota.service';
import { AdminDashboardService } from '../admin-dashboard.service';
import { SessionService } from '../../sessions/session.service';
import { SessionRepository } from '../../repositories/session.repository';
import { ContainerManagerHttpClient } from '../../clients/container-manager-http.client';

describe('Cross-Surface Visibility Coherence (TASK-74C-1)', () => {
  let usersService: UsersService;
  let adminDashboardService: AdminDashboardService;
  let sessionService: SessionService;

  let userRepository: jest.Mocked<Repository<User>>;
  let usersPlanRepository: jest.Mocked<Repository<Plan>>;
  let quotaService: jest.Mocked<QuotaService>;
  let adminUserRepository: jest.Mocked<Repository<User>>;
  let adminSessionRepository: jest.Mocked<Repository<Session>>;
  let usageRecordRepository: jest.Mocked<Repository<UsageRecord>>;
  let planRepository: jest.Mocked<Repository<Plan>>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let containerClient: jest.Mocked<ContainerManagerHttpClient>;
  let adminSessionService: jest.Mocked<SessionService>;

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    usersPlanRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Plan>>;

    quotaService = {
      getActiveSessionCount: jest.fn(),
      getRolling24hSessionCount: jest.fn(),
      getRolling24hTokenUsage: jest.fn(),
      getOldestUsageIn24h: jest.fn(),
    } as unknown as jest.Mocked<QuotaService>;

    adminUserRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    adminSessionRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<Session>>;

    usageRecordRepository = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<UsageRecord>>;
    planRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Plan>>;

    sessionRepository = {
      findByUser: jest.fn(),
    } as unknown as jest.Mocked<SessionRepository>;
    containerClient = {
      stopSession: jest.fn(),
    } as unknown as jest.Mocked<ContainerManagerHttpClient>;
    adminSessionService = {
      terminateSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    usersService = new UsersService(userRepository, usersPlanRepository, quotaService);
    adminDashboardService = new AdminDashboardService(
      adminUserRepository,
      adminSessionRepository,
      usageRecordRepository,
      planRepository,
      containerClient,
      adminSessionService,
    );
    sessionService = new SessionService(sessionRepository);
  });

  it('keeps usage/quota signals coherent with admin user visibility', async () => {
    const activeUser = {
      id: 'user-1',
      email: 'user@example.com',
      createdAt: new Date('2026-03-11T00:00:00.000Z'),
      isActive: true,
    } as User;

    userRepository.findOne.mockResolvedValue(activeUser);
    quotaService.getActiveSessionCount.mockResolvedValue(2);
    quotaService.getRolling24hSessionCount.mockResolvedValue(5);
    quotaService.getRolling24hTokenUsage.mockResolvedValue(10000);
    quotaService.getOldestUsageIn24h.mockResolvedValue(
      new Date('2026-03-10T12:00:00.000Z'),
    );

    adminUserRepository.find.mockResolvedValue([
      {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
        planStatus: 'active',
        planType: 'free',
        isActive: true,
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
      } as User,
    ]);
    planRepository.find.mockResolvedValue([
      { code: 'free', name: 'Free' } as Plan,
    ]);

    const adminUserSessionQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          userId: 'user-1',
          totalSessions: '9',
          activeSessions: '2',
          sessionsCreated24h: '5',
        },
      ]),
    };
    const usageQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { userId: 'user-1', tokensUsed24h: '10000' },
      ]),
    };

    adminSessionRepository.createQueryBuilder.mockReturnValue(adminUserSessionQb);
    usageRecordRepository.createQueryBuilder.mockReturnValue(usageQb);

    const usage = await usersService.getUsage('user-1');
    const quotas = await usersService.getQuotas('user-1');
    const adminUsers = await adminDashboardService.getAdminUsers({});

    expect(adminUsers.users).toHaveLength(1);
    expect(adminUsers.users[0].activeSessions).toBe(usage.activeSessions);
    expect(adminUsers.users[0].sessionsCreated24h).toBe(usage.sessionsCreated24h);
    expect(adminUsers.users[0].tokensUsed24h).toBe(usage.tokensUsed24h);
    expect(adminUsers.users[0].estimatedCost).toBe(usage.estimatedCost);
    expect(quotas.currentActiveSessions).toBe(adminUsers.users[0].activeSessions);
    expect(quotas.currentSessions24h).toBe(adminUsers.users[0].sessionsCreated24h);
    expect(quotas.currentTokens24h).toBe(adminUsers.users[0].tokensUsed24h);
  });

  it('keeps includeTerminated session view coherent with admin sessions view', async () => {
    const userSessions: Session[] = [
      {
        id: 'session-new',
        userId: 'user-1',
        status: 'active' as any,
        terminatedAt: null,
        terminationReason: null,
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
        lastActivityAt: new Date('2026-03-11T10:05:00.000Z'),
        expiresAt: new Date('2026-03-11T11:00:00.000Z'),
      } as Session,
      {
        id: 'session-old',
        userId: 'user-1',
        status: 'stopped' as any,
        terminatedAt: new Date('2026-03-11T08:00:00.000Z'),
        terminationReason: 'manual',
        createdAt: new Date('2026-03-11T07:00:00.000Z'),
        lastActivityAt: new Date('2026-03-11T07:10:00.000Z'),
        expiresAt: new Date('2026-03-11T09:00:00.000Z'),
      } as Session,
    ];

    sessionRepository.findByUser.mockResolvedValue(userSessions);

    const adminSessionsQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(
        userSessions.map((session) => ({
          ...session,
          user: { email: 'user@example.com' },
        })),
      ),
    };
    adminSessionRepository.createQueryBuilder.mockReturnValue(adminSessionsQb);

    const userFacing = await sessionService.getSessionsByUser('user-1', true);
    const adminFacing = await adminDashboardService.getAdminSessions({
      userId: 'user-1',
    });

    expect(userFacing.map((s) => s.id)).toEqual(
      adminFacing.sessions.map((s) => s.sessionId),
    );
    expect(userFacing.map((s) => !!s.terminatedAt)).toEqual(
      adminFacing.sessions.map((s) => s.isTerminated),
    );
  });

  it('preserves deterministic failure semantics for invalid/missing state', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(usersService.getUsage('missing-user')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(usersService.getQuotas('missing-user')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      adminDashboardService.getAdminUsers({
        quotaStatus: 'NOT_VALID' as any,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      adminDashboardService.getAdminSessions({
        status: 'NOT_VALID' as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
