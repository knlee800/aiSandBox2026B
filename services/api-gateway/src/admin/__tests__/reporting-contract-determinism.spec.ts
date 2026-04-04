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

describe('Reporting Contract Determinism Validation (TASK-74C-2)', () => {
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

  it('keeps admin/user reporting outputs ordering-stable and field-complete', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'one@example.com',
      isActive: true,
      createdAt: new Date('2026-03-11T00:00:00.000Z'),
    } as User);
    quotaService.getActiveSessionCount.mockResolvedValue(2);
    quotaService.getRolling24hSessionCount.mockResolvedValue(4);
    quotaService.getRolling24hTokenUsage.mockResolvedValue(12000);
    quotaService.getOldestUsageIn24h.mockResolvedValue(
      new Date('2026-03-10T12:00:00.000Z'),
    );

    adminUserRepository.find.mockResolvedValue([
      {
        id: 'user-2',
        email: 'two@example.com',
        role: 'user',
        planType: 'free',
        planStatus: 'active',
        isActive: true,
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
      } as User,
      {
        id: 'user-1',
        email: 'one@example.com',
        role: 'user',
        planType: 'free',
        planStatus: 'active',
        isActive: true,
        createdAt: new Date('2026-03-11T08:00:00.000Z'),
      } as User,
    ]);
    planRepository.find.mockResolvedValue([{ code: 'free', name: 'Free' } as Plan]);

    const adminUserSessionQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          userId: 'user-2',
          totalSessions: '7',
          activeSessions: '3',
          sessionsCreated24h: '4',
        },
        {
          userId: 'user-1',
          totalSessions: '2',
          activeSessions: '2',
          sessionsCreated24h: '4',
        },
      ]),
    };
    const usageQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { userId: 'user-2', tokensUsed24h: '20000' },
        { userId: 'user-1', tokensUsed24h: '12000' },
      ]),
    };
    adminSessionRepository.createQueryBuilder.mockReturnValue(adminUserSessionQb);
    usageRecordRepository.createQueryBuilder.mockReturnValue(usageQb);

    const usageFirst = await usersService.getUsage('user-1');
    const usageSecond = await usersService.getUsage('user-1');
    const quotasFirst = await usersService.getQuotas('user-1');
    const quotasSecond = await usersService.getQuotas('user-1');

    const adminUsersFirst = await adminDashboardService.getAdminUsers({});
    const adminUsersSecond = await adminDashboardService.getAdminUsers({});

    expect(usageSecond).toEqual(usageFirst);
    expect(quotasSecond).toEqual(quotasFirst);
    expect(adminUsersSecond).toEqual(adminUsersFirst);
    expect(adminUsersFirst.users.map((u) => u.userId)).toEqual(['user-2', 'user-1']);
    expect(Object.keys(adminUsersFirst.users[0]).sort()).toEqual(
      [
        'activeSessions',
        'createdAt',
        'email',
        'estimatedCost',
        'isActive',
        'planCode',
        'planName',
        'planStatus',
        'planType',
        'quotaStatus',
        'role',
        'sessionsCreated24h',
        'tokensUsed24h',
        'totalSessions',
        'userId',
      ].sort(),
    );
  });

  it('keeps includeTerminated and admin sessions ordering-stable and field-complete', async () => {
    const sessions: Session[] = [
      {
        id: 'session-b',
        userId: 'user-1',
        status: 'active' as any,
        terminatedAt: null,
        terminationReason: null,
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
        lastActivityAt: new Date('2026-03-11T10:05:00.000Z'),
        expiresAt: new Date('2026-03-11T12:00:00.000Z'),
      } as Session,
      {
        id: 'session-a',
        userId: 'user-1',
        status: 'stopped' as any,
        terminatedAt: new Date('2026-03-11T08:00:00.000Z'),
        terminationReason: 'manual',
        createdAt: new Date('2026-03-11T07:00:00.000Z'),
        lastActivityAt: new Date('2026-03-11T07:03:00.000Z'),
        expiresAt: new Date('2026-03-11T09:00:00.000Z'),
      } as Session,
    ];
    sessionRepository.findByUser.mockResolvedValue(sessions);

    const adminSessionsQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(
        sessions.map((session) => ({
          ...session,
          user: { email: 'user@example.com' },
        })),
      ),
    };
    adminSessionRepository.createQueryBuilder.mockReturnValue(adminSessionsQb);

    const userFirst = await sessionService.getSessionsByUser('user-1', true);
    const userSecond = await sessionService.getSessionsByUser('user-1', true);
    const adminFirst = await adminDashboardService.getAdminSessions({ userId: 'user-1' });
    const adminSecond = await adminDashboardService.getAdminSessions({ userId: 'user-1' });

    expect(userSecond).toEqual(userFirst);
    expect(adminSecond).toEqual(adminFirst);
    expect(userFirst.map((s) => s.id)).toEqual(['session-b', 'session-a']);
    expect(adminFirst.sessions.map((s) => s.sessionId)).toEqual([
      'session-b',
      'session-a',
    ]);
    expect(Object.keys(adminFirst.sessions[0]).sort()).toEqual(
      [
        'createdAt',
        'expiresAt',
        'isTerminated',
        'lastActivityAt',
        'sessionId',
        'status',
        'terminationReason',
        'userEmail',
        'userId',
      ].sort(),
    );
  });

  it('preserves failure semantics consistently across reporting surfaces', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(usersService.getUsage('missing-user')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(usersService.getQuotas('missing-user')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      adminDashboardService.getAdminUsers({ quotaStatus: 'INVALID' as any }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      adminDashboardService.getAdminSessions({ status: 'INVALID' as any }),
    ).rejects.toThrow(BadRequestException);
  });
});
